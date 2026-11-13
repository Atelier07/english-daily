// Ngày, định dạng, thống kê dùng chung.
import { db } from './store.js';

const pad = (n) => String(n).padStart(2, '0');

export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => dateStr(new Date());

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
export function mondayOf(s) {
  const d = parseDate(s);
  const wd = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - wd);
  return dateStr(d);
}

export function viLongDate(d = new Date()) {
  try {
    const s = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) {
    return dateStr(d);
  }
}
export function viShortDate(s) {
  const d = parseDate(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function fmtMinutes(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}
export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
export function fmtHours(min, digits = 1) {
  const h = min / 60;
  return h.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- thống kê ----------
export const GOAL_HOURS = 600;
export const MIN_DAY = 15; // phút tối thiểu để giữ chuỗi

export function minutesByDate() {
  const map = new Map();
  for (const s of db().sessions) map.set(s.date, (map.get(s.date) || 0) + (Number(s.minutes) || 0));
  return map;
}
export function totalMinutes() {
  return db().sessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
}
export function dayMinutes(date = today(), block = null) {
  return db().sessions
    .filter((s) => s.date === date && (!block || s.block === block))
    .reduce((a, s) => a + (Number(s.minutes) || 0), 0);
}
export function weekMinutes(monday = mondayOf(today())) {
  const end = addDays(monday, 7);
  return db().sessions
    .filter((s) => s.date >= monday && s.date < end)
    .reduce((a, s) => a + (Number(s.minutes) || 0), 0);
}
// Chuỗi ngày: ngày có ≥ MIN_DAY phút. Mỗi tuần (thứ Hai → Chủ nhật) có 1 "ngày nghỉ có phép":
// một ngày lỡ đơn lẻ (hôm trước có học) được tự bỏ qua mà không làm đứt chuỗi.
export function streakInfo() {
  const map = minutesByDate();
  const ok = (d) => (map.get(d) || 0) >= MIN_DAY;
  const t = today();
  const todayDone = ok(t);
  let cur = 0;
  const restWeeks = new Set();
  const restDays = [];
  let d = todayDone ? t : addDays(t, -1);
  for (let guard = 0; guard < 4000; guard++) {
    if (ok(d)) { cur++; d = addDays(d, -1); continue; }
    const wk = mondayOf(d);
    if (cur > 0 || d === addDays(t, -1)) {
      if (!restWeeks.has(wk) && ok(addDays(d, -1))) {
        restWeeks.add(wk);
        restDays.push(d);
        d = addDays(d, -1);
        continue;
      }
    }
    break;
  }
  // chuỗi dài nhất, cùng luật ngày nghỉ
  const days = [...map.keys()].filter(ok).sort();
  let best = 0;
  if (days.length) {
    let run = 0;
    const used = new Set();
    for (let day = days[0]; day <= t; day = addDays(day, 1)) {
      if (ok(day)) { run++; best = Math.max(best, run); continue; }
      const wk = mondayOf(day);
      if (!used.has(wk) && ok(addDays(day, -1)) && (ok(addDays(day, 1)) || addDays(day, 1) === t || day === t)) {
        used.add(wk);
        continue;
      }
      if (day === t) continue; // hôm nay chưa xong thì chưa tính là đứt
      run = 0;
    }
  }
  const thisWeek = mondayOf(t);
  return {
    current: cur,
    best: Math.max(best, cur),
    todayDone,
    restDays,
    restUsedThisWeek: restDays.some((x) => mondayOf(x) === thisWeek),
  };
}

export function dueCount(date = today()) {
  return db().phrases.filter((p) => !p.due || p.due <= date).length;
}
