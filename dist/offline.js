(() => {
  'use strict';
  const $=id=>document.getElementById(id),config=window.RiffOfflineAssets;
  const supported='serviceWorker' in navigator&&window.isSecureContext;
  let installPrompt=null,registration=null,starting=null,pendingUpdate=null,reloadPending=false,reloading=false;
  let lastCheck=0,activationAt=0,retryTimer=null;
  const ready=async()=>{if(!('caches' in window))return false;const cache=await caches.open(config.version);return (await Promise.all(config.files.map(file=>cache.match(new URL(file,location.href).href)))).every(Boolean);};
  const safe=manual=>!document.hidden&&window.RiffUpdateSafety?.canReload(manual);
  function retryLater(){if(!retryTimer)retryTimer=setTimeout(()=>{retryTimer=null;applyUpdate();},5000);}
  function applyUpdate(manual=false){
    if(reloading||(!pendingUpdate&&!reloadPending))return;
    $('reloadGameButton').hidden=false;
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
    if(pendingUpdate||reloadPending){applyUpdate();return;}
    try{$('offlineStatus').textContent=await ready()?'Ready for offline play. Updates are automatic when online; your saved songs stay on this device.':'Automatic updates are enabled. Connect to the internet to save the offline game.';}
    catch{$('offlineStatus').textContent='Offline storage is unavailable in this browser. You can still play online.';}
  }
  const watched=new WeakSet();
  function watch(reg){
    registration=reg;if(reg.waiting)offerUpdate(reg.waiting);
    if(watched.has(reg))return;watched.add(reg);
    function installing(){
      const worker=reg.installing;if(!worker)return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&reg.active)offerUpdate(reg.waiting||worker);
        if(worker.state==='activated')status();
      });
    }
    reg.addEventListener('updatefound',installing);installing();
  }
  async function check(force=false){
    if(!supported||navigator.onLine===false||document.hidden)return;
    if(starting)return starting;
    if(!force&&Date.now()-lastCheck<60000)return;
    lastCheck=Date.now();
    starting=(async()=>{
      try{
        const reg=registration||await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
        watch(reg);await reg.update();if(reg.waiting)offerUpdate(reg.waiting);else await status();
      }catch{
        $('offlineStatus').textContent='Could not check for updates. Your current game and saved songs are still available; updates will retry when online.';
      }finally{starting=null;}
    })();
    return starting;
  }
  $('downloadGameButton').addEventListener('click',async()=>{
    if(!supported){$('offlineStatus').textContent='Offline play needs a browser that supports it over HTTPS. You can still play online.';return;}
    $('downloadGameButton').disabled=true;
    try{await check(true);if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);}
    finally{$('downloadGameButton').disabled=false;}
  });
  $('offlineButton').addEventListener('click',()=>{status();check();});
  $('reloadGameButton').addEventListener('click',()=>applyUpdate(true));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installAppButton').hidden=false;});
  $('installAppButton').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('installAppButton').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('installAppButton').hidden=true;$('installInstructions').textContent='Riffbound is installed. Open it from your home screen.';});
  if(supported){
    navigator.serviceWorker.addEventListener('controllerchange',()=>navigator.serviceWorker.controller?.postMessage({type:'GET_VERSION'}));
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.source!==navigator.serviceWorker.controller&&event.source!==pendingUpdate)return;
      if(event.data?.type==='GAME_VERSION'&&event.data.version!==config.version){reloadPending=true;pendingUpdate=null;applyUpdate();}
      if(event.data?.type==='UPDATE_DEFERRED'){$('offlineStatus').textContent='Update ready. Close other Riffbound tabs to let this game update automatically.';retryLater();}
    });
    window.addEventListener('online',()=>{check(true);applyUpdate();});
    window.addEventListener('focus',()=>{check();applyUpdate();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();applyUpdate();}});
    // Mobile apps can remain open for hours. The browser pauses this timer in the background.
    setInterval(()=>check(),5*60*1000);
    navigator.serviceWorker.controller?.postMessage({type:'GET_VERSION'});
    check(true);
  }
})();
