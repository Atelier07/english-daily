# Khuôn dữ liệu khoá học (course/)

Khoá học học theo CỤM (chunk) và KHUNG CÂU (stem có ô trống). Không có danh sách từ đơn, không có bài điền chỗ trống viết.

## Files
- `course/index.json` — danh sách ngày: `[{ "day": 1, "file": "days/day-01.json", "level": "A0", "function": "Muốn và xin", "title": "…" }]`
- `course/days/day-XX.json` — một ngày học (khuôn dưới).
- `course/audio/` — (tuỳ chọn, thêm sau) file mp3 theo id dòng: `course/audio/<lineId>.mp3`. App dùng file nếu có, không có thì dùng speechSynthesis.

## day-XX.json
```json
{
  "day": 1,
  "level": "A0",                     // A0 | A1 | A2 | B1 | B2
  "function": "Muốn và xin",         // chức năng giao tiếp (Core Inventory)
  "title": "Nói điều mình muốn",
  "intro_vi": "1–2 câu: hôm nay học để làm được việc gì.",
  "chunks": [
    {
      "id": "c001",                  // duy nhất toàn khoá, c001…c600
      "text": "I want to …",         // "…" đánh dấu ô trống; cụm cố định thì không có "…"
      "type": "stem",                // stem (khung có ô) | fixed (cụm cố định) | phrasal (cụm động từ)
      "vi": "Tôi muốn …",            // nghĩa CẢ CỤM
      "vi_equivalent": true,         // false nếu tiếng Việt không có cách nói tương đương → app luyện nhiều hơn
      "contrast_vi": "",             // bắt buộc khi vi_equivalent=false: ghi chú so sánh ngắn
      "register": "neutral",         // neutral | casual | polite | work
      "reduced": "wanna",            // dạng nói nhanh nếu có, không có thì null
      "source": "core-inventory A1 / PHRASE spoken",   // lý do chọn (danh sách tần suất / chức năng)
      "examples": [ { "id": "d01e01", "en": "I want to sleep.", "vi": "Tôi muốn ngủ." } ]
    }
  ],
  "dialogue": {
    "setting_vi": "Ở quán cà phê",
    "lines": [ { "id": "d01l01", "speaker": "A", "en": "Do you want to sit here?", "vi": "Bạn muốn ngồi đây không?", "chunks": ["c003"] } ]
  },
  "substitution": [
    { "chunk": "c001",
      "cues": [ { "id": "d01s01", "cue_vi": "muốn đi ngủ", "answer": "I want to go to bed.", "accept": ["I want to go to bed", "I want to sleep"] } ] }
  ],
  "roleplay": {
    "situation_vi": "Rủ một người bạn đi đâu đó cuối tuần.",
    "turns": [
      { "id": "d01r01", "role": "partner", "en": "Hey, what do you want to do this weekend?", "vi": "Này, cuối tuần bạn muốn làm gì?" },
      { "id": "d01r02", "role": "you", "cue_vi": "Rủ họ đi xem phim.", "model": "Do you want to see a movie?", "uses": ["c003"] }
    ]
  }
}
```

## Luật nội dung
- 5–8 cụm mới/ngày (tầng A0–A1 thiên về khung câu nói).
- Mỗi khung câu (stem) có 3–5 lượt thay ô trong `substitution`.
- Hội thoại và đóng vai chỉ dùng cụm đã học tới ngày đó + từ rất cơ bản; mỗi ngày tái sử dụng 3–6 cụm của các ngày trước.
- Tình huống CHUNG, ai cũng gặp (gặp người mới, quán ăn, mua sắm, hỏi đường, công việc, kế hoạch, kể chuyện…). KHÔNG đưa đời tư người học vào bài.
- Câu ví dụ, nghĩa tiếng Việt tự viết (không chép từ danh sách có bản quyền).
- `id` dòng là duy nhất toàn khoá (dùng cho audio).
