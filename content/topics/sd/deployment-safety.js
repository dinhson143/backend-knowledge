BK.topic({
  id: "deployment-safety",
  track: "sd",
  section: "sd-core",
  title: "Zero-downtime Deployment",
  goal: "Deploy không downtime: expand/contract, feature flag, rollback",
  needs: ["system-architecture", "ecs"],
  tldr: {
    t: "**Zero-downtime deployment** (deploy mà không ngừng phục vụ) có hai nửa. Nửa hạ tầng: thay instance dần dần (**rolling**), chạy song song hai môi trường (**blue/green**), hoặc thử trên một phần nhỏ traffic trước (**canary**); instance cũ phải được rút khỏi load balancer và tắt gọn. Nửa dữ liệu và hợp đồng: trong lúc deploy, **bản cũ và bản mới chạy cùng lúc**, nên schema DB, API và message phải tương thích cả hai chiều; đổi không tương thích thì chia thành nhiều bước **expand/contract**.",
    why: "Mọi cách deploy không downtime đều có một khoảng bản cũ và bản mới cùng phục vụ: rolling thì vài phút, canary thì vài giờ, và rollback lại mở ra khoảng đó lần nữa. Code mới đọc cột mà code cũ không ghi, hoặc code cũ crash vì cột bị đổi tên, là lỗi xảy ra **dù hạ tầng làm đúng hết**.",
  },
  story: {
    problem: "Deploy bản mới đổi tên cột `phone` thành `phone_number` trong cùng một lần: migration chạy trước, vài pod cũ còn sống vẫn `SELECT phone` và trả 500 cho tới khi bị thay hết. Rollback cũng không cứu được, vì code cũ không biết cột mới. Kiểu khác: pod bị tắt giữa request vì app không xử lý `SIGTERM`, user thấy lỗi kết nối ở mỗi lần deploy.",
    idea: "Tách **deploy** (đưa code lên máy) khỏi **release** (bật tính năng cho user) bằng feature flag. Đổi schema theo expand → migrate → contract, mỗi bước là một lần deploy riêng tương thích với bản trước nó. Đưa bản mới tới một phần nhỏ traffic trước, so số liệu với phần còn lại, tự động rollback khi xấu đi.",
    tradeoff: "Một thay đổi \"đổi tên cột\" thành 3–4 lần deploy cách nhau nhiều ngày. Code phải chịu được hai phiên bản schema trong thời gian chuyển tiếp. Feature flag là nợ kỹ thuật nếu không dọn. Blue/green cần gấp đôi tài nguyên trong lúc chuyển; canary cần đủ traffic và metric tách theo phiên bản mới so sánh được.",
  },
  table: {
    head: ["Chiến lược", "Cách làm", "Rollback", "Giá phải trả"],
    rows: [
      {
        cells: ["Rolling", "Thay dần từng nhóm instance: Kubernetes mặc định `maxSurge` 25%, `maxUnavailable` 25%", "Rolling ngược lại (`kubectl rollout undo`), mất vài phút", "Hai phiên bản cùng chạy trong suốt quá trình"],
        why: "Kubernetes tính `maxSurge` làm tròn lên và `maxUnavailable` làm tròn xuống từ phần trăm, giữ 10 ReplicaSet cũ (`revisionHistoryLimit`) để rollback, và đánh dấu deploy thất bại nếu không tiến triển trong `progressDeadlineSeconds` (mặc định 600) (https://kubernetes.io/docs/concepts/workloads/controllers/deployment/). Chi tiết cơ chế ở `k8s-core`.",
      },
      {
        cells: ["Blue/green", "Dựng đủ môi trường mới (green) bên cạnh môi trường cũ (blue), chuyển router một lần", "Chuyển router về blue, gần như tức thì", "Gấp đôi tài nguyên trong lúc chuyển; DB thường dùng chung nên vẫn cần schema tương thích"],
        why: "Rollback chỉ là đảo lại thao tác ở router, vì blue vẫn chạy nguyên vẹn (Google SRE workbook — https://sre.google/workbook/canarying-releases/). Nhưng hai môi trường cùng ghi vào một DB, nên bài toán schema y hệt rolling.",
      },
      {
        cells: ["Canary", "Đưa bản mới tới một phần nhỏ traffic, so metric với nhóm đối chứng, rồi tăng dần", "Rút canary ra; chỉ phần nhỏ user bị ảnh hưởng", "Cần metric tách theo phiên bản, đủ traffic để kết luận, chạy lâu hơn"],
        why: "Google SRE định nghĩa canary là triển khai một phần, có thời hạn, kèm đánh giá; thiệt hại tỉ lệ với phần traffic tiếp xúc. Họ khuyên dùng SLI (tỉ lệ lỗi, latency) làm metric so sánh, tách theo nhóm canary và đối chứng, và tránh so trước–sau vì thời gian tự nó là biến gây nhiễu.",
      },
      {
        cells: ["Recreate", "Tắt hết bản cũ rồi mới bật bản mới", "Deploy lại bản cũ", "Có downtime"],
        why: "Dùng khi hai phiên bản tuyệt đối không được chạy cùng lúc (ví dụ đổi định dạng file trên volume dùng chung). Có downtime theo thiết kế, nên không phải zero-downtime.",
      },
    ],
  },
  points: [
    {
      t: "**Rút instance khỏi traffic trước khi tắt**: khi pod bị xoá, Kubernetes chạy `preStop` (nếu có), rồi gửi `SIGTERM`; **song song** với việc đó, endpoint của pod được đánh dấu terminating nên load balancer thôi gửi traffic mới. Hết `terminationGracePeriodSeconds` (mặc định 30 giây) mà còn chạy thì `SIGKILL` (https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/).",
      why: "Hai việc chạy song song nên trong vài giây đầu vẫn có request tới pod đang tắt. App phải: khi nhận `SIGTERM`, ngừng nhận kết nối mới nhưng xử lý xong request đang chạy rồi mới thoát. Một `preStop` ngủ vài giây cho các load balancer kịp cập nhật là cách hay dùng; thời gian đó tính vào grace period.",
    },
    {
      t: "**Readiness probe quyết định khi nào nhận traffic**: pod không ready bị rút khỏi EndpointSlice của Service. Rolling update chỉ tiếp tục khi pod mới ready, nên readiness phải phản ánh \"sẵn sàng phục vụ thật\" (đã nạp cấu hình, kết nối được DB), không chỉ \"process còn sống\".",
      why: "Readiness luôn trả OK thì pod mới nhận traffic trước khi khởi động xong, rolling update thay hết pod cũ bằng pod chưa dùng được. Ngược lại, readiness kiểm sâu cả dependency dùng chung (DB chính) thì DB chậm một chút là mọi pod cùng not-ready, tự gây sự cố toàn bộ.",
    },
    {
      t: "**Expand/contract** (parallel change) cho thay đổi không tương thích: **expand** thêm cái mới bên cạnh cái cũ, **migrate** chuyển dần người dùng sang cái mới, **contract** xoá cái cũ khi không ai dùng (https://martinfowler.com/bliki/ParallelChange.html).",
      why: "Mỗi bước tương thích với bước trước nên deploy hay rollback từng bước đều an toàn. Đổi tên cột `phone` → `phone_number`: (1) thêm cột mới, code ghi cả hai; (2) backfill dữ liệu cũ theo lô; (3) code đọc cột mới; (4) code thôi ghi cột cũ; (5) xoá cột cũ. Bỏ qua bước nào thì có một khoảng thời gian một phiên bản code đang chạy không tương thích với schema.",
    },
    {
      t: "**Migration trên bảng lớn có thể khoá bảng**: `ALTER TABLE` mặc định lấy khoá `ACCESS EXCLUSIVE`; thêm cột có `DEFAULT` không volatile thì nhanh (giá trị lưu ở metadata), nhưng `DEFAULT` volatile như `clock_timestamp()` thì viết lại cả bảng và index (https://www.postgresql.org/docs/current/sql-altertable.html). Tạo index thì dùng `CREATE INDEX CONCURRENTLY` để không chặn ghi (https://www.postgresql.org/docs/current/sql-createindex.html).",
      why: "Khoá `ACCESS EXCLUSIVE` chặn cả `SELECT` thường (https://www.postgresql.org/docs/current/explicit-locking.html), nên câu `ALTER` phải viết lại bảng là bảng đó ngừng phục vụ suốt thời gian viết lại. Câu `ALTER` còn phải chờ mọi transaction đang dùng bảng kết thúc, và mặc định chờ vô hạn (`lock_timeout = 0`). Đặt `lock_timeout` ngắn cho migration để thất bại nhanh rồi thử lại, thay vì treo giữa giờ cao điểm.",
    },
    {
      t: "**Ràng buộc trên bảng lớn chia hai bước**: `ADD CONSTRAINT … NOT VALID` (không quét bảng, commit nhanh) rồi `VALIDATE CONSTRAINT` (quét bảng nhưng chỉ lấy khoá `SHARE UPDATE EXCLUSIVE`, không chặn ghi). `CREATE INDEX CONCURRENTLY` lỗi giữa chừng để lại index `INVALID`, phải xoá rồi tạo lại.",
      why: "Kiểm tra mọi dòng cũ là phần tốn thời gian; tách nó ra khỏi bước giữ khoá mạnh là cách giữ thời gian khoá ở mức mili giây. Index `INVALID` không được dùng để truy vấn nhưng vẫn tốn chi phí cập nhật ở mỗi lần ghi, nên phải dọn.",
    },
    {
      t: "**Feature flag tách deploy khỏi release**: code mới lên production ở trạng thái tắt, bật dần theo phần trăm user hoặc nhóm nội bộ, tắt ngay khi có sự cố mà không cần deploy lại. Fowler chia bốn loại: release (nên sống một, hai tuần), experiment, ops (kill switch), permissioning (https://martinfowler.com/articles/feature-toggles.html).",
      why: "Rollback bằng tắt flag mất vài giây, rollback bằng deploy mất vài phút và kéo theo bài toán schema. Nhưng mỗi flag là một nhánh `if` phải test cả hai phía; Fowler coi flag là hàng tồn kho có chi phí lưu giữ và khuyên đặt hạn, thêm việc gỡ flag vào backlog ngay khi tạo.",
    },
    {
      t: "**API và message cũng cần tương thích hai chiều**: thêm trường tuỳ chọn thì được; xoá trường, đổi kiểu, đổi nghĩa thì không. Consumer phải bỏ qua trường lạ; producer chỉ thôi gửi trường cũ khi mọi consumer đã thôi đọc.",
      why: "Trong lúc rolling, producer bản mới có thể gửi message cho consumer bản cũ và ngược lại; message nằm trong queue/Kafka còn sống lâu hơn cả lần deploy. Protobuf giữ tương thích nhờ số hiệu trường; đổi số hiệu là không an toàn, và trường đã xoá phải `reserved` số hiệu để không ai dùng lại (https://protobuf.dev/programming-guides/proto3/).",
    },
    {
      t: "**Rollback phải luôn khả thi**: giữ artifact bản trước, migration chỉ thêm (không xoá) trong cùng lần deploy với code mới, và tự động rollback khi metric canary vượt ngưỡng (ECS deployment circuit breaker, Kubernetes progress deadline kèm công cụ rollout).",
      why: "Migration xoá cột chạy cùng lần với code mới thì không rollback được nữa: code cũ cần cột đã mất. Đó là lý do bước contract luôn là một lần deploy riêng, sau khi bản mới đã chạy ổn đủ lâu để chắc không quay lại.",
    },
  ],
  sections: [
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Chạy migration ở lúc khởi động của mọi pod.",
          why: "N pod khởi động cùng lúc là N tiến trình cùng chạy migration, tranh khoá hoặc chạy trùng. Chạy migration như một job riêng trước khi rollout (một lần, có khoá advisory hoặc công cụ migration tự khoá).",
        },
        {
          t: "Backfill hàng triệu dòng bằng một câu `UPDATE`.",
          why: "Một transaction khổng lồ giữ khoá trên mọi dòng đã sửa, sinh lượng WAL lớn làm replica trễ, và rollback cũng lâu như lúc chạy. Backfill theo lô nhỏ (vài nghìn dòng theo khoảng id), mỗi lô một transaction.",
        },
        {
          t: "Health check của load balancer chỉ kiểm `/` trả 200.",
          why: "Bản mới khởi động được nhưng lỗi ở endpoint thật (sai cấu hình DB) vẫn được coi là khoẻ, rolling thay hết bản cũ. Canary với metric lỗi thật bắt được thứ health check không bắt được.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"deploy thế nào không downtime\", trả lời hai nửa: hạ tầng (rolling/canary, readiness, graceful shutdown) và tương thích (expand/contract cho schema, API tương thích hai chiều, feature flag).",
      why: "Phần lớn ứng viên chỉ nói nửa hạ tầng. Nửa tương thích là chỗ deploy thật sự hỏng trong thực tế, nói được nó cho thấy bạn đã từng vận hành hệ thống.",
    },
    {
      t: "Ví dụ chuẩn để kể: đổi tên cột qua 5 bước expand/contract, mỗi bước một lần deploy có thể rollback.",
      why: "Một ví dụ cụ thể thuyết phục hơn định nghĩa. Interviewer hay hỏi tiếp \"bước nào không rollback được\", trả lời: bước xoá cột cũ, nên nó đi riêng và đi cuối.",
    },
    "Phân biệt deploy và release: deploy là đưa code lên máy, release là bật cho user. Feature flag cho phép deploy hằng ngày mà release theo kế hoạch kinh doanh.",
  ],
  cards: [
    [
      "Vì sao đổi tên cột không làm được trong một lần deploy?",
      "Trong lúc rolling (và khi rollback) bản cũ và mới cùng chạy. Đổi tên một lần thì bản cũ đọc cột không còn, hoặc bản mới đọc cột chưa có. Phải expand (thêm cột, ghi cả hai) → backfill → đọc cột mới → thôi ghi cột cũ → xoá cột cũ.",
    ],
    [
      "Blue/green và canary khác nhau thế nào?",
      "Blue/green chuyển toàn bộ traffic một lần giữa hai môi trường đầy đủ, rollback bằng chuyển lại. Canary đưa bản mới tới một phần nhỏ traffic, so metric với nhóm đối chứng rồi tăng dần.",
    ],
    [
      "Pod nhận `SIGTERM` thì app nên làm gì?",
      "Ngừng nhận kết nối mới, xử lý xong request đang chạy, đóng kết nối DB/queue, rồi thoát trước khi hết grace period (mặc định 30 giây), nếu không sẽ bị `SIGKILL`.",
    ],
    [
      "Vì sao `ALTER TABLE` trên bảng lớn có thể làm cả service đứng?",
      "Nó lấy khoá `ACCESS EXCLUSIVE`, chặn cả `SELECT` thường; nếu câu lệnh phải viết lại bảng (ví dụ `DEFAULT` volatile) thì khoá giữ suốt thời gian viết lại. Dùng thao tác không viết lại bảng, chia bước `NOT VALID`/`VALIDATE`, và đặt `lock_timeout` ngắn.",
    ],
    [
      "Feature flag giúp gì cho rollback?",
      "Tắt flag là tắt tính năng trong vài giây, không cần deploy lại và không đụng schema. Đổi lại phải dọn flag sau khi release xong.",
    ],
    [
      "Bước nào trong expand/contract không rollback được?",
      "Bước contract (xoá cột/trường cũ). Vì vậy nó là một lần deploy riêng, làm sau cùng khi chắc chắn không còn quay lại bản cũ.",
    ],
  ],
});
