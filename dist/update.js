/* RIFFBOUND_UPDATE_REPAIR: public-cache-only recovery, deliberately outside the SW asset list. */
(() => {
 'use strict';const $=id=>document.getElementById(id),base=new URL('./',location.href);let busy=false;
 $('repairUpdates').addEventListener('click',async()=>{
  if(busy)return;busy=true;$('repairUpdates').disabled=true;$('repairDone').hidden=true;
  try{
   if(navigator.onLine===false)throw Error('Connect to the internet before refreshing game files.');
   $('repairStatus').textContent='Checking the online game before changing its cache…';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);let response;
   try{response=await fetch(new URL('update.js?probe='+Date.now(),base),{cache:'no-store',credentials:'same-origin',signal:controller.signal});if(!response.ok||(response.headers.get('content-type')||'').includes('text/html')||!new URL(response.url).href.startsWith(base.href)||!(await response.text()).includes('RIFFBOUND_UPDATE_REPAIR'))throw Error('The online game could not be verified. Open this page directly while online and retry.');}finally{clearTimeout(timer);}
   $('repairStatus').textContent='Refreshing Riffbound game files. Your song library is untouched…';
   if(navigator.serviceWorker?.getRegistrations){const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs)if(reg.scope===base.href)await reg.unregister();}
   if('caches' in window)for(const key of await caches.keys())if(key.startsWith('riffbound-offline-'))await caches.delete(key);
   const target=new URL('./',base);target.searchParams.set('riffbound_refresh',String(Date.now()));$('openUpdatedGame').href=target.href;
   $('repairStatus').textContent='Game files refreshed. Your songs and settings were kept. Open the updated game below, then save it for offline play again if you use that option.';$('repairDone').hidden=false;
  }catch(error){$('repairStatus').textContent='Could not finish update repair. '+(error.name==='AbortError'?'The online check timed out. Check your connection and retry.':error.message)+' Your song library has not been changed.';}
  finally{busy=false;$('repairUpdates').disabled=false;}
 });
})();
