/* Fixed-shape Demucs overlap-add. Input/output use Riffbound's 22,050 Hz mono timeline. */
(function(root){
 'use strict';
 const SEGMENT=343980,OVERLAP=85995,STRIDE=SEGMENT-OVERLAP,ROWS={drums:0,bass:1,vocals:3,guitar:4};
 async function separate(samples,parts,infer,{segment=SEGMENT,overlap=OVERLAP,onProgress=()=>{}}={}){
  if(!(samples instanceof Float32Array)||!samples.length||samples.length>22050*900||samples.some(v=>!Number.isFinite(v)))throw Error('Unsupported separation audio.');
  if(!parts.length||parts.some(p=>ROWS[p]===undefined)||new Set(parts).size!==parts.length)throw Error('Unsupported separation instruments.');
  const stride=segment-overlap,total=samples.length*2,weights=new Float32Array(samples.length),outputs=Object.fromEntries(parts.map(p=>[p,new Float32Array(samples.length)]));
  const count=Math.ceil(total/stride),mix=new Float32Array(segment*2);
  for(let index=0;index<count;index++){
   const start=index*stride,length=Math.min(segment,total-start);mix.fill(0);
   for(let i=0;i<length;i++){const at=(start+i)/2,lo=Math.floor(at),fraction=at-lo,value=samples[lo]*(1-fraction)+(samples[Math.min(lo+1,samples.length-1)]||0)*fraction;mix[i]=mix[segment+i]=value;}
   const result=await infer(mix,segment);
   if(!(result instanceof Float32Array)||result.length!==6*2*segment)throw Error('The separation model returned an unsupported stem layout.');
   // Global even sample positions preserve the original analysis clock across odd strides.
   for(let i=start%2;i<length;i+=2){const at=(start+i)/2,w=Math.min(1,(i+.5)/overlap,(segment-i-.5)/overlap);weights[at]+=w;
    for(const part of parts){const offset=ROWS[part]*2*segment,value=(result[offset+i]+result[offset+segment+i])*.5;if(!Number.isFinite(value))throw Error('The separation model returned invalid audio.');outputs[part][at]+=value*w;}
   }
   onProgress((index+1)/count*100);
  }
  for(const values of Object.values(outputs))for(let i=0;i<values.length;i++)values[i]/=Math.max(weights[i],1e-9);
  return outputs;
 }
 const api={separate,SEGMENT,ROWS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffStemSeparationCore=api;
})(typeof self!=='undefined'?self:globalThis);
