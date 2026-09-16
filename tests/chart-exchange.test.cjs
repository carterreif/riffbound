const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../dist/chart-exchange.js'),L=require('../dist/song-library.js'),D=require('../dist/chart-difficulties.js');
function chart(tracks,sync='0 = B 120000',meta=''){
  return `[Song]\n{\nName = "Example"\nResolution = 192\n${meta}\n}\n[SyncTrack]\n{\n${sync}\n}\n${tracks}`;
}
const track=(name,lines)=>`[${name}]\n{\n${lines}\n}\n`;

test('tempo changes and positive/negative audio offsets retain authored timing and holds',()=>{
  const p=X.parse(chart(track('ExpertSingle','192 = N 0 384\n384 = N 4 0'), '0 = B 120000\n384 = B 60000\n0 = TS 4','Offset = 0.25'),{shiftMs:100});
  assert.deepEqual(p.charts.guitar.expert.map(n=>[n.lane,n.time,n.duration]),[[0,.85,1.5],[4,1.35,0]]);
  assert.equal(X.parse(chart(track('ExpertSingle','192 = N 0 0'),'','Offset = -0.1')).charts.guitar.expert[0].time,.4);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 0 0'),'','Offset = -1')),/before the audio/);
});
test('5-lane drums keep every pad, kick, roll stroke and simultaneous chord',()=>{
  const p=X.parse(chart(track('ExpertDrums','192 = N 0 0\n192 = N 1 0\n192 = N 2 0\n204 = N 1 0\n216 = N 1 0\n240 = N 3 0\n288 = N 4 0\n336 = N 5 0\n360 = N 32 0')));
  assert.equal(p.drumLayout,'five');assert.deepEqual(p.charts.drums.expert.map(n=>n.lane),[0,1,5,0,0,2,3,4,5]);
  assert.equal(p.charts.drums.expert[4].time,.5625);
});
test('Pro cymbal markers map independently and ambiguous layouts require a choice',()=>{
  const p=X.parse(chart(track('ExpertDrums','0 = N 2 0\n0 = N 66 0\n192 = N 2 0\n384 = N 3 0\n384 = N 67 0\n576 = N 4 0\n768 = N 4 0\n768 = N 68 0')));
  assert.deepEqual(p.charts.drums.expert.map(n=>n.lane),[1,2,3,4,3]);
  const ambiguous=chart(track('ExpertDrums','0 = N 1 0\n192 = N 4 0'));
  assert.throws(()=>X.parse(ambiguous),/does not identify its drum layout/);
  const four=X.parse(ambiguous,{drumLayout:'four'});assert.equal(four.charts.drums.expert[1].lane,3);assert.match(four.warnings[0],/do not identify toms/);
});
test('import preserves supplied levels and saved other levels; derives only missing arrangements',()=>{
  const previous={drums:D.build([{lane:5,time:2,duration:0},{lane:0,time:2.5,duration:0}],'drums'),guitar:D.build([{lane:4,time:1,duration:2}],'guitar')};
  const p=X.parse(chart(track('EasyDrums','')+track('MediumDrums','')+track('ExpertDrums','192 = N 1 0\n216 = N 1 0\n240 = N 3 0\n288 = N 5 0')));
  assert.equal(p.charts.drums.easy,undefined,'Empty editor sections must not erase saved arrangements');
  const merged=X.arrange(p,10,previous);assert.equal(merged.charts.drums.easy,previous.drums.easy);assert.equal(merged.charts.drums.medium,previous.drums.medium);assert.equal(merged.charts.guitar,previous.guitar);assert.equal(merged.charts.drums.expert,p.charts.drums.expert);assert.deepEqual(merged.derived.drums,[]);
  const fresh=X.arrange(p,10);assert.deepEqual(fresh.derived.drums,['easy','medium','hard']);assert.ok(fresh.charts.drums.hard.length<fresh.charts.drums.expert.length);assert.deepEqual(fresh.charts.drums.expert,p.charts.drums.expert);
});
test('notes.chart round trip retains timing, chords, holds, bass, all levels, and time signatures',()=>{
  const p=X.parse(chart(track('ExpertDrums','192 = N 5 0\n384 = N 4 0')+track('ExpertSingle','192 = N 2 384\n192 = N 3 384')+track('HardDoubleBass','576 = N 4 0'),'0 = B 120000\n384 = B 60000\n0 = TS 3 2','Offset = 0.125'));
  const song={title:'Test "song"',filename:'my audio.wav',bpm:p.bpm,musicEnd:10,charts:X.arrange(p,10).charts,quality:{chartTiming:p.timing}};
  const text=X.exportChart(song),again=X.parse(text,{drumLayout:'five'});
  for(const part of ['drums','guitar','bass'])for(const level of D.LEVELS)assert.deepEqual(again.charts[part][level],song.charts[part][level]);
  assert.deepEqual(again.timing.signatures,p.timing.signatures);assert.match(text,/MusicStream = "my audio.wav"/);assert.match(X.exportIni(song),/five_lane_drums = True/);
});
test('measured audio charts export with less than 0.1 ms timing error without snapping to beats',()=>{
  const song={title:'Measured',bpm:152,musicEnd:10,charts:{drums:D.build([{time:4.128,lane:0,duration:0},{time:4.149,lane:0,duration:0},{time:4.707,lane:2,duration:0},{time:5.08,lane:4,duration:0}],'drums')}};
  const again=X.parse(X.exportChart(song));
  song.charts.drums.expert.forEach((n,i)=>assert.ok(Math.abs(n.time-again.charts.drums.expert[i].time)<.0001));
});
test('malformed, oversized, unsupported and incompatible files fail instead of inventing/dropping notes',()=>{
  assert.throws(()=>X.parse('not a chart'),/not a supported/);
  assert.throws(()=>X.parse(' '.repeat(X.MAX_BYTES+1)),/4 MB/);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 7 0'))),/Open guitar/);
  assert.throws(()=>X.parse(chart(track('ExpertDrums','0 = N 5 192'))),/sustained drum rolls/);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 0 0\n0 = N 0 0'))),/same pad/);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 0 0'),'0 = B 0')),/tempos/);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 0 0'),'0 = B nonsense')),/Invalid tempo/);
  assert.throws(()=>X.parse(chart(track('ExpertSingle','0 = N 0 0')).slice(0,-2)),/incomplete/);
  const p=X.parse(chart(track('ExpertSingle','5000 = N 0 192')));assert.throws(()=>X.arrange(p,5),/extends beyond/);
  assert.throws(()=>X.parse(chart(track('ExpertDrums','0 = N 2 0\n0 = N 3 0\n192 = N 66 0'))),/same pad/);
});
test('authored Easy frets survive validation and backups without changing legacy validation',async()=>{
  const p=X.parse(chart(track('EasySingle','192 = N 4 0'))),charts=X.arrange(p,10).charts;
  const song={id:'a'.repeat(64),title:'Authored',filename:'audio.wav',audioBlob:new Blob([new Uint8Array([1,2,3])]),instrument:'guitar',musicEnd:10,bpm:120,beat:.5,waveform:[],charts,quality:{imports:{guitar:{levels:['easy'],derived:['medium','hard','expert'],layout:'five',filename:'notes.chart',id:'b'.repeat(64)}}}};
  assert.equal(L.validate(song).charts.guitar.easy[0].lane,4);
  assert.throws(()=>L.validate({...song,quality:null}),/invalid note/);
  const unpacked=await L.unpack(L.pack(song));assert.equal(unpacked.charts.guitar.easy[0].lane,4);assert.deepEqual(unpacked.quality.imports,song.quality.imports);
});
