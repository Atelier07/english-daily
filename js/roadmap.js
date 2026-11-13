// Lộ trình 3 giai đoạn, mốc thi thử 3 tháng một lần, và các con số "của chính bạn".
import { db } from './store.js';
import { today, addDays, parseDate, dateStr, daysBetween } from './util.js';

export const START = '2026-11-13';
export const GOAL_DATE = '2028-06-30';
export const RULE = 'Chỉ xét lại cách học ở ngày mốc. Chỉ đổi khi 2 lần thi thử liền không nhích.';

export const PHASES = [
  {
    id: 'p1', label: 'GĐ1', name: 'Nền tai và âm', from: '2026-11-13', to: '2027-02-28', hours: 150,
    months: 'Tháng 11/2026 → 2/2027',
    focus: 'Tai quen âm tiếng Anh, nói rõ âm cuối, bắt đầu kho cụm từ. Tài liệu chủ yếu là loại dễ (BBC 6 Minute English, VOA).',
    done: [
      { id: 'p1-endings', text: 'Nói rõ âm cuối (-s/-ed) trong các cặp từ luyện' },
      { id: 'p1-bbc', text: 'Nghe BBC 6 Minute English có phụ đề tiếng Anh, hiểu ý chính' },
      { id: 'p1-cards', text: '300 cụm trong thẻ', auto: () => db().phrases.length >= 300, autoNote: () => `${db().phrases.length} / 300` },
    ],
  },
  {
    id: 'p2', label: 'GĐ2', name: 'Lên B1', from: '2027-03-01', to: '2027-06-30', hours: 200,
    months: 'Tháng 3 → 6/2027',
    focus: 'Chuyển dần sang video hướng dẫn kỹ thuật thật (nói chậm, có phụ đề). Nói dài hơn, lỗi lặp lại ít dần.',
    done: [
      { id: 'p2-tech', text: 'Xem video hướng dẫn kỹ thuật nói chậm, có phụ đề tiếng Anh' },
      { id: 'p2-talk', text: 'Nói liền 2 phút về việc mình làm' },
      { id: 'p2-intern', text: 'Sẵn sàng phỏng vấn thực tập hè' },
    ],
  },
  {
    id: 'p3', label: 'GĐ3', name: 'Lên B2', from: '2027-07-01', to: '2028-03-31', hours: 250,
    months: 'Tháng 7/2027 → 3/2028',
    focus: 'Nội dung thật về AI/data không cần phụ đề tiếng Việt, luyện đề TOEIC đều đặn.',
    done: [
      {
        id: 'p3-toeic', text: 'TOEIC thi thử 750+ (mốc quy đổi B2 chỉ gần đúng)',
        auto: () => db().toeic.some((t) => t.score >= 750),
        autoNote: () => { const m = Math.max(0, ...db().toeic.map((t) => t.score)); return m ? `cao nhất ${m}` : 'chưa thi'; },
      },
    ],
  },
];

// Mốc giờ CEFR (ước tính giờ học có hướng dẫn của Cambridge, tính từ con số 0).
export const CEFR_MARKS = [
  { h: 200, label: 'A2' },
  { h: 400, label: 'B1' },
  { h: 600, label: 'B2' },
];

function addMonths(s, n) {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateStr(d);
}

export const CHECKPOINTS = [1, 2, 3, 4, 5, 6].map((i) => addMonths(START, 3 * i));

export function currentPhase(date = today()) {
  for (const p of PHASES) if (date <= p.to) return p;
  return PHASES[PHASES.length - 1];
}

export function minutesBetween(from, to) {
  return db().sessions.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + (Number(s.minutes) || 0), 0);
}
export function phaseHours(p) { return minutesBetween(p.from, p.to) / 60; }

export function nextCheckpoint(date = today()) {
  const d = CHECKPOINTS.find((c) => c >= date) || CHECKPOINTS[CHECKPOINTS.length - 1];
  return { date: d, days: Math.max(0, daysBetween(date, d)), index: CHECKPOINTS.indexOf(d) + 1 };
}

// giờ trung bình/tuần trong 4 tuần gần nhất so với 4 tuần trước đó
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

// phần trăm thời gian đã trôi qua của giai đoạn hiện tại (để so nhịp, nhẹ nhàng)
export function phaseElapsed(p, date = today()) {
  const total = daysBetween(p.from, p.to) + 1;
  const gone = Math.min(total, Math.max(0, daysBetween(p.from, date) + 1));
  return gone / total;
}
