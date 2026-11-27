BK.topic({
  id: "sync-vs-async-comm",
  track: "sd",
  section: "sd-core",
  title: "Sync vs Async Communication",
  goal: "Chọn gọi đồng bộ hay gửi message giữa service theo availability, latency và consistency",
  needs: ["api-design", "queue", "resilience"],
  tldr: {
    t: "**Sync communication** (giao tiếp đồng bộ): service A gọi B qua REST/gRPC rồi **chờ response**. **Async communication** (giao tiếp bất đồng bộ): A gửi message qua broker rồi đi tiếp, B xử lý khi nó sẵn sàng. Sync đơn giản và trả lời ngay, nhưng A chỉ chạy được khi B **cũng đang sống**, nên availability và latency **nhân dồn** theo chuỗi gọi. Async cắt sự phụ thuộc đó, đổi lại phải chịu eventual consistency, message trùng, và một broker phải luôn sống.",
    why: "Richardson ghi nhược điểm chính của gọi trực tiếp là \"reduced availability since the client and the service must be available for the duration of the interaction\" (https://microservices.io/patterns/communication-style/rpi.html), còn messaging thì \"improved availability since the message broker buffers messages until the consumer is able to process them\" (https://microservices.io/patterns/communication-style/messaging.html). Đó là toàn bộ đánh đổi: bên nào giữ request trong lúc bên kia chưa sẵn sàng, caller hay broker.",
  },
  story: {
    problem: "Đặt hàng đi qua 5 service gọi nối tiếp nhau: Order → Inventory → Payment → Shipping → Notification. Mỗi service đạt 99.9%, nhưng request chỉ thành công khi cả 5 cùng sống, nên cả chuỗi còn khoảng 99.5%, tức gần 3.6 giờ lỗi mỗi tháng thay vì 43 phút. Latency cũng cộng dồn: Notification gửi email chậm 2 giây thì user chờ thêm 2 giây chỉ để thấy chữ \"Đặt hàng thành công\".",
    idea: "Chia việc thành hai phần. Phần user **phải** biết kết quả ngay (còn hàng không, trừ tiền được không) thì gọi đồng bộ, có timeout. Phần chỉ cần **xảy ra sau** (gửi email, cập nhật search index, tính điểm thưởng) thì phát một event lên broker; consumer tự xử lý theo nhịp của nó, chết thì message vẫn nằm chờ.",
    tradeoff: "Async làm dữ liệu giữa các service lệch nhau trong một khoảng thời gian (eventual consistency), thêm broker phải chạy HA, thêm message trùng phải dedupe, và một lỗi không còn hiện ngay trong response mà nằm trong DLQ hay log của consumer. Request/reply qua messaging khó hơn nhiều so với một lời gọi HTTP.",
  },
  table: {
    head: ["Tiêu chí", "Sync (REST, gRPC)", "Async (queue, event stream)"],
    rows: [
      {
        cells: ["Ai phải sống cùng lúc", "Caller và callee, suốt lời gọi", "Producer và broker; consumer có thể chết rồi bắt kịp sau"],
        why: "Azure gọi đây là **failure isolation**: \"If the consumer fails, the sender can still send messages. The messages are picked up when the consumer recovers\", còn \"Synchronous APIs, on the other hand, require the downstream service to be available or the operation fails\" (https://learn.microsoft.com/en-us/azure/architecture/microservices/design/interservice-communication). Richardson gọi sự phụ thuộc này là runtime coupling; nhiều tài liệu gọi là temporal coupling.",
      },
      {
        cells: ["Latency user thấy", "Tổng latency của cả chuỗi gọi", "Chỉ thời gian ghi message vào broker"],
        why: "Caller sync phải chờ callee, mà callee lại chờ service sau nó, nên latency cộng theo độ sâu chuỗi. Azure nêu đúng trường hợp A gọi B, B gọi C: \"waiting on synchronous calls can add unacceptable amounts of latency\". Async trả lời sau khi broker nhận message, phần việc phía sau không nằm trên đường đi của request.",
      },
      {
        cells: ["Consistency", "Đọc được kết quả ngay sau khi gọi", "Eventual: consumer cập nhật sau một khoảng trễ"],
        why: "Lời gọi sync trả về khi callee đã làm xong, nên caller biết chắc trạng thái. Message async có thể còn nằm trong queue lúc user đọc lại; UI phải chịu được chuyện \"đơn đã đặt nhưng email chưa tới\" hoặc hiện trạng thái \"đang xử lý\".",
      },
      {
        cells: ["Ai biết có lỗi", "Caller, ngay trong response", "Consumer; caller chỉ biết nếu có kênh báo lại"],
        why: "Lỗi sync trả về cùng response nên caller quyết định ngay (retry, báo user). Lỗi async xảy ra sau khi caller đã đi tiếp: phải có retry, DLQ, và nếu nghiệp vụ cần thì một event báo thất bại hoặc bước bù (saga).",
      },
      {
        cells: ["Số bên nhận", "Một callee mỗi lời gọi", "Một (queue) hoặc nhiều subscriber (pub/sub)"],
        why: "Producer không cần biết ai nghe, nên thêm consumer mới (analytics, search) không phải sửa producer. Azure: \"adding more subscribers doesn't affect the main workflow path\". Với sync, mỗi bên nhận mới là thêm một lời gọi và thêm một chỗ có thể làm request chính lỗi.",
      },
      {
        cells: ["Request/reply", "Có sẵn: gọi rồi nhận response", "Phải tự dựng: reply queue + correlation ID"],
        why: "HTTP và gRPC vốn là request/response. Qua messaging, Azure ghi \"To send a response, you need another queue, plus a way to correlate request and response messages\". Richardson xếp đây vào issue của messaging: \"Request/reply-style communication is more complex\".",
      },
    ],
  },
  points: [
    {
      t: "**Async I/O khác async protocol.** Gọi HTTP bằng `await` hay non-blocking client vẫn là **giao tiếp đồng bộ**: caller vẫn cần response mới đi tiếp, callee chết thì thao tác vẫn lỗi.",
      why: "Azure viết rõ: \"Asynchronous I/O means the calling thread isn't blocked while the I/O completes\" và đó là chi tiết hiện thực; còn \"An asynchronous protocol means the sender doesn't wait for a response. HTTP is a synchronous protocol, even though an HTTP client might use asynchronous I/O\" (https://learn.microsoft.com/en-us/azure/architecture/microservices/design/interservice-communication). Nhầm hai khái niệm này dẫn tới tưởng đã tách phụ thuộc trong khi availability vẫn nhân dồn y như cũ.",
    },
    {
      t: "**Availability của chuỗi sync là tích availability từng service.** n service nối tiếp, mỗi cái a, thì chuỗi còn khoảng aⁿ: 0.999⁵ ≈ 0.995. Gọi **đồng thời** nhiều service (fan-out) cũng vậy nếu cần đủ mọi kết quả.",
      why: "Request chỉ thành công khi mọi service trên đường đi cùng thành công; giả sử lỗi độc lập thì xác suất là tích các xác suất. Mỗi hop sync thêm vào làm con số giảm, dù từng service rất tốt. Async bỏ một số service khỏi đường đi của request nên chúng không còn nằm trong tích này.",
    },
    {
      t: "**Gọi đồng bộ khi** user cần câu trả lời để đi tiếp (còn hàng không, thẻ có được duyệt không), khi đọc dữ liệu để hiển thị, hoặc khi bước sau phụ thuộc kết quả bước trước trong cùng request.",
      why: "Trong ví dụ Drone Delivery của Azure, Scheduler gọi REST tới các service khác vì \"the Scheduler needs to get a response from each of the downstream services. A failure in any of the downstream services means the entire operation failed\" (https://learn.microsoft.com/en-us/azure/architecture/microservices/design/interservice-communication). Đẩy những việc này qua queue chỉ thêm độ trễ và độ phức tạp mà user vẫn phải chờ.",
    },
    {
      t: "**Gửi message khi** việc phía sau được phép trễ (email, search index, analytics), cần nhiều bên nhận cùng một sự việc, cần **load leveling** (đệm đỉnh tải để consumer xử lý theo nhịp của nó), hoặc việc chạy lâu hơn timeout của request.",
      why: "Azure liệt kê đúng các lợi ích này: reduced coupling, multiple subscribers, failure isolation, responsiveness, load leveling (\"A queue can act as a buffer to level the workload\"). Mỗi lợi ích đến từ việc broker giữ message hộ: producer không phải chờ, consumer không bị dồn tải vượt sức.",
    },
    {
      t: "**Command khác event.** Command = \"hãy làm việc này\", gửi tới đúng một bên xử lý (thường qua queue). Event = \"việc này đã xảy ra\" (`OrderPlaced`), phát cho bất kỳ ai quan tâm (pub/sub).",
      why: "Command vẫn gắn producer với một consumer cụ thể và thường cần biết kết quả; event thì producer không biết ai nghe. Gọi nhầm (đặt tên event kiểu `SendEmail`) làm producer ngầm phụ thuộc vào việc của consumer, mất đúng lợi ích \"thêm subscriber không sửa producer\".",
    },
    {
      t: "**Hai trường hợp lai hay gặp.** (1) Nhận đồng bộ, xử lý bất đồng bộ: API trả `202 Accepted` kèm link trạng thái, worker xử lý sau. (2) Request/reply qua messaging: gửi request kèm **correlation ID** và địa chỉ reply queue, consumer trả lời vào reply queue với cùng ID.",
      why: "RFC 9110 §15.3.3 định nghĩa 202 là request \"has been accepted for processing\" nhưng \"the processing has not been completed\", và response nên chỉ tới một status monitor (https://www.rfc-editor.org/rfc/rfc9110#section-15.3.3). Với request/reply, Enterprise Integration Patterns dùng hai channel riêng, và mỗi reply \"should contain a Correlation Identifier\" để requestor ghép reply với request (https://www.enterpriseintegrationpatterns.com/patterns/messaging/RequestReply.html · https://www.enterpriseintegrationpatterns.com/patterns/messaging/CorrelationIdentifier.html).",
    },
    {
      t: "**Gọi sync thì luôn đặt timeout hoặc deadline**, và truyền deadline còn lại xuống các lời gọi con. gRPC mặc định **không** có deadline.",
      why: "Trang deadline của gRPC ghi \"By default, gRPC does not set a deadline\", nên client có thể chờ vô hạn; một số ngôn ngữ (Java, Go) tự truyền deadline từ RPC vào sang RPC ra, ngôn ngữ khác phải bật (https://grpc.io/docs/guides/deadlines/). Không có deadline thì một service chậm giữ thread của mọi service gọi nó; cơ chế timeout, retry, circuit breaker ở bài `resilience`.",
    },
    {
      t: "**Messaging kéo theo ba việc bắt buộc**: consumer idempotent (message có thể tới hai lần), ghi DB và phát message nguyên tử (transactional outbox), và chỗ chứa message lỗi (DLQ).",
      why: "Azure nhắc \"you must handle duplicated messages, either by de-duplicating or by making operations idempotent\". Broker giao at-least-once khi consumer crash trước ack; service ghi DB rồi publish ở hai bước riêng thì crash ở giữa mất event. Chi tiết ở `idempotency`, `outbox-cdc`, `queue`.",
    },
  ],
  sections: [
    {
      title: "Chọn theo từng bước của một luồng nghiệp vụ",
      table: {
        head: ["Bước trong \"đặt hàng\"", "Kiểu", "Vì sao"],
        rows: [
          {
            cells: ["Kiểm tra tồn kho, giữ hàng", "Sync", "User cần biết ngay còn hàng không"],
            why: "Kết quả quyết định response cho user; đẩy qua queue thì user vẫn phải chờ, chỉ thêm một vòng đi về. Đặt timeout ngắn và có phương án khi Inventory chậm (báo \"thử lại sau\").",
          },
          {
            cells: ["Trừ tiền", "Sync gọi PSP, có idempotency key", "Cần kết quả để báo thành công hay thất bại"],
            why: "Thanh toán thường phải xác nhận trong request. Timeout không cho biết tiền đã trừ chưa, nên lời gọi phải mang idempotency key để gửi lại an toàn (bài `idempotency`).",
          },
          {
            cells: ["Gửi email, push", "Async (event `OrderPlaced`)", "Trễ vài giây không sao; lỗi email không được làm hỏng đơn"],
            why: "Đưa Notification ra khỏi chuỗi sync thì nó chết cũng không làm đặt hàng lỗi, và latency gửi email không cộng vào thời gian user chờ.",
          },
          {
            cells: ["Cập nhật search, analytics, điểm thưởng", "Async (cùng event)", "Nhiều bên nhận, không ai cần trả lời"],
            why: "Một event, nhiều subscriber. Thêm consumer mới không phải sửa service Order.",
          },
        ],
      },
    },
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Chuỗi sync sâu giữa các service nội bộ (A → B → C → D cho một request đọc).",
          why: "Mỗi hop nhân availability và cộng latency, và một service chậm ở cuối chuỗi giữ thread của mọi service phía trên. Cách sửa: gom dữ liệu cần đọc về service gọi (bản sao cập nhật bằng event, xem CQRS), hoặc gọi đồng thời thay vì nối tiếp khi các lời gọi độc lập.",
        },
        {
          t: "Gửi message rồi đứng chờ reply ngay trong request của user.",
          why: "Caller vẫn phải chờ consumer, nên temporal coupling còn nguyên; chỉ thêm broker, reply queue và correlation ID. Nếu user thật sự cần câu trả lời ngay thì gọi sync; nếu không thì trả `202` và để client hỏi trạng thái sau.",
        },
        {
          t: "Coi broker là thứ \"luôn sống\".",
          why: "Richardson ghi nhược điểm của messaging là broker \"must be highly available\". Broker chết thì mọi producer cùng lỗi, nên broker cần replication và producer cần biết làm gì khi publish lỗi (outbox giữ event trong DB cho tới khi gửi được).",
        },
        {
          t: "Mặc định consumer nhận message đúng thứ tự gửi.",
          why: "Thứ tự chỉ được giữ trong phạm vi broker hứa (một partition Kafka, một FIFO queue) và với một consumer mỗi phạm vi đó; retry và nhiều consumer làm thứ tự đảo. Dữ liệu cần thứ tự thì chọn partition key theo thực thể (`order_id`) hoặc mang version trong message để consumer bỏ bản cũ.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi vẽ HLD, ghi rõ trên từng mũi tên giữa service là sync hay async. Mũi tên sync phải có timeout; mũi tên async phải nói broker nào và ai consume.",
      why: "Interviewer hay hỏi \"service X chết thì request này ra sao?\". Có nhãn trên mũi tên thì trả lời được ngay: sync thì request lỗi (hoặc fallback), async thì message chờ trong broker.",
    },
    {
      t: "Nói con số: \"5 service sync nối tiếp, mỗi cái 99.9%, cả chuỗi còn khoảng 99.5%\".",
      why: "Một phép nhân cho thấy bạn hiểu vì sao microservices gọi nhau quá nhiều thì kém ổn định hơn monolith, và dẫn tự nhiên sang việc đưa các bước không cần ngay ra khỏi đường đi của request.",
    },
    "Đừng trả lời \"dùng Kafka cho mọi thứ\". Nói bước nào cần kết quả ngay (sync), bước nào được trễ (async), và cái giá của async (eventual consistency, duplicate, DLQ).",
  ],
  cards: [
    [
      "5 service gọi nối tiếp, mỗi service availability 99.9%. Cả chuỗi bao nhiêu?",
      "Khoảng 0.999⁵ ≈ 99.5% (giả sử lỗi độc lập). Trên một tháng 30 ngày: khoảng 3.6 giờ lỗi so với khoảng 43 phút của một service.",
    ],
    [
      "Client gọi HTTP bằng async/await có phải là giao tiếp bất đồng bộ không?",
      "Không. Đó là async I/O (thread không bị chặn). Về kiến trúc vẫn là sync: caller cần response, callee chết thì thao tác lỗi.",
    ],
    [
      "Khi nào bắt buộc gọi đồng bộ?",
      "Khi kết quả quyết định response cho user hoặc bước tiếp theo trong cùng request: kiểm tra tồn kho, duyệt thanh toán, đọc dữ liệu để hiển thị.",
    ],
    [
      "Làm request/reply qua message broker thế nào?",
      "Requestor gửi message kèm correlation ID và tên reply queue; consumer xử lý rồi gửi reply vào reply queue với cùng correlation ID; requestor ghép reply với request theo ID.",
    ],
    [
      "Chuyển một lời gọi sync sang event thì phải thêm gì?",
      "Consumer idempotent (message trùng), outbox để ghi DB và publish nguyên tử, retry + DLQ, và chấp nhận eventual consistency ở UI.",
    ],
    [
      "Command và event khác nhau thế nào?",
      "Command: \"làm việc này\", một bên xử lý, thường cần biết kết quả. Event: \"việc này đã xảy ra\", phát cho mọi subscriber, producer không biết ai nghe.",
    ],
  ],
  related: ["long-task", "queue", "retry-storm"],
});
