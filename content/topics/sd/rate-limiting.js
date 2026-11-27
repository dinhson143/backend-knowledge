BK.topic({
  id: "rate-limiting",
  track: "sd",
  section: "sd-core",
  title: "Rate Limiting",
  goal: "Chọn thuật toán, chỗ đặt rate limiter và trả 429 kèm Retry-After đúng cách",
  needs: ["api-design", "lb-gateway-cdn"],
  tldr: {
    t: "**Rate limiting** (giới hạn số request mỗi khoảng thời gian) đếm request theo một **key** (user, API key, IP, endpoint) và từ chối phần vượt bằng **`429 Too Many Requests`** kèm `Retry-After`. Bốn thuật toán chính: **fixed window** (đơn giản, cho lọt gấp đôi ở ranh giới cửa sổ), **sliding window log** (chính xác, tốn bộ nhớ theo số request), **sliding window counter** (xấp xỉ tốt với hai số đếm), **token bucket / leaky bucket** (cho burst có giới hạn / giữ nhịp đều).",
    why: "Thiếu rate limit thì một client lỗi vòng lặp, một bot cào dữ liệu hay một đợt retry storm chiếm hết CPU, connection DB của mọi người khác. RFC 6585 định nghĩa 429 cho đúng tình huống \"the user has sent too many requests in a given amount of time\" nhưng cố ý không quy định cách đếm (https://www.rfc-editor.org/rfc/rfc6585#section-4), nên chọn thuật toán và key là việc của người thiết kế.",
  },
  story: {
    problem: "API tìm kiếm của bạn chịu được 2.000 request/giây. Một khách hàng viết script lỗi gọi 5.000 request/giây; search chậm cho mọi người, DB đầy connection, và các client khác timeout rồi retry, càng làm tải tăng. Chặn theo IP thì cả văn phòng dùng chung một IP bị chặn oan; không chặn thì một client làm sập cả hệ.",
    idea: "Đặt một hạn mức cho mỗi key (\"100 request/phút cho mỗi API key, burst tối đa 20\"), đếm ở cửa vào trước khi request chạm backend, và trả lời phần vượt bằng 429 kèm thời gian nên chờ. Client tử tế đọc `Retry-After` và giãn nhịp; client không tử tế cũng không chiếm được tài nguyên của người khác.",
    tradeoff: "Đếm chính xác tuyệt đối trên nhiều instance cần trạng thái dùng chung (thường là Redis), thêm một round-trip vào mọi request và thêm một phụ thuộc có thể lỗi. Đếm cục bộ từng instance thì nhanh nhưng hạn mức thực tế nhân theo số instance. Thuật toán chính xác (log) tốn bộ nhớ; thuật toán rẻ (fixed window) cho lọt burst.",
  },
  table: {
    head: ["Thuật toán", "Trạng thái mỗi key", "Burst", "Dùng khi"],
    rows: [
      {
        cells: ["Fixed window counter", "1 số đếm theo cửa sổ (`INCR` + `EXPIRE`)", "Lọt tới **2× hạn mức** quanh ranh giới cửa sổ", "Hạn mức thô, login throttling, cần rẻ nhất"],
        why: "Số đếm reset cứng ở đầu mỗi cửa sổ, nên client gửi đủ hạn mức ở cuối cửa sổ này và đủ hạn mức ở đầu cửa sổ sau: hướng dẫn của Redis lấy ví dụ 10 request ở giây thứ 9 và 10 request ở giây thứ 11, tức 20 request trong 2 giây với hạn mức \"10 mỗi 10 giây\" (https://redis.io/tutorials/howtos/ratelimiting/).",
      },
      {
        cells: ["Sliding window log", "Timestamp của **mọi** request trong cửa sổ (sorted set)", "Không có burst ở ranh giới", "Cần đếm chính xác, lưu lượng mỗi key thấp"],
        why: "Mỗi lần kiểm tra xoá timestamp cũ hơn cửa sổ (`ZREMRANGEBYSCORE`) rồi đếm phần còn lại (`ZCARD`), nên luôn đếm đúng trong mọi khoảng dài bằng cửa sổ. Đổi lại bộ nhớ là O(n): hạn mức 10.000 request/giờ thì mỗi key giữ tới 10.000 phần tử (https://redis.io/tutorials/howtos/ratelimiting/).",
      },
      {
        cells: ["Sliding window counter", "2 số đếm: cửa sổ trước và cửa sổ hiện tại", "Làm mượt ranh giới; sai số nhỏ", "Mặc định tốt cho API: rẻ mà gần chính xác"],
        why: "Ước lượng = số đếm cửa sổ trước × phần cửa sổ trước còn nằm trong cửa sổ trượt + số đếm cửa sổ hiện tại. Cloudflare dùng cách này: hạn mức 50/phút, đã 15 giây vào phút hiện tại với 18 request, phút trước có 42 thì ước lượng 42 × 0.75 + 18 = 49.5; trên 400 triệu request, chỉ 0.003% bị cho qua hoặc chặn sai (https://blog.cloudflare.com/counting-things-a-lot-of-different-things/).",
      },
      {
        cells: ["Token bucket", "2 số: `tokens`, `last_refill`", "Cho burst tới **dung lượng bucket**, trung bình theo tốc độ nạp", "API muốn chịu burst ngắn (app mở lên gọi dồn) nhưng giữ trung bình"],
        why: "Token được nạp đều theo thời gian tới tối đa bằng dung lượng; mỗi request lấy một token, hết token thì bị từ chối. Bucket đầy cho phép gửi liền một loạt bằng dung lượng, sau đó tốc độ bị khoá ở mức nạp. Envoy dùng token bucket cho local rate limit (`max_tokens`, `tokens_per_fill`, `fill_interval`) và mặc định trả 429 (https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/local_rate_limit_filter).",
      },
      {
        cells: ["Leaky bucket", "Mức nước hiện tại, hoặc thời điểm slot trống kế tiếp", "Không burst: ra đều theo tốc độ rò", "Bảo vệ phụ thuộc không chịu được burst; làm mượt tải ra"],
        why: "Request đổ vào bucket, bucket rò ra với tốc độ cố định. Hai kiểu: **policing** từ chối ngay khi bucket đầy, **shaping** giữ request lại cho tới lượt (tăng latency). `limit_req` của NGINX dùng \"leaky bucket\": request vượt tốc độ bị **trì hoãn** cho tới khi số request dư vượt `burst` thì bị từ chối (https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).",
      },
    ],
  },
  points: [
    {
      t: "**Chọn key là quyết định nghiệp vụ.** Theo user hoặc API key cho người đã xác thực, theo IP cho request ẩn danh, theo endpoint cho API đắt (search, login, gửi OTP). Hạn mức thường là nhiều tầng: theo key, theo endpoint, và một trần chung bảo vệ toàn hệ.",
      why: "Mỗi key chặn một kiểu lạm dụng khác nhau. Chỉ dùng IP thì nhiều người sau cùng một NAT bị chặn oan và kẻ tấn công đổi IP là thoát; chỉ dùng user thì request chưa đăng nhập (trang login) không được bảo vệ. RFC 6585 nói rõ server có thể đếm theo tài nguyên, theo cả server hay theo nhóm server, và nhận diện user bằng credential hoặc cookie (https://www.rfc-editor.org/rfc/rfc6585#section-4).",
    },
    {
      t: "**Đếm theo chi phí, không chỉ theo số request**, khi các request nặng nhẹ khác nhau: một export CSV tính 50 đơn vị, một `GET` tính 1.",
      why: "Hạn mức theo số request để một client gọi 100 export nặng vẫn \"trong hạn\" mà làm DB quá tải. Bản nháp IETF RateLimit cho phép khai báo đơn vị quota (`qu`) và chi phí của request (`c`) đúng vì lý do này (https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/).",
    },
    {
      t: "**Trả `429` kèm `Retry-After`.** `Retry-After` là số giây (`Retry-After: 6`) hoặc một mốc HTTP-date. Response 429 **không được** cache.",
      why: "RFC 6585 cho phép 429 kèm `Retry-After` để báo nên chờ bao lâu và ghi \"Responses with the 429 status code MUST NOT be stored by a cache\" (https://www.rfc-editor.org/rfc/rfc6585#section-4). RFC 9110 định nghĩa giá trị là HTTP-date hoặc delay-seconds (https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3). Thiếu `Retry-After` thì client chỉ biết đoán, và đoán sai là retry dồn ngay lập tức.",
    },
    {
      t: "**NGINX `limit_req` mặc định trả `503`, không phải `429`.** Muốn đúng ngữ nghĩa thì đặt `limit_req_status 429;`.",
      why: "Tài liệu module ghi \"Default: limit_req_status 503\" (https://nginx.org/en/docs/http/ngx_http_limit_req_module.html). 503 nghĩa là server đang quá tải, nên client và load balancer coi như lỗi phía server và có thể retry sang chỗ khác hoặc báo động nhầm; 429 nói rõ \"bạn gửi quá nhiều\".",
    },
    {
      t: "**Header báo hạn mức còn lại chưa có chuẩn chính thức.** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` là quy ước phổ biến. IETF đang soạn hai field `RateLimit-Policy` và `RateLimit` (bản nháp -12, tháng 11/2026, chưa thành RFC).",
      why: "Hướng dẫn của Redis ghi rõ các header `X-RateLimit-*` \"are only common patterns. There is no single standard\" (https://redis.io/tutorials/howtos/ratelimiting/). Bản nháp IETF dùng dạng `RateLimit-Policy: burst;q=100;w=60` và `RateLimit: \"default\";a=50;w=30` (https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/); bản nháp còn có thể đổi trước khi thành RFC, nên nói trong phỏng vấn là \"đang được chuẩn hoá\", đừng khẳng định một định dạng.",
    },
    {
      t: "**Đặt limiter ở đâu**: ở edge/API Gateway để chặn trước khi request chạm backend; thêm limiter trong service cho hạn mức gắn với nghiệp vụ (số đơn mỗi ngày của một shop). Gateway có nhiều instance thì trạng thái phải **dùng chung** (Redis), hoặc chấp nhận đếm cục bộ.",
      why: "Chặn càng sớm thì request bị từ chối càng rẻ. Nhưng N gateway mỗi cái tự đếm cục bộ sẽ cho client tới N lần hạn mức; trạng thái dùng chung thì đúng nhưng thêm một round-trip mỗi request. Cách thiết kế limiter phân tán (Lua script atomic, shard Redis, fail-open) là nội dung của bài Distributed Rate Limiter; topic này chỉ giữ phần khái niệm.",
    },
    {
      t: "**Kết hợp limiter cục bộ và toàn cục.** Envoy cho phép đặt local rate limit (token bucket trong từng proxy) phía trước global rate limit (một service gRPC dùng chung, bản tham chiếu dùng Redis).",
      why: "Local bucket hấp thụ đợt burst lớn ngay tại proxy, nên service toàn cục chỉ nhận phần còn lại: Envoy viết local rate limiting \"can be used in conjunction with global rate limiting to reduce load on the global rate limit service\" (https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting). Mặc định local limit của Envoy áp **theo từng process Envoy**, nên hạn mức thật nhân theo số proxy.",
    },
    {
      t: "**Phía client cũng phải tôn trọng hạn mức**: đọc `Retry-After`, retry có giới hạn với backoff và jitter, và tự giãn nhịp khi chạy batch lớn thay vì gửi hết rồi retry phần bị chặn.",
      why: "Azure gọi việc client tự giới hạn tốc độ gửi là Rate Limiting pattern: gửi 10.000 bản ghi vào dịch vụ chỉ nhận 2.000 mỗi lần theo kiểu \"gửi hết, retry phần lỗi\" thì phải gửi tổng cộng 30.000 bản ghi; và retry mù quáng \"can increase load and create retry storms\" (https://learn.microsoft.com/en-us/azure/architecture/patterns/rate-limiting-pattern). Cơ chế retry an toàn ở bài `resilience`.",
    },
  ],
  sections: [
    {
      title: "Token bucket và sliding window counter (Python, một process)",
      code: {
        lang: "python",
        lines: [
          "class TokenBucket:",
          "    def __init__(self, capacity, rate):",
          ["        self.capacity, self.rate = capacity, rate", "`capacity` = burst tối đa; `rate` = token nạp mỗi giây = tốc độ trung bình."],
          "        self.tokens, self.last = capacity, 0.0",
          "",
          "    def allow(self, now):",
          ["        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)", "Nạp \"lười\": không cần timer, chỉ tính token theo thời gian đã trôi khi có request."],
          "        self.last = now",
          "        if self.tokens >= 1:",
          "            self.tokens -= 1",
          "            return True, 0.0",
          ["        return False, (1 - self.tokens) / self.rate", "Số giây tới khi đủ 1 token: chính là giá trị cho `Retry-After` (làm tròn lên)."],
          "",
          "class SlidingWindowCounter:",
          "    def __init__(self, limit, window):",
          "        self.limit, self.window = limit, window",
          "        self.counts = {}",
          "",
          "    def allow(self, now):",
          "        cur = int(now // self.window)",
          "        elapsed = (now % self.window) / self.window",
          ["        est = self.counts.get(cur - 1, 0) * (1 - elapsed) + self.counts.get(cur, 0)", "Cửa sổ trước được tính theo phần còn nằm trong cửa sổ trượt."],
          "        if est >= self.limit:",
          ["            return False", "Bị chặn thì không tăng số đếm, để request bị từ chối không làm hạn mức tệ thêm."],
          "        self.counts[cur] = self.counts.get(cur, 0) + 1",
          "        return True",
          "",
          "tb = TokenBucket(capacity=10, rate=1)",
          "burst = [tb.allow(0.0)[0] for _ in range(12)]",
          ["print(burst.count(True))", "10: bucket đầy cho qua đúng 10 request liền, 2 request sau bị chặn."],
          ["print(tb.allow(0.5))", "(False, 0.5): mới nạp được nửa token, còn chờ 0.5 giây."],
          "print(tb.allow(1.0))",
          "",
          "sw = SlidingWindowCounter(limit=50, window=60)",
          ["sw.counts = {0: 42, 1: 18}", "Ví dụ của Cloudflare: phút trước 42, phút này 18."],
          ["print(sw.allow(75.0))", "15 giây vào phút thứ hai: 42 × 0.75 + 18 = 49.5 < 50 → True."],
          ["print(sw.allow(75.0))", "42 × 0.75 + 19 = 50.5 → False."],
        ],
      },
    },
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Đếm cục bộ ở mỗi instance rồi tưởng hạn mức là toàn cục.",
          why: "Client được round-robin qua 20 instance thì nhận tới 20 lần hạn mức. Hoặc dùng trạng thái chung, hoặc chia hạn mức cho số instance và chấp nhận sai số khi tải lệch.",
        },
        {
          t: "Đọc rồi ghi số đếm bằng hai lệnh riêng trên Redis (`GET` rồi `SET`).",
          why: "Hai gateway cùng đọc thấy còn 1, cùng cho qua: đây là check-then-act. Redis hướng dẫn gói đọc–quyết định–ghi vào một Lua script vì Redis chạy script nguyên tử (https://redis.io/tutorials/howtos/ratelimiting/); chi tiết ở bài Distributed Rate Limiter.",
        },
        {
          t: "Chỉ giới hạn theo IP cho API đã đăng nhập.",
          why: "Người dùng sau cùng một NAT công ty hay nhà mạng di động chia nhau một IP, nên chặn một người là chặn cả nhóm; còn kẻ có nhiều IP thì vượt được. Request đã xác thực nên đếm theo user hoặc API key.",
        },
        {
          t: "Trả 429 mà không có `Retry-After`, hoặc `Retry-After` cố định không liên quan tới thuật toán.",
          why: "Client không biết chờ bao lâu nên retry ngay, làm tải tăng đúng lúc đang bị chặn. Token bucket tính được chính xác thời gian tới token kế tiếp, fixed window tính được thời gian tới đầu cửa sổ sau.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi được hỏi \"chọn thuật toán nào\", so sánh theo ba trục: bộ nhớ mỗi key, độ chính xác ở ranh giới, và có cho burst hay không. Rồi chọn theo yêu cầu: API công khai thường token bucket hoặc sliding window counter.",
      why: "Ba trục này phân biệt được cả năm thuật toán trong một câu. Interviewer muốn nghe vì sao, không phải tên thuật toán; ví dụ fixed window cho lọt 2× ở ranh giới là câu bắt bẻ hay gặp.",
    },
    {
      t: "Luôn nói phần response: 429, `Retry-After`, và header báo hạn mức còn lại.",
      why: "Phần này cho thấy bạn nghĩ tới client: hạn mức chỉ có ích khi client biết mình đang ở đâu và nên chờ bao lâu.",
    },
    "Khi đề bài là \"thiết kế rate limiter phân tán\", chuyển sang khung của bài Distributed Rate Limiter: state ở đâu, cập nhật atomic thế nào, Redis lỗi thì fail-open hay fail-closed.",
  ],
  cards: [
    [
      "Fixed window cho lọt bao nhiêu request trong trường hợp xấu nhất?",
      "Gần 2× hạn mức trong một khoảng dài bằng cửa sổ: đủ hạn mức ở cuối cửa sổ này và đủ hạn mức ở đầu cửa sổ sau.",
    ],
    [
      "Token bucket khác sliding window log ở đâu?",
      "Token bucket giữ 2 số mỗi key và cho burst tới dung lượng bucket, trung bình theo tốc độ nạp. Sliding window log giữ timestamp mọi request trong cửa sổ, đếm chính xác, không burst, nhưng bộ nhớ O(n).",
    ],
    [
      "Token bucket khác leaky bucket ở đâu?",
      "Token bucket cho phép burst (tiêu token đã tích). Leaky bucket ra đều theo tốc độ rò: policing từ chối phần vượt, shaping giữ request lại chờ tới lượt.",
    ],
    [
      "Limit theo user trên 20 instance gateway thì đếm ở đâu?",
      "Ở kho dùng chung (thường Redis, cập nhật bằng Lua script atomic), hoặc local bucket ở mỗi gateway phía trước một limiter toàn cục để giảm tải. Đếm hoàn toàn cục bộ thì user được 20 lần hạn mức.",
    ],
    [
      "Client nhận 429 thì nên làm gì?",
      "Đọc `Retry-After` và chờ ít nhất chừng đó; nếu không có thì backoff có jitter; giới hạn số lần retry; với batch lớn thì tự giãn nhịp gửi.",
    ],
    [
      "Vì sao không nên để NGINX trả 503 khi chặn rate limit?",
      "503 nói server quá tải, nên client và LB coi là lỗi server và có thể retry chỗ khác hoặc báo động nhầm. Đặt `limit_req_status 429` để nói rõ client gửi quá nhiều.",
    ],
  ],
  related: ["retry-storm"],
});
