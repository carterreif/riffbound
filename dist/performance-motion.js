/* Continuous character deformation and a deterministic concert camera. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.RiffEngine;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  const drums=E.makeDrumEvents(),leftHits=drums.filter(n=>['snare','tom','floorTom'].includes(n.voice)),rightHits=drums.filter(n=>['hat','openHat','ride','crash'].includes(n.voice));
  const SHOTS=['wide','lead','drums','bass','wide','lead','drums','wide','drums','lead','bass','wide','lead','drums','bass','wide'];
  function performanceEvents(notes,guitar=[]){
    const sorted=notes.slice().sort((a,b)=>a.time-b.time),left=sorted.filter(n=>[0,2,4].includes(n.lane)),right=sorted.filter(n=>[1,3].includes(n.lane));
    const fills=[];let lastEnd=-1;
    for(let i=0;i<left.length;i++){
      const run=left.slice(i,i+6).filter(n=>n.time-left[i].time<=.8),toms=run.filter(n=>n.lane===2||n.lane===4);
      if(run.length>=3&&toms.length>=2&&left[i].time>lastEnd){lastEnd=run.at(-1).time+.3;fills.push({time:Math.max(0,left[i].time-.18),end:lastEnd});}
    }
    const crash=sorted.filter(n=>n.lane===3),cuts=[];for(const note of crash)if(!cuts.length||note.time-cuts.at(-1).time>3)cuts.push(note);
    return {left,right,kick:sorted.filter(n=>n.lane===5),crash,fills,cuts,guitar:guitar.slice().sort((a,b)=>a.time-b.time)};
  }
  const demoPerformance=performanceEvents(drums,E.makeChart('expert'));
  function pulse(notes,time){
    let lo=0,hi=notes.length;while(lo<hi){const mid=(lo+hi)>>1;if(notes[mid].time<time)lo=mid+1;else hi=mid;}
    let result=0;for(let i=Math.max(0,lo-2);i<Math.min(notes.length,lo+2);i++)result=Math.max(result,Math.exp(-Math.pow((time-notes[i].time)/.105,2)));return result;
  }
  function sample({time=0,wallTime=0,state='idle',energy=55,streak=0,overdrive=false,instrument='guitar',reducedMotion=false,beatDuration=E.BEAT,duration=E.DURATION,percussion=null}={}){
    const playing=state==='playing',paused=state==='paused',finished=state==='finished';
    const clock=playing||paused?Math.max(0,time):finished?duration:reducedMotion?0:wallTime*.35;
    const beat=clock/beatDuration,active=(playing||paused)&&!reducedMotion,power=clamp(energy/100,.3,1),strength=active?(overdrive?1.35:1)*power:reducedMotion?0:.08;
    const phrase=Math.floor(beat/8)%SHOTS.length,progress=(beat%8)/8;
    let shot=active?SHOTS[phrase]:'wide';if(instrument==='drums'&&shot==='lead'&&phrase%3===0)shot='drums';
    const performance=percussion||demoPerformance,fill=active&&(performance.fills||[]).some(n=>clock>=n.time&&clock<n.end),crash=active?pulse(performance.crash||[],clock):0;
    const celebration=active?clamp(streak/75,0,1):0,guitarStrike=active?pulse(performance.guitar||[],clock):0;
    if(fill)shot='drums';else if(active&&(performance.cuts||[]).some(n=>clock>=n.time&&clock<n.time+.9))shot='wide';
    const speed=overdrive?1.14:1,cycle=beat*Math.PI*2;
    return {clock,beat,power,overdrive,instrument,playing,paused,reducedMotion,strength,shot,phrase,progress,fill,crash,celebration,guitarStrike,
      pan:active?Math.sin(progress*Math.PI)*.045:0,zoom:active?smooth(0,1,progress)*.12:0,
      head:Math.sin(cycle*.5-.35)*.2*strength,lean:Math.sin(cycle*.25)*.065*strength,
      strum:(Math.sin(cycle*speed)*.01+guitarStrike*.032)*strength,fretting:Math.sin(cycle*.25)*.024*strength,
      leftStrike:active?pulse(performance.left||leftHits,clock):0,rightStrike:active?pulse(performance.right||rightHits,clock):0,
      kickStrike:active?pulse(performance.kick||[],clock):0,
      breathe:reducedMotion?0:Math.sin(clock*2.2)*.0025,
      bounce:active?Math.pow(Math.sin(beat*Math.PI),2)*((overdrive?5:2)+celebration*4)*power:0,
      sway:active?Math.sin(cycle*.25)*.016*strength:0,
      beamPhase:reducedMotion?0:clock*.36,light:reducedMotion?.55:.55+.12*Math.sin(beat*Math.PI),
      guitarFrame:0,bassFrame:0,drummerFrame:0,crowdFrame:0,
    };
  }
  function rotate(x,y,cx,cy,angle,weight=1){const dx=x-cx,dy=y-cy,c=Math.cos(angle),s=Math.sin(angle);return[x+(cx+dx*c-dy*s-x)*weight,y+(cy+dx*s+dy*c-y)*weight];}
  function gaussian(x,y,cx,cy,rx,ry){return Math.exp(-((x-cx)*(x-cx)/(rx*rx)+(y-cy)*(y-cy)/(ry*ry)));}
  function deform(row,x,y,m){
    const ox=x,oy=y;
    if(m.reducedMotion)return[x,y];
    if(row===3){
      const armWeight=1-smooth(.18,.78,y),wave=Math.sin(m.beat*Math.PI+ox*9)*(.034+m.celebration*.025)*m.strength;
      return[x+wave*armWeight,y-Math.abs(wave)*armWeight];
    }
    if(row===2){
      // Separate shoulder regions keep the drum kit still while the sticks arc down.
      const upper=1-smooth(.38,.52,oy),leftWeight=(1-smooth(.3,.43,ox))*upper,rightWeight=smooth(.58,.73,ox)*upper;
      [x,y]=rotate(x,y,.35,.43,.18+(m.fill?1.95:1.74)*m.leftStrike,leftWeight);
      [x,y]=rotate(x,y,.65,.43,-.18-(m.fill?1.95:1.7)*m.rightStrike-.22*m.crash,rightWeight);
      const headWeight=smooth(.28,.4,ox)*(1-smooth(.6,.73,ox))*(1-smooth(.29,.48,oy));
      [x,y]=rotate(x,y,.5,.39,m.head*(m.fill?.9:.55),headWeight);y+=(Math.sin(m.beat*Math.PI)*.012+m.kickStrike*.006)*headWeight*m.strength;
      return[x,y];
    }
    // Plucking and fretting are local motions; the shoulders, head and knees have their own curves.
    const picking=gaussian(ox,oy,.41,.49,.16,.13),neckHand=gaussian(ox,oy,.74,.34,.16,.12);
    y+=picking*m.strum*(row===1?.65:1);x+=picking*m.strum*.28;
    x+=neckHand*m.fretting;y-=neckHand*m.fretting*.44;
    const headWeight=1-smooth(.18,.32,oy);
    [x,y]=rotate(x,y,.51,.27,m.head*(row===1?.8:1),headWeight);
    x+=(x-.51)*(Math.cos(m.head*1.6)-1)*headWeight;
    const hairWeight=headWeight*smooth(.075,.23,Math.abs(ox-.51));
    x+=Math.sin(m.beat*Math.PI-.65)*.025*hairWeight*m.strength;
    y+=Math.sin(m.beat*Math.PI*.5)*.009*headWeight*m.strength;
    const torsoWeight=1-smooth(.66,.94,oy);
    [x,y]=rotate(x,y,.5,.78,m.lean*(row===1?-.8:1),torsoWeight);
    y-=m.breathe*torsoWeight;
    const knees=smooth(.57,.76,oy)*(1-smooth(.84,.97,oy));
    x+=Math.sin(m.beat*Math.PI*.5+(ox<.5?0:Math.PI))*.009*knees*m.strength;
    y+=Math.pow(Math.sin(m.beat*Math.PI*.5),2)*.012*knees*m.strength;
    return[x,y];
  }
  function cameras(m,w,h){
    const wide={drums:{x:w*.5,y:h*.045,size:Math.min(w*.43,h*.37),angle:0},lead:{x:w*.19,y:h*.19,size:Math.min(w*.51,h*.52),angle:m.sway},bass:{x:w*.81,y:h*.205,size:Math.min(w*.49,h*.50),angle:-m.sway*.8}};
    if(m.shot==='wide')return{...wide,backgroundZoom:1.04,backgroundPan:m.reducedMotion?0:Math.sin(m.clock*.16)*.01,focus:null};
    const zoom=1+m.zoom,p=m.pan;
    if(m.shot==='drums')return{...wide,drums:{x:w*(.5+p*.35),y:h*.055,size:Math.min(w*1.05,h*.89)*zoom,angle:0},lead:{x:-w*.2,y:h*.44,size:h*.65,angle:0},bass:{x:w*1.25,y:h*.43,size:h*.68,angle:0},backgroundZoom:1.24+m.zoom*.3,backgroundPan:0,focus:'drums'};
    if(m.shot==='lead')return{...wide,lead:{x:w*(.46+p),y:h*.045,size:Math.min(w*1.34,h*1.16)*zoom,angle:-.04+m.sway*.5},bass:{x:w*1.21,y:h*.4,size:h*.55,angle:0},drums:{x:w*.86,y:h*.17,size:Math.min(w*.41,h*.34),angle:0},backgroundZoom:1.17+m.zoom*.3,backgroundPan:-.13+p*.3,focus:'lead'};
    return{...wide,bass:{x:w*(.54-p),y:h*.045,size:Math.min(w*1.34,h*1.15)*zoom,angle:.035-m.sway*.5},lead:{x:-w*.22,y:h*.43,size:h*.56,angle:0},drums:{x:w*.13,y:h*.15,size:Math.min(w*.41,h*.34),angle:0},backgroundZoom:1.17+m.zoom*.3,backgroundPan:.13-p*.3,focus:'bass'};
  }
  const api={sample,deform,cameras,performanceEvents};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffMotion=api;
})(typeof window!=='undefined'?window:globalThis);
