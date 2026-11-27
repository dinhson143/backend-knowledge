BK.topic({
  id: "db-query-tuning",
  track: "sd",
  section: "sd-core",
  title: "EXPLAIN & Query Tuning",
  goal: "Đọc query plan và sửa truy vấn không dùng được index",
  needs: ["indexing"],
  tldr: {
    t: "**Query tuning** (sửa truy vấn chậm) bắt đầu bằng việc đọc **query plan**: `EXPLAIN` cho biết planner **định** làm gì (scan nào, join nào, ước bao nhiêu dòng); `EXPLAIN ANALYZE` **chạy thật** và in thêm số dòng, thời gian thực. Chỗ cần nhìn đầu tiên là dòng nào có **số dòng ước lượng lệch xa số dòng thật**: plan sai thường bắt nguồn từ đó.",
    why: "Planner chọn plan theo **chi phí ước lượng**, mà chi phí tính từ thống kê về dữ liệu. Thống kê sai thì ước lượng sai, và planner chọn đúng theo con số sai: tưởng lọc ra 10 dòng nên dùng nested loop, thực tế ra 1 triệu dòng. Thêm index lúc đó không chữa được gì nếu không sửa chỗ ước lượng.",
  },
  story: {
    problem: "API danh sách đơn hàng chạy 30ms ở staging, lên production chậm 4 giây. Code không đổi; dữ liệu thì đổi: bảng 50 triệu dòng, một khách hàng lớn chiếm 30% số đơn. Đoán mò rồi thêm index thì vừa chậm ghi vừa có thể không được dùng.",
    idea: "Đo trước, sửa sau: tìm truy vấn tốn nhất bằng `pg_stat_statements`, lấy plan thật bằng `EXPLAIN (ANALYZE, BUFFERS)`, tìm node tốn thời gian nhất và node có ước lượng lệch, rồi sửa đúng nguyên nhân (thiếu index, index không dùng được vì cách viết, thống kê cũ, phân trang bằng OFFSET).",
    tradeoff: "Mỗi index thêm vào làm chậm mọi lần ghi và tốn dung lượng. Viết lại truy vấn cho nhanh đôi khi làm code khó đọc hơn. Plan tốt hôm nay có thể đổi khi dữ liệu lớn lên, nên phải theo dõi liên tục chứ không sửa một lần là xong.",
  },
  table: {
    head: ["Node trong plan", "Nghĩa", "Khi nào là dấu hiệu xấu"],
    rows: [
      {
        cells: ["`Seq Scan`", "Đọc toàn bộ bảng theo thứ tự vật lý", "Bảng lớn, lọc ra rất ít dòng (`Rows Removed by Filter` rất lớn)"],
        why: "Seq scan không xấu tự thân: khi cần phần lớn bảng, đọc tuần tự rẻ hơn nhảy qua index rồi đọc ngẫu nhiên từng page. Nó xấu khi lọc bỏ gần hết số dòng đã đọc, nghĩa là đọc cả bảng để lấy vài dòng. Tài liệu PostgreSQL ghi `Rows Removed by Filter` là số dòng đã quét nhưng bị điều kiện loại (https://www.postgresql.org/docs/current/using-explain.html).",
      },
      {
        cells: ["`Index Scan`", "Đi theo index rồi đọc dòng ở heap", "Trả về rất nhiều dòng: mỗi dòng một lần đọc ngẫu nhiên"],
        why: "Mỗi dòng tìm thấy trong index phải nhảy sang heap để lấy cột còn lại. Vài chục dòng thì rẻ; vài trăm nghìn dòng rải khắp bảng thì đắt hơn seq scan, nên planner đôi khi bỏ index là đúng.",
      },
      {
        cells: ["`Index Only Scan`", "Lấy đủ cột ngay trong index, không đọc heap", "`Heap Fetches` cao: visibility map chưa cập nhật"],
        why: "Chỉ chạy được khi truy vấn chỉ dùng cột có trong index và page heap được đánh dấu all-visible trong visibility map; page chưa all-visible vẫn phải đọc heap (https://www.postgresql.org/docs/current/indexes-index-only-scans.html). Bảng ghi liên tục mà VACUUM chạy chậm thì lợi thế mất.",
      },
      {
        cells: ["`Bitmap Heap Scan`", "Gom vị trí từ index thành bitmap, đọc heap theo thứ tự page", "Thường là lựa chọn hợp lý ở giữa; xem `Recheck Cond` nếu bitmap bị lossy"],
        why: "Sắp vị trí theo page trước khi đọc biến đọc ngẫu nhiên thành gần tuần tự, nên hợp với số dòng trung bình, hoặc khi kết hợp nhiều index bằng AND/OR.",
      },
      {
        cells: ["`Nested Loop`", "Với mỗi dòng bên ngoài, tra bên trong", "Bên ngoài ước 1 dòng nhưng thật ra hàng chục nghìn (`loops` rất lớn)"],
        why: "Nested loop rẻ khi bên ngoài ít dòng và bên trong có index. Thời gian và số dòng in ở node bên trong là **trung bình mỗi lần lặp**: phải nhân với `loops` mới ra tổng (tài liệu EXPLAIN của PostgreSQL). Ước lượng bên ngoài sai 1000 lần thì chi phí thật sai theo.",
      },
      {
        cells: ["`Hash Join` / `Merge Join`", "Băm một bên vào bộ nhớ / trộn hai bên đã sắp", "Hash join tràn ra đĩa (`Batches` > 1) vì `work_mem` nhỏ"],
        why: "Hash join hợp với hai tập lớn không có index phù hợp; khi bảng băm vượt `work_mem` thì phải chia lô ghi ra đĩa và chậm hẳn đi.",
      },
      {
        cells: ["`Sort`", "Sắp kết quả cho `ORDER BY`, merge join, `DISTINCT`", "`Sort Method: external merge` (sort trên đĩa)"],
        why: "Index B-Tree đã có thứ tự có thể thay hẳn bước sort: `ORDER BY created_at DESC LIMIT 20` với index trên `created_at` chỉ đọc 20 phần tử đầu thay vì sort cả bảng.",
      },
    ],
  },
  points: [
    {
      t: "**Đọc một dòng plan**: `(cost=0.29..8.30 rows=1 width=244)`. Số đầu là **startup cost** (chi phí trước khi trả dòng đầu, ví dụ thời gian sort), số sau là **total cost** nếu chạy hết; đơn vị là đơn vị tuỳ ý, quy ước `seq_page_cost = 1.0`. `rows` là số dòng **node trả ra**, không phải số dòng đã quét (https://www.postgresql.org/docs/current/using-explain.html).",
      why: "Cost chỉ dùng để so plan với plan, không đổi được ra mili giây. Phân biệt startup với total quan trọng khi có `LIMIT`: planner có thể chọn plan total cao nhưng startup thấp, vì chỉ cần vài dòng đầu.",
    },
    {
      t: "**`EXPLAIN ANALYZE` chạy thật câu lệnh**, kể cả `UPDATE`/`DELETE`, và mọi side effect xảy ra như bình thường. Muốn đo câu ghi thì bọc trong `BEGIN; EXPLAIN ANALYZE …; ROLLBACK;`. Từ PostgreSQL 18, `ANALYZE` tự bật thêm `BUFFERS` (https://www.postgresql.org/docs/18/sql-explain.html); bản 17 trở về trước phải ghi `EXPLAIN (ANALYZE, BUFFERS)` (https://www.postgresql.org/docs/17/sql-explain.html).",
      why: "`EXPLAIN` thường chỉ là dự đoán; chỉ `ANALYZE` mới cho số dòng và thời gian thật để so với ước lượng. `BUFFERS` cho biết đọc bao nhiêu page từ cache (`shared hit`) và bao nhiêu từ đĩa (`read`), giải thích vì sao lần chạy đầu chậm còn lần sau nhanh.",
    },
    {
      t: "**Ước lượng lệch là manh mối chính**: so `rows=` ước lượng với `actual rows` ở từng node. Lệch hàng chục, hàng trăm lần thì thường do thống kê cũ (chạy `ANALYZE bảng`) hoặc do planner coi các điều kiện trên nhiều cột là độc lập.",
      why: "Planner tính selectivity của `city = 'Hà Nội' AND district = 'Ba Đình'` bằng cách **nhân** hai xác suất, nên ước quá thấp khi hai cột phụ thuộc nhau. `CREATE STATISTICS … (dependencies)` trên hai cột đó cho planner biết sự phụ thuộc (https://www.postgresql.org/docs/current/planner-stats.html). Mặc định `default_statistics_target = 100`; cột phân bố lệch có thể cần tăng bằng `ALTER TABLE … SET STATISTICS`.",
    },
    {
      t: "**Index có mà không dùng được** vì cách viết điều kiện: hàm bọc cột (`WHERE lower(email) = …` với index trên `email`), so khác kiểu dữ liệu làm phải ép kiểu cột, `LIKE '%abc'` (wildcard đầu), cột không phải cột trái nhất của composite index.",
      why: "B-Tree sắp theo **giá trị gốc của cột**; `lower(email)` là giá trị khác nên index trên `email` không giúp được. Sửa bằng cách đưa biểu thức vào index: `CREATE INDEX … ON users (lower(email))` (https://www.postgresql.org/docs/current/indexes-expressional.html), hoặc viết lại điều kiện để cột đứng một mình. Wildcard đầu không có tiền tố để nhảy tới, cần loại index khác (trigram, full-text).",
    },
    {
      t: "**Covering index**: `CREATE INDEX ON orders (customer_id) INCLUDE (status, total)` cho phép index-only scan khi truy vấn chỉ cần các cột đó. `INCLUDE` chỉ có ở B-Tree, GiST, SP-GiST (https://www.postgresql.org/docs/current/indexes-index-only-scans.html).",
      why: "Cột trong `INCLUDE` không thuộc khoá tìm kiếm, chỉ đi kèm để khỏi đọc heap. Đổi lại index to hơn và ghi chậm hơn, nên chỉ thêm cột nhỏ cho truy vấn chạy rất nhiều.",
    },
    {
      t: "**Tìm truy vấn cần sửa bằng số liệu**: `pg_stat_statements` gom các câu cùng dạng (thay hằng số bằng `$1`) và đếm `calls`, `total_exec_time`, `mean_exec_time`, `rows`, `shared_blks_hit/read`; phải thêm vào `shared_preload_libraries` và restart (https://www.postgresql.org/docs/current/pgstatstatements.html). `auto_explain` ghi plan của câu chạy lâu hơn `log_min_duration` (https://www.postgresql.org/docs/current/auto-explain.html).",
      why: "Sắp theo `total_exec_time` chứ không chỉ theo câu chậm nhất: một câu 5ms chạy 10 triệu lần/ngày tốn DB hơn một báo cáo 30 giây chạy một lần. `auto_explain.log_analyze` đo thời gian từng node cho **mọi** câu lệnh, kể cả câu không bị ghi log, nên tài liệu cảnh báo có thể ảnh hưởng hiệu năng rất nặng.",
    },
    {
      t: "**Phân trang bằng `OFFSET` lớn chậm dần**: `LIMIT 20 OFFSET 100000` vẫn phải tính 100.020 dòng rồi bỏ 100.000 dòng đầu (https://www.postgresql.org/docs/current/queries-limit.html). Dùng **keyset pagination**: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20` với index trên `(created_at, id)`.",
      why: "Keyset nhảy thẳng tới vị trí trong index bằng giá trị của dòng cuối trang trước, nên trang 5000 nhanh như trang 1. `ORDER BY` phải có cột duy nhất (`id`) để thứ tự xác định; thiếu nó thì các trang có thể lặp hoặc sót dòng.",
    },
    {
      t: "**N+1 query**: vòng lặp gọi một truy vấn cho mỗi phần tử (`SELECT … WHERE order_id = ?` × 100). Mỗi câu đều nhanh nên `EXPLAIN` từng câu không thấy gì; phải nhìn ở `pg_stat_statements` (`calls` rất lớn) hoặc trace của request.",
      why: "Chi phí nằm ở số round-trip mạng và chi phí cố định mỗi câu, không nằm ở plan. Sửa bằng một câu `WHERE order_id = ANY($1)` hoặc `JOIN`, hoặc batching ở tầng ứng dụng (DataLoader).",
    },
  ],
  sections: [
    {
      title: "Quy trình sửa một truy vấn chậm",
      points: [
        "1. Lấy câu tốn nhất từ `pg_stat_statements` (theo `total_exec_time`), kèm tham số thật gây chậm.",
        "2. Chạy `EXPLAIN (ANALYZE, BUFFERS)` trên bản sao dữ liệu thật, hoặc trong transaction rồi `ROLLBACK` nếu là câu ghi.",
        "3. Tìm node chiếm nhiều thời gian nhất (nhớ nhân `loops`) và node có ước lượng lệch xa nhất.",
        "4. Sửa nguyên nhân: viết lại điều kiện, thêm index đúng thứ tự cột, chạy `ANALYZE` hoặc thêm extended statistics, đổi OFFSET sang keyset.",
        "5. Chạy lại `EXPLAIN ANALYZE` để xác nhận, rồi theo dõi chi phí ghi của index mới.",
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"query chậm thì làm gì\", đừng trả lời \"thêm index\" ngay. Nói: đo bằng `pg_stat_statements` → xem plan bằng `EXPLAIN ANALYZE` → so ước lượng với thực tế → sửa đúng nguyên nhân.",
      why: "Câu hỏi này kiểm tra quy trình chẩn đoán. \"Thêm index\" sai khi nguyên nhân là thống kê cũ, hàm bọc cột, N+1 hay OFFSET lớn; nói được quy trình cho thấy bạn đã từng sửa truy vấn thật.",
    },
    "Nhắc rằng `EXPLAIN ANALYZE` chạy thật câu lệnh: chạy trên production phải cẩn thận với câu ghi và câu nặng.",
    {
      t: "Trong bài System Design, gắn index với access pattern cụ thể: \"feed lấy 20 bài mới nhất của user → index `(user_id, created_at DESC)`, phân trang keyset\".",
      why: "Interviewer muốn thấy index sinh ra từ truy vấn, không phải liệt kê \"thêm index cho mọi cột\". Một câu như vậy chứng minh bạn biết composite index phục vụ cả lọc lẫn sắp xếp.",
    },
  ],
  cards: [
    [
      "`EXPLAIN` và `EXPLAIN ANALYZE` khác nhau thế nào?",
      "`EXPLAIN` chỉ in plan dự kiến với chi phí và số dòng ước lượng. `EXPLAIN ANALYZE` chạy thật câu lệnh (side effect xảy ra) và in thêm số dòng, thời gian thật, `loops`; từ PostgreSQL 18 kèm luôn thông tin buffers.",
    ],
    [
      "Có index trên `email` mà `WHERE lower(email) = ?` vẫn seq scan. Vì sao, sửa thế nào?",
      "Index lưu giá trị gốc, không lưu `lower(email)`, nên planner không dùng được. Tạo expression index `ON users (lower(email))`, hoặc chuẩn hoá email khi ghi.",
    ],
    [
      "Plan ước 10 dòng, thực tế 500.000 dòng. Nguyên nhân thường gặp?",
      "Thống kê cũ (chạy `ANALYZE`), phân bố lệch cần `SET STATISTICS` cao hơn, hoặc điều kiện trên nhiều cột phụ thuộc nhau mà planner coi là độc lập (thêm `CREATE STATISTICS`).",
    ],
    [
      "Vì sao trang 5000 của danh sách chậm hơn trang 1, và sửa thế nào?",
      "`OFFSET` vẫn phải tính rồi bỏ mọi dòng trước đó. Dùng keyset pagination: lọc theo giá trị dòng cuối trang trước, có index khớp `ORDER BY`.",
    ],
    [
      "Planner bỏ qua index và chọn seq scan. Có phải lúc nào cũng sai?",
      "Không. Khi truy vấn lấy một phần lớn bảng, đọc tuần tự rẻ hơn nhảy qua index rồi đọc ngẫu nhiên từng dòng. Chỉ sai khi ước lượng số dòng sai.",
    ],
    [
      "Làm sao biết truy vấn nào nên sửa trước?",
      "Sắp `pg_stat_statements` theo `total_exec_time`: câu vừa nhanh vừa chạy cực nhiều có thể tốn hơn câu chậm hiếm khi chạy.",
    ],
  ],
  related: ["n-plus-one"],
});
