/* One measured Expert chart, four playable arrangements. No invented onsets. */
(function(root){
  'use strict';
  const LEVELS=['easy','medium','hard','expert'];
  const NAMES={easy:'Easy',medium:'Medium',hard:'Hard',expert:'Expert'};
  const WINDOWS={easy:.19,medium:.16,hard:.14,expert:.125};
  const APPROACH={easy:3.1,medium:2.7,hard:2.4,expert:2.15};
  const frets=(instrument,level)=>['guitar','bass'].includes(instrument)?level==='easy'?3:level==='medium'?4:5:5;
  function reduce(notes,instrument,beat,level){
    const drums=instrument==='drums';
    const gap=level==='easy'?Math.max(.35,beat*1.15):level==='medium'?Math.max(.18,beat*.6):Math.max(.08,beat*.28);
    const kickGap=level==='easy'?Math.max(.55,beat*2):level==='medium'?Math.max(.25,beat):Math.max(.12,beat*.5);
    const maxHands=drums?(level==='hard'?2:1):(level==='easy'?1:2),groups=[];
    for(const note of notes){
      let group=groups[groups.length-1];
      // Only true simultaneous notes form a chord; no grid snapping.
      if(!group||note.time-group.time>.001){group={time:note.time,notes:[]};groups.push(group);}
      group.notes.push(note);
    }
    let lastHand=-Infinity,lastKick=-Infinity;const selected=[];
    for(const group of groups){
      if(drums&&group.time-lastKick>=kickGap){
        const kick=group.notes.find(n=>n.lane===5);if(kick){selected.push(kick);lastKick=kick.time;}
      }
      if(group.time-lastHand<gap)continue;
      const hands=group.notes.filter(n=>!drums||n.lane!==5);
      if(drums)hands.sort((a,b)=>[0,4,1,3,2][a.lane]-[0,4,1,3,2][b.lane]);
      if(hands.length){selected.push(...hands.slice(0,maxHands));lastHand=group.time;}
    }
    return selected.sort((a,b)=>a.time-b.time||a.lane-b.lane);
  }
  function build(expert,instrument,beat=.5){
    beat=Number.isFinite(beat)&&beat>0?beat:.5;
    const full=expert.map(n=>({...n})).sort((a,b)=>a.time-b.time||a.lane-b.lane);
    const hard=reduce(full,instrument,beat,'hard'),medium=reduce(hard,instrument,beat,'medium'),easy=reduce(medium,instrument,beat,'easy');
    const result={};
    for(const [level,source] of Object.entries({easy,medium,hard,expert:full})){
      const count=frets(instrument,level),notes=[],lastTimes=new Map();
      for(const note of source){
        const lane=count<5?Math.round(note.lane*(count-1)/4):note.lane;
        // Collapsing five pitch positions to three/four frets can merge a chord.
        // Expert is preserved byte-for-byte apart from IDs and object identity.
        if(level!=='expert'&&Math.abs(note.time-(lastTimes.get(lane)??-Infinity))<=.001)continue;lastTimes.set(lane,note.time);
        notes.push({...note,lane,id:notes.length});
      }
      result[level]=notes;
    }
    return result;
  }
  function upgrade(charts,instrument,beat){
    if(!charts||!Array.isArray(charts.expert))return charts;
    if(Array.isArray(charts.medium)&&Array.isArray(charts.hard))return charts;
    // The hidden normal key preserves old Standard charts in portable backups.
    // New arrangements come from the original Expert events without audio analysis.
    return {...charts,...build(charts.expert,instrument,beat)};
  }
  function upgradeAll(charts,beat){return Object.fromEntries(Object.entries(charts).map(([instrument,levels])=>[instrument,upgrade(levels,instrument,beat)]));}
  const api={LEVELS,NAMES,WINDOWS,APPROACH,frets,build,upgrade,upgradeAll};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffDifficulties=api;
})(typeof window!=='undefined'?window:globalThis);
