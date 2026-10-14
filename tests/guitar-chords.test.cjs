const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),E=require('../dist/engine.js'),L=require('../dist/song-library.js'),F=require('./fixtures/guitar-chords.cjs');
for(const settings of [{},{quietSecond:true},{drums:true},{harmonics:[1,.7,.5,.25,.15]}])test(`Guitar independently played chord tones and holds: ${JSON.stringify(settings)}`,()=>{
  const f=F.recording(settings),r=A.analyze({...f,instrument:'guitar'}),notes=r.charts.guitar.expert;
  assert.equal(notes.length,f.truth.length,'Each real tone once; no overtones or overlapping percussion heads');
  for(const hit of f.truth){
    const n=notes.find(n=>n.pitch===hit.pitch&&Math.abs(n.time-hit.time)<.03);assert.ok(n,`Missing ${hit.pitch} at ${hit.time}`);
    assert.ok(Math.abs(n.duration-hit.duration)<.1,`Own tone release: ${n.duration} vs ${hit.duration}`);
  }
  assert.ok(notes.filter(n=>n.time<.55).every(n=>n.duration>2.5),'Both chord members retain a hold beyond 1.8 seconds');
  const groups=new Map();for(const note of notes){const g=groups.get(note.time)||[];g.push(note);groups.set(note.time,g);}
  assert.equal([...groups.values()].filter(g=>g.length===2).length,4,'Four measured two-tone attacks');
  for(const level of ['hard','medium','easy'])for(const n of r.charts.guitar[level])assert.ok(notes.some(e=>e.time===n.time&&e.pitch===n.pitch&&e.duration===n.duration));
  const session=new E.Session('expert','strum','guitar',{notes,musicEnd:r.duration});
  for(const [time,group] of groups){const lanes=new Set(group.map(n=>n.lane));assert.equal(session.strum(lanes,time),true);session.update(time+Math.min(...group.map(n=>n.duration)),lanes);for(const lane of lanes)session.release(lane);}
  assert.equal(session.hits,notes.length);
});
test('simultaneous independently measured tails survive portable storage',async()=>{
  const r=A.analyze({...F.recording(),instrument:'guitar'}),song={id:'c'.repeat(64),title:'Chord test',instrument:'guitar',musicEnd:r.duration,duration:r.duration+.8,bpm:r.bpm,beat:r.beat,charts:r.charts,quality:r.quality,audioBlob:new Blob(['test audio'])};
  const loaded=await L.unpack(L.pack(song));
  assert.deepEqual(loaded.charts.guitar.expert.map(({bar,...n})=>n),r.charts.guitar.expert.map(({bar,...n})=>n));
  assert.equal(loaded.quality.audioReviews.guitar.chordPolicy,'independent-harmonic-attacks-v1');
});
for(const settings of [{separateReleases:true},{threeTones:true}])test(`Guitar separates each chord member rather than sharing a sustain: ${JSON.stringify(settings)}`,()=>{
  const f=F.recording(settings),notes=A.analyze({...f,instrument:'guitar'}).charts.guitar.expert;
  assert.equal(notes.length,f.truth.length);
  for(const hit of f.truth){const n=notes.find(n=>n.pitch===hit.pitch&&Math.abs(n.time-hit.time)<.03);assert.ok(n);assert.ok(Math.abs(n.duration-hit.duration)<.1);}
  const first=notes.filter(n=>n.time<.55);assert.equal(new Set(first.map(n=>n.lane)).size,first.length,'Each simultaneous tone has its own playable fret');
  if(settings.separateReleases)assert.ok(Math.abs(first[0].duration-first[1].duration)>1);
});
test('wide Guitar pitch range does not collapse a representable chord onto one fret',()=>{
  const events=[{time:.5,pitch:40},{time:1.5,pitch:88},{time:3,pitch:52},{time:3,pitch:55},{time:4,pitch:59},{time:5,pitch:64},{time:6,pitch:52},{time:6,pitch:55}].map(n=>({...n,duration:0,strength:1}));
  const notes=A.buildFocusedCharts(events,'guitar',.5,8,[],.01).guitar.expert;
  assert.equal(notes.length,events.length);
  for(const time of [3,6]){const group=notes.filter(n=>n.time===time);assert.equal(new Set(group.map(n=>n.lane)).size,2);}
  const colors=new Map();for(const note of notes){if(colors.has(note.pitch))assert.equal(note.lane,colors.get(note.pitch));colors.set(note.pitch,note.lane);}
  const ordered=[...colors].sort((a,b)=>a[0]-b[0]);assert.equal(ordered[0][1],0);assert.equal(ordered.at(-1)[1],4);
  for(let i=1;i<ordered.length;i++)assert.ok(ordered[i][1]>=ordered[i-1][1]);
});
test('a wide arrangement that exceeds five fixed ordered frets uses playable local chord voicings',()=>{
  const pitches=[40,43,45,48,50,52,55],events=[];
  for(let i=0;i<pitches.length-1;i++)for(const pitch of pitches.slice(i,i+2))events.push({time:1+i,pitch,duration:.6,measuredTail:true,chordTone:true,strength:1});
  const notes=A.buildFocusedCharts(events,'guitar',.5,9,[],.01).guitar.expert;
  assert.equal(notes.length,events.length);
  const session=new E.Session('expert','strum','guitar',{notes,musicEnd:9});
  for(let time=1;time<7;time++){const group=notes.filter(n=>n.time===time);assert.equal(new Set(group.map(n=>n.lane)).size,2);assert.equal(session.strum(new Set(group.map(n=>n.lane)),time),true);}
  assert.equal(session.hits,notes.length);
});
