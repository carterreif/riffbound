const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {fixture,wash}=require('./fixtures/cymbal-overlaps.cjs');
const {measureChart}=require('./chart-metrics.cjs');

for(const [seed,minHats] of [[712,38],[409,38],[3031,39]]){
  test(`cymbal overlaps ${seed}: orange survives body chords and quiet hats stay yellow`,t=>{
    const f=fixture(seed),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert']){
      const metrics=measureChart(f.truth,result.charts.drums[level]);
      for(const m of metrics){
        assert.equal(m.extra,0,`False color ${m.lane}`);
        if(m.lane===1)assert.ok(m.matched>=minHats,`Quiet hats: ${m.matched}/${m.expected}`);
        else assert.equal(m.matched,m.expected,`Missed color ${m.lane}`);
      }
    }
    t.diagnostic(measureChart(f.truth,result.charts.drums.expert).map(m=>`lane ${m.lane}: ${m.matched}/${m.expected}, ${m.extra} extras`).join('; '));
  });
}
for(const seed of [543,2041])for(const withHats of [false,true]){
  test(`cymbal wash ${seed}, isolated hats ${withHats}: ringing must not invent yellow strikes`,()=>{
    const f=wash(seed,withHats),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert'])for(const m of measureChart(f.truth,result.charts.drums[level])){
      assert.equal(m.matched,m.expected,`Missing measured strike on ${m.lane}`);
      assert.equal(m.extra,0,`Ringing created an extra note on ${m.lane}`);
    }
  });
}
