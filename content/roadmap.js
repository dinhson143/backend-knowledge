// Lộ trình (ROADMAP: giai đoạn → chặng → topic id) và bảng "Nguồn & phạm vi" ở trang chủ (MIRO_GAPS, HI_GAPS).

/* Nhánh trên Miro đang trống — đã bổ sung nội dung trong prototype này */
window.MIRO_GAPS = [
  ["Security", "Gốc CS › Security trống — phần auth/rate limit đã gom vào API Design."],
  ["4 - Database", "Gốc CS › 4 - Database trống — nội dung DB nằm trong Key Technologies › Core Database."],
  ["Polymorphism, Inheritance, Encapsulation", "OOP › 4 tính chất — chỉ Abstraction có nội dung."],
  ["Factory Method", "Chỉ có link Hello Interview, chưa có định nghĩa."],
  ["CDN, Load Balancer, API Gateway", "Key Technologies — 3 node trống."],
  ["Streams / Event Sourcing, Distributed Lock", "Key Technologies — node trống (Distributed Lock có nội dung ở nhánh Concurrency)."],
  ["Core Entities, Data Flow", "Delivery Framework — chưa ghi nội dung."],
  ["Graph, Binary Tree, DFS, BFS, Backtracking, Greedy, DP", "DSA — chỉ có tên, chưa có khi nào dùng."],
  ["Numbers to Know, LLD Delivery Framework", "Hello Interview có, Miro chưa có nhánh."],
  ["Question Breakdowns, Technology Deep Dives", "Miro chưa có bài System Design / LLD nào và chưa có deep dive công nghệ — xem tab Bài SD."],
];

/* Lộ trình ôn — thứ tự điều hướng của toàn bộ app.
   Giai đoạn → chặng (`parts`, id "<giai đoạn>.<tên>") → topic id. Chặng "Đào sâu" có `optional: true`.
   Chỉ thêm chặng cùng commit với topic đầu tiên của nó (check.mjs báo chặng rỗng).
   Cây đầy đủ, kể cả chỗ cho topic sắp viết: docs/proposals/product-learning-flow.md §7.2 */
window.ROADMAP = [
  { id: "s1", title: "Nền móng", goal: "Học xong bạn trình bày được một bài theo khung 6 bước và chọn giao thức, API, database cho bài đơn giản.",
    parts: [
      { id: "s1.frame", title: "Khung trả lời", topics: ["delivery", "numbers"] },
      { id: "s1.io", title: "Giao tiếp & cửa vào", topics: ["networking", "api-design", "lb-gateway-cdn"] },
      { id: "s1.data", title: "Lưu & truy vấn dữ liệu", topics: ["data-modeling", "core-db", "indexing"] },
    ] },
  { id: "s2", title: "Scale dữ liệu", goal: "Học xong bạn biết khi nào một database không đủ, mở rộng bằng cache, shard, replica và nói rõ mức nhất quán.",
    parts: [
      { id: "s2.cache", title: "Đọc nhanh hơn với cache", topics: ["caching", "dist-cache"] },
      { id: "s2.split", title: "Chia dữ liệu ra nhiều máy", topics: ["sharding", "consistent-hashing"] },
      { id: "s2.consistency", title: "Nhất quán & sao chép", topics: ["cap"] },
      { id: "s2.tech", title: "Công nghệ trọng tâm", topics: ["redis"] },
    ] },
  { id: "s3", title: "Bất đồng bộ & phối hợp", goal: "Học xong bạn tách được việc chậm khỏi request, xử lý sự kiện tin cậy và chống tranh chấp giữa nhiều máy.",
    parts: [
      { id: "s3.async", title: "Hàng đợi & luồng sự kiện", topics: ["queue", "streams", "kafka"] },
      { id: "s3.contention", title: "Tranh chấp tài nguyên", topics: ["dist-lock"] },
    ] },
  { id: "s4", title: "Lưu trữ chuyên dụng", goal: "Học xong bạn chọn đúng kho cho file lớn, tìm kiếm full-text, đếm/lọc ở quy mô lớn, và so sánh nhanh các công nghệ.",
    parts: [
      { id: "s4.stores", title: "Kho chuyên dụng", topics: ["blob", "search", "bigdata-ds"] },
      { id: "s4.choose", title: "Chọn công nghệ", topics: ["tech-cheatsheet"] },
    ] },
  { id: "s5", title: "Ghép pattern & luyện đề", goal: "Học xong bạn nhận ra dạng bài, gọi đúng pattern, tự giải từ Khởi động tới Nâng cao.", problems: true,
    parts: [
      { id: "s5.patterns", title: "Common patterns", topics: ["patterns"] },
    ] },
  { id: "cs", title: "Nền tảng CS", goal: "Học xong bạn giải thích được process, thread, I/O và viết code chạy đồng thời không race, không deadlock.", parallel: true,
    parts: [
      { id: "cs.process", title: "Process, thread & bộ nhớ", topics: ["os-process-lifecycle", "thr-thread-vs-process"] },
      { id: "cs.concurrency", title: "Concurrency", topics: ["concurrency"] },
    ] },
  { id: "cloud", title: "Container & Kubernetes", goal: "Học xong bạn chọn được nền chạy container cho một hệ thống trên AWS.", parallel: true,
    parts: [
      { id: "cloud.aws", title: "Trên AWS", topics: ["ecs", "eks", "ecs-vs-eks"] },
    ] },
  { id: "lld", title: "Low-Level Design", goal: "Học xong bạn thiết kế lớp cho một bài LLD: entity, nguyên tắc, pattern, xử lý đồng thời.", parallel: true,
    parts: [
      { id: "lld.oop", title: "Khung & OOP", topics: ["lld-delivery", "oop-pillars"] },
      { id: "lld.principles", title: "Nguyên tắc thiết kế", topics: ["solid", "principles-other"] },
      { id: "lld.patterns", title: "Design pattern", topics: ["patterns-gof"] },
      { id: "lld.practice", title: "Luyện đề LLD", topics: ["lld-problems-list"] },
    ] },
  { id: "arch", title: "Kiến trúc & phương pháp", goal: "Học xong bạn giải thích được code phụ thuộc theo hướng nào, khi nào tách service và cách TDD/DDD khớp với nhau.", parallel: true,
    parts: [
      { id: "arch.code", title: "Tổ chức code", topics: ["code-architecture"] },
      { id: "arch.system", title: "Tổ chức hệ thống", topics: ["system-architecture"] },
      { id: "arch.process", title: "Cách làm việc", topics: ["dev-methods"] },
    ] },
  { id: "dsa", title: "Coding · DSA", goal: "Học xong bạn nhận dạng pattern thuật toán từ ràng buộc đề bài.", parallel: true,
    parts: [
      { id: "dsa.complexity", title: "Độ phức tạp", topics: ["bigo"] },
      { id: "dsa.ds", title: "Cấu trúc dữ liệu", topics: ["ds"] },
      { id: "dsa.algo", title: "Thuật toán", topics: ["algo"] },
    ] },
];

/* So sánh với mục lục Hello Interview (kiểm tra ngày 2026-11-01) */
window.HI_GAPS = [
  ["Question Breakdowns (System Design)", "32 bài", "13 bài có HLD chạy trực tiếp", "Còn 19: Local Delivery, Tinder, LeetCode, YouTube, FB Live Comments, FB Post Search, Instagram, Strava, Distributed Cache, Online Auction, Job Scheduler, News Aggregator, Price Tracker, Notification System, Robinhood, Metrics Monitoring, Online Chess, ChatGPT, Flash Sale"],
  ["Technology Deep Dives", "15 bài", "Kafka, Redis chi tiết (6 mô phỏng) + bảng tóm tắt 15 công nghệ", "Chưa có bài sâu: Elasticsearch, Cassandra, DynamoDB, PostgreSQL, Flink, ZooKeeper, Temporal, Vector DB, Time-series DB, CDC"],
  ["Delivery Framework", "Có Capacity Estimation", "Đã bổ sung", "—"],
  ["Core Concepts", "9", "9 (Numbers to Know là bổ sung)", "Miro thiếu Numbers to Know"],
  ["Key Technologies", "10", "10", "Miro để trống CDN, LB, API Gateway, Streams"],
  ["Common Patterns", "7", "8 (thêm Proximity)", "—"],
  ["LLD Concurrency", "Correctness · Coordination · Scarcity", "Đã gom theo 3 nhóm", "Miro chỉ có primitive + deadlock"],
  ["LLD Problem Breakdowns", "9 bài", "Bảng entity + pattern", "Chưa có lời giải chi tiết từng bài"],
];
