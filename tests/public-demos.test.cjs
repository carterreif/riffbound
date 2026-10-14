const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{webcrypto,createHash}=require('node:crypto');
const P=require('../dist/public-demos.js'),catalog=require('../dist/demo-catalog.js'),L=require('../dist/song-library.js'),E=require('../dist/engine.js');
const root=path.join(__dirname,'../dist'),hash=b=>createHash('sha256').update(b).digest('hex');
function fetchFiles(){const requests=[];return {requests,fetcher:async url=>{requests.push(url);const bytes=fs.readFileSync(path.join(root,url));return new Response(bytes,{headers:{'Content-Type':url.endsWith('.json')?'application/json':'audio/mpeg'}});}};}
test('public demos: three selected recordings retain reviewed notes, four difficulties and matching complete audio',async()=>{
  assert.deepEqual(catalog.map(e=>e.title),['Frantic — Drums','In Bloom — Drums','Roam — Drums']);
  for(const [i,entry] of catalog.entries()){
    const record=L.validate(JSON.parse(fs.readFileSync(path.join(root,entry.metadata))));assert.equal(record.id,entry.id);assert.equal(record.musicEnd,entry.musicEnd);assert.ok(record.musicEnd>250,'Demos must be full songs');assert.equal(hash(fs.readFileSync(path.join(root,entry.audio))),entry.id);assert.equal(record.charts.drums.expert.length,[2055,1401,2051][i]);
    for(const level of ['easy','medium','hard','expert']){const notes=record.charts.drums[level],session=new E.Session(level,'tap','drums',{notes,musicEnd:record.musicEnd});for(const n of notes){session.tap(n.lane,n.time);session.update(n.time,new Set([n.lane]));}session.update(record.musicEnd+1,new Set());assert.equal(session.hits,notes.length,entry.title+' '+level);assert.equal(session.misses,0);}
  }
  const frantic=JSON.parse(fs.readFileSync(path.join(root,catalog[0].metadata)));assert.deepEqual(frantic.charts.drums.expert.filter(n=>n.time>=10.3&&n.time<=11.3&&n.lane!==5).map(n=>n.lane),Array(9).fill(0));assert.equal(frantic.charts.drums.expert.filter(n=>n.ghost).length,130);
  const roam=JSON.parse(fs.readFileSync(path.join(root,catalog[2].metadata)));assert.ok(roam.musicEnd>433&&roam.musicEnd<434);assert.match(roam.quality.review.scope,/Full WAV/);assert.equal(roam.charts.drums.expert.at(-1).time,415.786032,'Retain the reviewed final hit and the complete audio tail');
});
test('public demos: lazy download is shared, verified and returned as independent charts without saving',async()=>{
  const f=fetchFiles(),api=P.create(catalog,{fetcher:f.fetcher,crypto:webcrypto});assert.equal(f.requests.length,0);assert.equal(api.list().length,3);
  const [a,b]=await Promise.all([api.get(catalog[0].id),api.get(catalog[0].id)]);assert.equal(f.requests.length,2);assert.equal(a.audioBlob.size,catalog[0].audioBytes);a.charts.drums.expert[0].lane=99;a.quality.publicDemo.artist='Changed';assert.notEqual(b.charts.drums.expert[0].lane,99);assert.equal(b.quality.publicDemo.artist,'Metallica');
  const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true});await s.library.save(b);const copy=await s.fresh().get(b.id);assert.equal(hash(Buffer.from(await copy.audioBlob.arrayBuffer())),b.id);assert.deepEqual(JSON.parse(JSON.stringify(copy.charts)),b.charts);
});
test('public demos: failed or corrupted downloads do not cache a false success and can retry',async()=>{
  const f=fetchFiles();let fail=true;const api=P.create(catalog,{crypto:webcrypto,fetcher:async(url,options)=>fail?new Response('offline',{status:503}):f.fetcher(url,options)});
  await assert.rejects(api.get(catalog[2].id),/chart could not download/);fail=false;assert.equal((await api.get(catalog[2].id)).id,catalog[2].id);
  const wrong=P.create(catalog,{crypto:webcrypto,fetcher:async(url,options)=>{if(url.endsWith('.mp3')){const bytes=fs.readFileSync(path.join(root,url));bytes[20]^=1;return new Response(bytes);}return f.fetcher(url,options);}});await assert.rejects(wrong.get(catalog[2].id),/does not match/);
  const short=P.create(catalog,{crypto:webcrypto,fetcher:async(url,options)=>url.endsWith('.mp3')?new Response('partial'):f.fetcher(url,options)});await assert.rejects(short.get(catalog[2].id),/incomplete/);
  const slow=P.create(catalog,{timeout:10,crypto:webcrypto,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))});await assert.rejects(slow.get(catalog[2].id),/took too long/);
});
module.exports={fetchFiles};
