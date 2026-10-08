const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function classifyTransaction(row){
  const text=normalize([row.creditor?.name,...(Array.isArray(row.remittance_information)?row.remittance_information:[]),row.bank_transaction_code?.description].join(' '));
  const codes=[row.bank_transaction_code?.code,row.bank_transaction_code?.sub_code].map(v=>String(v||'').toUpperCase());
  let paymentKind='unknown',paymentBasis='unknown';
  const families=[
    ['direct_debit',['RDDT','DDBT','SDDT'],/\b(prelevement|prlv|prel|direct debit|sepa dd)\b/],
    ['transfer',['ICDT','RCDT','OTHRCT','ESCT'],/\b(virement|vir|transfer|credit transfer)\b/],
    ['card',['CCRD','DCRD','POSD'],/\b(carte|card|cb|paiement carte|facture carte)\b/]
  ];
  for(const [kind,code] of families)if(codes.some(c=>code.includes(c))){paymentKind=kind;paymentBasis='bank';break}
  if(paymentKind==='unknown')for(const [kind,,pattern] of families)if(pattern.test(text)){paymentKind=kind;paymentBasis='label';break}
  const mcc=Number(row.merchant_category_code);
  if(paymentKind==='unknown'&&Number.isInteger(mcc)&&mcc>=1000&&mcc<=9999){paymentKind='card';paymentBasis='mcc'}
  let category='other',categoryBasis='unknown';
  if([5411,5422,5441,5451,5462,5499].includes(mcc))category='food';
  else if([5811,5812,5813,5814].includes(mcc))category='out';
  else if(mcc>=4000&&mcc<4800)category='transport';
  else if(mcc===4900)category='housing';
  else if(mcc>=8000&&mcc<=8099)category='health';
  else if([4814,4816,6300,6513].includes(mcc))category=mcc===6513?'housing':'services';
  else if(mcc>=5000&&mcc<6000)category='shopping';
  if(category!=='other')categoryBasis='mcc';
  else for(const [key,pattern] of [
    ['out',/\b(uber eats|deliveroo|restaurant|resto|cafe|coffee|starbucks|bar|brasserie|burger|mcdonald|pizzeria)\b/],
    ['food',/\b(bio c bon|biocoop|naturalia|carrefour|monoprix|franprix|lidl|aldi|auchan|intermarche|supermarche|epicerie|boulangerie|picard|leclerc)\b/],
    ['transport',/\b(sncf|ratp|navigo|metro|velib|bolt|uber|trainline|flixbus|blablacar|transport|parking|essence)\b/],
    ['housing',/\b(loyer|rent|edf|engie|electricite|gaz|eau|charges|bailleur)\b/],
    ['health',/\b(pharmacie|pharmacy|doctolib|medecin|dentiste|hopital|opticien|mutuelle)\b/],
    ['services',/\b(netflix|spotify|orange|sfr|bouygues|free mobile|free telecom|abonnement|assurance|adobe|ovh)\b/],
    ['shopping',/\b(amazon|fnac|darty|decathlon|ikea|librairie|vinted|zalando|uniqlo|h m|zara)\b/]
  ]){if(pattern.test(text)){category=key;categoryBasis='label';break}}
  return {category,categoryBasis,paymentKind,paymentBasis};
}
