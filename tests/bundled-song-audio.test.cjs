const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const C=require('../dist/community-charts.js'),A=require('../dist/song-audio.js'),F=require('./helpers/community-fixture.cjs'),B=require('./helpers/bundled-audio.cjs'),L=require('../dist/song-library.js');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const row={...F.row,icon:'ghm'},q={title:F.row.name,artist:F.row.artist,parts:['drums'],chartOnly:true,includeAudio:true};
async function found(net){return C.lookup({...q,fetcher:net.fetcher});}
async function enter(app,part='drums'){
 const n=app.nodes;await n.addSongButton.click();n.addSongFile.files=[];n.addLookupTitle.value=q.title;n.addLookupArtist.value=q.artist;n.addSongPart.value=part;await n.addLookupArtist.emit('input');await n.confirmAddSong.click();
}
function appWith({mobile=false,files,storage=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),lookup,stream,decoder}={}){
 const net=F.network({rows:[row],container:B.sng(files)}),app=setup({mobile,chartFixture:[],libraryOverrides:storage.library,referenceDecoder:bytes=>bytes[0]===82?B.wave(bytes):B.decoded(bytes[0]),browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:lookup||((input)=>C.lookup({...input,fetcher:net.fetcher})),songAudio:stream||((container,options)=>C.songAudio(container,{...options,fetcher:net.fetcher}))}}});return {app,net,storage};
}
test('bundled stem ranges use the selected package, unmask bytes, and exclude previews and crowd audio',async()=>{
 const net=F.network({rows:[row],container:B.sng([['song.opus',Buffer.from([1,7,8,9])],['guitar.opus',Buffer.from([2,8,9,10])],['preview.opus',Buffer.from([3,8])],['crowd.opus',Buffer.from([4,8])]])}),r=await found(net),files=[];
 for await(const file of C.songAudio(r.audioContainer,{fetcher:net.fetcher}))files.push(file);
 assert.deepEqual(files.map(f=>f.name),['song.opus','guitar.opus']);assert.deepEqual(Array.from(files[0].data),[1,7,8,9]);assert.deepEqual(Array.from(files[1].data),[2,8,9,10]);assert.ok(net.requests.filter(x=>!x.url.includes('/search')).every(x=>x.url.endsWith(row.md5+'.sng')));
});
test('full-song mixing preserves both stems and stereo, resamples without shifting chart timing and bounds peaks',async()=>{
 const audio=await A.build((async function*(){yield {name:'song.opus',data:new Uint8Array([1])};yield {name:'guitar.opus',data:new Uint8Array([2])};})(),{duration:16,decode:bytes=>B.decoded(bytes[0],{rate:44100})}),bytes=new Uint8Array(await audio.blob.arrayBuffer()),wave=B.wave(bytes);
 assert.equal(wave.sampleRate,22050);assert.equal(wave.numberOfChannels,2);assert.equal(wave.duration,16);assert.deepEqual(audio.files,['song.opus','guitar.opus']);assert.ok(audio.blob.size<80*1024*1024);
 const channel=wave.getChannelData(0),power=frequency=>{let sum=0;for(let i=0;i<22050;i++)sum+=channel[i]*Math.sin(2*Math.PI*frequency*i/22050);return sum/22050;};assert.ok(power(110)>.1);assert.ok(power(220)>.1);assert.ok(Math.max(...channel.subarray(0,1000))<1);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} name search automatically saves playable chart and bundled audio, reopens and exports offline`,async()=>{
 const {app,net,storage}=appWith({mobile}),n=app.nodes;await enter(app);const rows=await storage.library.list();assert.equal(rows.length,1);const saved=await storage.library.get(rows[0].id);
 assert.notEqual(saved.chartOnly,true);assert.ok(saved.audioBlob.size>44);assert.equal(saved.quality.packageAudio.setlist,'Guitar Hero: Metallica');assert.deepEqual(Array.from(saved.quality.packageAudio.files),['song.opus','guitar.opus']);assert.equal(n.playButton.disabled,false);assert.deepEqual(app.requests,[]);assert.match(n.chartStatus.textContent,/Matching bundled audio loaded/);assert.equal(saved.quality.audioReviews.drums.timingVerified,false);assert.equal(saved.quality.onlineLookup.drumCheck.status,'imported');assert.match(n.chartStatus.textContent,/Chorus Encore: authored Drum chart loaded/);
 const hash=require('node:crypto').createHash('sha256').update(Buffer.from(await saved.audioBlob.arrayBuffer())).digest('hex');assert.equal(saved.id,hash);
 const restored=await L.unpack(L.pack(saved));assert.deepEqual(Buffer.from(await restored.audioBlob.arrayBuffer()),Buffer.from(await saved.audioBlob.arrayBuffer()));assert.equal(JSON.stringify(restored.charts),JSON.stringify(saved.charts));assert.equal(restored.quality.onlineLookup.drumCheck.status,'imported');
 const count=net.requests.length,fresh=setup({mobile,chartFixture:[],libraryOverrides:storage.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.playButton.disabled,false);assert.equal(net.requests.length,count);await fresh.nodes.playButton.click();await until(()=>fresh.sources.length>0);assert.equal(fresh.sources.at(-1).buffer.duration,16);
});
test('bundled audio discovery never joins notes from another package to the chosen package audio',async()=>{
 const guitar={...row,icon:'gh3',md5:'b'.repeat(32),notesData:{noteCounts:[{instrument:'guitar',difficulty:'expert',count:10}]}},drums={...row,notesData:{noteCounts:[{instrument:'drums',difficulty:'expert',count:10}]}},net=F.network({rows:[guitar,drums],container:B.sng()});
 const r=await C.lookup({...q,parts:['guitar','drums'],fetcher:net.fetcher});assert.equal(Object.keys(r.charts).length,1);assert.equal(r.attempts.length,1);assert.ok(r.audioContainer.url.includes(r.reference.md5));
});
test('missing audio or a failed audio download keeps the fetched chart, with a clear chart-only status',async()=>{
 for(const mode of ['missing','blocked']){
  const {app,storage}=appWith({files:mode==='missing'?[]:undefined,stream:mode==='blocked'?async function*(){throw Error('Audio download unavailable');}:undefined});await enter(app);const rows=await storage.library.list(),saved=await storage.library.get(rows[0].id);assert.equal(saved.chartOnly,true);assert.equal(saved.audioBlob,null);assert.equal(app.nodes.playButton.disabled,true);assert.ok(saved.charts.drums.expert.length);assert.match(app.nodes.chartStatus.textContent,/Audio could not be included/);
 }
});
test('canceling a pending audio fetch keeps the existing saved song and ignores a late stem',async()=>{
 let release;const {app,storage}=appWith({stream:async function*(container,{signal}){await new Promise(resolve=>release=resolve);yield {name:'song.opus',data:new Uint8Array([1])};}}),n=app.nodes;
 await app.upload('Keep me.wav');await until(()=>!n.saveCurrentButton.disabled);const original=(await storage.library.list())[0],before=await storage.library.get(original.id);
 await n.addSongButton.click();n.addSongFile.files=[];n.addLookupTitle.value=q.title;n.addLookupArtist.value=q.artist;n.addSongPart.value='drums';const task=n.confirmAddSong.click();await until(()=>release);await n.setlistCancelUpload.click();release();await task;
 assert.equal((await storage.library.list()).length,1);assert.equal(JSON.stringify((await storage.library.get(original.id)).charts),JSON.stringify(before.charts));assert.equal(n.trackTitle.textContent,'Keep me');
});
test('audio limits and unsupported isolated tracks stop before any stem request',async()=>{
 const net=F.network({rows:[row],container:B.sng([['guitar.opus',Buffer.from([1,2,3])]])}),r=await found(net),before=net.requests.length;
 await assert.rejects(async()=>{for await(const _ of C.songAudio(r.audioContainer,{fetcher:net.fetcher})){}},/full-song audio/);assert.equal(net.requests.length,before);
 const container={...r.audioContainer,header:{...r.audioContainer.header,files:[{name:'song.opus',length:81*1024*1024,offset:100}]}};await assert.rejects(async()=>{for await(const _ of C.songAudio(container,{fetcher:net.fetcher})){}},/80 MB/);assert.equal(net.requests.length,before);
});

test('Whole song discovery saves all supported package parts and repeated searches keep one audio entry',async()=>{
 const {app,storage}=appWith();await enter(app,'whole');let rows=await storage.library.list();assert.equal(rows.length,1);const original=await storage.library.get(rows[0].id);assert.deepEqual(Object.keys(original.charts).sort(),['bass','drums','guitar','vocals']);
 await enter(app,'drums');rows=await storage.library.list();assert.equal(rows.length,1);const saved=await storage.library.get(rows[0].id);assert.equal(saved.id,original.id);assert.equal(JSON.stringify(saved.charts.guitar),JSON.stringify(original.charts.guitar));assert.equal(saved.quality.audioReviews.drums.policy,'authored-package-audio-v1');
});
test('stems share time zero, including attack timestamps, and normalized peaks cannot clip',async()=>{
 const rate=44100,pulse=new Float32Array(5*rate);pulse[rate]=.9;const decode=()=>({duration:5,sampleRate:rate,numberOfChannels:1,getChannelData:()=>pulse}),audio=await A.build((async function*(){yield {name:'song.opus',data:new Uint8Array([1])};yield {name:'guitar.opus',data:new Uint8Array([2])};})(),{duration:5,decode});
 const wave=B.wave(new Uint8Array(await audio.blob.arrayBuffer())),samples=wave.getChannelData(0);assert.ok(samples[22050]>.98&&samples[22050]<1);assert.equal(samples[22049],0);assert.equal(samples[22051],0);assert.equal(wave.duration,5);
});
test('wrong recording length and silent full-song audio cannot become a playable saved song',async()=>{
 const file=async function*(){yield {name:'song.opus',data:new Uint8Array([1])};};await assert.rejects(A.build(file(),{duration:16,decode:()=>B.decoded(1,{duration:32})}),/recording length/);
 await assert.rejects(A.build(file(),{duration:16,decode:()=>({duration:16,sampleRate:22050,numberOfChannels:1,getChannelData:()=>new Float32Array(16*22050)})}),/empty/);
});
