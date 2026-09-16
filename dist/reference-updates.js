/* Update only the verified recording and only reviewed drum arrangements. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const D=node?require('./chart-difficulties.js'):root.RiffDifficulties;
  const R=node?require('./reference-charts.js'):root.RiffReferenceCharts;
  function upgrade(song){
    if(!song?.charts?.drums||song.quality?.imports?.drums)return song;
    const reference=R.match(song.id,song.musicEnd);
    if(!reference||(song.quality?.scoreRevision||0)>=reference.revision)return song;
    const unique=new Map();
    for(const hit of reference.events)unique.set(`${hit.lane}:${hit.time}`,hit);
    const notes=[...unique.values()].sort((a,b)=>a.time-b.time||a.lane-b.lane)
      .map((hit,id)=>({lane:hit.lane,time:hit.time,duration:0,id,bar:Math.floor(hit.time/reference.beat/4)}));
    const {expert,hard}=D.build(notes,'drums',reference.beat);
    return {...song,chartVersion:Math.max(15,song.chartVersion||0),
      charts:{...song.charts,drums:{...song.charts.drums,expert,hard}},
      quality:{...song.quality,preserveEasyMedium:true,scoreRevision:reference.revision,
        scoreReview:'In Bloom notation review: Expert and Hard updated; Easy and Medium retained.',
        counts:Array.from({length:6},(_,lane)=>expert.filter(n=>n.lane===lane).length),
        sources:{...song.quality?.sources,drums:reference.label}}};
  }
  const api={upgrade};if(node)module.exports=api;else root.RiffReferenceUpdates=api;
})(typeof window!=='undefined'?window:globalThis);
