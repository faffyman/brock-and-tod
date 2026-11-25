// Brock & Tod service worker. Network first, offline copy as the fallback.
// IMPORTANT: any new file the game needs (JS, CSS, image) must be added to PRECACHE below,
// otherwise it will not be available offline.
const CACHE = 'trailbadger';
const NETWORK_TIMEOUT_MS = 3000;

const PRECACHE = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/game.css',
    'js/audio.js',
    'js/config.js',
    'js/input.js',
    'js/main.js',
    'js/pwa.js',
    'js/storage.js',
    'js/world.js',
    'js/render/anim.js',
    'js/render/cockpit.js',
    'js/render/indicator.js',
    'js/render/scene.js',
    'js/render/sprites.js',
    'assets/img/trailbadger-logo.webp',
    'assets/img/icon-180.png',
    'assets/img/icon-192.png',
    'assets/img/icon-512.png'
];

function scoped(path) {
    return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(PRECACHE.map(async (path) => {
            const response = await fetch(scoped(path), { cache: 'reload' });
            if (!response.ok) throw new Error('Precache failed: ' + path);
            await cache.put(scoped(path), response);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});

function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    return fetch(url, { cache: 'no-cache', signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await fetchWithTimeout(request.url);
        if (response && response.ok) {
            await cache.put(request.url, response.clone());
            return response;
        }
        throw new Error('Bad response');
    } catch (err) {
        const cached = await cache.match(request.url, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
            const page = (await cache.match(scoped('./'))) || (await cache.match(scoped('index.html')));
            if (page) return page;
        }
        return Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(networkFirst(request));
});
