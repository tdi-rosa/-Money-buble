import test from 'node:test';
import assert from 'node:assert/strict';
import {bankSnapshot} from '../dist/bank-state.js';
const now=Date.parse('2026-10-08T08:00:00Z');
const input={version:1,transactions:[{id:'bank-1',date:'2026-10-07',merchant:'Marché',amountCents:1280,category:'food',status:'pending',dateBasis:'transaction'}],balance:{amount:84230,available:true,type:'ITAV',asOf:null},accountId:'account-1',updatedAt:'2026-10-08T07:00:00Z'};
test('last bank display survives a close and reopen without storing credentials',()=>{const saved=bankSnapshot({...input,session_id:'secret',token:'secret',url:'secret'},now);const reopened=bankSnapshot(JSON.parse(JSON.stringify(saved)),now+3600000);assert.deepEqual(reopened,input);assert.equal(JSON.stringify(reopened).includes('secret'),false);assert.equal(reopened.transactions[0].status,'pending')});
test('corrupt, future and expired bank display snapshots are rejected',()=>{assert.equal(bankSnapshot({...input,updatedAt:'bad'},now),null);assert.equal(bankSnapshot({...input,updatedAt:'2026-10-09T00:00:00Z'},now),null);assert.equal(bankSnapshot(input,now+8*86400000),null);assert.equal(bankSnapshot({...input,balance:{amount:'842.30',available:true}},now),null);assert.equal(bankSnapshot({...input,transactions:[{...input.transactions[0],amountCents:-1}]},now),null)});
test('a valid empty bank history remains empty instead of generating demonstration purchases',()=>{assert.deepEqual(bankSnapshot({...input,transactions:[],balance:null},now).transactions,[])});
