BK.topic({
  id: "queue",
  track: "sd",
  section: "sd-tech",
  title: "Message Queue",
  tldr: {
    t: "Queue để tách producer/consumer: phân phối việc cho worker và hấp thụ traffic đột biến. Nắm 5 chủ đề: ordering, retry, DLQ, partition, backpressure.",
    why: "Producer không phải chờ consumer vì queue lưu message bền vững, và traffic đột biến chỉ làm queue dài ra thay vì làm sập worker. 5 chủ đề kia chính là những gì phát sinh khi tách rời: thứ tự, lỗi, message hỏng, song song hoá và consumer chạy chậm.",
  },
  story: {
    problem: "API gọi đồng bộ thẳng vào service xử lý chậm (gửi email, transcode video) thì một đợt spike 10x làm service đó quá tải, request timeout dây chuyền ngược lên user. Producer và consumer bị buộc phải sống, chết và scale cùng nhau.",
    idea: "Đặt một bộ đệm bền vững ở giữa: producer chỉ cần ghi message vào queue rồi trả lời ngay, consumer kéo việc ra theo tốc độ của chính nó → hai bên tách rời về thời gian, tốc độ và số lượng instance.",
    tradeoff: "Xử lý thành bất đồng bộ nên user không nhận kết quả ngay, phải có cơ chế poll/notify. Hệ thống phải chịu message trùng (at-least-once), sai thứ tự giữa partition, và thêm một thành phần cần vận hành, giám sát lag.",
  },
  points: [
    {
      t: "**Usage** — phân phối công việc trong hệ thống (worker pool); buffer cho bursty traffic.",
      why: "N worker tự cân tải mà không cần ai phân việc, vì worker kéo việc từ queue khi rảnh; thêm worker là tăng throughput. Khi spike, queue hấp thụ phần dư: 10.000 request/s vào mà worker chỉ xử lý 2.000/s thì backlog tăng tạm thời rồi xả dần, không request nào bị rơi.",
    },
    {
      t: "**Message ordering** — FIFO chỉ đảm bảo trong một partition / message group.",
      why: "Chỉ trong một partition message mới được đọc tuần tự theo offset — nhiều consumer đọc song song từ nhiều partition thì không có đồng hồ chung nào xếp thứ tự toàn cục. Muốn các event của cùng order giữ thứ tự thì phải cho chúng chung partition key / message group id.",
    },
    {
      t: "**Retry mechanisms** — retry với exponential backoff; consumer phải idempotent.",
      why: "Backoff 1s, 2s, 4s… cho downstream thời gian hồi phục, vì lỗi thường là tạm thời (DB timeout, rate limit) và retry ngay lập tức chỉ dồn thêm tải. Retry nghĩa là cùng message có thể được xử lý 2 lần (đã ghi DB nhưng chưa kịp ack), nên consumer phải idempotent, ví dụ check `message_id` đã xử lý chưa.",
    },
    {
      t: "**Dead Letter Queue** — message lỗi quá số lần retry chuyển sang DLQ để xem xét, không chặn hàng.",
      why: "Một message hỏng (poison message, sai format) lỗi mãi; cứ retry thì nó chiếm worker và, với queue FIFO, chặn mọi message phía sau. Sau N lần thất bại, đẩy nó sang DLQ → hàng chính chạy tiếp, message lỗi được giữ lại để debug và replay sau khi fix.",
    },
    {
      t: "**Scaling with partitions** — chia queue thành partition để nhiều consumer xử lý song song; partition key quyết định thứ tự.",
      why: "Một queue đơn bị giới hạn bởi throughput của một node, và chỉ một consumer đọc tuần tự mới giữ được thứ tự. Chia thành P partition thì P consumer chạy song song; partition key quyết định message nào chung partition, nên cũng quyết định nhóm message nào được giữ thứ tự với nhau.",
    },
    {
      t: "**Backpressure** — khi consumer chậm hơn producer: giới hạn kích thước queue, từ chối/làm chậm producer, autoscale consumer.",
      why: "Producer ghi 5.000 msg/s mà consumer chỉ xử lý 3.000 msg/s → queue tăng 2.000 msg/s đến khi hết bộ nhớ/đĩa hoặc độ trễ lên hàng giờ. Phải có tín hiệu đẩy ngược: chặn queue size để producer bị từ chối/chậm lại, hoặc scale consumer theo queue depth để đuổi kịp.",
    },
    {
      t: "+ Công nghệ: SQS, RabbitMQ (queue); Kafka (log/stream, cũng dùng làm queue).",
      why: "SQS và RabbitMQ xoá message sau khi consumer ack — hợp cho phân phối việc một lần. Kafka giữ message trên log theo retention, mỗi consumer group tự giữ offset, nên vừa làm queue (một group) vừa cho replay và fan-out nhiều group.",
    },
    {
      t: "+ Delivery semantics: at-most-once, **at-least-once** (phổ biến nhất, cần idempotency), exactly-once (đắt, hạn chế).",
      why: "Ack và xử lý không thể atomic trên mạng: ack trước rồi crash thì mất message (at-most-once), xử lý trước rồi crash trước khi ack thì message bị giao lại (at-least-once). **At-least-once** phổ biến vì mất dữ liệu tệ hơn trùng, và trùng thì xử lý được bằng idempotency; exactly-once cần transaction phối hợp giữa queue và nơi ghi kết quả nên chậm và chỉ chạy trong phạm vi hẹp (ví dụ Kafka transactions read-process-write trong Kafka).",
    },
  ],
  cards: [
    [
      "Dead Letter Queue dùng để làm gì?",
      "Chứa message xử lý lỗi quá số lần retry, tránh poison message chặn hàng đợi và cho phép điều tra/xử lý lại.",
    ],
    [
      "Queue đảm bảo thứ tự thế nào khi scale?",
      "Chỉ đảm bảo trong cùng partition; chọn partition key (ví dụ order_id) để message liên quan vào cùng partition.",
    ],
    [
      "Backpressure là gì?",
      "Cơ chế báo producer chậm lại khi consumer không theo kịp: giới hạn queue, reject, rate limit, hoặc autoscale consumer.",
    ],
  ],
});
