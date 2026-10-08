import test from 'node:test';import assert from 'node:assert/strict';
import {openBankWindow,notifyBankReturn} from '../dist/bank-window.js';
test('bank opens in a separate window and popup blocking never navigates the app',()=>{
 const popup={opener:{}};let args;
 assert.equal(openBankWindow((...a)=>{args=a;return popup},'https://example.com'),true);
 assert.deepEqual(args,['https://example.com/bank-connect.html','_blank']);assert.equal(popup.opener,null);
 assert.equal(openBankWindow(()=>null,'https://example.com'),false);
});
test('bank return only broadcasts a status, never bank credentials, and tolerates blocked storage',()=>{
 let stored,sent,closed=false;
 notifyBankReturn('connected',{storage:{setItem:(k,v)=>stored=JSON.parse(v)},channel:()=>({postMessage:m=>sent=m,close:()=>closed=true})});
 assert.deepEqual(stored,sent);assert.equal(sent.result,'connected');assert.deepEqual(Object.keys(sent),['type','result','at']);assert.ok(closed);
 assert.doesNotThrow(()=>notifyBankReturn('unsafe-data',{storage:{setItem(){throw Error()}},channel(){throw Error()}}));
});
