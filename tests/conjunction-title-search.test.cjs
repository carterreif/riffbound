const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const C=require('../dist/community-charts.js'),A=require('../dist/song-audio.js'),L=require('../dist/song-library.js'),F=require('./helpers/community-fixture.cjs'),B=require('./helpers/bundled-audio.cjs'),{container}=require('./helpers/reference-container.cjs');
const title='Broken, Beat & Scarred',artist='Metallica',row={...F.row,name:title,artist,icon:'ghmdlc'},metadata={name:title,artist,icon:'ghmdlc',five_lane_drums:'True'},files={'notes.mid':F.fullMidi(),'song.opus':Buffer.from([1,7,8]),'drums.opus':Buffer.from([2,8,9])};
const q={title:'Broken Beat and Scarred',artist,parts:['drums'],chartOnly:true,includeAudio:true};
function network(overrides={}){
 const net=F.network({rows:[row],container:container(files,metadata),...overrides}),searches=[];
 const fetcher=(url,options)=>{if(url.includes('/search')){const body=JSON.parse(options.body);searches.push(body);return Promise.resolve(new Response(JSON.stringify({data:url.endsWith('/advanced')?[]:overrides.rows||[row],found:1}),{status:201}));}return net.fetcher(url,options);};
 return {...net,fetcher,searches};
}
test('and/ampersand spelling recovers the real indexed title early and downloads its own chart/audio',async()=>{
 const net=network(),r=await C.lookup({...q,fetcher:net.fetcher});assert.equal(net.searches.length,2);assert.equal(net.searches[0].name.value,q.title);assert.equal(net.searches[1].search,artist+' '+q.title);assert.equal(r.reference.title,title);assert.equal(r.reference.game,'Guitar Hero: Metallica');assert.ok(r.charts.drums.expert.length);assert.deepEqual(Object.keys(r.charts),['drums']);
 const audio=await A.build(C.songAudio(r.audioContainer,{fetcher:net.fetcher}),{duration:r.duration,decode:bytes=>B.decoded(bytes[0])});assert.deepEqual(audio.files,['song.opus','drums.opus']);assert.equal(B.wave(new Uint8Array(await audio.blob.arrayBuffer())).duration,16);
});
test('conjunction matching keeps artist, version, recording duration and package identity exact',async()=>{
 for(const changed of [{name:title+' (Live)'},{artist:'Other Artist'},{name:'Broken Beat Scarred'}]){const net=network({rows:[{...row,...changed}]}),r=await C.lookup({...q,fetcher:net.fetcher});assert.equal(r.audioContainer,undefined);assert.deepEqual(r.charts,{});assert.equal(net.requests.length,0);}
 assert.equal(C.match([row],{title:q.title,artist},20,['drums']).row,undefined);
 const wrong=network({container:container(files,{...metadata,name:title+' (Live)'})}),r=await C.lookup({...q,fetcher:wrong.fetcher});assert.equal(r.audioContainer,undefined);assert.deepEqual(r.charts,{});
 assert.equal(C.match([{...row,name:'Rock and Roll'}],{title:'Rock & Roll',artist},16,['drums']).row.md5,row.md5);
});
test('uploaded audio still needs the requested instrument recording proof after title recovery',async()=>{
 const net=network(),r=await C.lookup({...q,chartOnly:false,includeAudio:false,requireAudioMatch:true,duration:16,fetcher:net.fetcher});assert.deepEqual(r.charts,{});assert.match(r.message,/could not be verified/);
});
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} submitting the typed title saves playable audio and authored Drums through backup/reopen`,async()=>{
 const net=network(),storage=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),app=setup({mobile,chartFixture:[],libraryOverrides:storage.library,referenceDecoder:bytes=>bytes[0]===82?B.wave(bytes):B.decoded(bytes[0]),browserOverrides:{RiffCommunityCharts:{...C,lookup:q=>C.lookup({...q,fetcher:net.fetcher}),songAudio:(c,o)=>C.songAudio(c,{...o,fetcher:net.fetcher})}}}),n=app.nodes;
 await n.addSongButton.click();n.addSongFile.files=[];n.addLookupTitle.value=q.title;n.addLookupArtist.value=artist;n.addSongPart.value='drums';await n.addLookupArtist.emit('input');await n.confirmAddSong.click();
 const rows=await storage.library.list();assert.equal(rows.length,1);const saved=await storage.library.get(rows[0].id);assert.ok(saved.audioBlob.size>44);assert.equal(saved.chartOnly,undefined);assert.ok(saved.quality.imports.drums);assert.equal(saved.quality.communityReferences.drums.title,title);assert.equal(saved.quality.packageAudio.sourceMd5,row.md5);assert.equal(n.playButton.disabled,false);assert.deepEqual(app.requests,[]);
 const backup=await L.unpack(L.pack(saved));assert.deepEqual(Buffer.from(await backup.audioBlob.arrayBuffer()),Buffer.from(await saved.audioBlob.arrayBuffer()));
 const fresh=setup({mobile,chartFixture:[],libraryOverrides:storage.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.playButton.disabled,false);await fresh.nodes.playButton.click();await until(()=>fresh.sources.length);assert.equal(fresh.sources.at(-1).buffer.duration,16);
});
