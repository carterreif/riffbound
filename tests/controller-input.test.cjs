const test=require('node:test'),assert=require('node:assert/strict');
const API=require('../dist/controller-input.js'),E=require('../dist/engine.js');
function rig(options={}){
  const data=options.data||new Map(),events=[],signals=[],learned=[],inputs=new Map();let pads=[];
  const storage=options.storage||{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const midi={inputs,onstatechange:null};
  const hub=new API.Hub({storage,navigator:{getGamepads:()=>pads,requestMIDIAccess:async options=>{assert.deepEqual(options,{sysex:false});return midi;}},onAction:(...e)=>events.push(e),onSignal:s=>signals.push(s),onLearn:r=>learned.push(r)});
  const pad=(index=0,id='Test kit')=>({index,id,mapping:'standard',connected:true,buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]});
  return {hub,events,signals,learned,data,inputs,midi,pad,setPads:p=>pads=p,connect:()=>{const p=pad();pads=[p];hub.poll(0);hub.setBlocked(false);hub.poll(1);return p;},button:(p,i,down)=>p.buttons[i]={pressed:down,value:down?1:0}};
}
const downs=r=>r.events.filter(e=>e[1]).map(e=>e[0]);
test('World Tour Xbox 360 preset separates every drum color, orange cymbal and kick; raw/MIDI/four-lane devices are gated',()=>{
 const r=rig(),p=r.connect();assert.equal(r.hub.usePreset('gamepad:0','drums-five','ghwt-xbox360'),true);r.hub.poll(2);
 const expected=['lane0','lane1','lane2','lane3','lane4','kick'];for(const b of [1,3,2,5,0,4]){r.button(p,b,true);r.hub.poll(3);r.button(p,b,false);r.hub.poll(4);}assert.deepEqual(downs(r),expected);
 r.events.length=0;for(const b of [1,3,2,5,0,4])r.button(p,b,true);r.hub.poll(5);assert.deepEqual(downs(r),expected);assert.equal(r.hub.usePreset('gamepad:0','drums-four','ghwt-xbox360'),false);
 const previous=JSON.stringify(r.hub.mapping('gamepad:0'));r.hub.devices.get('gamepad:0').standard=false;assert.equal(r.hub.usePreset('gamepad:0','drums-five','ghwt-xbox360'),false);assert.equal(JSON.stringify(r.hub.mapping('gamepad:0')),previous);assert.equal(API.preset('midi','drums-five','ghwt-xbox360'),null);
});
test('discovery is passive, standard mappings are built in, button edges do not repeat and disconnect releases holds',()=>{
 const r=rig(),p=r.connect();assert.equal(r.hub.midi,null);assert.equal(r.hub.list().length,1);r.button(p,0,true);r.hub.poll(10);assert.deepEqual(downs(r),['lane4']);r.events.length=0;
 r.button(p,0,false);r.hub.poll(11);r.hub.assign('gamepad:0','drums-five','lane0',['b:0']);r.hub.poll(12);r.button(p,0,true);r.hub.poll(13);r.hub.poll(14);assert.deepEqual(downs(r),['lane0']);r.setPads([]);r.hub.poll(15);assert.equal(r.events.at(-1)[1],false);assert.equal(r.hub.list().length,0);
});
test('all four/five drum colors, simultaneous pads and fast separate kicks reach real scoring',()=>{
 for(const layout of ['four','five']){
  const r=rig(),p=r.connect(),count=layout==='four'?4:5,context='drums-'+layout; r.hub.setContext(context);
  const notes=[...Array.from({length:count},(_,lane)=>({time:1,lane,duration:0})),{time:1,lane:5,duration:0},{time:1.07,lane:5,duration:0}];
  const s=new E.Session('expert','tap','drums',{drumLayout:layout,notes,musicEnd:3});let time=1;
  r.hub.onAction=(a,down)=>{if(down)s.tap(a==='kick'?5:Number(a.slice(4)),time);};
  for(let lane=0;lane<count;lane++)r.hub.assign('gamepad:0',context,'lane'+lane,['b:'+lane]);r.hub.assign('gamepad:0',context,'kick',['b:5']);r.hub.poll(2);
  for(let lane=0;lane<count;lane++)r.button(p,lane,true);r.button(p,5,true);r.hub.poll(3);r.hub.poll(4);assert.equal(s.hits,count+1);
  r.button(p,5,false);r.hub.poll(5);time=1.07;r.button(p,5,true);r.hub.poll(6);assert.equal(s.hits,count+2);assert.equal(s.accuracy,100);
 }
});
test('kit button combinations learn together and take precedence over component buttons',()=>{
 const r=rig(),p=r.connect();r.hub.assign('gamepad:0','drums-five','lane0',['b:0']);r.hub.poll(2);r.hub.learn('gamepad:0','drums-five','lane1',10);
 r.button(p,0,true);r.hub.poll(11);r.button(p,4,true);r.hub.poll(20);r.hub.poll(90);assert.deepEqual(r.hub.mapping('gamepad:0').lane1,[['b:3'],['b:0','b:4']]);assert.deepEqual(downs(r),[]);
 r.button(p,0,false);r.button(p,4,false);r.hub.poll(91);r.button(p,0,true);r.button(p,4,true);r.hub.poll(92);assert.deepEqual(downs(r),['lane1']);
});
test('axes use a neutral baseline and hysteresis; both strum directions can share an action',()=>{
 const r=rig(),p=r.pad();p.axes=[-1,0];r.setPads([p]);r.hub.setContext('frets');r.hub.poll(0);r.hub.setBlocked(false);r.hub.poll(1);
 r.hub.assign('gamepad:0','frets','strum',['a:0:+']);r.hub.assign('gamepad:0','frets','strum',['a:1:-']);r.hub.poll(2);assert.deepEqual(downs(r),[]);
 p.axes[0]=1;r.hub.poll(3);p.axes[0]=-.5;r.hub.poll(4);assert.equal(downs(r).length,1);p.axes[0]=-1;r.hub.poll(5);p.axes[1]=-1;r.hub.poll(6);assert.deepEqual(downs(r),['strum','strum']);
});
test('frets are pressed before a simultaneous strum regardless of assignment order',()=>{
 const r=rig(),p=r.connect();r.hub.setContext('frets');r.hub.assign('gamepad:0','frets','strum',['b:8']);r.hub.assign('gamepad:0','frets','lane0',['b:0']);r.hub.poll(1);r.button(p,8,true);r.button(p,0,true);r.hub.poll(2);assert.deepEqual(downs(r),['lane0','strum']);
});
test('device/layout mappings persist across browser reload and controller index changes',()=>{
 const r=rig(),p=r.connect();r.hub.assign('gamepad:0','drums-four','lane3',['b:0']);r.hub.assign('gamepad:0','drums-five','lane4',['b:1']);r.hub.assign('gamepad:0','frets','lane0',['b:2']);
 const fresh=rig({data:r.data}),p2=fresh.pad(3,p.id);fresh.setPads([p2]);fresh.hub.poll(0);assert.deepEqual(fresh.hub.mapping('gamepad:3','drums-four').lane3,[['b:0']]);assert.deepEqual(fresh.hub.mapping('gamepad:3','drums-five').lane4,[['b:0'],['b:1']]);assert.deepEqual(fresh.hub.mapping('gamepad:3','frets').lane0,[['b:0'],['b:2']]);
 fresh.hub.clear('gamepad:3','drums-four','lane3');assert.equal(fresh.hub.mapping('gamepad:3','drums-five').lane4.length,2);
});
test('modal/focus blocking, disable, context changes and reset require neutral before firing again',()=>{
 const r=rig(),p=r.connect();r.hub.assign('gamepad:0','drums-five','lane0',['b:0']);r.hub.poll(2);r.button(p,0,true);r.hub.poll(3);assert.equal(downs(r).length,1);
 r.hub.setBlocked(true);r.hub.poll(4);assert.equal(r.events.at(-1)[1],false);r.hub.setBlocked(false);r.hub.poll(5);assert.equal(downs(r).length,1);r.button(p,0,false);r.hub.poll(6);r.button(p,0,true);r.hub.poll(7);assert.equal(downs(r).length,2);
 r.hub.setEnabled(false);r.hub.poll(8);assert.equal(r.events.at(-1)[1],false);r.hub.setEnabled(true);r.hub.poll(9);assert.equal(downs(r).length,2);r.hub.setContext('drums-four');r.hub.poll(10);assert.equal(downs(r).length,2);
});
test('learning can cancel, time out and reassign conflicts without duplicate actions',()=>{
 const r=rig(),p=r.connect();r.hub.assign('gamepad:0','drums-five','lane0',['b:0']);r.hub.learn('gamepad:0','drums-five','lane1',5);r.hub.cancelLearn();assert.deepEqual(r.hub.mapping('gamepad:0').lane1,[['b:3']]);
 r.hub.learn('gamepad:0','drums-five','lane1',5);r.hub.poll(10006);assert.equal(r.learned.at(-1).timeout,true);r.hub.learn('gamepad:0','drums-five','lane1',10010);r.button(p,0,true);r.hub.poll(10011);r.button(p,0,false);r.hub.poll(10012);assert.equal(r.learned.at(-1).moved,true);assert.deepEqual(r.hub.mapping('gamepad:0').lane0,[['b:1']]);
});
test('bad saved data and storage failures leave input usable with an explicit save notice',()=>{
 const r=rig({storage:{getItem:()=>'{invalid',setItem:()=>{throw Error('Quota');}}});r.connect();r.hub.assign('gamepad:0','drums-five','kick',['b:0']);assert.match(r.hub.storageError,/could not save/);assert.deepEqual(r.hub.mapping('gamepad:0').kick,[['b:5'],['b:0']]);assert.equal(r.hub.assign('gamepad:0','drums-five','lane99',['b:200']),false);
 const bad=rig({data:new Map([[API.STORAGE_KEY,JSON.stringify({version:1,profiles:{'gamepad:Test kit:16:2':{'drums-five':{lane0:[['b:999'],['n:99:38'],['b:0']]}}}})]])});bad.connect();assert.deepEqual(bad.hub.mapping('gamepad:0').lane0,[['b:0']]);
});
test('MIDI is explicit, hotplugged inputs learn channel/note, velocity-zero and note-offs do not score',async()=>{
 const r=rig();r.hub.setBlocked(false);await r.hub.enableMidi();const port={id:'kit',name:'USB MIDI',manufacturer:'Test',state:'connected'};r.inputs.set(port.id,port);r.midi.onstatechange();const id='midi:kit';assert.equal(typeof port.onmidimessage,'function');
 r.hub.learn(id,'drums-five','lane0',0);port.onmidimessage({data:[0x99,38,70]});assert.deepEqual(r.hub.mapping(id).lane0,[['n:*:40'],['n:9:38']]);assert.deepEqual(downs(r),[]);
 port.onmidimessage({data:[0x99,38,0]});port.onmidimessage({data:[0x89,38,70]});assert.deepEqual(downs(r),[]);
 port.onmidimessage({data:[0x98,38,70]});assert.deepEqual(downs(r),[]);port.onmidimessage({data:[0x99,38,70]});port.onmidimessage({data:[0x99,38,100]});assert.deepEqual(downs(r),['lane0','lane0']);assert.equal(r.events.at(-1)[1],false);
 port.state='disconnected';r.midi.onstatechange();assert.equal(port.onmidimessage,null);assert.equal(r.hub.list().length,0);
});
test('General MIDI preset maps multiple cymbals and kick notes; learning moves wildcard conflicts',async()=>{
 const r=rig();r.inputs.set('kit',{id:'kit',name:'Kit'});await r.hub.enableMidi();r.hub.setContext('drums-four');r.hub.usePreset('midi:kit','drums-four');r.hub.setBlocked(false);
 for(const note of [38,42,48,49,36,36])r.hub.midiMessage('midi:kit',[0x99,note,90]);assert.deepEqual(downs(r),['lane0','lane1','lane2','lane3','kick','kick']);
 r.hub.assign('midi:kit','drums-four','lane2',['n:9:49']);r.hub.midiMessage('midi:kit',[0x99,49,80]);assert.equal(downs(r).at(-1),'lane2');assert.ok(!r.hub.mapping('midi:kit').lane3.some(b=>b[0]==='n:*:49'));
});
test('MIDI guitar sustains release on note-off, all-notes-off and focus block',async()=>{
 const r=rig();r.inputs.set('kit',{id:'kit',name:'Kit'});await r.hub.enableMidi();r.hub.setContext('frets');r.hub.assign('midi:kit','frets','lane0',['n:0:60']);r.hub.setBlocked(false);
 r.hub.midiMessage('midi:kit',[0x90,60,90]);assert.equal(r.events.at(-1)[1],true);r.hub.midiMessage('midi:kit',[0x80,60,0]);assert.equal(r.events.at(-1)[1],false);
 r.hub.midiMessage('midi:kit',[0x90,60,90]);r.hub.midiMessage('midi:kit',[0xb0,123,0]);assert.equal(r.events.at(-1)[1],false);
 r.hub.setBlocked(true);r.hub.midiMessage('midi:kit',[0x90,60,90]);const count=downs(r).length;r.hub.setBlocked(false);r.hub.midiMessage('midi:kit',[0x80,61,0]);assert.equal(downs(r).length,count);
});
test('MIDI permission/unsupported browser and gamepad policy errors are recoverable',async()=>{
 const h=new API.Hub();await assert.rejects(h.enableMidi(),/unavailable/);
 h.navigator={requestMIDIAccess:async()=>{throw Object.assign(Error('Denied'),{name:'NotAllowedError'});},getGamepads:()=>{throw Error('Policy');}};await assert.rejects(h.enableMidi(),/permission was blocked/);h.poll(0);assert.match(h.gamepadError,/blocked/);
 h.navigator.requestMIDIAccess=async()=>({inputs:new Map()});await h.enableMidi();assert.ok(h.midi);h.navigator.getGamepads=()=>[];h.poll(1);assert.equal(h.gamepadError,'');
});
test('recognized Guitar Hero kits and guitars get their own built-in instrument maps; unknown raw devices stay unassigned',()=>{
 for(const [name,expected] of [['Guitar Hero Wireless Drum Kit','gh-drums'],['Band Hero Wireless Drum Kit','gh-drums'],['Device (Vendor: 1430 Product: 0805)','gh-drums'],['Guitar Hero Guitar','guitar'],['Xbox 360 Controller','standard']]){
  const r=rig(),p=r.pad(0,name);r.setPads([p]);r.hub.poll(0);assert.equal(r.hub.profileInfo('gamepad:0').profileLabel,API.PROFILES[expected]);
  if(expected==='gh-drums'){assert.deepEqual(r.hub.mapping('gamepad:0','drums-five').kick,[['b:4']]);assert.deepEqual(r.hub.mapping('gamepad:0','drums-five').lane3,[['b:5']]);assert.deepEqual(r.hub.mapping('gamepad:0','drums-four').lane3,[['b:5'],['b:0']]);assert.deepEqual(r.hub.mapping('gamepad:0','frets'),{});}
  if(expected==='guitar'){assert.deepEqual(r.hub.mapping('gamepad:0','frets').strum,[['b:12'],['b:13']]);assert.deepEqual(r.hub.mapping('gamepad:0','drums-five'),{});}
 }
 const r=rig(),p=r.pad(0,'Unrecognized raw drum controller');p.mapping='';r.setPads([p]);r.hub.poll(0);r.hub.setBlocked(false);r.hub.poll(1);r.button(p,0,true);r.hub.poll(2);assert.deepEqual(downs(r),[]);assert.equal(r.hub.selectProfile('gamepad:0','gh-drums'),false);assert.deepEqual(r.hub.mapping('gamepad:0'),{});
});
test('choosing an instrument type once persists and custom/cleared layouts never get overwritten by built-ins',()=>{
 const r=rig();r.connect();assert.equal(r.hub.selectProfile('gamepad:0','gh-drums'),true);assert.deepEqual(r.hub.mapping('gamepad:0').kick,[['b:4']]);
 r.hub.assign('gamepad:0','drums-five','kick',['b:7']);r.hub.clear('gamepad:0','drums-five','lane0');r.hub.clearProfile('gamepad:0','drums-four');
 const custom=structuredClone(r.hub.mapping('gamepad:0'));r.hub.selectProfile('gamepad:0','standard');assert.deepEqual(r.hub.mapping('gamepad:0'),custom);assert.deepEqual(r.hub.mapping('gamepad:0','drums-four'),{});
 const fresh=rig({data:r.data});fresh.connect();assert.equal(fresh.hub.profileInfo('gamepad:0').profile,'standard');assert.deepEqual(fresh.hub.mapping('gamepad:0'),custom);assert.equal(fresh.hub.mapping('gamepad:0').lane0,undefined);assert.deepEqual(fresh.hub.mapping('gamepad:0','drums-four'),{});
 fresh.hub.restoreBuiltin('gamepad:0','drums-five');assert.equal(fresh.hub.profileInfo('gamepad:0').custom,false);assert.deepEqual(fresh.hub.mapping('gamepad:0').kick,[['b:5']]);assert.deepEqual(fresh.hub.mapping('gamepad:0','drums-four'),{});
});
test('legacy custom data remains exact and unconfigured layouts gain defaults; malformed profile choices are ignored',()=>{
 const key='gamepad:Test kit:16:2',legacy={version:1,deviceProfiles:{[key]:'fake-device-type'},profiles:{[key]:{'drums-five':{lane0:[['b:7']]}}}},r=rig({data:new Map([[API.STORAGE_KEY,JSON.stringify(legacy)]])});r.connect();assert.deepEqual(r.hub.mapping('gamepad:0'),{lane0:[['b:7']]});assert.ok(r.hub.mapping('gamepad:0','frets').strum.length);assert.equal(r.hub.profileInfo('gamepad:0').profile,'auto');
});
test('alternate pads that share a four-lane color retrigger even while the other input is held',()=>{
 const r=rig();const p=r.connect();r.hub.selectProfile('gamepad:0','gh-drums');r.hub.setContext('drums-four');r.hub.poll(1);r.button(p,0,true);r.hub.poll(2);r.button(p,5,true);r.hub.poll(3);assert.deepEqual(downs(r),['lane3','lane3']);r.hub.poll(4);assert.equal(downs(r).length,2);
});
test('MIDI defaults work after permission with no preset action, and MIDI pitch pads have built-in notes',async()=>{
 const r=rig();r.inputs.set('kit',{id:'kit',name:'USB MIDI'});await r.hub.enableMidi();r.hub.setBlocked(false);r.hub.midiMessage('midi:kit',[0x99,38,90]);r.hub.midiMessage('midi:kit',[0x99,36,90]);assert.deepEqual(downs(r),['lane0','kick']);
 r.hub.selectProfile('midi:kit','midi-pads');r.hub.setContext('frets');r.hub.midiMessage('midi:kit',[0x90,60,80]);r.hub.midiMessage('midi:kit',[0x90,72,80]);assert.deepEqual(downs(r).slice(-2),['lane0','strum']);
});

test('EAD profile selection is MIDI-only with separate five-lane cymbal/tom inputs and persistent custom notes',async()=>{
 const r=rig();r.connect();assert.equal(r.hub.selectProfile('gamepad:0','ead-drums'),false);
 r.inputs.set('ead',{id:'ead',name:'EAD50 Port 1',manufacturer:'Yamaha'});await r.hub.enableMidi();const id='midi:ead';
 assert.equal(r.hub.profileInfo(id).profile,'auto');assert.equal(r.hub.profileInfo(id).effectiveProfile,'ead50-drums','named EAD automatically loads its setup after explicit MIDI permission');
 assert.equal(r.hub.selectProfile(id,'ead-drums'),true);assert.deepEqual(r.hub.mapping(id,'frets'),{});r.hub.setBlocked(false);
 for(const note of [38,42,48,49,41,36])r.hub.midiMessage(id,[0x99,note,90]);assert.deepEqual(downs(r),['lane0','lane1','lane2','lane3','lane4','kick']);
 r.events.length=0;r.hub.setContext('drums-four');for(const note of [38,42,48,49,41,36])r.hub.midiMessage(id,[0x99,note,90]);assert.deepEqual(downs(r),['lane0','lane1','lane2','lane3','lane3','kick']);
 r.hub.assign(id,'drums-five','lane3',['n:9:52']);const custom=structuredClone(r.hub.mapping(id,'drums-five'));
 r.hub.selectProfile(id,'midi-drums');assert.deepEqual(r.hub.mapping(id,'drums-five'),custom);r.hub.selectProfile(id,'ead-drums');
 const fresh=rig({data:r.data});fresh.inputs.set('ead',{id:'ead',name:'EAD50 Port 1',manufacturer:'Yamaha'});await fresh.hub.enableMidi();assert.equal(fresh.hub.profileInfo(id).profile,'ead-drums');assert.deepEqual(fresh.hub.mapping(id,'drums-five'),custom);
 fresh.hub.restoreBuiltin(id,'drums-five');assert.deepEqual(fresh.hub.mapping(id,'drums-five').lane3,API.preset('midi','drums-five','ead-drums').lane3);
});

test('named EAD10/20/50 MIDI inputs get complete built-ins automatically without mapping or storage writes',async()=>{
 for(const model of [10,20,50]){
  const r=rig();r.inputs.set('ead',{id:'ead',name:`Yamaha EAD-${model} Port 1`});assert.equal(r.hub.midi,null);await r.hub.enableMidi();const id='midi:ead';assert.equal(r.hub.profileInfo(id).effectiveProfile,`ead${model}-drums`);assert.equal(r.data.size,0);
  for(const layout of ['four','five']){
   const context='drums-'+layout,map=r.hub.mapping(id,context);assert.deepEqual(Object.keys(map).sort(),API.actions(context).filter(a=>!['pause','overdrive'].includes(a)).sort());
   const seen=new Set();for(const bs of Object.values(map))for(const [n] of bs){assert.ok(!seen.has(n),'no note triggers two drum colors');seen.add(n);}
   r.events.length=0;r.hub.setContext(context);r.hub.setBlocked(false);for(const note of layout==='four'?[38,42,48,41,36]:[38,42,48,49,41,36])r.hub.midiMessage(id,[0x99,note,100]);assert.deepEqual(downs(r),layout==='four'?['lane0','lane1','lane2','lane3','kick']:['lane0','lane1','lane2','lane3','lane4','kick']);
  }
  r.hub.selectProfile(id,'midi-drums');assert.equal(r.hub.profileInfo(id).effectiveProfile,'midi-drums');const fresh=rig({data:r.data});fresh.inputs.set('ead',{id:'ead',name:`Yamaha EAD-${model} Port 1`});await fresh.hub.enableMidi();assert.equal(fresh.hub.profileInfo(id).effectiveProfile,'midi-drums','explicit off survives reconnect');
 }
 assert.equal(API.detectProfile({kind:'midi',name:'Bread100 MIDI'}),'midi-drums');assert.equal(API.detectProfile({kind:'gamepad',name:'EAD50',standard:false}),'none');
});
test('EAD maps rim, hi-hat, tom, crash and ride alternates by role, ignoring non-note MIDI events',async()=>{
 const r=rig();r.inputs.set('ead',{id:'ead',name:'EAD20'});await r.hub.enableMidi();r.hub.setBlocked(false);
 for(const note of [37,40,44,46,45,47,50,52,53,55,57,59,43,35])r.hub.midiMessage('midi:ead',[0x99,note,70]);assert.deepEqual(downs(r),['lane0','lane0','lane1','lane1','lane2','lane2','lane2','lane3','lane3','lane3','lane3','lane3','lane4','kick']);
 const count=downs(r).length;for(const data of [[0xb9,4,80],[0xa9,49,90],[0x89,49,80],[0x99,49,0]])r.hub.midiMessage('midi:ead',data);assert.equal(downs(r).length,count);
 assert.equal(API.preset('gamepad','drums-five','ead20-drums'),null);assert.equal(API.preset('midi','frets','ead10-drums'),null);
});
