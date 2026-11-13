// Sau mỗi lượt nghe/đọc: "Hiểu khoảng bao nhiêu?" → gợi ý chỉnh độ khó tài liệu.
import { db, save } from './store.js';
import { openModal, closeModal, toast } from './ui.js';

export const COMP_OPTIONS = [
  { v: 'lt70', label: 'Dưới 70%', sub: 'đoán là chính' },
  { v: '70-90', label: '70–90%', sub: 'hiểu ý, sót khá nhiều' },
  { v: '90-95', label: '90–95%', sub: 'hiểu gần hết' },
  { v: 'gt95', label: 'Trên 95%', sub: 'gần như hết' },
];

export function recentComps(n = 3) {
  return db().sessions
    .filter((s) => s.block === 'input' && s.comp)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, n)
    .map((s) => s.comp);
}

// null | {kind:'easier'|'harder', text}
export function materialAdvice() {
  const r = recentComps(3);
  if (r.length >= 2 && r[0] === 'lt70' && r[1] === 'lt70') {
    return { kind: 'easier', text: 'Hai lần gần nhất bạn hiểu dưới 70%. Thử tài liệu dễ hơn một bậc: BBC 6 Minute English hoặc VOA Learning English. Hiểu được nhiều mới học được nhiều.' };
  }
  if (r.length >= 3 && r.every((x) => x === 'gt95')) {
    return { kind: 'harder', text: 'Ba lần liền bạn hiểu trên 95%. Có thể tăng độ khó một chút: TED-Ed, hoặc video hướng dẫn AI/data nói chậm có phụ đề tiếng Anh.' };
  }
  return null;
}

export function askComprehension(sessionId) {
  const rec = db().sessions.find((s) => s.id === sessionId);
  if (!rec) return;
  openModal({
    title: 'Hiểu khoảng bao nhiêu?',
    html: `<p class="muted small">Ước lượng nhanh, không cần chính xác. Mức tốt để tiến bộ là hiểu khoảng 90–98%.</p>
      <div class="comp-grid">${COMP_OPTIONS.map((o) => `<button type="button" class="btn comp-btn" data-comp="${o.v}">${o.label}<small>${o.sub}</small></button>`).join('')}</div>`,
    actions: [{ label: 'Bỏ qua' }],
    onOpen: (box) => box.querySelectorAll('[data-comp]').forEach((b) => b.addEventListener('click', () => {
      const r = db().sessions.find((s) => s.id === sessionId);
      if (r) { r.comp = b.dataset.comp; save(); }
      closeModal();
      const adv = materialAdvice();
      if (adv) setTimeout(() => toast(adv.kind === 'easier' ? 'Gợi ý: thử tài liệu dễ hơn (xem Hôm nay).' : 'Gợi ý: có thể tăng độ khó (xem Hôm nay).', 3500), 200);
    })),
  });
}
