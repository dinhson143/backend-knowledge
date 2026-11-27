BK.topic({
  id: "system-architecture",
  track: "arch",
  section: "arch-main",
  title: "Kiến trúc hệ thống: Monolith, Microservices, Event-driven, Serverless",
  tldr: {
    t: "Bắt đầu bằng **Modular Monolith** — một deployable, ranh giới module rõ ràng — rồi chỉ tách **Microservice** khi có lý do cụ thể: scale riêng, team deploy độc lập, công nghệ khác hẳn. Đây là chuyện **triển khai và ranh giới runtime**, khác với cách tổ chức code bên trong. Event-driven và Serverless là cách các phần giao tiếp và chạy, dùng kết hợp được.",
    why: "Tách service phải có lý do cụ thể mới đáng: nó cho deploy và scale độc lập nhưng biến mọi tương tác thành gọi qua mạng. Modular monolith cho phần lớn lợi ích về ranh giới mà chưa phải trả chi phí phân tán.",
  },
  story: {
    problem: "Monolith lớn dần: một module memory leak làm sập cả hệ thống, mỗi lần deploy phải chờ 40 team, muốn scale checkout phải nhân cả khối. Nhưng tách vội thành microservices lại đẻ ra lỗi network, saga, debug khó.",
    idea: "Chọn ranh giới runtime theo nhu cầu thật: giữ một deployable khi còn nhỏ, chia module rõ để sau này tách, chỉ tách service khi có lý do scale hoặc team độc lập.",
    tradeoff: "Mỗi lần tách là đổi một lời gọi hàm (nhanh, chắc chắn) lấy một lời gọi mạng (chậm, có thể lỗi), và mất transaction chung.",
  },
  table: {
    head: ["Kiến trúc", "Ý tưởng chính", "Lợi", "Bất lợi", "Hợp khi"],
    rows: [
      {
        cells: [
          "Monolith",
          "Một ứng dụng, một lần deploy, thường một database",
          "Đơn giản nhất: debug, transaction, deploy đều dễ; latency gọi hàm nội bộ",
          "Code dễ rối khi lớn; scale phải nhân cả khối; một lỗi (memory leak) kéo sập tất cả; nhiều team deploy chung dễ tắc",
          "Sản phẩm mới, đội nhỏ, chưa rõ ranh giới nghiệp vụ",
        ],
        why: "Mọi module chạy chung một process và một DB → gọi nhau là gọi hàm, transaction ACID có sẵn. Nhưng chung process thì chung số phận: một module hỏng hay cần scale là cả khối bị ảnh hưởng.",
      },
      {
        cells: [
          "Modular Monolith",
          "Một deployable nhưng chia module có API nội bộ rõ, mỗi module sở hữu schema riêng",
          "Giữ được độ đơn giản của monolith mà vẫn có ranh giới; tách thành service sau này dễ",
          "Cần kỷ luật để module không gọi tắt vào nội bộ nhau; vẫn scale và deploy chung",
          "Mặc định hợp lý cho đa số đội trước khi có lý do tách",
        ],
        why: "Ranh giới module (API nội bộ, schema riêng) giữ code không rối và chuẩn bị sẵn đường tách; vẫn một process nên chưa tốn chi phí mạng hay saga. Thiếu kỷ luật thì module gọi tắt vào nhau và quay về monolith rối.",
      },
      {
        cells: [
          "Microservices",
          "Mỗi service một nghiệp vụ, deploy riêng, sở hữu database riêng, gọi nhau qua mạng",
          "Scale riêng phần nóng; team deploy độc lập; cô lập lỗi; chọn công nghệ riêng",
          "Phức tạp phân tán: network lỗi, latency, transaction phải dùng saga, khó debug, cần observability và platform mạnh",
          "Nhiều team, nghiệp vụ đã ổn định ranh giới, có nhu cầu scale khác nhau rõ rệt",
        ],
        why: "Process và DB riêng → scale, deploy, lỗi đều tách biệt. Cái giá: mọi lời gọi qua mạng có thể chậm hoặc lỗi, dữ liệu nằm ở nhiều DB nên mất transaction chung, và cần tracing để biết request đi đâu.",
      },
      {
        cells: [
          "Event-driven",
          "Service phát event (`OrderPlaced`) lên broker; service khác tự nghe và phản ứng",
          "Lỏng lẻo: thêm consumer không sửa producer; hấp thụ traffic đột biến; dễ fan-out",
          "Luồng khó theo dõi; eventual consistency; phải xử lý trùng, thứ tự, schema event",
          "Nhiều hệ thống cần phản ứng với cùng sự kiện, xử lý bất đồng bộ",
        ],
        why: "Thêm tính năng mới chỉ cần thêm consumer, vì producer không biết ai nghe; broker giữ event khi consumer chậm. Đổi lại, không chỗ nào nhìn thấy toàn bộ luồng, và dữ liệu giữa các service chỉ nhất quán sau một khoảng trễ.",
      },
      {
        cells: [
          "Serverless",
          "Viết function, nền tảng lo server và scale theo request (Lambda + dịch vụ managed)",
          "Không quản server; trả tiền theo lượt chạy; scale về 0",
          "Cold start; giới hạn thời gian chạy; vendor lock-in; khó test cục bộ; đắt khi tải cao liên tục",
          "Tải lẻ tẻ, theo sự kiện, glue code, MVP",
        ],
        why: "Tải thấp thì gần như miễn phí, vì nền tảng chỉ tạo môi trường chạy khi có request và tính tiền theo số lần gọi cùng thời gian chạy × bộ nhớ. Môi trường được giữ lại và tái dùng cho các lần gọi sau; cold start chỉ xảy ra khi phải tạo môi trường mới (lần gọi đầu, khi scale ra, sau một thời gian rảnh). Tải cao liên tục thì trả theo lần chạy đắt hơn máy chạy sẵn. Nguồn: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html",
      },
    ],
  },
  sections: [
    {
      title: "Những điều hay bị hỏi",
      points: [
        {
          t: "**Distributed monolith** — tách thành nhiều service nhưng vẫn dùng chung database hoặc phải deploy cùng lúc: nhận đủ cái khó của microservices mà không có cái lợi.",
          why: "Chung DB và deploy cùng lúc là vẫn trả giá mạng mà không được tự do: đổi schema phải phối hợp mọi service, không team nào deploy độc lập.",
        },
        {
          t: "**Conway’s Law** — kiến trúc hệ thống phản chiếu cấu trúc giao tiếp của tổ chức; ranh giới service nên khớp ranh giới team.",
          why: "Ranh giới service trùng ranh giới team thì mỗi team tự quyết trong phạm vi của mình; ngược lại, hai team phải thống nhất mỗi lần thay đổi sẽ tạo ra hai module dính chặt.",
        },
        {
          t: "**Database per service** — mỗi service sở hữu dữ liệu của mình; service khác lấy qua API hoặc event, không đọc thẳng bảng.",
          why: "Buộc đi qua API/event để giữ hợp đồng rõ ràng — service khác đọc thẳng bảng thì đổi schema sẽ phá họ mà không ai biết.",
        },
        {
          t: "**Transaction xuyên service** — không dùng được ACID transaction; thay bằng Saga + compensating action, hoặc outbox để phát event tin cậy.",
          why: "Phải có bước bù trừ khi một bên lỗi, vì ACID transaction cần một DB điều phối khoá và commit; dữ liệu ở hai DB thì mỗi bên chỉ commit được phần của mình.",
        },
        {
          t: "**CQRS** — tách mô hình ghi (command) và mô hình đọc (query), thường đi cùng event-driven để dựng read model riêng tối ưu cho truy vấn.",
          why: "Tách read/write để mỗi bên tối ưu riêng, vì mô hình tốt cho ghi (chuẩn hoá, ràng buộc chặt) thường tệ cho đọc (cần join, aggregate). Đổi lại, read model trễ hơn write model một chút.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Đừng mở đầu bằng microservices trong phỏng vấn system design trừ khi đề bài cần; nói rõ lý do tách từng service.",
      why: "Nói lý do tách từng service cho thấy quyết định có cơ sở — interviewer đánh giá bạn có cân nhắc chi phí không.",
    },
    {
      t: "Tách service theo bounded context (DDD), không theo tầng kỹ thuật (“service DB”, “service API”).",
      why: "Tách theo tầng kỹ thuật khiến mọi tính năng phải sửa nhiều service cùng lúc — đúng loại coupling mà microservices muốn tránh.",
    },
  ],
  related: ["saga"],
  cards: [
    [
      "Modular monolith khác monolith thường ở đâu?",
      "Vẫn một deployable nhưng chia module có API nội bộ và sở hữu dữ liệu riêng → giữ được độ đơn giản, khi cần vẫn tách thành service được.",
    ],
    [
      "Distributed monolith là gì?",
      "Nhiều service nhưng dùng chung DB hoặc phải deploy cùng nhau — chịu độ phức tạp phân tán mà không có lợi ích deploy/scale độc lập.",
    ],
    [
      "Khi nào nên tách microservice?",
      "Khi có lý do cụ thể: một phần cần scale khác hẳn, team cần deploy độc lập, hoặc cần công nghệ khác — và ranh giới nghiệp vụ đã ổn định.",
    ],
  ],
});
