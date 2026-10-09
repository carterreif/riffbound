// Labeled soft strikes, generated independently of detection and reduction.
const F=require('./expert-recall.cjs');
function fixture(instrument='drums',lane=0,gain=.08,spacing=.23){
  const source=F.sparse(instrument,lane),sampleRate=source.sampleRate;
  const samples=new Float32Array(sampleRate*Math.ceil(.62+24*spacing+1)),truth=[];
  const pitch=instrument==='bass'?40:64,hz=440*2**((pitch-69)/12);
  for(let j=0;j<24;j++){
    const time=.62+j*spacing,volume=j%3===1?gain:1;
    truth.push({time,...(instrument==='drums'?{lane}:{pitch}),quiet:volume<1});
    for(let i=0;i<sampleRate*.6;i++){
      let value=source.samples[Math.round(1.1*sampleRate)+i];
      if(instrument!=='drums'){
        const t=i/sampleRate;
        value=t<.13?.35*Math.min(1,t/.006)*Math.min(1,(.13-t)/.015)*(Math.sin(2*Math.PI*hz*t)+.25*Math.sin(4*Math.PI*hz*t)):0;
      }
      samples[Math.round(time*sampleRate)+i]+=value*volume;
    }
  }
  return {samples,sampleRate,truth};
}
module.exports={fixture};
