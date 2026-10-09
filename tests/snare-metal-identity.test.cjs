const test=require('node:test'),assert=require('node:assert/strict');
const {analyze,reviewDrumColors}=require('../dist/autochart.js');
const {fixture}=require('./fixtures/open-hat-identity.cjs');
const {measureChart}=require('./chart-metrics.cjs');
function check(f,r){
  const expert=r.charts.drums.expert;
  for(const m of measureChart(f.expected,expert)){
    assert.equal(m.matched,m.expected,`Missing lane ${m.lane}`);
    assert.equal(m.extra,0,`Unsupported lane ${m.lane}`);
  }
  for(const level of ['hard','medium','easy'])for(const n of r.charts.drums[level])
    assert.ok(expert.some(e=>e.lane===n.lane&&e.time===n.time),'Difficulty keeps the corrected voice and onset');
  assert.equal(r.chartVersion,25);
}
for(const bars of [6,16])for(const seed of [481,907,2611])for(const decay of [4,7,10])
  test(`${bars>6?'adaptive':'direct'} snare/open-hat overlap ${seed}/${decay}: red and yellow, no invented orange`,()=>{
    const f=fixture({bars,seed,decay,snareOverlap:true});check(f,analyze({...f,instrument:'drums'}));
  });
for(const seed of [481,907,2611])for(const duets of [false,true])
  test(`color review of snare with genuine ${duets?'hat/crash':'crash'} ${seed}: keep every supplied sound and kick`,()=>{
    const f=fixture({seed,snareOverlap:true,snareCrash:true,duets});
    const r=reviewDrumColors({...f,notes:f.expected});
    for(const m of measureChart(f.expected,r.notes)){
      assert.equal(m.matched,m.expected,`Review removed lane ${m.lane}`);assert.equal(m.extra,0,`Review invented lane ${m.lane}`);
    }
  });
for(const opts of [{choke:true},{openGain:.2},{partialShift:1.07}])
  test(`snare with ${JSON.stringify(opts)} hat: ringing, quiet level and tuning never supply an extra crash`,()=>{
    const f=fixture({...opts,snareOverlap:true});check(f,analyze({...f,instrument:'drums'}));
  });
for(const hatDelay of [.08,.12,.18])
  test(`a hi-hat ${hatDelay}s after a snare cannot supply a yellow note at the snare`,()=>{
    const f=fixture({snareOverlap:true,hatDelay});
    check(f,analyze({...f,instrument:'drums'}));
  });
