import {validDate,dateKey} from './core.js';
import {bounds} from './periods.js';
export function validateCashflow(rows=[]){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('Historique de solde invalide');
 const seen=new Set();return rows.map(r=>{if(!r||typeof r.id!=='string'||!r.id||r.id.length>180||seen.has(r.id)||!validDate(r.date)||!Number.isSafeInteger(r.amountCents)||!r.amountCents||Math.abs(r.amountCents)>100000000)throw Error('Mouvement de solde invalide');seen.add(r.id);
 return {id:r.id,date:r.date,amountCents:r.amountCents,status:r.status==='pending'?'pending':'booked',label:String(r.label||'').slice(0,200)};});
}
export function walletAt({balance,flows=[],date,mode='day',asOf=dateKey(),reference=null}){
 if(!balance||!Number.isSafeInteger(balance.amount))return null;
 const end=bounds(date,mode).end,cutoff=end<asOf?end:asOf,eligible=flows.filter(f=>f.date<=asOf&&(f.status!=='pending'||balance.available&&f.amountCents<0));
 if(cutoff<asOf&&(!eligible.length||cutoff<eligible.reduce((d,f)=>f.date<d?f.date:d,asOf)))return null;
 let amount=balance.amount;for(const f of eligible)if(f.date>cutoff)amount-=f.amountCents;
 let capacity=0,funding=null;
 for(const f of [...eligible].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)))if(f.date<=cutoff&&f.amountCents>0&&f.status!=='pending'&&f.amountCents>=capacity){capacity=f.amountCents;funding=f;}
 if(!capacity)capacity=Number.isSafeInteger(reference)&&reference>0?reference:null;
 return {amount,reference:capacity,ratio:capacity?Math.max(0,Math.min(1,amount/capacity)):null,date:cutoff,historical:cutoff<asOf,estimated:cutoff<asOf,funding,overflow:capacity?Math.max(0,amount-capacity):0};
}
