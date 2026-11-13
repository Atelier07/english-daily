import { db } from '../store.js';
import { esc, viShortDate } from '../util.js';
import { loadIndex, loadDay, chunkMap } from '../course.js';
import { currentDay, dayDoneMap, getProfile } from '../profile.js';
import { play, playAll } from '../audio.js';
import { highlightLine } from '../session.js';
import { TARGET_ENCOUNTERS } from '../items.js';

let root;
let tab = 'days';

const lvTag = (lv) => `<span class="tag">${esc(lv || '')}</span>`;

function openable(n) {
  const p = getProfile();
  return !!dayDoneMap()[n] || (p && p.startDay && n < p.startDay);
}

async function renderDays(body) {
  let idx;
  try { idx = await loadIndex(); } catch (e) { body.innerHTML = '<div class="notice">Chưa tải được khoá học.</div>'; return; }
  const done = dayDoneMap();
  const cur = currentDay();
  body.innerHTML = `<ol class="day-list">${idx.map((d) => {
    const st = done[d.day] ? 'done' : d.day === cur ? 'cur' : (openable(d.day) ? 'skip' : 'lock');
    const label = { done: `xong ${viShortDate(done[d.day])}`, cur: 'hôm nay', skip: 'đã bỏ qua', lock: '' }[st];
    const inner = `<span class="dn num">${d.day}</span><span class="dt"><b>${esc(d.title || d.function || '')}</b>${d.function && d.title ? `<span class="small muted">${esc(d.function)}</span>` : ''}</span><span class="ds">${lvTag(d.level)}${label ? `<span class="small ${st === 'cur' ? 'accent' : 'muted'}">${label}</span>` : ''}</span>`;
    return `<li class="day-${st}">${st === 'done' || st === 'skip' ? `<a href="#/course?day=${d.day}">${inner}</a>` : st === 'cur' ? `<a href="#/today">${inner}</a>` : `<div>${inner}</div>`}</li>`;
  }).join('')}</ol>`;
}

async function renderBank(body) {
  const chunks = db().items.filter((i) => i.kind === 'chunk').sort((a, b) => (a.day - b.day) || a.id.localeCompare(b.id));
  if (!chunks.length) { body.innerHTML = '<div class="empty">Học xong ngày đầu tiên, các cụm sẽ hiện ở đây.</div>'; return; }
  const map = await chunkMap().catch(() => new Map());
  const mastered = chunks.filter((c) => c.mastered).length;
  body.innerHTML = `
    <p class="small">${mastered} thuộc · ${chunks.length - mastered} đang học</p>
    <ul class="bank">${chunks.map((c) => {
      const src = map.get(c.id);
      const ex = src && src.examples && src.examples[0];
      return `<li>
        <div class="grow"><p class="en" lang="en">${esc(c.en)}</p><p class="vi">${esc(c.cue)}</p>
          <p class="small muted">Ngày ${c.day} · gặp ${Math.min(c.encounters || 0, 99)}/${TARGET_ENCOUNTERS}${c.type === 'stem' ? ` · thay ô ${(c.okCues || []).length}/3` : ''}</p></div>
        <span class="tag ${c.mastered ? 'tag-moss' : ''}">${c.mastered ? 'thuộc' : 'đang học'}</span>
        <button type="button" class="btn btn-sm icon-btn" data-play='${esc(JSON.stringify({ id: ex ? ex.id : null, text: ex ? ex.en : c.en }))}' aria-label="Nghe">▶</button>
      </li>`;
    }).join('')}</ul>`;
  body.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => play(JSON.parse(b.dataset.play))));
}

async function renderDay(n) {
  let d, map;
  try { d = await loadDay(n); map = await chunkMap(); } catch (e) { root.innerHTML = '<div class="notice">Không tải được ngày này.</div>'; return; }
  if (!openable(n)) { location.hash = '#/course'; return; }
  const lines = d.dialogue.lines;
  root.innerHTML = `
    <a class="btn btn-quiet btn-sm" href="#/course">← Khoá học</a>
    <div class="page-head" style="margin-top:10px">
      <div class="eyebrow">Ngày ${d.day} · ${esc(d.function || '')}</div>
      <h1>${esc(d.title || '')}</h1>
      ${d.intro_vi ? `<p class="lede">${esc(d.intro_vi)}</p>` : ''}
    </div>
    <section class="section">
      <h2>Cụm</h2>
      <ul class="bank">${d.chunks.map((c) => `<li><div class="grow"><p class="en" lang="en">${esc(c.text)}</p><p class="vi">${esc(c.vi)}</p>
        ${c.examples.map((e) => `<p class="small"><span lang="en">${esc(e.en)}</span> <span class="muted">${esc(e.vi)}</span></p>`).join('')}</div>
        <button type="button" class="btn btn-sm icon-btn" data-play='${esc(JSON.stringify({ id: c.examples[0]?.id || null, text: c.examples[0]?.en || c.text }))}' aria-label="Nghe">▶</button></li>`).join('')}</ul>
    </section>
    ${lines.length ? `<section class="section">
      <div class="row"><h2>Hội thoại</h2><span class="spacer"></span><button type="button" class="btn btn-sm" id="playDlg">Nghe cả bài</button></div>
      <p class="setting">${esc(d.dialogue.setting_vi || '')}</p>
      <ol class="dlg">${lines.map((l) => `<li class="dlg-line"><span class="spk">${esc(l.speaker)}</span><div class="dlg-text"><p class="en" lang="en">${highlightLine(l.en, l.chunks, map)}</p><p class="vi">${esc(l.vi)}</p></div>
        <button type="button" class="btn btn-sm icon-btn" data-play='${esc(JSON.stringify({ id: l.id, text: l.en }))}' aria-label="Nghe">▶</button></li>`).join('')}</ol>
    </section>` : ''}`;
  root.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => play(JSON.parse(b.dataset.play))));
  const pd = root.querySelector('#playDlg');
  if (pd) pd.addEventListener('click', () => playAll(lines.map((l) => ({ id: l.id, text: l.en }))));
}

function render() {
  const m = location.hash.match(/day=(\d+)/);
  if (m) { renderDay(Number(m[1])); return; }
  root.innerHTML = `
    <div class="page-head"><div class="eyebrow">Khoá học</div><h1>Từng ngày, từng cụm</h1></div>
    <div class="tabs" role="tablist">
      <button type="button" data-tab="days" class="${tab === 'days' ? 'on' : ''}">Các ngày</button>
      <button type="button" data-tab="bank" class="${tab === 'bank' ? 'on' : ''}">Cụm đã học</button>
    </div>
    <div id="cBody"></div>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  const body = root.querySelector('#cBody');
  if (tab === 'days') renderDays(body); else renderBank(body);
}

export function mount(el) { root = el; }
export function show() { render(); }
