BK.sim({
  id: "idem-retry",
  title: "Client timeout rồi gửi lại: có và không có idempotency key",
  topics: ["idempotency"],
  scenario: "Client gửi `POST /charges` 100k. Server trừ tiền xong nhưng response bị mất trên đường về. Client timeout và gửi lại.",
  context: "Client **không phân biệt được** request mất trên đường đi với response mất trên đường về: cả hai đều là timeout. Vì vậy client buộc phải gửi lại, và server phải tự nhận ra lần trùng. Hệ gồm **Client**, **API** và **Database** có bảng `charges` cùng bảng `idempotency_keys` (cột `key` có unique constraint). Theo dõi dòng chữ dưới Database: số lần trừ tiền và các key đã lưu.",
  nodes: [
    { id: "client", x: 100, y: 130, label: "Client" },
    { id: "api", x: 380, y: 130, label: "API" },
    { id: "db", x: 670, y: 130, label: "Database", w: 170, s: "charges: 0" },
  ],
  h: 260,
  variants: [
    {
      name: "Không có key",
      steps: [
        {
          note: "Client gửi `POST /charges` 100k.",
          msgs: [["client", "api", "POST /charges 100k"], ["api", "db", "INSERT charge 100k"]],
          set: { db: "charges: 1 (100k)" },
          detail: "API nhận request và `INSERT` một charge 100k. Transaction commit thành công: tiền đã trừ. Tới đây mọi thứ đúng.",
        },
        {
          note: "Response **mất** trên đường về. Client timeout.",
          msgs: [["api", "client", "201 (mất)", "err"]],
          set: { client: "timeout sau 5s" },
          bad: ["client"],
          detail: "Response `201` bị mất: load balancer đóng kết nối, mạng di động chập chờn, hoặc client hết timeout đúng lúc response đang về. Client chỉ thấy timeout và **không biết** charge đã tạo hay chưa.",
        },
        {
          note: "Client gửi lại cùng request.",
          msgs: [["client", "api", "POST /charges 100k (lại)", "warn"], ["api", "db", "INSERT charge 100k", "err"]],
          set: { db: "charges: 2 (200k) ❌" },
          bad: ["db"],
          lesson: "POST không idempotent: gửi lại = chạy lại. Không có key thì server không có cách nào biết đây là lần trùng.",
          detail: "API coi lần gửi lại là một request mới và `INSERT` thêm một charge. Khách bị trừ **200k**. Không có lỗi nào được báo: hai request đều hợp lệ khi xét riêng. Lỗi chỉ lộ ra khi khách khiếu nại hoặc khi đối soát.",
        },
      ],
    },
    {
      name: "Có key, không so payload",
      steps: [
        {
          note: "Client gửi `POST /charges` 100k kèm `Idempotency-Key: k1`.",
          msgs: [["client", "api", "POST 100k · key=k1"], ["api", "db", "INSERT key k1 + charge (1 tx)"]],
          set: { db: "charges: 1 · keys: k1→201" },
          detail: "API ghi key `k1` cùng response `201` và charge trong **một transaction**. Lần retry với `k1` sẽ được nhận ra.",
        },
        {
          note: "Bug ở client: thao tác **mới** 300k lại dùng lại key `k1`.",
          msgs: [["client", "api", "POST 300k · key=k1", "warn"], ["api", "db", "SELECT key k1"], ["db", "api", "có: 201 (100k)", "ok"]],
          detail: "Client copy code và quên sinh key mới, nên đơn 300k mang key `k1` của đơn 100k. API tìm thấy `k1` và **không so body**, nên coi đây là lần retry.",
        },
        {
          note: "API trả lại response cũ. Client tưởng đơn 300k đã trừ.",
          msgs: [["api", "client", "201 charge 100k", "err"]],
          bad: ["client"],
          lesson: "Key không kèm fingerprint biến bug của client thành lỗi im lặng: client nhận kết quả của thao tác khác.",
          detail: "Client nhận `201` và đánh dấu đơn 300k đã thanh toán, trong khi DB chưa hề trừ 300k. Lỗi này tệ hơn trừ trùng vì không ai biết. Cách chặn: lưu hash của body cùng key; key giống mà hash khác thì trả lỗi (bản nháp IETF đề xuất `422`).",
        },
      ],
    },
    {
      name: "Key đúng cách",
      steps: [
        {
          note: "Client gửi `POST` 100k kèm `key=k1`. API commit trước một dòng key trạng thái **đang xử lý**.",
          msgs: [["client", "api", "POST 100k · key=k1"], ["api", "db", "INSERT key k1 (processing, hash body); COMMIT"]],
          set: { db: "keys: k1 processing" },
          detail: "API `INSERT` key `k1` kèm hash body và trạng thái `processing` rồi commit ngay, trước khi làm việc nghiệp vụ. Unique constraint trên `key` bảo đảm chỉ một request giành được key. Dòng này phải có hạn: server chết giữa chừng thì dòng `processing` bị bỏ dở, cần được dọn hoặc cho hết hạn để client thử lại được.",
        },
        {
          note: "Một bản retry đến trong lúc lần đầu chưa xong → `409`.",
          msgs: [["client", "api", "POST 100k · key=k1 (retry sớm)", "warn"], ["api", "db", "INSERT key k1"], ["db", "api", "trùng khoá: processing", "warn"], ["api", "client", "409 Conflict", "warn"]],
          detail: "Request thứ hai đụng unique constraint và đọc thấy dòng `k1` đang `processing`. API trả `409` (\"thao tác đang chạy, thử lại sau\"), như bản nháp IETF đề xuất. Nhờ vậy hai request không cùng chạy thao tác trừ tiền. Cách khác: ghi key cùng transaction với nghiệp vụ; khi đó PostgreSQL bắt request sau **chờ** request đầu commit rồi mới báo trùng khoá, và request sau trả luôn response đã lưu.",
        },
        {
          note: "Lần đầu trừ tiền, lưu response, COMMIT cùng một transaction. Response vẫn mất.",
          msgs: [["api", "db", "BEGIN; INSERT charge; UPDATE k1=201; COMMIT", "ok"], ["api", "client", "201 (mất)", "err"]],
          set: { db: "charges: 1 · keys: k1→201" },
          detail: "Charge và việc chuyển key sang `201` (kèm response) nằm trong **một transaction**. Crash trước `COMMIT` thì không có charge và key vẫn `processing`: hết hạn dòng này thì lần retry chạy lại từ đầu một cách an toàn. Response lại bị mất trên đường về.",
        },
        {
          note: "Client retry với **cùng key và cùng body** → nhận lại response đã lưu.",
          msgs: [["client", "api", "POST 100k · key=k1"], ["api", "db", "SELECT k1"], ["db", "api", "201, hash khớp", "ok"], ["api", "client", "201 (đã lưu)", "ok"]],
          good: ["db"],
          lesson: "At-least-once + server nhớ key và response trong cùng transaction = effectively-once.",
          detail: "API thấy `k1` đã xong và hash body khớp, nên trả nguyên response đã lưu mà không trừ thêm. DB vẫn chỉ có **1 charge**. Key sẽ được dọn sau thời hạn đã công bố (Stripe API v1: từ 24 giờ), nên thời hạn phải dài hơn cửa sổ retry của client.",
        },
      ],
    },
  ],
});
