import {cloudCenter,fitCloud,swipeCropScale} from './cloud-navigation.js';

const axes=[['x','y'],['tx','ty'],['centerX','centerY'],['motionX','motionY']];
export function translateBody(body,dx,dy){
  const next={...body};
  for(const [x,y] of axes){if(Number.isFinite(next[x]))next[x]+=dx;if(Number.isFinite(next[y]))next[y]+=dy;}
  return next;
}
// Both periods inhabit one world and one collision field. Navigation moves only
// the camera; a bubble's monetary radius is never changed by the transition.
export class PeriodTravel {
  constructor(source,target,{width,height,direction,fromCamera}){
    this.width=width;this.height=height;this.direction=direction;this.fromCamera={...fromCamera};this.progress=0;
    this.source=source.map(b=>({...b,departing:false,departureView:null}));
    const center=cloudCenter(target,width,height),toScale=fitCloud(target,width,height,fromCamera.scale);
    const rx=list=>list.reduce((r,b)=>Math.max(r,Math.abs(b.x-(list===target?center.x:fromCamera.x))+b.r),0);
    const minScale=Math.max(.000001,Math.min(fromCamera.scale,toScale));
    // Physical extents, not independently cropped screenshots, determine spacing.
    // At both endpoints the neighbouring cloud is already outside the viewport.
    this.distance=Math.max(width/minScale,rx(this.source)+rx(target)+40/minScale);
    this.shiftX=fromCamera.x+direction*this.distance-center.x;this.shiftY=fromCamera.y-center.y;
    this.target=target.map((b,i)=>translateBody({...b,inPeriod:true,departing:false,departureView:null,cluster:true,arriving:false,phase:b.phase??i*2.3999632297,travelSpeed:450},this.shiftX,this.shiftY));
    this.bodies=[...this.source,...this.target];
  }
  camera(progress=this.progress){
    this.progress=Math.max(0,Math.min(1,progress));
    const p=this.progress,target=cloudCenter(this.target,this.width,this.height);
    if(!this.target.length){target.x=this.fromCamera.x+this.direction*this.distance;target.y=this.fromCamera.y;}
    const x=this.fromCamera.x+(target.x-this.fromCamera.x)*p,y=this.fromCamera.y+(target.y-this.fromCamera.y)*p;
    const base=swipeCropScale(this.fromCamera.scale,fitCloud(this.target,this.width,this.height,this.fromCamera.scale),p);
    // Reveal the common world between endpoints, so the camera never crosses an
    // empty gap while an oversized neighbour waits just outside the viewport.
    let rx=0,ry=0;
    for(const b of this.bodies){rx=Math.max(rx,Math.abs(b.x-x)+b.r);ry=Math.max(ry,Math.abs(b.y-y)+b.r);}
    const overview=Math.min(6,Math.max(1,this.width-40)/(rx*2+12),Math.max(1,this.height-48)/(ry*2+12)),blend=p===0||p===1?0:Math.sin(Math.PI*p)**2;
    const scale=1/((1-blend)/base+blend/overview);
    return {x,y,scale};
  }
  normalizedTarget(){return this.target.map(b=>translateBody(b,-this.shiftX,-this.shiftY));}
  finish(toTarget,camera){
    if(!toTarget){
      const trails=this.target.filter(b=>Math.abs(b.x-camera.x)*camera.scale<this.width/2+b.r*camera.scale&&Math.abs(b.y-camera.y)*camera.scale<this.height/2+b.r*camera.scale).map(b=>({...b,inPeriod:false,cluster:false,departing:true,departureView:null,motionX:b.x+this.direction*this.distance,motionY:b.y,travelSpeed:450}));
      return {bodies:[...this.source,...trails],camera};
    }
    // Translating the whole world and camera together preserves the last frame.
    const bodies=this.normalizedTarget(),view={x:camera.x-this.shiftX,y:camera.y-this.shiftY,scale:camera.scale};
    const trails=this.source.map(b=>translateBody(b,-this.shiftX,-this.shiftY)).filter(b=>
      Math.abs(b.x-view.x)*view.scale<this.width/2+b.r*view.scale&&Math.abs(b.y-view.y)*view.scale<this.height/2+b.r*view.scale);
    for(const b of trails){b.inPeriod=false;b.cluster=false;b.departing=true;b.departureView=null;b.motionX=b.x-this.direction*this.distance;b.motionY=b.y;b.travelSpeed=450;}
    return {bodies:[...bodies,...trails],camera:view};
  }
}
