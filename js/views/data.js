import { db, exportPayload, validateImport, replaceAll, resetAll, isStorageOk } from '../store.js';
import { today, totalMinutes, fmtHours } from '../util.js';
import { toast, confirmModal, openModal } from '../ui.js';

let root;

function render() {
  const d = db();
  root.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Dữ liệu</div>
      <h1>Dữ liệu của bạn</h1>
      <p class="lede">Mọi thứ chỉ nằm trong trình duyệt này (localStorage), không gửi đi đâu. Muốn chuyển giữa điện thoại và máy Mac: xuất file ở máy này, nhập file ở máy kia.</p>
    </div>

    ${isStorageOk() ? '' : '<div class="notice" style="margin-bottom:16px">Trình duyệt đang chặn lưu dữ liệu (có thể do chế độ ẩn danh). Dữ liệu sẽ mất khi đóng trang, hãy xuất file thường xuyên.</div>'}

    <div class="kpis">
      <div class="stat"><span class="num">${fmtHours(totalMinutes())}</span><span class="k">giờ đã ghi</span></div>
      <div class="stat"><span class="num">${d.sessions.length}</span><span class="k">lượt học</span></div>
      <div class="stat"><span class="num">${d.phrases.length}</span><span class="k">cụm từ</span></div>
      <div class="stat"><span class="num">${d.errors.length}</span><span class="k">lỗi đã lưu</span></div>
    </div>

    <section class="section card stack">
      <h3>Xuất dữ liệu</h3>
      <p class="muted small" style="margin:0">Tải về một file .json. Nên làm mỗi tuần một lần để dự phòng.</p>
      <div><button type="button" class="btn btn-primary" id="exportBtn">Xuất file JSON</button></div>
    </section>

    <section class="section card stack">
      <h3>Nhập dữ liệu</h3>
      <p class="muted small" style="margin:0">Chọn file đã xuất từ máy khác. Dữ liệu hiện tại ở máy này sẽ được <b>thay hoàn toàn</b>.</p>
      <div><label class="btn" for="importFile">Chọn file JSON…</label>
      <input type="file" id="importFile" accept="application/json,.json" hidden></div>
    </section>

    <section class="section card stack">
      <h3>Xoá hết</h3>
      <p class="muted small" style="margin:0">Xoá toàn bộ giờ học, cụm từ, lỗi, điểm thi trên máy này.</p>
      <div><button type="button" class="btn btn-danger" id="resetBtn">Xoá toàn bộ dữ liệu…</button></div>
    </section>`;

  root.querySelector('#exportBtn').addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `english-daily-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('Đã xuất file.');
    } catch (e) {
      toast('Không xuất được file.');
    }
  });

  root.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (err) { toast('File không đọc được (không phải JSON).'); return; }
    const err = validateImport(obj);
    if (err) { toast(err); return; }
    const data = obj.data || obj;
    const ok = await confirmModal({
      title: 'Thay dữ liệu hiện tại?',
      message: `File có ${(data.sessions || []).length} lượt học, ${(data.phrases || []).length} cụm từ, ${(data.errors || []).length} lỗi. Dữ liệu đang có trên máy này sẽ bị thay thế.`,
      confirmLabel: 'Nhập và thay thế',
    });
    if (!ok) return;
    replaceAll(obj);
    toast('Đã nhập dữ liệu.');
  });

  root.querySelector('#resetBtn').addEventListener('click', () => {
    openModal({
      title: 'Xoá toàn bộ dữ liệu?',
      html: `<p>Không hoàn tác được. Nếu chưa xuất file dự phòng, hãy xuất trước.</p>
        <div class="field"><label for="confirmText">Gõ <b>XOÁ</b> để xác nhận</label><input id="confirmText" class="input" autocomplete="off"></div>`,
      actions: [
        { label: 'Huỷ' },
        {
          label: 'Xoá hết', kind: 'danger', onClick: (box) => {
            const v = box.querySelector('#confirmText').value.trim().toUpperCase();
            if (!['XOÁ', 'XÓA', 'XOA'].includes(v.normalize('NFC'))) { toast('Gõ XOÁ để xác nhận.'); return false; }
            resetAll();
            toast('Đã xoá toàn bộ dữ liệu.');
          },
        },
      ],
    });
  });
}

export function mount(el) { root = el; }
export function show() { render(); }
export function onData() { render(); }
