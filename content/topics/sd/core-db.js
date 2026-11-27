BK.topic({
  id: "core-db",
  track: "sd",
  section: "sd-tech",
  title: "SQL hay NoSQL?",
  tldr: {
    t: "SQL cho quan hệ phức tạp + transaction ACID. NoSQL cho scale ngang, schema linh hoạt, big data / realtime.",
    why: "SQL mạnh khi quan hệ phức tạp nhưng khó chia ra nhiều máy, vì transaction ACID và JOIN cần mọi dữ liệu liên quan nằm chung chỗ để khoá và kiểm tra cùng lúc. NoSQL scale ngang tự nhiên cho dữ liệu lớn và tải ghi cao, vì mỗi item tự đủ và phân tán theo key.",
  },
  story: {
    problem: "Chọn sai nơi lưu dữ liệu thì trả giá lâu dài: dùng NoSQL cho đơn hàng cần transaction nhiều bản ghi thì phải chịu giới hạn của transaction NoSQL (số item, phạm vi, độ trễ) hoặc tự xử lý ghi dở dang; dùng một Postgres cho 1 triệu write/s thì không máy nào chịu nổi.",
    idea: "SQL đặt tính đúng lên trước: schema, FK và ACID để nhiều bảng luôn nhất quán. NoSQL nới các đảm bảo đó (ít JOIN, transaction hạn chế, thường eventual) để dữ liệu chia ra nhiều máy dễ dàng, đổi lấy scale ngang và write throughput.",
    tradeoff: "SQL scale ngang khó, vì JOIN và transaction trải qua nhiều máy rất đắt. NoSQL scale dễ nhưng đẩy phần đảm bảo nhất quán và JOIN lên code ứng dụng, và buộc thiết kế schema theo query từ đầu.",
  },
  table: {
    head: ["", "Relational (SQL)", "NoSQL"],
    rows: [
      {
        cells: ["Data model", "Bảng, schema cố định, FK", "Key-value, document, column-family, graph"],
        why: "SQL chuẩn hoá dữ liệu thành nhiều bảng nối bằng FK để mỗi thông tin chỉ lưu một chỗ — sửa một nơi là đúng mọi nơi. NoSQL lưu theo hình dạng query cần (cả object trong một document, hoặc một key) → đọc một lần là đủ nhưng dữ liệu có thể bị lặp.",
      },
      {
        cells: ["Transaction", "ACID, nhiều bảng tuỳ ý", "Có nhưng giới hạn (số item, phạm vi, độ trễ); đọc thường eventual"],
        why: "ACID trên một node dễ vì chỉ có một bộ quản lý lock và log. Với NoSQL, dữ liệu nằm trên nhiều replica/node, strong consistency phải chờ đồng thuận giữa các node nên tăng latency → nhiều hệ chọn eventual mặc định và cho bật strong khi cần (DynamoDB strongly consistent read). Transaction thì đã có nhưng bị giới hạn: DynamoDB `TransactWriteItems` tối đa 100 item, 4 MB, trong một account và một region (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html); MongoDB có transaction nhiều document nhưng tốn hơn ghi một document và không thay được thiết kế schema tốt (https://www.mongodb.com/docs/manual/core/transactions/).",
      },
      {
        cells: [
          "Scale",
          "Dọc trước; ngang bằng read replica / sharding",
          "Ngang tự nhiên qua consistent hashing / sharding",
        ],
        why: "SQL thường nâng cấp máy trước, rồi thêm read replica cho tải đọc, vì nó dựa vào JOIN và transaction giữa nhiều bảng — chia bảng ra nhiều máy thì các thao tác đó thành distributed. NoSQL thiết kế quanh partition key nên mỗi item thuộc đúng một node; thêm node chỉ cần chuyển một phần key nhờ consistent hashing.",
      },
      {
        cells: ["Index", "B-Tree, Hash", "Hash table, B-Tree, LSM-Tree"],
        why: "B-Tree ghi tại chỗ nên đọc nhanh, nhưng mỗi lần ghi là ghi ngẫu nhiên lên đĩa. LSM-Tree (Cassandra, RocksDB) ghi rất nhanh vì gom ghi vào memtable rồi flush tuần tự ra file; đổi lại đọc có thể phải xem nhiều file và tốn compaction ở nền.",
      },
      {
        cells: [
          "Chọn khi",
          "Quan hệ phức tạp, cần JOIN, cần ACID",
          "Big data, realtime web app, schema linh hoạt, write cực lớn",
        ],
        why: "Cần JOIN và ACID (đơn hàng, thanh toán, đặt vé) → SQL, vì nó làm sẵn những thứ khó tự viết. Big data, write cực lớn hoặc schema hay đổi → NoSQL hợp hơn, vì scale ngang dễ và không cần migration khi thêm field.",
      },
    ],
  },
  points: [
    {
      t: "**ACID — Atomicity** — mọi câu lệnh trong transaction thành công hết, lỗi một câu là rollback toàn bộ.",
      why: "Kết quả chỉ có hai trạng thái — tất cả hoặc không gì — vì DB ghi mọi thay đổi vào log, chỉ áp dụng khi có COMMIT, lỗi giữa chừng thì dùng log để hoàn tác. Ví dụ chuyển tiền gồm trừ A và cộng B; chỉ chạy được câu đầu thì tiền biến mất.",
    },
    {
      t: "**ACID — Consistency** — sau transaction dữ liệu vẫn thoả mọi constraint (PK, FK, unique).",
      why: "Không bao giờ lưu được trạng thái như booking trỏ tới event không tồn tại, vì DB kiểm tra mọi constraint trước khi commit, vi phạm thì huỷ transaction. Constraint ở DB có hiệu lực với mọi client, kể cả script chạy tay, không phụ thuộc code ứng dụng.",
    },
    {
      t: "**ACID — Isolation** — transaction đồng thời không thấy dữ liệu tạm của nhau.",
      why: "Thiếu isolation, transaction B có thể đọc số dư mà A mới trừ rồi A rollback → B ra quyết định trên dữ liệu không bao giờ tồn tại. DB dùng lock hoặc MVCC (mỗi transaction đọc một snapshot) để cô lập; mạnh tới đâu tuỳ isolation level.",
    },
    {
      t: "**ACID — Durability** — commit xong là nằm trên đĩa, mất điện cũng không mất.",
      why: "Mất điện xong khởi động lại vẫn replay được log, vì DB ghi thay đổi vào WAL và `fsync` xuống đĩa trước khi báo commit thành công. Cái giá: mỗi commit chờ một lần flush đĩa → batch commit hoặc group commit giúp tăng throughput.",
    },
    {
      t: "**SQL joins** — INNER (chỉ dòng khớp), LEFT/RIGHT (giữ toàn bộ một bên, bên kia NULL), FULL (giữ cả hai), CROSS (tích Descartes).",
      why: "Các loại JOIN khác nhau ở cách xử lý dòng không khớp: INNER bỏ đi, LEFT giữ dòng bên trái và điền NULL — hợp với câu kiểu “mọi user kể cả chưa có đơn”. CROSS ghép mọi cặp nên 1000 × 1000 thành 1 triệu dòng, hiếm khi dùng ngoài sinh tổ hợp.",
    },
    {
      t: "+ Ví dụ: PostgreSQL / MySQL (SQL); DynamoDB, Cassandra, MongoDB (NoSQL).",
      why: "Nhắc tên cụ thể giúp câu trả lời có trọng lượng: DynamoDB/Cassandra là key-value/wide-column cho write lớn, MongoDB là document cho schema linh hoạt. Mỗi cái có mô hình dữ liệu riêng nên nói “dùng NoSQL” chung chung là chưa đủ.",
    },
  ],
  table2Title: "Isolation levels",
  table2: {
    head: ["Isolation level", "Cho phép", "Ngăn được", "Mặc định ở"],
    rows: [
      {
        cells: ["Read Uncommitted", "Đọc dữ liệu chưa commit", "—", ""],
        why: "Nhanh nhất vì không giữ lock đọc và không cần snapshot, nhưng đọc được dữ liệu sắp bị rollback (dirty read). Gần như không dùng trong thực tế; PostgreSQL còn coi mức này như Read Committed.",
      },
      {
        cells: ["Read Committed", "Non-repeatable read, phantom", "Dirty read", "PostgreSQL, Oracle, SQL Server"],
        why: "Không thấy dữ liệu dở dang, vì mỗi **câu lệnh** đọc snapshot mới nhất đã commit. Nhưng hai câu SELECT trong cùng transaction có thể thấy kết quả khác, vì giữa chúng transaction khác đã commit; mức này đủ cho đa số workload nên PostgreSQL chọn làm mặc định.",
      },
      {
        cells: ["Repeatable Read", "Phantom (theo chuẩn SQL)", "Dirty + non-repeatable read", "MySQL InnoDB"],
        why: "Đọc lại một dòng luôn ra cùng giá trị, vì cả **transaction** đọc cùng một snapshot từ lúc bắt đầu. Theo chuẩn SQL, mức này chỉ khoá các dòng đã đọc nên dòng mới chèn khớp điều kiện vẫn có thể xuất hiện (phantom); InnoDB dùng MVCC snapshot và next-key lock nên thực tế chặn được phần lớn phantom. Repeatable Read của PostgreSQL là snapshot isolation: không có phantom, nhưng vẫn có serialization anomaly như write skew — hai transaction cùng đọc rồi ghi hai dòng khác nhau, mỗi bên hợp lệ nhưng gộp lại vi phạm ràng buộc (https://www.postgresql.org/docs/current/transaction-iso.html).",
      },
      {
        cells: ["Serializable", "—", "Mọi anomaly, chạy như tuần tự", "Hiếm khi mặc định (chậm nhất)"],
        why: "Kết quả giống như các transaction chạy lần lượt — DB đảm bảo bằng lock range hoặc phát hiện xung đột rồi abort (SSI ở PostgreSQL). Throughput giảm vì phải chờ lock hoặc retry transaction bị abort → chỉ dùng cho thao tác cần tuyệt đối đúng như chống bán trùng.",
      },
    ],
  },
  diagrams: [
    {
      src: "content/svg/core-db-btree-vs-lsm.svg",
      caption: "B-Tree ghi đè page tại chỗ nên mỗi update là một lần ghi ngẫu nhiên; LSM-Tree gom ghi vào memtable trong RAM, flush tuần tự thành SSTable bất biến và gộp dần bằng compaction ở nền, đổi lại đọc có thể phải xem nhiều file.",
      source: "https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html",
    },
  ],
  cards: [
    [
      "Giải thích ACID trong 4 câu.",
      "A: tất cả hoặc không gì. C: không vi phạm constraint. I: transaction đồng thời không thấy dữ liệu tạm của nhau. D: commit rồi thì bền vững dù mất điện.",
    ],
    [
      "4 isolation level từ thấp đến cao? Mặc định PostgreSQL và MySQL?",
      "Read Uncommitted → Read Committed (PostgreSQL) → Repeatable Read (MySQL InnoDB) → Serializable.",
    ],
    [
      "LEFT JOIN khác INNER JOIN?",
      "INNER chỉ giữ dòng khớp ở cả hai bảng. LEFT giữ mọi dòng bảng trái, cột bảng phải là NULL nếu không khớp.",
    ],
  ],
});
