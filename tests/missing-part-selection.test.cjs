const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const D=require('../dist/chart-difficulties.js'),C=require('../dist/community-charts.js'),L=require('../dist/song-library.js');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const plain=value=>JSON.parse(JSON.stringify(value));
const guitar=D.build([{lane:0,time:1,duration:.6,pitch:52},{lane:4,time:3,duration:0,pitch:69}],'guitar',.5),drums=D.build([{lane:5,time:2,duration:0},{lane:0,time:2,duration:0},{lane:1,time:3,duration:0}],'drums',.5);
const fixture=part=>part==='drums'?drums:guitar;
for(const mobile of [false,true])for(const event of ['change','click'])test(`${mobile?'mobile':'desktop'} saved 01 Track 1 with only Guitar builds missing Drums from the left tab (${event})`,async()=>{
 const original=setup({mobile,chartFixture:fixture});await original.upload('01 Track 1.mp3');await until(()=>!original.nodes.saveCurrentButton.disabled);const before=[...original.savedSongs.values()][0],guitarBefore=plain(before.charts.guitar),audio=before.audioBlob;
 const app=setup({mobile,chartFixture:fixture,savedSongs:original.savedSongs}),n=app.nodes;await until(()=>n.setlistEntries.children.length===2);await n.setlistEntries.children[1].click();assert.equal(n.trackTitle.textContent,'01 Track 1');assert.deepEqual(Object.keys(before.charts),['guitar']);
 const tab=app.radios.chartTarget.find(r=>r.value==='drums');if(event==='click')tab.checked=true;
 await tab.emit(event);await until(()=>!n.saveCurrentButton.disabled);
 assert.deepEqual(app.requests,['drums']);assert.equal(app.body.classList.contains('is-drums'),true);assert.equal(app.radios.instrument.find(r=>r.value==='drums').checked,true);assert.equal(n.kickButton.hidden,false);assert.match(n.chartSummary.textContent,/Drums/);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(plain(saved.charts.guitar),guitarBefore);assert.deepEqual(plain(saved.charts.drums),drums);assert.equal(saved.audioBlob,audio);assert.equal(saved.id,before.id);assert.equal(saved.title,'01 Track 1');
 const restored=await L.unpack(L.pack(saved));assert.deepEqual(restored.charts.drums,drums);assert.deepEqual(restored.charts.guitar,guitarBefore);
 await app.radios.chartTarget.find(r=>r.value==='guitar').emit('change');await tab.emit('change');assert.deepEqual(app.requests,['drums'],'Re-selecting cached parts must not analyze again');
});
test('missing drum selection checks the authored Drum track first and preserves the saved Guitar source',async()=>{
 const calls=[],app=setup({chartFixture:fixture,browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async q=>{calls.push(q);return q.parts.includes('drums')?{charts:{drums},imports:{drums:{filename:'notes.chart',levels:D.LEVELS,derived:[]}},sources:{drums:'Own authored Drums'},bpm:120,beat:.5,message:'Authored drums loaded.'}:{charts:{}};}}}}),n=app.nodes;
 await app.upload('01 Track 1.mp3');await until(()=>!n.saveCurrentButton.disabled);const before=plain([...app.savedSongs.values()][0].charts.guitar),jobs=app.requests.length;n.lookupTitle.value='Known Song';n.lookupArtist.value='Known Artist';
 await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(plain(calls.at(-1).parts),['drums']);assert.equal(calls.at(-1).enabled,true);assert.equal(calls.at(-1).title,'Known Song');assert.equal(calls.at(-1).artist,'Known Artist');assert.equal(app.requests.length,jobs);assert.ok(saved.quality.imports.drums);assert.deepEqual(plain(saved.charts.guitar),before);assert.deepEqual(plain(saved.charts.drums),drums);
});
test('a failed missing drum build is visible and can be retried by clicking the already selected Drums tab',async()=>{
 let fail=true;const app=setup({chartFixture:[],workerResult:part=>fail&&part==='drums'?{instrument:'guitar',charts:{guitar},bpm:120,beat:.5}:{instrument:part,charts:{[part]:fixture(part)},bpm:120,beat:.5}}),n=app.nodes;
 await app.upload('01 Track 1.mp3');await until(()=>!n.saveCurrentButton.disabled);const before=plain([...app.savedSongs.values()][0].charts),tab=app.radios.chartTarget.find(r=>r.value==='drums');
 await tab.emit('change');assert.match(n.statusMessage.textContent,/Could not build Drums/);assert.match(n.chartStatus.textContent,/different instrument/);assert.equal(app.body.classList.contains('is-drums'),false);assert.deepEqual(plain([...app.savedSongs.values()][0].charts),before);
 fail=false;assert.equal(tab.checked,true);await tab.click();await until(()=>!n.saveCurrentButton.disabled);assert.equal(app.body.classList.contains('is-drums'),true);assert.deepEqual(app.requests,['guitar','drums','drums']);
});
test('canceling a missing-part selection keeps the saved Guitar chart and audio',async()=>{
 let finish;
 const community={identify:C.identify,lookup:async q=>q.parts.includes('drums')?await new Promise(resolve=>{finish=resolve;}):{charts:{}}};
 const app=setup({chartFixture:fixture,browserOverrides:{RiffCommunityCharts:community}}),n=app.nodes;
 await app.upload('01 Track 1.mp3');await until(()=>!n.saveCurrentButton.disabled);const saved=[...app.savedSongs.values()][0],before=plain(saved.charts),audio=saved.audioBlob;
 const job=app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await until(()=>finish);assert.match(n.announceBig.textContent,/CHARTING DRUMS/);await n.cancelUpload.click();finish({charts:{drums},bpm:120,beat:.5});await job;
 assert.equal(app.body.classList.contains('is-drums'),false);assert.deepEqual(plain([...app.savedSongs.values()][0].charts),before);assert.equal([...app.savedSongs.values()][0].audioBlob,audio);
});
