const button=document.getElementById('updateApp');
const status=document.getElementById('updateStatus');

function setStatus(message){
  if(status){status.textContent=message;status.hidden=!message;}
}

async function waitForInstall(worker){
  if(!worker)return false;
  if(worker.state==='installed')return true;
  return new Promise(resolve=>{
    const done=()=>{
      if(worker.state==='installed'){worker.removeEventListener('statechange',done);resolve(true);}
      else if(worker.state==='redundant'){worker.removeEventListener('statechange',done);resolve(false);}
    };
    worker.addEventListener('statechange',done);
    setTimeout(()=>{worker.removeEventListener('statechange',done);resolve(worker.state==='installed');},10000);
  });
}

async function applyWaiting(registration){
  if(!registration.waiting)return false;
  sessionStorage.setItem('money-bubble-update-view',JSON.stringify({settings:true}));
  registration.waiting.postMessage({type:'SKIP_WAITING'});
  return true;
}

if(button){
  if(!('serviceWorker' in navigator)){
    button.disabled=true;
    setStatus('Mises à jour automatiques non disponibles sur ce navigateur.');
  }else{
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      button.disabled=true;
      const original=button.textContent;
      button.textContent='Recherche…';
      setStatus('Vérification de la dernière version…');
      try{
        const registration=await navigator.serviceWorker.getRegistration();
        if(!registration)throw new Error('Service worker absent');
        if(await applyWaiting(registration)){
          button.textContent='Installation…';
          setStatus('Nouvelle version téléchargée. Redémarrage…');
          return;
        }
        const found=new Promise(resolve=>{
          const handler=()=>{registration.removeEventListener('updatefound',handler);resolve(registration.installing);};
          registration.addEventListener('updatefound',handler);
          setTimeout(()=>{registration.removeEventListener('updatefound',handler);resolve(null);},3500);
        });
        await registration.update();
        const worker=registration.installing||await found;
        if(worker){
          button.textContent='Téléchargement…';
          setStatus('Nouvelle version trouvée…');
          await waitForInstall(worker);
        }
        if(await applyWaiting(registration)){
          button.textContent='Installation…';
          setStatus('Mise à jour prête. Redémarrage…');
          return;
        }
        button.textContent='À jour ✓';
        setStatus('Money Bubble est déjà à jour.');
        setTimeout(()=>{button.textContent=original;button.disabled=false;setStatus('');},1800);
      }catch{
        button.textContent=original;
        button.disabled=false;
        setStatus('Impossible de vérifier la mise à jour. Réessaie avec une connexion internet.');
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());
  }
}
