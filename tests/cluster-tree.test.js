import test from 'node:test';import assert from 'node:assert/strict';import {ClusterCatalog} from '../dist/cluster-tree.js';import {BubbleField} from '../dist/physics.js';
const items=Array.from({length:90},(_,i)=>({id:'expense-'+i,date:'2026-10-'+String(1+i%30).padStart(2,'0'),amountCents:100+i*35})),options={date:'2026-10-08',width:360,height:420};
test('flat period layouts preserve identities and monetary radii without fixed day containers',()=>{
 const c=new ClusterCatalog(items),day=c.layout({...options,mode:'day'}),week=c.layout({...options,mode:'week'}),month=c.layout({...options,mode:'month'});
 for(const old of [day,week])for(const b of old.specs){const target=month.specs.find(s=>s.id===b.id);assert.ok(target);assert.equal(b.targetR,target.targetR);assert.equal(target.layoutLocked,false);}
});
test('month circles form one connected compact cloud instead of nested fractal islands',()=>{
 const rows=[{id:'rent',date:'2026-08-01',amountCents:139150},...Array.from({length:65},(_,i)=>({id:'other-'+i,date:'2026-08-'+String(1+i%30).padStart(2,'0'),amountCents:100+i*43}))];
 const result=new ClusterCatalog(rows).layout({...options,date:'2026-08-08',mode:'month'}),reached=new Set([result.specs[0]]);
 for(let pass=0;pass<result.specs.length;pass++)for(const b of result.specs)if(!reached.has(b)&&[...reached].some(a=>Math.hypot(a.tx-b.tx,a.ty-b.ty)<=a.targetR+b.targetR+4.01*result.scale))reached.add(b);
 assert.equal(reached.size,rows.length);
 const circles=result.specs.map(b=>({x:180+(b.tx-180)*result.fitZoom,y:210+(b.ty-210)*result.fitZoom,r:b.targetR*result.fitZoom}));
 const span=Math.max(...circles.map(b=>b.x+b.r))-Math.min(...circles.map(b=>b.x-b.r));assert.ok(span>260&&span<=320,'the cloud fills the mobile viewport width');
 for(const b of circles){assert.ok(b.x-b.r>=19.9&&b.x+b.r<=340.1);assert.ok(b.y-b.r>=23.9&&b.y+b.r<=396.1);}
});
test('the same amount scale survives different days, weeks and months',()=>{
 const rows=[{id:'large',date:'2026-09-05',amountCents:100000},{id:'small',date:'2026-10-08',amountCents:9000}],c=new ClusterCatalog(rows);
 for(const mode of ['day','week','month']){const a=c.layout({...options,mode,date:'2026-09-05'}),b=c.layout({...options,mode,date:'2026-10-08'});assert.equal(a.fitZoom,b.fitZoom);assert.ok(Math.abs(a.specs[0].targetR**2/b.specs[0].targetR**2-1000/90)<1e-9);}
});
test('live period expansion moves circles through contacts instead of teleporting or locking positions',()=>{
 const c=new ClusterCatalog(items),f=new BubbleField();
 for(const mode of ['day','week','month','day']){
  const layout=c.layout({...options,mode}),previous=new Map(f.bodies.map(b=>[b.id,b]));
  f.bodies=layout.specs.map((s,i)=>{const old=previous.get(s.id);return {...s,x:old?.x??s.tx+Math.cos(i*2.4)*300,y:old?.y??s.ty+Math.sin(i*2.4)*300,r:s.targetR,alpha:1,vx:old?.vx||0,vy:old?.vy||0};});
  for(let frame=0;frame<240;frame++)f.stepLive(1/60,{pixelScale:layout.fitZoom});
  for(const b of f.bodies)assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
  const reach=Math.max(...f.bodies.map(b=>Math.hypot(b.x-180,b.y-210)+b.r));assert.ok(reach*layout.fitZoom<270,'the physics must collect every incoming expense near the centre');
  for(let i=0;i<f.bodies.length;i++)for(let j=0;j<i;j++){const a=f.bodies[i],b=f.bodies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-.03/layout.fitZoom);}
 }
});
