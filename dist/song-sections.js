/* Named practice ranges. Authored labels stay distinct from generated time blocks. */
(function(root){
  'use strict';
  const MAX=512,MAX_DURATION=900;
  const clean=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120):'';
  function markerName(text){
    if(typeof text!=='string')return null;const value=text.trim().replace(/^\[([\s\S]*)\]$/,'$1'),match=value.match(/^(?:section\s+|prc_)(.+)$/i);return match?clean(match[1].replace(/_/g,' ')):null;
  }
  function markers(values,duration=MAX_DURATION){
    if(!Array.isArray(values))return [];const times=new Map();
    for(const value of values.slice(0,MAX)){const name=clean(value?.name),time=value?.time;if(name&&Number.isFinite(time)&&time>=-600&&time<duration)times.set(Math.max(0,time),{name,time:Math.max(0,time)});}
    return [...times.values()].sort((a,b)=>a.time-b.time);
  }
  function ranges(values,duration){
    if(values===undefined)return [];
    if(!Array.isArray(values)||values.length>128)throw Error('The saved practice sections are invalid.');
    return Array.from(values,value=>{
      const name=clean(value?.name),start=value?.start,end=value?.end;
      if(!name||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<1||end>duration)throw Error('Practice sections need a name and at least one second inside this song.');
      return {name,start,end};
    }).sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
  }
  function display(name){return clean(name).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
  function build({duration,beat=.5,markers:source=[],custom=[]}={}){
    if(!Number.isFinite(duration)||duration<1||duration>MAX_DURATION)return [];
    const points=markers(source,duration),saved=ranges(custom,duration);let result=[];
    if(points.length){
      if(points[0].time>=1)points.unshift({name:'Lead-in',time:0});
      result=points.map((point,i)=>({name:display(point.name),start:point.time,end:points[i+1]?.time??duration,source:'chart',id:'chart:'+i})).filter(range=>range.end-range.start>=1);
    }
    if(!result.length){
      const span=Math.max(8,Math.min(128,Number.isFinite(beat)&&beat>0?beat*32:16));
      for(let start=0,index=1;start<duration;start+=span,index++){let end=Math.min(duration,start+span);if(duration-end<1)end=duration;result.push({name:'Section '+index,start,end,source:'generated',id:'generated:'+index});if(end===duration)break;}
    }
    const names=new Set(saved.map(range=>range.name.toLocaleLowerCase()));
    return [...result.filter(range=>!names.has(range.name.toLocaleLowerCase())),...saved.map((range,i)=>({...range,source:'saved',id:'saved:'+i}))].sort((a,b)=>a.start-b.start||a.name.localeCompare(b.name));
  }
  function forSong(song,part){
    const q=song?.quality||{},timing=q.chartTimings?.[part]||q.chartTiming;
    // Per-part timing adjustments are applied after the imported tempo map.
    const shift=(q.chartAdjustments?.[part]||0)/1000;
    return build({duration:song.musicEnd,beat:song.beat,markers:markers(timing?.sections).map(marker=>({...marker,time:marker.time+shift})),custom:song.practiceSections||[]});
  }
  const api={markerName,markers,ranges,build,forSong};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffSongSections=api;
})(typeof window!=='undefined'?window:globalThis);
