// Điều hướng bằng hash (#/today ...) — chạy được trên GitHub Pages, không cần server.
import { load, onChange } from './store.js';
import { tick, stop } from './timer.js';
import { openModal, closeModal } from './ui.js';
import * as today from './views/today.js';
import * as shadow from './views/shadow.js';
import * as phrases from './views/phrases.js';
import * as speak from './views/speak.js';
import * as errors from './views/errors.js';
import * as progress from './views/progress.js';
import * as why from './views/why.js';
import * as data from './views/data.js';

const VIEWS = { today, shadow, phrases, speak, errors, progress, why, data };
const TITLES = {
  today: 'Hôm nay', shadow: 'Shadowing', phrases: 'Cụm từ', speak: 'Nói', errors: 'Lỗi của tôi',
  progress: 'Mốc', why: 'Vì sao cách này hiệu quả', data: 'Dữ liệu',
};
const mounted = new Set();
let current = null;

function route() {
  const name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'today';
  const key = VIEWS[name] ? name : 'today';
  if (current && current !== key && VIEWS[current].hide) VIEWS[current].hide();
  document.querySelectorAll('[data-view]').forEach((s) => { s.hidden = s.dataset.view !== key; });
  const el = document.querySelector(`[data-view="${key}"]`);
  if (!mounted.has(key)) { VIEWS[key].mount(el); mounted.add(key); }
  if (VIEWS[key].show) VIEWS[key].show(el);
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
  document.title = `${TITLES[key]} · English Daily`;
  if (current !== key) window.scrollTo(0, 0);
  current = key;
  tick();
}

function openMore() {
  openModal({
    title: 'Mục khác',
    html: `<ul class="menu-list">
      <li><a href="#/errors">Lỗi của tôi</a></li>
      <li><a href="#/why">Vì sao cách này hiệu quả</a></li>
      <li><a href="#/data">Dữ liệu · xuất / nhập / xoá</a></li>
    </ul>`,
    actions: [{ label: 'Đóng' }],
    onOpen: (box) => box.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeModal())),
  });
}

load();
document.getElementById('moreBtn').addEventListener('click', openMore);
document.getElementById('timerPillStop').addEventListener('click', () => stop());
window.addEventListener('hashchange', route);
// khi dữ liệu đổi, làm mới view đang mở (nhẹ, vì các view nhỏ)
onChange(() => { if (current && VIEWS[current].onData) VIEWS[current].onData(); });
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* bỏ qua */ });
  });
}
