const test=require('node:test'),assert=require('node:assert/strict'),A=require('../dist/song-audio.js'),B=require('./helpers/bundled-audio.cjs');
function padded({rate=22050,extra=10,tail=.00004,latePulse=false,nan=false}={}){
 const data=Float32Array.from({length:Math.ceil((5+extra)*rate)},(_,i)=>i<5*rate?.3*Math.sin(2*Math.PI*110*i/rate):tail*Math.sin(i*1.77));data[rate]=.8;
 if(latePulse)data[Math.ceil(6*rate)]=.01;if(nan)data[data.length-1]=NaN;
 return {duration:data.length/rate,sampleRate:rate,numberOfChannels:1,getChannelData:()=>data};
}
const files=async function*(){yield {name:'song.opus',data:new Uint8Array([1])};};
for(const rate of [22050,44100,48000])test(`near-silent game-package padding at ${rate} Hz is trimmed without moving musical attacks`,async()=>{
 const audio=await A.build(files(),{duration:5,decode:()=>padded({rate})}),wave=B.wave(new Uint8Array(await audio.blob.arrayBuffer()));assert.ok(Math.abs(audio.duration-5.75)<1/22050);assert.ok(wave.getChannelData(0)[22050]>.79);assert.equal(audio.files.length,1);assert.ok(audio.blob.size<600000);
});
test('padding validation rejects audible windows, even brief late attacks, invalid samples and excessive/short lengths',async()=>{
 for(const options of [{tail:.0005},{latePulse:true},{nan:true},{extra:16},{extra:-1}])await assert.rejects(A.build(files(),{duration:5,decode:()=>padded(options)}),/recording length|invalid samples/);
});
test('existing sub-750 ms duration differences are preserved and ordinary mismatched music still fails',async()=>{
 const audio=await A.build(files(),{duration:5,decode:()=>padded({extra:.5})});assert.equal(audio.duration,5.5);
 await assert.rejects(A.build(files(),{duration:5,decode:()=>B.decoded(1,{duration:15})}),/recording length/);
});
test('missing decoded tail samples cannot be mistaken for silent padding',async()=>{
 const buffer=padded();buffer.getChannelData=()=>new Float32Array(5*22050);await assert.rejects(A.build(files(),{duration:5,decode:()=>buffer}),/decoded completely/);
});
test('canceling the padding scan stops before building any playable audio',async()=>{
 const controller=new AbortController(),task=A.build(files(),{duration:5,signal:controller.signal,decode:()=>{setTimeout(()=>controller.abort(),0);return padded();}});await assert.rejects(task,/Canceled/);
});
