BK.sim({
  id: "long-task",
  title: "Long-running task: 202 + job queue",
  topics: ["patterns", "queue"],
  scenario: "User xuất báo cáo Excel 1 triệu dòng — mất vài phút.",
  context: "API không giữ HTTP request chờ: nó nhận yêu cầu, đẩy **job** vào **queue**, trả `202 Accepted` kèm `jobId`, còn **worker** chạy nền. Lý do: xuất báo cáo 1 triệu dòng mất vài phút, lâu hơn timeout của load balancer, gateway và browser (thường 30–60 giây). Theo dõi dòng chữ dưới API (trạng thái job: QUEUED → RUNNING → DONE), dưới Worker (tiến độ) và dưới S3 (file kết quả).",
  nodes: [
    { id: "client", x: 90, y: 150, label: "Client" },
    { id: "api", x: 330, y: 65, label: "API", s: "—" },
    { id: "queue", x: 330, y: 235, label: "Queue" },
    { id: "worker", x: 600, y: 235, label: "Worker", s: "rảnh" },
    { id: "s3", x: 600, y: 65, label: "S3", s: "—" },
  ],
  steps: [
    {
      note: "User yêu cầu xuất báo cáo.",
      msgs: [["client", "api", "POST /reports"]],
      detail: "User bấm \"Xuất Excel\", browser gửi `POST /reports` kèm tham số (khoảng thời gian, bộ lọc). Nếu API xử lý ngay trong request, nó phải query 1 triệu dòng và build file trong vài phút: request vượt timeout của load balancer (ví dụ ALB mặc định 60s) và bị cắt, user nhận 504 trong khi server vẫn tốn CPU cho kết quả không ai nhận. Thêm vài user cùng bấm là thread pool của API cạn, kéo chết cả các API khác.",
    },
    {
      note: "API **không xử lý tại chỗ**: đẩy job vào queue, trả `202` + jobId ngay.",
      msgs: [["api", "queue", "enqueue job#7"], ["api", "client", "202 {jobId:7}", "ok"]],
      set: { api: "job#7 QUEUED", queue: "job#7" },
      detail: "API trả `202 Accepted` + `{jobId: 7}` trong vài chục ms, chỉ làm việc nhẹ: kiểm tra quyền, lưu bản ghi `job#7` trạng thái **QUEUED**, đẩy message `job#7` vào queue. `202` nghĩa là \"đã nhận, chưa làm xong\". Request HTTP kết thúc ngay, API rảnh tay phục vụ user khác. Nên dùng idempotency key cho `POST` để user bấm hai lần không tạo hai job.",
    },
    {
      note: "Worker nhận job và chạy vài phút.",
      msgs: [["queue", "worker", "job#7"]],
      set: { worker: "đang chạy 40%", api: "job#7 RUNNING", queue: "" },
      detail: "Worker lấy `job#7` từ queue, chuyển trạng thái **RUNNING** và ghi tiến độ (40%) vào nơi API đọc được (DB hoặc Redis). Với SQS hay RabbitMQ, message chưa bị xoá hẳn mà chỉ bị ẩn (visibility timeout / unacked): worker crash giữa chừng thì message quay lại queue cho worker khác làm lại, nên job phải chạy lại được an toàn. Số worker quyết định bao nhiêu báo cáo chạy song song — queue đóng vai bộ đệm khi nhiều người bấm cùng lúc.",
    },
    {
      note: "Client poll trạng thái (hoặc nhận SSE / webhook).",
      msgs: [["client", "api", "GET /jobs/7"], ["api", "client", "RUNNING 40%", "warn"]],
      detail: "Client poll `GET /jobs/7` định kỳ, API đọc bản ghi job và trả `RUNNING 40%` để UI vẽ thanh tiến độ. Mỗi lần poll là request nhẹ, trả về ngay. Thay polling có thể dùng SSE/WebSocket đẩy tiến độ, hoặc **webhook** gọi về hệ thống của khách khi xong (hợp với API B2B).",
    },
    {
      note: "Worker xong, upload file lên S3 và cập nhật trạng thái.",
      msgs: [["worker", "s3", "report7.xlsx"], ["worker", "api", "DONE", "ok"]],
      set: { worker: "rảnh", s3: "report7.xlsx", api: "job#7 DONE" },
      detail: "Worker upload `report7.xlsx` lên S3 rồi mới cập nhật job sang **DONE** kèm key của file. Thứ tự quan trọng: upload thành công **trước**, đánh dấu DONE **sau**, nếu không client có thể nhận link tới file chưa tồn tại. Worker trở về \"rảnh\" và lấy job kế tiếp; lúc này mới xoá/ack message khỏi queue.",
    },
    {
      note: "Client nhận link tải (presigned URL) và tải thẳng từ S3.",
      msgs: [
        ["client", "api", "GET /jobs/7"],
        ["api", "client", "DONE + URL", "ok"],
        ["client", "s3", "GET report7.xlsx", "ok"],
      ],
      good: ["s3"],
      lesson: "Async job: 202 + jobId, queue + worker, poll hoặc push trạng thái. Không giữ HTTP request chờ việc nặng.",
      detail: "Browser tải file **thẳng từ S3**, không qua API: lần poll kế tiếp API trả `DONE` + **presigned URL** — link S3 có chữ ký, chỉ hợp lệ một thời gian ngắn (ví dụ 15 phút). Nhờ vậy file vài trăm MB không chiếm băng thông và kết nối của API server. Nên đặt lifecycle rule để S3 tự xoá file sau vài ngày, tránh tích luỹ dữ liệu nhạy cảm.",
    },
  ],
});
