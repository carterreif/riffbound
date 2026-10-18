const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../dist/autochart.js'),{fixture}=require('./fixtures/fallback-drum-leakage.cjs');
for(const decay of [24,45])test(`unknown fast damped Guitar ${decay}: adaptive kit learning cannot supply Drum notes`,()=>{
 const f=fixture({decay}),labels=[];
 assert.throws(()=>A.analyze({...f,instrument:'drums',wholeSong:true},(_,label)=>labels.push(label)),/Not enough clear drum hits/);
 assert.ok(labels.includes('Checking possible drum sounds in this recording…'),'Exercise the adaptive branch, not only sparse-hit classification');
});
test('new harmonic rejection reduces fast Guitar leakage while retaining independently heard Drums',t=>{
 const f=fixture({percussion:true}),r=A.analyze({...f,instrument:'drums',wholeSong:true}),notes=r.charts.drums.expert;
 const matched=f.drums.filter(d=>notes.some(n=>n.lane===d.lane&&Math.abs(n.time-d.time)<.05)).length;
 const leakage=notes.filter(n=>f.guitar.some(g=>Math.abs(n.time-g.time)<.04)).length;
 // Before this fix: 122 Guitar-timed false heads, 23/30 Drum landmarks.
 // This difficult mixed-audio estimate remains imperfect; guard both gains.
 assert.ok(leakage<=65,`${leakage} Guitar-timed heads`);assert.ok(matched>=23,`${matched}/30 real Drum landmarks`);
 assert.equal(r.chartVersion,27);assert.equal(r.quality.audioReviews.drums.tonalRejectionPolicy,'short-and-sustained-harmonic-family-v2');
 for(const level of ['easy','medium','hard','expert'])assert.ok(r.charts.drums[level].every(n=>n.duration===0),'Drums use strikes, not held Guitar frets');
 t.diagnostic(`${matched}/30 Drum landmarks retained; ${leakage} Guitar-timed false heads remain, versus 122 before. This is a limited estimator regression, not full-song transcription accuracy.`);
});
test('unknown-song upload reports insufficient Drums instead of saving Guitar-timed fallback notes',async()=>{
 const fs=require('node:fs'),{createRequire}=require('node:module'),adapter=require.resolve('./upload-flow.test.cjs');
 const code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
 const app=setup({audioSamples:fixture().samples,browserOverrides:{RiffCommunityCharts:{identify:require('../dist/community-charts.js').identify,lookup:async()=>({charts:{},imports:{},sources:{},message:'No matching authored chart.'})}}});
 await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload('Unknown Artist - Unknown Song.wav');
 await until(()=>app.nodes.chartStatus.classes.has('error'));
 assert.match(app.nodes.chartStatus.textContent,/Not enough clear drum hits/);assert.equal(app.savedSongs.size,0);assert.deepEqual(app.requests,['drums']);
});
