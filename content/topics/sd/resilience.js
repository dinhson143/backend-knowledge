BK.topic({
  id: "resilience",
  track: "sd",
  section: "sd-core",
  title: "Timeout, retry & circuit breaker",
  goal: "Đặt timeout, retry có jitter, circuit breaker để lỗi không lan dây chuyền",
  needs: ["api-design", "queue"],
  tldr: {
    t: "Mọi lời gọi qua mạng cần **timeout**. Chỉ **retry** lỗi tạm thời của thao tác idempotent, có **exponential backoff + jitter**, giới hạn số lần và chỉ retry ở **một tầng**. Phụ thuộc đang chết thì **circuit breaker** ngắt nhanh. Quá tải thì **load shedding**: từ chối sớm thay vì xếp hàng tới chết.",
    why: "Sự cố lan dây chuyền (cascading failure) là lỗi lớn dần nhờ vòng phản hồi dương: phụ thuộc chậm → thread chờ → pool cạn → service gọi nó cũng chậm → client retry → tải tăng thêm (https://sre.google/sre-book/addressing-cascading-failures/). Mỗi cơ chế ở đây cắt một mắt xích của vòng đó: timeout trả lại thread, giới hạn retry chặn nhân tải, breaker cho phụ thuộc thời gian hồi phục, shedding giữ phần việc đã nhận vẫn xong kịp.",
  },
  story: {
    problem: "Service thanh toán chậm từ 50ms lên 5s. Service đặt hàng gọi nó không đặt timeout, nên 200 thread của pool lần lượt treo chờ. Trang chủ chẳng dính gì tới thanh toán cũng gọi qua service đặt hàng và bắt đầu timeout. Client thấy lỗi thì bấm lại, gateway retry, service đặt hàng cũng retry: tải lên service thanh toán tăng gấp nhiều lần đúng lúc nó yếu nhất.",
    idea: "Coi mỗi phụ thuộc là thứ có thể chậm hoặc chết bất cứ lúc nào. Giới hạn **thời gian** chờ (timeout, deadline), **số lần** thử lại (retry budget), **tài nguyên** dành cho một phụ thuộc (bulkhead), và **lượng việc** nhận vào (load shedding). Khi phụ thuộc hỏng hẳn thì ngừng gọi một lúc (circuit breaker) và trả phương án dự phòng.",
    tradeoff: "Timeout ngắn quá thì cắt cả request sắp xong; retry ít quá thì lỗi thoáng qua thành lỗi với user; breaker nhạy quá thì tự gây downtime. Mọi ngưỡng phải chỉnh theo số liệu đo được (latency percentile, tỉ lệ lỗi), và retry chỉ an toàn khi thao tác idempotent.",
  },
  diagrams: [
    {
      src: "content/svg/resilience-circuit-breaker.svg",
      caption: "Circuit breaker: Closed đếm lỗi theo khoảng thời gian, vượt ngưỡng thì sang Open và bật timer; hết timer sang Half-open cho vài request thử; đủ số lần thành công liên tiếp thì về Closed, một lần lỗi thì quay lại Open và bật lại timer.",
      source: "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker",
    },
  ],
  table: {
    head: ["Cơ chế", "Chặn được gì", "Cài thế nào"],
    rows: [
      {
        cells: ["Timeout / deadline", "Thread, connection bị giữ mãi bởi phụ thuộc treo", "Chọn theo percentile latency của phụ thuộc; truyền deadline tuyệt đối xuống các tầng dưới"],
        why: "Không có timeout thì một lời gọi treo giữ thread và connection vô thời hạn, và chỉ cần đủ lời gọi treo là pool cạn. Amazon Builders' Library chọn timeout bằng cách chấp nhận một tỉ lệ timeout nhầm (ví dụ 0.1%) rồi lấy percentile tương ứng (p99.9) của latency phụ thuộc (https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter). Google SRE khuyên đặt deadline ở tầng trên cùng và truyền **cùng** deadline tuyệt đối xuống mọi RPC phía dưới, để tầng dưới biết còn bao nhiêu thời gian thay vì tự đặt một timeout mới dài hơn.",
      },
      {
        cells: ["Retry + backoff + jitter", "Lỗi thoáng qua (mất gói, một instance khởi động lại)", "Chỉ lỗi tạm thời; chờ tăng dần có ngẫu nhiên; giới hạn số lần và có retry budget"],
        why: "Retry \"ích kỷ\": nó dùng thêm thời gian của server để tăng cơ hội cho chính caller, nên chỉ ổn khi lỗi hiếm và tai hại khi server đang quá tải (Builders' Library). Backoff giãn khoảng cách giữa các lần thử; jitter làm lệch thời điểm để hàng nghìn client không retry cùng một nhịp. Lỗi phía client (4xx) gửi lại y nguyên thì vẫn lỗi, nên không retry; ngoại lệ là `429` (bị giới hạn tốc độ), retry được sau khoảng chờ server gợi ý.",
      },
      {
        cells: ["Circuit breaker", "Tiếp tục đập vào phụ thuộc đang chết, chờ timeout mỗi lần", "Ba trạng thái closed → open → half-open theo ngưỡng lỗi và thời gian chờ"],
        why: "Phụ thuộc chết hẳn thì mỗi lời gọi vẫn tốn trọn timeout rồi mới lỗi, và tải dồn vào làm nó khó hồi phục. Breaker trả lỗi ngay khi open (không tốn thread chờ), cho phụ thuộc thời gian hồi phục, rồi thử lại bằng vài request ở half-open (https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker).",
      },
      {
        cells: ["Bulkhead", "Một phụ thuộc chậm ăn hết pool dùng chung", "Pool thread/connection riêng cho từng phụ thuộc"],
        why: "Với một pool chung, phụ thuộc A treo thì mọi thread kẹt ở A và lời gọi tới B, C cũng không còn thread. Mỗi phụ thuộc một pool riêng thì A hỏng chỉ cạn pool của A (https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead). Cái giá: tổng tài nguyên dùng kém hiệu quả hơn pool chung.",
      },
      {
        cells: ["Load shedding", "Quá tải làm mọi request đều chậm quá timeout", "Từ chối sớm phần vượt sức; ưu tiên request quan trọng; queue có giới hạn"],
        why: "Khi quá tải, tranh chấp thread, context switch, GC làm latency tăng vọt; vượt timeout của client thì mọi việc server làm đều phí, goodput (phần request thành công kịp lúc) rơi về 0. Từ chối nhanh phần dư giữ goodput ổn định cho phần đã nhận (https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload).",
      },
      {
        cells: ["Fallback / degrade", "User thấy lỗi trắng trang khi tính năng phụ hỏng", "Trả cache cũ, giá trị mặc định, ẩn tính năng phụ"],
        why: "Phần lớn trang ghép từ nhiều phụ thuộc, không phải phụ thuộc nào cũng thiết yếu. Trả gợi ý sản phẩm từ cache cũ hay ẩn khung đánh giá vẫn tốt hơn lỗi cả trang, miễn là dữ liệu cũ không gây sai nghiệp vụ (không dùng cho số dư, tồn kho).",
      },
    ],
  },
  points: [
    {
      t: "**Retry nhân tải theo cấp số.** Mỗi tầng thử 3 lần, 5 tầng xếp chồng thì DB có thể nhận tải gấp 3⁵ = 243 lần (Builders' Library). Google SRE: 3 tầng, mỗi tầng 4 lần thử → một thao tác của user thành 64 lần gọi DB. Chỉ retry ở **một** tầng, thường là tầng gần user nhất hoặc tầng có thông tin tốt nhất.",
      why: "Mỗi tầng không biết tầng trên cũng retry, nên số lần thử nhân với nhau chứ không cộng. Tải tăng đúng lúc phụ thuộc đang yếu, kéo dài sự cố thay vì giúp nó qua. Retry ở một tầng giữ hệ số nhân ở mức số lần thử của tầng đó.",
    },
    {
      t: "**Retry budget**: giới hạn tỉ lệ retry trên toàn process, không chỉ trên từng request. AWS SDK dùng token bucket cho retry từ 2016: còn token thì retry, hết token thì chỉ retry theo nhịp cố định. Google SRE gợi ý ví dụ budget 60 retry mỗi phút cho cả process.",
      why: "Giới hạn 3 lần mỗi request vẫn cho phép tải gấp 3 khi mọi request cùng lỗi. Budget theo process đặt trần tuyệt đối: khi lỗi lan rộng, retry tự tắt dần và hệ thống quay về chỉ gửi tải gốc.",
    },
    {
      t: "**Exponential backoff + jitter**: chờ `base × 2^n` có trần, cộng hoặc nhân với một phần ngẫu nhiên. Google SRE: \"Always use randomized exponential backoff\".",
      why: "Không có jitter thì mọi client lỗi cùng lúc sẽ retry cùng lúc, tạo các đợt sóng đập vào server theo nhịp backoff. Ngẫu nhiên hoá trải tải ra theo thời gian. Có trần backoff thì sau vài lần mọi client lại retry cùng nhịp trần, nên Builders' Library nhấn mạnh việc giới hạn số lần thử hơn là chỉ dựa vào backoff.",
    },
    {
      t: "**Chỉ retry khi an toàn**: lỗi tạm thời (5xx, timeout, `429`/`503` kèm `Retry-After`) và thao tác idempotent hoặc có idempotency key. Lỗi `400`, `401`, `404` gửi lại y nguyên vẫn lỗi.",
      why: "Retry một `POST` không có key sau timeout có thể chạy thao tác hai lần, vì timeout không cho biết lần đầu đã chạy hay chưa. Xem topic Idempotency cho cơ chế key.",
    },
    {
      t: "**Circuit breaker, ba trạng thái**: **Closed** cho request đi qua và đếm lỗi trong một khoảng thời gian; vượt ngưỡng → **Open**, trả lỗi ngay và bật đồng hồ; hết giờ → **Half-open**, cho một số ít request thử. Thử thành công đủ số lần → Closed; một lần lỗi → quay lại Open.",
      why: "Half-open tồn tại vì phụ thuộc vừa hồi phục chỉ chịu được ít tải; mở toang ngay thì dòng request dồn lại làm nó sập lần nữa. Bộ đếm lỗi ở Closed tính theo khoảng thời gian để vài lỗi lẻ tẻ không làm breaker mở (Azure Architecture Center).",
    },
    {
      t: "**Load shedding và queue có giới hạn**: giới hạn cả độ dài lẫn tuổi của request trong queue; request quá cũ thì bỏ vì client đã bỏ cuộc. Ưu tiên health check của load balancer và request hoàn tất việc dở hơn request bắt đầu việc mới.",
      why: "Request chờ 10 giây trong queue thường đã bị user bấm lại, nên phục vụ nó là phí công. Google SRE gợi ý queue nhỏ so với thread pool để server từ chối sớm thay vì để latency và bộ nhớ tăng dần. Health check bị bỏ thì LB tưởng instance chết, rút nó ra và dồn tải sang instance khác, làm sự cố lan rộng.",
    },
    {
      t: "**Server kiểm deadline trước khi làm việc**: nếu client đã hết thời gian chờ thì dừng, và huỷ lan xuống các lời gọi con.",
      why: "Client đã timeout sẽ vứt response, nên mọi CPU, query DB dành cho request đó là tải vô ích chiếm chỗ của request còn cứu được. Truyền deadline qua header hoặc context giúp mọi tầng thấy cùng thời hạn.",
    },
    {
      t: "**Rate limiter khác resilience**: rate limiter bảo vệ hệ thống khỏi **client**; timeout, retry budget, breaker, bulkhead bảo vệ hệ thống khỏi chính **phụ thuộc** của nó.",
      why: "Hai thứ bổ sung nhau: rate limiter đặt trần cho tải vào từ ngoài, còn resilience đảm bảo khi một phụ thuộc bên trong hỏng thì lỗi bị nhốt lại. Xem bài Distributed Rate Limiter và sim Token bucket.",
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"service X chậm thì sao?\", đi theo thứ tự: timeout bao nhiêu → retry ở đâu, mấy lần, có jitter, có idempotent không → breaker và fallback → bulkhead → load shedding.",
      why: "Thứ tự này đi từ một lời gọi ra toàn hệ thống, và mỗi bước trả lời một kịch bản cụ thể. Nói \"thêm circuit breaker\" mà không nói timeout thì breaker không bao giờ thấy lỗi, vì request treo không bao giờ trả về.",
    },
    {
      t: "Nêu con số: timeout theo p99.9 của phụ thuộc, tối đa 2–3 lần thử, chỉ retry ở một tầng.",
      why: "Con số cho thấy bạn biết ngưỡng được chọn từ số đo latency thật, không phải đoán. Interviewer thường hỏi tiếp \"retry ở nhiều tầng thì sao\" để kiểm bạn có biết hệ số nhân.",
    },
  ],
  cards: [
    [
      "Vì sao retry không có jitter làm sự cố kéo dài?",
      "Mọi client lỗi cùng lúc thì retry cùng lúc theo cùng nhịp backoff, tạo đợt sóng đập vào server đúng lúc nó vừa gượng dậy. Jitter trải các lần thử ra theo thời gian.",
    ],
    [
      "Client, gateway và service đều retry 3 lần. DB nhận bao nhiêu lần gọi cho một thao tác lỗi?",
      "3 × 3 × 3 = 27. Retry nhân theo tầng. Chỉ retry ở một tầng và dùng retry budget.",
    ],
    [
      "Circuit breaker half-open để làm gì?",
      "Cho vài request thử sau thời gian chờ. Thành công đủ thì đóng lại, lỗi thì mở lại. Tránh dồn toàn bộ tải vào phụ thuộc vừa hồi phục.",
    ],
    [
      "Đặt timeout cho lời gọi sang service khác thế nào?",
      "Chọn tỉ lệ timeout nhầm chấp nhận được (ví dụ 0.1%) và lấy percentile tương ứng (p99.9) của latency phụ thuộc, cộng biên cho mạng xa. Truyền deadline tuyệt đối xuống các tầng dưới.",
    ],
    [
      "Bulkhead giải bài gì mà circuit breaker không giải?",
      "Breaker cần thời gian để thấy đủ lỗi mới mở; trong lúc đó phụ thuộc chậm vẫn có thể ăn hết pool chung. Bulkhead tách pool theo phụ thuộc nên phụ thuộc chậm chỉ cạn pool của nó.",
    ],
    [
      "Vì sao quá tải thì nên từ chối request thay vì xếp hàng?",
      "Xếp hàng làm latency vượt timeout của client, server vẫn tốn công cho request mà client đã vứt; goodput rơi về 0. Từ chối sớm giữ phần đã nhận xong kịp lúc.",
    ],
  ],
  related: ["token-bucket", "stampede", "queue", "lb"],
});
