const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const P=require('../dist/part-charts.js'),D=require('../dist/chart-difficulties.js'),L=require('../dist/song-library.js');
const parts=['guitar','drums','bass','vocals'],plain=value=>JSON.parse(JSON.stringify(value));
const charts=Object.fromEntries(parts.map((part,i)=>[part,D.build([{lane:i,time:1+i,duration:part==='drums'?0:.2,...(part==='vocals'?{pitch:64}:{})}],part,.5)]));
test('each analysis result retains only its requested chart and metadata; data are independently owned',()=>{
 const quality={sources:Object.fromEntries(parts.map(p=>[p,p+' evidence'])),chartTimings:Object.fromEntries(parts.map(p=>[p,{offset:parts.indexOf(p)/10}])),audioReviews:Object.fromEntries(parts.map(p=>[p,{checked:true}])),scoreReview:'Drum-only review'};
 for(const part of parts){
  const r=P.isolate({charts,quality},part);assert.deepEqual(Object.keys(r.charts),[part]);
  for(const key of ['sources','chartTimings','audioReviews'])assert.deepEqual(Object.keys(r.quality[key]),[part]);
  assert.equal(r.quality.scoreReview,part==='drums'?'Drum-only review':undefined);
  r.charts[part].expert[0].time=15;r.quality.chartTimings[part].offset=900;
  assert.equal(charts[part].expert[0].time,1+parts.indexOf(part));assert.equal(quality.chartTimings[part].offset,parts.indexOf(part)/10);
 }
});
test('missing or mislabeled instrument results are rejected instead of borrowing another part',()=>{
 for(const part of parts)for(const other of parts.filter(p=>p!==part)){
  assert.throws(()=>P.isolate({instrument:other,charts},part),/different instrument/);
  assert.throws(()=>P.isolate({charts:{[other]:charts[other]}},part),/No independent/);
 }
});
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} whole upload cannot overwrite another part from an extra worker chart`,async()=>{
 const app=setup({mobile,chartFixture:[],workerResult:part=>({instrument:part,charts:{[part]:charts[part],...(part!=='guitar'?{guitar:D.build([{lane:4,time:12,duration:0}],'guitar',.5)}:{})},bpm:120,beat:.5,waveform:[],quality:{sources:{[part]:part+' evidence',...(part!=='guitar'?{guitar:'Wrong Guitar source'}:{})},audioReviews:{[part]:{owner:part}}}})}),n=app.nodes;
 n.chartScope.value='whole';await app.upload('All parts.wav');await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(Object.keys(saved.charts).sort(),parts.slice().sort());
 for(const part of parts){assert.deepEqual(plain(saved.charts[part].expert),charts[part].expert);assert.equal(saved.quality.sources[part],part+' evidence');assert.equal(saved.quality.audioReviews[part].owner,part);}
 const restored=await L.unpack(L.pack(saved));
 for(const part of parts)assert.deepEqual(restored.charts[part].expert,charts[part].expert);
 const fresh=setup({mobile,savedSongs:app.savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();
 for(const part of parts){await fresh.radios.instrument.find(r=>r.value===part).emit('change');assert.match(fresh.nodes.chartDetails.textContent,new RegExp(part+' evidence'));}
 assert.deepEqual(fresh.requests,[]);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} missing Drums does not fall back to an analysis worker's Guitar chart`,async()=>{
 const app=setup({mobile,chartFixture:[],workerResult:part=>({instrument:part==='drums'?'guitar':part,charts:{guitar:charts.guitar},waveform:[],bpm:120,beat:.5})}),n=app.nodes;
 await app.upload('Keep Guitar.wav');await until(()=>!n.saveCurrentButton.disabled);const before=plain([...app.savedSongs.values()][0].charts.guitar);
 await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload('Wrong result.wav',9);
 assert.match(n.chartStatus.textContent,/different instrument/);assert.equal(app.savedSongs.size,1);
 assert.deepEqual(plain([...app.savedSongs.values()][0].charts.guitar),before);assert.equal(app.radios.chartTarget.find(r=>r.value==='drums').checked,true);
});
test('a single-part lookup cannot change another saved part’s source or timing metadata',async()=>{
 let response={charts:{},imports:{},sources:{}};
 const app=setup({chartFixture:[{time:1,lane:0,duration:0}],browserOverrides:{RiffCommunityCharts:{lookup:async()=>response}}}),n=app.nodes;
 await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 const first=[...app.savedSongs.values()][0],before=plain({chart:first.charts.guitar,source:first.quality.sources.guitar,timing:first.quality.chartTimings.guitar});
 response={charts:{drums:charts.drums,guitar:charts.guitar},imports:{drums:{filename:'Drums.mid',levels:['expert'],derived:['easy','medium','hard']},guitar:{filename:'Wrong.mid'}},sources:{drums:'Drum source',guitar:'Wrong Guitar source'},timings:{drums:{offset:.1},guitar:{offset:99}},references:{drums:{charter:'Drum charter'},guitar:{charter:'Wrong charter'}}};
 await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(plain({chart:saved.charts.guitar,source:saved.quality.sources.guitar,timing:saved.quality.chartTimings.guitar}),before);
 assert.equal(saved.quality.sources.drums,'Drum source');assert.equal(saved.quality.communityReferences.drums.charter,'Drum charter');assert.equal(saved.quality.communityReferences.guitar,undefined);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} selected Guitar and Bass use mixed-audio checks independently`,async()=>{
 const app=setup({mobile,chartFixture:part=>charts[part]}),n=app.nodes;
 n.chartScope.value='separate';n.partGuitar.checked=true;n.partDrums.checked=false;n.partBass.checked=true;
 await app.upload('Selected mix.wav');await until(()=>!n.saveCurrentButton.disabled);
 assert.deepEqual(app.requests,['guitar','bass']);assert.deepEqual(app.requestModes,[true,true]);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(Object.keys(saved.charts).sort(),['bass','guitar']);
 assert.deepEqual(plain(saved.charts.guitar.expert),charts.guitar.expert);assert.deepEqual(plain(saved.charts.bass.expert),charts.bass.expert);
});
test('selected mixed-audio estimates retain distinct melodies within documented accuracy limits',async()=>{
 const F=require('./fixtures/melody-parts.cjs'),fixture=F.fullBand({bassLevel:.5,vocalLevel:.8}),app=setup({audioSamples:fixture.samples}),n=app.nodes;
 n.chartScope.value='separate';n.partGuitar.checked=false;n.partDrums.checked=false;n.partBass.checked=true;n.partVocals.checked=true;
 await app.upload('Bass and vocals in full mix.wav');await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(app.requestModes,[true,true]);
 for(const part of ['bass','vocals']){
  const actual=saved.charts[part].expert;
  const matched=fixture.truth[part].filter(hit=>actual.some(note=>note.pitch===hit.pitch&&Math.abs(note.time-hit.time)<.065));
  // This deliberately dense fixture establishes a bounded estimate, not a
  // perfect separation claim: one bass miss and extra pitched hits remain.
  assert.ok(matched.length>=(part==='bass'?7:8));assert.ok(actual.length<=(part==='bass'?11:17));
  assert.equal(saved.quality.mixAnalysis[part].estimated,true);assert.equal(saved.charts.guitar,undefined);assert.equal(saved.charts.drums,undefined);
 }
 assert.notDeepEqual(plain(saved.charts.bass.expert),plain(saved.charts.vocals.expert));
});

test('legacy Guitar waveform verification is withdrawn for other instruments without changing saved arrangements',()=>{
 const q={audioReviews:Object.fromEntries(parts.map(p=>[p,{policy:'authored-recording-alignment-v1',timingVerified:true,referenceInstrument:'guitar',sourceOffsetSeconds:-3}])),timingReviews:{drums:{status:'aligned',suggestedMs:0}},chartAdjustments:{drums:50}};
 const r=P.reviewQuality(q);assert.equal(r.audioReviews.guitar.timingVerified,true);
 for(const p of ['drums','bass','vocals']){assert.equal(r.audioReviews[p].timingVerified,false);assert.equal(r.audioReviews[p].sourceOffsetSeconds,-3);assert.equal(r.timingReviews[p].status,'uncertain');}
 assert.equal(r.chartAdjustments.drums,50);assert.equal(q.audioReviews.drums.timingVerified,true);
});
