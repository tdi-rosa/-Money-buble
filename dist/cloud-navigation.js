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
    return specs.map(s=>({...s,...saved?.get(s.id),x:saved?.get(s.id)?.x??s.tx,y:saved?.get(s.id)?.y??s.ty,r:s.targetR,alpha:1}));
  }
}
export function cloudCenter(bodies,width,height){
  if(!bodies.length)return {x:width/2,y:height/2};
  let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for(const p of bodies){l=Math.min(l,p.x-p.r);r=Math.max(r,p.x+p.r);t=Math.min(t,p.y-p.r);b=Math.max(b,p.y+p.r);}
  return {x:(l+r)/2,y:(t+b)/2};
}
export function projectCloud(bodies,{scale,width,height,centerX=width/2,centerY=height/2,panX=0,panY=0}){
  return bodies.map(b=>({...b,x:width/2+(b.x-centerX)*scale+panX,y:height/2+(b.y-centerY)*scale+panY,r:b.r*scale}));
}
export function rescaleScreenCloud(bodies,fromScale,toScale,width,height){
  const ratio=toScale/fromScale;
  return bodies.map(b=>({...b,x:width/2+(b.x-width/2)*ratio,y:height/2+(b.y-height/2)*ratio,r:b.r*ratio}));
}
