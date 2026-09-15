/* Riffbound: original music, chart, and game. No external assets or services. */
(() => {
  'use strict';
  const E=window.RiffEngine,T=window.RiffPlayback,Library=window.RiffLibrary, $=id=>document.getElementById(id);
  const D=E.Difficulties;
  const PARTS=['guitar','drums','bass','vocals'],partName=part=>({guitar:'Guitar',drums:'Drums',bass:'Bass',vocals:'Vocals'}[part]||part);
  const canvas=$('highway'), ctx=canvas.getContext('2d');
  const band=window.RiffStage.create($('performance'));
  const fretButtons=[...document.querySelectorAll('[data-lane]')];
  let state='idle', previousState='idle', difficulty='medium', mode='tap', instrument='guitar', session=new E.Session(), held=new Set();
  let audioContext=null, master=null, musicBuffer=null, source=null, startTime=0, frozenTime=0;
  let song=null,uploadGeneration=0,playbackGeneration=0,cancelAnalysis=null,previewing=false;
  let transportSeek=0,playRate=1,practiceLoop=null,loopCycle=0,practicePass=1,frozenInputTime=0;
  let calibrationTest=null,calibrationTimer=null;
  let setlistSongs=[],setlistGeneration=0,setlistError='';
  let pendingSaves=0,reconnectingAudio=false;
  let timingOffset=0,highwaySpeed=1;
  try{const saved=JSON.parse(localStorage.getItem('riffbound-preferences-v1')||'{}');timingOffset=Math.max(-250,Math.min(250,Number(saved.timingOffset)||0));highwaySpeed=Math.max(.7,Math.min(1.6,Number(saved.highwaySpeed)||1));}catch{}
  const countNodes=[];
  let width=0,height=0,lastFrame=0,lastUi=0,volume=.7,muted=false,preMute=.7;
  const particles=[],flashes=[0,0,0,0,0,0],inputOwners=new Map();
  const mobileViewport=window.matchMedia('(max-width: 850px), (pointer: coarse) and (max-width: 1180px)');
  let padTarget=0,padWidth=0;
  const laneColor=lane=>instrument==='drums'?(lane===E.KICK_LANE?E.KICK_COLOR:E.DRUM_COLORS[lane]):E.COLORS[lane];
  let idleNotes=E.makeChart('medium'), judgeTimer=0, lastAnnounce='', finishScheduled=false;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const formatTime=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  const running=()=>state==='playing'||state==='countin';
  const busy=()=>state==='loading'||state==='analyzing'||reconnectingAudio;
  const active=()=>running()||state==='paused'||busy();
  const transport=()=>T.position(window.RiffAudioClock.audibleTime(audioContext,performance.now()),startTime,transportSeek,playRate,practiceLoop);
  const gameTransport=()=>T.position(window.RiffAudioClock.audibleTime(audioContext,performance.now())-(previewing?0:timingOffset/1000),startTime,transportSeek,playRate,practiceLoop);
  const currentTime=()=>running()?transport().time:state==='paused'?frozenTime:0;
  const inputTime=()=>running()?gameTransport().time:state==='paused'?frozenInputTime:0;
  const trackDuration=()=>song?.duration??E.DURATION,trackBeat=()=>song?.beat??E.BEAT;
  const chartNotes=()=>song?song.charts[instrument][difficulty]:E.makeChart(difficulty,instrument);
  const effectiveMode=()=>['drums','vocals'].includes(instrument)?'tap':mode;
  const bestKey=()=>song?.quality?.scoreReview&&instrument==='drums'&&['expert','hard'].includes(difficulty)?`riffbound-inbloom-score-v${song.quality.scoreRevision||2}-${song.id}-${difficulty}-${effectiveMode()}`:difficulty==='expert'?(song?`riffbound-upload-${instrument==='drums'?'v5':'v3'}-${song.id}-${instrument}-expert-${effectiveMode()}`:instrument==='guitar'?`riffbound-best-v1-expert-${mode}`:`riffbound-best-v2-${instrument}-expert-${effectiveMode()}`):`riffbound-difficulty-v1-${song?.id||'demo'}-${instrument}-${difficulty}-${effectiveMode()}`;
  function readBest(){try{return Number(localStorage.getItem(bestKey())||0);}catch{return 0;}}
  function refreshBest(){const n=readBest();$('localBest').textContent=n?n.toLocaleString():'—';}
  function setAnnouncement(small,big,visible=true,countdown=false){
    const key=[small,big,visible,countdown].join('|');if(lastAnnounce===key)return;lastAnnounce=key;
    $('announceSmall').textContent=small;$('announceBig').textContent=big;$('announcement').classList.toggle('invisible',!visible);$('announcement').classList.toggle('countdown',countdown);
  }
  function showMessage(text){$('statusMessage').textContent=text;}
  function updateButtons(){
    $('difficultyGroup').disabled=active();$('modeGroup').disabled=active()||['drums','vocals'].includes(instrument);$('instrumentGroup').disabled=active();
    $('chartTargetGroup').disabled=active();$('chartScope').disabled=active();$('partsGroup').disabled=active();$('buildPartsButton').disabled=active();
    $('rechartButton').disabled=active();$('practiceButton').disabled=busy();$('timingButton').disabled=busy();$('libraryButton').disabled=busy();
    $('saveCurrentButton').disabled=!song||busy()||pendingSaves>0;$('exportCurrentButton').disabled=!song||busy()||!Library.audioStatus(song?.audioBlob).ok;
    $('reconnectAudioButton').disabled=!song||busy()||pendingSaves>0;$('importBackupButton').disabled=busy();
    for(const part of PARTS)$('libraryUpload'+partName(part)).disabled=active();
    $('saveCurrentButton').textContent=pendingSaves?'Saving…':'Save current song';
    updateSetlistSelection();
    $('pauseButton').disabled=!running()&&state!=='paused';
    $('playButton').disabled=busy()||(!song&&instrument==='vocals');
    $('playText').textContent=state==='analyzing'?'CHARTING SONG…':state==='loading'?'TUNING UP…':previewing?'PLAY YOURSELF':state==='paused'?'RESUME TRACK':running()?'RESTART TRACK':'PLAY TRACK';
    $('pauseIcon').textContent=state==='paused'?'▶':'Ⅱ';$('pauseText').textContent=state==='paused'?'Resume':'Pause';
    $('pauseButton').setAttribute('aria-label',state==='paused'?'Resume track':'Pause track');
    document.body.classList.toggle('playing',active());
    document.body.classList.toggle('mobile-session',running()||state==='paused'||state==='loading');
    document.body.classList.toggle('practicing',!!practiceLoop);
    document.body.classList.toggle('auto-chart-busy',state==='analyzing');document.body.classList.toggle('previewing',previewing);
    $('uploadButton').disabled=busy();$('demoButton').disabled=busy();$('previewButton').disabled=busy();
    $('previewButton').textContent=previewing?'■ Stop preview':'▶ Preview chart';
    $('previewPosition').disabled=busy()||(active()&&!previewing);
    $('startHint').textContent=running()?(instrument==='drums'?'Space / Enter: kick. Shift: Overdrive. Escape: pause.':'Escape to pause. Space for Overdrive.'):state==='paused'?'Your place in the song is saved.':'Sound on. Headphones recommended.';
    resize();
  }
  function clearHeld(){held.clear();inputOwners.clear();fretButtons.forEach(b=>b.classList.remove('active'));$('kickButton').classList.remove('active');session.notes.forEach(n=>n.held=false);}
  function refreshInstrument(){
    const drums=instrument==='drums',vocals=instrument==='vocals';
    for(const name of ['instrument','chartTarget'])document.querySelectorAll(`input[name=${name}]`).forEach(input=>input.checked=input.value===instrument);
    refreshChartScope();
    document.body.classList.toggle('is-drums',drums);$('modeGroup').hidden=drums||vocals;
    document.body.classList.toggle('is-strum',!drums&&!vocals&&mode==='strum');
    $('modeHint').textContent=mobileViewport.matches?(drums?'Tap the matching drum pads. Green also hits orange cymbals. Tap Kick pedal for the wide purple bars.':mode==='tap'?'Tap the matching colored pads as notes reach the rings. Hold for long notes.':'Hold the matching colored pads, then tap Strum with another finger.'):(drums?'D F J K L hit the five pads. L (green) also hits orange cymbals. Space or Enter plays the wide purple kick bars. Shift activates Overdrive.':mode==='tap'?'Press a fret key as its note hits the line.':'Hold the fret keys. Press Enter to strum.');
    $('touchStrum').hidden=drums||vocals||mode!=='strum';$('strumGuide').hidden=drums||vocals||mode!=='strum';$('drumLabels').hidden=!drums;$('kickButton').hidden=!drums;$('kickGuide').hidden=!drums;
    $('controlType').textContent=drums?'Pads':vocals?'Pitch pads':'Frets';$('driveKey').textContent=drums?'SHIFT':'SPACE';$('overdriveKey').textContent=drums?'SHIFT':'SPACE';$('hitLineLabel').textContent=drums?'HIT THE DRUM AT THE PAD LINE':'HIT THE NOTE AT THE FRET LINE';
    canvas.setAttribute('aria-label',drums?'Five drum lanes from left to right: D red snare, F yellow closed or open hi-hat, J blue tom, K orange cymbal, L green floor tom. L also hits orange cymbals, including simultaneous orange and green notes. Space or Enter plays purple kick bars across the highway.':'Notes scroll down five colored lanes toward the fret line. Use D, F, J, K, and L or the touch buttons below.');
    const difficultyLabels=document.querySelectorAll('.difficulty-row small');
    const limitedFrets=['guitar','bass'].includes(instrument);
    (limitedFrets?['3 FRETS','4 FRETS','5 FRETS','ALL NOTES']:drums?['FEWER HITS','CORE GROOVE','MORE FILLS','ALL HITS']:['FEWER NOTES','MELODY','MORE NOTES','ALL NOTES']).forEach((text,i)=>difficultyLabels[i].textContent=text);
    if(vocals)$('modeHint').textContent='Play the vocal melody with D F J K L or the colored pads. Low to high pitch; hold long notes. Pad play, without a microphone.';
    const guitarNames=['Green fret','Red fret','Yellow fret','Blue fret','Orange fret'];
    fretButtons.forEach((b,i)=>{b.disabled=i>=D.frets(instrument,difficulty);b.setAttribute('aria-disabled',String(b.disabled));b.style.setProperty('--fret',laneColor(i));b.setAttribute('data-touch-label',drums?['Snare','Hi-hat','Tom','Cymbal','Floor'][i]:String(i+1));b.setAttribute('aria-label',`${drums?(i===4?'Floor tom or orange cymbal':E.DRUM_NAMES[i]):vocals?`Vocal pitch ${i+1} of 5`:guitarNames[i]}, ${E.KEYS[i].slice(3)}`);b.classList.toggle('disabled-lane',i>=D.frets(instrument,difficulty));});
    $('drumLabels').querySelectorAll('span').forEach((b,i)=>{b.style.color=E.DRUM_COLORS[i];b.classList.toggle('disabled-lane',i>=D.frets(instrument,difficulty));});
    if(!song&&vocals){$('uploadHint').textContent='Iron Voltage is instrumental. Upload a song with vocals to chart its melody.';setAnnouncement('VOCAL MELODY','UPLOAD A VOCAL TRACK');}else if(!song)setAnnouncement('YOUR STAGE IS WAITING','LET IT RIP.');
    idleNotes=chartNotes();refreshBest();updateButtons();refreshChartPreview();
  }
  function judge(kind,lane){
    const el=$('judgment');el.textContent=kind;el.className=`judgment ${kind==='GOOD'?'good':kind==='MISS'||kind==='OFF BEAT'?'miss':''}`;
    void el.offsetWidth;el.classList.add('show');clearTimeout(judgeTimer);judgeTimer=setTimeout(()=>el.classList.remove('show'),430);
    if(kind==='PERFECT'||kind==='GOOD'){
      flashes[lane]=1;
      if(!reducedMotion)for(let i=0;i<(instrument==='drums'?18:10);i++)particles.push({lane,life:instrument==='drums'?.58:.45,age:0,vx:(Math.random()-.5)*95,vy:-50-Math.random()*(instrument==='drums'?215:160),x:0,y:0,size:1+Math.random()*3,color:instrument==='drums'?(i%3?'#ffb54f':'#fff3bb'):session.overdrive?'#e8ff65':laneColor(lane)});
    }
  }
  function newSession(){
    session=new E.Session(difficulty,mode,instrument,{notes:T.segment(chartNotes(),practiceLoop),musicEnd:practiceLoop?.end??song?.musicEnd??E.MUSIC_END});session.onJudge=judge;session.onMilestone=n=>{
      const el=$('streakCallout');el.textContent=`${n} NOTE STREAK`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
    };
    particles.length=0;flashes.fill(0);clearHeld();finishScheduled=false;
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const row=$('fretControls').getBoundingClientRect();
    padTarget=row.top-rect.top+row.height/2;
    padWidth=row.width+(parseFloat(getComputedStyle($('fretControls')).columnGap)||0);
    const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    band.resize(width,height,dpr);
  }
  new ResizeObserver(resize).observe(canvas);
  mobileViewport.addEventListener?.('change',()=>{refreshInstrument();resize();});

  function ensureAudio(){
    if(!audioContext){const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)throw Error('This browser does not support audio playback.');audioContext=new AudioCtor({latencyHint:'interactive'});master=audioContext.createGain();master.connect(audioContext.destination);
      audioContext.addEventListener?.('statechange',()=>{if(running()&&(audioContext.state==='interrupted'||audioContext.state==='suspended'))pause();});
    }
    return audioContext;
  }
  function refreshChartPreview(){
    $('chartPreview').hidden=!song;if(!song)return;
    const notes=chartNotes();$('chartSummary').textContent=`${partName(instrument)} · ${D.NAMES[difficulty]} · ${notes.length} notes`;
    $('chartDifficultySummary').textContent='Expert: all detected notes. '+['expert','hard','medium','easy'].map(level=>`${D.NAMES[level]}: ${song.charts[instrument][level].length}`).join(' · ');
    $('chartMapping').textContent=instrument==='drums'?'Red: snare · Yellow: closed/open hi-hat · Blue: tom · Orange: crash/ride cymbal · Green: floor tom · Purple: kick. Easy: fewer hits and kicks. Medium: core groove. Hard: denser fills. Expert: every distinct detected hit. Drum colors keep their instrument on every level.':'Colors follow pitch from low to high. Easy uses green/red/yellow; Medium adds blue; Hard and Expert add orange. Easier levels use fewer notes and simpler chords. Expert keeps all detected attacks.';
    if(instrument==='bass')$('chartMapping').textContent='Bass follows detected low pitches. Easy uses three frets, Medium four, and Hard/Expert all five. Easier levels have fewer notes. Repeated pitches keep their color within each difficulty. Use tap or hold + strum.';
    if(instrument==='vocals')$('chartMapping').textContent='Vocal melody: green, red, yellow, blue, orange from low to high. Tap the pitch pad and hold its tail. This is pad play, without microphone scoring or lyrics. Other melodic instruments can affect the estimate.';
    const names=instrument==='drums'?['Snare','Hi-hat','Tom','Cymbal','Floor tom','Kick']:['Green','Red','Yellow','Blue','Orange'];
    const source=song.quality?.sources?.[instrument];
    $('chartDetails').textContent=(source?source+'. ':'')+names.map((name,lane)=>`${name}: ${notes.filter(n=>n.lane===lane).length}`).join(' · ')+(source?'. Matched to this recording; preview the groove and fills.':'. Parts are estimated; use preview to check the result.');
    if(instrument==='drums'&&song.quality?.scoreReview)$('chartDetails').textContent+=' '+song.quality.scoreReview;
    const canvas=$('chartOverview'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    c.clearRect(0,0,w,h);c.fillStyle='#727f8b55';
    song.waveform.forEach((v,i)=>c.fillRect(i*w/song.waveform.length,h/2-v*h*.42,w/song.waveform.length-1,v*h*.84));
    for(const n of notes){c.fillStyle=laneColor(n.lane);c.fillRect(n.time/song.musicEnd*w,6+(n.lane===5?5:n.lane)*10,2,7);}
    canvas.setAttribute('aria-label',`${notes.length} ${instrument} notes across ${formatTime(song.musicEnd)} of audio. Use Preview from to hear a section.`);
  }
  function refreshSong(){
    $('trackTitle').classList.toggle('custom-title',!!song);
    if(song)$('trackTitle').textContent=song.title;else $('trackTitle').innerHTML='IRON<br><span>VOLTAGE</span>';
    $('trackArtist').textContent=song?'Your uploaded song':'The Riffbound Sessions';$('trackSource').textContent=song?'/ YOUR SONG':'/ ORIGINAL SESSION';
    $('trackKind').textContent=song?song.quality?.sources?.[instrument]?'MATCHED CHART':'AUTO CHART':'HEAVY ROCK';$('trackBpm').textContent=song?`≈ ${song.bpm} BPM`:'112 BPM';
    $('trackLength').textContent=formatTime(song?.musicEnd??E.DURATION);$('remaining').textContent=formatTime(trackDuration());
    $('uploadHint').textContent=song?`${Object.keys(song.charts).map(partName).join(' + ')} ready. Choose a part to preview or play it. Full recordings are supported; isolated tracks give clearer estimates.`:'Upload a full song or isolated audio, then preview the detected notes. Choose one instrument, all four, or selected parts.';
    $('demoButton').hidden=!song;$('previewPosition').max=String(Math.max(0,(song?.musicEnd??0)-.2));$('previewPosition').value='0';$('previewTime').textContent='0:00';
    const end=song?.musicEnd??E.MUSIC_END;$('loopStart').max=String(end-1);$('loopEnd').max=String(end);$('loopStart').value='0';$('loopEnd').value=String(Math.min(15,end));
    refreshInstrument();
  }
  function chartScope(){return ['whole','separate'].includes($('chartScope').value)?$('chartScope').value:'single';}
  function requestedParts(){return chartScope()==='whole'?PARTS.slice():chartScope()==='separate'?PARTS.filter(part=>$('part'+partName(part)).checked):[instrument];}
  function refreshChartScope(){
    const scope=chartScope(),parts=requestedParts();
    $('partsGroup').hidden=scope!=='separate';$('chartTargetGroup').hidden=scope!=='single';
    $('chartTargetLegend').textContent='2. CHOOSE AN INSTRUMENT';
    $('scopeHint').textContent=scope==='whole'?'Build separate Drums, Bass, Guitar and Vocals charts from one full song. Play one part at a time with the original audio.':scope==='separate'?'Check the parts you want from one recording. Each gets its own chart and preview; audio stems are not created.':'Upload a full song or an isolated track. Only the selected part is charted.';
    $('uploadButton').textContent=`3. Upload ${scope==='whole'?'whole song':scope==='separate'?'song for selected parts':'song for '+partName(instrument)}`;
    $('buildPartsButton').hidden=!song||scope==='single';
    $('buildPartsButton').textContent=scope==='whole'?'Build all four charts for this song':'Build selected parts for this song';
    if(scope==='separate'&&!parts.length)$('scopeHint').textContent='Check at least one part to chart.';
  }
  function uploadProgress(value,label){$('chartProgress').value=value;$('chartStatus').textContent=label;}
  function cancelUpload(){
    uploadGeneration++;cancelAnalysis?.();cancelAnalysis=null;$('uploadProgress').hidden=true;$('songFile').value='';
    $('chartStatus').textContent='Charting canceled. Your previous track is ready.';$('chartStatus').classList.remove('error');reset();refreshInstrument();
  }
  function runAnalysis(samples,target,generation,audioId,onProgress=uploadProgress){
    return new Promise((resolve,reject)=>{
      let worker;try{worker=new Worker('autochart.js');}catch{reject(Error('Automatic charting could not start. Refresh the page and try again.'));return;}
      const end=()=>{worker.terminate();if(generation===uploadGeneration)cancelAnalysis=null;};
      cancelAnalysis=()=>{end();reject(Error('Canceled'));};
      worker.onmessage=event=>{if(generation!==uploadGeneration)return;const data=event.data;
        if(data.type==='progress')onProgress(data.value,data.label);
        else if(data.type==='complete'){end();resolve(data.result);}
        else if(data.type==='error'){end();reject(Error(data.message));}
      };
      worker.onerror=()=>{end();reject(Error('Automatic charting could not finish. Try a shorter audio file.'));};
      const copy=samples.slice();worker.postMessage({samples:copy,sampleRate:22050,instrument:target,audioId},[copy.buffer]);
    });
  }
  async function analyzeParts(samples,targets,generation,audioId){
    const results=[],unavailable={};
    for(const [index,target] of targets.entries()){
      if(generation!==uploadGeneration)throw Error('Canceled');
      uploadProgress(12+index/targets.length*82,`${index+1}/${targets.length} · Charting ${partName(target)}…`);
      try{results.push({...await runAnalysis(samples,target,generation,audioId,(value,label)=>uploadProgress(12+(index+value/100)/targets.length*82,`${index+1}/${targets.length} · ${label}`)),instrument:target});}
      catch(error){if(generation!==uploadGeneration)throw error;unavailable[target]=error.message;}
    }
    if(generation!==uploadGeneration)throw Error('Canceled');
    if(!results.length)throw Error(Object.entries(unavailable).map(([part,message])=>`${partName(part)}: ${message}`).join(' '));
    const base=results.find(r=>r.instrument===instrument)||results[0];
    return {...base,charts:Object.assign({},...results.map(r=>r.charts)),quality:{...base.quality,...(results.some(r=>r.quality?.preserveEasyMedium)?{preserveEasyMedium:true,scoreReview:results.find(r=>r.quality?.scoreReview)?.quality.scoreReview,scoreRevision:results.find(r=>r.quality?.scoreReview)?.quality.scoreRevision||2}:{}),sources:Object.fromEntries(results.map(r=>[r.instrument,r.quality?.sources?.[r.instrument]||null])),unavailable,methods:Object.fromEntries(results.map(r=>[r.instrument,r.quality?.method||'Audio analysis']))}};
  }
  function mergeSongCharts(previous,result){
    const charts={...previous,...result.charts};
    if(result.quality?.preserveEasyMedium&&result.charts.drums&&previous?.drums){
      // Preserve this player's existing lower arrangements on every rebuild
      // and same-audio reupload, even if they predate the matched reference.
      charts.drums={...charts.drums};
      for(const level of ['easy','medium','normal'])if(previous.drums[level])charts.drums[level]=previous.drums[level];
    }
    return charts;
  }
  function readyMessage(result){
    const unavailable=Object.keys(result.quality?.unavailable||{});
    return `${Object.keys(result.charts).map(partName).join(' + ')} chart${Object.keys(result.charts).length>1?'s':''} ready. Preview before playing.`+(unavailable.length?` Could not chart ${unavailable.map(partName).join(', ')}: ${unavailable.map(p=>result.quality.unavailable[p]).join(' ')}`:'');
  }
  async function buildSelectedParts(){
    if(active()||!song)return;
    const targets=requestedParts();if(!targets.length){$('chartStatus').textContent='Choose at least one part to chart.';return;}
    const generation=++uploadGeneration;stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;
    setAnnouncement('YOUR SONG','BUILDING SEPARATE CHARTS…');
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration)return;
      const result=await analyzeParts(samples,targets,generation,song.id);if(generation!==uploadGeneration)return;
      song={...song,analysisSamples:samples,charts:mergeSongCharts(song.charts,result),quality:{...song.quality,...result.quality,sources:{...song.quality?.sources,...result.quality.sources},methods:{...song.quality?.methods,...result.quality.methods}}};
      instrument=result.instrument;song.instrument=instrument;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);saveSong();uploadProgress(100,readyMessage(result));setAnnouncement('CHARTS READY','CHOOSE YOUR PART');
    }catch(error){if(generation!==uploadGeneration)return;state='idle';reset();refreshSong();$('chartStatus').textContent=error.message;$('chartStatus').classList.add('error');}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;updateButtons();}}
  }
  function setSongPercussion(){
    song.charts=D.upgradeAll(song.charts,song.beat);
    const notes=song.charts.drums?.expert||[];
    song.percussion=window.RiffMotion?.performanceEvents?.(notes,song.charts.guitar?.expert||song.charts.bass?.expert||[])||{left:notes.filter(n=>[0,2,4].includes(n.lane)),right:notes.filter(n=>[1,3].includes(n.lane))};
  }
  async function chooseInstrument(target,force=false){
    if(active()||(target===instrument&&!force))return;
    if(!song){instrument=target;newSession();refreshSong();updateUi(0);return;}
    if(!force&&song.charts[target]){instrument=target;song.instrument=target;newSession();refreshSong();updateUi(0);saveSong();return;}
    const generation=++uploadGeneration;stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;
    uploadProgress(5,`Rebuilding this song for ${partName(target)} only…`);setAnnouncement('ONE INSTRUMENT',`CHARTING ${target.toUpperCase()}…`);
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration)return;
      const result=await runAnalysis(samples,target,generation,song.id);if(generation!==uploadGeneration)return;
      // Analysis may replace chart data, never the original audio or identity.
      song={...song,...result,id:song.id,title:song.title,filename:song.filename,audioBlob:song.audioBlob,buffer:song.buffer,musicEnd:song.musicEnd,analysisSamples:samples,charts:mergeSongCharts(song.charts,result),quality:{...song.quality,...result.quality,sources:{...song.quality?.sources,[target]:result.quality?.sources?.[target]||null},methods:{...song.quality?.methods,[target]:result.quality?.method||'Audio analysis'}},duration:song.musicEnd+.8};instrument=target;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);saveSong();
      uploadProgress(100,`${partName(target)} chart ready. Preview it before playing.`);setAnnouncement('FOCUSED CHART READY','LET IT RIP.');
    }catch(error){if(generation!==uploadGeneration)return;state='idle';reset();refreshSong();$('chartStatus').textContent=error.message;$('chartStatus').classList.add('error');}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;updateButtons();}}
  }
  async function uploadSong(file){
    if(!file)return;
    const targets=requestedParts();if(!targets.length){$('chartStatus').textContent='Choose at least one part to chart.';$('chartStatus').classList.add('error');return;}
    if(file.size>80*1024*1024||file.size===0){$('chartStatus').textContent='Choose a non-empty audio file smaller than 80 MB.';$('chartStatus').classList.add('error');return;}
    const generation=++uploadGeneration;cancelAnalysis?.();cancelAnalysis=null;
    stopAudio();previewing=false;practiceLoop=null;playRate=1;clearHeld();state='analyzing';$('resultDialog').close();updateButtons();showMessage('');
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;uploadProgress(2,'Reading your song…');setAnnouncement('YOUR SONG','BUILDING CHARTS…');
    try{
      const bytes=await file.arrayBuffer();if(generation!==uploadGeneration)return;
      const hash=await crypto.subtle.digest('SHA-256',bytes);if(generation!==uploadGeneration)return;
      const id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      // Decoding detaches its input buffer; preserve the original bytes first.
      const audioBlob=new Blob([bytes],{type:file.type||'audio/wav'});
      if(!Library.audioStatus(audioBlob).ok)throw Error('The audio file could not be read completely. Select the original WAV or MP3 again.');
      uploadProgress(6,'Decoding the audio…');
      let buffer;try{buffer=await ensureAudio().decodeAudioData(bytes);}catch{throw Error('This audio could not be opened. Try an MP3 or WAV file.');}
      if(generation!==uploadGeneration)return;
      if(buffer.duration<5||buffer.duration>480)throw Error('Choose a song between 5 seconds and 8 minutes long.');
      uploadProgress(10,'Preparing the audio for charting…');
      const samples=await prepareSamples(buffer);if(generation!==uploadGeneration)return;
      const result=await analyzeParts(samples,targets,generation,id);
      if(generation!==uploadGeneration)return;
      let previous=song?.id===id?song:null;if(!previous)try{previous=await Library.get(id);}catch{}
      if(generation!==uploadGeneration)return;
      song={...result,charts:mergeSongCharts(previous?.charts,result),quality:{...previous?.quality,...result.quality,sources:{...previous?.quality?.sources,...result.quality.sources},methods:{...previous?.quality?.methods,...result.quality.methods}},id,buffer,audioBlob,filename:file.name,analysisSamples:samples,title:file.name.replace(/\.[^.]+$/,'')||'Your song',musicEnd:buffer.duration,duration:buffer.duration+.8};
      instrument=result.instrument;
      setSongPercussion();
      state='idle';newSession();refreshSong();updateUi(0);uploadProgress(100,readyMessage(result));setAnnouncement('CHARTS READY','LET IT RIP.');saveSong();
    }catch(error){if(generation!==uploadGeneration)return;state='idle';newSession();refreshSong();updateUi(0);$('chartStatus').textContent=error.message||'Charting failed. Try another audio file.';$('chartStatus').classList.add('error');setAnnouncement('CHARTING COULD NOT FINISH','TRY ANOTHER SONG');}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;$('songFile').value='';updateButtons();}}
  }
  async function prepareSamples(buffer){
      const OfflineCtor=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      if(!OfflineCtor||!window.Worker)throw Error('Automatic charting needs a current Chrome, Edge, Firefox, or Safari browser.');
      const offline=new OfflineCtor(1,Math.ceil(buffer.duration*22050),22050),input=offline.createBufferSource();
      // Include both sides of a stereo recording; fall back only for phase cancellation.
      let channel=0,highestEnergy=-1;
      for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);let energy=0;for(let i=0;i<data.length;i+=100)energy+=data[i]*data[i];if(energy>highestEnergy){highestEnergy=energy;channel=ch;}}
      let mixedEnergy=highestEnergy;
      if(buffer.numberOfChannels===2){const left=buffer.getChannelData(0),right=buffer.getChannelData(1);mixedEnergy=0;for(let i=0;i<left.length;i+=100)mixedEnergy+=Math.pow((left[i]+right[i])*.5,2);}
      input.buffer=buffer;
      if(mixedEnergy<highestEnergy*.04){const splitter=offline.createChannelSplitter(buffer.numberOfChannels);input.connect(splitter);splitter.connect(offline.destination,channel);}else input.connect(offline.destination);
      input.start();
      const rendered=await offline.startRendering();return new Float32Array(rendered.getChannelData(0));
  }

  function refreshLibrarySaveStatus(){
    $('librarySaveStatus').hidden=false;$('libraryEmptyActions').hidden=!!song;
    $('librarySaveStatus').textContent=song?`Current song: ${song.title}. ${$('saveStatus').textContent||'Choose Save current song to add it to your setlist.'}`:'No uploaded song is open. Import a backup to keep your chart, or upload Guitar, Drums, Bass or Vocals to chart and save your audio.';
    const status=Library.audioStatus(song?.audioBlob);
    $('audioAttachmentStatus').hidden=!song;$('audioAttachmentStatus').textContent=song?status.message:'';
    $('audioRecovery').hidden=!song||status.ok||status.code==='AUDIO_TOO_LARGE';
  }
  function setSaveStatus(message){$('saveStatus').textContent=message;refreshLibrarySaveStatus();}
  function storageErrorMessage(error){
    const message=error?.message||'Song storage is unavailable. Try again.';
    if(/Failed to write blobs|IOError|I\/O error/i.test(message))return 'The browser could not write the song to this device. Keep your backup, free some device space, close other game tabs, then try saving again. If this continues, import the backup in another browser.';
    return error?.name==='QuotaExceededError'||/quota|full disk|disk full|no space|not enough space/i.test(message)?'Browser storage is full or there is not enough free space on this device. Free some space, then choose Save current song again. Keep the song open and do not clear this game’s site data.':message;
  }
  async function saveSong(){
    if(!song)return;const saved={...song,instrument};pendingSaves++;setSaveStatus('Saving audio and charts to your setlist…');updateButtons();
    try{await Library.save(saved);if(song?.id===saved.id){setSaveStatus('Added to your setlist · Saved on this device.');if(!setlistSongs.some(track=>track.id===saved.id))$('setlistSearch').value='';}await refreshSetlist();if($('libraryDialog').open)await refreshLibrary();}
    catch(error){if(song?.id===saved.id){const audio=Library.audioStatus(saved.audioBlob);setSaveStatus(audio.ok?'Could not save on this device. You can still play; export a backup with Export current song. '+storageErrorMessage(error):'Could not save. '+audio.message);}}
    finally{pendingSaves--;updateButtons();}
  }
  async function reconnectOriginalAudio(file){
    if(!file||!song||busy()||pendingSaves)return;
    const current=song;let repaired=false;reconnectingAudio=true;setSaveStatus('Checking the original audio file…');updateButtons();
    try{
      const restored=await Library.reconnectAudio(current,file);if(song!==current)return;
      song={...song,audioBlob:restored.audioBlob,filename:restored.filename};repaired=true;
      setSaveStatus('Original audio reconnected. Your existing charts are ready to save.');
    }catch(error){if(song===current)setSaveStatus('Audio was not reconnected. '+error.message);}
    finally{reconnectingAudio=false;$('reconnectAudioFile').value='';updateButtons();}
    if(repaired)await saveSong();
  }
  function useDemo(){
    if(busy())return;song=null;if(instrument==='vocals')instrument='guitar';reset();refreshSong();$('chartStatus').textContent='';setSaveStatus('');
  }
  function updateSetlistSelection(){
    for(const button of $('setlistEntries').children){
      const selected=button.dataset.songId===(song?.id??'demo');
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=active();
      button.children[2].textContent=selected?'SELECTED':'SELECT';
    }
  }
  function renderSetlist(){
    const query=$('setlistSearch').value.trim().toLocaleLowerCase();
    const tracks=[{id:'demo',title:'Iron Voltage',musicEnd:E.MUSIC_END,charts:{guitar:{},drums:{},bass:{}}},...setlistSongs];
    const matches=tracks.filter(track=>track.title.toLocaleLowerCase().includes(query));
    $('setlistEntries').replaceChildren();$('setlistCount').textContent=`${tracks.length} track${tracks.length===1?'':'s'}`;
    for(const track of matches){
      const button=document.createElement('button'),title=document.createElement('strong'),info=document.createElement('span'),badge=document.createElement('span');
      button.type='button';button.className='setlist-track';button.dataset.songId=track.id;button.setAttribute('aria-label',`Select ${track.title}`);
      title.textContent=track.title;info.className='setlist-track-info';info.textContent=`${formatTime(track.musicEnd)} · ${Object.keys(track.charts).map(partName).join(' + ')}${track.id==='demo'?' · Demo':''}`;badge.className='setlist-track-badge';
      button.append(title,info,badge);button.addEventListener('click',async()=>{if(active())return;if(track.id==='demo')useDemo();else await openSong(track.id);});$('setlistEntries').append(button);
    }
    $('setlistStatus').textContent=setlistError||(query?matches.length?`${matches.length} matching track${matches.length===1?'':'s'}`:'No matching songs. Try another title.':setlistSongs.length?'':'Start with the demo or upload your first song below.');
    updateSetlistSelection();
  }
  async function refreshSetlist(){
    const generation=++setlistGeneration;
    try{
      const records=await Library.list();if(generation!==setlistGeneration)return;
      setlistSongs=records;setlistError='';renderSetlist();
    }catch(error){if(generation!==setlistGeneration)return;setlistError='Saved songs could not be loaded. Try Manage songs to retry.';renderSetlist();}
  }
  async function refreshLibrary(){
    refreshLibrarySaveStatus();$('songList').replaceChildren();$('libraryStatus').textContent='Loading your songs…';
    try{
      const songs=await Library.list();$('libraryStatus').textContent=songs.length?`${songs.length} saved song${songs.length===1?'':'s'}`:song?'No saved songs yet. Save current song adds the open song to your setlist.':'No saved songs yet. Upload a song or import a .riffpack backup.';
      for(const saved of songs){
        const row=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),actions=document.createElement('div');row.className='saved-song';actions.className='tool-actions';title.textContent=saved.title;info.textContent=`${formatTime(saved.musicEnd)} · ${Object.keys(saved.charts).join(' + ')} · ${(saved.byteLength/1024/1024).toFixed(1)} MB`;
        for(const [label,action] of [['Open',async()=>openSong(saved.id)],['Export',async()=>exportSong(await Library.get(saved.id))],['Remove',async()=>{await Library.remove(saved.id);await refreshSetlist();await refreshLibrary();if(song?.id===saved.id)setSaveStatus('Removed from your setlist. This open copy is playable until you leave it.');}]]){
          const button=document.createElement('button');button.className='quiet';button.textContent=label;button.setAttribute('aria-label',`${label} ${saved.title}`);button.addEventListener('click',async()=>{if(busy())return;button.disabled=true;try{await action();}catch(error){$('libraryStatus').textContent=error.message;}finally{button.disabled=false;}});actions.append(button);
        }row.append(title,info,actions);$('songList').append(row);
      }
    }catch(error){$('libraryStatus').textContent=storageErrorMessage(error);}
  }
  function exportSong(record=song){
    if(!record)throw Error('Open a song before exporting.');
    const url=URL.createObjectURL(Library.pack({...record,instrument:record===song?instrument:record.instrument})),link=document.createElement('a');link.href=url;link.download=(record.title.replace(/[^a-z0-9 _-]/gi,'').slice(0,80)||'Riffbound song')+'.riffpack';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('libraryStatus').textContent='Backup exported with its audio and charts.';
  }
  async function openSong(record){
    if(busy())return;
    stopCalibration();stopAudio();const generation=playbackGeneration;previewing=false;practiceLoop=null;playRate=1;state='loading';clearHeld();updateButtons();showMessage('');
    try{
      if(typeof record==='string')record=await Library.get(record);if(generation!==playbackGeneration)return;
      if(!record){await refreshSetlist();throw Error('This song is no longer saved. Upload it again to add it to your setlist.');}
      const safe=Library.validate(record),buffer=await ensureAudio().decodeAudioData(await record.audioBlob.arrayBuffer());if(generation!==playbackGeneration)return;
      if(Math.abs(buffer.duration-safe.musicEnd)>.2)throw Error('The backup audio does not match its chart length.');
      song={...safe,audioBlob:record.audioBlob,buffer,analysisSamples:null};instrument=safe.instrument;state='idle';setSongPercussion();newSession();refreshSong();updateUi(0);$('libraryDialog').close();setAnnouncement('SAVED SONG READY','LET IT RIP.');setSaveStatus('Song ready · Choose your settings, then Play track.');
    }catch(error){if(generation!==playbackGeneration)return;state='idle';newSession();refreshSong();updateUi(0);$('libraryStatus').textContent='Could not open this song. '+error.message;showMessage(error.message);}
    finally{if(generation===playbackGeneration)updateButtons();}
  }
  async function importBackup(file){
    if(!file||busy())return;$('libraryStatus').textContent='Reading your backup…';
    try{
      const record=await Library.unpack(file),hash=await crypto.subtle.digest('SHA-256',await record.audioBlob.arrayBuffer());
      const id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(id!==record.id)throw Error('The audio in this backup is damaged or does not match its song.');
      await openSong(record);if(song?.id===record.id)await saveSong();
    }catch(error){$('libraryStatus').textContent=error.message;}
    finally{$('backupFile').value='';}
  }
  function preferences(){try{localStorage.setItem('riffbound-preferences-v1',JSON.stringify({timingOffset,highwaySpeed}));return true;}catch{return false;}}
  function stopCalibration(){
    clearTimeout(calibrationTimer);calibrationTimer=null;
    if(calibrationTest)for(const node of calibrationTest.nodes||[]){try{node.stop();node.disconnect();}catch{}}
    calibrationTest=null;$('calibrationTap').disabled=true;$('calibrationStart').disabled=false;
  }
  async function startCalibration(){
    if(busy())return;reset();stopCalibration();const test={nodes:[],errors:new Map(),start:0};calibrationTest=test;
    $('calibrationStart').disabled=true;$('calibrationStatus').textContent='Listen to the first two clicks, then tap with every beat.';
    try{
      const ac=ensureAudio();await ac.resume();if(calibrationTest!==test)return;master.gain.value=muted?0:volume;
      if(muted||volume===0){stopCalibration();$('calibrationStatus').textContent='Turn the sound on before calibrating.';return;}
      test.start=ac.currentTime+.75;
      for(let i=0;i<12;i++){const oscillator=ac.createOscillator(),gain=ac.createGain(),when=test.start+i*.5;oscillator.frequency.value=i<2?660:880;gain.gain.setValueAtTime(.16,when);gain.gain.exponentialRampToValueAtTime(.001,when+.07);oscillator.connect(gain);gain.connect(master);oscillator.start(when);oscillator.stop(when+.08);test.nodes.push(oscillator);}
      $('calibrationTap').disabled=false;
      calibrationTimer=setTimeout(()=>{
        if(calibrationTest!==test)return;const estimate=T.calibration([...test.errors.values()]);stopCalibration();
        if(!estimate?.stable){$('calibrationStatus').textContent='The taps were too few or uneven. Try again and follow the sound.';return;}
        $('timingOffset').value=String(estimate.offset);$('timingOffsetValue').textContent=`${estimate.offset} ms`;$('calibrationStatus').textContent=`Suggested adjustment: ${estimate.offset} ms from ${estimate.count} steady taps. Save timing to use it.`;
      },6750);
    }catch{stopCalibration();$('calibrationStatus').textContent='Sound could not start. Tap Start tap test again.';}
  }
  function calibrationTap(){
    const test=calibrationTest;if(!test?.start)return;
    const now=window.RiffAudioClock.audibleTime(audioContext,performance.now()),index=Math.round((now-test.start)/.5);
    if(index<2||index>=12||test.errors.has(index))return;
    const error=(now-test.start-index*.5)*1000;if(Math.abs(error)>250)return;test.errors.set(index,error);
    $('calibrationStatus').textContent=`${test.errors.size} taps recorded. Keep following the clicks…`;
  }
  function openTool(id){if(busy())return;if(running())pause();$(id).showModal();}
  $('libraryButton').addEventListener('click',()=>{openTool('libraryDialog');refreshLibrary();refreshSetlist();});
  $('setlistSearch').addEventListener('input',renderSetlist);
  window.addEventListener('focus',()=>{if(!active())refreshSetlist();});
  $('saveCurrentButton').addEventListener('click',saveSong);
  for(const [id,target] of PARTS.map(part=>['libraryUpload'+partName(part),part]))$(id).addEventListener('click',()=>{if(song||active())return;$('chartScope').value='single';chooseInstrument(target);$('libraryDialog').close();$('songFile').click();});
  $('reconnectAudioButton').addEventListener('click',()=>{$('reconnectAudioFile').click();});
  $('reconnectAudioFile').addEventListener('change',()=>reconnectOriginalAudio($('reconnectAudioFile').files[0]));
  $('exportCurrentButton').addEventListener('click',()=>{try{exportSong();}catch(error){$('libraryStatus').textContent=error.message;}});
  $('importBackupButton').addEventListener('click',()=>{$('backupFile').click();});
  $('backupFile').addEventListener('change',()=>importBackup($('backupFile').files[0]));
  $('practiceButton').addEventListener('click',()=>openTool('practiceDialog'));
  $('practiceLaunch').addEventListener('click',()=>{const start=Number($('loopStart').value),end=Number($('loopEnd').value);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<1||end>(song?.musicEnd??E.MUSIC_END)){$('practiceStatus').textContent='Choose at least one second inside this song.';return;}const loop=T.practice(start,end,$('practiceRate').value,song?.musicEnd??E.MUSIC_END);if(!T.segment(chartNotes(),loop).length){$('practiceStatus').textContent='There are no charted notes here. Choose another section.';return;}$('practiceDialog').close();play({practice:true});});
  $('timingButton').addEventListener('click',()=>{$('timingOffset').value=String(timingOffset);$('timingOffsetValue').textContent=`${timingOffset} ms`;openTool('timingDialog');});
  $('calibrationStart').addEventListener('click',startCalibration);
  $('calibrationTap').addEventListener('pointerdown',event=>{event.preventDefault();calibrationTap();});
  $('calibrationTap').addEventListener('click',event=>{if(event.detail===0)calibrationTap();});
  $('timingOffset').addEventListener('input',()=>{$('timingOffsetValue').textContent=`${$('timingOffset').value} ms`;});
  $('calibrationSave').addEventListener('click',()=>{timingOffset=Math.max(-250,Math.min(250,Number($('timingOffset').value)||0));stopCalibration();const saved=preferences();$('timingDialog').close();showMessage(saved?'Timing saved for this device.':'Timing applied for this session; browser storage is unavailable.');});
  $('calibrationReset').addEventListener('click',()=>{stopCalibration();timingOffset=0;$('timingOffset').value='0';$('timingOffsetValue').textContent='0 ms';preferences();});
  for(const event of ['close','cancel'])$('timingDialog').addEventListener(event,stopCalibration);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&calibrationTest){stopCalibration();$('calibrationStatus').textContent='Calibration stopped when the app was hidden. Start again when ready.';}});
  $('highwaySpeed').value=String(highwaySpeed);$('highwaySpeedValue').textContent=`${highwaySpeed.toFixed(1)}×`;
  $('highwaySpeed').addEventListener('input',()=>{highwaySpeed=Math.max(.7,Math.min(1.6,Number($('highwaySpeed').value)||1));$('highwaySpeedValue').textContent=`${highwaySpeed.toFixed(1)}×`;preferences();});
  $('offlineButton').addEventListener('click',()=>openTool('offlineDialog'));

  // Synthesize a fixed original instrumental. Mixing to one buffer gives notes and audio one clock.
  async function composeTrack(ac){
    const sr=ac.sampleRate,buffer=ac.createBuffer(1,Math.ceil((E.DURATION+.2)*sr),sr),out=buffer.getChannelData(0);
    let seed=83417;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
    const sample=(seconds,fn)=>{const a=new Float32Array(Math.ceil(seconds*sr));for(let i=0;i<a.length;i++)a[i]=fn(i/sr,i);return a;};
    const add=(a,time,gain=1)=>{const start=Math.round(time*sr);for(let i=0;i<a.length&&start+i<out.length;i++)if(start+i>=0)out[start+i]+=a[i]*gain;};
    const kick=sample(.42,t=>Math.sin(2*Math.PI*(48*t+5.8*(1-Math.exp(-t*34))))*Math.exp(-t*12)*.7+random()*Math.exp(-t*110)*.05);
    let low=0;
    const snare=sample(.25,t=>{low=.6*low+.4*random();return (random()-low)*Math.exp(-t*18)*.3+Math.sin(2*Math.PI*175*t)*Math.exp(-t*28)*.15;});
    const hat=sample(.09,t=>random()*Math.exp(-t*52)*.13);
    const openHat=sample(.3,t=>random()*Math.exp(-t*15)*.12);
    const crash=sample(1.4,t=>random()*Math.exp(-t*4)*Math.min(t*200,1)*.18);
    const tom=sample(.34,t=>(Math.sin(2*Math.PI*(105*t+1.8*(1-Math.exp(-t*22))))*.42+random()*.035)*Math.exp(-t*13));
    const floorTom=sample(.48,t=>(Math.sin(2*Math.PI*(66*t+1.5*(1-Math.exp(-t*20))))*.48+random()*.025)*Math.exp(-t*9));
    const ride=sample(.7,t=>(random()*.08+Math.sin(2*Math.PI*2800*t)*.045+Math.sin(2*Math.PI*4327*t)*.04)*Math.exp(-t*6));
    const drumSamples={kick,snare,hat,openHat,crash,tom,floorTom,ride};
    const midi=n=>440*Math.pow(2,(n-69)/12);
    function guitar(note,seconds,lead=false){
      const f=midi(note);let filter=0;
      return sample(seconds,t=>{
        const envelope=Math.min(1,t*320)*Math.exp(-t*(lead?4.8:12))*Math.min(1,(seconds-t)*90);
        const saw=v=>2*(v-Math.floor(v+.5));
        const raw=lead?(Math.sin(2*Math.PI*f*t)+.3*saw(f*1.003*t)+.2*Math.sin(2*Math.PI*f*2*t)):(.45*saw(f*t)+.27*saw(f*1.4983*t)+.22*saw(f*2.002*t));
        const distorted=Math.tanh(raw*(lead?2.2:3.6));filter+=.3*(distorted-filter);
        return filter*envelope*(lead?.17:.25);
      });
    }
    const leadNotes=[64,67,69,71,74],leadSamples=leadNotes.map(n=>guitar(n,.6,true));
    const chordNotes=[40,43,38,45],chords=chordNotes.map(n=>guitar(n,.3));
    const basses=chordNotes.map(n=>sample(.36,t=>{
      const f=midi(n-12),wave=Math.sin(2*Math.PI*f*t)+.23*Math.sin(2*Math.PI*f*2*t);
      return wave*Math.min(t*180,1)*Math.exp(-t*7)*Math.min(1,(.36-t)*60)*.2;
    }));
    for(let bar=0;bar<E.BARS;bar++){
      const chord=[0,0,1,2,0,1,2,3][bar%8];
      for(let step=0;step<8;step++){
        const t=(bar*4+step/2)*E.BEAT;
        if(bar>=12&&bar<20&&step%2)continue;
        add(chords[chord],t,step%2?.56:.82);add(basses[chord],t,step%2?.66:.95);
      }
      if(bar%4===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    for(const hit of E.makeDrumEvents())add(drumSamples[hit.voice],hit.time,hit.gain);
    for(const n of E.makeChart('normal')){
      const a=n.duration?guitar(leadNotes[n.lane],n.duration+.2,true):leadSamples[n.lane];add(a,n.time,.9);add(a,n.time+E.BEAT*.75,.15);
    }
    add(guitar(40,1.8),E.MUSIC_END-E.BEAT,.7);
    // Soft saturation limits the mixed peaks without depending on a device compressor.
    for(let i=0;i<out.length;i++){
      const t=i/sr,fade=Math.min(1,Math.max(0,(E.DURATION-t)/1.4));out[i]=Math.tanh(out[i]*.85)*.8*fade;
    }
    return buffer;
  }
  function countClick(when,last=false){
    const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=last?1100:750;o.type='sine';g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.001,when+.09);o.connect(g);g.connect(master);o.start(when);o.stop(when+.1);countNodes.push(o);
  }
  function stopAudio(){playbackGeneration++;if(source){try{source.stop();}catch{}source.disconnect();source=null;}for(const node of countNodes){try{node.stop();}catch{}node.disconnect();}countNodes.length=0;}
  async function play({preview=false,offset=0,practice=false}={}){
    if(busy())return;
    if(!song&&instrument==='vocals'){showMessage('Iron Voltage is instrumental. Upload a song with vocals to build a vocal melody chart.');return;}
    if(state==='paused'&&!previewing&&!preview&&!practice){resume();return;}
    stopCalibration();
    practiceLoop=practice?T.practice($('loopStart').value,$('loopEnd').value,$('practiceRate').value,song?.musicEnd??E.MUSIC_END):null;
    playRate=practiceLoop?.rate??1;loopCycle=0;practicePass=1;
    previewing=preview;
    stopAudio();newSession();showMessage('');
    const playback=playbackGeneration;
    state='loading';updateButtons();setAnnouncement('PLUGGING IN THE AMPS','TUNING UP…');
    try{
      ensureAudio();
      await audioContext.resume();master.gain.value=muted?0:volume;
      if(!song&&!musicBuffer)musicBuffer=await composeTrack(audioContext);
      if(playback!==playbackGeneration)return;
      // Close sheets before starting, including restart from the results screen.
      if($('resultDialog').open)$('resultDialog').close();
      const seek=practiceLoop?.start??(preview?Math.max(0,Math.min(offset,(song?.musicEnd??E.MUSIC_END)-.1)):0),lead=preview?0:4*trackBeat()/playRate;
      const audioStart=audioContext.currentTime+.15+lead;startTime=audioStart;transportSeek=seek;
      source=audioContext.createBufferSource();source.buffer=song?.buffer??musicBuffer;
      source.playbackRate.value=playRate;if(practiceLoop){source.loop=true;source.loopStart=practiceLoop.start;source.loopEnd=practiceLoop.end;}
      source.connect(master);source.start(audioStart,seek);
      if(!preview)for(let i=0;i<4;i++)countClick(audioStart-(4-i)*trackBeat()/playRate,i===3);
      else for(const n of session.notes)if(n.time<seek){n.hit=true;n.held=n.time+n.duration>seek;}
      state=preview?'playing':'countin';session.lastTime=preview?seek:seek-4*trackBeat();updateButtons();
      if(document.hidden)pause();
    }catch(err){
      if(playback!==playbackGeneration)return;
      state='idle';previewing=false;practiceLoop=null;playRate=1;stopAudio();updateButtons();setAnnouncement('AUDIO COULD NOT START','TRY AGAIN');
      showMessage('Sound could not start. Try Play track again, or open this game in a current Chrome, Edge, Firefox, or Safari browser.');
    }
  }
  function pause(){
    if(!running())return;frozenTime=currentTime();frozenInputTime=inputTime();previousState=state;state='paused';clearHeld();audioContext.suspend().catch(()=>{});updateButtons();
    setAnnouncement('TAKE A BREATHER','PAUSED');$('stageStatus').textContent='PAUSED';
  }
  async function resume(){
    if(state!=='paused')return;
    const playback=playbackGeneration;
    try{await audioContext.resume();if(state!=='paused'||playback!==playbackGeneration)return;state=previousState==='countin'?'countin':'playing';updateButtons();setAnnouncement('','',false);}catch{showMessage('Tap Resume track to enable sound.');}
  }
  function togglePause(){if(state==='paused')resume();else pause();}
  function reset(){
    stopAudio();state='idle';previewing=false;practiceLoop=null;playRate=1;newSession();
    $('resultDialog').close();setAnnouncement('YOUR STAGE IS WAITING','LET IT RIP.');updateButtons();updateUi(0);refreshBest();
  }
  function finish(){
    if(previewing){reset();setAnnouncement('PREVIEW COMPLETE','READY TO PLAY?');return;}
    if(finishScheduled)return;finishScheduled=true;state='finished';stopAudio();clearHeld();session.overdrive=false;updateButtons();updateUi(trackDuration());
    const accuracy=session.hits/session.notes.length*100,stars=accuracy>=95?5:accuracy>=85?4:accuracy>=70?3:accuracy>=50?2:accuracy>0?1:0;
    $('resultTitle').textContent=stars===5?'You brought the house down.':stars>=3?'Now that’s a show.':'That’s a wrap.';
    $('resultScore').textContent=Math.round(session.score).toLocaleString();$('resultAccuracy').textContent=`${Math.round(accuracy)}%`;
    $('resultStreak').textContent=session.bestStreak;$('resultPerfect').textContent=session.perfect;
    $('resultStars').innerHTML='★'.repeat(stars)+`<span>${'★'.repeat(5-stars)}</span>`;$('resultStars').setAttribute('aria-label',`${stars} out of 5 stars`);
    $('resultNotes').textContent=`${session.hits} of ${session.notes.length} notes hit · ${partName(instrument)} · ${D.NAMES[difficulty]} · ${instrument==='drums'?'Tap pads':instrument==='vocals'?'Pitch pads':mode==='tap'?'Tap frets':'Hold + strum'}`;
    const best=readBest(),isBest=session.score>best;$('newBest').hidden=!isBest;
    if(isBest){try{localStorage.setItem(bestKey(),String(session.score));}catch{}}
    refreshBest();setAnnouncement(song?'YOUR SONG':'IRON VOLTAGE','SESSION COMPLETE');$('resultDialog').showModal();
  }
  function laneDown(lane){
    if(previewing)return;
    if(lane>=D.frets(instrument,difficulty))return;if(held.has(lane))return;
    held.add(lane);fretButtons[lane].classList.add('active');flashes[lane]=Math.max(flashes[lane],.2);
    if(running()&&session.mode==='tap')session.tap(lane,inputTime());
  }
  function laneUp(lane){held.delete(lane);fretButtons[lane].classList.remove('active');session.release(lane);}
  function strum(){if(!previewing&&running()&&session.mode==='strum')session.strum(new Set(held),inputTime());}
  function kickDown(){if(previewing||instrument!=='drums'||held.has(E.KICK_LANE))return;held.add(E.KICK_LANE);$('kickButton').classList.add('active');flashes[E.KICK_LANE]=.3;if(running())session.tap(E.KICK_LANE,inputTime());}
  function kickUp(){held.delete(E.KICK_LANE);$('kickButton').classList.remove('active');}
  // Track each finger/key separately so releasing one cannot cancel another hold.
  function pressInput(id,lane){if(inputOwners.has(id))return;inputOwners.set(id,lane);if(instrument==='drums'&&held.has(lane)&&running()&&!previewing&&session.findTap(lane,inputTime())){session.tap(lane,inputTime());flashes[lane]=.6;return;}if(lane===E.KICK_LANE)kickDown();else laneDown(lane);}
  function releaseInput(id){if(!inputOwners.has(id))return;const lane=inputOwners.get(id);inputOwners.delete(id);if([...inputOwners.values()].includes(lane))return;if(lane===E.KICK_LANE)kickUp();else laneUp(lane);}
  function drive(){if(!previewing&&running()&&currentTime()>=0&&session.activate()){
    const el=$('streakCallout');el.textContent='OVERDRIVE ENGAGED';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');updateUi(currentTime());
  }}
  document.addEventListener('keydown',event=>{
    if($('timingDialog').open){if(event.code==='Space'){event.preventDefault();if(!event.repeat)calibrationTap();}return;}
    if($('helpDialog').open||$('resultDialog').open||$('libraryDialog').open||$('practiceDialog').open||$('offlineDialog').open)return;
    if(event.target?.tagName==='SELECT')return;
    const lane=E.KEYS.indexOf(event.code);
    if(lane>=0){event.preventDefault();if(!event.repeat)pressInput(`key:${event.code}`,lane);return;}
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)togglePause();return;}
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement)return;
    if(event.code==='Space'){event.preventDefault();if(!event.repeat){if(instrument==='drums')pressInput('key:Space',E.KICK_LANE);else drive();}}
    if(instrument==='drums'&&['ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();if(!event.repeat)drive();}
    if(event.code==='Enter'){event.preventDefault();if(!event.repeat){if(state==='idle'||state==='finished')play();else if(state==='paused')resume();else if(instrument==='drums')pressInput('key:Enter',E.KICK_LANE);else strum();}}
  });
  document.addEventListener('keyup',event=>{if(E.KEYS.includes(event.code)||event.code==='Enter'||event.code==='Space'){event.preventDefault();releaseInput(`key:${event.code}`);}});
  [...fretButtons,$('kickButton')].forEach((button,lane)=>{
    button.addEventListener('pointerdown',event=>{event.preventDefault();if(event.button>0)return;button.setPointerCapture(event.pointerId);pressInput(`pointer:${event.pointerId}`,lane);});
    const release=event=>releaseInput(`pointer:${event.pointerId}`);
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{if(event.detail===0){pressInput(`activate:${lane}`,lane);releaseInput(`activate:${lane}`);}});
  });
  $('touchStrum').addEventListener('pointerdown',event=>{event.preventDefault();strum();});
  $('touchStrum').addEventListener('click',event=>{if(event.detail===0)strum();});
  $('mobileBackButton').addEventListener('click',reset);
  $('mobilePlayButton').addEventListener('click',()=>play());
  $('playButton').addEventListener('click',event=>{event.currentTarget.blur();play();});
  $('uploadButton').addEventListener('click',()=>{$('songFile').click();});
  $('songFile').addEventListener('change',()=>uploadSong($('songFile').files[0]));
  $('cancelUpload').addEventListener('click',cancelUpload);
  $('rechartButton').addEventListener('click',()=>chooseInstrument(instrument,true));
  $('demoButton').addEventListener('click',useDemo);
  $('previewButton').addEventListener('click',event=>{event.currentTarget.blur();if(previewing)reset();else if(song)play({preview:true,offset:Number($('previewPosition').value)});});
  $('previewPosition').addEventListener('input',()=>{$('previewTime').textContent=formatTime(Number($('previewPosition').value));});
  $('previewPosition').addEventListener('change',()=>{if(previewing&&!busy())play({preview:true,offset:Number($('previewPosition').value)});});
  $('pauseButton').addEventListener('click',event=>{event.currentTarget.blur();togglePause();});
  $('driveButton').addEventListener('click',event=>{event.currentTarget.blur();drive();});
  $('replayButton').addEventListener('click',()=>{$('resultDialog').close();state='finished';play();});
  $('backButton').addEventListener('click',reset);
  $('resultDialog').addEventListener('cancel',event=>{event.preventDefault();reset();});
  $('helpButton').addEventListener('click',()=>{if(running())pause();$('helpDialog').showModal();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  document.querySelectorAll('input[name=difficulty]').forEach(input=>input.addEventListener('change',()=>{
    if(active())return;difficulty=input.value;newSession();refreshInstrument();updateUi(0);
  }));
  document.querySelectorAll('input[name=mode]').forEach(input=>input.addEventListener('change',()=>{
    if(active())return;mode=input.value;newSession();refreshInstrument();updateUi(0);
  }));
  for(const name of ['instrument','chartTarget'])document.querySelectorAll(`input[name=${name}]`).forEach(input=>input.addEventListener('change',()=>chooseInstrument(input.value)));
  $('chartScope').addEventListener('change',refreshChartScope);
  for(const part of PARTS)$('part'+partName(part)).addEventListener('change',refreshChartScope);
  $('buildPartsButton').addEventListener('click',buildSelectedParts);
  function setVolume(){if(master)master.gain.setTargetAtTime(muted?0:volume,audioContext.currentTime,.02);$('volume').value=Math.round((muted?0:volume)*100);$('muteButton').textContent=muted||volume===0?'♪':'♫';$('muteButton').setAttribute('aria-label',muted||volume===0?'Unmute sound':'Mute sound');}
  $('volume').addEventListener('input',event=>{volume=Number(event.target.value)/100;muted=volume===0;setVolume();});
  $('muteButton').addEventListener('click',()=>{if(muted||volume===0){muted=false;volume=preMute||.7;}else{preMute=volume;muted=true;}setVolume();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('blur',()=>{pause();clearHeld();});

  function updateUi(t){
    $('score').textContent=Math.floor(session.score).toLocaleString('en-US',{minimumIntegerDigits:6});$('streak').textContent=session.streak;
    $('multiplier').innerHTML=`${session.multiplier}<small>×</small>`;$('bestStreak').textContent=session.bestStreak;
    $('accuracy').textContent=session.hits+session.misses?`${Math.round(session.accuracy)}%`:'—';
    $('crowdFill').style.width=`${session.energy}%`;$('crowdLabel').textContent=session.energy>80?'ROARING':session.energy>35?'STEADY':'KEEP GOING';
    const charge=session.charge;$('driveBars').querySelectorAll('i').forEach((bar,i)=>bar.classList.toggle('filled',charge>i*12.5));
    $('driveButton').disabled=previewing||!running()||t<0||charge<50||session.overdrive;
    $('driveText').textContent=session.overdrive?'OVERDRIVE ON':charge>=50?'ACTIVATE':`CHARGING · ${Math.floor(charge)}%`;
    $('driveHint').textContent=session.overdrive?'Keep the streak alive. Your multiplier is doubled.':charge>=50?'Ready to unleash. Hit Space or tap below.':'Hit notes to charge. Double your multiplier.';
    document.body.classList.toggle('is-overdrive',session.overdrive);
    $('elapsed').textContent=formatTime(Math.min(trackDuration(),Math.max(0,t)));$('remaining').textContent=formatTime(trackDuration());
    $('songProgress').style.width=`${Math.max(0,Math.min(100,t/trackDuration()*100))}%`;
    $('section').textContent=state==='idle'?'READY TO ROCK':state==='analyzing'?'AUTO CHARTING':state==='paused'?'PAUSED':state==='countin'?'GET READY':previewing?'CHART PREVIEW':practiceLoop?`PRACTICE · PASS ${practicePass}`:song?'YOUR SONG':E.sectionAt(t);
    $('stageStatus').textContent=state==='analyzing'?'CHARTING SONG':state==='idle'?'SOUNDCHECK':state==='loading'?'TUNING UP':state==='paused'?'PAUSED':state==='finished'?'SET COMPLETE':previewing?'PREVIEW · AUTO PLAY':state==='countin'?'GET READY':practiceLoop?`PRACTICE ${Math.round(playRate*100)}% · ${practicePass}`:session.overdrive?'OVERDRIVE':'LIVE SESSION';
  }

  function geometry(){return {top:mobileViewport.matches?Math.max(48,height*.2):height*.37,target:padTarget,topWidth:width*(instrument==='drums'?.2:.16),bottomWidth:padWidth};}
  let geo={top:100,target:500,topWidth:80,bottomWidth:400};
  function point(lane,z){const w=geo.topWidth+(geo.bottomWidth-geo.topWidth)*z;return{x:width/2+(lane-2)*w/5,y:geo.top+(geo.target-geo.top)*z,w:w/5};}
  function quad(lane,a,b,fill,inset=0){const p=point(lane,a),q=point(lane,b);ctx.beginPath();ctx.moveTo(p.x-p.w/2+inset,p.y);ctx.lineTo(p.x+p.w/2-inset,p.y);ctx.lineTo(q.x+q.w/2-inset,q.y);ctx.lineTo(q.x-q.w/2+inset,q.y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function lineAt(z,alpha,thickness=1){const l=point(0,z),r=point(4,z);ctx.beginPath();ctx.moveTo(l.x-l.w/2,l.y);ctx.lineTo(r.x+r.w/2,r.y);ctx.strokeStyle=`rgba(197,212,214,${alpha})`;ctx.lineWidth=thickness;ctx.stroke();}
  function noteHead(lane,z,color,opacity=1){
    const p=point(lane,z),rx=p.w*.36;
    const drums=instrument==='drums',cymbal=drums&&(lane===1||lane===3);
    // Low, raised gems on a silver oval rim, matching the reference's profile.
    ctx.save();ctx.globalAlpha=opacity;ctx.translate(p.x,p.y);ctx.scale(rx,rx);
    const oval=(x,y,w,h,fill)=>{ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();};
    oval(0,.14,1.08,.34,'#05080cbb');
    const edge=ctx.createLinearGradient(0,-.08,0,.4);
    edge.addColorStop(0,'#1b2229');edge.addColorStop(.48,'#8b969c');edge.addColorStop(.7,'#e1e6df');edge.addColorStop(1,'#343c45');
    oval(0,.08,1,.31,edge);
    const rim=ctx.createLinearGradient(-.8,-.3,.7,.3);
    rim.addColorStop(0,'#f8fff1');rim.addColorStop(.24,'#89979a');rim.addColorStop(.46,'#eff5e7');rim.addColorStop(.7,'#707c84');rim.addColorStop(1,'#e4eddd');
    oval(0,0,1,.3,rim);oval(0,-.015,.89,.235,'#18251e');
    const body=ctx.createLinearGradient(0,-.45,0,.21);
    body.addColorStop(0,'#eaffdf');body.addColorStop(.18,color);body.addColorStop(.6,color);body.addColorStop(1,'#14251d');
    ctx.beginPath();ctx.moveTo(-.86,.015);
    ctx.bezierCurveTo(-.77,-.19,-.62,-.39,-.4,-.42);
    ctx.bezierCurveTo(-.2,-.47,.2,-.47,.4,-.42);
    ctx.bezierCurveTo(.62,-.39,.77,-.19,.86,.015);
    ctx.bezierCurveTo(.6,.23,-.6,.23,-.86,.015);ctx.closePath();ctx.fillStyle=body;ctx.fill();
    // A flat crown and angled reflections give the colored cap a beveled face.
    const crown=ctx.createLinearGradient(-.5,-.3,.5,-.18);
    crown.addColorStop(0,'#143420');crown.addColorStop(.32,color);crown.addColorStop(.72,color);crown.addColorStop(1,'#ffffffc9');
    oval(0,-.3,.57,.145,crown);
    ctx.beginPath();ctx.moveTo(-.57,-.32);ctx.lineTo(-.35,-.41);ctx.lineTo(-.19,-.1);ctx.lineTo(-.38,-.04);ctx.closePath();ctx.fillStyle='#efffe5b3';ctx.fill();
    ctx.beginPath();ctx.moveTo(.19,-.43);ctx.lineTo(.39,-.4);ctx.lineTo(.61,-.1);ctx.lineTo(.37,-.04);ctx.closePath();ctx.fillStyle='#ffffffa6';ctx.fill();
    ctx.beginPath();ctx.ellipse(0,-.025,.82,.205,0,.08,Math.PI-.08);ctx.strokeStyle=color;ctx.lineWidth=.06;ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,.055,.96,.27,0,.12,Math.PI-.12);ctx.strokeStyle='#f0f6e4';ctx.lineWidth=.045;ctx.stroke();
    if(cymbal)oval(0,-.34,.12,.065,'#fff8da');
    ctx.restore();
  }
  function kickNote(z,opacity=1){
    const l=point(0,z),r=point(4,z),left=l.x-l.w*.43,right=r.x+r.w*.43,thickness=Math.max(2,7*z);
    ctx.save();ctx.globalAlpha=opacity;ctx.shadowColor=E.KICK_COLOR;ctx.shadowBlur=14*z;
    const g=ctx.createLinearGradient(0,l.y-thickness,0,l.y+thickness);g.addColorStop(0,'#efe0ff');g.addColorStop(.3,E.KICK_COLOR);g.addColorStop(1,'#5c257e');
    ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(left,l.y-thickness/2,right-left,thickness,thickness/2);ctx.fill();
    ctx.fillStyle='#fff0ff';ctx.beginPath();ctx.roundRect(left+thickness/2,l.y-thickness/2,right-left-thickness,Math.max(1,z),Math.max(.5,z/2));ctx.fill();ctx.restore();
  }
  function draw(t,dt,now){
    ctx.clearRect(0,0,width,height);if(!width||!height)return;
    geo=geometry();
    const isIdle=state==='idle'||state==='loading'||state==='analyzing'||state==='finished';
    const idleStart=song?Math.max(0,(idleNotes[0]?.time??0)-1):3,visualTime=isIdle?(reducedMotion?idleStart+1:(now/1000*.52)%10+idleStart):t;
    const approach=D.APPROACH[difficulty]/highwaySpeed*playRate;
    const beatDuration=trackBeat(),beatOffset=song?.offset??0,musicBeat=Math.max(0,visualTime-beatOffset)/beatDuration,beatPulse=1-(musicBeat%1);
    const leftTop=point(0,0),rightTop=point(4,0),leftBottom=point(0,1.18),rightBottom=point(4,1.18);
    const drums=instrument==='drums';
    const gradient=ctx.createLinearGradient(0,geo.top,0,height);gradient.addColorStop(0,drums?'#08090d':'#141a20');gradient.addColorStop(.6,drums?'#09090c':'#171d23');gradient.addColorStop(1,'#080a0e');
    ctx.beginPath();ctx.moveTo(leftTop.x-leftTop.w/2,geo.top);ctx.lineTo(rightTop.x+rightTop.w/2,geo.top);ctx.lineTo(rightBottom.x+rightBottom.w/2,rightBottom.y);ctx.lineTo(leftBottom.x-leftBottom.w/2,leftBottom.y);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    for(let lane=0;lane<5;lane++){
      if(!drums&&lane%2===0)quad(lane,0,1.18,'#ffffff03');
      if(held.has(lane)||flashes[lane]>.01){const g=ctx.createLinearGradient(0,geo.top,0,geo.target);g.addColorStop(0,laneColor(lane)+'00');g.addColorStop(1,laneColor(lane)+(held.has(lane)?'38':'25'));quad(lane,0,1.1,g);}
      if(lane>=D.frets(instrument,difficulty))quad(lane,0,1.18,'#0009');
    }
    // Perspective strings and outer rails are part of the playable highway.
    for(let i=0;i<=5;i++){
      if(drums&&i>0&&i<5)continue;
      const topX=width/2+(i-2.5)*geo.topWidth/5,bottomX=width/2+(i-2.5)*(geo.topWidth+(geo.bottomWidth-geo.topWidth)*1.18)/5;
      ctx.beginPath();ctx.moveTo(topX,geo.top);ctx.lineTo(bottomX,leftBottom.y);ctx.lineWidth=i===0||i===5?2:1;ctx.strokeStyle=drums?'#bdc6d0':i===0||i===5?'#68747d':'#77889925';ctx.stroke();
      if(i===0||i===5){ctx.beginPath();ctx.moveTo(topX+(i===0?-4:4),geo.top);ctx.lineTo(bottomX+(i===0?-9:9),leftBottom.y);ctx.lineWidth=3;ctx.strokeStyle=session.overdrive?'#d8ef6955':'#8ca0b333';ctx.stroke();}
    }
    for(let beat=Math.floor((visualTime-beatOffset)/beatDuration)-1;beat<(visualTime+approach-beatOffset)/beatDuration+1;beat++){
      const p=1-(beat*beatDuration+beatOffset-visualTime)/approach;if(p<0||p>1.08)continue;lineAt(p*p,beat%4===0?.24:.09,beat%4===0?2:1);
    }
    const notes=state==='analyzing'?[]:isIdle?idleNotes:T.visibleNotes(session.notes,practiceLoop,visualTime,approach);
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];if(n.missed)continue;
      const p=1-(n.time-visualTime)/approach;if(p<0||p>1.13&&!n.held)continue;
      const z=Math.max(0,p*p),color=session.overdrive&&!drums?'#e8ff65':laneColor(n.lane);
      if(drums&&n.lane===E.KICK_LANE){if(!n.hit)kickNote(z,isIdle?.8:1);continue;}
      if(n.duration&&(!n.hit||n.held)){
        const endP=1-(n.time+n.duration-visualTime)/approach,startZ=n.hit?1:Math.min(1.14,z),endZ=Math.max(0,endP*endP);
        if(endP>=0&&endZ<startZ){const a=point(n.lane,startZ),b=point(n.lane,endZ);ctx.beginPath();ctx.moveTo(a.x-a.w*.085,a.y);ctx.lineTo(a.x+a.w*.085,a.y);ctx.lineTo(b.x+b.w*.085,b.y);ctx.lineTo(b.x-b.w*.085,b.y);ctx.closePath();ctx.fillStyle=color+'a0';ctx.fill();}
      }
      if(n.hit)continue;noteHead(n.lane,z,color,isIdle?(drums?.85:.55):1);
    }
    lineAt(1,session.overdrive?.95:.55,2);
    const center=point(2,1);const glow=ctx.createRadialGradient(width/2,center.y,10,width/2,center.y,width*.48);glow.addColorStop(0,session.overdrive?'#e8ff6525':`rgba(194,221,162,${.06+beatPulse*.04})`);glow.addColorStop(1,'#e8ff6500');ctx.fillStyle=glow;ctx.fillRect(0,center.y-45,width,90);
    for(let lane=0;lane<5;lane++){if(flashes[lane]>.02){const p=point(lane,1);ctx.fillStyle=laneColor(lane);ctx.globalAlpha=flashes[lane]*.7;ctx.beginPath();ctx.ellipse(p.x,p.y-10,p.w*.29,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}flashes[lane]=Math.max(0,flashes[lane]-dt*4);}
    if(drums&&flashes[E.KICK_LANE]>.02)kickNote(1,flashes[E.KICK_LANE]*.6);flashes[E.KICK_LANE]=Math.max(0,flashes[E.KICK_LANE]-dt*4);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.age>p.life){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;const origin=point(p.lane===E.KICK_LANE?2:p.lane,1);ctx.globalAlpha=1-p.age/p.life;ctx.fillStyle=p.color;ctx.fillRect(origin.x+p.x,origin.y+p.y-10,p.size,p.size*(drums?4:2.5));}ctx.globalAlpha=1;
    // A localized fade keeps the far end of the highway distinct without hiding the band.
    const fog=ctx.createLinearGradient(0,geo.top-7,0,geo.top+35);fog.addColorStop(0,'#080a1077');fog.addColorStop(1,'#080a1000');ctx.fillStyle=fog;ctx.fillRect(width/2-geo.topWidth*.6,geo.top-7,geo.topWidth*1.2,42);
  }
  function frame(now){
    const dt=Math.min(.06,(now-lastFrame)/1000||.016);lastFrame=now;const t=currentTime();
    if(running()){
      if(state==='countin'&&t<transportSeek&&!previewing){setAnnouncement('COUNT IT IN',String(Math.min(4,Math.ceil((transportSeek-t)/trackBeat()))),true,true);}
      else{
        if(practiceLoop){const cycle=gameTransport().cycle;if(cycle>loopCycle){const hits=session.hits,total=session.notes.length;loopCycle=cycle;practicePass=cycle+1;newSession();session.lastTime=practiceLoop.start;$('practiceStatus').textContent=`Last pass: ${hits} of ${total} notes hit. Pass ${practicePass} is playing.`;}}
        if(state==='countin'){state='playing';updateButtons();}setAnnouncement('','',false);
        if(previewing){for(const n of session.notes){if(!n.hit&&t>=n.time){n.hit=true;flashes[n.lane]=1;}if(n.hit)n.held=n.duration>0&&t<n.time+n.duration;}}
        else session.update(inputTime(),held);
        if(!practiceLoop&&t>=trackDuration())finish();
      }
    }
    band.draw({time:state==='finished'?trackDuration():t,wallTime:now/1000,state,energy:session.energy,streak:session.streak,overdrive:session.overdrive,instrument,reducedMotion,beatDuration:trackBeat(),duration:trackDuration(),percussion:song?.percussion??null});
    draw(inputTime(),dt,now);if(now-lastUi>70){updateUi(state==='finished'?trackDuration():t);lastUi=now;}requestAnimationFrame(frame);
  }
  renderSetlist();refreshSetlist();newSession();refreshSong();updateUi(0);resize();requestAnimationFrame(frame);
})();
