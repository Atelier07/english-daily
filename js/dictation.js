// Nghe chép cả câu: so câu bạn nghe được với câu thật, từng từ (LCS), rồi gắn nhãn chỗ sót:
// từ chức năng (a, the, to, of...), đuôi -s/-ed, hoặc từ nội dung.

export const FUNCTION_WORDS = new Set(`a an the to of for and or but nor in on at by with from about as into onto over under
is are was were be been being am do does did done have has had having can could will would shall should may might must
it its it's that that's this these those you you're your i i'm i've i'll me my we we're our us they they're them their
he he's him his she she's her there there's here so if then than just not don't doesn't didn't isn't aren't wasn't won't can't
no up out off what what's which who how when where why all some any let's gonna wanna gotta also too very really`.split(/\s+/));

export function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

// Hai từ chỉ khác nhau ở đuôi ngữ pháp (-s, -es, -ed, -d, 's, -ies, -ied, phụ âm gấp đôi + ed)?
export function endingPair(a, b) {
  if (!a || !b || a === b) return false;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  const suf = long.slice(short.length);
  if (long.startsWith(short) && ['s', 'es', 'ed', 'd', "'s", "s'"].includes(suf)) return true;
  if (short.endsWith('y') && (long === `${short.slice(0, -1)}ies` || long === `${short.slice(0, -1)}ied`)) return true;
  if (long === `${short}${short.slice(-1)}ed`) return true;
  return false;
}

function lcsOps(R, T) {
  const n = R.length, m = T.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = R[i] === T[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (R[i] === T[j]) { ops.push({ type: 'eq', r: R[i], t: T[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', r: R[i] }); i++; }
    else { ops.push({ type: 'ins', t: T[j] }); j++; }
  }
  while (i < n) ops.push({ type: 'del', r: R[i++] });
  while (j < m) ops.push({ type: 'ins', t: T[j++] });
  return ops;
}

export function diffDictation(real, typed) {
  const R = tokenize(real), T = tokenize(typed);
  const ops = lcsOps(R, T);
  // ghép từ sót với từ gõ thừa trong cùng một khoảng trống để bắt lỗi đuôi
  const items = [];
  const extras = [];
  let gapDel = [], gapIns = [];
  const flush = () => {
    for (const d of gapDel) {
      const k = gapIns.findIndex((t) => !t.used && endingPair(d.r, t.t));
      if (k >= 0) { gapIns[k].used = true; d.item.status = 'ending'; d.item.tag = 'đuôi -s/-ed'; d.item.heard = gapIns[k].t; }
    }
    for (const t of gapIns) if (!t.used) extras.push(t.t);
    gapDel = []; gapIns = [];
  };
  for (const op of ops) {
    if (op.type === 'eq') { flush(); items.push({ word: op.r, status: 'ok' }); continue; }
    if (op.type === 'del') {
      const item = { word: op.r, status: 'missed', tag: FUNCTION_WORDS.has(op.r) ? 'từ chức năng' : 'từ nội dung' };
      items.push(item);
      gapDel.push({ r: op.r, item });
    } else {
      gapIns.push({ t: op.t, used: false });
    }
  }
  flush();
  const counts = { total: R.length, ok: 0, function: 0, ending: 0, content: 0, extra: extras.length };
  for (const it of items) {
    if (it.status === 'ok') counts.ok++;
    else if (it.status === 'ending') counts.ending++;
    else if (it.tag === 'từ chức năng') counts.function++;
    else counts.content++;
  }
  return { items, extras, counts };
}
