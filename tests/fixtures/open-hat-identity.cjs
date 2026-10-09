// Independent labeled metallic hats share a timbre across open/closed strokes.
// Separate broadband crashes, red rolls, blue/green fills and deliberate rests.
function fixture({seed=481,decay=7,bars=6,metalLevel=.15,duets=false,sharpCrash=false,partialShift=1,openGain=1,choke=false,ringingHat=false,washRate=0,snareOverlap=false,snareCrash=false,hatDelay=0}={}){
 const sampleRate=22050,samples=new Float32Array(Math.ceil((bars*3.6+1)*sampleRate)),expected=[];
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 const partials=[3217,4783,6119,7577,8999].map(f=>f*partialShift);
 function hit(time,lane,gain=1,open=false){expected.push({time,lane});let low=0;
 for(let i=0;i<sampleRate*.8&&Math.round(time*sampleRate)+i<samples.length;i++){
 const t=i/sampleRate,r=noise();low+=.5*(r-low);const metal=partials.reduce((s,f)=>s+Math.sin(2*Math.PI*f*t),0)/partials.length;
 let x=lane===1?(.11*(r-low)+metalLevel*metal)*Math.exp(-t*(open?decay:65)):lane===3?.2*(r-low)*(Math.exp(-t*4)+(sharpCrash?2*Math.exp(-t*85):0))*(1+.2*Math.sin(2*Math.PI*washRate*t)):lane===0?(.25*r+.25*Math.sin(2*Math.PI*190*t))*Math.exp(-t*24):lane===5?.7*Math.sin(2*Math.PI*54*t)*Math.exp(-t*18):.5*Math.sin(2*Math.PI*(lane===2?168:89)*t)*Math.exp(-t*9)+.004*r*Math.exp(-t*40);
 if(choke&&lane===1&&open)x*=t<.2?1:Math.exp(-(t-.2)*500);
 samples[Math.round(time*sampleRate)+i]+=gain*x;}}
 for(let bar=0;bar<bars;bar++){const s=.65+bar*3.6;hit(s,1);hit(s+.17,1,.5);hit(s+.38+hatDelay,1,openGain,true);if(snareOverlap)hit(s+.38,0,.6);hit(s+.9,0);hit(s+1.03,0,.6);hit(s+1.3,2);hit(s+1.49,4);hit(s+1.7,1,.6);if(ringingHat)hit(s+1.9,1,1,true);hit(s+2,3);if(snareCrash)hit(s+2,0,.6);if(duets)hit(s+2,1,1.5);hit(s+2,5);hit(s+2.5,1);hit(s+2.67,1,.5);}
 return {samples,sampleRate,expected};
}
module.exports={fixture};
