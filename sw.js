// Service worker: lưu sẵn khung ứng dụng để mở được khi mất mạng.
// YouTube và các dịch vụ Google video KHÔNG bao giờ bị cache.
const VERSION = 'ed-v12';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/store.js',
  './js/util.js',
  './js/ui.js',
  './js/timer.js',
  './js/srs.js',
  './js/weekly.js',
  './js/prompts.js',
  './js/views/today.js',
  './js/views/shadow.js',
  './js/views/phrases.js',
  './js/views/speak.js',
  './js/views/errors.js',
  './js/views/progress.js',
  './js/views/why.js',
  './js/views/data.js',
  './js/views/roadmap.js',
  './js/views/pron.js',
  './js/views/library.js',
  './js/views/settings.js',
  './js/sync.js',
  './js/ai.js',
  './js/summary.js',
  './js/roadmap.js',
  './js/evidence.js',
  './js/library.js',
  './js/comprehension.js',
  './js/doubt.js',
  './js/recorder.js',
  './js/dictation.js',
  './js/placement.js',
  './js/profile.js',
  './js/items.js',
  './js/course.js',
  './js/audio.js',
  './js/stt.js',
  './js/session.js',
  './js/stories.js',
  './js/pronweak.js',
  './js/freetalk.js',
  './js/data/ngsl.js',
  './js/views/course.js',
  './js/views/placement.js',
];
const NEVER = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|ggpht\.com|doubleclick\.net|api\.github\.com|generativelanguage\.googleapis\.com)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))).then(() => Promise.all(['./course/index.json', './course/audio/index.json'].map((u) => c.add(u).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.test(url.hostname)) return; // để trình duyệt tự xử lý, không cache

  // Font Google: dùng bản đã lưu, cập nhật ngầm
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Âm thanh/ghi âm: KHÔNG đi qua service worker. Safari iPhone đòi phản hồi 206 (tải từng đoạn),
  // đi qua SW là audio im lặng.
  if (req.destination === 'audio' || req.destination === 'video' || req.headers.has('range') || /\.(mp3|m4a|wav|ogg|webm)$/i.test(url.pathname)) return;

  // course/index.json (precache) và course/days/*.json: luôn thử mạng trước để bài mới lên ngay, mất mạng dùng bản đã lưu.
  // Cùng nguồn: ưu tiên mạng (để bản mới lên ngay), mất mạng thì dùng cache.
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((r) => {
        // chỉ lưu phản hồi đầy đủ (200); bỏ qua 206 (audio tải từng đoạn)
        if (r.status === 200) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
        return r;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
  );
});
