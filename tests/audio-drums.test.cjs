const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const Core=require('../dist/audio-drum-core.js'),API=require('../dist/audio-drum-input.js'),Setup=require('../dist/audio-drum-setup.js'),E=require('../dist/engine.js'),L=require('../dist/song-library.js');
const rate=48000;
function hit(role,amp=.6,duration=.22){let seed=81;return Float32Array.from({length:Math.floor(rate*(duration+.08))},(_,i)=>{const t=i/rate-.08;if(t<0)return 0;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,s=f=>Math.sin(2*Math.PI*f*t),attack=Math.min(1,t/.0015);let x;
 if(role==='kick')x=(s(62)+.22*s(94))*Math.exp(-t/0.045);
 if(role==='floor')x=(s(112)+.32*s(223))*Math.exp(-t/.085);
 if(role==='tom')x=(s(265)+.32*s(421))*Math.exp(-t/.065);
 if(role==='snare')x=(.25*s(184)+.65*noise)*Math.exp(-t/.035);
 if(role==='hihat')x=(s(7100)+s(9100)+s(10800))*.28*Math.exp(-t/.02);
 if(role==='cymbal')x=(s(2400)+s(3300)+s(4900)+s(5500))*.22*Math.exp(-t/.11);
 return amp*x*attack;});}
function feed(detector,pcm,start=0){const events=[];for(let i=0;i<pcm.length;i+=128)detector.push([pcm.subarray(i,i+128)],start+i/rate,d=>{if(d.type==='onset')events.push(d);});return events;}
function train(){const templates={};for(const role of Core.ROLES){const features=[.42,.6,.78].map(a=>feed(new Core.StreamDetector(rate),hit(role,a))[0]?.feature);assert.ok(features.every(Boolean),role+' onset');templates[role]=Core.template(features);assert.ok(templates[role],role+' stable template');}return templates;}
function rig({storageData=new Map(),denied=false,delayed=false}={}){let clock=0,resolveCapture,requested=[],contexts=[],stops=0,hits=[],detections=[],changed=0;
 const port={label:'EAD50 USB audio',getSettings:()=>({deviceId:'ead-audio'}),stop:()=>stops++},stream={getTracks:()=>[port],getAudioTracks:()=>[port]},nodes=[];
 const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;},gain:{value:1},port:{postMessage:data=>n.last=data}};nodes.push(n);return n;};
 const navigator={mediaDevices:{getUserMedia:async c=>{requested.push(c);if(denied)throw Object.assign(Error('denied'),{name:'NotAllowedError'});if(delayed)return new Promise(r=>resolveCapture=r);return stream;},enumerateDevices:async()=>[{kind:'audioinput',deviceId:'ead-audio',label:port.label}]}};
 const input=new API.Input({navigator,storage:{getItem:k=>storageData.get(k),setItem:(k,v)=>storageData.set(k,v)},createContext:()=>{const c={currentTime:0,audioWorklet:{addModule:async name=>assert.equal(name,'audio-drum-worklet.js')},destination:{},createMediaStreamSource:node,createGain:node,resume:async()=>{},close:async()=>{c.closed=true;}};contexts.push(c);return c;},createWorklet:(c,options)=>{assert.ok(options.threshold>=.001&&options.threshold<=.2);return node();},now:()=>clock,onHit:h=>hits.push(h),onDetection:d=>detections.push(d),onChange:()=>changed++});
 return {input,port,stream,nodes,contexts,hits,detections,requested,storageData,get stops(){return stops;},get changed(){return changed;},resolve:()=>resolveCapture(stream),time:t=>{clock=t;contexts.at(-1).currentTime=t/1000;},frame:(feature,t=0)=>{clock=t;contexts.at(-1).currentTime=t/1000;input.frame({type:'onset',feature,rms:.1,time:t/1000});}};
}
test('real PCM soundcheck distinguishes all six damped drum/cymbal timbres across playing strengths',()=>{
 const templates=train();assert.deepEqual(Core.conflicts(templates),[]);
 for(const role of Core.ROLES)for(const amp of [.36,.55,.85]){const events=feed(new Core.StreamDetector(rate),hit(role,amp));assert.equal(events.length,1,role+' ringing tail must not retrigger');assert.deepEqual(Core.recognize(events[0].feature,templates).roles,[role],role+' recognized');}
 const silent=feed(new Core.StreamDetector(rate),new Float32Array(rate));assert.equal(silent.length,0);assert.deepEqual(Core.recognize(Array(48).fill(0),templates).roles,[]);
});
test('template classifier recognizes clear mixtures and rejects ambiguous/unknown spectra without reading a song',()=>{
 const templates=train(),mix=templates.kick.map((v,i)=>v*.7+templates.cymbal[i]*.7);assert.deepEqual(Core.recognize(mix,templates).roles.sort(),['cymbal','kick']);
 const unknown=Array(48).fill(0);unknown[47]=1;assert.deepEqual(Core.recognize(unknown,templates).roles,[]);assert.ok(Core.conflicts({...templates,cymbal:templates.hihat}).length);
 assert.deepEqual([Core.lane('cymbal',true),Core.lane('floor',true),Core.lane('cymbal'),Core.lane('floor')],[3,3,3,4]);
});
test('continuous PCM catches rapid repeated kicks and actual mixed drum attacks without tail retriggers',()=>{
 const templates=train(),pcm=new Float32Array(rate);for(let h=0;h<8;h++){const sound=hit('kick',.6),offset=Math.round((.1+h*.09)*rate);for(let i=0;i<sound.length&&i+offset<pcm.length;i++)pcm[i+offset]+=sound[i];}
 const events=feed(new Core.StreamDetector(rate),pcm);assert.equal(events.length,8);events.forEach((event,i)=>{assert.deepEqual(Core.recognize(event.feature,templates).roles,['kick']);assert.ok(Math.abs(event.time-(.18+i*.09))<.015,'timestamps retain the attack time rather than report delivery time');});
 for(const pair of [['kick','cymbal'],['snare','hihat'],['kick','snare'],['floor','cymbal']]){const a=hit(pair[0],.55),b=hit(pair[1],.55),events=feed(new Core.StreamDetector(rate),Float32Array.from(a,(x,i)=>x+b[i]));assert.equal(events.length,1);assert.deepEqual(Core.recognize(events[0].feature,templates).roles.sort(),pair.slice().sort());}
});
test('audio capture is explicit, unprocessed and muted; calibrated profiles reload without automatically capturing',async()=>{
 const r=rig();assert.equal(r.requested.length,0);await r.input.start();assert.equal(r.requested.length,1);assert.equal(r.requested[0].audio.echoCancellation,false);assert.equal(r.requested[0].audio.autoGainControl,false);assert.equal(r.input.mute.gain.value,0);assert.equal(r.input.enabled,false);
 const templates=train();r.input.calibrate();let t=1000;for(const role of Core.ROLES)for(let n=0;n<3;n++){r.frame(templates[role],t);t+=700;}assert.equal(r.input.ready,true);assert.equal(r.input.calibration,null);assert.equal(r.hits.length,0);r.input.setEnabled(true);r.frame(templates.snare,t);assert.equal(r.hits.length,1);assert.deepEqual(r.hits[0].roles,['snare']);
 const fresh=rig({storageData:r.storageData});assert.equal(fresh.requested.length,0);await fresh.input.start('ead-audio');assert.equal(fresh.input.ready,true);assert.equal(fresh.input.enabled,false);assert.deepEqual(fresh.requested[0].audio.deviceId,{exact:'ead-audio'});r.input.stop();assert.equal(r.stops,1);assert.equal(r.input.context,null);assert.equal(r.input.enabled,false);
});
test('stopping pending permission cannot reopen capture; denied permissions recover with clear state',async()=>{
 const denied=rig({denied:true});await denied.input.start();assert.match(denied.input.message,/permission was blocked/);assert.equal(denied.input.connecting,false);
 const r=rig({delayed:true}),pending=r.input.start();r.input.stop();r.resolve();await pending;assert.equal(r.input.stream,null);assert.equal(r.stops,1);assert.equal(r.contexts.length,0);
});
test('uncertain/clipped sounds, incomplete/conflicting soundchecks and timeout never emit playable hits',async()=>{
 const r=rig();await r.input.start();r.input.setEnabled(true);assert.equal(r.input.enabled,false);r.input.templates=train();r.input.templates.cymbal=r.input.templates.hihat;r.input.setEnabled(true);assert.equal(r.input.enabled,false);
 r.input.templates=train();r.input.setEnabled(true);r.input.frame({type:'onset',feature:r.input.templates.snare,clipping:true,time:0});assert.equal(r.hits.length,0);
 r.input.calibrate('snare');r.time(21000);r.input.frame({type:'meter',rms:0});assert.equal(r.input.calibration,null);assert.match(r.input.message,/timed out/);assert.equal(r.input.enabled,false);
 const ended=r.port.onended;ended();assert.equal(r.input.stream,null);assert.match(r.input.message,/disconnected/);
});
test('soundcheck/threshold persistence ignores corrupt profiles and reports storage failures',async()=>{
 const r=rig({storageData:new Map([[API.KEY,JSON.stringify({version:1,profiles:{'ead-audio':{templates:{snare:Array(48).fill('bad')},latency:999,threshold:-1}}})]])});await r.input.start();assert.equal(r.input.ready,false);assert.equal(r.input.latency,200);assert.equal(r.input.threshold,.001);
 r.input.storage.setItem=()=>{throw Error('quota');};r.input.settings(.035,60);assert.match(r.input.storageError,/could not save/);assert.equal(r.input.node.last.type,'threshold');r.input.forget();assert.deepEqual(r.input.templates,{});
});
// Production UI and game integration, using the existing deterministic DOM/audio adapter.
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const layout of ['four','five'])test(`audio recognition soundcheck reaches actual ${layout}-lane gameplay and respects pause/preview/focus`,async()=>{
 let input,app,controller;const capture=rig(),Controller=require('../dist/controller-input.js');class Hub extends Controller.Hub{constructor(options){super(options);controller=this;}}class Input extends API.Input{constructor(options){super({...options,navigator:capture.input.navigator,createContext:capture.input.createContext,createWorklet:capture.input.createWorklet,now:()=>((app?.audio?.currentTime||0)*1000)});input=this;}}
 const notes=[0,1,2,...(layout==='five'?[3,4]:[3]),5].map(lane=>({time:1,lane,duration:0})),record=L.validate({id:'e'.repeat(64),title:'Audio kit',artist:'Test',instrument:'drums',musicEnd:16,bpm:120,beat:.5,charts:{drums:E.Difficulties.build(notes,'drums',.5)},audioBlob:new Blob([new Uint8Array([1,2,3])]),quality:{drumLayout:layout}});record.audioBlob=new Blob([new Uint8Array([1,2,3])]);
 const events={};app=setup({savedSongs:new Map([[record.id,record]]),chartFixture:[],browserOverrides:{RiffControllerInput:{...Controller,Hub},RiffAudioDrumInput:{...API,Input},RiffAudioDrumSetup:Setup,addEventListener:(type,fn)=>(events[type]??=[]).push(fn)}});await until(()=>app.nodes.setlistEntries.children.length===2);await app.nodes.setlistEntries.children[1].click();const n=app.nodes;
 await n.controllerButton.click();assert.equal(n.controllerDialog.open,true);await n.audioDrumConnect.click();assert.equal(n.audioDrumEnabled.disabled,true);const templates=train();await n.audioDrumLearn.click();let captureTime=1;for(const role of Core.ROLES)for(let i=0;i<3;i++){input.now=()=>captureTime*1000;input.context.currentTime=captureTime;input.frame({type:'onset',feature:templates[role],rms:.1,time:captureTime});captureTime+=.7;}input.now=()=>app.audio.currentTime*1000;assert.equal(n.audioDrumEnabled.disabled,false);n.audioDrumEnabled.checked=true;await n.audioDrumEnabled.emit('change');assert.equal(input.enabled,true);
 const fire=role=>{input.context.currentTime=app.audio.currentTime;input.frame({type:'onset',feature:templates[role],time:app.audio.currentTime,rms:.1});};fire('snare');assert.equal(n.score.textContent,'000,000','setup must never score');n.controllerDialog.close();await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop preview'));app.tick(app.sources.at(-1).when+1);fire('snare');assert.equal(n.score.textContent,'000,000','preview does not score audio hits');await n.previewButton.click();await app.radios.difficulty.find(x=>x.value==='expert').emit('change');await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;app.tick(start+.5);await n.pauseButton.click();fire('snare');assert.equal(n.score.textContent,'000,000','pause does not score');await n.pauseResume.click();await until(()=>n.playText.textContent==='RESTART TRACK');const resumed=app.sources.at(-1).when;app.tick(resumed+1);
 controller.onAction('lane0',true,'duplicate-midi');input.onHit({roles:['snare'],at:app.audio.currentTime*1000-400,latency:0});assert.equal(n.score.textContent,'000,000','duplicate MIDI and stale audio cannot score');
 for(const role of layout==='five'?Core.ROLES:['snare','hihat','tom','floor','kick'])fire(role);app.tick(resumed+18);assert.equal(n.resultAccuracy.textContent,'100%');assert.match(n.resultNotes.textContent,new RegExp(`${notes.length} of ${notes.length} notes hit`));assert.ok(app.writes.some(([key])=>key.includes('audio-drums-v1')),'acoustic score is separate');
 await n.controllerButton.click();input.calibrate();n.controllerDialog.close();await n.controllerDialog.emit('close');assert.equal(input.calibration,null);
 for(const fn of events.blur||[])fn();assert.equal(input.stream,null);assert.equal(input.enabled,false);
});

test('production AudioWorklet emits timestamped attacks and no monitored audio; every module is available offline',()=>{
 let Processor;const messages=[],sandbox={sampleRate:rate,currentTime:0,RiffAudioDrumCore:Core,AudioWorkletProcessor:class{constructor(){this.port={postMessage:d=>messages.push(d)};}},registerProcessor:(name,type)=>{assert.equal(name,'riff-drum-capture');Processor=type;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/audio-drum-worklet.js'),'utf8').replace(/^import[^\n]+\n/,''),sandbox);const p=new Processor({processorOptions:{threshold:.012}}),pcm=hit('kick');for(let i=0;i<pcm.length;i+=128){sandbox.currentTime=i/rate;const out=new Float32Array(128);assert.equal(p.process([[pcm.subarray(i,i+128)]],[[out]]),true);assert.ok(out.every(x=>x===0));}
 const attacks=messages.filter(m=>m.type==='onset');assert.equal(attacks.length,1);assert.deepEqual(Core.recognize(attacks[0].feature,train()).roles,['kick']);assert.ok(attacks[0].time>.06&&attacks[0].time<.1);
 const assets={self:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/offline-assets.js'),'utf8'),assets);for(const file of ['audio-drum-bootstrap.js','audio-drum-core.js','audio-drum-input.js','audio-drum-worklet.js','audio-drum-setup.js'])assert.ok(assets.self.RiffOfflineAssets.files.includes(file));
});
test('worklet setup failure stops media tracks and leaves the audio input reconnectable',async()=>{
 const r=rig();r.input.createWorklet=()=>{throw Error('Worklet unavailable');};await r.input.start();assert.equal(r.input.stream,null);assert.equal(r.input.connecting,false);assert.ok(r.stops>=1);assert.equal(r.contexts[0].closed,true);assert.match(r.input.message,/Worklet unavailable/);
});


test('audio browser scripts initialize on window and the production Connect button requests permission exactly once',async()=>{
 const browserCode=code.replace('vm.createContext(sandbox);if(window.RiffControllerInput)',"vm.createContext(sandbox);window.document=document;for(const f of ['audio-drum-bootstrap.js','audio-drum-core.js','audio-drum-input.js','audio-drum-setup.js'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+f),'utf8'),sandbox);if(window.RiffControllerInput)");
 const actualSetup=new Function('require',browserCode+'\nreturn setup;')(createRequire(adapter));let requests=0,deny;const browserEvents={};
 const app=actualSetup({chartFixture:[],browserOverrides:{RiffControllerInput:require('../dist/controller-input.js'),addEventListener:(type,fn)=>(browserEvents[type]??=[]).push(fn),navigator:{getGamepads:()=>[],mediaDevices:{getUserMedia:()=>{requests++;return new Promise((resolve,reject)=>deny=reject);}}}}});
 await app.nodes.controllerButton.click();assert.equal(app.nodes.audioDrumConnect.dataset.audioReady,'true','classic-script globals must initialize the handler, not silently skip setup');const pending=app.nodes.audioDrumConnect.click();assert.equal(requests,1);assert.match(app.nodes.audioDrumStatus.textContent,/Requesting microphone access/);for(const fn of browserEvents.blur||[])fn();assert.equal(app.nodes.audioDrumConnect.disabled,true,'browser permission UI focus changes must not cancel a pending request');deny(Object.assign(Error('No device'),{name:'NotFoundError'}));await pending;assert.equal(requests,1);assert.match(app.nodes.audioDrumStatus.textContent,/No microphone or audio input was found/);assert.equal(app.nodes.audioDrumConnect.disabled,false);
 const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');assert.ok(html.indexOf('id="audioDrumConnect"')<html.indexOf('id="audioDrumStatus"'));assert.ok(html.indexOf('id="audioDrumStatus"')<html.indexOf('id="audioDrumLevel"'),'startup status is beside Connect, above the input controls');
});
function bootRig({secure=true,blocked=false}={}){
 const nodes=Object.fromEntries(['audioDrumConnect','audioDrumStatus'].map(id=>[id,{dataset:{},disabled:false,textContent:'',listeners:{},addEventListener:(type,fn)=>nodes[id].listeners[type]=fn}]));const listeners={},window={isSecureContext:secure,document:{getElementById:id=>nodes[id],permissionsPolicy:{allowsFeature:()=>!blocked}},addEventListener:(type,fn)=>listeners[type]=fn};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/audio-drum-bootstrap.js'),'utf8'),{window});return {nodes,window,listeners,click:()=>nodes.audioDrumConnect.listeners.click()};
}
test('Connect gives visible feedback for stale scripts, blocked views, insecure tabs and unexpected startup errors',async()=>{
 const r=bootRig();await r.click();assert.match(r.nodes.audioDrumStatus.textContent,/did not finish loading/);r.window.RiffAudioDrumBoot.bind(()=>{throw Error('startup failed');});await r.click();assert.match(r.nodes.audioDrumStatus.textContent,/startup failed/);assert.equal(r.nodes.audioDrumConnect.disabled,false);
 r.listeners.error({target:{tagName:'SCRIPT',src:'https://test/audio-drum-input.js'}});assert.match(r.nodes.audioDrumStatus.textContent,/file could not load/);
 for(const [options,expected] of [[{secure:false},/secure browser tab/],[{blocked:true},/blocks microphone access/]]){const b=bootRig(options);let calls=0;b.window.RiffAudioDrumBoot.bind(()=>calls++);await b.click();assert.equal(calls,0);assert.match(b.nodes.audioDrumStatus.textContent,expected);}
});
test('Connect identifies missing/busy audio inputs separately from microphone permission failures',async()=>{
 for(const [name,expected] of [['NotFoundError',/No microphone or audio input was found/],['NotReadableError',/Windows could not open/],['SecurityError',/permission was blocked/],['OverconstrainedError',/System default audio input/]]){const r=rig();r.input.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(Error('Device issue'),{name});};await r.input.start();assert.match(r.input.message,expected);assert.equal(r.input.connecting,false);assert.equal(r.input.stream,null);}
});
