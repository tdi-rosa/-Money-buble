import {purchaseTiming} from './purchase-dates.js';
// Bounded, optional detail lookups; preserve the list record and its identity.
export async function enrichPurchaseDates(rows,getDetails,now=Date.now()){
  const result=rows.map(r=>({...r})),cutoff=new Date(now-7*86400000).toISOString().slice(0,10);
  const candidates=result.filter(r=>r.credit_debit_indicator==='DBIT'&&r.transaction_amount?.currency==='EUR'&&['BOOK','PDNG'].includes(r.status)&&typeof r.transaction_id==='string'&&r.transaction_id.length<=500&&!purchaseTiming(r).date&&(r.booking_date||'')>=cutoff).sort((a,b)=>(b.booking_date||'').localeCompare(a.booking_date||'')).slice(0,6);
  for(let i=0;i<candidates.length;i+=3){await Promise.all(candidates.slice(i,i+3).map(async row=>{try{const details=await getDetails(row.transaction_id);if(!details||typeof details!=='object')return;const timing=purchaseTiming({...details,booking_date:row.booking_date});if(!timing.date)return;row._identity_date=(row.transaction_date||row.booking_date||'').slice(0,10);row.transaction_date=timing.date;}catch(error){if(error.code==='reconnect')throw error;}}))}
  return result;
}
