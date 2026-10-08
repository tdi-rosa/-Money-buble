import {BubbleField,resolveCollisions} from './physics.js';
import {monday,bounds} from './periods.js';
import {shiftDate} from './core.js';
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
export function gestureAction({dx,dy,moved,mode,body,group,cancelled}){
  if(cancelled)return 'none';
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.25)return dx<0?'next':'previous';
  if(moved)return 'none';
  if(mode!=='day'&&group)return 'drill';
  return body?'detail':'none';
}

// Daily geometry is calculated once in world units, independent of the camera.
const dayCache=new Map(),CELL=400;
function dayGeometry(items,areaScale){
  const ordered=[...items].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const key=JSON.stringify([areaScale,ordered.map(t=>[t.id,t.amountCents])]);
  if(dayCache.has(key))return dayCache.get(key);
  const radii=bubbleRadii(ordered.map(t=>t.amountCents),{areaScale});
  const field=new BubbleField(),size=Math.max(CELL,Math.ceil(Math.sqrt(ordered.length)*60));field.resize(size,size);
  field.reconcile(ordered.map((t,i)=>{const a=i*2.3999632297,o=Math.sqrt(i+1)*8;return {id:t.id,tx:size/2+Math.cos(a)*o,ty:size/2+Math.sin(a)*o,targetR:radii[i]}}));
  for(let i=0;i<300;i++)field.step(1/60);
  // Pack final radii exactly before freezing the geometry for every camera view.
  for(const b of field.bodies){b.r=b.targetR;b.collisionGap=4;}
  resolveCollisions(field.bodies,{iterations:512,tolerance:.0001});
  const geometry=new Map(field.bodies.map(b=>[b.id,{x:b.x-size/2,y:b.y-size/2,r:b.targetR}]));
  if(dayCache.size>120)dayCache.clear();dayCache.set(key,geometry);return geometry;
}
export function periodCamera(groups,{mode='day',date=groups[0]?.start,width=400,height=400}={}){
  const range=bounds(date,mode),days=[];
  for(let d=range.start;d<=range.end;d=shiftDate(d,1))days.push(d);
  const byDate=new Map(days.map(d=>[d,[]]));
  for(const g of groups)for(const t of g.items){if(!byDate.has(t.date))byDate.set(t.date,[]);byDate.get(t.date).push(t);}
  // Geometry is stable; framing uses only the selected period, never unrelated history.
  const geometry=new Map([...byDate].map(([d,items])=>[d,dayGeometry(items,1)]));
  const boxes=new Map([...geometry].map(([d,points])=>{
    const all=[...points.values()];
    const left=all.length?Math.min(...all.map(b=>b.x-b.r)):-40,right=all.length?Math.max(...all.map(b=>b.x+b.r)):40;
    const top=all.length?Math.min(...all.map(b=>b.y-b.r)):-40,bottom=all.length?Math.max(...all.map(b=>b.y+b.r)):40;
    return [d,{cx:(left+right)/2,cy:(top+bottom)/2,width:right-left,height:bottom-top}];
  }));
  const columns=mode==='day'?1:7;
  const firstColumn=mode==='month'?(new Date(range.start+'T12:00:00Z').getUTCDay()+6)%7:0;
  const rows=mode==='month'?Math.ceil((firstColumn+days.length)/7):1;
  const pad=mode==='day'?24:8,cellW=(width-pad*2)/columns;
  const availableH=Math.max(100,height-32),cellH=mode==='week'?Math.min(availableH,Math.max(100,cellW*1.6)):availableH/rows;
  const top=mode==='week'?(height-cellH)/2:16;
  const labelSpace=mode==='day'?0:35;
  const largestW=Math.max(1,...days.map(d=>boxes.get(d).width)),largestH=Math.max(1,...days.map(d=>boxes.get(d).height));
  const scale=Math.min((cellW-(mode==='day'?0:10))/largestW,Math.max(10,cellH-labelSpace-(mode==='day'?16:12))/largestH);
  const centers=new Map(),labels=[];
  days.forEach((d,i)=>{
    const n=i+firstColumn,col=n%columns,row=Math.floor(n/columns);
    const x=pad+cellW*(col+.5),y=top+cellH*row+(cellH-labelSpace)/2;
    centers.set(d,{x,y});
    labels.push({id:d,start:d,end:d,inPeriod:true,items:byDate.get(d),x,y,labelY:top+cellH*(row+1)-17,maxR:cellW/2,
      hitRect:{left:pad+cellW*col,top:top+cellH*row,right:pad+cellW*(col+1),bottom:top+cellH*(row+1)}});
  });
  // Other days remain in memory and move beyond the viewport without fading.
  for(const d of byDate.keys())if(!centers.has(d))centers.set(d,{x:d<range.start?-width:width*2,y:height/2});
  return {scale,geometry,centers,boxes,labels,range,width,height};
}
export function expenseBubbles(groups,color,options,camera=periodCamera(groups,options)){
  return groups.flatMap(g=>g.items.map(t=>{
    const local=camera.geometry.get(t.date).get(t.id),center=camera.centers.get(t.date),box=camera.boxes.get(t.date);
    const inPeriod=t.date>=camera.range.start&&t.date<=camera.range.end;
    const targetR=local.r*camera.scale;
    const tx=inPeriod?center.x+(local.x-box.cx)*camera.scale:(t.date<camera.range.start?-targetR-32:camera.width+targetR+32);
    const ty=inPeriod?center.y+(local.y-box.cy)*camera.scale:camera.height/2;
    return {id:t.id,tx,ty,spawnX:tx,spawnY:ty,targetR,groupId:t.date,transaction:t,color:color(t),collisionGap:4*camera.scale,layoutLocked:true,persistent:true,inPeriod};
  }));
}
