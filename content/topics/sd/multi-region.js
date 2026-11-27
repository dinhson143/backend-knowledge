BK.topic({
  id: "multi-region",
  track: "sd",
  section: "sd-core",
  title: "Multi-region & DR",
  goal: "Chọn chiến lược DR theo RPO/RTO và chạy hệ thống trên nhiều region",
  needs: ["replication", "lb-gateway-cdn"],
  tldr: {
    t: "**Multi-region** (chạy hệ thống trên nhiều region) phục vụ hai mục tiêu khác nhau: **disaster recovery** (DR, sống sót khi cả một region hỏng) và **latency thấp cho user ở xa**. Mức DR cần đạt đo bằng hai con số: **RPO** (được phép mất tối đa bao nhiêu dữ liệu, tính theo thời gian) và **RTO** (được phép ngừng phục vụ tối đa bao lâu). Bốn chiến lược theo thứ tự RPO/RTO giảm dần và độ phức tạp tăng dần: backup & restore → pilot light → warm standby → active/active.",
    why: "Khoảng cách giữa các region làm mỗi lần gọi chéo tốn hàng chục tới hàng trăm mili giây, nên không thể đồng bộ mọi lần ghi mà vẫn nhanh. Vì vậy mọi thiết kế multi-region đều phải chọn: ghi chờ region khác xác nhận (RPO gần 0, ghi chậm) hay ghi bất đồng bộ (ghi nhanh, mất vài giây dữ liệu khi region chết).",
  },
  story: {
    problem: "Hệ thống chạy 3 AZ trong một region, chịu được mất một data center. Rồi cả region gặp sự cố vài giờ: DB, queue, object storage đều không truy cập được. Không có bản sao ở nơi khác thì không có cách nào phục vụ tiếp, và dữ liệu mới nhất có thể chỉ nằm ở region đó.",
    idea: "Sao chép dữ liệu sang region khác (backup định kỳ hoặc replication liên tục) và chuẩn bị sẵn hạ tầng ở mức phù hợp với RTO: chỉ có backup và code để dựng lại, có DB chạy sẵn, có toàn bộ stack chạy thu nhỏ, hoặc nhận traffic thật ở mọi region. Chuyển traffic bằng DNS hoặc anycast khi region chính hỏng.",
    tradeoff: "Mỗi bậc RPO/RTO thấp hơn đòi thêm hạ tầng chạy thường trực, thêm phức tạp vận hành và thêm chi phí. Active/active còn kéo theo bài toán xung đột ghi giữa các region. Nhiều hệ thống chỉ cần multi-AZ trong một region: AWS ghi nhận các AZ đã cách nhau đủ xa để đa số thảm hoạ chỉ ảnh hưởng một AZ.",
  },
  table: {
    head: ["Chiến lược", "Region DR có gì", "RPO / RTO (tương đối)", "Khi nào chọn"],
    rows: [
      {
        cells: ["Backup & restore", "Bản backup (snapshot, PITR) + hạ tầng dưới dạng code", "Bằng chu kỳ backup / dài nhất", "Hệ thống không quan trọng, chịu được ngừng lâu"],
        why: "RPO bằng khoảng cách giữa hai bản backup, vì mọi thứ ghi sau bản cuối đều mất. RTO dài vì phải dựng lại hạ tầng và restore dữ liệu; AWS nhấn mạnh phải dùng infrastructure as code, nếu không thì dựng lại dễ sai và vượt RTO (https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html).",
      },
      {
        cells: ["Pilot light", "DB và storage replicate liên tục, chạy sẵn; app server chưa bật", "Bằng độ trễ replication / phải chờ bật app", "Cần RPO thấp, chấp nhận chờ bật app"],
        why: "Phần khó làm nhanh nhất (dữ liệu) luôn sẵn sàng; phần dễ dựng (app stateless) chỉ bật khi cần. AWS phân biệt: pilot light **không xử lý được request** khi chưa làm thêm bước nào.",
      },
      {
        cells: ["Warm standby", "Toàn bộ stack chạy, quy mô thu nhỏ", "Bằng độ trễ replication / chỉ chờ scale", "Cần RTO thấp, muốn test DR thường xuyên"],
        why: "Khác pilot light ở chỗ nhận traffic được ngay (ở công suất thấp) rồi scale lên. Vì stack đã chạy, có thể gửi một ít traffic thật sang để chắc chắn nó hoạt động, thay vì hy vọng nó chạy vào ngày thảm hoạ.",
      },
      {
        cells: ["Multi-site active/active", "Mọi region phục vụ traffic thật", "Gần 0 / gần 0 (trừ lỗi dữ liệu)", "Cần latency thấp toàn cầu hoặc gần như không được ngừng"],
        why: "Không có \"failover\" theo nghĩa bật region dự phòng: các region còn lại đã chạy, chỉ cần chuyển traffic khỏi region hỏng. Phức tạp nhất vì phải thiết kế cách xử lý ghi ở nhiều region. AWS lưu ý: hỏng dữ liệu (xoá nhầm, bị mã hoá) thì vẫn phải khôi phục từ backup, RPO khác 0.",
      },
    ],
  },
  points: [
    {
      t: "**Định nghĩa** (theo AWS): **RTO** là độ trễ tối đa chấp nhận được giữa lúc dịch vụ gián đoạn và lúc phục hồi; **RPO** là khoảng thời gian tối đa chấp nhận được kể từ điểm khôi phục dữ liệu gần nhất (https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/business-continuity-plan-bcp.html).",
      why: "Hai con số do nghiệp vụ quyết định, không phải do kỹ sư: thanh toán có thể cần RPO gần 0, còn thống kê nội bộ chịu được mất một ngày. AWS khuyên đừng đặt chiến lược DR đắt hơn thiệt hại mà nó phòng, trừ khi có yêu cầu pháp lý.",
    },
    {
      t: "**Ba cách xử lý ghi khi active/active** (AWS gọi là): **write global** (mọi ghi về một region, các region khác chỉ đọc gần), **write local** (ghi ở region gần nhất, đồng bộ chéo, giải xung đột), **write partitioned** (mỗi bản ghi có một region \"nhà\" theo partition key như `user_id`).",
      why: "Write global giữ dữ liệu nhất quán nhưng user ở xa ghi chậm. Write local nhanh nhưng hai region có thể sửa cùng bản ghi cùng lúc, cần quy tắc như last-writer-wins. Write partitioned tránh xung đột bằng cách đảm bảo mỗi bản ghi chỉ có một nơi ghi, và hợp với dữ liệu tự nhiên gắn với một vùng (tài khoản của user ở châu Âu).",
    },
    {
      t: "**Replication bất đồng bộ giữa region quyết định RPO**: Aurora Global Database chỉ ghi ở region chính, replicate sang tối đa 10 region phụ với độ trễ thường dưới một giây (https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html). DynamoDB global tables chế độ mặc định (MREC) ghi được ở mọi region, đồng bộ bất đồng bộ, xung đột giải bằng last writer wins (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html).",
      why: "Ghi bất đồng bộ trả lời user trước khi region khác nhận được, nên region chết đúng lúc đó thì phần chưa kịp gửi đi bị mất: RPO bằng độ trễ replication. AWS ghi rõ RPO của MREC bằng độ trễ giữa các replica, thường vài giây. Muốn RPO bằng 0 thì ghi phải chờ ít nhất một region khác xác nhận.",
    },
    {
      t: "**RPO bằng 0 có giá**: DynamoDB global tables chế độ MRSC ghi đồng bộ sang ít nhất một region khác trước khi trả lời, phải triển khai đúng 3 region (3 replica, hoặc 2 replica + 1 witness), latency ghi phụ thuộc khoảng cách giữa các region đã chọn, và không hỗ trợ transaction.",
      why: "Ghi đồng bộ nghĩa là mỗi lần ghi chịu ít nhất một round-trip giữa hai region. Cần ba nơi để luôn còn đa số khi một region chết; với hai nơi, region còn lại không phân biệt được \"bên kia chết\" với \"đường mạng đứt\". Đây là CAP trong thực tế: chọn nhất quán thì trả bằng latency và giới hạn tính năng.",
    },
    {
      t: "**Transaction không đi nguyên khối qua region**: với DynamoDB global tables MREC, `TransactWriteItems` chỉ atomic trong region gọi nó; region khác có thể thấy một phần transaction trong lúc đang replicate.",
      why: "Replication gửi từng thay đổi theo từng item, không theo đơn vị transaction. Logic đọc ở region khác (\"đơn đã tạo nhưng dòng tồn kho chưa trừ\") phải chịu được trạng thái nửa vời, hoặc mọi đọc cần nhất quán phải về region đã ghi.",
    },
    {
      t: "**Chuyển traffic**: DNS failover có health check (Route 53), anycast IP (Global Accelerator), hoặc origin failover ở CDN. AWS khuyên chỉ dùng thao tác **data plane** khi failover, và thường kích hoạt **thủ công** (nhưng tự động hoá các bước) vì failover nhầm cũng làm mất dữ liệu và availability.",
      why: "Control plane (tạo tài nguyên, đổi cấu hình, autoscaling) thường có mục tiêu availability thấp hơn data plane, và chính nó có thể hỏng cùng region. Failover tự động theo health check dễ kích hoạt vì báo động giả; mỗi lần failover với replication bất đồng bộ là mất phần dữ liệu chưa kịp sang.",
    },
    {
      t: "**Replication không thay backup**: replication liên tục chép cả lỗi (lệnh xoá nhầm, dữ liệu bị mã hoá bởi ransomware) sang region DR trong vài giây. Vẫn cần backup có point-in-time recovery, tốt nhất ở account khác.",
      why: "DR cho mất region và khôi phục sau lỗi dữ liệu là hai bài toán khác nhau. Backup ở account riêng còn chống được trường hợp chính credential của account bị lộ (AWS gợi ý tách account theo region vì lý do này).",
    },
    {
      t: "**DR chưa test là chưa có DR**: chạy failover định kỳ (game day), đo RTO thật, kiểm quota ở region DR đủ để scale lên công suất production.",
      why: "Lỗi hay gặp lúc thật sự cần: thiếu quota, AMI hay secret chưa có ở region DR, DNS TTL dài làm client bám region cũ, runbook lỗi thời. Warm standby và active/active được ưa chuộng một phần vì chúng tự \"test\" mỗi ngày bằng traffic thật.",
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"cả region sập thì sao\", hỏi lại RPO/RTO mong muốn trước, rồi chọn chiến lược tương ứng; đừng nhảy thẳng vào active/active.",
      why: "Active/active là câu trả lời đắt nhất và phức tạp nhất. Interviewer đánh giá cao việc gắn lựa chọn với yêu cầu nghiệp vụ: một hệ thống đặt vé chịu được RTO 15 phút thì warm standby là đủ.",
    },
    {
      t: "Nói rõ dữ liệu nào ghi ở đâu: \"user ghi về region nhà theo `user_id`, đọc ở region gần nhất, chấp nhận trễ vài giây\".",
      why: "Phần khó của multi-region là dữ liệu, không phải app stateless. Một câu về write global/local/partitioned cho thấy bạn biết chỗ xung đột phát sinh.",
    },
    "Tách hai lý do dùng multi-region: DR (có thể active/passive) và latency cho user toàn cầu (cần active/active hoặc ít nhất read local). Lý do khác nhau dẫn tới thiết kế khác nhau.",
  ],
  cards: [
    [
      "RPO và RTO khác nhau thế nào?",
      "RPO: được phép mất tối đa bao nhiêu dữ liệu (tính bằng thời gian từ điểm khôi phục cuối). RTO: được phép ngừng phục vụ tối đa bao lâu. Replication giảm RPO; hạ tầng chạy sẵn giảm RTO.",
    ],
    [
      "Pilot light khác warm standby ở đâu?",
      "Pilot light chỉ chạy sẵn phần dữ liệu (DB replicate), app chưa bật nên chưa nhận request được. Warm standby chạy cả stack ở quy mô nhỏ, nhận traffic ngay rồi scale lên.",
    ],
    [
      "Vì sao replication bất đồng bộ giữa region có RPO khác 0?",
      "Ghi được xác nhận trước khi region khác nhận. Region chết lúc đó thì phần đang trên đường bị mất; RPO xấp xỉ độ trễ replication.",
    ],
    [
      "Active/active ghi ở mọi region thì xung đột xử lý thế nào?",
      "Last-writer-wins (đơn giản, có thể mất ghi), CRDT/merge theo nghiệp vụ, hoặc tránh xung đột bằng write partitioned: mỗi bản ghi có một region nhà.",
    ],
    [
      "Đã replicate liên tục sang region khác, còn cần backup không?",
      "Cần. Replication chép cả lệnh xoá nhầm hay dữ liệu bị mã hoá. Backup point-in-time (ở account khác) mới quay lại được thời điểm trước lỗi.",
    ],
    [
      "Vì sao nên failover thủ công dù các bước đã tự động?",
      "Failover với replication bất đồng bộ luôn mất một ít dữ liệu và gây gián đoạn; báo động giả mà tự failover thì chịu thiệt không cần thiết. Người quyết định, máy thực hiện.",
    ],
  ],
  related: ["replica-lag"],
});
