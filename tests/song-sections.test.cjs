const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const S=require('../dist/song-sections.js'),X=require('../dist/chart-exchange.js'),M=require('../dist/midi-chart.js'),L=require('../dist/song-library.js'),C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs');
const path=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(path,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',prefix+'\nreturn {setup,until};')(createRequire(path));
const text=`[Song]\n{\nName = "Sections"\nResolution = 192\nOffset = 0.25\n}\n[SyncTrack]\n{\n0 = B 120000\n768 = B 60000\n}\n[Events]\n{\n0 = E "section Intro"\n384 = E "section Verse 1"\n768 = E "prc_chorus_1"\n1152 = E "section Verse 2"\n1536 = E "section Guitar Solo"\n}\n[ExpertSingle]\n{\n384 = N 0 0\n768 = N 1 0\n1152 = N 2 0\n1536 = N 3 0\n}\n`;
const chartNotes=[{time:1,lane:0,duration:0},{time:4,lane:1,duration:0},{time:7,lane:2,duration:0},{time:10,lane:3,duration:0}];
async function appFor(extra={}){const app=setup({chartFixture:chartNotes,...extra,browserOverrides:{RiffSongSections:S,...extra.browserOverrides}});await app.radios.difficulty[3].emit('change');await app.upload();return app;}
test('.chart named sections use the exact tempo map, offset and shift, and survive authored export',()=>{
  const parsed=X.parse(text,{shiftMs:100});assert.deepEqual(parsed.timing.sections.map(s=>[s.name,s.time]),[['Intro',.35],['Verse 1',1.35],['chorus 1',2.35],['Verse 2',4.35],['Guitar Solo',6.35]]);
  const record={title:'Sections',instrument:'guitar',bpm:parsed.bpm,beat:parsed.beat,musicEnd:16,charts:X.arrange(parsed,16).charts,quality:{chartTiming:parsed.timing,chartTimings:{guitar:parsed.timing}}},exported=X.parse(X.exportChart(record));
  for(let i=0;i<parsed.timing.sections.length;i++){assert.equal(exported.timing.sections[i].name,parsed.timing.sections[i].name);assert.ok(Math.abs(exported.timing.sections[i].time-parsed.timing.sections[i].time)<.0001);}
  assert.deepEqual(exported.charts.guitar,record.charts.guitar);
});
test('MIDI EVENTS section/prc text and marker events retain their times without importing lyrics as sections',()=>{
  const input=F.midi([{name:'EVENTS',events:[{tick:0,data:F.meta(1,'[section intro]')},{tick:960,data:F.meta(1,'[prc_verse_1]')},{tick:1920,data:F.meta(6,'[section Chorus]')}]},{name:'PART GUITAR',notes:[{tick:960,code:96}]},{name:'PART VOCALS',notes:[{tick:960,code:60}],events:[{tick:960,data:F.meta(5,'verse lyrics')}]}]);
  const parsed=M.parseAll(input,{shiftMs:200});assert.deepEqual(parsed.timing.sections,[{name:'intro',time:.2},{name:'verse 1',time:1.2},{name:'Chorus',time:2.2}]);assert.ok(parsed.charts.vocals);assert.equal(parsed.charts.guitar.expert[0].time,1.2);
});
test('community part filtering retains global section events while rejecting unrelated unsupported notes',()=>{
  const downloaded={data:Buffer.from(text+'\n[ExpertDoubleBass]\n{\n384 = N 7 0\n}\n'),file:{name:'notes.chart'},metadata:{delay:'100'}};
  const parsed=C.parsePart(downloaded,'guitar',F.row);assert.equal(parsed.timing.sections[1].name,'Verse 1');assert.equal(parsed.timing.sections[1].time,1.35);assert.equal(parsed.charts.guitar.expert[0].time,1.35);assert.equal(parsed.charts.bass,undefined);
});
test('verified community recording alignment shifts section boundaries with the notes exactly once',async()=>{
  const network=F.network({container:F.sng(Buffer.from(text),{filename:'notes.chart'})}),result=await C.lookup({filename:'Fixture Artist - Fixture Song.wav',duration:16,parts:['guitar'],requireAudioMatch:true,fetcher:network.fetcher,alignAudio:async()=>({guitar:{status:'aligned',referenceInstrument:'guitar',shiftSeconds:.5}})});
  assert.equal(result.timings.guitar.sections[1].time,1.75);assert.equal(result.charts.guitar.expert[0].time,1.75);
});
test('song-specific section choices respect per-part shifts, saved overrides and generic fallback names',()=>{
  const record={musicEnd:16,beat:.5,practiceSections:[{name:'Verse 1',start:2,end:5}],quality:{chartTimings:{guitar:{sections:[{name:'Intro',time:0},{name:'Verse 1',time:4},{name:'Chorus',time:8}]}},chartAdjustments:{guitar:100}}};
  const result=S.forSong(record,'guitar');assert.equal(result.find(s=>s.name==='Chorus').start,8.1);assert.equal(result.filter(s=>s.name==='Verse 1').length,1);assert.equal(result.find(s=>s.name==='Verse 1').source,'saved');assert.deepEqual(result.find(s=>s.name==='Verse 1'),{name:'Verse 1',start:2,end:5,source:'saved',id:'saved:0'});
  const generic=S.build({duration:65,beat:.5});assert.ok(generic.every(s=>s.name.startsWith('Section ')));assert.equal(generic[0].start,0);assert.equal(generic.at(-1).end,65);assert.ok(generic.every(s=>s.end-s.start>=1));
  assert.equal(S.markerName('[prc_verse_2]'),'verse 2');assert.equal(S.markerName('[music_start]'),null);assert.deepEqual(S.markers([{name:'X',time:Infinity},{name:'Late',time:100},{name:'Intro',time:-.25}],16),[{name:'Intro',time:0}]);
  assert.throws(()=>S.ranges([{name:'Bad',start:3,end:3.5}],16),/one second/);assert.throws(()=>S.ranges([{name:'Bad',start:0,end:18}],16),/inside this song/);
});
test('Practice dropdown fills a named range and plays only that section at the chosen speed',async()=>{
  const app=await appFor({chartResultExtras:{quality:{chartTimings:{guitar:{sections:[{name:'Intro',time:0},{name:'Verse 1',time:3},{name:'Chorus',time:6},{name:'Verse 2',time:9}]}}}}}),n=app.nodes;
  await n.practiceButton.click();const option=n.practiceSection.children.find(o=>o.textContent.startsWith('Verse 1'));assert.ok(option);assert.match(option.textContent,/0:03–0:06 · 1 note/);n.practiceSection.value=option.value;await n.practiceSection.emit('change');assert.equal(n.loopStart.value,'3');assert.equal(n.loopEnd.value,'6');
  n.practiceRate.value='.65';await n.practiceLaunch.click();await until(()=>app.sources.length===1);const source=app.sources.at(-1);assert.equal(source.loopStart,3);assert.equal(source.loopEnd,6);assert.equal(source.offset,3);assert.equal(source.playbackRate.value,.65);assert.equal(n.practiceSectionName.value,'Verse 1');
  await n.retryButton.click();await until(()=>app.sources.length===2);assert.equal(app.sources.at(-1).loopStart,3);assert.equal(app.sources.at(-1).loopEnd,6);
});
test('custom Verse names save to the setlist, reopen, survive both backup formats and can be removed without touching charts/audio',async()=>{
  const app=await appFor(),n=app.nodes;await n.practiceButton.click();assert.match(n.practiceSectionHint.textContent,/no named sections/);const initial=[...app.savedSongs.values()][0],snapshot=JSON.stringify(L.validate(initial).charts),audio=await initial.audioBlob.text();
  for(const [name,start,end] of [['Verse 1',2,5],['Verse 2',6,9]]){n.practiceSectionName.value=name;n.loopStart.value=String(start);n.loopEnd.value=String(end);await n.savePracticeSection.click();assert.match(n.practiceStatus.textContent,/saved with this song/);}
  const saved=[...app.savedSongs.values()][0];assert.deepEqual(saved.practiceSections,[{name:'Verse 1',start:2,end:5},{name:'Verse 2',start:6,end:9}]);assert.equal(JSON.stringify(L.validate(saved).charts),snapshot);assert.equal(await saved.audioBlob.text(),audio);
  for(const background of [null,{file:new Blob(['video'],{type:'video/mp4'}),name:'play.mp4',mode:'video',offset:1,dim:35}]){const restored=await L.unpack(L.pack(saved,{background}));assert.deepEqual(restored.practiceSections,saved.practiceSections);}
  const fresh=setup({savedSongs:app.savedSongs,browserOverrides:{RiffSongSections:S}});await until(()=>fresh.nodes.setlistEntries.children.some(row=>row.dataset.songId===saved.id));await fresh.nodes.setlistEntries.children.find(row=>row.dataset.songId===saved.id).click();await fresh.nodes.practiceButton.click();const picker=fresh.nodes.practiceSection,verse=picker.children.find(o=>o.textContent.startsWith('Verse 2'));assert.ok(verse);picker.value=verse.value;await picker.emit('change');assert.equal(fresh.nodes.loopStart.value,'6');await fresh.nodes.removePracticeSection.click();assert.deepEqual(app.savedSongs.get(saved.id).practiceSections,[{name:'Verse 1',start:2,end:5}]);assert.equal(JSON.stringify(L.validate(app.savedSongs.get(saved.id)).charts),snapshot);
});
test('manual ranges switch the selector to Custom; invalid ranges never write and storage failure stays explicit',async()=>{
  const app=await appFor(),n=app.nodes;await n.practiceButton.click();n.practiceSection.value='whole';await n.practiceSection.emit('change');assert.equal(n.loopEnd.value,'16');n.loopStart.value='2';await n.loopStart.emit('input');assert.equal(n.practiceSection.value,'custom');
  n.practiceSectionName.value='Invalid';n.loopEnd.value='2.5';await n.savePracticeSection.click();assert.match(n.practiceStatus.textContent,/one second/);assert.deepEqual([...app.savedSongs.values()][0].practiceSections,[]);
  const failed=await appFor({storageFailure:true});await failed.nodes.practiceButton.click();failed.nodes.practiceSectionName.value='Verse 1';failed.nodes.loopStart.value='2';failed.nodes.loopEnd.value='5';await failed.nodes.savePracticeSection.click();assert.match(failed.nodes.practiceStatus.textContent,/kept for this session/);assert.equal(failed.savedSongs.size,0);
});
test('named ranges persist through the real chunk storage path and fresh connection',async()=>{
  const {storage}=require('./helpers/song-storage.cjs'),disk=storage({rejectBlobs:true}),parsed=X.parse(text),song={id:'a'.repeat(64),title:'Sections',instrument:'guitar',musicEnd:16,bpm:parsed.bpm,beat:parsed.beat,charts:X.arrange(parsed,16).charts,quality:{chartTimings:{guitar:parsed.timing}},audioBlob:new Blob(['audio']),practiceSections:[{name:'Verse 1',start:2,end:5}]};
  await disk.library.save(song);const restored=await disk.fresh().get(song.id);assert.deepEqual(JSON.parse(JSON.stringify(restored.practiceSections)),song.practiceSections);assert.deepEqual(S.forSong(restored,'guitar').find(s=>s.source==='saved'),{id:'saved:0',source:'saved',name:'Verse 1',start:2,end:5});assert.equal(await restored.audioBlob.text(),'audio');
});
