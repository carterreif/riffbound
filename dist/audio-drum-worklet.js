import './audio-drum-core.js';
class RiffDrumCapture extends AudioWorkletProcessor{
 constructor(options){super();this.detector=new globalThis.RiffAudioDrumCore.StreamDetector(sampleRate,options.processorOptions);this.port.onmessage=event=>{if(event.data?.type==='threshold')this.detector.threshold=Math.max(.001,Math.min(.2,Number(event.data.value)||.012));};}
 process(inputs){if(inputs[0]?.length)this.detector.push(inputs[0],currentTime,data=>this.port.postMessage(data));return true;}
}
registerProcessor('riff-drum-capture',RiffDrumCapture);
