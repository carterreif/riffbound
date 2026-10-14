/* Controller soundcheck: select a device, learn controls, test without scoring. */
(function(root){
  'use strict';
  root.RiffControllerSetup=function({document,hub,now=()=>performance.now(),getContext,beforeOpen}){
    const API=root.RiffControllerInput,$=id=>document.getElementById(id),dialog=$('controllerDialog');
    let selected='',context='drums-five',rows=new Map(),lastList='',lastMap='',notice='';
    const element=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
    function actionLabel(action){return action.startsWith('lane')?API.labels(context)[Number(action.slice(4))]:({kick:'Kick pedal',strum:'Strum',overdrive:'Overdrive',pause:'Pause / resume'}[action]||action);}
    function message(text){notice=text;$('controllerStatus').textContent=text;}
    function refresh(){
      const devices=hub.list(),list=JSON.stringify(devices);if(!devices.some(d=>d.id===selected))selected=devices[0]?.id||'';
      if(list!==lastList){lastList=list;const options=devices.map(d=>{const o=element('option',`${d.kind==='midi'?'MIDI':'Controller'} · ${d.name}`);o.value=d.id;return o;});if(!options.length){const o=element('option','No devices detected');o.value='';options.push(o);}$('controllerDevice').replaceChildren(...options);}
      $('controllerDevice').value=selected;$('controllerEnabled').checked=hub.enabled;$('controllerContext').value=context;
      $('controllerDeviceStatus').textContent=hub.gamepadError||(!devices.length?'Connect your controller to Windows, then press a button to make it visible. For MIDI, choose Enable MIDI inputs.':`${devices.length} connected input device${devices.length===1?'':'s'}. Mapped devices work together; choose one below to edit or test it.`);
      $('controllerStorageStatus').textContent=hub.storageError;
      const device=devices.find(d=>d.id===selected),map=hub.mapping(selected,context),key=JSON.stringify([selected,context,map,hub.learning?.action,hub.learning?.id]);
      const profile=$('controllerProfile');if(profile){profile.replaceChildren(...(device?API.profileChoices(device):['auto']).map(value=>{const option=element('option',API.PROFILES[value]);option.value=value;return option;}));profile.value=device?.profile||'auto';profile.disabled=!device;}
      const info=hub.profileInfo(selected,context),ready=Object.values(map).some(bindings=>bindings.length);
      if($('controllerMappingMode'))$('controllerMappingMode').textContent=!device?'Built-in setups load when a supported device connects.':info.custom?'Using your saved custom assignments for this layout.':ready?`Built-in ${info.profileLabel} setup is active. No pad-by-pad setup needed.`:`${info.profileLabel}: no built-in assignments for this layout. Choose the matching instrument setup or use Add input.`;
      if($('controllerRestoreBuiltins'))$('controllerRestoreBuiltins').disabled=!device||!info.custom;
      if(key!==lastMap){lastMap=key;rows=new Map();const elements=API.actions(context).map(action=>{
        const row=element('div',null,'controller-map-row');row.dataset.action=action;
        const label=element('strong',actionLabel(action)),bindings=element('span',map[action]?.length?map[action].map(API.bindingLabel).join(' / '):'Unassigned','controller-binding');
        const learn=element('button',hub.learning?.id===selected&&hub.learning.action===action?'Listening…':'Add input','quiet');learn.disabled=!device;learn.setAttribute('aria-label',`Assign ${actionLabel(action)}`);
        learn.addEventListener('click',()=>{if(hub.learn(selected,context,action,now()))message(`Hit only ${actionLabel(action)} once, then release it. Waiting up to 10 seconds…`);});
        const clear=element('button','Clear','quiet');clear.disabled=!device||!map[action]?.length;clear.setAttribute('aria-label',`Clear ${actionLabel(action)}`);clear.addEventListener('click',()=>{hub.cancelLearn();hub.clear(selected,context,action);message(`${actionLabel(action)} cleared.`);});
        const buttons=element('div',null,'controller-map-actions');buttons.append(learn,clear);row.append(label,bindings,buttons);rows.set(action,row);return row;
      });$('controllerMappings').replaceChildren(...elements);}
      $('controllerCancelLearn').hidden=!hub.learning;
      $('controllerPreset').disabled=!device||(device.kind==='midi'&&context==='frets');$('controllerPreset').textContent=device?.kind==='midi'?'Use General MIDI drum preset':'Use standard gamepad preset';
      if($('controllerWorldTourPreset'))$('controllerWorldTourPreset').disabled=!device?.standard||context!=='drums-five';
      $('controllerClear').disabled=!device;
      if(!notice)$('controllerStatus').textContent=ready?'Your controls are ready. Test the inputs, close setup and play. Use Add input only to customize a control.':'Choose a built-in instrument setup above, or use Add input for a device with a different button layout.';
    }
    hub.onChange=refresh;
    hub.onLearn=result=>{refresh();message(result.timeout?'Assignment timed out. Choose Add input and try again.':`${actionLabel(result.action)} assigned to ${API.bindingLabel(result.binding)}.${result.moved?' This input was moved from its previous action.':''}${hub.storageError?' Mapping is temporary because storage is unavailable.':' Saved on this browser.'}`);};
    hub.onSignal=signal=>{
      if(!dialog.open||signal.id!==selected)return;
      const hits=API.matches(hub.mapping(selected,context),new Set(signal.tokens||[]));
      $('controllerLastInput').textContent=signal.label+(hits.length?' → '+hits.map(actionLabel).join(', '):' · not assigned in this layout');
      for(const action of hits){const row=rows.get(action);if(!row)continue;row.classList.remove('controller-hit');void row.offsetWidth;row.classList.add('controller-hit');}
    };
    $('controllerButton').addEventListener('click',()=>{beforeOpen();hub.setBlocked(true);hub.cancelLearn();context=getContext();notice='';lastMap='';dialog.showModal();hub.poll(now());refresh();});
    $('controllerDevice').addEventListener('change',()=>{hub.cancelLearn();selected=$('controllerDevice').value;lastMap='';$('controllerLastInput').textContent='Waiting for a hit…';notice='';refresh();});
    $('controllerContext').addEventListener('change',()=>{hub.cancelLearn();context=$('controllerContext').value;lastMap='';notice='';refresh();});
    $('controllerProfile')?.addEventListener('change',()=>{hub.selectProfile(selected,$('controllerProfile').value);message('Built-in instrument setup selected and saved. Existing custom assignments are kept; choose Restore built-in layout to replace them for this layout.');});
    $('controllerRestoreBuiltins')?.addEventListener('click',()=>{hub.restoreBuiltin(selected,context);message('Built-in assignments restored for this layout. Test the inputs, then return to play.');});
    $('controllerEnabled').addEventListener('change',()=>hub.setEnabled($('controllerEnabled').checked));
    $('controllerCancelLearn').addEventListener('click',()=>{hub.cancelLearn();message('Assignment cancelled.');});
    $('controllerPreset').addEventListener('click',()=>{hub.usePreset(selected,context);message('Preset applied to this device and layout. Test every pad below; use Add input and Clear to correct any differences.');});
    $('controllerWorldTourPreset')?.addEventListener('click',()=>{if(hub.usePreset(selected,context,'ghwt-xbox360')){hub.selectProfile(selected,'gh-drums');message('World Tour Xbox 360 preset saved: Red B, Yellow Y, Blue X, Orange RB, Green A, Kick LB; Back = Overdrive, Start = Pause. Test every pad before playing.');}});
    $('controllerClear').addEventListener('click',()=>{hub.clearProfile(selected,context);message('All assignments cleared for this device and layout.');});
    $('controllerEnableMidi').addEventListener('click',async()=>{
      $('controllerEnableMidi').disabled=true;message('Waiting for MIDI permission…');
      try{await hub.enableMidi();const midi=hub.list().find(d=>d.kind==='midi');if(midi)selected=midi.id;refresh();message(midi?'MIDI connected. General MIDI drum mappings are built in; saved custom controls take priority. Test your pads, then play.':'MIDI enabled, but no MIDI inputs were found. Connect a USB-MIDI interface or USB drum kit, then try again.');}
      catch(error){message(error.message);}finally{$('controllerEnableMidi').disabled=false;}
    });
    const close=()=>{hub.cancelLearn();hub.reset();};dialog.addEventListener('close',close);dialog.addEventListener('cancel',close);
    refresh();return {refresh};
  };
})(window);
