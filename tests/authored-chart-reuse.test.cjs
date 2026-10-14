const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const Reuse=require('../dist/authored-chart-reuse.js'),D=require('../dist/chart-difficulties.js'),L=require('../dist/song-library.js');
const parts=['guitar','bass','drums','vocals'],id='a'.repeat(64);
function song(){
 const charts=Object.fromEntries(parts.map((part,i)=>[part,D.build([{lane:i,time:1+i,duration:part==='vocals'?.2:0,...(part==='vocals'?{pitch:60}:{})}],part,.5)]));
 const imported=part=>({id:parts.indexOf(part).toString().repeat(64),filename:part+'.mid',layout:'five',levels:['expert'],derived:['easy','medium','hard']});
 return {id,title:'Fixture Song',artist:'Fixture Artist',filename:'original.wav',instrument:'guitar',musicEnd:16,bpm:120,beat:.5,offset:.1,charts,waveform:[.1,.5],audioBlob:new Blob(['original']),quality:{imports:Object.fromEntries(parts.map(p=>[p,imported(p)])),lookupIdentity:{title:'Fixture Song',artist:'Fixture Artist'},chartTimings:Object.fromEntries(parts.map(p=>[p,{resolution:480,offset:.12,tempos:[{tick:0,bpm:120},{tick:1920,bpm:100}],signatures:[{tick:0,numerator:4,denominator:4}]}])),chartAdjustments:{drums:90},communityReferences:Object.fromEntries(parts.map(p=>[p,{title:'Fixture Song',artist:'Fixture Artist',charter:p+' Charter',md5:'b'.repeat(32)}]))}};
}
test('every authored part retains its own full arrangements, source, variable tempo and manual timing adjustment',()=>{
 const original=song(),r=Reuse.reuse(original,id,16,parts);
 assert.deepEqual(r.charts,original.charts);assert.deepEqual(r.quality.reusedParts,parts);
 for(const p of parts){assert.deepEqual(r.quality.imports[p],original.quality.imports[p]);assert.deepEqual(r.quality.chartTimings[p],original.quality.chartTimings[p]);assert.equal(r.quality.communityReferences[p].charter,p+' Charter');}
 assert.equal(r.quality.chartAdjustments.drums,90);r.charts.drums.expert[0].lane=5;r.quality.chartTimings.guitar.tempos[0].bpm=15;
 assert.equal(original.charts.drums.expert[0].lane,2);assert.equal(original.quality.chartTimings.guitar.tempos[0].bpm,120);
});
test('filenames, other recordings, missing instruments, estimates and malformed imports cannot become authored charts',()=>{
 const s=song();assert.deepEqual(Reuse.reuse(s,'b'.repeat(64),16,parts).charts,{});assert.deepEqual(Reuse.reuse(s,id,18,parts).charts,{});
 delete s.quality.imports.drums;assert.deepEqual(Reuse.reuse(s,id,16,['drums']).charts,{});assert.equal(Reuse.reuse(s,id,16,['drums']).quality.lookupIdentity.artist,'Fixture Artist');
 s.quality.imports.drums={id:'invalid'};assert.deepEqual(Reuse.reuse(s,id,16,['drums']).charts,{});
 s.quality.imports.drums={...s.quality.imports.guitar};s.charts.drums.expert[0].time=99;assert.deepEqual(Reuse.reuse(s,id,16,['drums']).charts,{});
});
test('legacy authored imports retain their shared tempo scoped to their own part',()=>{
 const s=song();s.quality.chartTiming=s.quality.chartTimings.guitar;s.quality.chartTimings={};const r=Reuse.reuse(s,id,16,['bass']);
 assert.deepEqual(r.quality.chartTimings.bass,s.quality.chartTiming);assert.equal(r.charts.guitar,undefined);assert.equal(r.charts.drums,undefined);
});
const adapterFile=require.resolve('./upload-flow.test.cjs'),adapterCode=fs.readFileSync(adapterFile,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',adapterCode+'\nreturn {setup,until};')(createRequire(adapterFile));
const C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs');
for(const mobile of [false,true])for(const part of parts)test(`${mobile?'mobile':'desktop'} ${part}: authored upload survives offline same-audio reupload and fresh reopen without lookup or analysis`,async()=>{
 const net=F.network(),requests=[];let offline=false;
 const browserOverrides={RiffCommunityCharts:{lookup:async q=>{requests.push([...q.parts]);assert.ok(!offline,'Saved authored parts must not need a fresh lookup');return C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher});}}};
 const app=setup({mobile,chartFixture:[{lane:0,time:3,duration:0}],browserOverrides});
 await app.radios.chartTarget.find(r=>r.value===part).emit('change');await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);
 const before=[...app.savedSongs.values()][0],expected=JSON.stringify(before.charts[part]);assert.ok(before.quality.imports[part]);assert.deepEqual(app.requests,[]);assert.deepEqual(requests,[[part]]);
 offline=true;await app.upload('Renamed original.wav');await until(()=>!app.nodes.saveCurrentButton.disabled);
 const after=[...app.savedSongs.values()][0];assert.equal(JSON.stringify(after.charts[part]),expected);assert.equal(after.quality.imports[part].id,before.quality.imports[part].id);assert.deepEqual(after.quality.chartTimings[part],before.quality.chartTimings[part]);assert.deepEqual(requests,[[part]]);assert.deepEqual(app.requests,[]);assert.match(app.nodes.chartStatus.textContent,/Reused saved authored/);
 const restored=await L.unpack(L.pack(after));assert.deepEqual(restored.charts[part],JSON.parse(expected));assert.deepEqual(restored.quality.communityReferences[part],after.quality.communityReferences[part]);
 const fresh=setup({mobile,savedSongs:app.savedSongs,chartFixture:[],browserOverrides});await fresh.radios.chartTarget.find(r=>r.value===part).emit('change');await fresh.upload('Third filename.wav');await until(()=>!fresh.nodes.saveCurrentButton.disabled);
 assert.deepEqual(fresh.requests,[]);assert.deepEqual(requests,[[part]]);assert.equal(JSON.stringify([...fresh.savedSongs.values()][0].charts[part]),expected);
});
test('whole song reuses saved Guitar while fetching the missing Bass, Drums and Vocals independently',async()=>{
 const net=F.network(),lookups=[];const app=setup({chartFixture:[{lane:0,time:3,duration:0}],browserOverrides:{RiffCommunityCharts:{lookup:q=>{lookups.push([...q.parts]);return C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher});}}}});
 await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);const before=[...app.savedSongs.values()][0],guitar=JSON.stringify(before.charts.guitar),guitarId=before.quality.imports.guitar.id;
 app.nodes.chartScope.value='whole';await app.upload('Track 6.wav');await until(()=>!app.nodes.saveCurrentButton.disabled);
 assert.deepEqual(lookups,[['guitar'],['drums','bass','vocals']]);assert.deepEqual(app.requests,[]);const saved=[...app.savedSongs.values()][0];assert.equal(JSON.stringify(saved.charts.guitar),guitar);assert.equal(saved.quality.imports.guitar.id,guitarId);
 for(const part of parts)assert.ok(saved.quality.imports[part]);assert.deepEqual(saved.charts.drums.expert.map(n=>n.lane),[0,5,1,2,3,3]);assert.equal(saved.charts.vocals.expert[0].pitch,60);
});
test('another audio file with the same title cannot reuse a saved authored chart',async()=>{
 const net=F.network();let online=true;const app=setup({chartFixture:[{lane:0,time:3,duration:0}],browserOverrides:{RiffCommunityCharts:{lookup:q=>online?C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher}):Promise.resolve({charts:{},imports:{},sources:{},message:'Offline estimate.'})}}});
 await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);const original=[...app.savedSongs.values()][0],chart=JSON.stringify(original.charts.guitar);
 online=false;await app.upload('Fixture Artist - Fixture Song.wav',2);await until(()=>app.savedSongs.size===2&&!app.nodes.saveCurrentButton.disabled);
 assert.deepEqual(app.requests,['guitar']);assert.equal(JSON.stringify(app.savedSongs.get(original.id).charts.guitar),chart);const other=[...app.savedSongs.values()].find(s=>s.id!==original.id);assert.equal(other.quality.imports.guitar,undefined);assert.equal(other.charts.guitar.expert[0].lane,0);
});
test('same-recording reuse keeps manually adjusted chart times and the adjustment display without applying the shift twice',async()=>{
 const net=F.network(),app=setup({chartFixture:[],browserOverrides:{RiffCommunityCharts:{lookup:q=>C.lookup({...F.verifiedLookup(q),fetcher:net.fetcher})}}});await app.nodes.libraryUploadDrums.click();await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>app.savedSongs.size===1&&!app.nodes.saveCurrentButton.disabled);
 app.nodes.songChartShift.value='90';await app.nodes.applySongChartShift.click();await until(()=>!app.nodes.saveCurrentButton.disabled);const before=[...app.savedSongs.values()][0],times=JSON.stringify(before.charts.drums);assert.equal(before.quality.chartAdjustments.drums,90);
 await app.upload('Same original again.wav');await until(()=>!app.nodes.saveCurrentButton.disabled);const after=[...app.savedSongs.values()][0];assert.equal(after.quality.chartAdjustments.drums,90);assert.equal(JSON.stringify(after.charts.drums),times);assert.equal(app.nodes.songChartShift.value,'90');
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} the successful actual Hero authored backup is retained on reupload`,{skip:!process.env.RIFFBOUND_HERO_AUTHORED||!process.env.RIFFBOUND_HERO_PCM},async()=>{
 const saved=await L.unpack(new Blob([fs.readFileSync(process.env.RIFFBOUND_HERO_AUTHORED)])),raw=fs.readFileSync(process.env.RIFFBOUND_HERO_PCM),samples=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),audio=new Uint8Array(await saved.audioBlob.arrayBuffer());
 const originalDrums=JSON.stringify(saved.charts.drums),originalGuitar=JSON.stringify(saved.charts.guitar),app=setup({mobile,audioSamples:samples,uploadBytes:audio,savedSongs:new Map([[saved.id,saved]]),chartFixture:[],browserOverrides:{RiffCommunityCharts:{lookup:()=>assert.fail('The working Hero drum chart must not be searched again')}}});
 await app.nodes.libraryUploadDrums.click();await app.upload('Hero of the Day.mp3');await until(()=>!app.nodes.saveCurrentButton.disabled);
 const reused=app.savedSongs.get(saved.id);assert.equal(JSON.stringify(reused.charts.drums),originalDrums);assert.equal(JSON.stringify(reused.charts.guitar),originalGuitar);assert.equal(reused.quality.communityReferences.drums.charter,'SingeMFRC');assert.equal(reused.quality.scoreRevision,67);assert.equal(reused.quality.chartTimings.drums.offset,-20634/22050);assert.deepEqual(app.requests,[]);assert.deepEqual(Buffer.from(await reused.audioBlob.arrayBuffer()),Buffer.from(audio));
});

test('reusing old Whole-song charts preserves offsets/notes but cannot reuse Guitar verification for Drums',()=>{
 const original=song();original.quality.audioReviews={drums:{policy:'authored-recording-alignment-v1',timingVerified:true,referenceInstrument:'guitar',sourceOffsetSeconds:-3}};original.quality.timingReviews={drums:{status:'aligned',suggestedMs:0}};
 const before=JSON.stringify(original.charts),r=Reuse.reuse(original,id,16,['drums']);assert.equal(r.quality.audioReviews.drums.timingVerified,false);assert.equal(r.quality.timingReviews.drums.status,'uncertain');
 assert.deepEqual(r.charts.drums,original.charts.drums);assert.equal(r.quality.chartTimings.drums.offset,.12);assert.equal(r.quality.chartAdjustments.drums,90);assert.equal(JSON.stringify(original.charts),before);
});
