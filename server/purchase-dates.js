function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
function bankDate(value){return typeof value==='string'&&validDate(value.slice(0,10))?value.slice(0,10):null}
export function purchaseTiming(row){
  const bookingDate=bankDate(row.booking_date),transactionDate=bankDate(row.transaction_date);
  if(transactionDate)return {date:transactionDate,bookingDate,dateBasis:'transaction'};
  // Only explicit card-payment dates; never arbitrary numbers, value dates or receipt time.
  const label=[...(Array.isArray(row.remittance_information)?row.remittance_information:[]),row.bank_transaction_code?.description||''].join(' ').toUpperCase();
  const matches=[...label.matchAll(/\b(?:FACTURE\s+CARTE|PAIEMENT\s+(?:PAR\s+)?(?:CARTE|CB)|ACHAT\s+(?:CARTE|CB))\b[^\n]{0,60}?\b(?:DU|LE)\s+(\d{2})(?:[/.\-]?(\d{2}))(?:[/.\-]?(\d{4}|\d{2}))\b/g)];
  const dates=[...new Set(matches.map(m=>`${m[3].length===2?'20'+m[3]:m[3]}-${m[2]}-${m[1]}`).filter(validDate))];
  if(dates.length===1){const date=dates[0],reference=bookingDate||new Date().toISOString().slice(0,10),lag=(Date.parse(reference)-Date.parse(date))/86400000;if(lag>=0&&lag<=370)return {date,bookingDate,dateBasis:'label'}}
  return {date:null,bookingDate,dateBasis:'unknown'};
}
