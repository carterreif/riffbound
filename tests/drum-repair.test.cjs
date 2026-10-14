const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const D=require('../dist/chart-difficulties.js'),L=require('../dist/song-library.js'),E=require('../dist/engine.js'),P=require('../dist/part-charts.js'),C=require('../dist/community-charts.js');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const plain=value=>JSON.parse(JSON.stringify(value));
const drumNotes=[{lane:0,time:2,duration:0},{lane:1,time:2,duration:0},{lane:5,time:2,duration:0},{lane:2,time:3,duration:0},{lane:4,time:3.2,duration:0},{lane:3,time:4,duration:0}];
const repaired=D.build(drumNotes,'drums',.5);

test('legacy drum backups discard fret holds and pitch without changing hit colors, times, dynamics or other instruments',async()=>{
 const old=drumNotes.map(n=>({...n,duration:.4,pitch:64,velocity:.3,ghost:true})),levels=Object.fromEntries(['easy','medium','hard','expert','normal'].map(level=>[level,old]));
 const guitar=D.build([{lane:2,time:1,duration:1,pitch:60}],'guitar',.5);
 const song={id:'a'.repeat(64),title:'Legacy drum holds',instrument:'drums',musicEnd:16,bpm:120,beat:.5,charts:{drums:levels,guitar},audioBlob:new Blob([new Uint8Array([1,2,3,4])])},before=plain(song);
 const safe=L.validate(song),restored=await L.unpack(L.pack(song));
 assert.deepEqual(plain(song),before,'Validation must not mutate the original');
 for(const output of [safe,restored]){
  for(const notes of Object.values(output.charts.drums))assert.deepEqual(notes.map(({id,...n})=>n),old.map(({duration,pitch,...n})=>({...n,duration:0})));
  assert.deepEqual(output.charts.guitar,guitar);
 }
 assert.deepEqual(new Uint8Array(await restored.audioBlob.arrayBuffer()),new Uint8Array([1,2,3,4]));
 const upgraded=D.upgrade(levels,'drums',.5);for(const notes of Object.values(upgraded))assert.ok(notes.every(n=>n.duration===0&&!('pitch' in n)));
 const built=D.build(old,'drums',.5);assert.deepEqual(built.expert.map(({id,...n})=>n),old.map(({duration,pitch,...n})=>({...n,duration:0})));
});
test('direct drum gameplay cannot sustain or score guitar holds from a stale chart',()=>{
 const notes=[{lane:0,time:1,duration:2,pitch:64}],session=new E.Session('expert','strum','drums',{notes,musicEnd:5});
 assert.equal(session.mode,'tap');assert.equal(session.notes[0].duration,0);session.tap(0,1);const score=session.score;session.update(2,new Set([0]));assert.equal(session.score,score);assert.equal(session.notes[0].held,false);assert.equal(notes[0].duration,2);
 const guitar=new E.Session('expert','tap','guitar',{notes,musicEnd:5});guitar.tap(0,1);guitar.update(2,new Set([0]));assert.ok(guitar.score>score);
});
test('a mislabeled drum worker cannot sneak guitar pitch or held notes through its drum key',()=>{
 assert.throws(()=>P.isolate({instrument:'drums',charts:{drums:D.build(drumNotes,'drums',.5)}},'guitar'),/different instrument/);
 for(const extra of [{pitch:64},{duration:.4}])assert.throws(()=>P.isolate({instrument:'drums',charts:{drums:{expert:[{...drumNotes[0],...extra}]}}},'drums'),/pitched or sustained/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} repair bypasses stale authored Drums, checks only Drums and preserves neighboring charts and audio`,async()=>{
 let repairing=false;const calls=[],old=D.build([{lane:4,time:1,duration:0}],'drums',.5);
 const app=setup({mobile,chartFixture:part=>part==='drums'?old:D.build([{lane:1,time:1,duration:.5,pitch:60}],part,.5),browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async options=>{calls.push(options);return repairing?{charts:{drums:repaired,guitar:D.build([{lane:4,time:8,duration:0}],'guitar',.5)},imports:{drums:{filename:'fresh-drums.chart',levels:D.LEVELS,derived:[]}},sources:{drums:'Authored drum track',guitar:'Must not be applied'},message:'Authored drum track found.',bpm:120,beat:.5,identity:{title:'Fixture Song',artist:'Fixture Artist'}}:{charts:{},message:'No authored track.'};}}}});
 app.nodes.chartScope.value='whole';await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);
 let saved=[...app.savedSongs.values()][0];saved.quality.imports={drums:{id:'b'.repeat(64),filename:'stale.chart',layout:'five',levels:D.LEVELS,derived:[]}};
 // Reopen makes the stale authored import eligible for regular reuse.
 await app.nodes.libraryButton.click();await until(()=>app.nodes.songList.children.length===1);await app.nodes.songList.children[0].children[2].children[0].click();
 await app.radios.instrument.find(r=>r.value==='drums').emit('change');await until(()=>!app.nodes.repairDrumsButton.disabled);
 const before=plain([...app.savedSongs.values()][0]),audio=[...app.savedSongs.values()][0].audioBlob,jobs=app.requests.length;
 repairing=true;calls.length=0;app.nodes.lookupTitle.value='Fixture Song';app.nodes.lookupArtist.value='Fixture Artist';
 await app.nodes.repairDrumsButton.click();await until(()=>!app.nodes.repairDrumsButton.disabled);
 saved=[...app.savedSongs.values()][0];assert.equal(calls.length,1);assert.deepEqual(plain(calls[0].parts),['drums']);assert.equal(calls[0].enabled,true);assert.equal(app.requests.length,jobs);
 assert.deepEqual(plain(saved.charts.drums),repaired);assert.equal(saved.quality.imports.drums.filename,'fresh-drums.chart');assert.equal(saved.audioBlob,audio);assert.equal(saved.id,before.id);
 for(const part of ['guitar','bass','vocals'])assert.deepEqual(plain(saved.charts[part]),before.charts[part]);
 const restored=await L.unpack(L.pack(saved));assert.deepEqual(restored.charts.drums,repaired);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} repair of an estimate falls back to only the drum worker and replaces every old difficulty`,async()=>{
 let repairing=false;const calls=[],old=D.build([{lane:4,time:1,duration:0}],'drums',.5);
 const app=setup({mobile,chartFixture:()=>repairing?repaired:old,chartResultExtras:{quality:{preserveEasyMedium:true}},browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async options=>{calls.push(options);return {charts:{},message:'No authored drums found.',availableParts:['guitar']};}}}});
 await app.nodes.libraryUploadDrums.click();await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1);
 repairing=true;calls.length=0;const jobs=app.requests.length;await until(()=>!app.nodes.repairDrumsButton.disabled);await app.nodes.repairDrumsButton.click();await until(()=>!app.nodes.repairDrumsButton.disabled);
 assert.equal(calls.length,1);assert.deepEqual(app.requests.slice(jobs),['drums']);assert.deepEqual(plain([...app.savedSongs.values()][0].charts.drums),repaired);
});
test('failed drum repair leaves all saved arrangements and original audio intact',async()=>{
 let repairing=false;const own=D.build(drumNotes,'drums',.5),app=setup({chartFixture:own,workerResult:()=>repairing?{instrument:'drums',charts:{drums:{expert:[{lane:0,time:1,duration:1,pitch:60}]}},bpm:120,beat:.5}:{instrument:'drums',charts:{drums:own},bpm:120,beat:.5},browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async()=>({charts:{},message:'No authored drums.'})}}});
 await app.nodes.libraryUploadDrums.click();await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1);
 const saved=[...app.savedSongs.values()][0],before=plain(saved.charts),audio=saved.audioBlob;repairing=true;await until(()=>!app.nodes.repairDrumsButton.disabled);await app.nodes.repairDrumsButton.click();
 assert.match(app.nodes.chartStatus.textContent,/pitched or sustained/);assert.deepEqual(plain([...app.savedSongs.values()][0].charts),before);assert.equal([...app.savedSongs.values()][0].audioBlob,audio);
});
