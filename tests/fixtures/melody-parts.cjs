// Independently synthesize labeled audio, never chart-builder events as output.
const sampleRate=22050;
function melody(instrument,{vibrato=0,legato=false}={}){
  const pitches=instrument==='bass'?[28,31,35,40,43,35,35,28]:[60,64,67,69,72,67,67,60];
  const times=legato?[.5,1.1,1.7,2.3,2.9,3.5,4.1,4.7]:[.5,1.23,2.04,2.81,3.65,4.42,5.26,6.04];
  const samples=new Float32Array(sampleRate*8),expected=[];
  for(let j=0;j<pitches.length;j++){
    const start=times[j],duration=legato?.6:.43,pitch=pitches[j],hz=440*2**((pitch-69)/12);let phase=0;
    expected.push({time:start,pitch,duration});
    for(let i=0;i<Math.round(duration*sampleRate);i++){
      const t=i/sampleRate;
      phase+=2*Math.PI*hz*2**(vibrato*Math.sin(2*Math.PI*5.2*t)/12)/sampleRate;
      const attack=Math.min(1,t/(legato?.002:.009)),release=Math.min(1,(duration-t)/(legato?.002:.024));
      const env=attack*release*(instrument==='bass'?Math.exp(-t*2):1);
      let value=0;for(let h=1;h<=7;h++)value+=Math.sin(phase*h)/(h*h*.8+.2);
      samples[Math.round(start*sampleRate)+i]+=.3*env*value;
    }
  }
  return {samples,sampleRate,expected};
}
function noise(){const samples=new Float32Array(sampleRate*6);let seed=19;for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=.2*(seed/2147483648-1);}return {samples,sampleRate};}
function fullBand({bassLevel=1,vocalLevel=.8,guitarLevel=.35,drumLevel=.4,vibrato=.25,variant=0}={}){
  const bass=melody('bass'),vocals=melody('vocals',{vibrato}),irregular=require('./independent-timing.cjs').irregular;
  const guitar=irregular('guitar',.21,variant),drums=irregular('drums',0,variant);
  const duration=bass.samples.length/sampleRate;
  return {sampleRate,samples:Float32Array.from(bass.samples,(v,i)=>v*bassLevel+vocals.samples[i]*vocalLevel+guitar.samples[i]*guitarLevel+drums.samples[i]*drumLevel),truth:{bass:bass.expected,vocals:vocals.expected,guitar:guitar.truth.filter(n=>n.time<duration),drums:drums.truth.filter(n=>n.time<duration)}};
}
module.exports={melody,noise,fullBand,sampleRate};
