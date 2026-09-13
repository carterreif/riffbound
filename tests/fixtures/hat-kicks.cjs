// Labeled closed/open hats, red-only rolls, hats over tom tails,
// quiet 90 ms kick repeats, a kick + hat chord, and deliberate rests.
function fixture(seed=83){
 const sampleRate=22050,samples=new Float32Array(sampleRate*28),expected=[];const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 function hit(time,lane,gain=1,decay=65){expected.push({time,lane});let low=0;for(let i=0;i<sampleRate*.6;i++){const t=i/sampleRate,r=noise();low+=.5*(r-low);const x=lane===1?(r-low)*.2*Math.exp(-t*decay):lane===0?(.25*r+.25*Math.sin(2*Math.PI*190*t))*Math.exp(-t*24):lane===5?.7*Math.sin(2*Math.PI*54*t)*Math.exp(-t*18):.5*Math.sin(2*Math.PI*(lane===2?168:89)*t)*Math.exp(-t*9)+.004*r*Math.exp(-t*40);samples[Math.round(time*sampleRate)+i]+=x*gain;}}
 for(let bar=0;bar<8;bar++){const s=.75+bar*3.2;hit(s,1,1);hit(s+.15,1,.5);hit(s+.3,1,1,15);hit(s+.75,0);hit(s+.875,0,.6);hit(s+1.2,2);hit(s+1.35,1,.6);hit(s+1.5,4);hit(s+1.65,1,.6);hit(s+2,5);hit(s+2.09,5,.5);hit(s+2.18,5,.7);hit(s+2.27,5,1);hit(s+2.27,1);}
 return {samples,sampleRate,expected};
}
module.exports={fixture};
