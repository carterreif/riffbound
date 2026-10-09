const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js'),{measureChart}=require('./chart-metrics.cjs');
const {fill,ringing}=require('./fixtures/tom-recovery.cjs');

for(const options of [
  {stick:.04},{stick:.08},{stick:.15},{seed:1827,stick:.08},
  {rack:210,floor:120},{rack:140,floor:78},{spacing:.08},
  {spacing:.1,tail:5},{count:120,stick:.08},
  {voice:2},{voice:4},{rack:245,floor:175,voice:2}
])test(`tom recovery ${JSON.stringify(options)}: retain every hit and no unused colors`,t=>{
  const f=fill(options),labels=[],result=analyze({...f,instrument:'drums'},(_,label)=>labels.push(label));
  const notes=result.charts.drums.expert,metrics=measureChart(f.truth,notes);
  assert.equal(result.chartVersion,22);
  assert.equal(result.quality.tomEvidencePolicy,'measured-resonance-v1');
  for(const m of metrics){assert.equal(m.matched,m.expected,`Missing or wrong color ${m.lane}`);assert.equal(m.extra,0,`Invented color ${m.lane}`);}
  assert.ok(metrics.flatMap(m=>m.errors).every(error=>error<.025),'Tom attacks follow their own onset');
  for(const level of ['easy','medium','hard'])for(const n of result.charts.drums[level])assert.ok(notes.some(e=>e.time===n.time&&e.lane===n.lane),'Difficulty preserves the measured hit and its color');
  if(options.count===120)assert.ok(labels.includes('Learning the sounds of this drum kit…'),'Exercise adaptive separation as well as direct analysis');
  t.diagnostic(`${metrics[2].matched} blue and ${metrics[4].matched} green; zero extra colors`);
});

for(const lane of [2,4])for(const rate of [13,23])test(`ringing ${lane} tom at ${rate} Hz: a modulated tail is not a new fill`,()=>{
  const f=ringing({lane,rate}),result=analyze({...f,instrument:'drums'});
  for(const m of measureChart(f.truth,result.charts.drums.expert)){assert.equal(m.matched,m.expected);assert.equal(m.extra,0);}
});
