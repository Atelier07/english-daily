# HANDOFF — English Daily (cập nhật 2026-11-14)

Đọc file này trước. Web học tiếng Anh riêng cho Tài.

## Đang ở đâu
- 2026-11-14: bản phase 3 ĐÃ LÊN WEB (main 96d8ff3, sw ed-v8) https://atelier07.github.io/english-daily/. Worktree p3 đã xoá, làm thẳng trên main.
- Xem thử local: copy worktree vào scratchpad rồi `python3 -m http.server`.

- 2026-11-15: sửa "đt không nghe được" (main 9eff94c, sw ed-v10): mp3 tăng ~+9.5 dB lên ~-16 LUFS (bản gốc chỉ ở scratchpad, sẽ mất); audio.js dùng MỘT thẻ audio chung, mở khoá ở lần chạm đầu (iOS chặn new Audio() sau await/nối câu). Tài báo vẫn câm → 2026-11-15 sw ed-v11: SW bỏ qua mp3/range (Safari iPhone cần 206), SW fetch cache:'no-cache', toast lỗi khi play() fail. Test Playwright WebKit iPhone trên web thật: phát đủ (nhưng không giống iOS thật). 118 dòng không có mp3 (khung câu "…", vài câu thay ô) → rơi về giọng máy. CHƯA RÕ máy Tài iPhone hay Android.

## Đã xong (đang chạy trên web)
- Khoá 30 ngày (A0 ngày 1–10, A1 ngày 11–30), 180 cụm, course/days + validate.py; inventory.md kế hoạch 566 cụm (ngày 31+ mới là danh sách).
- 30 truyện nghe course/stories (cast Anna, Mike, Lisa, Tom, Joe, Ben; dòng A/B có who+gender) + validate_stories.py.
- Audio Kokoro 1568 câu: course/audio/<id>.mp3 + index.json {ids, byText}. Script: thu lại bằng ~/Documents/dopa-pipeline/.venv-kokoro (gen.py ở scratchpad đã mất → viết lại: N af_heart, Anna af_bella, Lisa af_sarah, Mike am_michael, Tom am_eric, Joe am_fenrir, Ben am_liam, lạ nữ af_nova/nam am_puck; dialogue A af_heart, B am_michael).
- App: màu rêu (giữ bố cục cũ — Tài chọn); buổi học tự dọn sẵn: S1 ôn → S0 kiểm tra nhanh (biết hết → chỉ đóng vai) → nghe hội thoại → cụm mới → nhại theo → phát âm (tự chèn khi hay sai / mỗi 3 ngày) → thay ô bằng miệng → đóng vai → nghe truyện. Kiểm tra tuần (ngày 7/14/21/30, Gemini chấm, ≥70 đạt, trượt → ôn lại tuần) → nói tự do với Gemini. Tiến độ gọn, lộ trình dài gập lại.

## Tài đã nói (đừng lặp lỗi)
- Vào app là có sẵn mọi thứ, KHÔNG muốn tự đi tìm trang khác.
- Biết khá nhiều câu cơ bản nhưng chấp nhận học từ đầu để không hổng → vì vậy có kiểm tra nhanh.
- Giọng trình duyệt "rác" → luôn dùng mp3 Kokoro.
- Không đổi bố cục trang chủ (đã xem 4 kiểu mới, chọn giữ cũ). Màu rêu.
- Chê trước đó: dán link/bài, giao diện rối, bài đời tư, từ đơn + IPA, điền chỗ trống.

## Chưa kiểm
- Gemini chấm/nói tự do chưa chạy với khoá thật (chỉ mock). Mic + STT chưa thử trên điện thoại thật.
- Thời lượng buổi 30' chưa đo thật.
