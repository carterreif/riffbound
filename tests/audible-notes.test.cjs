const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),F=require('./fixtures/audible-notes.cjs');
const {measureChart}=require('./chart-metrics.cjs');
for(const instrument of ['guitar','bass','vocals'])for(const rate of [1.5,2,3]){
 test(`${instrument}: held notes with ${rate} Hz volume modulation do not generate extra strikes`,()=>{
  const f=F.sustained(instrument,{rate}),result=A.analyze({...f,instrument});
  const notes=result.charts[instrument].expert;
  assert.equal(notes.length,f.truth.length,'One actual attack per held pitch');
  for(let i=0;i<notes.length;i++){
   assert.equal(notes[i].pitch,f.truth[i].pitch);
   assert.ok(Math.abs(notes[i].time-f.truth[i].time)<.03,'Retain the audible start');
  }
  assert.equal(result.quality.evidencePolicy,'audible-attacks-v2');
  for(const level of ['hard','medium','easy'])for(const n of result.charts[instrument][level]){
   assert.ok(notes.some(e=>e.time===n.time&&e.pitch===n.pitch),'Difficulty reduction cannot add or retime notes');
  }
 });
}
for(const rate of [13,17,23])test(`drums: ${rate} Hz ringing neither adds duplicate crashes nor invents hi-hats`,()=>{
 const f=F.cymbalTails(rate),result=A.analyze({...f,instrument:'drums'});
 for(const m of measureChart(f.truth,result.charts.drums.expert)){
  assert.equal(m.matched,m.expected,`Missing genuine color ${m.lane}`);
  assert.equal(m.extra,0,`False color ${m.lane}`);
 }
 for(const level of ['hard','medium','easy'])for(const n of result.charts.drums[level]){
  assert.ok(result.charts.drums.expert.some(e=>e.time===n.time&&e.lane===n.lane));
 }
});
