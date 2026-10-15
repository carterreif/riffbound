const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const E=require('../dist/engine.js'),T=require('../dist/playback-tools.js');
const adapter=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',prefix+'\nreturn {setup,until};')(createRequire(adapter));
const notes=[{lane:0,time:5,duration:0},{lane:1,time:6,duration:0},{lane:2,time:7,duration:0}];
async function appFor(options={}){const app=setup({chartFixture:notes,...options});await app.radios.difficulty[3].emit('change');await app.upload();return app;}
async function start(app){await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');return app.sources.at(-1);}
test('practice speed accepts every 5% step from 25–100%, and missed sections include lead-in and end context',()=>{
  for(let p=25;p<=100;p+=5)assert.equal(T.practice(4,8,p/100,16).rate,p/100);
  for(const value of [0,-1,1.5,NaN,Infinity])assert.equal(T.practice(4,8,value,16).rate,1);
  assert.deepEqual(T.missedSection(5,16),{start:2,end:10});assert.deepEqual(T.missedSection(.1,16),{start:0,end:8});assert.deepEqual(T.missedSection(15.9,16),{start:8,end:16});assert.equal(T.missedSection(null,16),null);assert.equal(T.missedSection(16,16),null);
});
test('successful-note feedback reports signed real milliseconds at reduced speed; sparse or autoplay samples produce no timing diagnosis',()=>{
  assert.deepEqual(T.timingFeedback(-.04),{ms:-40,kind:'early',text:'EARLY 40 ms'});assert.equal(T.timingFeedback(.026,.65).text,'LATE 40 ms');assert.equal(T.timingFeedback(.01).text,'ON TIME');assert.equal(T.timingFeedback(null),null);
  assert.equal(T.timingSummary([{hit:true,hitOffset:null},{hit:true}]),null);assert.equal(T.timingSummary(Array.from({length:7},()=>({hit:true,hitOffset:0}))),null);
  const samples=Array.from({length:8},(_,i)=>({hit:true,hitOffset:i===0?-.03:i===1?0:.026})),summary=T.timingSummary(samples,.65);assert.deepEqual(summary,{count:8,medianMs:40,early:1,late:6,onTime:1});
});
for(const instrument of ['guitar','drums','bass','vocals'])test(`${instrument} engine reports actual hit/miss times without changing score or authored notes`,()=>{
  const original=[{time:1,lane:0,duration:0},{time:2,lane:1,duration:0}],snapshot=JSON.stringify(original),session=new E.Session('expert','tap',instrument,{notes:original,musicEnd:16}),events=[];session.onJudge=(kind,lane,detail)=>events.push({kind,lane,detail});
  session.tap(0,.96);assert.equal(session.score,100);assert.ok(Math.abs(events[0].detail.error+.04)<1e-9);assert.equal(events[0].kind,'PERFECT');session.update(2.3,new Set());assert.equal(events[1].kind,'MISS');assert.equal(events[1].detail.time,2);assert.equal(session.misses,1);assert.equal(JSON.stringify(original),snapshot);
});
test('strummed chords retain their shared timestamp and roll taps do not create new timing samples',()=>{
  const s=new E.Session('expert','strum','guitar',{notes:[{time:1,lane:0,duration:0},{time:1,lane:1,duration:0}],musicEnd:16});assert.equal(s.strum(new Set([0,1]),1.03),true);assert.equal(s.hits,2);assert.equal(s.score,200);assert.ok(s.notes.every(n=>Math.abs(n.hitOffset-.03)<1e-9));
  const drum=new E.Session('expert','tap','drums',{notes:[{time:1,lane:0,duration:0,rollDuration:2}],musicEnd:16});drum.tap(0,1);drum.tap(0,1.2);assert.equal(drum.hits,1);assert.equal(drum.notes[0].hitOffset,0);
});
test('results open the last missed section for practice without recharting or decoding again',async()=>{
  const app=await appFor(),n=app.nodes,source=await start(app),requests=app.requests.length;app.tick(source.when+7.3);app.tick(source.when+18);assert.equal(n.resultDialog.open,true);assert.equal(n.resultPracticeMiss.hidden,false);
  await n.resultPracticeMiss.click();assert.equal(n.resultDialog.open,false);assert.equal(n.practiceDialog.open,true);assert.equal(n.loopStart.value,'4');assert.equal(n.loopEnd.value,'12');assert.match(n.practiceStatus.textContent,/0:07/);assert.equal(app.sources.length,1,'Choosing a section does not autoplay');
  n.practiceRepeat.checked=true;n.practiceRate.value='.65';await n.practiceLaunch.click();await until(()=>app.sources.length===2);const practice=app.sources.at(-1);assert.equal(practice.loop,true);assert.equal(practice.loopStart,4);assert.equal(practice.loopEnd,12);assert.equal(practice.playbackRate.value,.65);assert.equal(app.decodes,1);assert.equal(app.requests.length,requests);
});
test('Retry and R keep a practice loop, speed and count-in; paused retry starts over rather than resuming',async()=>{
  const app=await appFor(),n=app.nodes;n.practiceRepeat.checked=true;n.loopStart.value='4.5';n.loopEnd.value='7.5';n.practiceRate.value='.65';await n.practiceLaunch.click();await until(()=>app.sources.length===1);const first=app.sources[0];app.tick(first.when+(5.026-4.5)/.65);await app.key('keydown','KeyD');await app.key('keyup','KeyD');assert.equal(n.hitTiming.textContent,'LATE 40 ms');
  await n.pauseButton.click();await app.key('keydown','KeyR');await until(()=>app.sources.length===2);const next=app.sources.at(-1);assert.ok(first.stopped);assert.equal(next.offset,4.5);assert.equal(next.loop,true);assert.equal(next.loopEnd,7.5);assert.equal(next.playbackRate.value,.65);app.tick(next.when-.1);assert.equal(n.stageStatus.textContent,'GET READY');assert.equal(n.score.textContent,'000,000');
  await n.retryButton.click();await until(()=>app.sources.length===3);assert.equal(app.sources.at(-1).offset,4.5);assert.equal(app.sources.at(-1).playbackRate.value,.65);assert.equal(n.resultDialog.open,false);assert.equal(app.writes.filter(([key])=>key.startsWith('riffbound-')&&key.includes('expert')).length,0);
});
test('retry resets a scored run and ignores repeats, browser shortcuts, form fields and modal dialogs',async()=>{
  const app=await appFor(),n=app.nodes,first=await start(app);app.tick(first.when+5);await app.key('keydown','KeyD');await app.key('keyup','KeyD');app.tick(first.when+5.1);assert.equal(n.score.textContent,'000,100');
  for(const options of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{target:n.setlistSearch}])await app.key('keydown','KeyR',options);assert.equal(app.sources.length,1);
  for(const dialog of ['backgroundDialog','backupDialog','controllerDialog','timingDialog','helpDialog','libraryDialog','practiceDialog','offlineDialog','chartFilesDialog','addSongDialog']){n[dialog].open=true;await app.key('keydown','KeyR');n[dialog].open=false;}assert.equal(app.sources.length,1);
  await n.pauseButton.click();await n.retryButton.click();await until(()=>app.sources.length===2);const next=app.sources.at(-1);assert.equal(next.offset,0);assert.equal(next.loop,undefined);assert.ok(first.stopped);assert.equal(n.score.textContent,'000,000');
});
test('timing feedback honors calibration and opt-out, and results describe note timing without changing the saved offset',async()=>{
  const chart=Array.from({length:8},(_,i)=>({time:1+i,lane:0,duration:0})),app=await appFor({chartFixture:chart,preferences:{timingOffset:100}}),n=app.nodes,source=await start(app);
  for(let i=0;i<8;i++){app.tick(source.when+1+i+.15);await app.key('keydown','KeyD');await app.key('keyup','KeyD');if(i===0){assert.equal(n.hitTiming.textContent,'LATE 50 ms');n.showHitTiming.checked=false;await n.showHitTiming.emit('change');assert.equal(n.hitTiming.classList.contains('show'),false);}}
  app.tick(source.when+18);assert.equal(n.resultAccuracy.textContent,'100%');assert.match(n.resultTiming.textContent,/50 ms late/);assert.match(n.resultTiming.textContent,/0 early · 0 on time · 8 late/);const pref=JSON.parse(app.writes.findLast(([key])=>key==='riffbound-preferences-v1')[1]);assert.equal(pref.timingOffset,100);assert.equal(pref.showHitTiming,false);
  const fresh=setup({preferences:pref});assert.equal(fresh.nodes.showHitTiming.checked,false);
});
test('preview cannot create a missed-section suggestion and difficulty changes clear an earlier miss',async()=>{
  const app=await appFor(),n=app.nodes;await n.previewButton.click();await until(()=>app.sources.length===1);app.tick(app.sources[0].when+7.3);assert.equal(n.hitTiming.textContent,'');assert.equal(n.practiceMissButton.disabled,true);await n.mobileBackButton.click();
  const source=await start(app);app.tick(source.when+5.3);await n.practiceButton.click();assert.equal(n.practiceMissButton.disabled,false);n.practiceDialog.close();await n.mobileBackButton.click();await app.radios.difficulty[2].emit('change');await n.practiceButton.click();assert.equal(n.practiceMissButton.disabled,true);
});
test('cached HTML missing the new learning controls still plays and pauses',async()=>{
  const app=await appFor({missingControls:['retryButton','hitTiming','practiceMissButton','resultPracticeMiss','resultTiming','showHitTiming']}),source=await start(app);app.tick(source.when+5);await app.key('keydown','KeyD');await app.key('keyup','KeyD');await app.nodes.pauseButton.click();assert.equal(app.nodes.pauseText.textContent,'Resume');
});
test('fractional-speed practice and Retry prepare video at the original chart first-note offset',async()=>{
  const prepared=[],background={mode:'video',selectSong(){},pause(){},sync(){},prepare:async value=>prepared.push(value)},app=await appFor({browserOverrides:{RiffBackground:background}}),n=app.nodes;
  n.loopStart.value='6';n.loopEnd.value='9';n.practiceRate.value='.35';await n.practiceLaunch.click();await until(()=>app.sources.length===1);assert.equal(prepared.at(-1).time,1,'First full-chart note is at 5s; section starts at 6s');assert.equal(prepared.at(-1).rate,.35);
  await n.retryButton.click();await until(()=>app.sources.length===2);assert.equal(prepared.length,2);assert.equal(prepared.at(-1).time,1);assert.equal(prepared.at(-1).rate,.35);assert.equal(app.sources.at(-1).loopStart,6);
});
