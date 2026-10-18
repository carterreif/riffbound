/* Original procedural highway art inspired by rhythm-game eras. No extracted game assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RiffHighwayStyles=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const style=(id,label,pattern,top,middle,bottom,ink,rail,grid)=>Object.freeze({id,label,pattern,top,middle,bottom,ink,rail,grid});
 const STYLES=Object.freeze([
  style('riffbound','Riffbound · Original','none','#141a20','#171d23','#080a0e','#899ba8','#68747d','197,212,214'),
  style('gh1','Guitar Hero I · Vintage wood','wood','#120c09','#261a13','#100b08','#cf9a5f','#bf9166','204,171,132'),
  style('gh2','Guitar Hero II · Road-worn flames','flames','#140907','#28140e','#100807','#e28542','#ca9363','220,166,126'),
  style('gh80s','Guitar Hero Encore: Rocks the 80s · Neon','neon','#100b1c','#1e1630','#0d0915','#dc77ed','#ad9dea','184,168,222'),
  style('gh3','Guitar Hero III · Iron & fire','bolts','#100a09','#251413','#0d0909','#e29166','#a99c90','211,178,157'),
  style('aerosmith','Guitar Hero: Aerosmith · Silver wings','wings','#0c0d14','#20222b','#0a0b10','#b5bfd6','#bfc8da','192,201,224'),
  style('world-tour','Guitar Hero World Tour · Stage brass','tour','#100e09','#242016','#0e0d09','#c7ae68','#d0bd8f','209,197,157'),
  style('metallica','Guitar Hero: Metallica · Brushed steel','metal','#080c10','#182129','#080d12','#a9bfcb','#d2dde2','179,201,211'),
  style('smash-hits','Guitar Hero Smash Hits · Starburst','stars','#100b10','#241722','#0e090f','#c598b6','#c8b0c7','211,184,211'),
  style('gh5','Guitar Hero 5 · Studio grooves','vinyl','#0d0d10','#1c1d22','#09090d','#a8b3be','#bbc3cc','193,200,211'),
  style('van-halen','Guitar Hero: Van Halen · Diagonal stripes','stripes','#160909','#2b1112','#110809','#e0c9c5','#d7aaa5','222,194,190'),
  style('band-hero','Band Hero · Spotlight diamonds','diamonds','#0c101a','#17243a','#090d16','#8caade','#b1c4e5','174,196,227'),
  style('warriors','Guitar Hero: Warriors of Rock · Carved runes','runes','#0b0f0c','#19231a','#090d0a','#a9bc84','#bac3a3','188,207,164')
 ]);
 const get=id=>STYLES.find(s=>s.id===id)||STYLES[0];
 function draw(ctx,theme,{point,lanes,time=0,reducedMotion=false}){
  const s=get(typeof theme==='string'?theme:theme?.id);if(s.pattern==='none')return;
  const a=point(0,0),b=point(lanes-1,0),c=point(lanes-1,1.18),d=point(0,1.18);
  const at=(u,z)=>{const l=point(0,z),r=point(lanes-1,z),left=l.x-l.w/2;return {x:left+u*(r.x+r.w/2-left),y:l.y,w:r.x+r.w/2-left};};
  const path=(points,color=s.ink+'33',fill=false)=>{ctx.beginPath();points.forEach(([u,z],i)=>{const p=at(u,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});if(fill)ctx.closePath();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.2;if(fill)ctx.fill();else ctx.stroke();};
  ctx.save();ctx.beginPath();ctx.moveTo(a.x-a.w/2,a.y);ctx.lineTo(b.x+b.w/2,b.y);ctx.lineTo(c.x+c.w/2,c.y);ctx.lineTo(d.x-d.w/2,d.y);ctx.closePath();ctx.clip();ctx.shadowBlur=0;
  const rows=18,phase=reducedMotion?0:((Math.max(0,time)*1.3)%1),row=i=>Math.pow((i+phase)/rows,2)*1.18;
  if(s.pattern==='wood'){
   for(let g=0;g<12;g++){const pts=[];for(let r=0;r<=22;r++)pts.push([(g+.5)/12+Math.sin(r*.7+g*2.1)*.009,r/22*1.18]);path(pts,s.ink+(g%3?'18':'30'));}
   for(let i=3;i<rows;i+=4){const p=at(i%2?.28:.72,row(i));ctx.beginPath();ctx.ellipse(p.x,p.y,p.w*.025,p.w*.07,0,0,Math.PI*2);ctx.strokeStyle=s.ink+'24';ctx.stroke();}
  }else if(s.pattern==='metal'){
   for(let i=0;i<rows;i++){const z=row(i),w=.003+z*.008;path([[0,z],[1,z]],s.ink+'20');for(const u of [.06,.94]){const p=at(u,z);ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,p.w*.004),Math.max(.7,p.w*.0025),0,0,Math.PI*2);ctx.fillStyle=s.ink+'66';ctx.fill();}for(let j=0;j<3;j++){const u=((i*17+j*31)%73)/100;path([[u,z+w],[Math.min(1,u+.12),z+w]],s.ink+'0c');}}
  }else if(s.pattern==='vinyl'){
   for(let i=2;i<rows;i+=3){const p=at(.5,row(i));for(let ring=1;ring<=4;ring++){ctx.beginPath();ctx.ellipse(p.x,p.y,p.w*.095*ring,p.w*.018*ring,0,0,Math.PI*2);ctx.strokeStyle=s.ink+'1c';ctx.stroke();}}
  }else for(let i=1;i<rows;i++){
   const z=row(i),end=row(i+.65),mid=(z+end)/2;
   if(s.pattern==='flames')for(const u of [.18,.5,.82])path([[u-.06,end],[u-.03,mid],[u-.04,z],[u+.025,mid-.009],[u+.06,end]],s.ink+'38',true);
   if(s.pattern==='bolts')for(const u of [.16,.84])path([[u-.045,z],[u+.035,mid],[u-.015,mid],[u+.05,end]],s.ink+'55');
   if(s.pattern==='wings'){path([[.5,end],[.38,mid],[.12,z],[.25,end],[.05,mid]],s.ink+'2c');path([[.5,end],[.62,mid],[.88,z],[.75,end],[.95,mid]],s.ink+'2c');}
   if(s.pattern==='tour'){path([[.08,z],[.5,end],[.92,z]],s.ink+'36');path([[.16,z],[.5,mid],[.84,z]],s.ink+'20');}
   if(s.pattern==='neon'||s.pattern==='diamonds'){const u=i%2?.32:.68;path([[u,z],[u+.11,mid],[u,end],[u-.11,mid],[u,z]],s.ink+(s.pattern==='neon'?'44':'27'));if(s.pattern==='neon')path([[.04,z],[.96,z]],'#81cde31c');}
   if(s.pattern==='stars'&&i%2){const pts=[];for(let k=0;k<10;k++){const angle=-Math.PI/2+k*Math.PI/5,r=k%2?.045:.1;pts.push([.5+Math.cos(angle)*r,mid+Math.sin(angle)*r*(end-z)*4]);}path(pts,s.ink+'2d',true);}
   if(s.pattern==='stripes'){path([[0,z],[.24,z],[.44,end],[.2,end]],s.ink+'32',true);path([[.66,z],[.78,z],[.98,end],[.86,end]],s.ink+'23',true);}
   if(s.pattern==='runes'){for(const u of [.19,.81]){path([[u,z],[u,end]],s.ink+'4b');path([[u,mid],[u-.055,z],[u+.055,mid],[u,end]],s.ink+'36');}if(i%3===0)path([[.35,mid],[.5,z],[.65,mid],[.5,end],[.35,mid]],s.ink+'2c');}
  }
  ctx.restore();
 }
 return {STYLES,get,draw};
});
