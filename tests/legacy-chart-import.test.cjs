const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../dist/midi-chart.js'),C=require('../dist/community-charts.js'),F=require('./helpers/community-fixture.cjs');
const payload=Buffer.from([0x50,0x53,0,0,255,4,0,0xf7]);
const annotated=()=>F.midi([{name:'PART GUITAR',events:[
 {tick:480,data:Buffer.from([0x90,96,100])},
 {tick:490,data:F.meta(1,'[section fixture]')},
 {tick:510,data:Buffer.from([96,0])},
 {tick:600,data:Buffer.from([98,100])},
 {tick:610,data:Buffer.concat([Buffer.from([0xf0,payload.length]),payload])},
 {tick:630,data:Buffer.from([98,0])}
]},{name:'PART DRUMS',notes:[{tick:960,code:97},{tick:1080,code:101},{tick:1200,code:96}]}]);
test('catalog chart compatibility accepts running status after annotations without borrowing Guitar notes',()=>{
 const data=annotated();assert.throws(()=>M.parse(data,{part:'drums'}),/Invalid/);
 const p=C.parsePart({data,file:{name:'notes.mid'},metadata:{five_lane_drums:'True'}},'drums',{...F.row,icon:'ghwordlc'});
 assert.deepEqual(Object.keys(p.charts),['drums']);assert.deepEqual(p.charts.drums.expert.map(n=>[n.lane,n.time]),[[0,1],[4,1.125],[5,1.25]]);assert.equal(p.playLayout,'five');assert.match(p.warnings[0],/Legacy chart running status/);
});
test('legacy compatibility still rejects absent status, broken chunks and unmatched note pairs',()=>{
 const absent=F.midi([{name:'PART DRUMS',events:[{tick:480,data:Buffer.from([97,100])}]}]);
 const dangling=F.midi([{name:'PART DRUMS',events:[{tick:480,data:Buffer.from([0x90,97,100])}]}]);
 for(const data of [absent,dangling,annotated().subarray(0,-1)])assert.throws(()=>M.parse(data,{part:'drums',legacyRunningStatus:true}),/Invalid/);
});
const markers=[120,121,122,123,124].map(code=>({tick:960,code,length:480}));
const before={tick:480,code:97},after={tick:1440,code:96};
test('a complete interior Drum activation window may be empty without creating notes',()=>{
 const p=M.parse(F.midi([{name:'PART DRUMS',notes:[before,...markers,after]}]),{part:'drums',outputDrumLayout:'four'});
 assert.deepEqual(p.charts.drums.expert.map(n=>[n.lane,n.time]),[[0,.5],[5,1.5]]);assert.match(p.warnings[0],/uncharted interior windows stay empty/);
});
test('partial markers, real coda endings and final uncharted windows remain unsupported',()=>{
 for(const tracks of [[{name:'PART DRUMS',notes:[before,markers[0],after]}],[{name:'PART DRUMS',notes:[before,...markers]}],[{name:'EVENTS',events:[{tick:960,data:F.meta(1,'[coda]')}]},{name:'PART DRUMS',notes:[before,...markers,after]}]])assert.throws(()=>M.parse(F.midi(tracks),{part:'drums',outputDrumLayout:'four'}),/Freestyle/);
});
