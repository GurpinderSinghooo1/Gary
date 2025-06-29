/**
 * Market Signal Dashboard - Service Worker
 * Enhanced PWA functionality with offline support and caching
 */

const CACHE_NAME = 'market-signal-dashboard-v3.2';
const STATIC_CACHE = 'market-signal-static-v3.2';
const DATA_CACHE = 'market-signal-data-v3.2';
const DATA_CACHE_LIMIT = 30;

// Files to cache for offline functionality
const STATIC_FILES = [
    './',
    './index.html',
    './404.html',
    './css/styles.css',
    './js/app.js',
    './js/data-handler.js',
    './js/ui-components.js',
    './js/utils.js',
    './manifest.json',
    './icons/icon-192x192.svg',
    './icons/icon-72x72.svg'
];

// API endpoints to cache – direct (no proxy). To re-enable proxy, add it here.
const API_ENDPOINTS = [
    'https://script.google.com/macros/s/AKfycbxjC5rcbSwKzeXgFG2LU4hgkrVYGcufvyP301v7wat6t_55y2wxyudn6qmiT3j1O48/exec'
];

// Cache strategies
const CACHE_STRATEGIES = {
    STATIC: 'cache-first',
    API: 'network-first',
    IMAGES: 'stale-while-revalidate'
};

/**
 * Install event - cache static files
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            }),
            
            // Skip waiting to activate immediately
            self.skipWaiting()
        ]).catch((error) => {
            console.error('Service Worker install failed:', error);
        })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DATA_CACHE && 
                        cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Claim all clients immediately
            return self.clients.claim();
        }).catch((error) => {
            console.error('Service Worker activation failed:', error);
        })
    );
});

/**
 * Fetch event - handle different types of requests
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle different types of requests
    if (isStaticFile(url)) {
        event.respondWith(handleStaticFile(request));
    } else if (isApiCall(url)) {
        event.respondWith(handleApiRequest(request));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else {
        // Default network-first strategy
        event.respondWith(handleDefaultRequest(request));
    }
});

/**
 * Check if request is for a static file
 */
function isStaticFile(url) {
    const pathname = url.pathname;
    const scopePath = self.registration.scope.replace(self.location.origin, '');
    const relativePath = `.${pathname.replace(scopePath, '/')}`.replace(/\/\//g, '/');

    // Check against explicit list first, handling relative paths correctly.
    if (STATIC_FILES.includes(relativePath)) {
        return true;
    }

    // Fallback for other assets in cached directories.
    return pathname.includes('/css/') ||
           pathname.includes('/js/') ||
           pathname.endsWith('.html') ||
           pathname.endsWith('.json');
}

/**
 * Check if request is for API data
 */
function isApiCall(url) {
    return API_ENDPOINTS.some(endpoint => url.href.includes(endpoint)) ||
           url.pathname.includes('/api/') ||
           url.searchParams.has('data');
}

/**
 * Check if request is for an image
 */
function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url.pathname);
}

/**
 * Handle static file requests (cache-first strategy)
 */
async function handleStaticFile(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to network
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Static file fetch failed:', error);
        
        // Return offline page for HTML requests
        if (request.destination === 'document') {
            return caches.match('./index.html');
        }
        
        throw error;
    }
}

/**
 * Handle API requests (network-first strategy)
 */
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DATA_CACHE);
            await cache.put(request, networkResponse.clone());
            await trimDataCache();
        }
        
        return networkResponse;
    } catch (error) {
        console.log('API request failed, trying cache:', error);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // Add a header to indicate the response is from the cache.
            const newHeaders = new Headers(cachedResponse.headers);
            newHeaders.append('X-Served-From-Cache', 'true');
            
            const response = new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: newHeaders
            });

            return response;
        }
        
        // Return error response
        return new Response(
            JSON.stringify({ 
                error: 'Network unavailable', 
                cached: false,
                timestamp: new Date().toISOString()
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }
        );
    }
}

/**
 * Handle image requests (stale-while-revalidate strategy)
 */
async function handleImageRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        
        // Fetch from network in background
        const networkPromise = fetch(request).then((response) => {
            if (response.ok) {
                const cache = caches.open(STATIC_CACHE);
                cache.then(c => c.put(request, response.clone()));
            }
            return response;
        }).catch(() => null);
        
        // Return cached response if available, otherwise wait for network
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await networkPromise;
        if (networkResponse) {
            return networkResponse;
        }
        
        throw new Error('Image not available');
    } catch (error) {
        console.error('Image fetch failed:', error);
        throw error;
    }
}

/**
 * Handle default requests (network-first)
 */
async function handleDefaultRequest(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (error) {
        console.error('Default request failed:', error);
        throw error;
    }
}

/**
 * Trim data cache to DATA_CACHE_LIMIT entries
 */
async function trimDataCache() {
    const cache = await caches.open(DATA_CACHE);
    const keys = await cache.keys();
    if (keys.length <= DATA_CACHE_LIMIT) {
        return;
    }
    const excess = keys.length - DATA_CACHE_LIMIT;
    for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
    }
}

/**
 * Background sync for data updates
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        event.waitUntil(performBackgroundSync());
    }
});

/**
 * Perform background data sync
 */
async function performBackgroundSync() {
    try {
        // Attempt to fetch fresh data
        const response = await fetch(API_ENDPOINTS[0]);
        if (response.ok) {
            const data = await response.json();
            
            // Cache the fresh data
            const cache = await caches.open(DATA_CACHE);
            await cache.put(API_ENDPOINTS[0], response.clone());
            await trimDataCache();
            
            // Notify clients of data update
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'DATA_UPDATED',
                    timestamp: new Date().toISOString()
                });
            });
            
            console.log('Background sync completed successfully');
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

/**
 * Handle push notifications
 */
self.addEventListener('push', (event) => {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body || 'New market signals available',
                icon: './icons/icon-192x192.svg',
                badge: './icons/icon-72x72.svg',
                tag: 'market-signals',
                data: data,
                actions: [
                    {
                        action: 'view',
                        title: 'View Signals'
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss'
                    }
                ]
            };
            
            event.waitUntil(
                self.registration.showNotification('Market Signal Dashboard', options)
            );
        } catch (error) {
            console.error('Push notification error:', error);
        }
    }
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Focus existing window or open new one
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    // Use service worker scope to support subfolder hosting
                    return clients.openWindow(self.registration.scope);
                }
            })
        );
    }
});

/**
 * Handle message events from main thread
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_CACHE_INFO':
            event.ports[0].postMessage({
                cacheNames: ['static', 'data'],
                strategy: 'network-first for API, cache-first for static'
            });
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(clearAllCaches());
            break;
            
        case 'UPDATE_CACHE':
            event.waitUntil(updateStaticCache());
            break;
    }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared');
    } catch (error) {
        console.error('Failed to clear caches:', error);
    }
}

/**
 * Update static cache
 */
async function updateStaticCache() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.addAll(STATIC_FILES);
        console.log('Static cache updated');
    } catch (error) {
        console.error('Failed to update static cache:', error);
    }
}

/**
 * Error handling for service worker
 */
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully'); 