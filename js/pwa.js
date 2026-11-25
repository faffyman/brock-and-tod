// Service worker registration and install prompt helpers.

let deferredPrompt = null;
const listeners = [];

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
        try {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        } catch (e) {
            // Ignore: the game works without a service worker.
        }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
}

function notify() {
    for (const cb of listeners) cb(deferredPrompt !== null);
}

// callback(available: boolean) runs whenever install availability changes.
export function onInstallAvailable(callback) {
    listeners.push(callback);
}

export function isInstallAvailable() {
    return deferredPrompt !== null;
}

export async function promptInstall() {
    const event = deferredPrompt;
    if (!event) return;
    deferredPrompt = null;
    notify();
    try {
        event.prompt();
        await event.userChoice;
    } catch (e) {
        // Ignore a dismissed or failed prompt.
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
});

export function isStandalone() {
    try {
        if (window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches) {
            return true;
        }
    } catch (e) {
        // matchMedia unavailable
    }
    return navigator.standalone === true;
}

export function isIos() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}
