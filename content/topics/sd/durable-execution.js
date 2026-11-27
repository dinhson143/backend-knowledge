BK.topic({
  id: "durable-execution",
  track: "sd",
  section: "sd-patterns",
  title: "Durable Execution",
  goal: "Chạy quy trình nhiều bước sống qua crash, deploy và chờ nhiều ngày",
  needs: ["queue", "idempotency"],
  tldr: {
    t: "Viết quy trình nhiều bước như **một hàm tuần tự**. Engine ghi kết quả từng bước vào **event history** bền. Worker chết thì worker khác **replay** code từ đầu theo history, bỏ qua bước đã xong và đi tiếp đúng chỗ dừng. Đổi lại: code workflow phải **deterministic**, mọi I/O nằm trong activity/step, và activity phải idempotent vì có thể chạy lại.",
    why: "Trạng thái của một quy trình dài (\"đã trừ tiền, chưa giữ hàng, đang chờ tài xế\") phải nằm ở đâu đó bền hơn RAM của một process. Durable execution đặt nó vào event history và dựng lại bằng cách chạy lại code: vì code deterministic và kết quả I/O được lấy từ history, lần chạy lại đi đúng con đường cũ và dừng ở đúng bước chưa xong.",
  },
  story: {
    problem: "Quy trình đặt hàng: trừ tiền → giữ hàng → gọi giao hàng → chờ khách xác nhận tối đa 7 ngày → hoàn tiền nếu huỷ. Tự làm bằng queue + bảng trạng thái + cron: mỗi bước cần retry riêng, mỗi lần chờ cần một job quét, trạng thái nằm rải ở nhiều bảng, và crash giữa bước 2 và 3 cần code khôi phục riêng. Debug một đơn kẹt nghĩa là ghép log của 4 service.",
    idea: "Engine (Temporal, AWS Step Functions, Lambda durable functions) lưu lại mọi bước đã xong. Code workflow chỉ điều phối; việc có side effect nằm trong activity được engine retry theo policy. \"Chờ 7 ngày\" là một timer bền: không giữ thread hay máy nào. Saga viết bằng `try/catch` ngay trong workflow.",
    tradeoff: "Thêm một hệ thống phải vận hành (hoặc phụ thuộc dịch vụ managed). Code workflow chịu ràng buộc determinism, và đổi code khi còn workflow đang chạy cần versioning, đây là cái giá vận hành lớn nhất. History dài thì replay chậm, phải Continue-As-New. Activity vẫn at-least-once nên lời gọi ra ngoài vẫn cần idempotency key.",
  },
  table: {
    head: ["Cách làm", "Trạng thái nằm ở đâu", "Hợp khi", "Đau ở đâu"],
    rows: [
      {
        cells: ["Queue + bảng trạng thái + cron", "Bảng `orders.status` + message trong queue", "Luồng 2–3 bước, ít nhánh", "Mỗi bước tự retry, mỗi lần chờ một job quét; logic khôi phục viết tay"],
        why: "Dễ bắt đầu vì chỉ dùng thứ đã có. Nhưng mỗi bước thêm một trạng thái, một consumer và một đường khôi phục; số tổ hợp \"crash ở đâu thì làm gì\" tăng nhanh theo số bước.",
      },
      {
        cells: ["Saga choreography", "Rải ở các service, mỗi service phản ứng với event", "Ít bước, các service độc lập, không cần nhìn tổng thể", "Không chỗ nào biết quy trình đang ở bước nào; debug phải ghép event"],
        why: "Không có điều phối trung tâm nên không có điểm chết chung, nhưng luồng nghiệp vụ chỉ tồn tại ngầm trong chuỗi event. Mỗi service cần outbox để phát event tin cậy (xem Outbox & CDC).",
      },
      {
        cells: ["Workflow engine (durable execution)", "Event history của từng workflow trong engine", "Nhiều bước, nhiều nhánh, chờ lâu, cần compensation và audit", "Ràng buộc determinism, versioning khi đổi code, thêm hệ thống"],
        why: "Quy trình nằm trong một hàm đọc được từ trên xuống, engine lo retry, timer và khôi phục. Xem trạng thái một đơn kẹt = mở history của workflow đó.",
      },
    ],
  },
  points: [
    {
      t: "**Event history và replay**: mỗi lệnh workflow phát ra (gọi activity, đặt timer) được engine ghi thành event bền. Temporal mô tả event history là log đầy đủ và bền của mọi thứ đã xảy ra trong một lần chạy workflow; worker crash thì worker dùng history để replay code, dựng lại trạng thái và đi tiếp từ chỗ lỗi \"như thể lỗi chưa từng xảy ra\" (https://docs.temporal.io/encyclopedia/event-history).",
      why: "Không lưu biến cục bộ hay stack, chỉ lưu **kết quả** của từng bước. Khi replay, gặp lời gọi activity đã có kết quả trong history thì engine trả luôn kết quả đó thay vì gọi lại, nên code chạy tới đúng chỗ chưa có kết quả với đúng trạng thái như trước khi crash.",
    },
    {
      t: "**Determinism**: cùng input thì code workflow phải phát ra cùng chuỗi lệnh theo cùng thứ tự. Không đọc giờ hệ thống, không `random()`, không gọi I/O trực tiếp; dùng API của SDK hoặc đưa vào activity. Khi replay, lệnh do code sinh ra được so với history; lệch thì Temporal báo **non-deterministic error** (https://docs.temporal.io/workflow-definition).",
      why: "Replay chỉ đúng khi lần chạy lại đi đúng con đường cũ. `if (now() > deadline)` có thể ra kết quả khác ở lần replay vì giờ đã khác, khiến code rẽ sang nhánh chưa từng chạy và không khớp history. API thời gian và random của SDK ghi giá trị vào history ở lần đầu và trả lại đúng giá trị đó khi replay.",
    },
    {
      t: "**Activity/step là nơi có side effect, và có thể chạy nhiều lần.** Temporal khuyên activity idempotent vì activity có thể được retry, kể cả khi worker không kịp báo kết quả; gợi ý idempotency key = Workflow Run Id + Activity Id, ổn định qua các lần retry và khác nhau giữa các workflow (https://docs.temporal.io/activity-definition).",
      why: "Worker gọi PSP thành công rồi chết trước khi kết quả được ghi vào history: với engine, activity chưa xong, nên nó chạy lại. Engine chỉ đảm bảo kết quả được **ghi nhận** một lần; còn việc PSP không trừ tiền hai lần là nhờ idempotency key mà PSP kiểm tra. \"Exactly-once\" chỉ đúng bên trong engine, ở biên vẫn là at-least-once (xem Idempotency).",
    },
    {
      t: "**Timer bền và chờ tín hiệu**: \"chờ 7 ngày\" hay \"chờ người duyệt\" là một bước của workflow, không giữ thread. Lambda durable functions: lệnh wait tạm dừng function mà không tính phí compute trong lúc chờ (https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html). Temporal: timer được lưu bền, worker không tốn thêm tài nguyên khi chờ, và timer vẫn kích hoạt dù worker hay chính Temporal Service tạm sập (https://docs.temporal.io/workflow-execution/timers-delays). Workflow đang chạy nhận **signal** (gửi bất đồng bộ, không chờ kết quả), trả lời **query** (đọc trạng thái đồng bộ) và **update** (ghi đồng bộ, theo dõi được) (https://docs.temporal.io/sending-messages).",
      why: "Timer được lưu trong engine như một event, nên worker có thể chết, deploy, scale về 0 trong lúc chờ; tới giờ engine đánh thức workflow trên worker bất kỳ. Tự làm thì cần cron quét bảng \"đơn quá hạn\" và xử lý trường hợp cron chạy trùng.",
    },
    {
      t: "**Đổi code khi workflow đang chạy**: workflow chạy 7 ngày sẽ gặp vài lần deploy. Temporal có hai cách: **Worker Versioning** (giữ worker gắn với một phiên bản code, cách được khuyên dùng) và **patching** (`patched`/`GetVersion` rẽ nhánh theo phiên bản ngay trong code).",
      why: "Thêm hay đổi thứ tự một lời gọi activity làm workflow cũ replay ra chuỗi lệnh khác history và lỗi non-determinism. Phải để workflow cũ chạy hết trên code cũ, hoặc rẽ nhánh rõ ràng; và test bằng cách replay history thật trước khi deploy.",
    },
    {
      t: "**History dài → Continue-As-New**: lưu trạng thái cần thiết, kết thúc lần chạy hiện tại và bắt đầu lần chạy mới cùng Workflow Id, Run Id mới, history mới (https://docs.temporal.io/workflow-execution/continue-as-new). Dùng cho workflow lặp mãi (poll định kỳ, xử lý từng lô).",
      why: "History có giới hạn kích thước, và replay chạy lại từ event đầu tiên nên chậm dần theo độ dài. Continue-As-New còn giúp workflow sống lâu chuyển sang code mới ở lần chạy kế, tránh mắc kẹt ở phiên bản cũ.",
    },
    {
      t: "**Saga trên workflow**: compensation viết bằng `try/catch` trong workflow: trừ tiền xong, giữ hàng lỗi → gọi activity hoàn tiền. Toàn bộ luồng và nhánh bù nằm trong một hàm.",
      why: "Khác choreography, thứ tự compensation và điều kiện kích hoạt hiển nhiên trong code, và engine bảo đảm nhánh bù chạy tới xong kể cả khi worker chết giữa chừng. Xem sim Saga để so với cách rải event.",
    },
    {
      t: "**Khi không nên dùng**: luồng ngắn, đồng bộ, trong một service (một transaction DB là đủ); luồng sự kiện thông lượng rất cao mỗi sự kiện chỉ một bước (stream processing hợp hơn).",
      why: "Mỗi bước workflow là một lần ghi vào history, nên chi phí và latency thêm vào chỉ đáng khi quy trình đủ dài hoặc đủ quan trọng để cần khôi phục tự động.",
    },
  ],
  table2Title: "Các lựa chọn",
  table2: {
    head: ["Engine", "Mô hình", "Ngữ nghĩa và giới hạn"],
    rows: [
      {
        cells: ["Temporal", "Workflow-as-code, tự host hoặc dịch vụ cloud", "Replay theo event history; activity at-least-once"],
        why: "Workflow viết bằng ngôn ngữ thường (Go, Java, TypeScript, Python…), nên nhánh, vòng lặp, `try/catch` dùng tự nhiên. Cái giá là ràng buộc determinism nằm trong tay lập trình viên.",
      },
      {
        cells: ["AWS Step Functions Standard", "State machine định nghĩa bằng Amazon States Language", "Tối đa 1 năm; exactly-once theo state (trừ khi khai báo `Retry`); history xem được 90 ngày sau khi xong"],
        why: "AWS nói mô hình exactly-once của Standard hợp để điều phối thao tác **không idempotent** như xử lý thanh toán, vì task và state không chạy quá một lần trừ khi bạn khai báo `Retry` (https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html).",
      },
      {
        cells: ["AWS Step Functions Express", "Như trên, cho tải lớn", "Tối đa 5 phút; async: at-least-once; sync: at-most-once; không lưu history (dùng CloudWatch Logs)"],
        why: "Express không lưu trạng thái giữa các bước nên rẻ và nhanh cho tải lớn, đổi lại một execution async có thể chạy hơn một lần. Hợp với thao tác idempotent như biến đổi dữ liệu rồi `PUT` vào DynamoDB.",
      },
      {
        cells: ["Lambda durable functions", "Checkpoint/replay ngay trong Lambda, viết bằng SDK", "Tối đa 1 năm; step có retry; wait không tính phí compute"],
        why: "Cùng ý tưởng replay: khi chạy lại, code chạy từ đầu nhưng bỏ qua checkpoint đã xong và dùng kết quả đã lưu (https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html). Hợp khi logic gắn chặt với code ứng dụng trên Lambda.",
      },
    ],
  },
  tips: [
    {
      t: "Trong bài có quy trình nhiều bước (Payment System, Ride Sharing, Ticket Booking), nói: \"Tôi điều phối bằng workflow engine; mỗi bước là activity idempotent có key; chờ thì dùng timer bền; lỗi thì compensation trong workflow\".",
      why: "Câu này trả lời trước ba câu hỏi interviewer hay hỏi: worker chết giữa chừng thì sao, gọi ra ngoài có bị trùng không, và chờ lâu giữ tài nguyên gì.",
    },
    {
      t: "Nếu interviewer hỏi \"vì sao không tự làm bằng queue\", so sánh theo số bước và số lần chờ: 2 bước thì queue đủ; 6 bước có chờ và có bù thì engine rẻ hơn về lâu dài.",
      why: "Interviewer muốn nghe bạn biết cái giá của engine (vận hành, determinism, versioning), không phải chỉ biết tên Temporal.",
    },
  ],
  cards: [
    [
      "Vì sao `random()` hay `now()` trong code workflow làm hỏng replay?",
      "Replay chạy lại code và so chuỗi lệnh với history. Giá trị ngẫu nhiên hay giờ hiện tại khác lần đầu có thể đổi nhánh, sinh lệnh không khớp → non-deterministic error. Dùng API của SDK để giá trị được ghi vào history.",
    ],
    [
      "Worker chết sau khi activity \"charge\" đã gọi PSP nhưng trước khi kết quả vào history. Chuyện gì xảy ra, cái gì ngăn trừ tiền hai lần?",
      "Engine coi activity chưa xong và retry. Thứ ngăn trừ hai lần là idempotency key (ví dụ Run Id + Activity Id) gửi sang PSP, để PSP nhận ra lần trùng.",
    ],
    [
      "Step Functions Standard và Express khác ở ngữ nghĩa thực thi nào?",
      "Standard: exactly-once theo state, tối đa 1 năm, có history. Express: tối đa 5 phút, async at-least-once, sync at-most-once, không lưu history. Standard cho thao tác không idempotent; Express cho tải lớn idempotent.",
    ],
    [
      "Khi nào dùng Continue-As-New?",
      "Khi history dài dần (workflow lặp mãi, nhiều activity): bắt đầu lần chạy mới cùng Workflow Id với trạng thái mang theo, để replay không chậm, không chạm giới hạn history và chuyển sang code mới.",
    ],
    [
      "Thêm một activity vào giữa workflow rồi deploy. Workflow đang chạy bị gì?",
      "Replay sinh chuỗi lệnh khác history → lỗi non-determinism. Phải dùng Worker Versioning (workflow cũ chạy trên worker cũ) hoặc patching để rẽ nhánh theo phiên bản.",
    ],
    [
      "Saga choreography và saga trên workflow engine: debug khác nhau thế nào?",
      "Choreography: luồng rải trong event của nhiều service, phải ghép log để biết đơn đang ở đâu. Workflow: mở history của một workflow là thấy từng bước, kết quả và chỗ lỗi.",
    ],
  ],
  related: ["saga", "long-task", "idem-retry"],
});
