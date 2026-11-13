// Toàn bộ dữ liệu nằm trong localStorage, một khoá duy nhất.
// Mọi lần đọc/ghi đều bọc try/catch (Safari private mode, bộ nhớ đầy...).

const KEY = 'englishDaily.v1';
const listeners = new Set();

export const BLOCKS = {
  input:  { name: 'Nghe/đọc thứ bạn thích', short: 'Nghe/đọc', min: 30, max: 45 },
  shadow: { name: 'Shadowing', short: 'Shadowing', min: 10, max: 15 },
  speak:  { name: 'Nói ra', short: 'Nói ra', min: 10, max: 10 },
  review: { name: 'Ôn cụm từ', short: 'Ôn cụm', min: 5, max: 10 },
};

function defaults() {
  return {
    version: 1,
    sessions: [],   // {id, date, block, minutes, note, manual, ts}
    phrases: [],    // {id, phrase, sentence, meaning, source, created, ef, interval, reps, due, lapses, lastReview}
    errors: [],     // {id, wrong, right, note, seen, fixed, created, updated}
    toeic: [],      // {id, date, score, note}
    videos: [],     // {videoId, url, title, lastUsed}
    speakLog: [],   // {date, words, seconds}
    timer: null,    // {block, startedAt}
    reader: { text: '', source: '' },
    promptShift: { date: '', n: 0 },
  };
}

let state = defaults();
let storageOk = true;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) {
    storageOk = false;
    state = defaults();
  }
  return state;
}

function normalize(obj) {
  const d = defaults();
  if (!obj || typeof obj !== 'object') return d;
  const out = { ...d, ...obj };
  for (const k of ['sessions', 'phrases', 'errors', 'toeic', 'videos', 'speakLog']) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  if (!out.reader || typeof out.reader !== 'object') out.reader = d.reader;
  if (!out.promptShift || typeof out.promptShift !== 'object') out.promptShift = d.promptShift;
  return out;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch (e) {
    storageOk = false;
  }
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  return storageOk;
}

export const db = () => state;
export const isStorageOk = () => storageOk;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return 'File không phải dữ liệu hợp lệ.';
  if (obj.app && obj.app !== 'english-daily') return 'File này không phải của English Daily.';
  const data = obj.data && typeof obj.data === 'object' ? obj.data : obj;
  if (!Array.isArray(data.sessions) && !Array.isArray(data.phrases)) return 'File thiếu phần "sessions"/"phrases".';
  return null;
}

export function replaceAll(obj) {
  const data = obj.data && typeof obj.data === 'object' ? obj.data : obj;
  state = normalize(data);
  state.timer = null;
  return save();
}

export function exportPayload() {
  return {
    app: 'english-daily',
    exportedAt: new Date().toISOString(),
    data: { ...state, timer: null },
  };
}

export function resetAll() {
  state = defaults();
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
