const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {fixture}=require('./fixtures/open-hat-identity.cjs');
const {measureChart}=require('./chart-metrics.cjs');
const L=require('../dist/song-library.js');
function exact(input,result){
 const expert=result.charts.drums.expert;
 for(const m of measureChart(input.expected,expert)){
  assert.equal(m.matched,m.expected,`Missing lane ${m.lane}`);
  assert.equal(m.extra,0,`Extra lane ${m.lane}`);
 }
 for(const level of ['easy','medium','hard'])for(const n of result.charts.drums[level])
  assert.ok(expert.some(e=>e.lane===n.lane&&e.time===n.time),'Difficulty reduction must keep identity and onset');
}
for(const bars of [6,16])for(const seed of [481,907])for(const decay of [4,7,10])
 test(`${bars>6?'adaptive':'direct'} kit ${seed}, open-hat decay ${decay}: yellow stays yellow; every other voice stays separate`,()=>{
  const f=fixture({bars,seed,decay}),r=analyze({...f,instrument:'drums'});exact(f,r);
  assert.equal(r.quality.method,bars>6?'Adaptive kit separation':'Attack and tone analysis');
  assert.equal(r.chartVersion,25);assert.equal(r.quality.audioReviews.drums.metalIdentityPolicy,'attack-release-timbre-v2');
  assert.equal(r.quality.audioReviews.drums.metalCorrections,bars);
 });
for(const seed of [481,907,2611])test(`sharp crash ${seed}: one cymbal is orange, never an extra yellow head`,()=>{
 const f=fixture({seed,sharpCrash:true}),r=analyze({...f,instrument:'drums'});exact(f,r);
 assert.equal(r.quality.audioReviews.drums.metalCorrections,12);
});
for(const opts of [{choke:true},{openGain:.2},{partialShift:1.07}])test(`hat identity with ${JSON.stringify(opts)}: no release note or recolored body`,()=>{
 const f=fixture(opts);exact(f,analyze({...f,instrument:'drums'}));
});
for(const seed of [481,907])test(`real hat/crash/kick chord ${seed}: separate timbres preserve supported heads without extras`,()=>{
 const f=fixture({seed,duets:true}),r=analyze({...f,instrument:'drums'}),metrics=measureChart(f.expected,r.charts.drums.expert);
 for(const m of metrics){assert.equal(m.extra,0);if(m.lane===1)assert.ok(m.matched>=41,'At least 41/42 hats, including supported chords');else assert.equal(m.matched,m.expected);}
});
test('broadband hats without a distinct fingerprint cannot authorize a confident timbre correction',()=>{
 const f=fixture({metalLevel:0}),r=analyze({...f,instrument:'drums'});
 assert.equal(r.quality.audioReviews.drums.metalCorrections,0);
 // Identically shaped noise with a different annotation is not separable by timbre.
 assert.equal(r.quality.audioReviews.drums.checked,true);
});
test('open-hat colors and per-upload identity review survive portable backup without changing audio',async()=>{
 const f=fixture(),r=analyze({...f,instrument:'drums'}),audioBlob=new Blob(['original local audio']);
 const restored=await L.unpack(L.pack({...r,id:'c'.repeat(64),title:'Open hats',musicEnd:r.duration,audioBlob}));
 exact(f,restored);assert.deepEqual(restored.quality.audioReviews,r.quality.audioReviews);assert.equal(await restored.audioBlob.text(),'original local audio');
});
