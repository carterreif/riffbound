const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {fixture}=require('./fixtures/hat-kicks.cjs');
const {measureChart}=require('./chart-metrics.cjs');
const E=require('../dist/engine.js');

for(const seed of [83,927])test(`open hi-hats stay yellow and quiet double kicks survive (${seed})`,t=>{
  const input=fixture(seed),result=analyze({...input,instrument:'drums'});
  for(const level of ['normal','expert']){
    const metrics=measureChart(input.expected,result.charts.drums[level]);
    for(const m of metrics){
      assert.equal(m.missed,0,`${level}: missing lane ${m.lane}`);
      assert.equal(m.extra,0,`${level}: false lane ${m.lane}`);
    }
    t.diagnostic(`${level}: ${metrics.map(m=>`lane ${m.lane}: ${m.matched}/${m.expected}, ${m.extra} extras`).join('; ')} (30 ms).`);
  }
});

test('demo hi-hats and rides follow the same color contract as uploaded charts',()=>{
  for(const note of E.makeDrumEvents()){
    if(['hat','openHat'].includes(note.voice))assert.equal(note.lane,1);
    if(['ride','crash'].includes(note.voice))assert.equal(note.lane,3);
    if(note.voice==='kick')assert.equal(note.lane,5);
  }
  const expert=E.makeDrumEvents();
  for(const level of E.Difficulties.LEVELS){
    assert.equal(E.Difficulties.frets('drums',level),5,'Every physical drum pad remains accessible');
    for(const note of E.makeChart(level,'drums'))assert.ok(expert.some(n=>n.time===note.time&&n.lane===note.lane&&n.voice===note.voice),'Difficulty must not recolor a drum strike');
  }
});

test('a fast drum or kick tap judges the nearest strike without stealing its earlier neighbor',()=>{
  for(const lane of [0,1,2,3,4,5]){
    const s=new E.Session('normal','tap','drums',{notes:[{lane,time:1,duration:0},{lane,time:1.09,duration:0}],musicEnd:2});
    assert.equal(s.tap(lane,1.09),true);
    assert.equal(s.notes[0].hit,false);assert.equal(s.notes[1].hit,true);
    assert.equal(s.hits,1);assert.equal(s.perfect,1);
  }
});
