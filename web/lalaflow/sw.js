// Minimal service worker so LalaFlow can be installed to the home screen.
// It caches nothing: pages and API data always come from the network, so there is no stale-content risk.
// Only page navigations are handled, to show a readable message instead of the browser error when offline.

const OFFLINE_PAGE = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>LalaFlow – mất kết nối</title></head>
<body style="font-family:system-ui,sans-serif;background:#fff9ef;color:#3b2a1d;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-size:1.4rem">Không có kết nối mạng</h1><p>Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:999px;border:2px solid #6b4423;background:#2f6d8c;color:#fff">Thử lại</button></div>
</body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
