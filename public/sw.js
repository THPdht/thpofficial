// Service worker for NK mentorship portal
// Handles daily reminder notifications for tracker and challenge

const REMINDER_HOUR = 8; // 8am
const EVENING_HOUR = 19;  // 7pm fallback if no morning check-in
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // check every 30 minutes

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
  scheduleDailyChecks();
});

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

async function getCheckinState() {
  try {
    const cache = await caches.open('mn-sw-state');
    const res = await cache.match('/sw-state');
    if (!res) return null;
    return await res.json();
  } catch { return null; }
}

async function setCheckinState(state) {
  try {
    const cache = await caches.open('mn-sw-state');
    await cache.put('/sw-state', new Response(JSON.stringify(state)));
  } catch { /* ignore */ }
}

async function maybeFireReminder() {
  const hour = new Date().getHours();
  const today = todayKey();

  const state = await getCheckinState();
  const alreadyNotifiedToday = state?.notifiedDate === today;
  const hasCheckedIn = state?.lastCheckIn === today;

  if (hasCheckedIn || alreadyNotifiedToday) return;

  // Morning window (8am–11am) or evening fallback (7pm+)
  const inMorningWindow = hour >= REMINDER_HOUR && hour < 11;
  const inEveningWindow = hour >= EVENING_HOUR;
  if (!inMorningWindow && !inEveningWindow) return;

  const body = inMorningWindow
    ? "Start your day right. Log your tracker and complete today's challenge."
    : "You have not checked in yet today. Take two minutes now.";

  self.registration.showNotification('NK Portal', {
    body,
    icon: '/nikodem.jpg',
    badge: '/nikodem.jpg',
    tag: 'daily-reminder',
    renotify: true,
  });

  await setCheckinState({ ...state, notifiedDate: today });
}

function scheduleDailyChecks() {
  setInterval(maybeFireReminder, CHECK_INTERVAL_MS);
  // Also fire immediately in case we just activated mid-day
  maybeFireReminder();
}

// Web Push: incoming message from server
self.addEventListener('push', e => {
  let data = { title: 'Nikodem', body: 'You have a new message', icon: '/nikodem.jpg', badge: '/nikodem.jpg', url: '/dashboard' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch { /* ignore */ }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: 'new-message',
      renotify: true,
      data: { url: data.url },
    })
  );
});

// Client can post messages to update the SW state
self.addEventListener('message', async e => {
  if (e.data?.type === 'CHECK_IN_DONE') {
    const state = await getCheckinState();
    await setCheckinState({ ...state, lastCheckIn: todayKey() });
  }
});

// On notification click: open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes('mentorship.nikodem.coach') || c.url.includes('localhost'));
      if (existing) return existing.focus();
      return self.clients.openWindow('https://mentorship.nikodem.coach/dashboard');
    })
  );
});
