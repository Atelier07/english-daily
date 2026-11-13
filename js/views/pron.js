import { db, save, uid } from '../store.js';
import { esc, today } from '../util.js';
import { toast } from '../ui.js';
import { tokenize } from '../dictation.js';
import { speakEn, createRecorder } from '../recorder.js';
import { hasAI, askJSON, endingCoachPrompt } from '../ai.js';
import { LIBRARY } from '../library.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// Cặp tối thiểu. Với nhóm có đuôi: [không đuôi, có đuôi].
export const SETS = {
  s: { name: 'Đuôi -s / -z', ending: true, pairs: [['bat', 'bats'], ['cup', 'cups'], ['book', 'books'], ['car', 'cars'], ['bag', 'bags'], ['row', 'rose'], ['pay', 'pays'], ['want', 'wants'], ['work', 'works'], ['like', 'likes'], ['week', 'weeks'], ['test', 'tests']] },
  ed: { name: 'Đuôi -ed', ending: true, pairs: [['pay', 'paid'], ['play', 'played'], ['walk', 'walked'], ['stop', 'stopped'], ['want', 'wanted'], ['need', 'needed'], ['call', 'called'], ['fix', 'fixed'], ['open', 'opened'], ['watch', 'watched']] },
  final: { name: 'Phụ âm cuối & cụm', ending: true, pairs: [['wan', 'want'], ['men', 'mend'], ['ten', 'tent'], ['ban', 'band'], ['fell', 'felt'], ['sick', 'six'], ['ask', 'asked'], ['bell', 'belt'], ['tie', 'tight'], ['bow', 'bowl'], ['see', 'seat'], ['fry', 'fries']] },
  length: { name: 'Nguyên âm dài/ngắn', ending: false, pairs: [['rice', 'rise'], ['bit', 'bid'], ['back', 'bag'], ['cap', 'cab'], ['seat', 'seed'], ['write', 'ride'], ['safe', 'save'], ['bus', 'buzz']] },
  asp: { name: 'Bật hơi p/t/k', ending: false, pairs: [['pie', 'buy'], ['tie', 'die'], ['coat', 'goat'], ['pin', 'bin'], ['tear', 'dear'], ['cold', 'gold']] },
};

const TIPS = {
  s: 'Tiếng Việt không có âm /s/, /z/ ở cuối. Giữ hơi xì “sss” (hoặc rung “zzz” sau âm hữu thanh như bags) cho tới khi nghe rõ, đừng cắt ngang.',
  ed: '-ed đọc /t/ sau âm vô thanh (walked), /d/ sau âm hữu thanh (called), /ɪd/ sau t, d (wanted). Bật nhẹ âm cuối ra thành tiếng.',
  final: 'Tiếng Việt chỉ có 6 phụ âm cuối và không bật hơi chúng. Với want, tent: chạm lưỡi rồi bật nhẹ /t/. Với cụm -nd, -lt: đọc đủ cả hai âm.',
  length: 'Nguyên âm trước âm hữu thanh dài hơn: rise dài hơn rice, bid dài hơn bit. Người bản xứ nghe độ dài này để đoán âm cuối.',
  asp: 'Đầu từ, p/t/k bật một luồng hơi: đặt tờ giấy trước miệng, nói “pie”, giấy phải lay. “buy” thì không.',
};

let root;
let setKey = 's';
let current = null; // {target, partner, set}
let busy = false;
const rec = createRecorder();
const stats = { tries: 0, missing: 0 };

function pick() {
  const set = SETS[setKey];
  const pair = set.pairs[Math.floor(Math.random() * set.pairs.length)];
  const k = Math.random() < 0.5 ? 0 : 1;
  current = { target: pair[k], partner: pair[1 - k], hasEnding: set.ending && k === 1, set: setKey };
}

function listenOnce() {
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = 'en-US';
    r.maxAlternatives = 5;     // n-best
    r.interimResults = false;
    r.continuous = false;      // không truyền "phrases" để máy không tự đoán theo từ mục tiêu
    let got = [];
    r.onresult = (e) => {
      const res = e.results[0];
      got = [];
      for (let i = 0; i < res.length; i++) got.push({ t: res[i].transcript.trim(), c: res[i].confidence });
    };
    r.onerror = (e) => (e.error === 'no-speech' ? resolve([]) : reject(e.error));
    r.onend = () => resolve(got);
    try { r.start(); } catch (e) { reject('start'); }
  });
}

export function evaluate(cur, alts) {
  const toks = alts.map((a) => tokenize(a.t));
  const hasT = toks.map((ts) => ts.includes(cur.target));
  const hasP = toks.map((ts) => ts.includes(cur.partner));
  const n = alts.length;
  if (!n) return { kind: 'none', text: 'Máy không nghe được gì. Nói to, rõ, gần micro hơn rồi thử lại.' };
  if (hasT[0]) return { kind: 'ok', text: `Máy nghe ra “${cur.target}”. Tốt, nhưng máy nghe đúng chưa chứng minh âm cuối đã rõ (máy hay tự đoán giúp). Nghe lại giọng mình để tự kiểm.` };
  if (hasT.some(Boolean)) return { kind: 'unclear', text: `Chưa rõ: “${cur.target}” chỉ có trong khả năng phụ, không phải khả năng đầu. Nói chậm lại, làm rõ âm cuối.` };
  if (cur.hasEnding) return { kind: 'missing', text: `Cả ${n} khả năng máy nghe ra đều không có “${cur.target}”${hasP.some(Boolean) ? `, có “${cur.partner}”` : ''}. Nhiều khả năng âm cuối bị mất thật.` };
  if (hasP.some(Boolean)) return { kind: 'confused', text: `Máy nghe thành “${cur.partner}”. ${SETS[cur.set].ending ? 'Có thể bạn thêm âm cuối thừa.' : 'Có thể độ dài nguyên âm hoặc luồng hơi chưa phân biệt được.'}` };
  return { kind: 'other', text: 'Máy nghe ra từ khác hẳn. Có thể do máy với từ đơn lẻ; thử lại một lần nữa.' };
}

function drillHtml() {
  const c = current;
  return `
    <div class="chip-group" id="setChips">${Object.entries(SETS).map(([k, s]) => `<button type="button" class="chip ${k === setKey ? 'on' : ''}" data-set="${k}">${esc(s.name)}</button>`).join('')}</div>
    <div class="card drill" style="margin-top:12px">
      <div class="front-label">Đọc to từ này</div>
      <div class="drill-word" lang="en">${esc(c.target)}</div>
      <div class="muted small">cặp với <span lang="en">${esc(c.partner)}</span></div>
      <div class="row" style="margin-top:14px">
        <button type="button" class="btn" id="pronModel">Nghe mẫu</button>
        <button type="button" class="btn btn-primary" id="pronSay" ${SR ? '' : 'disabled'}>Nói từ này</button>
        <button type="button" class="btn btn-quiet" id="pronNext">Từ khác</button>
      </div>
      <div id="pronResult" class="drill-result"></div>
      <p class="tip small">${esc(TIPS[setKey])}</p>
    </div>
    <p class="muted small">Đã thử ${stats.tries} lần · nghi bỏ âm cuối ${stats.missing} lần (phiên này)</p>`;
}

function renderDrill() {
  const box = root.querySelector('#drillBox');
  box.innerHTML = drillHtml();
  box.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => { setKey = b.dataset.set; pick(); renderDrill(); }));
  box.querySelector('#pronModel').addEventListener('click', () => speakEn(current.target, 0.8));
  box.querySelector('#pronNext').addEventListener('click', () => { pick(); renderDrill(); });
  box.querySelector('#pronSay').addEventListener('click', attempt);
}

async function attempt() {
  if (busy || !SR) return;
  busy = true;
  const btn = root.querySelector('#pronSay');
  const out = root.querySelector('#pronResult');
  btn.textContent = 'Đang nghe…';
  btn.disabled = true;
  out.innerHTML = '';
  const recording = await rec.start();
  let alts = [];
  try { alts = await listenOnce(); } catch (e) {
    toast(e === 'not-allowed' ? 'Chưa có quyền dùng micro.' : 'Nhận giọng nói gặp lỗi, thử lại.');
  }
  if (recording) await rec.stop();
  const v = evaluate(current, alts);
  stats.tries++;
  if (v.kind === 'missing') stats.missing++;
  db().pronLog.push({ id: uid(), date: today(), set: current.set, target: current.target, result: v.kind });
  if (db().pronLog.length > 300) db().pronLog.splice(0, db().pronLog.length - 300);
  save();
  const ai = ['missing', 'confused', 'unclear'].includes(v.kind) && await hasAI();
  out.innerHTML = `
    <div class="verdict verdict-${v.kind}">${esc(v.text)}</div>
    ${alts.length ? `<div class="label" style="margin-top:10px">Máy nghe ra (${alts.length} khả năng):</div>
      <ol class="alts">${alts.map((a) => `<li lang="en">${esc(a.t)}${a.c ? ` <span class="muted small">· độ tin ${Math.round(a.c * 100)}%</span>` : ''}</li>`).join('')}</ol>` : ''}
    <div class="row" style="margin-top:10px">
      ${rec.url ? '<button type="button" class="btn btn-sm" id="pronCmp">So với mẫu</button>' : ''}
      ${ai ? '<button type="button" class="btn btn-sm" id="pronCoach">AI giải thích</button>' : ''}
    </div>
    <div id="pronCoachOut"></div>`;
  const cmp = out.querySelector('#pronCmp');
  if (cmp) cmp.addEventListener('click', async () => { await speakEn(current.target, 0.8); await rec.play(); });
  const coach = out.querySelector('#pronCoach');
  if (coach) coach.addEventListener('click', async () => {
    coach.disabled = true;
    const co = out.querySelector('#pronCoachOut');
    co.innerHTML = '<p class="muted small">Đang hỏi AI…</p>';
    try {
      const { data } = await askJSON(endingCoachPrompt(current.target, current.partner, alts.map((a) => a.t), SETS[current.set].name));
      co.innerHTML = `<div class="ai-box"><p><b>Có thể vì:</b> ${esc(data.cause || '')}</p><p><b>Mẹo:</b> ${esc(data.tip || '')}</p><p class="muted small">AI đoán từ bản chép lời của máy, không nghe giọng bạn trực tiếp.</p></div>`;
    } catch (e) { co.innerHTML = `<p class="small">${esc(e.message)}</p>`; coach.disabled = false; }
  });
  btn.textContent = 'Nói lại';
  btn.disabled = false;
  busy = false;
}

// ---------- ghi & so sánh với giọng mẫu (nhấn âm, ngữ điệu) ----------
const STRESS = ['tech·NOL·o·gy', 'de·VEL·op·ment', 'pho·TOG·ra·phy', 'in·for·MA·tion', 'au·to·MA·tion', 'com·PU·ter', 'a·NAL·y·sis', 'po·TEN·tial', 'en·gi·NEER', 'AL·go·rithm', 'ar·ti·FI·cial', 'IN·ter·est·ing'];
const SENTENCE = ['I said the RED one, not the BLUE one.', "It's not a BUG. It's a FEATURE.", 'Can YOU send it, or should I?', 'I need the REPORT by Friday, not the SLIDES.'];
const TH = ['think / sink', 'three / tree', 'they / day', 'thank / tank'];

function plain(s) { return s.replace(/·/g, '').toLowerCase(); }
const sentText = (s) => s.replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase());

function compareList(id, items, toText, fmt) {
  return `<ul class="cmp-list" id="${id}">${items.map((it, i) => `
    <li><span class="cmp-text" lang="en">${fmt ? fmt(it) : esc(it)}</span>
      <span class="row" style="gap:6px">
        <button type="button" class="btn btn-sm" data-model="${i}">Mẫu</button>
        <button type="button" class="btn btn-sm" data-rec="${i}">Ghi</button>
        <button type="button" class="btn btn-sm btn-quiet" data-cmp="${i}" disabled>So sánh</button>
      </span></li>`).join('')}</ul>`;
}

function wireCompare(id, items, toText) {
  const ul = root.querySelector(`#${id}`);
  const recs = {};
  ul.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', () => speakEn(toText(items[b.dataset.model]), 0.85)));
  ul.querySelectorAll('[data-rec]').forEach((b) => b.addEventListener('click', async () => {
    const i = b.dataset.rec;
    if (!recs[i]) recs[i] = createRecorder();
    const r = recs[i];
    if (r.recording) {
      await r.stop();
      b.textContent = 'Ghi lại';
      b.classList.remove('on');
      ul.querySelector(`[data-cmp="${i}"]`).disabled = false;
    } else if (await r.start()) {
      b.textContent = 'Dừng';
      b.classList.add('on');
    }
  }));
  ul.querySelectorAll('[data-cmp]').forEach((b) => b.addEventListener('click', async () => {
    const i = b.dataset.cmp;
    await speakEn(toText(items[i]), 0.85);
    if (recs[i]) await recs[i].play();
  }));
}

export function mount(el) {
  root = el;
  pick();
  const pronLinks = LIBRARY.find((g) => g.level === 'Phát âm').items;
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Âm cuối · phát âm</div>
      <h1>Để người khác hiểu mình</h1>
      <p class="lede">Mục tiêu là dễ hiểu, không phải giọng bản xứ. Thứ tự ưu tiên theo nghiên cứu cho người Việt: âm cuối và đuôi -s/-ed trước, âm “th” sau cùng.</p>
    </div>

    <ol class="priority">
      <li class="on"><b>Phụ âm cuối, đuôi -s/-ed, cụm phụ âm</b></li>
      <li>Nhấn âm trong từ dài</li>
      <li>Nhấn câu (từ quan trọng nhất)</li>
      <li>Nguyên âm dài/ngắn trước âm cuối (rice / rise)</li>
      <li>Bật hơi p/t/k đầu từ</li>
      <li class="muted">“th” (ưu tiên thấp)</li>
    </ol>

    <section class="section">
      <h2>1 · Cặp từ tối thiểu</h2>
      ${SR ? '' : '<div class="notice" style="margin-bottom:12px">Trình duyệt này không có nhận giọng nói (thường gặp trên iPhone, Firefox). Bạn vẫn nghe mẫu, ghi và so sánh ở phần dưới. Phần chấm bằng máy cần Chrome/Edge trên máy tính hoặc Chrome Android.</div>'}
      <p class="muted small">Từ được chọn ngẫu nhiên trong cặp nên máy không đoán theo ngữ cảnh. Máy cho 5 khả năng: nếu <b>cả 5</b> đều thiếu âm cuối thì nhiều khả năng bạn bỏ âm thật; còn máy nghe đúng thì <b>chưa chắc</b> âm đã rõ. App không chấm điểm phát âm.</p>
      <div id="drillBox"></div>
    </section>

    <section class="section">
      <h2>2 · Nhấn âm trong từ dài</h2>
      <p class="muted small">Âm viết HOA là âm nhấn: to hơn, dài hơn, cao hơn. Nghe mẫu, ghi giọng mình, rồi so sánh.</p>
      <div class="card">${compareList('stressList', STRESS, plain, (w) => esc(w).replace(/([A-Z]{2,})/g, '<b>$1</b>'))}</div>
    </section>

    <section class="section">
      <h2>3 · Nhấn câu</h2>
      <p class="muted small">Từ mang thông tin mới hoặc đối lập được nhấn. Đổi chỗ nhấn là đổi ý.</p>
      <div class="card">${compareList('sentList', SENTENCE, sentText, (s) => esc(s).replace(/\b([A-Z]{2,})\b/g, '<b>$1</b>'))}</div>
    </section>

    <section class="section">
      <h2>4–5 · Độ dài nguyên âm, bật hơi</h2>
      <p class="muted small">Dùng nhóm “Nguyên âm dài/ngắn” và “Bật hơi p/t/k” trong phần 1.</p>
    </section>

    <section class="section">
      <h2>6 · Âm “th” <span class="muted small">(ưu tiên thấp)</span></h2>
      <p class="muted small">Đọc “th” thành /s/ hay /t/ ít khi làm người nghe hiểu sai. Chỉ luyện khi các phần trên đã ổn.</p>
      <div class="card">${compareList('thList', TH, (s) => s.replace(' / ', ', '))}</div>
    </section>

    <section class="section">
      <h2>Học thêm</h2>
      <div class="card"><ul class="link-list">
        ${pronLinks.map((i) => `<li><div class="grow"><a class="t" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.label)}</a><span class="s">${esc(i.hint)}</span></div><span class="muted small" aria-hidden="true">↗</span></li>`).join('')}
      </ul></div>
    </section>`;
  renderDrill();
  wireCompare('stressList', STRESS, plain);
  wireCompare('sentList', SENTENCE, sentText);
  wireCompare('thList', TH, (s) => s.replace(' / ', ', '));
}

export function show() {}
