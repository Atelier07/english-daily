// Âm thanh: dùng course/audio/<id>.mp3 nếu có (danh sách trong course/audio/index.json),
// không thì đọc bằng giọng máy en-US, chọn giọng tự nhiên nhất có sẵn.

let manifest = null;      // Promise<{ids:Set, byText:Map}>
let current = null;       // Audio đang phát
let voice = null;

// iPhone/Android chặn new Audio() phát sau await hoặc nối tiếp câu này sang câu khác
// nếu không có chạm tay. Cách chữa: MỘT thẻ audio dùng chung, "mở khoá" ở lần chạm đầu,
// sau đó đổi src thoải mái.
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAAHAAADYABVVVVVVVVVVVVVVVVVVXFxcXFxcXFxcXFxcXFxjo6Ojo6Ojo6Ojo6Ojo6qqqqqqqqqqqqqqqqqqqrHx8fHx8fHx8fHx8fHx+Pj4+Pj4+Pj4+Pj4+Pj//////////////////8AAAAATGF2YzYwLjMuAAAAAAAAAAAAAAAAJAQgAAAAAAAAA2DibpoWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80TEAAAAA0gAAAAATEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEUwAAA0gAAAAAOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEpgAAA0gAAAAAOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
let el = null;
export function audioEl() {
  if (!el && typeof Audio !== 'undefined') {
    el = new Audio();
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    try { el.preservesPitch = true; } catch (e) { /* ignore */ }
  }
  return el;
}
let unlocked = false;
function unlock() {
  if (unlocked) return;
  const a = audioEl();
  if (!a) return;
  unlocked = true; // chỉ cần gọi play() một lần trong lúc chạm tay
  if (!a.paused) return;
  try {
    a.src = SILENT;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
  try { if (ttsSupported()) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { /* ignore */ }
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, unlock, { capture: true, passive: true }));
}

const norm = (t) => String(t || '').replace(/’/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
function loadManifest() {
  if (manifest) return manifest;
  manifest = fetch('course/audio/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .then((j) => ({
      ids: new Set(Array.isArray(j) ? j : (j && Array.isArray(j.ids) ? j.ids : [])),
      byText: new Map(Object.entries((j && j.byText) || {})),
    }))
    .catch(() => ({ ids: new Set(), byText: new Map() }));
  return manifest;
}
// trả về id file mp3 cho một dòng: theo id, không có thì theo nội dung câu
async function mp3Id(line) {
  const m = await loadManifest();
  if (line.id && m.ids.has(line.id)) return line.id;
  return m.byText.get(norm(line.text || line.en)) || null;
}
export async function hasMp3(id) {
  if (!id) return false;
  return (await loadManifest()).ids.has(id);
}

const GOOD = /(natural|neural|premium|enhanced|online|google us english|samantha|aria|jenny|ava|allison|alex)/i;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
    if (!vs.length) return null;
    return vs.find((v) => GOOD.test(v.name) && !/compact/i.test(v.name)) || vs.find((v) => v.localService === false) || vs[0];
  } catch (e) { return null; }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try { speechSynthesis.addEventListener('voiceschanged', () => { voice = pickVoice(); }); } catch (e) { /* ignore */ }
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function stop() {
  try { if (current) { current.onended = null; current.onerror = null; current.pause(); current = null; } } catch (e) { /* ignore */ }
  try { if (ttsSupported()) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

function speak(text, rate) {
  return new Promise((resolve) => {
    if (!ttsSupported()) { resolve(); return; }
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/…/g, ' ').replace(/\s+/g, ' ').trim());
      u.lang = 'en-US';
      u.rate = rate;
      voice = voice || pickVoice();
      if (voice) u.voice = voice;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // phòng khi trình duyệt không bắn onend
      setTimeout(finish, Math.max(2500, String(text).length * 140 / rate));
      speechSynthesis.speak(u);
    } catch (e) { resolve(); }
  });
}

// play({id, text}, {slow}) → Promise khi phát xong
export async function play(line, { slow = false } = {}) {
  stop();
  const rate = slow ? 0.8 : 1.0;
  const fid = await mp3Id(line);
  if (fid) {
    return new Promise((resolve) => {
      const a = audioEl();
      let done = false;
      const ok = () => { if (!done) { done = true; resolve(); } };
      const fail = () => { if (!done) { done = true; speak(line.text || line.en || '', rate).then(resolve); } };
      a.onended = ok;
      a.onerror = fail;
      a.src = `course/audio/${fid}.mp3`;
      a.playbackRate = rate;
      a.defaultPlaybackRate = rate;
      current = a;
      const p = a.play();
      if (p && p.catch) p.catch(fail);
    });
  }
  return speak(line.text || line.en || '', rate);
}

export async function playAll(lines, opts) {
  for (const l of lines) {
    // eslint-disable-next-line no-await-in-loop
    await play(l, opts);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 350));
  }
}
