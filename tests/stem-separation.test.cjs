const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const S=require('../dist/stem-separation-core.js');
const file=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',prefix+'\nreturn {setup,until};')(createRequire(file));
test('chunked stems keep independent rows, exact sample length and the original timeline through odd overlaps',async()=>{
 const samples=Float32Array.from({length:45},(_,i)=>i/50);let chunks=0;
 const result=await S.separate(samples,['drums','bass','vocals','guitar'],async(mix,n)=>{chunks++;const out=new Float32Array(12*n);for(let row=0;row<6;row++)for(let i=0;i<2*n;i++)out[row*2*n+i]=mix[i]*(row+1);return out;},{segment:20,overlap:5});
 assert.ok(chunks>1);for(const [part,row] of Object.entries(S.ROWS)){assert.equal(result[part].length,samples.length);for(let i=0;i<samples.length;i++)assert.ok(Math.abs(result[part][i]-samples[i]*(row+1))<1e-6,`${part} at ${i}`);}
});
test('invalid audio, unknown rows and malformed/non-finite inference output fail before a chart can be saved',async()=>{
 await assert.rejects(S.separate(new Float32Array([NaN]),['drums'],()=>{}),/Unsupported/);
 await assert.rejects(S.separate(new Float32Array([1]),['keys'],()=>{}),/Unsupported/);
 await assert.rejects(S.separate(new Float32Array([1]),['drums'],async()=>new Float32Array(1),{segment:20,overlap:5}),/layout/);
 await assert.rejects(S.separate(new Float32Array([1]),['drums'],async()=>new Float32Array(240).fill(NaN),{segment:20,overlap:5}),/invalid/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} upload separates missing parts once, preserves original audio and records per-instrument estimate provenance`,async()=>{
 let calls=0;const app=setup({mobile,chartFixture:[{time:1,lane:0,duration:0}],separationResult:({samples,parts})=>{calls++;return {stems:Object.fromEntries(parts.map((part,i)=>[part,new Float32Array(samples.length).fill(.1+i*.1)])),model:'htdemucs_6s',revision:'fixture',sha256:'fixture'};}});
 app.nodes.addIsolateInstruments.checked=true;app.nodes.chartScope.value='whole';await app.nodes.chartScope.emit('change');await app.upload('Original band.wav');await until(()=>app.savedSongs.size===1);
 const song=[...app.savedSongs.values()][0];assert.equal(calls,1);assert.deepEqual(app.requests,['guitar','drums','bass','vocals']);assert.ok(app.requestIds.every(id=>id===''));assert.ok(app.requestModes.every(value=>!value));
 for(const part of app.requests){assert.equal(song.quality.audioReviews[part].separation.model,'htdemucs_6s');assert.equal(song.quality.audioReviews[part].estimated,true);assert.match(song.quality.sources[part],/AI-separated/);}
 assert.deepEqual([...new Uint8Array(await song.audioBlob.arrayBuffer())],[1,1,2,3]);
});
test('separation failure is visible and does not silently chart the mixture or overwrite a saved song',async()=>{
 const app=setup({separationFailure:'Isolation unavailable. Turn off Isolate instruments to use mixed-audio estimates.'});app.nodes.addIsolateInstruments.checked=true;await app.upload();await until(()=>app.nodes.chartStatus.classes.has('error'));assert.equal(app.savedSongs.size,0);assert.equal(app.requests.length,0);assert.match(app.nodes.chartStatus.textContent,/Isolation unavailable/);
});
test('unchecked isolation uses the existing analysis without invoking the model',async()=>{
 const app=setup({chartFixture:[{time:1,lane:0,duration:0}],separationResult:()=>assert.fail()});app.nodes.addIsolateInstruments.checked=false;await app.upload();await until(()=>app.savedSongs.size===1);assert.deepEqual(app.requests,['guitar']);
});
test('a malformed separation response cannot chart or save a partial stem set',async()=>{
 const app=setup({separationResult:()=>({stems:{},model:'bad'})});app.nodes.addIsolateInstruments.checked=true;await app.upload();await until(()=>app.nodes.chartStatus.classes.has('error'));assert.equal(app.savedSongs.size,0);assert.equal(app.requests.length,0);assert.match(app.nodes.chartStatus.textContent,/invalid audio/);
});
test('cancel terminates isolation and keeps the previous saved setlist intact',async()=>{
 let app;app=setup({separationResult:({samples,parts})=>{app.nodes.cancelUpload.click();return {stems:Object.fromEntries(parts.map(p=>[p,samples])),model:'fixture'};}});app.nodes.addIsolateInstruments.checked=true;await app.upload();await until(()=>app.nodes.chartStatus.textContent.includes('canceled'));assert.equal(app.savedSongs.size,0);assert.equal(app.requests.length,0);
});
