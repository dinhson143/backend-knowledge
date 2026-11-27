BK.problem({
  id: "ticketmaster",
  level: 2,
  title: "Ticket Booking (Ticketmaster)",
  hi: "ticketmaster",
  summary: "Đọc cực nhiều, ghi tranh chấp gay gắt: không bán trùng ghế, chịu được hàng triệu người vào cùng lúc.",
  topics: ["redis", "patterns", "dist-lock", "search", "cap"],
  fr: ["Xem chi tiết event và seat map", "Tìm kiếm event", "Đặt vé: giữ ghế → thanh toán → xác nhận"],
  nfr: [
    {
      t: "**Strong consistency** khi đặt vé (không bán trùng)",
      why: "Bán trùng là hoàn tiền, khiếu nại và mất uy tín, vì mỗi ghế chỉ bán được một lần. Yêu cầu này buộc luồng booking dùng Postgres transaction + conditional update thay vì kho eventual consistency.",
    },
    {
      t: "High availability cho xem/tìm kiếm",
      why: "Phần xem/tìm sập thì user không vào được luồng mua dù booking vẫn sống, vì đa số traffic là xem/tìm event. Hệ quả: search/xem tách sang ES + cache, chấp nhận dữ liệu cũ vài giây để luôn trả lời được.",
    },
    {
      t: "Chịu được event hot (10M user cùng lúc)",
      why: "Autoscale không kịp khởi động, vì event hot tạo traffic gấp hàng trăm lần bình thường chỉ trong vài phút. Yêu cầu này sinh ra Waiting Room: chặn và xếp hàng từ cửa vào thay vì cố chịu toàn bộ.",
    },
    {
      t: "Search < 500ms; đọc gấp ~100 lần ghi",
      why: "Search phải có engine riêng, vì đọc gấp ~100 lần ghi và user bỏ đi nếu tìm chậm. Hệ quả: Elasticsearch đồng bộ qua CDC + cache kết quả phổ biến, không dồn tải lên Postgres.",
    },
  ],
  capacity: "Đọc rất lớn nhưng dữ liệu nhỏ (event, ghế) — thách thức là tranh chấp ghi và traffic đột biến, không phải dung lượng.",
  entities: ["Event", "Venue", "Performer", "Ticket (seat, status)", "Booking"],
  api: [
    "GET /events/{id}",
    "GET /events/search?q&city&date",
    "POST /bookings/reserve { ticketIds }",
    "PUT /bookings/confirm { bookingId, paymentMethodId }",
  ],
  hldWhy: "**Waiting Room** đứng trước gateway để admit theo đợt, giữ lượng request tới backend trong ngưỡng chịu được — vì lúc mở bán có thể 10M user ập vào. Tách **Search Service** + **Elasticsearch** khỏi **Event Service**: search full-text cần inverted index mà Postgres làm kém, và tải đọc gấp ~100 lần ghi không được ảnh hưởng tới luồng đặt vé. **Booking Service** đi với **Postgres** vì đặt vé cần transaction và strong consistency (không bán trùng ghế). **Redis lock** giữ ghế tạm có TTL: lock tự hết hạn khi user bỏ ngang, không phải giữ transaction DB dài; **Stripe** xử lý thẻ để hệ thống không phải gánh PCI DSS.",
  hld: {
    id: "hld-ticketmaster",
    title: "HLD — Ticket Booking",
    h: 420,
    scenario: "Event/Search phục vụ đọc; Booking Service lo tranh chấp ghế bằng Redis lock + conditional update trên Postgres.",
    context: "Bài toán có hai mặt: đọc cực nhiều (tìm event, xem seat map) và ghi có tranh chấp (nhiều người giành cùng một ghế). **Search Service + Elasticsearch** lo full-text search; **Event Service** đọc chi tiết event từ **Postgres** (source of truth cho trạng thái ghế); **Booking Service** điều phối giữ ghế và thanh toán. **Redis lock** giữ chỗ tạm có TTL, **Stripe** xử lý tiền, **Waiting Room** (Redis sorted set) chặn đám đông trước khi vào backend. Theo dõi trạng thái ghế A1 trong Postgres (`AVAILABLE` → `SOLD`), key lock trong Redis và số người trong waiting room.",
    nodes: [
      { id: "client", x: 80, y: 200, label: "Client" },
      { id: "wq", x: 80, y: 60, label: "Waiting Room", s: "Redis sorted set" },
      { id: "gw", x: 270, y: 200, label: "API Gateway" },
      { id: "event", x: 470, y: 70, label: "Event Service" },
      { id: "search", x: 470, y: 200, label: "Search Service" },
      { id: "booking", x: 470, y: 330, label: "Booking Service" },
      { id: "pg", x: 690, y: 70, label: "Postgres", s: "A1: AVAILABLE" },
      { id: "es", x: 690, y: 200, label: "Elasticsearch" },
      { id: "redis", x: 690, y: 330, label: "Redis lock", s: "trống" },
      { id: "stripe", x: 270, y: 350, label: "Stripe" },
    ],
    links: [
      ["client", "wq"],
      ["client", "gw"],
      ["gw", "event"],
      ["gw", "search"],
      ["gw", "booking"],
      ["event", "pg"],
      ["search", "es"],
      ["pg", "es"],
      ["booking", "pg"],
      ["booking", "redis"],
      ["booking", "stripe"],
    ],
    variants: [
      {
        name: "Tìm & xem event",
        steps: [
          {
            note: "User tìm “taylor swift”. Search đi vào **Elasticsearch**, không dùng `LIKE` trên Postgres.",
            msgs: [
              ["client", "gw", "GET /events/search?q=taylor"],
              ["gw", "search", "search"],
              ["search", "es", "full-text query"],
              ["es", "search", "12 events", "ok"],
              ["search", "client", "200", "ok"],
            ],
            detail: "Search Service gửi “taylor swift” tới **Elasticsearch** dạng full-text query và nhận 12 event. ES dùng **inverted index** (từ → danh sách document), hỗ trợ tách từ, gõ sai (fuzzy), lọc theo ngày/địa điểm và xếp hạng theo độ liên quan. `LIKE '%taylor%'` trên Postgres không dùng được index B-tree nên phải quét cả bảng, chậm dần theo số event và không có ranking. Tải search không chạm Postgres nên không ảnh hưởng luồng booking.",
          },
          {
            note: "Dữ liệu event đồng bộ Postgres → Elasticsearch qua **CDC**.",
            msgs: [["pg", "es", "CDC", "warn"]],
            detail: "Dữ liệu sang ES qua **CDC** (Change Data Capture, ví dụ Debezium đọc WAL của Postgres rồi đẩy qua Kafka vào ES); Postgres vẫn là nơi ghi event. Cách hiển nhiên là app ghi cả hai nơi (dual write), nhưng ghi Postgres thành công mà ghi ES lỗi thì hai bên lệch nhau vĩnh viễn. CDC đọc từ log commit nên không bỏ sót thay đổi nào. Đổi lại, ES chỉ **eventually consistent**: event mới tạo có thể vài giây sau mới tìm thấy — chấp nhận được cho search.",
          },
          {
            note: "Mở trang event: thông tin + seat map từ Postgres (cache/CDN được vì đọc nhiều).",
            msgs: [
              ["client", "gw", "GET /events/123"],
              ["gw", "event", "getEvent"],
              ["event", "pg", "SELECT event, tickets"],
              ["pg", "event", "seat map", "ok"],
              ["event", "client", "200", "ok"],
            ],
            lesson: "Đọc >> ghi: search qua ES, chi tiết event cache được; chỉ booking cần strong consistency.",
            detail: "Event Service đọc thông tin event và danh sách ghế từ Postgres rồi trả seat map. Thông tin tĩnh (tên, địa điểm, ảnh, sơ đồ chỗ ngồi) ít đổi nên cache mạnh qua CDN/Redis. Riêng **trạng thái từng ghế** đổi liên tục khi đang mở bán, nên chỉ cache rất ngắn hoặc đọc riêng — seat map hơi cũ không gây hại vì bước giữ ghế luôn kiểm lại. Điểm mấu chốt: chỉ booking cần strong consistency, mọi thứ khác ưu tiên tốc độ.",
          },
        ],
      },
      {
        name: "Giữ ghế & thanh toán",
        steps: [
          {
            note: "User chọn ghế A1, bấm giữ chỗ.",
            msgs: [["client", "gw", "POST /reserve A1"], ["gw", "booking", "reserve(A1)"]],
            detail: "User42 chọn ghế A1 và gửi `POST /reserve A1` qua gateway tới Booking Service. Booking chưa trừ tiền, chưa ghi DB — chỉ giữ ghế đủ lâu (khoảng vài phút) để user điền thẻ. Cách ngây thơ là `UPDATE ticket SET status='RESERVED'` trong Postgres rồi chạy cron dọn ghế hết hạn, nhưng như vậy DB chịu mọi lượt tranh và job dọn dẹp dễ sót.",
          },
          {
            note: "Lấy **lock có TTL 10 phút** trên ghế.",
            msgs: [["booking", "redis", "SET ticket:A1 NX EX 600"], ["redis", "booking", "OK", "ok"]],
            set: { redis: "ticket:A1 → user42 (10 phút)" },
            detail: "User42 giữ được A1 trong **10 phút** bằng `SET ticket:A1 user42 NX EX 600`: `NX` chỉ ghi khi key chưa tồn tại, `EX 600` cho key tự hết hạn. Lệnh atomic trong Redis nên hai người bấm cùng lúc thì chỉ một người nhận `OK`. TTL là điểm hay nhất: user đóng tab bỏ đi thì ghế **tự nhả** sau 10 phút, không cần job dọn. Giá trị key là `user42` để sau này chỉ đúng người giữ được xác nhận.",
          },
          {
            note: "Chuyển sang trang thanh toán; seat map hiện A1 đang được giữ.",
            msgs: [["booking", "client", "reserved · 10:00", "ok"]],
            detail: "Booking trả `reserved · 10:00`, client chuyển sang trang thanh toán có đồng hồ đếm ngược. Seat map của user khác hiển thị A1 “đang giữ” bằng cách kết hợp trạng thái DB với các key lock trong Redis. Postgres vẫn ghi A1 là `AVAILABLE` — lock chỉ là lớp giữ chỗ tạm, không phải trạng thái chính thức.",
          },
          {
            note: "Thanh toán qua Stripe; Stripe gọi **webhook** báo kết quả.",
            msgs: [
              ["client", "gw", "PUT /confirm"],
              ["gw", "booking", "confirm"],
              ["booking", "stripe", "PaymentIntent $250"],
              ["stripe", "booking", "webhook: succeeded", "ok"],
            ],
            detail: "Booking tạo **PaymentIntent** $250 trên Stripe (kèm idempotency key để retry không trừ tiền hai lần) khi user xác nhận. Kết quả cuối lấy từ **webhook** Stripe gọi về server, không từ redirect của client — client có thể mất mạng hay đóng tab ngay sau khi trả tiền, còn webhook thì Stripe retry tới khi nhận được. Rủi ro cần nghĩ tới: thanh toán chậm quá 10 phút, lock đã hết và người khác đã giữ A1 — bước tiếp theo sẽ phát hiện và phải refund.",
          },
          {
            note: "Ghi DB bằng **conditional update** trong transaction, rồi xoá lock.",
            msgs: [
              ["booking", "pg", "UPDATE SOLD WHERE AVAILABLE"],
              ["pg", "booking", "1 row ✓", "ok"],
              ["booking", "redis", "DEL ticket:A1", "ok"],
              ["booking", "client", "Confirmed", "ok"],
            ],
            set: { pg: "A1: SOLD", redis: "trống" },
            good: ["pg"],
            lesson: "Redis TTL lock giữ chỗ ngắn hạn và tự nhả khi user bỏ đi; Postgres vẫn là source of truth.",
            detail: "A1 chuyển `SOLD` qua **conditional update** khi webhook báo `succeeded`: `UPDATE tickets SET status='SOLD' WHERE id='A1' AND status='AVAILABLE'` trong transaction. Nếu ai đó đã mua A1 (vì lock hết hạn giữa chừng), điều kiện sai, 0 dòng bị đổi và Booking biết để refund thay vì bán trùng. Nhận `1 row ✓` rồi mới `DEL ticket:A1` (nên kiểm giá trị key vẫn là user42 trước khi xoá) và báo Confirmed. Redis chỉ là lớp tối ưu UX; tính đúng đắn cuối cùng do Postgres đảm bảo.",
          },
        ],
      },
      {
        name: "Tranh ghế đang giữ",
        steps: [
          {
            note: "User khác bấm giữ A1 trong lúc user42 đang thanh toán.",
            set: { redis: "ticket:A1 → user42 (còn 6 phút)" },
            msgs: [["client", "gw", "POST /reserve A1"], ["gw", "booking", "reserve(A1)"]],
            detail: "User khác bấm giữ A1 trong lúc user42 còn 6 phút giữ chỗ — thường vì seat map của họ đã cũ vài giây. Request đi bình thường qua gateway tới Booking Service như mọi lượt giữ ghế. Ở event hot, cảnh này xảy ra hàng nghìn lần mỗi giây trên cùng vài ghế đẹp.",
          },
          {
            note: "`SET NX` thất bại vì key đã tồn tại.",
            msgs: [["booking", "redis", "SET ticket:A1 NX"], ["redis", "booking", "nil", "err"]],
            detail: "Redis trả **nil** cho `SET ticket:A1 NX` vì key `ticket:A1` đã tồn tại. Lệnh không ghi đè, không chờ, không khoá gì — trả kết quả ngay. So với `SELECT ... FOR UPDATE` trong Postgres, cách này không giữ row lock và không chiếm connection DB trong lúc user thứ hai chờ.",
          },
          {
            note: "Trả 409 ngay, không chạm DB.",
            msgs: [["booking", "client", "409 đang được giữ", "err"]],
            lesson: "Redis xử lý tranh chấp trong < 1ms; DB không phải khoá dòng lâu.",
            detail: "Booking trả **409 Conflict** “đang được giữ” ngay, Postgres không nhận query nào. Toàn bộ lượt tranh được giải quyết ở Redis trong dưới 1ms → dù nghìn người tranh một ghế, DB chỉ thấy đúng một lượt ghi khi có người thanh toán thành công. Client nên refresh seat map và gợi ý ghế khác; user42 bỏ đi thì A1 tự trống lại khi TTL hết.",
          },
        ],
      },
      {
        name: "Event cực hot",
        steps: [
          {
            note: "10 triệu người vào cùng lúc. Hệ thống đưa client vào **virtual waiting room** thay vì để họ đập thẳng vào backend.",
            msgs: [["client", "wq", "join queue"], ["wq", "client", "vị trí #52,341", "warn"]],
            set: { wq: "10M người đang chờ" },
            detail: "10 triệu người vào lúc mở bán được đưa vào **virtual waiting room** thay vì đập thẳng vào backend — nếu không, Booking, Redis và Postgres đều quá tải, mọi người cùng nhận lỗi và retry làm tải tệ hơn. Mỗi người được thêm vào Redis **sorted set** với score là thời điểm vào hàng; `ZRANK` cho biết vị trí `#52,341`. Waiting room chỉ phục vụ trang tĩnh và số thứ tự, rất rẻ để scale, nên đứng được trước đám đông khổng lồ.",
          },
          {
            note: "Mỗi đợt admit vài nghìn người, vừa năng lực Booking; báo lượt qua **SSE/WebSocket**.",
            msgs: [["wq", "client", "SSE: tới lượt bạn", "ok"]],
            set: { wq: "admit 5k/phút" },
            detail: "Waiting room admit theo đợt, ví dụ **5k người/phút** — con số đặt theo năng lực thật của Booking và lượng ghế còn lại. Người tới lượt nhận thông báo qua **SSE/WebSocket** kèm admit token có hạn dùng (ký số để không làm giả được), thay vì client poll liên tục làm tăng tải. Score theo thời điểm vào nên thứ tự là **FIFO**, công bằng hơn cảnh ai bấm F5 nhanh hơn thì thắng.",
          },
          {
            note: "Chỉ người đã được admit mới vào luồng giữ ghế.",
            msgs: [["client", "gw", "POST /reserve (admit token)"], ["gw", "booking", "reserve"]],
            lesson: "Waiting room là backpressure ở tầng sản phẩm: bảo vệ hệ thống và công bằng FIFO cho user.",
            detail: "Gateway chỉ cho vào Booking các `POST /reserve` mang admit token hợp lệ; request không có token bị chặn ngay ở cửa. Từ đây luồng giữ ghế y hệt bình thường, nhưng số người cùng lúc trong backend luôn nằm trong mức hệ thống chịu được. Waiting room là **backpressure ở tầng sản phẩm**: thay vì để hệ thống sập rồi từ chối ngẫu nhiên, ta chủ động cho người dùng chờ có thứ tự.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Giữ ghế trong lúc user thanh toán thế nào?",
      bad: "Mở transaction + SELECT FOR UPDATE suốt 10 phút.",
      good: "Cột status RESERVED + expires_at, cron định kỳ nhả ghế hết hạn.",
      great: "Redis lock TTL 10 phút (tự nhả, không cần cron) + conditional update trên Postgres khi xác nhận.",
      why: {
        bad: "Mỗi user đang thanh toán chiếm một connection, vì `SELECT FOR UPDATE` giữ row lock và connection suốt 10 phút. Pool vài trăm connection thì chỉ cần vài trăm người đang trả tiền là cạn pool, cả hệ thống đứng.",
        good: "Lưu `RESERVED` + `expires_at` giải phóng connection ngay sau khi ghi, không còn giữ lock dài. Nhưng cron chạy theo chu kỳ (ví dụ mỗi phút) nên ghế hết hạn vẫn bị khoá thêm tới một chu kỳ, và cron là thêm một thành phần phải vận hành.",
        great: "Ghế nhả đúng lúc hết hạn mà không cần cron, vì key Redis có TTL tự xoá. Khi xác nhận, `UPDATE ... WHERE status='AVAILABLE'` trên Postgres là chốt chặn cuối: dù lock Redis hết hạn hay mất, chỉ một transaction cập nhật được row.",
      },
    },
    {
      q: "10 triệu người vào cùng lúc khi mở bán?",
      bad: "Autoscale và hy vọng.",
      good: "Rate limit ở gateway, cache seat map.",
      great: "Virtual waiting queue (Redis sorted set), admit theo đợt, đẩy trạng thái qua SSE; seat map cập nhật realtime.",
      why: {
        bad: "Autoscale tới muộn: instance mới cần vài phút để khởi động, còn spike xảy ra trong vài giây. DB và Booking Service không dễ scale ngang, nên sập trước khi máy mới kịp lên.",
        good: "Rate limit bảo vệ backend khỏi quá tải, cache seat map giảm đọc DB. Nhưng user bị từ chối ngẫu nhiên (429), phải F5 liên tục → thêm tải, và không công bằng theo thứ tự đến.",
        great: "Hệ thống admit đúng thứ tự từng đợt, với số lượng backend chịu được, vì sorted set lưu user theo thời điểm vào (score = timestamp). SSE đẩy vị trí trong hàng nên client không cần poll, cắt hẳn tải refresh.",
      },
    },
    {
      q: "Search nhanh và chịu tải?",
      bad: "LIKE '%taylor%' trên Postgres.",
      good: "Full-text index của Postgres.",
      great: "Elasticsearch đồng bộ qua CDC; cache kết quả phổ biến (Redis/CDN).",
      why: {
        bad: "Mỗi query quét toàn bảng, vì `LIKE '%taylor%'` có wildcard đầu nên B-tree index không dùng được. Cộng tải đọc lớn lúc mở bán, Postgres nghẽn và kéo theo luồng booking dùng chung DB.",
        good: "Full-text index (GIN) tìm theo từ mà không quét bảng. Nhưng query search vẫn chạy chung DB với booking, thiếu fuzzy matching/ranking tốt và khó scale đọc riêng.",
        great: "Tải search không chạm Postgres, vì Elasticsearch là cluster riêng có inverted index, fuzzy và ranking. CDC đọc WAL đẩy thay đổi sang ES → đồng bộ gần realtime mà app không phải dual-write; cache kết quả phổ biến cắt tiếp phần lớn query lặp lại.",
      },
    },
  ],
  sims: ["seat", "redlock"],
});
