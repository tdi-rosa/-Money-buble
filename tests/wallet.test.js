import test from 'node:test';import assert from 'node:assert/strict';
import {walletAt,validateCashflow} from '../dist/wallet.js';
const flows=validateCashflow([{id:'old',date:'2026-09-30',amountCents:-1000},{id:'salary',date:'2026-10-01',amountCents:200000},{id:'expense',date:'2026-10-02',amountCents:-3900},{id:'refund',date:'2026-10-03',amountCents:5000}]);
const current={balance:{amount:204100,available:true},flows,asOf:'2026-10-03'};
test('30 euros then a 2000 euro income includes the carryover in the tank; expenses and small income only change fill',()=>{
 const before=walletAt({...current,date:'2026-09-30',reference:100000});assert.equal(before.amount,3000);assert.equal(before.reference,100000);
 const funded=walletAt({...current,date:'2026-10-01'});assert.equal(funded.amount,203000);assert.equal(funded.reference,203000);assert.equal(funded.ratio,1);assert.equal(funded.overflow,0);
 const spent=walletAt({...current,date:'2026-10-02'});assert.equal(spent.amount,199100);assert.equal(spent.ratio,199100/203000);
 const refilled=walletAt({...current,date:'2026-10-03'});assert.equal(refilled.reference,203000);assert.equal(refilled.amount,204100);assert.equal(refilled.funding.id,'salary');
});
test('larger income expands the tank only on and after its date, and period views use their end date',()=>{
 const options={...current,balance:{amount:454100,available:true},asOf:'2026-10-09',flows:[...flows,{id:'larger',date:'2026-10-08',amountCents:250000,status:'booked'}]};
 assert.equal(walletAt({...options,date:'2026-10-01',mode:'week'}).reference,203000);
 const month=walletAt({...options,date:'2026-10-01',mode:'month'});assert.equal(month.reference,454100);assert.equal(month.date,'2026-10-09');assert.equal(month.amount,454100);
 assert.equal(walletAt({...options,date:'2026-10-02'}).estimated,true);
});
test('unavailable history is never invented; debt empties fill and pending credits do not expand capacity',()=>{
 assert.equal(walletAt({balance:{amount:100},date:'2026-01-01',asOf:'2026-10-03'}),null);
 const result=walletAt({...current,balance:{amount:-100,available:true},date:'2026-10-03',flows:[...flows,{id:'pending',date:'2026-10-03',amountCents:900000,status:'pending'}]});assert.equal(result.ratio,0);assert.equal(result.reference,200000);
});
test('pending debits affect historic available balance but not historic booked balance',()=>{
 const options={flows:[...flows,{id:'pending',date:'2026-10-03',amountCents:-2000,status:'pending'}],asOf:'2026-10-03',date:'2026-10-02'};
 assert.equal(walletAt({...options,balance:{amount:202100,available:true}}).amount,199100);
 assert.equal(walletAt({...options,balance:{amount:204100,available:false}}).amount,199100);
 assert.throws(()=>validateCashflow([{id:'bad',date:'2026-02-30',amountCents:100}]));
 assert.throws(()=>validateCashflow([flows[0],flows[0]]));
});
test('every expense creates its proportional empty space, including 30 euros from 1500',()=>{
 const options={balance:{amount:147000,available:true},flows:[{id:'income',date:'2026-10-01',amountCents:150000},{id:'purchase',date:'2026-10-02',amountCents:-3000}],asOf:'2026-10-02'};
 const before=walletAt({...options,date:'2026-10-01'}),after=walletAt({...options,date:'2026-10-02'});assert.equal(before.ratio,1);assert.equal(after.reference,150000);assert.equal(after.ratio,.98);
});
