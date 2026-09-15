const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../dist/reference-charts.js'),A=require('../dist/autochart.js'),E=require('../dist/engine.js');
const id='551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3',duration=272.66185941043085;
const reference=()=>R.match(id,duration);
const charts=()=>{const r=reference();return A.buildMatchedCharts(r,duration).drums;};

test('matched chart requires the exact audio identity and length, and returns fresh data',()=>{
  assert.equal(R.match('InbloomNirvanadrumsonly.wav',duration),null);
  assert.equal(R.match('a'.repeat(64),duration),null);assert.equal(R.match(id,16),null);assert.equal(R.match(id,NaN),null);
  const r=reference();assert.ok(r);r.events[0].lane=99;r.waveform[0]=99;
  assert.notEqual(reference().events[0].lane,99);assert.notEqual(reference().waveform[0],99);
});

test('matched opening fills use red snare, blue rack tom and green floor tom without duplicate noise colors',()=>{
  const notes=charts().expert;
  for(const fill of [[4.088,4.285,4.672,5.08],[7.294,7.494,7.902,8.288],[10.562,10.786,11.152,11.583],[13.788,13.988,14.386,14.772]]){
    fill.forEach((time,i)=>assert.deepEqual(notes.filter(n=>n.lane!==5&&Math.abs(n.time-time)<.025).map(n=>n.lane),[i<2?0:i===2?2:4],`Fill strike ${time}`));
  }
});

test('matched later snare roll stays red and the tom fill has distinct descending voices',()=>{
  const notes=charts().expert;
  for(const time of [243.546,243.656,243.794,243.922,244.065,244.191])assert.deepEqual(notes.filter(n=>Math.abs(n.time-time)<.025).map(n=>n.lane),[0]);
  for(const [time,lane] of [[240.353,0],[240.490,0],[240.632,0],[240.757,2],[240.896,4],[241.011,4]])assert.deepEqual(notes.filter(n=>Math.abs(n.time-time)<.025).map(n=>n.lane),[lane]);
  for(const time of [235.283,241.432,268.620])assert.ok(!notes.some(n=>n.lane===3&&Math.abs(n.time-time)<.04),'Reviewed tail cannot become another crash');
});

test('matched hats and real crash/kick chords follow the recording, without reusing demo beat times',()=>{
  const r=reference(),notes=charts().expert;
  for(const time of [5.884,9.121,12.258,30.009,30.83,31.012,31.650,32.447,32.633])assert.ok(notes.some(n=>n.lane===1&&Math.abs(n.time-time)<.035));
  for(const time of [2.242,3.470,5.481,6.692,8.706,9.939,11.955])assert.deepEqual(notes.filter(n=>Math.abs(n.time-time)<.025).map(n=>n.lane),[3,5]);
  assert.notEqual(r.bpm,E.BPM);assert.equal(notes.filter(n=>n.time<1.9).length,0);
});

test('every matched strike is playable and simpler difficulty retains the same voice and timing',()=>{
  const all=charts();assert.equal(all.expert.length,1351);assert.equal(all.normal.length,1275);assert.ok(all.easy.length<all.expert.length);
  for(const level of ['easy','medium','hard','normal','expert']){
    const session=new E.Session(level,'tap','drums',{notes:all[level],musicEnd:duration});
    for(const n of all[level]){assert.ok(all.expert.some(e=>e.time===n.time&&e.lane===n.lane));session.tap(n.lane,n.time);session.update(n.time,new Set([n.lane]));}
    session.update(duration+1,new Set());assert.equal(session.hits,all[level].length);assert.equal(session.misses,0);
  }
});

test('the original uploaded WAV selects the matched chart and keeps all prior inspected landmarks',{skip:!process.env.RIFFBOUND_REFERENCE_WAV||!process.env.RIFFBOUND_REFERENCE_PCM},()=>{
  const bytes=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_WAV),pcm=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_PCM);
  const audioId=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(audioId,id);
  const result=A.analyze({samples:new Float32Array(pcm.buffer,pcm.byteOffset,pcm.byteLength/4),sampleRate:22050,instrument:'drums',audioId});
  assert.equal(result.quality.sources.drums,'In Bloom · Matched drum chart');assert.equal(result.chartVersion,13);
  const notes=result.charts.drums.expert;
  for(const [lane,times] of [[5,[2.242,2.849,3.243,3.470,4.494,4.886,5.278,5.481,6.087,6.477,6.692,7.705,8.117,8.491,8.706,9.321,9.704]],[0,[3.052,4.088,4.285,6.265,7.294,9.504,10.562,10.784]],[1,[5.884,9.121]],[3,[2.242]]])for(const time of times)assert.ok(notes.some(n=>n.lane===lane&&Math.abs(n.time-time)<.035),`Missing ${lane} at ${time}`);
});


test('the score review keeps the shipped Easy/Medium/Normal arrays byte-for-byte',()=>{
  const all=charts(),expected={easy:'a250177763cff234724f9dcadd40d72cb700363b255e7a1e49c913a687fefb04',medium:'6143193a5d6fc4763fd4b093fa52b11e39e167790326d6f9f5e4d9ae5bd7fe59',normal:'d7d04cf3684c7c77633d182f3d235f94faa38d66236b7b54da84b2d57142baf7'};
  for(const [level,digest] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(JSON.stringify(all[level])).digest('hex'),digest,level);
  assert.equal(all.easy.length,522);assert.equal(all.medium.length,916);assert.equal(all.hard.length,1310);assert.equal(all.expert.length,1351);
  for(const note of all.hard)assert.ok(all.expert.some(n=>n.time===note.time&&n.lane===note.lane));
});

test('the score review adds only 76 bounded yellow hits and keeps every original strike',()=>{
  const r=reference(),key=n=>`${n.time}:${n.lane}`,before=new Set(r.baselineEvents.map(key)),after=new Set(r.events.map(key));
  assert.equal(before.size,1275);assert.equal(after.size,1351);assert.equal(after.size,r.events.length,'No duplicates');
  for(const note of r.baselineEvents)assert.ok(after.has(key(note)));
  const added=r.events.filter(n=>!before.has(key(n)));
  assert.equal(added.length,76);assert.ok(added.every(n=>n.lane===1&&n.time>=15.19&&n.time<47.442));
  for(const note of added)assert.ok(![[27.5,28.024],[40.45,40.909]].some(([a,b])=>note.time>=a&&note.time<b),'Snare-only fills do not gain yellow notes');
  for(const lane of [0,2,3,4,5])assert.deepEqual(r.events.filter(n=>n.lane===lane),r.baselineEvents.filter(n=>n.lane===lane));
  r.baselineEvents[0].time=0;assert.notEqual(reference().baselineEvents[0].time,0);
});

test('quiet score-review hi-hat landmarks have independent fresh treble attacks in the original WAV',{skip:!process.env.RIFFBOUND_REFERENCE_PCM},()=>{
  const bytes=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_PCM),samples=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),sr=22050;
  function treblePower(start,end){let sum=0,count=0;for(let i=Math.round(start*sr);i<Math.round(end*sr);i++){sum+=(samples[i]-samples[i-1])**2;count++;}return sum/count;}
  const expert=charts().expert;
  for(const time of [16.532,17.317,20.575,30.184,33.411,35.430]){
    assert.ok(expert.some(n=>n.lane===1&&Math.abs(n.time-time)<.004));
    assert.ok(treblePower(time+.004,time+.020)>treblePower(time-.020,time-.004)*2,`No independent treble attack at ${time}`);
  }
});
