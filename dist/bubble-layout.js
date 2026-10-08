import {BubbleField} from './physics.js';
import {monday,bounds} from './periods.js';
import {shiftDate} from './core.js';
export const MIN_RADIUS=22;
// Convert the rendered canvas to simulation coordinates, including its current transform.
export function scenePoint({clientX,clientY},rect,{width,height,zoom=1,pan=0}){
  const x=(clientX-rect.left)*width/Math.max(1,rect.width),y=(clientY-rect.top)*height/Math.max(1,rect.height);
  const scale=Math.max(.01,zoom);
  return {x:(x-width/2-pan)/scale+width/2,y:(y-height/2)/scale+height/2};
}
// A 44px touch floor plus proportional area: r² = 22² + scale × cents.
// Saturation bounds the largest bubble; every visible bubble retains its touch floor.
export function bubbleRadii(values,{budget,maxRadius=90}={}){
  const max=Math.max(MIN_RADIUS,maxRadius),floor=MIN_RADIUS**2;
  if(!values.length)return [];
  const area=k=>values.reduce((sum,n)=>sum+Math.min(max**2,floor+k*Math.max(0,n)),0);
  let low=0,high=max**2;
  const target=Math.max(floor*values.length,budget||max**2*values.length);
  for(let i=0;i<60;i++){const mid=(low+high)/2;if(area(mid)>target)high=mid;else low=mid}
  return values.map(n=>Math.sqrt(Math.min(max**2,floor+low*Math.max(0,n))));
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
function dayGeometry(items){
  const ordered=[...items].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const key=JSON.stringify(ordered.map(t=>[t.id,t.amountCents]));
  if(dayCache.has(key))return dayCache.get(key);
  const radii=bubbleRadii(ordered.map(t=>t.amountCents),{budget:18000,maxRadius:90});
  const field=new BubbleField(),size=Math.max(CELL,Math.ceil(Math.sqrt(ordered.length)*60));field.resize(size,size);
  field.reconcile(ordered.map((t,i)=>{const a=i*2.3999632297,o=Math.sqrt(i+1)*8;return {id:t.id,tx:size/2+Math.cos(a)*o,ty:size/2+Math.sin(a)*o,targetR:radii[i]}}));
  for(let i=0;i<300;i++)field.step(1/60);
  const geometry=new Map(field.bodies.map(b=>[b.id,{x:b.x-size/2,y:b.y-size/2,r:b.targetR}]));
  if(dayCache.size>120)dayCache.clear();dayCache.set(key,geometry);return geometry;
}
export function periodCamera(groups,{mode='day',date=groups[0]?.start,width=400,height=400}={}){
  const range=bounds(date,mode),start=monday(range.start);
  const days=[];for(let d=range.start;d<=range.end;d=shiftDate(d,1))days.push(d);
  const byDate=new Map(days.map(d=>[d,[]]));for(const g of groups)for(const t of g.items)byDate.get(t.date)?.push(t);
  const geometry=new Map([...byDate].map(([d,items])=>[d,dayGeometry(items)]));
  // The same calendar world is viewed through three camera frames.
  const centers=new Map(days.map(d=>{const index=Math.round((new Date(d+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/86400000);return [d,{x:(index%7)*CELL,y:Math.floor(index/7)*CELL}]}));
  const points=[...centers.values()];
  const edges=days.flatMap(d=>{const c=centers.get(d);return [...geometry.get(d).values()].map(b=>({left:c.x+b.x-b.r,right:c.x+b.x+b.r,top:c.y+b.y-b.r,bottom:c.y+b.y+b.r}))});
  const minX=Math.min(...points.map(p=>p.x-CELL/2),...edges.map(p=>p.left)),maxX=Math.max(...points.map(p=>p.x+CELL/2),...edges.map(p=>p.right)),minY=Math.min(...points.map(p=>p.y-CELL/2),...edges.map(p=>p.top)),maxY=Math.max(...points.map(p=>p.y+CELL/2),...edges.map(p=>p.bottom));
  const scale=Math.min((width-24)/(maxX-minX),(height-40)/(maxY-minY));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const project=p=>({x:width/2+(p.x-cx)*scale,y:height/2+(p.y-cy)*scale});
  return {scale,geometry,centers,project,labels:days.map(d=>{const p=project(centers.get(d));return {id:d,start:d,end:d,items:byDate.get(d),x:p.x,y:p.y,labelY:p.y+CELL*.43*scale,maxR:CELL*.45*scale}})};
}
export function expenseBubbles(groups,color,options){
  const camera=periodCamera(groups,options);
  return groups.flatMap(g=>g.items.map(t=>{
    const local=camera.geometry.get(t.date).get(t.id),center=camera.centers.get(t.date),p=camera.project({x:center.x+local.x,y:center.y+local.y});
    return {id:t.id,tx:p.x,ty:p.y,spawnX:p.x,spawnY:p.y,targetR:local.r*camera.scale,groupId:t.date,transaction:t,color:color(t),layoutLocked:true};
  }));
}
