const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const L=require('../dist/song-library.js'),C=require('../dist/community-charts.js'),D=require('../dist/chart-difficulties.js'),F=require('./helpers/community-fixture.cjs');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const copy=x=>JSON.parse(JSON.stringify(x));
async function backup(){
 const app=setup({chartFixture:D.build([{lane:0,time:1,duration:0},{lane:4,time:2,duration:0}],'drums',.5)});
 await app.nodes.libraryUploadDrums.click();await app.upload('04 Track 4.mp3');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);
 const record=[...app.savedSongs.values()][0];record.quality={...record.quality,lookupIdentity:{title:'Fixture Song',artist:'Fixture Artist'},audioReviews:{drums:{estimated:true}}};return record;
}
async function importInto(app,record){app.nodes.backupFile.files=[await L.pack(record)];await app.nodes.backupFile.emit('change');return [...app.savedSongs.values()][0];}
for(const mobile of [false,true]){
 test(`${mobile?'mobile':'desktop'} full backup imports four independent community parts and retains the selected instrument`,async()=>{
  const record=await backup();for(const part of ['guitar','bass','vocals'])record.charts[part]=D.build([{lane:0,time:1,duration:0,...(part==='vocals'?{pitch:60}:{})}],part,.5);
  const n=F.network(),calls=[],app=setup({mobile,browserOverrides:{RiffCommunityCharts:{...C,lookup:o=>{calls.push(o);return C.lookup({...F.verifiedLookup(o),fetcher:n.fetcher});}}}}),saved=await importInto(app,record);
  assert.deepEqual(copy(calls[0].parts),['guitar','drums','bass','vocals']);assert.equal(saved.instrument,'drums');assert.deepEqual(Object.keys(saved.quality.imports).sort(),['bass','drums','guitar','vocals']);assert.deepEqual(app.requests,[]);
  for(const part of ['guitar','drums','bass','vocals']){assert.ok(saved.charts[part].expert.length);assert.notDeepEqual(saved.charts[part],record.charts[part]);for(const other of ['guitar','drums','bass','vocals'].filter(p=>p!==part))assert.notDeepEqual(saved.charts[part].expert,saved.charts[other].expert);}
  const restored=await L.unpack(await L.pack(saved));assert.deepEqual(restored.charts,L.validate(saved).charts);assert.equal(app.savedSongs.size,1);
 });
 test(`${mobile?'mobile':'desktop'} backup searches its own identity and imports only its missing Drums`,async()=>{
  const record=await backup(),n=F.network(),calls=[];
  const app=setup({mobile,browserOverrides:{RiffCommunityCharts:{...C,lookup:options=>{calls.push(options);return C.lookup({...F.verifiedLookup(options),fetcher:n.fetcher});}}}});
  app.nodes.addLookupTitle.value='Wrong upload';app.nodes.addLookupArtist.value='Wrong artist';
  const saved=await importInto(app,record);
  assert.equal(calls.length,1);assert.deepEqual(copy(calls[0].parts),['drums']);assert.equal(calls[0].title,'Fixture Song');assert.equal(calls[0].artist,'Fixture Artist');assert.equal(calls[0].enabled,true);
  assert.deepEqual(app.requests,[]);assert.deepEqual(Object.keys(saved.charts),['drums']);assert.ok(saved.quality.imports.drums);assert.notDeepEqual(saved.charts.drums,record.charts.drums);assert.equal(saved.instrument,'drums');assert.equal(saved.bpm,record.bpm);assert.equal(saved.chartVersion,record.chartVersion);
  assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),Buffer.from(await record.audioBlob.arrayBuffer()));assert.equal(app.savedSongs.size,1);assert.match(app.nodes.chartStatus.textContent,/Authored drums fetched/);
  const exported=await L.unpack(await L.pack(saved));assert.deepEqual(exported.charts,L.validate(saved).charts);
 });
 test(`${mobile?'mobile':'desktop'} live-only result preserves every saved head and reports the alternate recording`,async()=>{
  const record=await backup(),n=F.network({rows:[{...F.row,name:'Fixture Song (Live)'}]}),app=setup({mobile,browserOverrides:{RiffCommunityCharts:{...C,lookup:o=>C.lookup({...F.verifiedLookup(o),fetcher:n.fetcher})}}});
  const saved=await importInto(app,record);assert.deepEqual(saved.charts,L.validate(record).charts);assert.deepEqual(app.requests,[]);assert.equal(n.requests.length,4);assert.ok(n.requests.every(r=>r.url.includes('/search')));assert.match(saved.quality.onlineLookup.message,/Only different song versions/);assert.match(saved.quality.onlineLookup.message,/Fixture Song \(Live\)/);assert.match(app.nodes.chartStatus.textContent,/backup charts are kept/);assert.doesNotMatch(app.nodes.chartStatus.textContent,/Used audio charting/);
 });
}
test('backup lookup protects authored, manually timed and reviewed parts while requesting eligible parts independently',async()=>{
 const record=await backup();record.charts.guitar=D.build([{lane:1,time:3,duration:0}],'guitar',.5);record.charts.bass=D.build([{lane:0,time:4,duration:0}],'bass',.5);record.charts.vocals=D.build([{lane:2,time:5,duration:0,pitch:65}],'vocals',.5);
 record.quality.imports={guitar:{id:'a'.repeat(64),filename:'guitar.mid',levels:['expert'],derived:['easy','medium','hard']}};record.quality.chartAdjustments={bass:120};record.quality.scoreReview=true;
 const calls=[],app=setup({browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async o=>{calls.push(o);return {charts:{},identity:{title:o.title,artist:o.artist},message:'No matching recording with these parts was found. Used audio charting.'};}}}});
 const saved=await importInto(app,record);assert.deepEqual(copy(calls[0].parts),['vocals']);assert.deepEqual(saved.charts,L.validate(record).charts);assert.equal(saved.quality.chartAdjustments.bass,120);assert.equal(saved.quality.scoreReview,true);assert.deepEqual(app.requests,[]);
});
test('unchecked community-first option restores the backup without any search or analysis',async()=>{
 const record=await backup(),app=setup({preferences:{communityLookup:false},browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async()=>assert.fail('Opt-out must not search')}}});
 const saved=await importInto(app,record);assert.deepEqual(saved.charts,L.validate(record).charts);assert.deepEqual(app.requests,[]);
});
test('same-title backup charts stay intact when source recording audio cannot be verified',async()=>{
 const record=await backup(),net=F.network(),calls=[];
 const app=setup({browserOverrides:{RiffCommunityCharts:{...C,lookup:q=>{calls.push(q);return C.lookup({...q,fetcher:net.fetcher});}}}});
 const saved=await importInto(app,record);
 assert.equal(calls[0].requireAudioMatch,true);assert.deepEqual(saved.charts,L.validate(record).charts);assert.deepEqual(app.requests,[]);assert.equal(saved.quality.imports?.drums,undefined);
 assert.match(saved.quality.onlineLookup.message,/could not be verified against your upload/);assert.match(app.nodes.chartStatus.textContent,/backup charts are kept/);
 assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),Buffer.from(await record.audioBlob.arrayBuffer()));
});
test('network failure keeps imported chart saved and gives a retryable explanation',async()=>{
 const record=await backup(),app=setup({browserOverrides:{RiffCommunityCharts:{identify:C.identify,lookup:async()=>{throw Error('Network unavailable');}}}});
 const saved=await importInto(app,record);assert.deepEqual(saved.charts,L.validate(record).charts);assert.deepEqual(app.requests,[]);assert.match(app.nodes.chartStatus.textContent,/Your imported backup charts are kept/);assert.equal(app.nodes.saveCurrentButton.disabled,false);
});
