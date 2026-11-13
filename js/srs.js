// Lặp lại ngắt quãng: SM-2 rút gọn với 3 mức (Quên / Khó / Nhớ).
//
// Mỗi thẻ có: ef (hệ số dễ, bắt đầu 2.5, thấp nhất 1.3), reps (số lần nhớ liên tiếp),
// interval (số ngày đến lần ôn sau), due (ngày đến hạn).
//  - Quên: reps = 0, interval = 1 ngày, ef -= 0.2. Thẻ quay lại cuối buổi ôn hôm nay một lần nữa.
//  - Khó:  lần 1 → 1 ngày, lần 2 → 3 ngày, sau đó interval × 1.2; ef -= 0.15.
//  - Nhớ:  lần 1 → 1 ngày, lần 2 → 4 ngày, sau đó interval × ef; ef += 0.1 (tối đa 3.0).
// Khoảng cách tối đa 180 ngày.
import { today, addDays } from './util.js';

export const GRADES = { forgot: 'forgot', hard: 'hard', good: 'good' };

export function newCard() {
  return { ef: 2.5, reps: 0, interval: 0, due: today(), lapses: 0, lastReview: null };
}

export function preview(card, grade) {
  const ef = card.ef ?? 2.5;
  const reps = card.reps ?? 0;
  const iv = card.interval ?? 0;
  let nEf = ef, nReps = reps, nIv;
  if (grade === 'forgot') {
    nReps = 0; nIv = 1; nEf = Math.max(1.3, ef - 0.2);
  } else if (grade === 'hard') {
    nIv = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(iv + 1, Math.round(iv * 1.2));
    nReps = reps + 1; nEf = Math.max(1.3, ef - 0.15);
  } else {
    nIv = reps === 0 ? 1 : reps === 1 ? 4 : Math.max(iv + 1, Math.round(iv * ef));
    nReps = reps + 1; nEf = Math.min(3.0, ef + 0.1);
  }
  nIv = Math.min(180, nIv);
  return { ef: Math.round(nEf * 100) / 100, reps: nReps, interval: nIv };
}

export function apply(card, grade) {
  const p = preview(card, grade);
  card.ef = p.ef;
  card.reps = p.reps;
  card.interval = p.interval;
  card.due = addDays(today(), p.interval);
  card.lastReview = today();
  if (grade === 'forgot') card.lapses = (card.lapses || 0) + 1;
  return card;
}

export function intervalLabel(days) {
  if (days <= 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  const m = Math.round(days / 30);
  return `${m} tháng`;
}
