const CACHE='onda-pilot-v1-0-1',FILES=['./','./index.html','./style.css','./app.js','./audio.js','./codec.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('onda-pilot-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request,{ignoreSearch:true}))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_CACHE')e.waitUntil(caches.open(CACHE).then(async c=>{const matches=await Promise.all(FILES.map(f=>c.match(f)));e.ports[0]?.postMessage({ready:matches.every(Boolean)});}));});
