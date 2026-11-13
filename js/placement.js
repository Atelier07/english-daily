// Bài xếp lớp: (a) Yes/No từ vựng kiểu Meara (chỉ để ước lượng trình độ, không phải bài học từ),
// (b) nghe hiểu, (c) tự đánh giá, (d) thời gian mỗi ngày.
// Phần chấm điểm là hàm thuần để kiểm thử được.
import { FREQ } from './data/ngsl.js';
import { FUNCTION_WORDS } from './dictation.js';

// Từ giả: trông giống tiếng Anh nhưng không có thật (đã kiểm tra không nằm trong danh sách 31K từ).
export const PSEUDO = ['mertion', 'barbent', 'dringle', 'lapice', 'cantile', 'fendle', 'hoxen', 'glimber', 'pranage', 'slorth',
  'crandle', 'ombrace', 'surplate', 'clinter', 'dranish', 'morplex', 'galpine', 'tremmel', 'sporrow', 'kalmet',
  'vintrid', 'besalt', 'flonder', 'brugment', 'porlish', 'quenter', 'smorge', 'rantle', 'nobbin', 'treaver'];

export const BANDS = 5;          // 1k … 5k
export const PER_BAND = 12;      // 60 từ thật
export const N_PSEUDO = 20;      // 25% từ giả

function shuffle(a, rnd = Math.random) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// Danh sách câu hỏi Yes/No: [{word, band (1..5) | 0 nếu là từ giả}]
export function vocabItems(rnd = Math.random) {
  const items = [];
  for (let b = 1; b <= BANDS; b++) {
    const pool = FREQ.slice((b - 1) * 1000, b * 1000).filter((w) => w.length >= 3 && !FUNCTION_WORDS.has(w));
    shuffle(pool, rnd).slice(0, PER_BAND).forEach((w) => items.push({ word: w, band: b }));
  }
  shuffle(PSEUDO, rnd).slice(0, N_PSEUDO).forEach((w) => items.push({ word: w, band: 0 }));
  return shuffle(items, rnd);
}

// answers: [{band, yes:boolean}]
// Tỉ lệ đúng từng dải trừ tỉ lệ báo nhầm từ giả (hits − false alarms), kẹp trong [0,1], × 1000 mỗi dải.
export function scoreVocab(answers) {
  const pseudo = answers.filter((a) => a.band === 0);
  const fa = pseudo.length ? pseudo.filter((a) => a.yes).length / pseudo.length : 0;
  const bands = [];
  let estimate = 0;
  for (let b = 1; b <= BANDS; b++) {
    const real = answers.filter((a) => a.band === b);
    const hit = real.length ? real.filter((a) => a.yes).length / real.length : 0;
    const adj = Math.max(0, Math.min(1, hit - fa));
    bands.push({ band: b, hit, adj });
    estimate += adj * 1000;
  }
  return { estimate: Math.round(estimate / 50) * 50, falseAlarm: fa, bands, reliable: fa <= 0.3 };
}

export const LISTEN = [
  { en: 'I have two cats.', options: ['Tôi có hai con mèo.', 'Tôi thích hai con chó.', 'Tôi có hai chiếc xe.'], answer: 0 },
  { en: 'Can you open the window, please?', options: ['Bạn đóng cửa ra vào được không?', 'Bạn mở cửa sổ giúp mình nhé?', 'Cửa sổ này đang mở à?'], answer: 1 },
  { en: 'She usually takes the bus to work.', options: ['Cô ấy thường đi bộ đi làm.', 'Cô ấy làm việc trên xe buýt.', 'Cô ấy thường đi xe buýt đi làm.'], answer: 2 },
  { en: 'We had to cancel the meeting because the manager was sick.', options: ['Phải huỷ cuộc họp vì quản lý bị ốm.', 'Cuộc họp bị dời vì quản lý bận.', 'Quản lý huỷ họp vì mọi người bị ốm.'], answer: 0 },
  { en: 'The new update makes it much easier to keep track of your tasks.', options: ['Bạn cần cập nhật để giữ lại công việc.', 'Bản cập nhật giúp theo dõi công việc dễ hơn nhiều.', 'Bản cập nhật làm công việc khó theo dõi hơn.'], answer: 1 },
  { en: "If I'd known about the traffic, I would have left earlier.", options: ['Vì kẹt xe nên hôm qua tôi đến muộn.', 'Mai tôi sẽ đi sớm để tránh kẹt xe.', 'Nếu biết kẹt xe thì tôi đã đi sớm hơn.'], answer: 2 },
  { en: 'Despite the setback, the team still managed to ship the product on time.', options: ['Dù gặp trở ngại, nhóm vẫn ra mắt sản phẩm đúng hạn.', 'Vì gặp trở ngại, nhóm phải hoãn ra mắt sản phẩm.', 'Nhóm ra mắt sản phẩm sớm nên gặp trở ngại.'], answer: 0 },
];

export const SELF = [
  {
    id: 'read', q: 'Đọc đoạn này. Bạn hiểu đến đâu?',
    text: 'Last weekend I visited my grandmother. She lives in a small town near the sea. We cooked lunch together and talked for hours about her life.',
    options: ['Không hiểu mấy', 'Hiểu ý chính', 'Hiểu gần hết'],
  },
  { id: 'video', q: 'Xem video nói chậm có phụ đề tiếng Anh (ví dụ BBC 6 Minute English), bạn theo được đến đâu?', options: ['Không theo kịp', 'Theo được ý chính', 'Hiểu gần hết'] },
  { id: 'speak', q: 'Nói 3 câu tiếng Anh về bản thân (tên, việc đang làm, sở thích)?', options: ['Chưa nói được', 'Nói được nhưng ngập ngừng', 'Nói được thoải mái'] },
];

export const BUDGETS = [15, 20, 30, 45, 60];
export const LEVELS = [
  { id: 'A0', label: 'A0 · mất gốc', short: 'A0' },
  { id: 'A1', label: 'A1 · mới bắt đầu', short: 'A1' },
  { id: 'A2', label: 'A2 · sơ cấp', short: 'A2' },
  { id: 'B1', label: 'B1 · trung cấp', short: 'B1' },
];

const vocabIdx = (v) => (v < 500 ? 0 : v < 1200 ? 1 : v < 2500 ? 2 : 3);
const listenIdx = (c) => (c <= 1 ? 0 : c <= 3 ? 1 : c <= 5 ? 2 : 3);
const selfIdx = (s) => (s <= 1 ? 0 : s <= 3 ? 1 : s <= 5 ? 2 : 3);

// vocab: số từ ước tính; listenCorrect: 0..7; selfSum: 0..6
export function computeLevel(vocab, listenCorrect, selfSum) {
  const v = vocabIdx(vocab), l = listenIdx(listenCorrect), s = selfIdx(selfSum);
  const idx = Math.max(0, Math.min(3, Math.round(0.5 * v + 0.3 * l + 0.2 * s)));
  return { level: LEVELS[idx].id, idx, parts: { vocab: v, listen: l, self: s } };
}

export function explainLevel(r) {
  const name = (i) => LEVELS[i].short;
  const lines = [
    `Từ vựng: ước tính khoảng ${r.vocab.toLocaleString('vi-VN')} từ trong 5.000 từ thông dụng nhất (mức ${name(r.parts.vocab)}).`,
    `Nghe: đúng ${r.listen}/${LISTEN.length} câu (mức ${name(r.parts.listen)}).`,
    `Tự đánh giá: mức ${name(r.parts.self)}.`,
  ];
  if (!r.reliable) lines.push('Bạn chọn “Biết” với khá nhiều từ giả, nên ước tính từ vựng có thể cao hơn thật. Lần sau chỉ chọn “Biết” khi chắc chắn.');
  lines.push('Đây là ước lượng nhanh trong vài phút, không phải chứng chỉ. Thi thử TOEIC ở các mốc mới là thước đo thật; bạn có thể làm lại bài này bất cứ lúc nào.');
  return lines;
}

// Chọn ngày bắt đầu trong khoá theo trình độ. index: [{day, level}]
// A0 → ngày 1; A1 → ngày A1 đầu tiên; A2/B1 → ngày A2 đầu tiên (nếu khoá chưa có thì ngày cuối cùng có sẵn).
export function startDayFor(levelId, index) {
  const days = (index || []).slice().sort((a, b) => a.day - b.day);
  if (!days.length) return 1;
  const order = ['A0', 'A1', 'A2', 'B1', 'B2'];
  if (levelId === 'A0') return days[0].day;
  const want = levelId === 'A1' ? 'A1' : 'A2';
  const hit = days.find((d) => order.indexOf(d.level) >= order.indexOf(want));
  if (hit) return hit.day;
  return levelId === 'A1' ? days[0].day : days[days.length - 1].day;
}
