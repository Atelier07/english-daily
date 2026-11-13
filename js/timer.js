// Một đồng hồ chạy tại một thời điểm. Lưu startedAt vào localStorage nên tải lại trang không mất giờ.
import { db, save, uid, BLOCKS } from './store.js';
import { today, fmtClock, dateStr } from './util.js';
import { toast } from './ui.js';

const MAX_MIN = 180; // quên tắt đồng hồ → chặn ở 3 giờ

export function running() { return db().timer; }
export function elapsedSec() {
  const t = db().timer;
  return t ? (Date.now() - t.startedAt) / 1000 : 0;
}

export function start(block) {
  if (db().timer) stop({ silent: true });
  db().timer = { block, startedAt: Date.now() };
  save();
  tick();
}

export function stop({ silent = false } = {}) {
  const t = db().timer;
  if (!t) return 0;
  let min = (Date.now() - t.startedAt) / 60000;
  db().timer = null;
  let capped = false;
  if (min > MAX_MIN) { min = MAX_MIN; capped = true; }
  min = Math.round(min * 10) / 10;
  if (min < 0.5) {
    save();
    if (!silent) toast('Chưa đến 30 giây nên không ghi.');
    return 0;
  }
  logMinutes(t.block, min, { date: dateStr(new Date(t.startedAt)), manual: false });
  if (!silent) toast(capped ? `Đồng hồ chạy quá lâu, chỉ ghi ${MAX_MIN} phút.` : `Đã ghi ${Math.round(min)} phút · ${BLOCKS[t.block].short}`);
  return min;
}

export function logMinutes(block, minutes, { date = today(), manual = true, note = '' } = {}) {
  const rec = { id: uid(), date, block, minutes: Math.round(minutes * 10) / 10, note, manual, ts: Date.now() };
  db().sessions.push(rec);
  save();
  // sau một lượt nghe/đọc: hỏi mức hiểu (xem comprehension.js)
  if (block === 'input') window.dispatchEvent(new CustomEvent('ed:input-logged', { detail: { id: rec.id } }));
  return rec;
}

export function toggle(block) {
  const t = db().timer;
  if (t && t.block === block) stop();
  else start(block);
}

// cập nhật mọi chỗ hiển thị đồng hồ mỗi giây
export function tick() {
  const t = db().timer;
  document.querySelectorAll('[data-timer-display]').forEach((el) => {
    const forBlock = el.getAttribute('data-timer-display');
    if (!t) { el.textContent = forBlock ? '00:00' : ''; return; }
    if (forBlock && forBlock !== t.block) { el.textContent = '00:00'; return; }
    el.textContent = fmtClock(elapsedSec());
  });
  const pill = document.getElementById('timerPill');
  if (pill) {
    pill.hidden = !t;
    if (t) document.getElementById('timerPillLabel').textContent = BLOCKS[t.block]?.short || '';
  }
}
setInterval(tick, 1000);
