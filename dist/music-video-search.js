/* Music-video metadata lookup; playback stays in the supported YouTube embed. */
(function(root){
 'use strict';
 const key=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 async function find({title,artist},{fetcher=root.fetch?.bind(root),signal}={}){
  if(!key(title)||!key(artist))throw Error('Enter the song title and artist in Add a song before finding a video.');
  const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,10000);
  try{
   const url='https://www.theaudiodb.com/api/v1/json/123/searchtrack.php?s='+encodeURIComponent(artist)+'&t='+encodeURIComponent(title);
   const r=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(!r.ok)throw Error(r.status===429?'Video search is busy. Try again later.':'Video search is unavailable. You can still paste a video link.');
   let text='';if(r.body?.getReader){const reader=r.body.getReader();let count=0;const decoder=new TextDecoder();try{for(;;){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>1024*1024)throw Error('Video search response is too large.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}}else{text=await r.text();if(text.length>1024*1024)throw Error('Video search response is too large.');}
   const rows=JSON.parse(text).track;if(!Array.isArray(rows))return null;
   for(const row of rows.slice(0,100)){
    if(key(row.strTrack)!==key(title)||key(row.strArtist)!==key(artist))continue;
    let u;try{u=new URL(row.strMusicVid);}catch{continue;}
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;
    const host=u.hostname.toLowerCase();let id;
    if(host==='youtu.be'||host==='www.youtu.be')id=u.pathname.split('/')[1];
    else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):null;
    if(/^[\w-]{11}$/.test(id||''))return {url:'https://www.youtube.com/watch?v='+id,title:row.strTrack,artist:row.strArtist,provider:'TheAudioDB'};
   }
   return null;
  }catch(error){if(controller.signal.aborted)throw Error(signal?.aborted?'Video search canceled.':'Video search timed out. Try again or paste a link.');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 const api={find};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffMusicVideoSearch=api;
})(typeof window!=='undefined'?window:globalThis);
