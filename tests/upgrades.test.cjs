const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../dist/playback-tools.js'),L=require('../dist/song-library.js'),M=require('../dist/performance-motion.js'),A=require('../dist/autochart.js');

test('calibration resists outliers and rejects unstable taps',()=>{
  const estimate=T.calibration([111,114,112,113,111,115,112,114,113,230]);assert.equal(estimate.stable,true);assert.equal(estimate.offset,113);
  assert.equal(T.calibration([1,2,3]),null);assert.equal(T.calibration([-240,-180,-120,-60,60,120,180,240]).stable,false);
});
test('practice boundaries keep count-in and loops on the original song timeline',()=>{
  const loop={start:12,end:16};assert.deepEqual(T.position(10,12,12,.5,loop),{time:11,cycle:0});assert.deepEqual(T.position(20,12,12,.5,loop),{time:12,cycle:1});assert.deepEqual(T.position(37,12,12,.5,loop),{time:12.5,cycle:3});
  assert.deepEqual(T.segment([{time:11,lane:0,duration:2},{time:15,lane:1,duration:3},{time:16,lane:2,duration:0}],loop),[{time:15,lane:1,duration:1}]);
  const next=T.visibleNotes([{time:12,lane:0,duration:0,hit:true}],loop,15,2);assert.equal(next[1].time,16);assert.equal(next[1].hit,false,'Next pass must approach the hit line before the loop restarts');
});
test('portable backups round-trip audio and separate instrument charts, and reject corruption',async()=>{
  const notes=[{time:1,lane:0,duration:0}],song={id:'a'.repeat(64),title:'Original <song>',instrument:'drums',musicEnd:12,bpm:120,beat:.5,offset:0,charts:{drums:{easy:notes,normal:notes,expert:notes},guitar:{easy:notes,normal:notes,expert:notes}},waveform:[.1,.8],audioBlob:new Blob([new Uint8Array([1,2,3,4])],{type:'audio/wav'})};
  const blob=L.pack(song),restored=await L.unpack(blob);assert.equal(restored.title,song.title);assert.deepEqual(Object.keys(restored.charts).sort(),['drums','guitar']);assert.deepEqual([...new Uint8Array(await restored.audioBlob.arrayBuffer())],[1,2,3,4]);
  await assert.rejects(L.unpack(blob.slice(0,20)),/incomplete/);await assert.rejects(L.unpack(new Blob(['not a song backup'])),/Riffbound/);
  assert.throws(()=>L.validate({...song,charts:{drums:{easy:[],normal:[],expert:[{time:1,lane:50,duration:0}]}}}),/invalid note/);
});
test('Standard and Expert drums retain 16th-note rolls at 240 BPM without changing lane colors',()=>{
  const events=Array.from({length:12},(_,i)=>({time:1+i*.0625,lane:0,strength:1}));
  const charts=A.buildFocusedCharts(events,'drums',.25,5,new Float32Array(500),.01).drums;
  assert.equal(charts.expert.length,12);assert.equal(charts.normal.length,12);for(const note of charts.normal)assert.ok(charts.expert.some(n=>n.time===note.time&&n.lane===note.lane));
});
test('independent close drum attacks survive while resonance from the same strike is removed',()=>{
  const events=[{time:1,part:1,lane:0,strength:2,weight:3},{time:1.09,part:2,lane:2,strength:1.3,weight:2},{time:2,part:1,lane:0,strength:2,weight:3},{time:2.04,part:2,lane:2,strength:1.3,weight:1}];
  const kept=A.filterSeparated(events,[{time:1},{time:1.09},{time:2},{time:2.04}],t=>t);
  assert.deepEqual(kept.map(n=>n.time),[1,1.09,2]);
});
test('actual fills trigger the drum camera; streaks animate the crowd; reduced motion stays still',()=>{
  const percussion=M.performanceEvents([{time:2,lane:2},{time:2.15,lane:0},{time:2.3,lane:4},{time:3,lane:3}],[]);
  const fill=M.sample({time:2.2,state:'playing',percussion,streak:60});assert.equal(fill.fill,true);assert.equal(fill.shot,'drums');assert.ok(fill.celebration>.5);
  const still=M.sample({time:2.2,state:'playing',percussion,streak:60,reducedMotion:true});assert.equal(still.shot,'wide');assert.deepEqual(M.deform(2,.3,.3,still),[.3,.3]);
  const paused=M.sample({time:2.2,wallTime:100,state:'paused',percussion,streak:60});assert.equal(paused.clock,fill.clock);assert.equal(paused.leftStrike,fill.leftStrike);
});
