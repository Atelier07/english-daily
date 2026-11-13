// Kênh và link tìm kiếm (không dùng ID video cố định để tránh link chết).
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const LIBRARY = [
  {
    level: 'Dễ',
    note: 'Bắt đầu ở đây. Tài liệu cho người học, nói chậm, rõ, có transcript. Hiểu được 90–98% là đúng mức.',
    items: [
      { label: '6 Minute English (BBC Learning English)', hint: 'A2–B1 · 6 phút, có transcript', url: yt('BBC Learning English 6 Minute English') },
      { label: 'VOA Learning English', hint: 'A2–B1 · đọc chậm, câu ngắn', url: yt('VOA Learning English') },
      { label: 'BBC Learning English (trang chính)', hint: 'nhiều chuỗi bài theo cấp độ', url: 'https://www.bbc.co.uk/learningenglish' },
    ],
  },
  {
    level: 'Phát âm',
    note: 'Âm cuối, nối âm, nhấn âm. Xem ngắn, bắt chước ngay.',
    items: [
      { label: "Tim's Pronunciation Workshop (BBC)", hint: 'nối âm, nuốt âm, dạng yếu: giúp nghe ra từ quen', url: yt("BBC Learning English Tim's Pronunciation Workshop") },
      { label: 'The Sounds of English (BBC)', hint: 'từng nguyên âm, phụ âm', url: yt('BBC Learning English The Sounds of English') },
      { label: "Rachel's English", hint: 'giọng Mỹ, âm cuối, ngữ điệu', url: yt("Rachel's English") },
      { label: 'YouGlish', hint: 'nghe một từ/cụm do người thật nói trong video', url: 'https://youglish.com/english' },
    ],
  },
  {
    level: 'Vừa',
    note: 'Khi tài liệu dễ đã hiểu trên 95%.',
    items: [
      { label: 'TED-Ed', hint: 'B1 · 4–5 phút, hình minh hoạ giúp đoán nghĩa', url: yt('TED-Ed') },
    ],
  },
  {
    level: 'Theo sở thích: AI và dữ liệu',
    note: 'Video hướng dẫn: nhìn màn hình là đoán được nghĩa. Chọn video nói chậm, có phụ đề tiếng Anh.',
    items: [
      { label: 'n8n cho người mới', hint: 'tự động hoá', url: yt('n8n tutorial for beginners') },
      { label: 'Hướng dẫn Claude AI', hint: 'AI', url: yt('Claude AI tutorial') },
      { label: 'Power BI cho người mới', hint: 'dữ liệu, công việc', url: yt('Power BI tutorial beginner') },
      { label: 'SQL cho người mới', hint: 'B1–B2 · thuật ngữ lặp lại nhiều', url: yt('SQL for beginners') },
    ],
  },
];

export const youglish = (phrase) => `https://youglish.com/pronounce/${encodeURIComponent(String(phrase).trim())}/english`;
