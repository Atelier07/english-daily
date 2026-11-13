import { db, save, uid } from '../store.js';
import { esc, today, dueCount, viShortDate, daysBetween } from '../util.js';
import { openModal, toast, confirmModal } from '../ui.js';
import { newCard, apply, preview, intervalLabel } from '../srs.js';
import { logMinutes } from '../timer.js';

let root;
let tab = 'pick';
let lastSel = null;          // {phrase, sentence}
let barPressed = false;
let hideT = null;
let review = null;           // {queue:[ids], idx, revealed, again:Set, done, startedAt}

// ---------- tiện ích ----------
function sentenceAround(text, start, end) {
  let s = start;
  while (s > 0) {
    const c = text[s - 1];
    if (c === '\n') break;
    if (/[.!?]/.test(c) && /\s/.test(text[s] || ' ')) break;
    s--;
  }
  let e = end;
  while (e < text.length) {
    const c = text[e];
    if (c === '\n') break;
    e++;
    if (/[.!?]/.test(c) && (e >= text.length || /\s/.test(text[e]))) break;
  }
  return text.slice(s, e).replace(/\s+/g, ' ').trim();
}

export function highlight(sentence, phrase) {
  const i = sentence.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0 || !phrase) return esc(sentence);
  return esc(sentence.slice(0, i)) + '<mark>' + esc(sentence.slice(i, i + phrase.length)) + '</mark>' + esc(sentence.slice(i + phrase.length));
}

function speakEn(text) {
  try {
    if (!('speechSynthesis' in window)) { toast('Máy này không đọc được văn bản.'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('en-US'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

function dueLabel(p) {
  const d = daysBetween(today(), p.due || today());
  if (d <= 0) return 'đến hạn hôm nay';
  if (d === 1) return 'ôn ngày mai';
  return `ôn sau ${d} ngày (${viShortDate(p.due)})`;
}

// ---------- khung ----------
function renderShell() {
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Cụm từ</div>
      <h1>Nhặt cụm, nói ra để nhớ</h1>
      <p class="lede">Lưu cả câu gốc, không lưu từ đơn lẻ. Khi ôn, bạn nói to cụm tiếng Anh từ nghĩa tiếng Việt rồi mới lật thẻ.</p>
    </div>
    <div class="tabs" role="tablist">
      <button type="button" data-tab="pick" role="tab">Nhặt cụm</button>
      <button type="button" data-tab="review" role="tab">Ôn thẻ</button>
      <button type="button" data-tab="bank" role="tab">Kho cụm</button>
    </div>
    <div id="phBody"></div>
    <div class="select-bar" id="selBar" hidden>
      <span class="q" id="selText"></span>
      <button type="button" class="btn btn-primary btn-sm" id="selSave">Lưu cụm</button>
    </div>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  const bar = root.querySelector('#selBar');
  bar.addEventListener('pointerdown', (e) => { barPressed = true; e.preventDefault(); });
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  root.querySelector('#selSave').addEventListener('click', () => {
    barPressed = false;
    if (lastSel) openSaveModal(lastSel);
    hideBar();
  });
}

function updateTabLabels() {
  if (!root) return;
  const due = dueCount();
  const n = db().phrases.length;
  const labels = { pick: 'Nhặt cụm', review: `Ôn thẻ${due ? ` · ${due}` : ''}`, bank: `Kho cụm · ${n}` };
  root.querySelectorAll('[data-tab]').forEach((b) => {
    b.textContent = labels[b.dataset.tab];
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  });
}

function setTab(t) {
  tab = t;
  hideBar();
  updateTabLabels();
  if (t === 'pick') renderPick();
  else if (t === 'review') { review = null; renderReview(); }
  else renderBank();
}

// ---------- Nhặt cụm ----------
function renderPick() {
  const body = root.querySelector('#phBody');
  const r = db().reader;
  if (!r.text) {
    body.innerHTML = `
      <div class="card">
        <div class="field"><label for="srcText">Dán đoạn tiếng Anh (transcript, bài viết, tài liệu…)</label>
          <textarea id="srcText" class="textarea" rows="8" placeholder="Paste English text here…"></textarea></div>
        <div class="field"><label for="srcLabel">Nguồn (để sau này nhớ gặp ở đâu)</label>
          <input id="srcLabel" class="input" placeholder="vd: Fireship – n8n in 100 seconds"></div>
        <div class="row" style="margin-top:14px">
          <button type="button" class="btn btn-primary" id="startRead">Bắt đầu đọc</button>
          <button type="button" class="btn btn-quiet" id="manualAdd">Thêm cụm thủ công</button>
        </div>
      </div>
      <p class="muted small" style="margin-top:12px">Mẹo: transcript YouTube lấy ở nút “…” → “Hiện bản chép lời” dưới video.</p>`;
    body.querySelector('#startRead').addEventListener('click', () => {
      const text = body.querySelector('#srcText').value.trim();
      if (!text) { toast('Dán một đoạn tiếng Anh trước đã.'); return; }
      db().reader = { text: text.slice(0, 60000), source: body.querySelector('#srcLabel').value.trim() };
      save();
      renderPick();
    });
    body.querySelector('#manualAdd').addEventListener('click', () => openSaveModal({ phrase: '', sentence: '' }));
    return;
  }
  body.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <span class="tag">${esc(r.source || 'Không ghi nguồn')}</span>
      <span class="spacer"></span>
      <button type="button" class="btn btn-quiet btn-sm" id="manualAdd">Thêm thủ công</button>
      <button type="button" class="btn btn-sm" id="newText">Dán đoạn khác</button>
    </div>
    <p class="reader-hint">Bôi đen một cụm (2–6 từ hay nhất) → bấm <b>Lưu cụm</b>. Nên chọn cụm bạn muốn tự nói được.</p>
    <div class="reader" id="reader" lang="en"></div>`;
  body.querySelector('#reader').textContent = r.text;
  body.querySelector('#newText').addEventListener('click', () => { db().reader = { text: '', source: r.source }; save(); renderPick(); });
  body.querySelector('#manualAdd').addEventListener('click', () => openSaveModal({ phrase: '', sentence: '' }));
}

function onSelectionChange() {
  if (!root || root.hidden || tab !== 'pick') return;
  const reader = root.querySelector('#reader');
  const sel = window.getSelection();
  if (!reader || !sel || sel.rangeCount === 0 || sel.isCollapsed) { scheduleHide(); return; }
  const range = sel.getRangeAt(0);
  if (!reader.contains(range.commonAncestorContainer)) { scheduleHide(); return; }
  const phrase = sel.toString().replace(/\s+/g, ' ').trim();
  if (!phrase || phrase.length > 160) { scheduleHide(); return; }
  const text = reader.textContent;
  let start, end;
  if (range.startContainer === reader.firstChild && range.endContainer === reader.firstChild) {
    start = range.startOffset; end = range.endOffset;
  } else {
    start = text.indexOf(sel.toString()); end = start + sel.toString().length;
    if (start < 0) { start = 0; end = 0; }
  }
  lastSel = { phrase, sentence: sentenceAround(text, start, end) || phrase };
  clearTimeout(hideT);
  const bar = root.querySelector('#selBar');
  root.querySelector('#selText').textContent = `“${phrase}”`;
  bar.hidden = false;
}
function scheduleHide() {
  clearTimeout(hideT);
  hideT = setTimeout(() => { if (!barPressed) hideBar(); }, 450);
}
function hideBar() {
  const bar = root && root.querySelector('#selBar');
  if (bar) bar.hidden = true;
}

function openSaveModal({ phrase, sentence, editId }) {
  const existing = editId ? db().phrases.find((p) => p.id === editId) : null;
  const src = existing ? existing.source : (db().reader.source || '');
  openModal({
    title: existing ? 'Sửa cụm' : 'Lưu cụm',
    html: `
      <div class="field"><label for="fPhrase">Cụm tiếng Anh</label>
        <input id="fPhrase" class="input" lang="en" value="${esc(existing ? existing.phrase : phrase)}"></div>
      <div class="field"><label for="fSentence">Câu gốc</label>
        <textarea id="fSentence" class="textarea" lang="en" rows="3" style="min-height:84px">${esc(existing ? existing.sentence : sentence)}</textarea></div>
      <div class="field"><label for="fMeaning">Nghĩa tiếng Việt / tình huống dùng</label>
        <input id="fMeaning" class="input" placeholder="vd: bắt đầu từ con số 0" value="${esc(existing ? existing.meaning : '')}">
        <span class="muted small">Mặt trước thẻ sẽ hiện dòng này. Viết theo cách bạn hiểu, không cần dịch sát.</span></div>
      <div class="field"><label for="fSource">Nguồn</label>
        <input id="fSource" class="input" value="${esc(src)}"></div>`,
    actions: [
      { label: 'Huỷ' },
      {
        label: existing ? 'Lưu thay đổi' : 'Lưu cụm', kind: 'primary', onClick: (box) => {
          const v = (id) => box.querySelector(id).value.trim();
          const p = v('#fPhrase');
          if (!p) { toast('Cụm tiếng Anh đang trống.'); return false; }
          if (existing) {
            Object.assign(existing, { phrase: p, sentence: v('#fSentence') || p, meaning: v('#fMeaning'), source: v('#fSource') });
            save();
            toast('Đã lưu.');
            if (tab === 'bank') renderBank();
            return;
          }
          if (db().phrases.some((x) => x.phrase.toLowerCase() === p.toLowerCase())) {
            toast('Cụm này đã có trong kho.');
            return;
          }
          db().phrases.push({
            id: uid(), phrase: p, sentence: v('#fSentence') || p, meaning: v('#fMeaning'), source: v('#fSource'),
            created: Date.now(), ...newCard(),
          });
          save();
          toast(`Đã lưu “${p}”.`);
          try { window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
        },
      },
    ],
  });
}

// ---------- Ôn thẻ ----------
function buildQueue() {
  const t = today();
  return db().phrases
    .filter((p) => !p.due || p.due <= t)
    .sort((a, b) => (a.due || '').localeCompare(b.due || '') || a.created - b.created)
    .map((p) => p.id);
}

function renderReview() {
  const body = root.querySelector('#phBody');
  if (!review) review = { queue: buildQueue(), idx: 0, revealed: false, again: new Set(), done: 0, startedAt: Date.now() };
  const total = db().phrases.length;

  if (!total) {
    body.innerHTML = `<div class="empty">Kho chưa có cụm nào. Sang <b>Nhặt cụm</b>, dán một đoạn tiếng Anh và bôi đen cụm bạn thích.</div>`;
    return;
  }
  if (review.idx >= review.queue.length) {
    const mins = Math.round((Date.now() - review.startedAt) / 60000);
    const nextDue = db().phrases.map((p) => p.due).filter(Boolean).sort()[0];
    body.innerHTML = `
      <div class="card flash" style="min-height:0">
        <div class="front-label">${review.done ? 'Xong buổi ôn' : 'Không có thẻ đến hạn'}</div>
        <div class="meaning">${review.done ? `Bạn đã ôn ${review.done} lượt thẻ.` : 'Hôm nay không còn thẻ nào cần ôn.'}</div>
        <p class="situation">${nextDue ? `Thẻ gần nhất đến hạn: ${nextDue <= today() ? 'hôm nay' : viShortDate(nextDue)}.` : ''} Nhặt thêm vài cụm mới từ thứ bạn đang xem là cách ôn tốt nhất.</p>
        ${review.done && mins >= 1 ? `<button type="button" class="btn btn-primary" id="logReview">Ghi ${mins} phút vào “Ôn cụm từ”</button>` : ''}
      </div>`;
    const lb = body.querySelector('#logReview');
    if (lb) lb.addEventListener('click', () => { logMinutes('review', mins, { manual: false, note: `${review.done} thẻ` }); lb.disabled = true; lb.textContent = 'Đã ghi'; toast(`Đã ghi ${mins} phút.`); });
    return;
  }

  const card = db().phrases.find((p) => p.id === review.queue[review.idx]);
  if (!card) { review.idx++; renderReview(); return; }
  const left = review.queue.length - review.idx;

  if (!review.revealed) {
    body.innerHTML = `
      <div class="review-progress"><span>Còn ${left} thẻ</span><span>${review.done} đã ôn</span></div>
      <div class="card flash" style="margin-top:8px">
        <div class="front-label">Nói to bằng tiếng Anh</div>
        ${card.meaning
          ? `<div class="meaning">${esc(card.meaning)}</div>`
          : `<div class="meaning muted">Thẻ này chưa có nghĩa tiếng Việt</div>
             <div class="field"><label for="addMeaning">Thêm nghĩa để lần sau ôn được</label>
               <div class="url-row"><input id="addMeaning" class="input" placeholder="nghĩa / tình huống"><button type="button" class="btn" id="saveMeaning">Lưu</button></div></div>`}
        ${card.source ? `<div class="situation">Gặp trong: ${esc(card.source)}</div>` : ''}
        <div class="ask">Nói cụm tiếng Anh ra thành tiếng trước khi lật. Nghĩ mãi không ra cũng được: cố nhớ chính là lúc trí nhớ được củng cố.</div>
        <button type="button" class="btn btn-primary btn-lg btn-block" id="reveal" style="margin-top:auto">Lật thẻ</button>
      </div>`;
    body.querySelector('#reveal').addEventListener('click', () => { review.revealed = true; renderReview(); });
    const sm = body.querySelector('#saveMeaning');
    if (sm) sm.addEventListener('click', () => {
      const v = body.querySelector('#addMeaning').value.trim();
      if (!v) return;
      card.meaning = v; save(); renderReview();
    });
    return;
  }

  const opts = [
    { g: 'forgot', label: 'Quên', cls: 'rate-forgot' },
    { g: 'hard', label: 'Khó', cls: '' },
    { g: 'good', label: 'Nhớ', cls: 'rate-good' },
  ];
  body.innerHTML = `
    <div class="review-progress"><span>Còn ${left} thẻ</span><span>${review.done} đã ôn</span></div>
    <div class="card flash" style="margin-top:8px">
      <div class="front-label">${esc(card.meaning || 'Đáp án')}</div>
      <div class="row"><div class="answer-phrase" lang="en">${esc(card.phrase)}</div>
        <button type="button" class="btn btn-quiet btn-sm" id="say" aria-label="Nghe phát âm">Nghe</button></div>
      <div class="answer-sentence" lang="en">${highlight(card.sentence || card.phrase, card.phrase)}</div>
      <div class="ask">Giờ nói một câu <b>của bạn</b> có dùng cụm này: về hôm nay, công việc, AI, piano…</div>
      <div class="rate-row">
        ${opts.map((o) => `<button type="button" class="btn ${o.cls}" data-grade="${o.g}">${o.label}<small>${o.g === 'forgot' ? 'lại ngay' : intervalLabel(preview(card, o.g).interval)}</small></button>`).join('')}
      </div>
    </div>`;
  body.querySelector('#say').addEventListener('click', () => speakEn(card.phrase));
  body.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => {
    const g = b.dataset.grade;
    apply(card, g);
    save();
    review.done++;
    if (g === 'forgot' && !review.again.has(card.id)) { review.again.add(card.id); review.queue.push(card.id); }
    review.idx++;
    review.revealed = false;
    updateTabLabels();
    renderReview();
  }));
}

// ---------- Kho cụm ----------
let bankQuery = '';
function renderBank() {
  const body = root.querySelector('#phBody');
  const list = db().phrases.slice().sort((a, b) => b.created - a.created);
  if (!list.length) {
    body.innerHTML = `<div class="empty">Chưa có cụm nào. Sang <b>Nhặt cụm</b> để bắt đầu.</div>`;
    return;
  }
  body.innerHTML = `
    <input id="bankQ" class="input" type="search" placeholder="Tìm cụm, nghĩa, nguồn…" value="${esc(bankQuery)}" style="margin-bottom:12px">
    <div class="card" id="bankList"></div>`;
  const draw = () => {
    const q = bankQuery.toLowerCase();
    const items = list.filter((p) => !q || [p.phrase, p.meaning, p.source, p.sentence].join(' ').toLowerCase().includes(q));
    const box = body.querySelector('#bankList');
    box.innerHTML = items.length ? items.map((p) => `
      <div class="phrase-item">
        <div><div class="p" lang="en">${esc(p.phrase)}</div><div class="m">${esc(p.meaning || '— chưa có nghĩa')}</div></div>
        <div class="row" style="gap:4px;align-items:flex-start">
          <button type="button" class="btn btn-quiet btn-sm" data-edit="${p.id}">Sửa</button>
          <button type="button" class="btn btn-quiet btn-sm btn-danger" data-del="${p.id}">Xoá</button>
        </div>
        <div class="s" lang="en">${highlight(p.sentence || '', p.phrase)}</div>
        <div class="meta">${p.source ? `<span class="tag">${esc(p.source)}</span>` : ''}<span>${dueLabel(p)}</span>${p.lapses ? `<span>· quên ${p.lapses} lần</span>` : ''}</div>
      </div>`).join('') : `<p class="muted">Không tìm thấy.</p>`;
    box.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openSaveModal({ editId: b.dataset.edit })));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = db().phrases.find((x) => x.id === b.dataset.del);
      const ok = await confirmModal({ title: 'Xoá cụm này?', message: `“${esc(p.phrase)}” sẽ bị xoá khỏi kho và lịch ôn.`, confirmLabel: 'Xoá', danger: true });
      if (!ok) return;
      db().phrases = db().phrases.filter((x) => x.id !== p.id);
      save();
      renderBank();
    }));
  };
  body.querySelector('#bankQ').addEventListener('input', (e) => { bankQuery = e.target.value; draw(); });
  draw();
}

export function mount(el) {
  root = el;
  renderShell();
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('pointerup', () => { barPressed = false; });
}
export function show() {
  const wantReview = location.hash.includes('review');
  if (wantReview) { tab = 'review'; review = null; history.replaceState(null, '', '#/phrases'); }
  updateTabLabels();
  if (tab === 'pick') renderPick();
  else if (tab === 'review') { if (!review || review.idx >= review.queue.length) review = null; renderReview(); }
  else renderBank();
}
export function hide() { hideBar(); }
export function onData() { updateTabLabels(); }
