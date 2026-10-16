const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const E=require('../dist/engine.js'),D=require('../dist/chart-difficulties.js'),M=require('../dist/midi-chart.js'),X=require('../dist/chart-exchange.js'),L=require('../dist/song-library.js'),F=require('./helpers/community-fixture.cjs');
const path=require.resolve('./upload-flow.test.cjs'),prefix=fs.readFileSync(path,'utf8').split('\ntest(')[0],{setup,until}=new Function('require',prefix+'\nreturn {setup,until};')(createRequire(path));
const voice=n=>n.drumVoice;

test('five-lane Orange and Green require independent hits and rolls, including simultaneous notes',()=>{
 const notes=[{lane:3,time:1,duration:0,rollDuration:2},{lane:4,time:1,duration:0}],s=new E.Session('expert','tap','drums',{drumLayout:'five',separateDrums:true,notes,musicEnd:5});
 assert.equal(s.tap(4,1),true);assert.equal(s.hits,1);assert.equal(s.notes[0].hit,false);assert.equal(s.findRoll(4,1.5),undefined);assert.equal(s.tap(3,1),true);assert.equal(s.hits,2);assert.equal(s.findRoll(3,1.5).lane,3);const score=s.score;assert.equal(s.tap(3,1.5),true);assert.equal(s.score,score);
});
test('MIDI Pro cymbal/tom markers remain available in a four-lane source and survive saved backups for exact five-lane roles',async()=>{
 const data=F.midi([{name:'PART DRUMS',notes:[{tick:960,code:98},{tick:1920,code:99},{tick:2880,code:100},{tick:2880,code:112,length:120}]}]),parsed=M.parse(data,{part:'drums',drumLayout:'pro',outputDrumLayout:'four'}),notes=parsed.charts.drums.expert;
 assert.deepEqual(notes.map(n=>n.lane),[1,2,3]);assert.deepEqual(notes.map(voice),['hihat','cymbal','floor']);const q={drumLayout:'four',drumPlayLayout:'five'},view=D.playDrums(notes,q);assert.deepEqual(view.map(n=>n.lane),[1,3,4]);
 const record={id:'a'.repeat(64),title:'Pro roles',chartOnly:true,instrument:'drums',musicEnd:16,bpm:120,beat:.5,quality:q,charts:{drums:D.build(notes,'drums')}};const out=await L.unpack(L.pack(record));assert.deepEqual(out.charts.drums.expert.map(voice),notes.map(voice));assert.deepEqual(D.playDrums(out.charts.drums.expert,out.quality).map(n=>n.lane),[1,3,4]);
});
test('.chart Pro cymbal flags separate Orange from Green while four-lane play keeps native pad colors',()=>{
 const text='[Song]\n{\nResolution = 192\n}\n[SyncTrack]\n{\n0 = B 120000\n}\n[ExpertDrums]\n{\n384 = N 2 0\n384 = N 66 0\n768 = N 3 0\n768 = N 67 0\n1152 = N 4 0\n}\n',p=X.parse(text,{drumLayout:'pro',outputDrumLayout:'four'}),n=p.charts.drums.expert;
 assert.deepEqual(n.map(x=>x.lane),[1,2,3]);assert.deepEqual(n.map(voice),['hihat','cymbal','floor']);assert.deepEqual(D.playDrums(n,{drumLayout:'four',drumPlayLayout:'five'}).map(x=>x.lane),[1,3,4]);
});
test('standard four-pad adaptation uses Orange on accents, keeps Green toms and uses the same colors at every difficulty without new attack times',()=>{
 const expert=[{lane:1,time:1,duration:0},{lane:5,time:1,duration:0},{lane:1,time:1.5,duration:0},{lane:3,time:2,duration:0},{lane:1,time:2,duration:0},{lane:2,time:2,duration:0}],q={drumLayout:'four',drumPlayLayout:'five'},view=D.playDrums(expert,q,{reference:expert,beat:.5});assert.ok(view.some(n=>n.lane===3));assert.ok(view.some(n=>n.lane===4));assert.ok(view.some(n=>n.lane===1));assert.deepEqual(new Set(view.map(n=>n.time)),new Set(expert.map(n=>n.time)));
 const easy=[expert[2],expert[3]],easyView=D.playDrums(easy,q,{reference:expert,beat:.5});for(let i=0;i<easy.length;i++)assert.equal(easyView[i].lane,view.find(n=>n.time===easy[i].time&&n.lane===(easy[i].lane===3?4:1)).lane);assert.deepEqual(expert.map(n=>n.lane),[1,5,1,3,1,2]);
});
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'} gameplay does not score Orange with Green and preserves separate Orange/Green chord scoring`,async()=>{
 const record={id:'c'.repeat(64),title:'Separate pads',musicEnd:16,bpm:120,beat:.5,instrument:'drums',filename:'Separate.wav',audioBlob:new Blob([new Uint8Array([1])]),quality:{drumLayout:'five',drumPlayLayout:'five'},charts:{drums:D.build([{lane:3,time:1,duration:0},{lane:4,time:1,duration:0}],'drums')}},a=setup({mobile,chartFixture:[],savedSongs:new Map([[record.id,record]])}),n=a.nodes;
 await until(()=>n.setlistEntries.children.length===2);await n.setlistEntries.children[1].click();await a.radios.difficulty.find(r=>r.value==='expert').emit('change');assert.doesNotMatch(n.modeHint.textContent,/also hits/);await n.playButton.click();await until(()=>a.sources.length);const when=a.sources[0].when;a.tick(when+1);await a.key('keydown','KeyL');await a.key('keyup','KeyL');a.tick(when+1.071);assert.equal(n.score.textContent,'000,100');await a.key('keydown','KeyK');await a.key('keyup','KeyK');a.tick(when+1.15);assert.equal(n.score.textContent,'000,200');a.tick(when+18);assert.equal(n.resultAccuracy.textContent,'100%');assert.match(n.resultNotes.textContent,/2 of 2 notes hit/);
});
