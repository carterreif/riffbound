const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const F=require('./helpers/community-fixture.cjs'),M=require('../dist/midi-chart.js'),X=require('../dist/chart-exchange.js'),L=require('../dist/song-library.js');
const midi=F.midi([{name:'PART GUITAR',notes:[{tick:480,code:96,length:480}]},{name:'PART DRUMS',notes:[{tick:960,code:97},{tick:1080,code:98},{tick:1200,code:99},{tick:1320,code:100},{tick:1440,code:96}]}]);
const row={title:'Fixture Song',artist:'Fixture Artist',author:'Fixture Drummer',provider:'Onyxite published customs',path:'songs/fixture-artist/fixture-song/notes.mid',sha256:crypto.createHash('sha256').update(midi).digest('hex'),bytes:midi.length,duration:16,source:'https://github.com/mtolly/onyx/tree/'+'a'.repeat(40)+'/songs/fixture-artist/fixture-song'};
function setup(){
 const catalog={revision:'a'.repeat(40),rows:[{...row}]},sandbox={window:{RiffDrumSourceCatalog:catalog,RiffMidiChart:M,RiffChartExchange:X,navigator:{onLine:true}},AbortController,crypto:crypto.webcrypto,setTimeout,clearTimeout,Uint8Array};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/additional-drum-sources.js'),'utf8'),sandbox);const requests=[];
 return {api:sandbox.window.RiffAdditionalDrumSources,window:sandbox.window,catalog,requests,fetcher:async(u,o)=>{requests.push({u,o});return new Response(midi);}};
}
const empty=()=>({charts:{},imports:{},sources:{},references:{},timings:{},identity:{title:row.title,artist:row.artist},message:'No Chorus Drum chart.'}),query={title:row.title,artist:row.artist,parts:['drums'],chartOnly:true};
test('additional publisher source downloads real Drums only, verifies bytes and keeps authored timing',async()=>{
 const n=setup(),r=await n.api.fill(empty(),{...query,fetcher:n.fetcher});assert.deepEqual(Object.keys(r.charts),['drums']);assert.deepEqual(r.charts.drums.expert.map(n=>n.lane),[0,1,2,3,5]);assert.deepEqual(r.charts.drums.expert.map(n=>n.time),[1,1.125,1.25,1.375,1.5]);
 assert.equal(r.drumLayout,'four');assert.equal(r.duration,16);assert.equal(r.reference.charter,row.author);assert.equal(r.reference.sha256,row.sha256);assert.equal(r.drumCheck.status,'imported');assert.match(r.message,/Chart only.*audio is not included/);assert.equal(r.audioContainer,undefined);
 assert.equal(n.requests.length,1);assert.match(n.requests[0].u,/^https:\/\/raw\.githubusercontent\.com\/mtolly\/onyx\/[a-f0-9]{40}\/songs\//);assert.equal(n.requests[0].o.credentials,'omit');
});
test('a Guitar-only fallback recording cannot be attached to independent published Drum notes',async()=>{
 const n=setup(),r=await n.api.fill({...empty(),audioContainer:{url:'another-recording'},audioOnly:true,reference:{md5:'unrelated'},duration:17},{...query,fetcher:n.fetcher});
 assert.ok(r.charts.drums);assert.equal(r.audioContainer,undefined);assert.equal(r.audioOnly,undefined);assert.equal(r.duration,16);assert.equal(r.reference.sha256,row.sha256);
});
test('uploaded audio and working authored parts remain intact without waveform proof',async()=>{
 for(const extra of [{chartOnly:false},{}]){
  const n=setup(),found=extra.chartOnly===false?empty():{...empty(),charts:{guitar:{expert:[{lane:0,time:1,duration:0}]}},audioContainer:{url:'existing'}},r=await n.api.fill(found,{...query,...extra,fetcher:()=>assert.fail('Unavailable reference audio cannot be replaced by MIDI or filename timing')});
  assert.equal(r.charts,found.charts);assert.equal(r.audioContainer,found.audioContainer);assert.equal(r.additionalDrumCheck.status,'listed');assert.match(r.message,/cannot verify this song audio/);
 }
});
test('identity, opt-out, requested parts, package selection and existing Drums bound the extra lookup',async()=>{
 for(const opts of [{enabled:false},{parts:['guitar']},{packageSource:{}},{artist:'Other Artist'},{title:'Fixture Song (Live)'}]){
  const n=setup(),found=empty();if(opts.artist||opts.title)found.identity={title:opts.title||row.title,artist:opts.artist||row.artist};assert.equal(await n.api.fill(found,{...query,...opts,fetcher:()=>assert.fail()}),found);
 }
 const n=setup(),found={...empty(),charts:{drums:{expert:[{}]}}};assert.equal(await n.api.fill(found,{...query,fetcher:()=>assert.fail()}),found);
 n.window.navigator.onLine=false;const offline=await n.api.fill(empty(),{...query,fetcher:()=>assert.fail()});assert.equal(offline.additionalDrumCheck.status,'unavailable');
});
test('changed bytes, oversized/truncated responses, corrupt MIDI and access blocks never replace a chart',async()=>{
 for(const mode of ['hash','long','short','blocked','midi']){
  const n=setup(),found=empty();let body=Buffer.from(midi);if(mode==='hash')body[body.length-1]^=1;if(mode==='long')body=Buffer.concat([body,Buffer.from([0])]);if(mode==='short')body=body.subarray(0,-1);if(mode==='midi'){body=Buffer.alloc(midi.length);n.catalog.rows[0].sha256=crypto.createHash('sha256').update(body).digest('hex');}
  let calls=0;const r=await n.api.fill(found,{...query,fetcher:async()=>{calls++;return new Response(body,{status:mode==='blocked'?403:200});}});assert.equal(r.charts,found.charts);assert.equal(r.additionalDrumCheck.status,'unavailable');assert.equal(calls,1);
 }
});
test('canceling the additional-source request cannot import late notes',async()=>{
 const n=setup(),controller=new AbortController();controller.abort();await assert.rejects(n.api.fill(empty(),{...query,signal:controller.signal,fetcher:()=>assert.fail()}),/Canceled/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} title-only lookup saves the automatically downloaded Drum chart with clear no-audio status`,async()=>{
 const n=setup(),adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup:appSetup}=new Function('require',code+'\nreturn {setup};')(createRequire(adapter));
 const app=appSetup({mobile,chartFixture:[],browserOverrides:{RiffCommunityCharts:{identify:require('../dist/community-charts.js').identify,lookup:async()=>empty()},RiffAdditionalDrumSources:{fill:(found,options)=>n.api.fill(found,{...options,fetcher:n.fetcher})}}});
 await app.nodes.addSongButton.click();app.nodes.addLookupTitle.value=row.title;app.nodes.addLookupArtist.value=row.artist;app.nodes.addSongPart.value='drums';await app.nodes.addLookupArtist.emit('input');await app.nodes.confirmAddSong.click();
 assert.equal(app.savedSongs.size,1,app.nodes.addSongError.textContent);const saved=[...app.savedSongs.values()][0];assert.equal(saved.chartOnly,true);assert.equal(saved.audioBlob,null);assert.equal(saved.charts.drums.expert.length,5);assert.equal(saved.quality.onlineLookup.additionalDrumCheck.status,'imported');assert.match(app.nodes.chartStatus.textContent,/Chart only/);assert.equal(app.nodes.playButton.disabled,true);assert.deepEqual(app.requests,[]);
 const restored=await L.unpack(L.pack(saved));assert.equal(restored.quality.communityReferences.drums.sha256,row.sha256);assert.equal(restored.charts.drums.expert.length,5);
});
const actualCatalog=require('../dist/drum-source-catalog.js'),actualRoot=process.env.RIFFBOUND_DRUM_SOURCE_ROOT;
test('additional catalog contains reviewed, bounded sources with exact title/artist identities and source attribution',()=>{
 assert.equal(actualCatalog.rows.length,50);assert.match(actualCatalog.revision,/^[a-f0-9]{40}$/);const seen=new Set();
 for(const r of actualCatalog.rows){assert.ok(r.title&&r.artist&&r.author&&r.provider);assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.ok(r.bytes>0&&r.bytes<=X.MAX_BYTES);assert.ok(r.duration>=5&&r.duration<=900);assert.ok(r.counts.expert>0);assert.match(r.source,/^https:\/\/github\.com\/mtolly\/onyx\/tree\//);const key=r.artist+'\0'+r.title+'\0'+r.path;assert.ok(!seen.has(key));seen.add(key);}
 assert.ok(actualCatalog.rows.some(r=>r.provider==='Grinnz / Onyxite'));assert.ok(actualCatalog.rows.some(r=>r.artist==='Dream Theater'&&r.title==='Constant Motion'));
});
test('all actual catalog MIDIs retain their reviewed Drum counts and fit their original tempo duration',{skip:!actualRoot},()=>{
 for(const row of actualCatalog.rows){const bytes=fs.readFileSync(require('node:path').join(actualRoot,row.path));assert.equal(bytes.length,row.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);
  const p=M.parse(bytes,{part:'drums',outputDrumLayout:'four',legacyRunningStatus:true,metadata:{name:row.title,artist:row.artist}}),counts=Object.fromEntries(Object.entries(p.charts.drums).map(([level,notes])=>[level,notes.length]));assert.deepEqual(counts,row.counts,row.title);
  const arranged=X.arrange(p,row.duration);assert.ok(arranged.charts.drums.expert.length);for(const level of ['easy','medium','hard','expert'])assert.ok(arranged.charts.drums[level].every(n=>n.duration===0&&n.pitch===undefined&&[0,1,2,3,5].includes(n.lane)),row.title+' '+level);
 }
});
