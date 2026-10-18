const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs');
const guitar=F.midi([{name:'PART GUITAR',notes:[{tick:960,code:96}]}]);
const drums=F.midi([{name:'PART DRUMS',notes:[{tick:960,code:97},{tick:1080,code:98},{tick:1200,code:99},{tick:1320,code:100},{tick:1440,code:96}]}]);
const metadata={name:F.row.name,artist:F.row.artist,pro_drums:'True'},drumRow={...F.row,md5:'b'.repeat(32),five_lane_drums:false,pro_drums:true,notesData:{drumType:1,noteCounts:[{instrument:'drums',difficulty:'expert',count:5}]}};
const query={title:F.row.name,artist:F.row.artist,duration:16,parts:['drums'],requireAudioMatch:true,checkDrums:true,alignAudio:async({parts})=>Object.fromEntries(parts.map(part=>[part,{status:'aligned',shiftSeconds:0,referenceInstrument:part}]))};
function catalog({general=[F.row],drumPages=[[drumRow]],containers={[F.row.md5]:F.sng(guitar),[drumRow.md5]:F.sng(drums,{metadata})},blockDrums=false}={}){
 const net=F.network({containers}),queries=[];
 return {queries,requests:net.requests,fetcher:async(url,options)=>{
  if(!url.includes('/search'))return net.fetcher(url,options);
  const q=JSON.parse(options.body);queries.push({url,q});assert.equal(q.drumsReviewed,false,'Do not hide community drums without a quality-review badge');
  if(q.instrument==='drums'&&blockDrums)return new Response('Blocked',{status:403});
  return new Response(JSON.stringify({data:q.instrument==='drums'?drumPages[q.page-1]||[]:general,found:q.instrument==='drums'?drumPages.flat().length:general.length}));
 }};
}
test('a dedicated Chorus drum search recovers playable Drums behind misleading general metadata',async()=>{
 const n=catalog(),progress=[],result=await C.lookup({...query,fetcher:n.fetcher,onProgress:m=>progress.push(m)});
 assert.ok(n.queries.some(({url,q})=>url.endsWith('/advanced')&&q.instrument==='drums'));assert.ok(progress.some(m=>m.includes('Checking Chorus Encore')));
 assert.match(result.attempts[0].reason,/No supported drums/);assert.equal(result.references.drums.md5,drumRow.md5);assert.equal(result.drumCheck.status,'imported');assert.equal(result.drumLayout,'four');assert.equal(result.imports.drums.layout,'four');assert.equal(result.recordingReviews.drums.status,'aligned');
 assert.deepEqual(result.charts.drums.expert.map(note=>note.lane),[0,1,2,3,5]);assert.equal(result.charts.guitar,undefined);
 assert.ok(n.queries.every(({q})=>!('audio' in q)&&!('filename' in q)),'Only song identity and search filters go to the catalog');
});
test('Chorus drum pagination discovers a later matching version and keeps searches bounded',async()=>{
 const unrelated=Array.from({length:50},(_,i)=>({...drumRow,name:'Other Song',md5:(i+16).toString(16).padStart(32,'0')}));
 const n=catalog({general:[],drumPages:[unrelated,[drumRow]]}),r=await C.lookup({...query,fetcher:n.fetcher});assert.ok(r.charts.drums);assert.deepEqual(n.queries.filter(({q})=>q.instrument==='drums').map(({q})=>q.page),[1,2]);
 const many=Array.from({length:4},(_,page)=>Array.from({length:50},(_,i)=>({...drumRow,name:'Other Song',md5:(page*50+i+16).toString(16).padStart(32,'0')}))),bounded=catalog({general:[],drumPages:many}),none=await C.lookup({...query,fetcher:bounded.fetcher});assert.equal(bounded.queries.filter(({q})=>q.instrument==='drums').length,3);assert.equal(none.drumCheck.status,'not-found');assert.equal(bounded.requests.length,0);
});
test('Guitar uploads check drum availability without importing unrequested Drum notes',async()=>{
 const n=catalog(),r=await C.lookup({...query,parts:['guitar'],fetcher:n.fetcher});assert.ok(r.charts.guitar);assert.equal(r.charts.drums,undefined);assert.equal(r.drumCheck.status,'listed');assert.match(r.message,/Choose Drums or Whole song/);assert.ok(!n.requests.some(request=>request.url.includes(drumRow.md5)));
});
test('listed Drums require real Drum notes and their own recording verification',async()=>{
 for(const options of [{containers:{[F.row.md5]:F.sng(guitar),[drumRow.md5]:F.sng(guitar)}},{alignAudio:async()=>({drums:{status:'uncertain',referenceInstrument:'drums'}})}]){
  const n=catalog(options),r=await C.lookup({...query,...(options.alignAudio?{alignAudio:options.alignAudio}:{}),fetcher:n.fetcher});assert.equal(r.charts.drums,undefined);assert.equal(r.drumCheck.status,'not-imported');assert.match(r.message,/could not be loaded and verified/);
 }
});
test('catalog failure is reported as an incomplete check rather than missing Drums',async()=>{
 const n=catalog({general:[],blockDrums:true}),r=await C.lookup({...query,fetcher:n.fetcher});assert.equal(r.drumCheck.status,'unavailable');assert.match(r.drumCheck.message,/could not be completed/);assert.equal(n.requests.length,0);assert.equal(n.queries.length,2,'Stop on access blocks');
 const offline=await C.lookup({...query,enabled:false,fetcher:()=>assert.fail('Opt-out must not access the catalog')});assert.equal(offline.drumCheck.status,'unavailable');
});
test('the Chorus check preserves separate Orange and Green on Guitar Hero drum charts',async()=>{
 const row={...F.row,icon:'ghm'},n=F.network({rows:[row]}),r=await C.lookup({...query,fetcher:n.fetcher});assert.equal(r.drumCheck.status,'imported');assert.equal(r.drumLayout,'five');assert.ok(r.charts.drums.expert.some(note=>note.lane===3));assert.ok(r.charts.drums.expert.some(note=>note.lane===4));assert.equal(r.references.drums.game,'Guitar Hero: Metallica');
});
test('the known direct community pack retains its path and is not mislabeled as an Encore result',async()=>{
 const Packs=require('../dist/community-packs.js'),original=Packs.download;
 try{
  Packs.download=async()=>({data:drums,file:{name:'notes.mid'},metadata:{...metadata,name:'Stinkfist',artist:'Tool'}});
  const r=await C.lookup({title:'Stinkfist',artist:'Tool',parts:['drums'],chartOnly:true,checkDrums:true,fetcher:()=>assert.fail('Known direct pack need not wait for an unrelated catalog request')});assert.ok(r.charts.drums);assert.equal(r.drumCheck.provider,'Community pack');assert.match(r.drumCheck.message,/Community pack: authored Drum chart loaded/);
 }finally{Packs.download=original;}
});
