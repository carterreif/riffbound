const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),E=require('../dist/engine.js'),F=require('./fixtures/melody-parts.cjs');
for(const instrument of ['bass','vocals'])for(const vibrato of [0,.35])test(`${instrument} finds independently synthesized pitches, repeats and rests, vibrato ${vibrato}`,()=>{
  const fixture=F.melody(instrument,{vibrato}),result=A.analyze({...fixture,instrument});
  const notes=result.charts[instrument].expert;
  assert.equal(notes.length,fixture.expected.length,'No missing strikes or extra notes in rests');
  notes.forEach((note,i)=>{
    const expected=fixture.expected[i];assert.equal(note.pitch,expected.pitch);
    assert.ok(Math.abs(note.time-expected.time)<(instrument==='bass'?.045:.02),`Timing ${note.time} vs ${expected.time}`);
    if(instrument==='vocals')assert.ok(Math.abs(note.duration-expected.duration)<.035,'Vocal length follows the audio');
  });
  assert.deepEqual([...new Set(notes.map(n=>n.lane))].sort(),[0,1,2,3,4]);
  assert.equal(notes[5].lane,notes[6].lane,'Repeated pitch retains its color');
  for(const level of ['easy','normal'])for(const note of result.charts[instrument][level])assert.ok(notes.some(n=>n.time===note.time&&n.pitch===note.pitch));
  const session=new E.Session('expert','tap',instrument,{notes,musicEnd:8});
  for(const note of notes){assert.equal(session.tap(note.lane,note.time),true);session.update(note.time+note.duration,new Set([note.lane]));session.release(note.lane);}
  assert.equal(session.hits,notes.length);assert.equal(session.misses,0);assert.ok(session.score>=800);
});
test('legato vocals follow pitch changes and keep one continuous repeated pitch',()=>{
  const fixture=F.melody('vocals',{legato:true,vibrato:.25});
  const notes=A.analyze({...fixture,instrument:'vocals'}).charts.vocals.expert;
  assert.deepEqual(notes.map(n=>n.pitch),[60,64,67,69,72,67,60]);
  assert.ok(notes[5].duration>1.1&&notes[5].duration<1.25);
  assert.ok(notes.every(n=>n.duration>.5),'Legato segments keep their measured length');
});
test('bass detects re-articulated low notes and their held tails',()=>{
  const fixture=F.melody('bass',{legato:true}),notes=A.analyze({...fixture,instrument:'bass'}).charts.bass.expert;
  assert.deepEqual(notes.map(n=>n.pitch),fixture.expected.map(n=>n.pitch));
  assert.ok(notes.every(n=>n.duration>.5));assert.ok(notes[6].time-notes[5].time>.5);
  const session=new E.Session('expert','strum','bass',{notes,musicEnd:8});
  for(const note of notes)assert.equal(session.strum(new Set([note.lane]),note.time),true);
  assert.equal(session.hits,8);
});
test('noise and silence never turn into bass or vocal charts',()=>{
  for(const instrument of ['bass','vocals']){
    assert.throws(()=>A.analyze({...F.noise(),instrument}),/No clear/);
    assert.throws(()=>A.analyze({samples:new Float32Array(22050*6),sampleRate:22050,instrument}),/No clear/);
  }
});
test('the original demo bass follows its synthesis; instrumental demo has no vocal chart',()=>{
  const notes=E.makeChart('expert','bass');assert.equal(notes.length,224);
  const tones=[28,31,26,33],chords=[0,0,1,2,0,1,2,3];
  for(const note of notes){const bar=Math.floor((note.time+1e-8)/(E.BEAT*4));assert.equal(note.pitch,tones[chords[bar%8]]);}
  assert.deepEqual(E.makeChart('expert','vocals'),[]);
  assert.equal(new E.Session('normal','strum','vocals').mode,'tap');
});
