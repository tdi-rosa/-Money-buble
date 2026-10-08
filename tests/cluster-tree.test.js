import test from 'node:test';import assert from 'node:assert/strict';import {ClusterCatalog} from '../dist/cluster-tree.js';
const items=Array.from({length:90},(_,i)=>({id:'nested-'+i,date:'2026-10-'+String(1+i%30).padStart(2,'0'),amountCents:100+i*35}));
const options={date:'2026-10-08',width:360,height:420};
test('day and week circles keep identical world positions and radii on expansion',()=>{
 const c=new ClusterCatalog(items),day=c.layout({...options,mode:'day'}),week=c.layout({...options,mode:'week'}),month=c.layout({...options,mode:'month'});
 for(const [old,next] of [[day,week],[week,month]])for(const b of old.specs){const target=next.specs.find(s=>s.id===b.id);assert.ok(target);assert.ok(Math.abs(b.tx-target.tx)<1e-10);assert.ok(Math.abs(b.ty-target.ty)<1e-10);assert.equal(b.targetR,target.targetR);}
 assert.ok(day.fitZoom>=week.fitZoom&&week.fitZoom>=month.fitZoom);
});
test('incoming groups remain separate from the centered cloud throughout the radial join',()=>{
 const c=new ClusterCatalog(items),day=c.layout({...options,mode:'day'}),week=c.layout({...options,mode:'week'}),month=c.layout({...options,mode:'month'});
 for(const [old,next] of [[day,week],[week,month]]){
  const shared=new Set(old.specs.map(s=>s.id));
  for(let frame=0;frame<=30;frame++){
   const spread=1+9*(1-frame/30)**3;
   const circles=next.specs.map(s=>({x:s.tx+(shared.has(s.id)?0:s.groupX*(spread-1)),y:s.ty+(shared.has(s.id)?0:s.groupY*(spread-1)),r:s.targetR}));
   for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(circles[i].x-circles[j].x,circles[i].y-circles[j].y)>=circles[i].r+circles[j].r-.001,`frame ${frame}, pair ${i}/${j}`);
  }
 }
});
test('the same amount scale survives different days, weeks and months',()=>{
 const rows=[{id:'large',date:'2026-09-05',amountCents:100000},{id:'small',date:'2026-10-08',amountCents:9000}],c=new ClusterCatalog(rows);
 for(const mode of ['day','week','month']){
  const a=c.layout({...options,mode,date:'2026-09-05'}),b=c.layout({...options,mode,date:'2026-10-08'});
  assert.equal(a.fitZoom,b.fitZoom);assert.ok(Math.abs(a.specs[0].targetR**2/b.specs[0].targetR**2-1000/90)<1e-9);
 }
});
