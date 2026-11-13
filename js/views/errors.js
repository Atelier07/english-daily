import { db, save, uid } from '../store.js';
import { esc, viShortDate, dateStr } from '../util.js';
import { toast, confirmModal } from '../ui.js';

let root;
let filter = 'open';

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

// Thêm lỗi; nếu câu sai đã có thì tăng số lần gặp. Trả về 'new' | 'again'.
export function addError({ wrong, right, note = '' }) {
  const hit = db().errors.find((e) => norm(e.wrong) === norm(wrong));
  if (hit) {
    hit.seen = (hit.seen || 1) + 1;
    hit.fixed = false;
    hit.updated = Date.now();
    if (right) hit.right = right;
    if (note) hit.note = note;
    save();
    return 'again';
  }
  db().errors.push({ id: uid(), wrong, right, note, seen: 1, fixed: false, created: Date.now(), updated: Date.now() });
  save();
  return 'new';
}

function render() {
  const all = db().errors;
  const open = all.filter((e) => !e.fixed);
  const fixed = all.filter((e) => e.fixed);
  const list = (filter === 'open' ? open : fixed).slice().sort((a, b) => (b.seen || 1) - (a.seen || 1) || b.updated - a.updated);

  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Lỗi của tôi</div>
      <h1>Chỉ học ngữ pháp từ lỗi của chính mình</h1>
      <p class="lede">Mỗi lỗi ở đây là thứ bạn đã thật sự nói sai. Đọc to câu đúng vài lần trước khi nói. Khi thấy mình nói đúng tự nhiên trong vài buổi liền, đánh dấu “đã sửa được”.</p>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" data-f="open" class="${filter === 'open' ? 'on' : ''}">Đang sửa · ${open.length}</button>
      <button type="button" data-f="fixed" class="${filter === 'fixed' ? 'on' : ''}">Đã sửa được · ${fixed.length}</button>
    </div>

    <div class="card">${list.length ? list.map((e) => `
      <div class="err-item ${e.fixed ? 'fixed' : ''}">
        <div class="err-wrong" lang="en">${esc(e.wrong)}</div>
        <div class="err-right" lang="en">${esc(e.right)}</div>
        ${e.note ? `<div class="err-note">${esc(e.note)}</div>` : ''}
        <div class="err-actions">
          <span class="tag ${e.seen > 2 ? 'tag-accent' : ''}">gặp ${e.seen || 1} lần</span>
          <span class="muted small">từ ${viShortDate(dateStr(new Date(e.created)))}</span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-quiet btn-sm" data-seen="${e.id}">+1 lần gặp</button>
          <label class="toggle"><input type="checkbox" data-fix="${e.id}" ${e.fixed ? 'checked' : ''}> đã sửa được</label>
          <button type="button" class="btn btn-quiet btn-sm btn-danger" data-del="${e.id}">Xoá</button>
        </div>
      </div>`).join('') : `<p class="muted" style="margin:0">${filter === 'open' ? 'Chưa có lỗi nào. Sau mỗi buổi Nói, lưu 1–2 lỗi AI chỉ ra.' : 'Chưa có lỗi nào được đánh dấu đã sửa.'}</p>`}
    </div>

    <section class="section card">
      <h3 style="margin-bottom:10px">Thêm lỗi</h3>
      <div class="field"><label for="nWrong">Câu sai</label><input id="nWrong" class="input" lang="en"></div>
      <div class="field"><label for="nRight">Câu đúng</label><input id="nRight" class="input" lang="en"></div>
      <div class="field"><label for="nNote">Ghi chú</label><input id="nNote" class="input"></div>
      <div class="row" style="margin-top:12px"><button type="button" class="btn btn-primary" id="addErr">Lưu lỗi</button></div>
    </section>`;

  root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
  root.querySelectorAll('[data-seen]').forEach((b) => b.addEventListener('click', () => {
    const e = db().errors.find((x) => x.id === b.dataset.seen);
    e.seen = (e.seen || 1) + 1; e.updated = Date.now(); save();
  }));
  root.querySelectorAll('[data-fix]').forEach((c) => c.addEventListener('change', () => {
    const e = db().errors.find((x) => x.id === c.dataset.fix);
    e.fixed = c.checked; e.updated = Date.now(); save();
    if (c.checked) toast('Tốt lắm. Lỗi chuyển sang “Đã sửa được”.');
  }));
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Xoá lỗi này?', message: 'Không hoàn tác được.', confirmLabel: 'Xoá', danger: true });
    if (!ok) return;
    db().errors = db().errors.filter((x) => x.id !== b.dataset.del);
    save();
  }));
  root.querySelector('#addErr').addEventListener('click', () => {
    const wrong = root.querySelector('#nWrong').value.trim();
    const right = root.querySelector('#nRight').value.trim();
    if (!wrong || !right) { toast('Cần cả câu sai và câu đúng.'); return; }
    const r = addError({ wrong, right, note: root.querySelector('#nNote').value.trim() });
    toast(r === 'again' ? 'Lỗi này đã có, đã tăng số lần gặp.' : 'Đã lưu.');
  });
}

export function mount(el) { root = el; }
export function show() { render(); }
export function onData() { render(); }
