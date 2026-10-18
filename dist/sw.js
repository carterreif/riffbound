/* Only cache the public game files. Player audio stays in device-local song storage. */
importScripts('offline-assets.js');
const {version,files}=self.RiffOfflineAssets,base=new URL('./',self.location.href);
const urls=files.map(file=>new URL(file,base).href);
let saving=null,savingFull=false;
async function cacheGame(progress=()=>{},full=true){
  if(saving){const complete=savingFull;await saving;if(full&&!complete)return cacheGame(progress,true);return;}
  savingFull=full;
  saving=(async()=>{
  let completed=0;
  // Demo songs are optional media; they must not hold up a game-code update.
  const selected=files.map((file,i)=>({file,url:urls[i]})).filter(item=>full||!item.file.startsWith('demos/'));
  const responses=new Array(selected.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{while(cursor<selected.length){const i=cursor++,{file,url}=selected[i];
    // Static hosting redirects index.html to /. Fetch its canonical address,
    // retaining the index.html cache key used by existing offline navigation.
    const target=file==='index.html'?base.href:url;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let response;try{response=await fetch(new Request(target,{cache:'reload',credentials:'same-origin',signal:controller.signal}));}catch(error){throw Error(`Could not download ${file}: ${error.name==='AbortError'?'download timed out':error.message}. Check your connection and retry.`);}finally{clearTimeout(timer);}
    // Static hosting canonicalizes secondary HTML pages to extensionless URLs.
    // Accept only that exact same-origin route, never login/error redirects.
    const canonical=file.endsWith('.html')?new URL(file==='index.html'?'./':file.slice(0,-5),base).href:null;
    const expectedRedirect=response.redirected&&canonical&&response.url===canonical;
    if(!response.ok||response.redirected&&!expectedRedirect)throw Error(`Could not download ${file}${response.status?' (HTTP '+response.status+')':''}. Check your connection and try again.`);
    const type=response.headers.get('content-type')||'';
    if((/\.(js|css|png|json|mp3)$/.test(url)&&type.includes('text/html'))||(/\.png$/.test(url)&&!type.startsWith('image/'))||file.endsWith('.html')&&!type.includes('text/html'))throw Error(`${file} returned an unexpected page. Open the game in your browser and try again.`);
    progress(++completed,selected.length);
    responses[i]=response;
  }}));
  // A deployment can change while these requests are in flight. Never label
  // another release's runtime manifest as this worker's cached game: that
  // makes every page boot request the very same update again.
  const manifest=await responses[selected.findIndex(item=>item.file==='offline-assets.js')].clone().text();
  if(/\bversion\s*:\s*['"]([^'"]+)['"]/.exec(manifest)?.[1]!==version)throw Error('Game files changed during download. Keep playing and check for updates again.');
  const existed=(await caches.keys()).includes(version);
  const cache=await caches.open(version),results=await Promise.allSettled(selected.map(({url},i)=>cache.put(url,responses[i])));
  if(results.some(result=>result.status==='rejected')){if(!existed)await caches.delete(version);throw Error('The browser could not save all game files. Free some device space and try again. Your setlist has not been removed.');}
  })();
  try{await saving;}finally{saving=null;savingFull=false;}
}
self.addEventListener('install',event=>event.waitUntil(cacheGame(()=>{},false)));
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
  const htmlAlias=files.find(file=>file.endsWith('.html')&&file!=='index.html'&&new URL(file.slice(0,-5),base).pathname===url.pathname);
  const key=isHome?new URL('index.html',base).href:htmlAlias?new URL(htmlAlias,base).href:new URL(url.pathname,base).href;
  if(!urls.includes(key))return;
  event.respondWith((async()=>{const cache=await caches.open(version),cached=await cache.match(key);return cached||fetch(request);})());
});
