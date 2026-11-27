BK.problem({
  id: "ad-click",
  level: 3,
  title: "Ad Click Aggregator",
  hi: "ad-click-aggregator",
  summary: "Ghi nhận hàng chục nghìn click/giây không mất, không đếm trùng; advertiser xem số theo phút.",
  topics: ["kafka", "streams", "queue", "patterns"],
  fr: ["User click quảng cáo → redirect tới trang advertiser", "Advertiser xem số click theo phút / giờ / ngày"],
  nfr: [
    {
      t: "10k click/s trung bình, peak cao hơn nhiều",
      why: "Hệ thống phải hấp thụ spike, vì peak gấp nhiều lần trung bình (campaign, giờ cao điểm). Hệ quả: Kafka làm buffer giữa ingest và xử lý, partition để scale ngang.",
    },
    {
      t: "Query < 1s",
      why: "Query chậm là trải nghiệm tệ, vì advertiser xem dashboard tương tác. Hệ quả: chỉ query trên bảng đã pre-aggregate trong OLAP columnar, không quét raw.",
    },
    {
      t: "**Không mất click, không đếm trùng** (liên quan tiền)",
      why: "Mất click là thất thu, đếm trùng là tính tiền sai cho khách, vì click là cơ sở tính tiền. Hệ quả: log bền vững, exactly-once trong Flink, dedupe theo id và đối soát batch.",
    },
    {
      t: "Số liệu gần realtime (trễ vài phút)",
      why: "Trễ vài phút là chấp nhận được, vì advertiser chỉ cần điều chỉnh campaign theo xu hướng. Nhờ đó aggregate theo cửa sổ phút trong stream thay vì cập nhật counter từng click.",
    },
  ],
  capacity: "~864M click/ngày → raw event phải vào log bền vững; query chạy trên bảng đã aggregate.",
  entities: ["Ad", "Click event", "Aggregated metric (ad, minute, count)"],
  api: ["GET /click?adId&impressionId → 302 advertiser URL", "GET /ads/{id}/metrics?from&to&granularity"],
  hldWhy: "**Click Processor** chỉ ghi event vào **Kafka** rồi redirect ngay — vì click liên quan tiền, Kafka làm log bền vững để không mất click kể cả khi phía sau chậm. **Flink** đọc stream và aggregate theo phút có checkpoint → số liệu gần realtime mà không ghi từng click vào DB. **S3 raw + Spark** giữ bản gốc để chạy batch reconciliation, phát hiện sai lệch của pipeline streaming. Chọn **OLAP DB** (ClickHouse) thay vì Postgres vì query dashboard là aggregate trên cột (sum theo ad, theo giờ): columnar storage chỉ đọc cột cần và nén tốt nên trả lời dưới 1s.",
  hld: {
    id: "hld-ad-click",
    title: "HLD — Ad Click Aggregator",
    h: 360,
    scenario: "Click vào Kafka, Flink đếm theo cửa sổ 1 phút ghi vào OLAP; batch job đối soát từ raw data trên S3.",
    context: "**Click Processor** nhận click, chặn trùng, ghi event thô vào **Kafka** và redirect user ngay. **Flink** đọc stream, đếm theo cửa sổ 1 phút cho từng ad và ghi số đã aggregate vào **OLAP DB** (ClickHouse), nơi **Query Service** đọc để vẽ dashboard. Song song, raw event đổ xuống **S3** để **Spark** đếm lại theo giờ và sửa số nếu stream lệch. Theo dõi dòng chữ dưới OLAP: con số `ad7 10:01` đổi từ 1532 thành 1540 sau đối soát.",
    nodes: [
      { id: "browser", x: 80, y: 80, label: "Browser" },
      { id: "adv", x: 80, y: 280, label: "Advertiser", s: "dashboard" },
      { id: "click", x: 280, y: 80, label: "Click Processor", w: 150 },
      { id: "query", x: 280, y: 280, label: "Query Service" },
      { id: "kafka", x: 490, y: 80, label: "Kafka" },
      { id: "flink", x: 700, y: 80, label: "Flink" },
      { id: "s3", x: 490, y: 180, label: "S3 raw + Spark", w: 150 },
      { id: "olap", x: 700, y: 280, label: "OLAP DB", s: "ClickHouse" },
    ],
    links: [
      ["browser", "click"],
      ["adv", "query"],
      ["click", "kafka"],
      ["kafka", "flink"],
      ["kafka", "s3"],
      ["flink", "olap"],
      ["query", "olap"],
      ["s3", "olap"],
    ],
    variants: [
      {
        name: "Ghi nhận click",
        steps: [
          {
            note: "User bấm quảng cáo; request kèm `impressionId` đã ký.",
            msgs: [["browser", "click", "GET /click?ad=7&imp=x9"]],
            detail: "Click Processor kiểm tra chữ ký của `impressionId` x9 để loại click giả mạo khi browser gửi `GET /click?ad=7&imp=x9`. x9 được sinh và **ký** (HMAC) lúc quảng cáo hiển thị → kẻ gian không tự bịa được impressionId hợp lệ. Mỗi impression chỉ tính tối đa một click — cơ sở để chống click spam và tính tiền đúng.",
          },
          {
            note: "Kiểm tra trùng impressionId rồi ghi event vào **Kafka** (partition theo adId).",
            msgs: [["click", "kafka", "ClickEvent ad7", "ok"]],
            set: { kafka: "partition 3: ad7" },
            detail: "Click Processor ghi `ClickEvent ad7` vào Kafka với **key = adId**, sau khi kiểm `x9` chưa được tính (thường `SET NX` với TTL trong Redis); trùng thì bỏ qua, chỉ redirect. Key = adId đưa mọi click của ad7 vào cùng partition 3 và cùng một Flink task → đếm theo ad mà không cần gộp chéo máy. Kafka là log bền, có replication: ghi được là click đã an toàn, dù Flink đang chậm hay đang deploy lại. Rủi ro cần nhớ: ad cực hot dồn hết vào một partition (**hot partition**) — giải bằng cách thêm hậu tố ngẫu nhiên vào key rồi gộp lại sau.",
          },
          {
            note: "Trả **302** sang trang advertiser ngay — không chờ xử lý số liệu.",
            msgs: [["click", "browser", "302 advertiser.com", "ok"]],
            detail: "Click Processor trả **302** về `advertiser.com` ngay sau khi Kafka ack. User không chờ phép đếm hay lần ghi DB nào — click quảng cáo phải nhanh, redirect chậm thì user bỏ đi và advertiser mất khách. Mọi xử lý số liệu diễn ra bất đồng bộ phía sau.",
          },
          {
            note: "Flink đếm theo **tumbling window 1 phút** cho từng ad, flush vào OLAP.",
            msgs: [["kafka", "flink", "stream"], ["flink", "olap", "ad7 · 10:01 · 1532", "ok"]],
            set: { flink: "window 10:01", olap: "ad7 10:01 = 1532" },
            lesson: "Raw event vào log bền vững, aggregate bằng stream processing, query trên bảng đã pre-aggregate.",
            detail: "Flink ghi `ad7 · 10:01 · 1532` vào ClickHouse khi cửa sổ 10:01 đóng. Flink gom click của từng ad vào **tumbling window 1 phút** (cửa sổ không chồng nhau: 10:00–10:01, 10:01–10:02…), đóng cửa sổ theo **event time** và watermark chứ không theo giờ máy chủ → click lúc 10:01:59 đến muộn vài giây vẫn vào đúng phút. Checkpoint của Flink cùng offset Kafka giúp không đếm trùng khi task restart. OLAP chỉ giữ 1 dòng mỗi ad mỗi phút thay vì hàng tỷ click thô.",
          },
        ],
      },
      {
        name: "Advertiser xem số",
        steps: [
          {
            note: "Dashboard hỏi click theo phút trong 24h.",
            msgs: [
              ["adv", "query", "GET /ads/7/metrics"],
              ["query", "olap", "SUM GROUP BY minute"],
              ["olap", "query", "1440 rows", "ok"],
              ["query", "adv", "chart", "ok"],
            ],
            lesson: "Query < 1s dù có hàng tỷ click raw, vì chỉ chạy trên dữ liệu đã aggregate.",
            detail: "Query Service trả số liệu 24h của ad7 dưới 1 giây, dù tổng click thô lên tới hàng tỷ. Dashboard gọi `GET /ads/7/metrics`; Query Service dịch thành `SUM ... GROUP BY minute` trên ClickHouse và nhận **1440 dòng** (24 × 60). Flink đã pre-aggregate nên query chỉ quét 1440 dòng của ad7 chứ không phải hàng triệu click thô, và ClickHouse lưu cột + sắp theo (adId, minute) nên đọc rất nhanh. Muốn xem theo giờ/ngày thì cộng tiếp các dòng phút, hoặc giữ thêm bảng rollup sẵn.",
          },
        ],
      },
      {
        name: "Đối soát",
        steps: [
          {
            note: "Kafka đồng thời đổ raw event xuống S3.",
            msgs: [["kafka", "s3", "raw events"]],
            set: { s3: "raw: 864M click/ngày" },
            detail: "Ngoài Flink, một consumer khác (ví dụ Kafka Connect S3 sink) đổ toàn bộ raw event xuống S3 thành file theo giờ — khoảng **864M click/ngày**, tức ~10k click/s. Hai consumer group đọc độc lập cùng topic nên không ảnh hưởng nhau. S3 rẻ và bền nên giữ được dữ liệu thô nhiều tháng — đây là **nguồn sự thật** để tính lại khi tranh chấp với advertiser.",
          },
          {
            note: "Batch job (Spark) mỗi giờ đếm lại từ raw, so với số Flink đã ghi.",
            set: { s3: "recount 10:00–11:00" },
            msgs: [["s3", "olap", "so sánh", "warn"]],
            detail: "Mỗi giờ Spark đếm lại chính xác click theo (ad, phút) từ file raw khung 10:00–11:00 trên S3, rồi so với số Flink đã ghi trong OLAP. Batch không bị giới hạn bởi watermark hay trạng thái trong RAM như stream. Stream có thể lệch vì event đến **muộn hơn watermark** (Flink bỏ hoặc đẩy vào side output), vì bug, hoặc vì task restart xử lý trùng/thiếu.",
          },
          {
            note: "Lệch (event đến trễ, lỗi stream) → ghi đè số đúng.",
            msgs: [["s3", "olap", "fix ad7 10:01 = 1540", "ok"]],
            set: { olap: "ad7 10:01 = 1540 ✓" },
            lesson: "Stream cho tốc độ, batch cho độ chính xác — không lệch tiền với advertiser.",
            detail: "Spark ghi đè dòng phút 10:01 của ad7 trong OLAP thành `1540 ✓` — nhiều hơn 8 so với 1532 của Flink (8 click đến trễ). Đây là **Lambda architecture** thu nhỏ: stream cho số gần đúng trong vài giây để advertiser theo dõi, batch cho số chính xác để tính tiền. Hoá đơn gửi advertiser dựa trên số đã đối soát → không bao giờ thu thiếu hay thu thừa.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Scale 10k+ click/s, có ad cực hot?",
      bad: "Ghi thẳng mỗi click vào DB.",
      good: "Kafka partition theo adId.",
      great: "Partition theo adId + salt (adId:0..N) cho ad hot để chia tải nhiều partition, Flink gộp lại.",
      why: {
        bad: "DB nghẽn vì mỗi click là một transaction: 10k write/s trung bình, peak cao hơn nhiều. DB chậm thì redirect của user cũng chậm theo.",
        good: "Kafka hấp thụ write với throughput rất cao; partition theo `adId` cho Flink đếm mỗi ad tại một chỗ. Nhưng một ad cực hot dồn toàn bộ click vào một partition — consumer của partition đó thành bottleneck.",
        great: "Tải chia cho N consumer, vì salt (`adId:0..N`) rải click của ad hot ra N partition. Flink cộng N count con ở bước sau; kết quả vẫn đúng vì phép đếm có tính cộng.",
      },
    },
    {
      q: "Không mất và không đếm trùng?",
      bad: "Đếm trong RAM của app server.",
      good: "Kafka retention + Flink checkpoint (exactly-once trong pipeline).",
      great: "Thêm dedupe theo impressionId đã ký + batch reconciliation từ raw S3.",
      why: {
        bad: "App server restart hoặc crash là mất toàn bộ số đếm chưa flush, vì counter nằm trong RAM; nhiều server cũng không đếm nhất quán chung được.",
        good: "Kafka retention giữ event để replay; Flink checkpoint lưu state + offset nên crash xong khôi phục mà không mất hay đếm trùng trong pipeline. Nhưng click trùng từ nguồn (user bấm hai lần, bot, client retry) đã vào Kafka thành hai event riêng nên vẫn bị đếm.",
        great: "Flink dedupe theo `impressionId` loại được click lặp và id giả mạo, vì server ký id đó lúc hiển thị ad. Batch reconciliation trên raw S3 tính lại độc lập, lệch với số streaming thì sửa — lớp kiểm tra thứ hai cho dữ liệu tiền.",
      },
    },
    {
      q: "Query nhanh trên dữ liệu khổng lồ?",
      bad: "COUNT(*) trên bảng raw.",
      good: "Pre-aggregate theo phút.",
      great: "OLAP columnar (ClickHouse/Druid) + rollup giờ/ngày, chỉ query bảng đã gộp.",
      why: {
        bad: "`COUNT(*)` trên vài tháng raw là quét hàng chục tỷ row (~864M row mỗi ngày), mất phút tới giờ.",
        good: "Pre-aggregate theo phút giảm số row từ mỗi click xuống mỗi (ad, phút). Nhưng query khoảng dài (30 ngày) vẫn phải cộng 43,200 bucket mỗi ad, và DB hàng (row-store) đọc cả row dù chỉ cần một cột.",
        great: "Scan aggregate nhanh hơn row-store nhiều lần, vì columnar storage chỉ đọc cột cần và nén mạnh. Rollup giờ/ngày giảm 60–1440 lần số row cho query khoảng dài; dashboard chọn bảng có độ chi tiết phù hợp và trả lời dưới 1s.",
      },
    },
  ],
  sims: ["queue"],
});
