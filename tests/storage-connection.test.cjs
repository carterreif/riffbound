// Fault-injected IndexedDB lifecycle: fresh handles share persistent stores.
// error events precede abort/rollback; close events may arrive much later.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../dist/song-library.js'),'utf8');
function storage(){
  const stores=new Map(),connections=[],opens=[],commits=[];
  let broken=false,writeFault=null,finishAbort=null,blockNext=false;
  const closing=()=>new DOMException("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",'InvalidStateError');
  function database(){
    const d={closed:false,close(){d.closed=true;},createObjectStore(name){stores.set(name,new Map());},transaction(names,mode){
      if(d.closed||broken)throw closing();
      const snapshot=new Map([...stores].map(([name,rows])=>[name,new Map(rows)]));
      const tx={pending:0,aborted:false,error:null};
      const rollback=()=>{stores.clear();for(const [name,rows] of snapshot)stores.set(name,rows);queueMicrotask(()=>tx.onabort?.());};
      tx.abort=()=>{if(tx.aborted)return;tx.aborted=true;rollback();};
      const request=action=>{
        const r={};tx.pending++;
        queueMicrotask(()=>{
          if(!tx.aborted)try{r.result=action();r.onsuccess?.();}catch(error){
            tx.error=error;tx.aborted=true;r.error=error;tx.onerror?.({target:r});
            if(error.name==='AbortError'){d.closed=true;finishAbort=()=>{finishAbort=null;rollback();};}
            else rollback();
          }
          if(--tx.pending===0&&!tx.aborted)queueMicrotask(()=>{commits.push(mode);tx.oncomplete?.();});
        });return r;
      };
      tx.objectStore=name=>({
        get:id=>request(()=>structuredClone(stores.get(name).get(id))),
        getAll:()=>request(()=>[...stores.get(name).values()].map(v=>structuredClone(v))),
        put:(value,id)=>request(()=>{if(name==='audio'&&writeFault){const fault=writeFault;writeFault=null;throw fault;}stores.get(name).set(id??value.id,structuredClone(value));}),
        delete:id=>request(()=>stores.get(name).delete(id))
      });return tx;
    }};
    connections.push(d);return d;
  }
  const indexedDB={open(){
    const r={};opens.push(r);
    r.finish=()=>{r.result=database();if(!stores.size)r.onupgradeneeded?.();r.onsuccess?.();};
    queueMicrotask(()=>{if(blockNext){blockNext=false;r.onblocked?.();}else r.finish();});return r;
  }};
  const window={indexedDB,crypto:require('node:crypto').webcrypto};
  window.RiffDifficulties=require('../dist/chart-difficulties.js');
  vm.runInNewContext(source,{window,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,Date,Promise});
  return {library:window.RiffLibrary,connections,opens,commits,breakAll:value=>{broken=value;},failWrite:error=>{writeFault=error;},block:()=>{blockNext=true;},get finishAbort(){return finishAbort;}};
}
const record=()=>({id:'a'.repeat(64),title:'Original',instrument:'drums',musicEnd:10,bpm:120,beat:.5,charts:{drums:{easy:[],normal:[{lane:1,time:1,duration:0}],expert:[{lane:1,time:1,duration:0}]}},waveform:[.5],audioBlob:new Blob(['original audio'],{type:'audio/wav'})});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('the exact closing-connection failure reopens and saves both audio and chart',async()=>{
  const s=storage(),L=s.library,r=record();await L.list();s.connections[0].close();
  await L.save(r);const saved=await L.get(r.id);
  assert.equal(s.opens.length,2);assert.equal(await saved.audioBlob.text(),'original audio');assert.equal(saved.charts.drums.expert[0].lane,1);
  assert.equal((await L.list()).length,1);assert.equal(s.commits.filter(m=>m==='readwrite').length,1);
});
test('unexpected close events and version changes invalidate only their own handle',async()=>{
  const s=storage(),L=s.library;await L.save(record());const old=s.connections[0];
  old.closed=true;old.onclose?.();await L.list();assert.equal(s.opens.length,2);
  old.onclose?.();old.onversionchange?.();await L.list();assert.equal(s.opens.length,2,'A late old event must not discard the replacement');
  s.connections[1].onversionchange();await L.list();assert.equal(s.opens.length,3);
});
test('concurrent setlist reads and save retries share a fresh connection',async()=>{
  const s=storage(),L=s.library;await L.list();s.connections[0].close();
  const result=await Promise.allSettled([L.list(),L.save(record()),L.list()]);
  assert.ok(result.every(r=>r.status==='fulfilled'));assert.equal(s.opens.length,2);
  assert.equal((await L.list()).length,1);assert.equal(await (await L.get(record().id)).audioBlob.text(),'original audio');
});
test('a disconnected write waits for rollback before retrying and keeps both instruments',async()=>{
  const s=storage(),L=s.library,r=record();await L.save(r);
  s.failWrite(new DOMException('The database connection was lost.','AbortError'));
  const charts={guitar:{easy:[],normal:[{lane:2,time:2,duration:0}],expert:[{lane:2,time:2,duration:0}]}};
  const saving=L.save({...r,instrument:'guitar',charts,title:'Both parts'});
  // Attach a handler immediately so the pre-fix rejected promise is observable.
  const result=saving.then(()=>({ok:true}),error=>({ok:false,error}));
  await settle();assert.equal(s.opens.length,1,'Do not replay a transaction before its abort event');
  assert.ok(s.finishAbort);s.finishAbort();const outcome=await result;assert.ok(outcome.ok,outcome.error?.message);
  const saved=await L.get(r.id);assert.deepEqual(Object.keys(saved.charts).sort(),['drums','guitar']);
  assert.equal(saved.title,'Both parts');assert.equal(await saved.audioBlob.text(),'original audio');
  assert.equal(s.commits.filter(m=>m==='readwrite').length,2,'Exactly the initial save and the retry commit');
});
test('a retried older save cannot overwrite a newer save or resurrect a removed song',async()=>{
  const s=storage(),L=s.library,r=record();await L.save(r);
  s.failWrite(new DOMException('The database connection was lost.','AbortError'));
  const first=L.save({...r,title:'Older chart'});await settle();
  const newer=L.save({...r,title:'Newest chart'});await settle();
  assert.equal(s.opens.length,1,'Keep later writes queued until the failed write has finished retrying');
  s.finishAbort();await Promise.all([first,newer]);assert.equal((await L.get(r.id)).title,'Newest chart');
  s.failWrite(new DOMException('The database connection was lost.','AbortError'));
  const save=L.save(r);await settle();const remove=L.remove(r.id);s.finishAbort();await Promise.all([save,remove]);
  assert.equal(await L.get(r.id),null);
});
test('persistent connection failures stop after one retry and allow a later manual retry',async()=>{
  const s=storage(),L=s.library;await L.save(record());s.breakAll(true);
  await assert.rejects(L.save({...record(),title:'Updated'}),error=>error.code==='STORAGE_CONNECTION_CLOSED');
  assert.equal(s.opens.length,2);s.breakAll(false);await L.save({...record(),title:'Updated'});
  assert.equal(s.opens.length,3);assert.equal((await L.get(record().id)).title,'Updated');
});
test('quota errors roll back without automatically replaying the write',async()=>{
  const s=storage(),L=s.library;await L.save(record());s.failWrite(new DOMException('Storage quota exceeded','QuotaExceededError'));
  await assert.rejects(L.save({...record(),title:'Must not replace'}),error=>error.name==='QuotaExceededError');
  assert.equal(s.opens.length,1);assert.equal((await L.get(record().id)).title,'Original');
  assert.equal(s.commits.filter(m=>m==='readwrite').length,1);
});
test('a blocked open that succeeds late cannot replace a working connection',async()=>{
  const s=storage(),L=s.library;s.block();await assert.rejects(L.list(),/Close other/);
  await L.save(record());assert.equal(s.opens.length,2);const live=s.connections[0];
  s.opens[0].finish();assert.equal(s.connections[1].closed,true,'Close the abandoned late handle');
  assert.equal(live.closed,false);assert.equal((await L.list()).length,1);assert.equal(s.opens.length,2);
});
