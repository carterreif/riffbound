/* MusicXML score fallback. Uses notation, never PDF pixels or another part's notes.
 * MusicXML 4.0: https://www.w3.org/2021/06/musicxml40/ */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports,D=node?require('./chart-difficulties.js'):root.RiffDifficulties,X=node?require('./chart-exchange.js'):root.RiffChartExchange;
 const MAX_BYTES=4*1024*1024,PARTS=['guitar','drums','bass','vocals'];
 const children=(n,name)=>(n?.children||[]).filter(c=>c.name===name),one=(n,name)=>children(n,name)[0],value=(n,name)=>one(n,name)?.text.trim()||'';
 const descendants=(n,name)=>(n?.children||[]).flatMap(c=>[...(c.name===name?[c]:[]),...descendants(c,name)]);
 function xml(input){
  if(typeof input!=='string'||new TextEncoder().encode(input).length>MAX_BYTES)throw Error('Choose an uncompressed MusicXML score up to 4 MB.');
  if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(input))throw Error('MusicXML entity declarations are not supported.');
  input=input.replace(/<\?[^]*?\?>|<!--[^]*?-->|<!DOCTYPE[^>]*>/g,'');
  const decode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[e.toLowerCase()]);
  const doc={name:'document',children:[],text:''},stack=[doc];let count=0,position=0;
  for(const m of input.matchAll(/<!\[CDATA\[([^]*?)\]\]>|<[^>]*>|[^<]+/g)){
   if(m.index!==position)throw Error('Malformed MusicXML.');position=m.index+m[0].length;const s=m[0],parent=stack.at(-1);
   if(s.startsWith('<![CDATA[')){parent.text+=m[1];continue;}
   if(s.startsWith('</')){if(stack.length<2||s.slice(2,-1).trim()!==parent.fullName)throw Error('Malformed MusicXML closing tag.');stack.pop();continue;}
   if(s[0]!=='<'){if(/&(?!(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);)/i.test(s))throw Error('Unsupported XML entity.');parent.text+=decode(s);continue;}
   const tag=s.match(/^<([\w:.-]+)((?:\s+[^]*?)?)\/?\s*>$/);if(!tag||++count>150000||stack.length>96)throw Error('Invalid or overly complex MusicXML.');
   const attrs={};let rest=tag[2].replace(/\/\s*$/,'');
   rest=rest.replace(/\s+([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,(_,key,a,b)=>{if(Object.hasOwn(attrs,key))throw Error('Duplicate XML attribute.');attrs[key]=decode(a??b);return '';});if(rest.trim())throw Error('Invalid MusicXML attributes.');
   const n={name:tag[1].split(':').at(-1),fullName:tag[1],attrs,children:[],text:''};parent.children.push(n);if(!/\/\s*>$/.test(s))stack.push(n);
  }
  if(position!==input.length||stack.length!==1||doc.children.length!==1||doc.children[0].name!=='score-partwise')throw Error('Use a score-partwise MusicXML export; PDF, compressed MXL and score images cannot be read here.');
  return doc.children[0];
 }
 const normal=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function classify(def){
  const label=[value(def,'part-name'),...descendants(def,'instrument-name').map(n=>n.text)].join(' ').toLowerCase();
  const programs=descendants(def,'midi-program').map(n=>Number(n.text));
  if(/\b(drums?|drumset|drum set|percussion|batterie)\b/.test(label)||descendants(def,'midi-unpitched').length)return 'drums';
  if(/\b(vocals?|voice|singer|soprano|alto|tenor|baritone|choir)\b/.test(label)||programs.some(p=>p>=53&&p<=55))return 'vocals';
  if(/\b(bass guitar|electric bass|acoustic bass|bass)\b/.test(label)||programs.some(p=>p>=33&&p<=40))return 'bass';
  if(/\b(guitar|guitare)\b/.test(label)||programs.some(p=>p>=25&&p<=32))return 'guitar';
  return null;
 }
 function drumLane(code,label=''){
  if([35,36].includes(code)||/kick|bass drum/i.test(label))return 5;
  if([38,40].includes(code)||/snare/i.test(label))return 0;
  if([42,44,46].includes(code)||/hi.?hat/i.test(label))return 1;
  if([41,43].includes(code)||/floor|low tom/i.test(label))return 4;
  if([45,47,48,50].includes(code)||/tom/i.test(label))return 2;
  if([49,51,52,53,55,57,59].includes(code)||/cymbal|crash|ride|splash|china/i.test(label))return 3;
  return null;
 }
 function parse(text,{title='',artist=''}={}){
  const doc=xml(text),definitions=children(one(doc,'part-list'),'score-part'),warnings=[],issues={},raw={};
  const scoreTitle=value(one(doc,'work'),'work-title')||value(doc,'movement-title'),creators=descendants(doc,'creator').filter(n=>!n.attrs.type||['composer','lyricist','artist'].includes(n.attrs.type)).map(n=>n.text.trim());
  const tempos=new Map(),measures=[],parsed=[];let eventCount=0;
  const number=(s,label,{min=0,max=1000000}={})=>{const n=Number(s);if(s===''||!Number.isFinite(n)||n<min||n>max)throw Error('Invalid '+label+' in MusicXML.');return n;};
  for(const part of children(doc,'part')){
   const def=definitions.find(d=>d.attrs.id===part.attrs.id),kind=classify(def);if(!def)throw Error('Missing MusicXML part definition.');
   if(!part.attrs.id||parsed.some(p=>p.id===part.attrs.id))throw Error('Duplicate MusicXML part.');
   const instruments=new Map(children(def,'score-instrument').map(i=>[i.attrs.id,{label:value(i,'instrument-name')}]));
   for(const midi of children(def,'midi-instrument')){const i=instruments.get(midi.attrs.id)||{};if(value(midi,'midi-unpitched'))i.code=number(value(midi,'midi-unpitched'),'percussion pitch',{min:1,max:128})-1;instruments.set(midi.attrs.id,i);}
   let divisions=1,meter=4,transpose=0;const bars=[];let unsupported='';
   for(const [index,bar] of children(part,'measure').entries()){
    if(index>4000)throw Error('MusicXML has too many measures.');let cursor=0,end=0,lastStart=0;const notes=[],barTempos=[];
    for(const e of bar.children){
     if(e.name==='attributes'){
      if(value(e,'divisions'))divisions=number(value(e,'divisions'),'divisions',{min:1,max:100000});
      const time=one(e,'time');if(time){const beats=value(time,'beats'),unit=value(time,'beat-type');if(!/^\d+$/.test(beats))throw Error('Export additive meters as ordinary measures first.');meter=number(beats,'beats',{min:1,max:64})*4/number(unit,'beat type',{min:1,max:64});}
      const trans=one(e,'transpose');if(trans)transpose=Number(value(trans,'chromatic')||0)+12*Number(value(trans,'octave-change')||0);
      if(descendants(e,'measure-repeat').length||descendants(e,'multiple-rest').length)unsupported='Export written-out measures and rests before importing this part.';
     }else if(e.name==='backup'||e.name==='forward'){
      cursor+=(e.name==='backup'?-1:1)*number(value(e,'duration'),'voice duration')/divisions;if(cursor<-.0001)throw Error('Invalid MusicXML voice position.');end=Math.max(end,cursor);
     }else if(e.name==='direction'||e.name==='sound'){
      if(descendants(e,'swing').length||descendants(e,'instrument-change').length)unsupported='Export explicit playback timing and separate instrument changes first.';
      const sounds=e.name==='sound'?[e]:descendants(e,'sound');
      for(const sound of sounds){if(['dacapo','dalsegno','tocoda','fine','forward-repeat'].some(k=>sound.attrs[k]))unsupported='Export an unfolded score without playback jumps first.';
       if(sound.attrs.tempo){const bpm=number(sound.attrs.tempo,'tempo',{min:15,max:1000}),at=cursor+Number(value(sound,'offset')||value(e,'offset')||0)/divisions;if(at<0)throw Error('Invalid tempo offset.');barTempos.push({at,bpm});}}
      const metro=descendants(e,'metronome')[0];if(metro&&!sounds.some(s=>s.attrs.tempo)){const units={whole:4,half:2,quarter:1,eighth:.5,'16th':.25},unit=units[value(metro,'beat-unit')];if(!unit)throw Error('Unsupported metronome unit.');barTempos.push({at:cursor,bpm:number(value(metro,'per-minute'),'tempo',{min:15,max:1000})*unit*(one(metro,'beat-unit-dot')?1.5:1)});}
     }else if(e.name==='barline'&&(descendants(e,'repeat').length||descendants(e,'ending').length))unsupported='Export an unfolded MusicXML score with repeats written out first.';
     else if(e.name==='note'){
      if(++eventCount>100000)throw Error('MusicXML has too many notes.');
      if(one(e,'grace')||one(e,'cue')){warnings.push('Grace/cue notes omitted.');continue;}
      const length=number(value(e,'duration'),'note duration',{min:.000001})/divisions,chord=!!one(e,'chord'),at=chord?lastStart:cursor;if(!chord){lastStart=at;cursor+=length;}end=Math.max(end,at+length);
      if(one(e,'rest')||!kind)continue;
      if(descendants(e,'tremolo').length||descendants(e,'trill-mark').length||descendants(e,'swing').length)unsupported='Expand ornaments into played notes before importing this part.';
      const pitchNode=one(e,'pitch');let pitch=null,lane=null;
      if(kind==='drums'){
       const ref=one(e,'instrument')?.attrs.id,info=instruments.get(ref)||(instruments.size===1?[...instruments.values()][0]:{});lane=drumLane(info?.code,info?.label);if(lane===null)unsupported='Drum notes need supported instrument names or MIDI percussion assignments; staff position alone is ambiguous.';
      }else{
       if(!pitchNode){unsupported='A pitched part contains unpitched notes.';continue;}
       const step=({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[value(pitchNode,'step')],alter=Number(value(pitchNode,'alter')||0);pitch=(number(value(pitchNode,'octave'),'octave',{min:0,max:9})+1)*12+step+alter+transpose;
       if(!Number.isInteger(pitch)||pitch<0||pitch>127)throw Error('Unsupported microtonal or out-of-range pitch.');
      }
      notes.push({at,length,pitch,lane,voice:value(e,'voice')||'1',staff:value(e,'staff')||'1',ties:children(e,'tie').map(t=>t.attrs.type)});
     }
    }
    const span=bar.attrs.implicit==='yes'?end:Math.max(end,meter);if(!span)throw Error('Empty pickup measure.');measures[index]=Math.max(measures[index]||0,span);bars.push({notes,tempos:barTempos});
   }
   parsed.push({id:part.attrs.id,kind,bars,unsupported});
  }
  const starts=[0];for(const span of measures)starts.push(starts.at(-1)+span);
  for(const p of parsed)for(const [i,bar] of p.bars.entries())for(const t of bar.tempos){const tick=Math.round((starts[i]+t.at)*960);if(tempos.has(tick)&&Math.abs(tempos.get(tick)-t.bpm)>.001)throw Error('Conflicting tempo changes between score parts.');tempos.set(tick,t.bpm);}
  if(!tempos.has(0))throw Error('The score needs an explicit starting tempo. Add a metronome mark before exporting.');
  const timing=X.tempoMap(960,[...tempos].map(([tick,bpm])=>({tick,bpm})),0),duration=timing.toSeconds(starts.at(-1)*960),bpm=tempos.get(0);
  if(duration<5||duration>D.MAX_DURATION)throw Error('Score duration must be between 5 seconds and 15 minutes.');
  for(const p of parsed){
   if(!p.kind)continue;
   if(p.unsupported){issues[p.kind]=p.unsupported;continue;}
   const notes=[],ties=new Map();
   for(const [i,bar] of p.bars.entries())for(const n of bar.notes){
    const time=timing.toSeconds((starts[i]+n.at)*960),end=timing.toSeconds((starts[i]+n.at+n.length)*960),key=[n.voice,n.staff,n.pitch??n.lane].join(':');
    if(n.ties.includes('stop')){const prev=ties.get(key);if(!prev||Math.abs(prev.time+prev.duration-time)>.01)throw Error('Broken MusicXML tie.');prev.duration=end-prev.time;if(!n.ties.includes('start'))ties.delete(key);continue;}
    const note={time,duration:p.kind==='drums'?0:end-time,...(p.kind==='drums'?{lane:n.lane}:{pitch:n.pitch})};notes.push(note);if(n.ties.includes('start')){if(p.kind==='drums')throw Error('Expand tied percussion into explicit hits first.');ties.set(key,note);}
   }
   if(ties.size)throw Error('Unfinished MusicXML tie.');(raw[p.kind]??=[]).push(...notes);
  }
  const charts={};for(const [part,notes] of Object.entries(raw)){
   if(!notes.length)continue;const pitches=[...new Set(notes.map(n=>n.pitch).filter(Number.isFinite))].sort((a,b)=>a-b),unique=new Map();
   for(const n of notes){const lane=part==='drums'?n.lane:Math.round(pitches.indexOf(n.pitch)*4/Math.max(1,pitches.length-1)),key=n.time.toFixed(6)+':'+lane,old=unique.get(key),next={...n,lane};if(!old||old.duration<next.duration)unique.set(key,next);}
   charts[part]=D.build([...unique.values()],part,60/bpm);
  }
  return {charts,identity:{title:scoreTitle||title,artist:creators.join(' / ')||artist},creators,duration,bpm,beat:60/bpm,timing:{resolution:960,offset:0,tempos:[...tempos].map(([tick,bpm])=>({tick,bpm})),signatures:[]},drumLayout:'five',issues,warnings:[...new Set(warnings)],mapping:'Guitar/Bass/Vocals use ascending pitch across five lanes; Drums use Red snare, Yellow hi-hat, Blue tom, Orange cymbal, Green floor tom and kick.'};
 }
 async function lookup({title='',artist='',filename='',parts=PARTS,duration,scoreFile,enabled=true,signal,fetcher=root.fetch?.bind(root),onProgress=()=>{}}={}){
  const empty={charts:{},message:'',issues:{}};if(!scoreFile&&!enabled)return empty;
  const inferred=filename.replace(/\.[^.]+$/,'').split(' - ');if(!title&&inferred.length===2){artist||=inferred[0];title=inferred[1];}
  const abort=()=>{if(signal?.aborted)throw Error('Canceled');};abort();
  const consume=(text,source,remote=false)=>{
   const score=parse(text,{title,artist});
   if(remote&&(normal(score.identity.title)!==normal(title)||!score.creators.some(c=>normal(c)===normal(artist))))throw Error('Score title/composer does not match the requested song and artist.');
   if(duration&&Math.abs(score.duration-duration)>Math.max(3,duration*.02))throw Error('The sheet music has a different duration/arrangement from this audio.');
   const charts=Object.fromEntries(parts.filter(p=>score.charts[p]).map(p=>[p,score.charts[p]]));
   score.identity.title||=scoreFile?.name?.replace(/\.(musicxml|xml)$/i,'')||title;
   if(!Object.keys(charts).length)throw Error('No usable requested instrument part in this score. '+Object.values(score.issues).join(' '));
   return {...score,charts,source,message:'Converted sheet music for '+Object.keys(charts).join(', ')+'. Score timing needs preview against the recording.'};
  };
  if(scoreFile){if(!scoreFile.size||scoreFile.size>MAX_BYTES||!/\.(musicxml|xml)$/i.test(scoreFile.name||''))throw Error('Choose an uncompressed .musicxml or .xml score up to 4 MB.');const text=await scoreFile.text();abort();return consume(text,{provider:'MusicXML file',name:scoreFile.name});}
  if(!title||!artist||!fetcher)return {...empty,message:'Sheet-music lookup needs a song title and artist, or a MusicXML file.'};
  onProgress('No game chart for '+parts.join(', ')+'. Searching downloadable sheet music…');
  const controller=new AbortController(),forward=()=>controller.abort(),timer=setTimeout(()=>controller.abort(),15000);signal?.addEventListener('abort',forward,{once:true});
  const read=async(url,limit,json=false)=>{abort();const r=await fetcher(url,{signal:controller.signal,credentials:'omit'});if(!r.ok)throw Error('Sheet-music source unavailable (HTTP '+r.status+').');if(Number(r.headers?.get('content-length'))>limit)throw Error('Score download too large.');const reader=r.body?.getReader();let text;if(reader){const chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Score download too large.');chunks.push(value);}const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}finally{await reader.cancel().catch(()=>{});}}else{text=await r.text();if(new TextEncoder().encode(text).length>limit)throw Error('Score download too large.');}abort();return json?JSON.parse(text):text;};
  try{
   const quote=s=>'"'+String(s).replace(/["\\]/g,' ')+'"',query='title:'+quote(title)+' AND creator:'+quote(artist)+' AND (format:MusicXML OR format:XML OR subject:MusicXML)';
   const url=new URL('https://archive.org/advancedsearch.php');url.searchParams.set('q',query);url.searchParams.set('output','json');url.searchParams.set('rows','4');for(const f of ['identifier','title','creator'])url.searchParams.append('fl[]',f);
   const result=await read(url.href,256*1024,true);let last='No matching downloadable MusicXML score found.';
   for(const row of (result.response?.docs||[]).slice(0,4)){
    if(normal(row.title)!==normal(title)||![row.creator].flat().some(c=>normal(c)===normal(artist))||!/^[-\w.]+$/.test(row.identifier||''))continue;
    const metadata=await read('https://archive.org/metadata/'+encodeURIComponent(row.identifier),1024*1024,true);if(metadata.is_dark||metadata.metadata?.access_restricted===true||metadata.metadata?.access_restricted==='true')continue;
    for(const file of (metadata.files||[]).filter(f=>/\.(musicxml|xml)$/i.test(f.name||'')&&!/_(meta|files|reviews)\.xml$/i.test(f.name)).slice(0,2))try{
     if(Number(file.size)>MAX_BYTES||file.private||file.name.includes('..')||file.name.startsWith('/'))continue;
     const download='https://archive.org/download/'+encodeURIComponent(row.identifier)+'/'+file.name.split('/').map(encodeURIComponent).join('/');
     return consume(await read(download,MAX_BYTES),{provider:'Internet Archive MusicXML',url:download,page:'https://archive.org/details/'+row.identifier,name:file.name},true);
    }catch(error){abort();if(controller.signal.aborted)throw error;last=error.message;}
   }
   return {...empty,message:last+' Upload a MusicXML score in Add a song, or use audio estimates when audio is available.'};
  }catch(error){abort();return {...empty,message:'Sheet-music lookup could not complete: '+(controller.signal.aborted?'request timed out':error.message)+' Upload a MusicXML score or try again.'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
 }
 async function fill(found,options){
  const parts=options.parts.filter(p=>!found.charts?.[p]?.expert?.length);if(!parts.length)return found;
  const score=await lookup({...options,parts});if(options.signal?.aborted)throw Error('Canceled');
  const scoreParts=Object.keys(score.charts);if(!scoreParts.length)return {...found,message:[found.message,score.message,parts.some(p=>!score.charts[p])?'Not supplied by this score: '+parts.filter(p=>!score.charts[p]).join(', ')+'.':''].filter(Boolean).join(' ')};
  const imports={},sources={},references={},timings={};for(const p of scoreParts){imports[p]={filename:score.source.name,layout:'five',levels:['expert'],derived:['easy','medium','hard']};sources[p]='Sheet music: '+score.source.provider;sources[p]+=' · timing needs review';references[p]={...score.source,kind:'sheet-music',part:p};timings[p]=score.timing;}
  return {...found,charts:{...found.charts,...score.charts},imports:{...found.imports,...imports},sources:{...found.sources,...sources},references:{...found.references,...references},timings:{...found.timings,...timings},scoreParts,sheetMusic:{source:score.source,mapping:score.mapping,warnings:score.warnings,issues:{...score.issues,...Object.fromEntries(parts.filter(p=>!score.charts[p]).map(p=>[p,score.issues[p]||'No supported '+p+' notation in this score.']))},timingVerified:false},identity:found.identity?.title?found.identity:score.identity,duration:found.duration||score.duration,bpm:found.bpm||score.bpm,beat:found.beat||score.beat,drumLayout:score.charts.drums?'five':found.drumLayout,reference:found.reference||references[scoreParts[0]],availableParts:[...new Set([...(found.availableParts||[]),...scoreParts])],message:[found.message,score.message,parts.some(p=>!score.charts[p])?'Not supplied by this score: '+parts.filter(p=>!score.charts[p]).join(', ')+'.':''].filter(Boolean).join(' ')};
 }
 const api={parse,lookup,fill,drumLane,MAX_BYTES};if(node)module.exports=api;else root.RiffSheetMusic=api;
})(typeof window!=='undefined'?window:globalThis);
