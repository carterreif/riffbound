// Independently labeled hits: tom/hat alternation, snare rolls, crashes and quiet repeats.
function fixture(seed=827,hatVolume=.22){
 const sampleRate=22050,samples=new Float32Array(sampleRate*24),truth=[];
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 function hit(time,lane,gain=1){truth.push({time,lane});let low=0;
  for(let i=0;i<sampleRate*1.4;i++){const t=i/sampleRate,r=noise();low+=.45*(r-low);let v=0;
   if(lane===0)v=(r*.32+Math.sin(2*Math.PI*185*t)*.24)*Math.exp(-t*23);
   if(lane===1)v=(r-low)*hatVolume*Math.exp(-t*65);
   if(lane===2||lane===4){const hz=lane===2?168:91;v=(Math.sin(2*Math.PI*hz*t)*.5+Math.sin(2*Math.PI*hz*1.7*t)*.055)*Math.exp(-t*9)+r*.004*Math.exp(-t*40);}
   if(lane===3)v=(r-low)*.25*Math.exp(-t*4);
   if(lane===5)v=Math.sin(2*Math.PI*53*t)*.7*Math.exp(-t*19);
   if(Math.round(time*sampleRate)+i<samples.length)samples[Math.round(time*sampleRate)+i]+=v*gain;
  }
 }
 for(let bar=0;bar<6;bar++){
  const time=.7+bar*3.6;
  // Hats between/after toms must not inherit the ringing pitched body.
  for(const [offset,lane,gain] of [[0,2,1],[.15,1,1],[.3,2,.45],[.45,1,.6],[.6,4,1],[.75,1,1],[.9,4,.45],[1.05,1,.6],[1.2,0,1],[1.32,0,.65],[1.44,0,.65],[1.56,0,1],[1.68,2,1],[1.8,2,.6],[1.92,4,1],[2.04,4,.6],[2.3,3,.8],[2.55,1,1],[2.8,5,1]])hit(time+offset,lane,gain);
 }
 return {samples,sampleRate,truth};
}
module.exports={fixture};
