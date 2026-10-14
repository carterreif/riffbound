const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const M=require('../dist/midi-chart.js'),X=require('../dist/chart-exchange.js'),E=require('../dist/engine.js'),D=require('../dist/chart-difficulties.js'),L=require('../dist/song-library.js'),T=require('../dist/chart-timing.js'),P=require('../dist/playback-tools.js'),C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs'),B=require('./helpers/bundled-audio.cjs'),{container}=require('./helpers/reference-container.cjs');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const plain=value=>JSON.parse(JSON.stringify(value));
const metadata={name:'Creeping Death',artist:'Metallica',icon:'ghm',five_lane_drums:'True'},row={...F.row,name:metadata.name,artist:metadata.artist,icon:'ghm'};
const midi=F.midi([{name:'TEMPO',events:[{tick:0,data:F.meta(81,[7,161,32])},{tick:1920,data:F.meta(81,[15,66,64])}]},{name:'PART DRUMS',notes:[...['easy','medium','hard','expert'].flatMap((_,i)=>{const base=60+12*i;return [{tick:960,code:base},{tick:960,code:base+2,length:1920},{tick:960,code:base+4,length:1920},{tick:1440,code:base+1}];}),{tick:960,code:127,length:1920}]},{name:'PART GUITAR',notes:[{tick:960,code:96,length:1920}]}]);
const parsed=()=>M.parse(midi,{part:'drums',metadata});
function song(){const p=parsed();return {id:'a'.repeat(64),title:metadata.name,instrument:'drums',musicEnd:16,bpm:p.bpm,beat:p.beat,charts:X.arrange(p,16).charts,audioBlob:new Blob(['audio'])};}

test('five-lane MIDI sustains and roll modifiers retain all authored hits, levels, colors and tempo boundaries',()=>{
 const p=parsed();assert.equal(p.drumLayout,'five');for(const level of D.LEVELS){const n=p.charts.drums[level];assert.equal(n.length,4);assert.deepEqual(n.map(n=>[n.lane,n.time,n.duration]),[[1,1,0],[3,1,0],[5,1,0],[0,1.5,0]]);assert.deepEqual(n.filter(n=>n.rollDuration).map(n=>[n.lane,n.rollDuration]),[[1,3],[3,3]]);}
 assert.equal(M.parse(midi,{part:'guitar'}).charts.guitar.expert[0].duration,3);
 const out=X.arrange(p,16);assert.deepEqual(out.derived.drums,[]);assert.throws(()=>X.arrange({...p,charts:{drums:{expert:[{...p.charts.drums.expert[0],rollDuration:7}]}}},5),/extends beyond/);
});
test('roll markers without playable heads cannot create extra strikes, and Pro sustains remain unsupported',()=>{
 const markerOnly=F.midi([{name:'PART DRUMS',notes:[{tick:960,code:126,length:1920}]}]);assert.throws(()=>M.parse(markerOnly,{part:'drums',metadata}),/No supported/);
 assert.throws(()=>M.parse(F.midi([{name:'PART DRUMS',notes:[{tick:960,code:98,length:480}]}]),{part:'drums',drumLayout:'pro'}),/five-lane drum chart/);
});
test('Pro roll modifiers preserve individually charted heads and never turn kicks into hand rolls',()=>{
 const p=M.parse(F.midi([{name:'PART DRUMS',notes:[{tick:960,code:126,length:1440},{tick:960,code:98},{tick:1200,code:96},{tick:1440,code:98},{tick:1920,code:98}]}]),{part:'drums',drumLayout:'pro'});
 assert.equal(p.charts.drums.expert.length,4);assert.deepEqual(p.charts.drums.expert.map(n=>[n.lane,n.rollDuration||0]),[[1,1.5],[5,0],[1,1],[1,.5]]);
});
test('drum roll extra taps retain the streak without extra scored notes or held-fret credit',()=>{
 const session=new E.Session('expert','strum','drums',{notes:parsed().charts.drums.expert,musicEnd:16}),judgments=[];session.onJudge=(kind,lane)=>judgments.push([kind,lane]);
 session.tap(1,1);session.tap(3,1);session.tap(5,1);session.tap(0,1.5);const state=[session.score,session.hits,session.streak,session.energy];
 assert.equal(session.tap(1,2),true);assert.equal(session.tap(3,2.25),true);assert.equal(session.tap(4,2.5),true,'Shared green can repeat the orange roll');session.update(3,new Set([1,3]));assert.deepEqual([session.score,session.hits,session.streak,session.energy],state);assert.ok(session.notes.every(n=>n.duration===0&&n.held===false));assert.deepEqual(judgments.slice(-3),[['ROLL',1],['ROLL',3],['ROLL',3]]);
 assert.equal(session.tap(2,3),false);assert.equal(session.tap(1,4),false);assert.equal(session.tap(5,2),false);assert.equal(session.streak,0);
});
test('single-lane markers resolve their chord from the next hand note and scope Hard by marker velocity',()=>{
 for(const velocity of [41,50,100]){
  const p=M.parse(F.midi([{name:'PART DRUMS',notes:[{tick:480,code:126,length:1440,velocity},{tick:480,code:97},{tick:480,code:98},{tick:960,code:98},{tick:480,code:86},{tick:960,code:86}]}]),{part:'drums',drumLayout:'pro'});
  assert.equal(p.charts.drums.expert.find(n=>n.lane===0).rollDuration,undefined);assert.equal(p.charts.drums.expert.find(n=>n.lane===1).rollDuration,1.5);assert.equal(p.charts.drums.hard[0].rollDuration,velocity===100?undefined:1.5);
 }
});
test('explicit five-lane kick rolls permit repeated kicks without held-note scoring',()=>{
 const p=M.parse(F.midi([{name:'PART DRUMS',notes:[{tick:960,code:96,length:1920}]}]),{part:'drums',drumLayout:'five'}),s=new E.Session('expert','tap','drums',{notes:p.charts.drums.expert,musicEnd:5});assert.equal(s.notes[0].rollDuration,2);assert.equal(s.notes[0].duration,0);s.tap(5,1);const score=s.score;assert.equal(s.tap(5,2),true);s.update(2.5,new Set([5]));assert.equal(s.score,score);assert.equal(s.hits,1);assert.equal(s.tap(5,3),false);
});
test('roll leniency requires its head hit; adjacent real notes still score once, while Guitar cannot use rolls',()=>{
 const session=new E.Session('expert','tap','drums',{notes:[{lane:1,time:1,duration:0,rollDuration:2},{lane:1,time:2,duration:0}],musicEnd:5});assert.equal(session.tap(1,1.5),false);session.tap(1,1);session.tap(1,2);assert.equal(session.hits,2);const score=session.score;session.tap(1,2.25);assert.equal(session.score,score);assert.equal(session.hits,2);
 const guitar=new E.Session('expert','tap','guitar',{notes:[{lane:1,time:1,duration:0,rollDuration:2}],musicEnd:5});guitar.tap(1,1);assert.equal(guitar.tap(1,2),false);
});
test('roll windows survive portable backups and chart export, and retain bounds under timing and practice',async()=>{
 const s=song(),restored=await L.unpack(L.pack(s));assert.deepEqual(restored.charts,s.charts);const text=X.exportChart(s),again=X.parse(text,{drumLayout:'five'});for(const level of D.LEVELS)assert.deepEqual(again.charts.drums[level],s.charts.drums[level]);
 const shifted=T.shift(s.charts.drums,250,16);assert.equal(shifted.expert[0].rollDuration,3);assert.equal(shifted.expert[0].time,1.25);assert.throws(()=>T.shift(s.charts.drums,250,4),/outside the audio/);
 const segment=P.segment(s.charts.drums.expert,{start:0,end:2});assert.equal(segment[0].rollDuration,1);
 for(const bad of [0,-1,NaN,Infinity,20]){const invalid=structuredClone({...s,audioBlob:null});invalid.charts.drums.expert[0].rollDuration=bad;assert.throws(()=>L.validate(invalid),/invalid drum roll/);}
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} song-name discovery with rolls gets chart and audio, scores taps and reopens without analysis`,async()=>{
 const files={'notes.mid':midi,'song.opus':Buffer.from([1,7,8]),'guitar.opus':Buffer.from([2,7,8]),'drums_1.opus':Buffer.from([3,7,8])},net=F.network({rows:[row],container:container(files,metadata)});
 const storage=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),app=setup({mobile,chartFixture:[],libraryOverrides:storage.library,referenceDecoder:bytes=>bytes[0]===82?B.wave(bytes):B.decoded(bytes[0]),browserOverrides:{RiffCommunityCharts:{...C,lookup:q=>C.lookup({...q,fetcher:net.fetcher}),songAudio:(c,o)=>C.songAudio(c,{...o,fetcher:net.fetcher})}}}),n=app.nodes;
 await n.addSongButton.click();n.addSongFile.files=[];n.addLookupTitle.value=metadata.name;n.addLookupArtist.value=metadata.artist;n.addSongPart.value='drums';await n.addLookupArtist.emit('input');await n.confirmAddSong.click();const rows=await storage.library.list(),saved=await storage.library.get(rows[0].id);
 assert.equal(saved.chartOnly,undefined);assert.equal(saved.musicEnd,16);assert.equal(n.playButton.disabled,false);assert.match(n.chartStatus.textContent,/Matching bundled audio loaded/);assert.match(n.chartMapping.textContent,/Roll ribbons/);assert.deepEqual(app.requests,[]);assert.deepEqual(plain(saved.charts.drums),plain(song().charts.drums));assert.deepEqual(plain(saved.quality.packageAudio.files),Object.keys(files).filter(f=>f!=='notes.mid'));const restored=await L.unpack(L.pack(saved));assert.deepEqual(plain(restored.charts),plain(saved.charts));
 await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;app.tick(start+1);for(const key of ['KeyF','KeyK','Space']){await app.key('keydown',key);await app.key('keyup',key);}app.tick(start+1.5);await app.key('keydown','KeyD');await app.key('keyup','KeyD');app.tick(start+1.65);const score=n.score.textContent;app.tick(start+2);await app.key('keydown','KeyF');await app.key('keyup','KeyF');app.tick(start+2.05);assert.equal(n.judgment.textContent,'ROLL');assert.equal(n.score.textContent,score);assert.equal(n.streak.textContent,4);app.tick(start+18);assert.match(n.resultNotes.textContent,/4 of 4 notes hit/);
 const fresh=setup({mobile,chartFixture:[],libraryOverrides:storage.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.playButton.disabled,false);assert.match(fresh.nodes.chartMapping.textContent,/Roll ribbons/);assert.deepEqual(fresh.requests,[]);
});
test('unsupported charts report their actual part failure instead of a generic missing-parts message',async()=>{
 const net=F.network({rows:[row],container:container({'notes.mid':F.midi([{name:'PART DRUMS',notes:[{tick:960,code:97},{tick:960,code:120,length:480}]}])},metadata)}),r=await C.lookup({title:metadata.name,artist:metadata.artist,parts:['drums'],chartOnly:true,includeAudio:true,fetcher:net.fetcher});assert.deepEqual(r.charts,{});assert.match(r.message,/Freestyle endings/);assert.match(r.attempts[0].reason,/Freestyle endings/);
});
