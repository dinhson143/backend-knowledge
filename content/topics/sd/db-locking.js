BK.topic({
  id: "db-locking",
  track: "sd",
  section: "sd-core",
  title: "Database Locking",
  goal: "Chọn optimistic hay pessimistic lock và tránh deadlock trong DB",
  needs: ["db-isolation-anomalies"],
  tldr: {
    t: "**Database locking** (khoá dòng/bảng bên trong một database) chặn hai transaction cùng sửa một dữ liệu theo cách làm hỏng nhau. **Pessimistic lock** (`SELECT … FOR UPDATE`): khoá dòng trước khi đọc để sửa, người đến sau phải chờ. **Optimistic lock**: không khoá, đọc kèm `version`, lúc ghi `UPDATE … WHERE version = ?`; 0 dòng bị ảnh hưởng nghĩa là có người sửa trước, đọc lại rồi thử lại.",
    why: "Đọc rồi ghi là hai bước; giữa hai bước, transaction khác có thể ghi đè (lost update). Pessimistic đóng khe hở bằng cách **chặn người khác** suốt khoảng đó; optimistic để mọi người chạy đồng thời rồi **phát hiện xung đột lúc ghi**. Chọn cái nào phụ thuộc xung đột hay xảy ra tới đâu.",
  },
  story: {
    problem: "Hai nhân viên kho cùng mở đơn nhập hàng, đều thấy tồn kho 10, một người cộng 5, người kia trừ 3, rồi lưu. Kết quả là 15 hoặc 7 tuỳ ai lưu sau, không phải 12. Cũng chuyện đó ở quy mô lớn: 1000 người cùng giành 10 vé cuối của một suất chiếu.",
    idea: "Để chính DB làm trọng tài, vì DB là nơi duy nhất thấy mọi transaction: khoá dòng trong transaction (pessimistic), hoặc điều kiện trên `version` trong câu `UPDATE` (optimistic). Khi chỉ cần tránh trùng việc chứ không cần chờ, dùng `SKIP LOCKED` để mỗi worker lấy dòng chưa ai khoá.",
    tradeoff: "Pessimistic giữ khoá suốt transaction: transaction dài hay gọi API bên ngoài trong lúc giữ khoá làm mọi người xếp hàng, và nhiều khoá theo thứ tự khác nhau sinh deadlock. Optimistic không chặn ai nhưng khi contention cao thì phần lớn lần thử thất bại và phải làm lại, tốn hơn cả chờ.",
  },
  table: {
    head: ["", "Pessimistic (`FOR UPDATE`)", "Optimistic (`version`)", "Atomic update (`SET x = x - 1 WHERE x > 0`)"],
    rows: [
      {
        cells: ["Cơ chế", "Khoá dòng khi đọc, nhả khi commit/rollback", "Ghi có điều kiện `WHERE version = :v`, tăng version", "Một câu lệnh đọc-kiểm-ghi, DB tự khoá dòng trong câu lệnh"],
        why: "Cả ba đều dựa vào row lock của DB ở lúc ghi; khác nhau ở **thời gian giữ khoá**: suốt transaction, chỉ trong câu `UPDATE`, hay chỉ trong một câu lệnh duy nhất.",
      },
      {
        cells: ["Hợp khi", "Xung đột thường xuyên, transaction ngắn", "Xung đột hiếm, người dùng sửa lâu (form, giỏ hàng)", "Logic biểu diễn được bằng một câu SQL"],
        why: "Xung đột thường xuyên mà dùng optimistic thì phần lớn thời gian là thử lại; xung đột hiếm mà dùng pessimistic thì phần lớn thời gian là khoá vô ích. Form sửa 5 phút không thể giữ khoá DB 5 phút, nên optimistic là lựa chọn duy nhất hợp lý ở đó.",
      },
      {
        cells: ["Khi có contention", "Người sau chờ (hoặc lỗi ngay với `NOWAIT`)", "Người sau nhận 0 dòng, đọc lại và thử lại", "Người sau chờ vài mili giây rồi chạy trên giá trị mới"],
        why: "Câu atomic là lựa chọn rẻ nhất cho bộ đếm và tồn kho: không có khe giữa đọc và ghi, nên không cần version, không cần giữ khoá qua nhiều câu lệnh.",
      },
      {
        cells: ["Rủi ro chính", "Deadlock, khoá giữ lâu, cạn connection", "Retry storm khi nhiều người cùng sửa một dòng", "Chỉ dùng được khi điều kiện nằm gọn trong một dòng"],
        why: "Điều kiện liên quan nhiều dòng (\"tổng số ca trực còn lại ≥ 1\") là write skew: không câu `UPDATE` một dòng nào bắt được. Khi đó cần khoá các dòng tạo nên điều kiện hoặc Serializable (xem `db-isolation-anomalies`).",
      },
    ],
  },
  points: [
    {
      t: "**Row lock chỉ chặn người ghi và người khoá, không chặn người đọc thường**: trong PostgreSQL, `SELECT` thường vẫn đọc được dòng đang bị `FOR UPDATE`; chỉ khoá bảng `ACCESS EXCLUSIVE` mới chặn `SELECT` thường (https://www.postgresql.org/docs/current/explicit-locking.html).",
      why: "Người đọc thấy snapshot cũ nhờ MVCC nên không cần chờ. Hệ quả hay bị quên: đọc thường rồi tính toán rồi ghi **không** được bảo vệ bởi `FOR UPDATE` của người khác; muốn tham gia hàng chờ khoá thì chính bạn cũng phải đọc bằng `FOR UPDATE`.",
    },
    {
      t: "**Bốn mức row lock của PostgreSQL**, từ mạnh tới yếu: `FOR UPDATE` (do `DELETE` và `UPDATE` đổi cột khoá duy nhất lấy), `FOR NO KEY UPDATE` (do `UPDATE` thường lấy), `FOR SHARE`, `FOR KEY SHARE` (https://www.postgresql.org/docs/current/explicit-locking.html).",
      why: "Mức yếu cho phép nhiều việc chạy đồng thời hơn: `UPDATE` thường chỉ lấy `FOR NO KEY UPDATE`, mức này không chặn `FOR KEY SHARE` trên cùng dòng. Tự viết `FOR UPDATE` khi chỉ định sửa cột thường là khoá chặt hơn mức cần và chặn thêm những thao tác lẽ ra chạy được.",
    },
    {
      t: "**Deadlock**: T1 khoá dòng A rồi chờ B, T2 khoá B rồi chờ A. PostgreSQL tự phát hiện và huỷ một transaction; tài liệu nói không đoán trước được transaction nào bị huỷ. Phòng bằng cách **khoá theo thứ tự cố định** (ví dụ theo id tăng dần) và retry transaction bị huỷ.",
      why: "Không ai nhả khoá vì cả hai đang chờ, nên phải có bên ngoài cắt vòng. Thứ tự cố định làm vòng chờ không thể hình thành: ai cũng khoá A trước B thì người đến sau chờ ở A, không giữ gì mà người kia cần. Chuyển tiền giữa hai tài khoản là ví dụ kinh điển: luôn khoá tài khoản id nhỏ trước.",
    },
    {
      t: "**PostgreSQL chỉ kiểm deadlock sau `deadlock_timeout`** (mặc định `1s`), vì kiểm tra tốn kém (https://www.postgresql.org/docs/current/runtime-config-locks.html). Ngoài deadlock, chờ khoá là chờ vô hạn: `lock_timeout` và `statement_timeout` mặc định `0`, tức tắt (https://www.postgresql.org/docs/current/runtime-config-client.html).",
      why: "Một transaction giữ khoá rồi treo (app chờ API bên ngoài) làm mọi request cùng dòng chờ mãi, chiếm hết connection pool, rồi cả service ngừng. Đặt `lock_timeout` hợp lý cho request online để lỗi sớm và retry thay vì xếp hàng vô hạn.",
    },
    {
      t: "**`NOWAIT` và `SKIP LOCKED`**: `FOR UPDATE NOWAIT` báo lỗi ngay nếu dòng đang bị khoá; `FOR UPDATE SKIP LOCKED` bỏ qua dòng đang bị khoá. Tài liệu PostgreSQL nói `SKIP LOCKED` cho cái nhìn không nhất quán về dữ liệu, không dùng cho việc thông thường, nhưng hợp với nhiều consumer cùng lấy việc từ một bảng kiểu queue (https://www.postgresql.org/docs/current/sql-select.html).",
      why: "Mười worker cùng `SELECT … LIMIT 1 FOR UPDATE` thì cả mười xếp hàng sau cùng một dòng. Với `SKIP LOCKED`, worker thứ hai bỏ qua dòng worker một đang giữ và lấy dòng kế tiếp, nên mười worker chạy song song. Đổi lại, kết quả truy vấn thiếu những dòng đang bị khoá, nên không dùng cho báo cáo hay đếm.",
    },
    {
      t: "**Optimistic lock cài thế nào**: thêm cột `version` (hoặc `updated_at` đủ chính xác); đọc `version`; ghi `UPDATE t SET …, version = version + 1 WHERE id = ? AND version = ?`; kiểm số dòng bị ảnh hưởng. HTTP có sẵn cơ chế tương tự: `ETag` + `If-Match`, server trả `412 Precondition Failed` khi không khớp (RFC 9110 §13.1.1 — https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1).",
      why: "Điều kiện `version = ?` và việc ghi nằm trong cùng một câu, nên DB kiểm và ghi atomic dưới row lock; không có khe nào để người khác chen vào. Đưa version ra tới client qua `ETag` cho phép phát hiện xung đột cả khi hai người sửa cùng một tài liệu trên hai tab trình duyệt.",
    },
    {
      t: "**Advisory lock** (`pg_advisory_lock`, `pg_advisory_xact_lock`): khoá theo một số nguyên do app tự đặt nghĩa, không gắn với dòng nào. Mức session giữ tới khi tự nhả hoặc hết session, **kể cả sau rollback**; mức transaction tự nhả khi transaction kết thúc.",
      why: "Dùng khi cần khoá một khái niệm không có dòng tương ứng (\"chỉ một job đồng bộ tài khoản X chạy cùng lúc\") mà các instance đã dùng chung PostgreSQL, khỏi thêm Redis. Bẫy: advisory lock mức session đi qua connection pool có thể bị giữ lại trên connection trả về pool; ưu tiên mức transaction.",
    },
    {
      t: "**MySQL InnoDB khoá cả khoảng trống**: ở Repeatable Read (mặc định), tìm kiếm và quét index dùng **next-key lock** (khoá bản ghi + khoảng trống trước nó) để chặn phantom; ở Read Committed thì tắt gap lock cho tìm kiếm (https://dev.mysql.com/doc/refman/8.4/en/innodb-locking.html).",
      why: "`SELECT … WHERE c BETWEEN 10 AND 20 FOR UPDATE` trên InnoDB chặn cả việc **chèn** giá trị 15 chưa tồn tại, nên hai transaction chèn vào cùng khoảng có thể deadlock dù không đụng chung dòng nào. Câu lệnh giống hệt chạy trên PostgreSQL thì chỉ khoá các dòng đang có.",
    },
  ],
  sections: [
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Gọi API bên ngoài (PSP, email) trong khi đang giữ `FOR UPDATE`.",
          why: "Khoá giữ suốt thời gian gọi mạng, có thể vài giây hoặc tới timeout. Mọi request cùng dòng xếp hàng sau. Tách thành: khoá, ghi trạng thái \"đang xử lý\", commit; gọi API ngoài transaction; rồi transaction mới ghi kết quả.",
        },
        {
          t: "`FOR UPDATE` trên truy vấn không có index phù hợp.",
          why: "InnoDB đặt record lock lên mọi bản ghi index đã quét khi xử lý câu lệnh, kể cả dòng bị `WHERE` loại; không có index phù hợp thì quét cả bảng và mọi dòng bị khoá (https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html). Điều kiện của câu khoá nên đi theo PK hoặc index chọn lọc.",
        },
        {
          t: "Optimistic lock không xử lý trường hợp 0 dòng bị ảnh hưởng.",
          why: "ORM trả về \"thành công\" vì câu `UPDATE` chạy không lỗi, chỉ là không sửa dòng nào. Phải kiểm số dòng và báo xung đột (hoặc tự retry), nếu không thì thay đổi của user bị mất im lặng, đúng lỗi mà optimistic lock sinh ra để chặn.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"hai người cùng đặt ghế cuối\", trả lời theo bậc: câu atomic `UPDATE … WHERE status = 'available'` → nếu cần đọc rồi quyết định thì `FOR UPDATE` trong transaction ngắn → nếu giữ chỗ nhiều phút thì trạng thái \"held\" có hạn (không giữ khoá DB).",
      why: "Interviewer muốn thấy bạn chọn cơ chế hẹp nhất đủ dùng và biết khoá DB không được giữ qua thời gian suy nghĩ của user. Phần giữ chỗ có TTL dẫn sang `dist-lock` nếu cần.",
    },
    {
      t: "Nói \"lock trong một database trước, distributed lock chỉ khi tài nguyên không nằm trong một DB\".",
      why: "Row lock có sẵn transaction, tự nhả khi connection chết và không có vấn đề TTL hay GC pause. Distributed lock thêm một hệ thống và một loại lỗi mới, chỉ đáng khi tài nguyên trải trên nhiều kho.",
    },
    "Với bảng job kiểu queue trong PostgreSQL: `SELECT … FOR UPDATE SKIP LOCKED LIMIT n` là câu trả lời chuẩn cho nhiều worker cùng lấy việc.",
  ],
  cards: [
    [
      "Optimistic và pessimistic lock: chọn khi nào?",
      "Xung đột hiếm hoặc người dùng sửa lâu (form) → optimistic (version). Xung đột thường xuyên, transaction ngắn → pessimistic (`FOR UPDATE`). Logic gói được trong một câu SQL → atomic update, không cần cả hai.",
    ],
    [
      "Deadlock xảy ra thế nào và phòng ra sao?",
      "Hai transaction khoá tài nguyên theo thứ tự ngược nhau rồi chờ nhau. DB phát hiện và huỷ một bên. Phòng: khoá theo thứ tự cố định (id tăng dần), transaction ngắn, và retry khi bị huỷ.",
    ],
    [
      "`SKIP LOCKED` dùng để làm gì, vì sao không dùng cho mọi truy vấn?",
      "Cho nhiều worker lấy việc từ bảng kiểu queue mà không chờ nhau. Kết quả bỏ sót các dòng đang bị khoá nên không nhất quán; không dùng cho báo cáo, đếm hay kiểm tra điều kiện.",
    ],
    [
      "Dòng đang bị `FOR UPDATE`, một `SELECT` thường có bị chặn không (PostgreSQL)?",
      "Không. Row lock chỉ chặn người ghi và người khoá cùng dòng; người đọc thường thấy snapshot theo MVCC.",
    ],
    [
      "Optimistic lock phát hiện xung đột bằng cách nào?",
      "`UPDATE … SET version = version + 1 WHERE id = ? AND version = ?`; nếu số dòng bị ảnh hưởng là 0 thì có người đã sửa trước → đọc lại, hợp nhất hoặc báo user.",
    ],
    [
      "Vì sao không nên giữ `FOR UPDATE` khi gọi API thanh toán?",
      "Khoá bị giữ suốt thời gian gọi mạng; mọi request khác trên dòng đó xếp hàng, cạn connection pool. Commit trạng thái trung gian trước, gọi API ngoài transaction.",
    ],
  ],
  related: ["isolation", "seat", "deadlock"],
});
