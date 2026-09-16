const test=require('node:test'),assert=require('node:assert/strict');
const Updates=require('../dist/reference-updates.js'),References=require('../dist/reference-charts.js'),Analyzer=require('../dist/autochart.js');
const id='551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3',musicEnd=272.66185941043085;
const lower=[{lane:0,time:1.25,duration:0}];
const song=()=>({id,musicEnd,beat:.5,bpm:120,audioBlob:new Blob(['original']),charts:{drums:{easy:lower,medium:lower,normal:lower,expert:[],hard:[]},guitar:{expert:lower}},quality:{scoreRevision:1,imports:{guitar:{id:'authored'}}}});
test('automatic In Bloom Expert/Hard exactly match upload analysis; audio and lower/authored parts stay intact',()=>{
  const original=song(),updated=Updates.upgrade(original),matched=Analyzer.buildMatchedCharts(References.match(id,musicEnd),musicEnd).drums;
  assert.deepEqual(updated.charts.drums.expert,matched.expert);assert.deepEqual(updated.charts.drums.hard,matched.hard);
  assert.equal(updated.charts.drums.expert.length,1401);assert.equal(updated.charts.drums.hard.length,1349);
  for(const level of ['easy','medium','normal'])assert.equal(updated.charts.drums[level],original.charts.drums[level]);
  assert.equal(updated.audioBlob,original.audioBlob);assert.equal(updated.charts.guitar,original.charts.guitar);
  assert.equal(updated.quality.imports,original.quality.imports);assert.equal(updated.quality.scoreRevision,4);
  assert.equal(Updates.upgrade(updated),updated,'A revision saves only once');assert.equal(original.quality.scoreRevision,1);
});
test('no automatic replacement of authored drums, other recordings, wrong durations or future revisions',()=>{
  for(const modify of [s=>s.quality.imports.drums={id:'authored'},s=>s.id='f'.repeat(64),s=>s.musicEnd+=1,s=>s.quality.scoreRevision=99,s=>delete s.charts.drums]){
    const original=song();modify(original);assert.equal(Updates.upgrade(original),original);
  }
});
