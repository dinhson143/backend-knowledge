BK.sim({
  id: "seat",
  title: "Hai người tranh ghế cuối cùng",
  topics: ["patterns"],
  scenario: "Alice và Bob cùng bấm đặt ghế A1 trong cùng một mili-giây.",
  context: "Nếu cả Alice và Bob đọc “ghế trống” rồi cùng ghi, ghế A1 sẽ bị **bán hai lần** (lost update). Hai người đặt cùng một mili-giây; hai request chạy song song trên Booking API và cùng chạm một dòng trong DB. Hai cách chặn: **optimistic lock** (không khoá, kiểm tra cột `version` lúc ghi) và **pessimistic lock** (khoá dòng ngay khi đọc bằng `SELECT … FOR UPDATE`). Theo dõi trạng thái dòng A1 dưới DB: người giữ ghế, `v` và biểu tượng khoá.",
  nodes: [
    { id: "alice", x: 90, y: 65, label: "Alice" },
    { id: "bob", x: 90, y: 225, label: "Bob" },
    { id: "api", x: 350, y: 145, label: "Booking API" },
    { id: "db", x: 640, y: 145, label: "DB", s: "A1: free · v=1" },
  ],
  variants: [
    {
      name: "Optimistic lock",
      steps: [
        {
          note: "Hai request tới cùng lúc.",
          msgs: [{ par: [["alice", "api", "book A1"], ["bob", "api", "book A1"]] }],
          detail: "Hai request `book A1` tới Booking API gần như cùng lúc, xử lý trên hai thread/transaction khác nhau. Không có thứ tự nào được đảm bảo giữa chúng.",
        },
        {
          note: "Cả hai đọc thấy ghế trống, `v=1`. Không ai bị khoá.",
          msgs: [
            { par: [["api", "db", "SELECT (Alice)"], ["api", "db", "SELECT (Bob)"]] },
            { par: [["db", "api", "free · v=1", "ok"], ["db", "api", "free · v=1", "ok"]] },
          ],
          detail: "Cả hai đều tin mình đặt được ghế: hai transaction chạy `SELECT status, version FROM seats WHERE id='A1'` và cùng nhận `free · v=1`. Đọc thông thường không lấy lock nên không ai phải chờ. Nếu bước sau chỉ là `UPDATE … SET owner=?` thì người ghi sau âm thầm đè người ghi trước, và cả hai cùng nhận vé.",
        },
        {
          note: "Alice ghi trước: `UPDATE … SET v=2 WHERE v=1` → 1 row.",
          msgs: [["api", "db", "UPDATE WHERE v=1 (Alice)"], ["db", "api", "1 row ✓", "ok"]],
          set: { db: "A1: Alice · v=2" },
          detail: "Alice thắng: `UPDATE seats SET owner='Alice', v=2 WHERE id='A1' AND v=1` khớp điều kiện `v=1`, nên DB cập nhật **1 row** và tăng version lên 2. Bản thân UPDATE vẫn khoá dòng tới khi transaction kết thúc, nên hai UPDATE đồng thời trên cùng dòng luôn chạy tuần tự.",
        },
        {
          note: "Bob ghi `WHERE v=1` → **0 row** vì version đã là 2.",
          msgs: [["api", "db", "UPDATE WHERE v=1 (Bob)"], ["db", "api", "0 rows", "err"]],
          detail: "Bob cập nhật **0 row** (ở Read Committed, mặc định của PostgreSQL; ở Repeatable Read, PostgreSQL báo lỗi `could not serialize access due to concurrent update` thay vì 0 row — https://www.postgresql.org/docs/current/transaction-iso.html): cùng câu lệnh `WHERE v=1`, nhưng version giờ là 2 nên điều kiện sai. Không có lỗi SQL nào; API phải **kiểm tra số row bị ảnh hưởng** để biết mình thua. Quên kiểm tra là lỗi kinh điển: code coi như đặt thành công và Bob nhận vé ảo.",
        },
        {
          note: "Bob nhận 409, client báo “ghế đã có người đặt”.",
          msgs: [{ par: [["api", "alice", "200 Booked", "ok"], ["api", "bob", "409 Conflict", "err"]] }],
          set: { alice: "✓ có ghế", bob: "409" },
          lesson: "Optimistic: không khoá, kiểm tra version khi ghi. Hợp khi xung đột hiếm.",
          detail: "API trả `200 Booked` cho Alice và `409 Conflict` cho Bob; client hiện “ghế đã có người đặt” để Bob chọn ghế khác. Optimistic lock không giữ lock trong lúc chờ nên throughput cao, hợp khi xung đột hiếm. Khi tranh chấp cao (ví dụ 10k người cùng giành ghế hot), phần lớn request thất bại và retry, tốn công vô ích.",
        },
      ],
    },
    {
      name: "Pessimistic lock",
      steps: [
        {
          note: "Hai request tới cùng lúc.",
          msgs: [{ par: [["alice", "api", "book A1"], ["bob", "api", "book A1"]] }],
          detail: "Cùng hai request `book A1` tới song song như variant trước.",
        },
        {
          note: "Alice tới trước: `SELECT … FOR UPDATE` **khoá dòng** A1.",
          msgs: [["api", "db", "FOR UPDATE (Alice)"], ["db", "api", "free 🔒", "ok"]],
          set: { db: "A1: free · 🔒 Alice" },
          detail: "Alice khoá dòng A1 ngay khi đọc: `SELECT … WHERE id='A1' FOR UPDATE` đặt **row lock độc quyền** lên A1 tới khi transaction kết thúc. Alice thấy ghế trống và biết chắc không ai đổi được nó trong lúc mình xử lý.",
        },
        {
          note: "Bob cũng `FOR UPDATE` → bị **block**, phải chờ.",
          msgs: [["api", "db", "FOR UPDATE (Bob)", "warn"]],
          set: { bob: "⏳ chờ lock" },
          detail: "Bob bị DB **block**: cùng câu `FOR UPDATE`, transaction của Bob đứng chờ lock của Alice, giữ nguyên connection DB và thread của API. Nếu Alice giữ lock lâu (ví dụ gọi payment gateway bên trong transaction), Bob và mọi người phía sau xếp hàng tới khi hết `innodb_lock_wait_timeout` (MySQL, mặc định 50s — https://dev.mysql.com/doc/refman/8.4/en/innodb-parameters.html); PostgreSQL mặc định `lock_timeout = 0` nên chờ không giới hạn (https://www.postgresql.org/docs/current/runtime-config-client.html).",
        },
        {
          note: "Alice UPDATE và COMMIT → nhả lock.",
          msgs: [["api", "db", "UPDATE; COMMIT"], ["api", "alice", "200 Booked", "ok"]],
          set: { db: "A1: Alice", alice: "✓ có ghế" },
          detail: "Alice `UPDATE seats SET owner='Alice'` rồi `COMMIT`; commit nhả lock, API trả `200 Booked` cho Alice. Dòng A1 giờ thuộc Alice.",
        },
        {
          note: "Bob chạy tiếp, thấy ghế đã bán.",
          msgs: [["db", "api", "sold (Bob)", "err"], ["api", "bob", "409 Conflict", "err"]],
          set: { bob: "409" },
          lesson: "Pessimistic: đúng tuyệt đối nhưng request phải xếp hàng — dễ nghẽn khi tranh chấp cao.",
          detail: "Bob nhận `409 Conflict`: lock được nhả nên `FOR UPDATE` của Bob chạy tiếp, đọc **phiên bản mới nhất đã commit** (locking read không dùng snapshot cũ) và thấy ghế đã thuộc Alice. Kết quả luôn đúng, nhưng các request tranh cùng dòng phải chạy **tuần tự**, nên khi tranh chấp cao sẽ nghẽn connection pool; ngoài ra khoá nhiều dòng theo thứ tự khác nhau có thể gây deadlock.",
        },
      ],
    },
  ],
});
