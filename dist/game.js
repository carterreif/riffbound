/* Riffbound: local audio gameplay with optional community-chart lookup. */
(() => {
  'use strict';
  const E=window.RiffEngine,T=window.RiffPlayback,Library=window.RiffLibrary, $=id=>document.getElementById(id);
  const D=E.Difficulties;
  const Exchange=window.RiffChartExchange,ChartTiming=window.RiffChartTiming,Midi=window.RiffMidiChart;
  const PublicDemos=window.RiffPublicDemos,AuthoredReuse=window.RiffAuthoredReuse;
  const Community=window.RiffCommunityCharts;
  const SheetMusic=window.RiffSheetMusic;
  const Recording=window.RiffRecordingAlignment;
  const SongAudio=window.RiffSongAudio;
  const PartCharts=window.RiffPartCharts;
  const Sections=window.RiffSongSections;
  const PARTS=['guitar','drums','bass','vocals'],partName=part=>({guitar:'Guitar',drums:'Drums',bass:'Bass',vocals:'Vocals'}[part]||part);
  const canvas=$('highway'), ctx=canvas.getContext('2d');
  const band=window.RiffStage.create($('performance'));
  const fretButtons=[...document.querySelectorAll('[data-lane]')];
  let state='idle', previousState='idle', difficulty='medium', mode='tap', instrument='guitar', session=new E.Session(), held=new Set();
  let audioContext=null, master=null, musicBuffer=null, source=null, startTime=0, frozenTime=0;
  let song=null,uploadGeneration=0,playbackGeneration=0,cancelAnalysis=null,cancelLookup=null,previewing=false;
  let transportSeek=0,playRate=1,practiceLoop=null,loopCycle=0,practicePass=1,frozenInputTime=0;
  let videoChartStart=Infinity,resuming=false;
  let lastMissTime=null,trainingContext='',trainingNotes=null;
  let practiceSections=[],practiceSectionsOwner='';
  const videoPosition=time=>Math.max(0,time-videoChartStart);
  let calibrationTest=null,calibrationTimer=null;
  let controllerInput=null,controllerFocused=true,audioDrums=null,audioDrumRun=false;
  let setlistSongs=[],setlistGeneration=0,setlistError='',savedVideoIds=new Set(),linkedVideoIds=new Set();
  let pendingSaves=0,reconnectingAudio=false,savedSong=null,saveSerial=0,importingBackup=false;
  let chartDraft=null,chartReviewGeneration=0;
  let backupExport=null,backupSaving=false,backupTransfer=null;
  let exportingVideo=false,savingSetlistVideo=false;
  let communityLookup=true,sheetMusicLookup=true,uploadInstrument='guitar',uploadTargetExplicit=false,pendingUpload=null;
  let timingOffset=0,highwaySpeed=1,volume=.7,muted=false,preMute=.7,showHitTiming=true;
  try{const saved=JSON.parse(localStorage.getItem('riffbound-preferences-v1')||'{}');timingOffset=Math.max(-250,Math.min(250,Number(saved.timingOffset)||0));highwaySpeed=Math.max(.7,Math.min(1.6,Number(saved.highwaySpeed)||1));
    if(typeof saved.showHitTiming==='boolean')showHitTiming=saved.showHitTiming;
    if(typeof saved.volume==='number'&&Number.isFinite(saved.volume))volume=Math.max(0,Math.min(1,saved.volume));
    if(typeof saved.preMute==='number'&&Number.isFinite(saved.preMute)&&saved.preMute>0)preMute=Math.min(1,saved.preMute);else if(volume>0)preMute=volume;
    muted=saved.muted===true||volume===0;communityLookup=saved.communityLookup!==false;sheetMusicLookup=saved.sheetMusicLookup!==false;
    if(PARTS.includes(saved.uploadInstrument)){uploadInstrument=saved.uploadInstrument;uploadTargetExplicit=true;}
  }catch{}
  const countNodes=[];
  let width=0,height=0,lastFrame=0,lastUi=0;
  const particles=[],flashes=[0,0,0,0,0,0],inputOwners=new Map();
  const mobileViewport=window.matchMedia('(max-width: 850px), (pointer: coarse) and (max-width: 1180px)');
  let padTarget=0,padWidth=0;
  const fourLaneDrums=()=>instrument==='drums'&&D.drumPlayLayout(song?.quality)==='four';
  const highwayLanes=()=>fourLaneDrums()?4:5;
  const laneColor=lane=>instrument==='drums'?(lane===E.KICK_LANE?E.KICK_COLOR:E.DRUM_COLORS[fourLaneDrums()&&lane===3?4:lane]):E.COLORS[lane];
  let idleNotes=E.makeChart('medium'), judgeTimer=0, lastAnnounce='', finishScheduled=false;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const formatTime=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  const practicePercent=accuracy=>accuracy===100?100:Math.min(99.9,Math.round(accuracy*10)/10);
  const running=()=>state==='playing'||state==='countin';
  const busy=()=>state==='loading'||state==='analyzing'||reconnectingAudio||savingSetlistVideo;
  const active=()=>running()||state==='paused'||busy();
  const transport=()=>T.position(window.RiffAudioClock.audibleTime(audioContext,performance.now()),startTime,transportSeek,playRate,practiceLoop?.repeat?practiceLoop:null);
  const gameTransport=()=>T.position(window.RiffAudioClock.audibleTime(audioContext,performance.now())-(previewing?0:timingOffset/1000),startTime,transportSeek,playRate,practiceLoop?.repeat?practiceLoop:null);
  const currentTime=()=>running()?transport().time:state==='paused'?frozenTime:0;
  const inputTime=()=>running()?gameTransport().time:state==='paused'?frozenInputTime:0;
  const trackDuration=()=>song?.duration??E.DURATION,trackBeat=()=>song?.beat??E.BEAT;
  const finishedPosition=()=>practiceLoop?.end??trackDuration();
  const notesForLevel=level=>{const notes=song.charts[instrument][level];return instrument==='drums'?D.playDrums(notes,song.quality,{reference:song.charts.drums.expert,beat:song.beat}):notes;};
  const chartNotes=()=>song?notesForLevel(difficulty):E.makeChart(difficulty,instrument);
  let fretCacheNotes=null,fretCacheCount=0;
  const playableFrets=()=>{
    if(fourLaneDrums())return 4;
    const base=D.frets(instrument,difficulty);if(!song?.quality?.imports?.[instrument]?.levels?.includes(difficulty))return base;
    const notes=chartNotes();if(notes!==fretCacheNotes){fretCacheNotes=notes;fretCacheCount=notes.reduce((max,n)=>Math.max(max,n.lane+1),0);}return Math.max(base,fretCacheCount);
  };
  const effectiveMode=()=>['drums','vocals'].includes(instrument)?'tap':mode;
  const bestBaseKey=()=>song?.quality?.imports?.[instrument]?`riffbound-import-${song.id}-${song.quality.imports[instrument].id}-${instrument}-${difficulty}-${effectiveMode()}`:song?.quality?.scoreReview&&instrument==='drums'&&(song.quality.preserveEasyMedium===false||['expert','hard'].includes(difficulty))?`riffbound-${song.quality.scoreReference||'inbloom'}-score-v${song.quality.scoreRevision||2}-${song.id}-${difficulty}-${effectiveMode()}`:difficulty==='expert'?(song?`riffbound-upload-${instrument==='drums'?'v5':'v3'}-${song.id}-${instrument}-expert-${effectiveMode()}`:instrument==='guitar'?`riffbound-best-v1-expert-${mode}`:`riffbound-best-v2-${instrument}-expert-${effectiveMode()}`):`riffbound-difficulty-v1-${song?.id||'demo'}-${instrument}-${difficulty}-${effectiveMode()}`;
  const bestKey=()=>bestBaseKey()+(instrument==='drums'&&audioDrumRun?'-audio-drums-v1':'')+(fourLaneDrums()?'-four-drums-v1':instrument==='drums'?'-separate-five-drums-v2':'')+(song?.quality?.chartAdjustments?.[instrument]?`-shift-${song.quality.chartAdjustments[instrument]}`:'');
  function readBest(){try{return Number(localStorage.getItem(bestKey())||0);}catch{return 0;}}
  function refreshBest(){const n=readBest();$('localBest').textContent=n?n.toLocaleString():'—';}
  function setAnnouncement(small,big,visible=true,countdown=false){
    const key=[small,big,visible,countdown].join('|');if(lastAnnounce===key)return;lastAnnounce=key;
    $('announceSmall').textContent=small;$('announceBig').textContent=big;$('announcement').classList.toggle('invisible',!visible);$('announcement').classList.toggle('countdown',countdown);
  }
  function showMessage(text){$('statusMessage').textContent=text;}
  const canSwitchPreview=()=>previewing&&running()&&!!song;
  const canSwitchPlayback=()=>running()||state==='paused';
  const hasPlayablePart=part=>song?!!song.charts[part]?.expert?.length:['guitar','drums','bass'].includes(part);
  function refreshPlayableParts(){
    $('playParts').hidden=!song;
    for(const part of PARTS){
      const ready=!!song?.charts[part]?.expert?.length,button=$('playPart'+partName(part));
      button.disabled=!ready||busy();button.setAttribute('aria-pressed',String(ready&&instrument===part));
      $('playPart'+partName(part)+'Count').textContent=ready?`${song.charts[part][difficulty]?.length||0} notes · ${D.NAMES[difficulty]}`:'No chart';
    }
    const missing=PARTS.filter(part=>song?.quality?.unavailable?.[part]&&!song.charts[part]);
    $('playPartStatus').textContent=song?`${partName(instrument)} · ${D.NAMES[difficulty]} selected. Choose a part, then Preview chart or Play track.`+(song.quality?.imports?.[instrument]?' Using this instrument’s authored chart.':' Using an audio estimate for this instrument; overlapping sounds can be misidentified.')+(missing.length?` No playable chart for ${missing.map(partName).join(', ')}. Try an authored chart or isolated audio for that part.`:''):'';
  }
  function updateButtons(){
    if($('pauseResume')){$('pauseResume').disabled=resuming;$('pauseResume').textContent=resuming?'Resuming…':practiceLoop?'Resume practice':previewing?'Resume preview':'Resume song';}
    if($('pausePractice'))$('pausePractice').disabled=resuming||song?.chartOnly===true;
    for(const id of ['pauseDifficultyToggle','pauseApplyDifficulty'])if($(id))$(id).disabled=resuming;
    for(const id of ['savePracticeSection','removePracticeSection'])if($(id))$(id).disabled=!Sections||!song||busy()||pendingSaves>0;
    if($('retryButton')){$('retryButton').disabled=busy()||!['playing','countin','paused','finished'].includes(state);$('retryButton').setAttribute('aria-label',practiceLoop?'Retry practice section (R)':'Retry track (R)');}
    if($('practiceMissButton'))$('practiceMissButton').disabled=!T.missedSection?.(lastMissTime,song?.musicEnd??E.MUSIC_END)||previewing||song?.chartOnly===true;
    if($('backgroundButton'))$('backgroundButton').disabled=busy();
    if($('backgroundExportVideo'))$('backgroundExportVideo').disabled=busy()||exportingVideo||!song||!window.RiffBackground?.hasVideo;
    if($('backgroundSaveSetlist'))$('backgroundSaveSetlist').disabled=busy()||exportingVideo||!song||!window.RiffBackground?.hasVideo;
    $('difficultyGroup').disabled=active();$('modeGroup').disabled=active()||['drums','vocals'].includes(instrument);$('instrumentGroup').disabled=busy();
    if($('drumPlayLayout'))$('drumPlayLayout').disabled=active()||pendingSaves>0;
    document.querySelectorAll('input[name=instrument]').forEach(input=>input.disabled=canSwitchPlayback()&&!hasPlayablePart(input.value));
    refreshPlayableParts();
    $('loadKingNothingDrums').disabled=!song||active()||pendingSaves>0;
    $('knownDrumChart').hidden=!song||instrument!=='drums';
    // Older cached pages can load a newer script before their HTML updates.
    // Optional repair controls must not disable the core instrument tabs.
    if($('drumRepairTools'))$('drumRepairTools').hidden=!song||instrument!=='drums';
    if($('repairDrumsButton'))$('repairDrumsButton').disabled=!song||active()||pendingSaves>0;
    $('chartTargetGroup').disabled=busy();$('chartScope').disabled=active();$('partsGroup').disabled=active();$('buildPartsButton').disabled=active();
    for(const id of ['addCommunityLookup','addSheetMusicLookup','addScoreFile','addLookupTitle','addLookupArtist'])$(id).disabled=active();
    $('rechartButton').disabled=active()||song?.chartOnly===true;$('findAuthoredChart').disabled=!song||active()||pendingSaves>0||!Community;$('practiceButton').disabled=busy()||song?.chartOnly===true;$('timingButton').disabled=busy();$('libraryButton').disabled=busy();
    $('saveCurrentButton').disabled=!song||busy()||pendingSaves>0;$('exportCurrentButton').disabled=!song||busy()||(!song.chartOnly&&!Library.audioStatus(song?.audioBlob).ok);
    $('reconnectAudioButton').disabled=!song||busy()||pendingSaves>0;$('importBackupButton').disabled=busy();
    for(const id of ['addSongButton','libraryAddSong'])$(id).disabled=active()||pendingSaves>0||importingBackup;
    const hasNewAudio=!!$('addSongFile').files?.length,hasScore=!!$('addScoreFile').files?.length,reuseOpenAudio=canReuseOpenAudio()&&!$('addLookupTitle').value.trim()&&!$('addLookupArtist').value.trim(),searchByName=!!$('addLookupTitle').value.trim()&&!!$('addLookupArtist').value.trim();
    $('confirmAddSong').disabled=active()||pendingSaves>0||importingBackup||(!hasNewAudio&&!reuseOpenAudio&&!searchByName&&!hasScore);
    $('confirmAddSong').textContent=!hasNewAudio&&!reuseOpenAudio&&hasScore&&!searchByName?'Convert score & add to setlist':!hasNewAudio&&searchByName?'Find chart & audio':!hasNewAudio&&reuseOpenAudio?'Chart open song':'Chart & add to setlist';
    if($('addSongAudioHint'))$('addSongAudioHint').textContent=hasNewAudio?'The selected file will be added as a song.':hasScore&&!reuseOpenAudio?'Score selected. Available parts can be saved without audio; attach matching audio later for song playback.':searchByName?'Finds matching charts and song audio. Missing parts can be estimated from that audio. No audio upload needed.':reuseOpenAudio?`Leave title and artist blank to reuse “${song.title}”, or enter both to find a different song’s chart.`:'No file needed: enter song title and artist below to find its chart and audio.';
    $('setlistRetrySave').disabled=!song||busy()||pendingSaves>0;
    $('setlistExportBackup').disabled=!song||busy()||(!song.chartOnly&&!Library.audioStatus(song?.audioBlob).ok);
    $('setlistUploadProgress').hidden=state!=='analyzing';
    for(const id of ['songChartShift','applySongChartShift','resetSongChartShift','applyTimingSuggestion'])$(id).disabled=!song||(active()&&!canSwitchPreview())||pendingSaves>0||!ChartTiming;
    $('reviewSongTiming').disabled=!song||song.chartOnly===true||active()||pendingSaves>0||!ChartTiming;
    $('chartFilesButton').disabled=busy();
    for(const id of ['authoredChartFile','chartIniFile','chartAudioMode','chartAudioFile','chartDrumLayout','chartShift','reviewChartButton'])$(id).disabled=busy();
    $('loadChartButton').disabled=busy()||pendingSaves>0||!chartDraft;
    const exportable=!!song&&['guitar','bass','drums'].some(part=>song.charts[part]);
    $('exportChartButton').disabled=busy()||!exportable;$('exportChartIniButton').disabled=busy()||!exportable;
    $('exportChartAudioButton').disabled=busy()||!song||!Library.audioStatus(song?.audioBlob).ok;
    for(const part of PARTS)$('libraryUpload'+partName(part)).disabled=active();
    $('saveCurrentButton').textContent=pendingSaves?'Saving…':'Save current song';
    updateSetlistSelection();
    $('pauseButton').disabled=!running()&&state!=='paused';
    $('playButton').disabled=busy()||song?.chartOnly===true||(!song&&instrument==='vocals');
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
  function clearHeld(){controllerInput?.reset();held.clear();inputOwners.clear();fretButtons.forEach(b=>b.classList.remove('active'));$('kickButton').classList.remove('active');session.notes.forEach(n=>n.held=false);}
  function refreshInstrument(){
    const drums=instrument==='drums',vocals=instrument==='vocals',four=fourLaneDrums();
    if($('drumLayoutSettings')){
      $('drumLayoutSettings').hidden=!drums||!song?.charts.drums;
      $('drumPlayLayout').value=D.drumPlayLayout(song?.quality);
      $('drumPlayLayoutHint').textContent='Choose before playing. Saved with this song. '+(D.drumLayout(song?.quality)==='four'?'Five-lane play separates Orange cymbals from Green floor toms. Pro markers guide the split when saved; four-pad charts without markers use an estimated conversion. Preview to check colors.':'Four-lane play combines the five-lane source into Red, Yellow, Blue and Green. Switching back restores all original notes.');
    }
    if(!uploadTargetExplicit)uploadInstrument=instrument;
    document.querySelectorAll('input[name=instrument]').forEach(input=>input.checked=input.value===instrument);
    document.querySelectorAll('input[name=chartTarget]').forEach(input=>input.checked=input.value===uploadInstrument);
    refreshChartScope();
    document.body.classList.toggle('is-drums',drums);$('modeGroup').hidden=drums||vocals;
    document.body.classList.toggle('four-lane-drums',four);
    document.body.classList.toggle('is-strum',!drums&&!vocals&&mode==='strum');
    $('modeHint').textContent=mobileViewport.matches?(drums?'Tap each matching drum pad. Orange cymbals and Green floor toms are separate. Tap Kick pedal for the wide purple bars.':mode==='tap'?'Tap the matching colored pads as notes reach the rings. Hold for long notes.':'Hold the matching colored pads, then tap Strum with another finger.'):(drums?'D F J K L hit five separate pads. K is Orange cymbal; L is Green floor tom. Space or Enter plays the wide purple kick bars. Shift activates Overdrive.':mode==='tap'?'Press a fret key as its note hits the line.':'Hold the fret keys. Press Enter to strum.');
    $('touchStrum').hidden=drums||vocals||mode!=='strum';$('strumGuide').hidden=drums||vocals||mode!=='strum';$('drumLabels').hidden=!drums;$('kickButton').hidden=!drums;$('kickGuide').hidden=!drums;
    $('controlType').textContent=drums?'Pads':vocals?'Pitch pads':'Frets';$('driveKey').textContent=drums?'SHIFT':'SPACE';$('overdriveKey').textContent=drums?'SHIFT':'SPACE';$('hitLineLabel').textContent=drums?'HIT THE DRUM AT THE PAD LINE':'HIT THE NOTE AT THE FRET LINE';
    canvas.setAttribute('aria-label',drums?'Five drum lanes from left to right: D red snare, F yellow closed or open hi-hat, J blue tom, K orange cymbal, L green floor tom. Orange and Green need separate hits, including when they arrive together. Space or Enter plays purple kick bars across the highway.':'Notes scroll down five colored lanes toward the fret line. Use D, F, J, K, and L or the touch buttons below.');
    if(four){$('modeHint').textContent=mobileViewport.matches?'Tap the red, yellow, blue and green drum pads. Tap Kick pedal for the purple bars.':'D F J K hit red, yellow, blue and green. Space or Enter plays kick bars. Shift activates Overdrive.';canvas.setAttribute('aria-label','Four drum lanes from left to right: D red, F yellow, J blue, K green. Space or Enter plays purple kick bars across the highway.');}
    const difficultyLabels=document.querySelectorAll('.difficulty-row small');
    const limitedFrets=['guitar','bass'].includes(instrument);
    (limitedFrets?['3 FRETS','4 FRETS','5 FRETS','ALL NOTES']:drums?['FEWER HITS','CORE GROOVE','MORE FILLS','ALL HITS']:['FEWER NOTES','MELODY','MORE NOTES','ALL NOTES']).forEach((text,i)=>difficultyLabels[i].textContent=text);
    if(song?.quality?.imports?.[instrument])D.LEVELS.forEach((level,i)=>difficultyLabels[i].textContent=song.quality.imports[instrument].levels.includes(level)?'IMPORTED':song.quality.imports[instrument].derived.includes(level)?'DERIVED':'RETAINED');
    if(vocals)$('modeHint').textContent='Play the vocal melody with D F J K L or the colored pads. Low to high pitch; hold long notes. Pad play, without a microphone.';
    const guitarNames=['Green fret','Red fret','Yellow fret','Blue fret','Orange fret'];
    fretButtons.forEach((b,i)=>{b.disabled=i>=playableFrets();b.setAttribute('aria-disabled',String(b.disabled));b.style.setProperty('--fret',laneColor(i));b.setAttribute('data-touch-label',drums?['Snare','Hi-hat','Tom','Cymbal','Floor'][i]:String(i+1));b.setAttribute('aria-label',`${drums?E.DRUM_NAMES[i]:vocals?`Vocal pitch ${i+1} of 5`:guitarNames[i]}, ${E.KEYS[i].slice(3)}`);b.classList.toggle('disabled-lane',i>=playableFrets());});
    $('drumLabels').querySelectorAll('span').forEach((b,i)=>{b.style.color=E.DRUM_COLORS[i];b.classList.toggle('disabled-lane',i>=playableFrets());});
    const padNames=four?['Red','Yellow','Blue','Green']:E.DRUM_NAMES;
    fretButtons.forEach((b,i)=>{b.hidden=four&&i===4;if(four&&i<4){b.setAttribute('data-touch-label',padNames[i]);b.setAttribute('aria-label',`${padNames[i]} drum pad, ${E.KEYS[i].slice(3)}`);}});
    $('drumLabels').querySelectorAll('span').forEach((b,i)=>{b.hidden=four&&i===4;b.textContent=padNames[i]||'';b.style.color=laneColor(i);});
    if(!song&&vocals){$('uploadHint').textContent='Iron Voltage is instrumental. Upload a song with vocals to chart its melody.';setAnnouncement('VOCAL MELODY','UPLOAD A VOCAL TRACK');}else if(!song)setAnnouncement('YOUR STAGE IS WAITING','LET IT RIP.');
    idleNotes=chartNotes();refreshBest();updateButtons();refreshChartPreview();
  }
  function judge(kind,lane,detail){
    const el=$('judgment');el.textContent=kind;el.className=`judgment ${kind==='GOOD'?'good':kind==='MISS'||kind==='OFF BEAT'?'miss':''}`;
    const timing=$('hitTiming'),feedback=!previewing&&showHitTiming&&Number.isFinite(detail?.error)?T.timingFeedback?.(detail.error,playRate):null;
    if(timing){timing.textContent=feedback?.text||'';timing.className='hit-timing'+(feedback?' show '+feedback.kind:'');}
    if(kind==='MISS'&&!previewing&&Number.isFinite(detail?.time)){lastMissTime=detail.time;if($('practiceMissButton'))$('practiceMissButton').disabled=false;}
    void el.offsetWidth;el.classList.add('show');clearTimeout(judgeTimer);judgeTimer=setTimeout(()=>{el.classList.remove('show');timing?.classList.remove('show');},430);
    if(kind==='PERFECT'||kind==='GOOD'){
      flashes[lane]=1;
      if(!reducedMotion)for(let i=0;i<(instrument==='drums'?18:10);i++)particles.push({lane,life:instrument==='drums'?.58:.45,age:0,vx:(Math.random()-.5)*95,vy:-50-Math.random()*(instrument==='drums'?215:160),x:0,y:0,size:1+Math.random()*3,color:instrument==='drums'?(i%3?'#ffb54f':'#fff3bb'):session.overdrive?'#e8ff65':laneColor(lane)});
    }
  }
  function newSession(){
    audioDrumRun=!!audioDrums?.enabled;
    if(controllerInput)controllerInput.setContext(controllerContext());
    const notes=chartNotes(),context=[song?.id||'demo',instrument,difficulty].join(':');
    if(context!==trainingContext||song&&notes!==trainingNotes){lastMissTime=null;trainingContext=context;trainingNotes=notes;}
    if($('hitTiming')){$('hitTiming').textContent='';$('hitTiming').classList.remove('show');}
    videoChartStart=notes.reduce((first,n)=>Number.isFinite(n.time)?Math.min(first,n.time):first,Infinity);
    session=new E.Session(difficulty,mode,instrument,{drumLayout:D.drumPlayLayout(song?.quality),separateDrums:true,notes:T.segment(notes,practiceLoop),musicEnd:practiceLoop?.end??song?.musicEnd??E.MUSIC_END});session.onJudge=judge;session.onMilestone=n=>{
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
    $('chartDifficultySummary').textContent='Expert: all detected notes. '+['expert','hard','medium','easy'].map(level=>`${D.NAMES[level]}: ${notesForLevel(level).length}`).join(' · ');
    $('chartMapping').textContent=instrument==='drums'?'Red: snare · Yellow: closed/open hi-hat · Blue: tom · Orange: crash/ride cymbal · Green: floor tom · Purple: kick. Easy: fewer hits and kicks. Medium: core groove. Hard: denser fills. Expert: every distinct detected hit. Drum colors keep their instrument on every level.':'Colors follow pitch from low to high. Easy uses green/red/yellow; Medium adds blue; Hard and Expert add orange. Easier levels use fewer notes and simpler chords. Expert keeps all detected attacks. Repeated pitches keep their color within each difficulty.';
    if(instrument==='bass')$('chartMapping').textContent='Bass follows detected low pitches. Easy uses three frets, Medium four, and Hard/Expert all five. Easier levels have fewer notes. Repeated pitches keep their color within each difficulty. Use tap or hold + strum.';
    if(instrument==='vocals')$('chartMapping').textContent='Vocal melody: green, red, yellow, blue, orange from low to high. Tap the pitch pad and hold its tail. This is pad play, without microphone scoring or lyrics. Repeated pitches keep their color. Other melodic instruments can affect the estimate.';
    if(instrument==='guitar'&&song.quality?.audioReviews?.guitar?.contextualFrets)$('chartMapping').textContent='Guitar chords use separate frets in low-to-high pitch order. In this wide arrangement, some repeated pitches move to a nearby fret to keep the chord playable. Easy uses three frets, Medium four, and Hard/Expert five.';
    if(instrument==='guitar'&&song.quality?.audioReviews?.guitar?.holdPolicy==='playable-fret-reuse-v1')$('chartMapping').textContent+=' A hold ends before another note reuses that fret.';
    const names=instrument==='drums'?(fourLaneDrums()?['Red','Yellow','Blue','Green',null,'Kick']:['Snare','Hi-hat','Tom','Cymbal','Floor tom','Kick']):['Green','Red','Yellow','Blue','Orange'];
    const source=song.quality?.sources?.[instrument];
    $('chartDetails').textContent=(source?source+'. ':'')+names.map((name,lane)=>name?`${name}: ${notes.filter(n=>n.lane===lane).length}`:null).filter(Boolean).join(' · ')+(source?(song.quality?.audioReviews?.[instrument]?.estimated?'. Reviewed audio estimate; preview dense sections to check the result.':song.quality?.audioReviews?.[instrument]?.timingVerified?'. Recording timing verified; preview the arrangement.':'. Authored source loaded; recording timing needs preview verification.'):'. Parts are estimated; use preview to check the result.');
    if(song.quality?.mixAnalysis?.[instrument])$('chartDetails').textContent+=' Mixed-audio estimate: overlapping instruments can be confused. Use an authored chart or isolated track for clearer notes.';
    if(instrument==='guitar'&&song.quality?.audioReviews?.guitar?.chordPolicy)$('chartDetails').textContent+=` ${song.quality.audioReviews.guitar.chordAttacks||0} measured chord attacks. Holds follow each detected tone; mixed audio can still miss or confuse Guitar notes.`;
    if(instrument==='guitar'&&song.quality?.audioReviews?.guitar?.onsetPolicy==='own-tone-attack-v1')$('chartDetails').textContent+=' New tones are checked while earlier notes ring. Fret choices are estimated from this audio; preview to check the chart.';
    if(instrument==='drums'&&song.quality?.scoreReview)$('chartDetails').textContent+=' '+song.quality.scoreReview;
    const authored=song.quality?.imports?.[instrument];
    $('findAuthoredChart').textContent=`Find authored ${partName(instrument)} chart`;
    if(authored){
      $('chartDifficultySummary').textContent=['expert','hard','medium','easy'].map(level=>`${D.NAMES[level]}: ${notesForLevel(level).length} (${authored.levels.includes(level)?'imported':authored.derived.includes(level)?('derived from '+D.NAMES[authored.derivedFrom?.[level]||'expert']):'retained'})`).join(' · ');
      $('chartDetails').textContent=`Imported from ${authored.filename}. Authored notes and supplied difficulties retained. `+names.map((name,lane)=>name?`${name}: ${notes.filter(n=>n.lane===lane).length}`:null).filter(Boolean).join(' · ');
      $('chartMapping').textContent=instrument==='drums'?'Imported drum mapping: Red snare · Yellow hi-hat · Blue tom · Orange cymbal · Green floor tom · Purple kick. '+(authored.layout==='four'?'Standard four-lane charts cannot identify every drum voice.':authored.layout==='pro'?'Pro charts map yellow cymbals to hi-hat, other cymbals to orange, and toms to blue/green.':'Five-lane colors follow the authored chart.'):'Fret colors and holds follow the imported chart. Supplied difficulty arrangements are preserved, including any extra frets they use.';
    }
    if(authored&&instrument==='vocals')$('chartMapping').textContent='Authored vocal pitches, onsets and holds are mapped to five pitch pads from low to high. No microphone scoring or lyrics.';
    if(authored&&song.quality?.communityReferences?.[instrument]){const ref=song.quality.communityReferences[instrument];$('chartDetails').textContent+=` Community chart by ${ref.charter}. `+(ref.setlist?`Setlist: ${ref.setlist}. `:'')+(song.quality?.audioReviews?.[instrument]?.timingVerified?'Recording audio timing verified; preview the arrangement.':'Recording audio timing is unverified; preview before playing.');}
    const recovered=authored?0:song.quality?.audioReviews?.[instrument]?.recovered||0;
    if(recovered)$('chartDetails').textContent+=` ${recovered} overlapping hits recovered. Preview the quiet passages to check them.`;
    const ghosts=notes.filter(n=>n.ghost).length;
    if(ghosts)$('chartDetails').textContent+=` ${ghosts} quiet notes. Hollow centers mark soft hits; play the same color.`;
    if(instrument==='drums'&&notes.some(n=>n.rollDuration))$('chartMapping').textContent+=' Roll ribbons: tap each start note, then repeat that pad through the ribbon. Extra roll taps keep your streak but add no scored notes; holding a pad gives no points.';
    if(instrument==='drums'&&!fourLaneDrums()&&D.drumLayout(song.quality)==='four')$('chartMapping').textContent='Five separate drum lanes: Red snare, Yellow hi-hat, Blue tom, Orange cymbal, Green floor tom. Purple: kick. '+(song.charts.drums.expert.some(n=>[1,2,3].includes(n.lane)&&!n.drumVoice)?'Cymbal/tom placement is an estimated conversion of this four-pad chart; preview the colors. ':'Uses the saved source cymbal/tom markers. ')+'Note times stay unchanged. Orange and Green require separate pad hits.';
    if(fourLaneDrums())$('chartMapping').textContent='Four-lane drums: Red · Yellow · Blue · Green. Purple: kick. Source pad colors stay the same on every difficulty; Pro toms and cymbals share their authored pad.'+(notes.some(n=>n.rollDuration)?' Roll ribbons: tap the start, then repeat that pad. Extra roll taps keep your streak and add no scored notes.':'');
    refreshSongTiming();
    const canvas=$('chartOverview'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    c.clearRect(0,0,w,h);c.fillStyle='#727f8b55';
    song.waveform.forEach((v,i)=>c.fillRect(i*w/song.waveform.length,h/2-v*h*.42,w/song.waveform.length-1,v*h*.84));
    for(const n of notes){c.fillStyle=laneColor(n.lane);c.fillRect(n.time/song.musicEnd*w,6+(n.lane===5?5:n.lane)*10,2,7);}
    canvas.setAttribute('aria-label',`${notes.length} ${instrument} notes across ${formatTime(song.musicEnd)} of audio. Use Preview from to hear a section.`);
  }
  function refreshSong(){
    window.RiffBackground?.selectSong(song?.id||'demo');
    if($('backgroundSong'))$('backgroundSong').textContent='Background for '+(song?.title||'Iron Voltage');
    $('trackTitle').classList.toggle('custom-title',!!song);
    if(song)$('trackTitle').textContent=song.title;else $('trackTitle').innerHTML='IRON<br><span>VOLTAGE</span>';
    const publicDemo=song?.quality?.publicDemo;
    $('trackArtist').textContent=publicDemo?publicDemo.artist:song?.quality?.packageAudio?song.quality.lookupIdentity.artist:song?'Your uploaded song':'The Riffbound Sessions';$('trackSource').textContent=publicDemo?'/ PUBLIC DEMO':song?.quality?.packageAudio?'/ SETLIST SONG':song?'/ YOUR SONG':'/ ORIGINAL SESSION';
    $('trackKind').textContent=publicDemo?'PUBLIC DEMO':song?song.quality?.imports?.[instrument]?'IMPORTED CHART':song.quality?.sources?.[instrument]&&song.quality?.audioReviews?.[instrument]?.estimated!==true?'MATCHED CHART':'AUTO CHART':'HEAVY ROCK';$('trackBpm').textContent=song?`≈ ${song.bpm} BPM`:'112 BPM';
    $('trackLength').textContent=formatTime(song?.musicEnd??E.DURATION);$('remaining').textContent=formatTime(trackDuration());
    $('uploadHint').textContent=song?`${Object.keys(song.charts).map(partName).join(' + ')} ready. Choose a part to preview or play it. Full recordings are supported; isolated tracks give clearer estimates.`:'Upload a full song or isolated audio, then preview the detected notes. Choose one instrument, all four, or selected parts.';
    $('demoButton').hidden=!song;$('previewPosition').max=String(Math.max(0,(song?.musicEnd??0)-.2));$('previewPosition').value='0';$('previewTime').textContent='0:00';
    const end=song?.musicEnd??E.MUSIC_END;$('loopStart').max=String(end-1);$('loopEnd').max=String(end);$('loopStart').value='0';$('loopEnd').value=String(Math.min(15,end));
    refreshInstrument();
  }
  function chartScope(){return ['whole','separate'].includes($('chartScope').value)?$('chartScope').value:'single';}
  function requestedParts(){return chartScope()==='whole'?PARTS.slice():chartScope()==='separate'?PARTS.filter(part=>$('part'+partName(part)).checked):[uploadInstrument];}
  function chooseUploadInstrument(target,{switchExisting=true}={}){
    if(busy()||!PARTS.includes(target))return;
    uploadInstrument=target;uploadTargetExplicit=true;preferences();
    document.querySelectorAll('input[name=chartTarget]').forEach(input=>input.checked=input.value===target);
    refreshChartScope();
    // On Soundcheck this selector owns the open song as well as the next upload.
    // A missing part needs its own chart; it cannot silently remain on Guitar.
    // Add song explicitly sets switchExisting=false for a different recording.
    if(switchExisting&&(!active()||hasPlayablePart(target)))return chooseInstrument(target);
  }
  function pickSongFile(){
    pendingUpload={targets:requestedParts(),identity:{title:$('addLookupTitle').value,artist:$('addLookupArtist').value}};
    $('songFile').click();
  }
  function refreshChartScope(){
    const scope=chartScope(),parts=requestedParts();
    $('partsGroup').hidden=scope!=='separate';$('chartTargetGroup').hidden=scope!=='single';
    $('chartTargetLegend').textContent=song?'2. INSTRUMENT FOR THIS SONG':'2. INSTRUMENT FOR YOUR NEXT UPLOAD';
    $('scopeHint').textContent=scope==='whole'?'Build separate Guitar, Drums, Bass and Vocals estimates from one full song. Bass and vocal notes are checked against their own pitch energy. Play one part at a time with the original audio; preview each chart. Unclear parts are reported.':scope==='separate'?'Check the parts you want from one recording. Each gets its own chart and preview; audio stems are not created.':song?'Choose an instrument to play this song. At Soundcheck, a missing chart is built from this song’s audio, checking community charts first when enabled. Use Add song for a different recording.':'Choose an instrument for your next upload.';
    $('uploadButton').textContent=`3. Upload ${scope==='whole'?'whole song':scope==='separate'?'song for selected parts':'song for '+partName(uploadInstrument)}`;
    $('buildPartsButton').hidden=!song||scope==='single';
    $('buildPartsButton').textContent=scope==='whole'?'Build all four charts for this song':'Build selected parts for this song';
    if(scope==='separate'&&!parts.length)$('scopeHint').textContent='Check at least one part to chart.';
  }
  function setSetlistMessage(message,error=false){$('setlistAddStatus').textContent=message;$('setlistAddStatus').classList.toggle('error',error);}
  function uploadProgress(value,label){$('chartProgress').value=value;$('setlistChartProgress').value=value;$('chartStatus').textContent=label;setSetlistMessage(label);showMessage(label);}
  function cancelUpload(){
    uploadGeneration++;cancelLookup?.();cancelLookup=null;cancelAnalysis?.();cancelAnalysis=null;$('uploadProgress').hidden=true;$('songFile').value='';
    $('chartStatus').textContent='Charting canceled. Your previous track is ready.';setSetlistMessage($('chartStatus').textContent);$('chartStatus').classList.remove('error');reset();refreshInstrument();
  }
  function runAnalysis(samples,target,generation,audioId,onProgress=uploadProgress,wholeSong=false){
    return new Promise((resolve,reject)=>{
      let worker;try{worker=new Worker('autochart.js');}catch{reject(Error('Automatic charting could not start. Refresh the page and try again.'));return;}
      const end=()=>{worker.terminate();if(generation===uploadGeneration)cancelAnalysis=null;};
      cancelAnalysis=()=>{end();reject(Error('Canceled'));};
      worker.onmessage=event=>{if(generation!==uploadGeneration)return;const data=event.data;
        if(data.type==='progress')onProgress(data.value,data.label);
        else if(data.type==='complete'){end();try{resolve(PartCharts.isolate(data.result,target));}catch(error){reject(error);}}
        else if(data.type==='error'){end();reject(Error(data.message));}
      };
      worker.onerror=()=>{end();reject(Error('Automatic charting could not finish. Try a shorter audio file.'));};
      const copy=samples.slice();worker.postMessage({samples:copy,sampleRate:22050,instrument:target,audioId,wholeSong},[copy.buffer]);
    });
  }
  async function analyzeParts(samples,targets,generation,audioId,wholeSong=targets.length>1,inputs={}){
    const results=[],unavailable={};
    for(const [index,target] of targets.entries()){
      if(generation!==uploadGeneration)throw Error('Canceled');
      uploadProgress(12+index/targets.length*82,`${index+1}/${targets.length} · Charting ${partName(target)}…`);
      try{results.push({...await runAnalysis(inputs[target]?.samples||samples,target,generation,inputs[target]?.samples?'':audioId,(value,label)=>uploadProgress(12+(index+value/100)/targets.length*82,`${index+1}/${targets.length} · ${label}`),inputs[target]?.wholeSong??wholeSong),instrument:target});}
      catch(error){if(generation!==uploadGeneration)throw error;unavailable[target]=error.message;}
    }
    if(generation!==uploadGeneration)throw Error('Canceled');
    if(!results.length)throw Error(Object.entries(unavailable).map(([part,message])=>`${partName(part)}: ${message}`).join(' '));
    const base=results.find(r=>r.instrument===instrument)||results[0];
    return {...base,charts:Object.assign({},...results.map(r=>r.charts)),quality:{...base.quality,...(results.some(r=>r.quality?.scoreReview)?Object.fromEntries(['preserveEasyMedium','scoreReview','scoreRevision','scoreReference'].filter(key=>results.find(r=>r.quality?.scoreReview).quality[key]!==undefined).map(key=>[key,results.find(r=>r.quality?.scoreReview).quality[key]])): {}),imports:Object.assign({},...results.map(r=>r.quality?.imports||{})),chartTimings:Object.assign({},...results.map(r=>r.quality?.chartTimings||{})),communityReferences:Object.assign({},...results.map(r=>r.quality?.communityReferences||{})),audioReviews:Object.assign({},...results.map(r=>r.quality?.audioReviews||{})),mixAnalysis:Object.assign({},...results.map(r=>r.quality?.mixAnalysis||{})),sources:Object.fromEntries(results.map(r=>[r.instrument,r.quality?.sources?.[r.instrument]||null])),unavailable,methods:Object.fromEntries(results.map(r=>[r.instrument,r.quality?.method||'Audio analysis']))}};
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
  function mergeMixAnalysis(previous,result){
    const modes={...previous};
    for(const part of Object.keys(result.charts))delete modes[part];
    return {...modes,...result.quality?.mixAnalysis};
  }
  function clearImportedParts(parts){
    if(!song?.quality)return;
    for(const key of ['imports','communityReferences','chartTimings','chartAdjustments','timingReviews']){
      song.quality[key]={...song.quality[key]};for(const part of parts)delete song.quality[key][part];
    }
  }
  function timingByPart(quality){const timings={...quality?.chartTimings};if(quality?.chartTiming)for(const part of Object.keys(quality.imports||{}))timings[part]??=quality.chartTiming;return timings;}
  function partTiming(){return song?.quality?.imports?.[instrument]?(song.quality.chartTimings?.[instrument]||song.quality.chartTiming):null;}
  function refreshSongTiming(){
    if(!song)return;
    const ms=song.quality?.chartAdjustments?.[instrument]||0,review=song.quality?.timingReviews?.[instrument];
    $('songTimingTools').hidden=!ChartTiming;$('songChartShift').value=String(ms);$('songChartShiftValue').textContent=`${ms>0?'+':''}${ms} ms`;
    $('songTimingStatus').textContent=review?.message||'Preview against the uploaded recording. Check timing here; use Timing for device calibration.';
    $('applyTimingSuggestion').hidden=review?.status!=='suggested';
    $('applyTimingSuggestion').textContent=review?.status==='suggested'?`Try ${review.suggestedMs>0?'+':''}${review.suggestedMs} ms shift`:'Try suggested timing';
  }
  async function applySongTiming(target){
    if(!song||(active()&&!canSwitchPreview())||pendingSaves||!ChartTiming)return;
    const part=instrument,position=canSwitchPreview()?currentTime():null;
    try{
      if(String(target).trim()==='')throw Error('Enter a chart timing adjustment in milliseconds.');
      target=Number(target);if(!Number.isFinite(target)||Math.abs(target)>2000)throw Error('Choose a timing adjustment from -2000 to +2000 ms.');
      const old=song.quality?.chartAdjustments?.[instrument]||0;
      const levels=ChartTiming.shift(song.charts[instrument],target-old,song.musicEnd),quality={...song.quality,chartAdjustments:{...song.quality?.chartAdjustments,[instrument]:target},timingReviews:{...song.quality?.timingReviews}};
      delete quality.timingReviews[instrument];
      stopCalibration();stopAudio();previewing=false;practiceLoop=null;clearHeld();song={...song,charts:{...song.charts,[instrument]:levels},quality};
      state='idle';setSongPercussion();newSession();refreshSong();updateUi(0);
      const owner=song;await saveSong();$('songTimingStatus').textContent=`${partName(part)} chart moved ${target>0?'+':''}${target} ms from its original timing. Preview to check it. `+(savedSong?'':'Check the setlist save status.');
      if(position!==null&&song===owner&&instrument===part&&state==='idle')await play({preview:true,offset:position});
    }catch(error){$('songTimingStatus').textContent=error.message;}
  }
  async function checkSongTiming(){
    if(song?.chartOnly){showMessage('Attach matching audio before reviewing chart timing.');return;}
    if(!song||active()||pendingSaves||!ChartTiming)return;
    const owner=song,part=instrument,generation=++uploadGeneration;state='analyzing';updateButtons();$('songTimingStatus').textContent='Checking audible attacks across the song…';
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration||song!==owner)return;
      const review=ChartTiming.review(ChartTiming.evidence(samples),owner.charts[part].expert);
      owner.analysisSamples=samples;owner.quality={...owner.quality,timingReviews:{...owner.quality?.timingReviews,[part]:review}};
      state='idle';refreshSongTiming();await saveSong();
    }catch(error){if(generation===uploadGeneration)$('songTimingStatus').textContent=error.message;}
    finally{if(generation===uploadGeneration){state='idle';$('setlistUploadProgress').hidden=true;updateButtons();}}
  }
  function readyMessage(result){
    const unavailable=Object.keys(result.quality?.unavailable||{});
    return `${Object.keys(result.charts).map(partName).join(' + ')} chart${Object.keys(result.charts).length>1?'s':''} ready. Preview before playing.`+(unavailable.length?` Could not chart ${unavailable.map(partName).join(', ')}: ${unavailable.map(p=>result.quality.unavailable[p]).join(' ')}`:'')+(result.quality?.onlineLookup?.message?' '+result.quality.onlineLookup.message:'');
  }
  function existingChartIdentity(useFields=false){
    const inferred=Community?.identify?.(song.filename||song.title)||{title:song.title,artist:''},stored=song.quality?.lookupIdentity||Object.values(song.quality?.communityReferences||{}).find(Boolean)||{};
    return {title:useFields&&$('addLookupTitle').value.trim()||stored.title||inferred.title,artist:useFields&&$('addLookupArtist').value.trim()||stored.artist||song.quality?.chartArtist||inferred.artist};
  }
  function applyChartResult(result,samples){
    const previous=song,q=result.quality||{},affected=Object.keys(result.charts);
    if(affected.includes('drums')){q.drumLayout=q.drumLayout||'five';if(q.drumLayout==='four')result.charts.drums=D.fourDrumLevels(result.charts.drums);}
    song={...previous,...result,id:previous.id,title:previous.title,filename:previous.filename,audioBlob:previous.audioBlob,buffer:previous.buffer,musicEnd:previous.musicEnd,duration:previous.duration,analysisSamples:samples,charts:mergeSongCharts(previous.charts,result),quality:{...previous.quality,...q,imports:{...previous.quality?.imports},communityReferences:{...previous.quality?.communityReferences},chartTimings:timingByPart(previous.quality),chartAdjustments:{...previous.quality?.chartAdjustments},timingReviews:{...previous.quality?.timingReviews},audioReviews:{...previous.quality?.audioReviews,...q.audioReviews},mixAnalysis:mergeMixAnalysis(previous.quality?.mixAnalysis,result),sources:{...previous.quality?.sources,...Object.fromEntries(affected.map(p=>[p,q.sources?.[p]||null]))},methods:{...previous.quality?.methods,...Object.fromEntries(affected.map(p=>[p,q.methods?.[p]||q.method||'Audio analysis']))}}};
    clearImportedParts(affected);song.quality.imports={...song.quality.imports,...q.imports};song.quality.chartTimings={...song.quality.chartTimings,...q.chartTimings};song.quality.timingReviews={...song.quality.timingReviews,...q.timingReviews};song.quality.chartAdjustments={...song.quality.chartAdjustments,...q.chartAdjustments};
    for(const part of Object.keys(q.imports||{})){song.quality.communityReferences[part]=q.communityReferences?.[part]||q.onlineLookup?.references?.[part]||q.onlineLookup?.reference;if(!['verified-authored-drums-v1','authored-drum-track-v1','authored-recording-alignment-v1','authored-package-audio-v1','sheet-music-timing-review-v1'].includes(q.audioReviews?.[part]?.policy))delete song.quality.audioReviews[part];delete song.quality.mixAnalysis[part];}
    if(q.imports?.drums&&q.audioReviews?.drums?.policy!=='verified-authored-drums-v1'&&!q.reusedParts?.includes('drums'))for(const key of ['scoreReview','scoreRevision','preserveEasyMedium'])delete song.quality[key];
  }
  async function findAuthoredChart(){
    if(!song||active()||pendingSaves>0||!Community)return;
    const target=instrument,identity=existingChartIdentity(true);
    if(song.chartOnly)return findSongWithoutAudio(identity,[target]);
    if(!identity.artist){$('chartStatus').textContent='Enter the song title and artist above, then try Find community chart again. Your current chart is kept.';return;}
    const generation=++uploadGeneration;stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();$('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration)return;
      const result=await uploadCharts({name:song.filename||song.title},song.buffer,samples,[target],generation,song.id,identity,{authoredOnly:true});if(generation!==uploadGeneration)return;
      if(!result.charts[target]){
        const detail=(result.quality?.onlineLookup?.message||'').replace(/Used audio charting\./g,'Your current chart is kept.');
        song={...song,quality:{...song.quality,lookupIdentity:result.quality.lookupIdentity,onlineLookup:{...result.quality.onlineLookup,message:detail}}};state='idle';await saveSong();
        $('chartStatus').textContent=`No usable authored ${partName(target)} chart was imported. ${detail||'Your current chart is kept.'} You can load a matching notes.mid or notes.chart in Chart files.`;return;
      }
      applyChartResult(result,samples);instrument=target;song.instrument=target;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);saveSong();uploadProgress(100,readyMessage(result));
    }catch(error){if(generation!==uploadGeneration)return;$('chartStatus').textContent=error.message+' Your current chart is kept.';$('chartStatus').classList.add('error');}
    finally{if(generation===uploadGeneration){state='idle';$('uploadProgress').hidden=true;updateButtons();}}
  }
  async function loadKingNothingDrums(){
    if(!song||active()||pendingSaves>0)return;
    const owner=song,generation=++uploadGeneration;state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('chartStatus').textContent='Loading King Nothing’s authored Drum track only…';
    try{
      const result=await window.RiffAuthoredDrums.load('king-nothing',owner.musicEnd,undefined,owner.id);
      if(generation!==uploadGeneration||song!==owner)return;
      // Replace the whole Drum arrangement; never retain estimated lower levels
      // or merge another instrument from the source MIDI into this song.
      applyChartResult(result,owner.analysisSamples);instrument='drums';song.instrument='drums';
      setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);await saveSong();
      $('chartStatus').textContent='King Nothing authored Drums loaded at all four difficulties. Guitar, Bass, Vocals and audio kept. Preview to check timing against your recording.';
    }catch(error){if(generation===uploadGeneration){$('chartStatus').textContent=error.message;$('chartStatus').classList.add('error');}}
    finally{if(generation===uploadGeneration){state='idle';updateButtons();}}
  }
  async function buildSelectedParts(){
    if(active()||!song)return;
    const targets=requestedParts();if(!targets.length){$('chartStatus').textContent='Choose at least one part to chart.';return;}
    if(song.chartOnly)return findSongWithoutAudio(existingChartIdentity(),targets);
    const generation=++uploadGeneration;stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;
    setAnnouncement('YOUR SONG','BUILDING SEPARATE CHARTS…');
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration)return;
      const result=await uploadCharts({name:song.filename||song.title},song.buffer,samples,targets,generation,song.id,existingChartIdentity());if(generation!==uploadGeneration)return;
      applyChartResult(result,samples);instrument=result.instrument;song.instrument=instrument;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);saveSong();uploadProgress(100,readyMessage(result));setAnnouncement('CHARTS READY','CHOOSE YOUR PART');
    }catch(error){if(generation!==uploadGeneration)return;state='idle';reset();refreshSong();$('chartStatus').textContent=error.message;$('chartStatus').classList.add('error');}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;updateButtons();}}
  }
  function setSongPercussion(){
    song.charts=D.upgradeAll(song.charts,song.beat);
    refreshPercussion();
  }
  function refreshPercussion(){
    const notes=D.playDrums(song.charts.drums?.expert||[],song.quality,{beat:song.beat});
    song.percussion=window.RiffMotion?.performanceEvents?.(notes,song.charts.guitar?.expert||song.charts.bass?.expert||[])||{left:notes.filter(n=>[0,2,4].includes(n.lane)),right:notes.filter(n=>[1,3].includes(n.lane))};
  }
  $('drumPlayLayout')?.addEventListener('change',()=>{
    const layout=$('drumPlayLayout').value;
    if(!song?.charts.drums||instrument!=='drums'||active()||pendingSaves>0||!['four','five'].includes(layout)){if(song)$('drumPlayLayout').value=D.drumPlayLayout(song.quality);return;}
    song.quality={...song.quality,drumPlayLayout:layout};refreshPercussion();newSession();refreshInstrument();updateUi(0);return saveSong();
  });
  async function chooseInstrument(target,force=false,repair=false){
    if(!PARTS.includes(target))return;
    if(!force&&canSwitchPlayback()&&target!==instrument&&hasPlayablePart(target)){
      const position=currentTime(),wasPlaying=running(),wasPreview=previewing;
      reset();await chooseInstrument(target);
      // A different scored chart gets a new run rather than another part's
      // in-progress score. Paused selection waits for Play; previews keep time.
      if(wasPlaying)return play(wasPreview?{preview:true,offset:position}:{});
      return;
    }
    if(active()||(target===instrument&&!force))return;
    if(!song){instrument=target;newSession();refreshSong();updateUi(0);return;}
    if(!force&&song.charts[target]){instrument=target;song.instrument=target;newSession();refreshSong();updateUi(0);saveSong();return;}
    if(song.chartOnly)return findSongWithoutAudio(existingChartIdentity(),[target]);
    const generation=++uploadGeneration;stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;
    uploadProgress(5,`Rebuilding this song for ${partName(target)} only…`);setAnnouncement('ONE INSTRUMENT',`CHARTING ${target.toUpperCase()}…`);
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);if(generation!==uploadGeneration)return;
      const identity=existingChartIdentity(!existingChartIdentity().artist);
      const result=repair?await uploadCharts({name:song.filename||song.title},song.buffer,samples,[target],generation,song.id,existingChartIdentity(true),{refreshParts:[target]}):force?await runAnalysis(samples,target,generation,song.id,uploadProgress,!!song.quality?.mixAnalysis?.[target]):await uploadCharts({name:song.filename||song.title},song.buffer,samples,[target],generation,song.id,identity);if(generation!==uploadGeneration)return;
      if(repair){if(!result.charts[target]?.expert?.length)throw Error('No usable drum chart was found. Your current chart is kept.');result.quality={...result.quality,preserveEasyMedium:false};}
      // Analysis may replace chart data, never the original audio or identity.
      applyChartResult(result,samples);
      if(repair)for(const key of ['scoreReview','scoreRevision','scoreReference'])if(result.quality?.[key]===undefined)delete song.quality[key];
      instrument=target;song.instrument=target;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);saveSong();
      uploadProgress(100,readyMessage(result));setAnnouncement('FOCUSED CHART READY','LET IT RIP.');
    }catch(error){if(generation!==uploadGeneration)return;state='idle';reset();refreshSong();$('chartStatus').textContent=error.message;$('chartStatus').classList.add('error');showMessage(`Could not build ${partName(target)}: ${error.message} Your current chart is kept.`);}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;updateButtons();}}
  }
  async function uploadCharts(file,buffer,samples,targets,generation,id,identity,{authoredOnly=false,previous=null,refreshParts=[],scoreFile=null}={}){
    const prior=previous||(song?.id===id?song:null),reviewed=!authoredOnly&&window.RiffAuthoredDrums?.upgrade?await window.RiffAuthoredDrums.upgrade(prior):prior;
    if(generation!==uploadGeneration)throw Error('Canceled');
    const cached=!authoredOnly&&AuthoredReuse?AuthoredReuse.reuse(reviewed,id,buffer.duration,targets.filter(part=>!refreshParts.includes(part)),{requireAudioMatch:true}):{charts:{},quality:{reusedParts:[]}};
    const reused=cached.quality.reusedParts,searchIdentity={title:identity.title||cached.quality.lookupIdentity?.title||'',artist:identity.artist||cached.quality.lookupIdentity?.artist||''};
    let online={charts:{},imports:{},sources:{},message:''};const drumSources=new Map();
    // A recording-specific audio estimate is a fallback, not an authored
    // import. It must not bypass the player's community-first search.
    const lookupParts=targets.filter(part=>!cached.charts[part]);
    if(Community&&lookupParts.length){
      const controller=new AbortController();cancelLookup=()=>controller.abort();
      const alignAudio=Recording&&Community.referenceFeatures?async({downloaded,parts,analysisOnly=false,fetcher,signal,budget})=>{
        const target=Recording.features(samples),reviews={},rawDrums=new Map();let rawKit=null;
        const decode=async(bytes,info={})=>{const reference=await ensureAudio().decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(reference.duration<5||reference.duration>D.MAX_REFERENCE_DURATION)throw Error('Unsupported reference audio duration.');if(analysisOnly&&info.part==='drums'&&Recording.pcm&&Recording.addStem){rawKit=Recording.addStem(rawKit,Recording.pcm(reference));rawDrums.set(info.name,true);}return Recording.fromBuffer(reference);};
        for await(const reference of Community.referenceFeatures(downloaded,{parts:parts.includes('drums')?['drums',...parts.filter(p=>p!=='drums')]:parts,fetcher,signal,decode,budget,allowFullRecording:!analysisOnly})){
          uploadProgress(11,reference.scope==='full-recording'?'Checking the recording for the authored Drum chart…':`Checking ${partName(reference.part)} source audio independently…`);
          const review=await Recording.review(target,Recording.combine(reference.features),{signal});
          reviews[reference.part]={...review,referenceInstrument:reference.part,referenceScope:reference.scope,referenceFiles:reference.files};
          if(reference.part==='drums'&&review.status==='aligned'&&Recording.alignStems&&reference.files.every(name=>rawDrums.has(name))){
            const sourceId=downloaded.container.url.match(/([a-f0-9]{32})\.sng$/)?.[1];
            if(sourceId)drumSources.set(sourceId,{samples:Recording.alignStems([rawKit],buffer.duration,review.shiftSeconds),files:reference.files,review});
          }
        }
        return reviews;
      }:undefined;
      try{online=await Community.lookup({filename:file.name,...searchIdentity,duration:buffer.duration,parts:lookupParts,includeDrumAudio:lookupParts.includes('drums')&&!authoredOnly,requireAudioMatch:true,enabled:authoredOnly||refreshParts.length>0||communityLookup,signal:controller.signal,alignAudio,onProgress:label=>uploadProgress(11,label)});}
      finally{if(generation===uploadGeneration)cancelLookup=null;}
    }
    if(SheetMusic&&!authoredOnly&&lookupParts.some(p=>!online.charts?.[p])){
      const controller=new AbortController();cancelLookup=()=>controller.abort();
      try{online=await SheetMusic.fill(online,{...searchIdentity,filename:file.name,parts:lookupParts,duration:buffer.duration,scoreFile,enabled:sheetMusicLookup,signal:controller.signal,onProgress:label=>uploadProgress(12,label)});}
      finally{if(generation===uploadGeneration)cancelLookup=null;}
    }
    if(generation!==uploadGeneration)throw Error('Canceled');
    // Accept only the requested missing parts. A catalog result cannot replace
    // a saved authored part or donate another instrument's notes.
    const onlineCharts=Object.fromEntries(lookupParts.filter(part=>online.charts?.[part]).map(part=>[part,online.charts[part]]));
    const remaining=targets.filter(part=>!cached.charts[part]&&!onlineCharts[part]);
    const drumSource=remaining.includes('drums')&&online.drumAudio?drumSources.get(online.drumAudio.md5):null;
    let generated=null;
    try{if(remaining.length&&!authoredOnly)generated=await analyzeParts(samples,remaining,generation,id,targets.length>1,drumSource?{drums:{samples:drumSource.samples,wholeSong:false}}:{});}
    catch(error){if(generation!==uploadGeneration||!Object.keys(onlineCharts).length&&!reused.length)throw error;generated={charts:{},quality:{unavailable:Object.fromEntries(remaining.map(part=>[part,error.message]))}};}
    if(generation!==uploadGeneration)throw Error('Canceled');
    if(drumSource&&generated?.charts?.drums){
      generated.quality={...generated.quality,sources:{...generated.quality.sources,drums:'Drums estimate from verified '+online.drumAudio.setlist+' Drum audio'},methods:{...generated.quality.methods,drums:'Own Drum stem audio analysis'},audioReviews:{...generated.quality.audioReviews,drums:{...generated.quality.audioReviews?.drums,policy:'own-drum-stem-estimate-v1',estimated:true,timingVerified:true,recordingId:id,referenceInstrument:'drums',referenceFiles:drumSource.files,sourceMd5:online.drumAudio.md5,sourceOffsetSeconds:drumSource.review.shiftSeconds,windows:drumSource.review.windows}}};
    }
    // Lookup metadata is subject to the same instrument boundary as notes.
    for(const key of ['imports','sources','timings','references','recordingReviews'])online[key]=PartCharts.only(online[key],Object.keys(onlineCharts));
    online.issues=PartCharts.only(online.issues,lookupParts);
    const firstOnlinePart=Object.keys(onlineCharts)[0];
    online.reference=online.references[firstOnlinePart]||null;online.timing=online.timings[firstOnlinePart]||null;
    const charts={...generated?.charts,...PartCharts.only(onlineCharts,Object.keys(onlineCharts)),...cached.charts},imports={...generated?.quality?.imports,...cached.quality.imports};
    const drumLayout=cached.charts.drums?D.drumLayout(cached.quality):onlineCharts.drums?online.drumLayout||D.drumLayout({communityReferences:online.references}):drumSource?online.drumAudio.drumLayout||'four':'five';
    if(charts.drums&&drumLayout==='four')charts.drums=D.fourDrumLevels(charts.drums);
    for(const part of Object.keys(onlineCharts)){
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(charts[part])));
      imports[part]={...online.imports[part],id:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
    }
    const waveform=(!drumSource&&generated?.waveform)||cached.waveform||Array.from({length:240},(_,i)=>{let peak=0;for(let j=Math.floor(i*samples.length/240);j<(i+1)*samples.length/240;j+=32)peak=Math.max(peak,Math.abs(samples[j]||0));return peak;});
    const timingReviews={...generated?.quality?.timingReviews,...cached.quality.timingReviews},audioReviews={...generated?.quality?.audioReviews,...cached.quality.audioReviews};
    if(ChartTiming&&Object.keys(onlineCharts).length){const evidence=ChartTiming.evidence(samples);for(const part of Object.keys(onlineCharts)){
      const review=online.recordingReviews?.[part];
      timingReviews[part]=review?.status==='aligned'?{...review,suggestedMs:0}:ChartTiming.review(evidence,charts[part].expert);
      audioReviews[part]={policy:online.scoreParts?.includes(part)?'sheet-music-timing-review-v1':'authored-recording-alignment-v1',estimated:false,timingVerified:review?.status==='aligned',recordingId:id,...(review?.status==='aligned'?{sourceOffsetSeconds:review.shiftSeconds,referenceInstrument:review.referenceInstrument,referenceScope:review.referenceScope,referenceFiles:review.referenceFiles,windows:review.windows}:{})};
    }}
    const references={...generated?.quality?.communityReferences,...cached.quality.communityReferences,...Object.fromEntries(Object.keys(onlineCharts).map(part=>[part,online.references?.[part]||online.reference]))};
    const message=(reused.length?`Reused saved authored ${reused.map(partName).join(', ')} charts with their difficulties and timing. `:'')+(online.message||'')+(drumSource&&generated?.charts?.drums?' Drums were estimated from verified isolated source audio; colors still need preview review.':'');
    const selected=charts[instrument]?instrument:Object.keys(charts)[0];
    return {...generated,charts,waveform,instrument:selected,bpm:generated?.bpm||cached.bpm||online.bpm,beat:generated?.beat||cached.beat||online.beat,offset:generated?.offset??cached.offset??0,chartVersion:Math.max(generated?.chartVersion||1,cached.chartVersion||1),quality:{...generated?.quality,...(reused.length?cached.quality:{}),...(online.sheetMusic?{sheetMusic:online.sheetMusic}:{}),...(charts.drums?{drumLayout}:{}),reusedParts:reused,lookupIdentity:online.identity||cached.quality.lookupIdentity||identity,imports,communityReferences:references,chartTimings:{...generated?.quality?.chartTimings,...cached.quality.chartTimings,...online.timings},chartAdjustments:{...cached.quality.chartAdjustments},timingReviews,audioReviews,sources:{...generated?.quality?.sources,...cached.quality.sources,...online.sources},...(online.timing?{chartTiming:online.timing,chartArtist:online.identity?.artist||searchIdentity.artist}:{}),methods:{...generated?.quality?.methods,...cached.quality.methods,...Object.fromEntries(Object.keys(onlineCharts).map(part=>[part,online.scoreParts?.includes(part)?'Sheet music converted to colored lanes':'Authored community chart']))},onlineLookup:{message,reference:online.reference||null,references,availableParts:online.availableParts||[],attempts:online.attempts||[],issues:online.issues||{}}}};
  }
  async function uploadSong(file,targets=requestedParts(),identity={title:$('addLookupTitle').value,artist:$('addLookupArtist').value},{scoreFile=null}={}){
    if(!file)return;
    const validation=!targets.length?'Choose at least one part to chart.':audioFileError(file);
    if(validation){$('chartStatus').textContent=validation;$('chartStatus').classList.add('error');setSetlistMessage(validation,true);return;}
    const generation=++uploadGeneration;cancelLookup?.();cancelLookup=null;cancelAnalysis?.();cancelAnalysis=null;
    $('setlistSaveActions').hidden=true;
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
      if(buffer.duration<5||buffer.duration>D.MAX_DURATION)throw Error('Choose a song between 5 seconds and 15 minutes long.');
      uploadProgress(10,'Preparing the audio for charting…');
      const samples=await prepareSamples(buffer);if(generation!==uploadGeneration)return;
      let previous=song?.id===id?song:null;if(!previous)try{previous=await Library.get(id);}catch{}
      if(generation!==uploadGeneration)return;
      const result=await uploadCharts(file,buffer,samples,targets,generation,id,identity,{previous,scoreFile});
      if(generation!==uploadGeneration)return;
      song={...result,charts:mergeSongCharts(previous?.charts,result),quality:{...previous?.quality,...result.quality,imports:{...previous?.quality?.imports,...result.quality.imports},communityReferences:{...previous?.quality?.communityReferences},chartTimings:timingByPart(previous?.quality),chartAdjustments:{...previous?.quality?.chartAdjustments},timingReviews:{...previous?.quality?.timingReviews},audioReviews:{...previous?.quality?.audioReviews,...result.quality?.audioReviews},mixAnalysis:mergeMixAnalysis(previous?.quality?.mixAnalysis,result),sources:{...previous?.quality?.sources,...result.quality.sources},methods:{...previous?.quality?.methods,...result.quality.methods}},id,buffer,audioBlob,filename:file.name,analysisSamples:samples,title:file.name.replace(/\.[^.]+$/,'')||'Your song',musicEnd:buffer.duration,duration:buffer.duration+.8};
      clearImportedParts(Object.keys(result.charts));song.quality.imports={...song.quality.imports,...result.quality.imports};song.quality.chartTimings={...song.quality.chartTimings,...result.quality.chartTimings};song.quality.timingReviews={...song.quality.timingReviews,...result.quality.timingReviews};song.quality.chartAdjustments={...song.quality.chartAdjustments,...result.quality.chartAdjustments};
      for(const part of Object.keys(result.quality.imports||{}))song.quality.communityReferences[part]=result.quality.communityReferences?.[part]||result.quality.onlineLookup?.references?.[part]||result.quality.onlineLookup?.reference;
      for(const part of Object.keys(result.quality.imports||{})){if(!['verified-authored-drums-v1','authored-drum-track-v1','authored-recording-alignment-v1','authored-package-audio-v1','sheet-music-timing-review-v1'].includes(result.quality.audioReviews?.[part]?.policy))delete song.quality.audioReviews[part];delete song.quality.mixAnalysis[part];}
      if(result.quality.imports?.drums&&result.quality.audioReviews?.drums?.policy!=='verified-authored-drums-v1'&&!result.quality.reusedParts?.includes('drums')){delete song.quality.scoreReview;delete song.quality.scoreRevision;delete song.quality.preserveEasyMedium;}
      instrument=result.instrument;
      setSongPercussion();
      state='idle';newSession();refreshSong();updateUi(0);uploadProgress(100,readyMessage(result));setAnnouncement('CHARTS READY','LET IT RIP.');saveSong();
    }catch(error){if(generation!==uploadGeneration)return;state='idle';newSession();refreshSong();updateUi(0);$('chartStatus').textContent=error.message||'Charting failed. Try another audio file.';$('chartStatus').classList.add('error');setSetlistMessage($('chartStatus').textContent,true);setAnnouncement('CHARTING COULD NOT FINISH','TRY ANOTHER SONG');}
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
    $('audioAttachmentStatus').hidden=!song;$('audioAttachmentStatus').textContent=song?.chartOnly?'Chart only · No audio file required to save or preview notes. Attach your own matching audio for song playback.':song?status.message:'';
    $('reconnectAudioButton').textContent=song?.chartOnly?'Attach audio for this chart':'Reconnect original audio';
    $('audioRecovery').hidden=!song||status.ok||status.code==='AUDIO_TOO_LARGE';
  }
  function setSaveStatus(message){const failed=message.startsWith('Could not save');$('saveStatus').textContent=message;$('setlistSaveActions').hidden=!failed;setSetlistMessage(message,failed);refreshLibrarySaveStatus();}
  function storageErrorMessage(error){
    const message=error?.message||'Song storage is unavailable. Try again.';
    if(/Failed to write blobs|IOError|I\/O error/i.test(message))return 'The browser could not write the song to this device. Keep your backup, free some device space, close other game tabs, then try saving again. If this continues, import the backup in another browser.';
    return error?.name==='QuotaExceededError'||/quota|full disk|disk full|no space|not enough space/i.test(message)?'Browser storage is full or there is not enough free space on this device. Free some space, then choose Save current song again. Keep the song open and do not clear this game’s site data.':message;
  }
  async function saveSong(){
    if(!song)return;const owner=song,serial=++saveSerial,saved={...song,instrument};savedSong=null;pendingSaves++;$('setlistSaveActions').hidden=true;setSaveStatus(song.chartOnly?'Saving charts to your setlist…':'Saving audio and charts to your setlist…');updateButtons();
    try{await Library.save(saved);if(song===owner&&serial===saveSerial)savedSong=owner;if(song?.id===saved.id){setSaveStatus(saved.chartOnly?'Added to your setlist · Chart only, saved on this device.':'Added to your setlist · Saved on this device.');if(!setlistSongs.some(track=>track.id===saved.id))$('setlistSearch').value='';}await refreshSetlist();if($('libraryDialog').open)await refreshLibrary();}
    catch(error){if(song?.id===saved.id){const audio=Library.audioStatus(saved.audioBlob);$('setlistSaveActions').hidden=false;setSaveStatus(saved.chartOnly?'Could not save charts on this device. Export a backup or retry. '+storageErrorMessage(error):audio.ok?'Could not save on this device. You can still play; export a backup with Export current song. '+storageErrorMessage(error):'Could not save. '+audio.message);}}
    finally{pendingSaves--;updateButtons();}
  }
  async function reconnectOriginalAudio(file){
    if(!file||!song||busy()||pendingSaves)return;
    const current=song;let repaired=false;reconnectingAudio=true;setSaveStatus('Checking the original audio file…');updateButtons();
    try{
      const restored=await Library.reconnectAudio(current,file);if(song!==current)return;
      if(current.chartOnly){
        const buffer=await ensureAudio().decodeAudioData(await restored.audioBlob.arrayBuffer());if(song!==current)return;
        if(Math.abs(buffer.duration-current.musicEnd)>.75)throw Error('This audio length does not match the found chart. Choose the matching recording.');
        let prior;try{prior=await Library.get(restored.id);}catch{}if(song!==current)return;
        const quality={...prior?.quality,...current.quality};for(const key of ['imports','sources','communityReferences','chartTimings','chartAdjustments','timingReviews','audioReviews','mixAnalysis','methods'])quality[key]={...prior?.quality?.[key],...current.quality?.[key]};
        for(const part of Object.keys(current.charts))for(const key of ['chartAdjustments','timingReviews','audioReviews','mixAnalysis'])if(!Object.hasOwn(current.quality?.[key]||{},part))delete quality[key][part];
        const checked=Library.validate({...current,...restored,charts:{...prior?.charts,...current.charts},quality,musicEnd:buffer.duration});song={...checked,audioBlob:restored.audioBlob,buffer,analysisSamples:null};
        refreshSong();showMessage('Audio attached. Preview to check the chart’s timing against this recording.');
      }else song={...song,audioBlob:restored.audioBlob,filename:restored.filename};repaired=true;
      setSaveStatus('Original audio reconnected. Your existing charts are ready to save.');
    }catch(error){if(song===current)setSaveStatus('Audio was not reconnected. '+error.message);}
    finally{reconnectingAudio=false;$('reconnectAudioFile').value='';updateButtons();}
    if(repaired){await saveSong();if(current.chartOnly&&savedSong===song&&current.id!==song.id){await Library.remove(current.id);await refreshSetlist();}}
  }
  function useDemo(){
    if(busy())return;song=null;$('setlistSaveActions').hidden=true;if(instrument==='vocals')instrument='guitar';reset();refreshSong();$('chartStatus').textContent='';setSaveStatus('');
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
    const demos=PublicDemos?.list()||[],savedIds=new Set(setlistSongs.map(track=>track.id));
    const tracks=[{id:'demo',title:'Iron Voltage',musicEnd:E.MUSIC_END,charts:{guitar:{},drums:{},bass:{}}},...demos.filter(track=>!savedIds.has(track.id)),...setlistSongs];
    const matches=tracks.filter(track=>track.title.toLocaleLowerCase().includes(query));
    $('setlistEntries').replaceChildren();$('setlistCount').textContent=`${tracks.length} track${tracks.length===1?'':'s'}`;
    for(const track of matches){
      const button=document.createElement('button'),title=document.createElement('strong'),info=document.createElement('span'),badge=document.createElement('span');
      button.type='button';button.className='setlist-track';button.dataset.songId=track.id;button.setAttribute('aria-label',`Select ${track.title}`);
      title.textContent=track.title;info.className='setlist-track-info';info.textContent=`${formatTime(track.musicEnd)} · ${Object.keys(track.charts).map(partName).join(' + ')}${track.chartOnly?' · Chart only':track.id==='demo'?' · Demo':demos.some(d=>d.id===track.id)?' · Public demo':''}${linkedVideoIds.has(track.id)?' · Video link saved':savedVideoIds.has(track.id)?' · Video saved':''}`;badge.className='setlist-track-badge';
      button.append(title,info,badge);button.addEventListener('click',async()=>{if(active())return;if(track.id==='demo')useDemo();else await openSong(track.id);});$('setlistEntries').append(button);
    }
    $('setlistStatus').textContent=setlistError||(query?matches.length?`${matches.length} matching track${matches.length===1?'':'s'}`:'No matching songs. Try another title.':setlistSongs.length?'':demos.length?'Public demos are ready. Select a song, then Play track.':'Start with the demo or choose Add song to grow your setlist.');
    updateSetlistSelection();
  }
  async function refreshSetlist(){
    const generation=++setlistGeneration;
    try{
      const records=await Library.list();let videos=[],links=[];
      try{[videos,links]=await Promise.all([window.RiffBackground?.savedSongs?.(records.map(track=>track.id))||[],window.RiffBackground?.linkedSongs?.(records.map(track=>track.id))||[]]);}catch{}
      if(generation!==setlistGeneration)return;
      setlistSongs=records;savedVideoIds=new Set(videos);linkedVideoIds=new Set(links);setlistError='';renderSetlist();
    }catch(error){if(generation!==setlistGeneration)return;setlistError='Saved songs could not be loaded. Try Manage songs to retry.';renderSetlist();}
  }
  async function refreshLibrary(){
    refreshLibrarySaveStatus();$('songList').replaceChildren();$('libraryStatus').textContent='Loading your songs…';
    try{
      const songs=await Library.list();$('libraryStatus').textContent=songs.length?`${songs.length} saved song${songs.length===1?'':'s'}`:song?'No saved songs yet. Save current song adds the open song to your setlist.':'No saved songs yet. Upload a song or import a .riffpack backup.';
      for(const saved of songs){
        const row=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),actions=document.createElement('div');row.className='saved-song';actions.className='tool-actions';title.textContent=saved.title;info.textContent=`${formatTime(saved.musicEnd)} · ${Object.keys(saved.charts).join(' + ')} · ${(saved.byteLength/1024/1024).toFixed(1)} MB`;
        for(const [label,action] of [['Open',async()=>openSong(saved.id)],['Export',async()=>exportSong(await Library.get(saved.id))],['Remove',async()=>{await Library.remove(saved.id);await window.RiffBackground?.removeSong?.(saved.id);if(song?.id===saved.id)savedSong=null;await refreshSetlist();await refreshLibrary();if(song?.id===saved.id)setSaveStatus('Removed from your setlist. This open copy is playable until you leave it.');}]]){
          const button=document.createElement('button');button.className='quiet';button.textContent=label;button.setAttribute('aria-label',`${label} ${saved.title}`);button.addEventListener('click',async()=>{if(busy())return;button.disabled=true;try{await action();}catch(error){$('libraryStatus').textContent=error.message;}finally{button.disabled=false;}});actions.append(button);
        }row.append(title,info,actions);$('songList').append(row);
      }
    }catch(error){$('libraryStatus').textContent=storageErrorMessage(error);}
  }
  function exportSong(record=song,background=null){
    if(!record)throw Error('Open a song before exporting.');
    if(backupSaving)return;
    const blob=Library.pack({...record,instrument:record===song?instrument:record.instrument},{background});
    const name=(record.title.replace(/[^a-z0-9 _-]/gi,'').slice(0,80)||'Riffbound song')+'.riffpack';
    const url=URL.createObjectURL(blob);
    if(backupExport)URL.revokeObjectURL(backupExport.url);
    backupExport={blob,name,url,hasVideo:!!background};
    const link=$('backupDownload');link.href=url;link.download=name;link.textContent='Download backup';
    $('backupFileInfo').textContent=`${name} · ${(blob.size/1024/1024).toFixed(1)} MB · ${record.chartOnly?'Charts only, no audio':'Audio and all chart difficulties'}${background?(background.url?' + video link and background timing (internet required)':' + video and background timing'):''}`;
    $('backupSaveAs').hidden=typeof window.showSaveFilePicker!=='function';
    $('backupStatus').textContent='Backup ready. Choose where to save it below.';
    $('libraryStatus').textContent='Backup ready. Save it in the Export backup panel.';
    if(background)$('backgroundDialog').close();openTool('backupDialog');
    // Never start a hidden picker request while preparing the panel. The
    // visible Save as button must own its fresh click and its pending state.
    if(typeof window.showSaveFilePicker!=='function')link.click();
  }
  function nativeBackupPickerAllowed(){
    if(typeof window.showSaveFilePicker!=='function')return false;
    try{return !window.top||window.top===window||window.top.location.origin===window.location.origin;}catch{return false;}
  }
  function openBackupWindow(){
    if(!backupExport)return;
    const prepared=backupExport,token=crypto.randomUUID(),origin=window.location.origin;
    let child;try{child=window.open('backup-save.html#'+token,'_blank');}catch{}
    if(!child){$('backupStatus').textContent='The browser blocked the save window. Allow pop-ups for Riffbound, then choose Save in new window again. Your backup is still ready.';return;}
    if(backupTransfer)backupTransfer();
    const receive=event=>{
      if(event.source!==child||event.origin!==origin||event.data?.token!==token)return;
      if(event.data.type==='RIFF_BACKUP_READY'){
        try{child.postMessage({type:'RIFF_BACKUP_FILE',token,blob:prepared.blob,name:prepared.name},origin);}catch{$('backupStatus').textContent='Could not send the backup to the save window. Keep this game open and try Save in new window again.';}
      }else if(event.data.type==='RIFF_BACKUP_RECEIVED'){
        $('backupStatus').textContent='Your backup is ready in the new window. Choose Save backup as… there, or Download backup.';cleanup();
      }
    };
    const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(timer);if(backupTransfer===cleanup)backupTransfer=null;};
    const timer=setTimeout(()=>{cleanup();$('backupStatus').textContent='The backup could not reach the save window. Keep this game open, allow pop-ups, and choose Save in new window again. You can still use Download backup here.';},20000);
    backupTransfer=cleanup;window.addEventListener('message',receive);
    $('backupStatus').textContent='Opening a separate save window with your prepared backup. Keep this game open until the backup arrives.';
  }
  async function saveBackupAs(){
    if(!backupExport||backupSaving)return;
    if(!nativeBackupPickerAllowed())return openBackupWindow();
    const prepared=backupExport;let writable=null;
    backupSaving=true;$('backupSaveAs').disabled=true;
    $('backupStatus').textContent='Opening the save dialog… If it does not appear, choose Save in new window or Download backup below.';
    try{
      const handle=await window.showSaveFilePicker({suggestedName:prepared.name,startIn:'downloads',types:[{description:'Riffbound song backup',accept:{'application/octet-stream':['.riffpack']}}]});
      $('backupStatus').textContent=prepared.hasVideo?'Saving your audio, charts and video…':'Saving your audio and charts…';
      writable=await handle.createWritable();await writable.write(prepared.blob);await writable.close();writable=null;
      const message=`Backup saved: ${handle.name||prepared.name}. Keep this .riffpack file to restore your song or move it to another device.`;
      $('backupStatus').textContent=message;$('libraryStatus').textContent=message;
    }catch(error){
      if(writable)try{await writable.abort();}catch{}
      const message=error.name==='AbortError'?'Save canceled. Your backup is still ready; choose Download backup or Save backup as… to try again.':'The browser could not open or complete the save dialog. Choose Save in new window to save outside this game panel, or try Download backup.';
      $('backupStatus').textContent=message;$('libraryStatus').textContent=message;
    }finally{backupSaving=false;$('backupSaveAs').disabled=false;}
  }
  function downloadChartFile(blob,name){
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function refreshChartFiles(){
    const current=$('chartAudioMode').value==='current';$('chartAudioLabel').hidden=current;
    $('chartAudioHint').textContent=current?(song?`Use the exact recording: ${song.title}`:'Open a saved song first, or choose an audio file.'):'Select the full matching recording, including the same lead-in. Audio stays on this device.';
    $('chartExportHint').textContent=song?`Export ${song.title}: all Guitar, Bass and Drums difficulties. Put notes.chart, song.ini and the audio in one folder for your editor. Vocal pitch pads stay in .riffpack backups.`:'Open an uploaded or saved song to export its charts and audio.';
    updateButtons();
  }
  function invalidateChartDraft(){chartDraft=null;chartReviewGeneration++;$('chartFileStatus').textContent='Choose Review chart to check these settings.';refreshChartFiles();}
  async function reviewChartFile(){
    if(busy())return;chartDraft=null;const generation=++chartReviewGeneration;updateButtons();
    try{
      const file=$('authoredChartFile').files?.[0];
      if(!file||!/\.(chart|mid)$/i.test(file.name)||file.size<=0||file.size>Exchange.MAX_BYTES)throw Error('Choose a non-empty .chart or .mid file smaller than 4 MB.');
      const isMidi=/\.mid$/i.test(file.name),text=isMidi?await file.arrayBuffer():await file.text();if(generation!==chartReviewGeneration)return;
      const iniFile=$('chartIniFile').files?.[0];let metadata={};
      if(iniFile){if(!/\.ini$/i.test(iniFile.name)||iniFile.size<=0||iniFile.size>Exchange.MAX_INI_BYTES)throw Error('Choose a non-empty song.ini smaller than 64 KB.');metadata=Exchange.parseIni(await iniFile.text());if(generation!==chartReviewGeneration)return;}
      const options=Exchange.settings({metadata,drumLayout:$('chartDrumLayout').value||'auto',shiftMs:$('chartShift').value});
      if(['four','pro'].includes(options.drumLayout)&&!Community?.gameSource(metadata))options.outputDrumLayout='four';
      const parsed=isMidi?Midi.parseAll(text,options):Exchange.parse(text,options);
      chartDraft={parsed,text,filename:file.name+(iniFile?' + '+iniFile.name:'')};
      $('chartFileStatus').textContent=parsed.summary+(iniFile?`\nsong.ini applied: ${Number(metadata.delay)||0} ms chart delay plus ${Number($('chartShift').value)||0} ms additional shift.`:'')+'\n'+parsed.warnings.join('\n')+'\nReady to load with matching audio. No notes have been changed yet.';
    }catch(error){if(generation===chartReviewGeneration)$('chartFileStatus').textContent=error.message;}
    finally{if(generation===chartReviewGeneration)updateButtons();}
  }
  async function loadAuthoredChart(){
    if(busy()||pendingSaves||!chartDraft)return;
    const draft=chartDraft,current=$('chartAudioMode').value==='current',audioFile=$('chartAudioFile').files?.[0],oldSong=song,oldInstrument=instrument;
    if(current&&!song){$('chartFileStatus').textContent='Open a saved song or choose an audio file first.';return;}
    if(!current&&!audioFile){$('chartFileStatus').textContent='Choose the audio file that matches this chart.';return;}
    stopCalibration();stopAudio();previewing=false;practiceLoop=null;playRate=1;clearHeld();state='loading';updateButtons();
    $('chartFileStatus').textContent='Checking the chart against your audio…';
    try{
      let buffer,id,audioBlob,filename,previous;
      if(current){({buffer,id,audioBlob,filename}=song);if(!Library.audioStatus(audioBlob).ok)throw Error(Library.audioStatus(audioBlob).message);previous=song;}
      else{
        const status=Library.audioStatus(audioFile);if(!status.ok)throw Error(status.message);
        const bytes=await audioFile.arrayBuffer();audioBlob=new Blob([bytes],{type:audioFile.type||'audio/wav'});filename=audioFile.name;
        id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        try{buffer=await ensureAudio().decodeAudioData(bytes);}catch{throw Error('This audio could not be opened. Try its WAV or MP3 version.');}
        previous=song?.id===id?song:null;if(!previous)try{previous=await Library.get(id);}catch{}
      }
      const priorCharts={...previous?.charts};
      if(ChartTiming)for(const part of Object.keys(draft.parsed.charts)){const shift=previous?.quality?.chartAdjustments?.[part];if(shift&&priorCharts[part])priorCharts[part]=ChartTiming.shift(priorCharts[part],-shift,buffer.duration);}
      const arranged=Exchange.arrange(draft.parsed,buffer.duration,priorCharts);
      const affected=Object.keys(draft.parsed.charts).filter(part=>Object.values(draft.parsed.charts[part]).some(notes=>notes.length));
      const selected=affected.includes(instrument)?instrument:affected[0],imports={...previous?.quality?.imports};
      for(const part of affected){
        const chartId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(arranged.charts[part])))),b=>b.toString(16).padStart(2,'0')).join('');
        const supplied=Object.keys(draft.parsed.charts[part]),prior=previous?.quality?.imports?.[part];
        imports[part]={id:chartId,filename:draft.filename,layout:part==='drums'&&draft.parsed.playLayout==='four'?'four':draft.parsed.drumLayout,levels:[...new Set([...(prior?.levels||[]),...supplied])],derived:[...new Set([...(prior?.derived||[]),...arranged.derived[part]])].filter(level=>!supplied.includes(level)),derivedFrom:{...prior?.derivedFrom,...arranged.derivedFrom[part]}};
      }
      const samples=buffer.getChannelData(0),waveform=Array.from({length:240},(_,i)=>{let peak=0;const end=Math.floor((i+1)*samples.length/240);for(let j=Math.floor(i*samples.length/240);j<end;j+=32)peak=Math.max(peak,Math.abs(samples[j]));return peak;});
      const quality={...previous?.quality,imports,chartTiming:draft.parsed.timing,chartArtist:draft.parsed.artist,sources:{...previous?.quality?.sources}};
      if(affected.includes('drums'))quality.drumLayout=draft.parsed.playLayout==='four'?'four':'five';
      quality.audioReviews={...quality.audioReviews};quality.chartTimings=timingByPart(previous?.quality);quality.chartAdjustments={...quality.chartAdjustments};quality.timingReviews={...quality.timingReviews};quality.communityReferences={...quality.communityReferences};
      for(const part of affected){quality.sources[part]=null;delete quality.audioReviews[part];quality.chartTimings[part]=draft.parsed.timing;delete quality.chartAdjustments[part];delete quality.timingReviews[part];delete quality.communityReferences[part];}
      if(affected.includes('drums')){delete quality.scoreReview;delete quality.scoreRevision;delete quality.preserveEasyMedium;}
      const record={...previous,id,title:previous?.title||draft.parsed.title||filename.replace(/\.[^.]+$/,''),filename,instrument:selected,musicEnd:buffer.duration,bpm:draft.parsed.bpm,beat:draft.parsed.beat,offset:draft.parsed.timing.offset,charts:arranged.charts,waveform,quality,chartVersion:previous?.chartVersion||1};
      const validated=Library.validate(record);
      song={...validated,buffer,audioBlob,analysisSamples:null};instrument=selected;state='idle';setSongPercussion();newSession();refreshSong();updateUi(0);
      $('chartFilesDialog').close();$('chartStatus').classList.remove('error');$('chartStatus').textContent='Authored chart loaded. Choose a difficulty and Preview chart to check the timing.';setAnnouncement('IMPORTED CHART READY','PREVIEW YOUR NOTES');
      await saveSong();
    }catch(error){song=oldSong;instrument=oldInstrument;state='idle';newSession();refreshSong();updateUi(0);$('chartFileStatus').textContent=error.message;}
    finally{updateButtons();}
  }
  async function openSong(record,preferredInstrument){
    if(busy())return;const persisted=typeof record==='string';
    const publicTrack=persisted?PublicDemos?.list().find(track=>track.id===record):null;let published=false;
    stopCalibration();stopAudio();const generation=playbackGeneration;previewing=false;practiceLoop=null;playRate=1;state='loading';clearHeld();updateButtons();showMessage('');
    try{
      if(typeof record==='string'){
        const id=record;try{record=await Library.get(id);}catch(error){if(!publicTrack)throw error;record=null;}
        if(!record&&publicTrack){setAnnouncement('PUBLIC DEMO','LOADING AUDIO…');record=await PublicDemos.get(id);published=true;}
      }
      if(generation!==playbackGeneration)return;
      if(!record){await refreshSetlist();throw Error('This song is no longer saved. Upload it again to add it to your setlist.');}
      const safe=Library.validate(record),buffer=safe.chartOnly?null:await ensureAudio().decodeAudioData(await record.audioBlob.arrayBuffer());if(generation!==playbackGeneration)return;
      if(!safe.chartOnly&&Math.abs(buffer.duration-safe.musicEnd)>.2)throw Error('The backup audio does not match its chart length.');
      song={...safe,quality:PartCharts.reviewQuality(safe.quality),audioBlob:record.audioBlob,buffer,analysisSamples:null};savedSong=persisted?song:null;
      const aligned=window.RiffAuthoredDrums?.upgrade?await window.RiffAuthoredDrums.upgrade(song):song;
      if(generation!==playbackGeneration)return;
      const drumTimingCorrected=aligned!==song,upgraded=window.RiffReferenceUpdates.upgrade(aligned),corrected=upgraded!==song;song=upgraded;instrument=song.charts[preferredInstrument]?preferredInstrument:safe.instrument;state='idle';setSongPercussion();newSession();refreshSong();updateUi(0);$('libraryDialog').close();setAnnouncement(published?'PUBLIC DEMO READY':'SAVED SONG READY','LET IT RIP.');setSaveStatus(published?'Public demo ready · Play now, or Save current song to keep a personal copy.':'Song ready · Choose your settings, then Play track.');
      if(safe.chartOnly){showMessage('Chart only · Preview notes without music, or attach your audio in Manage songs.');refreshLibrarySaveStatus();}
      if(corrected){showMessage(drumTimingCorrected?window.RiffAuthoredDrums.message(song):window.RiffReferenceUpdates.message(song));if(persisted&&!published)await saveSong();}
      return true;
    }catch(error){if(generation!==playbackGeneration)return;state='idle';newSession();refreshSong();updateUi(0);$('libraryStatus').textContent='Could not open this song. '+error.message;showMessage(error.message);}
    finally{if(generation===playbackGeneration)updateButtons();}
  }
  async function importBackup(file){
    if(!file||busy()||importingBackup)return;importingBackup=true;$('libraryStatus').textContent='Reading your backup…';
    try{
      const record=await Library.unpack(file),hash=record.chartOnly?null:await crypto.subtle.digest('SHA-256',await record.audioBlob.arrayBuffer());
      const id=hash?Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''):record.id;if(id!==record.id)throw Error('The audio in this backup is damaged or does not match its song.');
      if(!await openSong(record)||song?.id!==record.id)return;
      await saveSong();
      let videoMessage='';
      if(record.background){
        if(!window.RiffBackground?.restore)throw Error('The chart was imported. Update Riffbound to restore the video from this combined backup.');
        videoMessage=await window.RiffBackground.restore(record.id,record.background);
      }
      if(!record.chartOnly)await checkBackupCommunity();
      if(videoMessage)showMessage(videoMessage);
    }catch(error){$('libraryStatus').textContent=error.message;}
    finally{importingBackup=false;$('backupFile').value='';updateButtons();}
  }
  async function checkBackupCommunity(){
    if(!communityLookup||!Community||!song)return;
    const q=song.quality||{},targets=Object.keys(song.charts).filter(part=>!q.imports?.[part]&&q.audioReviews?.[part]?.estimated!==false&&!Object.hasOwn(q.chartAdjustments||{},part)&&!(part==='drums'&&q.scoreReview));
    if(!targets.length)return;
    // The backup's identity belongs to its audio. Upload-form fields can still
    // describe a different song and must never direct an imported backup search.
    const identity=existingChartIdentity(),generation=++uploadGeneration,selected=instrument;
    stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();$('uploadProgress').hidden=false;
    try{
      const samples=song.analysisSamples||await prepareSamples(song.buffer);
      if(generation!==uploadGeneration)return;
      const result=await uploadCharts({name:song.filename||song.title},song.buffer,samples,targets,generation,song.id,identity,{authoredOnly:true});
      if(generation!==uploadGeneration)return;
      const lookup={...result.quality.onlineLookup,message:(result.quality.onlineLookup.message||'Community check completed.').replace(/Used audio charting\./g,'Your backup charts are kept.').replace(/Audio charting used for ([^.]+)\./g,'Existing backup charts are kept for $1.')};
      if(Object.keys(result.charts).length){
        applyChartResult({...result,bpm:song.bpm,beat:song.beat,offset:song.offset,chartVersion:Math.max(song.chartVersion||1,result.chartVersion||1)},samples);
        instrument=selected;song.instrument=selected;setSongPercussion();newSession();refreshSong();updateUi(0);
      }
      song={...song,quality:{...song.quality,lookupIdentity:result.quality.lookupIdentity,onlineLookup:lookup}};
      state='idle';await saveSong();
      $('chartStatus').textContent=lookup.message;showMessage(lookup.message);
    }catch(error){if(generation===uploadGeneration){state='idle';$('chartStatus').textContent='Community check could not complete. Your imported backup charts are kept. '+error.message;showMessage($('chartStatus').textContent);}}
    finally{if(generation===uploadGeneration){state='idle';$('uploadProgress').hidden=true;updateButtons();}}
  }
  function preferences(){try{localStorage.setItem('riffbound-preferences-v1',JSON.stringify({timingOffset,highwaySpeed,volume,muted,preMute,showHitTiming,communityLookup,sheetMusicLookup,...(uploadTargetExplicit?{uploadInstrument}:{})}));return true;}catch{return false;}}
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
  function openTool(id){if(busy()||resuming)return;if(running())pause({showMenu:false});closePauseMenu();$(id).showModal();}
  function audioFileError(file){return !file?'Choose an audio file first.':file.size>80*1024*1024||file.size===0?'Choose a non-empty audio file up to 80 MB.':'';}
  function canReuseOpenAudio(){return !!song?.buffer&&Library.audioStatus(song.audioBlob).ok;}
  async function findSongWithoutAudio(identity,targets,scoreFile=null){
    if(!Community&&!SheetMusic){$('addSongError').textContent='Chart search is unavailable. Check for game updates.';return;}
    const generation=++uploadGeneration,previous=song,controller=new AbortController();cancelLookup=()=>controller.abort();
    stopAudio();previewing=false;clearHeld();state='analyzing';updateButtons();$('uploadProgress').hidden=false;$('chartStatus').classList.remove('error');
    uploadProgress(5,`Finding charts for ${identity.title} by ${identity.artist}…`);
    try{
      let found=identity.title&&identity.artist&&Community?await Community.lookup({...identity,parts:targets,chartOnly:true,includeAudio:true,enabled:true,signal:controller.signal,onProgress:label=>uploadProgress(12,label)}):{charts:{},imports:{},sources:{},references:{},timings:{},message:''};if(generation!==uploadGeneration)return;
      if(SheetMusic)found=await SheetMusic.fill(found,{...identity,parts:targets,scoreFile,enabled:sheetMusicLookup,duration:found.audioContainer||Object.keys(found.charts||{}).length?found.duration:undefined,signal:controller.signal,onProgress:label=>uploadProgress(20,label)});if(generation!==uploadGeneration)return;
      const authoredParts=targets.filter(p=>found.charts?.[p]?.expert?.length);
      if(!authoredParts.length&&!found.audioContainer)throw Error(found.message||'No supported chart or matching audio found for this song.');
      let audio=null,buffer=null,samples=null,audioIssue='',generated=null,estimateIssue='';const packageDrums=new Map();let packageDrumSamples=null,usedPackageDrums=false;
      if(found.audioContainer&&Community.songAudio&&SongAudio)try{
        const OfflineCtor=window.OfflineAudioContext||window.webkitOfflineAudioContext,offline=OfflineCtor?new OfflineCtor(2,Math.ceil(found.duration*22050),22050):null,decoder=typeof offline?.decodeAudioData==='function'?offline:ensureAudio();
        let audioProgress=30;audio=await SongAudio.build(Community.songAudio(found.audioContainer,{signal:controller.signal,onProgress:(value,label)=>{audioProgress=30+value*50;uploadProgress(audioProgress,label);}}),{duration:found.duration,signal:controller.signal,decode:async(bytes,info)=>{const decoded=await decoder.decodeAudioData(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(!authoredParts.includes('drums')&&targets.includes('drums')&&/^(drums(?:_[1-4])?)\./i.test(info.name)&&Recording?.pcm&&Recording.addStem){packageDrumSamples=Recording.addStem(packageDrumSamples,Recording.pcm(decoded));packageDrums.set(info.name,true);}return decoded;},onProgress:label=>uploadProgress(audioProgress,label)});
        if(generation!==uploadGeneration)return;uploadProgress(85,'Loading matching song audio…');buffer=await ensureAudio().decodeAudioData(await audio.blob.arrayBuffer());if(Math.abs(buffer.duration-audio.duration)>.2)throw Error('The prepared audio could not be decoded completely.');
        if(authoredParts.length)Library.validate({id:'0'.repeat(64),title:found.identity.title,instrument:authoredParts[0],musicEnd:buffer.duration,bpm:found.bpm||120,beat:found.beat||.5,charts:PartCharts.only(found.charts,authoredParts),quality:{imports:Object.fromEntries(authoredParts.map(p=>[p,{...found.imports[p],id:'0'.repeat(64)}]))}});
      }catch(error){if(controller.signal.aborted||generation!==uploadGeneration)throw Error('Canceled');audio=null;buffer=null;audioIssue=error.message;}
      if(generation!==uploadGeneration)return;
      if(!audio&&!authoredParts.length)throw Error('Matching song audio could not be loaded. '+(audioIssue||found.message));
      const chartDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('chart-only:'+JSON.stringify([found.identity,found.duration]))),digest=audio?await crypto.subtle.digest('SHA-256',await audio.blob.arrayBuffer()):chartDigest;if(generation!==uploadGeneration)return;
      const chartId=Array.from(new Uint8Array(chartDigest),b=>b.toString(16).padStart(2,'0')).join('');
      const id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),imports={};
      for(const part of authoredParts){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(found.charts[part])));imports[part]={...found.imports[part],id:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};}
      const missing=targets.filter(p=>!authoredParts.includes(p));
      if(audio&&missing.length)try{
        uploadProgress(86,`No supported authored ${missing.join(', ')} chart found. Charting the downloaded song audio…`);
        samples=await prepareSamples(buffer);if(generation!==uploadGeneration)return;
        let drumInput=null;if(missing.includes('drums')&&packageDrums.size&&Recording?.alignStems)try{drumInput=Recording.alignStems([packageDrumSamples],buffer.duration);}catch{}
        usedPackageDrums=!!drumInput;
        generated=await analyzeParts(samples,missing,generation,id,true,drumInput?{drums:{samples:drumInput,wholeSong:false}}:{});
      }catch(error){if(controller.signal.aborted||generation!==uploadGeneration)throw Error('Canceled');estimateIssue=error.message;}
      if(generation!==uploadGeneration)return;
      const estimatedParts=targets.filter(p=>generated?.charts?.[p]?.expert?.length),charts={...PartCharts.only(found.charts,authoredParts),...PartCharts.only(generated?.charts,estimatedParts)},parts=targets.filter(p=>charts[p]?.expert?.length);
      const drumLayout=found.drumLayout||D.drumLayout({communityReferences:found.references});
      if(charts.drums&&drumLayout==='four')charts.drums=D.fourDrumLevels(charts.drums);
      if(!parts.length)throw Error('Song audio was found, but its chart could not be built. '+estimateIssue);
      let prior=previous?.chartOnly&&previous.id===id?previous:null;if(!prior)try{prior=await Library.get(id);}catch{}if(generation!==uploadGeneration)return;
      const unavailable=targets.filter(p=>!parts.includes(p));
      const message=audio?(found.sheetMusic?found.message+' ':'')+'Matching bundled audio loaded. '+(authoredParts.length?`Authored ${authoredParts.join(', ')} chart loaded. `:'')+(estimatedParts.length?`No supported authored ${estimatedParts.join(', ')} chart found in Clone Hero; built from the downloaded song audio (estimate). `:'')+'Ready to play; preview timing.'+(unavailable.length?` No usable ${unavailable.join(', ')} chart: ${estimateIssue||Object.values(generated?.quality?.unavailable||{}).join(' ')||'unavailable'}.`:''):found.message+(audioIssue?' Audio could not be included: '+audioIssue:'');
      // Estimated parts never inherit an unrelated authored import, reference,
      // offset or verification receipt from another instrument or older chart.
      const priorQ=prior?.quality||{},generatedQ=generated?.quality||{},keep=map=>Object.fromEntries(Object.entries(map||{}).filter(([part])=>!estimatedParts.includes(part)));
      const quality={...priorQ,...generatedQ,...(found.sheetMusic?{sheetMusic:found.sheetMusic}:{}),...(charts.drums?{drumLayout}:{}),lookupIdentity:found.identity,imports:{...keep(priorQ.imports),...imports},sources:{...keep(priorQ.sources),...found.sources,...Object.fromEntries(estimatedParts.map(p=>[p,`${partName(p)} audio estimate from downloaded song`]))},communityReferences:{...keep(priorQ.communityReferences),...found.references},chartTimings:{...keep(priorQ.chartTimings),...found.timings},chartAdjustments:keep(priorQ.chartAdjustments),timingReviews:keep(priorQ.timingReviews),mixAnalysis:{...keep(priorQ.mixAnalysis),...generatedQ.mixAnalysis},audioReviews:{...keep(priorQ.audioReviews),...Object.fromEntries(estimatedParts.map(p=>[p,{...generatedQ.audioReviews?.[p],estimated:true,recordingId:id}])),...(audio?Object.fromEntries(authoredParts.map(p=>[p,{policy:found.scoreParts?.includes(p)?'sheet-music-timing-review-v1':'authored-package-audio-v1',estimated:false,timingVerified:false,recordingId:id,sourceMd5:found.references[p].md5}])):{})},...(audio?{packageAudio:{sourceMd5:found.reference.md5,setlist:found.reference.setlist,files:audio.files,sampleRate:audio.sampleRate}}:{}),onlineLookup:{message,searchMessage:found.message,availableParts:found.availableParts,attempts:found.attempts,issues:found.issues},methods:{...priorQ.methods,...generatedQ.methods,...Object.fromEntries(authoredParts.map(p=>[p,found.scoreParts?.includes(p)?'Sheet music converted to colored lanes':'Authored community chart']))}};
      if(estimatedParts.includes('drums')&&usedPackageDrums){quality.sources.drums='Drums estimate from this package’s isolated Drum audio';quality.audioReviews.drums={...quality.audioReviews.drums,policy:'package-drum-stem-estimate-v1',referenceInstrument:'drums',referenceFiles:[...packageDrums.keys()],sourceMd5:found.reference.md5};quality.methods.drums='Own Drum stem audio analysis';}
      if(estimatedParts.includes('drums'))for(const key of ['scoreReview','scoreRevision','scoreReference','preserveEasyMedium'])if(generatedQ[key]===undefined)delete quality[key];
      const selected=parts.includes(instrument)?instrument:parts[0],record={...prior,id,chartOnly:!audio,title:found.identity.title,filename:audio?found.identity.title+'.wav':found.identity.title,instrument:selected,musicEnd:buffer?.duration||found.duration,duration:(buffer?.duration||found.duration)+.8,bpm:found.bpm||generated?.bpm||120,beat:found.beat||generated?.beat||.5,offset:found.timing?.offset||0,charts:{...prior?.charts,...charts},waveform:audio?.waveform||[],quality};
      song={...Library.validate(record),buffer,audioBlob:audio?.blob||null,analysisSamples:samples};instrument=selected;state='idle';setSongPercussion();newSession();refreshSong();updateUi(0);
      $('addSongDialog').close();$('chartStatus').textContent=message;showMessage(audio?'Song audio and chart ready · Preview or Play track.':'Chart only · Preview notes without music, or attach your audio in Manage songs.');await saveSong();
      if(audio&&savedSong===song&&chartId!==id)try{const old=await Library.get(chartId);if(old?.chartOnly&&Object.keys(old.charts).every(part=>parts.includes(part))){await Library.remove(chartId);await refreshSetlist();}}catch{}
    }catch(error){if(generation!==uploadGeneration)return;state='idle';$('chartStatus').textContent=error.message;$('addSongError').textContent=error.message;setSetlistMessage(error.message,true);$('addSongDialog').showModal();}
    finally{if(generation===uploadGeneration){cancelLookup=null;$('uploadProgress').hidden=true;updateButtons();}}
  }
  async function chartOpenSong(targets,identity,{scoreFile=null}={}){
    const owner=song,generation=++uploadGeneration;
    stopAudio();previewing=false;practiceLoop=null;playRate=1;clearHeld();state='analyzing';updateButtons();
    $('chartStatus').classList.remove('error');$('uploadProgress').hidden=false;$('chartPreview').hidden=true;
    uploadProgress(5,`Using the open audio for ${owner.title}…`);setAnnouncement('YOUR SONG','BUILDING CHARTS…');
    try{
      const samples=owner.analysisSamples||await prepareSamples(owner.buffer);if(generation!==uploadGeneration||song!==owner)return;
      const result=await uploadCharts({name:owner.filename||owner.title},owner.buffer,samples,targets,generation,owner.id,identity,{scoreFile});if(generation!==uploadGeneration||song!==owner)return;
      applyChartResult(result,samples);instrument=result.instrument;song.instrument=instrument;setSongPercussion();state='idle';newSession();refreshSong();updateUi(0);
      uploadProgress(100,readyMessage(result));setAnnouncement('CHARTS READY','CHOOSE YOUR PART');await saveSong();
    }catch(error){if(generation!==uploadGeneration)return;state='idle';reset();refreshSong();$('chartStatus').textContent=error.message+' Your current chart is kept.';$('chartStatus').classList.add('error');setSetlistMessage($('chartStatus').textContent,true);}
    finally{if(generation===uploadGeneration){$('uploadProgress').hidden=true;updateButtons();}}
  }
  function openAddSong(){
    if(active()||pendingSaves||importingBackup)return;
    $('libraryDialog').close();$('addSongFile').value='';$('addScoreFile').value='';$('addSongPart').value=uploadInstrument;$('addSongError').textContent='';$('addLookupTitle').value='';$('addLookupArtist').value='';
    updateButtons();$('addSongDialog').showModal();
  }
  async function addSongFromDialog(){
    if(active()||pendingSaves||importingBackup)return;
    const file=$('addSongFile').files?.[0],scoreFile=$('addScoreFile').files?.[0],part=$('addSongPart').value;
    const hasIdentity=!!$('addLookupTitle').value.trim()&&!!$('addLookupArtist').value.trim();
    const reuseOpenAudio=canReuseOpenAudio()&&!$('addLookupTitle').value.trim()&&!$('addLookupArtist').value.trim();
    const error=(file?audioFileError(file):hasIdentity||reuseOpenAudio||scoreFile?'':'Enter both song title and artist, choose audio, or choose a MusicXML score.')||(![...PARTS,'whole'].includes(part)?'Choose a part to chart.':'');
    if(error){$('addSongError').textContent=error;return;}
    if(scoreFile&&(!scoreFile.size||scoreFile.size>4*1024*1024||!/^.+\.(musicxml|xml)$/i.test(scoreFile.name||''))){$('addSongError').textContent='Choose an uncompressed MusicXML score up to 4 MB.';return;}
    // Pass the new song's choices directly. Changing the current instrument
    // here would rebuild or save the previously open song before picking audio.
    if(PARTS.includes(part))chooseUploadInstrument(part,{switchExisting:false});
    const targets=part==='whole'?PARTS.slice():[part],identity={title:$('addLookupTitle').value.trim(),artist:$('addLookupArtist').value.trim()};
    if(!file&&!hasIdentity&&reuseOpenAudio){const stored=existingChartIdentity();identity.title||=stored.title;identity.artist||=stored.artist;}
    $('addSongDialog').close();$('addSongFile').value='';$('addScoreFile').value='';
    $('addSongButton').scrollIntoView?.({block:'start'});
    if(file)await uploadSong(file,targets,identity,{scoreFile});else if(hasIdentity||scoreFile&&!reuseOpenAudio)await findSongWithoutAudio(identity,targets,scoreFile);else await chartOpenSong(targets,identity,{scoreFile});
  }
  $('addSheetMusicLookup').checked=sheetMusicLookup;
  $('addSheetMusicLookup').addEventListener('change',()=>{sheetMusicLookup=$('addSheetMusicLookup').checked;preferences();});
  $('addScoreFile').addEventListener('change',()=>{$('addSongError').textContent='';updateButtons();});
  $('addCommunityLookup').checked=communityLookup;
  $('addCommunityLookup').addEventListener('change',()=>{communityLookup=$('addCommunityLookup').checked;preferences();});
  $('addSongButton').addEventListener('click',openAddSong);
  $('libraryAddSong').addEventListener('click',openAddSong);
  $('addSongFile').addEventListener('change',()=>{$('addSongError').textContent='';updateButtons();});
  for(const id of ['addLookupTitle','addLookupArtist'])$(id).addEventListener('input',()=>{$('addSongError').textContent='';updateButtons();});
  $('confirmAddSong').addEventListener('click',addSongFromDialog);
  $('setlistCancelUpload').addEventListener('click',cancelUpload);
  $('setlistRetrySave').addEventListener('click',()=>{if(!busy()&&!pendingSaves)return saveSong();});
  $('setlistExportBackup').addEventListener('click',()=>{try{return exportSong();}catch(error){setSetlistMessage(error.message,true);}});
  $('libraryButton').addEventListener('click',()=>{openTool('libraryDialog');refreshLibrary();refreshSetlist();});
  $('setlistSearch').addEventListener('input',renderSetlist);
  window.addEventListener('focus',()=>{if(!active())refreshSetlist();});
  $('saveCurrentButton').addEventListener('click',saveSong);
  for(const [id,target] of PARTS.map(part=>['libraryUpload'+partName(part),part]))$(id).addEventListener('click',()=>{if(song||active())return;$('chartScope').value='single';chooseUploadInstrument(target);$('libraryDialog').close();pickSongFile();});
  $('reconnectAudioButton').addEventListener('click',()=>{$('reconnectAudioFile').click();});
  $('reconnectAudioFile').addEventListener('change',()=>reconnectOriginalAudio($('reconnectAudioFile').files[0]));
  $('exportCurrentButton').addEventListener('click',()=>{try{return exportSong();}catch(error){$('libraryStatus').textContent=error.message;}});
  $('backupSaveAs').addEventListener('click',saveBackupAs);
  $('backupNewWindow').addEventListener('click',openBackupWindow);
  $('backupDownload').addEventListener('click',()=>{
    const message='Download requested. Check your browser’s Downloads list. If no file appears, use Save backup as… or open the game in a new tab and export again.';
    $('backupStatus').textContent=message;$('libraryStatus').textContent=message;
  });
  window.addEventListener('pagehide',event=>{if(!event.persisted){if(backupExport)URL.revokeObjectURL(backupExport.url);if(backupTransfer)backupTransfer();}});
  $('importBackupButton').addEventListener('click',()=>{$('backupFile').click();});
  $('backupFile').addEventListener('change',()=>importBackup($('backupFile').files[0]));
  $('chartFilesButton').addEventListener('click',()=>{$('chartAudioMode').value=song?'current':'file';openTool('chartFilesDialog');refreshChartFiles();});
  for(const id of ['authoredChartFile','chartIniFile','chartDrumLayout','chartShift'])$(id).addEventListener('change',invalidateChartDraft);
  $('chartShift').addEventListener('input',invalidateChartDraft);
  $('chartAudioMode').addEventListener('change',refreshChartFiles);
  $('applySongChartShift').addEventListener('click',()=>applySongTiming($('songChartShift').value));
  $('resetSongChartShift').addEventListener('click',()=>applySongTiming(0));
  $('reviewSongTiming').addEventListener('click',checkSongTiming);
  $('applyTimingSuggestion').addEventListener('click',()=>{const suggested=song?.quality?.timingReviews?.[instrument]?.suggestedMs;if(Number.isFinite(suggested))return applySongTiming((song.quality.chartAdjustments?.[instrument]||0)+suggested);});
  $('reviewChartButton').addEventListener('click',reviewChartFile);
  $('loadChartButton').addEventListener('click',loadAuthoredChart);
  for(const [id,kind] of [['exportChartButton','chart'],['exportChartIniButton','ini'],['exportChartAudioButton','audio']])$(id).addEventListener('click',()=>{
    if(!song||busy())return;
    try{
      if(kind==='audio'){if(!Library.audioStatus(song.audioBlob).ok)throw Error('The original audio is unavailable.');downloadChartFile(song.audioBlob,Exchange.audioFilename(song));}
      else downloadChartFile(new Blob([kind==='chart'?Exchange.exportChart(song):Exchange.exportIni(song)],{type:'text/plain;charset=utf-8'}),kind==='chart'?'notes.chart':'song.ini');
      $('chartFileStatus').textContent=kind==='audio'?'Original audio downloaded.':kind==='chart'?'notes.chart downloaded. Also download song.ini and audio into the same folder.':'song.ini downloaded with five-lane drum settings.';
    }catch(error){$('chartFileStatus').textContent=error.message;}
  });
  function refreshPracticeSections(selected=$('practiceSection')?.value||'custom'){
    if(!$('practiceSection')||!Sections)return;
    const owner=[song?.id||'demo',instrument].join(':');if(owner!==practiceSectionsOwner){selected='custom';practiceSectionsOwner=owner;$('loopStart').value='0';$('loopEnd').value=String(Math.min(15,song?.musicEnd??E.MUSIC_END));if($('practiceSectionName'))$('practiceSectionName').value='';$('practiceStatus').textContent='';}
    const demoMarkers=[['Intro',0],['Main riff',16],['Breakdown',48],['Guitar solo',80],['Final riff',112]].map(([name,beats])=>({name,time:beats*E.BEAT}));
    practiceSections=song?Sections.forSong(song,instrument):Sections.build({duration:E.MUSIC_END,beat:E.BEAT,markers:demoMarkers});
    const picker=$('practiceSection');picker.replaceChildren();
    const option=(value,label)=>{const el=document.createElement('option');el.value=value;el.textContent=label;picker.append(el);return el;};
    option('custom','Custom range — use the times below');option('whole','Entire song');
    const notes=chartNotes();
    for(const section of practiceSections){const count=notes.filter(note=>note.time>=section.start&&note.time<section.end).length;const row=option(section.id,`${section.name}${section.source==='saved'?' (saved)':''} · ${formatTime(section.start)}–${formatTime(section.end)} · ${count} ${count===1?'note':'notes'}`);row.disabled=!count;}
    picker.value=['custom','whole',...practiceSections.map(section=>section.id)].includes(selected)?selected:'custom';
    const authored=practiceSections.some(section=>section.source==='chart');
    if($('practiceSectionHint'))$('practiceSectionHint').textContent=authored?'Section names come from this instrument’s chart. Choose one to fill its start and end times.':'This chart has no named sections. Timed sections are available; save a range below as Verse 1, Chorus, Solo or any name you choose.';
    if($('practiceSectionEditor'))$('practiceSectionEditor').hidden=!song;
    if($('removePracticeSection'))$('removePracticeSection').hidden=!picker.value.startsWith('saved:');
  }
  function choosePracticeSection(){
    const value=$('practiceSection').value,range=value==='whole'?{start:0,end:song?.musicEnd??E.MUSIC_END,name:''}:practiceSections.find(section=>section.id===value);
    if(range){$('loopStart').value=String(range.start);$('loopEnd').value=String(range.end);if($('practiceSectionName'))$('practiceSectionName').value=range.name;$('practiceStatus').textContent=value==='whole'?'The entire song will repeat.':`${range.name}: ${formatTime(range.start)}–${formatTime(range.end)}. Choose a speed, then Start practice.`;}
    if($('removePracticeSection'))$('removePracticeSection').hidden=!value.startsWith('saved:');
  }
  async function storePracticeSection(remove=false){
    if(!song||!Sections||busy()||pendingSaves)return;
    try{
      const selected=practiceSections.find(section=>section.id===$('practiceSection').value),name=$('practiceSectionName').value.trim(),current=song.practiceSections||[];
      if(remove&&selected?.source!=='saved')return;
      const candidate=remove?null:Sections.ranges([{name,start:Number($('loopStart').value),end:Number($('loopEnd').value)}],song.musicEnd)[0];
      const next=remove?current.filter((_,index)=>index!==Number(selected.id.slice(6))):[...current.filter(section=>section.name.toLocaleLowerCase()!==candidate.name.toLocaleLowerCase()),candidate];
      const validated=Sections.ranges(next,song.musicEnd);song={...song,practiceSections:validated};const owner=song;await saveSong();
      const saved=validated.findIndex(section=>section.name===candidate?.name);refreshPracticeSections(!remove&&saved>=0?'saved:'+saved:'custom');
      $('practiceStatus').textContent=savedSong===owner?(remove?'Saved practice section removed.':`${name} saved with this song in your setlist.`):'The section change is kept for this session. '+$('saveStatus').textContent;
    }catch(error){$('practiceStatus').textContent=error.message;}
  }
  $('practiceSection')?.addEventListener('change',choosePracticeSection);
  for(const id of ['loopStart','loopEnd'])$(id).addEventListener('input',()=>{if($('practiceSection'))$('practiceSection').value='custom';if($('removePracticeSection'))$('removePracticeSection').hidden=true;});
  $('savePracticeSection')?.addEventListener('click',()=>storePracticeSection());
  $('removePracticeSection')?.addEventListener('click',()=>storePracticeSection(true));
  function openPractice(useMiss=false){
    if(busy()||song?.chartOnly)return;
    const section=T.missedSection?.(lastMissTime,song?.musicEnd??E.MUSIC_END);
    if(useMiss&&!section){showMessage('Play a section first. Missed notes can then be selected for practice.');return;}
    refreshPracticeSections();
    if(useMiss){$('loopStart').value=String(section.start);$('loopEnd').value=String(section.end);if($('practiceSection'))$('practiceSection').value='custom';if($('practiceSectionName'))$('practiceSectionName').value='';if($('removePracticeSection'))$('removePracticeSection').hidden=true;$('practiceStatus').textContent=`Last missed note at ${formatTime(lastMissTime)}. Practice ${formatTime(section.start)}–${formatTime(section.end)}, or adjust the range.`;}
    if(!Number.isFinite(Number($('practiceRate').value))||Number($('practiceRate').value)<.25)$('practiceRate').value='0.75';
    if($('resultDialog').open)$('resultDialog').close();openTool('practiceDialog');
    if($('practiceMissButton'))$('practiceMissButton').disabled=!section||previewing;
  }
  $('practiceButton').addEventListener('click',()=>openPractice());
  $('practiceMissButton')?.addEventListener('click',()=>openPractice(true));
  $('resultPracticeMiss')?.addEventListener('click',()=>openPractice(true));
  $('resultChooseSection')?.addEventListener('click',()=>openPractice());
  $('practiceLaunch').addEventListener('click',()=>{const start=Number($('loopStart').value),end=Number($('loopEnd').value);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<1||end>(song?.musicEnd??E.MUSIC_END)){$('practiceStatus').textContent='Choose at least one second inside this song.';return;}const loop=T.practice(start,end,$('practiceRate').value,song?.musicEnd??E.MUSIC_END);if(!T.segment(chartNotes(),loop).length){$('practiceStatus').textContent='There are no charted notes here. Choose another section.';return;}$('practiceDialog').close();play({practice:true});});
  $('timingButton').addEventListener('click',()=>{$('timingOffset').value=String(timingOffset);$('timingOffsetValue').textContent=`${timingOffset} ms`;openTool('timingDialog');});
  $('calibrationStart').addEventListener('click',startCalibration);
  $('calibrationTap').addEventListener('pointerdown',event=>{event.preventDefault();calibrationTap();});
  $('calibrationTap').addEventListener('click',event=>{if(event.detail===0)calibrationTap();});
  $('timingOffset').addEventListener('input',()=>{$('timingOffsetValue').textContent=`${$('timingOffset').value} ms`;});
  $('calibrationSave').addEventListener('click',()=>{timingOffset=Math.max(-250,Math.min(250,Number($('timingOffset').value)||0));stopCalibration();const saved=preferences();$('timingDialog').close();showMessage(saved?'Timing saved for this device.':'Timing applied for this session; browser storage is unavailable.');});
  $('calibrationReset').addEventListener('click',()=>{stopCalibration();timingOffset=0;$('timingOffset').value='0';$('timingOffsetValue').textContent='0 ms';preferences();});
  if($('showHitTiming')){$('showHitTiming').checked=showHitTiming;$('showHitTiming').addEventListener('change',()=>{showHitTiming=$('showHitTiming').checked;if(!showHitTiming)$('hitTiming')?.classList.remove('show');preferences();});}
  for(const event of ['close','cancel'])$('timingDialog').addEventListener(event,stopCalibration);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&calibrationTest){stopCalibration();$('calibrationStatus').textContent='Calibration stopped when the app was hidden. Start again when ready.';}});
  $('highwaySpeed').value=String(highwaySpeed);$('highwaySpeedValue').textContent=`${highwaySpeed.toFixed(1)}×`;
  $('highwaySpeed').addEventListener('input',()=>{highwaySpeed=Math.max(.7,Math.min(1.6,Number($('highwaySpeed').value)||1));$('highwaySpeedValue').textContent=`${highwaySpeed.toFixed(1)}×`;preferences();});
  $('offlineButton').addEventListener('click',()=>openTool('offlineDialog'));
  $('backgroundButton')?.addEventListener('click',()=>{openTool('backgroundDialog');window.RiffBackground?.showTimingFrame?.();});
  $('backgroundDialog')?.addEventListener('close',()=>refreshSetlist());
  $('backgroundSaveSetlist')?.addEventListener('click',async()=>{
    if(busy()||backupSaving||exportingVideo||!song)return;
    const owner=song;savingSetlistVideo=true;updateButtons();
    try{
      if(savedSong!==owner)await saveSong();
      if(song!==owner||savedSong!==owner)throw Error('Save the song to your setlist first. '+$('saveStatus').textContent);
      if(!await window.RiffBackground.saveToSetlist(owner.id))throw Error($('backgroundStatus').textContent||'The video could not be saved. Free some device storage and retry.');
      await refreshSetlist();
      const message=window.RiffBackground.linked?'Video link and timing saved with this song in your setlist. Internet access is required to play it.':'Video and timing saved with this song in your setlist on this device.';
      $('backgroundStatus').textContent=message;setSaveStatus(message);showMessage(message);
    }catch(error){$('backgroundStatus').textContent=error.message;showMessage(error.message);}
    finally{savingSetlistVideo=false;updateButtons();}
  });
  $('backgroundPreviewTiming')?.addEventListener('click',async()=>{
    if(busy()||window.RiffBackground?.mode!=='video')return;
    await window.RiffBackground?.commitTiming?.();
    if(busy())return;
    $('backgroundDialog').close();
    return play({preview:true,offset:Number.isFinite(videoChartStart)?Math.max(0,videoChartStart-2):0});
  });
  $('backgroundExportVideo')?.addEventListener('click',async()=>{
    if(busy()||backupSaving||exportingVideo)return;
    if(!song){$('backgroundStatus').textContent='Open an uploaded or saved song before saving a chart + video backup.';return;}
    const owner=song;exportingVideo=true;updateButtons();
    try{const attachment=await window.RiffBackground.attachment(owner.id);if(song!==owner)throw Error('The song changed before its video backup was ready.');exportSong(owner,attachment);}
    catch(error){$('backgroundStatus').textContent=error.message;}
    finally{exportingVideo=false;updateButtons();}
  });

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
  function stopAudio(){closePauseMenu();resuming=false;window.RiffBackground?.pause();playbackGeneration++;if(source){try{source.stop();}catch{}source.disconnect();source=null;}for(const node of countNodes){try{node.stop();}catch{}node.disconnect();}countNodes.length=0;}
  async function play({preview=false,offset=0,practice=false,practiceSettings=null}={}){
    if(busy())return;
    if(song?.chartOnly&&!preview){showMessage('Attach your audio in Manage songs for song playback. You can preview these notes without music.');return;}
    if(!song&&instrument==='vocals'){showMessage('Iron Voltage is instrumental. Upload a song with vocals to build a vocal melody chart.');return;}
    if(state==='paused'&&!previewing&&!preview&&!practice){resume();return;}
    stopCalibration();
    const selected=practiceSections.find(section=>section.id===$('practiceSection')?.value);
    practiceLoop=practice?{...T.practice(practiceSettings?.start??$('loopStart').value,practiceSettings?.end??$('loopEnd').value,practiceSettings?.rate??$('practiceRate').value,song?.musicEnd??E.MUSIC_END),repeat:practiceSettings?.repeat??($('practiceRepeat')?.checked===true),name:practiceSettings?.name??(selected?.name||($('practiceSection')?.value==='whole'?'Entire song':'Custom section'))}:null;
    playRate=practiceLoop?.rate??1;loopCycle=0;practicePass=1;
    previewing=preview;
    stopAudio();newSession();showMessage('');
    const playback=playbackGeneration;
    state='loading';updateButtons();updateUi(practiceLoop?.start??0);setAnnouncement('PLUGGING IN THE AMPS','TUNING UP…');
    try{
      ensureAudio();
      await audioContext.resume();master.gain.value=muted?0:volume;
      if(!song&&!musicBuffer)musicBuffer=await composeTrack(audioContext);
      if(playback!==playbackGeneration)return;
      const seek=practiceLoop?.start??(preview?Math.max(0,Math.min(offset,(song?.musicEnd??E.MUSIC_END)-.1)):0),lead=preview?0:4*trackBeat()/playRate;
      if(window.RiffBackground?.prepare){
        if(window.RiffBackground.mode==='video')setAnnouncement('PREPARING VIDEO',window.RiffBackground.youtube?'QUEUING YOUTUBE VIDEO…':'MATCHING START FRAME…');
        await window.RiffBackground.prepare({time:videoPosition(seek),rate:playRate});
        if(playback!==playbackGeneration)return;
      }
      // Close sheets before starting, including restart from the results screen.
      if($('resultDialog').open)$('resultDialog').close();
      const audioStart=audioContext.currentTime+.15+lead;startTime=audioStart;transportSeek=seek;
      source=audioContext.createBufferSource();source.buffer=song?.chartOnly?audioContext.createBuffer(1,Math.ceil(song.musicEnd*8000),8000):song?.buffer??musicBuffer;
      source.playbackRate.value=playRate;if(practiceLoop){source.loop=practiceLoop.repeat;source.loopStart=practiceLoop.start;source.loopEnd=practiceLoop.end;}
      source.connect(master);if(practiceLoop&&!practiceLoop.repeat)source.start(audioStart,seek,practiceLoop.end-practiceLoop.start);else source.start(audioStart,seek);
      if(!preview)for(let i=0;i<4;i++)countClick(audioStart-(4-i)*trackBeat()/playRate,i===3);
      else for(const n of session.notes)if(n.time<seek){n.hit=true;n.held=n.time+n.duration>seek;}
      state=preview?'playing':'countin';session.lastTime=preview?seek:seek-4*trackBeat();updateButtons();
      if(document.hidden)pause();
    }catch(err){
      if(playback!==playbackGeneration)return;
      state='idle';previewing=false;practiceLoop=null;playRate=1;stopAudio();updateButtons();setAnnouncement(err.backgroundVideo?'VIDEO NOT READY':'AUDIO COULD NOT START','TRY AGAIN');
      showMessage(err.backgroundVideo?err.message:'Sound could not start. Try Play track again, or open this game in a current Chrome, Edge, Firefox, or Safari browser.');
    }
  }
  function closePauseMenu(){if($('pauseDialog')?.open)$('pauseDialog').close();}
  function showPauseMenu(){
    const dialog=$('pauseDialog');if(!dialog||dialog.open||state!=='paused'||controllerModalOpen())return;
    $('pauseSummary').textContent=`${song?.title||'Iron Voltage'} · ${partName(instrument)} · ${D.NAMES[difficulty]} · ${formatTime(Math.max(0,frozenTime))}`+(practiceLoop?` · ${practiceLoop.name} · ${Math.round(playRate*100)}% speed`:'');
    $('pauseRestart').textContent=practiceLoop?'Restart practice':previewing?'Restart preview':'Restart song';
    $('pausePractice').disabled=song?.chartOnly===true;
    $('pauseDifficulty').value=difficulty;$('pauseDifficultyPanel').hidden=true;$('pauseDifficultyToggle').setAttribute('aria-expanded','false');$('pauseStatus').textContent='';
    updateButtons();dialog.showModal();
  }
  function pause({showMenu=true}={}){
    window.RiffBackground?.pause();
    if(!running()){if(showMenu)showPauseMenu();return;}frozenTime=currentTime();frozenInputTime=inputTime();previousState=state;state='paused';clearHeld();audioContext.suspend().catch(()=>{});updateButtons();
    setAnnouncement('TAKE A BREATHER','PAUSED');$('stageStatus').textContent='PAUSED';
    if(showMenu)showPauseMenu();
  }
  async function resume(){
    if(state!=='paused'||resuming)return;
    const playback=playbackGeneration;resuming=true;updateButtons();if($('pauseStatus'))$('pauseStatus').textContent='';
    try{
      if(window.RiffBackground?.prepare)await window.RiffBackground.prepare({time:videoPosition(previousState==='countin'?Math.max(frozenInputTime,transportSeek):frozenInputTime),rate:playRate});
      if(state!=='paused'||playback!==playbackGeneration)return;
      await audioContext.resume();if(state!=='paused'||playback!==playbackGeneration)return;state=previousState==='countin'?'countin':'playing';closePauseMenu();updateButtons();setAnnouncement('','',false);
    }catch(error){if(playback===playbackGeneration){const message=error.backgroundVideo?error.message:'Tap Resume track to enable sound.';showMessage(message);if($('pauseStatus'))$('pauseStatus').textContent=message;}}
    finally{if(playback===playbackGeneration){resuming=false;updateButtons();}}
  }
  function togglePause(){return state==='paused'?resume():pause();}
  function retryCurrentRun(){
    if(busy()||!['playing','countin','paused','finished'].includes(state))return;
    const options={practice:!!practiceLoop,practiceSettings:practiceLoop?{...practiceLoop}:null,preview:previewing,offset:previewing?transportSeek:0};
    if(state==='paused')state='finished';return play(options);
  }
  $('pauseResume')?.addEventListener('click',()=>resume());
  $('pausePractice')?.addEventListener('click',()=>{if(state==='paused'&&!resuming)openPractice();});
  $('pauseRestart')?.addEventListener('click',()=>retryCurrentRun());
  $('pauseQuit')?.addEventListener('click',()=>reset());
  $('pauseDifficultyToggle')?.addEventListener('click',()=>{if(resuming)return;const panel=$('pauseDifficultyPanel');panel.hidden=!panel.hidden;$('pauseDifficultyToggle').setAttribute('aria-expanded',String(!panel.hidden));});
  $('pauseApplyDifficulty')?.addEventListener('click',()=>{
    const next=$('pauseDifficulty').value;if(state!=='paused'||resuming||!D.LEVELS.includes(next))return;
    difficulty=next;document.querySelectorAll('input[name=difficulty]').forEach(input=>input.checked=input.value===difficulty);refreshInstrument();
    return retryCurrentRun();
  });
  $('pauseDialog')?.addEventListener('cancel',event=>{event.preventDefault();return resume();});
  function reset(){
    stopAudio();state='idle';previewing=false;practiceLoop=null;playRate=1;newSession();
    $('resultDialog').close();setAnnouncement('YOUR STAGE IS WAITING','LET IT RIP.');updateButtons();updateUi(0);refreshBest();
  }
  function finish(){
    if(previewing){reset();setAnnouncement('PREVIEW COMPLETE','READY TO PLAY?');return;}
    if(finishScheduled)return;finishScheduled=true;state='finished';stopAudio();clearHeld();session.overdrive=false;updateButtons();updateUi(finishedPosition());
    const accuracy=session.notes.length?session.hits/session.notes.length*100:0,isPractice=!!practiceLoop,percentage=isPractice?practicePercent(accuracy):Math.round(accuracy),stars=accuracy>=95?5:accuracy>=85?4:accuracy>=70?3:accuracy>=50?2:accuracy>0?1:0;
    $('resultDialog').classList.toggle('practice-results',isPractice);
    if($('resultEyebrow'))$('resultEyebrow').textContent=isPractice?'PRACTICE COMPLETE':'SESSION COMPLETE';
    if($('resultScoreLabel'))$('resultScoreLabel').textContent=isPractice?'SECTION ACCURACY':'FINAL SCORE';
    if($('practiceResultPercentage')){$('practiceResultPercentage').hidden=!isPractice;$('practiceResultPercentage').textContent=percentage+'%';$('resultScore').hidden=isPractice;}
    if($('resultAccuracyStat'))$('resultAccuracyStat').hidden=isPractice;
    $('replayButton').textContent=isPractice?'Practice again':'Play again';$('backButton').textContent=isPractice?'Back to main menu':'Back to soundcheck';
    $('resultTitle').textContent=isPractice?(percentage===100?'Perfect section!':practiceLoop.name+' complete.'):stars===5?'You brought the house down.':stars>=3?'Now that’s a show.':'That’s a wrap.';
    $('resultScore').textContent=Math.round(session.score).toLocaleString();$('resultAccuracy').textContent=`${percentage}%`;
    $('resultStreak').textContent=session.bestStreak;$('resultPerfect').textContent=session.perfect;
    $('resultStars').innerHTML='★'.repeat(stars)+`<span>${'★'.repeat(5-stars)}</span>`;$('resultStars').setAttribute('aria-label',`${stars} out of 5 stars`);
    $('resultNotes').textContent=(isPractice?`${practiceLoop.name} · ${formatTime(practiceLoop.start)}–${formatTime(practiceLoop.end)} · ${Math.round(playRate*100)}% speed · ${Math.round(session.score).toLocaleString()} points\n`:'')+`${session.hits} of ${session.notes.length} notes hit · ${partName(instrument)} · ${D.NAMES[difficulty]} · ${instrument==='drums'?'Tap pads':instrument==='vocals'?'Pitch pads':mode==='tap'?'Tap frets':'Hold + strum'}`;
    if($('resultTiming')){const timing=T.timingSummary?.(session.notes,playRate);$('resultTiming').textContent=timing?`Typical hit: ${Math.abs(timing.medianMs)<=20?'on time':Math.abs(timing.medianMs)+' ms '+(timing.medianMs<0?'early':'late')}. ${timing.early} early · ${timing.onTime} on time · ${timing.late} late. Includes your current calibration.`:'Hit at least eight notes for a timing summary. Timing describes your playing and current calibration.';}
    if($('resultPracticeMiss'))$('resultPracticeMiss').hidden=isPractice||!T.missedSection?.(lastMissTime,song?.musicEnd??E.MUSIC_END);
    if($('resultPracticeBest'))$('resultPracticeBest').hidden=!isPractice;
    if(isPractice){
      const key=`riffbound-practice-best-v1:${bestKey()}:${practiceLoop.start}:${practiceLoop.end}:${practiceLoop.rate}`;let best={accuracy:0,score:0};
      try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(Number.isFinite(saved?.accuracy)&&saved.accuracy>=0&&saved.accuracy<=100&&Number.isFinite(saved.score)&&saved.score>=0)best=saved;}catch{}
      const isBest=accuracy>best.accuracy||accuracy===best.accuracy&&session.score>best.score;let persisted=true;
      if(isBest){best={accuracy,score:Math.round(session.score)};try{localStorage.setItem(key,JSON.stringify(best));}catch{persisted=false;}}
      $('newBest').textContent='NEW SECTION BEST';$('newBest').hidden=!isBest;
      if($('resultPracticeBest'))$('resultPracticeBest').textContent=`Best at this section, speed and difficulty: ${practicePercent(best.accuracy)}% · ${best.score.toLocaleString()} points.`+(persisted?'':' This result could not be saved on this device.');
    }else{const best=readBest(),isBest=session.score>best;$('newBest').textContent='NEW PERSONAL BEST';$('newBest').hidden=!isBest;if(isBest){try{localStorage.setItem(bestKey(),String(session.score));}catch{}}}
    refreshBest();setAnnouncement(song?'YOUR SONG':'IRON VOLTAGE',isPractice?'SECTION COMPLETE':'SESSION COMPLETE');$('resultDialog').showModal();
  }
  function laneDown(lane){
    if(previewing)return;
    if(lane>=playableFrets())return;if(held.has(lane))return;
    held.add(lane);fretButtons[lane].classList.add('active');flashes[lane]=Math.max(flashes[lane],.2);
    if(running()&&session.mode==='tap')session.tap(lane,inputTime());
  }
  function laneUp(lane){held.delete(lane);fretButtons[lane].classList.remove('active');session.release(lane);}
  function strum(){if(!previewing&&running()&&session.mode==='strum')session.strum(new Set(held),inputTime());}
  function kickDown(){if(previewing||instrument!=='drums'||held.has(E.KICK_LANE))return;held.add(E.KICK_LANE);$('kickButton').classList.add('active');flashes[E.KICK_LANE]=.3;if(running())session.tap(E.KICK_LANE,inputTime());}
  function kickUp(){held.delete(E.KICK_LANE);$('kickButton').classList.remove('active');}
  // Track each finger/key separately so releasing one cannot cancel another hold.
  function pressInput(id,lane){if($('pauseDialog')?.open||inputOwners.has(id))return;inputOwners.set(id,lane);if(instrument==='drums'&&held.has(lane)&&running()&&!previewing&&(session.findTap(lane,inputTime())||session.findRoll(lane,inputTime()))){session.tap(lane,inputTime());flashes[lane]=.6;return;}if(lane===E.KICK_LANE)kickDown();else laneDown(lane);}
  function releaseInput(id){if(!inputOwners.has(id))return;const lane=inputOwners.get(id);inputOwners.delete(id);if([...inputOwners.values()].includes(lane))return;if(lane===E.KICK_LANE)kickUp();else laneUp(lane);}
  function drive(){if(!previewing&&running()&&currentTime()>=0&&session.activate()){
    const el=$('streakCallout');el.textContent='OVERDRIVE ENGAGED';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');updateUi(currentTime());
  }}
  const editingInput=target=>target instanceof HTMLInputElement||target?.tagName==='SELECT'||target?.tagName==='TEXTAREA'||target?.isContentEditable;
  const controllerContext=()=>instrument==='drums'?(fourLaneDrums()?'drums-four':'drums-five'):'frets';
  const controllerModalOpen=()=>['backgroundDialog','controllerDialog','timingDialog','helpDialog','resultDialog','libraryDialog','practiceDialog','offlineDialog','chartFilesDialog','addSongDialog','backupDialog'].some(id=>$(id)?.open);
  if(window.RiffControllerInput&&window.RiffControllerSetup&&$('controllerDialog')){
    controllerInput=new window.RiffControllerInput.Hub({navigator:window.navigator,storage:localStorage,onAction:(action,down,owner)=>{
      const id='controller:'+owner;
      if(!down){releaseInput(id);return;}
      if(controllerModalOpen()||editingInput(document.activeElement)||!controllerFocused||document.hidden||busy())return;
      if(action==='pause'){if(running()||state==='paused')togglePause();return;}
      if($('pauseDialog')?.open||!running()||previewing)return;
      if(instrument==='drums'&&audioDrums?.enabled&&(action.startsWith('lane')||action==='kick'))return;
      if(action.startsWith('lane'))pressInput(id,Number(action.slice(4)));
      else if(action==='kick'&&instrument==='drums')pressInput(id,E.KICK_LANE);
      else if(action==='strum')strum();else if(action==='overdrive')drive();
    }});
    window.RiffControllerSetup({document,hub:controllerInput,getContext:controllerContext,beforeOpen:()=>{if(running())pause({showMenu:false});closePauseMenu();clearHeld();}});
  }
  if($('audioDrumConnect')){
    try{
    if(!window.RiffAudioDrumInput?.Core||!window.RiffAudioDrumSetup)throw Error('Audio recognition files did not finish loading. Refresh Riffbound while online.');
    const A=window.RiffAudioDrumInput;
    audioDrums=new A.Input({navigator:window.navigator,storage:localStorage,
      createContext:()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('This browser does not support audio capture.');return new C({latencyHint:'interactive'});},
      createWorklet:(context,processorOptions)=>new window.AudioWorkletNode(context,'riff-drum-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions}),
      onDisconnect:()=>{if(audioDrumRun&&running())pause();},
      onHit:event=>{
        if(instrument!=='drums'||!running()||previewing||controllerModalOpen()||editingInput(document.activeElement)||document.hidden||!controllerFocused||busy()||controllerInput?.enabled===false)return;
        const age=(performance.now()-event.at)/1000;if(!Number.isFinite(age)||age<-.02||age>.3)return;
        const time=inputTime()-(Math.max(0,age)+event.latency/1000)*playRate;
        if(practiceLoop&&time<practiceLoop.start)return;
        audioDrumRun=true;
        const lanes=new Set(event.roles.map(role=>A.Core.lane(role,fourLaneDrums())).filter(Number.isInteger));
        for(const lane of lanes){session.tap(lane,time);flashes[lane]=.65;}
      }});
    window.RiffAudioDrumSetup({document,input:audioDrums,boot:window.RiffAudioDrumBoot});
    window.addEventListener('pagehide',()=>audioDrums.stop());
    }catch(error){const message='Audio setup could not start: '+String(error.message||error);if(window.RiffAudioDrumBoot)window.RiffAudioDrumBoot.fail(message);else if($('audioDrumStatus'))$('audioDrumStatus').textContent=message;audioDrums=null;}
  }
  document.addEventListener('keydown',event=>{
    if($('backgroundDialog')?.open)return;
    if($('controllerDialog')?.open)return;
    if($('timingDialog').open){if(event.code==='Space'){event.preventDefault();if(!event.repeat)calibrationTap();}return;}
    if($('helpDialog').open||$('resultDialog').open||$('libraryDialog').open||$('practiceDialog').open||$('offlineDialog').open||$('chartFilesDialog').open||$('addSongDialog').open||$('backupDialog')?.open)return;
    if($('pauseDialog')?.open){
      if(event.code==='Escape'){event.preventDefault();if(!event.repeat)resume();}
      else if(event.code==='KeyR'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!editingInput(event.target)){event.preventDefault();if(!event.repeat)retryCurrentRun();}
      return;
    }
    if(editingInput(event.target))return;
    if(event.code==='KeyR'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!event.repeat)retryCurrentRun();return;}
    const lane=E.KEYS.indexOf(event.code);
    if(lane>=0){event.preventDefault();if(!event.repeat)pressInput(`key:${event.code}`,lane);return;}
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)togglePause();return;}
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement)return;
    if(event.code==='Space'){event.preventDefault();if(!event.repeat){if(instrument==='drums')pressInput('key:Space',E.KICK_LANE);else drive();}}
    if(instrument==='drums'&&['ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();if(!event.repeat)drive();}
    if(event.code==='Enter'){event.preventDefault();if(!event.repeat){if(state==='idle'||state==='finished')play();else if(state==='paused')resume();else if(instrument==='drums')pressInput('key:Enter',E.KICK_LANE);else strum();}}
  });
  document.addEventListener('keyup',event=>{if(E.KEYS.includes(event.code)||event.code==='Enter'||event.code==='Space'){releaseInput(`key:${event.code}`);if(!editingInput(event.target)&&!$('pauseDialog')?.open)event.preventDefault();}});
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
  $('uploadButton').addEventListener('click',pickSongFile);
  $('songFile').addEventListener('cancel',()=>{pendingUpload=null;});
  $('songFile').addEventListener('change',()=>{const choice=pendingUpload;pendingUpload=null;return choice?uploadSong($('songFile').files[0],choice.targets,choice.identity):uploadSong($('songFile').files[0]);});
  $('cancelUpload').addEventListener('click',cancelUpload);
  $('rechartButton').addEventListener('click',()=>chooseInstrument(instrument,true));
  $('repairDrumsButton')?.addEventListener('click',()=>{if(song&&instrument==='drums'&&!active()&&pendingSaves===0)return chooseInstrument('drums',true,true);});
  $('findAuthoredChart').addEventListener('click',findAuthoredChart);
  $('loadKingNothingDrums').addEventListener('click',loadKingNothingDrums);
  $('demoButton').addEventListener('click',useDemo);
  $('previewButton').addEventListener('click',event=>{event.currentTarget.blur();if(previewing)reset();else if(song)play({preview:true,offset:Number($('previewPosition').value)});});
  $('previewPosition').addEventListener('input',()=>{$('previewTime').textContent=formatTime(Number($('previewPosition').value));});
  $('previewPosition').addEventListener('change',()=>{if(previewing&&!busy())play({preview:true,offset:Number($('previewPosition').value)});});
  $('pauseButton').addEventListener('click',event=>{event.currentTarget.blur();return togglePause();});
  $('retryButton')?.addEventListener('click',event=>{event.currentTarget.blur();return retryCurrentRun();});
  $('driveButton').addEventListener('click',event=>{event.currentTarget.blur();drive();});
  $('replayButton').addEventListener('click',()=>{$('resultDialog').close();state='finished';return play({practice:!!practiceLoop,practiceSettings:practiceLoop?{...practiceLoop}:null});});
  $('backButton').addEventListener('click',reset);
  $('resultDialog').addEventListener('cancel',event=>{event.preventDefault();reset();});
  $('helpButton').addEventListener('click',()=>openTool('helpDialog'));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  for(const id of ['backgroundDialog','controllerDialog','timingDialog','helpDialog','libraryDialog','practiceDialog','offlineDialog','chartFilesDialog','addSongDialog','backupDialog'])$(id)?.addEventListener('close',()=>showPauseMenu());
  document.querySelectorAll('input[name=difficulty]').forEach(input=>input.addEventListener('change',()=>{
    if(active())return;difficulty=input.value;newSession();refreshInstrument();updateUi(0);
  }));
  document.querySelectorAll('input[name=mode]').forEach(input=>input.addEventListener('change',()=>{
    if(active())return;mode=input.value;newSession();refreshInstrument();updateUi(0);
  }));
  document.querySelectorAll('input[name=chartTarget]').forEach(input=>{
    input.addEventListener('change',()=>chooseUploadInstrument(input.value));
    // A checked upload target may differ from playback after using the stage
    // selector. Clicking it again must still select its existing chart.
    input.addEventListener('click',()=>{if(input.checked&&instrument!==input.value)return chooseUploadInstrument(input.value);});
  });
  document.querySelectorAll('input[name=instrument]').forEach(input=>input.addEventListener('change',()=>chooseInstrument(input.value)));
  for(const part of PARTS)$('playPart'+partName(part)).addEventListener('click',()=>{if(!song?.charts[part]?.expert?.length)return;return chooseInstrument(part);});
  $('chartScope').addEventListener('change',refreshChartScope);
  for(const part of PARTS)$('part'+partName(part)).addEventListener('change',refreshChartScope);
  $('buildPartsButton').addEventListener('click',buildSelectedParts);
  function setVolume(){if(master)master.gain.setTargetAtTime(muted?0:volume,audioContext.currentTime,.02);$('volume').value=Math.round((muted?0:volume)*100);$('muteButton').textContent=muted||volume===0?'♪':'♫';$('muteButton').setAttribute('aria-label',muted||volume===0?'Unmute sound':'Mute sound');}
  $('volume').addEventListener('input',event=>{const next=Math.max(0,Math.min(1,Number(event.target.value)/100));if(!Number.isFinite(next))return;if(volume>0)preMute=volume;volume=next;if(volume>0)preMute=volume;muted=volume===0;setVolume();preferences();});
  $('muteButton').addEventListener('click',()=>{if(muted||volume===0){muted=false;volume=preMute||.7;}else{preMute=volume;muted=true;}setVolume();preferences();});
  setVolume();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();clearHeld();audioDrums?.stop('Audio stopped while the page was hidden. Reconnect in Controllers / drums.');}});
  window.addEventListener('blur',()=>{controllerFocused=false;pause();clearHeld();if(audioDrums?.stream&&!audioDrums.connecting)audioDrums.stop('Audio stopped when the window lost focus. Reconnect in Controllers / drums.');});
  window.addEventListener('focus',()=>{controllerFocused=true;showPauseMenu();});

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
  function point(lane,z){const w=geo.topWidth+(geo.bottomWidth-geo.topWidth)*z,n=highwayLanes();return{x:width/2+(lane-(n-1)/2)*w/n,y:geo.top+(geo.target-geo.top)*z,w:w/n};}
  function quad(lane,a,b,fill,inset=0){const p=point(lane,a),q=point(lane,b);ctx.beginPath();ctx.moveTo(p.x-p.w/2+inset,p.y);ctx.lineTo(p.x+p.w/2-inset,p.y);ctx.lineTo(q.x+q.w/2-inset,q.y);ctx.lineTo(q.x-q.w/2+inset,q.y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function lineAt(z,alpha,thickness=1){const l=point(0,z),r=point(highwayLanes()-1,z);ctx.beginPath();ctx.moveTo(l.x-l.w/2,l.y);ctx.lineTo(r.x+r.w/2,r.y);ctx.strokeStyle=`rgba(197,212,214,${alpha})`;ctx.lineWidth=thickness;ctx.stroke();}
  function noteHead(lane,z,color,opacity=1,ghost=false){
    const p=point(lane,z),rx=p.w*.36;
    const drums=instrument==='drums',cymbal=drums&&!fourLaneDrums()&&(lane===1||lane===3);
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
    if(ghost){oval(0,-.3,.3,.105,'#101820');ctx.beginPath();ctx.ellipse(0,-.3,.3,.105,0,0,Math.PI*2);ctx.strokeStyle='#fff8de';ctx.lineWidth=.04;ctx.stroke();}
    ctx.restore();
  }
  function kickNote(z,opacity=1,ghost=false){
    const l=point(0,z),r=point(highwayLanes()-1,z),left=l.x-l.w*.43,right=r.x+r.w*.43,thickness=Math.max(2,7*z);
    ctx.save();ctx.globalAlpha=opacity;ctx.shadowColor=E.KICK_COLOR;ctx.shadowBlur=14*z;
    const g=ctx.createLinearGradient(0,l.y-thickness,0,l.y+thickness);g.addColorStop(0,'#efe0ff');g.addColorStop(.3,E.KICK_COLOR);g.addColorStop(1,'#5c257e');
    ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(left,l.y-thickness/2,right-left,thickness,thickness/2);ctx.fill();
    ctx.fillStyle='#fff0ff';ctx.beginPath();ctx.roundRect(left+thickness/2,l.y-thickness/2,right-left-thickness,Math.max(1,z),Math.max(.5,z/2));ctx.fill();
    if(ghost){ctx.shadowBlur=0;ctx.strokeStyle='#fff8de';ctx.lineWidth=Math.max(1,z);ctx.beginPath();ctx.ellipse((left+right)/2,l.y,Math.max(2,5*z),Math.max(1,2*z),0,0,Math.PI*2);ctx.fillStyle='#101820';ctx.fill();ctx.stroke();}
    ctx.restore();
  }
  function draw(t,dt,now){
    ctx.clearRect(0,0,width,height);if(!width||!height)return;
    geo=geometry();
    const isIdle=state==='idle'||state==='loading'||state==='analyzing'||state==='finished';
    const idleStart=song?Math.max(0,(idleNotes[0]?.time??0)-1):3,visualTime=isIdle?(reducedMotion?idleStart+1:(now/1000*.52)%10+idleStart):t;
    const approach=D.APPROACH[difficulty]/highwaySpeed*playRate;
    const beatDuration=trackBeat(),beatOffset=song?.offset??0,musicBeat=Math.max(0,visualTime-beatOffset)/beatDuration,beatPulse=1-(musicBeat%1);
    const leftTop=point(0,0),rightTop=point(highwayLanes()-1,0),leftBottom=point(0,1.18),rightBottom=point(highwayLanes()-1,1.18);
    const drums=instrument==='drums';
    const gradient=ctx.createLinearGradient(0,geo.top,0,height);gradient.addColorStop(0,drums?'#08090d':'#141a20');gradient.addColorStop(.6,drums?'#09090c':'#171d23');gradient.addColorStop(1,'#080a0e');
    ctx.beginPath();ctx.moveTo(leftTop.x-leftTop.w/2,geo.top);ctx.lineTo(rightTop.x+rightTop.w/2,geo.top);ctx.lineTo(rightBottom.x+rightBottom.w/2,rightBottom.y);ctx.lineTo(leftBottom.x-leftBottom.w/2,leftBottom.y);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    for(let lane=0;lane<highwayLanes();lane++){
      if(!drums&&lane%2===0)quad(lane,0,1.18,'#ffffff03');
      if(held.has(lane)||flashes[lane]>.01){const g=ctx.createLinearGradient(0,geo.top,0,geo.target);g.addColorStop(0,laneColor(lane)+'00');g.addColorStop(1,laneColor(lane)+(held.has(lane)?'38':'25'));quad(lane,0,1.1,g);}
      if(lane>=playableFrets())quad(lane,0,1.18,'#0009');
    }
    // Perspective strings and outer rails are part of the playable highway.
    for(let i=0;i<=highwayLanes();i++){
      if(drums&&i>0&&i<highwayLanes())continue;
      const topX=width/2+(i-highwayLanes()/2)*geo.topWidth/highwayLanes(),bottomX=width/2+(i-highwayLanes()/2)*(geo.topWidth+(geo.bottomWidth-geo.topWidth)*1.18)/highwayLanes();
      ctx.beginPath();ctx.moveTo(topX,geo.top);ctx.lineTo(bottomX,leftBottom.y);ctx.lineWidth=i===0||i===highwayLanes()?2:1;ctx.strokeStyle=drums?'#bdc6d0':i===0||i===highwayLanes()?'#68747d':'#77889925';ctx.stroke();
      if(i===0||i===highwayLanes()){ctx.beginPath();ctx.moveTo(topX+(i===0?-4:4),geo.top);ctx.lineTo(bottomX+(i===0?-9:9),leftBottom.y);ctx.lineWidth=3;ctx.strokeStyle=session.overdrive?'#d8ef6955':'#8ca0b333';ctx.stroke();}
    }
    let grid=null;
    if(ChartTiming&&partTiming())try{grid=ChartTiming.grid(partTiming(),visualTime-approach*.08,visualTime+approach,song.quality.chartAdjustments?.[instrument]||0);}catch{}
    if(!grid){grid=[];for(let beat=Math.floor((visualTime-beatOffset)/beatDuration)-1;beat<(visualTime+approach-beatOffset)/beatDuration+1;beat++)grid.push({time:beat*beatDuration+beatOffset,major:beat%4===0});}
    for(const beat of grid){const p=1-(beat.time-visualTime)/approach;if(p<0||p>1.08)continue;lineAt(p*p,beat.major?.24:.09,beat.major?2:1);}
    const notes=state==='analyzing'?[]:isIdle?idleNotes:T.visibleNotes(session.notes,practiceLoop?.repeat?practiceLoop:null,visualTime,approach);
    for(let i=notes.length-1;i>=0;i--){
      const n=notes[i];if(n.missed)continue;
      const rolling=drums&&n.rollDuration&&n.time+n.rollDuration>visualTime;
      const p=1-(n.time-visualTime)/approach;if(p<0||p>1.13&&!n.held&&!rolling)continue;
      const z=Math.max(0,p*p),color=session.overdrive&&!drums?'#e8ff65':laneColor(n.lane);
      if(rolling){
        const endP=1-(n.time+n.rollDuration-visualTime)/approach,startZ=Math.min(1,z),endZ=Math.max(0,endP)*Math.max(0,endP);
        if(endZ<startZ){for(const lane of n.lane===E.KICK_LANE?Array.from({length:highwayLanes()},(_,i)=>i):[n.lane])quad(lane,endZ,startZ,color+'45');const a=point(n.lane===E.KICK_LANE?(highwayLanes()-1)/2:n.lane,startZ);ctx.fillStyle=color;ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('ROLL',a.x,a.y-12);}
      }
      if(drums&&n.lane===E.KICK_LANE){if(!n.hit)kickNote(z,isIdle?.8:1,n.ghost);continue;}
      if(n.duration&&(!n.hit||n.held)){
        const endP=1-(n.time+n.duration-visualTime)/approach,startZ=n.hit?1:Math.min(1.14,z),endZ=Math.max(0,endP*endP);
        if(endP>=0&&endZ<startZ){const a=point(n.lane,startZ),b=point(n.lane,endZ);ctx.beginPath();ctx.moveTo(a.x-a.w*.085,a.y);ctx.lineTo(a.x+a.w*.085,a.y);ctx.lineTo(b.x+b.w*.085,b.y);ctx.lineTo(b.x-b.w*.085,b.y);ctx.closePath();ctx.fillStyle=color+'a0';ctx.fill();}
      }
      if(n.hit)continue;noteHead(n.lane,z,color,isIdle?(drums?.85:.55):1,n.ghost);
    }
    lineAt(1,session.overdrive?.95:.55,2);
    const center=point((highwayLanes()-1)/2,1);const glow=ctx.createRadialGradient(width/2,center.y,10,width/2,center.y,width*.48);glow.addColorStop(0,session.overdrive?'#e8ff6525':`rgba(194,221,162,${.06+beatPulse*.04})`);glow.addColorStop(1,'#e8ff6500');ctx.fillStyle=glow;ctx.fillRect(0,center.y-45,width,90);
    for(let lane=0;lane<highwayLanes();lane++){if(flashes[lane]>.02){const p=point(lane,1);ctx.fillStyle=laneColor(lane);ctx.globalAlpha=flashes[lane]*.7;ctx.beginPath();ctx.ellipse(p.x,p.y-10,p.w*.29,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}flashes[lane]=Math.max(0,flashes[lane]-dt*4);}
    if(drums&&flashes[E.KICK_LANE]>.02)kickNote(1,flashes[E.KICK_LANE]*.6);flashes[E.KICK_LANE]=Math.max(0,flashes[E.KICK_LANE]-dt*4);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.age>p.life){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;const origin=point(p.lane===E.KICK_LANE?(highwayLanes()-1)/2:p.lane,1);ctx.globalAlpha=1-p.age/p.life;ctx.fillStyle=p.color;ctx.fillRect(origin.x+p.x,origin.y+p.y-10,p.size,p.size*(drums?4:2.5));}ctx.globalAlpha=1;
    // A localized fade keeps the far end of the highway distinct without hiding the band.
    const fog=ctx.createLinearGradient(0,geo.top-7,0,geo.top+35);fog.addColorStop(0,'#080a1077');fog.addColorStop(1,'#080a1000');ctx.fillStyle=fog;ctx.fillRect(width/2-geo.topWidth*.6,geo.top-7,geo.topWidth*1.2,42);
  }
  function frame(now){
    if(controllerInput){controllerInput.setContext(controllerContext());controllerInput.setBlocked(controllerModalOpen()||busy()||!!document.hidden||!controllerFocused||!!editingInput(document.activeElement));controllerInput.poll(now);}
    const dt=Math.min(.06,(now-lastFrame)/1000||.016);lastFrame=now;const t=currentTime();
    if(running()){
      if(state==='countin'&&t<transportSeek&&!previewing){setAnnouncement('COUNT IT IN',String(Math.min(4,Math.ceil((transportSeek-t)/trackBeat()))),true,true);}
      else{
        if(practiceLoop?.repeat){const cycle=gameTransport().cycle;if(cycle>loopCycle){const hits=session.hits,total=session.notes.length,percentage=total?practicePercent(hits/total*100):0;loopCycle=cycle;practicePass=cycle+1;newSession();session.lastTime=practiceLoop.start;$('practiceStatus').textContent=`Last pass: ${hits} of ${total} notes hit (${percentage}%). Pass ${practicePass} is playing.`;}}
        if(state==='countin'){state='playing';updateButtons();}setAnnouncement('','',false);
        if(previewing){for(const n of session.notes){if(!n.hit&&t>=n.time){n.hit=true;flashes[n.lane]=1;}if(n.hit)n.held=n.duration>0&&t<n.time+n.duration;}}
        else session.update(inputTime(),held);
        if(practiceLoop&&!practiceLoop.repeat&&t>=practiceLoop.end&&(session.notes.every(note=>note.hit||note.missed)||inputTime()>=practiceLoop.end+session.window))finish();
        else if(!practiceLoop&&t>=trackDuration())finish();
      }
    }
    const rawVideoTime=state==='finished'?finishedPosition():state==='countin'?Math.max(inputTime(),transportSeek):inputTime(),videoChartTime=practiceLoop&&!practiceLoop.repeat?Math.min(rawVideoTime,practiceLoop.end):rawVideoTime;
    window.RiffBackground?.sync({time:videoPosition(videoChartTime),playing:running()&&(state!=='countin'||t>=transportSeek)&&videoChartTime>=videoChartStart&&(!practiceLoop||practiceLoop.repeat||videoChartTime<practiceLoop.end),rate:playRate});
    if(!window.RiffBackground||window.RiffBackground.mode==='stage')band.draw({time:state==='finished'?finishedPosition():t,wallTime:now/1000,state,energy:session.energy,streak:session.streak,overdrive:session.overdrive,instrument,reducedMotion,beatDuration:trackBeat(),duration:trackDuration(),percussion:song?.percussion??null});
    draw(state==='finished'?finishedPosition():inputTime(),dt,now);if(now-lastUi>70){updateUi(state==='finished'?finishedPosition():t);lastUi=now;}requestAnimationFrame(frame);
  }
  const resumeKey='riffbound-update-resume-v1';
  window.RiffUpdateSafety={
    canReload(manual=false){
      const dialogs=['pauseDialog','backgroundDialog','libraryDialog','backupDialog','addSongDialog','chartFilesDialog','practiceDialog','timingDialog','helpDialog','resultDialog','controllerDialog',...(manual?[]:['offlineDialog'])];
      return !audioDrums?.stream&&!audioDrums?.connecting&&!exportingVideo&&!window.RiffBackground?.busy&&!active()&&!previewing&&!calibrationTest&&!pendingSaves&&!importingBackup&&!backupSaving&&(!song||song===savedSong)&&!dialogs.some(id=>$(id)?.open);
    },
    prepareReload(manual=false){
      if(!this.canReload(manual))return false;
      try{sessionStorage.setItem(resumeKey,JSON.stringify({id:song?.id||null,instrument,difficulty,mode}));}catch{if(song)return false;}
      return true;
    }
  };
  async function restoreAfterUpdate(){
    let saved;try{saved=JSON.parse(sessionStorage.getItem(resumeKey)||'null');sessionStorage.removeItem(resumeKey);}catch{return;}
    if(!saved)return;
    if(D.LEVELS.includes(saved.difficulty))difficulty=saved.difficulty;
    if(['tap','strum'].includes(saved.mode))mode=saved.mode;
    for(const name of ['difficulty','mode'])document.querySelectorAll(`input[name=${name}]`).forEach(input=>input.checked=input.value===(name==='difficulty'?difficulty:mode));
    if(saved.id){await openSong(saved.id,saved.instrument);return;}
    if(PARTS.includes(saved.instrument))instrument=saved.instrument;
    newSession();refreshSong();updateUi(0);
  }
  renderSetlist();refreshSetlist();newSession();refreshSong();updateUi(0);resize();requestAnimationFrame(frame);
  restoreAfterUpdate();
})();
