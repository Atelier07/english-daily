// Modal trong trang (không dùng window.confirm/alert), toast, copy.
import { esc } from './util.js';

const root = () => document.getElementById('modalRoot');
let lastFocus = null;
let currentOnClose = null;
let gen = 0;

export function closeModal() {
  const r = root();
  r.hidden = true;
  r.innerHTML = '';
  document.removeEventListener('keydown', onKey);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  const f = currentOnClose;
  currentOnClose = null;
  if (f) f();
}
function onKey(e) { if (e.key === 'Escape') closeModal(); }

// openModal({title, html, actions:[{label, kind, onClick(modalEl) -> false để giữ modal}]})
export function openModal({ title, html = '', actions = [], onOpen, onClose } = {}) {
  if (!root().hidden) closeModal();
  lastFocus = document.activeElement;
  currentOnClose = onClose || null;
  const myGen = ++gen;
  const r = root();
  r.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h2 id="modalTitle">${esc(title)}</h2>
      <div class="modal-body">${html}</div>
      <div class="modal-actions"></div>
    </div>`;
  const box = r.querySelector('.modal');
  const act = r.querySelector('.modal-actions');
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-primary' : 'btn-quiet'}`;
    b.textContent = a.label;
    b.addEventListener('click', () => {
      const keep = a.onClick ? a.onClick(box) : undefined;
      if (keep !== false && gen === myGen) closeModal();
    });
    act.appendChild(b);
  });
  r.querySelector('[data-close]').addEventListener('click', closeModal);
  r.hidden = false;
  document.addEventListener('keydown', onKey);
  if (onOpen) onOpen(box);
  const first = box.querySelector('input, textarea, select') || act.querySelector('.btn-primary') || act.querySelector('button');
  if (first) setTimeout(() => first.focus(), 30);
  return box;
}

export function confirmModal({ title, message, confirmLabel = 'Đồng ý', danger = false }) {
  return new Promise((resolve) => {
    openModal({
      title,
      html: `<p>${message}</p>`,
      actions: [
        { label: 'Huỷ', onClick: () => resolve(false) },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
      ],
      onClose: () => resolve(false),
    });
  });
}

let toastT = null;
export function toast(msg, ms = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallback below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
}
