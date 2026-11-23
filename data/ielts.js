/* Đề luyện IELTS (nội dung mẫu). Muốn thêm đề thì thêm một dòng vào đúng danh sách.
   Nhớ: mỗi mục cách nhau bằng dấu phẩy, chữ đặt trong ngoặc kép. */
const IELTS_DATA = {
  speaking: {
    // Part 1: câu hỏi ngắn về bản thân (trả lời 30 giây)
    1: [
      "Do you work or are you a student?",
      "What do you usually do at the weekend?",
      "Do you prefer reading books or watching films? Why?",
      "How often do you use public transport?",
    ],
    // Part 2: thẻ đề (cue card) – 1 phút chuẩn bị, nói 2 phút.
    // question = đề bài, points = các ý "You should say"
    2: [
      {
        question: "Describe a skill you learned that you are proud of.",
        points: ["what the skill is", "how you learned it", "how long it took", "and explain why you are proud of it"],
      },
      {
        question: "Describe a place you visited that was very peaceful.",
        points: ["where it was", "when you went there", "what you did there", "and explain why it felt peaceful"],
      },
    ],
    // Part 3: câu hỏi thảo luận (trả lời 1 phút)
    3: [
      "Why do some people find it hard to learn new skills as adults?",
      "How has technology changed the way people make friends?",
      "Should governments spend more money on public parks? Why?",
    ],
  },

  // Writing Task 2: đề bài luận 250 từ, 40 phút
  writing: [
    "Some people believe that university education should be free for everyone. To what extent do you agree or disagree?",
    "Many people now work from home. What are the advantages and disadvantages of this trend?",
    "Children today spend too much time on electronic devices. What problems does this cause, and what solutions can you suggest?",
  ],

  // Cụm từ hữu ích cho Speaking và Writing
  usefulPhrases: [
    "In my opinion, …",
    "On the other hand, …",
    "A good example of this is …",
    "This is mainly because …",
    "As a result, …",
    "It is widely believed that …",
    "To sum up, …",
    "Let me think about that for a second.",
  ],
};
