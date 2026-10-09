// Independent recordings of held, smoothly modulated notes. Volume changes
// contain no re-articulation; each labeled start is the only new note.
function sustained(instrument,{rate=2}={}){
 const sampleRate=22050,samples=new Float32Array(sampleRate*14),truth=[];
 const pitches=instrument==='bass'?[40,43,45,47]:[57,60,64,67];
 for(let j=0;j<4;j++){
  const start=.5+j*3.2,duration=2.75,hz=440*2**((pitches[j]-69)/12);
  truth.push({time:start,pitch:pitches[j]});
  for(let i=0;i<duration*sampleRate;i++){
   const t=i/sampleRate,age=t;
   const envelope=Math.min(1,age/.009)*Math.min(1,(duration-t)/.03)*(.55+.45*Math.cos(2*Math.PI*rate*age));
   samples[Math.round(start*sampleRate)+i]=.3*envelope*(Math.sin(2*Math.PI*hz*t)+.2*Math.sin(4*Math.PI*hz*t));
  }
 }
 return {samples,sampleRate,truth};
}
module.exports={sustained};

// Four real crash strikes with modulated decays; the modulation is not a hit.
function cymbalTails(rate=17){
 const sampleRate=22050,samples=new Float32Array(sampleRate*7),truth=[];let seed=33;
 for(const time of [.6,2.4,4.2,5.9]){
  truth.push({time,lane:3});let low=0;
  for(let i=0;i<sampleRate*1.4&&Math.round(time*sampleRate)+i<samples.length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
   low+=.4*(noise-low);const t=i/sampleRate;
   samples[Math.round(time*sampleRate)+i]+=(noise-low)*.2*Math.exp(-t*3.5)*(1+.35*Math.sin(2*Math.PI*rate*t));
  }
 }
 return {samples,sampleRate,truth};
}
module.exports.cymbalTails=cymbalTails;
