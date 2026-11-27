BK.topic({
  id: "observability",
  track: "sd",
  section: "sd-core",
  title: "Observability: log, metric, trace",
  goal: "Đặt SLO, đo p99 và lần theo một request qua nhiều service",
  needs: ["numbers", "system-architecture"],
  tldr: {
    t: "**Metric** trả lời \"có vấn đề không\", **trace** trả lời \"chậm ở đâu\", **log** trả lời \"chuyện gì đã xảy ra\". **SLI** là con số đo được, **SLO** là mục tiêu cho SLI, **SLA** là cam kết có hậu quả. **Error budget** (1 − SLO) quyết định khi nào được ra tính năng nhanh, khi nào phải dừng lại sửa độ ổn định.",
    why: "Ba tín hiệu có chi phí và độ chi tiết khác nhau: metric rẻ và gộp được nên dùng để phát hiện và cảnh báo; trace đắt hơn nhưng nối các service lại theo một request; log chi tiết nhất và đắt nhất khi lưu lâu. Dùng sai loại (đếm lỗi bằng cách grep log, báo động theo từng dòng log) thì hoặc tốn kém, hoặc chậm phát hiện.",
  },
  story: {
    problem: "NFR nào cũng có \"99.9% availability, p99 < 200ms\", nhưng nếu không đo thì không ai biết hệ thống có đạt không. Với microservices, một request đi qua 6 service; user kêu chậm mà mỗi team chỉ nhìn dashboard của mình thấy \"bình thường\". Cảnh báo theo CPU 80% thì kêu suốt đêm mà user không hề bị ảnh hưởng.",
    idea: "Đo từ góc nhìn user (tỉ lệ request thành công, latency percentile), đặt mục tiêu (SLO) và cảnh báo khi mục tiêu bị đe doạ. Gắn một **trace id** vào mỗi request và truyền qua mọi service để dựng lại đường đi. Log có cấu trúc, mang cùng trace id, để nhảy từ trace sang log của đúng request đó.",
    tradeoff: "Telemetry tốn tiền: lưu trữ, băng thông, CPU để ghi. Phải chọn: sampling trace (không giữ mọi trace), giới hạn label của metric (cardinality), mức log và thời gian lưu. SLO quá chặt thì team không bao giờ được ra tính năng; quá lỏng thì user chịu trận trước khi ai đó biết.",
  },
  diagrams: [
    {
      src: "content/svg/observability-trace-waterfall.svg",
      caption: "Trace waterfall của một request qua 4 service: mỗi span có cha, thanh ngang cho thấy thời gian nằm ở đâu và gọi tuần tự hay song song. Header traceparent giữ nguyên trace-id, còn parent-id đổi thành span của bên gọi ở mỗi chặng.",
      source: "https://github.com/w3c/trace-context/blob/main/spec/20-http_request_header_format.md",
    },
  ],
  table: {
    head: ["Tín hiệu", "Trả lời câu hỏi", "Đặc điểm", "Dùng sai thì"],
    rows: [
      {
        cells: ["Metric", "Có vấn đề không? Xu hướng thế nào?", "Con số theo thời gian, gộp được; rẻ khi số chuỗi ít", "Gắn label `user_id` làm nổ số time series"],
        why: "Metric lưu số đã gộp (đếm, histogram) chứ không lưu từng sự kiện, nên chi phí không tăng theo lưu lượng mà theo **số tổ hợp label**. Vì vậy nó hợp để vẽ dashboard và cảnh báo trên toàn hệ thống.",
      },
      {
        cells: ["Trace", "Request này chậm ở service nào, bước nào?", "Cây span của một request qua nhiều service", "Giữ 100% trace ở tải lớn thì chi phí bằng tải thật"],
        why: "Mỗi span ghi thời điểm bắt đầu, kết thúc và span cha, nên dựng được \"waterfall\" cho thấy thời gian nằm ở đâu và gọi tuần tự hay song song. Không có trace, phải đoán từ log của từng service mà không chắc các dòng log thuộc cùng một request.",
      },
      {
        cells: ["Log", "Chuyện gì đã xảy ra với request/đơn hàng X?", "Sự kiện rời rạc, chi tiết nhất", "Dùng log để đếm hay để cảnh báo: chậm và tốn"],
        why: "Log giữ ngữ cảnh đầy đủ (input, lỗi, stack) nên không thay được khi điều tra. Nhưng đếm lỗi bằng cách quét log phải đọc lại toàn bộ dữ liệu, trong khi một counter metric trả lời ngay.",
      },
    ],
  },
  points: [
    {
      t: "**OpenTelemetry** chuẩn hoá cách thu thập: traces, metrics, logs và **baggage** (ngữ cảnh truyền giữa các tín hiệu) đều đã được hỗ trợ; profiles còn đang phát triển (https://opentelemetry.io/docs/concepts/signals/).",
      why: "Instrument một lần theo chuẩn mở thì đổi backend lưu trữ không phải sửa code ứng dụng. Ba tín hiệu dùng chung ngữ cảnh (trace id), nên từ một điểm bất thường trên metric có thể nhảy sang trace và log của đúng request đó.",
    },
    {
      t: "**Percentile, không phải trung bình.** Google SRE: request điển hình mất ~50ms nhưng 5% request chậm gấp ~20 lần; trung bình che mất đuôi chậm, p99/p99.9 mới lộ ra (https://sre.google/sre-book/service-level-objectives/).",
      why: "User chịu đúng latency của request của họ, không phải latency trung bình. Một trang gọi 50 backend thì gần như chắc chắn chạm phải đuôi chậm của ít nhất một backend, nên đuôi quyết định trải nghiệm.",
    },
    {
      t: "**Không lấy trung bình p99 của nhiều máy.** Prometheus: lấy trung bình quantile của từng instance cho ra giá trị \"vô nghĩa về thống kê\". Dùng **histogram**: cộng số đếm theo bucket của mọi instance rồi mới tính `histogram_quantile` (https://prometheus.io/docs/practices/histograms/).",
      why: "Percentile không cộng được: p99 của máy A và máy B không cho biết request nào nằm ở 1% chậm nhất của **tổng** lưu lượng, nhất là khi hai máy nhận lượng request khác nhau. Histogram giữ phân bố (số request rơi vào từng khoảng), cộng phân bố lại thì tính được percentile chung, sai số bằng độ rộng bucket.",
    },
    {
      t: "**SLI → SLO → SLA.** SLI: con số định nghĩa cẩn thận (tỉ lệ request trả `2xx` trong 300ms). SLO: mục tiêu cho SLI (99.9% trong 30 ngày). SLA: hợp đồng có hậu quả (hoàn tiền); Google SRE gợi ý: nếu không có hậu quả nào thì đó là SLO.",
      why: "Tách ba khái niệm để biết ai chịu trách nhiệm gì: SLA do kinh doanh ký, nên SLO nội bộ đặt chặt hơn SLA để còn biên trước khi vi phạm hợp đồng. SRE cũng khuyên không đặt mục tiêu theo hiệu năng hiện tại, vì sẽ khoá team vào nỗ lực \"anh hùng\" để giữ con số đó.",
    },
    {
      t: "**Error budget** = 1 − SLO. SLO 99.9% trong 30 ngày cho phép 0.1% × 43200 phút ≈ **43 phút** lỗi. Còn budget thì ra tính năng nhanh; hết budget thì dừng thay đổi rủi ro, dồn sức cho độ ổn định.",
      why: "Error budget biến tranh luận \"nhanh hay ổn định\" thành một con số chung cho cả dev lẫn vận hành: không ai phải đoán hệ thống \"đủ ổn\" chưa. 100% không phải mục tiêu đúng vì mỗi số 9 thêm vào tốn chi phí tăng vọt mà user không nhận ra khác biệt.",
    },
    {
      t: "**Cảnh báo theo triệu chứng, bằng burn rate.** Burn rate = tốc độ tiêu error budget so với tốc độ SLO cho phép (burn rate 1 = tiêu hết budget đúng vào cuối kỳ). SRE Workbook (bảng tham số cho SLO 99.9%) gợi ý page khi tiêu **2% budget trong 1 giờ** (burn rate 14.4) hoặc **5% trong 6 giờ** (burn rate 6), mở ticket khi tiêu 10% trong 3 ngày (burn rate 1); cửa sổ ngắn bằng 1/12 cửa sổ dài để alert tắt nhanh khi đã hết lỗi (https://sre.google/workbook/alerting-on-slos/).",
      why: "Burn rate 14.4 đến từ phép tính: kỳ 30 ngày = 720 giờ, tiêu 2% budget trong 1 giờ nghĩa là 0.02 × 720 = 14.4 lần tốc độ cho phép; giữ tốc độ đó thì hết budget trong khoảng 2 ngày, đủ gấp để đánh thức người. CPU 80% là **nguyên nhân có thể**, không chắc user bị ảnh hưởng; cảnh báo theo nó sinh ra alert vô ích làm người trực quen bỏ qua.",
    },
    {
      t: "**RED cho service, USE cho tài nguyên.** RED: **R**ate (request/giây), **E**rrors (số request lỗi), **D**uration (thời gian xử lý) (https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/). USE: với mỗi tài nguyên, xem **U**tilization, **S**aturation (việc phải xếp hàng), **E**rrors (https://www.brendangregg.com/usemethod.html).",
      why: "RED đo trải nghiệm mà service đem lại cho người gọi nó, USE đo sức khoẻ của máy, đĩa, mạng bên dưới. Bắt đầu từ RED để biết **có** vấn đề, rồi dùng USE để tìm **tài nguyên** nào gây ra. Saturation quan trọng vì tài nguyên dùng 70% vẫn có thể có queue dài.",
    },
    {
      t: "**Distributed tracing**: trace id truyền qua header chuẩn W3C `traceparent` = `version-traceid-parentid-flags`, ví dụ `00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01`; trace id 16 byte, parent id 8 byte (https://github.com/w3c/trace-context/blob/main/spec/20-http_request_header_format.md).",
      why: "Mỗi service đọc `traceparent` từ request đến, tạo span con với parent id là span của người gọi, rồi gửi `traceparent` mới xuống tiếp. Một service quên truyền header là trace đứt đôi tại đó. Chuẩn chung giúp các service viết bằng ngôn ngữ, thư viện khác nhau vẫn nối được trace.",
    },
    {
      t: "**Sampling**: **head sampling** quyết định giữ hay bỏ ngay ở đầu trace, rẻ và đơn giản nhưng có thể bỏ mất trace có lỗi; **tail sampling** quyết định sau khi thấy gần đủ span, giữ được mọi trace lỗi hoặc chậm nhưng cần thành phần có trạng thái lưu tạm rất nhiều dữ liệu (https://opentelemetry.io/docs/concepts/sampling/).",
      why: "Lúc trace bắt đầu chưa ai biết nó sẽ lỗi hay chậm, nên head sampling 1% giữ đúng 1% trace lỗi. Tail sampling phải gom mọi span của một trace về một chỗ rồi mới quyết, nên đổi chi phí lưu trữ lấy chi phí bộ nhớ và vận hành collector.",
    },
    {
      t: "**Cardinality**: mỗi tổ hợp giá trị label là một time series riêng. Prometheus: không dùng label cho chiều có rất nhiều giá trị như user id, email (https://prometheus.io/docs/practices/naming/).",
      why: "Label `endpoint` (20 giá trị) × `status` (5) là 100 chuỗi; thêm `user_id` với 10 triệu user là 1 tỉ chuỗi, mỗi chuỗi tốn RAM và chỗ lưu riêng, đủ làm sập hệ thống metric. Thông tin theo từng user thuộc về log và trace, nơi chi phí tính theo sự kiện chứ không theo tổ hợp.",
    },
  ],
  sections: [
    {
      title: "Log ở mức code",
      points: [
        {
          t: "**Structured log**: mỗi dòng là JSON có trường cố định (`ts`, `level`, `msg`, `trace_id`, `order_id`) thay vì câu văn tự do.",
          why: "Câu văn tự do phải dùng regex để tìm, và đổi một chữ trong câu là vỡ truy vấn. Trường có tên thì lọc được chính xác (`order_id = 42`) và nối được với trace qua `trace_id`.",
        },
        {
          t: "**Correlation id**: mọi dòng log của một request mang cùng trace id (hoặc request id), kể cả khi việc chạy tiếp trong thread pool hay queue.",
          why: "Một request sinh hàng chục dòng log xen lẫn với hàng nghìn request khác. Không có id chung thì không lọc được \"mọi thứ đã xảy ra với request này\". Qua thread pool hay queue, id phải được mang theo tường minh vì ngữ cảnh của thread cũ không tự đi theo.",
        },
        {
          t: "**Mức log** (`ERROR`, `WARN`, `INFO`, `DEBUG`) có ý nghĩa thống nhất; không log secret, token, mật khẩu, số thẻ.",
          why: "`ERROR` phải là thứ cần người xem, nếu không người trực học cách bỏ qua nó. Log thường được nhiều người đọc và lưu lâu hơn dữ liệu gốc, nên một token lọt vào log là lộ cho mọi người có quyền xem log.",
        },
      ],
    },
  ],
  table2Title: "Mỗi số 9 cho phép bao nhiêu thời gian lỗi (kỳ 30 ngày)",
  table2: {
    head: ["SLO", "Error budget", "Lỗi cho phép / 30 ngày"],
    rows: [
      ["99%", "1%", "7.2 giờ"],
      ["99.9%", "0.1%", "≈ 43 phút"],
      ["99.95%", "0.05%", "≈ 22 phút"],
      { cells: ["99.99%", "0.01%", "≈ 4.3 phút"], why: "Tính bằng (1 − SLO) × 43200 phút. Với 4 phút mỗi tháng, một lần deploy lỗi phải được phát hiện và rollback tự động; con người không kịp phản ứng. Mỗi số 9 thêm vào thường đòi thay đổi kiến trúc (nhiều region, failover tự động), không chỉ cố gắng hơn." },
    ],
  },
  tips: [
    {
      t: "Khi nêu NFR \"99.9%, p99 < 200ms\", nói luôn đo ở đâu (load balancer hay client), bằng gì (histogram) và cảnh báo thế nào (burn rate).",
      why: "Con số không có cách đo chỉ là mong muốn. Nói được cách đo cho thấy bạn đã vận hành hệ thống thật, và mở đường cho câu hỏi tiếp về cảnh báo và on-call.",
    },
    {
      t: "Trong deep dive \"làm sao biết hệ thống đang chậm ở đâu\", trả lời: RED dashboard theo service → trace của request chậm → log theo trace id.",
      why: "Đây là thứ tự điều tra thực tế: từ rộng (metric toàn hệ thống) tới hẹp (một request, một dòng lỗi). Mỗi bước dùng tín hiệu rẻ nhất trả lời được câu hỏi ở bước đó.",
    },
  ],
  cards: [
    [
      "Vì sao không lấy trung bình p99 của 10 server?",
      "Percentile không cộng được; trung bình p99 không phải p99 của tổng lưu lượng, nhất là khi tải mỗi máy khác nhau. Dùng histogram: cộng bucket rồi tính quantile.",
    ],
    [
      "SLO 99.9% trong 30 ngày cho phép bao nhiêu phút lỗi?",
      "0.1% × 43200 phút ≈ 43 phút.",
    ],
    [
      "Error budget hết thì team làm gì?",
      "Dừng hoặc chậm lại các thay đổi rủi ro (tính năng mới), dồn sức cho độ ổn định cho tới khi budget hồi lại trong kỳ.",
    ],
    [
      "Vì sao không gắn `user_id` làm label của metric?",
      "Mỗi giá trị label sinh một time series; hàng triệu user = hàng triệu chuỗi, nổ RAM và chỗ lưu. Thông tin theo user để ở log/trace.",
    ],
    [
      "Head sampling và tail sampling khác nhau thế nào?",
      "Head: quyết định ở đầu trace, rẻ nhưng có thể bỏ mất trace lỗi. Tail: quyết định sau khi thấy gần đủ span, giữ được trace lỗi/chậm nhưng cần collector có trạng thái, lưu tạm nhiều dữ liệu.",
    ],
    [
      "Vì sao cảnh báo theo burn rate tốt hơn theo CPU 80%?",
      "Burn rate đo trực tiếp user có đang bị ảnh hưởng và nhanh tới mức nào. CPU cao có thể không ảnh hưởng ai, gây alert vô ích; còn lỗi thật có thể xảy ra khi CPU thấp.",
    ],
    [
      "RED và USE dùng cho gì?",
      "RED (Rate, Errors, Duration) cho service, từ góc nhìn người gọi. USE (Utilization, Saturation, Errors) cho tài nguyên như CPU, đĩa, mạng. RED phát hiện, USE tìm nguyên nhân.",
    ],
  ],
});
