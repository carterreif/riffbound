const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const T=require('../dist/track-two-reference.js'),R=require('../dist/reference-charts.js'),U=require('../dist/reference-updates.js'),A=require('../dist/autochart.js'),L=require('../dist/song-library.js'),E=require('../dist/engine.js');
const id='199a00fc424021a9e6a7841b15c1242b9e03f32e625214d43ea300009f62094e',duration=328.1240816326531;
const reference=()=>R.match(id,duration),charts=()=>A.buildMatchedCharts(reference(),duration).drums;
test('Track 2 requires exact recording bytes and duration; review remains labeled estimated',()=>{
 for(const [hash,seconds] of [['2 X 4',duration],['e'.repeat(64),duration],[id,duration+1]])assert.equal(T.match(hash,seconds),null);
 const a=reference();assert.equal(a.authoredQuality.audioReviews.drums.estimated,true);assert.equal(a.events.length,1915);
 a.events[0].lane=99;assert.equal(reference().events[0].lane,0);
});
test('inspected isolated opening has red rolls, blue rack strokes, green floor and no phantom metals or kick',()=>{
 const notes=charts().expert,intro=notes.filter(n=>n.time<4.90);
 assert.equal(intro.length,21);assert.ok(intro.every(n=>[0,2,4].includes(n.lane)));
 for(const time of [.632,.828,.975,1.146,1.669,1.852,2.007,2.196,2.721,2.9,3.067,3.259,3.805])assert.ok(intro.some(n=>n.lane===0&&Math.abs(n.time-time)<.002));
 for(const time of [1.325,1.494,2.38,2.53,3.434,3.585,4.211])assert.ok(intro.some(n=>n.lane===2&&Math.abs(n.time-time)<.002));
 assert.ok(intro.some(n=>n.lane===4&&Math.abs(n.time-4.593)<.002));
});
test('four difficulties keep accepted times, colors, dynamics and independent pad/kick play',()=>{
 const c=charts(),key=n=>n.lane+':'+n.time;
 for(const [lo,hi] of [['easy','medium'],['medium','hard'],['hard','expert']]){const keys=new Set(c[hi].map(key));assert.ok(c[lo].length<c[hi].length);assert.ok(c[lo].every(n=>keys.has(key(n))));}
 assert.deepEqual(c.normal,c.medium);assert.ok(c.expert.some(n=>n.ghost));
 for(const [level,notes] of Object.entries(c)){const session=new E.Session(level,'tap','drums',{notes,musicEnd:duration});for(const n of notes){session.update(n.time,new Set());session.tap(n.lane,n.time);}session.update(duration,new Set());assert.equal(session.hits,notes.length);assert.equal(session.misses,0);}
});
test('Track 2 is loaded by page, analysis worker and offline cache',()=>{
 const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8'),worker=fs.readFileSync(require.resolve('../dist/reference-charts.js'),'utf8'),offline=fs.readFileSync(require.resolve('../dist/offline-assets.js'),'utf8');
 assert.ok(html.indexOf('src="track-two-reference.js"')<html.indexOf('src="reference-charts.js"'));assert.match(worker,/importScripts\('track-two-reference\.js'\)/);assert.match(offline,/'track-two-reference\.js'/);
});
const supplied=process.env.RIFFBOUND_TRACK_TWO_BACKUP;
test('actual backup upgrades only unedited Drums, keeps audio and other parts, round-trips and refuses user edits',{skip:!supplied},async()=>{
 const original=await L.unpack(new Blob([fs.readFileSync(supplied)]));assert.equal(crypto.createHash('sha256').update(Buffer.from(await original.audioBlob.arrayBuffer())).digest('hex'),id);
 const peers={guitar:{expert:[{lane:1,time:7,duration:0}]},bass:{expert:[{lane:2,time:9,duration:0}]},vocals:{expert:[{lane:3,time:11,duration:0}]}};
 const withPeers={...original,charts:{...original.charts,...peers},quality:{...original.quality,chartTimings:{guitar:{offset:.25}},audioReviews:{...original.quality.audioReviews,bass:{estimated:false}}}};
 const changed=U.upgrade(withPeers);assert.notEqual(changed,withPeers);assert.deepEqual(changed.charts.drums,charts());assert.equal(changed.audioBlob,withPeers.audioBlob);assert.equal(changed.quality.chartTimings.guitar,withPeers.quality.chartTimings.guitar);assert.equal(changed.quality.audioReviews.bass,withPeers.quality.audioReviews.bass);
 for(const part of Object.keys(peers))assert.equal(changed.charts[part],peers[part]);assert.equal(U.upgrade(changed),changed);
 for(const edit of [s=>s.charts.drums.expert[0].time+=.01,s=>s.charts.drums.easy[0].lane=3,s=>s.quality.chartAdjustments.drums=50,s=>s.quality.imports.drums={id:'player-chart'},s=>s.musicEnd+=1]){const s=structuredClone({...original,audioBlob:null});edit(s);assert.equal(U.upgrade(s),s);}
 const restored=await L.unpack(L.pack(U.upgrade(original)));assert.equal(crypto.createHash('sha256').update(Buffer.from(await restored.audioBlob.arrayBuffer())).digest('hex'),id);assert.deepEqual(restored.charts.drums.expert.map(n=>[n.lane,n.time,n.duration,n.velocity,n.ghost]),charts().expert.map(n=>[n.lane,n.time,n.duration,n.velocity,n.ghost]));
});
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const media=Boolean(process.env.RIFFBOUND_TRACK_TWO_AUDIO&&process.env.RIFFBOUND_TRACK_TWO_PCM);
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} opening the saved baseline applies and persists the guarded review`,{skip:!supplied||!media},async()=>{
 const pcm=fs.readFileSync(process.env.RIFFBOUND_TRACK_TWO_PCM),samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);
 const original=await L.unpack(new Blob([fs.readFileSync(supplied)])),savedSongs=new Map([[id,original]]),app=setup({mobile,savedSongs,chartFixture:[],audioSamples:samples});
 await until(()=>app.nodes.setlistEntries.children.length===2);await app.nodes.setlistEntries.children[1].click();await until(()=>savedSongs.get(id).quality.scoreRevision===1);
 const saved=savedSongs.get(id);assert.deepEqual(app.requests,[]);assert.deepEqual(saved.charts.drums,charts());assert.equal(crypto.createHash('sha256').update(Buffer.from(await saved.audioBlob.arrayBuffer())).digest('hex'),id);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} actual Track 2 upload saves only reviewed Drums`,{skip:!media},async()=>{
 const bytes=fs.readFileSync(process.env.RIFFBOUND_TRACK_TWO_AUDIO),pcm=fs.readFileSync(process.env.RIFFBOUND_TRACK_TWO_PCM),samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4),app=setup({mobile,uploadBytes:bytes,audioSamples:samples});
 await app.nodes.libraryUploadDrums.click();await app.upload('02 Track 2.mp3');await until(()=>app.savedSongs.size===1);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(app.requests,['drums']);assert.deepEqual(Object.keys(saved.charts),['drums']);assert.deepEqual(JSON.parse(JSON.stringify(saved.charts.drums)),charts());assert.equal(saved.quality.audioReviews.drums.estimated,true);
 assert.match(app.nodes.chartDetails.textContent,/Reviewed audio estimate/);assert.doesNotMatch(app.nodes.chartDetails.textContent,/Authored source loaded/);
});
