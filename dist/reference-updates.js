/* Update only the verified recording and only reviewed drum arrangements. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const D=node?require('./chart-difficulties.js'):root.RiffDifficulties;
  const R=node?require('./reference-charts.js'):root.RiffReferenceCharts;
  function upgrade(song){
    if(!song?.charts?.drums||song.quality?.chartAdjustments?.drums)return song;
    const reference=R.match(song.id,song.musicEnd);
    if(!reference||(song.quality?.scoreRevision||0)>=reference.revision)return song;
    if(reference.canUpgrade&&!reference.canUpgrade(song))return song;
    const imported=song.quality?.imports?.drums;
    // Only a fingerprinted older backup we authored may be upgraded. Filename
    // matches do not authorize replacement of a player's separately edited chart.
    if(imported&&(!reference.previousImportIds?.includes(imported.id)||(song.quality?.review?.revision||0)>=reference.revision))return song;
    const unique=new Map();
    for(const hit of reference.events)unique.set(`${hit.lane}:${hit.time}`,hit);
    const notes=[...unique.values()].sort((a,b)=>a.time-b.time||a.lane-b.lane)
      .map((hit,id)=>({lane:hit.lane,time:hit.time,duration:0,id,bar:Math.floor(hit.time/reference.beat/4),...(hit.velocity!==undefined?{velocity:hit.velocity}:{}),...(hit.ghost!==undefined?{ghost:hit.ghost}:{})}));
    const built=D.build(notes,'drums',reference.beat),{expert,hard}=built;
    if(reference.authoredQuality)built.normal=built.medium;
    const mixAnalysis={...song.quality?.mixAnalysis};
    if(reference.authoredQuality)delete mixAnalysis.drums;
    return {...song,...(reference.exactTiming&&!reference.authoredQuality?{bpm:reference.bpm,beat:reference.beat,offset:reference.offset}:{}),chartVersion:Math.max(reference.chartVersion||15,song.chartVersion||0),
      charts:{...song.charts,drums:{...song.charts.drums,...(reference.preserveEasyMedium===false?built:{expert,hard})}},
      quality:{...song.quality,preserveEasyMedium:reference.preserveEasyMedium!==false,scoreRevision:reference.revision,
        ...(reference.scoreReference?{scoreReference:reference.scoreReference}:{}),
        ...(imported?{imports:{...song.quality.imports,drums:reference.currentImport},review:{...song.quality.review,revision:reference.revision}}:{}),
        ...(reference.authoredQuality?{imports:{...song.quality?.imports,...reference.authoredQuality.imports},chartTimings:{...song.quality?.chartTimings,...reference.authoredQuality.chartTimings},communityReferences:{...song.quality?.communityReferences,...reference.authoredQuality.communityReferences},audioReviews:{...song.quality?.audioReviews,...reference.authoredQuality.audioReviews},mixAnalysis,methods:{...song.quality?.methods,drums:reference.authoredQuality.methods?.drums||'Authored Clone Hero Drums (SingeMFRC)'}}:{}),
        scoreReview:reference.review||'In Bloom notation review: Expert and Hard updated; Easy and Medium retained.',
        counts:Array.from({length:6},(_,lane)=>expert.filter(n=>n.lane===lane).length),
        sources:{...song.quality?.sources,drums:reference.label}}};
  }
  function message(song){return R.match(song.id,song.musicEnd)?.updateMessage||'In Bloom Expert and Hard updated automatically. Your other charts are unchanged.';}
  const api={upgrade,message};if(node)module.exports=api;else root.RiffReferenceUpdates=api;
})(typeof window!=='undefined'?window:globalThis);
