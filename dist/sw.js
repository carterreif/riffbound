/* Only cache the public game files. Player audio stays in device-local song storage. */
importScripts('offline-assets.js');
const {version,files}=self.RiffOfflineAssets,base=new URL('./',self.location.href);
const urls=files.map(file=>new URL(file,base).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const responses=await Promise.all(urls.map(async url=>{
    const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
    if(!response.ok||response.redirected)throw Error('A game file could not be saved.');
    const type=response.headers.get('content-type')||'';
    if((/\.(js|css|png)$/.test(url)&&type.includes('text/html'))||(/\.png$/.test(url)&&!type.startsWith('image/')))throw Error('A game file returned an unexpected page.');
    return response;
  }));
  const cache=await caches.open(version),results=await Promise.allSettled(urls.map((url,i)=>cache.put(url,responses[i])));
  if(results.some(result=>result.status==='rejected')){await caches.delete(version);throw Error('Not enough storage to save the game.');}
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
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
