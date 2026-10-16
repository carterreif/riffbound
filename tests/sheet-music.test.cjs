const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const S=require('../dist/sheet-music.js'),L=require('../dist/song-library.js'),{fixture,note}=require('./helpers/score-fixture.cjs');
const identity={title:'Fixture Song',artist:'Fixture Artist'},parts=['guitar','drums','bass','vocals'];
const file=text=>Object.assign(new Blob([text],{type:'application/vnd.recordare.musicxml+xml'}),{name:'Fixture.musicxml'});
function network({score=fixture(),blocked=false,mismatch=false}={}){const requests=[];return {requests,fetcher:async url=>{requests.push(url);if(blocked)return new Response('',{status:403});if(url.includes('advancedsearch'))return Response.json({response:{docs:[{identifier:'fixture-score',title:mismatch?'Other Song':identity.title,creator:identity.artist}]}});if(url.includes('/metadata/'))return Response.json({metadata:{},files:[{name:'score.musicxml',size:score.length}]});return new Response(score);}};}
function app(options={}){const path=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(path,'utf8').split('\ntest(')[0];return new Function('require',prefix+'\nreturn {setup,until};')(createRequire(path)).setup(options);}
const until=async check=>{for(let i=0;i<300;i++){if(check())return;await new Promise(r=>setImmediate(r));}assert.fail('UI did not settle');};

test('actual score parts generate independent colors and four arrangements; percussion uses one-based MIDI instruments',()=>{
 const score=S.parse(fixture());assert.deepEqual(Object.keys(score.charts).sort(),parts.slice().sort());assert.equal(score.duration,16);assert.equal(score.charts.bass.expert[0].pitch,36);assert.equal(score.charts.guitar.expert[0].pitch,60);
 assert.deepEqual([...new Set(score.charts.drums.expert.map(n=>n.lane))].sort(),[0,1,2,3,4,5]);for(const p of parts){assert.deepEqual(Object.keys(score.charts[p]),['easy','medium','hard','expert']);assert.ok(score.charts[p].easy.length<=score.charts[p].expert.length);}assert.ok(score.charts.drums.expert.every(n=>n.duration===0&&!('pitch' in n)));
});
test('rests, chords, voice backups, tempo changes and ties retain score timing',()=>{
 let text=fixture({parts:['guitar'],measures:4});text=text.replace(note('C')+note('D')+note('E')+note('G'),note('C',4,4,'<tie type="start"/>'));text=text.replace('<measure number="2">'+note('C'),'<measure number="2">'+note('C',4,1,'<tie type="stop"/>'));
 text=text.replace('<measure number="3">','<measure number="3"><direction><sound tempo="60"/></direction>');const s=S.parse(text);assert.equal(s.charts.guitar.expert[0].duration,2.5);assert.equal(s.duration,12);assert.equal(s.charts.guitar.expert.filter(n=>n.time===2).length,0);
 const voices=fixture({parts:['guitar'],body:{guitar:note('C')+note('E',4,1,'<chord/>')+'<note><rest/><duration>3</duration></note><backup><duration>4</duration></backup>'+note('G',3,4)}});assert.equal(S.parse(voices).charts.guitar.expert.filter(n=>n.time===0).length,3);
});
test('unsupported parts never donate notes to another instrument, and ambiguous percussion is rejected by part',()=>{
 const s=S.parse(fixture({parts:['guitar','piano']}));assert.deepEqual(Object.keys(s.charts),['guitar']);let bad=fixture().replaceAll('<midi-unpitched>43</midi-unpitched>','').replaceAll('<instrument-name>Hi-Hat</instrument-name>','<instrument-name>Mystery</instrument-name>');const out=S.parse(bad);assert.ok(!out.charts.drums);assert.ok(out.charts.guitar);assert.match(out.issues.drums,/assignments/);
});
test('scores with missing tempo, jumps, repeats or XML entities give specific recovery instead of wrong notes',()=>{
 assert.throws(()=>S.parse(fixture().replaceAll(' tempo="120"','')),/starting tempo/);assert.throws(()=>S.parse('<!DOCTYPE score-partwise [<!ENTITY x "abc">]>'+fixture()),/entity/);assert.throws(()=>S.parse('<score-partwise><part-list></score-partwise>'),/closing/);
 const out=S.parse(fixture().replace('<part id="guitar">','<part id="guitar">').replace('<measure number="2">','<measure number="2"><barline><repeat direction="backward"/></barline>'));assert.ok(!out.charts.guitar);assert.ok(out.charts.bass);assert.match(out.issues.guitar,/unfolded/);
});
test('automatic search reads an exact matching catalog item and actual MusicXML bytes; wrong titles, blocked sources and arrangement mismatch fail cleanly',async()=>{
 const n=network(),s=await S.lookup({...identity,parts,fetcher:n.fetcher});assert.equal(n.requests.length,3);assert.equal(Object.keys(s.charts).length,4);assert.match(s.source.url,/archive.org\/download/);assert.match(new URL(n.requests[0]).searchParams.get('q'),/Fixture Song/);
 for(const config of [{blocked:true},{mismatch:true}]){const n=network(config),out=await S.lookup({...identity,parts,fetcher:n.fetcher});assert.deepEqual(out.charts,{});assert.ok(out.message);}
 const n2=network();const wrong=await S.lookup({...identity,parts,duration:60,fetcher:n2.fetcher});assert.deepEqual(wrong.charts,{});assert.match(wrong.message,/different duration/);
});
test('game charts stay first, only missing requested score parts are filled, and cancellation/opt-out makes no requests',async()=>{
 const chart={expert:[{lane:4,time:2,duration:0}]},found={charts:{guitar:chart},imports:{},references:{},duration:16,identity},n=network();const result=await S.fill(found,{...identity,parts,fetcher:n.fetcher});assert.equal(result.charts.guitar,chart);assert.deepEqual(result.scoreParts.sort(),['bass','drums','vocals']);assert.equal(result.sheetMusic.timingVerified,false);assert.equal(result.drumLayout,'five');
 await S.lookup({...identity,enabled:false,fetcher:()=>assert.fail('Opt out')});const c=new AbortController();c.abort();await assert.rejects(S.lookup({...identity,signal:c.signal}),/Canceled/);
 const full=await S.fill({charts:Object.fromEntries(parts.map(p=>[p,chart]))},{parts,fetcher:()=>assert.fail('No missing parts')});assert.equal(full.charts.guitar,chart);
});
test('score upload converts without network, refuses PDF/MXL, and notes/provenance survive backups',async()=>{
 const s=await S.fill({charts:{}},{parts,scoreFile:file(fixture()),fetcher:()=>assert.fail('Uploaded score stays local')});const q={sheetMusic:s.sheetMusic,drumLayout:'five'},song={id:'1'.repeat(64),title:s.identity.title,chartOnly:true,instrument:'drums',musicEnd:s.duration,bpm:s.bpm,beat:s.beat,charts:s.charts,quality:q};const out=await L.unpack(L.pack(song));assert.deepEqual(out.charts.drums,s.charts.drums);assert.equal(out.quality.sheetMusic.source.name,'Fixture.musicxml');
 await assert.rejects(S.lookup({scoreFile:Object.assign(new Blob(['pdf']),{name:'score.pdf'})}),/uncompressed/);
});
test('Add a song searches sheet music after missing game charts, saves all score instruments without audio and reopens them',async()=>{
 const calls=[],n=network(),a=app({chartFixture:[],browserOverrides:{RiffSheetMusic:{fill:(found,options)=>{calls.push(options.parts);return S.fill(found,{...options,fetcher:n.fetcher});}},RiffCommunityCharts:{lookup:async()=>({charts:{},imports:{},references:{},message:'No game charts.'})}}}),v=a.nodes;
 await v.addSongButton.click();v.addLookupTitle.value=identity.title;v.addLookupArtist.value=identity.artist;v.addSongPart.value='whole';await v.confirmAddSong.click();await until(()=>a.savedSongs.size===1);const saved=[...a.savedSongs.values()][0];assert.equal(saved.chartOnly,true);assert.deepEqual(Object.keys(saved.charts).sort(),parts.slice().sort());assert.match(v.chartStatus.textContent,/Converted sheet music/);assert.equal(a.requests.length,0);assert.deepEqual(Array.from(calls[0]),parts);assert.equal(v.playButton.disabled,true);assert.equal(v.addSongDialog.open,false);
 const fresh=app({chartFixture:[],savedSongs:a.savedSongs});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.deepEqual(Object.keys([...fresh.savedSongs.values()][0].charts).sort(),parts.slice().sort());
});
test('an uploaded MusicXML score alone works in Add a song; an audio upload uses it before estimates and marks timing unverified',async()=>{
 const make=()=>app({chartFixture:[{lane:0,time:1,duration:0}],browserOverrides:{RiffSheetMusic:S,RiffCommunityCharts:{lookup:async()=>({charts:{},imports:{},references:{},message:'No game chart.'})}}});
 const a=make(),n=a.nodes;await n.addSongButton.click();n.addScoreFile.files=[file(fixture())];n.addSongPart.value='whole';await n.addScoreFile.emit('change');assert.equal(n.confirmAddSong.disabled,false);await n.confirmAddSong.click();await until(()=>a.savedSongs.size===1);assert.equal([...a.savedSongs.values()][0].title,'Fixture Song');
 const b=make(),v=b.nodes;await v.addSongButton.click();v.addSongFile.files=[Object.assign(new Blob([new Uint8Array([1,2,3])]),{name:'Fixture Artist - Fixture Song.wav'})];v.addScoreFile.files=[file(fixture())];v.addSongPart.value='whole';await v.confirmAddSong.click();await until(()=>b.savedSongs.size===1&&!v.saveCurrentButton.disabled);const saved=[...b.savedSongs.values()][0];assert.equal(b.requests.length,0);assert.equal(saved.quality.audioReviews.drums.timingVerified,false);assert.equal(saved.quality.audioReviews.drums.policy,'sheet-music-timing-review-v1');assert.equal(saved.quality.drumLayout,'five');
});

test('tempo in an accompaniment part applies to vocals without using accompaniment notes as another instrument',()=>{
 let text=fixture({parts:['piano','vocals']});let count=0;text=text.replaceAll('<sound tempo="120"/>',s=>++count===1?s:'');const out=S.parse(text);assert.deepEqual(Object.keys(out.charts),['vocals']);assert.equal(out.duration,16);
});
test('only missing parts run audio analysis after a partial score and a source cannot claim a different score identity',async()=>{
 const a=app({chartFixture:[{lane:0,time:1,duration:0}],browserOverrides:{RiffSheetMusic:S,RiffCommunityCharts:{lookup:async()=>({charts:{},imports:{},references:{},message:'No game chart.'})}}}),v=a.nodes;await v.addSongButton.click();v.addSongFile.files=[Object.assign(new Blob([new Uint8Array([3,4])]),{name:'Fixture.wav'})];v.addScoreFile.files=[file(fixture({parts:['drums']}))];v.addSongPart.value='whole';await v.confirmAddSong.click();await until(()=>a.savedSongs.size===1&&!v.saveCurrentButton.disabled);assert.deepEqual(a.requests,['guitar','bass','vocals']);const saved=[...a.savedSongs.values()][0];assert.equal(saved.quality.methods.drums,'Sheet music converted to colored lanes');assert.ok(!saved.quality.imports.guitar);
 const net=network({score:fixture({title:'Different Song'})}),wrong=await S.lookup({...identity,fetcher:net.fetcher});assert.deepEqual(wrong.charts,{});assert.match(wrong.message,/does not match/);
});
test('in-flight cancellation propagates, and oversized streamed responses cannot become imported notes',async()=>{
 const c=new AbortController();const task=S.lookup({...identity,signal:c.signal,fetcher:async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});c.abort();await assert.rejects(task,/Canceled/);
 const s=await S.lookup({...identity,fetcher:async()=>new Response('x'.repeat(300000))});assert.deepEqual(s.charts,{});assert.match(s.message,/too large/);
});

test('a bass drum stays percussion and a choir bass voice stays vocals',()=>{
 const drums=S.parse(fixture({parts:['drums']}).replaceAll('<instrument-name>kick</instrument-name>','<instrument-name>Bass Drum</instrument-name>'));assert.deepEqual(Object.keys(drums.charts),['drums']);assert.ok(drums.charts.drums.expert.some(n=>n.lane===5));
 const voice=S.parse(fixture({parts:['vocals']}).replace('<part-name>vocals</part-name>','<part-name>Bass</part-name>'));assert.deepEqual(Object.keys(voice.charts),['vocals']);
});

test('sheet search can be disabled in Add a song and its preference survives reopening',async()=>{
 const a=app({chartFixture:[],browserOverrides:{RiffSheetMusic:{fill:(found,options)=>{assert.equal(options.enabled,false);return S.fill(found,{...options,fetcher:()=>assert.fail('Search disabled')});}},RiffCommunityCharts:{lookup:async()=>({charts:{},message:'No game chart.'})}}}),v=a.nodes;
 v.addSheetMusicLookup.checked=false;await v.addSheetMusicLookup.emit('change');const saved=JSON.parse(a.writes.filter(([key])=>key==='riffbound-preferences-v1').at(-1)[1]);assert.equal(saved.sheetMusicLookup,false);const fresh=app({preferences:saved,chartFixture:[]});assert.equal(fresh.nodes.addSheetMusicLookup.checked,false);
 await v.addSongButton.click();v.addLookupTitle.value=identity.title;v.addLookupArtist.value=identity.artist;await v.confirmAddSong.click();assert.equal(a.savedSongs.size,0);assert.match(v.addSongError.textContent,/No game chart/);
});
