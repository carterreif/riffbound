/* Local, calibrated acoustic drum recognition. No chart or song is consulted. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RiffAudioDrumCore=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const SIZE=2048,HOP=256,BANDS=48,ROLES=['snare','hihat','tom','cymbal','floor','kick'];
 const LABELS=['Red snare','Yellow hi-hat','Blue tom','Orange cymbal','Green floor tom','Kick'];
 const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),norm=a=>Math.sqrt(dot(a,a));
 const unit=a=>{const n=norm(a);return Array.from(a,x=>x/Math.max(n,1e-12));};
 function validFeature(a){return Array.isArray(a)&&a.length===BANDS&&a.every(x=>Number.isFinite(x)&&x>=0&&x<=1e6)&&norm(a)>1e-8;}
 function template(samples){if(samples.length<3||!samples.every(validFeature))return null;const normalized=samples.map(unit),mean=unit(Array.from({length:BANDS},(_,i)=>normalized.reduce((n,a)=>n+a[i],0)/samples.length));return normalized.every(a=>dot(a,mean)>.72)?mean:null;}
 function conflicts(templates){const roles=ROLES.filter(r=>validFeature(templates[r])),pairs=[];for(let i=0;i<roles.length;i++)for(let j=i+1;j<roles.length;j++)if(dot(unit(templates[roles[i]]),unit(templates[roles[j]]))>.965)pairs.push([roles[i],roles[j]]);return pairs;}
 function recognize(feature,templates){
  if(!validFeature(feature))return {roles:[],confidence:0};const roles=ROLES.filter(r=>validFeature(templates[r]));if(roles.length<2)return {roles:[],confidence:0};
  const v=unit(feature),w=roles.map(r=>unit(templates[r])),scores=w.map(t=>dot(v,t)),order=scores.map((s,i)=>i).sort((a,b)=>scores[b]-scores[a]);
  const best=order[0],second=order[1],singleError=Math.sqrt(Math.max(0,1-scores[best]**2));
  // Sparse two-template fits permit clear simultaneous hits, while rejecting uncertain mixtures.
  let pair=null;for(let i=0;i<w.length;i++)for(let j=i+1;j<w.length;j++){
   const cross=dot(w[i],w[j]);if(cross>.94)continue;const den=1-cross*cross,a=(scores[i]-cross*scores[j])/den,b=(scores[j]-cross*scores[i])/den;
   if(a<.26||b<.26||Math.min(a,b)/Math.max(a,b)<.32)continue;
   const error=Math.sqrt(v.reduce((n,x,k)=>n+(x-a*w[i][k]-b*w[j][k])**2,0));
   if(error<.32&&singleError-error>.12&&(!pair||error<pair.error))pair={roles:[roles[i],roles[j]],error};
  }
  if(pair)return {roles:pair.roles,confidence:1-pair.error};
  if(scores[best]<.79||scores[best]-scores[second]<.035)return {roles:[],confidence:scores[best]||0};
  return {roles:[roles[best]],confidence:scores[best]};
 }
 const lane=(role,four=false)=>({snare:0,hihat:1,tom:2,cymbal:3,floor:four?3:4,kick:5}[role]);
 function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len<<=1){const angle=-2*Math.PI/len,cr=Math.cos(angle),ci=Math.sin(angle);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=wr*re[l]-wi*im[l],ti=wr*im[l]+wi*re[l];re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;const next=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=next;}}}
 }
 class StreamDetector{
  constructor(sampleRate,{threshold=.012}={}){this.rate=sampleRate;this.threshold=threshold;this.ring=new Float32Array(SIZE);this.re=new Float64Array(SIZE);this.im=new Float64Array(SIZE);this.prev=new Float64Array(BANDS);this.window=Float64Array.from({length:SIZE},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(SIZE-1)));this.map=Int16Array.from({length:SIZE/2},(_,i)=>{const hz=i*sampleRate/SIZE;return hz>=45&&hz<Math.min(12000,sampleRate/2)?Math.min(BANDS-1,Math.floor(Math.log(hz/45)/Math.log(12000/45)*BANDS)):-1;});this.position=0;this.samples=0;this.last=-1;this.lastMeter=-1;this.energy=0;this.pending=null;}
  push(channels,startTime,onFrame){const n=channels[0]?.length||0;for(let i=0;i<n;i++){let sample=0;for(const channel of channels)sample+=channel[i]||0;sample/=Math.max(1,channels.length);this.ring[this.position]=sample;this.position=(this.position+1)%SIZE;this.samples++;if(this.samples>=SIZE&&this.samples%HOP===0)this.analyze(startTime+i/this.rate,onFrame);}}
  analyze(time,emit){let energy=0,peak=0;for(let i=0;i<SIZE;i++){const x=this.ring[(this.position+i)%SIZE];energy+=x*x;peak=Math.max(peak,Math.abs(x));this.re[i]=x*this.window[i];this.im[i]=0;}const rms=Math.sqrt(energy/SIZE);fft(this.re,this.im);const bands=new Float64Array(BANDS);
   for(let i=1;i<this.map.length;i++){const b=this.map[i];if(b>=0){bands[b]+=(this.re[i]**2+this.im[i]**2)/(SIZE*SIZE);}}
   let flux=0,total=0;const feature=Array.from(bands,(p,i)=>{const value=Math.sqrt(p),rise=Math.max(0,value-this.prev[i]);flux+=rise;total+=value;this.prev[i]=value;return rise;});
   if(time-this.lastMeter>.1){this.lastMeter=time;emit({type:'meter',rms,clipping:peak>=.985,time});}
   // Spectral growth catches a fresh hit without counting an unchanged ringing tail.
   if(this.pending){const p=this.pending;for(let i=0;i<BANDS;i++)p.feature[i]=Math.max(p.feature[i],feature[i]);p.clipping||=peak>=.985;p.rms=Math.max(p.rms,rms);if(time>=p.until){this.pending=null;emit({type:'onset',feature:p.feature,rms:p.rms,clipping:p.clipping,time:p.time});}}
   else if(rms>=this.threshold&&flux>total*.13&&time-this.last>.055){this.last=time;this.pending={feature,time:time-.003,until:time+.027,rms,clipping:peak>=.985};}
  }
 }
 return {SIZE,HOP,BANDS,ROLES,LABELS,unit,template,conflicts,recognize,lane,validFeature,StreamDetector};
});
