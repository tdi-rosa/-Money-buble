import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudHistory,cloudCenter,fitCloud,swipeCropScale,projectCloud,rescaleScreenCloud} from '../dist/cloud-navigation.js';
import {ClusterCatalog} from '../dist/cluster-tree.js';

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
