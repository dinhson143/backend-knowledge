# Đề xuất: mở rộng cây học (lộ trình chính, Nền tảng CS, nhánh Python)

Người viết: Curriculum Researcher · Nhánh `research/tree-expansion` (từ `ada0601`) · Ngày 2026-11-27

> Đề xuất, chưa phải nội dung. Tài liệu chỉ liệt kê **đề mục + nguồn** để viết bài sau; không sửa `content/` hay code.
> Không lặp lại ba đề xuất cũ: `product-learning-flow.md` (§7 cây 171 topic, §8 đợt viết), `interview-topic-catalog.md` (138 đề mục CS/coding), `content-gaps.md` (20 chủ đề SD/Container). Mọi id dưới đây đã được script đối chiếu với registry `BK` (topic, problem, sim, track, section) và mọi id viết trong ba tài liệu đó: **không trùng**.
> Dải quyết định: **D110–D119** (đã ghi vào `docs/decisions.md`, chờ người dùng duyệt).

Yêu cầu của người dùng:

1. Lộ trình chính nhiều nội dung hơn, tham khảo microservices pattern.
2. Computer Science rộng hơn backend.
3. Python là ngôn ngữ chính, nên có mục riêng.

## 0. Tóm tắt

- **85 đề xuất mới**: 36 ở §2 (34 cho lộ trình chính, 2 cho nhánh Vận hành), 14 cho Nền tảng CS mở rộng (§3), 35 cho nhánh Python (§4). Theo ưu tiên: **20 P0 · 39 P1 · 26 P2**.
- **Lộ trình chính** thêm một giai đoạn mới "Hệ thống nhiều service" (id `svc`, sau GĐ3) dựng theo pattern language của microservices.io, cộng 7 deep dive công nghệ còn thiếu so với Hello Interview và các chặng Đào sâu cho phân tán, dữ liệu lớn, ML/LLM.
- **Nền tảng CS** thêm ba chặng: Kiến trúc máy tính, Ngôn ngữ & trình thông dịch, Bảo mật & mật mã. Lý thuyết hệ phân tán đi vào chặng Đào sâu của GĐ2; data engineering và ML/LLM vào Đào sâu của GĐ4.
- **Nhánh Python** (id `py`, song song) 8 chặng, 35 topic `py-*` + nhận lại `thr-gil` từ Nền tảng CS. Ranh giới: Nền tảng CS dạy khái niệm chung nhiều ngôn ngữ; nhánh Python dạy API và hành vi của CPython.
- **"microservice.com"**: không xác minh được (chứng chỉ TLS hết hạn khi mở, tìm kiếm không ra trang nào của tên miền này). Nguồn người dùng muốn nói gần như chắc chắn là **microservices.io** của Chris Richardson; đã đọc trực tiếp mục lục pattern của trang này (§1).

Quy ước bảng đề xuất (giống nhau ở mọi phần để script đếm và kiểm):

| Cột | Ý nghĩa |
|---|---|
| Ưu tiên | P0 = hay bị hỏi + site chưa có + là nền cho topic khác; P1 = nên có; P2 = bổ sung |
| id | id mới, kebab-case. Nhánh Python dùng tiền tố `py-` |
| Tiêu đề | ≤ 40 ký tự, **key term tiếng Anh** (D25) |
| Giải nghĩa | một câu tiếng Việt: bài dạy gì |
| Chặng | `<giai đoạn/nhánh> › <chặng>`; chặng mới có ghi chú (mới) |
| needs | ≤ 3 id (có sẵn, đã lên kế hoạch hoặc đề xuất ở đây) |
| Câu hỏi | 2–4 câu tự viết, cách nhau bằng " · " |
| Nguồn | trang chính thức đã mở |

---

## 1. Nguồn đã tham khảo và cách các nguồn tổ chức

Cột "Xác minh": **mở** = đã đọc nội dung/mục lục; **HTTP 200** = chỉ kiểm tra link sống (dùng cho link dẫn trong bảng, nội dung lấy theo tên trang).

### 1.1 So sánh cách tổ chức

| Nguồn | Cách tổ chức | Mạnh ở | Dùng cho | Xác minh |
|---|---|---|---|---|
| [microservices.io](https://microservices.io/patterns/index.html) (Chris Richardson) | Pattern language 15 nhóm: Architectural style · Service boundaries · Refactoring to services · Service collaboration · Transactional messaging · Testing · Deployment · Cross-cutting concerns · Communication styles · External API · Service discovery · Reliability · Security · Observability · UI design | Mỗi pattern có bối cảnh, vấn đề, hệ quả, pattern liên quan; nối với nhau thành đồ thị | §2.4 giai đoạn `svc` và bảng phủ §2.1 | mở (mục lục + trang Service mesh) |
| [Azure Architecture Center: Cloud design patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/) | Danh mục pattern theo vấn đề (data management, design & implementation, messaging, reliability, security) | Các pattern Richardson không có: Sidecar, BFF, Strangler Fig, Bulkhead, Claim Check, Valet Key, Gateway Aggregation/Offloading | Nguồn thứ hai cho §2.4 | HTTP 200 |
| [martinfowler.com](https://martinfowler.com/articles/microservices.html) | Bài viết rời: Microservices, Strangler Fig, CQRS, Event-Driven, Feature Toggles | Định nghĩa gốc của nhiều thuật ngữ | §2.4 | HTTP 200 |
| [teachyourselfcs.com](https://teachyourselfcs.com/) | 9 môn, mỗi môn một sách + một khoá: Programming (SICP), Computer Architecture (CS:APP), Algorithms, Math for CS, OS (OSTEP), Networking, Databases, Languages & Compilers (Crafting Interpreters), Distributed Systems (DDIA, MIT 6.824) | Danh sách môn "kỹ sư tự học cần có" gọn nhất | Khung §3 | mở |
| [OSSU Computer Science](https://github.com/ossu/computer-science) | Intro CS → Core CS (programming, math, tools, systems, theory, **security**, applications gồm DB/ML, ethics) → Advanced (compilers, parallel, testing, debugging…) → Final project | Có hẳn khối Core security và CS Tools (Missing Semester) | §3 security, tools | mở |
| [ACM/IEEE-CS/AAAI CS2023](https://csed.acm.org/knowledge-areas/) | 17 knowledge area: AL, AR, AI, DM, FPL, GIT, HCI, MSF, NC, OS, PDC, SEC, SEP, SDF, SE, SPD, SF | Bản đồ đầy đủ nhất để soát thiếu | §3.1 bảng soát | mở |
| [CMU 15-213 (CS:APP)](https://www.cs.cmu.edu/~213/schedule.html) | Bits & integers → machine programming → linking → memory hierarchy, cache → virtual memory → malloc → code optimization → processes, ECF → I/O → network programming → concurrency | Góc nhìn "lập trình viên nhìn phần cứng" | §3 `cs.arch` | mở |
| [CMU 15-445](https://15445.courses.cs.cmu.edu/fall2024/schedule.html) | Relational model, SQL → storage, buffer pool → hash/B+tree index → sort, join → query execution, optimizer → concurrency control (2PL, OCC, MVCC) → logging, recovery → distributed OLTP/OLAP | Database internals theo tầng | §2 GĐ1 Đào sâu, GĐ4 OLAP | mở |
| [MIT 6.5840 (6.824)](https://pdos.csail.mit.edu/6.824/schedule.html) | RPC & threads → GFS → Paxos, Raft → linearizability → ZooKeeper → distributed transactions → Spanner → chain replication → OCC (FaRM) → cache consistency (Memcache) → Lambda, Ray → BFT | Lý thuyết + case study thật | §2 GĐ2/GĐ3 Đào sâu | mở |
| [MIT 6.033](https://ocw.mit.edu/courses/6-033-computer-system-engineering-spring-2018/) | 4 phần: OS → Networking → Distributed Systems → Security | Ghép hệ thống và bảo mật trong cùng một khoá | §3 security | mở (lịch học) |
| [MIT 6.006](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | Data structures, sorting, hashing → trees, heaps → BFS/DFS, shortest paths → DP → complexity | Khớp với nhánh DSA đã có | Đối chiếu, không thêm topic | mở |
| [Crafting Interpreters](https://craftinginterpreters.com/contents.html) | Tree-walk interpreter (scanning, parsing, evaluating, binding, classes) → bytecode VM (chunks, VM, hash table, closures, GC, optimization) | Giải thích interpreter, bytecode, closure, GC bằng code thật | §3 `cs.lang`, §4 `py-cpython-execution` | mở |
| [DDIA](https://dataintensive.net/) | Foundations of Data Systems → Distributed Data → Derived Data | Nguồn chuẩn cho replication, partitioning, transaction, batch/stream | §2 GĐ2, §3 data | mở (trang sách; mục lục theo catalog cũ) |
| [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/) | Virtualization · Concurrency · Persistence · Security | Đã dùng cho catalog cũ | Đối chiếu | HTTP 200 |
| [Missing Semester](https://missing.csail.mit.edu/) | Shell, editor, data wrangling, VCS, debugging & profiling, security | Công cụ hằng ngày | §3 `tools-unix-shell` | HTTP 200 |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/), [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Cheat sheet theo chủ đề; Top 10 rủi ro web | Thực hành bảo mật ứng dụng | §3 `cs.security` | HTTP 200 |
| [docs.python.org](https://docs.python.org/3/) (Python 3.15 là bản mới nhất) | Tutorial · Library · Language Reference · HOWTOs · What's New | Nguồn chính cho nhánh Python | §4 | mở (What's New 3.14, 3.15, Free-threading HOWTO) |
| [peps.python.org](https://peps.python.org/pep-0703/) | PEP theo số | Lý do thiết kế (GIL, asyncio, typing, packaging) | §4 | mở PEP 703, 779; các PEP khác HTTP 200 |
| [Python Packaging User Guide](https://packaging.python.org/en/latest/), [uv](https://docs.astral.sh/uv/), [pytest](https://docs.pytest.org/en/stable/), [FastAPI](https://fastapi.tiangolo.com/), [Django](https://docs.djangoproject.com/en/stable/) | Tài liệu chính thức từng công cụ | Python cho backend | §4 | HTTP 200 |

Điểm rút ra:

- **Microservices**: Richardson tổ chức theo **vấn đề cần giải** (ranh giới service, cộng tác dữ liệu, giao tiếp, cửa vào, khám phá, tin cậy, quan sát, kiểm thử). Site đã có rải rác nhiều pattern trong `system-architecture`, `resilience`, `outbox-cdc`… nhưng chưa có chỗ học theo đúng chuỗi vấn đề đó → §2.4.
- **CS rộng**: so với CS2023 và teachyourselfcs, site đã/đang lên kế hoạch phủ OS, Networking, Concurrency, DSA, DB; còn thiếu **Architecture (AR)**, **Languages & Compilers (FPL)**, **Security (SEC)**, phần lý thuyết **PDC**, và phần ứng dụng **Data/ML** → §3.
- **Python**: tài liệu chính thức chia theo tầng: ngôn ngữ (Reference) → thư viện → HOWTO chuyên đề → What's New. Phỏng vấn Python backend thì hỏi theo **hành vi dễ sai** (mutable default, GIL, asyncio, refcount) và **framework**. Cây §4 đi theo thứ tự đó.

### 1.2 Soát CS2023 với cây hiện có

| Knowledge area | Đã có / đã lên kế hoạch | Đề xuất ở đây | Ghi chú |
|---|---|---|---|
| AL Algorithmic Foundations | nhánh DSA (`bigo`, `ds`, `algo`, 22 `dsa-*`) | `math-probability` (P2) | đủ |
| AR Architecture & Organization | `os-cpu-cache-locality` (kế hoạch) | chặng `cs.arch` | thiếu số học máy, mã hoá ký tự |
| AI | — | `llm-app-architecture`, `ml-*` (Đào sâu GĐ4) | chỉ phần hệ thống, không lý thuyết (D116) |
| DM Data Management | GĐ1, `db-*`, `storage-engines` | deep dive DB, OLAP, data engineering | |
| FPL Foundations of PL | `code-generics-types`, `code-memory-gc` (kế hoạch) | chặng `cs.lang` | thiếu compiler/interpreter |
| GIT Graphics, HCI | — | loại (D116) | |
| MSF Math & Statistics | — | `math-probability` (P2) | |
| NC Networking | `networking`, 8 `net-*` | `net-ip-subnet-nat` (P2) | |
| OS | chặng Process/Thread/I/O | `tools-unix-shell` (P2) | |
| PDC Parallel & Distributed | Concurrency, Async, GĐ2–GĐ3 | Đào sâu phân tán (`linearizability`, …) | |
| SEC Security | `auth`, `net-tls`, `code-secure-coding` (kế hoạch) | chặng `cs.security`, `secrets-management` | |
| SEP Society, Ethics | — | loại (D116) | |
| SDF, SE | nhánh Kỹ năng viết code, Kiến trúc | `contract-testing` | |
| SPD Specialized Platform | — | ngoài phạm vi (mobile, game, web front-end) | |
| SF Systems Fundamentals | `numbers`, `resilience`, `observability` | — | đủ |

---

## 2. Bổ sung lộ trình chính

### 2.1 Bảng phủ microservices.io → site

Mỗi pattern của Richardson (cộng vài pattern Azure/Fowler hay bị hỏi) đã có chỗ nào chưa. "Mở rộng X" = thêm mục vào topic X, không tạo id.

| Nhóm (microservices.io) | Pattern | Trạng thái trên site | Đề xuất |
|---|---|---|---|
| Architectural style | Monolith, Microservice architecture | có: `system-architecture` | — |
| Service boundaries | Decompose by business capability / subdomain, Service per team, Self-contained service | một phần: `system-architecture` (bounded context, Conway), `dev-methods` (DDD) | **mới** `service-decomposition` |
| Refactoring to services | Strangler Application, Anti-corruption layer | chưa có | **mới** `strangler-fig` |
| Service collaboration | Database per Service, Shared database | có: `system-architecture` | — |
| | Saga | có: `durable-execution` + sim `saga`; nhà chính theo D22 là `pattern-multi-step` (kế hoạch) | mở rộng `durable-execution` (choreography vs orchestration, countermeasure thiếu isolation) — D113 |
| | API Composition | chưa có | gộp vào **mới** `api-gateway-bff` |
| | CQRS, Command-side replica | một phần: 1 dòng trong `system-architecture`, `code-architecture`, `outbox-cdc` | **mới** `cqrs` |
| | Domain event, Event sourcing | có: `streams` (event sourcing) | mở rộng `streams`; domain event vào **mới** `event-driven-architecture` |
| Transactional messaging | Transactional outbox, Transaction log tailing, Polling publisher | có: `outbox-cdc` | — |
| Testing | Consumer-driven contract test, Service component test | chưa có | **mới** `contract-testing` |
| Deployment | Service per container/VM, Serverless, Deployment platform | có: `container-basics`, `ecs`, `k8s-core`, `system-architecture` (serverless) | — |
| Cross-cutting concerns | Microservice chassis, Externalized configuration, Service template | chưa có | **mới** `twelve-factor-config` (P2) |
| Communication styles | Remote Procedure Invocation, Messaging, Domain-specific protocol | một phần: `api-design`, `queue` (từng kiểu riêng, chưa so sánh) | **mới** `sync-vs-async-comm` |
| | Idempotent Consumer | có: `idempotency` | — |
| External API | API gateway, Backend for front-end | một phần: `lb-gateway-cdn` (gateway); BFF chưa có | **mới** `api-gateway-bff` |
| Service discovery | Client-/server-side discovery, Service registry, Self/3rd-party registration | một phần: 1 câu trong `lb-gateway-cdn`, `ecs` | **mới** `service-discovery` |
| Reliability | Circuit Breaker (+ Bulkhead của Azure) | có: `resilience` | — |
| Security | Access Token | kế hoạch: `auth` | — |
| Observability | Log aggregation, Application metrics, Distributed tracing, Health check API, Audit logging, Exception tracking | có: `observability`; health check thuộc `k8s-operations` (kế hoạch) | mở rộng `observability` (W3C trace context, audit log) |
| (Deployment, trang riêng) | Service mesh, Sidecar | một phần: 1 câu trong `k8s-core`, `eks`, `ecs-vs-eks` | **mới** `service-mesh` |
| UI design | Server-side / client-side UI composition | — | không đề xuất (front-end) |
| Azure | Gateway Aggregation/Offloading, Claim Check, Valet Key, Competing Consumers, Rate Limiting | Valet Key ≈ `blob` (presigned URL), Competing Consumers ≈ `queue`; rate limiting chỉ có problem `rate-limiter`, sim `token-bucket` và một dòng trong `concurrency` (chưa có bài thuật toán) | **mới** `rate-limiting`; Claim Check mở rộng `queue` |

### 2.2 GĐ1 · Nền móng

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P0 | `rate-limiting` | Rate Limiting | Các thuật toán token bucket, leaky bucket, fixed/sliding window; đặt limiter ở gateway hay service; trả 429 kèm Retry-After | GĐ1 › Giao tiếp & cửa vào | `api-design`, `lb-gateway-cdn` | Token bucket khác sliding window log ở đâu? · Limit theo user trên 20 instance thì đếm ở đâu? · Client nên làm gì khi nhận 429? | [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585) · [IETF RateLimit headers draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) · [Azure: Rate Limiting pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/rate-limiting-pattern) |
| P2 | `authz-models` | RBAC, ABAC & ReBAC | So sánh phân quyền theo vai trò, theo thuộc tính, theo quan hệ (mô hình Zanzibar) và chỗ đặt policy | GĐ1 › Giao tiếp & cửa vào | `auth` | Khi nào RBAC không đủ? · Chia sẻ tài liệu kiểu Google Docs thì lưu quyền thế nào? · Kiểm quyền ở gateway hay ở service? | [NIST RBAC](https://csrc.nist.gov/projects/role-based-access-control) · [Zanzibar (Google Research)](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/) |
| P1 | `nosql-data-modeling` | NoSQL Data Modeling | Thiết kế bảng NoSQL từ access pattern: partition key, sort key, denormalize, single-table | GĐ1 › Lưu & truy vấn dữ liệu | `data-modeling`, `core-db` | Thiết kế bảng DynamoDB cho đơn hàng của user, sắp theo ngày · Vì sao NoSQL khuyên denormalize? · Partition key nào gây hot partition? | [DynamoDB: NoSQL design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html) · [Cassandra: data modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html) |
| P1 | `postgresql` | PostgreSQL Deep Dive | MVCC, VACUUM, index loại nào, replication, giới hạn scale của PostgreSQL | GĐ1 › Đào sâu: bên trong database | `indexing`, `db-isolation-anomalies` | Vì sao bảng update nhiều bị phình? · Khi nào dùng GIN thay B-tree? · PostgreSQL scale ghi tới đâu thì phải shard? | [PostgreSQL docs](https://www.postgresql.org/docs/current/) · [Routine vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) · [MVCC](https://www.postgresql.org/docs/current/mvcc.html) |
| P2 | `db-join-algorithms` | Join Algorithms & Query Optimizer | Nested loop, hash join, sort-merge join; optimizer ước lượng chi phí và chọn plan thế nào | GĐ1 › Đào sâu: bên trong database | `db-query-tuning`, `indexing` | Khi nào hash join nhanh hơn nested loop? · Thống kê cũ làm plan sai thế nào? · Join hai bảng lớn không index thì DB làm gì? | [CMU 15-445: Joins, Query Planning](https://15445.courses.cs.cmu.edu/fall2024/schedule.html) |

Không thêm vào chặng "Khung trả lời": `delivery` + `numbers` đã đủ; phần requirements nằm trong `delivery`.

### 2.3 GĐ2 · Scale dữ liệu

Chỉ thêm vào hai chặng Đào sâu (`optional`). Các chặng bắt buộc đã đủ cho phỏng vấn; quorum leaderless (hinted handoff, read repair) **mở rộng `replication`**, hot key **mở rộng `caching`** / `pattern-scaling-writes`.

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P1 | `linearizability` | Linearizability & Consistency Models | Thang mô hình nhất quán: linearizable, sequential, causal, read-your-writes, eventual; cái nào cần consensus | GĐ2 › Đào sâu: phân tán | `cap`, `replication` | Linearizable khác serializable ở đâu? · Read-your-writes làm bằng cách nào khi đọc từ replica? · Vì sao linearizable chậm hơn? | [Jepsen: consistency models](https://jepsen.io/consistency) · [MIT 6.5840: Linearizability](https://pdos.csail.mit.edu/6.824/schedule.html) |
| P2 | `crdt-conflict-resolution` | Conflict Resolution & CRDT | Xử lý ghi đồng thời ở multi-leader/offline: LWW, version vector, CRDT, so với OT | GĐ2 › Đào sâu: phân tán | `replication`, `time-ordering` | LWW làm mất dữ liệu khi nào? · CRDT counter hoạt động thế nào? · Google Docs dùng OT hay CRDT, khác nhau ở đâu? | [crdt.tech](https://crdt.tech/) · [Kleppmann: Distributed Systems notes](https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf) |
| P2 | `gossip-failure-detection` | Gossip & Failure Detection | Phát hiện node chết bằng heartbeat, gossip, SWIM; vì sao không phân biệt được chết với chậm | GĐ2 › Đào sâu: phân tán | `replication`, `consistent-hashing` | Cassandra biết node nào sống bằng cách nào? · Timeout phát hiện lỗi đặt bao nhiêu thì hợp lý? · Gossip lan tin trong bao nhiêu vòng? | [SWIM paper](https://www.cs.cornell.edu/projects/Quicksilver/public_pdfs/SWIM.pdf) · [Cassandra architecture](https://cassandra.apache.org/doc/latest/cassandra/architecture/index.html) |
| P1 | `dynamodb` | DynamoDB Deep Dive | Partition, GSI/LSI, capacity mode, transaction, stream; giới hạn hot partition | GĐ2 › Đào sâu: công nghệ (mới) | `nosql-data-modeling`, `sharding` | GSI nhất quán thế nào với bảng gốc? · Hot partition xử lý ra sao? · Khi nào không nên chọn DynamoDB? | [DynamoDB developer guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html) · [Dynamo paper](https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store) |
| P1 | `cassandra` | Cassandra Deep Dive | Wide-column, ring, tunable consistency, LSM, tombstone | GĐ2 › Đào sâu: công nghệ (mới) | `nosql-data-modeling`, `consistent-hashing`, `replication` | Chọn consistency level QUORUM hay ONE? · Tombstone gây chậm đọc vì sao? · Mô hình bảng theo query nghĩa là gì? | [Cassandra architecture](https://cassandra.apache.org/doc/latest/cassandra/architecture/index.html) · [Cassandra data modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html) |
| P2 | `zookeeper-etcd` | ZooKeeper & etcd | Kho cấu hình nhất quán cho leader election, lock, service registry; watch, lease | GĐ2 › Đào sâu: công nghệ (mới) | `consensus`, `dist-lock` | Vì sao Kafka bỏ ZooKeeper? · Leader election bằng etcd lease ra sao? · Khi nào không nên lưu dữ liệu app vào etcd? | [ZooKeeper docs](https://zookeeper.apache.org/doc/current/) · [etcd docs](https://etcd.io/docs/) |

`zookeeper-etcd` cần `consensus` (GĐ3 › Tranh chấp tài nguyên), đứng sau trong lộ trình; đây là chặng `optional` nên chấp nhận được, hoặc chuyển nó sang Đào sâu của GĐ3 khi viết (ghi ở D117).

### 2.4 GĐ3 · Bất đồng bộ & phối hợp

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P1 | `distributed-transactions` | Distributed Transactions & 2PC | Atomic commit trên nhiều node: 2PC, coordinator chết, Spanner/TrueTime; vì sao microservices chuyển sang saga | GĐ3 › Quy trình nhiều bước đáng tin | `db-isolation-anomalies`, `replication` | 2PC bị kẹt khi nào? · Vì sao ít dùng XA giữa các service? · Spanner đạt external consistency bằng gì? | [MIT 6.5840: Distributed Transactions, Spanner](https://pdos.csail.mit.edu/6.824/schedule.html) · [PostgreSQL PREPARE TRANSACTION](https://www.postgresql.org/docs/current/sql-prepare-transaction.html) · [Spanner paper](https://research.google/pubs/spanner-googles-globally-distributed-database-2/) |
| P2 | `job-scheduling` | Job Scheduling & Delayed Jobs | Chạy việc theo lịch hoặc hẹn giờ trên nhiều máy mà không chạy trùng, không sót | GĐ3 › Quy trình nhiều bước đáng tin | `queue`, `dist-lock` | Cron trên 3 instance chạy 3 lần — sửa thế nào? · Hẹn gửi 10 triệu thông báo lúc 9h thì lưu ra sao? · Job chạy dở thì máy chết? | [Kubernetes CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) · [Azure: Scheduler Agent Supervisor](https://learn.microsoft.com/en-us/azure/architecture/patterns/scheduler-agent-supervisor) |
| P2 | `temporal` | Temporal Deep Dive | Workflow, activity, history replay, determinism, versioning trong Temporal | GĐ3 › Đào sâu: công nghệ (mới) | `durable-execution` | Vì sao workflow code phải deterministic? · Đổi code workflow đang chạy thế nào? · Activity retry khác workflow retry ra sao? | [Temporal docs](https://docs.temporal.io/) |
| P2 | `apache-flink` | Apache Flink Deep Dive | Stateful stream processing: checkpoint, savepoint, watermark, exactly-once | GĐ3 › Đào sâu: xử lý luồng | `stream-processing`, `kafka` | Checkpoint của Flink đảm bảo gì? · State lớn lưu ở đâu? · Flink khác Kafka Streams ở đâu? | [Flink docs](https://nightlies.apache.org/flink/flink-docs-stable/) |

Saga không có id mới (id `saga` là sim, và D22 đã định nhà là `pattern-multi-step`); phần choreography vs orchestration của microservices.io mở rộng `durable-execution` (D113).

### 2.5 Giai đoạn mới · Hệ thống nhiều service (`svc`)

Đặt **sau GĐ3, trước GĐ4** (D111): cần queue, resilience, idempotency, outbox (GĐ3) làm nền; GĐ4 không phụ thuộc vào nó. Goal đề xuất: "Học xong bạn tách được service theo nghiệp vụ, cho chúng tìm và gọi nhau an toàn, và giữ dữ liệu nhất quán giữa các service." Tiên quyết xuyên nhánh `system-architecture` (Kiến trúc & phương pháp) chỉ để hiển thị.

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P1 | `service-decomposition` | Service Decomposition | Tách service theo business capability hay subdomain (bounded context), mỗi team sở hữu service; dấu hiệu tách sai | Nhiều service › Tách service (mới) | `system-architecture`, `data-modeling` | Tách theo business capability khác subdomain ở đâu? · Hai service luôn deploy cùng nhau nói lên điều gì? · Service quá nhỏ gây hại gì? | [microservices.io: Decompose by subdomain](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html) · [Decompose by business capability](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html) |
| P1 | `strangler-fig` | Strangler Fig & Anti-Corruption Layer | Chuyển dần monolith sang service: chắn route từng phần, lớp dịch mô hình để model mới không nhiễm model cũ | Nhiều service › Tách service (mới) | `service-decomposition`, `lb-gateway-cdn` | Migrate monolith 10 năm tuổi không dừng hệ thống thế nào? · Dữ liệu dùng chung lúc chuyển xử lý ra sao? · ACL đặt ở đâu? | [Fowler: StranglerFigApplication](https://martinfowler.com/bliki/StranglerFigApplication.html) · [microservices.io: Strangler](https://microservices.io/patterns/refactoring/strangler-application.html) · [Anti-corruption layer](https://microservices.io/patterns/refactoring/anti-corruption-layer.html) |
| P0 | `sync-vs-async-comm` | Sync vs Async Communication | REST/gRPC đồng bộ hay messaging bất đồng bộ giữa service; temporal coupling và tính khả dụng nhân dồn qua chuỗi gọi | Nhiều service › Giao tiếp giữa service (mới) | `api-design`, `queue`, `resilience` | 5 service gọi nối tiếp, mỗi cái 99.9% thì cả chuỗi bao nhiêu? · Khi nào bắt buộc phải gọi đồng bộ? · Request/reply qua queue làm thế nào? | [microservices.io: Messaging](https://microservices.io/patterns/communication-style/messaging.html) · [microservices.io pattern language](https://microservices.io/patterns/index.html) |
| P0 | `service-discovery` | Service Discovery | Client-side vs server-side discovery, service registry, self vs third-party registration, DNS của Kubernetes | Nhiều service › Giao tiếp giữa service (mới) | `lb-gateway-cdn`, `sync-vs-async-comm` | Instance mới lên thì client biết bằng cách nào? · Client-side discovery có lợi gì cho gRPC? · Registry chết thì sao? | [Client-side discovery](https://microservices.io/patterns/client-side-discovery.html) · [Server-side discovery](https://microservices.io/patterns/server-side-discovery.html) · [Service registry](https://microservices.io/patterns/service-registry.html) · [Kubernetes DNS](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) |
| P0 | `api-gateway-bff` | API Gateway, BFF & API Composition | Một cửa vào cho client: định tuyến, gom nhiều lời gọi (API composition), BFF riêng cho web/mobile, offload auth | Nhiều service › Giao tiếp giữa service (mới) | `lb-gateway-cdn`, `auth`, `service-discovery` | Khi nào cần BFF riêng cho mobile? · Gateway gom 3 service, một cái chậm thì trả gì? · Gateway có thành điểm nghẽn không? | [microservices.io: API gateway / BFF](https://microservices.io/patterns/apigateway.html) · [API Composition](https://microservices.io/patterns/data/api-composition.html) · [Azure: BFF](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends) · [Azure: Gateway Aggregation](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation) |
| P1 | `service-mesh` | Sidecar & Service Mesh | Đưa retry, mTLS, metrics, traffic split ra sidecar proxy; control plane vs data plane; khi nào không đáng | Nhiều service › Giao tiếp giữa service (mới) | `service-discovery`, `resilience`, `k8s-core` | Service mesh giải bài gì mà library không giải? · Chi phí latency/vận hành của sidecar? · Retry ở cả app và mesh gây gì? | [microservices.io: Service mesh](https://microservices.io/patterns/deployment/service-mesh.html) · [Azure: Sidecar](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar) · [Istio: what is Istio](https://istio.io/latest/docs/concepts/what-is-istio/) |
| P1 | `event-driven-architecture` | Event-Driven Architecture | Event notification, event-carried state transfer, domain event; choreography vs orchestration; schema event | Nhiều service › Dữ liệu giữa các service (mới) | `streams`, `outbox-cdc`, `sync-vs-async-comm` | Event nên mang đủ dữ liệu hay chỉ id? · Choreography khó debug ở đâu? · Đổi schema event mà không phá consumer? | [Fowler: What do you mean by "Event-Driven"?](https://martinfowler.com/articles/201701-event-driven.html) · [microservices.io pattern language](https://microservices.io/patterns/index.html) |
| P1 | `cqrs` | CQRS & Read Model | Tách mô hình ghi và đọc, dựng read model/materialized view từ event, chấp nhận độ trễ | Nhiều service › Dữ liệu giữa các service (mới) | `event-driven-architecture`, `outbox-cdc` | Truy vấn join dữ liệu của 3 service thế nào? · Read model trễ thì UI xử lý ra sao? · CQRS có bắt buộc event sourcing không? | [microservices.io: CQRS](https://microservices.io/patterns/data/cqrs.html) · [Azure: CQRS](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) · [Fowler: CQRS](https://martinfowler.com/bliki/CQRS.html) |
| P1 | `contract-testing` | Contract Testing | Consumer-driven contract để đổi API mà không phá service khác, thay cho e2e test toàn hệ thống | Nhiều service › Kiểm thử & cấu hình (mới) | `api-design`, `code-testing-fundamentals` | Vì sao e2e test với 30 service không bền? · Consumer-driven contract chạy ở pipeline nào? · Contract test bắt được lỗi gì mà unit test không? | [microservices.io: Service integration contract test](https://microservices.io/patterns/testing/service-integration-contract-test.html) · [Pact docs](https://docs.pact.io/) |
| P2 | `twelve-factor-config` | Twelve-Factor & Externalized Config | Cấu hình ngoài code, chassis/service template, stateless process, log ra stdout | Nhiều service › Kiểm thử & cấu hình (mới) | `container-basics`, `system-architecture` | Vì sao config để trong env var? · Đổi config không cần deploy lại thế nào? · Microservice chassis giải bài gì? | [The Twelve-Factor App](https://12factor.net/) · [microservices.io: Externalized configuration](https://microservices.io/patterns/externalized-configuration.html) · [Microservice chassis](https://microservices.io/patterns/microservice-chassis.html) |

Chặng đề xuất của `svc`: `svc.split` "Tách service" · `svc.comm` "Giao tiếp giữa service" · `svc.data` "Dữ liệu giữa các service" · `svc.ops` "Kiểm thử & cấu hình". Theo D27, chặng chỉ vào `roadmap.js` cùng topic đầu tiên. Lúc giai đoạn còn trống, topic đầu tiên nên là `sync-vs-async-comm`.

Mở rộng (không id mới) cùng đợt: `streams` (domain event), `observability` (W3C [Trace Context](https://www.w3.org/TR/trace-context/), audit log), `durable-execution` (saga choreography/orchestration theo [microservices.io: Saga](https://microservices.io/patterns/data/saga.html)), `queue` (Claim Check).

### 2.6 GĐ4 · Lưu trữ chuyên dụng

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P1 | `olap-columnar` | OLAP, Column Store & Warehouse | Row store vs column store, OLTP vs OLAP, nén cột, pre-aggregation; khi nào cần warehouse | GĐ4 › Kho chuyên dụng | `core-db`, `indexing` | Vì sao column store đếm nhanh? · Dashboard query thẳng DB chính gây gì? · Ad click aggregator lưu số liệu ở đâu? | [CMU 15-445: Storage Models, OLAP](https://15445.courses.cs.cmu.edu/fall2024/schedule.html) · [ClickHouse docs](https://clickhouse.com/docs) |
| P1 | `time-series-db` | Time-Series Database | Lưu metric/sự kiện theo thời gian: nén delta, downsampling, retention, cardinality | GĐ4 › Kho chuyên dụng | `olap-columnar`, `sharding` | High cardinality làm TSDB chết thế nào? · Giữ dữ liệu 1 năm mà không phình? · Vì sao không lưu metric vào PostgreSQL thường? | [Prometheus: storage](https://prometheus.io/docs/prometheus/latest/storage/) |
| P2 | `graph-db` | Graph Database | Khi nào quan hệ nhiều bậc cần graph DB; so với join đệ quy trong SQL | GĐ4 › Kho chuyên dụng | `core-db`, `data-modeling` | Gợi ý "bạn của bạn" nên dùng graph DB không? · Graph DB scale ngang khó vì sao? | [Neo4j: getting started](https://neo4j.com/docs/getting-started/) |
| P1 | `elasticsearch` | Elasticsearch Deep Dive | Shard, replica, refresh, mapping, relevance; giữ đồng bộ với DB chính | GĐ4 › Đào sâu: công nghệ (mới) | `search`, `outbox-cdc` | Document mới ghi chưa tìm thấy ngay vì sao? · Đồng bộ DB → ES thế nào? · Chọn số shard ra sao? | [Elastic docs](https://www.elastic.co/docs/) |
| P1 | `batch-processing` | MapReduce & Spark | Xử lý batch phân tán: map, shuffle, reduce, partition, data skew; Spark DAG | GĐ4 › Đào sâu: dữ liệu lớn (mới) | `sharding`, `blob` | Shuffle tốn ở đâu? · Một key chiếm 50% dữ liệu thì job chậm thế nào? · Batch khác stream ở đâu? | [MapReduce paper](https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/) · [Spark RDD guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html) |
| P2 | `data-pipelines` | ETL/ELT & Data Pipeline | Orchestration (Airflow), backfill idempotent, định dạng cột (Parquet), lakehouse (Iceberg) | GĐ4 › Đào sâu: dữ liệu lớn (mới) | `batch-processing`, `idempotency` | Chạy lại pipeline hôm qua mà không nhân đôi dữ liệu? · Vì sao Parquet nhỏ và nhanh hơn CSV? · ETL khác ELT? | [Airflow docs](https://airflow.apache.org/docs/) · [Parquet docs](https://parquet.apache.org/docs/) · [Iceberg docs](https://iceberg.apache.org/docs/latest/) |
| P1 | `llm-app-architecture` | LLM Apps: RAG & Serving | Kiến trúc app dùng LLM: streaming token, RAG với vector search, cache, guardrail, đo chất lượng | GĐ4 › Đào sâu: ML & LLM (mới) | `vector-search`, `networking` | Thiết kế chatbot hỏi đáp trên tài liệu nội bộ · Vì sao stream token qua SSE? · Giảm chi phí và latency gọi model thế nào? | [RAG paper (arXiv 2005.11401)](https://arxiv.org/abs/2005.11401) · [Hugging Face Transformers](https://huggingface.co/docs/transformers/index) |
| P2 | `ml-basics-for-swe` | ML Basics for Engineers | Train vs inference, overfitting, precision/recall, offline vs online metric — đủ để nói chuyện với team ML | GĐ4 › Đào sâu: ML & LLM (mới) | — | Precision và recall đánh đổi thế nào? · Model tốt offline mà online tệ vì sao? | [Google ML Crash Course](https://developers.google.com/machine-learning/crash-course) · [Rules of ML](https://developers.google.com/machine-learning/guides/rules-of-ml) |
| P2 | `ml-serving` | Model Serving & Feature Store | Phục vụ model: batch vs online, dynamic batching, feature store, A/B rollout | GĐ4 › Đào sâu: ML & LLM (mới) | `ml-basics-for-swe`, `caching` | Feature lúc train và lúc serve lệch nhau thì sao? · Batching request lên GPU đánh đổi gì? · Rollout model mới an toàn thế nào? | [Ray Serve](https://docs.ray.io/en/latest/serve/index.html) · [Feast docs](https://docs.feast.dev/) |

Geo index (geohash, quadtree) **không** có id mới: nhà là `pattern-proximity` (kế hoạch, D22).

### 2.7 GĐ5 và nhánh Vận hành

GĐ5 không thêm topic: 8 `pattern-*` (D22) và 19 bài `HI_GAPS` đã đủ. Các bài trong `HI_GAPS` dùng topic mới như sau: Job Scheduler → `job-scheduling`; Metrics Monitoring → `time-series-db`; ChatGPT → `llm-app-architecture`; Distributed Cache → `gossip-failure-detection`; Ad Click (có sẵn) → `olap-columnar`.

Nhánh Vận hành production (đã có placeholder "Bảo mật & định danh" ở `product-learning-flow.md` §3.1):

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P1 | `secrets-management` | Secrets & Key Management | Lưu và xoay vòng secret, KMS, envelope encryption, mã hoá at rest | Vận hành › Bảo mật vận hành (mới) | `auth`, `sec-crypto-primitives` | Envelope encryption là gì, vì sao dùng? · Lộ key trong git thì làm gì trước? · Xoay vòng mật khẩu DB không downtime? | [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · [AWS KMS cryptography](https://docs.aws.amazon.com/kms/latest/developerguide/kms-cryptography.html) |
| P2 | `incident-response` | Incident Response & Postmortem | Vai trò khi có sự cố, giảm thiểu trước sửa gốc, postmortem không đổ lỗi | Vận hành › Quan sát hệ thống | `observability` | Sự cố lúc 2h sáng: 15 phút đầu làm gì? · Postmortem tốt có gì? | [SRE book: Managing incidents](https://sre.google/sre-book/managing-incidents/) · [Postmortem culture](https://sre.google/sre-book/postmortem-culture/) |

---

## 3. Nền tảng CS: mảng mới

Ba chặng mới trong nhánh `cs`, xếp sau `cs.net` (D114). Tiền tố `hw-`, `pl-`, `sec-` (không dùng `arch-` vì trùng tên track `arch`). Những gì đã có kế hoạch thì không đề xuất lại: `os-cpu-cache-locality` (memory hierarchy), `code-memory-gc` (GC), `code-generics-types` (type system), `net-tls` (PKI, handshake), `code-secure-coding` (injection, lưu mật khẩu), `os-linux-diagnostics`.

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P0 | `hw-numbers-float` | Integer, Float & Decimal | Two's complement, overflow, IEEE 754, vì sao 0.1 + 0.2 ≠ 0.3, tiền dùng Decimal hay số nguyên | Nền tảng CS › Kiến trúc máy tính (mới) | — | Vì sao không lưu tiền bằng float? · Integer overflow trong Python khác Java thế nào? · So sánh hai float đúng cách? | [CMU 15-213: Bits, Bytes & Integers](https://www.cs.cmu.edu/~213/schedule.html) · [Python: Floating-point arithmetic](https://docs.python.org/3/tutorial/floatingpoint.html) · [decimal](https://docs.python.org/3/library/decimal.html) |
| P1 | `hw-text-encoding` | Unicode & UTF-8 | Code point, encoding, UTF-8 nhiều byte, normalization, độ dài chuỗi khác số byte | Nền tảng CS › Kiến trúc máy tính (mới) | — | `len("é")` có thể ra 1 hoặc 2 vì sao? · VARCHAR(10) chứa được mấy ký tự tiếng Việt? · Lỗi mojibake sinh ra thế nào? | [Python Unicode HOWTO](https://docs.python.org/3/howto/unicode.html) · [RFC 3629 (UTF-8)](https://www.ietf.org/rfc/rfc3629.txt) |
| P2 | `hw-cpu-execution` | CPU Pipeline, Branch & SIMD | Pipeline, branch prediction, SIMD, vì sao dữ liệu đã sort chạy nhanh hơn | Nền tảng CS › Kiến trúc máy tính (mới) | `os-cpu-cache-locality` | Vì sao vòng lặp qua mảng đã sort nhanh hơn? · NumPy nhanh nhờ SIMD thế nào? | [CMU 15-213: Code Optimization](https://www.cs.cmu.edu/~213/schedule.html) · [CS61C](https://cs61c.org/) |
| P1 | `pl-compile-vs-interpret` | Compiler, Interpreter & JIT | Từ source tới chạy: AOT compile, interpreter tree-walk, bytecode VM, JIT; đánh đổi khởi động và tốc độ | Nền tảng CS › Ngôn ngữ & trình thông dịch (mới) | `os-memory-layout` | Python có compile không? · JIT nhanh hơn interpreter nhờ gì? · Vì sao Go khởi động nhanh hơn JVM? | [Crafting Interpreters](https://craftinginterpreters.com/contents.html) · [teachyourselfcs: Languages & Compilers](https://teachyourselfcs.com/) |
| P1 | `pl-parsing-ast` | Lexer, Parser & AST | Tokenize, recursive descent, AST, evaluator — dạng bài "viết calculator/JSON parser" | Nền tảng CS › Ngôn ngữ & trình thông dịch (mới) | `pl-compile-vs-interpret`, `dsa-trees` | Viết hàm tính biểu thức có ngoặc và ưu tiên toán tử · Parse JSON đơn giản bằng recursive descent · AST khác parse tree ở đâu? | [Crafting Interpreters: Parsing Expressions](https://craftinginterpreters.com/contents.html) · [Python ast](https://docs.python.org/3/library/ast.html) |
| P2 | `pl-regex-automata` | Regex & Finite Automata | Regex chạy bằng automaton hay backtracking, catastrophic backtracking và ReDoS | Nền tảng CS › Ngôn ngữ & trình thông dịch (mới) | `pl-parsing-ast` | Regex nào làm treo server? · Vì sao `(a+)+$` nguy hiểm? | [Python re](https://docs.python.org/3/library/re.html) · [OWASP: ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) |
| P2 | `pl-linking-loading` | Compile, Link & Load | Object file, static vs dynamic link, ABI, shared library; vì sao wheel có nhiều bản theo nền tảng | Nền tảng CS › Ngôn ngữ & trình thông dịch (mới) | `pl-compile-vs-interpret`, `os-process-lifecycle` | Static link khác dynamic link? · Lỗi "symbol not found" khi chạy là do đâu? · Vì sao package Python có C extension phải build riêng cho từng OS? | [CMU 15-213: Linking](https://www.cs.cmu.edu/~213/schedule.html) · [CS:APP](https://csapp.cs.cmu.edu/) |
| P0 | `sec-crypto-primitives` | Hash, MAC, Encryption & Signature | Bốn khối cơ bản: hash, HMAC, mã hoá đối xứng/bất đối xứng, chữ ký số; dùng cái nào cho việc gì | Nền tảng CS › Bảo mật & mật mã (mới) | — | Hash khác encryption? · Vì sao webhook ký bằng HMAC? · JWT ký HS256 khác RS256 ở đâu? · Vì sao không tự viết thuật toán mã hoá? | [cryptography.io](https://cryptography.io/en/latest/) · [Python hmac](https://docs.python.org/3/library/hmac.html) · [RFC 8446 (TLS 1.3)](https://www.rfc-editor.org/rfc/rfc8446) |
| P1 | `sec-web-attacks` | OWASP Top 10: XSS, SSRF, IDOR | Các lỗ hổng web hay gặp ngoài injection: XSS, SSRF, IDOR/broken access control, deserialization | Nền tảng CS › Bảo mật & mật mã (mới) | `code-secure-coding`, `net-cors-cookies` | IDOR là gì, chặn ở đâu? · Tính năng "tải ảnh từ URL" có rủi ro gì? · Vì sao không `pickle.loads` dữ liệu người dùng? | [OWASP Top 10](https://owasp.org/www-project-top-ten/) · [OWASP: SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) · [OWASP: XSS](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) |
| P2 | `sec-threat-modeling` | Threat Modeling (STRIDE) | Liệt kê mối đe doạ theo STRIDE cho một thiết kế và chọn biện pháp | Nền tảng CS › Bảo mật & mật mã (mới) | `sec-web-attacks`, `auth` | Áp STRIDE cho API upload file · Trust boundary nằm ở đâu trong sơ đồ? | [Microsoft: Threat modeling tool threats (STRIDE)](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) |
| P2 | `net-ip-subnet-nat` | IP, CIDR, Subnet & NAT | Địa chỉ IP, CIDR, subnet public/private, NAT — đủ để đọc sơ đồ VPC | Nền tảng CS › Mạng máy tính | `networking` | /24 có bao nhiêu địa chỉ? · Vì sao DB đặt ở private subnet? · NAT gateway làm gì? | [RFC 4632 (CIDR)](https://www.rfc-editor.org/rfc/rfc4632) |
| P2 | `tools-unix-shell` | Unix Shell & Text Tools | Pipe, redirect, grep/sed/awk, xargs, ssh — xử lý log nhanh trên server | Nền tảng CS › I/O & hệ điều hành | `os-process-lifecycle` | Đếm 10 IP gọi nhiều nhất từ access log bằng một dòng lệnh · Pipe nối hai process thế nào? | [MIT Missing Semester](https://missing.csail.mit.edu/) |
| P2 | `math-probability` | Probability for Engineers | Xác suất cho ước lượng: birthday paradox (va chạm hash/ID), kỳ vọng, sampling, reservoir sampling | Coding · DSA › Độ phức tạp | `bigo` | Bao nhiêu ID 64-bit ngẫu nhiên thì bắt đầu trùng? · Lấy mẫu đều k phần tử từ luồng không biết độ dài? | [MIT 6.042J](https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/) |
| P2 | `dist-failure-models` | Partial Failure & Failure Models | Crash, omission, Byzantine; mạng không tin cậy, two generals, FLP — vì sao không có "exactly once" miễn phí | GĐ2 › Đào sâu: phân tán | `cap`, `replication` | Gửi request bị timeout: server đã xử lý chưa? · Two generals problem nói lên gì? · Byzantine fault có cần tính trong hệ thống nội bộ? | [Kleppmann: Distributed Systems notes](https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf) · [MIT 6.5840](https://pdos.csail.mit.edu/6.824/schedule.html) |

Ghi chú vị trí: `dist-failure-models` nằm ở GĐ2 Đào sâu (D114) nhưng đếm trong §3 vì là mảng CS lý thuyết. `math-probability` và `net-ip-subnet-nat`, `tools-unix-shell` thuộc các nhánh/chặng có sẵn.

Không đề xuất (D116): đồ hoạ, HCI, lý thuyết AI/deep learning, theory of computation/computability, numerical methods, formal logic, mạch số (Nand2Tetris), ethics/SEP, phát triển nền tảng chuyên biệt (mobile, game).

---

## 4. Nhánh Python (`py`)

### 4.1 Vị trí và ranh giới với Nền tảng CS

- Nhánh song song `py` "Python", đặt ngay sau `code` (Kỹ năng viết code) trong `ROADMAP`; track `py`, thư mục `content/topics/py/` (D110). Goal đề xuất: "Học xong bạn giải thích được Python chạy code thế nào, viết Python đúng idiom và trả lời được câu hỏi về GIL, asyncio, framework backend."
- **Nguyên tắc chia:** khái niệm dùng chung nhiều ngôn ngữ ở Nền tảng CS / Kỹ năng viết code; API, ngữ nghĩa và hành vi riêng của CPython ở nhánh Python. Topic Python `needs` topic CS tương ứng.

| Topic có sẵn / kế hoạch | Ở lại | Bài Python tương ứng | Lý do |
|---|---|---|---|
| `thr-gil` (kế hoạch, chưa viết) | **chuyển sang `py`**, giữ id (D112) | — | GIL chỉ có ở CPython; ngôn ngữ khác không có khái niệm này |
| `thr-thread-vs-process`, `thr-io-vs-cpu-bound` | Nền tảng CS | `py-threading-multiprocessing` | chọn thread/process là chuyện chung; `multiprocessing` start method, pickling là chuyện Python |
| `async-event-loop`, `async-coroutine`, `async-cancellation-timeout`, `async-structured-concurrency`, `async-blocking-in-loop`, `async-sync-primitives` | Nền tảng CS (ví dụ đa ngôn ngữ) | `py-asyncio`, `py-asyncio-pitfalls` | khái niệm (event loop, structured concurrency) dùng cho Node, Kotlin, Go; bài Python dạy API `asyncio` cụ thể và lỗi riêng |
| `thr-thread-local-context` (contextvars) | Nền tảng CS | — (link từ `py-asyncio`) | đã có ví dụ Python trong catalog |
| `code-memory-gc` | Nền tảng CS | `py-memory-gc` | so sánh refcount vs tracing GC giữa các ngôn ngữ; bài Python đi vào CPython |
| `code-error-handling` | Kỹ năng viết code | `py-exceptions` | |
| `code-generics-types` | Kỹ năng viết code | `py-typing` | |
| `code-immutability` | Kỹ năng viết code | `py-dataclasses` | |
| `code-testing-fundamentals` | Kỹ năng viết code | `py-pytest` | |
| `code-complexity-perf` | Kỹ năng viết code | `py-profiling` | |
| `code-language-choice` | Kỹ năng viết code | `py-coding-stdlib` | bài có sẵn chỉ liệt kê 8 cấu trúc cho mọi ngôn ngữ |
| `pl-compile-vs-interpret` (mới, §3) | Nền tảng CS | `py-cpython-execution` | |

### 4.2 Cây nhánh Python

```text
∥ Python (py)
  Ngôn ngữ cốt lõi ............ py-object-model, py-builtin-types-complexity, py-data-model, py-scope-closures,
                                 py-iterators-generators, py-decorators, py-context-managers, py-exceptions, py-pitfalls
  Python cho vòng coding ...... py-coding-stdlib, py-idioms
  OOP & typing ................ py-classes-mro, py-descriptors-properties, py-dataclasses, py-abc-protocols, py-typing, py-metaprogramming
  Bên trong CPython ........... py-memory-gc, py-cpython-execution, py-import-system
  Concurrency trong Python .... thr-gil (chuyển từ CS), py-threading-multiprocessing, py-asyncio, py-asyncio-pitfalls, py-subinterpreters
  Đóng gói & kiểm thử ......... py-packaging-env, py-pytest, py-code-quality
  Hiệu năng ................... py-profiling, py-performance
  Python cho backend .......... py-wsgi-asgi, py-fastapi, py-django, py-sqlalchemy, py-task-queues, py-whats-new
```

### 4.3 Đề xuất chi tiết

| Ưu tiên | id | Tiêu đề | Giải nghĩa | Chặng | needs | Câu hỏi | Nguồn |
|---|---|---|---|---|---|---|---|
| P0 | `py-object-model` | Names, Objects & Mutability | Biến là tên gắn vào object; identity vs equality; mutable vs immutable; truyền tham số "by object reference"; shallow vs deep copy | Python › Ngôn ngữ cốt lõi | — | `a = b = []` rồi `a.append(1)` thì `b` là gì? · `is` khác `==` khi nào? · Python truyền tham trị hay tham chiếu? · Shallow copy một list lồng nhau có an toàn không? | [Data model: objects, values, types](https://docs.python.org/3/reference/datamodel.html) · [Execution model: naming and binding](https://docs.python.org/3/reference/executionmodel.html) · [copy](https://docs.python.org/3/library/copy.html) |
| P0 | `py-builtin-types-complexity` | list, dict, set: Internals & Big-O | list là mảng động, dict và set là hash table (dict giữ thứ tự chèn, set thì không); độ phức tạp từng thao tác và khi nào thành O(n) | Python › Ngôn ngữ cốt lõi | `py-object-model`, `bigo` | `x in list` và `x in set` khác nhau bao nhiêu? · `list.pop(0)` tốn gì, thay bằng gì? · Vì sao key của dict phải hashable? | [Python wiki: TimeComplexity](https://wiki.python.org/moin/TimeComplexity) · [Data model: `__hash__`](https://docs.python.org/3/reference/datamodel.html) · [collections](https://docs.python.org/3/library/collections.html) |
| P0 | `py-data-model` | Data Model & Dunder Methods | Giao thức qua dunder method: `__repr__`/`__str__`, `__eq__`/`__hash__`, `__len__`/`__getitem__`, `__bool__`, toán tử | Python › Ngôn ngữ cốt lõi | `py-object-model` | Định nghĩa `__eq__` mà quên `__hash__` thì sao? · `__repr__` khác `__str__`? · Làm class hỗ trợ `len()` và `for` thế nào? | [Data model: special method names](https://docs.python.org/3/reference/datamodel.html) |
| P0 | `py-scope-closures` | Scope, Closures & Late Binding | LEGB, `global`/`nonlocal`, closure giữ biến chứ không giữ giá trị, late binding trong vòng lặp | Python › Ngôn ngữ cốt lõi | `py-object-model` | `[lambda: i for i in range(3)]` gọi ra gì? · Khi nào cần `nonlocal`? · Vì sao gán biến trong hàm làm `UnboundLocalError`? | [Execution model: resolution of names](https://docs.python.org/3/reference/executionmodel.html) · [Programming FAQ](https://docs.python.org/3/faq/programming.html) |
| P0 | `py-iterators-generators` | Iterators & Generators | Iterator protocol, generator và `yield`, `yield from`, generator expression lười, itertools | Python › Ngôn ngữ cốt lõi | `py-data-model` | Generator khác list comprehension về bộ nhớ thế nào? · Duyệt một iterator hai lần thì sao? · `yield from` làm gì? · Đọc file 50 GB từng dòng thế nào? | [PEP 255](https://peps.python.org/pep-0255/) · [PEP 380](https://peps.python.org/pep-0380/) · [Functional HOWTO](https://docs.python.org/3/howto/functional.html) · [itertools](https://docs.python.org/3/library/itertools.html) |
| P0 | `py-decorators` | Decorators | Hàm là object; decorator bọc hàm, `functools.wraps`, decorator có tham số, class decorator, `functools.cache` | Python › Ngôn ngữ cốt lõi | `py-scope-closures` | Viết decorator đo thời gian chạy · Decorator có tham số cần mấy lớp hàm? · Quên `wraps` mất gì? · `lru_cache` trên method gây leak vì sao? | [PEP 318](https://peps.python.org/pep-0318/) · [functools](https://docs.python.org/3/library/functools.html) |
| P0 | `py-context-managers` | Context Managers & `with` | `__enter__`/`__exit__`, nuốt hay truyền exception, `contextlib.contextmanager`, `ExitStack`, `async with` | Python › Ngôn ngữ cốt lõi | `py-iterators-generators` | Viết context manager mở/đóng kết nối DB · `__exit__` trả True nghĩa là gì? · Quản lý số lượng resource không biết trước? | [PEP 343](https://peps.python.org/pep-0343/) · [contextlib](https://docs.python.org/3/library/contextlib.html) |
| P1 | `py-exceptions` | Exceptions, EAFP & ExceptionGroup | EAFP vs LBYL, `raise ... from`, `finally`, cây exception tự định nghĩa, `ExceptionGroup` và `except*` | Python › Ngôn ngữ cốt lõi | `py-context-managers`, `code-error-handling` | EAFP hay LBYL, khi nào chọn cái nào? · `raise from None` dùng khi nào? · `except Exception` khác bare `except` ở đâu? | [Tutorial: Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html) · [Built-in exceptions](https://docs.python.org/3/library/exceptions.html) · [PEP 654](https://peps.python.org/pep-0654/) |
| P0 | `py-pitfalls` | Python Gotchas | Mutable default argument, late binding, sửa list khi đang duyệt, `[[0]*3]*3`, `is` với số nhỏ, `+=` trên phần tử tuple | Python › Ngôn ngữ cốt lõi | `py-scope-closures`, `py-object-model` | `def f(x=[])` gọi hai lần ra gì, sửa thế nào? · `[[0]*3]*3` gán một ô thì sao? · Xoá phần tử khi đang `for` qua list? | [Programming FAQ](https://docs.python.org/3/faq/programming.html) · [Tutorial: default argument values](https://docs.python.org/3/tutorial/controlflow.html) |
| P1 | `py-coding-stdlib` | Python Stdlib for Coding Rounds | Mở rộng phần Python của `code-language-choice`: `Counter`, `defaultdict`, `deque`, `heapq` (min-heap, mẹo max-heap), `bisect`, `itertools`, `sorted(key=)`, `functools.cache`, giới hạn đệ quy | Python › Python cho vòng coding | `code-language-choice`, `py-builtin-types-complexity` | Cài top-K bằng `heapq` · `heapq` cần max-heap thì làm sao? · DFS đệ quy sâu 10⁵ bị lỗi gì? | [collections](https://docs.python.org/3/library/collections.html) · [heapq](https://docs.python.org/3/library/heapq.html) · [bisect](https://docs.python.org/3/library/bisect.html) · [Sorting HOWTO](https://docs.python.org/3/howto/sorting.html) |
| P1 | `py-idioms` | Pythonic Idioms | Comprehension, unpacking, `enumerate`/`zip`, walrus, `match` (structural pattern matching), f-string, PEP 8 | Python › Python cho vòng coding | `py-iterators-generators` | Viết lại vòng lặp có index cho "Pythonic" · `match` khác chuỗi `if/elif` ở đâu? · Khi nào comprehension khó đọc hơn vòng lặp? | [PEP 8](https://peps.python.org/pep-0008/) · [PEP 20](https://peps.python.org/pep-0020/) · [PEP 636](https://peps.python.org/pep-0636/) · [PEP 572](https://peps.python.org/pep-0572/) |
| P1 | `py-classes-mro` | Classes, Inheritance & MRO | Class vs instance attribute, `super()`, đa kế thừa và C3 MRO, mixin, `classmethod`/`staticmethod` | Python › OOP & typing | `py-data-model`, `oop-pillars` | `super()` trong đa kế thừa gọi class nào? · Class attribute là list thì chia sẻ giữa instance thế nào? · `classmethod` dùng làm factory ra sao? | [Tutorial: Classes](https://docs.python.org/3/tutorial/classes.html) · [The Python 2.3 MRO](https://docs.python.org/3/howto/mro.html) |
| P1 | `py-descriptors-properties` | Descriptors, property & `__slots__` | `property` là descriptor; attribute lookup đi qua đâu; `__slots__` tiết kiệm bộ nhớ và đánh đổi | Python › OOP & typing | `py-classes-mro` | `property` hoạt động bên dưới thế nào? · `__slots__` tiết kiệm gì, mất gì? · `__getattr__` khác `__getattribute__`? | [Descriptor HOWTO](https://docs.python.org/3/howto/descriptor.html) · [Data model: `__slots__`](https://docs.python.org/3/reference/datamodel.html) |
| P1 | `py-dataclasses` | dataclass, NamedTuple & Pydantic | Chọn dataclass (frozen, slots), NamedTuple, TypedDict hay Pydantic model theo nhu cầu validate và bất biến | Python › OOP & typing | `py-data-model`, `code-immutability` | dataclass khác Pydantic model ở đâu? · `frozen=True` có thật sự bất biến? · Default là list trong dataclass phải viết thế nào? | [dataclasses](https://docs.python.org/3/library/dataclasses.html) · [PEP 557](https://peps.python.org/pep-0557/) · [Pydantic](https://docs.pydantic.dev/latest/) |
| P1 | `py-abc-protocols` | ABC, Protocol & Duck Typing | Duck typing, ABC kiểm khi tạo object, `Protocol` kiểm tĩnh theo cấu trúc | Python › OOP & typing | `py-classes-mro` | ABC khác Protocol? · Khi nào dùng duck typing thay kế thừa? · `isinstance` với Protocol cần gì? | [PEP 3119](https://peps.python.org/pep-3119/) · [PEP 544](https://peps.python.org/pep-0544/) · [abc](https://docs.python.org/3/library/abc.html) |
| P1 | `py-typing` | Type Hints & mypy | Annotation, generic (cú pháp PEP 695), union kiểu mới (PEP 604), `TypedDict`, `Callable`/`ParamSpec`, runtime không kiểm; annotation lười từ 3.14 | Python › OOP & typing | `py-abc-protocols`, `py-dataclasses` | Type hint có làm code chạy chậm hay kiểm lúc chạy không? · Viết hàm generic nhận list bất kỳ trả phần tử đầu · `Any` khác `object`? | [typing](https://docs.python.org/3/library/typing.html) · [Typing spec](https://typing.python.org/en/latest/spec/index.html) · [PEP 484](https://peps.python.org/pep-0484/) · [PEP 695](https://peps.python.org/pep-0695/) · [PEP 649](https://peps.python.org/pep-0649/) · [mypy](https://mypy.readthedocs.io/en/stable/) |
| P2 | `py-metaprogramming` | Metaclasses & `__init_subclass__` | Class cũng là object; metaclass, `__init_subclass__`, `__set_name__` — và vì sao hiếm khi cần metaclass | Python › OOP & typing | `py-descriptors-properties` | ORM khai báo cột bằng class attribute hoạt động thế nào? · Khi nào `__init_subclass__` đủ thay metaclass? | [Data model: customizing class creation](https://docs.python.org/3/reference/datamodel.html) · [PEP 487](https://peps.python.org/pep-0487/) |
| P0 | `py-memory-gc` | Reference Counting & GC | Refcount giải phóng ngay, cyclic GC theo thế hệ cho vòng tham chiếu, `weakref`, `__del__`, tìm leak bằng `tracemalloc` | Python › Bên trong CPython | `py-object-model`, `os-memory-layout` | CPython giải phóng object khi nào? · Vòng tham chiếu dọn thế nào? · Cache global làm leak — sửa bằng `weakref` ra sao? · Tìm chỗ phình bộ nhớ thế nào? | [gc](https://docs.python.org/3/library/gc.html) · [C API: reference counting](https://docs.python.org/3/c-api/refcounting.html) · [weakref](https://docs.python.org/3/library/weakref.html) · [tracemalloc](https://docs.python.org/3/library/tracemalloc.html) |
| P1 | `py-cpython-execution` | Bytecode, Interpreter & JIT | Source → bytecode (`.pyc`) → eval loop; `dis`; specializing adaptive interpreter (3.11); JIT thử nghiệm (từ 3.13) | Python › Bên trong CPython | `pl-compile-vs-interpret`, `py-object-model` | `.pyc` là gì, khi nào được tạo lại? · Đọc output của `dis` cho một hàm nhỏ · Vì sao Python 3.11 nhanh hơn 3.10? | [dis](https://docs.python.org/3/library/dis.html) · [PEP 659](https://peps.python.org/pep-0659/) · [PEP 744](https://peps.python.org/pep-0744/) · [CPython internals (devguide)](https://devguide.python.org/internals/) |
| P1 | `py-import-system` | Modules, Packages & Imports | `sys.path`, package và `__init__.py`, import vòng, `if __name__ == "__main__"`, `lazy` import (3.15) | Python › Bên trong CPython | `py-object-model` | Import vòng gây lỗi gì, sửa thế nào? · Module import hai lần có chạy lại không? · Giảm thời gian khởi động CLI bằng lazy import? | [The import system](https://docs.python.org/3/reference/import.html) · [PEP 810](https://peps.python.org/pep-0810/) |
| P0 | `py-threading-multiprocessing` | threading, multiprocessing, futures | `threading` + `Lock`/`Queue`; `multiprocessing` (start method, pickling, shared memory); `concurrent.futures` cho cả hai | Python › Concurrency trong Python | `thr-gil`, `thr-io-vs-cpu-bound` | Resize 10.000 ảnh nên dùng thread hay process? · Vì sao lambda không gửi được sang `ProcessPoolExecutor`? · `fork` trong process có thread gây gì? | [threading](https://docs.python.org/3/library/threading.html) · [multiprocessing](https://docs.python.org/3/library/multiprocessing.html) · [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) |
| P0 | `py-asyncio` | asyncio: Event Loop, Task, TaskGroup | `asyncio.run`, coroutine vs Task, `gather` vs `TaskGroup`, `asyncio.timeout`, huỷ task và `CancelledError`, `Queue`/`Semaphore` | Python › Concurrency trong Python | `async-event-loop`, `async-coroutine` | Gọi coroutine mà không `await` thì sao? · `gather` khác `TaskGroup` khi một task lỗi? · Giới hạn 100 request đồng thời bằng gì? · Nuốt `CancelledError` gây hại gì? | [Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html) · [Event loop](https://docs.python.org/3/library/asyncio-eventloop.html) · [PEP 492](https://peps.python.org/pep-0492/) · [PEP 3156](https://peps.python.org/pep-3156/) |
| P1 | `py-asyncio-pitfalls` | asyncio Pitfalls & Debug Mode | Gọi hàm blocking trong coroutine, `to_thread`/`run_in_executor`, task bị GC vì không giữ tham chiếu, debug mode | Python › Concurrency trong Python | `py-asyncio`, `async-blocking-in-loop` | `requests.get` trong `async def` gây gì? · `create_task` mà không lưu tham chiếu thì sao? · Bật debug mode để tìm coroutine chậm? | [Developing with asyncio](https://docs.python.org/3/library/asyncio-dev.html) · [asyncio.to_thread](https://docs.python.org/3/library/asyncio-task.html) |
| P2 | `py-subinterpreters` | Subinterpreters (PEP 734) | Nhiều interpreter trong một process (`concurrent.interpreters`, 3.14): cô lập như process, rẻ hơn process | Python › Concurrency trong Python | `thr-gil`, `py-threading-multiprocessing` | Subinterpreter khác thread và process ở đâu? · Chia sẻ dữ liệu giữa interpreter thế nào? | [PEP 734](https://peps.python.org/pep-0734/) · [concurrent.interpreters](https://docs.python.org/3/library/concurrent.interpreters.html) |
| P1 | `py-packaging-env` | venv, pip, uv & pyproject.toml | Môi trường ảo, `pyproject.toml`, lock file (`pylock.toml`), externally-managed environment, script có khai báo phụ thuộc | Python › Đóng gói & kiểm thử | `py-import-system` | Vì sao không `pip install` vào Python hệ thống? · Lock file giải bài gì? · Khác nhau giữa dependency trong `pyproject.toml` và lock file? | [venv](https://docs.python.org/3/library/venv.html) · [Writing pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) · [PEP 668](https://peps.python.org/pep-0668/) · [PEP 751](https://peps.python.org/pep-0751/) · [uv](https://docs.astral.sh/uv/) |
| P0 | `py-pytest` | Testing with pytest | Fixture và scope, `parametrize`, `monkeypatch`, `unittest.mock.patch` (patch chỗ dùng, không phải chỗ định nghĩa), test async | Python › Đóng gói & kiểm thử | `code-testing-fundamentals`, `py-decorators` | Fixture scope `session` dùng khi nào, rủi ro gì? · Patch `requests.get` sai chỗ thì sao? · Test hàm gọi `datetime.now()`? | [pytest](https://docs.pytest.org/en/stable/) · [pytest fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) · [unittest.mock](https://docs.python.org/3/library/unittest.mock.html) |
| P2 | `py-code-quality` | Linters, Formatters & CI | PEP 8, ruff, mypy trong CI, pre-commit — giữ codebase Python nhất quán | Python › Đóng gói & kiểm thử | `py-typing`, `py-pytest` | Lint và type check chạy ở đâu trong pipeline? · Bật mypy cho codebase cũ từng bước thế nào? | [PEP 8](https://peps.python.org/pep-0008/) · [Ruff](https://docs.astral.sh/ruff/) · [mypy](https://mypy.readthedocs.io/en/stable/) |
| P1 | `py-profiling` | Profiling & Benchmarking | Đo trước khi tối ưu: `timeit`, `cProfile`, `tracemalloc`, sampling profiler (`profiling` từ 3.15), `perf` | Python › Hiệu năng | `code-complexity-perf`, `py-builtin-types-complexity` | API chậm — bạn đo bằng gì trước? · Deterministic profiler khác sampling profiler? · Đo bộ nhớ của một hàm? | [profile](https://docs.python.org/3/library/profile.html) · [timeit](https://docs.python.org/3/library/timeit.html) · [PEP 799](https://peps.python.org/pep-0799/) · [perf profiling HOWTO](https://docs.python.org/3/howto/perf_profiling.html) |
| P1 | `py-performance` | Making Python Fast | Thuật toán trước; builtin và thư viện C; NumPy vectorize; khi nào xuống C/Cython/Rust (PyO3); multiprocessing hoặc free-threading | Python › Hiệu năng | `py-profiling` | Vòng lặp Python 10⁸ phép tính — làm sao nhanh hơn? · Vì sao NumPy nhanh? · Khi nào viết extension bằng Rust? | [NumPy docs](https://numpy.org/doc/stable/) · [Cython](https://cython.readthedocs.io/en/latest/) · [PyO3](https://pyo3.rs/) |
| P0 | `py-wsgi-asgi` | WSGI, ASGI & Worker Models | WSGI đồng bộ vs ASGI bất đồng bộ; app server (Gunicorn, Uvicorn); số process × thread × event loop | Python › Python cho backend | `py-asyncio`, `py-threading-multiprocessing` | Gunicorn nên chạy bao nhiêu worker? · WSGI phục vụ WebSocket được không? · Một worker ASGI bị CPU-bound thì sao? | [PEP 3333 (WSGI)](https://peps.python.org/pep-3333/) · [ASGI spec](https://asgi.readthedocs.io/en/latest/) · [Gunicorn](https://gunicorn.org/) |
| P0 | `py-fastapi` | FastAPI in Depth | `async def` vs `def` (threadpool), `Depends` (DI), validate bằng Pydantic, lifespan, giới hạn của background task | Python › Python cho backend | `py-wsgi-asgi`, `py-decorators` | Endpoint `async def` gọi driver DB đồng bộ thì sao? · `Depends` chạy khi nào, cache thế nào? · Background task mất khi process restart — dùng gì thay? | [FastAPI: Concurrency and async/await](https://fastapi.tiangolo.com/async/) · [Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) · [Lifespan events](https://fastapi.tiangolo.com/advanced/events/) |
| P1 | `py-django` | Django ORM & Request Lifecycle | Middleware, QuerySet lười, N+1 và `select_related`/`prefetch_related`, `transaction.atomic`, migration, hỗ trợ async | Python › Python cho backend | `py-wsgi-asgi`, `indexing`, `db-isolation-anomalies` | Trang danh sách chạy 101 query — sửa thế nào? · `select_related` khác `prefetch_related`? · `atomic` lồng nhau hoạt động ra sao? | [Django: DB optimization](https://docs.djangoproject.com/en/stable/topics/db/optimization/) · [Transactions](https://docs.djangoproject.com/en/stable/topics/db/transactions/) · [Middleware](https://docs.djangoproject.com/en/stable/topics/http/middleware/) · [Async support](https://docs.djangoproject.com/en/stable/topics/async/) |
| P1 | `py-sqlalchemy` | SQLAlchemy: Session & Pooling | Session và unit of work, vòng đời session theo request, connection pool, lazy loading, async engine | Python › Python cho backend | `core-db`, `py-context-managers`, `io-connection-pool` | Session nên sống bao lâu? · Pool hết connection biểu hiện thế nào? · Lazy load trong async gây lỗi gì? | [SQLAlchemy: Session basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html) · [Connection pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) |
| P1 | `py-task-queues` | Celery & Background Tasks | Worker, broker, `acks_late`, retry, task idempotent, visibility timeout, theo dõi task | Python › Python cho backend | `queue`, `idempotency` | Worker chết giữa task thì task có chạy lại không? · Vì sao task phải idempotent? · Truyền object ORM vào task gây gì? | [Celery: Tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html) · [Celery docs](https://docs.celeryq.dev/en/stable/) |
| P2 | `py-whats-new` | What's New: Python 3.12–3.15 | Điểm mới hay bị hỏi: cú pháp generic (3.12), free-threaded build và JIT (3.13), t-string và annotation lười (3.14), `lazy` import, `frozendict` (3.15) | Python › Python cho backend | `py-typing`, `thr-gil` | Free-threaded build đã "supported" chưa? · t-string khác f-string ở đâu? · Bạn đang dùng bản Python nào và vì sao? | [What's New 3.14](https://docs.python.org/3/whatsnew/3.14.html) · [What's New 3.15](https://docs.python.org/3/whatsnew/3.15.html) · [PEP 750](https://peps.python.org/pep-0750/) · [PEP 814](https://peps.python.org/pep-0814/) |

`thr-gil` (đã lên kế hoạch, giữ id) — bổ sung nội dung khi viết, theo [Free-threading HOWTO](https://docs.python.org/3/howto/free-threading-python.html), [PEP 703](https://peps.python.org/pep-0703/) và [PEP 779](https://peps.python.org/pep-0779/):

- Build free-threaded có từ 3.13 ở dạng thử nghiệm (phase I). Từ 3.14 được hỗ trợ chính thức nhưng vẫn là tuỳ chọn (phase II). Chưa phải mặc định.
- Kiểm tra bằng `sys._is_gil_enabled()`. GIL có thể tự bật lại khi import C extension chưa khai báo an toàn.
- Code đơn luồng chậm hơn một chút và tốn bộ nhớ hơn.
- Vẫn cần `threading.Lock`; không dựa vào khoá nội bộ của `dict`/`list`.

`needs` của `thr-gil` giữ như §7.3 (`thr-io-vs-cpu-bound`). Đây là tiên quyết xuyên nhánh, chỉ để hiển thị.

---

## 5. Tổng hợp và đợt viết

### 5.1 Số đề xuất

| Phần | P0 | P1 | P2 | Tổng |
|---|---|---|---|---|
| §2 Lộ trình chính + nhánh Vận hành | 4 | 18 | 14 | 36 |
| §3 Nền tảng CS mở rộng | 2 | 4 | 8 | 14 |
| §4 Nhánh Python | 14 | 17 | 4 | 35 |
| **Tổng** | **20** | **39** | **26** | **85** |

(§2 gồm 34 topic lộ trình chính + 2 topic nhánh Vận hành; §3 gồm cả `dist-failure-models` đặt ở GĐ2 Đào sâu.)

Cây sau khi gộp: 171 topic (§7 cũ) + 85 = **256 topic**. Không đổi id nào đã có; `thr-gil` chỉ đổi chỗ trong cây.

### 5.2 Chặng/giai đoạn mới (chỉ thêm vào `roadmap.js` cùng topic đầu tiên)

| Id đề xuất | Tiêu đề | Thuộc | Topic đầu tiên nên viết |
|---|---|---|---|
| giai đoạn `svc` | Hệ thống nhiều service | lộ trình chính, sau `s3` | `sync-vs-async-comm` |
| `svc.split`, `svc.comm`, `svc.data`, `svc.ops` | Tách service · Giao tiếp giữa service · Dữ liệu giữa các service · Kiểm thử & cấu hình | `svc` | `service-decomposition`, `sync-vs-async-comm`, `event-driven-architecture`, `contract-testing` |
| `s2.tech-deep` | Đào sâu: công nghệ (`optional`) | `s2` | `dynamodb` |
| `s3.tech-deep` | Đào sâu: công nghệ (`optional`) | `s3` | `temporal` |
| `s4.tech-deep`, `s4.bigdata`, `s4.ml` | Đào sâu: công nghệ · dữ liệu lớn · ML & LLM (`optional`) | `s4` | `elasticsearch`, `batch-processing`, `llm-app-architecture` |
| `cs.arch`, `cs.lang`, `cs.security` | Kiến trúc máy tính · Ngôn ngữ & trình thông dịch · Bảo mật & mật mã | `cs`, sau `cs.net` | `hw-numbers-float`, `pl-compile-vs-interpret`, `sec-crypto-primitives` |
| `ops.security` | Bảo mật vận hành | `ops` | `secrets-management` |
| nhánh `py` + 8 chặng `py.core`, `py.interview`, `py.oop`, `py.runtime`, `py.concurrency`, `py.tooling`, `py.perf`, `py.backend` | Python | song song, sau `code` | `py-object-model` |

Tên chặng Đào sâu đã có trong §7.2 cũ (`Đào sâu: bên trong database`, `Đào sâu: phân tán`, `Đào sâu: xử lý luồng`) giữ nguyên.

### 5.3 Gộp vào các đợt viết của `product-learning-flow.md` §8

Quy tắc: P0 mới vào **đợt 2**, P1 vào **đợt 3**, P2 vào **đợt 4** (D119). Riêng P0 Python đứng đầu phần bổ sung của đợt 2, vì đó là ngôn ngữ chính của người học và không phụ thuộc topic SD nào.

**Đợt 2 (+20, thành 62).** Thứ tự viết gợi ý (tiên quyết trước):

1. Python cốt lõi: `py-object-model` → `py-builtin-types-complexity` → `py-data-model` → `py-scope-closures` → `py-iterators-generators` → `py-decorators` → `py-context-managers` → `py-pitfalls`.
2. Python runtime và concurrency: `py-memory-gc`, `thr-gil` (đã có trong đợt 2) → `py-threading-multiprocessing`. Sau `async-event-loop` và `async-coroutine` (đợt 2): `py-asyncio`.
3. Python backend: `py-wsgi-asgi` → `py-fastapi`. `py-pytest` sau `code-testing-fundamentals`.
4. Lộ trình chính: `rate-limiting`, `sync-vs-async-comm` → `service-discovery` → `api-gateway-bff` (`api-gateway-bff` cần `auth`, cũng ở đợt 2).
5. CS: `hw-numbers-float`, `sec-crypto-primitives`.

**Đợt 3 (+39).** Gồm:

- **Lộ trình chính:** `nosql-data-modeling`, `postgresql`, `linearizability`, `dynamodb`, `cassandra`, `distributed-transactions`, `service-decomposition`, `strangler-fig`, `service-mesh`, `event-driven-architecture`, `cqrs`, `contract-testing`, `olap-columnar`, `time-series-db`, `elasticsearch`, `batch-processing`, `llm-app-architecture`, `secrets-management`.
- **CS:** `hw-text-encoding`, `pl-compile-vs-interpret`, `pl-parsing-ast`, `sec-web-attacks`.
- **Python:** `py-coding-stdlib`, `py-exceptions`, `py-idioms`, `py-classes-mro`, `py-descriptors-properties`, `py-dataclasses`, `py-abc-protocols`, `py-typing`, `py-cpython-execution`, `py-import-system`, `py-asyncio-pitfalls`, `py-packaging-env`, `py-profiling`, `py-performance`, `py-django`, `py-sqlalchemy`, `py-task-queues`.

**Đợt 4 (+26).** Các P2 còn lại.

Phụ thuộc chéo đợt: script đã kiểm, không topic nào `needs` một topic ở đợt sau. Những cặp cùng đợt cần viết đúng thứ tự:

- `py-sqlalchemy` sau `io-connection-pool` (cả hai đợt 3).
- `py-typing` sau `py-abc-protocols` và `py-dataclasses` (cả ba đợt 3).

Về thứ tự trong cây (không phải đợt): `zookeeper-etcd` ở GĐ2 Đào sâu nhưng cần `consensus` ở GĐ3 (xem D117). `py-coding-stdlib` hạ xuống P1 vì `code-language-choice` đã có phần Python cơ bản (`heapq` là min-heap, `list.pop(0)`, `bisect`).

### 5.4 Top 15 P0 (thứ tự đề xuất viết)

| # | id | Tiêu đề | Vì sao trước |
|---|---|---|---|
| 1 | `py-object-model` | Names, Objects & Mutability | gốc của mọi bài Python; câu hỏi mở màn hay gặp |
| 2 | `py-pitfalls` | Python Gotchas | câu hỏi "bẫy" phổ biến nhất ở vòng Python |
| 3 | `py-builtin-types-complexity` | list, dict, set: Internals & Big-O | dùng ngay trong vòng coding |
| 4 | `py-data-model` | Data Model & Dunder Methods | nền cho iterator, context manager và OOP kiểu Python |
| 5 | `py-iterators-generators` | Iterators & Generators | nền cho context manager, asyncio |
| 6 | `py-decorators` | Decorators | rất hay bị yêu cầu viết tại chỗ |
| 7 | `py-asyncio` | asyncio: Event Loop, Task, TaskGroup | nền cho FastAPI, ASGI |
| 8 | `py-memory-gc` | Reference Counting & GC | câu hỏi CPython kinh điển |
| 9 | `py-threading-multiprocessing` | threading, multiprocessing, futures | đi cặp với `thr-gil` |
| 10 | `py-wsgi-asgi` | WSGI, ASGI & Worker Models | nối Python với System Design (scale worker) |
| 11 | `py-fastapi` | FastAPI in Depth | framework backend phỏng vấn hay hỏi |
| 12 | `sync-vs-async-comm` | Sync vs Async Communication | mở giai đoạn `svc`, nền cho 4 topic khác |
| 13 | `rate-limiting` | Rate Limiting | site đã có problem + sim nhưng chưa có bài khái niệm |
| 14 | `api-gateway-bff` | API Gateway, BFF & API Composition | pattern microservices hay bị hỏi nhất sau saga |
| 15 | `hw-numbers-float` | Integer, Float & Decimal | câu hỏi "lưu tiền bằng kiểu gì" xuất hiện ở mọi bài payment |

Năm P0 còn lại cũng ở đợt 2: `py-scope-closures`, `py-context-managers` (viết liền với nhóm 1–6), `py-pytest`, `service-discovery`, `sec-crypto-primitives`.

### 5.5 Quyết định (D110–D119)

Xem `docs/decisions.md`. Tóm tắt:

| # | Quyết định |
|---|---|
| D110 | Python là nhánh song song `py`, không phải giai đoạn |
| D111 | Giai đoạn mới `svc` "Hệ thống nhiều service" trên lộ trình chính, sau `s3` |
| D112 | `thr-gil` chuyển từ Nền tảng CS sang nhánh Python, giữ id; ranh giới CS ↔ Python |
| D113 | Saga, event sourcing, tracing, quorum, hot key: mở rộng topic có sẵn, không id mới |
| D114 | Ba chặng CS mới; tiền tố `hw-`/`pl-`/`sec-`; lý thuyết phân tán vào GĐ2 Đào sâu |
| D115 | Data engineering, ML/LLM là chặng Đào sâu của GĐ4, không thành nhánh |
| D116 | Mảng CS loại khỏi phạm vi |
| D117 | Id deep dive công nghệ theo tên sản phẩm; chặng `Đào sâu: công nghệ` |
| D118 | "microservice.com" không xác minh được; dùng microservices.io |
| D119 | Tiêu chí P0/P1/P2 và cách gộp vào đợt 2–4 |
