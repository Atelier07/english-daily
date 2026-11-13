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
import * as roadmap from './views/roadmap.js';
import * as pron from './views/pron.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';
import { initSync, onStatus, getStatus } from './sync.js';
import { askComprehension } from './comprehension.js';

const VIEWS = { today, shadow, phrases, speak, errors, progress, why, data, roadmap, pron, library, settings };
const TITLES = {
  today: 'Hôm nay', shadow: 'Shadowing', phrases: 'Cụm từ', speak: 'Nói', errors: 'Lỗi của tôi',
  progress: 'Mốc', why: 'Vì sao cách này hiệu quả', data: 'Dữ liệu',
  roadmap: 'Lộ trình', pron: 'Âm cuối', library: 'Thư viện', settings: 'Cài đặt',
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
      <li><a href="#/roadmap">Lộ trình</a></li>
      <li><a href="#/pron">Âm cuối · phát âm</a></li>
      <li><a href="#/errors">Lỗi của tôi</a></li>
      <li><a href="#/library">Thư viện</a></li>
      <li><a href="#/why">Vì sao cách này hiệu quả</a></li>
      <li><a href="#/data">Dữ liệu · xuất / nhập / xoá</a></li>
      <li><a href="#/settings">Cài đặt · đồng bộ, AI</a></li>
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

// chỉ báo đồng bộ
const SYNC_LABEL = { syncing: 'Đang đồng bộ', ok: 'Đã đồng bộ', error: 'Lỗi đồng bộ', offline: 'Ngoại tuyến' };
function renderSync(st) {
  document.querySelectorAll('[data-sync-ind]').forEach((el) => {
    el.hidden = st.status === 'off';
    el.dataset.state = st.status;
    el.querySelector('.sync-label').textContent = SYNC_LABEL[st.status] || '';
    el.title = st.message || SYNC_LABEL[st.status] || '';
  });
}
onStatus(renderSync);
renderSync(getStatus());
initSync();

// hỏi mức hiểu sau mỗi lượt nghe/đọc
window.addEventListener('ed:input-logged', (e) => askComprehension(e.detail.id));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* bỏ qua */ });
  });
}
