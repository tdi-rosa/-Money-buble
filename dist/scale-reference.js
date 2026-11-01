import {getCatalog} from './cluster-tree.js';
import {dateKey,shiftDate,demoData,validateImport,displayPurchaseDates,validDate} from './core.js';

const REFERENCE_CENTS=2000;
const GAP=10;
const stage=document.getElementById('stage');
const canvas=document.getElementById('canvas');
const bankKey='money-bubble-bank-display-v1';
const localKey='bulles-transactions-v1';

function read(key,fallback=null){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function buildDemo(){const today=dateKey(),list=[];for(let i=-44;i<=0;i++){const day=shiftDate(today,i);if(i!==0&&Math.abs(i)%8===0)continue;for(const t of demoData(day).filter(t=>t.date===day)){if(i!==0&&t.id.endsWith('-4')&&Math.abs(i)%3!==0)continue;list.push({...t,amountCents:t.amountCents+Math.abs(i)%5*35});}}return list}
function transactions(){const bank=read(bankKey);if(Array.isArray(bank?.transactions))return bank.transactions;const stored=read(localKey);try{if(stored)return validateImport(stored)}catch{}return buildDemo()}

if(stage&&canvas){
  const style=document.createElement('style');
  style.textContent=`
#scaleReference{position:absolute;left:0;top:0;z-index:3;pointer-events:none;transform-origin:left top;will-change:left,top,width,height;}
#scaleReference svg{display:block;width:100%;height:100%;overflow:visible;shape-rendering:geometricPrecision;}
#canvas{will-change:transform;}
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
  let liveCameraScale=0;
  let baseMonetaryScale=1;
  let renderQueued=false;
  let smoothedBottom=null;

  function refreshBaseScale(){
    try{
      const items=displayPurchaseDates(transactions()).filter(t=>validDate(t.date));
      if(!items.length){baseMonetaryScale=1;return;}
      const r=stage.getBoundingClientRect();
      baseMonetaryScale=getCatalog(items).camera({mode:'day',date:items[0].date,width:r.width,height:r.height}).scale;
    }catch{baseMonetaryScale=1;}
  }

  function queueRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(()=>{
      renderQueued=false;
      renderReference();
    });
  }

  function renderReference(){
    if(!frameBounds||!liveCameraScale){
      ref.hidden=true;
      canvas.style.transform='';
      return;
    }
    ref.hidden=false;

    // targetR already includes ClusterCatalog.camera().scale. The canvas
    // transform only contains the live zoom/fitZoom. Multiplying both makes
    // this exactly the rendered diameter of a 20 € bubble.
    const personHeight=2*Math.sqrt(REFERENCE_CENTS)*baseMonetaryScale*liveCameraScale;
    const personWidth=personHeight*(38/118);

    // Keep centering stable: never derive the canvas translation from the
    // animated cloud bounds. The only changing part is the monetary scale.
    // This prevents the feedback/jitter that happened during swipes.
    const shift=(personWidth+GAP)/2;
    canvas.style.transform=`translateX(${shift}px)`;

    const targetBottom=frameBounds.bottom;
    smoothedBottom=smoothedBottom===null?targetBottom:smoothedBottom+(targetBottom-smoothedBottom)*.45;
    const cloudLeft=frameBounds.left+shift;
    ref.style.left=`${cloudLeft-GAP-personWidth}px`;
    ref.style.top=`${smoothedBottom-personHeight}px`;
    ref.style.width=`${personWidth}px`;
    ref.style.height=`${personHeight}px`;
  }

  const proto=CanvasRenderingContext2D.prototype;
  const originalClearRect=proto.clearRect;
  const originalArc=proto.arc;

  proto.clearRect=function(...args){
    if(this.canvas===canvas){
      frameBounds=null;
      liveCameraScale=0;
    }
    return originalClearRect.apply(this,args);
  };

  proto.arc=function(x,y,r,...rest){
    if(this.canvas===canvas){
      const m=this.getTransform();
      const pixelRatio=canvas.width/Math.max(1,canvas.clientWidth);
      const scale=Math.hypot(m.a,m.b)/Math.max(.0001,pixelRatio);
      if(Number.isFinite(scale)&&scale>0){
        const sx=(m.a*x+m.c*y+m.e)/pixelRatio;
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
        liveCameraScale=scale;
      }
    }
    const result=originalArc.call(this,x,y,r,...rest);
    if(this.canvas===canvas)queueRender();
    return result;
  };

  refreshBaseScale();
  new ResizeObserver(()=>{smoothedBottom=null;refreshBaseScale();queueRender()}).observe(stage);
  window.addEventListener('storage',()=>{refreshBaseScale();queueRender()});
}
