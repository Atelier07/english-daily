import { esc, today, addDays } from '../util.js';
import { toast } from '../ui.js';
import {
  vocabItems, scoreVocab, LISTEN, SELF, BUDGETS, computeLevel, explainLevel, LEVELS, startDayFor,
} from '../placement.js';
import { saveProfile, getProfile, currentDay } from '../profile.js';
import { loadIndex, loadDay } from '../course.js';
import { addDayItems } from '../items.js';
import { play } from '../audio.js';
import { planSentence } from '../roadmap.js';

let root;
let st = null;

function reset() {
  st = { phase: 'intro', items: vocabItems(), vi: 0, vocab: [], li: 0, listen: [], si: 0, self: [], budget: 30, result: null };
}

function bar(done, total) {
  return `<div class="pl-bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div>`;
}

function draw() {
  const p = st.phase;
  if (p === 'intro') {
    root.innerHTML = `
      <div class="hero">
        <div class="eyebrow">Bài xếp lớp · 5–7 phút</div>
        <h1>Bắt đầu từ đâu?</h1>
        <p class="lede">Bốn phần ngắn: nhận ra từ, nghe hiểu câu, tự đánh giá, và chọn thời gian mỗi ngày. Không có điểm đỗ trượt; trả lời thật để bài học vừa sức.</p>
        <button type="button" class="btn btn-primary btn-xl" id="go">Bắt đầu</button>
      </div>`;
    root.querySelector('#go').addEventListener('click', () => { st.phase = 'vocab'; draw(); });
    return;
  }
  if (p === 'vocab') {
    const it = st.items[st.vi];
    root.innerHTML = `
      <div class="pl">
        <div class="eyebrow">1 · Bạn có biết từ này nghĩa là gì không?</div>
        ${bar(st.vi, st.items.length)}
        <p class="pl-word" lang="en">${esc(it.word)}</p>
        <p class="muted small">Có vài từ giả trộn vào. Chỉ chọn “Biết” khi bạn biết nghĩa.</p>
        <div class="pl-two">
          <button type="button" class="btn btn-xl" data-yes="0">Không biết</button>
          <button type="button" class="btn btn-xl btn-primary" data-yes="1">Biết</button>
        </div>
      </div>`;
    root.querySelectorAll('[data-yes]').forEach((b) => b.addEventListener('click', () => {
      st.vocab.push({ band: it.band, yes: b.dataset.yes === '1' });
      st.vi++;
      if (st.vi >= st.items.length) st.phase = 'listen';
      draw();
    }));
    return;
  }
  if (p === 'listen') {
    const q = LISTEN[st.li];
    root.innerHTML = `
      <div class="pl">
        <div class="eyebrow">2 · Nghe rồi chọn nghĩa đúng</div>
        ${bar(st.li, LISTEN.length)}
        <div class="row" style="justify-content:center;margin:24px 0"><button type="button" class="btn btn-xl" id="playQ">Nghe câu ${st.li + 1}</button></div>
        <div class="pl-opts">${q.options.map((o, k) => `<button type="button" class="btn pl-opt" data-opt="${k}">${esc(o)}</button>`).join('')}</div>
        <button type="button" class="btn btn-quiet" data-opt="-1">Không nghe ra</button>
      </div>`;
    const say = () => play({ text: q.en });
    root.querySelector('#playQ').addEventListener('click', say);
    setTimeout(say, 300);
    root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      st.listen.push(Number(b.dataset.opt) === q.answer);
      st.li++;
      if (st.li >= LISTEN.length) st.phase = 'self';
      draw();
    }));
    return;
  }
  if (p === 'self') {
    const q = SELF[st.si];
    root.innerHTML = `
      <div class="pl">
        <div class="eyebrow">3 · Tự đánh giá</div>
        ${bar(st.si, SELF.length)}
        <p class="pl-q">${esc(q.q)}</p>
        ${q.text ? `<blockquote class="pl-text" lang="en">${esc(q.text)}</blockquote>` : ''}
        <div class="pl-opts">${q.options.map((o, k) => `<button type="button" class="btn pl-opt" data-s="${k}">${esc(o)}</button>`).join('')}</div>
      </div>`;
    root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
      st.self.push(Number(b.dataset.s));
      st.si++;
      if (st.si >= SELF.length) st.phase = 'budget';
      draw();
    }));
    return;
  }
  if (p === 'budget') {
    root.innerHTML = `
      <div class="pl">
        <div class="eyebrow">4 · Mỗi ngày bạn dành được bao lâu?</div>
        <p class="pl-q">Chọn mức bạn giữ được cả những ngày bận. Ít mà đều tốt hơn nhiều mà bỏ.</p>
        <div class="pl-opts budget">${BUDGETS.map((b) => `<button type="button" class="btn pl-opt ${b === 30 ? 'on' : ''}" data-b="${b}">${b} phút</button>`).join('')}</div>
      </div>`;
    root.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => {
      st.budget = Number(b.dataset.b);
      finish();
    }));
    return;
  }
  if (p === 'result') {
    const r = st.result;
    root.innerHTML = `
      <div class="hero">
        <div class="eyebrow">Kết quả</div>
        <h1>${esc(LEVELS.find((l) => l.id === r.level).label)}</h1>
        <ul class="pl-explain">${explainLevel(r).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <p class="lede">${r.startDay > 1 ? `Bắt đầu từ Ngày ${r.startDay}. Cụm của các ngày trước được đưa vào phần ôn nhanh trong tuần đầu.` : 'Bắt đầu từ Ngày 1.'}</p>
        <p class="small">${esc(planSentence())}</p>
        <button type="button" class="btn btn-primary btn-xl" id="toToday">Vào học</button>
      </div>`;
    root.querySelector('#toToday').addEventListener('click', () => { location.hash = '#/today'; });
  }
}

async function finish() {
  const v = scoreVocab(st.vocab);
  const listenCorrect = st.listen.filter(Boolean).length;
  const selfSum = st.self.reduce((a, b) => a + b, 0);
  const lv = computeLevel(v.estimate, listenCorrect, selfSum);
  let idx = [];
  try { idx = await loadIndex(); } catch (e) { /* khoá chưa tải được: bắt đầu ngày 1 */ }
  const startDay = startDayFor(lv.level, idx);
  const prev = getProfile();
  const progressed = prev && prev.daysDone && Object.keys(prev.daysDone).length;
  const cur = progressed ? Math.max(currentDay(), startDay) : startDay;
  saveProfile({
    level: lv.level, vocab: v.estimate, falseAlarm: Math.round(v.falseAlarm * 100) / 100, listen: listenCorrect, self: selfSum,
    budget: st.budget, placedAt: today(), startDay, currentDay: cur, startDate: (prev && prev.startDate) || today(),
  });
  // ôn nhanh các ngày bị bỏ qua: đưa cụm vào thẻ ôn, rải đều trong 7 ngày tới
  if (startDay > 1 && idx.length) {
    const skipped = idx.filter((d) => d.day < startDay);
    let k = 0;
    for (const e of skipped) {
      try {
        const d = await loadDay(e.day, idx);
        addDayItems(d, {}, { due: addDays(today(), 1 + (k++ % 7)), skipped: true });
      } catch (err) { /* bỏ qua */ }
    }
  }
  st.result = { ...lv, vocab: v.estimate, listen: listenCorrect, reliable: v.reliable, startDay };
  st.phase = 'result';
  draw();
}

export function mount(el) { root = el; }
export function show() { reset(); draw(); }
export function onData() {}
export function _state() { return st; }
export { toast };
