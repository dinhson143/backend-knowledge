BK.problem({
  id: "uber",
  level: 3,
  title: "Ride Sharing (Uber)",
  hi: "uber",
  summary: "Ghi vị trí cực nhiều, tìm tài xế gần nhất, và không bao giờ gửi một tài xế cho hai chuyến cùng lúc.",
  topics: ["redis", "patterns", "dist-lock", "caching"],
  fr: ["Rider xem giá ước tính", "Rider đặt xe", "Ghép với tài xế gần nhất", "Tài xế nhận/từ chối và dẫn đường"],
  nfr: [
    {
      t: "Ghép xe < 1 phút",
      why: "Ghép xe phải xong dưới 1 phút, vì rider chờ lâu sẽ huỷ và chuyển app khác. Yêu cầu này đòi truy vấn tài xế gần bằng geo index in-memory và vòng mời có timeout ngắn.",
    },
    {
      t: "**Strong consistency**: một tài xế không nhận hai chuyến",
      why: "Một tài xế nhận hai chuyến thì một rider bị bỏ rơi — trải nghiệm tệ, tốn tiền xử lý. Hệ quả: lock theo driver + conditional update khi accept.",
    },
    {
      t: "Chịu peak (2M tài xế gửi vị trí mỗi 5s ≈ 400k write/s)",
      why: "400k write/s là con số quyết định thiết kế, vì nó vượt khả năng ghi của DB quan hệ. Hệ quả: vị trí nằm trong Redis GEO, chấp nhận mất vị trí khi lỗi vì 5s sau tài xế gửi lại.",
    },
    {
      t: "High availability",
      why: "Mọi thành phần phải có dự phòng, vì app không đặt được xe là mất doanh thu ngay lập tức. Hệ quả: queue bền cho ride request, replica cho Redis và DB, service stateless.",
    },
  ],
  capacity: "400k location update/s là con số quyết định thiết kế: không ghi vào DB quan hệ.",
  entities: ["Rider", "Driver", "Fare", "Ride", "Location"],
  api: [
    "POST /fare { pickup, destination } → Fare",
    "POST /rides { fareId } → Ride",
    "POST /drivers/location { lat, lng }",
    "PATCH /rides/{id} { accept | decline }",
  ],
  hldWhy: "**Location Service** ghi vào **Redis GEO** in-memory thay vì DB quan hệ, vì 2M tài xế gửi vị trí mỗi 5s (~400k write/s) — DB quan hệ không chịu nổi lượng ghi này. **Matching Service** tách riêng: vòng ghép (tìm tài xế gần, gửi lời mời, chờ phản hồi) kéo dài vài giây và cần scale theo lượng request đặt xe. **Redis Lock** đảm bảo mỗi tài xế chỉ nhận lời mời của một chuyến tại một thời điểm, vì nhiều instance Matching có thể cùng chọn một tài xế. **Ride DB** dùng Postgres vì trạng thái chuyến đi cần transaction và tính đúng đắn, còn lượng ghi chuyến nhỏ hơn vị trí hàng trăm lần.",
  hld: {
    id: "hld-uber",
    title: "HLD — Ride Sharing",
    h: 380,
    scenario: "Location Service ghi vị trí vào Redis GEO; Matching Service tìm tài xế gần nhất và khoá tài xế bằng TTL lock.",
    context: "**Location Service** nhận GPS liên tục từ tài xế và ghi vào **Redis GEO** — chỉ số không gian trong bộ nhớ, tìm “tài xế trong bán kính 2km” rất nhanh. **Ride Service** quản lý vòng đời chuyến (`REQUESTED` → `ACCEPTED`) trong **Ride DB** (Postgres), nơi cần transaction và độ bền. **Matching Service** tìm tài xế gần và dùng **Redis Lock** có TTL để mỗi tài xế chỉ nhận một offer tại một thời điểm. Theo dõi số tài xế trong Redis GEO, trạng thái `ride#7` và lock đang giữ tài xế nào.",
    nodes: [
      { id: "rider", x: 80, y: 80, label: "Rider app" },
      { id: "driver", x: 80, y: 300, label: "Driver app" },
      { id: "gw", x: 260, y: 190, label: "API Gateway" },
      { id: "ride", x: 460, y: 70, label: "Ride Service" },
      { id: "match", x: 460, y: 190, label: "Matching Service", w: 150 },
      { id: "loc", x: 460, y: 310, label: "Location Service", w: 150 },
      { id: "ridedb", x: 680, y: 70, label: "Ride DB", s: "Postgres" },
      { id: "lock", x: 680, y: 190, label: "Redis Lock" },
      { id: "geo", x: 680, y: 310, label: "Redis GEO", s: "drivers: 0" },
    ],
    links: [
      ["rider", "gw"],
      ["driver", "gw"],
      ["gw", "ride"],
      ["gw", "loc"],
      ["ride", "ridedb"],
      ["ride", "match"],
      ["match", "lock"],
      ["match", "geo"],
      ["loc", "geo"],
    ],
    variants: [
      {
        name: "Tài xế gửi vị trí",
        steps: [
          {
            note: "Tài xế gửi GPS **mỗi 5 giây** → ~400k update/s.",
            msgs: [["driver", "gw", "POST /drivers/location"], ["gw", "loc", "update(d42)"]],
            detail: "Location Service nhận khoảng **400k update/giây**: app tài xế gửi `POST /drivers/location` với GPS **mỗi 5 giây**, khoảng 2 triệu tài xế online → 2M / 5 ≈ 400k. Gateway chuyển tới Location Service — stateless, scale ngang. Thực tế tài xế thường gửi qua kết nối lâu dài (WebSocket/gRPC stream) để khỏi tốn TLS handshake mỗi lần. Đây là luồng ghi lớn nhất hệ thống, nhưng mỗi bản ghi rất nhỏ và chỉ có giá trị vài giây.",
          },
          {
            note: "Ghi vào **Redis GEO** (in-memory, geohash) thay vì DB quan hệ.",
            msgs: [["loc", "geo", "GEOADD d42", "ok"]],
            set: { geo: "drivers: 2M" },
            lesson: "Redis GEO hợp hơn Postgres: vị trí đổi liên tục, mất vài giây dữ liệu không sao.",
            detail: "Location Service `GEOADD drivers lng lat d42` vào Redis GEO — một sorted set với score là **geohash** 52-bit, nên tìm theo bán kính thành quét các dải score lân cận. Postgres không chịu nổi 400k UPDATE/s — mỗi lần ghi tạo WAL, cập nhật index, vacuum — trong khi dữ liệu này cũ 5 giây là vô dụng. Redis restart mất vài giây vị trí cũng không hại gì vì tài xế gửi lại ngay. Ở quy mô 2M tài xế, chia shard Redis theo vùng địa lý (thành phố) để mỗi shard vừa tải.",
          },
        ],
      },
      {
        name: "Đặt xe & ghép tài xế",
        steps: [
          {
            note: "Rider xem giá.",
            msgs: [
              ["rider", "gw", "POST /fare"],
              ["gw", "ride", "estimate"],
              ["ride", "ridedb", "INSERT fare"],
              ["ride", "rider", "$12 · 15 phút", "ok"],
            ],
            detail: "Ride Service báo giá **$12 · 15 phút**, ước tính từ quãng đường, thời gian và surge của khu vực sau khi rider nhập điểm đón và điểm đến. Fare lưu vào Ride DB để khi rider xác nhận, giá đã báo được **khoá lại** — không đổi giữa chừng nếu surge tăng. Fare thường có hạn dùng vài phút.",
          },
          {
            note: "Rider xác nhận → ride `REQUESTED`, gọi Matching.",
            msgs: [
              ["rider", "gw", "POST /rides"],
              ["gw", "ride", "createRide"],
              ["ride", "ridedb", "ride#7 REQUESTED"],
              ["ride", "match", "match(ride#7)"],
            ],
            set: { ridedb: "ride#7 REQUESTED" },
            detail: "Ride Service tạo `ride#7` trạng thái **REQUESTED** trong Postgres trước, rồi mới gọi Matching. Ghi DB trước để chuyến tồn tại bền vững: Matching crash thì ride vẫn còn và được ghép lại, rider không phải đặt lại. Trạng thái chuyến là state machine (`REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED`), mỗi lần chuyển là conditional update để không nhảy sai trạng thái.",
          },
          {
            note: "Tìm tài xế trong bán kính 2km.",
            msgs: [["match", "geo", "GEOSEARCH 2km"], ["geo", "match", "[d42, d7, d13]", "ok"]],
            detail: "Matching nhận `[d42, d7, d13]` từ `GEOSEARCH` bán kính **2km** quanh điểm đón, sắp theo khoảng cách, trong vài ms vì truy vấn chỉ chạm bộ nhớ. Cần lọc thêm tài xế đang rảnh (không chở khách, không giữ offer khác); bán kính 2km trống thì mở rộng dần. Khoảng cách đường chim bay chỉ là xấp xỉ — hệ thống thật xếp hạng lại theo ETA trên bản đồ đường.",
          },
          {
            note: "**Khoá tài xế** gần nhất 10s để không chuyến nào khác gửi offer cho d42.",
            msgs: [["match", "lock", "SET driver:d42 NX EX 10"], ["lock", "match", "OK", "ok"]],
            set: { lock: "d42 → ride#7" },
            detail: "Matching **khoá d42 trong 10 giây** bằng `SET driver:d42 ride#7 NX EX 10`. Không khoá thì hai rider gần nhau đặt cùng lúc sẽ cùng chọn d42 là tài xế gần nhất và cùng gửi offer → tài xế nhận hai lời mời một lúc. `NX` đảm bảo chỉ một chuyến lấy được lock; chuyến kia nhận nil và chuyển sang tài xế tiếp theo. TTL 10 giây vừa là thời gian tài xế được suy nghĩ, vừa đảm bảo lock không kẹt mãi nếu Matching chết.",
          },
          {
            note: "Gửi offer qua push notification; tài xế nhận.",
            msgs: [
              ["match", "driver", "offer ride#7", "warn"],
              ["driver", "gw", "PATCH accept"],
              ["gw", "ride", "accept"],
            ],
            detail: "Tài xế d42 nhận offer `ride#7` và bấm nhận; app gửi `PATCH accept` qua gateway tới Ride Service. Offer đi qua kết nối đang mở của app tài xế; push notification chỉ là đường dự phòng (push có thể trễ vài giây, nên không làm kênh chính). Ride Service phải kiểm lock vẫn là `d42 → ride#7`: tài xế bấm sau khi lock hết hạn và chuyến đã chuyển cho người khác thì lời nhận bị từ chối.",
          },
          {
            note: "Cập nhật ride, báo rider.",
            msgs: [["ride", "ridedb", "ride#7 ACCEPTED", "ok"], ["ride", "rider", "Tài xế đang tới", "ok"]],
            set: { ridedb: "ride#7 ACCEPTED (d42)" },
            good: ["ridedb"],
            lesson: "Proximity search + TTL lock: mỗi tài xế chỉ nhận một offer tại một thời điểm.",
            detail: "Ride Service cập nhật `ride#7 ACCEPTED (d42)` bằng conditional update `WHERE status='REQUESTED'` → hai lời nhận tới gần như cùng lúc thì chỉ một thắng. Sau đó Ride Service báo rider “Tài xế đang tới” và bắt đầu stream vị trí d42 cho rider. Lock trên d42 có thể xoá hoặc để tự hết; từ giờ trạng thái “đang bận” của tài xế nằm ở Ride DB — source of truth.",
          },
        ],
      },
      {
        name: "Tài xế không phản hồi",
        steps: [
          {
            note: "Matching gửi offer cho d42, lock giữ 10s.",
            set: { lock: "d42 → ride#7" },
            msgs: [["match", "driver", "offer → d42", "warn"]],
            detail: "Lock `d42 → ride#7` giữ 10 giây sau khi Matching gửi offer cho d42: trong thời gian này không chuyến nào khác gửi offer cho d42, còn rider phải chờ. Đây là đánh đổi: TTL dài cho tài xế thời gian suy nghĩ nhưng bắt rider chờ lâu hơn nếu tài xế bỏ qua.",
          },
          {
            note: "10s không phản hồi → lock **tự hết hạn**.",
            set: { lock: "(hết hạn)" },
            bad: ["driver"],
            detail: "Tài xế không phản hồi (đang lái, mất sóng, cố tình lờ), và sau 10 giây key **tự hết hạn** trong Redis — không cần ai gọi `DEL`. Không có TTL, tài xế mất sóng sẽ bị khoá mãi và không nhận được chuyến nào khác. Matching cần timer riêng để biết d42 đã hết lượt, vì Redis không báo chủ động (keyspace notification có, nhưng không đáng tin để điều khiển luồng).",
          },
          {
            note: "Chuyển sang tài xế kế tiếp.",
            msgs: [
              ["match", "lock", "SET driver:d7 NX EX 10"],
              ["lock", "match", "OK", "ok"],
              ["match", "driver", "offer → d7", "warn"],
              ["driver", "gw", "accept (d7)", "ok"],
            ],
            set: { lock: "d7 → ride#7" },
            lesson: "Vòng offer → timeout → người kế tiếp nên chạy trong durable workflow (Temporal/queue) để không mất chuyến khi service restart.",
            detail: "d7 nhận chuyến: Matching lấy lock `driver:d7` với `NX EX 10`, gửi offer, và luồng tiếp tục như bình thường. Nếu d42 bấm nhận muộn ngay lúc này, conditional update trên `ride#7` (đã `ACCEPTED` bởi d7) sẽ từ chối → không bao giờ có hai tài xế cùng nhận một chuyến. Vòng offer → chờ → người kế tiếp kéo dài nhiều phút và nhiều bước, nên chạy trong **durable workflow** (Temporal hoặc queue có retry): Matching Service restart giữa chừng thì workflow tiếp tục từ đúng bước, chuyến không bị bỏ rơi.",
          },
        ],
      },
    ],
  },
  diagrams: [
    {
      src: "content/svg/uber-geohash.svg",
      caption: "Redis GEO lưu toạ độ thành geohash 52 bit làm score của sorted set; GEOSEARCH quét ô chứa tâm cùng 8 ô kề rồi loại tài xế ngoài bán kính, vì hai ô sát nhau có thể khác prefix.",
      source: "https://redis.io/docs/latest/commands/geoadd/",
    },
  ],
  deep: [
    {
      q: "Ghi 400k vị trí/giây?",
      bad: "UPDATE Postgres mỗi lần.",
      good: "PostGIS + batch ghi.",
      great: "Redis GEO in-memory; xoá tài xế mất tín hiệu bằng heartbeat key có TTL + job `ZREM`; giảm tần suất gửi khi tài xế đứng yên (adaptive interval).",
      why: {
        bad: "Postgres thường chỉ chịu vài chục nghìn write/s trên một primary, cách xa 400k, vì mỗi `UPDATE` sinh WAL, cập nhật index và lock row. Dữ liệu vị trí lại chỉ có giá trị vài giây — ghi bền vững là lãng phí.",
        good: "Batch giảm số transaction, PostGIS có spatial index cho truy vấn gần. Nhưng vẫn ghi xuống đĩa và cập nhật index cho dữ liệu chỉ sống 5 giây; batch còn tạo độ trễ khiến vị trí bị cũ.",
        great: "Một cluster Redis nhỏ chịu được 400k write/s, vì Redis GEO lưu trong RAM dưới dạng sorted set theo geohash nên ghi và `GEOSEARCH` đều nhanh. Adaptive interval giảm tần suất gửi khi tài xế đứng yên, cắt phần lớn write vô ích.",
      },
    },
    {
      q: "Không gửi một tài xế cho hai chuyến?",
      bad: "Kiểm tra trong code rồi gửi (race condition).",
      good: "Cột status trong DB + transaction.",
      great: "Redis lock TTL theo driver (SET NX EX 10) + conditional update khi accept.",
      why: {
        bad: "Tài xế nhận hai chuyến: hai instance Matching cùng đọc thấy tài xế rảnh rồi cùng gửi lời mời (check-then-act), cả hai đều nghĩ mình hợp lệ.",
        good: "Transaction + cột status trên DB chặn được hai chuyến cùng gán một tài xế. Nhưng vòng mời kéo dài 10s: giữ transaction/row lock suốt thời gian đó làm DB nghẽn, còn không giữ thì vẫn race giữa lúc mời và lúc accept.",
        great: "Chỉ một Matching instance giành được lock của tài xế, vì `SET NX` atomic; `EX 10` tự nhả nếu tài xế không phản hồi, không cần dọn dẹp. Conditional update khi accept (`WHERE status='AVAILABLE'`) là chốt cuối, phòng trường hợp lock đã hết hạn.",
      },
    },
    {
      q: "Không mất yêu cầu lúc peak?",
      bad: "Xử lý đồng bộ trong request.",
      good: "Autoscale Matching Service.",
      great: "Đẩy ride request vào queue (Kafka) partition theo khu vực; workflow bền vững cho vòng ghép.",
      why: {
        bad: "Matching quá tải thì request timeout và rơi mất, vì xử lý đồng bộ; crash giữa vòng ghép cũng mất luôn yêu cầu.",
        good: "Autoscale thêm năng lực khi tải tăng. Nhưng máy mới khởi động mất vài phút, trong khi peak (tan tầm, mưa) đến trong vài giây, và request đang xử lý vẫn mất khi instance chết.",
        great: "Peak chỉ làm hàng đợi dài hơn, không mất request, vì Kafka lưu request bền vững trước khi xử lý. Partition theo khu vực giữ request cùng vùng một chỗ và scale độc lập; workflow bền vững (ví dụ Temporal) lưu trạng thái vòng ghép — worker chết thì worker khác làm tiếp.",
      },
    },
  ],
  sims: ["redlock"],
});
