// Truyện nghe cuối buổi: course/stories/day-XX.json. Thiếu file thì coi như không có (bỏ bước, không báo lỗi).
const cache = new Map();

export function validateStory(s, n) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.lines)) return null;
  const lines = s.lines.filter((l) => l && l.id && typeof l.en === 'string' && l.en.trim()).map((l) => ({ id: String(l.id), speaker: l.speaker || 'N', en: l.en, vi: l.vi || '' }));
  if (!lines.length) return null;
  const questions = (Array.isArray(s.questions) ? s.questions : []).filter((q) => q && q.q_vi && Array.isArray(q.options_vi) && q.options_vi.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options_vi.length)
    .map((q, i) => ({ ...q, id: q.id || `q${i + 1}` }));
  return { day: s.day || n, story_id: s.story_id || `story${n}`, title_vi: s.title_vi || '', lines, chunks: Array.isArray(s.chunks) ? s.chunks : [], questions };
}

// null nếu chưa có truyện cho ngày đó
export function loadStory(n) {
  if (cache.has(n)) return cache.get(n);
  const p = fetch(`course/stories/day-${String(n).padStart(2, '0')}.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => validateStory(j, n))
    .catch(() => null);
  p.then((v) => { if (!v) cache.delete(n); });
  cache.set(n, p);
  return p;
}
