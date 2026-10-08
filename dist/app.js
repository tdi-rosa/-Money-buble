import {ownsSimulationFrame,targetCloudRadius,projectCameraPoint,reprojectDeparture} from './simulation-state.js';
import {FluidGauge} from './fluid-gauge.js';
import {hitRenderedBubbles} from './bubble-layout.js';
import {GestureSession} from './gestures.js';
import {openBankWindow} from './bank-window.js';
import {walletAt,validateCashflow} from './wallet.js';
import {bankSnapshot} from './bank-state.js';
import {categories,paymentKinds,paymentColor,merchantKey,euro,dateKey,shiftDate,validateImport,demoData,validDate,mergePurchaseDates,displayPurchaseDates} from './core.js';
import {BubbleField} from './physics.js';
import {autoUpdates,releaseBusy} from './updates.js';
import {bounds,navigate,groupTransactions,sum} from './periods.js';
const $=id=>document.getElementById(id),today=dateKey(),field=new BubbleField(),canvas=$('canvas'),ctx=canvas.getContext('2d'),stage=$('stage'),liquid=new FluidGauge($('gauge'));
const keys={tx:'bulles-transactions-v1',notes:'bulles-reflections-v1',balance:'money-bubble-balance-v1',prefs:'money-bubble-prefs-v1',bank:'money-bubble-bank-display-v1',linked:'money-bubble-bank-linked-v1',merchantRules:'money-bubble-merchant-rules-v1'};let bankActive=false,bankFresh=false,bankConnecting=false,bankChecking=false,bankBusy=false,bankBalance=null,bankAccounts=[],bankAccountId=null,bankLastSync=0,bankUpdatedAt=null;let data=[],cashflow=[],walletView=null,demo=true,notes={},balance=null,prefs={motion:matchMedia('(prefers-reduced-motion: reduce)').matches,privacy:false,haptics:false},mode='day',selected=today,scene=null,groups=[],pointer=null,raf=0,last=0,accumulator=0,w=400,h=400,activeTransaction=null,installPrompt=null,hiddenWarning=false;
function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('Stockage indisponible. Les changements ne seront pas conservés.');return false}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500)}
function buildDemo(){const list=[];for(let i=-44;i<=0;i++){const day=shiftDate(today,i);if(i!==0&&Math.abs(i)%8===0)continue;for(const t of demoData(day).filter(t=>t.date===day)){if(i!==0&&t.id.endsWith('-4')&&Math.abs(i)%3!==0)continue;list.push({...t,amountCents:t.amountCents+Math.abs(i)%5*35});}}return list}
const snapshot=bankSnapshot(read(keys.bank,null));
const hadBank=read(keys.linked,false)===true;
if(snapshot){data=snapshot.transactions;cashflow=snapshot.cashflow||[];bankBalance=snapshot.balance;bankAccountId=snapshot.accountId;bankUpdatedAt=snapshot.updatedAt;bankActive=true;demo=false}else if(hadBank){data=[];bankActive=true;demo=false;try{localStorage.removeItem(keys.bank)}catch{}}else{const stored=read(keys.tx,null);try{if(stored){data=validateImport(stored);cashflow=validateCashflow(stored.cashflow||[]);demo=false}else data=buildDemo()}catch{data=buildDemo();toast('Import local illisible : démonstration affichée.')}}
const oldNotes=read(keys.notes,{});if(oldNotes&&typeof oldNotes==='object'&&!Array.isArray(oldNotes))notes=oldNotes;const savedPrefs=read(keys.prefs,{});for(const k of Object.keys(prefs))if(typeof savedPrefs?.[k]==='boolean')prefs[k]=savedPrefs[k];const savedBalance=read(keys.balance,null);if(savedBalance&&Number.isSafeInteger(savedBalance.amount)&&Math.abs(savedBalance.amount)<=100000000)balance=savedBalance;
const merchantRules=read(keys.merchantRules,{});
const categoryKey=t=>notes[t.id]?.category||(Object.hasOwn(categories,merchantRules?.[merchantKey(t.merchant)])?merchantRules[merchantKey(t.merchant)]:t.category),bubbleColor=paymentColor;
const amount=n=>prefs.privacy?'••• €':euro(n),cat=t=>categories[categoryKey(t)]||categories.other,dateFmt=(d,opts)=>new Intl.DateTimeFormat('fr-FR',{...opts,timeZone:'Europe/Paris'}).format(new Date(d+'T12:00:00Z'));
function title(){const {start,end}=bounds(selected,mode);if(mode==='day'){$('periodTitle').textContent=selected===today?"Aujourd'hui":dateFmt(selected,{weekday:'long'});$('periodSubtitle').textContent=dateFmt(selected,{day:'numeric',month:'long',year: 'numeric'})}else if(mode==='week'){$('periodTitle').textContent=start.slice(0,7)===end.slice(0,7)?`${Number(start.slice(-2))} – ${dateFmt(end,{day:'numeric',month:'short'})}`:`${dateFmt(start,{day:'numeric',month:'short'})} – ${dateFmt(end,{day:'numeric',month:'short'})}`;$('periodSubtitle').textContent='une semaine'}else{$('periodTitle').textContent=dateFmt(selected,{month:'long'});$('periodSubtitle').textContent=selected.slice(0,4)}$('datePicker').value=selected;$('backToday').hidden=bounds(today,mode).start===start;}
const layoutWorker=new Worker(new URL('./layout-worker.js',import.meta.url),{type:'module'});
let layoutRevision=0,pendingNavigation=null,layoutPayload=null,lastLayoutData=null,lastLayoutSize='',transactionsById=new Map(),levelFit={day:1,week:.5,month:.25};
const previews=new Map(),layouts=new Map(),bodyPool=new Map();
const simulationWorker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
let simulationRevision=0,simulationBodies=null,simulationPositions=null,simulationArrivals=null,simulationCamera=null,simulationRunning=false;
simulationWorker.onmessage=({data:result})=>{if(ownsSimulationFrame(result,simulationRevision,simulationBodies,field.bodies,simulationRunning)){simulationPositions=result.positions;simulationCamera=result.camera;simulationArrivals=result.arrivals;field.time=result.time??field.time;field.regroupUntil=result.regroupUntil??field.regroupUntil;wake();}};
function simulate(elapsed,scale,organic,camera){
  if(field.bodies.length<=60){if(simulationRunning){simulationWorker.postMessage({running:false});simulationRunning=false;}return field.stepLive(elapsed,{pixelScale:scale,organic,camera});}
  const message={running:true,options:{pixelScale:scale,organic,camera},dragId:field.dragId,dragTarget:field.dragTarget};
  if(simulationBodies!==field.bodies){simulationBodies=field.bodies;simulationPositions=simulationArrivals=null;message.revision=++simulationRevision;message.time=field.time||0;message.regroupUntil=field.regroupUntil||0;
    message.bodies=field.bodies.map(({id,x,y,vx,vy,r,targetR,tx,ty,motionX,motionY,alpha,inPeriod,cluster,centerX,centerY,collisionGap,phase,arriving,gatheringUntil,gatherRadius,departing,departureView,travelSpeed})=>({id,x,y,vx,vy,r,targetR,tx,ty,motionX,motionY,alpha,inPeriod,cluster,centerX,centerY,collisionGap,phase,arriving,gatheringUntil,gatherRadius,departing,departureView,travelSpeed}));}
  simulationWorker.postMessage(message);simulationRunning=true;
  if(simulationPositions){const follow=1-Math.exp(-20*elapsed);for(let i=0;i<field.bodies.length;i++){
    const b=field.bodies[i],raw={x:simulationPositions[i*4],y:simulationPositions[i*4+1]},p=b.departing?projectCameraPoint(raw,simulationCamera,camera):raw,velocityScale=b.departing&&simulationCamera?simulationCamera.scale/camera.scale:1;
    b.x+=(p.x-b.x)*follow;b.y+=(p.y-b.y)*follow;b.vx=simulationPositions[i*4+2]*velocityScale;b.vy=simulationPositions[i*4+3]*velocityScale;if(simulationArrivals)b.arriving=!!simulationArrivals[i];
  }}
  return true;
}
function pauseSimulation(){if(simulationRunning){simulationWorker.postMessage({running:false});simulationRunning=false;simulationBodies=null;}}
function receiveLayout(result){
  if(result.id!==layoutRevision)return;
  if(!result.error)result.specs=result.specs.map(s=>({...s,transaction:transactionsById.get(s.id)||s.transaction,color:bubbleColor(transactionsById.get(s.id)||s.transaction)}));
  if(result.preview){if(!result.error){layouts.set(result.preview,result);if(result.preview.startsWith(mode+':'))previews.set(result.preview.slice(mode.length+1),makePreview(result));}if(dragScene)wake();return;}
  if(result.error){toast('Impossible de calculer les bulles. Réouvre l’application.');return;}
  levelFit=result.fitByMode||levelFit;layouts.set(mode+':'+selected,result);
  const navigation=pendingNavigation,gatherRadius=targetCloudRadius(result.specs,w,h);pendingNavigation=null;
  if(navigation||prefs.motion){field.bodies=result.specs.map((s,i)=>{let b=bodyPool.get(s.id)||{};Object.assign(b,s,{x:s.tx,y:s.ty,motionX:s.tx,motionY:s.ty,vx:0,vy:0,phase:i*2.3999632297,retired:false,gatheringUntil:0,gatherRadius,departureView:null,arriving:false,departing:false,travelSpeed:450,r:s.targetR,alpha:1,amountText:amount(s.transaction.amountCents)});bodyPool.set(s.id,b);return b;});fitZoom=fitTarget=result.fitZoom;field.regroupUntil=0;join=null;if(navigation)slide={...navigation,progress:0};}
  else beginJoin(result,gatherRadius);
  if(layoutPayload){
    const requests=[{mode,date:navigate(selected,mode,-1)},{mode,date:navigate(selected,mode,1)},...modes.filter(m=>m!==mode).map(mode=>({mode,date:selected}))];
    for(const options of requests){const key=options.mode+':'+options.date;if(layouts.has(key)){if(options.mode===mode)previews.set(options.date,makePreview(layouts.get(key)));continue;}layoutWorker.postMessage({id:layoutRevision,preview:key,options:{...layoutPayload.options,...options}});}
  }wake();
}
function makePreview(result){return {fitZoom:result.fitZoom,specs:result.specs,bodies:result.specs.map(b=>({...b,x:w/2+(b.tx-w/2)*result.fitZoom,y:h/2+(b.ty-h/2)*result.fitZoom,r:b.targetR*result.fitZoom,alpha:1,amountText:amount(b.transaction.amountCents)}))};}
layoutWorker.onmessage=({data:result})=>receiveLayout(result);
layoutWorker.onerror=()=>toast('Le calcul des bulles n’a pas pu démarrer. Réouvre l’application.');
function refresh(){previews.clear();title();const displayed=displayPurchaseDates(data),undated=displayed.filter(t=>!validDate(t.date));$('undatedButton').hidden=!undated.length;$('undatedButton').textContent=undated.length+' achat'+(undated.length>1?'s':'')+' sans date d’achat';scene=groupTransactions(displayed,selected,mode);stage.style.minHeight='240px';$('spent').textContent=bankActive&&!scene.visible.length?'—':amount(sum(scene.visible));$('spentButton').setAttribute('aria-label',`${bankActive&&!scene.visible.length?'Aucun achat daté pour cette période':prefs.privacy?'Montant masqué':euro(sum(scene.visible))}. ${scene.visible.length} dépenses. Ouvrir la liste`);$('pendingBadge').hidden=!scene.visible.some(t=>t.status==='pending');$('estimatedBadge').hidden=!scene.visible.some(t=>t.dateBasis==='estimated');$('empty').hidden=scene.visible.length!==0;$('empty').querySelector('p').textContent=bankActive?(undated.length?'La banque n’a pas fourni la date de certains achats.':'Aucune opération reçue. Les paiements peuvent arriver plus tard.'):"Rien ici, pour l’instant.";$('sourceBadge').textContent=bankActive?(bankFresh?'BNP':'BNP · dernière synchro'):demo?'démo':'local';$('groupLabels').replaceChildren();
  transactionsById=new Map(displayed.map(t=>[t.id,t]));
  const size=w+':'+h,changed=lastLayoutData!==data||lastLayoutSize!==size;
  if(changed){layouts.clear();lastLayoutData=data;lastLayoutSize=size;}
  layoutPayload={id:++layoutRevision,options:{mode,date:selected,width:w,height:h}};
  const cached=layouts.get(mode+':'+selected);
  if(cached&&!changed)receiveLayout({...cached,id:layoutRevision,preview:undefined});
  else layoutWorker.postMessage({...layoutPayload,...(changed?{items:displayed.filter(t=>validDate(t.date)).map(t=>({id:t.id,date:t.date,amountCents:t.amountCents}))}:{})});
  updateWallet();syncPrefs();wake();
}
const modes=['day','week','month'],gestures=new GestureSession();
let join=null,fitZoom=1,fitTarget=1,slide=null,dragScene=null,swipeOffset=0,returningSwipe=false,pan=0,panTarget=0,panY=0,panYTarget=0,zoom=1,zoomTarget=1,pinch=null,cameraSettlingUntil=0,cameraX=w/2,cameraY=h/2;
let renderedRegions=[],bubbleDrag=null;
function releaseBubble(){field.dragId=null;field.dragTarget=null;bubbleDrag=null;}
function view(){return {mode,width:w,height:h,zoom:zoomTarget,pan:panTarget+(w/2-cameraX)*zoom*fitZoom,panY:panYTarget+(h/2-cameraY)*zoom*fitZoom};}
function inputState(){pointer=gestures.pointer;pinch=gestures.pinch;}
function paintedHit(e){return hitRenderedBubbles(renderedRegions,e,canvas.getBoundingClientRect(),canvas)}
function screenSnapshot(){
  if(dragScene)return dragScene.map(b=>({...b,x:b.x+swipeOffset}));
  if(pendingNavigation)return pendingNavigation.bodies.map(b=>({...b}));
  const circles=new Map(),ratio=canvas.width/w;
  for(const r of renderedRegions)circles.set(r.body.id,{...r.body,x:r.x/ratio,y:r.y/(canvas.height/h),r:r.r/ratio,alpha:1});
  return [...circles.values()];
}
function beginJoin(result,gatherRadius){
  const previousActive=field.bodies.filter(b=>b.inPeriod!==false).length,previous=new Map(field.bodies.map(b=>[b.id,b])),active=new Set(result.specs.map(s=>s.id)),leaving=[];
  const bodies=result.specs.map((s,i)=>{
    const old=previous.get(s.id),b=old||bodyPool.get(s.id)||{};
    let x=old?.x,y=old?.y;
    if(!old){const angle=i*2.3999632297,dx=s.tx-w/2,dy=s.ty-h/2,length=Math.hypot(dx,dy),reach=Math.max(w,h)/Math.max(.05,fitZoom)+s.targetR*2;
      x=w/2+(length>1?dx/length:Math.cos(angle))*reach;y=h/2+(length>1?dy/length:Math.sin(angle))*reach;
      if(!previous.size){x=s.tx+Math.cos(angle)*Math.min(14,s.targetR*.25);y=s.ty+Math.sin(angle)*Math.min(14,s.targetR*.25);}
    }
    Object.assign(b,s,{x,y,motionX:s.tx,motionY:s.ty,r:s.targetR,alpha:1,retired:false,gatherRadius,departureView:null,gatheringUntil:(field.time||0)+(previous.size ? .85 : 0),arriving:!!previous.size&&(!old||old.departing),departing:false,travelSpeed:450,vx:b.vx||0,vy:b.vy||0,phase:i*2.3999632297,amountText:amount(s.transaction.amountCents)});bodyPool.set(s.id,b);return b;
  });
  for(const b of previous.values())if(!active.has(b.id)){
    const dx=b.x-w/2,dy=b.y-h/2,length=Math.hypot(dx,dy)||1,reach=Math.max(w,h)/Math.max(.05,fitZoom)+b.r*2;
    b.motionX=w/2+(dx||1)/length*reach;b.motionY=h/2+dy/length*reach;b.inPeriod=false;b.departing=true;b.departureView={scale:zoom*fitZoom,cameraX,cameraY,panX:pan,panY,width:w,height:h};b.travelSpeed=450;leaving.push(b);
  }
  field.bodies=[...bodies,...leaving];field.regroupUntil=(field.time||0)+.85;field.settled=false;fitTarget=result.fitZoom;
  join={progress:0,fromFit:fitZoom,toFit:fitTarget,duration:.85,contract:result.specs.length<previousActive};
}
function adoptScreen(){
  // Freeze the present frame without changing the canonical circle geometry.
  // Only swipes need a bitmap-space snapshot; mode changes preserve world space.
  releaseBubble();join=null;slide=pendingNavigation=dragScene=null;swipeOffset=0;returningSwipe=false;
}
function changeMode(m,{fromPinch=false}={}){
  if(mode===m)return;adoptScreen();mode=m;
  fitZoom*=zoom;zoom=zoomTarget=1;panTarget=panYTarget=0;cameraSettlingUntil=performance.now()+220;
  if(!fromPinch){gestures.reset();inputState();}
  animateHeader();for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b.dataset.mode===m?'true':'false');
  $('modeIndicator').style.transform=`translateX(${modes.indexOf(m)*100}%)`;refresh();
}
$('recenter').onclick=()=>{panTarget=panYTarget=0;zoomTarget=1;cameraSettlingUntil=performance.now()+240;wake();};
function animateHeader(){if(prefs.motion)return;for(const id of ['dateButton','spentButton']){const el=$(id);for(const a of el.getAnimations())a.cancel();el.animate([{opacity:.65},{opacity:1}],{duration:180,easing:'ease-out'});}}
function goTo(date,direction=1){
  if(date===selected)return;
  const bodies=screenSnapshot(),preview=previews.get(date),startOffset=direction*w+(dragScene?swipeOffset:0);slide=null;dragScene=null;swipeOffset=0;returningSwipe=false;
  pendingNavigation=prefs.motion?null:{bodies,direction,startOffset,incoming:preview?.bodies};
  selected=date;pan=panTarget=panY=panYTarget=0;zoom=zoomTarget=1;cameraX=w/2;cameraY=h/2;
  refresh();animateHeader();haptic();dismissHint();
}
function travel(direction){goTo(navigate(selected,mode,direction),direction);}
function paintBodies(bodies,{offset=0,screen=false}={}){
  const scale=screen?1:zoom*fitZoom,px=screen?0:pan+(w/2-cameraX)*scale,py=screen?0:panY+(h/2-cameraY)*scale;
  ctx.save();ctx.translate(w/2+offset+px,h/2+py);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);
  const m=ctx.getTransform();
  for(const b of bodies){
    const x=w/2+offset+px+(b.x-w/2)*scale,y=h/2+py+(b.y-h/2)*scale,r=b.r*scale;
    if(b.alpha<.01||x+r<0||x-r>w||y+r<0||y-r>h)continue;
    ctx.globalAlpha=b.alpha;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,Math.max(0,b.r),0,Math.PI*2);ctx.fill();
    renderedRegions.push({body:b,x:m.a*b.x+m.c*b.y+m.e,y:m.b*b.x+m.d*b.y+m.f,r:Math.hypot(m.a,m.b)*b.r});
    if(r>=23){ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';const t=b.transaction;
      ctx.font=`500 ${Math.min(22/scale,b.r*.32)}px system-ui`;ctx.fillText(b.amountText??amount(t.amountCents),b.x,b.y-(r>65?5/scale:0));
      if(r>65){ctx.font=`400 ${Math.min(12/scale,b.r*.16)}px system-ui`;const name=t.merchant.length>16?t.merchant.slice(0,14)+'…':t.merchant;ctx.fillText(name,b.x,b.y+18/scale);}
    }
  }ctx.restore();
}
function draw(){
  renderedRegions=[];ctx.clearRect(0,0,w,h);
  if(dragScene){paintBodies(dragScene,{offset:swipeOffset,screen:true});const direction=swipeOffset<0?1:-1,preview=previews.get(navigate(selected,mode,direction));if(preview)paintBodies(preview.bodies,{offset:direction*w+swipeOffset,screen:true});$('empty').style.transform=`translateX(${swipeOffset}px)`;return;}
  if(pendingNavigation){paintBodies(pendingNavigation.bodies,{screen:true});if(pendingNavigation.incoming)paintBodies(pendingNavigation.incoming,{offset:pendingNavigation.startOffset,screen:true});return;}
  let offset=0;
  if(slide){const e=1-Math.pow(1-slide.progress,3);offset=(slide.startOffset??slide.direction*w)*(1-e);paintBodies(slide.bodies,{offset:-(slide.startOffset??slide.direction*w)*e,screen:true});}
  paintBodies(field.bodies,{offset});$('empty').style.transform=`translateX(${offset+pan}px)`;
}
function frame(timestamp){
  raf=0;if(document.hidden)return;const elapsed=last?Math.min(.05,(timestamp-last)/1000):1/60;last=timestamp;
  if(returningSwipe){swipeOffset*=Math.exp(-25*elapsed);if(Math.abs(swipeOffset)<.1){swipeOffset=0;adoptScreen();refresh();}}
  if(slide){slide.progress=Math.min(1,slide.progress+elapsed/.28);if(slide.progress===1)slide=null;}
  const direct=(pointer||pinch)&&timestamp>=cameraSettlingUntil,ease=prefs.motion||direct?1:1-Math.exp(-24*elapsed);
  pan+=(panTarget-pan)*ease;panY+=(panYTarget-panY)*ease;zoom+=(zoomTarget-zoom)*ease;
  if(join&&!dragScene&&!pendingNavigation){
    join.progress=Math.min(1,join.progress+elapsed/join.duration);const t=1-Math.pow(1-join.progress,3);
    // Only the camera interpolates. Body positions come from springs and contacts.
    const destination=join.toFit;
    if(!join.contract)fitZoom=1/((1/join.fromFit)*(1-t)+(1/destination)*t);
    if(join.progress===1)join=null;
  }
  // Crop the retained physical cloud immediately, even while departures remain.
  if((!join||join.contract)&&!bubbleDrag&&!pointer&&!pinch&&!dragScene&&!slide&&!pendingNavigation){
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const b of field.bodies){if(!b.inPeriod)continue;left=Math.min(left,b.x-b.r);right=Math.max(right,b.x+b.r);top=Math.min(top,b.y-b.r);bottom=Math.max(bottom,b.y+b.r);}
    if(Number.isFinite(left)){const follow=1-Math.exp(-7*elapsed),cx=join?w/2:(left+right)/2,cy=join?h/2:(top+bottom)/2;
      cameraX+=(cx-cameraX)*follow;cameraY+=(cy-cameraY)*follow;
      const spanX=2*Math.max(right-cameraX,cameraX-left)+12,spanY=2*Math.max(bottom-cameraY,cameraY-top)+12,cropped=Math.min(6,Math.max(1,w-40)/spanX,Math.max(1,h-48)/spanY);
      fitZoom+=(cropped-fitZoom)*follow;}
  }
  const scale=Math.max(.01,zoom*fitZoom),camera={scale,cameraX,cameraY,panX:pan,panY,width:w,height:h};
  for(const b of field.bodies)reprojectDeparture(b,camera);
  const physical=field.bodies.length>0&&!dragScene&&!pendingNavigation&&!slide&&simulate(elapsed,scale,!prefs.motion&&!join,camera);
  if(!physical)pauseSimulation();
  if(!join){const active=field.bodies.filter(b=>b.inPeriod||Math.abs(b.x-cameraX)*scale<w/2+b.r*scale&&Math.abs(b.y-cameraY)*scale<h/2+b.r*scale);if(active.length!==field.bodies.length)field.bodies=active;}

  draw();$('recenter').hidden=Math.abs(zoomTarget-1)<=.04&&Math.abs(panTarget)<2&&Math.abs(panYTarget)<2;
  if(physical||returningSwipe||slide||(join&&!dragScene&&!pendingNavigation)||Math.abs(pan-panTarget)>.05||Math.abs(panY-panYTarget)>.05||Math.abs(zoom-zoomTarget)>.001)raf=requestAnimationFrame(frame);
}
function wake(){if(!raf&&!document.hidden){last=0;raf=requestAnimationFrame(frame)}}
function resize(){const r=stage.getBoundingClientRect(),oldW=w,oldH=h;if(canvas.width&&Math.abs(w-r.width)<.5&&Math.abs(h-r.height)<.5)return;
  w=r.width;h=r.height;const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
  for(const b of field.bodies){b.x*=w/oldW;b.y*=h/oldH;b.departureView=null}cameraX=w/2;cameraY=h/2;field.resize(w,h);refresh();
}
new ResizeObserver(resize).observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseSimulation();releaseBubble();if(raf)cancelAnimationFrame(raf);raf=0;gestures.reset();inputState();dragScene=null;swipeOffset=0;panTarget=panYTarget=0;zoomTarget=1;}else wake()});
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*w/Math.max(1,r.width),y:(e.clientY-r.top)*h/Math.max(1,r.height)}}
function haptic(){if(prefs.haptics&&navigator.vibrate)navigator.vibrate(8)}function dismissHint(){$('gestureHint').style.opacity='0';}
canvas.addEventListener('pointerdown',e=>{
  if(e.button>0)return;canvas.setPointerCapture(e.pointerId);
  const result=gestures.down(e.pointerId,point(e),e.timeStamp,{...view(),zoom,pan:pan+(w/2-cameraX)*zoom*fitZoom,panY:panY+(h/2-cameraY)*zoom*fitZoom},paintedHit(e));inputState();
  if(result?.type==='pinchstart'){releaseBubble();if(slide||pendingNavigation){adoptScreen();refresh();}dismissHint();}wake();
});
canvas.addEventListener('pointermove',e=>{
  const result=gestures.move(e.pointerId,point(e),e.timeStamp,view());inputState();if(!result)return;
  if(result.type==='swipe'){
    if(!dragScene){const snapshot=screenSnapshot();adoptScreen();dragScene=snapshot;}returningSwipe=false;
    swipeOffset=result.dx;dismissHint();
  }else if(result.type==='pan'){pan=panTarget=result.pan-(w/2-cameraX)*zoom*fitZoom;panY=panYTarget=result.panY-(h/2-cameraY)*zoom*fitZoom;dismissHint();}
  else if(result.type==='pinch'){
    panTarget=result.pan-(w/2-cameraX)*result.zoom*fitZoom;panYTarget=result.panY-(h/2-cameraY)*result.zoom*fitZoom;zoomTarget=result.zoom;
    if(performance.now()>=cameraSettlingUntil){pan=panTarget;panY=panYTarget;zoom=zoomTarget;}dismissHint();
  }wake();
});
function endPointer(e,cancelled=false){
  const result=gestures.up(e.pointerId,point(e),e.timeStamp,view(),cancelled);inputState();if(!result)return;releaseBubble();
  if(result.type==='navigate')travel(result.direction);
  else if(result.type==='tap'){const body=paintedHit(e)||result.body;if(body)openDetail(body.transaction);}
  else if(result.type==='end'&&dragScene){returningSwipe=true;}
  wake();
}
canvas.addEventListener('pointerup',e=>endPointer(e));canvas.addEventListener('pointercancel',e=>endPointer(e,true));canvas.addEventListener('lostpointercapture',e=>endPointer(e,true));
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function show(id){$(id).showModal();dismissHint()}
function openDetail(t){if(t.members){openList(t.members,t.merchant);return}activeTransaction=t;const container=$('detailContent');container.replaceChildren();const icon=element('div',cat(t).emoji,'detail-icon');icon.style.background=bubbleColor(t);const heading=element('h2',t.merchant,'detail-merchant'),value=element('div',amount(t.amountCents),'detail-amount'),meta=element('p',`${validDate(t.date)?dateFmt(t.date,{day:'numeric',month:'long'}):"Date d'achat inconnue"}${t.dateBasis==='label'?' · date du libellé':t.dateBasis==='estimated'?' · date comptable, achat non daté':''}${t.status==='pending'?' · en attente':''}${demo?' · démo':''}`,'detail-meta');container.append(icon,heading,value,meta,element('small',paymentKinds[t.paymentKind]?.name||paymentKinds.unknown.name));if(t.bookingDate)container.append(element('small','Comptabilisé le '+dateFmt(t.bookingDate,{day:'numeric',month:'long'})));container.append(element('span','Ça valait le coup ?','reflection'));const feelings=element('div',undefined,'feelings');for(const [feeling,emoji,label]of [['yes','☀','Oui, ça valait le coup'],['neutral','◌','À voir'],['no','☁','Pas tellement']]){const b=element('button',emoji);b.setAttribute('aria-label',label);b.classList.toggle('chosen',notes[t.id]?.feeling===feeling);b.setAttribute('aria-pressed',notes[t.id]?.feeling===feeling?'true':'false');b.onclick=()=>{notes[t.id]={...(notes[t.id]||{}),feeling};save(keys.notes,notes);for(const btn of feelings.children){const yes=btn===b;btn.classList.toggle('chosen',yes);btn.setAttribute('aria-pressed',yes?'true':'false')}};feelings.append(b)}container.append(feelings);const textarea=element('textarea',undefined,'note');textarea.placeholder='Une petite note…';textarea.maxLength=500;textarea.setAttribute('aria-label','Note sur cet achat');textarea.value=typeof notes[t.id]?.note==='string'?notes[t.id].note:'';textarea.oninput=()=>{notes[t.id]={...(notes[t.id]||{}),note:textarea.value};save(keys.notes,notes)};container.append(textarea);const pick=element('div',undefined,'category-pick');for(const [k,c]of Object.entries(categories)){const b=element('button',c.emoji);b.setAttribute('aria-label',c.name);b.classList.toggle('selected',categoryKey(t)===k);b.onclick=()=>{notes[t.id]={...(notes[t.id]||{}),category:k};save(keys.notes,notes);const key=merchantKey(t.merchant);if(key.length>=3){merchantRules[key]=k;save(keys.merchantRules,merchantRules)};icon.textContent=c.emoji;icon.style.background=c.color;for(const x of pick.children)x.classList.toggle('selected',x===b);refresh()};pick.append(b)}container.append(pick);show('detail')}
function openList(items=scene.visible,title='Dépenses'){$('listTitle').textContent=title;$('transactionList').replaceChildren();if(!items.length)$('transactionList').append(element('p',"Aucune opération reçue pour cette période."));for(const t of [...items].sort((a,b)=>(b.date||b.bookingDate||'').localeCompare(a.date||a.bookingDate||''))){const b=element('button',undefined,'transaction-row'),icon=element('span',cat(t).emoji,'mini-icon');icon.style.background=bubbleColor(t);const name=element('span',t.merchant);name.append(element('small',`${validDate(t.date)?dateFmt(t.date,{day:'numeric',month:'short'}):'Date d’achat inconnue'}${t.status==='pending'?' · en attente':''}${t.dateBasis==='estimated'?' · date estimée':''} · ${paymentKinds[t.paymentKind]?.name||paymentKinds.unknown.name}`));b.append(icon,name,element('strong',amount(t.amountCents)));b.onclick=()=>{$('list').close();openDetail(t)};$('transactionList').append(b)}show('list')}
function updateWallet(){
  if($('walletButton').hidden)return;
  const actual=bankActive?bankBalance:balance?{amount:balance.amount,available:true}:demo?{amount:84230,available:true}:null;
  const asOf=bankActive?(validDate(bankBalance?.asOf)?bankBalance.asOf:bankUpdatedAt?dateKey(new Date(bankUpdatedAt)):today):balance?.updatedAt?dateKey(new Date(balance.updatedAt)):today;
  const flows=bankActive?cashflow:demo?[...data.map(t=>({id:t.id,date:t.date,amountCents:-t.amountCents,status:'booked'})),...[...new Set(data.map(t=>t.date.slice(0,7)))].map(m=>({id:'demo-income-'+m,date:m+'-01',amountCents:100000,status:'booked',label:'Apport mensuel'}))]:cashflow.length?cashflow:data.filter(t=>validDate(t.date)).map(t=>({id:t.id,date:t.date,amountCents:-t.amountCents,status:'booked'}));
  walletView=walletAt({balance:actual,flows,date:selected,mode,asOf,expenses:sum(scene.visible)});
  const value=walletView,wallet=$('walletButton');
  $('balanceCaption').textContent=value?.historical?'solde estimé':'disponible';
  $('balanceSource').textContent=value?.historical?'· au '+dateFmt(value.date,{day:'numeric',month:'short'}):bankActive?(!bankFresh?'· dernière synchro BNP':bankBalance?.available?'· BNP':'· comptable BNP'):balance?'· saisi':demo?'· démo':'';
  $('balanceAmount').textContent=value?amount(value.amount):actual?'historique indisponible':'à renseigner';wallet.classList.toggle('unset',!value);
  const ratio=value?.ratio??0;wallet.classList.toggle('low',!!value&&value.ratio!==null&&ratio<.25&&value.amount>=0);wallet.classList.toggle('negative',!!value&&value.amount<0);
  liquid.update(value,{privacy:prefs.privacy,reduced:prefs.motion,format:euro});
  $('gauge').setAttribute('aria-valuemin','0');$('gauge').setAttribute('aria-valuemax',String(prefs.privacy?100:value?.reference||100));
  if(value?.reference&&!prefs.privacy)$('gauge').setAttribute('aria-valuenow',String(Math.max(0,Math.min(value.reference,value.amount))));else $('gauge').removeAttribute('aria-valuenow');
  $('gauge').setAttribute('aria-label','Réservoir du compte');$('gauge').setAttribute('aria-valuetext',prefs.privacy?'Montant masqué':value?`${euro(value.amount)}${value.historical?' estimé au '+value.date:' disponible'}${value.reference?' ; avant ces dépenses '+euro(value.reference)+' ; vide '+euro(value.spent):''}`:'Solde non disponible pour cette période');
  $('walletReference').textContent=prefs.privacy?'':value?.reference?'avant ces dépenses '+euro(value.reference):value?'solde initial non positif':'';
  $('walletReference').hidden=!$('walletReference').textContent;
  $('walletButton').setAttribute('aria-label',value?`Réservoir du compte. ${prefs.privacy?'Montant masqué':euro(value.amount)}. Ouvrir les détails`:'Réservoir du compte. Ouvrir les détails');
}
function syncPrefs(){document.body.classList.toggle('reduce-motion',prefs.motion);$('reduceMotion').checked=prefs.motion;$('hideAmounts').checked=prefs.privacy;$('haptics').checked=prefs.haptics;$('dataNote').textContent=bankActive?('Débits reçus · 90 derniers jours · catégories automatiques, à vérifier.'+(bankUpdatedAt?' Dernière synchronisation : '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(bankUpdatedAt))+'.':'')):demo?'Dépenses et solde fictifs.':'Dépenses importées. Aucune synchronisation bancaire.'}
$('walletButton').onclick=()=>{
 const actual=bankActive?bankBalance:balance||(demo?{amount:84230}:null);
 $('balanceForm').hidden=bankActive;$('balanceInput').readOnly=bankActive;$('clearBalance').hidden=bankActive;$('balanceInput').value=actual?String(actual.amount/100).replace('.',','):'';
 $('walletExplanation').textContent=walletView?`Les bulles affichées représentent ${amount(walletView.spent)} : c’est la partie vide. Il reste ${amount(walletView.amount)} de liquide. Le plein correspond à leur somme${walletView.reference?' : '+amount(walletView.reference):', avec un solde initial non positif'}. Les entrées de la période sont déjà prises en compte dans le solde.`:'Renseigne le solde actuel pour comparer les dépenses affichées à l’argent disponible.';
 $('walletPeriod').textContent=walletView?.historical?`Solde estimé au ${dateFmt(walletView.date,{day:'numeric',month:'long'})}, reconstruit depuis le solde actuel et les mouvements reçus. Le vide utilise exactement les achats de l’amas affiché.`:'Le vide correspond exactement à la somme des bulles de la période sélectionnée.';
 show('walletSheet');
};
function cents(text){const cleaned=text.trim().replace(/\s/g,'').replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(cleaned))throw Error('Montant invalide. Deux décimales maximum.');const value=Math.round(Number(cleaned)*100);if(!Number.isSafeInteger(value)||Math.abs(value)>100000000)throw Error('Montant hors limites.');return value}
$('balanceForm').onsubmit=e=>{e.preventDefault();try{const amount=cents($('balanceInput').value),next={amount,updatedAt:new Date().toISOString()};if(!save(keys.balance,next))return;balance=next;updateWallet();$('walletSheet').close()}catch(err){toast(err.message)}};$('clearBalance').onclick=()=>{try{localStorage.removeItem(keys.balance)}catch{toast('Impossible d’effacer le solde.');return}balance=null;updateWallet();$('walletSheet').close()};
for(const [id,key]of [['reduceMotion','motion'],['hideAmounts','privacy'],['haptics','haptics']])$(id).onchange=()=>{prefs[key]=$(id).checked;save(keys.prefs,prefs);refresh()};$('settingsButton').onclick=()=>show('settings');$('spentButton').onclick=()=>openList();$('undatedButton').onclick=()=>openList(data.filter(t=>!validDate(t.date)),'Date d’achat non fournie');$('previous').onclick=()=>travel(-1);$('next').onclick=()=>travel(1);$('backToday').onclick=()=>goTo(today,selected<today?1:-1);document.querySelector('.wordmark').onclick=e=>{e.preventDefault();if(mode!=='day'){selected=today;changeMode('day')}else goTo(today,selected<today?1:-1)};for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>changeMode(b.dataset.mode);
$('dateButton').onclick=()=>{try{$('datePicker').showPicker()}catch{$('datePicker').focus();$('datePicker').click()}};$('datePicker').onchange=()=>{if($('datePicker').value){goTo($('datePicker').value,$('datePicker').value>selected?1:-1)}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
$('categoryLegend').replaceChildren();$('categoryLegend').hidden=true
$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>3000000)throw Error('3 Mo maximum.');const imported=JSON.parse(await file.text()),transactions=validateImport(imported),importedFlows=validateCashflow(imported.cashflow||[]);if(!save(keys.tx,{version:1,transactions,cashflow:importedFlows}))return;data=transactions;cashflow=importedFlows;demo=false;bankActive=false;bankBalance=null;notes={};save(keys.notes,notes);balance=null;try{localStorage.removeItem(keys.balance)}catch{}selected=data.map(t=>t.date).filter(validDate).sort().at(-1)||today;refresh();$('settings').close();toast('Dépenses importées.')}catch(e){toast(e instanceof SyntaxError?'JSON invalide.':e.message)}finally{$('importFile').value=''}};
$('exportButton').onclick=()=>{const transactions=data.map(t=>({...t,category:categoryKey(t)})),blob=new Blob([JSON.stringify({version:1,transactions,cashflow},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=demo?'money-bubble-demo.json':'money-bubble-depenses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('resetButton').onclick=()=>{if(!confirm('Effacer les dépenses, notes et solde locaux et revenir à la démonstration ?'))return;try{localStorage.removeItem(keys.tx);localStorage.removeItem(keys.notes);localStorage.removeItem(keys.merchantRules);for(const key of Object.keys(merchantRules))delete merchantRules[key];localStorage.removeItem(keys.balance);localStorage.removeItem(keys.bank);localStorage.removeItem(keys.linked)}catch{toast('Impossible d’effacer les données locales.');return}data=buildDemo();cashflow=[];demo=true;bankActive=false;bankBalance=null;notes={};balance=null;selected=today;refresh();$('settings').close()};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installButton').hidden=false});$('installButton').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('installButton').hidden=true}};
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  const updates=autoUpdates(reg,{isBusy:()=>releaseBusy({bankBusy,pointer:pointer||pinch,activeElement:document.activeElement}),visible:()=>!document.hidden,reload:()=>{try{sessionStorage.setItem('money-bubble-update-view',JSON.stringify({mode,selected,settings:$('settings').open}))}catch{}location.reload()},hadController:!!navigator.serviceWorker.controller,onControllerChange:cb=>navigator.serviceWorker.addEventListener('controllerchange',cb),schedule:(cb,ms)=>setInterval(cb,ms)});
  window.addEventListener('focus',updates.check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updates.check()});
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',updates.flush);
}).catch(()=>{})}
const paymentLegend=element('div',undefined,'legend payment-legend');for(const kind of Object.values(paymentKinds)){const span=element('span'),dot=element('i');dot.style.background=kind.color;span.append(dot,element('span',kind.name));paymentLegend.append(span)}$('categoryLegend').after(paymentLegend);
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();travel(-1)}if(e.key==='ArrowRight'){e.preventDefault();travel(1)}});
syncPrefs();refresh();

const bankMessages={activate:'Active Money Bubble dans Enable Banking : Activate by linking accounts, puis autorise ton compte BNP.',configuration:'Ajoute ENABLE_BANKING_PRIVATE_KEY dans Vercel, puis redéploie.',provider_configuration:'Vérifie la clé et active l’application dans Enable Banking (« Activate by linking accounts »).',no_accounts:'BNP a validé l’accès mais Enable Banking ne renvoie aucun compte. Vérifie les comptes autorisés dans Enable Banking.',unsupported_accounts:'Aucun compte en euros utilisable n’a été renvoyé par BNP.',link_accounts:'Dans Enable Banking, active Money Bubble avec « Activate by linking accounts », puis reconnecte ici.',bnp_unavailable:'Le connecteur BNP Paribas France n’est pas disponible.',rate_limit:'BNP limite les actualisations. Réessaie plus tard.',reconnect:'L’autorisation a expiré. Reconnecte BNP.',state:'Connexion expirée. Recommence depuis l’app.',cancelled:'Connexion annulée.',history_limit:'Historique trop volumineux. Aucune donnée partielle affichée.',account:'Compte non autorisé.',unavailable:'Connexion indisponible. Réessaie.',bank_unavailable:'La banque ou Enable Banking ne répond pas. Réessaie plus tard.'};
async function bankRequest(path,body){const response=await fetch('/api/bank/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok)throw Object.assign(Error(bankMessages[result.error]||bankMessages.unavailable),{code:result.error});return result}
function bankControls(connected){$('connectBank').hidden=connected;$('syncBank').hidden=!connected;$('disconnectBank').hidden=!connected;$('bankAccountLabel').hidden=!connected||bankAccounts.length<2;for(const id of ['connectBank','syncBank','disconnectBank','bankAccount'])$(id).disabled=bankBusy}
async function syncBank(force=false){if(bankBusy||!bankAccounts.length||document.hidden||(!force&&Date.now()-bankLastSync<600000))return;bankBusy=true;bankControls(true);$('bankStatus').textContent='Actualisation…';try{const result=await bankRequest('sync',{accountId:bankAccountId});const transactions=mergePurchaseDates(validateImport(result),data);data=transactions;demo=false;bankActive=true;bankFresh=true;bankBalance=result.balance;cashflow=validateCashflow(result.cashflow||[]);bankAccountId=result.accountId;bankUpdatedAt=result.updatedAt;bankLastSync=Date.now();save(keys.linked,true);const snapshot=bankSnapshot({...result,transactions});if(snapshot)save(keys.bank,snapshot);refresh();$('bankStatus').textContent='BNP · '+new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date(result.updatedAt));}catch(e){bankFresh=false;$('bankStatus').textContent=e.message+(bankUpdatedAt?' Dernières données conservées.':'');if(e.code==='reconnect'){bankAccounts=[];bankControls(false)}refresh()}finally{bankBusy=false;bankControls(!!bankAccounts.length)}}
$('connectBank').onclick=()=>{if(bankBusy)return;bankConnecting=true;save(keys.linked,true);const opened=openBankWindow((...args)=>window.open(...args),location.origin);if(opened){$('settings').close();$('bankStatus').textContent='Valide BNP, puis reviens dans l’app.'}else{$('bankStatus').replaceChildren(document.createTextNode('Ouvre la connexion BNP : '));const link=document.createElement('a');link.href='./bank-connect.html';link.target='_blank';link.rel='noopener';link.textContent='Continuer';$('bankStatus').append(link)}};
$('syncBank').onclick=()=>syncBank(true);
$('bankAccount').onchange=()=>{bankAccountId=$('bankAccount').value;data=[];cashflow=[];bankBalance=null;bankFresh=false;refresh();syncBank(true)};
$('disconnectBank').onclick=async()=>{if(bankBusy)return;bankBusy=true;bankControls(true);try{await bankRequest('disconnect',{});localStorage.removeItem(keys.bank);localStorage.removeItem(keys.linked);bankActive=false;bankFresh=false;bankConnecting=false;bankAccounts=[];bankBalance=null;bankAccountId=null;bankLastSync=0;const stored=read(keys.tx,null);try{data=stored?validateImport(stored):buildDemo();cashflow=stored?validateCashflow(stored.cashflow||[]):[];demo=!stored}catch{data=buildDemo();cashflow=[];demo=true}refresh();$('bankStatus').textContent='Banque déconnectée.'}catch(e){$('bankStatus').textContent=e.message}finally{bankBusy=false;bankControls(!!bankAccounts.length)}};
async function initBank(){if(bankChecking||bankBusy)return;bankChecking=true;try{const status=await bankRequest('status');if(!status.configured){$('bankStatus').textContent=bankMessages.configuration;$('connectBank').disabled=true;return}bankAccounts=status.connected?(status.accounts||[]):[];bankControls(status.connected);$('bankStatus').textContent=status.connected?'BNP connecté.':bankActive?'Connexion à rétablir. Dernières données conservées.':'BNP non connecté.';const select=$('bankAccount');select.replaceChildren();for(const a of bankAccounts){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o)}if(status.connected){bankConnecting=false;save(keys.linked,true);if(!bankAccounts.some(a=>a.id===bankAccountId)){bankAccountId=bankAccounts.find(a=>a.type==='CACC')?.id||bankAccounts[0]?.id||null;data=[];cashflow=[];bankBalance=null}if(bankAccountId)select.value=bankAccountId;bankActive=true;bankFresh=false;demo=false;refresh();await syncBank(true)}}catch{$('bankStatus').textContent='Connexion indisponible.'+(bankUpdatedAt?' Dernières données conservées.':'');bankFresh=false;refresh();bankControls(!!bankAccounts.length)}finally{bankChecking=false}}
const bankQuery=new URL(location.href).searchParams.get('bank');if(bankQuery){history.replaceState(null,'',location.pathname);if(bankQuery!=='connected'){$('settings').showModal();$('bankStatus').textContent=bankMessages[bankQuery]||bankMessages.unavailable;toast(bankMessages[bankQuery]||bankMessages.unavailable)}}
initBank().then(()=>{if(bankQuery&&bankQuery!=='connected')$('bankStatus').textContent=bankMessages[bankQuery]||bankMessages.unavailable});
function resumeBank(){if(bankBusy||document.hidden)return;if(bankConnecting||(!bankAccounts.length&&bankActive))initBank();else if(bankAccounts.length)syncBank()}window.addEventListener('focus',resumeBank);document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeBank()});window.addEventListener('pageshow',e=>{if(e.persisted)resumeBank()});setInterval(resumeBank,600000);

// The callback window signals completion; credentials remain in HttpOnly cookies.
function bankReturned(message){if(message?.type!=='bank-return')return;bankConnecting=false;initBank()}
try{const channel=new BroadcastChannel('money-bubble-bank');channel.onmessage=e=>bankReturned(e.data)}catch{}
window.addEventListener('storage',e=>{if(e.key==='money-bubble-bank-return'){try{bankReturned(JSON.parse(e.newValue))}catch{}}});
// Restore the screen after automatic release activation, including an open settings sheet.
try{const view=JSON.parse(sessionStorage.getItem('money-bubble-update-view'));sessionStorage.removeItem('money-bubble-update-view');if(view){if(validDate(view.selected))selected=view.selected;if(['day','week','month'].includes(view.mode))changeMode(view.mode);refresh();if(view.settings&&!$('settings').open)$('settings').showModal()}}catch{}
