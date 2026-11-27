BK.sim({
  id: "cache-aside",
  title: "Cache-aside: miss → hit → invalidate",
  topics: ["caching", "dist-cache"],
  scenario: "User mở trang profile nhiều lần rồi đổi tên. Theo dõi lúc nào request chạm DB.",
  context: "Cache-aside (còn gọi lazy loading) đặt toàn bộ logic cache trong app: app tự hỏi cache, miss thì tự đọc DB rồi tự ghi lại cache — Redis không biết gì về DB. Có 4 thành phần: Client gọi API, **App Server** chứa logic cache, **Redis** chỉ là kho key-value thụ động, **PostgreSQL** là nguồn sự thật. Theo dõi dòng chữ dưới Redis (`trống` → `user:42 ✓ TTL 300s` → `trống`) và để ý request nào có mũi tên chạm PostgreSQL — đó là request đắt.",
  nodes: [
    { id: "client", x: 90, y: 150, label: "Client" },
    { id: "app", x: 310, y: 150, label: "App Server" },
    { id: "cache", x: 580, y: 65, label: "Redis Cache", s: "trống" },
    { id: "db", x: 580, y: 225, label: "PostgreSQL", s: "users: 1M rows" },
  ],
  steps: [
    {
      note: "User mở profile `GET /users/42`. App luôn hỏi cache trước.",
      msgs: [["client", "app", "GET /users/42"], ["app", "cache", "GET user:42"]],
      detail: "App **luôn hỏi cache trước**: Client gửi `GET /users/42` tới App Server, app chạy `GET user:42` trên Redis — một round-trip trong mạng nội bộ chỉ tốn khoảng 0.5–1ms. Key theo quy ước `<entity>:<id>` để mọi request đọc cùng user trúng cùng một key. Lúc này Redis đang `trống` vì chưa ai đọc user 42.",
    },
    {
      note: "Cache chưa có key → **MISS**. App tự đọc DB.",
      msgs: [["cache", "app", "MISS", "err"], ["app", "db", "SELECT … id=42"]],
      bad: ["cache"],
      detail: "Redis không có `user:42` nên trả `nil` — **cache miss**, app phải tự chạy `SELECT … WHERE id=42` xuống PostgreSQL. Redis không tự đi lấy dữ liệu (khác read-through cache). Miss là chuyện bình thường ở lần đọc đầu (cold cache), sau khi key hết TTL hoặc bị xoá — không phải lỗi, chỉ là đường chậm.",
    },
    {
      note: "DB trả row. App ghi vào cache kèm **TTL** để lần sau khỏi chạm DB.",
      msgs: [["db", "app", "row 42", "ok"], ["app", "cache", "SET user:42 EX 300", "ok"]],
      set: { cache: "user:42 ✓ TTL 300s" },
      detail: "App ghi row vào cache với **TTL 300 giây**: PostgreSQL trả row 42 (đọc theo primary key qua index, vài ms tới vài chục ms tuỳ tải), app serialize thành JSON rồi `SET user:42 <json> EX 300` → Redis tự xoá key sau 5 phút. TTL là lưới an toàn: kể cả khi code quên xoá cache lúc ghi, dữ liệu cũ chỉ sống tối đa 5 phút. Node Redis giờ hiện `user:42 ✓ TTL 300s`.",
    },
    {
      note: "Trả về client: request đầu mất ~25ms vì tốn một round-trip DB.",
      msgs: [["app", "client", "200 · 25ms", "ok"]],
      detail: "Request đầu mất ~25ms: app trả `200` sau một round-trip Redis (miss) + query DB + `SET` Redis + xử lý, phần lớn thời gian nằm ở DB. Đây là cái giá của request đầu tiên; mọi request sau trong 300 giây không phải trả nữa.",
    },
    {
      note: "Request thứ hai trong TTL: cache **HIT**, DB không bị chạm.",
      msgs: [
        ["client", "app", "GET /users/42"],
        ["app", "cache", "GET user:42"],
        ["cache", "app", "HIT", "ok"],
        ["app", "client", "200 · 2ms", "ok"],
      ],
      good: ["cache"],
      detail: "Request thứ hai trong TTL là **cache hit**, tổng ~2ms — nhanh hơn ~12 lần. `GET user:42` trả JSON có sẵn, app deserialize rồi trả luôn, không mũi tên nào chạm PostgreSQL: profile được đọc 1,000 lần trong 5 phút thì DB chỉ chịu 1 query thay vì 1,000. Đó là toàn bộ lý do dùng cache: giảm latency và giảm tải đọc cho DB.",
    },
    {
      note: "User đổi tên: app **UPDATE DB rồi DEL key**. Lần đọc tới miss và nạp bản mới.",
      msgs: [
        ["client", "app", "PATCH name"],
        ["app", "db", "UPDATE users"],
        ["app", "cache", "DEL user:42", "warn"],
      ],
      set: { cache: "trống", db: "name mới ✓" },
      lesson: "Cache-aside: đọc cache → miss thì đọc DB → ghi cache với TTL. Ghi DB xong thì xoá cache (không ghi đè) để thu hẹp race; TTL là chốt chặn cuối cho dữ liệu cũ.",
      detail: "Khi user đổi tên, app `UPDATE users` trên PostgreSQL trước (DB là nguồn sự thật, phải đúng trước), rồi `DEL user:42` thay vì `SET` giá trị mới. Xoá chứ không ghi đè vì hai request ghi chạy đồng thời có thể `SET` vào cache theo thứ tự ngược với thứ tự commit vào DB, để lại tên sai tới hết TTL; xoá thì lần đọc kế tiếp miss và nạp bản mới từ DB. Vẫn còn một race nhỏ: request đọc lấy bản cũ từ DB ngay trước UPDATE rồi `SET` vào cache ngay sau DEL — nên vẫn cần TTL làm giới hạn trên cho dữ liệu sai, hoặc xoá thêm lần nữa sau vài trăm ms (delayed double delete).",
    },
  ],
});
