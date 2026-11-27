BK.topic({
  id: "indexing",
  track: "sd",
  section: "sd-core",
  title: "Database Indexing",
  goal: "Chọn index cho truy vấn và biết nó làm chậm ghi bao nhiêu",
  needs: ["core-db"],
  tldr: {
    t: "B-Tree là mặc định (range + equality). Hash index chỉ cho equality. Composite index theo quy tắc leftmost prefix. Mỗi bảng chỉ có 1 clustered index.",
    why: "B-Tree là mặc định vì giữ key theo thứ tự → làm được cả `=` lẫn range/sort. Hash chỉ làm được `=`, vì chỉ biết vị trí của từng giá trị riêng lẻ. Composite phải có cột trái nhất, vì sắp theo cột đầu trước; clustered quyết định thứ tự vật lý của dòng nên mỗi bảng chỉ có một.",
  },
  story: {
    problem: "Không có index, `WHERE email = ?` trên bảng 100 triệu dòng mất hàng giây đến hàng phút, vì DB phải đọc lần lượt từng dòng (full table scan). Bảng lớn dần → query tăng tuyến tính theo số dòng và kéo sập cả DB.",
    idea: "Index là cấu trúc phụ sắp sẵn theo giá trị cột (B-Tree, hash) để DB nhảy thẳng tới dòng cần tìm. B-Tree với 100 triệu dòng chỉ cao 3–4 tầng → tra cứu chỉ tốn vài lần đọc page thay vì quét toàn bảng.",
    tradeoff: "Mỗi index là một bản sao dữ liệu đã sắp xếp: tốn dung lượng, và mọi INSERT/UPDATE/DELETE phải cập nhật thêm từng index. Bảng ghi nhiều mà có quá nhiều index sẽ chậm ghi rõ rệt.",
  },
  table: {
    head: ["Loại", "Đặc điểm", "Ví dụ"],
    rows: [
      {
        cells: [
          "B-Tree",
          "Mặc định ở MySQL InnoDB, PostgreSQL, SQL Server, Oracle; hỗ trợ range, sort",
          "`WHERE created_at > ...`",
        ],
        why: "Tìm `created_at > X` chỉ cần nhảy tới X rồi đọc tuần tự sang phải, vì B-Tree giữ key đã sắp xếp và các node lá nối nhau. Cây rộng (mỗi node hàng trăm key) nên rất thấp, ít lần đọc đĩa → hầu hết DB chọn làm mặc định.",
      },
      {
        cells: [
          "Hash",
          "Chỉ equality, dùng cho in-memory engine, `USING HASH` (PostgreSQL)",
          "`WHERE session_id = ?`",
        ],
        why: "Tra `=` là O(1) vì hash biến giá trị thành vị trí bucket, nhưng hai giá trị gần nhau cho hash hoàn toàn khác nhau → không có thứ tự để làm range hay ORDER BY. Hợp với lookup thuần như session id, nơi không bao giờ hỏi “session lớn hơn X”.",
      },
      {
        cells: [
          "Clustered",
          "Dữ liệu và index là một; tạo tự động trên Primary Key; 1 bảng chỉ có 1 (InnoDB, SQL Server — PostgreSQL không có)",
          "PK `id`",
        ],
        why: "Tra theo PK là có dữ liệu ngay, không cần đọc thêm, vì clustered index lưu luôn cả dòng ở node lá → dòng nằm trên đĩa theo đúng thứ tự key. Mỗi bảng chỉ có một clustered index, vì dữ liệu chỉ sắp vật lý được theo một thứ tự.",
      },
      {
        cells: [
          "Non-clustered",
          "Cấu trúc riêng trỏ về dòng dữ liệu",
          "`CREATE INDEX idx_bophan ON NhanVien(BoPhan)`",
        ],
        why: "Tạo được nhiều non-clustered index cho nhiều cột, vì mỗi index chỉ lưu giá trị cột cộng con trỏ (hoặc PK) tới dòng. Đổi lại, tìm xong còn một bước nhảy về bảng chính để lấy các cột còn lại, trừ khi index đã chứa đủ cột (covering index).",
      },
      {
        cells: ["Unique", "Cấm trùng giá trị", "`CREATE UNIQUE INDEX uq_socccd ON NhanVien(SoCCCD)`"],
        why: "Unique index vừa chặn trùng vừa tăng tốc tra cứu, vì khi ghi DB phải tra index để kiểm tra giá trị đã tồn tại chưa. Ràng buộc ở tầng DB mới chắc chắn: hai request đồng thời cùng kiểm tra ở code ứng dụng đều có thể thấy “chưa có” rồi cùng chèn.",
      },
      {
        cells: ["Composite", "Nhiều cột, theo thứ tự khai báo", "`CREATE INDEX idx_ho_ten ON NhanVien(Ho, Ten)`"],
        why: "Thứ tự khai báo quyết định composite index phục vụ được query nào, vì nó sắp theo cột đầu, trong cùng giá trị cột đầu mới sắp theo cột thứ hai — giống danh bạ sắp theo Họ rồi tới Tên.",
      },
    ],
  },
  points: [
    {
      t: "+ **Leftmost prefix** — index `(Ho, Ten)` dùng được cho `WHERE Ho=?` và `WHERE Ho=? AND Ten=?`, thường không dùng được cho `WHERE Ten=?` một mình (trừ engine có skip scan).",
      why: "Tìm theo Ten một mình thì DB phải duyệt hết, vì index `(Ho, Ten)` sắp theo Ho trước → mọi người tên “An” nằm rải rác dưới các họ khác nhau, không có đoạn liên tục nào để nhảy vào. Giống tìm theo tên trong danh bạ sắp theo họ.",
    },
    {
      t: "+ **Trade-off** — index tăng tốc đọc nhưng làm chậm ghi và tốn dung lượng.",
      why: "Đọc nhanh vì DB nhảy theo cây thay vì quét bảng; ghi chậm vì mỗi INSERT phải chèn thêm vào từng index, đôi khi tách node B-Tree. Bảng có 5 index thì một lần ghi thành 6 lần ghi cấu trúc, và mỗi index chiếm dung lượng tương ứng số dòng.",
    },
    {
      t: "+ Index đặc biệt: **Geospatial** (PostGIS, Geohash, Quadtree), **Inverted index** (full-text search).",
      why: "B-Tree không trả lời được “điểm nào trong bán kính 2km” (cần 2 chiều) hay “văn bản nào chứa từ X” (từ nằm giữa chuỗi), vì nó chỉ sắp theo một chiều. Geohash/Quadtree chia không gian thành ô để điểm gần nhau có key gần nhau; inverted index map mỗi từ sang danh sách document chứa nó.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/indexing-btree.svg",
      caption: "B-Tree index (kiểu non-clustered như PostgreSQL): đi từ root xuống đúng leaf một lần, rồi quét ngang các leaf đã sắp xếp cho tới khi vượt cận trên; mỗi entry trỏ tới một dòng trong bảng.",
      source: "https://www.postgresql.org/docs/current/btree.html#BTREE-STRUCTURE",
    },
    {
      src: "content/svg/indexing-composite-index.svg",
      caption: "Composite index (Ho, Ten) sắp theo Ho rồi mới tới Ten, nên lọc theo Ho hoặc Ho + Ten chạm một khối liền nhau, còn chỉ lọc theo Ten thì các dòng khớp nằm rải khắp index (leftmost prefix).",
      source: "https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html",
    },
  ],
  cards: [
    [
      "Vì sao một bảng chỉ có 1 clustered index?",
      "Clustered index quyết định thứ tự vật lý của dữ liệu trên đĩa, mà dữ liệu chỉ sắp được theo một thứ tự.",
    ],
    [
      "Index (Ho, Ten) có giúp query `WHERE Ten = 'An'` không?",
      "Thường là không — vi phạm leftmost prefix. Cần index riêng trên Ten hoặc đổi thứ tự cột. Ngoại lệ: engine có skip scan (MySQL từ 8.0.13, PostgreSQL từ 18) vẫn dùng được index khi cột đầu có ít giá trị khác nhau.",
    ],
    [
      "B-Tree vs Hash index?",
      "B-Tree: equality + range + ORDER BY, là mặc định. Hash: chỉ equality, O(1) nhưng không range.",
    ],
  ],
});
