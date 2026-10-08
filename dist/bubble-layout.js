import {getCatalog} from './cluster-tree.js';
import {bounds} from './periods.js';
export const MIN_RADIUS=22;
// Convert the rendered canvas to simulation coordinates, including its current transform.
export function scenePoint({clientX,clientY},rect,{width,height,zoom=1,pan=0,panY=0}){
  const x=(clientX-rect.left)*width/Math.max(1,rect.width),y=(clientY-rect.top)*height/Math.max(1,rect.height);
  const scale=Math.max(.01,zoom);
  return {x:(x-width/2-pan)/scale+width/2,y:(y-height/2-panY)/scale+height/2};
}
// Visual area is exactly proportional; the invisible touch target is handled separately.
export function bubbleRadii(values,{budget=18000,maxRadius=120,areaScale}={}){
  const total=values.reduce((n,v)=>n+Math.max(0,v),0),largest=Math.max(0,...values);
  const k=areaScale??Math.min(total?budget/total:0,largest?maxRadius**2/largest:0);
  return values.map(v=>Math.sqrt(Math.max(0,v)*k));
}
export function gestureAction({dx,dy,moved,mode,body,group,cancelled,duration=Infinity,velocity=0}){
  if(cancelled)return 'none';
  if((Math.abs(dx)>36||(Math.abs(dx)>18&&(Math.abs(dx)/Math.max(1,duration)>.35||Math.sign(velocity)===Math.sign(dx)&&Math.abs(velocity)>.35)))&&Math.abs(dx)>Math.abs(dy)*1.2)return dx<0?'next':'previous';
  if(moved)return 'none';
    return body?'detail':'none';
}

export {packCluster} from './circle-pack.js';
export function periodCamera(groups,options={}){
  const catalog=getCatalog(groups.flatMap(g=>g.items));
  return catalog.camera(options);
}
export function expenseBubbles(groups,color,options,camera=periodCamera(groups,options)){
  const active=new Map(camera.catalog.layout({...options,...camera.options}).specs.map(b=>[b.id,b]));
  return groups.flatMap(g=>g.items.map(t=>active.get(t.id)||{id:t.id,tx:t.date<camera.range.start?-Math.sqrt(t.amountCents)*camera.scale-40:camera.width+Math.sqrt(t.amountCents)*camera.scale+40,ty:camera.height/2,targetR:Math.sqrt(t.amountCents)*camera.scale,transaction:t,groupId:t.date,persistent:true,inPeriod:false,layoutLocked:true})).map(b=>({...b,color:color(b.transaction)}));
}

// Hit-test the exact bitmap-space circles captured while painting, independent of
// layout reflow, scroll position, device pixel ratio or camera interpolation.
export function hitRenderedBubbles(regions,event,rect,bitmap){
  if(!rect.width||!rect.height)return;
  const x=(event.clientX-rect.left)*bitmap.width/rect.width;
  const y=(event.clientY-rect.top)*bitmap.height/rect.height;
  const distance=b=>Math.hypot(x-b.x,y-b.y);
  const visible=[...regions].reverse();
  return visible.find(b=>distance(b)<=b.r)?.body||visible.filter(b=>distance(b)<=Math.max(b.r,22*bitmap.width/rect.width)).sort((a,b)=>distance(a)-distance(b))[0]?.body;
}

// Rebase the pinch distance at each boundary so fingers can reverse continuously.
export function pinchMode(mode,scale){
  const modes=['day','week','month'],i=modes.indexOf(mode);
  return modes[Math.max(0,Math.min(2,scale<.78?i+1:scale>1.26?i-1:i))];
}
