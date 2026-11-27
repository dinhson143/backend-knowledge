BK.sim({
  id: "cache-write",
  title: "3 chiến lược ghi cache",
  topics: ["caching", "dist-cache"],
  scenario: "Admin đổi giá sản phẩm từ 80 thành 99. So sánh latency và rủi ro của từng chiến lược.",
  context: "Ba variant khác nhau ở hai chỗ: lần ghi đi vào đâu trước, và app trả `200` cho admin **khi nào**. Admin đổi giá sản phẩm từ 80 thành 99; ban đầu cả **Cache** và **Database** đều giữ `price=80`. Theo dõi dòng chữ dưới Cache và Database: lúc nào hai bên lệch nhau, lệch thì bên nào sai; con số latency trên mũi tên trả về (30ms vs 2ms) là cái giá/lợi của từng chiến lược.",
  nodes: [
    { id: "client", x: 90, y: 150, label: "Admin" },
    { id: "app", x: 300, y: 150, label: "App Server" },
    { id: "cache", x: 570, y: 65, label: "Cache", s: "price=80" },
    { id: "db", x: 570, y: 225, label: "Database", s: "price=80" },
  ],
  variants: [
    {
      name: "Write-Through",
      steps: [
        {
          note: "Admin gửi giá mới.",
          msgs: [["client", "app", "PUT price=99"]],
          detail: "Admin gửi `PUT price=99` tới App Server; chưa thành phần nào thay đổi, cache và DB vẫn `price=80`. Chiến lược ghi quyết định thứ tự bước tiếp theo.",
        },
        {
          note: "App ghi vào cache, cache ghi **đồng bộ** xuống DB.",
          msgs: [["app", "cache", "SET price=99"], ["cache", "db", "write price=99"]],
          set: { cache: "price=99", db: "price=99" },
          detail: "Sau bước này cả hai node đều `price=99`: với write-through, app ghi vào cache và lớp cache **ghi đồng bộ** tiếp xuống DB trong cùng một thao tác. Một số hệ như DynamoDB DAX hoặc cache trong ORM làm vậy; với Redis thường thì chính app ghi cả hai liên tiếp. Request của admin vẫn đang treo, chưa được trả lời.",
        },
        {
          note: "Nhất quán vì chỉ trả lời khi DB đã xác nhận; đổi lại ghi chậm hơn.",
          msgs: [["db", "cache", "ack", "ok"], ["cache", "app", "ack", "ok"], ["app", "client", "200 · 30ms", "ok"]],
          good: ["cache", "db"],
          lesson: "Write-Through: cache luôn khớp DB; latency ghi = cache + DB.",
          detail: "Khi admin nhận `200`, **cả cache và DB đều đã có 99**, nên mọi lần đọc ngay sau đều thấy giá mới. Đổi lại, app chỉ trả `200` sau ~30ms — DB commit, ack cho cache, cache ack cho app — bằng tổng thời gian ghi cache + ghi DB. Nếu ghi DB lỗi, request phải báo lỗi (và gỡ giá trị khỏi cache) chứ không được ack, nếu không cache sẽ giữ giá mà DB không có. Nhược điểm khác: dữ liệu ít ai đọc cũng bị nhét vào cache, tốn RAM.",
        },
      ],
    },
    {
      name: "Write-Around",
      steps: [
        {
          note: "Admin gửi giá mới.",
          msgs: [["client", "app", "PUT price=99"]],
          detail: "Admin gửi `PUT price=99`; cache và DB vẫn cùng giữ 80.",
        },
        {
          note: "Ghi thẳng DB, bỏ qua cache.",
          msgs: [["app", "db", "UPDATE price=99"]],
          set: { db: "price=99" },
          detail: "DB giờ là 99 nhưng cache vẫn `price=80` — hai bên lệch, và **cache là bên sai**. App ghi **thẳng vào DB** bằng `UPDATE price=99`, không đụng cache. Dừng ở đây thì mọi request đọc hit cache và thấy giá 80 tới khi key hết TTL — khách có thể đặt hàng với giá cũ.",
        },
        {
          note: "Cache còn giá cũ → phải **DEL** key (hoặc chờ TTL ngắn hết hạn).",
          msgs: [["app", "cache", "DEL price", "warn"]],
          set: { cache: "(trống)" },
          detail: "App gửi `DEL price` (mũi tên vàng) để xoá khoảng lệch — cache giờ `(trống)`. Không chủ động xoá thì cách duy nhất còn lại là TTL ngắn và chấp nhận giá cũ tồn tại tới khi hết hạn. Admin được trả lời ngay sau khi DB commit, nên latency ghi chỉ bằng ghi DB, không tốn thêm chi phí ghi cache.",
        },
        {
          note: "Lần đọc tới MISS và nạp giá 99 từ DB.",
          msgs: [
            ["client", "app", "GET price"],
            ["app", "cache", "GET"],
            ["cache", "app", "MISS", "err"],
            ["app", "db", "SELECT"],
            ["db", "app", "99", "ok"],
            ["app", "cache", "SET 99", "ok"],
          ],
          set: { cache: "price=99" },
          lesson: "Write-Around hợp dữ liệu ghi nhiều đọc ít; trả giá bằng miss lần đầu.",
          detail: "Lần đọc đầu sau mỗi lần ghi luôn chậm — đó là cái giá của write-around. Request đọc kế tiếp `GET` vào cache, nhận **MISS** (mũi tên đỏ), app tự `SELECT` DB lấy 99 rồi `SET 99` vào cache — đúng luồng cache-aside, tốn một round-trip DB. Write-around hợp với dữ liệu ghi nhiều mà ít khi đọc lại ngay (log, bản ghi lịch sử), vì không tốn RAM cache cho thứ không ai đọc.",
        },
      ],
    },
    {
      name: "Write-Back",
      steps: [
        {
          note: "Admin gửi giá mới.",
          msgs: [["client", "app", "PUT price=99"]],
          detail: "Admin gửi `PUT price=99`; cache và DB vẫn cùng giữ 80.",
        },
        {
          note: "Ghi vào cache rồi trả lời **ngay**.",
          msgs: [
            ["app", "cache", "SET price=99"],
            ["cache", "app", "ok", "ok"],
            ["app", "client", "200 · 2ms", "ok"],
          ],
          set: { cache: "price=99 (dirty)" },
          detail: "App trả `200` chỉ sau ~2ms — **không chờ DB**: app `SET price=99` vào cache và cache trả `ok` ngay. Cache đánh dấu entry là **dirty**: giá trị đã đổi nhưng chưa ghi xuống nơi lưu trữ bền. Với admin, thao tác đã thành công.",
        },
        {
          note: "DB vẫn giữ giá cũ, chờ tiến trình nền flush sau vài giây.",
          set: { db: "price=80 (cũ)" },
          detail: "Trong cửa sổ chờ flush, **bản 99 duy nhất nằm trong RAM của cache node**; DB vẫn `price=80 (cũ)`. Một tiến trình nền gom các entry dirty và flush xuống DB định kỳ (mỗi vài giây) hoặc theo lô, nên nhiều lần ghi vào cùng key gộp thành một lần ghi DB — lý do write-back cho throughput ghi rất cao. Báo cáo, job hay service nào đọc thẳng DB đều thấy 80.",
        },
        {
          note: "Cache node sập **trước khi flush** → giá 99 mất vĩnh viễn.",
          msgs: [["cache", "db", "flush ✗", "err"]],
          set: { cache: "💥 crash" },
          bad: ["cache", "db"],
          lesson: "Write-Back nhanh nhất nhưng có cửa sổ mất dữ liệu — chỉ dùng cho dữ liệu chịu mất được (counter, metrics) hoặc cache có persistence.",
          detail: "Cache node sập trước lượt flush → **mất dữ liệu im lặng**: admin đã nhận `200`, nhưng DB vẫn 80 và không còn bản 99 nào ở đâu. Node sập (OOM, mất điện, restart) nên lệnh flush không bao giờ chạy và RAM chứa giá 99 biến mất, không log lỗi nào gắn với request của admin. Cache khởi động lại trống, nạp 80 từ DB và hệ thống tiếp tục bán giá cũ. Vì vậy write-back chỉ dùng cho dữ liệu chịu mất được (counter, metrics) hoặc khi cache có persistence/replication (AOF, WAL) bù cho cửa sổ này.",
        },
      ],
    },
  ],
});
