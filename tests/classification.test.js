import test from 'node:test';import assert from 'node:assert/strict';import {classifyTransaction} from '../server/classification.js';
test('MCC is preferred, French labels are normalized, similar merchants remain distinct',()=>{
 assert.equal(classifyTransaction({merchant_category_code:'5411',creditor:{name:'Amazon'}}).category,'food');
 for(const [name,category] of [['BIO C’ BON PARIS','food'],['UBER EATS','out'],['UBER PARIS','transport'],['PRÉLÈVEMENT EDF','housing'],['PHARMACIE','health'],['NETFLIX','services']])assert.equal(classifyTransaction({creditor:{name}}).category,category);
 assert.equal(classifyTransaction({creditor:{name:'INCONNU'}}).category,'other');
});
test('payment family is separate from expense category; missing evidence stays unknown',()=>{
 assert.equal(classifyTransaction({bank_transaction_code:{code:'RDDT'},creditor:{name:'Netflix'}}).paymentKind,'direct_debit');
 assert.equal(classifyTransaction({remittance_information:['VIR SEPA LOYER']}).paymentKind,'transfer');
 assert.equal(classifyTransaction({remittance_information:['FACTURE CARTE 071026']}).paymentKind,'card');
 assert.equal(classifyTransaction({creditor:{name:'Carrefour'}}).paymentKind,'unknown');
});
