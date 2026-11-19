/* Service Worker handler for background call notifications & ringtone actions */

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SHOW_CALL_NOTIFICATION') {
    const { sessionId, callerName, surahLabel, ayahRange, lang } = data;
    const isAr = lang !== 'en';
    const title = isAr
      ? `مكالمة سرد ثنائي واردة من ${callerName || 'صديق'}`
      : `Incoming Duo Sard Call from ${callerName || 'Friend'}`;
    const body = isAr
      ? `${surahLabel || 'تلاوة ومراجعة'} (${ayahRange || ''}) — اضغط للرد والبدء`
      : `${surahLabel || 'Quran Recitation'} (${ayahRange || ''}) — Tap to answer`;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `alutrujjah-call-${sessionId}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [350, 150, 350, 150, 350, 150, 350],
        data: {
          sessionId,
          url: `/?duo=${encodeURIComponent(sessionId)}`,
        },
        actions: [
          { action: 'answer', title: isAr ? 'ردّ الآن' : 'Answer' },
          { action: 'decline', title: isAr ? 'رفض' : 'Decline' },
        ],
      })
    );
  }

  if (data.type === 'CLOSE_CALL_NOTIFICATION' && data.sessionId) {
    event.waitUntil(
      self.registration
        .getNotifications({ tag: `alutrujjah-call-${data.sessionId}` })
        .then((list) => list.forEach((n) => n.close()))
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'مكالمة سرد ثنائي واردة', body: event.data ? event.data.text() : '' };
  }
  const sessionId = payload.sessionId || '';
  const callerName = payload.callerName || 'صديق';
  const title = payload.title || `مكالمة واردة من ${callerName}`;
  const body = payload.body || 'اضغط للانضمام إلى جلسة السرد الثنائي المباشرة';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: sessionId ? `alutrujjah-call-${sessionId}` : 'alutrujjah-call',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [400, 150, 400, 150, 400],
      data: {
        sessionId,
        url: sessionId ? `/?duo=${encodeURIComponent(sessionId)}` : '/',
      },
      actions: [
        { action: 'answer', title: 'ردّ الآن' },
        { action: 'decline', title: 'رفض' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action || 'answer';
  const data = notification.data || {};
  const sessionId = data.sessionId || '';
  notification.close();

  const targetUrl = sessionId
    ? `/?duo=${encodeURIComponent(sessionId)}&callAction=${encodeURIComponent(action)}`
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'CALL_NOTIFICATION_ACTION',
            sessionId,
            action,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
