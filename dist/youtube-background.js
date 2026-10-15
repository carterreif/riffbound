/* YouTube backgrounds use the official IFrame API; no media is extracted. */
(function(root){
  'use strict';
  const apiLoads=new WeakMap();
  const failure=message=>Object.assign(Error(message),{backgroundVideo:true});
  function loadApi(environment=root,timeout=15000){
    if(environment.YT?.Player)return Promise.resolve(environment.YT);
    if(apiLoads.has(environment))return apiLoads.get(environment);
    let script,callback,settled=false,previous=environment.onYouTubeIframeAPIReady;
    const promise=new Promise((resolve,reject)=>{
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);if(environment.onYouTubeIframeAPIReady===callback)environment.onYouTubeIframeAPIReady=previous;if(error){script?.remove();reject(error);}else resolve(environment.YT);};
      const timer=setTimeout(()=>finish(failure('YouTube could not load. Check your connection or browser blocking settings, or choose a video file.')),timeout);
      callback=()=>{try{previous?.();}catch{}if(environment.YT?.Player)finish();else finish(failure('YouTube did not initialize. Try the link again.'));};environment.onYouTubeIframeAPIReady=callback;
      try{script=environment.document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>finish(failure('YouTube is blocked or unavailable. Check your connection or choose a video file.'));environment.document.head.append(script);}catch{finish(failure('YouTube could not load in this browser. Open Riffbound directly and try again.'));}
    });
    apiLoads.set(environment,promise);promise.catch(()=>{if(apiLoads.get(environment)===promise)apiLoads.delete(environment);});return promise;
  }
  function errorMessage(code){
    return code===100?'This YouTube video is unavailable or private. Choose another video or upload a file.':code===101||code===150?'This YouTube video does not allow embedded playback. Choose another video or upload a file.':code===153?'YouTube could not identify this embedded page. Open Riffbound directly in a browser tab and try again.':`YouTube could not play this video${code?' (error '+code+')':''}. Try another link or upload a video file.`;
  }
  function create(stage,{environment=root,onError=()=>{},onReady=()=>{},timeout=15000,apiLoader=()=>loadApi(environment,timeout),now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
    const holder=environment.document.createElement('div');holder.className='youtube-background';holder.hidden=true;stage.append(holder);
    let player=null,ready=false,destroyed=false,issue=null,loadPromise=Promise.resolve(),wanted=false,preparing=false,prepareGeneration=0,timeline=null,startRequested=false,lastSeek=-Infinity;
    const report=error=>{if(destroyed)return;issue=error?.backgroundVideo?error:failure(error?.message||'YouTube could not play.');wanted=false;startRequested=false;holder.hidden=true;try{player?.pauseVideo();}catch{}onError(issue.message);};
    function appearance({visible=false,dim=35}={}){holder.hidden=!visible||!!issue;holder.style.filter=`brightness(${1-dim/100})`;}
    function pause(){prepareGeneration++;preparing=false;wanted=false;startRequested=false;timeline=null;try{player?.pauseVideo();}catch{}}
    function destroy(){if(destroyed)return;pause();destroyed=true;try{player?.destroy();}catch{}holder.remove();player=null;}
    function load(id){
      if(!/^[A-Za-z0-9_-]{11}$/.test(id||'')){report(failure('Use a valid YouTube video link.'));return Promise.resolve();}
      loadPromise=(async()=>{
        const YT=await apiLoader();if(destroyed)return;
        const frame=environment.document.createElement('iframe'),origin=environment.location?.origin;
        if(!origin||!/^https?:\/\//.test(origin))throw failure('Open Riffbound directly over HTTPS to use YouTube backgrounds.');
        frame.title='YouTube background video';frame.allow='autoplay; encrypted-media; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('frameborder','0');frame.setAttribute('tabindex','-1');
        frame.src=`https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(origin)}&autoplay=0&playsinline=1&controls=0&disablekb=1&rel=0`;holder.append(frame);
        player=new YT.Player(frame,{events:{
          onReady:event=>{if(destroyed||issue){try{event.target.destroy();}catch{}return;}player=event.target;player.mute();player.setVolume(0);player.pauseVideo();ready=true;onReady();},
          onStateChange:event=>{if(destroyed)return;if(event.data===1){startRequested=false;if(!wanted)player?.pauseVideo();}if(event.data===0)startRequested=false;},
          onAutoplayBlocked:()=>report(failure('This browser blocked YouTube playback. Open Riffbound directly, allow video playback, and retry the link.')),
          onError:event=>report(failure(errorMessage(event.data)))
        }});
      })().catch(report);return loadPromise;
    }
    async function waitFor(check,generation,message){
      const deadline=now()+timeout;
      while(true){if(destroyed||generation!==prepareGeneration)throw failure('Video preparation was canceled.');if(issue)throw issue;if(check())return;if(now()>=deadline)throw failure(message);await delay(50);}
    }
    async function prepare({time=0,rate=1,offset=0}={}){
      pause();const generation=++prepareGeneration;preparing=true;
      try{
        await loadPromise;
        await waitFor(()=>ready&&Number.isFinite(player?.getDuration())&&player.getDuration()>0,generation,'YouTube is still loading. Retry the link or choose a video file.');
        const rates=player.getAvailablePlaybackRates?.()||[1];
        if(!rates.some(value=>Math.abs(value-rate)<.001))throw failure(`This YouTube video does not support ${Math.round(rate*100)}% speed. Choose ${rates.filter(value=>value<=1).map(value=>Math.round(value*100)+'%').join(', ')} in Practice, or use a video file for other speeds.`);
        player.setPlaybackRate(rate);
        await waitFor(()=>Math.abs(player.getPlaybackRate()-rate)<.001,generation,'YouTube did not apply the selected practice speed. Choose another speed or a video file.');
        const target=Math.max(0,Math.min(time+offset,Math.max(0,player.getDuration()-.04)));player.mute();player.pauseVideo();player.seekTo(target,true);player.pauseVideo();lastSeek=now();
        // YouTube seeks to keyframes. Confirm a paused nearby position, then
        // correct drift against the song clock when actual playback begins.
        await waitFor(()=>[2,5].includes(player.getPlayerState())&&Math.abs(player.getCurrentTime()-target)<=2.5,generation,'YouTube is still buffering or seeking. Retry the link or choose a video file.');
        timeline=null;
      }finally{if(generation===prepareGeneration)preparing=false;}
    }
    function sync({time=0,playing=false,rate=1,offset=0}={}){
      if(destroyed||issue||!ready||preparing)return;
      try{
        const duration=player.getDuration();if(!Number.isFinite(duration)||duration<=0)return;
        const position=time+offset,target=Math.max(0,Math.min(position,Math.max(0,duration-.04))),next=playing&&position>=0&&position<duration;
        const boundary=!timeline||next!==timeline.playing||time<timeline.time||time-timeline.time>.5;
        wanted=next;
        if(Math.abs(player.getCurrentTime()-target)>(next ? .65 : .35)&&(boundary||now()-lastSeek>=1000)){player.seekTo(target,true);lastSeek=now();}
        const state=player.getPlayerState();
        if(!next){startRequested=false;if(state===1||boundary)player.pauseVideo();}
        else if(state!==1&&state!==3&&!startRequested){startRequested=true;player.mute();player.playVideo();}
        timeline={time,playing:next,rate};
      }catch(error){report(error);}
    }
    return {load,prepare,sync,pause,destroy,appearance,get failed(){return !!issue;},get error(){return issue;},get element(){return holder;}};
  }
  const api={loadApi,errorMessage,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffYouTubeBackground=api;
})(typeof window!=='undefined'?window:globalThis);
