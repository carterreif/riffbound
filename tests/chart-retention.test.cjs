const test=require('node:test'),assert=require('node:assert/strict');
const {buildFocusedCharts}=require('../dist/autochart.js');
const {measureChart}=require('./chart-metrics.cjs');
const build=(events,instrument='drums',beat=.5)=>buildFocusedCharts(events,instrument,beat,8,new Float32Array(800),.01)[instrument];
const identity=notes=>notes.map(({time,lane})=>({time,lane}));

test('R6: duplicate and wrong-color notes cannot inflate accuracy',()=>{
  const metrics=measureChart([{time:1,lane:0},{time:2,lane:1}],[{time:1,lane:0},{time:1.005,lane:0},{time:2,lane:3}]);
  assert.equal(metrics[0].matched,1);assert.equal(metrics[0].extra,1);
  assert.equal(metrics[1].missed,1);assert.equal(metrics[3].extra,1);
});

test('R3: every drum color keeps quiet fast repeats, flams, and concurrent voices',()=>{
  const events=[];
  for(let lane=0;lane<6;lane++)for(let j=0;j<12;j++)events.push({lane,time:1+j*.06+lane*.001,strength:j%2?.08:2});
  events.push({lane:0,time:2,strength:2},{lane:0,time:2.018,strength:.2});
  const expected=identity(events.slice().sort((a,b)=>a.time-b.time||a.lane-b.lane));
  // Input order and tempo must not change which measured hits survive.
  for(const beat of [.25,.8]){
    const charts=build(events.slice().reverse(),'drums',beat);
    for(const level of ['normal','expert'])assert.deepEqual(identity(charts[level]),expected);
    assert.ok(charts.easy.length<charts.expert.length);
    for(const note of charts.easy)assert.ok(expected.some(n=>n.time===note.time&&n.lane===note.lane));
  }
});

test('R3/R5: duplicate detection merges only its own lane and preserves original onset',()=>{
  const events=[{lane:0,time:1,strength:1},{lane:0,time:1.006,strength:2},{lane:1,time:1,strength:.1},{lane:0,time:1.025,strength:.1}];
  const charts=build(events);
  for(const level of ['normal','expert'])assert.deepEqual(identity(charts[level]),[{lane:1,time:1},{lane:0,time:1.006},{lane:0,time:1.025}]);
});

test('R4: Expert guitar preserves rapid measured attacks and stable pitch colors',()=>{
  const events=Array.from({length:30},(_,i)=>({time:1+i*.06,pitch:[52,57,60,64,69][i%5],strength:i%2?.1:2}));
  const charts=build(events,'guitar');
  assert.deepEqual(charts.expert.map(n=>n.time),events.map(e=>e.time));
  for(const level of ['expert','normal','hard','medium','easy']){const laneByPitch=new Map();for(const note of charts[level]){
    assert.ok(events.some(e=>e.time===note.time&&e.pitch===note.pitch));
    if(laneByPitch.has(note.pitch))assert.equal(note.lane,laneByPitch.get(note.pitch));
    else laneByPitch.set(note.pitch,note.lane);
  }
  }
  assert.equal(new Set(charts.expert.map(n=>n.lane)).size,5);
});
