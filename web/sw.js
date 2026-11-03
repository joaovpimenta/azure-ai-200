/**
 * Service Worker: Azure AI-200 Study Hub
 * Versioned Offline Cache with Stale-While-Revalidate and Network-First routing.
 */

const CACHE_NAME = 'azure-ai-200-cache-v1';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './reader.js',
  './audio-player.js',
  './quiz-core.js',
  './progress-core.js',
  './cram.js',
  './simulator.js',
  './mastery.js',
  './mermaid-theme.js',
  './manifest.webmanifest',
  './data/blueprint.json',
  './data/catalog.json',
  './data/cram-index.json',
  './data/questions.json',
  './cram/index.html',
  './simulator/index.html',
  './mastery/index.html',
  './favicon.ico'
];

// 1. Install Event: Pre-cache core shell and data
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use resilient individual caching so one missing asset does not abort install
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Precache skipped for ${asset}: ${err.message}`);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('azure-ai-200-cache-') && key !== CACHE_NAME)
          .map((oldKey) => {
            console.log(`[SW] Purging old cache: ${oldKey}`);
            return caches.delete(oldKey);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event: Allow clients to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch Event: Strategic Cache Routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. Non-GET requests (e.g. POST/PATCH for Gist sync or analytics) -> Network-Only
  if (request.method !== 'GET') {
    return;
  }

  // B. External API endpoints (GitHub Gist API, Releases) -> Network-Only (bypass cache)
  if (url.hostname === 'api.github.com' || url.pathname.includes('/gists')) {
    return;
  }

  // C. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://, moz-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // D. HTML Navigation / Document requests -> Network-First with Cache Fallback
  const isHtml = request.mode === 'navigate' ||
                 request.destination === 'document' ||
                 (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  // E. Static Assets (CSS, JS, JSON data, images, fonts) -> Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/**
 * Network-First Strategy for HTML documents.
 * Fetches latest version from network, updates cache, falls back to cache on offline.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstHtml(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    // SPA fallback to cached index.html or root
    const fallback = await caches.match('./index.html') || await caches.match('./');
    if (fallback) return fallback;

    return new Response(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Offline — AI-200</title><link rel="stylesheet" href="./styles.css"></head><body style="padding:2rem;text-align:center;font-family:sans-serif;"><h1>Dispositivo Offline</h1><p>Esta página ainda não foi sincronizada para leitura offline. Conecte-se à internet para carregá-la.</p><p><a href="./index.html">Voltar ao Início</a></p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Stale-While-Revalidate Strategy for Static Assets.
 * Returns cached version immediately if available while asynchronously updating cache.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkFetchPromise = fetch(request)
    .then((networkResponse) => {
      // Only cache valid basic or CORS responses
      if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || (await networkFetchPromise);
}
