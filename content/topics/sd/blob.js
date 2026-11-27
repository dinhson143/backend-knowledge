BK.topic({
  id: "blob",
  track: "sd",
  section: "sd-tech",
  title: "Blob Storage",
  goal: "Lưu file lớn ngoài database và cho client tải trực tiếp",
  needs: ["api-design", "core-db"],
  tldr: {
    t: "S3 / GCS cho file lớn: rẻ, durable, scale gần như vô hạn. DB chỉ lưu metadata + URL. Client upload/download trực tiếp qua presigned URL.",
    why: "Provider chia được dữ liệu ra hàng nghìn máy, dùng erasure coding và đĩa rẻ, vì object storage chỉ cần get/put theo key, không có index hay transaction phức tạp. DB giữ metadata vì cần query/transaction; presigned URL cho client đi thẳng tới S3 nên backend không phải chuyển byte.",
  },
  story: {
    problem: "Lưu ảnh, video vào DB làm bảng phình hàng TB, backup/replication chậm, mỗi GB tính theo giá storage SSD của DB. Upload mà đi qua backend thì mỗi video 2GB chiếm băng thông và connection của app server suốt thời gian upload.",
    idea: "Tách byte khỏi metadata: file nằm trong object store phẳng (key → bytes) thiết kế cho durability và giá rẻ, DB chỉ giữ key/URL. Client nói chuyện thẳng với object store bằng URL ký sẵn.",
    tradeoff: "Không có transaction giữa DB và blob → có thể có file mồ côi, hoặc metadata trỏ tới file chưa upload xong. Object không sửa được một phần (phải ghi lại cả object), và latency từng request cao hơn đĩa local.",
  },
  points: [
    {
      t: "**Cách dùng** — upload blob, nhận về URL; thường đi kèm CDN để tải nhanh toàn cầu.",
      why: "Mỗi object có URL ổn định nên đặt làm origin cho CDN được: lần đầu edge kéo từ S3, các lần sau user ở Singapore tải từ edge Singapore thay vì đi tới region Mỹ.",
    },
    {
      t: "**Durability** — replication và erasure coding, mất đĩa / server không mất dữ liệu.",
      why: "S3 công bố durability 11 số 9 nhờ mỗi object được chia mảnh và lưu dư trên nhiều đĩa ở nhiều AZ. Erasure coding (ví dụ 10 mảnh data + 4 mảnh parity) cho phép mất bất kỳ 4 mảnh vẫn dựng lại được, với chi phí lưu ~1.4x thay vì 3x như replication.",
    },
    {
      t: "**Scalability** — lưu và phục vụ lượng dữ liệu, request gần như không giới hạn.",
      why: "Không có điểm nghẽn chung nào, vì namespace phẳng theo key: dữ liệu chia partition theo prefix key và trải ra rất nhiều node, tải tăng thì provider tách thêm partition; không có JOIN hay index toàn cục.",
    },
    {
      t: "**Security** — mã hoá at rest và in transit.",
      why: "Mã hoá in transit (TLS) chặn nghe lén trên mạng; mã hoá at rest (SSE-S3, SSE-KMS) bảo đảm đĩa bị lấy ra khỏi datacenter cũng không đọc được. Kết hợp IAM/bucket policy để mặc định object là private.",
    },
    {
      t: "**Upload / download trực tiếp từ client** — bằng presigned URL, giải phóng băng thông backend.",
      why: "Backend không bị nghẽn băng thông và không cần scale theo dung lượng file, vì nó chỉ xử lý một request nhỏ thay vì truyền 2GB: cấp một URL có chữ ký, giới hạn quyền (PUT key cụ thể), hết hạn sau vài phút, rồi client gửi byte thẳng tới S3.",
    },
    {
      t: "**Chunking** — chia file lớn thành phần nhỏ: upload song song, resume khi lỗi giữa chừng (S3 multipart upload).",
      why: "Upload file 5GB bằng một request thì mạng chập chờn ở 90% là phải làm lại từ đầu. Chia thành part 100MB → part lỗi chỉ retry part đó, các part upload song song để tận dụng băng thông, S3 ghép lại khi complete.",
    },
    {
      t: "+ **Cost** — rẻ hơn DB nhiều lần mỗi GB; có storage class lạnh (Glacier) cho dữ liệu ít truy cập.",
      why: "Object storage tính phí theo GB-tháng thấp hơn nhiều lần storage của DB managed, vì không phải gánh index, engine transaction và ổ đĩa gắn với máy chủ DB; dữ liệu trong DB còn bị nhân thêm theo số replica và backup. Bảng giá chính thức (https://aws.amazon.com/s3/pricing/). Dữ liệu ít đọc chuyển sang lớp Glacier còn rẻ hơn: Glacier Instant Retrieval vẫn đọc trong mili giây, còn Flexible Retrieval và Deep Archive đổi lấy thời gian lấy ra từ phút đến nhiều giờ (https://aws.amazon.com/s3/storage-classes/glacier/).",
    },
  ],
  cards: [
    [
      "Vì sao không lưu video trong RDBMS?",
      "Làm phình DB, chậm backup/replication, nghẽn băng thông. Đúng cách: blob ở S3, metadata + URL ở DB.",
    ],
    [
      "Chunking giúp gì khi upload file lớn?",
      "Upload song song nhanh hơn, resume từ chunk lỗi thay vì upload lại từ đầu.",
    ],
  ],
});
