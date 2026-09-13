// Ground-truth voices/pitches: verify identity separately from onset timing.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../dist/autochart.js');
const E=require('../dist/engine.js');
const sampleRate=22050;
function demoKit(){
  const game=fs.readFileSync(require.resolve('../dist/game.js'),'utf8');
  const start=game.indexOf('    const sr=ac.sampleRate'),end=game.indexOf('    const midi=n=>',start);
  assert.ok(start>0&&end>start);
  return new Function('ac','E',game.slice(start,end)+'return drumSamples;')({sampleRate,createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)})},E);
}
function mix(samples,sound,time,gain=1){for(let i=0;i<sound.length;i++)samples[Math.round(time*sampleRate)+i]+=sound[i]*gain;}
function assertHits(result,expected){
  const notes=result.charts.drums.expert;
  assert.equal(notes.length,expected.reduce((n,e)=>n+e.lanes.length,0),'No extra notes from ringing tails or broadband attacks');
  for(const hit of expected){
    const actual=notes.filter(n=>Math.abs(n.time-hit.time)<.035).map(n=>n.lane).sort();
    assert.deepEqual(actual,hit.lanes.slice().sort(),`Wrong pad at ${hit.time}s: ${hit.voice||''}`);
  }
  for(const note of result.charts.drums.easy)assert.ok(notes.some(n=>Math.abs(n.time-note.time)<.001&&n.lane===note.lane),'Warmup changes density, never the drum voice');
}

test('every demo drum voice maps to its named color, including quieter repeats',()=>{
  const kit=demoKit(),samples=new Float32Array(sampleRate*32),expected=[];
  const voices=['kick','snare','hat','tom','crash','floorTom','openHat','ride'];
  const lanes=[5,0,1,2,3,4,1,3];
  for(let j=0;j<16;j++){const time=.637+j*1.9,voice=voices[j%8];mix(samples,kit[voice],time,j<8?1:.45);expected.push({time,voice,lanes:[lanes[j%8]]});}
  assertHits(analyze({samples,sampleRate,instrument:'drums'}),expected);
});

test('simultaneous kick and hand hits keep independent identities',()=>{
  const kit=demoKit(),samples=new Float32Array(sampleRate*15),expected=[];
  for(let j=0;j<6;j++){
    const time=.5+j*2,voice=['hat','snare','crash'][j%3],lane={hat:1,snare:0,crash:3}[voice];
    mix(samples,kit.kick,time);mix(samples,kit[voice],time);expected.push({time,voice,lanes:[5,lane]});
  }
  assertHits(analyze({samples,sampleRate,instrument:'drums'}),expected);
});

test('an independent kit with different tuning and envelopes keeps all six identities',()=>{
  const samples=new Float32Array(sampleRate*18),expected=[];let seed=61;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  for(let j=0;j<12;j++){
    const lane=j%6,time=.613+j*1.4;expected.push({time,lanes:[lane]});
    for(let i=0;i<sampleRate;i++){
      const t=i/sampleRate,r=noise();let sound=0;
      if(lane===0)sound=(r*.3+Math.sin(2*Math.PI*205*t)*.19)*Math.exp(-t*21);
      if(lane===1)sound=r*.2*Math.exp(-t*65);
      if(lane===2)sound=(Math.sin(2*Math.PI*158*t)*.4+r*.015)*Math.exp(-t*11);
      if(lane===3)sound=r*.2*Math.exp(-t*3.5)*Math.min(1,t*350);
      if(lane===4)sound=(Math.sin(2*Math.PI*87*t)*.4+r*.012)*Math.exp(-t*8);
      if(lane===5)sound=Math.sin(2*Math.PI*(52*t+2*(1-Math.exp(-t*40))))*.6*Math.exp(-t*16);
      samples[Math.round(time*sampleRate)+i]+=sound*(j<6?.6:1);
    }
  }
  assertHits(analyze({samples,sampleRate,instrument:'drums'}),expected);
});

test('known guitar pitches follow the audio and fit the frets of each difficulty',()=>{
  const samples=new Float32Array(sampleRate*15),expected=[];
  const pitches=[57,60,64,67,69];
  for(let j=0;j<20;j++){
    const time=.543+j*.65,pitch=pitches[j%5],frequency=440*2**((pitch-69)/12);expected.push({time,pitch});
    for(let i=0;i<sampleRate*.4;i++){const t=i/sampleRate;samples[Math.round(time*sampleRate)+i]+=(Math.sin(2*Math.PI*frequency*t)+.35*Math.sin(4*Math.PI*frequency*t))*(j<10?.25:.5)*Math.min(1,t*500)*Math.exp(-t*9);}
  }
  const result=analyze({samples,sampleRate,instrument:'guitar'});
  const colors={easy:[0,1,1,2,2],medium:[0,1,2,2,3],hard:[0,1,2,3,4],expert:[0,1,2,3,4]};
  for(const difficulty of ['easy','medium','hard','expert'])for(const n of result.charts.guitar[difficulty]){
    const hit=expected.find(e=>Math.abs(e.time-n.time)<.035);assert.ok(hit,'Note must land on a measured tonal attack');
    assert.equal(n.pitch,hit.pitch,'Detect the actual note, without FFT-bin semitone bias');
    assert.equal(n.lane,colors[difficulty][pitches.indexOf(n.pitch)],'Correct pitch color for the selected fret count');
  }
  assert.equal(result.charts.guitar.expert.length,expected.length);assert.equal(new Set(result.charts.guitar.expert.map(n=>n.lane)).size,5);
});
