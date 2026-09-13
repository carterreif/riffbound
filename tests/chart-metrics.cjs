// One expected strike and one generated note per match. Wrong colors count on
// both affected lanes; counts alone must never masquerade as accuracy.
function measureChart(expected,notes,tolerance=.03,laneCount=6){
  return Array.from({length:laneCount},(_,lane)=>{
    const truth=expected.filter(n=>n.lane===lane).sort((a,b)=>a.time-b.time);
    const actual=notes.filter(n=>n.lane===lane).sort((a,b)=>a.time-b.time);
    let i=0,j=0;const errors=[];
    while(i<truth.length&&j<actual.length){
      const delta=actual[j].time-truth[i].time;
      if(delta < -tolerance)j++;
      else if(delta > tolerance)i++;
      else{errors.push(Math.abs(delta));i++;j++;}
    }
    const matched=errors.length;
    return {lane,expected:truth.length,generated:actual.length,matched,missed:truth.length-matched,extra:actual.length-matched,precision:actual.length?matched/actual.length:null,recall:truth.length?matched/truth.length:null,errors};
  });
}
module.exports={measureChart};
