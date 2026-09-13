// Labeled audio, independent of the detector: cymbals with snare/kick attacks,
// quieter hats in the wash, genuine hat/body chords and snare-only pairs.
function fixture(seed=712){
  const sampleRate=22050,samples=new Float32Array(sampleRate*26),truth=[];
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  function hit(time,lane,gain=1){
    truth.push({time,lane});let low=0;const start=Math.round(time*sampleRate);
    for(let i=0;i<sampleRate*1.4&&start+i<samples.length;i++){
      const t=i/sampleRate,r=noise();low+=.45*(r-low);
      const value=lane===0?(r*.28+Math.sin(2*Math.PI*195*t)*.3)*Math.exp(-t*24):
        lane===1?(r-low)*.22*Math.exp(-t*65):
        lane===5?Math.sin(2*Math.PI*54*t)*.65*Math.exp(-t*18):
        (r-low)*.2*Math.exp(-t*4);
      samples[start+i]+=value*gain;
    }
  }
  for(let bar=0;bar<8;bar++){
    const s=.65+bar*3;
    hit(s,bar%2?5:0);hit(s,3);
    hit(s+.25,1,.35);hit(s+.5,1);hit(s+.5,5);
    hit(s+.75,0);hit(s+.75,1);hit(s+1,1,.6);
    hit(s+1.3,3,.8);hit(s+1.55,1,.4);
    hit(s+1.85,0);hit(s+1.97,0,.65);
    hit(s+2.3,1);hit(s+2.3,5);
  }
  return {samples,sampleRate,truth};
}

// Ringing cymbals deliberately fluctuate without new stick strikes. Optional
// real hats elsewhere ensure their presence cannot license hats in the wash.
function wash(seed=543,withHats=false){
  const sampleRate=22050,samples=new Float32Array(sampleRate*18),truth=[];
  let hatSeed=seed+921;
  for(let j=0;j<8;j++){
    const time=.5+j*2;truth.push({time,lane:3});let low=0;
    for(let i=0;i<sampleRate*1.7;i++){
      const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const r=seed/2147483648-1;low+=.4*(r-low);
      samples[Math.round(time*sampleRate)+i]+=(r-low)*.2*Math.exp(-t*3.5)*(1+.2*Math.sin(2*Math.PI*17*t));
    }
    if(withHats){
      const hatTime=time+1.75;truth.push({time:hatTime,lane:1});low=0;
      for(let i=0;i<sampleRate*.12;i++){
        hatSeed=(Math.imul(hatSeed,1664525)+1013904223)>>>0;
        const r=hatSeed/2147483648-1;low+=.4*(r-low);
        samples[Math.round(hatTime*sampleRate)+i]+=(r-low)*.2*Math.exp(-65*i/sampleRate);
      }
    }
  }
  return {samples,sampleRate,truth};
}
module.exports={fixture,wash};
