// Đồng bộ với một repo GitHub RIÊNG TƯ qua Contents API.
//  - data.json   : toàn bộ dữ liệu đồng bộ (bản ghi + bia mộ)
//  - progress.md : bản tóm tắt dễ đọc (ghi mỗi lần đồng bộ có thay đổi)
//  - config.json : {"geminiKey": "...", "models": [...]} do bạn tự tạo, app chỉ ĐỌC
// Token, owner, repo, branch chỉ lưu trong localStorage của trình duyệt này.
import { syncedData, mergeData, applySynced, canonical, onChange } from './store.js';
import { progressMarkdown } from './summary.js';

const SET_KEY = 'englishDaily.gh';
const CFG_KEY = 'englishDaily.cfg';
const API = 'https://api.github.com';
const DEFAULTS = { token: '', owner: 'Atelier07', repo: 'english-daily-data', branch: 'main' };

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SET_KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
export function setSettings(s) {
  const clean = {
    token: String(s.token || '').trim(),
    owner: String(s.owner || DEFAULTS.owner).trim(),
    repo: String(s.repo || DEFAULTS.repo).trim(),
    branch: String(s.branch || DEFAULTS.branch).trim(),
  };
  try { localStorage.setItem(SET_KEY, JSON.stringify(clean)); } catch (e) { /* ignore */ }
  memConfig = null;
  shas = {};
  return clean;
}
export const isConfigured = () => { const s = getSettings(); return !!(s.token && s.owner && s.repo); };

// ---------- trạng thái ----------
let status = 'off';
let statusMsg = '';
let lastOk = null;
const statusListeners = new Set();
export const getStatus = () => ({ status, message: statusMsg, lastOk });
export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
function setStatus(s, msg = '') {
  status = s;
  statusMsg = msg;
  if (s === 'ok') lastOk = Date.now();
  statusListeners.forEach((fn) => { try { fn(getStatus()); } catch (e) { /* ignore */ } });
}

// ---------- base64 an toàn với UTF-8 ----------
export function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decode(b64) {
  const bin = atob(String(b64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

class GHError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function gh(path, opts = {}) {
  const s = getSettings();
  const res = await fetch(`${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}${path}`, {
    ...opts,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${s.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  return res;
}
async function ghFail(res) {
  let msg = `HTTP ${res.status}`;
  try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { /* ignore */ }
  return new GHError(res.status, msg);
}

export async function getFile(name) {
  const s = getSettings();
  const res = await gh(`/contents/${name}?ref=${encodeURIComponent(s.branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await ghFail(res);
  const j = await res.json();
  return { sha: j.sha, text: b64decode(j.content) };
}

export async function putFile(name, text, sha, message) {
  const s = getSettings();
  const body = { message, content: b64encode(text), branch: s.branch };
  if (sha) body.sha = sha;
  const res = await gh(`/contents/${name}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) throw await ghFail(res);
  const j = await res.json();
  return j.content && j.content.sha;
}

function commitMessage(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `sync ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- vòng đồng bộ ----------
let shas = {};
let running = false;
let pending = false;
let debounceT = null;
let retryT = null;
let retryDelay = 0;

export function scheduleSync(ms = 5000) {
  if (!isConfigured()) return;
  clearTimeout(debounceT);
  debounceT = setTimeout(() => syncNow(), ms);
}

function scheduleRetry(fatal) {
  clearTimeout(retryT);
  if (fatal) return;
  retryDelay = Math.min(300000, Math.max(15000, retryDelay * 2));
  retryT = setTimeout(() => syncNow(), retryDelay);
}

async function putProgress() {
  const text = progressMarkdown();
  for (let i = 0; i < 2; i++) {
    try {
      if (!shas.progress) { const f = await getFile('progress.md'); shas.progress = f ? f.sha : null; }
      shas.progress = await putFile('progress.md', text, shas.progress, commitMessage());
      return;
    } catch (e) {
      if (e.status === 409 || e.status === 422) { shas.progress = null; continue; }
      throw e;
    }
  }
}

export async function syncNow() {
  if (!isConfigured()) { setStatus('off'); return false; }
  if (running) { pending = true; return false; }
  running = true;
  clearTimeout(debounceT);
  setStatus('syncing');
  try {
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const remote = await getFile('data.json');
      let remoteData = null;
      if (remote) {
        try { remoteData = JSON.parse(remote.text); } catch (e) { throw new GHError(0, 'data.json trong repo bị hỏng (không phải JSON).'); }
      }
      const local = syncedData();
      const merged = remoteData ? mergeData(local, remoteData) : local;
      const mergedKey = canonical(merged);
      if (canonical(local) !== mergedKey) applySynced(merged);
      if (remoteData && canonical(remoteData) === mergedKey) { shas.data = remote.sha; done = true; break; }
      try {
        const payload = { ...merged, savedAt: new Date().toISOString() };
        shas.data = await putFile('data.json', JSON.stringify(payload), remote ? remote.sha : undefined, commitMessage());
        await putProgress();
        done = true;
      } catch (e) {
        if (e.status === 409 || e.status === 422) continue; // có máy khác vừa ghi: tải lại, gộp, thử lại
        throw e;
      }
    }
    if (!done) throw new GHError(409, 'Xung đột ghi nhiều lần liền, sẽ thử lại.');
    retryDelay = 0;
    clearTimeout(retryT);
    setStatus('ok');
    return true;
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const fatal = e.status === 401 || e.status === 403 || e.status === 404;
    let msg = e.message || 'Lỗi không rõ';
    if (e.status === 401) msg = 'Token không hợp lệ hoặc đã hết hạn.';
    else if (e.status === 403) msg = 'Token không có quyền ghi vào repo này (cần Contents: Read and write).';
    else if (e.status === 404) msg = 'Không thấy repo hoặc nhánh. Kiểm tra owner/repo/branch và quyền của token.';
    else if (e instanceof TypeError) msg = 'Không kết nối được GitHub (mạng?). Sẽ tự thử lại.';
    setStatus(offline ? 'offline' : 'error', msg);
    scheduleRetry(fatal);
    return false;
  } finally {
    running = false;
    if (pending) { pending = false; scheduleSync(1000); }
  }
}

export async function testConnection() {
  const s = getSettings();
  const lines = [];
  if (!s.token) return { ok: false, lines: ['Chưa nhập token.'] };
  const res = await gh('');
  if (!res.ok) {
    const e = await ghFail(res);
    if (e.status === 401) return { ok: false, lines: ['Token không hợp lệ hoặc đã hết hạn.'] };
    if (e.status === 404) return { ok: false, lines: [`Không thấy repo ${s.owner}/${s.repo} (hoặc token không được cấp quyền vào repo này).`] };
    return { ok: false, lines: [`GitHub báo lỗi: ${e.message}`] };
  }
  const repo = await res.json();
  lines.push(`Kết nối được ${repo.full_name}${repo.private ? ' (riêng tư)' : ' — CẢNH BÁO: repo đang công khai, nên chuyển sang Private'}.`);
  if (repo.permissions && repo.permissions.push === false) lines.push('Token chỉ có quyền đọc: cần Contents: Read and write để lưu dữ liệu.');
  try {
    const data = await getFile('data.json');
    lines.push(data ? 'Đã có data.json.' : 'Chưa có data.json (sẽ được tạo ở lần đồng bộ đầu).');
  } catch (e) { lines.push(`Không đọc được data.json: ${e.message}`); }
  try {
    const cfg = await loadConfig(true);
    if (!cfg) lines.push('Chưa có config.json: các tính năng AI sẽ tắt.');
    else lines.push(cfg.geminiKey ? `Repo có khoá Gemini${Array.isArray(cfg.models) && cfg.models.length ? `, ${cfg.models.length} model tự chọn` : ''}.` : 'Repo chưa có khoá Gemini (dán khoá ở mục AI).');
  } catch (e) { lines.push(`config.json lỗi: ${e.message}`); }
  return { ok: true, lines };
}

// ---------- config.json (khoá Gemini) ----------
let memConfig = null;
export async function loadConfig(force = false) {
  if (!isConfigured()) return null;
  if (memConfig && !force) return memConfig;
  const f = await getFile('config.json');
  if (!f) { memConfig = null; try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ } return null; }
  let cfg;
  try { cfg = JSON.parse(f.text); } catch (e) { throw new Error('config.json không phải JSON hợp lệ.'); }
  memConfig = cfg && typeof cfg === 'object' ? cfg : null;
  try { localStorage.setItem(CFG_KEY, JSON.stringify(memConfig)); } catch (e) { /* ignore */ }
  return memConfig;
}
export const MANUAL_KEY = 'ed.geminiKey.manual';
export function getManualKey() { try { return (localStorage.getItem(MANUAL_KEY) || '').trim(); } catch (e) { return ''; } }
export function setManualKey(k) { try { k ? localStorage.setItem(MANUAL_KEY, k.trim()) : localStorage.removeItem(MANUAL_KEY); } catch (e) { /* ignore */ } }
export async function getConfig() {
  const manual = getManualKey();
  const base = await getRepoConfig();
  if (manual) return { ...(base || {}), geminiKey: manual };
  return base;
}
async function getRepoConfig() {
  if (memConfig) return memConfig;
  try {
    const cached = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (cached) { memConfig = cached; return cached; }
  } catch (e) { /* ignore */ }
  try { return await loadConfig(); } catch (e) { return null; }
}
export function forgetConfig() {
  memConfig = null;
  try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ }
}

// ---------- khởi động ----------
export function initSync() {
  onChange((_, info) => { if (info && info.local && info.synced) scheduleSync(5000); });
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { if (isConfigured()) syncNow(); });
  }
  if (isConfigured()) {
    setStatus('syncing');
    syncNow();
    loadConfig(true).catch(() => { /* dùng bản lưu tạm nếu có */ });
  } else {
    setStatus('off');
  }
}
