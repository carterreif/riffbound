/* Adaptive spectral templates for repeating acoustic drum kits.
 * Non-negative factorization learns timbres from the uploaded recording;
 * no song identifiers, song-specific charts, or external audio are used.
 */
(function(root){
  'use strict';
  const BANDS=80,PARTS=7,LANES=[5,0,2,4,1,3,-1];
  const centers=Float64Array.from({length:BANDS},(_,b)=>35*Math.pow(10000/35,(b+.5)/BANDS));
  const quantile=(values,q)=>{const a=Array.from(values).sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(a.length*q))]||0;};
  function create(frames,bins,sampleRate,fftSize){
    const values=new Float32Array(frames*BANDS),map=new Int16Array(bins).fill(-1);
    for(let k=0;k<bins;k++){const hz=k*sampleRate/fftSize;if(hz>=35&&hz<10000)map[k]=Math.min(BANDS-1,Math.floor(Math.log(hz/35)/Math.log(10000/35)*BANDS));}
    return {values,map,frames};
  }
  function capture(bank,frame,spectrum){
    const offset=frame*BANDS;
    for(let k=0;k<bank.map.length;k++){const b=bank.map[k];if(b>=0)bank.values[offset+b]+=spectrum[k]*spectrum[k];}
    for(let b=0;b<BANDS;b++)bank.values[offset+b]=Math.sqrt(bank.values[offset+b]);
  }
  function gram(w){
    const g=new Float64Array(PARTS*PARTS);
    for(let b=0;b<BANDS;b++)for(let j=0;j<PARTS;j++)for(let k=0;k<PARTS;k++)g[j*PARTS+k]+=w[b*PARTS+j]*w[b*PARTS+k];
    return g;
  }
  function project(v,count,w,iterations){
    const g=gram(w),h=new Float32Array(count*PARTS),cross=new Float64Array(PARTS);
    for(let f=0;f<count;f++){
      cross.fill(0);
      for(let b=0;b<BANDS;b++)for(let k=0;k<PARTS;k++)cross[k]+=v[f*BANDS+b]*w[b*PARTS+k];
      // Non-negative coordinate descent can represent several simultaneous voices.
      for(let iteration=0;iteration<iterations;iteration++)for(let k=0;k<PARTS;k++){
        let residual=cross[k];for(let j=0;j<PARTS;j++)residual-=g[k*PARTS+j]*h[f*PARTS+j];
        h[f*PARTS+k]=Math.max(0,h[f*PARTS+k]+residual/(g[k*PARTS+k]+1e-12));
      }
    }
    return h;
  }
  function learn(bank,progress){
    const step=Math.max(1,Math.ceil(bank.frames/2200)),count=Math.ceil(bank.frames/step),train=new Float32Array(count*BANDS),scale=new Float32Array(BANDS);
    for(let b=0;b<BANDS;b++){const values=[];for(let f=0;f<bank.frames;f+=step)values.push(bank.values[f*BANDS+b]);scale[b]=Math.pow(quantile(values,.95),.65);}
    const floor=Math.max(...scale)*.03;
    for(let b=0;b<BANDS;b++)scale[b]=Math.max(scale[b],floor,1e-8);
    for(let f=0;f<bank.frames;f++)for(let b=0;b<BANDS;b++)bank.values[f*BANDS+b]/=scale[b];
    for(let f=0;f<count;f++)train.set(bank.values.subarray(f*step*BANDS,(f*step+1)*BANDS),f*BANDS);
    const w=new Float64Array(BANDS*PARTS),gaussian=(hz,center,width)=>Math.exp(-.5*Math.pow(Math.log2(hz/center)/width,2));
    for(let b=0;b<BANDS;b++){
      const hz=centers[b],g=(center,width)=>gaussian(hz,center,width);
      const shapes=[g(55,.45)+.15*g(100,.25),g(170,.23)+.35*g(500,.8)+.08*g(2000,1.5),g(250,.22)+.25*g(500,.35),g(110,.2)+.6*g(340,.2),g(8000,.6),g(3500,.55),g(100,.1)];
      for(let k=0;k<PARTS;k++)w[b*PARTS+k]=(k===4||k===5)&&hz<1500?0:shapes[k]+.00001;
    }
    for(let k=0;k<PARTS;k++){let norm=0;for(let b=0;b<BANDS;b++)norm+=w[b*PARTS+k]**2;norm=Math.sqrt(norm);for(let b=0;b<BANDS;b++)w[b*PARTS+k]/=norm;}
    let h=project(train,count,w,20);
    const cross=new Float64Array(count*PARTS),hh=new Float64Array(PARTS*PARTS),vh=new Float64Array(BANDS*PARTS),next=new Float64Array(w.length);
    for(let iteration=0;iteration<180;iteration++){
      const g=gram(w);cross.fill(0);
      for(let f=0;f<count;f++)for(let b=0;b<BANDS;b++)for(let k=0;k<PARTS;k++)cross[f*PARTS+k]+=train[f*BANDS+b]*w[b*PARTS+k];
      for(let f=0;f<count;f++)for(let k=0;k<PARTS;k++){
        let denominator=0;for(let j=0;j<PARTS;j++)denominator+=g[k*PARTS+j]*h[f*PARTS+j];
        h[f*PARTS+k]=Math.max(1e-10,h[f*PARTS+k])*cross[f*PARTS+k]/Math.max(1e-10,denominator);
      }
      hh.fill(0);vh.fill(0);
      for(let f=0;f<count;f++){
        for(let j=0;j<PARTS;j++)for(let k=0;k<PARTS;k++)hh[j*PARTS+k]+=h[f*PARTS+j]*h[f*PARTS+k];
        for(let b=0;b<BANDS;b++)for(let k=0;k<PARTS;k++)vh[b*PARTS+k]+=train[f*BANDS+b]*h[f*PARTS+k];
      }
      for(let b=0;b<BANDS;b++)for(let k=0;k<PARTS;k++){
        let denominator=0;for(let j=0;j<PARTS;j++)denominator+=w[b*PARTS+j]*hh[j*PARTS+k];
        // Cymbal templates cannot use a kick or snare's low body as evidence.
        next[b*PARTS+k]=(k===4||k===5)&&centers[b]<1500?0:Math.max(1e-12,w[b*PARTS+k]*vh[b*PARTS+k]/Math.max(1e-12,denominator));
      }
      w.set(next);
      if(iteration%30===0)progress(80+Math.round(iteration/180*8),'Learning the sounds of this drum kit…');
    }
    // Unit templates make activation magnitudes comparable between drum voices.
    for(let k=0;k<PARTS;k++){let norm=0;for(let b=0;b<BANDS;b++)norm+=w[b*PARTS+k]**2;norm=Math.sqrt(norm);for(let b=0;b<BANDS;b++)w[b*PARTS+k]/=Math.max(1e-12,norm);}
    return {activation:project(bank.values,bank.frames,w,24),templates:w,scale};
  }
  function transcribe(bank,dt,progress=()=>{}){
    const model=learn(bank,progress),envelopes=Array.from({length:PARTS},()=>new Float32Array(bank.frames));
    const lanes=LANES.slice();
    const bodyProfile=part=>{
      let body=0,noise=0,peak=0,frequency=0;
      for(let b=0;b<BANDS;b++){
        // Undo the analysis whitening before comparing physical timbres.
        const power=(model.templates[b*PARTS+part]*model.scale[b])**2,hz=centers[b];
        if(hz<400){body+=power;if(power>peak){peak=power;frequency=hz;}}
        else if(hz<1500)noise+=power;
      }
      return {frequency,noise:noise/Math.max(1e-15,body)};
    };
    const snare=bodyProfile(1),tom=bodyProfile(2);
    // Learning can exchange the two pitched templates. A clearly noisy snare
    // and a clean resonant tom keep their sound labels, not their seed indices.
    if([snare,tom].every(p=>p.frequency>=110&&p.frequency<350)&&snare.noise<.001&&tom.noise>.02&&tom.noise>snare.noise*4){lanes[1]=2;lanes[2]=0;}
    for(let f=0;f<bank.frames;f++)for(let k=0;k<PARTS;k++)envelopes[k][f]=model.activation[f*PARTS+k];
    const events=[];
    for(let k=0;k<6;k++){
      const env=envelopes[k],flux=new Float32Array(bank.frames);
      // Positive changes reject a ringing tail without masking a new quieter strike.
      for(let f=2;f<bank.frames-1;f++)flux[f]=Math.max(0,(env[f]+env[f+1]-env[f-1]-env[f-2])*.5);
      const level=quantile(env,.98),floor=quantile(flux,.98),sum=new Float64Array(bank.frames+1);
      for(let f=0;f<bank.frames;f++)sum[f+1]=sum[f]+flux[f];
      for(let f=3;f<bank.frames-3;f++){
        const a=Math.max(0,f-16),b=Math.min(bank.frames,f+17),local=k===4?quantile(flux.subarray(a,b),.5):(sum[b]-sum[a])/(b-a);
        if(flux[f]<floor*(k===4?.05:.2)||flux[f]<local*(k===4?2.5:1.8)||flux[f]<flux[f-1]||flux[f]<=flux[f+1]||env[f]<level*(k===4?.015:.08))continue;
        const nearby=events.findLast(e=>e.part===k);
        const event={part:k,lane:lanes[k],frame:f,time:f*dt,strength:flux[f]/Math.max(1e-9,floor),weight:flux[f]};
        if(nearby&&(f-nearby.frame)*dt<.05){if(event.weight>nearby.weight)Object.assign(nearby,event);}else events.push(event);
      }
    }
    return {events,envelopes,templates:model.templates,scale:model.scale};
  }
  const api={create,capture,transcribe};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffDrumSeparation=api;
})(typeof self!=='undefined'?self:globalThis);
