const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs'),L=require('../dist/song-library.js');
const identity={title:'Fixture Song',artist:'Fixture Artist'},parts=['guitar','drums','bass','vocals'],query={filename:'Fixture Artist - Fixture Song.wav',duration:16,parts};
const verified=async({parts})=>Object.fromEntries(parts.map(part=>[part,{status:'aligned',referenceInstrument:part,shiftSeconds:0,message:'Own recording matched.'}]));
const pack=(icon,data=F.fullMidi())=>F.sng(data,{metadata:{name:identity.title,artist:identity.artist,icon,five_lane_drums:'True',delay:'0'}});
for(const icon of ['gh','gh1','ghdx','gh1dx','gh2','gh2dlc','gh2dx','gh2dxdlc','gh2dxcustoms','gh3','gh3dlc'])test(`${icon}: only Guitar can be sourced, even with misleading catalog flags and other MIDI parts`,async()=>{
 const row={...F.row,icon,notesData:{...F.row.notesData,hasVocals:true}},net=F.network({rows:[row],container:pack(icon)}),r=await C.lookup({...query,fetcher:net.fetcher,alignAudio:verified});
 assert.deepEqual(Object.keys(r.charts),['guitar']);assert.deepEqual(r.availableParts,['guitar']);assert.equal(r.references.guitar.guitarOnly,true);assert.equal(r.references.guitar.sourceFamily,'Guitar Hero');assert.match(r.sources.guitar,/Guitar Hero [123] chart conversion/);
 for(const part of ['drums','bass','vocals'])assert.equal(C.available(row,part),false);
 assert.equal(C.available(row,'guitar'),true);assert.ok(r.charts.guitar.expert.some(n=>n.duration>0));assert.ok(r.charts.guitar.easy.length);assert.match(r.message,/Audio charting used for drums, bass, vocals/);
});
for(const icon of ['ghwt','ghwtdlc','ghm','ghmdlc','ghsh','gh5','gh5dlc','ghvh','ghwor','ghwordlc','bh'])test(`${icon}: game conversion must have its own actual Drum track`,async()=>{
 const row={...F.row,icon,md5:'b'.repeat(32)},net=F.network({rows:[{...F.row,md5:'a'.repeat(32)},row],containers:{['a'.repeat(32)]:F.sng(),['b'.repeat(32)]:pack(icon)}}),r=await C.lookup({...query,parts:['drums'],fetcher:net.fetcher});
 assert.equal(r.references.drums.md5,row.md5);assert.equal(r.references.drums.sourceFamily,'Guitar Hero');assert.equal(r.references.drums.guitarOnly,false);assert.deepEqual(r.charts.drums.expert.map(n=>n.lane),[0,5,1,2,3,4]);assert.ok(r.charts.drums.expert.every(n=>n.duration===0));assert.deepEqual(Object.keys(r.charts),['drums']);
});
test('source folder labels identify early games, while song titles and charter names alone cannot claim a game source',()=>{
 for(const [label,game] of [['Guitar Hero I','Guitar Hero 1'],['Guitar Hero II DLC','Guitar Hero 2'],['Guitar Hero III: Legends of Rock','Guitar Hero 3'],['Guitar Hero: World Tour','Guitar Hero: World Tour']])assert.equal(C.gameSource({drivePath:'Official Games/'+label+'/Setlist'}).game,game);
 for(const row of [{name:'Guitar Hero III',charter:'Neversoft'},{charter:'Harmonix',icon:'rb2'},{icon:'constructor'},{icon:'ghxcustom'}])assert.equal(C.gameSource(row),null);
});
test('GH1–3 candidates cannot supply drums; ordinary community drums remain eligible for those songs',()=>{
 const old={...F.row,icon:'gh3',md5:'a'.repeat(32)},custom={...F.row,md5:'b'.repeat(32)};
 assert.equal(C.match([old,custom],identity,16,['drums']).row.md5,custom.md5);assert.equal(C.match([old,custom],identity,16,['guitar']).row.md5,old.md5);
});
test('a legacy game cover or unrelated waveform cannot use a near-identical title and duration to supply Guitar',async()=>{
 for(const alignAudio of [undefined,async()=>({guitar:{status:'uncertain',referenceInstrument:'guitar',shiftSeconds:null,message:'Different performance.'}})]){
  const r=await C.lookup({...query,parts:['guitar'],fetcher:F.network({rows:[{...F.row,icon:'gh2'}],container:pack('gh2')}).fetcher,alignAudio});assert.deepEqual(r.charts,{});
 }
});
test('downloaded GH3 metadata blocks Drum import even when the search result omitted the game label',async()=>{
 const r=await C.lookup({...query,parts:['drums'],fetcher:F.network({container:pack('gh3')}).fetcher});assert.deepEqual(r.charts,{});assert.match(r.issues.drums,/guitar-only/);
});
test('a misleading GH drum count cannot fall back to its Guitar MIDI; another community drum track is tried',async()=>{
 const game={...F.row,icon:'ghwt',md5:'a'.repeat(32)},custom={...F.row,md5:'b'.repeat(32)},guitar=F.midi([{name:'PART GUITAR',notes:[{tick:960,code:96}]}]),net=F.network({rows:[custom,game],containers:{[game.md5]:pack('ghwt',guitar),[custom.md5]:F.sng()}}),r=await C.lookup({...query,parts:['drums'],fetcher:net.fetcher});
 assert.equal(r.references.drums.md5,custom.md5);assert.equal(r.attempts[0].md5,game.md5);assert.equal(r.attempts[0].status,'unsupported');assert.deepEqual(r.charts.drums.expert.map(n=>n.lane),[0,5,1,2,3,3]);
});
test('Whole song chooses independent GH3 Guitar and later-game Drums; credits and arrangements persist in a backup',async()=>{
 const old={...F.row,icon:'gh3',md5:'a'.repeat(32)},later={...F.row,icon:'ghwt',md5:'b'.repeat(32),notesData:{noteCounts:F.row.notesData.noteCounts.filter(n=>n.instrument==='drums')}},other={...F.row,md5:'c'.repeat(32)},net=F.network({rows:[other,later,old],containers:{[old.md5]:pack('gh3'),[later.md5]:pack('ghwt'),[other.md5]:F.sng()}}),r=await C.lookup({...query,fetcher:net.fetcher,alignAudio:verified});
 assert.equal(r.references.guitar.game,'Guitar Hero 3');assert.equal(r.references.drums.game,'Guitar Hero: World Tour');assert.deepEqual(Object.keys(r.charts),['guitar','drums','bass','vocals']);
 const imports=Object.fromEntries(Object.entries(r.imports).map(([part,x])=>[part,{...x,id:'c'.repeat(64)}])),song={id:'d'.repeat(64),title:identity.title,instrument:'drums',musicEnd:16,bpm:r.bpm,beat:r.beat,charts:r.charts,quality:{imports,communityReferences:r.references},audioBlob:new Blob(['Original local audio'])},saved=await L.unpack(L.pack(song));
 assert.deepEqual(saved.charts,r.charts);assert.deepEqual(saved.quality.communityReferences,r.references);assert.equal(await saved.audioBlob.text(),'Original local audio');
});
test('saturated catalog pages trigger bounded game-charter searches and recover a buried Guitar Hero drum chart',async()=>{
 const pages=Array.from({length:3},(_,p)=>Array.from({length:50},(_,i)=>({...F.row,name:'Other Song '+(p*50+i),md5:(p*50+i+1).toString(16).padStart(32,'0')}))),game={...F.row,icon:'ghm',md5:'f'.repeat(32)},net=F.network({rows:[game],container:pack('ghm')}),searches=[];
 const fetcher=async(url,options)=>{if(url.endsWith('/search')){const q=JSON.parse(options.body);searches.push(q);if(!q.search.endsWith(' Neversoft'))return new Response(JSON.stringify({data:pages[q.page-1]}));}return net.fetcher(url,options);};
 const r=await C.lookup({...query,parts:['drums'],fetcher});assert.equal(r.references.drums.game,'Guitar Hero: Metallica');assert.equal(searches.length,4);assert.equal(searches[3].search,'Fixture Artist Fixture Song Neversoft');
});
test('game-source preference never relaxes artist, recording version, duration, opt-out or host access checks',async()=>{
 for(const changed of [{artist:'Cover Band'},{name:'Fixture Song Live'},{song_length:25000}])assert.equal(C.match([{...F.row,icon:'ghwt',...changed}],identity,16,['drums']).row,undefined);
 const net=F.network({rows:[{...F.row,icon:'ghwt'}],container:pack('ghwt'),blocked:true}),r=await C.lookup({...query,parts:['drums'],fetcher:net.fetcher});assert.deepEqual(r.charts,{});assert.equal(r.attempts.length,1);
 const off=F.network();await C.lookup({...query,enabled:false,fetcher:off.fetcher});assert.equal(off.requests.length,0);
});
test('bounded Harmonix search recovers a legacy Guitar chart only with its own recording match',async()=>{
 const pages=Array.from({length:3},(_,p)=>Array.from({length:50},(_,i)=>({...F.row,name:'Other Song '+(p*50+i),md5:(p*50+i+1).toString(16).padStart(32,'0')}))),game={...F.row,icon:'gh2',md5:'f'.repeat(32)},net=F.network({rows:[game],container:pack('gh2')}),searches=[];
 const fetcher=async(url,options)=>{if(url.endsWith('/search')){const q=JSON.parse(options.body);searches.push(q);if(q.search.endsWith(' Neversoft'))return new Response(JSON.stringify({data:[]}));if(!q.search.endsWith(' Harmonix'))return new Response(JSON.stringify({data:pages[q.page-1]}));}return net.fetcher(url,options);};
 const r=await C.lookup({...query,parts:['guitar'],fetcher,alignAudio:verified});assert.equal(r.references.guitar.game,'Guitar Hero 2');assert.equal(searches.length,5);assert.equal(searches[4].search,'Fixture Artist Fixture Song Harmonix');assert.deepEqual(Object.keys(r.charts),['guitar']);
});
test('a blocked supplemental search stops catalog/download requests without trying another host',async()=>{
 const searches=[],fetcher=async(url,options)=>{assert.equal(url,'https://api.enchor.us/search');const q=JSON.parse(options.body);searches.push(q);if(q.search.endsWith(' Neversoft'))return new Response('Blocked',{status:403});return new Response(JSON.stringify({data:Array.from({length:50},(_,i)=>({...F.row,name:'Other Song',md5:(q.page*50+i+1).toString(16).padStart(32,'0')}))}));};
 const r=await C.lookup({...query,fetcher});assert.deepEqual(r.charts,{});assert.equal(searches.length,4);assert.match(r.message,/Could not fetch/);
});
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} future Drums upload selects a game chart, saves it and reopens with its source`,async()=>{
 const game={...F.row,icon:'ghm',md5:'b'.repeat(32)},net=F.network({rows:[F.row,game],containers:{[F.row.md5]:F.sng(),[game.md5]:pack('ghm')}}),app=setup({mobile,chartFixture:[],browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:q=>C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher})}}});
 await app.nodes.libraryUploadDrums.click();await app.upload(query.filename);await until(()=>!app.nodes.saveCurrentButton.disabled);const song=[...app.savedSongs.values()][0];assert.deepEqual(app.requests,[]);assert.deepEqual(Object.keys(song.charts),['drums']);assert.equal(song.quality.communityReferences.drums.game,'Guitar Hero: Metallica');assert.match(app.nodes.chartDetails.textContent,/Guitar Hero: Metallica/);
 const fresh=setup({mobile,chartFixture:[],savedSongs:app.savedSongs});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.body.classList.contains('is-drums'),true);assert.deepEqual(fresh.requests,[]);
});
