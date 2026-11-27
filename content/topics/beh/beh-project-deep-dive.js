BK.topic({
  id: "beh-project-deep-dive",
  track: "beh",
  section: "beh-stories",
  title: "Kể sâu về dự án",
  goal: "Vẽ lại kiến trúc dự án đã làm, nêu trade-off và số liệu",
  needs: ["beh-star-stories"],
  tldr: {
    t: "\"Kể về dự án bạn tự hào nhất\" là một bài system design **về hệ thống có thật của bạn**: người hỏi đào cho tới khi chạm giới hạn hiểu biết của bạn. Chuẩn bị theo 6 phần: **bối cảnh và quy mô** (có số), **kiến trúc** (vẽ được trong 2 phút), **vai trò của bạn**, **2–3 quyết định kỹ thuật** kèm phương án đã loại và trade-off, **kết quả đo được**, **sai lầm và nếu làm lại**.",
    why: "Vòng này chấm độ sâu thật: ai chỉ đứng ngoài dự án sẽ trả lời được câu đầu nhưng không trả lời được \"vì sao không dùng X\" hay \"lúc đó p99 là bao nhiêu\". Với ứng viên senior, người hỏi còn tìm khung ra quyết định, các phương án đã cân nhắc, phạm vi ảnh hưởng và cách dẫn dắt người khác (https://www.techinterviewhandbook.org/behavioral-interview-senior-candidates/).",
  },
  story: {
    problem: "Ứng viên làm hai năm trên một hệ thống nhưng khi được hỏi chỉ kể được danh sách công nghệ (\"dùng Spring Boot, Kafka, PostgreSQL\"). Bị hỏi \"vì sao chọn Kafka\" thì trả lời \"vì team đã dùng\"; hỏi \"bao nhiêu message mỗi giây\" thì không biết.",
    idea: "Coi dự án như một bài system design đã có đáp án: tự vẽ lại kiến trúc, tự trả lời các câu \"vì sao\" cho từng lựa chọn lớn, ôn lại các con số chính, và chuẩn bị thẳng thắn phần chưa tốt.",
    tradeoff: "Phải đào lại tài liệu, dashboard, ticket cũ để lấy số và lý do; có phần bạn không quyết định thì phải nói rõ, không nhận thay. Một số chi tiết nội bộ không được kể: ẩn tên và làm tròn số.",
  },
  table: {
    head: ["Phần", "Nói gì", "Câu người hỏi sẽ đào"],
    rows: [
      {
        cells: ["1. Bối cảnh & quy mô", "Hệ thống làm gì cho ai, vì sao quan trọng; số chính: người dùng, request/giây, dữ liệu, team", "\"Tải cao điểm là bao nhiêu?\" · \"Nếu hệ thống chết một giờ thì sao?\""],
        why: "Số quy mô cho người nghe biết bài toán khó tới đâu, giống bước capacity estimation trong system design (xem `numbers`). Tech Interview Handbook khuyên nêu quy mô qua chi tiết như số team hay khối lượng giao dịch để thể hiện scope.",
      },
      {
        cells: ["2. Kiến trúc", "Vẽ các khối chính và luồng của một request quan trọng; đánh dấu phần bạn làm", "\"Dữ liệu này nằm ở đâu?\" · \"Service này chết thì sao?\""],
        why: "Một sơ đồ 5–8 khối đủ để làm bản đồ cho cả buổi; người hỏi sẽ chỉ vào từng khối để đào. Vẽ quá chi tiết từ đầu thì mất thời gian và lộ phần bạn không nắm.",
      },
      {
        cells: ["3. Vai trò của bạn", "Bạn sở hữu phần nào, quyết định gì, làm với ai", "\"Ai quyết định chỗ này?\" · \"Bạn làm phần nào?\""],
        why: "Người chấm đánh giá **bạn**; vai trò rõ giúp họ biết chi tiết nào là hiểu biết trực tiếp. Nói thẳng phần không phải của mình (\"phần billing do team khác làm, tôi chỉ biết interface\") đáng tin hơn đoán.",
      },
      {
        cells: ["4. Quyết định kỹ thuật", "2–3 lựa chọn lớn: đã chọn gì, đã cân nhắc gì khác, vì sao, chấp nhận mất gì", "\"Vì sao không dùng X?\" · \"Bây giờ còn chọn vậy không?\""],
        why: "Đây là phần phân biệt người làm theo và người ra quyết định. Trả lời theo mẫu: ràng buộc lúc đó → các phương án → tiêu chí → chọn → cái giá. Nói được cái giá (\"đổi lại phải tự lo idempotency\") cho thấy bạn hiểu trade-off thật.",
      },
      {
        cells: ["5. Kết quả", "Trước/sau có số: latency, chi phí, sự cố, thời gian release, tác động kinh doanh", "\"Đo bằng gì?\" · \"Cải thiện đó có giữ được không?\""],
        why: "Ứng viên senior nên đặt kết quả kinh doanh lên trước, không giấu ở cuối câu chuyện (https://www.techinterviewhandbook.org/behavioral-interview-senior-candidates/). Biết cách đo cho thấy bạn quan tâm hệ thống sau khi ship.",
      },
      {
        cells: ["6. Sai lầm & nếu làm lại", "Một quyết định chưa tốt, sự cố đã gặp, bạn sẽ đổi gì", "\"Phần nào bạn chưa hài lòng?\""],
        why: "Hệ thống thật nào cũng có chỗ chưa ổn. Tự nói ra trước cho thấy bạn nhìn hệ thống một cách trung thực; bị hỏi mới thừa nhận thì kém hơn nhiều.",
      },
    ],
  },
  sections: [
    {
      title: "Các con số nên thuộc về hệ thống của bạn",
      points: [
        {
          t: "Tải: request/giây trung bình và cao điểm; tỉ lệ đọc/ghi; số message/giây qua hàng đợi.",
          why: "Đây là số đầu tiên người hỏi dùng để kiểm tra lựa chọn của bạn: 50 request/giây thì cần Kafka hay một bảng làm hàng đợi là đủ? Không biết số thì không bảo vệ được lựa chọn.",
        },
        {
          t: "Dữ liệu: kích thước database, tốc độ tăng, bảng lớn nhất; thời gian giữ dữ liệu.",
          why: "Quyết định về index, sharding, archive đều dựa vào số này (xem `sharding`, `indexing`).",
        },
        {
          t: "Chất lượng: p50/p99 latency của API chính, mục tiêu độ sẵn sàng và tỉ lệ lỗi, số sự cố mỗi quý; tần suất deploy.",
          why: "Đây là ngôn ngữ chung để nói \"tốt hơn\" một cách kiểm chứng được, và thường là con số trước/sau của chính dự án bạn kể.",
        },
        {
          t: "Con người và thời gian: team bao nhiêu người, dự án bao lâu, bạn tham gia giai đoạn nào.",
          why: "Cho người hỏi biết quy mô phối hợp và phần đóng góp tương đối của bạn; cũng là tín hiệu scope ở cấp senior.",
        },
      ],
    },
    {
      title: "Ví dụ khung: chuyển gửi thông báo sang hàng đợi",
      table: {
        head: ["Phần", "Ghi chú chuẩn bị (gạch đầu dòng, không viết văn)"],
        rows: [
          {
            cells: ["Bối cảnh", "API đặt hàng ~200 request/giây cao điểm; mỗi đơn gửi email + push; p99 1,8 s, timeout giờ cao điểm. Team 5 người, tôi là người đề xuất và làm chính."],
            why: "Đủ số để người nghe hình dung tải và vấn đề trong 20 giây.",
          },
          {
            cells: ["Kiến trúc", "API → PostgreSQL (đơn + bảng outbox, cùng transaction) → relay đọc outbox → hàng đợi → worker email/push → nhà cung cấp ngoài. Phần tôi làm: outbox, relay, worker."],
            why: "Luồng một request vẽ được bằng 6 khối; khoanh phần của mình để người hỏi biết đào chỗ nào.",
          },
          {
            cells: ["Quyết định 1", "Outbox thay vì gửi thẳng vào hàng đợi sau commit: tránh dual write (commit xong mà gửi hàng đợi lỗi là mất thông báo). Giá: thêm bảng và một relay phải vận hành."],
            why: "Quyết định có phương án bị loại và cái giá rõ ràng; dẫn tự nhiên sang câu hỏi đào về exactly-once.",
          },
          {
            cells: ["Quyết định 2", "Giao ít nhất một lần + idempotency key ở worker, thay vì cố đạt exactly-once. Giá: phải lưu key đã xử lý; nhà cung cấp push không hỗ trợ key nên chấp nhận hiếm khi trùng."],
            why: "Cho thấy bạn biết giới hạn thật của hệ thống phân tán và chấp nhận đánh đổi có ý thức thay vì hứa điều không làm được.",
          },
          {
            cells: ["Kết quả", "p99 đặt hàng 1,8 s → 250 ms; 0 timeout; nhà cung cấp email sập 30 phút mà đặt hàng không ảnh hưởng, thông báo gửi bù tự động. Đo bằng dashboard latency và số message trong DLQ."],
            why: "Trước/sau có số, có bằng chứng thiết kế chịu được sự cố thật, và nói được nguồn đo.",
          },
          {
            cells: ["Nếu làm lại", "Đặt cảnh báo độ trễ của outbox ngay từ đầu: tuần đầu relay chậm mà không ai biết, khách nhận email trễ 15 phút."],
            why: "Một sai lầm cụ thể, có hậu quả vừa phải, có bài học áp dụng được cho dự án sau.",
          },
        ],
      },
    },
    {
      title: "Khi bị hỏi tới chỗ bạn không biết",
      points: [
        {
          t: "Nói rõ ranh giới: \"Phần đó team hạ tầng làm, tôi biết nó cung cấp X; nếu phải đoán thì tôi nghĩ họ dùng Y vì Z.\"",
          why: "Người hỏi cố tình đào tới giới hạn hiểu biết của bạn; chạm giới hạn là bình thường. Đoán có lý lẽ và nói rõ là đoán cho thấy cách suy nghĩ; bịa thì mất điểm cả phần đã trả lời đúng.",
        },
        {
          t: "Câu \"bây giờ bạn sẽ thiết kế khác thế nào?\" là lời mời làm system design: nêu ràng buộc đã đổi (tải, team, công nghệ mới) rồi mới đề xuất.",
          why: "Thiết kế đúng phụ thuộc ràng buộc; nói \"tôi sẽ dùng microservices\" mà không nêu vì sao ràng buộc đã khác thì nghe như chạy theo xu hướng.",
        },
      ],
    },
    {
      title: "Bảo mật thông tin",
      points: [
        {
          t: "Ẩn tên khách hàng, tên hệ thống nội bộ, số liệu kinh doanh nhạy cảm; làm tròn hoặc dùng tỉ lệ (\"giảm 85%\").",
          why: "Người phỏng vấn đánh giá cả sự cẩn trọng với thông tin: kể chi tiết bí mật của chỗ cũ khiến họ lo bạn cũng sẽ làm vậy với họ. Kiến trúc tổng quát và các trade-off thì kể thoải mái.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Chuẩn bị một trang ghi chú cho mỗi dự án lớn: sơ đồ, 5 con số, 3 quyết định, 1 sai lầm. Đọc lại trước buổi phỏng vấn.",
      why: "Trí nhớ về số liệu và lý do mờ đi rất nhanh; một trang gọn đủ để ôn trong 5 phút mà không biến thành kịch bản học thuộc.",
    },
    {
      t: "Tập vẽ kiến trúc trong 2 phút trên bảng trắng hoặc công cụ vẽ online, vừa vẽ vừa nói luồng một request.",
      why: "Phỏng vấn online thường dùng bảng vẽ chung; vẽ chậm và lúng túng làm mất thời gian dành cho phần quyết định, là phần được chấm nhiều nhất.",
    },
    {
      t: "Chọn dự án mà bạn **ra quyết định**, không nhất thiết là dự án nổi tiếng nhất.",
      why: "Dự án lớn mà bạn chỉ làm một phần nhỏ khiến bạn bị đào trúng phần không biết; dự án vừa mà bạn nắm từ đầu tới cuối cho nhiều tín hiệu hơn.",
    },
  ],
  cards: [
    [
      "Sáu phần nên chuẩn bị cho một dự án là gì?",
      "Bối cảnh & quy mô, kiến trúc, vai trò của bạn, 2–3 quyết định kỹ thuật kèm trade-off, kết quả đo được, sai lầm & nếu làm lại.",
    ],
    [
      "Trả lời \"vì sao chọn X\" thế nào cho tốt?",
      "Ràng buộc lúc đó → các phương án đã cân nhắc → tiêu chí → chọn X → cái giá phải trả. \"Vì team đã dùng\" chỉ là một ràng buộc, không phải cả câu trả lời.",
    ],
    [
      "Bị hỏi tới phần mình không làm thì sao?",
      "Nói rõ ranh giới, nêu những gì biết về interface của nó, nếu đoán thì nói là đoán và có lý lẽ. Không bịa.",
    ],
    [
      "Những con số nào nên thuộc về hệ thống của mình?",
      "Request/giây trung bình và cao điểm, kích thước và tốc độ tăng dữ liệu, p50/p99 latency, tỉ lệ lỗi/sự cố, quy mô team và thời gian dự án.",
    ],
    [
      "Vì sao nên tự nói ra sai lầm của dự án?",
      "Hệ thống thật nào cũng có chỗ chưa tốt; tự nói ra cho thấy bạn nhìn trung thực và học được, bị hỏi mới thừa nhận thì kém thuyết phục.",
    ],
  ],
});
