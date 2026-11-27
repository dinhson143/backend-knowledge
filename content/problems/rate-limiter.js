BK.problem({
  id: "rate-limiter",
  level: 1,
  title: "Distributed Rate Limiter",
  hi: "distributed-rate-limiter",
  summary: "Giới hạn request cho hàng triệu client qua nhiều gateway, thêm độ trễ < 10ms.",
  topics: ["redis", "api-design", "dist-cache", "lb-gateway-cdn"],
  fr: [
    "Giới hạn theo user / IP / API key với rule cấu hình được",
    "Trả 429 kèm header Retry-After, X-RateLimit-Remaining",
  ],
  nfr: [
    {
      t: "Thêm latency < 10ms",
      why: "Latency của limiter cộng thẳng vào mọi API, vì nó nằm trên đường đi của mọi request. Hệ quả: chỉ một round-trip Redis mỗi request (Lua script), rule cache local.",
    },
    {
      t: "1M request/s",
      why: "State phải shard, vì 1M req/s vượt khả năng một Redis node (~100k–200k ops/s tuỳ lệnh). Hệ quả: Redis Cluster shard theo `clientId`.",
    },
    {
      t: "Availability: limiter lỗi không được làm sập API",
      why: "Limiter là thành phần phụ trợ — để nó làm sập API là biến lớp bảo vệ thành nguyên nhân sự cố. Hệ quả: fail-open khi Redis lỗi, kèm giám sát và giới hạn local dự phòng.",
    },
    {
      t: "Chính xác “đủ dùng” (sai lệch nhỏ chấp nhận được)",
      why: "Cho lọt vài request thừa hiếm khi gây hại, còn đếm chính xác tuyệt đối đòi đồng bộ toàn cục rất đắt. Chấp nhận sai lệch nhỏ thì dùng được token bucket/sliding counter thay vì log đầy đủ, và local pre-check.",
    },
  ],
  capacity: "1M req/s, mỗi lần kiểm tra 1 round-trip Redis → cần Redis cluster shard theo clientId.",
  entities: ["Rule", "Client identity", "Bucket / counter"],
  api: ["isAllowed(clientId, ruleId) → { allowed, remaining, resetAt }"],
  hldWhy: "Limiter nằm trong **API Gateway** dưới dạng middleware, không thêm hop mạng riêng, vì nó phải chặn trước khi request tới backend. State (bucket) đặt ở **Redis Cluster** vì nhiều gateway instance cùng phục vụ một client — đếm local ở mỗi gateway sẽ cho client N lần quota. Chọn Redis thay vì DB: mỗi request cần một lần đọc-ghi dưới vài ms ở 1M req/s, chỉ kho in-memory làm được. **Rules config** tách riêng và cache trong gateway vì rule ít đổi — đọc rule mỗi request là phí một round-trip.",
  hld: {
    id: "hld-rate-limiter",
    title: "HLD — Distributed Rate Limiter",
    h: 330,
    scenario: "Limiter chạy trong API Gateway; trạng thái bucket dùng chung nằm ở Redis, cập nhật bằng Lua script atomic.",
    context: "Rate limiter là middleware chạy trong **API Gateway** — chặn ở edge để request vượt hạn mức không bao giờ chạm **Backend**. Có nhiều gateway instance, nên trạng thái bucket không để trong RAM từng instance mà dùng chung ở **Redis Cluster**, cập nhật bằng **Lua script** để đọc-tính-ghi diễn ra atomic. **Rules config** định nghĩa hạn mức theo tier (free: 10 req/phút), gateway cache local. Theo dõi dòng chữ dưới Redis: `bucket:u42 = còn/tối đa` token.",
    nodes: [
      { id: "client", x: 80, y: 160, label: "Client" },
      { id: "gw", x: 300, y: 160, label: "API Gateway", w: 150, s: "rate limiter middleware" },
      { id: "redis", x: 540, y: 60, label: "Redis Cluster", s: "bucket:u42 = 5/10" },
      { id: "rules", x: 540, y: 270, label: "Rules config", s: "free: 10 req/phút" },
      { id: "svc", x: 720, y: 160, label: "Backend" },
    ],
    links: [["client", "gw"], ["gw", "redis"], ["gw", "rules"], ["gw", "svc"]],
    variants: [
      {
        name: "Request hợp lệ",
        steps: [
          {
            note: "Gateway xác định **identity** (user id từ JWT hoặc IP) và rule áp dụng (cache local).",
            msgs: [["client", "gw", "GET /api/orders"]],
            set: { gw: "user42 · rule free" },
            detail: "Gateway xác định hạn mức của request `GET /api/orders`: tier `free` = 10 req/phút. Gateway xác thực JWT, lấy `user42` làm **identity** (request chưa đăng nhập thì dùng IP), rồi tra rule trong bản cache local của Rules config. Rule cache trong RAM gateway và làm mới định kỳ → tra rule không tốn thêm network call nào trên mỗi request.",
          },
          {
            note: "Chạy **Lua script** trên Redis: refill theo thời gian rồi lấy 1 token — atomic, không race giữa các gateway.",
            msgs: [["gw", "redis", "EVAL token_bucket u42"], ["redis", "gw", "allowed · còn 4", "ok"]],
            set: { redis: "bucket:u42 = 4/10" },
            detail: "Lua script trên Redis cho phép request và bucket giảm từ 5 xuống **4/10**. Gateway gửi `EVAL token_bucket u42`; script đọc `tokens` và `last_refill`, cộng token theo thời gian đã trôi (10 token/phút = 1 token mỗi 6s, tối đa 10), còn ≥1 token thì trừ 1 và trả `allowed`. Phải dùng Lua vì Redis chạy script single-thread, không lệnh nào chen vào giữa; nếu gateway tự `GET` rồi `SET`, hai gateway có thể cùng đọc `5`, cùng ghi `4` → user dùng 2 request chỉ mất 1 token (**race condition**). Trên Redis Cluster, mọi key của một bucket phải nằm cùng slot (dùng hash tag như `{u42}`).",
          },
          {
            note: "Cho qua backend; trả header để client tự điều tiết.",
            msgs: [
              ["gw", "svc", "forward"],
              ["svc", "gw", "200", "ok"],
              ["gw", "client", "200 · Remaining: 4", "ok"],
            ],
            detail: "Gateway forward request sang Backend, nhận `200` và trả client kèm header `X-RateLimit-Remaining: 4` (thường có thêm `Limit` và `Reset`). Header giúp client chủ động giãn nhịp gọi trước khi bị chặn. Toàn bộ phần rate limit chỉ tốn thêm một round-trip Redis, thường dưới 1ms trong cùng data center.",
          },
        ],
      },
      {
        name: "Bị chặn",
        steps: [
          {
            note: "Client spam, bucket cạn.",
            set: { redis: "bucket:u42 = 0/10" },
            msgs: [
              ["client", "gw", "GET ×20/s"],
              ["gw", "redis", "EVAL token_bucket"],
              ["redis", "gw", "denied", "err"],
            ],
            detail: "Bucket cạn về **0/10** vì client spam 20 request/giây trong khi hạn mức là 10/phút. Mỗi request tiếp theo vẫn chạy Lua script, nhưng script refill được 0 token (chưa đủ 6s) nên trả `denied`. Token bucket cho burst tới 10 request liên tiếp, còn tốc độ trung bình bị khoá ở mức refill.",
          },
          {
            note: "Trả **429** ngay tại gateway, backend không nhận request nào.",
            msgs: [["gw", "client", "429 · Retry-After: 6", "err"]],
            good: ["svc"],
            lesson: "Chặn ở edge để bảo vệ backend; Retry-After giúp client back off đúng cách.",
            detail: "Gateway trả **429 Too Many Requests** kèm `Retry-After: 6` — đúng thời gian refill 1 token — ngay tại edge. Backend được đánh dấu xanh: nó **không nhận request nào** trong đợt spam → client lỗi hay bị tấn công cũng không chiếm được tài nguyên DB/CPU của người khác. Client tử tế đọc `Retry-After` để chờ đúng lúc, không retry dồn dập làm tình hình tệ hơn.",
          },
        ],
      },
      {
        name: "Redis sập",
        steps: [
          {
            note: "Redis không phản hồi trong 5ms.",
            msgs: [["client", "gw", "GET /api"], ["gw", "redis", "EVAL", "err"], ["redis", "gw", "timeout", "err"]],
            bad: ["redis"],
            detail: "Gateway timeout vì Redis không trả lời `EVAL` trong 5ms (node chết, failover, mạng nghẽn). Timeout phải ngắn vì limiter nằm trên đường đi của **mọi** request: chờ mặc định vài giây thì cả API chậm theo Redis. Giờ gateway phải quyết định cho qua hay chặn khi không biết bucket còn bao nhiêu token.",
          },
          {
            note: "**Fail-open**: cho request qua thay vì làm sập toàn bộ API.",
            msgs: [["gw", "svc", "forward (fail-open)", "warn"], ["svc", "client", "200", "ok"]],
            lesson: "Fail-open ưu tiên availability; fail-closed cho API nhạy cảm (login, OTP). Redis replica để giảm rủi ro.",
            detail: "Gateway chọn **fail-open**: forward request sang Backend như không có limiter, Backend trả `200`. Lý do: rate limiter là lớp bảo vệ, không phải chức năng chính; để nó làm sập cả API vì Redis lỗi còn tệ hơn tạm không giới hạn vài giây failover. Rủi ro là kẻ spam lọt qua trong khoảng đó, nên nhiều hệ thống có lớp dự phòng như limiter local thô theo từng instance. API nhạy cảm (login, gửi OTP) nên **fail-closed** vì để brute-force lọt qua nguy hiểm hơn tạm từ chối user. Redis có replica + failover tự động để khoảng mù này ngắn nhất.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Chọn thuật toán nào?",
      bad: "Fixed window — burst gấp đôi ở ranh giới cửa sổ.",
      good: "Sliding window log (chính xác nhưng tốn RAM) hoặc sliding window counter.",
      great: "Token bucket: cho burst có kiểm soát, chỉ 2 số mỗi client (tokens, lastRefill); leaky bucket khi cần đầu ra đều.",
      why: {
        bad: "Client gửi được gấp đôi giới hạn trong khoảng 2 giây: đủ quota ở giây cuối cửa sổ này và đủ quota ở giây đầu cửa sổ sau, vì counter reset cứng ở ranh giới cửa sổ.",
        good: "Sliding window log tính đúng trong mọi khoảng thời gian nên hết burst ở ranh giới. Nhưng log lưu timestamp mỗi request — quota 1,000 req/phút là 1,000 entry mỗi client, nhân hàng triệu client thì tốn RAM lớn; sliding counter tiết kiệm hơn nhưng chỉ xấp xỉ.",
        great: "RAM O(1) mỗi client, vì token bucket chỉ lưu `tokens` và `lastRefill`, refill tính lười theo thời gian trôi qua khi có request. Dung lượng bucket cho phép burst có giới hạn rõ, tốc độ refill giữ trung bình đúng quota.",
      },
    },
    {
      q: "Nhiều gateway cùng cập nhật một bucket?",
      bad: "GET rồi SET từ gateway (race condition).",
      good: "INCR + EXPIRE cho fixed window.",
      great: "Lua script trong Redis: đọc–tính–ghi atomic trong một round-trip.",
      why: {
        bad: "Cả hai request đều lọt (lost update): GET và SET là hai lệnh riêng, hai gateway cùng GET thấy còn 1 token, cùng trừ rồi cùng SET.",
        good: "`INCR` atomic nên fixed window không mất cập nhật. Nhưng chỉ dùng được cho thuật toán chỉ cần cộng, không áp dụng cho token bucket (cần đọc-tính-ghi); crash giữa `INCR` và `EXPIRE` thì key không bao giờ hết hạn.",
        great: "Đọc bucket, tính refill, trừ token và ghi lại thành một thao tác atomic, vì Redis chạy Lua script single-thread — không lệnh nào chen vào giữa. Toàn bộ chỉ tốn một round-trip, giữ được ngân sách latency < 10ms.",
      },
    },
    {
      q: "Scale 1M req/s và khi Redis lỗi?",
      bad: "Một Redis node.",
      good: "Redis cluster shard theo clientId.",
      great: "Cluster + replica, rule cache local trong gateway, fail-open có giám sát; cân nhắc local pre-check để giảm round-trip.",
      why: {
        bad: "1M req/s vượt năng lực một Redis node (khoảng 100k–200k ops/s); node chết thì limiter chết theo.",
        good: "Shard theo `clientId` chia tải đều ra nhiều node, và mọi request của một client vào cùng shard nên đếm đúng. Nhưng chưa trả lời được khi một shard chết: request của các client trên shard đó bị chặn hoặc lỗi.",
        great: "Shard hồi phục trong vài giây, vì replica tự promote khi master chết. Fail-open cho request đi qua khi Redis lỗi để limiter không làm sập API, kèm alert để biết đang mất bảo vệ; local pre-check chặn client vượt quá rõ ràng ngay tại gateway, bớt round-trip.",
      },
    },
  ],
  sims: ["token-bucket"],
});
