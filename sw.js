// Service worker — offline app shell + runtime caching for law pages, data, and fonts.
// AI calls (Groq/Cerebras/Gemini) are cross-origin and intentionally NOT cached → they
// just fail gracefully offline, exactly as the app already handles a network error.
// Bump VERSION to force a fresh shell + drop old caches on the next visit.
'use strict';

var VERSION = 'v1';
var SHELL = 'shell-' + VERSION;
var RUNTIME = 'runtime-' + VERSION;

// Stable app shell — precached on install (relative URLs resolve against the SW scope,
// so this works under the GitHub project-page base path /Jur/ too).
var SHELL_ASSETS = [
  'index.html', 'ligjet.html', 'mjete-ai.html',
  'site.css', 'site.js', 'ai.js', 'style.css', 'app.js',
  'manifest.webmanifest', 'icon.svg', 'data/laws.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // Per-asset add() so one missing file doesn't abort the whole install.
      return Promise.all(SHELL_ASSETS.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  var sameOrigin = url.origin === self.location.origin;
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.host);
  if (!sameOrigin && !isFont) return; // AI APIs etc. → straight to network, never cached.

  // Stale-while-revalidate: serve cache instantly, refresh in the background.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(RUNTIME).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        // Offline + uncached navigation → fall back to the cached app shell.
        if (req.mode === 'navigate') return caches.match('index.html');
        return cached;
      });
      return cached || network;
    })
  );
});
