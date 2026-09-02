const CACHE_NAME = "bia-pwa-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('Erro ao cachear:', error))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  
  // Ignorar requisições não-GET
  if (req.method !== "GET") return;
  
  // Para navegação (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  
  // Para outros recursos
  event.respondWith(
    caches.match(req)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(req)
          .then(res => {
            // Não cachear respostas de erro ou da API
            if (!res || res.status !== 200 || res.type !== 'basic') {
              return res;
            }
            
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
            return res;
          })
          .catch(() => {
            // Fallback para ícones ou imagens se disponíveis
            if (req.url.match(/\.(png|svg|jpg|jpeg|gif|ico)$/)) {
              return caches.match("./favicon.ico");
            }
          });
      })
  );
});