// Optional regression against the user-supplied recording. Audio stays outside the repo.
// These are inspected onset/voice landmarks, not an exhaustive reference transcription.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze}=require('../dist/autochart.js');
const reference=process.env.RIFFBOUND_REFERENCE_PCM;
test('recorded acoustic kit preserves inspected snare, kick and cymbal landmarks',{skip:!reference},t=>{
  const data=fs.readFileSync(reference),samples=new Float32Array(data.buffer,data.byteOffset,data.byteLength/4);
  const result=analyze({samples,sampleRate:22050,instrument:'drums'}),notes=result.charts.drums.expert;
  const landmarks=[
    {lane:5,times:[2.242,2.849,3.243,3.470,4.494,4.886,5.278,5.481,6.087,6.477,6.692,7.705,8.117,8.491,8.706,9.321,9.704]},
    {lane:0,times:[3.052,4.088,4.285,6.265,7.294,9.504,10.562,10.784]},
    {lane:1,times:[5.884,9.121]},
    {lane:3,times:[2.242]}
  ];
  for(const {lane,times} of landmarks)for(const time of times)assert.ok(notes.some(n=>n.lane===lane&&Math.abs(n.time-time)<.035),`Missing lane ${lane} at ${time}s`);
  const errors=landmarks.flatMap(({lane,times})=>times.map(time=>Math.min(...notes.filter(n=>n.lane===lane).map(n=>Math.abs(n.time-time)))*1000)).sort((a,b)=>a-b);
  t.diagnostic(`${errors.length} inspected hits: median timing error ${errors[errors.length>>1].toFixed(1)} ms; maximum ${errors.at(-1).toFixed(1)} ms. These are landmarks, not a full transcription score.`);
  for(const time of landmarks[1].times)assert.ok(!notes.some(n=>[2,4].includes(n.lane)&&Math.abs(n.time-time)<.07),`A snare's resonance created a tom at ${time}s`);
  for(const time of landmarks[2].times)assert.ok(!notes.some(n=>n.lane===0&&Math.abs(n.time-time)<.07),`Cymbal mislabeled as snare at ${time}s`);
  assert.equal(notes.filter(n=>n.time<1.9).length,0,'No notes in the silent lead-in');
  assert.ok(notes.every(n=>Number.isFinite(n.time)&&n.time>=0&&n.time<result.duration&&n.lane>=0&&n.lane<=5));
  for(const difficulty of ['normal','easy'])for(const note of result.charts.drums[difficulty])assert.ok(notes.some(n=>n.lane===note.lane&&Math.abs(n.time-note.time)<.001),'Difficulty cannot change a voice or its time');
});
