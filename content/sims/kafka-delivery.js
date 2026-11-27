BK.sim({
  id: "kafka-delivery",
  title: "Commit offset: at-most-once, at-least-once, idempotent",
  topics: ["kafka"],
  scenario: "Consumer đọc message “charge $5” rồi crash. Thời điểm commit offset quyết định message bị mất hay bị xử lý hai lần.",
  context: "**Thứ tự giữa xử lý và commit** quyết định message bị mất hay bị xử lý hai lần. Consumer đọc message từ partition rồi **commit offset** vào topic nội bộ `__consumer_offsets` để nhớ đã đọc tới đâu. Offset được commit là **offset của message kế tiếp cần đọc**: commit 101 nghĩa là \"đã xong 100\". Khi consumer chết, consumer thay thế (sau rebalance) đọc tiếp từ offset đã commit. Theo dõi dòng `committed = …` dưới `__consumer_offsets` và dòng chữ dưới Database.",
  nodes: [
    { id: "kafka", x: 100, y: 120, label: "Partition", s: "offset 100, 101, 102" },
    { id: "consumer", x: 380, y: 120, label: "Consumer" },
    { id: "offsets", x: 380, y: 250, label: "__consumer_offsets", w: 170, s: "committed = 100" },
    { id: "db", x: 670, y: 120, label: "Database", s: "—" },
  ],
  h: 300,
  variants: [
    {
      name: "At-most-once",
      steps: [
        {
          note: "Consumer poll message offset 100.",
          msgs: [["kafka", "consumer", "msg@100 charge $5"]],
          detail: "Consumer gọi `poll()` và nhận message offset 100: \"charge $5\". Message mới nằm trong bộ nhớ consumer — chưa xử lý, Database chưa có gì. Offset đã commit vẫn là 100.",
        },
        {
          note: "**Commit offset trước** khi xử lý.",
          msgs: [["consumer", "offsets", "commit 101"]],
          set: { offsets: "committed = 101" },
          detail: "Consumer commit offset **101 trước** khi xử lý — tức tuyên bố với Kafka \"message 100 đã xong\" trong khi chưa làm gì. Từ đây, theo Kafka, message 100 không bao giờ cần giao lại. Kiểu này hay xuất hiện vô tình khi bật `enable.auto.commit=true` mà xử lý message bất đồng bộ ở thread khác: lần `poll()` sau tự commit offset trong khi việc xử lý chưa xong.",
        },
        {
          note: "Crash khi đang xử lý.",
          set: { consumer: "💥 crash" },
          bad: ["consumer"],
          detail: "Consumer crash (OOM, deploy, kill) khi đang xử lý message 100 — lệnh ghi charge $5 chưa tới Database. Kafka và `__consumer_offsets` không biết chuyện này: với chúng, 100 đã hoàn tất. Sau `session.timeout.ms` (mặc định 45s ở Kafka 3.x), group coordinator coi consumer đã chết và rebalance, giao partition cho consumer khác.",
        },
        {
          note: "Consumer mới đọc từ 101 → message 100 **mất**.",
          set: { consumer: "consumer mới" },
          msgs: [["kafka", "consumer", "msg@101"]],
          bad: ["db"],
          lesson: "At-most-once: không trùng nhưng có thể mất. Chỉ hợp metrics, log không quan trọng.",
          detail: "Message 100 **mất vĩnh viễn**: consumer mới đọc offset đã commit là 101 và bắt đầu từ `msg@101`. Message 100 vẫn nằm trong log Kafka nhưng không ai xử lý nữa, Database không có charge $5. Lỗi **im lặng** — không exception, không lag, chỉ phát hiện khi đối soát sổ sách. Chỉ chấp nhận được với dữ liệu mất vài bản ghi không sao (metrics, log, tracking click).",
        },
      ],
    },
    {
      name: "At-least-once",
      steps: [
        {
          note: "Consumer poll message offset 100.",
          msgs: [["kafka", "consumer", "msg@100 charge $5"]],
          detail: "Lần này consumer **xử lý trước, commit sau** — thứ tự mặc định của Kafka consumer khi commit thủ công sau xử lý. Consumer poll message offset 100 (\"charge $5\"); offset đã commit vẫn là 100.",
        },
        {
          note: "Xử lý xong: ghi DB.",
          msgs: [["consumer", "db", "INSERT charge $5"]],
          set: { db: "charge $5 (1 lần)" },
          detail: "Charge $5 đã thật sự tồn tại (1 lần): consumer `INSERT` vào Database, transaction DB commit thành công. Nhưng `__consumer_offsets` vẫn ghi `committed = 100` — Kafka chưa biết message 100 đã xong. Giữa hai thao tác ghi vào hai hệ thống khác nhau (DB và Kafka) luôn có một khe hở không thể bao bằng một transaction.",
        },
        {
          note: "Crash **trước khi commit** offset.",
          set: { consumer: "💥 crash" },
          bad: ["consumer"],
          detail: "Consumer crash đúng trong khe hở đó: đã ghi DB nhưng chưa kịp commit offset 101. Database giữ charge, Kafka vẫn nghĩ 100 chưa xong. Với auto commit, khe hở có thể dài tới `auto.commit.interval.ms` (mặc định 5s) → mọi message đã xử lý trong 5 giây đó đều có nguy cơ bị xử lý lại.",
        },
        {
          note: "Consumer mới đọc lại từ 100 → xử lý **lần hai**.",
          set: { consumer: "consumer mới", db: "charge $5 × 2 ❌" },
          msgs: [["kafka", "consumer", "msg@100 (lại)", "warn"], ["consumer", "db", "INSERT charge $5", "err"]],
          bad: ["db"],
          lesson: "At-least-once (mặc định): không mất nhưng có thể trùng.",
          detail: "Database có **2 lần charge $5** — khách bị trừ tiền hai lần. Consumer mới đọc từ offset đã commit (100), nhận lại \"charge $5\" và `INSERT` lần hai. Không mất dữ liệu, nhưng **trùng lặp** chắc chắn xảy ra trong thực tế (crash, rebalance, deploy). Vì vậy at-least-once chỉ an toàn khi bước xử lý chịu được chạy lặp.",
        },
      ],
    },
    {
      name: "At-least-once + idempotent",
      steps: [
        {
          note: "Consumer poll message offset 100.",
          msgs: [["kafka", "consumer", "msg@100 charge $5"]],
          detail: "Vẫn xử lý trước, commit sau như at-least-once, thêm một điều kiện: bước ghi DB phải **idempotent** — chạy 1 lần hay 10 lần cho cùng message thì kết quả như nhau. Consumer poll message offset 100.",
        },
        {
          note: "Ghi DB kèm **message id** làm khoá duy nhất.",
          msgs: [["consumer", "db", "INSERT … ON CONFLICT DO NOTHING"]],
          set: { db: "msg 100 ✓" },
          detail: "Lần đầu insert thành công, Database ghi `msg 100 ✓`. Consumer `INSERT` charge kèm **message id** làm unique key — id nghiệp vụ do producer sinh hoặc bộ `topic-partition-offset` — với `ON CONFLICT DO NOTHING`: id đã tồn tại thì bỏ qua, không lỗi. Unique constraint trong DB dedupe atomic, không cần lock hay check-then-insert dễ race.",
        },
        {
          note: "Crash **trước khi commit** offset.",
          set: { consumer: "💥 crash" },
          bad: ["consumer"],
          detail: "Consumer lại crash trước khi commit offset, đúng khe hở như variant trước — nhưng lần này giao lại **không còn nguy hiểm**. Kafka vẫn nghĩ message 100 chưa xong và sẽ giao lại.",
        },
        {
          note: "Đọc lại 100 → DB thấy msg id đã có, **bỏ qua**; commit tiếp.",
          set: { consumer: "consumer mới", offsets: "committed = 101" },
          msgs: [
            ["kafka", "consumer", "msg@100 (lại)", "warn"],
            ["consumer", "db", "INSERT … ON CONFLICT"],
            ["db", "consumer", "0 row (đã có)", "ok"],
            ["consumer", "offsets", "commit 101", "ok"],
          ],
          good: ["db"],
          lesson: "Trong thực tế, “exactly-once” = at-least-once + consumer idempotent.",
          detail: "Không có charge thứ hai: consumer mới đọc lại `msg@100`, chạy cùng `INSERT … ON CONFLICT`, DB trả **0 row** vì id 100 đã có. Consumer commit 101 và đi tiếp. Kết quả cuối như thể message được xử lý đúng một lần — **effectively-once**. Lưu ý: nếu bước xử lý là gọi API thanh toán bên ngoài chứ không phải insert DB, phải truyền **idempotency key** cho API đó; còn transaction của Kafka (`isolation.level=read_committed`, `transactional.id`) chỉ cho exactly-once khi cả đầu vào lẫn đầu ra đều là topic Kafka.",
        },
      ],
    },
  ],
});
