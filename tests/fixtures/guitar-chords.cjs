// Independent played tones; the charting code never sees these labels.
const sampleRate=22050;
function recording({harmonics=[1,.35,.16],drums=false,quietSecond=false,separateReleases=false,threeTones=false}={}){
  const samples=new Float32Array(sampleRate*12),truth=[];
  const phrases=[{time:.5,duration:2.65,pitches:[52,59]},{time:3.7,duration:.65,pitches:[64]},{time:4.8,duration:1.45,pitches:[55,62]},{time:7,duration:.75,pitches:[52,59]},{time:8,duration:.9,pitches:[52,59]}];
  if(threeTones)phrases[0].pitches=[52,55,59];
  for(const phrase of phrases)for(const [j,pitch] of phrase.pitches.entries()){
    const duration=separateReleases&&j===1?phrase.duration*.6:phrase.duration;
    truth.push({time:phrase.time,duration,pitch});
    const hz=440*2**((pitch-69)/12),gain=quietSecond&&j===1?.09:.22;
    for(let i=0;i<duration*sampleRate;i++){
      const t=i/sampleRate,envelope=Math.min(1,t/.006)*Math.min(1,(duration-t)/.02);
      const tone=harmonics.reduce((sum,level,h)=>sum+level*Math.sin(2*Math.PI*hz*(h+1)*t+.17*j),0);
      samples[Math.round(phrase.time*sampleRate)+i]+=gain*envelope*tone;
    }
  }
  if(drums){let seed=839;for(const time of [1,1.6,2.2,5.4,5.9,7.4,8.5])for(let i=0;i<sampleRate*.12;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate;
    samples[Math.round(time*sampleRate)+i]+=.055*(seed/2147483648-1)*Math.exp(-t*40);
  }}
  return {samples,sampleRate,truth};
}
function overlapping({quiet=false,offset=0,percussion=false}={}){
  const samples=new Float32Array(sampleRate*8),truth=[
    {time:.5+offset,pitch:52,duration:2.65,gain:.3},
    {time:1.05+offset,pitch:59,duration:.5,gain:quiet?.055:.1},
    {time:1.87+offset,pitch:55,duration:.28,gain:quiet?.055:.1},
    {time:2.43+offset,pitch:67,duration:.35,gain:quiet?.055:.1},
    {time:3.65+offset,pitch:55,duration:1,gain:.2},
    {time:3.65+offset,pitch:62,duration:.6,gain:.13},
    {time:5.3+offset,pitch:59,duration:.65,gain:.22}
  ];
  for(const hit of truth){const hz=440*2**((hit.pitch-69)/12);
    for(let i=0;i<hit.duration*sampleRate;i++){const t=i/sampleRate,envelope=Math.min(1,t/.005)*Math.min(1,(hit.duration-t)/.015);samples[Math.round(hit.time*sampleRate)+i]+=hit.gain*envelope*(Math.sin(2*Math.PI*hz*t)+.35*Math.sin(4*Math.PI*hz*t)+.16*Math.sin(6*Math.PI*hz*t));}
  }
  if(percussion){let seed=913;for(const time of [1.4,2.1,4.3,5.8])for(let i=0;i<sampleRate*.1;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[Math.round((time+offset)*sampleRate)+i]+=.08*(seed/2147483648-1)*Math.exp(-i/sampleRate*40);}}
  return {samples,sampleRate,truth};
}
module.exports={recording,overlapping};
