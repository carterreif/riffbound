const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js'),L=require('../dist/song-library.js');
const {fixture}=require('./fixtures/open-hat-identity.cjs'),{measureChart}=require('./chart-metrics.cjs');
function check(f,r,minHats=f.expected.filter(e=>e.lane===1).length){
 const expert=r.charts.drums.expert;
 for(const m of measureChart(f.expected,expert)){
  assert.equal(m.extra,0,`Unsupported lane ${m.lane}`);
  if(m.lane===1)assert.ok(m.matched>=minHats,`Hi-hats ${m.matched}/${m.expected}`);
  else assert.equal(m.matched,m.expected,`Missing lane ${m.lane}`);
 }
 for(const level of ['easy','medium','hard'])for(const note of r.charts.drums[level])
  assert.ok(expert.some(n=>n.lane===note.lane&&n.time===note.time),'Reductions cannot shift a stroke or change its instrument');
}
for(const seed of [481,907,2611])test(`sharp hi-hat/cymbal/kick overlap ${seed}: recover supported hands without guessing extras`,()=>{
 const f=fixture({seed,duets:true,sharpCrash:true}),r=analyze({...f,instrument:'drums'});check(f,r,40);
 for(const hit of f.expected.filter(e=>[3,5].includes(e.lane)))assert.ok(r.charts.drums.expert.some(n=>n.lane===hit.lane&&Math.abs(n.time-hit.time)<.012));
});
for(const seed of [481,907])test(`exposed two-hand chord ${seed}: every supported yellow/orange/kick head survives`,()=>{
 const f=fixture({seed,duets:true});check(f,analyze({...f,instrument:'drums'}));
});
for(const bars of [6,16])for(const seed of [481,907,2611])test(`${bars>6?'adaptive':'direct'} ringing hat then crash ${seed}: retain the 100ms separation and kick`,()=>{
 const f=fixture({bars,seed,ringingHat:true,decay:4}),r=analyze({...f,instrument:'drums'});check(f,r);
 for(let bar=0;bar<bars;bar++)for(const [offset,lane] of [[1.9,1],[2,3],[2,5]]){
  const time=.65+bar*3.6+offset;
  assert.ok(r.charts.drums.expert.some(n=>n.lane===lane&&Math.abs(n.time-time)<.012),'A later crash cannot steal the hat onset');
 }
});
for(const seed of [193,712,419,8803,9931])test(`single sharp crash ${seed}: random spectral peaks cannot license an extra hi-hat`,()=>{
 const f=fixture({seed,sharpCrash:true});check(f,analyze({...f,instrument:'drums'}));
});
for(const washRate of [17,31])test(`${washRate}Hz cymbal flutter with a learned metallic hat: ringing and release add no ghost heads`,()=>{
 const f=fixture({washRate});check(f,analyze({...f,instrument:'drums'}));
});
test('overlap corrections survive backup with exact onsets, colors, review and original audio',async()=>{
 const f=fixture({ringingHat:true,decay:4}),r=analyze({...f,instrument:'drums'});
 const restored=await L.unpack(L.pack({...r,id:'d'.repeat(64),title:'Overlapping drums',musicEnd:r.duration,audioBlob:new Blob(['unchanged original'])}));
 const playable=charts=>Object.fromEntries(Object.entries(charts).map(([part,levels])=>[part,Object.fromEntries(Object.entries(levels).map(([level,notes])=>[level,notes.map(({bar,...note})=>note)]))]));
 // Bar indices are derived display data; every playable field must persist.
 check(f,restored);assert.deepEqual(playable(restored.charts),playable(r.charts));assert.deepEqual(restored.quality.audioReviews,r.quality.audioReviews);
 assert.equal(restored.chartVersion,24);assert.equal(await restored.audioBlob.text(),'unchanged original');
});
