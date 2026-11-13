import { db, save } from '../store.js';
import { esc, fmtClock } from '../util.js';
import { toast } from '../ui.js';
import { toggle, running } from '../timer.js';

let root;
let player = null;
let playerReady = false;
let ytPromise = null;
let poll = null;
let A = null, B = null, looping = false;
let comparing = false;
let rec = null, recStream = null, recChunks = [], recUrl = null, recAutoStop = false;
let currentVideoId = null;

const STARTERS = [
  { q: '6 Minute English BBC', label: '6 Minute English (BBC)', hint: 'Dễ · A2–B1 · nói chậm, rõ, có transcript' },
  { q: 'VOA Learning English', label: 'VOA Learning English', hint: 'Dễ · A2–B1 · đọc chậm, câu ngắn' },
  { q: 'TED-Ed', label: 'TED-Ed', hint: 'Vừa · B1 · 4–5 phút, hình minh hoạ giúp đoán nghĩa' },
  { q: 'n8n tutorial for beginners', label: 'n8n cho người mới', hint: 'Vừa · B1 · tự động hoá, nhìn màn hình là hiểu' },
  { q: 'Claude AI tutorial', label: 'Hướng dẫn Claude AI', hint: 'Vừa · B1 · chủ đề bạn đang thích' },
  { q: 'Power BI tutorial beginner', label: 'Power BI cho người mới', hint: 'Vừa · B1 · từ vựng dữ liệu, công việc' },
  { q: 'SQL for beginners', label: 'SQL cho người mới', hint: 'Vừa–khó · B1–B2 · thuật ngữ lặp lại nhiều' },
];

export function parseYouTube(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  let id = null;
  const m = s.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) id = m[1];
  else if (/^[A-Za-z0-9_-]{11}$/.test(s)) id = s;
  if (!id) return null;
  let start = 0;
  const t = s.match(/[?&#](?:t|start)=([0-9hms]+)/);
  if (t) {
    const v = t[1];
    if (/^\d+$/.test(v)) start = Number(v);
    else {
      const hh = v.match(/(\d+)h/), mm = v.match(/(\d+)m/), ss = v.match(/(\d+)s/);
      start = (hh ? +hh[1] * 3600 : 0) + (mm ? +mm[1] * 60 : 0) + (ss ? +ss[1] : 0);
    }
  }
  return { id, start };
}

function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { ytPromise = null; reject(new Error('Không tải được YouTube')); };
    document.head.appendChild(s);
  });
  return ytPromise;
}

function now() { try { return player && playerReady ? player.getCurrentTime() : 0; } catch (e) { return 0; } }

async function openVideo(raw) {
  const parsed = parseYouTube(raw);
  if (!parsed) { toast('Link YouTube chưa đúng. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…'); return; }
  A = null; B = null; looping = false; comparing = false;
  updateAB();
  currentVideoId = parsed.id;
  const holder = root.querySelector('#playerHolder');
  try {
    const YT = await loadYT();
    if (player && playerReady) {
      player.loadVideoById({ videoId: parsed.id, startSeconds: parsed.start });
    } else {
      holder.innerHTML = '<div id="ytPlayer"></div>';
      playerReady = false;
      player = new YT.Player('ytPlayer', {
        videoId: parsed.id,
        playerVars: { playsinline: 1, rel: 0, start: parsed.start || 0, cc_load_policy: 1, origin: location.origin },
        events: {
          onReady: () => { playerReady = true; rememberVideo(parsed.id, raw); setControlsEnabled(true); },
          onStateChange: (e) => { if (e.data === 1) rememberVideo(parsed.id, raw); },
          onError: (e) => toast([101, 150, 152, 153].includes(e.data)
            ? 'Chủ video không cho phát nhúng ở trang khác. Chọn video khác.'
            : 'Không phát được video này. Kiểm tra link hoặc thử video khác.', 4000),
        },
      });
    }
    if (playerReady) rememberVideo(parsed.id, raw);
    startPoll();
  } catch (e) {
    holder.innerHTML = `<div class="player-empty">Không tải được YouTube. Kiểm tra mạng rồi thử lại.</div>`;
  }
}

function rememberVideo(id, url) {
  let title = '';
  try { title = (player.getVideoData && player.getVideoData().title) || ''; } catch (e) { /* ignore */ }
  const list = db().videos.filter((v) => v.videoId !== id);
  const old = db().videos.find((v) => v.videoId === id);
  list.unshift({ videoId: id, url: url.startsWith('http') ? url : `https://youtu.be/${id}`, title: title || old?.title || '', lastUsed: Date.now() });
  db().videos = list.slice(0, 12);
  save();
  renderRecent();
}

function startPoll() {
  if (poll) return;
  poll = setInterval(() => {
    if (!player || !playerReady) return;
    const t = now();
    if (comparing && B != null && t >= B) {
      comparing = false;
      try { player.pauseVideo(); } catch (e) { /* ignore */ }
      playRecording();
      return;
    }
    if (recAutoStop && B != null && t >= B && rec && rec.state === 'recording') {
      recAutoStop = false;
      try { player.pauseVideo(); } catch (e) { /* ignore */ }
      rec.stop();
      return;
    }
    if (looping && A != null && B != null && t >= B) player.seekTo(A, true);
    const cl = root.querySelector('#curTime');
    if (cl) cl.textContent = fmtClock(t);
  }, 100);
}

function setSpeed(r) {
  if (!player || !playerReady) return;
  player.setPlaybackRate(r);
  root.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === r));
  setTimeout(() => {
    try {
      const actual = player.getPlaybackRate();
      if (Math.abs(actual - r) > 0.01) toast(`Video này không chạy được ${r}×, đang ở ${actual}×.`);
    } catch (e) { /* ignore */ }
  }, 400);
}

function updateAB() {
  if (!root) return;
  const a = root.querySelector('#aVal'), b = root.querySelector('#bVal');
  if (a) a.textContent = A == null ? '—' : fmtClock(A);
  if (b) b.textContent = B == null ? '—' : fmtClock(B);
  const lb = root.querySelector('#loopBtn');
  if (lb) {
    lb.classList.toggle('on', looping);
    lb.textContent = looping ? 'Đang lặp A–B · tắt' : 'Lặp câu A–B';
    lb.disabled = A == null || B == null;
  }
  const cmp = root.querySelector('#cmpBtn');
  if (cmp) cmp.disabled = !recUrl;
  const me = root.querySelector('#meBtn');
  if (me) me.disabled = !recUrl;
}

function replay() {
  if (!player || !playerReady) return;
  const start = A != null ? A : Math.max(0, now() - 5);
  player.seekTo(start, true);
  player.playVideo();
}

// ---------- ghi âm (chỉ giữ trong bộ nhớ) ----------
async function toggleRecord() {
  if (rec && rec.state === 'recording') { recAutoStop = false; rec.stop(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    toast('Trình duyệt này không hỗ trợ ghi âm. Thử Chrome hoặc Safari mới.');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    toast('Chưa có quyền dùng micro. Hãy cho phép micro trong trình duyệt.');
    return;
  }
  recChunks = [];
  rec = new MediaRecorder(recStream);
  rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  rec.onstop = () => {
    if (recUrl) URL.revokeObjectURL(recUrl);
    recUrl = URL.createObjectURL(new Blob(recChunks, { type: rec.mimeType || 'audio/webm' }));
    recStream.getTracks().forEach((t) => t.stop());
    recStream = null;
    setRecStatus('Đã ghi xong. Bấm “So sánh” để nghe bản gốc rồi giọng bạn.');
    root.querySelector('#recBtn').textContent = 'Ghi âm lại';
    root.querySelector('#recBtn').classList.remove('on');
    updateAB();
  };
  rec.start();
  root.querySelector('#recBtn').textContent = 'Dừng ghi';
  root.querySelector('#recBtn').classList.add('on');
  setRecStatus('<span class="dot"></span>Đang ghi…');
  const playAlong = root.querySelector('#playAlong').checked;
  if (playAlong && player && playerReady && A != null && B != null) {
    recAutoStop = true;
    player.seekTo(A, true);
    player.playVideo();
  }
}

function setRecStatus(html) { const el = root.querySelector('#recStatus'); if (el) el.innerHTML = html; }

function playRecording() {
  if (!recUrl) return;
  const a = new Audio(recUrl);
  a.play().catch(() => toast('Không phát được bản ghi.'));
  setRecStatus('Đang phát giọng bạn…');
  a.onended = () => setRecStatus('Nghe ra chỗ khác nhau chưa? Lặp lại đoạn đó vài lần.');
}

function compare() {
  if (!recUrl) return;
  if (!player || !playerReady || A == null || B == null) {
    toast('Đặt điểm A và B trước để so sánh đúng đoạn.');
    playRecording();
    return;
  }
  looping = false;
  updateAB();
  comparing = true;
  setRecStatus('Đang phát bản gốc…');
  player.seekTo(A, true);
  player.playVideo();
}

function setControlsEnabled(on) {
  root.querySelectorAll('[data-needs-player]').forEach((b) => { b.disabled = !on; });
  updateAB();
}

function renderRecent() {
  const box = root && root.querySelector('#recent');
  if (!box) return;
  const vids = db().videos;
  box.innerHTML = vids.length
    ? `<ul class="link-list">${vids.map((v) => `
        <li>
          <div class="grow">
            <span class="t">${esc(v.title || v.url)}</span>
            <span class="s">${new Date(v.lastUsed).toLocaleDateString('vi-VN')}</span>
          </div>
          <button type="button" class="btn btn-sm" data-open="${esc(v.url)}">Mở</button>
          <button type="button" class="btn btn-quiet btn-sm" data-forget="${esc(v.videoId)}" aria-label="Bỏ khỏi danh sách">Bỏ</button>
        </li>`).join('')}</ul>`
    : `<p class="muted small">Video bạn mở sẽ hiện ở đây để quay lại nhanh.</p>`;
  box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    root.querySelector('#ytUrl').value = b.dataset.open;
    openVideo(b.dataset.open);
    root.querySelector('#playerHolder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  box.querySelectorAll('[data-forget]').forEach((b) => b.addEventListener('click', () => {
    db().videos = db().videos.filter((v) => v.videoId !== b.dataset.forget);
    save();
    renderRecent();
  }));
}

function renderTimerBtn() {
  const b = root.querySelector('#shadowTimer');
  if (!b) return;
  const on = running() && running().block === 'shadow';
  b.textContent = on ? 'Dừng & ghi giờ' : 'Bấm giờ Shadowing';
  b.classList.toggle('btn-primary', !!on);
}

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Shadowing</div>
      <h1>Nói đè theo người thật</h1>
      <p class="lede">Chọn một đoạn ngắn 1–2 phút, lặp đến khi miệng bạn theo kịp nhịp của họ.</p>
      <div class="row" style="margin-top:12px"><button type="button" class="btn" id="shadowTimer">Bấm giờ Shadowing</button></div>
    </div>

    <form class="url-row" id="urlForm" autocomplete="off">
      <input id="ytUrl" class="input" type="url" inputmode="url" placeholder="Dán link YouTube…" aria-label="Link YouTube">
      <button class="btn btn-primary" type="submit">Mở</button>
    </form>

    <div class="player-wrap" id="playerHolder">
      <div class="player-empty">Dán link YouTube ở trên. Nên chọn video có phụ đề tiếng Anh.</div>
    </div>

    <div class="controls">
      <div class="group">
        <span class="label">Tốc độ</span>
        <div class="chip-group">
          ${[0.5, 0.75, 0.9, 1].map((r) => `<button type="button" class="chip ${r === 1 ? 'on' : ''}" data-speed="${r}" data-needs-player disabled>${r}×</button>`).join('')}
        </div>
      </div>
      <div class="group">
        <span class="label">Đoạn câu <span class="muted">· đang ở <span id="curTime" class="num">00:00</span></span></span>
        <div class="ab-row">
          <button type="button" class="btn" id="setA" data-needs-player disabled>Đặt A <span class="ab-val" id="aVal">—</span></button>
          <button type="button" class="btn" id="setB" data-needs-player disabled>Đặt B <span class="ab-val" id="bVal">—</span></button>
        </div>
        <div class="ab-row">
          <button type="button" class="btn" id="back3" data-needs-player disabled>Lùi 3s</button>
          <button type="button" class="btn" id="loopBtn" disabled>Lặp câu A–B</button>
        </div>
      </div>
      <div class="group full">
        <button type="button" class="btn btn-primary btn-lg big-replay" id="replay" data-needs-player disabled>Phát lại câu</button>
        <span class="muted small">Phát lại từ A. Chưa đặt A thì lùi 5 giây.</span>
      </div>
      <div class="group full card">
        <span class="label">Ghi âm & so sánh</span>
        <label class="toggle"><input type="checkbox" id="playAlong" checked> Phát đoạn A–B trong lúc ghi (nên đeo tai nghe)</label>
        <div class="rec-row">
          <button type="button" class="btn" id="recBtn">Ghi âm</button>
          <button type="button" class="btn" id="cmpBtn" disabled>So sánh</button>
        </div>
        <button type="button" class="btn btn-quiet btn-sm" id="meBtn" disabled style="align-self:flex-start">Chỉ nghe giọng mình</button>
        <div class="rec-status" id="recStatus">Bản ghi chỉ nằm trong bộ nhớ tạm, đóng trang là mất.</div>
      </div>
    </div>

    <section class="section">
      <h2>Cách shadowing</h2>
      <ol class="steps">
        <li><span><b>Nghe</b> đoạn A–B 2–3 lần, chưa nói. Bật phụ đề nếu cần, đoán ý chính.</span></li>
        <li><span><b>Lẩm bẩm theo</b> thật nhỏ, ở tốc độ 0.75×. Chỉ bắt nhịp và chỗ nhấn, chưa cần rõ chữ.</span></li>
        <li><span><b>Shadow</b>: nói to, đè ngay sau người nói nửa nhịp. Tăng dần lên 0.9× rồi 1×.</span></li>
        <li><span><b>Ghi âm & so sánh</b>: nghe bản gốc rồi giọng mình. Chọn một chỗ khác nhất, sửa đúng chỗ đó.</span></li>
      </ol>
    </section>

    <section class="section">
      <h2>Gợi ý để tìm video</h2>
      <p class="muted small">Đây là link tìm kiếm trên YouTube (không phải video cố định), chọn video nào bạn thấy thích rồi dán link vào ô ở trên.</p>
      <div class="card">
        <ul class="link-list">
          ${STARTERS.map((s) => `
            <li><div class="grow">
              <a class="t" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s.q)}" target="_blank" rel="noopener">${esc(s.label)}</a>
              <span class="s">${esc(s.hint)}</span>
            </div><span class="muted small">↗</span></li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="section">
      <h2>Video gần đây</h2>
      <div class="card" id="recent"></div>
    </section>
  `;

  el.querySelector('#urlForm').addEventListener('submit', (e) => { e.preventDefault(); openVideo(el.querySelector('#ytUrl').value); });
  el.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.speed))));
  el.querySelector('#back3').addEventListener('click', () => { if (playerReady) player.seekTo(Math.max(0, now() - 3), true); });
  el.querySelector('#setA').addEventListener('click', () => {
    A = Math.max(0, now() - 0.2);
    if (B != null && B <= A) { B = null; looping = false; }
    updateAB();
  });
  el.querySelector('#setB').addEventListener('click', () => {
    const t = now();
    if (A == null) { toast('Đặt A trước.'); return; }
    if (t <= A + 0.5) { toast('B phải sau A ít nhất nửa giây.'); return; }
    B = t;
    looping = true;
    updateAB();
    player.seekTo(A, true);
    player.playVideo();
  });
  el.querySelector('#loopBtn').addEventListener('click', () => {
    looping = !looping;
    updateAB();
    if (looping && playerReady) { player.seekTo(A, true); player.playVideo(); }
  });
  el.querySelector('#replay').addEventListener('click', replay);
  el.querySelector('#recBtn').addEventListener('click', toggleRecord);
  el.querySelector('#cmpBtn').addEventListener('click', compare);
  el.querySelector('#meBtn').addEventListener('click', playRecording);
  el.querySelector('#shadowTimer').addEventListener('click', () => toggle('shadow'));
  renderRecent();
}

export function show() { renderTimerBtn(); renderRecent(); }
export function onData() { renderTimerBtn(); }
export function hide() {
  if (rec && rec.state === 'recording') { recAutoStop = false; rec.stop(); }
}
