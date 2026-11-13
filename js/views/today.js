import { db, save, BLOCKS } from '../store.js';
import {
  today, viLongDate, fmtMinutes, fmtHours, totalMinutes, weekMinutes, dayMinutes, streakInfo,
  dueCount, esc, GOAL_HOURS, MIN_DAY,
} from '../util.js';
import { toggle, running, tick, logMinutes } from '../timer.js';
import { openModal, toast, confirmModal } from '../ui.js';
import { materialAdvice } from '../comprehension.js';
import { openDoubt } from '../doubt.js';
import { currentPhase, phaseHours, nextCheckpoint, CEFR_MARKS } from '../roadmap.js';

let root;

const BLOCK_COPY = {
  input: {
    desc: 'Thứ bạn thật sự muốn xem: AI, công nghệ, piano… Mức tốt là hiểu khoảng 90–98%. Ở trình độ hiện tại, ưu tiên tài liệu cho người học (BBC 6 Minute English, VOA) rồi mới sang video thật; bật phụ đề tiếng Anh.',
    link: { href: '#/library', label: 'Thư viện' },
  },
  shadow: {
    desc: 'Một đoạn 30–90 giây, dễ hơn hoặc bằng trình độ. Nghe lấy ý trước, rồi lẩm bẩm theo, rồi mới nói đè. Ghi âm và so sánh.',
    link: { href: '#/shadow', label: 'Mở Shadowing' },
  },
  speak: {
    desc: 'Nói về đề hôm nay, không cần đúng hết. Sau đó nhờ AI chỉ ra 1–2 lỗi lặp lại.',
    link: { href: '#/speak', label: 'Mở đề nói' },
  },
  review: {
    desc: 'Nhìn nghĩa tiếng Việt, nói to cụm tiếng Anh, rồi lật thẻ kiểm tra.',
    link: { href: '#/phrases?review', label: 'Ôn ngay' },
  },
};

function ring(pct) {
  const r = 12, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<svg class="ring" viewBox="0 0 30 30" aria-hidden="true">
    <circle cx="15" cy="15" r="${r}" fill="none" stroke="var(--line)" stroke-width="3"/>
    <circle cx="15" cy="15" r="${r}" fill="none" stroke="${p >= 1 ? 'var(--moss)' : 'var(--accent)'}" stroke-width="3"
      stroke-dasharray="${c * p} ${c}" stroke-linecap="round" transform="rotate(-90 15 15)"/>
  </svg>`;
}

function render() {
  const t = today();
  const total = totalMinutes();
  const week = weekMinutes();
  const dayMin = dayMinutes(t);
  const st = streakInfo();
  const due = dueCount();
  const run = running();
  const pct = Math.min(100, (total / 60 / GOAL_HOURS) * 100);

  const lede = st.todayDone
    ? 'Hôm nay đã đủ ngày tối thiểu. Làm thêm được bao nhiêu là lãi bấy nhiêu.'
    : `Chỉ cần ${MIN_DAY} phút là hôm nay được tính vào chuỗi. Bắt đầu bằng thứ dễ nhất.`;

  const blocks = Object.entries(BLOCKS).map(([key, b], i) => {
    const done = dayMinutes(t, key);
    const isRun = run && run.block === key;
    const copy = BLOCK_COPY[key];
    const range = b.min === b.max ? `${b.min}′` : `${b.min}–${b.max}′`;
    const adv = key === 'input' ? materialAdvice() : null;
    const extra = key === 'review' ? `<span class="tag ${due ? 'tag-accent' : ''}">${due} thẻ đến hạn</span>` : '';
    return `
      <article class="card block ${isRun ? 'running' : ''}">
        <div class="block-title">
          <span class="block-num">${i + 1}</span>
          <h3>${esc(b.name)}</h3>
          <span class="tag">${range}</span>
          ${extra}
        </div>
        <span class="timer-time" data-timer-display="${key}" aria-live="off">00:00</span>
        <p class="block-desc">${copy.desc}</p>
        ${adv ? `<p class="block-desc notice notice-quiet">${esc(adv.text)}</p>` : ''}
        <div class="block-foot">
          <button type="button" class="btn ${isRun ? 'btn-primary' : ''}" data-toggle="${key}">${isRun ? 'Dừng & ghi' : 'Bắt đầu'}</button>
          ${copy.link ? `<a class="btn btn-quiet" href="${copy.link.href}">${copy.link.label}${key === 'review' && due ? ` (${due})` : ''} →</a>` : ''}
          <span class="spacer"></span>
          <span class="block-done">${done ? `Hôm nay: ${fmtMinutes(done)}` : 'Chưa làm'}</span>
        </div>
      </article>`;
  }).join('');

  const sessions = db().sessions.filter((s) => s.date === t).sort((a, b) => b.ts - a.ts);
  const sessionList = sessions.length
    ? `<ul class="session-list">${sessions.map((s) => `
        <li>
          <span>${esc(BLOCKS[s.block]?.short || s.block)}</span>
          <span class="when">${s.manual ? 'nhập tay' : 'bấm giờ'}${s.note ? ' · ' + esc(s.note) : ''}</span>
          <span class="spacer"></span>
          <span class="num">${fmtMinutes(s.minutes)}</span>
          <button type="button" class="btn btn-quiet btn-sm" data-del="${s.id}" aria-label="Xoá lượt này">Xoá</button>
        </li>`).join('')}</ul>`
    : `<p class="muted small">Chưa có lượt nào hôm nay.</p>`;

  root.innerHTML = `
    <div class="page-head today-hero">
      <div class="eyebrow">Hôm nay</div>
      <h1>${esc(viLongDate())}</h1>
      <p class="lede">${lede}</p>
    </div>

    <div class="stats-strip">
      <div class="stat"><span class="num">${st.current}</span><span class="k">ngày liên tiếp</span></div>
      <div class="stat"><span class="num">${fmtHours(week)}</span><span class="k">giờ tuần này</span></div>
      <div class="stat"><span class="num">${Math.round(dayMin)}</span><span class="k">phút hôm nay</span></div>
    </div>

    <div class="progress">
      <div class="progress-meta"><span><span class="num">${fmtHours(total)}</span> / ${GOAL_HOURS} giờ</span><span>${pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span></div>
      <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${GOAL_HOURS}" aria-valuenow="${(total / 60).toFixed(1)}"><i style="width:${pct}%"></i>
        ${CEFR_MARKS.filter((m) => m.h < GOAL_HOURS).map((m) => `<b class="cefr-tick" style="left:${(m.h / GOAL_HOURS) * 100}%"></b>`).join('')}</div>
      <div class="cefr-labels">${CEFR_MARKS.map((m) => `<span style="left:${(m.h / GOAL_HOURS) * 100}%">${m.label} ~${m.h}h</span>`).join('')}</div>
      <p class="muted tiny">Mốc CEFR: ước tính giờ học có hướng dẫn của Cambridge (tính từ 0), chỉ để tham khảo.</p>
    </div>

    <div class="minday">${ring(dayMin / MIN_DAY)}
      <span>${st.todayDone ? 'Ngày tối thiểu: xong.' : `Ngày tối thiểu: ${Math.round(dayMin)} / ${MIN_DAY} phút.`}${st.restUsedThisWeek ? ' <span class="muted">Tuần này đã dùng ngày nghỉ có phép, chuỗi vẫn giữ.</span>' : ''}</span>
    </div>

    ${roadmapCard()}

    <section class="section">
      <div class="row" style="margin-bottom:12px"><h2>Bốn việc hôm nay</h2></div>
      <div class="blocks">${blocks}</div>
      <div class="row" style="margin-top:14px">
        <button type="button" class="btn" id="manualBtn">+ Nhập giờ thủ công</button>
        <span class="muted small">Ví dụ: vừa xem video tiếng Anh ở chỗ khác.</span>
      </div>
    </section>

    <section class="section">
      <h2>Đã ghi hôm nay</h2>
      <div class="card">${sessionList}</div>
    </section>
  `;

  root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.toggle)));
  root.querySelector('#manualBtn').addEventListener('click', manualEntry);
  root.querySelector('#doubtBtn').addEventListener('click', openDoubt);
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Xoá lượt này?', message: 'Thời gian của lượt này sẽ bị trừ khỏi tổng.', confirmLabel: 'Xoá', danger: true });
    if (!ok) return;
    db().sessions = db().sessions.filter((s) => s.id !== b.dataset.del);
    save();
  }));
  tick();
}

function roadmapCard() {
  const p = currentPhase();
  const h = phaseHours(p);
  const cp = nextCheckpoint();
  const pct = Math.min(100, (h / p.hours) * 100);
  return `
    <a class="card phase-card" href="#/roadmap">
      <div class="row" style="gap:8px"><span class="eyebrow" style="margin:0">${p.label} · ${esc(p.months)}</span><span class="spacer"></span><span class="muted small">Lộ trình →</span></div>
      <h3>${esc(p.name)}</h3>
      <div class="progress-bar thin"><i style="width:${pct}%"></i></div>
      <div class="progress-meta" style="margin:6px 0 0"><span>${h.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / ${p.hours} giờ trong giai đoạn</span><span>mốc thi thử sau ${cp.days} ngày</span></div>
    </a>
    <div class="row" style="margin-top:10px"><button type="button" class="btn btn-quiet btn-sm" id="doubtBtn">Mình đang nghi ngờ</button></div>`;
}

function manualEntry() {
  const opts = Object.entries(BLOCKS).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join('');
  openModal({
    title: 'Nhập giờ thủ công',
    html: `
      <div class="field"><label for="mBlock">Phần</label><select id="mBlock" class="select">${opts}</select></div>
      <div class="field-grid" style="margin-top:12px">
        <div class="field"><label for="mMin">Số phút</label><input id="mMin" class="input" type="number" inputmode="numeric" min="1" max="600" value="20"></div>
        <div class="field"><label for="mDate">Ngày</label><input id="mDate" class="input" type="date" value="${today()}" max="${today()}"></div>
      </div>
      <div class="field"><label for="mNote">Ghi chú (không bắt buộc)</label><input id="mNote" class="input" placeholder="vd: xem Fireship trên YouTube"></div>`,
    actions: [
      { label: 'Huỷ' },
      {
        label: 'Ghi lại', kind: 'primary', onClick: (box) => {
          const min = Number(box.querySelector('#mMin').value);
          const date = box.querySelector('#mDate').value || today();
          if (!min || min <= 0 || min > 600) { toast('Số phút cần từ 1 đến 600.'); return false; }
          if (date > today()) { toast('Không ghi cho ngày tương lai.'); return false; }
          logMinutes(box.querySelector('#mBlock').value, min, { date, manual: true, note: box.querySelector('#mNote').value.trim().slice(0, 80) });
          toast(`Đã ghi ${min} phút.`);
        },
      },
    ],
  });
}

export function mount(el) { root = el; }
export function show() { render(); }
export function onData() { render(); }
