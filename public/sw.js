// sw.js — Service Worker VNTEND
// Cache das páginas principais para acesso offline

const CACHE = "vntend-v1";
const PRECACHE = ["/", "/visao", "/lancamentos", "/investimentos", "/ir", "/contracheque"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Só intercepta GET, ignora Supabase e APIs externas
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname.includes("supabase") || url.hostname.includes("yahoo")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Atualiza cache com resposta fresca
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || Response.error()))
  );
});
