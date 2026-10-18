const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const C=require('../dist/community-charts.js'),A=require('../dist/recording-alignment.js'),Reuse=require('../dist/authored-chart-reuse.js'),D=require('../dist/chart-difficulties.js'),F=require('./helpers/community-fixture.cjs'),{container}=require('./helpers/reference-container.cjs');
const adapter=require.resolve('./upload-flow.test.cjs'),code=fs.readFileSync(adapter,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',code+'\nreturn {setup,until};')(createRequire(adapter));
function noise(seconds=40,seed=1){let s=seed;return Float32Array.from({length:Math.round(seconds*22050)},()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s/2**32-.5)*.3;});}
const target=noise(),wrong=noise(40,999),data=s=>Buffer.from(s.buffer,s.byteOffset,s.byteLength);
const midi=F.midi([{name:'PART GUITAR',notes:[{tick:10000,code:96,length:480}]},{name:'PART DRUMS',notes:[{tick:10000,code:97},{tick:10000,code:96}]}]);
const base={...F.row,song_length:40000},query={filename:'Fixture Artist - Fixture Song.wav',duration:40,parts:['drums'],requireAudioMatch:true};
function align(samples){return async({downloaded,parts,fetcher,signal,budget})=>{const reviews={};for await(const ref of C.referenceFeatures(downloaded,{parts,fetcher,signal,budget,decode:async bytes=>A.features(new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)))})){reviews[ref.part]={...await A.review(A.features(samples),A.combine(ref.features),{signal,yieldTask:async()=>{}}),referenceInstrument:ref.part,referenceFiles:ref.files};}return reviews;};}
for(const icon of ['ghwt','ghm','gh5','ghwor',null])test(`${icon||'community'} chart with the same title and length requires its own matching recording`,async()=>{
 const row={...base,icon};for(const files of [{'notes.mid':midi},{'notes.mid':midi,'drums_1.opus':data(wrong)},{'notes.mid':midi,'guitar.opus':data(target),'song.opus':data(target)}]){
  const result=await C.lookup({...query,fetcher:F.network({rows:[row],container:container(files)}).fetcher,alignAudio:align(target)});assert.deepEqual(result.charts,{});assert.match(result.message,/could not be verified against your upload/);
 }
 const net=F.network({rows:[row],container:container({'notes.mid':midi,'drums_1.opus':data(target)})}),matched=await C.lookup({...query,fetcher:net.fetcher,alignAudio:align(target)});assert.ok(matched.charts.drums.expert.length);assert.equal(matched.recordingReviews.drums.status,'aligned');assert.equal(matched.recordingReviews.drums.referenceInstrument,'drums');
});
test('strict upload matching never applies another instrument’s waveform proof or same-length metadata alone',async()=>{
 const net=F.network({rows:[base],container:container({'notes.mid':midi})}),r=await C.lookup({...query,fetcher:net.fetcher,alignAudio:async()=>({drums:{status:'aligned',shiftSeconds:0,referenceInstrument:'guitar'}})});assert.deepEqual(r.charts,{});
 const noVerifier=await C.lookup({...query,fetcher:net.fetcher});assert.deepEqual(noVerifier.charts,{});
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} uploaded audio uses the actual recording matcher and only a verified Drum arrangement`,async()=>{
 for(const matched of [false,true]){
  const padded=new Float32Array(target.length+2*22050);padded.set(matched?target:wrong,2*22050);const row={...base,icon:'ghm',song_length:42000},net=F.network({rows:[row],container:container({'notes.mid':midi,'drums_1.opus':data(padded)})});let requested;
  const app=setup({mobile,audioSamples:target,chartFixture:[{lane:4,time:3,duration:0}],referenceDecoder:bytes=>{if(bytes.length<=4)return null;const samples=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return {duration:samples.length/22050,sampleRate:22050,numberOfChannels:1,getChannelData:()=>samples};},browserOverrides:{RiffRecordingAlignment:A,RiffCommunityCharts:{identify:C.identify,referenceFeatures:C.referenceFeatures,lookup:q=>{requested=q;return C.lookup({...q,fetcher:net.fetcher});}}}});
  await app.radios.chartTarget.find(r=>r.value==='drums').emit('change');await app.upload('Fixture Artist - Fixture Song.wav');await until(()=>!app.nodes.saveCurrentButton.disabled);const saved=[...app.savedSongs.values()][0];assert.equal(requested.requireAudioMatch,true);assert.equal(requested.checkDrums,true);assert.equal(saved.quality.onlineLookup.drumCheck.status,matched?'imported':'not-imported');assert.deepEqual(Buffer.from(await saved.audioBlob.arrayBuffer()),Buffer.from([1,1,2,3]));
  if(matched){assert.deepEqual(app.requests,[]);assert.equal(saved.quality.audioReviews.drums.timingVerified,true);assert.equal(saved.quality.audioReviews.drums.referenceInstrument,'drums');assert.ok(Math.abs(saved.quality.chartTimings.drums.offset+2)<.002);assert.ok(Math.abs(saved.charts.drums.expert[0].time-(10000/480*.5-2))<.002);}
  else{assert.deepEqual(app.requests,['drums']);assert.equal(saved.quality.imports.drums,undefined);assert.match(app.nodes.chartStatus.textContent,/could not be verified/);}
 }
});
function cached(){const id='a'.repeat(64);return {id,title:'Fixture Song',instrument:'drums',musicEnd:16,bpm:120,beat:.5,charts:{drums:D.build([{lane:0,time:1,duration:0}], 'drums',.5)},quality:{imports:{drums:{id:'b'.repeat(64),filename:'source.mid',layout:'five',levels:['expert'],derived:['easy','medium','hard']}},communityReferences:{drums:{md5:'c'.repeat(32),charter:'Source'}}}};}
test('automatic reuse requires proof scoped to this exact recording and part, while explicit manual charts stay intact',()=>{
 const s=cached(),reuse=()=>Reuse.reuse(s,s.id,16,['drums'],{requireAudioMatch:true});assert.deepEqual(reuse().charts,{});
 s.quality.audioReviews={drums:{policy:'authored-recording-alignment-v1',estimated:false,timingVerified:true,recordingId:s.id,referenceInstrument:'guitar'}};assert.deepEqual(reuse().charts,{});
 s.quality.audioReviews.drums.referenceInstrument='drums';s.quality.audioReviews.drums.recordingId='d'.repeat(64);assert.deepEqual(reuse().charts,{});
 s.quality.audioReviews.drums.recordingId=s.id;assert.ok(reuse().charts.drums);
 delete s.quality.communityReferences;delete s.quality.audioReviews;assert.ok(reuse().charts.drums,'Explicit manual import for the same audio is retained');
});
test('matching package-audio receipts retain correct authored arrangements without repeating a network lookup',()=>{
 const s=cached();s.quality.packageAudio={sourceMd5:'c'.repeat(32)};s.quality.audioReviews={drums:{policy:'authored-package-audio-v1',estimated:false,timingVerified:false,recordingId:s.id,sourceMd5:'c'.repeat(32)}};
 assert.ok(Reuse.reuse(s,s.id,16,['drums'],{requireAudioMatch:true}).charts.drums);s.quality.packageAudio.sourceMd5='d'.repeat(32);assert.deepEqual(Reuse.reuse(s,s.id,16,['drums'],{requireAudioMatch:true}).charts,{});
});
