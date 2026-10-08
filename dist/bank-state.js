import {validateImport} from './core.js';
// A device-local snapshot is display data, never an authorization credential.
export function bankSnapshot(input,now=Date.now()){
  try{
    if(!input||!Number.isFinite(Date.parse(input.updatedAt))||Date.parse(input.updatedAt)>now+60000||now-Date.parse(input.updatedAt)>7*86400000)return null;
    const transactions=validateImport(input).map(t=>t.dateBasis==='booking'?{...t,bookingDate:t.bookingDate||t.date,date:null,dateBasis:'unknown'}:t);
    const balance=input.balance===null?null:input.balance;
    if(balance!==null&&(!balance||!Number.isSafeInteger(balance.amount)||Math.abs(balance.amount)>100000000||typeof balance.available!=='boolean'))return null;
    if(typeof input.accountId!=='string'||input.accountId.length>160)return null;
    return {version:1,transactions,balance:balance?{amount:balance.amount,available:balance.available,type:String(balance.type||'').slice(0,8),asOf:balance.asOf||null}:null,accountId:input.accountId,updatedAt:input.updatedAt};
  }catch{return null}
}
