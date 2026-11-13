// 40 đề nói. Mỗi ngày một đề, xoay vòng theo số ngày kể từ mốc cố định.
export const PROMPTS = [
  { vi: 'Kể lại hôm nay bạn đã làm hoặc học được gì.', en: 'Tell me what you did or learned today.' },
  { vi: 'Giải thích một thứ về AI bạn vừa học cho người chưa biết gì.', en: 'Explain something about AI you just learned to someone who knows nothing about it.' },
  { vi: 'Kể về một bản nhạc piano bạn đang tập: khó ở đâu, bạn tập thế nào.', en: 'Talk about a piano piece you are practicing: what is hard, how you practice.' },
  { vi: 'Mô tả một workflow tự động hoá bạn muốn xây, từng bước.', en: 'Describe an automation workflow you want to build, step by step.' },
  { vi: 'Kể về video tiếng Anh gần nhất bạn xem. Nó nói về gì?', en: 'Tell me about the last English video you watched. What was it about?' },
  { vi: 'Bạn dùng điện thoại vào những việc gì trong một ngày?', en: 'What do you use your phone for during a day?' },
  { vi: 'Kể về một lần bạn sửa được một lỗi khó (code, máy tính, đồ vật...).', en: 'Tell me about a time you fixed a difficult problem (code, computer, anything).' },
  { vi: 'Mô tả căn phòng hoặc góc học của bạn.', en: 'Describe your room or the place where you study.' },
  { vi: 'Bạn muốn cuộc sống của mình thế nào vào năm 2028?', en: 'What do you want your life to look like in 2028?' },
  { vi: 'So sánh hai công cụ AI bạn đã dùng. Bạn thích cái nào hơn, vì sao?', en: 'Compare two AI tools you have used. Which one do you prefer and why?' },
  { vi: 'Kể về một người bạn học được nhiều điều từ họ.', en: 'Talk about someone you have learned a lot from.' },
  { vi: 'Hướng dẫn ai đó nấu một món ăn đơn giản bạn biết làm.', en: 'Teach someone how to cook a simple dish you know.' },
  { vi: 'Kể lại buổi sáng của bạn từ lúc thức dậy.', en: 'Walk me through your morning, from the moment you woke up.' },
  { vi: 'Điều gì làm bạn mất tập trung nhiều nhất? Bạn xử lý thế nào?', en: 'What distracts you the most? How do you deal with it?' },
  { vi: 'Giải thích dữ liệu (data) là gì và vì sao các công ty cần nó.', en: 'Explain what data is and why companies need it.' },
  { vi: 'Kể về một bộ phim hoặc series bạn thích, không kể đoạn kết.', en: 'Tell me about a movie or series you like, without spoiling the ending.' },
  { vi: 'Nếu có một ngày rảnh hoàn toàn, bạn sẽ làm gì?', en: 'If you had a completely free day, what would you do?' },
  { vi: 'Kể về quê hoặc thành phố bạn đang sống cho người nước ngoài.', en: 'Describe your hometown or the city you live in to a foreigner.' },
  { vi: 'Bạn học tiếng Anh thế nào trong tuần này? Điều gì hiệu quả, điều gì không?', en: 'How did you study English this week? What worked and what did not?' },
  { vi: 'Giải thích một prompt hay mà bạn hay dùng với AI.', en: 'Explain a good prompt you often use with AI.' },
  { vi: 'Kể về một sai lầm bạn từng mắc và bài học từ nó.', en: 'Talk about a mistake you made and what you learned from it.' },
  { vi: 'Mô tả công việc mơ ước của bạn: một ngày làm việc trông thế nào?', en: 'Describe your dream job: what does a normal workday look like?' },
  { vi: 'Bạn nghĩ AI sẽ thay đổi công việc của người trẻ Việt Nam ra sao?', en: 'How do you think AI will change jobs for young people in Vietnam?' },
  { vi: 'Kể về một món đồ bạn dùng mỗi ngày và vì sao bạn thích nó.', en: 'Talk about something you use every day and why you like it.' },
  { vi: 'Hướng dẫn ai đó cách bắt đầu học một kỹ năng mới.', en: 'Explain to someone how to start learning a new skill.' },
  { vi: 'Kể về lần gần nhất bạn thấy thật sự vui.', en: 'Tell me about the last time you felt really happy.' },
  { vi: 'Giải thích Excel / Power BI / SQL dùng để làm gì cho người mới.', en: 'Explain what Excel, Power BI or SQL is used for, to a beginner.' },
  { vi: 'Bạn thường lên kế hoạch cho một tuần như thế nào?', en: 'How do you usually plan your week?' },
  { vi: 'Kể về một chuyến đi bạn nhớ nhất.', en: 'Tell me about a trip you remember the most.' },
  { vi: 'Nói về một thói quen bạn muốn bỏ và một thói quen bạn muốn có.', en: 'Talk about a habit you want to quit and a habit you want to build.' },
  { vi: 'Tóm tắt một bài viết hoặc video về công nghệ bạn vừa xem.', en: 'Summarize an article or video about technology you just saw.' },
  { vi: 'Mô tả bài nhạc piano bạn thích nghe nhất và cảm giác khi nghe.', en: 'Describe your favorite piano piece and how it makes you feel.' },
  { vi: 'Bạn sẽ giải thích "automation" cho bố mẹ thế nào?', en: 'How would you explain "automation" to your parents?' },
  { vi: 'Kể về một ngày mọi thứ đều không như ý.', en: 'Tell me about a day when nothing went as planned.' },
  { vi: 'Bạn thích học một mình hay học nhóm? Vì sao?', en: 'Do you prefer studying alone or in a group? Why?' },
  { vi: 'Mô tả một ứng dụng bạn muốn tự xây, nó giải quyết vấn đề gì?', en: 'Describe an app you want to build. What problem does it solve?' },
  { vi: 'Kể về đồ ăn bạn đã ăn hôm nay và hôm qua.', en: 'Talk about the food you ate today and yesterday.' },
  { vi: 'Nếu gặp người bản xứ 5 phút, bạn muốn hỏi họ điều gì?', en: 'If you met a native speaker for five minutes, what would you ask them?' },
  { vi: 'Kể về một lời khuyên tốt nhất bạn từng nhận được.', en: 'Tell me about the best advice you have ever received.' },
  { vi: 'Nhìn lại tháng này: bạn tự hào điều gì nhất?', en: 'Looking back at this month: what are you most proud of?' },
];

const EPOCH = new Date(2026, 0, 1);
export function promptIndexFor(date = new Date(), shift = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((d - EPOCH) / 86400000);
  const n = PROMPTS.length;
  return (((days + shift) % n) + n) % n;
}
