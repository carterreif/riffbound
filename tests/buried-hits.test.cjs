const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),L=require('../dist/song-library.js');
const {fixture}=require('./fixtures/quiet-attacks.cjs'),{ringing}=require('./fixtures/tom-recovery.cjs'),{measureChart}=require('./chart-metrics.cjs');

for(const spacing of [.23,.25])for(const lane of [2,4,5])test(`buried voice ${lane}, ${spacing}s: recover every soft repeat without added colors`,()=>{
  const f=fixture('drums',lane,.03,spacing),r=A.analyze({...f,instrument:'drums'}),notes=r.charts.drums.expert;
  for(const m of measureChart(f.truth,notes)){assert.equal(m.matched,m.expected);assert.equal(m.extra,0);}
  assert.equal(r.quality.audioReviews.drums.checked,true);assert.equal(r.quality.audioReviews.drums.policy,'ring-residual-v1');
  assert.equal(r.quality.audioReviews.drums.recovered,8);assert.equal(r.quality.ghostHits,8);
  for(const hit of f.truth)assert.equal(!!notes.find(n=>n.lane===lane&&Math.abs(n.time-hit.time)<.03)?.ghost,hit.quiet);
});

test('near-cancelling blue repeats recover only supported hits rather than completing the pattern',()=>{
  const f=fixture('drums',2,.03,.271),r=A.analyze({...f,instrument:'drums'}),metrics=measureChart(f.truth,r.charts.drums.expert);
  assert.ok(metrics[2].matched>16,'Improve on the 16 exposed accents');assert.ok(metrics[2].matched<24,'Ambiguous hits stay unconfirmed');
  for(const m of metrics)assert.equal(m.extra,0);
});

for(const rate of [7,13,17,23,31])for(const lane of [2,4])test(`ringing ${lane}/${rate}Hz: never manufacture a ghost fill from modulation or release`,()=>{
  const f=ringing({lane,rate}),r=A.analyze({...f,instrument:'drums'});
  assert.equal(r.quality.audioReviews.drums.recovered,0);
  for(const m of measureChart(f.truth,r.charts.drums.expert)){assert.equal(m.matched,m.expected);assert.equal(m.extra,0);}
});

test('cymbal noise under earlier wash remains an estimate instead of acquiring guessed tom colors',()=>{
  const f=fixture('drums',3,.03,.23),r=A.analyze({...f,instrument:'drums'}),notes=r.charts.drums.expert;
  assert.ok(notes.length>=16&&notes.length<24);assert.ok(notes.every(n=>n.lane===3));
  assert.equal(r.quality.audioReviews.drums.checked,true);assert.equal(r.quality.audioReviews.drums.recovered,0);
  for(const m of measureChart(f.truth,notes))assert.equal(m.extra,0);
});

for(const instrument of ['guitar','bass','vocals'])test(`${instrument}: each upload retains independent audible-attack checks`,()=>{
  const f=fixture(instrument,0,.03,.23),r=A.analyze({...f,instrument});
  assert.equal(r.quality.audioReviews[instrument].checked,true);assert.equal(r.quality.audioReviews[instrument].policy,'audible-attacks-v2');
  assert.equal(r.charts[instrument].expert.length,24);
  assert.equal(Object.keys(r.quality.audioReviews).length,1);
});

test('overlap-review results and recovered ghost notes survive portable backups',async()=>{
  const f=fixture('drums',2,.03,.23),r=A.analyze({...f,instrument:'drums'});
  const song={...r,id:'b'.repeat(64),title:'Buried hits',musicEnd:r.duration,audioBlob:new Blob(['unchanged original audio'])};
  const saved=await L.unpack(L.pack(song));
  assert.deepEqual(saved.quality.audioReviews,r.quality.audioReviews);
  assert.equal(saved.charts.drums.expert.filter(n=>n.ghost).length,8);
  assert.equal(await saved.audioBlob.text(),'unchanged original audio');
});
