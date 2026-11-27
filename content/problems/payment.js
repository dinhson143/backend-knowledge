BK.problem({
  id: "payment",
  level: 3,
  title: "Payment System",
  hi: "payment-system",
  summary: "Không bao giờ trừ tiền hai lần, không mất giao dịch, và biết chắc kết quả kể cả khi gọi ra ngoài bị timeout.",
  topics: ["patterns", "core-db", "api-design"],
  fr: [
    "Merchant tạo payment intent",
    "Khách thanh toán bằng thẻ",
    "Merchant nhận kết quả qua webhook",
    "Hoàn tiền",
  ],
  nfr: [
    {
      t: "**Không charge hai lần** (idempotent)",
      why: "Charge hai lần là mất tiền của khách, mà client, mạng và PSP đều có thể retry nên cùng một lệnh thanh toán có thể tới nhiều lần. Hệ quả: idempotency key ở mọi tầng và state machine chặn chuyển trạng thái lặp.",
    },
    {
      t: "Durable + audit được (sổ cái đầy đủ)",
      why: "Mọi thay đổi phải có dấu vết, vì tiền phải giải trình được với kế toán, kiểm toán và cơ quan quản lý. Hệ quả: ledger double-entry append-only, không UPDATE/DELETE bút toán.",
    },
    {
      t: "Strong consistency cho trạng thái thanh toán",
      why: "Trạng thái thanh toán sai (báo thành công khi thất bại) dẫn tới giao hàng mà không thu tiền, hoặc ngược lại. Hệ quả: dùng DB ACID, transaction cho chuyển trạng thái, không dùng kho eventual consistency.",
    },
    {
      t: "~10k TPS lúc peak; bảo mật PCI DSS",
      why: "Khó khăn thật nằm ở tính đúng đắn, không ở throughput — 10k TPS không lớn với Postgres có partition. Cô lập dữ liệu thẻ vào Card Vault và tokenize để thu hẹp phạm vi PCI DSS (tokenize là cách giảm phạm vi, không phải điều PCI DSS bắt buộc).",
    },
  ],
  capacity: "10k TPS không lớn với Postgres có partition; khó là tính đúng đắn khi gọi hệ thống bên ngoài không tin cậy.",
  entities: ["Merchant", "PaymentIntent", "Transaction (attempt)", "LedgerEntry", "Refund"],
  api: [
    "POST /payment-intents { amount, currency } + header Idempotency-Key",
    "POST /payment-intents/{id}/confirm { cardToken }",
    "POST /refunds { paymentIntentId, amount }",
    "Webhook → merchant: payment.succeeded / payment.failed",
  ],
  hldWhy: "**Payment Service** quản lý payment intent như state machine và ghi trạng thái trước mỗi lần gọi ra ngoài, vì gọi PSP là thao tác bên ngoài không tin cậy. **Card Vault** tách riêng vì số thẻ thuộc phạm vi PCI DSS: cô lập nó thì phần còn lại chỉ thấy token, thu hẹp phạm vi audit. **Payments DB** chọn Postgres vì intent và ledger cần transaction ACID và strong consistency; 10k TPS vẫn trong khả năng Postgres có partition. Ledger nằm cùng DB với intent để chuyển trạng thái và ghi bút toán trong cùng một transaction.",
  hld: {
    id: "hld-payment",
    title: "HLD — Payment System",
    h: 370,
    scenario: "Số thẻ đi thẳng vào Card Vault; Payment Service điều khiển state machine của intent, gọi PSP và ghi ledger.",
    context: "**Payment Service** điều khiển state machine của mỗi payment intent (`CREATED → PROCESSING → SUCCEEDED/FAILED`) và là bên duy nhất gọi ra **PSP / acquirer**. **Card Vault** là vùng cách ly đạt chuẩn PCI DSS, giữ số thẻ thật và chỉ trả ra token. **Payments DB** lưu intent và **ledger** double-entry bất biến. Nguyên tắc xuyên suốt: ghi trạng thái trước khi gọi ra ngoài, và mọi tầng đều idempotent. Theo dõi dòng chữ dưới Payments DB: trạng thái của `pi_1`/`pi_2`.",
    nodes: [
      { id: "merchant", x: 80, y: 80, label: "Merchant" },
      { id: "customer", x: 80, y: 300, label: "Khách hàng" },
      { id: "pay", x: 330, y: 190, label: "Payment Service", w: 150 },
      { id: "vault", x: 330, y: 320, label: "Card Vault", s: "PCI DSS" },
      { id: "db", x: 580, y: 80, label: "Payments DB", s: "intent · ledger" },
      { id: "psp", x: 580, y: 300, label: "PSP / Acquirer", w: 150 },
    ],
    links: [
      ["merchant", "pay"],
      ["customer", "vault"],
      ["customer", "pay"],
      ["pay", "vault"],
      ["pay", "db"],
      ["pay", "psp"],
    ],
    variants: [
      {
        name: "Thanh toán thành công",
        steps: [
          {
            note: "Merchant tạo payment intent kèm **Idempotency-Key**.",
            msgs: [
              ["merchant", "pay", "POST /intents $50 · key=ord-77"],
              ["pay", "db", "INSERT CREATED"],
              ["pay", "merchant", "pi_1", "ok"],
            ],
            set: { db: "pi_1 CREATED" },
            detail: "Payment Service tạo intent `pi_1` trạng thái **CREATED** cho lệnh `POST /intents` $50 của merchant, lưu kèm header `Idempotency-Key: ord-77` (unique theo key) rồi trả `pi_1`. Merchant timeout và gọi lại với cùng key thì server trả lại đúng `pi_1` thay vì tạo intent thứ hai — retry an toàn. Chưa có tiền nào di chuyển ở bước này.",
          },
          {
            note: "Số thẻ đi **thẳng vào Card Vault** (tokenization); Payment Service không thấy số thẻ thật → thu hẹp phạm vi PCI.",
            msgs: [["customer", "vault", "card 4242…"], ["vault", "customer", "tok_9f", "ok"]],
            detail: "Số thẻ `4242…` đi **thẳng tới Card Vault** từ form nhập thẻ (iframe/SDK do Vault cung cấp), không qua server của merchant hay Payment Service. Vault mã hoá, lưu số thẻ và trả token `tok_9f` — vô nghĩa với kẻ trộm. Chỉ Vault chạm số thẻ thật → phạm vi audit PCI DSS thu lại còn một hệ thống nhỏ thay vì cả backend; lộ log hay DB của Payment Service cũng không lộ số thẻ.",
          },
          {
            note: "Confirm bằng token. Ghi **PROCESSING trước** khi gọi ra ngoài.",
            msgs: [["customer", "pay", "confirm pi_1 · tok_9f"], ["pay", "db", "pi_1 → PROCESSING"]],
            set: { db: "pi_1 PROCESSING" },
            detail: "Payment Service chuyển `pi_1` sang **PROCESSING** trong DB **trước** khi gọi PSP, khi khách confirm bằng `tok_9f`. Nếu gọi trước rồi mới ghi, crash ngay sau khi tiền đã bị trừ sẽ để DB không có dấu vết gì — không ai biết phải kiểm tra lại. Ghi PROCESSING trước tạo dấu vết “có thể đã charge” để reconciler xử lý về sau, và chặn request confirm thứ hai (nên làm bằng conditional update `WHERE status='CREATED'` để atomic).",
          },
          {
            note: "Gọi PSP để authorize + capture, kèm idempotency key.",
            msgs: [
              ["pay", "vault", "detokenize"],
              ["pay", "psp", "charge $50 · idem pi_1"],
              ["psp", "pay", "approved", "ok"],
            ],
            detail: "PSP trả `approved` cho lệnh `charge $50` kèm idempotency key `pi_1`; trước đó Payment Service đổi `tok_9f` lấy số thẻ ở Vault (detokenize). Authorize kiểm tra và giữ tiền trên thẻ, capture là lệnh thực sự chuyển tiền. Idempotency key gửi ra ngoài đảm bảo Payment Service gửi lại cùng request do timeout thì bên kia nhận ra và không trừ tiền lần hai. Bên nhận key là PSP/acquirer (card network như Visa không nhận idempotency key); để không kéo Payment Service vào phạm vi PCI, Vault thường tự forward request kèm số thẻ (proxy) thay vì trả số thẻ cho Payment Service.",
          },
          {
            note: "Cập nhật trạng thái + ghi **ledger double-entry** trong một transaction.",
            msgs: [["pay", "db", "SUCCEEDED + ledger ±$50", "ok"]],
            set: { db: "pi_1 SUCCEEDED · ledger cân" },
            detail: "Payment Service cập nhật `pi_1 → SUCCEEDED` và ghi ledger double-entry trong **một transaction**: ví dụ ghi nợ $50 tài khoản “phải thu từ PSP”, ghi có $50 tài khoản “phải trả merchant”. Tổng nợ luôn bằng tổng có → mọi sai lệch lộ ra khi cộng sổ. Ledger chỉ append, không bao giờ UPDATE/DELETE — sửa sai bằng bút toán đảo ngược, giữ nguyên lịch sử để audit. Gộp trạng thái và ledger trong một transaction đảm bảo không có intent SUCCEEDED mà thiếu bút toán, hay ngược lại.",
          },
          {
            note: "Báo merchant qua **webhook** (retry tới khi nhận 2xx).",
            msgs: [["pay", "merchant", "webhook succeeded", "ok"], ["pay", "customer", "Thành công", "ok"]],
            lesson: "Ghi trạng thái trước khi gọi bên ngoài, ledger bất biến, webhook có retry.",
            detail: "Payment Service báo khách “Thành công” và gửi **webhook** `payment.succeeded` tới merchant. Webhook được retry với exponential backoff tới khi merchant trả 2xx (thường tới vài ngày) → merchant có thể nhận trùng và phải xử lý idempotent theo event id. Merchant không nên giao hàng chỉ dựa vào redirect của browser vì khách có thể tắt tab — webhook mới là kênh đáng tin.",
          },
        ],
      },
      {
        name: "Bấm lại sau timeout",
        steps: [
          {
            note: "PSP trả lời chậm, client timeout và **bấm lại**.",
            set: { db: "pi_1 PROCESSING" },
            msgs: [
              ["customer", "pay", "confirm pi_1"],
              ["pay", "psp", "charge · idem pi_1"],
              ["pay", "customer", "timeout", "err"],
            ],
            detail: "Client hiện `timeout` cho khách vì PSP trả lời chậm, trong khi `pi_1` đã ở **PROCESSING** và `charge · idem pi_1` đã được gửi. Đây là trạng thái nguy hiểm nhất: khách **không biết** tiền đã bị trừ chưa, và phản xạ tự nhiên là bấm “Thanh toán” lần nữa.",
          },
          {
            note: "Request thứ hai: intent đang PROCESSING → **không charge lần nữa**.",
            msgs: [
              ["customer", "pay", "confirm pi_1 (lần 2)", "warn"],
              ["pay", "db", "SELECT pi_1"],
              ["db", "pay", "PROCESSING", "warn"],
              ["pay", "customer", "202 đang xử lý", "warn"],
            ],
            detail: "Payment Service trả **202 đang xử lý** cho request confirm lần 2, không gọi PSP lần nữa (có thể trừ tiền hai lần). Nó đọc `pi_1` thấy **PROCESSING** — đã có một lần charge đang bay — nên để client polling hoặc chờ webhook. Kiểm tra này phải atomic: chỉ `SELECT` rồi mới quyết định thì hai request đồng thời có thể cùng thấy trạng thái cũ; dùng `UPDATE ... SET status='PROCESSING' WHERE status='CREATED'` và kiểm tra số dòng bị ảnh hưởng.",
          },
          {
            note: "Kết quả thật về sau; nhờ idempotency key, PSP cũng chỉ charge một lần.",
            msgs: [["psp", "pay", "approved (1 lần)", "ok"], ["pay", "db", "SUCCEEDED", "ok"]],
            set: { db: "pi_1 SUCCEEDED" },
            lesson: "Idempotency ở mọi tầng: key từ client, state machine của intent, key gửi sang PSP.",
            detail: "PSP trả `approved` cho lần charge duy nhất; Payment Service ghi **SUCCEEDED** (kèm ledger) và báo khách thành công. Kể cả khi Payment Service retry gửi lại request do timeout, idempotency key `pi_1` khiến network trả lại kết quả cũ chứ không charge thêm. Ba lớp bảo vệ chồng nhau: key từ merchant chống tạo intent trùng, state machine chống confirm trùng, key gửi ra ngoài chống charge trùng.",
          },
        ],
      },
      {
        name: "Không rõ kết quả",
        steps: [
          {
            note: "Gọi PSP rồi Payment Service **crash** trước khi ghi kết quả.",
            msgs: [["pay", "psp", "charge pi_2"]],
            set: { pay: "💥 crash", db: "pi_2 PROCESSING" },
            bad: ["pay"],
            detail: "Payment Service **crash** sau khi gửi `charge pi_2` nhưng trước khi nhận/ghi kết quả. DB chỉ còn `pi_2 PROCESSING`; tiền có thể đã bị trừ, cũng có thể chưa — không ai biết. Nếu trước đó không ghi PROCESSING, intent sẽ nằm ở CREATED và hệ thống có thể cho khách charge lại → trừ tiền hai lần.",
          },
          {
            note: "Job định kỳ quét intent kẹt PROCESSING quá lâu và **hỏi lại** PSP.",
            set: { pay: "reconciler" },
            msgs: [
              ["pay", "db", "PROCESSING > 5 phút"],
              ["pay", "psp", "GET status pi_2"],
              ["psp", "pay", "approved", "ok"],
            ],
            detail: "Job **reconciler** phát hiện `pi_2` kẹt ở PROCESSING quá **5 phút** — dấu hiệu lời gọi bị bỏ dở — và hỏi PSP kết quả thật. Reconciler quét định kỳ các intent như vậy và gọi `GET status pi_2` thay vì đoán. PSP trả `approved`: tiền đã bị trừ. Nếu PSP trả “không tìm thấy”, reconciler retry charge với cùng idempotency key, hoặc void rồi mới đánh dấu FAILED — không đánh dấu FAILED ngay, vì request gửi trước đó vẫn có thể tới muộn và được xử lý trong cửa sổ idempotency của PSP (Stripe giữ key ít nhất 24 giờ — https://docs.stripe.com/api/idempotent_requests).",
          },
          {
            note: "Hoàn tất trạng thái + ledger; cuối ngày đối soát với file settlement của ngân hàng.",
            msgs: [["pay", "db", "pi_2 SUCCEEDED + ledger", "ok"]],
            set: { db: "pi_2 SUCCEEDED" },
            lesson: "Không đoán kết quả: trạng thái trung gian + reconciliation với nguồn sự thật bên ngoài.",
            detail: "Reconciler ghi `pi_2 → SUCCEEDED` cùng bút toán ledger trong một transaction, rồi gửi webhook cho merchant như luồng bình thường. Cuối ngày còn một lớp đối soát nữa: so ledger nội bộ với **file settlement** của ngân hàng/acquirer — nguồn sự thật bên ngoài về tiền đã thực sự chuyển. Mọi giao dịch lệch (có ở bên này mà không có ở bên kia) được đưa ra xử lý thủ công → lỗi không bao giờ bị nuốt im lặng.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Không charge hai lần?",
      bad: "Tin rằng client chỉ bấm một lần.",
      good: "Idempotency-Key + unique constraint.",
      great: "Idempotency ở 3 tầng (client key, state machine intent, key gửi PSP) + ghi PROCESSING trước khi gọi ra ngoài.",
      why: {
        bad: "Charge hai lần, vì double-click, retry tự động của client hay timeout mạng đều gửi lại request — tin client chỉ bấm một lần là bỏ qua các nguồn trùng này.",
        good: "Unique constraint trên `Idempotency-Key` đảm bảo request lặp chỉ tạo một payment. Nhưng server crash sau khi gọi PSP mà chưa ghi kết quả thì lần retry không biết PSP đã charge hay chưa, và có thể charge lại.",
        great: "Crash xong, hệ thống biết có lệnh đang dở và đi hỏi trạng thái thay vì charge mới, vì đã ghi `PROCESSING` trước khi gọi PSP. Gửi idempotency key sang PSP để PSP cũng bỏ lệnh trùng → cả ba tầng (client, state machine, PSP) đều chặn được trùng.",
      },
    },
    {
      q: "Không mất hay sai tiền?",
      bad: "UPDATE balance trực tiếp.",
      good: "Bảng transaction có trạng thái.",
      great: "Ledger double-entry append-only, mọi bút toán cân bằng; reconciliation với settlement file; audit log.",
      why: {
        bad: "Không còn dấu vết tiền đi đâu, vì `UPDATE balance` ghi đè giá trị cũ; hai update đồng thời có thể mất cập nhật, và lỗi không phát hiện được.",
        good: "Bảng transaction có trạng thái lưu được lịch sử từng giao dịch. Nhưng thiếu bất biến để tự kiểm tra (tiền vào bằng tiền ra), sai sót vẫn lọt mà không ai biết.",
        great: "Lệch là phát hiện ngay, vì mỗi giao dịch ghi một cặp debit/credit có tổng bằng 0 nên tổng toàn ledger luôn bằng 0. Append-only nên không sửa được lịch sử; reconciliation so ledger với settlement file của ngân hàng để bắt sai lệch với bên ngoài.",
      },
    },
    {
      q: "Báo merchant tin cậy?",
      bad: "Gọi webhook một lần.",
      good: "Retry khi lỗi.",
      great: "Transactional outbox → queue → webhook dispatcher với exponential backoff, ký HMAC; merchant xử lý idempotent theo event id.",
      why: {
        bad: "Gọi webhook một lần mà thất bại thì merchant không bao giờ biết đơn đã thanh toán — merchant server có thể đang deploy hoặc lỗi tạm.",
        good: "Retry bù được lỗi tạm thời. Nhưng service crash sau khi commit payment mà trước khi gửi webhook thì event mất, và retry dồn dập có thể đè sập merchant đang hồi phục.",
        great: "Event không thể mất khi DB đã commit, vì outbox ghi cùng transaction với thay đổi trạng thái; dispatcher đọc outbox rồi đẩy qua queue. Exponential backoff giãn retry cho merchant kịp hồi phục, HMAC cho merchant xác thực nguồn, event id giúp merchant bỏ event trùng do at-least-once.",
      },
    },
  ],
  sims: ["saga", "queue"],
});
