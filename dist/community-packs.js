/* Public Clone Hero packs omitted by the search index. Fetch only the selected
 * song's ZIP entries, with fixed bounds and SHA-256 receipts; never the pack. */
(function(root){
  'use strict';
  const X=typeof module!=='undefined'&&module.exports?require('./chart-exchange.js'):root.RiffChartExchange;
  const Reviewed=typeof module!=='undefined'&&module.exports?require('./reviewed-band-source.js'):root.RiffReviewedBandSource;
  const id='1632cde4d0535151136667ccaf700238',fileId='1rPSsBJFTSBBwHooqqRA_v9af1AeqhDdQ',folder='METAL PACK/Tool - Stinkfist/';
  const url='https://drive.usercontent.google.com/download?id='+fileId+'&export=download&confirm=t';
  const entries=[
    {name:'notes.mid',offset:1050082393,compressed:9236,length:114606,sha:'715b6af981004507ac0d9f0769fdb46aec7761647af640935ee656017fd4f457'},
    {name:'song.ini',offset:1050091744,compressed:319,length:709,sha:'5c97b4f940e4f26b7dd174ff1f5453d1a29bab937436cad23f817c1bfe2055aa'},
    {name:'song.ogg',offset:1050092177,compressed:5632181,length:5652740,sha:'54ce72395b8fd054a009a1f59d4bb5effd4b35a16a16c4b3575485ce6c393664'}
  ];
  const row={md5:id,name:'Stinkfist',artist:'Tool',charter:'DenVaktare',packName:'Clone Hero community Metal Pack',song_length:317182,pro_drums:true,notesData:{drumType:1,noteCounts:[['easy',360],['medium',708],['hard',1119],['expert',1600]].map(([difficulty,count])=>({instrument:'drums',difficulty,count}))}};
  const has=key=>key===id||!!Reviewed?.has(key);
  const owns=c=>!!Reviewed?.owns(c)||c?.kind==='community-zip'&&c.sourceMd5===id&&c.url===url;
  const sourceUrl=key=>Reviewed?.sourceUrl(key)||(key===id?'https://drive.google.com/file/d/'+fileId+'/view':null);
  async function bounded(response,limit,signal){
    const reader=response.body?.getReader();if(!reader)throw Error('Streaming chart downloads are unavailable.');const chunks=[];let length=0;
    try{while(true){if(signal?.aborted)throw Error('Canceled');const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Community pack response exceeded its limit.');chunks.push(value);}const out=new Uint8Array(length);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;}finally{await reader.cancel().catch(()=>{});}
  }
  async function range(fetcher,start,end,signal,requestUrl=url){
    if(signal?.aborted)throw Error('Canceled');
    const response=await fetcher(requestUrl,{headers:{Range:`bytes=${start}-${end}`},signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(response.status!==206){await response.body?.cancel();const error=Error('The community pack does not provide the requested chart range.');error.status=response.status;throw error;}
    const header=response.headers.get('Content-Range');if(header&&!new RegExp(`^bytes ${start}-${end}/[0-9]+$`).test(header)){await response.body?.cancel();throw Error('Unexpected community pack range.');}
    const bytes=await bounded(response,end-start+1,signal);if(bytes.length!==end-start+1)throw Error('Incomplete community pack range.');return bytes;
  }
  async function read(container,file,fetcher,signal){
    if(Reviewed?.owns(container))return Reviewed.read(container,file,fetcher,signal);
    if(!owns(container))throw Error('Unknown community pack.');const entry=entries.find(e=>e.name===file.name);if(!entry||entry.length!==file.length)throw Error('Unknown community pack entry.');
    return readEntry(entry,fetcher,signal);
  }
  async function readEntry(entry,fetcher,signal,{entryFolder=folder,requestUrl=url}={}){
    if(!Number.isSafeInteger(entry.offset)||entry.offset<0||!Number.isSafeInteger(entry.compressed)||entry.compressed<1||entry.compressed>8*1024*1024||!Number.isSafeInteger(entry.length)||entry.length<1||entry.length>8*1024*1024||!/^[a-f0-9]{64}$/.test(entry.sha))throw Error('Invalid community ZIP bounds.');
    const h=await range(fetcher,entry.offset,entry.offset+29,signal,requestUrl),v=new DataView(h.buffer,h.byteOffset,h.byteLength);
    if(v.getUint32(0,true)!==0x04034b50||v.getUint16(6,true)&1||v.getUint16(8,true)!==8)throw Error('Unsupported community ZIP entry.');
    const nameLength=v.getUint16(26,true),extraLength=v.getUint16(28,true);if(nameLength>512||extraLength>4096)throw Error('Invalid community ZIP header.');
    const start=entry.offset+30,body=await range(fetcher,start,start+nameLength+extraLength+entry.compressed-1,signal,requestUrl);
    if(new TextDecoder('utf-8',{fatal:true}).decode(body.subarray(0,nameLength))!==entryFolder+entry.name)throw Error('Community ZIP identity changed.');
    if(typeof DecompressionStream==='undefined')throw Error('This browser cannot open the community ZIP chart.');
    const stream=new Blob([body.subarray(nameLength+extraLength)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const data=await bounded(new Response(stream),entry.length,signal);if(data.length!==entry.length)throw Error('Incomplete community ZIP entry.');
    const hash=await crypto.subtle.digest('SHA-256',data),sha=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(sha!==entry.sha)throw Error('The community chart package changed; its source needs review.');
    if(signal?.aborted)throw Error('Canceled');return data;
  }
  async function download(source,fetcher,signal){
    if(Reviewed?.has(source.md5))return Reviewed.download(source,fetcher,signal);
    if(!has(source.md5))throw Error('Unknown community source.');const container={kind:'community-zip',sourceMd5:id,url,header:{files:entries.map(e=>({name:e.name,length:e.length}))}};
    const metadata=X.parseIni(new TextDecoder('utf-8',{fatal:true}).decode(await read(container,container.header.files[1],fetcher,signal)));container.header.metadata=metadata;
    return {data:await read(container,container.header.files[0],fetcher,signal),file:{name:'notes.mid',length:entries[0].length},metadata,container};
  }
  const api={rows:()=>[JSON.parse(JSON.stringify(row)),...(Reviewed?.rows()||[])],has,owns,sourceUrl,read,download,openFile:(file,signal)=>Reviewed.openFile(file,signal)};if(typeof module!=='undefined'&&module.exports)module.exports={...api,readEntry};else root.RiffCommunityPacks=api;
})(typeof window!=='undefined'?window:globalThis);
