import {validDate,dateKey} from './core.js';
import {bounds} from './periods.js';
export function validateCashflow(rows=[]){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('Historique de solde invalide');
 const seen=new Set();return rows.map(r=>{if(!r||typeof r.id!=='string'||!r.id||r.id.length>180||seen.has(r.id)||!validDate(r.date)||!Number.isSafeInteger(r.amountCents)||!r.amountCents||Math.abs(r.amountCents)>100000000)throw Error('Mouvement de solde invalide');seen.add(r.id);
 return {id:r.id,date:r.date,amountCents:r.amountCents,status:r.status==='pending'?'pending':'booked',label:String(r.label||'').slice(0,200)};});
}
export function walletAt({balance,flows=[],date,mode='day',asOf=dateKey(),expenses=0}){
 if(!balance||!Number.isSafeInteger(balance.amount)||!Number.isSafeInteger(expenses)||expenses<0)return null;
 const end=bounds(date,mode).end,cutoff=end<asOf?end:asOf,eligible=flows.filter(f=>f.date<=asOf&&(f.status!=='pending'||balance.available&&f.amountCents<0));
 if(cutoff<asOf&&(!eligible.length||cutoff<eligible.reduce((d,f)=>f.date<d?f.date:d,asOf)))return null;
 let amount=balance.amount;for(const f of eligible)if(f.date>cutoff)amount-=f.amountCents;
 // The exact visible cloud is the void. Credits affect the remaining balance,
 // never subtract from the expense cloud or define an unrelated fixed capacity.
 const reference=amount+expenses;
 return {amount,reference:reference>0?reference:null,spent:expenses,ratio:reference>0?Math.max(0,Math.min(1,amount/reference)):0,date:cutoff,historical:cutoff<asOf,estimated:cutoff<asOf,overdrawn:Math.max(0,-amount)};
}
