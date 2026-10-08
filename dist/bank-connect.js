const status=document.getElementById('status'),retry=document.getElementById('retry');
async function connect(){retry.hidden=true;status.textContent='Ouverture sécurisée…';try{
  const response=await fetch('/api/bank/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'});
  const result=await response.json();if(!response.ok)throw Error();
  const url=new URL(result.url);if(url.protocol!=='https:'||!(url.hostname==='enablebanking.com'||url.hostname.endsWith('.enablebanking.com')))throw Error();
  // Only this temporary window leaves Money Bubble; the installed app remains open.
  location.replace(url.href);
}catch{status.textContent='Connexion indisponible. Réessaie depuis cette page.';retry.hidden=false}}
retry.onclick=connect;connect();
