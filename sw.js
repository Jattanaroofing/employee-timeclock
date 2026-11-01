// Shiftora helper file (sw.js). Upload it next to index.html, in the same folder.
// It shows Shiftora alerts on your phone as real notifications, even when the app is closed.
// It stores nothing and only talks to your phone's own notification system.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const APP = 'Shiftora';
// Alert style chosen in the app (Notifications → Phone alerts); iPhones use the short style unless it was turned off
async function shortStyle() {
  try {
    const c = await caches.open('shiftora-settings');
    const r = await c.match('alert-style');
    if (r) return (await r.text()) === 'short';
  } catch { /* not available: use the default */ }
  return /iPhone|iPad|iPod/.test((self.navigator && self.navigator.userAgent) || '');
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
    // iPhone adds a "from Shiftora" line under any title that isn't the app's own name. In the
    // short style the app name is the title and the event goes into the text instead.
    const compact = await shortStyle();
    await self.registration.showNotification(compact ? APP : title, {
      body: compact ? [title === APP ? '' : title, d.body || ''].filter(Boolean).join('\n') : (d.body || ''),
      tag: d.id || undefined, icon: 'app-icon.png', badge: 'app-icon.png',
      timestamp: Date.now(), data: { link: d.link || 'admin/notifications' },
    });
  })());
});

// Tapping an alert opens Shiftora on the right page
self.addEventListener('notificationclick', (e) => {
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
