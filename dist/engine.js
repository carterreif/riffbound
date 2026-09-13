(function(root){
  'use strict';
  const Difficulties=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const BPM=112, BEAT=60/BPM, BARS=32, MUSIC_END=BARS*4*BEAT, DURATION=MUSIC_END+2;
  const KEYS=['KeyD','KeyF','KeyJ','KeyK','KeyL'];
  const COLORS=['#70ed89','#f26781','#f9dd66','#6fb9ff','#f7a265'];
  const RIFFS=[ [0,0,2,0,3,2,1,0], [0,1,2,1,0,2,3,2], [0,0,4,3,2,1,2,0], [2,1,0,1,3,2,1,0], [0,2,1,3,2,4,3,1], [4,3,2,1,0,1,2,3], [0,0,2,3,4,3,2,1], [2,2,1,0,1,3,2,0] ];
  const DRUM_NAMES=['Snare','Hi-hat','Tom','Cymbal','Floor tom'];
  const DRUM_COLORS=['#ff4058','#ffe040','#459bff','#ff942e','#5af465'];
  const KICK_LANE=5, KICK_COLOR='#c696ff';
  // One event list drives both the audible drum kit and its playable chart.
  function makeDrumEvents(){
    const events=[];
    const add=(bar,beat,lane,voice,gain=1,tier=0)=>events.push({bar,time:(bar*4+beat)*BEAT,lane,voice,gain,tier});
    for(let bar=0;bar<BARS;bar++){
      for(let step=0;step<8;step++){
        const beat=step/2;
        const cymbal=bar>=20&&bar<28&&step%2===0;
        add(bar,beat,cymbal?3:1,cymbal?'ride':step===7?'openHat':'hat',cymbal?.8:step%2?.68:1,cymbal?1:step%2?2:step===0||step===4?0:1);
        if(step===0||step===4||(bar>=4&&(step===3||step===6)))add(bar,beat,KICK_LANE,'kick',1,step===0||step===4?0:1);
        if(step===2||step===6)add(bar,beat,0,'snare',bar>=20?1.15:1);
      }
      if(bar%4===0)add(bar,0,3,'crash',1,1);
      if(bar%4===3)add(bar,2.5,2,'tom',.65,0);
      if(bar===11||bar===19||bar===27){
        for(let step=0;step<4;step++)add(bar,3+step*.25,[2,0,4,4][step],['tom','snare','floorTom','floorTom'][step],.45+step*.1,step%2?2:1);
      }
    }
    add(BARS-1,3,3,'crash',.7,1);
    return events.sort((a,b)=>a.time-b.time||a.lane-b.lane);
  }
  function makeLegacyChart(difficulty='normal',instrument='guitar'){
    // Iron Voltage is instrumental; do not fabricate a vocal chart for it.
    if(instrument==='vocals')return [];
    if(instrument==='bass'){
      const pitches=[28,31,26,33],notes=[];
      for(let bar=0;bar<BARS;bar++)for(let step=0;step<8;step++){
        if((bar>=12&&bar<20&&step%2)||(difficulty==='easy'&&step%2))continue;
        const pitch=pitches[[0,0,1,2,0,1,2,3][bar%8]];
        notes.push({id:notes.length,time:(bar*4+step/2)*BEAT,lane:Math.round((pitch-26)/7*4),pitch,duration:0,bar});
      }
      return notes;
    }
    if(instrument==='drums'){
      const tier=difficulty==='easy'?0:difficulty==='expert'?2:1;
      return makeDrumEvents().filter(n=>n.tier<=tier).map((n,id)=>({...n,id,duration:0,hit:false,missed:false,held:false,holdAwarded:0}));
    }
    const notes=[];let id=0;
    for(let bar=0;bar<BARS;bar++){
      const pattern=RIFFS[bar%RIFFS.length];
      for(let step=0;step<8;step++){
        if(bar<4 && step%2)continue;
        if(difficulty==='easy' && step%2)continue;
        if(difficulty==='normal' && ((bar<20 && step===7)||(bar>=28 && step%2)))continue;
        if(bar===31 && step>4)continue;
        if(bar>=12 && bar<20 && step===3)continue;
        let lane=pattern[step];if(difficulty==='easy')lane=lane%3;
        const time=(bar*4+step/2)*BEAT;
        const sustain=(step===6 && (bar<4 || (bar>=28&&bar<31))) ? BEAT*.75 : (bar===31&&step===4?BEAT*1.8:0);
        notes.push({id:id++,lane,time,duration:sustain,bar,hit:false,missed:false,held:false,holdAwarded:0});
        if(difficulty==='expert' && bar>=4 && step===0){const second=(lane+2)%5;notes.push({id:id++,lane:second,time,duration:0,bar,hit:false,missed:false,held:false,holdAwarded:0});}
      }
    }
    return notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);
  }
  function makeChart(difficulty='medium',instrument='guitar'){
    // The original synth uses its existing Standard events as the music score.
    if(difficulty==='normal')return makeLegacyChart('normal',instrument);
    return Difficulties.build(makeLegacyChart('expert',instrument),instrument,BEAT)[difficulty]||[];
  }
  function sectionAt(t){const b=Math.floor(Math.max(0,t)/BEAT/4);return b<4?'THE INTRO':b<12?'MAIN RIFF':b<20?'BREAKDOWN':b<28?'GUITAR SOLO':b<32?'FINAL RIFF':'LET IT RING';}
  class Session{
    constructor(difficulty='medium',mode='tap',instrument='guitar',options={}){
      this.difficulty=difficulty;this.instrument=instrument;this.mode=['drums','vocals'].includes(instrument)?'tap':mode;
      this.notes=options.notes?options.notes.map((n,id)=>({...n,id,hit:false,missed:false,held:false,holdAwarded:0})):makeChart(difficulty,instrument);
      this.musicEnd=options.musicEnd??MUSIC_END;this.window=Difficulties.WINDOWS[difficulty]??.16;
      this.score=0;this.streak=0;this.bestStreak=0;this.hits=0;this.misses=0;this.perfect=0;this.charge=0;this.energy=55;this.overdrive=false;this.lastTime=0;this.onJudge=null;this.onMilestone=null;
    }
    get multiplier(){return Math.min(4,1+Math.floor(this.streak/10))*(this.overdrive?2:1);}
    get accuracy(){return this.hits+this.misses?this.hits/(this.hits+this.misses)*100:0;}
    hitNote(note,time){
      if(note.hit||note.missed)return false;note.hit=true;note.held=note.duration>0;this.hits++;this.streak++;this.bestStreak=Math.max(this.streak,this.bestStreak);
      const perfect=Math.abs(time-note.time)<=.075;if(perfect)this.perfect++;
      this.score+=(perfect?100:65)*this.multiplier;this.energy=Math.min(100,this.energy+1.25);if(!this.overdrive)this.charge=Math.min(100,this.charge+2.7);
      this.onJudge?.(perfect?'PERFECT':'GOOD',note.lane);
      if(this.streak%25===0)this.onMilestone?.(this.streak);return true;
    }
    findTap(lane,time){
      const sharedGreen=this.instrument==='drums'&&lane===4;
      // Choose the closest drum attack, including rapid kicks. Green accepts cymbals too.
      let best;
      for(const note of this.notes){
        if((note.lane!==lane&&!(sharedGreen&&note.lane===3))||note.hit||note.missed||Math.abs(note.time-time)>this.window)continue;
        if(this.instrument!=='drums')return note;
        if(!best||Math.abs(note.time-time)<Math.abs(best.time-time))best=note;
      }
      return best;
    }
    tap(lane,time){
      if(time<-.25)return false;
      const note=this.findTap(lane,time);
      if(note){
        this.hitNote(note,time);
        if(this.instrument==='drums'&&lane===4){
          // One green hit also covers orange + green notes charted at the same instant.
          const other=this.notes.find(n=>n.lane===(note.lane===3?4:3)&&!n.hit&&!n.missed&&Math.abs(n.time-note.time)<.001&&Math.abs(n.time-time)<=this.window);
          if(other){this.hitNote(other,time);this.greenChordTime=time;}
        }
        return true;
      }
      // Still allow the usual two-pad chord if orange follows the shared green hit.
      if(this.instrument==='drums'&&lane===3&&this.greenChordTime!==undefined&&time>=this.greenChordTime&&time-this.greenChordTime<=.035){this.greenChordTime=undefined;return false;}
      this.overstrum(time);return false;
    }
    strum(lanes,time){
      if(time<-.25)return false;
      const candidates=this.notes.filter(n=>!n.hit&&!n.missed&&Math.abs(n.time-time)<=this.window);
      if(!candidates.length){this.overstrum(time);return false;}
      const nearest=candidates.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);
      const chord=candidates.filter(n=>Math.abs(n.time-nearest.time)<.001);
      const required=new Set(chord.map(n=>n.lane));
      if(required.size!==lanes.size||[...required].some(l=>!lanes.has(l))){this.overstrum(time);return false;}
      chord.forEach(n=>this.hitNote(n,time));return true;
    }
    overstrum(time){if(time<0||time>this.musicEnd)return;this.streak=0;this.energy=Math.max(0,this.energy-2);this.onJudge?.('OFF BEAT',-1);}
    activate(){if(this.charge<50||this.overdrive)return false;this.overdrive=true;return true;}
    release(lane){this.notes.forEach(n=>{if(n.lane===lane)n.held=false;});}
    update(time,held){
      const delta=Math.max(0,time-this.lastTime);this.lastTime=time;
      if(this.overdrive){this.charge=Math.max(0,this.charge-delta*12.5);if(this.charge===0)this.overdrive=false;}
      for(const n of this.notes){
        if(!n.hit&&!n.missed&&time>n.time+this.window){n.missed=true;this.misses++;this.streak=0;this.energy=Math.max(0,this.energy-2.3);this.onJudge?.('MISS',n.lane);}
        if(n.hit&&n.held&&held.has(n.lane)){
          const steps=Math.floor(Math.max(0,Math.min(time-n.time,n.duration))*12);
          if(steps>n.holdAwarded){this.score+=(steps-n.holdAwarded)*10*this.multiplier;n.holdAwarded=steps;}
          if(time>n.time+n.duration)n.held=false;
        }
      }
    }
  }
  const api={BPM,BEAT,BARS,MUSIC_END,DURATION,KEYS,COLORS,DRUM_NAMES,DRUM_COLORS,KICK_LANE,KICK_COLOR,Difficulties,makeDrumEvents,makeChart,sectionAt,Session};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffEngine=api;
})(typeof window!=='undefined'?window:globalThis);
