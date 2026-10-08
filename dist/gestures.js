import {gestureAction} from './bubble-layout.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// One input session survives animations, direction changes and finger handoffs.
// Coordinates are CSS pixels; the render loop consumes the latest result once.
export class GestureSession {
  constructor(){this.contacts=new Map();this.pointer=null;this.pinch=null;}
  reset(){this.contacts.clear();this.pointer=this.pinch=null;}
  down(id,p,time,view,body=null){
    this.contacts.set(id,p);
    if(this.contacts.size===2){const [a,b]=[...this.contacts.values()],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      this.pointer=null;this.pinch={distance:Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),zoom:view.zoom,
        anchor:{x:(center.x-view.width/2-view.pan)/view.zoom+view.width/2,y:(center.y-view.height/2-view.panY)/view.zoom+view.height/2}};
      return {type:'pinchstart'};
    }
    if(this.contacts.size!==1)return;
    this.pointer={id,startX:p.x,startY:p.y,x:p.x,y:p.y,body,moved:false,axis:null,started:time,samples:[{...p,time}],startPan:view.pan,startPanY:view.panY,exploring:Math.abs(view.zoom-1)>.04};
  }
  move(id,p,time,view){
    if(!this.contacts.has(id))return;this.contacts.set(id,p);
    if(this.pinch){if(this.contacts.size!==2)return;const [a,b]=[...this.contacts.values()],distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const desired=this.pinch.zoom*distance/this.pinch.distance,zoom=clamp(desired,.6,6),anchor=this.pinch.anchor;
      if(desired!==zoom){this.pinch.zoom=zoom;this.pinch.distance=distance;}
      return {type:'pinch',zoom,pan:center.x-view.width/2-(anchor.x-view.width/2)*zoom,panY:center.y-view.height/2-(anchor.y-view.height/2)*zoom};
    }
    const g=this.pointer;if(!g||g.id!==id)return;
    const previous=g.samples[g.samples.length-1];if(time-previous.time>100)g.samples.push({x:g.x,y:g.y,time:time-50});g.x=p.x;g.y=p.y;g.samples.push({...p,time});while(g.samples.length>1&&g.samples[0].time<time-90)g.samples.shift();
    const dx=p.x-g.startX,dy=p.y-g.startY;
    if(!g.moved&&Math.hypot(dx,dy)>6){g.moved=true;g.axis=g.exploring?'free':Math.abs(dx)>Math.abs(dy)*1.1?'horizontal':'vertical';}
    if(!g.moved)return;
    if(g.axis==='free')return {type:'pan',pan:g.startPan+dx,panY:g.startPanY+dy};
    if(g.axis==='horizontal')return {type:'swipe',dx};
  }
  up(id,p,time,view,cancelled=false){
    if(!this.contacts.has(id))return;if(!this.pinch)this.move(id,p,time,view);else this.contacts.set(id,p);this.contacts.delete(id);
    if(this.pinch){this.pinch=null;
      if(this.contacts.size===2){const [a,b]=[...this.contacts.values()],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};this.pinch={distance:Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),zoom:view.zoom,anchor:{x:(center.x-view.width/2-view.pan)/view.zoom+view.width/2,y:(center.y-view.height/2-view.panY)/view.zoom+view.height/2}};}
      if(this.contacts.size===1){const [remainingId,point]=[...this.contacts][0];this.pointer={id:remainingId,startX:point.x,startY:point.y,x:point.x,y:point.y,body:null,moved:true,axis:'free',started:time,samples:[{...point,time}],startPan:view.pan,startPanY:view.panY,exploring:true};}
      return {type:'pinchend'};
    }
    const g=this.pointer;if(!g||g.id!==id)return;this.pointer=null;
    const first=g.samples[0],velocity=(p.x-first.x)/Math.max(1,time-first.time);
    const action=g.axis==='free'||g.axis==='vertical'?'none':gestureAction({dx:p.x-g.startX,dy:p.y-g.startY,moved:g.moved,mode:view.mode,body:g.body,cancelled,duration:time-g.started,velocity});
    return {type:action==='next'||action==='previous'?'navigate':action==='detail'?'tap':'end',direction:action==='next'?1:-1,body:g.body,exploring:g.exploring};
  }
}
