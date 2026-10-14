const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/community-charts.js'),A=require('../dist/recording-alignment.js'),X=require('../dist/chart-exchange.js'),F=require('./helpers/community-fixture.cjs'),{container}=require('./helpers/reference-container.cjs');
const PARTS=['guitar','drums','bass','vocals'];
function noise(seconds=40,seed=1){let s=seed;return Float32Array.from({length:Math.round(seconds*22050)},()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s/2**32-.5)*.3;});}
const wave=noise(),padding=3,padded=new Float32Array(wave.length+22050*padding);padded.set(wave,22050*padding);
const bytes=s=>Buffer.from(s.buffer,s.byteOffset,s.byteLength),decode=async b=>A.features(new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)));
function midi(){return F.midi([
 {name:'TEMPO',events:[{tick:9600,data:F.meta(81,[15,66,64])}]},
 {name:'PART GUITAR',notes:[{tick:4800,code:64,length:480},{tick:6000,code:76,length:240},{tick:6720,code:88,length:480},{tick:7680,code:100,length:240},{tick:7680,code:96,length:480}]},
 {name:'PART BASS',notes:[{tick:5000,code:63,length:480},{tick:6200,code:74,length:240},{tick:7000,code:85,length:480},{tick:7800,code:96,length:240}]},
 {name:'PART DRUMS',notes:[{tick:5100,code:61},{tick:6300,code:74},{tick:7100,code:87},{tick:8000,code:97},{tick:8120,code:98},{tick:8240,code:99},{tick:8360,code:100},{tick:8480,code:101},{tick:8600,code:96}]},
 {name:'PART VOCALS',notes:[{tick:7900,code:60,length:480},{tick:8400,code:72,length:480}]}
 ]);}
const sourceMidi=midi(),row={...F.row,song_length:43000},query={filename:'Fixture Artist - Fixture Song.wav',duration:40,parts:PARTS};
function alignTo(target=A.features(wave)){
 return async({downloaded,parts,fetcher,signal,budget})=>{
  const reviews={};
  for await(const ref of C.referenceFeatures(downloaded,{parts,fetcher,signal,decode,budget})){
   const review=await A.review(target,A.combine(ref.features),{signal,yieldTask:async()=>{}});reviews[ref.part]={...review,referenceInstrument:ref.part,referenceFiles:ref.files};
  }
  return reviews;
 };
}
for(const part of PARTS)test(`future separate ${part} chart uses only its own MIDI, audio-verified padding and authored difficulties`,async()=>{
 const name=part==='drums'?'drums_1.opus':part+'.opus',net=F.network({rows:[row],container:container({'notes.mid':sourceMidi,[name]:bytes(padded)})});
 const result=await C.lookup({...query,parts:[part],fetcher:net.fetcher,alignAudio:alignTo()});assert.deepEqual(Object.keys(result.charts),[part]);assert.equal(result.recordingReviews[part].status,'aligned');assert.ok(Math.abs(result.recordingReviews[part].shiftSeconds+padding)<.002);
 const parsed=C.parsePart({data:sourceMidi,file:{name:'notes.mid'},metadata:{five_lane_drums:'True',delay:'0'}},part,row),arranged=X.arrange(parsed,43).charts[part];
 for(const [level,notes] of Object.entries(result.charts[part])){assert.equal(notes.length,arranged[level].length);notes.forEach((n,i)=>{assert.equal(n.lane,arranged[level][i].lane);assert.equal(n.duration,arranged[level][i].duration);assert.equal(n.pitch,arranged[level][i].pitch);assert.ok(Math.abs(n.time-arranged[level][i].time+padding)<.002);});}
 assert.ok(Math.abs(result.timings[part].offset+padding)<.002);assert.ok(result.imports[part].levels.includes('expert'));assert.equal(result.references[part].md5,row.md5);
 if(part!=='vocals')assert.deepEqual(result.imports[part].derived,[]);else assert.deepEqual(result.imports[part].derived.sort(),['easy','hard','medium']);
 assert.equal(net.requests.length,6);assert.deepEqual(result.recordingReviews[part].referenceFiles,[name]);
});
test('whole-song verifies each own instrument waveform without donating notes or timing',async()=>{
 const net=F.network({rows:[row],container:container({'notes.mid':sourceMidi,...Object.fromEntries(PARTS.map(p=>[p+'.opus',bytes(padded)]))})});const result=await C.lookup({...query,fetcher:net.fetcher,alignAudio:alignTo()});assert.deepEqual(Object.keys(result.charts),PARTS);assert.equal(net.requests.length,9);
 for(const part of PARTS){assert.equal(result.recordingReviews[part].status,'aligned');assert.equal(result.recordingReviews[part].referenceInstrument,part);}
 assert.notDeepEqual(result.charts.guitar.expert,result.charts.drums.expert);assert.notDeepEqual(result.charts.bass.expert,result.charts.vocals.expert);
 assert.deepEqual(result.charts.drums.expert.map(n=>n.lane),[0,1,2,3,3,5]);assert.equal(result.charts.vocals.expert[0].pitch,60);
});
test('different recordings, no reference, tempo drift and unsafe negative heads cannot import padded charts',async()=>{
 for(const files of [{'notes.mid':sourceMidi,'guitar.opus':bytes(noise(43,99))},{'notes.mid':sourceMidi}]){
  const r=await C.lookup({...query,fetcher:F.network({rows:[row],container:container(files)}).fetcher,alignAudio:alignTo()});assert.deepEqual(r.charts,{});assert.match(r.message,/could not be verified/);
 }
 const short=F.fullMidi(),net=F.network({rows:[row],container:container({'notes.mid':short,'guitar.opus':bytes(padded)})});
 const negative=await C.lookup({...query,fetcher:net.fetcher,alignAudio:alignTo()});assert.deepEqual(negative.charts,{});assert.match(negative.issues.guitar,/before/);
 const close={...row,song_length:40000},original=await C.lookup({...query,parts:['guitar'],fetcher:F.network({rows:[close],container:container({'notes.mid':sourceMidi})}).fetcher,alignAudio:alignTo()});assert.equal(original.charts.guitar.expert[0].time,8);assert.equal(original.recordingReviews.guitar.status,'uncertain');
});
test('another matching package is tried after weak audio; no live title or unrequested MIDI can supply notes',async()=>{
 const other={...row,md5:'b'.repeat(32)},live={...row,name:row.name+' Live',md5:'c'.repeat(32)},net=F.network({rows:[row,other,live],containers:{[row.md5]:container({'notes.mid':sourceMidi,'guitar.opus':bytes(noise(43,7))}),[other.md5]:container({'notes.mid':sourceMidi,'guitar.opus':bytes(padded)})}});
 const r=await C.lookup({...query,parts:['guitar'],fetcher:net.fetcher,alignAudio:alignTo()});assert.deepEqual(Object.keys(r.charts),['guitar']);assert.equal(r.references.guitar.md5,other.md5);assert.equal(r.attempts.length,2);assert.ok(!net.requests.some(x=>x.url.includes(live.md5)));
});
test('reference ranges are bounded, cancellation stops decoding and host access blocks cannot trigger alternate downloads',async()=>{
 const packed=container({'notes.mid':sourceMidi,'drums_1.opus':bytes(padded),'drums_2.opus':bytes(padded),'song.opus':bytes(padded)}),net=F.network({rows:[row],container:packed}),downloaded=await C.download(row,net.fetcher);
 const budget={remaining:1};for await(const ref of C.referenceFeatures(downloaded,{parts:['drums'],fetcher:net.fetcher,decode,budget}))assert.fail('Over-budget reference cannot be decoded');assert.equal(net.requests.length,4);
 const c=new AbortController(),pending=C.referenceFeatures(downloaded,{parts:['drums'],fetcher:net.fetcher,decode:async()=>{c.abort();return A.features(padded);},signal:c.signal});await assert.rejects(pending.next(),/Canceled/);
 const blocked=async(url,options)=>options.headers?.Range.includes(String(downloaded.container.header.files[1].offset))?new Response('denied',{status:403}):net.fetcher(url,options);
 await assert.rejects(C.referenceFeatures(downloaded,{parts:['drums'],fetcher:blocked,decode}).next(),e=>e.status===403);
});

test('a Guitar match or song mix cannot verify or shift a missing Drum/Bass/Vocal reference',async()=>{
 const net=F.network({rows:[row],container:container({'notes.mid':sourceMidi,'guitar.opus':bytes(padded),'song.opus':bytes(padded)})});
 const result=await C.lookup({...query,fetcher:net.fetcher,alignAudio:alignTo()});assert.deepEqual(Object.keys(result.charts),['guitar']);
 for(const part of ['drums','bass','vocals']){assert.equal(result.recordingReviews[part],undefined);assert.ok(result.issues[part]);}
 const close={...row,song_length:40000},r=await C.lookup({...query,fetcher:F.network({rows:[close],container:container({'notes.mid':sourceMidi,'guitar.opus':bytes(wave)})}).fetcher,alignAudio:alignTo()});
 for(const part of PARTS){assert.equal(r.recordingReviews[part].status,part==='guitar'?'aligned':'uncertain');assert.equal(r.timings[part].offset,0);}
});
test('part timing offsets remain independent and mislabeled reviews cannot change another chart',async()=>{
 const files=container({'notes.mid':sourceMidi}),close={...row,song_length:40000};
 const reviews=Object.fromEntries(PARTS.map((p,i)=>[p,{status:'aligned',referenceInstrument:p,shiftSeconds:i*.1,referenceFiles:[p+'.opus']} ]));
 reviews.drums={...reviews.guitar,shiftSeconds:4};
 const r=await C.lookup({...query,fetcher:F.network({rows:[close],container:files}).fetcher,alignAudio:async()=>reviews});
 for(const [i,p] of PARTS.entries()){const shift=p==='drums'?0:i*.1;assert.equal(r.timings[p].offset,shift);assert.equal(r.recordingReviews[p].status,p==='drums'?'uncertain':'aligned');}
});
test('2x4 finds 2 X 4 by Metallica while live or different-artist sources stay rejected',async()=>{
 const metal={...F.row,name:'2 X 4',artist:'Metallica'},net=F.network({rows:[metal],container:container({'notes.mid':sourceMidi},{name:metal.name,artist:metal.artist,five_lane_drums:'True',delay:'0'})});
 const r=await C.lookup({filename:'Metallica - 2x4.wav',duration:16,parts:['drums'],fetcher:net.fetcher});assert.deepEqual(Object.keys(r.charts),['drums']);assert.equal(JSON.parse(net.requests[0].options.body).search,'Metallica 2 X 4');
 for(const title of ['2x4','2 x 4','2 × 4'])assert.equal(C.match([metal],{title,artist:'Metallica'},16,['drums']).row.md5,metal.md5);
 assert.equal(C.match([{...metal,name:'2 X 4 Live'}],{title:'2x4',artist:'Metallica'},16,['drums']).row,undefined);
 assert.equal(C.match([{...metal,artist:'Cover Band'}],{title:'2x4',artist:'Metallica'},16,['drums']).row,undefined);
});
