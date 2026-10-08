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

// Pack only the active period. No simulation of the entire bank history and no
// hundreds of physics steps before the worker can answer a gesture.
const clusterCache=new Map();
export function packCluster(items){
  const ordered=[...items].sort((a,b)=>b.amountCents-a.amountCents||String(a.id).localeCompare(String(b.id)));
  const key=JSON.stringify(ordered.map(t=>[t.id,t.amountCents]));
  if(clusterCache.has(key))return clusterCache.get(key);
  const radii=bubbleRadii(ordered.map(t=>t.amountCents),{areaScale:1});
  const placed=[],points=new Map();
  for(let i=0;i<ordered.length;i++){
    const r=radii[i],phase=i*2.3999632297;let best={x:0,y:0,distance:Infinity};
    // Along each ray, merge the intervals blocked by existing circles. This
    // finds the nearest free point without a slow pixel-by-pixel spiral search.
    for(let ray=0;ray<32;ray++){
      const angle=phase+ray*Math.PI/16,c=Math.cos(angle),s=Math.sin(angle),intervals=[];
      for(const b of placed){const projection=b.x*c+b.y*s,perpendicular=b.x*b.x+b.y*b.y-projection*projection,gap=r+b.r+4;
        if(perpendicular>=gap*gap)continue;
        const half=Math.sqrt(Math.max(0,gap*gap-perpendicular)),end=projection+half;
        if(end>=0)intervals.push([Math.max(0,projection-half),end]);
      }
      intervals.sort((a,b)=>a[0]-b[0]);let distance=0;
      for(const [start,end] of intervals){if(start>distance)break;distance=Math.max(distance,end+.0001);}
      if(distance<best.distance)best={x:c*distance,y:s*distance,distance};
    }
    const b={x:best.x,y:best.y,r};points.set(ordered[i].id,b);placed.push(b);
  }
  if(clusterCache.size>=36)clusterCache.delete(clusterCache.keys().next().value);
  clusterCache.set(key,points);return points;
}
export function periodCamera(groups,{mode='day',date=groups[0]?.start,width=400,height=400}={}){
  const range=bounds(date,mode),items=groups.flatMap(g=>g.items).filter(t=>t.date>=range.start&&t.date<=range.end);
  const geometry=packCluster(items),all=[...geometry.values()];
  const left=all.length?Math.min(...all.map(b=>b.x-b.r)):-40,right=all.length?Math.max(...all.map(b=>b.x+b.r)):40;
  const top=all.length?Math.min(...all.map(b=>b.y-b.r)):-40,bottom=all.length?Math.max(...all.map(b=>b.y+b.r)):40;
  const box={cx:(left+right)/2,cy:(top+bottom)/2,width:right-left,height:bottom-top};
  const scale=Math.min(Math.max(1,width-40)/Math.max(1,box.width),Math.max(1,height-48)/Math.max(1,box.height));
  return {scale,geometry,box,labels:[],range,width,height};
}
export function expenseBubbles(groups,color,options,camera=periodCamera(groups,options)){
  return groups.flatMap(g=>g.items.map(t=>{
    const inPeriod=t.date>=camera.range.start&&t.date<=camera.range.end;
    const local=camera.geometry.get(t.id),targetR=Math.sqrt(Math.max(0,t.amountCents))*camera.scale;
    const tx=inPeriod?camera.width/2+(local.x-camera.box.cx)*camera.scale:(t.date<camera.range.start?-targetR-40:camera.width+targetR+40);
    const ty=inPeriod?camera.height/2+(local.y-camera.box.cy)*camera.scale:camera.height/2;
    return {id:t.id,tx,ty,spawnX:tx,spawnY:ty,targetR,groupId:t.date,transaction:t,color:color(t),collisionGap:4*camera.scale,layoutLocked:true,persistent:true,inPeriod};
  }));
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
