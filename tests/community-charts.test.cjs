const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/community-charts.js'),M=require('../dist/midi-chart.js'),X=require('../dist/chart-exchange.js'),F=require('./helpers/community-fixture.cjs'),{storage}=require('./helpers/song-storage.cjs');
const query={filename:'Fixture Artist - Fixture Song.wav',duration:16,parts:['guitar','bass','drums','vocals']};
test('title/artist matching is exact, recording length is required, and ambiguous versions are rejected',()=>{
 const id=C.identify(query.filename);assert.deepEqual(id,{title:'Fixture Song',artist:'Fixture Artist'});assert.equal(C.match([F.row],id,16,query.parts).row.md5,F.row.md5);
 for(const row of [{...F.row,name:'Fixture Song Live'},{...F.row,artist:'Cover Band'},{...F.row,song_length:22000},{...F.row,md5:'../secret'}])assert.equal(C.match([row],id,16,query.parts).row,undefined);
 assert.match(C.match([F.row,{...F.row,song_length:16500,md5:'b'.repeat(32)}],id,16,query.parts).reason,/Several/);
 assert.equal(C.match([F.row],{title:'Fixture Song'},16,query.parts).row,undefined);
});
test('actual SNG range flow fetches all four parts, keeps authored chords/colors/tempo and derives missing difficulties',async()=>{
 const net=F.network(),r=await C.lookup({...query,fetcher:net.fetcher});assert.deepEqual(Object.keys(r.charts),query.parts);
 assert.deepEqual(r.charts.guitar.expert.map(n=>[n.lane,n.time,n.duration]),[[0,1,.5],[4,1,.25],[1,2,0]]);
 assert.deepEqual(r.charts.drums.expert.map(n=>n.lane),[0,5,1,2,3,3]);assert.equal(r.charts.vocals.expert[1].duration,1);assert.equal(r.charts.vocals.expert[1].pitch,72);
 assert.equal(r.charts.guitar.easy[0].lane,4,'authored orange on Easy must remain orange');assert.ok(r.imports.guitar.levels.includes('easy'));assert.ok(r.imports.guitar.derived.includes('hard'));
 assert.equal(net.requests.length,5);assert.equal(net.requests[1].options.headers.Range,'bytes=0-33');assert.ok(Number(net.requests[4].options.headers.Range.match(/\d+/)[0])>200000);
 assert.equal(net.requests[0].options.credentials,'omit');assert.equal(JSON.parse(net.requests[0].options.body).search,'Fixture Artist Fixture Song');assert.match(r.message,/preview timing/);
});
test('blocked downloads and servers ignoring Range safely use audio fallback',async()=>{
 for(const options of [{blocked:true},{noRange:true},{badRange:true}]){const n=F.network(options),r=await C.lookup({...query,fetcher:n.fetcher});assert.deepEqual(r.charts,{});assert.match(r.message,/Found Fixture Song.*could not be downloaded/);}
});
test('missing, unsupported and lyrics-only parts do not remove a supported part',async()=>{
 const data=F.midi([{name:'PART GUITAR',notes:[{tick:960,code:96}]},{name:'PART BASS',notes:[{tick:960,code:95}],events:[{tick:0,data:F.meta(1,'[ENHANCED_OPENS]')}]},{name:'PART VOCALS',events:[{tick:960,data:F.meta(5,'Only lyrics')}]}]);
 const r=await C.lookup({...query,fetcher:F.network({container:F.sng(data)}).fetcher});assert.deepEqual(Object.keys(r.charts),['guitar']);assert.match(r.issues.bass,/Open/);assert.match(r.issues.vocals,/No supported/);assert.match(r.message,/Audio charting used/);
});
test('five-lane and pro MIDI drum colors differ correctly; standard ambiguous drums are rejected',()=>{
 const midi=F.midi([{name:'PART DRUMS',notes:[{tick:480,code:98},{tick:960,code:99},{tick:960,code:111,length:120},{tick:1440,code:100},{tick:1440,code:112,length:120},{tick:1920,code:100}]}]);
 assert.deepEqual(M.parse(midi,{part:'drums',drumLayout:'pro'}).charts.drums.expert.map(n=>n.lane),[1,2,4,3]);assert.throws(()=>M.parse(midi,{part:'drums',drumLayout:'four'}),/four-lane/);
});
test('MIDI running status, tempo, ghost dynamics and note pair bounds are validated',()=>{
 const data=F.midi([{name:'PART DRUMS',notes:[{tick:480,code:97,velocity:1}],events:[{tick:0,data:F.meta(1,'[ENABLE_CHART_DYNAMICS]')}]}]);
 assert.equal(M.parse(data,{part:'drums',drumLayout:'five'}).charts.drums.expert[0].ghost,true);
 assert.throws(()=>M.parse(data.subarray(0,data.length-1),{part:'drums'}),/Invalid/);
 const bad=Buffer.from(data);bad.writeUInt16BE(0x8000,12);assert.throws(()=>M.parse(bad,{part:'drums'}),/Invalid/);
});
test('malformed containers, wrong downloaded identity and oversized chart files fail without importing',async()=>{
 const s=F.sng();assert.equal(C.sngHeader(s).files[1].name,'notes.mid');assert.throws(()=>C.sngHeader(Buffer.alloc(100)),/not a chart/);
 const wrong=F.network({container:F.sng(F.fullMidi(),{metadata:{name:'Wrong Song',artist:'Fixture Artist'}})});const r=await C.lookup({...query,fetcher:wrong.fetcher});assert.deepEqual(r.charts,{});
 const bad=Buffer.from(s);bad.writeUInt32LE(99,6);assert.throws(()=>C.sngHeader(bad),/version/);
 const huge=F.network({container:F.sng(Buffer.alloc(X.MAX_BYTES+1))});assert.deepEqual((await C.lookup({...query,fetcher:huge.fetcher})).charts,{});
});
test('no-match, opt-out and insufficient identity avoid chart downloads',async()=>{
 for(const q of [{...query,enabled:false},{...query,filename:'Unknown.wav'},{...query,duration:20}]){const n=F.network(),r=await C.lookup({...q,fetcher:n.fetcher});assert.deepEqual(r.charts,{});assert.ok(n.requests.length<=1);}
});
test('network timeout falls back, user cancellation rejects, malformed catalog is bounded',async()=>{
 const stalled=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 assert.match((await C.lookup({...query,fetcher:stalled,timeoutMs:10})).message,/timed out/);
 const controller=new AbortController(),pending=C.lookup({...query,fetcher:stalled,signal:controller.signal});controller.abort();await assert.rejects(pending,/Canceled/);
 for(const fetcher of [async()=>new Response('oops'),async()=>new Response(JSON.stringify({data:{}})),async()=>new Response('rate limit',{status:429})])assert.deepEqual((await C.lookup({...query,fetcher})).charts,{});
});
test('fetched charts and exact local audio survive chunk storage, fresh reopen and backup',async()=>{
 const r=await C.lookup({...query,fetcher:F.network().fetcher}),s=storage({rejectBlobs:true}),audioBlob=new Blob(['original local audio']);
 const imports=Object.fromEntries(Object.entries(r.imports).map(([p,x])=>[p,{...x,id:'b'.repeat(64)}]));
 const record={id:'c'.repeat(64),title:'Fixture Song',instrument:'guitar',musicEnd:16,bpm:r.bpm,beat:r.beat,charts:r.charts,waveform:[.5],audioBlob,quality:{imports,onlineLookup:{reference:r.reference}}};
 await s.library.save(record);const restored=await s.fresh().get(record.id);assert.equal(await restored.audioBlob.text(),'original local audio');assert.deepEqual(JSON.parse(JSON.stringify(restored.charts)),JSON.parse(JSON.stringify(s.library.validate(record).charts)));
 const backup=await s.library.unpack(s.library.pack(restored));assert.equal(backup.charts.vocals.expert[1].pitch,72);assert.equal(backup.quality.imports.vocals.id,'b'.repeat(64));assert.equal(backup.quality.imports.guitar.levels[0],'easy');
});

test('running-status chords keep simultaneous authored frets and holds',()=>{
 const events=[{tick:480,data:Buffer.from([0x90,96,100])},{tick:480,data:Buffer.from([100,100])},{tick:960,data:Buffer.from([96,0])},{tick:960,data:Buffer.from([100,0])}];
 const parsed=M.parse(F.midi([{name:'PART GUITAR',events}]),{part:'guitar'});assert.deepEqual(parsed.charts.guitar.expert.map(n=>[n.lane,n.time,n.duration]),[[0,.5,.5],[4,.5,.5]]);
});
test('.chart parts parse independently so unsupported Bass does not discard Guitar',()=>{
 const data=Buffer.from('[Song]\n{\n Name = "Fixture Song"\n Artist = "Fixture Artist"\n Resolution = 192\n Offset = 0\n}\n[SyncTrack]\n{\n0 = B 120000\n}\n[ExpertSingle]\n{\n384 = N 4 192\n}\n[ExpertDoubleBass]\n{\n384 = N 7 0\n}');
 const downloaded={data,file:{name:'notes.chart'},metadata:{delay:'100'}};
 assert.equal(C.parsePart(downloaded,'guitar',F.row).charts.guitar.expert[0].time,1.1);assert.throws(()=>C.parsePart(downloaded,'bass',F.row),/Open/);
});
test('a chart extending beyond the local recording is rejected for that part',async()=>{
 const data=F.midi([{name:'PART GUITAR',notes:[{tick:20000,code:96}]},{name:'PART BASS',notes:[{tick:480,code:96}]}]);
 const r=await C.lookup({...query,parts:['guitar','bass'],fetcher:F.network({container:F.sng(data)}).fetcher});assert.deepEqual(Object.keys(r.charts),['bass']);assert.match(r.issues.guitar,/beyond/);
});

test('matching catalog charts prefer authored difficulty coverage while prioritizing requested parts',()=>{
 const id=C.identify(query.filename),all={...F.row,md5:'b'.repeat(32),notesData:{...F.row.notesData,noteCounts:['guitar','bass','drums'].flatMap(instrument=>['easy','medium','hard','expert'].map(difficulty=>({instrument,difficulty,count:10})))}};
 assert.equal(C.match([F.row,all],id,16,query.parts).row.md5,all.md5);
 const guitarOnly={...all,md5:'c'.repeat(32),notesData:{...all.notesData,hasVocals:false,noteCounts:all.notesData.noteCounts.filter(n=>n.instrument==='guitar')}};
 assert.equal(C.match([guitarOnly,F.row],id,16,query.parts).row.md5,F.row.md5);
});
test('MIDI imports authored four-level arrangements, tempo signatures and sustain cutoff metadata',()=>{
 const data=F.midi([{name:'TEMPO',events:[{tick:0,data:F.meta(0x58,[3,2,24,8])},{tick:0,data:F.meta(0x51,[7,161,32])},{tick:1440,data:F.meta(0x51,[15,66,64])}]},{name:'PART GUITAR',notes:[{tick:960,code:64,length:100},{tick:960,code:76,length:100},{tick:960,code:88,length:100},{tick:1920,code:100,length:240}]},{name:'PART BASS',notes:[{tick:960,code:96}]}]);
 const p=M.parseAll(data,{metadata:{sustain_cutoff_threshold:'80'},shiftMs:100});assert.deepEqual(Object.keys(p.charts.guitar),['easy','medium','hard','expert']);assert.ok(Math.abs(p.charts.guitar.easy[0].duration-100/960)<1e-12);assert.equal(p.charts.guitar.expert[0].time,2.6);assert.equal(p.charts.guitar.expert[0].lane,4);assert.deepEqual(p.timing.signatures,[{tick:0,numerator:3,exponent:2}]);assert.ok(p.charts.bass);
});

test('community files honor packaged delay and explicit drum layout over a catalog layout hint',async()=>{
 const data=F.midi([{name:'PART DRUMS',notes:[{tick:960,code:97},{tick:1080,code:98},{tick:1200,code:99},{tick:1320,code:100}]}]);
 const r=await C.lookup({...query,parts:['drums'],fetcher:F.network({rows:[{...F.row,five_lane_drums:false,notesData:{...F.row.notesData,drumType:0}}],container:F.sng(data,{metadata:{name:F.row.name,artist:F.row.artist,five_lane_drums:'True',delay:'125'}})}).fetcher});
 assert.deepEqual(r.charts.drums.expert.map(n=>[n.time,n.lane]),[[1.125,0],[1.25,1],[1.375,2],[1.5,3]]);assert.equal(r.timings.drums.offset,.125);assert.equal(r.imports.drums.layout,'four');
});

test('alternate chart recovers a missing download without accepting a different title or recording',async()=>{
 const second={...F.row,md5:'b'.repeat(32),charter:'Second Charter'},wrong={...F.row,md5:'c'.repeat(32),name:'Fixture Song Live'};
 const net=F.network({rows:[F.row,second,wrong],containers:{[F.row.md5]:404,[second.md5]:F.sng()}}),r=await C.lookup({...query,fetcher:net.fetcher});
 assert.deepEqual(Object.keys(r.charts),query.parts);assert.deepEqual(r.attempts.map(x=>x.status),['unavailable','imported']);assert.equal(r.references.guitar.charter,'Second Charter');assert.equal(r.reference.md5,second.md5);
 assert.ok(!net.requests.some(x=>x.url.includes(wrong.md5)));assert.equal(r.charts.guitar.easy[0].lane,4);
});
test('different matching charts fill missing parts without replacing earlier authored levels, notes or timing',async()=>{
 const second={...F.row,md5:'b'.repeat(32),charter:'Second Charter'},firstMidi=F.midi([{name:'PART GUITAR',notes:[{tick:960,code:99,length:480},{tick:960,code:63,length:240}]}]);
 const metadata={name:F.row.name,artist:F.row.artist,five_lane_drums:'True'};
 const net=F.network({rows:[second,F.row,F.row],containers:{[F.row.md5]:F.sng(firstMidi,{metadata:{...metadata,delay:'100'}}),[second.md5]:F.sng(F.fullMidi(),{metadata:{...metadata,delay:'200'}})}}),r=await C.lookup({...query,fetcher:net.fetcher});
 assert.deepEqual(Object.keys(r.charts),query.parts);assert.equal(r.attempts.length,2);assert.deepEqual(r.attempts[1].parts,['bass','drums','vocals']);assert.deepEqual(r.issues,{});
 assert.deepEqual(r.charts.guitar.expert.map(x=>[x.lane,x.time,x.duration]),[[3,1.1,.5]]);assert.equal(r.charts.guitar.easy[0].lane,3);assert.equal(r.timings.guitar.offset,.1);assert.equal(r.timings.drums.offset,.2);
 assert.equal(r.references.guitar.md5,F.row.md5);assert.equal(r.references.drums.md5,second.md5);assert.equal(r.imports.guitar.levels.length,2);assert.ok(r.imports.guitar.derived.includes('medium'));
 const imports=Object.fromEntries(Object.entries(r.imports).map(([part,value])=>[part,{...value,id:'b'.repeat(64)}]));
 const s=storage(),record={id:'d'.repeat(64),title:'Fixture Song',instrument:'guitar',musicEnd:16,bpm:r.bpm,beat:r.beat,charts:r.charts,waveform:[.5],audioBlob:new Blob(['local audio']),quality:{imports,communityReferences:r.references,chartTimings:r.timings,onlineLookup:{attempts:r.attempts}}};
 await s.library.save(record);const restored=await s.fresh().get(record.id),backup=await s.library.unpack(s.library.pack(restored));assert.equal(backup.quality.communityReferences.guitar.md5,F.row.md5);assert.equal(backup.quality.communityReferences.drums.md5,second.md5);assert.equal(backup.quality.chartTimings.drums.offset,.2);assert.equal(backup.quality.onlineLookup.attempts.length,2);
});
test('a wrong packaged identity is skipped and cannot provide notes before another matching chart',async()=>{
 const second={...F.row,md5:'b'.repeat(32)},net=F.network({rows:[F.row,second],containers:{[F.row.md5]:F.sng(F.fullMidi(),{metadata:{name:'Other Song',artist:F.row.artist}}),[second.md5]:F.sng()}});
 const r=await C.lookup({...query,fetcher:net.fetcher});assert.equal(r.references.guitar.md5,second.md5);assert.match(r.attempts[0].reason,/identity/);assert.equal(r.charts.guitar.expert[0].time,1);
});
test('catalog pagination finds later matches, rejects later ambiguous versions and stops on repeated pages',async()=>{
 const unrelated=Array.from({length:50},(_,i)=>({...F.row,name:'Different Song',md5:(i+16).toString(16).padStart(32,'0')}));
 const net=F.network({pages:[unrelated,[F.row]]}),r=await C.lookup({...query,fetcher:net.fetcher});assert.ok(r.charts.guitar);assert.deepEqual(net.requests.filter(x=>x.url.includes('/search')).map(x=>JSON.parse(x.options.body).page),[1,2]);
 const ambiguous=F.network({pages:[[...unrelated.slice(0,49),F.row],[{...F.row,md5:'b'.repeat(32),song_length:16500}]]}),a=await C.lookup({...query,fetcher:ambiguous.fetcher});assert.deepEqual(a.charts,{});assert.match(a.message,/Several/);assert.equal(ambiguous.requests.length,2);
 const repeated=F.network({pages:[unrelated,unrelated,unrelated]});assert.deepEqual((await C.lookup({...query,fetcher:repeated.fetcher})).charts,{});assert.equal(repeated.requests.length,2);
});
test('search and alternative downloads remain bounded and host access blocks stop retries',async()=>{
 const pages=Array.from({length:4},(_,page)=>Array.from({length:50},(_,i)=>({...F.row,name:'Other Song',md5:(page*50+i+16).toString(16).padStart(32,'0')}))),paged=F.network({pages});
 await C.lookup({...query,fetcher:paged.fetcher});assert.equal(paged.requests.length,5,'Three general pages plus two bounded Guitar Hero charter searches');
 const rows=Array.from({length:6},(_,i)=>({...F.row,md5:String(i+1).repeat(32)})),net=F.network({rows,containers:Object.fromEntries(rows.map(r=>[r.md5,404]))});
 const r=await C.lookup({...query,fetcher:net.fetcher});assert.equal(r.attempts.length,4);assert.equal(net.requests.length,5);assert.deepEqual(r.charts,{});
 for(const status of [401,403,429]){const blocked=F.network({rows,containers:Object.fromEntries(rows.map(r=>[r.md5,status]))});const b=await C.lookup({...query,fetcher:blocked.fetcher});assert.equal(b.attempts.length,1);assert.equal(blocked.requests.length,2);assert.match(b.message,/Found Fixture Song.*could not be downloaded/);}
});
test('timeout or blocked alternatives retain fetched parts, while explicit cancellation rejects the upload',async()=>{
 const second={...F.row,md5:'b'.repeat(32)},first=F.sng(F.midi([{name:'PART GUITAR',notes:[{tick:960,code:100}]}])),net=F.network({rows:[F.row,second],containers:{[F.row.md5]:first,[second.md5]:403}});
 const partial=await C.lookup({...query,fetcher:net.fetcher});assert.deepEqual(Object.keys(partial.charts),['guitar']);assert.match(partial.message,/Authored guitar fetched/);assert.match(partial.message,/Audio charting used for bass, drums, vocals/);
 const base=F.network({rows:[F.row,second],containers:{[F.row.md5]:first}});let started;const waiting=new Promise(resolve=>{started=resolve;});
 const fetcher=(url,options)=>{if(url.includes(second.md5)){started();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}return base.fetcher(url,options);};
 const timed=await C.lookup({...query,fetcher,timeoutMs:30});assert.deepEqual(Object.keys(timed.charts),['guitar']);assert.equal(timed.references.guitar.md5,F.row.md5);
 const controller=new AbortController(),pending=C.lookup({...query,fetcher,signal:controller.signal});await waiting;setImmediate(()=>controller.abort());await assert.rejects(pending,/Canceled/);
});

test('Hero Of The Day Track 6 identifies the studio title without treating a live title as the same recording',async()=>{
 const identity=C.identify('Metallica - Hero Of The Day (Track 6).wav');assert.deepEqual(identity,{title:'Hero Of The Day',artist:'Metallica'});
 assert.deepEqual(C.identify('Track 6.wav',{title:'Hero Of The Day (Track 6)',artist:'Metallica'}),identity);
 assert.deepEqual(C.identify('06 - Metallica - Hero Of The Day.wav'),identity);assert.deepEqual(C.identify('Track 6: Metallica - Hero Of The Day.wav'),identity);
 assert.equal(C.identify('Metallica - Hero Of The Day (Live).wav').title,'Hero Of The Day (Live)');
 // Public catalog metadata observed 2026-10-10; no original notes/audio fixture.
 const studio={...F.row,...identity,name:identity.title,song_length:262576,notesData:{noteCounts:[{instrument:'guitar',difficulty:'expert',count:954}]}},live={...F.row,name:'Hero Of The Day (Live)',artist:'Metallica',song_length:286664,md5:'b'.repeat(32),notesData:{drumType:1,noteCounts:[{instrument:'drums',difficulty:'expert',count:1510}]}};
 const net=F.network({rows:[studio,live]}),result=await C.lookup({filename:'Metallica - Hero Of The Day (Track 6).wav',duration:262.576,parts:['drums'],fetcher:net.fetcher});
 assert.deepEqual(result.charts,{});assert.match(result.message,/no authored drums chart/);assert.equal(net.requests.length,1,'Neither studio guitar nor live drums may be downloaded for studio drums');
});
test('wrong catalog instrument metadata cannot turn a guitar MIDI track into drums',async()=>{
 const net=F.network({container:F.sng(F.midi([{name:'PART GUITAR',notes:[{tick:480,code:96},{tick:960,code:100}]}]))}),result=await C.lookup({...query,parts:['drums'],fetcher:net.fetcher});
 assert.deepEqual(result.charts,{});assert.match(result.issues.drums,/No supported drums/);assert.equal(result.references.drums,undefined);
});
test('drum MIDI and chart imports retain independent hits while guitar notes change',()=>{
 const drums={name:'PART DRUMS',notes:[{tick:960,code:97},{tick:1080,code:98},{tick:1200,code:99},{tick:1320,code:100},{tick:1440,code:101},{tick:1560,code:96}]};
 const parse=code=>C.parsePart({data:F.midi([{name:'PART GUITAR',notes:[{tick:480,code,length:480}]},drums]),file:{name:'notes.mid'},metadata:{five_lane_drums:'True'}},'drums',F.row);
 assert.deepEqual(parse(96).charts.drums.expert,parse(100).charts.drums.expert);assert.deepEqual(parse(96).charts.drums.expert.map(n=>[n.lane,n.time]),[[0,1],[1,1.125],[2,1.25],[3,1.375],[3,1.5],[5,1.625]]);
 const text='[Song]\n{\nResolution = 192\n}\n[SyncTrack]\n{\n0 = B 120000\n}\n[ExpertSingle]\n{\n192 = N 4 0\n}\n[ExpertDrums]\n{\n384 = N 1 0\n480 = N 2 0\n576 = N 3 0\n672 = N 4 0\n768 = N 5 0\n864 = N 0 0\n}';
 const chart=C.parsePart({data:Buffer.from(text),file:{name:'notes.chart'},metadata:{five_lane_drums:'True'}},'drums',F.row);assert.deepEqual(chart.charts.drums.expert.map(n=>[n.lane,n.time]),[[0,1],[1,1.25],[2,1.5],[3,1.75],[3,2],[5,2.25]]);assert.equal(chart.charts.guitar,undefined);
});
