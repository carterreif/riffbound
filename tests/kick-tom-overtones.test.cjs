const test=require('node:test'),assert=require('node:assert/strict'),A=require('../dist/autochart.js');
function fixture({tom=false,harmonic=false}={}){
 const sr=22050,samples=new Float32Array(sr*5),events=[];
 for(const time of [.6,1.3,2,2.7,3.4]){
  events.push({lane:4,time},{lane:5,time},{lane:1,time});
  for(let i=0;i<sr*.45;i++){
   const t=i/sr,attack=Math.min(1,t*1000);let v=.6*Math.sin(2*Math.PI*53*t)*Math.exp(-t*13);
   v+=(harmonic?.2:0)*Math.sin(2*Math.PI*(124*t-45*t*t))*Math.exp(-t*15);
   if(tom)v+=.5*Math.sin(2*Math.PI*91*t)*Math.exp(-t*9);
   samples[Math.round(time*sr)+i]+=v*attack;
  }
 }
 return {samples,events,sr};
}
test('sweeping kick resonances do not become simultaneous green floor-tom strikes',()=>{
 const f=fixture({harmonic:true}),kept=A.rejectKickTomOvertones(f.events,f.samples,f.sr);assert.equal(kept.filter(n=>n.lane===4).length,0);assert.equal(kept.filter(n=>n.lane===5).length,5);assert.equal(kept.filter(n=>n.lane===1).length,5);
});
test('independent pitched floor toms alongside kicks retain their exact time and other pads',()=>{
 const f=fixture({tom:true}),kept=A.rejectKickTomOvertones(f.events,f.samples,f.sr);assert.deepEqual(kept,f.events);
});
test('tom fills between kicks and unrelated instrument data are outside the collision filter',()=>{
 const f=fixture({harmonic:true}),notes=[{lane:4,time:1},{lane:2,time:.6},{lane:0,time:2},{lane:3,time:3.4}];assert.deepEqual(A.rejectKickTomOvertones(notes,f.samples,f.sr),notes);
});
const fs=require('node:fs'),path=require('node:path'),root=process.env.RIFFBOUND_WASTED_ROOT;
test('uploaded recording collision repair preserves original non-tom hits on every difficulty',{skip:!root},()=>{
 const song=JSON.parse(fs.readFileSync(path.join(root,'meta.json'))),bytes=fs.readFileSync(path.join(root,'drums.f32')),samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);let removed=0;
 for(const [level,notes] of Object.entries(song.charts.drums)){const keep=A.rejectKickTomOvertones(notes,samples,22050);assert.deepEqual(keep.filter(n=>n.lane!==4),notes.filter(n=>n.lane!==4));assert.ok(keep.every(n=>notes.includes(n)));if(level==='expert')removed=notes.length-keep.length;}
 assert.ok(removed>=150,`Actual duplicate floor toms removed: ${removed}`);
});
