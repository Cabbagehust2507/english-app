/* Bộ cụm từ "Mẫu" – chỉ dùng lần đầu mở web (khi chưa có dữ liệu trong localStorage).
   Cụm từ của bạn thì nhập qua mục "Nhập dữ liệu", không sửa ở đây.
   Mỗi mục: phrase (cụm từ), meaning (nghĩa), context (dùng khi nào), example (câu ví dụ). */
const SAMPLE_PHRASES = [
  {
    phrase: "have a detrimental effect on",
    meaning: "có ảnh hưởng tiêu cực đến",
    context: "Văn trang trọng (IELTS Writing, báo cáo) khi nói một thứ gây hại cho thứ khác",
    example: "Plastic waste has a detrimental effect on marine life.",
  },
  {
    phrase: "raise awareness of",
    meaning: "nâng cao nhận thức về",
    context: "Khi nói về chiến dịch, giáo dục giúp mọi người hiểu rõ một vấn đề xã hội",
    example: "Schools should raise awareness of climate change.",
  },
  {
    phrase: "broaden your horizons",
    meaning: "mở mang tầm mắt",
    context: "Khi nói du lịch, học tập hay trải nghiệm mới giúp hiểu biết rộng hơn",
    example: "Studying abroad can broaden your horizons.",
  },
  {
    phrase: "meet a deadline",
    meaning: "kịp hạn chót",
    context: "Công việc, học tập: hoàn thành đúng thời hạn được giao",
    example: "I worked late to meet the deadline.",
  },
  {
    phrase: "keep up with",
    meaning: "theo kịp",
    context: "Khi phải cố gắng để không bị tụt lại (công nghệ, tin tức, bạn cùng lớp)",
    example: "It is hard to keep up with new technology.",
  },
  {
    phrase: "make ends meet",
    meaning: "xoay xở đủ sống",
    context: "Khi nói về khó khăn tài chính: thu nhập chỉ vừa đủ chi tiêu",
    example: "Many families struggle to make ends meet.",
  },
  {
    phrase: "to be honest",
    meaning: "thành thật mà nói",
    context: "Văn nói, đặt đầu câu khi muốn nói thật ý kiến của mình (hợp với IELTS Speaking)",
    example: "To be honest, I prefer staying at home.",
  },
  {
    phrase: "once in a blue moon",
    meaning: "hiếm khi",
    context: "Văn nói thân mật, khi nói một việc rất ít khi xảy ra",
    example: "I eat fast food once in a blue moon.",
  },
];
