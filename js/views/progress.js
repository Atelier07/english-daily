import { db, save, uid, BLOCKS } from '../store.js';
import {
  esc, today, mondayOf, addDays, weekMinutes, totalMinutes, streakInfo, dueCount, fmtHours, viShortDate,
  parseDate,
} from '../util.js';
import { toast, confirmModal } from '../ui.js';
import { hasAI, askJSON, weeklyPrompt } from '../ai.js';
import { progressMarkdown } from '../summary.js';
import { goalHours, planSentence } from '../roadmap.js';
import { weeklyHours } from '../profile.js';
import { stats as itemStats } from '../items.js';
import { renderRoadmapInto } from './roadmap.js';

const WEEKLY_KEY = 'englishDaily.weekly';
function lastWeekly() { try { return JSON.parse(localStorage.getItem(WEEKLY_KEY) || 'null'); } catch (e) { return null; } }

export function weeklyLog() {
  const t = today();
  const from = addDays(t, -6);
  const d = db();
  const pron = d.pronLog.filter((x) => x.date >= from);
  const dict = d.dictLog.filter((x) => x.date >= from);
  const reviewed = d.phrases.filter((p) => p.lastReview && p.lastReview >= from);
  const extra = [
    '## Thêm (7 ngày)',
    `- Cụm từ đã ôn: ${reviewed.length}; cụm có lần quên trong lịch sử: ${reviewed.filter((p) => p.lapses).length}`,
    `- Lỗi mới lưu: ${d.errors.filter((e) => e.created >= Date.parse(from)).length}`,
    `- Luyện âm cuối: ${pron.length} lần, nghi bỏ âm cuối ${pron.filter((x) => x.result === 'missing').length} lần`,
    `- Nghe chép: ${dict.length} câu; sót từ chức năng ${dict.reduce((a, x) => a + x.function, 0)}, đuôi -s/-ed ${dict.reduce((a, x) => a + x.ending, 0)}, từ nội dung ${dict.reduce((a, x) => a + x.content, 0)}`,
    `- Lúc nghi ngờ: ${d.doubts.filter((x) => x.date >= from).map((x) => `${x.date} ${x.part}`).join(', ') || 'không có'}`,
  ];
  return `${progressMarkdown()}\n${extra.join('\n')}`;
}

function weeklyHtml(w) {
  if (!w || !w.data) return '';
  const d = w.data;
  const list = (a) => (Array.isArray(a) ? a : [a]).filter(Boolean).map((x) => `<li>${esc(String(x))}</li>`).join('');
  return `<div class="weekly">
    <p class="muted small">Tổng kết ngày ${viShortDate(w.date)}/${w.date.slice(0, 4)}</p>
    ${d.went_well ? `<h3>Đã làm tốt</h3><ul>${list(d.went_well)}</ul>` : ''}
    ${d.focus ? `<h3>Tuần tới tập trung</h3><ul>${list(d.focus)}</ul>` : ''}
    ${d.material ? `<h3>Độ khó tài liệu</h3><p>${esc(String(d.material))}</p>` : ''}
    ${d.doubt_note ? `<p class="muted">${esc(String(d.doubt_note))}</p>` : ''}
  </div>`;
}

let root;
let resizeT = null;
// Vẽ SVG đúng bằng bề rộng thật để chữ trên trục luôn ~11px, không bị co nhỏ trên điện thoại.
function chartW() {
  const w = root && root.clientWidth ? root.clientWidth - 38 : 640;
  return Math.max(280, Math.min(720, Math.round(w)));
}
// đường mục tiêu = số giờ/tuần theo thời gian mỗi ngày đã chọn
function paceNeeded() { return weeklyHours(); }

function weeklyChart() {
  const thisMon = mondayOf(today());
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const m = addDays(thisMon, -7 * i);
    weeks.push({ m, h: weekMinutes(m) / 60 });
  }
  const pace = paceNeeded();
  const W = chartW(), H = 220, padL = 30, padR = 8, padT = 22, padB = 26;
  const maxH = Math.max(2, pace * 1.15, ...weeks.map((w) => w.h));
  const top = Math.ceil(maxH / 2) * 2;
  const iw = W - padL - padR, ih = H - padT - padB;
  const bw = iw / weeks.length;
  const y = (v) => padT + ih - (v / top) * ih;
  const ticks = [0, top / 2, top];
  const grid = ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');
  const bars = weeks.map((w, i) => {
    const x = padL + i * bw + bw * 0.18;
    const bh = Math.max(w.h > 0 ? 2 : 0, ih - (y(w.h) - padT));
    const cur = i === weeks.length - 1;
    const every = W < 420 ? 3 : 2;
    const label = (weeks.length - 1 - i) % every === 0 ? `<text x="${x + bw * 0.32}" y="${H - 8}" text-anchor="middle">${viShortDate(w.m)}</text>` : '';
    const val = w.h > 0 ? `<text class="val" x="${x + bw * 0.32}" y="${y(w.h) - 5}" text-anchor="middle">${fmtHours(w.h * 60)}</text>` : '';
    return `<rect class="bar ${cur ? 'cur' : ''}" x="${x}" y="${padT + ih - bh}" width="${bw * 0.64}" height="${bh}" rx="3"><title>Tuần từ ${viShortDate(w.m)}: ${fmtHours(w.h * 60)} giờ</title></rect>${val}${label}`;
  }).join('');
  const goal = `<line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(pace)}" y2="${y(pace)}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Số giờ học mỗi tuần, 12 tuần gần nhất">${grid}${goal}${bars}</svg>`;
}

function toeicChart(list) {
  if (!list.length) return '';
  const pts = list.slice().sort((a, b) => a.date.localeCompare(b.date));
  const W = chartW(), H = 210, padL = 36, padR = 16, padT = 16, padB = 34;
  const lo = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.score)) - 100) / 100) * 100);
  const hi = 990;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i) => padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [lo, Math.round((lo + hi) / 2 / 50) * 50, hi];
  const grid = ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');
  const target = `<line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(750)}" y2="${y(750)}"/><text x="${W - padR}" y="${y(750) - 6}" text-anchor="end">mục tiêu 750</text>`;
  const path = pts.length > 1 ? `<path class="line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join('')}"/>` : '';
  const dots = pts.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.score)}" r="4.5"><title>${viShortDate(p.date)}: ${p.score}</title></circle>
    <text class="val" x="${x(i)}" y="${y(p.score) - 10}" text-anchor="middle">${p.score}</text>
    <text x="${x(i)}" y="${H - 8}" text-anchor="middle">${viShortDate(p.date)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Điểm TOEIC thi thử theo thời gian">${grid}${target}${path}${dots}</svg>`;
}

function render() {
  const total = totalMinutes();
  const st = streakInfo();
  const pace = paceNeeded();
  const week = weekMinutes();
  const thisMon = mondayOf(today());
  const byBlock = Object.entries(BLOCKS).map(([k, b]) => {
    const m = db().sessions.filter((s) => s.block === k && s.date >= thisMon).reduce((a, s) => a + s.minutes, 0);
    return `<li><span>${esc(b.name)}</span><span class="spacer"></span><span class="num">${Math.round(m)} phút</span></li>`;
  }).join('');
  const toeic = db().toeic.slice().sort((a, b) => b.date.localeCompare(a.date));
  const lastTest = toeic[0];
  const nextTest = lastTest ? addDays(lastTest.date, 91) : null;
  const openErr = db().errors.filter((e) => !e.fixed).length;

  const its = itemStats();
  const goal = goalHours();
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Tiến độ</div>
      <h1>Đường dài, đo bằng giờ</h1>
      <p class="lede">${esc(planSentence())}</p>
    </div>

    <div class="kpis">
      <div class="stat"><span class="num">${fmtHours(total)}</span><span class="k">/ ${goal} giờ</span></div>
      <div class="stat"><span class="num">${st.current}</span><span class="k">ngày liên tiếp · dài nhất ${st.best}</span></div>
      <div class="stat"><span class="num">${its.mastered}</span><span class="k">cụm thuộc · ${its.learning} đang học</span></div>
      <div class="stat"><span class="num">${its.reviewed7}</span><span class="k">thẻ đã ôn 7 ngày</span></div>
    </div>

    <div id="roadmapPart"></div>

    <section class="section">
      <div class="row" style="margin-bottom:10px"><h2>Giờ mỗi tuần</h2><span class="spacer"></span><span class="small">tuần này ${fmtHours(week)} / ${weeklyHours().toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ</span></div>
      <div class="card">${weeklyChart()}</div>
      <div class="card"><ul class="session-list">${byBlock}</ul><p class="muted small" style="margin:6px 0 0">Phân bổ tuần này theo từng phần.</p></div>
    </section>

    <section class="section">
      <h2>TOEIC thi thử</h2>
      <p class="muted small">Thi thử 3 tháng một lần, đủ 2 kỹ năng Nghe–Đọc, bấm giờ thật. ${nextTest ? `Lần tới nên vào khoảng <b>${viShortDate(nextTest)}/${nextTest.slice(0, 4)}</b>.` : 'Chưa có lần nào: làm một bài ngay để có mốc xuất phát.'}</p>
      ${toeic.length ? `<div class="card">${toeicChart(toeic)}</div>` : ''}
      <div class="card">
        <div class="field-grid">
          <div class="field"><label for="tDate">Ngày thi</label><input id="tDate" class="input" type="date" value="${today()}" max="${today()}"></div>
          <div class="field"><label for="tScore">Điểm (10–990)</label><input id="tScore" class="input" type="number" inputmode="numeric" min="10" max="990" step="5" placeholder="vd: 450"></div>
        </div>
        <div class="field"><label for="tNote">Ghi chú (đề nào, Nghe/Đọc bao nhiêu)</label><input id="tNote" class="input" placeholder="vd: ETS 2024 Test 1 · L 250 / R 200"></div>
        <div class="row" style="margin-top:12px"><button type="button" class="btn btn-primary" id="addToeic">Lưu điểm</button></div>
        ${toeic.length ? `<ul class="toeic-list">${toeic.map((t) => `
          <li><span class="num" style="font-size:1.15rem">${t.score}</span><span class="muted">${viShortDate(t.date)}/${t.date.slice(0, 4)}</span>
          <span class="small muted" style="flex:1;min-width:0;overflow-wrap:anywhere">${esc(t.note || '')}</span>
          <button type="button" class="btn btn-quiet btn-sm" data-tdel="${t.id}">Xoá</button></li>`).join('')}</ul>` : ''}
      </div>
    </section>

    <section class="section">
      <h2>Tổng kết tuần</h2>
      <p class="muted small">AI đọc nhật ký 7 ngày (giờ học, mức hiểu, lỗi, cụm hay quên, lúc nghi ngờ) và nói ngắn: điều làm tốt, 1–2 việc cho tuần tới, độ khó tài liệu.</p>
      <div class="card">
        <div id="weeklyOut">${weeklyHtml(lastWeekly()) || '<p class="muted small" style="margin:0">Chưa có bản tổng kết nào.</p>'}</div>
        <div class="row" style="margin-top:12px"><button type="button" class="btn" id="weeklyBtn">AI tổng kết tuần</button></div>
      </div>
    </section>

    <p class="muted small section">Xem thêm: <a href="#/errors">Lỗi của tôi</a> · <a href="#/why">Vì sao cách này hiệu quả</a> · <a href="#/data">Xuất / nhập dữ liệu</a></p>
  `;

  renderRoadmapInto(root.querySelector('#roadmapPart'));
  root.querySelector('#weeklyBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const out = root.querySelector('#weeklyOut');
    if (!(await hasAI())) { out.innerHTML = '<p class="small">Cần khoá Gemini: vào <a href="#/settings">Cài đặt</a> để kết nối repo dữ liệu.</p>'; return; }
    btn.disabled = true;
    out.innerHTML = '<p class="muted small">AI đang đọc nhật ký…</p>';
    try {
      const { data } = await askJSON(weeklyPrompt(weeklyLog()));
      const w = { date: today(), data };
      try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(w)); } catch (err) { /* ignore */ }
      out.innerHTML = weeklyHtml(w);
    } catch (err) { out.innerHTML = `<p class="small">${esc(err.message)}</p>`; }
    btn.disabled = false;
  });
  root.querySelector('#addToeic').addEventListener('click', () => {
    const score = Number(root.querySelector('#tScore').value);
    const date = root.querySelector('#tDate').value || today();
    if (!score || score < 10 || score > 990) { toast('Điểm TOEIC từ 10 đến 990.'); return; }
    db().toeic.push({ id: uid(), date, score: Math.round(score / 5) * 5, note: root.querySelector('#tNote').value.trim().slice(0, 120) });
    save();
    toast('Đã lưu điểm.');
  });
  root.querySelectorAll('[data-tdel]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Xoá điểm này?', message: 'Không hoàn tác được.', confirmLabel: 'Xoá', danger: true });
    if (!ok) return;
    db().toeic = db().toeic.filter((t) => t.id !== b.dataset.tdel);
    save();
  }));
}

export function mount(el) {
  root = el;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (!root.hidden) render(); }, 200);
  });
}
export function show() { render(); }
export function onData() { render(); }
