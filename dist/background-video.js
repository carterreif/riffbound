/* Per-song local backgrounds. Song audio remains the only audible track. */
(function(root){
  'use strict';
  const Sources=typeof module!=='undefined'&&module.exports?require('./background-source.js'):root.RiffBackgroundSource;
  const YouTube=typeof module!=='undefined'&&module.exports?require('./youtube-background.js'):root.RiffYouTubeBackground;
  const defaults=()=>({mode:'stage',offset:0,dim:35,file:null,url:'',name:''});
  const hasSource=value=>!!(value.file||value.url);
  const linkUrl=value=>{if(!Sources)throw Error('Update Riffbound to use video links.');return Sources.videoUrl(value);};
  const MAX_VIDEO=2*1024*1024*1024,CHUNK_BYTES=32*1024,BATCH_CHUNKS=64;
  const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
  function storage(indexedDB){
    let opening,writing=Promise.resolve();const savedFiles=new WeakMap();
    const open=()=>opening||(opening=new Promise((resolve,reject)=>{
      if(!indexedDB){reject(Error('Video storage is unavailable.'));return;}
      const request=indexedDB.open('riffbound-backgrounds-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('songs');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    }).catch(error=>{opening=null;throw error;}));
    async function transaction(mode,action){
      const db=await open();return new Promise((resolve,reject)=>{
        const tx=db.transaction('songs',mode);let requests;
        tx.oncomplete=()=>resolve(requests.map(request=>request.result));tx.onerror=tx.onabort=()=>reject(tx.error||Error('Video storage failed.'));
        try{requests=action(tx.objectStore('songs'));}catch(error){tx.abort();reject(error);}
      });
    }
    const read=keys=>transaction('readonly',table=>keys.map(key=>table.get(key)));
    const chunkKey=(key,media,index)=>`video:${key}:${media.token}:${index}`;
    const valid=media=>media?.format==='riffbound-video-chunks-v1'&&typeof media.token==='string'&&/^[a-z0-9-]{1,100}$/i.test(media.token)&&Number.isSafeInteger(media.bytes)&&media.bytes>0&&media.bytes<=MAX_VIDEO&&media.count===Math.ceil(media.bytes/CHUNK_BYTES);
    async function discard(key,media,count=media?.count){
      if(!valid(media))return;
      for(let start=0;start<count;start+=BATCH_CHUNKS)await transaction('readwrite',table=>Array.from({length:Math.min(BATCH_CHUNKS,count-start)},(_,i)=>table.delete(chunkKey(key,media,start+i))));
    }
    async function get(key){
      const [record]=await read([key]);if(!record?.media)return record;
      const media=record.media;if(!valid(media))throw Error('The saved video is incomplete. Choose the original video or import its backup again.');
      const parts=[];
      for(let start=0;start<media.count;start+=BATCH_CHUNKS){
        const chunks=await read(Array.from({length:Math.min(BATCH_CHUNKS,media.count-start)},(_,i)=>chunkKey(key,media,start+i)));
        chunks.forEach((bytes,i)=>{if(Object.prototype.toString.call(bytes)!=='[object ArrayBuffer]'||bytes.byteLength!==Math.min(CHUNK_BYTES,media.bytes-(start+i)*CHUNK_BYTES))throw Error('The saved video is incomplete. Choose the original video or import its backup again.');});
        parts.push(new Blob(chunks));
      }
      const file=new Blob(parts,{type:media.mime||''});savedFiles.set(file,{key,media});return {...record,file};
    }
    async function put(key,value,onProgress){
      const [previous]=await read([key]),file=value.file,cached=file&&savedFiles.get(file);let media=null,written=0;
      try{
        if(file){
          if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>MAX_VIDEO)throw Error('Videos saved to the setlist must be no larger than 2 GB.');
          if(cached?.key===key&&cached.media.token===previous?.media?.token)media=cached.media;
          else{
            media={format:'riffbound-video-chunks-v1',token:root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),bytes:file.size,count:Math.ceil(file.size/CHUNK_BYTES),mime:file.type||''};
            for(let start=0;start<media.count;start+=BATCH_CHUNKS){
              const first=start*CHUNK_BYTES,end=Math.min(file.size,(start+BATCH_CHUNKS)*CHUNK_BYTES),bytes=await file.slice(first,end).arrayBuffer();
              if(bytes.byteLength!==end-first)throw Error('Could not read the video. Choose the original file and try again.');
              await transaction('readwrite',table=>Array.from({length:Math.min(BATCH_CHUNKS,media.count-start)},(_,i)=>table.put(bytes.slice(i*CHUNK_BYTES,Math.min(bytes.byteLength,(i+1)*CHUNK_BYTES)),chunkKey(key,media,start+i))));
              written=Math.min(media.count,start+BATCH_CHUNKS);onProgress?.(Math.round(written/media.count*95));
            }
          }
        }
        // Publish the new reference only after every media chunk is durable.
        await transaction('readwrite',table=>[table.put({...value,file:null,media},key)]);
      }catch(error){if(written)await discard(key,media,written).catch(()=>{});throw error;}
      if(file)savedFiles.set(file,{key,media});
      if(previous?.media?.token!==media?.token)await discard(key,previous?.media).catch(()=>{});
      onProgress?.(100);
    }
    return {get,put:(...args)=>{const next=writing.catch(()=>{}).then(()=>put(...args));writing=next;return next;},savedSongs:async keys=>{if(!keys.length)return [];const records=await read(keys);return keys.filter((key,i)=>records[i]?.file?.size||valid(records[i]?.media)||Sources?.isLink(records[i]?.url));},linkedSongs:async keys=>{if(!keys.length)return [];const records=await read(keys);return keys.filter((key,i)=>Sources?.isLink(records[i]?.url));}};
  }
  function create(video,stage,{store=storage(root.indexedDB),url=root.URL,onChange=()=>{},readyTimeout=15000,youtubeFactory=YouTube?.create}={}){
    let key=null,config=defaults(),objectUrl=null,generation=0,writes=0,blocked=false,starting=false,wanted=false,loaded=false,mediaIssue='',timeline=null,preparation=null,playEpoch=0,youtube=null;
    const memory=new Map();let queue=Promise.resolve();
    const youtubeId=()=>Sources?.youtubeId?.(config.url)||null;
    function notify(message){onChange({...config,hasVideo:hasSource(config),linked:!!config.url,youtube:!!youtubeId(),videoUrl:youtubeId()?null:objectUrl||config.url||null},message);}
    function pause(reason){wanted=false;timeline=null;playEpoch++;starting=false;video.pause();youtube?.pause();preparation?.(reason);}
    function release(){pause();youtube?.destroy();youtube=null;loaded=false;video.removeAttribute('src');video.load();if(objectUrl){url.revokeObjectURL(objectUrl);objectUrl=null;}}
    function appearance(){
      stage.classList.toggle('video-background',config.mode==='video'&&hasSource(config)&&!youtube?.failed);
      stage.classList.toggle('dark-background',config.mode==='dark');
      video.hidden=!!youtubeId()||config.mode!=='video'||!hasSource(config);youtube?.appearance({visible:config.mode==='video',dim:config.dim});video.style.filter=`brightness(${1-config.dim/100})`;
      video.muted=true;video.volume=0;
    }
    function apply(){
      release();blocked=false;starting=false;mediaIssue='';
      if(config.file){objectUrl=url.createObjectURL(config.file);video.src=objectUrl;video.load();}else if(youtubeId()){
        if(typeof youtubeFactory!=='function')throw Error('Update Riffbound to use YouTube links.');
        const current=youtubeFactory(stage,{onError:message=>{if(youtube!==current)return;mediaIssue=message;stage.classList.remove('video-background');notify(message);},onReady:()=>{if(youtube===current)notify('YouTube player loaded. Use Preview timing with chart to check its timing.');}});youtube=current;youtube.load(youtubeId());
      }else if(config.url){video.src=linkUrl(config.url);video.load();}
      appearance();notify();
    }
    async function selectSong(next){
      if(next===key)return;key=next;const version=++generation;
      config=defaults();apply();
      try{const saved=memory.get(next)||await store.get(next);if(version!==generation)return;
        if(saved){const next={...defaults(),...saved};if(next.url){next.url=linkUrl(next.url);next.file=null;}config=next;config.offset=clamp(config.offset,-900,900,0);config.dim=clamp(config.dim,0,80,35);if(!['stage','dark','video'].includes(config.mode))config.mode='stage';apply();}
      }catch(error){if(version===generation)notify('The saved background could not be loaded. '+(error?.message||'Choose the video again.'));}
    }
    function save(){
      const owner=key,value={...config},sessionOnly=value.file?.size>500*1024*1024&&!value.keepVideo;
      memory.set(owner,value);writes++;
      queue=queue.catch(()=>{}).then(()=>sessionOnly?undefined:store.put(owner,value,percent=>{if(value.keepVideo&&owner===key&&value.file===config.file&&value.url===config.url&&percent<100)notify(`Saving video to setlist… ${percent}%`);})).then(()=>{if(owner===key&&value.file===config.file&&value.url===config.url)notify(mediaIssue||(sessionOnly?'Video selected for this session. Videos larger than 500 MB are not stored automatically. Choose Save video to setlist to keep it on this device.':value.url?'Video link and timing saved for this song. Internet access is required to play it.':'Background saved for this song on this device.'));return !sessionOnly;},error=>{if(owner===key&&value.file===config.file&&value.url===config.url)notify(mediaIssue||'Background works for this session, but could not be saved. Free some browser storage and select it again. '+(error?.message||''));return false;}).finally(()=>writes--);
      return queue;
    }
    async function choose(file){
      if(!file)return false; // Canceling the picker leaves the current background alone.
      if(!file.size){notify(`“${file.name||'This file'}” is empty. Choose a video containing data.`);return false;}
      if(!(/^video\//i.test(file.type)||/\.(mp4|webm|mov|m4v|ogv|mkv|avi|mpg|mpeg|ts|m2ts)$/i.test(file.name||''))){notify(`“${file.name||'This file'}” is not a video file. Choose the actual MP4 or WebM recording, rather than a shortcut, image or chart.`);return false;}
      generation++;config={...config,file,url:'',name:file.name,mode:'video',keepVideo:false};apply();notify('Loading video: '+file.name+'…');await save();return true;
    }
    async function chooseLink(value){
      const next=linkUrl(value);if(Sources.youtubeId?.(next)&&typeof youtubeFactory!=='function')throw Error('Update Riffbound to use YouTube links.');generation++;config={...config,file:null,url:next,name:Sources.name(next),mode:'video',keepVideo:false};apply();notify(youtubeId()?'Loading YouTube video… Internet access is required.':'Loading linked video… Internet access is required.');await save();return true;
    }
    function settings(values){
      generation++;config={...config,mode:values.mode??config.mode,offset:clamp(values.offset??config.offset,-900,900,0),dim:clamp(values.dim??config.dim,0,80,35)};
      if(!['stage','dark','video'].includes(config.mode))config.mode='stage';
      pause();blocked=false;appearance();notify(config.mode==='video'&&!hasSource(config)?'Choose a video file or direct video link for this song.':'');return save();
    }
    function clear(){generation++;config={...config,file:null,url:'',name:'',mode:'stage'};apply();return save();}
    function attachment(){if(!hasSource(config))throw Error('Choose a video before saving a chart + video backup.');return {...config};}
    function saveToSetlist(){
      if(!hasSource(config))throw Error('Choose a video before saving it to the setlist.');
      if(config.file?.size>MAX_VIDEO)throw Error('Videos saved to the setlist must be no larger than 2 GB.');
      generation++;config={...config,keepVideo:true};notify(config.url?'Saving video link to setlist…':'Saving video to setlist…');return save();
    }
    async function removeSong(id){await queue;memory.delete(id);if(id===key){generation++;config=defaults();apply();}return store.put(id,defaults());}
    async function restore(value){
      if(!(value?.url?Sources?.isLink(value.url)&&!value.file:value?.file?.size&&typeof value.file.arrayBuffer==='function')||!['stage','dark','video'].includes(value.mode)||!Number.isFinite(value.offset)||Math.abs(value.offset)>900||!Number.isFinite(value.dim)||value.dim<0||value.dim>80)throw Error('The backup video settings are invalid.');
      const large=value.file?.size>500*1024*1024;
      generation++;config={...defaults(),...value,name:value.name||'Restored background video'};apply();const saved=await save();
      if(!saved&&!large)return 'Video restored for this session, but browser storage could not keep it. Keep the combined backup and free some device storage.';
      if(value.url)return 'Video link and timing restored with this chart. Internet access is required; the video itself is not included in this backup.';
      return large?'Video restored for this session. Choose Save video to setlist in Backgrounds / video to keep this large video on this device. Keep the combined backup too.':'Video and timing restored with this chart. Check Backgrounds / video to preview it.';
    }
    async function prepare({time=0,rate=1}={}){
      pause();if(config.mode!=='video'||!hasSource(config))return;
      if(youtube){const selected=youtube;try{return await selected.prepare({time,rate,offset:config.offset});}catch(error){if(youtube===selected&&error.backgroundVideo&&!/canceled/i.test(error.message))notify(error.message);throw error;}}
      let canceled=false,rejectWait=null;
      const failure=message=>Object.assign(Error(message),{backgroundVideo:true});
      const cancel=reason=>{canceled=true;rejectWait?.(reason?.backgroundVideo?reason:failure('Video preparation was canceled. Press Play track to try again.'));};
      preparation=cancel;
      function waitFor(check){
        return new Promise((resolve,reject)=>{
          const events=['loadedmetadata','loadeddata','canplay','seeked','error'];let done=false;
          const finish=error=>{if(done)return;done=true;clearTimeout(timer);for(const event of events)video.removeEventListener(event,inspect);rejectWait=null;error?reject(error):resolve();};
          const inspect=()=>{if(canceled)finish(failure('Video preparation was canceled.'));else if(video.error)finish(failure(mediaIssue||'The selected video cannot be decoded. Choose an H.264 MP4 or WebM in Backgrounds.'));else if(check())finish();};
          const timer=setTimeout(()=>finish(failure('The video is still loading or seeking. Open Backgrounds to check its preview, then try Play track again.')),readyTimeout);
          rejectWait=finish;for(const event of events)video.addEventListener(event,inspect);inspect();
        });
      }
      try{
        // Metadata alone does not guarantee a decoded frame. Do not schedule
        // the song until both decoding and the seek have finished.
        await waitFor(()=>video.readyState>=2&&Number.isFinite(video.duration));
        const target=Math.max(0,Math.min(time+config.offset,Math.max(0,video.duration-.04)));
        video.playbackRate=rate;
        if(Math.abs(video.currentTime-target)>.005)video.currentTime=target;
        await waitFor(()=>video.readyState>=2&&!video.seeking);
        loaded=true;timeline=null;appearance();
      }catch(error){throw error.backgroundVideo?error:failure('The video could not seek to its starting frame. Choose another video in Backgrounds.');}
      finally{if(preparation===cancel)preparation=null;}
    }
    function sync({time=0,playing=false,rate=1}={}){
      if(youtube){if(config.mode==='video')youtube.sync({time,playing,rate,offset:config.offset});return;}
      if(preparation)return;
      if(config.mode!=='video'||!hasSource(config)||!loaded){if(wanted||!video.paused)pause();return;}
      const position=time+config.offset,duration=video.duration;
      const target=Math.max(0,Number.isFinite(duration)?Math.min(position,Math.max(0,duration-.04)):position);
      wanted=playing&&time>=0&&position>=0&&(!Number.isFinite(duration)||position<duration);
      // Lock the starting frame to the song clock before playing. The relaxed
      // running tolerance must not swallow short intro offsets or a restart.
      const boundary=!timeline||wanted!==timeline.playing||rate!==timeline.rate||time<timeline.time||time-timeline.time>.5;
      const tolerance=(boundary||!wanted) ? .005 : .1;
      try{if(Math.abs(video.currentTime-target)>tolerance)video.currentTime=target;video.playbackRate=rate;}catch{}
      timeline={time,playing:wanted,rate};
      if(!wanted){playEpoch++;starting=false;video.pause();blocked=false;return;}
      if(video.paused&&!starting&&!blocked){
        const epoch=++playEpoch;starting=true;
        try{Promise.resolve(video.play()).then(()=>{if(!wanted)video.pause();},error=>{if(epoch===playEpoch&&error?.name!=='AbortError'){blocked=true;notify('Video could not play. Choose a browser-compatible MP4 or WebM in Backgrounds.');}}).finally(()=>{if(epoch===playEpoch)starting=false;});}
        catch{if(epoch===playEpoch){starting=false;blocked=true;notify('Video could not play. Choose a browser-compatible MP4 or WebM in Backgrounds.');}}
      }
    }
    video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.loop=false;video.preload='auto';
    video.addEventListener('loadedmetadata',()=>{if(!hasSource(config)||youtubeId())return;loaded=true;blocked=false;appearance();});
    video.addEventListener('loadeddata',()=>{if(!hasSource(config)||youtubeId())return;loaded=true;blocked=false;appearance();notify();});
    video.addEventListener('error',()=>{if(!hasSource(config)||youtubeId()||!video.error)return;loaded=false;
      mediaIssue=`“${config.name}” was selected, but its video could not open${video.error.code?' (media error '+video.error.code+')':''}. ${config.url?' Check the direct video link and internet connection; the host may block playback.':''} Try an MP4 encoded with H.264 or a WebM video.`;
      pause(Object.assign(Error(mediaIssue),{backgroundVideo:true}));stage.classList.remove('video-background');video.hidden=true;notify(mediaIssue);});
    return {selectSong,choose,chooseLink,settings,clear,sync,pause,prepare,attachment,restore,saveToSetlist,removeSong,settled:()=>queue,get hasVideo(){return hasSource(config);},get linked(){return !!config.url;},get youtube(){return !!youtubeId();},get busy(){return writes>0;},get mode(){return config.mode==='video'&&(!hasSource(config)||(youtube?youtube.failed:video.hidden))?'stage':config.mode;}};
  }
  const api={create,storage};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const $=id=>root.document.getElementById(id),video=$('backgroundVideo');if(!video)return;
  const picker=$('backgroundFile'),preview=$('backgroundPreview'),timingButton=$('backgroundPreviewTiming');
  let displayedSong=null,previewUrl=null,selection=Promise.resolve(),transportJob=0,currentSettings=defaults(),previewOffset=null,framePending=false,renderedLink=null;
  function seekPreviewFrame(){
    if(!preview||!previewUrl||!framePending||!(preview.readyState>=1))return;
    const target=Math.max(0,Number.isFinite(preview.duration)?Math.min(previewOffset,Math.max(0,preview.duration-.04)):previewOffset);
    try{preview.currentTime=target;framePending=false;}catch{}
  }
  function showTimingFrame(offset=currentSettings.offset,force=false){
    offset=clamp(offset,-900,900,0);
    if($('backgroundTimingHint'))$('backgroundTimingHint').textContent=offset<0?`Video waits ${Math.abs(offset).toFixed(1)} seconds after the first note, then starts at 0:00. Preview timing with chart to check this delay.`:`Video starts ${offset.toFixed(1)} seconds into the file when the first note reaches the hit line. Preview timing with chart to check this starting point.`;
    if(!preview)return;
    if(force||previewOffset!==offset){preview.pause();previewOffset=offset;framePending=true;seekPreviewFrame();}
  }
  const controls=['backgroundMode','backgroundFile','backgroundOffset','backgroundDim','backgroundRemove','backgroundLink','backgroundUseLink'];
  const backgroundStore=storage(root.indexedDB);
  const player=create(video,video.closest('.stage'),{store:backgroundStore,onChange:(value,message)=>{
    currentSettings={mode:value.mode,offset:value.offset,dim:value.dim};
    if($('backgroundYouTubeHint'))$('backgroundYouTubeHint').hidden=!value.youtube;
    const selectedLink=value.url||'';if($('backgroundLink')&&selectedLink!==renderedLink)$('backgroundLink').value=selectedLink;renderedLink=selectedLink;
    if($('backgroundSaveSetlist'))$('backgroundSaveSetlist').textContent=value.linked?'Save video link to setlist':'Save video to setlist';
    if($('backgroundExportVideo'))$('backgroundExportVideo').textContent=value.linked?'Save chart + video link backup':'Save chart + video backup';
    $('backgroundMode').value=value.mode;$('backgroundOffset').value=value.offset;$('backgroundDim').value=value.dim;$('backgroundDimValue').textContent=value.dim+'%';
    $('backgroundFilename').textContent=(value.linked?'Linked video · ':'')+(value.name||'No video selected for this song.');$('backgroundRemove').disabled=!value.hasVideo;
    if(timingButton)timingButton.disabled=!value.hasVideo||value.mode!=='video';
    for(const id of ['backgroundExportVideo','backgroundSaveSetlist'])if($(id))$(id).disabled=!value.hasVideo||displayedSong==='demo'||operations>0||player.busy;
    if(preview){
      const next=value.videoUrl||null;preview.hidden=!next;
      const changed=next!==previewUrl;
      if(changed){preview.pause();previewUrl=next;if(next)preview.src=next;else preview.removeAttribute('src');preview.load();}
      showTimingFrame(value.offset,changed);
    }
    if(message!==undefined){$('backgroundStatus').textContent=message;if($('backgroundLinkStatus'))$('backgroundLinkStatus').textContent=message;}
  }});
  let operations=0;
  async function edit(action){operations++;controls.forEach(id=>{if($(id))$(id).disabled=true;});try{return await action();}catch(error){const message=error?.message||'The video could not be opened. Try the link again or choose a video file.';$('backgroundStatus').textContent=message;if($('backgroundLinkStatus'))$('backgroundLinkStatus').textContent=message;return false;}finally{operations--;controls.forEach(id=>{if($(id))$(id).disabled=operations>0;});$('backgroundRemove').disabled=operations>0||!player.hasVideo;for(const id of ['backgroundExportVideo','backgroundSaveSetlist'])if($(id))$(id).disabled=operations>0||player.busy||!player.hasVideo||displayedSong==='demo';}}
  picker.addEventListener('change',()=>{const file=picker.files?.[0];if(!file)return;if($('backgroundLink'))$('backgroundLink').value='';return edit(()=>player.choose(file));});
  $('backgroundUseLink')?.addEventListener('click',()=>{const value=$('backgroundLink').value;return edit(()=>player.chooseLink(value));});
  $('backgroundLink')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const value=$('backgroundLink').value;return edit(()=>player.chooseLink(value));}});
  for(const id of ['backgroundMode','backgroundOffset','backgroundDim'])$(id).addEventListener('change',()=>edit(()=>player.settings({mode:$('backgroundMode').value,offset:$('backgroundOffset').value,dim:$('backgroundDim').value})));
  $('backgroundOffset').addEventListener('input',()=>showTimingFrame($('backgroundOffset').value,true));
  $('backgroundDim').addEventListener('input',()=>{$('backgroundDimValue').textContent=$('backgroundDim').value+'%';});
  $('backgroundRemove').addEventListener('click',()=>{picker.value='';if($('backgroundLink'))$('backgroundLink').value='';return edit(()=>player.clear());});
  if(preview){
    preview.muted=true;preview.volume=0;
    preview.addEventListener('loadedmetadata',seekPreviewFrame);
    preview.addEventListener('volumechange',()=>{if(!preview.muted)preview.muted=true;});
    for(const event of ['close','cancel'])$('backgroundDialog').addEventListener(event,()=>preview.pause());
  }
  const pauseAll=()=>{transportJob++;preview?.pause();player.pause();};
  const commitTiming=()=>{const next={mode:$('backgroundMode').value,offset:clamp($('backgroundOffset').value,-900,900,0),dim:clamp($('backgroundDim').value,0,80,35)};return Object.keys(next).every(key=>next[key]===currentSettings[key])?Promise.resolve():player.settings(next);};
  root.RiffBackground={selectSong:id=>{if(id===displayedSong)return selection;displayedSong=id;picker.value='';$('backgroundStatus').textContent='';selection=player.selectSong(id);return selection;},
    prepare:async options=>{const job=transportJob;preview?.pause();await selection;if(job!==transportJob)throw Object.assign(Error('Video preparation was canceled.'),{backgroundVideo:true});return player.prepare(options);},
    commitTiming,
    attachment:async id=>{await selection;if(id!==displayedSong)throw Error('Open the song paired with this video before exporting.');await commitTiming();if(id!==displayedSong)throw Error('The song changed before its video backup was ready.');return player.attachment();},
    saveToSetlist:async id=>{await selection;return edit(async()=>{if(id!==displayedSong)throw Error('Open the song paired with this video before saving.');await commitTiming();if(id!==displayedSong)throw Error('The song changed before its video could be saved.');return player.saveToSetlist();});},
    savedSongs:async ids=>{await player.settled();return backgroundStore.savedSongs(ids);},linkedSongs:async ids=>{await player.settled();return backgroundStore.linkedSongs(ids);},removeSong:id=>player.removeSong(id),
    restore:async(id,value)=>{await selection;if(id!==displayedSong)throw Error('The song changed before its video could be restored.');return player.restore(value);},
    showTimingFrame:()=>showTimingFrame(currentSettings.offset,true),sync:(...args)=>player.sync(...args),pause:pauseAll,get hasVideo(){return player.hasVideo;},get linked(){return player.linked;},get youtube(){return player.youtube;},get busy(){return operations>0||player.busy;},get mode(){return player.mode;}};
})(typeof window!=='undefined'?window:globalThis);
