const CACHE_NAME = 'k213-cache-v1';
const CORE_FILES = [
  './index.html',
  './cliente.html',
  './profissional.html',
  './relatorios.html',
  './style.css?v=4',
  './app-common.js?v=4',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// estratégia: tenta a rede primeiro (pra sempre pegar dados novos do
// Supabase), cai pro cache só se estiver offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* As notificações push agora são tratadas pelo service worker próprio da
   OneSignal, registrado à parte em /onesignal/OneSignalSDKWorker.js com
   escopo restrito a essa subpasta — por isso não há mais um listener de
   'push' aqui. Manter os dois workers com escopos diferentes evita conflito
   entre o cache deste worker e o registro de push da OneSignal. */
