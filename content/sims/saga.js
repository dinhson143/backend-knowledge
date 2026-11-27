BK.sim({
  id: "saga",
  title: "Saga: rollback khi bước 3 thất bại",
  topics: ["patterns"],
  scenario: "Đặt hàng qua 3 service: tạo order → trừ tiền → giữ hàng. Kho đã hết.",
  context: "**Saga** chia nghiệp vụ thành chuỗi **local transaction**, mỗi bước có một **compensating action** (hành động bù) để huỷ tác dụng nếu bước sau thất bại. Cần vậy vì đơn hàng chạm 3 service, mỗi service có **database riêng** — không transaction chung nào bao trọn cả 3 (không có `ROLLBACK` xuyên service). Variant 1 dùng **orchestrator** ra lệnh từng bước; variant 2 dùng **choreography**: các service tự nghe event trên Kafka. Theo dõi dòng chữ dưới Order Svc và Payment Svc: trạng thái trung gian (PENDING, charged) rồi trạng thái sau khi bù (CANCELLED, refunded).",
  nodes: [
    { id: "orch", x: 400, y: 60, label: "Saga Orchestrator", w: 170 },
    { id: "order", x: 130, y: 225, label: "Order Svc" },
    { id: "pay", x: 400, y: 225, label: "Payment Svc" },
    { id: "inv", x: 670, y: 225, label: "Inventory Svc", s: "stock=0" },
  ],
  variants: [
    {
      name: "Orchestration",
      steps: [
        {
          note: "Orchestrator tạo order **PENDING**.",
          msgs: [["orch", "order", "create order"], ["order", "orch", "PENDING", "ok"]],
          set: { order: "order#1 PENDING" },
          detail: "Order Svc tạo `order#1` ở trạng thái **PENDING** theo lệnh của orchestrator, commit transaction cục bộ trong DB của nó. PENDING là \"chưa chốt\": UI không được báo đặt hàng thành công, các luồng khác (giao hàng, gửi email) phải bỏ qua đơn này. Orchestrator ghi saga đang ở bước 1 vào **saga log** của nó, để nếu chính orchestrator restart thì biết làm tiếp từ đâu.",
        },
        {
          note: "Bước 2: trừ tiền.",
          msgs: [["orch", "pay", "charge $50"], ["pay", "orch", "charged", "ok"]],
          set: { pay: "charged $50" },
          detail: "Payment Svc trừ $50 và commit trong DB của nó — tiền đã thật sự bị trừ, không còn \"tạm\". Lời gọi nên kèm **idempotency key** (ví dụ `saga#1-step2`): orchestrator timeout và gọi lại thì Payment Svc nhận ra và không trừ lần hai. Lúc này hệ thống lệch tạm thời: tiền đã trừ nhưng chưa chắc có hàng.",
        },
        {
          note: "Bước 3: giữ hàng — **hết hàng**.",
          msgs: [["orch", "inv", "reserve"], ["inv", "orch", "OUT_OF_STOCK", "err"]],
          bad: ["inv"],
          detail: "Inventory trả `OUT_OF_STOCK` vì `stock=0` — lỗi nghiệp vụ, không phải lỗi mạng, nên retry vô ích. Vấn đề: bước 1 và 2 **đã commit** trong 2 database khác nhau, không rollback được như một transaction. Dừng ở đây thì user bị trừ $50 cho đơn không bao giờ giao — lệch dữ liệu thật, không cơ chế nào tự sửa.",
        },
        {
          note: "Không có rollback phân tán → chạy **compensating action** theo thứ tự ngược: hoàn tiền.",
          msgs: [["orch", "pay", "refund $50", "warn"], ["pay", "orch", "refunded", "ok"]],
          set: { pay: "refunded $50" },
          detail: "Orchestrator chạy compensation **theo thứ tự ngược** các bước đã thành công: bước 2 trước (hoàn tiền), rồi bước 1. Refund là một transaction mới, không xoá giao dịch charge: sổ sách còn cả `charged $50` lẫn `refunded $50`, có dấu vết kiểm toán. Compensation **bắt buộc phải thành công cuối cùng**: orchestrator retry tới khi được, nên Payment Svc cũng phải xử lý refund idempotent để retry không hoàn tiền hai lần.",
        },
        {
          note: "Huỷ order. Hệ thống về trạng thái nhất quán.",
          msgs: [["orch", "order", "cancel", "warn"]],
          set: { order: "order#1 CANCELLED" },
          lesson: "Saga: mỗi bước là local transaction có compensation. Orchestration dễ theo dõi, có điểm điều phối trung tâm.",
          detail: "Ba service giờ nhất quán: đơn huỷ, tiền đã hoàn, kho không đổi. Orchestrator gọi Order Svc chuyển `order#1` sang **CANCELLED** và đánh dấu saga kết thúc trong saga log. Lưu ý đây là **eventual consistency**: trong vài trăm ms giữa bước 2 và bước 4, user có thể thấy tiền bị trừ — Saga không có isolation như ACID, nên UI cần hiển thị trạng thái \"đang xử lý\". Ưu điểm của orchestration: toàn bộ luồng nằm một chỗ, dễ đọc, dễ biết saga đang kẹt ở bước nào.",
        },
      ],
    },
    {
      name: "Choreography",
      nodes: [
        { id: "orch", x: 400, y: 60, label: "Event Bus (Kafka)", w: 170 },
        { id: "order", x: 130, y: 225, label: "Order Svc" },
        { id: "pay", x: 400, y: 225, label: "Payment Svc" },
        { id: "inv", x: 670, y: 225, label: "Inventory Svc", s: "stock=0" },
      ],
      steps: [
        {
          note: "Order Svc tạo order và phát event.",
          msgs: [["order", "orch", "OrderCreated"]],
          set: { order: "order#1 PENDING" },
          detail: "Order Svc tạo `order#1` **PENDING** trong DB của nó và phát event `OrderCreated` lên Event Bus (Kafka) — không còn orchestrator. Để tránh ghi DB xong mà publish event thất bại (hoặc ngược lại), thực tế dùng **transactional outbox**: ghi order và event vào cùng một transaction DB, một tiến trình khác đẩy event lên Kafka. Order Svc không biết ai sẽ phản ứng với event này.",
        },
        {
          note: "Payment nghe event, tự trừ tiền, phát event mới.",
          msgs: [["orch", "pay", "OrderCreated"], ["pay", "orch", "PaymentDone", "ok"]],
          set: { pay: "charged $50" },
          detail: "Payment Svc tự trừ $50 khi nhận `OrderCreated` từ topic nó subscribe, rồi phát `PaymentDone`. Không ai ra lệnh cho Payment — nó tự biết \"có order mới thì thu tiền\". Kafka giao **at-least-once** nên Payment có thể nhận cùng event hai lần, phải dedupe theo order id để không trừ tiền hai lần.",
        },
        {
          note: "Inventory nghe event — hết hàng.",
          msgs: [["orch", "inv", "PaymentDone"], ["inv", "orch", "StockFailed", "err"]],
          bad: ["inv"],
          detail: "Inventory Svc nghe `PaymentDone`, thử giữ hàng nhưng `stock=0`, nên phát `StockFailed`. Như variant orchestration, order và payment đã commit — nhưng ở đây **không ai nắm toàn cảnh** để biết cần huỷ những gì; trách nhiệm bù trừ nằm rải rác trong từng service.",
        },
        {
          note: "Payment và Order **tự** nghe `StockFailed` để bù trừ.",
          msgs: [{ par: [["orch", "pay", "StockFailed", "warn"], ["orch", "order", "StockFailed", "warn"]] }],
          set: { pay: "refunded $50", order: "order#1 CANCELLED" },
          lesson: "Choreography: không có điểm trung tâm, service lỏng lẻo — nhưng luồng khó nhìn và khó debug.",
          detail: "Hệ thống về trạng thái nhất quán mà không cần điểm điều phối trung tâm: Payment Svc và Order Svc mỗi bên tự subscribe `StockFailed` và chạy song song — Payment hoàn $50, Order chuyển `order#1` sang **CANCELLED**. Thêm service mới chỉ cần subscribe event. Cái giá: muốn biết \"đơn #1 đang ở bước nào\" phải ghép log từ nhiều service (cần distributed tracing, correlation id), và dễ tạo vòng event khó debug khi số bước tăng. Thiết kế chặt hơn thường cho Order Svc huỷ đơn khi nghe `PaymentRefunded` thay vì `StockFailed`, để đơn chỉ CANCELLED sau khi tiền đã thật sự hoàn.",
        },
      ],
    },
  ],
});
