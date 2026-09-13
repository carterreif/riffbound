// Independently labeled audio: rests, snare rolls, two rack-tom pitches,
// floor toms, kick sweeps, cymbal wash, and quieter repeated hits.
function fixture(seed=119){
 const sr=22050,samples=new Float32Array(sr*24),truth=[];
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 function hit(time,lane,gain=1,frequency=0){
  truth.push({time,lane});let low=0;
  for(let i=0;i<sr*1.5&&Math.round(time*sr)+i<samples.length;i++){
   const t=i/sr,n=noise();low+=.4*(n-low);let v;
   if(lane===5)v=.7*Math.sin(2*Math.PI*(52*t+1.4*(1-Math.exp(-t*32))))*Math.exp(-t*18);
   if(lane===0)v=(n*.25*Math.exp(-t*25)+.25*Math.sin(2*Math.PI*195*t)*Math.exp(-t*18));
   if(lane===1)v=(n-low)*.19*Math.exp(-t*68);
   if(lane===2||lane===4){const f=frequency||(lane===2?175:87);v=(.4*Math.sin(2*Math.PI*f*t)+.07*Math.sin(2*Math.PI*f*1.6*t)) * Math.exp(-t*10)+n*.008*Math.exp(-t*50);}
   if(lane===3)v=(n-low)*.17*Math.exp(-t*3.5)*(1+.2*Math.sin(2*Math.PI*17*t));
   samples[Math.round(time*sr)+i]+=v*gain;
  }
 }
 for(let j=0;j<128;j++){
  const time=.6+j*.125;
  if(j%32<24){if(j%19!==7)hit(time,1,j%4===1?.32:1);if(j%4===0)hit(time,5);if(j%4===2)hit(time,0);}
  else{const lanes=[0,0,2,2,2,4,4,5];hit(time,lanes[j%8],j%2?.65:1,lanes[j%8]===2?(j%8===2?245:175):0);}
  if(j%32===0)hit(time,3,.6);
 }
 // Sparse fill after a rest with both toms and genuine quieter repeats.
 for(let i=0;i<12;i++)hit(18+i*.105,[0,0,2,2,4,4][i%6],i%2?.45:1);
 return {samples,sampleRate:sr,truth};
}
module.exports={fixture};
