/* Only cache the public game files. Player audio stays in device-local song storage. */
importScripts('offline-assets.js');
const {version,files}=self.RiffOfflineAssets,base=new URL('./',self.location.href);
const urls=files.map(file=>new URL(file,base).href);
let saving=null;
async function cacheGame(progress=()=>{}){
  if(saving){await saving;return;}
  saving=(async()=>{
  let completed=0;
  const responses=await Promise.all(urls.map(async (url,i)=>{
    // Static hosting redirects index.html to /. Fetch its canonical address,
    // retaining the index.html cache key used by existing offline navigation.
    const target=files[i]==='index.html'?base.href:url;
    const response=await fetch(new Request(target,{cache:'reload',credentials:'same-origin'}));
    if(!response.ok||response.redirected)throw Error(`Could not download ${files[i]}${response.status?' (HTTP '+response.status+')':''}. Check your connection and try again.`);
    const type=response.headers.get('content-type')||'';
    if((/\.(js|css|png)$/.test(url)&&type.includes('text/html'))||(/\.png$/.test(url)&&!type.startsWith('image/'))||files[i]==='index.html'&&!type.includes('text/html'))throw Error(`${files[i]} returned an unexpected page. Open the game in your browser and try again.`);
    progress(++completed,urls.length);
    return response;
  }));
  const existed=(await caches.keys()).includes(version);
  const cache=await caches.open(version),results=await Promise.allSettled(urls.map((url,i)=>cache.put(url,responses[i])));
  if(results.some(result=>result.status==='rejected')){if(!existed)await caches.delete(version);throw Error('The browser could not save all game files. Free some device space and try again. Your setlist has not been removed.');}
  })();
  try{await saving;}finally{saving=null;}
}
self.addEventListener('install',event=>event.waitUntil(cacheGame()));
self.addEventListener('message',event=>{
  if(event.data?.type==='GET_VERSION')event.source?.postMessage({type:'GAME_VERSION',version});
  if(event.data?.type==='SAVE_OFFLINE'&&event.ports?.[0])event.waitUntil((async()=>{
    const port=event.ports[0];
    try{
      if(event.data.version!==version)throw Error('A different game version is ready. Close this panel and let the game update, then save it offline.');
      await cacheGame((completed,total)=>port.postMessage({type:'PROGRESS',completed,total}));
      port.postMessage({type:'SAVED',version});
    }catch(error){port.postMessage({type:'ERROR',message:error.message||'The offline download failed. Please retry.'});}
    finally{port.close();}
  })());
  if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil((async()=>{
    if(event.data.automatic){
      const tabs=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url.startsWith(base.href));
      if(tabs.length>1){event.source?.postMessage({type:'UPDATE_DEFERRED'});return;}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('riffbound-offline-')&&key!==version)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==base.origin)return;
  const isHome=url.pathname===base.pathname||url.pathname===new URL('index.html',base).pathname;
  const key=isHome?new URL('index.html',base).href:new URL(url.pathname,base).href;
  if(!urls.includes(key))return;
  event.respondWith((async()=>{const cache=await caches.open(version),cached=await cache.match(key);return cached||fetch(request);})());
});
