BK.sim({
  id: "presigned",
  title: "Upload file lớn qua presigned URL",
  topics: ["blob", "patterns"],
  scenario: "User upload video 2GB. Backend không được chạm vào byte của file.",
  context: "Byte của file đi **thẳng từ Client lên S3**; **API** chỉ xử lý metadata và cấp quyền. User upload video 2GB. **Presigned URL** là URL API đã ký bằng credential của nó, cho phép đúng một thao tác (ví dụ upload part 2 của object `video9.mp4`) trong thời hạn ngắn mà client không cần AWS key. Theo dõi trạng thái dưới S3 (số part đã nhận) và dưới Metadata DB (PENDING → READY).",
  nodes: [
    { id: "client", x: 90, y: 150, label: "Client" },
    { id: "api", x: 350, y: 65, label: "API" },
    { id: "s3", x: 640, y: 150, label: "S3 Bucket" },
    { id: "db", x: 350, y: 235, label: "Metadata DB" },
  ],
  steps: [
    {
      note: "Client chỉ gửi **metadata**, không gửi file.",
      msgs: [["client", "api", "POST /uploads {2GB}"]],
      detail: "API chỉ nhận vài trăm byte JSON: client gọi `POST /uploads` với metadata — tên file, kích thước 2GB, content-type. Nếu file 2GB đi qua API, mỗi upload chiếm một connection và băng thông của API server hàng phút, nhanh chóng làm cạn worker và RAM.",
    },
    {
      note: "API ký **presigned URL** (multipart, hết hạn 15 phút) và lưu bản ghi PENDING.",
      msgs: [["api", "db", "INSERT PENDING"], ["api", "client", "presigned URLs ×3", "ok"]],
      set: { db: "video#9 PENDING" },
      detail: "API gọi `CreateMultipartUpload` lấy `uploadId`, rồi ký **3 presigned URL** — mỗi URL cho phép `UploadPart` đúng một part, hết hạn sau 15 phút. API ghi bản ghi `video#9 PENDING` vào DB trước khi trả URL, để hệ thống biết có upload đang dở (dùng cho dọn dẹp sau này). Credential không bao giờ rời API; URL bị lộ thì kẻ khác chỉ upload được đúng part đó trong 15 phút. Thực tế part thường 50–100MB nên file 2GB có vài chục URL, sim rút gọn còn 3.",
    },
    {
      note: "Client upload **song song** từng chunk thẳng lên S3.",
      msgs: [{ par: [["client", "s3", "part 1"], ["client", "s3", "part 2"], ["client", "s3", "part 3"]] }],
      set: { s3: "2/3 parts" },
      detail: "Client `PUT` 3 part **song song** thẳng lên S3 bằng 3 presigned URL, mỗi part khoảng 680MB — tận dụng hết băng thông client, nhanh hơn nhiều so với một stream đơn. Mỗi part thành công trả về một `ETag`, client giữ lại để ghép file ở bước cuối. Trạng thái `2/3 parts`: part 1 và 3 đã xong, part 2 còn dở.",
    },
    {
      note: "Một chunk lỗi thì chỉ upload lại chunk đó.",
      msgs: [["s3", "client", "part 2 ✗ timeout", "err"], ["client", "s3", "retry part 2", "warn"]],
      set: { s3: "3/3 parts" },
      detail: "Part 2 bị **timeout** (mạng chập chờn, Wi-Fi rớt), và nhờ multipart client chỉ gửi lại **riêng part 2** — part 1 và 3 đã nằm an toàn trên S3. Upload một khối 2GB thì rớt mạng ở 1.9GB nghĩa là làm lại từ đầu. Điều kiện: retry phải xong trước khi presigned URL hết hạn 15 phút; hết hạn thì client xin API ký URL mới cho part đó.",
    },
    {
      note: "S3 phát event khi hoàn tất → API cập nhật metadata.",
      msgs: [
        ["client", "s3", "CompleteMultipart"],
        ["s3", "api", "ObjectCreated", "ok"],
        ["api", "db", "status=READY", "ok"],
      ],
      set: { db: "video#9 READY ✓", s3: "video9.mp4 ✓" },
      good: ["s3"],
      lesson: "Presigned URL + multipart: file đi thẳng giữa client và S3, DB chỉ giữ metadata.",
      detail: "API chuyển `status=READY` khi nhận event từ S3, không tin lời client. Client gọi `CompleteMultipartUpload` với danh sách số part + `ETag`; S3 ghép các part thành object `video9.mp4` rồi phát event `ObjectCreated` (qua SNS/SQS/EventBridge) tới API. Dùng event từ S3 thay vì tin client báo “xong rồi” vì client có thể tắt app giữa chừng hoặc nói dối. Event giao **at-least-once** nên handler phải idempotent; upload bỏ dở cần lifecycle rule `AbortIncompleteMultipartUpload` để dọn part rác, nếu không S3 vẫn tính tiền lưu trữ chúng.",
    },
  ],
});
