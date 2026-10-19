/* Build playable stereo audio from the selected chart package's music stems. */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./chart-difficulties.js'):root.RiffDifficulties;
  const RATE=22050,MAX_DURATION=D.MAX_DURATION;
  const check=signal=>{if(signal?.aborted)throw Error('Canceled');};
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function build(files,{duration,decode,signal,onProgress=()=>{}}){
    if(!Number.isFinite(duration)||duration<5||duration>MAX_DURATION)throw Error('Unsupported chart audio duration.');
    let end=duration,left=new Float32Array(Math.ceil(end*RATE)),right=new Float32Array(left.length),count=0;const names=[];
    for await(const file of files){
      check(signal);const buffer=await decode(file.data,{name:file.name});check(signal);
      if(!Number.isFinite(buffer.duration)||buffer.duration<5||buffer.duration>MAX_DURATION||buffer.duration<duration-.75||buffer.duration>duration+15||!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<8000||buffer.sampleRate>192000||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||buffer.numberOfChannels>16)throw Error('The bundled audio does not match this chart’s recording length.');
      const data=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));let musicDuration=buffer.duration;
      if(data.some(d=>!d.length||d.length<Math.floor(buffer.duration*buffer.sampleRate)))throw Error('The bundled audio could not be decoded completely.');
      // Some conversions retain padding with faint encoder/dither noise.
      // Bound every 100 ms tail window: peak <= -60 dB, RMS <= -72 dB.
      // Keep the existing 750 ms end tolerance; never shift time zero.
      if(buffer.duration>duration+.75){
        musicDuration=Math.floor((duration+.75)*buffer.sampleRate)/buffer.sampleRate;
        const window=Math.ceil(buffer.sampleRate*.1);
        for(const samples of data)for(let start=Math.floor(musicDuration*buffer.sampleRate);start<samples.length;start+=window){
          check(signal);const stop=Math.min(samples.length,start+window);let energy=0;
          for(let i=start;i<stop;i++){
            const value=samples[i];if(!Number.isFinite(value))throw Error('The bundled audio contains invalid samples.');
            if(Math.abs(value)>.001)throw Error('The bundled audio does not match this chart’s recording length.');energy+=value*value;
          }
          if(energy/(stop-start)>.00025**2)throw Error('The bundled audio does not match this chart’s recording length.');
          if((start-Math.floor(musicDuration*buffer.sampleRate))%(window*32)===0)await pause();
        }
      }
      if(musicDuration>end){end=musicDuration;const l=new Float32Array(Math.ceil(end*RATE)),r=new Float32Array(l.length);l.set(left);r.set(right);left=l;right=r;}
      const frames=Math.ceil(musicDuration*RATE),ratio=buffer.sampleRate/RATE;
      onProgress(`Combining ${file.name}…`);
      for(let start=0;start<frames;start+=65536){check(signal);const stop=Math.min(frames,start+65536);
        for(let i=start;i<stop;i++){const position=i*ratio,index=Math.floor(position),fraction=position-index;let l=0,r=0;
          for(let c=0;c<data.length;c++){const samples=data[c],a=samples[Math.min(index,samples.length-1)],b=samples[Math.min(index+1,samples.length-1)],value=a+(b-a)*fraction;if(!Number.isFinite(value))throw Error('The bundled audio contains invalid samples.');if(data.length===1){l=value;r=value;}else if(c%2)r+=value/Math.floor(data.length/2);else l+=value/Math.ceil(data.length/2);}
          left[i]+=l;right[i]+=r;
        }await pause();
      }names.push(file.name);count++;
    }
    check(signal);if(!count)throw Error('No matching song audio was bundled with this chart.');
    let peak=0;for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));if(!Number.isFinite(peak)||peak===0)throw Error('The bundled song audio is empty.');
    const gain=peak>.99?.99/peak:1,bytes=new ArrayBuffer(44+left.length*4),view=new DataView(bytes),write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    write(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,RATE,true);view.setUint32(28,RATE*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,left.length*4,true);
    onProgress('Preparing the full song for offline playback…');
    for(let start=0;start<left.length;start+=65536){check(signal);for(let i=start;i<Math.min(left.length,start+65536);i++){const l=Math.max(-1,Math.min(1,left[i]*gain)),r=Math.max(-1,Math.min(1,right[i]*gain));view.setInt16(44+i*4,Math.round(l*(l<0?32768:32767)),true);view.setInt16(46+i*4,Math.round(r*(r<0?32768:32767)),true);}await pause();}
    const waveform=Array.from({length:240},(_,i)=>{let p=0;for(let j=Math.floor(i*left.length/240);j<(i+1)*left.length/240;j+=32)p=Math.max(p,Math.abs(left[j])*gain,Math.abs(right[j])*gain);return p;});
    check(signal);return {blob:new Blob([bytes],{type:'audio/wav'}),duration:left.length/RATE,files:names,waveform,sampleRate:RATE};
  }
  const api={build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffSongAudio=api;
})(typeof window!=='undefined'?window:globalThis);
