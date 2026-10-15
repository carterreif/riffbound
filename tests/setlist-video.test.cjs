const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const B=require('../dist/background-video.js'),{storage}=require('./helpers/song-storage.cjs');
function adapter(path,names){const file=require.resolve(path),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0];return new Function('require',prefix+'\nreturn {'+names+'};')(createRequire(file));}
const {fixture}=adapter('./background-video.test.cjs','fixture');
const {backupApp,setup,until}=adapter('./upload-flow.test.cjs','backupApp,setup,until');
const bytes=async file=>Buffer.from(await file.arrayBuffer());
function clip(size=5*1024*1024+17){const data=new Uint8Array(size);for(let i=0;i<size;i++)data[i]=i%251;return Object.assign(new Blob([data],{type:'video/mp4'}),{name:'Saved gameplay.mp4'});}
const config=file=>({file,name:file.name,mode:'video',offset:4.25,dim:55,keepVideo:true});
test('setlist video survives a fresh storage/player instance with exact bytes and timing, without oversized records or Blob writes',async()=>{
  const disk=storage({rejectBlobs:true}),store=B.storage(disk.indexedDB),file=clip(),f=fixture(store);
  await f.player.selectSong('song-a');await f.player.choose(file);await f.player.settings({offset:4.25,dim:55});assert.equal(await f.player.saveToSetlist(),true);
  assert.ok(disk.largest<=64*1024,'Small ArrayBuffer records avoid the existing browser Blob IOError');assert.equal(disk.stores.get('songs').get('song-a').file,null);assert.deepEqual(await store.savedSongs(['song-a','missing']),['song-a']);
  const reopened=fixture(B.storage(disk.indexedDB));await reopened.player.selectSong('song-a');const restored=reopened.player.attachment();assert.deepEqual(await bytes(restored.file),await bytes(file));assert.equal(restored.file.type,'video/mp4');assert.equal(restored.offset,4.25);assert.equal(restored.dim,55);
  await reopened.player.selectSong('song-b');assert.equal(reopened.player.hasVideo,false);await reopened.player.selectSong('song-a');assert.equal(reopened.player.hasVideo,true);
});
test('video settings reuse durable bytes; replacing, removing and failed replacement release only their own chunks',async()=>{
  const disk=storage({rejectBlobs:true}),store=B.storage(disk.indexedDB),first=clip(),next=clip(4*1024*1024+11);await store.put('a',config(first));
  const records=disk.stores.get('songs'),keys=[...records.keys()].sort(),token=records.get('a').media.token;
  first.slice=()=>assert.fail('Changing timing must not read or rewrite the video');await store.put('a',{...config(first),offset:-2});assert.equal(records.get('a').media.token,token);assert.deepEqual([...records.keys()].sort(),keys);
  disk.failAfter(70);await assert.rejects(store.put('a',config(next)),/write blobs/);disk.failAfter(null);assert.deepEqual([...disk.stores.get('songs').keys()].sort(),keys,'Failed replacement leaves no new partial chunks');assert.equal((await store.get('a')).offset,-2);
  await store.put('a',config(next));assert.notEqual(disk.stores.get('songs').get('a').media.token,token);assert.deepEqual(await bytes((await store.get('a')).file),await bytes(next));
  await store.put('b',config(clip(100)));await store.put('a',{file:null,mode:'stage',offset:0,dim:35,name:''});assert.deepEqual(await store.savedSongs(['a','b']),['b']);assert.equal([...disk.stores.get('songs').keys()].filter(key=>key.startsWith('video:a:')).length,0);assert.equal((await store.get('b')).file.size,100);
});
test('legacy background Blobs still reopen, migrate safely, and missing chunks report recovery',async()=>{
  const disk=storage(),file=clip(110);await disk.library.list();const table=disk.stores.get('songs');table.set('legacy',config(file));const store=B.storage(disk.indexedDB);assert.deepEqual(await store.savedSongs(['legacy']),['legacy']);assert.deepEqual(await bytes((await store.get('legacy')).file),await bytes(file));
  await store.put('legacy',{...(await store.get('legacy')),offset:7});assert.equal(table.get('legacy').file,null);const token=table.get('legacy').media.token;table.delete(`video:legacy:${token}:0`);await assert.rejects(store.get('legacy'),/incomplete.*original video/);
});
test('large videos are opt-in, remain saved through timing edits and reopening, and failed saves never claim success',async()=>{
  const f=fixture();await f.player.selectSong('large');const file=clip(20);Object.defineProperty(file,'size',{value:700*1024**2});await f.player.choose(file);assert.equal(f.entries.has('large'),false);
  await f.player.settings({offset:9,dim:40});assert.equal(await f.player.saveToSetlist(),true);assert.equal(f.entries.get('large').file,file);await f.player.settings({offset:10});assert.equal(f.entries.get('large').file,file,'Timing edits retain an explicitly saved large video');
  const reopened=fixture(f.store);await reopened.player.selectSong('large');assert.equal(reopened.player.attachment().offset,10);assert.equal(reopened.player.hasVideo,true);
  const failed=fixture({get:async()=>null,put:async()=>{throw Error('Quota exceeded');}});await failed.player.selectSong('failed');await failed.player.choose(clip(10));assert.equal(await failed.player.saveToSetlist(),false);assert.equal(failed.player.hasVideo,true);assert.match(failed.messages.at(-1).message,/could not be saved.*Quota/);
  const huge=clip(1);Object.defineProperty(huge,'size',{value:2*1024**3+1});await f.player.choose(huge);assert.throws(()=>f.player.saveToSetlist(),/2 GB/);
});
function binding(f,store){let selected,selection=Promise.resolve();return {selectSong(id){selected=id;selection=f.player.selectSong(id);return selection;},async saveToSetlist(id){await selection;assert.equal(id,selected);return f.player.saveToSetlist();},async savedSongs(ids){await f.player.settled();return store.savedSongs(ids);},removeSong:id=>f.player.removeSong(id),get hasVideo(){return f.player.hasVideo;},get busy(){return f.player.busy;},get mode(){return f.player.mode;},sync:f.player.sync,pause:f.player.pause,prepare:f.player.prepare};}
test('real Save video to setlist button saves song and video, adds its label, restores after reopening and removes both',async()=>{
  const disk=storage({rejectBlobs:true}),store=B.storage(disk.indexedDB),f=fixture(store),{app,n}=await backupApp({browserOverrides:{RiffBackground:binding(f,store)}}),id=[...app.savedSongs.keys()][0];
  await f.player.choose(clip(110));await f.player.settings({offset:-1.75,dim:60});await n.backgroundSaveSetlist.click();assert.match(n.backgroundStatus.textContent,/Video and timing saved with this song/);assert.match(n.setlistEntries.children.find(row=>row.dataset.songId===id).children[1].textContent,/Video saved/);
  const restoredStore=B.storage(disk.indexedDB),fresh=fixture(restoredStore),reopened=setup({savedSongs:app.savedSongs,browserOverrides:{RiffBackground:binding(fresh,restoredStore)}});await until(()=>reopened.nodes.setlistEntries.children.some(row=>row.dataset.songId===id));await reopened.nodes.setlistEntries.children.find(row=>row.dataset.songId===id).click();await until(()=>fresh.player.hasVideo);assert.equal(fresh.player.attachment().offset,-1.75);assert.equal(fresh.player.attachment().dim,60);
  await reopened.nodes.libraryButton.click();await until(()=>reopened.nodes.songList.children.length===1);await reopened.nodes.songList.children[0].children[2].children.find(button=>button.textContent==='Remove').click();assert.equal(app.savedSongs.size,0);assert.deepEqual(await restoredStore.savedSongs([id]),[]);assert.equal(fresh.player.hasVideo,false);
});
test('failed chart storage prevents a success message or saving an unlisted video',async()=>{
  let saves=0;const f=fixture(),store={savedSongs:async()=>[]},api=binding(f,store);api.saveToSetlist=async()=>{saves++;return true;};
  const app=setup({chartFixture:[{lane:0,time:1,duration:0}],storageFailure:true,browserOverrides:{RiffBackground:api}});await app.upload();await until(()=>app.nodes.saveStatus.textContent.includes('Could not save'));await f.player.choose(clip(10));await app.nodes.backgroundSaveSetlist.click();assert.equal(saves,0);assert.match(app.nodes.backgroundStatus.textContent,/Save the song to your setlist first/);assert.equal(app.savedSongs.size,0);
});
test('browser background API saves unblurred form timing and restores the paired preview after a fresh page',async()=>{
  const vm=require('node:vm'),disk=storage({rejectBlobs:true}),source=fs.readFileSync(require.resolve('../dist/background-video.js'),'utf8');
  function page(){
    const f=fixture(),nodes={backgroundVideo:f.video};
    for(const id of ['backgroundPreview','backgroundDialog','backgroundFile','backgroundMode','backgroundOffset','backgroundDim','backgroundRemove','backgroundDimValue','backgroundFilename','backgroundStatus','backgroundPreviewTiming','backgroundTimingHint','backgroundSaveSetlist','backgroundExportVideo'])nodes[id]={value:'',style:{},files:[],listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},async emit(type){for(const fn of this.listeners[type]||[])await fn();},pause(){},load(){},removeAttribute(name){delete this[name];}};
    f.video.closest=()=>({classList:{toggle(){},remove(){}}});
    const window={document:{getElementById:id=>nodes[id]},indexedDB:disk.indexedDB,URL:{createObjectURL:()=> 'blob:paired-preview',revokeObjectURL(){}},crypto:require('node:crypto').webcrypto};
    vm.runInNewContext(source,{window,Blob,Uint8Array,setTimeout,clearTimeout});return {api:window.RiffBackground,nodes};
  }
  const first=page();await first.api.selectSong('paired');first.nodes.backgroundFile.files=[clip(100)];await first.nodes.backgroundFile.emit('change');first.nodes.backgroundOffset.value='12.5';first.nodes.backgroundDim.value='65';
  assert.equal(await first.api.saveToSetlist('paired'),true);assert.deepEqual(Array.from(await first.api.savedSongs(['paired'])),['paired']);
  const fresh=page();await fresh.api.selectSong('paired');assert.equal(fresh.nodes.backgroundFilename.textContent,'Saved gameplay.mp4');assert.equal(fresh.nodes.backgroundOffset.value,12.5);assert.equal(fresh.nodes.backgroundDim.value,65);assert.equal(fresh.nodes.backgroundPreview.src,'blob:paired-preview');assert.equal(fresh.api.hasVideo,true);
  fresh.nodes.backgroundPreview.readyState=1;fresh.nodes.backgroundPreview.duration=100;await fresh.nodes.backgroundPreview.emit('loadedmetadata');assert.equal(fresh.nodes.backgroundPreview.currentTime,12.5);
  await fresh.api.removeSong('paired');assert.equal(fresh.api.hasVideo,false);assert.deepEqual(Array.from(await fresh.api.savedSongs(['paired'])),[]);
});
test('pending setlist video save blocks playback, switching and automatic reload until storage completes',async()=>{
  const store={savedSongs:async()=>[]},f=fixture(),api=binding(f,store);let finish;api.saveToSetlist=()=>new Promise(resolve=>finish=resolve);
  const {app,n}=await backupApp({browserOverrides:{RiffBackground:api}});await f.player.choose(clip(10));const pending=n.backgroundSaveSetlist.click();await until(()=>!!finish);assert.equal(app.updateSafety.canReload(),false);assert.equal(n.playButton.disabled,true);assert.equal(n.backgroundSaveSetlist.disabled,true);assert.equal(n.setlistEntries.children[0].disabled,true);
  finish(true);await pending;assert.equal(n.playButton.disabled,false);assert.match(n.backgroundStatus.textContent,/Video and timing saved/);
});
