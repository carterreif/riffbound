const F=require('./community-fixture.cjs');
const uint=(value,size)=>{const b=Buffer.alloc(size);size===8?b.writeBigUInt64LE(BigInt(value)):b.writeUIntLE(value,0,size);return b;};
function sng(files=[['song.opus',Buffer.from([1,7,8,9])],['guitar.opus',Buffer.from([2,8,9,10])]]){
 const metadata={name:F.row.name,artist:F.row.artist,icon:'ghm',five_lane_drums:'True'},pairs=Object.entries(metadata).map(([k,v])=>Buffer.concat([uint(k.length,4),Buffer.from(k),uint(v.length,4),Buffer.from(v)])),m=Buffer.concat([uint(pairs.length,8),...pairs]);
 const all=[...files,['notes.mid',F.fullMidi()]],tableSize=8+all.reduce((n,[name])=>n+1+Buffer.byteLength(name)+16,0),headerSize=26+8+m.length+8+tableSize+8,mask=Buffer.from(Array.from({length:16},(_,i)=>i*13));let offset=headerSize;
 const table=Buffer.concat([uint(all.length,8),...all.map(([name,data])=>{const entry=Buffer.concat([Buffer.from([name.length]),Buffer.from(name),uint(data.length,8),uint(offset,8)]);offset+=data.length;return entry;})]);
 const payload=all.map(([,data])=>Buffer.from(data).map((b,i)=>b^mask[i%16]^(i%256)));
 return Buffer.concat([Buffer.from('SNGPKG'),uint(1,4),mask,uint(m.length,8),m,uint(table.length,8),table,uint(offset-headerSize,8),...payload]);
}
function decoded(marker,{duration=16,rate=22050}={}){
 const channels=Array.from({length:2},(_,c)=>Float32Array.from({length:Math.ceil(duration*rate)},(_,i)=>.3*Math.sin(2*Math.PI*(marker===1?110:c===0?220:330)*i/rate)));
 return {duration,sampleRate:rate,numberOfChannels:2,getChannelData:c=>channels[c]};
}
function wave(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),rate=v.getUint32(24,true),channels=v.getUint16(22,true),length=v.getUint32(40,true)/(channels*2),data=Array.from({length:channels},(_,c)=>Float32Array.from({length},(_,i)=>v.getInt16(44+(i*channels+c)*2,true)/32768));
 return {duration:length/rate,sampleRate:rate,numberOfChannels:channels,getChannelData:c=>data[c]};
}
module.exports={sng,decoded,wave};
