/* Reviewed community source omitted by Chorus Encore. Only the public,
 * unencrypted package below is supported. Fixed bounds and SHA-256 receipts
 * validate the package and extracted files; no general console/decryption code. */
(function(root){
 'use strict';
 const id='6a5c68ca07297bd554c87f28b5a7b6b0';
 const page='https://rhythmverse.co/songfile/60ba773570ce4241aab2aa5c5b99bed4';
 const url='https://rhythmverse.co/download_file/elitestar8829/60ba773570ce4241aab2aa5c5b99bed4/wasteland10years_rb2con';
 const size=19738624,receipt='06f318620639bcd7a310d7e9cfecf9ebe0e225bc3961f54ebb2790b5967fc894';
 const entries=[{"name":"notes.mid","length":100635,"sha":"b4477ae3ac275db33cc613f7416591413874ff59cd4b3e4e0ec8a850a7b93d1f","spans":[[507904,100635]]},{"name":"song.ogg","length":18996237,"sha":"8118faed8fa8437665705f0910e10426437d8c83378af857efb9106bb656c630","spans":[[614492,130980],[753664,696320],[1454080,696320],[2154496,696320],[2854912,696320],[3555328,696320],[4255744,696320],[4956160,696320],[5656576,696320],[6356992,696320],[7057408,696320],[7757824,696320],[8458240,696320],[9158656,696320],[9859072,696320],[10559488,696320],[11259904,696320],[11960320,696320],[12660736,696320],[13361152,696320],[14061568,696320],[14761984,696320],[15462400,696320],[16162816,696320],[16863232,696320],[17563648,696320],[18264064,696320],[18964480,696320],[19664896,64617]]}];
 const metadata={name:'Wasteland',artist:'10 Years',charter:'Elite42069',pro_drums:'True',song_length:'236382'};
 // Duration includes the source package's trailing playback padding. Its MIDI
 // and audio share time zero; never shift it to fit another recording by name.
 const row={md5:id,name:metadata.name,artist:metadata.artist,charter:metadata.charter,packName:'Reviewed full-band community chart · RhythmVerse',song_length:239019,pro_drums:true,notesData:{drumType:1,noteCounts:Object.entries({drums:[386,467,777,1239],guitar:[143,448,635,1113],bass:[175,319,391,756]}).flatMap(([instrument,counts])=>counts.map((count,i)=>({instrument,difficulty:['easy','medium','hard','expert'][i],count})))}};
 const cache=new WeakMap(),has=key=>key===id,owns=c=>c?.kind==='reviewed-band-package'&&c.sourceMd5===id&&c.url===url;
 const check=signal=>{if(signal?.aborted)throw Error('Canceled');};
 async function digest(bytes){const value=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,'0')).join('');}
 async function extract(bytes,entry,signal){
  check(signal);const out=new Uint8Array(entry.length);let offset=0;
  for(const [start,length] of entry.spans){if(start<0||length<=0||start+length>bytes.length||offset+length>out.length)throw Error('Invalid reviewed chart boundaries.');out.set(bytes.subarray(start,start+length),offset);offset+=length;}
  if(offset!==entry.length||await digest(out)!==entry.sha)throw Error('The reviewed chart file changed; its source needs review.');check(signal);return out;
 }
 async function read(container,file,fetcher,signal){
  if(!owns(container))throw Error('Unknown reviewed community package.');
  const entry=entries.find(e=>e.name===file.name&&e.length===file.length);if(!entry)throw Error('Unknown reviewed chart entry.');
  const bytes=cache.get(container);if(!bytes)throw Error('Select the downloaded Wasteland package again in Add a song.');return extract(bytes,entry,signal);
 }
 function container(){return {kind:'reviewed-band-package',sourceMd5:id,url,header:{metadata:{...metadata},files:entries.map(({name,length})=>({name,length}))}};}
 async function downloaded(c,fetcher,signal){return {data:await read(c,c.header.files[0],fetcher,signal),file:c.header.files[0],metadata:c.header.metadata,container:c};}
 async function download(source,fetcher,signal){
  if(!has(source.md5))throw Error('Unknown reviewed chart source.');
  // This source does not grant browser CORS access. Guide players to its
  // normal download and local import instead of timing out or estimating.
  throw Error('Download the Wasteland community package in Add a song, then select it under Community package to load its authored drums and audio.');
 }
 async function openFile(file,signal){
  check(signal);if(!file||file.size!==size)throw Error('Choose the original Wasteland community package linked below (about 19 MB).');
  const bytes=new Uint8Array(await file.arrayBuffer());check(signal);
  if(bytes.length!==size||await digest(bytes)!==receipt)throw Error('This is not the reviewed Wasteland package. Download the linked original package again.');
  const c=container();cache.set(c,bytes);return downloaded(c,null,signal);
 }
 const api={rows:()=>[JSON.parse(JSON.stringify(row))],has,owns,sourceUrl:key=>has(key)?page:null,read,download,openFile};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffReviewedBandSource=api;
})(typeof window!=='undefined'?window:globalThis);
