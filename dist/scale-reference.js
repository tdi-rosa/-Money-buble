const REFERENCE_CENTS=2000;
const CANVAS_SHIFT=16;
const stage=document.getElementById('stage');
const canvas=document.getElementById('canvas');

if(stage&&canvas){
  const style=document.createElement('style');
  style.textContent=`
#scaleReference{position:absolute;left:0;top:0;z-index:3;pointer-events:none;transform-origin:left top;will-change:transform;}
#scaleReference img{display:block;width:100%;height:100%;object-fit:contain;}
#canvas{transform:translateX(${CANVAS_SHIFT}px);}
`;
  document.head.append(style);

  const ref=document.createElement('div');
  ref.id='scaleReference';
  ref.setAttribute('aria-hidden','true');
  ref.innerHTML=`<img alt="" draggable="false" src="data:image/png;base64,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">`;
  stage.append(ref);

  let frameBounds=null;
  let frameScale=0;
  let target=null;
  let current=null;
  let raf=0;

  function schedule(){if(!raf)raf=requestAnimationFrame(render);}
  function render(){
    raf=0;
    if(!target){ref.hidden=true;return;}
    ref.hidden=false;
    const snap=!current||Math.abs(target.h-(current?.h||0))>Math.max(40,target.h*1.2);
    if(snap) current={...target};
    else {
      const k=.42;
      current.x+=(target.x-current.x)*k;
      current.y+=(target.y-current.y)*k;
      current.w=target.w;
      current.h=target.h;
    }
    ref.style.width=`${current.w}px`;
    ref.style.height=`${current.h}px`;
    ref.style.transform=`translate3d(${current.x}px,${current.y}px,0)`;
    if(Math.abs(current.x-target.x)>.15||Math.abs(current.y-target.y)>.15)schedule();
  }

  function finishFrame(){
    if(!frameBounds||!frameScale) return;
    const personHeight=2*Math.sqrt(REFERENCE_CENTS)*frameScale;
    const personWidth=personHeight*(41/120);
    const stageWidth=stage.clientWidth;
    const preferredLeft=frameBounds.left-personWidth-10;
    target={
      x:Math.max(5,Math.min(preferredLeft,Math.max(5,stageWidth-personWidth-5))),
      y:frameBounds.bottom-personHeight,
      w:personWidth,
      h:personHeight
    };
    schedule();
  }

  const proto=CanvasRenderingContext2D.prototype;
  const originalClearRect=proto.clearRect;
  const originalArc=proto.arc;

  proto.clearRect=function(...args){
    if(this.canvas===canvas){
      if(frameBounds&&frameScale)finishFrame();
      frameBounds=null;
      frameScale=0;
    }
    return originalClearRect.apply(this,args);
  };

  proto.arc=function(x,y,r,...rest){
    if(this.canvas===canvas){
      const m=this.getTransform();
      const pixelRatio=canvas.width/Math.max(1,canvas.clientWidth);
      const scale=Math.hypot(m.a,m.b)/Math.max(.0001,pixelRatio);
      if(Number.isFinite(scale)&&scale>0){
        const sx=(m.a*x+m.c*y+m.e)/pixelRatio+CANVAS_SHIFT;
        const sy=(m.b*x+m.d*y+m.f)/pixelRatio;
        const sr=Math.abs(r)*scale;
        const sw=stage.clientWidth,sh=stage.clientHeight;
        if(sx+sr>=0&&sx-sr<=sw&&sy+sr>=0&&sy-sr<=sh){
          const b={left:sx-sr,right:sx+sr,top:sy-sr,bottom:sy+sr};
          if(!frameBounds)frameBounds=b;
          else {
            frameBounds.left=Math.min(frameBounds.left,b.left);
            frameBounds.right=Math.max(frameBounds.right,b.right);
            frameBounds.top=Math.min(frameBounds.top,b.top);
            frameBounds.bottom=Math.max(frameBounds.bottom,b.bottom);
          }
          frameScale=scale;
        }
      }
    }
    return originalArc.call(this,x,y,r,...rest);
  };

  const flush=()=>{if(frameBounds&&frameScale)finishFrame();};
  window.addEventListener('resize',()=>{current=null;flush();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){current=null;flush();}});
  setInterval(flush,120);
}
