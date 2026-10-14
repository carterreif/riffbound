const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module'),crypto=require('node:crypto');
const R=require('../dist/reference-charts.js'),U=require('../dist/reference-updates.js'),A=require('../dist/autochart.js'),E=require('../dist/engine.js'),L=require('../dist/song-library.js');
const id='b6c80b6694186a1f820f7bdd610a4c41bae0c2437e1f6acfe2e67fb312b42cdd',musicEnd=261.66857142857145;
const reference=()=>R.match(id,musicEnd),charts=()=>A.buildMatchedCharts(reference(),musicEnd).drums;
test('Hero reference selects only the verified studio recording and returns independent data',()=>{
 assert.equal(R.match('Hero of the Day',musicEnd),null);assert.equal(R.match('f'.repeat(64),musicEnd),null);assert.equal(R.match(id,musicEnd+1),null);
 const r=reference();assert.match(r.label,/SingeMFRC.*Drums/);assert.equal(r.offset,-20634/22050);
 r.events[0].lane=99;r.authoredQuality.chartTimings.drums.tempos[0].bpm=99;
 assert.equal(reference().events[0].lane,3);assert.equal(reference().authoredQuality.chartTimings.drums.tempos[0].bpm,122.5);
});
test('Expert retains the authored drum hits and separately mapped tom, floor, hat, cymbal, snare and kick voices',()=>{
 const c=charts(),offset=reference().offset;assert.equal(c.expert.length,1447);assert.deepEqual(Array.from({length:6},(_,l)=>c.expert.filter(n=>n.lane===l).length),[335,297,49,384,25,357]);
 const at=(t,lanes)=>assert.deepEqual(c.expert.filter(n=>Math.abs(n.time-(t+offset))<.000001).map(n=>n.lane),lanes);
 at(11.791864945565568,[3]);at(17.534150183263648,[0,4]);at(19.962251287766623,[3,5]);at(21.083746614869426,[0,3]);
 assert.ok(reference().authoredQuality.chartTimings.drums.tempos.length>30);assert.equal(reference().authoredQuality.audioReviews.drums.coalescedSamePadHeads,2);
});
test('all four arrangements are playable subsets with the original authored times and colors',()=>{
 const c=charts(),key=n=>n.lane+':'+n.time;
 for(const [lo,hi] of [['easy','medium'],['medium','hard'],['hard','expert']]){const keys=new Set(c[hi].map(key));assert.ok(c[lo].length<c[hi].length);assert.ok(c[lo].every(n=>keys.has(key(n))));}
 assert.deepEqual(c.normal,c.medium);
 for(const [level,notes] of Object.entries(c)){const session=new E.Session(level,'tap','drums',{notes,musicEnd});for(const n of notes){session.update(n.time,new Set());session.tap(n.lane,n.time);}session.update(musicEnd,new Set());assert.equal(session.hits,notes.length);assert.equal(session.misses,0);}
});
test('existing estimate is replaced once; audio, guitar and its tempo map remain intact',()=>{
 const guitar={expert:[{lane:2,time:5,duration:0}]},guitarTiming={resolution:192,offset:.2,tempos:[{tick:0,bpm:120}]};
 const original={id,musicEnd,bpm:120,beat:.5,offset:.3483,audioBlob:new Blob(['original']),charts:{guitar,drums:{easy:[],medium:[],normal:[{lane:1,time:1,duration:0}],hard:[],expert:[]}},quality:{imports:{guitar:{id:'authored'}},chartTimings:{guitar:guitarTiming},audioReviews:{guitar:{estimated:true}}}};
 const changed=U.upgrade(original);assert.deepEqual(changed.charts.drums,charts());assert.equal(changed.charts.guitar,guitar);assert.equal(changed.audioBlob,original.audioBlob);assert.equal(changed.bpm,120);assert.equal(changed.offset,original.offset);
 assert.equal(changed.quality.chartTimings.guitar,guitarTiming);assert.equal(changed.quality.imports.guitar,original.quality.imports.guitar);assert.equal(changed.quality.audioReviews.guitar,original.quality.audioReviews.guitar);
 assert.equal(changed.quality.audioReviews.drums.estimated,false);assert.equal(changed.quality.imports.drums.id,reference().currentImport.id);assert.equal(U.upgrade(changed),changed);
 for(const modify of [s=>s.id='e'.repeat(64),s=>s.quality.imports.drums={id:'player-authored'},s=>s.quality.chartAdjustments={drums:50},s=>s.musicEnd+=1]){const s=structuredClone({...original,audioBlob:null});modify(s);assert.equal(U.upgrade(s),s);}
});
test('authored Hero reference is loaded by page, worker and offline package',()=>{
 const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8'),worker=fs.readFileSync(require.resolve('../dist/reference-charts.js'),'utf8'),offline=fs.readFileSync(require.resolve('../dist/offline-assets.js'),'utf8');
 assert.ok(html.indexOf('src="hero-reference.js"')<html.indexOf('src="reference-charts.js"'));assert.match(worker,/importScripts\('hero-reference\.js'\)/);assert.match(offline,/'hero-reference\.js'/);
});
const adapterFile=require.resolve('./upload-flow.test.cjs'),adapterCode=fs.readFileSync(adapterFile,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',adapterCode+'\nreturn {setup,until};')(createRequire(adapterFile));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} whole-song upload retains the independent authored Drum import and timing metadata`,async()=>{
 const r=reference(),c=charts(),app=setup({mobile,chartFixture:part=>part==='drums'?c:{expert:[{lane:0,time:1,duration:0}],hard:[],medium:[],easy:[]},chartResultExtras:part=>({quality:part==='drums'?{...r.authoredQuality,scoreRevision:r.revision,scoreReference:r.scoreReference,scoreReview:r.review,preserveEasyMedium:false}:{} })});
 app.nodes.chartScope.value='whole';await app.nodes.chartScope.emit('change');await app.upload('Whole recording.wav');await until(()=>app.savedSongs.size===1);
 const saved=[...app.savedSongs.values()][0];assert.equal(saved.quality.imports.drums.id,r.currentImport.id);assert.deepEqual(saved.quality.chartTimings.drums,r.authoredQuality.chartTimings.drums);assert.equal(saved.quality.communityReferences.drums.charter,'SingeMFRC');assert.equal(saved.quality.audioReviews.drums.estimated,false);assert.equal(saved.quality.scoreRevision,67);
});
const comparable=c=>Object.fromEntries(Object.entries(c).map(([level,notes])=>[level,notes.map(({lane,time,duration})=>({lane,time,duration}))]));
const media=Boolean(process.env.RIFFBOUND_HERO_AUDIO&&process.env.RIFFBOUND_HERO_PCM);
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} actual Hero audio upload saves the authored drums and reopens without guitar analysis`,{skip:!media},async()=>{
 const audio=fs.readFileSync(process.env.RIFFBOUND_HERO_AUDIO),raw=fs.readFileSync(process.env.RIFFBOUND_HERO_PCM),samples=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4);assert.equal(crypto.createHash('sha256').update(audio).digest('hex'),id);
 const app=setup({mobile,uploadBytes:audio,audioSamples:samples});await app.nodes.libraryUploadDrums.click();await app.upload('06 Track 6.mp3');await until(()=>app.savedSongs.size===1);
 const saved=[...app.savedSongs.values()][0];assert.deepEqual(app.requests,['drums']);assert.deepEqual(JSON.parse(JSON.stringify(saved.charts.drums)),charts());assert.equal(saved.quality.imports.drums.id,reference().currentImport.id);assert.equal(saved.quality.audioReviews.drums.estimated,false);assert.equal(saved.quality.scoreRevision,67);
 const restored=await L.unpack(L.pack(saved));assert.deepEqual(comparable(restored.charts.drums),comparable(charts()));assert.equal(crypto.createHash('sha256').update(Buffer.from(await restored.audioBlob.arrayBuffer())).digest('hex'),id);
 app.savedSongs.set(id,{...saved,charts:{drums:{expert:[{lane:2,time:1,duration:0}],hard:[],medium:[],easy:[],normal:[]},guitar:{expert:[{lane:1,time:5,duration:0}],hard:[],medium:[],easy:[]}},quality:{}});
 const fresh=setup({mobile,audioSamples:samples,savedSongs:app.savedSongs,chartFixture:[]});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();assert.deepEqual(fresh.requests,[]);await fresh.radios.difficulty[3].emit('change');assert.match(fresh.nodes.chartSummary.textContent,/Expert.*1447 notes/);await until(()=>app.savedSongs.get(id).quality.scoreRevision===67);assert.deepEqual(comparable(app.savedSongs.get(id).charts.drums),comparable(charts()));assert.equal(app.savedSongs.get(id).charts.guitar.expert[0].lane,1);
});
