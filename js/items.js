// SRS cho cụm và câu ví dụ của khoá học: nhìn nghĩa tiếng Việt / tình huống → nói tiếng Anh.
//  - Mỗi cụm nhắm khoảng 10–15 lần gặp có nghĩa (đếm cả nghe hội thoại, nhại, thay ô, đóng vai, ôn).
//  - Cụm không có cách nói tương đương tiếng Việt (vi_equivalent=false) được ôn dày hơn: khoảng cách × 0,6.
//  - "Thuộc": khung câu cần ≥ 3 lượt thay ô khác nhau đúng + dùng đúng trong đóng vai;
//    cụm cố định cần nhớ ≥ 3 lần liền khi ôn và ≥ 10 lần gặp.
import { db, save } from './store.js';
import { today, addDays } from './util.js';
import { preview, apply, intervalLabel } from './srs.js';

export const TARGET_ENCOUNTERS = 12;
const HARD_FACTOR = 0.6;

export const getItem = (id) => db().items.find((i) => i.id === id);

function baseCard(due) { return { ef: 2.5, reps: 0, interval: 0, due, lapses: 0, lastReview: null }; }

// Thêm cụm + câu ví dụ của một ngày vào SRS (gọi khi học xong ngày). encounters: {chunkId: n}
export function addDayItems(day, encounters = {}, { due = addDays(today(), 1), skipped = false } = {}) {
  let added = 0;
  for (const c of day.chunks) {
    let it = getItem(c.id);
    if (!it) {
      it = {
        id: c.id, kind: 'chunk', chunkId: c.id, type: c.type || 'fixed', day: day.day, cue: c.vi, en: c.text,
        audio: (c.examples[0] && c.examples[0].id) || null, hard: c.vi_equivalent === false,
        encounters: 0, okCues: [], roleplayOk: false, mastered: false, skipped, ...baseCard(due),
      };
      db().items.push(it);
      added++;
    }
    it.encounters = (it.encounters || 0) + (encounters[c.id] || 0);
    if (skipped) continue;
    for (const ex of c.examples) {
      if (getItem(ex.id)) continue;
      db().items.push({
        id: ex.id, kind: 'example', chunkId: c.id, day: day.day, cue: ex.vi, en: ex.en, audio: ex.id,
        hard: c.vi_equivalent === false, encounters: 0, ...baseCard(addDays(due, 1)),
      });
      added++;
    }
  }
  updateMastery();
  save();
  return added;
}

// Gặp thêm cụm đã có trong SRS (hội thoại, đóng vai…)
export function bumpEncounters(map) {
  let touched = false;
  for (const [id, n] of Object.entries(map)) {
    const it = getItem(id);
    if (it && n) { it.encounters = (it.encounters || 0) + n; touched = true; }
  }
  if (touched) { updateMastery(); save(); }
}

export function previewItem(it, grade) {
  const p = preview(it, grade);
  if (it.hard && grade !== 'forgot') p.interval = Math.max(1, Math.round(p.interval * HARD_FACTOR));
  return p;
}
export const intervalText = (it, grade) => (grade === 'forgot' ? 'lại ngay' : intervalLabel(previewItem(it, grade).interval));

export function rate(it, grade) {
  apply(it, grade);
  if (it.hard && grade !== 'forgot') {
    it.interval = Math.max(1, Math.round(it.interval * HARD_FACTOR));
    it.due = addDays(today(), it.interval);
  }
  it.encounters = (it.encounters || 0) + 1;
  if (it.kind === 'example') {
    const parent = getItem(it.chunkId);
    if (parent) parent.encounters = (parent.encounters || 0) + 1;
  }
  updateMastery();
  save();
}

export function recordCue(chunkId, cueId, ok) {
  const it = getItem(chunkId);
  if (!it) return;
  it.encounters = (it.encounters || 0) + 1;
  if (ok && !it.okCues.includes(cueId)) it.okCues.push(cueId);
  updateMastery();
  save();
}
export function recordRoleplay(chunkIds, ok) {
  for (const id of chunkIds || []) {
    const it = getItem(id);
    if (!it) continue;
    it.encounters = (it.encounters || 0) + 1;
    if (ok) it.roleplayOk = true;
  }
  updateMastery();
  save();
}

export function isMastered(it) {
  if (!it || it.kind !== 'chunk') return false;
  if (it.type === 'stem') return (it.okCues || []).length >= 3 && !!it.roleplayOk;
  return (it.reps || 0) >= 3 && (it.encounters || 0) >= 10;
}
export function updateMastery() {
  for (const it of db().items) if (it.kind === 'chunk') it.mastered = isMastered(it);
}

export function dueItems(date = today()) {
  return db().items
    .filter((i) => i.due && i.due <= date)
    .sort((a, b) => (b.hard ? 1 : 0) - (a.hard ? 1 : 0) || a.due.localeCompare(b.due) || (a.ef || 2.5) - (b.ef || 2.5));
}
// thẻ yếu nhất chưa đến hạn (cho ôn thêm)
export function weakestItems(n, exclude = new Set()) {
  return db().items
    .filter((i) => !exclude.has(i.id) && (!i.due || i.due > today()))
    .sort((a, b) => (a.ef || 2.5) - (b.ef || 2.5) || (b.lapses || 0) - (a.lapses || 0))
    .slice(0, n);
}

export function stats() {
  const chunks = db().items.filter((i) => i.kind === 'chunk');
  const t = today();
  const from = addDays(t, -6);
  const reviewed = db().items.filter((i) => i.lastReview && i.lastReview >= from);
  return {
    chunks: chunks.length,
    mastered: chunks.filter((c) => c.mastered).length,
    learning: chunks.filter((c) => !c.mastered).length,
    due: dueItems().length,
    reviewed7: reviewed.length,
    lapsed7: reviewed.filter((i) => i.lapses).length,
  };
}
