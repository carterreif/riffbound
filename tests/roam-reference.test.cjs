const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const R=require('../dist/reference-charts.js'),A=require('../dist/autochart.js'),U=require('../dist/reference-updates.js'),E=require('../dist/engine.js'),L=require('../dist/song-library.js');
const id='53dd7e8d5503db94988872300a29932c41e7174560d49d72fa6f7068af6b7e88',duration=433.62603174603174;
const oldImportId='879c0b06eab2c25c790911ca170a24e6dd489639a7f368aa371e0fe3b2e1cdfe';
const reference=()=>R.match(id,duration),charts=()=>A.buildMatchedCharts(reference(),duration).drums;
const comparable=notes=>Array.from(notes,({lane,time,duration})=>({lane,time,duration}));
const digest=notes=>crypto.createHash('sha256').update(JSON.stringify(comparable(notes))).digest('hex');
const levels=()=>Object.fromEntries(['easy','medium','hard','expert'].map(level=>[level,[{id:0,lane:0,time:1.25,duration:0}]]));
const original=()=>({id,title:'Roam',instrument:'drums',musicEnd:duration,duration:duration+.8,bpm:120,beat:.5,offset:0,audioBlob:new Blob(['original']),waveform:[],charts:{drums:levels(),guitar:levels()},quality:{}});

test('Roam reference matches exact recording identity and length, and returns isolated copies',()=>{
 for(const [hash,time] of [['WhereverImayroamdrumsonly.wav',duration],['a'.repeat(64),duration],[id,32],[id,duration+.03],[id,NaN]])assert.equal(R.match(hash,time),null);
 const first=reference();assert.equal(first.revision,3);assert.equal(first.chartVersion,17);
 first.events[0].lane=99;first.waveform[0]=99;first.currentImport.derived[0]='bad';first.previousImportIds.length=0;
 const next=reference();assert.equal(next.events[0].lane,0);assert.notEqual(next.waveform[0],99);assert.equal(next.currentImport.derived[0],'hard');assert.equal(next.previousImportIds.length,1);
});
test('shipped Roam notes exactly match the corrected backup and retain reviewed colors',()=>{
 const all=charts();assert.deepEqual(['easy','medium','hard','expert'].map(level=>all[level].length),[681,1117,1687,2051]);
 assert.equal(digest(all.expert),'0c7b6a57b6966d0ae207cb1d59a75d3bb5c3036cf7cb52fcc91d55ff8aa66b10');
 assert.deepEqual(Array.from({length:6},(_,lane)=>all.expert.filter(n=>n.lane===lane).length),[505,451,58,98,65,874]);
 const has=(lane,time)=>all.expert.some(n=>n.lane===lane&&Math.abs(n.time-time)<.012);
 for(const t of [52.806,54.579,81.068,183.615,185.363,377.029,378.423]){assert.ok(has(0,t));assert.ok(!has(3,t));}
 for(const t of [11.648,19.056,27.422,28.341,29.258,36.721,51.882,117.787,184.923,201.993])assert.ok(has(3,t));
 for(const [t,lane] of [[120.953,2],[370.102,4],[376.795,4],[391.129,2]])assert.ok(has(lane,t));
 assert.ok(all.expert.filter(n=>n.time<11.5).every(n=>n.lane===0));
 assert.ok(all.expert.filter(n=>n.time>26.46&&n.time<27.2).every(n=>n.lane===0));
});
test('every Roam difficulty is playable and is a nested subset without shifted hits',()=>{
 const all=charts(),key=n=>n.lane+':'+n.time;
 for(const [lower,higher] of [['easy','medium'],['medium','hard'],['hard','expert']]){const keys=new Set(all[higher].map(key));assert.ok(all[lower].every(n=>keys.has(key(n))));}
 for(const [level,notes] of Object.entries(all)){const session=new E.Session(level,'tap','drums',{notes,musicEnd:duration});for(const n of notes){session.update(n.time,new Set());session.tap(n.lane,n.time);}session.update(duration,new Set());assert.equal(session.hits,notes.length);assert.equal(session.misses,0);}
});
test('saved automatic Roam charts update all levels once, preserving original audio and other instruments',()=>{
 const old=original(),updated=U.upgrade(old);assert.notEqual(updated,old);assert.equal(updated.audioBlob,old.audioBlob);assert.equal(updated.charts.guitar,old.charts.guitar);
 assert.deepEqual(updated.charts.drums,charts());assert.equal(updated.bpm,133);assert.equal(updated.beat,60/133);assert.equal(updated.quality.scoreReference,'roam');assert.equal(updated.quality.preserveEasyMedium,false);
 assert.equal(updated.quality.scoreRevision,3);assert.equal(updated.chartVersion,17);assert.equal(U.upgrade(updated),updated);assert.match(U.message(updated),/Roam.*updated automatically/);
 assert.equal(old.charts.drums.expert.length,1);
});
test('only the fingerprinted older curated Roam import upgrades; edited/current/future/other files remain protected',()=>{
 const old=original();old.quality={review:{revision:2},imports:{drums:{id:oldImportId,filename:'Roam-WAV-reviewed.chart'},guitar:{id:'other'}}};
 const updated=U.upgrade(old);assert.equal(updated.charts.drums.expert.length,2051);assert.equal(updated.quality.imports.drums.id,reference().currentImport.id);assert.equal(updated.quality.imports.guitar,old.quality.imports.guitar);assert.equal(updated.quality.review.revision,3);assert.equal(U.upgrade(updated),updated);
 for(const change of [s=>s.quality={imports:{drums:{id:'edited',filename:'Roam-WAV-reviewed.chart'}}},s=>s.quality={imports:{drums:reference().currentImport}},s=>s.quality={scoreRevision:99},s=>s.id='f'.repeat(64),s=>s.musicEnd+=1,s=>delete s.charts.drums]){const s=original();change(s);assert.equal(U.upgrade(s),s);}
});
test('Roam reference is available in browser, worker and offline asset loading paths',()=>{
 const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8'),worker=fs.readFileSync(require.resolve('../dist/reference-charts.js'),'utf8'),offline=fs.readFileSync(require.resolve('../dist/offline-assets.js'),'utf8');
 assert.ok(html.indexOf('src="roam-reference.js"')<html.indexOf('src="reference-charts.js"'));assert.match(worker,/importScripts\('roam-reference\.js'\)/);assert.match(offline,/'roam-reference\.js'/);const version=Number(html.match(/Game version (\d+)/)?.[1]);assert.ok(version>=42);assert.ok(offline.includes(`riffbound-offline-v${version}-`),'Game and cached asset versions must agree');
});

const privateAudio=Boolean(process.env.RIFFBOUND_ROAM_WAV&&process.env.RIFFBOUND_ROAM_PCM);
test('whole-song charting retains the Roam review metadata even when Guitar is the selected base',async()=>{
 const adapterFile=require.resolve('./upload-flow.test.cjs'),adapterCode=fs.readFileSync(adapterFile,'utf8').split('\ntest(')[0];
 const {setup,until}=new Function('require',adapterCode+'\nreturn {setup,until};')(createRequire(adapterFile));
 const app=setup({chartFixture:()=>levels(),chartResultExtras:part=>({quality:part==='drums'?{preserveEasyMedium:false,scoreRevision:3,scoreReference:'roam',scoreReview:'Roam corrected chart'}:{}})});
 app.nodes.chartScope.value='whole';await app.nodes.chartScope.emit('change');await app.upload('Whole recording.wav');await until(()=>app.savedSongs.size===1);
 assert.deepEqual(app.requests,['guitar','drums','bass','vocals']);const saved=[...app.savedSongs.values()][0];
 assert.equal(saved.quality.scoreReference,'roam');assert.equal(saved.quality.scoreRevision,3);assert.equal(saved.quality.preserveEasyMedium,false);assert.equal(saved.quality.scoreReview,'Roam corrected chart');assert.deepEqual(Object.keys(saved.charts).sort(),['bass','drums','guitar','vocals']);
});
function recording(){const audio=fs.readFileSync(process.env.RIFFBOUND_ROAM_WAV),raw=fs.readFileSync(process.env.RIFFBOUND_ROAM_PCM);assert.equal(crypto.createHash('sha256').update(audio).digest('hex'),id);return {audio,samples:new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4)};}
test('actual Roam WAV selects the corrected reference instead of generic drum inference',{skip:!privateAudio},()=>{
 const {samples}=recording(),progress=[];const result=A.analyze({samples,sampleRate:22050,instrument:'drums',audioId:id},(_,label)=>progress.push(label));
 assert.equal(result.chartVersion,17);assert.equal(result.quality.scoreReference,'roam');assert.equal(result.quality.sources.drums,reference().label);assert.equal(result.quality.preserveEasyMedium,false);assert.ok(progress.some(s=>s.includes('Roam')));assert.deepEqual(result.charts.drums,charts());
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} actual WAV upload → saved setlist → migrated reopen keeps the corrected chart`,{skip:!privateAudio},async()=>{
 const {audio,samples}=recording(),adapterFile=require.resolve('./upload-flow.test.cjs'),adapterCode=fs.readFileSync(adapterFile,'utf8').split('\ntest(')[0];
 const {setup,until}=new Function('require',adapterCode+'\nreturn {setup,until};')(createRequire(adapterFile));
 const s=require('./helpers/song-storage.cjs').storage({rejectBlobs:true}),app=setup({mobile,audioSamples:samples,uploadBytes:audio,libraryOverrides:s.library});
 await app.nodes.libraryUploadDrums.click();await app.upload('WhereverImayroamdrumsonly.wav');await until(()=>app.nodes.saveStatus.textContent.includes('Added to your setlist'));
 assert.deepEqual(app.requests,['drums']);const saved=await s.library.get(id);assert.equal(digest(saved.charts.drums.expert),digest(charts().expert));assert.equal(saved.quality.scoreReference,'roam');assert.equal(saved.audioBlob.size,audio.length);assert.ok(s.largest<=32768);
 // Simulate a v41 saved automatic chart, then open it with the updated UI.
 await s.library.save({...saved,charts:{...saved.charts,drums:levels()},quality:{},chartVersion:16});
 const fresh=setup({mobile,audioSamples:samples,chartFixture:[],libraryOverrides:s.fresh()});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();await until(()=>fresh.nodes.saveStatus.textContent.includes('Saved'));
 await fresh.radios.difficulty[3].emit('change');assert.match(fresh.nodes.chartSummary.textContent,/Expert.*2051 notes/);assert.equal(fresh.nodes.playButton.disabled,false);assert.deepEqual(fresh.requests,[]);
 const reopened=await s.library.get(id);assert.equal(reopened.quality.scoreRevision,3);assert.equal(digest(reopened.charts.drums.expert),digest(charts().expert));assert.equal(crypto.createHash('sha256').update(Buffer.from(await reopened.audioBlob.arrayBuffer())).digest('hex'),id);
});
test('live matched chart is identical to the current private riffpack on every difficulty',{skip:!process.env.RIFFBOUND_ROAM_BACKUP},async()=>{
 const song=await L.unpack(new Blob([fs.readFileSync(process.env.RIFFBOUND_ROAM_BACKUP)]));assert.equal(song.id,id);const matched=charts();for(const level of ['easy','medium','hard','expert'])assert.deepEqual(comparable(matched[level]),comparable(song.charts.drums[level]));
});
