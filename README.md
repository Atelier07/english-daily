# English Daily

Ứng dụng web tĩnh để học tiếng Anh mỗi ngày, từ khoảng A2 lên B2 (TOEIC 750+). Mục tiêu: khoảng 600 giờ đến giữa 2028.
Không cần tài khoản, không có máy chủ, không cần API key. Dữ liệu chỉ nằm trong trình duyệt của bạn.

## Mỗi ngày dùng thế nào

Mở tab **Hôm nay**. Có bốn việc, mỗi việc có nút **Bắt đầu / Dừng & ghi** để bấm giờ:

1. **Nghe/đọc thứ bạn thích** (30–45 phút): video, podcast, bài viết tiếng Anh về AI, công nghệ, piano… Hiểu khoảng 70–90% là vừa.
2. **Shadowing** (10–15 phút): tab Shadowing → dán link YouTube → đặt điểm A, B quanh một câu → lặp câu → ghi âm → So sánh.
3. **Nói ra** (10 phút): tab Nói → đọc đề hôm nay → Bắt đầu nói → nói 2–5 phút → Copy để nhờ AI sửa → lưu 1–2 lỗi vào “Lỗi của tôi”.
4. **Ôn cụm từ** (5–10 phút): tab Cụm từ → Ôn thẻ. Nhìn nghĩa tiếng Việt, **nói to** cụm tiếng Anh, rồi lật thẻ và tự chấm Quên / Khó / Nhớ.

- Chỉ cần **15 phút** một ngày là ngày đó được tính vào chuỗi (ngày tối thiểu). Ngày bận, làm một việc dễ nhất là đủ.
- Xem video tiếng Anh ở chỗ khác? Bấm **+ Nhập giờ thủ công** ở tab Hôm nay.
- Quên tắt đồng hồ: một lượt bấm giờ chỉ ghi tối đa 3 giờ. Lượt ghi sai có thể xoá trong “Đã ghi hôm nay”.

### Nhặt cụm từ
Tab Cụm từ → Nhặt cụm → dán đoạn tiếng Anh (transcript YouTube, bài viết, tài liệu) → Bắt đầu đọc → bôi đen 2–6 từ → **Lưu cụm**.
Ứng dụng tự lấy cả câu gốc chứa cụm đó. Bạn gõ nghĩa tiếng Việt theo cách mình hiểu (mặt trước thẻ sẽ hiện dòng này).

### Lỗi của tôi
Thay cho việc học ngữ pháp theo sách: chỉ ghi những lỗi bạn thật sự lặp lại khi nói (sai → đúng, ghi chú). Gặp lại thì bấm “+1 lần gặp”.
Khi nói đúng tự nhiên được vài buổi liền, đánh dấu “đã sửa được”.

### Mốc
Biểu đồ giờ học 12 tuần, tổng giờ / 600, chuỗi ngày, số cụm từ, và nhật ký điểm TOEIC thi thử (nên thi thử 3 tháng một lần).

## Chuyển dữ liệu giữa điện thoại và Mac

Dữ liệu nằm trong `localStorage` của từng trình duyệt, nên điện thoại và Mac **không tự đồng bộ**.

1. Ở máy đang có dữ liệu: **Khác → Dữ liệu → Xuất file JSON** (tải về `english-daily-YYYY-MM-DD.json`).
2. Gửi file sang máy kia (AirDrop, Zalo, Drive…).
3. Ở máy kia: **Dữ liệu → Chọn file JSON…** → xác nhận. Dữ liệu ở máy này sẽ bị **thay hoàn toàn** bằng dữ liệu trong file.

Nên xuất file mỗi tuần một lần để dự phòng. Nút “Xoá toàn bộ dữ liệu” cần gõ XOÁ để xác nhận.

## Vì sao cách này hiệu quả (tóm tắt)

- **Comprehensible input (Krashen)**: ngôn ngữ được thu nạp chủ yếu khi bạn hiểu được thứ mình nghe/đọc. Nên phần lớn thời gian là nghe/đọc thứ bạn thích.
- **Shadowing**: nói đè theo bản ghi luyện nhịp, trọng âm, nối âm; có ích cho nghe và phát âm, nhưng không thay được việc nghe nhiều.
- **Retrieval practice + spaced repetition**: tự nhớ lại (nói ra trước khi lật thẻ) và ôn đúng lúc sắp quên giúp nhớ lâu với ít thời gian.
- **Output hypothesis (Swain)**: phải nói ra mới thấy chỗ mình chưa biết cách diễn đạt.
- **Học từ lỗi của chính mình**: sửa ít lỗi, đúng lỗi mình lặp lại, có ích hơn học dàn trải.

Chi tiết nằm ở trang “Vì sao cách này hiệu quả” trong ứng dụng. Con số 600 giờ là ước tính, không phải lời hứa.

## Đồng bộ GitHub và AI (tuỳ chọn)

Không bật thì app vẫn chạy đủ, dữ liệu chỉ nằm trên máy. Bật thì dữ liệu được lưu vào một repo **riêng tư** của bạn và tự gộp giữa điện thoại và Mac.

### 1. Tạo repo dữ liệu
Tạo repo **Private** tên `english-daily-data` (owner mặc định `Atelier07`; đổi được trong Cài đặt). Có thể để trống, app sẽ tự tạo `data.json` và `progress.md`.

### 2. Tạo fine-grained token
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Resource owner: tài khoản của bạn. Expiration: tuỳ (ví dụ 1 năm).
3. Repository access: **Only select repositories** → chọn **chỉ** `english-daily-data`.
4. Permissions → Repository permissions → **Contents: Read and write** (Metadata: Read-only tự có). Không cấp gì khác.
5. Tạo, copy token (`github_pat_…`).

### 3. Nhập vào app
Khác → **Cài đặt** → dán token, kiểm tra owner/repo/branch → **Lưu** → **Kiểm tra kết nối**. Làm như vậy trên cả điện thoại và Mac.
Token chỉ lưu trong localStorage của trình duyệt đó, không nằm trong mã nguồn hay repo app.

### 4. Khoá Gemini (cho tính năng AI)
Trong repo **dữ liệu** (không phải repo app), tạo file `config.json`:

```json
{ "geminiKey": "KHOÁ_CỦA_BẠN", "models": [] }
```

`models` để trống thì app dùng danh sách mặc định (gemini-3.8-flash → … → gemini-3.1-flash-lite), tự chuyển model khi một model quá tải, và nhớ model chạy được lần cuối. **Không bao giờ** đưa khoá vào repo app (repo công khai trên GitHub Pages).

### Đồng bộ hoạt động thế nào
- Mở app: tải `data.json` về và gộp. Mỗi lần dữ liệu đổi: chờ khoảng 5 giây rồi ghi lên (mỗi lần là một commit `sync YYYY-MM-DD HH:MM`).
- Gộp theo từng bản ghi: bản sửa sau cùng thắng. Bản ghi bị xoá được nhớ bằng “bia mộ” nên không sống lại ở máy kia.
- Hai máy ghi cùng lúc: app tải lại, gộp, ghi lại (tự thử lại).
- Mất mạng: dấu chấm báo “Ngoại tuyến/Lỗi đồng bộ”, app tự thử lại sau.
- `progress.md`: bản tóm tắt dễ đọc (tổng giờ, tuần này, chuỗi ngày, giai đoạn, lỗi hay gặp, cụm từ, TOEIC gần nhất) cho bạn hoặc một AI mentor đọc.

### Các tính năng AI
- **Nói**: “AI nhận xét” chỉ đưa gợi ý cho 1–2 lỗi quan trọng (ưu tiên lỗi điển hình người Việt: -s, thì/dạng động từ, mạo từ…). Bạn tự sửa trước, rồi mới “Xem đáp án”, rồi lưu vào Lỗi của tôi.
- **Cụm từ**: “AI gợi ý cụm” trên đoạn văn đã dán; “Câu mới” khi lật thẻ (một câu ví dụ khác tình huống, lưu tạm trong ngày).
- **Mốc**: “AI tổng kết tuần” đọc nhật ký 7 ngày.
- **Âm cuối**: “AI giải thích” nguyên nhân có thể và một mẹo. Không bao giờ chấm điểm phát âm.

## Lộ trình và lúc nghi ngờ
- Trang **Lộ trình**: GĐ1 “Nền tai và âm” (11/2026 → 2/2027, ~150 giờ), GĐ2 “Lên B1” (3 → 6/2027, ~200 giờ), GĐ3 “Lên B2” (7/2027 → 3/2028, ~250 giờ), mỗi giai đoạn có điều kiện “xong khi” để đánh dấu, mốc thi thử 3 tháng/lần.
- Luật: **Chỉ xét lại cách học ở ngày mốc. Chỉ đổi khi 2 lần thi thử liền không nhích.**
- Nút **Mình đang nghi ngờ** (Hôm nay, Lộ trình): bằng chứng nghiên cứu cho phần bạn đang nghi ngờ, số liệu của chính bạn, và luật. Mỗi lần mở được ghi lại để tổng kết tuần thấy.

## Thêm từ nghiên cứu
- Sau mỗi lượt nghe/đọc app hỏi “Hiểu khoảng bao nhiêu?”. Hai lần liền dưới 70% → gợi ý tài liệu dễ hơn; ba lần liền trên 95% → gợi ý khó hơn. Mức tốt: hiểu khoảng 90–98%.
- **Nghe chép** (Shadowing, tuỳ chọn): gõ cả câu nghe được, dán câu thật từ phụ đề, app chỉ ra từ sót: từ chức năng, đuôi -s/-ed, từ nội dung. Không phải bài điền chỗ trống.
- **Âm cuối**: cặp từ tối thiểu (want/wants, pay/paid, rice/rise…) đọc ngẫu nhiên, máy nhận giọng nói trả 5 khả năng. Cả 5 đều thiếu âm cuối → nhiều khả năng bạn bỏ âm thật; máy nghe đúng → chưa chắc đã rõ. Thêm phần nhấn âm, nhấn câu, “th” (ưu tiên thấp), ghi âm so với giọng mẫu.
- **Ngày nghỉ có phép**: mỗi tuần một ngày lỡ đơn lẻ được bỏ qua, chuỗi vẫn giữ.
- **Thư viện** theo cấp độ; mỗi cụm từ có link “Nghe người thật nói” (YouGlish).

## Lịch ôn thẻ (SM-2 rút gọn)

- **Quên**: thẻ quay lại cuối buổi ôn hôm nay, lần sau sau 1 ngày; hệ số dễ −0,2.
- **Khó**: 1 ngày → 3 ngày → khoảng cách cũ × 1,2; hệ số dễ −0,15.
- **Nhớ**: 1 ngày → 4 ngày → khoảng cách cũ × hệ số dễ (bắt đầu 2,5, tối đa 3,0, thấp nhất 1,3).
- Khoảng cách tối đa 180 ngày.

## Giới hạn đã biết

- **Nhận giọng nói** (Web Speech API) chạy tốt trên Chrome/Edge máy tính và Chrome Android, cần mạng. Trên iPhone/iPad và Firefox thường không có: ứng dụng vẫn bấm giờ nói, bạn gõ hoặc dùng nút micro đọc chính tả trên bàn phím.
- **Ghi âm shadowing** chỉ giữ trong bộ nhớ tạm, đóng/tải lại trang là mất (cố ý, không lưu giọng nói).
- Một số video YouTube bị chủ kênh **chặn phát nhúng**; khi đó chọn video khác. Tốc độ 0.9× phụ thuộc video có hỗ trợ không (ứng dụng sẽ báo nếu không).
- Đồng bộ cần token GitHub; không có token thì dùng Xuất/Nhập. `data.json` lớn hơn 1 MB sẽ không đọc được qua Contents API (còn rất xa mới tới).
- Tính năng AI cần `config.json` trong repo dữ liệu; Gemini có thể quá tải, khi đó app thử model khác rồi báo lỗi nhẹ.
- Nhận xét phát âm dựa trên bản chép lời của máy: không đáng tin tuyệt đối với âm cuối, nên app chỉ gợi ý, không chấm điểm.
- Cần mở qua `http(s)://` (GitHub Pages hoặc máy chủ tĩnh), không mở trực tiếp bằng `file://` vì dùng ES modules.

## Chạy thử trên máy

```bash
cd english-daily
python3 -m http.server 8000
# mở http://localhost:8000
```

## Cấu trúc

```
index.html            khung trang, điều hướng
css/app.css           giao diện (giấy ấm, grain, chế độ tối)
js/app.js             điều hướng theo #/route, đăng ký service worker
js/store.js           dữ liệu localStorage, xuất/nhập
js/util.js            ngày tháng, thống kê, chuỗi ngày
js/timer.js           đồng hồ bấm giờ (sống qua lần tải lại trang)
js/srs.js             lịch ôn thẻ
js/prompts.js         40 đề nói
js/ui.js              modal trong trang, toast, copy
js/sync.js            đồng bộ GitHub (data.json, progress.md, đọc config.json)
js/ai.js              Gemini Interactions API, đổi model khi lỗi, các lời nhắc
js/summary.js         nội dung progress.md
js/roadmap.js         giai đoạn, mốc, nhịp học
js/evidence.js        bằng chứng nghiên cứu (trang Vì sao, nút nghi ngờ)
js/dictation.js       so câu nghe chép
js/views/*.js         từng màn hình
sw.js                 cache khung ứng dụng (không bao giờ cache YouTube)
manifest.webmanifest  cài lên màn hình chính
icons/                biểu tượng
```
