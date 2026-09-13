const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const E=require('../dist/engine.js');
const {measureChart}=require('./chart-metrics.cjs');
const {irregular,staggered}=require('./fixtures/independent-timing.cjs');

for(const instrument of ['drums','guitar'])for(const variant of [0,1]){
  test(`${instrument} upload ${variant}: every color follows irregular audio times and rests`,t=>{
    const f=irregular(instrument,variant*.137,variant),result=analyze({...f,instrument});
    const notes=result.charts[instrument].expert,laneCount=instrument==='drums'?6:5;
    const metrics=measureChart(f.truth,notes,.008,laneCount);
    for(const m of metrics){assert.ok(m.expected>0);assert.equal(m.matched,m.expected,`Wrong timing/color ${m.lane}`);assert.equal(m.extra,0,`Extra color ${m.lane}`);}
    assert.equal(new Set(notes.map(n=>n.time)).size,notes.length,'Distinct audio strikes must not become chords');
    for(const level of ['easy','normal'])for(const n of result.charts[instrument][level])assert.ok(notes.some(e=>e.time===n.time&&(instrument==='drums'?e.lane===n.lane:e.pitch===n.pitch)),'Difficulty preserves onset and physical drum or original pitch');
    if(instrument==='drums')assert.equal(result.charts.drums.normal.length,f.truth.length);
    else for(const n of notes)assert.equal(n.pitch,f.truth.find(e=>Math.abs(e.time-n.time)<.008).pitch);
    const session=new E.Session('expert','tap',instrument,{notes,musicEnd:result.duration});
    for(const n of notes){session.tap(n.lane,n.time);session.update(n.time,new Set([n.lane]));}
    session.update(result.duration+1,new Set());
    assert.equal(session.hits,notes.length);assert.equal(session.misses,0);
    t.diagnostic(`${notes.length}/${f.truth.length} matched; max error ${(Math.max(...metrics.flatMap(m=>m.errors))*1000).toFixed(1)} ms; no extra colors.`);
  });
}

for(const [spacing,minimum,maximumExtra] of [
  [.025,[7,8,5,4,3,5],[0,0,0,1,0,1]],
  [.04,[7,6,5,3,5,5],[2,0,1,1,1,2]]
]){
  test(`staggered drum attacks ${spacing*1000} ms: separate measured noise attacks from earlier bodies`,t=>{
    const f=staggered(133,spacing),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert']){
      const notes=result.charts.drums[level],metrics=measureChart(f.truth,notes,.015);
      for(const m of metrics){assert.ok(m.matched>=minimum[m.lane],`Lost color ${m.lane}`);assert.ok(m.extra<=maximumExtra[m.lane],`Invented color ${m.lane}`);}
      if(spacing===.025)for(const time of [10,11.527]){
        const body=notes.find(n=>[2,5].includes(n.lane)&&Math.abs(n.time-time)<.008);
        const hat=notes.find(n=>n.lane===1&&Math.abs(n.time-time-spacing)<.008);
        assert.ok(body&&hat,'Both actual strikes must survive');
        assert.ok(hat.time-body.time>.02,'A later hat must not be anchored to the earlier body');
        assert.ok(!notes.some(n=>n.lane===3&&Math.abs(n.time-time)<.05),'Later hat energy must not invent an early crash');
      }
    }
    t.diagnostic(measureChart(f.truth,result.charts.drums.expert,.015).map(m=>`lane ${m.lane}: ${m.matched}/${m.expected}, ${m.extra} extras`).join('; '));
  });
}
