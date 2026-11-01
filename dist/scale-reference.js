const REFERENCE_CENTS=2000;
const REFERENCE_VISUAL_FACTOR=.1;
const CANVAS_SHIFT=16;
const stage=document.getElementById('stage');
const canvas=document.getElementById('canvas');

if(stage&&canvas){
  const style=document.createElement('style');
  style.textContent=`
#scaleReference{position:absolute;left:6px;top:0;z-index:3;pointer-events:none;transform-origin:left top;will-change:top,width,height;}
#scaleReference svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;}
#canvas{transform:translateX(${CANVAS_SHIFT}px);}
`;
  document.head.append(style);

  const ref=document.createElement('div');
  ref.id='scaleReference';
  ref.setAttribute('aria-hidden','true');
  ref.innerHTML=`<svg viewBox="0 0 38 118" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Repère humain">
    <path fill="#111" d="M 18 0 L 14 3 L 13 8 L 16 15 L 15 18 L 4 24 L 3 38 L 0 48 L 0 67 L 4 71 L 1 66 L 3 65 L 5 67 L 2 59 L 6 46 L 6 40 L 8 37 L 10 40 L 7 60 L 7 72 L 9 80 L 7 96 L 9 113 L 6 118 L 11 118 L 13 115 L 12 107 L 14 99 L 14 87 L 19 65 L 24 87 L 24 99 L 26 107 L 25 115 L 27 118 L 32 118 L 29 113 L 31 96 L 29 87 L 31 60 L 28 40 L 30 37 L 32 40 L 33 51 L 36 59 L 33 68 L 35 65 L 37 66 L 34 71 L 38 67 L 38 48 L 35 38 L 34 24 L 23 18 L 22 15 L 25 10 L 24 3 Z"/>
  </svg>`;
  stage.append(ref);

  let frameBounds=null;
  let frameScale=0;
  let renderQueued=false;
  let smoothBottom=null;

  function queueRender(){
    if(renderQueued)return;
    renderQueued=true;
    queueMicrotask(()=>{
      renderQueued=false;
      renderReference();
    });
  }

  function renderReference(){
    if(!frameBounds||!frameScale){
      ref.hidden=true;
      return;
    }
    ref.hidden=false;

    const personHeight=2*Math.sqrt(REFERENCE_CENTS)*frameScale*REFERENCE_VISUAL_FACTOR;
    const personWidth=personHeight*(38/118);
    const targetBottom=frameBounds.bottom;
    smoothBottom=smoothBottom===null?targetBottom:smoothBottom+(targetBottom-smoothBottom)*.32;
    const top=smoothBottom-personHeight;

    ref.style.width=`${Math.max(2,personWidth)}px`;
    ref.style.height=`${Math.max(6,personHeight)}px`;
    ref.style.top=`${top}px`;
  }

  const proto=CanvasRenderingContext2D.prototype;
  const originalClearRect=proto.clearRect;
  const originalArc=proto.arc;

  proto.clearRect=function(...args){
    if(this.canvas===canvas){
      frameBounds=null;
      frameScale=0;
      queueRender();
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
        const b={left:sx-sr,right:sx+sr,top:sy-sr,bottom:sy+sr};
        if(!frameBounds)frameBounds=b;
        else{
          frameBounds.left=Math.min(frameBounds.left,b.left);
          frameBounds.right=Math.max(frameBounds.right,b.right);
          frameBounds.top=Math.min(frameBounds.top,b.top);
          frameBounds.bottom=Math.max(frameBounds.bottom,b.bottom);
        }
        frameScale=scale;
        queueRender();
      }
    }
    return originalArc.call(this,x,y,r,...rest);
  };

  window.addEventListener('resize',()=>{smoothBottom=null;queueRender()});
}
