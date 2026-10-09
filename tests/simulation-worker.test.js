import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {ClusterCatalog} from '../dist/cluster-tree.js';
test('large live physics runs outside the UI thread and returns finite transferable positions',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({id:'sim-'+i,date:'2026-08-'+String(1+i%30).padStart(2,'0'),amountCents:100+i%5000})),layout=new ClusterCatalog(rows).layout({mode:'month',date:'2026-08-08',width:360,height:420});
 const url=new URL('../dist/simulation-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 let beats=0;const timer=setInterval(()=>beats++,5);
 try{const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({revision:7,running:true,options:{organic:true,pixelScale:layout.fitZoom},bodies:layout.specs.map((s,i)=>({...s,x:s.tx,y:s.ty,r:s.targetR,alpha:1,phase:i*2.4}))});});
 assert.equal(result.revision,7);assert.equal(result.positions.length,4000);assert.ok(result.positions.every(Number.isFinite));assert.ok(beats>2,'the UI event loop must remain responsive');
 }finally{clearInterval(timer);await worker.terminate();}
});
