const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const B=require('../dist/background-video.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(store,options={}){
  const entries=new Map(),handlers={},events=new Proxy({},{get:(_,type)=>()=>{for(const fn of [...(handlers[type]||[])])fn();}}),classes=new Set(),revoked=[],messages=[];let serial=0,plays=0;
  const video={style:{},hidden:true,paused:true,currentTime:0,duration:100,readyState:0,addEventListener:(type,fn)=>(handlers[type]??=new Set()).add(fn),removeEventListener:(type,fn)=>handlers[type]?.delete(fn),
    pause(){this.paused=true;},play(){plays++;this.paused=false;return Promise.resolve();},load(){this.currentTime=0;},removeAttribute(name){delete this[name];}};
  const stage={classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),remove:c=>classes.delete(c)}};
  const database=store||{get:async key=>entries.get(key),put:async(key,value)=>entries.set(key,{...value})};
  const player=B.create(video,stage,{store:database,url:{createObjectURL:()=>`blob:video-${++serial}`,revokeObjectURL:value=>revoked.push(value)},onChange:(value,message)=>messages.push({value,message}),...options});
  const file=Object.assign(new Blob(['video'],{type:'video/mp4'}),{name:'My Metallica gameplay.mp4'});
  return {player,video,events,classes,entries,revoked,messages,file,get plays(){return plays;},store:database};
}
test('background video stays muted and follows seek, pause, resume, restart, loop wrap and practice rate',async()=>{
  const f=fixture(),{player:p,video:v}=f;await p.selectSong('song-a');await p.choose(f.file);f.events.loadedmetadata();
  assert.equal(v.muted,true);assert.equal(v.volume,0);assert.equal(v.playsInline,true);assert.equal(v.loop,false);assert.ok(f.classes.has('video-background'));
  p.sync({time:12,playing:true,rate:.75});await flush();assert.equal(v.currentTime,12);assert.equal(v.playbackRate,.75);assert.equal(v.paused,false);
  p.pause();assert.equal(v.paused,true);p.sync({time:12,playing:false,rate:.75});await flush();assert.equal(v.paused,true);
  p.sync({time:12,playing:true,rate:1});await flush();assert.equal(v.paused,false);assert.equal(v.playbackRate,1);
  p.sync({time:2,playing:true});assert.equal(v.currentTime,2,'Practice wrap seeks back');p.sync({time:0,playing:false});assert.equal(v.currentTime,0);assert.equal(v.paused,true);
  p.sync({time:101,playing:true});assert.equal(v.paused,true);assert.ok(v.currentTime<100,'Short videos hold their last frame instead of looping out of sync');
});
test('background timing adjusts only video; negative offsets delay its start and long intros skip ahead',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);f.events.loadedmetadata();await p.settings({offset:10});
  p.sync({time:0,playing:false});assert.equal(f.video.currentTime,10);assert.equal(f.video.paused,true);p.sync({time:3,playing:true});await flush();assert.equal(f.video.currentTime,13);
  await p.settings({offset:-4});p.sync({time:2,playing:true});assert.equal(f.video.currentTime,0);assert.equal(f.video.paused,true);p.sync({time:5,playing:true});await flush();assert.equal(f.video.currentTime,1);assert.equal(f.video.paused,false);
});
test('video holds its starting frame through count-in, then starts on the song clock including sub-180ms offsets',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);f.events.loadedmetadata();await p.settings({offset:.12});
  p.sync({time:0,playing:false});assert.equal(f.video.currentTime,.12);assert.equal(f.plays,0);
  p.sync({time:0,playing:false});assert.equal(f.plays,0);
  f.video.currentTime=.16;p.sync({time:0,playing:true});await flush();assert.equal(f.video.currentTime,.12);assert.equal(f.video.paused,false);
  f.video.currentTime=.2;p.pause();p.sync({time:0,playing:false});assert.equal(f.video.currentTime,.12);assert.equal(f.video.paused,true);
  p.sync({time:.03,playing:true});await flush();assert.equal(f.video.currentTime,.15);
});
test('late-loaded or drifting video catches up to the current song time, and pause/resume locks the same frame',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);
  p.sync({time:20,playing:true});assert.equal(f.plays,0);f.events.loadedmetadata();p.sync({time:20.04,playing:true});await flush();assert.equal(f.video.currentTime,20.04);
  f.video.currentTime=20.06;p.sync({time:20.08,playing:true});assert.equal(f.video.currentTime,20.06,'Small running frame differences do not trigger repeated seeks');
  p.sync({time:20.3,playing:true});assert.equal(f.video.currentTime,20.3,'Correct larger drift against audio, rather than a separate video timer');
  p.pause();f.video.currentTime=20.33;p.sync({time:20.3,playing:false});assert.equal(f.video.currentTime,20.3);assert.equal(f.video.paused,true);
  f.video.currentTime=20.32;p.sync({time:20.3,playing:true});await flush();assert.equal(f.video.currentTime,20.3);
});
test('preparing a video waits for decoded data and the completed start seek, without playing during preparation',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);await p.settings({offset:3.2});
  let ready=false,time=0;Object.defineProperty(f.video,'currentTime',{get:()=>time,set:value=>{time=value;f.video.seeking=true;f.video.readyState=1;}});
  const pending=p.prepare({time:5,rate:.5}).then(()=>ready=true);f.video.readyState=1;f.events.loadedmetadata();await flush();assert.equal(ready,false,'Metadata is not a decoded video frame');
  f.video.readyState=2;f.events.loadeddata();await flush();assert.equal(f.video.currentTime,8.2);assert.equal(ready,false,'The frame seek must also complete');
  p.sync({time:0,playing:false});assert.equal(f.video.currentTime,8.2,'Loading frames cannot rewind the prepared preview/practice position');assert.equal(f.plays,0);
  f.video.readyState=2;f.video.seeking=false;f.events.seeked();await pending;assert.equal(ready,true);assert.equal(f.video.playbackRate,.5);assert.equal(f.video.paused,true);assert.equal(f.plays,0);
  p.sync({time:5,playing:false});assert.equal(f.plays,0);p.sync({time:5,playing:true});await flush();assert.equal(f.plays,1);
});
test('video preparation reports stalled decoders, supports cancellation and preserves actual codec errors',async()=>{
  const f=fixture(null,{readyTimeout:20});await f.player.selectSong('a');await f.player.choose(f.file);
  await assert.rejects(f.player.prepare(),error=>error.backgroundVideo&&/still loading or seeking/.test(error.message));assert.equal(f.plays,0);
  const pending=f.player.prepare(),canceled=assert.rejects(pending,error=>error.backgroundVideo&&/canceled/.test(error.message));f.player.pause();await canceled;
  const failed=f.player.prepare(),codec=assert.rejects(failed,error=>error.backgroundVideo&&/media error 4/.test(error.message));f.video.error={code:4};f.events.error();await codec;
});
test('a paused or previous run cannot queue a new video start into the next count-in',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);f.video.readyState=2;f.events.loadedmetadata();
  const completions=[];f.video.play=()=>new Promise(resolve=>completions.push(()=>{f.video.paused=false;resolve();}));
  p.sync({time:1,playing:true});assert.equal(completions.length,1,'Play is requested only in the running frame, never a later microtask');
  p.pause();const preparing=p.prepare({time:0});await preparing;completions.shift()();await flush();assert.equal(f.video.paused,true,'Late play completion is stopped during the next count-in');
  p.sync({time:0,playing:false});assert.equal(completions.length,0);p.sync({time:0,playing:true});assert.equal(completions.length,1);completions.shift()();await flush();assert.equal(f.video.paused,false);
});
test('each song restores its own file, mode, offset and darkness after switching and reopening',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);await p.settings({offset:10,dim:50});const url=f.video.src;
  await p.selectSong('b');assert.equal(p.mode,'stage');assert.equal(f.video.hidden,true);assert.ok(f.revoked.includes(url));await p.settings({mode:'dark'});assert.ok(f.classes.has('dark-background'));
  await p.selectSong('a');assert.equal(p.mode,'video');assert.equal(f.messages.at(-1).value.offset,10);assert.equal(f.video.style.filter,'brightness(0.5)');assert.equal(f.entries.get('a').file,f.file);
  const reopened=fixture(f.store);await reopened.player.selectSong('a');assert.equal(reopened.player.mode,'video');assert.equal(reopened.messages.at(-1).value.name,f.file.name);
  await p.clear();assert.equal(p.mode,'stage');assert.equal(f.entries.get('a').file,null);assert.equal(f.video.hidden,true);
});
test('slow prior-song reads cannot overwrite a later choice or another song',async()=>{
  let resolve;const f=fixture({get:key=>key==='a'?new Promise(r=>resolve=r):Promise.resolve(),put:async()=>{}});
  const pending=f.player.selectSong('a');await f.player.selectSong('b');await f.player.settings({mode:'dark'});resolve({mode:'video',file:f.file});await pending;assert.equal(f.player.mode,'dark');assert.equal(f.video.src,undefined);
});
test('bad files, unsupported codecs, quota failures and rejected play keep charts usable and report recovery',async()=>{
  const f=fixture({get:async()=>null,put:async()=>{throw Error('Quota');}}),p=f.player;await p.selectSong('a');
  assert.equal(await p.choose(Object.assign(new Blob(['bad']),{name:'notes.chart'})),false);assert.equal(p.mode,'stage');
  await p.choose(f.file);assert.match(f.messages.at(-1).message,/works for this session.*could not be saved/);assert.equal(p.busy,false);f.events.loadedmetadata();
  f.video.play=()=>Promise.reject(Error('Unsupported'));p.sync({time:1,playing:true});await flush();assert.match(f.messages.at(-1).message,/could not play/);
  f.video.error={code:4};f.events.error();assert.equal(p.mode,'stage');assert.equal(f.video.hidden,true);assert.equal(f.classes.has('video-background'),false);assert.match(f.messages.at(-1).message,/My Metallica gameplay.mp4.*media error 4.*H.264/);
});
test('pending background writes block reload, and a late video play completion cannot undo a pause',async()=>{
  let finish;const f=fixture({get:async()=>null,put:()=>new Promise(resolve=>finish=resolve)}),p=f.player;await p.selectSong('a');const pending=p.choose(f.file);await flush();assert.equal(p.busy,true);finish();await pending;assert.equal(p.busy,false);
  f.events.loadedmetadata();let played;f.video.play=()=>new Promise(resolve=>played=()=>{f.video.paused=false;resolve();});p.sync({time:1,playing:true});await flush();p.pause();played();await flush();assert.equal(f.video.paused,true);
});
test('cancel, empty and wrong files have distinct results; large videos play without writing their blob',async()=>{
  const f=fixture(),p=f.player;await p.selectSong('a');await p.choose(f.file);const count=f.messages.length;
  assert.equal(await p.choose(null),false);assert.equal(f.messages.length,count);assert.equal(p.hasVideo,true);
  await p.choose({name:'Empty.mp4',size:0,type:'video/mp4'});assert.match(f.messages.at(-1).message,/Empty.mp4.*empty/);
  await p.choose({name:'Shortcut.url',size:40,type:''});assert.match(f.messages.at(-1).message,/Shortcut.url.*not a video/);
  await p.choose({name:'Long gameplay.mp4',size:700*1024*1024,type:''});assert.equal(p.mode,'video');assert.equal(f.entries.get('a').file,null);assert.match(f.messages.at(-1).message,/larger than 500 MB.*not stored/);
  f.events.loadedmetadata();p.sync({time:12,playing:true});await flush();assert.equal(f.video.paused,false);assert.equal(f.video.preload,'auto');
});
test('a late successful storage write cannot hide the actual codec error',async()=>{
  let finish;const f=fixture({get:async()=>null,put:()=>new Promise(resolve=>finish=resolve)});await f.player.selectSong('a');const pending=f.player.choose(f.file);await flush();
  f.video.error={code:4};f.events.error();finish();await pending;assert.match(f.messages.at(-1).message,/media error 4/);assert.doesNotMatch(f.messages.at(-1).message,/Background saved/);
});
test('real picker wiring captures the file before disabling, retains its name, and opens the chooser preview',async()=>{
  const vm=require('node:vm'),nodes={},classes=new Set();
  for(const id of ['backgroundVideo','backgroundPreview','backgroundDialog','backgroundFile','backgroundMode','backgroundOffset','backgroundDim','backgroundRemove','backgroundDimValue','backgroundFilename','backgroundStatus','backgroundPreviewTiming','backgroundTimingHint']){
    nodes[id]={value:'',style:{},files:[],listeners:{},hidden:true,addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},async emit(type){for(const fn of this.listeners[type]||[])await fn();},pause(){this.paused=true;},load(){},removeAttribute(name){delete this[name];}};
  }
  const picker=nodes.backgroundFile;let disabled=false;Object.defineProperty(picker,'disabled',{get:()=>disabled,set:value=>{disabled=value;if(value)picker.files=[];}});
  nodes.backgroundVideo.closest=()=>({classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),remove:c=>classes.delete(c)}});
  const window={document:{getElementById:id=>nodes[id]},URL:{createObjectURL:()=> 'blob:selected-video',revokeObjectURL:()=>{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/background-video.js'),'utf8'),{window});await window.RiffBackground.selectSong('a');
  picker.files=[{name:'My footage.mp4',type:'video/mp4',size:123}];picker.value='C:\\fakepath\\My footage.mp4';await picker.emit('change');
  assert.equal(nodes.backgroundFilename.textContent,'My footage.mp4');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');assert.equal(nodes.backgroundMode.value,'video');assert.equal(nodes.backgroundPreview.src,'blob:selected-video');assert.equal(nodes.backgroundPreview.hidden,false);assert.ok(classes.has('video-background'));
  assert.equal(nodes.backgroundPreviewTiming.disabled,false);
  nodes.backgroundOffset.value='7.5';await nodes.backgroundOffset.emit('input');assert.equal(nodes.backgroundPreview.currentTime,undefined,'Wait for video metadata before seeking the preview');
  nodes.backgroundPreview.readyState=1;nodes.backgroundPreview.duration=100;await nodes.backgroundPreview.emit('loadedmetadata');assert.equal(nodes.backgroundPreview.currentTime,7.5);assert.match(nodes.backgroundTimingHint.textContent,/7.5 seconds.*first note/);
  await window.RiffBackground.commitTiming();assert.equal(nodes.backgroundOffset.value,7.5,'Commit the current form value without requiring a blur event');
  nodes.backgroundPreview.currentTime=30;window.RiffBackground.showTimingFrame();assert.equal(nodes.backgroundPreview.currentTime,7.5,'Reopening settings returns to the configured frame');
  nodes.backgroundOffset.value='-2';await nodes.backgroundOffset.emit('input');assert.equal(nodes.backgroundPreview.currentTime,0);assert.match(nodes.backgroundTimingHint.textContent,/waits 2.0 seconds after the first note/);await window.RiffBackground.commitTiming();
  await nodes.backgroundDim.emit('change');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');await window.RiffBackground.selectSong('a');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');
  nodes.backgroundPreview.paused=false;await nodes.backgroundDialog.emit('close');assert.equal(nodes.backgroundPreview.paused,true);
  nodes.backgroundPreview.paused=false;window.RiffBackground.pause();assert.equal(nodes.backgroundPreview.paused,true,'Play track stops preview playback even before a dialog close event');
  await nodes.backgroundRemove.emit('click');assert.equal(picker.value,'');assert.equal(nodes.backgroundPreview.hidden,true);assert.equal(nodes.backgroundRemove.disabled,true);assert.equal(nodes.backgroundPreviewTiming.disabled,true);
});

const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const part of ['guitar','drums','bass','vocals'])for(const offset of [7.5,-1.5])test(`${part} timing preview applies ${offset}s from the form and uses the same first-note trigger as playback`,async()=>{
  const f=fixture();await f.player.selectSong('fixture');await f.player.choose(f.file);f.video.readyState=2;f.events.loadedmetadata();let n,commits=0;
  const bg={selectSong:()=>{},pause:()=>f.player.pause(),prepare:options=>f.player.prepare(options),sync:options=>f.player.sync(options),commitTiming:()=>{commits++;return f.player.settings({offset:n.backgroundOffset.value});},get mode(){return f.player.mode;}};
  const app=setup({chartFixture:[{lane:part==='drums'?5:0,time:3,duration:0},{lane:part==='drums'?0:1,time:5,duration:0}],browserOverrides:{RiffBackground:bg}});n=app.nodes;
  await app.radios.instrument.find(r=>r.value===part).emit('change');await app.upload();await until(()=>!n.saveCurrentButton.disabled);
  n.backgroundDialog.open=true;n.backgroundOffset.value=String(offset);await n.backgroundPreviewTiming.click();await until(()=>app.sources.length===1);
  assert.equal(commits,1);assert.equal(n.backgroundDialog.open,false);assert.equal(n.previewButton.textContent,'■ Stop preview');const source=app.sources[0];assert.equal(source.offset,1,'Replay the two-second lead-in to the first note');
  app.tick(source.when+1.99);await flush();assert.equal(f.video.paused,true);assert.equal(f.video.currentTime,Math.max(0,offset));
  if(offset>0){app.tick(source.when+2.001);await flush();assert.equal(f.video.paused,false);assert.ok(Math.abs(f.video.currentTime-offset)<.01);app.tick(source.when+2.5);assert.ok(Math.abs(f.video.currentTime-offset-.5)<.001);}
  else{app.tick(source.when+3.49);await flush();assert.equal(f.video.paused,true,'Preview includes the configured extra delay');app.tick(source.when+3.51);await flush();assert.equal(f.video.paused,false);assert.ok(Math.abs(f.video.currentTime-.01)<.001);}
  assert.equal(app.writes.filter(([key])=>key.includes('best')).length,0,'Timing previews do not save a score');await n.mobileBackButton.click();
});
test('timing preview cannot start when no video is selected',async()=>{
  const app=setup({browserOverrides:{RiffBackground:{mode:'stage',selectSong:()=>{},pause:()=>{},sync:()=>{}}}});await app.nodes.backgroundPreviewTiming.click();assert.equal(app.sources.length,0);
});
for(const preview of [false,true])test(`${preview?'Preview chart':'Play track'} holds the real video through the intro and starts it on the first kick at the hit line`,async()=>{
  const f=fixture();await f.player.selectSong('fixture');await f.player.choose(f.file);f.video.readyState=2;f.events.loadedmetadata();
  const bg={selectSong:()=>{},pause:()=>f.player.pause(),prepare:options=>f.player.prepare(options),sync:options=>f.player.sync(options),get mode(){return f.player.mode;}};
  const app=setup({chartFixture:[{lane:5,time:3,duration:0},{lane:0,time:5,duration:0}],browserOverrides:{RiffBackground:bg}}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.upload();await until(()=>!n.saveCurrentButton.disabled);const saved=JSON.stringify([...app.savedSongs.values()][0].charts);
  await n[preview?'previewButton':'playButton'].click();await until(()=>app.sources.length===1);const first=app.sources[0];
  app.tick(first.when+.01);await flush();assert.equal(f.video.paused,true);assert.equal(f.video.currentTime,0);assert.equal(f.plays,0);
  app.tick(first.when+2.99);await flush();assert.equal(f.video.paused,true);assert.equal(f.plays,0,'The video must not play while notes are still approaching');
  app.tick(first.when+3.001);await flush();assert.equal(f.video.paused,false);assert.equal(f.plays,1);assert.ok(f.video.currentTime<.01);
  app.tick(first.when+3.5);assert.ok(Math.abs(f.video.currentTime-.5)<.001);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),saved,'Starting the video does not move chart notes');
  await n.mobileBackButton.click();app.tick(first.when+4);assert.equal(f.video.paused,true);assert.equal(f.video.currentTime,0);
  await n[preview?'previewButton':'playButton'].click();await until(()=>app.sources.length===2);const restarted=app.sources[1];app.tick(restarted.when+2.99);assert.equal(f.video.paused,true);assert.equal(f.plays,1);
  app.tick(restarted.when+3.001);await flush();assert.equal(f.plays,2);assert.ok(f.video.currentTime<.01);await n.mobileBackButton.click();
});
test('the video starts on the visible chart hit line after device timing calibration',async()=>{
  const states=[],app=setup({preferences:{timingOffset:200},chartFixture:[{lane:0,time:3,duration:0}],browserOverrides:{RiffBackground:{selectSong:()=>{},pause:()=>{},sync:value=>states.push(value),mode:'video'}}}),n=app.nodes;
  await app.upload();await until(()=>!n.saveCurrentButton.disabled);await n.playButton.click();await until(()=>app.sources.length===1);const source=app.sources[0];
  app.tick(source.when+3.19);assert.equal(states.at(-1).playing,false);assert.equal(states.at(-1).time,0);app.tick(source.when+3.21);assert.equal(states.at(-1).playing,true);assert.ok(Math.abs(states.at(-1).time-.01)<.001);await n.mobileBackButton.click();
});
test('Play track schedules neither audio nor count-in until video preparation finishes, and re-prepares on resume',async()=>{
  const preparations=[],states=[];let finish;
  const bg={mode:'video',pause:()=>{},selectSong:()=>{},sync:value=>states.push(value),prepare:options=>{preparations.push(options);return new Promise(resolve=>finish=resolve);}};
  const app=setup({chartFixture:[{lane:0,time:2,duration:0}],browserOverrides:{RiffBackground:bg}}),n=app.nodes;
  await app.upload();await until(()=>!n.saveCurrentButton.disabled);await n.playButton.click();await until(()=>preparations.length===1);
  assert.equal(app.sources.length,0);assert.equal(n.announceSmall.textContent,'PREPARING VIDEO');app.tick(10);assert.equal(states.at(-1).playing,false);assert.equal(preparations[0].time,0);
  finish();await until(()=>app.sources.length===1);const source=app.sources[0];assert.ok(source.when>10);app.tick(source.when-.5);assert.equal(states.at(-1).playing,false);app.tick(source.when);assert.equal(states.at(-1).playing,false);app.tick(source.when+2);assert.equal(states.at(-1).playing,true);
  app.tick(source.when+2);await n.pauseButton.click();await n.playButton.click();await until(()=>preparations.length===2);assert.equal(preparations[1].time,0);assert.equal(app.audio.state,'suspended');app.tick(source.when+3);assert.equal(states.at(-1).playing,false);
  finish();await until(()=>n.playText.textContent==='RESTART TRACK');assert.equal(app.audio.state,'running');await n.mobileBackButton.click();
});
test('video readiness failure prevents chart/audio start and shows the video-specific recovery message',async()=>{
  const app=setup({chartFixture:[{lane:0,time:2,duration:0}],browserOverrides:{RiffBackground:{mode:'video',pause:()=>{},selectSong:()=>{},sync:()=>{},prepare:async()=>{throw Object.assign(Error('The video is still loading or seeking.'),{backgroundVideo:true});}}}}),n=app.nodes;
  await app.upload();await until(()=>!n.saveCurrentButton.disabled);await n.playButton.click();await until(()=>n.announceSmall.textContent==='VIDEO NOT READY');assert.equal(app.sources.length,0);assert.match(n.statusMessage.textContent,/video is still loading or seeking/);assert.equal(n.playButton.disabled,false);
});
test('game transport drives video from song audio through count-in, play, pause and restart; chooser pauses play',async()=>{
  const calls=[],songs=[];let pauses=0;const bg={selectSong:id=>songs.push(id),sync:state=>calls.push(state),pause:()=>pauses++,mode:'video',busy:false};
  const app=setup({browserOverrides:{RiffBackground:bg}}),n=app.nodes;assert.equal(songs.at(-1),'demo');
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const src=app.sources.at(-1);app.tick(src.when-1);assert.equal(calls.at(-1).playing,false);assert.equal(calls.at(-1).time,0);
  app.tick(src.when+3);assert.equal(calls.at(-1).playing,true);assert.ok(Math.abs(calls.at(-1).time-3)<.001);
  await n.backgroundButton.click();assert.equal(n.backgroundDialog.open,true);assert.equal(n.playText.textContent,'RESUME TRACK');assert.ok(pauses>0);app.tick(src.when+3);assert.equal(calls.at(-1).playing,false);
  const count=app.sources.length;await app.key('keydown','Enter');assert.equal(app.sources.length,count);assert.equal(n.playText.textContent,'RESUME TRACK');
  n.backgroundDialog.close();await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');app.tick(src.when+4);assert.equal(calls.at(-1).playing,true);await n.mobileBackButton.click();app.tick(src.when+5);assert.equal(calls.at(-1).playing,false);
  bg.busy=true;assert.equal(app.updateSafety.canReload(),false);bg.busy=false;assert.equal(app.updateSafety.canReload(),true);
});
test('uploaded song video follows preview seek and practice loop speed including the practice count-in',async()=>{
  const calls=[],songs=[],app=setup({chartFixture:[{lane:0,time:2,duration:0},{lane:0,time:6,duration:0}],browserOverrides:{RiffBackground:{selectSong:id=>songs.push(id),sync:value=>calls.push(value),pause:()=>{},mode:'video'}}}),n=app.nodes;
  await app.upload();await until(()=>!n.saveCurrentButton.disabled);assert.equal(songs.at(-1),[...app.savedSongs.keys()][0]);
  n.previewPosition.value='5';await n.previewButton.click();await until(()=>app.sources.length>0);const preview=app.sources.at(-1);app.tick(preview.when+1);assert.ok(Math.abs(calls.at(-1).time-4)<.001);await n.mobileBackButton.click();
  n.loopStart.value='2';n.loopEnd.value='8';n.practiceRate.value='.5';await n.practiceLaunch.click();await until(()=>app.sources.length>1);const practice=app.sources.at(-1);app.tick(practice.when-1);assert.equal(calls.at(-1).playing,false);assert.equal(calls.at(-1).time,0);
  app.tick(practice.when+2);assert.equal(calls.at(-1).rate,.5);assert.ok(Math.abs(calls.at(-1).time-1)<.001);app.tick(practice.when+13);assert.ok(Math.abs(calls.at(-1).time-.5)<.001);await n.mobileBackButton.click();
});
