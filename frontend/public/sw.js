const CACHE='cp-public-v2-dataset';
const PUBLIC=['/offline.html','/offline.js','/offline.css','/products/dataset-placeholder.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cp-public-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET')return;
 // Never cache API responses or authenticated HTML/RSC. Offline navigation uses a static shell.
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}
 if(u.pathname.startsWith('/products/')&&u.pathname.endsWith('.svg')||PUBLIC.includes(u.pathname))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;})));
});
