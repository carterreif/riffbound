// Independent pitches with rare endpoints and a heavily repeated middle note.
const sampleRate=22050;
function fixture(instrument,{uneven=false,transpose=0}={}){
 const base=instrument==='bass'?33:60;
 const offsets=uneven?[0,1,2,3,12]:[0,3,6,9,12];
 const pitches=offsets.map(n=>base+n+transpose);
 const sequence=[pitches[0],pitches[1],...Array(24).fill(pitches[2]),pitches[3],pitches[4]];
 const samples=new Float32Array(sampleRate*17),expected=[];
 sequence.forEach((pitch,j)=>{
  const time=.5+j*.55,duration=.36,hz=440*2**((pitch-69)/12);expected.push({time,pitch,lane:pitches.indexOf(pitch)});
  for(let i=0;i<duration*sampleRate;i++){
   const t=i/sampleRate,envelope=Math.min(1,t/.009)*Math.min(1,(duration-t)/.024);
   samples[Math.round(time*sampleRate)+i]+=.3*envelope*(Math.sin(2*Math.PI*hz*t)+.35*Math.sin(4*Math.PI*hz*t)+.12*Math.sin(6*Math.PI*hz*t));
  }
 });
 return {samples,sampleRate,expected};
}
module.exports={fixture};
