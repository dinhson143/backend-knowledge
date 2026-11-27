BK.topic({
  id: "idempotency",
  track: "sd",
  section: "sd-core",
  title: "Idempotency",
  goal: "Cho phép gửi lại request/message mà không xử lý hai lần",
  needs: ["api-design", "queue"],
  tldr: {
    t: "Mạng chỉ hứa **at-least-once**: timeout không cho biết request đã chạy hay chưa, nên phải gửi lại. \"Exactly-once\" ngoài đời = at-least-once + **xử lý idempotent**. Server lưu kết quả lần đầu theo **idempotency key**; lần gửi lại cùng key thì trả lại kết quả đó thay vì chạy lại.",
    why: "Client không phân biệt được \"request mất trên đường đi\" với \"request đã chạy xong nhưng response mất\", vì cả hai đều chỉ hiện ra là timeout. Không gửi lại thì có thể mất thao tác; gửi lại mà server không nhận ra lần trùng thì thao tác chạy hai lần. Idempotency chuyển việc nhận ra lần trùng sang server, nơi duy nhất biết thao tác đã xảy ra hay chưa.",
  },
  story: {
    problem: "Client gọi `POST /charges` 100.000đ, chờ 5 giây không thấy trả lời rồi bấm thử lại. Thực ra lần đầu đã trừ tiền xong, chỉ có response bị mất do mạng. Lần thứ hai trừ thêm 100.000đ. Queue, Kafka, cron retry đều có cùng bài toán: message được giao lại sau crash hay rebalance.",
    idea: "Client gắn một **key duy nhất** cho mỗi thao tác logic (không phải mỗi lần gửi). Server ghi key cùng kết quả **trong cùng transaction** với thay đổi nghiệp vụ. Lần sau gặp lại key thì trả kết quả đã lưu. Phía consumer làm tương tự bằng bảng message đã xử lý hoặc upsert theo khoá tự nhiên.",
    tradeoff: "Thêm một bảng (hoặc một cột unique) phải ghi ở mọi thao tác có side effect, thêm chính sách hết hạn key, và phải xử lý hai request cùng key đến song song. Key chỉ có tác dụng trong phạm vi server lưu nó: gọi ra hệ thống bên thứ ba thì phải chuyển tiếp key sang đó.",
  },
  table: {
    head: ["Thao tác", "Tự nhiên idempotent?", "Gửi lại an toàn khi nào"],
    rows: [
      {
        cells: ["`GET`, `PUT`, `DELETE`", "Có, theo định nghĩa của HTTP", "Gửi lại tự động được"],
        why: "RFC 9110 §9.2.2 định nghĩa idempotent là \"tác động dự kiến lên server của nhiều request giống nhau bằng tác động của một request\", và liệt kê PUT, DELETE cùng các method safe (https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2). PUT ghi đè toàn bộ tài nguyên bằng cùng một giá trị nên lần hai không đổi gì. Lưu ý: đây là **hợp đồng** của method; server cài PUT mà mỗi lần tăng version hay gửi email thì vẫn hỏng.",
      },
      {
        cells: ["`POST /charges`, `x = x + 1`, `INSERT` không khoá", "Không", "Chỉ khi có idempotency key hoặc khoá duy nhất"],
        why: "Mỗi lần chạy tạo thêm một bản ghi hoặc cộng thêm một lần, vì thao tác phụ thuộc trạng thái hiện tại. RFC 9110 nói client **không nên** tự gửi lại method không idempotent trừ khi có cách biết request chưa từng được áp dụng. Idempotency key chính là cách đó.",
      },
      {
        cells: ["`SET balance = 5`, `UPSERT` theo khoá tự nhiên", "Có", "Gửi lại tự động được"],
        why: "Gán giá trị tuyệt đối hoặc upsert theo khoá cho cùng kết quả dù chạy bao nhiêu lần, vì kết quả không phụ thuộc trạng thái trước đó. Nhiều consumer biến thao tác cộng dồn thành gán giá trị (\"đặt tổng của cửa sổ 10:00 = 42\") chính để được idempotent miễn phí.",
      },
      {
        cells: ["Gọi API bên thứ ba (PSP, email, SMS)", "Tuỳ bên đó", "Chỉ khi bên đó nhận idempotency key"],
        why: "Key của bạn không bảo vệ được side effect nằm ngoài DB của bạn. Nếu PSP nhận key (ví dụ header `Idempotency-Key` của Stripe) thì chuyển tiếp key của thao tác sang; nếu không, phải dựa vào đối soát sau đó.",
      },
    ],
  },
  points: [
    {
      t: "**Idempotency key do client sinh**, một key cho một thao tác logic (ví dụ UUID v4 sinh khi user bấm \"Thanh toán\"), gửi kèm mọi lần thử lại. Stripe gợi ý UUID v4, dài tối đa 255 ký tự, và không dùng dữ liệu nhạy cảm như email làm key (https://docs.stripe.com/api/idempotent_requests).",
      why: "Key phải sinh **trước lần gửi đầu** và giữ nguyên qua các lần retry, vì server nhận ra lần trùng bằng cách so key. Sinh key mới mỗi lần retry thì mỗi lần là một thao tác mới, idempotency mất tác dụng. Key ngẫu nhiên đủ entropy để hai thao tác khác nhau không vô tình trùng key.",
    },
    {
      t: "**Server lưu gì**: key, fingerprint của request, trạng thái (đang xử lý / xong) và response (status + body). Stripe API v1 lưu status code và body của lần đầu **sau khi endpoint bắt đầu chạy**, kể cả lỗi `500`; request bị lỗi validate hoặc đụng request đồng thời thì không lưu và được thử lại (https://docs.stripe.com/api/idempotent_requests).",
      why: "Lưu response chứ không chỉ lưu \"đã xử lý\", vì lần gửi lại phải nhận đúng câu trả lời của lần đầu (id charge, số tiền) để client tiếp tục. Chỉ lưu khi thao tác đã thật sự bắt đầu, vì request bị từ chối ở bước validate chưa gây side effect nào, cho thử lại là an toàn.",
    },
    {
      t: "**Ghi key trong cùng transaction với thay đổi nghiệp vụ**: `BEGIN; INSERT idempotency_keys(key…) ; UPDATE accounts…; COMMIT`. Unique constraint trên cột key là thứ chặn trùng.",
      why: "Ghi nghiệp vụ trước rồi ghi key sau thì crash ở giữa để lại tiền đã trừ mà không có key: lần retry không thấy key và trừ lần hai. Ghi key trước ở transaction riêng thì crash ở giữa để lại key \"đang xử lý\" mà không có thay đổi nào. Một transaction làm hai việc thành một: hoặc cả hai có, hoặc không có gì.",
    },
    {
      t: "**So khớp payload**: cùng key mà khác tham số thì báo lỗi, không trả kết quả cũ. Stripe so tham số với request gốc và báo lỗi khi khác; bản nháp IETF `Idempotency-Key` (draft -09, chưa là RFC) đề xuất `422` (https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/).",
      why: "Client lỡ dùng lại key (bug, copy code) cho thao tác khác sẽ nhận nhầm kết quả của thao tác cũ và tưởng thao tác mới đã chạy. Lưu hash của body (fingerprint) rồi so ở mỗi lần gặp key biến lỗi im lặng đó thành lỗi rõ ràng. Bản nháp IETF nói thẳng: server không dùng fingerprint thì không phát hiện được key bị dùng lại với payload khác.",
    },
    {
      t: "**Hai request cùng key đến gần như cùng lúc**: request sau thấy key đang ở trạng thái \"đang xử lý\" thì trả `409 Conflict` (bản nháp IETF), client chờ rồi thử lại. Cài bằng `INSERT` key trước với unique constraint hoặc `SELECT … FOR UPDATE` trên dòng key.",
      why: "Kiểm tra \"key đã có chưa\" rồi mới ghi là check-then-act: hai request cùng đọc thấy \"chưa có\" và cùng chạy thao tác. Unique constraint để DB chọn đúng một người thắng một cách atomic, người thua nhận lỗi trùng khoá và biết phải chờ.",
    },
    {
      t: "**Hết hạn key**: key không giữ mãi. Stripe API v1 có thể xoá key khi key đã ít nhất 24 giờ tuổi; gửi lại key đã bị xoá thì được coi là request mới. Bản nháp IETF yêu cầu server công bố chính sách hết hạn trong tài liệu.",
      why: "Bảng key lớn dần theo số thao tác, nên phải dọn. Thời hạn phải dài hơn cửa sổ retry dài nhất của client (kể cả retry từ queue sau nhiều giờ); dọn sớm hơn thì lần retry muộn bị coi là mới và chạy hai lần.",
    },
    {
      t: "**Phía consumer (queue, Kafka)**: dedupe theo message id bằng bảng `processed_messages` hoặc `INSERT … ON CONFLICT DO NOTHING`, ghi cùng transaction với kết quả xử lý. Hoặc upsert theo khoá tự nhiên (`order_id`).",
      why: "Broker giao lại message khi consumer crash trước khi commit offset hoặc ack, nên consumer chắc chắn gặp message trùng. Kafka gợi ý cách gọn nhất khi ghi ra hệ thống ngoài: lưu offset cùng chỗ với output để cả hai cùng được cập nhật hoặc cùng không (https://kafka.apache.org/44/design/design/#message-delivery-semantics).",
    },
    {
      t: "**Kafka exactly-once chỉ phủ bên trong Kafka.** Idempotent producer (`enable.idempotence`, mặc định `true`, cần `acks=all`) chống ghi trùng khi producer gửi lại; transaction + `isolation.level=read_committed` cho chu trình đọc topic → xử lý → ghi topic (https://kafka.apache.org/44/configuration/producer-configs/).",
      why: "Broker dedupe bằng producer id và số thứ tự gửi kèm mỗi message, nên chỉ chặn được trùng **giữa producer và broker**. Consumer ghi vào Postgres nằm ngoài transaction của Kafka: crash sau khi ghi DB, trước khi commit offset, vẫn đọc lại message. Vì vậy consumer ghi DB ngoài vẫn phải dedupe.",
    },
  ],
  sections: [
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Lưu key trong cache có thể bị evict (Redis với `maxmemory-policy` LRU).",
          why: "Key bị đẩy ra khỏi cache trước hạn thì lần retry không thấy key và chạy lại. Key thuộc về dữ liệu nghiệp vụ, nên đặt ở cùng DB với thay đổi nghiệp vụ để ghi chung transaction.",
        },
        {
          t: "Lưu `5xx` làm kết quả cuối mà không biết thao tác đã chạy tới đâu.",
          why: "Nếu `500` xảy ra sau khi đã gọi PSP nhưng trước khi ghi kết quả, trả lại `500` đã lưu khiến client tưởng thất bại trong khi tiền đã trừ. Phải biết thao tác dừng ở bước nào (lưu trạng thái từng bước), hoặc đối soát với bên thứ ba trước khi chốt kết quả.",
        },
        {
          t: "Dùng `GET` có side effect, hoặc `PUT` mà mỗi lần tăng counter.",
          why: "Proxy, trình duyệt và thư viện HTTP được phép tự gửi lại method idempotent khi mất kết nối (RFC 9110 §9.2.2). Cài sai ngữ nghĩa method thì chính hạ tầng sẽ nhân đôi side effect mà code app không hề biết.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"client timeout rồi gửi lại thì sao?\", trả lời theo thứ tự: key do client sinh → lưu key + response cùng transaction → so payload → xử lý request đồng thời → hết hạn key.",
      why: "Năm bước này là toàn bộ cơ chế; thiếu bước nào thì có một kịch bản cụ thể vẫn trừ tiền hai lần. Nói đủ cho thấy bạn hiểu idempotency là cơ chế phải cài, không phải một tính từ dán lên API.",
    },
    {
      t: "Đừng hứa \"exactly-once\". Nói \"at-least-once delivery + idempotent processing = effectively-once\".",
      why: "Interviewer hay bắt bẻ chữ exactly-once: không giao thức mạng nào đảm bảo giao đúng một lần khi có crash. Nói đúng thuật ngữ cho thấy bạn biết trùng lặp chắc chắn xảy ra và bạn đặt cơ chế chặn ở đâu.",
    },
    "Trong bài Payment System, Ticket Booking, Ad Click Aggregator: nói rõ key là gì (payment intent id, booking id, click id) và nằm ở bảng nào.",
  ],
  cards: [
    [
      "Vì sao phải ghi idempotency key và thay đổi nghiệp vụ trong cùng một transaction?",
      "Ghi riêng thì crash giữa hai lần ghi để lại một trong hai: tiền đã trừ mà không có key (retry trừ lần hai), hoặc key có mà thao tác chưa chạy. Cùng transaction thì cả hai cùng có hoặc cùng không.",
    ],
    [
      "Hai request cùng key đến cách nhau 5ms. Server làm gì?",
      "Request đầu insert key (trạng thái đang xử lý) và chạy. Request sau đụng unique constraint, thấy key chưa xong → trả 409, client chờ rồi thử lại và nhận response đã lưu.",
    ],
    [
      "Cùng key nhưng body khác thì sao? Vì sao không trả kết quả cũ?",
      "Báo lỗi (bản nháp IETF đề xuất 422). Trả kết quả cũ thì client tưởng thao tác mới đã chạy. Cần lưu fingerprint (hash body) để so.",
    ],
    [
      "Kafka đã có exactly-once, sao consumer ghi Postgres vẫn phải dedupe?",
      "EOS của Kafka chỉ phủ đọc–xử lý–ghi giữa các topic. Ghi Postgres nằm ngoài transaction Kafka: crash sau khi ghi DB, trước khi commit offset → message được đọc lại. Dedupe theo message id hoặc lưu offset chung transaction với output.",
    ],
    [
      "Key nên hết hạn sau bao lâu?",
      "Dài hơn cửa sổ retry dài nhất của client và queue. Stripe API v1 có thể xoá key từ 24 giờ tuổi; gửi lại sau đó được coi là request mới.",
    ],
    [
      "PUT có cần idempotency key không?",
      "Theo HTTP thì PUT đã idempotent (ghi đè cùng giá trị). Chỉ cần key khi server cài PUT có side effect cộng dồn, việc đó nên sửa ở thiết kế API.",
    ],
  ],
  related: ["kafka-delivery", "queue", "saga"],
});
