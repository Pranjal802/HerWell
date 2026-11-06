// HerWell Web Push Notifications handler
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { title: "HerWell reminder", body: event.data?.text() || "A reminder is ready." };
  }
  const title = payload.title || "HerWell reminder";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "A reminder you chose for your HerWell space.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.notificationId || undefined,
      data: { url: payload.url || "/reminders", notificationId: payload.notificationId },
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/reminders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) return existing.navigate(target).then(() => existing.focus());
      return self.clients.openWindow(target);
    })
  );
});

