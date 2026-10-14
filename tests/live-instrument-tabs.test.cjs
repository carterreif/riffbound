const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const E=require('../dist/engine.js'),D=E.Difficulties;
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
const radio=(app,group,part)=>app.radios[group].find(r=>r.value===part);
for(const mobile of [false,true])for(const group of ['instrument','chartTarget'])test(`${mobile?'mobile':'desktop'} Track 1 playing Guitar switches to Drums and back from ${group} tabs`,async()=>{
 const app=setup({mobile,chartFixture:[]}),n=app.nodes;
 await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');
 const original=app.sources.at(-1);app.tick(original.when+3);
 assert.equal(n[group==='instrument'?'instrumentGroup':'chartTargetGroup'].disabled,false,'Playable tabs must stay available during the demo');
 await radio(app,group,'drums').emit('change');await until(()=>n.playText.textContent==='RESTART TRACK');
 assert.equal(original.stopped,true);assert.equal(radio(app,'instrument','drums').checked,true);assert.equal(app.body.classList.contains('is-drums'),true);assert.equal(n.controlType.textContent,'Pads');assert.equal(n.kickButton.hidden,false);
 const drums=app.sources.at(-1);assert.equal(drums.buffer,original.buffer);assert.equal(drums.offset,0);app.tick(drums.when);
 assert.equal(n.score.textContent,'000,000');await app.key('keydown','Space');await app.key('keyup','Space');app.tick(drums.when+.11);assert.equal(n.score.textContent,'000,100');
 await radio(app,group,'guitar').emit('change');await until(()=>n.playText.textContent==='RESTART TRACK');
 assert.equal(drums.stopped,true);assert.equal(radio(app,'instrument','guitar').checked,true);assert.equal(app.body.classList.contains('is-drums'),false);assert.equal(n.kickButton.hidden,true);assert.equal(n.score.textContent,'000,000');
 assert.deepEqual(app.requests,[]);assert.equal(app.savedSongs.size,0);assert.equal(app.writes.filter(([key])=>key.includes('best')).length,0);
 await n.mobileBackButton.click();
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} Track 1 paused on Guitar can select Drums before starting a new run`,async()=>{
 const app=setup({mobile,chartFixture:[]}),n=app.nodes;await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');app.tick(app.sources.at(-1).when+3);await n.pauseButton.click();
 const count=app.sources.length;assert.equal(n.instrumentGroup.disabled,false);await radio(app,'instrument','drums').emit('change');assert.equal(app.body.classList.contains('is-drums'),true);assert.equal(n.playText.textContent,'PLAY TRACK');assert.equal(app.sources.length,count);
 await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');assert.equal(app.sources.at(-1).offset,0);await n.mobileBackButton.click();
});
test('switching uploaded charts during scored play restarts the selected part without borrowing notes or carrying its score',async()=>{
 const fixture=part=>D.build([{lane:part==='drums'?5:0,time:1,duration:0}],part,.5),app=setup({chartFixture:fixture}),n=app.nodes;n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);
 const before=JSON.stringify([...app.savedSongs.values()][0].charts);await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const first=app.sources.at(-1);app.tick(first.when+1);await app.key('keydown','KeyD');await app.key('keyup','KeyD');app.tick(first.when+1.11);assert.equal(n.score.textContent,'000,100');
 await n.playPartDrums.click();await until(()=>n.playText.textContent==='RESTART TRACK');assert.equal(first.stopped,true);assert.equal(app.body.classList.contains('is-drums'),true);assert.equal(app.sources.at(-1).offset,0);assert.equal(n.score.textContent,'000,000');
 const next=app.sources.at(-1);app.tick(next.when+1);await app.key('keydown','Space');await app.key('keyup','Space');app.tick(next.when+1.11);assert.equal(n.score.textContent,'000,100');assert.equal(app.requests.length,4);assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),before);await n.mobileBackButton.click();
});
test('selecting the active part keeps its run; unavailable live parts stay disabled and cannot borrow a chart',async()=>{
 const fixture=D.build([{lane:0,time:1,duration:0}],'guitar',.5),app=setup({chartFixture:fixture}),n=app.nodes;await app.upload();await until(()=>!n.saveCurrentButton.disabled);await n.playButton.click();await until(()=>n.playText.textContent==='RESTART TRACK');const original=app.sources.at(-1),count=app.sources.length,jobs=app.requests.length;
 await radio(app,'instrument','guitar').emit('change');assert.equal(app.sources.length,count);assert.equal(original.stopped,undefined);
 assert.equal(radio(app,'instrument','drums').disabled,true);assert.equal(n.playPartDrums.disabled,true);
 await radio(app,'chartTarget','drums').emit('change');assert.equal(radio(app,'chartTarget','drums').checked,true);assert.equal(app.body.classList.contains('is-drums'),false);assert.equal(app.sources.length,count);assert.equal(app.requests.length,jobs);
 await n.mobileBackButton.click();
});
