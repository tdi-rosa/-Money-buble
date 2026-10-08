// Keep the installed app alive. Never replace it with a bank authentication page.
export function openBankWindow(open, origin){
  const popup=open(new URL('/bank-connect.html',origin).href,'_blank');
  if(popup)popup.opener=null;
  return !!popup;
}
export function notifyBankReturn(result, {storage, channel}){
  const message={type:'bank-return',result:result==='connected'?'connected':'failed',at:Date.now()};
  try{storage.setItem('money-bubble-bank-return',JSON.stringify(message))}catch{}
  try{const c=channel('money-bubble-bank');c.postMessage(message);c.close()}catch{}
}
