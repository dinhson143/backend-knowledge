BK.topic({
  id: "beh-common-questions",
  track: "beh",
  section: "beh-stories",
  title: "Câu hỏi behavioral hay gặp",
  goal: "Trả lời nhóm câu hỏi xung đột, thất bại, ownership, mơ hồ",
  needs: ["beh-star-stories"],
  tldr: {
    t: "Câu hỏi behavioral nghe thì nhiều nhưng gom lại chỉ khoảng mười nhóm: **xung đột**, **thất bại**, **dự án/bug khó nhất**, **deadline và ưu tiên**, **mơ hồ**, **ownership**, **feedback**, **ảnh hưởng không cần quyền**, **học nhanh**, và **động lực/phù hợp**. Mỗi nhóm kiểm một tín hiệu cụ thể. Nhận ra nhóm → chọn câu chuyện trong ngân hàng → kể theo STAR nhấn đúng tín hiệu đó.",
    why: "Tech Interview Handbook gom các câu hỏi phổ biến thành chừng ấy nhóm (https://www.techinterviewhandbook.org/behavioral-interview-questions/). Biết người hỏi đang tìm tín hiệu gì thì cùng một câu chuyện có thể kể nhấn vào chỗ khác: với câu hỏi xung đột thì nhấn cách bạn nói chuyện với người kia, với câu hỏi kỹ thuật thì nhấn quyết định.",
  },
  story: {
    problem: "Gặp câu hỏi chưa chuẩn bị (\"Kể về lần bạn không đồng ý với manager\"), ứng viên kể một chuyện kỹ thuật hay nhưng lạc đề: người chấm muốn thấy cách xử lý bất đồng, lại nghe về thiết kế cache.",
    idea: "Học theo nhóm, không theo từng câu. Mỗi nhóm có một tín hiệu cần chứng minh và một vài cái bẫy cần tránh; ngân hàng câu chuyện đã gắn nhãn theo đúng các nhóm này.",
    tradeoff: "Có câu hỏi rơi vào hai nhóm cùng lúc; khi đó chọn chuyện có tín hiệu mạnh nhất và nói rõ bạn đang trả lời khía cạnh nào.",
  },
  table: {
    head: ["Nhóm câu hỏi", "Người hỏi tìm tín hiệu gì", "Nên kể", "Bẫy"],
    rows: [
      {
        cells: ["**Xung đột / bất đồng** — với đồng nghiệp, manager, team khác", "Bất đồng có tôn trọng, dựa trên dữ liệu; cam kết khi đã chốt", "Bất đồng về kỹ thuật hoặc ưu tiên, giải quyết bằng dữ liệu hay thử nghiệm", "Kể người kia sai hoàn toàn; chuyện cá nhân không liên quan công việc"],
        why: "Câu hỏi này đo khả năng làm việc lâu dài với người khác. Chuyện tốt cho thấy bạn hiểu lý do của bên kia, đưa bất đồng về dữ liệu, và vẫn làm hết sức nếu phương án của bạn không được chọn (\"disagree and commit\").",
      },
      {
        cells: ["**Thất bại / sai lầm**", "Nhận trách nhiệm, xử lý, học và thay đổi", "Sai lầm thật của chính bạn có hậu quả vừa phải, kèm thay đổi lâu dài", "Thất bại giả (\"tôi quá cầu toàn\"); đổ lỗi; sai lầm gây hậu quả nghiêm trọng mà không có bài học"],
        why: "Ai cũng mắc lỗi; người chấm muốn biết bạn có nhìn thấy lỗi của mình và sửa gốc rễ không. Một postmortem không đổ lỗi, có checklist hay công cụ mới sau đó, là kết thúc mạnh.",
      },
      {
        cells: ["**Dự án / bug khó nhất**", "Độ sâu kỹ thuật, cách tiếp cận có hệ thống", "Chuyện kỹ thuật mạnh nhất, có quyết định và số liệu", "Kể dài về hệ thống, ít về cách bạn suy luận"],
        why: "Đây là cửa để vào phần kể sâu dự án (`beh-project-deep-dive`). Với bug, cách bạn thu hẹp vấn đề (log, trace, tái hiện, chia đôi) quan trọng hơn bản thân con bug.",
      },
      {
        cells: ["**Deadline / ưu tiên / áp lực**", "Biết cắt phạm vi, báo sớm, đánh đổi có ý thức", "Lần phải chọn giữa chất lượng và thời hạn, hoặc nhiều việc cùng lúc", "\"Tôi làm thêm giờ cho kịp\" là cả câu trả lời"],
        why: "Làm thêm giờ không phải kỹ năng có thể lặp lại. Tín hiệu tốt là bạn báo rủi ro sớm, đề xuất cắt phần ít giá trị, và nói rõ nợ kỹ thuật nào chấp nhận và trả lúc nào.",
      },
      {
        cells: ["**Mơ hồ** — yêu cầu không rõ, không ai biết đáp án", "Tự làm rõ, chia nhỏ, ra bản đầu sớm để lấy phản hồi", "Việc không có spec mà bạn tự định hình", "Chờ người khác quyết; hoặc tự làm luôn mà không hỏi ai"],
        why: "Càng lên cấp càng ít ai đưa sẵn yêu cầu rõ. Tín hiệu mạnh: bạn đặt câu hỏi đúng người, ghi lại giả định, giao bản nhỏ để kiểm giả định rồi mới làm lớn.",
      },
      {
        cells: ["**Ownership / chủ động** — làm việc ngoài phạm vi", "Thấy vấn đề và tự nhận, theo tới cùng", "Việc không ai giao mà bạn thấy cần và làm", "Làm ngoài phạm vi mà không báo ai, gây bất ngờ cho team"],
        why: "Ownership là theo việc tới khi xong, kể cả phần không thú vị (monitoring, tài liệu, dọn dẹp). Tự ý làm mà không đồng bộ thì lại là tín hiệu xấu về hợp tác.",
      },
      {
        cells: ["**Feedback** — nhận và đưa góp ý", "Nhận góp ý không phòng thủ; góp ý cho người khác cụ thể và tử tế", "Một góp ý làm bạn thay đổi cách làm thật", "Góp ý nhỏ nhặt; hoặc kể đã \"chỉ ra lỗi\" của người khác"],
        why: "Câu hỏi đo khả năng tiến bộ. Kể góp ý cụ thể, bạn đã làm gì khác sau đó, và kết quả của thay đổi đó.",
      },
      {
        cells: ["**Ảnh hưởng không cần quyền** — thuyết phục team/team khác", "Dẫn dắt bằng lý lẽ, dữ liệu, prototype", "Lần bạn đề xuất thay đổi kỹ thuật và được áp dụng", "Thắng tranh luận nhờ chức danh hoặc nhờ cấp trên ép"],
        why: "Kỹ sư senior thường phải thuyết phục người không báo cáo cho mình. Nêu cách bạn hiểu mối lo của từng bên và giảm rủi ro cho họ (thử nghiệm nhỏ, rollback dễ).",
      },
      {
        cells: ["**Học nhanh / công nghệ mới**", "Cách bạn học: nguồn, thử, hỏi", "Lần phải nắm thứ mới để giải quyết việc thật", "Liệt kê công nghệ đã học, không có vấn đề cụ thể"],
        why: "Công nghệ đổi liên tục; người chấm muốn thấy bạn có phương pháp học (đọc tài liệu chính thức, dựng thử nhỏ, hỏi người biết) chứ không chỉ danh sách kỹ năng.",
      },
      {
        cells: ["**Động lực / phù hợp** — vì sao công ty này, vì sao rời chỗ cũ", "Lý do thật, hướng tới chứ không chạy trốn", "Điều cụ thể về sản phẩm, bài toán, cách làm việc của họ", "Chê công ty cũ; câu trả lời dùng được cho mọi công ty"],
        why: "Câu này không cần STAR nhưng cần chuẩn bị. Nói xấu chỗ cũ khiến người nghe đoán bạn cũng sẽ nói vậy về họ; câu trả lời cụ thể cho thấy bạn đã tìm hiểu.",
      },
    ],
  },
  sections: [
    {
      title: "Ba câu trả lời mẫu (rút gọn)",
      table: {
        head: ["Câu hỏi", "Khung trả lời"],
        rows: [
          {
            cells: ["\"Kể về lần bạn bất đồng với tech lead.\"", "S/T: Tech lead muốn thêm read replica để giảm tải đọc; tôi nghĩ cache cho 3 endpoint nóng rẻ và nhanh hơn. A: Tôi hỏi rõ lo ngại của anh ấy (dữ liệu cũ trong cache), đề xuất đo thử cả hai trong 2 ngày trên môi trường staging với traffic ghi lại, và đặt TTL ngắn cho dữ liệu nhạy. R: Cache giảm 80% tải đọc ở 3 endpoint, replica vẫn được thêm sau cho báo cáo. Bài học: đưa bất đồng về số liệu sớm thay vì tranh luận ý kiến."],
            why: "Tín hiệu đúng nhóm: hiểu lý do bên kia, đề xuất cách kiểm chứng, kết quả không phải \"tôi thắng\" mà là cả hai ý được dùng đúng chỗ.",
          },
          {
            cells: ["\"Kể về một sai lầm của bạn.\"", "S/T: Tôi viết migration thêm cột có giá trị mặc định cho bảng đơn hàng lớn. A: Chạy giờ thấp điểm nhưng lệnh khoá bảng lâu hơn dự kiến, checkout lỗi 20 phút; tôi rollback, báo sự cố, viết postmortem không đổ lỗi. Sau đó tôi đề xuất checklist migration (thêm cột nullable trước, backfill theo lô, rồi mới thêm ràng buộc) và một bước review bắt buộc cho migration bảng lớn. R: Hai quý sau không còn sự cố migration. Bài học: thử migration trên bản sao dữ liệu cỡ thật."],
            why: "Lỗi có thật của chính mình, xử lý minh bạch, thay đổi mang tính hệ thống (checklist, review) chứ không chỉ \"lần sau cẩn thận hơn\".",
          },
          {
            cells: ["\"Bạn làm gì khi yêu cầu không rõ?\"", "S/T: Được giao \"làm báo cáo đối soát thanh toán\", không có spec. A: Tôi ngồi với hai người làm đối soát tay để xem họ thật sự so cái gì, viết lại thành 5 quy tắc và gửi để xác nhận, làm bản đầu chỉ cho một cổng thanh toán trong 1 tuần để họ dùng thử. R: Sau 3 vòng phản hồi, thời gian đối soát từ 2 ngày còn 2 giờ mỗi tháng. Bài học: bản đầu nhỏ giúp phát hiện yêu cầu sai sớm."],
            why: "Không chờ ai làm rõ, cũng không đoán rồi làm lớn: đi tìm người dùng thật, viết giả định ra, giao nhỏ để kiểm.",
          },
        ],
      },
    },
    {
      title: "Câu hỏi đào sâu nên chuẩn bị sẵn",
      points: [
        {
          t: "\"Nếu làm lại, bạn làm khác gì?\"",
          why: "Câu này gần như luôn được hỏi. Có sẵn một điểm cụ thể (đo sớm hơn, hỏi người dùng sớm hơn, chia nhỏ rollout) cho thấy bạn đã tự nhìn lại, thay vì trả lời \"không có gì\".",
        },
        {
          t: "\"Người kia phản ứng thế nào? Giờ hai người làm việc với nhau ra sao?\"",
          why: "Dành cho chuyện xung đột: người hỏi kiểm tra quan hệ có được giữ không. Kết thúc tốt là vẫn hợp tác bình thường, thậm chí tin nhau hơn.",
        },
        {
          t: "\"Số liệu đó đo bằng cách nào?\"",
          why: "Biết nguồn số (dashboard, trace, khảo sát) làm con số đáng tin. Không nhớ chính xác thì nói khoảng và nói rõ là ước lượng.",
        },
        {
          t: "\"Phần nào là của bạn, phần nào của team?\"",
          why: "Nếu đã kể bằng \"tôi\" và ghi công rõ thì câu này dễ. Nếu không, đây là lúc người hỏi phát hiện bạn chỉ đứng ngoài.",
        },
      ],
    },
    {
      title: "Không có câu chuyện phù hợp thì sao",
      points: [
        {
          t: "Xin vài giây suy nghĩ; chọn chuyện gần nhất và nói rõ nó gần ở điểm nào (\"Tôi chưa gặp xung đột với manager, nhưng có một lần bất đồng với tech lead…\").",
          why: "Im lặng vài giây không bị trừ điểm; bịa chuyện hoặc kể lạc đề mới bị. Nói thẳng khoảng cách giữa câu hỏi và chuyện của bạn cho thấy sự trung thực.",
        },
        {
          t: "Câu giả định (\"Bạn sẽ làm gì nếu…\") vẫn nên neo vào kinh nghiệm thật: trả lời cách làm, rồi thêm \"tôi từng gặp chuyện gần như vậy…\".",
          why: "Câu trả lời giả định ai cũng nói hay được; bằng chứng từ chuyện thật có sức nặng hơn hẳn.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Trước buổi phỏng vấn, viết bảng chéo: hàng là các nhóm câu hỏi, cột là câu chuyện; nhóm nào chưa có chuyện thì tìm thêm.",
      why: "Bảng chéo cho thấy ngay chỗ hổng. Thường thiếu nhất là chuyện thất bại và xung đột, vì không ai thích nhớ lại chúng.",
    },
    {
      t: "Đừng dùng một câu chuyện quá hai lần trong cùng một vòng phỏng vấn.",
      why: "Người chấm cần nhiều bằng chứng độc lập; một chuyện lặp lại cho mọi câu hỏi làm hồ sơ của bạn mỏng đi.",
    },
    {
      t: "Với câu hỏi động lực, chuẩn bị 2–3 lý do cụ thể về sản phẩm, bài toán kỹ thuật hoặc cách làm việc của công ty đó.",
      why: "Lý do cụ thể chứng tỏ bạn đã tìm hiểu và sẽ ở lại vì đúng thứ họ có; lý do chung chung (\"công ty lớn, nhiều cơ hội\") đúng với mọi nơi nên không thêm thông tin.",
    },
  ],
  cards: [
    [
      "Câu hỏi về xung đột muốn kiểm tra điều gì?",
      "Bạn bất đồng có tôn trọng, đưa về dữ liệu, giữ được quan hệ và vẫn cam kết khi phương án của mình không được chọn.",
    ],
    [
      "Câu trả lời \"thất bại\" nào bị đánh giá thấp?",
      "Thất bại giả (thực chất là khoe), đổ lỗi cho người khác, hoặc không có thay đổi gì sau đó.",
    ],
    [
      "Khi yêu cầu mơ hồ, tín hiệu tốt là gì?",
      "Tự đi làm rõ với người dùng thật, viết giả định ra, giao bản nhỏ sớm để kiểm rồi mới mở rộng.",
    ],
    [
      "\"Tôi làm thêm giờ cho kịp deadline\" thiếu gì?",
      "Thiếu kỹ năng lặp lại được: báo rủi ro sớm, cắt phạm vi có ý thức, nói rõ nợ kỹ thuật chấp nhận và kế hoạch trả.",
    ],
    [
      "Không có câu chuyện khớp câu hỏi thì làm gì?",
      "Xin vài giây, chọn chuyện gần nhất và nói rõ nó gần ở điểm nào; không bịa.",
    ],
  ],
});
