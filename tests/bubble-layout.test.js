import test from 'node:test';import assert from 'node:assert/strict';import {bubbleRadii,gestureAction} from '../dist/bubble-layout.js';
import {scenePoint} from '../dist/bubble-layout.js';
import {paymentColor,overviewPaymentKind} from '../dist/core.js';
import {BubbleField} from '../dist/physics.js';
test('payment colors do not depend on category; a mixed day does not invent a payment type',()=>{
 assert.equal(paymentColor({paymentKind:'card',category:'food'}),paymentColor({paymentKind:'card',category:'shopping'}));
 assert.notEqual(paymentColor({paymentKind:'card'}),paymentColor({paymentKind:'transfer'}));
 assert.equal(overviewPaymentKind([{paymentKind:'card'},{paymentKind:'transfer'}]),'unknown');
});
test('the top of a bubble remains clickable with canvas scaling and zoom',()=>{
 const f=new BubbleField();f.reconcile([{id:'upper',tx:100,ty:50,targetR:22,spawnX:100,spawnY:50}]);for(let i=0;i<240;i++)f.step(1/60);
 const rect={left:24,top:280,width:300,height:360},view={width:400,height:240,zoom:.8,pan:15};
 // Rendered x = center + zoom*(x-center) + pan; rendered y likewise.
 const clientX=24+(200+.8*(100-200)+15)*300/400;
 const clientY=280+(120+.8*(30-120))*360/240;
 const p=scenePoint({clientX,clientY},rect,view);
 assert.ok(Math.abs(p.x-100)<1e-8);assert.ok(Math.abs(p.y-30)<1e-8);
 assert.equal(f.hit(p.x,p.y)?.id,'upper');
});
test('areas are strictly proportional without a visual floor or saturation',()=>{
 const values=[1,100,1000,3900,1000000],r=bubbleRadii(values,{budget:12000,maxRadius:80});
 assert.ok(r.every(x=>Number.isFinite(x)&&x>0&&x<=80));
 for(let i=1;i<r.length;i++)assert.ok(Math.abs(r[i]**2/r[0]**2-values[i])<1e-7);
 assert.ok(Math.abs(r[3]**2/r[2]**2-3.9)<1e-10);
});
test('swiping on a bubble navigates, overview taps open the selected day, cancel does nothing',()=>{
 assert.equal(gestureAction({dx:-100,dy:5,moved:true,mode:'day',body:{}}),'next');
 for(const mode of ['week','month'])assert.equal(gestureAction({dx:0,dy:0,moved:false,mode,body:{},group:{}}),'drill');
 assert.equal(gestureAction({dx:0,dy:0,moved:false,mode:'day',body:{}}),'detail');
 assert.equal(gestureAction({dx:100,dy:0,cancelled:true}),'none');
});

import {expenseBubbles,periodCamera} from '../dist/bubble-layout.js';
import {bounds,groupTransactions} from '../dist/periods.js';
test('all periods retain every expense as its own clickable bubble, even beyond 240 expenses',()=>{
 const items=Array.from({length:350},(_,i)=>({id:'expense-'+i,date:'2026-10-08',amountCents:i+1,paymentKind:i%2?'card':'transfer'}));
 for(const mode of ['day','week','month']){
  const scene=groupTransactions(items,'2026-10-08',mode);
  const groups=scene.groups.map((g,i)=>({...g,x:100,y:100+i*200,maxR:80,cellW:200}));
  const bubbles=expenseBubbles(groups,paymentColor,{mode,date:'2026-10-08',width:400,height:400});
  assert.deepEqual(bubbles.map(b=>b.id).sort(),items.map(t=>t.id).sort());
  assert.ok(bubbles.every(b=>b.targetR>0&&b.transaction===items.find(t=>t.id===b.id)));
  assert.equal(bubbles.reduce((s,b)=>s+b.transaction.amountCents,0),items.reduce((s,t)=>s+t.amountCents,0));
 }
 const month=groupTransactions(items,'2026-10-08','month');assert.equal(month.groups.length,5);
 assert.ok(month.groups.some(g=>g.start==='2026-10-05'&&g.end==='2026-10-11'));
});

test('overview bubbles are exactly a uniform zoom of each daily cluster',()=>{
 const items=Array.from({length:12},(_,i)=>({id:'zoom-'+i,date:i<6?'2026-10-07':'2026-10-08',amountCents:(i+1)**3*50,paymentKind:'card'}));
 const make=(mode)=>expenseBubbles([{items}],paymentColor,{mode,date:'2026-10-08',width:360,height:420});
 const day=make('day').filter(b=>b.inPeriod);
 for(const mode of ['week','month']){
  const view=make(mode),shared=day.map(b=>view.find(v=>v.id===b.id)),scale=shared[0].targetR/day[0].targetR;
  assert.ok(scale<1);
  for(let i=0;i<day.length;i++){
   assert.ok(Math.abs(shared[i].targetR/day[i].targetR-scale)<1e-9);
   assert.ok(Math.abs((shared[i].tx-shared[0].tx)-(day[i].tx-day[0].tx)*scale)<1e-8);
   assert.ok(Math.abs((shared[i].ty-shared[0].ty)-(day[i].ty-day[0].ty)*scale)<1e-8);
  }
 }
});

test('daily and zoomed clusters have no overlapping circles, including every transition frame',()=>{
 const items=Array.from({length:18},(_,i)=>({id:'contact-'+i,date:i<9?'2026-10-07':'2026-10-08',amountCents:(i+1)**2*110,paymentKind:'card'}));
 const specs=mode=>expenseBubbles([{items}],paymentColor,{mode,date:'2026-10-08',width:360,height:420});
 const separated=bodies=>{for(let i=0;i<bodies.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(bodies[i].x-bodies[j].x,bodies[i].y-bodies[j].y)>=bodies[i].r+bodies[j].r-.01,`${bodies[i].id} overlaps ${bodies[j].id}`)};
 for(const mode of ['day','week','month'])separated(specs(mode).filter(b=>b.inPeriod).map(s=>({...s,x:s.tx,y:s.ty,r:s.targetR})));
 const field=new BubbleField();field.resize(360,420);
 for(const mode of ['day','week','month','day']){
  field.reconcile(specs(mode));
  for(let frame=0;frame<180;frame++){field.step(1/60);separated(field.bodies.filter(b=>!b.retired&&b.inPeriod&&b.alpha>.1));}
 }
});

test('week fits one Monday–Sunday calendar row',()=>{
 const camera=periodCamera(groupTransactions([],'2026-10-08','week').groups,{mode:'week',date:'2026-10-08',width:360,height:420});
 assert.equal(camera.labels.length,7);
 assert.equal(new Set(camera.labels.map(g=>g.x)).size,7);
 assert.equal(new Set(camera.labels.map(g=>g.y)).size,1);
 assert.ok(camera.labels.every(g=>g.x>0&&g.x<360&&g.y>0&&g.y<420));
});

test('zoom preserves every body, its opacity and proportional area across dates',()=>{
 const items=[{id:'ten',date:'2026-10-05',amountCents:1000},{id:'thirty-nine',date:'2026-10-08',amountCents:3900},{id:'outside',date:'2026-09-01',amountCents:500}];
 const field=new BubbleField();
 for(const mode of ['month','week','day','month']){
  field.reconcile(expenseBubbles([{items}],paymentColor,{mode,date:'2026-10-08',width:360,height:420}));
  assert.equal(field.bodies.length,3);assert.ok(field.bodies.every(b=>!b.retired&&b.alpha===1&&b.targetAlpha===1));
  for(let frame=0;frame<120;frame++){
   field.step(1/60);
   const a=field.bodies.find(b=>b.id==='ten'),b=field.bodies.find(b=>b.id==='thirty-nine');
   assert.ok(Math.abs(b.r*b.r/(a.r*a.r)-3.9)<1e-8);
   for(const circle of field.bodies.filter(b=>b.inPeriod))assert.equal(field.hit(circle.x,circle.y)?.id,circle.id);
  }
 }
});
test('touch padding never steals a tap inside another painted circle',()=>{
 const field=new BubbleField();field.bodies=[{id:'small',x:10,y:10,r:1,alpha:1},{id:'large',x:35,y:10,r:20,alpha:1}];
 assert.equal(field.hit(17,10)?.id,'large');assert.equal(field.hit(10,10)?.id,'small');
});

test('zoom and two-axis pan invert the painted coordinates at every part of a bubble',()=>{
 const rect={left:20,top:180,width:360,height:420};
 for(const zoom of [1,2.5,6])for(const point of [{x:180,y:150},{x:160,y:125},{x:200,y:175}]){
  const pan=43,panY=-71;
  const p=scenePoint({clientX:20+180+pan+(point.x-180)*zoom,clientY:180+210+panY+(point.y-210)*zoom},rect,{width:360,height:420,zoom,pan,panY});
  assert.ok(Math.abs(p.x-point.x)<1e-9);assert.ok(Math.abs(p.y-point.y)<1e-9);
 }
});

test('period framing excludes surrounding history while retaining it outside the viewport',()=>{
 const items=Array.from({length:65},(_,i)=>({id:'scope-'+i,date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),amountCents:1000}));
 for(const mode of ['day','week','month']){
  const camera=periodCamera([{items}],{mode,date:'2026-10-08',width:360,height:420});
  const specs=expenseBubbles([{items}],paymentColor,{},camera),range=bounds('2026-10-08',mode);
  assert.equal(camera.labels.length,mode==='day'?1:mode==='week'?7:31);
  for(const b of specs){
   assert.equal(b.inPeriod,b.transaction.date>=range.start&&b.transaction.date<=range.end);
   if(!b.inPeriod)assert.ok(b.tx+b.targetR<0||b.tx-b.targetR>360);
  }
 }
});
test('day framing fills the available area even when another day has a very large expense',()=>{
 const small=[{id:'one',date:'2026-10-08',amountCents:100},{id:'two',date:'2026-10-08',amountCents:390}];
 const layout=items=>expenseBubbles([{items}],paymentColor,{mode:'day',date:'2026-10-08',width:360,height:420}).filter(b=>b.inPeriod);
 const a=layout(small),b=layout([...small,{id:'large',date:'2026-09-01',amountCents:1000000}]);
 assert.deepEqual(a,b);
 const spanX=Math.max(...a.map(x=>x.tx+x.targetR))-Math.min(...a.map(x=>x.tx-x.targetR));
 const spanY=Math.max(...a.map(x=>x.ty+x.targetR))-Math.min(...a.map(x=>x.ty-x.targetR));
 assert.ok(spanX>=300||spanY>=360);assert.ok(Math.abs(a[1].targetR**2/a[0].targetR**2-3.9)<1e-9);
});

test('short month viewports never create negative radii',()=>{
 const items=[{id:'short',date:'2026-08-31',amountCents:3900}];
 const circles=expenseBubbles([{items}],paymentColor,{mode:'month',date:'2026-08-31',width:320,height:240});
 assert.ok(circles.every(b=>Number.isFinite(b.targetR)&&b.targetR>0));
});
