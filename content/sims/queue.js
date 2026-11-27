BK.sim({
  id: "queue",
  title: "Queue: retry, DLQ và backpressure",
  topics: ["queue"],
  scenario: "Order đi qua queue tới consumer. Xem chuyện gì xảy ra khi message lỗi và khi traffic đột biến.",
  context: "**Producer** đẩy order vào **Queue**, **Consumer** kéo về xử lý rồi ACK (xong, xoá message) hoặc NACK (thất bại, trả lại để thử lại). **DLQ** (Dead Letter Queue) là queue phụ chứa message đã thất bại quá số lần cho phép. Theo dõi `depth` dưới Queue (số message đang chờ) và số message trong DLQ. Variant 1 nói về message lỗi; variant 2 nói về traffic vượt sức consumer.",
  nodes: [
    { id: "producer", x: 90, y: 150, label: "Producer" },
    { id: "queue", x: 330, y: 150, label: "Queue", s: "depth 0" },
    { id: "consumer", x: 600, y: 65, label: "Consumer" },
    { id: "dlq", x: 600, y: 225, label: "Dead Letter Queue", w: 150, s: "0 msg" },
  ],
  variants: [
    {
      name: "Retry → DLQ",
      steps: [
        {
          note: "Producer đẩy `order#7` vào queue rồi trả lời user ngay.",
          msgs: [["producer", "queue", "order#7"]],
          set: { queue: "depth 1" },
          detail: "User nhận `202 Accepted` ngay, không chờ xử lý xong: producer (ví dụ Order API) ghi `order#7` vào queue, queue ghi bền message rồi xác nhận, depth lên 1. Từ đây user và consumer **tách rời**: consumer chậm hay sập thì user vẫn đặt hàng được.",
        },
        {
          note: "Consumer xử lý và gặp lỗi (dữ liệu hỏng).",
          msgs: [["queue", "consumer", "order#7"], ["consumer", "queue", "NACK", "err"]],
          bad: ["consumer"],
          detail: "Consumer nhận `order#7` nhưng xử lý lỗi do dữ liệu hỏng (ví dụ thiếu field bắt buộc, parse lỗi), nên trả NACK (hoặc không xoá message để hết visibility timeout). Message **không bị mất**: queue giữ lại và sẽ giao lại sau.",
        },
        {
          note: "Retry với **exponential backoff**: 1s → 2s → 4s.",
          msgs: [
            ["queue", "consumer", "retry 1 · 1s", "warn"],
            ["consumer", "queue", "NACK", "err"],
            ["queue", "consumer", "retry 2 · 2s", "warn"],
            ["consumer", "queue", "NACK", "err"],
            ["queue", "consumer", "retry 3 · 4s", "warn"],
            ["consumer", "queue", "NACK", "err"],
          ],
          detail: "Queue giao lại với **exponential backoff** — chờ 1s, 2s, 4s giữa các lần — nhưng `order#7` hỏng dữ liệu nên lần nào cũng NACK, retry bao nhiêu cũng vô ích. Backoff hợp với lỗi tạm thời (DB timeout, service bên ngoài 503) vì cho hệ thống phía sau thời gian hồi phục thay vì bị dội retry liên tục. Retry vô hạn thì đây là **poison message**: quay vòng mãi, tốn tài nguyên, và với queue FIFO còn chặn mọi message phía sau.",
        },
        {
          note: "Quá `maxReceiveCount=3` → chuyển sang **DLQ**, không chặn message sau.",
          msgs: [["queue", "dlq", "order#7 (poison)", "err"]],
          set: { dlq: "1 msg · cần điều tra", queue: "depth 0" },
          detail: "Số lần nhận vượt `maxReceiveCount=3` nên queue chuyển `order#7` sang DLQ và xoá khỏi queue chính; depth về 0. Message không bị vứt đi: nó nằm trong DLQ chờ người điều tra, sửa dữ liệu rồi **redrive** về queue chính. Cần alert khi DLQ > 0, nếu không DLQ thành nơi đơn hàng âm thầm biến mất mà không ai biết. (Sim vẽ 1 lần nhận + 3 retry = 4 lần nhận; với SQS `maxReceiveCount=3` message đã sang DLQ ngay sau lần nhận thứ 3.)",
        },
        {
          note: "Message tiếp theo xử lý bình thường.",
          msgs: [
            ["producer", "queue", "order#8"],
            ["queue", "consumer", "order#8"],
            ["consumer", "queue", "ACK", "ok"],
          ],
          good: ["consumer"],
          lesson: "Retry + backoff cho lỗi tạm thời; DLQ cô lập poison message. Consumer phải idempotent vì giao hàng at-least-once.",
          detail: "`order#8` vào queue, consumer xử lý thành công và ACK — `order#7` đã bị cô lập nên không làm kẹt luồng chính. Giao hàng là **at-least-once**: consumer xử lý xong nhưng chết trước khi ACK thì message được giao lại, nên consumer phải **idempotent** (ví dụ lưu `orderId` đã xử lý, hoặc UPSERT) để không trừ tiền hay gửi hàng hai lần.",
        },
      ],
    },
    {
      name: "Backpressure",
      steps: [
        {
          note: "Flash sale: producer bắn 50k msg/s, consumer chỉ xử lý 5k msg/s.",
          msgs: [
            {
              par: [["producer", "queue", "burst"], ["producer", "queue", "burst"], ["producer", "queue", "burst"]],
            },
          ],
          set: { queue: "depth 450k ⚠", consumer: "5k msg/s" },
          bad: ["queue"],
          detail: "Mỗi giây queue tăng thêm **45k message**, sau 10 giây depth đã là 450k: flash sale đẩy 50k msg/s trong khi consumer chỉ xử lý 5k msg/s. Không có queue thì 45k request/giây vượt sức sẽ timeout hoặc làm sập service phía sau.",
        },
        {
          note: "Queue làm **buffer**: user không bị lỗi, chỉ xử lý trễ.",
          msgs: [["queue", "consumer", "5k/s"]],
          detail: "Queue đóng vai **buffer**: producer vẫn ghi thành công nên user nhận phản hồi ngay, consumer vẫn kéo đều 5k/s, không quá tải. Cái giá là **độ trễ**: message cuối trong 450k phải chờ khoảng 450k / 5k = 90 giây mới được xử lý. Ổn với việc chấp nhận xử lý trễ (gửi email, cập nhật kho); không ổn với thứ cần trả lời đồng bộ.",
        },
        {
          note: "Theo dõi queue depth → **autoscale** consumer.",
          msgs: [{ par: [["queue", "consumer", "batch", "ok"], ["queue", "consumer", "batch", "ok"]] }],
          set: { consumer: "×10 instance · 50k msg/s" },
          good: ["consumer"],
          detail: "Autoscaler tăng consumer lên 10 instance, tổng 50k msg/s, dựa trên **queue depth** hoặc **tuổi của message cũ nhất** (metric chính xác hơn CPU cho consumer). Lưu ý 50k/s chỉ **bằng** tốc độ producer, nên backlog 450k ngừng tăng chứ chưa giảm; nó chỉ giảm khi burst dịu đi hoặc scale thêm. Autoscale cũng không tức thời (khởi động instance mất vài chục giây tới vài phút), và DB phía sau consumer phải chịu được tải gấp 10.",
        },
        {
          note: "Nếu vẫn vượt ngưỡng: giới hạn queue và trả **429** để producer chậm lại.",
          msgs: [["queue", "producer", "429 slow down", "warn"]],
          set: { queue: "depth 20k ✓" },
          lesson: "Queue hấp thụ burst; backpressure + autoscale giữ hệ thống không sụp.",
          detail: "Backlog vẫn vượt ngưỡng thì hệ thống giới hạn kích thước queue và trả **429 Too Many Requests** để producer chậm lại (retry với backoff) — đó là **backpressure**: đẩy tín hiệu quá tải ngược về nguồn thay vì để queue phình vô hạn. Thực tế 429 thường do API/gateway phía trước producer trả, dựa trên depth của queue, vì SQS/Kafka không tự từ chối theo depth. Cái giá: một phần user bị từ chối hoặc phải thử lại, nhưng hệ thống giữ depth quanh 20k và không sập.",
        },
      ],
    },
  ],
});
