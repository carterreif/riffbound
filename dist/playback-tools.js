(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function position(now,anchor,seek=0,rate=1,loop=null){
    const elapsed=(now-anchor)*rate,time=seek+elapsed;
    if(!loop||time<loop.end)return {time,cycle:0};
    const span=loop.end-loop.start;if(span<=0)return {time,cycle:0};
    return {time:loop.start+((time-loop.start)%span),cycle:Math.floor((time-loop.start)/span)};
  }
  function practice(start,end,rate,duration){
    start=clamp(Number(start)||0,0,Math.max(0,duration-1));end=clamp(Number(end)||duration,start+1,duration);
    rate=Number(rate);rate=Number.isFinite(rate)&&rate>=.25&&rate<=1?Math.round(rate*20)/20:1;
    return {start,end,rate};
  }
  function segment(notes,loop){return loop?notes.filter(n=>n.time>=loop.start&&n.time<loop.end).map(n=>({...n,duration:Math.min(n.duration,loop.end-n.time),...(n.rollDuration?{rollDuration:Math.min(n.rollDuration,loop.end-n.time)}:{})})):notes;}
  function visibleNotes(notes,loop,time,lookahead){
    if(!loop)return notes;const span=loop.end-loop.start,out=notes.slice();
    for(let cycle=1;cycle<=Math.ceil(lookahead/span);cycle++)for(const note of notes){const next=note.time+span*cycle;if(next>time+lookahead)break;out.push({...note,time:next,hit:false,missed:false,held:false});}
    return out;
  }
  const median=values=>{const a=values.slice().sort((a,b)=>a-b),i=a.length>>1;return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  function missedSection(time,duration){
    if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<1||time<0||time>=duration)return null;
    const start=Math.max(0,Math.min(time-3,Math.max(0,duration-8)));return {start:Math.round(start*1000)/1000,end:Math.min(duration,Math.round((start+8)*1000)/1000)};
  }
  function timingFeedback(error,rate=1){
    if(!Number.isFinite(error)||!Number.isFinite(rate)||rate<=0)return null;
    const ms=Math.round(error/rate*1000);return {ms,kind:Math.abs(ms)<=20?'on-time':ms<0?'early':'late',text:Math.abs(ms)<=20?'ON TIME':`${ms<0?'EARLY':'LATE'} ${Math.abs(ms)} ms`};
  }
  function timingSummary(notes,rate=1){
    const values=notes.filter(n=>n.hit&&Number.isFinite(n.hitOffset)).map(n=>timingFeedback(n.hitOffset,rate)).filter(Boolean);
    if(values.length<8)return null;
    return {count:values.length,medianMs:Math.round(median(values.map(v=>v.ms))),early:values.filter(v=>v.kind==='early').length,late:values.filter(v=>v.kind==='late').length,onTime:values.filter(v=>v.kind==='on-time').length};
  }
  function calibration(errors){
    const values=errors.filter(v=>Number.isFinite(v)&&Math.abs(v)<=250);if(values.length<8)return null;
    const center=median(values),deviation=median(values.map(v=>Math.abs(v-center)));
    const clean=values.filter(v=>Math.abs(v-center)<=Math.max(25,deviation*3));
    if(clean.length<6||deviation>45)return {stable:false,count:values.length};
    return {stable:true,offset:Math.round(clamp(median(clean),-250,250)),spread:Math.round(deviation),count:clean.length};
  }
  const api={position,practice,segment,visibleNotes,calibration,missedSection,timingFeedback,timingSummary};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffPlayback=api;
})(typeof window!=='undefined'?window:globalThis);
