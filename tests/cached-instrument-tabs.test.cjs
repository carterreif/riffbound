const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const D=require('../dist/chart-difficulties.js');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const fixture=part=>D.build([{lane:part==='drums'?5:0,time:1,duration:0},{lane:part==='drums'?0:2,time:2,duration:0}],part,.5);
for(const mobile of [false,true])for(const missingControls of [[],['repairDrumsButton','drumRepairTools']]){
 const page=missingControls.length?'cached page without repair controls':'current page';
 test(`${mobile?'mobile':'desktop'} ${page}: Guitar and Drums tabs switch the built-in demo`,async()=>{
  const app=setup({mobile,chartFixture:fixture,missingControls}),n=app.nodes;
  await app.radios.instrument.find(r=>r.value==='drums').emit('change');
  assert.equal(app.body.classList.contains('is-drums'),true);assert.equal(n.controlType.textContent,'Pads');assert.equal(n.kickButton.hidden,false);
  await app.radios.instrument.find(r=>r.value==='guitar').emit('change');
  assert.equal(app.body.classList.contains('is-drums'),false);assert.equal(n.controlType.textContent,'Frets');assert.equal(n.kickButton.hidden,true);
  await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');assert.equal(app.body.classList.contains('is-drums'),true);
  await app.radios.chartTarget.find(r=>r.value==='guitar').emit('change');assert.equal(app.body.classList.contains('is-drums'),false);
  assert.deepEqual(app.requests,[]);
 });
 test(`${mobile?'mobile':'desktop'} ${page}: uploaded and reopened songs switch Guitar/Drums through both tab rows and preview`,async()=>{
  const app=setup({mobile,chartFixture:fixture,missingControls}),n=app.nodes;n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
  const before=JSON.stringify([...app.savedSongs.values()][0].charts);n.chartScope.value='single';await n.chartScope.emit('change');
  for(const group of ['chartTarget','instrument'])for(const part of ['drums','guitar']){
   await app.radios[group].find(r=>r.value===part).emit('change');
   assert.equal(app.radios.instrument.find(r=>r.value===part).checked,true);assert.equal(app.body.classList.contains('is-drums'),part==='drums');assert.match(n.chartSummary.textContent,new RegExp(part,'i'));
  }
  await n.previewButton.click();await until(()=>n.previewButton.textContent.includes('Stop'));app.tick(app.sources.at(-1).when+3);
  for(const [group,part] of [['instrument','drums'],['chartTarget','guitar']]){
   const previous=app.sources.at(-1);await app.radios[group].find(r=>r.value===part).emit('change');
   assert.equal(previous.stopped,true);assert.ok(Math.abs(app.sources.at(-1).offset-3)<.03);assert.equal(app.body.classList.contains('is-drums'),part==='drums');
   app.tick(app.sources.at(-1).when);
  }
  await n.mobileBackButton.click();await until(()=>!n.saveCurrentButton.disabled);
  assert.equal(app.requests.length,4);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),before);
  const fresh=setup({mobile,chartFixture:fixture,missingControls,savedSongs:app.savedSongs});await until(()=>fresh.nodes.setlistEntries.children.length===2);await fresh.nodes.setlistEntries.children[1].click();
  for(const part of ['drums','guitar']){await fresh.radios.instrument.find(r=>r.value===part).emit('change');assert.equal(fresh.body.classList.contains('is-drums'),part==='drums');}
  assert.deepEqual(fresh.requests,[]);
 });
}
