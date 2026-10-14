const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} timing Apply and Reset work during preview, resume its position, save every difficulty and keep other parts`,async()=>{
 const app=setup({mobile,chartFixture:[{lane:0,time:1,duration:0},{lane:2,time:3,duration:0}]}),n=app.nodes;
 n.chartScope.value='whole';await app.upload();await until(()=>!n.saveCurrentButton.disabled);await n.playPartDrums.click();await until(()=>!n.saveCurrentButton.disabled);
 const old=[...app.savedSongs.values()][0],original=JSON.stringify(old.charts),audio=await old.audioBlob.text();
 n.previewPosition.value='2';await n.previewButton.click();await until(()=>app.sources.length===1);app.tick(.65);assert.equal(n.applySongChartShift.disabled,false);assert.equal(n.reviewSongTiming.disabled,true);
 const previous=app.sources.at(-1),position=2.5;n.songChartShift.value='100';await n.applySongChartShift.click();const fixed=[...app.savedSongs.values()][0];assert.equal(previous.stopped,true);assert.ok(Math.abs(app.sources.at(-1).offset-position)<1e-10);assert.match(n.previewButton.textContent,/Stop preview/);
 assert.equal(fixed.quality.chartAdjustments.drums,100);assert.equal(await fixed.audioBlob.text(),audio);
 for(const level of ['easy','medium','hard','expert'])fixed.charts.drums[level].forEach((hit,i)=>{assert.ok(Math.abs(hit.time-old.charts.drums[level][i].time-.1)<1e-12);assert.equal(hit.lane,old.charts.drums[level][i].lane);});
 for(const part of ['guitar','bass','vocals'])assert.equal(JSON.stringify(fixed.charts[part]),JSON.stringify(old.charts[part]));
 n.songChartShift.value='-2000';const source=app.sources.at(-1);await n.applySongChartShift.click();assert.match(n.songTimingStatus.textContent,/outside the audio/);assert.equal(app.sources.at(-1),source);assert.equal(source.stopped,undefined);
 await n.resetSongChartShift.click();assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),original);assert.equal(n.songChartShift.value,'0');
 await n.previewButton.click();await n.playButton.click();assert.equal(n.applySongChartShift.disabled,true);n.songChartShift.value='100';await n.applySongChartShift.click();assert.equal(JSON.stringify([...app.savedSongs.values()][0].charts),original,'Scored play remains locked');
});
