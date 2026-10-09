const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),F=require('./fixtures/pitch-colors.cjs');
for(const instrument of ['guitar','bass','vocals'])for(const uneven of [false,true])test(`${instrument}: rare and unevenly spaced pitches keep five distinct audio colors (${uneven})`,()=>{
 const f=F.fixture(instrument,{uneven}),r=A.analyze({...f,instrument}),notes=r.charts[instrument].expert;
 assert.equal(notes.length,f.expected.length,'Every real strike, no added color heads');
 notes.forEach((n,i)=>{
  const hit=f.expected[i];assert.equal(n.pitch,hit.pitch);
  assert.ok(Math.abs(n.time-hit.time)<(instrument==='bass'?.045:.03),'Retain the measured attack within the instrument window');
  assert.equal(n.lane,hit.lane,`Pitch ${hit.pitch} keeps its own ordered color`);
 });
 assert.equal(r.quality.audioReviews[instrument].colorPolicy,'distinct-audio-pitches-v1');
 assert.deepEqual(r.quality.audioReviews[instrument].pitchColors,f.expected.filter((e,i)=>i===f.expected.findIndex(n=>n.pitch===e.pitch)).map(({pitch,lane})=>({pitch,lane})));
 for(const level of ['easy','medium','hard'])for(const n of r.charts[instrument][level]){
  const full=notes.find(e=>e.time===n.time&&e.pitch===n.pitch);assert.ok(full,'Reduction preserves audio identity and timing');
  const frets=instrument==='vocals'?5:level==='easy'?3:level==='medium'?4:5;
  assert.equal(n.lane,Math.round(full.lane*(frets-1)/4),'Only the selected difficulty changes fret count');
 }
});

for(const instrument of ['guitar','bass','vocals'])test(`${instrument}: color assignment cannot depend on how often an accepted pitch repeats`,()=>{
 const pitches=[48,51,55,60,72,76,79],events=pitches.map((pitch,i)=>({time:i+.5,pitch,duration:0,strength:1}));
 const sparse=A.buildFocusedCharts(events,instrument,.5,20,[],.01)[instrument].expert;
 const frequent=A.buildFocusedCharts(events.concat(Array.from({length:100},(_,i)=>({time:8+i*.1,pitch:60,duration:0,strength:1}))),instrument,.5,20,[],.01)[instrument].expert;
 for(const n of sparse)assert.equal(n.lane,frequent.find(e=>e.time===n.time).lane,'Repeats do not recolor other pitches');
 assert.equal(sparse[0].lane,0);assert.equal(sparse.at(-1).lane,4);
 for(let i=1;i<sparse.length;i++)assert.ok(sparse[i].lane>=sparse[i-1].lane,'Pitch order is preserved when more than five pitches share the pads');
});

test('portable backups retain independent pitch colors for all tonal instruments',async()=>{
 const L=require('../dist/song-library.js'),charts={},audioReviews={};
 for(const instrument of ['guitar','bass','vocals']){
  const r=A.analyze({...F.fixture(instrument,{uneven:true}),instrument});
  charts[instrument]=r.charts[instrument];audioReviews[instrument]=r.quality.audioReviews[instrument];
 }
 const song={id:'e'.repeat(64),title:'Independent pitch colors',instrument:'guitar',musicEnd:17,beat:.5,bpm:120,charts,quality:{audioReviews},chartVersion:8,audioBlob:new Blob(['original audio'])};
 const restored=await L.unpack(L.pack(song));
 assert.deepEqual(restored.quality.audioReviews,audioReviews);
 const playable=chart=>Object.fromEntries(Object.entries(chart).map(([part,levels])=>[part,Object.fromEntries(Object.entries(levels).map(([level,notes])=>[level,notes.map(({bar,...n})=>n)]))]));
 assert.deepEqual(playable(restored.charts),playable(charts));
 assert.equal(await restored.audioBlob.text(),'original audio');
});
