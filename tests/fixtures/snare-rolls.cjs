// Ground truth is recorded when mixing each voice, independently of the analyzer.
function fixture(seed=313,hatGain=0,spacing=.12){
 const sampleRate=22050,samples=new Float32Array(sampleRate*8),truth=[];
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 for(let j=0;j<40;j++){
  const time=.75+j*spacing,gain=j%4===3?.48:1;truth.push({time,lane:0});
  const hat=hatGain&&j%4===0;if(hat)truth.push({time,lane:1});
  let low=0;
  for(let i=0;i<sampleRate*.45;i++){
   const t=i/sampleRate,r=noise(),n=noise();low+=.4*(n-low);
   const snare=(r*.25*Math.exp(-t*25)+.25*Math.sin(2*Math.PI*195*t)*Math.exp(-t*18))*gain;
   const hh=hat?(n-low)*hatGain*Math.exp(-t*68):0;
   samples[Math.round(time*sampleRate)+i]+=snare+hh;
  }
 }
 return {samples,sampleRate,truth};
}
module.exports={fixture};
