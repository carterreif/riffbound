const uint=(n,size,little=false)=>{const b=Buffer.alloc(size);size===8?b.writeBigUInt64LE(BigInt(n)):little?b.writeUIntLE(n,0,size):b.writeUIntBE(n,0,size);return b;};
const vlq=n=>{const a=[n&127];while(n>>=7)a.unshift((n&127)|128);return Buffer.from(a);};
const meta=(type,data)=>{data=Buffer.from(data);return Buffer.concat([Buffer.from([255,type]),vlq(data.length),data]);};
function midi(tracks){
 const chunks=tracks.map(({name,notes=[],events=[]})=>{let previous=0;const all=[{tick:0,data:meta(3,name)},...events,...notes.flatMap(n=>[{tick:n.tick,data:Buffer.from([0x90,n.code,n.velocity||100])},{tick:n.tick+(n.length||1),data:Buffer.from([0x80,n.code,0])}])].sort((a,b)=>a.tick-b.tick);const body=Buffer.concat([...all.map(e=>{const d=Buffer.concat([vlq(e.tick-previous),e.data]);previous=e.tick;return d;}),Buffer.from([0,255,47,0])]);return Buffer.concat([Buffer.from('MTrk'),uint(body.length,4),body]);});
 return Buffer.concat([Buffer.from('MThd'),uint(6,4),uint(1,2),uint(chunks.length,2),uint(480,2),...chunks]);
}
function fullMidi(){return midi([{name:'TEMPO',events:[{tick:0,data:meta(81,[7,161,32])},{tick:1920,data:meta(81,[15,66,64])}]},{name:'PART GUITAR',notes:[{tick:960,code:96,length:480},{tick:960,code:100,length:240},{tick:1920,code:97,length:1},{tick:960,code:64,length:1}]},{name:'PART BASS',notes:[{tick:960,code:98,length:240}]},{name:'PART DRUMS',notes:[{tick:960,code:96},{tick:960,code:97},{tick:1080,code:98},{tick:1200,code:99},{tick:1320,code:100},{tick:1440,code:101}]},{name:'PART VOCALS',notes:[{tick:960,code:60,length:480},{tick:1920,code:72,length:480}],events:[{tick:960,data:meta(5,'Hello')}]}]);}
function sng(data=fullMidi(),{filename='notes.mid',metadata={name:'Fixture Song',artist:'Fixture Artist',five_lane_drums:'True',delay:'0'},prefix=200000}={}){
 const pairs=Object.entries(metadata).map(([key,value])=>{key=Buffer.from(key);value=Buffer.from(value);return Buffer.concat([uint(key.length,4,true),key,uint(value.length,4,true),value]);});
 const m=Buffer.concat([uint(pairs.length,8),...pairs]),mask=Buffer.from(Array.from({length:16},(_,i)=>i*13)),names=['song.ogg',filename],tableLen=8+names.reduce((n,s)=>n+1+Buffer.byteLength(s)+16,0),headerLen=26+8+m.length+8+tableLen+8;
 const f=Buffer.concat([uint(2,8),...names.map((name,i)=>Buffer.concat([Buffer.from([name.length]),Buffer.from(name),uint(i?data.length:prefix,8),uint(headerLen+(i?prefix:0),8)]))]);
 const masked=Buffer.from(data).map((b,i)=>b^mask[i%16]^(i%256));return Buffer.concat([Buffer.from('SNGPKG'),uint(1,4,true),mask,uint(m.length,8),m,uint(f.length,8),f,uint(prefix+data.length,8),Buffer.alloc(prefix),masked]);
}
const row={name:'Fixture Song',artist:'Fixture Artist',charter:'Fixture Charter',song_length:16000,md5:'a'.repeat(32),five_lane_drums:true,notesData:{drumType:2,hasVocals:true,noteCounts:['guitar','bass','drums'].map(instrument=>({instrument,difficulty:'expert',count:10}))}};
function network({rows=[row],pages,containers,container=sng(),blocked=false,badRange=false,noRange=false}={}){
 const requests=[];const fetcher=async(url,options={})=>{requests.push({url,options});if(url.includes('/search'))return new Response(JSON.stringify({data:pages?pages[JSON.parse(options.body).page-1]||[]:rows}),{status:201});if(blocked)return new Response('blocked',{status:403});const selected=containers?containers[url.split('/').pop().replace('.sng','')]:container;if(typeof selected==='number')return new Response('unavailable',{status:selected});if(!selected)return new Response('missing',{status:404});if(noRange)return new Response(selected,{status:200});const [start,end]=options.headers.Range.match(/\d+/g).map(Number);return new Response(selected.subarray(start,end+1),{status:206,headers:{'Content-Range':`bytes ${badRange?start+1:start}-${end}/${selected.length}`}});};return {requests,fetcher};
}
module.exports={midi,meta,fullMidi,sng,row,network};

// UI/parser fixtures model an already-verified per-part audio provider. Real
// waveform matching, rejection and offsets are exercised in alignment tests.
module.exports.verifiedLookup=query=>({...query,alignAudio:query.alignAudio||(query.requireAudioMatch?async({parts})=>Object.fromEntries(parts.map(part=>[part,{status:'aligned',referenceInstrument:part,shiftSeconds:0,referenceFiles:[part+'.fixture'],message:'Verified fixture recording.'}])):undefined)});
