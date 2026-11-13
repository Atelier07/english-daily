import { EVIDENCE, HABIT, HOURS_NOTE, STRENGTH } from '../evidence.js';
import { esc } from '../util.js';

const tag = (s) => `<span class="tag strength-${s}">bằng chứng ${STRENGTH[s]}</span>`;

export function mount(el) {
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Phương pháp</div>
      <h1>Vì sao cách này hiệu quả</h1>
      <p class="lede">Không có phương pháp thần kỳ. Dưới đây là những gì nghiên cứu nói, kèm mức độ chắc chắn: <b>mạnh</b> (phân tích tổng hợp, lặp lại nhiều), <b>vừa</b> (vài nghiên cứu tốt), <b>yếu</b> (nghiên cứu nhỏ hoặc ngắn). Con số d/g là cỡ hiệu ứng: khoảng 0,2 là nhỏ, 0,5 vừa, 0,8 lớn.</p>
    </div>
    ${EVIDENCE.map((it) => `
      <article class="why-item">
        <span class="who">${esc(it.concept)}</span>
        <div class="row" style="gap:10px;margin-bottom:4px"><h2>${esc(it.title)}</h2>${tag(it.strength)}</div>
        ${it.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        <p class="src">Nguồn: ${esc(it.sources)}</p>
      </article>`).join('')}
    ${[HABIT, HOURS_NOTE].map((it) => `
      <article class="why-item">
        <div class="row" style="gap:10px;margin-bottom:4px"><h2>${esc(it.title)}</h2>${tag(it.strength)}</div>
        <p>${esc(it.body)}</p>
        <p class="src">Nguồn: ${esc(it.sources)}</p>
      </article>`).join('')}
    <article class="why-item">
      <span class="who">Ngày nghỉ có phép</span>
      <h2>Vì sao chuỗi ngày có “ngày nghỉ”</h2>
      <p>Silverman & Barasch 2023: khi chuỗi bị đứt, người ta làm tiếp ít hơn hẳn, nhất là khi tự trách mình; chuỗi “sửa được” thì đỡ hơn. Vì vậy mỗi tuần có một ngày lỡ được bỏ qua mà chuỗi vẫn giữ. Chưa có nghiên cứu nào cho thấy chuỗi ngày làm bạn giỏi tiếng Anh hơn: nó chỉ giúp giữ thói quen.</p>
      <p class="src">Nguồn: Silverman & Barasch 2023 (Journal of Consumer Research)</p>
    </article>
    <article class="why-item">
      <span class="who">Cách thẻ cụm từ được xếp lịch</span>
      <h2>SM-2 rút gọn, ba mức</h2>
      <p><b>Quên</b>: thẻ quay lại cuối buổi ôn hôm nay và lần sau sau 1 ngày. <b>Khó</b>: 1 ngày → 3 ngày → khoảng cách cũ × 1,2. <b>Nhớ</b>: 1 ngày → 4 ngày → khoảng cách cũ × hệ số dễ (bắt đầu 2,5; tăng khi bạn nhớ, giảm khi bạn quên; thấp nhất 1,3). Tối đa 180 ngày. Mặt trước là nghĩa tiếng Việt vì mục tiêu là tự nói ra được (nhớ chủ động), không chỉ nhận ra khi gặp.</p>
    </article>`;
}
