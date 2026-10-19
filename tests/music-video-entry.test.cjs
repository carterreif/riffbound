const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const file=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0];
const {setup,until}=new Function('require',prefix+'\nreturn {setup,until};')(createRequire(file));
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} chart completion offers the song video without interrupting playback setup`,async()=>{
 let frames=0;const app=setup({mobile,browserOverrides:{RiffBackground:{selectSong:async()=>{},showTimingFrame:()=>frames++,pause:()=>{}}}}),n=app.nodes;
 assert.equal(n.chartMusicVideo.hidden,true);
 await app.upload('Nine Inch Nails - Wish.wav');await until(()=>app.savedSongs.size===1&&!n.chartMusicVideo.disabled);
 assert.equal(n.chartMusicVideo.hidden,false);assert.equal(n.chartMusicVideoHint.hidden,false);
 assert.match(decodeURIComponent(n.backgroundFindMusicVideo.href),/Nine Inch Nails.*Wish.*official music video/);
 assert.equal(n.backgroundDialog.open,false);
 await n.chartMusicVideo.click();assert.equal(n.backgroundDialog.open,true);assert.equal(frames,1);
 assert.equal(app.savedSongs.size,1);
});
