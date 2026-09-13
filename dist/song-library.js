/* Device-local songs and portable backups. Audio never leaves this browser. */
(function(root){
  'use strict';
  const Difficulties=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const MAX_AUDIO=80*1024*1024,MAX_META=8*1024*1024,MAGIC=new TextEncoder().encode('RIFFPACK1\n');
  const RECORD_BYTES=32*1024,FORMAT='riffbound-chunks-v1';
  let opening=null,connection=null,writes=Promise.resolve();
  function audioStatus(blob){
    const bytes=Number(blob?.size)||0;
    if(bytes<=0||typeof blob?.arrayBuffer!=='function')return {ok:false,code:'AUDIO_MISSING',bytes:0,message:'The original audio is missing from this open song. Choose Reconnect original audio and select the same WAV or MP3 to keep this chart.'};
    if(bytes>MAX_AUDIO)return {ok:false,code:'AUDIO_TOO_LARGE',bytes,message:`The audio is ${(bytes/1024/1024).toFixed(1)} MB; the limit is 80 MB. Upload a smaller audio file as a new song.`};
    return {ok:true,code:'AUDIO_READY',bytes,message:`Audio attached · ${(bytes/1024/1024).toFixed(1)} MB`};
  }
  function requireAudio(blob){const status=audioStatus(blob);if(!status.ok){const error=Error(status.message);error.code=status.code;throw error;}return blob;}
  async function reconnectAudio(song,file){
    requireAudio(file);
    // Check the actual bytes, not the filename or approximate song length.
    const bytes=await file.arrayBuffer(),audioBlob=requireAudio(new Blob([bytes],{type:file.type||song.mime||'audio/wav'}));
    const hash=await root.crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    if(id!==song.id)throw Error('This file does not match the song used for this chart. Select the original audio file. Your chart has not been changed.');
    return {...song,audioBlob,filename:file.name||song.filename};
  }
  function metadata(song){
    return {id:song.id,title:song.title,filename:song.filename||song.title,mime:song.audioBlob?.type||song.mime||'',instrument:song.instrument||'guitar',musicEnd:song.musicEnd,duration:song.musicEnd+.8,bpm:song.bpm,beat:song.beat,offset:song.offset||0,charts:song.charts,waveform:song.waveform,quality:song.quality||null,chartVersion:song.chartVersion||1,byteLength:song.audioBlob?.size||song.byteLength||0,updatedAt:Date.now()};
  }
  function validate(data){
    if(!data||typeof data.id!=='string'||!/^[a-f0-9]{64}$/.test(data.id)||typeof data.title!=='string'||data.title.length>500)throw Error('This is not a valid Riffbound song backup.');
    if(!Number.isFinite(data.musicEnd)||data.musicEnd<5||data.musicEnd>480||!Number.isFinite(data.beat)||data.beat<=0||data.beat>4||!Number.isFinite(data.bpm)||data.bpm<15||data.bpm>1000)throw Error('The song timing in this backup is invalid.');
    if(!['guitar','drums','bass','vocals'].includes(data.instrument)||!data.charts?.[data.instrument])throw Error('The backup has no playable chart.');
    const charts={};
    for(const instrument of ['guitar','drums','bass','vocals'])if(data.charts[instrument]){
      charts[instrument]={};
      const levels=data.charts[instrument];
      const canonical=Array.isArray(levels.medium)&&Array.isArray(levels.hard);
      if(!Array.isArray(levels.easy)||!Array.isArray(levels.expert)||(!Array.isArray(levels.normal)&&(!Array.isArray(levels.medium)||!Array.isArray(levels.hard))))throw Error('The backup chart is invalid or incomplete.');
      for(const level of ['easy','medium','hard','expert','normal'].filter(level=>level in levels)){
        const notes=data.charts[instrument][level];if(!Array.isArray(notes)||notes.length>25000)throw Error('The backup chart is invalid or too large.');
        charts[instrument][level]=notes.map((n,id)=>{
          if(!Number.isInteger(n.lane)||n.lane<0||n.lane>(instrument==='drums'?5:canonical&&level!=='normal'?Difficulties.frets(instrument,level)-1:4)||!Number.isFinite(n.time)||n.time<0||n.time>data.musicEnd||!Number.isFinite(n.duration)||n.duration<0||n.time+n.duration>data.musicEnd+1)throw Error('The backup contains an invalid note.');
          return {id,lane:n.lane,time:n.time,duration:n.duration,...(Number.isFinite(n.pitch)?{pitch:n.pitch}:{})};
        }).sort((a,b)=>a.time-b.time||a.lane-b.lane);
      }
      charts[instrument]=Difficulties.upgrade(charts[instrument],instrument,data.beat);
    }
    return {...metadata({...data,audioBlob:null}),charts,waveform:Array.isArray(data.waveform)?data.waveform.slice(0,1200).map(v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0):[],offset:Number.isFinite(data.offset)?data.offset:0};
  }
  function forgetConnection(d){
    // A late close from an old handle must not invalidate its replacement.
    if(connection===d)connection=null;
    try{d.close();}catch{}
  }
  const closingError=error=>error?.name==='InvalidStateError'||/connection (?:is |was )?(?:closing|closed|lost)|database (?:is )?(?:closing|closed)/i.test(error?.message||'');
  const quotaError=error=>error?.name==='QuotaExceededError'||/quota|full disk|disk full|no space|not enough space/i.test(error?.message||'');
  const ioError=error=>/Failed to write blobs|IOError|I\/O error/i.test(error?.message||'');
  function connectionFailure(cause){
    const error=Error('Browser song storage is still disconnecting. Export a backup, close other Riffbound tabs, then try Save current song again.');
    error.code='STORAGE_CONNECTION_CLOSED';error.cause=cause;return error;
  }
  function db(){
    if(connection)return Promise.resolve(connection);
    if(opening)return opening;
    let abandoned=false;
    const pending=new Promise((resolve,reject)=>{
      if(!root.indexedDB){reject(Error('Song storage is unavailable. You can still play and export a backup.'));return;}
      const request=root.indexedDB.open('riffbound-songs',1);
      request.onupgradeneeded=()=>{if(abandoned){request.transaction.abort();return;}const d=request.result;d.createObjectStore('songs',{keyPath:'id'});d.createObjectStore('audio');};
      request.onsuccess=()=>{
        const d=request.result;
        if(abandoned){d.close();return;}
        connection=d;d.onversionchange=()=>forgetConnection(d);d.onclose=()=>forgetConnection(d);resolve(d);
      };
      request.onerror=()=>reject(request.error||Error('Could not open song storage.'));
      request.onblocked=()=>{abandoned=true;reject(Error('Close other Riffbound tabs, then try again.'));};
    });
    opening=pending;
    const clearOpening=()=>{if(opening===pending)opening=null;};pending.then(clearOpening,clearOpening);
    return pending;
  }
  async function transaction(mode,action){
    for(let attempt=0;attempt<2;attempt++){
      const d=await db();let tx,actionError=null;
      try{tx=d.transaction(['songs','audio'],mode,{durability:mode==='readwrite'?'strict':'default'});}
      catch(error){
        if(!closingError(error)||quotaError(error))throw error;
        forgetConnection(d);if(attempt===0)continue;throw connectionFailure(error);
      }
      try{
        return await new Promise((resolve,reject)=>{
          let result,requestError=null;
          tx.oncomplete=()=>resolve(result);
          // Request errors can precede rollback. Retry only after onabort so a
          // second write cannot run while the first write is still unwinding.
          tx.onerror=event=>{requestError=event?.target?.error||tx.error||requestError;};
          tx.onabort=()=>{
            const error=actionError||tx.error||requestError;
            if(error){reject(error);return;}
            const aborted=Error('Song storage interrupted the transaction.');aborted.name='AbortError';reject(aborted);
          };
          const fail=error=>{actionError=error;try{tx.abort();}catch{reject(error);}};
          try{action(tx,value=>{result=value;},fail);}catch(error){fail(error);}
        });
      }catch(error){
        if(actionError||quotaError(error)||ioError(error)||!(closingError(error)||['AbortError','UnknownError'].includes(error?.name)))throw error;
        forgetConnection(d);if(attempt===0)continue;throw connectionFailure(error);
      }
    }
  }
  function write(action,prepare=()=>null){
    // Preserve invocation order across reconnects: an older retry must not
    // overwrite a newer chart or recreate a song the player just removed.
    const next=writes.then(async()=>{const prepared=await prepare();return transaction('readwrite',(tx,done,fail)=>action(tx,done,fail,prepared));});writes=next.catch(()=>{});return next;
  }
  const chunkKey=(id,kind,index)=>`${id}:${kind}:${index}`;
  function checkManifest(value){
    if(value?.format!==FORMAT)return false;
    for(const [kind,limit] of [['audio',MAX_AUDIO],['meta',MAX_META]]){
      const bytes=value[kind+'Bytes'],count=value[kind+'Chunks'];
      if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>limit||count!==Math.ceil(bytes/RECORD_BYTES))throw Error('This saved song is incomplete. Import its .riffpack backup to restore it.');
    }
    return true;
  }
  function readChunks(store,id,kind,manifest,done,fail){
    const count=manifest[kind+'Chunks'],size=manifest[kind+'Bytes'],parts=new Array(count);let remaining=count;
    for(let i=0;i<count;i++){
      const request=store.get(chunkKey(id,kind,i));
      request.onsuccess=()=>{try{
        const value=request.result,expected=Math.min(RECORD_BYTES,size-i*RECORD_BYTES);
        if(Object.prototype.toString.call(value)!=='[object ArrayBuffer]'||value.byteLength!==expected)throw Error('This saved song is incomplete. Import its .riffpack backup to restore it.');
        parts[i]=value;if(--remaining===0)done(parts);
      }catch(error){fail(error);}};
    }
  }
  function readRecord(tx,id,withAudio,done,fail){
    const store=tx.objectStore('audio'),a=tx.objectStore('songs').get(id),b=store.get(id);let remaining=2;
    const finish=()=>{if(--remaining)return;try{
      const summary=a.result,stored=b.result;
      if(!summary){done(null,stored);return;}
      if(!checkManifest(stored)){done({...summary,...(withAudio?{audioBlob:stored}:null)},stored);return;}
      readChunks(store,id,'meta',stored,parts=>{
        const bytes=new Uint8Array(stored.metaBytes);let offset=0;for(const part of parts){bytes.set(new Uint8Array(part),offset);offset+=part.byteLength;}
        const meta=JSON.parse(new TextDecoder().decode(bytes));if(meta.id!==id)throw Error('The saved chart does not match this song. Import its backup.');
        if(!withAudio){done(meta,stored);return;}
        readChunks(store,id,'audio',stored,audio=>done({...meta,audioBlob:new Blob(audio,{type:stored.mime||meta.mime||''})},stored),fail);
      },fail);
    }catch(error){fail(error);}};
    a.onsuccess=finish;b.onsuccess=finish;
  }
  function deleteChunks(store,id,manifest){
    if(!checkManifest(manifest))return;
    for(const kind of ['audio','meta'])for(let i=0;i<manifest[kind+'Chunks'];i++)store.delete(chunkKey(id,kind,i));
  }
  function putChunks(store,id,kind,bytes){
    // Small raw values avoid Blob persistence and oversized serialized records.
    for(let start=0,index=0;start<bytes.byteLength;start+=RECORD_BYTES,index++)store.put(bytes.slice(start,start+RECORD_BYTES),chunkKey(id,kind,index));
  }
  const list=()=>transaction('readonly',(tx,done)=>{const r=tx.objectStore('songs').getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>b.updatedAt-a.updatedAt));});
  const get=id=>transaction('readonly',(tx,done,fail)=>readRecord(tx,id,true,record=>done(record?.audioBlob?record:null),fail));
  const save=async song=>{
    const blob=requireAudio(song.audioBlob),current=validate(metadata(song));
    return write((tx,done,fail,audio)=>readRecord(tx,current.id,false,(previous,stored)=>{
      const meta={...current,charts:{...previous?.charts,...current.charts}},json=new TextEncoder().encode(JSON.stringify(meta));
      if(json.byteLength>MAX_META)throw Error('This chart is too large to save.');
      const manifest={format:FORMAT,audioBytes:audio.byteLength,audioChunks:Math.ceil(audio.byteLength/RECORD_BYTES),metaBytes:json.byteLength,metaChunks:Math.ceil(json.byteLength/RECORD_BYTES),mime:blob.type||current.mime||''};
      const store=tx.objectStore('audio');deleteChunks(store,current.id,stored);
      putChunks(store,current.id,'audio',audio);putChunks(store,current.id,'meta',json.buffer);store.put(manifest,current.id);
      // Setlist rows stay small; the full chart and waveform live in chunks.
      const summary={id:meta.id,title:meta.title,instrument:meta.instrument,musicEnd:meta.musicEnd,byteLength:audio.byteLength,updatedAt:meta.updatedAt,charts:Object.fromEntries(Object.keys(meta.charts).map(part=>[part,{}]))};
      tx.objectStore('songs').put(summary);
    },fail),async()=>{
      const bytes=await blob.arrayBuffer();if(bytes.byteLength!==blob.size)throw Error('Could not read the attached audio. Reconnect the original audio and try saving again.');return bytes;
    });
  };
  const remove=id=>write((tx,done,fail)=>{const store=tx.objectStore('audio'),request=store.get(id);request.onsuccess=()=>{try{deleteChunks(store,id,request.result);store.delete(id);tx.objectStore('songs').delete(id);}catch(error){fail(error);}};});
  function pack(song){
    requireAudio(song.audioBlob);
    const data=validate(metadata(song)),json=new TextEncoder().encode(JSON.stringify(data));
    if(json.length>MAX_META)throw Error('This chart is too large to export.');
    const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,json.length);
    return new Blob([MAGIC,length,json,song.audioBlob],{type:'application/octet-stream'});
  }
  async function unpack(blob){
    if(blob.size>MAX_AUDIO+MAX_META+14||blob.size<15)throw Error('Choose a valid .riffpack backup.');
    const header=new Uint8Array(await blob.slice(0,14).arrayBuffer());
    if(!MAGIC.every((v,i)=>header[i]===v))throw Error('Choose a Riffbound .riffpack backup.');
    const length=new DataView(header.buffer).getUint32(10);if(length>MAX_META||length+14>=blob.size)throw Error('This backup is incomplete.');
    let data;try{data=validate(JSON.parse(await blob.slice(14,14+length).text()));}catch(error){throw Error('Could not read this backup: '+error.message);}
    const audioBlob=blob.slice(14+length,blob.size,data.mime);if(audioBlob.size>MAX_AUDIO)throw Error('This backup audio is too large.');
    return {...data,audioBlob};
  }
  const api={list,get,save,remove,pack,unpack,validate,metadata,audioStatus,reconnectAudio};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffLibrary=api;
})(typeof window!=='undefined'?window:globalThis);
