// Independently labeled resonant hits. Quiet strokes can partly cancel the
// preceding vibration; the short stick transient still marks a real hit.
function fill({rack=175,floor=89,stick=.04,spacing=.12,tail=9,count=24,seed=619,voice=null}={}){
  const sampleRate=22050,samples=new Float32Array(Math.ceil(sampleRate*(4+count*spacing))),truth=[];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  for(let j=0;j<count;j++){
    const lane=voice??(j%6<3?2:4),frequency=lane===2?rack:floor,time=.7+j*spacing,gain=j%3===1?.45:1;
    truth.push({time,lane});
    for(let i=0;i<sampleRate*1.4;i++){
      const t=i/sampleRate,value=(.4*Math.sin(2*Math.PI*frequency*t)+.055*Math.sin(2*Math.PI*frequency*1.6*t))*Math.exp(-t*tail)+random()*stick*Math.exp(-t*65);
      samples[Math.round(time*sampleRate)+i]+=value*gain;
    }
  }
  return {samples,sampleRate,truth};
}
function ringing({lane=2,rate=13}={}){
  const sampleRate=22050,samples=new Float32Array(sampleRate*8),truth=[];let seed=823;
  for(const time of [.7,4.2]){
    truth.push({time,lane});const frequency=lane===2?175:89;
    for(let i=0;i<sampleRate*2.5;i++){
      const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=seed/2147483648-1,body=.4*Math.sin(2*Math.PI*frequency*t)*Math.exp(-t*3)*(1+.25*Math.sin(2*Math.PI*rate*t));
      samples[Math.round(time*sampleRate)+i]+=body+noise*.08*Math.exp(-t*65);
    }
  }
  return {samples,sampleRate,truth};
}
module.exports={fill,ringing};
