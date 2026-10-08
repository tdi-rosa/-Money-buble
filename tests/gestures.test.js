import test from 'node:test';import assert from 'node:assert/strict';
import {GestureSession} from '../dist/gestures.js';
const view=(mode='day',zoom=1)=>({mode,zoom,pan:0,panY:0,width:360,height:420});
test('successive swipes are independent sessions, including during a previous animation',()=>{
 const g=new GestureSession();for(let i=0;i<5;i++){const t=i*70;g.down(1,{x:250,y:200},t,view(),{id:'expense'});assert.equal(g.move(1,{x:224,y:202},t+35,view()).type,'swipe');assert.equal(g.up(1,{x:224,y:202},t+45,view()).type,'navigate');assert.equal(g.contacts.size,0);assert.equal(g.pointer,null);}
});
test('pinch can reverse through week and month without lifting either finger',()=>{
 const g=new GestureSession();let v=view();g.down(1,{x:100,y:210},0,v);g.down(2,{x:260,y:210},0,v);
 for(const [x,expected] of [[220,'week'],[260,'day'],[220,'week'],[188,'month'],[220,'week'],[260,'day']]){const result=g.move(2,{x,y:210},20,v);assert.equal(result.nextMode,expected);v=view(expected);assert.equal(g.contacts.size,2);}
});
test('lifting a pinch finger hands off to pan and duplicate capture loss cannot end it',()=>{
 const g=new GestureSession(),v=view('day',2);g.down(1,{x:100,y:210},0,v);g.down(2,{x:260,y:210},0,v);g.up(2,{x:260,y:210},20,v);assert.equal(g.up(2,{x:260,y:210},21,v,true),undefined);assert.equal(g.move(1,{x:115,y:225},30,v).type,'pan');assert.equal(g.up(1,{x:115,y:225},40,v).type,'end');assert.equal(g.contacts.size,0);
});
test('a long hold followed by a short flick works, a cancellation or vertical movement never navigates',()=>{
 const g=new GestureSession();g.down(1,{x:200,y:210},0,view());g.move(1,{x:176,y:210},540,view());assert.equal(g.up(1,{x:176,y:210},550,view()).type,'navigate');
 g.down(1,{x:200,y:210},600,view());g.move(1,{x:200,y:260},620,view());assert.equal(g.up(1,{x:140,y:270},640,view()).type,'end');
 g.down(1,{x:200,y:210},650,view());g.move(1,{x:150,y:210},670,view());assert.equal(g.up(1,{x:150,y:210},680,view(),true).type,'end');
});
test('tap is always an expense tap and zoom pans follow both axes in CSS pixels',()=>{
 const g=new GestureSession();for(const mode of ['day','week','month']){const body={id:mode};g.down(1,{x:180,y:210},0,view(mode),body);assert.deepEqual(g.up(1,{x:182,y:208},80,view(mode)),{type:'tap',direction:-1,body,exploring:false});}
 g.down(1,{x:100,y:100},0,view('day',3));assert.deepEqual(g.move(1,{x:150,y:70},20,view('day',3)),{type:'pan',pan:50,panY:-30});
});
