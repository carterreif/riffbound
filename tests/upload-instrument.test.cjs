const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs');
const notes=[{lane:0,time:1,duration:0}],radio=(app,group,part)=>app.radios[group].find(r=>r.value===part);
for(const mobile of [false,true])for(const part of ['drums','bass','vocals'])test(`${mobile?'mobile':'desktop'} next ${part} upload requests its own authored track while Guitar stays open`,async()=>{
 const net=F.network(),lookups=[];
 const app=setup({mobile,chartFixture:notes,browserOverrides:{RiffCommunityCharts:{lookup:q=>{lookups.push([...q.parts]);return C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher});}}}}),n=app.nodes;
 await app.upload('First guitar.wav');await until(()=>!n.saveCurrentButton.disabled);
 const previous=JSON.stringify([...app.savedSongs.values()][0]),requests=app.requests.length;
 await n.addSongButton.click();n.addSongPart.value=part;await n.addSongPart.emit('change');
 assert.equal(app.requests.length,requests,'Choosing the next upload must not analyze the old song');
 assert.equal(JSON.stringify([...app.savedSongs.values()][0]),previous,'The open Guitar song must remain intact');
 assert.equal(radio(app,'instrument','guitar').checked,true);assert.equal(n.addSongPart.value,part);
 await app.radios.difficulty[3].emit('change');
 assert.equal(n.addSongPart.value,part,'Playback refresh must retain the Add song choice');
 n.addLookupTitle.value='Fixture Song';n.addLookupArtist.value='Fixture Artist';
 n.addSongFile.files=[{name:'Next original.wav',size:4,arrayBuffer:async()=>new Uint8Array([9,1,2,3]).buffer}];
 await n.confirmAddSong.click();await until(()=>app.savedSongs.size===2&&!n.saveCurrentButton.disabled);
 assert.deepEqual(lookups.at(-1),[part]);
 const saved=[...app.savedSongs.values()].find(s=>s.filename==='Next original.wav');
 assert.deepEqual(Object.keys(saved.charts),[part]);assert.ok(saved.quality.imports[part]);
 assert.equal(saved.instrument,part);assert.equal(radio(app,'instrument',part).checked,true);
 assert.equal(saved.charts.guitar,undefined);
 if(part==='drums'){assert.equal(saved.quality.drumLayout,'four');assert.deepEqual([...new Set(saved.charts.drums.expert.map(n=>n.lane))].sort(),[0,1,2,3,5]);}
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} failed Drums playback switch cannot reset an explicit next-upload target`,async()=>{
 const app=setup({mobile,chartFixture:notes,chartFailures:{drums:'No confident drum attacks'}}),n=app.nodes;
 await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 await radio(app,'chartTarget','drums').emit('change');
 await radio(app,'instrument','drums').emit('change');
 assert.equal(radio(app,'instrument','guitar').checked,true);
 assert.equal(radio(app,'chartTarget','drums').checked,true);assert.match(n.uploadButton.textContent,/Drums/);
 await app.upload('Next drums.wav',9);assert.equal(app.requests.at(-1),'drums');
 assert.equal(app.savedSongs.size,1,'Failure must not silently save a Guitar replacement');
});
test('file picker snapshots the selected part and identity; cancellation discards the snapshot',async()=>{
 const lookups=[],app=setup({chartFixture:notes,browserOverrides:{RiffCommunityCharts:{lookup:async q=>{lookups.push({parts:[...q.parts],title:q.title});return {charts:{},imports:{},sources:{}};}}}}),n=app.nodes;
 await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 await radio(app,'chartTarget','drums').emit('change');n.lookupTitle.value='Picked song';await n.uploadButton.click();
 await radio(app,'chartTarget','bass').emit('change');n.lookupTitle.value='Changed field';
 await app.upload('Picked.wav',9);assert.equal(app.requests.at(-1),'drums');assert.deepEqual(lookups.at(-1),{parts:['drums'],title:'Picked song'});
 await until(()=>!n.saveCurrentButton.disabled);await n.uploadButton.click();await n.songFile.emit('cancel');
 await radio(app,'chartTarget','vocals').emit('change');await app.upload('After cancel.wav',8);assert.equal(app.requests.at(-1),'vocals');
});
test('explicit upload instrument survives playback changes, Add song and a fresh session',async()=>{
 const app=setup({chartFixture:notes});await app.upload();await until(()=>!app.nodes.saveCurrentButton.disabled);
 await radio(app,'chartTarget','drums').emit('change');await radio(app,'instrument','bass').emit('change');await until(()=>!app.nodes.saveCurrentButton.disabled);
 assert.equal(radio(app,'chartTarget','drums').checked,true);
 await app.nodes.addSongButton.click();assert.equal(app.nodes.addSongPart.value,'drums');
 const preferences=JSON.parse(app.writes.filter(([key])=>key==='riffbound-preferences-v1').at(-1)[1]);
 const fresh=setup({chartFixture:notes,preferences});assert.equal(radio(fresh,'chartTarget','drums').checked,true);
 await fresh.upload('Fresh drums.wav');assert.deepEqual(fresh.requests,['drums']);
});
test('a Guitar-only catalog response cannot be used as the requested Drum chart',async()=>{
 const D=require('../dist/chart-difficulties.js'),guitar=D.build([{lane:4,time:7,duration:1}],'guitar',.5);
 const app=setup({chartFixture:[{lane:5,time:2,duration:0}],browserOverrides:{RiffCommunityCharts:{lookup:async q=>{
  assert.deepEqual([...q.parts],['drums']);return {charts:{guitar},imports:{guitar:{levels:['expert']}},sources:{guitar:'Wrong part'}};
 }}}});
 await radio(app,'chartTarget','drums').emit('change');await app.upload();await until(()=>!app.nodes.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(Object.keys(saved.charts),['drums']);
 assert.deepEqual(app.requests,['drums']);assert.equal(saved.quality.imports.drums,undefined);
 assert.deepEqual(Array.from(saved.charts.drums.expert,n=>[n.time,n.lane]),[[2,5]]);
});
