import { db, save } from '../store.js';
import { esc, today, fmtClock } from '../util.js';
import { toast, copyText } from '../ui.js';
import { logMinutes } from '../timer.js';
import { PROMPTS, promptIndexFor } from '../prompts.js';
import { addError } from './errors.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

let root;
let recog = null;
let listening = false;
let keep = false;
let finalText = '';
let startedAt = 0;
let spokenSec = 0;
let clockT = null;
let logged = false;

function currentPrompt() {
  const ps = db().promptShift;
  const shift = ps.date === today() ? ps.n : 0;
  return PROMPTS[promptIndexFor(new Date(), shift)];
}

function words(s) { return (s.trim().match(/[A-Za-z0-9'’-]+/g) || []).length; }

function buildAIPrompt(text, p) {
  return `Mình đang tự học tiếng Anh, trình độ khoảng A2. Dưới đây là đoạn mình vừa NÓI (máy chuyển giọng nói thành chữ, nên bỏ qua lỗi chính tả hay dấu câu do máy nghe nhầm).

Bạn chỉ làm đúng 3 việc:
1. Tìm 1–2 lỗi mình LẶP LẠI nhiều nhất hoặc làm người nghe khó hiểu nhất. Chỉ 1–2 lỗi, không hơn.
2. Với mỗi lỗi: trích câu mình nói sai → viết lại câu đó cho đúng và tự nhiên (giữ ý của mình).
3. Giải thích thật ngắn bằng tiếng Việt, tối đa 1–2 câu.

KHÔNG dạy ngữ pháp dài, KHÔNG sửa mọi lỗi nhỏ, KHÔNG viết lại cả đoạn, KHÔNG cho bài tập.

Trả lời đúng theo mẫu:
Sai: ...
Đúng: ...
Vì: ...

Đề mình nói: ${p.en}
Đoạn mình nói:
"""
${text.trim()}
"""`;
}

function setMicUI() {
  const b = root.querySelector('#micBtn');
  if (!b) return;
  b.classList.toggle('recording', listening);
  b.textContent = listening ? 'Dừng' : (SR ? 'Bắt đầu nói' : 'Bắt đầu bấm giờ nói');
  root.querySelector('#after').hidden = listening || (!spokenSec && !words(root.querySelector('#transcript').value));
}

function updateStats() {
  const t = root.querySelector('#transcript').value;
  const w = words(t);
  const sec = spokenSec + (listening ? (Date.now() - startedAt) / 1000 : 0);
  root.querySelector('#stWords').textContent = w;
  root.querySelector('#stTime').textContent = fmtClock(sec);
  root.querySelector('#stWpm').textContent = sec >= 20 ? Math.round(w / (sec / 60)) : '—';
  const mins = Math.max(1, Math.round(sec / 60));
  const lb = root.querySelector('#logBtn');
  if (lb && !logged) lb.textContent = `Ghi ${mins} phút vào “Nói ra”`;
}

function start() {
  logged = false;
  startedAt = Date.now();
  listening = true;
  keep = true;
  clockT = setInterval(updateStats, 500);
  if (SR) {
    finalText = root.querySelector('#transcript').value;
    if (finalText && !/\s$/.test(finalText)) finalText += ' ';
    startRecog();
  }
  setMicUI();
}

function startRecog() {
  recog = new SR();
  recog.lang = 'en-US';
  recog.continuous = true;
  recog.interimResults = true;
  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const t = r[0].transcript.trim();
        if (t) finalText += t + (/[.!?]$/.test(t) ? ' ' : '. ');
      }
      else interim += r[0].transcript;
    }
    const ta = root.querySelector('#transcript');
    ta.value = finalText + interim;
    ta.scrollTop = ta.scrollHeight;
  };
  recog.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      keep = false;
      toast('Chưa có quyền dùng micro. Cho phép micro hoặc gõ vào ô bên dưới.');
      stop();
    } else if (e.error === 'network') {
      keep = false;
      toast('Nhận giọng nói cần mạng. Bạn có thể gõ thay.');
      stop();
    }
  };
  recog.onend = () => {
    if (keep && listening) {
      try { recog.start(); } catch (e) { /* đã chạy */ }
    }
  };
  try { recog.start(); } catch (e) { toast('Không bật được micro.'); stop(); }
}

function stop() {
  if (!listening) return;
  keep = false;
  listening = false;
  spokenSec += (Date.now() - startedAt) / 1000;
  clearInterval(clockT);
  if (recog) {
    try { recog.stop(); } catch (e) { /* ignore */ }
    recog = null;
    const ta = root.querySelector('#transcript');
    // giữ phần chữ tạm thời cuối cùng
    if (ta.value.trim().length < finalText.trim().length) ta.value = finalText;
  }
  updateStats();
  setMicUI();
}

function resetSpeech() {
  stop();
  finalText = '';
  spokenSec = 0;
  logged = false;
  root.querySelector('#transcript').value = '';
  const lb = root.querySelector('#logBtn');
  lb.disabled = false;
  updateStats();
  setMicUI();
}

function renderPrompt() {
  const p = currentPrompt();
  root.querySelector('#promptVi').textContent = p.vi;
  root.querySelector('#promptEn').textContent = p.en;
}

export function mount(el) {
  root = el;
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Nói ra</div>
      <h1>Đề hôm nay</h1>
      <p class="lede">Nói liền 2–5 phút, sai cũng nói tiếp. Nói xong mới nhờ AI chỉ ra 1–2 lỗi lặp lại.</p>
    </div>

    <div class="card prompt-card">
      <div class="vi" id="promptVi"></div>
      <div class="en" id="promptEn" lang="en"></div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn btn-quiet btn-sm" id="shiftPrompt">Đổi đề khác</button>
      </div>
    </div>

    ${SR ? '' : `<div class="notice" style="margin-top:14px">Trình duyệt này chưa hỗ trợ nhận giọng nói (thường gặp trên iPhone, iPad và Firefox). Bạn vẫn nói to như bình thường và bấm giờ; sau đó gõ lại ý chính, hoặc dùng nút micro trên bàn phím điện thoại (đọc chính tả) để nhập vào ô bên dưới. Trên máy tính, Chrome hoặc Edge sẽ tự chép lời.</div>`}

    <div class="section" style="margin-top:18px">
      <button type="button" class="btn btn-primary mic-btn" id="micBtn">Bắt đầu nói</button>
      <div class="field" style="margin-top:14px">
        <label for="transcript">Bản chép lời ${SR ? '(tự hiện khi bạn nói, sửa được)' : '(gõ hoặc đọc chính tả)'}</label>
        <textarea id="transcript" class="textarea transcript" lang="en" rows="6" placeholder="Your words will appear here…"></textarea>
      </div>
      <div class="speak-stats" style="margin-top:12px">
        <div class="stat"><span class="num" id="stWords">0</span><span class="k">từ</span></div>
        <div class="stat"><span class="num" id="stTime">00:00</span><span class="k">thời gian nói</span></div>
        <div class="stat"><span class="num" id="stWpm">—</span><span class="k">từ / phút</span></div>
      </div>
    </div>

    <div id="after" hidden>
      <div class="section">
        <h2>Sau khi nói</h2>
        <div class="row">
          <button type="button" class="btn btn-primary" id="copyAI">Copy để nhờ AI sửa</button>
          <button type="button" class="btn" id="logBtn">Ghi phút vào “Nói ra”</button>
          <button type="button" class="btn btn-quiet" id="speakReset">Nói lại từ đầu</button>
        </div>
        <p class="muted small" style="margin-top:8px">Dán vào ChatGPT, Claude hay Gemini. Lời nhắc đã dặn AI chỉ nêu 1–2 lỗi lặp lại nhất, kèm câu đúng và giải thích ngắn.</p>
      </div>

      <div class="section card">
        <h3 style="margin-bottom:10px">Lưu lỗi AI chỉ ra vào “Lỗi của tôi”</h3>
        <div class="field"><label for="eWrong">Bạn đã nói (sai)</label><input id="eWrong" class="input" lang="en" placeholder="vd: I very like it"></div>
        <div class="field"><label for="eRight">Câu đúng</label><input id="eRight" class="input" lang="en" placeholder="vd: I really like it"></div>
        <div class="field"><label for="eNote">Ghi chú ngắn (không bắt buộc)</label><input id="eNote" class="input" placeholder="vd: very không đứng trước động từ"></div>
        <div class="row" style="margin-top:12px">
          <button type="button" class="btn btn-primary" id="saveErr">Lưu lỗi</button>
          <a href="#/errors" class="btn btn-quiet">Xem Lỗi của tôi →</a>
        </div>
      </div>
    </div>
  `;
  renderPrompt();
  el.querySelector('#shiftPrompt').addEventListener('click', () => {
    const ps = db().promptShift;
    db().promptShift = { date: today(), n: (ps.date === today() ? ps.n : 0) + 1 };
    save();
    renderPrompt();
  });
  el.querySelector('#micBtn').addEventListener('click', () => (listening ? stop() : start()));
  el.querySelector('#transcript').addEventListener('input', () => {
    if (listening && SR) return;
    updateStats();
    setMicUI();
  });
  el.querySelector('#copyAI').addEventListener('click', async () => {
    const text = el.querySelector('#transcript').value;
    if (words(text) < 5) { toast('Chưa có đủ chữ để gửi. Nói hoặc gõ thêm.'); return; }
    const ok = await copyText(buildAIPrompt(text, currentPrompt()));
    toast(ok ? 'Đã copy. Dán vào AI bạn hay dùng.' : 'Không copy được, hãy bôi đen và copy tay.');
  });
  el.querySelector('#logBtn').addEventListener('click', (e) => {
    if (logged) return;
    const mins = Math.max(1, Math.round(spokenSec / 60));
    logMinutes('speak', mins, { manual: false, note: 'đề nói' });
    db().speakLog.push({ date: today(), words: words(el.querySelector('#transcript').value), seconds: Math.round(spokenSec) });
    save();
    logged = true;
    e.target.textContent = 'Đã ghi';
    e.target.disabled = true;
    toast(`Đã ghi ${mins} phút.`);
  });
  el.querySelector('#speakReset').addEventListener('click', resetSpeech);
  el.querySelector('#saveErr').addEventListener('click', () => {
    const wrong = el.querySelector('#eWrong').value.trim();
    const right = el.querySelector('#eRight').value.trim();
    if (!wrong || !right) { toast('Cần cả câu sai và câu đúng.'); return; }
    const res = addError({ wrong, right, note: el.querySelector('#eNote').value.trim() });
    ['#eWrong', '#eRight', '#eNote'].forEach((s) => { el.querySelector(s).value = ''; });
    toast(res === 'again' ? 'Lỗi này đã có, đã tăng số lần gặp.' : 'Đã lưu vào Lỗi của tôi.');
  });
  updateStats();
  setMicUI();
}

export function show() { renderPrompt(); }
export function hide() { stop(); }
