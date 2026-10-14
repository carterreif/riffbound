/* Each chart job owns one instrument and its own mutable data. */
(function(root){
  'use strict';
  const PARTS=['guitar','drums','bass','vocals'];
  const MAPS=['imports','communityReferences','chartTimings','chartAdjustments','timingReviews','recordingReviews','audioReviews','mixAnalysis','sources','methods','unavailable'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function only(map,parts){
    return Object.fromEntries(parts.filter(part=>PARTS.includes(part)&&map?.[part]!==undefined).map(part=>[part,clone(map[part])]));
  }
  function reviewQuality(quality){
    const audioReviews={...quality?.audioReviews},timingReviews={...quality?.timingReviews};
    for(const part of PARTS){
      const review=audioReviews[part];
      // Older Whole song imports may have reused Guitar waveform verification.
      // Preserve saved notes/offsets, but do not advertise another part as proven.
      if(review?.policy==='authored-recording-alignment-v1'&&review.timingVerified&&review.referenceInstrument!==part){
        audioReviews[part]={...review,timingVerified:false};
        timingReviews[part]={status:'uncertain',suggestedMs:null,message:'This part’s timing was checked using another instrument. Preview it or find its own authored chart.'};
      }
    }
    return {...quality,audioReviews,timingReviews};
  }
  function isolate(result,part){
    if(!PARTS.includes(part)||!result||result.instrument!==undefined&&result.instrument!==part)throw Error('The analysis returned a different instrument. Its chart was not applied.');
    if(!result.charts?.[part]||!Array.isArray(result.charts[part].expert))throw Error('No independent '+part+' chart was returned. Other instrument charts were not used.');
    if(part==='drums'&&Object.values(result.charts.drums).some(notes=>Array.isArray(notes)&&notes.some(n=>n.pitch!==undefined||n.duration>0)))throw Error('The analysis returned pitched or sustained notes for Drums. Its chart was not applied.');
    const quality={...result.quality};
    for(const key of MAPS)quality[key]=only(quality[key],[part]);
    if(part!=='drums')for(const key of ['preserveEasyMedium','scoreReview','scoreRevision','scoreReference','tomEvidencePolicy'])delete quality[key];
    return {...result,instrument:part,charts:{[part]:clone(result.charts[part])},quality};
  }
  const api={only,isolate,reviewQuality};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffPartCharts=api;
})(typeof window!=='undefined'?window:globalThis);
