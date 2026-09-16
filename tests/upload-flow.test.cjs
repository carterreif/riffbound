// Exercise the real UI handlers with deterministic audio/DOM adapters; no live browser required.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const E=require('../dist/engine.js');
const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
const game=fs.readFileSync(require.resolve('../dist/game.js'),'utf8');
const workerCode=fs.readFileSync(require.resolve('../dist/autochart.js'),'utf8');
function setup({mobile=false,chartFixture=null,chartResultExtras={},chartFailures={},preferences={},savedSongs=new Map(),storageFailure=false,libraryOverrides={},audioSamples=null,uploadBytes=null,resumeStorage=new Map()}={}){
  const lines=[],noop=()=>{},gradient={addColorStop:noop},context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,lineTo:(x,y)=>lines.push([x,y])},{get:(o,k)=>o[k]??noop});
  class Element{
    constructor(id=''){this.id=id;this.listeners={};this.style={setProperty:noop};this.dataset={};this.value='';this.textContent='';this.innerHTML='';this.open=false;this.disabled=false;this.hidden=false;this.children=[];this.classes=new Set();this.classList={add:(...v)=>v.forEach(s=>this.classes.add(s)),remove:(...v)=>v.forEach(s=>this.classes.delete(s)),contains:s=>this.classes.has(s),toggle:(s,on)=>{if(on??!this.classes.has(s))this.classes.add(s);else this.classes.delete(s);}};}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    emit(type,event={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn({target:this,currentTarget:this,preventDefault:noop,...event})));}
    click(){this.clicked=true;return this.emit('click');}blur(){}setAttribute(key,value){this[key]=value;}querySelectorAll(){return this.children;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}remove(){}
    getContext(){return context;}getBoundingClientRect(){return this.rect||(this.id==='fretControls'?{top:631,left:45.5,width:559,height:58}:{top:0,left:0,width:650,height:750});}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;}
  }
  class Input extends Element{}class Button extends Element{}
  const nodes={};for(const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const [tag,type,id]=match;const node=new (type==='input'?Input:type==='button'?Button:Element)(id);node.value=tag.match(/\bvalue="([^"]+)"/)?.[1]||'';node.hidden=/\shidden(?:\s|>)/.test(tag);nodes[id]=node;}
  nodes.chartScope.value='single';nodes.partGuitar.checked=true;nodes.partDrums.checked=true;nodes.partBass.checked=false;nodes.partVocals.checked=false;
  nodes.chartOverview.width=600;nodes.chartOverview.height=72;
  nodes.drumLabels.children=Array.from({length:5},()=>new Element());nodes.driveBars.children=Array.from({length:8},()=>new Element());
  const frets=Array.from({length:5},(_,i)=>{const b=new Button();b.dataset.lane=String(i);return b;}),smalls=Array.from({length:4},()=>new Element());
  const radios=Object.fromEntries(Object.entries({difficulty:['easy','medium','hard','expert'],mode:['tap','strum'],instrument:['guitar','drums','bass','vocals'],chartTarget:['guitar','drums','bass','vocals']}).map(([name,values])=>[name,values.map(value=>{const n=new Input();n.value=value;return n;})]));
  const document={body:new Element(),hidden:false,listeners:{},createElement:tag=>tag==='button'?new Button():new Element(),getElementById:id=>{assert.ok(nodes[id],`Missing DOM id ${id}`);return nodes[id];},querySelectorAll:selector=>selector==='[data-lane]'?frets:selector==='.difficulty-row small'?smalls:selector==='[data-close]'?[]:radios[selector.match(/input\[name=(\w+)\]/)?.[1]]||[],addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}};
  const sampleRate=22050,samples=audioSamples||new Float32Array(sampleRate*16);let seed=91;
  if(!audioSamples)for(let time=.5;time<15.5;time+=.25)for(let i=0;i<sampleRate*.12;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/sampleRate;samples[Math.round(time*sampleRate)+i]+=(Math.sin(2*Math.PI*(220+time*13)*t)*.4+(seed/2147483648-1)*.15)*Math.exp(-t*40);}
  const buffer={sampleRate,numberOfChannels:1,length:samples.length,duration:samples.length/sampleRate,getChannelData:()=>samples};
  const sources=[],writes=[],requests=[],requestIds=[];let decodes=0,audio=null,deferDecode=null,raf=null;
  const makeNode=()=>({connect:noop,disconnect:noop,start:noop,stop:noop,playbackRate:{value:1},frequency:{value:0},gain:{value:0,setValueAtTime:noop,exponentialRampToValueAtTime:noop,setTargetAtTime:noop}});
  class AudioContext{
    constructor(){audio=this;this.currentTime=0;this.sampleRate=sampleRate;this.destination={};this.state='suspended';}
    createGain(){return makeNode();}createOscillator(){return makeNode();}
    createBufferSource(){const node=makeNode();node.start=(when,offset)=>{node.when=when;node.offset=offset;};node.stop=()=>node.stopped=true;sources.push(node);return node;}
    async decodeAudioData(bytes){decodes++;const firstByte=new Uint8Array(bytes)[0];structuredClone(bytes,{transfer:[bytes]});if(firstByte===0)throw Error('codec');if(deferDecode)return new Promise(resolve=>{deferDecode.resolve=()=>resolve(buffer);});return buffer;}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}
  }
  class OfflineAudioContext{createBufferSource(){return makeNode();}createChannelSplitter(){return makeNode();}async startRendering(){return buffer;}}
  class Worker{
    constructor(path){assert.equal(path,'autochart.js');this.dead=false;if(chartFixture)return;const sandbox={Math,Float32Array,postMessage:data=>{if(!this.dead)this.onmessage?.({data});}};sandbox.self=sandbox;vm.createContext(sandbox);sandbox.importScripts=path=>{assert.ok(['drum-separation.js','reference-charts.js','chart-difficulties.js'].includes(path));vm.runInContext(fs.readFileSync(require.resolve('../dist/'+path),'utf8'),sandbox);};vm.runInContext(workerCode,sandbox);this.sandbox=sandbox;}
    postMessage(data){requests.push(data.instrument);requestIds.push(data.audioId);setImmediate(()=>{if(this.dead)return;if(chartFailures[data.instrument]){this.onmessage({data:{type:'error',message:chartFailures[data.instrument]}});return;}const fixture=typeof chartFixture==='function'?chartFixture(data.instrument):chartFixture;if(chartFixture)this.onmessage({data:{type:'complete',result:{...(typeof chartResultExtras==='function'?chartResultExtras(data.instrument):chartResultExtras),charts:{[data.instrument]:Array.isArray(fixture)?{easy:fixture,normal:fixture,expert:fixture}:fixture},waveform:[0,.5,1,.5],bpm:120,beat:.5}}});else this.sandbox.onmessage({data});});}terminate(){this.dead=true;}
  }
  const libraryCode=require('../dist/song-library.js'),library={...libraryCode,list:async()=>[...savedSongs.values()],get:async id=>savedSongs.get(id),save:async song=>{if(storageFailure)throw Error('Quota exceeded');savedSongs.set(song.id,{...libraryCode.metadata(song),audioBlob:song.audioBlob});},remove:async id=>savedSongs.delete(id),...libraryOverrides};
  const window={RiffReferenceUpdates:require('../dist/reference-updates.js'),RiffEngine:E,RiffChartExchange:require('../dist/chart-exchange.js'),RiffPlayback:require('../dist/playback-tools.js'),RiffLibrary:library,RiffMotion:require('../dist/performance-motion.js'),RiffAudioClock:require('../dist/audio-clock.js'),RiffStage:{create:()=>({resize:noop,draw:noop})},AudioContext,OfflineAudioContext,Worker,matchMedia:q=>({matches:mobile&&!q.includes('reduced-motion')}),devicePixelRatio:1,addEventListener:noop};
  let resize=()=>{};
  let calibrationTimer=null;
  const sandbox={window,document,sessionStorage:{getItem:key=>resumeStorage.get(key)||null,setItem:(key,value)=>resumeStorage.set(key,value),removeItem:key=>resumeStorage.delete(key)},Worker,Blob,URL,TextEncoder,performance:{now:()=>(audio?.currentTime||0)*1000},crypto:webcrypto,Float32Array,Uint8Array,HTMLInputElement:Input,HTMLButtonElement:Button,ResizeObserver:class{constructor(fn){resize=fn;}observe(){}},getComputedStyle:()=>({height:'58px',columnGap:'4px'}),localStorage:{getItem:key=>key==='riffbound-preferences-v1'?JSON.stringify(preferences):null,setItem:(...args)=>writes.push(args)},requestAnimationFrame:fn=>{raf=fn;},setTimeout:(fn,delay)=>{if(delay===6750){calibrationTimer=fn;return -1;}return setTimeout(fn,delay);},clearTimeout};
  vm.createContext(sandbox);vm.runInContext(game,sandbox);
  const upload=async(name='My original.wav',flag=1)=>{nodes.songFile.files=[{name,size:uploadBytes?.length||100,arrayBuffer:async()=>new Uint8Array(uploadBytes||[flag,1,2,3]).buffer}];await nodes.songFile.emit('change');};
  const tick=t=>{audio.currentTime=t;raf(t*1000);};
  const key=async(type,code)=>Promise.all((document.listeners[type]||[]).map(fn=>fn({code,repeat:false,target:document.body,preventDefault:noop})));
  return {updateSafety:window.RiffUpdateSafety,resumeStorage,nodes,radios,frets,smalls,sources,writes,requests,requestIds,savedSongs,runCalibrationTimer:()=>calibrationTimer?.(),body:document.body,lines,key,resize:()=>resize(),get decodes(){return decodes;},upload,tick,get audio(){return audio;},defer:()=>{deferDecode={};return deferDecode;},clearDefer:()=>{deferDecode=null;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await settle();}assert.fail('UI did not reach its expected state');}

test('empty Manage songs explains disabled Save and uploads drums into the real setlist without Blob writes',async()=>{
  const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true});
  const app=setup({chartFixture:[{lane:1,time:1,duration:0}],libraryOverrides:s.library}),n=app.nodes;
  await n.libraryButton.click();assert.equal(n.saveCurrentButton.disabled,true);assert.equal(n.exportCurrentButton.disabled,true);
  assert.equal(n.libraryEmptyActions.hidden,false);assert.match(n.librarySaveStatus.textContent,/No uploaded song is open/);
  await n.libraryUploadDrums.click();assert.equal(n.songFile.clicked,true);assert.equal(n.libraryDialog.open,false);
  await app.upload('Drum setlist.wav');await until(()=>n.saveStatus.textContent.includes('Added to your setlist'));
  assert.deepEqual(app.requests,['drums']);assert.equal(n.setlistEntries.children.length,2);
  await n.libraryButton.click();assert.equal(n.libraryEmptyActions.hidden,true);assert.equal(n.saveCurrentButton.disabled,false);
  const fresh=setup({chartFixture:[],libraryOverrides:s.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.trackTitle.textContent,'Drum setlist');
  assert.equal(fresh.decodes,1);assert.equal(fresh.requests.length,0,'Reopen saved audio and chart without analysis');
  assert.match(fresh.nodes.chartSummary.textContent,/Drums/);assert.equal(fresh.nodes.playButton.disabled,false);
});

test('persistent disk IO errors remain actionable and never show a false save confirmation',async()=>{
  const app=setup({chartFixture:[],libraryOverrides:{save:async()=>{throw new DOMException('Failed to write blobs (IOError)','UnknownError');}}});
  await app.upload('Keep backup.wav');await until(()=>app.nodes.saveStatus.textContent.includes('Could not save'));
  await app.nodes.libraryButton.click();assert.match(app.nodes.librarySaveStatus.textContent,/browser could not write/);
  assert.doesNotMatch(app.nodes.librarySaveStatus.textContent,/Added to your setlist/);assert.equal(app.nodes.exportCurrentButton.disabled,false);
  assert.equal(app.nodes.saveCurrentButton.disabled,false);assert.equal(app.nodes.setlistEntries.children.length,1);
});

test('upload → instrument/difficulty preview → seek → play → results → demo',async()=>{
  const app=setup(),n=app.nodes;
  await n.uploadButton.click();assert.equal(n.songFile.clicked,true);
  await app.upload('My <original>.wav');
  assert.equal(n.trackTitle.textContent,'My <original>');assert.match(n.chartStatus.textContent,/ready/i);assert.equal(n.chartPreview.hidden,false);assert.equal(n.playButton.disabled,false);
  assert.match(n.trackBpm.textContent,/BPM/);assert.match(n.chartSummary.textContent,/Guitar/);
  await app.radios.instrument[1].emit('change');assert.match(n.chartSummary.textContent,/Drums/);
  await app.radios.difficulty[0].emit('change');assert.match(n.chartSummary.textContent,/Easy/);
  assert.ok(app.frets.every(f=>!f.classList.contains('disabled-lane')),'All five drum pads must work in Easy');
  assert.equal(app.smalls[0].textContent,'FEWER HITS');assert.match(n.chartMapping.textContent,/Green: floor tom/);
  n.previewPosition.value='5';await n.previewPosition.emit('input');assert.equal(n.previewTime.textContent,'0:05');
  await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
  assert.equal(app.sources.at(-1).offset,5);app.tick(1);assert.match(n.stageStatus.textContent,/PREVIEW/);assert.equal(n.score.textContent,'000,000');assert.equal(app.writes.length,0);
  n.previewPosition.value='10';await n.previewPosition.emit('change');await until(()=>app.sources.at(-1).offset===10);assert.ok(app.sources.at(-2).stopped);
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');assert.equal(app.sources.at(-1).offset,0);assert.equal(n.previewButton.textContent,'▶ Preview chart');
  app.tick(app.sources.at(-1).when+2);await n.pauseButton.click();assert.equal(n.pauseText.textContent,'Resume');await n.pauseButton.click();await settle();assert.equal(n.pauseText.textContent,'Pause');
  app.tick(app.sources.at(-1).when+18);assert.equal(n.resultDialog.open,true);assert.match(n.resultNotes.textContent,/Drums/);
  await n.backButton.click();await n.demoButton.click();assert.equal(n.chartPreview.hidden,true);assert.match(n.trackTitle.innerHTML,/VOLTAGE/);assert.equal(n.trackBpm.textContent,'112 BPM');
});

test('preview completion never submits a score or opens results',async()=>{
  const app=setup();await app.upload();await app.nodes.previewButton.click();await until(()=>app.nodes.previewButton.textContent.includes('Stop'));
  app.tick(app.sources.at(-1).when+18);assert.equal(app.nodes.resultDialog.open,false);assert.equal(app.writes.length,0);assert.equal(app.nodes.previewButton.textContent,'▶ Preview chart');
});

test('failed and canceled uploads preserve the previous song and ignore late decoding',async()=>{
  const app=setup();await app.upload('Keep me.wav');await app.upload('invalid.mp3',0);
  assert.match(app.nodes.chartStatus.textContent,/could not be opened/);assert.equal(app.nodes.trackTitle.textContent,'Keep me');assert.equal(app.nodes.playButton.disabled,false);
  const pending=app.defer(),task=app.upload('Do not replace me.wav');await until(()=>pending.resolve);
  assert.equal(app.nodes.playButton.disabled,true);await app.nodes.cancelUpload.click();pending.resolve();await task;app.clearDefer();
  assert.equal(app.nodes.trackTitle.textContent,'Keep me');assert.match(app.nodes.chartStatus.textContent,/canceled/);assert.equal(app.nodes.playButton.disabled,false);assert.equal(app.nodes.uploadProgress.hidden,true);
});

test('choose before upload, then rebuild the same audio for one different instrument',async()=>{
  const app=setup();await app.radios.chartTarget[1].emit('change');assert.match(app.nodes.uploadButton.textContent,/Drums/);
  await app.upload();assert.deepEqual(app.requests,['drums']);assert.match(app.nodes.chartSummary.textContent,/Drums/);
  assert.equal(app.radios.instrument[1].checked,true);
  await app.radios.chartTarget[0].emit('change');assert.deepEqual(app.requests,['drums','guitar']);assert.equal(app.decodes,1);
  assert.match(app.nodes.chartSummary.textContent,/Guitar/);assert.equal(app.radios.instrument[0].checked,true);assert.equal(app.nodes.playButton.disabled,false);
});

test('canceling an instrument rebuild restores the previous instrument and chart',async()=>{
  const app=setup();await app.upload();const pending=app.radios.chartTarget[1].emit('change');
  assert.equal(app.nodes.playButton.disabled,true);await app.nodes.cancelUpload.click();await pending;
  assert.equal(app.radios.chartTarget[0].checked,true);assert.equal(app.radios.instrument[0].checked,true);
  assert.match(app.nodes.chartSummary.textContent,/Guitar/);assert.equal(app.nodes.playButton.disabled,false);
});

test('mobile drums score simultaneous pads and kick; each finger releases independently',async()=>{
  const app=setup({mobile:true,chartFixture:[0,1,5].map(lane=>({lane,time:1,duration:0}))}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();
  assert.match(n.modeHint.textContent,/Tap.*Kick pedal/);assert.equal(n.kickButton.hidden,false);
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');
  assert.ok(app.body.classList.contains('mobile-session'));
  app.tick(app.sources.at(-1).when+1);
  await app.frets[0].emit('pointerdown',{pointerId:10});await app.frets[1].emit('pointerdown',{pointerId:11});
  await n.kickButton.emit('pointerdown',{pointerId:12});await n.kickButton.emit('pointerdown',{pointerId:13});
  app.tick(app.sources.at(-1).when+1.1);assert.equal(n.score.textContent,'000,300');assert.equal(n.streak.textContent,3);
  await n.kickButton.emit('pointerup',{pointerId:12});assert.ok(n.kickButton.classList.contains('active'));
  await app.frets[0].emit('pointercancel',{pointerId:10});assert.equal(app.frets[0].classList.contains('active'),false);assert.ok(app.frets[1].classList.contains('active'));
  await n.kickButton.emit('lostpointercapture',{pointerId:13});assert.equal(n.kickButton.classList.contains('active'),false);
  await n.pauseButton.click();assert.ok(app.body.classList.contains('mobile-session'));assert.ok(app.frets.every(f=>!f.classList.contains('active')));
  await n.mobileBackButton.click();assert.equal(app.body.classList.contains('mobile-session'),false);assert.ok(app.sources.at(-1).stopped);assert.equal(n.playButton.disabled,false);
});

test('Space and Enter alternate fast drum kicks while yellow stays on F',async()=>{
  const chartFixture=[{lane:5,time:1,duration:0},{lane:5,time:1.09,duration:0},{lane:1,time:1.09,duration:0},{lane:5,time:1.18,duration:0}];
  const app=setup({chartFixture}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();
  assert.equal(n.driveKey.textContent,'SHIFT');assert.match(n.modeHint.textContent,/Space or Enter/);
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');
  const start=app.sources.at(-1).when;app.tick(start+1);
  await app.key('keydown','Space');
  app.tick(start+1.09);await app.key('keydown','Enter');await app.key('keydown','KeyF');
  await app.key('keyup','Space');assert.ok(n.kickButton.classList.contains('active'),'Enter still owns the pedal');
  app.tick(start+1.18);await app.key('keydown','Space');
  await app.key('keyup','Enter');assert.ok(n.kickButton.classList.contains('active'));
  await app.key('keyup','Space');assert.equal(n.kickButton.classList.contains('active'),false);
  app.tick(start+1.3);assert.equal(n.score.textContent,'000,400');assert.equal(n.streak.textContent,4);
  await n.mobileBackButton.click();await app.radios.instrument[0].emit('change');
  assert.equal(n.driveKey.textContent,'SPACE');
});

test('Shift activates drum Overdrive without adding an off-beat kick',async()=>{
  const app=setup({chartFixture:Array.from({length:20},(_,i)=>({lane:1,time:1+i*.15,duration:0}))}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();await n.playButton.click();
  await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;
  for(let i=0;i<20;i++){app.tick(start+1+i*.15);await app.key('keydown','KeyF');await app.key('keyup','KeyF');}
  await app.key('keydown','ShiftLeft');app.tick(start+4);
  assert.equal(n.streak.textContent,20);assert.equal(n.stageStatus.textContent,'OVERDRIVE');
  assert.equal(n.kickButton.classList.contains('active'),false);
});

test('mobile guitar holds survive another finger or keyboard release, then stop on cancellation',async()=>{
  const app=setup({mobile:true,chartFixture:[{lane:0,time:1,duration:2}]});await app.upload();await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');
  const start=app.sources.at(-1).when;app.tick(start+1);
  await app.frets[0].emit('pointerdown',{pointerId:1});await app.frets[0].emit('pointerdown',{pointerId:2});
  await app.key('keydown','KeyD');await app.key('keyup','KeyD');
  await app.frets[0].emit('pointerup',{pointerId:1});assert.ok(app.frets[0].classList.contains('active'));
  app.tick(start+1.5);assert.ok(Number(app.nodes.score.textContent.replaceAll(',',''))>100);
  await app.frets[0].emit('pointercancel',{pointerId:2});assert.equal(app.frets[0].classList.contains('active'),false);
  const score=app.nodes.score.textContent;app.tick(start+2);assert.equal(app.nodes.score.textContent,score);
});

test('mobile hold + strum supports a two-finger chord and a third finger strum',async()=>{
  const app=setup({mobile:true,chartFixture:[0,2].map(lane=>({lane,time:1,duration:0}))});
  await app.radios.mode[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();assert.equal(app.nodes.touchStrum.hidden,false);
  await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');app.tick(app.sources.at(-1).when+1);
  await app.frets[0].emit('pointerdown',{pointerId:1});await app.frets[2].emit('pointerdown',{pointerId:2});
  await app.nodes.touchStrum.emit('pointerdown',{pointerId:3});app.tick(app.sources.at(-1).when+1.1);
  assert.equal(app.nodes.score.textContent,'000,200');assert.equal(app.nodes.streak.textContent,2);
});

test('mobile preview enters play layout and can switch directly to a scored game',async()=>{
  const app=setup({mobile:true,chartFixture:[{lane:0,time:1,duration:0}]});await app.upload();
  assert.equal(app.body.classList.contains('mobile-session'),false);
  await app.nodes.previewButton.click();await until(()=>app.nodes.previewButton.textContent.includes('Stop'));
  assert.ok(app.body.classList.contains('mobile-session'));assert.ok(app.body.classList.contains('previewing'));
  await app.nodes.mobilePlayButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');
  assert.equal(app.body.classList.contains('previewing'),false);assert.equal(app.sources.at(-1).offset,0);
  await app.nodes.mobileBackButton.click();assert.equal(app.body.classList.contains('mobile-session'),false);assert.equal(app.nodes.chartPreview.hidden,false);
});

test('mobile highway hit line follows measured pads after portrait and landscape resizing',async()=>{
  const app=setup({mobile:true,chartFixture:[{lane:0,time:1,duration:0}]});await app.upload();await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');
  for(const [width,height,top,rowWidth,rowTop,rowHeight,target] of [[366,610,80,344,548,64,500],[650,330,48,611,252,52,230]]){
    app.nodes.highway.rect={width,height,top,left:12};app.nodes.fretControls.rect={width:rowWidth,height:rowHeight,top:rowTop,left:24};app.resize();app.lines.length=0;app.tick(app.sources.at(-1).when+.5);
    const right=width/2+(rowWidth+4)/2;
    assert.ok(app.lines.some(([x,y])=>Math.abs(x-right)<.001&&Math.abs(y-target)<.001),`Hit line must meet the pads at ${width} × ${height}`);
    assert.ok(app.lines.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
  }
});

test('practice uses one looping audio source, scales time with speed, and never saves a score',async()=>{
  const app=setup({chartFixture:[{lane:0,time:5,duration:0},{lane:1,time:5.5,duration:0}]}),n=app.nodes;await app.radios.difficulty[3].emit('change');await app.upload();
  n.loopStart.value='4.5';n.loopEnd.value='6.5';n.practiceRate.value='.5';await n.practiceLaunch.click();await until(()=>n.playText.textContent==='RESTART TRACK');
  const source=app.sources.at(-1);assert.equal(source.loop,true);assert.equal(source.loopStart,4.5);assert.equal(source.loopEnd,6.5);assert.equal(source.offset,4.5);assert.equal(source.playbackRate.value,.5);
  app.tick(source.when-.3);assert.equal(n.stageStatus.textContent,'GET READY');
  app.tick(source.when+1);await app.frets[0].emit('pointerdown',{pointerId:1});await app.frets[0].emit('pointerup',{pointerId:1});
  app.tick(source.when+2);await app.frets[1].emit('pointerdown',{pointerId:2});await app.frets[1].emit('pointerup',{pointerId:2});
  app.tick(source.when+4.01);assert.match(n.stageStatus.textContent,/PRACTICE 50% · 2/);assert.match(n.practiceStatus.textContent,/2 of 2/);assert.equal(n.score.textContent,'000,000');assert.equal(app.sources.length,1);
  await n.pauseButton.click();await n.pauseButton.click();await settle();app.tick(source.when+8.01);assert.match(n.stageStatus.textContent,/· 3/);
  assert.equal(n.resultDialog.open,false);assert.equal(app.writes.length,0);await n.mobileBackButton.click();assert.ok(source.stopped);assert.equal(app.body.classList.contains('practicing'),false);
});

test('tap calibration saves the measured delay and applies it to scored input',async()=>{
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}]}),n=app.nodes;await app.upload();await n.timingButton.click();await n.calibrationStart.click();
  for(let i=2;i<12;i++){app.tick(.75+i*.5+.12);await n.calibrationTap.emit('pointerdown',{pointerId:1});}
  app.runCalibrationTimer();assert.equal(n.timingOffset.value,'120');assert.match(n.calibrationStatus.textContent,/10 steady taps/);
  await n.calibrationSave.click();assert.equal(JSON.parse(app.writes.at(-1)[1]).timingOffset,120);
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');app.tick(app.sources.at(-1).when+1.12);await app.frets[0].emit('pointerdown',{pointerId:1});app.tick(app.sources.at(-1).when+1.22);assert.equal(n.score.textContent,'000,100');
});

test('saved songs reopen after a fresh page without repeating automatic charting',async()=>{
  const savedSongs=new Map(),app=setup({savedSongs,chartFixture:[{lane:0,time:1,duration:0}]});await app.upload('Saved song.wav');await settle();assert.equal(savedSongs.size,1);
  const fresh=setup({savedSongs,chartFixture:[]});await fresh.nodes.libraryButton.click();await until(()=>fresh.nodes.songList.children.length===1);
  const open=fresh.nodes.songList.children[0].children[2].children[0];await open.click();
  assert.equal(fresh.nodes.trackTitle.textContent,'Saved song');assert.equal(fresh.decodes,1);assert.equal(fresh.requests.length,0);assert.match(fresh.nodes.chartSummary.textContent,/1 notes/);
  await fresh.nodes.playButton.click();await until(()=>fresh.nodes.playText.textContent==='RESTART TRACK');assert.ok(fresh.sources.at(-1).buffer);
});

test('uploaded audio survives decoder buffer detachment, saving, backup, and reopening',async()=>{
  const savedSongs=new Map(),app=setup({savedSongs,chartFixture:[{lane:0,time:1,duration:0}]}),L=require('../dist/song-library.js');
  await app.radios.chartTarget[1].emit('change');await app.upload('InbloomNirvanadrumsonly.wav');await settle();
  assert.match(app.nodes.saveStatus.textContent,/Added to your setlist/,app.nodes.chartStatus.textContent);
  let saved=[...savedSongs.values()][0];assert.equal(saved.audioBlob.size,4);
  assert.deepEqual([...new Uint8Array(await saved.audioBlob.arrayBuffer())],[1,1,2,3]);
  assert.equal(saved.id,Buffer.from(await webcrypto.subtle.digest('SHA-256',await saved.audioBlob.arrayBuffer())).toString('hex'));
  const backup=await L.unpack(L.pack(saved));assert.deepEqual([...new Uint8Array(await backup.audioBlob.arrayBuffer())],[1,1,2,3]);
  await app.radios.chartTarget[0].emit('change');await settle();saved=[...savedSongs.values()][0];
  assert.deepEqual(Object.keys(saved.charts).sort(),['drums','guitar']);assert.equal(saved.audioBlob.size,4);
  const fresh=setup({savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();await fresh.nodes.saveCurrentButton.click();
  assert.equal(fresh.nodes.trackTitle.textContent,'InbloomNirvanadrumsonly');assert.equal(fresh.requests.length,0);
  assert.deepEqual([...new Uint8Array(await savedSongs.values().next().value.audioBlob.arrayBuffer())],[1,1,2,3]);
});

test('chart rebuilds cannot overwrite original audio or song identity from a worker result',async()=>{
  const app=setup({chartFixture:[{lane:1,time:1,duration:0}],chartResultExtras:{audioBlob:undefined,id:'wrong-id',title:'wrong-title',buffer:null,filename:'wrong.wav',musicEnd:1}});
  await app.upload('Keep original.wav');await settle();const original=[...app.savedSongs.values()][0];
  await app.radios.chartTarget[1].emit('change');await settle();
  assert.equal(app.savedSongs.size,1);const saved=[...app.savedSongs.values()][0];
  assert.equal(saved.id,original.id);assert.equal(saved.title,'Keep original');assert.equal(saved.musicEnd,16);
  assert.equal(saved.filename,'Keep original.wav');assert.equal(saved.audioBlob.size,4);
  assert.deepEqual(Object.keys(saved.charts).sort(),['drums','guitar']);assert.match(app.nodes.saveStatus.textContent,/Added to your setlist/);
});

test('missing audio reconnects only to matching original bytes and preserves both existing charts',async()=>{
  const L=require('../dist/song-library.js'),savedSongs=new Map();let first=true;
  const app=setup({savedSongs,chartFixture:[{lane:1,time:1,duration:0}],libraryOverrides:{save:async record=>{
    // Simulate an open legacy song whose retained audio has become empty.
    if(first){first=false;Object.defineProperty(record.audioBlob,'size',{value:0});}
    const status=L.audioStatus(record.audioBlob);if(!status.ok)throw Error(status.message);
    savedSongs.set(record.id,{...L.metadata(record),audioBlob:record.audioBlob});
  }}}),n=app.nodes;
  await app.upload('Original.wav');await settle();await app.radios.chartTarget[1].emit('change');await settle();
  await n.libraryButton.click();await settle();
  assert.match(n.librarySaveStatus.textContent,/Could not save.*Reconnect original audio/);
  assert.doesNotMatch(n.librarySaveStatus.textContent,/export a backup|too large/);
  assert.equal(n.audioRecovery.hidden,false);assert.equal(n.exportCurrentButton.disabled,true);assert.equal(savedSongs.size,0);
  await n.reconnectAudioButton.click();assert.equal(n.reconnectAudioFile.clicked,true);
  const choose=async bytes=>{const file=new Blob([new Uint8Array(bytes)],{type:'audio/wav'});file.name='Original.wav';n.reconnectAudioFile.files=[file];await n.reconnectAudioFile.emit('change');};
  await choose([9,9,9,9]);assert.match(n.librarySaveStatus.textContent,/does not match/);assert.equal(savedSongs.size,0);assert.equal(n.audioRecovery.hidden,false);
  await choose([1,1,2,3]);assert.match(n.librarySaveStatus.textContent,/Added to your setlist/);
  assert.equal(n.audioRecovery.hidden,true);assert.match(n.audioAttachmentStatus.textContent,/Audio attached/);assert.equal(n.exportCurrentButton.disabled,false);
  assert.equal(savedSongs.size,1);assert.equal(app.decodes,1);assert.deepEqual(app.requests,['guitar','drums'],'Reconnecting must not generate replacement charts');
  const saved=[...savedSongs.values()][0],restored=await L.unpack(L.pack(saved));
  assert.deepEqual(Object.keys(saved.charts).sort(),['drums','guitar']);assert.deepEqual(restored.charts.drums.expert.map(n=>[n.lane,n.time]),[[1,1]]);
  assert.deepEqual([...new Uint8Array(await restored.audioBlob.arrayBuffer())],[1,1,2,3]);
  const fresh=setup({savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.trackTitle.textContent,'Original');assert.equal(fresh.requests.length,0);
});

test('storage failure preserves the playable upload and offers a backup',async()=>{
  const app=setup({storageFailure:true,chartFixture:[{lane:0,time:1,duration:0}]});await app.upload();await settle();
  assert.match(app.nodes.saveStatus.textContent,/Could not save.*export a backup/);assert.equal(app.nodes.exportCurrentButton.disabled,false);
  await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');assert.ok(app.sources.length);
});

test('save failures stay visible in Manage songs and retry adds the open song to the setlist',async()=>{
  const savedSongs=new Map();let attempts=0,finishSave;
  const app=setup({savedSongs,chartFixture:[{lane:0,time:1,duration:0}],libraryOverrides:{save:async song=>{
    if(++attempts<=2)throw Error('Encountered full disk while opening backing store for indexedDB.open.');
    await new Promise(resolve=>{finishSave=resolve;});
    savedSongs.set(song.id,{...require('../dist/song-library.js').metadata(song),audioBlob:song.audioBlob});
  }}}),n=app.nodes;
  await app.upload('Keep this song.wav');await settle();await n.libraryButton.click();await settle();
  assert.equal(n.librarySaveStatus.hidden,false);assert.match(n.librarySaveStatus.textContent,/Current song: Keep this song/);
  assert.match(n.librarySaveStatus.textContent,/Could not save.*Free some space/);assert.match(n.libraryStatus.textContent,/No saved songs yet/);
  await n.saveCurrentButton.click();assert.match(n.librarySaveStatus.textContent,/Could not save/);assert.equal(n.saveCurrentButton.disabled,false);
  assert.equal(n.exportCurrentButton.disabled,false);assert.equal(savedSongs.size,0);
  const retry=n.saveCurrentButton.click();assert.equal(n.saveCurrentButton.disabled,true);assert.equal(n.saveCurrentButton.textContent,'Saving…');
  assert.match(n.librarySaveStatus.textContent,/Saving audio and charts/);assert.equal(n.exportCurrentButton.disabled,false);
  finishSave();await retry;
  assert.match(n.librarySaveStatus.textContent,/Added to your setlist/);assert.equal(n.songList.children.length,1);
  assert.equal(n.setlistEntries.children.length,2);assert.equal(n.setlistEntries.children[1].children[0].textContent,'Keep this song');
  assert.equal(n.saveCurrentButton.disabled,false);assert.equal(app.decodes,1);assert.equal(app.requests.length,1);
  const fresh=setup({savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.trackTitle.textContent,'Keep this song');assert.equal(fresh.requests.length,0);
});

test('a late empty saved-song list cannot hide the current song save error',async()=>{
  const reads=[];let holdReads=false;
  const app=setup({storageFailure:true,chartFixture:[{lane:0,time:1,duration:0}],libraryOverrides:{list:()=>holdReads?new Promise(resolve=>reads.push(resolve)):Promise.resolve([])}}),n=app.nodes;
  await app.upload();await settle();holdReads=true;await n.libraryButton.click();
  await n.saveCurrentButton.click();for(const resolve of reads)resolve([]);await settle();
  assert.match(n.libraryStatus.textContent,/No saved songs yet/);
  assert.match(n.librarySaveStatus.textContent,/Could not save.*export a backup.*Free some space/);
  assert.equal(n.librarySaveStatus.hidden,false);assert.equal(n.saveCurrentButton.disabled,false);
});

test('separate cached guitar and drum charts survive switching back',async()=>{
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}]});await app.upload();await app.radios.instrument[1].emit('change');await app.radios.instrument[0].emit('change');await settle();
  assert.deepEqual(app.requests,['guitar','drums']);assert.deepEqual(Object.keys([...app.savedSongs.values()][0].charts).sort(),['drums','guitar']);
});

test('overlapping fingers can play a rapid drum roll without breaking another hold',async()=>{
  const app=setup({chartFixture:[{lane:0,time:1,duration:0},{lane:0,time:1.065,duration:0}]});await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();await app.nodes.playButton.click();await until(()=>app.nodes.playText.textContent==='RESTART TRACK');
  app.tick(app.sources.at(-1).when+1);await app.frets[0].emit('pointerdown',{pointerId:1});app.tick(app.sources.at(-1).when+1.065);await app.frets[0].emit('pointerdown',{pointerId:2});await app.frets[0].emit('pointerup',{pointerId:1});assert.ok(app.frets[0].classList.contains('active'));app.tick(app.sources.at(-1).when+1.17);assert.equal(app.nodes.score.textContent,'000,200');
});

test('setlist automatically adds uploads, searches safely, and restores playable songs on mobile',async()=>{
  const savedSongs=new Map(),app=setup({savedSongs,chartFixture:[{lane:0,time:1,duration:0}]}),n=app.nodes;
  await settle();assert.equal(n.setlistEntries.children.length,1);assert.equal(n.setlistEntries.children[0]['aria-pressed'],'true');
  n.setlistSearch.value='missing';await n.setlistSearch.emit('input');assert.equal(n.setlistEntries.children.length,0);assert.match(n.setlistStatus.textContent,/No matching/);
  await app.upload('My <original>.wav');await until(()=>n.setlistEntries.children.length===2);
  assert.equal(n.setlistSearch.value,'');assert.equal(n.setlistCount.textContent,'2 tracks');
  const row=n.setlistEntries.children[1];assert.equal(row.children[0].textContent,'My <original>');assert.equal(row.children[0].innerHTML,'');assert.equal(row['aria-pressed'],'true');assert.match(row.children[1].textContent,/0:16 · Guitar/);
  n.setlistSearch.value='ORIGINAL';await n.setlistSearch.emit('input');assert.equal(n.setlistEntries.children.length,1);assert.equal(n.setlistCount.textContent,'2 tracks');
  const fresh=setup({mobile:true,savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  assert.equal(fresh.decodes,0,'Listing saved songs must not decode all audio');
  await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.trackTitle.textContent,'My <original>');assert.equal(fresh.requests.length,0);
  await fresh.nodes.playButton.click();await until(()=>fresh.nodes.playText.textContent==='RESTART TRACK');assert.ok(fresh.sources.at(-1).buffer);assert.ok(fresh.nodes.setlistEntries.children.every(b=>b.disabled));
  await fresh.nodes.mobileBackButton.click();await fresh.nodes.setlistEntries.children[0].click();assert.equal(fresh.nodes.chartPreview.hidden,true);assert.match(fresh.nodes.trackTitle.innerHTML,/VOLTAGE/);assert.equal(fresh.nodes.setlistEntries.children[0]['aria-pressed'],'true');
});

test('setlist keeps both instrument charts in one song and removes saved entries immediately',async()=>{
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}]}),n=app.nodes;
  await app.upload('One song.wav');await app.radios.instrument[1].emit('change');await until(()=>n.setlistEntries.children[1]?.children[1].textContent.includes('Drums'));
  assert.equal(n.setlistEntries.children.length,2);assert.match(n.setlistEntries.children[1].children[1].textContent,/Guitar \+ Drums/);
  await n.libraryButton.click();await until(()=>n.songList.children.length===1);await n.songList.children[0].children[2].children[2].click();
  assert.equal(app.savedSongs.size,0);assert.equal(n.setlistEntries.children.length,1);assert.equal(n.setlistCount.textContent,'1 track');assert.match(n.saveStatus.textContent,/Removed/);
  await n.saveCurrentButton.click();assert.equal(n.setlistEntries.children.length,2);
  const savedRow=n.setlistEntries.children[1];app.savedSongs.clear();await savedRow.click();assert.equal(n.setlistEntries.children.length,1);assert.match(n.statusMessage.textContent,/no longer saved/);assert.equal(n.playButton.disabled,false);
});

test('setlist adds imported backups without charting again',async()=>{
  const source=setup({chartFixture:[{lane:0,time:1,duration:0}]});await source.upload('Backed up.wav');await settle();
  const file=require('../dist/song-library.js').pack([...source.savedSongs.values()][0]);
  const app=setup({chartFixture:[]});app.nodes.backupFile.files=[file];await app.nodes.backupFile.emit('change');
  assert.equal(app.nodes.setlistEntries.children.length,2);assert.equal(app.nodes.setlistEntries.children[1].children[0].textContent,'Backed up');assert.equal(app.requests.length,0);assert.equal(app.savedSongs.size,1);
});

test('setlist ignores a stale initial read after a new upload finishes saving',async()=>{
  let resolveInitial,calls=0;const savedSongs=new Map();
  const app=setup({savedSongs,chartFixture:[],libraryOverrides:{list:()=>++calls===1?new Promise(resolve=>resolveInitial=resolve):Promise.resolve([...savedSongs.values()])}});
  await app.upload('New arrival.wav');await until(()=>app.nodes.setlistEntries.children.length===2);
  resolveInitial([]);await settle();assert.equal(app.nodes.setlistEntries.children.length,2);assert.equal(app.nodes.setlistEntries.children[1].children[0].textContent,'New arrival');
});

test('setlist leaves the demo usable when storage cannot be read or saved',async()=>{
  const app=setup({storageFailure:true,chartFixture:[],libraryOverrides:{list:async()=>{throw Error('Storage blocked');}}});await settle();
  assert.equal(app.nodes.setlistEntries.children.length,1);assert.match(app.nodes.setlistStatus.textContent,/could not be loaded/);
  await app.upload();await settle();assert.equal(app.nodes.setlistEntries.children.length,1);assert.match(app.nodes.saveStatus.textContent,/Could not save/);
  await app.nodes.setlistEntries.children[0].click();assert.equal(app.nodes.playButton.disabled,false);assert.equal(app.nodes.chartPreview.hidden,true);
});

test('green drum keyboard input hits orange and green notes, including a simultaneous pair',async()=>{
  const app=setup({chartFixture:[{lane:3,time:1,duration:0},{lane:4,time:2,duration:0},{lane:3,time:3,duration:0},{lane:4,time:3,duration:0}]}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');
  const start=app.sources.at(-1).when;
  for(const time of [1,2,3]){app.tick(start+time);await app.key('keydown','KeyL');await app.key('keyup','KeyL');}
  app.tick(start+3.1);assert.equal(n.score.textContent,'000,400');assert.equal(n.streak.textContent,4);assert.match(n.modeHint.textContent,/L \(green\) also hits orange/);
});

test('green drum touch input supports rapid orange notes with overlapping fingers',async()=>{
  const app=setup({mobile:true,chartFixture:[{lane:3,time:1,duration:0},{lane:3,time:1.065,duration:0},{lane:4,time:2,duration:0}]}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload();await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;
  app.tick(start+1);await app.frets[4].emit('pointerdown',{pointerId:1});app.tick(start+1.065);await app.frets[4].emit('pointerdown',{pointerId:2});
  await app.frets[4].emit('pointerup',{pointerId:1});assert.ok(app.frets[4].classList.contains('active'));await app.frets[4].emit('pointerup',{pointerId:2});
  app.tick(start+2);await app.frets[4].emit('pointerdown',{pointerId:3});await app.frets[4].emit('pointerup',{pointerId:3});app.tick(start+2.1);
  assert.equal(n.score.textContent,'000,300');assert.equal(n.streak.textContent,3);assert.match(n.modeHint.textContent,/Green also hits orange/);
});

test('shared green drum hits preserve separate attacks, timing windows, and the orange pad',()=>{
  const make=notes=>new E.Session('expert','tap','drums',{notes,musicEnd:10});
  const nearby=make([{lane:4,time:.94,duration:0},{lane:3,time:1,duration:0}]);
  assert.equal(nearby.tap(4,1),true);assert.equal(nearby.notes[0].hit,false);assert.equal(nearby.notes[1].hit,true);assert.equal(nearby.hits,1);
  assert.equal(nearby.tap(4,1.5),false);assert.equal(nearby.hits,1);
  for(const order of [[4,3],[3,4]]){
    const pair=make([{lane:3,time:1,duration:0},{lane:4,time:1,duration:0}]);
    order.forEach(lane=>pair.tap(lane,1));assert.equal(pair.hits,2);assert.equal(pair.score,200);assert.equal(pair.streak,2);
  }
  const orange=make([{lane:3,time:1,duration:0},{lane:4,time:2,duration:0}]);
  assert.equal(orange.tap(3,1),true);assert.equal(orange.tap(3,2),false);assert.equal(orange.notes[1].hit,false);
  const wrong=make([{lane:0,time:1,duration:0}]);assert.equal(wrong.tap(4,1),false);assert.equal(wrong.hits,0);
  const guitar=new E.Session('normal','tap','guitar',{notes:[{lane:3,time:1,duration:0},{lane:4,time:2,duration:0}]});
  assert.equal(guitar.tap(4,1),false);assert.equal(guitar.tap(4,2),true);assert.equal(guitar.hits,1);
});

test('original In Bloom upload, preview, save, reopen and rebuild retain its matched event chart',{skip:!process.env.RIFFBOUND_REFERENCE_WAV||!process.env.RIFFBOUND_REFERENCE_PCM},async()=>{
  const bytes=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_WAV),pcm=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_PCM);
  const id=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true});
  const app=setup({audioSamples:new Float32Array(pcm.buffer,pcm.byteOffset,pcm.byteLength/4),uploadBytes:bytes,libraryOverrides:s.library}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.radios.difficulty[3].emit('change');await app.upload('Renamed original recording.wav');
  await until(()=>/Saved on this device/.test(n.saveStatus.textContent));
  assert.match(n.chartDetails.textContent,/In Bloom · Matched drum chart/);assert.equal(n.trackKind.textContent,'MATCHED CHART');
  assert.deepEqual(app.requestIds,[id]);assert.match(n.chartSummary.textContent,/1401 notes/);
  n.previewPosition.value='239';await n.previewPosition.emit('input');await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
  assert.equal(app.sources.at(-1).offset,239);await n.previewButton.click();
  const saved=await s.fresh().get(id),packed=await s.library.unpack(s.library.pack(saved));
  assert.equal(packed.quality.sources.drums,'In Bloom · Matched drum chart');assert.equal(packed.charts.drums.expert.length,1401);
  assert.deepEqual(Buffer.from(await packed.audioBlob.arrayBuffer()),bytes);
  await n.demoButton.click();await n.setlistEntries.children.find(button=>button.dataset.songId===id).click();
  assert.equal(n.trackKind.textContent,'MATCHED CHART');assert.equal(app.requestIds.length,1,'Reopening must not rechart');
  await n.rechartButton.click();await until(()=>/Saved on this device/.test(n.saveStatus.textContent));
  assert.deepEqual(app.requestIds,[id,id]);assert.match(n.chartDetails.textContent,/In Bloom · Matched drum chart/);
  const rebuilt=await s.fresh().get(id);assert.deepEqual(JSON.parse(JSON.stringify(rebuilt.charts.drums)),JSON.parse(JSON.stringify(packed.charts.drums)));
});

const fourPartFixture=part=>[{lane:{guitar:0,drums:1,bass:2,vocals:3}[part],time:1,duration:part==='vocals'?.7:0,pitch:part==='bass'?35:67}];
test('whole-song upload builds four distinct charts, saves them and reopens without reanalysis',async()=>{
  const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),app=setup({chartFixture:fourPartFixture,libraryOverrides:s.library});
  app.nodes.chartScope.value='whole';await app.nodes.chartScope.emit('change');
  assert.equal(app.nodes.chartTargetGroup.hidden,true);assert.match(app.nodes.scopeHint.textContent,/original audio/);
  await app.upload('Full band.wav');await until(()=>app.nodes.saveStatus.textContent.includes('Added'));
  assert.deepEqual(app.requests,['guitar','drums','bass','vocals']);assert.equal(app.decodes,1);
  assert.match(app.nodes.chartStatus.textContent,/Guitar \+ Drums \+ Bass \+ Vocals/);
  const id=(await s.library.list())[0].id,saved=await s.library.get(id),packed=await s.library.unpack(s.library.pack(saved));
  assert.deepEqual(Object.keys(packed.charts).sort(),['bass','drums','guitar','vocals']);
  assert.equal(packed.charts.vocals.expert[0].duration,.7);assert.equal(packed.charts.bass.expert[0].pitch,35);
  assert.deepEqual(Buffer.from(await packed.audioBlob.arrayBuffer()),Buffer.from([1,1,2,3]));
  const fresh=setup({chartFixture:fourPartFixture,libraryOverrides:s.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();
  for(const radio of fresh.radios.instrument){await radio.emit('change');assert.match(fresh.nodes.chartSummary.textContent,new RegExp(radio.value,'i'));}
  assert.equal(fresh.requests.length,0);assert.equal(fresh.decodes,1);
});
test('separate-parts selection builds only checked targets and retains other saved charts',async()=>{
  const app=setup({chartFixture:fourPartFixture});await app.upload();await until(()=>app.savedSongs.size===1);
  const n=app.nodes;n.chartScope.value='separate';n.partGuitar.checked=false;n.partDrums.checked=false;n.partBass.checked=true;n.partVocals.checked=true;await n.chartScope.emit('change');
  assert.equal(n.partsGroup.hidden,false);assert.equal(n.buildPartsButton.hidden,false);
  const original=[...app.savedSongs.values()][0].charts.guitar;
  await n.buildPartsButton.click();await until(()=>Object.keys([...app.savedSongs.values()][0].charts).length===3);
  assert.deepEqual(app.requests,['guitar','bass','vocals']);assert.equal(app.decodes,1);
  assert.deepEqual([...app.savedSongs.values()][0].charts.guitar,original);
  await app.radios.instrument[3].emit('change');assert.equal(n.modeGroup.hidden,true);assert.equal(n.touchStrum.hidden,true);
  assert.match(n.chartMapping.textContent,/without microphone/);
  const result=await require('../dist/song-library.js').unpack(require('../dist/song-library.js').pack([...app.savedSongs.values()][0]));
  assert.ok(result.charts.guitar&&result.charts.bass&&result.charts.vocals);assert.equal(result.charts.drums,undefined);
});
test('whole-song partial failure saves successful parts and names the unavailable part',async()=>{
  const app=setup({chartFixture:fourPartFixture,chartFailures:{vocals:'No clear vocal melody was detected.'}}),n=app.nodes;
  n.chartScope.value='whole';await n.chartScope.emit('change');await app.upload();await until(()=>app.savedSongs.size===1);
  assert.deepEqual(app.requests,['guitar','drums','bass','vocals']);assert.match(n.chartStatus.textContent,/Could not chart Vocals/);
  assert.deepEqual(Object.keys([...app.savedSongs.values()][0].charts),['guitar','drums','bass']);assert.equal(n.playButton.disabled,false);
});
test('a selected batch cannot be empty and canceling a running batch preserves the previous song',async()=>{
  const app=setup({chartFixture:fourPartFixture}),n=app.nodes;await app.upload('Keep song.wav');await until(()=>app.savedSongs.size===1);
  n.chartScope.value='separate';for(const part of ['Guitar','Drums','Bass','Vocals'])n['part'+part].checked=false;
  await n.chartScope.emit('change');await app.upload('Empty selection.wav');assert.match(n.chartStatus.textContent,/at least one/);assert.equal(app.requests.length,1);
  n.partBass.checked=true;n.partVocals.checked=true;const pending=n.buildPartsButton.click();
  assert.equal(n.playButton.disabled,true);await n.cancelUpload.click();await pending;await settle();
  assert.equal(n.trackTitle.textContent,'Keep song');assert.deepEqual(Object.keys([...app.savedSongs.values()][0].charts),['guitar']);assert.equal(n.playButton.disabled,false);
});
test('new Bass and Vocals selectors run their actual audio analyzers and keep different note ranges',async()=>{
  for(const [part,index] of [['bass',2],['vocals',3]]){
    const fixture=require('./fixtures/melody-parts.cjs').melody(part),app=setup({audioSamples:fixture.samples});
    await app.radios.chartTarget[index].emit('change');await app.upload(part+'.wav');await until(()=>app.savedSongs.size===1);
    assert.deepEqual(app.requests,[part]);const notes=[...app.savedSongs.values()][0].charts[part].expert;
    assert.deepEqual(Array.from(notes,n=>n.pitch),fixture.expected.map(n=>n.pitch));
    assert.match(app.nodes.chartSummary.textContent,new RegExp(part,'i'));assert.equal(app.nodes.playButton.disabled,false);
  }
});
test('vocal touch pads score held melody notes even after Bass strum mode',async()=>{
  const app=setup({mobile:true,chartFixture:fourPartFixture}),n=app.nodes;
  await app.radios.instrument[2].emit('change');await app.radios.mode[1].emit('change');await app.upload();
  await app.radios.instrument[3].emit('change');assert.equal(n.modeGroup.hidden,true);assert.equal(n.touchStrum.hidden,true);assert.match(n.modeHint.textContent,/without a microphone/);
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;
  app.tick(start+1);await app.frets[3].emit('pointerdown',{pointerId:8});app.tick(start+1.6);assert.ok(Number(n.score.textContent.replaceAll(',',''))>100);
  await app.frets[3].emit('pointerup',{pointerId:8});await n.mobileBackButton.click();
  await n.demoButton.click();await app.radios.instrument[3].emit('change');assert.equal(n.playButton.disabled,true);assert.match(n.uploadHint.textContent,/instrumental/);
});
test('reuploading the same audio for another part preserves all charts in the current backup',async()=>{
  const app=setup({chartFixture:fourPartFixture});app.nodes.chartScope.value='whole';await app.upload();await until(()=>app.savedSongs.size===1);
  app.nodes.chartScope.value='single';await app.radios.instrument[2].emit('change');await app.upload();await until(()=>app.nodes.saveStatus.textContent.includes('Added'));
  const saved=[...app.savedSongs.values()][0],L=require('../dist/song-library.js'),packed=await L.unpack(L.pack(saved));
  assert.equal(Object.keys(packed.charts).length,4);assert.equal(app.requests.at(-1),'bass');
});
test('a mixed full-band audio upload runs all four real analyzers and can preview each result',async()=>{
  const fixture=require('./fixtures/melody-parts.cjs').fullBand(),app=setup({audioSamples:fixture.samples}),n=app.nodes;
  n.chartScope.value='whole';await n.chartScope.emit('change');await app.upload('Mixed band.wav');await until(()=>app.savedSongs.size===1);
  const saved=[...app.savedSongs.values()][0];assert.equal(Object.keys(saved.charts).length,4,n.chartStatus.textContent);
  assert.deepEqual(app.requests,['guitar','drums','bass','vocals']);assert.equal(app.decodes,1);
  for(const radio of app.radios.instrument){
    const notes=saved.charts[radio.value].expert;assert.ok(notes.length>0);assert.ok(notes.every(n=>Number.isFinite(n.time)&&n.time>=0&&n.time<8));
    await radio.emit('change');await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));assert.ok(app.sources.at(-1).buffer);await n.previewButton.click();
  }
  assert.equal(app.requests.length,4,'Preview and switching reuse the independently generated parts');
  assert.notEqual(JSON.stringify(saved.charts.bass),JSON.stringify(saved.charts.vocals));assert.equal(app.writes.length,0);
});
test('cancel after one batch part completes never commits a partial replacement',async()=>{
  const app=setup({chartFixture:fourPartFixture}),n=app.nodes;await app.upload('Keep original.wav');await until(()=>app.savedSongs.size===1);
  n.chartScope.value='whole';const task=n.buildPartsButton.click();await until(()=>app.requests.length===3);
  await n.cancelUpload.click();await task;await settle();
  assert.deepEqual(Object.keys([...app.savedSongs.values()][0].charts),['guitar']);assert.equal(n.trackTitle.textContent,'Keep original');assert.match(n.chartStatus.textContent,/canceled/);
});

test('all four difficulties are ready after a whole-song upload, and switching never reanalyzes',async()=>{
  const D=E.Difficulties,chartFixture=part=>Array.from({length:80},(_,i)=>({time:1+i*.065,lane:i%5,pitch:50+i%5*3,duration:0}));
  const app=setup({mobile:true,chartFixture}),n=app.nodes;n.chartScope.value='whole';await app.upload();await until(()=>app.savedSongs.size===1);
  const saved=[...app.savedSongs.values()][0];assert.equal(app.decodes,1);assert.equal(app.requests.length,4);
  for(const radio of app.radios.instrument){
    await radio.emit('change');const charts=saved.charts[radio.value];
    for(const difficulty of app.radios.difficulty){
      await difficulty.emit('change');assert.match(n.chartSummary.textContent,new RegExp(D.NAMES[difficulty.value]));
      assert.match(n.chartSummary.textContent,new RegExp(`${charts[difficulty.value].length} notes`));
      assert.equal(app.frets.filter(f=>!f.disabled).length,D.frets(radio.value,difficulty.value));
      for(const level of D.LEVELS)assert.ok(n.chartDifficultySummary.textContent.includes(`${D.NAMES[level]}: ${charts[level].length}`));
      await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));assert.ok(app.sources.at(-1).buffer);
      await n.previewButton.click();
    }
  }
  assert.equal(app.requests.length,4);assert.equal(app.decodes,1);assert.equal(app.writes.length,0);
});
test('difficulty selection drives actual scoring, results, replay and separate personal bests',async()=>{
  const chartFixture=Array.from({length:28},(_,i)=>({time:1+i*.13,lane:i%5,pitch:50+i%5*3,duration:0}));
  const app=setup({chartFixture}),n=app.nodes;await app.upload();await until(()=>app.savedSongs.size===1);
  const saved=[...app.savedSongs.values()][0];
  for(const difficulty of app.radios.difficulty){
    await difficulty.emit('change');const notes=saved.charts.guitar[difficulty.value];
    await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;
    for(const note of notes){app.tick(start+note.time);await app.key('keydown',E.KEYS[note.lane]);await app.key('keyup',E.KEYS[note.lane]);}
    app.tick(start+18);assert.match(n.resultNotes.textContent,new RegExp(`${notes.length} of ${notes.length} notes hit`));assert.match(n.resultNotes.textContent,new RegExp(E.Difficulties.NAMES[difficulty.value]));
    await n.replayButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');app.tick(app.sources.at(-1).when-.1);assert.equal(n.score.textContent,'000,000');
    await n.mobileBackButton.click();
  }
  const bestKeys=app.writes.map(([key])=>key).filter(key=>key.includes(saved.id));
  assert.equal(new Set(bestKeys).size,4);for(const level of E.Difficulties.LEVELS)assert.ok(bestKeys.some(key=>key.includes(`-${level}-`)));
  assert.equal(app.requests.length,1);
});
test('opening an old three-level setlist song supplies Hard without a new upload or analysis',async()=>{
  const chartFixture=Array.from({length:40},(_,i)=>({time:1+i*.07,lane:i%5,duration:0})),app=setup({chartFixture});
  await app.upload();await until(()=>app.savedSongs.size===1);const current=[...app.savedSongs.values()][0];
  const legacy={...current,charts:{guitar:{easy:chartFixture.slice(0,3),normal:chartFixture,expert:chartFixture}}};
  const fresh=setup({chartFixture:[],savedSongs:new Map([[legacy.id,legacy]])});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.radios.difficulty[2].emit('change');await fresh.nodes.setlistEntries.children[1].click();
  assert.match(fresh.nodes.chartSummary.textContent,/Hard/);assert.equal(fresh.requests.length,0);assert.equal(fresh.decodes,1);
  await fresh.nodes.saveCurrentButton.click();const saved=[...fresh.savedSongs.values()][0];
  assert.equal(saved.charts.guitar.expert.length,40);for(const level of E.Difficulties.LEVELS)assert.ok(saved.charts.guitar[level]);
  assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),Buffer.from(await legacy.audioBlob.arrayBuffer()));
});


test('rebuilding a saved song retains the full new Expert master and saves all reduced levels',async()=>{
  const A=require('../dist/autochart.js');
  let rebuilt=false;
  const events=Array.from({length:24},(_,i)=>({time:1+Math.floor(i/2)*.4+(i%2)*.006,lane:i%6,strength:i%2?.0001:1}));
  const chartFixture=()=>rebuilt?A.buildFocusedCharts(events,'drums',.5,8,new Float32Array(800),.01).drums.expert:[{time:1,lane:0,duration:0}];
  const app=setup({chartFixture}),n=app.nodes;
  await app.radios.instrument[1].emit('change');await app.upload();await until(()=>app.savedSongs.size===1);
  const before=[...app.savedSongs.values()][0],audio=Buffer.from(await before.audioBlob.arrayBuffer());
  assert.equal(before.charts.drums.expert.length,1);
  rebuilt=true;await n.rechartButton.click();await until(()=>[...app.savedSongs.values()][0].charts.drums.expert.length===24);
  const saved=[...app.savedSongs.values()][0],charts=saved.charts.drums;
  assert.deepEqual(charts.expert.map(n=>[n.time,n.lane]),events.map(e=>[e.time,e.lane]));
  assert.ok(charts.expert.length>charts.hard.length);assert.ok(charts.hard.length>=charts.medium.length);assert.ok(charts.medium.length>=charts.easy.length);
  assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),audio);
  const fresh=setup({savedSongs:app.savedSongs});await until(()=>fresh.nodes.setlistEntries.children.length===2);
  await fresh.nodes.setlistEntries.children[1].click();await fresh.radios.difficulty[3].emit('change');
  assert.match(fresh.nodes.chartSummary.textContent,/Expert.*24 notes/);assert.equal(fresh.requests.length,0);
  const restored=await require('../dist/song-library.js').unpack(require('../dist/song-library.js').pack(saved));
  for(const level of E.Difficulties.LEVELS)assert.deepEqual(restored.charts.drums[level].map(n=>[n.time,n.lane]),charts[level].map(n=>[n.time,n.lane]));
});


for(const action of ['rebuild','parts','whole','reupload','reupload-after-demo'])test(`In Bloom score review preserves the player's Easy/Medium through ${action}`,async()=>{
  const crypto=require('node:crypto'),D=E.Difficulties,bytes=Buffer.from([1,1,2,3]),id=crypto.createHash('sha256').update(bytes).digest('hex');
  const fresh=part=>D.build(Array.from({length:32},(_,i)=>({time:1+i*.25,lane:i%5,duration:0})),part,.5);
  const lower={easy:[{id:0,time:3.141,lane:0,duration:0}],medium:[{id:0,time:3.141,lane:0,duration:0},{id:1,time:6.789,lane:4,duration:0}],normal:[{id:0,time:8.1,lane:2,duration:0}]};
  const previous={id,title:'In Bloom saved',instrument:'drums',musicEnd:16,duration:16.8,beat:.5,bpm:120,waveform:[],audioBlob:new Blob([bytes]),charts:{drums:{...fresh('drums'),...lower},guitar:fresh('guitar')}};
  const app=setup({savedSongs:new Map([[id,previous]]),chartFixture:fresh,chartResultExtras:part=>({quality:part==='drums'?{preserveEasyMedium:true,scoreRevision:4,scoreReview:'Expert and Hard updated'}:{}})}),n=app.nodes;
  await until(()=>n.setlistEntries.children.length===2);await n.setlistEntries.children[1].click();
  if(action==='rebuild')await n.rechartButton.click();
  else if(action==='parts'||action==='whole'){
    await app.radios.instrument[0].emit('change');n.chartScope.value=action==='whole'?'whole':'separate';await n.chartScope.emit('change');await n.buildPartsButton.click();
  }else{
    if(action==='reupload-after-demo'){await n.demoButton.click();await app.radios.instrument[1].emit('change');}
    await app.upload('Renamed In Bloom.wav');
  }
  await until(()=>app.savedSongs.get(id).quality?.preserveEasyMedium);
  const saved=app.savedSongs.get(id),plain=value=>JSON.parse(JSON.stringify(value));
  assert.equal(saved.quality.scoreRevision,4);
  for(const level of ['easy','medium','normal'])assert.deepEqual(plain(saved.charts.drums[level]),lower[level]);
  for(const level of ['expert','hard'])assert.deepEqual(plain(saved.charts.drums[level]),fresh('drums')[level]);
  assert.deepEqual(plain(saved.charts.guitar),fresh('guitar'));assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),bytes);
  const reopened=setup({savedSongs:app.savedSongs,chartFixture:[]});await until(()=>reopened.nodes.setlistEntries.children.length===2);await reopened.nodes.setlistEntries.children[1].click();await reopened.radios.instrument[1].emit('change');
  await reopened.radios.difficulty[0].emit('change');assert.match(reopened.nodes.chartSummary.textContent,/Easy.*1 notes/);assert.equal(reopened.requests.length,0);
});

const authoredText=(notes='192 = N 1 0\n204 = N 1 0\n216 = N 2 0\n240 = N 3 0\n288 = N 4 0\n336 = N 5 0\n384 = N 0 0',section='ExpertDrums')=>`[Song]\n{\nName = "Authored track"\nResolution = 192\n}\n[SyncTrack]\n{\n0 = B 120000\n}\n[${section}]\n{\n${notes}\n}\n`;
async function reviewAuthored(app,text=authoredText()){
  const n=app.nodes;await n.chartFilesButton.click();n.authoredChartFile.files=[{name:'notes.chart',size:text.length,text:async()=>text}];await n.authoredChartFile.emit('change');await n.reviewChartButton.click();
}
const chartAudio=()=>({name:'matching.wav',size:4,type:'audio/wav',arrayBuffer:async()=>new Uint8Array([7,1,2,3]).buffer});

test('authored chart + new audio → preview → setlist → fresh reopen without audio analysis',async()=>{
  const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true});
  const app=setup({libraryOverrides:s.library}),n=app.nodes;
  await reviewAuthored(app);assert.equal(n.loadChartButton.disabled,false);assert.match(n.chartFileStatus.textContent,/drums expert: 7/);
  n.chartAudioFile.files=[chartAudio()];await n.loadChartButton.click();
  assert.deepEqual(app.requests,[]);assert.equal(n.chartFilesDialog.open,false);assert.match(n.chartDetails.textContent,/Imported from notes.chart/);assert.match(n.chartDifficultySummary.textContent,/Expert: 7 \(imported\)/);assert.match(n.chartDifficultySummary.textContent,/Easy: .*derived/);
  assert.equal(n.setlistEntries.children.length,2);assert.match(n.saveStatus.textContent,/Added to your setlist/);
  await app.radios.difficulty[3].emit('change');await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
  assert.equal(app.sources.at(-1).offset,0);await n.mobileBackButton.click();
  const reopened=setup({libraryOverrides:s.fresh()});await until(()=>reopened.nodes.setlistEntries.children.length===2);await reopened.nodes.setlistEntries.children[1].click();
  assert.match(reopened.nodes.chartDetails.textContent,/Imported from notes.chart/);assert.deepEqual(reopened.requests,[]);assert.equal(reopened.nodes.trackKind.textContent,'IMPORTED CHART');
});

test('import Expert into current song preserves its audio and existing lower charts',async()=>{
  const app=setup({chartFixture:[{time:1,lane:1,duration:0},{time:2,lane:5,duration:0}]});await app.radios.instrument[1].emit('change');await app.upload();await until(()=>app.savedSongs.size===1);
  const previous=[...app.savedSongs.values()][0],lower=JSON.stringify([previous.charts.drums.easy,previous.charts.drums.medium,previous.charts.drums.hard]);
  await reviewAuthored(app);assert.equal(app.nodes.chartAudioMode.value,'current');await app.nodes.loadChartButton.click();
  const record=[...app.savedSongs.values()][0];assert.equal(app.decodes,1);assert.deepEqual(app.requests,['drums']);assert.deepEqual(JSON.parse(JSON.stringify([record.charts.drums.easy,record.charts.drums.medium,record.charts.drums.hard])),JSON.parse(lower));assert.equal(record.charts.drums.expert.length,7);
  assert.equal(record.id,previous.id);assert.equal(record.audioBlob,previous.audioBlob);assert.equal(app.nodes.setlistEntries.children.length,2);assert.match(app.nodes.chartDifficultySummary.textContent,/Medium: .*retained/);
});

test('invalid audio pairing and changed review settings never overwrite the current song',async()=>{
  const app=setup({chartFixture:[{time:1,lane:1,duration:0}]});await app.upload('Keep me.wav');await until(()=>app.savedSongs.size===1);const before=JSON.stringify([...app.savedSongs.values()][0].charts);
  await reviewAuthored(app,authoredText('20000 = N 5 0'));await app.nodes.loadChartButton.click();assert.match(app.nodes.chartFileStatus.textContent,/extends beyond/);assert.equal(app.nodes.trackTitle.textContent,'Keep me');assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),before);
  app.nodes.chartShift.value='20';await app.nodes.chartShift.emit('input');assert.equal(app.nodes.loadChartButton.disabled,true);
});

test('authored five-fret Easy remains playable and export files contain real chart/audio data',async()=>{
  const app=setup(),n=app.nodes;await reviewAuthored(app,authoredText('192 = N 4 0','EasySingle'));n.chartAudioFile.files=[chartAudio()];await n.loadChartButton.click();await app.radios.difficulty[0].emit('change');
  assert.equal(app.frets[4].disabled,false);await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;app.tick(start+.5);await app.key('keydown','KeyL');app.tick(start+.6);assert.equal(n.streak.textContent,1);await n.mobileBackButton.click();
  await n.chartFilesButton.click();await n.exportChartButton.click();const link=app.body.children.at(-1);assert.equal(link.download,'notes.chart');const chart=await (await fetch(link.href)).text();assert.match(chart,/\[EasySingle\]/);assert.equal(require('../dist/chart-exchange.js').parse(chart).charts.guitar.easy[0].lane,4);
  await n.exportChartIniButton.click();assert.match(await (await fetch(app.body.children.at(-1).href)).text(),/five_lane_drums = True/);
  await n.exportChartAudioButton.click();assert.deepEqual(new Uint8Array(await (await fetch(app.body.children.at(-1).href)).arrayBuffer()),new Uint8Array([7,1,2,3]));
});

test('finishing an imported-chart save does not interrupt playback started while saving',async()=>{
  let releaseSave;const app=setup({libraryOverrides:{save:async()=>new Promise(resolve=>{releaseSave=resolve;})}}),n=app.nodes;
  await reviewAuthored(app);n.chartAudioFile.files=[chartAudio()];const loading=n.loadChartButton.click();await until(()=>releaseSave);
  await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));releaseSave();await loading;
  assert.match(n.previewButton.textContent,/Stop preview/);assert.equal(n.pauseButton.disabled,false);app.tick(app.sources.at(-1).when+1);assert.match(n.stageStatus.textContent,/PREVIEW/);
});

test('automatic update safety waits for save, playback, pause, panels and failed storage',async()=>{
  let release;
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}],libraryOverrides:{save:()=>new Promise(resolve=>{release=resolve;})}}),n=app.nodes;
  assert.equal(app.updateSafety.canReload(),true);
  await app.upload();assert.equal(app.updateSafety.canReload(),false,'Unsaved audio and active save block reload');
  release();await until(()=>n.saveStatus.textContent.includes('Added to your setlist'));
  await until(()=>app.updateSafety.canReload());
  await n.playButton.click();assert.equal(app.updateSafety.canReload(),false);
  await n.pauseButton.click();assert.equal(app.updateSafety.canReload(),false,'Paused song must not be interrupted');
  await n.demoButton.click();assert.equal(app.updateSafety.canReload(),true);
  await n.libraryButton.click();assert.equal(app.updateSafety.canReload(),false);n.libraryDialog.close();
  n.offlineDialog.showModal();assert.equal(app.updateSafety.canReload(),false);assert.equal(app.updateSafety.canReload(true),true);
  const failed=setup({chartFixture:[],storageFailure:true});await failed.upload();await until(()=>failed.nodes.saveStatus.textContent.includes('Could not save'));
  assert.equal(failed.updateSafety.prepareReload(),false,'Never discard the unsaved copy after a failed write');
});

test('safe update remembers saved song and settings, then reopens without autoplay or reanalysis',async()=>{
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}]});await app.upload('Phone track.wav');await until(()=>app.updateSafety.canReload());
  await app.radios.difficulty[3].emit('change');assert.equal(app.updateSafety.prepareReload(),true);
  const fresh=setup({savedSongs:app.savedSongs,resumeStorage:app.resumeStorage});
  await until(()=>fresh.nodes.trackTitle.textContent==='Phone track');
  assert.equal(fresh.requests.length,0);assert.equal(fresh.sources.length,0);assert.equal(fresh.radios.difficulty[3].checked,true);
  assert.equal(fresh.resumeStorage.size,0,'Restore marker is consumed once');
});

test('opening an older In Bloom on mobile automatically saves corrected Expert/Hard once',async()=>{
  const id='551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3',musicEnd=272.66185941043085;
  const lower=[{lane:0,time:1.25,duration:0}],audioBlob=new Blob([new Uint8Array([1,2,3])]);
  const original={id,title:'In Bloom',instrument:'drums',musicEnd,duration:musicEnd+.8,beat:60/152,bpm:152,waveform:[],audioBlob,charts:{drums:{easy:lower,medium:lower,normal:lower,expert:lower,hard:lower}},quality:{scoreRevision:1}};
  const savedSongs=new Map([[id,original]]),app=setup({mobile:true,savedSongs,audioSamples:new Float32Array(Math.round(musicEnd*22050))});
  await until(()=>app.nodes.setlistEntries.children.length===2);await app.nodes.setlistEntries.children[1].click();
  const saved=savedSongs.get(id);assert.equal(saved.quality.scoreRevision,4);assert.equal(saved.charts.drums.expert.length,1401);assert.equal(saved.charts.drums.hard.length,1349);
  assert.deepEqual(saved.charts.drums.easy,require('../dist/song-library.js').validate(original).charts.drums.easy);
  assert.equal(saved.audioBlob,audioBlob);assert.equal(app.requests.length,0);assert.equal(app.updateSafety.canReload(),true);
  await app.nodes.setlistEntries.children[1].click();assert.equal(savedSongs.get(id),saved,'Current revision does not write again');
});

test('restoring a corrected song after update does not interrupt play started during its save',async()=>{
  const id='551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3',musicEnd=272.66185941043085;
  const notes=[{lane:0,time:1,duration:0}],levels={easy:notes,medium:notes,normal:notes,hard:notes,expert:notes};
  const original={id,title:'In Bloom restore',instrument:'guitar',musicEnd,duration:musicEnd+.8,beat:60/152,bpm:152,waveform:[],audioBlob:new Blob([new Uint8Array([1])]),charts:{drums:levels,guitar:levels},quality:{scoreRevision:1}};
  let release;
  const app=setup({mobile:true,savedSongs:new Map([[id,original]]),audioSamples:new Float32Array(Math.round(musicEnd*22050)),resumeStorage:new Map([['riffbound-update-resume-v1',JSON.stringify({id,instrument:'drums',difficulty:'expert',mode:'tap'})]]),libraryOverrides:{save:()=>new Promise(resolve=>{release=resolve;})}});
  await until(()=>release);assert.match(app.nodes.chartSummary.textContent,/Drums/);
  await app.nodes.playButton.click();await until(()=>app.sources.length>0);const playing=app.sources.at(-1);assert.equal(playing.stopped,undefined);
  release();await until(()=>app.nodes.saveStatus.textContent.includes('Added to your setlist'));await settle();
  assert.equal(playing.stopped,undefined);assert.equal(app.nodes.pauseButton.disabled,false);assert.equal(app.updateSafety.canReload(),false);
});
