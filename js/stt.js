// Nhận giọng nói (tuỳ chọn) + so sánh khoan dung. Không bao giờ chặn người học.
const SRc = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = () => typeof window !== 'undefined' && !!SRc();

export function listenOnce({ maxAlternatives = 3, timeout = 12000 } = {}) {
  return new Promise((resolve) => {
    const SR = SRc();
    if (!SR) { resolve([]); return; }
    let got = [];
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(got); } };
    try {
      const r = new SR();
      r.lang = 'en-US';
      r.maxAlternatives = maxAlternatives;
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (e) => {
        const res = e.results[0];
        got = [];
        for (let i = 0; i < res.length; i++) got.push(res[i].transcript.trim());
      };
      r.onerror = finish;
      r.onend = finish;
      r.start();
      setTimeout(() => { try { r.stop(); } catch (e) { /* ignore */ } finish(); }, timeout);
    } catch (e) { finish(); }
  });
}

const EXPAND = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "what's": 'what is', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not',
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "i'd": 'i would', "i'll": 'i will', "let's": 'let us',
  wanna: 'want to', gonna: 'going to', gotta: 'got to', "isn't": 'is not', "aren't": 'are not', "i've": 'i have',
};

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/…/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => EXPAND[w] || w)
    .join(' ')
    .split(' ')
    .filter(Boolean);
}

// Khớp nếu ≥ 75% từ của một đáp án chấp nhận có trong câu máy nghe được.
export function compare(transcripts, answers) {
  const heard = (Array.isArray(transcripts) ? transcripts : [transcripts]).map(normalize);
  let best = 0;
  for (const ans of answers.filter(Boolean)) {
    const want = normalize(ans);
    if (!want.length) continue;
    for (const h of heard) {
      const pool = h.slice();
      let hit = 0;
      for (const w of want) { const k = pool.indexOf(w); if (k >= 0) { hit++; pool.splice(k, 1); } }
      best = Math.max(best, hit / want.length);
    }
  }
  return { match: best >= 0.75, score: best };
}
