BK.topic({
  id: "beh-star-stories",
  track: "beh",
  section: "beh-stories",
  title: "Khung STAR",
  goal: "Kể một câu chuyện theo STAR và có sẵn ngân hàng câu chuyện",
  tldr: {
    t: "Câu hỏi behavioral (\"Kể về một lần bạn…\") được chấm bằng **hành vi bạn đã làm thật**, không phải câu trả lời hay nhất về lý thuyết. Kể theo **STAR**: Situation (bối cảnh), Task (việc của bạn), Action (bạn làm gì, vì sao), Result (kết quả đo được), thêm một câu **bài học**. Đừng học thuộc từng câu hỏi: chuẩn bị sẵn **6–8 câu chuyện** thật, mỗi chuyện gắn nhãn những chủ đề nó trả lời được (xung đột, thất bại, ownership…).",
    why: "Người phỏng vấn dùng hành vi trong quá khứ để đoán cách bạn làm việc ở team của họ, nên họ cần chi tiết cụ thể về **việc bạn làm** và **vì sao** (https://www.techinterviewhandbook.org/behavioral-interview/). Câu trả lời chung chung (\"tôi luôn lắng nghe\") không cho họ bằng chứng nào. Một câu chuyện tốt thường trả lời được 3–4 câu hỏi khác nhau, nên một ngân hàng nhỏ đủ phủ phần lớn đề.",
  },
  story: {
    problem: "Kỹ sư backend chuẩn bị kỹ system design rồi trượt vòng behavioral: kể lan man năm phút về bối cảnh dự án, dùng \"chúng tôi\" suốt nên người nghe không biết bạn làm gì, kết thúc bằng \"rồi cũng xong\" không có con số. Hoặc bí câu hỏi \"kể về một thất bại\" vì chưa từng nghĩ trước.",
    idea: "Chuẩn bị trước như chuẩn bị một bài system design: chọn sẵn câu chuyện, viết khung STAR dạng gạch đầu dòng (không viết văn), tập kể thành tiếng trong khoảng 2 phút, rồi để người hỏi đào sâu chỗ họ quan tâm.",
    tradeoff: "Mất vài buổi để đào lại trí nhớ và tìm số liệu. Kể quá trơn tru như học thuộc lại làm mất tự nhiên; khung chỉ là dàn ý, không phải kịch bản.",
  },
  table: {
    head: ["Phần", "Nói gì", "Tỉ trọng gợi ý"],
    rows: [
      {
        cells: ["**S** — Situation", "Bối cảnh tối thiểu: team, hệ thống, vấn đề, quy mô", "~15%"],
        why: "Người nghe cần đủ bối cảnh để hiểu vì sao việc này khó, nhưng mỗi câu bối cảnh là một câu không nói về bạn. Bối cảnh dài là lỗi phổ biến nhất: hết hai phút mà chưa tới phần hành động.",
      },
      {
        cells: ["**T** — Task", "Trách nhiệm hoặc mục tiêu **của bạn**, ràng buộc (thời hạn, nguồn lực)", "~10%"],
        why: "Task tách việc của bạn khỏi việc của cả team, và cho thấy mức độ: được giao, tự nhận, hay tự phát hiện ra vấn đề. Tự phát hiện và tự nhận là tín hiệu ownership mạnh.",
      },
      {
        cells: ["**A** — Action", "Từng bước bạn làm, **vì sao** chọn cách đó, đã cân nhắc gì khác", "~50–60%"],
        why: "Đây là phần được chấm. Người phỏng vấn đánh giá hành vi và cách suy nghĩ, nên nói \"tôi đề xuất…, vì…\" thay vì \"team đã…\". Nêu phương án đã loại cho thấy bạn quyết định có cân nhắc, không làm theo quán tính.",
      },
      {
        cells: ["**R** — Result", "Kết quả đo được, ảnh hưởng tới người dùng hoặc team", "~15%"],
        why: "Con số biến \"làm tốt\" thành bằng chứng: p99 từ 2 s xuống 300 ms, sự cố giảm từ hằng tuần xuống không lần nào trong quý. Không có số thì nói kết quả quan sát được (team áp dụng quy trình mới, không còn ticket loại đó).",
      },
      {
        cells: ["(+) Bài học", "Bạn rút ra gì, lần sau làm khác ở đâu", "1–2 câu"],
        why: "Tech Interview Handbook gợi ý thêm bước Reflection vì nó cho thấy sự trưởng thành và mức senior (https://www.techinterviewhandbook.org/behavioral-interview/). Với câu hỏi về thất bại, phần này quan trọng ngang Action.",
      },
    ],
  },
  sections: [
    {
      title: "Chọn câu chuyện nào",
      points: [
        {
          t: "Ưu tiên chuyện có **tác động lớn**, **độ phức tạp cao** và **bạn tham gia sâu**; trong 2–3 năm gần nhất để còn nhớ chi tiết.",
          why: "Ba tiêu chí này là cách Tech Interview Handbook chọn dự án để chuẩn bị (https://www.techinterviewhandbook.org/behavioral-interview/). Chuyện cũ hoặc bạn chỉ đứng ngoài sẽ lộ ra ngay khi bị hỏi \"cụ thể bạn đã làm gì ở bước đó\".",
        },
        {
          t: "Đa dạng loại chuyện: một lần **ra mắt thành công**, một **sự cố/thất bại**, một **xung đột**, một lần **dẫn dắt** hoặc giúp người khác, một việc **mơ hồ** phải tự làm rõ, một lần **học nhanh** thứ mới.",
          why: "Mỗi loại khớp với một nhóm câu hỏi lớn (xem `beh-common-questions`). Thiếu loại nào thì gặp câu hỏi loại đó sẽ phải ứng biến, và ứng biến thường thiếu kết quả hoặc thiếu bài học.",
        },
        {
          t: "Dùng chuyện **thật**, có thể ẩn tên công ty, khách hàng, đồng nghiệp. Không bịa, không nhận công của người khác.",
          why: "Câu hỏi đào sâu (\"người kia phản ứng thế nào?\", \"số đó đo bằng gì?\") làm lộ chuyện bịa rất nhanh. Ẩn tên và số nội bộ nhạy cảm là bình thường; nói rõ \"tôi làm tròn số\" hoặc \"một khách hàng lớn\" là đủ.",
        },
        {
          t: "Kỹ sư mới đi làm: dùng đồ án, thực tập, dự án cá nhân, open source; tiêu chí vẫn như trên.",
          why: "Người phỏng vấn chấm hành vi theo kỳ vọng của cấp độ, không đòi quy mô lớn. Một lần tự debug lỗi khó trong đồ án, kể rõ cách thu hẹp vấn đề, vẫn là bằng chứng tốt.",
        },
      ],
    },
    {
      title: "Ngân hàng câu chuyện: một bảng chéo",
      points: [
        "Viết mỗi câu chuyện thành một dòng, gắn nhãn các chủ đề nó trả lời được. Trước buổi phỏng vấn, đọc lướt bảng này thay vì đọc kịch bản. Ví dụ ngân hàng của một kỹ sư backend (tình huống chung):",
      ],
      table: {
        head: ["Câu chuyện", "Chủ đề trả lời được", "Con số chốt"],
        rows: [
          {
            cells: ["Tách gửi thông báo khỏi request đặt hàng bằng hàng đợi", "Dự án tự hào, quyết định kỹ thuật, ảnh hưởng không cần quyền", "p99 đặt hàng 1,8 s → 250 ms"],
            why: "Một chuyện kỹ thuật mạnh nên trả lời được cả câu \"dự án khó nhất\" lẫn \"thuyết phục team\" nếu bạn là người đề xuất. Đây cũng là ứng viên tốt cho phần kể sâu dự án (`beh-project-deep-dive`).",
          },
          {
            cells: ["Migration làm khoá bảng, sập checkout 20 phút", "Thất bại, sai lầm, xử lý sự cố, cải tiến quy trình", "Sau đó: 0 sự cố migration trong 2 quý"],
            why: "Chuyện thất bại tốt là lỗi có thật của chính bạn, xử lý có trách nhiệm, và có thay đổi lâu dài (checklist, review migration, công cụ chạy online).",
          },
          {
            cells: ["Bất đồng với tech lead về dùng cache hay thêm read replica", "Xung đột, bất đồng có dữ liệu, cam kết khi không được chọn", "Benchmark 2 ngày chốt được"],
            why: "Xung đột nên là chuyện bất đồng về công việc, giải quyết bằng dữ liệu và tôn trọng. Nếu cuối cùng phương án của bạn không được chọn mà bạn vẫn làm hết sức, đó là điểm cộng.",
          },
          {
            cells: ["Nhận yêu cầu \"làm báo cáo đối soát\" không có spec", "Mơ hồ, chủ động, làm việc với bên nghiệp vụ", "Giảm đối soát tay 2 ngày → 2 giờ"],
            why: "Câu hỏi về mơ hồ chấm việc bạn tự đặt câu hỏi, chia nhỏ, giao bản đầu sớm để lấy phản hồi, thay vì chờ người khác làm rõ.",
          },
          {
            cells: ["Kèm một bạn mới vào on-call", "Dẫn dắt, giúp người khác, feedback", "Bạn ấy tự on-call sau 3 tuần"],
            why: "Kể cả không có chức danh lead, giúp người khác tiến bộ là tín hiệu được nhiều nơi chấm, nhất là từ cấp mid trở lên.",
          },
          {
            cells: ["Học Kafka trong 2 tuần để sửa consumer lag", "Học nhanh, xử lý áp lực, bug khó", "Lag từ 3 giờ về dưới 1 phút"],
            why: "Chuyện học nhanh hay nhất khi gắn với một vấn đề thật và cho thấy cách bạn học: đọc tài liệu chính thức, dựng thử, hỏi đúng người.",
          },
        ],
      },
    },
    {
      title: "Ví dụ mẫu ngắn",
      table: {
        head: ["", "Câu hỏi: \"Kể về một lần bạn cải thiện hiệu năng hệ thống\""],
        rows: [
          {
            cells: ["S", "Team 5 người phụ trách API đặt hàng. Sau khi thêm gửi email và đẩy thông báo ngay trong request, p99 lên 1,8 giây giờ cao điểm và thỉnh thoảng timeout."],
            why: "Hai câu, có con số, nói được vì sao đây là vấn đề. Không kể lịch sử công ty hay cả kiến trúc.",
          },
          {
            cells: ["T", "Tôi được giao điều tra; mục tiêu tôi tự đặt là p99 dưới 300 ms mà không mất thông báo nào."],
            why: "Tách rõ phần được giao và phần tự đặt mục tiêu; mục tiêu có số để cuối chuyện đối chiếu.",
          },
          {
            cells: ["A", "Tôi đo bằng trace và thấy 70% thời gian nằm ở hai lần gọi nhà cung cấp email/push. Tôi đề xuất đưa chúng ra hàng đợi: request chỉ ghi đơn và một bản ghi outbox trong cùng transaction, worker gửi sau. Tôi cân nhắc gọi bất đồng bộ trong process nhưng loại vì process chết là mất thông báo. Tôi viết thiết kế một trang, thống nhất với team về retry và chống gửi trùng bằng idempotency key, rồi rollout sau feature flag cho 10% traffic."],
            why: "Hành động cụ thể theo thứ tự (đo → tìm nguyên nhân → phương án → phương án bị loại và vì sao → triển khai an toàn). Mỗi động từ có chủ ngữ \"tôi\". Chi tiết kỹ thuật vừa đủ để người hỏi đào tiếp nếu muốn.",
          },
          {
            cells: ["R", "p99 xuống 250 ms, không còn timeout; hai tháng sau nhà cung cấp email sập nửa giờ mà đặt hàng không bị ảnh hưởng, thông báo được gửi bù tự động."],
            why: "Kết quả có số và có một bằng chứng thứ hai (sự cố về sau không lan sang) cho thấy thiết kế đúng chứ không chỉ may mắn.",
          },
          {
            cells: ["Bài học", "Tôi học được là đo trước khi sửa; giờ tôi thêm trace cho mọi lời gọi ra ngoài ngay từ đầu."],
            why: "Một câu, cụ thể, có thay đổi hành vi về sau. Bài học chung chung (\"giao tiếp quan trọng\") không thêm thông tin gì.",
          },
        ],
      },
    },
    {
      title: "Lỗi hay gặp",
      points: [
        {
          t: "Nói \"chúng tôi\" suốt câu chuyện.",
          why: "Người phỏng vấn đang chấm **bạn**; \"chúng tôi\" khiến họ không phân biệt được phần của bạn và phải hỏi lại, tốn thời gian. Dùng \"tôi\" cho việc bạn làm và \"team\" cho việc của người khác, ghi công rõ ràng.",
        },
        {
          t: "Bối cảnh quá dài, kết quả không có.",
          why: "Câu trả lời 2–3 phút là vừa (đây là gợi ý của site, không phải luật); quá 4 phút người nghe mất mạch và còn ít thời gian cho câu hỏi khác. Thiếu kết quả thì câu chuyện không có đích, người nghe không biết hành động có hiệu quả không.",
        },
        {
          t: "Đổ lỗi cho người khác, hoặc chọn \"thất bại\" thực chất là khoe (\"tôi làm việc quá chăm\").",
          why: "Cả hai cho thấy thiếu tự nhìn lại, đúng thứ câu hỏi muốn kiểm tra. Chuyện thất bại thật, nhận phần lỗi của mình, đáng tin hơn nhiều.",
        },
        {
          t: "Học thuộc từng chữ.",
          why: "Kể như đọc làm nghe giả, và khi bị ngắt bằng câu hỏi phụ bạn dễ mất mạch. Chỉ thuộc dàn ý và con số; câu chữ để tự nhiên.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Tập kể thành tiếng, có hẹn giờ, hoặc nhờ bạn đóng vai người hỏi và hỏi đào sâu.",
      why: "Nói thành tiếng lộ ra chỗ lan man và chỗ thiếu số liệu mà đọc trong đầu không thấy; mock interview còn cho thấy ngân hàng của bạn thiếu loại chuyện nào (https://www.techinterviewhandbook.org/behavioral-interview/).",
    },
    {
      t: "Trước buổi phỏng vấn, đọc giá trị của công ty và đánh dấu chuyện nào thể hiện giá trị nào.",
      why: "Nhiều công ty chấm behavioral theo bộ giá trị riêng; chọn chuyện khớp giá trị giúp người chấm dễ ghi nhận đúng tín hiệu.",
    },
    {
      t: "Mở đầu bằng một câu tóm tắt (\"Đây là lần tôi giảm p99 API đặt hàng từ 1,8 s xuống 250 ms\") rồi mới vào STAR.",
      why: "Người nghe biết ngay đích của câu chuyện nên theo dõi dễ hơn, và nếu bị cắt ngang giữa chừng thì kết quả quan trọng nhất đã được nói.",
    },
  ],
  cards: [
    [
      "STAR gồm những phần nào, phần nào chiếm nhiều thời gian nhất?",
      "Situation, Task, Action, Result (thêm bài học). Action chiếm khoảng một nửa trở lên vì đó là phần được chấm.",
    ],
    [
      "Vì sao nên chuẩn bị 6–8 câu chuyện thay vì học thuộc đáp án từng câu hỏi?",
      "Một chuyện tốt trả lời được nhiều câu hỏi khác nhau; ngân hàng nhỏ, đa dạng loại (thành công, thất bại, xung đột, dẫn dắt, mơ hồ, học nhanh) phủ phần lớn đề mà vẫn kể tự nhiên.",
    ],
    [
      "Kể \"chúng tôi đã làm…\" có vấn đề gì?",
      "Người phỏng vấn chấm cá nhân bạn; họ không tách được phần bạn làm. Dùng \"tôi\" cho việc của bạn, ghi công rõ cho người khác.",
    ],
    [
      "Kết quả không có con số thì nói gì?",
      "Kết quả quan sát được: hành vi team đổi, sự cố không lặp lại, người dùng/đội khác áp dụng. Có thể nói số đã làm tròn hoặc ẩn khi nhạy cảm.",
    ],
    [
      "Một câu chuyện thất bại tốt cần có gì?",
      "Lỗi thật có phần trách nhiệm của bạn, cách bạn xử lý ngay lúc đó, thay đổi lâu dài sau đó và bài học cụ thể.",
    ],
  ],
});
