/* .chart interchange, independently implemented from GuitarGame_ChartFormats (CC0).
 * https://github.com/TheNathannator/GuitarGame_ChartFormats
 * No audio analysis or network access: authored note times stay authored. */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const MAX_BYTES=4*1024*1024,PARTS={Single:'guitar',DoubleBass:'bass',Drums:'drums'},LEVELS=D.LEVELS;
  const clean=value=>String(value??'').replace(/["\r\n\x00-\x1f]/g,' ').slice(0,500);
  const audioFilename=song=>clean((song.filename||'song.ogg').split(/[\\/]/).pop());
  function integer(value,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error(`Invalid ${label} in this chart.`);return n;}
  function tempoMap(resolution,tempos,offset=0){
    if(!Number.isInteger(resolution)||resolution<1||resolution>100000)throw Error('Chart resolution must be between 1 and 100,000.');
    if(!Number.isFinite(offset)||Math.abs(offset)>600)throw Error('Chart offset is invalid.');
    const map=new Map([[0,120]]);
    if(tempos.length>10000)throw Error('This chart has too many tempo changes.');
    for(const t of tempos){integer(t.tick,'tempo position');if(!Number.isFinite(t.bpm)||t.bpm<15||t.bpm>1000)throw Error('Chart tempos must be between 15 and 1,000 BPM.');map.set(t.tick,t.bpm);}
    const points=[...map].sort((a,b)=>a[0]-b[0]).map(([tick,bpm])=>({tick,bpm,time:0}));
    points[0].time=offset;
    for(let i=1;i<points.length;i++){const p=points[i-1];points[i].time=p.time+(points[i].tick-p.tick)*60/p.bpm/resolution;}
    function preceding(value,key){let lo=0,hi=points.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(points[mid][key]<=value)lo=mid;else hi=mid;}return points[lo];}
    return {points,toSeconds(tick){const p=preceding(tick,'tick');return p.time+(tick-p.tick)*60/p.bpm/resolution;},toTick(time){const p=preceding(time,'time');return p.tick+(time-p.time)*p.bpm*resolution/60;}};
  }
  function parse(text,{drumLayout='auto',shiftMs=0}={}){
    if(typeof text!=='string'||!text.trim()||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Choose a non-empty .chart file smaller than 4 MB.');
    if(!['auto','five','pro','four'].includes(drumLayout))throw Error('Choose a supported drum layout.');
    shiftMs=Number(shiftMs);if(!Number.isFinite(shiftMs)||Math.abs(shiftMs)>30000)throw Error('Timing shift must be between −30,000 and 30,000 ms.');
    const sections=new Map();let pending=null,current=null;
    for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
      const line=raw.trim();if(!line||line.startsWith('//'))continue;
      const header=line.match(/^\[([^\]]+)\]\s*(\{)?$/);
      if(header){if(current||pending)throw Error('A chart section is not closed.');pending=header[1];if(sections.has(pending))throw Error('Duplicate chart section: '+pending);if(header[2]){current=pending;pending=null;sections.set(current,[]);}continue;}
      if(line==='{'){if(!pending||current)throw Error('Invalid chart section.');current=pending;pending=null;sections.set(current,[]);continue;}
      if(line==='}'){if(!current)throw Error('Unexpected chart closing brace.');current=null;continue;}
      if(!current)throw Error('This file is not a supported .chart file. Export a .chart file from your chart editor.');
      sections.get(current).push(line);
    }
    if(current||pending||!sections.has('Song')||!sections.has('SyncTrack'))throw Error('The .chart file is incomplete: Song and SyncTrack sections are required.');
    const metadata={};
    for(const line of sections.get('Song')){const m=line.match(/^(\w+)\s*=\s*(.*)$/);if(m)metadata[m[1]]=m[2].replace(/^"(.*)"\s*$/,'$1');}
    const resolution=Number(metadata.Resolution),offset=Number(metadata.Offset||0)+shiftMs/1000,tempos=[],signatures=[];
    for(const line of sections.get('SyncTrack')){
      let m=line.match(/^(\d+)\s*=\s*B\s+(\d+)\s*(?:\/\/.*)?$/);
      if(m){tempos.push({tick:integer(m[1],'tempo position'),bpm:Number(m[2])/1000});continue;}
      m=line.match(/^(\d+)\s*=\s*TS\s+(\d+)(?:\s+(\d+))?\s*(?:\/\/.*)?$/);
      if(m){const tick=integer(m[1],'time signature'),numerator=Number(m[2]),exponent=Number(m[3]??2);if(numerator<1||numerator>64||exponent>6)throw Error('Unsupported time signature.');signatures.push({tick,numerator,exponent});continue;}
      if(!/^\d+\s*=\s*A\s+\d+\s*(?:\/\/.*)?$/.test(line))throw Error('Invalid tempo or time-signature event.');
    }
    const timing=tempoMap(resolution,tempos,offset),rawCharts={},warnings=new Set();let eventCount=0;
    for(const [name,lines] of sections){
      const match=name.match(/^(Easy|Medium|Hard|Expert)(Single|DoubleBass|Drums)$/);if(!match)continue;
      const level=match[1].toLowerCase(),part=PARTS[match[2]],events=[];
      for(const line of lines){
        const m=line.match(/^(\d+)\s*=\s*N\s+(\d+)\s+(\d+)\s*(?:\/\/.*)?$/);
        if(m){events.push({tick:integer(m[1],'note position'),code:integer(m[2],'note type'),length:integer(m[3],'note length')});if(++eventCount>150000)throw Error('This chart has too many events.');}
        else if(!/^\d+\s*=\s*(?:S|E)\s+.+$/.test(line))throw Error('Invalid note event in '+name+'.');
      }
      (rawCharts[part]??={})[level]=events;
    }
    const drumEvents=Object.values(rawCharts.drums||{}).flat(),hasPro=drumEvents.some(n=>[66,67,68].includes(n.code)),hasFive=drumEvents.some(n=>n.code===5);
    if(drumEvents.length&&drumLayout==='auto'){
      if(hasPro&&hasFive)throw Error('This chart mixes five-lane and pro drum markers. Choose its drum layout explicitly.');
      if(hasPro)drumLayout='pro';else if(hasFive)drumLayout='five';
      else throw Error('This file does not identify its drum layout. Choose 5-lane, 4-lane Pro, or 4-lane standard below, then review again.');
    }
    if(drumEvents.length&&drumLayout==='four')warnings.add('Standard 4-lane drums do not identify toms versus cymbals: yellow becomes hi-hat, blue tom, and green cymbal. Use a Pro or 5-lane chart for floor toms.');
    const charts={};
    for(const [part,levels] of Object.entries(rawCharts)){
      charts[part]={};
      for(const [level,events] of Object.entries(levels)){
        const cymbals=new Set(events.filter(n=>[66,67,68].includes(n.code)).map(n=>n.tick+':'+(n.code-64))),seen=new Set(),notes=[];
        for(const n of events){
          let lane;
          if(part==='drums'){
            if(n.code===0||n.code===32)lane=5;
            else if(n.code>=1&&n.code<=5){
              if(drumLayout==='five')lane=n.code-1;
              else if(n.code===5)throw Error('A five-lane green note cannot be read as a four-lane chart. Select 5-lane drums.');
              else if(n.code===1)lane=0;
              else if(drumLayout==='four')lane={2:1,3:2,4:3}[n.code];
              else lane=cymbals.has(n.tick+':'+n.code)?(n.code===2?1:3):(n.code===4?4:2);
            }else if(![34,35,36,37,38,40,41,42,43,44,66,67,68].includes(n.code))throw Error('Unsupported drum note type '+n.code+'.');
            if(lane!==undefined&&n.length)throw Error('This chart uses sustained drum rolls. Export individually charted drum hits before importing.');
          }else{
            if(n.code<=4)lane=n.code;
            else if(n.code===7)throw Error('Open guitar/bass notes are not supported yet. Edit them into fretted notes before importing.');
            else if(![5,6].includes(n.code))throw Error('Unsupported guitar/bass note type '+n.code+'.');
          }
          if(lane===undefined)continue;
          const time=timing.toSeconds(n.tick),duration=part==='drums'?0:timing.toSeconds(n.tick+n.length)-time;
          if(time<0)throw Error('The chart places notes before the audio starts. Increase Timing shift, then review again.');
          const key=n.tick+':'+lane;if(seen.has(key))throw Error('Two notes map to the same pad at the same time. Correct the duplicate or use a five-lane drum arrangement.');seen.add(key);
          notes.push({lane,time,duration});
        }
        if(notes.length>25000)throw Error('A chart difficulty exceeds the 25,000-note limit.');
        // Editors may emit empty difficulty sections. They are unavailable
        // arrangements, not instructions to erase a player's saved chart.
        if(notes.length)charts[part][level]=notes.sort((a,b)=>a.time-b.time||a.lane-b.lane).map((n,id)=>({...n,id}));
      }
      if(!Object.keys(charts[part]).length)delete charts[part];
    }
    if(!Object.values(charts).some(levels=>Object.values(levels).some(notes=>notes.length)))throw Error('No playable 5-fret Guitar, Bass, or Drums notes were found. Vocal and six-fret tracks are not supported by this importer.');
    const ignored=[...sections.keys()].filter(s=>/^(Easy|Medium|Hard|Expert)/.test(s)&&!/^(Easy|Medium|Hard|Expert)(Single|DoubleBass|Drums)$/.test(s));
    if(ignored.length)warnings.add('Other instrument tracks in this file are not imported.');
    return {charts,title:metadata.Name||'',artist:metadata.Artist||'',bpm:timing.points[0].bpm,beat:60/timing.points[0].bpm,drumLayout,warnings:[...warnings],timing:{resolution,offset,tempos:timing.points.map(({tick,bpm})=>({tick,bpm})),signatures},summary:Object.entries(charts).flatMap(([part,levels])=>Object.entries(levels).map(([level,notes])=>`${part} ${level}: ${notes.length} notes`)).join(' · ')};
  }
  function arrange(parsed,duration,previous={}){
    if(!Number.isFinite(duration)||duration<5||duration>480)throw Error('Choose audio between 5 seconds and 8 minutes long.');
    const charts={...previous},derived={};
    for(const [part,levels] of Object.entries(parsed.charts)){
      for(const notes of Object.values(levels))for(const n of notes)if(n.time>duration||n.time+n.duration>duration+.01)throw Error('The chart extends beyond this audio. Choose the matching recording or correct Timing shift.');
      const highest=[...LEVELS].reverse().find(l=>levels[l]?.length);if(!highest)continue;
      const fallback=D.build(levels[highest],part,parsed.beat);
      charts[part]={...fallback,...previous[part],...levels};
      derived[part]=LEVELS.filter(level=>!levels[level]&&!previous[part]?.[level]);
    }
    return {charts,derived};
  }
  function exportChart(song){
    const parts=Object.entries(PARTS).filter(([,part])=>song.charts[part]);if(!parts.length)throw Error('This song has no Guitar, Bass, or Drums chart to export. Vocal pitch pads are kept in .riffpack backups.');
    const retained=song.quality?.chartTiming;
    // A high tick resolution preserves measured timing to well below 1 ms.
    let timing=retained||{resolution:10000,offset:0,tempos:[{tick:0,bpm:Math.round((song.bpm||120)*1000)/1000}],signatures:[]};
    if(retained){const scale=Math.max(1,Math.ceil(10000/retained.resolution));timing={...retained,resolution:retained.resolution*scale,tempos:retained.tempos.map(t=>({...t,tick:t.tick*scale})),signatures:(retained.signatures||[]).map(t=>({...t,tick:t.tick*scale}))};}
    const map=tempoMap(timing.resolution,timing.tempos,timing.offset);
    let minTime=Infinity;for(const [,part] of parts)for(const level of LEVELS)for(const n of song.charts[part][level]||[])minTime=Math.min(minTime,n.time);
    // Other parts can precede an imported chart's positive offset. Rebase the
    // exported grid in that case; onsets still retain their absolute audio times.
    if(minTime<timing.offset)return exportChart({...song,quality:{...song.quality,chartTiming:null}});
    const lines=['[Song]','{',`  Name = "${clean(song.title)}"`,`  Artist = "${clean(song.quality?.chartArtist||'')}"`,'  Charter = "Riffbound"',`  Resolution = ${timing.resolution}`,`  Offset = ${timing.offset}`,`  MusicStream = "${audioFilename(song)}"`,'}','[SyncTrack]','{'];
    const sync=map.points.map(t=>({tick:t.tick,text:`B ${Math.round(t.bpm*1000)}`}));
    for(const t of timing.signatures?.length?timing.signatures:[{tick:0,numerator:4,exponent:2}])sync.push({tick:t.tick,text:`TS ${t.numerator} ${t.exponent}`});
    for(const t of sync.sort((a,b)=>a.tick-b.tick))lines.push(`  ${t.tick} = ${t.text}`);
    lines.push('}','[Events]','{',`  ${Math.max(0,Math.round(map.toTick(song.musicEnd)))} = E "end"`,'}');
    for(const [suffix,part] of parts)for(const level of LEVELS){
      const notes=song.charts[part][level];if(!notes)continue;lines.push(`[${D.NAMES[level]}${suffix}]`,'{');
      for(const n of notes){const tick=Math.max(0,Math.round(map.toTick(n.time))),length=part==='drums'?0:Math.max(0,Math.round(map.toTick(n.time+n.duration))-tick);lines.push(`  ${tick} = N ${part==='drums'?(n.lane===5?0:n.lane+1):n.lane} ${length}`);}lines.push('}');
    }
    return lines.join('\n')+'\n';
  }
  function exportIni(song){return `[song]\nname = ${clean(song.title)}\nartist = ${clean(song.quality?.chartArtist||'')}\ncharter = Riffbound\nfive_lane_drums = True\npro_drums = False\n`;}
  const api={MAX_BYTES,parse,arrange,exportChart,exportIni,tempoMap,audioFilename};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffChartExchange=api;
})(typeof window!=='undefined'?window:globalThis);
