const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../dist/offline.js'),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup({waiting=true,online=true,registerError=false}={}){
  const events=()=>({listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},emit(type,data={}){for(const fn of this.listeners[type]||[])fn(data);}});
  const nodes={};for(const id of ['reloadGameButton','offlineStatus','downloadGameButton','offlineButton','installAppButton','installInstructions','offlineDialog'])nodes[id]={...events(),hidden:true,disabled:false,close(){this.open=false;}};
  let now=100000,allowed=true,prepare=true,reloads=0,registers=0,updates=0,prepared=0;
  const messages=[],timers=new Map(),intervals=[];
  const worker={...events(),state:'installed',postMessage:message=>messages.push(message)};
  const reg={...events(),active:{},waiting:waiting?worker:null,installing:null,update:async()=>{updates++;}};
  const sw={...events(),controller:{postMessage:message=>messages.push(message)},register:async()=>{registers++;if(registerError)throw Error('Network');return reg;}};
  const navigator={onLine:online,serviceWorker:sw};
  const window={...events(),isSecureContext:true,RiffOfflineAssets:{version:'v37',files:['index.html']},RiffUpdateSafety:{canReload:()=>allowed,prepareReload:()=>{prepared++;return prepare;}}};
  const document={...events(),hidden:false,getElementById:id=>nodes[id]};
  const sandbox={window,document,navigator,location:{href:'https://game.example/',reload:()=>reloads++},URL,Date:{now:()=>now},WeakSet,setTimeout:(fn,delay)=>{const id={};timers.set(id,{fn,delay});return id;},setInterval:fn=>intervals.push(fn)};
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
