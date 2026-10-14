/* Explicit, drum-only source charts. No recording or other part is bundled. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const entries=[{id:'king-nothing',title:'King Nothing',artist:'Metallica',file:'charts/king-nothing-drums.json',sourceDuration:333.518}];
  const alignment={audioId:'29095952ed5badc3d13ea508d3e2c817b77fcce5c399d2dd49d26f766a070c59',duration:328.0718367346939,sourceId:'8f355a693174847f32b07ecd34887674dfbf18980a6eced8244689df93644dfa',offset:-2.836281179138322,revision:1};
  function matches(audioId,duration){return audioId===alignment.audioId&&Number.isFinite(duration)&&Math.abs(duration-alignment.duration)<.02;}
  const alignedMessage='King Nothing Drum timing aligned to this recording: source notes moved 2,836 ms earlier. All four difficulties and note colors are retained.';
  function result(bundle,duration,audioId){
    const entry=entries.find(e=>e.id===bundle?.id);
    if(!entry||bundle.title!==entry.title||bundle.artist!==entry.artist||!Number.isFinite(duration)||Math.abs(duration-entry.sourceDuration)>8)throw Error('Choose the matching King Nothing album recording. Your current charts are kept.');
    const levels=bundle.charts?.drums;
    if(!levels||['easy','medium','hard','expert'].some(level=>!Array.isArray(levels[level])||!levels[level].length))throw Error('The authored Drum chart is incomplete. Your current charts are kept.');
    for(const notes of Object.values(levels))for(const n of notes)if(!Number.isFinite(n.time)||n.time<0||n.time>duration||!Number.isInteger(n.lane)||n.lane<0||n.lane>5||n.duration!==0)throw Error('The Drum chart does not fit this recording. Your current charts are kept.');
    const verified=matches(audioId,duration)&&bundle.sourceChartSha256===alignment.sourceId;
    const offset=verified?alignment.offset:0,charts=clone(levels),timing=clone(bundle.timing);
    for(const notes of Object.values(charts))for(const n of notes)n.time+=offset;
    timing.offset+=offset;
    const reference={title:entry.title,artist:entry.artist,charter:bundle.charter,md5:bundle.md5,url:bundle.source,part:'drums'};
    return {instrument:'drums',charts:{drums:charts},bpm:bundle.bpm,beat:bundle.beat,quality:{
      imports:{drums:{id:bundle.sourceChartSha256,filename:'King Nothing · Neversoft · PART DRUMS',layout:'five',levels:['easy','medium','hard','expert'],derived:[],derivedFrom:{}}},
      lookupIdentity:{title:entry.title,artist:entry.artist},communityReferences:{drums:reference},chartTimings:{drums:timing},
      sources:{drums:'King Nothing · Neversoft authored Drums'},methods:{drums:'Authored PART DRUMS'},
      audioReviews:{drums:{policy:'authored-drum-track-v1',estimated:false,timingVerified:verified,...(verified?{recordingId:audioId,revision:alignment.revision,sourceOffsetSeconds:offset}: {})}},
      ...(verified?{chartAdjustments:{drums:0}}:{}),
      timingReviews:{drums:verified?{status:'aligned',suggestedMs:0,message:alignedMessage}:{status:'uncertain',suggestedMs:null,message:'Authored Drum notes loaded. This chart package has different audio padding; timing has not been verified against your recording. Preview the start, middle and end. Use Chart files with a timing shift if needed.'}}
    }};
  }
  async function load(id,duration,fetcher=root.fetch?.bind(root),audioId){
    const entry=entries.find(e=>e.id===id);if(!entry||!fetcher)throw Error('The authored Drum chart could not be opened.');
    const response=await fetcher(entry.file);if(!response.ok)throw Error('The authored Drum chart could not be downloaded. Your current charts are kept.');
    return result(await response.json(),duration,audioId);
  }
  async function upgrade(song,fetcher=root.fetch?.bind(root)){
    if(!song||!matches(song.id,song.musicEnd)||song.quality?.imports?.drums?.id!==alignment.sourceId||song.quality?.audioReviews?.drums?.revision>=alignment.revision)return song;
    try{
      const response=await fetcher(entries[0].file);if(!response.ok)return song;
      const bundle=await response.json(),old=(song.quality?.chartAdjustments?.drums||0)/1000;
      // A source ID cannot authorize overwriting edits. Each difficulty must
      // match the source, allowing only its saved uniform timing adjustment.
      for(const level of Object.keys(song.charts.drums||{})){
        const original=bundle.charts.drums[level==='normal'?'medium':level],current=song.charts.drums[level];
        if(!original||original.length!==current.length||current.some((n,i)=>n.lane!==original[i].lane||n.duration!==original[i].duration||Math.abs(n.time-old-original[i].time)>1e-8))return song;
      }
      if(['easy','medium','hard','expert'].some(l=>!song.charts.drums[l]?.length))return song;
      const repaired=result(bundle,song.musicEnd,song.id),charts={};
      for(const [level,notes] of Object.entries(song.charts.drums))charts[level]=notes.map(n=>({...n,time:n.time+alignment.offset-old}));
      const quality={...song.quality};
      for(const key of ['audioReviews','chartTimings','chartAdjustments','timingReviews'])quality[key]={...quality[key],...repaired.quality[key]};
      return {...song,charts:{...song.charts,drums:charts},quality};
    }catch{return song;}
  }
  const api={entries,alignment,matches,result,load,upgrade,message:()=>alignedMessage};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffAuthoredDrums=api;
})(typeof window!=='undefined'?window:globalThis);
