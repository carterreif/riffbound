const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../dist/update.js'),'utf8');
function setup({online=true,ok=true,type='text/javascript',url='https://game.example/update.js',body='RIFFBOUND_UPDATE_REPAIR',failure=null,hold=false,page='https://game.example/update.html'}={}){
 const nodes={};for(const id of ['repairUpdates','repairDone','repairStatus','openUpdatedGame'])nodes[id]={disabled:false,hidden:id==='repairDone',addEventListener(type,fn){this[type]=fn;}};
 const deleted=[],unregistered=[],requests=[],library=new Map([['song','audio-and-chart'],['settings','highway-and-controller']]);
 const caches={keys:async()=>['riffbound-offline-v127-1','riffbound-offline-v128-1','other-app'],delete:async key=>{deleted.push(key);return true;}};
 let resolveFetch;const pending=new Promise(resolve=>{resolveFetch=resolve;});
 const navigator={onLine:online,serviceWorker:{getRegistrations:async()=>['https://game.example/','https://game.example/other/'].map(scope=>({scope,unregister:async()=>{unregistered.push(scope);return true;}}))}};
 const sandbox={document:{getElementById:id=>nodes[id]},location:{href:page},navigator,window:{caches},caches,URL,Date,AbortController,setTimeout,clearTimeout,
  get indexedDB(){throw Error('Repair must never access the song library');},get localStorage(){throw Error('Repair must never access settings');},
  fetch:async(target,options)=>{requests.push({url:String(target),options});if(hold)await pending;if(failure)throw Error(failure);return {ok,url,headers:{get:()=>type},text:async()=>body};}};
 vm.runInNewContext(source,sandbox);
 return {nodes,deleted,unregistered,requests,library,resolveFetch,click:()=>nodes.repairUpdates.click()};
}
test('repair waits for a click and preserves songs, settings and unrelated caches',async()=>{
 const s=setup();assert.equal(s.requests.length,0);assert.equal(s.deleted.length,0);assert.equal(s.unregistered.length,0);
 await s.click();assert.deepEqual(s.unregistered,['https://game.example/']);assert.deepEqual(s.deleted,['riffbound-offline-v127-1','riffbound-offline-v128-1']);
 assert.equal(s.nodes.repairDone.hidden,false);assert.equal(s.nodes.repairUpdates.disabled,false);assert.match(s.nodes.repairStatus.textContent,/songs and settings were kept/);
 const target=new URL(s.nodes.openUpdatedGame.href);assert.equal(target.origin,'https://game.example');assert.equal(target.pathname,'/');assert.ok(target.searchParams.has('riffbound_refresh'));
 assert.deepEqual([...s.library],[['song','audio-and-chart'],['settings','highway-and-controller']]);assert.equal(s.requests[0].options.cache,'no-store');
});
test('offline and unverified online responses cannot clear the current offline game',async()=>{
 for(const options of [{online:false},{ok:false},{type:'text/html'},{url:'https://login.example/update.js'},{body:'Not the game'},{failure:'Network failed'}]){
  const s=setup(options);await s.click();assert.equal(s.deleted.length,0);assert.equal(s.unregistered.length,0);assert.equal(s.nodes.repairDone.hidden,true);assert.equal(s.nodes.repairUpdates.disabled,false);assert.match(s.nodes.repairStatus.textContent,/Could not finish.*song library has not been changed/);
 }
});
test('a double click cannot start two repairs and hosted extensionless links resolve correctly',async()=>{
 const s=setup({hold:true,page:'https://game.example/update'}),first=s.click();await s.click();assert.equal(s.requests.length,1);assert.equal(s.nodes.repairUpdates.disabled,true);s.resolveFetch();await first;assert.equal(s.deleted.length,2);assert.equal(new URL(s.nodes.openUpdatedGame.href).pathname,'/');
});
