import test from 'node:test';
import assert from 'node:assert/strict';
import {validateImport,pack,shiftDate,validDate,demoData} from '../dist/core.js';
const tx=(id,amountCents)=>({id,date:'2026-10-07',merchant:'Commerce',amountCents,category:'food'});
test('centimes entiers positifs et identifiants uniques',()=>{assert.equal(validateImport({version:1,transactions:[tx('a',1250)]})[0].amountCents,1250);for(const amount of [0,-1,NaN,1.5,'1250'])assert.throws(()=>validateImport({version:1,transactions:[tx('a',amount)]}));assert.throws(()=>validateImport({version:1,transactions:[tx('a',100),tx('a',200)]}));assert.throws(()=>validateImport({version:1,transactions:[{...tx('a',100),category:'toString'}]}))});
test('dates réelles, transitions de mois et années bissextiles',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(shiftDate('2026-03-01',-1),'2026-02-28')});
test('les surfaces suivent les montants et les bulles ne se recouvrent pas',()=>{const p=pack([tx('a',100),tx('b',10000),tx('c',500)]);const a=p.find(t=>t.id==='a'),b=p.find(t=>t.id==='b');assert.ok(Math.abs((b.r*b.r)/(a.r*a.r)-100)<1e-9);for(let i=0;i<p.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(p[i].x-p[j].x,p[i].y-p[j].y)>=p[i].r+p[j].r+2.99)});
test('les exemples sont valides et limités à sept jours',()=>{const items=validateImport({version:1,transactions:demoData('2026-10-07')});assert.equal(new Set(items.map(t=>t.date)).size,7)});
