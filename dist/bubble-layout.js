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
  if(body)return 'detail';
  return mode!=='day'&&group?'drill':'none';
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
  const range=bounds(date,mode);
  const days=[];for(let d=range.start;d<=range.end;d=shiftDate(d,1))days.push(d);
  const byDate=new Map(days.map(d=>[d,[]]));
  for(const g of groups)for(const t of g.items){if(!byDate.has(t.date))byDate.set(t.date,[]);byDate.get(t.date).push(t);}
  // One area scale across the entire history, never normalised separately per day.
  const maxTotal=Math.max(1,...[...byDate.values()].map(list=>list.reduce((n,t)=>n+t.amountCents,0)));
  const largest=Math.max(1,...[...byDate.values()].flatMap(list=>list.map(t=>t.amountCents)));
  const areaScale=Math.min(18000/maxTotal,120**2/largest);
  const geometry=new Map([...byDate].map(([d,items])=>[d,dayGeometry(items,areaScale)]));
  // Stable Monday–Sunday calendar coordinates. Only the camera frame changes.
  const centers=new Map([...byDate.keys()].map(d=>{
    const index=Math.round((new Date(d+'T12:00:00Z')-new Date('1970-01-05T12:00:00Z'))/86400000);
    return [d,{x:((index%7)+7)%7*CELL,y:Math.floor(index/7)*CELL}];
  }));
  const points=days.map(d=>centers.get(d));
  const edges=days.flatMap(d=>{const c=centers.get(d);return [...geometry.get(d).values()].map(b=>({left:c.x+b.x-b.r,right:c.x+b.x+b.r,top:c.y+b.y-b.r,bottom:c.y+b.y+b.r}))});
  const minX=Math.min(...points.map(p=>p.x-CELL/2),...edges.map(p=>p.left)),maxX=Math.max(...points.map(p=>p.x+CELL/2),...edges.map(p=>p.right)),minY=Math.min(...points.map(p=>p.y-CELL/2),...edges.map(p=>p.top)),maxY=Math.max(...points.map(p=>p.y+CELL/2),...edges.map(p=>p.bottom));
  const scale=Math.min((width-24)/(maxX-minX),(height-40)/(maxY-minY))*(mode==='month'?.82:1);
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const project=p=>({x:width/2+(p.x-cx)*scale,y:height/2+(p.y-cy)*scale});
  return {scale,geometry,centers,project,labels:days.map(d=>{const p=project(centers.get(d));return {id:d,start:d,end:d,items:byDate.get(d),x:p.x,y:p.y,labelY:p.y+CELL*.43*scale,maxR:CELL*.45*scale}})};
}
export function expenseBubbles(groups,color,options,camera=periodCamera(groups,options)){
  return groups.flatMap(g=>g.items.map(t=>{
    const local=camera.geometry.get(t.date).get(t.id),center=camera.centers.get(t.date),p=camera.project({x:center.x+local.x,y:center.y+local.y});
    return {id:t.id,tx:p.x,ty:p.y,spawnX:p.x,spawnY:p.y,targetR:local.r*camera.scale,groupId:t.date,transaction:t,color:color(t),collisionGap:4*camera.scale,layoutLocked:true,persistent:true};
  }));
}
