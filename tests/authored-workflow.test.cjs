const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module'),C=require('../dist/community-charts.js'),A=require('../dist/recording-alignment.js'),L=require('../dist/song-library.js'),F=require('./helpers/community-fixture.cjs'),{container}=require('./helpers/reference-container.cjs');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const PARTS=['guitar','drums','bass','vocals'];let seed=13;
const plain=value=>JSON.parse(JSON.stringify(value));
const samples=Float32Array.from({length:22050*40},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.3;}),padded=new Float32Array(22050*43);padded.set(samples,22050*3);
const referenceBytes=Buffer.concat([Buffer.from([99,82,69,70]),Buffer.from(padded.buffer)]);
const sourceMidi=F.midi([
 {name:'PART GUITAR',notes:[{tick:3840,code:96,length:480},{tick:3840,code:100,length:240},{tick:4800,code:64},{tick:5280,code:76},{tick:5760,code:88}]},
 {name:'PART BASS',notes:[{tick:3900,code:98,length:240},{tick:4800,code:60},{tick:5280,code:73},{tick:5760,code:86}]},
 {name:'PART DRUMS',notes:[{tick:4000,code:97},{tick:4120,code:98},{tick:4240,code:99},{tick:4360,code:100},{tick:4480,code:101},{tick:4600,code:96},{tick:4900,code:61},{tick:5400,code:74},{tick:6000,code:87}]},
 {name:'PART VOCALS',notes:[{tick:4200,code:60,length:480},{tick:5000,code:72,length:480}]}
]);
const referenceDecoder=bytes=>{if(bytes[0]!==99)return null;const data=new Float32Array(bytes.buffer.slice(bytes.byteOffset+4,bytes.byteOffset+bytes.byteLength));return {duration:data.length/22050,sampleRate:22050,numberOfChannels:1,length:data.length,getChannelData:()=>data};};
function create(mobile,parts,savedSongs,recording=A){
 const files=Object.fromEntries(parts.map(p=>[p+'.opus',referenceBytes]));files['notes.mid']=sourceMidi;
 const net=F.network({rows:[{...F.row,song_length:43000}],container:container(files)}),browserOverrides={RiffRecordingAlignment:recording,RiffCommunityCharts:{...C,lookup:q=>C.lookup({...q,fetcher:net.fetcher})}};
 const app=setup({mobile,chartFixture:[],audioSamples:samples,referenceDecoder,savedSongs,browserOverrides});return {app,net,browserOverrides};
}
for(const mobile of [false,true])for(const part of PARTS)test(`${mobile?'mobile':'desktop'} future separate ${part} upload keeps its own waveform-aligned authored notes, source and difficulties through backup/reopen/reupload`,async()=>{
 const {app,net,browserOverrides}=create(mobile,[part]),n=app.nodes;await app.radios.chartTarget.find(r=>r.value===part).emit('change');await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(Object.keys(saved.charts),[part]);assert.equal(saved.instrument,part);assert.deepEqual(app.requests,[]);assert.equal(saved.quality.audioReviews[part].policy,'authored-recording-alignment-v1');assert.equal(saved.quality.audioReviews[part].timingVerified,true);assert.ok(Math.abs(saved.quality.chartTimings[part].offset+3)<.002);assert.match(n.songTimingStatus.textContent,/3000 ms earlier/);assert.match(n.chartDetails.textContent,/timing verified/);
 for(const level of ['easy','medium','hard','expert']){await app.radios.difficulty.find(r=>r.value===level).emit('change');assert.match(n.chartSummary.textContent,new RegExp(level==='easy'?'Easy':level==='medium'?'Medium':level==='hard'?'Hard':'Expert'));}
 const backup=await L.unpack(L.pack(saved));assert.deepEqual(plain(backup.charts),plain(saved.charts));assert.equal(backup.quality.audioReviews[part].timingVerified,true);assert.equal(await backup.audioBlob.text(),await saved.audioBlob.text());
 const original=plain(saved.charts),networkCount=net.requests.length,fresh=setup({mobile,savedSongs:app.savedSongs,audioSamples:samples,referenceDecoder,chartFixture:[],browserOverrides});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.deepEqual(plain([...fresh.savedSongs.values()][0].charts),original);assert.equal(net.requests.length,networkCount);assert.deepEqual(fresh.requests,[]);
 await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>!n.saveCurrentButton.disabled);assert.equal(net.requests.length,networkCount);assert.equal(app.savedSongs.size,1);assert.deepEqual(plain([...app.savedSongs.values()][0].charts),original);assert.equal([...app.savedSongs.values()][0].quality.audioReviews[part].sourceOffsetSeconds,saved.quality.audioReviews[part].sourceOffsetSeconds);
});
test('cancel during a future recording comparison cannot replace saved notes, identity or audio',async()=>{
 let comparisons=0,started=false;
 const recording={...A,review:async(target,reference,options)=>{if(++comparisons===1)return A.review(target,reference,options);started=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Canceled')),{once:true}));}};
 const {app}=create(false,['drums'],undefined,recording),n=app.nodes;await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>!n.saveCurrentButton.disabled);
 const old=[...app.savedSongs.values()][0],charts=plain(old.charts),audio=await old.audioBlob.text();
 const pending=app.upload('Fixture Artist - Fixture Song.wav',2);await until(()=>started);await n.cancelUpload.click();await pending;assert.equal(app.savedSongs.size,1);assert.equal([...app.savedSongs.values()][0].id,old.id);assert.deepEqual(plain([...app.savedSongs.values()][0].charts),charts);assert.equal(await [...app.savedSongs.values()][0].audioBlob.text(),audio);assert.match(n.chartSummary.textContent,/Drums/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} whole upload plays each own authored part without recharting and single-part repair preserves neighboring notes/audio`,async()=>{
 const {app,net}=create(mobile,PARTS),n=app.nodes;n.chartScope.value='whole';await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>!n.saveCurrentButton.disabled);
 const old=[...app.savedSongs.values()][0],original=JSON.stringify(old.charts),audio=await old.audioBlob.text();assert.deepEqual(Object.keys(old.charts),PARTS);assert.deepEqual(app.requests,[]);assert.equal(app.decodes,5,'One user recording plus four independent instrument reference decodes');
 for(const p of PARTS){await n['playPart'+p[0].toUpperCase()+p.slice(1)].click();await until(()=>!n.saveCurrentButton.disabled);assert.equal([...app.savedSongs.values()][0].instrument,p);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),original);assert.match(n.chartDetails.textContent,/timing verified/);}
 await n.playPartDrums.click();await until(()=>!n.saveCurrentButton.disabled);n.songChartShift.value='50';await n.applySongChartShift.click();const shifted=[...app.savedSongs.values()][0];assert.equal(shifted.quality.chartAdjustments.drums,50);
 const neighbors=Object.fromEntries(['guitar','bass','vocals'].map(p=>[p,JSON.stringify(shifted.charts[p])]));await n.findAuthoredChart.click();await until(()=>!n.saveCurrentButton.disabled);const repaired=[...app.savedSongs.values()][0];assert.equal(repaired.quality.chartAdjustments.drums,undefined);assert.equal(await repaired.audioBlob.text(),audio);
 for(const p of ['guitar','bass','vocals'])assert.equal(JSON.stringify(repaired.charts[p]),neighbors[p]);assert.equal(repaired.quality.audioReviews.drums.timingVerified,true);assert.deepEqual(app.requests,[]);assert.ok(net.requests.length>6);
});
