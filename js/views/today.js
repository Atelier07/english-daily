import { db, save, BLOCKS } from '../store.js';
import {
  today, viLongDate, fmtMinutes, fmtHours, totalMinutes, weekMinutes, dayMinutes, streakInfo, esc, MIN_DAY,
} from '../util.js';
import { logMinutes } from '../timer.js';
import { openModal, toast, confirmModal } from '../ui.js';
import { openDoubt } from '../doubt.js';
import { goalHours, levelMarks, planSentence } from '../roadmap.js';
import { loadIndex, loadDay } from '../course.js';
import { budget, currentDay, dayDoneMap, needsPlacement, skipPlacement, weeklyHours, saveProfile } from '../profile.js';
import {
  pendingWeek, snoozed, snooze, reviewWeek, renderCheck, startWeekReview, weekCardHtml, weekRange,
} from '../weekly.js';
import { dueItems } from '../items.js';
import { startSession, renderSession, hasSession, resumeClock, stopSession, buildSteps, planFor, STEPS } from '../session.js';

let root;
let renderToken = 0;

function quietSection() {
  const total = totalMinutes();
  const st = streakInfo();
  const goal = goalHours();
  const pct = Math.min(100, (total / 60 / goal) * 100);
  const sessions = db().sessions.filter((s) => s.date === today()).sort((a, b) => b.ts - a.ts);
  return `
    <details class="quiet">
      <summary>Số liệu và ghi giờ</summary>
      <div class="quiet-body">
        <div class="stats-strip">
          <div class="stat"><span class="num">${st.current}</span><span class="k">ngày liên tiếp</span></div>
          <div class="stat"><span class="num">${fmtHours(weekMinutes())}</span><span class="k">/ ${weeklyHours().toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ tuần</span></div>
          <div class="stat"><span class="num">${Math.round(dayMinutes(today()))}</span><span class="k">phút hôm nay</span></div>
        </div>
        <div class="progress">
          <div class="progress-meta"><span><span class="num">${fmtHours(total)}</span> / ${goal} giờ</span></div>
          <div class="progress-bar"><i style="width:${pct}%"></i>${levelMarks().filter((m) => m.h < goal).map((m) => `<b class="cefr-tick" style="left:${(m.h / goal) * 100}%"></b>`).join('')}</div>
          <div class="cefr-labels">${levelMarks().map((m) => `<span style="left:${(m.h / goal) * 100}%">${m.label}</span>`).join('')}</div>
        </div>
        <p class="small">${esc(planSentence())}</p>
        ${st.restUsedThisWeek ? '<p class="small muted">Tuần này đã dùng ngày nghỉ có phép, chuỗi vẫn giữ.</p>' : ''}
        <div class="row">
          <button type="button" class="btn btn-sm" id="manualBtn">+ Nhập giờ học ở chỗ khác</button>
          <button type="button" class="btn btn-quiet btn-sm" id="doubtBtn">Mình đang nghi ngờ</button>
        </div>
        ${sessions.length ? `<ul class="session-list">${sessions.map((s) => `
          <li><span>${esc(BLOCKS[s.block]?.short || s.block)}</span><span class="when">${esc(s.note || '')}</span><span class="spacer"></span>
          <span class="num">${fmtMinutes(s.minutes)}</span><button type="button" class="btn btn-quiet btn-sm" data-del="${s.id}">Xoá</button></li>`).join('')}</ul>` : ''}
      </div>
    </details>`;
}

function wireWeek() {
  root.querySelectorAll('[data-wk]').forEach((b) => b.addEventListener('click', () => startCheck(Number(b.dataset.wk))));
}
function startCheck(w) {
  stopSession();
  ++renderToken;
  root.innerHTML = '<div id="wkHost"></div>';
  renderCheck(root.querySelector('#wkHost'), w, () => render());
}

function wireQuiet() {
  wireWeek();
  const mb = root.querySelector('#manualBtn');
  if (mb) mb.addEventListener('click', manualEntry);
  const db2 = root.querySelector('#doubtBtn');
  if (db2) db2.addEventListener('click', openDoubt);
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Xoá lượt này?', message: 'Thời gian của lượt này sẽ bị trừ khỏi tổng.', confirmLabel: 'Xoá', danger: true });
    if (!ok) return;
    db().sessions = db().sessions.filter((s) => s.id !== b.dataset.del);
    save();
    render();
  }));
}

async function render() {
  const token = ++renderToken;
  stopSession();
  if (hasSession() && !db().session.paused) {
    resumeClock();
    root.innerHTML = '<div id="sessHost"></div>';
    renderSession(root.querySelector('#sessHost'), () => render());
    return;
  }
  const head = `<div class="eyebrow">${esc(viLongDate())}</div>`;

  if (needsPlacement()) {
    root.innerHTML = `
      <div class="hero">
        ${head}
        <h1>Chào bạn.</h1>
        <p class="lede">Trước khi bắt đầu, làm một bài xếp lớp ngắn (5–7 phút) để app biết nên bắt đầu từ ngày nào và mỗi ngày học bao lâu.</p>
        <a class="btn btn-primary btn-xl" href="#/placement">Làm bài xếp lớp</a>
        <button type="button" class="btn btn-quiet" id="skipPl">Bỏ qua, học từ Ngày 1</button>
      </div>`;
    root.querySelector('#skipPl').addEventListener('click', () => { skipPlacement(); render(); });
    return;
  }

  const fin = db().session && db().session.finished;
  let idx;
  try { idx = await loadIndex(); } catch (e) {
    if (token !== renderToken) return;
    root.innerHTML = `<div class="hero">${head}<h1>Chưa tải được khoá học</h1><p class="lede">Không đọc được course/index.json. Kiểm tra kết nối mạng rồi mở lại. Sau lần tải đầu, app học được cả khi mất mạng.</p></div>${quietSection()}`;
    wireQuiet();
    return;
  }
  if (token !== renderToken) return;

  if (fin && fin.date === today()) {
    const next = currentDay();
    const nextEntry = idx.find((d) => d.day === next && !dayDoneMap()[next]);
    root.innerHTML = `
      <div class="hero">
        ${head}
        <h1>${fin.reviewOnly ? `Xong phần ${esc((fin.label || 'ôn lại').toLowerCase())}.` : `Xong Ngày ${fin.day}.`}</h1>
        <p class="lede">${fin.minutes ? `${fin.minutes} phút. ` : ''}${fin.reviewOnly ? 'Các thẻ đã được ôn.' : `${fin.chunks} cụm mới đã vào thẻ ôn${fin.known ? ` (${fin.known} cụm đã biết nhắc lại sau 7 ngày)` : ''}, sẽ quay lại từ ngày mai.`}</p>
        ${pendingWeek() ? `<button type="button" class="btn btn-primary" data-wk="${pendingWeek()}">Làm kiểm tra tuần ${pendingWeek()} ngay</button>` : ''}
        <p class="small">Mai học tiếp ${nextEntry ? `Ngày ${next}: ${esc(nextEntry.title || nextEntry.function || '')}` : 'phần ôn'}.</p>
        ${nextEntry && !pendingWeek() ? `<button type="button" class="btn btn-quiet" id="moreDay">Học luôn Ngày ${next}</button>` : ''}
      </div>
      ${weekCardHtml()}
      ${quietSection()}`;
    const md = root.querySelector('#moreDay');
    if (md) md.addEventListener('click', async () => { db().session = null; save(); await startSession(next); render(); });
    wireQuiet();
    return;
  }

  const paused = hasSession() && db().session.paused ? db().session : null;
  const pw = pendingWeek();
  if (!paused && pw && !snoozed()) {
    const { from, to } = weekRange(pw);
    root.innerHTML = `
      <div class="hero">
        ${head}
        <h1>Kiểm tra tuần ${pw}</h1>
        <p class="lede">Bạn vừa học xong Ngày ${to}. Khoảng 10 tình huống từ Ngày ${from}–${to}: đọc ý tiếng Việt, nói hoặc gõ câu tiếng Anh. Khoảng 5 phút. Chưa đạt cũng không sao, chỉ ôn lại tuần đó.</p>
        <button type="button" class="btn btn-primary btn-xl" data-wk="${pw}">Bắt đầu kiểm tra</button>
        <button type="button" class="btn btn-quiet" id="wkLater">Để sau, học bài mới</button>
      </div>
      ${weekCardHtml({ hero: true })}${quietSection()}`;
    root.querySelector('#wkLater').addEventListener('click', () => { snooze(); render(); });
    wireQuiet();
    return;
  }
  const rw = reviewWeek();
  if (!paused && rw && !pw) {
    root.innerHTML = `
      <div class="hero">
        ${head}
        <h1>Ôn lại tuần ${rw}</h1>
        <p class="lede">Kiểm tra tuần ${rw} chưa đạt. Hôm nay ôn lại các cụm của tuần đó trước, rồi mới học bài mới.</p>
        <button type="button" class="btn btn-primary btn-xl" id="wkReview">Bắt đầu ôn tuần ${rw}</button>
        <button type="button" class="btn btn-quiet" id="wkSkip">Bỏ qua, học bài mới</button>
      </div>
      ${weekCardHtml()}${quietSection()}`;
    root.querySelector('#wkReview').addEventListener('click', async () => { if (await startWeekReview(rw)) render(); else { toast('Chưa có thẻ nào của tuần này.'); render(); } });
    root.querySelector('#wkSkip').addEventListener('click', () => { saveProfile({ reviewWeek: null }); render(); });
    wireQuiet();
    return;
  }
  const n = paused ? paused.day : currentDay();
  if (!idx.length) {
    root.innerHTML = `<div class="hero">${head}<h1>Khoá học chưa có bài nào</h1><p class="lede">course/index.json đang trống. Bài sẽ được thêm dần.</p></div>${quietSection()}`;
    wireQuiet();
    return;
  }
  const entry = idx.find((d) => d.day === n) || idx[0];
  const allDone = !!dayDoneMap()[entry.day] && !idx.find((d) => d.day > entry.day);
  const due = dueItems().length;
  if (allDone) {
    root.innerHTML = `
      <div class="hero">
        ${head}
        <h1>Bạn đã học hết ${idx.length} ngày hiện có.</h1>
        <p class="lede">Bài mới sẽ được thêm dần. Trong lúc chờ, ôn thẻ mỗi ngày để giữ những gì đã học.</p>
        ${due ? `<button type="button" class="btn btn-primary btn-xl" id="reviewOnly">Ôn ${due} thẻ</button>` : '<p class="small">Hôm nay không còn thẻ đến hạn.</p>'}
      </div>
      ${quietSection()}`;
    const ro = root.querySelector('#reviewOnly');
    if (ro) ro.addEventListener('click', async () => {
      await startSession(entry.day);
      db().session.steps = ['S1'];
      save();
      render();
    });
    wireQuiet();
    return;
  }

  let day = null;
  try { day = await loadDay(entry.day, idx); } catch (e) { /* hiện tối thiểu */ }
  if (token !== renderToken) return;
  const b = budget();
  const isNew = !!day && !paused && !dayDoneMap()[entry.day];
  const steps = day ? (paused ? paused.steps : buildSteps(day, b, Math.min(due, planFor(b).rev), { isNew })) : [];
  root.innerHTML = `
    <div class="hero">
      ${head}
      <h1>Ngày ${entry.day}${day && day.title ? `<span class="hero-sub">${esc(day.title)}</span>` : ''}</h1>
      ${day && day.intro_vi ? `<p class="lede">${esc(day.intro_vi)}</p>` : ''}
      ${!day ? `<p class="notice" id="dayMissing">Chưa tải được bài của Ngày ${entry.day} (file course/${esc(entry.file || '')} thiếu hoặc lỗi). Kiểm tra mạng rồi mở lại; nếu vẫn vậy, bài này chưa được thêm vào khoá.</p>` : ''}
      <button type="button" class="btn btn-primary btn-xl" id="startBtn" ${!day ? 'disabled' : ''}>${paused ? `Tiếp tục Ngày ${entry.day} · bước ${paused.i + 1}/${paused.steps.length}` : `Bắt đầu Ngày ${entry.day} · ${b} phút`}</button>
      ${steps.length ? `<ol class="step-preview">${steps.map((k) => `<li>${esc(STEPS[k].name)}${k === 'S1' ? ` · ${Math.min(due, planFor(b).rev)} thẻ` : ''}${k === 'S0' && day ? ` · ${day.chunks.length} cụm` : ''}${k === 'S3' && day ? ` · ${day.chunks.length} cụm` : ''}</li>`).join('')}</ol>` : ''}
      ${steps.includes('S0') ? '<p class="small muted scan-note">Sau Kiểm tra nhanh: biết hết thì chỉ còn Đóng vai (khoảng 5 phút); cụm nào chưa chắc thì chỉ học kỹ cụm đó.</p>' : ''}
    </div>
    ${weekCardHtml()}
    ${quietSection()}`;
  root.querySelector('#startBtn').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { if (paused) resumeClock(); else await startSession(entry.day); render(); } catch (err) { toast('Chưa tải được bài, thử lại.'); e.currentTarget.disabled = false; }
  });
  wireQuiet();
}

function manualEntry() {
  const opts = Object.entries(BLOCKS).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('');
  openModal({
    title: 'Nhập giờ học ở chỗ khác',
    html: `
      <div class="field"><label for="mBlock">Phần</label><select id="mBlock" class="select">${opts}</select></div>
      <div class="field-grid" style="margin-top:12px">
        <div class="field"><label for="mMin">Số phút</label><input id="mMin" class="input" type="number" inputmode="numeric" min="1" max="600" value="20"></div>
        <div class="field"><label for="mDate">Ngày</label><input id="mDate" class="input" type="date" value="${today()}" max="${today()}"></div>
      </div>
      <div class="field"><label for="mNote">Ghi chú</label><input id="mNote" class="input" placeholder="vd: xem video tiếng Anh"></div>`,
    actions: [
      { label: 'Huỷ' },
      {
        label: 'Ghi lại', kind: 'primary', onClick: (box) => {
          const min = Number(box.querySelector('#mMin').value);
          const date = box.querySelector('#mDate').value || today();
          if (!min || min <= 0 || min > 600) { toast('Số phút cần từ 1 đến 600.'); return false; }
          if (date > today()) { toast('Không ghi cho ngày tương lai.'); return false; }
          logMinutes(box.querySelector('#mBlock').value, min, { date, manual: true, note: box.querySelector('#mNote').value.trim().slice(0, 80) });
          toast(`Đã ghi ${min} phút.`);
          render();
        },
      },
    ],
  });
}

export function mount(el) { root = el; }
export function show() { render(); }
export function hide() { stopSession(); }
export { MIN_DAY };
