BK.problem({
  id: "top-k",
  level: 3,
  title: "YouTube Top K",
  hi: "top-k",
  summary: "Đếm hàng trăm nghìn lượt xem mỗi giây và trả top K video theo cửa sổ thời gian gần như tức thì.",
  topics: ["kafka", "bigdata-ds", "streams", "sharding"],
  fr: ["Truy vấn top K video nhiều view nhất (K ≤ 1000)", "Theo cửa sổ: 1 giờ, 1 ngày, 1 tháng, all-time"],
  nfr: [
    {
      t: "Kết quả trễ tối đa ~1 phút",
      why: "Trễ ~1 phút chấp nhận được, vì bảng xếp hạng chỉ cần phản ánh xu hướng. Nhờ đó top K được precompute định kỳ mỗi phút thay vì cập nhật theo từng view.",
    },
    {
      t: "Query < 100ms",
      why: "Không được tính top K lúc query, vì query này được gọi rất nhiều (trang chủ, trending). Hệ quả: kết quả precompute trong cache, query chỉ là một lần đọc key.",
    },
    {
      t: "~800k view/s (70B view/ngày)",
      why: "Với ~800k event/s, mọi thiết kế ghi từng view vào DB đều sập. Hệ quả: đếm in-memory trên stream, partition theo `videoId`, flush theo batch.",
    },
    {
      t: "Chính xác (hoặc sai số nhỏ đã thống nhất với interviewer)",
      why: "Độ chính xác quyết định kiến trúc: chính xác tuyệt đối cần đếm từng video, còn sai số nhỏ cho phép dùng sketch tiết kiệm RAM. Phải chốt với interviewer trước để chọn giữa heap trên count chính xác và Count-Min Sketch.",
    },
  ],
  capacity: "800k event/s vượt xa khả năng ghi của một DB → đếm in-memory trên stream, chia partition.",
  entities: ["View event", "Video", "Time window", "Top-K result"],
  api: ["GET /views/top?window=1h&k=100 → [{ videoId, views }]"],
  hldWhy: "**Video Player** gửi event vào **Kafka** partition theo `videoId`, **Counter Workers** đếm in-memory theo partition — vì 800k view/s vượt xa khả năng ghi của DB. **Count Store** lưu count theo (video, phút) vì cửa sổ trượt 1 giờ/1 ngày cần bucket nhỏ để cộng đầu trừ đuôi. **Top-K Merger** định kỳ gom top K cục bộ của mỗi partition thành top K toàn cục, vì tính top K lúc query trên hàng tỷ video không thể dưới 100ms. **Top-K Cache** (Redis) giữ kết quả tính sẵn để **Query API** chỉ đọc một key.",
  hld: {
    id: "hld-top-k",
    title: "HLD — YouTube Top K",
    h: 370,
    scenario: "View event vào Kafka theo videoId; mỗi counter worker đếm và giữ heap top-K của partition mình; Merger gộp thành top-K toàn cục.",
    context: "View event vào **Kafka** với key = videoId, nên mọi view của một video luôn tới cùng một **Counter Worker**. Mỗi worker đếm theo bucket phút trong **Count Store** và giữ top-K cục bộ cho partition của mình. **Top-K Merger** gộp N danh sách cục bộ thành top-K toàn cục, ghi vào **Top-K Cache** (Redis sorted set) để **Query API** chỉ cần đọc. Theo dõi dòng chữ dưới Counter Workers: số đếm, cửa sổ đang tính, và top-K cục bộ.",
    nodes: [
      { id: "player", x: 80, y: 80, label: "Video Player" },
      { id: "kafka", x: 280, y: 80, label: "Kafka", s: "partition theo videoId" },
      { id: "cw", x: 480, y: 80, label: "Counter Workers", w: 150, s: "partition 0..N" },
      { id: "store", x: 700, y: 80, label: "Count Store", s: "video × phút" },
      { id: "merger", x: 480, y: 230, label: "Top-K Merger", w: 150 },
      { id: "cache", x: 700, y: 230, label: "Top-K Cache", s: "Redis" },
      { id: "client", x: 80, y: 320, label: "Client" },
      { id: "api", x: 280, y: 320, label: "Query API" },
    ],
    links: [
      ["player", "kafka"],
      ["kafka", "cw"],
      ["cw", "store"],
      ["cw", "merger"],
      ["merger", "cache"],
      ["api", "cache"],
      ["client", "api"],
    ],
    variants: [
      {
        name: "Đếm view",
        steps: [
          {
            note: "Mỗi lượt xem phát event vào **Kafka**, partition theo videoId → mọi view của một video vào cùng một worker.",
            msgs: [["player", "kafka", "View v123"]],
            set: { kafka: "~800k event/s" },
            detail: "Mọi view của v123 vào cùng một partition và chỉ một worker xử lý, vì player phát `View v123` vào Kafka với **key = videoId** và Kafka hash key để chọn partition → không có hai máy cùng đếm một video. Với ~800k event/s, chia partition là cách duy nhất để scale; partition theo videoId (thay vì ngẫu nhiên) giữ bước gộp phía sau đơn giản và chính xác. Video viral có thể làm một partition quá tải — giảm bằng cách gộp trước ở client/edge.",
          },
          {
            note: "Worker cộng dồn theo **bucket phút** cho từng video trong partition của mình.",
            msgs: [["kafka", "cw", "batch views"], ["cw", "store", "v123 · 10:05 +1"]],
            set: { cw: "v123 @10:05 = 8,410" },
            detail: "Worker cộng dồn view trong RAM theo **(video, phút)** rồi định kỳ flush xuống Count Store (`v123 · 10:05 +1`) — ví dụ v123 phút 10:05 đang là 8,410. Worker đọc theo batch, không ghi từng view xuống DB → lượng ghi giảm hàng nghìn lần. Bucket phút là đơn vị nhỏ nhất để sau này tính cửa sổ 1h, 1 ngày bằng cách cộng các bucket.",
          },
          {
            note: "Mỗi worker giữ **min-heap K** cho từng cửa sổ: video vượt đáy heap thì thay vào.",
            set: { cw: "local top-100 mỗi window" },
            detail: "Worker giữ một **min-heap kích thước K** (K = 100) cho mỗi cửa sổ (1h, 1 ngày, all-time); đỉnh heap là video ít view nhất trong top. Video nào có count vượt đỉnh heap thì worker pop đỉnh và push video đó vào — O(log K) mỗi lần, không cần sắp xếp hàng triệu video. Lưu ý heap chỉ là chỉ mục; worker vẫn phải giữ count đầy đủ của mọi video trong partition để biết khi nào video ngoài heap vượt lên.",
          },
          {
            note: "Vài giây một lần, worker gửi local top-K; Merger gộp N danh sách thành **global top-K**.",
            msgs: [
              { par: [["cw", "merger", "top-100 (p0)"], ["cw", "merger", "top-100 (p1)"]] },
              ["merger", "cache", "ZADD top:1h", "ok"],
            ],
            set: { cache: "top:1h · top:1d · top:all" },
            lesson: "Gộp các local top-K cho ra top-K toàn cục **chính xác**, vì partition theo videoId nên mỗi video chỉ đếm ở một nơi.",
            detail: "Merger chọn 100 video lớn nhất từ N danh sách cục bộ (p0, p1, …) và ghi bằng `ZADD top:1h` vào Redis; mỗi worker gửi local top-100 vài giây một lần. Kết quả **chính xác** vì tập video của các partition không giao nhau: video trong global top-100 chắc chắn nằm trong top-100 của partition chứa nó. Nếu partition ngẫu nhiên, count của một video bị chia ra nhiều worker và có thể không lọt top cục bộ ở đâu dù tổng rất lớn. Cache lưu sẵn `top:1h`, `top:1d`, `top:all` cho từng cửa sổ.",
          },
        ],
      },
      {
        name: "Cửa sổ trượt 1 giờ",
        steps: [
          {
            note: "Top 1h phải **trừ** view đã quá 60 phút, không chỉ cộng.",
            set: { cw: "window 09:06–10:05" },
            detail: "Top 1h là **sliding window**: lúc 10:05 nó là tổng view từ 09:06 tới 10:05. Khác all-time chỉ cần cộng, ở đây view cũ phải **rơi ra** sau 60 phút, nếu không “top 1 giờ” dần thành top all-time. Worker giữ cho mỗi video tổng của 60 bucket phút gần nhất.",
          },
          {
            note: "Sang phút mới: cộng bucket 10:06, **trừ** bucket 09:06 vừa rơi khỏi cửa sổ.",
            msgs: [["kafka", "cw", "views 10:06"], ["store", "cw", "bucket 09:06 (trừ)", "warn"]],
            set: { cw: "window 09:07–10:06" },
            detail: "Sang phút 10:06, cửa sổ trượt thành 09:07–10:06: worker cộng bucket 10:06 mới từ Kafka và đọc lại bucket **09:06** từ Count Store để **trừ** đi. Nhờ bucket phút, mỗi phút chỉ cần một phép cộng và một phép trừ cho mỗi video có view, không phải cộng lại cả 60 phút. Cửa sổ dài hơn (tháng) dùng bucket giờ hoặc ngày để số bucket phải giữ không phình.",
          },
          {
            note: "Cập nhật heap; video tụt hạng rơi khỏi heap.",
            msgs: [["cw", "merger", "local top-100"], ["merger", "cache", "ZADD top:1h", "ok"]],
            lesson: "Sliding window = cộng đầu, trừ đuôi. Bucket phút giữ chi phí trừ thấp; cửa sổ tháng dùng bucket giờ/ngày.",
            detail: "Worker tính lại top cục bộ vì sau khi trừ, count của nhiều video **giảm**: video tụt hạng bị đẩy ra, video khác vượt lên thay chỗ. Min-heap thuần chỉ xử lý được count tăng; khi count giảm, worker cần cấu trúc cho phép cập nhật (heap có index, hoặc chọn lại top-K từ bảng count đầy đủ của partition). Worker gửi local top-100 mới, Merger gộp và `ZADD top:1h` ghi đè kết quả cũ.",
          },
        ],
      },
      {
        name: "Query",
        steps: [
          {
            note: "Cache giữ sẵn kết quả đã **precompute**.",
            msgs: [
              ["client", "api", "GET /views/top?window=1h"],
              ["api", "cache", "ZREVRANGE top:1h 0 99"],
              ["cache", "api", "100 video", "ok"],
              ["api", "client", "200 · 5ms", "ok"],
            ],
            lesson: "Luôn < 100ms vì chỉ đọc kết quả tính sẵn, không tính lúc query.",
            detail: "Query API trả top 100 video trong khoảng **5ms**: client gọi `GET /views/top?window=1h`, Query API chạy `ZREVRANGE top:1h 0 99` trên Redis, lấy 100 video theo score giảm dần. Lúc query không tính toán gì — worker và Merger đã tính trước. Đổi lại kết quả cũ vài giây (độ trễ một vòng gộp), hoàn toàn chấp nhận được với bảng xếp hạng.",
          },
        ],
      },
    ],
  },
  diagrams: [
    {
      src: "content/svg/bigdata-ds-count-min-sketch.svg",
      caption: "Khi chấp nhận sai số, Count-Min Sketch thay bảng đếm từng video bằng d × w bộ đếm cố định: lấy min của các hàng nên chỉ đếm dư, không đếm thiếu — hợp để tìm video lượt xem cao rồi đưa vào heap K.",
      source: "https://redis.io/docs/latest/develop/data-types/probabilistic/count-min-sketch/",
    },
  ],
  deep: [
    {
      q: "Đếm ~800k view/giây?",
      bad: "UPDATE videos SET views = views + 1 mỗi lượt xem.",
      good: "Kafka + worker gom batch rồi ghi.",
      great: "Partition theo videoId, đếm in-memory (Flink) có checkpoint; video cực hot chia sub-partition rồi cộng lại.",
      why: {
        bad: "Video hot nhận hàng nghìn update/giây trên cùng một row nên tranh chấp lock, vì mỗi `UPDATE` khoá row; tổng 800k write/s vượt xa khả năng của một DB.",
        good: "Gom batch biến hàng nghìn +1 thành một lần `+n`, giảm số write hàng trăm lần. Nhưng worker crash trước khi ghi batch là mất số đếm, và chưa nói rõ chia worker thế nào để không đếm trùng.",
        great: "Không tranh chấp và cộng in-memory rất nhanh, vì partition theo `videoId` nên mỗi video chỉ một worker đếm. Checkpoint của Flink lưu state + offset để crash xong khôi phục chính xác; video cực hot chia sub-partition rồi cộng lại để một worker không thành bottleneck.",
      },
    },
    {
      q: "Tính top K thế nào?",
      bad: "Sort toàn bộ video mỗi lần query.",
      good: "Heap K trên bảng count khi query.",
      great: "Heap K cục bộ mỗi partition + merge định kỳ, precompute vào cache (video hot chia sub-partition thì cộng các phần trước khi đưa vào heap). Nếu chấp nhận sai số: Count-Min Sketch + heap.",
      why: {
        bad: "Sort hàng tỷ video là O(n log n) → mỗi query mất hàng giây đến hàng phút, không thể dưới 100ms.",
        good: "Heap kích thước K giảm xuống O(n log K), RAM O(K). Nhưng mỗi query vẫn quét toàn bộ bảng count.",
        great: "Merge N heap nhỏ là đủ và đúng: mỗi video chỉ nằm ở một partition, nên top K toàn cục chắc chắn nằm trong hợp các top K cục bộ. Kết quả precompute vào cache mỗi phút; khi chấp nhận sai số, Count-Min Sketch thay bảng count với RAM cố định bất kể số video.",
      },
    },
    {
      q: "Cửa sổ trượt 1 giờ / 1 ngày?",
      bad: "Chỉ cộng, không trừ (thành all-time).",
      good: "Tính lại từ bucket phút mỗi phút.",
      great: "Cộng đầu trừ đuôi trên bucket phút; trừ đuôi bằng consumer thứ hai đọc Kafka trễ đúng một cửa sổ.",
      why: {
        bad: "Count tích luỹ vô hạn — kết quả là top all-time chứ không phải top 1 giờ — vì chỉ cộng mà không trừ view đã ra khỏi cửa sổ.",
        good: "Tính lại từ bucket phút cho kết quả đúng. Nhưng cửa sổ 1 ngày là cộng 1,440 bucket cho mỗi video mỗi phút, chi phí lớn khi số video nhiều.",
        great: "Mỗi phút chỉ cần hai phép cộng/trừ cho mỗi video có thay đổi, vì count(cửa sổ) = count cũ + bucket mới vào − bucket vừa ra. Consumer thứ hai đọc Kafka trễ đúng một cửa sổ phát ra event trừ, nên phần trừ dùng cùng logic đếm — chỉ cần Kafka retention dài hơn cửa sổ.",
      },
    },
  ],
  sims: ["queue"],
});
