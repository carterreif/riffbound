const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {fixture}=require('./fixtures/drum-colors.cjs');
const {measureChart}=require('./chart-metrics.cjs');

for(const [seed,hatVolume,minimum] of [
  [827,.22,[24,30,24,6,24,6]],
  [1931,.22,[24,30,24,6,24,6]],
  [827,.08,[24,30,24,6,24,6]],
  [827,.045,[24,20,18,6,15,6]]
]){
  test(`separate drum colors ${seed}, hat level ${hatVolume}: ringing toms and cymbals cannot recolor subsequent hits`,t=>{
    const f=fixture(seed,hatVolume),result=analyze({...f,instrument:'drums'});
    for(const difficulty of ['normal','expert']){
      const notes=result.charts.drums[difficulty],metrics=measureChart(f.truth,notes);
      for(const m of metrics){
        assert.equal(m.extra,0,`False notes or incorrect color ${m.lane}`);
        assert.ok(m.matched>=minimum[m.lane],`Missing strikes on color ${m.lane}: ${m.matched}/${m.expected}`);
      }
      for(const hit of f.truth.filter(e=>e.lane===0))assert.deepEqual(notes.filter(n=>Math.abs(n.time-hit.time)<.03).map(n=>n.lane),[0],'A snare roll stays red');
      for(const hit of f.truth.filter(e=>e.lane===1))assert.ok(notes.filter(n=>Math.abs(n.time-hit.time)<.03).every(n=>n.lane===1),'A hi-hat cannot inherit the previous tom color');
      assert.ok(notes.every(n=>n.time>.6&&n.time<23),'No notes in the opening or trailing silence');
    }
    t.diagnostic(measureChart(f.truth,result.charts.drums.expert).map(m=>`lane ${m.lane}: ${m.matched}/${m.expected}, ${m.extra} extras`).join('; '));
  });
}
