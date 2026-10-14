/* Per-instrument timing review and uniform song-chart shifts.
 * Attack matching suggests a correction; it never invents or snaps notes. */
(function(root){
  'use strict';
  const X=typeof module!=='undefined'&&module.exports?require('./chart-exchange.js'):root.RiffChartExchange;
  function shift(levels,deltaMs,duration){
    if(!Number.isFinite(deltaMs)||Math.abs(deltaMs)>4000||!Number.isFinite(duration))throw Error('Choose a valid chart timing adjustment.');
    const delta=deltaMs/1000,out={};
    for(const [level,notes] of Object.entries(levels))out[level]=notes.map(n=>{const time=n.time+delta;if(time<0||time+Math.max(n.duration,n.rollDuration||0)>duration+.01)throw Error('That adjustment moves notes outside the audio. Try a smaller shift.');return {...n,time};});
    return out;
  }
  const mapCache=new WeakMap();
  function grid(timing,start,end,shiftMs=0){
    if(!timing)return [];
    let cached=mapCache.get(timing);if(!cached||cached.shiftMs!==shiftMs){cached={shiftMs,map:X.tempoMap(timing.resolution,timing.tempos,timing.offset+shiftMs/1000)};mapCache.set(timing,cached);}
    const map=cached.map,step=timing.resolution,first=Math.max(0,Math.floor(map.toTick(start)/step)),last=Math.ceil(map.toTick(end)/step),beats=[];
    if(last-first>128)throw Error('Too many visible chart beats.');
    const signatures=timing.signatures?.length?[...timing.signatures].sort((a,b)=>a.tick-b.tick):[{tick:0,numerator:4,exponent:2}];
    if(signatures[0].tick>0)signatures.unshift({tick:0,numerator:4,exponent:2});
    for(let beat=first;beat<=last;beat++){
      const tick=beat*step,time=map.toSeconds(tick);if(time<start-.01||time>end+.01)continue;
      let sig=signatures[0];for(const s of signatures){if(s.tick>tick)break;sig=s;}
      const measure=step*sig.numerator*4/2**sig.exponent;
      beats.push({time,major:Math.abs((tick-sig.tick)%measure)<.001});
    }
    return beats;
  }
  function evidence(samples,sampleRate=22050){
    if(!samples?.length||!Number.isFinite(sampleRate)||sampleRate<8000)throw Error('Audio is unavailable for timing review.');
    const hop=Math.max(1,Math.round(sampleRate*.005)),frames=Math.ceil(samples.length/hop),strength=new Float32Array(frames);let baseline=0;
    for(let i=0;i<frames;i++){let energy=0,n=0;for(let j=i*hop;j<Math.min(samples.length,(i+1)*hop);j++){energy+=samples[j]*samples[j];n++;}const rms=Math.sqrt(energy/Math.max(1,n));strength[i]=Math.max(0,rms-baseline);baseline=baseline*.7+rms*.3;}
    const ranked=Array.from(strength).filter(n=>n>0).sort((a,b)=>a-b),threshold=(ranked[Math.floor(ranked.length*.7)]||0)*.5,peaks=[];let max=0;
    for(const value of strength)max=Math.max(max,value);
    for(let i=1;i<frames-1;i++)if(strength[i]>=Math.max(threshold,max*.025)&&strength[i]>strength[i-1]&&strength[i]>=strength[i+1]){
      const time=i*hop/sampleRate,previous=peaks.at(-1);if(previous&&time-previous.time<.03){if(strength[i]>previous.strength)peaks[peaks.length-1]={time,strength:strength[i]};}else peaks.push({time,strength:strength[i]});
    }
    return {peaks,duration:samples.length/sampleRate};
  }
  function review(evidence,notes){
    const unique=[...new Set((notes||[]).map(n=>n.time))].sort((a,b)=>a-b),all=unique.filter(t=>t>.5&&t<evidence.duration-.5);
    const uncertain=message=>({status:'uncertain',suggestedMs:null,message});
    if(all.length<12||all.at(-1)-all[0]<8||evidence.peaks.length<12)return uncertain('Not enough distinct attacks to estimate timing. Preview and adjust by ear.');
    // Equal time windows prevent a dense intro from outweighing a drifting end.
    const first=all[0],span=all.at(-1)-first,groups=[[],[],[]];for(const t of all)groups[Math.min(2,Math.floor((t-first)/span*3))].push(t);
    if(groups.some(group=>group.length<4))return uncertain('Too few chart attacks in one part of the song. Preview the start, middle and end before adjusting timing.');
    const chunks=groups.map(group=>group.length>80?Array.from({length:80},(_,i)=>group[Math.floor(i*(group.length-1)/79)]):group),times=chunks.flat();
    function measure(ms,group=times){
      const errors=[];let matched=0,closeness=0;
      for(const t of group){const target=t+ms/1000;let lo=0,hi=evidence.peaks.length;while(lo<hi){const m=(lo+hi)>>1;if(evidence.peaks[m].time<target)lo=m+1;else hi=m;}
        const error=Math.min(...[evidence.peaks[lo],evidence.peaks[lo-1]].map(p=>p?Math.abs(p.time-target):Infinity));
        if(error<=.025){matched++;closeness+=Math.exp(-Math.pow(error/.012,2));errors.push(error*1000);}
      }
      errors.sort((a,b)=>a-b);return {ms,matched:matched/group.length,score:(matched+closeness)/group.length/2,medianErrorMs:errors.length?errors[Math.floor(errors.length/2)]:Infinity};
    }
    const rank=(a,b)=>b.score-a.score||Math.abs(a.ms)-Math.abs(b.ms),candidates=[];
    // Broad search exposes neighboring-beat aliases; precise search avoids the
    // old flat +/-25 ms match window selecting the edge of a valid attack.
    for(let ms=-1000;ms<=1000;ms+=5)candidates.push(measure(ms));candidates.sort(rank);let best=candidates[0];
    const fine=[];for(let ms=Math.max(-1000,best.ms-5);ms<=Math.min(1000,best.ms+5);ms++)fine.push(measure(ms));fine.sort(rank);best=fine[0];
    const current=measure(0),other=candidates.find(c=>Math.abs(c.ms-best.ms)>=60);
    const windowFits=chunks.map(group=>{
      const nearby=[];for(let ms=best.ms-30;ms<=best.ms+30;ms++)nearby.push(measure(ms,group));nearby.sort(rank);
      return {matched:measure(best.ms,group).matched,shiftMs:nearby[0].ms};
    });
    const stable=windowFits.every(w=>w.matched>=.65&&Math.abs(w.shiftMs-best.ms)<=12)&&Math.max(...windowFits.map(w=>w.shiftMs))-Math.min(...windowFits.map(w=>w.shiftMs))<=15;
    if(current.matched>=.7&&current.medianErrorMs<=12&&best.score-current.score<.12&&stable)return {status:'aligned',suggestedMs:0,matched:current.matched,medianErrorMs:current.medianErrorMs,checked:times.length,message:`Timing appears close to audible attacks (${Math.round(current.matched*100)}% of ${times.length} sampled attacks). Preview to verify the selected instrument.`};
    if(best.matched<.8||best.score-current.score<.15||best.score-(other?.score||0)<.15||best.medianErrorMs>8||!stable||Math.abs(best.ms)<10||Math.abs(best.ms)>=990)return uncertain('Timing is ambiguous or varies across the song. Keep authored timing and preview against this recording.');
    return {status:'suggested',suggestedMs:best.ms,matched:best.matched,medianErrorMs:best.medianErrorMs,checked:times.length,windowFits,message:`Possible uniform shift: ${best.ms>0?'+':''}${best.ms} ms (${best.ms>0?'later':'earlier'} notes), consistent at the start, middle and end. Shared sounds can affect this estimate; preview before keeping it.`};
  }
  const api={shift,grid,evidence,review};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffChartTiming=api;
})(typeof window!=='undefined'?window:globalThis);
