BK.topic({
  id: "dev-methods",
  track: "arch",
  section: "arch-main",
  title: "Phương pháp phát triển: TDD, BDD, ATDD, DDD và hơn thế",
  tldr: {
    t: "TDD là cách **viết code**: test trước, code sau, vòng Red → Green → Refactor. BDD và ATDD đưa ý tưởng đó lên mức **hành vi và tiêu chí nghiệm thu** để dev, QA, PO hiểu chung. DDD là cách **thiết kế mô hình nghiệp vụ**, thường đi cùng Hexagonal/Clean. Contract testing và property-based testing là hai kỹ thuật test bổ sung khi hệ thống lớn dần.",
    why: "TDD, BDD, ATDD và DDD không thay thế nhau mà xếp lớp được. Ba cái đầu khác nhau ở **mức** của thứ được kiểm chứng trước (hàm, hành vi, tiêu chí story); DDD trả lời câu hỏi khác hẳn: mô hình nghiệp vụ trông thế nào.",
  },
  story: {
    problem: "Viết code xong mới viết test (hoặc không viết) → test bám theo code có sẵn, bỏ sót edge case, mỗi lần refactor là một lần cầu may. Yêu cầu mơ hồ khiến dev làm đúng ý mình nhưng sai ý business.",
    idea: "Đặt kiểm chứng **trước** khi viết code: TDD ở mức hàm, BDD/ATDD ở mức hành vi và tiêu chí nghiệm thu; DDD đặt mô hình nghiệp vụ làm trung tâm để code nói đúng ngôn ngữ business.",
    tradeoff: "Tốn thời gian lúc đầu và cần kỷ luật; áp máy móc (test mọi getter, Gherkin cho mọi thứ, DDD cho CRUD) thì chi phí lớn hơn lợi ích.",
  },
  table: {
    head: ["Phương pháp", "Bắt đầu từ", "Lợi", "Bất lợi", "Dùng khi"],
    rows: [
      {
        cells: [
          "TDD (Test-Driven Development)",
          "Một unit test nhỏ chạy đỏ, rồi viết code tối thiểu cho xanh, rồi refactor",
          "Code nhỏ, dễ test; có lưới an toàn khi refactor; mỗi bug fix kèm test tái hiện",
          "Chậm lúc đầu; test gắn chặt implementation thì dễ vỡ khi refactor; khó áp cho UI hay code đang khám phá",
          "Logic nghiệp vụ, thư viện, thuật toán, sửa bug",
        ],
        why: "Viết test trước buộc code gọi được từ bên ngoài với input rõ ràng → code tự nhiên nhỏ, ít phụ thuộc; bộ test tích luỹ thành lưới an toàn cho refactor. Test kiểm tra chi tiết nội bộ thay vì hành vi thì vỡ mỗi lần refactor — lợi ích thành gánh nặng.",
      },
      {
        cells: [
          "BDD (Behavior-Driven Development)",
          "Kịch bản hành vi `Given / When / Then` viết cùng PO, QA bằng ngôn ngữ nghiệp vụ",
          "Ngôn ngữ chung giữa business và dev; kịch bản thành tài liệu sống, chạy được",
          "Tốn công duy trì file Gherkin và step definition; chạy chậm nếu qua UI; dễ thành hình thức",
          "Luật nghiệp vụ phức tạp, nhiều bên cùng quyết định",
        ],
        why: "Hiểu sai được phát hiện trước khi code, vì kịch bản viết bằng ngôn ngữ nghiệp vụ nên PO, QA đọc và sửa được. Mỗi câu Given/When/Then cần step definition và thường chạy qua nhiều lớp → duy trì tốn công, chạy chậm.",
      },
      {
        cells: [
          "ATDD (Acceptance Test-Driven Development)",
          "Acceptance test cho tiêu chí nghiệm thu của story, viết trước khi làm",
          "Định nghĩa “xong” rõ ràng, giảm hiểu sai yêu cầu",
          "Acceptance test thường là integration test: chậm, tốn hạ tầng",
          "Story có tiêu chí rõ, team có QA tham gia sớm",
        ],
        why: "“Xong” nghĩa là test pass, không phải “dev thấy ổn”, vì tiêu chí nghiệm thu được viết thành test tự động trước khi làm. Các test này chạm nhiều thành phần nên cần môi trường và chạy lâu.",
      },
      {
        cells: [
          "DDD (Domain-Driven Design)",
          "Làm mô hình nghiệp vụ cùng chuyên gia domain: ubiquitous language, bounded context, aggregate",
          "Quản được nghiệp vụ phức tạp; ranh giới module/service đúng chỗ",
          "Tốn thời gian học và thảo luận; overkill cho CRUD",
          "Domain phức tạp: tài chính, bảo hiểm, logistics, đặt chỗ",
        ],
        why: "Ranh giới module/service khớp với cách business vận hành, vì bounded context chia hệ thống theo chỗ thuật ngữ nghiệp vụ đổi nghĩa. Cần nhiều buổi làm việc với chuyên gia domain — vô ích nếu nghiệp vụ chỉ là CRUD.",
      },
      {
        cells: [
          "Consumer-Driven Contract Testing",
          "Consumer khai báo hợp đồng API mong đợi (Pact); provider chạy kiểm tra hợp đồng trong CI",
          "Bắt breaking change trước khi deploy mà không cần E2E chậm",
          "Cần contract broker và kỷ luật giữa các team",
          "Microservices nhiều team gọi nhau",
        ],
        why: "Đổi một field mà consumer cần sẽ đỏ trong CI của provider — trước khi deploy — vì provider kiểm tra theo đúng những gì consumer thật sự dùng. Cần một broker lưu hợp đồng, và các team phải giữ hợp đồng cập nhật.",
      },
      {
        cells: [
          "Property-Based Testing",
          "Khai báo tính chất luôn đúng; framework (Hypothesis, fast-check) tự sinh hàng trăm input",
          "Tìm edge case con người không nghĩ ra, tự thu gọn về ví dụ nhỏ nhất",
          "Khó nghĩ ra property đúng; chạy lâu hơn; cần cố định seed để tái hiện",
          "Parser, tính toán, serialize/deserialize, luật biên",
        ],
        why: "Property-based test tìm được bug mà ví dụ viết tay bỏ sót, vì framework sinh rất nhiều input, kể cả giá trị biên, rồi tự thu gọn lỗi về ví dụ nhỏ nhất. Khó ở chỗ phải nêu được tính chất đúng với mọi input.",
      },
    ],
  },
  sections: [
    {
      title: "Chúng kết hợp với nhau thế nào",
      points: [
        {
          t: "**Double-loop TDD** — vòng ngoài là acceptance test (BDD/ATDD) mô tả hành vi; vòng trong là nhiều vòng TDD unit test để hiện thực hành vi đó.",
          why: "Cần cả hai vòng: acceptance test cho biết khi nào tính năng xong, unit test dẫn dắt từng mảnh code bên trong. Chỉ có vòng ngoài thì debug chậm; chỉ có vòng trong thì có thể đúng từng hàm mà sai tính năng.",
        },
        {
          t: "**DDD + Hexagonal/Clean** — DDD cho biết domain có gì (entity, value object, aggregate, domain event); Hexagonal/Clean cho biết đặt domain đó ở đâu để không dính hạ tầng.",
          why: "Mô hình domain chỉ giữ được thuần khi kiến trúc ngăn nó import hạ tầng; ngược lại kiến trúc sạch mà domain nghèo nàn thì core chẳng có gì để bảo vệ.",
        },
        {
          t: "**Testing pyramid** — nhiều unit test (nhanh, rẻ), ít integration test, rất ít E2E test (chậm, dễ flaky).",
          why: "Dồn phần lớn kiểm chứng xuống tầng rẻ và ổn định: unit test chạy mili-giây và chỉ hỏng vì một lý do, còn E2E chạy vài giây đến vài phút và hỏng vì mạng, dữ liệu, timing.",
        },
      ],
    },
    {
      title: "DDD: các khái niệm cần biết",
      table: {
        head: ["Khái niệm", "Là gì"],
        rows: [
          {
            cells: [
              "Ubiquitous language",
              "Một bộ từ ngữ chung giữa business và code: tên class, method dùng đúng thuật ngữ nghiệp vụ",
            ],
            why: "Code dùng đúng từ của business → cuộc trò chuyện với chuyên gia domain chuyển thẳng thành code, không qua bước “dịch” dễ sai.",
          },
          {
            cells: [
              "Bounded context",
              "Phạm vi mà một mô hình có nghĩa nhất quán; “Customer” ở Billing khác “Customer” ở Shipping",
            ],
            why: "Tách context để mỗi nơi có một model vừa đủ — cố dùng một model Customer cho mọi nơi sẽ thành class khổng lồ đầy field không liên quan.",
          },
          ["Entity", "Đối tượng có danh tính, sống qua thời gian (Order #123)"],
          ["Value object", "Đối tượng định nghĩa bằng giá trị, bất biến (Money 50 USD, Address)"],
          {
            cells: ["Aggregate", "Cụm entity sửa cùng nhau qua một gốc (aggregate root), là ranh giới transaction"],
            why: "Luật bất biến (tổng đơn = tổng item) luôn được kiểm tra, vì mọi thay đổi đi qua aggregate root; một transaction chỉ sửa một aggregate để giữ khoá nhỏ.",
          },
          {
            cells: ["Domain event", "Sự kiện nghiệp vụ đã xảy ra (`OrderPlaced`), để phần khác phản ứng"],
            why: "Phát event thay vì gọi trực tiếp → các phần khác phản ứng mà aggregate không phải biết tới chúng. Đây là nền tảng cho event-driven giữa các service.",
          },
        ],
      },
    },
    {
      title: "Không phải phương pháp code nhưng hay bị hỏi",
      points: [
        {
          t: "**Agile / Scrum / Kanban** — cách tổ chức công việc của team (sprint, backlog, WIP limit), không quy định cách viết code.",
          why: "Đừng trả lời “Scrum” khi được hỏi cách đảm bảo chất lượng code: đây là khung quản lý công việc, một team Scrum vẫn có thể viết code không test.",
        },
        {
          t: "**XP (Extreme Programming)** — gói thực hành kỹ thuật: TDD, pair programming, continuous integration, refactor liên tục, release nhỏ.",
          why: "Nhắc XP cho thấy bạn biết TDD là một phần của bộ thực hành kỹ thuật, không đứng một mình — XP là nơi TDD và CI xuất phát.",
        },
        "**Pair / Mob programming** — hai hoặc cả nhóm cùng viết một đoạn code: review tức thời, lan truyền kiến thức.",
        {
          t: "**Trunk-based development** — mọi người merge vào nhánh chính nhiều lần mỗi ngày, ẩn tính năng dở bằng feature flag.",
          why: "Merge nhỏ, thường xuyên cộng feature flag giữ nhánh chính luôn deploy được; nhánh sống lâu thì gây merge conflict lớn.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Phân biệt rõ khi trả lời: TDD/BDD là cách viết và kiểm chứng code; DDD là cách thiết kế mô hình; Scrum/Kanban là cách tổ chức công việc.",
      why: "Phân loại đúng cho thấy hiểu mỗi thứ giải quyết vấn đề gì — nhiều ứng viên trộn lẫn ba loại này.",
    },
    {
      t: "Khi nói về TDD, nhắc vòng Red → Green → Refactor và lợi ích thật: refactor an toàn, không phải “để có coverage”.",
      why: "Giá trị thật của TDD là thiết kế nhỏ gọn và refactor không sợ; coverage cao vẫn có thể kiểm tra sai thứ.",
    },
  ],
  cards: [
    [
      "3 bước của TDD?",
      "Red: viết test chạy đỏ. Green: viết code tối thiểu cho test xanh. Refactor: dọn code khi vẫn giữ test xanh.",
    ],
    [
      "TDD khác BDD thế nào?",
      "TDD bắt đầu từ unit test do dev viết, kiểm tra từng đơn vị code. BDD bắt đầu từ kịch bản hành vi Given/When/Then viết cùng business, kiểm tra hành vi hệ thống.",
    ],
    [
      "DDD có phải kiến trúc không?",
      "Không. DDD là cách thiết kế mô hình nghiệp vụ (bounded context, aggregate…); thường hiện thực trong kiến trúc Hexagonal/Clean.",
    ],
    [
      "Property-based testing hơn example-based ở đâu?",
      "Framework tự sinh rất nhiều input để kiểm tra một tính chất luôn đúng, tìm được edge case (biên, giá trị lạ) mà ví dụ viết tay bỏ sót.",
    ],
  ],
});
