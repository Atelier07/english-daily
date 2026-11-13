// Phần Lộ trình (nhúng trong trang Tiến độ). #/roadmap chuyển về #/progress.
import { db, save } from '../store.js';
import { esc, today, viShortDate } from '../util.js';
import { phases, checkpoints, RULE, nextCheckpoint, checkState, monthLabel } from '../roadmap.js';
import { openDoubt } from '../doubt.js';

const fmtDate = (s) => `${viShortDate(s)}/${s.slice(0, 4)}`;

export function renderRoadmapInto(el) {
  const t = today();
  const cp = nextCheckpoint();
  const ps = phases();
  const phaseHtml = ps.map((p) => {
    const pct = Math.min(100, (p.inPhase / p.hours) * 100);
    const when = p.status === 'done' ? 'đã xong' : p.status === 'current' ? `dự kiến xong ${monthLabel(p.to)}` : `dự kiến ${monthLabel(p.from)} → ${monthLabel(p.to)}`;
    return `
      <article class="card phase ${p.status}">
        <div class="row" style="gap:8px">
          <span class="phase-label">${p.label}</span><span class="small">${esc(when)}</span><span class="spacer"></span>
          ${p.status === 'current' ? '<span class="tag tag-accent">đang ở đây</span>' : ''}
        </div>
        <h3>${esc(p.name)} <span class="small muted">→ ${esc(p.target)}</span></h3>
        <p class="small" style="margin:4px 0 10px;color:var(--ink-2)">${esc(p.focus)}</p>
        <div class="progress-meta"><span>${p.inPhase.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / ${p.hours} giờ</span></div>
        <div class="progress-bar thin"><i style="width:${pct}%"></i></div>
        <ul class="check-list">${p.done.map((i) => `<li><label class="toggle"><input type="checkbox" data-check="${i.id}" ${checkState(i) ? 'checked' : ''} ${i.auto ? 'disabled' : ''}> <span>${esc(i.text)}</span></label>${i.autoNote ? `<span class="small muted">${esc(i.autoNote())}</span>` : ''}</li>`).join('')}</ul>
      </article>`;
  }).join('');
  const cps = checkpoints();
  el.innerHTML = `
    <section class="section">
      <h2>Lộ trình</h2>
      <div class="rule-box" style="margin-top:12px">${esc(RULE)}</div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn" id="doubtBtnP">Mình đang nghi ngờ</button></div>
      <div class="stack" style="margin-top:16px">${phaseHtml}</div>
      <p class="small muted" style="margin-top:10px">Số giờ mỗi giai đoạn dựa trên ước tính giờ học có hướng dẫn của Cambridge cộng thêm phần cho tự học; ngày tháng chỉ là dự kiến theo thời gian mỗi ngày bạn chọn.</p>
    </section>
    <section class="section">
      <h2>Mốc thi thử</h2>
      <div class="card"><ol class="cp-list">${cps.map((c, i) => {
        const test = db().toeic.find((x) => Math.abs((new Date(x.date) - new Date(c)) / 86400000) <= 21);
        return `<li class="${c < t ? 'done' : ''} ${c === cp.date ? 'next' : ''}"><span class="cp-dot"></span><span class="cp-date num">${fmtDate(c)}</span>
          <span class="cp-text">Mốc ${i + 1}${test ? ` · <b>${test.score}</b>` : ''}${c === cp.date ? ` <span class="muted">(còn ${cp.days} ngày)</span>` : ''}</span></li>`;
      }).join('')}</ol></div>
    </section>`;
  el.querySelector('#doubtBtnP').addEventListener('click', openDoubt);
  el.querySelectorAll('[data-check]').forEach((c) => c.addEventListener('change', () => {
    const id = c.dataset.check;
    const rec = db().checks.find((x) => x.id === id);
    if (rec) { rec.done = c.checked; rec.at = Date.now(); } else db().checks.push({ id, done: c.checked, at: Date.now() });
    save();
  }));
}

export function mount() {}
export function show() { location.replace('#/progress'); }
