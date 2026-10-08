import test from 'node:test';import assert from 'node:assert/strict';import {walletAt,validateCashflow} from '../dist/wallet.js';
const flows=validateCashflow([{id:'salary',date:'2026-10-01',amountCents:150000},{id:'first',date:'2026-10-02',amountCents:-3000},{id:'second',date:'2026-10-03',amountCents:-7000}]);
const current={balance:{amount:140000,available:true},flows,asOf:'2026-10-03'};
test('the exact visible cloud is the void; 1200 remaining and 300 spent means a 1500 tank',()=>{
 const value=walletAt({balance:{amount:120000,available:true},date:'2026-10-03',asOf:'2026-10-03',expenses:30000});assert.equal(value.reference,150000);assert.equal(value.amount,120000);assert.equal(value.spent,30000);assert.equal(value.ratio,.8);assert.equal(value.reference-value.amount,30000);
});
test('day, week and month each derive a new maximum from their visible cloud, even with the same remaining balance',()=>{
 for(const [mode,expenses]of [['day',7000],['week',10000],['month',10000]]){
 const v=walletAt({...current,date:'2026-10-03',mode,expenses});assert.equal(v.reference,140000+expenses);assert.equal(v.reference-v.amount,expenses);assert.ok(Math.abs((1-v.ratio)*v.reference-expenses)<1e-8);
 }
});
test('historical days use their remaining balance and their own expenses, rather than a fixed income reference',()=>{
 const second=walletAt({...current,date:'2026-10-02',expenses:3000});assert.equal(second.amount,147000);assert.equal(second.reference,150000);assert.equal(second.ratio,.98);assert.equal(second.estimated,true);
 const third=walletAt({...current,date:'2026-10-03',expenses:7000});assert.equal(third.reference,147000);assert.equal(third.amount,140000);
});
test('credits affect remaining money but cannot cancel out the void represented by the visible purchases',()=>{
 const v=walletAt({...current,balance:{amount:145000,available:true},flows:[...flows,{id:'refund',date:'2026-10-03',amountCents:5000}],date:'2026-10-03',expenses:10000});assert.equal(v.reference,155000);assert.equal(v.reference-v.amount,10000);
});
test('pending debit reconstruction respects available versus booked balance and cannot invent unavailable history',()=>{
 const pending={id:'pending',date:'2026-10-03',amountCents:-2000,status:'pending'},options={flows:[...flows,pending],asOf:'2026-10-03',date:'2026-10-02',expenses:3000};
 assert.equal(walletAt({...options,balance:{amount:138000,available:true}}).amount,147000);
 assert.equal(walletAt({...options,balance:{amount:140000,available:false}}).amount,147000);
 assert.equal(walletAt({balance:{amount:100},date:'2026-01-01',asOf:'2026-10-03',expenses:300}),null);
 assert.throws(()=>validateCashflow([{id:'bad',date:'2026-02-30',amountCents:100}]));assert.throws(()=>validateCashflow([flows[0],flows[0]]));
});
test('empty periods are full, negative remaining balances are empty, and invalid expense totals are rejected',()=>{
 assert.equal(walletAt({...current,date:'2026-10-03',expenses:0}).ratio,1);
 assert.equal(walletAt({...current,balance:{amount:-100,available:true},date:'2026-10-03',expenses:200}).ratio,0);
 assert.equal(walletAt({...current,date:'2026-10-03',expenses:-1}),null);
});
