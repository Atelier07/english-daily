const ITEMS = [
  {
    title: 'Nghe/đọc thứ bạn hiểu được',
    who: 'Comprehensible input · Stephen Krashen',
    body: [
      'Ngôn ngữ được “thu nạp” chủ yếu khi bạn hiểu được thông điệp mình đang nghe hoặc đọc, ở mức hơi khó hơn trình độ hiện tại một chút. Vì vậy phần lớn thời gian mỗi ngày dành cho nội dung bạn thật sự muốn xem (AI, công nghệ, piano…), không phải học quy tắc.',
      'Nói cho công bằng: các chi tiết trong giả thuyết của Krashen vẫn bị tranh luận, nhưng việc cần một lượng lớn input hiểu được thì hầu như nhà nghiên cứu nào cũng đồng ý.',
    ],
  },
  {
    title: 'Shadowing',
    who: 'Nói đè theo bản ghi',
    body: [
      'Nói gần như cùng lúc với người trong video buộc tai và miệng làm việc cùng nhau: bạn bắt chước nhịp, trọng âm, nối âm thay vì đọc từng chữ. Các nghiên cứu (phần nhiều với người học ở Nhật Bản) cho thấy nó giúp nghe hiểu và phát âm khi luyện đều trên đoạn ngắn.',
      'Nó là bài tập bổ trợ, không thay được việc nghe nhiều.',
    ],
  },
  {
    title: 'Tự nhớ lại, ôn đúng lúc sắp quên',
    who: 'Retrieval practice + spaced repetition',
    body: [
      'Mỗi lần bạn cố lấy một thứ ra khỏi trí nhớ, nó được củng cố mạnh hơn nhiều so với đọc lại (retrieval practice). Ôn giãn cách (spaced repetition) đặt lần ôn vào lúc bạn sắp quên, nên tốn ít thời gian mà nhớ lâu. Đây là hai kết quả vững nhất của tâm lý học nhận thức.',
      'Vì thế mặt trước thẻ chỉ có nghĩa tiếng Việt: bạn phải tự nói cụm tiếng Anh ra trước khi được xem đáp án.',
    ],
  },
  {
    title: 'Phải nói ra',
    who: 'Output hypothesis · Merrill Swain',
    body: [
      'Khi phải tự nói hay viết, bạn mới phát hiện chỗ mình chưa biết cách diễn đạt (“noticing the gap”). Nghe thì hiểu mà nói không ra là chuyện bình thường; nói mỗi ngày là cách lấp khoảng trống đó.',
      'Input vẫn là phần chính; output là phần giúp bạn biết mình đang thiếu gì.',
    ],
  },
  {
    title: 'Học ngữ pháp từ lỗi của chính mình',
    who: 'Corrective feedback có chọn lọc',
    body: [
      'Thay vì học cả cuốn ngữ pháp, bạn chỉ sửa những lỗi bạn thật sự lặp lại khi nói. Phản hồi sửa lỗi có ích hơn khi tập trung vào ít lỗi, gắn với câu bạn vừa nói và được gặp lại nhiều lần.',
      'Hai lỗi được sửa đến nơi có giá trị hơn hai mươi lỗi bị gạch đỏ rồi quên.',
    ],
  },
];

export function mount(el) {
  el.innerHTML = `
    <div class="page-head">
      <div class="eyebrow">Phương pháp</div>
      <h1>Vì sao cách này hiệu quả</h1>
      <p class="lede">Không có phương pháp thần kỳ. Đây là năm ý có cơ sở nghiên cứu, ghép lại thành một ngày học vừa sức.</p>
    </div>
    ${ITEMS.map((it) => `
      <article class="why-item">
        <span class="who">${it.who}</span>
        <h2>${it.title}</h2>
        ${it.body.map((p) => `<p>${p}</p>`).join('')}
      </article>`).join('')}

    <article class="why-item">
      <span class="who">Về con số 600 giờ</span>
      <h2>Đó là ước tính, không phải lời hứa</h2>
      <p>Từ khoảng A2 lên B2 thường được ước tính vài trăm giờ học có chủ đích; con số thật tuỳ người, tuỳ cách học. Ứng dụng đếm giờ để bạn thấy mình đang đi, còn thi thử TOEIC 3 tháng một lần là thước đo thật.</p>
    </article>

    <article class="why-item">
      <span class="who">Cách thẻ cụm từ được xếp lịch</span>
      <h2>SM-2 rút gọn, ba mức</h2>
      <p><b>Quên</b>: thẻ quay lại cuối buổi ôn hôm nay và lần sau sau 1 ngày. <b>Khó</b>: 1 ngày → 3 ngày → khoảng cách cũ × 1,2. <b>Nhớ</b>: 1 ngày → 4 ngày → khoảng cách cũ × hệ số dễ (bắt đầu 2,5; tăng khi bạn nhớ, giảm khi bạn quên; thấp nhất 1,3). Khoảng cách tối đa 180 ngày.</p>
    </article>`;
}
