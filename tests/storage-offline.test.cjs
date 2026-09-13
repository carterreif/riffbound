const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../dist'),code=name=>fs.readFileSync(path.join(root,name),'utf8');

const {storage}=require('./helpers/song-storage.cjs');
const song=()=>({id:'a'.repeat(64),title:'My song',instrument:'drums',musicEnd:10,bpm:120,beat:.5,charts:{drums:{easy:[],normal:[],expert:[]}},waveform:[.5],audioBlob:new Blob(['audio'],{type:'audio/wav'})});
test('song metadata and audio commit together, reopen, and delete together',async()=>{
  const {library:L}=storage(),record=song();await L.save(record);const list=await L.list();assert.equal(list.length,1);assert.equal(list[0].audioBlob,undefined,'Listing does not pull every audio file into memory');
  const loaded=await L.get(record.id);assert.equal(loaded.title,record.title);assert.equal(await loaded.audioBlob.text(),'audio');await L.remove(record.id);assert.equal(await L.get(record.id),null);assert.equal((await L.list()).length,0);
});
test('a failed audio write rolls back metadata without damaging the previous song',async()=>{
  const s=storage(),record=song();await s.library.save(record);s.fail();await assert.rejects(s.library.save({...record,title:'Uncommitted replacement'}),/Quota/);assert.equal((await s.library.get(record.id)).title,'My song');
});

test('missing and oversized audio produce distinct actionable errors without damaging a saved song',async()=>{
  const {library:L}=storage(),record=song();await L.save(record);
  await assert.rejects(L.save({...record,audioBlob:new Blob([])}),error=>error.code==='AUDIO_MISSING'&&/Reconnect original audio/.test(error.message));
  await assert.rejects(L.save({...record,audioBlob:{size:81*1024*1024,arrayBuffer:async()=>new ArrayBuffer(0)}}),error=>error.code==='AUDIO_TOO_LARGE'&&/81.0 MB.*80 MB/.test(error.message));
  assert.throws(()=>L.pack({...record,audioBlob:null}),/Reconnect original audio/);
  assert.equal(await (await L.get(record.id)).audioBlob.text(),'audio');assert.equal((await L.list()).length,1);
});

test('the original reference WAV reconnects, saves and exports within the audio limit',{skip:!process.env.RIFFBOUND_REFERENCE_WAV},async t=>{
  const s=storage({rejectBlobs:true}),L=s.library,bytes=fs.readFileSync(process.env.RIFFBOUND_REFERENCE_WAV),blob=new Blob([bytes],{type:'audio/wav'});
  const id=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const record={...song(),id,title:'InbloomNirvanadrumsonly',musicEnd:272.661859,audioBlob:new Blob([])};
  const repaired=await L.reconnectAudio(record,blob);assert.equal(repaired.id,id);assert.equal(repaired.charts,record.charts);assert.equal(repaired.audioBlob.size,bytes.length);
  await L.save(repaired);const reopened=s.fresh();assert.equal((await reopened.list()).length,1);
  const saved=await reopened.get(id),restored=await L.unpack(L.pack(saved));
  assert.equal(require('node:crypto').createHash('sha256').update(new Uint8Array(await restored.audioBlob.arrayBuffer())).digest('hex'),id);
  assert.ok(s.largest<=32*1024);await reopened.remove(id);assert.equal(s.stores.get('audio').size,0);
  t.diagnostic(`${bytes.length} original audio bytes survive reconnect, fresh-instance storage and backup with Blob/large-value writes rejected; largest record ${s.largest} bytes.`);
});

test('Blob IOError is bypassed for audio and dense charts, with exact notes after reopening',async()=>{
  const s=storage({rejectBlobs:true}),r=song();
  const notes=Array.from({length:6000},(_,id)=>({id,lane:id%6,time:1+id/1000,duration:0}));
  r.charts.drums={easy:notes,normal:notes,expert:notes};r.audioBlob=new Blob([new Uint8Array(200000).map((_,i)=>i%251)],{type:'audio/wav'});
  await s.library.save(r);assert.ok(s.largest<=32768);
  const fresh=s.fresh(),loaded=await fresh.get(r.id);assert.deepEqual(JSON.parse(JSON.stringify(loaded.charts)),JSON.parse(JSON.stringify(s.library.validate(r).charts)));
  assert.deepEqual(Buffer.from(await loaded.audioBlob.arrayBuffer()),Buffer.from(await r.audioBlob.arrayBuffer()));
  assert.equal((await fresh.list())[0].charts.drums.expert,undefined,'Setlist reads only the small summary');
  await fresh.remove(r.id);assert.equal(s.stores.get('audio').size,0);assert.equal((await fresh.list()).length,0);
});

test('legacy Blob songs reopen and migrate on save without losing either instrument',async()=>{
  const s=storage({rejectBlobs:true}),r=song();await s.library.list();
  s.stores.get('songs').set(r.id,s.library.metadata(r));s.stores.get('audio').set(r.id,r.audioBlob);
  assert.equal(await (await s.library.get(r.id)).audioBlob.text(),'audio');
  await s.library.save({...r,instrument:'guitar',charts:{guitar:{easy:[],normal:[{lane:3,time:2,duration:0}],expert:[]}}});
  const loaded=await s.fresh().get(r.id);assert.deepEqual(Object.keys(loaded.charts).sort(),['drums','guitar']);
  assert.equal(loaded.charts.guitar.normal[0].lane,3);assert.equal(await loaded.audioBlob.text(),'audio');
  assert.equal(s.stores.get('audio').get(r.id).format,'riffbound-chunks-v1');
});

test('failure midway through chunk replacement rolls back all data and allows retry',async()=>{
  const s=storage({rejectBlobs:true}),r={...song(),audioBlob:new Blob([new Uint8Array(100000)])};await s.library.save(r);
  s.failAfter(2);await assert.rejects(s.library.save({...r,title:'Uncommitted'}),/IOError/);
  assert.equal((await s.fresh().get(r.id)).title,'My song');assert.equal((await s.library.list()).length,1);
  s.failAfter(null);await s.library.save({...r,title:'Updated'});assert.equal((await s.fresh().get(r.id)).title,'Updated');
  await s.library.remove(r.id);assert.equal(s.stores.get('audio').size,0);
});

test('a missing audio chunk fails explicitly instead of opening a truncated song',async()=>{
  const s=storage({rejectBlobs:true}),r=song();await s.library.save(r);s.stores.get('audio').delete(r.id+':audio:0');
  await assert.rejects(s.fresh().get(r.id),/incomplete/);
});

function worker({badAsset=false}={}){
  const listeners={},banks=new Map();let online=true,skipped=0;
  const caches={open:async key=>{if(!banks.has(key))banks.set(key,new Map());const bank=banks.get(key);return {put:async(k,v)=>bank.set(k,v),match:async k=>bank.get(typeof k==='string'?k:k.url)};},keys:async()=>[...banks.keys()],delete:async key=>banks.delete(key)};
  const self={location:{href:'https://game.example/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{skipped++;},addEventListener:(type,fn)=>listeners[type]=fn};
  const sandbox={self,caches,URL,Request,Promise,fetch:async request=>{if(!online)throw Error('Offline');const url=request.url||request;return {ok:true,redirected:badAsset&&url.endsWith('game.js'),headers:{get:()=>url.endsWith('.png')?'image/png':url.endsWith('.js')?'text/javascript':url.endsWith('.css')?'text/css':'text/html'},url};}};
  vm.createContext(sandbox);sandbox.importScripts=name=>vm.runInContext(code(name),sandbox);vm.runInContext(code('sw.js'),sandbox);
  const emit=async(type,data={})=>{let result;listeners[type]({waitUntil:p=>{result=p;},respondWith:p=>{result=p;},...data});return result?await result:null;};
  return {self,banks,emit,offline:()=>{online=false;},get skipped(){return skipped;}};
}
test('offline package includes every runtime asset and serves the game without network access',async()=>{
  const w=worker();for(const file of w.self.RiffOfflineAssets.files)assert.ok(fs.existsSync(path.join(root,file)),file);
  await w.emit('install');assert.equal(w.skipped,0,'Do not replace a running game without player action');await w.emit('activate');w.offline();
  const home=await w.emit('fetch',{request:new Request('https://game.example/')});assert.equal(home.url,'https://game.example/index.html');
  for(const file of w.self.RiffOfflineAssets.files){const response=await w.emit('fetch',{request:new Request('https://game.example/'+file)});assert.ok(response?.ok,file);}
  assert.equal(await w.emit('fetch',{request:new Request('https://other.example/private')}),null,'Unknown and external requests are not cached');
  await w.emit('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skipped,1);
});
test('a redirected game file prevents an incomplete offline install',async()=>{
  const w=worker({badAsset:true});await assert.rejects(w.emit('install'),/could not be saved/);assert.equal(w.banks.size,0);
});
