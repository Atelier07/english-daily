// Nói chuyện tự do với Gemini (~5 phút) sau kiểm tra tuần và ở cuối buổi ôn lại tuần.
// Gemini đóng đối tác trong một tình huống đời thường lấy từ chức năng của tuần, trả lời ngắn bằng các cụm đã học,
// kèm một dòng gợi ý tiếng Việt. Sau 7 lượt: nhận xét {good, fix, summary_vi}. Không có khoá AI: bỏ qua, không chặn buổi học.
import { db, save, uid } from './store.js';
import { esc, today } from './util.js';
import { loadIndex } from './course.js';
import { play, stop as stopAudio } from './audio.js';
import { hasAI, askJSON } from './ai.js';
import { sttSupported, listenOnce } from './stt.js';
import { dueSoon } from './items.js';
import { chunkFragments } from './course.js';
import { weekRange } from './weekly.js';

export const TURNS = 7;
const MIN_END = 3;

export const newFreeTalk = (week) => ({ week, phase: 'intro', msgs: [], scenario_vi: '', scenario_en: '', turns: 0, feedback: null, skipped: false });

async function weekFunctions(w) {
  try {
    const { from, to } = weekRange(w);
    const idx = await loadIndex();
    return [...new Set(idx.filter((e) => e.day >= from && e.day <= to).map((e) => e.function).filter(Boolean))];
  } catch (e) { return []; }
}
const learned = () => db().items.filter((i) => i.kind === 'chunk').sort((a, b) => (b.day || 0) - (a.day || 0)).slice(0, 160);

const BASE = (list) => `Bạn là ĐỐI TÁC trò chuyện tiếng Anh với một người Việt đang học tiếng Anh ở mức A0–A2. Luôn nói tiếng Anh ĐƠN GIẢN, câu ngắn (5–12 từ), từ thông dụng, mỗi lượt chỉ một ý hoặc một câu hỏi. Dùng tự nhiên các cụm người học đã học (không nhồi) và không dùng từ khó ngoài danh sách nếu tránh được. KHÔNG sửa lỗi trong lúc trò chuyện, KHÔNG nói tiếng Việt trong "reply_en".
Các cụm đã học:
${list.map((c) => `- ${c.id}: ${c.en}`).join('\n')}`;

const transcript = (msgs) => msgs.map((m) => `${m.role === 'ai' ? 'Đối tác' : 'Người học'}: ${m.en}`).join('\n');

function openPrompt(funcs, list) {
  return `${BASE(list)}
Chức năng ngôn ngữ trong tuần này: ${funcs.join('; ') || 'chào hỏi, nhờ giúp, muốn và xin'}.
Hãy tự chọn MỘT tình huống đời thường mở (ví dụ gọi đồ ở quán cà phê, hỏi đường, làm quen ở lớp) hợp với các chức năng đó. Bạn nói câu đầu tiên.
Chỉ trả về JSON: {"scenario_vi":"mô tả tình huống 1 câu tiếng Việt, nói rõ bạn đóng vai ai","scenario_en":"one short English sentence describing the situation and your role","reply_en":"","hint_vi":"1 dòng tiếng Việt gợi ý người học có thể nói gì tiếp"}`;
}
function turnPrompt(st, list) {
  return `${BASE(list)}
Tình huống: ${st.scenario_en}
Hội thoại cho đến giờ:
${transcript(st.msgs)}
Hãy đáp lại lượt cuối của người học (nếu câu họ khó hiểu thì hỏi lại đơn giản) rồi hỏi/nói tiếp một ý. Gợi ý "hint_vi" là 1 dòng tiếng Việt về ý người học có thể nói tiếp (có thể nhắc một cụm đã học).
Chỉ trả về JSON: {"reply_en":"","hint_vi":""}`;
}
function feedbackPrompt(st, list) {
  return `Người học tiếng Anh (người Việt, A0–A2) vừa trò chuyện tự do. Câu của người học có thể do máy chép lời nên bỏ qua lỗi chính tả, dấu câu, viết hoa. Chấm khoan dung, giọng bình tĩnh, không khen quá.
Tình huống: ${st.scenario_en}
Hội thoại:
${transcript(st.msgs)}

Các cụm đã học (để gắn vào mục cần sửa):
${list.map((c) => `- ${c.id}: ${c.en}`).join('\n')}

Trả về:
- "good": 1–3 điều làm tốt, mỗi điều một câu ngắn tiếng Việt, cụ thể
- "fix": tối đa 3 lỗi quan trọng nhất của NGƯỜI HỌC: {"said":"nguyên văn câu người học","better":"câu tốt hơn, giữ ý","note_vi":"1 câu tiếng Việt","chunkIds":["id cụm đã học liên quan nhất, nếu có"]}
- "summary_vi": 1–2 câu tiếng Việt đơn giản
Chỉ trả về JSON: {"good":[],"fix":[{"said":"","better":"","note_vi":"","chunkIds":[]}],"summary_vi":""}`;
}

function relatedChunks(text) {
  const t = String(text || '').toLowerCase();
  return learned().filter((c) => chunkFragments(c.en).some((f) => f.length >= 4 && t.includes(f.toLowerCase()))).map((c) => c.id);
}

export function saveFreeTalk(st) {
  const fb = st.feedback;
  const ids = new Set();
  (fb.fix || []).forEach((f) => { (f.chunkIds || []).forEach((id) => ids.add(id)); relatedChunks(f.better).forEach((id) => ids.add(id)); });
  const known = new Set(db().items.map((i) => i.id));
  const pushed = [...ids].filter((id) => known.has(id));
  db().freeTalks.push({
    id: `ft${st.week}-${uid()}`, week: st.week, date: today(), ts: Date.now(), turns: st.turns, scenario_vi: st.scenario_vi,
    good: fb.good, fix: fb.fix, summary_vi: fb.summary_vi, chunkIds: pushed, msgs: st.msgs,
  });
  dueSoon(pushed, 1);
  save();
  return pushed;
}

export const allFreeTalks = () => db().freeTalks.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));

// ---------- giao diện ----------
// ctx: { st, persist, onDone(), standalone }
export async function renderFreeTalk(el, ctx) {
  const { st, persist } = ctx;
  const alive = () => el.isConnected;
  const set = (patch) => { Object.assign(st, patch); persist(); };

  if (st.phase === 'intro') {
    if (!(await hasAI())) {
      set({ phase: 'skipped', skipped: true });
    } else {
      set({ phase: 'opening' });
    }
  }
  if (!alive()) return;
  if (st.phase === 'skipped') { drawSkipped(); return; }
  if (st.phase === 'opening') { await open(); return; }
  if (st.phase === 'chat') { drawChat(); return; }
  if (st.phase === 'feedback') { await finish(); return; }
  drawResult();

  function shell(inner, noExit = false) {
    el.innerHTML = `<div class="ft">${inner}${ctx.standalone && !noExit ? `<div class="sess-foot"><span></span><button type="button" class="btn btn-primary btn-lg" id="ftExit">${st.phase === 'done' ? 'Xong' : st.phase === 'skipped' ? 'Tiếp tục' : 'Bỏ qua bước này'}</button></div>` : ''}</div>`;
    if (ctx.onPhase) ctx.onPhase(st.phase);
    const x = el.querySelector('#ftExit');
    if (x) x.addEventListener('click', () => { stopAudio(); if (ctx.onDone) ctx.onDone(); });
  }

  function drawSkipped() {
    shell(`<div class="card sess-card"><p class="big-line">Bước này cần khoá Gemini.</p>
      <p class="muted">Để bật nói chuyện tự do: vào <a href="#/settings">Cài đặt</a> và dán khoá Gemini (hoặc token GitHub của repo dữ liệu). Hôm nay bỏ qua, các bước khác vẫn học bình thường.</p></div>`);
  }

  function errorBox(msg, retry) {
    shell(`<div class="card sess-card"><p class="big-line">AI chưa trả lời được.</p><p class="muted small">${esc(msg)}</p>
      <div class="row"><button type="button" class="btn btn-primary" id="ftRetry">Thử lại</button><button type="button" class="btn btn-quiet" id="ftSkip">Bỏ qua bước này</button></div></div>`, true);
    el.querySelector('#ftRetry').addEventListener('click', retry);
    el.querySelector('#ftSkip').addEventListener('click', () => { set({ phase: 'skipped', skipped: true }); if (ctx.standalone && ctx.onDone) ctx.onDone(); else drawSkipped(); });
  }

  async function open() {
    shell('<div class="card sess-card"><p class="muted">Đang tìm một tình huống cho tuần này…</p></div>');
    try {
      const funcs = await weekFunctions(st.week);
      const { data } = await askJSON(openPrompt(funcs, learned()));
      if (!alive()) return;
      if (!data.reply_en) throw new Error('AI không đưa câu mở đầu.');
      set({
        phase: 'chat', scenario_vi: String(data.scenario_vi || 'Trò chuyện đời thường').slice(0, 200), scenario_en: String(data.scenario_en || data.scenario_vi || '').slice(0, 300),
        msgs: [{ role: 'ai', en: String(data.reply_en).slice(0, 300), hint_vi: String(data.hint_vi || '').replace(/^\s*gợi ý\s*[:：]\s*/i, '').slice(0, 200) }],
      });
      drawChat(true);
    } catch (e) { if (alive()) errorBox(e.message, open); }
  }

  function drawChat(speak = false) {
    const last = st.msgs[st.msgs.length - 1];
    const waitingAI = last.role === 'me';
    const canEnd = st.turns >= MIN_END;
    shell(`
      <p class="eyebrow">Nói chuyện tự do · lượt ${Math.min(st.turns + 1, TURNS)}/${TURNS}</p>
      <p class="setting">${esc(st.scenario_vi)}</p>
      <ol class="ft-chat" aria-live="polite">${st.msgs.map((m) => `<li class="ft-msg ${m.role}"><span lang="en">${esc(m.en)}</span></li>`).join('')}${waitingAI ? '<li class="ft-msg ai"><span class="muted">…</span></li>' : ''}</ol>
      ${!waitingAI && last.hint_vi ? `<p class="ft-hint">Gợi ý: ${esc(last.hint_vi)}</p>` : ''}
      <div class="card sess-card ft-input">
        <input id="ftIn" class="input" type="text" lang="en" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Gõ hoặc nói câu tiếng Anh…" ${waitingAI ? 'disabled' : ''}>
        <div id="ftHeard"></div>
        <div class="row">
          ${sttSupported() ? '<button type="button" class="btn" id="ftSay">Nói (máy nghe chép)</button>' : ''}
          <button type="button" class="btn" id="ftReplay">Nghe lại</button>
          <button type="button" class="btn btn-primary" id="ftSend" ${waitingAI ? 'disabled' : ''}>Gửi</button>
        </div>
        ${canEnd ? '<button type="button" class="btn btn-quiet btn-sm" id="ftEnd" style="align-self:flex-start">Kết thúc và xem nhận xét</button>' : ''}
      </div>`);
    const input = el.querySelector('#ftIn');
    const send = async () => {
      const txt = input.value.trim();
      if (!txt) return;
      st.msgs.push({ role: 'me', en: txt.slice(0, 300) });
      st.turns += 1;
      persist();
      if (st.turns >= TURNS) { set({ phase: 'feedback' }); await finish(); return; }
      drawChat();
    };
    el.querySelector('#ftSend').addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    el.querySelector('#ftReplay').addEventListener('click', () => { const a = [...st.msgs].reverse().find((m) => m.role === 'ai'); if (a) play({ text: a.en }); });
    const say = el.querySelector('#ftSay');
    if (say) say.addEventListener('click', async () => {
      say.disabled = true; say.textContent = 'Đang nghe…';
      const heard = await listenOnce();
      if (!alive()) return;
      say.disabled = false; say.textContent = 'Nói lại';
      if (heard.length) { input.value = heard[0]; el.querySelector('#ftHeard').innerHTML = '<p class="muted small">Máy chép được: sửa lại nếu nghe nhầm rồi bấm Gửi.</p>'; } else el.querySelector('#ftHeard').innerHTML = '<p class="muted small">Máy chưa nghe được. Gõ câu của bạn vào ô trên.</p>';
    });
    const end = el.querySelector('#ftEnd');
    if (end) end.addEventListener('click', () => { set({ phase: 'feedback' }); finish(); });
    if (speak && !waitingAI) play({ text: last.en });
    if (waitingAI) reply();
    else if (!speak) input.focus({ preventScroll: true });
  }

  async function reply() {
    try {
      const { data } = await askJSON(turnPrompt(st, learned()));
      if (!alive()) return;
      if (!data.reply_en) throw new Error('AI không trả lời nội dung.');
      st.msgs.push({ role: 'ai', en: String(data.reply_en).slice(0, 300), hint_vi: String(data.hint_vi || '').replace(/^\s*gợi ý\s*[:：]\s*/i, '').slice(0, 200) });
      persist();
      drawChat(true);
    } catch (e) { if (alive()) errorBox(e.message, () => { drawChat(); }); }
  }

  async function finish() {
    shell('<div class="card sess-card"><p class="muted">Đang viết nhận xét…</p></div>');
    try {
      const { data } = await askJSON(feedbackPrompt(st, learned()));
      if (!alive()) return;
      const fix = (Array.isArray(data.fix) ? data.fix : []).filter((f) => f && f.said && f.better).slice(0, 3).map((f) => ({
        said: String(f.said).slice(0, 200), better: String(f.better).slice(0, 200), note_vi: String(f.note_vi || '').slice(0, 200), chunkIds: Array.isArray(f.chunkIds) ? f.chunkIds.map(String) : [],
      }));
      st.feedback = { good: (Array.isArray(data.good) ? data.good : []).map(String).slice(0, 3), fix, summary_vi: String(data.summary_vi || '').slice(0, 300) };
      st.pushed = saveFreeTalk(st);
      set({ phase: 'done' });
      drawResult();
    } catch (e) {
      if (alive()) errorBox(e.message, finish);
    }
  }

  function drawResult() {
    const fb = st.feedback || { good: [], fix: [], summary_vi: '' };
    shell(`
      <p class="eyebrow">Nói chuyện tự do · nhận xét</p>
      <div class="card sess-card">
        <p class="big-line">${esc(fb.summary_vi || 'Bạn đã nói chuyện xong một tình huống.')}</p>
        ${fb.good.length ? `<ul class="wk-list">${fb.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${fb.fix.length ? `<p class="muted small">Có thể nói tốt hơn${(st.pushed || []).length ? ' (các cụm liên quan sẽ quay lại thẻ ôn ngày mai)' : ''}:</p>
          <ul class="ft-fix">${fb.fix.map((f) => `<li><span class="err-wrong" lang="en">${esc(f.said)}</span><br><span class="err-right" lang="en">${esc(f.better)}</span><br><span class="small muted">${esc(f.note_vi)}</span></li>`).join('')}</ul>` : '<p class="muted small">Không có lỗi nào đáng sửa.</p>'}
      </div>`);
  }
}
