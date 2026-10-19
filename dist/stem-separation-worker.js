import './stem-separation-core.js';
const MODEL='https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/49df9b6989cf2150840ea65b0bef77a2e471b678/htdemucs_6s_fp16weights.onnx';
const HASH='7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869',SIZE=136428532;
const RUNTIME='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
const progress=(value,label)=>postMessage({type:'progress',value,label});
async function modelBytes(){
 let cache;try{cache=await caches.open('riffbound-demucs-6s-49df9b6');}catch{}
 let response=await cache?.match(MODEL),cached=!!response;
 if(!response)response=await fetch(MODEL,{credentials:'omit',signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('The separation model could not download. Connect to the internet and retry.');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>SIZE)throw Error('Unexpected separation model size.');chunks.push(value);progress(length/SIZE*100,`${cached?'Reading':'Downloading'} instrument model · ${Math.round(length/1024/1024)} / 130 MiB…`);}}finally{await reader.cancel().catch(()=>{});}
 if(length!==SIZE)throw Error('The separation model download was incomplete.');
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==HASH){await cache?.delete(MODEL);throw Error('Separation model verification failed. Retry the download.');}
 if(!cached)try{await cache?.put(MODEL,new Response(bytes));}catch{}
 return bytes;
}
self.onmessage=async({data})=>{
 let session;
 try{
  progress(0,'Loading instrument separation · audio stays on this device…');
  const ort=await import(RUNTIME+'ort.min.mjs');ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=RUNTIME;
  const bytes=await modelBytes();progress(0,'Preparing instrument model. This may take a minute…');
  session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'disabled',enableCpuMemArena:false,enableMemPattern:false,extra:{session:{disable_prepacking:'1'}}});
  const stems=await self.RiffStemSeparationCore.separate(data.samples,data.parts,async(mix,n)=>{
   const input=new ort.Tensor('float32',mix,[1,2,n]);let output;
   try{output=await session.run({mix:input});return Float32Array.from(output.stems.data);}finally{input.dispose();if(output)for(const tensor of Object.values(output))tensor.dispose();}
  },{onProgress:value=>progress(value,`Isolating instruments · ${Math.round(value)}% · Cancel is available…`)});
  postMessage({type:'complete',stems,model:'htdemucs_6s',revision:'49df9b6989cf2150840ea65b0bef77a2e471b678',sha256:HASH},Object.values(stems).map(a=>a.buffer));
 }catch(error){postMessage({type:'error',message:'Instrument isolation could not finish. '+error.message+' Retry, or turn off “Isolate instruments” to use mixed-audio estimates.'});}
 finally{await session?.release();}
};
