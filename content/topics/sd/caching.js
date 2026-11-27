BK.topic({
  id: "caching",
  track: "sd",
  section: "sd-core",
  title: "Caching",
  tldr: {
    t: "Cache ở 4 chỗ (client, CDN, in-process, external như Redis). Chọn write strategy, invalidation, eviction. Thuộc lòng 3 sự cố: hot key, consistency, stampede.",
    why: "Phải chọn chỗ đặt cache trước, vì mỗi tầng chặn request ở một khoảng cách khác nhau tới DB — càng gần user càng rẻ nhưng càng khó invalidate. Ba sự cố hot key, consistency, stampede chung một gốc: cache là bản sao có thời hạn của DB, nên khi bản sao lệch, hết hạn hoặc bị dồn tải thì DB phía sau lãnh hậu quả.",
  },
  story: {
    problem: "Khi 10k request/s cùng hỏi một trang chủ, DB tốn CPU và I/O cho cùng một kết quả lặp lại → latency tăng vọt rồi sập. Lý do: mỗi lần DB đọc từ disk và parse query mất vài ms.",
    idea: "Giữ phần dữ liệu nóng trong RAM gần người đọc, vì đa số traffic chỉ chạm một phần nhỏ dữ liệu (quy luật 80/20). Đọc RAM ~100ns so với SSD ~100µs, và mỗi cache hit là một query DB khỏi phải chạy.",
    tradeoff: "Hai bản sao của cùng dữ liệu luôn có nguy cơ lệch (stale data). Kèm theo là bài toán invalidation, eviction và các sự cố riêng như stampede, hot key.",
  },
  table: {
    head: ["Write strategy", "Cách làm", "Ưu", "Nhược"],
    rows: [
      {
        cells: [
          "Write-Through",
          "Ghi DB thành công rồi cập nhật cache, sau đó mới trả lời",
          "Cache gần như luôn khớp DB",
          "Ghi chậm hơn",
        ],
        why: "Lần đọc ngay sau luôn thấy giá trị mới, vì request chỉ trả lời khi **cả DB và cache** đã ghi xong. Ghi DB trước: DB lỗi thì cache chưa bị đổi, không có giá trị “ma” trong cache. Đổi lại, latency ghi = tổng hai lần ghi tuần tự. Có lớp cache tự làm việc này (DAX ghi xuống DynamoDB rồi mới nạp cache — https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).",
      },
      {
        cells: [
          "Write-Around",
          "Ghi thẳng DB, bỏ qua cache; kết hợp invalidation hoặc TTL ngắn",
          "Không làm bẩn cache bằng dữ liệu ít đọc",
          "Lần đọc đầu bị cache miss",
        ],
        why: "Bản ghi ghi-một-lần-ít-đọc (log, đơn cũ) không chiếm RAM, vì ghi không đi qua cache — dữ liệu chỉ vào cache khi có người thật sự đọc. Cái giá: lần đọc đầu tiên sau khi ghi chắc chắn miss và phải xuống DB.",
      },
      {
        cells: [
          "Write-Back",
          "Ghi cache rồi trả lời ngay; tiến trình nền ghi DB sau",
          "Ghi cực nhanh",
          "Mất dữ liệu nếu cache sập trước khi flush",
        ],
        why: "Throughput ghi rất cao, vì client chỉ chờ ghi vào RAM (dưới 1ms) còn DB được ghi bất đồng bộ, thường gom thành batch. Nhưng trong khoảng chờ flush, bản duy nhất của dữ liệu nằm trong RAM — cache node chết là mất luôn.",
      },
    ],
  },
  points: [
    {
      t: "**Where to cache** — Client-side (LocalStorage, Cache API), CDN (edge server giữa user và origin), In-process (RAM của chính app), External (Redis, Memcached).",
      why: "Càng gần user càng bớt nhiều chặng mạng: client cache không tốn round-trip nào, CDN cắt đường xa tới origin, in-process tránh cả network hop (~0.5ms) nhưng mỗi instance giữ bản riêng, không chia sẻ được; Redis thì dùng chung cho mọi instance. Đánh đổi chung: càng gần user càng khó chủ động xoá khi dữ liệu đổi.",
    },
    {
      t: "**Eviction** — LRU (xoá mục lâu nhất chưa dùng, phổ biến nhất), LFU (xoá mục ít lượt truy cập nhất), FIFO (xoá theo thứ tự nạp vào).",
      why: "RAM có hạn, nên khi đầy phải chọn mục để bỏ. **LRU** phổ biến vì truy cập có locality theo thời gian (vừa dùng thì sắp dùng lại) và chỉ tốn O(1) với hash map + linked list; LFU hợp khi độ nóng ổn định lâu dài nhưng dễ giữ mãi mục từng hot trong quá khứ; FIFO đơn giản nhất nhưng có thể xoá đúng mục đang nóng.",
    },
    {
      t: "**Invalidation** — đảm bảo cache khớp DB, tránh stale data.",
      why: "Không chủ động xoá hoặc đặt hạn thì cache trả giá trị cũ vô thời hạn, vì nó không tự biết DB vừa đổi. Invalidation (xoá theo sự kiện ghi, hoặc TTL) là cơ chế duy nhất giới hạn thời gian dữ liệu cũ còn sống.",
    },
    {
      t: "**Hot keys** — replicate key nóng lên nhiều node rồi load balance đọc; rate limit traffic bất thường.",
      why: "Thêm node không giúp gì cho hot key: một key chỉ nằm trên một node, nên mọi request cho key đó dồn vào node ấy dù cluster còn rảnh. Nhân bản key ra nhiều node (key salting: thêm hậu tố `key#0..N`) chia lượt đọc ra N+1 node, mỗi node chỉ gánh một phần tải.",
    },
    {
      t: "**Cache consistency** — xoá cache sau khi update DB; TTL ngắn nếu chấp nhận stale; chấp nhận eventual consistency cho feed, metrics.",
      why: "Xoá cache an toàn hơn **ghi lại** cache: ghi lại thì hai request ghi song song có thể đặt giá trị cũ đè lên giá trị mới, còn xoá buộc lần đọc kế tiếp lấy bản mới từ DB. TTL ngắn là lưới an toàn: kể cả khi lỡ lệnh xoá, dữ liệu cũ chỉ sống tối đa bằng TTL — đủ chấp nhận cho feed hay metrics vốn không cần chính xác từng giây.",
    },
    {
      t: "**Cache stampede (thundering herd)** — **request coalescing / single flight**: chỉ một request rebuild cache, các request khác chờ kết quả.",
      why: "Một key nóng hết hạn → hàng nghìn request cùng miss trong một khoảnh khắc và cùng chạy một query nặng xuống DB, DB gánh N lần tải thay vì 1. Single flight dùng lock/promise theo key để chỉ request đầu tiên đi rebuild, số còn lại chờ và dùng chung kết quả → DB chỉ nhận đúng 1 query.",
    },
    {
      t: "+ **Cache-aside (lazy loading)** — pattern đọc mặc định: đọc cache → miss thì đọc DB → ghi vào cache với TTL.",
      why: "App tự quyết định đọc và nạp, nên cache chỉ chứa những gì thật sự được đọc, và khi cache sập app vẫn chạy bằng cách đọc thẳng DB (chậm hơn nhưng không chết). TTL bảo đảm mục nào cũng tự hết hạn, dữ liệu lệch không sống mãi.",
    },
    {
      t: "+ Stampede còn giải bằng **TTL jitter** (ngẫu nhiên hoá TTL) và **refresh trước khi hết hạn**.",
      why: "Cộng ngẫu nhiên ±10% vào TTL làm thời điểm hết hạn trải đều ra, tránh **cache avalanche** — nhiều key hết hạn **cùng lúc** (ví dụ cùng được nạp lúc deploy với TTL 3600s) rồi đồng loạt đổ xuống DB. Refresh trước khi hết hạn (TTL còn ít thì một request nền nạp lại) → key không bao giờ thật sự miss, không có đám đông nào dồn xuống DB.",
    },
  ],
  tips: [
    {
      t: "Luôn nói cache **cái gì**, **key** là gì, **TTL** bao lâu, và **invalidate khi nào**.",
      why: "Bốn câu này quyết định hệ cache đúng hay sai: key sai thì hit rate thấp hoặc trả nhầm dữ liệu giữa user, TTL quyết định độ stale tối đa, invalidation quyết định dữ liệu đổi bao lâu mới được thấy. Nghe đủ bốn câu trả lời, interviewer biết bạn hiểu cache chứ không chỉ nói 「thêm Redis」.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/caching-tiers.svg",
      caption: "Bốn chỗ đặt cache trên đường đi của request: client, CDN, in-process (mỗi instance một bản riêng) và external cache như Redis (mọi instance dùng chung). Càng gần user càng ít chặng mạng nhưng càng khó chủ động xoá khi dữ liệu đổi.",
      source: "https://aws.amazon.com/caching/",
    },
  ],
  cards: [
    [
      "So sánh Write-Through, Write-Around, Write-Back.",
      "Through: ghi cả hai đồng bộ, nhất quán, chậm ghi. Around: ghi DB, bỏ qua cache, miss lần đầu. Back: ghi cache rồi flush DB bất đồng bộ, nhanh nhất nhưng có thể mất dữ liệu.",
    ],
    [
      "Cache stampede là gì? Cách chống hiệu quả nhất?",
      "Key nóng hết hạn → hàng nghìn request cùng miss và đập vào DB. Chống bằng request coalescing (single flight); thêm TTL jitter, refresh sớm.",
    ],
    [
      "Xử lý hot key trong cache thế nào?",
      "Replicate key lên nhiều node + load balance đọc, local/in-process cache, key salting, rate limit.",
    ],
    [
      "LRU vs LFU vs FIFO?",
      "LRU xoá mục lâu nhất chưa dùng; LFU xoá mục ít truy cập nhất (có counter); FIFO xoá theo thứ tự nạp, bất kể độ hot.",
    ],
  ],
});
