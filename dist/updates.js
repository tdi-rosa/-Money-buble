// Apply complete, downloaded releases automatically when no interaction is in progress.
export function releaseBusy({bankBusy,pointer,activeElement}){
  const tag=activeElement?.tagName;
  const editing=tag==='TEXTAREA'||tag==='SELECT'||(tag==='INPUT'&&!['checkbox','radio','button','submit'].includes(activeElement.type));
  return !!(bankBusy||pointer||editing);
}
export function autoUpdates(registration,{isBusy,reload,visible=()=>true,hadController,onControllerChange,schedule,checkEvery=60000}){
  let needsReload=false,reloaded=false,applying=false;
  const flush=()=>{
    if(isBusy()||!visible())return;
    if(needsReload&&!reloaded){reloaded=true;reload();return;}
    if(registration.waiting&&!applying){applying=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}
  };
  onControllerChange(()=>{applying=false;if(hadController)needsReload=true;flush();});
  registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){applying=false;flush();}});
  });
  const check=()=>{flush();if(visible())Promise.resolve(registration.update()).catch(()=>{});};
  schedule(flush,1500);
  schedule(check,checkEvery);
  flush();check();
  return {flush,check};
}
