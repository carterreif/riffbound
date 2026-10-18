// Fast damped distorted strings, with optional independent drum strikes.
// The note times and voices below are audio ground truth, not analyzer output.
function fixture({decay=24,percussion=false,seed=413}={}){
 const sampleRate=22050,samples=new Float32Array(sampleRate*24),guitar=[],drums=[];
 for(let j=0;j<126;j++){
  const time=.5+j*.18,hz=[82.41,98,110,146.83,164.81,196][j%6];guitar.push({time,hz});
  for(let i=0;i<sampleRate*.36&&Math.round(time*sampleRate)+i<samples.length;i++){
   const t=i/sampleRate;let value=0;for(let h=1;h<=8;h++)value+=Math.sin(2*Math.PI*hz*h*t)/(h**1.15);
   samples[Math.round(time*sampleRate)+i]+=.3*Math.tanh(value*2)*Math.min(1,t*700)*Math.exp(-t*decay);
  }
 }
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 if(percussion)for(let j=0;j<30;j++){
  const time=.59+j*.72,lane=[5,0,1,2,4,3][j%6];drums.push({time,lane});let low=0;
  for(let i=0;i<sampleRate*1.2&&Math.round(time*sampleRate)+i<samples.length;i++){
   const t=i/sampleRate,r=noise();low+=.45*(r-low);let value=0;
   if(lane===5)value=Math.sin(2*Math.PI*53*t)*.7*Math.exp(-t*19);
   if(lane===0)value=(r*.32+Math.sin(2*Math.PI*185*t)*.24)*Math.exp(-t*23);
   if(lane===1)value=(r-low)*.22*Math.exp(-t*65);
   if(lane===3)value=(r-low)*.25*Math.exp(-t*4);
   if(lane===2||lane===4){const hz=lane===2?168:91;value=(Math.sin(2*Math.PI*hz*t)*.5+Math.sin(2*Math.PI*hz*1.7*t)*.055)*Math.exp(-t*9)+r*.004*Math.exp(-t*40);}
   samples[Math.round(time*sampleRate)+i]+=value;
  }
 }
 return {samples,sampleRate,guitar,drums};
}
module.exports={fixture};
