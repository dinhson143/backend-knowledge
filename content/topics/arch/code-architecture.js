BK.topic({
  id: "code-architecture",
  track: "arch",
  section: "arch-main",
  title: "Kiến trúc code: Layered → Clean",
  tldr: {
    t: "Các kiểu này đều trả lời một câu hỏi: **code nào được phép phụ thuộc vào code nào**. Layered cho phụ thuộc đi từ trên xuống nên business dính vào data access. Hexagonal, Onion, Clean **đảo ngược** để mọi phụ thuộc hướng vào domain — DB, web, framework chỉ là chi tiết cắm ở ngoài. Vertical Slice cắt theo **tính năng** thay vì theo tầng.",
    why: "Mọi kiến trúc code thực chất là luật về `import`: ai được biết ai. Layered cho business biết data access, vì đó là cách tự nhiên nhất khi gọi từ trên xuống. Hexagonal/Onion/Clean dùng Dependency Inversion — core định nghĩa interface, hạ tầng cài đặt — nên mũi tên phụ thuộc đảo chiều vào trong.",
  },
  story: {
    problem: "Code mới đầu gọn, nhưng sau một năm: service gọi thẳng ORM, controller chứa luật nghiệp vụ, đổi một thư viện là sửa khắp nơi. Test một luật giảm giá phải dựng cả DB.",
    idea: "Quy định rõ **hướng phụ thuộc**: luật nghiệp vụ không được biết DB, web hay framework. Phần hay đổi (hạ tầng) phụ thuộc vào phần ít đổi (nghiệp vụ), không ngược lại.",
    tradeoff: "Thêm interface, mapping, thư mục → code dài hơn, lúc đầu làm chậm hơn. Với app CRUD nhỏ, cái giá này thường lớn hơn lợi ích.",
  },
  table: {
    head: ["Kiến trúc", "Ý tưởng chính", "Lợi", "Bất lợi", "Hợp khi"],
    rows: [
      {
        cells: [
          "Layered (N-tier)",
          "Presentation → Business → Data Access → DB; mỗi tầng chỉ gọi tầng ngay dưới",
          "Dễ hiểu, framework hỗ trợ sẵn (Spring, Django, NestJS), người mới vào làm được ngay",
          "Business phụ thuộc DB/ORM nên khó test thuần; thêm một tính năng phải chạm mọi tầng; dễ thành service “mỏng” chỉ chuyển tiếp",
          "CRUD, app nhỏ–vừa, đội mới, deadline gấp",
        ],
        why: "Đổi cách lưu trữ hay test business đều kéo theo DB, vì tầng Business gọi thẳng Repository cụ thể. Đổi lại, cấu trúc này khớp cách framework sinh code nên ai cũng làm được ngay.",
      },
      {
        cells: [
          "Hexagonal (Ports & Adapters)",
          "Core ở giữa; nói chuyện với bên ngoài qua **port** (interface); **adapter** cài đặt port cho từng công nghệ",
          "Đổi DB, queue, kênh vào mà không chạm core; test core bằng adapter in-memory; nhiều kênh (REST, gRPC, consumer) dùng chung một use case",
          "Nhiều interface và mapping DTO, code dài hơn; quá sức với CRUD đơn giản",
          "Nhiều tích hợp bên ngoài, cần đổi hạ tầng, cần test nghiệp vụ kỹ",
        ],
        why: "Mọi công nghệ bên ngoài chỉ là adapter cắm vào, vì core chỉ biết interface do chính nó định nghĩa (port): thay Postgres bằng Mongo là viết adapter mới, core không biết gì. Cái giá: mỗi tích hợp cần thêm một interface và chuyển đổi dữ liệu qua lại.",
      },
      {
        cells: [
          "Onion",
          "Các vòng đồng tâm: Domain Model → Domain Services → Application Services → ngoài cùng là Infrastructure, UI, Tests",
          "Domain hoàn toàn thuần; tách rõ luật nghiệp vụ lõi với điều phối ứng dụng",
          "Nhiều vòng cần kỷ luật; ranh giới giữa các vòng bên trong dễ mơ hồ với người mới",
          "Domain phức tạp, hệ thống enterprise sống lâu",
        ],
        why: "Onion tách luật nghiệp vụ thuần (domain model, domain services) khỏi phần điều phối (application services) — cùng ý tưởng với Hexagonal nhưng chia lõi thành nhiều vòng. Càng nhiều vòng càng cần quy ước rõ để mọi người đặt code đúng chỗ.",
      },
      {
        cells: [
          "Clean Architecture",
          "Entities → Use Cases → Interface Adapters → Frameworks & Drivers; **Dependency Rule**: phụ thuộc chỉ hướng vào trong",
          "Độc lập framework, UI, DB; mỗi use case là một class rõ ràng; dễ test và đọc nghiệp vụ",
          "Nhiều boilerplate (request/response model, presenter, mapper); dễ over-engineer",
          "App sống lâu, nghiệp vụ dày, đội lớn cần quy ước chung",
        ],
        why: "Use case không bao giờ thấy object của framework (request HTTP, entity ORM), vì Dependency Rule bắt dữ liệu qua ranh giới phải là DTO đơn giản. Nhờ vậy use case đọc như mô tả nghiệp vụ và test thuần được — nhưng mỗi ranh giới lại cần mapper và model riêng.",
      },
      {
        cells: [
          "Vertical Slice",
          "Mỗi tính năng là một lát dọc chứa đủ endpoint → handler → truy vấn dữ liệu",
          "Thêm tính năng không chạm code tính năng khác; ít abstraction; mỗi slice chọn cách làm vừa đủ",
          "Dễ trùng lặp giữa các slice; luật nghiệp vụ dùng chung không có chỗ rõ ràng nếu không refactor đều đặn",
          "Nhiều tính năng độc lập, CQRS, đội muốn ship nhanh",
        ],
        why: "Thay đổi một tính năng chỉ chạm một thư mục, không chạm `OrderService` dùng chung, vì code gom theo tính năng → giảm xung đột giữa người và giữa tính năng. Mặt trái: phần dùng chung dễ bị copy sang nhiều slice nếu không ai chủ động rút ra.",
      },
    ],
  },
  sections: [
    {
      title: "Hexagonal, Onion, Clean khác nhau ở đâu?",
      points: [
        {
          t: "**Cùng một nguyên lý** — Dependency Inversion: core định nghĩa interface (port/repository), lớp ngoài cài đặt → core không `import` bất kỳ thứ gì của DB hay web.",
          why: "Core biên dịch được mà không cần thư viện DB hay web nào, vì interface nằm trong core; lớp ngoài `import` core để cài đặt interface, không có chiều ngược lại.",
        },
        {
          t: "**Hexagonal** chỉ chia **trong / ngoài**, và phân biệt adapter **driving** (gọi vào: REST controller, CLI, consumer) với **driven** (bị gọi ra: DB, payment gateway, email).",
          why: "Tách driving và driven cho thấy rõ ai khởi động luồng: driving adapter gọi use case, use case gọi driven adapter qua port → test thay được cả hai đầu bằng đồ giả.",
        },
        {
          t: "**Onion** chia phần lõi thành nhiều vòng: domain model, domain services, application services.",
          why: "Để chung một chỗ thì luật nghiệp vụ dễ lẫn với chi tiết kỹ thuật, vì luật áp lên nhiều entity (domain service) khác với code điều phối một use case (application service: mở transaction, gọi repository).",
        },
        {
          t: "**Clean** đặt tên vòng theo vai trò, mỗi use case là một class (interactor), và quy định dữ liệu qua ranh giới phải là DTO đơn giản, không phải entity hay object của framework.",
          why: "DTO đơn giản giữ ranh giới sạch. Use case nhận thẳng entity ORM hay request HTTP là lại phụ thuộc framework — đúng thứ kiến trúc muốn tránh.",
        },
        {
          t: "**Thực tế** các đội thường gộp lại thành 4 phần: `domain` + `application` (use cases, ports) + `adapters` (in/out) + cấu hình hạ tầng — gọi chung là “Clean/Hexagonal”.",
          why: "Chọn bộ thư mục đơn giản nhất thể hiện được hướng phụ thuộc, thay vì tranh luận tên gọi — tên vòng khác nhau nhưng cấu trúc phụ thuộc giống nhau.",
        },
        {
          t: "**MVC** không cùng loại: đó là pattern cho **tầng giao diện** (Model–View–Controller), nằm trong Presentation layer hoặc trong một driving adapter.",
          why: "MVC chỉ chia trách nhiệm hiển thị (model dữ liệu cho view, view render, controller nhận input) — nó không nói gì về chuyện business có được biết DB hay không.",
        },
      ],
    },
    {
      title: "Cấu trúc thư mục ví dụ",
      table: {
        head: ["Kiến trúc", "Thư mục"],
        rows: [
          {
            cells: ["Layered", "`controllers/` `services/` `repositories/` `models/`"],
            why: "Thư mục theo loại kỹ thuật, nên một tính năng rải ra 3–4 thư mục.",
          },
          {
            cells: [
              "Hexagonal",
              "`domain/` · `application/ports/in` `application/ports/out` · `adapters/in/web` `adapters/out/postgres`",
            ],
            why: "Thư mục theo phía của ranh giới: `domain`/`application` không được import gì từ `adapters`.",
          },
          ["Onion", "`Domain.Model/` `Domain.Services/` `Application/` `Infrastructure/` `Web/`"],
          {
            cells: [
              "Clean",
              "`entities/` `usecases/` `interface_adapters/` (controllers, presenters, gateways) `frameworks/` (web, db)",
            ],
            why: "Mỗi vòng một thư mục; quy tắc import chỉ đi vào trong có thể kiểm tra tự động (ArchUnit, import-linter).",
          },
          {
            cells: [
              "Vertical Slice",
              "`features/place_order/` (endpoint, handler, query) · `features/cancel_order/` · `shared/`",
            ],
            why: "Thư mục theo tính năng: xoá một tính năng là xoá một thư mục.",
          },
        ],
      },
    },
    {
      title: "Chọn thế nào",
      points: [
        {
          t: "**Mặc định Layered** cho CRUD và app nhỏ: ít khái niệm, ship nhanh.",
          why: "Lớp abstraction thêm vào không bảo vệ được gì khi phần lớn code chỉ đọc/ghi bảng, không có luật nghiệp vụ dày để bảo vệ.",
        },
        {
          t: "**Chuyển sang Hexagonal/Clean** khi logic nghiệp vụ dày, có nhiều hệ thống bên ngoài phải tích hợp, hoặc cần test nghiệp vụ mà không dựng DB.",
          why: "Kiến trúc đảo phụ thuộc giữ luật nghiệp vụ — tài sản đắt nhất lúc đó — khỏi bị kéo theo khi hạ tầng thay đổi thường xuyên.",
        },
        {
          t: "**Vertical Slice** khi có nhiều tính năng độc lập; có thể kết hợp — bên trong một slice phức tạp vẫn dùng port/adapter.",
          why: "Dùng chung được, vì hai hướng giải hai vấn đề khác nhau: slice giảm xung đột giữa tính năng, port/adapter giảm phụ thuộc hạ tầng.",
        },
        {
          t: "**Điều quan trọng là hướng phụ thuộc**, không phải tên thư mục: đặt thư mục kiểu Clean nhưng use case vẫn `import` ORM thì vẫn là Layered.",
          why: "Kiến trúc nằm ở câu lệnh `import`, không ở tên thư mục: một lệnh import ORM trong use case là đủ phá toàn bộ lợi ích.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi, vẽ mũi tên phụ thuộc: Layered đi xuống tới DB; Hexagonal/Clean mọi mũi tên chỉ vào domain.",
      why: "Interviewer muốn thấy bạn hiểu bản chất (hướng phụ thuộc), không phải thuộc tên các vòng.",
    },
    "Nêu được một tình huống cụ thể mà kiến trúc giúp: “đổi Stripe sang Adyen chỉ viết adapter mới”.",
    {
      t: "Thừa nhận chi phí: với CRUD, Clean Architecture thường là over-engineering.",
      why: "Nêu được khi nào **không** nên dùng cho thấy bạn chọn kiến trúc theo bài toán, không theo trào lưu.",
    },
  ],
  cards: [
    [
      "Hexagonal, Onion, Clean giống nhau ở điểm nào?",
      "Cùng áp dụng Dependency Inversion: core định nghĩa interface, lớp ngoài cài đặt, nên mọi phụ thuộc hướng vào domain và core không biết DB/web.",
    ],
    [
      "Port và adapter là gì?",
      "Port là interface do core định nghĩa (use case vào, repository/gateway ra). Adapter là code cài đặt port cho một công nghệ cụ thể (REST controller, Postgres repository, Stripe client).",
    ],
    [
      "Vì sao Layered khó unit test business logic?",
      "Service ở tầng business gọi thẳng repository/ORM cụ thể, nên test service phải dựng DB hoặc mock sâu vào ORM.",
    ],
    [
      "Vertical Slice giải quyết vấn đề gì của Layered?",
      "Thêm một tính năng trong Layered phải sửa ngang qua mọi tầng; Vertical Slice gom mọi thứ của tính năng vào một chỗ nên thêm/sửa không đụng tính năng khác.",
    ],
  ],
});
