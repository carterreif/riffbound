// Real masked SNG layout with independently supplied chart/audio byte ranges.
const F=require('./community-fixture.cjs');
const uint=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
function container(files,metadata={name:F.row.name,artist:F.row.artist,five_lane_drums:'True',delay:'0'}){
 const pairs=Object.entries(metadata).map(([k,v])=>{k=Buffer.from(k);v=Buffer.from(v);return Buffer.concat([u32(k.length),k,u32(v.length),v]);});
 const m=Buffer.concat([uint(pairs.length),...pairs]),mask=Buffer.from(Array.from({length:16},(_,i)=>i*13)),entries=Object.entries(files),tableLen=8+entries.reduce((sum,[name])=>sum+1+Buffer.byteLength(name)+16,0);let offset=26+8+m.length+8+tableLen+8;
 const table=Buffer.concat([uint(entries.length),...entries.map(([name,data])=>{const f=Buffer.concat([Buffer.from([Buffer.byteLength(name)]),Buffer.from(name),uint(data.length),uint(offset)]);offset+=data.length;return f;})]);
 return Buffer.concat([Buffer.from('SNGPKG'),u32(1),mask,uint(m.length),m,uint(table.length),table,uint(entries.reduce((s,[,b])=>s+b.length,0)),...entries.map(([,bytes])=>Buffer.from(bytes).map((b,i)=>b^mask[i%16]^(i%256)))]);
}
module.exports={container};
