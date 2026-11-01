const REFERENCE_CENTS=2000;
const CANVAS_SHIFT=16;
const stage=document.getElementById('stage');
const canvas=document.getElementById('canvas');

if(stage&&canvas){
  const style=document.createElement('style');
  style.textContent=`
#scaleReference{position:absolute;left:0;top:0;z-index:3;pointer-events:none;transform-origin:left top;will-change:left,top,width,height;}
#scaleReference img{display:block;width:100%;height:100%;object-fit:contain;}
#scaleReference .scale-ref-label{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:3px;font:500 10px/1 system-ui,sans-serif;white-space:nowrap;color:#8a8e98;}
#canvas{transform:translateX(${CANVAS_SHIFT}px);}
`;
  document.head.append(style);

  const ref=document.createElement('div');
  ref.id='scaleReference';
  ref.setAttribute('aria-hidden','true');
  ref.innerHTML=`<img alt="" src="data:image/png;base64,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"><span class="scale-ref-label">20 €</span>`;
  stage.append(ref);

  let frameBounds=null;
  let frameScale=0;
  let renderQueued=false;

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

    const personHeight=2*Math.sqrt(REFERENCE_CENTS)*frameScale;
    const personWidth=personHeight*(41/120);
    const stageWidth=stage.clientWidth;
    const bottom=frameBounds.bottom;
    const top=bottom-personHeight;
    const preferredLeft=frameBounds.left-personWidth-10;
    const left=Math.max(5,Math.min(preferredLeft,Math.max(5,stageWidth-personWidth-5)));

    ref.style.left=`${left}px`;
    ref.style.top=`${top}px`;
    ref.style.width=`${personWidth}px`;
    ref.style.height=`${personHeight}px`;
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

  window.addEventListener('resize',queueRender);
}
