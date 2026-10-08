import test from 'node:test';
import assert from 'node:assert/strict';
import {ownsSimulationFrame,reprojectDeparture,targetCloudRadius} from '../dist/simulation-state.js';
import {BubbleField} from '../dist/physics.js';
import {ClusterCatalog} from '../dist/cluster-tree.js';

test('a late month frame cannot overwrite the new root or resume a paused simulation',()=>{
 const oldRoot=[],newRoot=[];
 assert.equal(ownsSimulationFrame({revision:4},4,oldRoot,oldRoot,true),true);
 assert.equal(ownsSimulationFrame({revision:4},4,oldRoot,newRoot,true),false);
 assert.equal(ownsSimulationFrame({revision:4},5,newRoot,newRoot,true),false);
 assert.equal(ownsSimulationFrame({revision:5},5,newRoot,newRoot,false),false);
});

const screen=(point,c)=>({x:c.width/2+(point.x-c.cameraX)*c.scale+c.panX,y:c.height/2+(point.y-c.cameraY)*c.scale+c.panY});
test('immediate cropping preserves outgoing screen position, radius, target and velocity',()=>{
 const from={width:360,height:500,scale:.2,cameraX:180,cameraY:250,panX:0,panY:0};
 const to={...from,scale:3,cameraX:110,cameraY:200,panX:5,panY:-7};
 const b={departing:true,x:350,y:250,motionX:2500,motionY:800,r:60,targetR:60,vx:1000,vy:200,departureView:from};
 const p=screen(b,from),target=screen({x:b.motionX,y:b.motionY},from),radius=b.r*from.scale,vx=b.vx*from.scale;
 reprojectDeparture(b,to);
 assert.deepEqual(screen(b,to),p);assert.deepEqual(screen({x:b.motionX,y:b.motionY},to),target);
 assert.ok(Math.abs(b.r*to.scale-radius)<1e-9);assert.ok(Math.abs(b.vx*to.scale-vx)<1e-9);
 const active={...b,departing:false};reprojectDeparture(active,from);assert.equal(active.r,b.r);
});

test('month swipe to a different month, then week and day regroups retained circles despite expired clocks',()=>{
 const rows=Array.from({length:240},(_,i)=>({id:String(i),date:`2026-${i<120?'08':'09'}-${String(1+i%30).padStart(2,'0')}`,amountCents:100+(i%11)*300}));
 const catalog=new ClusterCatalog(rows),field=new BubbleField(),options={width:360,height:500,date:'2026-09-08'};
 // The swipe installs the new month's packed root, with no arriving flags.
 const month=catalog.layout({...options,mode:'month'});
 field.bodies=month.specs.map(s=>({...s,x:s.tx,y:s.ty,r:s.targetR,vx:0,vy:0,arriving:false}));
 for(const mode of ['week','day']){
  const layout=catalog.layout({...options,mode}),old=new Map(field.bodies.map(b=>[b.id,b])),radius=targetCloudRadius(layout.specs,360,500);
  field.bodies=layout.specs.map(s=>({...old.get(s.id),...s,gatherRadius:radius,gatheringUntil:0,arriving:false,r:s.targetR}));
  // An older worker clock cannot make the attraction expire before return.
  field.time=10000;field.regroupUntil=0;
  const maxDistance=()=>Math.max(...field.bodies.map(b=>Math.hypot(b.x-180,b.y-250)+b.r));
  const before=maxDistance();
  for(let i=0;i<120;i++)field.stepLive(1/120,{pixelScale:layout.fitZoom});
  const after=maxDistance();
  assert.ok(after<=radius+6/layout.fitZoom,`${mode}: cloud must regain its compact footprint (${before} → ${after}, radius ${radius})`);
  assert.ok(field.bodies.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)));
  for(let i=0;i<field.bodies.length;i++)for(let j=0;j<i;j++){
   const a=field.bodies[i],b=field.bodies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-.1,'collisions remain active');
  }
 }
});

test('a retained outlier keeps fast attraction after all departure timers have expired',()=>{
 const f=new BubbleField();f.time=1000;f.regroupUntil=0;
 f.bodies=[{id:'outlier',x:300,y:0,tx:0,ty:0,centerX:0,centerY:0,cluster:true,inPeriod:true,arriving:false,gatheringUntil:0,gatherRadius:25,r:10,targetR:10,travelSpeed:450}];
 for(let i=0;i<120;i++)f.stepLive(1/120);
 assert.ok(f.bodies[0].x<40,'distance from the target cloud controls gathering, not elapsed transition time');
});
