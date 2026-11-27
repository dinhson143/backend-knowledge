BK.sim({
  id: "stampede",
  title: "Cache stampede và single flight",
  topics: ["caching"],
  scenario: "Key `feed:hot` đang phục vụ 50k req/s thì hết TTL. DB sẽ ra sao?",
  context: "**Cache stampede** (thundering herd) xảy ra khi một hot key hết hạn và hàng loạt request cùng miss, cùng đi rebuild từ DB một lúc. Key `feed:hot` là **hot key**: gần như mọi request đều đọc nó, nên cache gánh hết tải và DB chỉ ở CPU 20%. Theo dõi dòng chữ dưới Database (CPU 20% → 100% hoặc 22%) và dưới App Servers (số request đang chờ). Variant thứ hai cho thấy **single flight** (request coalescing) gom các miss thành một query.",
  nodes: [
    { id: "clients", x: 90, y: 150, label: "1,000 clients" },
    { id: "app", x: 320, y: 150, label: "App Servers" },
    { id: "cache", x: 590, y: 65, label: "Cache", s: "feed:hot ✓" },
    { id: "db", x: 590, y: 225, label: "Database", s: "CPU 20%" },
  ],
  variants: [
    {
      name: "Không bảo vệ",
      steps: [
        {
          note: "Bình thường: mọi request đọc từ cache.",
          msgs: [["clients", "app", "GET /feed"], ["app", "cache", "GET feed:hot"], ["cache", "app", "HIT", "ok"]],
          detail: "Mọi request `GET /feed` đều **HIT**: app `GET feed:hot` và cache trả toàn bộ 50k req/s trong vài trăm micro-giây, nên DB gần như rảnh (CPU 20%). DB **không được dimension** để chịu tải đọc thật — nó dựa hoàn toàn vào cache.",
        },
        {
          note: "TTL hết hạn đúng giờ cao điểm.",
          set: { cache: "feed:hot ✗ expired" },
          bad: ["cache"],
          detail: "TTL của `feed:hot` hết đúng lúc cao điểm, Redis xoá key (`feed:hot ✗ expired`). Bước này không có lỗi: hết hạn là hành vi đúng thiết kế. Nguy hiểm ở chỗ key biến mất **tức thì** trong khi lưu lượng đọc vẫn 50k req/s, và chưa ai kịp nạp lại.",
        },
        {
          note: "1,000 request cùng MISS một lúc.",
          msgs: [
            ["clients", "app", "GET ×1000"],
            ["app", "cache", "GET ×1000"],
            ["cache", "app", "MISS ×1000", "err"],
          ],
          detail: "1,000 request đang bay cùng gọi `GET feed:hot` và cùng nhận **MISS** trong vài chục ms sau khi key hết hạn. Mỗi request xử lý độc lập theo cache-aside: \"miss thì tự đọc DB rồi SET lại\". Không request nào biết request khác cũng đang làm đúng việc này.",
        },
        {
          note: "Tất cả cùng query DB để rebuild → **thundering herd**.",
          msgs: [
            {
              par: [
                ["app", "db", "SELECT", "err"],
                ["app", "db", "SELECT", "err"],
                ["app", "db", "SELECT ×1000", "err"],
              ],
            },
          ],
          set: { db: "CPU 100% 🔥" },
          bad: ["db"],
          lesson: "Một key nóng hết hạn có thể đánh sập DB.",
          detail: "DB lên **CPU 100%** vì 1,000 query giống hệt nhau đổ vào cùng lúc. Query build feed thường nặng (join, sort, aggregate) → connection pool cạn, latency tăng từ ms lên giây. Query chậm thì request mới tiếp tục miss (cache chưa được SET lại) và dồn thêm query — vòng xoáy tự khuếch đại. Kết quả: DB timeout hoặc sập, kéo theo **mọi tính năng khác** dùng chung DB, chỉ vì một key hết hạn; 1,000 query cùng tính ra một kết quả trong khi chỉ cần một.",
        },
      ],
    },
    {
      name: "Single flight + jitter",
      steps: [
        {
          note: "Bình thường: mọi request đọc từ cache.",
          msgs: [["clients", "app", "GET /feed"], ["app", "cache", "GET feed:hot"], ["cache", "app", "HIT", "ok"]],
          detail: "Giống variant trước: mọi request hit cache, DB ở CPU 20%. Khác biệt chỉ lộ ra khi key hết hạn.",
        },
        {
          note: "TTL hết hạn đúng giờ cao điểm.",
          set: { cache: "feed:hot ✗ expired" },
          bad: ["cache"],
          detail: "TTL của `feed:hot` hết hạn đúng giờ cao điểm, Redis xoá key — trạng thái giống hệt variant không bảo vệ. Single flight không ngăn key hết hạn, nó chỉ đổi cách app phản ứng với miss.",
        },
        {
          note: "**Single flight**: 1,000 request MISS nhưng chỉ 1 request (leader) rebuild; 999 request còn lại chờ kết quả.",
          msgs: [["clients", "app", "GET ×1000"], ["cache", "app", "MISS", "err"]],
          set: { app: "1 leader · 999 chờ" },
          detail: "1,000 request cùng miss, nhưng nhờ **single flight** chỉ một request đi rebuild: request đầu tiên cho key `feed:hot` đăng ký làm **leader** (ví dụ giữ một promise/future trong map theo key, như `singleflight` của Go). 999 request sau thấy đã có leader đang rebuild thì **không query DB**, chỉ chờ kết quả của leader. Lưu ý: map này nằm trong từng process — nhiều app server thì mỗi server có một leader, hoặc phải dùng lock phân tán (`SET lock:feed:hot NX EX 5` trên Redis) để còn đúng một leader toàn cluster.",
        },
        {
          note: "Chỉ **1 query** xuống DB.",
          msgs: [["app", "db", "SELECT (×1)"], ["db", "app", "rows", "ok"]],
          set: { db: "CPU 22% ✓" },
          good: ["db"],
          detail: "Chỉ một `SELECT` xuống DB, DB trả rows và CPU chỉ nhích lên 22%. Cái giá: 999 request chờ thêm đúng bằng thời gian một query (ví dụ 50–200ms) thay vì được trả từ cache ngay. Cần đặt timeout cho việc chờ, để leader treo thì follower không bị kẹt mãi.",
        },
        {
          note: "Leader ghi lại cache với TTL có **jitter** rồi trả kết quả cho cả 1,000 request.",
          msgs: [["app", "cache", "SET EX 60±10s", "ok"], ["app", "clients", "200 ×1000", "ok"]],
          set: { cache: "feed:hot ✓", app: "đã trả 1000" },
          lesson: "Cách chống stampede chuẩn: request coalescing + TTL jitter.",
          detail: "Leader `SET feed:hot … EX 60±10s` rồi trả kết quả cho cả 1,000 request đang chờ; từ đó request mới lại hit cache. TTL có **jitter** (ngẫu nhiên 50–70s) để các key nạp cùng lúc không cùng hết hạn ở lần sau, tránh stampede đồng loạt trên nhiều key. Với một hot key duy nhất như ở đây, làm tốt hơn nữa bằng **refresh sớm** (rebuild trước khi hết hạn) hoặc **stale-while-revalidate** (trả bản cũ trong lúc một request rebuild) để không ai phải chờ.",
        },
      ],
    },
  ],
});
