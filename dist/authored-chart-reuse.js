/* Reuse authored parts only for the exact same uploaded recording. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const L=node?require('./song-library.js'):root.RiffLibrary;
  const P=node?require('./part-charts.js'):null;
  const PARTS=['guitar','bass','drums','vocals'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function reuse(song,audioId,duration,targets,{requireAudioMatch=false}={}){
    const result={charts:{},quality:{reusedParts:[],imports:{},communityReferences:{},chartTimings:{},chartAdjustments:{},timingReviews:{},audioReviews:{},sources:{},methods:{}}};
    if(!song||song.id!==audioId||!/^[a-f0-9]{64}$/.test(audioId)||!Number.isFinite(duration)||Math.abs(song.musicEnd-duration)>.02)return result;
    if(song.quality?.lookupIdentity)result.quality.lookupIdentity=clone(song.quality.lookupIdentity);
    for(const part of PARTS.filter(p=>targets.includes(p))){
      const imported=song.quality?.imports?.[part];
      // Audio estimates have no authored import identity and cannot be promoted
      // into a source chart by a matching filename or another instrument.
      if(!imported||!/^[a-f0-9]{64}$/.test(imported.id||''))continue;
      if(requireAudioMatch&&song.quality?.communityReferences?.[part]){
        const review=song.quality.audioReviews?.[part],reference=song.quality.communityReferences[part];
        const ownsRecording=review?.recordingId===audioId&&review.estimated===false;
        const waveform=ownsRecording&&review.timingVerified===true&&(review.referenceInstrument===part||part==='drums'&&['verified-authored-drums-v1','authored-drum-track-v1'].includes(review.policy));
        const packageAudio=ownsRecording&&review.policy==='authored-package-audio-v1'&&review.sourceMd5===reference.md5&&song.quality.packageAudio?.sourceMd5===reference.md5;
        if(!waveform&&!packageAudio)continue;
      }
      let validated;
      try{
        validated=L.validate({...song,instrument:part,charts:{[part]:song.charts?.[part]}});
        if(!validated.quality?.imports?.[part]||!validated.charts[part]?.expert?.length)continue;
      }catch{continue;}
      result.charts[part]=clone(part==='drums'&&validated.quality.drumLayout==='four'?validated.charts.drums:part==='drums'?normalizeDrumLevels(song.charts[part],validated.charts[part]):song.charts[part]);result.quality.reusedParts.push(part);
      if(part==='drums')result.quality.drumLayout=validated.quality.drumLayout;
      for(const key of ['imports','communityReferences','chartTimings','chartAdjustments','timingReviews','audioReviews','sources','methods']){
        if(song.quality?.[key]?.[part]!==undefined)result.quality[key][part]=clone(song.quality[key][part]);
      }
      // Legacy imports had a shared tempo map. Keep it scoped to its own part.
      result.quality.chartTimings[part]??=clone(song.quality?.chartTiming||{resolution:192,offset:song.offset||0,tempos:[{tick:0,bpm:song.bpm}],signatures:[{tick:0,numerator:4,denominator:4}]});
      result.quality.sources[part]??='Saved authored chart';
      result.quality.methods[part]??='Saved authored chart';
    }
    if(result.quality.reusedParts.length){
      result.bpm=song.bpm;result.beat=song.beat;result.offset=song.offset;result.waveform=clone(song.waveform||[]);result.chartVersion=song.chartVersion;
      if(result.charts.drums)for(const key of ['scoreRevision','scoreReview','scoreReference','preserveEasyMedium'])if(song.quality?.[key]!==undefined)result.quality[key]=clone(song.quality[key]);
    }
    result.quality=(P||root.RiffPartCharts).reviewQuality(result.quality);
    return result;
  }
  function normalizeDrumLevels(original,validated){
    // Preserve authored level order and arrays unless legacy holds/pitches need
    // normalization; validating one part must not rewrite neighboring parts.
    return Object.fromEntries(Object.entries(original).map(([level,notes])=>[level,notes.some(n=>n.duration!==0||n.pitch!==undefined)?validated[level]:notes]));
  }
  const api={reuse};if(node)module.exports=api;else root.RiffAuthoredReuse=api;
})(typeof window!=='undefined'?window:globalThis);
