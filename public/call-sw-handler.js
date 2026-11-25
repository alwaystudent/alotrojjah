// Service Worker Call Notification Handler for Al-Utrujjah Duo Recitation
// Handles persistent incoming call notifications, Answer/Decline actions, and push payloads.

const CALL_TAG_PREFIX = 'duo-call-';

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SHOW_CALL_NOTIFICATION' && data.sessionId) {
    const sessionId = String(data.sessionId);
    const lang = data.lang === 'en' ? 'en' : 'ar';
    const callerName = data.callerName ? String(data.callerName) : (lang === 'ar' ? 'صديق' : 'Friend');
    const detailsParts = [];
    if (data.surahLabel) detailsParts.push(String(data.surahLabel));
    if (data.ayahRange) {
      detailsParts.push(lang === 'ar' ? `الآيات ${data.ayahRange}` : `Ayahs ${data.ayahRange}`);
    }

    const title = lang === 'ar'
      ? `مكالمة سرد ثنائي من ${callerName}`
      : `Incoming Duo Call from ${callerName}`;
    const body = detailsParts.length > 0
      ? detailsParts.join(' · ')
      : (lang === 'ar' ? 'اضغط للرد أو الرفض' : 'Tap to Answer or Decline');

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: `${CALL_TAG_PREFIX}${sessionId}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 120, 250, 120, 400],
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { sessionId },
        actions: [
          { action: 'answer', title: lang === 'ar' ? 'ردّ الآن' : 'Answer' },
          { action: 'decline', title: lang === 'ar' ? 'رفض' : 'Decline' },
        ],
      })
    );
  }

  if (data.type === 'CLOSE_CALL_NOTIFICATION') {
    const targetTag = data.sessionId ? `${CALL_TAG_PREFIX}${String(data.sessionId)}` : null;
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((n) => {
          if (targetTag ? n.tag === targetTag : String(n.tag || '').startsWith(CALL_TAG_PREFIX)) {
            n.close();
          }
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (!payload || payload.type !== 'INCOMING_DUO_CALL' || !payload.sessionId) return;
  const sessionId = String(payload.sessionId);
  const lang = payload.lang === 'en' ? 'en' : 'ar';
  const callerName = payload.callerName ? String(payload.callerName) : (lang === 'ar' ? 'صديق' : 'Friend');

  event.waitUntil(
    self.registration.showNotification(
      lang === 'ar' ? `مكالمة سرد ثنائي من ${callerName}` : `Incoming Duo Call from ${callerName}`,
      {
        body: payload.body || (lang === 'ar' ? 'مكالمة تسميع صوتية واردة' : 'Incoming audio recitation call'),
        tag: `${CALL_TAG_PREFIX}${sessionId}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 120, 250, 120, 400],
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { sessionId },
        actions: [
          { action: 'answer', title: lang === 'ar' ? 'ردّ الآن' : 'Answer' },
          { action: 'decline', title: lang === 'ar' ? 'رفض' : 'Decline' },
        ],
      }
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const sessionId = notification?.data?.sessionId ? String(notification.data.sessionId) : '';
  notification.close();

  if (!sessionId) return;
  const action = event.action === 'decline' ? 'decline' : 'answer';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList && clientList.length > 0) {
        const primaryClient = clientList.find((c) => c.focused) || clientList[0];
        if (action === 'answer' && typeof primaryClient.focus === 'function') {
          primaryClient.focus().catch(() => {});
        }
        clientList.forEach((client) => {
          client.postMessage({
            type: 'CALL_NOTIFICATION_ACTION',
            sessionId,
            action,
          });
        });
        return;
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(
          `/?duo=${encodeURIComponent(sessionId)}&callAction=${encodeURIComponent(action)}`
        );
      }
      return undefined;
    })
  );
});
