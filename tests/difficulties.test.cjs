const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/chart-difficulties.js'),E=require('../dist/engine.js'),A=require('../dist/autochart.js'),L=require('../dist/song-library.js');
const pitches=[52,57,60,64,69];
function dense(instrument){
  const notes=Array.from({length:100},(_,i)=>({time:1+i*.06,lane:i%5,pitch:pitches[i%5],duration:0}));
  if(instrument==='drums')for(let i=0;i<50;i++)notes.push({time:1+i*.12,lane:5,duration:0});
  return notes.sort((a,b)=>a.time-b.time||a.lane-b.lane).map((n,id)=>({...n,id}));
}
for(const instrument of ['guitar','drums','bass','vocals'])test(`${instrument}: four progressively denser levels preserve measured events and score correctly`,()=>{
  const expert=dense(instrument),before=JSON.stringify(expert),charts=D.build(expert,instrument,.5);
  assert.deepEqual(Object.keys(charts),['easy','medium','hard','expert']);
  assert.deepEqual(charts.expert,expert);assert.equal(JSON.stringify(expert),before);
  for(const [i,level] of D.LEVELS.entries()){
    const notes=charts[level];assert.ok(notes.length>0);if(i)assert.ok(notes.length>charts[D.LEVELS[i-1]].length);
    const pitchesToLanes=new Map();
    for(const note of notes){
      const match=expert.find(n=>n.time===note.time&&(instrument==='drums'?n.lane===note.lane:n.pitch===note.pitch));assert.ok(match,'Every output has a measured source note');
      assert.equal(note.duration,match.duration);assert.ok(note.lane<(instrument==='drums'?6:D.frets(instrument,level)));
      if(instrument!=='drums'){
        if(pitchesToLanes.has(note.pitch))assert.equal(pitchesToLanes.get(note.pitch),note.lane);pitchesToLanes.set(note.pitch,note.lane);
      }
    }
    if(instrument==='drums'&&i)assert.ok(notes.filter(n=>n.lane===5).length>charts[D.LEVELS[i-1]].filter(n=>n.lane===5).length);
    const session=new E.Session(level,'tap',instrument,{notes,musicEnd:8});
    for(const note of notes){session.tap(note.lane,note.time);session.update(note.time,new Set([note.lane]));}
    session.update(9,new Set());assert.equal(session.hits,notes.length);assert.equal(session.misses,0);
    assert.equal(session.window,D.WINDOWS[level]);assert.equal(JSON.stringify(expert),before);
  }
});
test('fewer frets merge collapsed chord positions without introducing duplicate taps',()=>{
  const expert=[{id:0,time:1,lane:2,pitch:60,duration:0},{id:1,time:1.0005,lane:3,pitch:64,duration:0},{id:2,time:1.0008,lane:4,pitch:69,duration:0}];
  const charts=D.build(expert,'guitar',.5);
  assert.equal(charts.easy.length,1);assert.equal(charts.medium.length,1);assert.equal(charts.hard.length,2);assert.equal(charts.expert.length,3);
  for(const level of D.LEVELS){const session=new E.Session(level,'strum','guitar',{notes:charts[level],musicEnd:5});assert.equal(session.strum(new Set(charts[level].map(n=>n.lane)),1),true);assert.equal(session.hits,charts[level].length);}
});
test('held vocals retain original pitch, lane and duration at every difficulty',()=>{
  const expert=Array.from({length:5},(_,i)=>({id:i,time:1+i*1.5,lane:i,pitch:60+i*2,duration:.9})),charts=D.build(expert,'vocals',.5);
  for(const level of D.LEVELS){assert.deepEqual(charts[level],expert);const session=new E.Session(level,'strum','vocals',{notes:charts[level],musicEnd:9});assert.equal(session.mode,'tap');session.tap(0,1);session.update(1.8,new Set([0]));assert.ok(session.score>100);}
});
test('legacy backup gains all four arrangements without losing audio, Expert or legacy Standard',async()=>{
  const {storage}=require('./helpers/song-storage.cjs'),s=storage({rejectBlobs:true}),audioBlob=new Blob([new Uint8Array([1,2,3,4])]);
  const expert=dense('drums'),original={id:'a'.repeat(64),title:'Legacy song',instrument:'drums',musicEnd:8,beat:.5,bpm:120,charts:{drums:{easy:expert.slice(0,3),normal:expert,expert}},audioBlob};
  const originalJSON=JSON.stringify(original.charts),safe=L.validate(original);
  assert.equal(JSON.stringify(original.charts),originalJSON);assert.equal(safe.charts.drums.expert.length,150);assert.equal(safe.charts.drums.normal.length,150);
  assert.ok(safe.charts.drums.easy.length<safe.charts.drums.medium.length);assert.ok(safe.charts.drums.medium.length<safe.charts.drums.hard.length);
  await s.library.save(original);const loaded=await s.fresh().get(original.id),restored=await L.unpack(L.pack(loaded));
  for(const level of D.LEVELS)assert.deepEqual(restored.charts.drums[level],safe.charts.drums[level]);
  assert.deepEqual(new Uint8Array(await restored.audioBlob.arrayBuffer()),new Uint8Array([1,2,3,4]));
  assert.equal(s.largest<=32768,true);
});
test('malformed Medium and Hard notes are rejected rather than hidden by migration',()=>{
  const notes=[{time:1,lane:0,duration:0}],base={id:'a'.repeat(64),title:'Bad chart',instrument:'guitar',musicEnd:8,beat:.5,bpm:120,charts:{guitar:{easy:notes,normal:notes,medium:notes,hard:notes,expert:notes}}};
  assert.throws(()=>L.validate({...base,charts:{guitar:{...base.charts.guitar,medium:[{time:1,lane:4,duration:0}]}}}),/invalid note/);
  assert.throws(()=>L.validate({...base,charts:{guitar:{...base.charts.guitar,easy:[{time:1,lane:3,duration:0}]}}}),/invalid note/);
  for(const level of ['medium','hard'])for(const note of [{time:NaN,lane:0,duration:0},{time:1,lane:8,duration:0},{time:7,lane:0,duration:4}])assert.throws(()=>L.validate({...base,charts:{guitar:{...base.charts.guitar,[level]:[note]}}}),/invalid note/);
});
test('the matched In Bloom chart has four arrangements and applies reviewed upper charts while keeping four increasing difficulty counts',()=>{
  const r=require('../dist/reference-charts.js').match('551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3',272.66185941043085);
  const charts=A.buildMatchedCharts(r,272.66185941043085).drums;
  assert.equal(charts.expert.length,1365);
  for(const [i,level] of D.LEVELS.entries()){
    if(i)assert.ok(charts[level].length>charts[D.LEVELS[i-1]].length);
    if(level==='hard')for(const n of charts[level])assert.ok(charts.expert.some(e=>e.time===n.time&&e.lane===n.lane));
  }
});
