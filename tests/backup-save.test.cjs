const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../dist/backup-save.js'),'utf8'),token='12345678-1234-1234-1234-123456789abc',origin='https://riffbound.example';
function setup({picker,opener=true}={}){
  const nodes=Object.fromEntries(['fileInfo','saveStatus','saveAs','download'].map(id=>[id,{hidden:id==='download',disabled:id==='saveAs',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},click(){this.clicked=true;return this.listeners.click?.();}}]));
  const listeners={},messages=[],timers=new Map(),urls=new Map(),sender={postMessage:(data,to)=>messages.push({data,to})};let serial=0;
  const window={location:{origin,hash:'#'+token},opener:opener?sender:null,showSaveFilePicker:picker,addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:(type,fn)=>{if(listeners[type]===fn)delete listeners[type];}};
  vm.runInNewContext(code,{window,document:{getElementById:id=>nodes[id]},Blob,URL:{createObjectURL:blob=>{const id='blob:save-'+(++serial);urls.set(id,blob);return id;},revokeObjectURL:id=>urls.delete(id)},setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  const receive=(data,source=sender,from=origin)=>listeners.message?.({source,origin:from,data});
  const deliver=blob=>receive({type:'RIFF_BACKUP_FILE',token,blob,name:'Franticmetdrumsonly.riffpack'});
  return {nodes,messages,sender,urls,timers,receive,deliver};
}
test('standalone backup: rejects unrelated windows/origins/tokens and accepts the original Blob once',async()=>{
  const s=setup(),blob=new Blob(['audio and charts']);assert.equal(s.messages[0].data.type,'RIFF_BACKUP_READY');assert.equal(s.messages[0].to,origin);
  const data={type:'RIFF_BACKUP_FILE',token,blob,name:'Frantic.riffpack'};
  s.receive(data,{});s.receive(data,s.sender,'https://other.example');s.receive({...data,token:'wrong'});assert.equal(s.urls.size,0);assert.equal(s.nodes.download.hidden,true);
  s.receive(data);assert.equal(s.urls.get(s.nodes.download.href),blob);assert.equal(s.nodes.download.download,'Frantic.riffpack');assert.equal(s.nodes.download.hidden,false);assert.equal(s.messages[1].data.type,'RIFF_BACKUP_RECEIVED');assert.equal(s.timers.size,0);
  s.receive({...data,blob:new Blob(['replacement'])});assert.equal(s.urls.size,1);assert.equal(s.urls.get(s.nodes.download.href),blob);
  await s.nodes.download.click();assert.match(s.nodes.saveStatus.textContent,/Download requested/);assert.doesNotMatch(s.nodes.saveStatus.textContent,/Backup saved/);
});
test('standalone backup: Save as retains click activation and waits for close before confirming',async()=>{
  let called=false,written,finish;const closing=new Promise(resolve=>finish=resolve);
  const s=setup({picker:options=>{called=true;assert.equal(options.startIn,'downloads');assert.equal(options.suggestedName,'Franticmetdrumsonly.riffpack');return Promise.resolve({createWritable:async()=>({write:async blob=>written=blob,close:()=>closing})});}}),blob=new Blob(['exact backup']);
  s.deliver(blob);assert.equal(called,false);const pending=s.nodes.saveAs.click();assert.equal(called,true);assert.match(s.nodes.saveStatus.textContent,/Opening the save dialog/);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(written,blob);assert.match(s.nodes.saveStatus.textContent,/Saving your audio/);assert.equal(s.nodes.saveAs.disabled,true);
  finish();await pending;assert.match(s.nodes.saveStatus.textContent,/Backup saved/);assert.equal(s.nodes.saveAs.disabled,false);
});
test('standalone backup: cancel, blocked picker, and failed writes retain download and retry',async()=>{
  for(const kind of ['cancel','blocked','write']){
    let abort=false;const s=setup({picker:async()=>{if(kind!=='write')throw Object.assign(Error(kind),{name:kind==='cancel'?'AbortError':'SecurityError'});return {createWritable:async()=>({write:async()=>{throw Error('Disk full');},close:async()=>assert.fail('No success after failed write'),abort:async()=>abort=true})};}});
    s.deliver(new Blob(['backup']));await s.nodes.saveAs.click();assert.doesNotMatch(s.nodes.saveStatus.textContent,/Backup saved/);assert.match(s.nodes.saveStatus.textContent,/canceled|Could not complete/);assert.equal(s.nodes.saveAs.disabled,false);assert.equal(s.urls.size,1);if(kind==='write')assert.equal(abort,true);
  }
});
test('standalone backup: no opener, invalid payload, and failed transfer show recovery',()=>{
  const none=setup({opener:false});assert.match(none.nodes.saveStatus.textContent,/Export current song/);assert.equal(none.messages.length,0);assert.equal(none.timers.size,0);
  const bad=setup();bad.deliver(new Blob([]));assert.match(bad.nodes.saveStatus.textContent,/could not be read/);assert.equal(bad.urls.size,0);
  const missing=setup();for(const fn of missing.timers.values())fn();assert.match(missing.nodes.saveStatus.textContent,/No backup arrived/);
});
test('standalone backup: original Frantic audio survives the local window transfer',{skip:!process.env.RIFFBOUND_EXPORT_WAV},async()=>{
  const L=require('../dist/song-library.js'),bytes=fs.readFileSync(process.env.RIFFBOUND_EXPORT_WAV),hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
  const record={id:hash(bytes),title:'Frantic',instrument:'drums',musicEnd:313.19356,bpm:161,beat:60/161,charts:{drums:{expert:[{time:3.59,lane:0,duration:0}],easy:[],medium:[],hard:[]}},waveform:[.5],audioBlob:new Blob([bytes],{type:'audio/wav'})};
  const s=setup(),blob=L.pack(record);s.deliver(structuredClone(blob));const restored=await L.unpack(s.urls.get(s.nodes.download.href));
  assert.equal(hash(Buffer.from(await restored.audioBlob.arrayBuffer())),record.id);assert.equal(restored.audioBlob.size,bytes.length);assert.deepEqual(restored.charts,L.validate(record).charts);
});
