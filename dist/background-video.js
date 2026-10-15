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
  function create(video,stage,{store=storage(root.indexedDB),url=root.URL,onChange=()=>{}}={}){
    let key=null,config=defaults(),objectUrl=null,generation=0,writes=0,blocked=false,starting=false,wanted=false,loaded=false;
    const memory=new Map();let queue=Promise.resolve();
    function notify(message){onChange({...config,hasVideo:!!config.file},message);}
    function pause(){wanted=false;video.pause();}
    function release(){pause();loaded=false;if(objectUrl){video.removeAttribute('src');video.load();url.revokeObjectURL(objectUrl);objectUrl=null;}}
    function appearance(){
      stage.classList.toggle('video-background',config.mode==='video'&&!!config.file);
      stage.classList.toggle('dark-background',config.mode==='dark');
      video.hidden=config.mode!=='video'||!config.file;video.style.filter=`brightness(${1-config.dim/100})`;
      video.muted=true;video.volume=0;
    }
    function apply(){
      release();blocked=false;starting=false;
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
      const owner=key,value={...config};memory.set(owner,value);writes++;
      queue=queue.catch(()=>{}).then(()=>store.put(owner,value)).then(()=>{if(owner===key)notify('Background saved for this song on this device.');},()=>{if(owner===key)notify('Background works for this session, but could not be saved. Free some browser storage and select it again.');}).finally(()=>writes--);
      return queue;
    }
    async function choose(file){
      if(!file||!file.size||file.size>500*1024*1024||!(/^video\//i.test(file.type)||/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name||''))){notify('Choose a non-empty video up to 500 MB. MP4 or WebM is recommended.');return false;}
      generation++;config={...config,file,name:file.name,mode:'video'};apply();await save();return true;
    }
    function settings(values){
      generation++;config={...config,...values,offset:clamp(values.offset??config.offset,-900,900,0),dim:clamp(values.dim??config.dim,0,80,35)};
      if(!['stage','dark','video'].includes(config.mode))config.mode='stage';
      pause();blocked=false;appearance();notify(config.mode==='video'&&!config.file?'Choose a video file for this song.':'');return save();
    }
    function clear(){generation++;config={...config,file:null,name:'',mode:'stage'};apply();return save();}
    function sync({time=0,playing=false,rate=1}={}){
      if(config.mode!=='video'||!config.file||!loaded){if(wanted||!video.paused)pause();return;}
      const position=time+config.offset,duration=video.duration;
      const target=Math.max(0,Number.isFinite(duration)?Math.min(position,Math.max(0,duration-.04)):position);
      try{if(Math.abs(video.currentTime-target)>.18)video.currentTime=target;video.playbackRate=rate;}catch{}
      wanted=playing&&time>=0&&position>=0&&(!Number.isFinite(duration)||position<duration);
      if(!wanted){video.pause();blocked=false;return;}
      if(video.paused&&!starting&&!blocked){
        starting=true;Promise.resolve().then(()=>video.play()).then(()=>{if(!wanted)video.pause();},error=>{if(error?.name!=='AbortError'){blocked=true;notify('Video could not play. Choose a browser-compatible MP4 or WebM in Backgrounds.');}}).finally(()=>starting=false);
      }
    }
    video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.loop=false;
    video.addEventListener('loadedmetadata',()=>{loaded=true;blocked=false;});
    video.addEventListener('error',()=>{if(!objectUrl)return;loaded=false;pause();stage.classList.remove('video-background');video.hidden=true;notify('This video could not open. Choose an MP4 or WebM your browser can play.');});
    return {selectSong,choose,settings,clear,sync,pause,get hasVideo(){return !!config.file;},get busy(){return writes>0;},get mode(){return config.mode==='video'&&(!config.file||video.hidden)?'stage':config.mode;}};
  }
  const api={create,storage};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const $=id=>root.document.getElementById(id),video=$('backgroundVideo');if(!video)return;
  const controls=['backgroundMode','backgroundFile','backgroundOffset','backgroundDim','backgroundRemove'];
  const player=create(video,video.closest('.stage'),{onChange:(value,message)=>{
    $('backgroundMode').value=value.mode;$('backgroundOffset').value=value.offset;$('backgroundDim').value=value.dim;$('backgroundDimValue').textContent=value.dim+'%';
    $('backgroundFilename').textContent=value.name||'No video selected for this song.';$('backgroundRemove').disabled=!value.hasVideo;
    if(message!==undefined)$('backgroundStatus').textContent=message;
  }});
  let operations=0;
  async function edit(action){operations++;controls.forEach(id=>$(id).disabled=true);try{await action();}finally{operations--;controls.forEach(id=>$(id).disabled=false);$('backgroundRemove').disabled=!player.hasVideo;$('backgroundFile').value='';}}
  $('backgroundFile').addEventListener('change',()=>edit(()=>player.choose($('backgroundFile').files?.[0])));
  for(const id of ['backgroundMode','backgroundOffset','backgroundDim'])$(id).addEventListener('change',()=>edit(()=>player.settings({mode:$('backgroundMode').value,offset:$('backgroundOffset').value,dim:$('backgroundDim').value})));
  $('backgroundDim').addEventListener('input',()=>{$('backgroundDimValue').textContent=$('backgroundDim').value+'%';});
  $('backgroundRemove').addEventListener('click',()=>edit(()=>player.clear()));
  root.RiffBackground={selectSong:(...args)=>player.selectSong(...args),sync:(...args)=>player.sync(...args),pause:()=>player.pause(),get busy(){return operations>0||player.busy;},get mode(){return player.mode;}};
})(typeof window!=='undefined'?window:globalThis);
