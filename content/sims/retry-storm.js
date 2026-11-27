BK.sim({
  id: "retry-storm",
  title: "Retry storm và circuit breaker",
  topics: ["resilience"],
  scenario: "Payment service bắt đầu lỗi. Client, Gateway và Order service cùng gọi xuống theo chuỗi. Ai retry, retry bao nhiêu lần quyết định Payment nhận bao nhiêu tải.",
  context: "Chuỗi gọi: **Client → Gateway → Order service → Payment**. Payment đang quá tải và trả lỗi. Mỗi tầng tự quyết có retry hay không, và **không biết** tầng trên cũng retry. Theo dõi con số dưới Payment: số lời gọi nó phải nhận cho **một** thao tác của user. Variant 2 thêm circuit breaker ở Order service.",
  nodes: [
    { id: "client", x: 90, y: 130, label: "Client" },
    { id: "gw", x: 290, y: 130, label: "Gateway" },
    { id: "order", x: 490, y: 130, label: "Order service" },
    { id: "pay", x: 700, y: 130, label: "Payment", s: "đã nhận: 0" },
  ],
  h: 260,
  variants: [
    {
      name: "Retry ở mọi tầng",
      steps: [
        {
          note: "User bấm \"Đặt hàng\" một lần. Payment trả lỗi.",
          msgs: [["client", "gw", "POST /orders"], ["gw", "order", "POST"], ["order", "pay", "charge"], ["pay", "order", "503", "err"]],
          set: { pay: "đã nhận: 1" },
          bad: ["pay"],
          detail: "Payment đang quá tải (CPU 100%, queue dài) nên trả `503`. Một thao tác của user mới tạo **1** lời gọi tới Payment.",
        },
        {
          note: "Order service retry 3 lần.",
          msgs: [["order", "pay", "charge (thử 2)", "warn"], ["order", "pay", "charge (thử 3)", "warn"], ["pay", "order", "503", "err"]],
          set: { order: "3 lần thử", pay: "đã nhận: 3" },
          detail: "Order service được cấu hình retry tối đa 3 lần cho mọi lỗi 5xx. Payment nhận **3** lời gọi, cả 3 đều lỗi. Order trả lỗi lên Gateway.",
        },
        {
          note: "Gateway cũng retry 3 lần, mỗi lần Order lại thử 3 lần.",
          msgs: [["gw", "order", "POST (thử 2, 3)", "warn"], ["order", "pay", "charge × 6", "warn"], ["pay", "order", "503", "err"]],
          set: { gw: "3 lần thử", pay: "đã nhận: 9" },
          detail: "Gateway không biết Order đã retry, nên thử lại 3 lần. Mỗi lần Order lại thử 3 lần: 3 × 3 = **9** lời gọi tới Payment.",
        },
        {
          note: "Client (SDK hoặc chính user) retry 3 lần nữa.",
          msgs: [["client", "gw", "POST (thử 2, 3)", "warn"], ["gw", "order", "POST × 6", "warn"], ["order", "pay", "charge × 18", "err"]],
          set: { client: "3 lần thử", pay: "đã nhận: 27 ❌" },
          bad: ["pay", "order", "gw"],
          lesson: "Retry nhân theo tầng: 3 tầng × 3 lần = 27 lần gọi. Builders' Library: 5 tầng × 3 lần = 243 lần.",
          detail: "Payment nhận **27** lời gọi cho một lần bấm, đúng lúc nó đang quá tải. Nhân với mọi user đang gặp lỗi, tải lên Payment tăng gấp 27 lần và nó không thể hồi phục. Trong lúc đó thread của Order và Gateway bị giữ chờ, nên các API khác dùng chung hai service này cũng chậm theo: lỗi đã lan dây chuyền.",
        },
      ],
    },
    {
      name: "Một tầng retry + circuit breaker",
      steps: [
        {
          note: "Chỉ Order service retry (tối đa 2 lần, backoff + jitter). Gateway và Client không tự retry.",
          msgs: [["client", "gw", "POST /orders"], ["gw", "order", "POST"], ["order", "pay", "charge"], ["pay", "order", "503", "err"], ["order", "pay", "charge (thử 2, sau 120ms)", "warn"], ["pay", "order", "503", "err"]],
          set: { order: "breaker: closed · lỗi 2", pay: "đã nhận: 2" },
          detail: "Chọn **một** tầng retry: Order service, vì nó biết lời gọi `charge` có idempotency key nên gửi lại an toàn. Chờ có jitter để các instance Order không retry cùng nhịp. Breaker đang **closed** và đếm lỗi trong cửa sổ thời gian gần nhất.",
        },
        {
          note: "Lỗi vượt ngưỡng trong cửa sổ → breaker **open**. Order trả fallback ngay.",
          msgs: [["gw", "order", "POST (user khác)"], ["order", "gw", "503 + Retry-After (không gọi Payment)", "warn"]],
          set: { order: "breaker: OPEN", pay: "đã nhận: 2 (đang hồi phục)" },
          detail: "Nhiều request cùng lỗi đẩy bộ đếm vượt ngưỡng, breaker chuyển **open** và bật đồng hồ. Mọi lời gọi `charge` tiếp theo bị trả lỗi **ngay**, không tốn thread chờ timeout, không thêm tải lên Payment. Order có thể trả fallback: lưu đơn ở trạng thái \"chờ thanh toán\" và xử lý sau qua queue.",
        },
        {
          note: "Hết thời gian chờ → **half-open**, cho một request thử.",
          msgs: [["order", "pay", "charge (thử nghiệm)"], ["pay", "order", "200", "ok"]],
          set: { order: "breaker: half-open · ok 1" },
          detail: "Sau thời gian chờ, breaker chuyển **half-open** và chỉ cho một số ít request đi qua. Nếu một request lỗi, breaker quay lại open và bật lại đồng hồ. Ở đây Payment đã hồi phục và trả `200`.",
        },
        {
          note: "Đủ số lần thành công → breaker **closed**, lưu lượng trở lại bình thường.",
          msgs: [["gw", "order", "POST"], ["order", "pay", "charge"], ["pay", "order", "200", "ok"], ["order", "gw", "201", "ok"]],
          set: { order: "breaker: closed", pay: "hoạt động lại" },
          good: ["pay"],
          lesson: "Retry ở một tầng giữ hệ số nhân nhỏ; breaker ngừng gọi phụ thuộc đang chết để nó có thời gian hồi phục.",
          detail: "Đủ số lần thử thành công liên tiếp thì breaker đóng và reset bộ đếm. Trong suốt sự cố, Payment chỉ nhận vài lời gọi thay vì hàng chục lần tải gốc, và thread của Order không bị giữ chờ nên các API khác vẫn chạy.",
        },
      ],
    },
  ],
});
