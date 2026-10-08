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
test('tiny and large expenses keep 44px targets and bounded, proportional extra area',()=>{
 const values=[1,100,10000,1000000],r=bubbleRadii(values,{budget:12000,maxRadius:80});
 assert.ok(r.every(x=>Number.isFinite(x)&&x>=22&&x<=80));assert.ok(r.every((x,i)=>!i||x>=r[i-1]));
 assert.ok(Math.abs((r[1]**2-484)/100-(r[0]**2-484))<1e-6);
 assert.ok(r.reduce((s,x)=>s+x*x,0)<=12000.00001);
});
test('swiping on a bubble navigates, taps open days in both overviews, cancel does nothing',()=>{
 assert.equal(gestureAction({dx:-100,dy:5,moved:true,mode:'day',body:{}}),'next');
 for(const mode of ['week','month'])assert.equal(gestureAction({dx:0,dy:0,moved:false,mode,body:{},group:{}}),'drill');
 assert.equal(gestureAction({dx:0,dy:0,moved:false,mode:'day',body:{}}),'detail');
 assert.equal(gestureAction({dx:100,dy:0,cancelled:true}),'none');
});

import {expenseBubbles} from '../dist/bubble-layout.js';
import {groupTransactions} from '../dist/periods.js';
test('all periods retain every expense as its own clickable bubble, even beyond 240 expenses',()=>{
 const items=Array.from({length:350},(_,i)=>({id:'expense-'+i,date:'2026-10-08',amountCents:i+1,paymentKind:i%2?'card':'transfer'}));
 for(const mode of ['day','week','month']){
  const scene=groupTransactions(items,'2026-10-08',mode);
  const groups=scene.groups.map((g,i)=>({...g,x:100,y:100+i*200,maxR:80,cellW:200}));
  const bubbles=expenseBubbles(groups,paymentColor);
  assert.deepEqual(bubbles.map(b=>b.id).sort(),items.map(t=>t.id).sort());
  assert.ok(bubbles.every(b=>b.targetR>=22&&b.transaction===items.find(t=>t.id===b.id)));
  assert.equal(bubbles.reduce((s,b)=>s+b.transaction.amountCents,0),items.reduce((s,t)=>s+t.amountCents,0));
 }
 const month=groupTransactions(items,'2026-10-08','month');assert.equal(month.groups.length,5);
 assert.ok(month.groups.some(g=>g.start==='2026-10-05'&&g.end==='2026-10-11'));
});
