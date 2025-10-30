// Service Worker para Ponto Menos
const CACHE_NAME = 'ponto-menos-v3';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './api.js',
  './ponto.js',
  './config.js',
  './credentials.js'
];

// Instalação - cachear recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - estratégia Network First (para sempre ter dados frescos da API)
self.addEventListener('fetch', event => {
  // Apenas para GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta é válida, cacheia e retorna
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tenta buscar do cache
        return caches.match(event.request).then(response => {
          return response || new Response('Offline - sem cache disponível', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

