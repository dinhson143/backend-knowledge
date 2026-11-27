BK.sim({
  id: "redis-cluster",
  title: "Redis Cluster: hash slot và failover",
  topics: ["redis"],
  scenario: "Cluster 3 master chia 16,384 slot; Master B có một replica.",
  context: "Redis Cluster chia keyspace thành **16,384 hash slot**; mỗi master giữ một dải slot, key thuộc slot `CRC16(key) mod 16384`. Client thông minh cache **bảng slot → node** để gửi thẳng tới đúng master; bảng cũ thì node nhận nhầm trả `MOVED`. Mỗi master có thể có replica, nhưng replication **bất đồng bộ**: master trả OK trước khi replica có dữ liệu. Theo dõi dòng chữ dưới Client (slot tính được), dưới Master B và Replica B′ (ai đang giữ key nào).",
  h: 340,
  nodes: [
    { id: "client", x: 100, y: 170, label: "Client" },
    { id: "m1", x: 390, y: 60, label: "Master A", s: "slot 0–5460" },
    { id: "m2", x: 390, y: 170, label: "Master B", s: "slot 5461–10922" },
    { id: "m3", x: 390, y: 280, label: "Master C", s: "slot 10923–16383" },
    { id: "r2", x: 670, y: 170, label: "Replica B′", s: "bản sao của B" },
  ],
  links: [["m2", "r2"]],
  variants: [
    {
      name: "Định tuyến theo slot",
      steps: [
        {
          note: "Client cần `GET user:42`. `slot = CRC16(\"user:42\") mod 16384` — giả sử ra **8,155**, thuộc Master B.",
          set: { client: "slot 8155 → B" },
          detail: "Client tự tính ra key `user:42` thuộc Master B, không cần hỏi node nào. `CRC16(\"user:42\") mod 16384`, giả sử ra 8,155; tra bảng slot thì 8,155 nằm trong dải 5461–10922, thuộc Master B. Phép tính diễn ra **hoàn toàn phía client** → cluster không cần proxy trung tâm và mỗi lệnh chỉ tốn một hop.",
        },
        {
          note: "Client dùng bảng slot cũ, gửi nhầm tới Master A → nhận **MOVED**.",
          msgs: [["client", "m1", "GET user:42"], ["m1", "client", "MOVED 8155 → B", "warn"]],
          detail: "Master A trả lỗi `MOVED 8155 <ip:port của B>` vì client gửi nhầm chỗ. Bảng slot trong cache của client đã cũ (ví dụ slot vừa di chuyển khi resharding hoặc failover), nên `GET user:42` tới Master A. A không giữ slot 8,155 và không proxy giúp. Với client, lỗi này nghĩa là \"slot đã đổi chủ vĩnh viễn, hãy cập nhật bảng\". Cái giá: thêm một round-trip cho lệnh này.",
        },
        {
          note: "Client cập nhật bảng slot và gửi đúng node.",
          msgs: [["client", "m2", "GET user:42"], ["m2", "client", "\"Son\"", "ok"]],
          detail: "Client cập nhật bảng slot (thường gọi lại `CLUSTER SHARDS`/`CLUSTER SLOTS` để làm mới toàn bộ), gửi lại tới Master B và nhận `\"Son\"`. Các lệnh sau vào slot này đi thẳng tới B. Cơ chế tự sửa này cho cluster đổi topology mà không phải cấu hình lại client. Trong lúc đang di chuyển slot, node có thể trả `ASK` thay vì `MOVED`: chuyển hướng một lần, không cập nhật bảng.",
        },
        {
          note: "Lệnh nhiều key phải cùng slot. **Hash tag** `{user42}` ép mọi key của user42 vào cùng slot.",
          msgs: [["client", "m2", "MGET {user42}:cart {user42}:profile"], ["m2", "client", "2 values", "ok"]],
          lesson: "Smart client cache bảng slot để đi thẳng đúng node; MOVED giúp tự sửa khi topology đổi.",
          detail: "`MGET`, `MULTI` hay Lua script chạm nhiều key chỉ chạy được khi mọi key **cùng một slot**; nếu không, Redis trả lỗi `CROSSSLOT`. **Hash tag**: key có `{...}` thì chỉ phần trong ngoặc được hash → `{user42}:cart` và `{user42}:profile` cùng slot, cùng nằm trên Master B, và `MGET` trả 2 giá trị trong một lệnh. Lạm dụng hash tag (ví dụ cả hệ thống dùng chung `{app}`) dồn hết key vào một slot, tạo **hot shard** và mất ý nghĩa phân tán.",
        },
      ],
    },
    {
      name: "Failover mất write",
      steps: [
        {
          note: "Client ghi vào Master B; B ack ngay rồi mới **replicate bất đồng bộ**.",
          msgs: [["client", "m2", "SET lock:7 A NX"], ["m2", "client", "OK", "ok"]],
          set: { m2: "lock:7 = A" },
          detail: "Client A tin mình đang giữ lock: chạy `SET lock:7 A NX` (chỉ set nếu chưa có) và Master B trả `OK` **ngay lập tức** sau khi ghi vào bộ nhớ. Lệnh chỉ được gửi sang Replica B′ sau đó, bất đồng bộ qua replication stream. Client A bắt đầu làm việc trong vùng găng.",
        },
        {
          note: "B chết trước khi kịp gửi sang replica.",
          msgs: [["m2", "r2", "replicate ✗", "err"]],
          set: { m2: "💥 down" },
          bad: ["m2"],
          detail: "Master B chết trong khe hở vài ms đó, trước khi replication stream mang `lock:7` sang B′. Lệnh ghi đã được ack nhưng giờ chỉ còn trong bộ nhớ của một máy đã chết. Kể cả bật AOF, B cũng không quay lại kịp: cluster sẽ thay nó bằng replica.",
        },
        {
          note: "Replica được promote thành master — **không có** `lock:7`.",
          set: { r2: "Master mới · không có lock:7" },
          detail: "B′ lên làm master với dữ liệu **không có** `lock:7` — và đó là sự thật mới. Sau `cluster-node-timeout` (mặc định 15s), các master còn lại đánh dấu B là FAIL, bầu B′ lên master và giao dải slot 5461–10922. Lệnh `WAIT 1 timeout` chờ replica xác nhận trước khi trả lời client, giảm khả năng này, nhưng Redis vẫn không đảm bảo strong consistency.",
        },
        {
          note: "Client khác lấy được cùng lock → hai bên cùng nghĩ mình giữ lock.",
          msgs: [["client", "r2", "SET lock:7 B NX"], ["r2", "client", "OK", "err"]],
          bad: ["r2"],
          lesson: "Replication bất đồng bộ: failover có thể mất write đã ack → lock cần fencing token; dữ liệu quan trọng cần nơi lưu bền khác.",
          detail: "**A và B cùng tin mình giữ lock**: Client B chạy `SET lock:7 B NX` trên master mới, key không tồn tại nên nhận `OK`. Cả hai cùng ghi vào tài nguyên được bảo vệ — ví dụ cùng xử lý một đơn hàng, cùng trừ kho. Lỗi im lặng: cả hai lệnh đều thành công đúng nghĩa. Phòng tránh: tài nguyên đích kiểm tra **fencing token** (số tăng dần cấp kèm lock, từ chối token cũ), và dữ liệu không được mất phải nằm ở hệ thống có replication đồng bộ/quorum (PostgreSQL, etcd), không chỉ trong Redis.",
        },
      ],
    },
  ],
});
