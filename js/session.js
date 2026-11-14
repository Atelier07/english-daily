// Buổi học có hướng dẫn: mỗi lúc chỉ một bước trên màn hình.
// S1 Ôn → S2 Nghe hội thoại → S3 Cụm mới → S4 Nhại theo → S5 Thay ô bằng miệng → S6 Đóng vai (→ SX Ôn thêm)
import { db, save } from './store.js';
import { esc, today, fmtClock } from './util.js';
import { toast } from './ui.js';
import { logMinutes } from './timer.js';
import { loadIndex, loadDay, chunkMap, chunkFragments, nextDayAfter } from './course.js';
import { play, playAll, stop as stopAudio } from './audio.js';
import { sttSupported, listenOnce, compare } from './stt.js';
import { createRecorder } from './recorder.js';
import { getProfile, saveProfile, budget, currentDay } from './profile.js';
import {
  dueItems, weakestItems, getItem, rate, intervalText, addDayItems, bumpEncounters, updateMastery,
} from './items.js';
import { hasAI, askJSON } from './ai.js';

export const STEPS = {
  S1: { name: 'Ôn', block: 'review', hint: 'Nhìn nghĩa, nói tiếng Anh thành tiếng trước, rồi mới nghe đáp án.' },
  S2: { name: 'Nghe hội thoại', block: 'input', hint: 'Nghe trước khi nhìn chữ. Nghe cả bài 1–2 lần, rồi mới hiện chữ.' },
  S3: { name: 'Cụm mới', block: 'input', hint: 'Hiểu nghĩa cả cụm, nghe, rồi nói theo.' },
  S4: { name: 'Nhại theo', block: 'shadow', hint: 'Nghe chậm, nói đè theo; rồi nghe tốc độ thường, nói đè lần nữa.' },
  S5: { name: 'Thay ô bằng miệng', block: 'speak', hint: 'Nhìn ý tiếng Việt, nói cả câu tiếng Anh bằng khung câu, rồi xem câu mẫu.' },
  S6: { name: 'Đóng vai', block: 'speak', hint: 'Người kia nói, đến lượt bạn thì nói theo gợi ý.' },
  SX: { name: 'Ôn thêm', block: 'review', hint: 'Vài thẻ yếu nhất, chưa đến hạn.' },
};

export const PLANS = {
  15: { rev: 5, steps: ['S1', 'S2', 'S3', 'S5'], stems: 2, cues: 3 },
  20: { rev: 8, steps: ['S1', 'S2', 'S3', 'S5'], stems: 3, cues: 4 },
  30: { rev: 12, steps: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], stems: 9, cues: 9 },
  45: { rev: 20, steps: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], stems: 9, cues: 9 },
  60: { rev: 30, steps: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'SX'], stems: 9, cues: 9, extra: 10 },
};
export const planFor = (b) => PLANS[b] || PLANS[30];

// Các bước thật sự chạy cho một ngày (bỏ S1 nếu không có thẻ đến hạn, bỏ bước không có dữ liệu)
export function buildSteps(day, b = budget(), due = dueItems().length) {
  const p = planFor(b);
  return p.steps.filter((s) => {
    if (s === 'S1') return due > 0;
    if (s === 'S2' || s === 'S4') return day.dialogue.lines.length > 0;
    if (s === 'S3') return day.chunks.length > 0;
    if (s === 'S5') return day.substitution.length > 0;
    if (s === 'S6') return day.roleplay.turns.length > 0;
    if (s === 'SX') return db().items.length > 0;
    return true;
  });
}

let host = null;      // phần tử chứa
let onExit = null;    // gọi khi thoát/xong
let day = null;
let cmap = new Map();
let clockT = null;
const rec = createRecorder();

const S = () => db().session;
function persist() { save(); }

function stepMinutes(s) {
  return Math.min(Math.max(0, (Date.now() - (s.stepStart || Date.now())) / 60000), 25);
}

export async function startSession(n) {
  const idx = await loadIndex();
  const d = await loadDay(n, idx);
  const p = planFor(budget());
  const queue = dueItems().slice(0, p.rev).map((i) => i.id);
  db().session = {
    day: n, steps: buildSteps(d, budget(), queue.length), i: 0, stepStart: Date.now(), startedDate: today(),
    queue, pos: {}, flags: {}, enc: {}, s5ok: {}, s6ok: [], said: {}, again: [], extra: [], aiCues: [], minutes: 0,
  };
  persist();
}

export function hasSession() { const s = S(); return !!(s && s.steps && !s.finished); }

// ---------- khung ----------
export async function renderSession(el, exit) {
  host = el;
  onExit = exit;
  const s = S();
  try {
    day = await loadDay(s.day);
    cmap = await chunkMap();
  } catch (e) {
    host.innerHTML = `<div class="notice">Không tải được bài của Ngày ${s.day}. Kiểm tra mạng rồi thử lại.</div>`;
    return;
  }
  draw();
}

function draw() {
  const s = S();
  if (!s || !host) return;
  stopAudio();
  clearInterval(clockT);
  const key = s.steps[s.i];
  const meta = STEPS[key];
  host.innerHTML = `
    <div class="sess">
      <div class="sess-top">
        <div>
          <div class="eyebrow">Ngày ${s.day} · Bước ${s.i + 1}/${s.steps.length}</div>
          <h1 class="sess-title">${esc(meta.name)}</h1>
        </div>
        <div class="sess-clock num" id="stepClock">00:00</div>
      </div>
      <div class="sess-dots">${s.steps.map((_, k) => `<i class="${k < s.i ? 'done' : k === s.i ? 'cur' : ''}"></i>`).join('')}</div>
      <p class="sess-hint">${esc(meta.hint)}</p>
      <div id="stepBody" class="sess-body"></div>
      <div class="sess-foot">
        <button type="button" class="btn btn-quiet" id="pauseBtn">Tạm dừng</button>
        <button type="button" class="btn btn-primary btn-lg" id="doneStep">${s.i === s.steps.length - 1 ? 'Xong buổi học' : 'Xong bước này'}</button>
      </div>
    </div>`;
  const clock = host.querySelector('#stepClock');
  const tick = () => { clock.textContent = fmtClock((Date.now() - (S().stepStart || Date.now())) / 1000); };
  tick();
  clockT = setInterval(tick, 1000);
  host.querySelector('#pauseBtn').addEventListener('click', pause);
  host.querySelector('#doneStep').addEventListener('click', nextStep);
  const body = host.querySelector('#stepBody');
  ({ S1: s1, S2: s2, S3: s3, S4: s4, S5: s5, S6: s6, SX: sx })[key](body);
  window.scrollTo(0, 0);
}

function logStep() {
  const s = S();
  const key = s.steps[s.i];
  const min = stepMinutes(s);
  if (min >= 0.3) {
    logMinutes(STEPS[key].block, min, { manual: false, note: `Ngày ${s.day} · ${STEPS[key].name}` });
    s.minutes += min;
  }
}

function pause() {
  const s = S();
  logStep();
  s.stepStart = null;
  s.paused = true;
  persist();
  stopAudio();
  clearInterval(clockT);
  if (onExit) onExit();
}

export function resumeClock() {
  const s = S();
  if (s && (!s.stepStart || s.paused)) { s.stepStart = Date.now(); s.paused = false; persist(); }
}

function nextStep() {
  const s = S();
  logStep();
  s.i++;
  s.stepStart = Date.now();
  if (s.i >= s.steps.length) { finishDay(); return; }
  persist();
  draw();
}

async function finishDay() {
  const s = S();
  clearInterval(clockT);
  // gặp lại các cụm cũ trong hội thoại/đóng vai
  const old = {}, fresh = {};
  for (const [id, n] of Object.entries(s.enc)) (getItem(id) ? old : fresh)[id] = n;
  bumpEncounters(old);
  const newCount = addDayItems(day, fresh);
  // lượt đã đếm gặp ở trên; ở đây chỉ ghi nhận lượt thay ô đúng và đóng vai đúng
  for (const [cid, cues] of Object.entries(s.s5ok)) {
    const it = getItem(cid);
    if (it) cues.forEach((c) => { if (!it.okCues.includes(c)) it.okCues.push(c); });
  }
  for (const id of s.s6ok) { const it = getItem(id); if (it) it.roleplayOk = true; }
  updateMastery();
  const p = getProfile() || {};
  const done = { ...(p.daysDone || {}) };
  done[s.day] = today();
  let next = s.day + 1;
  try { next = nextDayAfter(s.day, await loadIndex()) || s.day; } catch (e) { /* giữ s.day + 1 */ }
  saveProfile({ daysDone: done, currentDay: next, lastDay: s.day });
  db().session = { finished: { day: s.day, minutes: Math.round(s.minutes), newItems: newCount, chunks: day.chunks.length, date: today() } };
  persist();
  if (onExit) onExit();
}

// ---------- tiện ích ----------
function countEnc(ids) {
  const s = S();
  for (const id of ids || []) s.enc[id] = (s.enc[id] || 0) + 1;
}

export function highlightLine(text, ids, map = cmap) {
  let html = esc(text);
  const frags = [];
  for (const id of ids || []) { const c = map.get(id); if (c) frags.push(...chunkFragments(c.text)); }
  frags.sort((a, b) => b.length - a.length).forEach((f) => {
    const re = new RegExp(`(${esc(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
    if (!/<mark>/.test(html.match(re)?.[0] || '')) html = html.replace(re, '<mark>$1</mark>');
  });
  return html;
}

function sayButton(id = 'sayBtn') {
  return sttSupported() ? `<button type="button" class="btn" id="${id}">Nói (máy nghe thử)</button>` : '';
}
async function trySay(btn, answers, out) {
  btn.disabled = true;
  btn.textContent = 'Đang nghe…';
  const heard = await listenOnce();
  btn.disabled = false;
  btn.textContent = 'Nói lại';
  if (!heard.length) { out.innerHTML = '<p class="muted small">Máy chưa nghe được. Cứ nói to rồi xem đáp án.</p>'; return ''; }
  const r = compare(heard, answers);
  out.innerHTML = `<p class="heard ${r.match ? 'ok' : ''}">Máy nghe: “${esc(heard[0])}”${r.match ? ' · khớp' : ''}</p>`;
  return heard[0];
}

function rateRow(it) {
  return `<div class="rate-row">
    <button type="button" class="btn rate-forgot" data-grade="forgot">Quên<small>${intervalText(it, 'forgot')}</small></button>
    <button type="button" class="btn" data-grade="hard">Khó<small>${intervalText(it, 'hard')}</small></button>
    <button type="button" class="btn rate-good" data-grade="good">Nhớ<small>${intervalText(it, 'good')}</small></button>
  </div>`;
}

function playBtn(line, label = 'Nghe', slow = false, cls = '') {
  return `<button type="button" class="btn ${cls}" data-play='${esc(JSON.stringify({ id: line.id || null, text: line.text || line.en || '' }))}' data-slow="${slow ? 1 : 0}">${label}</button>`;
}
function wirePlay(el) {
  el.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
    play(JSON.parse(b.dataset.play), { slow: b.dataset.slow === '1' });
  }));
}

// ---------- S1 / SX: ôn ----------
function reviewStep(body, listKey) {
  const s = S();
  if (listKey === 'extra' && !s.flags.extraBuilt) {
    s.extra = weakestItems(planFor(budget()).extra || 10, new Set(s.queue)).map((i) => i.id);
    s.flags.extraBuilt = true;
    persist();
  }
  const list = listKey === 'extra' ? s.extra : s.queue;
  const posKey = listKey === 'extra' ? 'SX' : 'S1';
  const pos = s.pos[posKey] || 0;
  if (pos >= list.length) {
    body.innerHTML = `<div class="card sess-card"><p class="big-line">Xong phần ôn.</p><p class="muted">Đã ôn ${list.length} thẻ.</p></div>`;
    return;
  }
  const it = getItem(list[pos]);
  if (!it) { s.pos[posKey] = pos + 1; persist(); reviewStep(body, listKey); return; }
  const revealed = !!s.flags[`rev-${posKey}`];
  const stem = it.kind === 'chunk' && /…/.test(it.en);
  body.innerHTML = `
    <div class="sess-progress">${pos + 1} / ${list.length}</div>
    <div class="card sess-card">
      <div class="row" style="gap:8px"><span class="tag">${it.kind === 'chunk' ? (stem ? 'khung câu' : 'cụm') : 'câu'}</span>${it.hard ? '<span class="tag tag-accent">khác tiếng Việt</span>' : ''}</div>
      <p class="cue">${esc(it.cue)}</p>
      ${revealed ? `
        <p class="answer" lang="en">${esc(it.en)}</p>
        <div class="row">${playBtn({ id: it.audio && it.kind === 'example' ? it.audio : null, text: it.en }, 'Nghe lại')}</div>
        ${rateRow(it)}` : `
        <p class="muted">Nói câu tiếng Anh thành tiếng.</p>
        <div id="heard"></div>
        <div class="row">${sayButton()}<button type="button" class="btn btn-primary" id="revealBtn">Nghe đáp án</button></div>`}
    </div>`;
  wirePlay(body);
  const say = body.querySelector('#sayBtn');
  if (say) say.addEventListener('click', () => trySay(say, [it.en], body.querySelector('#heard')));
  const rv = body.querySelector('#revealBtn');
  if (rv) rv.addEventListener('click', () => {
    s.flags[`rev-${posKey}`] = true;
    persist();
    reviewStep(body, listKey);
    play({ id: it.kind === 'example' ? it.audio : null, text: it.en });
  });
  body.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.grade;
    rate(it, g);
    if (g === 'forgot' && !s.again.includes(it.id)) { s.again.push(it.id); list.push(it.id); }
    s.flags[`rev-${posKey}`] = false;
    s.pos[posKey] = pos + 1;
    persist();
    reviewStep(body, listKey);
  }));
}
const s1 = (b) => reviewStep(b, 'queue');
const sx = (b) => reviewStep(b, 'extra');

// ---------- S2: nghe hội thoại ----------
function s2(body) {
  const s = S();
  const lines = day.dialogue.lines;
  const shown = !!s.flags.s2show;
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  body.innerHTML = `
    ${day.dialogue.setting_vi ? `<p class="setting">${esc(day.dialogue.setting_vi)}</p>` : ''}
    <div class="row sess-actions">
      <button type="button" class="btn btn-primary" id="playAll">Nghe cả bài</button>
      <button type="button" class="btn" id="playSlow">Nghe chậm</button>
      ${shown ? '' : '<button type="button" class="btn btn-quiet" id="showText">Hiện chữ</button>'}
    </div>
    <ol class="dlg">${lines.map((l) => `
      <li class="dlg-line spk-${speakers.indexOf(l.speaker) % 2}">
        <span class="spk">${esc(l.speaker)}</span>
        <div class="dlg-text">${shown ? `<p class="en" lang="en">${highlightLine(l.en, l.chunks)}</p><p class="vi">${esc(l.vi)}</p>` : '<p class="hidden-line">· · ·</p>'}</div>
        <button type="button" class="btn btn-sm icon-btn" data-line="${esc(l.id)}" aria-label="Nghe câu này">▶</button>
      </li>`).join('')}</ol>`;
  const markHeard = () => { if (!s.flags.s2enc) { s.flags.s2enc = true; lines.forEach((l) => countEnc(l.chunks)); persist(); } };
  body.querySelector('#playAll').addEventListener('click', () => { markHeard(); playAll(lines.map((l) => ({ id: l.id, text: l.en }))); });
  body.querySelector('#playSlow').addEventListener('click', () => { markHeard(); playAll(lines.map((l) => ({ id: l.id, text: l.en })), { slow: true }); });
  const st = body.querySelector('#showText');
  if (st) st.addEventListener('click', () => { markHeard(); s.flags.s2show = true; persist(); s2(body); });
  body.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
    const l = lines.find((x) => x.id === b.dataset.line);
    play({ id: l.id, text: l.en });
  }));
}

// ---------- S3: cụm mới ----------
function s3(body) {
  const s = S();
  const list = day.chunks;
  const pos = Math.min(s.pos.S3 || 0, list.length - 1);
  const c = list[pos];
  if (!s.flags[`s3-${c.id}`]) { s.flags[`s3-${c.id}`] = true; countEnc([c.id]); persist(); }
  const ex0 = c.examples[0];
  body.innerHTML = `
    <div class="sess-progress">Cụm ${pos + 1} / ${list.length}</div>
    <div class="card sess-card">
      <p class="chunk-text" lang="en">${esc(c.text)}</p>
      <p class="chunk-vi">${esc(c.vi)}</p>
      <div class="row" style="gap:6px">${c.register && c.register !== 'neutral' ? `<span class="tag">${esc({ casual: 'thân mật', polite: 'lịch sự', work: 'công việc' }[c.register] || c.register)}</span>` : ''}${c.type === 'stem' ? '<span class="tag">khung câu: thay phần “…”</span>' : ''}</div>
      ${c.vi_equivalent === false && c.contrast_vi ? `<div class="contrast"><b>Khác tiếng Việt:</b> ${esc(c.contrast_vi)}</div>` : ''}
      ${c.reduced ? `<p class="reduced">Nói nhanh nghe như: <span lang="en">“${esc(c.reduced)}”</span></p>` : ''}
      <ul class="examples">${c.examples.map((e) => `
        <li><div><p class="en" lang="en">${highlightLine(e.en, [c.id], new Map([[c.id, c]]))}</p><p class="vi">${esc(e.vi)}</p></div>
        ${playBtn({ id: e.id, text: e.en }, '▶', false, 'btn-sm icon-btn')}</li>`).join('')}</ul>
      <div class="row sess-actions">
        ${ex0 ? playBtn({ id: ex0.id, text: ex0.en }, 'Nghe', false, 'btn-primary') : playBtn({ text: c.text }, 'Nghe', false, 'btn-primary')}
        <button type="button" class="btn" id="recBtn">Nói theo</button>
        <button type="button" class="btn" id="cmpBtn" ${rec.url ? '' : 'hidden'}>So sánh giọng</button>
      </div>
    </div>
    <div class="row pager">
      <button type="button" class="btn btn-quiet" id="prevC" ${pos === 0 ? 'disabled' : ''}>← Cụm trước</button>
      <span class="spacer"></span>
      ${pos < list.length - 1 ? '<button type="button" class="btn" id="nextC">Cụm tiếp →</button>' : ''}
    </div>`;
  wirePlay(body);
  const model = ex0 ? { id: ex0.id, text: ex0.en } : { text: c.text };
  body.querySelector('#recBtn').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (rec.recording) { await rec.stop(); b.textContent = 'Nói theo'; b.classList.remove('on'); body.querySelector('#cmpBtn').hidden = false; }
    else if (await rec.start()) { b.textContent = 'Dừng ghi'; b.classList.add('on'); }
  });
  body.querySelector('#cmpBtn').addEventListener('click', async () => { await play(model); await rec.play(); });
  const go = (d) => { s.pos.S3 = pos + d; persist(); s3(body); };
  body.querySelector('#prevC').addEventListener('click', () => go(-1));
  const nx = body.querySelector('#nextC');
  if (nx) nx.addEventListener('click', () => go(1));
}

// ---------- S4: nhại theo ----------
function s4(body) {
  const s = S();
  const lines = day.dialogue.lines;
  const pos = Math.min(s.pos.S4 || 0, lines.length - 1);
  const l = lines[pos];
  if (!s.flags[`s4-${l.id}`]) { s.flags[`s4-${l.id}`] = true; countEnc(l.chunks); persist(); }
  body.innerHTML = `
    <div class="sess-progress">Câu ${pos + 1} / ${lines.length}</div>
    <div class="card sess-card">
      <p class="answer" lang="en">${highlightLine(l.en, l.chunks)}</p>
      <p class="vi">${esc(l.vi)}</p>
      <ol class="mini-steps"><li>Nghe chậm, nói đè theo</li><li>Nghe tốc độ thường, nói đè lần nữa</li></ol>
      <div class="row sess-actions">
        ${playBtn({ id: l.id, text: l.en }, 'Chậm', true, 'btn-primary')}
        ${playBtn({ id: l.id, text: l.en }, 'Thường')}
        <button type="button" class="btn" id="recBtn">Nói theo</button>
        <button type="button" class="btn" id="cmpBtn" ${rec.url ? '' : 'hidden'}>So sánh giọng</button>
      </div>
    </div>
    <div class="row pager">
      <button type="button" class="btn btn-quiet" id="prevL" ${pos === 0 ? 'disabled' : ''}>← Câu trước</button>
      <span class="spacer"></span>
      ${pos < lines.length - 1 ? '<button type="button" class="btn" id="nextL">Câu tiếp →</button>' : ''}
    </div>`;
  wirePlay(body);
  body.querySelector('#recBtn').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (rec.recording) { await rec.stop(); b.textContent = 'Nói theo'; b.classList.remove('on'); body.querySelector('#cmpBtn').hidden = false; }
    else if (await rec.start()) { b.textContent = 'Dừng ghi'; b.classList.add('on'); }
  });
  body.querySelector('#cmpBtn').addEventListener('click', async () => { await play({ id: l.id, text: l.en }); await rec.play(); });
  const go = (d) => { s.pos.S4 = pos + d; persist(); s4(body); };
  body.querySelector('#prevL').addEventListener('click', () => go(-1));
  const nx = body.querySelector('#nextL');
  if (nx) nx.addEventListener('click', () => go(1));
}

// ---------- S5: thay ô bằng miệng ----------
export function s5List(d, b = budget()) {
  const p = planFor(b);
  const out = [];
  d.substitution.slice(0, p.stems).forEach((sub) => sub.cues.slice(0, p.cues).forEach((cue) => out.push({ chunk: sub.chunk, cue })));
  return out;
}
function s5(body) {
  const s = S();
  const list = s5List(day).concat(s.aiCues || []);
  const pos = s.pos.S5 || 0;
  if (pos >= list.length) {
    const stems = [...new Set(list.map((x) => x.chunk))];
    body.innerHTML = `
      <div class="card sess-card">
        <p class="big-line">Xong ${list.length} lượt thay ô.</p>
        <ul class="stem-sum">${stems.map((id) => { const c = cmap.get(id); const n = (s.s5ok[id] || []).length; return `<li><span lang="en">${esc(c ? c.text : id)}</span><span class="muted">${n} câu nói được</span></li>`; }).join('')}</ul>
        <p class="muted small">Một khung câu được tính là thuộc khi bạn nói đúng với ít nhất 3 ý khác nhau và dùng được trong đóng vai.</p>
        <div id="aiMore"></div>
      </div>`;
    hasAI().then((ok) => {
      const box = body.querySelector('#aiMore');
      if (!ok || !box || (s.aiCues || []).length) return;
      box.innerHTML = '<button type="button" class="btn" id="aiCues">AI gợi ý thêm câu</button>';
      box.querySelector('#aiCues').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Đang gợi ý…';
        try {
          const stemsTxt = stems.map((id) => `${id}: ${cmap.get(id)?.text}`).join('\n');
          const { data } = await askJSON(`Người học tiếng Anh khoảng A0–A1, người Việt. Với mỗi khung câu dưới đây, viết 2 tình huống mới: "cue_vi" (ý tiếng Việt ngắn, không phải bản dịch từng chữ) và "answer" (câu tiếng Anh tự nhiên, ngắn, dùng đúng khung câu, từ rất cơ bản). Tình huống chung, không nói về đời tư người học.
Chỉ trả về JSON: {"items":[{"chunk":"<id>","cue_vi":"","answer":""}]}
Khung câu:
${stemsTxt}`);
          const items = (Array.isArray(data.items) ? data.items : []).filter((x) => x && stems.includes(x.chunk) && x.cue_vi && x.answer).slice(0, 8);
          s.aiCues = items.map((x, k) => ({ chunk: x.chunk, cue: { id: `ai-${s.day}-${k}`, cue_vi: x.cue_vi, answer: x.answer, accept: [x.answer] }, ai: true }));
          persist();
          s5(body);
        } catch (err) { box.innerHTML = `<p class="small">${esc(err.message)}</p>`; }
      });
    });
    return;
  }
  const { chunk, cue, ai } = list[pos];
  const c = cmap.get(chunk);
  const revealed = !!s.flags.s5rev;
  body.innerHTML = `
    <div class="sess-progress">${pos + 1} / ${list.length}${ai ? ' · gợi ý từ AI' : ''}</div>
    <div class="card sess-card">
      <p class="frame" lang="en">${esc(c ? c.text : '')}</p>
      <p class="cue">${esc(cue.cue_vi)}</p>
      ${revealed ? `
        <p class="answer" lang="en">${esc(cue.answer)}</p>
        <div class="row">${playBtn({ id: ai ? null : cue.id, text: cue.answer }, 'Nghe lại')}</div>
        <div class="rate-row two">
          <button type="button" class="btn rate-forgot" data-ok="0">Chưa được</button>
          <button type="button" class="btn rate-good" data-ok="1">Nói được</button>
        </div>` : `
        <div id="heard"></div>
        <div class="row">${sayButton()}<button type="button" class="btn btn-primary" id="revealBtn">Xem câu mẫu</button></div>`}
    </div>`;
  wirePlay(body);
  const say = body.querySelector('#sayBtn');
  if (say) say.addEventListener('click', () => trySay(say, [cue.answer, ...(cue.accept || [])], body.querySelector('#heard')));
  const rv = body.querySelector('#revealBtn');
  if (rv) rv.addEventListener('click', () => { s.flags.s5rev = true; persist(); s5(body); play({ id: ai ? null : cue.id, text: cue.answer }); });
  body.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => {
    countEnc([chunk]);
    if (b.dataset.ok === '1') {
      s.s5ok[chunk] = s.s5ok[chunk] || [];
      if (!s.s5ok[chunk].includes(cue.id)) s.s5ok[chunk].push(cue.id);
    }
    s.flags.s5rev = false;
    s.pos.S5 = pos + 1;
    persist();
    s5(body);
  }));
}

// ---------- S6: đóng vai ----------
function s6(body) {
  const s = S();
  const turns = day.roleplay.turns;
  const pos = s.pos.S6 || 0;
  if (pos >= turns.length) {
    const said = Object.entries(s.said || {});
    body.innerHTML = `
      <div class="card sess-card">
        <p class="big-line">Xong đóng vai.</p>
        <div class="row sess-actions"><button type="button" class="btn btn-primary" id="replay">Nghe lại cả cuộc nói chuyện</button></div>
        <div id="aiFb"></div>
      </div>`;
    body.querySelector('#replay').addEventListener('click', () => playAll(turns.map((t) => (t.role === 'you' ? { id: `${t.id}`, text: t.model } : { id: t.id, text: t.en }))));
    if (said.length) {
      hasAI().then((ok) => {
        const box = body.querySelector('#aiFb');
        if (!ok || !box) return;
        box.innerHTML = '<button type="button" class="btn" id="aiFbBtn">AI nhận xét lượt nói</button>';
        box.querySelector('#aiFbBtn').addEventListener('click', async (e) => {
          e.currentTarget.disabled = true;
          try {
            const rows = said.map(([id, txt]) => { const t = turns.find((x) => x.id === id); return `- Ý: ${t.cue_vi} | Câu mẫu: ${t.model} | Người học nói (máy chép): ${txt}`; }).join('\n');
            const { data } = await askJSON(`Người học tiếng Anh khoảng A0–A1 (người Việt) vừa đóng vai. Máy chép lời có thể nghe nhầm, bỏ qua lỗi chính tả. Nêu tối đa 2 điểm cần sửa quan trọng nhất, mỗi điểm: "said" (câu người học), "better" (câu tốt hơn), "why" (1 câu tiếng Việt). Nếu ổn hết thì để mảng rỗng và viết "praise" một câu ngắn, cụ thể.
Chỉ trả về JSON: {"notes":[{"said":"","better":"","why":""}],"praise":""}
${rows}`);
            const notes = Array.isArray(data.notes) ? data.notes.slice(0, 2) : [];
            box.innerHTML = `<div class="ai-box">${notes.map((n) => `<p><span class="err-wrong" lang="en">${esc(n.said)}</span><br><span class="err-right" lang="en">${esc(n.better)}</span><br><span class="small">${esc(n.why)}</span></p>`).join('')}${data.praise ? `<p>${esc(data.praise)}</p>` : ''}</div>`;
          } catch (err) { box.innerHTML = `<p class="small">${esc(err.message)}</p>`; }
        });
      });
    }
    return;
  }
  const t = turns[pos];
  const done = turns.slice(0, pos);
  const revealed = !!s.flags.s6rev;
  body.innerHTML = `
    ${day.roleplay.situation_vi ? `<p class="setting">${esc(day.roleplay.situation_vi)}</p>` : ''}
    <ol class="dlg rp">${done.map((x) => `<li class="dlg-line spk-${x.role === 'you' ? 1 : 0}"><span class="spk">${x.role === 'you' ? 'Bạn' : 'Họ'}</span><div class="dlg-text"><p class="en" lang="en">${esc(x.role === 'you' ? x.model : x.en)}</p></div></li>`).join('')}</ol>
    <div class="card sess-card">
      ${t.role === 'partner' ? `
        <div class="row" style="gap:8px"><span class="tag">Họ nói</span></div>
        <p class="answer" lang="en">${esc(t.en)}</p>
        <p class="vi">${esc(t.vi || '')}</p>
        <div class="row sess-actions">${playBtn({ id: t.id, text: t.en }, 'Nghe lại')}<button type="button" class="btn btn-primary" id="nextT">Tiếp</button></div>` : `
        <div class="row" style="gap:8px"><span class="tag tag-accent">Lượt bạn</span></div>
        <p class="cue">${esc(t.cue_vi)}</p>
        ${revealed ? `
          <p class="answer" lang="en">${esc(t.model)}</p>
          <div class="row">${playBtn({ id: t.id, text: t.model }, 'Nghe lại')}</div>
          <div class="rate-row two">
            <button type="button" class="btn rate-forgot" data-ok="0">Chưa được</button>
            <button type="button" class="btn rate-good" data-ok="1">Nói được</button>
          </div>` : `
          <div id="heard"></div>
          <div class="row">${sayButton()}<button type="button" class="btn btn-primary" id="revealBtn">Xem câu mẫu</button></div>`}`}
    </div>`;
  wirePlay(body);
  const advance = () => { s.flags.s6rev = false; s.pos.S6 = pos + 1; persist(); s6(body); };
  if (t.role === 'partner') {
    if (!s.flags[`s6p-${t.id}`]) { s.flags[`s6p-${t.id}`] = true; persist(); play({ id: t.id, text: t.en }); }
    body.querySelector('#nextT').addEventListener('click', advance);
    return;
  }
  const say = body.querySelector('#sayBtn');
  if (say) say.addEventListener('click', async () => {
    const txt = await trySay(say, [t.model], body.querySelector('#heard'));
    if (txt) { s.said[t.id] = txt; persist(); }
  });
  const rv = body.querySelector('#revealBtn');
  if (rv) rv.addEventListener('click', () => { s.flags.s6rev = true; persist(); s6(body); play({ id: t.id, text: t.model }); });
  body.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => {
    countEnc(t.uses);
    if (b.dataset.ok === '1') (t.uses || []).forEach((id) => { if (!s.s6ok.includes(id)) s.s6ok.push(id); });
    advance();
  }));
}

export function stopSession() { clearInterval(clockT); stopAudio(); }
export { currentDay };
