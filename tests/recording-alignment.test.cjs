const test=require('node:test'),assert=require('node:assert/strict'),A=require('../dist/recording-alignment.js');
function noise(seconds=40,seed=1){let s=seed;return Float32Array.from({length:Math.round(seconds*22050)},()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s/2**32-.5)*.3;});}
function shift(samples,seconds,{polarity=1,duration=samples.length/22050}={}){const result=new Float32Array(Math.round(duration*22050)),delta=Math.round(seconds*22050);for(let i=0;i<samples.length;i++){const at=i+delta;if(at>=0&&at<result.length)result[at]=samples[i]*polarity;}return result;}
const noWait={yieldTask:async()=>{}};
test('actual waveform identifies early/late padding and polarity independently of note lanes',async()=>{
 const source=noise(),reference=A.features(source);
 for(const seconds of [-2.836,.713,0]){const target=A.features(shift(source,seconds,{polarity:-1})),r=await A.review(target,reference,noWait);assert.equal(r.status,'aligned');assert.ok(Math.abs(r.shiftSeconds-seconds)<.002);assert.equal(r.matchedWindows,5);}
});
test('mixed recording uses measured source correlation without confusing unrelated instruments',async()=>{
 const source=noise(),other=noise(40,2),mixed=shift(source,-.375);for(let i=0;i<mixed.length;i++)mixed[i]=mixed[i]*.65+other[i]*.8;
 const r=await A.review(A.features(mixed),A.features(source),noWait);assert.equal(r.status,'aligned');assert.ok(Math.abs(r.shiftSeconds+.375)<.002);
 assert.equal((await A.review(A.features(other),A.features(source),noWait)).status,'uncertain');
});
test('silence, sparse audio, repeated-wave beat aliases, edits and tempo drift cannot move a chart',async()=>{
 const source=noise(),empty=new Float32Array(source.length),brief=new Float32Array(source.length);brief.set(source.subarray(0,22050),22050*15);
 for(const target of [empty,brief,noise(40,9)])assert.equal((await A.review(A.features(target),A.features(source),noWait)).status,'uncertain');
 const periodic=Float32Array.from({length:source.length},(_,i)=>Math.sin(i/22050*Math.PI*2*100));assert.equal((await A.review(A.features(periodic),A.features(periodic),noWait)).status,'uncertain');
 const edited=shift(source,-.3);edited.set(shift(source,-.35).subarray(22050*22),22050*22);assert.equal((await A.review(A.features(edited),A.features(source),noWait)).status,'uncertain');
 const long=new Float32Array(source.length+2205);for(let i=0;i<long.length;i++)long[i]=source[Math.floor(i/1.0025)]||0;assert.equal((await A.review(A.features(long),A.features(source),noWait)).status,'uncertain');
});
test('stereo phase cancellation, independent stems, sample rates and cancellation are handled without changing audio',async()=>{
 const source=noise(20),opposite=Float32Array.from(source,v=>-v),before=source.slice(),buffer={duration:20,sampleRate:22050,numberOfChannels:2,length:source.length,getChannelData:i=>i?opposite:source};
 const f=A.fromBuffer(buffer);assert.deepEqual(f,A.features(source));assert.deepEqual(source,before);
 const combine=A.combine([f,f]);assert.ok(Math.abs(combine.samples[200]-f.samples[200]*2)<1e-8);
 const doubled=Float32Array.from({length:source.length*2},(_,i)=>source[Math.floor(i/2)]),resampled=A.features(doubled,44100);assert.deepEqual(resampled.samples,f.samples);
 const c=new AbortController();await assert.rejects(A.review(f,f,{yieldTask:async()=>c.abort(),signal:c.signal}),/Canceled/);
 assert.equal((await A.review(A.features(noise(8)),A.features(noise(8)),noWait)).status,'uncertain');
});
