import test from 'node:test';import assert from 'node:assert/strict';import {bubbleRadii,gestureAction} from '../dist/bubble-layout.js';
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
