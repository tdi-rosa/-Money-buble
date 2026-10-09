import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudHistory,cloudCenter,fitCloud,gatheringCloudBounds,swipeCropScale,projectCloud,rescaleScreenCloud,dotGridView,rebaseDotGrid} from '../dist/cloud-navigation.js';
import {ClusterCatalog} from '../dist/cluster-tree.js';
import {BubbleField} from '../dist/physics.js';
import {PeriodTravel} from '../dist/period-travel.js';

test('dot lattice follows the bubble camera continuously across zoom levels and crops',()=>{
 const camera={width:360,height:500,x:191.3,y:232.7,panX:23,panY:-19,anchorX:2,anchorY:3};
 for(const pivot of [.5,1,2,4,8]){
  const before=dotGridView({...camera,scale:pivot-1e-7}),after=dotGridView({...camera,scale:pivot+1e-7});
  assert.ok(Math.abs(after.spacing-before.spacing)<.00001,'no density-level reset');
  assert.ok(Math.abs(after.opacity-before.opacity)<.00001,'contrast is continuous');
  assert.ok(Math.abs(after.x-before.x)<.001&&Math.abs(after.y-before.y)<.001,'camera phase is continuous');
 }
 const a=dotGridView({...camera,scale:3}),b=dotGridView({...camera,x:camera.x+10,y:camera.y-5,scale:3});
 assert.equal(b.x-a.x,-30);assert.equal(b.y-a.y,15,'pan and crop use the exact world-to-screen transform');
 assert.equal(dotGridView({...camera,scale:6}).spacing/a.spacing,2,'grid spacing magnifies with expense radii');
});

test('completed and cancelled physical swipes preserve the same dot lattice on screen',()=>{
 const width=360,height=500,source=[{id:'a',x:180,y:250,r:20}],target=[{id:'b',x:180,y:250,r:60}];
 const phase=(x,step)=>((x%step)+step)%step;
 for(const direction of [-1,1])for(const complete of [true,false]){
  const travel=new PeriodTravel(source,target,{width,height,direction,fromCamera:{x:180,y:250,scale:3}});
  const camera=travel.camera(complete?1:.35),anchor={x:2.125,y:6.7};
  const before=dotGridView({width,height,...camera,anchorX:anchor.x,anchorY:anchor.y});
  const finished=travel.finish(complete,camera),rebased=complete?rebaseDotGrid(anchor,-travel.shiftX,-travel.shiftY):anchor;
  const after=dotGridView({width,height,...finished.camera,anchorX:rebased.x,anchorY:rebased.y});
  assert.equal(after.spacing,before.spacing);
  assert.ok(Math.abs(phase(before.x,before.spacing)-phase(after.x,after.spacing))<1e-9,'horizontal handoff cannot jump');
  assert.ok(Math.abs(phase(before.y,before.spacing)-phase(after.y,after.spacing))<1e-9,'vertical handoff cannot jump');
 }
});

test('contraction camera fits the forming cloud without waiting for distant retained bubbles',()=>{
 const bodies=[{id:'large',x:180,y:250,r:45,targetR:45},{id:'small',x:235,y:250,r:10,targetR:10},{id:'late',x:1800,y:250,r:5,targetR:5}].map(b=>({...b,inPeriod:true,cluster:true,centerX:180,centerY:250,tx:180,ty:250,gatherRadius:100,vx:0,vy:0}));
 const before=structuredClone(bodies),footprint=gatheringCloudBounds(bodies,360,500);
 assert.deepEqual(footprint,{left:135,right:280,top:205,bottom:295});
 assert.deepEqual(bodies,before,'camera estimation must not move, resize or remove physical circles');
 const robustScale=320/(footprint.right-footprint.left+12);
 assert.ok(robustScale>fitCloud(bodies,360,500)*8,'crop already approaches the small cloud while an arrival is far away');
 assert.deepEqual(gatheringCloudBounds([...bodies.slice(0,2),{...bodies[2],x:18000}],360,500),footprint,'outlier distance cannot hold back the camera');
 const field=new BubbleField();field.bodies=bodies;
 for(let i=0;i<180;i++){field.stepLive(1/60,{pixelScale:robustScale});const box=gatheringCloudBounds(field.bodies,360,500);assert.ok(Object.values(box).every(Number.isFinite));}
 assert.equal(field.bodies.length,3);assert.equal(field.bodies[0].r,45);assert.equal(field.bodies[2].r,5);
 assert.ok(Math.hypot(field.bodies[2].x-180,field.bodies[2].y-250)<100,'the real distant circle still joins through the simulation');
});

test('robust crop preserves large monetary radii and continuously becomes the full physical crop',()=>{
 const base={inPeriod:true,gatherRadius:100,centerX:180,centerY:250};
 const large={...base,x:180,y:250,r:85},late={...base,x:275,y:250,r:5};
 const at=gatheringCloudBounds([large,late],360,500),outside=gatheringCloudBounds([large,{...late,x:275.001}],360,500),inside=gatheringCloudBounds([large,{...late,x:274.999}],360,500);
 assert.deepEqual(at,outside);assert.ok(Math.abs(at.right-inside.right)<.002,'no camera jump when the last arrival reaches the cloud');
 assert.equal(at.left,95);assert.equal(at.top,165);assert.equal(at.bottom,335,'a large circle contributes its entire monetary radius');
 const final=gatheringCloudBounds([large,{...late,x:230}],360,500);
 assert.deepEqual(final,{left:95,right:265,top:165,bottom:335});
 assert.equal(gatheringCloudBounds([],360,500),null);
 assert.deepEqual(gatheringCloudBounds([large,{x:90000,y:90000,r:900,inPeriod:false}],360,500),final,'departures never delay contraction');
});

test('two independently cropped periods use one monetary scale throughout a swipe',()=>{
 const catalog=new ClusterCatalog([{id:'rent',date:'2026-09-01',amountCents:139150},{id:'shop',date:'2026-10-01',amountCents:4610}]);
 const options={mode:'month',width:360,height:500};
 const a=catalog.layout({...options,date:'2026-09-01'}),b=catalog.layout({...options,date:'2026-10-01'});
 assert.notEqual(a.fitZoom,b.fitZoom);
 const source=projectCloud(a.specs.map(s=>({...s,x:s.tx,y:s.ty,r:s.targetR})),{...options,scale:a.fitZoom});
 for(const progress of [0,.1,.5,.9,1]){
  const shared=swipeCropScale(a.fitZoom,b.fitZoom,progress);
  const left=rescaleScreenCloud(source,a.fitZoom,shared,360,500);
  const right=projectCloud(b.specs.map(s=>({...s,x:s.tx,y:s.ty,r:s.targetR})),{...options,scale:shared});
  assert.ok(Math.abs(left[0].r**2/right[0].r**2-139150/4610)<1e-9,'area must represent the expense ratio, not each period crop');
 }
});

test('cropping tracks the swipe in both directions and is complete when the slide ends',()=>{
 for(const [from,to] of [[.5,3],[3,.5]]){
  assert.equal(swipeCropScale(from,to,0),from);
  assert.equal(swipeCropScale(from,to,1),to);
  let last=from;
  for(let i=1;i<=100;i++){
   const scale=swipeCropScale(from,to,i/100);
   assert.ok(scale>=Math.min(from,to)&&scale<=Math.max(from,to));
   assert.ok(to>from?scale>=last:scale<=last);last=scale;
  }
  assert.notEqual(swipeCropScale(from,to,.3),from,'crop starts while the finger is still swiping');
  assert.equal(swipeCropScale(from,to,-.1),from);assert.equal(swipeCropScale(from,to,1.5),to);
  assert.equal(swipeCropScale(from,to,0),from,'cancelled swipe returns to the original crop');
 }
});

test('the destination crop fits the saved physical footprint rather than the default pack',()=>{
 const saved=[{x:90,y:110,r:30},{x:260,y:380,r:10}],width=360,height=500;
 const scale=fitCloud(saved,width,height),center=cloudCenter(saved,width,height);
 const painted=projectCloud(saved,{width,height,scale,centerX:center.x,centerY:center.y});
 for(const b of painted){assert.ok(b.x-b.r>=20&&b.x+b.r<=width-20);assert.ok(b.y-b.r>=24&&b.y+b.r<=height-24);}
 assert.equal(swipeCropScale(.3,scale,1),scale,'handoff already uses the exact final camera scale');
 assert.equal(fitCloud([],width,height,.7),.7,'empty periods do not invent a zoom');
});

test('month after week expansion keeps its physical arrangement on left/right return',()=>{
 const history=new CloudHistory(),specs=[{id:'a',tx:180,ty:250,targetR:20,transaction:{amountCents:100}},{id:'b',tx:220,ty:250,targetR:10,transaction:{amountCents:25}}];
 const live=[{...specs[0],x:165,y:236,vx:3,vy:-2,r:20,inPeriod:true},{...specs[1],x:190,y:268,vx:1,vy:4,r:10,inPeriod:true},{id:'outgoing',x:999,y:999,inPeriod:false}];
 history.save('month','2026-09-08',live);
 live[0].x=900; // Saving cannot retain references to the mutable simulation.
 history.save('month','2026-08-01',[{id:'c',x:0,y:0,inPeriod:true}]);
 const preview=history.restore('month','2026-09-01',specs),returned=history.restore('month','2026-09-08',specs);
 assert.deepEqual(returned,preview);assert.equal(returned[0].x,165);assert.equal(returned[0].y,236);assert.equal(returned[0].vx,3);
 assert.equal(returned[1].y,268);assert.equal(returned.length,2);
 assert.deepEqual(cloudCenter(returned,360,500),{x:172.5,y:247});
 const fresh=history.restore('week','2026-09-08',specs);assert.equal(fresh[0].x,180,'different modes have distinct history');
 history.clear();assert.equal(history.restore('month','2026-09-08',specs)[0].x,180);
});

test('screen reprojection keeps every bubble including ones outside the viewport',()=>{
 const bodies=[{id:'a',x:180,y:250,r:20},{id:'far',x:2000,y:1000,r:10}];
 const screen=projectCloud(bodies,{width:360,height:500,scale:2,centerX:190,centerY:240,panX:10,panY:-20});
 const resized=rescaleScreenCloud(screen,2,.5,360,500);
 assert.equal(resized.length,2);assert.equal(resized[0].r,10);assert.equal(resized[1].r,5);
 assert.equal(resized[1].x,1087.5);
});
