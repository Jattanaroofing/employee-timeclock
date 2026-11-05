// Shiftora helper file (sw.js). Upload it next to index.html, in the same folder.
// It shows Shiftora alerts on your phone as real notifications, even when the app is closed.
// It stores nothing and only talks to your phone's own notification system.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const APP = 'Shiftora';
const SW_VERSION = '26';   // shown in the app (Notifications → Phone alerts), so you can tell the new file is in use

// The app asks which version of this helper is running
self.addEventListener('message', (e) => {
  if (e.data && e.data.ask === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: SW_VERSION });
});
// Alert style (Notifications → Phone alerts → Alert style). "no-title": iPhone's own "from Shiftora" line comes
// first, then the alert ("Dil clocked in") and the details. iPhones use it unless "normal" was chosen.
async function alertStyle() {
  try {
    const r = await (await caches.open('shiftora-settings')).match('alert-style');
    if (r) return await r.text();
  } catch { /* not available: use the default */ }
  return /iPhone|iPad|iPod/.test((self.navigator && self.navigator.userAgent) || '') ? 'no-title' : 'normal';
}

// An alert arrives from the push-alerts function (already decrypted by the phone)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Shiftora', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Shiftora';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ alert: d }));           // an open app refreshes its bell at once
    try { if (self.navigator.setAppBadge && typeof d.unread === 'number') await self.navigator.setAppBadge(d.unread); } catch { /* optional */ }
    // (iPhone always adds a "from Shiftora" line to alerts from Home Screen web apps; no web app can remove it)
    const noTitle = (await alertStyle()) === 'no-title';
    // An empty title makes iPhone show the app name instead, so the title is an invisible character
    await self.registration.showNotification(noTitle ? '\u200B' : title, {
      body: noTitle ? [title, d.body || ''].filter(Boolean).join('\n') : (d.body || ''),
      tag: d.id || undefined, icon: 'app-icon.png', badge: 'app-icon.png',
      timestamp: Date.now(), data: { link: d.link || 'admin/notifications' },
    });
  })());
});

// Tapping an alert opens Shiftora on the right page
self.addEventListener('notificationclick', (e) => {
  // The lock screen card: open Shiftora at Clock out / Start lunch / End lunch (or the shift sheet).
  // The card stays until the shift ends (the app removes it at clock-out).
  if (e.notification.data && e.notification.data.live) {
    const act = e.action || 'open';
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.postMessage({ live: act }); return c.focus(); }
      }
      return self.clients.openWindow(new URL('./#/home?live=' + act, self.registration.scope).href);
    }));
    return;
  }
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || 'admin/notifications';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage({ go: link }); return c.focus(); }
    }
    return self.clients.openWindow(new URL('./#/' + link, self.registration.scope).href);
  }));
});

// The browser renewed this phone's push address: tell the app to save the new one next time it opens
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ resubscribe: true }))));
});
