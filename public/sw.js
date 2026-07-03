// THP Portal Service Worker
// Handles push notifications and daily tracker reminders

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Web Push: incoming notification from server
self.addEventListener('push', e => {
  let data = { title: 'THP', body: 'You have a notification', icon: '/images/thprebrandlogo2.png', url: '/dashboard' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch { /* ignore */ }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.icon,
      tag: 'thp-notification',
      renotify: true,
      data: { url: data.url },
    })
  );
});

// Notification click: open the app at the correct deep-linked URL
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url ?? '/dashboard';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if already open
      const existing = clients.find(c => c.url.includes('thpofficial.com') || c.url.includes('localhost'));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
        return;
      }
      return self.clients.openWindow('https://thpofficial.com' + targetUrl);
    })
  );
});

// Message from client: tracker submitted
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_IN_DONE') {
    // Nothing to persist — dashboard handles state
  }
});
