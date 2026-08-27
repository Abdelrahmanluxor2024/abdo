'use strict';
/* Season Runner — offline cache */
const CACHE = 'season-runner-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/util.js', './js/data.js', './js/audio.js', './js/fx.js',
  './js/obstacles.js', './js/player.js', './js/game.js',
  './js/input.js', './js/codes.js', './js/ui.js', './js/main.js',
  './assets/fonts/cairo/cairo-arabic-400-normal.woff2',
  './assets/fonts/cairo/cairo-arabic-600-normal.woff2',
  './assets/fonts/cairo/cairo-arabic-700-normal.woff2',
  './assets/fonts/cairo/cairo-arabic-800-normal.woff2',
  './assets/fonts/cairo/cairo-arabic-900-normal.woff2',
  './assets/fonts/cairo/cairo-latin-400-normal.woff2',
  './assets/fonts/cairo/cairo-latin-600-normal.woff2',
  './assets/fonts/cairo/cairo-latin-700-normal.woff2',
  './assets/fonts/cairo/cairo-latin-800-normal.woff2',
  './assets/fonts/cairo/cairo-latin-900-normal.woff2',
  './assets/fonts/lilita/lilita-one-latin-400-normal.woff2',
  './assets/fonts/lilita/lilita-one-latin-ext-400-normal.woff2',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
