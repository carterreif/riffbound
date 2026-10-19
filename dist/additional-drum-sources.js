/* Publisher-owned MIDI sources. Exact identities and reviewed file receipts,
 * real Drum tracks and original tempo maps; never Guitar-to-Drums conversion.
 * These source projects do not include a browser-downloadable recording. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const Catalog=node?require('./drum-source-catalog.js'):root.RiffDrumSourceCatalog;
 const M=node?require('./midi-chart.js'):root.RiffMidiChart,X=node?require('./chart-exchange.js'):root.RiffChartExchange;
 const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const check=signal=>{if(signal?.aborted)throw Error('Canceled');};
 function match(title,artist){return (Catalog?.rows||[]).filter(row=>normalize(row.title)===normalize(title)&&normalize(row.artist)===normalize(artist)).slice(0,3);}
 async function download(row,fetcher,signal){
  // URLs come only from this reviewed publisher catalog, never API/user URLs.
  if(!Catalog.rows.includes(row)||row.path.split('/').some(p=>p==='.'||p==='..')||!/^songs(?:-grinnz|-lik|-hmx)?\/(?:[a-z0-9_.-]+\/)+notes\.mid$/.test(row.path)||!/^[a-f0-9]{40}$/.test(Catalog.revision)||!/^[a-f0-9]{64}$/.test(row.sha256)||row.bytes<1||row.bytes>X.MAX_BYTES)throw Error('Invalid published Drum source.');
  check(signal);const url='https://raw.githubusercontent.com/mtolly/onyx/'+Catalog.revision+'/'+row.path;
  const response=await fetcher(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok){await response.body?.cancel();const error=Error('The published Drum chart is unavailable (HTTP '+response.status+').');error.status=response.status;throw error;}
  const reader=response.body?.getReader();if(!reader)throw Error('Streaming chart downloads are unavailable.');const data=new Uint8Array(row.bytes);let offset=0;
  try{while(true){check(signal);const {done,value}=await reader.read();if(done)break;if(offset+value.length>data.length)throw Error('The published Drum chart changed size.');data.set(value,offset);offset+=value.length;}}
  finally{await reader.cancel().catch(()=>{});}
  if(offset!==data.length)throw Error('The published Drum chart is incomplete.');
  const hash=await crypto.subtle.digest('SHA-256',data),sha=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  if(sha!==row.sha256)throw Error('The published Drum chart changed; its source needs review.');check(signal);return data;
 }
 async function fill(found,{title='',artist='',filename='',parts=[],chartOnly=false,enabled=true,packageSource=null,signal,fetcher=root.fetch?.bind(root),onProgress=()=>{},timeoutMs=12000}={}){
  if(!enabled||packageSource||!parts.includes('drums')||found.charts?.drums?.expert?.length)return found;
  title=found.identity?.title||title;artist=found.identity?.artist||artist;
  const candidates=match(title,artist);if(!candidates.length)return found;
  check(signal);const provider=[...new Set(candidates.map(row=>row.provider))].join(' / '),availableParts=[...new Set([...(found.availableParts||[]),'drums'])];
  const listed=message=>({...found,availableParts,additionalDrumCheck:{provider,status:'listed',message},message:[found.message,message].filter(Boolean).join(' ')});
  // Never join a source project's notes to another package's recording or
  // approve uploaded audio from its title, duration or matching note onsets.
  if(!chartOnly||Object.keys(found.charts||{}).length)return listed(provider+' lists an authored Drum chart. Its source recording is not included, so it cannot verify this song audio. Search this title with Drums selected and no audio file to load its chart only.');
  if(!fetcher||root.navigator?.onLine===false)return {...found,availableParts,additionalDrumCheck:{provider,status:'unavailable',message:'Connect to download the published Drum chart.'},message:[found.message,'Connect to download the published Drum chart.'].filter(Boolean).join(' ')};
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,timeoutMs);let last='The published Drum chart could not be loaded.';
  try{
   for(const row of candidates){
    check(controller.signal);onProgress('Checking '+row.provider+' for the authored Drum chart…');
    try{
     const bytes=await download(row,fetcher,controller.signal),parsed=M.parse(bytes,{part:'drums',drumLayout:'auto',outputDrumLayout:'four',legacyRunningStatus:true,metadata:{name:row.title,artist:row.artist}}),arranged=X.arrange(parsed,row.duration);
     check(controller.signal);if(!arranged.charts.drums?.expert?.length)throw Error('The source has no playable Drum track.');
     const message=row.provider+': authored four-lane Drum chart loaded. Chart only: source audio is not included. Attach the matching recording in Manage songs, then preview timing.';
     const reference={title:row.title,artist:row.artist,charter:row.author,setlist:row.provider,url:row.source,provider:row.provider,kind:'published-drum-midi',sha256:row.sha256,sourceRevision:Catalog.revision};
     // A Guitar-only package may have offered fallback music. Discard that
     // recording rather than silently attaching it to this independent chart.
     const {audioContainer,audioReference,audioOnly,drumAudio,...base}=found;
     return {...base,charts:{drums:arranged.charts.drums},imports:{drums:{filename:row.title+' · '+row.author+' · notes.mid',layout:'four',levels:Object.keys(parsed.charts.drums),derived:arranged.derived.drums,derivedFrom:arranged.derivedFrom.drums}},sources:{drums:row.provider+' authored Drum chart by '+row.author},references:{drums:reference},reference,timing:parsed.timing,timings:{drums:parsed.timing},bpm:parsed.bpm,beat:parsed.beat,duration:row.duration,drumLayout:'four',identity:{title:row.title,artist:row.artist},chartOnly:true,recordingReviews:{},issues:{},availableParts,drumCheck:{provider:row.provider,status:'imported',message},additionalDrumCheck:{provider:row.provider,status:'imported',message},message};
    }catch(error){check(signal);last=error.message;if(controller.signal.aborted||[401,403,429].includes(error.status))break;}
   }
   check(signal);const message=controller.signal.aborted?'Additional Drum-source lookup timed out.':last;
   return {...found,availableParts,additionalDrumCheck:{provider,status:'unavailable',message},message:[found.message,message].filter(Boolean).join(' ')};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 const api={fill,match};if(node)module.exports=api;else root.RiffAdditionalDrumSources=api;
})(typeof window!=='undefined'?window:globalThis);
