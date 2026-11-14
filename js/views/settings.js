import { getSettings, setSettings, testConnection, syncNow, getStatus, onStatus, isConfigured, forgetConfig, loadConfig, getManualKey, setManualKey } from '../sync.js';
import { ask, probeModels } from '../ai.js';
import { esc } from '../util.js';
import { toast, confirmModal } from '../ui.js';
import { getProfile, budget, setBudget } from '../profile.js';
import { BUDGETS, LEVELS } from '../placement.js';
import { planSentence } from '../roadmap.js';

let root;
const LABEL = { off: 'Chỉ lưu trên máy này', syncing: 'Đang đồng bộ…', ok: 'Đã đồng bộ', error: 'Lỗi đồng bộ', offline: 'Ngoại tuyến, sẽ thử lại' };

function statusLine() {
  const st = getStatus();
  const el = root && root.querySelector('#syncState');
  if (!el) return;
  el.dataset.state = st.status;
  el.innerHTML = `<span class="sync-dot"></span> ${esc(LABEL[st.status] || st.status)}${st.lastOk ? ` <span class="muted">· lần cuối ${new Date(st.lastOk).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}${st.message && st.status !== 'ok' ? `<br><span class="small">${esc(st.message)}</span>` : ''}`;
}

function render() {
  const s = getSettings();
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Cài đặt</div>
      <h1>Cài đặt</h1>

    </div>

    <section class="card stack">
      <h3>Học mỗi ngày</h3>
      <div class="chip-group" id="budgetChips">${BUDGETS.map((b) => `<button type="button" class="chip ${b === budget() ? 'on' : ''}" data-budget="${b}">${b} phút</button>`).join('')}</div>
      <p class="small" style="margin:0">${esc(planSentence())}</p>
      <p class="small" style="margin:0">Trình độ xếp lớp: <b>${esc(getProfile() && getProfile().level ? LEVELS.find((l) => l.id === getProfile().level)?.label || getProfile().level : 'chưa làm')}</b></p>
      <div><a class="btn" href="#/placement">Làm lại bài xếp lớp</a></div>
    </section>

    <section class="section card stack">
      <h3>Đồng bộ GitHub <span class="small muted">· không bắt buộc</span></h3>
      <div class="sync-state" id="syncState"></div>
      <div class="field"><label for="ghToken">GitHub token (fine-grained)</label>
        <input id="ghToken" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" value="${esc(s.token)}">
        <span class="muted small">Chỉ lưu trong trình duyệt này. Tạo token chỉ cho repo dữ liệu, quyền Contents: Read and write.</span></div>
      <div class="field-grid">
        <div class="field"><label for="ghOwner">Owner</label><input id="ghOwner" class="input" autocomplete="off" spellcheck="false" value="${esc(s.owner)}"></div>
        <div class="field"><label for="ghRepo">Repo dữ liệu</label><input id="ghRepo" class="input" autocomplete="off" spellcheck="false" value="${esc(s.repo)}"></div>
      </div>
      <div class="field"><label for="ghBranch">Branch</label><input id="ghBranch" class="input" autocomplete="off" spellcheck="false" value="${esc(s.branch)}"></div>
      <div class="row">
        <button type="button" class="btn btn-primary" id="saveGh">Lưu</button>
        <button type="button" class="btn" id="testGh">Kiểm tra kết nối</button>
        <button type="button" class="btn btn-quiet" id="syncGh" ${isConfigured() ? '' : 'disabled'}>Đồng bộ ngay</button>
      </div>
      <div id="testOut" class="small"></div>
    </section>

    <section class="section card stack">
      <h3>AI (Gemini) <span class="small muted">· phần thêm</span></h3>
      <p class="muted small" style="margin:0">Dán khoá Gemini vào đây là AI chạy. Đã dán token GitHub ở trên thì không cần: app tự lấy khoá có sẵn trong repo riêng.</p>
      <div class="field"><label for="gemKey">Khoá Gemini</label>
        <input id="gemKey" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="Dán khoá Gemini" value="${esc(getManualKey())}">
      </div>
      <div class="row">
        <button type="button" class="btn btn-primary" id="saveKey">Lưu khoá</button>
        <button type="button" class="btn btn-quiet" id="testAI">Thử gọi AI</button>
        <button type="button" class="btn btn-quiet" id="reloadCfg" ${isConfigured() ? '' : 'disabled'}>Lấy lại khoá từ repo</button>
      </div>
      <div id="aiOut" class="small"></div>
    </section>

    <section class="section card stack">
      <h3>Ngắt kết nối</h3>
      <p class="muted small" style="margin:0">Xoá token và khoá đã lưu tạm trên máy này. Dữ liệu học vẫn còn trên máy và trong repo.</p>
      <div><button type="button" class="btn btn-danger" id="forgetGh">Ngắt kết nối…</button></div>
    </section>`;

  root.querySelectorAll('[data-budget]').forEach((b) => b.addEventListener('click', () => { setBudget(Number(b.dataset.budget)); toast(`Mỗi ngày ${b.dataset.budget} phút.`); render(); }));
  const val = (id) => root.querySelector(id).value;
  const saveForm = () => setSettings({ token: val('#ghToken'), owner: val('#ghOwner'), repo: val('#ghRepo'), branch: val('#ghBranch') });
  root.querySelector('#saveGh').addEventListener('click', () => {
    saveForm();
    toast(isConfigured() ? 'Đã lưu. Đang đồng bộ…' : 'Đã lưu (chưa có token: chỉ lưu trên máy).');
    if (isConfigured()) { syncNow(); loadConfig(true).catch(() => {}); }
    render();
  });
  root.querySelector('#testGh').addEventListener('click', async (e) => {
    saveForm();
    const out = root.querySelector('#testOut');
    e.target.disabled = true;
    out.textContent = 'Đang kiểm tra…';
    try {
      const r = await testConnection();
      out.innerHTML = `<ul class="plain-list">${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    } catch (err) {
      out.textContent = 'Không kết nối được GitHub. Kiểm tra mạng.';
    }
    e.target.disabled = false;
  });
  root.querySelector('#syncGh').addEventListener('click', () => syncNow());
  root.querySelector('#saveKey').addEventListener('click', () => {
    setManualKey(root.querySelector('#gemKey').value);
    root.querySelector('#aiOut').textContent = getManualKey() ? 'Đã lưu khoá trên máy này.' : 'Đã xoá khoá dán tay.';
  });
  root.querySelector('#reloadCfg').addEventListener('click', async () => {
    const out = root.querySelector('#aiOut');
    try {
      const cfg = await loadConfig(true);
      out.textContent = !cfg ? 'Repo chưa có khoá.' : cfg.geminiKey ? 'Đã lấy khoá từ repo.' : 'Repo chưa có khoá.';
    } catch (err) { out.textContent = err.message || 'Không lấy được khoá từ repo.'; }
  });
  root.querySelector('#testAI').addEventListener('click', async (e) => {
    const out = root.querySelector('#aiOut');
    e.target.disabled = true;
    out.textContent = 'Đang thử từng model Gemini (có thể mất vài chục giây)…';
    try {
      const rows = await probeModels();
      const best = rows.find((r) => r.ok && !/lite/i.test(r.model)) || rows.find((r) => r.ok);
      out.innerHTML = `${best ? `Chấm bài và nói chuyện sẽ dùng: <b>${esc(best.model)}</b>` : '<b>Chưa model nào chạy được.</b>'}<br>${rows.map((r) => `${r.ok ? '✓' : '✗'} ${esc(r.model)}: ${esc(r.note.slice(0, 90))}`).join('<br>')}`;
    } catch (err) { out.textContent = err.message; }
    e.target.disabled = false;
  });
  root.querySelector('#forgetGh').addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Ngắt kết nối GitHub?', message: 'Token và khoá Gemini lưu tạm trên máy này sẽ bị xoá. Dữ liệu học không bị xoá.', confirmLabel: 'Ngắt kết nối', danger: true });
    if (!ok) return;
    setSettings({ token: '', owner: getSettings().owner, repo: getSettings().repo, branch: getSettings().branch });
    forgetConfig();
    syncNow();
    render();
  });
  statusLine();
}

export function mount(el) { root = el; onStatus(statusLine); }
export function show() { render(); }
