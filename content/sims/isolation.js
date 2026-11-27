BK.sim({
  id: "isolation",
  title: "Isolation levels: dirty read, non-repeatable read và snapshot",
  topics: ["core-db"],
  scenario: "Hai transaction cùng đụng vào số dư tài khoản 100.",
  context: "**Isolation level** quyết định một transaction thấy gì từ thay đổi của transaction khác: thay đổi chưa commit, thay đổi đã commit giữa chừng, hay chỉ một snapshot cố định. Hai transaction **T1** và **T2** chạy đồng thời trên cùng row `balance=100`; mỗi variant là một level và anomaly mà nó cho phép hoặc chặn. Theo dõi dòng dưới T1 (T1 đã đọc được gì) so với dòng dưới Database (giá trị thật đang có).",
  nodes: [
    { id: "T1", x: 120, y: 65, label: "Transaction T1" },
    { id: "db", x: 470, y: 145, label: "Database", s: "balance=100" },
    { id: "T2", x: 120, y: 225, label: "Transaction T2" },
  ],
  variants: [
    {
      name: "Read Uncommitted",
      steps: [
        {
          note: "T2 trừ hết tiền nhưng **chưa COMMIT**.",
          msgs: [["T2", "db", "UPDATE balance=0"]],
          set: { db: "balance=0 (chưa commit)" },
          detail: "T2 chạy `UPDATE balance=0` nhưng chưa `COMMIT`, nên row trong DB mang giá trị 0 **tạm**. Giá trị này chỉ thành thật khi T2 commit, và có thể bị huỷ bất cứ lúc nào.",
        },
        {
          note: "T1 đọc được giá trị chưa commit.",
          msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "0", "warn"]],
          set: { T1: "thấy 0" },
          detail: "T1 đọc được số 0 chưa commit của T2 — **dirty read**. Ở Read Uncommitted, `SELECT balance` của T1 không bị chặn và không nhận bản đã commit cũ: DB trả thẳng giá trị đang nằm trên row. T1 có thể dựa vào số 0 này để từ chối giao dịch, gửi cảnh báo \"hết tiền\", hoặc ghi xuống bảng khác.",
        },
        {
          note: "T2 lỗi và **ROLLBACK**.",
          msgs: [["T2", "db", "ROLLBACK", "err"]],
          set: { db: "balance=100" },
          detail: "T2 gặp lỗi (vi phạm constraint, deadlock, hoặc app chủ động huỷ) và `ROLLBACK`; DB dùng undo log khôi phục row về `balance=100`. Từ góc nhìn DB, số 0 **chưa bao giờ tồn tại**.",
        },
        {
          note: "T1 đã ra quyết định dựa trên số 0 **chưa từng tồn tại**.",
          bad: ["T1"],
          lesson: "Dirty read — chỉ Read Uncommitted cho phép.",
          detail: "T1 đã ra quyết định dựa trên một giá trị không bao giờ có thật: có thể đã từ chối thanh toán hợp lệ, hoặc tệ hơn đã ghi số 0 sang nơi khác. Không cơ chế nào báo cho T1 rằng dữ liệu nó đọc đã bị huỷ — lỗi **im lặng** và lan sang dữ liệu khác. Thực tế hiếm ai dùng Read Uncommitted; PostgreSQL thậm chí không hỗ trợ (đặt RU vẫn chạy như Read Committed), nên dirty read chỉ xảy ra trên DB như MySQL/SQL Server khi chủ động hạ level.",
        },
      ],
    },
    {
      name: "Read Committed",
      steps: [
        {
          note: "T1 đọc số dư lần 1.",
          msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100", "ok"]],
          set: { T1: "lần 1: 100" },
          detail: "T1 mở transaction và `SELECT balance`, nhận 100. Ở Read Committed, **mỗi câu lệnh** lấy snapshot mới của dữ liệu đã commit tại thời điểm câu lệnh bắt đầu — không phải một snapshot cho cả transaction.",
        },
        {
          note: "T2 trừ 50 và COMMIT.",
          msgs: [["T2", "db", "UPDATE −50; COMMIT"]],
          set: { db: "balance=50" },
          detail: "T2 chạy `UPDATE balance = balance - 50` và `COMMIT`; DB giờ `balance=50`. T2 không bị T1 chặn vì T1 chỉ đọc, không giữ lock trên row.",
        },
        {
          note: "T1 đọc lại trong **cùng transaction** → ra số khác.",
          msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "50", "warn"]],
          set: { T1: "lần 1: 100 · lần 2: 50" },
          bad: ["T1"],
          lesson: "Non-repeatable read — Read Committed (mặc định PostgreSQL) vẫn cho phép.",
          detail: "T1 đọc lại trong **cùng transaction** và nhận 50 — hai số khác nhau cho cùng một row: **non-repeatable read**. Câu lệnh mới lấy snapshot mới nên thấy bản đã commit của T2. Không có dirty read (50 là giá trị đã commit thật), nhưng logic kiểu \"đọc số dư, kiểm tra, rồi đọc lại để tính\" sẽ ra kết quả mâu thuẫn — ví dụ báo cáo cộng tổng sai vì các dòng được đọc ở các thời điểm khác nhau. Read Committed là mặc định của PostgreSQL, Oracle, SQL Server.",
        },
      ],
    },
    {
      name: "Repeatable Read",
      steps: [
        {
          note: "T1 đọc số dư lần 1 và giữ **snapshot**.",
          msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100", "ok"]],
          set: { T1: "lần 1: 100" },
          detail: "T1 `SELECT balance` lần đầu, nhận 100, và DB tạo **một snapshot cho cả transaction** (trong PostgreSQL và MySQL InnoDB, snapshot chốt ở câu lệnh đọc đầu tiên). Mọi lần đọc sau của T1 đều nhìn qua snapshot này.",
        },
        {
          note: "T2 trừ 50 và COMMIT.",
          msgs: [["T2", "db", "UPDATE −50; COMMIT"]],
          set: { db: "balance=50 (bản mới)" },
          detail: "T2 trừ 50 và commit mà không bị chặn, không phải chờ T1. Nhờ **MVCC**, DB không ghi đè row cũ mà tạo **phiên bản mới** `balance=50` đánh dấu bằng transaction id của T2; phiên bản 100 cũ vẫn giữ lại cho các transaction còn cần.",
        },
        {
          note: "T1 đọc lại từ snapshot → vẫn 100, nhất quán trong transaction.",
          msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100 (snapshot)", "ok"]],
          set: { T1: "lần 1: 100 · lần 2: 100" },
          good: ["T1"],
          lesson: "Repeatable Read (mặc định MySQL) chặn non-repeatable read nhờ MVCC snapshot.",
          detail: "T1 đọc lại vẫn thấy 100 — nhất quán trong suốt transaction. DB chọn phiên bản row nhìn thấy được từ snapshot của T1, tức bản 100, vì T2 commit sau thời điểm snapshot. Lưu ý: 100 đã là dữ liệu cũ so với DB thật. Nếu T1 tiếp tục `UPDATE` row này dựa trên số 100, PostgreSQL báo lỗi serialization và buộc retry, còn MySQL ghi lên bản mới nhất (UPDATE đọc bản hiện tại) — tính sai ở tầng app vẫn có thể gây **lost update** nếu không dùng `SELECT … FOR UPDATE`. Repeatable Read là mặc định của MySQL InnoDB.",
        },
      ],
    },
  ],
});
