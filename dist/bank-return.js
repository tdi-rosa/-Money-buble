import {notifyBankReturn} from './bank-window.js';
const result=new URL(location.href).searchParams.get('bank');
history.replaceState(null,'',location.pathname);
const connected=result==='connected';
document.getElementById('title').textContent=connected?'BNP connecté':'Connexion interrompue';
document.getElementById('status').textContent=connected?'Reviens dans Money Bubble avec l’icône du téléphone. Tes dépenses se synchronisent au retour.':'Reviens dans Money Bubble pour réessayer la connexion.';
notifyBankReturn(result,{storage:localStorage,channel:name=>new BroadcastChannel(name)});
document.getElementById('close').onclick=()=>{window.close();setTimeout(()=>{document.getElementById('status').textContent='Ferme cet onglet puis touche l’icône Money Bubble sur ton téléphone.'},250)};
// Script-opened tabs may close automatically. Other browsers retain this clear return screen.
if(connected)setTimeout(()=>window.close(),800);
