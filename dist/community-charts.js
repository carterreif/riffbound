/* Online authored-chart lookup. API contract: Geomitron/Bridge search-api.ts.
 * SNG container format: mdsitton/SngFileFormat. Independently implemented.
 * Chart bytes and bounded temporary reference audio are fetched for matching.
 * Uploaded audio stays on this device; reference audio is never saved. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const X=node?require('./chart-exchange.js'):root.RiffChartExchange,M=node?require('./midi-chart.js'):root.RiffMidiChart;
  const D=node?require('./chart-difficulties.js'):root.RiffDifficulties;
  const Packs=node?require('./community-packs.js'):root.RiffCommunityPacks;
  const API='https://api.enchor.us/search',CDN='https://files.enchor.us/',MAX_HEADER=512*1024,MAX_PAGES=3,MAX_CANDIDATES=4;
  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  // A numeric multiplication title has equivalent spaced/compact spelling.
  // Keep other title words (live, covers, edits) exact.
  const numericTitle=s=>String(s||'').replace(/(\d)\s*[x×]\s*(?=\d)/gi,'$1 X ');
  // Treat the written conjunction and ampersand as the same title word.
  // Keep the conjunction itself, plus version/artist checks, in the identity.
  const titleKey=s=>normalize(numericTitle(s).replace(/&/g,' and '));
  const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/[\x00-\x1f]/g,' ').slice(0,160).trim();
  // Source IDs follow YARC OpenSource and Bridge's setlist-name catalog.
  // They describe a conversion's claimed game, not verified authenticity.
  const GH_SOURCES=Object.fromEntries([
    [['gh','gh1','ghdx','gh1dx'],'Guitar Hero 1',true],
    [['gh2','gh2dlc','gh2dx','gh2dxdlc','gh2dxcustoms'],'Guitar Hero 2',true],
    [['gh3','gh3dlc'],'Guitar Hero 3',true],
    [['gh80s','gh80sdx'],'Guitar Hero: Rocks the 80s',true],
    [['gha'],'Guitar Hero: Aerosmith',true],
    [['ghot','ghotd','ghotmh'],'Guitar Hero: On Tour',true],
    [['ghwt','ghwtdlc'],'Guitar Hero: World Tour',false],
    [['ghm','ghmdlc'],'Guitar Hero: Metallica',false],
    [['ghsh'],'Guitar Hero: Smash Hits',false],
    [['gh5','gh5dlc'],'Guitar Hero 5',false],
    [['ghvh'],'Guitar Hero: Van Halen',false],
    [['ghwor','ghwordlc'],'Guitar Hero: Warriors of Rock',false],
    [['bh','bhdlc','bandhero'],'Band Hero',false],
  ].flatMap(([icons,game,guitarOnly])=>icons.map(icon=>[icon,{icon,game,guitarOnly,family:'Guitar Hero'}])));
  function gameSource(row){
    if(!row)return null;
    const icon=clean(row.icon).toLowerCase();if(Object.hasOwn(GH_SOURCES,icon))return {...GH_SOURCES[icon]};
    // Legacy catalog folders sometimes lack an icon. Do not infer the source
    // from the song title, its artist, or a developer/charter's name alone.
    const text=normalize([row.packName,row.drivePath,row.internalPath,row.source].map(clean).join(' '));
    const numbered=text.match(/\bguitar hero (iii|ii|i|1|2|3|5)\b/);
    if(numbered){const n={i:1,ii:2,iii:3}[numbered[1]]||numbered[1];return {...GH_SOURCES['gh'+n]};}
    for(const [phrase,key] of [['world tour','ghwt'],['metallica','ghm'],['smash hits','ghsh'],['van halen','ghvh'],['warriors of rock','ghwor'],['aerosmith','gha'],['on tour','ghot'],['rocks the 80s','gh80s']])if(text.includes('guitar hero '+phrase)||text.includes('guitar hero encore '+phrase))return {...GH_SOURCES[key]};
    if(text==='guitar hero')return {...GH_SOURCES.gh};
    if(text==='band hero')return {...GH_SOURCES.bh};
    return null;
  }
  function sourceAllows(row,part,metadata){
    const sources=[gameSource(row),gameSource(metadata)];
    return !sources.some(source=>source?.guitarOnly&&part!=='guitar');
  }
  function setlistSource(row,metadata){
    const catalog=gameSource(row),packageSource=gameSource(metadata);
    if(catalog&&packageSource&&catalog.game!==packageSource.game)throw Error('The downloaded chart belongs to a different Guitar Hero setlist than its catalog entry.');
    const game=packageSource||catalog;
    return {game,setlist:game?.game||clean(row.packName)||'Clone Hero community charts'};
  }
  const trackTitle=s=>String(s||'').replace(/\s*\(\s*track\s*#?\s*\d+\s*\)\s*$/i,'').replace(/^track\s+\d+\s*[-:.]\s*/i,'').replace(/^\d{2,3}\s*[-._]\s+/,'').trim();
  function identify(filename,{title='',artist=''}={}){
    let name=trackTitle(String(filename||'').replace(/\.[^.]+$/,'')).replace(/[_]+/g,' ').replace(/\s*\(\d+\)\s*$/,'');
    name=name.replace(/\s*(?:[- ]?(?:drums?|guitar|bass|vocals?)[ -]*only|[- ]+isolated|[- ]+instrumental)\s*$/i,'').trim();
    const split=name.split(/\s+-\s+/);if(split.length===2){if(!artist)artist=split[0];if(!title)title=split[1];}
    return {title:clean(trackTitle(title||name)),artist:clean(artist)};
  }
  function available(row,part){return sourceAllows(row,part)&&(part==='vocals'?row.notesData?.hasVocals===true:(row.notesData?.noteCounts||[]).some(n=>n.instrument===part&&n.count>0));}
  function match(rows,identity,duration,parts,{verifyAudio=false,chartOnly=false}={}){
    // Fail closed: a filename without artist is not a recording identity.
    if(!normalize(identity.title)||!normalize(identity.artist)||(!chartOnly&&!Number.isFinite(duration)))return {reason:'Add the song title and artist to find an authored chart.'};
    const seen=new Set(),recordings=rows.filter(r=>r&&/^[a-f0-9]{32}$/.test(r.md5||'')&&titleKey(clean(r.name))===titleKey(identity.title)&&normalize(clean(r.artist))===normalize(identity.artist)&&Number.isFinite(r.song_length)&&(chartOnly?r.song_length>=5000&&r.song_length<=D.MAX_DURATION*1000:Math.abs(r.song_length/1000-duration)<=(verifyAudio?8:.75))),candidates=recordings.filter(r=>parts.some(p=>available(r,p)));
    const availableParts=['guitar','bass','drums','vocals'].filter(part=>recordings.some(row=>available(row,part)));
    if(!candidates.length){
      if(chartOnly&&!recordings.length&&rows.some(r=>r&&/^[a-f0-9]{32}$/.test(r.md5||'')&&titleKey(clean(r.name))===titleKey(identity.title)&&normalize(clean(r.artist))===normalize(identity.artist)&&Number.isFinite(r.song_length)&&r.song_length>D.MAX_DURATION*1000))return {availableParts,reason:'Matching song found, but it exceeds the 15-minute song limit.'};
      // Report alternate arrangements without treating them as this recording.
      const variants=rows.filter(r=>r&&normalize(clean(r.artist))===normalize(identity.artist)&&titleKey(clean(r.name)).startsWith(titleKey(identity.title)+' ')&&parts.some(p=>available(r,p)));
      const names=[...new Set(variants.map(r=>clean(r.name)))].slice(0,3);
      return {availableParts,reason:recordings.length?`Matching recording found, but no authored ${parts.join(', ')} chart. Used audio charting.`+(availableParts.length?` Other authored parts available: ${availableParts.join(', ')}.`:''):names.length?`Only different song versions were found: ${names.join('; ')}. Their charts were not applied to this recording. Used audio charting.`:'No matching recording with these parts was found. Used audio charting.'};
    }
    // Different lengths can mean a different intro, edit, or recording.
    if(!chartOnly&&!verifyAudio&&Math.max(...candidates.map(r=>r.song_length))-Math.min(...candidates.map(r=>r.song_length))>200)return {reason:'Several recording versions match. Used audio charting rather than choosing one.'};
    const score=r=>{
      const supplied=parts.map(part=>available(r,part)?new Set((r.notesData?.noteCounts||[]).filter(n=>n.instrument===part&&n.count>0&&['easy','medium','hard','expert'].includes(n.difficulty)).map(n=>n.difficulty)).size:0);
      // Requested instrument coverage comes first; within the same recording,
      // prefer complete authored arrangements over an Expert-only chart.
      const coverage=parts.filter(p=>available(r,p)).length,game=gameSource(r);
      return (game?coverage*10000:0)+coverage*1000+supplied.filter(n=>n===4).length*100+supplied.reduce((a,b)=>a+b,0);
    };
    candidates.sort((a,b)=>score(b)-score(a)||String(a.md5).localeCompare(String(b.md5)));
    const ranked=candidates.filter(r=>!seen.has(r.md5)&&seen.add(r.md5));
    return {row:ranked[0],rows:ranked,availableParts};
  }
  function sngHeader(input){
    const b=new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength),dec=new TextDecoder('utf-8',{fatal:true});let p=0;
    function need(end){if(end>MAX_HEADER)throw Error('Chart container header is too large.');if(end>b.length){const error=Error('Incomplete chart container header.');error.needed=end;throw error;}}
    function u64(){need(p+8);const n=v.getBigUint64(p,true);p+=8;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Invalid chart container length.');return Number(n);}
    function str(n){need(p+n);const s=dec.decode(b.subarray(p,p+n));p+=n;return s;}
    need(34);if(str(6)!=='SNGPKG')throw Error('The download is not a chart container.');const version=v.getUint32(p,true);p+=4;if(version!==1)throw Error('Unsupported chart container version.');const mask=b.slice(p,p+16);p+=16;
    const metaLength=u64(),metaEnd=p+metaLength;need(metaEnd+8);const count=u64(),metadata=Object.create(null);if(count>4096)throw Error('Too many chart metadata entries.');
    for(let i=0;i<count;i++){need(p+4);let n=v.getUint32(p,true);p+=4;if(n>4096)throw Error('Invalid chart metadata.');const key=str(n);need(p+4);n=v.getUint32(p,true);p+=4;if(n>65536)throw Error('Invalid chart metadata.');metadata[key]=str(n);if(p>metaEnd)throw Error('Invalid chart metadata length.');}
    if(p!==metaEnd)throw Error('Invalid chart metadata section.');
    const tableLength=u64(),tableEnd=p+tableLength;need(tableEnd+8);const fileCount=u64(),files=[];if(fileCount>512)throw Error('Too many chart container files.');
    for(let i=0;i<fileCount;i++){need(p+1);const n=b[p++],name=str(n),length=u64(),offset=u64();files.push({name,length,offset});if(p>tableEnd)throw Error('Invalid chart file table.');}
    if(p!==tableEnd)throw Error('Invalid chart file table length.');const dataLength=u64(),headerEnd=p,names=new Set();
    for(const f of files){if(names.has(f.name)||f.offset<headerEnd||f.offset+f.length>headerEnd+dataLength)throw Error('Invalid chart file boundaries.');names.add(f.name);}
    const ordered=[...files].sort((a,b)=>a.offset-b.offset);for(let i=1;i<ordered.length;i++)if(ordered[i].offset<ordered[i-1].offset+ordered[i-1].length)throw Error('Overlapping chart container files.');
    return {metadata,files,mask,headerEnd,total:headerEnd+dataLength};
  }
  function unmask(bytes,mask){return new Uint8Array(bytes).map((b,i)=>b^mask[i%16]^(i%256));}
  async function bounded(response,limit){
    if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>limit)throw Error('Chart response is too large.');return bytes;}
    const reader=response.body.getReader(),chunks=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Chart response is too large.');chunks.push(value);}const out=new Uint8Array(length);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;}finally{await reader.cancel().catch(()=>{});}
  }
  async function range(fetcher,url,start,end,signal){
    const response=await fetcher(url,{headers:{Range:`bytes=${start}-${end}`},signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(response.status!==206){const error=Error('The chart download is unavailable or does not support chart-only downloads.');error.status=response.status;throw error;}
    const header=response.headers.get('Content-Range');
    // Content-Range can be hidden by CORS; exact response length still checked.
    if(header&&!new RegExp(`^bytes ${start}-${end}/[0-9]+$`).test(header))throw Error('Unexpected chart download range.');
    const bytes=await bounded(response,end-start+1);if(bytes.length!==end-start+1)throw Error('The chart download was incomplete.');return bytes;
  }
  async function download(row,fetcher,signal){
    if(Packs?.has(row.md5))return Packs.download(row,fetcher,signal);
    const url=CDN+row.md5+'.sng';let bytes=await range(fetcher,url,0,33,signal),header;
    for(let i=0;i<4;i++){try{header=sngHeader(bytes);break;}catch(error){if(!error.needed)throw error;const end=error.needed;if(end>MAX_HEADER)throw Error('Chart container header is too large.');bytes=await range(fetcher,url,0,end-1,signal);}}
    if(!header)throw Error('Could not read chart container.');
    const file=header.files.find(f=>f.name==='notes.mid')||header.files.find(f=>f.name==='notes.chart');if(!file||file.length<=0||file.length>X.MAX_BYTES)throw Error('No supported chart file in this download.');
    const data=unmask(await range(fetcher,url,file.offset,file.offset+file.length-1,signal),header.mask);return {data,file,metadata:header.metadata,container:{url,header}};
  }
  function songAudioFiles(container){
    if(!container?.header||!(Packs?.owns(container)||/^https:\/\/files\.enchor\.us\/[a-f0-9]{32}\.sng$/.test(container.url)))throw Error('This chart package has no downloadable song audio.');
    const files=container.header.files.filter(f=>/^(song|guitar|rhythm|bass|drums(?:_[1-4])?|vocals(?:_[12])?|keys)\.(opus|ogg|mp3|wav|flac|m4a)$/i.test(f.name));
    const roots=new Set(files.map(f=>f.name.split('.')[0].replace(/_[1-4]$/,'')));
    if(!files.length||files.length>16||(!roots.has('song')&&roots.size<2))throw Error('The chart package has no supported full-song audio.');
    const bytes=files.reduce((n,f)=>n+f.length,0);if(files.some(f=>f.length<=0)||bytes>80*1024*1024)throw Error('The bundled audio is missing or exceeds the 80 MB song limit.');
    return files;
  }
  async function* songAudio(container,{fetcher=root.fetch?.bind(root),signal,timeoutMs=90000,onProgress=()=>{}}={}){
    const files=songAudioFiles(container),{url,header}=container;
    const controller=new AbortController(),abort=()=>controller.abort(),clock=()=>root.performance?.now?.()??Date.now();let remaining=timeoutMs;
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    try{for(let i=0;i<files.length;i++){
      if(controller.signal.aborted||remaining<=0)throw Error('Audio download canceled or timed out.');
      const file=files[i];onProgress(i/files.length,`Getting matching audio: ${file.name} (${i+1}/${files.length})…`);
      // The fetch budget spans all requests, excluding local decoding/mixing
      // while the consumer holds a yielded stem. Slow devices keep their audio.
      const started=clock(),timer=setTimeout(abort,remaining);let bytes;
      try{bytes=Packs?.owns(container)?await Packs.read(container,file,fetcher,controller.signal):await range(fetcher,url,file.offset,file.offset+file.length-1,controller.signal);}finally{clearTimeout(timer);remaining-=clock()-started;}
      if(controller.signal.aborted||remaining<=0)throw Error('Audio download canceled or timed out.');
      const data=Packs?.owns(container)?bytes:unmask(bytes,header.mask);
      yield {name:file.name,data};
    }}finally{signal?.removeEventListener('abort',abort);}
  }
  async function* referenceFeatures(downloaded,{parts,fetcher,signal,decode,allowFullRecording=false,budget={remaining:24*1024*1024}}){
    const {url,header}=downloaded.container||{};if(!header||!decode)return;
    const cache=new Map();
    for(const part of parts){
      const roots={guitar:'guitar',bass:'bass',drums:'drums(?:_[1-4])?',vocals:'vocals(?:_[12])?'}[part];if(!roots)continue;
      let files=header.files.filter(f=>new RegExp(`^${roots}\\.(opus|ogg|mp3|wav|flac|m4a)$`,'i').test(f.name));
      let scope='instrument';
      // A sole song file can verify the recording for an already-parsed Drum
      // chart. In stemmed packages song may be backing-only; never treat it as
      // isolated kit audio, or use it to estimate missing Drum notes.
      if(!files.length&&part==='drums'&&allowFullRecording){
        const music=header.files.filter(f=>/\.(opus|ogg|mp3|wav|flac|m4a)$/i.test(f.name)&&!/^(preview|crowd)\./i.test(f.name));
        if(music.length===1&&/^song\./i.test(music[0].name)){files=music;scope='full-recording';}
      }
      if(!files.length||files.length>4)continue;
      const samples=[];
      try{
        for(const file of files){
          if(signal?.aborted)throw Error('Canceled');
          if(!cache.has(file.name)){
            if(file.length<=0||file.length>8*1024*1024||file.length>budget.remaining)throw Error('Reference audio exceeded the comparison budget.');
            budget.remaining-=file.length;
            const bytes=Packs?.owns(downloaded.container)?await Packs.read(downloaded.container,file,fetcher,signal):unmask(await range(fetcher,url,file.offset,file.offset+file.length-1,signal),header.mask),features=await decode(bytes,{part,name:file.name,scope});
            if(signal?.aborted)throw Error('Canceled');
            if(!features?.samples?.length||!Number.isFinite(features.duration)||features.duration<5||features.duration>D.MAX_REFERENCE_DURATION)throw Error('Unsupported reference audio duration.');
            cache.set(file.name,features);
          }
          samples.push(cache.get(file.name));
        }
        yield {part,scope,files:files.map(f=>f.name),features:samples};
      }catch(error){if(signal?.aborted||[401,403,429].includes(error.status))throw error;}
    }
  }
  function parsePart(downloaded,part,row){
    if(!sourceAllows(row,part,downloaded.metadata))throw Error('This Guitar Hero source is guitar-only. It cannot supply '+part+' notes.');
    const layout=row.five_lane_drums||row.notesData?.drumType===2?'five':row.pro_drums||row.notesData?.drumType===1?'pro':'four';
    const source=setlistSource(row,downloaded.metadata),outputDrumLayout=source.game?'five':'four';
    const options=X.settings({part,drumLayout:'auto',fallbackLayout:layout,outputDrumLayout,metadata:downloaded.metadata});
    if(downloaded.file.name==='notes.mid')return M.parse(downloaded.data,options);
    if(part==='vocals')throw Error('This chart has no pitched vocal MIDI track.');
    const suffix={guitar:'Single',bass:'DoubleBass',drums:'Drums'}[part],text=new TextDecoder('utf-8',{fatal:true}).decode(downloaded.data);
    // Parse each part independently: unsupported notes elsewhere cannot discard
    // a playable instrument. Song + SyncTrack retain the original tempo/offset.
    const sections=text.match(/\[[^\]]+\]\s*\{[^}]*\}/g);if(!sections)throw Error('Invalid .chart file.');
    const filtered=sections.filter(s=>{const name=s.match(/^\[([^\]]+)\]/)[1];return name==='Song'||name==='SyncTrack'||name==='Events'||new RegExp('^(Easy|Medium|Hard|Expert)'+suffix+'$').test(name);}).join('\n');
    return X.parse(filtered,options);
  }
  async function lookup({filename,title='',artist='',duration,parts,chartOnly=false,includeAudio=false,includeDrumAudio=false,requireAudioMatch=false,enabled=true,signal,fetcher=root.fetch?.bind(root),alignAudio,onProgress=()=>{},timeoutMs=alignAudio?45000:chartOnly?30000:15000}){
    const chartMessage=reason=>chartOnly?reason.replace(/Used audio charting\./gi,'No audio was provided.').replace(/Offline: used audio charting\./i,'Offline: connect to search for charts.'):reason;
    const identity=identify(filename,{title,artist}),empty=(reason,availableParts=[])=>({charts:{},imports:{},sources:{},identity,availableParts,message:chartMessage(reason)});
    if(!enabled)return empty('Online chart lookup is off. Used audio charting.');
    if(!identity.artist)return empty('Add the song title and artist to find Clone Hero community charts. Used audio charting.');
    if(!fetcher||root.navigator?.onLine===false)return empty('Offline: used audio charting.');
    const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,timeoutMs);
    const charts={},imports={},sources={},issues={},timings={},references={},attempts=[],recordingReviews={},downloadedCharts=new Map(),recordingChecks=new Map(),budget={remaining:24*1024*1024};let timing,bpm,beat,audioContainer,audioReference,drumAudio,accessBlocked=false,availableParts=[],reason='This chart uses unsupported or missing parts. Used audio charting.';
    try{
      onProgress('Looking for Guitar Hero conversions and authored charts for '+parts.join(', ')+'…');
      const packRows=parts.includes('drums')&&Packs?Packs.rows():[];
      // A reviewed pack already provides an exact Drum source. Name-only
      // single-part searches must not depend on unrelated catalog requests.
      const directPack=chartOnly&&parts.length===1&&parts[0]==='drums'&&match(packRows,identity,duration,parts,{chartOnly:true}).row;
      const rows=directPack?[directPack]:[],seen=new Set(rows.map(row=>row.md5));
      async function searchCatalog(search,pages,advanced=false,charter='',instrument=''){
      for(let page=1;page<=pages;page++){
        if(controller.signal.aborted)throw Error('aborted');
        const request=advanced?{name:{value:numericTitle(identity.title),exact:true,exclude:false},artist:{value:identity.artist,exact:true,exclude:false},...(charter?{charter:{value:charter,exact:false,exclude:false}}:{}),...(instrument?{instrument}:{})}:{search};
        const response=await fetcher(API+(advanced?'/advanced':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,page,per_page:50,source:'api',drumsReviewed:false}),signal:controller.signal,credentials:'omit'});
        if(!response.ok){const error=Error('The community chart catalog is unavailable.');error.status=response.status;throw error;}
        const bytes=await bounded(response,8*1024*1024),result=JSON.parse(new TextDecoder().decode(bytes));
        // The page size counts grouped songs, not individual chart versions.
        // Real catalog pages can expand past 50 rows. Bound bytes and total
        // rows without discarding valid grouped responses.
        if(!Array.isArray(result.data)||result.data.length>1000)throw Error('Invalid chart search response.');
        let added=0;for(const row of result.data){if(!row||typeof row.md5!=='string'||seen.has(row.md5))continue;seen.add(row.md5);rows.push(row);added++;}
        if((Number.isFinite(result.found)?result.found<=page*50:result.data.length<50)||!added)return false;
      }
      return true;
      }
      if(!directPack){
      const targeted=chartOnly||requireAudioMatch,search=identity.artist+' '+numericTitle(identity.title),saturated=await searchCatalog(search,MAX_PAGES,targeted);
      // The exact name index includes punctuation (e.g. "Broken, Beat &
      // Scarred"). Recover its spelling through the general index before
      // spending the lookup timer on empty setlist/instrument queries.
      let broadened=false;
      if(targeted&&/(?:&|\band\b)/i.test(identity.title)&&!match(rows,identity,duration,['guitar','bass','drums','vocals'],{chartOnly,verifyAudio:!!alignAudio}).row){await searchCatalog(search,1);broadened=true;}
      // A short catalog page can still omit a game conversion. Check known
      // game charters by the exact song identity before settling on a custom
      // setlist. A charter alone never establishes the claimed game source.
      const candidates=targeted?match(rows,identity,duration,parts,{chartOnly,verifyAudio:!!alignAudio}).rows||[]:[],missingGameParts=parts.filter(p=>!candidates.some(row=>gameSource(row)&&available(row,p))),needsGameSetlist=targeted&&missingGameParts.length>0;
      if(needsGameSetlist)for(const charter of ['Neversoft',...(missingGameParts.includes('guitar')?['Harmonix']:[])]){
        onProgress('Checking Guitar Hero setlists for '+identity.title+'…');
        try{await searchCatalog(search,1,true,charter);}catch(error){if(controller.signal.aborted||[401,403,429].includes(error.status))throw error;break;}
      }
      if(targeted)for(const part of parts.filter(p=>!match(rows,identity,duration,[p],{chartOnly,verifyAudio:!!alignAudio}).row)){
        onProgress('Searching Clone Hero community '+part+' charts for '+identity.title+'…');
        await searchCatalog(search,1,true,'',part);
      }
      // Spacing/punctuation variants can differ in the catalog's text index.
      // A name-only lookup may broaden once, while local identity checks still
      // require the requested title and artist before importing any notes.
      if(targeted&&!broadened&&!match(rows,identity,duration,parts,{chartOnly,verifyAudio:!!alignAudio}).row)await searchCatalog(search,1);
      // A complete short result already includes any matching game sources.
      // At the page cap, narrow by known game charters to recover game charts
      // buried under community results. Keep the same host, budget and timer.
      if(saturated&&!needsGameSetlist&&parts.some(p=>p==='guitar'||p==='drums'))for(const charter of ['Neversoft',...(parts.includes('guitar')?['Harmonix']:[])]){
        onProgress('Checking additional Guitar Hero chart sources…');
        try{await searchCatalog(search+' '+charter,1);}catch(error){if(controller.signal.aborted||[401,403,429].includes(error.status))throw error;break;}
      }
      }
      if(controller.signal.aborted)throw Error('aborted');
      if(directPack)onProgress('Using the verified '+directPack.name+' Drum source…');
      for(const row of packRows)if(!seen.has(row.md5)){seen.add(row.md5);rows.push(row);}
      const chosen=match(rows,identity,duration,parts,{verifyAudio:!!alignAudio,chartOnly});availableParts=chosen.availableParts||[];if(!chosen.row){if(!(chartOnly&&includeAudio)&&!includeDrumAudio)return empty(chosen.reason,availableParts);reason=chosen.reason;}
      for(const row of chosen.rows||[]){
        // Without uploaded audio, keep one catalog recording length per song.
        if(chartOnly&&Object.keys(charts).length&&Math.abs(row.song_length/1000-duration)>.2)continue;
        const missing=parts.filter(p=>!charts[p]&&available(row,p));if(!missing.length)continue;
        if(attempts.length>=MAX_CANDIDATES)break;
        if(controller.signal.aborted)throw Error('aborted');
        const setlist=setlistSource(row).setlist;
        const attempt={md5:row.md5,charter:clean(row.charter||'Community'),setlist,parts:missing,status:'unavailable'};attempts.push(attempt);
        onProgress(`Found ${identity.title} in ${setlist}. Getting ${missing.join(', ')} chart…`);
        try{
          const downloaded=await download(row,fetcher,controller.signal);
          downloadedCharts.set(row.md5,downloaded);
          if(controller.signal.aborted)throw Error('aborted');
          if(titleKey(clean(downloaded.metadata.name))!==titleKey(identity.title)||normalize(clean(downloaded.metadata.artist))!==normalize(identity.artist))throw Error('Downloaded chart identity did not match this song.');
          const source=setlistSource(row,downloaded.metadata);
          const parsedParts={};for(const part of missing)try{parsedParts[part]=parsePart(downloaded,part,row);}catch(error){issues[part]=error.message;}
          if(!Object.keys(parsedParts).length){attempt.reason=missing.map(part=>part+': '+issues[part]).join(' ');reason='The matching chart could not be loaded. '+attempt.reason+' Used audio charting.';}
          let reviews={};
          const uncertain={status:'uncertain',shiftSeconds:null,message:'This instrument’s source audio has not verified its timing. Preview before playing.'};
          if(!chartOnly&&alignAudio&&Object.keys(parsedParts).length){
            onProgress('Comparing chart recording audio at the start, middle and end…');
            reviews=await alignAudio({downloaded,parts:Object.keys(parsedParts),fetcher,signal:controller.signal,budget});recordingChecks.set(row.md5,reviews);
            if(controller.signal.aborted)throw Error('aborted');
          }
          // Padded/ambiguous candidates need actual waveform identity. A close
          // title/length match alone may keep original timing, never guess a shift.
          const game=source.game;
          // Older game arrangements may be a different performance. A title
          // and close duration cannot establish their recording identity.
          const needsVerification=requireAudioMatch||game?.guitarOnly===true||Math.abs(row.song_length/1000-duration)>.75||chosen.rows.some(r=>Math.abs(r.song_length-row.song_length)>200);
          const reference={md5:row.md5,title:clean(row.name),artist:clean(row.artist),charter:clean(row.charter||'Community'),setlist:source.setlist,url:Packs?.sourceUrl(row.md5)||'https://www.enchor.us/',...(game?{sourceFamily:game.family,game:game.game,gameIcon:game.icon,guitarOnly:game.guitarOnly}:{})};attempt.status='unsupported';
          for(const part of Object.keys(parsedParts)){try{
            // Only this part's own review may move or verify its notes.
            const own=reviews?.[part]||(reviews?.referenceInstrument===part?reviews:null);
            const review=own?.referenceInstrument===part?own:uncertain;
            const verified=review.status==='aligned'&&Number.isFinite(review.shiftSeconds)&&Math.abs(review.shiftSeconds)<=8;
            if(!chartOnly&&needsVerification&&!verified){issues[part]=review.message;attempt.reason=review.message;reason=requireAudioMatch?'A possible chart was found, but this instrument’s recording audio could not be verified against your upload. Used audio charting.':game?.guitarOnly?'A guitar-only game chart was found, but its recording audio could not be verified. Used audio charting.':'A possible chart has different recording padding, but its audio could not be verified. Used audio charting.';continue;}
            const original=parsedParts[part],shift=verified?review.shiftSeconds:0;
            const parsed={...original,timing:{...original.timing,offset:original.timing.offset+shift,...(original.timing.sections?{sections:original.timing.sections.map(marker=>({...marker,time:marker.time+shift}))}:{})},charts:{[part]:Object.fromEntries(Object.entries(original.charts[part]).map(([level,notes])=>[level,notes.map(n=>({...n,time:n.time+shift}))]))}};
            for(const notes of Object.values(parsed.charts[part]))if(notes.some(n=>n.time<0))throw Error('Aligned notes start before this recording.');
            const arranged=X.arrange(parsed,chartOnly?row.song_length/1000:duration);if(chartOnly&&!Object.keys(charts).length)duration=row.song_length/1000;if(includeAudio)audioContainer??=downloaded.container;charts[part]=arranged.charts[part];timings[part]=parsed.timing;timing??=parsed.timing;bpm??=parsed.bpm;beat??=parsed.beat;
            imports[part]={filename:clean(row.name)+' · '+(game?game.game+' · ':'')+reference.charter+' · '+downloaded.file.name,layout:part==='drums'&&parsed.playLayout==='four'?'four':parsed.drumLayout,levels:Object.keys(parsed.charts[part]),derived:arranged.derived[part],derivedFrom:arranged.derivedFrom[part]};
            sources[part]=game?`${game.game} chart conversion by ${reference.charter}`:`Clone Hero community chart by ${reference.charter}`;references[part]=reference;recordingReviews[part]={...review,status:verified?'aligned':'uncertain',shiftSeconds:verified?shift:null};delete issues[part];attempt.status='imported';
          }catch(error){issues[part]=error.message;}}
        }catch(error){
          attempt.reason=error.message;reason=`Found ${clean(row.name)} in ${setlist}, but its chart could not be downloaded. ${error.message}${Number.isFinite(error.status)?' (HTTP '+error.status+')':''} Used audio charting.`;
          if(controller.signal.aborted)throw error;
          // Stop for host access/rate blocks. Alternatives are not a bypass.
          if([401,403,429].includes(error.status)){accessBlocked=true;break;}
        }
        // Audio-backed discovery keeps notes and audio in one chart package.
        if(parts.every(p=>charts[p])||includeAudio&&Object.keys(charts).length)break;
      }
      if(includeDrumAudio&&parts.includes('drums')&&!charts.drums&&!accessBlocked&&alignAudio){
        const candidates=match(rows,identity,duration,['guitar','drums','bass','vocals'],{chartOnly,verifyAudio:true}).rows||[];
        for(const row of candidates){
          let attempt=attempts.find(a=>a.md5===row.md5);if(!attempt){if(attempts.length>=MAX_CANDIDATES)break;attempt={md5:row.md5,charter:clean(row.charter||'Community'),setlist:setlistSource(row).setlist,parts:[],status:'unavailable'};attempts.push(attempt);}
          try{
            const downloaded=downloadedCharts.get(row.md5)||await download(row,fetcher,controller.signal);
            if(controller.signal.aborted)throw Error('aborted');
            if(titleKey(clean(downloaded.metadata.name))!==titleKey(identity.title)||normalize(clean(downloaded.metadata.artist))!==normalize(identity.artist))throw Error('Downloaded chart identity did not match this song.');
            const source=setlistSource(row,downloaded.metadata);
            if(!sourceAllows(row,'drums',downloaded.metadata))continue;
            onProgress('Checking isolated Drum audio from '+source.setlist+'…');
            if(recordingChecks.get(row.md5)?.drums?.status==='uncertain')continue;
            const reviews=await alignAudio({downloaded,parts:['drums'],analysisOnly:true,fetcher,signal:controller.signal,budget}),review=reviews?.drums;
            if(controller.signal.aborted)throw Error('aborted');
            if(review?.status!=='aligned'||review.referenceInstrument!=='drums'||!Number.isFinite(review.shiftSeconds)||Math.abs(review.shiftSeconds)>8)continue;
            drumAudio={...review,md5:row.md5,setlist:source.setlist,drumLayout:source.game?'five':'four',charter:clean(row.charter||'Community')};attempt.drumAudio='verified';break;
          }catch(error){attempt.drumAudioReason=error.message;if(controller.signal.aborted)throw error;if([401,403,429].includes(error.status)){accessBlocked=true;break;}}
        }
      }
      // Full song audio is useful even if this package charts only another
      // instrument. Never reuse those notes as the requested missing part.
      if(chartOnly&&includeAudio&&!Object.keys(charts).length&&!accessBlocked){
        const audioChoices=match(rows,identity,duration,['guitar','drums','bass','vocals'],{chartOnly:true}).rows||[];
        for(const row of audioChoices){
          let attempt=attempts.find(a=>a.md5===row.md5);if(!attempt){if(attempts.length>=MAX_CANDIDATES)break;attempt={md5:row.md5,charter:clean(row.charter||'Community'),setlist:setlistSource(row).setlist,parts:[],status:'unavailable'};attempts.push(attempt);}
          onProgress('Getting matching Clone Hero song audio for '+identity.title+'…');
          try{
            const downloaded=downloadedCharts.get(row.md5)||await download(row,fetcher,controller.signal);
            if(controller.signal.aborted)throw Error('aborted');
            if(titleKey(clean(downloaded.metadata.name))!==titleKey(identity.title)||normalize(clean(downloaded.metadata.artist))!==normalize(identity.artist))throw Error('Downloaded chart identity did not match this song.');
            const source=setlistSource(row,downloaded.metadata);songAudioFiles(downloaded.container);
            audioContainer=downloaded.container;duration=row.song_length/1000;audioReference={md5:row.md5,title:clean(row.name),artist:clean(row.artist),charter:clean(row.charter||'Community'),setlist:source.setlist,url:'https://www.enchor.us/',...(source.game?{game:source.game.game,sourceFamily:source.game.family}:{}),drumLayout:source.game?'five':'four'};attempt.status='audio';break;
          }catch(error){attempt.audioReason=error.message;attempt.reason??=error.message;if(controller.signal.aborted)throw error;if([401,403,429].includes(error.status))break;}
        }
      }
    }catch(error){if(signal?.aborted)throw Error('Canceled');reason=controller.signal.aborted?'Chart lookup timed out. Used audio charting.':'Could not fetch a community chart. Used audio charting.';}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    if(signal?.aborted)throw Error('Canceled');
    const fetched=Object.keys(charts),missing=parts.filter(p=>!charts[p]);
    const drumLayout=charts.drums?(imports.drums.layout==='four'?'four':'five'):audioReference?.drumLayout||(audioContainer?(/^Guitar Hero|^Band Hero/.test(references[fetched[0]]?.setlist||'')?'five':'four'):undefined);
    return {charts,imports,sources,bpm,beat,timing,timings,identity,availableParts,references,recordingReviews,drumLayout,reference:references[fetched[0]]||audioReference||null,attempts,issues,...(drumAudio?{drumAudio}:{}),...(chartOnly?{chartOnly:true,duration}:{}),...(includeAudio?{audioContainer,...(audioReference?{audioOnly:true}:{})}:{}),message:chartOnly?(fetched.length?`Found authored ${fetched.join(', ')} charts. Chart only: attach your audio for song playback; recording timing is unverified.`+(missing.length?` No supported ${missing.join(', ')} chart found.`:''):audioReference?`Matching Clone Hero song audio found. No supported authored ${parts.join(', ')} chart was found; an audio estimate can be built.`:chartMessage(reason)):fetched.length?`Authored ${fetched.join(', ')} fetched. `+(fetched.every(p=>recordingReviews[p]?.status==='aligned')?'Recording waveform timing verified; preview timing.':'Title, artist and length matched; preview timing.')+`${missing.length?' Audio charting used for '+missing.join(', ')+'.':''}`:reason};
  }
  const api={identify,gameSource,available,match,sngHeader,unmask,download,songAudio,referenceFeatures,parsePart,lookup};if(node)module.exports=api;else root.RiffCommunityCharts=api;
})(typeof window!=='undefined'?window:globalThis);
