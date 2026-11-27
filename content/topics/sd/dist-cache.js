BK.topic({
  id: "dist-cache",
  track: "sd",
  section: "sd-tech",
  title: "Distributed Cache",
  tldr: {
    t: "Redis/Memcached làm lớp cache dùng chung giữa các instance. Nhắc lại: write strategy, invalidation, eviction — chi tiết ở Core Concepts › Caching.",
    why: "Ghi/xoá ở một nơi là mọi instance đều thấy, hết lệch giữa các bản local — vì mọi instance chia sẻ cùng một cache. Nhưng cache vẫn là bản sao của DB, nên luôn phải trả lời ba câu: ghi thế nào, khi nào xoá bản cũ, đầy RAM thì bỏ gì.",
  },
  story: {
    problem: "Cache trong RAM của từng instance thì mỗi instance có bản riêng: user cập nhật profile qua instance A, instance B vẫn trả bản cũ; hit rate thấp vì mỗi instance phải tự warm. DB thì gánh toàn bộ read, latency vài ms đến chục ms mỗi query.",
    idea: "Tách cache thành một cụm riêng dùng chung (Redis/Memcached) nằm trong RAM: mọi instance đọc/ghi cùng một bản, đọc chỉ ~<1ms. Warm một lần là phục vụ toàn bộ fleet.",
    tradeoff: "Thêm một network hop và một hệ thống cần vận hành; invalidation sai thì dữ liệu lệch DB (stale); RAM đắt nên phải chọn eviction policy hợp lý.",
  },
  points: [
    {
      t: "**Write strategy** — Write-Through, Write-Around (kèm invalidation / TTL ngắn), Write-Back.",
      why: "Write-Through ghi DB thành công rồi cập nhật cache trước khi trả lời (định nghĩa và so sánh đầy đủ ở chủ đề Caching) → cache luôn mới, nhưng mọi write chậm thêm và cache chứa cả dữ liệu không ai đọc. Write-Around chỉ ghi DB, cache lấp khi đọc miss → phải xoá key hoặc đặt TTL ngắn để bản cũ không sống lâu. Write-Back ghi cache rồi flush DB sau → write rất nhanh, nhưng cache chết trước khi flush là mất dữ liệu.",
    },
    {
      t: "**Invalidation strategy** — cách giữ cache khớp DB; DB đổi mà cache không biết thì user thấy stale data.",
      why: "Không ai xoá/cập nhật key thì cache trả bản cũ tới khi TTL hết, vì nó không tự biết DB đã đổi. Cách phổ biến: xoá key sau khi ghi DB (cache-aside) kèm TTL làm lưới an toàn, hoặc nghe CDC để invalidate khi có thay đổi từ nguồn khác.",
    },
    {
      t: "**Eviction** — LRU, LFU, FIFO.",
      why: "RAM có hạn nên khi đầy phải chọn key bỏ đi. LRU bỏ key lâu nhất chưa dùng, hợp với truy cập có tính thời gian gần; LFU bỏ key ít dùng nhất, chống được một lần scan lớn đẩy bay key hot; FIFO đơn giản nhưng có thể bỏ key đang hot.",
    },
    {
      t: "+ Redis còn dùng làm: rate limiter (counter + TTL), leaderboard (sorted set), distributed lock, geo index (`GEOSEARCH`), pub/sub.",
      why: "Redis chạy lệnh tuần tự trên một thread nên mỗi lệnh atomic mà không cần lock — đúng thứ các use case này cần: thao tác atomic, nhanh trên state dùng chung. `INCR` + `EXPIRE` cho counter rate limit, sorted set giữ thứ hạng với `ZADD`/`ZRANGE` O(log n), `SET NX` cho lock, `GEOSEARCH` tìm điểm trong bán kính.",
    },
  ],
  cards: [
    [
      "Kể các việc Redis làm được ngoài cache.",
      "Rate limiter, leaderboard (sorted set), distributed lock, geospatial search, pub/sub.",
    ],
  ],
});
