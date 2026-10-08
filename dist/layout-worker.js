import {periodCamera,expenseBubbles} from './bubble-layout.js';
import {paymentColor} from './core.js';
import {BubbleField,resolveCollisions} from './physics.js';
export function computeLayout({groups,options,starts}){
  const camera=periodCamera(groups,options),specs=expenseBubbles(groups,paymentColor,options,camera);
  if(!starts||options.animate===false)return {groups:[],specs};
  const byId=new Map(starts.map(b=>[b.id,b]));
  // Prepare the whole collision-safe path off the UI thread. Only expenses that
  // enter or leave the viewport need keyframes; older bank history stays parked.
  const moving=specs.filter(s=>{const b=byId.get(s.id);return s.inPeriod||b&&b.x+b.r>=0&&b.x-b.r<=options.width&&b.y+b.r>=0&&b.y-b.r<=options.height;});
  if(moving.every(s=>{const b=byId.get(s.id);return !b||Math.abs(b.x-s.tx)<.01&&Math.abs(b.y-s.ty)<.01&&Math.abs(b.r-s.targetR)<.01;}))return {groups:[],specs};
  const field=new BubbleField();field.resize(options.width,options.height);
  field.bodies=moving.map(s=>{const b=byId.get(s.id);return {...s,x:b?.x??s.spawnX,y:b?.y??s.spawnY,r:b?.r??s.targetR,vx:0,vy:0,alpha:1};});
  // Incoming bubbles are still outside the viewport. Arrange that invisible
  // starting cloud with the same proportional geometry, rather than piling
  // hundreds of circles onto one edge and spending frames untangling them.
  for(const side of [-1,1]){
    const entering=field.bodies.filter(b=>b.inPeriod&&(b.x+b.r<0||b.x-b.r>options.width||b.y+b.r<0||b.y-b.r>options.height)&&(b.x<options.width/2?-1:1)===side);
    for(const b of entering){const ratio=b.r/Math.max(.001,b.targetR);b.x=options.width/2+(b.tx-options.width/2)*ratio;b.y=options.height/2+(b.ty-options.height/2)*ratio;}
    const shift=side===1?options.width+32-Math.min(Infinity,...entering.map(b=>b.x-b.r)):-32-Math.max(-Infinity,...entering.map(b=>b.x+b.r));
    for(const b of entering)b.x+=shift;
  }
  const paths=moving.map(s=>({...s,inPeriod:true}));
  for(const side of [-1,1]){
    const leaving=paths.filter(s=>!specs.find(b=>b.id===s.id).inPeriod&&(s.tx<options.width/2?-1:1)===side);
    for(const s of leaving){const b=byId.get(s.id),ratio=s.targetR/Math.max(.001,b.r);s.tx=options.width/2+(b.x-options.width/2)*ratio;s.ty=options.height/2+(b.y-options.height/2)*ratio;}
    const shift=side===1?options.width+32-Math.min(Infinity,...leaving.map(b=>b.tx-b.targetR)):-32-Math.max(-Infinity,...leaving.map(b=>b.tx+b.targetR));
    for(const s of leaving)s.tx+=shift;
  }
  field.reconcile(paths);
  const steps=24,duration=.38,ids=field.bodies.map(b=>b.id),frames=new Float64Array((steps+1)*ids.length*3);
  const capture=frame=>{for(let i=0;i<field.bodies.length;i++){const b=field.bodies[i],offset=(frame*ids.length+i)*3;frames[offset]=b.x;frames[offset+1]=b.y;frames[offset+2]=b.r;}};
  capture(0);for(let i=1;i<=steps;i++){field.step(duration/steps);
    if(i<steps){const margin=Math.max(0,...field.bodies.map(b=>b.r));resolveCollisions(field.bodies.filter(b=>b.x+b.r>=-margin&&b.x-b.r<=options.width+margin&&b.y+b.r>=-margin&&b.y-b.r<=options.height+margin),{iterations:256,tolerance:.0001});}
    capture(i);}
  return {groups:[],specs,morph:{ids,frames,steps,duration}};
}
if(typeof self!=='undefined')self.onmessage=({data})=>{
  try{const result=computeLayout(data);if(!data.warm)self.postMessage({id:data.id,preview:data.preview,...result},result.morph?[result.morph.frames.buffer]:[]);}
  catch(error){if(!data.warm)self.postMessage({id:data.id,error:String(error.message||error)});}
};
