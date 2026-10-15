/* Per-song local backgrounds. Song audio remains the only audible track. */
(function(root){
  'use strict';
  const defaults=()=>({mode:'stage',offset:0,dim:35,file:null,name:''});
  const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
  function storage(indexedDB){
    let opening;
    const open=()=>opening||(opening=new Promise((resolve,reject)=>{
      if(!indexedDB){reject(Error('Video storage is unavailable.'));return;}
      const request=indexedDB.open('riffbound-backgrounds-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('songs');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    }).catch(error=>{opening=null;throw error;}));
    async function transaction(key,value,write){
      const db=await open();return new Promise((resolve,reject)=>{
        const tx=db.transaction('songs',write?'readwrite':'readonly'),table=tx.objectStore('songs');
        const request=write?table.put(value,key):table.get(key);
        tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Video storage failed.'));
      });
    }
    return {get:key=>transaction(key,null,false),put:(key,value)=>transaction(key,value,true)};
  }
  function create(video,stage,{store=storage(root.indexedDB),url=root.URL,onChange=()=>{},readyTimeout=15000}={}){
    let key=null,config=defaults(),objectUrl=null,generation=0,writes=0,blocked=false,starting=false,wanted=false,loaded=false,mediaIssue='',timeline=null,preparation=null,playEpoch=0;
    const memory=new Map();let queue=Promise.resolve();
    function notify(message){onChange({...config,hasVideo:!!config.file,videoUrl:objectUrl},message);}
    function pause(reason){wanted=false;timeline=null;playEpoch++;starting=false;video.pause();preparation?.(reason);}
    function release(){pause();loaded=false;if(objectUrl){video.removeAttribute('src');video.load();url.revokeObjectURL(objectUrl);objectUrl=null;}}
    function appearance(){
      stage.classList.toggle('video-background',config.mode==='video'&&!!config.file);
      stage.classList.toggle('dark-background',config.mode==='dark');
      video.hidden=config.mode!=='video'||!config.file;video.style.filter=`brightness(${1-config.dim/100})`;
      video.muted=true;video.volume=0;
    }
    function apply(){
      release();blocked=false;starting=false;mediaIssue='';
      if(config.file){objectUrl=url.createObjectURL(config.file);video.src=objectUrl;video.load();}
      appearance();notify();
    }
    async function selectSong(next){
      if(next===key)return;key=next;const version=++generation;
      config=defaults();apply();
      try{const saved=memory.get(next)||await store.get(next);if(version!==generation)return;
        if(saved){config={...defaults(),...saved};config.offset=clamp(config.offset,-900,900,0);config.dim=clamp(config.dim,0,80,35);if(!['stage','dark','video'].includes(config.mode))config.mode='stage';apply();}
      }catch{if(version===generation)notify('Backgrounds are available for this session. Browser storage could not be opened.');}
    }
    function save(){
      const owner=key,value={...config},sessionOnly=value.file?.size>500*1024*1024;
      memory.set(owner,value);writes++;
      const persisted=sessionOnly?{...value,mode:'stage',file:null,name:''}:value;
      queue=queue.catch(()=>{}).then(()=>store.put(owner,persisted)).then(()=>{if(owner===key&&value.file===config.file)notify(mediaIssue||(sessionOnly?'Video selected for this session. Videos larger than 500 MB are not stored; choose it again after reopening the game.':'Background saved for this song on this device.'));},()=>{if(owner===key&&value.file===config.file)notify(mediaIssue||'Background works for this session, but could not be saved. Free some browser storage and select it again.');}).finally(()=>writes--);
      return queue;
    }
    async function choose(file){
      if(!file)return false; // Canceling the picker leaves the current background alone.
      if(!file.size){notify(`“${file.name||'This file'}” is empty. Choose a video containing data.`);return false;}
      if(!(/^video\//i.test(file.type)||/\.(mp4|webm|mov|m4v|ogv|mkv|avi|mpg|mpeg|ts|m2ts)$/i.test(file.name||''))){notify(`“${file.name||'This file'}” is not a video file. Choose the actual MP4 or WebM recording, rather than a shortcut, image or chart.`);return false;}
      generation++;config={...config,file,name:file.name,mode:'video'};apply();notify('Loading video: '+file.name+'…');await save();return true;
    }
    function settings(values){
      generation++;config={...config,...values,offset:clamp(values.offset??config.offset,-900,900,0),dim:clamp(values.dim??config.dim,0,80,35)};
      if(!['stage','dark','video'].includes(config.mode))config.mode='stage';
      pause();blocked=false;appearance();notify(config.mode==='video'&&!config.file?'Choose a video file for this song.':'');return save();
    }
    function clear(){generation++;config={...config,file:null,name:'',mode:'stage'};apply();return save();}
    async function prepare({time=0,rate=1}={}){
      pause();if(config.mode!=='video'||!config.file)return;
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
      if(preparation)return;
      if(config.mode!=='video'||!config.file||!loaded){if(wanted||!video.paused)pause();return;}
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
    video.addEventListener('loadedmetadata',()=>{if(!objectUrl)return;loaded=true;blocked=false;appearance();});
    video.addEventListener('loadeddata',()=>{if(!objectUrl)return;loaded=true;blocked=false;appearance();notify();});
    video.addEventListener('error',()=>{if(!objectUrl||!video.error)return;loaded=false;
      mediaIssue=`“${config.name}” was selected, but its video could not open${video.error.code?' (media error '+video.error.code+')':''}. Try an MP4 encoded with H.264 or a WebM video.`;
      pause(Object.assign(Error(mediaIssue),{backgroundVideo:true}));stage.classList.remove('video-background');video.hidden=true;notify(mediaIssue);});
    return {selectSong,choose,settings,clear,sync,pause,prepare,get hasVideo(){return !!config.file;},get busy(){return writes>0;},get mode(){return config.mode==='video'&&(!config.file||video.hidden)?'stage':config.mode;}};
  }
  const api={create,storage};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const $=id=>root.document.getElementById(id),video=$('backgroundVideo');if(!video)return;
  const picker=$('backgroundFile'),preview=$('backgroundPreview'),timingButton=$('backgroundPreviewTiming');
  let displayedSong=null,previewUrl=null,selection=Promise.resolve(),transportJob=0,currentSettings=defaults(),previewOffset=null,framePending=false;
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
  const controls=['backgroundMode','backgroundFile','backgroundOffset','backgroundDim','backgroundRemove'];
  const player=create(video,video.closest('.stage'),{onChange:(value,message)=>{
    currentSettings={mode:value.mode,offset:value.offset,dim:value.dim};
    $('backgroundMode').value=value.mode;$('backgroundOffset').value=value.offset;$('backgroundDim').value=value.dim;$('backgroundDimValue').textContent=value.dim+'%';
    $('backgroundFilename').textContent=value.name||'No video selected for this song.';$('backgroundRemove').disabled=!value.hasVideo;
    if(timingButton)timingButton.disabled=!value.hasVideo||value.mode!=='video';
    if(preview){
      const next=value.videoUrl||null;preview.hidden=!next;
      const changed=next!==previewUrl;
      if(changed){preview.pause();previewUrl=next;if(next)preview.src=next;else preview.removeAttribute('src');preview.load();}
      showTimingFrame(value.offset,changed);
    }
    if(message!==undefined)$('backgroundStatus').textContent=message;
  }});
  let operations=0;
  async function edit(action){operations++;controls.forEach(id=>$(id).disabled=true);try{await action();}catch{$('backgroundStatus').textContent='The video could not be opened. Choose the file again, or try an H.264 MP4 / WebM video.';}finally{operations--;controls.forEach(id=>$(id).disabled=false);$('backgroundRemove').disabled=!player.hasVideo;}}
  picker.addEventListener('change',()=>{const file=picker.files?.[0];if(!file)return;return edit(()=>player.choose(file));});
  for(const id of ['backgroundMode','backgroundOffset','backgroundDim'])$(id).addEventListener('change',()=>edit(()=>player.settings({mode:$('backgroundMode').value,offset:$('backgroundOffset').value,dim:$('backgroundDim').value})));
  $('backgroundOffset').addEventListener('input',()=>showTimingFrame($('backgroundOffset').value,true));
  $('backgroundDim').addEventListener('input',()=>{$('backgroundDimValue').textContent=$('backgroundDim').value+'%';});
  $('backgroundRemove').addEventListener('click',()=>{picker.value='';return edit(()=>player.clear());});
  if(preview){
    preview.muted=true;preview.volume=0;
    preview.addEventListener('loadedmetadata',seekPreviewFrame);
    preview.addEventListener('volumechange',()=>{if(!preview.muted)preview.muted=true;});
    for(const event of ['close','cancel'])$('backgroundDialog').addEventListener(event,()=>preview.pause());
  }
  const pauseAll=()=>{transportJob++;preview?.pause();player.pause();};
  root.RiffBackground={selectSong:id=>{if(id===displayedSong)return selection;displayedSong=id;picker.value='';$('backgroundStatus').textContent='';selection=player.selectSong(id);return selection;},
    prepare:async options=>{const job=transportJob;preview?.pause();await selection;if(job!==transportJob)throw Object.assign(Error('Video preparation was canceled.'),{backgroundVideo:true});return player.prepare(options);},
    commitTiming:()=>{const next={mode:$('backgroundMode').value,offset:clamp($('backgroundOffset').value,-900,900,0),dim:clamp($('backgroundDim').value,0,80,35)};return Object.keys(next).every(key=>next[key]===currentSettings[key])?Promise.resolve():player.settings(next);},
    showTimingFrame:()=>showTimingFrame(currentSettings.offset,true),sync:(...args)=>player.sync(...args),pause:pauseAll,get busy(){return operations>0||player.busy;},get mode(){return player.mode;}};
})(typeof window!=='undefined'?window:globalThis);
