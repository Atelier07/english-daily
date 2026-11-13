// "Mình đang nghi ngờ": bằng chứng + số liệu của chính bạn + luật. Ghi lại để tổng kết tuần thấy được.
import { db, save, uid } from './store.js';
import { openModal } from './ui.js';
import { esc, today, totalMinutes, fmtHours } from './util.js';
import { EVIDENCE, HABIT, STRENGTH } from './evidence.js';
import { RULE, currentPhase, phaseHours, nextCheckpoint, trend, toeicTrend } from './roadmap.js';

function evidenceHtml(ev) {
  return `<div class="doubt-ev">
    <div class="row" style="gap:8px"><h3>${esc(ev.title)}</h3><span class="tag strength-${ev.strength}">bằng chứng ${STRENGTH[ev.strength]}</span></div>
    ${ev.body.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="muted small">Nguồn: ${esc(ev.sources)}</p>
  </div>`;
}

function numbersHtml() {
  const p = currentPhase();
  const cp = nextCheckpoint();
  const tr = trend();
  const tt = toeicTrend();
  return `<div class="doubt-nums">
    <div class="stat"><span class="num">${fmtHours(totalMinutes())}</span><span class="k">giờ đã học</span></div>
    <div class="stat"><span class="num">${phaseHours(p).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span><span class="k">/ ${p.hours} giờ ${p.label}</span></div>
    <div class="stat"><span class="num">${cp.days}</span><span class="k">ngày đến mốc ${cp.index}</span></div>
  </div>
  <p class="small" style="margin-top:10px">Nhịp 4 tuần gần nhất: <b>${tr.last.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ/tuần</b> (4 tuần trước: ${tr.prev.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}; ${tr.label}).
  ${tt ? ` Thi thử: ${tt.from} → ${tt.to} (${tt.diff >= 0 ? '+' : ''}${tt.diff}).` : ' Chưa đủ 2 lần thi thử để so.'}</p>`;
}

export function openDoubt() {
  let chosen = null;
  const html = `
    <p class="muted">Nghi ngờ giữa chừng là chuyện ai tự học cũng gặp. Bạn đang nghi ngờ phần nào?</p>
    <div class="chip-group" id="doubtParts">${EVIDENCE.map((e) => `<button type="button" class="chip" data-part="${e.id}">${esc(e.part)}</button>`).join('')}</div>
    <div id="doubtEv" style="margin-top:14px"></div>
    <h3 style="margin-top:18px">Số liệu của bạn</h3>
    ${numbersHtml()}
    <div class="rule-box" style="margin-top:14px">${esc(RULE)}</div>
    <p class="muted small" style="margin-top:12px">${esc(HABIT.body)}</p>`;
  openModal({
    title: 'Mình đang nghi ngờ',
    html,
    actions: [{ label: 'Đóng' }],
    onOpen: (box) => {
      box.querySelectorAll('[data-part]').forEach((b) => b.addEventListener('click', () => {
        const ev = EVIDENCE.find((e) => e.id === b.dataset.part);
        box.querySelectorAll('[data-part]').forEach((x) => x.classList.toggle('on', x === b));
        box.querySelector('#doubtEv').innerHTML = evidenceHtml(ev);
        if (chosen !== ev.id) {
          chosen = ev.id;
          db().doubts.push({ id: uid(), date: today(), part: ev.part, ts: Date.now() });
          save();
        }
      }));
    },
  });
}
