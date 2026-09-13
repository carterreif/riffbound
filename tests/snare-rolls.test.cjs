const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {measureChart}=require('./chart-metrics.cjs');
const {fixture}=require('./fixtures/snare-rolls.cjs');

for(const seed of [313,517,971])for(const spacing of [.08,.12]){
  test(`snare-only roll ${seed}, ${spacing*1000} ms: every strike is red, including quieter hits`,()=>{
    const f=fixture(seed,0,spacing),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert']){
      const notes=result.charts.drums[level],metrics=measureChart(f.truth,notes);
      assert.equal(metrics[0].matched,40,'Retain every labeled snare strike');
      for(const m of metrics)assert.equal(m.extra,0,`No extra notes on lane ${m.lane}`);
      assert.ok(notes.every(n=>n.lane===0),'The snare shell and its noise must not split into different colors');
    }
    for(const note of result.charts.drums.easy)assert.ok(result.charts.drums.expert.some(n=>n.time===note.time&&n.lane===note.lane));
  });
  test(`snare roll with real hi-hat accents ${seed}, ${spacing*1000} ms: keep separately supported yellow hits`,t=>{
    const f=fixture(seed,.55,spacing),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert']){
      const metrics=measureChart(f.truth,result.charts.drums[level]);
      assert.equal(metrics[0].matched,40);
      assert.ok(metrics[1].matched>=(spacing===.08?8:seed===313?10:9),'Do not blanket-mute hi-hats during snare rolls');
      for(const m of metrics)assert.equal(m.extra,0,`No extra notes on lane ${m.lane}`);
    }
    const m=measureChart(f.truth,result.charts.drums.expert);
    t.diagnostic(`Snare ${m[0].matched}/40; hi-hat ${m[1].matched}/10; ${m.reduce((n,m)=>n+m.extra,0)} extras (30 ms).`);
  });
}
