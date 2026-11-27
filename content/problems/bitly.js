BK.problem({
  id: "bitly",
  level: 1,
  title: "URL Shortener (Bitly)",
  hi: "bitly",
  summary: "Bài khởi động kinh điển: sinh mã ngắn không trùng và redirect cực nhanh với tỉ lệ đọc/ghi ~1000:1.",
  topics: ["redis", "caching", "indexing", "data-modeling"],
  fr: [
    "Tạo short URL từ URL dài (tuỳ chọn custom alias, ngày hết hạn)",
    "Truy cập short URL → redirect tới URL gốc",
  ],
  nfr: [
    {
      t: "Short code **duy nhất**",
      why: "Hai URL cùng code thì một trong hai redirect sai đích, vì short code là khoá tra cứu duy nhất. Yêu cầu này quyết định cơ chế sinh code: counter + base62, thay vì random/hash phải kiểm tra trùng.",
    },
    {
      t: "Redirect latency < 100ms",
      why: "Mỗi ms cộng thêm là độ trễ trước khi trang đích bắt đầu tải, vì redirect nằm ngay trên đường click của người dùng. Yêu cầu này dẫn tới cache Redis, index theo `short_code` và CDN edge cho link hot.",
    },
    {
      t: "1B URL, 100M DAU; đọc gấp ~1000 lần ghi",
      why: "Bottleneck là throughput đọc, không phải dung lượng (500GB), vì đọc gấp ~1000 lần ghi. Hệ quả: tách Read/Write Service, đầu tư cache và read replica thay vì sharding DB.",
    },
    {
      t: "Availability > consistency (link mới chậm vài giây vẫn được)",
      why: "Replica trễ vài giây gần như không ai thấy, vì link mới tạo hiếm khi bị click ngay trong vài giây đầu. Nhờ đó được đọc từ replica và cache bất đồng bộ; đổi lại, hệ thống vẫn redirect được khi primary gặp sự cố.",
    },
  ],
  capacity: "1B URL × ~500B ≈ 500GB → một Postgres chứa được; bottleneck là lượng đọc, không phải dung lượng.",
  entities: ["Original URL", "Short URL", "User"],
  api: ["POST /urls { long_url, alias?, expires_at? } → { short_url }", "GET /{code} → 302 Location: long_url"],
  hldWhy: "Tách **Read Service** và **Write Service** để scale riêng — hàng chục instance đọc, vài instance ghi — vì đọc gấp ~1000 lần ghi. **Redis Counter** sinh code từ một bộ đếm toàn cục: đảm bảo không trùng mà không phải kiểm tra DB mỗi lần. **Redis Cache** đứng trước DB vì traffic redirect dồn vào một phần nhỏ link hot → cache hit cao, phần lớn request không chạm Postgres. Chọn **Postgres** thay vì NoSQL: 1B × 500B ≈ 500GB vẫn vừa một instance, truy vấn chỉ là lookup theo primary key, nên không cần trả giá phức tạp của hệ phân tán.",
  hld: {
    id: "hld-bitly",
    title: "HLD — URL Shortener",
    h: 340,
    scenario: "Hai luồng chính: tạo short URL và redirect. Read Service và Write Service tách riêng để scale độc lập.",
    context: "**Write Service** và **Read Service** tách riêng để scale độc lập, vì tải hai luồng rất lệch: tạo link ít (vài trăm/s), redirect nhiều gấp 100–1000 lần. **API Gateway** lo auth, rate limit và định tuyến. **Redis Counter** phát số tăng dần duy nhất để sinh mã ngắn không trùng; **Postgres** lưu mapping `short_code → long_url` (1 tỷ dòng) với `short_code` là primary key; **Redis Cache** giữ link nóng để redirect không chạm DB. Theo dõi giá trị `next=` của counter, nội dung cache (MISS rồi HIT) và dòng mapping trong Postgres.",
    nodes: [
      { id: "client", x: 80, y: 160, label: "Client" },
      { id: "gw", x: 260, y: 160, label: "API Gateway" },
      { id: "write", x: 460, y: 70, label: "Write Service" },
      { id: "read", x: 460, y: 250, label: "Read Service" },
      { id: "counter", x: 680, y: 40, label: "Redis Counter", s: "next=1000000122" },
      { id: "cache", x: 680, y: 160, label: "Redis Cache", s: "trống" },
      { id: "db", x: 680, y: 280, label: "Postgres", s: "urls: 1B rows" },
    ],
    links: [
      ["client", "gw"],
      ["gw", "write"],
      ["gw", "read"],
      ["write", "counter"],
      ["write", "db"],
      ["read", "cache"],
      ["read", "db"],
    ],
    variants: [
      {
        name: "Tạo short URL",
        steps: [
          {
            note: "User gửi URL dài.",
            msgs: [["client", "gw", "POST /urls"], ["gw", "write", "createShort"]],
            detail: "Request `POST /urls` qua API Gateway (xác thực API key, kiểm rate limit để chặn bot spam tạo link) rồi tới Write Service. Write Service validate URL (đúng scheme, không nằm trong danh sách độc hại) trước khi tốn số counter. Đường ghi tách khỏi đường đọc nên spike tạo link không làm chậm redirect và ngược lại.",
          },
          {
            note: "Lấy số tiếp theo từ **counter toàn cục** (Redis `INCR`) — không bao giờ trùng.",
            msgs: [["write", "counter", "INCR url_counter"], ["counter", "write", "1000000123", "ok"]],
            set: { counter: "next=1000000123" },
            detail: "Write Service gọi `INCR url_counter` và nhận số duy nhất **1000000123** (counter nhảy từ 1000000122). Redis chạy single-thread nên mỗi `INCR` là atomic — hai request đồng thời không bao giờ nhận cùng số. Cách hiển nhiên khác là hash URL (MD5) rồi cắt 7 ký tự, nhưng sẽ có collision, phải đọc DB để kiểm rồi retry. Rủi ro của counter: Redis mất dữ liệu (không bật AOF, failover sang replica chưa đồng bộ) thì counter có thể **lùi lại** và phát số đã dùng — cần persistence, và INSERT ở bước sau phải bắt lỗi trùng key.",
          },
          {
            note: "Mã hoá **base62** → `15FTIf` (6 ký tự). Dùng tới 7 ký tự thì đủ ~3.5 nghìn tỷ mã.",
            set: { write: "base62(1000000123) = 15FTIf" },
            detail: "Số 1000000123 đổi sang hệ 62 (0–9, a–z, A–Z) ra **`15FTIf`** — 6 ký tự, vì 62^6 ≈ 56.8 tỷ vẫn chứa đủ số này. Counter vượt 56.8 tỷ thì mã mới dài 7 ký tự, tối đa 62^7 ≈ **3.5 nghìn tỷ** mã. Base62 không dùng `+` hay `/` như base64 nên an toàn trong URL. Nhược điểm: mã liên tiếp đoán được (`15FTIf`, `15FTIg`...), kẻ xấu có thể quét hết link; muốn chống thì xáo trộn số bằng một hoán vị song ánh (ví dụ Feistel) trước khi encode.",
          },
          {
            note: "Lưu mapping, `short_code` là primary key.",
            msgs: [["write", "db", "INSERT (15FTIf, long_url)"], ["db", "write", "ok", "ok"]],
            set: { db: "15FTIf → https://…" },
            detail: "Write Service `INSERT (15FTIf, long_url)` vào Postgres với `short_code` là **primary key** → tra cứu sau này là lookup B-tree theo key, nhanh dù bảng có 1 tỷ dòng. Primary key còn là lưới an toàn cuối: mã bị trùng vì lỗi counter thì INSERT thất bại chứ không ghi đè link của người khác. Có thể lưu kèm `created_at`, `expires_at`, `owner_id` để hỗ trợ hết hạn và quản lý link. Ghi thẳng DB, không qua cache: cache nạp lười khi có người click.",
          },
          {
            note: "Trả short URL.",
            msgs: [["write", "gw", "short.ly/15FTIf", "ok"], ["gw", "client", "201 Created", "ok"]],
            lesson: "Counter + base62: unique mà không cần check collision. Mỗi Write Service xin trước 1,000 số một lần để Redis không thành bottleneck.",
            detail: "Client nhận `201 Created` với `short.ly/15FTIf`. Ở quy mô lớn, gọi Redis mỗi lần tạo link thành bottleneck và single point of failure, nên mỗi instance Write Service dùng `INCRBY url_counter 1000` để **xin trước một dải 1,000 số** rồi cấp dần trong bộ nhớ — animation vẽ `INCR` từng số cho đơn giản. Cái giá: instance chết thì dải số chưa dùng bị bỏ phí, và mã không còn tăng đúng thứ tự thời gian — cả hai đều vô hại.",
          },
        ],
      },
      {
        name: "Redirect",
        steps: [
          {
            note: "Người nhận bấm `short.ly/15FTIf`.",
            msgs: [["client", "gw", "GET /15FTIf"], ["gw", "read", "resolve"]],
            detail: "Click vào `short.ly/15FTIf` thành `GET /15FTIf` qua API Gateway tới Read Service — đường nóng của hệ thống. Mỗi link có thể được click hàng triệu lần, nên mỗi milli-giây ở đây nhân lên rất lớn. Read Service stateless nên scale ngang thoải mái theo số request.",
          },
          {
            note: "Hỏi cache trước — lần đầu **MISS**.",
            msgs: [["read", "cache", "GET 15FTIf"], ["cache", "read", "MISS", "err"]],
            detail: "Cache **MISS**: link vừa tạo chưa ai đọc. Read Service hỏi Redis Cache `GET 15FTIf` trước — dưới 1ms trong cùng AZ. Đây là mẫu **cache-aside**: cache không tự biết dữ liệu, app chịu trách nhiệm đọc DB rồi nạp vào. Link mới viral ngay lập tức thì hàng nghìn request MISS cùng lúc có thể cùng đập vào DB (cache stampede) — chống bằng request coalescing hoặc lock ngắn khi nạp cache.",
          },
          {
            note: "Đọc DB theo primary key (~1ms) rồi nạp cache.",
            msgs: [
              ["read", "db", "SELECT by code"],
              ["db", "read", "long_url", "ok"],
              ["read", "cache", "SET 15FTIf", "ok"],
            ],
            set: { cache: "15FTIf ✓ (LRU)" },
            detail: "Postgres trả `long_url` trong khoảng 1ms nhờ `SELECT` theo primary key (index B-tree), rồi Read Service `SET 15FTIf` vào cache (thường kèm TTL). Chính sách loại bỏ **LRU**: cache đầy thì link lâu không ai click bị đẩy ra. Phân bố click theo luật lũy thừa — một phần nhỏ link chiếm hầu hết lượt click — nên cache chỉ cần giữ vài phần trăm của 1 tỷ link là đạt hit rate rất cao.",
          },
          {
            note: "Trả **302** để mọi click vẫn đi qua server: đếm analytics, đổi hoặc hết hạn link được.",
            msgs: [["read", "gw", "long_url", "ok"], ["gw", "client", "302 Location", "ok"]],
            detail: "Read Service trả `long_url`, gateway trả **302 Found** với header `Location`; trình duyệt tự đi tới URL gốc. Chọn 302 (tạm thời) chứ không 301 (vĩnh viễn) vì trình duyệt **cache 301** và lần sau tự chuyển hướng mà không gọi server: mất analytics click, không đổi được đích, không hết hạn được link. Cái giá của 302: mọi click đều tốn một request tới hệ thống — chấp nhận được vì có cache. Analytics nên ghi bất đồng bộ (đẩy event vào queue) để không làm chậm redirect.",
          },
          {
            note: "Các lượt sau: cache HIT, không chạm DB.",
            msgs: [
              ["client", "gw", "GET /15FTIf"],
              ["gw", "read", "resolve"],
              ["read", "cache", "GET"],
              ["cache", "read", "HIT", "ok"],
              ["read", "client", "302", "ok"],
            ],
            good: ["cache"],
            lesson: "Cache gánh gần hết traffic đọc; 302 thay vì 301 để không mất khả năng đo và kiểm soát link.",
            detail: "Các lượt click sau: `GET 15FTIf` **HIT** cache, Read Service trả 302 ngay mà không chạm Postgres. Hit rate trên 90% → DB chỉ thấy phần nhỏ traffic đọc, vài read replica là đủ thay vì cluster khổng lồ. Link bị xoá hay đổi đích thì phải **xoá key cache** (invalidate) cùng lúc với cập nhật DB; nếu không, người dùng còn bị chuyển tới đích cũ cho tới khi TTL hết.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Sinh short code thế nào để không trùng?",
      bad: "Lấy vài ký tự đầu của URL, hoặc random mà không kiểm tra.",
      good: "Hash (MD5/SHA) URL → base62, cắt 7 ký tự, gặp collision thì thêm salt và thử lại.",
      great: "Counter toàn cục (Redis INCR) + base62; Write Service xin trước dải số (batch 1,000) để giảm round-trip; Redis bật persistence + replica. Cần mã khó đoán thì xáo trộn counter (bijective encode).",
      why: {
        bad: "Cắt ký tự đầu cho ra code trùng hàng loạt, vì nhiều URL chung prefix (ví dụ `https://www.`). Random không kiểm tra thì dính birthday paradox: không gian 62^7 ≈ 3.5T với 1B code → xác suất có ít nhất một cặp trùng gần như 100%.",
        good: "Hash phân bố đều nên collision hiếm; trùng thì thêm salt là giải quyết được. Nhưng mỗi lần ghi phải đọc DB kiểm tra trùng, và thiếu unique constraint thì hai request đồng thời có thể cùng qua bước kiểm tra rồi cùng ghi (race).",
        great: "Base62 của counter chắc chắn duy nhất, không cần kiểm tra DB, vì `INCR` của Redis atomic — mỗi số chỉ cấp một lần. Xin trước dải 1,000 số giảm round-trip Redis 1000 lần; persistence + replica giữ counter không quay ngược khi Redis restart (quay ngược = sinh code trùng).",
      },
    },
    {
      q: "Redirect < 100ms với 100M DAU?",
      bad: "Quét bảng tìm URL.",
      good: "Primary key / index trên short_code.",
      great: "Redis cache LRU trước DB + read replica; có thể đẩy redirect lên CDN edge cho link cực hot.",
      why: {
        bad: "Không có index → mỗi redirect quét tuần tự tới 1B row, mất hàng giây đến hàng phút, vượt xa 100ms.",
        good: "B-tree index biến lookup thành O(log n), ~vài ms mỗi query. Nhưng mọi request vẫn chạm DB; với hàng chục nghìn redirect/giây lúc peak, một Postgres sẽ nghẽn connection và CPU.",
        great: "Cache LRU giữ đúng các link hot trong RAM, vì traffic tập trung vào số ít link → hit rate cao, DB chỉ nhận phần miss. Read replica chia phần miss còn lại; CDN edge trả redirect ngay tại PoP gần user, cắt luôn round-trip tới origin.",
      },
    },
    {
      q: "301 hay 302?",
      bad: "301 vì nhanh hơn, không nghĩ tới hệ quả.",
      good: "302 để browser không cache vĩnh viễn.",
      great: "302: giữ quyền đo click, đổi đích, hết hạn link — đổi lại chịu thêm chút tải.",
      why: {
        bad: "301 là permanent: browser cache vĩnh viễn, lần sau đi thẳng tới đích mà không gọi server. Hệ quả: mất dữ liệu đếm click, không đổi được đích, không cho link hết hạn được nữa.",
        good: "302 buộc browser hỏi lại server mỗi lần, nên server luôn giữ quyền điều khiển. Nhưng câu trả lời chưa nêu cái giá (thêm tải) và lý do nghiệp vụ cụ thể.",
        great: "Mỗi request phải đi qua server, vì analytics, đổi đích và hết hạn là giá trị cốt lõi của dịch vụ rút gọn link. Cache và CDN đã hấp thụ phần tải thêm đó, nên chi phí thực tế nhỏ so với quyền kiểm soát giữ được.",
      },
    },
  ],
  sims: ["cache-aside"],
});
