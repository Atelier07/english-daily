// Âm thanh: dùng course/audio/<id>.mp3 nếu có (danh sách trong course/audio/index.json),
// không thì đọc bằng giọng máy en-US, chọn giọng tự nhiên nhất có sẵn.

let manifest = null;      // Promise<Set<string>>
let current = null;       // Audio đang phát
let voice = null;

function loadManifest() {
  if (manifest) return manifest;
  manifest = fetch('course/audio/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .then((j) => new Set(Array.isArray(j) ? j : (j && Array.isArray(j.ids) ? j.ids : [])))
    .catch(() => new Set());
  return manifest;
}
export async function hasMp3(id) {
  if (!id) return false;
  const set = await loadManifest();
  return set.has(id);
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
  try { if (current) { current.pause(); current = null; } } catch (e) { /* ignore */ }
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
  if (await hasMp3(line.id)) {
    return new Promise((resolve) => {
      const a = new Audio(`course/audio/${line.id}.mp3`);
      a.playbackRate = rate;
      current = a;
      a.onended = () => resolve();
      a.onerror = () => { speak(line.text || line.en || '', rate).then(resolve); };
      a.play().catch(() => speak(line.text || line.en || '', rate).then(resolve));
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
