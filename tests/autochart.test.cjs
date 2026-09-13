const test=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const E=require('../dist/engine.js');
const M=require('../dist/performance-motion.js');

function recording(shift=0){
  const sampleRate=22050,duration=24,samples=new Float32Array(sampleRate*duration),attacks=[];let seed=19;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  for(let beat=0;beat<88;beat++){
    const time=.5+beat*.25+shift;if(time>=10&&time<13)continue;attacks.push(time);
    const frequency=[220,277.18,329.63,440,554.37][beat%5];
    for(let i=0;i<sampleRate*.16;i++){
      const t=i/sampleRate;let sound=Math.sin(2*Math.PI*frequency*t)*Math.exp(-t*30)*.24;
      if(beat%2===0)sound+=Math.sin(2*Math.PI*65*t)*Math.exp(-t*40)*.5;
      if(beat%4===2)sound+=noise()*Math.exp(-t*50)*.3;
      sound+=noise()*Math.exp(-t*110)*.12;samples[Math.round(time*sampleRate)+i]+=sound;
    }
  }
  return {samples,sampleRate,attacks};
}
const audio=recording(),guitarResult=analyze({...audio,instrument:'guitar'}),drumsResult=analyze({...audio,instrument:'drums'});
const result={...guitarResult,charts:{...guitarResult.charts,...drumsResult.charts}};

test('audio-derived notes follow measured attacks and leave silence empty',()=>{
  assert.ok(Math.abs(result.bpm-120)<=2,`Detected ${result.bpm} BPM`);
  const notes=result.charts.guitar.expert;
  const errors=notes.map(n=>Math.min(...audio.attacks.map(t=>Math.abs(t-n.time))));
  assert.ok(Math.max(...errors)<.06);
  assert.ok(audio.attacks.filter(t=>notes.some(n=>Math.abs(t-n.time)<.06)).length/audio.attacks.length>.85);
  assert.equal(notes.filter(n=>n.time>10.3&&n.time<12.9).length,0);
  assert.ok(new Set(notes.map(n=>n.lane)).size>=4);
  const shifted=analyze(recording(.137));
  assert.ok(Math.abs(shifted.charts.guitar.normal[0].time-result.charts.guitar.normal[0].time-.137)<.025);
});

test('all instrument/difficulty charts are playable and immutable across replays',()=>{
  for(const instrument of ['guitar','drums']){
    assert.ok(result.charts[instrument].easy.length<result.charts[instrument].normal.length);
    assert.ok(result.charts[instrument].expert.length>=result.charts[instrument].normal.length);
    for(const difficulty of ['easy','medium','hard','expert']){
      const notes=result.charts[instrument][difficulty],seen=new Set();assert.ok(notes.length>8);
      notes.forEach((n,i)=>{
        assert.ok(Number.isFinite(n.time)&&n.time>=0&&n.time<result.duration);
        assert.ok(n.duration>=0&&n.time+n.duration<=result.duration);
        assert.ok(Number.isInteger(n.lane)&&n.lane>=0&&n.lane<=(instrument==='drums'?5:4));
        if(difficulty==='easy')assert.ok(result.charts[instrument].expert.some(e=>Math.abs(e.time-n.time)<.001&&(instrument==='drums'?e.lane===n.lane:e.pitch===n.pitch)),'Difficulty must preserve timing and instrument/pitch identity');
        if(i)assert.ok(notes[i-1].time<=n.time);
        const key=n.time+':'+n.lane;assert.ok(!seen.has(key));seen.add(key);
      });
      const before=JSON.stringify(notes),session=new E.Session(difficulty,'tap',instrument,{notes,musicEnd:result.duration});
      for(const n of notes){session.tap(n.lane,n.time);session.update(n.time,new Set([n.lane]));}
      session.update(result.duration+1,new Set());
      assert.equal(session.hits,notes.length);assert.equal(session.misses,0);assert.equal(JSON.stringify(notes),before);
      const replay=new E.Session(difficulty,'tap',instrument,{notes,musicEnd:result.duration});assert.ok(replay.notes.every(n=>!n.hit&&!n.missed));
    }
  }
});

test('silent, short and invalid recordings report a useful error',()=>{
  assert.throws(()=>analyze({samples:new Float32Array(22050*10),sampleRate:22050}),/silent|quiet/);
  assert.throws(()=>analyze({samples:new Float32Array(22050*2),sampleRate:22050}),/5 seconds/);
  assert.throws(()=>analyze({samples:[0],sampleRate:22050}),/could not be analyzed/);
});

test('uploaded-song duration and percussion drive scoring and stage motion',()=>{
  const session=new E.Session('normal','tap','guitar',{notes:[{lane:0,time:100,duration:0}],musicEnd:120});
  session.tap(0,100);assert.equal(session.hits,1);session.overstrum(101);assert.equal(session.streak,0);
  const options={state:'playing',time:100,beatDuration:.5,duration:121,percussion:{left:[{time:100}],right:[]}};
  const motion=M.sample(options);assert.equal(motion.beat,200);assert.ok(motion.leftStrike>.99);assert.equal(motion.rightStrike,0);
  assert.equal(M.sample({...options,state:'finished'}).clock,121);
  assert.equal(E.makeChart('normal','guitar').length,199);
  assert.equal(E.makeChart('normal','drums').length,335);
});
