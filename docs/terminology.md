# Bảng thuật ngữ chuẩn

Nguồn chuẩn cho mọi người và agent viết nội dung: mỗi khái niệm kỹ thuật có **một key term**. Key term là từ mà người phỏng vấn sẽ nói và người học sẽ gõ vào ô tìm kiếm, thường là tiếng Anh. Tiếng Việt dùng để **giải nghĩa** key term, không thay nó.

Quyết định liên quan: D25 (tiêu đề giữ thuật ngữ ngành tiếng Anh), D100–D109 trong `docs/decisions.md`. `scripts/check.mjs` đọc cột "Không dùng trong nhãn" của bảng §3 và báo lỗi khi một nhãn điều hướng dùng cụm đó (D106).

## 1. Key term đặt ở đâu

| Chỗ | Viết thế nào | Ví dụ |
|---|---|---|
| Nhãn điều hướng: `title` của giai đoạn, chặng, topic, problem, sim | Key term. Tiếng Việt chỉ cho phần nối ("hay", "chuyên sâu", "căn bản", "là gì?") và cho nhãn thuộc §2 | "Async & Coordination", "CAP & Consistency Models" |
| `goal` (giai đoạn, topic) | Câu tiếng Việt bắt đầu bằng động từ; khái niệm kỹ thuật viết bằng key term | "Chọn consistency hay availability cho từng phần dữ liệu khi có network partition" |
| `tldr` hoặc lần đầu khái niệm xuất hiện trong một topic | Key term, kèm giải nghĩa tiếng Việt **một lần** | "**Async processing** (xử lý bất đồng bộ): request trả lời ngay, việc chậm chạy sau" |
| Phần còn lại của nội dung | Key term. Được dùng từ ở cột "Giải nghĩa" khi nó chỉ có đúng một nghĩa trong câu (xem §4) | "fan-out chạy bất đồng bộ qua Kafka" vẫn được |
| Mô tả trong `glossary.js` | Tiếng Việt tự do; đây là chỗ giải nghĩa | — |

## 2. Khi nào giữ tiếng Việt trong nhãn

Giữ tiếng Việt khi nhãn **không phải tên một khái niệm kỹ thuật**, hoặc khi từ tiếng Việt đã là thuật ngữ chuẩn mà ai học CS ở Việt Nam cũng biết và chỉ có một nghĩa:

1. **Hoạt động, điều hướng, giao diện**: Lộ trình, Luyện bài, Mô phỏng, Khung trả lời, Luyện đề LLD, Vòng coding, Câu chuyện của bạn, Chọn công nghệ, Trên AWS, Kể sâu về dự án, Đào sâu.
2. **Câu hỏi hoặc so sánh để chọn**: "SQL hay NoSQL?", "ECS hay EKS?", "Thread hay Process?", "Container là gì?", "Gõ URL thì chuyện gì xảy ra".
3. **Tên môn học CS chuẩn tiếng Việt**: Cấu trúc dữ liệu, Thuật toán, Độ phức tạp, Hệ điều hành, Mạng máy tính, Đệ quy, Kiểm thử. Thêm vào danh sách này phải ghi một dòng D.
4. **Từ thường ngày ghép với key term**: căn bản, chuyên sâu, kinh điển, hay gặp, trong thực tế, ở mức code.
5. **Nhãn mô tả không dịch từ một thuật ngữ nào**: Nền móng, Scale dữ liệu, Lưu trữ chuyên dụng, Kỹ năng viết code, Vận hành production.

Còn lại, nếu nhãn tiếng Việt là **bản dịch** của một thuật ngữ mà phỏng vấn dùng bằng tiếng Anh ("Nhất quán & sao chép", "Tranh chấp tài nguyên", "Quan sát hệ thống"), thay bằng key term. Không chắc thì hỏi: người học nghe interviewer nói từ nào, và gõ từ nào vào Google?

### Cách viết

- **Hoa/thường trong nhãn**: tiêu đề giai đoạn, chặng, topic viết hoa chữ đầu mỗi từ của key term, như Hello Interview và tài liệu chính thức ("Consistent Hashing", "Circuit Breaker", "Isolation Level"). Tiêu đề sim và tên variant là câu mô tả kịch bản: chỉ viết hoa chữ đầu câu, key term bên trong viết như trong câu ("Retry storm và circuit breaker"). Phần sau dấu `:` là danh sách ví dụ, giữ chữ thường như trong câu ("Process: fork, exec, zombie", "Observability: log, metric, trace"). Từ viết tắt viết hoa (CAP, SQL, DLQ). Tên sản phẩm viết như hãng viết (Kafka, PostgreSQL, gRPC, etcd).
- **Trong câu**: chữ thường, trừ viết tắt và tên sản phẩm ("replication lag", "circuit breaker", "Kafka").
- **Gạch nối**: theo cột "Cách viết chuẩn". Tính từ ghép trong tài liệu gốc có gạch nối thì giữ (at-least-once, write-through, cache-aside, read-your-writes, fan-out, multi-leader, full-text, thread-safe). Từ đã thành một từ thì viết liền (backpressure, realtime, failover, timeout).
- **Không dịch trong `code`**: tên lệnh, tham số, header giữ nguyên văn.

## 3. Bảng thuật ngữ

Cột "Không dùng trong nhãn" là cụm `check.mjs` chặn trong `title` (so không phân biệt hoa/thường, theo nguyên cụm từ). Trong câu, các cụm đó vẫn được dùng để giải nghĩa nếu §4 không cấm. Chỉ ghi cụm từ hai chữ trở lên để luật không bắt nhầm.

<!-- terminology:start -->
| Key term | Cách viết chuẩn | Giải nghĩa tiếng Việt | Không dùng trong nhãn | Topic id chính |
|---|---|---|---|---|
| **Khung & ước lượng** | | | | |
| Numbers to Know | Numbers to Know; ước lượng nhanh gọi là back-of-the-envelope estimation | các con số latency, throughput, dung lượng cần thuộc để ước lượng tải | "Con số cần nhớ" | `numbers` |
| Capacity Estimation | capacity estimation | ước lượng QPS, dung lượng, băng thông từ DAU | "Ước lượng dung lượng", "tính toán sơ bộ" | `numbers`, `delivery` |
| Functional / Non-functional Requirements | FR, NFR (glossary) | yêu cầu chức năng / phi chức năng | — | `delivery` |
| **Giao tiếp & cửa vào** | | | | |
| Networking | Networking | mạng ở mức cần cho System Design: tầng, giao thức, DNS | — | `networking` |
| API Design | API Design; REST, GraphQL, gRPC | thiết kế API | — | `api-design` |
| Pagination | pagination; cursor-based, offset-based | phân trang kết quả API | "Phân trang" | `api-design` |
| Load Balancer / Load Balancing | load balancer (thiết bị), load balancing (việc); L4, L7 | chia request cho nhiều server | "Cân bằng tải" | `lb-gateway-cdn` |
| API Gateway | API Gateway | cửa vào duy nhất: auth, rate limit, routing | "Cổng API" | `lb-gateway-cdn` |
| CDN | CDN (glossary) | mạng máy chủ biên cache nội dung gần user | "Mạng phân phối nội dung" | `lb-gateway-cdn` |
| Authentication / Authorization | authentication (authn), authorization (authz) | xác thực (là ai) / phân quyền (được làm gì) | "Xác thực & phân quyền" | `auth` (sắp viết) |
| Rate Limiting | rate limiting (việc), rate limiter (thành phần); token bucket, sliding window | giới hạn số request mỗi khoảng thời gian | "Giới hạn tốc độ", "Giới hạn tần suất" | `rate-limiter` (problem) |
| **Database** | | | | |
| Data Modeling | Data Modeling | đi từ requirement tới bảng, khoá, quan hệ | "Mô hình hoá dữ liệu", "Mô hình dữ liệu" | `data-modeling` |
| Database Indexing | index (số nhiều: indexes); B-Tree, composite index | cấu trúc phụ giúp tìm dòng không phải quét cả bảng | "Chỉ mục", "Lập chỉ mục" | `indexing` |
| Transaction | transaction; ACID | nhóm thao tác chạy trọn hoặc không chạy gì | "Giao dịch" (khi nói về DB) | `db-isolation-anomalies` |
| Isolation Level | isolation level; Read Committed, Repeatable Read, Serializable | transaction thấy gì từ transaction chạy đồng thời | "Mức cô lập" | `db-isolation-anomalies` |
| Database Locking | optimistic lock, pessimistic lock; `SELECT … FOR UPDATE` | khoá dòng trong một database | "Khoá lạc quan", "Khoá bi quan" | `db-locking` (sắp viết) |
| Query Tuning | query plan, `EXPLAIN` | đọc kế hoạch thực thi và sửa truy vấn chậm | "Tối ưu truy vấn" | `db-query-tuning` (sắp viết) |
| **Scale dữ liệu** | | | | |
| Caching | caching (việc), cache (nơi lưu); cache-aside, write-through, write-around, write-back | giữ bản sao dữ liệu hay đọc ở chỗ nhanh hơn | "Bộ nhớ đệm", "Bộ đệm" | `caching` |
| Cache Stampede | cache stampede; single flight | nhiều request cùng miss một key và cùng đập vào DB | "Dồn cache" | `caching` |
| Hot Key | hot key (hai từ) | một key nhận tải vượt xa key khác | "Khoá nóng" | `caching`, `consistent-hashing` |
| Distributed Cache | Distributed Cache | lớp cache dùng chung cho nhiều instance | "Cache phân tán" | `dist-cache` |
| Sharding / Partitioning | sharding (chia ra nhiều máy), partitioning (chia trong một máy); shard key, partition key | chia dữ liệu thành nhiều phần | "Phân mảnh dữ liệu", "Phân vùng dữ liệu", "Chia dữ liệu ra nhiều máy" | `sharding` |
| Consistent Hashing | consistent hashing; hash ring, virtual node | hash ring để thêm/bớt node chỉ dời khoảng 1/N key | "Băm nhất quán" | `consistent-hashing` |
| Hash | hash (động từ và danh từ), hash function | biến key thành số để chọn chỗ | "Hàm băm" (trong nhãn) | `consistent-hashing` |
| Replication | replication; leader–follower, multi-leader, leaderless, quorum | giữ nhiều bản sao dữ liệu trên nhiều máy | "Sao chép dữ liệu", "Nhân bản dữ liệu", "Nhất quán & sao chép" | `replication` |
| Replication Lag | replication lag; read-your-writes | độ trễ của replica so với leader | "Độ trễ sao chép" | `replication` |
| Failover | failover (một từ); split brain | chuyển leader sang máy khác khi leader chết | "Chuyển đổi dự phòng" | `replication` |
| Consistency | consistency; strong consistency, eventual consistency | các bản sao trả cùng một dữ liệu tới mức nào | "Tính nhất quán", "Mô hình nhất quán", "Nhất quán mạnh", "Nhất quán cuối cùng" | `cap` |
| Availability | availability; HA (glossary) | hệ vẫn trả lời khi một phần hỏng | "Tính sẵn sàng" | `cap` |
| Network Partition | network partition | mạng giữa các node bị đứt, hai phía không thấy nhau | "Phân vùng mạng", "Mạng chia cắt" | `cap` |
| CAP / PACELC | CAP, PACELC (glossary) | khi partition phải chọn C hay A; khi không partition chọn latency hay C | "Định lý CAP" | `cap` |
| Fault Tolerance | fault tolerance | hệ chạy tiếp khi một thành phần hỏng | "Khả năng chịu lỗi" | `replication` |
| Multi-region | multi-region; RPO, RTO | chạy hệ thống trên nhiều region | "Đa vùng" | `multi-region` (sắp viết) |
| Distributed ID Generation | Snowflake, UUIDv7 | sinh id duy nhất không cần điểm trung tâm | "Sinh ID phân tán" | `id-generation` (sắp viết) |
| **Async & Coordination** | | | | |
| Async Processing | async (tính từ); asynchronous processing | request trả lời ngay, việc chậm chạy sau qua queue/worker | "Bất đồng bộ", "Xử lý bất đồng bộ" | `queue` |
| Message Queue | message queue, queue; producer, consumer, DLQ | hàng đợi message giữa producer và consumer | "Hàng đợi", "Hàng đợi tin nhắn" | `queue` |
| Backpressure | backpressure (một từ, theo Node.js và Reactor) | bên nhận báo bên gửi chậm lại khi quá tải | "Áp lực ngược", "Back-pressure" | `queue` |
| Event Streaming / Stream | stream, event stream, log; consumer group, offset | log sự kiện bền, nhiều consumer đọc lại được | "Luồng sự kiện", "Dòng sự kiện" | `streams`, `kafka` |
| Event Sourcing | event sourcing | lưu chuỗi sự kiện thay cho trạng thái hiện tại | "Nguồn sự kiện" | `streams` |
| Stream Processing | stream processing; window, watermark | tính toán liên tục trên luồng sự kiện | "Xử lý luồng", "Xử lý dòng" | `stream-processing` (sắp viết) |
| Delivery Semantics | at-most-once, at-least-once, exactly-once | message được giao tối đa / ít nhất / đúng một lần | "Giao ít nhất một lần", "Đúng một lần" | `kafka`, `idempotency` |
| Fan-out | fan-out (gạch nối); fan-out on write, fan-out on read | phát một event tới nhiều nơi nhận | "Phân phát" | `streams` |
| Resilience | resilience; timeout, retry, exponential backoff, jitter, circuit breaker | gọi qua mạng mà lỗi không lan dây chuyền | "Gọi nhau an toàn", "Khả năng phục hồi" | `resilience` |
| Retry Storm | retry storm | retry ở nhiều tầng nhân tải lên phụ thuộc đang yếu | "Retry nhân tải", "Bão retry" | `resilience` |
| Circuit Breaker | circuit breaker; closed, open, half-open | ngắt lời gọi tới phụ thuộc đang chết | "Cầu dao", "Ngắt mạch" | `resilience` |
| Idempotency | idempotency (danh từ), idempotent (tính từ); idempotency key | làm lại nhiều lần cho cùng kết quả như một lần | "Luỹ đẳng", "Lũy đẳng", "Tính bất biến khi lặp" | `idempotency` |
| Contention | contention | nhiều bên cùng tranh một tài nguyên | "Tranh chấp tài nguyên", "Tranh chấp" | `dist-lock` |
| Distributed Lock | distributed lock; TTL, lease, fencing token, Redlock | khoá tài nguyên xuyên nhiều máy | "Khoá phân tán", "Khóa phân tán" | `dist-lock` |
| Consensus / Leader Election | consensus, leader election; Raft, quorum | các node thống nhất một giá trị hoặc một leader | "Đồng thuận", "Bầu leader", "Bầu chọn leader" | `consensus` (sắp viết) |
| Multi-step Processes | workflow; saga, orchestration, choreography, compensation | quy trình nhiều bước qua nhiều service | "Quy trình nhiều bước", "Điều phối dịch vụ" | `durable-execution` |
| Transactional Outbox / CDC | outbox, CDC (glossary); dual write | ghi DB và phát event trong cùng một transaction | "Hộp thư đi" | `outbox-cdc` |
| Durable Execution | Durable Execution; event history, replay | quy trình nhiều bước sống qua crash nhờ ghi lại lịch sử | "Thực thi bền" | `durable-execution` |
| **Lưu trữ chuyên dụng** | | | | |
| Blob Storage | blob storage, object storage; presigned URL, multipart upload | kho file lớn ngoài database | "Kho đối tượng" | `blob` |
| Full-text Search | full-text search; inverted index | tìm kiếm theo từ trong văn bản | "Tìm kiếm toàn văn" | `search` |
| Probabilistic Data Structures | Bloom filter, Count-Min Sketch, HyperLogLog | cấu trúc đổi một ít sai số lấy bộ nhớ rất nhỏ | "Cấu trúc dữ liệu xác suất" | `bigdata-ds` |
| Vector Search | vector search; embedding, ANN | tìm theo độ tương đồng | "Tìm kiếm vector" | `vector-search` (sắp viết) |
| **Vận hành** | | | | |
| Observability | observability; log, metric, trace; SLI, SLO, SLA | đo và lần theo hệ thống đang chạy | "Quan sát hệ thống", "Khả năng quan sát", "Giám sát hệ thống" | `observability` |
| Zero-downtime Deployment | zero-downtime deployment; rolling, blue/green, canary, feature flag | deploy mà không ngừng phục vụ | "Triển khai an toàn", "Triển khai không gián đoạn" | `deployment-safety` (sắp viết) |
| **Nền tảng CS** | | | | |
| Process | process; PID, fork, exec | chương trình đang chạy, có không gian địa chỉ riêng | "Tiến trình" | `os-process-lifecycle` |
| Thread | thread; single-thread, multi-thread | luồng thực thi trong một process, dùng chung bộ nhớ | "Đa luồng", "Đơn luồng", "Luồng thực thi" | `thr-thread-vs-process` |
| Context Switch | context switch | kernel lưu trạng thái task này, nạp task khác | "Chuyển ngữ cảnh" | `os-context-switch` |
| Memory | memory; stack, heap | bộ nhớ của process | "Bộ nhớ" | `os-memory-layout` |
| Virtual Memory / Paging | virtual memory, paging, page fault, TLB | mỗi process thấy không gian địa chỉ ảo riêng | "Bộ nhớ ảo", "Phân trang" | `os-virtual-memory` |
| Address Translation | address translation | MMU đổi địa chỉ ảo ra địa chỉ vật lý | "Dịch địa chỉ ảo", "Dịch địa chỉ" | `os-virtual-memory` |
| Garbage Collection | garbage collection, GC (glossary) | runtime tự dọn bộ nhớ không còn dùng | "Thu gom rác" | `code-memory-gc` (sắp viết) |
| Concurrency | concurrency; race condition, deadlock | nhiều việc tiến triển xen kẽ, không nhất thiết cùng lúc | "Xử lý đồng thời", "Lập trình đồng thời", "Tương tranh" | `concurrency` |
| Parallelism | parallelism | nhiều việc chạy cùng lúc thật trên nhiều core | "Xử lý song song", "Song song" | `conc-parallelism-amdahl` (sắp viết) |
| Async Programming | async/await, event loop, coroutine, Promise | viết code không chặn thread khi chờ I/O | "Lập trình bất đồng bộ", "Bất đồng bộ" | `async-event-loop` (sắp viết) |
| Deadlock | deadlock; lock ordering | các bên chờ nhau vòng tròn, không ai chạy tiếp | "Bế tắc", "Khoá chết" | `concurrency` |
| Thread-safe | thread-safe (gạch nối) | dùng từ nhiều thread mà không sai | "An toàn luồng" | `concurrency` |
| I/O-bound / CPU-bound | I/O-bound, CPU-bound (gạch nối) | việc chủ yếu chờ I/O / việc chủ yếu tính toán trên CPU | "Nặng I/O", "Nặng CPU" | `thr-io-vs-cpu-bound` |
| Thread Pool | thread pool; worker, task queue, rejection policy | nhóm thread dựng sẵn, lấy task từ queue để chạy | "Nhóm luồng", "Bể luồng" | `thr-thread-pool` |
| Green Thread / Virtual Thread | green thread, goroutine, virtual thread, platform thread; M:N scheduling, carrier thread, pinning | thread do runtime quản lý, nhiều cái chạy trên ít OS thread | "Luồng xanh", "Luồng ảo" | `thr-green-threads` |
| Blocking / Non-blocking I/O | blocking I/O, non-blocking I/O, I/O multiplexing, async I/O; readiness, completion | lời gọi I/O chờ hay trả về ngay; một thread chờ nhiều fd cùng lúc | "I/O chặn", "Ghép kênh I/O", "Đa hợp I/O" | `io-blocking-models` |
| Signal | signal; SIGTERM, SIGKILL, SIGINT; signal handler | thông báo kernel gửi tới process vào thời điểm bất kỳ | "Tín hiệu hệ điều hành" | `os-signals-shutdown` |
| Graceful Shutdown | graceful shutdown; drain | dừng app sau khi làm xong việc đang dở, không rớt request | "Tắt nhẹ nhàng", "Dừng an toàn" | `os-signals-shutdown` |
| Race Condition / Data Race | race condition, data race; check-then-act, read-modify-write, TOCTOU (glossary) | kết quả phụ thuộc thứ tự chạy / hai truy cập cùng ô nhớ không đồng bộ, ít nhất một ghi | "Điều kiện tranh chấp", "Tranh chấp dữ liệu" | `conc-race-condition` |
| Livelock / Starvation | livelock, starvation, fairness, priority inversion | vẫn chạy mà không tiến / chờ mãi không tới lượt | "Khoá sống", "Chết đói", "Đảo ngược ưu tiên" | `conc-livelock-starvation` |
| Atomic / CAS | atomic, compare-and-swap, CAS (glossary), lock-free; ABA | thao tác không bị chen ngang; chỉ ghi khi giá trị còn như lúc đọc | "So sánh và hoán đổi", "Không khoá" | `conc-atomic-cas` |
| **LLD & kiến trúc** | | | | |
| Design Principles | SOLID, KISS, DRY, YAGNI, SoC, LoD | nguyên tắc giữ code dễ đổi | "Nguyên tắc thiết kế", "Giữ thiết kế đơn giản" | `solid`, `principles-other` |
| Design Patterns | Design Patterns (GoF); Creational, Structural, Behavioral | lời giải lặp lại cho vấn đề thiết kế class | "Mẫu thiết kế" | `patterns-gof` |
| Event-driven Architecture | event-driven | service giao tiếp bằng event | "Kiến trúc hướng sự kiện" | `system-architecture` |
| Clean Code | clean code | code dễ đọc, dễ đổi | "Code sạch" | (chặng sắp có) |
| Error Handling | error handling | xử lý lỗi | "Xử lý lỗi" | `code-error-handling` (sắp viết) |
<!-- terminology:end -->

## 4. Từ tiếng Việt nhiều nghĩa: không dùng cho khái niệm kỹ thuật

Những từ dưới đây có hai nghĩa trở lên. Dùng chúng cho khái niệm kỹ thuật làm người đọc phải đoán, nên trong **mọi** văn bản (không chỉ nhãn) viết key term:

| Từ | Nghĩa được giữ | Nghĩa phải viết bằng key term |
|---|---|---|
| luồng | dòng chảy, luồng xử lý ("luồng chính của bài") | thread ("đa luồng" → "multi-thread", "đơn luồng" → "single-thread") |
| tiến trình | (không dùng) | process |
| song song | parallel: chạy cùng lúc thật (upload song song nhiều chunk, nhiều consumer đọc song song) | concurrent: hai request/transaction cùng chạm một dữ liệu → "đồng thời" |
| phân vùng | (không dùng) | partition (dữ liệu), network partition (mạng) |
| phân mảnh | fragmentation của heap ("phân mảnh bộ nhớ") | sharding |
| băm | (không dùng) | hash |
| giao dịch | giao dịch tiền ("lịch sử từng giao dịch" trong `payment`) | transaction của database |
| đồng thuận | (không dùng) | consensus |
| hàng đợi | phép so sánh đời thường ("như hàng đợi") | queue khi nói về thành phần hệ thống |
| khoá | lock khi đã rõ ngữ cảnh ("giữ khoá", "khoá dòng"); "khoá chính", "khoá ngoại" (tên chuẩn của PK, FK) | key của cache/Redis/partition → viết "key". *Chưa rà hết khoảng 100 chỗ "khoá" hiện có; sửa dần khi đụng tới topic.* |
| chịu lỗi | chịu lỗi chính tả trong fuzzy search | fault tolerance: lần đầu viết "chịu lỗi (fault tolerance)" |
| phân trang | (không dùng trong nhãn) | pagination (API) hoặc paging (bộ nhớ) |

## 5. Thêm thuật ngữ mới

1. Tìm key term trong tài liệu chính thức hoặc Hello Interview; ghi đúng cách viết của nguồn.
2. Thêm một dòng vào bảng §3, trong nhóm phù hợp. Cột "Không dùng trong nhãn" chỉ ghi cụm hai chữ trở lên, trong ngoặc kép thẳng `"…"`.
3. Là viết tắt thì thêm vào `content/glossary.js` (mỗi viết tắt một lần).
4. Chạy `node scripts/check.mjs`.
