BK.problem({
  id: "web-crawler",
  level: 2,
  title: "Web Crawler",
  hi: "web-crawler",
  summary: "Crawl 10 tỷ trang trong 5 ngày, lịch sự với từng domain, không mất tiến độ khi máy chết.",
  topics: ["queue", "bigdata-ds", "blob"],
  fr: [
    "Crawl bắt đầu từ danh sách seed URL",
    "Lấy HTML, trích text và link mới",
    "Lưu text để huấn luyện / index",
  ],
  nfr: [
    {
      t: "10B trang trong 5 ngày (~23k trang/s)",
      why: "Một máy không làm nổi, vì 10B trang trong 5 ngày tương đương ~23k trang/s. Hệ quả: hàng trăm crawler song song lấy việc từ queue chung, scale theo băng thông mạng.",
    },
    {
      t: "**Politeness**: tôn trọng robots.txt, giới hạn tốc độ theo domain",
      why: "Crawl dồn dập làm sập website và bị chặn IP → crawler mất khả năng tiếp cận trang. Hệ quả: tuân thủ robots.txt và rate limit theo domain trước khi tải.",
    },
    {
      t: "Fault tolerant: worker chết không mất URL",
      why: "Worker chết là chắc chắn xảy ra khi hàng trăm worker chạy nhiều ngày. Hệ quả: frontier bền, chỉ xác nhận URL sau khi xử lý xong, retry + DLQ.",
    },
    {
      t: "Không crawl trùng URL / trùng nội dung",
      why: "Crawl trùng là phí băng thông và làm bẩn index, vì web có nhiều URL trỏ về cùng nội dung (tham số, mirror). Hệ quả: Bloom filter cho URL, hash nội dung cho trang trùng.",
    },
  ],
  capacity: "23k trang/s × ~200KB HTML ≈ 4.6GB/s băng thông → hàng trăm máy crawl; giới hạn là mạng, không phải CPU.",
  entities: ["URL (frontier item)", "Domain metadata (robots, lastCrawl)", "Page (raw HTML, text)"],
  api: [
    "Input: seed URLs → Output: text trong S3",
    "Data flow: frontier → fetch → lưu raw → parse → link mới → frontier",
  ],
  hldWhy: "**URL Frontier** là queue bền (SQS/Kafka): URL không mất khi worker chết và nhiều crawler cùng lấy việc được — vì 10B URL không thể giữ trong RAM một máy. Tách **Crawler** (tải HTML) và **Parser workers** (trích link, nội dung) vì crawler bị giới hạn bởi mạng còn parser bởi CPU — tách ra thì scale từng loại theo bottleneck riêng. **S3** lưu raw HTML vì dung lượng lớn và cho phép parse lại khi đổi logic mà không phải crawl lại. **Domain + URL DB** giữ robots.txt, thời điểm crawl cuối của mỗi domain và URL đã thấy, phục vụ politeness và dedupe.",
  hld: {
    id: "hld-web-crawler",
    title: "HLD — Web Crawler",
    h: 340,
    scenario: "Pipeline 2 stage: Crawler fetch và lưu raw HTML; Parser trích text, lọc link đã thấy, đẩy link mới về frontier.",
    context: "**URL Frontier** (SQS/Kafka) là queue URL cần crawl. **Crawler** lấy URL, kiểm quy tắc lịch sự (robots.txt, rate limit theo domain) trong **Domain + URL DB**, fetch trang từ **Internet** và lưu raw HTML lên **S3**. **Parser workers** là stage thứ hai: trích text và link, lọc link đã thấy rồi đẩy link mới về frontier. Theo dõi dòng chữ dưới S3 (đã lưu gì) và dưới Domain + URL DB (bao nhiêu URL đã đánh dấu “seen”).",
    nodes: [
      { id: "frontier", x: 90, y: 170, label: "URL Frontier", s: "SQS / Kafka" },
      { id: "crawler", x: 300, y: 80, label: "Crawler" },
      { id: "parser", x: 300, y: 270, label: "Parser workers", w: 150 },
      { id: "web", x: 530, y: 50, label: "Internet" },
      { id: "meta", x: 530, y: 170, label: "Domain + URL DB", w: 160, s: "robots · lastCrawl · seen" },
      { id: "s3", x: 700, y: 270, label: "S3", s: "—" },
    ],
    links: [
      ["frontier", "crawler"],
      ["crawler", "parser"],
      ["crawler", "web"],
      ["crawler", "meta"],
      ["crawler", "s3"],
      ["parser", "s3"],
      ["parser", "meta"],
      ["parser", "frontier"],
    ],
    variants: [
      {
        name: "Crawl 1 trang",
        steps: [
          {
            note: "Crawler lấy URL từ **frontier**.",
            msgs: [["frontier", "crawler", "vnexpress.net/a"]],
            detail: "Crawler nhận message `vnexpress.net/a` từ frontier, và URL không mất dù crawler chết giữa chừng. Với SQS, message không bị xoá mà chỉ bị **ẩn** trong khoảng visibility timeout; crawler phải ack (delete) sau khi xử lý xong.",
          },
          {
            note: "Kiểm tra **robots.txt** và rate limit của domain (ví dụ 1 req/s).",
            msgs: [["crawler", "meta", "robots + lastCrawl"], ["meta", "crawler", "allowed · 2s trước", "ok"]],
            detail: "Domain DB cho phép fetch: kết quả `allowed · 2s trước` — đã quá 1s so với giới hạn 1 req/s. Trước khi fetch, crawler tra robots.txt của vnexpress.net (đã cache) xem có cho path `/a` không, và lần crawl gần nhất của domain là khi nào. Đây là **politeness**: thiếu nó, hàng trăm crawler song song có thể cùng bắn vào một site, vô tình DDoS nó, và crawler bị chặn IP.",
          },
          {
            note: "Fetch và lưu **raw HTML** lên S3 trước khi parse — parse lại được mà không phải fetch lại.",
            msgs: [
              ["crawler", "web", "GET /a"],
              ["web", "crawler", "200 HTML", "ok"],
              ["crawler", "s3", "raw/a.html", "ok"],
            ],
            set: { s3: "raw: 1 trang" },
            detail: "Crawler lưu `raw/a.html` lên S3 **trước** khi parse, ngay sau khi `GET /a` trả `200 HTML`. Fetch là bước đắt nhất (network, chờ server lạ, có thể bị rate limit), còn parse là CPU thuần. Giữ raw HTML → khi sửa bug parser hoặc cần trích thêm trường, ta parse lại toàn bộ từ S3 mà không phải tải lại hàng tỷ trang. Crawler cũng cập nhật `lastCrawl` của domain sau khi fetch.",
          },
          {
            note: "Đẩy job parse sang stage 2.",
            msgs: [["crawler", "parser", "parse job"]],
            detail: "Crawler đẩy một parse job (chứa đường dẫn S3) sang stage 2 rồi ack URL với frontier. Message chỉ mang **tham chiếu** tới file, không mang cả HTML → queue nhẹ. Crawler rảnh ngay để lấy URL kế tiếp, không bị chặn bởi tốc độ parse.",
          },
          {
            note: "Parser trích text + link, lọc link **đã thấy** (Bloom filter), đưa link mới vào frontier.",
            msgs: [
              ["parser", "s3", "text/a.txt", "ok"],
              ["parser", "meta", "seen? ×42 link"],
              ["meta", "parser", "31 link mới", "ok"],
              ["parser", "frontier", "enqueue 31", "ok"],
            ],
            set: { meta: "seen +31", s3: "raw + text" },
            lesson: "Tách fetch và parse thành 2 stage có queue riêng: scale và retry độc lập.",
            detail: "Parser ghi `text/a.txt` lên S3 và enqueue 31 link mới vào frontier. Từ raw HTML, parser làm sạch text và trích được 42 link, rồi hỏi bảng seen link nào đã gặp: **Bloom filter** kiểm tra trong RAM với vài bit mỗi URL thay vì tra DB hàng tỷ dòng; 31 link còn lại được đánh dấu seen. Bloom filter có thể báo nhầm “đã thấy” (false positive, ví dụ ~1%) nên một ít URL mới bị bỏ sót — chấp nhận được với crawler — nhưng không bao giờ báo nhầm “chưa thấy”, nên không crawl trùng. Tách fetch và parse thành 2 stage có queue riêng → scale từng bên theo nút thắt của nó (network vs CPU) và retry độc lập.",
          },
        ],
      },
      {
        name: "Domain đang bị giới hạn",
        steps: [
          {
            note: "URL cùng domain vừa crawl 0.3s trước.",
            msgs: [
              ["frontier", "crawler", "vnexpress.net/b"],
              ["crawler", "meta", "lastCrawl?"],
              ["meta", "crawler", "0.3s trước", "err"],
            ],
            detail: "Crawler chưa được fetch `vnexpress.net/b`: `lastCrawl` cho thấy domain vừa bị crawl **0.3s trước** — chưa đủ 1s theo giới hạn 1 req/s, fetch bây giờ là vi phạm politeness. Tình huống này rất thường gặp vì một trang thường có hàng chục link cùng domain được enqueue gần nhau.",
          },
          {
            note: "Không fetch: **đưa lại vào queue có delay** thay vì để worker ngồi chờ.",
            msgs: [["crawler", "frontier", "re-enqueue · delay 1s", "warn"]],
            lesson: "Politeness = robots.txt + rate limit theo domain (bảng lastCrawl) + delay queue.",
            detail: "Crawler đẩy URL lại frontier với **delay 1s** (SQS `DelaySeconds` hoặc change visibility) rồi xử lý URL khác ngay, thay vì `sleep` 0.7s (giữ worker và kết nối không làm gì). Worker luôn bận với domain khác nên throughput toàn hệ thống không giảm, trong khi mỗi domain vẫn chỉ nhận tối đa 1 req/s. Thiết kế chuẩn hơn là frontier chia queue theo domain để khỏi lấy ra rồi trả lại nhiều lần, nhưng ý tưởng giống nhau: chờ trong queue, không chờ trong worker.",
          },
        ],
      },
      {
        name: "Worker chết giữa chừng",
        steps: [
          {
            note: "Crawler nhận URL rồi crash trước khi ack.",
            msgs: [["frontier", "crawler", "vnexpress.net/c"]],
            set: { crawler: "💥 crash" },
            bad: ["crawler"],
            detail: "Crawler crash (OOM, máy bị thu hồi) sau khi nhận `vnexpress.net/c` nhưng **trước khi ack** — và không mất gì. Chưa ack thì SQS chưa xoá message, chỉ đang ẩn trong visibility timeout. Crawler không giữ trạng thái quan trọng nào ngoài message đang xử lý, nên không mất thông tin tiến độ.",
          },
          {
            note: "Hết **visibility timeout**, message hiện lại cho worker khác.",
            set: { crawler: "worker mới" },
            msgs: [["frontier", "crawler", "vnexpress.net/c (lần 2)", "warn"]],
            detail: "Một worker mới nhận `vnexpress.net/c` lần 2 khi **visibility timeout** (ví dụ 30–60s) hết và message tự hiện lại trong queue. Đây là ngữ nghĩa **at-least-once**: URL có thể bị xử lý hai lần nếu worker cũ thật ra đã fetch xong nhưng chưa kịp ack, nên các bước sau phải idempotent — ghi S3 cùng key là ghi đè, đánh dấu seen hai lần cũng vô hại. Timeout phải dài hơn thời gian crawl bình thường, nếu không message bị giao cho worker khác khi worker đầu vẫn đang làm.",
          },
          {
            note: "Lỗi lặp lại quá 3 lần (trang luôn timeout) → chuyển sang DLQ.",
            msgs: [["crawler", "frontier", "fail ×3 → DLQ", "err"]],
            lesson: "Queue có ack + retry + DLQ cho fault tolerance mà không cần tự viết checkpoint.",
            detail: "SQS chuyển message sang **DLQ** (dead-letter queue) sau 3 lần thất bại (`maxReceiveCount = 3` trong redrive policy), thay vì để nó xoay vòng mãi và chiếm worker. Trang này luôn timeout, nên message bị nhận rồi thất bại lặp đi lặp lại. DLQ được theo dõi bằng alert; người vận hành xem lý do và quyết định bỏ hay đẩy lại. Ack + retry + DLQ cho fault tolerance đầy đủ mà không phải tự viết checkpoint.",
          },
        ],
      },
    ],
  },
  diagrams: [
    {
      src: "content/svg/bigdata-ds-bloom-filter.svg",
      caption: "Bảng “URL đã thấy” dùng Bloom filter: một bit bằng 0 là URL chắc chắn mới nên đưa vào frontier; báo “có thể đã thấy” thì đôi khi nhầm (false positive) và bỏ sót một ít URL — chấp nhận được với crawler.",
      source: "https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/",
    },
  ],
  deep: [
    {
      q: "Không mất tiến độ khi worker chết?",
      bad: "Frontier nằm trong RAM của crawler.",
      good: "Queue bền (Kafka) + commit offset sau khi xử lý.",
      great: "SQS visibility timeout + retry với backoff + DLQ; pipeline 2 stage, raw HTML lưu S3 để parse lại.",
      why: {
        bad: "Crawler crash là mất toàn bộ URL đang chờ và tiến độ, phải bắt đầu lại, vì frontier nằm trong RAM; hàng tỷ URL cũng không vừa RAM một máy.",
        good: "Queue bền giữ URL khi worker chết; commit offset sau khi xử lý nên URL chưa xong sẽ được đọc lại. Nhưng Kafka commit theo offset nên một URL chậm/lỗi chặn cả partition phía sau, và không có retry có delay riêng cho từng URL.",
        great: "Worker chết thì message tự quay lại queue cho worker khác, xử lý theo từng message — vì SQS ẩn message trong visibility timeout và tự hiện lại nếu không bị xoá. Backoff tránh dồn retry vào site đang lỗi, DLQ gom URL lỗi mãi để không lặp vô hạn; raw HTML lưu S3 cho phép parse lại mà không tải lại.",
      },
    },
    {
      q: "Lịch sự với website?",
      bad: "Crawl hết tốc độ.",
      good: "Đọc và tuân thủ robots.txt.",
      great: "Cache robots.txt, rate limit theo domain (Redis lastCrawl / token bucket), requeue có delay + jitter.",
      why: {
        bad: "Server nhỏ quá tải như bị DDoS khi hàng trăm crawler cùng gửi request tới một domain; site sẽ chặn IP và crawler mất quyền truy cập.",
        good: "Tuân thủ robots.txt tránh vùng cấm và đọc `Crawl-delay`. Nhưng không có cơ chế thực thi tốc độ giữa nhiều crawler, và tải robots.txt mỗi lần crawl là thêm một request thừa.",
        great: "Tốc độ tới domain được giới hạn toàn cục, vì `lastCrawl` theo domain nằm ở Redis dùng chung — mọi crawler kiểm tra cùng một nguồn trước khi tải. URL chưa tới lượt quay lại queue có delay + jitter thay vì chặn worker ngồi chờ; cache robots.txt bỏ request lặp.",
      },
    },
    {
      q: "Không crawl trùng URL và trùng nội dung?",
      bad: "Không kiểm tra.",
      good: "Bảng URL có unique index.",
      great: "Bloom filter cho URL đã thấy + hash nội dung để bỏ trang trùng; giới hạn độ sâu chống crawler trap.",
      why: {
        bad: "Thiếu kiểm tra thì cùng URL bị crawl lại nhiều lần qua các link khác nhau, và crawler có thể lặp vô hạn giữa các trang link qua lại.",
        good: "Unique index chặn URL trùng chính xác. Nhưng tra index DB cho mỗi URL ở ~23k trang/s (mỗi trang chứa hàng chục link) tạo hàng trăm nghìn lookup/s, và không phát hiện cùng nội dung ở URL khác.",
        great: "Kiểm tra trong bộ nhớ, không tốn round-trip DB, vì Bloom filter cho 10B URL tốn khoảng 12GB RAM (~10 bit/URL với 1% false positive) — vẫn rẻ so với tra DB mỗi URL; false positive chỉ làm sót một số ít URL, chấp nhận được. Hash nội dung bắt trang trùng ở URL khác; giới hạn độ sâu chặn trap kiểu calendar vô hạn.",
      },
    },
  ],
  sims: ["queue"],
});
