/* Local audio analysis. No network calls, model service, or canned note patterns. */
(function(root){
  'use strict';
  if(typeof importScripts==='function'&&!root.RiffDifficulties)importScripts('chart-difficulties.js');
  const Difficulties=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  if(typeof importScripts==='function'&&!root.RiffDrumSeparation)importScripts('drum-separation.js');
  const Separation=typeof module!=='undefined'&&module.exports?require('./drum-separation.js'):root.RiffDrumSeparation;
  if(typeof importScripts==='function'&&!root.RiffReferenceCharts)importScripts('reference-charts.js');
  const References=typeof module!=='undefined'&&module.exports?require('./reference-charts.js'):root.RiffReferenceCharts;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function percentile(values,q){const a=Array.from(values).sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*q))]||0;}
  function fftPlan(n){
    const bits=Math.log2(n),reverse=new Uint16Array(n),window=new Float32Array(n),cos=new Float32Array(n/2),sin=new Float32Array(n/2);
    for(let i=0;i<n;i++){let x=i,r=0;for(let b=0;b<bits;b++){r=(r<<1)|(x&1);x>>=1;}reverse[i]=r;window[i]=.5-.5*Math.cos(2*Math.PI*i/(n-1));}
    for(let i=0;i<n/2;i++){cos[i]=Math.cos(2*Math.PI*i/n);sin[i]=-Math.sin(2*Math.PI*i/n);}
    return {reverse,window,cos,sin};
  }
  function spectrum(samples,start,re,im,plan){
    const n=re.length;
    for(let i=0;i<n;i++){re[plan.reverse[i]]=(samples[start+i]||0)*plan.window[i];im[plan.reverse[i]]=0;}
    for(let size=2;size<=n;size*=2){const half=size/2,step=n/size;
      for(let i=0;i<n;i+=size)for(let j=0;j<half;j++){
        const a=i+j,b=a+half,k=j*step,tr=re[b]*plan.cos[k]-im[b]*plan.sin[k],ti=re[b]*plan.sin[k]+im[b]*plan.cos[k];
        re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
      }
    }
  }
  function peaks(values,dt,rms,minGap=.075,quiet=false){
    const scale=percentile(values,.95);if(scale<1e-8)return [];
    const radius=Math.max(2,Math.round(.2/dt)),sum=new Float64Array(values.length+1),out=[];
    for(let i=0;i<values.length;i++)sum[i+1]=sum[i]+values[i];
    for(let i=1;i<values.length-1;i++){
      // A median background keeps nearby loud accents from masking quiet hats.
      const v=values[i],a=Math.max(0,i-radius),b=Math.min(values.length,i+radius+1),mean=quiet?percentile(values.subarray(a,b),.5)*1.9:(sum[b]-sum[a])/(b-a);
      if(v<scale*(quiet?.025:.075)||v<mean*1.3||v<=values[i-1]||v<values[i+1]||rms[i]<.00008)continue;
      const candidate={frame:i,strength:v/scale};
      const last=out[out.length-1];if(last&&(i-last.frame)*dt<minGap){if(candidate.strength>last.strength)out[out.length-1]=candidate;}
      else out.push(candidate);
    }
    return out;
  }
  function tempo(flux,dt){
    const max=percentile(flux,.96)||1,env=Array.from(flux,v=>Math.min(v/max,2));
    const correlation=lag=>{let a=0,b=0,c=0;for(let i=lag;i<env.length;i++){a+=env[i]*env[i-lag];b+=env[i]*env[i];c+=env[i-lag]*env[i-lag];}return a/Math.sqrt(b*c||1);};
    let best={bpm:120,score:-1};
    for(let bpm=65;bpm<=190;bpm++){
      const lag=Math.round(60/bpm/dt);
      const score=(correlation(lag)+.45*correlation(lag*2)+.2*correlation(lag*3))*(1-.04*Math.abs(Math.log2(bpm/115)));
      if(score>best.score)best={bpm:Math.round(60/(lag*dt)),score};
    }
    const beat=60/best.bpm;let offset=0,phaseScore=-1;
    for(let phase=0;phase<beat;phase+=dt){let score=0;for(let t=phase;t<flux.length*dt;t+=beat)score+=env[Math.round(t/dt)]||0;if(score>phaseScore){phaseScore=score;offset=phase;}}
    return {bpm:best.bpm,beat,offset,confidence:best.score};
  }
  function thin(events,gap,threshold=0){
    const selected=[];
    // Prefer stronger onsets when a difficulty's note spacing would collide.
    const occupied=new Map();
    for(const event of events.slice().sort((a,b)=>b.strength-a.strength)){
      if(event.strength<threshold)continue;
      const cell=Math.floor(event.time/gap);let blocked=false;
      for(let k=cell-1;k<=cell+1;k++)for(const other of occupied.get(k)||[])if(Math.abs(event.time-other.time)<gap)blocked=true;
      if(blocked)continue;selected.push(event);if(!occupied.has(cell))occupied.set(cell,[]);occupied.get(cell).push(event);
    }
    return selected.sort((a,b)=>a.time-b.time);
  }
  function median(values){values.sort();return values[values.length>>1];}
  function refineTime(samples,time,sampleRate){
    const step=Math.max(1,Math.round(sampleRate*.003)),start=Math.max(0,Math.floor((time-.065)*sampleRate));
    const end=Math.min(samples.length-step,Math.ceil((time+.04)*sampleRate));
    let previous=0,best=0,at=time;
    for(let j=Math.max(0,start-step);j<start;j++)previous+=samples[j]*samples[j];
    previous=Math.sqrt(previous/step);
    for(let i=start;i<end;i+=step){let energy=0;for(let j=0;j<step;j++)energy+=samples[i+j]*samples[i+j];
      const level=Math.sqrt(energy/step),rise=level-previous;
      if(rise>best){best=rise;at=i/sampleRate;}previous=level;
    }
    return Math.max(0,at);
  }
  function refineDrumTime(samples,time,sampleRate,lane){
    const step=Math.max(1,Math.round(sampleRate*.002)),begin=Math.max(0,Math.floor((time-.09)*sampleRate)),end=Math.min(samples.length-step,Math.ceil((time+.03)*sampleRate));
    const cutoff=lane===5?180:(lane===1||lane===3)?2500:1400,alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate),high=lane===1||lane===3;
    let low=0,previous=0,best=0;const rises=[];
    for(let i=begin;i<end;i+=step){let energy=0;
      for(let j=0;j<step;j++){const value=samples[i+j];low+=alpha*(value-low);const filtered=high?value-low:low;energy+=filtered*filtered;}
      const level=Math.sqrt(energy/step),rise=level-previous;previous=level;
      if(i/sampleRate>=time-.027){rises.push({time:i/sampleRate,rise});best=Math.max(best,rise);}
    }
    // Favor the start of a strike over its louder, later body resonance.
    return Math.max(0,rises.find(e=>e.rise>=best*.6&&e.rise>0)?.time??time);
  }
  function drumFeatures(samples,time,sampleRate,plan,re,im){
    const n=re.length;
    const measure=seconds=>{
      spectrum(samples,Math.round((time+seconds)*sampleRate)-n/2,re,im,plan);
      const bands=[0,0,0,0,0];let peak=0,bin=0,total=0;
      for(let k=3;k<n/2;k++){
        const hz=k*sampleRate/n,power=(re[k]*re[k]+im[k]*im[k])/(n*n);
        if(hz>10000)break;
        bands[hz<90?0:hz<150?1:hz<400?2:hz<2500?3:4]+=power;total+=power;
        if(hz>=40&&hz<400&&power>peak){peak=power;bin=k;}
      }
      const power=k=>re[k]*re[k]+im[k]*im[k];
      const a=Math.log(power(bin-1)+1e-20),b=Math.log(power(bin)+1e-20),c=Math.log(power(bin+1)+1e-20);
      const frequency=bin?(bin+clamp(.5*(a-c)/(a-2*b+c||1),-.5,.5))*sampleRate/n:0;
      return {bands,total,frequency,peak};
    };
    const before=measure(-.055),early=measure(.025),body=measure(.075),late=measure(.16);
    return {before,early,body,late};
  }
  function drumVoices(features){
    const {before,early,body,late}=features,voices=[];
    const low=early.bands[0]+early.bands[1]+early.bands[2],high=early.bands[4];
    // Treat one resonating drum as one voice. Its attack may cross several bands.
    const beforeLow=before.bands[0]+before.bands[1]+before.bands[2];
    const resonant=low>early.total*.5&&early.peak>early.total*.06&&low>beforeLow*1.2;
    if(resonant){
      const frequency=body.total>early.total*.015?body.frequency:early.frequency;
      const sweep=early.frequency/Math.max(1,frequency);
      voices.push(frequency<68||(sweep>1.55&&frequency<110)?5:frequency<102?4:2);
    }
    // Short noisy attacks, a snare body, and a ringing cymbal have different envelopes.
    // A bass drum can coexist with this voice; its high click must not create a cymbal.
    const lowDecay=(body.bands[0]+body.bands[1]+body.bands[2])/(low+1e-15),noiseDecay=body.bands[4]/(high+1e-15);
    const lowTail=(late.bands[0]+late.bands[1]+late.bands[2])/(low+1e-15),noiseTail=late.bands[4]/(high+1e-15);
    const separateNoise=high>early.total*.045||(resonant&&high>early.total*.002&&(noiseDecay<lowDecay*.4||noiseDecay>lowDecay*2.5||noiseTail>lowTail*3));
    if(separateNoise&&high>1e-9&&high>before.bands[4]*1.3){
      const bodyRatio=(resonant?body.bands[2]/(body.bands[4]+1e-15):early.bands[2]/high);
      const snare=noiseDecay>.035&&(bodyRatio>.12||(!resonant&&early.bands[3]/high>.75));
      const ringing=noiseDecay>.48;
      // A snare's pitched shell and wire noise belong to the same hand hit.
      // Keep a concurrent bass drum, but do not turn the shell into a tom.
      if(snare)for(let i=voices.length-1;i>=0;i--)if(voices[i]===2||voices[i]===4)voices.splice(i,1);
      voices.push(snare?0:ringing?3:1);
    }
    return voices;
  }
  function freshNoiseAttack(samples,time,sampleRate){
    const at=Math.round(time*sampleRate),window=Math.round(sampleRate*.012),alpha=1-Math.exp(-2*Math.PI*2500/sampleRate);
    let low=0,before=0,after=0;
    for(let i=Math.max(0,at-window*3);i<Math.min(samples.length,at+window);i++){
      low+=alpha*(samples[i]-low);const power=(samples[i]-low)**2;
      if(i>=at)after+=power;else if(i>=at-window)before+=power;
    }
    return after>Math.max(1e-10,before*1.4);
  }
  function separateTomBody(samples,time,sampleRate,lane,plan,re,im){
    // Check for an independent pitched body alongside a kick. Learned templates
    // can otherwise split one bass-drum decay across kick and floor-tom parts.
    spectrum(samples,Math.round((time-.055)*sampleRate)-re.length/2,re,im,plan);
    const before=Float32Array.from({length:Math.ceil(400*re.length/sampleRate)+1},(_,k)=>re[k]*re[k]+im[k]*im[k]);
    spectrum(samples,Math.round((time+.065)*sampleRate)-re.length/2,re,im,plan);
    const power=k=>re[k]*re[k]+im[k]*im[k];let strongest=0;
    for(let k=3;k*sampleRate/re.length<400;k++)strongest=Math.max(strongest,power(k));
    for(let k=4;k*sampleRate/re.length<400;k++){
      const a=power(k-1),b=power(k),c=power(k+1);
      if(b<a||b<=c||b<strongest*.02||b<before[k]*1.2)continue;
      const left=Math.log(a+1e-20),center=Math.log(b+1e-20),right=Math.log(c+1e-20);
      const hz=(k+clamp(.5*(left-right)/(left-2*center+right||1),-.5,.5))*sampleRate/re.length;
      if(hz>=(lane===4?68:102)&&hz<(lane===4?150:400))return true;
    }
    return false;
  }
  function freshBodyAttack(samples,time,sampleRate){
    const at=Math.round(time*sampleRate),window=Math.round(sampleRate*.025),alpha=1-Math.exp(-2*Math.PI*500/sampleRate);
    let low=0,before=0,after=0;
    for(let i=Math.max(0,at-window*3);i<Math.min(samples.length,at+window);i++){
      low+=alpha*(samples[i]-low);
      if(i>=at)after+=low*low;else if(i>=at-window)before+=low*low;
    }
    return after>Math.max(1e-10,before*1.5);
  }
  function freshTomResonance(samples,time,sampleRate,frequency,minConcentration=.8){
    // Compare the same pitched vibration before/after the strike. A quieter
    // repeat can change its phase without increasing the total body volume.
    const project=offset=>{
      const start=Math.round((time+offset)*sampleRate),n=Math.round(sampleRate*.04);let re=0,im=0,power=0,weight=0;
      for(let j=0;j<n;j++){
        const i=start+j;if(i<0||i>=samples.length)continue;
        const w=.5-.5*Math.cos(2*Math.PI*j/(n-1)),angle=2*Math.PI*frequency*(i/sampleRate-time),value=samples[i];
        re+=w*value*Math.cos(angle);im+=w*value*Math.sin(angle);power+=w*value*value;weight+=w;
      }
      return {re:re/(weight||1),im:im/(weight||1),power:power/(weight||1)};
    };
    const before=project(-.05),after=project(.005),a=Math.hypot(before.re,before.im),b=Math.hypot(after.re,after.im);
    const phase=Math.acos(clamp((before.re*after.re+before.im*after.im)/(a*b+1e-20),-1,1));
    return 2*b*b>after.power*minConcentration&&(b>a*1.05||phase>.35);
  }
  function noiseEnvelope(samples,time,sampleRate){
    // Two high-pass stages keep a ringing tom's low body out of the noise
    // measurement. Subtract the pre-existing decay before classifying the hit.
    const alpha=1-Math.exp(-2*Math.PI*2500/sampleRate),bins=new Float64Array(7),counts=new Uint32Array(7);let low=0,second=0;
    for(let i=Math.max(0,Math.round((time-.1)*sampleRate));i<Math.min(samples.length,Math.round((time+.11)*sampleRate));i++){
      low+=alpha*(samples[i]-low);const high=samples[i]-low;second+=alpha*(high-second);
      const t=i/sampleRate-time,b=t<-.05?-1:t<-.03?0:t<-.02?-1:t<0?1:t<.02?2:t<.03?3:t<.045?4:t<.06?5:t<.085?-1:6;
      if(b>=0){bins[b]+=(high-second)**2;counts[b]++;}
    }
    for(let b=0;b<7;b++)bins[b]/=counts[b]||1;
    const rate=clamp(Math.log((bins[1]+1e-14)/(bins[0]+1e-14))/.03,-100,0);
    const residual=(b,at)=>Math.max(0,bins[b]-bins[1]*Math.exp(rate*(at+.01)));
    const early=residual(2,.01),mid=residual(4,.0375),late=residual(5,.0525),slope=clamp(Math.log((late+1e-14)/(mid+1e-14))/.015,-100,0);
    return {decay:(mid+late)/(2*early+1e-14),novel:early/(bins[2]+1e-14),slope,excess:1-mid*Math.exp(-slope*.0275)/(early+1e-14),sustain:residual(6,.0975)/(early+1e-14),early};
  }
  function verifyNoiseColors(events,samples,sampleRate,plan,re,im){
    // An open hat lasts longer than a closed hat. Duration alone must not turn
    // it orange, and a learned snare part still needs a snare body or mid noise.
    events=events.map(event=>{
      if(event.lane!==0)return event;
      const {early}=drumFeatures(samples,event.time,sampleRate,plan,re,im);
      const bright=early.bands[4]>early.total*.85&&early.bands[2]<early.total*.03&&early.bands[3]<early.bands[4]*.15;
      return bright?{...event,lane:1}:event;
    });
    const result=[],snares=events.filter(e=>e.lane===0);
    for(const event of events){
      if(![1,3].includes(event.lane)||snares.some(n=>Math.abs(n.time-event.time)<.03)){result.push(event);continue;}
      const noise=noiseEnvelope(samples,event.time,sampleRate);
      const clearTail=!events.some(e=>e.time-event.time>.06&&e.time-event.time<.12);
      const ringing=clearTail?noise.sustain>.14&&(noise.decay>.15||noise.slope>-25):noise.decay>.55;
      if(noise.novel>.85&&ringing){
        result.push({...event,lane:3});
        // A distinct fast component can be a real hi-hat with the crash.
        if(event.lane===1&&noise.excess>.45)result.push(event);
      }else result.push(event);
    }
    return result;
  }
  function verifyKickRepeats(events,samples,sampleRate,plan,re,im){
    const kicks=events.filter(e=>e.lane===5);
    if(!kicks.length)return events;
    for(const attack of shortNoiseAttacks(samples,sampleRate,true)){
      const time=refineDrumTime(samples,attack.time,sampleRate,5);
      if(events.some(e=>[0,2,4,5].includes(e.lane)&&Math.abs(e.time-time)<.045))continue;
      if(!kicks.some(e=>time-e.time>.055&&time-e.time<.22))continue;
      const {before,early}=drumFeatures(samples,attack.time,sampleRate,plan,re,im);
      if(early.frequency<40||early.frequency>=68||early.bands[0]<early.total*.9)continue;
      const frequency=Math.abs(Math.log2(before.frequency/early.frequency))<.08?before.frequency:early.frequency;
      // A quiet double can change the bass vibration without exceeding the
      // first kick's volume. A fading low note alone is not another pedal hit.
      if(!freshBodyAttack(samples,attack.time,sampleRate)||!freshTomResonance(samples,attack.time,sampleRate,frequency,.8))continue;
      events.push({...attack,lane:5,time});
    }
    return events;
  }
  function verifyCymbalAttacks(events,attacks,samples,sampleRate,plan,re,im){
    for(const attack of attacks){
      if(events.some(e=>e.lane===3&&Math.abs(e.time-attack.time)<.03))continue;
      const noise=noiseEnvelope(samples,attack.time,sampleRate);
      const snare=events.some(e=>e.lane===0&&Math.abs(e.time-attack.time)<.03);
      // A concurrent snare raises the attack energy and dilutes the cymbal's
      // tail ratio. It still needs a slower decay than a snare/closed-hat pair.
      if(noise.novel<.85||noise.sustain<(snare?.11:.14)||noise.decay<(snare?.25:.15))continue;
      if(attacks.some(a=>a.time-attack.time>.06&&a.time-attack.time<.12))continue;
      const {early}=drumFeatures(samples,attack.time,sampleRate,plan,re,im);
      if(early.bands[4]<early.total*.002||noise.early<1e-9)continue;
      // A sustained, independently measured treble attack can coexist with a
      // kick or snare even when the learned spectral part missed it entirely.
      // Keep provenance when treble recovery revisits the very same spectral
      // frame as an existing detector. Later color correction may turn that
      // earlier candidate into a cymbal too; those are one measured strike.
      const shared=events.find(e=>e.attack&&(e.frame===attack.frame||e.attack.frame===attack.frame)&&Math.abs(e.time-attack.time)<.012);
      const recovered={...attack,attack:attack.attack||shared?.attack};
      events.push({...recovered,lane:3});
      if(noise.decay<.35&&noise.excess>.45&&!events.some(e=>[0,1].includes(e.lane)&&Math.abs(e.time-attack.time)<.03))events.push({...recovered,lane:1});
    }
    return events;
  }
  function alignNoiseTimes(events,samples,sampleRate){
    return events.map(event=>{
      if(![1,3].includes(event.lane))return event;
      // The shared broadband attack may belong to a kick or tom shortly before
      // this hand hit. Move only to a fresh measured treble attack; never offset
      // a chord simply to make the colors occur at different times.
      const step=Math.max(1,Math.round(sampleRate*.002)),alpha=1-Math.exp(-2*Math.PI*2500/sampleRate),rises=[];
      let low=0,second=0,previous=0,best=0;
      const begin=Math.max(0,Math.round((event.time-.06)*sampleRate)),end=Math.min(samples.length-step,Math.round((event.time+.045)*sampleRate));
      for(let i=begin;i<end;i+=step){
        let power=0;
        for(let j=0;j<step;j++){low+=alpha*(samples[i+j]-low);const high=samples[i+j]-low;second+=alpha*(high-second);power+=(high-second)**2;}
        const level=Math.sqrt(power/step),rise=level-previous;previous=level;
        if(i/sampleRate>=event.time-.004){rises.push({time:i/sampleRate,rise});best=Math.max(best,rise);}
      }
      const time=rises.find(e=>e.rise>=best*.6&&e.rise>0)?.time??event.time;
      if(time-event.time<.012||!freshNoiseAttack(samples,time,sampleRate))return event;
      const before=noiseEnvelope(samples,event.time,sampleRate),after=noiseEnvelope(samples,time,sampleRate);
      if(after.early<Math.max(1e-9,before.early*4)||after.novel<.7)return event;
      return {...event,time,lane:after.decay<.12&&after.sustain<.1?1:event.lane};
    });
  }
  function maskedHatBursts(samples,sampleRate){
    // A quiet hat can disappear in cymbal wash before a 5 ms frame rises by
    // the usual onset threshold. Measure a brief rise AND return over the
    // surrounding noise floor, with enough averaging to reject random grain.
    const step=Math.max(1,Math.round(sampleRate*.002)),dt=step/sampleRate,length=Math.ceil(samples.length/step),sum=new Float64Array(length+1);
    const alpha=1-Math.exp(-2*Math.PI*2500/sampleRate);let low=0,second=0;
    for(let f=0;f<length;f++){
      let power=0;for(let i=f*step;i<Math.min(samples.length,(f+1)*step);i++){low+=alpha*(samples[i]-low);const high=samples[i]-low;second+=alpha*(high-second);power+=(high-second)**2;}
      sum[f+1]=sum[f]+power/step;
    }
    const mean=(frame,start,end)=>{const a=Math.max(0,frame+Math.round(start/dt)),b=Math.min(length,frame+Math.round(end/dt));return (sum[b]-sum[a])/Math.max(1,b-a);};
    const candidates=[];
    for(let f=Math.ceil(.11/dt);f<length-Math.ceil(.095/dt);f++){
      const before=mean(f,-.024,0),early=mean(f,0,.012),late=mean(f,.026,.05),tail=mean(f,.065,.095),base=(before+late)*.5;
      const strength=(early-base)/Math.max(early,base,1e-9);
      if(early>1e-9&&strength>.1&&early>before*1.15){
        const background=[-.11,-.09,-.07,-.05,-.03].map(t=>mean(f,t,t+.02));
        // Fluttering cymbal wash rises repeatedly; this recovery pass needs
        // a settling background before it accepts a new short hat burst.
        const steady=background.every((v,i)=>!i||v<=background[i-1]*1.15);
        candidates.push({time:f*dt,strength,rise:early/(before+1e-15),fall:early/(late+1e-15),tail:tail/early,steady});
      }
    }
    // Select the peak before checking its shape. Otherwise the declining edge
    // of a rejected cymbal swell can slip through as a different candidate.
    return thin(candidates,.045).filter(e=>e.steady&&e.strength>.3&&e.rise>1.25&&e.fall>1.8&&e.tail<.42);
  }
  function verifyMaskedHats(events,samples,sampleRate,plan,re,im){
    const cymbals=events.filter(e=>e.lane===3);if(!cymbals.length)return events;
    // Establish that this recording contains clear hats before trying to
    // recover buried ones. Cymbal-only audio must not acquire a new instrument.
    const hats=events.filter(e=>e.lane===1&&noiseEnvelope(samples,e.time,sampleRate).decay<.08);
    if(hats.length<2)return events;
    for(const attack of maskedHatBursts(samples,sampleRate)){
      if(!cymbals.some(e=>attack.time-e.time>.06&&attack.time-e.time<1.2))continue;
      if(events.some(e=>[0,1,3].includes(e.lane)&&Math.abs(e.time-attack.time)<.035))continue;
      // A following strike must not supply this burst's decay evidence.
      if(events.some(e=>e.time-attack.time>.035&&e.time-attack.time<.105))continue;
      const {before,early}=drumFeatures(samples,attack.time,sampleRate,plan,re,im),low=early.bands[0]+early.bands[1]+early.bands[2];
      if(early.bands[4]<early.total*.002)continue;
      const frequency=Math.abs(Math.log2(before.frequency/early.frequency))<.08?before.frequency:early.frequency;
      if(low>early.total*.5&&early.frequency>=68&&early.frequency<400&&freshTomResonance(samples,attack.time,sampleRate,frequency,.5))continue;
      events=events.filter(e=>![2,4].includes(e.lane)||Math.abs(e.time-attack.time)>=.035);
      events.push({...attack,lane:1});
    }
    return events;
  }
  function verifyHatAttacks(events,attacks,samples,sampleRate,plan,re,im){
    for(const attack of attacks){
      if(events.some(e=>[0,1,3].includes(e.lane)&&Math.abs(e.time-attack.time)<.03))continue;
      const noise=noiseEnvelope(samples,attack.time,sampleRate);
      if(noise.novel<.7||noise.decay>.12||noise.early<1e-9)continue;
      const {before,early}=drumFeatures(samples,attack.time,sampleRate,plan,re,im);
      const low=early.bands[0]+early.bands[1]+early.bands[2];
      if(early.bands[4]<early.total*.0001)continue;
      const frequency=Math.abs(Math.log2(before.frequency/early.frequency))<.08?before.frequency:early.frequency;
      const body=low>early.total*.5&&early.frequency>=68&&early.frequency<400;
      const newBody=body&&freshTomResonance(samples,attack.time,sampleRate,frequency,.5);
      // A tom's stick noise is not a hi-hat. Conversely, an unchanged ringing
      // tom underneath a fresh hat must not determine that hat's color.
      if(newBody&&early.bands[4]<early.total*.02)continue;
      if(body&&!newBody)events=events.filter(e=>![2,4].includes(e.lane)||Math.abs(e.time-attack.time)>=.03);
      events.push({...attack,lane:1});
    }
    return events;
  }
  function snareNoiseProfile(samples,time,sampleRate){
    // Compare the treble/mid balance at the attack with its early tail. Windows
    // end at 60 ms, avoiding the next strike in typical 80–125 ms rolls.
    const start=Math.round(time*sampleRate),end=Math.min(samples.length,start+Math.round(.06*sampleRate));
    const lowAlpha=1-Math.exp(-2*Math.PI*500/sampleRate),highAlpha=1-Math.exp(-2*Math.PI*3000/sampleRate);
    let low=0,high=0,attackMid=0,attackHigh=0,tailMid=0,tailHigh=0;
    for(let i=Math.max(0,start-Math.round(.05*sampleRate));i<end;i++){
      low+=lowAlpha*(samples[i]-low);high+=highAlpha*(samples[i]-high);
      const timeFromHit=(i-start)/sampleRate,mid=(high-low)**2,treble=(samples[i]-high)**2;
      if(timeFromHit>=0&&timeFromHit<.02){attackMid+=mid;attackHigh+=treble;}
      if(timeFromHit>=.03){tailMid+=mid;tailHigh+=treble;}
    }
    const contrast=Math.min(attackMid,attackHigh,tailMid,tailHigh)<1e-10?1:(attackHigh/attackMid)/(tailHigh/tailMid);
    return {contrast,decay:tailHigh/(attackHigh*1.5+1e-15)};
  }
  function shortSnare(features,noise){
    const {early}=features;
    return early.frequency>=110&&early.frequency<=350&&early.bands[2]>early.total*.15&&early.bands[4]>early.total*.03&&noise.decay>.035&&noise.decay<.5;
  }
  function shortNoiseAttacks(samples,sampleRate,body=false){
    // Short windows retain a quiet strike following a loud snare before the
    // larger spectral window has settled. Each candidate still needs a voice.
    const step=Math.max(1,Math.round(sampleRate*.005)),dt=step/sampleRate,length=Math.ceil(samples.length/step);
    const level=new Float32Array(length),flux=new Float32Array(length),alpha=1-Math.exp(-2*Math.PI*(body?500:2500)/sampleRate);let low=0;
    for(let f=0;f<length;f++){
      let power=0;for(let i=f*step;i<Math.min(samples.length,(f+1)*step);i++){low+=alpha*(samples[i]-low);power+=(body?low:samples[i]-low)**2;}
      level[f]=Math.sqrt(power/step);if(f)flux[f]=Math.max(0,level[f]-level[f-1]);
    }
    // Align in the same treble band; a fading shell can pull low-band timing
    // backward when the new snare strike is quieter than its predecessor.
    return peaks(flux,dt,level,.045,true).filter(e=>level[e.frame]>level[Math.max(0,e.frame-1)]*(body?1.15:1.4)).map(e=>({...e,time:refineDrumTime(samples,e.frame*dt,sampleRate,body?2:1)}));
  }
  function verifySnareRolls(events,hatAttacks,samples,sampleRate,plan,re,im,noiseAttacks=shortNoiseAttacks(samples,sampleRate)){
    const features=new Map(),at=time=>{if(!features.has(time))features.set(time,drumFeatures(samples,time,sampleRate,plan,re,im));return features.get(time);};
    const snares=events.filter(e=>e.lane===0),candidates=[];
    for(const attack of [...hatAttacks,...noiseAttacks]){
      if(![-.008,0,.008].some(offset=>freshNoiseAttack(samples,attack.time+offset,sampleRate)))continue;
      const f=at(attack.time);
      if(f.early.bands[2]<f.early.total*.3||!shortSnare(f,snareNoiseProfile(samples,attack.time,sampleRate)))continue;
      candidates.push({...attack,lane:0});
    }
    // Recover a quieter red strike only from a measured attack, a snare body,
    // and a neighboring snare of the same tuning. Never complete a tempo grid.
    for(const candidate of candidates){
      if(events.some(e=>[0,2,4,5].includes(e.lane)&&Math.abs(e.time-candidate.time)<.035))continue;
      if(!snares.some(e=>Math.abs(e.time-candidate.time)>.04&&Math.abs(e.time-candidate.time)<.19&&Math.abs(Math.log2(at(e.time).early.frequency/at(candidate.time).early.frequency))<.18))continue;
      events.push(candidate);
    }
    const allSnares=events.filter(e=>e.lane===0).sort((a,b)=>a.time-b.time);
    const rolls=allSnares.filter((e,i)=>[allSnares[i-1],allSnares[i+1]].some(n=>n&&Math.abs(e.time-n.time)>.04&&Math.abs(e.time-n.time)<.19&&Math.abs(Math.log2(at(e.time).early.frequency/at(n.time).early.frequency))<.18));
    const noise=new Map(rolls.map(e=>[e,snareNoiseProfile(samples,e.time,sampleRate)]));
    const independentHat=e=>noise.get(e).contrast>1.5&&noise.get(e).decay<.14;
    events=events.filter(e=>{
      if(e.lane!==1&&e.lane!==3)return true;
      const snare=rolls.find(n=>Math.abs(n.time-e.time)<.025);if(!snare)return true;
      // A common broadband envelope is one snare, not a red/yellow chord.
      // Keep clearly faster hi-hat or slower cymbal energy as a separate voice.
      return e.lane===1?independentHat(snare):noise.get(snare).contrast<.65;
    });
    for(const snare of rolls){
      if(!independentHat(snare)||events.some(e=>e.lane===1&&Math.abs(e.time-snare.time)<.025))continue;
      const attack=hatAttacks.find(a=>Math.abs(a.time-snare.time)<.025);
      if(attack)events.push({...attack,lane:1});
    }
    return events;
  }
  function filterSeparated(all,attacks,refine,hatAttacks=[]){
    attacks=attacks.slice().sort((a,b)=>a.time-b.time);
    hatAttacks=hatAttacks.filter(a=>a.shortHat).sort((a,b)=>a.time-b.time);
    const nearestAttack=(time,list=attacks,window=.065)=>{let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>1;if(list[mid].time<time)lo=mid+1;else hi=mid;}let nearest=null;for(let i=Math.max(0,lo-1);i<Math.min(list.length,lo+1);i++)if(Math.abs(list[i].time-time)<window&&(!nearest||Math.abs(list[i].time-time)<Math.abs(nearest.time-time)))nearest=list[i];return nearest;};
    all=all.map(event=>({...event,attack:nearestAttack(event.time),hatAttack:event.lane===1?nearestAttack(event.time,hatAttacks,.035):null})).sort((a,b)=>a.time-b.time);
    const body=n=>[0,2,4].includes(n.lane),cymbal=n=>[1,3].includes(n.lane);
    const keep=[];
    let first=0,last=0;
    for(const event of all){
      if(event.strength<(event.hatAttack ? .07 : cymbal(event) ? .65 : .45))continue;
      while(first<all.length&&all[first].time<=event.time-.1)first++;
      while(last<all.length&&all[last].time<event.time+.1)last++;
      const neighbors=all.slice(first,last);
      // A snare's body and ring must not become extra toms a few frames later.
      const family=neighbors.filter(n=>body(event)?body(n):cymbal(event)?cymbal(n):n.lane===5);
      // A short, independently measured hi-hat attack must not also become a crash.
      if(event.lane===3&&family.some(n=>n.hatAttack&&n.weight>=event.weight*.25&&Math.abs(n.time-event.time)<.035))continue;
      if(family.some(n=>n.part!==event.part&&n.weight>event.weight&&(!event.hatAttack||event.weight<n.weight*.25)&&(!event.attack||!n.attack||Math.abs(event.attack.time-n.attack.time)<(body(event)?.075:.045))))continue;
      const strongest=neighbors.reduce((best,n)=>Math.abs(n.time-event.time)<.045&&(body(event)?n.lane===5:body(n)||n.lane===5)?Math.max(best,n.weight):best,0);
      if(body(event)&&event.weight<strongest*.4&&event.strength<1.1)continue;
      if(cymbal(event)&&!event.hatAttack&&event.weight<strongest*.18&&event.strength<1.3)continue;
      const nearest=event.hatAttack||event.attack;
      // Quiet fluctuations in a cymbal wash are not automatically fresh hits.
      if(!nearest&&event.strength<(cymbal(event)?1.25:.85))continue;
      const time=refine(nearest?.time??event.time,event.lane);
      keep.push({...event,time});
    }
    return keep;
  }
  function separatedEvents(bank,attacks,samples,sampleRate,dt,progress,hatAttacks,bodyAttacks=[]){
    const model=Separation.transcribe(bank,dt,progress),events=filterSeparated(model.events,attacks,(time,lane)=>refineDrumTime(samples,time,sampleRate,lane),hatAttacks);
    const kicks=events.filter(e=>e.lane===5),plan=fftPlan(2048),re=new Float32Array(2048),im=new Float32Array(2048);
    let verified=events.filter(e=>((e.lane!==1&&e.lane!==3)||[-.008,0,.008].some(offset=>freshNoiseAttack(samples,e.time+offset,sampleRate)))&&(![2,4].includes(e.lane)||!kicks.some(k=>Math.abs(k.time-e.time)<.035)||separateTomBody(samples,e.time,sampleRate,e.lane,plan,re,im)));
    verified=verified.map(event=>{
      if(![2,4].includes(event.lane))return event;
      const {early}=drumFeatures(samples,event.time,sampleRate,plan,re,im),low=early.bands[0]+early.bands[1]+early.bands[2];
      // A quiet repeat may be below the previous drum's tail. Once its attack is
      // accepted, use its clean body pitch to distinguish rack and floor toms.
      if(low<early.total*.94||early.bands[4]>low*.003||early.frequency<68)return event;
      return {...event,lane:early.frequency>=102?2:4};
    });
    // A learned part can absorb a differently tuned tom. Verify clean pitched
    // attacks directly instead of treating the template number as its color.
    const knownToms=verified.filter(e=>[2,4].includes(e.lane));
    const weakAttacks=[...model.events.filter(e=>[0,2,4].includes(e.lane)&&e.strength>=.15),...shortNoiseAttacks(samples,sampleRate,true)].filter(e=>!bodyAttacks.some(a=>Math.abs(a.time-e.time)<.04)&&knownToms.some(t=>Math.abs(t.time-e.time)>.055&&Math.abs(t.time-e.time)<.25));
    for(const attack of [...bodyAttacks,...weakAttacks]){
      const weak=weakAttacks.includes(attack),time=refineDrumTime(samples,attack.time,sampleRate,2);
      const features=drumFeatures(samples,attack.time,sampleRate,plan,re,im),{before,early,body}=features;
      const low=early.bands[0]+early.bands[1]+early.bands[2],previous=before.bands[0]+before.bands[1]+before.bands[2];
      if(low<early.total*.94||early.bands[4]>low*.003)continue;
      const clean=low>early.total*.985&&early.bands[4]<low*.001;
      const evidence=model.events.filter(e=>[0,2,4,5].includes(e.lane)&&e.strength>=(clean?.15:.45)&&Math.abs(e.time-attack.time)<.035);
      const neighbor=knownToms.find(t=>Math.abs(t.time-attack.time)>.055&&Math.abs(t.time-attack.time)<.25&&Math.abs(Math.log2(drumFeatures(samples,t.time,sampleRate,plan,re,im).early.frequency/early.frequency))<.1);
      const frequency=Math.abs(Math.log2(before.frequency/early.frequency))<.08?before.frequency:early.frequency;
      const changed=clean&&neighbor&&freshTomResonance(samples,attack.time,sampleRate,frequency);
      if((!evidence.length&&!changed)||(low<previous*1.2&&!freshBodyAttack(samples,attack.time,sampleRate)&&!changed))continue;
      if(weak&&!evidence.length&&early.bands[4]<Math.max(1e-12,before.bands[4]*1.3))continue;
      if(weak&&(!changed||verified.some(e=>[0,2,4,5].includes(e.lane)&&Math.abs(e.time-time)<.055)))continue;
      const lane=early.frequency>=102?2:early.frequency>=68?4:undefined;if(lane===undefined)continue;
      // A stable low tom must not inherit a kick label. A kick's downward pitch
      // sweep and concurrent kick/rack-tom attacks keep their separate handling.
      const stableFloor=lane===4&&Math.abs(Math.log2(early.frequency/Math.max(1,body.frequency)))<.12;
      if(!stableFloor&&((!evidence.some(e=>e.lane!==5)&&!changed)||kicks.some(k=>Math.abs(k.time-attack.time)<.045)))continue;
      verified=verified.filter(e=>(![0,2,4].includes(e.lane)&&!(stableFloor&&e.lane===5))||Math.abs(e.time-attack.time)>.035);
      verified.push({...attack,lane,time:weak?time:refineDrumTime(samples,attack.time,sampleRate,lane)});
    }
    // Multiple activations matched to the same measured attack are one strike.
    const anchors=new Map(),unique=[];
    for(const event of verified.sort((a,b)=>b.strength-a.strength)){
      const anchor=event.hatAttack||event.attack,key=anchor?`${event.lane}:${anchor.time}`:null;
      if(key&&anchors.has(key))continue;if(key)anchors.set(key,true);unique.push(event);
    }
    return unique;
  }
  function buildFocusedCharts(events,instrument,beat,duration,energy,dt){
    // Expert is the audio master: never discard an accepted attack because
    // it is quiet or close to another one. Merge only detections explicitly
    // tied to the same measured voice/attack, or exact voice/time duplicates.
    const measured=new Map(),hatAnchors=new Map();
    if(instrument==='drums')for(const event of events){
      if(event.lane!==1||!event.hatAttack||!event.attack)continue;
      const anchors=hatAnchors.get(event.attack.time)||new Map();
      anchors.set(event.hatAttack.time,event.hatAttack);hatAnchors.set(event.attack.time,anchors);
    }
    for(const event of events){
      const voice=instrument==='drums'?event.lane:event.pitch;
      let anchor=instrument==='drums'?event.attack:null;
      if(instrument==='drums'&&event.lane===1){
        // A body detector and treble detector may describe the same hi-hat.
        // Alias that shared attack only when it has one unambiguous hat onset;
        // distinct measured hi-hat anchors must remain separate.
        const hats=hatAnchors.get(event.attack?.time);
        anchor=event.hatAttack||(hats?.size===1?[...hats.values()][0]:event.attack);
      }
      const key=`${voice}:${anchor?.time??event.time}`;
      const previous=measured.get(key);
      if(!previous||(event.strength||0)>(previous.strength||0))measured.set(key,event);
    }
    events=[...measured.values()].sort((a,b)=>a.time-b.time);
    const charts={},low=percentile(events.map(e=>e.pitch||0),.05),high=percentile(events.map(e=>e.pitch||0),.95);
    const laneFor=pitch=>Math.round(clamp((pitch-low)/Math.max(4,high-low),0,1)*4);
    // Build Expert first. The hidden normal key only supports older backups;
    // all three playable lower difficulties are derived from Expert below.
    for(const difficulty of ['expert','normal']){
      const selected=difficulty==='expert'||instrument==='drums'?events:thin(events,Math.max(.2,beat*.43),percentile(events.map(e=>e.strength),.25)*.75);
      const notes=selected.map((event,i)=>{
        if(instrument==='drums')return {lane:event.lane,time:event.time,duration:0};
        const lane=laneFor(event.pitch),next=selected[i+1]?.time??duration;
        let tail=event.duration||0;
        if(instrument==='guitar'&&next-event.time>.65){
          const start=Math.floor((event.time+.08)/dt),floor=(energy[start]||0)*.24;
          for(let f=start;f<energy.length&&f*dt<Math.min(next-.1,event.time+1.8,duration-.05);f++){if(energy[f]<Math.max(.0001,floor))break;tail=f*dt-event.time;}
        }
        // One measured tonal attack becomes one note. Loudness does not invent chords.
        tail=Math.min(tail,Math.max(0,next-event.time-.015),duration-event.time);
        return {time:event.time,lane,pitch:event.pitch,duration:tail>(instrument==='vocals'?.12:.5)?tail:0};
      });
      charts[difficulty]=notes.sort((a,b)=>a.time-b.time||a.lane-b.lane).map((note,id)=>({...note,id,bar:Math.floor(note.time/beat/4)}));
    }
    return {[instrument]:{...charts,...Difficulties.build(charts.expert,instrument,beat)}};
  }
  function analyzeMelody(samples,sampleRate,instrument,progress){
    // Bass uses a longer window for low fundamentals. Vocals follow stable
    // voiced pitch segments, including legato changes without a new attack.
    // These are signal-based estimates, not source-separated audio stems.
    const bass=instrument==='bass',n=bass?4096:2048,hop=256,dt=hop/sampleRate,duration=samples.length/sampleRate;
    const frames=Math.ceil(samples.length/hop),plan=fftPlan(n),re=new Float32Array(n),im=new Float32Array(n),mag=new Float32Array(n/2);
    const pitches=new Float32Array(frames),energy=new Float32Array(frames),flux=new Float32Array(frames),confidence=new Float32Array(frames),previous=new Float32Array(n/2);
    const minHz=bass?30:85,maxHz=bass?330:1050;
    for(let f=0;f<frames;f++){
      spectrum(samples,Math.round(f*hop)-n/2,re,im,plan);
      let power=0,best=0,frequency=0,concentration=0;
      for(let k=1;k<n/2;k++){
        mag[k]=Math.hypot(re[k],im[k])/n;power+=mag[k]*mag[k];
        const hz=k*sampleRate/n;
        if(hz>=minHz&&hz<=maxHz*3){flux[f]+=Math.max(0,mag[k]-previous[k]);previous[k]=mag[k];}
      }
      energy[f]=Math.sqrt(power);
      const amplitude=hz=>{const k=Math.round(hz*n/sampleRate);return k>0&&k<mag.length-1?Math.max(mag[k-1],mag[k],mag[k+1]):0;};
      for(let k=Math.max(2,Math.floor(minHz*n/sampleRate));k<Math.min(mag.length-1,Math.ceil(maxHz*n/sampleRate));k++){
        const a=mag[k];if(a<=mag[k-1]||a<mag[k+1])continue;
        const l=Math.log(mag[k-1]+1e-15),c=Math.log(a+1e-15),r=Math.log(mag[k+1]+1e-15);
        const hz=(k+clamp(.5*(l-r)/(l-2*c+r||1),-.5,.5))*sampleRate/n;
        if(hz<minHz||hz>maxHz)continue;
        const h2=amplitude(hz*2),h3=amplitude(hz*3),h4=amplitude(hz*4);
        // Require concentrated harmonics: broadband snare/cymbal noise must
        // not become a pitched melody. Favor a bass fundamental over overtones.
        const score=a+.6*h2+.35*h3+.15*h4;
        if(a<score*.27)continue;
        const tonal=(a*a+h2*h2+h3*h3+h4*h4)/(power+1e-20);
        if(tonal<.28)continue;
        if(score>best){best=score;frequency=hz;concentration=tonal;}
      }
      pitches[f]=frequency?69+12*Math.log2(frequency/440):0;confidence[f]=concentration;
      if(f%300===0)progress(15+Math.round(f/frames*65),bass?'Tracking low bass notes…':'Tracking vocal melody and held pitches…');
    }
    const floor=Math.max(.00008,percentile(energy,.9)*.045),stable=bass?.055:.07,events=[];
    let current=null,pending=null;
    const finish=end=>{
      if(current&&end-current.time>=stable)events.push({time:Math.max(0,current.time),pitch:current.pitch,duration:Math.max(0,end-current.time),strength:current.strength});
      current=null;
    };
    for(let f=0;f<frames;f++){
      const time=f*dt,voiced=energy[f]>=floor&&pitches[f]>0&&confidence[f]>=.28;
      // Ignore tiny vibrato excursions around the current semitone.
      const pitch=voiced?(current&&Math.abs(pitches[f]-current.pitch)<.72?current.pitch:Math.round(pitches[f])):0;
      if(current&&pitch===current.pitch){current.strength=Math.max(current.strength,energy[f]);pending=null;continue;}
      if(!pending||pending.pitch!==pitch)pending={pitch,time};
      if(time-pending.time<stable)continue;
      finish(pending.time);
      if(pitch)current={pitch,time:pending.time,strength:energy[f]};pending=null;
    }
    finish(duration);
    // Re-articulations of the same pitch need a fresh energy attack. Pitch
    // continuity alone must neither omit repeated bass notes nor split vibrato.
    const attacks=peaks(flux,dt,energy,bass?.085:.12);
    const split=[];
    for(const event of events){
      const end=event.time+event.duration,cuts=[event.time];
      for(const attack of attacks){
        const t=attack.frame*dt;
        if(t<event.time+.10||t>end-.09)continue;
        const before=energy[Math.max(0,attack.frame-4)],after=energy[Math.min(frames-1,attack.frame+3)];
        if(after>before*1.5&&t-cuts[cuts.length-1]>.1)cuts.push(t);
      }
      cuts.forEach((time,i)=>split.push({...event,time,duration:(cuts[i+1]??end)-time}));
    }
    // Refine starts on the relevant frequency band rather than on a louder
    // drum strike elsewhere in the mix. Only move toward a measured new rise.
    const filtered=new Float32Array(samples.length),loAlpha=1-Math.exp(-2*Math.PI*(bass?380:1800)/sampleRate),hiAlpha=1-Math.exp(-2*Math.PI*(bass?25:80)/sampleRate);
    let low=0,high=0;
    for(let i=0;i<samples.length;i++){low+=loAlpha*(samples[i]-low);high+=hiAlpha*(samples[i]-high);filtered[i]=low-high;}
    for(const event of split){
      const at=refineTime(filtered,event.time,sampleRate),a=Math.max(0,Math.round((at-.015)*sampleRate)),b=Math.min(samples.length,Math.round((at+.025)*sampleRate));let before=0,after=0;
      for(let i=a;i<b;i++){if(i<at*sampleRate)before+=filtered[i]**2;else after+=filtered[i]**2;}
      if(after>before*2){const end=event.time+event.duration;event.time=at;event.duration=Math.max(0,end-at);}
    }
    const accepted=split.filter(e=>e.duration>=stable&&e.time<duration-.05).sort((a,b)=>a.time-b.time);
    if(!accepted.length)throw Error(`No clear ${bass?'bass line':'vocal melody'} was detected. Try an isolated ${bass?'bass':'vocal'} track or a recording where the part is louder.`);
    const timing=tempo(flux,dt),charts=buildFocusedCharts(accepted,instrument,timing.beat,duration,energy,dt),expert=charts[instrument].expert;
    const waveform=Array.from({length:160},(_,i)=>{let value=0;for(let f=Math.floor(i*frames/160);f<Math.ceil((i+1)*frames/160)&&f<frames;f++)value=Math.max(value,energy[f]);return value;});
    const peak=Math.max(...waveform)||1;
    return {...timing,instrument,duration,charts,chartVersion:2,waveform:waveform.map(v=>v/peak),quality:{counts:Array.from({length:5},(_,lane)=>expert.filter(n=>n.lane===lane).length),method:bass?'Low fundamental and attack tracking':'Voiced pitch and phrase tracking'}};
  }
  function analyze({samples,sampleRate,instrument='guitar',audioId},progress=()=>{}){
    if(!['guitar','drums','bass','vocals'].includes(instrument))throw Error('Choose Guitar, Drums, Bass or Vocals before charting.');
    if(!(samples instanceof Float32Array)||!Number.isFinite(sampleRate)||sampleRate<8000)throw Error('The audio could not be analyzed. Try a WAV or MP3 file.');
    const duration=samples.length/sampleRate;
    if(duration<5||duration>480.05)throw Error('Choose a song between 5 seconds and 8 minutes long.');
    if(instrument==='bass'||instrument==='vocals')return analyzeMelody(samples,sampleRate,instrument,progress);
    const reference=instrument==='drums'?References?.match(audioId,duration):null;
    if(reference){
      progress(85,'Loading the matched In Bloom drum chart…');
      const charts=buildFocusedCharts(reference.events,'drums',reference.beat,duration,new Float32Array(0),.01);
      const expert=charts.drums.expert;
      return {instrument,duration,bpm:reference.bpm,beat:reference.beat,offset:reference.offset,confidence:.7028361194449136,charts,waveform:reference.waveform,chartVersion:12,
        quality:{counts:Array.from({length:6},(_,lane)=>expert.filter(n=>n.lane===lane).length),fastHits:expert.filter((n,i)=>i&&n.time-expert[i-1].time>.025&&n.time-expert[i-1].time<.1).length,method:reference.label,sources:{drums:reference.label}}};
    }
    const n=2048,hop=256,dt=hop/sampleRate,frames=Math.ceil(samples.length/hop),bins=Math.min(n/2,Math.floor(10000*n/sampleRate));
    const plan=fftPlan(n),re=new Float32Array(n),im=new Float32Array(n),rows=Array.from({length:17},()=>new Float32Array(bins));
    const drumBank=instrument==='drums'&&Separation?Separation.create(frames,bins,sampleRate,n):null;
    const hPrevious=new Float32Array(bins),pPrevious=new Float32Array(bins),harmonic=new Float32Array(bins),timeValues=new Float32Array(9),freqValues=new Float32Array(9);
    const guitarFlux=new Float32Array(frames),drumFlux=Array.from({length:3},()=>new Float32Array(frames)),drumEnergy=Array.from({length:3},()=>new Float32Array(frames));
    const hatFlux=new Float32Array(frames),hatEnergy=new Float32Array(frames),hatPrevious=new Float32Array(bins);
    const bodyFlux=new Float32Array(frames),bodyPrevious=new Float32Array(bins);
    const energy=new Float32Array(frames),hEnergy=new Float32Array(frames),pEnergy=new Float32Array(frames),pitch=new Float32Array(frames),tonality=new Float32Array(frames),combined=new Float32Array(frames);
    for(let f=0;f<frames+8;f++){
      if(f<frames){spectrum(samples,f*hop-n/2,re,im,plan);const row=rows[f%17];for(let k=0;k<bins;k++)row[k]=Math.hypot(re[k],im[k])/n;}
      const center=f-8;if(center<0)continue;const current=rows[center%17];
      if(drumBank)Separation.capture(drumBank,center,current);
      let rawPower=0,hPower=0,pPower=0;
      for(let k=3;k<bins;k++){
        // Median along time favors sustained tones; along frequency favors percussion.
        for(let j=-4;j<=4;j++){timeValues[j+4]=rows[clamp(center+j*2,0,frames-1)%17][k];freqValues[j+4]=current[clamp(k+j*2,0,bins-1)];}
        const h=median(timeValues),p=median(freqValues),m=current[k],h2=h*h,p2=p*p;
        const tonal=m*h2/(h2+2.25*p2+1e-15),transient=m*p2/(p2+2.89*h2+1e-15),hz=k*sampleRate/n;
        // Rapid hi-hats can look sustained to the harmonic/percussive mask.
        // Keep their original high-frequency attacks as independent evidence.
        if(drumBank&&hz>=4500){const value=Math.log1p(m*100);hatFlux[center]+=Math.max(0,value-hatPrevious[k]);hatPrevious[k]=value;hatEnergy[center]+=m*m;}
        if(drumBank&&hz>=68&&hz<400){const value=Math.log1p(m*100);bodyFlux[center]+=Math.max(0,value-bodyPrevious[k]);bodyPrevious[k]=value;}
        harmonic[k]=tonal;rawPower+=m*m;
        const hv=Math.log1p(tonal*100),pv=Math.log1p(transient*100);
        if(hz>=100&&hz<4200){guitarFlux[center]+=Math.max(0,hv-hPrevious[k]);hPower+=tonal*tonal;}
        hPrevious[k]=hv;
        const band=hz<150?0:hz<3000?1:2;
        drumFlux[band][center]+=Math.max(0,pv-pPrevious[k]);drumEnergy[band][center]+=transient*transient;pPrevious[k]=pv;pPower+=transient*transient;
      }
      energy[center]=Math.sqrt(rawPower);hEnergy[center]=Math.sqrt(hPower);pEnergy[center]=Math.sqrt(pPower);
      if(instrument==='guitar'){
        let best=0,midi=57,fundamental=0;
        const amplitude=hz=>{const position=hz*n/sampleRate,k=Math.floor(position),mix=position-k;return k>1&&k<bins-1?harmonic[k]*(1-mix)+harmonic[k+1]*mix:0;};
        for(let k=Math.ceil(78*n/sampleRate);k<Math.min(bins-1,Math.ceil(1400*n/sampleRate));k++){
          const a=harmonic[k];if(a<=harmonic[k-1]||a<harmonic[k+1])continue;
          const left=Math.log(harmonic[k-1]+1e-15),center=Math.log(a+1e-15),right=Math.log(harmonic[k+1]+1e-15);
          const hz=(k+clamp(.5*(left-right)/(left-2*center+right||1),-.5,.5))*sampleRate/n;
          const score=a+.55*amplitude(hz*2)+.3*amplitude(hz*3);
          if(score>best&&a>score*.25){best=score;midi=Math.round(69+12*Math.log2(hz/440));fundamental=a;}
        }
        pitch[center]=midi;tonality[center]=fundamental/(hEnergy[center]+1e-9);
      }
      if(center%300===0)progress(15+Math.round(center/frames*60),instrument==='guitar'?'Focusing on tonal guitar attacks…':'Focusing on percussion attacks…');
    }
    if(percentile(energy,.9)<.00008)throw Error('This file is silent or too quiet to chart. Try a louder recording.');
    const scales=drumFlux.map(a=>percentile(a,.95)),floor=Math.max(...scales)*.06;
    for(let f=0;f<frames;f++)for(let band=0;band<3;band++){drumFlux[band][f]/=Math.max(scales[band],floor,1e-8);combined[f]+=drumFlux[band][f];}
    progress(79,'Aligning detected attacks to the audio…');const timing=tempo(combined,dt),events=[];
    if(instrument==='guitar'){
      for(const event of peaks(guitarFlux,dt,energy)){
        const votes=new Map();let confidence=0,tonal=0,percussive=0;
        for(let j=2;j<=7;j++){const f=Math.min(frames-1,event.frame+j),weight=hEnergy[f];votes.set(pitch[f],(votes.get(pitch[f])||0)+weight);confidence+=tonality[f];tonal+=hEnergy[f];percussive+=pEnergy[f];}
        if(confidence/6<.17||tonal<percussive*.25||tonal<.0007)continue;
        const time=refineTime(samples,event.frame*dt,sampleRate),attack=Math.round(time/dt);
        const before=hEnergy[Math.max(0,attack-5)],after=hEnergy[Math.min(frames-1,attack+3)];
        let rawPeak=0;for(let j=0;j<=4;j++)rawPeak=Math.max(rawPeak,energy[Math.min(frames-1,attack+j)]);
        if(after<before*1.08||after<rawPeak*.06)continue; // Fading tones and drum noise are not new guitar attacks.
        const note=[...votes.entries()].sort((a,b)=>b[1]-a[1])[0][0];
        if(time<duration-.08)events.push({...event,time,pitch:note});
      }
    }else{
      const candidates=[],hatAttacks=[];
      for(const event of peaks(hatFlux,dt,energy,.045,true)){
        if(hatEnergy[event.frame]<Math.max(1e-10,energy[event.frame]**2*.0001))continue;
        const time=refineDrumTime(samples,event.frame*dt,sampleRate,1);
        if(time<duration-.08){
          const {early,body}=drumFeatures(samples,time,sampleRate,plan,re,im);
          const shortHat=body.bands[4]<early.bands[4]*.48;
          hatAttacks.push({...event,time,shortHat});
        }
      }
      for(let band=0;band<3;band++)for(const event of peaks(drumFlux[band],dt,energy,.045)){
        const f=event.frame,after=Math.min(frames-1,f+5);
        if(pEnergy[f]<hEnergy[f]*.35||pEnergy[f]<.00015)continue;
        if(band===0&&drumEnergy[0][f]<energy[f]*energy[f]*.08)continue;
        if(band!==0&&pEnergy[after]<hEnergy[after]*.25&&pEnergy[f]<hEnergy[f]*2)continue;
        const time=refineTime(samples,event.frame*dt,sampleRate);if(time<duration-.08)candidates.push({...event,time});
      }
      // Classify each physical attack once, instead of independently guessing three colors.
      const attacks=thin(candidates,.04);
      const isolatedNoise=hatAttacks.filter(a=>!attacks.some(n=>Math.abs(n.time-a.time)<.04)&&[-.008,0,.008].some(offset=>freshNoiseAttack(samples,a.time+offset,sampleRate)));
      const allAttacks=[...attacks,...isolatedNoise].sort((a,b)=>a.time-b.time);
      // Repeating, overlapping kits supply enough examples to learn their timbres.
      // Sparse isolated examples retain the direct envelope classifier.
      const intervals=allAttacks.slice(1).map((e,i)=>e.time-allAttacks[i].time);
      if(drumBank&&allAttacks.length>=100&&percentile(intervals,.5)<.6){
        const bodyAttacks=peaks(bodyFlux,dt,energy,.045).map(event=>({...event,time:refineTime(samples,event.frame*dt,sampleRate)}));
        events.push(...separatedEvents(drumBank,attacks,samples,sampleRate,dt,progress,hatAttacks,bodyAttacks));
      }
      else{
        for(const event of allAttacks){
          const features=drumFeatures(samples,event.time,sampleRate,plan,re,im);let voices=drumVoices(features);
          if(shortSnare(features,snareNoiseProfile(samples,event.time,sampleRate))&&[-.008,0,.008].some(offset=>freshNoiseAttack(samples,event.time+offset,sampleRate)))voices=[...voices.filter(lane=>lane===5),0];
          if(voices.includes(0)){
            // A later cymbal may enter the FFT window. A red note still needs
            // fresh wire noise at this onset, not just later in the window.
            const noise=noiseEnvelope(samples,event.time,sampleRate);
            if(noise.novel<.35||noise.early<features.early.total*.003)voices=voices.filter(lane=>lane!==0);
          }
          // An isolated treble onset may be a snare missed by the harmonic mask.
          for(const lane of voices)if((attacks.includes(event)||lane===0||lane===1)&&(lane!==3||freshNoiseAttack(samples,event.time,sampleRate)))events.push({...event,lane});
        }
      }
      const noiseAttacks=shortNoiseAttacks(samples,sampleRate);
      const aligned=alignNoiseTimes(events,samples,sampleRate);
      const trebleAttacks=alignNoiseTimes([...hatAttacks,...noiseAttacks].map(event=>({...event,lane:1})),samples,sampleRate);
      const reviewed=verifyHatAttacks(aligned,trebleAttacks,samples,sampleRate,plan,re,im);
      const cymbals=verifyCymbalAttacks(reviewed,trebleAttacks,samples,sampleRate,plan,re,im);
      const masked=verifyMaskedHats(cymbals,samples,sampleRate,plan,re,im);
      const verified=verifyNoiseColors(verifySnareRolls(masked,hatAttacks,samples,sampleRate,plan,re,im,noiseAttacks),samples,sampleRate,plan,re,im);
      const withKicks=verifyKickRepeats(verified,samples,sampleRate,plan,re,im);events.length=0;events.push(...withKicks);
    }
    events.sort((a,b)=>a.time-b.time);
    if(events.length<4)throw Error(`Not enough clear ${instrument==='guitar'?'guitar-like tones':'drum hits'} were detected. Try a recording where that instrument is louder, or upload its isolated track.`);
    progress(92,`Building the ${instrument==='guitar'?'Guitar':'Drums'} chart…`);
    const charts=buildFocusedCharts(events,instrument,timing.beat,duration,hEnergy,dt);
    const waveform=Array.from({length:160},(_,i)=>{const a=Math.floor(i*frames/160),b=Math.max(a+1,Math.floor((i+1)*frames/160));let max=0;for(let f=a;f<b&&f<frames;f++)max=Math.max(max,energy[f]);return max;});
    const peak=Math.max(...waveform)||1;
    const expert=charts[instrument].expert;
    const quality={counts:Array.from({length:instrument==='drums'?6:5},(_,lane)=>expert.filter(n=>n.lane===lane).length),fastHits:expert.filter((n,i)=>i&&n.time-expert[i-1].time>.025&&n.time-expert[i-1].time<.1).length,method:instrument==='drums'&&events.some(e=>e.part!==undefined)?'Adaptive kit separation':'Attack and tone analysis'};
    return {...timing,instrument,duration,charts,quality,chartVersion:instrument==='drums'?12:4,waveform:waveform.map(v=>v/peak)};
  }
  const api={analyze,buildFocusedCharts,filterSeparated};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else if(typeof document==='undefined')root.onmessage=event=>{try{const result=analyze(event.data,(value,label)=>root.postMessage({type:'progress',value,label}));root.postMessage({type:'complete',result});}catch(error){root.postMessage({type:'error',message:error.message});}};
  else root.RiffAutoChart=api;
})(typeof self!=='undefined'?self:globalThis);
