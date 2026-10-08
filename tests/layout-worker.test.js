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

import {ClusterCatalog} from '../dist/cluster-tree.js';
test('5000 expenses are prepared once and period switches return no physics keyframes',()=>{
 const items=Array.from({length:5000},(_,i)=>({id:'large-'+i,date:'2026-10-'+String(1+i%30).padStart(2,'0'),amountCents:100+i%100*31}));
 const catalog=new ClusterCatalog(items),options={mode:'month',date:'2026-10-08',width:360,height:420};
 const result=computeLayout({catalog,options});assert.equal(result.specs.length,5000);assert.equal(result.morph,undefined);
 for(let i=0;i<30;i++){const layout=computeLayout({catalog,options:{...options,mode:i%2?'week':'month'}});assert.ok(layout.specs.length>0);assert.equal(layout.morph,undefined);}
});
