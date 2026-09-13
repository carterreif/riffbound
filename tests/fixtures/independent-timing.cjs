// Labeled audio for closely spaced, differently colored strikes.
function staggered(seed=133,spacing=.04){
 const sampleRate=22050,samples=new Float32Array(sampleRate*30),truth=[];
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 function hit(time,lane,gain=1){truth.push({time,lane});let low=0;
  for(let i=0;i<sampleRate*1.4&&Math.round(time*sampleRate)+i<samples.length;i++){
   const t=i/sampleRate,r=noise();low+=.45*(r-low);let v=0;
   if(lane===0)v=(r*.32+Math.sin(2*Math.PI*185*t)*.24)*Math.exp(-t*23);
   if(lane===1)v=(r-low)*.22*Math.exp(-t*65);
   if(lane===2||lane===4){const hz=lane===2?168:91;v=(Math.sin(2*Math.PI*hz*t)*.5+Math.sin(2*Math.PI*hz*1.7*t)*.055)*Math.exp(-t*9)+r*.004*Math.exp(-t*40);}
   if(lane===3)v=(r-low)*.25*Math.exp(-t*4);
   if(lane===5)v=Math.sin(2*Math.PI*53*t)*.7*Math.exp(-t*19);
   samples[Math.round(time*sampleRate)+i]+=v*gain;
  }
 }
 // Isolated, irregular strikes establish every voice independently.
 for(let j=0;j<18;j++)hit(.7+j*.46+(j%3)*.019,j%6);
 const pairs=[[5,1],[2,1],[4,1],[0,1],[1,5],[1,2],[1,4],[1,0],[3,0],[0,3],[2,4],[4,2]];
 for(let j=0;j<pairs.length;j++){
  const t=10+j*1.5+(j%3)*.027;
  hit(t,pairs[j][0]);hit(t+spacing,pairs[j][1]);
 }
 return {samples,sampleRate,truth};
}

function irregular(instrument='drums',shift=0,variant=0){
 const sampleRate=22050,samples=new Float32Array(sampleRate*27),truth=[];
 let seed=281+variant*79,time=.683+shift;
 for(let j=0;j<36;j++){
  const lane=(j*(variant?(instrument==='drums'?5:3):1))%(instrument==='drums'?6:5),pitch=[57,60,64,67,69][lane];
  truth.push({time,lane,...(instrument==='guitar'?{pitch}:{})});let low=0;
  for(let i=0;i<sampleRate*1.25&&Math.round(time*sampleRate)+i<samples.length;i++){
   const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const r=seed/2147483648-1;low+=.45*(r-low);let value=0;
   if(instrument==='guitar'){
    const hz=440*2**((pitch-69)/12);
    if(t<.3)value=(Math.sin(2*Math.PI*hz*t)+.35*Math.sin(4*Math.PI*hz*t))*.3*Math.min(1,t*500)*Math.exp(-t*9);
   }else{
    if(lane===0)value=(r*.32+Math.sin(2*Math.PI*185*t)*.24)*Math.exp(-t*23);
    if(lane===1)value=(r-low)*.22*Math.exp(-t*65);
    if(lane===2||lane===4){const hz=lane===2?168:91;value=(Math.sin(2*Math.PI*hz*t)*.5+Math.sin(2*Math.PI*hz*1.7*t)*.055)*Math.exp(-t*9)+r*.004*Math.exp(-t*40);}
    if(lane===3)value=(r-low)*.25*Math.exp(-t*4);
    if(lane===5)value=Math.sin(2*Math.PI*53*t)*.7*Math.exp(-t*19);
   }
   samples[Math.round(time*sampleRate)+i]+=value;
  }
  // Unequal intervals, changes in pace, and a genuine rest; no common grid.
  time+=[.437,.683,.521,.769,.593][(j+variant)%5]+(j===17?1.31:0);
 }
 return {samples,sampleRate,truth};
}
module.exports={staggered,irregular};
