import test from 'node:test';import assert from 'node:assert/strict';import {FluidSurface} from '../dist/fluid-gauge.js';
const area=points=>points.slice(1).reduce((sum,p,i)=>sum+(p.x+points[i].x)/2*(p.y-points[i].y),0);
test('a 30 euro expense on a 1500 euro tank leaves exactly 2 percent empty after its waves settle',()=>{
 const f=new FluidSurface();f.set(1,false);f.set(1470/1500);
 let rippled=false;for(let i=0;i<600;i++){f.step(1/120);const points=f.points();assert.ok(points.every(p=>p.x>=0&&p.x<=1));assert.ok(Math.abs(area(points)-f.level)<1e-12);if(points.some(p=>Math.abs(p.x-f.level)>1e-5))rippled=true;}
 assert.equal(rippled,true);assert.equal(f.level,.98);assert.ok(Math.abs(1-area(f.points())-.02)<1e-12);
});
test('successive changes replace the liquid target immediately and a quiet gauge stops updating',()=>{
 const f=new FluidSurface();f.set(.8,false);f.set(.5);f.step(1/60);f.set(.9);f.step(1/60);f.set(.4);
 let moving=true;for(let i=0;i<600&&moving;i++)moving=f.step(1/120);assert.equal(moving,false);assert.equal(f.level,.4);
 f.set(2,false);assert.equal(area(f.points()),1);f.set(-1,false);assert.equal(area(f.points()),0);
});
