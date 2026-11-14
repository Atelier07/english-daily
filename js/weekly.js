// Kiểm tra tuần: sau ngày 7, 14, 21, 30. 8–10 tình huống tiếng Việt → người học nói/gõ tiếng Anh → Gemini chấm
// (không có khoá AI thì chấm offline bằng so khớp mờ). Kết quả lưu ở db().weekChecks (đồng bộ như dữ liệu khác).
import { db, save, uid } from './store.js';
import { esc, today } from './util.js';
import { toast } from './ui.js';
import { loadIndex, loadDay } from './course.js';
import { getProfile, saveProfile, dayDoneMap } from './profile.js';
import { getItem, dueSoon } from './items.js';
import { hasAI, askJSON, weeklyCheckPrompt } from './ai.js';
import { sttSupported, listenOnce, compare } from './stt.js';
import { startReviewSession } from './session.js';

export const WEEK_END = [7, 14, 21, 30];
export const PASS_SCORE = 70;
export const weekRange = (w) => ({ from: w === 1 ? 1 : WEEK_END[w - 2] + 1, to: WEEK_END[w - 1] });

export const allChecks = () => db().weekChecks.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
export const latestCheck = () => allChecks().pop() || null;
export const checkOfWeek = (w) => allChecks().filter((c) => c.week === w).pop() || null;
const weekReached = (w) => !!dayDoneMap()[WEEK_END[w - 1]];

// tuần đã học xong ngày cuối nhưng chưa kiểm tra
export function pendingWeek() {
  for (let w = 1; w <= WEEK_END.length; w++) if (weekReached(w) && !checkOfWeek(w)) return w;
  return null;
}
export const snoozed = () => { const p = getProfile(); return !!(p && p.checkSnooze === today()); };
export const snooze = () => saveProfile({ checkSnooze: today() });

// kiểm tra tuần kế tiếp chưa làm: còn bao nhiêu ngày học nữa
export function upcomingCheck() {
  const done = dayDoneMap();
  for (let w = 1; w <= WEEK_END.length; w++) {
    if (checkOfWeek(w)) continue;
    let left = 0;
    for (let d = 1; d <= WEEK_END[w - 1]; d++) if (!done[d]) left++;
    return { week: w, left };
  }
  return null;
}
export const reviewWeek = () => (getProfile() && getProfile().reviewWeek) || null;

// ---------- chọn đề ----------
async function weekDays(w) {
  const idx = await loadIndex();
  const { from, to } = weekRange(w);
  const out = [];
  for (const e of idx.filter((x) => x.day >= from && x.day <= to)) {
    try { out.push(await loadDay(e.day, idx)); } catch (err) { /* bỏ ngày lỗi */ }
  }
  return out;
}
const weak = (c) => { const it = getItem(c.id); return it ? (it.lapses || 0) * 2 - (it.ef || 2.5) : 0; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function promptFor(d, c) {
  const opts = [];
  const rp = d.roleplay.turns.find((t) => t.role === 'you' && (t.uses || []).includes(c.id) && t.cue_vi && t.model);
  if (rp) opts.push({ vi: rp.cue_vi, model: rp.model, accept: [rp.model] });
  const sub = d.substitution.find((x) => x.chunk === c.id);
  if (sub && sub.cues.length) {
    const cue = pick(sub.cues);
    opts.push({ vi: cue.cue_vi, model: cue.answer, accept: [cue.answer, ...(cue.accept || [])] });
    if (c.type === 'stem') opts.push({ vi: cue.cue_vi, model: cue.answer, accept: [cue.answer, ...(cue.accept || [])] });
  }
  if (c.examples.length) { const ex = pick(c.examples); opts.push({ vi: ex.vi, model: ex.en, accept: [ex.en] }); }
  const o = opts.length ? pick(opts) : { vi: c.vi, model: c.text.replace(/…/g, '').trim(), accept: [c.text] };
  return { chunkId: c.id, chunkText: c.text, day: d.day, ...o };
}

export async function buildPrompts(w, n = 10) {
  const days = await weekDays(w);
  const lists = days.map((d) => d.chunks.slice().sort((a, b) => weak(b) - weak(a)).map((c) => ({ d, c })));
  const picked = [];
  for (let round = 0; picked.length < n && lists.some((l) => l.length); round++) {
    for (const l of lists) { const x = l.shift(); if (x && picked.length < n) picked.push(x); }
  }
  picked.sort((a, b) => a.d.day - b.d.day || Math.random() - 0.5);
  return picked.map(({ d, c }) => promptFor(d, c));
}

// ---------- chấm ----------
function gradeOffline(items, answers, note) {
  let sum = 0;
  const good = [], fix = [];
  items.forEach((it, i) => {
    const r = answers[i] ? compare([answers[i]], it.accept) : { match: false, score: 0 };
    sum += r.match ? 1 : r.score >= 0.5 ? 0.5 : 0;
    if (r.match) good.push(it.chunkText);
    else fix.push({ chunkId: it.chunkId, note_vi: `Câu mẫu: “${it.model}”` });
  });
  const score = Math.round((sum / items.length) * 100);
  const right = items.length - fix.length;
  return {
    score, pass: score >= PASS_SCORE, good: good.slice(0, 3).map((t) => `Nói đúng: ${t}`), fix,
    summary_vi: `${note || 'Chấm offline (không có khoá AI).'} Đúng ${right}/${items.length} câu so với câu mẫu; câu đúng nghĩa nhưng khác câu mẫu có thể bị tính sai.`,
    source: 'offline',
  };
}

async function grade(items, answers, w) {
  if (await hasAI()) {
    try {
      const rows = items.map((it, i) => ({ chunkId: it.chunkId, vi: it.vi, model: it.model, answer: answers[i] }));
      const { data } = await askJSON(weeklyCheckPrompt(rows, w));
      const score = Math.max(0, Math.min(100, Math.round(Number(data.score))));
      if (Number.isNaN(score)) throw new Error('Điểm không hợp lệ');
      const ids = new Set(items.map((x) => x.chunkId));
      const fix = (Array.isArray(data.fix) ? data.fix : []).filter((x) => x && ids.has(x.chunkId)).map((x) => ({ chunkId: x.chunkId, note_vi: String(x.note_vi || '').slice(0, 200) }));
      return {
        score, pass: score >= PASS_SCORE, good: (Array.isArray(data.good) ? data.good : []).map(String).slice(0, 3), fix,
        summary_vi: String(data.summary_vi || '').slice(0, 300), source: 'ai',
      };
    } catch (e) {
      return gradeOffline(items, answers, `AI chưa chấm được (${e.message}), chuyển sang chấm offline.`);
    }
  }
  return gradeOffline(items, answers);
}

function saveResult(w, items, answers, g) {
  const rec = {
    id: `wk${w}-${uid()}`, week: w, lastDay: weekRange(w).to, date: today(), ts: Date.now(), n: items.length,
    score: g.score, pass: g.pass, good: g.good, fix: g.fix, summary_vi: g.summary_vi, source: g.source,
    answers: items.map((it, i) => ({ chunkId: it.chunkId, vi: it.vi, model: it.model, said: answers[i] || '' })),
  };
  db().weekChecks.push(rec);
  dueSoon([...new Set(g.fix.map((f) => f.chunkId))], 1);
  saveProfile({ reviewWeek: g.pass ? null : w });
  save();
  return rec;
}

// ---------- giao diện kiểm tra ----------
let st = null;
export async function renderCheck(el, w, exit) {
  el.innerHTML = '<div class="sess"><p class="muted">Đang chuẩn bị đề…</p></div>';
  let items = [];
  try { items = await buildPrompts(w); } catch (e) { items = []; }
  if (!items.length) {
    el.innerHTML = '<div class="notice">Chưa tải được bài của tuần này. Kiểm tra mạng rồi thử lại.</div><button type="button" class="btn" id="wkBack">Quay lại</button>';
    el.querySelector('#wkBack').addEventListener('click', exit);
    return;
  }
  st = { w, items, pos: 0, answers: items.map(() => ''), exit };
  drawQ(el);
}

function drawQ(el) {
  const { w, items, pos } = st;
  const it = items[pos];
  const { from, to } = weekRange(w);
  const last = pos === items.length - 1;
  el.innerHTML = `
    <div class="sess">
      <div class="sess-top"><div><div class="eyebrow">Kiểm tra tuần ${w} · Ngày ${from}–${to}</div><h1 class="sess-title">Câu ${pos + 1} / ${items.length}</h1></div></div>
      <div class="sess-dots">${items.map((_, k) => `<i class="${k < pos ? 'done' : k === pos ? 'cur' : ''}"></i>`).join('')}</div>
      <p class="sess-hint">Đọc tình huống, nói hoặc gõ câu tiếng Anh. Không nhìn lại bài.</p>
      <div class="card sess-card">
        <p class="cue">${esc(it.vi)}</p>
        <input id="wkIn" class="input" type="text" lang="en" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Gõ câu tiếng Anh…" value="${esc(st.answers[pos])}">
        <div id="heard"></div>
        <div class="row">${sttSupported() ? '<button type="button" class="btn" id="wkSay">Nói (máy nghe chép)</button>' : ''}</div>
      </div>
      <div class="sess-foot">
        <button type="button" class="btn btn-quiet" id="wkPrev" ${pos === 0 ? 'disabled' : ''}>← Trước</button>
        <button type="button" class="btn btn-primary btn-lg" id="wkNext">${last ? 'Chấm bài' : 'Câu tiếp'}</button>
      </div>
    </div>`;
  const input = el.querySelector('#wkIn');
  input.addEventListener('input', () => { st.answers[pos] = input.value; });
  const say = el.querySelector('#wkSay');
  if (say) say.addEventListener('click', async () => {
    say.disabled = true; say.textContent = 'Đang nghe…';
    const heard = await listenOnce();
    say.disabled = false; say.textContent = 'Nói lại';
    if (heard.length) { input.value = heard[0]; st.answers[pos] = heard[0]; el.querySelector('#heard').innerHTML = '<p class="muted small">Máy chép được: sửa lại bên trên nếu nghe nhầm.</p>'; }
    else el.querySelector('#heard').innerHTML = '<p class="muted small">Máy chưa nghe được. Gõ câu của bạn vào ô trên.</p>';
  });
  el.querySelector('#wkPrev').addEventListener('click', () => { st.pos--; drawQ(el); });
  el.querySelector('#wkNext').addEventListener('click', () => { if (last) finish(el); else { st.pos++; drawQ(el); } });
  window.scrollTo(0, 0);
}

async function finish(el) {
  const { w, items, answers } = st;
  el.innerHTML = '<div class="sess"><div class="eyebrow">Kiểm tra tuần ' + w + '</div><h1 class="sess-title">Đang chấm…</h1><p class="muted">Chờ vài giây.</p></div>';
  const g = await grade(items, answers, w);
  const rec = saveResult(w, items, answers, g);
  drawResult(el, rec);
}

function drawResult(el, rec) {
  const texts = new Map((st ? st.items : []).map((i) => [i.chunkId, i.chunkText]));
  el.innerHTML = `
    <div class="sess">
      <div class="sess-top"><div><div class="eyebrow">Kiểm tra tuần ${rec.week}${rec.source === 'offline' ? ' · chấm offline' : ''}</div><h1 class="sess-title">${rec.score} điểm</h1></div></div>
      <div class="card sess-card">
        <div class="row" style="gap:8px"><span class="badge ${rec.pass ? 'badge-ok' : 'badge-no'}">${rec.pass ? 'ĐẠT' : 'CHƯA ĐẠT'}</span><span class="muted small">cần ${PASS_SCORE}</span></div>
        <p class="wk-res-sum">${esc(rec.summary_vi)}</p>
        ${rec.good.length ? `<ul class="wk-list">${rec.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${rec.fix.length ? `<p class="muted small">Cần sửa (đã đưa vào thẻ ôn ngày mai):</p>
          <ul class="stem-sum wk-fix">${rec.fix.map((f) => `<li><span lang="en">${esc(texts.get(f.chunkId) || f.chunkId)}</span><span class="muted">${esc(f.note_vi)}</span></li>`).join('')}</ul>` : ''}
        ${rec.pass ? '' : '<p class="muted small">Chưa đạt: buổi sau ôn lại tuần này trước khi học bài mới.</p>'}
      </div>
      <div class="sess-foot"><span></span><button type="button" class="btn btn-primary btn-lg" id="wkDone">Xong</button></div>
    </div>`;
  el.querySelector('#wkDone').addEventListener('click', () => { const x = st && st.exit; st = null; if (x) x(); });
  window.scrollTo(0, 0);
}

// ---------- ôn lại tuần chưa đạt ----------
export async function startWeekReview(w) {
  const { from, to } = weekRange(w);
  const rec = checkOfWeek(w);
  const failed = new Set((rec ? rec.fix : []).map((f) => f.chunkId));
  const chunks = db().items.filter((i) => i.kind === 'chunk' && i.day >= from && i.day <= to);
  chunks.sort((a, b) => (failed.has(b.id) ? 1 : 0) - (failed.has(a.id) ? 1 : 0) || (a.ef || 2.5) - (b.ef || 2.5));
  const ids = chunks.slice(0, 20).map((i) => i.id);
  if (!ids.length) { saveProfile({ reviewWeek: null }); return false; }
  startReviewSession(ids, { label: `Ôn lại tuần ${w}`, weekReview: w });
  return true;
}

// ---------- thẻ trên trang Hôm nay ----------
export function weekCardHtml({ hero = false } = {}) {
  const last = latestCheck();
  const up = upcomingCheck();
  if (!last && !up) return '';
  if (hero && !last) return '';
  const upTxt = up ? (up.left > 0 ? `Kiểm tra tuần ${up.week} sau ${up.left} ngày học.` : `Kiểm tra tuần ${up.week}: đã đến lúc làm.`) : '';
  return `
    <section class="card wk-card" aria-label="Kiểm tra tuần">
      ${last ? `
        <div class="wk-head">
          <span class="eyebrow">Kiểm tra tuần ${last.week}</span>
          <span class="badge ${last.pass ? 'badge-ok' : 'badge-no'}">${last.pass ? 'ĐẠT' : 'CHƯA ĐẠT'}</span>
          <span class="spacer"></span><span class="num wk-score">${last.score}</span>
        </div>
        <p class="small wk-sum">${esc(last.summary_vi)}</p>` : ''}
      <div class="wk-foot">
        ${upTxt ? `<span class="small muted">${esc(upTxt)}</span>` : ''}
        <span class="spacer"></span>
        ${last ? `<button type="button" class="btn btn-quiet btn-sm" data-wk="${last.week}">Làm lại</button>` : ''}
        ${up && up.left === 0 && !hero ? `<button type="button" class="btn btn-sm" data-wk="${up.week}">Làm ngay</button>` : ''}
      </div>
    </section>`;
}
