(() => {
  'use strict';
  const $=id=>document.getElementById(id),config=window.RiffOfflineAssets;
  let installPrompt=null,pendingUpdate=null;
  function offerUpdate(worker){pendingUpdate=worker;$('reloadGameButton').hidden=false;$('offlineStatus').textContent='An updated offline copy is ready. Save your current song before loading the update.';}
  const ready=async()=>{if(!('caches' in window))return false;const cache=await caches.open(config.version);return (await Promise.all(config.files.map(file=>cache.match(new URL(file,location.href).href)))).every(Boolean);};
  async function status(){if(pendingUpdate){offerUpdate(pendingUpdate);return;}try{$('offlineStatus').textContent=await ready()?'Game saved for offline play. Choose a saved track from your setlist.':'Save the game while online to enable offline play.';}catch{$('offlineStatus').textContent='Offline storage is unavailable in this browser.';}}
  async function download(){
    if(!('serviceWorker' in navigator)||!window.isSecureContext){$('offlineStatus').textContent='Offline play needs a browser that supports it over HTTPS. You can still play online.';return;}
    $('downloadGameButton').disabled=true;$('offlineStatus').textContent='Saving the stage, controls, and charting tools…';
    try{
      const registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
      const worker=registration.installing||registration.waiting||registration.active;
      if(!worker)throw Error('Offline setup could not start.');
      if(worker.state!=='activated')await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('The download is taking too long. Stay online and try again.')),60000);
        const change=()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}else if(worker.state==='installed'&&registration.active){clearTimeout(timer);offerUpdate(worker);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Some game files could not be saved. Check your connection and available space.'));}};
        worker.addEventListener('statechange',change);change();
      });
      if(pendingUpdate)return;
      if(!await ready())throw Error('The offline copy is incomplete. Try saving again while online.');
      if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
      $('offlineStatus').textContent='Ready offline. Uploaded songs in your setlist can be played without a connection.';$('downloadGameButton').textContent='Update offline copy';
    }catch(error){$('offlineStatus').textContent=error.message;}
    finally{$('downloadGameButton').disabled=false;}
  }
  $('downloadGameButton').addEventListener('click',download);
  $('offlineButton').addEventListener('click',status);
  $('reloadGameButton').addEventListener('click',()=>{if(!pendingUpdate)return;$('reloadGameButton').disabled=true;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});pendingUpdate.postMessage({type:'ACTIVATE_UPDATE'});});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installAppButton').hidden=false;});
  $('installAppButton').addEventListener('click',async()=>{if(!installPrompt)return;const prompt=installPrompt;installPrompt=null;$('installAppButton').hidden=true;try{await prompt.prompt();const choice=await prompt.userChoice;$('offlineStatus').textContent=choice.outcome==='accepted'?'Riffbound added. Save the game for offline play if you have not already.':'You can install later from your browser menu.';}catch{$('offlineStatus').textContent='Use your browser menu to add Riffbound to your home screen.';}});
  window.addEventListener('appinstalled',()=>{$('installAppButton').hidden=true;$('installInstructions').textContent='Riffbound is installed on this device.';});
  // Check for updated game files only if the player already enabled offline play.
  if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(reg=>{if(!reg)return;if(reg.waiting)offerUpdate(reg.waiting);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&reg.active)offerUpdate(worker);});});return reg.update();}).catch(()=>{});
})();
