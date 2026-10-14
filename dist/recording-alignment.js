/* Match recording padding using audio, independently of instrument note heads.
 * Only a stable, distinct waveform match may move an authored arrangement. */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const RATE=22050/16,MAX_SHIFT=8,plans=new Map();
  function features(samples,sampleRate=22050){
    if(!samples?.length||!Number.isFinite(sampleRate)||sampleRate<8000)throw Error('Reference audio is unavailable.');
    const step=sampleRate/RATE,out=new Float32Array(Math.floor(samples.length/step));
    for(let i=0;i<out.length;i++){const start=Math.floor(i*step),end=Math.floor((i+1)*step);let sum=0;for(let j=start;j<end;j++)sum+=samples[j];out[i]=sum/(end-start);}
    return {samples:out,rate:RATE,duration:samples.length/sampleRate};
  }
  function fromBuffer(buffer){
    let strongest=0,energy=0,mixed=0;
    for(let ch=0;ch<buffer.numberOfChannels;ch++){let e=0;const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i+=100)e+=data[i]**2;if(e>energy){energy=e;strongest=ch;}}
    const channels=Array.from({length:buffer.numberOfChannels},(_,ch)=>buffer.getChannelData(ch));
    const length=channels[0].length;
    for(let i=0;i<length;i+=100){let sum=0;for(const ch of channels)sum+=ch[i];mixed+=(sum/channels.length)**2;}
    if(channels.length===1||mixed<energy*.04)return features(channels[strongest],buffer.sampleRate);
    const step=buffer.sampleRate/RATE,out=new Float32Array(Math.floor(length/step));
    for(let i=0;i<out.length;i++){const start=Math.floor(i*step),end=Math.floor((i+1)*step);let sum=0;for(let j=start;j<end;j++)for(const ch of channels)sum+=ch[j];out[i]=sum/(end-start)/channels.length;}
    return {samples:out,rate:RATE,duration:buffer.duration};
  }
  function combine(tracks){
    if(!tracks.length||tracks.some(t=>t.rate!==RATE||!t.samples?.length))throw Error('Reference audio is unavailable.');
    const samples=new Float32Array(Math.max(...tracks.map(t=>t.samples.length)));
    for(const t of tracks)for(let i=0;i<t.samples.length;i++)samples[i]+=t.samples[i];
    return {samples,rate:RATE,duration:Math.max(...tracks.map(t=>t.duration))};
  }
  function plan(n){
    if(plans.has(n))return plans.get(n);
    const reverse=new Uint32Array(n),cos=new Float64Array(n/2),sin=new Float64Array(n/2);let bits=Math.log2(n);
    for(let i=0;i<n;i++){let v=i,r=0;for(let b=0;b<bits;b++){r=r*2+(v&1);v>>>=1;}reverse[i]=r;}
    for(let i=0;i<n/2;i++){cos[i]=Math.cos(2*Math.PI*i/n);sin[i]=Math.sin(2*Math.PI*i/n);}
    const p={reverse,cos,sin};plans.set(n,p);return p;
  }
  function fft(re,im,p,inverse=false){
    const n=re.length;
    for(let i=0;i<n;i++){const j=p.reverse[i];if(j>i){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
    for(let size=2;size<=n;size*=2){const half=size/2,step=n/size;
      for(let i=0;i<n;i+=size)for(let j=0;j<half;j++){const a=i+j,b=a+half,k=j*step,c=p.cos[k],s=(inverse?1:-1)*p.sin[k],tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}
    }
    if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
  }
  function fit(target,source){
    const m=source.length,total=target.length+m-1;let n=1;while(n<total)n*=2;
    const ar=new Float64Array(n),ai=new Float64Array(n),br=new Float64Array(n),bi=new Float64Array(n),p=plan(n);
    let mean=0,sourceEnergy=0;for(const v of source)mean+=v;mean/=m;
    for(let i=0;i<m;i++){const v=source[i]-mean;br[m-1-i]=v;sourceEnergy+=v*v;}
    if(sourceEnergy/m<1e-10)return null;
    ar.set(target);fft(ar,ai,p);fft(br,bi,p);
    for(let i=0;i<n;i++){const re=ar[i]*br[i]-ai[i]*bi[i];ai[i]=ar[i]*bi[i]+ai[i]*br[i];ar[i]=re;}
    fft(ar,ai,p,true);
    const sums=new Float64Array(target.length+1),energies=new Float64Array(target.length+1),scores=new Float64Array(target.length-m+1);
    for(let i=0;i<target.length;i++){sums[i+1]=sums[i]+target[i];energies[i+1]=energies[i]+target[i]**2;}
    let index=0,best=0;
    for(let i=0;i<scores.length;i++){const energy=energies[i+m]-energies[i]-(sums[i+m]-sums[i])**2/m;const score=energy/m<1e-10?0:Math.min(1,Math.abs(ar[i+m-1])/Math.sqrt(energy*sourceEnergy));scores[i]=score;if(score>best){index=i;best=score;}}
    let competitor=0;for(let i=0;i<scores.length;i++)if(Math.abs(i-index)>RATE*.06)competitor=Math.max(competitor,scores[i]);
    return {index,correlation:best,competitor};
  }
  const uncertain=message=>({status:'uncertain',shiftSeconds:null,message});
  async function review(target,reference,{signal,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
    if(target?.rate!==RATE||reference?.rate!==RATE||!target.samples?.length||!reference.samples?.length)return uncertain('Recording audio is unavailable for comparison.');
    const duration=Math.min(target.duration,reference.duration);
    if(duration<12||duration>D.MAX_REFERENCE_DURATION)return uncertain('Not enough recording audio to verify a uniform shift.');
    const windowSeconds=Math.min(5,Math.max(2,duration/10)),count=Math.floor(windowSeconds*RATE),margin=windowSeconds/2,span=reference.duration-windowSeconds;
    const windows=[];
    for(const fraction of [.08,.25,.45,.65,.87]){
      if(signal?.aborted)throw Error('Canceled');
      const sourceStart=Math.floor((margin+fraction*(span-margin))*RATE),lo=Math.max(0,sourceStart-Math.round(MAX_SHIFT*RATE)),hi=Math.min(target.samples.length,sourceStart+count+Math.round(MAX_SHIFT*RATE));
      if(hi-lo<count||sourceStart+count>reference.samples.length)continue;
      const found=fit(target.samples.subarray(lo,hi),reference.samples.subarray(sourceStart,sourceStart+count));
      if(found)windows.push({time:sourceStart/RATE,shiftSeconds:(lo+found.index-sourceStart)/RATE,correlation:found.correlation,competitor:found.competitor});
      await yieldTask();
    }
    if(signal?.aborted)throw Error('Canceled');
    const reliable=windows.filter(w=>w.correlation>=.25&&w.correlation-w.competitor>=.065&&Math.abs(w.shiftSeconds)<MAX_SHIFT-.02);
    if(reliable.length<3||reliable[0].time>reference.duration*.35||reliable.at(-1).time<reference.duration*.65||reliable.at(-1).time-reliable[0].time<reference.duration*.45)return {...uncertain('The waveform match is weak or ambiguous. Authored timing was not shifted.'),windows};
    const shifts=reliable.map(w=>w.shiftSeconds).sort((a,b)=>a-b),shift=shifts[Math.floor(shifts.length/2)];
    if(shifts.at(-1)-shifts[0]>.018)return {...uncertain('Recording timing varies across the song. A uniform shift was not applied.'),windows};
    let xx=0,xy=0;const mt=reliable.reduce((s,w)=>s+w.time,0)/reliable.length,ms=reliable.reduce((s,w)=>s+w.shiftSeconds,0)/reliable.length;
    for(const w of reliable){xx+=(w.time-mt)**2;xy+=(w.time-mt)*(w.shiftSeconds-ms);}
    if(Math.abs(xy/xx)>.00005)return {...uncertain('The recording may have tempo drift. A uniform shift was not applied.'),windows};
    const shiftSeconds=Math.abs(shift)<.004?0:shift;
    return {status:'aligned',shiftSeconds,windows,matchedWindows:reliable.length,message:`Recording matched in ${reliable.length} separated audio windows. `+(shiftSeconds?`Authored notes moved ${Math.round(Math.abs(shiftSeconds)*1000)} ms ${shiftSeconds<0?'earlier':'later'}; colors and difficulties kept.`:'Original authored timing retained.')};
  }
  // Full-rate own-stem PCM is transient analysis input, never playback audio.
  function pcm(buffer){
    const rate=buffer.sampleRate,channels=buffer.numberOfChannels,duration=buffer.duration;
    if(!Number.isFinite(rate)||rate<8000||rate>192000||!Number.isInteger(channels)||channels<1||channels>8||!Number.isFinite(duration)||duration<5||duration>D.MAX_REFERENCE_DURATION)throw Error('Unsupported drum source audio.');
    const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));if(data.some(d=>!d?.length||Math.abs(d.length/rate-duration)>.025))throw Error('Incomplete drum source audio.');
    let strongest=0,energy=0,mixed=0;
    for(let c=0;c<channels;c++){let e=0;for(let i=0;i<data[c].length;i+=100)e+=data[c][i]**2;if(e>energy){energy=e;strongest=c;}}
    for(let i=0;i<data[0].length;i+=100){let sum=0;for(const d of data)sum+=d[i];mixed+=(sum/channels)**2;}
    const selected=mixed<energy*.04?[data[strongest]]:data,out=new Float32Array(Math.ceil(duration*22050));
    for(let i=0;i<out.length;i++){const position=i*rate/22050,index=Math.floor(position),fraction=position-index;let value=0;for(const d of selected)value+=d[Math.min(index,d.length-1)]*(1-fraction)+d[Math.min(index+1,d.length-1)]*fraction;out[i]=value/selected.length;if(!Number.isFinite(out[i]))throw Error('Invalid drum source samples.');}
    return out;
  }
  function addStem(current,samples){
    if(!current)return samples;
    if(current.length<samples.length){const larger=new Float32Array(samples.length);larger.set(current);current=larger;}
    for(let i=0;i<samples.length;i++)current[i]+=samples[i];
    return current;
  }
  function alignStems(tracks,duration,shiftSeconds=0){
    if(!Number.isFinite(duration)||duration<5||duration>D.MAX_DURATION||!Number.isFinite(shiftSeconds)||Math.abs(shiftSeconds)>MAX_SHIFT||!tracks.length||tracks.length>4||tracks.some(t=>!t?.length||t.length>Math.ceil(D.MAX_REFERENCE_DURATION*22050)))throw Error('Unsupported drum source alignment.');
    const out=new Float32Array(Math.ceil(duration*22050)),shift=shiftSeconds*22050;let peak=0;
    for(let i=0;i<out.length;i++){const position=i-shift,index=Math.floor(position),fraction=position-index;let value=0;for(const t of tracks)value+=(index>=0&&index<t.length?t[index]:0)*(1-fraction)+(index+1>=0&&index+1<t.length?t[index+1]:0)*fraction;if(!Number.isFinite(value))throw Error('Invalid drum source samples.');out[i]=value;peak=Math.max(peak,Math.abs(value));}
    if(!peak)throw Error('The matched drum source is silent.');if(peak>1)for(let i=0;i<out.length;i++)out[i]*=.99/peak;
    return out;
  }
  const api={features,fromBuffer,combine,review,pcm,addStem,alignStems,RATE,MAX_SHIFT};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffRecordingAlignment=api;
})(typeof window!=='undefined'?window:globalThis);
