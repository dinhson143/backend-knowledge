BK.topic({
  id: "tech-cheatsheet",
  track: "sd",
  section: "sd-deep",
  title: "Cheat sheet 15 công nghệ",
  tldr: {
    t: "+ Ở phỏng vấn, mỗi công nghệ chỉ cần trả lời được: dùng nó cho việc gì, vì sao không dùng cái khác, giới hạn của nó ở đâu. Hello Interview có bài riêng cho từng công nghệ.",
    why: "Ba câu hỏi đó buộc ta nói ra cơ chế: dùng cho việc gì = workload nó tối ưu, vì sao không dùng cái khác = cơ chế khác biệt, giới hạn = cái giá của cơ chế đó. Nói được cơ chế cho thấy hiểu bản chất chứ không thuộc tên.",
  },
  story: {
    problem: "Interviewer hỏi 'sao chọn Cassandra?' mà chỉ đáp 'vì nó scale tốt' thì không chứng minh được hiểu biết. Mỗi công nghệ tối ưu cho một kiểu workload cụ thể nhờ một quyết định thiết kế bên trong.",
    idea: "Gắn mỗi công nghệ với cơ chế lõi của nó (LSM-tree, inverted index, append-only log…), từ cơ chế suy ra use case và giới hạn. Biết cơ chế là tự trả lời được 'vì sao không dùng cái khác'.",
    tradeoff: "Mỗi công nghệ thêm vào là thêm chi phí vận hành, đồng bộ dữ liệu và kỹ năng đội ngũ. Hệ thống nhỏ mà chọn quá nhiều công nghệ chuyên biệt thường là over-engineering.",
  },
  table: {
    head: ["Công nghệ", "Dùng khi", "Điểm cần nói được"],
    rows: [
      {
        cells: [
          "PostgreSQL",
          "Mặc định cho dữ liệu quan hệ, cần ACID",
          "Index B-Tree/GIN, read replica, partitioning, `SELECT FOR UPDATE`, JSONB, PostGIS",
        ],
        why: "Hợp làm mặc định khi access pattern chưa rõ: dữ liệu lưu dạng row với B-Tree index và MVCC + WAL, nên vừa JOIN/query linh hoạt vừa bảo đảm ACID. Mở rộng được bằng read replica cho đọc và partitioning, JSONB/PostGIS cho semi-structured và geo, nên hiếm khi phải đổi sớm.",
      },
      {
        cells: [
          "DynamoDB",
          "Key-value/document scale lớn, managed",
          "Partition key + sort key, GSI, hot partition, conditional write, DynamoDB Streams",
        ],
        why: "Get/put theo key có latency ổn định ở mọi quy mô và AWS lo scale, vì mỗi item được hash theo partition key tới một partition cố định. Chỉ tra hiệu quả theo key nên query khác phải có GSI; một key quá nóng dồn hết vào một partition (hot partition).",
      },
      {
        cells: [
          "Cassandra",
          "Ghi cực nhiều, dữ liệu theo thời gian (chat, log)",
          "LSM-tree, partition key + clustering key, tunable consistency (QUORUM), không JOIN",
        ],
        why: "Write rất nhanh và rẻ, vì LSM-tree ghi vào memtable + commit log tuần tự rồi flush thành SSTable, không update tại chỗ. Clustering key sắp dữ liệu trong partition theo thời gian, nên 'lấy 50 tin nhắn mới nhất của chat X' là một lần đọc tuần tự; không có JOIN vì dữ liệu phân tán theo partition key.",
      },
      {
        cells: [
          "Redis",
          "Cache, counter, lock, leaderboard, geo, pub/sub",
          "Thực thi lệnh single-threaded, data structures (sorted set, GEO), TTL, persistence (RDB/AOF), cluster slot",
        ],
        why: "Mỗi thao tác ~sub-ms và tự nhiên atomic (không race giữa `INCR`), vì dữ liệu nằm trong RAM và lệnh chạy tuần tự trên một thread. Data structure có sẵn (sorted set, GEO, list) biến counter, leaderboard, lock thành một lệnh; giới hạn là dung lượng RAM và persistence không mạnh bằng DB.",
      },
      {
        cells: [
          "Elasticsearch",
          "Full-text search, faceted search",
          "Inverted index, analyzer, shard/replica, đồng bộ qua CDC → eventual consistency",
        ],
        why: "Inverted index + analyzer (tokenize, stem) cho phép tra từ khoá nhanh và chấm điểm relevance; doc values cho phép đếm aggregation theo facet. Không phải nguồn sự thật nên dữ liệu được đồng bộ từ DB qua CDC, trễ vài giây.",
      },
      {
        cells: [
          "Kafka",
          "Event stream bền vững, nhiều consumer group",
          "Topic/partition, offset, consumer group, ordering trong partition, retention, replay",
        ],
        why: "Throughput rất cao vì Kafka là append-only log chia partition, ghi tuần tự lên đĩa; message giữ theo retention chứ không xoá khi đọc. Mỗi consumer group tự giữ offset nên nhiều hệ thống đọc độc lập và replay được; thứ tự chỉ bảo đảm trong partition.",
      },
      {
        cells: [
          "Flink",
          "Stream processing có state",
          "Window (tumbling/sliding), watermark cho event trễ, checkpoint → exactly-once cho state (end-to-end cần sink transactional)",
        ],
        why: "Crash thì khôi phục state từ checkpoint và đọc lại từ offset tương ứng, vì Flink giữ state (đếm, tổng theo key/window) cạnh code xử lý và checkpoint định kỳ. Watermark báo 'đã nhận đủ event tới thời điểm T', giúp đóng window đúng dù event đến trễ.",
      },
      {
        cells: [
          "ZooKeeper",
          "Coordination: leader election, config, service discovery",
          "Consensus (ZAB), ephemeral node, watch; Kafka đã thay bằng KRaft, Kubernetes dùng etcd",
        ],
        why: "ZAB là giao thức consensus nên mọi node thấy cùng thứ tự ghi → làm được nguồn sự thật cho cấu hình và leader. Ephemeral node tự biến mất khi session của client chết → phát hiện node chết và bầu leader mới; watch báo thay đổi thay vì poll. Kafka đã bỏ ZooKeeper bằng KRaft, Kubernetes dùng etcd (Raft).",
      },
      {
        cells: [
          "Temporal",
          "Workflow nhiều bước bền vững (saga, retry dài)",
          "Durable execution: workflow resume sau crash, activity retry, timer dài ngày",
        ],
        why: "Code viết như hàm tuần tự mà vẫn bền, vì Temporal ghi mọi bước của workflow vào event history; worker crash thì workflow được replay từ history tới đúng chỗ dừng. Server lưu bền vững timer và retry, nên 'chờ 7 ngày rồi gửi nhắc' không cần cron hay bảng trạng thái tự làm.",
      },
      {
        cells: [
          "API Gateway",
          "Cửa vào duy nhất cho client",
          "Routing, auth, rate limit, request validation, không chứa business logic",
        ],
        why: "Là cửa vào duy nhất nên mọi concern chung (auth, rate limit, validate) đặt một lần ở đây. Không chứa business logic vì Gateway nằm trên đường đi của mọi request: logic nghiệp vụ ở đây làm nó khó scale, deploy chung cho mọi service và thành monolith ẩn.",
      },
      {
        cells: [
          "Proximity Search",
          "Tìm điểm gần (tài xế, nhà hàng)",
          "Geohash, Quadtree, Redis GEO, PostGIS; trade-off độ chính xác và tốc độ cập nhật",
        ],
        why: "Index thông thường chỉ sắp theo một chiều nên không trả lời hiệu quả 'gần (lat, lng)'. Geohash mã hoá 2D thành chuỗi mà prefix chung nghĩa là gần nhau → tra bằng prefix trên index thường; Quadtree chia ô theo mật độ. Vị trí tài xế đổi vài giây một lần nên cấu trúc phải cập nhật rẻ — đó là lý do đánh đổi độ chính xác với tốc độ cập nhật.",
      },
      {
        cells: [
          "Vector Database",
          "Semantic search, RAG, recommendation",
          "Embedding, ANN (HNSW, IVF), cosine similarity; pgvector, Pinecone",
        ],
        why: "Semantic search là tìm láng giềng gần nhất, vì embedding biến văn bản/ảnh thành vector mà nghĩa gần thì vector gần. So từng vector với hàng triệu vector quá chậm, nên ANN index (HNSW là đồ thị nhiều tầng, IVF là phân cụm) chỉ duyệt một phần nhỏ, đổi chút recall lấy tốc độ.",
      },
      {
        cells: [
          "Time-series DB",
          "Metrics, monitoring, IoT",
          "Ghi append theo thời gian, downsampling, retention; InfluxDB, TimescaleDB, Prometheus",
        ],
        why: "Lưu theo chunk thời gian và nén mạnh (delta encoding) rất hiệu quả, vì metrics gần như chỉ append theo thời gian và query theo khoảng thời gian. Dữ liệu cũ ít cần chi tiết, nên downsampling (1s → 1 phút) và retention xoá chunk cũ giữ storage không tăng mãi.",
      },
      {
        cells: [
          "Change Data Capture",
          "Đồng bộ DB chính sang search/cache/warehouse",
          "Đọc WAL/binlog (Debezium) → Kafka; tránh dual-write không nhất quán",
        ],
        why: "Đọc WAL/binlog (Debezium) là bắt được 100% thay đổi mà app không phải ghi hai nơi, vì mọi thay đổi đã commit đều nằm trong log đó theo đúng thứ tự. Đẩy qua Kafka để nhiều đích (ES, cache, warehouse) tiêu thụ độc lập và replay được.",
      },
      {
        cells: ["Blob + CDN", "File lớn, media", "Presigned URL, multipart, edge cache, signed URL"],
        why: "Blob store rẻ và bền cho file lớn, CDN mang file tới gần user. Presigned URL cho client upload thẳng, multipart cho file lớn resume được, signed URL ở CDN giới hạn ai được tải nội dung private và trong bao lâu.",
      },
    ],
  },
  points: [
    {
      t: "+ **Dual-write problem** — ghi DB rồi ghi Kafka/ES trong code có thể lệch khi một bên lỗi. Giải bằng CDC hoặc **transactional outbox**.",
      why: "Hai lệnh ghi vào hai hệ thống không nằm chung một transaction: DB commit xong mà app crash trước khi publish Kafka thì event mất vĩnh viễn. Outbox ghi event vào bảng outbox trong cùng transaction với dữ liệu, rồi một tiến trình riêng (hoặc CDC) đọc bảng đó để publish → hoặc cả hai cùng có, hoặc cả hai cùng không.",
    },
    {
      t: "+ Chọn DB: bắt đầu từ PostgreSQL; chuyển sang DynamoDB/Cassandra khi nêu được lý do (write throughput, access pattern đơn giản theo key, scale ngang).",
      why: "Đổi sớm sang NoSQL là mất JOIN, transaction mà không cần thiết, vì PostgreSQL xử lý được hàng chục nghìn write/s trên một máy tốt và cho query linh hoạt. Chỉ khi write vượt khả năng một primary, hoặc access pattern chỉ theo key, mô hình partition của DynamoDB/Cassandra mới đáng cái giá đó.",
    },
  ],
  cards: [
    [
      "Kafka khác Redis Pub/Sub thế nào?",
      "Kafka lưu bền vững theo retention, nhiều consumer group, replay theo offset. Redis Pub/Sub fire-and-forget: không ai subscribe thì message mất.",
    ],
    [
      "Cassandra hợp với loại dữ liệu nào?",
      "Ghi rất nhiều, truy vấn theo partition key và sắp theo clustering key (chat theo chatId + timestamp, log, time-series). Không có JOIN.",
    ],
    [
      "Dual-write problem là gì và giải thế nào?",
      "Ghi DB và ghi hệ thống thứ hai (Kafka/ES) trong cùng code có thể lệch khi một bên lỗi. Giải bằng CDC (Debezium đọc WAL) hoặc transactional outbox.",
    ],
    [
      "Temporal giải quyết bài toán gì?",
      "Durable execution cho workflow nhiều bước: tự resume sau crash, retry activity, timer dài; hợp saga và quy trình kéo dài.",
    ],
    [
      "Flink watermark để làm gì?",
      "Đánh dấu tiến độ thời gian sự kiện để đóng window đúng lúc dù event đến trễ hoặc lệch thứ tự.",
    ],
  ],
});
