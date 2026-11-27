/*
 * Bài System Design — đi theo Delivery Framework của Hello Interview:
 * Requirements → Core Entities → API → High-Level Design (diagram chạy trực tiếp) → Deep Dives.
 * Nội dung tự tóm tắt để ôn; bản gốc đầy đủ ở link `hi`.
 * Deep dive: bad / good / great = mức trả lời junior / mid / senior.
 */
window.PROBLEMS = [];

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
