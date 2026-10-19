const test=require('node:test'),assert=require('node:assert/strict'),V=require('../dist/music-video-search.js');
const row={strTrack:'Wish',strArtist:'Nine Inch Nails',strMusicVid:'http://www.youtube.com/watch?v=dQw4w9WgXcQ'};
const fetcher=rows=>async()=>new Response(JSON.stringify({track:rows}));
test('exact song and artist metadata yields only a canonical YouTube link',async()=>{
 let request;const result=await V.find({title:'Wish',artist:'Nine Inch Nails'},{fetcher:async(url,options)=>{request={url,options};return fetcher([row])();}});
 assert.equal(result.url,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');assert.match(request.url,/searchtrack.php/);assert.equal(request.options.credentials,'omit');
});
test('missing results, other artists, live versions and unsafe or unsupported video URLs do not attach',async()=>{
 for(const rows of [null,[],[{...row,strArtist:'Cover Band'}],[{...row,strTrack:'Wish (Live)'}],[{...row,strMusicVid:'javascript:alert(1)'}],[{...row,strMusicVid:'https://evil.example/watch?v=dQw4w9WgXcQ'}]])assert.equal(await V.find({title:'Wish',artist:'Nine Inch Nails'},{fetcher:fetcher(rows)}),null);
});
test('missing identity, response limits, provider blocks, bad JSON and cancellation report errors',async()=>{
 await assert.rejects(V.find({title:'Wish',artist:''},{fetcher:()=>assert.fail()}),/title and artist/);
 await assert.rejects(V.find({title:'Wish',artist:'Nine Inch Nails'},{fetcher:async()=>new Response('',{status:429})}),/busy/);
 await assert.rejects(V.find({title:'Wish',artist:'Nine Inch Nails'},{fetcher:async()=>new Response('x'.repeat(1024*1024+1))}),/too large/);
 await assert.rejects(V.find({title:'Wish',artist:'Nine Inch Nails'},{fetcher:async()=>new Response('{')}));
 const controller=new AbortController();controller.abort();await assert.rejects(V.find({title:'Wish',artist:'Nine Inch Nails'},{signal:controller.signal,fetcher:async(url,{signal})=>{signal.throwIfAborted();}}),/canceled/);
});
