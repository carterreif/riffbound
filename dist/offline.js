(() => {
  'use strict';
  const $=id=>document.getElementById(id),config=window.RiffOfflineAssets;
  const supported='serviceWorker' in navigator&&window.isSecureContext;
  let installPrompt=null,registration=null,starting=null,pendingUpdate=null,reloadPending=false,reloading=false;
  let lastCheck=0,activationAt=0,retryTimer=null;
  let checking=false,checked=false,checkError='',statusGeneration=0;
  let downloading=false,downloadMessage='';
  $('offlineVersion').textContent=$('gameVersion').textContent;
  $('reloadGameButton').hidden=false;
  const ready=async()=>{if(!('caches' in window))return false;const cache=await caches.open(config.version);return (await Promise.all(config.files.map(file=>cache.match(new URL(file,location.href).href)))).every(Boolean);};
  const safe=manual=>!document.hidden&&window.RiffUpdateSafety?.canReload(manual);
  const newerVersion=value=>{
    const parts=s=>/v(\d+)(?:-(\d+))?$/.exec(s||'');
    const next=parts(value),current=parts(config.version);
    return !!next&&!!current&&(+next[1]>+current[1]||+next[1]===+current[1]&&+(next[2]||0)>+(current[2]||0));
  };
  function explain(error){
    const detail=String(error?.message||error||'Unknown browser error').slice(0,300);
    if(error?.name==='QuotaExceededError'||/quota|not enough space|insufficient storage|full disk|disk full|no space/i.test(detail))return 'The browser has insufficient storage. Free some device space, then retry. Your setlist has not been removed. '+detail;
    if(error?.name==='SecurityError'||/denied|blocked|insecure/i.test(detail))return 'This browser blocked offline storage. Open this same game link directly in Safari or Chrome and retry. '+detail;
    return detail;
  }
  async function bounded(operation,message){
    let timer;
    try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),30000);})]);}
    finally{clearTimeout(timer);}
  }
  function retryLater(){if(!retryTimer)retryTimer=setTimeout(()=>{retryTimer=null;applyUpdate();},5000);}
  function applyUpdate(manual=false){
    if(reloading||(!pendingUpdate&&!reloadPending))return;
    statusGeneration++;$('reloadGameButton').textContent='Use updated game';$('reloadGameButton').disabled=false;
    if(downloading){retryLater();return;}
    if(manual&&safe(true))$('offlineDialog').close();
    if(!safe(manual)){
      $('offlineStatus').textContent='Update ready. It will apply automatically between songs after your song is saved and other panels are closed.';
      retryLater();return;
    }
    if(reloadPending){
      if(!window.RiffUpdateSafety.prepareReload(manual)){
        $('offlineStatus').textContent='Update ready. Keep this song saved; automatic refresh is waiting for browser storage.';retryLater();return;
      }
      reloading=true;$('reloadGameButton').disabled=true;location.reload();return;
    }
    if(Date.now()-activationAt<30000){retryLater();return;}
    activationAt=Date.now();
    $('offlineStatus').textContent='Applying the latest game update…';
    pendingUpdate.postMessage({type:'ACTIVATE_UPDATE',automatic:true});retryLater();
  }
  function offerUpdate(worker){pendingUpdate=worker;applyUpdate();}
  async function status(){
    const generation=++statusGeneration;
    if(pendingUpdate||reloadPending){applyUpdate();return;}
    $('reloadGameButton').textContent=checking?'Checking…':'Check for updates';$('reloadGameButton').disabled=checking||downloading||!supported;
    if(!supported){$('offlineStatus').textContent='Automatic updates and offline play need a supported browser over HTTPS. You can still play online.';return;}
    if(downloading){$('offlineStatus').textContent=downloadMessage;return;}
    if(checking){$('offlineStatus').textContent='Checking for game updates…';return;}
    if(checkError){$('offlineStatus').textContent=checkError;return;}
    if(registration?.installing&&!['activated','redundant'].includes(registration.installing.state)){$('offlineStatus').textContent='Downloading game files… Keep the game open. Use updated game will appear if a refresh is needed.';return;}
    try{
      const saved=await ready();if(generation!==statusGeneration)return;
      $('offlineStatus').textContent=navigator.onLine===false?'You are offline. Connect to the internet to check for updates. '+(saved?'Your offline game is ready.':''):checked?'No new update found. '+$('gameVersion').textContent+'. '+(saved?'Ready for offline play.':'Use Save game for offline play to retry the download.'):'Updates are automatic while online. Use Check for updates to check now.';
    }catch{if(generation===statusGeneration)$('offlineStatus').textContent='Offline storage is unavailable in this browser. You can still play online.';}
  }
  const watched=new WeakSet();
  function watch(reg){
    registration=reg;if(reg.waiting)offerUpdate(reg.waiting);
    if(watched.has(reg))return;watched.add(reg);
    function installing(){
      const worker=reg.installing;if(!worker)return;
      status();
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&reg.active)offerUpdate(reg.waiting||worker);
        if(worker.state==='activated'){checkError='';status();}
        if(worker.state==='redundant'){
          if(pendingUpdate===worker)pendingUpdate=null;
          checkError='The download did not finish. Your current game and saved songs are still available. Check your connection and free space, then try Check for updates again.';status();
        }
      });
    }
    reg.addEventListener('updatefound',installing);installing();
  }
  async function check(force=false){
    if(!supported||navigator.onLine===false||document.hidden){if(force){checkError='';status();}return;}
    if(starting)return starting;
    if(!force&&Date.now()-lastCheck<60000)return;
    lastCheck=Date.now();checking=true;checkError='';status();
    starting=(async()=>{
      try{
        let reg=registration;
        // A failed first install leaves an empty registration. Register again
        // instead of repeatedly calling update() on that unusable object.
        if(!reg||(!reg.active&&!reg.waiting&&!reg.installing)){
          reg=await bounded(navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}),'Offline setup timed out. Check your connection and retry.');watch(reg);
        }else if(!reg.installing){await bounded(reg.update(),'The update check timed out. Check your connection and retry.');}
        checked=true;checking=false;if(reg.waiting)offerUpdate(reg.waiting);else await status();
      }catch(error){
        checkError='Could not check for updates. '+explain(error)+' Your current game and saved songs are still available.';
      }finally{checking=false;starting=null;status();}
    })();
    return starting;
  }
  function waitForWorker(reg){
    if(reg.waiting){offerUpdate(reg.waiting);return Promise.resolve(null);}
    const worker=reg.installing||reg.active;
    if(!worker)return Promise.reject(Error('Offline setup did not start. Tap Save game for offline play to retry.'));
    if(worker.state==='activated')return Promise.resolve(worker);
    return new Promise((resolve,reject)=>{
      const finish=(error,value)=>{clearTimeout(timer);worker.removeEventListener('statechange',change);error?reject(error):resolve(value);};
      const change=()=>{
        if(worker.state==='activated')finish(null,worker);
        else if(worker.state==='installed'&&reg.active&&reg.active!==worker){offerUpdate(worker);finish(null,null);}
        else if(worker.state==='redundant')finish(Error('The game download failed. Check your connection and free space, then tap Save game for offline play again.'));
      };
      const timer=setTimeout(()=>finish(Error('The offline download timed out. Check your connection, then retry.')),60000);
      worker.addEventListener('statechange',change);change();
    });
  }
  function repairOffline(worker){
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();let timer;
      const finish=error=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve();};
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('The offline download stopped responding. Reopen the game while online and retry.')),60000);};
      channel.port1.onmessage=event=>{
        const data=event.data;
        if(data?.type==='PROGRESS'){downloadMessage=`Saving game files… ${data.completed} of ${data.total} downloaded.`;status();arm();}
        else if(data?.type==='SAVED'&&data.version===config.version)finish();
        else if(data?.type==='ERROR')finish(Error(data.message));
      };
      arm();try{worker.postMessage({type:'SAVE_OFFLINE',version:config.version},[channel.port2]);}catch(error){finish(error);}
    });
  }
  $('downloadGameButton').addEventListener('click',async()=>{
    if(downloading)return;
    if(!supported){$('offlineStatus').textContent='Offline play needs a browser that supports it over HTTPS. You can still play online.';return;}
    downloading=true;downloadMessage='Preparing the offline game…';checkError='';$('downloadGameButton').disabled=true;$('downloadGameButton').textContent='Saving game…';status();
    try{
      if(navigator.onLine===false&&await ready()&&registration?.active){downloadMessage='Game saved for offline play. Open a saved song from your setlist.';return;}
      if(navigator.onLine===false)throw Error('Connect to the internet first, then tap Save game for offline play.');
      await check(true);if(checkError)throw Error(checkError);
      downloadMessage='Downloading game files… Keep the game open.';status();
      const worker=await waitForWorker(registration);if(!worker)return;
      if(!await ready())await repairOffline(worker);
      if(!await ready())throw Error('Some game files are still missing. Tap Save game for offline play to retry.');
      if(navigator.storage?.persist)navigator.storage.persist().catch(()=>false);
      downloadMessage='Game saved for offline play. Open a saved song from your setlist.';
    }catch(error){checkError='Could not save the offline game. '+explain(error);}
    finally{
      downloading=false;$('downloadGameButton').disabled=false;$('downloadGameButton').textContent='Save game for offline play';
      statusGeneration++;if(pendingUpdate||reloadPending||checkError)status();
      else{$('reloadGameButton').disabled=false;$('reloadGameButton').textContent='Check for updates';$('offlineStatus').textContent=downloadMessage;}
    }
  });
  $('offlineButton').addEventListener('click',()=>{status();check();});
  $('reloadGameButton').addEventListener('click',async()=>{
    if(pendingUpdate||reloadPending){applyUpdate(true);return;}
    await check(true);if(pendingUpdate||reloadPending)applyUpdate(true);
  });
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installAppButton').hidden=false;});
  $('installAppButton').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('installAppButton').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('installAppButton').hidden=true;$('installInstructions').textContent='Riffbound is installed. Open it from your home screen.';});
  if(supported){
    navigator.serviceWorker.addEventListener('controllerchange',()=>navigator.serviceWorker.controller?.postMessage({type:'GET_VERSION'}));
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.source!==navigator.serviceWorker.controller&&event.source!==pendingUpdate)return;
      if(event.data?.type==='GAME_VERSION'&&newerVersion(event.data.version)){reloadPending=true;pendingUpdate=null;applyUpdate();}
      if(event.data?.type==='UPDATE_DEFERRED'){$('offlineStatus').textContent='Update ready. Close other Riffbound tabs to let this game update automatically.';retryLater();}
    });
    window.addEventListener('online',()=>{check(true);applyUpdate();});
    window.addEventListener('focus',()=>{check();applyUpdate();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();applyUpdate();}});
    // Mobile apps can remain open for hours. The browser pauses this timer in the background.
    setInterval(()=>check(),5*60*1000);
    navigator.serviceWorker.controller?.postMessage({type:'GET_VERSION'});
    check(true);
  }else status();
})();
