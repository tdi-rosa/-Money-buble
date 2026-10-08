import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {groupTransactions} from '../dist/periods.js';
import {computeLayout} from '../dist/layout-worker.js';
test('worker layout packs one period cluster and keeps the main event loop responsive',async()=>{
 const items=Array.from({length:60},(_,i)=>({id:'worker-'+i,date:'2026-10-'+String(1+i%15).padStart(2,'0'),amountCents:100+i*200,paymentKind:'card'}));
 const job={groups:groupTransactions(items,'2026-10-08','month').groups,options:{mode:'month',date:'2026-10-08',width:360,height:420}};
 const url=new URL('../dist/layout-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');import(${JSON.stringify(url)}).then(({computeLayout})=>parentPort.on('message',job=>parentPort.postMessage(computeLayout(job))));`,{eval:true});
 let beats=0;const timer=setInterval(()=>beats++,5);
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(job)});
  assert.ok(beats>1,'main thread continues rendering while packing runs');
  assert.deepEqual(result,computeLayout(job));assert.equal(result.specs.length,items.length);
 }finally{clearInterval(timer);await worker.terminate();}
});

import {expenseBubbles} from '../dist/bubble-layout.js';
test('the worker prepares the join animation and finishes at exact collision-free targets',()=>{
 const items=Array.from({length:35},(_,i)=>({id:'join-'+i,date:i<5?'2026-10-08':'2026-10-06',amountCents:100+i*180,paymentKind:'card'}));
 const starts=expenseBubbles([{items}],()=>'',{mode:'day',date:'2026-10-08',width:360,height:420}).map(b=>({id:b.id,x:b.tx,y:b.ty,r:b.targetR}));
 const result=computeLayout({groups:[{items}],starts,options:{mode:'week',date:'2026-10-08',width:360,height:420}}),m=result.morph;
 assert.ok(m);assert.equal(m.ids.length,35);
 for(let frame=1;frame<=m.steps;frame++){
  const circles=m.ids.map((id,i)=>({id,x:m.frames[(frame*m.ids.length+i)*3],y:m.frames[(frame*m.ids.length+i)*3+1],r:m.frames[(frame*m.ids.length+i)*3+2]})).filter(b=>b.x+b.r>=0&&b.x-b.r<=360&&b.y+b.r>=0&&b.y-b.r<=420);
  for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(circles[i].x-circles[j].x,circles[i].y-circles[j].y)>=circles[i].r+circles[j].r-.05,`overlap at frame ${frame}`);
 }
 for(let i=0;i<m.ids.length;i++){const target=result.specs.find(b=>b.id===m.ids[i]),offset=(m.steps*m.ids.length+i)*3;assert.ok(Math.abs(m.frames[offset]-target.tx)<1e-8);assert.ok(Math.abs(m.frames[offset+1]-target.ty)<1e-8);}
});
