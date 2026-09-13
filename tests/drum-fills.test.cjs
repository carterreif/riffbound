const test=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('../dist/autochart.js');
const {measureChart}=require('./chart-metrics.cjs');
const {fixture}=require('./fixtures/drum-fills.cjs');

for(const [seed,minBlue,minGreen,minSnare,minKick,maxKickExtra] of [[119,14,12,36,27,1],[241,15,11,36,26,3]]){
  test(`fast mixed fills ${seed}: reduce wrong colors and distinguish blue rack toms from green floor toms`,t=>{
    const f=fixture(seed),result=analyze({...f,instrument:'drums'});
    for(const level of ['normal','expert']){
      const notes=result.charts.drums[level],metrics=measureChart(f.truth,notes);
      assert.ok(metrics[2].matched>=minBlue,'Recover rack-tom attacks previously assigned to other drums');
      assert.ok(metrics[4].matched>=minGreen,'Keep genuine floor-tom hits');
      for(const lane of [0,2,4])assert.equal(metrics[lane].extra,0,`No false body color ${lane}`);
      assert.ok(metrics[0].matched>=minSnare&&metrics[5].matched>=minKick);
      assert.ok(metrics[5].extra<=maxKickExtra);
      assert.equal(metrics[3].matched,4,'Recover all independently supported orange crashes');
      assert.equal(metrics[3].extra,0,'Do not invent cymbal strikes');
      assert.ok(metrics[1].matched>=87&&metrics[1].extra<=1,'Recover supported hats without adding snare-roll noise duplicates');
      const rollSnares=f.truth.filter(n=>n.lane===0&&f.truth.some(other=>other!==n&&other.lane===0&&Math.abs(n.time-other.time)<.19));
      for(const hit of rollSnares)assert.deepEqual(notes.filter(n=>Math.abs(n.time-hit.time)<.03).map(n=>n.lane),[0],'A snare-only fill strike must be red alone');
      assert.ok(notes.every(n=>n.time>.5&&n.time<19.3),'No generated pattern during the opening or trailing rest');
      // These kicks follow floor toms: the fading floor body is not another hit.
      for(const time of [4.475,8.475,12.475,16.475])assert.ok(!notes.some(n=>n.lane===4&&Math.abs(n.time-time)<.035));
    }
    t.diagnostic(measureChart(f.truth,result.charts.drums.expert).map(m=>`lane ${m.lane}: ${m.matched}/${m.expected}, ${m.extra} extras`).join('; '));
  });
}
