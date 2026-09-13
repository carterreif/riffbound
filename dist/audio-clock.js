/* Match the highway and hit judgments to audio reaching the output device. */
(function(root){
  function audibleTime(context,now){
    const current=context.currentTime;
    if(typeof context.getOutputTimestamp==='function'&&Number.isFinite(now)){
      const timestamp=context.getOutputTimestamp(),elapsed=(now-timestamp.performanceTime)/1000;
      if(timestamp.contextTime>0&&timestamp.performanceTime>0&&elapsed>=0&&elapsed<.5)return Math.max(0,Math.min(current,timestamp.contextTime+elapsed));
    }
    const latency=(Number.isFinite(context.baseLatency)?context.baseLatency:0)+(Number.isFinite(context.outputLatency)?context.outputLatency:0);
    return Math.max(0,current-Math.min(.5,latency));
  }
  const api={audibleTime};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffAudioClock=api;
})(typeof window!=='undefined'?window:globalThis);
