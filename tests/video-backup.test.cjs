const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module'),{createHash}=require('node:crypto');
const L=require('../dist/song-library.js');
function adapter(path,names){const file=require.resolve(path),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0];return new Function('require',prefix+'\nreturn {'+names+'};')(createRequire(file));}
const {fixture}=adapter('./background-video.test.cjs','fixture');
const {backupApp,setup,until}=adapter('./upload-flow.test.cjs','backupApp,setup,until');
const {setup:saveWindow}=adapter('./backup-save.test.cjs','setup');
const audio=new Blob(['original audio bytes'],{type:'audio/wav'}),video=new Blob(['original video bytes'],{type:'video/mp4'});
const levels={easy:[{lane:0,time:1,duration:0}],medium:[{lane:0,time:1,duration:0}],hard:[{lane:0,time:1,duration:0}],expert:[{lane:0,time:1,duration:0}]};
const song={id:createHash('sha256').update('original audio bytes').digest('hex'),title:'Video backup',instrument:'drums',musicEnd:16,bpm:120,beat:.5,charts:{guitar:levels,drums:levels,bass:levels,vocals:levels},audioBlob:audio};
const background={file:video,name:'My gameplay.mp4',mode:'video',offset:-2.25,dim:50};
const bytes=async blob=>Buffer.from(await blob.arrayBuffer());
test('combined backup preserves all charts, original media bytes and video settings; old backups stay compatible',async()=>{
  const packed=L.pack(song,{background});assert.equal(await packed.slice(0,10).text(),'RIFFPACK2\n');
  const restored=await L.unpack(packed);assert.deepEqual(restored.charts,L.validate(song).charts);assert.deepEqual(await bytes(restored.audioBlob),await bytes(audio));assert.deepEqual(await bytes(restored.background.file),await bytes(video));assert.equal(restored.background.file.type,'video/mp4');
  for(const key of ['name','mode','offset','dim'])assert.equal(restored.background[key],background[key]);
  const old=L.pack(song);assert.equal(await old.slice(0,10).text(),'RIFFPACK1\n');const legacy=await L.unpack(old);assert.equal(legacy.background,undefined);assert.deepEqual(await bytes(legacy.audioBlob),await bytes(audio));
  const chartOnly=await L.unpack(L.pack({...song,chartOnly:true,audioBlob:null},{background}));assert.equal(chartOnly.audioBlob,null);assert.equal(chartOnly.byteLength,0);assert.deepEqual(chartOnly.charts,restored.charts);assert.deepEqual(await bytes(chartOnly.background.file),await bytes(video));
});
test('combined backups reject corrupt media boundaries and invalid video settings before import',async()=>{
  const original=L.pack(song,{background}),length=new DataView(await original.slice(10,14).arrayBuffer()).getUint32(0),manifest=JSON.parse(await original.slice(14,14+length).text()),payload=original.slice(14+length);
  function changed(edit){const next=structuredClone(manifest);edit(next);const json=new TextEncoder().encode(JSON.stringify(next)),size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,json.length);return new Blob(['RIFFPACK2\n',size,json,payload]);}
  for(const edit of [m=>m.audioBytes++,m=>m.song.byteLength++,m=>m.background.bytes--,m=>m.background.bytes=2*1024**3+1,m=>m.background.offset=901,m=>m.background.dim=-1,m=>m.background.mime='invalid',m=>m.background.name='',m=>m.background.mode='other'])await assert.rejects(L.unpack(changed(edit)),/invalid|incomplete/);
  await assert.rejects(L.unpack(original.slice(0,original.size-1)),/incomplete/);await assert.rejects(L.unpack(new Blob([original,'extra'])),/incomplete/);
  assert.throws(()=>L.pack(song,{background:{...background,file:null}}),/Choose a video/);
  const huge=new Blob(['x']);Object.defineProperty(huge,'size',{value:2*1024**3+1});assert.throws(()=>L.pack(song,{background:{...background,file:huge}}),/2 GB/);
});
test('packing does not read the complete video into JavaScript memory',()=>{
  const file=new Blob(['video'],{type:'video/mp4'});file.arrayBuffer=()=>assert.fail('Use Blob concatenation, not a whole-video read');assert.ok(L.pack(song,{background:{...background,file}}).size>file.size);
});
test('restored backgrounds remain paired with the song after reopening; storage limits report session-only playback',async()=>{
  const f=fixture();await f.player.selectSong(song.id);assert.match(await f.player.restore(background),/restored with this chart/);
  const reopened=fixture(f.store);await reopened.player.selectSong(song.id);const restored=reopened.player.attachment();for(const key of ['name','mode','offset','dim'])assert.equal(restored[key],background[key]);assert.deepEqual(await bytes(restored.file),await bytes(video));
  const failed=fixture({get:async()=>null,put:async()=>{throw Error('Quota');}});await failed.player.selectSong(song.id);assert.match(await failed.player.restore(background),/browser storage could not keep it/);assert.equal(failed.player.hasVideo,true);
  const large=new Blob(['large video'],{type:'video/mp4'});Object.defineProperty(large,'size',{value:700*1024**2});assert.match(await f.player.restore({...background,file:large}),/this session.*large video/);assert.equal(f.entries.get(song.id).file,null);assert.equal(f.player.hasVideo,true);
});
function binding(f){let selected,selection=Promise.resolve();return {selectSong(id){selected=id;selection=f.player.selectSong(id);return selection;},async attachment(id){await selection;assert.equal(id,selected);return f.player.attachment();},async restore(id,value){await selection;assert.equal(id,selected);return f.player.restore(value);},get hasVideo(){return f.player.hasVideo;},get busy(){return f.player.busy;},get mode(){return f.player.mode;},sync:f.player.sync,pause:f.player.pause,prepare:f.player.prepare};}
test('real save button exports the paired video and real import restores it with the verified audio and charts',async()=>{
  const f=fixture(),{app,n,urls}=await backupApp({browserOverrides:{RiffBackground:binding(f)}}),saved=[...app.savedSongs.values()][0];
  await f.player.choose(f.file);await f.player.settings({offset:3.75,dim:45});n.backgroundDialog.open=true;await n.backgroundExportVideo.click();assert.equal(n.backgroundDialog.open,false);assert.equal(n.backupDialog.open,true);assert.match(n.backupFileInfo.textContent,/video and background timing/);
  const combined=urls.blobs.get(n.backupDownload.href),record=await L.unpack(combined);assert.equal(record.id,saved.id);assert.deepEqual(record.charts,L.validate(saved).charts);assert.deepEqual(await bytes(record.audioBlob),await bytes(saved.audioBlob));assert.deepEqual(await bytes(record.background.file),await bytes(f.file));
  const fresh=fixture(),imported=setup({browserOverrides:{RiffBackground:binding(fresh)}});imported.nodes.backupFile.files=[combined];await imported.nodes.backupFile.emit('change');await until(()=>imported.savedSongs.size===1&&fresh.player.hasVideo);
  assert.deepEqual(imported.savedSongs.get(saved.id).charts,record.charts);assert.equal(fresh.player.attachment().offset,3.75);assert.equal(fresh.player.attachment().dim,45);assert.deepEqual(await bytes(fresh.entries.get(saved.id).file),await bytes(f.file));
  await n.exportCurrentButton.click();const regular=await L.unpack(urls.blobs.get(n.backupDownload.href));assert.equal(regular.background,undefined,'Regular export remains chart and audio only');
});
test('standalone save window accepts video backups above the old audio limit and rejects oversized files',()=>{
  const accepted=saveWindow(),file=new Blob(['fake large backup']);Object.defineProperty(file,'size',{value:100*1024**2});accepted.deliver(file);assert.equal(accepted.urls.size,1);
  const rejected=saveWindow(),oversized=new Blob(['fake oversized backup']);Object.defineProperty(oversized,'size',{value:(2048+88)*1024**2+15});rejected.deliver(oversized);assert.equal(rejected.urls.size,0);assert.match(rejected.nodes.saveStatus.textContent,/could not be read/);
});
