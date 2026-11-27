BK.sim({
  id: "n-plus-one",
  title: "GraphQL N+1 và DataLoader",
  topics: ["api-design"],
  scenario: "Client lấy 100 event, mỗi event kèm venue.",
  context: "Tổng số query một request sinh ra phải gần như cố định, không được tăng theo số dòng dữ liệu — theo dõi con số này dưới Database. Client gửi một GraphQL query lồng nhau; **GraphQL Server** chạy **resolver** cho từng field, và mỗi resolver tự đi lấy dữ liệu của mình. Resolver con (`venue`) được gọi **một lần cho mỗi phần tử** resolver cha (`events`) trả về, và mặc định không biết các lần gọi anh em của nó.",
  h: 260,
  nodes: [
    { id: "client", x: 90, y: 120, label: "Client" },
    { id: "gql", x: 350, y: 120, label: "GraphQL Server" },
    { id: "db", x: 640, y: 120, label: "Database", s: "0 query" },
  ],
  variants: [
    {
      name: "N+1",
      steps: [
        {
          note: "Client gửi query lồng nhau.",
          msgs: [["client", "gql", "events { venue { name } }"]],
          detail: "Từ phía client đây chỉ là **1 round-trip**: một HTTP request duy nhất, body là query `events { venue { name } }` — lấy 100 event, mỗi event kèm tên venue. Nhìn từ ngoài không có gì đáng ngờ; chi phí thật nằm ở cách server biến query này thành lệnh gọi database.",
        },
        {
          note: "Resolver `events` chạy **1 query**.",
          msgs: [["gql", "db", "SELECT * FROM events"], ["db", "gql", "100 rows", "ok"]],
          set: { db: "1 query" },
          detail: "Resolver `events` chạy `SELECT * FROM events` và nhận 100 rows — mới tốn **1 query**, hoàn toàn hợp lý. Server duyệt cây query từ trên xuống. Mỗi row có cột `venue_id`, nhưng chưa ai lấy thông tin venue.",
        },
        {
          note: "Resolver `venue` chạy **riêng cho từng event** → thêm 100 query.",
          msgs: [
            {
              par: [
                ["gql", "db", "venue id=1", "warn"],
                ["gql", "db", "venue id=2", "warn"],
                ["gql", "db", "… id=100", "warn"],
              ],
            },
          ],
          set: { db: "101 query 🔥" },
          bad: ["db"],
          lesson: "N+1: 1 query cha + N query con.",
          detail: "Tổng cộng **101 query** cho một request — 1 query cha + N query con, đúng tên gọi N+1. Server đi xuống field `venue` và gọi resolver `venue` **100 lần**, mỗi lần với một event (parent) khác; resolver viết ngây thơ `db.query('SELECT * FROM venues WHERE id = ?', parent.venueId)` nên bắn 100 query riêng: `id=1`, `id=2`, …, `id=100`. Mỗi query ~2ms round-trip thì chạy tuần tự chậm thêm vài trăm ms; chạy song song vẫn chiếm 100 connection trong pool và nhân tải database lên 100 lần. Lỗi này **im lặng**: kết quả đúng, test với 3 event vẫn nhanh, chỉ lộ ra khi dữ liệu thật lớn lên hoặc traffic tăng.",
        },
      ],
    },
    {
      name: "DataLoader",
      steps: [
        {
          note: "Client gửi query lồng nhau.",
          msgs: [["client", "gql", "events { venue { name } }"]],
          detail: "Cùng query `events { venue { name } }`; khác biệt duy nhất nằm ở server: mỗi request có một instance **DataLoader** riêng cho venue, tạo trong context của request đó.",
        },
        {
          note: "Resolver `events` chạy **1 query**.",
          msgs: [["gql", "db", "SELECT * FROM events"], ["db", "gql", "100 rows", "ok"]],
          set: { db: "1 query" },
          detail: "Resolver `events` vẫn chạy 1 query `SELECT * FROM events` và nhận 100 rows. Phần này không đổi — DataLoader chỉ xử lý tầng con.",
        },
        {
          note: "DataLoader **gom** 100 lời gọi `load(venueId)` trong cùng một tick.",
          set: { gql: "batch: [1..100]" },
          detail: "Resolver `venue` vẫn được gọi 100 lần, nhưng DataLoader **gom** các lời gọi thay vì query ngay. Mỗi resolver gọi `venueLoader.load(parent.venueId)` và nhận một Promise chưa resolve; DataLoader đưa key vào hàng đợi và chờ hết tick hiện tại của event loop (`process.nextTick`). Khi 100 resolver gọi xong, hàng đợi chứa `[1..100]`. DataLoader còn **cache theo request**: 2 event cùng venue 5 thì `load(5)` chỉ được gom một lần, nên trên dữ liệu thật batch thường nhỏ hơn 100.",
        },
        {
          note: "Chỉ còn 1 query `IN (...)`.",
          msgs: [
            ["gql", "db", "WHERE id IN (1..100)"],
            ["db", "gql", "100 venues", "ok"],
            ["gql", "client", "data", "ok"],
          ],
          set: { db: "2 query ✓" },
          good: ["db"],
          lesson: "DataLoader = batching + cache theo request.",
          detail: "Tổng cộng **2 query** dù có 100 hay 10.000 event — số query giờ bằng độ sâu của query, không theo số dòng. Hết tick, DataLoader gọi **batch function** một lần với toàn bộ key: `SELECT * FROM venues WHERE id IN (1..100)`. Batch function phải trả mảng kết quả **đúng thứ tự và đúng số lượng** như mảng key, để DataLoader resolve từng Promise cho đúng event. Cái giá: thêm một tầng code, cache chỉ sống trong một request (không dùng chung giữa user), và danh sách `IN` quá dài cần chia batch (`maxBatchSize`).",
        },
      ],
    },
  ],
});
