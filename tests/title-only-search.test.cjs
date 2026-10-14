const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs'),L=require('../dist/song-library.js');
const identity={title:'Fixture Song',artist:'Fixture Artist'},query={...identity,parts:['drums'],chartOnly:true};
const game={...F.row,icon:'ghm'},network=()=>F.network({rows:[game],container:F.sng(undefined,{prefix:0})});
async function enterName(app,part='drums'){
 const n=app.nodes;await n.addSongButton.click();n.addSongFile.files=[];n.addSongPart.value=part;
 n.addLookupTitle.value=identity.title;await n.addLookupTitle.emit('input');assert.equal(n.confirmAddSong.disabled,true,'Both fields are needed without audio');
 n.addLookupArtist.value=identity.artist;await n.addLookupArtist.emit('input');assert.equal(n.confirmAddSong.disabled,false);assert.match(n.confirmAddSong.textContent,/Find chart/);
}
function searchedApp(options={}){
 const net=options.net||network(),storage=options.storage||require('./helpers/song-storage.cjs').storage({rejectBlobs:true});
 const app=setup({chartFixture:[{lane:0,time:1,duration:0}],libraryOverrides:storage.library,...options,browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:q=>C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher})},...options.browserOverrides}});
 return {app,net,storage};
}
test('title/artist search downloads actual Drums without audio or waveform comparison',async()=>{
 const net=network(),r=await C.lookup({...query,fetcher:net.fetcher,alignAudio:()=>assert.fail('No recording to compare')});
 assert.equal(r.chartOnly,true);assert.equal(r.duration,16);assert.ok(r.charts.drums.expert.length);assert.equal(r.references.drums.game,'Guitar Hero: Metallica');assert.equal(r.recordingReviews.drums.status,'uncertain');assert.match(r.message,/Chart only/);assert.doesNotMatch(r.message,/Audio charting used|timing verified/);
 assert.ok(net.requests.filter(r=>!r.url.includes('/search')).every(r=>r.options.headers.Range),'Only chart package ranges are fetched');
});
test('title-only GH3 charts remain Guitar-only and require audio verification only after an audio upload',async()=>{
 const net=F.network({rows:[{...F.row,icon:'gh3'}]}),g=await C.lookup({...query,parts:['guitar'],fetcher:net.fetcher});assert.ok(g.charts.guitar.expert.length);assert.equal(g.recordingReviews.guitar.status,'uncertain');
 const d=await C.lookup({...query,fetcher:net.fetcher});assert.deepEqual(d.charts,{});assert.ok(d.availableParts.includes('guitar'));assert.doesNotMatch(d.message,/Used audio charting/);
});
test('whole-song title search never combines charts with different recording lengths',async()=>{
 const guitar={...F.row,icon:'gh3',md5:'b'.repeat(32),notesData:{noteCounts:[{instrument:'guitar',difficulty:'expert',count:10}]}},drums={...game,song_length:32000,notesData:{noteCounts:[{instrument:'drums',difficulty:'expert',count:10}]}},net=F.network({rows:[guitar,drums]}),r=await C.lookup({...query,parts:['guitar','drums'],fetcher:net.fetcher});
 assert.equal(Object.keys(r.charts).length,1);assert.match(r.message,/No supported/);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} title-only Add song saves, previews and reopens charts without an audio file`,async()=>{
 const {app,net,storage}=searchedApp({mobile}),n=app.nodes;await enterName(app);await n.confirmAddSong.click();
 const rows=await storage.library.list();assert.equal(rows.length,1);const saved=await storage.library.get(rows[0].id);assert.equal(saved.chartOnly,true);assert.equal(saved.audioBlob,null);assert.equal(saved.byteLength,0);assert.ok(saved.quality.imports.drums.id);assert.equal(saved.quality.communityReferences.drums.game,'Guitar Hero: Metallica');assert.deepEqual(app.requests,[]);assert.equal(app.decodes,0);
 assert.equal(n.playButton.disabled,true);assert.equal(n.exportCurrentButton.disabled,false);assert.equal(n.addSongDialog.open,false);assert.match(n.setlistEntries.children[1].children[1].textContent,/Chart only/);assert.match(n.chartDetails.textContent,/Setlist: Guitar Hero: Metallica/);
 await n.playButton.click();assert.equal(app.sources.length,0);await n.previewButton.click();await until(()=>app.sources.length>0);assert.equal(app.sources.at(-1).buffer.duration,16);await n.previewButton.click();
 const count=net.requests.length,fresh=setup({mobile,chartFixture:[],libraryOverrides:storage.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.decodes,0);assert.equal(fresh.nodes.playButton.disabled,true);assert.equal(fresh.nodes.reconnectAudioButton.textContent,'Attach audio for this chart');assert.equal(net.requests.length,count);assert.match(fresh.nodes.chartDetails.textContent,/Setlist: Guitar Hero: Metallica/);
 const packed=L.pack(saved),restored=await L.unpack(packed);assert.equal(restored.audioBlob,null);assert.equal(restored.chartOnly,true);assert.equal(JSON.stringify(restored.charts),JSON.stringify(L.validate(saved).charts));
});
test('attaching audio to a found chart keeps notes, enables playback and removes the chart-only duplicate',async()=>{
 const {app,storage}=searchedApp(),n=app.nodes;await enterName(app);await n.confirmAddSong.click();const oldId=(await storage.library.list())[0].id,original=await storage.library.get(oldId);
 n.reconnectAudioFile.files=[new Blob([new Uint8Array([1,2,3,4])],{type:'audio/wav'})];n.reconnectAudioFile.files[0].name='Fixture Artist - Fixture Song.wav';await n.reconnectAudioFile.emit('change');
 const rows=await storage.library.list();assert.equal(rows.length,1);assert.notEqual(rows[0].id,oldId);const saved=await storage.library.get(rows[0].id);assert.notEqual(saved.chartOnly,true);assert.ok(saved.audioBlob.size);assert.deepEqual(saved.charts,original.charts);assert.equal(n.playButton.disabled,false);
 const fresh=setup({chartFixture:[],libraryOverrides:storage.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.equal(fresh.nodes.playButton.disabled,false);
});
test('no chart, blocked catalog or cancellation never replaces the open recording or runs audio analysis',async()=>{
 for(const mode of ['none','blocked','cancel']){
  let finish,signal;const net=F.network({rows:mode==='none'?[]:[game],blocked:mode==='blocked'}),{app,storage}=searchedApp({net,browserOverrides:mode==='cancel'?{RiffCommunityCharts:{identify:C.identify,lookup:q=>{if(!q.chartOnly)return Promise.resolve({charts:{},imports:{},sources:{},message:''});signal=q.signal;return new Promise(resolve=>finish=resolve);}}}:{}}),n=app.nodes;
  await app.upload('Keep this.wav');await until(()=>!n.saveCurrentButton.disabled);const original=(await storage.library.list())[0],record=await storage.library.get(original.id),requests=app.requests.length;
  await enterName(app);const task=n.confirmAddSong.click();if(mode==='cancel'){await until(()=>finish);await n.setlistCancelUpload.click();assert.equal(signal.aborted,true);finish({charts:{},message:'late'});}await task;
  assert.equal((await storage.library.list()).length,1);assert.deepEqual((await storage.library.get(original.id)).charts,record.charts);assert.equal(n.trackTitle.textContent,'Keep this');assert.equal(app.requests.length,requests);if(mode!=='cancel'){assert.equal(n.addSongDialog.open,true);assert.ok(n.addSongError.textContent);}
 }
});

test('Whole song name search saves only actual authored parts, and repeated searches keep one entry',async()=>{
 const {app,storage}=searchedApp(),n=app.nodes;await enterName(app,'whole');await n.confirmAddSong.click();let rows=await storage.library.list();assert.equal(rows.length,1);const original=await storage.library.get(rows[0].id);assert.deepEqual(Object.keys(original.charts).sort(),['bass','drums','guitar','vocals']);assert.deepEqual(app.requests,[]);
 await enterName(app,'drums');await n.confirmAddSong.click();rows=await storage.library.list();assert.equal(rows.length,1);assert.deepEqual((await storage.library.get(rows[0].id)).charts,original.charts);
});
test('chart-only backup imports without an audio hash and persists with no audio chunks',async()=>{
 const {app,storage}=searchedApp(),n=app.nodes;await enterName(app);await n.confirmAddSong.click();const id=(await storage.library.list())[0].id,saved=await storage.library.get(id),backup=L.pack(saved);
 const second=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),fresh=setup({chartFixture:[],libraryOverrides:second.library});fresh.nodes.backupFile.files=[backup];await fresh.nodes.backupFile.emit('change');
 const rows=await second.library.list();assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].chartOnly,true);assert.equal((await second.library.get(id)).audioBlob,null);assert.equal(JSON.stringify((await second.library.get(id)).charts),JSON.stringify(saved.charts));
 const manifest=second.stores.get('audio').get(id);assert.equal(manifest.audioBytes,0);assert.equal(manifest.audioChunks,0);assert.equal(manifest.chartOnly,true);
 second.stores.get('audio').set(id,{...manifest,chartOnly:false});await assert.rejects(second.library.get(id),/incomplete/);
});
test('wrong-length attachment is rejected without replacing or deleting the found chart',async()=>{
 const {app,storage}=searchedApp({referenceDecoder:bytes=>bytes[0]===2?{duration:32}:null}),n=app.nodes;await enterName(app);await n.confirmAddSong.click();const id=(await storage.library.list())[0].id,before=await storage.library.get(id);
 n.reconnectAudioFile.files=[new Blob([new Uint8Array([2,3,4,5])],{type:'audio/wav'})];await n.reconnectAudioFile.emit('change');assert.match(n.saveStatus.textContent,/length does not match/);assert.equal(n.playButton.disabled,true);assert.equal((await storage.library.list()).length,1);assert.deepEqual((await storage.library.get(id)).charts,before.charts);assert.equal((await storage.library.get(id)).audioBlob,null);
});
test('chart save failure leaves a found chart previewable and can retry without another search',async()=>{
 const storage=require('./helpers/song-storage.cjs').storage({rejectBlobs:true});let fail=true;
 const {app,net}=searchedApp({storage,libraryOverrides:{...storage.library,save:record=>{if(fail)throw Error('Disk full');return storage.library.save(record);}}}),n=app.nodes;
 await enterName(app);await n.confirmAddSong.click();assert.match(n.saveStatus.textContent,/Could not save charts.*storage is full/);assert.equal(n.exportCurrentButton.disabled,false);assert.equal((await storage.library.list()).length,0);
 const count=net.requests.length;fail=false;await n.setlistRetrySave.click();assert.equal((await storage.library.list()).length,1);assert.equal(net.requests.length,count);
});

test('attaching already-saved audio preserves that recording’s other instrument charts and source metadata',async()=>{
 const {app,storage}=searchedApp(),n=app.nodes;
 await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>!n.saveCurrentButton.disabled);const audioId=(await storage.library.list())[0].id,before=await storage.library.get(audioId);
 await enterName(app);await n.confirmAddSong.click();assert.equal((await storage.library.list()).length,2);
 n.reconnectAudioFile.files=[new Blob([new Uint8Array([1,1,2,3])],{type:'audio/wav'})];await n.reconnectAudioFile.emit('change');const saved=await storage.library.get(audioId);
 assert.equal((await storage.library.list()).length,1);assert.deepEqual(saved.charts.guitar,before.charts.guitar);assert.deepEqual(saved.quality.imports.guitar,before.quality.imports.guitar);assert.deepEqual(saved.quality.communityReferences.guitar,before.quality.communityReferences.guitar);assert.ok(saved.charts.drums);assert.notEqual(saved.chartOnly,true);
});

test('name search uses separate catalog title/artist fields and fetches the returned chart automatically',async()=>{
 const net=network(),result=await C.lookup({...query,fetcher:net.fetcher}),request=net.requests[0];
 assert.match(request.url,/\/search\/advanced$/);const body=JSON.parse(request.options.body);assert.deepEqual(body.name,{value:identity.title,exact:true,exclude:false});assert.deepEqual(body.artist,{value:identity.artist,exact:true,exclude:false});assert.ok(result.charts.drums.expert.length);assert.ok(net.requests.some(r=>r.url.endsWith('.sng')));
});
test('expanded catalog groups above the requested page size remain importable and stop at reported found count',async()=>{
 const rows=Array.from({length:68},(_,i)=>({...F.row,name:'Other Song',md5:(i+10).toString(16).padStart(32,'0')}));rows.push(game);const net=network();let searches=0;
 const fetcher=(url,options)=>url.includes('/search')?(searches++,Promise.resolve(new Response(JSON.stringify({data:rows,found:1}),{status:201}))):net.fetcher(url,options);
 const result=await C.lookup({...query,fetcher});assert.ok(result.charts.drums.expert.length);assert.equal(searches,1);
 const upload=await C.lookup({...query,chartOnly:false,duration:16,fetcher});assert.ok(upload.charts.drums.expert.length);assert.equal(searches,2);
});
test('name-index spelling variations broaden once and still reject a different song or artist',async()=>{
 const net=network(),searches=[];const fetcher=(url,options)=>{if(url.includes('/advanced')){searches.push(url);return Promise.resolve(new Response(JSON.stringify({data:[],found:0}),{status:201}));}if(url.includes('/search')){searches.push(url);return Promise.resolve(new Response(JSON.stringify({data:[{...game,name:'Other Song',md5:'b'.repeat(32)},game],found:1}),{status:201}));}return net.fetcher(url,options);};
 const result=await C.lookup({...query,fetcher});assert.ok(result.charts.drums.expert.length);assert.equal(searches.length,4,'Exact identity, bounded game-source and instrument queries, then one general spelling fallback');assert.equal(result.references.drums.title,identity.title);
});

test('a short custom-only result checks the matching game setlist before fetching a custom chart',async()=>{
 const custom={...F.row,md5:'b'.repeat(32),packName:'Custom Drums'},official={...game,charter:'Neversoft'},net=F.network({rows:[custom],containers:{[official.md5]:F.sng(),[custom.md5]:F.sng()}}),queries=[],progress=[];
 const fetcher=(url,options)=>{if(url.includes('/search')){const body=JSON.parse(options.body);queries.push(body);return Promise.resolve(new Response(JSON.stringify({data:body.charter?.value==='Neversoft'?[official]:[custom],found:1}),{status:201}));}return net.fetcher(url,options);};
 const result=await C.lookup({...query,fetcher,onProgress:m=>progress.push(m)});assert.equal(result.references.drums.game,'Guitar Hero: Metallica');assert.equal(result.references.drums.setlist,'Guitar Hero: Metallica');assert.equal(result.attempts[0].md5,official.md5);assert.equal(queries.length,2);assert.equal(queries[1].name.value,identity.title);assert.equal(queries[1].artist.value,identity.artist);assert.ok(progress.some(m=>m.includes('Found Fixture Song in Guitar Hero: Metallica')));
});
test('whole-song setlist discovery checks missing Drums even when a GH3 Guitar chart was already found',async()=>{
 const early={...F.row,icon:'gh3',md5:'b'.repeat(32),notesData:{noteCounts:[{instrument:'guitar',difficulty:'expert',count:10}]}},later={...game,icon:'ghwt',notesData:{noteCounts:[{instrument:'drums',difficulty:'expert',count:10}]}},custom={...F.row,md5:'c'.repeat(32),notesData:{noteCounts:[{instrument:'drums',difficulty:'expert',count:10}]}},net=F.network({containers:{[early.md5]:F.sng(),[later.md5]:F.sng(),[custom.md5]:F.sng()}});
 const fetcher=(url,options)=>url.includes('/search')?Promise.resolve(new Response(JSON.stringify({data:JSON.parse(options.body).charter?[later]:[early,custom],found:1}),{status:201})):net.fetcher(url,options);
 const result=await C.lookup({...query,parts:['guitar','drums'],fetcher});assert.equal(result.references.guitar.setlist,'Guitar Hero 3');assert.equal(result.references.drums.setlist,'Guitar Hero: World Tour');
});
test('a downloaded chart with conflicting game-setlist metadata is skipped before its notes are applied',async()=>{
 const wrong={...game,icon:'ghwt'},correct={...game,md5:'b'.repeat(32)},net=F.network({rows:[wrong,correct],containers:{[wrong.md5]:F.sng(F.fullMidi(),{metadata:{name:identity.title,artist:identity.artist,icon:'ghm',five_lane_drums:'True'}}),[correct.md5]:F.sng()}});
 const result=await C.lookup({...query,fetcher:net.fetcher});assert.match(result.attempts[0].reason,/different Guitar Hero setlist/);assert.equal(result.references.drums.md5,correct.md5);assert.equal(result.references.drums.setlist,'Guitar Hero: Metallica');
});
test('setlist discovery stops on an access block without alternate hosts or further download attempts',async()=>{
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.enchor.us/search/advanced');return JSON.parse(options.body).charter?new Response('blocked',{status:403}):new Response(JSON.stringify({data:[F.row],found:1}),{status:201});};
 const result=await C.lookup({...query,fetcher});assert.equal(calls,2);assert.deepEqual(result.charts,{});assert.equal(result.attempts.length,0);
});

for(const part of ['bass','vocals'])test(`matching game-setlist discovery retrieves its own ${part} track behind a custom-only result`,async()=>{
 const custom={...F.row,md5:'b'.repeat(32)},net=network();const fetcher=(url,options)=>url.includes('/search')?Promise.resolve(new Response(JSON.stringify({data:JSON.parse(options.body).charter?[game]:[custom],found:1}),{status:201})):net.fetcher(url,options);
 const result=await C.lookup({...query,parts:[part],fetcher});assert.ok(result.charts[part].expert.length);assert.equal(result.references[part].setlist,'Guitar Hero: Metallica');assert.deepEqual(Object.keys(result.charts),[part]);
});
