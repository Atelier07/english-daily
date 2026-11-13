import { db, save } from '../store.js';
import { esc, today, totalMinutes, fmtHours, viShortDate, GOAL_HOURS } from '../util.js';
import {
  PHASES, CHECKPOINTS, RULE, CEFR_MARKS, currentPhase, phaseHours, nextCheckpoint, trend, checkState, phaseElapsed, toeicTrend,
} from '../roadmap.js';
import { openDoubt } from '../doubt.js';

let root;

function fmtDate(s) { return `${viShortDate(s)}/${s.slice(0, 4)}`; }

function render() {
  const t = today();
  const cur = currentPhase();
  const cp = nextCheckpoint();
  const tr = trend();
  const tt = toeicTrend();
  const total = totalMinutes() / 60;

  const phases = PHASES.map((p) => {
    const h = phaseHours(p);
    const isCur = p.id === cur.id;
    const past = t > p.to;
    const pct = Math.min(100, (h / p.hours) * 100);
    const elapsed = phaseElapsed(p);
    let pace = '';
    if (isCur && elapsed > 0.05) {
      const expect = p.hours * elapsed;
      pace = h >= expect * 0.9 ? 'đúng nhịp' : `chậm hơn nhịp khoảng ${Math.round(expect - h)} giờ, bù dần được`;
    }
    return `
      <article class="card phase ${isCur ? 'current' : ''} ${past ? 'past' : ''}">
        <div class="row" style="gap:8px">
          <span class="phase-label">${p.label}</span>
          <span class="muted small">${esc(p.months)}</span>
          <span class="spacer"></span>
          ${isCur ? '<span class="tag tag-accent">đang ở đây</span>' : ''}
        </div>
        <h2>${esc(p.name)}</h2>
        <p class="muted small" style="margin:4px 0 10px">${esc(p.focus)}</p>
        <div class="progress-meta"><span>${h.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / ${p.hours} giờ</span><span>${pace}</span></div>
        <div class="progress-bar thin"><i style="width:${pct}%"></i></div>
        <div class="label" style="margin-top:14px">Xong khi:</div>
        <ul class="check-list">
          ${p.done.map((i) => {
            const on = checkState(i);
            return `<li><label class="toggle"><input type="checkbox" data-check="${i.id}" ${on ? 'checked' : ''} ${i.auto ? 'disabled' : ''}> <span>${esc(i.text)}</span></label>
              ${i.autoNote ? `<span class="muted small">(${esc(i.autoNote())}, tự đánh dấu)</span>` : ''}</li>`;
          }).join('')}
        </ul>
      </article>`;
  }).join('');

  const cps = CHECKPOINTS.map((c, i) => {
    const done = c < t;
    const test = db().toeic.find((x) => Math.abs((new Date(x.date) - new Date(c)) / 86400000) <= 21);
    return `<li class="${done ? 'done' : ''} ${c === cp.date ? 'next' : ''}">
      <span class="cp-dot"></span>
      <span class="cp-date num">${fmtDate(c)}</span>
      <span class="cp-text">Mốc ${i + 1} · thi thử TOEIC${test ? ` · <b>${test.score}</b>` : ''}${c === cp.date ? ` <span class="muted">(còn ${cp.days} ngày)</span>` : ''}</span>
    </li>`;
  }).join('');

  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Lộ trình</div>
      <h1>Ba giai đoạn đến B2</h1>
      <p class="lede">Bắt đầu 13/11/2026. Mỗi giai đoạn có số giờ và điều kiện “xong khi” cụ thể. Cứ 3 tháng có một mốc thi thử để đo thật.</p>
    </div>

    <div class="rule-box">${esc(RULE)}</div>
    <div class="row" style="margin-top:12px"><button type="button" class="btn" id="doubtBtn2">Mình đang nghi ngờ</button></div>

    <section class="section">
      <div class="kpis">
        <div class="stat"><span class="num">${fmtHours(totalMinutes())}</span><span class="k">/ ${GOAL_HOURS} giờ tổng</span></div>
        <div class="stat"><span class="num">${cp.days}</span><span class="k">ngày đến mốc ${cp.index}</span></div>
        <div class="stat"><span class="num">${tr.last.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span><span class="k">giờ/tuần (4 tuần) · ${tr.label}</span></div>
        <div class="stat"><span class="num">${tt ? `${tt.diff >= 0 ? '+' : ''}${tt.diff}` : '—'}</span><span class="k">${tt ? 'điểm so lần thi trước' : 'chưa đủ 2 lần thi'}</span></div>
      </div>
      <p class="muted small" style="margin-top:10px">Mốc CEFR theo giờ (Cambridge, tính từ 0, chỉ tham khảo): ${CEFR_MARKS.map((m) => `${m.label} ~${m.h} giờ`).join(' · ')}. Bạn đang ở ${total.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ trong app; trình độ A2 hiện tại là từ trước đó.</p>
    </section>

    <section class="section stack">${phases}</section>

    <section class="section">
      <h2>Mốc thi thử</h2>
      <p class="muted small">Làm một đề TOEIC Nghe–Đọc đủ giờ, ghi điểm ở trang Mốc. Chỉ ở những ngày này mới xét lại cách học.</p>
      <div class="card"><ol class="cp-list">${cps}</ol></div>
    </section>`;

  root.querySelector('#doubtBtn2').addEventListener('click', openDoubt);
  root.querySelectorAll('[data-check]').forEach((c) => c.addEventListener('change', () => {
    const id = c.dataset.check;
    const rec = db().checks.find((x) => x.id === id);
    if (rec) { rec.done = c.checked; rec.at = Date.now(); } else db().checks.push({ id, done: c.checked, at: Date.now() });
    save();
  }));
}

export function mount(el) { root = el; }
export function show() { render(); }
export function onData() { render(); }
