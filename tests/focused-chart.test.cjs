const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {audibleTime}=require('../dist/audio-clock.js');

function separateAttacks({guitar=true,drums=true}={}){
  const sampleRate=22050,samples=new Float32Array(sampleRate*16),attacks={guitar:[],drums:[]};let seed=33;
  if(drums)for(let time=.5;time<15;time+=.5){
    attacks.drums.push(time);
    for(let i=0;i<sampleRate*.14;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate;samples[Math.round(time*sampleRate)+i]+=(Math.sin(2*Math.PI*65*t)*.5+(seed/2147483648-1)*.2)*Math.exp(-t*40);}
  }
  if(guitar)for(let time=.75,j=0;time<15;time+=.5,j++){
    attacks.guitar.push(time);
    for(let i=0;i<sampleRate*.4;i++){const t=i/sampleRate,f=[220,277.18,329.63,440][j%4];samples[Math.round(time*sampleRate)+i]+=(Math.sin(2*Math.PI*f*t)+.4*Math.sin(4*Math.PI*f*t))*.35*Math.min(1,t*600)*Math.exp(-t*8);}
  }
  return {samples,sampleRate,attacks};
}

test('selected charts distinguish interleaved tonal and percussive attacks',()=>{
  const audio=separateAttacks();
  for(const instrument of ['guitar','drums']){
    const result=analyze({...audio,instrument});assert.deepEqual(Object.keys(result.charts),[instrument]);
    const notes=result.charts[instrument].expert,target=audio.attacks[instrument];
    const aligned=notes.filter(n=>target.some(t=>Math.abs(n.time-t)<.055));
    assert.ok(aligned.length/notes.length>.95,`${instrument} included attacks from the other instrument`);
    assert.ok(target.filter(t=>notes.some(n=>Math.abs(n.time-t)<.055)).length/target.length>.85);
    if(instrument==='guitar'){
      assert.equal(new Set(notes.map(n=>n.time)).size,notes.length,'Loudness must not generate extra chord notes');
      const lanes=target.map(t=>notes.find(n=>Math.abs(n.time-t)<.055)?.lane);
      for(let i=4;i<lanes.length;i++)assert.equal(lanes[i],lanes[i%4],'Repeated pitches should use consistent lanes');
    }
  }
});

test('missing instrument evidence reports a limitation instead of fabricating another part',()=>{
  assert.throws(()=>analyze({...separateAttacks({guitar:false}),instrument:'guitar'}),/Not enough clear/);
  assert.throws(()=>analyze({...separateAttacks({drums:false}),instrument:'drums'}),/Not enough clear/);
});

test('playback clock follows output timestamps and falls back to reported device latency',()=>{
  const context={currentTime:10,baseLatency:.02,outputLatency:.1,getOutputTimestamp:()=>({contextTime:9.82,performanceTime:1000})};
  assert.ok(Math.abs(audibleTime(context,1030)-9.85)<1e-9);
  assert.ok(Math.abs(audibleTime({...context,getOutputTimestamp:undefined},1030)-9.88)<1e-9);
  assert.equal(audibleTime({currentTime:0,baseLatency:.02,outputLatency:.1},0),0);
  assert.ok(Math.abs(audibleTime(context,1700)-9.88)<1e-9,'Ignore a stale output timestamp');
});
