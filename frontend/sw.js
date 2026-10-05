const CACHE = "palmtrace-v183";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css?v=183",
  "./js/auth.js?v=183",
  "./js/store.js?v=183",
  "./js/api.js?v=183",
  "./js/audit.js?v=183",
  "./js/i18n.js?v=183",
  "./js/voice-intent.js?v=183",
  "./js/ai-hub.js?v=183",
  "./js/investors_hub.js?v=183",
  "./js/app/01-core.js?v=183",
  "./js/app/02-layout.js?v=183",
  "./js/app/03-field.js?v=183",
  "./js/app/04-palm-plot.js?v=183",
  "./js/app/05-activity.js?v=183",
  "./js/app/06-dashboard.js?v=183",
  "./js/app/07-users.js?v=183",
  "./js/app/08-operations.js?v=183",
  "./js/app/09-yields-zakat.js?v=183",
  "./js/app/10-reports.js?v=183",
  "./js/app/11-nursery-inventory-audit.js?v=183",
  "./js/app/12-settings-investor.js?v=183",
  "./js/app/13-imports-gis-bind.js?v=183",
  "./js/app/14-actions-01.js?v=183",
  "./js/app/14-actions-02.js?v=183",
  "./js/app/14-actions-03.js?v=183",
  "./js/app/14-actions-04.js?v=183",
  "./js/app/14-actions-05.js?v=183",
  "./js/app/14-actions-06.js?v=183",
  "./js/app/14-actions-07.js?v=183",
  "./js/app/14-actions-08.js?v=183",
  "./js/app/14-actions-09.js?v=183",
  "./js/app/15-actions-dispatch.js?v=183",
  "./js/app/16-boot.js?v=183",
  "./js/voice-assistant.js?v=183",
  "./manifest.json"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(err => console.warn("SW install cache warning:", err))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // 1. لا تعترض أي طلبات موجهة للـ API أو الباك إند (Port 3000 أو مسارات /api)
  if (url.port === "3000" || url.pathname.startsWith("/api") || url.pathname.includes("/api/")) {
    return; // تمرير مباشر للشبكة دون اعتراض لضمان دقة كشف الأوفلاين
  }

  // 2. معالجة طلبات GET فقط (لا يتم تخزين POST أو PUT أو DELETE في الكاش)
  if (e.request.method !== "GET") {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== "basic") {
          return res;
        }
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(err => {
        // إرجاع index.html فقط عند محاولة التنقل في شريط عنوان المتصفح في وضع عدم الاتصال
        if (e.request.mode === "navigate") {
          return caches.match("./index.html") || caches.match("./");
        }
        throw err;
      });
    })
  );
});
