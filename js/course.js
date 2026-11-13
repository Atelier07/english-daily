// Nạp khoá học tĩnh (course/index.json + course/days/*.json). Sau lần tải đầu, mọi ngày được tải trước
// để service worker lưu lại, học được khi mất mạng.
let indexP = null;
const dayCache = new Map();

export function loadIndex() {
  if (indexP) return indexP;
  indexP = fetch('course/index.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((j) => {
      const list = (Array.isArray(j) ? j : (j && Array.isArray(j.days) ? j.days : [])).filter((d) => d && d.day && d.file);
      list.sort((a, b) => a.day - b.day);
      setTimeout(() => list.forEach((d) => loadDay(d.day, list).catch(() => {})), 1200);
      return list;
    })
    .catch((e) => { indexP = null; throw e; });
  return indexP;
}

export async function loadDay(n, list) {
  if (dayCache.has(n)) return dayCache.get(n);
  const idx = list || await loadIndex();
  const entry = idx.find((d) => d.day === n);
  if (!entry) throw new Error(`Không có ngày ${n}`);
  const p = fetch(`course/${entry.file.replace(/^\.?\//, '')}`, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((d) => validateDay(d, n))
    .catch((e) => { dayCache.delete(n); throw e; });
  dayCache.set(n, p);
  return p;
}

export function validateDay(d, n) {
  if (!d || typeof d !== 'object') throw new Error(`Ngày ${n} hỏng`);
  d.day = d.day || n;
  d.chunks = Array.isArray(d.chunks) ? d.chunks : [];
  d.chunks.forEach((c) => { c.examples = Array.isArray(c.examples) ? c.examples : []; });
  d.dialogue = d.dialogue && Array.isArray(d.dialogue.lines) ? d.dialogue : { setting_vi: '', lines: [] };
  d.substitution = Array.isArray(d.substitution) ? d.substitution : [];
  d.roleplay = d.roleplay && Array.isArray(d.roleplay.turns) ? d.roleplay : { situation_vi: '', turns: [] };
  return d;
}

export async function loadAllDays() {
  const idx = await loadIndex();
  const out = [];
  for (const e of idx) {
    try { out.push(await loadDay(e.day, idx)); } catch (err) { /* bỏ qua ngày lỗi */ }
  }
  return out;
}

// bảng tra cụm toàn khoá (các ngày đã tải)
export async function chunkMap() {
  const days = await loadAllDays();
  const m = new Map();
  days.forEach((d) => d.chunks.forEach((c) => m.set(c.id, { ...c, day: d.day })));
  return m;
}

// đánh dấu cụm trong câu: lấy các mảnh cố định của cụm (bỏ "…") và tô
export function chunkFragments(text) {
  return String(text || '').split('…').map((s) => s.trim().replace(/[.?!,]+$/, '')).filter((s) => s.length >= 2);
}

export function nextDayAfter(n, idx) {
  const e = idx.find((d) => d.day > n);
  return e ? e.day : null;
}
