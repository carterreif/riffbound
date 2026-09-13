/* Textured deformable performers; GPU rendering keeps the note highway responsive. */
(function(root){
  'use strict';
  const ROWS=[{y:0,h:342},{y:342,h:334},{y:666,h:341},{y:1018,h:222}],COLS=[{x:0,w:314},{x:314,w:314},{x:628,w:312},{x:940,w:314}];
  function create(atlas){
    const surface=document.createElement('canvas');
    const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl)return null;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Stage shader compilation failed');return s;}
    let program;
    try{
      program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 aPosition; attribute vec2 aUV; uniform vec2 uResolution; varying mediump vec2 vUV; void main(){ vec2 clip=aPosition/uResolution*2.0-1.0; gl_Position=vec4(clip.x,-clip.y,0.0,1.0); vUV=aUV; }'));
      gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform sampler2D uAtlas; varying mediump vec2 vUV; void main(){ gl_FragColor=texture2D(uAtlas,vUV); }'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
    }catch{return null;}
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const NX=28,NY=36,vertices=new Float32Array((NX+1)*(NY+1)*4),indices=new Uint16Array(NX*NY*6);let k=0;
    for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const i=y*(NX+1)+x;indices.set([i,i+NX+1,i+1,i+1,i+NX+1,i+NX+2],k);k+=6;}
    const vbo=gl.createBuffer(),ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'aPosition'),uv=gl.getAttribLocation(program,'aUV'),res=gl.getUniformLocation(program,'uResolution');
    let w=0,h=0,lost=false;
    surface.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;});
    function begin(width,height,dpr){
      if(lost)return false;w=width;h=height;const rw=Math.round(w*dpr),rh=Math.round(h*dpr);if(surface.width!==rw||surface.height!==rh){surface.width=rw;surface.height=rh;}
      gl.viewport(0,0,surface.width,surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(program,'uAtlas'),0);gl.uniform2f(res,w,h);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);return true;
    }
    function draw(row,frame,placement,motion){
      const r=ROWS[row],c=COLS[frame],width=placement.size*c.w/r.h,co=Math.cos(placement.angle),si=Math.sin(placement.angle);let i=0;
      for(let y=0;y<=NY;y++)for(let x=0;x<=NX;x++){
        const u=x/NX,v=y/NY,[dx,dy]=root.RiffMotion.deform(row,u,v,motion),px=(dx-.5)*width,py=(dy-.92)*placement.size;
        vertices[i++]=placement.x+px*co-py*si;vertices[i++]=placement.y+placement.size*.92+px*si+py*co;
        // Sample inside each cell so neighboring poses do not bleed through at the edges.
        vertices[i++]=(c.x+.5+u*(c.w-1))/1254;vertices[i++]=(r.y+.5+v*(r.h-1))/1254;
      }
      gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    }
    return{surface,begin,draw,get lost(){return lost;}};
  }
  root.RiffMesh={create};
})(window);
