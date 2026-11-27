// Lộ trình (ROADMAP: giai đoạn → topic id) và bảng "Nguồn & phạm vi" ở trang chủ (MIRO_GAPS, HI_GAPS).

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

/* Lộ trình ôn — thứ tự điều hướng của toàn bộ app */
window.ROADMAP = [
  { id: "s1", title: "Khung & nền móng", goal: "Biết cách trình bày một bài và các khối cơ bản nhất: mạng, API, mô hình dữ liệu, database.",
    topics: ["delivery", "networking", "api-design", "data-modeling", "indexing", "core-db"] },
  { id: "s2", title: "Scale dữ liệu", goal: "Hiểu khi nào phải mở rộng và mở rộng bằng cách nào: cache, shard, consistent hashing, CAP.",
    topics: ["caching", "sharding", "consistent-hashing", "cap", "numbers"] },
  { id: "s3", title: "Building blocks", goal: "Mỗi công nghệ giải bài gì và giới hạn ở đâu. Học kỹ Redis và Kafka trước — xuất hiện trong gần như mọi bài.",
    topics: ["redis", "kafka", "queue", "streams", "dist-lock", "dist-cache", "blob", "search", "lb-gateway-cdn", "tech-cheatsheet", "bigdata-ds"] },
  { id: "s4", title: "Common patterns", goal: "Ghép concept + công nghệ thành lời giải cho 8 dạng bài lặp đi lặp lại.",
    topics: ["patterns"] },
  { id: "s5", title: "Luyện bài System Design", goal: "Tự nói Requirements → HLD trong 15–20 phút rồi mới mở lời giải. Đi từ Khởi động tới Nâng cao.",
    problems: true },
  { id: "arch", title: "Kiến trúc phần mềm & phương pháp", goal: "Học song song: cách tổ chức code (Layered → Hexagonal/Clean), kiến trúc hệ thống (Monolith → Microservices) và phương pháp phát triển (TDD, BDD, DDD).", parallel: true,
    topics: ["code-architecture", "system-architecture", "dev-methods"] },
  { id: "cloud", title: "Container trên AWS: ECS & EKS", goal: "Học song song khi cần trả lời câu hỏi hạ tầng: ECS → EKS → khi nào chọn cái nào.", parallel: true,
    topics: ["ecs", "eks", "ecs-vs-eks"] },
  { id: "lld", title: "Low-Level Design", goal: "Học song song: OOP → nguyên tắc → pattern → concurrency → luyện bài.", parallel: true,
    topics: ["lld-delivery", "oop-pillars", "solid", "principles-other", "patterns-gof", "concurrency", "lld-problems-list"] },
  { id: "dsa", title: "Coding · DSA", goal: "30–45 phút mỗi ngày theo pattern, song song với các giai đoạn trên.", parallel: true,
    topics: ["bigo", "ds", "algo"] },
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
