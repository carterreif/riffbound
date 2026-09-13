// Deterministic IndexedDB adapter with persistent stores and write fault injection.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=name=>fs.readFileSync(path.join(__dirname,'../../dist',name),'utf8');
function storage({rejectBlobs=false,source=code('song-library.js')}={}){
  const stores=new Map();let fail=false,failAfter=null,written=0,largest=0;
  const database={createObjectStore:name=>stores.set(name,new Map()),close(){},transaction(){
    const snapshots=new Map([...stores].map(([k,v])=>[k,new Map(v)])),tx={aborted:false,pending:0,error:null};
    tx.abort=()=>{if(tx.aborted)return;tx.aborted=true;stores.clear();for(const [k,v] of snapshots)stores.set(k,v);queueMicrotask(()=>tx.onabort?.());};
    const request=action=>{const r={};tx.pending++;queueMicrotask(()=>{if(!tx.aborted){try{r.result=action();r.onsuccess?.();}catch(error){tx.error=error;tx.abort();}}if(--tx.pending===0&&!tx.aborted)queueMicrotask(()=>tx.oncomplete?.());});return r;};
    tx.objectStore=name=>({put:(value,id)=>request(()=>{
      if(fail&&name==='audio')throw Error('Quota exceeded');
      if(failAfter!==null&&++written>failAfter)throw new DOMException('Failed to write blobs (IOError)','UnknownError');
      const size=value instanceof Blob?value.size:Object.prototype.toString.call(value)==='[object ArrayBuffer]'?value.byteLength:new TextEncoder().encode(JSON.stringify(value)).byteLength;
      largest=Math.max(largest,size);
      if(rejectBlobs&&(value instanceof Blob||size>64*1024))throw new DOMException('Failed to write blobs (IOError)','DataError');
      stores.get(name).set(id??value.id,structuredClone(value));
    }),get:id=>request(()=>structuredClone(stores.get(name).get(id))),getAll:()=>request(()=>[...stores.get(name).values()].map(v=>structuredClone(v))),delete:id=>request(()=>stores.get(name).delete(id))});return tx;
  }};
  const indexedDB={open(){const r={result:database};queueMicrotask(()=>{if(!stores.size)r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
  const fresh=()=>{const window={RiffDifficulties:require('../../dist/chart-difficulties.js'),indexedDB,crypto:require('node:crypto').webcrypto};vm.runInNewContext(source,{window,TextEncoder,TextDecoder,Uint8Array,DataView,Blob,Date,Promise});return window.RiffLibrary;};
  return {library:fresh(),fresh,stores,fail:()=>{fail=true;},failAfter:value=>{written=0;failAfter=value;},get largest(){return largest;}};
}
module.exports={storage};
