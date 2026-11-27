BK.sim({
  id: "outbox",
  title: "Dual write và Transactional Outbox",
  topics: ["outbox-cdc"],
  scenario: "Order service tạo đơn và phải báo cho Inventory qua Kafka. Process chết đúng giữa hai việc.",
  context: "**Dual write** là ghi vào hai hệ thống (DB và Kafka) mà không có transaction nào bao cả hai. Order service ghi bảng `orders` và cần phát event `OrderCreated` để Inventory giữ hàng. Theo dõi dòng dưới **Database** (có đơn chưa, outbox có gì) và dưới **Inventory** (có biết đơn không). Variant 2 thêm bảng `outbox` và relay **CDC** đọc WAL.",
  nodes: [
    { id: "svc", x: 100, y: 90, label: "Order service" },
    { id: "db", x: 340, y: 90, label: "Database", w: 160, s: "orders: —" },
    { id: "cdc", x: 340, y: 230, label: "CDC relay", s: "đọc WAL" },
    { id: "kafka", x: 580, y: 230, label: "Kafka" },
    { id: "inv", x: 580, y: 90, label: "Inventory", s: "chưa biết đơn" },
  ],
  h: 300,
  variants: [
    {
      name: "Dual write",
      nodes: [
        { id: "svc", x: 100, y: 130, label: "Order service" },
        { id: "db", x: 340, y: 60, label: "Database", w: 160, s: "orders: —" },
        { id: "kafka", x: 340, y: 210, label: "Kafka" },
        { id: "inv", x: 600, y: 210, label: "Inventory", s: "chưa biết đơn" },
      ],
      steps: [
        {
          note: "Order service `INSERT orders` và COMMIT.",
          msgs: [["svc", "db", "INSERT order#42; COMMIT"], ["db", "svc", "ok", "ok"]],
          set: { db: "orders: #42 ✓" },
          detail: "Đơn #42 đã được commit, DB đảm bảo nó bền. Việc \"còn phải publish `OrderCreated`\" lúc này chỉ nằm trong RAM của process, dưới dạng dòng code tiếp theo sẽ chạy.",
        },
        {
          note: "Process **chết** trước khi kịp publish.",
          set: { svc: "💥 OOM / deploy" },
          bad: ["svc"],
          detail: "Process bị kill: OOM, rolling deploy, node bị thu hồi. Dòng `publish()` không bao giờ chạy. Code retry hay `finally` cũng không cứu được, vì chúng nằm trong chính process vừa chết.",
        },
        {
          note: "DB có đơn, Kafka không có event. Inventory **không bao giờ** biết.",
          set: { svc: "process mới", inv: "không biết #42 ❌" },
          bad: ["inv"],
          lesson: "Dual write: không transaction nào bao cả DB và broker, crash ở giữa làm hai bên lệch nhau vĩnh viễn.",
          detail: "Process mới khởi động không có dấu vết gì về event bị bỏ lỡ. Đơn #42 tồn tại nhưng không ai giữ hàng, không ai gửi email. Không có lỗi nào được log; chỉ đối soát mới phát hiện. Đảo thứ tự (publish trước, commit sau) thì hỏng theo chiều ngược lại: commit lỗi mà event đã đi.",
        },
      ],
    },
    {
      name: "Outbox + CDC",
      steps: [
        {
          note: "Một transaction ghi **cả** `orders` lẫn `outbox`.",
          msgs: [["svc", "db", "BEGIN; INSERT order#42; INSERT outbox(id=e1, key=42); COMMIT"], ["db", "svc", "ok", "ok"]],
          set: { db: "orders: #42 · outbox: e1" },
          detail: "Event `OrderCreated` (id `e1`, `aggregateid` = 42) được ghi vào bảng `outbox` **trong cùng transaction** với đơn. Hoặc cả hai cùng có, hoặc không có gì. Service không gọi Kafka.",
        },
        {
          note: "Process chết ngay sau commit. **Không sao**: event đã nằm trong DB.",
          set: { svc: "💥 crash" },
          bad: ["svc"],
          detail: "Process chết như variant trước, nhưng lần này không còn việc gì nằm trong RAM: event đã bền trong DB, và dòng `INSERT outbox` đã nằm trong WAL.",
        },
        {
          note: "CDC relay đọc WAL qua replication slot và publish lên Kafka với key = 42.",
          msgs: [["db", "cdc", "WAL: INSERT outbox e1"], ["cdc", "kafka", "OrderCreated e1 · key=42"]],
          set: { cdc: "đã gửi e1" },
          detail: "Relay (ví dụ Debezium) đọc thay đổi qua logical decoding, thấy dòng insert vào `outbox` và gửi lên topic theo `aggregatetype`, key = `aggregateid` để mọi event của đơn 42 vào cùng partition, giữ thứ tự.",
        },
        {
          note: "Relay crash trước khi vị trí đọc được lưu → khởi động lại và **gửi lại** e1.",
          msgs: [["cdc", "kafka", "OrderCreated e1 (lại)", "warn"]],
          set: { cdc: "slot lùi về LSN cũ" },
          detail: "Vị trí của replication slot chỉ được lưu bền ở checkpoint, nên sau crash relay có thể đọc lại thay đổi gần đây. Tài liệu PostgreSQL nói rõ client phải tự xử lý trùng. Outbox đảm bảo **không mất**, không đảm bảo **không trùng**.",
        },
        {
          note: "Inventory dedupe theo `id` của event: nhận e1 hai lần, xử lý một lần.",
          msgs: [["kafka", "inv", "e1"], ["kafka", "inv", "e1 (trùng)", "warn"]],
          set: { inv: "giữ hàng #42 ✓ (bỏ qua e1 lần 2)" },
          good: ["inv", "db"],
          lesson: "Outbox biến dual write thành một lần ghi có transaction; relay giao at-least-once nên consumer dedupe theo event id.",
          detail: "Inventory ghi `e1` vào bảng `processed_events` cùng transaction với việc giữ hàng. Lần thứ hai thấy `e1` đã có thì bỏ qua. Kết quả: DB và Inventory khớp nhau dù cả service lẫn relay đều đã crash.",
        },
      ],
    },
  ],
});
