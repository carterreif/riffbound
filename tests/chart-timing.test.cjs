const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../dist/chart-timing.js'),X=require('../dist/chart-exchange.js'),L=require('../dist/song-library.js');
const levels={expert:[{time:1,lane:4,duration:.4,id:1},{time:1,lane:1,duration:.2,id:2}],hard:[{time:1,lane:4,duration:.4,id:1}],medium:[{time:2,lane:2,duration:0}],easy:[{time:3,lane:0,duration:0}]};
test('uniform timing changes preserve chords, colors, holds and all difficulties, and reset exactly',()=>{
 const moved=T.shift(levels,100,10);for(const level of Object.keys(levels))for(let i=0;i<levels[level].length;i++){const n=levels[level][i],actual=moved[level][i];assert.deepEqual(actual,{...n,time:n.time+.1});}
 for(const level of Object.keys(levels))T.shift(moved,-100,10)[level].forEach((n,i)=>assert.ok(Math.abs(n.time-levels[level][i].time)<1e-12));
 assert.deepEqual(levels.expert.map(n=>n.time),[1,1]);assert.throws(()=>T.shift(levels,-1100,10),/outside/);assert.throws(()=>T.shift(levels,1000,3),/outside/);assert.throws(()=>T.shift(levels,NaN,10),/valid/);
});
test('highway grid follows authored tempo, time signature and instrument shift',()=>{
 const timing={resolution:480,offset:.1,tempos:[{tick:0,bpm:120},{tick:1440,bpm:60}],signatures:[{tick:0,numerator:3,exponent:2},{tick:1440,numerator:4,exponent:2}]};
 assert.deepEqual(T.grid(timing,0,4.8,100),[{time:.2,major:true},{time:.7,major:false},{time:1.2,major:false},{time:1.7,major:true},{time:2.7,major:false},{time:3.7,major:false},{time:4.7,major:false}]);
 assert.equal(T.grid(timing,0,1,0)[0].time,.1);
 const later={...timing,signatures:[{tick:2400,numerator:3,exponent:2}]};assert.equal(T.grid(later,0,4,0)[0].major,true);assert.equal(T.grid(later,0,4,0)[4].major,true);
});
const times=Array.from({length:30},(_,i)=>1+i*.63+(i%5)*.047);
const hits=offset=>times.map(time=>({time:time+offset,strength:1}));
test('timing review recognizes aligned and stable shifted attacks without altering notes',()=>{
 const notes=times.map(time=>({time,lane:2,duration:0}));assert.equal(T.review({duration:22,peaks:hits(0)},notes).status,'aligned');
 const suggestion=T.review({duration:22,peaks:hits(.13)},notes);assert.equal(suggestion.status,'suggested');assert.ok(Math.abs(suggestion.suggestedMs-130)<=25);assert.deepEqual(notes.map(n=>n.time),times);
});
test('timing review rejects silence, sparse material, tempo drift and competing rhythmic offsets',()=>{
 const notes=times.map(time=>({time}));assert.equal(T.review({duration:22,peaks:[]},notes).suggestedMs,null);
 assert.equal(T.review({duration:22,peaks:hits(.1)},notes.slice(0,4)).suggestedMs,null);
 const drift=times.map((time,i)=>({time:time+.05+i*.01,strength:1}));assert.equal(T.review({duration:22,peaks:drift},notes).status,'uncertain');
 const competing=[...hits(.12),...hits(-.12)].sort((a,b)=>a.time-b.time);assert.equal(T.review({duration:22,peaks:competing},notes).status,'uncertain');
});
test('audio evidence detects distinct attacks in a rendered waveform and ignores silence',()=>{
 const rate=22050,samples=new Float32Array(rate*22);for(const time of times)for(let i=0;i<rate*.05;i++)samples[Math.round(time*rate)+i]=Math.exp(-i/(rate*.005));
 const evidence=T.evidence(samples,rate);assert.equal(T.review(evidence,times.map(time=>({time}))).status,'aligned');assert.equal(T.evidence(new Float32Array(rate)).peaks.length,0);
});
test('saved shifts and difficulty origins survive backup and notes.chart export retains absolute timing',async()=>{
 const song={id:'a'.repeat(64),title:'Shifted',instrument:'guitar',musicEnd:10,bpm:120,beat:.5,waveform:[],charts:{guitar:T.shift(levels,100,10)},audioBlob:new Blob(['wav']),quality:{chartAdjustments:{guitar:100},imports:{guitar:{id:'b'.repeat(64),filename:'notes.mid',levels:['expert','hard','medium','easy'],derived:[],derivedFrom:{}}}}};
 const saved=await L.unpack(L.pack(song));assert.equal(saved.quality.chartAdjustments.guitar,100);const canonical=charts=>Object.fromEntries(Object.entries(charts).map(([part,levels])=>[part,Object.fromEntries(Object.entries(levels).map(([level,notes])=>[level,notes.map(({id,...n})=>n)]))]));assert.deepEqual(canonical(saved.charts),canonical(L.validate(song).charts));
 const parsed=X.parse(X.exportChart(saved));for(const level of Object.keys(levels))parsed.charts.guitar[level].forEach((n,i)=>assert.ok(Math.abs(n.time-saved.charts.guitar[level][i].time)<.0001));
});

test('uniform shifts target attack centers rather than the edge of the tolerance window',()=>{
 const notes=times.map(time=>({time}));for(const shift of [.137,-.137,.7,-.7]){const r=T.review({duration:22,peaks:hits(shift)},notes);assert.equal(r.status,'suggested');assert.ok(Math.abs(r.suggestedMs-shift*1000)<=1);assert.ok(r.medianErrorMs<1);assert.equal(r.windowFits.length,3);}
});
test('timing review rejects half-beat ambiguity, dense-intro bias, and small but consistent tempo drift',()=>{
 const periodic=Array.from({length:40},(_,i)=>({time:1+i*.5})),peaks=periodic.map(n=>({time:n.time+.12,strength:1}));assert.equal(T.review({duration:22,peaks},periodic).status,'uncertain');
 const notes=times.map(time=>({time})),drift=times.map((time,i)=>({time:time+.1+(i/29)*.04,strength:1}));assert.equal(T.review({duration:22,peaks:drift},notes).status,'uncertain');
 const early=[...Array.from({length:120},(_,i)=>1+i*.035),11,21,31],earlyPeaks=early.map(time=>({time:time+.1,strength:1}));assert.equal(T.review({duration:33,peaks:earlyPeaks},early.map(time=>({time}))).suggestedMs,null);
});
