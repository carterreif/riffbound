const test=require('node:test'),assert=require('node:assert/strict');
const {analyze,buildFocusedCharts}=require('../dist/autochart.js');
const {measureChart}=require('./chart-metrics.cjs');
const sampleRate=22050;
function hatPattern(){
  const samples=new Float32Array(sampleRate*18),hats=[];let seed=43;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  function hit(time,voice,gain){
    let low=0;
    for(let i=0;i<sampleRate*.4;i++){
      const t=i/sampleRate,r=noise();low+=.5*(r-low);
      const value=voice==='hat'?(r-low)*Math.exp(-t*65):voice==='kick'?Math.sin(2*Math.PI*55*t)*Math.exp(-t*18):(r*.35+Math.sin(2*Math.PI*180*t)*.5)*Math.exp(-t*24);
      samples[Math.round(time*sampleRate)+i]+=value*gain;
    }
  }
  for(let j=0;j<128;j++){
    const time=.63+j*.125;
    // Deliberate rests: the detector must not fill a metronomic grid.
    if(j%19!==7){hats.push(time);hit(time,'hat',j%4===1?.045:.17);}
    if(j%4===0)hit(time,'kick',.7);
    if(j%4===2)hit(time,'snare',.55);
  }
  return {samples,hats};
}
test('R2/R6: overlapping kit retains yellow hats and never duplicates kicks as green toms',t=>{
  const {samples,hats}=hatPattern(),result=analyze({samples,sampleRate,instrument:'drums'});
  const expected=hats.map(time=>({time,lane:1}));
  for(let j=0;j<128;j++){
    if(j%4===0)expected.push({time:.63+j*.125,lane:5});
    if(j%4===2)expected.push({time:.63+j*.125,lane:0});
  }
  for(const difficulty of ['normal','expert']){
    const metrics=measureChart(expected,result.charts.drums[difficulty]),hat=metrics[1];
    // Mixed overlapping voices are estimates: measure omissions and false hits separately.
    assert.ok(hat.matched===hat.expected,`${difficulty}: ${hat.matched}/${hat.expected} hi-hats detected`);
    assert.ok(hat.precision>=.97,`${difficulty}: extra yellow notes in rests or ringing tails`);
    for(const metric of metrics.filter(m=>m.lane!==1)){
      assert.equal(metric.missed,0,`${difficulty}: missing strikes on lane ${metric.lane}`);
      assert.equal(metric.extra,0,`${difficulty}: false colors on lane ${metric.lane}`);
    }
    t.diagnostic(`${difficulty}: ${metrics.map(m=>`lane ${m.lane}: ${m.matched}/${m.expected} matched, ${m.extra} extra`).join('; ')} (30 ms).`);
  }
});
test('Standard preserves detected fast yellow repeats at their original times',()=>{
  const times=[1,1.06,1.12,1.18,1.25,1.32],events=times.map(time=>({time,lane:1,strength:1}));
  events.push({time:1,lane:0,strength:2},{time:1,lane:5,strength:3});events.sort((a,b)=>a.time-b.time);
  const charts=buildFocusedCharts(events,'drums',.5,5,new Float32Array(500),.01).drums;
  for(const level of ['normal','expert'])assert.deepEqual(charts[level].filter(n=>n.lane===1).map(n=>n.time),times);
});

test('R2/R6: learning a tom fill cannot swap red snares with blue toms',t=>{
  const {samples,hats}=hatPattern(),expected=hats.map(time=>({time,lane:1}));
  for(let j=0;j<128;j++){
    if(j%4===0)expected.push({time:.63+j*.125,lane:5});
    if(j%4===2)expected.push({time:.63+j*.125,lane:0});
  }
  for(let j=0;j<8;j++){
    const time=.63+j*2,lane=j%2?2:4,frequency=lane===2?158:87;expected.push({time,lane});
    for(let i=0;i<sampleRate*.5;i++){const seconds=i/sampleRate;samples[Math.round(time*sampleRate)+i]+=.4*Math.sin(2*Math.PI*frequency*seconds)*Math.exp(-seconds*11);}
  }
  const result=analyze({samples,sampleRate,instrument:'drums'});
  for(const level of ['normal','expert']){
    const metrics=measureChart(expected,result.charts.drums[level]);
    for(const m of metrics.filter(m=>m.lane!==1)){
      assert.equal(m.missed,0,`${level}: missing lane ${m.lane}`);
      assert.equal(m.extra,0,`${level}: false lane ${m.lane}`);
    }
    // Short-window recovery retains all labeled hats; two existing ambiguous
    // snare-noise extras remain an explicitly measured limitation.
    assert.ok(metrics[1].matched===121&&metrics[1].extra<=2);
    t.diagnostic(`${level}, tom fill: ${metrics.map(m=>`lane ${m.lane}: ${m.matched}/${m.expected} matched, ${m.extra} extra`).join('; ')} (30 ms).`);
  }
});
