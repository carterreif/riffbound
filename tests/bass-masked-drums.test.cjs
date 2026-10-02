const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../dist/autochart.js');
const {fixture}=require('./fixtures/bass-masked-drums.cjs');
const {measureChart}=require('./chart-metrics.cjs');

for(const seed of [37,141])for(const decay of [35,50]){
  test(`bass-masked metal ${seed}/${decay}: hats stay yellow and cymbals orange alongside kicks`,()=>{
    const f=fixture(seed,decay),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert'])for(const m of measureChart(f.truth,result.charts.drums[level])){
      assert.equal(m.matched,m.expected,`Missing color ${m.lane}`);
      assert.equal(m.extra,0,`Accompaniment created a false color ${m.lane}`);
    }
    const master=result.charts.drums.expert;
    for(const level of ['easy','medium','hard'])for(const n of result.charts.drums[level]){
      assert.ok(master.some(e=>e.lane===n.lane&&e.time===n.time),'Difficulty reduction retains color and timing');
    }
  });
}

test('uploaded Roam excerpt: reviewed masked hats and cymbals use their visible colors',{
  skip:!process.env.RIFFBOUND_ROAM_PCM
},()=>{
  // Local-only 22,050 Hz mono float32 extraction from the supplied video.
  // These are sparse reviewed corrections, not a complete song transcription.
  const bytes=fs.readFileSync(process.env.RIFFBOUND_ROAM_PCM);
  const samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
  assert.ok(samples.length/22050>31.8&&samples.length/22050<32);
  const result=analyze({samples,sampleRate:22050,instrument:'drums'}),notes=result.charts.drums.expert;
  const reviewed=[... [6.233,10.600,17.967,25.533,27.333,28.233,31.000].map(time=>({time,lane:1})),
    ...[12.100,20.900,21.833].map(time=>({time,lane:3}))];
  for(const hit of reviewed){
    assert.ok(notes.some(n=>n.lane===hit.lane&&Math.abs(n.time-hit.time)<.06),`Missing reviewed color ${hit.lane} at ${hit.time}`);
    assert.ok(!notes.some(n=>n.lane===0&&Math.abs(n.time-hit.time)<.06),`False snare at ${hit.time}`);
  }
  assert.ok(notes.filter(n=>n.time>2.3&&n.time<4.05).every(n=>n.lane===0),'The opening snare phrase must stay red');
  assert.ok(notes.every(n=>n.lane!==2&&n.lane!==4),'Do not invent toms in this excerpt');
});
