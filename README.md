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

## Lịch ôn thẻ (SM-2 rút gọn)

- **Quên**: thẻ quay lại cuối buổi ôn hôm nay, lần sau sau 1 ngày; hệ số dễ −0,2.
- **Khó**: 1 ngày → 3 ngày → khoảng cách cũ × 1,2; hệ số dễ −0,15.
- **Nhớ**: 1 ngày → 4 ngày → khoảng cách cũ × hệ số dễ (bắt đầu 2,5, tối đa 3,0, thấp nhất 1,3).
- Khoảng cách tối đa 180 ngày.

## Giới hạn đã biết

- **Nhận giọng nói** (Web Speech API) chạy tốt trên Chrome/Edge máy tính và Chrome Android, cần mạng. Trên iPhone/iPad và Firefox thường không có: ứng dụng vẫn bấm giờ nói, bạn gõ hoặc dùng nút micro đọc chính tả trên bàn phím.
- **Ghi âm shadowing** chỉ giữ trong bộ nhớ tạm, đóng/tải lại trang là mất (cố ý, không lưu giọng nói).
- Một số video YouTube bị chủ kênh **chặn phát nhúng**; khi đó chọn video khác. Tốc độ 0.9× phụ thuộc video có hỗ trợ không (ứng dụng sẽ báo nếu không).
- Không đồng bộ tự động giữa các máy: dùng Xuất/Nhập.
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
js/views/*.js         từng màn hình
sw.js                 cache khung ứng dụng (không bao giờ cache YouTube)
manifest.webmanifest  cài lên màn hình chính
icons/                biểu tượng
```
