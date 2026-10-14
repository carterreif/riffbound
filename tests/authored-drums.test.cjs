const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const A=require('../dist/authored-drums.js'),bundle=require('../dist/charts/king-nothing-drums.json'),X=require('../dist/chart-exchange.js'),D=require('../dist/chart-difficulties.js');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const L=require('../dist/song-library.js'),fetchBundle=async()=>({ok:true,json:async()=>bundle});
function oldRecording(){
 const source=A.result(bundle,A.alignment.duration),charts={...source.charts};
 for(const part of ['guitar','bass','vocals'])charts[part]=D.build([{lane:0,time:2,duration:0}],part,.5);
 charts.drums=Object.fromEntries(Object.entries(charts.drums).map(([l,notes])=>[l,notes.map(n=>({...n,time:n.time-.05}))]));
 return {...L.validate({id:A.alignment.audioId,title:'05 Track 5',filename:'05 Track 5.mp3',instrument:'drums',musicEnd:A.alignment.duration,bpm:bundle.bpm,beat:bundle.beat,offset:0,charts,quality:{...source.quality,chartAdjustments:{drums:-50}}}),audioBlob:new Blob([new Uint8Array([1,2,3])],{type:'audio/mpeg'})};
}
test('exact-recording correction preserves every authored difficulty, neighboring part and audio, resets the old manual shift, and is idempotent',async()=>{
 const old=oldRecording(),before=JSON.stringify(old),fixed=await A.upgrade(old,fetchBundle);
 assert.notEqual(fixed,old);assert.equal(JSON.stringify(old),before);assert.equal(fixed.audioBlob,old.audioBlob);
 assert.equal(fixed.quality.chartAdjustments.drums,0);assert.equal(fixed.quality.chartTimings.drums.offset,A.alignment.offset);assert.equal(fixed.quality.audioReviews.drums.timingVerified,true);
 for(const part of ['guitar','bass','vocals'])assert.equal(fixed.charts[part],old.charts[part]);
 for(const [level,notes] of Object.entries(fixed.charts.drums))notes.forEach((n,i)=>{const original=bundle.charts.drums[level==='normal'?'medium':level][i];assert.equal(n.lane,original.lane);assert.equal(n.duration,0);assert.equal(n.id,old.charts.drums[level][i].id);assert.ok(Math.abs(n.time-original.time-A.alignment.offset)<1e-12);});
 assert.equal(await A.upgrade(fixed,()=>{throw Error('Must not fetch again');}),fixed);
 const reopened=await L.unpack(L.pack(fixed));assert.equal(JSON.stringify(reopened.charts),JSON.stringify(fixed.charts));assert.equal(reopened.quality.audioReviews.drums.recordingId,A.alignment.audioId);
 const manual=structuredClone({...fixed,audioBlob:undefined});manual.charts.drums.expert.forEach(n=>n.time+=.02);manual.quality.chartAdjustments.drums=20;assert.equal(await A.upgrade(manual,fetchBundle),manual);
});
test('automatic correction rejects different bytes/duration/source, player edits, missing levels and failed offline reads',async()=>{
 for(const edit of [s=>s.id='b'.repeat(64),s=>s.musicEnd+=.1,s=>s.quality.imports.drums.id='a'.repeat(64),s=>s.charts.drums.expert[0].lane=2,s=>s.charts.drums.hard[0].time+=.1,s=>s.charts.drums.easy.pop(),s=>delete s.charts.drums.medium]){
  const old=oldRecording();edit(old);assert.equal(await A.upgrade(old,fetchBundle),old);
 }
 const old=oldRecording();assert.equal(await A.upgrade(old,async()=>{throw Error('offline');}),old);
 assert.equal(A.result(bundle,A.alignment.duration,'a'.repeat(64)).quality.audioReviews.drums.timingVerified,false);
 const direct=await A.load('king-nothing',A.alignment.duration,fetchBundle,A.alignment.audioId);assert.equal(direct.quality.audioReviews.drums.timingVerified,true);assert.ok(Math.abs(direct.charts.drums.expert[0].time-.926718820861678)<1e-12);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} opening the original backup automatically corrects and saves only Drums, then reopens without another shift`,async()=>{
 const old=oldRecording(),savedSongs=new Map([[old.id,old]]),samples=new Float32Array(Math.round(A.alignment.duration*22050));
 const overrides={RiffAuthoredDrums:{...A,upgrade:s=>A.upgrade(s,fetchBundle)}};
 const app=setup({mobile,savedSongs,audioSamples:samples,chartFixture:[],browserOverrides:overrides});await until(()=>app.nodes.setlistEntries.children.length===2);await app.nodes.setlistEntries.children[1].click();await until(()=>!app.nodes.saveCurrentButton.disabled);
 const fixed=savedSongs.get(old.id);assert.equal(fixed.quality.chartAdjustments.drums,0);assert.match(app.nodes.songTimingStatus.textContent,/2,836 ms earlier/);assert.equal(fixed.charts.drums.expert.length,1711);assert.deepEqual(app.requests,[]);
 for(const p of ['guitar','bass','vocals'])assert.equal(JSON.stringify(fixed.charts[p]),JSON.stringify(old.charts[p]));
 const before=JSON.stringify(fixed.charts),fresh=setup({mobile,savedSongs,audioSamples:samples,chartFixture:[],browserOverrides:overrides});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(JSON.stringify(savedSongs.get(old.id).charts),before);
});
test('King Nothing source contains only its own Drum track at all four authored difficulties',()=>{
 const result=A.result(bundle,328);assert.deepEqual(Object.keys(result.charts),['drums']);
 assert.deepEqual(Object.fromEntries(D.LEVELS.map(l=>[l,result.charts.drums[l].length])),{easy:569,medium:859,hard:1154,expert:1711});
 for(const level of D.LEVELS){assert.deepEqual(result.charts.drums[level],bundle.charts.drums[level]);assert.notEqual(result.charts.drums[level],bundle.charts.drums[level]);}
 assert.deepEqual([...new Set(result.charts.drums.expert.map(n=>n.lane))].sort(),[0,1,2,3,4,5]);
 assert.equal(result.quality.communityReferences.drums.part,'drums');assert.equal(result.quality.audioReviews.drums.timingVerified,false);
 const text=fs.readFileSync(require.resolve('../dist/charts/king-nothing-drums.chart'),'utf8'),parsed=X.parse(text,{drumLayout:'five'});
 assert.deepEqual(Object.keys(parsed.charts),['drums']);
 for(const level of D.LEVELS)parsed.charts.drums[level].forEach((n,i)=>{assert.equal(n.lane,bundle.charts.drums[level][i].lane);assert.ok(Math.abs(n.time-bundle.charts.drums[level][i].time)<.0001);});
});
test('a wrong recording or a malformed source cannot replace current charts',()=>{
 assert.throws(()=>A.result(bundle,200),/matching King Nothing/);
 const missing=structuredClone(bundle);delete missing.charts.drums.hard;assert.throws(()=>A.result(missing,328),/incomplete/);
 const wrong=structuredClone(bundle);wrong.charts.drums.expert[0].duration=1;assert.throws(()=>A.result(wrong,328),/does not fit/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} King Nothing repair replaces every Drum difficulty and keeps Guitar, Bass, Vocals and audio across reopen and reuse`,async()=>{
 const samples=new Float32Array(22050*328),parts=['guitar','drums','bass','vocals'];
 const app=setup({mobile,audioSamples:samples,chartFixture:part=>D.build([{lane:parts.indexOf(part),time:1,duration:0} ],part,.5),browserOverrides:{RiffAuthoredDrums:{load:async(id,duration)=>{assert.equal(id,'king-nothing');return A.result(bundle,duration);}}}}),n=app.nodes;
 n.chartScope.value='whole';await app.upload('05 Track 5.wav');await until(()=>!n.saveCurrentButton.disabled);
 const old=[...app.savedSongs.values()][0],unchanged=Object.fromEntries(['guitar','bass','vocals'].map(p=>[p,JSON.stringify(old.charts[p])])),audio=await old.audioBlob.text();
 await n.playPartDrums.click();assert.equal(n.knownDrumChart.hidden,false);assert.match(n.playPartStatus.textContent,/audio estimate/);
 await until(()=>!n.loadKingNothingDrums.disabled);await n.loadKingNothingDrums.click();await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.equal(saved.id,old.id);assert.equal(saved.filename,old.filename);assert.equal(await saved.audioBlob.text(),audio);
 for(const p of ['guitar','bass','vocals'])assert.equal(JSON.stringify(saved.charts[p]),unchanged[p]);
 for(const level of D.LEVELS){assert.deepEqual(saved.charts.drums[level],bundle.charts.drums[level]);await app.radios.difficulty.find(r=>r.value===level).emit('change');assert.match(n.chartSummary.textContent,new RegExp('Drums.*'+bundle.charts.drums[level].length+' notes'));}
 assert.match(n.playPartStatus.textContent,/authored chart/);assert.equal(saved.quality.lookupIdentity.title,'King Nothing');assert.equal(saved.quality.audioReviews.drums.timingVerified,false);assert.equal(saved.quality.chartAdjustments?.drums,undefined);assert.match(n.songTimingStatus.textContent,/has not been verified/);
 assert.deepEqual(app.requests,parts);assert.equal(app.decodes,1);
 const fresh=setup({mobile,chartFixture:[],savedSongs:app.savedSongs,audioSamples:samples});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.playPartDrums['aria-pressed'],'true');assert.deepEqual(fresh.requests,[]);
 n.chartScope.value='single';await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload('05 Track 5.wav');await until(()=>!n.saveCurrentButton.disabled);
 assert.deepEqual(app.requests,parts,'Reupload uses the saved authored Drum part');assert.equal([...app.savedSongs.values()][0].charts.drums.expert.length,1711);
});
test('failed Drum source download keeps every chart and current playback selection',async()=>{
 const app=setup({chartFixture:[{lane:0,time:1,duration:0}],browserOverrides:{RiffAuthoredDrums:{load:async()=>{throw Error('Offline chart download failed');}}}}),n=app.nodes;
 await app.upload();await until(()=>!n.saveCurrentButton.disabled);const before=JSON.stringify([...app.savedSongs.values()][0]);
 await n.loadKingNothingDrums.click();assert.equal(JSON.stringify([...app.savedSongs.values()][0]),before);assert.match(n.chartStatus.textContent,/failed/);assert.match(n.chartSummary.textContent,/Guitar/);
});
