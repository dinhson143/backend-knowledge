/*
 * Nội dung ôn tập — hệ thống hoá từ Miro board "Backend" (mindmap "CS", 512 node)
 * theo khung Hello Interview: System Design in a Hurry · Low-Level Design in a Hurry · Coding.
 *
 * Quy ước trong mảng `points`:
 *   "..."    nội dung lấy từ Miro (đã sửa chính tả, gom gọn)
 *   "+ ..."  bổ sung — nhánh trên Miro đang trống hoặc thiếu ý quan trọng khi phỏng vấn
 *   "! ..."  đính chính — chỗ trên Miro dễ gây hiểu sai
 * Inline: **đậm**, `code`.
 */
window.TRACKS = [];

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
