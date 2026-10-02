// Independent truth: metal strikes over a bass drum and a low pitched part.
// The pitched part is accompaniment, not an additional snare or tom strike.
function fixture(seed=37,hatDecay=35,tone=.2){
  const sampleRate=22050,samples=new Float32Array(sampleRate*16),truth=[];
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  for(let j=0;j<24;j++){
    const time=.6+j*.6,lane=j%4===3?3:1;
    truth.push({time,lane},{time,lane:5});let low=0;
    for(let i=0;i<sampleRate*.55;i++){
      const t=i/sampleRate,r=noise();low+=.45*(r-low);
      const metal=(r-low)*.45*Math.exp(-t*(lane===1?hatDecay:4));
      const kick=.75*Math.sin(2*Math.PI*55*t)*Math.exp(-t*18);
      const backing=tone*Math.sin(2*Math.PI*164*t)*Math.exp(-t*8);
      samples[Math.round(time*sampleRate)+i]+=metal+kick+backing;
    }
  }
  return {sampleRate,samples,truth};
}
module.exports={fixture};
