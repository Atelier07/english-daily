// Gemini qua Interactions API. Khoá lấy từ config.json trong repo dữ liệu (xem sync.js).
// Không bao giờ ghi khoá vào mã nguồn.
import { getConfig } from './sync.js';

export const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const DEFAULT_MODELS = [
  'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash',
  'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite',
];
const LAST_KEY = 'englishDaily.aiModel';
const TIMEOUT = 45000;

export class AIError extends Error {
  constructor(code, message, fatal = false) { super(message); this.code = code; this.fatal = fatal; }
}

export async function hasAI() {
  const c = await getConfig();
  return !!(c && c.geminiKey);
}

export function extractText(j) {
  const out = [];
  const steps = (j && Array.isArray(j.steps)) ? j.steps : [];
  for (const s of steps) {
    if (!s || s.type !== 'model_output') continue; // bỏ qua "thought"
    for (const c of (Array.isArray(s.content) ? s.content : [])) if (c && typeof c.text === 'string') out.push(c.text);
  }
  return out.join('\n').trim();
}

export function parseJSON(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* tiếp */ }
  const starts = ['{', '['].map((c) => t.indexOf(c)).filter((i) => i >= 0);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (starts.length && end > Math.min(...starts)) {
    try { return JSON.parse(t.slice(Math.min(...starts), end + 1)); } catch (e) { /* tiếp */ }
  }
  throw new AIError('parse', 'AI trả lời không đúng định dạng. Thử lại nhé.');
}

const isLite = (m) => /lite/i.test(m);
function modelOrder(cfg, allowLite) {
  let models = Array.isArray(cfg.models) && cfg.models.length ? cfg.models.filter((m) => typeof m === 'string') : DEFAULT_MODELS.slice();
  // Ưu tiên model mạnh: bản lite chỉ dùng khi mọi model mạnh đều hỏng.
  const strong = models.filter((m) => !isLite(m));
  const lite = models.filter(isLite);
  return allowLite ? [...strong, ...lite] : strong.concat(strong.length ? [] : lite);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isBusy = (code, msg) => /unavailable|high demand|503|overload|429|exhausted|rate/i.test(`${code} ${msg}`);

// Gọi một model; quá tải thì thử lại 2 lần (đợi 2s, 5s) trước khi bỏ qua.
async function callModel(cfg, model, prompt) {
  let err = null;
  for (const wait of [0, 2000, 5000]) {
    if (wait) await sleep(wait);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: prompt }),
        signal: ctrl.signal,
      });
      let j = null;
      try { j = await res.json(); } catch (e) { /* ignore */ }
      if (!res.ok || (j && j.error)) {
        const msg = (j && j.error && j.error.message) || `HTTP ${res.status}`;
        const code = (j && j.error && j.error.code) || res.status;
        if (/api key|api_key|permission|unauthenticated/i.test(msg) || res.status === 401) {
          throw new AIError(code, 'Khoá Gemini không hợp lệ hoặc không có quyền.', true);
        }
        err = new AIError(code, msg);
        if (isBusy(code, msg)) continue; // quá tải → đợi rồi thử lại cùng model
        return { err };                  // model không tồn tại / lỗi khác → sang model khác ngay
      }
      const text = extractText(j);
      if (!text) { err = new AIError('empty', 'AI không trả lời nội dung.'); continue; }
      return { text };
    } catch (e) {
      if (e instanceof AIError && e.fatal) throw e;
      err = e.name === 'AbortError' ? new AIError('timeout', 'AI quá 45 giây không trả lời.') : (e instanceof AIError ? e : new AIError('network', 'Không kết nối được Gemini (mạng?).'));
      if (err.code === 'network') return { err };
    } finally {
      clearTimeout(timer);
    }
  }
  return { err };
}

export async function ask(prompt, { allowLite = true, onTry } = {}) {
  const cfg = await getConfig();
  if (!cfg || !cfg.geminiKey) throw new AIError('nokey', 'Chưa có khoá Gemini. Vào Cài đặt, dán khoá Gemini (hoặc dán token GitHub).', true);
  let lastErr = null;
  for (const model of modelOrder(cfg, allowLite)) {
    const r = await callModel(cfg, model, prompt);
    if (onTry) onTry(model, r.err ? r.err.message : 'OK');
    if (r.text) {
      try { localStorage.setItem(LAST_KEY, model); } catch (e) { /* ignore */ }
      return { text: r.text, model };
    }
    lastErr = r.err;
  }
  const busy = lastErr && isBusy(lastErr.code, lastErr.message);
  throw new AIError(lastErr ? lastErr.code : 'fail', busy ? 'Gemini đang quá tải ở mọi model. Thử lại sau ít phút.' : `AI chưa trả lời được: ${lastErr ? lastErr.message : 'lỗi không rõ'}`);
}

// Kiểm tra từng model (cho nút thử ở Cài đặt).
export async function probeModels() {
  const cfg = await getConfig();
  if (!cfg || !cfg.geminiKey) throw new AIError('nokey', 'Chưa có khoá Gemini.', true);
  const models = Array.isArray(cfg.models) && cfg.models.length ? cfg.models : DEFAULT_MODELS;
  const out = [];
  for (const m of models) {
    const r = await callModel(cfg, m, 'Reply with exactly: OK');
    out.push({ model: m, ok: !!r.text, note: r.text ? 'chạy được' : (r.err ? r.err.message : 'lỗi') });
  }
  return out;
}

// Việc cần suy nghĩ (chấm bài, nói chuyện, nhận xét) không dùng bản lite trừ khi chỉ còn nó.
export async function askJSON(prompt, opts = {}) {
  const { text, model } = await ask(prompt, { allowLite: false, ...opts });
  return { data: parseJSON(text), model };
}

// ---------- các lời nhắc ----------
const LEARNER = 'Người học: người Việt 23 tuổi, khoảng A2, đang tự học lên B2 (TOEIC 750). Ghét học ngữ pháp kiểu trường lớp và bài điền chỗ trống.';

export function speakFeedbackPrompt(sentences, promptEn) {
  return `${LEARNER}
Dưới đây là các câu người học vừa NÓI (máy chuyển giọng nói thành chữ, có thể nghe nhầm; bỏ qua lỗi chính tả, dấu câu, viết hoa).

Nhiệm vụ: chọn tối đa 2 lỗi quan trọng nhất hoặc lặp lại nhiều nhất. Ưu tiên lỗi điển hình của người Việt theo thứ tự:
1) thiếu -s/-es (số nhiều, ngôi thứ 3 số ít, sở hữu 's); 2) thì / dạng động từ (-ed, be + V-ing, have + V3, động từ nguyên mẫu sau modal và "to");
3) mạo từ a/an/the; 4) hoà hợp chủ ngữ – động từ; 5) giới từ và cụm từ đi kèm; 6) từ loại.
Không chọn lỗi do máy nghe nhầm. Không dạy ngữ pháp dài.

Với mỗi lỗi:
- "sentence": số thứ tự câu (theo danh sách bên dưới)
- "quote": trích đúng phần người học nói sai (ngắn, nguyên văn)
- "category": tên ngắn tiếng Việt, ví dụ "thiếu -s", "thì động từ", "mạo từ"
- "hint": GỢI Ý tiếng Việt để người học tự sửa, KHÔNG nêu đáp án (ví dụ: "Câu 2: động từ chưa đúng thì — thử tự sửa")
- "right": câu/cụm đúng, tự nhiên, giữ ý người học
- "reason": một câu tiếng Việt ngắn giải thích

Thêm "ending_note": nếu bản chép lời có dấu hiệu thiếu âm cuối (-s, -ed, -t, -d) ở nhiều chỗ, viết 1 câu tiếng Việt nói rằng đó CÓ THỂ là do phát âm chưa rõ âm cuối, nhưng máy chép lời không đáng tin ở điểm này. Nếu không có, để "".

Chỉ trả về JSON, không thêm chữ nào khác:
{"items":[{"sentence":1,"quote":"","category":"","hint":"","right":"","reason":""}],"ending_note":""}

Đề người học nói: ${promptEn}
Các câu:
${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

export function phraseSuggestPrompt(text) {
  return `${LEARNER}
Từ đoạn tiếng Anh dưới đây, chọn 5–8 cụm từ / collocation hữu ích để người học A2–B1 tự nói được (2–6 từ, không chọn từ đơn lẻ, ưu tiên cụm dùng nhiều trong đời sống và công việc, cụm mà dịch từng chữ sang tiếng Việt sẽ sai).
Với mỗi cụm: "phrase" (đúng nguyên văn như trong đoạn), "meaning" (nghĩa tiếng Việt ngắn, tự nhiên), "sentence" (câu gốc NGUYÊN VĂN trong đoạn chứa cụm đó).
Chỉ trả về JSON: {"phrases":[{"phrase":"","meaning":"","sentence":""}]}

Đoạn văn:
"""
${text.slice(0, 12000)}
"""`;
}

export function newSentencePrompt(phrase, sentence, meaning) {
  return `${LEARNER}
Viết MỘT câu ví dụ tiếng Anh mới, tự nhiên, ngắn (dưới 18 từ, trình độ A2–B1), dùng cụm "${phrase}" trong một tình huống KHÁC với câu gốc: "${sentence}".${meaning ? ` Nghĩa người học ghi: "${meaning}".` : ''}
Kèm nghĩa tiếng Việt của câu.
Chỉ trả về JSON: {"en":"","vi":""}`;
}

export function weeklyPrompt(summary) {
  return `${LEARNER}
Đây là nhật ký 7 ngày qua của người học (số liệu thật từ app). Hãy tổng kết NGẮN bằng tiếng Việt, giọng bình tĩnh, không sáo rỗng, không khen quá, KHÔNG bịa số liệu (chỉ dùng số có trong nhật ký).
- "went_well": 1–3 điều làm tốt (cụ thể, dựa trên số liệu)
- "focus": đúng 1–2 việc nên tập trung tuần tới (hành động cụ thể, nhỏ)
- "material": 1 câu gợi ý độ khó tài liệu (dựa vào mức hiểu đã ghi: mục tiêu hiểu khoảng 90–98%)
- "doubt_note": nếu có ghi nhận lúc nghi ngờ, 1 câu nhắc nhẹ dựa trên số liệu; nếu không có thì ""
Chỉ trả về JSON: {"went_well":[],"focus":[],"material":"","doubt_note":""}

Nhật ký:
${summary}`;
}

export function endingCoachPrompt(target, partner, alternatives, setName) {
  return `${LEARNER}
Bài luyện: người học đọc to một từ đơn lẻ. Từ cần đọc: "${target}" (cặp tối thiểu với "${partner}", nhóm: ${setName}).
Máy nhận giọng nói (không đáng tin tuyệt đối) nghe ra các khả năng: ${alternatives.map((a) => `"${a}"`).join(', ') || '(không có)'}.
Hãy giải thích bằng tiếng Việt, thật ngắn:
- "cause": nguyên nhân CÓ THỂ (1–2 câu), liên hệ đặc điểm tiếng Việt (ví dụ: tiếng Việt chỉ có vài phụ âm cuối và không bật hơi chúng). Nói rõ đây là phỏng đoán từ bản chép lời.
- "tip": MỘT mẹo đặt lưỡi/môi/hơi cụ thể để tập ngay.
Không chấm điểm, không cho điểm số.
Chỉ trả về JSON: {"cause":"","tip":""}`;
}

// Kiểm tra tuần: chấm các câu người học tự nói/gõ theo tình huống tiếng Việt.
export function weeklyCheckPrompt(rows, week) {
  return `${LEARNER}
Đây là bài KIỂM TRA TUẦN ${week} (tiếng Anh rất cơ bản). Mỗi dòng: một tình huống tiếng Việt, câu mẫu (chỉ là MỘT cách đúng), và câu người học tự nói hoặc gõ. Câu nói có thể do máy chép lời nên nghe nhầm; bỏ qua lỗi chính tả, dấu câu, viết hoa.
Chấm khoan dung: câu đúng nghĩa và tự nhiên thì ĐÚNG dù khác câu mẫu. Chỉ tính là cần sửa khi sai nghĩa, sai ngữ pháp làm khó hiểu, thiếu ý, hoặc để trống.
Trả về:
- "score": điểm 0-100 cho cả bài (tỉ lệ ý nói được, làm tròn)
- "pass": true nếu score >= 70
- "good": 1–3 điều làm tốt, mỗi điều một câu ngắn tiếng Việt
- "fix": các câu cần sửa, mỗi mục {"chunkId": "<id>", "note_vi": "1 câu tiếng Việt: sai gì, nên nói gì"}
- "summary_vi": 1–2 câu ngắn tiếng Việt đơn giản, giọng bình tĩnh, không khen quá
Chỉ trả về JSON: {"score":0,"pass":false,"good":[],"fix":[{"chunkId":"","note_vi":""}],"summary_vi":""}

Các dòng:
${rows.map((r, i) => `${i + 1}. chunkId=${r.chunkId} | tình huống: ${r.vi} | câu mẫu: ${r.model} | người học: ${r.answer || '(để trống)'}`).join('\n')}`;
}
