/* One measured Expert chart, four playable arrangements. No invented onsets. */
(function(root){
  'use strict';
  const MAX_DURATION=15*60,MAX_REFERENCE_DURATION=MAX_DURATION+15;
  const LEVELS=['easy','medium','hard','expert'];
  const NAMES={easy:'Easy',medium:'Medium',hard:'Hard',expert:'Expert'};
  const WINDOWS={easy:.19,medium:.16,hard:.14,expert:.125};
  const APPROACH={easy:3.1,medium:2.7,hard:2.4,expert:2.15};
  const frets=(instrument,level)=>['guitar','bass'].includes(instrument)?level==='easy'?3:level==='medium'?4:5:5;
  function drumLayout(quality){
    if(['four','five'].includes(quality?.drumLayout))return quality.drumLayout;
    const ref=quality?.communityReferences?.drums;
    if(ref)return /^Guitar Hero(?:\b|:)|^Band Hero\b/i.test(ref.game||ref.setlist||'')&&!ref.guitarOnly?'five':'four';
    return quality?.imports?.drums?.layout==='four'?'four':'five';
  }
  function fourDrums(notes){
    const pads=new Map(),orangeTimes=new Set(notes.filter(n=>n.lane===3).map(n=>n.time));
    for(const note of notes){
      // Five-lane Orange + Green becomes Blue + Green in Clone Hero.
      // This preserves the two-pad chord rather than dropping its tom hit.
      const lane=note.lane===4?(orangeTimes.has(note.time)?2:3):note.lane,key=note.time+':'+lane,prior=pads.get(key),next={...note,lane,duration:0};
      if(prior){
        if(prior.rollDuration||next.rollDuration)prior.rollDuration=Math.max(prior.rollDuration||0,next.rollDuration||0);
        if(prior.velocity!==undefined||next.velocity!==undefined)prior.velocity=Math.max(prior.velocity||0,next.velocity||0);
        if(prior.ghost!==undefined||next.ghost!==undefined)prior.ghost=prior.ghost===true&&next.ghost===true;
      }else pads.set(key,next);
    }
    return [...pads.values()].sort((a,b)=>a.time-b.time||a.lane-b.lane).map((n,id)=>({...n,id}));
  }
  const fourDrumLevels=levels=>Object.fromEntries(Object.entries(levels).map(([level,notes])=>[level,fourDrums(notes)]));
  const drumPlayLayout=quality=>['four','five'].includes(quality?.drumPlayLayout)?quality.drumPlayLayout:drumLayout(quality);
  const drumViews=new WeakMap();
  function playDrums(notes,quality){
    const source=drumLayout(quality),target=drumPlayLayout(quality);if(source===target)return notes;
    let views=drumViews.get(notes);if(!views){views=new Map();drumViews.set(notes,views);}const key=source+':'+target;
    if(!views.has(key))views.set(key,target==='four'?fourDrums(notes):notes.map(n=>({...n,lane:n.lane===3?4:n.lane})));
    return views.get(key);
  }
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
    const full=expert.map(n=>{
      if(instrument!=='drums')return {...n};
      // Drum lanes identify kit voices, never pitches or held frets.
      const {pitch,...hit}=n;return {...hit,duration:0};
    }).sort((a,b)=>a.time-b.time||a.lane-b.lane);
    // Soft attacks remain on Expert; accents carry the simpler arrangements.
    const hard=reduce(full.filter(n=>!n.ghost),instrument,beat,'hard'),medium=reduce(hard,instrument,beat,'medium'),easy=reduce(medium,instrument,beat,'easy');
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
    if(instrument==='drums'&&Object.values(charts).some(notes=>Array.isArray(notes)&&notes.some(n=>n.duration!==0||n.pitch!==undefined))){
      charts=Object.fromEntries(Object.entries(charts).map(([level,notes])=>[level,Array.isArray(notes)?notes.map(n=>{const {pitch,...hit}=n;return {...hit,duration:0};}):notes]));
    }
    if(Array.isArray(charts.medium)&&Array.isArray(charts.hard))return charts;
    // The hidden normal key preserves old Standard charts in portable backups.
    // New arrangements come from the original Expert events without audio analysis.
    return {...charts,...build(charts.expert,instrument,beat)};
  }
  function upgradeAll(charts,beat){return Object.fromEntries(Object.entries(charts).map(([instrument,levels])=>[instrument,upgrade(levels,instrument,beat)]));}
  const api={MAX_DURATION,MAX_REFERENCE_DURATION,LEVELS,NAMES,WINDOWS,APPROACH,frets,drumLayout,drumPlayLayout,playDrums,fourDrums,fourDrumLevels,build,upgrade,upgradeAll};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffDifficulties=api;
})(typeof window!=='undefined'?window:globalThis);
