import test from 'node:test';
import assert from 'node:assert/strict';
import {PeriodTravel} from '../dist/period-travel.js';
import {ClusterCatalog} from '../dist/cluster-tree.js';
import {BubbleField} from '../dist/physics.js';
import {cloudCenter,fitCloud,projectCloud,CloudHistory} from '../dist/cloud-navigation.js';

const width=360,height=500;
const live=layout=>layout.specs.map(s=>({...s,x:s.tx,y:s.ty,r:s.targetR,alpha:1,vx:0,vy:0}));
const camera=bodies=>{const c=cloudCenter(bodies,width,height);return {x:c.x,y:c.y,scale:fitCloud(bodies,width,height)}};
const paint=(bodies,c)=>projectCloud(bodies,{width,height,scale:c.scale,centerX:c.x,centerY:c.y});
const visible=b=>b.x+b.r>0&&b.x-b.r<width&&b.y+b.r>0&&b.y-b.r<height;

test('tiny-to-giant and giant-to-tiny swipes keep monetary radii, fit during travel and never flash a full-screen giant',()=>{
 const catalog=new ClusterCatalog([{id:'tiny',date:'2026-09-01',amountCents:130},{id:'giant',date:'2026-10-01',amountCents:139150}]);
 const a=live(catalog.layout({width,height,mode:'month',date:'2026-09-01'})),b=live(catalog.layout({width,height,mode:'month',date:'2026-10-01'}));
 for(const [source,target] of [[a,b],[b,a]])for(const direction of [-1,1]){
  const travel=new PeriodTravel(source,target,{width,height,direction,fromCamera:camera(source)}),radii=travel.bodies.map(b=>b.r);
  assert.ok(paint(travel.target,travel.camera(0)).every(b=>!visible(b)),'neighbour begins outside the frame even at huge amount ratios');
  for(let i=0;i<=120;i++){
   const c=travel.camera(i/120),painted=paint(travel.bodies,c);
   assert.ok(painted.some(visible),'the camera must not cross a blank gap between clouds');
   if(i===60)assert.ok(painted.every(visible),'both periods can be compared at the midpoint');
   assert.deepEqual(travel.bodies.map(b=>b.r),radii);
   assert.ok(Math.abs(painted[0].r**2/painted[1].r**2-source[0].r**2/target[0].r**2)<1e-8);
   for(const p of painted)assert.ok(!(p.x-p.r<=0&&p.x+p.r>=width&&p.y-p.r<=0&&p.y+p.r>=height),'a giant must not cover the whole viewport before resizing');
  }
  const end=travel.camera(1),painted=paint(travel.target,end);
  assert.ok(painted.every(b=>b.x-b.r>=19.9&&b.x+b.r<=width-19.9&&b.y-b.r>=23.9&&b.y+b.r<=height-23.9));
  assert.ok(paint(travel.source,end).every(b=>!visible(b)),'outgoing giant is already offscreen before the handoff');
  const finished=travel.finish(true,end);
  assert.deepEqual(paint(finished.bodies,finished.camera).map(b=>[b.id,b.x,b.y,b.r]),painted.map(b=>[b.id,b.x,b.y,b.r]));
 }
});

test('both periods continue moving and resolve cross-period collisions inside the same field',()=>{
 const make=(id,x)=>({id,x,y:250,tx:x,ty:250,centerX:x,centerY:250,cluster:true,inPeriod:true,r:20,targetR:20,alpha:1,vx:0,vy:0});
 const travel=new PeriodTravel([make('old',180)],[make('new',180)],{width,height,direction:1,fromCamera:{x:180,y:250,scale:1}});
 const field=new BubbleField();field.bodies=travel.bodies;
 // Make the two periods contact: no separate collision island may ignore it.
 travel.target[0].x=travel.source[0].x+10;travel.target[0].centerX=travel.source[0].centerX;
 const before=travel.source[0].x;
 for(let i=0;i<60;i++)field.stepLive(1/120,{organic:true});
 assert.notEqual(travel.source[0].x,before);
 assert.ok(Math.hypot(travel.source[0].x-travel.target[0].x,travel.source[0].y-travel.target[0].y)>=40-.05);
 assert.equal(field.bodies.length,2);assert.ok(field.bodies.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)));
});

test('interrupting a swipe keeps any still-visible giant instead of deleting it at handoff',()=>{
 const source=[{id:'old',x:180,y:250,tx:180,ty:250,r:80,targetR:80,inPeriod:true}],target=[{id:'new',x:180,y:250,tx:180,ty:250,r:10,targetR:10,inPeriod:true}];
 const travel=new PeriodTravel(source,target,{width,height,direction:1,fromCamera:camera(source)}),middle=travel.camera(.5);
 const before=paint(travel.bodies,middle).filter(visible),finished=travel.finish(true,middle),after=paint(finished.bodies,finished.camera).filter(visible);
 assert.deepEqual(after.map(b=>b.id).sort(),before.map(b=>b.id).sort());
 for(const b of before){const a=after.find(a=>a.id===b.id);assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.r-b.r)<1e-9);}
});

test('navigation saves canonical live positions for an exact left-right return rather than the default pack',()=>{
 const source=[{id:'a',x:160,y:245,tx:180,ty:250,centerX:180,centerY:250,r:20,targetR:20,inPeriod:true,vx:2,vy:3}],target=[{id:'b',x:195,y:220,tx:180,ty:250,centerX:180,centerY:250,r:30,targetR:30,inPeriod:true}];
 const travel=new PeriodTravel(source,target,{width,height,direction:-1,fromCamera:camera(source)}),history=new CloudHistory();
 history.save('month','2026-09-01',travel.source);history.save('month','2026-08-01',travel.normalizedTarget());
 const restored=history.restore('month','2026-08-01',target);assert.equal(restored[0].x,195);assert.equal(restored[0].y,220);
 assert.equal(history.restore('month','2026-09-01',source)[0].x,160);
});
