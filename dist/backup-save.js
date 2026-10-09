/* Standalone file delivery; the game transfers a Blob locally, never to a server. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),origin=window.location.origin,token=window.location.hash.slice(1),sender=window.opener;
  let backup=null,saving=false,url=null;
  $('saveAs').hidden=typeof window.showSaveFilePicker!=='function';
  const receive=event=>{
    if(backup||event.source!==sender||event.origin!==origin||event.data?.token!==token||event.data.type!=='RIFF_BACKUP_FILE')return;
    const {blob,name}=event.data;
    if(!(blob instanceof Blob)||blob.size<=0||blob.size>88*1024*1024+14||typeof name!=='string'||!/^[a-z0-9 _-]+\.riffpack$/i.test(name)||name.length>100){$('saveStatus').textContent='The backup could not be read. Return to the game and export again.';return;}
    try{
      url=URL.createObjectURL(blob);backup={blob,name};
      $('fileInfo').textContent=`${name} · ${(blob.size/1024/1024).toFixed(1)} MB`;
      $('download').href=url;$('download').download=name;$('download').hidden=false;$('saveAs').disabled=false;
      $('saveStatus').textContent='Backup ready. Choose Save backup as… or Download backup.';
      clearTimeout(waitTimer);window.removeEventListener('message',receive);
      sender.postMessage({type:'RIFF_BACKUP_RECEIVED',token},origin);
    }catch{$('saveStatus').textContent='The backup could not be prepared. Keep the game open and try Save in new window again.';}
  };
  window.addEventListener('message',receive);
  const waitTimer=setTimeout(()=>{if(!backup)$('saveStatus').textContent='No backup arrived. Keep the original game open and choose Save in new window again. This window cannot recover a song from a different browser’s storage.';},20000);
  if(sender&&/^[0-9a-f-]{36}$/i.test(token))sender.postMessage({type:'RIFF_BACKUP_READY',token},origin);
  else{$('saveStatus').textContent='Open this window with Export current song → Save in new window in Riffbound.';clearTimeout(waitTimer);}
  $('download').addEventListener('click',()=>{$('saveStatus').textContent='Download requested. Check your browser’s Downloads list; the browser controls where downloaded files are saved.';});
  $('saveAs').addEventListener('click',async()=>{
    if(!backup||saving)return;
    if(typeof window.showSaveFilePicker!=='function'){$('download').click();return;}
    let writable=null;saving=true;$('saveAs').disabled=true;
    $('saveStatus').textContent='Opening the save dialog… Choose your folder and Save. If the dialog does not appear, use Download backup.';
    try{
      const handle=await window.showSaveFilePicker({suggestedName:backup.name,startIn:'downloads',types:[{description:'Riffbound song backup',accept:{'application/octet-stream':['.riffpack']}}]});
      $('saveStatus').textContent='Saving your audio and charts…';writable=await handle.createWritable();await writable.write(backup.blob);await writable.close();writable=null;
      $('saveStatus').textContent=`Backup saved: ${handle.name||backup.name}. You can return to the game.`;
    }catch(error){
      if(writable)try{await writable.abort();}catch{}
      $('saveStatus').textContent=error.name==='AbortError'?'Save canceled. Your backup is still ready. Choose Save backup as… again or Download backup.':'Could not complete the file save. Try Download backup, check browser download permissions, and make sure the device has free space.';
    }finally{saving=false;$('saveAs').disabled=false;}
  });
  window.addEventListener('pagehide',event=>{if(!event.persisted){clearTimeout(waitTimer);if(url)URL.revokeObjectURL(url);}});
})();
