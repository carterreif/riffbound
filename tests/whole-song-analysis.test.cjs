const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),F=require('./fixtures/melody-parts.cjs');
// Match the independently generated pitch AND onset one-to-one. More heads
// or a playable four-part result alone cannot establish better transcription.
function score(notes,truth){
  const unmatched=new Set(notes.map((_,i)=>i));let matched=0;
  for(const expected of truth){
    const index=[...unmatched].sort((a,b)=>Math.abs(notes[a].time-expected.time)-Math.abs(notes[b].time-expected.time)).find(i=>notes[i].pitch===expected.pitch&&Math.abs(notes[i].time-expected.time)<=.07);
    if(index!==undefined){unmatched.delete(index);matched++;}
  }
  return {matched,missed:truth.length-matched,extra:unmatched.size};
}
const mixes=[{}, {variant:1,guitarLevel:.5,drumLevel:.3}, {variant:2,bassLevel:.7,vibrato:.15}, {vocalLevel:1.1,guitarLevel:.25,variant:3}];
for(const [index,options] of mixes.entries())test(`whole song: bass and vocals reduce cross-part errors in independently labeled mix ${index+1}`,t=>{
  const audio=F.fullBand(options);
  for(const instrument of ['bass','vocals']){
    const previous=A.analyze({...audio,instrument}),updated=A.analyze({...audio,instrument,wholeSong:true});
    const before=score(previous.charts[instrument].expert,audio.truth[instrument]),after=score(updated.charts[instrument].expert,audio.truth[instrument]);
    assert.ok(after.matched>=before.matched,'Do not exchange extra notes for more missed notes');
    assert.ok(after.extra<before.extra,'Reduce wrong-pitch and unsupported heads');
    assert.ok(after.matched>before.matched||after.extra<before.extra);
    if(instrument==='bass')assert.equal(after.matched,8,'Keep all independently labeled bass attacks');
    else assert.ok(after.matched>=7,'Keep at least seven of the eight labeled vocal attacks');
    assert.equal(updated.quality.mixAnalysis[instrument].policy,'own-harmonic-energy-v1');
    for(const level of ['easy','medium','hard'])for(const note of updated.charts[instrument][level])assert.ok(updated.charts[instrument].expert.some(e=>e.pitch===note.pitch&&e.time===note.time),'Reductions retain measured pitches and times');
    t.diagnostic(`${instrument}: before ${JSON.stringify(before)}; after ${JSON.stringify(after)}. Synthetic mix, not a real-song accuracy claim.`);
  }
});
for(const instrument of ['bass','vocals'])for(const vibrato of [0,.35])test(`whole song: ${instrument} keeps real repeated notes, holds and rests with vibrato ${vibrato}`,()=>{
  const audio=F.melody(instrument,{vibrato}),result=A.analyze({...audio,instrument,wholeSong:true}),notes=result.charts[instrument].expert;
  assert.deepEqual(score(notes,audio.expected),{matched:8,missed:0,extra:0});
  assert.deepEqual(notes.map(n=>n.pitch),audio.expected.map(n=>n.pitch));
  assert.equal(notes[5].lane,notes[6].lane,'Rearticulating a pitch must keep its color');
  if(instrument==='vocals')assert.ok(notes.every(n=>n.duration>.35&&n.duration<.5),'Retain measured vocal holds');
});
test('whole song: unrelated attacks do not split the sustained bass note',()=>{
  const audio=F.fullBand(),notes=A.analyze({...audio,instrument:'bass',wholeSong:true}).charts.bass.expert;
  assert.equal(notes.filter(n=>n.pitch===40&&n.time>=2.75&&n.time<=3.25).length,1);
});
for(const instrument of ['bass','vocals'])test(`whole song: ${instrument} keeps rare pitch colors and the upper bass register`,()=>{
  const audio=require('./fixtures/pitch-colors.cjs').fixture(instrument,{transpose:instrument==='bass'?16:0});
  const notes=A.analyze({...audio,instrument,wholeSong:true}).charts[instrument].expert;
  assert.deepEqual(score(notes,audio.expected),{matched:28,missed:0,extra:0});
  assert.deepEqual(notes.map(n=>n.pitch),audio.expected.map(n=>n.pitch));
  assert.deepEqual(notes.map(n=>n.lane),audio.expected.map(n=>n.lane));
});
test('whole song: silence and broadband noise do not receive invented bass or vocal charts',()=>{
  for(const instrument of ['bass','vocals']){
    assert.throws(()=>A.analyze({...F.noise(),instrument,wholeSong:true}),/No clear/);
    assert.throws(()=>A.analyze({samples:new Float32Array(22050*6),sampleRate:22050,instrument,wholeSong:true}),/No clear/);
  }
});
test('whole song: a cymbal over an old tom tail cannot create a bass or vocal chart',()=>{
  const audio=require('./fixtures/independent-timing.cjs').irregular('drums');
  for(const instrument of ['bass','vocals'])assert.throws(()=>A.analyze({...audio,instrument,wholeSong:true}),/No clear/);
});
test('whole song: genuine legato bass changes and rearticulated notes remain',()=>{
  const audio=F.melody('bass',{legato:true}),notes=A.analyze({...audio,instrument:'bass',wholeSong:true}).charts.bass.expert;
  assert.deepEqual(score(notes,audio.expected),{matched:8,missed:0,extra:0});
});
test('whole song: reviewed drums retain their exact reference while the other parts are analyzed',()=>{
  const input={samples:new Float32Array(Math.round(272.66185941043085*22050)),sampleRate:22050,instrument:'drums',audioId:'551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3'};
  assert.deepEqual(A.analyze({...input,wholeSong:true}),A.analyze(input));
});
