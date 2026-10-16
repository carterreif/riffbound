/* Live controller/MIDI input. No device permissions are requested on page load. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RiffControllerInput=api;})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const STORAGE_KEY='riffbound-controller-mappings-v1';
  const CONTEXTS=['drums-four','drums-five','frets'];
  const ACTIONS=['lane0','lane1','lane2','lane3','lane4','kick','strum','overdrive','pause'];
  const PROFILES={auto:'Automatic',standard:'Standard gamepad','gh-drums':'Guitar Hero Xbox 360 drums',guitar:'Five-fret guitar / bass','midi-drums':'General MIDI drums','ead-drums':'Yamaha EAD · General MIDI','ead10-drums':'Yamaha EAD10','ead20-drums':'Yamaha EAD20','ead50-drums':'Yamaha EAD50','midi-pads':'MIDI pitch pads',none:'Custom only'};
  const EAD_PROFILES=['ead-drums','ead10-drums','ead20-drums','ead50-drums'];
  const isEad=profile=>EAD_PROFILES.includes(profile);
  function detectProfile(device){
    if(device.kind==='midi'){const model=(device.name||'').match(/\bead[\s_-]?(10|20|50)\b/i);return model?'ead'+model[1]+'-drums':'midi-drums';}
    if(!device.standard)return 'none';
    const name=device.name.toLowerCase();
    if(/1430.*(?:02a8|0805)/.test(name)||/(?:guitar\s*hero|band\s*hero|ghwt|warriors of rock|redoctane).*(?:drum|kit)/.test(name))return 'gh-drums';
    if(/guitar/.test(name)&&!/drum/.test(name))return 'guitar';
    return 'standard';
  }
  const profileChoices=device=>['auto',...(device.kind==='midi'?['midi-drums',...EAD_PROFILES,'midi-pads']:device.standard?['standard','gh-drums','guitar']:[]),'none'];
  function builtin(device,context,profile){
    if(profile==='auto')profile=detectProfile(device);
    if(profile==='none')return {};
    if(isEad(profile))return preset(device.kind,context,profile)||{};
    if(profile==='midi-drums')return device.kind==='midi'&&context!=='frets'?preset('midi',context):{};
    if(profile==='midi-pads')return context==='frets'?{...Object.fromEntries([60,62,64,65,67].map((note,i)=>['lane'+i,[[`n:*:${note}`]]])),strum:[['n:*:72']],overdrive:[['n:*:74']],pause:[['n:*:76']]}:{};
    if(profile==='guitar')return context==='frets'?preset('gamepad','frets'):{};
    if(profile==='gh-drums'){
      if(context==='frets')return {};
      const map=preset('gamepad','drums-five','ghwt-xbox360');
      if(context==='drums-four'){map.lane3=[...map.lane3,...map.lane4];delete map.lane4;}return map;
    }
    return preset('gamepad',context);
  }
  const actions=context=>ACTIONS.filter(a=>context==='frets'?!['kick'].includes(a):a!=='strum'&&(context!=='drums-four'||a!=='lane4'));
  const labels=context=>context==='frets'?['Green fret / low pitch','Red fret','Yellow fret','Blue fret','Orange fret / high pitch']:context==='drums-four'?['Red pad','Yellow pad / cymbal','Blue pad / cymbal','Green pad / cymbal']:['Red snare','Yellow hi-hat','Blue tom','Orange cymbal','Green floor tom'];
  function cleanBinding(binding){
    if(!Array.isArray(binding)||!binding.length||binding.length>12)return null;
    const result=[...new Set(binding)];
    if(!result.every(v=>typeof v==='string'&&(/^(b:(?:\d|[1-9]\d|1[01]\d|12[0-7])|a:(?:\d|[12]\d|3[01]):[+-])$/.test(v)||/^n:(\*|\d|1[0-5]):(\d|[1-9]\d|1[01]\d|12[0-7])$/.test(v))))return null;
    if(result.some(v=>v.startsWith('n:'))&&result.length!==1)return null;
    return result.sort();
  }
  const signature=b=>b.join('|');
  const overlap=(a,b)=>signature(a)===signature(b)||(a.length===1&&b.length===1&&a[0].startsWith('n:')&&b[0].startsWith('n:')&&a[0].split(':')[2]===b[0].split(':')[2]&&(a[0].split(':')[1]==='*'||b[0].split(':')[1]==='*'));
  const bindingLabel=b=>b.map(token=>{const [type,n,direction]=token.split(':');return type==='b'?`Button ${Number(n)+1}`:type==='a'?`Axis ${Number(n)+1} ${direction}`:`Note ${direction} · ${n==='*'?'any channel':'channel '+(Number(n)+1)}`;}).join(' + ');
  function matches(map,tokens){
    const candidates=[];
    for(const [action,bindings] of Object.entries(map))for(const b of bindings)if(b.every(t=>tokens.has(t)))candidates.push({action,b});
    // A kit can encode one pad as A + bumper. Do not also fire its A-only pad.
    return [...new Set(candidates.filter(x=>!candidates.some(y=>y.b.length>x.b.length&&x.b.every(t=>y.b.includes(t)))).map(x=>x.action))];
  }
  function preset(kind,context,name='standard'){
    const map={};const add=(a,...tokens)=>map[a]=tokens.map(t=>[t]);
    // Riffbound's complete EAD layout uses standard percussion note roles.
    // Models/scenes can reassign notes; no hardware configuration is sent.
    if(isEad(name)){
      if(kind!=='midi'||!['drums-four','drums-five'].includes(context))return null;
      const four=context==='drums-four';
      add('lane0','n:*:38','n:*:40','n:*:37');
      add('lane1','n:*:42','n:*:44','n:*:46');
      add('lane2',...[45,47,48,50,...(four?[51,53,59]:[])].map(n=>'n:*:'+n));
      add(four?'lane3':'lane4','n:*:41','n:*:43');
      for(const note of [49,52,55,57,...(four?[]:[51,53,59])])(map.lane3??=[]).push(['n:*:'+note]);
      add('kick','n:*:35','n:*:36');return map;
    }
    // Browser standard mapping: A=0, B=1, X=2, Y=3, LB=4, RB=5.
    // GH kit pads: B/Y/X/RB/A; pedal: LB. This is not the guitar preset.
    if(name==='ghwt-xbox360'){
      if(kind!=='gamepad'||context!=='drums-five')return null;
      [1,3,2,5,0].forEach((b,i)=>add('lane'+i,'b:'+b));
      add('kick','b:4');add('overdrive','b:8');add('pause','b:9');return map;
    }
    if(kind==='gamepad'){
      [context==='frets'?0:1,context==='frets'?1:3,context==='frets'?3:2,context==='frets'?2:context==='drums-four'?0:4,context==='frets'?4:0].forEach((b,i)=>{if(actions(context).includes('lane'+i))add('lane'+i,'b:'+b);});
      if(context==='frets')add('strum','b:12','b:13');else add('kick','b:5');
      add('overdrive','b:8');add('pause','b:9');
    }else if(context!=='frets'){
      add('lane0','n:*:38','n:*:40');add('lane1','n:*:42','n:*:44','n:*:46');
      add('lane2','n:*:48','n:*:50',...(context==='drums-four'?['n:*:51','n:*:59']:[]));
      add(context==='drums-four'?'lane3':'lane4','n:*:41','n:*:43','n:*:45','n:*:47');
      for(const note of [49,55,57])(map.lane3??=[]).push(['n:*:'+note]);
      if(context==='drums-five')(map.lane3??=[]).push(['n:*:51'],['n:*:59']);
      add('kick','n:*:35','n:*:36');
    }
    return map;
  }
  class Hub{
    constructor({navigator={},storage=null,onAction=()=>{},onChange=()=>{},onSignal=()=>{},onLearn=()=>{}}={}){
      Object.assign(this,{navigator,storage,onAction,onChange,onSignal,onLearn});
      this.context='drums-five';this.enabled=true;this.blocked=true;this.devices=new Map();this.profiles=new Map();this.deviceProfiles=new Map();this.learning=null;this.midi=null;this.midiPending=null;this.storageError='';this.gamepadError='';
      try{const data=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');if(data?.version===1){this.enabled=data.enabled!==false;for(const [key,choice] of Object.entries(data.deviceProfiles||{}).slice(0,100))if(Object.hasOwn(PROFILES,choice))this.deviceProfiles.set(key,choice);for(const [key,contexts] of Object.entries(data.profiles||{}).slice(0,100)){const safe={};for(const c of CONTEXTS){if(!Object.hasOwn(contexts||{},c))continue;const map={};for(const a of actions(c)){const bindings=contexts?.[c]?.[a];if(Array.isArray(bindings))map[a]=bindings.map(cleanBinding).filter(Boolean).slice(0,8);}safe[c]=map;}this.profiles.set(key,safe);}}}catch{}
    }
    save(){try{this.storage?.setItem(STORAGE_KEY,JSON.stringify({version:1,enabled:this.enabled,profiles:Object.fromEntries(this.profiles),deviceProfiles:Object.fromEntries(this.deviceProfiles)}));this.storageError='';}catch{this.storageError='Mapping works for this visit, but the browser could not save it. Allow site storage to keep it.';}this.onChange();}
    list(){return [...this.devices.values()].map(({id,key,name,kind,standard})=>({id,key,name,kind,standard:!!standard,...this.profileInfo(id)}));}
    profileInfo(id,context=this.context){const d=this.devices.get(id);if(!d)return {};let choice=this.deviceProfiles.get(d.key)||'auto';if(!profileChoices(d).includes(choice))choice='auto';const effective=choice==='auto'?detectProfile(d):choice;return {profile:choice,effectiveProfile:effective,profileLabel:PROFILES[effective],custom:Object.hasOwn(this.profiles.get(d.key)||{},context)};}
    mapping(id,context=this.context){const d=this.devices.get(id);if(!d)return {};const stored=this.profiles.get(d.key);return Object.hasOwn(stored||{},context)?stored[context]:builtin(d,context,this.profileInfo(id).profile);}
    selectProfile(id,choice){const d=this.devices.get(id);if(!d||!profileChoices(d).includes(choice))return false;this.cancelLearn();this.release(d);d.ready=false;this.deviceProfiles.set(d.key,choice);this.save();return true;}
    restoreBuiltin(id,context){const d=this.devices.get(id);if(!d)return;this.cancelLearn();this.release(d);d.ready=false;const p=this.profiles.get(d.key);if(p)delete p[context];this.save();}
    release(d){for(const a of d.active)this.onAction(a,false,`${d.id}:${a}`);d.active.clear();}
    reset(){for(const d of this.devices.values()){this.release(d);d.ready=false;if(d.kind==='midi')d.tokens.clear();}this.cancelLearn();}
    setContext(context){if(!CONTEXTS.includes(context)||context===this.context)return;this.reset();this.context=context;this.onChange();}
    setBlocked(blocked){if(this.blocked===blocked)return;this.blocked=blocked;for(const d of this.devices.values()){this.release(d);d.ready=false;if(d.kind==='midi')d.tokens.clear();}}
    setEnabled(enabled){this.reset();this.enabled=!!enabled;this.save();}
    addDevice(id,key,name,kind,extra={}){const d={id,key,name,kind,active:new Set(),tokens:new Set(),ready:false,...extra};this.devices.set(id,d);this.onChange();return d;}
    removeDevice(id){const d=this.devices.get(id);if(!d)return;this.release(d);if(this.learning?.id===id)this.cancelLearn();if(d.port)d.port.onmidimessage=null;this.devices.delete(id);this.onChange();}
    assign(id,context,action,binding){
      const d=this.devices.get(id),b=cleanBinding(binding);if(!d||!b||!actions(context).includes(action))return false;
      const profiles=this.profiles.get(d.key)||{},map=structuredClone(this.mapping(id,context));let moved=false;
      for(const a of actions(context)){if(a!==action&&map[a]?.some(old=>overlap(old,b)))moved=true;if(map[a])map[a]=map[a].filter(old=>!overlap(old,b));}
      map[action]=[...(map[action]||[]),b].slice(-8);profiles[context]=map;this.profiles.set(d.key,profiles);this.release(d);d.ready=false;this.save();return moved;
    }
    clear(id,context,action){const d=this.devices.get(id);if(!d)return;const p=this.profiles.get(d.key)||{},map=structuredClone(this.mapping(id,context));delete map[action];p[context]=map;this.profiles.set(d.key,p);this.release(d);d.ready=false;this.save();}
    usePreset(id,context,name='standard'){const d=this.devices.get(id);if(!d||name==='ghwt-xbox360'&&!d.standard)return false;const map=preset(d.kind,context,name);if(!map)return false;this.cancelLearn();const p=this.profiles.get(d.key)||{};p[context]=map;this.profiles.set(d.key,p);this.release(d);d.ready=false;this.save();return true;}
    clearProfile(id,context){const d=this.devices.get(id);if(!d)return;this.cancelLearn();const p=this.profiles.get(d.key)||{};p[context]={};this.profiles.set(d.key,p);this.release(d);d.ready=false;this.save();}
    learn(id,context,action,now=0){this.cancelLearn();const d=this.devices.get(id);if(!d||!actions(context).includes(action))return false;this.release(d);this.learning={id,context,action,expires:now+10000,ready:d.kind==='midi'||d.tokens.size===0,candidate:[],changed:now};this.onChange();return true;}
    cancelLearn(){if(!this.learning)return;this.learning=null;this.onChange();}
    finishLearn(binding){const l=this.learning;if(!l)return;this.learning=null;const moved=this.assign(l.id,l.context,l.action,binding);this.onLearn({...l,binding,moved});}
    updateActions(d,next){const desired=new Set(next);for(const a of [...d.active])if(!desired.has(a)){d.active.delete(a);this.onAction(a,false,`${d.id}:${a}`);}for(const a of ACTIONS)if(desired.has(a)&&!d.active.has(a)){d.active.add(a);this.onAction(a,true,`${d.id}:${a}`);}}
    poll(now=0){
      if(this.learning&&now>=this.learning.expires){this.learning=null;this.onLearn({timeout:true});this.onChange();}
      const previousError=this.gamepadError;let pads;
      try{pads=Array.from(this.navigator.getGamepads?.()||[]);this.gamepadError=typeof this.navigator.getGamepads==='function'?'':'This browser cannot read game controllers. Try desktop Chrome or Edge. MIDI is enabled separately below.';}
      catch{pads=[];this.gamepadError='Controller access is blocked. Open Riffbound directly in a browser tab and allow controller access.';}
      if(previousError!==this.gamepadError)this.onChange();
      const connected=new Set();
      for(const pad of pads){if(!pad||pad.connected===false)continue;const id='gamepad:'+pad.index,key=`gamepad:${pad.id}:${pad.buttons.length}:${pad.axes.length}`;connected.add(id);let d=this.devices.get(id);
        if(d&&d.key!==key){this.removeDevice(id);d=null;}
        if(!d)d=this.addDevice(id,key,pad.id||'Game controller','gamepad',{baseline:Array.from(pad.axes).map(x=>Number(x)||0),standard:pad.mapping==='standard'});
        const tokens=new Set();Array.from(pad.buttons).slice(0,128).forEach((b,i)=>{if(typeof b==='number'?b>.5:b?.pressed||b?.value>.5)tokens.add('b:'+i);});
        Array.from(pad.axes).slice(0,32).forEach((v,i)=>{const delta=v-d.baseline[i];for(const sign of ['+','-']){const token=`a:${i}:${sign}`,n=delta*(sign==='+'?1:-1);if(n>(d.tokens.has(token) ? .35 : .65))tokens.add(token);}});
        const previousTokens=d.tokens,changed=signature([...tokens].sort())!==signature([...previousTokens].sort());d.tokens=tokens;
        if(!d.ready){if(!tokens.size)d.ready=true;this.release(d);}
        const l=this.learning;
        if(l?.id===id){
          if(!l.ready){if(!tokens.size)l.ready=true;}
          else if(tokens.size){const candidate=[...tokens].sort();if(signature(candidate)!==signature(l.candidate)){l.candidate=candidate;l.changed=now;}if(now-l.changed>=65)this.finishLearn(l.candidate);}
          else if(l.candidate.length)this.finishLearn(l.candidate);
        }
        const next=matches(this.mapping(id),tokens);
        if(changed&&tokens.size)this.onSignal({id,label:bindingLabel([...tokens].sort()),actions:next,tokens:[...tokens]});
        if(this.enabled&&!this.blocked&&!this.learning&&d.ready){
          if(this.context.startsWith('drums'))for(const action of next)if(d.active.has(action)&&this.mapping(id)[action].some(b=>b.every(t=>tokens.has(t))&&!b.every(t=>previousTokens.has(t)))){d.active.delete(action);this.onAction(action,false,`${id}:${action}`);}
          this.updateActions(d,next);
        }else this.release(d);
      }
      for(const d of [...this.devices.values()])if(d.kind==='gamepad'&&!connected.has(d.id))this.removeDevice(d.id);
    }
    async enableMidi(){
      if(this.midi){this.syncMidi();return this.midi;}
      if(!this.navigator.requestMIDIAccess)throw Error('Live MIDI is unavailable in this browser. Try desktop Chrome or Edge and open Riffbound directly.');
      if(this.midiPending)return this.midiPending;
      this.midiPending=(async()=>{try{this.midi=await this.navigator.requestMIDIAccess({sysex:false});this.midi.onstatechange=()=>this.syncMidi();this.syncMidi();return this.midi;}catch(error){throw Error(error?.name==='NotAllowedError'||error?.name==='SecurityError'?'MIDI permission was blocked. Open Riffbound directly in Chrome or Edge, allow MIDI in site permissions, and try again.':'Could not open MIDI devices. Check the USB connection and close other MIDI apps, then try again.');}finally{this.midiPending=null;}})();return this.midiPending;
    }
    syncMidi(){const connected=new Set();for(const port of this.midi?.inputs.values()||[]){if(port.state==='disconnected')continue;const id='midi:'+port.id;connected.add(id);let d=this.devices.get(id);if(!d)d=this.addDevice(id,`midi:${port.manufacturer||''}:${port.name||''}:${port.id}`,port.name||'MIDI input','midi',{port});if(d.port!==port){d.port.onmidimessage=null;d.port=port;}port.onmidimessage=e=>this.midiMessage(id,e.data);}
      for(const d of [...this.devices.values()])if(d.kind==='midi'&&!connected.has(d.id))this.removeDevice(d.id);this.onChange();}
    midiMessage(id,data){
      const d=this.devices.get(id);if(!d||!data||data.length<3)return;const type=data[0]&240,channel=data[0]&15,note=data[1],velocity=data[2];if(note>127||velocity>127)return;
      if(type===176&&[120,123].includes(note)){this.release(d);d.tokens.clear();return;}
      if(type!==144&&type!==128)return;const token=`n:${channel}:${note}`,down=type===144&&velocity>0;
      if(down)d.tokens.add(token);else d.tokens.delete(token);
      const l=this.learning;
      if(down&&l?.id===id&&l.ready){this.finishLearn([token]);this.onSignal({id,label:bindingLabel([token])+` · velocity ${velocity}`,actions:[],tokens:[token,`n:*:${note}`]});return;}
      if(l?.id===id&&!d.tokens.size)l.ready=true;
      const map=this.mapping(id),next=Object.entries(map).filter(([,bs])=>bs.some(b=>b.length===1&&(b[0]===token||b[0]===`n:*:${note}`))).map(([a])=>a);
      if(down)this.onSignal({id,label:bindingLabel([token])+` · velocity ${velocity}`,actions:next,tokens:[token,`n:*:${note}`]});
      if(!this.enabled||this.blocked||this.learning)return;
      // Drum note-offs are often delayed or omitted. Every positive note-on is a hit.
      if(this.context.startsWith('drums')){if(down)for(const a of next){const owner=`${id}:${token}:${a}`;this.onAction(a,true,owner);this.onAction(a,false,owner);}return;}
      const all=new Set([...d.tokens].flatMap(t=>Object.entries(map).filter(([,bs])=>bs.some(b=>b[0]===t||b[0]===`n:*:${t.split(':')[2]}`)).map(([a])=>a)));
      // A repeated note-on also retriggers a tapped fret before its note-off.
      if(down)for(const a of next)if(d.active.has(a)){d.active.delete(a);this.onAction(a,false,`${id}:${a}`);}
      this.updateActions(d,all);
    }
  }
  return {Hub,STORAGE_KEY,CONTEXTS,PROFILES,EAD_PROFILES,isEad,profileChoices,detectProfile,builtin,actions,labels,bindingLabel,preset,matches};
});
