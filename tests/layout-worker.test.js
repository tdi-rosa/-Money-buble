import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {groupTransactions} from '../dist/periods.js';
import {computeLayout} from '../dist/layout-worker.js';
test('worker layout retains calendar geometry and keeps the main event loop responsive',async()=>{
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
