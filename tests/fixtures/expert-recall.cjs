// Generate labeled audio independently of the chart algorithm.
const sampleRate=22050;
function rapid(instrument,spacing=.08,changing=false){
 const samples=new Float32Array(sampleRate*6),truth=[];
 const base=instrument==='bass'?45:57;
 for(let j=0;j<24;j++){
  const pitch=changing?[57,60,64,67,69][j%5]:base,hz=440*2**((pitch-69)/12),time=.6+j*spacing,duration=spacing-.01;
  truth.push({time,pitch});
  for(let i=0;i<duration*sampleRate;i++){
   const t=i/sampleRate,envelope=Math.min(1,t/.006)*Math.min(1,(duration-t)/.008);
   samples[Math.round(time*sampleRate)+i]=.35*envelope*(Math.sin(2*Math.PI*hz*t)+.25*Math.sin(4*Math.PI*hz*t));
  }
 }
 return {samples,sampleRate,truth};
}
function sparse(instrument,lane=0){
 const samples=new Float32Array(sampleRate*7),time=1.1,pitch=instrument==='bass'?40:64,hz=440*2**((pitch-69)/12);let seed=619,low=0;
 for(let i=0;i<sampleRate*1.4;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/2147483648-1;low+=.45*(noise-low);let value=0;
  if(instrument!=='drums')value=t<.4?.35*Math.min(1,t/.009)*Math.min(1,(.4-t)/.024)*(Math.sin(2*Math.PI*hz*t)+.25*Math.sin(4*Math.PI*hz*t)):0;
  else if(lane===0)value=(noise*.3+Math.sin(2*Math.PI*195*t)*.25)*Math.exp(-t*24);
  else if(lane===1)value=(noise-low)*.2*Math.exp(-t*65);
  else if(lane===2||lane===4)value=.5*Math.sin(2*Math.PI*(lane===2?168:89)*t)*Math.exp(-t*9)+noise*.004*Math.exp(-t*40);
  else if(lane===3)value=(noise-low)*.2*Math.exp(-t*4);
  else value=.65*Math.sin(2*Math.PI*54*t)*Math.exp(-t*18);
  samples[Math.round(time*sampleRate)+i]=value;
 }
 return {samples,sampleRate,truth:[{time,...(instrument==='drums'?{lane}:{pitch})}]};
}
module.exports={rapid,sparse};
