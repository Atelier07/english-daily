// Bằng chứng nghiên cứu, viết gọn và trung thực. Dùng cho trang "Vì sao" và nút "Mình đang nghi ngờ".
// Mức độ: mạnh = phân tích tổng hợp, lặp lại nhiều; vừa = vài nghiên cứu tốt; yếu = nghiên cứu nhỏ/ngắn.

export const STRENGTH = { strong: 'mạnh', moderate: 'vừa', weak: 'yếu' };

export const EVIDENCE = [
  {
    id: 'chunks', part: 'Học bằng cụm', title: 'Học bằng cụm và khung câu',
    concept: 'Formulaic sequences · Wood; Boers & Lindstromberg; Myles và cs.; Ellis',
    strength: 'moderate',
    body: [
      'Người nói dùng nhiều cụm có sẵn thì được đánh giá là trôi chảy hơn: mối liên hệ này khá chắc (Boers & Lindstromberg 2012; Wood 2010). Nhưng chưa có thử nghiệm nào so trực tiếp “học cụm trước” với “học từ trước” ở người mới bắt đầu, nên đây là lựa chọn có cơ sở, không phải đã được chứng minh.',
      'Từng kỹ thuật trong buổi học đều có bằng chứng riêng: chú ý thẳng vào cụm tốt hơn chỉ chờ tự gặp; tự nhớ ra (nói từ nghĩa tiếng Việt) tốt hơn đọc lại; ôn giãn cách tốt hơn ôn dồn; cụm không có cách nói tương đương tiếng Việt khó hơn và cần ôn nhiều hơn (Yamashita & Jiang 2010; Laufer & Girsai 2008).',
      'Khung câu cần nhiều cách thay ô khác nhau mới “mở” ra được (Ellis); người mới học thường đi từ cụm thuộc lòng sang tự ghép câu, có lúc sai nhiều hơn trước: đó là dấu hiệu đang tiến (Myles và cs. 1998). Gặp một cụm khoảng 10–15 lần là con số tham khảo từ nghiên cứu đọc (Webb và cs. 2013), chưa phải luật.',
    ],
    sources: 'Boers & Lindstromberg 2012; Wood 2010; Myles, Hooper & Mitchell 1998; Ellis & Ferreira-Junior 2009; Yamashita & Jiang 2010; Webb, Newton & Chang 2013',
  },
  {
    id: 'input', part: 'Nghe/đọc', title: 'Nghe/đọc nhiều thứ mình hiểu được',
    concept: 'Comprehensible input · Krashen; extensive reading',
    strength: 'strong',
    body: [
      'Hai phân tích tổng hợp về đọc rộng: Jeon & Day 2016 (49 nghiên cứu, gần 5.900 người) thấy hiệu quả rõ nhất ở người lớn, d ≈ 0,70; Nakanishi 2015 (34 nghiên cứu) d ≈ 0,46 khi so với nhóm đối chứng. Phần tăng mạnh nhất là tốc độ đọc; từ vựng tăng chậm hơn.',
      'Muốn đọc hiểu trôi chảy cần biết khoảng 95–98% số từ (Schmitt và cs. 2011). Ở trình độ A2, đó là lý do nên dùng tài liệu cho người học trước, rồi mới sang video thật.',
      'Với nghe rộng chưa có phân tích tổng hợp riêng; áp dụng cùng nguyên tắc là suy luận hợp lý, chưa được kiểm chứng trực tiếp.',
    ],
    sources: 'Jeon & Day 2016; Nakanishi 2015; Schmitt, Jiang & Grabe 2011',
  },
  {
    id: 'shadow', part: 'Shadowing', title: 'Shadowing',
    concept: 'Kadota; Hamada',
    strength: 'weak',
    body: [
      'Bằng chứng ở mức vừa đến yếu: chủ yếu là các nghiên cứu nhỏ với người học Nhật, chưa có phân tích tổng hợp. Hamada 2016 (khoảng 40 sinh viên, 20 phút × 2 buổi/tuần trong khoảng 1 tháng): nhận diện âm tốt lên ở mọi nhóm, còn nghe hiểu chỉ tốt lên ở nhóm trình độ thấp, tức là đúng nhóm bạn đang ở.',
      'Điều kiện: đoạn ngắn, dễ bằng hoặc dưới trình độ, bắt đầu bằng lẩm bẩm theo. Shadow thứ mình không hiểu chỉ là nhại âm thanh.',
    ],
    sources: 'Hamada 2016 (Language Teaching Research); Kadota & Tamai 2004',
  },
  {
    id: 'cards', part: 'Thẻ ôn', title: 'Tự nhớ lại, ôn giãn cách',
    concept: 'Retrieval practice + spaced repetition',
    strength: 'strong',
    body: [
      'Kim & Webb 2022 (48 thí nghiệm, 3.411 người học ngoại ngữ): ôn giãn cách có hiệu quả trung bình đến lớn, g ≈ 0,80 ở bài kiểm tra muộn. Khoảng cách dài hơn thắng rõ khi kiểm tra sau một thời gian.',
      'Kornell 2009: 90% người học nhớ tốt hơn khi ôn giãn cách, nhưng 72% lại tin rằng nhồi một lúc thì tốt hơn. Cảm giác “ôn thế này không vào” là bình thường, không phải bằng chứng là cách này sai.',
    ],
    sources: 'Kim & Webb 2022 (Language Learning); Kornell 2009; Webb, Yanagisawa & Uchihara 2020',
  },
  {
    id: 'speak', part: 'Nói', title: 'Nói ra và tự sửa lỗi',
    concept: 'Output hypothesis · Swain; corrective feedback',
    strength: 'strong',
    body: [
      'Lyster & Saito 2010 (15 nghiên cứu, 827 người): sửa lỗi có hiệu quả; kiểu gợi ý để người học tự sửa cho hiệu quả lớn, hơn kiểu đưa sẵn câu đúng. Vì vậy AI ở đây chỉ gợi ý trước, bạn thử sửa rồi mới xem đáp án.',
      'Luyện nói với chatbot: các phân tích tổng hợp cho hiệu quả trung bình (khoảng g 0,5–0,6). Nghiên cứu riêng về AI kiểu mới còn ngắn (4–6 tuần), nên đây là “hứa hẹn”, chưa phải “chắc chắn”.',
    ],
    sources: 'Lyster & Saito 2010 (SSLA); Bibauw và cs. 2018; Swain 1985, 1995',
  },
  {
    id: 'endings', part: 'Âm cuối', title: 'Âm cuối trước, âm “th” sau cùng',
    concept: 'Intelligibility; Lingua Franca Core; ASR feedback',
    strength: 'moderate',
    body: [
      'Tiếng Việt chỉ có 6 phụ âm cuối và không bật hơi chúng, nên âm cuối và đuôi -s/-ed là lỗi hay gặp nhất. Disney & Le 2024 (16 người Việt): bỏ -s/-z cuối 28,4% số lần; đuôi -s sau phụ âm (books, wants) bỏ tới 50,7%. Mẫu nhỏ, nhưng khớp với nhiều nghiên cứu ở Việt Nam.',
      'Luyện phát âm có máy nhận giọng nói phản hồi: Ngo và cs. 2024 (15 nghiên cứu) g ≈ 0,69, hiệu quả lớn với từng âm, nhỏ với ngữ điệu; chương trình dài hơn thì tốt hơn. Máy chép lời không phải giám khảo: nó hay tự “sửa” giúp bạn, nên app không chấm điểm phát âm.',
    ],
    sources: 'Disney & Le 2024 (Languages); Ngo, Chen & Lai 2024 (ReCALL); Jenkins (LFC)',
  },
];

export const HABIT = {
  title: 'Thói quen cần thời gian',
  strength: 'moderate',
  body: 'Lally và cs. 2010: trung bình khoảng 66 ngày để một việc hằng ngày thành tự động (dao động 18–254 ngày). Lỡ một ngày gần như không ảnh hưởng; lỡ nhiều lần liền mới làm chậm lại.',
  sources: 'Lally và cs. 2010',
};

export const HOURS_NOTE = {
  title: 'Về con số 600 giờ',
  strength: 'weak',
  body: 'Cambridge ước tính giờ học có hướng dẫn tính từ con số 0: A2 khoảng 180–200 giờ, B1 khoảng 350–400, B2 khoảng 500–600. Đây chỉ là hướng dẫn tham khảo; giờ tự học không quy đổi 1:1 với giờ học có thầy. Mốc thi thử TOEIC 3 tháng/lần mới là thước đo thật. Quy đổi TOEIC 750 ≈ B2 cũng chỉ gần đúng.',
  sources: 'Cambridge English (guided learning hours)',
};
