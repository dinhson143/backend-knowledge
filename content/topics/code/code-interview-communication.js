BK.topic({
  id: "code-interview-communication",
  track: "code",
  section: "code-interview",
  title: "Kỹ năng vòng coding",
  goal: "Làm rõ đề, nói to suy nghĩ, đi từ brute force và tự test",
  tldr: {
    t: "Vòng coding chấm bốn thứ: **giao tiếp**, **giải quyết vấn đề**, **code**, **kiểm thử** — không chỉ \"có ra đáp án không\". Đi theo nhịp cố định: hỏi lại đề và chốt ví dụ → nói brute force và độ phức tạp → đề xuất cách tốt hơn, được đồng ý mới code → vừa code vừa nói → tự chạy tay ví dụ và edge case, tự sửa bug. Kẹt thì nói ra mình đang thử gì, đừng im lặng.",
    why: "Interviewer chỉ chấm được thứ họ thấy và nghe. Rubric phổ biến (Tech Interview Handbook — https://www.techinterviewhandbook.org/coding-interview-rubrics/) tách bốn trục; một lời giải tối ưu viết im lặng, không test vẫn mất điểm ở hai trục giao tiếp và kiểm thử, còn một lời giải chưa tối ưu nhưng trình bày rõ, tự bắt được bug thường vẫn qua.",
  },
  story: {
    problem: "Ứng viên nghe đề xong cúi đầu code ngay, 20 phút sau phát hiện hiểu sai đề (mảng có số âm, có trùng). Hoặc ngồi im 5 phút tìm cách tối ưu; interviewer không biết bạn đang nghĩ đúng hướng hay lạc, không gợi ý được, và ghi \"giao tiếp yếu\".",
    idea: "Biến suy nghĩ thành thứ interviewer quan sát được: hỏi để chốt phạm vi, nói ra từng lựa chọn kèm độ phức tạp, xin xác nhận trước khi code, tự test như một reviewer. Interviewer trở thành người cộng tác có thể gợi ý đúng lúc.",
    tradeoff: "Nói nhiều tốn thời gian và có thể làm chậm nhịp code. Cần cân: nói **quyết định và lý do**, không đọc từng ký tự mình gõ; đề dễ thì làm rõ nhanh, đề mơ hồ thì dành nhiều thời gian hỏi hơn.",
  },
  table: {
    head: ["Nhịp", "Làm gì", "Gợi ý thời gian (vòng 45 phút)"],
    rows: [
      {
        cells: ["1 · Làm rõ đề", "Nhắc lại đề bằng lời của mình; hỏi input (kích thước, giá trị âm, trùng, rỗng, đã sắp xếp?), output (trả index hay giá trị, nhiều đáp án thì sao); tự đưa 1–2 ví dụ và xin xác nhận", "3–5 phút"],
        why: "Chi tiết như \"mảng đã sắp xếp\" thay đổi độ phức tạp tốt nhất có thể đạt; bỏ sót là giải sai bài (https://www.techinterviewhandbook.org/coding-interview-techniques/). Ví dụ tự làm bằng tay cũng chính là test case dùng ở nhịp 5.",
      },
      {
        cells: ["2 · Brute force", "Nói cách thẳng nhất và độ phức tạp của nó, kể cả khi biết là chậm", "1–2 phút"],
        why: "Có một lời giải đúng trên bàn là có điểm sàn và có mốc để so. Nhiều cách tối ưu đến từ việc nhìn vào brute force và hỏi \"bước nào đang làm lại việc đã làm?\".",
      },
      {
        cells: ["3 · Tối ưu và chốt hướng", "Tìm chỗ lặp việc, thử các cấu trúc quen (hash map, heap, two pointers, sliding window, sort); nói độ phức tạp đích; hỏi \"tôi code theo hướng này được không?\"", "5–10 phút"],
        why: "Nêu được độ phức tạp tốt nhất có thể về lý thuyết (ví dụ phải đọc hết input thì không dưới O(n)) giúp biết khi nào dừng tối ưu và là tín hiệu tốt (TIH, techniques). Xin xác nhận trước khi code tránh viết 20 phút cho hướng interviewer không muốn.",
      },
      {
        cells: ["4 · Code", "Viết theo khung hàm trước; tên biến rõ nghĩa; tách hàm phụ khi một đoạn có tên riêng; nói quyết định, không đọc từng dòng", "15–20 phút"],
        why: "Chia thành hàm nhỏ cho interviewer thấy cấu trúc lời giải kể cả khi chưa viết xong mọi phần (TIH, techniques). Code đọc được là một trục chấm riêng: tên phải đủ dài để nói rõ nó là gì (Google eng-practices — https://google.github.io/eng-practices/review/reviewer/looking-for.html).",
      },
      {
        cells: ["5 · Tự test", "Chạy tay ví dụ ở nhịp 1, theo dõi giá trị biến; rồi edge case: rỗng, một phần tử, trùng, âm, cực trị; sửa bug tự tìm thấy; nói lại độ phức tạp cuối cùng", "5 phút"],
        why: "Tự bắt và sửa bug của mình, kiểm chứng có hệ thống (chạy từng dòng) là tín hiệu \"strong hire\" ở trục kiểm thử (TIH, rubrics). Để interviewer chỉ ra bug thì cùng bug đó thành điểm trừ.",
      },
    ],
  },
  points: [
    {
      t: "**Câu hỏi làm rõ nên có sẵn trong đầu** — kích thước input (10³ hay 10⁹?), kiểu và miền giá trị (âm, 0, trùng, Unicode), input có thể rỗng hoặc `null` không, đã sắp xếp chưa, cần trả gì khi không có đáp án, được sửa input tại chỗ không.",
      why: "Kích thước input gần như quyết định độ phức tạp cần đạt: n tới 10⁵ thì O(n²) không chạy kịp, cần O(n log n) hoặc O(n). Hỏi về sửa tại chỗ quyết định có được tiết kiệm bộ nhớ bằng cách dùng lại mảng input hay không.",
    },
    {
      t: "**Nói to đúng cách** — nói **ý định** trước khi gõ (\"giờ tôi duyệt mảng một lần, giữ map từ giá trị sang index\"), nói **lý do** khi chọn (\"dùng heap vì chỉ cần k phần tử lớn nhất\"), nói khi **đổi hướng** (\"cách này sai với số âm, tôi đổi sang…\").",
      why: "Interviewer cần theo được suy nghĩ để chấm và để gợi ý. Đọc từng dòng code (\"for i bằng 0…\") không thêm thông tin; nói quyết định và lý do thì có.",
    },
    {
      t: "**Kẹt thì làm gì** — vẽ ra (cây, đồ thị, ma trận, con trỏ), giải tay một ví dụ nhỏ rồi viết lại các quy tắc mình vừa dùng, thử thêm ví dụ để thấy quy luật, chia bài thành bài con, rà lần lượt các cấu trúc dữ liệu quen. Vừa làm vừa nói.",
      why: "Đây là các kỹ thuật TIH khuyên khi bị kẹt (https://www.techinterviewhandbook.org/coding-interview-techniques/). Nói ra cho interviewer biết bạn kẹt ở đâu để họ gợi ý đúng chỗ; nhận gợi ý rồi đi tiếp tốt hơn nhiều so với im lặng hết giờ.",
    },
    {
      t: "**Nhận gợi ý đúng cách** — nhắc lại gợi ý bằng lời của mình, nói nó thay đổi lời giải ở đâu, rồi làm tiếp. Không cãi, không giả vờ đã nghĩ tới từ trước.",
      why: "Số gợi ý cần là một tín hiệu bị chấm, nhưng cách dùng gợi ý cũng vậy: tiếp thu nhanh và đi đúng hướng cho thấy bạn sẽ làm việc nhóm tốt.",
    },
    {
      t: "**Độ phức tạp phải nói cả thời gian và bộ nhớ**, và nói theo biến của đề (`O(n + m)`, `O(n log k)`), không chỉ \"O(n)\" chung chung. Nhớ tính cả bộ nhớ của đệ quy (độ sâu stack).",
      why: "Phân tích độ phức tạp chính xác là một tín hiệu cơ bản của trục giải quyết vấn đề (TIH, rubrics). Quên stack của đệ quy là lỗi hay gặp: DFS trên cây lệch tốn O(n) bộ nhớ dù không cấp mảng nào.",
    },
    {
      t: "**Code sạch ở mức đủ** — tên biến nói nghĩa (`left`, `right`, `seen`, không `a`, `b`, `x2`), tách hàm phụ (`is_valid(r, c)`), xử lý edge case ở đầu hàm, không để code chết. Không cần class, interface, comment dài.",
      why: "Trục code chấm \"chạy được, gần như không bug, sạch, đúng phong cách ngôn ngữ\" (TIH, rubrics). Thêm abstraction không cần thiết trong 45 phút là phức tạp hoá, cũng bị coi là điểm trừ (Google eng-practices nói over-engineering là một dạng phức tạp không cần thiết).",
    },
  ],
  sections: [
    {
      title: "Câu nói mẫu theo tình huống",
      table: {
        head: ["Tình huống", "Nói thế nào"],
        rows: [
          { cells: ["Vừa nghe đề", "\"Để tôi nhắc lại: cho mảng số nguyên và target, trả về **index** của hai phần tử có tổng bằng target. Mảng có thể có số âm và số trùng không? Luôn có đúng một đáp án chứ?\""], why: "Nhắc lại đề là cách rẻ nhất phát hiện hiểu sai; câu hỏi cụ thể cho thấy bạn đã nghĩ tới edge case ngay từ đầu." },
          { cells: ["Đưa ví dụ", "\"Ví dụ `[2, 7, 11, 15]`, target 9 → `[0, 1]`. Nếu `[3, 3]`, target 6 → `[0, 1]`, đúng ý anh/chị không?\""], why: "Ví dụ có số trùng kiểm luôn cách hiểu về \"không dùng một phần tử hai lần\", và sẽ được dùng lại khi test." },
          { cells: ["Brute force", "\"Cách thẳng nhất là thử mọi cặp, O(n²) thời gian, O(1) bộ nhớ. Tôi nghĩ làm tốt hơn được vì đang tìm lại phần bù nhiều lần.\""], why: "Nêu brute force kèm độ phức tạp và chỉ ra chỗ lãng phí: lời giải tối ưu thường mọc ra từ chính câu này." },
          { cells: ["Chốt hướng", "\"Dùng hash map từ giá trị sang index, duyệt một lần: O(n) thời gian, O(n) bộ nhớ. Tôi bắt đầu code nhé?\""], why: "Một câu đủ: cấu trúc dữ liệu, độ phức tạp, xin xác nhận." },
          { cells: ["Kẹt", "\"Tôi đang kẹt ở việc xử lý cửa sổ khi gặp ký tự trùng. Để tôi chạy tay ví dụ `abcabcbb` xem con trỏ trái nên nhảy tới đâu.\""], why: "Nói rõ chỗ kẹt và việc đang làm để gỡ; interviewer có thể gợi ý đúng chỗ." },
          { cells: ["Tự test", "\"Giờ tôi chạy tay ví dụ đầu: i = 0, `seen` rỗng, thêm 2 → 0; i = 1, cần 2, có trong `seen` → trả `[0, 1]`. Tiếp theo thử mảng một phần tử.\""], why: "Theo dõi giá trị biến từng bước là cách kiểm chứng có hệ thống mà rubric đánh giá cao." },
          { cells: ["Hết giờ chưa xong", "\"Phần còn lại là ghép kết quả của hai nửa; tôi sẽ dùng hai con trỏ trên hai mảng đã sắp xếp, O(n). Phần này chưa viết nhưng hướng là vậy.\""], why: "Mô tả phần còn thiếu vẫn ghi điểm giải quyết vấn đề; im lặng thì không." },
        ],
      },
    },
    {
      title: "Checklist trước khi nói \"xong\"",
      points: [
        "Đã chạy tay ít nhất một ví dụ bình thường, theo dõi giá trị biến.",
        "Đã thử: input rỗng, một phần tử, tất cả giống nhau, giá trị âm hoặc 0, giá trị cực lớn (tràn số?).",
        "Off-by-one: điều kiện vòng lặp `<` hay `<=`, chỉ số đầu/cuối, cửa sổ đóng hay mở.",
        "Mọi nhánh đều trả về giá trị; không có biến dùng trước khi gán.",
        "Đã nói lại độ phức tạp thời gian và bộ nhớ của bản cuối cùng.",
        "Đã nêu (nếu còn thời gian) hướng mở rộng: input không vừa bộ nhớ, chạy song song, đề đổi ràng buộc.",
      ],
    },
  ],
  tips: [
    {
      t: "Luyện nói to khi tự giải bài (ghi âm hoặc luyện với bạn). Nói to là kỹ năng riêng, không tự có khi đã giỏi thuật toán.",
      why: "Áp lực phòng phỏng vấn làm người ta quay về thói quen; nếu thói quen là giải im lặng thì sẽ im lặng. Luyện vài chục bài có nói to thì nhịp 5 bước thành phản xạ.",
    },
    {
      t: "Đề mơ hồ là cố ý: interviewer muốn xem bạn có hỏi không. Đừng tự giả định rồi im lặng code.",
      why: "Làm rõ yêu cầu là tín hiệu cơ bản đầu tiên của trục giải quyết vấn đề; nếu buộc phải giả định thì nói rõ giả định đó ra.",
    },
    "Ngôn ngữ không có sẵn heap hay queue (JavaScript): hỏi \"tôi giả sử có một heap với push/pop O(log n) được không?\" thay vì tự cài từ đầu, trừ khi cài nó chính là đề bài.",
  ],
  cards: [
    ["Bốn trục thường được chấm trong vòng coding?", "Giao tiếp, giải quyết vấn đề, kỹ năng code, kiểm thử."],
    ["Vì sao nên nói brute force dù biết nó chậm?", "Có lời giải đúng làm điểm sàn và mốc so sánh; chỗ lãng phí của brute force thường chỉ ra cách tối ưu."],
    ["Năm nhịp của một vòng coding?", "Làm rõ đề và ví dụ → brute force + độ phức tạp → tối ưu, xin xác nhận → code vừa nói → tự test, sửa bug, nói lại độ phức tạp."],
    ["Kẹt giữa chừng thì làm gì?", "Nói chỗ kẹt; vẽ; giải tay ví dụ nhỏ và ghi lại quy tắc; thử thêm ví dụ; chia bài con; rà các cấu trúc dữ liệu quen."],
    ["Edge case nên thử trước khi nói xong?", "Rỗng, một phần tử, toàn phần tử giống nhau, âm/0, cực trị (tràn số), off-by-one ở biên vòng lặp."],
    ["Nói to thế nào là đúng?", "Nói ý định, lý do chọn và lúc đổi hướng; không đọc từng ký tự đang gõ."],
    ["Vì sao kích thước input là câu hỏi làm rõ quan trọng?", "Nó quyết định độ phức tạp cần đạt: n tới 10⁵ thì O(n²) quá chậm, cần O(n log n) hoặc O(n)."],
  ],
});
