import {getCatalog} from './cluster-tree.js';
import {dateKey,shiftDate,demoData,validateImport,displayPurchaseDates,validDate} from './core.js';

const REFERENCE_CENTS=2000;
const stage=document.getElementById('stage');
const canvas=document.getElementById('canvas');
const datePicker=document.getElementById('datePicker');
const bankKey='money-bubble-bank-display-v1';
const localKey='bulles-transactions-v1';

function read(key,fallback=null){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function buildDemo(){const today=dateKey(),list=[];for(let i=-44;i<=0;i++){const day=shiftDate(today,i);if(i!==0&&Math.abs(i)%8===0)continue;for(const t of demoData(day).filter(t=>t.date===day)){if(i!==0&&t.id.endsWith('-4')&&Math.abs(i)%3!==0)continue;list.push({...t,amountCents:t.amountCents+Math.abs(i)%5*35});}}return list}
function transactions(){const bank=read(bankKey);if(Array.isArray(bank?.transactions))return bank.transactions;const stored=read(localKey);try{if(stored)return validateImport(stored)}catch{}return buildDemo()}
function currentMode(){return document.querySelector('[data-mode][aria-pressed="true"]')?.dataset.mode||'day'}

const style=document.createElement('style');
style.textContent=`
#scaleReference{position:absolute;left:8px;top:0;z-index:3;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;color:#777b86;opacity:.9;transition:top .28s ease,height .28s ease,width .28s ease}
#scaleReference svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 1px 1px rgba(0,0,0,.08))}
#scaleReference .scale-ref-label{position:absolute;top:100%;margin-top:3px;font:500 10px/1 system-ui,sans-serif;white-space:nowrap;color:#8a8e98}
#canvas{transition:transform .28s ease;will-change:transform}
body.reduce-motion #scaleReference,#canvas{transition:none}
`;
document.head.append(style);

const ref=document.createElement('div');
ref.id='scaleReference';
ref.setAttribute('aria-hidden','true');
ref.innerHTML=`<svg viewBox="0 0 100 280" role="img" aria-label="Repère humain équivalent à 20 euros">
  <g fill="currentColor">
    <ellipse cx="50" cy="25" rx="17" ry="21"/>
    <path d="M35 49 C29 61 27 79 29 101 L31 142 C32 157 28 174 24 195 L17 257 C16 268 21 276 29 276 C36 276 40 270 41 260 L47 196 L50 162 L53 196 L59 260 C60 270 64 276 71 276 C79 276 84 268 83 257 L76 195 C72 174 68 157 69 142 L71 101 C73 79 71 61 65 49 C61 45 56 43 50 43 C44 43 39 45 35 49 Z"/>
    <path d="M31 61 C21 68 16 84 13 105 L5 167 C4 177 8 183 14 184 C21 185 25 180 27 171 L35 111 L39 78 Z"/>
    <path d="M69 61 C79 68 84 84 87 105 L95 167 C96 177 92 183 86 184 C79 185 75 180 73 171 L65 111 L61 78 Z"/>
  </g>
</svg><span class="scale-ref-label">20 €</span>`;
stage.append(ref);

let last='';
function update(){
  if(!stage||!canvas||!datePicker)return;
  const r=stage.getBoundingClientRect(),width=r.width,height=r.height,date=datePicker.value||dateKey(),mode=currentMode();
  const items=displayPurchaseDates(transactions()).filter(t=>validDate(t.date));
  const signature=[mode,date,Math.round(width),Math.round(height),items.length,items.at(-1)?.id||''].join('|');
  if(signature===last)return;last=signature;
  if(!items.length){ref.hidden=true;canvas.style.transform='';return}
  ref.hidden=false;
  try{
    const camera=getCatalog(items).camera({mode,date,width,height}),root=camera.root;
    if(!root.items.length){ref.hidden=true;canvas.style.transform='';return}
    const screenScale=camera.scale*camera.fitZoom;
    const personHeight=Math.max(12,2*Math.sqrt(REFERENCE_CENTS)*screenScale);
    let bottom=-Infinity,left=Infinity;
    for(const p of root.points.values()){
      bottom=Math.max(bottom,p.y+p.r);
      left=Math.min(left,p.x-p.r);
    }
    const bottomY=height/2+bottom*screenScale;
    const leftX=width/2+left*screenScale;
    const personWidth=Math.max(5,personHeight*(100/280));
    const desiredLeft=Math.max(6,Math.min(leftX-personWidth-10,width*.14));
    ref.style.left=desiredLeft+'px';
    ref.style.width=personWidth+'px';
    ref.style.height=personHeight+'px';
    ref.style.top=Math.max(4,Math.min(height-personHeight-16,bottomY-personHeight))+'px';
    const shift=Math.max(8,Math.min(22,personWidth*.35+8));
    canvas.style.transform=`translateX(${shift}px)`;
  }catch{ref.hidden=true;canvas.style.transform=''}
}

new ResizeObserver(()=>{last='';update()}).observe(stage);
for(const b of document.querySelectorAll('[data-mode],#previous,#next,#backToday'))b.addEventListener('click',()=>{last='';requestAnimationFrame(()=>requestAnimationFrame(update))});
datePicker.addEventListener('change',()=>{last='';requestAnimationFrame(update)});
window.addEventListener('storage',()=>{last='';update()});
setInterval(()=>{last='';update()},500);
update();
