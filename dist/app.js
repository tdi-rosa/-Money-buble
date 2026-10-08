import {hitRenderedBubbles} from './bubble-layout.js';
import {GestureSession} from './gestures.js';
import {openBankWindow} from './bank-window.js';
import {bankSnapshot} from './bank-state.js';
import {categories,paymentKinds,paymentColor,merchantKey,euro,dateKey,shiftDate,validateImport,demoData,validDate,mergePurchaseDates,displayPurchaseDates} from './core.js';
import {BubbleField} from './physics.js';
import {autoUpdates,releaseBusy} from './updates.js';
import {bounds,navigate,groupTransactions,sum} from './periods.js';
const $=id=>document.getElementById(id),today=dateKey(),field=new BubbleField(),canvas=$('canvas'),ctx=canvas.getContext('2d'),stage=$('stage');
const keys={tx:'bulles-transactions-v1',notes:'bulles-reflections-v1',balance:'money-bubble-balance-v1',prefs:'money-bubble-prefs-v1',bank:'money-bubble-bank-display-v1',linked:'money-bubble-bank-linked-v1',merchantRules:'money-bubble-merchant-rules-v1'};let bankActive=false,bankFresh=false,bankConnecting=false,bankChecking=false,bankBusy=false,bankBalance=null,bankAccounts=[],bankAccountId=null,bankLastSync=0,bankUpdatedAt=null;let data=[],demo=true,notes={},balance=null,prefs={motion:matchMedia('(prefers-reduced-motion: reduce)').matches,privacy:false,haptics:false},mode='day',selected=today,scene=null,groups=[],pointer=null,raf=0,last=0,accumulator=0,w=400,h=400,activeTransaction=null,installPrompt=null,hiddenWarning=false;
function read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('Stockage indisponible. Les changements ne seront pas conservés.');return false}}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500)}
function buildDemo(){const list=[];for(let i=-44;i<=0;i++){const day=shiftDate(today,i);if(i!==0&&Math.abs(i)%8===0)continue;for(const t of demoData(day).filter(t=>t.date===day)){if(i!==0&&t.id.endsWith('-4')&&Math.abs(i)%3!==0)continue;list.push({...t,amountCents:t.amountCents+Math.abs(i)%5*35});}}return list}
const snapshot=bankSnapshot(read(keys.bank,null));
const hadBank=read(keys.linked,false)===true;
if(snapshot){data=snapshot.transactions;bankBalance=snapshot.balance;bankAccountId=snapshot.accountId;bankUpdatedAt=snapshot.updatedAt;bankActive=true;demo=false}else if(hadBank){data=[];bankActive=true;demo=false;try{localStorage.removeItem(keys.bank)}catch{}}else{const stored=read(keys.tx,null);try{if(stored){data=validateImport(stored);demo=false}else data=buildDemo()}catch{data=buildDemo();toast('Import local illisible : démonstration affichée.')}}
const oldNotes=read(keys.notes,{});if(oldNotes&&typeof oldNotes==='object'&&!Array.isArray(oldNotes))notes=oldNotes;const savedPrefs=read(keys.prefs,{});for(const k of Object.keys(prefs))if(typeof savedPrefs?.[k]==='boolean')prefs[k]=savedPrefs[k];const savedBalance=read(keys.balance,null);if(savedBalance&&Number.isSafeInteger(savedBalance.amount)&&Number.isSafeInteger(savedBalance.reference)&&savedBalance.reference>0)balance=savedBalance;
const merchantRules=read(keys.merchantRules,{});
const categoryKey=t=>notes[t.id]?.category||(Object.hasOwn(categories,merchantRules?.[merchantKey(t.merchant)])?merchantRules[merchantKey(t.merchant)]:t.category),bubbleColor=paymentColor;
const amount=n=>prefs.privacy?'••• €':euro(n),cat=t=>categories[categoryKey(t)]||categories.other,dateFmt=(d,opts)=>new Intl.DateTimeFormat('fr-FR',{...opts,timeZone:'Europe/Paris'}).format(new Date(d+'T12:00:00Z'));
function title(){const {start,end}=bounds(selected,mode);if(mode==='day'){$('periodTitle').textContent=selected===today?"Aujourd'hui":dateFmt(selected,{weekday:'long'});$('periodSubtitle').textContent=dateFmt(selected,{day:'numeric',month:'long',year: 'numeric'})}else if(mode==='week'){$('periodTitle').textContent=start.slice(0,7)===end.slice(0,7)?`${Number(start.slice(-2))} – ${dateFmt(end,{day:'numeric',month:'short'})}`:`${dateFmt(start,{day:'numeric',month:'short'})} – ${dateFmt(end,{day:'numeric',month:'short'})}`;$('periodSubtitle').textContent='une semaine'}else{$('periodTitle').textContent=dateFmt(selected,{month:'long'});$('periodSubtitle').textContent=selected.slice(0,4)}$('datePicker').value=selected;$('backToday').hidden=bounds(today,mode).start===start;}
const layoutWorker=new Worker(new URL('./layout-worker.js',import.meta.url),{type:'module'});
let layoutRevision=0,pendingNavigation=null,morph=null,layoutPayload=null;const previews=new Map();
layoutWorker.onmessage=({data:result})=>{
  if(result.id!==layoutRevision)return;
  if(result.preview){if(!result.error)previews.set(result.preview,{specs:result.specs,bodies:result.specs.filter(b=>b.inPeriod).map(b=>({...b,x:b.tx,y:b.ty,r:b.targetR,alpha:1,amountText:amount(b.transaction.amountCents)}))});if(dragScene)wake();return;}
  if(result.error){toast('Impossible de calculer les bulles. Réouvre l’application.');return;}
  groups=result.groups;
  const navigation=pendingNavigation;pendingNavigation=null;
  field.reconcile(result.specs.map(s=>({...s,amountText:amount(s.transaction.amountCents)})));field.bodies=field.bodies.filter(b=>!b.retired);
  morph=null;
  if(result.morph&&!navigation&&!prefs.motion){const byId=new Map(field.bodies.map(b=>[b.id,b]));morph={...result.morph,progress:0,bodies:result.morph.ids.map(id=>byId.get(id))};const tracked=new Set(result.morph.ids);for(const b of field.bodies)if(!tracked.has(b.id)){b.x=b.tx;b.y=b.ty;b.r=b.targetR;}field.settled=true;}
  if(navigation){slide={...navigation,progress:0};for(const b of field.bodies){b.x=b.tx;b.y=b.ty;b.r=b.targetR;b.alpha=1;}field.settled=true;}
  if(prefs.motion||!result.morph&&!navigation){for(const b of field.bodies){b.x=b.tx;b.y=b.ty;b.r=b.targetR;b.alpha=b.targetAlpha;}field.bodies=field.bodies.filter(b=>!b.retired);field.settled=true;}
  if(layoutPayload)for(const direction of [-1,1]){const date=navigate(selected,mode,direction);layoutWorker.postMessage({...layoutPayload,preview:date,starts:null,options:{...layoutPayload.options,date,animate:false}});}
  wake();
};
layoutWorker.onerror=()=>toast('Le calcul des bulles n’a pas pu démarrer. Réouvre l’application.');
function refresh(){morph=null;previews.clear();title();const displayed=displayPurchaseDates(data),undated=displayed.filter(t=>!validDate(t.date));$('undatedButton').hidden=!undated.length;$('undatedButton').textContent=undated.length+' achat'+(undated.length>1?'s':'')+' sans date d’achat';scene=groupTransactions(displayed,selected,mode);stage.style.minHeight='240px';$('spent').textContent=bankActive&&!scene.visible.length?'—':amount(sum(scene.visible));$('spentButton').setAttribute('aria-label',`${bankActive&&!scene.visible.length?'Aucun achat daté pour cette période':prefs.privacy?'Montant masqué':euro(sum(scene.visible))}. ${scene.visible.length} dépenses. Ouvrir la liste`);$('pendingBadge').hidden=!scene.visible.some(t=>t.status==='pending');$('estimatedBadge').hidden=!scene.visible.some(t=>t.dateBasis==='estimated');$('empty').hidden=scene.visible.length!==0;$('empty').querySelector('p').textContent=bankActive?(undated.length?'La banque n’a pas fourni la date de certains achats.':'Aucune opération reçue. Les paiements peuvent arriver plus tard.'):"Rien ici, pour l’instant.";$('sourceBadge').textContent=bankActive?(bankFresh?'BNP':'BNP · dernière synchro'):demo?'démo':'local';$('groupLabels').replaceChildren();
  layoutPayload={id:++layoutRevision,groups:[{items:displayed.filter(t=>validDate(t.date))}],options:{mode,date:selected,width:w,height:h,animate:!pendingNavigation&&!prefs.motion},starts:field.bodies.map(b=>({id:b.id,x:b.x,y:b.y,r:b.r}))};layoutWorker.postMessage(layoutPayload);
  updateWallet();syncPrefs();wake();
}
const modes=['day','week','month'],gestures=new GestureSession();
let slide=null,dragScene=null,swipeOffset=0,returningSwipe=false,pan=0,panTarget=0,panY=0,panYTarget=0,zoom=1,zoomTarget=1,pinch=null,cameraSettlingUntil=0;
let renderedRegions=[];
function view(){return {mode,width:w,height:h,zoom:zoomTarget,pan:panTarget,panY:panYTarget};}
function inputState(){pointer=gestures.pointer;pinch=gestures.pinch;}
function paintedHit(e){return hitRenderedBubbles(renderedRegions,e,canvas.getBoundingClientRect(),canvas)}
function screenSnapshot(){
  if(dragScene)return dragScene.map(b=>({...b,x:b.x+swipeOffset}));
  if(pendingNavigation)return pendingNavigation.bodies.map(b=>({...b}));
  const circles=new Map(),ratio=canvas.width/w;
  for(const r of renderedRegions)circles.set(r.body.id,{...r.body,x:r.x/ratio,y:r.y/(canvas.height/h),r:r.r/ratio,alpha:1});
  return [...circles.values()];
}
function adoptScreen(){
  const displayed=new Map(screenSnapshot().map(b=>[b.id,b]));
  for(const b of field.bodies){const p=displayed.get(b.id);if(!p)continue;
    b.x=(p.x-w/2-pan)/zoom+w/2;b.y=(p.y-h/2-panY)/zoom+h/2;b.r=p.r/zoom;b.vx=b.vy=0;
  }
  field.settled=true;morph=null;slide=pendingNavigation=dragScene=null;swipeOffset=0;returningSwipe=false;
}
function changeMode(m,{fromPinch=false}={}){
  if(mode===m)return;adoptScreen();mode=m;
  panTarget=panYTarget=0;zoomTarget=1;cameraSettlingUntil=performance.now()+220;
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
  selected=date;pan=panTarget=panY=panYTarget=0;zoom=zoomTarget=1;
  refresh();animateHeader();haptic();dismissHint();
}
function travel(direction){goTo(navigate(selected,mode,direction),direction);}
function paintBodies(bodies,{offset=0,screen=false}={}){
  const scale=screen?1:zoom,px=screen?0:pan,py=screen?0:panY;
  ctx.save();ctx.translate(w/2+offset+px,h/2+py);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);
  const m=ctx.getTransform();
  for(const b of bodies){
    const x=w/2+offset+px+(b.x-w/2)*scale,y=h/2+py+(b.y-h/2)*scale,r=b.r*scale;
    if(b.alpha<.01||x+r<0||x-r>w||y+r<0||y-r>h)continue;
    ctx.globalAlpha=b.alpha;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,Math.max(0,b.r),0,Math.PI*2);ctx.fill();
    renderedRegions.push({body:b,x:m.a*b.x+m.c*b.y+m.e,y:m.b*b.x+m.d*b.y+m.f,r:Math.hypot(m.a,m.b)*b.r});
    if(r>=23){ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';const t=b.transaction;
      ctx.font=`500 ${Math.min(22,b.r*.32)}px system-ui`;ctx.fillText(b.amountText??amount(t.amountCents),b.x,b.y-(r>65?5/scale:0));
      if(r>65){ctx.font=`400 ${Math.min(12,b.r*.16)}px system-ui`;const name=t.merchant.length>16?t.merchant.slice(0,14)+'…':t.merchant;ctx.fillText(name,b.x,b.y+18/scale);}
    }
  }ctx.restore();
}
function draw(){
  renderedRegions=[];ctx.clearRect(0,0,w,h);
  if(dragScene){paintBodies(dragScene,{offset:swipeOffset,screen:true});const direction=swipeOffset<0?1:-1,preview=previews.get(navigate(selected,mode,direction));if(preview)paintBodies(preview.bodies,{offset:direction*w+swipeOffset,screen:true});$('empty').style.transform=`translateX(${swipeOffset}px)`;return;}
  if(pendingNavigation){paintBodies(pendingNavigation.bodies,{screen:true});if(pendingNavigation.incoming)paintBodies(pendingNavigation.incoming,{offset:pendingNavigation.startOffset,screen:true});return;}
  let offset=0;
  if(slide){const e=1-Math.pow(1-slide.progress,3);offset=(slide.startOffset??slide.direction*w)*(1-e);paintBodies(slide.bodies,{offset:-slide.direction*w*e,screen:true});}
  paintBodies(field.bodies,{offset});$('empty').style.transform=`translateX(${offset+pan}px)`;
}
function frame(timestamp){
  raf=0;if(document.hidden)return;const elapsed=last?Math.min(.05,(timestamp-last)/1000):1/60;last=timestamp;
  if(returningSwipe){swipeOffset*=Math.exp(-25*elapsed);if(Math.abs(swipeOffset)<.1){swipeOffset=0;adoptScreen();refresh();}}
  if(slide){slide.progress=Math.min(1,slide.progress+elapsed/.28);if(slide.progress===1)slide=null;}
  const direct=(pointer||pinch)&&timestamp>=cameraSettlingUntil,ease=prefs.motion||direct?1:1-Math.exp(-24*elapsed);
  pan+=(panTarget-pan)*ease;panY+=(panYTarget-panY)*ease;zoom+=(zoomTarget-zoom)*ease;
  if(morph&&!dragScene&&!pendingNavigation){
    morph.progress=Math.min(1,morph.progress+elapsed/morph.duration);const sample=morph.progress*morph.steps,a=Math.floor(sample),b=Math.min(morph.steps,a+1),t=sample-a,n=morph.bodies.length;
    for(let i=0;i<n;i++){const body=morph.bodies[i],j=(a*n+i)*3,k=(b*n+i)*3;body.x=morph.frames[j]+(morph.frames[k]-morph.frames[j])*t;body.y=morph.frames[j+1]+(morph.frames[k+1]-morph.frames[j+1])*t;body.r=morph.frames[j+2]+(morph.frames[k+2]-morph.frames[j+2])*t;}
    if(morph.progress===1){for(const body of field.bodies){body.x=body.tx;body.y=body.ty;body.r=body.targetR;body.alpha=1;}morph=null;}
  }
  draw();$('recenter').hidden=zoomTarget<=1.04&&Math.abs(panTarget)<2&&Math.abs(panYTarget)<2;
  if(returningSwipe||slide||(morph&&!dragScene&&!pendingNavigation)||Math.abs(pan-panTarget)>.05||Math.abs(panY-panYTarget)>.05||Math.abs(zoom-zoomTarget)>.001)raf=requestAnimationFrame(frame);
}
function wake(){if(!raf&&!document.hidden){last=0;raf=requestAnimationFrame(frame)}}
function resize(){const r=stage.getBoundingClientRect(),oldW=w,oldH=h;if(canvas.width&&Math.abs(w-r.width)<.5&&Math.abs(h-r.height)<.5)return;
  w=r.width;h=r.height;const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
  for(const b of field.bodies){b.x*=w/oldW;b.y*=h/oldH}field.resize(w,h);refresh();
}
new ResizeObserver(resize).observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;gestures.reset();inputState();dragScene=null;swipeOffset=0;panTarget=panYTarget=0;zoomTarget=1;}else wake()});
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*w/Math.max(1,r.width),y:(e.clientY-r.top)*h/Math.max(1,r.height)}}
function haptic(){if(prefs.haptics&&navigator.vibrate)navigator.vibrate(8)}function dismissHint(){$('gestureHint').style.opacity='0';}
canvas.addEventListener('pointerdown',e=>{
  if(e.button>0)return;canvas.setPointerCapture(e.pointerId);
  const result=gestures.down(e.pointerId,point(e),e.timeStamp,{...view(),zoom,pan,panY},paintedHit(e));inputState();
  if(result?.type==='pinchstart'){const navigating=slide||pendingNavigation;adoptScreen();if(navigating)refresh();dismissHint();}wake();
});
canvas.addEventListener('pointermove',e=>{
  const result=gestures.move(e.pointerId,point(e),e.timeStamp,view());inputState();if(!result)return;
  if(result.type==='swipe'){
    if(!dragScene){const snapshot=screenSnapshot();adoptScreen();dragScene=snapshot;}returningSwipe=false;
    swipeOffset=result.dx;dismissHint();
  }else if(result.type==='pan'){pan=panTarget=result.pan;panY=panYTarget=result.panY;dismissHint();}
  else if(result.type==='pinch'){
    if(result.nextMode){changeMode(result.nextMode,{fromPinch:true});haptic();}
    panTarget=result.pan;panYTarget=result.panY;zoomTarget=result.zoom;
    if(performance.now()>=cameraSettlingUntil){pan=panTarget;panY=panYTarget;zoom=zoomTarget;}dismissHint();
  }wake();
});
function endPointer(e,cancelled=false){
  const result=gestures.up(e.pointerId,point(e),e.timeStamp,view(),cancelled);inputState();if(!result)return;
  if(result.type==='navigate')travel(result.direction);
  else if(result.type==='tap'){const body=paintedHit(e)||result.body;if(body)openDetail(body.transaction);}
  else if(result.type==='end'&&dragScene){returningSwipe=true;}
  if(!pointer&&!pinch&&zoomTarget<1){zoomTarget=1;panTarget=panYTarget=0;}
  wake();
}
canvas.addEventListener('pointerup',e=>endPointer(e));canvas.addEventListener('pointercancel',e=>endPointer(e,true));canvas.addEventListener('lostpointercapture',e=>endPointer(e,true));
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function show(id){$(id).showModal();dismissHint()}
function openDetail(t){if(t.members){openList(t.members,t.merchant);return}activeTransaction=t;const container=$('detailContent');container.replaceChildren();const icon=element('div',cat(t).emoji,'detail-icon');icon.style.background=bubbleColor(t);const heading=element('h2',t.merchant,'detail-merchant'),value=element('div',amount(t.amountCents),'detail-amount'),meta=element('p',`${validDate(t.date)?dateFmt(t.date,{day:'numeric',month:'long'}):"Date d'achat inconnue"}${t.dateBasis==='label'?' · date du libellé':t.dateBasis==='estimated'?' · date comptable, achat non daté':''}${t.status==='pending'?' · en attente':''}${demo?' · démo':''}`,'detail-meta');container.append(icon,heading,value,meta,element('small',paymentKinds[t.paymentKind]?.name||paymentKinds.unknown.name));if(t.bookingDate)container.append(element('small','Comptabilisé le '+dateFmt(t.bookingDate,{day:'numeric',month:'long'})));container.append(element('span','Ça valait le coup ?','reflection'));const feelings=element('div',undefined,'feelings');for(const [feeling,emoji,label]of [['yes','☀','Oui, ça valait le coup'],['neutral','◌','À voir'],['no','☁','Pas tellement']]){const b=element('button',emoji);b.setAttribute('aria-label',label);b.classList.toggle('chosen',notes[t.id]?.feeling===feeling);b.setAttribute('aria-pressed',notes[t.id]?.feeling===feeling?'true':'false');b.onclick=()=>{notes[t.id]={...(notes[t.id]||{}),feeling};save(keys.notes,notes);for(const btn of feelings.children){const yes=btn===b;btn.classList.toggle('chosen',yes);btn.setAttribute('aria-pressed',yes?'true':'false')}};feelings.append(b)}container.append(feelings);const textarea=element('textarea',undefined,'note');textarea.placeholder='Une petite note…';textarea.maxLength=500;textarea.setAttribute('aria-label','Note sur cet achat');textarea.value=typeof notes[t.id]?.note==='string'?notes[t.id].note:'';textarea.oninput=()=>{notes[t.id]={...(notes[t.id]||{}),note:textarea.value};save(keys.notes,notes)};container.append(textarea);const pick=element('div',undefined,'category-pick');for(const [k,c]of Object.entries(categories)){const b=element('button',c.emoji);b.setAttribute('aria-label',c.name);b.classList.toggle('selected',categoryKey(t)===k);b.onclick=()=>{notes[t.id]={...(notes[t.id]||{}),category:k};save(keys.notes,notes);const key=merchantKey(t.merchant);if(key.length>=3){merchantRules[key]=k;save(keys.merchantRules,merchantRules)};icon.textContent=c.emoji;icon.style.background=c.color;for(const x of pick.children)x.classList.toggle('selected',x===b);refresh()};pick.append(b)}container.append(pick);show('detail')}
function openList(items=scene.visible,title='Dépenses'){$('listTitle').textContent=title;$('transactionList').replaceChildren();if(!items.length)$('transactionList').append(element('p',"Aucune opération reçue pour cette période."));for(const t of [...items].sort((a,b)=>(b.date||b.bookingDate||'').localeCompare(a.date||a.bookingDate||''))){const b=element('button',undefined,'transaction-row'),icon=element('span',cat(t).emoji,'mini-icon');icon.style.background=bubbleColor(t);const name=element('span',t.merchant);name.append(element('small',`${validDate(t.date)?dateFmt(t.date,{day:'numeric',month:'short'}):'Date d’achat inconnue'}${t.status==='pending'?' · en attente':''}${t.dateBasis==='estimated'?' · date estimée':''} · ${paymentKinds[t.paymentKind]?.name||paymentKinds.unknown.name}`));b.append(icon,name,element('strong',amount(t.amountCents)));b.onclick=()=>{$('list').close();openDetail(t)};$('transactionList').append(b)}show('list')}
function updateWallet(){const value=bankActive?(bankBalance?{amount:bankBalance.amount,reference:balance?.reference||Math.max(125000,bankBalance.amount)}:null):balance||(demo?{amount:84230,reference:125000}:null),wallet=$('walletButton');$('balanceSource').textContent=bankActive?(!bankFresh?'· dernière synchro BNP':bankBalance?.available?'· BNP':'· comptable BNP'):balance?'· saisi':demo?'· démo':'';$('balanceAmount').textContent=value?amount(value.amount):'à renseigner';wallet.classList.toggle('unset',!value);const ratio=value?Math.max(0,Math.min(1,value.amount/value.reference)):0;wallet.classList.toggle('low',!!value&&ratio<.25&&value.amount>=0);wallet.classList.toggle('negative',!!value&&value.amount<0);$('gaugeFill').style.width=`${ratio*100}%`;$('gauge').setAttribute('aria-valuemin','0');$('gauge').setAttribute('aria-valuemax','100');$('gauge').setAttribute('aria-valuenow',String(Math.round(ratio*100)));$('gauge').setAttribute('aria-valuetext',prefs.privacy?'Montant masqué':value?`${euro(value.amount)} disponible ; repère ${euro(value.reference)}${bankActive?' BNP':balance?' saisi manuellement':' fictif'}`:'Solde non renseigné');if(prefs.privacy){$('gaugeFill').style.width='50%';$('gauge').removeAttribute('aria-valuenow')}}
function syncPrefs(){document.body.classList.toggle('reduce-motion',prefs.motion);$('reduceMotion').checked=prefs.motion;$('hideAmounts').checked=prefs.privacy;$('haptics').checked=prefs.haptics;$('dataNote').textContent=bankActive?('Débits reçus · 90 derniers jours · catégories automatiques, à vérifier.'+(bankUpdatedAt?' Dernière synchronisation : '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(bankUpdatedAt))+'.':'')):demo?'Dépenses et solde fictifs.':'Dépenses importées. Aucune synchronisation bancaire.'}
$('walletButton').onclick=()=>{const value=bankActive?(bankBalance?{amount:bankBalance.amount,reference:balance?.reference||125000}:null):balance||(demo?{amount:84230,reference:125000}:null);$('balanceInput').readOnly=bankActive;$('clearBalance').hidden=bankActive;$('balanceInput').value=value?String(value.amount/100).replace('.',','):'';$('referenceInput').value=value?String(value.reference/100).replace('.',','):'';show('walletSheet')};
function cents(text){const cleaned=text.trim().replace(/\s/g,'').replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(cleaned))throw Error('Montant invalide. Deux décimales maximum.');const value=Math.round(Number(cleaned)*100);if(!Number.isSafeInteger(value)||Math.abs(value)>100000000)throw Error('Montant hors limites.');return value}
$('balanceForm').onsubmit=e=>{e.preventDefault();try{const amount=cents($('balanceInput').value),reference=cents($('referenceInput').value);if(reference<=0)throw Error('Le repère doit être positif.');const next={amount,reference,updatedAt:new Date().toISOString()};if(!save(keys.balance,next))return;balance=next;updateWallet();$('walletSheet').close()}catch(err){toast(err.message)}};$('clearBalance').onclick=()=>{try{localStorage.removeItem(keys.balance)}catch{toast('Impossible d’effacer le solde.');return}balance=null;updateWallet();$('walletSheet').close()};
for(const [id,key]of [['reduceMotion','motion'],['hideAmounts','privacy'],['haptics','haptics']])$(id).onchange=()=>{prefs[key]=$(id).checked;save(keys.prefs,prefs);refresh()};$('settingsButton').onclick=()=>show('settings');$('spentButton').onclick=()=>openList();$('undatedButton').onclick=()=>openList(data.filter(t=>!validDate(t.date)),'Date d’achat non fournie');$('previous').onclick=()=>travel(-1);$('next').onclick=()=>travel(1);$('backToday').onclick=()=>goTo(today,selected<today?1:-1);document.querySelector('.wordmark').onclick=e=>{e.preventDefault();if(mode!=='day'){selected=today;changeMode('day')}else goTo(today,selected<today?1:-1)};for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>changeMode(b.dataset.mode);
$('dateButton').onclick=()=>{try{$('datePicker').showPicker()}catch{$('datePicker').focus();$('datePicker').click()}};$('datePicker').onchange=()=>{if($('datePicker').value){goTo($('datePicker').value,$('datePicker').value>selected?1:-1)}};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});
$('categoryLegend').replaceChildren();$('categoryLegend').hidden=true
$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>3000000)throw Error('3 Mo maximum.');const transactions=validateImport(JSON.parse(await file.text()));if(!save(keys.tx,{version:1,transactions}))return;data=transactions;demo=false;bankActive=false;bankBalance=null;notes={};save(keys.notes,notes);balance=null;try{localStorage.removeItem(keys.balance)}catch{}selected=data.map(t=>t.date).filter(validDate).sort().at(-1)||today;refresh();$('settings').close();toast('Dépenses importées.')}catch(e){toast(e instanceof SyntaxError?'JSON invalide.':e.message)}finally{$('importFile').value=''}};
$('exportButton').onclick=()=>{const transactions=data.map(t=>({...t,category:categoryKey(t)})),blob=new Blob([JSON.stringify({version:1,transactions},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=demo?'money-bubble-demo.json':'money-bubble-depenses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('resetButton').onclick=()=>{if(!confirm('Effacer les dépenses, notes et solde locaux et revenir à la démonstration ?'))return;try{localStorage.removeItem(keys.tx);localStorage.removeItem(keys.notes);localStorage.removeItem(keys.merchantRules);for(const key of Object.keys(merchantRules))delete merchantRules[key];localStorage.removeItem(keys.balance);localStorage.removeItem(keys.bank);localStorage.removeItem(keys.linked)}catch{toast('Impossible d’effacer les données locales.');return}data=buildDemo();demo=true;bankActive=false;bankBalance=null;notes={};balance=null;selected=today;refresh();$('settings').close()};
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
async function syncBank(force=false){if(bankBusy||!bankAccounts.length||document.hidden||(!force&&Date.now()-bankLastSync<600000))return;bankBusy=true;bankControls(true);$('bankStatus').textContent='Actualisation…';try{const result=await bankRequest('sync',{accountId:bankAccountId});const transactions=mergePurchaseDates(validateImport(result),data);data=transactions;demo=false;bankActive=true;bankFresh=true;bankBalance=result.balance;bankAccountId=result.accountId;bankUpdatedAt=result.updatedAt;bankLastSync=Date.now();save(keys.linked,true);const snapshot=bankSnapshot({...result,transactions});if(snapshot)save(keys.bank,snapshot);refresh();$('bankStatus').textContent='BNP · '+new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date(result.updatedAt));}catch(e){bankFresh=false;$('bankStatus').textContent=e.message+(bankUpdatedAt?' Dernières données conservées.':'');if(e.code==='reconnect'){bankAccounts=[];bankControls(false)}refresh()}finally{bankBusy=false;bankControls(!!bankAccounts.length)}}
$('connectBank').onclick=()=>{if(bankBusy)return;bankConnecting=true;save(keys.linked,true);const opened=openBankWindow((...args)=>window.open(...args),location.origin);if(opened){$('settings').close();$('bankStatus').textContent='Valide BNP, puis reviens dans l’app.'}else{$('bankStatus').replaceChildren(document.createTextNode('Ouvre la connexion BNP : '));const link=document.createElement('a');link.href='./bank-connect.html';link.target='_blank';link.rel='noopener';link.textContent='Continuer';$('bankStatus').append(link)}};
$('syncBank').onclick=()=>syncBank(true);
$('bankAccount').onchange=()=>{bankAccountId=$('bankAccount').value;data=[];bankBalance=null;bankFresh=false;refresh();syncBank(true)};
$('disconnectBank').onclick=async()=>{if(bankBusy)return;bankBusy=true;bankControls(true);try{await bankRequest('disconnect',{});localStorage.removeItem(keys.bank);localStorage.removeItem(keys.linked);bankActive=false;bankFresh=false;bankConnecting=false;bankAccounts=[];bankBalance=null;bankAccountId=null;bankLastSync=0;const stored=read(keys.tx,null);try{data=stored?validateImport(stored):buildDemo();demo=!stored}catch{data=buildDemo();demo=true}refresh();$('bankStatus').textContent='Banque déconnectée.'}catch(e){$('bankStatus').textContent=e.message}finally{bankBusy=false;bankControls(!!bankAccounts.length)}};
async function initBank(){if(bankChecking||bankBusy)return;bankChecking=true;try{const status=await bankRequest('status');if(!status.configured){$('bankStatus').textContent=bankMessages.configuration;$('connectBank').disabled=true;return}bankAccounts=status.connected?(status.accounts||[]):[];bankControls(status.connected);$('bankStatus').textContent=status.connected?'BNP connecté.':bankActive?'Connexion à rétablir. Dernières données conservées.':'BNP non connecté.';const select=$('bankAccount');select.replaceChildren();for(const a of bankAccounts){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o)}if(status.connected){bankConnecting=false;save(keys.linked,true);if(!bankAccounts.some(a=>a.id===bankAccountId)){bankAccountId=bankAccounts.find(a=>a.type==='CACC')?.id||bankAccounts[0]?.id||null;data=[];bankBalance=null}if(bankAccountId)select.value=bankAccountId;bankActive=true;bankFresh=false;demo=false;refresh();await syncBank(true)}}catch{$('bankStatus').textContent='Connexion indisponible.'+(bankUpdatedAt?' Dernières données conservées.':'');bankFresh=false;refresh();bankControls(!!bankAccounts.length)}finally{bankChecking=false}}
const bankQuery=new URL(location.href).searchParams.get('bank');if(bankQuery){history.replaceState(null,'',location.pathname);if(bankQuery!=='connected'){$('settings').showModal();$('bankStatus').textContent=bankMessages[bankQuery]||bankMessages.unavailable;toast(bankMessages[bankQuery]||bankMessages.unavailable)}}
initBank().then(()=>{if(bankQuery&&bankQuery!=='connected')$('bankStatus').textContent=bankMessages[bankQuery]||bankMessages.unavailable});
function resumeBank(){if(bankBusy||document.hidden)return;if(bankConnecting||(!bankAccounts.length&&bankActive))initBank();else if(bankAccounts.length)syncBank()}window.addEventListener('focus',resumeBank);document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeBank()});window.addEventListener('pageshow',e=>{if(e.persisted)resumeBank()});setInterval(resumeBank,600000);

// The callback window signals completion; credentials remain in HttpOnly cookies.
function bankReturned(message){if(message?.type!=='bank-return')return;bankConnecting=false;initBank()}
try{const channel=new BroadcastChannel('money-bubble-bank');channel.onmessage=e=>bankReturned(e.data)}catch{}
window.addEventListener('storage',e=>{if(e.key==='money-bubble-bank-return'){try{bankReturned(JSON.parse(e.newValue))}catch{}}});
// Restore the screen after automatic release activation, including an open settings sheet.
try{const view=JSON.parse(sessionStorage.getItem('money-bubble-update-view'));sessionStorage.removeItem('money-bubble-update-view');if(view){if(validDate(view.selected))selected=view.selected;if(['day','week','month'].includes(view.mode))changeMode(view.mode);refresh();if(view.settings&&!$('settings').open)$('settings').showModal()}}catch{}
