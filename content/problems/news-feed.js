BK.problem({
  id: "news-feed",
  level: 2,
  title: "News Feed (Facebook)",
  hi: "fb-news-feed",
  summary: "Đọc feed trong < 500ms cho 2 tỷ user; xử lý celebrity có hàng trăm triệu follower.",
  topics: ["kafka", "patterns", "queue", "caching"],
  fr: ["Đăng bài", "Follow người khác", "Xem feed (bài của người mình follow, mới nhất trước), phân trang"],
  nfr: [
    {
      t: "Feed load < 500ms",
      why: "Feed chậm là user rời đi, vì đây là màn hình đầu tiên khi mở app. Yêu cầu này buộc precompute feed vào cache, đọc feed chỉ còn một lần lấy list.",
    },
    {
      t: "Bài mới hiện trong feed trong ~1 phút (eventual consistency)",
      why: "Cho phép trễ ~1 phút, vì user không biết hay cần bài xuất hiện tức thì. Nhờ đó fan-out chạy bất đồng bộ qua Kafka thay vì đồng bộ trong request đăng bài.",
    },
    {
      t: "2B user",
      why: "Mọi dữ liệu (post, follow, feed) phải phân tán và scale ngang ở quy mô 2B user. Hệ quả: DynamoDB, Redis cluster và worker scale theo partition Kafka.",
    },
    {
      t: "Follow không giới hạn (celebrity)",
      why: "Fan-out on write một bài của celebrity là 100M lần ghi cache, vì celebrity có thể có 100M follower. Yêu cầu này sinh ra mô hình hybrid: bài celebrity được kéo lúc đọc thay vì đẩy lúc ghi.",
    },
  ],
  capacity: "Đọc feed rất nhiều; một bài của celebrity có thể phải tới 100M feed → không fan-out ngây thơ được.",
  entities: ["User", "Follow", "Post", "Feed"],
  api: ["POST /posts { content }", "PUT /users/{id}/followers", "GET /feed?cursor&limit → posts + nextCursor"],
  hldWhy: "**Post Service** chỉ lưu bài rồi đẩy event vào **Kafka**, **Fan-out Worker** xử lý bất đồng bộ phía sau — vì đăng bài phải nhanh, còn phát bài tới follower thì tốn kém. **Feed Cache** (Redis) giữ sẵn danh sách post id của từng reader, nên mở feed chỉ là đọc một list thay vì JOIN follow với posts. **Posts DB** dùng DynamoDB vì truy cập chủ yếu là get theo `postId` ở quy mô 2B user — key-value scale ngang dễ hơn Postgres. **Follow DB** tách riêng vì Fan-out Worker cần quét danh sách follower, còn Feed Service cần danh sách celebrity mình theo dõi để merge lúc đọc.",
  hld: {
    id: "hld-news-feed",
    title: "HLD — News Feed",
    h: 380,
    scenario: "Fan-out on write cho user thường (precompute feed trong Redis), fan-out on read cho celebrity.",
    context: "**Post Service** lưu bài vào **Posts DB** (DynamoDB) và chỉ phát event, không tự fan-out. **Fan-out Worker** đọc event từ **Kafka**, hỏi **Follow DB** danh sách follower rồi đẩy post id vào **Feed Cache** (Redis sorted set `feed:<userId>`, score = thời điểm đăng) của từng người. Khi đọc, **Feed Service** chỉ lấy list id đã tính sẵn rồi batch-get nội dung. Theo dõi dòng chữ dưới Feed Cache (bao nhiêu feed đã có bài) và dưới Fan-out Worker (worker fan-out hay bỏ qua).",
    nodes: [
      { id: "author", x: 80, y: 80, label: "Author" },
      { id: "reader", x: 80, y: 300, label: "Reader" },
      { id: "post", x: 270, y: 80, label: "Post Service" },
      { id: "feed", x: 270, y: 300, label: "Feed Service" },
      { id: "kafka", x: 480, y: 80, label: "Kafka" },
      { id: "worker", x: 690, y: 80, label: "Fan-out Worker", w: 150 },
      { id: "posts", x: 480, y: 200, label: "Posts DB", s: "DynamoDB" },
      { id: "follows", x: 690, y: 200, label: "Follow DB" },
      { id: "cache", x: 480, y: 320, label: "Feed Cache", s: "Redis" },
    ],
    links: [
      ["author", "post"],
      ["reader", "feed"],
      ["post", "posts"],
      ["post", "kafka"],
      ["kafka", "worker"],
      ["worker", "follows"],
      ["worker", "cache"],
      ["feed", "cache"],
      ["feed", "posts"],
    ],
    variants: [
      {
        name: "Đăng bài (fan-out on write)",
        steps: [
          {
            note: "Author đăng bài; lưu vào Posts DB.",
            msgs: [
              ["author", "post", "POST /posts"],
              ["post", "posts", "PUT post#88"],
              ["post", "author", "201", "ok"],
            ],
            set: { posts: "post#88" },
            detail: "Author nhận **201** ngay sau một lần ghi DB: Post Service ghi item `post#88` (id, authorId, nội dung, timestamp) vào DynamoDB khi author gọi `POST /posts`. Request không chờ phân phát cho follower — nếu fan-out nằm trong request, author có 500 follower phải chờ 500 lần ghi Redis mới thấy “đăng thành công”. Lúc này bài đã tồn tại bền vững nhưng **chưa xuất hiện trong feed của ai**.",
          },
          {
            note: "Phát event vào Kafka — fan-out chạy **bất đồng bộ**.",
            msgs: [["post", "kafka", "PostCreated #88"], ["kafka", "worker", "#88"]],
            detail: "Post Service phát event `PostCreated #88` vào Kafka, Fan-out Worker consume event. Kafka là buffer bền: worker chậm hoặc chết thì event vẫn nằm trong log, worker mới đọc tiếp từ offset đã commit → không mất bài nào. Cái giá của bất đồng bộ: follower thấy bài trễ vài trăm ms tới vài giây (**eventual consistency**), chấp nhận được với news feed. Lưu ý ghi DB và publish Kafka là hai bước tách rời; muốn chắc không mất event khi crash giữa chừng thì dùng **outbox pattern** hoặc DynamoDB Streams.",
          },
          {
            note: "Worker lấy danh sách follower.",
            msgs: [["worker", "follows", "followers(author)"], ["follows", "worker", "500 users", "ok"]],
            detail: "Worker query Follow DB `followers(author)` và nhận về 500 user id. Bảng follow cần index theo `followee_id` (ai đang follow author này) — chiều ngược với query “tôi follow ai”, nên thường lưu cả hai chiều. Author nhiều follower thì worker đọc theo trang (pagination) thay vì kéo cả danh sách vào RAM một lần.",
          },
          {
            note: "Đẩy post id vào **feed precomputed** của từng follower.",
            msgs: [
              {
                par: [
                  ["worker", "cache", "ZADD feed:u1", "ok"],
                  ["worker", "cache", "ZADD feed:u2", "ok"],
                  ["worker", "cache", "… ×500", "ok"],
                ],
              },
            ],
            set: { cache: "500 feed có post#88" },
            lesson: "Fan-out on write: tốn công lúc ghi, đổi lại đọc feed cực nhanh.",
            detail: "Worker ghi post id 88 vào feed của cả 500 follower: chạy song song `ZADD feed:u1 <ts> 88`, `ZADD feed:u2 <ts> 88`… (score = thời điểm đăng), thường gom bằng Redis pipeline để giảm round-trip. Mỗi sorted set chỉ chứa **post id**, không chứa nội dung → sửa nội dung bài không phải cập nhật 500 chỗ. Sau mỗi ZADD nên kèm `ZREMRANGEBYRANK feed:uX 0 -801` để feed chỉ giữ 800 id mới nhất, tránh Redis phình vô hạn. Cái giá: 1 bài = 500 lần ghi; đổi lại lúc đọc không phải tính gì — số lần đọc feed lớn hơn số lần đăng bài hàng trăm lần, nên dồn công sang lúc ghi là đáng.",
          },
        ],
      },
      {
        name: "Đọc feed",
        steps: [
          {
            note: "Reader mở app.",
            msgs: [["reader", "feed", "GET /feed?limit=20"]],
            detail: "Client gọi `GET /feed?limit=20` khi reader mở app; instance Feed Service nào cũng xử lý được vì service stateless. Request không cần biết reader follow ai — danh sách đó đã được “nướng sẵn” thành sorted set trong Redis ở bước fan-out.",
          },
          {
            note: "Lấy 20 post id từ feed precomputed.",
            msgs: [["feed", "cache", "ZRANGE feed:reader REV"], ["cache", "feed", "[88, 85, 71…]", "ok"]],
            detail: "Feed Service lấy 20 post id mới nhất `[88, 85, 71…]` bằng `ZRANGE feed:reader +inf -inf BYSCORE REV LIMIT 0 20`, dưới 1ms. Id đã sắp sẵn theo thời gian vì score là timestamp, và lệnh chỉ là O(log N + K) trên RAM. Không có feed precomputed thì server phải lấy danh sách hàng trăm người reader follow, query bài mới của từng người rồi merge-sort — chậm và tốn DB đúng trên đường nóng nhất hệ thống.",
          },
          {
            note: "Batch-get nội dung bài, trả kèm **cursor** cho trang sau.",
            msgs: [
              ["feed", "posts", "BatchGet 20"],
              ["posts", "feed", "posts", "ok"],
              ["feed", "reader", "200 + cursor", "ok"],
            ],
            lesson: "Đọc feed = 1 lần đọc list + 1 batch get, thường < 100ms.",
            detail: "Feed Service lấy nội dung 20 bài bằng một `BatchGet` 20 key sang Posts DB (DynamoDB cho tối đa 100 key mỗi lần), thay vì 20 request lẻ. Kết quả kèm **cursor** (score/timestamp của bài cuối) để trang sau đọc tiếp bằng `ZRANGE feed:reader (<ts_cuối> -inf BYSCORE REV LIMIT 0 20` — sorted set tìm được theo giá trị score, còn LIST chỉ đọc theo vị trí nên bài mới chèn vào đầu sẽ làm lệch trang; dùng cursor thay vì offset để không lặp/sót bài khi có bài mới chèn vào đầu feed giữa hai lần cuộn. Tổng cộng 1 lần đọc Redis + 1 batch get, thường dưới 100ms. Bài đã bị xoá thì batch get không trả về, Feed Service lọc bỏ id đó.",
          },
        ],
      },
      {
        name: "Celebrity (hybrid)",
        steps: [
          {
            note: "Celebrity có 100M follower — fan-out on write sẽ tạo **100M lần ghi** cho một bài.",
            set: { author: "Celebrity · 100M follower" },
            msgs: [
              ["author", "post", "POST /posts"],
              ["post", "posts", "PUT post#90"],
              ["post", "kafka", "PostCreated #90"],
              ["kafka", "worker", "#90"],
            ],
            detail: "Celebrity có 100M follower đăng `post#90`, và luồng ghi vẫn y hệt: lưu Posts DB, phát `PostCreated #90` vào Kafka, worker nhận event. Nếu fan-out như user thường, một bài sinh **100M lần ZADD**: dù 1M lệnh/s cũng mất gần 2 phút mới phát hết, chiếm toàn bộ năng lực worker và Redis, kéo trễ feed của mọi user khác (**hot key / thundering write**). Phần lớn trong 100M người đó không mở app trong ngày → phần lớn lần ghi là lãng phí.",
          },
          {
            note: "Worker thấy cờ `celebrity` → **bỏ qua fan-out**.",
            set: { worker: "skip: celebrity" },
            detail: "Worker **bỏ qua fan-out** vì author có cờ `celebrity` (đặt khi follower vượt ngưỡng, ví dụ 1M) — không ghi gì vào Feed Cache, `post#90` chỉ nằm ở Posts DB. Ngưỡng là trade-off: thấp quá thì quá nhiều author phải merge lúc đọc, cao quá thì vẫn có những đợt fan-out khổng lồ.",
          },
          {
            note: "Lúc đọc: lấy feed precomputed **và** bài mới của các celebrity reader follow, rồi merge.",
            msgs: [
              ["reader", "feed", "GET /feed"],
              { par: [["feed", "cache", "ZRANGE feed"], ["feed", "posts", "posts của celeb"]] },
              { par: [["cache", "feed", "ids", "ok"], ["posts", "feed", "post#90", "ok"]] },
              ["feed", "reader", "merged feed", "ok"],
            ],
            lesson: "Hybrid: user thường fan-out on write, celebrity fan-out on read.",
            detail: "Feed Service merge hai nguồn theo timestamp khi reader gọi `GET /feed`. Nó chạy **song song**: `ZRANGE feed … REV` lấy phần precomputed, và query Posts DB lấy bài mới của các celebrity mà reader follow (cần index theo authorId + thời gian); hai kết quả (`ids` và `post#90`) về cùng lúc rồi ghép thành feed hoàn chỉnh. Chi phí dời sang lúc đọc, nhưng chỉ cho số ít celebrity mỗi user follow (thường vài chục), và bài celebrity được đọc cực nhiều nên cache rất hiệu quả. Đây là **hybrid**: user thường fan-out on write, celebrity fan-out on read.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Fan-out on write hay on read?",
      bad: "JOIN follow + posts mỗi lần mở feed.",
      good: "Precompute feed (fan-out on write) bằng worker bất đồng bộ.",
      great: "Hybrid: fan-out on write cho user thường, on read cho celebrity; feed cache chỉ giữ ~vài trăm id gần nhất.",
      why: {
        bad: "Không thể dưới 500ms ở quy mô 2B user: mỗi lần mở feed phải JOIN follow (có thể hàng nghìn người) với posts rồi sort — query nặng chạy lặp lại hàng tỷ lần mỗi ngày.",
        good: "Precompute biến đọc feed thành một lần đọc list, nhanh và rẻ. Nhưng một bài của celebrity 100M follower tạo 100M lần ghi, worker tồn đọng hàng giờ và bài tới muộn hơn mức 1 phút.",
        great: "Bỏ celebrity khỏi fan-out on write và merge bài của họ lúc đọc giữ cả ghi lẫn đọc ở mức rẻ, vì celebrity chỉ chiếm số ít tài khoản nhưng gây phần lớn chi phí fan-out. Cache chỉ giữ vài trăm id gần nhất vì ít ai cuộn xa hơn → tiết kiệm RAM cho 2B user.",
      },
    },
    {
      q: "Một bài viral bị đọc hàng triệu lần?",
      bad: "Đọc thẳng Posts DB.",
      good: "Cache post trong Redis.",
      great: "Cache post + nhân bản key nóng ra nhiều node (post:88#1..N) để chia tải đọc.",
      why: {
        bad: "Partition chứa bài đó bị dồn hàng triệu read/s, vượt giới hạn throughput của một partition (DynamoDB ~3,000 RCU/partition), vì mọi lượt xem đều chạm cùng một row.",
        good: "Cache Redis hấp thụ phần lớn lượt đọc. Nhưng key `post:88` vẫn nằm trên một node Redis duy nhất — node đó nghẽn CPU/băng thông khi bài viral (hot key).",
        great: "Tải đọc chia đều cho N node: nhân bản key thành `post:88#1..N` rải trên N node, client chọn ngẫu nhiên một bản. Bài đã đăng ít khi sửa nên N bản dễ giữ nhất quán.",
      },
    },
    {
      q: "Phân trang feed?",
      bad: "OFFSET/LIMIT.",
      good: "Cursor theo timestamp.",
      great: "Cursor theo (timestamp, postId) ổn định cả khi nhiều bài trùng timestamp (postId làm tie-breaker).",
      why: {
        bad: "`OFFSET n` buộc DB đọc rồi bỏ n row đầu → trang càng sâu càng chậm. Bài mới chèn lên đầu còn đẩy mọi bài xuống, nên trang sau lặp lại bài đã xem.",
        good: "Cursor theo timestamp (`WHERE ts < cursor`) dùng index nên mọi trang nhanh như nhau, và bài mới ở đầu không làm lệch trang sau. Nhưng nhiều bài cùng timestamp thì cursor không phân biệt được → trùng hoặc sót bài ở ranh giới trang.",
        great: "Cursor chỉ đúng một vị trí, không trùng không sót kể cả khi nhiều bài cùng timestamp, vì cặp `(timestamp, postId)` duy nhất và có thứ tự toàn phần. So sánh tuple `(ts, id) < (cursor_ts, cursor_id)` vẫn dùng được composite index.",
      },
    },
  ],
  sims: ["queue"],
});
