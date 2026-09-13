/* Original animated band: pre-rendered character poses on a live concert stage. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.RiffEngine;
  const M=typeof module!=='undefined'&&module.exports?require('./performance-motion.js'):root.RiffMotion;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Measured source rectangles preserve each generated pose's feet and raised sticks.
  const ATLAS_ROWS=[{y:0,h:342},{y:342,h:334},{y:666,h:341},{y:1018,h:222}];
  const ATLAS_COLUMNS=[{x:0,w:314},{x:314,w:314},{x:628,w:312},{x:940,w:314}];
  const motion=M.sample;
  function create(canvas){
    const ctx=canvas.getContext('2d',{alpha:false}),atlas=new Image(),backdrop=new Image();
    let w=0,h=0,pixelRatio=1,ready=false,failed=false,mesh=null;
    const load=(image,path)=>new Promise((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Stage artwork failed to load'));image.src=path;});
    const loaded=Promise.all([load(atlas,'assets/band-atlas.png'),load(backdrop,'assets/concert-stage.png')]).then(()=>{ready=true;try{mesh=root.RiffMesh?.create(atlas)||null;}catch{mesh=null;}}).catch(()=>{failed=true;});
    function resize(width,height,dpr){w=width;h=height;pixelRatio=dpr;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
    function cover(image,zoom=1,pan=0){
      const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom;
      const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
      ctx.drawImage(image,(w-iw)/2+clamp(w*pan,-(iw-w)/2,(iw-w)/2),(h-ih)/2,iw,ih);
    }
    function sprite(row,frame,x,y,size,angle=0){
      const sourceRow=ATLAS_ROWS[row],sourceCol=ATLAS_COLUMNS[frame],sx=atlas.naturalWidth/1254,sy=atlas.naturalHeight/1254;
      const drawWidth=size*(sourceCol.w/sourceRow.h);
      ctx.save();ctx.translate(x,y+size*.92);ctx.rotate(angle);ctx.drawImage(atlas,sourceCol.x*sx,sourceRow.y*sy,sourceCol.w*sx,sourceRow.h*sy,-drawWidth/2,-size*.92,drawWidth,size);ctx.restore();
    }
    function beam(x,angle,rgb,strength){
      ctx.save();ctx.translate(x,h*.075);ctx.rotate(angle);
      const length=h*.68,spread=w*.2,g=ctx.createLinearGradient(0,0,0,length);
      g.addColorStop(0,`rgba(${rgb},${strength*.7})`);g.addColorStop(.55,`rgba(${rgb},${strength*.18})`);g.addColorStop(1,`rgba(${rgb},0)`);
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.lineTo(spread,length);ctx.lineTo(-spread,length);ctx.closePath();ctx.fill();ctx.restore();
    }
    function draw(options){
      if(!w||!h)return;
      const m=motion(options);ctx.fillStyle='#080b10';ctx.fillRect(0,0,w,h);
      if(!ready)return;
      const camera=M.cameras(m,w,h);
      cover(backdrop,m.reducedMotion?1:camera.backgroundZoom,camera.backgroundPan);
      ctx.fillStyle='#080c163f';ctx.fillRect(0,0,w,h);
      const amber=m.overdrive?'255,202,83':'250,153,60',teal=m.overdrive?'244,239,137':'52,232,206';
      ctx.globalCompositeOperation='screen';
      beam(w*.12,-.26+Math.sin(m.beamPhase)*.2,teal,m.light);
      beam(w*.88,.26-Math.sin(m.beamPhase+.8)*.2,amber,m.light);
      beam(w*.38,.3+Math.sin(m.beamPhase*.75)*.19,amber,m.light*.65);
      beam(w*.64,-.3-Math.sin(m.beamPhase*.75)*.19,teal,m.light*.65);
      ctx.globalCompositeOperation='source-over';
      const spotlight=(x,y,rgb)=>{const g=ctx.createRadialGradient(x,y,0,x,y,w*.34);g.addColorStop(0,`rgba(${rgb},${m.overdrive?.22:.11})`);g.addColorStop(1,`rgba(${rgb},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);};
      spotlight(camera.focus?w*.5:m.instrument==='drums'?w*.5:w*.18,h*.29,m.overdrive||m.fill?'255,206,89':'99,240,200');
      const crowdSize=Math.min(w*.38,h*.3),actors=[{row:2,frame:0,p:camera.drums},{row:0,frame:0,p:camera.lead},{row:1,frame:0,p:camera.bass}];
      if(!camera.focus||m.celebration>.5)for(let i=0;i<4;i++)actors.push({row:3,frame:i,p:{x:w*(.05+i*.3),y:h-crowdSize*(camera.focus?.4:.68)-m.bounce*(.5+i*.14),size:crowdSize,angle:0}});
      if(mesh&&mesh.begin(w,h,pixelRatio)){
        for(const actor of actors)mesh.draw(actor.row,actor.frame,actor.p,m);
        ctx.drawImage(mesh.surface,0,0,w,h);
      }else{
        for(const actor of actors){const p=actor.p;sprite(actor.row,actor.frame,p.x,p.y-m.bounce*.35,p.size,p.angle+m.head*.12);}
      }
      if(m.overdrive&&!m.reducedMotion){
        ctx.save();ctx.globalCompositeOperation='screen';
        for(let i=0;i<34;i++){
          const side=i%2?1:0,progress=(m.clock*.72+i*.137)%1;
          const x=w*(side?.94:.06)+(Math.sin(i*13.7)*w*.08)*progress;
          const y=h*.7-progress*h*.34;
          ctx.globalAlpha=(1-progress)*.7;ctx.fillStyle=i%3?'#ffbc59':'#fff5b8';ctx.fillRect(x,y,2,4+progress*5);
        }ctx.restore();
      }
      // Keep the outer edges and foreground dark enough for the game controls.
      const vignette=ctx.createRadialGradient(w*.5,h*.32,w*.12,w*.5,h*.4,Math.max(w,h)*.7);vignette.addColorStop(0,'#04061000');vignette.addColorStop(1,'#040610b8');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    }
    return {resize,draw,loaded,get ready(){return ready;},get failed(){return failed;}};
  }
  const api={motion,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffStage=api;
})(typeof window!=='undefined'?window:globalThis);
