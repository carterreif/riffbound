const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../dist/autochart.js'),D=require('../dist/chart-difficulties.js'),L=require('../dist/song-library.js');
const {fixture}=require('./fixtures/quiet-attacks.cjs'),{measureChart}=require('./chart-metrics.cjs'),{storage}=require('./helpers/song-storage.cjs');

for(const [instrument,lane,gain,spacing] of [
  ['drums',0,.03,.23],['drums',1,.03,.23],['drums',2,.12,.23],
  ['drums',3,.06,.85],['drums',4,.06,.23],['drums',5,.06,.23],
  ['guitar',0,.03,.23],['bass',0,.03,.23],['vocals',0,.03,.23]
])test(`quiet ${instrument} voice ${lane}: all supported hits, separate colors and eight ghost markers`,t=>{
  const f=fixture(instrument,lane,gain,spacing),r=A.analyze({...f,instrument}),notes=r.charts[instrument].expert;
  assert.equal(notes.length,24);
  for(const hit of f.truth){
    const n=notes.find(n=>Math.abs(n.time-hit.time)<.03&&(instrument==='drums'?n.lane===hit.lane:n.pitch===hit.pitch));
    assert.ok(n,`Missing hit at ${hit.time}`);assert.equal(!!n.ghost,hit.quiet,`Wrong dynamics at ${hit.time}`);
    assert.ok(n.velocity>0&&n.velocity<=1);
  }
  if(instrument==='drums')for(const m of measureChart(f.truth,notes))assert.equal(m.extra,0);
  assert.equal(r.quality.ghostHits,8);assert.equal(r.quality.ghostEvidencePolicy,'relative-attack-dynamics-v1');
  for(const level of ['hard','medium','easy']){
    assert.ok(r.charts[instrument][level].length>0);assert.ok(r.charts[instrument][level].every(n=>!n.ghost));
    for(const n of r.charts[instrument][level])assert.ok(notes.some(e=>e.time===n.time&&e.duration===n.duration&&(instrument==='drums'?e.lane===n.lane:e.pitch===n.pitch)));
  }
  t.diagnostic('24/24 onsets within 30 ms; 8 soft hits marked; zero extra heads.');
});

for(const instrument of ['drums','guitar','bass','vocals'])test(`${instrument}: a uniformly quiet recording is not labeled entirely as ghost notes`,()=>{
  const f=fixture(instrument,0,1,.23);for(let i=0;i<f.samples.length;i++)f.samples[i]*=.03;
  const r=A.analyze({...f,instrument});assert.equal(r.charts[instrument].expert.length,24);assert.equal(r.quality.ghostHits,0);
});

test('a soft pickup cannot displace the strong backbeat on simpler difficulties',()=>{
  const expert=[{lane:0,time:1,duration:0,ghost:true,velocity:.04},{lane:0,time:1.04,duration:0,velocity:1},{lane:2,time:2,duration:0,velocity:.8}];
  const charts=D.build(expert,'drums',.5);assert.equal(charts.expert.length,3);
  for(const level of ['easy','medium','hard'])assert.deepEqual(charts[level].map(n=>n.time),[1.04,2]);
});

test('ghost notes use the same pad, hit window and scoring as other Expert hits',()=>{
  const E=require('../dist/engine.js');
  for(const lane of [0,1,2,3,4,5]){
    const normal=new E.Session('expert','tap','drums',{notes:[{lane,time:1,duration:0}],musicEnd:3});
    const quiet=new E.Session('expert','tap','drums',{notes:[{lane,time:1,duration:0,ghost:true,velocity:.04}],musicEnd:3});
    assert.equal(quiet.notes[0].ghost,true);assert.equal(quiet.tap(lane,1.02),normal.tap(lane,1.02));assert.equal(quiet.hits,1);assert.equal(quiet.score,normal.score);
  }
});

test('ghost dynamics survive chunked save, fresh reopen, export and import; malformed values are rejected',async()=>{
  const notes=[{lane:0,time:1,duration:0,ghost:true,velocity:.06},{lane:2,time:2,duration:0,velocity:1}],charts={drums:D.build(notes,'drums',.5)};
  const song={id:'a'.repeat(64),title:'Ghost test',instrument:'drums',musicEnd:10,beat:.5,bpm:120,charts,audioBlob:new Blob(['original audio']),waveform:[0,1]};
  const s=storage({rejectBlobs:true});await s.library.save(song);const loaded=await s.fresh().get(song.id),restored=await L.unpack(L.pack(loaded));
  for(const record of [loaded,restored])assert.deepEqual(JSON.parse(JSON.stringify(record.charts.drums.expert)),charts.drums.expert);
  assert.equal(await restored.audioBlob.text(),'original audio');
  for(const extra of [{ghost:'yes'},{velocity:0},{velocity:1.1},{velocity:NaN}]){
    assert.throws(()=>L.validate({...song,charts:{drums:{...charts.drums,expert:[{...notes[0],...extra}]}}}),/invalid note dynamics/);
  }
});

test('quiet-note rendering keeps the colored gem and adds a hollow marker to gems and kicks',()=>{
  const code=fs.readFileSync(require.resolve('../dist/game.js'),'utf8'),calls=[];
  const ctx=new Proxy({ellipse:(...args)=>calls.push(args),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
  const sandbox={ctx,point:lane=>({x:lane*100,y:200,w:100}),instrument:'drums',E:{KICK_COLOR:'#aa55dd'}};
  vm.createContext(sandbox);vm.runInContext(code.slice(code.indexOf('  function noteHead('),code.indexOf('  function draw(')),sandbox);
  sandbox.noteHead(0,1,'#f00',1,false);const regular=calls.length;calls.length=0;
  sandbox.noteHead(0,1,'#f00',1,true);assert.equal(calls.length,regular+2);assert.ok(calls.some(c=>c[1]===-.3&&c[2]===.3));
  calls.length=0;sandbox.kickNote(1,1,true);assert.equal(calls.length,1);
  assert.match(code,/noteHead\(n\.lane,z,color,.*n\.ghost\)/);assert.match(code,/kickNote\(z,isIdle\?\.8:1,n\.ghost\)/);
});
