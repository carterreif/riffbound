/* Curated public demos load their existing charts; they never auto-chart or auto-save. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const catalog=node?require('./demo-catalog.js'):root.RiffDemoCatalog||[];
  const library=node?require('./song-library.js'):root.RiffLibrary;
  function create(entries,{fetcher=globalThis.fetch,crypto=globalThis.crypto,library:Library=library,timeout=30000}={}){
    const pending=new Map();
    const list=()=>entries.map(e=>({...e,charts:Object.fromEntries(Object.keys(e.charts).map(part=>[part,{}]))}));
    async function load(entry){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const options={signal:controller.signal,credentials:'same-origin'};
        const metadata=await fetcher(entry.metadata,options);if(!metadata.ok)throw Error('The demo chart could not download. Try again while online.');
        const record=Library.validate(await metadata.json());
        if(record.id!==entry.id||Math.abs(record.musicEnd-entry.musicEnd)>.001||!record.charts.drums)throw Error('The demo chart does not match the published song. Check for game updates.');
        const response=await fetcher(entry.audio,options);if(!response.ok)throw Error('The demo audio could not download. Try again while online.');
        const bytes=await response.arrayBuffer();if(bytes.byteLength!==entry.audioBytes)throw Error('The demo audio download is incomplete. Try again.');
        const digest=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        if(id!==entry.id)throw Error('The demo audio does not match its chart. Check for updates and try again.');
        return {...record,audioBlob:new Blob([bytes],{type:'audio/mpeg'})};
      }catch(error){if(error.name==='AbortError')throw Error('The demo download took too long. Check your connection and select it again.');throw error;}
      finally{clearTimeout(timer);}
    }
    async function get(id){
      const entry=entries.find(e=>e.id===id);if(!entry)throw Error('This public demo is unavailable.');
      if(!pending.has(id)){const job=load(entry);pending.set(id,job);job.catch(()=>{if(pending.get(id)===job)pending.delete(id);});}
      const record=await pending.get(id);return {...Library.validate({...record,quality:JSON.parse(JSON.stringify(record.quality))}),audioBlob:record.audioBlob};
    }
    return {list,get};
  }
  const api={...create(catalog),create};if(node)module.exports=api;else root.RiffPublicDemos=api;
})(typeof window!=='undefined'?window:globalThis);
