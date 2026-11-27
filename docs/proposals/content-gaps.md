# Đề xuất: review nội dung và khoảng trống chủ đề

Người viết: Solution Architect · Nhánh `sa/content-gaps` (từ `8eee891`) · Ngày 2026-11-27

Phần A là kết quả review 39 topic và 13 problem: những gì đã sửa và những gì cần người quyết. Phần B đề xuất chủ đề mới. Phần B không chọn track hay giai đoạn; Product Design sẽ phân loại.

---

## Phần A · Kết quả review

### A0. Bảng quyết định gộp (để hỏi người dùng một lần)

Mỗi dòng gồm vấn đề và **đề xuất mặc định**: nếu người dùng không phản đối thì làm theo đề xuất. Chi tiết và nguồn nằm ở A1, A2, A4 và mục sim ở A3.

| # | Chỗ | Vấn đề | Đề xuất mặc định |
|---|---|---|---|
| Q1 | `content-system.md` §6 | Quy định nói URL nguồn nằm trong trường `src`, nhưng app không render trường đó; hiện URL viết ngay trong câu. | Giữ URL trong câu, sửa §6 theo thực tế. |
| Q2 | Luật giá | "Rẻ hơn tới 70%" (Fargate Spot) và "70–90%" (Spot) có tính là giá không? | Không tính là giá. Giữ "tới 90%" kèm link, bỏ cận 70 vì không có nguồn. |
| Q3 | `core-db` | Câu "NoSQL không có transaction" đã lỗi thời. | Viết: có transaction, nhưng giới hạn phạm vi, số item và độ trễ. |
| Q4 | `core-db` | Bảng isolation chỉ mô tả theo chuẩn SQL/InnoDB. | Thêm một dòng: Repeatable Read của PostgreSQL là snapshot, không có phantom nhưng có write skew. |
| Q5 | `caching` / `dist-cache` | Write-through được định nghĩa hai kiểu. | Dùng "ghi DB thành công rồi cập nhật cache, sau đó mới trả lời"; `dist-cache` link sang `caching`. |
| Q6 | Nhiều file | Hot key có bốn tên gọi. | Thống nhất "key salting", ví dụ `key#0..N`. |
| Q7 | `networking` / `lb-gateway-cdn` | Throughput L4 nêu bằng ba đơn vị khác nhau. | Dùng "hàng triệu request/giây". |
| Q8 | `consistent-hashing` | Ghi "DynamoDB" (ring đến từ paper Dynamo); công thức K/N. | Đổi thành "Dynamo/Cassandra"; thêm một server thì khoảng K/(N+1) key đổi chỗ. |
| Q9 | `lb-gateway-cdn`, sim `lb` | "L4 không giải mã TLS"; liệt kê gRPC là việc hợp với L4. | "Kết thúc TLS ở L4 là tuỳ chọn"; bỏ gRPC (kết nối HTTP/2 sống lâu, L4 chỉ chia tải theo kết nối nên lệch). |
| Q10 | `streams`, `api-design`, `redis`, `eks` | Tên cũ: Spark Streaming, `Accept-Version`, `ZREVRANGE`; công thức HPA thiếu `ceil`. | Sửa theo tên hiện hành; thêm `ceil`. |
| Q11 | `ecs` / sim `ecs-flow` | Task thiếu chỗ gọi là `PROVISIONING` ở chỗ này, `PENDING` ở chỗ kia. | Thống nhất `PROVISIONING` (khi có capacity provider). |
| Q12 | `payment` | Node "Card Network" nhận idempotency key; "PCI DSS buộc tokenize"; đánh dấu FAILED ngay khi nhận "không tìm thấy". | Đổi nhãn thành "PSP / Acquirer"; viết "tokenize để thu hẹp phạm vi PCI"; chỉ đánh dấu FAILED sau cửa sổ idempotency hoặc sau khi void. |
| Q13 | `whatsapp` | Dựa vào `PUBLISH` trả 0 để quyết định gửi push; partition theo `chatId` không giới hạn. | Quyết push theo presence hoặc ack timeout; partition theo `(chatId, tháng)`. |
| Q14 | `news-feed` | Cursor theo id/timestamp trên Redis LIST. | Dùng ZSET với score = timestamp. |
| Q15 | `google-docs` | Snapshot nói giữ ops log, compaction lại nói xoá op. | Giữ op N ngày cộng snapshot theo version. |
| Q16 | `ad-click` | Dedupe ở hai nơi (Click Processor và Flink). | Dedupe ở Click Processor; Flink chỉ đếm. |
| Q17 | `patterns-gof` | `VehicleFactory.create(type)` là Simple Factory; Builder là biến thể Bloch; thiếu Adapter, Composite, Chain of Responsibility. | Đổi nhãn thành "Simple Factory"; ghi rõ "Builder (biến thể Bloch)"; thêm ba pattern còn thiếu. |
| Q18 | `solid`, glossary | Câu ISP thiếu góc nhìn client; "gRPC = Google RPC"; định nghĩa vCPU. | Sửa theo định nghĩa gốc ở A2. |
| Q19 | Sim `container-decide`, `container-stack` | GPU được cộng điểm cho EKS (mâu thuẫn với tip); chưa có ECS Managed Instances. | Tách câu hỏi GPU khỏi DaemonSet, GPU chỉ bật EC2; thêm Managed Instances vào sim. |
| Q20 | Sim `queue` | Hàng đợi tự giao lại theo exponential backoff (SQS không làm vậy); nhãn `maxReceiveCount=3` nhưng vẽ 4 lần nhận; mũi tên 429 vẽ từ queue. | Consumer tự kéo dài visibility timeout theo backoff; đổi thành `maxReceiveCount=4`; nhãn "429 (gateway)". |
| Q21 | Sim `stampede` | "Chỉ 1 query" trong khi single flight chạy theo từng process. | Viết "1 query mỗi app server (hoặc đúng 1 nếu dùng lock phân tán)". |
| Q22 | Sim `sys-arch-impact` | Scale checkout mà không scale Inventory, dù đặt hàng phải trừ kho. | Thêm Inventory và DB của nó vào phạm vi scale. |
| Q23 | Sim `realtime` | WebSocket "cần sticky"; nhãn SSE ghi `event:`; "HTTP/2 hết giới hạn kết nối". | Bỏ "sticky" (chỉ cần LB hỗ trợ Upgrade + pub/sub); nhãn `data:`; viết "nới rộng nhiều (số stream đồng thời do hai bên thoả thuận)". |
| Q24 | Sim `tdd-codewalk` | Giải thích Hypothesis tìm ra 500000 bằng "shrink". Với bug này 500000 là input hỏng duy nhất; reviewer cho rằng Hypothesis tìm ra nhờ thu hằng số từ source (từ bản 6.131), **chưa kiểm chứng**. | Viết trung tính: "Hypothesis thử cả giá trị biên và hằng số trong code, nên trúng 500000"; kiểm changelog trước khi ghi số phiên bản. |
| Q25 | Engine (`kgroup`, `rplay`, `binary`, `ring`) | Bốn chỗ: crash chưa nhắc `session.timeout.ms` và xử lý lại phần chưa commit; `EVAL` thiếu `numkeys`; điểm bằng nhau xếp khác Redis; cận `⌈log₂n⌉+1`; ring nói key chuyển sang một server dù đang bật vnode. | Sửa chữ trong engine trong một commit riêng (đây là sửa engine, không phải nội dung). |
| Q26 | Sim nit: `cache-write`, `isolation`, `inverted-index`, `seat` | Write-around thiếu mũi tên `200`; DAX ghi DB trước rồi mới cập nhật cache; undo log chỉ có ở InnoDB; "hash map" nên là "term dictionary"; ghi rõ mức isolation khi Bob nhận "0 row". | Sửa gộp trong một commit. |
| Q27 | A4 (nit LLD/DSA) | Tám nit nhỏ: O(1) trung bình, Powersort, cycle trong đồ thị vô hướng, `put/get`, Aggregate, YAGNI, nhiều index, Singleton/DI. | Sửa gộp trong một commit. |
| Q28 | `eks` và chủ đề mới `k8s-core` | Bảng "Object Kubernetes hay dùng" trong `eks` sẽ trùng với `k8s-core` (Phần B, mục 16–20). | Khi có `k8s-core`, `eks` chỉ giữ phần riêng của AWS và link sang `k8s-core`. |

### A1. Đã sửa (mỗi loại một commit)

| Commit | Thay đổi | Nguồn |
|---|---|---|
| `96934ee` | Bỏ giá tiền: `~$0.10/giờ/cluster`, `~$73/tháng`, `~$0.60/giờ` (sim `container-stack`, `ecs-vs-eks`, `eks`), `$0.023/GB-tháng` (`blob`). Thay bằng cơ chế tính phí, kèm link tới trang giá. | https://aws.amazon.com/eks/pricing/ · https://aws.amazon.com/ecs/pricing/ · https://aws.amazon.com/s3/pricing/ |
| `a2fe1b9` | `scripts/check.mjs` có thêm luật `PRICE`. Luật báo lỗi khi có giá theo đơn vị (`$x/…`, `$x mỗi …`, `$x per`, `≈ $x`). Số tiền trong kịch bản như `charge $50` vẫn hợp lệ. Đã thử: chạy trên bản `eks.js` cũ thì báo đúng 3 lỗi. | Luật "không ghi giá" trong `CLAUDE.md` |
| `326571b` | Đính chính các thông tin đã lỗi thời, xem 6 mục bên dưới. | |
| `c6140d1` | Sửa lỗi lập luận, xem 5 mục bên dưới. | |
| `76fa535` | Đổi tên dòng "State Machine" trong `patterns-gof` thành "State (state machine)" để cùng thuật ngữ với `lld-delivery` và `lld-problems-list`. | Tên pattern theo GoF |
| `45719f5` | Sửa câu cùng loại với `search` trong `yelp`. Câu cũ "không index nào dùng được" cho `LIKE '%phở%'` mâu thuẫn với đính chính `pg_trgm`. Cùng commit: HTTP/3 "thường dùng UDP 443", vì RFC cho phép chạy trên bất kỳ cổng UDP nào. | https://www.postgresql.org/docs/current/pgtrgm.html · RFC 9114 |
| (commit sau proposal) | `api-design`: `Retry-After` đi kèm 429 và 503, không đi kèm 408. Câu trước đó gán nó cho cả 408. | RFC 9110 §15.5.9, §15.6.4 · RFC 6585 §4 |
| `docs/decisions.md` | Ghi D30: luật `PRICE` trong `check.mjs`. `check.mjs` là file dùng chung, nên các nhánh khác sẽ merge với luật này. | |

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
| `caching` và `dist-cache` | Write-through được định nghĩa hai kiểu: "cache ghi DB rồi trả lời" và "ghi cache và DB cùng lúc". | Chọn một định nghĩa, file còn lại link sang. |
| Hot key | Có bốn cách gọi: `key#1..#k`, key salting, compound shard key, `hotkey_1`. | Dùng một thuật ngữ "key salting" và một ví dụ. |
| L4 throughput | Ba cách nói: "triệu kết nối", "triệu kết nối/giây", "triệu request/giây". | Chọn một đơn vị. |
| `consistent-hashing` | (`num_tokens` đã sửa ở `9774513`.) Ghi "DynamoDB", trong khi ring đến từ paper Dynamo, không phải dịch vụ DynamoDB. Thêm một server vào N server thì khoảng K/(N+1) key đổi chỗ, không phải K/N. | Sửa tên và công thức. |
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

**Thông tin mới do reviewer đưa ra, đã xác minh ở giai đoạn 1.5 (commit `9774513`)**

Cả sáu khẳng định đều đúng; không cái nào bị bác bỏ. Hai cái chỉ đúng một phần nên câu sửa được điều chỉnh theo trang gốc.

| Khẳng định | Kết quả | Đã sửa | Nguồn đã mở |
|---|---|---|---|
| Kafka share groups (KIP-932) | **Đúng.** Trang phát hành 4.2.0 ghi "Kafka Queues (Share Groups) is now production-ready". | `kafka`: giới hạn các câu "số partition = số consumer tối đa" và "không có ack từng message" về consumer group cổ điển; nêu share group và cái giá là mất thứ tự trong partition. | https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/ |
| ECS Managed Instances | **Đúng.** AWS lo cấp máy, vá OS và scale; dùng được mọi loại EC2 (GPU, Arm); mỗi instance sống tối đa 14 ngày. | `ecs` (tldr), `ecs-vs-eks` (dòng Compute). Sim `container-stack` chưa thêm lựa chọn thứ sáu: muốn thêm phải sửa dữ liệu sim, **cần quyết**. | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ManagedInstances.html |
| Skip scan | **Đúng.** MySQL có từ 8.0.13; PostgreSQL có từ 18. | `indexing`: card có cùng ngoại lệ với point. | https://dev.mysql.com/doc/refman/8.0/en/range-optimization.html · https://www.postgresql.org/docs/18/release-18.html |
| Cassandra `num_tokens` mặc định 16 | **Đúng một phần.** `cassandra.yaml` mặc định 16. Câu "4.0 hạ từ 256" chưa thấy trên trang nên không ghi. | `consistent-hashing`: bỏ "hàng trăm virtual node". | https://cassandra.apache.org/doc/latest/cassandra/managing/configuration/cass_yaml_file.html |
| Giới hạn EKS trên Fargate | **Đúng.** Không DaemonSet, GPU, privileged, EBS, Spot, Arm; không có IMDS, nên dùng IRSA. Trang Pod Identity ghi rõ không hỗ trợ pod trên Fargate. | `eks`: dòng Fargate, và why của Pod Identity. Sim `eks-flow` chạy trên node EC2 nên vẫn đúng. | https://docs.aws.amazon.com/eks/latest/userguide/fargate.html · https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html |
| License Redis / Valkey | **Đúng.** ≤ 7.2: BSD-3. 7.4–7.8: RSALv2/SSPLv1. ≥ 8.0: thêm AGPLv3. Valkey: BSD, Linux Foundation. Câu "ElastiCache dùng Valkey" chưa kiểm nên không ghi. | `redis`: thêm point "+ License & Valkey". | https://redis.io/legal/licenses/ · https://valkey.io/ |

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

- **Sim** (giai đoạn 1.5): 48 sim đã được review hết. 13 HLD sim nằm trong problem; 10 sim đọc ở giai đoạn 1; 25 file sim còn lại cùng phần chữ trong engine (`ring`, `kgroup`, `rplay`, `binary`, `bucket`, `vending`) được hai reviewer đọc ở giai đoạn 1.5.
  - Không có giá tiền.
  - Commit `fad486a` sửa các lỗi rõ ràng:
    - `seat`: timeout của row lock là `innodb_lock_wait_timeout`, mặc định 50s (đã mở manual MySQL). `lock_wait_timeout` là timeout của metadata lock. PostgreSQL mặc định `lock_timeout = 0`.
    - `seat`: lock của UPDATE giữ tới khi transaction kết thúc, không phải "trong chốc lát".
    - `tdd-codewalk`: import lỗi là collection error của pytest ("1 error"). Bước BDD phải ra `ModuleNotFoundError` vì `shop.py` chỉ có từ bước sau.
    - `arch-dependency`: phương án vertical slice đổi DB cũng chạm khối Shared, nơi giữ kết nối DB.
  - Các nhận xét còn lại về sim nằm trong bảng quyết định gộp (A0).
- Bốn reviewer phụ đọc toàn bộ topic và problem.
- **Mức kiểm chứng của A1.** Các sự thật sau đã được đối chiếu bằng trang tài liệu gốc mở trong phiên này:
  - heapq 3.14
  - Lambda execution environment
  - các lớp Glacier
  - `pg_trgm`
  - RFC 9114 (QUIC/UDP, HOL blocking)
  - RFC 9110 (408, 503) và RFC 6585 (429)
  - EKS envelope encryption
  - Flink sink guarantees
  - Các mục không tra nguồn:
    - Ba trang giá AWS chỉ được dùng làm link trỏ tới, không mở và không trích số.
    - Sửa `uber`, `ticketmaster`, `concurrency` và `patterns-gof` là sửa mâu thuẫn nội bộ hoặc định nghĩa, không cần tra nguồn.
- **Mức kiểm chứng của A2.** Phần lớn các dòng là nhận định của reviewer dựa trên hiểu biết sẵn có. Hai trong bốn reviewer cho biết không mở URL nào. Các dòng A2 coi như **chưa kiểm chứng**, trừ khi đã ghi nguồn đã mở.

### A4. Lỗi nhỏ chưa sửa (nit)

| Chỗ | Vấn đề |
|---|---|
| `bigo` và `ds` | `bigo` ghi hash map O(1), `ds` ghi "O(1) trung bình". Nên thêm "trung bình" vào `bigo`. |
| `bigo` | "Timsort": từ Python 3.11, CPython dùng merge policy Powersort, vẫn thuộc họ Timsort. |
| `algo` | Quy tắc "gặp lại đỉnh đang trên stack đệ quy là có cycle" chỉ đúng với đồ thị có hướng. Đồ thị vô hướng phải dùng "đã thăm và không phải cha". |
| `concurrency` | Cột Python ghi `put()`/`take()` theo tên Java. `queue.Queue` của Python dùng `put()`/`get()`. |
| `dev-methods` | Aggregate là cụm entity **và value object**. |
| `principles-other` | Câu "khoảng một nửa số đó không bao giờ được dùng" là số liệu không có nguồn. |
| `yelp` (deep dive) | "Planner chỉ dùng tốt được một index" sai: PostgreSQL gộp được nhiều index bằng BitmapAnd/Or. |
| `payment` | Đánh dấu FAILED ngay khi network trả "không tìm thấy". Request tới muộn vẫn có thể thành công, nên chỉ đánh dấu FAILED sau cửa sổ idempotency hoặc sau khi void. |
| `ticketmaster` | "Stripe retry tới khi nhận được": thực tế Stripe chỉ retry trong tối đa vài ngày (**chưa kiểm chứng**). |
| `lld-problems-list` | "Logger là Singleton" thiếu lưu ý: có thể inject một instance dùng chung qua DI. |

**Ý còn thiếu ở problem và LLD**, có thể đưa vào mục bổ sung ở A2:

| Chỗ | Ý còn thiếu |
|---|---|
| `whatsapp` | Inbox theo từng thiết bị, presence, mã hoá đầu cuối |
| `uber` | Shard theo ô H3/geohash, thành phố nóng |
| `news-feed` | Bỏ fan-out cho user không hoạt động; backfill feed khi follow mới |
| `google-docs` | Fencing token hoặc lease theo doc khi đổi chủ server; client gửi lại op chưa ack, dedupe theo `(clientId, seq)` |
| `ticketmaster` | Kiểm lock còn giữ trước khi tạo PaymentIntent |
| `solid` | SRP theo cách nói sau này của Martin: "một actor" |
| `patterns-gof` | Thiếu Adapter, Composite và Chain of Responsibility, dù `lld-problems-list` có dùng |

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
| 16 | `container-basics` | Container là gì: namespace, cgroup, image, so với VM | P0 | `networking` |
| 17 | `k8s-core` | Kubernetes cốt lõi: kiến trúc và các object | P0 | `container-basics`* |
| 18 | `dockerfile` | Viết Dockerfile chuẩn và build cache | P1 | `container-basics`* |
| 19 | `k8s-operations` | Chạy ổn định trên Kubernetes: probe, resource, rollout, stateful | P1 | `k8s-core`* |
| 20 | `image-delivery` | Build → tag → push → deploy: registry, digest, scan, SBOM | P1 | `dockerfile`*, `system-architecture` |

**Mảng container (mục 16–20) và các topic có sẵn.** `ecs`, `eks`, `ecs-vs-eks` đều mặc định người học đã biết container và Kubernetes. `eks` hiện có một bảng "Object Kubernetes hay dùng" (Pod, Deployment, Ingress, ConfigMap/Secret, HPA, Namespace/RBAC, DaemonSet, StatefulSet, Job), mỗi object một dòng.

Đề xuất chia vai như sau:

- `container-basics` và `k8s-core` là **nền tảng chung**.
- `k8s-operations` là nền tảng để vận hành.
- `ecs`, `eks` và `ecs-vs-eks` chỉ giữ phần riêng của AWS: Fargate, IAM/Pod Identity, VPC CNI, Karpenter, phí control plane. Bảng object trong `eks` rút lại thành link sang `k8s-core` (Q28).
- Thứ tự học gợi ý: `container-basics` → `dockerfile` → `k8s-core` → `k8s-operations` → `image-delivery` → `ecs` / `eks`.

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
  - Kafka delivery semantics (docs 4.4 hiện hành, đã mở): https://kafka.apache.org/44/design/design/#message-delivery-semantics. Trang này nói idempotent producer, transaction nhiều partition, và với hệ thống ngoài thì lưu offset cùng chỗ với output.

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
  - Dynamo paper, SOSP 2007, DOI https://dx.doi.org/10.1145/1294261.1294281. Bản PDF trên allthingsdistributed.com tải được nhưng không trích được chữ; bài giới thiệu chính thức: https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html. Khi viết cần đọc bản PDF bằng công cụ khác.

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
  - Load shedding (Builders' Library, đã mở): https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload. Ý chính: từ chối phần việc vượt sức sớm để các request đã nhận vẫn xong kịp trước khi client bỏ cuộc.

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
  - W3C Trace Context: https://www.w3.org/TR/trace-context/ trả 403 khi fetch tự động. Đã đối chiếu bản spec trên repo chính thức của W3C (header `traceparent`, `tracestate`): https://github.com/w3c/trace-context/blob/main/spec/20-http_request_header_format.md

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
  - Đã mở: RFC 6749 (OAuth 2.0, bốn loại grant) https://www.rfc-editor.org/rfc/rfc6749 · RFC 7519 (JWT) https://www.rfc-editor.org/rfc/rfc7519 · RFC 7636 (PKCE chống chặn authorization code) https://www.rfc-editor.org/rfc/rfc7636

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
  - OpenFeature spec (đã mở; dự án CNCF incubating): https://openfeature.dev/specification/

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
- **Nguồn**
  - https://www.postgresql.org/docs/current/wal-intro.html (đã mở)
  - RocksDB Overview (đã mở; memtable, SST, compaction leveled/universal, write/space amplification): https://github.com/facebook/rocksdb/wiki/RocksDB-Overview

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
  - Flink concepts/time (đã mở; event time, processing time, watermark): https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/

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
- **Nguồn**: Lamport 1978, "Time, Clocks, and the Ordering of Events" (https://lamport.azurewebsites.net/pubs/time-clocks.pdf). Bản PDF là scan, không trích được chữ. Đối chiếu bằng trang chính thức của Microsoft Research (tiêu đề, tác giả, CACM 21(7), 1978, tóm tắt): https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/

### 16. `container-basics` · Container là gì: namespace, cgroup, image, so với VM · **P0**

- **Vì sao cần**
  - Mọi câu trả lời về deploy (ECS, EKS, "đóng gói service") đều dựa trên container, nhưng site chưa giải thích container là gì.
  - Nếu không hiểu container chỉ là một process được cách ly, người học sẽ nhầm nó với VM. Từ đó dễ sai khi nói về bảo mật (dùng chung kernel), về giới hạn tài nguyên (OOM kill), và về chuyện "vì sao Fargate cho mỗi pod một VM".
- **Tiên quyết**: `networking`.
- **Liên quan**: `ecs`, `eks`, `ecs-vs-eks`, `system-architecture`; sim `container-stack`.
- **tldr**: Container là một process Linux bình thường, được đóng khung bằng hai cơ chế của kernel.
  - **Namespace** cho process thấy một thế giới riêng: PID, mạng, mount, hostname, user.
  - **Cgroup** giới hạn CPU, RAM, IO, số process mà nó được dùng.
  - Container khởi động trong khoảng một giây vì không phải boot hệ điều hành; đổi lại, mọi container trên một máy **dùng chung kernel**, nên cách ly yếu hơn VM.
- **Ý chính**
  1. **VM và container**: hypervisor giả lập cả máy, mỗi VM có kernel riêng; container chỉ là process trên kernel của host.
  2. **Namespace**: các loại pid, net, mnt, uts, ipc, user, cgroup, time. Mỗi loại cách ly một thứ gì, và vì sao `localhost` trong container không phải `localhost` của host.
  3. **Cgroup v2**: các controller cpu, memory, io, pids. Vượt giới hạn memory thì kernel OOM-kill process; vượt giới hạn CPU thì bị throttle, không bị kill.
  4. **Image**:
     - Gồm nhiều layer filesystem chồng lên nhau, cộng với config (lệnh chạy, env).
     - Mỗi phần được định danh bằng digest (hash nội dung), nên hai image dùng chung layer thì chỉ tải và lưu một lần.
  5. **Container layer ghi được và tạm thời**: dữ liệu ghi vào container mất khi container bị xoá. Dữ liệu cần giữ phải đặt ở volume hoặc dịch vụ ngoài. Đây là lý do service phải stateless.
  6. **Chuẩn OCI**: image spec, runtime spec, distribution spec. Docker, containerd, Podman và Kubernetes (qua CRI) cùng chạy được một image.
  7. **Docker gồm những gì**: CLI, daemon, containerd, runc; `docker run` thực chất làm gì.
  8. **Mạng và volume** ở mức cần cho SD: port mapping, bridge network, bind mount và volume.
  9. **Bảo mật**: chạy với root trong container vẫn nguy hiểm vì dùng chung kernel; dùng user namespace, capability, seccomp. Khi cần cách ly mạnh thì dùng micro-VM (Fargate, Firecracker).
- **Câu hỏi tự kiểm tra**
  - Vì sao container khởi động nhanh hơn VM?
  - Container vượt memory limit thì chuyện gì xảy ra? Vượt CPU limit thì sao?
  - Hai image cùng base thì registry và máy chạy lưu bao nhiêu bản của base?
  - Vì sao không nên lưu file upload trong filesystem của container?
- **Sơ đồ / mô phỏng**
  - SVG so sánh VM (hypervisor + nhiều kernel) và container (một kernel, nhiều namespace).
  - SVG các layer của image và layer ghi được của container.
- **Nguồn (đã mở)**
  - https://man7.org/linux/man-pages/man7/namespaces.7.html
  - https://docs.kernel.org/admin-guide/cgroup-v2.html
  - https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/
  - https://github.com/opencontainers/image-spec/blob/main/spec.md (trang chủ dự án: https://opencontainers.org/)

### 17. `k8s-core` · Kubernetes cốt lõi: kiến trúc và các object · **P0**

- **Vì sao cần**
  - Kubernetes là nền chung của EKS, GKE, AKS và các cluster tự dựng.
  - `eks` hiện vừa phải dạy Kubernetes vừa phải dạy phần AWS, nên mỗi object chỉ được một dòng.
  - Không nắm vòng reconcile (desired state → controller kéo actual state về) thì không giải thích được vì sao pod chết lại tự sống, vì sao phải dùng label/selector, hay vì sao Service tìm được pod.
- **Tiên quyết**: `container-basics`.
- **Liên quan**:
  - Topic: `eks`, `ecs-vs-eks`, `lb-gateway-cdn`, `cap` (etcd cần quorum)
  - Sim: `eks-flow`
- **tldr**:
  - Bạn khai báo **trạng thái mong muốn** (YAML) cho API server; etcd lưu nó.
  - Các controller liên tục so trạng thái thật với trạng thái mong muốn rồi sửa lệch; scheduler chọn node cho pod; kubelet trên mỗi node chạy container.
  - Mọi object nối với nhau bằng **label/selector**, không bằng tên cứng.
- **Ý chính**
  1. **Control plane** gồm kube-apiserver, etcd, kube-scheduler, kube-controller-manager, cloud-controller-manager. **Node** gồm kubelet, kube-proxy, container runtime (CRI).
  2. **Reconcile loop**: khai báo thay vì ra lệnh. Đây là lý do Kubernetes tự chữa lành.
  3. **Pod**: đơn vị nhỏ nhất; các container trong pod dùng chung network namespace; sidecar; pod là thứ dùng một lần, chết thì thay bằng pod mới, không sửa pod cũ.
  4. **Deployment → ReplicaSet → Pod**: Deployment quản lý ReplicaSet; không sửa trực tiếp ReplicaSet do Deployment sở hữu.
  5. **Service**:
     - Các kiểu ClusterIP, NodePort, LoadBalancer, headless.
     - EndpointSlice chọn pod theo selector.
     - DNS nội bộ.
  6. **Ingress và Gateway API**:
     - Ingress đã bị **đóng băng**: vẫn GA, không bị gỡ, nhưng không phát triển thêm.
     - Kubernetes khuyến nghị Gateway API (GatewayClass, Gateway, HTTPRoute) cho việc mới.
  7. **ConfigMap và Secret**:
     - Secret mặc định **không mã hoá** trong etcd; ai tạo được pod trong namespace thì đọc được Secret của namespace đó.
     - Cần bật mã hoá at rest, RBAC tối thiểu, hoặc dùng secret store bên ngoài.
     - EKS ≥ 1.28 đã mã hoá sẵn (link `eks`).
  8. **Namespace và RBAC**: Role/ClusterRole, RoleBinding, ServiceAccount; namespace là ranh giới mềm.
  9. **Các workload khác**: DaemonSet, Job/CronJob, StatefulSet (giới thiệu, chi tiết ở mục 19).
- **Câu hỏi tự kiểm tra**
  - Xoá một pod của Deployment thì chuyện gì xảy ra, và thành phần nào làm việc đó?
  - Service tìm pod bằng cách nào? Đổi label của pod thì sao?
  - Vì sao dự án mới nên chọn Gateway API thay vì Ingress?
  - Ai tạo được Deployment trong namespace thì có đọc được Secret không?
- **Sơ đồ / mô phỏng**
  - SVG kiến trúc control plane / node.
  - Sim "xoá một pod": controller thấy 2/3 replica → tạo pod mới → scheduler gán node → kubelet chạy pod → EndpointSlice cập nhật.
- **Nguồn (đã mở)**
  - https://kubernetes.io/docs/concepts/overview/components/
  - https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
  - https://kubernetes.io/docs/concepts/services-networking/gateway/
  - https://kubernetes.io/docs/concepts/services-networking/ingress/
  - https://kubernetes.io/docs/concepts/configuration/secret/

### 18. `dockerfile` · Viết Dockerfile chuẩn và build cache · **P1**

- **Vì sao cần**
  - Image to, build chậm, lộ secret trong layer, chạy bằng root: đây là lỗi thực tế hay gặp nhất khi đóng gói service.
  - Câu hỏi "tối ưu Dockerfile thế nào" phổ biến trong phỏng vấn backend và DevOps.
- **Tiên quyết**: `container-basics`.
- **Liên quan**: `ecs`, `eks`, `dev-methods` (CI).
- **tldr**: Mỗi lệnh `RUN`/`COPY` tạo một layer và được cache theo thứ tự; một lệnh đổi thì mọi lệnh sau nó build lại. Vì vậy:
  - Đặt bước ít đổi lên trước: cài dependency trước, copy code sau.
  - Dùng multi-stage build để image cuối chỉ chứa thứ cần để chạy.
  - Chạy bằng user không phải root.
  - Không đưa secret qua `ARG`/`ENV`.
- **Ý chính**
  1. **Base image**: nguồn tin cậy, nhỏ (slim, distroless); **pin theo digest** để tag bị ghi đè vẫn build ra cùng kết quả.
  2. **Multi-stage build**: stage build có compiler và dev dependency; stage cuối chỉ copy artifact sang.
  3. **Thứ tự layer**: copy file lock rồi cài dependency, xong mới `COPY . .`. Gộp `apt-get update && apt-get install` trong cùng một `RUN`, nếu tách ra thì cache giữ danh sách gói cũ.
  4. **`.dockerignore`**: build context nhỏ thì build nhanh và không lọt `.git` hay `.env` vào image.
  5. **`USER` không phải root**; mỗi container một trách nhiệm; container dùng một lần rồi bỏ.
  6. **Secret lúc build**: dùng `RUN --mount=type=secret`. `ARG`/`ENV` nằm lại trong image, ai có image cũng đọc được.
  7. **BuildKit cache**:
     - Cache mount (`RUN --mount=type=cache,target=/root/.npm`) giữ cache của package manager qua các lần build.
     - Bind mount cho source không lưu vào layer.
     - Cache dùng chung qua registry (`--cache-to` / `--cache-from type=registry`) cho các runner CI.
  8. **Build lại định kỳ** với `--pull` (lấy base mới có bản vá) và `--no-cache` khi cần build sạch hoàn toàn.
  9. **`HEALTHCHECK`, `ENTRYPOINT` và `CMD`, tín hiệu dừng**: process PID 1 phải xử lý SIGTERM để shutdown êm. Trên Kubernetes, probe thay cho `HEALTHCHECK` (link mục 19).
- **Câu hỏi tự kiểm tra**
  - Đổi một dòng code mà `npm install` chạy lại. Vì sao, sửa thế nào?
  - Vì sao `ENV API_KEY=…` lúc build là lộ secret?
  - Multi-stage giảm kích thước image bằng cách nào?
  - Pin `node:22` khác pin `node@sha256:…` ở đâu?
- **Sơ đồ / mô phỏng**: codewalk (cùng kiểu `tdd-codewalk`) gồm Dockerfile xấu → sắp lại layer → multi-stage → non-root → secret mount. Mỗi bước hiện kích thước image và số layer phải build lại khi đổi một file code.
- **Nguồn (đã mở)**
  - https://docs.docker.com/build/building/best-practices/
  - https://docs.docker.com/build/cache/optimize/
  - https://docs.docker.com/build/building/secrets/

### 19. `k8s-operations` · Chạy ổn định trên Kubernetes: probe, resource, rollout, stateful · **P1**

- **Vì sao cần**
  - Phần lớn sự cố khi chạy trên Kubernetes đến từ cấu hình sai, không phải từ code:
    - không có readiness probe nên traffic vào pod chưa sẵn sàng
    - liveness probe quá gắt nên pod restart liên tục
    - không đặt requests nên bị xếp chồng
    - memory limit thấp nên OOMKilled
  - `eks` có nhắc HPA và `requests`/`limits`, nhưng chưa có chỗ giải thích cơ chế.
- **Tiên quyết**: `k8s-core`.
- **Liên quan**:
  - Topic: `eks`, `ecs` (rolling deploy), `observability` (mục 6), `deployment-safety` (mục 11), `resilience` (mục 5)
  - Sim: `eks-flow`, `ecs-flow`
- **tldr**:
  - Probe: **readiness** quyết định pod có nhận traffic không; **liveness** quyết định có restart không; **startup** che hai probe kia khi app khởi động chậm.
  - Resource: **requests** dùng để xếp lịch; **limits** thì CPU bị throttle, RAM bị OOM-kill.
  - Rollout: Deployment rolling update mặc định `maxSurge` và `maxUnavailable` 25%, rollback bằng `kubectl rollout undo`.
  - Workload có trạng thái dùng StatefulSet kèm PVC.
- **Ý chính**
  1. **Ba loại probe** và hậu quả khi fail:
     - readiness: pod bị gỡ khỏi EndpointSlice, không restart
     - liveness: kubelet restart container
     - startup: chặn liveness/readiness tới khi pass
  2. **Bẫy probe**: liveness kiểm cả DB. DB chậm thì mọi pod cùng restart, sự cố lan rộng hơn.
  3. **Requests và limits**:
     - Scheduler dùng requests để chọn node.
     - CPU vượt limit thì bị throttle; RAM vượt limit thì bị OOM-kill.
     - Chỉ đặt limit mà không đặt request thì request lấy bằng limit.
     - Các lớp QoS.
  4. **HPA**: `desired = ceil(current × metric / target)`; CPU tính theo % của requests, nên không đặt requests thì HPA không hoạt động. Link `eks`.
  5. **Rolling update**:
     - `maxSurge` / `maxUnavailable` mặc định 25%.
     - `revisionHistoryLimit` mặc định 10.
     - `progressDeadlineSeconds` mặc định 600; quá hạn thì chỉ báo lỗi, **không tự rollback**.
  6. **Shutdown êm**: SIGTERM, `terminationGracePeriodSeconds`, preStop. Readiness phải tắt trước khi process thoát.
  7. **StatefulSet**:
     - Tên pod ổn định (`web-0`) nhờ headless Service.
     - Mỗi pod một PVC từ `volumeClaimTemplates`.
     - Thứ tự khởi tạo và cập nhật.
     - Xoá hoặc scale down **không xoá PVC**.
  8. **PV, PVC, StorageClass**: dynamic provisioning; access mode; volume gắn theo AZ (link `eks` stateful).
  9. **PodDisruptionBudget** khi drain node; ResourceQuota/LimitRange cho mỗi namespace.
- **Câu hỏi tự kiểm tra**
  - Pod đang chạy bị gỡ khỏi Service nhưng không restart. Probe nào đang fail?
  - Vì sao liveness probe không nên gọi DB?
  - Container dùng 120% CPU limit thì bị gì? 120% memory limit thì sao?
  - Scale StatefulSet từ 3 xuống 2 thì PVC `data-web-2` ra sao?
- **Sơ đồ / mô phỏng**: sim rolling update 4 replica với `maxSurge=1`, `maxUnavailable=0`, có variant readiness fail ở bản mới (rollout dừng, bản cũ vẫn phục vụ) và variant không có readiness probe (traffic vào pod chưa sẵn sàng).
- **Nguồn (đã mở)**
  - https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
  - https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
  - https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
  - https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/

### 20. `image-delivery` · Build → tag → push → deploy: registry, digest, scan, SBOM · **P1**

- **Vì sao cần**
  - "Code từ commit tới production đi đường nào" là câu hỏi phổ biến.
  - Lỗi hay gặp: deploy theo tag `latest` hay tag bị ghi đè, nên không biết production chạy bản nào và rollback không chắc chắn.
  - Image chứa CVE mà không ai biết.
  - Mục này nối `dockerfile` với `deployment-safety` (mục 11).
- **Tiên quyết**: `dockerfile`, `system-architecture`.
- **Liên quan**: `ecs` (`ecs-flow`: ECS kéo image từ ECR), `eks`, `dev-methods`, `deployment-safety`.
- **tldr**: CI build image một lần, gắn tag theo commit, push lên registry; deploy theo **digest** (bất biến). Cùng một image đi qua dev → staging → prod, không build lại. Image được scan lỗ hổng và kèm SBOM để biết bên trong có gì.
- **Ý chính**
  1. **Tag khác digest**: tag là con trỏ có thể bị dời đi; digest là hash nội dung. Bật tag immutable ở registry.
  2. **Chiến lược tag**: git SHA, semver; tránh `latest` trong production.
  3. **Build once, promote many**: đổi cấu hình theo môi trường bằng env/ConfigMap, không build lại image.
  4. **Registry**: quyền push/pull; image đa kiến trúc (image index, amd64 và arm64).
  5. **Scan lỗ hổng** trong CI và trên registry; chặn deploy theo mức độ nghiêm trọng.
  6. **SBOM** (BuildKit sinh SPDX bằng `--sbom=true`) và provenance; ký image (đề cập, không đi sâu).
  7. **Deploy**: cập nhật digest trong task definition / manifest; GitOps (repo là nguồn trạng thái mong muốn); rollback = trỏ lại digest cũ.
- **Câu hỏi tự kiểm tra**
  - Vì sao deploy theo digest thay vì theo tag?
  - "Build lại cho prod" sai ở chỗ nào?
  - SBOM giúp gì khi một CVE mới được công bố?
- **Sơ đồ / mô phỏng**: SVG pipeline commit → CI build → scan + SBOM → push (tag + digest) → deploy dev → promote staging → prod.
- **Nguồn (đã mở)**
  - https://docs.docker.com/build/metadata/attestations/sbom/
  - https://github.com/opencontainers/image-spec/blob/main/spec.md (manifest, image index, digest)
  - https://docs.docker.com/build/building/best-practices/ (pin digest, build lại định kỳ)

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
| QUIC | Giao thức transport của HTTP/3. Đã xuất hiện trong `networking` sau đính chính. |
| RFC | Request for Comments. Đã xuất hiện trong nội dung. |
| DR | Disaster Recovery |
| LSN | Log Sequence Number (PostgreSQL) |
| NTP | Network Time Protocol |
| BM25 | Hàm xếp hạng độ liên quan, mặc định của Elasticsearch |
| SBOM | Software Bill of Materials (mục 20) |
| SPDX | Định dạng SBOM mà BuildKit sinh ra (mục 20) |
| CVE | Common Vulnerabilities and Exposures (mục 20) |
| CRI | Container Runtime Interface (mục 16, 17) |
| PV | PersistentVolume (glossary đã có PVC; mục 19) |
| QoS | Quality of Service class của pod (mục 19) |

## Còn chưa chắc

- Sáu khẳng định của reviewer ở A2 đã xác minh xong (giai đoạn 1.5). Các dòng khác của A2 vẫn là nhận định của reviewer.
- Nguồn Part B đã mở hết, trừ hai bản PDF không trích được chữ (Dynamo, Lamport). Lamport đã đối chiếu qua trang Microsoft Research; Dynamo cần đọc bằng công cụ khác khi viết `replication`.
- Cách ghi nguồn: hiện là URL trong câu; quy định §6 nói trường `src`, nhưng app chưa render trường đó (xem cuối A1).
