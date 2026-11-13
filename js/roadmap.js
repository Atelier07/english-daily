// Lộ trình theo trình độ xuất phát và thời gian mỗi ngày.
// Số giờ mỗi giai đoạn cố định (ước tính giờ học có hướng dẫn của Cambridge + biên cho tự học);
// ngày tháng chỉ là dự kiến, tính thật thà từ số giờ mỗi tuần bạn chọn.
import { db } from './store.js';
import { today, addDays, parseDate, dateStr, daysBetween, totalMinutes } from './util.js';
import { level, weeklyHours, budget, getProfile } from './profile.js';

export const START = '2026-11-13';
export const RULE = 'Chỉ xét lại cách học ở ngày mốc. Chỉ đổi khi 2 lần thi thử liền không nhích.';

const masteredCount = () => db().items.filter((i) => i.kind === 'chunk' && i.mastered).length;

const DEFS = [
  {
    id: 'p0', label: 'GĐ0', name: 'Nền tảng bằng cụm', target: 'A2',
    hoursBy: { A0: 200, A1: 100 },
    focus: 'Những cụm và khung câu dùng nhiều nhất: chào hỏi, muốn, xin, hỏi, kể việc đơn giản. Nghe trước, nói theo, thay ô bằng miệng, đóng vai.',
    done: [
      { id: 'p0-chunks', text: 'Thuộc khoảng 150 cụm (nói ra được từ nghĩa tiếng Việt)', auto: () => masteredCount() >= 150, autoNote: () => `${masteredCount()} / 150` },
      { id: 'p0-listen', text: 'Nghe hiểu hội thoại ngắn ở tốc độ thường, không cần nhìn chữ' },
      { id: 'p0-talk', text: 'Tự nói 5 câu nối nhau về một việc thường ngày' },
    ],
  },
  {
    id: 'p1', label: 'GĐ1', name: 'Nền tai và âm', target: 'A2+', hours: 150,
    focus: 'Tai quen âm tiếng Anh, nói rõ âm cuối, cụm lớn dần. Thêm tài liệu dễ (BBC 6 Minute English, VOA).',
    done: [
      { id: 'p1-endings', text: 'Nói rõ âm cuối (-s/-ed) trong các cặp từ luyện' },
      { id: 'p1-bbc', text: 'Nghe BBC 6 Minute English có phụ đề tiếng Anh, hiểu ý chính' },
      { id: 'p1-chunks', text: 'Thuộc khoảng 300 cụm', auto: () => masteredCount() >= 300, autoNote: () => `${masteredCount()} / 300` },
    ],
  },
  {
    id: 'p2', label: 'GĐ2', name: 'Lên B1', target: 'B1', hours: 200,
    focus: 'Video hướng dẫn kỹ thuật nói chậm, có phụ đề. Nói dài hơn, lỗi lặp lại ít dần.',
    done: [
      { id: 'p2-tech', text: 'Xem video hướng dẫn kỹ thuật nói chậm, có phụ đề tiếng Anh' },
      { id: 'p2-talk', text: 'Nói liền 2 phút về một chủ đề quen' },
    ],
  },
  {
    id: 'p3', label: 'GĐ3', name: 'Lên B2', target: 'B2', hours: 250,
    focus: 'Nội dung thật không cần phụ đề tiếng Việt, luyện đề TOEIC đều đặn.',
    done: [
      {
        id: 'p3-toeic', text: 'TOEIC thi thử 750+ (mốc quy đổi B2 chỉ gần đúng)',
        auto: () => db().toeic.some((t) => t.score >= 750),
        autoNote: () => { const m = Math.max(0, ...db().toeic.map((t) => t.score)); return m ? `cao nhất ${m}` : 'chưa thi'; },
      },
    ],
  },
];

const ORDER = { A0: ['p0', 'p1', 'p2', 'p3'], A1: ['p0', 'p1', 'p2', 'p3'], A2: ['p1', 'p2', 'p3'], B1: ['p3'], B2: ['p3'] };

export function monthLabel(s) { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getFullYear()}`; }

// Các giai đoạn với giờ cộng dồn và ngày dự kiến (từ hôm nay, theo số giờ/tuần đã chọn)
export function phases(lv = level(), perWeek = weeklyHours()) {
  const doneH = totalMinutes() / 60;
  let acc = 0;
  let cursor = today();
  return (ORDER[lv] || ORDER.A0).map((id) => {
    const d = DEFS.find((x) => x.id === id);
    const hours = d.hours || d.hoursBy[lv] || 100;
    const startH = acc;
    const endH = acc + hours;
    acc = endH;
    const inPhase = Math.max(0, Math.min(hours, doneH - startH));
    const remaining = hours - inPhase;
    const status = inPhase >= hours ? 'done' : doneH >= startH ? 'current' : 'future';
    const from = status === 'future' ? cursor : null;
    const to = remaining > 0 ? addDays(cursor, Math.round((remaining / Math.max(0.5, perWeek)) * 7)) : null;
    if (to) cursor = to;
    return { ...d, hours, startH, endH, inPhase, status, from, to };
  });
}

export const goalHours = () => { const ps = phases(); return ps[ps.length - 1].endH; };
export function currentPhase() { const ps = phases(); return ps.find((p) => p.status !== 'done') || ps[ps.length - 1]; }
export const phaseHours = (p) => p.inPhase;
export function etaFor(target) {
  const ps = phases();
  const p = ps.find((x) => x.target === target);
  return p ? (p.to || today()) : null;
}

// mốc trên thanh giờ: cuối mỗi giai đoạn mang trình độ mục tiêu
export function levelMarks() {
  return phases().filter((p) => ['A2', 'B1', 'B2'].includes(p.target)).map((p) => ({ h: p.endH, label: p.target }));
}

export function planSentence() {
  const b = budget();
  const b1 = etaFor('B1');
  const b2 = etaFor('B2');
  const wk = weeklyHours(b).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `Với ${b} phút/ngày (khoảng ${wk} giờ/tuần, nghỉ 1 ngày/tuần): ${b1 ? `B1 khoảng tháng ${monthLabel(b1)}, ` : ''}B2 khoảng tháng ${monthLabel(b2)}.`;
}

function addMonths(s, n) {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateStr(d);
}

export function startDate() { const p = getProfile(); return (p && p.startDate) || START; }

// mốc thi thử 3 tháng/lần từ ngày bắt đầu đến khi dự kiến đạt B2 (tối đa 16 mốc)
export function checkpoints() {
  const end = etaFor('B2') || today();
  const out = [];
  for (let i = 1; i <= 16; i++) {
    const c = addMonths(startDate(), 3 * i);
    out.push(c);
    if (c >= end) break;
  }
  return out;
}

export function nextCheckpoint(date = today()) {
  const cps = checkpoints();
  const d = cps.find((c) => c >= date) || cps[cps.length - 1];
  return { date: d, days: Math.max(0, daysBetween(date, d)), index: cps.indexOf(d) + 1 };
}

export function minutesBetween(from, to) {
  return db().sessions.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + (Number(s.minutes) || 0), 0);
}

export function trend() {
  const t = today();
  const last = minutesBetween(addDays(t, -27), t) / 60 / 4;
  const prev = minutesBetween(addDays(t, -55), addDays(t, -28)) / 60 / 4;
  let label = 'đều';
  if (prev === 0 && last > 0) label = 'mới bắt đầu';
  else if (last > prev * 1.15) label = 'đang tăng';
  else if (last < prev * 0.85) label = 'đang giảm';
  return { last, prev, label };
}

export function checkState(item) {
  if (item.auto && item.auto()) return true;
  const rec = db().checks.find((c) => c.id === item.id);
  return !!(rec && rec.done);
}

export function toeicTrend() {
  const list = db().toeic.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (list.length < 2) return null;
  const a = list[list.length - 2], b = list[list.length - 1];
  return { from: a.score, to: b.score, diff: b.score - a.score };
}
