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

test('R3/R5: detections anchored to one measured attack merge only their own voice',()=>{
  const attack={time:1};
  const events=[{lane:0,time:1,strength:1,attack},{lane:0,time:1.006,strength:2,attack},{lane:1,time:1,strength:.1,attack},{lane:0,time:1.025,strength:.1}];
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

for(const instrument of ['drums','guitar','bass','vocals'])test(`${instrument}: Expert keeps every distinct accepted event without a spacing or loudness cap`,()=>{
  const events=[];
  for(let i=0;i<10;i++){
    const time=1+i*.4;
    if(instrument==='drums'){
      for(let lane=0;lane<6;lane++)events.push({time,lane,strength:.001});
      events.push({time:time+.006,lane:0,strength:2},{time:time+.010,lane:5,strength:.00001});
    }else{
      events.push({time,pitch:52+i%5*4,strength:.001},{time:time+.006,pitch:52+i%5*4,strength:2},{time:time+.010,pitch:69,strength:.00001});
    }
  }
  const original=JSON.stringify(events),key=n=>`${n.time}:${instrument==='drums'?n.lane:n.pitch}`;
  const expected=events.map(key).sort();
  for(const beat of [.25,.8]){
    const charts=build(events.slice().reverse(),instrument,beat);
    assert.equal(charts.expert.length,events.length);assert.deepEqual(charts.expert.map(key).sort(),expected);
    let parent=charts.expert;
    for(const level of ['hard','medium','easy']){
      assert.ok(charts[level].length<=parent.length);assert.ok(charts[level].length<charts.expert.length);
      const source=new Set(parent.map(key));for(const note of charts[level])assert.ok(source.has(key(note)));
      parent=charts[level];
    }
    assert.equal(JSON.stringify(events),original);
  }
});

test('Expert suppresses exact duplicate detections without merging concurrent pitches or drum voices',()=>{
  const drums=build([{time:1,lane:0,strength:1},{time:1,lane:0,strength:2},{time:1,lane:1,strength:1},{time:1.006,lane:0,strength:.01}]);
  assert.deepEqual(identity(drums.expert),[{time:1,lane:0},{time:1,lane:1},{time:1.006,lane:0}]);
  for(const instrument of ['guitar','bass','vocals']){
    const chart=build([{time:1,pitch:52,strength:1},{time:1,pitch:52,strength:2},{time:1,pitch:69,strength:1},{time:1.006,pitch:52,strength:.01}],instrument).expert;
    assert.deepEqual(chart.map(({time,pitch})=>({time,pitch})),[{time:1,pitch:52},{time:1,pitch:69},{time:1.006,pitch:52}]);
  }
});


test('shared body/treble detections of one hi-hat merge, but two measured hi-hats stay separate',()=>{
  const attack={time:1},hatAttack={time:1.002};
  const same=[{time:1.001,lane:1,strength:2,attack,hatAttack},{time:1.0015,lane:1,strength:1,attack}];
  assert.equal(build(same).expert.length,1);
  const distinct=[{time:1.001,lane:1,strength:2,attack,hatAttack},{time:1.007,lane:1,strength:1,attack,hatAttack:{time:1.008}}];
  assert.equal(build(distinct).expert.length,2);
  const recolored=[{time:1.001,lane:2,strength:2,attack,hatAttack},{time:1.0015,lane:2,strength:1,attack}];
  assert.equal(build(recolored).expert.length,1,'An old hi-hat label must not duplicate a corrected tom');
});
