BK.sim({
  id: "replica-lag",
  title: "Read replica và replication lag",
  topics: ["patterns", "cap", "replication"],
  scenario: "User đổi tên rồi reload trang ngay. Lần đọc rơi vào replica đang trễ 2 giây.",
  context: "**Replication lag** là khoảng thời gian replica chậm hơn primary — ở đây ~2 giây. Hệ có một **Primary DB** nhận mọi lệnh ghi và một **Read Replica** nhận bản sao qua replication **bất đồng bộ** (primary commit xong là trả lời, rồi mới gửi WAL/binlog sang replica). App route đọc sang replica để giảm tải cho primary. Theo dõi dòng `name=` dưới hai DB và xem request đọc đi vào DB nào.",
  nodes: [
    { id: "user", x: 90, y: 150, label: "User" },
    { id: "app", x: 310, y: 150, label: "App" },
    { id: "primary", x: 590, y: 65, label: "Primary DB", s: "name=Old" },
    { id: "replica", x: 590, y: 225, label: "Read Replica", s: "name=Old" },
  ],
  links: [["primary", "replica"]],
  variants: [
    {
      name: "Luôn đọc replica",
      steps: [
        {
          note: "User đổi tên thành **Son**. App ghi vào primary.",
          msgs: [
            ["user", "app", "PATCH name=Son"],
            ["app", "primary", "UPDATE"],
            ["primary", "app", "ok", "ok"],
            ["app", "user", "200", "ok"],
          ],
          set: { primary: "name=Son" },
          detail: "Lệnh ghi vào primary thành công nhanh: app gửi `UPDATE` đổi tên thành **Son** tới primary (mọi lệnh ghi phải vào primary), primary commit, trả `ok`, app trả `200`. Primary giờ `name=Son`. Ghi nhanh vì với replication bất đồng bộ, primary **không chờ** replica nhận thay đổi trước khi ack.",
        },
        {
          note: "Replication **bất đồng bộ**, đang trễ ~2s.",
          set: { replica: "name=Old (đang trễ)" },
          msgs: [["primary", "replica", "replicate… lag 2s", "warn"]],
          detail: "Trong 2 giây này hai DB trả lời **khác nhau** cho cùng một câu hỏi: replica vẫn `name=Old`. Primary đã gửi bản ghi thay đổi (WAL trong PostgreSQL, binlog trong MySQL), nhưng replica trễ ~2s — do đường mạng, do đang áp một transaction lớn, hoặc do chịu quá nhiều query đọc.",
        },
        {
          note: "Reload ngay: đọc vào replica → user thấy **tên cũ**, tưởng lưu lỗi.",
          msgs: [
            ["user", "app", "GET profile"],
            ["app", "replica", "SELECT"],
            ["replica", "app", "name=Old", "err"],
            ["app", "user", "Old ❌", "err"],
          ],
          bad: ["replica"],
          lesson: "Read replica giảm tải đọc nhưng sinh replication lag.",
          detail: "User reload trong vòng 2 giây và thấy tên cũ, ngay sau khi vừa được báo lưu thành công. App route `SELECT` sang replica như mọi lần đọc, replica trả `name=Old`. User tưởng thao tác lỗi, sửa lại hoặc báo bug — dù dữ liệu trên primary hoàn toàn đúng. Đây là vi phạm **read-your-writes**: lỗi trải nghiệm, không mất dữ liệu, nhưng khó debug vì chỉ xảy ra khi đọc ngay sau ghi, và lag tăng mạnh lúc hệ thống tải cao.",
        },
      ],
    },
    {
      name: "Read-your-writes",
      steps: [
        {
          note: "User đổi tên thành **Son**. App ghi vào primary.",
          msgs: [
            ["user", "app", "PATCH name=Son"],
            ["app", "primary", "UPDATE"],
            ["primary", "app", "ok", "ok"],
            ["app", "user", "200", "ok"],
          ],
          set: { primary: "name=Son" },
          detail: "Giống variant trước: `UPDATE` vào primary, primary `name=Son`, app trả `200`.",
        },
        {
          note: "App ghi nhớ `last_write_at` của user (session/cookie).",
          set: { app: "user vừa ghi < 5s", replica: "name=Old (đang trễ)" },
          msgs: [["primary", "replica", "replicate… lag 2s", "warn"]],
          detail: "Sau khi ghi, app lưu `last_write_at` của user (trong session, cookie, hoặc Redis theo user id). Fix này **không làm replication nhanh hơn** — replica vẫn trễ (`name=Old`) — nó chỉ đổi nơi đọc. Ngưỡng 5s lớn hơn lag thường gặp (2s) để có biên an toàn.",
        },
        {
          note: "Trong 5s sau khi ghi, app route đọc của **chính user đó** về primary.",
          msgs: [
            ["user", "app", "GET profile"],
            ["app", "primary", "SELECT"],
            ["primary", "app", "name=Son", "ok"],
            ["app", "user", "Son ✓", "ok"],
          ],
          good: ["primary"],
          detail: "User reload và thấy đúng `name=Son`: app thấy `now - last_write_at < 5s` nên route `SELECT` của **chính user này** sang primary. Cái giá: một phần đọc dồn về primary, tải primary tăng theo tỉ lệ người vừa ghi. Rủi ro còn lại: lag vượt 5s (replica quá tải) thì lỗi quay lại — cách chặt hơn là lưu LSN/GTID của lần ghi và chỉ đọc replica khi replica đã áp tới vị trí đó. Nếu `last_write_at` nằm trong cookie, user mở app trên thiết bị khác vẫn có thể thấy tên cũ.",
        },
        {
          note: "Người khác vẫn đọc replica — chấp nhận eventual consistency.",
          set: { replica: "name=Son ✓" },
          msgs: [["app", "replica", "SELECT (user khác)"]],
          lesson: "Read-your-writes: route đọc của người vừa ghi về primary trong một khoảng ngắn.",
          detail: "Các user khác vẫn đọc replica, nên hệ giữ được lợi ích chính: phần lớn tải đọc nằm trên replica. Sau ~2s replica áp xong và hiện `name=Son ✓`; trong 2s trước đó họ có thể thấy tên cũ — đó là **eventual consistency**, chấp nhận được vì họ không biết vừa có thay đổi.",
        },
      ],
    },
  ],
});
