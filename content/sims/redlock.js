BK.sim({
  id: "redlock",
  title: "Distributed lock: GC pause và fencing token",
  topics: ["dist-lock", "concurrency"],
  scenario: "Hai server dùng Redis lock để ghi vào cùng storage. Server A bị GC pause dài hơn TTL của lock.",
  context: "Server A và B cùng ghi vào một Storage và dùng Redis làm distributed lock để mỗi lúc chỉ một server ghi. Lock có **TTL** để tự hết hạn khi server giữ lock chết, tránh khoá vĩnh viễn. **Fencing token** là số tăng dần cấp kèm mỗi lần lấy lock, để Storage tự phân biệt ai giữ lock mới nhất. Theo dõi trạng thái dưới Storage: giá trị `x` và `max token` nó đã thấy.",
  nodes: [
    { id: "A", x: 100, y: 65, label: "Server A" },
    { id: "B", x: 100, y: 225, label: "Server B" },
    { id: "redis", x: 370, y: 180, label: "Redis Lock" },
    { id: "db", x: 680, y: 145, label: "Storage", s: "x=0 · max token=0" },
  ],
  variants: [
    {
      name: "Chỉ dùng lock có TTL",
      steps: [
        {
          note: "A lấy lock với TTL 10s.",
          msgs: [["A", "redis", "SET lock NX PX 10000"], ["redis", "A", "OK", "ok"]],
          set: { A: "giữ lock", redis: "owner=A · TTL 10s" },
          detail: "A giữ lock và bắt đầu critical section (đọc–sửa–ghi Storage) sau khi `SET lock A NX PX 10000` trả OK — chỉ set nếu key chưa tồn tại (`NX`), tự hết hạn sau 10.000ms. Lưu ý sim gọi là “Redlock” nhưng thực chất đây là lock trên **một** Redis instance; Redlock thật lấy lock trên đa số trong 5 node độc lập — và vẫn mắc đúng lỗi ở các bước sau.",
        },
        {
          note: "A bị **GC pause 11s** ngay trong critical section.",
          set: { A: "⏸ GC pause 11s" },
          bad: ["A"],
          detail: "A đứng hình 11 giây ngay trong critical section: JVM dừng mọi thread cho một **stop-the-world GC pause** (cũng có thể là swap, VM bị tạm dừng, hay mạng nghẽn). Trong lúc pause, A không chạy được dòng code nào, kể cả code kiểm tra hay gia hạn lock. Đồng hồ của Redis vẫn chạy: lock chỉ còn sống 10s.",
        },
        {
          note: "Lock hết TTL. B lấy lock hợp lệ và ghi.",
          msgs: [["B", "redis", "SET lock NX"], ["redis", "B", "OK", "ok"], ["B", "db", "write x=2", "ok"]],
          set: { redis: "owner=B", B: "giữ lock", db: "x=2" },
          detail: "Ở giây thứ 10 key `lock` hết TTL và bị xoá; B gọi `SET lock NX` và thành công — hoàn toàn hợp lệ theo góc nhìn của Redis. B ghi `x=2` vào Storage. Tới đây hệ thống vẫn đúng: chỉ một người giữ lock.",
        },
        {
          note: "A tỉnh dậy, **không biết** đã mất lock và vẫn ghi.",
          msgs: [["A", "db", "write x=1", "err"]],
          set: { db: "x=1 ❌ ghi đè B", A: "tưởng còn lock" },
          bad: ["db"],
          lesson: "Lock có TTL không chống được process pause → hỏng dữ liệu.",
          detail: "A ghi `x=1` đè lên `x=2` của B ở giây thứ 11 — hai server cùng tin mình giữ lock. A chạy tiếp từ đúng dòng nó dừng, **không biết** lock đã hết hạn. Kiểm tra lock trước khi ghi cũng không cứu được, vì pause có thể xảy ra ngay giữa lệnh kiểm tra và lệnh ghi. Dữ liệu của B bị ghi đè **im lặng** — không lỗi, không log, Storage chấp nhận mọi lệnh ghi. Lock có TTL chỉ an toàn nếu giả định không process nào dừng lâu hơn TTL, và giả định đó không đúng trong thực tế.",
        },
      ],
    },
    {
      name: "Có fencing token",
      steps: [
        {
          note: "A lấy lock và nhận **token 33**.",
          msgs: [["A", "redis", "acquire"], ["redis", "A", "OK token=33", "ok"]],
          set: { A: "lock · token 33", redis: "owner=A · token 33" },
          detail: "A lấy lock và nhận kèm **token 33** — số tăng đơn điệu, mỗi lần cấp lock tăng 1. Redis không tự có token này: phải cài thêm, ví dụ `INCR lock_token` trong cùng script Lua lấy lock, hoặc dùng service có sẵn như ZooKeeper (`zxid`) hay etcd (revision).",
        },
        {
          note: "A bị **GC pause 11s**.",
          set: { A: "⏸ GC pause 11s" },
          bad: ["A"],
          detail: "A lại bị GC pause 11s, dài hơn TTL 10s. Như variant trước, A hoàn toàn không biết thời gian đã trôi qua.",
        },
        {
          note: "Lock hết TTL. B lấy lock, nhận **token 34**, ghi kèm token.",
          msgs: [
            ["B", "redis", "acquire"],
            ["redis", "B", "OK token=34", "ok"],
            ["B", "db", "write x=2 · t34", "ok"],
          ],
          set: { redis: "owner=B · token 34", B: "lock · token 34", db: "x=2 · max token=34" },
          detail: "Storage giờ **nhớ** token lớn nhất từng thấy — đó là điểm mấu chốt. Lock hết hạn, B lấy lock và nhận **token 34**, rồi ghi `x=2` kèm token 34; Storage thấy 34 > max token đang có (0), chấp nhận lệnh ghi và lưu `max token=34`.",
        },
        {
          note: "A ghi với token 33. Storage thấy 33 < 34 → **từ chối**.",
          msgs: [["A", "db", "write x=1 · t33", "warn"], ["db", "A", "REJECT 33 < 34", "err"]],
          set: { db: "x=2 ✓ · max token=34" },
          good: ["db"],
          lesson: "Fencing token: storage tự bảo vệ — chỉ nhận token tăng dần.",
          detail: "Storage **từ chối** lệnh ghi `x=1` của A vì token 33 < 34; `x=2` của B được giữ nguyên. Lời giải không cần A biết mình đã mất lock — chính Storage tự bảo vệ. Điều kiện: Storage phải kiểm tra token và ghi **nguyên tử** (ví dụ `UPDATE … SET x=1, token=33 WHERE token < 33`); Storage không hỗ trợ điều kiện kiểu này thì fencing không áp dụng được.",
        },
      ],
    },
  ],
});
