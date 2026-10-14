const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const E=require('../dist/engine.js'),D=E.Difficulties,parts=['guitar','drums','bass','vocals'],name=p=>p[0].toUpperCase()+p.slice(1);
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const fixture=part=>D.build([{time:1+parts.indexOf(part)*.4,lane:parts.indexOf(part),pitch:part==='bass'?35:64,duration:0}],part,.5);
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} full upload exposes and scores every instrument at every difficulty`,async()=>{
 const app=setup({mobile,chartFixture:fixture}),n=app.nodes;n.chartScope.value='whole';await app.upload('Full recording.wav');await until(()=>!n.saveCurrentButton.disabled);
 assert.equal(n.playParts.hidden,false);assert.deepEqual(app.requests,parts);
 const saved=[...app.savedSongs.values()][0],original=JSON.stringify(saved.charts);
 for(const part of parts)for(const level of D.LEVELS){
  const button=n['playPart'+name(part)];assert.equal(button.disabled,false);await button.click();
  await app.radios.difficulty.find(r=>r.value===level).emit('change');
  assert.equal(button['aria-pressed'],'true');assert.match(n.playPartStatus.textContent,new RegExp(name(part)+' · '+D.NAMES[level]));
  assert.match(n.chartSummary.textContent,new RegExp(name(part)));assert.match(n['playPart'+name(part)+'Count'].textContent,new RegExp(D.NAMES[level]));
  await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');
  assert.equal(button.disabled,false,'Playable part choices remain available during scored play');const start=app.sources.at(-1).when;
  for(const note of saved.charts[part][level]){app.tick(start+note.time);await app.key('keydown',E.KEYS[note.lane]);await app.key('keyup',E.KEYS[note.lane]);}
  app.tick(start+18);assert.match(n.resultNotes.textContent,/1 of 1 notes hit/);assert.match(n.resultNotes.textContent,new RegExp(D.NAMES[level]));
  await n.mobileBackButton.click();
 }
 assert.equal(app.requests.length,4);assert.equal(app.decodes,1);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),original);
 const fresh=setup({mobile,chartFixture:[],savedSongs:app.savedSongs});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();
 for(const part of parts){const button=fresh.nodes['playPart'+name(part)];assert.equal(button.disabled,false);await button.click();assert.equal(button['aria-pressed'],'true');assert.match(fresh.nodes.chartSummary.textContent,new RegExp(name(part)));}
 assert.deepEqual(fresh.requests,[]);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} full-chart preview switches all four parts at the same song position`,async()=>{
 const app=setup({mobile,chartFixture:fixture}),n=app.nodes;n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
 app.tick(app.sources.at(-1).when+3);assert.equal(n.instrumentGroup.disabled,false);let position=3;
 for(const part of ['drums','bass','vocals','guitar']){
  const old=app.sources.at(-1),count=app.sources.length;
  // Both controls use the same switching path; the stage selector is the
  // visible control inside the mobile preview layout.
  if(part==='drums')await n.playPartDrums.click();else await app.radios.instrument.find(r=>r.value===part).emit('change');
  await until(()=>app.sources.length===count+1&&n.previewButton.textContent.includes('Stop'));
  assert.equal(old.stopped,true);const source=app.sources.at(-1);assert.ok(Math.abs(source.offset-position)<.03,`${part}: expected ${position}, got ${source.offset}`);
  assert.equal(n['playPart'+name(part)]['aria-pressed'],'true');assert.match(n.chartSummary.textContent,new RegExp(name(part)));
  assert.equal(app.body.classList.contains('is-drums'),part==='drums');
  assert.equal(n.controlType.textContent,part==='drums'?'Pads':part==='vocals'?'Pitch pads':'Frets');
  assert.equal(n.instrumentGroup.disabled,false);app.tick(source.when+.05);position+=.05;
 }
 assert.equal(app.requests.length,4);assert.equal(app.decodes,1);assert.equal(n.resultDialog.open,false);
 assert.equal(app.writes.filter(([key])=>key.includes('best')).length,0);
 await n.mobileBackButton.click();assert.equal(n.playPartGuitar.disabled,false);
});
test('a missing full-chart part is shown as unavailable without substituting another instrument',async()=>{
 const app=setup({mobile:true,chartFixture:fixture,chartFailures:{vocals:'No clear vocal melody detected'}}),n=app.nodes;
 n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 assert.equal(n.playPartVocals.disabled,true);assert.equal(n.playPartVocalsCount.textContent,'No chart');assert.match(n.playPartStatus.textContent,/No playable chart for Vocals/);
 const requests=app.requests.length;await n.playPartVocals.click();assert.equal(app.requests.length,requests);assert.match(n.chartSummary.textContent,/Guitar/);
 await n.playPartDrums.click();await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
 assert.equal(app.radios.instrument.find(r=>r.value==='vocals').disabled,true);assert.equal(app.radios.instrument.find(r=>r.value==='bass').disabled,false);
 await n.mobileBackButton.click();
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} Auto Chart Drums selection switches the existing highway and scores Drum notes`,async()=>{
 const app=setup({mobile,chartFixture:fixture}),n=app.nodes;
 n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 const saved=[...app.savedSongs.values()][0],original=JSON.stringify(saved.charts);
 n.chartScope.value='single';await n.chartScope.emit('change');
 const drums=app.radios.chartTarget.find(r=>r.value==='drums');await drums.emit('change');
 assert.equal(app.radios.instrument.find(r=>r.value==='drums').checked,true);
 assert.equal(n.playPartDrums['aria-pressed'],'true');assert.equal(app.body.classList.contains('is-drums'),true);
 assert.match(n.chartSummary.textContent,/Drums/);assert.match(n.uploadButton.textContent,/Drums/);
 await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const start=app.sources.at(-1).when;
 for(const note of saved.charts.drums.medium){app.tick(start+note.time);await app.key('keydown',E.KEYS[note.lane]);await app.key('keyup',E.KEYS[note.lane]);}
 app.tick(start+18);assert.match(n.resultNotes.textContent,/1 of 1 notes hit/);
 await n.mobileBackButton.click();await n.playPartGuitar.click();
 assert.equal(drums.checked,true,'Next upload retains explicit Drums');
 await drums.click();assert.equal(n.playPartDrums['aria-pressed'],'true','Clicking an already selected upload target also switches playback');
 assert.equal(app.requests.length,4);assert.equal(app.decodes,1);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),original);
 await until(()=>!n.saveCurrentButton.disabled);await n.uploadButton.click();await app.upload('Next Drums.wav',9);
 assert.equal(app.requests.at(-1),'drums');assert.deepEqual(Object.keys([...app.savedSongs.values()].find(s=>s.filename==='Next Drums.wav').charts),['drums']);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} Auto Chart instrument selection switches an existing live preview at the same position`,async()=>{
 const app=setup({mobile,chartFixture:fixture}),n=app.nodes;n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 n.chartScope.value='single';await n.chartScope.emit('change');await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));
 app.tick(app.sources.at(-1).when+3);assert.equal(n.chartTargetGroup.disabled,false);
 const previous=app.sources.at(-1);await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');
 assert.equal(previous.stopped,true);assert.ok(Math.abs(app.sources.at(-1).offset-3)<.03);
 assert.equal(n.playPartDrums['aria-pressed'],'true');assert.equal(app.body.classList.contains('is-drums'),true);
 assert.equal(app.requests.length,4);assert.equal(app.decodes,1);await n.mobileBackButton.click();
});
test('Add song instrument choice does not switch or save an already open full chart',async()=>{
 let saves=0;const L=require('../dist/song-library.js'),savedSongs=new Map();
 const app=setup({chartFixture:fixture,savedSongs,libraryOverrides:{save:async song=>{saves++;savedSongs.set(song.id,{...L.metadata(song),audioBlob:song.audioBlob});}}}),n=app.nodes;
 n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 const old=[...savedSongs.values()][0],before=saves;n.chartScope.value='single';
 await n.addSongButton.click();n.addSongPart.value='drums';n.addSongFile.files=[{name:'New Drums.wav',size:4,arrayBuffer:async()=>new Uint8Array([9,8,7,6]).buffer}];
 await n.confirmAddSong.click();await until(()=>!n.saveCurrentButton.disabled);
 assert.equal(saves,before+1);assert.equal(savedSongs.get(old.id).instrument,'guitar');assert.equal(savedSongs.size,2);
 assert.deepEqual(app.requests,['guitar','drums','bass','vocals','drums']);
});
