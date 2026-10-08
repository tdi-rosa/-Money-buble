const CACHE='money-bubble-shell-fdc8363b22485253a3af';
const SHELL=['./','./index.html','./style.css','./app.js','./core.js','./bubble-layout.js','./layout-worker.js','./bank-state.js','./physics.js','./periods.js','./updates.js','./bank-window.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{for(const path of SHELL){const res=await fetch(path,{cache:'reload'});if(!res.ok||res.redirected)throw Error('App shell unavailable');await c.put(path,res)}})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('bulles-shell-')||k.startsWith('money-bubble-shell-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
// Versioned shell stays coherent; financial data and callback URLs never enter the cache.
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||url.search||url.pathname.includes('/api/'))return;if(!SHELL.some(p=>new URL(p,self.registration.scope).pathname===url.pathname))return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)))});
