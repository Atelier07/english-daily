// Điểm yếu phát âm của người học (âm cuối, -s, -ed, th, cụm phụ âm) + khối luyện phát âm ngắn trong buổi học.
// Tín hiệu: (a) so lời máy chép với câu mong đợi ở mọi chỗ dùng STT; (b) nút "Mình thấy khó phát âm câu này".
// Bộ đếm nằm ở db().pronWeak (một bản ghi id "me", đồng bộ như dữ liệu khác).
import { db, save } from './store.js';
import { today, esc } from './util.js';
import { normalize } from './stt.js';
import { loadDay } from './course.js';

export const TARGETS = ['fin', 's', 'ed', 'th', 'cl'];
export const THRESHOLD = 3;
const CAP = 12;

export const TARGET_INFO = {
  fin: { name: 'Âm cuối /t/ /d/ /k/ /p/', tip: 'Âm cuối /t/: chặn lưỡi lại, không bỏ. Với /k/, /p/: chặn họng hoặc khép môi rồi dừng, đừng nuốt âm.' },
  s: { name: 'Đuôi -s / -z', tip: 'Số nhiều và động từ ngôi thứ ba có đuôi -s: giữ hơi xì “sss” (hoặc rung “zzz”) tới cuối từ, đừng cắt ngang.' },
  ed: { name: 'Đuôi -ed', tip: 'Đuôi -ed là một âm nhỏ ở cuối: /t/ sau âm vô thanh (walked), /d/ sau âm hữu thanh (called), /ɪd/ sau t, d (wanted).' },
  th: { name: 'Âm “th”', tip: 'Âm “th”: đặt đầu lưỡi nhẹ giữa hai hàm răng rồi thổi hơi ra, không biến thành /t/ hay /s/.' },
  cl: { name: 'Cụm phụ âm', tip: 'Cụm phụ âm (street, asked, friends): đọc đủ cả hai ba âm liền nhau, không chèn thêm nguyên âm và không bỏ âm cuối.' },
};

const NOT_S = new Set(['is', 'was', 'this', 'his', 'us', 'yes', 'as', 'has', 'its', 'plus', 'bus', 'across', 'always', 'perhaps', 'less', 'miss', 'guess', 'class', 'dress', 'glass', 'boss', 'kiss', 'pass', 'address', 'business', 'press', 'success', 'process', 'bless', 'lens', 'thanks']);
const NOT_ED = new Set(['need', 'seed', 'red', 'bed', 'speed', 'feed', 'indeed', 'weed', 'bleed', 'proceed', 'succeed', 'exceed', 'hundred', 'sacred', 'naked', 'wicked', 'tired', 'bored', 'excited', 'interested', 'married']);
const CL_END = /(nd|nt|st|sk|sp|ct|ft|lt|lk|mp|nk|ld|lp|pt|xt|rd|rt|rk|lf|lm|ls|ks|ts|ds|ps|ns|ms|ngs|sts)$/;
const CL_START = /^(str|spr|spl|scr|squ|pl|bl|cl|fl|gl|sl|pr|br|cr|dr|fr|gr|tr|st|sp|sk|sn|sm|sw|tw|thr)/;

const WORD = {
  fin: (w) => w.length >= 3 && /[tdkp]$/.test(w) && !/ed$/.test(w),
  s: (w) => w.length >= 3 && /[^s']s$|[sxz]es$|ies$/.test(w) && !NOT_S.has(w) && !/'/.test(w),
  ed: (w) => w.length >= 4 && /ed$/.test(w) && !NOT_ED.has(w),
  th: (w) => /th/.test(w),
  cl: (w) => w.length >= 4 && (CL_END.test(w.replace(/[^a-z]/g, '')) || CL_START.test(w)),
};
export const wordHas = (target, w) => !!(WORD[target] && WORD[target](String(w).toLowerCase()));
const wordsOf = (text) => String(text || '').toLowerCase().replace(/[’‘`]/g, "'").match(/[a-z']+/g) || [];

// ---------- bản ghi ----------
function rec() {
  let r = db().pronWeak.find((x) => x.id === 'me');
  if (!r) { r = { id: 'me', counts: {}, lastBlock: {}, blocks: 0, sttSeen: 0 }; db().pronWeak.push(r); }
  if (!r.counts) r.counts = {};
  if (!r.lastBlock) r.lastBlock = {};
  return r;
}
export const pwCounts = () => { const r = db().pronWeak.find((x) => x.id === 'me'); return { ...(r ? r.counts : {}) }; };
export function bump(cat, n = 1) {
  if (!TARGETS.includes(cat)) return;
  const r = rec();
  r.counts[cat] = Math.min(CAP, (r.counts[cat] || 0) + n);
  save();
}
export function forceWeak(cat, n = THRESHOLD) { bump(cat, n); } // dùng khi thử nghiệm / tự báo

// ---------- tín hiệu ----------
export function detectCats(text) {
  const out = {};
  const ws = wordsOf(text);
  for (const t of TARGETS) { const n = ws.filter((w) => wordHas(t, w)).length; if (n) out[t] = n; }
  return out;
}

// so lời máy chép với câu mong đợi: từ thiếu đuôi / thiếu âm cuối → +1 cho nhóm tương ứng (tối đa 2 mỗi lượt/nhóm)
export function recordSTT(expected, heardList) {
  const heards = (Array.isArray(heardList) ? heardList : [heardList]).filter(Boolean).map(normalize);
  const want = normalize(expected);
  if (!want.length || !heards.length) return [];
  const overlap = (h) => { const pool = h.slice(); let n = 0; want.forEach((w) => { const k = pool.indexOf(w); if (k >= 0) { n++; pool.splice(k, 1); } }); return n; };
  let best = heards[0];
  for (const h of heards) if (overlap(h) > overlap(best)) best = h;
  if (overlap(best) / want.length < 0.5) return []; // nói khác hẳn: không đoán được lỗi âm
  const pool = best.slice();
  const missing = [];
  want.forEach((w) => { const k = pool.indexOf(w); if (k >= 0) pool.splice(k, 1); else missing.push(w); });
  const has = (x) => x && best.includes(x);
  const hit = {};
  for (const w of missing) {
    let cat = null;
    if (WORD.ed(w) && (has(w.slice(0, -2)) || has(w.slice(0, -1)))) cat = 'ed';
    else if (WORD.s(w) && (has(w.slice(0, -1)) || has(w.slice(0, -2)))) cat = 's';
    else if (WORD.th(w) && ['t', 'd', 's', 'f', 'z'].some((x) => has(w.replace(/th/g, x)))) cat = 'th';
    else if (WORD.fin(w) && has(w.slice(0, -1))) cat = 'fin';
    else if (WORD.cl(w) && CL_END.test(w) && has(w.slice(0, -1))) cat = 'cl';
    if (cat) hit[cat] = Math.min(2, (hit[cat] || 0) + 1);
    if (cat === 'fin' && CL_END.test(w)) hit.cl = Math.min(2, (hit.cl || 0) + 1); // bỏ âm cuối của cụm (want → wan)
  }
  const cats = Object.keys(hit);
  if (cats.length) { cats.forEach((c) => bump(c, hit[c])); }
  const r = rec();
  r.sttSeen = (r.sttSeen || 0) + 1;
  save();
  return cats;
}

// "Mình thấy khó phát âm câu này": +2 cho tối đa 2 nhóm hiện diện nhiều nhất trong câu
export function reportHard(text) {
  const d = detectCats(text);
  const cats = Object.keys(d).sort((a, b) => d[b] - d[a]).slice(0, 2);
  cats.forEach((c) => bump(c, 2));
  return cats;
}

// ---------- chọn nhóm cho một ngày ----------
export function topWeak(counts = pwCounts()) {
  let best = null;
  for (const t of TARGETS) if ((counts[t] || 0) >= THRESHOLD && (!best || counts[t] > counts[best])) best = t;
  return best;
}
const rotationOrder = (n) => { const k = Math.floor(n / 3) - 1; return TARGETS.map((_, i) => TARGETS[(k + i) % TARGETS.length]); };

// các dòng chứa âm đích: từ hội thoại, câu ví dụ, cụm của ngày và vài ngày gần đây
function candidateLines(days) {
  const out = [];
  const seen = new Set();
  const add = (id, en, vi) => {
    const text = String(en || '').replace(/…/g, '').trim();
    const n = wordsOf(text).length;
    const key = text.toLowerCase();
    if (n < 2 || n > 10 || seen.has(key)) return;
    seen.add(key);
    out.push({ id: id || null, text, vi: vi || '' });
  };
  for (const d of days) {
    (d.dialogue.lines || []).forEach((l) => add(l.id, l.en, l.vi));
    (d.chunks || []).forEach((c) => (c.examples || []).forEach((e) => add(e.id, e.en, e.vi)));
    (d.chunks || []).forEach((c) => add(null, c.text, c.vi));
  }
  return out;
}
export function linesFor(target, days, { first = [], max = 6 } = {}) {
  const scored = candidateLines(days).map((l) => ({ l, n: wordsOf(l.text).filter((w) => wordHas(target, w)).length })).filter((x) => x.n > 0);
  scored.sort((a, b) => b.n - a.n || wordsOf(a.l.text).length - wordsOf(b.l.text).length);
  const picked = [];
  const used = new Set();
  const take = (l) => { if (!used.has(l.text.toLowerCase()) && picked.length < max) { used.add(l.text.toLowerCase()); picked.push(l); } };
  first.forEach((t) => { const x = candidateLines(days).find((c) => c.text.toLowerCase() === String(t).toLowerCase().replace(/…/g, '').trim()); if (x) take(x); });
  // hôm nay trước (days[0]), rồi theo điểm
  scored.forEach((x) => take(x.l));
  return picked;
}

async function loadDays(n) {
  const out = [];
  for (const k of [n, n - 1, n - 2]) {
    if (k < 1) continue;
    try { out.push(await loadDay(k)); } catch (e) { /* bỏ qua */ }
  }
  return out;
}

// Kế hoạch khối phát âm của một ngày: {target, forced, lines} hoặc null.
// withS4=false (ngân sách ngắn, không có Nhại theo): chỉ chèn khi có điểm yếu vượt ngưỡng.
export async function pronPlan(n, { withS4 = true, only = null, first = [] } = {}) {
  const weak = only || topWeak();
  const days = await loadDays(n);
  if (!days.length) return null;
  if (weak) {
    const lines = linesFor(weak, days, { first });
    if (lines.length >= 3) return { target: weak, forced: true, lines };
  }
  if (only || !withS4 || n % 3 !== 0) return null;
  for (const t of rotationOrder(n)) {
    const lines = linesFor(t, days, { first });
    if (lines.length >= 3) return { target: t, forced: false, lines };
  }
  return null;
}

export function markBlockDone(target) {
  const r = rec();
  r.counts[target] = Math.floor((r.counts[target] || 0) / 2);
  r.lastBlock[target] = today();
  r.blocks = (r.blocks || 0) + 1;
  save();
}

// tô từ chứa âm đích
export function markTargetHtml(text, target) {
  return String(text).split(/([A-Za-z’']+)/).map((p, i) => (i % 2 && wordHas(target, p) ? `<mark>${esc(p)}</mark>` : esc(p))).join('');
}

export function summaryLine() {
  const c = pwCounts();
  const parts = TARGETS.filter((t) => (c[t] || 0) > 0).sort((a, b) => c[b] - c[a]).map((t) => `${TARGET_INFO[t].name} (${c[t]})`);
  const r = db().pronWeak.find((x) => x.id === 'me');
  return `- Phát âm hay sai: ${parts.length ? parts.join(', ') : '(chưa có tín hiệu)'}; đã luyện ${r ? r.blocks || 0 : 0} khối phát âm`;
}
