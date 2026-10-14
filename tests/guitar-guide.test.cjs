const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),F=require('./fixtures/guitar-chords.cjs'),E=require('../dist/engine.js');
for(const options of [{},{quiet:true},{offset:.137,percussion:true}])test(`Guitar guide: independent new notes remain under a ringing earlier tone ${JSON.stringify(options)}`,()=>{
  const f=F.overlapping(options),r=A.analyze({...f,instrument:'guitar'}),notes=r.charts.guitar.expert;
  assert.equal(notes.length,f.truth.length,'Keep exactly the played tones, with no inherited-ring or drum heads');
  for(const expected of f.truth){const n=notes.find(n=>n.pitch===expected.pitch&&Math.abs(n.time-expected.time)<.035);assert.ok(n,`Missing pitch ${expected.pitch} at ${expected.time}`);assert.ok(Math.abs(n.duration-expected.duration)<.1,`Wrong release for ${expected.pitch}: ${n.duration}`);}
  assert.equal(r.quality.audioReviews.guitar.arrangementPolicy,'reference-guided-audio-v1');
  assert.ok(r.quality.audioReviews.guitar.recovered>0,'At least one independently proven attack is recovered');
  for(const level of ['easy','medium','hard'])for(const n of r.charts.guitar[level])assert.ok(notes.some(e=>e.time===n.time&&e.pitch===n.pitch&&e.duration===n.duration));
  for(const level of E.Difficulties.LEVELS){const session=new E.Session(level,'tap','guitar',{notes:r.charts.guitar[level],musicEnd:r.duration});for(const n of session.notes)assert.equal(session.tap(n.lane,n.time),true);session.update(r.duration+1,new Set());assert.equal(session.misses,0);}
});
test('Guitar guide: an unrelated loud passage does not create an unmeasured sustain',()=>{
  const notes=A.buildFocusedCharts([{time:1,pitch:52,strength:1},{time:4,pitch:59,strength:1}],'guitar',.5,7,new Float32Array(700).fill(1),.01).guitar.expert;
  assert.ok(notes.every(n=>n.duration===0));
});
