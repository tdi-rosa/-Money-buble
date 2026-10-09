import {bounds} from './periods.js';

export class CloudHistory {
  constructor(){this.clouds=new Map();}
  key(mode,date){return mode+':'+bounds(date,mode).start;}
  clear(){this.clouds.clear();}
  save(mode,date,bodies){
    this.clouds.set(this.key(mode,date),new Map(bodies.filter(b=>b.inPeriod!==false).map(b=>[b.id,{x:b.x,y:b.y,vx:b.vx||0,vy:b.vy||0,arriving:b.arriving===true}])));
  }
  restore(mode,date,specs){
    const saved=this.clouds.get(this.key(mode,date));
    return specs.map(s=>({...s,...saved?.get(s.id),x:saved?.get(s.id)?.x??s.tx,y:saved?.get(s.id)?.y??s.ty,r:s.targetR,alpha:1,vx:saved?.get(s.id)?.vx??0,vy:saved?.get(s.id)?.vy??0,arriving:saved?.get(s.id)?.arriving??false}));
  }
}
export function cloudCenter(bodies,width,height){
  if(!bodies.length)return {x:width/2,y:height/2};
  let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(const p of bodies){l=Math.min(l,p.x-p.r);r=Math.max(r,p.x+p.r);t=Math.min(t,p.y-p.r);b=Math.max(b,p.y+p.r);}
  return {x:(l+r)/2,y:(t+b)/2};
}
export function fitCloud(bodies,width,height,fallback=1){
  if(!bodies.length)return fallback;
  const center=cloudCenter(bodies,width,height);
  let rx=0,ry=0;
  for(const b of bodies){rx=Math.max(rx,Math.abs(b.x-center.x)+b.r);ry=Math.max(ry,Math.abs(b.y-center.y)+b.r);}
  return Math.min(6,Math.max(1,width-40)/(rx*2+12),Math.max(1,height-48)/(ry*2+12));
}
// Camera-only robust footprint: distant arrivals have bounded influence until
// they reach the cloud. Physical positions and monetary radii stay untouched.
export function gatheringCloudBounds(bodies,width,height){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const b of bodies){
    if(b.inPeriod===false)continue;
    let x=b.x,y=b.y;
    if(Number.isFinite(b.gatherRadius)&&b.gatherRadius>0){
      const cx=b.centerX??width/2,cy=b.centerY??height/2;
      const dx=x-cx,dy=y-cy,distance=Math.hypot(dx,dy);
      const reach=Math.max(0,b.gatherRadius-b.r);
      if(distance>reach){const ratio=reach/distance;x=cx+dx*ratio;y=cy+dy*ratio;}
    }
    left=Math.min(left,x-b.r);right=Math.max(right,x+b.r);
    top=Math.min(top,y-b.r);bottom=Math.max(bottom,y+b.r);
  }
  return Number.isFinite(left)?{left,right,top,bottom}:null;
}
export function swipeCropScale(from,to,progress){
  const p=Math.min(1,Math.max(0,progress)),t=p*p*(3-2*p);
  // Interpolate the visible world extent. Both clouds use this single scale.
  return 1/((1-t)/from+t/to);
}
export const DOT_GRID_STEP=8;
export function dotGridView({width,height,x,y,scale,panX=0,panY=0,anchorX=0,anchorY=0}){
  const spacing=DOT_GRID_STEP*scale,t=Math.max(0,Math.min(1,(spacing-4)/8));
  return {spacing,x:width/2+(anchorX-x)*scale+panX,y:height/2+(anchorY-y)*scale+panY,opacity:.65*t*t*(3-2*t)};
}
export function rebaseDotGrid(anchor,dx,dy){
  // Keep the same lattice when navigation normalizes the physical world.
  const phase=v=>((v%DOT_GRID_STEP)+DOT_GRID_STEP)%DOT_GRID_STEP;
  return {x:phase(anchor.x+dx),y:phase(anchor.y+dy)};
}
export function projectCloud(bodies,{scale,width,height,centerX=width/2,centerY=height/2,panX=0,panY=0}){
  return bodies.map(b=>({...b,x:width/2+(b.x-centerX)*scale+panX,y:height/2+(b.y-centerY)*scale+panY,r:b.r*scale}));
}
export function rescaleScreenCloud(bodies,fromScale,toScale,width,height){
  const ratio=toScale/fromScale;
  return bodies.map(b=>({...b,x:width/2+(b.x-width/2)*ratio,y:height/2+(b.y-height/2)*ratio,r:b.r*ratio}));
}
