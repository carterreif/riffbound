const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js');
const event=(time,pitch,duration=0)=>({time,pitch,duration,measuredTail:true,strength:1});
const conflicts=notes=>notes.flatMap((n,i)=>notes.slice(i+1).filter(m=>m.lane===n.lane&&m.time>n.time+.001&&m.time<n.time+n.duration-.001));
test('Guitar a distant accepted pitch does not squash an entire riff into one fret',()=>{
 const pitches=[40,41,42,43,44,45,46,47,88],events=pitches.map((pitch,i)=>event(1+i,pitch));
 const notes=A.buildFocusedCharts(events,'guitar',.5,12,[],.01).guitar.expert;
 assert.equal(notes.length,events.length);assert.ok(new Set(notes.slice(0,-1).map(n=>n.lane)).size>=4);
 const shifted=A.buildFocusedCharts(events.map(e=>({...e,pitch:e.pitch+7})),'guitar',.5,12,[],.01).guitar.expert;
 assert.deepEqual(notes.map(n=>n.lane),shifted.map(n=>n.lane),'Transposition alone does not change the chart shape');
 for(let i=1;i<notes.length;i++)assert.ok(notes[i].lane>=notes[i-1].lane);
});
test('Guitar actual tonal audio keeps measured pitches and ordered colors across a wide riff',()=>{
 const sampleRate=22050,pitches=[60,61,62,63,64,65,66,67,84],samples=new Float32Array(sampleRate*8);
 pitches.forEach((pitch,j)=>{
  const start=.4+j*.7,hz=440*2**((pitch-69)/12);
  for(let i=0;i<sampleRate*.3;i++){const t=i/sampleRate,envelope=Math.min(1,t/.008)*Math.min(1,(.3-t)/.02);samples[Math.round(start*sampleRate)+i]+=.25*envelope*(Math.sin(2*Math.PI*hz*t)+.35*Math.sin(4*Math.PI*hz*t)+.15*Math.sin(6*Math.PI*hz*t));}
 });
 const result=A.analyze({samples,sampleRate,instrument:'guitar'}),notes=result.charts.guitar.expert;
 assert.equal(notes.length,pitches.length);notes.forEach((n,i)=>{assert.equal(n.pitch,pitches[i]);assert.ok(Math.abs(n.time-(.4+i*.7))<.03);if(i)assert.ok(n.lane>=notes[i-1].lane);});
 assert.ok(new Set(notes.slice(0,-1).map(n=>n.lane)).size>=4);
 assert.equal(result.quality.audioReviews.guitar.fretPolicy,'ordered-distinct-pitch-groups-v2');
});
test('Guitar assigns different frets to independently ringing pitches when five ordered frets can represent them',()=>{
 const events=[event(.2,40),event(.5,88),event(1,52,2),event(2,55,.5),event(4,59),event(5,64),event(6,52),event(7,55)];
 const charts=A.buildFocusedCharts(events,'guitar',.5,9,[],.01).guitar;
 const a=charts.expert.find(n=>n.time===1),b=charts.expert.find(n=>n.time===2);
 assert.notEqual(a.lane,b.lane,'Two proven overlapping tones need independently playable colors');
 assert.equal(a.duration,2,'A representable independent hold keeps its measured release');
 const colors=new Map();for(const n of charts.expert){if(colors.has(n.pitch))assert.equal(n.lane,colors.get(n.pitch));colors.set(n.pitch,n.lane);}
 assert.equal(charts.expert.length,events.length);for(const notes of Object.values(charts))assert.equal(conflicts(notes).length,0);
});
test('Guitar easier fret compression stops a hold before the next real head on its pad',()=>{
 const events=[event(.2,52),event(.5,59),event(1,62,2),event(1.75,64,.6),event(4,67)];
 const charts=A.buildFocusedCharts(events,'guitar',.5,6,[],.01).guitar;
 assert.equal(charts.expert.find(n=>n.time===1).duration,2);
 const a=charts.medium.find(n=>n.time===1),b=charts.medium.find(n=>n.time===1.75);
 assert.equal(a.lane,b.lane);assert.ok(a.duration>0&&a.time+a.duration<=b.time-.014);
 for(const notes of Object.values(charts))assert.equal(conflicts(notes).length,0);
 for(const [level,notes] of Object.entries(charts))for(const n of notes){assert.ok(events.some(e=>e.time===n.time&&e.pitch===n.pitch));assert.ok(n.duration<=events.find(e=>e.time===n.time&&e.pitch===n.pitch).duration);}
});
test('Guitar compression remains playable when wide adjacent chord changes need contextual frets',()=>{
 const pitches=[40,43,45,48,50,52,55],events=[];
 for(let i=0;i<pitches.length-1;i++)for(const pitch of pitches.slice(i,i+2))events.push(event(1+i,pitch,1.6));
 const charts=A.buildFocusedCharts(events,'guitar',.5,9,[],.01).guitar;
 assert.equal(charts.expert.length,events.length);
 for(const notes of Object.values(charts))assert.equal(conflicts(notes).length,0,'A reused colored pad cannot show overlapping playable holds');
 for(let time=1;time<7;time++){const chord=charts.expert.filter(n=>n.time===time);assert.equal(new Set(chord.map(n=>n.lane)).size,2);}
});
