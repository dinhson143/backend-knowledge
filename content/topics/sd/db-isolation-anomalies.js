BK.topic({
  id: "db-isolation-anomalies",
  track: "sd",
  section: "sd-core",
  title: "Transaction & isolation level",
  goal: "Nhận ra lost update, write skew và chọn isolation level chặn được nó",
  needs: ["core-db"],
  tldr: {
    t: "Isolation level quyết định transaction thấy gì từ các transaction chạy song song. Mức càng cao thì càng ít **anomaly** nhưng càng nhiều chờ hoặc lỗi phải retry. Mặc định **không** chặn hết: PostgreSQL mặc định Read Committed vẫn để lọt **lost update** (đọc–sửa–ghi ở app) và **write skew**; chỉ **Serializable** đảm bảo kết quả như chạy lần lượt.",
    why: "Mặc định được chọn cho hiệu năng: chặn mọi anomaly nghĩa là phải khoá nhiều hoặc huỷ transaction khi phát hiện xung đột. Vì vậy app phải tự biết đoạn code nào là đọc–kiểm tra–ghi, rồi chọn công cụ: ghi tương đối, khoá dòng, version, hay nâng level cho riêng transaction đó.",
  },
  story: {
    problem: "Hai request rút tiền chạy song song, cùng đọc số dư 100, mỗi bên trừ trong code rồi ghi lại: một lần rút biến mất. Hai bác sĩ cùng xin nghỉ, mỗi người kiểm tra \"còn người khác trực\" rồi cùng được duyệt: ca trực trống. Không có lỗi nào được báo, test đơn luồng đều xanh.",
    idea: "Gọi đúng tên anomaly rồi chọn biện pháp rẻ nhất chặn được nó. Cùng một dòng bị ghi đè (lost update): ghi tương đối, `SELECT … FOR UPDATE`, version, hoặc Repeatable Read của PostgreSQL. Hai dòng khác nhau dựa trên cùng một điều kiện (write skew): Serializable, khoá tường minh, hoặc biến điều kiện thành constraint.",
    tradeoff: "Level cao hơn hoặc khoá nhiều hơn làm giảm song song: transaction chờ nhau, deadlock nhiều hơn, hoặc bị huỷ với lỗi serialization và app phải retry toàn bộ transaction. Mỗi DB cài cùng một tên level theo cách khác nhau, nên phải nói rõ đang nói về DB nào.",
  },
  table: {
    head: ["Level (PostgreSQL)", "Dirty read", "Non-repeatable read", "Phantom", "Serialization anomaly"],
    rows: [
      {
        cells: ["Read Uncommitted", "Không (chạy như Read Committed)", "Có thể", "Có thể", "Có thể"],
        why: "PostgreSQL nhận cả bốn tên level của chuẩn SQL nhưng chỉ cài ba; Read Uncommitted chạy như Read Committed vì đó là cách hợp lý duy nhất trên kiến trúc MVCC (https://www.postgresql.org/docs/current/transaction-iso.html).",
      },
      {
        cells: ["Read Committed (mặc định)", "Không", "Có thể", "Có thể", "Có thể"],
        why: "Mỗi **câu lệnh** thấy dữ liệu đã commit trước khi câu lệnh đó bắt đầu, nên hai lần `SELECT` trong cùng transaction có thể thấy hai giá trị khác nhau. Đủ cho đa số thao tác một câu lệnh, không đủ cho đọc–kiểm tra–ghi.",
      },
      {
        cells: ["Repeatable Read", "Không", "Không", "Không (chuẩn SQL cho phép, PostgreSQL chặn)", "Có thể"],
        why: "Cả transaction nhìn một snapshot chốt ở câu lệnh đầu tiên. Ghi vào dòng mà transaction khác đã sửa sau thời điểm snapshot thì nhận lỗi `could not serialize access due to concurrent update` và phải retry; nhờ vậy lost update bị chặn. Write skew vẫn lọt vì hai bên ghi hai dòng khác nhau.",
      },
      {
        cells: ["Serializable", "Không", "Không", "Không", "Không"],
        why: "Chạy như Repeatable Read cộng thêm theo dõi phụ thuộc đọc–ghi giữa các transaction; thấy nguy cơ ra kết quả không khớp thứ tự lần lượt nào thì huỷ một bên với lỗi serialization (SQLSTATE `40001`). Không thêm chờ so với Repeatable Read, nhưng có chi phí theo dõi và chi phí retry.",
      },
    ],
  },
  points: [
    {
      t: "**Bốn hiện tượng chuẩn** (định nghĩa theo tài liệu PostgreSQL): **dirty read** đọc dữ liệu chưa commit; **non-repeatable read** đọc lại một dòng thấy đã bị sửa bởi transaction đã commit; **phantom** chạy lại một truy vấn theo điều kiện thấy tập dòng đã thay đổi; **serialization anomaly** kết quả commit không khớp với bất kỳ thứ tự chạy lần lượt nào.",
      why: "Chuẩn SQL định nghĩa level bằng các hiện tượng bị cấm. Bài báo \"A Critique of ANSI SQL Isolation Levels\" (Berenson và cộng sự, SIGMOD 1995) chỉ ra ba hiện tượng đó không đủ để mô tả các level thực tế và định nghĩa snapshot isolation (https://arxiv.org/abs/cs/0701157). Đó là lý do lost update và write skew, hai lỗi hay gặp nhất, không có tên trong bảng chuẩn.",
    },
    {
      t: "**Lost update**: hai transaction cùng đọc một giá trị, tính giá trị mới trong code, rồi ghi đè **cùng một dòng**; lần ghi sau xoá mất lần ghi trước.",
      why: "DB chỉ thấy hai lệnh `UPDATE balance = 70` và `UPDATE balance = 50` hợp lệ; nó không biết 70 và 50 được tính từ cùng một số 100 đã cũ. Read Committed không chặn vì mỗi câu lệnh chỉ cần dữ liệu đã commit, và cả hai số đọc được đều đã commit.",
    },
    {
      t: "**Chữa lost update**, từ rẻ tới đắt: ghi tương đối `SET balance = balance - 50` (DB tính trên bản mới nhất); `SELECT … FOR UPDATE` khoá dòng khi đọc; optimistic lock `UPDATE … WHERE id = ? AND version = ?` rồi kiểm số dòng bị ảnh hưởng; hoặc Repeatable Read của PostgreSQL và retry khi lỗi.",
      why: "Ghi tương đối gộp đọc và ghi vào một câu lệnh atomic nên không còn khe hở. `FOR UPDATE` bắt transaction thứ hai chờ tới khi transaction đầu xong rồi mới đọc. Version phát hiện xung đột lúc ghi (0 dòng bị ảnh hưởng) mà không giữ khoá, hợp khi xung đột hiếm, ví dụ form chỉnh sửa người dùng mở lâu.",
    },
    {
      t: "**Write skew**: hai transaction cùng đọc một **điều kiện** (\"còn ≥ 2 bác sĩ trực\"), rồi mỗi bên ghi vào một **dòng khác nhau** dựa trên điều kiện đó; mỗi bên đúng khi chạy một mình, chạy cùng nhau thì phá luật.",
      why: "Snapshot isolation (Repeatable Read của PostgreSQL) chỉ phát hiện hai transaction **ghi cùng một dòng**. Ở write skew không ai ghi đè ai, nên không có xung đột nào để phát hiện. Tài liệu PostgreSQL nói thẳng: muốn ép luật nghiệp vụ ở Repeatable Read thì gần như phải dùng khoá tường minh.",
    },
    {
      t: "**Chữa write skew**: chạy transaction đó ở **Serializable** và retry khi gặp lỗi `40001`; hoặc khoá các dòng tạo nên điều kiện (`SELECT … FROM shifts WHERE … FOR UPDATE`); hoặc biến điều kiện thành constraint (unique, exclusion constraint) để DB tự kiểm tra.",
      why: "Serializable là cách tổng quát nhất: tài liệu PostgreSQL gợi ý nếu một transaction viết ra đúng khi chạy một mình thì chạy ở Serializable cũng đúng khi chạy cùng các transaction Serializable khác. Khoá tường minh nhanh hơn nhưng dễ sót: điều kiện dạng \"chưa có dòng nào\" (đặt phòng trùng giờ) không có dòng để khoá, khi đó cần constraint hoặc Serializable.",
    },
    {
      t: "**Phải retry nguyên transaction** khi nhận lỗi serialization: chạy lại từ đầu, không chỉ câu lệnh lỗi. PostgreSQL: lần chạy lại sẽ thấy thay đổi đã commit trong snapshot mới; transaction chỉ đọc không bao giờ gặp lỗi này ở Repeatable Read.",
      why: "Các giá trị đã đọc trước đó được tính trên snapshot cũ, nên chỉ chạy lại câu lỗi vẫn dùng dữ liệu cũ. Code dùng Repeatable Read hay Serializable mà không có vòng retry sẽ biến xung đột bình thường thành lỗi `500` cho user.",
    },
    {
      t: "**MySQL InnoDB khác PostgreSQL dù cùng tên level.** Mặc định của InnoDB là **Repeatable Read**: `SELECT` thường đọc snapshot, nhưng `UPDATE`, `DELETE` và `SELECT … FOR UPDATE` làm việc trên bản đã commit mới nhất và dùng gap/next-key lock để chặn chèn vào khoảng đang quét (https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html).",
      why: "Tài liệu InnoDB nói snapshot áp cho `SELECT`, không nhất thiết cho lệnh ghi: một `UPDATE` có thể sửa cả dòng mà transaction không `SELECT` thấy (https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html). Vì vậy đọc snapshot rồi ghi giá trị tuyệt đối không bị báo lỗi như ở PostgreSQL; vẫn phải dùng ghi tương đối hoặc `FOR UPDATE` để chặn lost update. Serializable của InnoDB đổi `SELECT` thường thành `SELECT … FOR SHARE` (khi tắt autocommit), tức chặn bằng khoá chứ không bằng phát hiện xung đột.",
    },
  ],
  table2Title: "Anomaly nào, chặn bằng gì",
  table2: {
    head: ["Anomaly", "Ví dụ", "Chặn được bằng"],
    rows: [
      ["Dirty read", "Đọc số dư 0 của giao dịch rồi bị rollback", "Read Committed trở lên (mọi DB phổ biến mặc định đã chặn)"],
      ["Non-repeatable read", "Báo cáo đọc một dòng hai lần ra hai số", "Repeatable Read (snapshot)"],
      ["Phantom", "Đếm đơn hai lần trong một transaction, lần hai có thêm đơn mới", "PostgreSQL: Repeatable Read; InnoDB: next-key lock khi đọc có khoá"],
      { cells: ["Lost update", "Hai lần rút tiền đọc–sửa–ghi cùng số dư", "Ghi tương đối, `FOR UPDATE`, version; PostgreSQL Repeatable Read + retry"], why: "Biện pháp ở tầng câu lệnh (ghi tương đối, version) chạy được trên mọi DB và mọi level, nên là lựa chọn đầu tiên. Nâng level chỉ khi logic đọc–sửa–ghi quá phức tạp để gộp vào một câu lệnh." },
      { cells: ["Write skew", "Hai bác sĩ cùng nghỉ; hai người đặt cùng phòng cùng giờ", "Serializable + retry, khoá các dòng của điều kiện, constraint"], why: "Write skew sinh ra từ việc đọc một tập dòng rồi ghi một dòng khác, nên chỉ chặn được khi DB biết về **phụ thuộc đọc–ghi** (Serializable) hoặc khi app khoá chính tập dòng đã đọc." },
    ],
  },
  tips: [
    {
      t: "Khi thiết kế luồng \"kiểm tra rồi ghi\" (còn hàng không, còn chỗ không, đủ tiền không), nói rõ nó gặp anomaly nào và chặn bằng gì, thay vì chỉ nói \"dùng transaction\".",
      why: "Transaction ở mức mặc định **không** chặn lost update và write skew. Interviewer hay hỏi \"hai request đến cùng lúc thì sao?\" để kiểm tra bạn có biết điều đó.",
    },
    {
      t: "Ưu tiên biện pháp hẹp nhất: một câu `UPDATE … WHERE stock >= 1` atomic thường tốt hơn nâng cả hệ thống lên Serializable.",
      why: "Câu lệnh điều kiện vừa kiểm tra vừa ghi trong một bước, không cần retry, không giảm song song của các luồng khác. Nâng level toàn cục làm mọi transaction trả giá cho vài chỗ cần.",
    },
    "Xem bài Ticket Booking và sim Hai người tranh ghế cuối cùng để thấy cùng bài toán ở mức hệ thống phân tán.",
  ],
  cards: [
    [
      "Read Committed có chặn lost update không?",
      "Không. Hai transaction cùng đọc giá trị đã commit, tính trong app rồi ghi đè nhau. Chặn bằng ghi tương đối, `FOR UPDATE`, version, hoặc Repeatable Read của PostgreSQL (lỗi + retry).",
    ],
    [
      "Write skew là gì? Ví dụ?",
      "Hai transaction đọc cùng một điều kiện rồi ghi vào hai dòng khác nhau, phá luật chung. Ví dụ: luật ≥ 1 bác sĩ trực, hai bác sĩ cùng xin nghỉ, cả hai đều thấy còn 2 người.",
    ],
    [
      "Vì sao Repeatable Read (snapshot) không chặn write skew?",
      "Snapshot isolation chỉ phát hiện xung đột khi hai transaction ghi cùng một dòng. Write skew ghi hai dòng khác nhau, nên không có xung đột ghi–ghi để phát hiện.",
    ],
    [
      "Nhận lỗi SQLSTATE `40001` thì app làm gì?",
      "Rollback và chạy lại **toàn bộ** transaction từ đầu, vì mọi giá trị đã đọc thuộc snapshot cũ. Cần vòng retry có giới hạn.",
    ],
    [
      "PostgreSQL Repeatable Read và MySQL InnoDB Repeatable Read khác nhau ở đâu khi ghi?",
      "PostgreSQL: ghi vào dòng đã bị sửa sau snapshot thì báo lỗi serialization. InnoDB: `UPDATE` làm việc trên bản commit mới nhất, không báo lỗi, nên đọc snapshot rồi ghi giá trị tuyệt đối vẫn mất cập nhật.",
    ],
    [
      "Đặt phòng họp: kiểm tra \"không có lịch trùng giờ\" rồi insert. Khoá `FOR UPDATE` có đủ không?",
      "Không chắc: điều kiện \"chưa có dòng nào\" không có dòng để khoá. Dùng exclusion constraint, Serializable + retry, hoặc khoá một dòng đại diện (bản ghi phòng).",
    ],
  ],
  related: ["seat", "deadlock", "redis-atomic"],
});
