const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),F=require('./fixtures/expert-recall.cjs');
function exact(result,f,instrument){
 const notes=result.charts[instrument].expert;
 assert.equal(notes.length,f.truth.length,'Every labeled strike, no extra note heads');
 for(let i=0;i<notes.length;i++){
  const n=notes[i],hit=f.truth[i];assert.ok(Math.abs(n.time-hit.time)<.03,`Onset ${n.time} vs ${hit.time}`);
  if(instrument==='drums')assert.equal(n.lane,hit.lane);else assert.equal(n.pitch,hit.pitch);
 }
 for(const level of ['easy','medium','hard'])for(const n of result.charts[instrument][level]){
  assert.ok(notes.some(e=>e.time===n.time&&(instrument==='drums'?e.lane===n.lane:e.pitch===n.pitch)));
 }
}
for(const instrument of ['guitar','bass','vocals'])for(const spacing of [.08,.12,.16])test(`${instrument}: all 24 actual re-articulations at ${spacing*1000} ms survive Expert`,()=>{
 const f=F.rapid(instrument,spacing);exact(A.analyze({...f,instrument}),f,instrument);
});
for(const spacing of [.08,.1,.12])test(`short guitar melody ${spacing*1000} ms follows all five actual pitches`,()=>{
 const f=F.rapid('guitar',spacing,true),result=A.analyze({...f,instrument:'guitar'});exact(result,f,'guitar');
 assert.deepEqual([...new Set(result.charts.guitar.expert.map(n=>n.lane))].sort(),[0,1,2,3,4]);
});
for(const instrument of ['guitar','bass','vocals'])test(`${instrument}: a single clear note is charted without inventing a four-note minimum`,()=>{
 const f=F.sparse(instrument);exact(A.analyze({...f,instrument}),f,instrument);
});
for(let lane=0;lane<6;lane++)test(`drums: one actual hit on color ${lane} leaves every other color empty`,()=>{
 const f=F.sparse('drums',lane);exact(A.analyze({...f,instrument:'drums'}),f,'drums');
});

for(const instrument of ['guitar','drums','bass','vocals'])test(`${instrument}: continuous unpitched noise cannot supply an instrument chart`,()=>{
 const f=require('./fixtures/melody-parts.cjs').noise();
 assert.throws(()=>A.analyze({...f,instrument}),/No clear|Not enough clear/);
});
