const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../dist/offline.js'),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup({waiting=true,online=true,registerError=false,firstInstall=false,cacheReady=false,saveError=null,silentSave=false,version='v37',label='Game version 39',reloadStorage=new Map(),reloadStorageBlocked=false,reloadWriteBlocked=false}={}){
  const events=()=>({listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);},emit(type,data={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn(data)));}});
  const nodes={};for(const id of ['gameVersion','offlineVersion','reloadGameButton','offlineStatus','downloadGameButton','offlineButton','installAppButton','installInstructions','offlineDialog'])nodes[id]={...events(),hidden:true,disabled:false,close(){this.open=false;}};
  nodes.gameVersion.textContent=label;
  let now=100000,allowed=true,prepare=true,reloads=0,registers=0,updates=0,prepared=0;
  const messages=[],timers=new Map(),intervals=[];
  const worker={...events(),state:'installed',postMessage:message=>messages.push(message)};
  const active={state:'activated',postMessage(message,ports){messages.push(message);if(message.type==='SAVE_OFFLINE'&&!silentSave){ports[0].postMessage({type:'PROGRESS',completed:1,total:1});if(saveError)ports[0].postMessage({type:'ERROR',message:saveError});else{cacheReady=true;ports[0].postMessage({type:'SAVED',version:'v37'});}}}};
  const reg={...events(),active:firstInstall?null:active,waiting:waiting?worker:null,installing:firstInstall?worker:null,update:async()=>{updates++;if(!reg.active&&!reg.waiting&&!reg.installing)throw new DOMException('No newest worker','InvalidStateError');}};
  if(firstInstall)worker.state='installing';
  const sw={...events(),controller:{postMessage:message=>messages.push(message)},register:async()=>{registers++;if(registerError)throw Error('Network');return reg;}};
  const navigator={onLine:online,serviceWorker:sw};
  const window={...events(),isSecureContext:true,RiffOfflineAssets:{version,files:['index.html']},RiffUpdateSafety:{canReload:()=>allowed,prepareReload:()=>{prepared++;return prepare;}}};
  const document={...events(),hidden:false,getElementById:id=>nodes[id]};
  class MessageChannel{constructor(){const a={closed:false,close(){this.closed=true;}},b={close(){}};a.postMessage=data=>queueMicrotask(()=>b.onmessage?.({data}));b.postMessage=data=>queueMicrotask(()=>{if(!a.closed)a.onmessage?.({data});});this.port1=a;this.port2=b;}}
  const caches={open:async()=>({match:async()=>cacheReady?{ok:true}:undefined})};window.caches=caches;
  const sessionStorage={getItem:key=>{if(reloadStorageBlocked)throw Error('Storage blocked');return reloadStorage.get(key)||null;},setItem:(key,value)=>{if(reloadStorageBlocked||reloadWriteBlocked)throw Error('Storage blocked');reloadStorage.set(key,value);}};
  const sandbox={window,document,navigator,caches,MessageChannel,sessionStorage,clearTimeout:id=>timers.delete(id),location:{href:'https://game.example/',reload:()=>reloads++},URL,Date:{now:()=>now},WeakSet,setTimeout:(fn,delay)=>{const id={};timers.set(id,{fn,delay});return id;},setInterval:fn=>intervals.push(fn)};
  vm.runInNewContext(source,sandbox);
  return {nodes,sw,worker,reg,navigator,window,document,messages,intervals,timers,get reloads(){return reloads;},get registers(){return registers;},get updates(){return updates;},get prepared(){return prepared;},allow:v=>{allowed=v;},storage:v=>{prepare=v;},time:delta=>{now+=delta;},retry:()=>{const batch=[...timers.values()];timers.clear();now+=5000;batch.forEach(t=>t.fn());},version:version=>sw.emit('message',{source:sw.controller,data:{type:'GAME_VERSION',version}})};
}
test('registers without pressing download, applies ready update and reloads once',async()=>{
  const s=setup();await flush();assert.equal(s.registers,1);assert.ok(s.messages.some(m=>m.type==='ACTIVATE_UPDATE'&&m.automatic));
  s.sw.emit('controllerchange');assert.equal(s.messages.at(-1).type,'GET_VERSION');s.version('v38');s.version('v38');assert.equal(s.reloads,1);assert.equal(s.prepared,1);
});
test('update arriving during play or unsaved work waits, including controller changes from another tab',async()=>{
  const s=setup({waiting:false});await flush();s.allow(false);s.reg.waiting=s.worker;
  s.time(61000);s.window.emit('focus');await flush();assert.ok(!s.messages.some(m=>m.type==='ACTIVATE_UPDATE'));
  s.version('v38');assert.equal(s.reloads,0);s.retry();assert.equal(s.reloads,0);
  s.allow(true);s.retry();assert.equal(s.reloads,1);
});
test('first install does not reload the same game or loop; hidden pages wait',async()=>{
  const s=setup({waiting:false});await flush();s.sw.emit('controllerchange');s.version('v37');assert.equal(s.reloads,0);
  s.document.hidden=true;s.version('v38');assert.equal(s.reloads,0);
  s.document.hidden=false;s.document.emit('visibilitychange');assert.equal(s.reloads,1);
});
test('offline startup retries on reconnect, return to app and periodic checks',async()=>{
  const s=setup({online:false,waiting:false});await flush();assert.equal(s.registers,0);
  s.navigator.onLine=true;s.window.emit('online');await flush();assert.equal(s.registers,1);
  const first=s.updates;s.time(61000);s.window.emit('focus');await flush();assert.equal(s.updates,first+1);
  s.time(300000);s.intervals[0]();await flush();assert.equal(s.updates,first+2);
});
test('failed update downloads keep existing game and failed resume storage defers reload',async()=>{
  const fail=setup({registerError:true});await flush();assert.equal(fail.reloads,0);assert.match(fail.nodes.offlineStatus.textContent,/current game and saved songs/);
  const s=setup({waiting:false});await flush();s.storage(false);s.version('v38');assert.equal(s.reloads,0);
  s.storage(true);s.retry();assert.equal(s.reloads,1);
});
test('manual update obeys unsaved/play safety and closes only the offline panel when safe',async()=>{
  const s=setup({waiting:false});await flush();s.allow(false);s.version('v38');s.nodes.offlineDialog.open=true;
  s.nodes.reloadGameButton.emit('click');assert.equal(s.reloads,0);assert.equal(s.nodes.offlineDialog.open,true);
  s.allow(true);s.nodes.reloadGameButton.emit('click');assert.equal(s.reloads,1);assert.equal(s.nodes.offlineDialog.open,false);
});
test('an unrelated message cannot force a reload',async()=>{
  const s=setup({waiting:false});await flush();s.sw.emit('message',{source:{},data:{type:'GAME_VERSION',version:'anything'}});assert.equal(s.reloads,0);
});

test('update button stays visible, reports the installed version, and checks again on demand',async()=>{
  const s=setup({waiting:false});await flush();
  assert.equal(s.nodes.reloadGameButton.hidden,false);assert.equal(s.nodes.reloadGameButton.textContent,'Check for updates');
  assert.equal(s.nodes.offlineVersion.textContent,'Game version 37');assert.match(s.nodes.offlineStatus.textContent,/No new update found.*Game version 37/);
  const before=s.updates;s.nodes.reloadGameButton.emit('click');await flush();assert.equal(s.updates,before+1);assert.equal(s.reloads,0);
  s.allow(false);s.reg.waiting=s.worker;s.nodes.reloadGameButton.emit('click');await flush();
  assert.equal(s.nodes.reloadGameButton.textContent,'Use updated game');assert.equal(s.reloads,0);
});
test('stale version-100 HTML reports the loaded release from the real offline manifest',async()=>{
 const sandbox={self:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/offline-assets.js'),'utf8'),sandbox);
 const s=setup({waiting:false,cacheReady:true,version:sandbox.self.RiffOfflineAssets.version,label:'Game version 100'});await flush();assert.equal(s.nodes.gameVersion.textContent,'Game version 115');assert.equal(s.nodes.offlineVersion.textContent,'Game version 115');assert.match(s.nodes.offlineStatus.textContent,/No new update found.*Game version 115/);assert.equal(s.reloads,0);
});
test('future releases update both version labels without HTML edits; invalid versions do not claim an old release',async()=>{
 for(const version of ['riffbound-offline-v104-1','v104']){const s=setup({waiting:false,version,label:'Game version 100'});await flush();assert.equal(s.nodes.offlineVersion.textContent,'Game version 104');assert.equal(s.nodes.gameVersion.textContent,'Game version 104');}
 const s=setup({waiting:false,version:'bad-config',label:'Game version 100'});await flush();assert.equal(s.nodes.gameVersion.textContent,'Game version unavailable');assert.doesNotMatch(s.nodes.offlineStatus.textContent,/version 100/);
});
test('version 103 patch activation refreshes an older version 103 page once and never downgrades it',async()=>{
 const s=setup({waiting:false,version:'riffbound-offline-v103-1'});await flush();s.version('riffbound-offline-v103-2');assert.equal(s.reloads,1);assert.equal(s.prepared,1);s.version('riffbound-offline-v103-2');assert.equal(s.reloads,1);
 const current=setup({waiting:false,version:'riffbound-offline-v103-2'});await flush();current.version('riffbound-offline-v100-1');assert.equal(current.reloads,0);
});

test('checking during a download shows progress, then offers the ready update without claiming current',async()=>{
  const s=setup({waiting:false});await flush();s.allow(false);s.worker.state='installing';s.reg.installing=s.worker;s.reg.emit('updatefound');
  s.nodes.reloadGameButton.emit('click');await flush();assert.match(s.nodes.offlineStatus.textContent,/Downloading game files/);assert.doesNotMatch(s.nodes.offlineStatus.textContent,/No new update found/);
  s.worker.state='installed';s.reg.waiting=s.worker;s.worker.emit('statechange');
  assert.equal(s.nodes.reloadGameButton.textContent,'Use updated game');assert.equal(s.nodes.reloadGameButton.hidden,false);assert.equal(s.reloads,0);
});

test('offline checks and failed downloads explain the next action without losing the retry button',async()=>{
  const s=setup({waiting:false,online:false});await flush();s.nodes.reloadGameButton.emit('click');await flush();
  assert.match(s.nodes.offlineStatus.textContent,/You are offline/);assert.equal(s.nodes.reloadGameButton.hidden,false);assert.equal(s.registers,0);
  s.navigator.onLine=true;s.window.emit('online');await flush();
  s.worker.state='installing';s.reg.installing=s.worker;s.reg.emit('updatefound');s.worker.state='redundant';s.worker.emit('statechange');
  assert.match(s.nodes.offlineStatus.textContent,/download did not finish/);assert.equal(s.nodes.reloadGameButton.disabled,false);
  s.reg.installing=null;s.nodes.reloadGameButton.emit('click');await flush();assert.match(s.nodes.offlineStatus.textContent,/No new update found/);
});

test('new installation is allowed to finish without a redundant update request',async()=>{
  const s=setup({waiting:false,firstInstall:true});await flush();assert.equal(s.registers,1);assert.equal(s.updates,0);
  s.nodes.reloadGameButton.emit('click');await flush();assert.equal(s.updates,0);assert.match(s.nodes.offlineStatus.textContent,/Downloading/);
  s.worker.state='redundant';s.worker.emit('statechange');s.reg.installing=null;
  s.nodes.reloadGameButton.emit('click');await flush();assert.equal(s.registers,2,'An empty failed registration is registered again');assert.equal(s.updates,0);
});

test('Save offline repairs missing files, verifies the cache, and finishes with an explicit success',async()=>{
  const s=setup({waiting:false});await flush();await s.nodes.downloadGameButton.emit('click');
  assert.ok(s.messages.some(m=>m.type==='SAVE_OFFLINE'));assert.match(s.nodes.offlineStatus.textContent,/Game saved for offline play/);
  assert.equal(s.nodes.downloadGameButton.disabled,false);assert.equal(s.nodes.reloadGameButton.disabled,false);
});

test('Save offline waits for first activation and does not promise completion while still downloading',async()=>{
  const s=setup({waiting:false,firstInstall:true,cacheReady:true});await flush();const done=s.nodes.downloadGameButton.emit('click');await flush();
  assert.equal(s.nodes.downloadGameButton.disabled,true);assert.match(s.nodes.offlineStatus.textContent,/Downloading/);
  s.worker.state='activated';s.reg.active=s.worker;s.reg.installing=null;s.worker.emit('statechange');await done;
  assert.equal(s.nodes.downloadGameButton.disabled,false);assert.match(s.nodes.offlineStatus.textContent,/Game saved for offline play/);
});

test('Save offline reports worker storage failures and timeouts and leaves both buttons retryable',async()=>{
  const s=setup({waiting:false,saveError:'Not enough space for game.js'});await flush();await s.nodes.downloadGameButton.emit('click');
  assert.match(s.nodes.offlineStatus.textContent,/space/);assert.doesNotMatch(s.nodes.offlineStatus.textContent,/Game saved for offline play/);
  assert.equal(s.nodes.downloadGameButton.disabled,false);assert.equal(s.nodes.reloadGameButton.disabled,false);
  const hung=setup({waiting:false,silentSave:true});await flush();const done=hung.nodes.downloadGameButton.emit('click');await flush();hung.retry();await done;
  assert.match(hung.nodes.offlineStatus.textContent,/stopped responding/);assert.equal(hung.nodes.downloadGameButton.disabled,false);
});

test('an older controlling worker does not reload a newer page in a loop',async()=>{
  const s=setup({waiting:false});await flush();s.version('v36');assert.equal(s.reloads,0);
  s.version('v37');assert.equal(s.reloads,0);s.version('v38');assert.equal(s.reloads,1);
});

test('a stuck browser update check times out and returns a usable retry button',async()=>{
  const s=setup({waiting:false});await flush();s.reg.update=()=>new Promise(()=>{});
  const done=s.nodes.reloadGameButton.emit('click');await flush();assert.equal(s.nodes.reloadGameButton.disabled,true);
  s.retry();await done;assert.equal(s.nodes.reloadGameButton.disabled,false);assert.match(s.nodes.offlineStatus.textContent,/update check timed out/);
});


test('a stale cached page cannot repeatedly restart itself across fresh page loads',async()=>{
 const reloadStorage=new Map();
 const first=setup({waiting:false,reloadStorage});await flush();first.version('v38');assert.equal(first.reloads,1);
 const stale=setup({waiting:false,reloadStorage});await flush();stale.version('v38');assert.equal(stale.reloads,0,'A second page boot must break the reload loop');assert.match(stale.nodes.offlineStatus.textContent,/automatic refresh paused/i);assert.equal(stale.nodes.reloadGameButton.textContent,'Use updated game');
 stale.retry();stale.window.emit('focus');stale.version('v38');await flush();assert.equal(stale.reloads,0);
 await stale.nodes.reloadGameButton.emit('click');assert.equal(stale.reloads,1,'The player can still explicitly retry the update');
 const again=setup({waiting:false,reloadStorage});await flush();again.version('v38');assert.equal(again.reloads,0,'A manual retry cannot restart the automatic loop on the next boot');
});
test('reload protection remembers recent target versions while allowing the next release',async()=>{
 const reloadStorage=new Map();
 for(const target of ['v38','v39']){const app=setup({waiting:false,reloadStorage});await flush();app.version(target);assert.equal(app.reloads,1);}
 const old=setup({waiting:false,reloadStorage});await flush();old.version('v38');assert.equal(old.reloads,0,'Alternating cached versions must not evade the guard');
 const current=setup({waiting:false,reloadStorage,version:'v39'});await flush();current.version('v39');assert.equal(current.reloads,0);current.version('v40');assert.equal(current.reloads,1);
});
test('blocked session storage leaves automatic refresh paused and explicit update usable',async()=>{
 const app=setup({waiting:false,reloadStorageBlocked:true});await flush();app.version('v38');assert.equal(app.reloads,0);assert.match(app.nodes.offlineStatus.textContent,/automatic refresh paused/i);await app.nodes.reloadGameButton.emit('click');assert.equal(app.reloads,1);
});
test('an unsafe run or failed resume preparation does not spend its one automatic refresh',async()=>{
 const reloadStorage=new Map(),app=setup({waiting:false,reloadStorage});await flush();app.storage(false);app.version('v38');assert.equal(app.reloads,0);assert.equal(reloadStorage.size,0);app.storage(true);app.retry();assert.equal(app.reloads,1);
});

test('a failed refresh-history write cannot start an unguarded automatic reload',async()=>{
 const app=setup({waiting:false,reloadWriteBlocked:true});await flush();app.version('v38');assert.equal(app.reloads,0);assert.match(app.nodes.offlineStatus.textContent,/automatic refresh paused/i);await app.nodes.reloadGameButton.emit('click');assert.equal(app.reloads,1);
});
