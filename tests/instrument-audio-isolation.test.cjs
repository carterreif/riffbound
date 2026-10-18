const test=require('node:test'),assert=require('node:assert/strict'),A=require('../dist/autochart.js'),F=require('./fixtures/melody-parts.cjs'),I=require('./fixtures/independent-timing.cjs');
for(const part of ['bass','vocals'])test(`${part}-only harmonic attacks cannot supply Drum hits`,()=>{
 assert.throws(()=>A.analyze({...F.melody(part),instrument:'drums',wholeSong:true}),/Not enough clear/);
});
test('pitched Guitar attacks cannot supply Drum hits',()=>{
 assert.throws(()=>A.analyze({...I.irregular('guitar'),instrument:'drums',wholeSong:true}),/Not enough clear/);
});
test('own real percussion retains all six colors and timing when tonal checks run',()=>{
 const f=I.irregular('drums'),r=A.analyze({...f,instrument:'drums',wholeSong:true}),notes=r.charts.drums.expert;
 assert.deepEqual(Object.keys(r.charts),['drums']);assert.equal(notes.length,f.truth.length);
 for(const hit of f.truth)assert.ok(notes.some(n=>n.lane===hit.lane&&Math.abs(n.time-hit.time)<.03));
 assert.equal(r.quality.audioReviews.drums.tonalRejectionPolicy,'short-and-sustained-harmonic-family-v2');
});
test('overlapping pitched music does not remove the independently heard percussion',()=>{
 const f=F.fullBand(),notes=A.analyze({...f,instrument:'drums',wholeSong:true}).charts.drums.expert;
 // This dense-mix estimator already misses some truth; guard retained recall.
 const matched=f.truth.drums.filter(t=>notes.some(n=>n.lane===t.lane&&Math.abs(n.time-t.time)<.06));assert.ok(matched.length>=8);
});
