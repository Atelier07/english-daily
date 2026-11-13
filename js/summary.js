// progress.md: bản tóm tắt dễ đọc cho người (và AI mentor) xem trong repo dữ liệu.
import { db, BLOCKS } from './store.js';
import { today, addDays, totalMinutes, weekMinutes, streakInfo, dueCount, dayMinutes, fmtHours } from './util.js';
import { currentPhase, phaseHours, nextCheckpoint, trend, PHASES, checkState } from './roadmap.js';

const COMP = { lt70: '<70%', '70-90': '70–90%', '90-95': '90–95%', gt95: '>95%' };

export function progressMarkdown(now = new Date()) {
  const t = today();
  const st = streakInfo();
  const p = currentPhase();
  const cp = nextCheckpoint();
  const tr = trend();
  const d = db();
  const lines = [];
  lines.push('# English Daily · tiến độ');
  lines.push('');
  lines.push(`Cập nhật: ${now.toISOString().replace('T', ' ').slice(0, 16)} (UTC)`);
  lines.push('');
  lines.push('## Tổng quan');
  lines.push(`- Tổng giờ: ${fmtHours(totalMinutes())} / 600`);
  lines.push(`- Tuần này: ${fmtHours(weekMinutes())} giờ`);
  lines.push(`- Nhịp 4 tuần gần nhất: ${tr.last.toFixed(1)} giờ/tuần (4 tuần trước: ${tr.prev.toFixed(1)}; ${tr.label})`);
  lines.push(`- Chuỗi ngày: ${st.current} (dài nhất ${st.best})${st.restDays.length ? `, đã dùng ${st.restDays.length} ngày nghỉ có phép` : ''}`);
  lines.push(`- Giai đoạn: ${p.label} "${p.name}" (${p.from} → ${p.to}), ${phaseHours(p).toFixed(1)} / ${p.hours} giờ`);
  lines.push(`- Mốc tiếp theo: ${cp.date} (còn ${cp.days} ngày)`);
  lines.push('');
  lines.push('## 7 ngày gần nhất (phút)');
  lines.push('| Ngày | ' + Object.values(BLOCKS).map((b) => b.short).join(' | ') + ' | Tổng |');
  lines.push('|---|' + Object.keys(BLOCKS).map(() => '---:').join('|') + '|---:|');
  for (let i = 6; i >= 0; i--) {
    const day = addDays(t, -i);
    lines.push(`| ${day} | ` + Object.keys(BLOCKS).map((k) => Math.round(dayMinutes(day, k))).join(' | ') + ` | ${Math.round(dayMinutes(day))} |`);
  }
  lines.push('');
  const comps = d.sessions.filter((s) => s.block === 'input' && s.comp).sort((a, b) => b.ts - a.ts).slice(0, 5);
  if (comps.length) {
    lines.push('## Mức hiểu khi nghe/đọc (gần nhất trước)');
    lines.push(comps.map((s) => `${s.date}: ${COMP[s.comp] || s.comp}`).join(' · '));
    lines.push('');
  }
  lines.push('## Lỗi đang sửa (gặp nhiều nhất)');
  const errs = d.errors.filter((e) => !e.fixed).sort((a, b) => (b.seen || 1) - (a.seen || 1)).slice(0, 5);
  if (errs.length) errs.forEach((e) => lines.push(`- "${e.wrong}" → "${e.right}" (gặp ${e.seen || 1} lần)${e.note ? ` · ${e.note}` : ''}`));
  else lines.push('- (chưa có)');
  lines.push(`- Đã sửa được: ${d.errors.filter((e) => e.fixed).length}`);
  lines.push('');
  lines.push('## Cụm từ');
  const lapsed = d.phrases.filter((x) => x.lapses).sort((a, b) => b.lapses - a.lapses).slice(0, 5);
  lines.push(`- Tổng: ${d.phrases.length}, đến hạn hôm nay: ${dueCount()}`);
  if (lapsed.length) lines.push(`- Hay quên: ${lapsed.map((x) => `${x.phrase} (${x.lapses})`).join(', ')}`);
  lines.push('');
  lines.push('## TOEIC thi thử');
  const toeic = d.toeic.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (toeic.length) toeic.slice(0, 4).forEach((x) => lines.push(`- ${x.date}: ${x.score}${x.note ? ` (${x.note})` : ''}`));
  else lines.push('- (chưa có)');
  lines.push('');
  lines.push('## Mục tiêu giai đoạn');
  for (const ph of PHASES) {
    lines.push(`- ${ph.label} ${ph.name}: ` + ph.done.map((i) => `${checkState(i) ? '[x]' : '[ ]'} ${i.text}`).join('; '));
  }
  const doubts = d.doubts.filter((x) => x.date >= addDays(t, -30));
  if (doubts.length) {
    lines.push('');
    lines.push('## Lúc nghi ngờ (30 ngày)');
    lines.push(doubts.map((x) => `${x.date}: ${x.part}`).join(' · '));
  }
  lines.push('');
  return lines.join('\n');
}
