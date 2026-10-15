const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const B=require('../dist/background-video.js');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(store){
  const entries=new Map(),events={},classes=new Set(),revoked=[],messages=[];let serial=0,plays=0;
  const video={style:{},hidden:true,paused:true,currentTime:0,duration:100,readyState:0,addEventListener:(type,fn)=>events[type]=fn,
    pause(){this.paused=true;},play(){plays++;this.paused=false;return Promise.resolve();},load(){this.currentTime=0;},removeAttribute(name){delete this[name];}};
  const stage={classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),remove:c=>classes.delete(c)}};
  const database=store||{get:async key=>entries.get(key),put:async(key,value)=>entries.set(key,{...value})};
  const player=B.create(video,stage,{store:database,url:{createObjectURL:()=>`blob:video-${++serial}`,revokeObjectURL:value=>revoked.push(value)},onChange:(value,message)=>messages.push({value,message})});
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
  for(const id of ['backgroundVideo','backgroundPreview','backgroundDialog','backgroundFile','backgroundMode','backgroundOffset','backgroundDim','backgroundRemove','backgroundDimValue','backgroundFilename','backgroundStatus']){
    nodes[id]={value:'',style:{},files:[],listeners:{},hidden:true,addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},async emit(type){for(const fn of this.listeners[type]||[])await fn();},pause(){this.paused=true;},load(){},removeAttribute(name){delete this[name];}};
  }
  const picker=nodes.backgroundFile;let disabled=false;Object.defineProperty(picker,'disabled',{get:()=>disabled,set:value=>{disabled=value;if(value)picker.files=[];}});
  nodes.backgroundVideo.closest=()=>({classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),remove:c=>classes.delete(c)}});
  const window={document:{getElementById:id=>nodes[id]},URL:{createObjectURL:()=> 'blob:selected-video',revokeObjectURL:()=>{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/background-video.js'),'utf8'),{window});await window.RiffBackground.selectSong('a');
  picker.files=[{name:'My footage.mp4',type:'video/mp4',size:123}];picker.value='C:\\fakepath\\My footage.mp4';await picker.emit('change');
  assert.equal(nodes.backgroundFilename.textContent,'My footage.mp4');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');assert.equal(nodes.backgroundMode.value,'video');assert.equal(nodes.backgroundPreview.src,'blob:selected-video');assert.equal(nodes.backgroundPreview.hidden,false);assert.ok(classes.has('video-background'));
  await nodes.backgroundDim.emit('change');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');await window.RiffBackground.selectSong('a');assert.equal(picker.value,'C:\\fakepath\\My footage.mp4');
  nodes.backgroundPreview.paused=false;await nodes.backgroundDialog.emit('close');assert.equal(nodes.backgroundPreview.paused,true);
  await nodes.backgroundRemove.emit('click');assert.equal(picker.value,'');assert.equal(nodes.backgroundPreview.hidden,true);assert.equal(nodes.backgroundRemove.disabled,true);
});

const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
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
  n.previewPosition.value='5';await n.previewButton.click();await until(()=>app.sources.length>0);const preview=app.sources.at(-1);app.tick(preview.when+1);assert.ok(Math.abs(calls.at(-1).time-6)<.001);await n.mobileBackButton.click();
  n.loopStart.value='2';n.loopEnd.value='8';n.practiceRate.value='.5';await n.practiceLaunch.click();await until(()=>app.sources.length>1);const practice=app.sources.at(-1);app.tick(practice.when-1);assert.equal(calls.at(-1).playing,false);assert.equal(calls.at(-1).time,2);
  app.tick(practice.when+2);assert.equal(calls.at(-1).rate,.5);assert.ok(Math.abs(calls.at(-1).time-3)<.001);app.tick(practice.when+13);assert.ok(Math.abs(calls.at(-1).time-2.5)<.001);await n.mobileBackButton.click();
});
