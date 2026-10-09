import test from 'node:test';import assert from 'node:assert/strict';import {BubbleField,resolveCollisions} from '../dist/physics.js';import {bounds,navigate,groupTransactions,sum} from '../dist/periods.js';
test('a large expense joins the core of an existing small cloud through live contacts',()=>{
 const f=new BubbleField(),body=(id,x,y,r,phase=0)=>({id,x,y,r,targetR:r,tx:0,ty:0,centerX:0,centerY:0,cluster:true,inPeriod:true,vx:0,vy:0,phase,travelSpeed:450});
 f.bodies=[body('large',220,0,50),...Array.from({length:30},(_,i)=>body(String(i),(i%6-2.5)*14,(Math.floor(i/6)-2)*14,6,i*2.399))];
 const initial=f.bodies.map(b=>({x:b.x,y:b.y,r:b.r}));f.stepLive(0);assert.deepEqual(f.bodies.map(b=>({x:b.x,y:b.y,r:b.r})),initial,'installing the radial preference never resets positions');
 f.stepLive(1/60,{organic:true});assert.ok(f.bodies[0].x<220&&f.bodies[0].x>=212.5,'movement comes from acceleration, not an interpolated layout');
 for(let i=0;i<720;i++)f.stepLive(1/60,{organic:true});
 const large=Math.hypot(f.bodies[0].x,f.bodies[0].y),small=f.bodies.slice(1).reduce((s,b)=>s+Math.hypot(b.x,b.y),0)/30;
 assert.ok(large<18&&small>large+35,`large bubble occupies the core (${large}), small ones surround it (${small})`);
 assert.equal(f.bodies.length,31);
 for(let i=0;i<f.bodies.length;i++){const a=f.bodies[i];assert.equal(a.r,initial[i].r);assert.ok([a.x,a.y,a.vx,a.vy].every(Number.isFinite));for(let j=0;j<i;j++){const b=f.bodies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-.04,'sorting preserves real collision contacts');}}
 const from={x:f.bodies[0].x,y:f.bodies[0].y};for(let i=0;i<240;i++)f.stepLive(1/60,{organic:true});assert.ok(Math.hypot(f.bodies[0].x-from.x,f.bodies[0].y-from.y)>.1,'the organized cloud remains alive');
});

test('radial preferences stay local to each swipe cloud and equal expenses share a preference',()=>{
 const f=new BubbleField();f.bodies=[{id:'a',x:200,y:0,r:50,targetR:50,tx:0,ty:0,centerX:0,centerY:0,cluster:true},{id:'b',x:0,y:0,r:6,targetR:6,tx:0,ty:0,centerX:0,centerY:0,cluster:true},{id:'c',x:0,y:20,r:6,targetR:6,tx:0,ty:0,centerX:0,centerY:0,cluster:true},{id:'other',x:1000,y:0,r:200,targetR:200,tx:1000,ty:0,centerX:1000,centerY:0,cluster:true}];
 f.stepLive(0);assert.equal(f.radialPreference.get('b'),56);assert.equal(f.radialPreference.get('c'),56);assert.equal(f.radialPreference.get('other'),0);
 f.bodies=[...f.bodies].reverse();f.stepLive(0);assert.equal(f.radialPreference.get('b'),f.radialPreference.get('c'),'equal amounts cannot be sorted by their array order');
});
test('a grabbed bubble returns to its center after release',()=>{const f=new BubbleField();f.resize(400,400);f.reconcile([{id:'a',tx:200,ty:200,targetR:20,spawnX:200,spawnY:200}]);for(let i=0;i<240;i++)f.step(1/120);f.dragId='a';f.bodies[0].x=340;for(let i=0;i<30;i++)f.step(1/120);assert.equal(f.bodies[0].x,340);f.dragId=null;for(let i=0;i<1000;i++)f.step(1/120);assert.ok(Math.abs(f.bodies[0].x-200)<.01)});
test('collisions resolve without losing bodies or creating NaN',()=>{const f=new BubbleField();f.resize(500,500);f.reconcile(Array.from({length:25},(_,i)=>({id:String(i),tx:250,ty:250,targetR:12+(i%3)*2})));for(let i=0;i<1000;i++)f.step(1/120);assert.equal(f.bodies.length,25);for(const b of f.bodies)assert.ok([b.x,b.y,b.vx,b.vy,b.r].every(Number.isFinite));for(let i=0;i<f.bodies.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(f.bodies[i].x-f.bodies[j].x,f.bodies[i].y-f.bodies[j].y)>f.bodies[i].r+f.bodies[j].r-2)});
test('reconciliation retains positions and removes faded bodies',()=>{const f=new BubbleField();f.reconcile([{id:'a',tx:200,ty:200,targetR:20},{id:'b',tx:300,ty:200,targetR:20}]);for(let i=0;i<100;i++)f.step(1/120);const x=f.bodies[0].x;f.reconcile([{id:'a',tx:100,ty:100,targetR:12}]);assert.equal(f.bodies[0].x,x);for(let i=0;i<250;i++)f.step(1/120);assert.equal(f.bodies.length,1)});
test('calendar periods handle month ends, Monday weeks, year changes',()=>{assert.deepEqual(bounds('2026-10-07','week'),{start:'2026-10-05',end:'2026-10-11'});assert.equal(bounds('2024-02-29','month').end,'2024-02-29');assert.equal(navigate('2026-01-31','month',1),'2026-02-01');assert.equal(navigate('2026-12-31','month',1),'2027-01-01')});
test('month groups preserve every expense exactly once',()=>{const tx=[1,2,10,20,31].map(n=>({date:`2026-10-${String(n).padStart(2,'0')}`,amountCents:100}));tx.push({date:'2026-09-30',amountCents:800});const scene=groupTransactions(tx,'2026-10-07','month');assert.equal(sum(scene.visible),500);assert.equal(scene.groups.flatMap(g=>g.items).length,5);assert.equal(scene.groups.reduce((n,g)=>n+sum(g.items),0),500)});

test('drag follows its target gradually and preserves a damped release velocity',()=>{const f=new BubbleField();f.resize(400,400);f.reconcile([{id:'a',tx:200,ty:200,targetR:20}]);for(let i=0;i<240;i++)f.step(1/120);f.dragId='a';f.dragTarget={x:320,y:230};f.step(1/120);assert.ok(f.bodies[0].x>200&&f.bodies[0].x<240);assert.ok(f.bodies[0].vx>0);for(let i=0;i<100;i++)f.step(1/120);assert.ok(Math.abs(f.bodies[0].x-320)<.01);f.dragId=null;f.dragTarget=null;for(let i=0;i<1000;i++)f.step(1/120);assert.ok(Math.abs(f.bodies[0].x-200)<.01);});

test('live physics moves locked layout bubbles, pushes neighbours and restores proportional radii',()=>{
 const f=new BubbleField();f.bodies=[{id:'a',x:100,y:100,tx:100,ty:100,r:20,targetR:20,alpha:1,layoutLocked:true},{id:'b',x:145,y:100,tx:145,ty:100,r:20,targetR:20,alpha:1,layoutLocked:true}];
 f.dragId='a';f.dragTarget={x:135,y:100};
 for(let i=0;i<100;i++)f.stepLive(1/120);
 assert.ok(f.bodies[1].x>170,'the grabbed circle must push its neighbour');
 assert.ok(Math.hypot(f.bodies[0].x-f.bodies[1].x,f.bodies[0].y-f.bodies[1].y)>=40-.05);
 f.dragId=null;f.dragTarget=null;
 for(let i=0;i<600&&!f.settled;i++)f.stepLive(1/120);
 assert.ok(f.settled,'the real spring field must sleep after release');
 for(const b of f.bodies){assert.ok(Math.abs(b.x-b.tx)<.1);assert.equal(b.r,b.targetR);}
});
test('live collisions still run on tiny circles at a deeply zoomed month scale',()=>{
 const f=new BubbleField();f.bodies=[{id:'tiny',x:0,y:0,tx:0,ty:0,r:.01,targetR:.01,alpha:1,collisionGap:.0002},{id:'small',x:.005,y:0,tx:.1,ty:0,r:.03,targetR:.03,alpha:1,collisionGap:.0002}];
 f.stepLive(1/120,{pixelScale:50});assert.ok(Math.hypot(f.bodies[0].x-f.bodies[1].x,f.bodies[0].y-f.bodies[1].y)>=.04-.0005);
});
test('radius tiers resolve giant and tiny contacts across negative and distant grid coordinates',()=>{
 const bodies=[{id:'giant',x:-100000,y:-300000,r:1000,alpha:1},{id:'tiny',x:-99000,y:-300000,r:2,alpha:1},{id:'far',x:200000,y:900000,r:20,alpha:1}];
 resolveCollisions(bodies);assert.ok(Math.hypot(bodies[0].x-bodies[1].x,bodies[0].y-bodies[1].y)>=1004-.01);
 assert.equal(bodies[2].x,200000);assert.equal(bodies[2].y,900000);
});

test('organic physics continues moving at rest and respects reduced motion',()=>{
 const f=new BubbleField();f.bodies=[{id:'living',x:100,y:100,tx:100,ty:100,r:25,targetR:25,alpha:1,inPeriod:true}];
 for(let i=0;i<180;i++)assert.equal(f.stepLive(1/60,{organic:true}),true);
 const from={x:f.bodies[0].x,y:f.bodies[0].y};for(let i=0;i<120;i++)f.stepLive(1/60,{organic:true});
 assert.ok(Math.hypot(f.bodies[0].x-from.x,f.bodies[0].y-from.y)>2,'resting bubbles visibly drift instead of freezing');assert.equal(f.bodies[0].r,25);
 for(let i=0;i<400;i++)f.stepLive(1/60,{organic:false});assert.ok(f.settled);
});

test('arrival and departure share a screen speed limit while the camera zoom changes',()=>{
 for(const scale of [.2,1,5])for(const departing of [false,true]){
 const f=new BubbleField();f.bodies=[{id:'a',x:departing?0:10000,y:0,tx:0,ty:0,motionX:departing?10000:0,motionY:0,r:10,targetR:10,alpha:1,inPeriod:!departing,departing,travelSpeed:450}];
 for(let i=0;i<120;i++){const x=f.bodies[0].x;f.stepLive(1/120,{pixelScale:scale});assert.ok(Math.abs(f.bodies[0].x-x)*scale<=450/120+1e-8);}
 assert.equal(f.bodies[0].alpha,1);assert.equal(f.bodies[0].r,10);
 }
});
test('an incoming circle moves at the same velocity as its symmetric outgoing circle before contact',()=>{
 const incoming=new BubbleField(),outgoing=new BubbleField();
 incoming.bodies=[{id:'in',x:1000,y:0,tx:0,ty:0,centerX:0,centerY:0,cluster:true,arriving:true,inPeriod:true,r:10,targetR:10,travelSpeed:450}];
 outgoing.bodies=[{id:'out',x:0,y:0,tx:1000,ty:0,motionX:1000,motionY:0,departing:true,inPeriod:false,r:10,targetR:10,travelSpeed:450}];
 for(let i=0;i<120;i++){incoming.stepLive(1/120);outgoing.stepLive(1/120);assert.ok(Math.abs(incoming.bodies[0].vx+outgoing.bodies[0].vx)<1e-8);}
});
test('an arrival switches to the gentle living cloud after contact, without swallowing or overlapping it',()=>{
 const f=new BubbleField();f.bodies=[{id:'anchor',x:0,y:0,tx:0,ty:0,centerX:0,centerY:0,cluster:true,arriving:false,inPeriod:true,r:20,targetR:20,collisionGap:1},{id:'new',x:200,y:0,tx:40,ty:0,centerX:0,centerY:0,cluster:true,arriving:true,inPeriod:true,r:15,targetR:15,travelSpeed:450,collisionGap:1}];
 for(let i=0;i<300;i++)f.stepLive(1/120,{organic:true});assert.equal(f.bodies[1].arriving,false);assert.ok(Math.hypot(f.bodies[0].x-f.bodies[1].x,f.bodies[0].y-f.bodies[1].y)>=35);assert.equal(f.bodies.length,2);
});
test('retained distant bubbles regroup rapidly in both month-to-week and week-to-day contractions',()=>{
 for(const transition of ['month→week','week→day']){
 const f=new BubbleField();f.bodies=[{id:transition,x:300,y:0,tx:30,ty:0,centerX:0,centerY:0,cluster:true,inPeriod:true,arriving:false,gatheringUntil:.85,r:10,targetR:10,travelSpeed:450}];
 const start=f.bodies[0].x;for(let i=0;i<90;i++)f.stepLive(1/120);assert.ok(f.bodies[0].x<start*.15,'a retained circle must not use the slow resting attraction during contraction');
 }
});
test('retained circles keep the gathering force after a large departing obstacle has delayed their return',()=>{
 const f=new BubbleField();f.bodies=[{id:'retained',x:300,y:0,tx:30,ty:0,centerX:0,centerY:0,cluster:true,inPeriod:true,arriving:false,gatheringUntil:.85,r:10,targetR:10,travelSpeed:450},{id:'departing',x:0,y:3000,tx:0,ty:3000,motionX:0,motionY:10000,departing:true,inPeriod:false,r:100,targetR:100,travelSpeed:450}];
 for(let i=0;i<240;i++)f.stepLive(1/120);f.bodies=f.bodies.filter(b=>!b.departing);f.bodies[0].x=300;f.bodies[0].vx=0;
 for(let i=0;i<90;i++)f.stepLive(1/120);assert.ok(f.bodies[0].x<45,'the force must continue after the departure, rather than expiring at the initial transition timer');
});
