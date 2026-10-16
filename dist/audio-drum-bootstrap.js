/* Keep Connect audio responsive even if another audio/game script fails to load. */
(function(root){
 'use strict';const document=root.document,$=id=>document.getElementById(id),button=$('audioDrumConnect');if(!button)return;let handler=null;
 const show=message=>{const status=$('audioDrumStatus');if(status)status.textContent=message;};
 const fail=message=>{show(message);button.disabled=false;button.textContent='Connect audio';};
 root.RiffAudioDrumBoot={bind:fn=>{handler=fn;button.dataset.audioReady='true';},fail};
 button.addEventListener('click',async()=>{
  show('Starting audio input…');
  try{
   if(root.isSecureContext===false){fail('Audio needs a secure browser tab. Open Riffbound using its HTTPS link below.');return;}
   const policy=document.permissionsPolicy||document.featurePolicy;
   if(policy?.allowsFeature&&policy.allowsFeature('microphone')===false){fail('This view blocks microphone access. Open Riffbound directly using the link below, then choose Connect audio there.');return;}
   if(!handler){fail('Audio controls did not finish loading. Refresh the game to load the current version, then try Connect audio again. Your saved songs are kept.');return;}
   await handler();
  }catch(error){fail('Could not start audio: '+String(error?.message||error||'unknown browser error')+'. Refresh and try again.');}
 });
 root.addEventListener('error',event=>{const target=event.target;if(target?.tagName==='SCRIPT'&&/audio-drum-/.test(target.src||''))fail('An audio recognition file could not load. Refresh the game while online, then try again. Your saved songs are kept.');},true);
})(window);
