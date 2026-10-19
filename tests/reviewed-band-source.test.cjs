const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const W=require('../dist/reviewed-band-source.js'),C=require('../dist/community-charts.js'),A=require('../dist/song-audio.js');
const source=W.rows()[0];
test('reviewed Wasteland source advertises separate authored arrangements and rejects other identities',async()=>{
 assert.equal(source.artist,'10 Years');assert.equal(source.name,'Wasteland');assert.equal(source.notesData.noteCounts.find(n=>n.instrument==='drums'&&n.difficulty==='expert').count,1239);
 assert.ok(W.has(source.md5));assert.equal(W.has('x'),false);assert.equal(W.owns({...source}),false);assert.match(W.sourceUrl(source.md5),/^https:\/\/rhythmverse.co\/songfile\//);
 await assert.rejects(W.openFile(new Blob([new Uint8Array(10)])),/original Wasteland/);
 await assert.rejects(W.openFile(new Blob([new Uint8Array(19738624)])),/not the reviewed/);
 await assert.rejects(W.read({},{}),/Unknown/);
 await assert.rejects(W.download(source,()=>assert.fail('A source without CORS permission must use its normal manual download')),/Download the Wasteland/);
});
const input=process.env.RIFFBOUND_REVIEWED_SOURCE;
test('actual reviewed package loads authored Drums plus its own audio without online search or drum estimation',{skip:!input},async()=>{
 const file=new Blob([fs.readFileSync(input)]),pack=await C.openPackage(file),fetcher=()=>assert.fail('Local package import must not request a catalog, proxy or audio mirror');
 const result=await C.lookup({title:'Wasteland',artist:'10 Years',parts:['drums'],packageSource:pack,chartOnly:true,includeAudio:true,checkDrums:true,fetcher});
 assert.deepEqual(Object.keys(result.charts),['drums']);assert.deepEqual(Object.fromEntries(Object.entries(result.charts.drums).map(([k,v])=>[k,v.length])),{easy:386,medium:467,hard:777,expert:1239});
 const offline=await C.lookup({title:'Wasteland',artist:'10 Years',parts:['drums'],packageSource:pack,chartOnly:true,includeAudio:true,fetcher:null,enabled:false});assert.equal(offline.charts.drums.expert.length,1239);
 assert.equal(result.drumLayout,'four');assert.equal(result.reference.charter,'Elite42069');assert.equal(result.drumCheck.status,'imported');
 assert.ok(result.charts.drums.expert.every(n=>n.time>=19.7299&&n.duration===0&&n.pitch===undefined));
 const audio=[];for await(const f of C.songAudio(result.audioContainer,{fetcher}))audio.push(f);
 assert.equal(audio.length,1);assert.equal(audio[0].data.length,18996237);assert.equal(Buffer.from(audio[0].data.subarray(0,4)).toString(),'OggS');
 for(const parts of [['guitar'],['bass'],['guitar','bass','drums']]){const r=await C.lookup({title:'Wasteland',artist:'10 Years',parts,packageSource:pack,chartOnly:true,includeAudio:true,checkDrums:true,fetcher});assert.deepEqual(Object.keys(r.charts).sort(),parts.slice().sort());}
});
test('ten-channel community audio folds every source pair into stereo without moving attacks',async()=>{
 const sampleRate=22050,duration=5,data=Array.from({length:10},(_,i)=>{const x=new Float32Array(sampleRate*duration);x[sampleRate*2]=.01*(i+1);return x;});
 const decoded={numberOfChannels:10,sampleRate,duration,getChannelData:i=>data[i]};
 const result=await A.build((async function*(){yield {name:'song.ogg',data:new Uint8Array([1])};})(),{duration,decode:()=>decoded});
 const bytes=await result.blob.arrayBuffer(),v=new DataView(bytes),at=44+sampleRate*2*4;
 assert.equal(v.getUint16(22,true),2);assert.equal(v.getInt16(at,true),Math.round(.05*32767));assert.equal(v.getInt16(at+2,true),Math.round(.06*32767));assert.equal(v.getInt16(at-4,true),0);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} Add a song imports the selected reviewed file and saves authored Drums with matching audio`,{skip:!input},async()=>{
 const {createRequire}=require('node:module'),adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0];
 const {setup}=new Function('require',code+'\nreturn {setup};')(createRequire(adapter)),B=require('./helpers/bundled-audio.cjs');
 const app=setup({mobile,chartFixture:[],referenceDecoder:bytes=>{if(bytes[0]===82)return B.wave(bytes);const duration=239.019,sampleRate=8000,data=Float32Array.from({length:Math.ceil(duration*sampleRate)},(_,i)=>.1*Math.sin(i*.2));return {duration,sampleRate,numberOfChannels:2,getChannelData:()=>data};},browserOverrides:{RiffCommunityCharts:{...C,lookup:options=>C.lookup({...options,fetcher:()=>assert.fail('Selected package does not need internet')})}}});
 await app.nodes.addSongButton.click();app.nodes.addCommunityPackage.files=[new Blob([fs.readFileSync(input)])];app.nodes.addSongPart.value='drums';await app.nodes.addCommunityPackage.emit('change');
 assert.equal(app.nodes.confirmAddSong.disabled,false);assert.equal(app.nodes.confirmAddSong.textContent,'Import package & audio');await app.nodes.confirmAddSong.click();
 assert.equal(app.savedSongs.size,1,app.nodes.addSongError.textContent);const saved=[...app.savedSongs.values()][0];
 assert.equal(saved.title,'Wasteland');assert.equal(saved.quality.imports.drums.filename.includes('Elite42069'),true);assert.equal(saved.charts.drums.expert.length,1239);assert.equal(saved.quality.drumLayout,'four');assert.ok(saved.audioBlob.size>44);assert.notEqual(saved.chartOnly,true);assert.deepEqual(app.requests,[]);
 assert.equal(saved.quality.audioReviews.drums.estimated,false);assert.equal(saved.quality.onlineLookup.drumCheck.status,'imported');
});
