/* Independent Standard MIDI / GuitarGame_ChartFormats reader. Format references:
 * https://github.com/TheNathannator/GuitarGame_ChartFormats (CC0).
 * Timing and authored frets are retained; vocals use Riffbound pitch-pad play. */
(function(root){
  'use strict';
  const X=typeof module!=='undefined'&&module.exports?require('./chart-exchange.js'):root.RiffChartExchange;
  const D=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const Sections=typeof module!=='undefined'&&module.exports?require('./song-sections.js'):root.RiffSongSections;
  const decoder=new TextDecoder();
  function parse(input,{part,drumLayout='auto',outputDrumLayout='five',shiftMs=0,metadata={},legacyRunningStatus=false}={}){
    const bytes=new Uint8Array(input),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=0,count=0;
    const fail=()=>{throw Error('Invalid or unsupported MIDI chart.');};
    const need=n=>{if(p+n>bytes.length)fail();};
    const u32=()=>{need(4);const n=v.getUint32(p);p+=4;return n;};
    const text=n=>{need(n);const s=decoder.decode(bytes.subarray(p,p+n));p+=n;return s;};
    if(!bytes.length||bytes.length>X.MAX_BYTES||text(4)!=='MThd')fail();
    const header=u32();need(header);if(header<6)fail();
    const format=v.getUint16(p),tracks=v.getUint16(p+2),resolution=v.getUint16(p+4);p+=header;
    if(format>1||format===0&&tracks!==1||tracks<1||tracks>128||!resolution||(resolution&0x8000))fail();
    const tempos=[],signatures=[],trackData=[],compatibilityWarnings=new Set();
    for(let t=0;t<tracks;t++){
      if(text(4)!=='MTrk')fail();const length=u32(),end=p+length;need(length);let tick=0,status=0,legacyGap=false,name='',ended=false;const notes=[],active=new Map(),texts=[];
      function vlq(){let n=0;for(let i=0;i<4;i++){if(p>=end)fail();const b=bytes[p++];n=n*128+(b&127);if(!(b&128))return n;}fail();}
      while(p<end){
        tick+=vlq();if(tick>100000000||++count>300000)fail();
        if(p>=end)fail();let s=bytes[p];
        if(s>=128){
          p++;
          if(s<0xf0){status=s;legacyGap=false;}
          else if(legacyRunningStatus&&(s===0xff||s===0xf0||s===0xf7)){legacyGap=!!status;}
          else{status=0;legacyGap=false;}
        }else{
          s=status;if(!s)fail();
          // Some Clone Hero / Phase Shift exports retain channel running status
          // across annotations. Compatibility is opt-in; all byte/chunk bounds,
          // channels, note pairs, offsets and unsupported-note checks still apply.
          if(legacyGap)compatibilityWarnings.add('Legacy chart running status resumed after a metadata or SysEx event.');
        }
        if(s===0xff){if(p>=end)fail();const type=bytes[p++],n=vlq();if(p+n>end)fail();
          const data=bytes.subarray(p,p+n);p+=n;
          if(type===3)name=decoder.decode(data).trim();
          if(type===1||type===5||type===6)texts.push({tick,text:decoder.decode(data)});
          if(type===0x51){if(n!==3)fail();const micro=data[0]*65536+data[1]*256+data[2];if(!micro)fail();tempos.push({tick,bpm:60000000/micro});}
          if(type===0x58){if(n!==4||data[0]<1||data[0]>64||data[1]>6)fail();signatures.push({tick,numerator:data[0],exponent:data[1]});}
          if(type===0x54&&data.some(x=>x!==0))throw Error('MIDI SMPTE offsets require a timing review.');
          if(type===0x2f){if(n)fail();ended=true;if(p!==end)fail();break;}
        }else if(s===0xf0||s===0xf7){const n=vlq();if(p+n>end)fail();const data=bytes.subarray(p,p+n);p+=n;
          // Phase Shift open-note SysEx cannot be converted to a fretted note.
          if(data[0]===0x50&&data[1]===0x53&&data[5]===1)texts.push({tick,text:'UNSUPPORTED_OPENS'});
        }else if(s>=0x80&&s<=0xef){const kind=s>>4,n=(kind===12||kind===13)?1:2;if(p+n>end)fail();const a=bytes[p++],b=n===2?bytes[p++]:0;if(a>127||b>127)fail();
          if(kind===9||kind===8){const key=(s&15)+':'+a;
            if(kind===9&&b){if(active.has(key))fail();active.set(key,{tick,code:a,velocity:b});}
            else if(active.has(key)){const note=active.get(key);active.delete(key);notes.push({...note,length:tick-note.tick});}
          }
        }else fail();
      }
      if(!ended||active.size)fail();trackData.push({name,notes,texts});
    }
    if(p!==bytes.length)fail();
    shiftMs=Number(shiftMs);if(!Number.isFinite(shiftMs)||Math.abs(shiftMs)>30000)fail();
    const timing=X.tempoMap(resolution,tempos,shiftMs/1000),charts={},warnings=[...compatibilityWarnings];
    const sectionMarkers=trackData.filter(track=>track.name==='EVENTS').flatMap(track=>track.texts.map(event=>({name:Sections?.markerName(event.text),time:timing.toSeconds(event.tick)}))).filter(event=>event.name);
    const selected=trackData.filter(t=>({ 'PART GUITAR':'guitar','T1 GEMS':'guitar','PART BASS':'bass','PART DRUMS':'drums','PART DRUM':'drums','PART VOCALS':'vocals' }[t.name]===part));
    if(selected.length>1)throw Error('Duplicate MIDI instrument tracks.');
    for(const track of selected){
      charts[part]={};const seen=new Set();
      const notes=track.notes.sort((a,b)=>a.tick-b.tick||a.code-b.code);
      let layout=drumLayout;
      if(part==='drums'&&layout==='auto')layout=String(metadata.five_lane_drums).toLowerCase()==='true'?'five':String(metadata.pro_drums).toLowerCase()==='true'||notes.some(n=>n.code>=110&&n.code<=112)?'pro':notes.some(n=>[65,77,89,101].includes(n.code))?'five':'four';
      if(part==='drums'&&layout==='four'&&outputDrumLayout!=='four')throw Error('Standard four-lane drums do not identify toms versus cymbals.');
      const fills=notes.filter(n=>n.code>=120&&n.code<=124),codas=trackData.filter(t=>t.name==='EVENTS').flatMap(t=>t.texts.filter(e=>/^\[coda\]$/i.test(e.text.trim())).map(e=>e.tick));
      // Rock Band activation fills use the same five markers as an ending.
      // Keep the authored Expert pattern underneath interior fill windows.
      // Uncharted/final freestyle windows still need a separate play mode.
      if(fills.length){
        const expert=part==='drums'?notes.filter(n=>n.code>=96&&n.code<=100||n.code===95||n.code===101):[];
        if(part!=='drums'||fills.some(f=>{
          if(codas.some(tick=>f.tick>=tick)||f.length<=0||!expert.some(n=>n.tick>=f.tick+f.length))return true;
          if(expert.some(n=>n.tick>=f.tick&&n.tick<f.tick+f.length))return false;
          // A complete interior activation window can cover a rest. Keep it
          // empty, rather than rejecting the entire authored Drum track or
          // inventing playable notes from its five special marker pitches.
          const complete=new Set(fills.filter(n=>n.tick===f.tick&&n.length===f.length).map(n=>n.code)).size===5;
          return !complete||!expert.some(n=>n.tick<f.tick);
        }))throw Error('Freestyle endings need a chart review.');
        warnings.push('Drum activation fills use their authored note pattern; uncharted interior windows stay empty.');
      }
      if(part==='drums'&&track.texts.some(e=>/mix[ _]+[0-3][ _]+drums[0-5]d(?:\]|$)/.test(e.text)))throw Error('Disco-flip drum charts need a color review.');
      // Roll markers are modifiers, not extra hits. Preserve authored note
      // heads and mark their remaining roll window for repeated pad taps.
      const rolls=part==='drums'?notes.filter(n=>n.code===126||n.code===127).map(r=>{
        const codes=new Set();
        for(const base of [96,...(r.velocity>=41&&r.velocity<=50?[84]:[])]){
          const groups=new Map();for(const n of notes)if(n.tick>=r.tick&&n.tick<r.tick+r.length&&n.code>base&&n.code<=base+5){if(!groups.has(n.tick))groups.set(n.tick,new Set());groups.get(n.tick).add(n.code);}
          if(r.code===126){const single=[...groups.values()].find(group=>group.size===1);if(single)for(const code of single)codes.add(code);}
          else for(const code of [...new Set([...groups.values()].flatMap(group=>[...group]))].slice(0,2))codes.add(code);
        }
        return {...r,codes};
      }):[];
      if(['guitar','bass'].includes(part)&&track.texts.some(e=>/ENHANCED_OPENS|UNSUPPORTED_OPENS/.test(e.text))) {
        if(track.texts.some(e=>e.text==='UNSUPPORTED_OPENS')||notes.some(n=>[59,71,83,95].includes(n.code)))throw Error('Open frets are not supported by Riffbound.');
      }
      if(part==='vocals'&&track.texts.some(e=>/(?:#|\^|\*)$/.test(e.text)))throw Error('Unpitched vocal syllables need a separate vocal mode.');
      const pitches=[...new Set(notes.filter(n=>n.code>=36&&n.code<=84).map(n=>n.code))].sort((a,b)=>a-b);
      for(const n of notes){
        let lane,level,pitch;
        if(part==='vocals'){if(n.code<36||n.code>84)continue;level='expert';pitch=n.code;lane=Math.min(4,Math.floor(pitches.indexOf(pitch)*5/pitches.length));}
        else{
          let index=[60,72,84,96].findIndex(base=>n.code>=base&&n.code<=base+(part==='drums'?5:4));
          if(part==='drums'&&n.code===95){index=3;lane=5;}
          if(index<0)continue;level=['easy','medium','hard','expert'][index];const code=n.code-[60,72,84,96][index];
          if(part!=='drums')lane=code;
          else if(lane===undefined){
            if(code===0)lane=5;else if(layout==='five')lane=code-1;
            else if(code===1)lane=0;else if(code===5)throw Error('Mixed five-lane and pro drum chart.');
            else if(outputDrumLayout==='four')lane=code-1;
            else{const tom=notes.some(m=>m.code===108+code&&m.tick<=n.tick&&(m.tick+m.length>n.tick||m.tick===n.tick));lane=tom?(code===4?4:2):(code===2?1:3);}
          }
        }
        if(part==='drums'&&layout!=='five'&&n.length>resolution/3)throw Error('Sustained notes require a five-lane drum chart.');
        const key=level+':'+n.tick+':'+(part==='drums'&&outputDrumLayout==='four'?n.code:lane);if(seen.has(key))throw Error('Two authored notes collapse onto the same pad.');seen.add(key);
        const cutoff=metadata.sustain_cutoff_threshold===undefined?resolution/3:Number(metadata.sustain_cutoff_threshold);if(!Number.isFinite(cutoff)||cutoff<0||cutoff>100000000)throw Error('Invalid MIDI sustain cutoff.');
        const time=timing.toSeconds(n.tick),hold=part==='drums'||part!=='vocals'&&n.length<cutoff?0:timing.toSeconds(n.tick+n.length)-time;
        const rollEnd=part==='drums'?Math.max(n.tick+(layout==='five'&&n.length>resolution/3?n.length:0),...rolls.filter(r=>r.codes.has(n.code)&&r.tick<=n.tick&&n.tick<r.tick+r.length).map(r=>r.tick+r.length)):n.tick;
        const rollDuration=rollEnd>n.tick?timing.toSeconds(rollEnd)-time:0;
        if(time<0)throw Error('Chart notes start before this audio.');
        let drumVoice;
        if(part==='drums'&&outputDrumLayout==='four'&&layout!=='four'){
          const code=n.code-[60,72,84,96][['easy','medium','hard','expert'].indexOf(level)];
          if(lane===5||code===1)drumVoice=D.drumVoice(lane);
          else if(layout==='five')drumVoice=D.drumVoice(lane);
          else if(layout==='pro'){const tom=notes.some(m=>m.code===108+code&&m.tick<=n.tick&&(m.tick+m.length>n.tick||m.tick===n.tick));drumVoice=D.drumVoice(tom?(code===4?4:2):(code===2?1:3));}
        }
        (charts[part][level]??=[]).push({id:charts[part][level]?.length||0,lane,time,duration:hold,...(drumVoice?{drumVoice}:{}),...(rollDuration?{rollDuration}:{}),...(pitch!==undefined?{pitch}:{}),...(part==='drums'&&track.texts.some(e=>/ENABLE_CHART_DYNAMICS/.test(e.text))?{velocity:n.velocity/127,ghost:n.velocity===1}:{})});
      }
      drumLayout=layout;
      if(!Object.keys(charts[part]).length)delete charts[part];
    }
    if(charts[part])for(const notes of Object.values(charts[part]))notes.sort((a,b)=>a.time-b.time||a.lane-b.lane).forEach((n,id)=>n.id=id);
    if(part==='drums'&&outputDrumLayout==='four'&&charts.drums)charts.drums=D.fourDrumLevels(charts.drums);
    if(!charts[part])throw Error('No supported '+part+' notes in this MIDI chart.');
    if(Object.values(charts[part]).some(a=>a.length>25000))throw Error('Too many MIDI notes.');
    return {charts,title:metadata.name||'',artist:metadata.artist||'',bpm:timing.points[0].bpm,beat:60/timing.points[0].bpm,drumLayout,playLayout:outputDrumLayout,warnings,timing:{resolution,offset:shiftMs/1000,tempos:timing.points.map(({tick,bpm})=>({tick,bpm})),signatures,...(sectionMarkers.length?{sections:Sections.markers(sectionMarkers)}:{})},summary:Object.entries(charts[part]).map(([level,n])=>part+' '+level+': '+n.length+' notes').join(' · ')};
  }
  function parseAll(input,options={}){
    const charts={},warnings=[];let base;
    for(const part of ['guitar','bass','drums','vocals'])try{const parsed=parse(input,{...options,part});base??=parsed;charts[part]=parsed.charts[part];if(part==='drums')base.drumLayout=parsed.drumLayout;}catch(error){warnings.push(part+': '+error.message);}
    if(!base)throw Error(warnings.join(' '));
    return {...base,charts,warnings,summary:Object.entries(charts).flatMap(([part,levels])=>Object.entries(levels).map(([level,notes])=>`${part} ${level}: ${notes.length} notes`)).join(' · ')};
  }
  const api={parse,parseAll};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffMidiChart=api;
})(typeof window!=='undefined'?window:globalThis);
