BK.topic({
  id: "data-modeling",
  track: "sd",
  section: "sd-core",
  title: "Data Modeling",
  tldr: {
    t: "6 bước: chọn loại DB → liệt kê cột theo FR → PK/FK → index theo access pattern → cân nhắc denormalize → cân nhắc sharding và shard key.",
    why: "Đi từ quyết định lớn, khó đổi nhất (loại DB) tới tối ưu cục bộ, vì mỗi bước dựa vào output bước trước: phải biết cột mới chọn được key, biết query mới chọn được index. Denormalize và sharding đứng cuối vì chúng thêm độ phức tạp, chỉ đáng làm khi con số tải đòi hỏi.",
  },
  story: {
    problem: "Schema chọn sai rất đắt để sửa: dữ liệu đã có hàng tỷ dòng thì migration mất nhiều ngày, còn shard key sai thì gần như phải chuyển toàn bộ dữ liệu. Thiết kế bảng theo cảm tính hay dẫn tới query chính phải scan cả bảng hoặc JOIN qua nhiều shard.",
    idea: "Thiết kế dữ liệu ngược từ cách nó được dùng: FR quyết định cột, access pattern quyết định index, tỉ lệ đọc/ghi quyết định có denormalize không, query chính quyết định shard key. Bắt đầu đơn giản (một DB quan hệ chuẩn hoá), chỉ thêm độ phức tạp khi có con số đòi hỏi.",
    tradeoff: "Tối ưu cho access pattern chính thường làm khó các pattern khác: shard theo `user_id` thì query theo `event_id` phải hỏi mọi shard; denormalize đọc nhanh nhưng phải đồng bộ nhiều bản sao khi ghi.",
  },
  points: [
    {
      t: "**1 · Chọn loại database** — Relational (SQL), Document, Key-Value, Graph.",
      why: "Mỗi loại DB tối ưu cho một hình dạng dữ liệu: relational cho quan hệ và JOIN, document cho object lồng nhau đọc trọn một lần, key-value cho tra cứu theo key với latency thấp, graph cho truy vấn nhiều bước qua quan hệ (bạn của bạn). Chọn lệch thì phải tự làm lại phần DB không hỗ trợ trong code ứng dụng.",
    },
    {
      t: "**2 · Liệt kê cột** cần cho từng entity để thoả FR.",
      why: "Đi từ FR giúp không thiếu dữ liệu cần thiết và không thêm cột thừa, vì mỗi cột phải phục vụ một FR. Ví dụ FR “xem sự kiện theo thành phố” buộc bảng `events` phải có `city`.",
    },
    {
      t: "**3 · Primary key & foreign key** cho từng quan hệ.",
      why: "PK cho mỗi dòng một định danh duy nhất để tra cứu và tham chiếu; FK bắt DB kiểm tra tham chiếu tồn tại → không có booking trỏ tới event đã bị xoá. Xác định quan hệ 1–N hay N–N lúc này cũng quyết định có cần bảng trung gian không.",
    },
    {
      t: "**4 · Cột nào cần index** — dựa vào query thực tế.",
      why: "Chọn index theo query thực tế (`WHERE user_id = ? ORDER BY created_at`) thay vì index mọi cột, vì index chỉ giúp query có điều kiện trên đúng các cột đó, và mỗi index làm chậm mọi lần ghi.",
    },
    {
      t: "**5 · Có cần denormalize** để tăng hiệu năng đọc không.",
      why: "Lưu sẵn bản sao như `venue_name` trong `events` bỏ được JOIN — đáng làm khi đọc nhiều hơn ghi hàng trăm lần (feed, trang sản phẩm), vì chuẩn hoá bắt mỗi lần đọc phải JOIN. Cái giá: venue đổi tên thì phải cập nhật mọi bản sao, nên chỉ làm khi đọc là bottleneck.",
    },
    {
      t: "**6 · Có cần sharding** — nếu có, chọn shard key khớp access pattern chính.",
      why: "Sharding cần khi dữ liệu hoặc tải ghi vượt một máy. Shard key phải khớp query chính để mỗi query chỉ chạm một shard: shard `bookings` theo `user_id` thì “booking của tôi” rất nhanh, nhưng “mọi booking của event X” phải scatter-gather tới mọi shard.",
    },
    {
      t: "**Relational DB** — bảng có schema cố định, quan hệ qua foreign key, transaction ACID.",
      why: "Logic như chuyển tiền hay đặt vé không phải tự xử lý trường hợp ghi được một nửa, vì schema cố định cho DB biết trước kiểu dữ liệu nên chặn dữ liệu sai ngay lúc ghi, còn FK và transaction ACID đảm bảo các bảng liên quan luôn khớp nhau.",
    },
    {
      t: "+ Mặc định chọn **PostgreSQL** nếu không có lý do đặc biệt; chỉ đổi sang NoSQL khi nêu được lý do (write throughput cực cao, schema linh hoạt, access pattern key-value đơn giản).",
      why: "PostgreSQL phủ phần lớn bài toán, vì có ACID, JOIN, index đa dạng, JSONB cho dữ liệu bán cấu trúc và một node chịu được tải khá lớn. Chọn NoSQL không lý do là nhận về hạn chế (không JOIN, consistency yếu) mà không được lợi gì; interviewer muốn nghe bạn nêu được con số hoặc pattern buộc phải đổi.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/data-modeling-denormalize.svg",
      caption: "Chuẩn hoá giữ tên venue ở một chỗ nên đổi tên chỉ sửa một dòng nhưng đọc phải JOIN; denormalize chép venue_name vào events để đọc một bảng, đổi lại mỗi lần đổi tên phải sửa mọi bản sao.",
      source: "https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description",
    },
  ],
  cards: [
    [
      "6 bước Data Modeling?",
      "1) Chọn loại DB 2) Cột theo FR 3) PK/FK 4) Index 5) Denormalize? 6) Sharding? + chọn shard key theo access pattern chính.",
    ],
    [
      "Khi nào denormalize?",
      "Khi đường đọc nóng cần tránh JOIN đắt (feed, dashboard), chấp nhận chi phí ghi trùng và giữ đồng bộ.",
    ],
  ],
});
