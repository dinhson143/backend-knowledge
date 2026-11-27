BK.topic({
  id: "delivery",
  track: "sd",
  section: "sd-framework",
  title: "Khung trả lời 6 bước",
  tldr: {
    t: "Đi theo thứ tự cố định để không lạc đề: Requirements → Core Entities → API → (Data Flow) → High-Level Design → Deep Dives. HLD giải quyết functional, Deep Dives giải quyết non-functional.",
    why: "Đi sai thứ tự sẽ phải quay lại sửa, vì mỗi bước phụ thuộc output bước trước. HLD chỉ cần chứng minh hệ thống **làm được** các FR; NFR (latency, scale, consistency) là bài toán tối ưu trên một design đã chạy đúng, nên để dành cho deep dive.",
  },
  story: {
    problem: "Không có khung, ứng viên thường lao vào vẽ Kafka, Redis ngay, rồi phút 30 mới phát hiện đã thiết kế sai bài toán, hoặc hết giờ trước khi chạm tới phần scale. Lý do: buổi system design chỉ 45–60 phút và đề bài cố tình mơ hồ.",
    idea: "Chia buổi thành các bước có thứ tự, mỗi bước tạo input cho bước sau: requirement sinh ra entity, entity sinh ra API, API quyết định các box trong HLD, còn NFR quyết định deep dive vào đâu. → Mọi quyết định đều truy ngược được về một yêu cầu cụ thể.",
    tradeoff: "Khung cố định tốn ~10 phút đầu cho phần chưa “vẽ” gì; áp máy móc (tính QPS dài dòng, liệt kê entity thừa) sẽ ăn mất thời gian của deep dive — phần phân loại level rõ nhất.",
  },
  table: {
    head: ["Bước", "Mục tiêu", "Thời gian", "Output trên bảng"],
    rows: [
      {
        cells: [
          "1 · Requirements",
          "Chốt functional + non-functional",
          "~5 phút",
          "3–5 FR dạng “User có thể…”, 3–5 NFR có con số",
        ],
        why: "Requirements quyết định toàn bộ phần còn lại: “10M DAU, read-heavy” dẫn tới cache + replica, “strong consistency khi đặt vé” dẫn tới lock/transaction. Giới hạn 3–5 FR vì thời gian chỉ đủ thiết kế kỹ vài luồng chính; ôm 10 tính năng thì cái nào cũng hời hợt.",
      },
      {
        cells: [
          "2 · Core Entities",
          "Liệt kê danh từ chính của hệ thống",
          "~2 phút",
          "User, Event, Ticket, Booking…",
        ],
        why: "Chốt entity sớm giúp cả buổi dùng chung một bộ từ vựng với interviewer, vì entity là danh từ sẽ xuất hiện trong API, bảng DB và các service. Chỉ mất ~2 phút vì chưa cần cột, chỉ cần tên; chi tiết schema để lúc HLD, khi đã biết query nào cần.",
      },
      {
        cells: [
          "3 · API / System Interface",
          "Hợp đồng giữa client và hệ thống",
          "~5 phút",
          "Endpoint REST / RPC / GraphQL cho từng FR",
        ],
        why: "Viết API xong là biết hệ thống phải xử lý những request nào, vì API là hợp đồng biến FR thành thao tác cụ thể (`POST /bookings`). Mỗi endpoint sau đó thành một luồng để vẽ trong HLD, tránh vẽ box không phục vụ request nào.",
      },
      {
        cells: [
          "4 · Data Flow (optional)",
          "Chỉ dùng cho hệ thống dạng pipeline",
          "~5 phút",
          "Chuỗi bước xử lý dữ liệu",
        ],
        why: "Với hệ thống dạng pipeline (web crawler, ETL, ad-click aggregation), vẽ data flow trước mới thấy các stage cần queue, worker gì, vì giá trị nằm ở chuỗi biến đổi dữ liệu chứ không ở API. Với app CRUD thông thường, bước này trùng với HLD nên bỏ qua để tiết kiệm thời gian.",
      },
      {
        cells: [
          "5 · High-Level Design",
          "Vẽ kiến trúc thoả mãn từng FR",
          "~10–15 phút",
          "Client → LB/Gateway → Service → DB/Cache",
        ],
        why: "HLD đi theo từng endpoint — request vào LB, qua service nào, đọc/ghi DB nào — để mọi FR có đường đi end-to-end trước khi tối ưu. Một design nhanh nhưng thiếu tính năng vẫn là design sai.",
      },
      {
        cells: [
          "6 · Deep Dives",
          "Đáp ứng NFR, xử lý bottleneck",
          "~10 phút",
          "Scale, consistency, failure, edge cases",
        ],
        why: "Cần giữ ~10 phút cho deep dive, vì đây là phần interviewer dùng để phân biệt mid với senior. Deep dive là nơi kiểm tra NFR: tính thử tải lên design hiện tại, chỉ ra chỗ nghẽn (DB ghi 50k/s, hot key) rồi đưa giải pháp kèm trade-off.",
      },
    ],
  },
  points: [
    {
      t: "**Functional Requirements** — hệ thống phải làm gì (“User có thể đặt vé”).",
      why: "Viết FR dạng “User có thể…” buộc mình nghĩ từ góc người dùng và mỗi câu map thẳng ra một endpoint, vì FR là thứ hệ thống **phải làm được**. Câu mơ hồ như “hệ thống quản lý vé” không sinh ra được API nào cụ thể.",
    },
    {
      t: "**Non-functional Requirements** — CAP Theorem, Environment Constraints, Scalability, Latency, Durability, Security, Fault Tolerance, Compliance.",
      why: "NFR quyết định kiến trúc, vì chúng là ràng buộc **cách** hệ thống vận hành (nhanh bao nhiêu, chịu tải bao nhiêu, mất node thì sao): cùng FR “đặt vé” nhưng 100 user/ngày thì một Postgres là đủ, 1M user tranh vé cùng lúc thì cần queue và lock phân tán. Danh sách này là checklist để không bỏ sót trục nào khi hỏi interviewer.",
    },
    {
      t: "**HLD** — vẽ design tập trung giải quyết functional requirements, chưa tối ưu vội.",
      why: "Vẽ đơn giản trước giúp interviewer theo kịp và tạo nền để deep dive chỉ ra chỗ cần sửa. Tối ưu khi chưa có design chạy đúng thì không biết tối ưu cái gì, và dễ thêm cache/queue thừa làm design rối.",
    },
    {
      t: "**Deep Dives** — giải quyết các vấn đề liên quan tới non-functional requirements.",
      why: "Deep dive luôn đứng sau HLD, vì NFR chỉ đo được trên một kiến trúc cụ thể: phải có HLD mới thấy request đi qua đâu, DB nào bị đọc nhiều → mới biết đặt cache, replica hay shard ở đâu.",
    },
    {
      t: "+ **Capacity Estimation** — chỉ tính khi con số **thay đổi thiết kế** (ví dụ: 400k write/s → không dùng Postgres; 500GB → một DB là đủ). Nói “tôi sẽ ước lượng khi cần ở phần deep dive” thay vì tính QPS dài dòng ngay đầu.",
      why: "Con số chỉ có giá trị khi nó đổi quyết định: 400k write/s vượt xa sức ghi một node Postgres (cỡ vài chục nghìn/s) → buộc phải shard hoặc dùng Cassandra; còn 500GB vừa một máy → khỏi shard. Tính QPS chi tiết ngay đầu mà không dẫn tới quyết định nào chỉ tốn 5 phút của deep dive.",
    },
    {
      t: "+ NFR phải **có con số** và **có ngữ cảnh**: “search latency < 500ms”, “10M DAU”, “strong consistency khi đặt vé, eventual cho xem danh sách”.",
      why: "“Search < 500ms” cho biết cần index/search engine và có thể chịu một round-trip DB; “hệ thống phải nhanh” không giúp chọn được gì. Ngữ cảnh quan trọng vì consistency không đồng đều: đặt vé sai thì bán trùng ghế (phải strong), còn danh sách sự kiện trễ vài giây không ai để ý (eventual cho phép cache).",
    },
    {
      t: "+ Bước API: mỗi FR map ra ít nhất một endpoint; lấy user từ auth header/JWT, không truyền `userId` trong body.",
      why: "Mỗi FR cần ít nhất một endpoint, nếu không FR đó không có đường vào hệ thống. `userId` phải lấy từ JWT đã được server verify, vì giá trị trong body do client tự điền — attacker đổi thành id người khác là đặt vé/xem dữ liệu của họ.",
    },
    {
      t: "+ Senior/Staff: interviewer kỳ vọng bạn **tự dẫn** phần Deep Dives (tự nêu bottleneck), không chờ interviewer hỏi.",
      why: "Ở level senior, kỹ năng cần chứng minh là **tự nhìn ra rủi ro** trong design của mình, giống dự án thật khi không ai chỉ chỗ sai. Chờ interviewer hỏi mới trả lời → bạn giải được vấn đề nhưng không phát hiện được vấn đề.",
    },
  ],
  tips: [
    {
      t: "Chốt FR/NFR trước rồi mới vẽ kiến trúc — nhảy vào vẽ sớm là lỗi bị trừ điểm phổ biến nhất.",
      why: "Vẽ kiến trúc khi chưa chốt yêu cầu là đang đoán bài toán: bạn có thể dựng hệ thống realtime phức tạp trong khi đề chỉ cần batch. Interviewer trừ điểm vì đó đúng là hành vi gây lãng phí trong dự án thật.",
    },
    {
      t: "Giữ HLD đơn giản trước, ghi chú “sẽ quay lại ở deep dive” cho các điểm nóng.",
      why: "Ghi chú điểm nóng cho interviewer thấy bạn đã nhận ra vấn đề, nhưng chọn giải sau khi cả luồng đã đầy đủ → không sa vào tối ưu một box rồi hết giờ trước khi vẽ xong các FR còn lại.",
    },
  ],
  cards: [
    [
      "Thứ tự 6 bước của Delivery Framework?",
      "Requirements → Core Entities → API → (Data Flow, optional) → High-Level Design → Deep Dives.",
    ],
    [
      "HLD giải quyết loại requirement nào? Deep Dives giải quyết loại nào?",
      "HLD: functional requirements. Deep Dives: non-functional requirements (scale, latency, consistency, fault tolerance…).",
    ],
    [
      "Khi nào nên làm capacity estimation?",
      "Khi kết quả ảnh hưởng quyết định thiết kế (có cần shard, cache, chọn DB nào). Nếu không, nói sẽ ước lượng lúc deep dive để tiết kiệm thời gian.",
    ],
    [
      "Kể 8 nhóm Non-functional Requirement thường gặp.",
      "CAP (consistency vs availability), Environment Constraints, Scalability, Latency, Durability, Security, Fault Tolerance, Compliance.",
    ],
  ],
});
