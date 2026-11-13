// Toàn bộ dữ liệu nằm trong localStorage, một khoá duy nhất.
// Mọi lần đọc/ghi đều bọc try/catch (Safari private mode, bộ nhớ đầy...).
//
// Đồng bộ: mỗi bản ghi có id ổn định + updatedAt. save() tự so từng bản ghi với ảnh chụp lần
// trước: bản ghi nào đổi nội dung thì được đóng dấu updatedAt mới; bản ghi nào biến mất thì
// sinh "bia mộ" (tombstones[collection][id] = thời điểm xoá). Nhờ vậy các màn hình cứ sửa/xoá
// mảng như bình thường mà việc gộp dữ liệu giữa các máy vẫn đúng.

const KEY = 'englishDaily.v1';
const listeners = new Set();

export const COLLECTIONS = ['sessions', 'phrases', 'errors', 'toeic', 'videos', 'speakLog', 'doubts', 'checks', 'pronLog', 'dictLog'];

export const BLOCKS = {
  input:  { name: 'Nghe/đọc thứ bạn thích', short: 'Nghe/đọc', min: 30, max: 45 },
  shadow: { name: 'Shadowing', short: 'Shadowing', min: 10, max: 15 },
  speak:  { name: 'Nói ra', short: 'Nói ra', min: 10, max: 10 },
  review: { name: 'Ôn cụm từ', short: 'Ôn cụm', min: 5, max: 10 },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function defaults() {
  const d = {
    version: 2,
    timer: null,                       // chỉ trên máy này
    reader: { text: '', source: '' },  // chỉ trên máy này
    promptShift: { date: '', n: 0 },   // chỉ trên máy này
    tombstones: {},
  };
  COLLECTIONS.forEach((c) => { d[c] = []; d.tombstones[c] = {}; });
  return d;
}

let state = defaults();
let snap = {};          // snap[c] = Map(id -> nội dung JSON không kèm updatedAt)
let storageOk = true;

const recKey = (r) => { const { updatedAt, ...rest } = r; return JSON.stringify(rest); };

function normalize(obj) {
  const d = defaults();
  if (!obj || typeof obj !== 'object') return d;
  const out = { ...d, ...obj };
  out.version = 2;
  if (!out.reader || typeof out.reader !== 'object') out.reader = d.reader;
  if (!out.promptShift || typeof out.promptShift !== 'object') out.promptShift = d.promptShift;
  const tomb = obj.tombstones && typeof obj.tombstones === 'object' ? obj.tombstones : {};
  out.tombstones = {};
  for (const c of COLLECTIONS) {
    out.tombstones[c] = { ...(tomb[c] && typeof tomb[c] === 'object' ? tomb[c] : {}) };
    const arr = Array.isArray(obj[c]) ? obj[c] : [];
    const seen = new Set();
    out[c] = [];
    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      // di chuyển dữ liệu cũ: thêm id / updatedAt nếu thiếu
      if (!r.id) r.id = c === 'videos' && r.videoId ? r.videoId : uid();
      if (!r.updatedAt) r.updatedAt = Number(r.ts || r.created || r.lastUsed || r.updated) || 1;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out[c].push(r);
    }
  }
  return out;
}

function takeSnapshot() {
  snap = {};
  for (const c of COLLECTIONS) snap[c] = new Map(state[c].map((r) => [r.id, recKey(r)]));
}

// đóng dấu thay đổi, sinh bia mộ cho bản ghi đã bị xoá
function stamp() {
  const now = Date.now();
  let changed = false;
  for (const c of COLLECTIONS) {
    if (!Array.isArray(state[c])) state[c] = [];
    const m = snap[c] || (snap[c] = new Map());
    const seen = new Set();
    for (const r of state[c]) {
      if (!r.id) r.id = c === 'videos' && r.videoId ? r.videoId : uid();
      seen.add(r.id);
      const k = recKey(r);
      if (m.get(r.id) !== k) {
        r.updatedAt = now;
        m.set(r.id, k);
        changed = true;
        if (state.tombstones[c][r.id]) delete state.tombstones[c][r.id];
      }
    }
    for (const id of [...m.keys()]) {
      if (!seen.has(id)) {
        state.tombstones[c][id] = now;
        m.delete(id);
        changed = true;
      }
    }
  }
  return changed;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch (e) {
    storageOk = false;
  }
}

function notify(info) {
  listeners.forEach((fn) => { try { fn(state, info); } catch (e) { console.error(e); } });
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) {
    storageOk = false;
    state = defaults();
  }
  takeSnapshot();
  persist();
  return state;
}

export function save() {
  const changed = stamp();
  persist();
  notify({ local: true, synced: changed });
  return storageOk;
}

export const db = () => state;
export const isStorageOk = () => storageOk;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// ---------- dữ liệu đồng bộ ----------
export function syncedData() {
  const out = { app: 'english-daily', version: 2, tombstones: {} };
  for (const c of COLLECTIONS) {
    out[c] = state[c].map((r) => ({ ...r }));
    out.tombstones[c] = { ...state.tombstones[c] };
  }
  return out;
}

// Gộp hai bản: theo id, updatedAt mới hơn thắng; bia mộ thắng nếu xoá sau lần sửa cuối.
export function mergeData(a, b) {
  const A = normalize(JSON.parse(JSON.stringify(a || {})));
  const B = normalize(JSON.parse(JSON.stringify(b || {})));
  const out = { app: 'english-daily', version: 2, tombstones: {} };
  for (const c of COLLECTIONS) {
    const tomb = { ...A.tombstones[c] };
    for (const [id, t] of Object.entries(B.tombstones[c])) tomb[id] = Math.max(Number(t) || 0, Number(tomb[id]) || 0);
    const map = new Map();
    for (const r of A[c]) map.set(r.id, r);
    for (const r of B[c]) {
      const cur = map.get(r.id);
      if (!cur || (Number(r.updatedAt) || 0) > (Number(cur.updatedAt) || 0)) map.set(r.id, r);
    }
    out[c] = [];
    for (const r of map.values()) {
      const dt = tomb[r.id];
      if (dt && dt >= (Number(r.updatedAt) || 0)) continue;
      if (dt) delete tomb[r.id];
      out[c].push(r);
    }
    out.tombstones[c] = tomb;
  }
  return out;
}

// chuỗi so sánh không phụ thuộc thứ tự
export function canonical(data) {
  const n = normalize(JSON.parse(JSON.stringify(data || {})));
  const parts = COLLECTIONS.map((c) => {
    const recs = n[c].slice().sort((x, y) => (x.id < y.id ? -1 : 1)).map((r) => JSON.stringify(r, Object.keys(r).sort()));
    const t = Object.keys(n.tombstones[c]).sort().map((k) => `${k}:${n.tombstones[c][k]}`);
    return `${c}[${recs.join(',')}]{${t.join(',')}}`;
  });
  return parts.join('|');
}

// thay dữ liệu đồng bộ bằng bản đã gộp (không đóng dấu lại)
export function applySynced(merged) {
  const n = normalize(merged);
  for (const c of COLLECTIONS) {
    state[c] = n[c];
    state.tombstones[c] = n.tombstones[c];
  }
  takeSnapshot();
  persist();
  notify({ remote: true });
}

// ---------- xuất / nhập / xoá ----------
export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return 'File không phải dữ liệu hợp lệ.';
  if (obj.app && obj.app !== 'english-daily') return 'File này không phải của English Daily.';
  const data = obj.data && typeof obj.data === 'object' ? obj.data : obj;
  if (!Array.isArray(data.sessions) && !Array.isArray(data.phrases)) return 'File thiếu phần "sessions"/"phrases".';
  return null;
}

// "Thay hoàn toàn": bản ghi không có trong file sẽ thành bia mộ, bản ghi trong file được đóng dấu mới.
export function replaceAll(obj) {
  const data = obj.data && typeof obj.data === 'object' ? obj.data : obj;
  const n = normalize(data);
  for (const c of COLLECTIONS) {
    state[c] = n[c];
    for (const [id, t] of Object.entries(n.tombstones[c])) state.tombstones[c][id] = Math.max(t, state.tombstones[c][id] || 0);
  }
  if (n.reader && n.reader.text) state.reader = n.reader;
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
  for (const c of COLLECTIONS) state[c] = [];
  state.timer = null;
  state.reader = { text: '', source: '' };
  state.promptShift = { date: '', n: 0 };
  return save();
}
