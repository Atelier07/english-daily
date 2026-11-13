import { LIBRARY } from '../library.js';
import { esc } from '../util.js';

export function mount(el) {
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Thư viện</div>
      <h1>Nghe gì, theo cấp độ</h1>
      <p class="lede">Link kênh và link tìm kiếm, không phải video cố định. Chọn video bạn thích, dán link vào Shadowing hoặc chỉ xem rồi bấm giờ “Nghe/đọc”. Hiểu dưới 70% thì lùi một bậc.</p>
    </div>
    ${LIBRARY.map((g) => `
      <section class="section">
        <h2>${esc(g.level)}</h2>
        <p class="muted small">${esc(g.note)}</p>
        <div class="card"><ul class="link-list">
          ${g.items.map((i) => `<li><div class="grow"><a class="t" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.label)}</a><span class="s">${esc(i.hint)}</span></div><span class="muted small" aria-hidden="true">↗</span></li>`).join('')}
        </ul></div>
      </section>`).join('')}`;
}
