# Đề xuất: review nội dung và khoảng trống chủ đề

Người viết: Solution Architect · Nhánh `sa/content-gaps` (từ `8eee891`) · Ngày 2026-11-27

Phần A là kết quả review 39 topic và 13 problem: những gì đã sửa và những gì cần người quyết. Phần B đề xuất chủ đề mới. Phần B không chọn track hay giai đoạn; Product Design sẽ phân loại.

---

## Phần A · Kết quả review

### A1. Đã sửa (mỗi loại một commit)

| Commit | Thay đổi | Nguồn |
|---|---|---|
| `96934ee` | Bỏ giá tiền: `~$0.10/giờ/cluster`, `~$73/tháng`, `~$0.60/giờ` (sim `container-stack`, `ecs-vs-eks`, `eks`), `$0.023/GB-tháng` (`blob`). Thay bằng cơ chế tính phí, kèm link tới trang giá. | https://aws.amazon.com/eks/pricing/ · https://aws.amazon.com/ecs/pricing/ · https://aws.amazon.com/s3/pricing/ |
| `a2fe1b9` | `scripts/check.mjs` có thêm luật `PRICE`. Luật báo lỗi khi có giá theo đơn vị (`$x/…`, `$x mỗi …`, `$x per`, `≈ $x`). Số tiền trong kịch bản như `charge $50` vẫn hợp lệ. Đã thử: chạy trên bản `eks.js` cũ thì báo đúng 3 lỗi. | Luật "không ghi giá" trong `CLAUDE.md` |
| `326571b` | Đính chính các thông tin đã lỗi thời, xem 6 mục bên dưới. | |
| `c6140d1` | Sửa lỗi lập luận, xem 5 mục bên dưới. | |
| `76fa535` | Đổi tên dòng "State Machine" trong `patterns-gof` thành "State (state machine)" để cùng thuật ngữ với `lld-delivery` và `lld-problems-list`. | Tên pattern theo GoF |
| `45719f5` | Sửa câu cùng loại với `search` trong `yelp`. Câu cũ "không index nào dùng được" cho `LIKE '%phở%'` mâu thuẫn với đính chính `pg_trgm`. | https://www.postgresql.org/docs/current/pgtrgm.html |

Sáu thông tin lỗi thời đã đính chính trong `326571b`:

- `ds`: từ Python 3.14, `heapq` có sẵn `heappush_max`, `heappop_max` và `heapify_max`. Card và point cũ nói "chỉ có min-heap". Nguồn: https://docs.python.org/3/library/heapq.html
- `system-architecture` (serverless): Lambda **tái dùng** môi trường chạy giữa các lần gọi. Cold start chỉ xảy ra khi phải tạo môi trường mới. Tiền tính theo số request cộng với thời gian chạy × bộ nhớ. Nguồn: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html
- `blob`: Glacier Instant Retrieval đọc dữ liệu trong mili giây. Chỉ Flexible Retrieval và Deep Archive mới mất từ phút đến nhiều giờ. Nguồn: https://aws.amazon.com/s3/storage-classes/glacier/
- `search`: `LIKE '%x%'` không dùng được B-Tree, nhưng index trigram `pg_trgm` hỗ trợ được. Index này vẫn không có stemming và không xếp hạng độ liên quan. Nguồn: https://www.postgresql.org/docs/current/pgtrgm.html
- `networking`: HTTP/3 chạy QUIC trên UDP và không bị head-of-line blocking giữa các stream. Ý gốc từ Miro nên mang tiền tố `! ` (badge Đính chính). Nguồn: https://www.rfc-editor.org/rfc/rfc9114
- `eks`: từ Kubernetes 1.28, EKS mặc định envelope-encrypt mọi dữ liệu API bằng KMS. Câu cũ nói Secret "chỉ base64" và phải tự bật. Nguồn: https://docs.aws.amazon.com/eks/latest/userguide/envelope-encryption.html

Năm lỗi lập luận đã sửa trong `c6140d1`:

- `api-design`: câu cũ "4xx không retry" mâu thuẫn với dòng nói 429 thì chờ rồi thử lại. Đã sửa thành: 408 và 429 retry được (theo `Retry-After`); 5xx retry được, nhưng với POST chỉ an toàn khi có idempotency key. Nguồn: RFC 9110 §15, RFC 6585 §4.
- `uber`: deep dive ghi `WHERE status='AVAILABLE'`, còn HLD ghi `REQUESTED`. Đã thống nhất thành điều kiện trên ride (`REQUESTED`), kiểm tài xế trong cùng transaction.
- `ad-click`:
  - Exactly-once của Flink chỉ phủ state. Muốn ClickHouse không bị trùng thì sink phải ghi idempotent hoặc ghi theo transaction. Nguồn: https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/overview/
  - Ghi Kafka lỗi sau `SET NX` thì phải xoá key, nếu không click sẽ mất.
- `ticketmaster`: API confirm gửi `paymentDetails` (dữ liệu thẻ) về backend, trái với HLD nói Stripe gánh PCI. Đã đổi thành `paymentMethodId`.
- `concurrency`: semaphore giới hạn số việc chạy **đồng thời**, không phải rate limit (số lần mỗi giây).

`node scripts/check.mjs` pass sau mỗi commit.

**Cách ghi nguồn.** `docs/content-system.md` §6 nói URL nằm trong trường `src`. Nhưng app chỉ render `source` của `diagrams`, không có trường `src` cho point hay why. Vì vậy URL được ghi ngay trong câu, giống các URL đã có trong `kafka`, `redis`, `networking` và `bitly`. **Cần quyết:** thêm trường `src` cho point/why và render nó, hoặc sửa §6 theo cách đang làm.

### A2. Cần quyết (chưa sửa)

Các mục dưới đây là lựa chọn thiết kế, cách diễn đạt, hoặc thông tin mới mà người review đưa ra nhưng tôi chưa tự kiểm chứng.

**Đúng một phần, nên sửa câu chữ**

| Chỗ | Vấn đề | Đề xuất |
|---|---|---|
| `core-db` (NoSQL "phải tự xử lý ghi dở dang", "Transaction: thường eventual") | MongoDB có transaction nhiều document từ 4.0; DynamoDB có `TransactWriteItems`. Câu cũ cũng trộn transaction với consistency. | Viết: "nhiều NoSQL đã có transaction nhưng giới hạn phạm vi, số item, độ trễ". |
| `core-db` (bảng isolation, Repeatable Read cho phép phantom) | Câu này chỉ đúng với chuẩn SQL và InnoDB. Repeatable Read của PostgreSQL là snapshot isolation: không có phantom nhưng có write skew. Site lấy PostgreSQL làm DB mặc định. | Thêm một dòng về PostgreSQL. |
| `indexing` (card "Không — vi phạm leftmost prefix") | Mâu thuẫn với point cùng file nói "trừ engine có skip scan". | Thêm cùng ngoại lệ vào card. Phiên bản hỗ trợ skip scan (PostgreSQL 18, MySQL 8.0.13+) **chưa kiểm chứng**. |
| `caching` và `dist-cache` | Write-through được định nghĩa hai kiểu: "cache ghi DB rồi trả lời" và "ghi cache và DB cùng lúc". | Chọn một định nghĩa, file còn lại link sang. |
| Hot key | Có bốn cách gọi: `key#1..#k`, key salting, compound shard key, `hotkey_1`. | Dùng một thuật ngữ "key salting" và một ví dụ. |
| L4 throughput | Ba cách nói: "triệu kết nối", "triệu kết nối/giây", "triệu request/giây". | Chọn một đơn vị. |
| `consistent-hashing` | Ghi "hàng trăm virtual node", nhưng Cassandra 4.0 hạ `num_tokens` mặc định xuống 16 (**chưa kiểm chứng**). Ghi "DynamoDB", trong khi ring đến từ paper Dynamo, không phải dịch vụ DynamoDB. Thêm một server vào N server thì khoảng K/(N+1) key đổi chỗ, không phải K/N. | Sửa con số và tên. |
| `lb-gateway-cdn` | "L4 không cần kết thúc TLS". NLB có TLS listener. | Viết "kết thúc TLS ở L4 là tuỳ chọn". |
| `streams` | Tên "Spark Streaming" là DStreams cũ. | Đổi thành "Spark Structured Streaming". |
| `api-design` | Header `Accept-Version` không phải chuẩn. | Viết "header tự đặt" hoặc media-type versioning. |
| `redis` | `ZREVRANGE` đã deprecated từ 6.2. | Dùng `ZRANGE … REV`. |
| `eks` (công thức HPA) | Thiếu `ceil`, trong khi sim `eks-flow` có. | Thêm `ceil`. |
| `ecs` và sim `ecs-flow` | Task thiếu chỗ được gọi `PROVISIONING` ở chỗ này, `PENDING` ở chỗ kia. | Thống nhất theo tài liệu capacity provider. |
| `payment` | Node `psp` có nhãn "Card Network" và nhận idempotency key, nhưng card network không nhận key. `ticketmaster` gọi cùng vai trò này là "Stripe". | Đổi nhãn thành "PSP / Acquirer". Sửa "PCI DSS **buộc** tokenize" thành "tokenize để thu hẹp phạm vi PCI". |
| `whatsapp` | `PUBLISH` trả 0 không có nghĩa là không ai nghe: trong Redis Cluster, PUBLISH chỉ đếm subscriber trên node nhận lệnh. Partition `chatId` không giới hạn sẽ thành hot partition với group lớn. | Quyết push theo presence hoặc ack timeout. Bucket partition theo `(chatId, tháng)`. |
| `news-feed` | Redis LIST với cursor "id hoặc timestamp" không seek được theo giá trị. | Dùng ZSET với score = timestamp, hoặc ghi rõ cursor được áp dụng sau khi đọc. |
| `google-docs` | Bước snapshot nói giữ nguyên ops log, deep dive lại nói compaction xoá op cũ. | Chọn một (ví dụ giữ op N ngày cộng snapshot theo version). |
| `ad-click` | HLD dedupe ở Click Processor, deep dive dedupe trong Flink. | Chọn một chỗ dedupe. |
| `patterns-gof` | `VehicleFactory.create(type)` là Simple Factory, không phải Factory Method của GoF. Builder trong bài là biến thể của Bloch. | Đổi nhãn hoặc đổi ví dụ. |
| `solid` và glossary ISP | Câu hiện tại bỏ mất góc nhìn client. | Viết "Client không bị buộc phụ thuộc vào method nó không dùng". |
| glossary `gRPC` | Ghi "Google RPC". | Tên chính thức là đệ quy: "gRPC Remote Procedure Calls". |
| glossary `vCPU` | "đơn vị tính tiền của Fargate/EC2". EC2 tính theo instance. | Sửa câu định nghĩa. |
| Sim `container-decide` (`gpu` → `eks: 1`) | Mâu thuẫn với tip "đừng chọn EKS vì cần GPU" trong `ecs-vs-eks`. Câu hỏi của sim gộp cả DaemonSet, mà DaemonSet đúng là lý do nghiêng về EKS. | Tách GPU khỏi DaemonSet, hoặc bỏ trọng số EKS cho GPU. |

**Phần trăm giảm giá: có tính là giá không?**

- `ecs`: Fargate Spot "rẻ hơn tới ~70%".
- `eks`: Spot "giảm 70–90%". AWS chỉ ghi "tới 90%"; cận dưới 70% không có nguồn.

Đây là mức giảm tương đối, không phải giá. Luật hiện tại không cấm. Đề xuất giữ "tới 90%" kèm link, bỏ cận 70.

**Thông tin mới do reviewer đưa ra, tôi chưa mở nguồn**

| Thông tin | Chỗ bị ảnh hưởng |
|---|---|
| Kafka 4.2: share groups (KIP-932, "Queues for Kafka") sẵn sàng production. Cho phép nhiều consumer hơn số partition, ack từng record. | `kafka` (các câu "số partition = số consumer tối đa", "không có ack từng message"). Nếu đúng thì giới hạn phạm vi các câu này về consumer group cổ điển. |
| ECS Managed Instances: lựa chọn compute thứ ba của ECS. | `ecs`, `ecs-vs-eks`, sim `container-stack` |
| EKS trên Fargate: không có EBS, không có Spot, không có Arm; không có IMDS nên dùng IRSA thay Pod Identity. | `eks`, `eks-flow` |
| Redis đổi license (7.4: RSALv2/SSPL; 8: thêm AGPLv3) và bản fork Valkey. | `redis` |

**Ý còn thiếu, nên bổ sung vào chủ đề có sẵn (không đáng tách chủ đề mới)**

| Chủ đề | Bổ sung |
|---|---|
| `networking` | HTTP/2 multiplexing, TLS 1.3 handshake 1-RTT |
| `api-design` | `202 Accepted` + polling; ETag / `If-Match` cho optimistic concurrency |
| `blob` | S3 strong read-after-write consistency từ 12/2020; giới hạn request theo prefix |
| `caching` | Cache penetration (negative cache, Bloom filter); race giữa delete và đọc stale |
| `sharding` | Global secondary index; quy trình resharding |
| `cap` | Quorum R + W > N; linearizability khác serializability |
| `streams` | Số consumer trong group ≤ số partition; log compaction |
| `queue` | SQS visibility timeout; lag là tín hiệu để scale |
| `dist-lock` | Nhả lock bằng compare-and-delete (Lua); gia hạn lease |
| `dist-cache` | `maxmemory-policy` mặc định `noeviction`; LRU/LFU của Redis là xấp xỉ |
| problem `rate-limiter` | Lấy thời gian từ `TIME` của Redis thay vì đồng hồ của từng gateway |
| problem `dropbox` | Dedupe theo hash do client khai là lỗ hổng truy cập, server phải tự tính hash |
| problem `web-crawler` | DNS cache; chuẩn hoá URL trước khi tra Bloom filter |
| `concurrency` | `Condition.wait()` phải nằm trong vòng `while` |
| `code-architecture` | Gốc của từng kiến trúc: Hexagonal (Cockburn), Onion (Palermo), Clean (Martin) |
| `system-architecture` | Strangler Fig khi tách monolith |
| `dev-methods` | DDD strategic: context map, Anti-Corruption Layer |

Trong bảng trên, "rate limiting phân tán" được ghép vào problem `rate-limiter` (đã có sim `token-bucket`), không tách thành topic.

### A3. Phạm vi chưa review

- 48 sim: chỉ 10 sim được đọc kỹ (Kafka, Redis, container, ECS/EKS, saga). Khoảng 38 sim còn lại chỉ được xem qua grep giá tiền.
- Bốn reviewer phụ đọc toàn bộ topic và problem. Những mục tôi chưa tự mở nguồn đều ghi "chưa kiểm chứng" ở trên. Mọi mục ở A1 đã được kiểm chứng bằng tài liệu gốc trong phiên này.

---

## Phần B · Chủ đề mới

Thứ tự ưu tiên:

- **P0**: hay gặp trong phỏng vấn SD và hiện **không có nhà**.
- **P1**: hay gặp, có mảnh rải rác.
- **P2**: deep dive hoặc nâng cao.

Mọi id đã được kiểm bằng script: không trùng với id topic/problem/sim có sẵn, và mọi id tiên quyết hoặc liên quan đều tồn tại.

Bảng tóm tắt:

| # | id | Tiêu đề tạm | Ưu tiên | Tiên quyết |
|---|---|---|---|---|
| 1 | `durable-execution` | Durable Execution & workflow engine | P0 | `queue`, `patterns` |
| 2 | `idempotency` | Idempotency & exactly-once trong thực tế | P0 | `api-design`, `queue` |
| 3 | `outbox-cdc` | Dual write, Transactional Outbox & CDC | P0 | `core-db`, `kafka` |
| 4 | `replication` | Replication: leader–follower, quorum, failover | P0 | `core-db`, `cap` |
| 5 | `resilience` | Timeout, retry, circuit breaker, load shedding | P0 | `api-design`, `queue` |
| 6 | `observability` | Observability: logs, metrics, traces, SLO | P0 | `numbers`, `system-architecture` |
| 7 | `consensus` | Consensus & leader election (Raft, lease, fencing) | P1 | `replication`*, `dist-lock` |
| 8 | `auth` | Xác thực & phân quyền: session, JWT, OAuth 2.0/OIDC | P1 | `api-design`, `networking` |
| 9 | `multi-region` | Multi-region & Disaster Recovery | P1 | `replication`*, `cap`, `lb-gateway-cdn` |
| 10 | `id-generation` | Sinh ID duy nhất trong hệ phân tán | P1 | `sharding`, `indexing` |
| 11 | `deployment-safety` | Triển khai an toàn & tương thích ngược | P1 | `system-architecture`, `ecs` |
| 12 | `vector-search` | Vector search & ANN | P1 | `search`, `indexing` |
| 13 | `storage-engines` | Storage engine: B-Tree, LSM, WAL | P2 | `indexing`, `core-db` |
| 14 | `stream-processing` | Stream processing: window, watermark, state | P2 | `streams`, `kafka` |
| 15 | `time-ordering` | Đồng hồ & thứ tự sự kiện | P2 | `replication`* |

\* là id mới trong đề xuất này. Mục 7, 9 và 15 phụ thuộc mục 4.

Các ý đã cân nhắc nhưng không tách thành chủ đề:

- **Rate limiting phân tán**: đã có problem `rate-limiter` và sim `token-bucket`; phần thiếu ghi ở A2.
- **Saga**: đã nằm trong `patterns` và sim `saga`. So sánh saga với durable execution đặt trong mục 1.
- **Backpressure**: là một phần của mục 5.
- **Feature flag**: là một phần của mục 11.
- **Schema evolution** (Avro/Protobuf, schema registry): gộp vào mục 11, phần tương thích ngược. Tách riêng nếu sau này có track Kafka sâu.
- **Security nền tảng** (TLS/mTLS, KMS, secret): phần cần cho SD nằm ở mục 8 và `eks`. Chưa đủ giá trị phỏng vấn để thành chủ đề riêng.

---

### 1. `durable-execution` · Durable Execution & workflow engine · **P0**

- **Vì sao cần**
  - Quy trình nhiều bước kéo dài từ phút tới ngày (thanh toán → giữ hàng → giao hàng, onboarding, ghép tài xế) phải sống qua crash, deploy và timeout.
  - Tự làm bằng queue + bảng trạng thái + cron thì mỗi bước cần retry, mỗi lần chờ cần một job quét, và trạng thái nằm rải ở nhiều nơi.
  - Durable execution ghi lại mọi bước đã xong. Process chết thì chạy lại code từ đầu, nhưng bỏ qua những bước đã có kết quả trong log.
  - Hiện chỉ có một dòng trong `tech-cheatsheet`, một dòng trong `patterns`, và nhắc tên trong `uber`.
- **Tiên quyết**: `queue`, `patterns` (Saga).
- **Liên quan**:
  - Topic: `patterns`, `tech-cheatsheet`, `system-architecture`
  - Sim: `saga`, `long-task`
  - Problem: `uber`, `payment`, `ticketmaster`
- **tldr**: Viết workflow như một hàm tuần tự. Engine ghi từng bước vào event history. Worker chết thì worker khác replay code theo history và đi tiếp đúng chỗ dừng. Đổi lại, code workflow phải deterministic; mọi I/O nằm trong activity/step, và activity phải idempotent.
- **Ý chính**
  1. **Vấn đề**: trạng thái của quy trình dài nằm ở đâu khi process chết? So sánh ba cách: tự làm (queue + bảng trạng thái + cron), saga choreography, và workflow engine.
  2. **Mô hình**:
     - Workflow chứa logic điều phối và phải deterministic.
     - Activity/step chứa I/O và side effect; được retry theo policy.
     - Timer bền: "chờ 7 ngày" không giữ thread hay máy nào.
     - Signal/query để tương tác với workflow đang chạy.
  3. **Event history và replay**: mỗi lệnh của workflow (gọi activity, đặt timer) sinh event và được lưu bền. Khi replay, lệnh do code sinh ra phải khớp history; lệch thì engine báo lỗi non-determinism.
  4. **Determinism**: code workflow không được gọi giờ hệ thống, random hay I/O trực tiếp; phải dùng API của SDK hoặc đưa vào activity. Lý do: replay phải ra đúng chuỗi lệnh cũ.
  5. **Đổi code khi workflow đang chạy**: versioning/patching hoặc worker versioning. Đây là cái giá vận hành lớn nhất.
  6. **History dài**: Continue-As-New bắt đầu lại với history mới. Lý do: history có giới hạn và replay chậm dần theo độ dài.
  7. **Exactly-once là ảo giác ở biên**: engine đảm bảo workflow tiến đúng, nhưng activity vẫn có thể chạy lại (at-least-once), nên lời gọi ra ngoài cần idempotency key. Link sang mục 2.
  8. **Các lựa chọn**:
     - Temporal: workflow-as-code, tự host hoặc cloud.
     - AWS Step Functions Standard: exactly-once theo state, tối đa 1 năm, history giữ 90 ngày.
     - Step Functions Express: tối đa 5 phút; async là at-least-once, sync là at-most-once.
     - Lambda durable functions: checkpoint/replay trong Lambda, tối đa 1 năm.
  9. **Saga trên durable execution**: compensation viết bằng try/catch trong workflow, thay vì event rải giữa các service.
  10. **Khi không nên dùng**:
      - Luồng ngắn, đồng bộ, một service.
      - Luồng xử lý sự kiện thông lượng rất cao, nơi stream processing hợp hơn.
- **Câu hỏi tự kiểm tra**
  - Vì sao `random()` trong code workflow làm hỏng replay?
  - Worker chết sau khi activity "charge" đã gọi PSP nhưng trước khi kết quả được ghi vào history. Chuyện gì xảy ra, và cái gì ngăn trừ tiền hai lần?
  - Step Functions Standard khác Express ở ngữ nghĩa thực thi nào? Khi nào chọn mỗi loại?
  - Khi nào dùng Continue-As-New?
  - Saga choreography và saga chạy trên workflow engine: debug khác nhau thế nào?
- **Sơ đồ / mô phỏng**
  - Sim flow "worker crash giữa workflow → replay theo event history → tiếp tục ở bước 3", hai variant: workflow deterministic và workflow có `now()` gây lỗi non-determinism.
  - SVG so sánh ba cách: cron + bảng trạng thái, saga choreography, workflow engine.
- **Nguồn**
  - https://docs.temporal.io/workflow-definition (determinism, versioning)
  - https://docs.temporal.io/encyclopedia/event-history
  - https://docs.temporal.io/workflow-execution/continue-as-new
  - https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html
  - https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html

### 2. `idempotency` · Idempotency & exactly-once trong thực tế · **P0**

- **Vì sao cần**
  - Mạng chỉ cho at-least-once: timeout không cho biết request đã chạy hay chưa, nên client buộc phải gửi lại.
  - Không có idempotency thì gửi lại là trừ tiền hai lần.
  - Hiện ý này có mặt ở 8 file (`api-design`, `kafka`, `queue`, `redis`, `payment`, `ticketmaster`, `web-crawler`, `concurrency`) nhưng không file nào giải thích đủ cơ chế. Theo luật "Link, đừng viết lại", cần một nhà cho nó.
- **Tiên quyết**: `api-design`, `queue`.
- **Liên quan**:
  - Topic: `api-design`, `kafka`, `queue`
  - Sim: `kafka-delivery`, `saga`
  - Problem: `payment`, `ticketmaster`, `ad-click`
- **tldr**: "Exactly-once" ngoài đời là at-least-once cộng với xử lý idempotent. Server lưu kết quả lần đầu theo idempotency key; lần gửi lại có cùng key thì trả lại kết quả đó thay vì chạy lại.
- **Ý chính**
  1. **Thao tác tự nhiên idempotent** (PUT, DELETE, `SET x=5`) và **không idempotent** (POST, `x = x+1`). Lý do POST cần key.
  2. **Idempotency key**:
     - Client sinh key (UUIDv4); server lưu key cùng status và body của lần đầu.
     - Key có thời hạn. Stripe API v1 có thể xoá key sau ít nhất 24 giờ.
  3. **So khớp payload**: cùng key nhưng khác tham số thì báo lỗi (draft IETF đề xuất 422). Nếu không so, client lỡ dùng lại key sẽ nhận kết quả sai.
  4. **Hai request cùng key chạy đồng thời**: trả 409. Thực hiện bằng unique constraint hoặc lock trên key. Phải ghi key **trong cùng transaction** với thay đổi nghiệp vụ, nếu không sẽ có khe hở giữa hai lần ghi.
  5. **Phía consumer**: bảng `processed_messages` (dedupe theo message id) hoặc upsert theo khoá tự nhiên. Link `kafka-delivery`.
  6. **Kafka exactly-once**:
     - Idempotent producer chống trùng khi producer gửi lại.
     - Transaction cộng `read_committed` chỉ phủ chu trình đọc–xử lý–ghi **bên trong Kafka**.
     - Ghi ra DB ngoài vẫn cần dedupe.
  7. **Stream processing**: exactly-once tới sink đòi sink ghi idempotent hoặc theo transaction. Link `ad-click`.
  8. **Gọi ra bên thứ ba**: chuyển tiếp idempotency key (ví dụ `pi_1` sang PSP). Đã có ví dụ trong `payment`.
  9. **Bẫy**:
     - Sinh key mới mỗi lần retry.
     - Lưu key ở cache có thể bị evict.
     - Coi 5xx đã lưu là kết quả cuối mà không biết thao tác đã chạy tới đâu.
- **Câu hỏi tự kiểm tra**
  - Vì sao phải ghi key và thay đổi nghiệp vụ trong một transaction?
  - Hai request cùng key đến cách nhau 5ms thì server làm gì?
  - Kafka đã có EOS, sao consumer ghi Postgres vẫn phải dedupe?
  - Key nên hết hạn khi nào?
- **Sơ đồ / mô phỏng**: sim "client timeout → gửi lại", ba variant: không key (trừ hai lần), key không so payload, key đúng cách.
- **Nguồn**
  - https://docs.stripe.com/api/idempotent_requests
  - https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ (Internet-Draft -09, chưa là RFC)
  - Kafka delivery semantics: https://kafka.apache.org/documentation/#semantics (trang trả về redirect, chưa đọc được nội dung; cần mở lại khi viết)

### 3. `outbox-cdc` · Dual write, Transactional Outbox & CDC · **P0**

- **Vì sao cần**
  - Service vừa ghi DB vừa publish event là **dual write**: không có transaction nào bao cả DB lẫn broker.
  - Crash giữa hai lần ghi làm DB và event lệch nhau mãi mãi, sinh ra cache stale, search index thiếu dòng, hoặc service khác không biết đơn đã tạo.
  - Hiện CDC và outbox được nhắc trong `yelp`, `ticketmaster`, `news-feed`, `payment`, `search`, `dist-cache`, nhưng chưa có chỗ nào giải thích cơ chế.
- **Tiên quyết**: `core-db`, `kafka`.
- **Liên quan**:
  - Topic: `system-architecture`, `search`, `dist-cache`, `tech-cheatsheet`
  - Problem: `yelp`, `news-feed`, `payment`, `ticketmaster`
  - Sim: `cache-write`
- **tldr**: Ghi event vào bảng `outbox` trong **cùng transaction** với dữ liệu nghiệp vụ. Một tiến trình khác, thường là CDC đọc WAL hoặc binlog, đẩy event ra broker. Event được giao ít nhất một lần, nên consumer phải idempotent.
- **Ý chính**
  1. **Dual write hỏng thế nào**: bốn thứ tự ghi × crash ở giữa. Cả "ghi DB trước" lẫn "publish trước" đều hỏng.
  2. **Outbox table**: các cột `id` (dùng để dedupe), `aggregatetype` (chọn topic), `aggregateid` (key giữ thứ tự), `type`, `payload`.
  3. **Relay bằng polling** (`SELECT … FOR UPDATE SKIP LOCKED`) hay **bằng CDC** (Debezium đọc log): độ trễ, tải lên DB, thứ tự.
  4. **CDC không có outbox** (đọc thẳng bảng nghiệp vụ): nhanh, nhưng lộ schema nội bộ ra ngoài làm hợp đồng.
  5. **Thứ tự**: key theo aggregate để mọi event của một đơn vào cùng partition.
  6. **At-least-once**: relay có thể gửi lại; consumer dedupe theo `id`. Link mục 2.
  7. **Dọn outbox**: xoá sau khi gửi, hoặc để log CDC tự trôi đi.
  8. **Liên hệ**:
     - CQRS/read model, cập nhật Elasticsearch, invalidate cache: tất cả là consumer của cùng luồng event.
     - Saga choreography cần outbox để phát event tin cậy.
- **Câu hỏi tự kiểm tra**
  - Vì sao "ghi DB rồi publish trong `finally`" vẫn mất event?
  - Outbox giải bài gì mà CDC thuần không giải?
  - Relay crash sau khi publish nhưng trước khi đánh dấu đã gửi thì sao?
- **Sơ đồ / mô phỏng**
  - Sim hai variant: dual write crash giữa chừng, và outbox + CDC.
  - SVG luồng: DB → WAL → Debezium → Kafka → (ES, cache, service khác).
- **Nguồn**
  - https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html
  - https://www.postgresql.org/docs/current/warm-standby.html (WAL streaming, nền của logical decoding; khi viết nên mở thêm trang logical decoding)

### 4. `replication` · Replication: leader–follower, quorum, failover · **P0**

- **Vì sao cần**
  - Mọi bài SD đều có "thêm read replica" hoặc "replicate sang AZ khác", nhưng site chưa có topic giải thích replication.
  - Sim `replica-lag` hiện không có topic nào làm nhà.
  - Người học cần trả lời được: ghi đồng bộ hay bất đồng bộ, failover mất dữ liệu gì, đọc từ replica thấy gì.
- **Tiên quyết**: `core-db`, `cap`.
- **Liên quan**:
  - Sim: `replica-lag`, `cap`
  - Topic: `cap`, `sharding`, `kafka` (ISR), `redis` (replication bất đồng bộ), `consistent-hashing`
- **tldr**: Replication sao chép dữ liệu để chịu lỗi và scale đọc.
  - Đồng bộ: commit chờ replica xác nhận, đổi lại độ trễ ghi.
  - Bất đồng bộ (mặc định của PostgreSQL): ghi nhanh, nhưng failover có thể mất các commit cuối, và đọc từ replica có thể thấy dữ liệu cũ.
- **Ý chính**
  1. **Ba mô hình**: single-leader, multi-leader, leaderless (Dynamo-style).
  2. **Sync và async**:
     - PostgreSQL streaming replication mặc định async.
     - `synchronous_commit` có các mức `remote_write`, `on`, `remote_apply`, mỗi mức đảm bảo một điều khác nhau.
  3. **Replica lag và các bất thường khi đọc**:
     - read-your-writes
     - monotonic reads
     - cách chữa: đọc từ leader sau khi ghi, hoặc đọc kèm LSN/version
  4. **Failover**:
     - Phát hiện leader chết (timeout).
     - Chọn leader mới.
     - Split brain: hai leader cùng nhận ghi. Cần fencing; link mục 7.
  5. **Quorum** R + W > N; sloppy quorum và hinted handoff (Dynamo, Cassandra).
  6. **Xung đột khi nhiều nơi cùng ghi**: last-writer-wins (mất ghi), version vector, CRDT (link `google-docs`).
  7. **Replication không thay backup**: lệnh xoá nhầm cũng được replicate.
  8. **Cách các công nghệ đã học làm**: Kafka (ISR, `min.insync.replicas`), Redis (bất đồng bộ, `WAIT`), DynamoDB/Cassandra (quorum).
- **Câu hỏi tự kiểm tra**
  - Async replication và leader chết: dữ liệu nào mất?
  - User sửa profile xong reload không thấy thay đổi. Vì sao, chữa thế nào?
  - Vì sao R + W > N cho đọc thấy ghi mới nhất, và khi nào vẫn không?
- **Sơ đồ / mô phỏng**
  - Dùng lại sim `replica-lag`.
  - Thêm sim failover có split brain, hai variant: không fencing và có fencing.
- **Nguồn**
  - https://www.postgresql.org/docs/current/warm-standby.html
  - Dynamo paper: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf (chưa mở trong phiên này)

### 5. `resilience` · Timeout, retry, circuit breaker, load shedding · **P0**

- **Vì sao cần**
  - Lỗi lan dây chuyền là nguyên nhân sập hệ thống phổ biến nhất mà bài SD hay hỏi ở phần deep dive ("dịch vụ X chậm thì sao?").
  - Retry ở mỗi tầng nhân tải lên theo cấp số: 5 tầng × 3 lần thử = 3⁵ = 243 lần ở tầng DB.
  - Hiện chỉ có mảnh rời: jitter trong `caching`, backpressure trong `queue`, waiting room trong `ticketmaster`.
- **Tiên quyết**: `api-design`, `queue`.
- **Liên quan**:
  - Problem: `rate-limiter`, `ticketmaster`
  - Sim: `token-bucket`, `stampede`, `lb`
  - Topic: `lb-gateway-cdn`, `caching`
- **tldr**: Mọi lời gọi qua mạng cần timeout. Chỉ retry thao tác idempotent, có backoff + jitter, và retry ở **một** tầng. Khi phụ thuộc hỏng thì ngắt nhanh (circuit breaker). Khi quá tải thì từ chối sớm (load shedding) thay vì xếp hàng tới chết.
- **Ý chính**
  1. **Timeout**: không có timeout thì thread và connection bị giữ mãi. Đặt timeout theo latency p99.9 của phụ thuộc.
  2. **Retry**:
     - Chỉ retry lỗi tạm thời (5xx, 408, 429).
     - Exponential backoff + jitter. Không có jitter thì mọi client retry cùng lúc.
     - Giới hạn retry bằng token bucket.
  3. **Retry amplification**: retry ở mọi tầng nhân tải lên. Chỉ retry ở một tầng.
  4. **Circuit breaker**: ba trạng thái closed, open, half-open. Lý do: ngừng gọi một phụ thuộc đang chết để nó có thời gian hồi phục.
  5. **Bulkhead**: tách pool thread/connection theo phụ thuộc, để một phụ thuộc chậm không ăn hết pool chung.
  6. **Load shedding và backpressure**:
     - Từ chối request khi hàng đợi vượt ngưỡng.
     - Ưu tiên request quan trọng.
     - Queue có giới hạn.
  7. **Fallback và degrade**: trả cache cũ, ẩn tính năng phụ.
  8. **Liên hệ**: rate limiter bảo vệ hệ thống khỏi client; resilience bảo vệ hệ thống khỏi chính phụ thuộc của nó.
- **Câu hỏi tự kiểm tra**
  - Vì sao retry không có jitter làm sự cố kéo dài?
  - Circuit breaker half-open để làm gì?
  - Retry ở cả client, gateway và service thì chuyện gì xảy ra?
- **Sơ đồ / mô phỏng**: sim ba tầng retry nhân tải (đếm request tới DB), và sim circuit breaker chuyển trạng thái.
- **Nguồn**
  - https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter (Amazon Builders' Library)
  - Load shedding (Builders' Library): https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/ (chưa mở trong phiên này; URL cũ có thể redirect như bài trên)

### 6. `observability` · Observability: logs, metrics, traces, SLO · **P0**

- **Vì sao cần**
  - NFR nào cũng có "99.9% availability, p99 < 200ms", nhưng site chưa giải thích đo những con số đó bằng gì, và SLO dẫn tới quyết định gì.
  - Microservices không có trace thì không biết request chậm ở đâu.
  - Hiện chỉ có một dòng "cần observability" trong `system-architecture`.
- **Tiên quyết**: `numbers`, `system-architecture`.
- **Liên quan**:
  - Topic: `system-architecture`, `ecs`, `eks`
  - Problem: `ad-click`, `top-k` (gần với Metrics Monitoring trong `HI_GAPS`), `rate-limiter`
- **tldr**:
  - Metrics trả lời "có vấn đề không".
  - Trace trả lời "chậm ở đâu".
  - Log trả lời "chuyện gì đã xảy ra".
  - SLI là con số đo được; SLO là mục tiêu cho SLI; SLA là cam kết có hậu quả. Error budget (1 − SLO) quyết định khi nào được phép ra tính năng, khi nào phải dừng lại sửa độ ổn định.
- **Ý chính**
  1. **Ba tín hiệu** (theo OpenTelemetry: traces, metrics, logs, cùng baggage) và chi phí của từng loại.
  2. **Percentile**:
     - Trung bình che mất đuôi chậm.
     - Không cộng hay lấy trung bình percentile của nhiều máy được; phải dùng histogram.
  3. **SLI, SLO, SLA, error budget**. Ví dụ 99.9% ≈ 43 phút downtime mỗi tháng.
  4. **RED** (Rate, Errors, Duration) cho service; **USE** (Utilization, Saturation, Errors) cho tài nguyên.
  5. **Distributed tracing**: trace id truyền qua header (W3C Trace Context), span, sampling (head-based và tail-based).
  6. **Cardinality**: label `user_id` làm nổ chuỗi time series.
  7. **Structured log + correlation id**; log không phải là metric.
  8. **Alert theo triệu chứng** (SLO burn rate), không theo nguyên nhân (CPU 80%).
- **Câu hỏi tự kiểm tra**
  - Vì sao không lấy trung bình p99 của 10 server?
  - Error budget hết thì team làm gì?
  - Vì sao không gắn `user_id` làm label của metric?
- **Sơ đồ / mô phỏng**: SVG một trace qua 4 service (waterfall span); bảng tính downtime theo số 9.
- **Nguồn**
  - https://sre.google/sre-book/service-level-objectives/
  - https://opentelemetry.io/docs/concepts/signals/
  - W3C Trace Context: https://www.w3.org/TR/trace-context/ (chưa mở trong phiên này)

### 7. `consensus` · Consensus & leader election (Raft, lease, fencing) · **P1**

- **Vì sao cần**
  - Leader election, lock "đúng tuyệt đối", config dùng chung: tất cả cần consensus.
  - Site đã dùng etcd (EKS), KRaft (Kafka), Redlock, nhưng chưa giải thích vì sao cần đa số, và vì sao lock có TTL vẫn hỏng khi process bị pause.
- **Tiên quyết**: `replication`, `dist-lock`.
- **Liên quan**:
  - Topic: `dist-lock`, `kafka` (KRaft), `eks` (etcd), `cap`
  - Sim: `redlock`
- **tldr**:
  - Raft cho một nhóm máy thống nhất một log có thứ tự, miễn là còn đa số sống: 5 máy chịu được 2 máy chết.
  - Leader election và lock đúng đắn dựng trên đó.
  - Lock chỉ an toàn khi đi kèm **fencing token** tăng dần mà nơi lưu trữ kiểm tra được.
- **Ý chính**
  1. **Vì sao cần đa số**: hai nhóm thiểu số không thể cùng ra quyết định, nên không có split brain.
  2. **Raft**:
     - term
     - bầu leader bằng timeout ngẫu nhiên
     - replicate log
     - commit khi đa số đã ghi
  3. **Lease và vì sao đồng hồ hay GC pause làm lease sai**.
  4. **Fencing token**: storage từ chối ghi mang token cũ. Redlock không sinh được fencing token; etcd revision và ZooKeeper zxid thì có.
  5. **Dùng gì**: etcd, ZooKeeper, hoặc DB với sequence/conditional write. Không tự viết consensus.
  6. **Chi phí**: mỗi lần ghi cần một round-trip tới đa số; cụm nên có số máy lẻ và nhỏ (3 hoặc 5).
- **Câu hỏi tự kiểm tra**
  - Vì sao cụm 4 máy không chịu lỗi tốt hơn cụm 3 máy?
  - Client giữ lock bị GC pause 30 giây. Fencing token cứu như thế nào?
- **Sơ đồ / mô phỏng**: sim bầu leader Raft khi leader chết; sim GC pause, hai variant: có fencing và không fencing.
- **Nguồn**
  - https://raft.github.io/ (kèm paper Ongaro & Ousterhout)
  - https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html

### 8. `auth` · Xác thực & phân quyền: session, JWT, OAuth 2.0/OIDC · **P1**

- **Vì sao cần**
  - API design nào cũng có "user đăng nhập thế nào" và "service gọi service xác thực ra sao".
  - Site có `JWT` và `OIDC` trong glossary, `MIRO_GAPS` ghi "Security trống", nhưng không có topic nào.
  - Lỗi hay gặp: dùng JWT rồi không thu hồi được token; nhầm OAuth (uỷ quyền) với đăng nhập (OIDC).
- **Tiên quyết**: `api-design`, `networking`.
- **Liên quan**: `api-design`, `lb-gateway-cdn` (xác thực ở gateway), `redis` (session store), `eks` (IRSA dùng OIDC).
- **tldr**:
  - Session: server giữ trạng thái, thu hồi tức thì.
  - JWT: tự chứa, kiểm tra không cần tra DB, nhưng khó thu hồi trước hạn. Vì vậy access token ngắn hạn + refresh token.
  - OAuth 2.0 là uỷ quyền; OIDC thêm lớp danh tính (ID Token).
- **Ý chính**
  1. **Authentication khác authorization**.
  2. **Session cookie và JWT**: nơi lưu trạng thái, thu hồi, kích thước, XSS/CSRF.
  3. **Cấu trúc JWT**: header.payload.signature; ký khác mã hoá; HS256 khác RS256 (khoá dùng chung và khoá công khai).
  4. **OAuth 2.0 Authorization Code + PKCE**:
     - Theo RFC 9700: không dùng implicit, không dùng password grant, PKCE bắt buộc với public client.
     - Refresh token xoay vòng hoặc ràng buộc với người gửi.
  5. **OIDC**: ID Token là JWT chứa claim xác thực; dùng cho SSO.
  6. **Service-to-service**: client credentials, mTLS, workload identity (IRSA, Pod Identity).
  7. **Phân quyền**: RBAC, ABAC, kiểm theo resource (IDOR).
  8. **Gateway xác thực, service vẫn phân quyền**.
- **Câu hỏi tự kiểm tra**
  - Làm sao đăng xuất ngay một user đang dùng JWT 1 giờ?
  - PKCE chống tấn công gì?
  - Vì sao OAuth một mình không phải là giao thức đăng nhập?
- **Sơ đồ / mô phỏng**: sim luồng Authorization Code + PKCE (browser, app, auth server, API).
- **Nguồn**
  - https://www.rfc-editor.org/rfc/rfc9700 (OAuth 2.0 Security BCP, 01/2025)
  - https://openid.net/specs/openid-connect-core-1_0.html
  - RFC 6749, 7519, 7636 (chưa mở trong phiên này)

### 9. `multi-region` · Multi-region & Disaster Recovery · **P1**

- **Vì sao cần**
  - Câu hỏi "region chết thì sao?" và "user toàn cầu thì sao?" xuất hiện ở các bài cấp senior.
  - Hiện site không có gì về RPO/RTO, active-active, hay xung đột ghi giữa các region.
- **Tiên quyết**: `replication`, `cap`, `lb-gateway-cdn`.
- **Liên quan**:
  - Topic: `cap`, `consistent-hashing`, `lb-gateway-cdn`
  - Problem: `payment`, `whatsapp`, `ticketmaster`
- **tldr**: Chọn chiến lược theo RPO (mất tối đa bao nhiêu dữ liệu) và RTO (mất tối đa bao lâu):
  - backup & restore
  - pilot light
  - warm standby
  - active/active
  Active/active phải chọn cách ghi: ghi về một region, ghi tại chỗ (có xung đột, thường last-writer-wins), hoặc chia region theo key.
- **Ý chính**
  1. **RPO và RTO**; bốn chiến lược DR và cái giá vận hành của từng cái.
  2. **Failover dùng thao tác data plane**, không dựa vào control plane.
  3. **Ba cách ghi**: write global, write local, write partitioned.
  4. **Xung đột**:
     - Last-writer-wins làm mất ghi.
     - DynamoDB global tables có hai chế độ: eventual (MREC, mặc định, last-writer-wins) và strong (MRSC).
  5. **Định tuyến**: DNS (Route 53 health check), anycast; vấn đề cache DNS.
  6. **Dữ liệu cần mạnh** (tiền, tồn kho) thường dùng write global hoặc partition theo region của user.
  7. **Replication không thay backup**: dữ liệu hỏng vẫn được replicate.
- **Câu hỏi tự kiểm tra**
  - Pilot light khác warm standby ở đâu?
  - Hai region cùng ghi số dư một tài khoản thì chuyện gì xảy ra với last-writer-wins?
- **Sơ đồ / mô phỏng**: SVG bốn chiến lược DR trên trục RPO/RTO; sim region A chết → failover.
- **Nguồn**
  - https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html
  - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html

### 10. `id-generation` · Sinh ID duy nhất trong hệ phân tán · **P1**

- **Vì sao cần**
  - Auto-increment không dùng được khi đã shard.
  - UUIDv4 ngẫu nhiên làm B-Tree index bị chèn rải rác.
  - `bitly`, `whatsapp`, `news-feed` đều cần ID có thứ tự; hiện mỗi bài tự lo theo cách riêng.
- **Tiên quyết**: `sharding`, `indexing`.
- **Liên quan**:
  - Problem: `bitly`, `whatsapp`, `news-feed`
  - Topic: `sharding`, `indexing`
- **tldr**: Cần ID duy nhất, sinh không phải phối hợp, và thường cần sắp được theo thời gian. Các lựa chọn:
  - UUIDv7 (48 bit timestamp mili giây + bit ngẫu nhiên, RFC 9562)
  - Snowflake (timestamp + machine id + sequence)
  - Cấp phát dải số từ một bộ đếm trung tâm
- **Ý chính**
  1. **Auto-increment**: đơn giản, nhưng thành điểm nghẽn và lộ số lượng.
  2. **UUIDv4**: không cần phối hợp, nhưng 128 bit ngẫu nhiên làm index phân mảnh.
  3. **UUIDv7**: có thứ tự theo thời gian, chèn vào cuối index.
  4. **Snowflake-style 64 bit**: cấp machine id cho từng máy; đồng hồ chạy lùi thì phải xử lý.
  5. **Cấp dải số** (counter cấp mỗi máy một khoảng): link `bitly`.
  6. **ID lộ thông tin** (số lượng, thời điểm); ID ngắn cho URL.
- **Câu hỏi tự kiểm tra**
  - Vì sao UUIDv4 làm chậm insert trên B-Tree?
  - Đồng hồ máy chạy lùi thì Snowflake gặp chuyện gì?
- **Sơ đồ / mô phỏng**: SVG bố cục bit của UUIDv7 và Snowflake.
- **Nguồn**
  - https://www.rfc-editor.org/rfc/rfc9562 (UUIDv7, §5.7)

### 11. `deployment-safety` · Triển khai an toàn & tương thích ngược · **P1**

- **Vì sao cần**
  - "Deploy không downtime", "đổi schema khi đang chạy", "rollback thế nào" là câu hỏi hay gặp với senior backend.
  - Hiện chỉ có rolling update trong sim `ecs-flow` và một dòng feature flag trong `dev-methods`.
- **Tiên quyết**: `system-architecture`, `ecs`.
- **Liên quan**:
  - Topic: `ecs`, `eks`, `dev-methods`, `data-modeling`, `api-design` (versioning)
  - Sim: `ecs-flow`, `eks-flow`
- **tldr**:
  - Thả thay đổi từng phần (rolling, blue/green, canary) để giới hạn ảnh hưởng.
  - Tách deploy khỏi release bằng feature flag.
  - Đổi schema theo expand → migrate → contract, để bản cũ và bản mới chạy song song được.
- **Ý chính**
  1. **Rolling, blue/green, canary**: thời gian rollback và tài nguyên cần thêm của từng cách.
  2. **Feature flag**: deploy khác release; nợ flag phải dọn.
  3. **Expand/contract** cho DB:
     - thêm cột
     - ghi cả hai
     - backfill
     - đọc cột mới
     - xoá cột cũ
  4. **Tương thích ngược của API và event**:
     - Thêm field thì được, đổi nghĩa hay xoá thì không.
     - Schema registry và các chế độ compatibility.
  5. **Health check và readiness gate**; tự động rollback theo SLO (link mục 6).
  6. **Migration chạy lâu**: khoá bảng, chia batch.
- **Câu hỏi tự kiểm tra**
  - Đổi tên một cột đang dùng mà không downtime thì làm thế nào?
  - Canary khác blue/green ở rủi ro nào?
- **Sơ đồ / mô phỏng**: sim expand/contract qua 5 bước với hai phiên bản app chạy song song.
- **Nguồn**
  - https://martinfowler.com/bliki/ParallelChange.html
  - OpenFeature spec: https://openfeature.dev/specification/ (chưa mở trong phiên này)

### 12. `vector-search` · Vector search & ANN · **P1**

- **Vì sao cần**
  - Bài về semantic search, gợi ý, RAG ngày càng xuất hiện trong phỏng vấn.
  - `HI_GAPS` liệt kê "Vector DB"; `tech-cheatsheet` có một dòng; glossary đã có ANN, HNSW, IVF, RAG nhưng chưa topic nào dùng đến.
- **Tiên quyết**: `search`, `indexing`.
- **Liên quan**:
  - Topic: `search`, `tech-cheatsheet`
  - Sim: `inverted-index`
- **tldr**:
  - Biến dữ liệu thành vector embedding, rồi tìm k láng giềng gần nhất.
  - Tìm chính xác phải quét hết, nên thực tế dùng ANN (HNSW, IVF), đổi một phần recall lấy tốc độ.
  - Thường kết hợp với lọc metadata và full-text (hybrid search).
- **Ý chính**
  1. **Embedding và độ đo khoảng cách** (cosine, L2, inner product).
  2. **Tìm chính xác và tìm xấp xỉ**; recall là gì.
  3. **HNSW**: đồ thị nhiều tầng; tốn RAM, build chậm, query nhanh.
  4. **IVF**: chia cụm, chỉ tìm trong vài cụm.
  5. **Lọc metadata trước hay sau ANN**.
  6. **Hybrid search**: BM25 + vector, gộp kết quả.
  7. **pgvector hay hệ chuyên dụng**: lúc nào đủ dùng.
  8. **Luồng RAG** ở mức hệ thống.
- **Câu hỏi tự kiểm tra**
  - Vì sao thêm ANN index thì kết quả query thay đổi?
  - Lọc theo `tenant_id` sau khi lấy top-k gây vấn đề gì?
- **Sơ đồ / mô phỏng**: SVG các tầng HNSW và đường tìm kiếm.
- **Nguồn**
  - https://arxiv.org/abs/1603.09320 (HNSW, Malkov & Yashunin)
  - https://github.com/pgvector/pgvector

### 13. `storage-engines` · Storage engine: B-Tree, LSM, WAL · **P2**

- **Vì sao cần**: Biết vì sao Cassandra ghi nhanh, đọc chậm hơn và cần compaction thì chọn DB có lý do thay vì chọn theo tên. Hiện LSM chỉ được nhắc trong `core-db` và `whatsapp`. `HI_GAPS` liệt kê deep dive Cassandra/DynamoDB.
- **Tiên quyết**: `indexing`, `core-db`.
- **Liên quan**:
  - Topic: `core-db`, `tech-cheatsheet`, `bigdata-ds` (Bloom filter trong SSTable)
  - Problem: `whatsapp`
- **tldr**: B-Tree sửa tại chỗ, đọc ổn định. LSM ghi tuần tự (memtable → SSTable), ghi nhanh, nhưng đọc phải gộp nhiều file và cần compaction. WAL làm cả hai bền khi crash.
- **Ý chính**
  1. WAL và crash recovery.
  2. B-Tree: page, split.
  3. LSM: memtable, SSTable, Bloom filter, compaction (size-tiered và leveled).
  4. Write amplification, read amplification, space amplification.
  5. Tombstone khi xoá.
  6. Chọn engine theo tỷ lệ đọc/ghi.
- **Câu hỏi tự kiểm tra**
  - Vì sao xoá nhiều trong Cassandra làm đọc chậm?
  - Bloom filter giúp đọc LSM như thế nào?
- **Sơ đồ / mô phỏng**: sim ghi vào LSM → flush → compaction.
- **Nguồn**: tài liệu WAL của PostgreSQL (https://www.postgresql.org/docs/current/wal-intro.html) và RocksDB wiki (https://github.com/facebook/rocksdb/wiki), cả hai chưa mở trong phiên này.

### 14. `stream-processing` · Stream processing: window, watermark, state · **P2**

- **Vì sao cần**: `ad-click` và `top-k` dựa vào Flink, nhưng `streams` chỉ có khoảng 4 KB. Window, watermark, state và checkpoint đang được giải thích rải trong sim của problem. `HI_GAPS` liệt kê Flink.
- **Tiên quyết**: `streams`, `kafka`.
- **Liên quan**: problem `ad-click`, `top-k`; topic `streams`, `bigdata-ds`.
- **tldr**: Stream processor tính liên tục trên luồng sự kiện:
  - Window chia thời gian.
  - Watermark quyết định khi nào đóng window theo event time.
  - State được checkpoint để khôi phục.
  - Exactly-once tới đầu ra cần sink idempotent hoặc ghi theo transaction.
- **Ý chính**
  1. Event time và processing time.
  2. Window tumbling, sliding, session.
  3. Watermark và dữ liệu đến muộn (allowed lateness, side output).
  4. Keyed state và checkpoint.
  5. Exactly-once trong pipeline và exactly-once tới sink.
  6. Backpressure.
  7. Lambda và Kappa architecture.
- **Câu hỏi tự kiểm tra**
  - Watermark đặt quá sát thì mất gì? Quá xa thì mất gì?
  - Vì sao checkpoint không đủ để ClickHouse không bị đếm trùng?
- **Sơ đồ / mô phỏng**: sim window + watermark với một event đến muộn.
- **Nguồn**
  - https://nightlies.apache.org/flink/flink-docs-stable/docs/connectors/datastream/overview/ (fault tolerance guarantees)
  - Khi viết nên mở thêm trang concepts/time của Flink.

### 15. `time-ordering` · Đồng hồ & thứ tự sự kiện · **P2**

- **Vì sao cần**: Last-writer-wins, sắp xếp tin nhắn, TTL của lock đều ngầm tin vào đồng hồ. Đồng hồ các máy lệch nhau và có thể nhảy lùi. `whatsapp` và `google-docs` cần thứ tự mà không dựa vào giờ máy.
- **Tiên quyết**: `replication`.
- **Liên quan**: problem `whatsapp`, `google-docs`; topic `dist-lock`, `multi-region`.
- **tldr**: Không dùng giờ máy để quyết thứ tự giữa nhiều máy.
  - Lamport clock cho thứ tự nhân quả.
  - Vector clock phát hiện ghi đồng thời.
  - HLC kết hợp giờ thật với bộ đếm.
  - Sequence do server cấp là cách đơn giản nhất khi có một nơi điều phối.
- **Ý chính**
  1. Clock skew và NTP; đồng hồ monotonic khác đồng hồ wall-clock.
  2. Happened-before.
  3. Lamport clock.
  4. Vector clock và phát hiện xung đột.
  5. HLC.
  6. TrueTime (khoảng bất định).
  7. Hậu quả của last-writer-wins.
- **Câu hỏi tự kiểm tra**
  - Vì sao hai tin nhắn trong group chat không nên sắp theo timestamp của client?
- **Sơ đồ / mô phỏng**: SVG ba process trao đổi message, có Lamport timestamp.
- **Nguồn**: Lamport 1978, "Time, Clocks, and the Ordering of Events" (https://lamport.azurewebsites.net/pubs/time-clocks.pdf, chưa mở trong phiên này).

---

## Viết tắt mới cần thêm vào `glossary.js`

Các viết tắt dưới đây đã được đối chiếu với `glossary.js` hiện tại và chưa có trong đó:

| Viết tắt | Nghĩa |
|---|---|
| SLI | Service Level Indicator |
| SLO | Service Level Objective |
| SLA | Service Level Agreement |
| RPO | Recovery Point Objective |
| RTO | Recovery Time Objective |
| PKCE | Proof Key for Code Exchange |
| SSO | Single Sign-On |
| IdP | Identity Provider |
| mTLS | mutual TLS |
| UUID | Universally Unique Identifier |
| LWW | Last-Writer-Wins |
| HLC | Hybrid Logical Clock |
| ABAC | Attribute-Based Access Control |
| OTel | OpenTelemetry |
| RED | Rate, Errors, Duration |
| USE | Utilization, Saturation, Errors |
| EOS | Exactly-Once Semantics (Kafka) |
| MREC / MRSC | Multi-Region Eventual / Strong Consistency (DynamoDB). Chỉ thêm nếu mục 9 dùng. |

## Còn chưa chắc

- Thông tin trong bảng "chưa kiểm chứng" ở A2: Kafka share groups 4.2, ECS Managed Instances, skip scan, `num_tokens` của Cassandra, giới hạn của EKS Fargate.
- Một số nguồn trong Phần B ghi "chưa mở trong phiên này". Phải mở và đối chiếu trước khi viết topic ở giai đoạn 2.
- Trang Kafka delivery semantics trả về redirect; chưa đọc được nội dung để trích.
- Cách ghi nguồn: hiện là URL trong câu; quy định §6 nói trường `src`, nhưng app chưa render trường đó (xem cuối A1).
