/*
 * Nội dung ôn tập — hệ thống hoá từ Miro board "Backend" (mindmap "CS", 512 node)
 * theo khung Hello Interview: System Design in a Hurry · Low-Level Design in a Hurry · Coding.
 *
 * Quy ước trong mảng `points`:
 *   "..."    nội dung lấy từ Miro (đã sửa chính tả, gom gọn)
 *   "+ ..."  bổ sung — nhánh trên Miro đang trống hoặc thiếu ý quan trọng khi phỏng vấn
 *   "! ..."  đính chính — chỗ trên Miro dễ gây hiểu sai
 * Inline: **đậm**, `code`.
 */
window.TRACKS = [
  {
    "id": "sd",
    "title": "System Design",
    "subtitle": "Hello Interview · System Design in a Hurry",
    "sections": [
      {
        "id": "sd-framework",
        "title": "1 · Delivery Framework",
        "topics": [
          {
            "id": "delivery",
            "title": "Khung trả lời 6 bước",
            "tldr": "Đi theo thứ tự cố định để không lạc đề: Requirements → Core Entities → API → (Data Flow) → High-Level Design → Deep Dives. HLD giải quyết functional, Deep Dives giải quyết non-functional.",
            "table": {
              "head": [
                "Bước",
                "Mục tiêu",
                "Thời gian",
                "Output trên bảng"
              ],
              "rows": [
                [
                  "1 · Requirements",
                  "Chốt functional + non-functional",
                  "~5 phút",
                  "3–5 FR dạng “User có thể…”, 3–5 NFR có con số"
                ],
                [
                  "2 · Core Entities",
                  "Liệt kê danh từ chính của hệ thống",
                  "~2 phút",
                  "User, Event, Ticket, Booking…"
                ],
                [
                  "3 · API / System Interface",
                  "Hợp đồng giữa client và hệ thống",
                  "~5 phút",
                  "Endpoint REST / RPC / GraphQL cho từng FR"
                ],
                [
                  "4 · Data Flow (optional)",
                  "Chỉ dùng cho hệ thống dạng pipeline",
                  "~5 phút",
                  "Chuỗi bước xử lý dữ liệu"
                ],
                [
                  "5 · High-Level Design",
                  "Vẽ kiến trúc thoả mãn từng FR",
                  "~10–15 phút",
                  "Client → LB/Gateway → Service → DB/Cache"
                ],
                [
                  "6 · Deep Dives",
                  "Đáp ứng NFR, xử lý bottleneck",
                  "~10 phút",
                  "Scale, consistency, failure, edge cases"
                ]
              ]
            },
            "points": [
              "**Functional Requirements** — hệ thống phải làm gì (“User có thể đặt vé”).",
              "**Non-functional Requirements** — CAP Theorem, Environment Constraints, Scalability, Latency, Durability, Security, Fault Tolerance, Compliance.",
              "**HLD** — vẽ design tập trung giải quyết functional requirements, chưa tối ưu vội.",
              "**Deep Dives** — giải quyết các vấn đề liên quan tới non-functional requirements.",
              "+ **Capacity Estimation** — chỉ tính khi con số **thay đổi thiết kế** (ví dụ: 400k write/s → không dùng Postgres; 500GB → một DB là đủ). Nói “tôi sẽ ước lượng khi cần ở phần deep dive” thay vì tính QPS dài dòng ngay đầu.",
              "+ NFR phải **có con số** và **có ngữ cảnh**: “search latency < 500ms”, “10M DAU”, “strong consistency khi đặt vé, eventual cho xem danh sách”.",
              "+ Bước API: mỗi FR map ra ít nhất một endpoint; lấy user từ auth header/JWT, không truyền `userId` trong body.",
              "+ Senior/Staff: interviewer kỳ vọng bạn **tự dẫn** phần Deep Dives (tự nêu bottleneck), không chờ interviewer hỏi."
            ],
            "tips": [
              "Chốt FR/NFR trước rồi mới vẽ kiến trúc — nhảy vào vẽ sớm là lỗi bị trừ điểm phổ biến nhất.",
              "Giữ HLD đơn giản trước, ghi chú “sẽ quay lại ở deep dive” cho các điểm nóng."
            ],
            "cards": [
              [
                "Thứ tự 6 bước của Delivery Framework?",
                "Requirements → Core Entities → API → (Data Flow, optional) → High-Level Design → Deep Dives."
              ],
              [
                "HLD giải quyết loại requirement nào? Deep Dives giải quyết loại nào?",
                "HLD: functional requirements. Deep Dives: non-functional requirements (scale, latency, consistency, fault tolerance…)."
              ],
              [
                "Khi nào nên làm capacity estimation?",
                "Khi kết quả ảnh hưởng quyết định thiết kế (có cần shard, cache, chọn DB nào). Nếu không, nói sẽ ước lượng lúc deep dive để tiết kiệm thời gian."
              ],
              [
                "Kể 8 nhóm Non-functional Requirement thường gặp.",
                "CAP (consistency vs availability), Environment Constraints, Scalability, Latency, Durability, Security, Fault Tolerance, Compliance."
              ]
            ]
          }
        ]
      },
      {
        "id": "sd-core",
        "title": "2 · Core Concepts",
        "topics": [
          {
            "id": "networking",
            "title": "Networking Essentials",
            "tldr": "Nắm 3 tầng quan trọng (L3 IP, L4 TCP/UDP, L7 HTTP/WebSocket/gRPC), DNS, và khác biệt L4 vs L7 load balancing.",
            "table": {
              "head": [
                "Tầng",
                "Giao thức",
                "Việc chính"
              ],
              "rows": [
                [
                  "Layer 3 · Network",
                  "IP",
                  "Tìm đường chuyển gói tin giữa các máy dựa vào địa chỉ IP"
                ],
                [
                  "Layer 4 · Transport",
                  "TCP / UDP",
                  "Xác định gói tin thuộc ứng dụng (port) nào trên máy đích"
                ],
                [
                  "Layer 7 · Application",
                  "HTTP, WebSocket, gRPC",
                  "Ngữ nghĩa ứng dụng: URL, header, cookie, payload"
                ]
              ]
            },
            "points": [
              "**IP Addressing** — mỗi thiết bị có IP duy nhất trong mạng của nó (chỉ public IP là duy nhất toàn cầu); phân biệt **Public Subnet** và **Private Subnet** (DB, service nội bộ nằm private).",
              "**DNS** — “danh bạ” đổi tên miền (google.com) thành IP; còn dùng cho **Geo-routing** (trả IP gần người dùng).",
              "**Ports** — 22 SSH, 80 HTTP, 443 HTTPS (đều TCP).",
              "**TCP** — bắt tay 3 bước, đánh số thứ tự, ACK, mất gói thì gửi lại → tin cậy, có thứ tự.",
              "**UDP** — “fire and forget”: không ACK, không sắp xếp lại → nhanh, hợp video call, game, live streaming.",
              "**HTTP/HTTPS** — request/response trên TCP, stateless; muốn dữ liệu mới phải gửi request mới.",
              "**WebSockets** — bắt tay một lần rồi giữ kết nối 2 chiều liên tục.",
              "**gRPC** — chạy trên HTTP/2, payload nhị phân Protocol Buffers, gọi hàm từ xa như gọi hàm nội bộ.",
              "+ **SSE (Server-Sent Events)** — HTTP thường nhưng server giữ response mở để đẩy event 1 chiều; tự reconnect.",
              "+ **Long polling** — client gửi request, server giữ đến khi có dữ liệu; đơn giản nhất, tốn kết nối."
            ],
            "tips": [
              "Mặc định chọn HTTP/REST cho client-facing; gRPC cho service-to-service; WebSocket/SSE chỉ khi có yêu cầu realtime."
            ],
            "cards": [
              [
                "TCP khác UDP thế nào? Khi nào chọn UDP?",
                "TCP: 3-way handshake, có thứ tự, ACK + retransmit → tin cậy. UDP: không ACK, không thứ tự → nhanh. Chọn UDP khi mất vài gói chấp nhận được: video call, game, live stream."
              ],
              [
                "L4 Load Balancer (NLB) khác L7 (ALB) ra sao?",
                "NLB chỉ đọc IP + port, không mở gói tin → cực nhanh, hàng triệu kết nối. ALB đọc HTTP (URL, header, cookie) → định tuyến thông minh theo path/host, tốn CPU hơn."
              ],
              [
                "DNS dùng gì trong system design ngoài phân giải tên?",
                "Geo-routing / latency-based routing: trả về IP của region gần người dùng; cũng dùng cho failover giữa region."
              ]
            ]
          },
          {
            "id": "api-design",
            "title": "API Design",
            "tldr": "REST là mặc định. GraphQL khi nhiều loại client cần dữ liệu khác nhau. RPC (gRPC) cho service-to-service cần hiệu năng, type safety, streaming.",
            "table": {
              "head": [
                "Kiểu",
                "Chọn khi",
                "Điểm yếu"
              ],
              "rows": [
                [
                  "REST",
                  "Mặc định cho public / client-facing API",
                  "Over-/under-fetching, nhiều round-trip"
                ],
                [
                  "GraphQL",
                  "Nhiều client (web, mobile) cần shape dữ liệu khác nhau",
                  "N+1 query, caching khó, phức tạp phía server"
                ],
                [
                  "RPC / gRPC",
                  "Service-to-service, cần performance, type safety, streaming",
                  "Khó debug bằng tay, browser hỗ trợ kém"
                ]
              ]
            },
            "points": [
              "**REST bước 1 · Resource Modeling** — xác định resource (danh từ số nhiều): `/events`, `/events/{id}/bookings`.",
              "**REST bước 2 · HTTP Methods** — GET, POST, PUT, PATCH, DELETE.",
              "**REST bước 3 · Passing Data** — path param `/events/123` (định danh), query param `/events?city=NYC&date=2024-01-01` (lọc), request body (dữ liệu tạo/sửa).",
              "**REST bước 4 · Returning Data** — status code + response body.",
              "**GraphQL · N+1 problem** — GraphQL không biết trước client chọn field nào nên không JOIN sẵn được như REST. Giải pháp: **DataLoader** gom các `venue_id` trong vài ms thành một query `WHERE id IN (...)`.",
              "**RPC** — binary serialization + HTTP/2 nhanh hơn JSON REST đáng kể; generated client tránh lỗi runtime; hỗ trợ bidirectional streaming.",
              "**Pagination** — offset-based (`?offset=20&limit=10`) đơn giản nhưng chậm khi offset lớn và lệch khi dữ liệu chèn thêm; cursor-based (`?cursor=<id>&limit=10`) ổn định, hợp infinite scroll.",
              "**Versioning** — URL versioning `/v1/events` (phổ biến, dễ thấy) hoặc Header `Accept-Version: v2`.",
              "**Security · AuthN/AuthZ** — API Key cho service nội bộ / developer bên ngoài; JWT cho session (web: **HttpOnly cookie** + SameSite chống CSRF; mobile: Keychain/Keystore); RBAC để phân quyền.",
              "**Security · Rate limiting** — theo user, theo IP, theo endpoint.",
              "+ **Idempotency** — POST tạo đơn/thanh toán nên nhận `Idempotency-Key` để retry an toàn.",
              "+ Status code cần nhớ: 200, 201 Created, 204, 400, 401 (chưa xác thực), 403 (không có quyền), 404, 409 Conflict, 429 Too Many Requests, 500, 503."
            ],
            "tips": [
              "Không đưa `userId` vào body/path cho hành động của chính user — lấy từ token.",
              "Nói rõ vì sao chọn cursor pagination khi feed có dữ liệu mới liên tục."
            ],
            "cards": [
              [
                "GraphQL N+1 problem là gì và giải thế nào?",
                "Mỗi resolver con gọi DB riêng → 1 query cha + N query con. Giải bằng DataLoader: batch + cache các key trong một tick rồi chạy 1 query `WHERE id IN (...)`."
              ],
              [
                "Offset vs cursor pagination?",
                "Offset: đơn giản, nhảy trang được, nhưng chậm ở offset lớn và trùng/sót khi dữ liệu thay đổi. Cursor: ổn định, nhanh nhờ index, hợp feed/infinite scroll; không nhảy trang tuỳ ý."
              ],
              [
                "Khi nào chọn gRPC thay REST?",
                "Service-to-service nội bộ, cần hiệu năng (binary + HTTP/2), type safety qua generated client, hoặc cần streaming 2 chiều."
              ],
              [
                "Lưu JWT ở đâu trên web? Vì sao?",
                "HttpOnly (+ Secure, SameSite) cookie — JavaScript không đọc được nên giảm rủi ro XSS đánh cắp token."
              ]
            ]
          },
          {
            "id": "data-modeling",
            "title": "Data Modeling",
            "tldr": "6 bước: chọn loại DB → liệt kê cột theo FR → PK/FK → index theo access pattern → cân nhắc denormalize → cân nhắc sharding và shard key.",
            "points": [
              "**1 · Chọn loại database** — Relational (SQL), Document, Key-Value, Graph.",
              "**2 · Liệt kê cột** cần cho từng entity để thoả FR.",
              "**3 · Primary key & foreign key** cho từng quan hệ.",
              "**4 · Cột nào cần index** — dựa vào query thực tế.",
              "**5 · Có cần denormalize** để tăng hiệu năng đọc không.",
              "**6 · Có cần sharding** — nếu có, chọn shard key khớp access pattern chính.",
              "**Relational DB** — bảng có schema cố định, quan hệ qua foreign key, transaction ACID.",
              "+ Mặc định chọn **PostgreSQL** nếu không có lý do đặc biệt; chỉ đổi sang NoSQL khi nêu được lý do (write throughput cực cao, schema linh hoạt, access pattern key-value đơn giản)."
            ],
            "cards": [
              [
                "6 bước Data Modeling?",
                "1) Chọn loại DB 2) Cột theo FR 3) PK/FK 4) Index 5) Denormalize? 6) Sharding? + chọn shard key theo access pattern chính."
              ],
              [
                "Khi nào denormalize?",
                "Khi đường đọc nóng cần tránh JOIN đắt (feed, dashboard), chấp nhận chi phí ghi trùng và giữ đồng bộ."
              ]
            ]
          },
          {
            "id": "indexing",
            "title": "Database Indexing",
            "tldr": "B-Tree là mặc định (range + equality). Hash index chỉ cho equality. Composite index theo quy tắc leftmost prefix. Mỗi bảng chỉ có 1 clustered index.",
            "table": {
              "head": [
                "Loại",
                "Đặc điểm",
                "Ví dụ"
              ],
              "rows": [
                [
                  "B-Tree",
                  "Mặc định ở MySQL InnoDB, PostgreSQL, SQL Server, Oracle; hỗ trợ range, sort",
                  "`WHERE created_at > ...`"
                ],
                [
                  "Hash",
                  "Chỉ equality, dùng cho in-memory engine, `USING HASH` (PostgreSQL)",
                  "`WHERE session_id = ?`"
                ],
                [
                  "Clustered",
                  "Dữ liệu và index là một; tạo tự động trên Primary Key; 1 bảng chỉ có 1 (InnoDB, SQL Server — PostgreSQL không có)",
                  "PK `id`"
                ],
                [
                  "Non-clustered",
                  "Cấu trúc riêng trỏ về dòng dữ liệu",
                  "`CREATE INDEX idx_bophan ON NhanVien(BoPhan)`"
                ],
                [
                  "Unique",
                  "Cấm trùng giá trị",
                  "`CREATE UNIQUE INDEX uq_socccd ON NhanVien(SoCCCD)`"
                ],
                [
                  "Composite",
                  "Nhiều cột, theo thứ tự khai báo",
                  "`CREATE INDEX idx_ho_ten ON NhanVien(Ho, Ten)`"
                ]
              ]
            },
            "points": [
              "+ **Leftmost prefix** — index `(Ho, Ten)` dùng được cho `WHERE Ho=?` và `WHERE Ho=? AND Ten=?`, thường không dùng được cho `WHERE Ten=?` một mình (trừ engine có skip scan).",
              "+ **Trade-off** — index tăng tốc đọc nhưng làm chậm ghi và tốn dung lượng.",
              "+ Index đặc biệt: **Geospatial** (PostGIS, Geohash, Quadtree), **Inverted index** (full-text search)."
            ],
            "cards": [
              [
                "Vì sao một bảng chỉ có 1 clustered index?",
                "Clustered index quyết định thứ tự vật lý của dữ liệu trên đĩa, mà dữ liệu chỉ sắp được theo một thứ tự."
              ],
              [
                "Index (Ho, Ten) có giúp query `WHERE Ten = 'An'` không?",
                "Không — vi phạm leftmost prefix. Cần index riêng trên Ten hoặc đổi thứ tự cột."
              ],
              [
                "B-Tree vs Hash index?",
                "B-Tree: equality + range + ORDER BY, là mặc định. Hash: chỉ equality, O(1) nhưng không range."
              ]
            ]
          },
          {
            "id": "caching",
            "title": "Caching",
            "tldr": "Cache ở 4 chỗ (client, CDN, in-process, external như Redis). Chọn write strategy, invalidation, eviction. Thuộc lòng 3 sự cố: hot key, consistency, stampede.",
            "table": {
              "head": [
                "Write strategy",
                "Cách làm",
                "Ưu",
                "Nhược"
              ],
              "rows": [
                [
                  "Write-Through",
                  "Ghi cache, cache ghi DB thành công rồi mới trả lời",
                  "Cache gần như luôn khớp DB",
                  "Ghi chậm hơn"
                ],
                [
                  "Write-Around",
                  "Ghi thẳng DB, bỏ qua cache; kết hợp invalidation hoặc TTL ngắn",
                  "Không làm bẩn cache bằng dữ liệu ít đọc",
                  "Lần đọc đầu bị cache miss"
                ],
                [
                  "Write-Back",
                  "Ghi cache rồi trả lời ngay; tiến trình nền ghi DB sau",
                  "Ghi cực nhanh",
                  "Mất dữ liệu nếu cache sập trước khi flush"
                ]
              ]
            },
            "points": [
              "**Where to cache** — Client-side (LocalStorage, Cache API), CDN (edge server giữa user và origin), In-process (RAM của chính app), External (Redis, Memcached).",
              "**Eviction** — LRU (xoá mục lâu nhất chưa dùng, phổ biến nhất), LFU (xoá mục ít lượt truy cập nhất), FIFO (xoá theo thứ tự nạp vào).",
              "**Invalidation** — đảm bảo cache khớp DB, tránh stale data.",
              "**Hot keys** — replicate key nóng lên nhiều node rồi load balance đọc; rate limit traffic bất thường.",
              "**Cache consistency** — xoá cache sau khi update DB; TTL ngắn nếu chấp nhận stale; chấp nhận eventual consistency cho feed, metrics.",
              "**Cache stampede (thundering herd)** — **request coalescing / single flight**: chỉ một request rebuild cache, các request khác chờ kết quả.",
              "+ **Cache-aside (lazy loading)** — pattern đọc mặc định: đọc cache → miss thì đọc DB → ghi vào cache với TTL.",
              "+ Stampede còn giải bằng **TTL jitter** (ngẫu nhiên hoá TTL) và **refresh trước khi hết hạn**."
            ],
            "tips": [
              "Luôn nói cache **cái gì**, **key** là gì, **TTL** bao lâu, và **invalidate khi nào**."
            ],
            "cards": [
              [
                "So sánh Write-Through, Write-Around, Write-Back.",
                "Through: ghi cả hai đồng bộ, nhất quán, chậm ghi. Around: ghi DB, bỏ qua cache, miss lần đầu. Back: ghi cache rồi flush DB bất đồng bộ, nhanh nhất nhưng có thể mất dữ liệu."
              ],
              [
                "Cache stampede là gì? Cách chống hiệu quả nhất?",
                "Key nóng hết hạn → hàng nghìn request cùng miss và đập vào DB. Chống bằng request coalescing (single flight); thêm TTL jitter, refresh sớm."
              ],
              [
                "Xử lý hot key trong cache thế nào?",
                "Replicate key lên nhiều node + load balance đọc, local/in-process cache, key salting, rate limit."
              ],
              [
                "LRU vs LFU vs FIFO?",
                "LRU xoá mục lâu nhất chưa dùng; LFU xoá mục ít truy cập nhất (có counter); FIFO xoá theo thứ tự nạp, bất kể độ hot."
              ]
            ]
          },
          {
            "id": "sharding",
            "title": "Sharding & Partitioning",
            "tldr": "Partitioning chia dữ liệu trong một máy; sharding chia ra nhiều máy. Hash-based là mặc định. Shard key phải khớp access pattern chính.",
            "table": {
              "head": [
                "Chiến lược",
                "Cách chia",
                "Ưu",
                "Nhược"
              ],
              "rows": [
                [
                  "Hash-based (mặc định)",
                  "`hash(user_id) % N`",
                  "Phân bố đều",
                  "Range query khó; đổi N phải di chuyển nhiều dữ liệu (→ consistent hashing)"
                ],
                [
                  "Range-based",
                  "Theo khoảng giá trị (ID, chữ cái, thời gian)",
                  "Range query nhanh",
                  "Dễ hot spot (dữ liệu mới dồn vào shard cuối)"
                ],
                [
                  "Directory-based",
                  "Bảng lookup trung tâm: key → shard",
                  "Linh hoạt, di chuyển từng key được",
                  "Directory là SPOF và thêm 1 bước tra cứu"
                ]
              ]
            },
            "points": [
              "**Horizontal partitioning** — giữ nguyên cột, chia dòng ra các phân vùng theo điều kiện.",
              "**Vertical partitioning** — giữ nguyên số dòng, tách cột ra bảng khác theo tần suất truy cập / kích thước.",
              "**Challenges** — hot spot & load imbalance, cross-shard operations, giữ consistency.",
              "**Giải hot spot** — tách shard động (dynamic splitting), compound shard key, cô lập hot key sang shard riêng.",
              "! Hash function **không ngẫu nhiên** — cùng input luôn ra cùng output; chỉ là phân bố trông như đều.",
              "+ Cross-shard query/transaction đắt: tránh bằng shard key khiến query phổ biến chỉ chạm 1 shard."
            ],
            "cards": [
              [
                "Horizontal vs vertical partitioning?",
                "Horizontal: chia dòng, giữ cột. Vertical: chia cột, giữ dòng."
              ],
              [
                "3 chiến lược sharding và nhược điểm chính?",
                "Hash: khó range query, resharding đắt. Range: hot spot. Directory: lookup table là SPOF + thêm độ trễ."
              ],
              [
                "Cách xử lý hot spot khi sharding?",
                "Dynamic shard splitting, compound shard key, isolate hot key sang shard riêng, key salting."
              ]
            ]
          },
          {
            "id": "consistent-hashing",
            "title": "Consistent Hashing",
            "tldr": "Đặt server và key lên một hash ring; key thuộc server đầu tiên theo chiều kim đồng hồ. Thêm/bớt server chỉ di chuyển ~1/N key. Production bắt buộc dùng virtual nodes + replication.",
            "points": [
              "**Mục tiêu** — chia dữ liệu ra nhiều server; khi số server thay đổi, phải di chuyển ít dữ liệu nhất.",
              "**Data imbalance → Virtual nodes** — mỗi server map thành hàng trăm virtual node; càng nhiều vnode càng đều. Lý do: băm trực tiếp server vật lý làm các khoảng trên ring không đều.",
              "**Replication** — key nằm ở server đầu tiên và nhân bản sang RF−1 server **vật lý khác nhau** kế tiếp trên ring (bỏ qua vnode cùng máy) → high availability.",
              "**Data movement thực tế** — dữ liệu không “teleport”. Cache: server kế tiếp bị cache miss và phải warm up từ DB. Database (Cassandra, DynamoDB): tiến trình nền copy dữ liệu sang server mới mà không gián đoạn đọc/ghi.",
              "**Hot key** — consistent hashing chia đều **số key** chứ không chia đều **tần suất truy cập**. Key viral (người nổi tiếng) vẫn làm quá tải 1 server → dùng key salting (`hotkey_1`, `hotkey_2`) hoặc local caching."
            ],
            "cards": [
              [
                "Vì sao cần virtual nodes?",
                "Vị trí server vật lý trên ring không đều → server ôm đoạn lớn bị quá tải. Virtual nodes rải mỗi server thành nhiều điểm → phân bố gần đều; khi 1 server chết, tải của nó chia cho nhiều server."
              ],
              [
                "Consistent hashing có giải được hot key không?",
                "Không. Nó cân bằng số key, không cân bằng traffic. Cần key salting, replicate hot key, local cache."
              ],
              [
                "Khi thêm 1 server vào ring N server, bao nhiêu key bị di chuyển?",
                "Khoảng K/N key (chỉ đoạn ring mà server mới nhận), so với gần như toàn bộ khi dùng `hash % N`."
              ]
            ]
          },
          {
            "id": "cap",
            "title": "CAP Theorem & Consistency Models",
            "tldr": "Khi có network partition (luôn phải chấp nhận P), chọn Consistency hoặc Availability. Mặc định chọn Availability; chọn Consistency cho chỗ sai dữ liệu là mất tiền (đặt vé, tồn kho, thanh toán).",
            "table": {
              "head": [
                "Consistency model",
                "Đảm bảo",
                "Ví dụ dùng"
              ],
              "rows": [
                [
                  "Strong",
                  "Mọi lần đọc thấy lần ghi mới nhất",
                  "Số dư, đặt chỗ, tồn kho"
                ],
                [
                  "Causal",
                  "Các thao tác có quan hệ nhân quả được thấy đúng thứ tự",
                  "Comment trả lời phải hiện sau comment gốc"
                ],
                [
                  "Read-your-own-writes",
                  "User luôn thấy dữ liệu chính mình vừa ghi",
                  "Sửa profile xong thấy ngay"
                ],
                [
                  "Eventual",
                  "Sau một lúc mọi replica hội tụ",
                  "Like count, feed, metrics"
                ]
              ]
            },
            "points": [
              "**Partition Tolerance** — hệ phân tán buộc phải chấp nhận mất kết nối mạng → lựa chọn thực tế là C hay A.",
              "+ Có thể chọn **khác nhau theo từng phần** của cùng một hệ thống: Ticketmaster — strong consistency khi đặt vé, availability khi xem sự kiện.",
              "+ **PACELC** mở rộng: khi không có partition (Else) vẫn phải chọn giữa Latency và Consistency."
            ],
            "cards": [
              [
                "Vì sao nói thực tế chỉ chọn giữa C và A?",
                "Network partition chắc chắn xảy ra trong hệ phân tán, nên P là bắt buộc; khi partition xảy ra phải chọn trả lỗi (C) hay trả dữ liệu có thể cũ (A)."
              ],
              [
                "Read-your-own-writes là gì?",
                "User luôn đọc được thay đổi của chính mình (ví dụ đọc từ primary trong vài giây sau khi ghi), dù người khác có thể thấy trễ."
              ]
            ]
          },
          {
            "id": "numbers",
            "title": "Numbers to Know",
            "tldr": "+ Dùng để ước lượng nhanh có cần shard/cache hay không. Nhánh này không có trên Miro — bổ sung vì Hello Interview coi là core concept.",
            "table": {
              "head": [
                "Thành phần",
                "Con số tham khảo"
              ],
              "rows": [
                [
                  "Redis (1 node)",
                  "~100k+ ops/s, latency < 1ms, RAM tới hàng trăm GB"
                ],
                [
                  "PostgreSQL / MySQL (1 node tốt)",
                  "~10k–50k TPS đơn giản, lưu được vài TB"
                ],
                [
                  "Kafka (1 broker)",
                  "~hàng trăm MB/s mỗi broker; cluster scale theo số broker và partition"
                ],
                [
                  "App server",
                  "~vài nghìn đến chục nghìn concurrent request"
                ],
                [
                  "Đọc RAM / SSD / mạng cùng DC",
                  "~100ns / ~100µs / ~0.5ms"
                ],
                [
                  "1 ngày",
                  "~86,400 giây ≈ 10⁵ → 1M req/ngày ≈ 12 req/s"
                ]
              ]
            },
            "points": [
              "+ Đừng shard khi 1 Postgres còn chịu được — phần cứng hiện đại mạnh hơn trực giác nhiều."
            ],
            "cards": [
              [
                "1 triệu request/ngày tương đương bao nhiêu request/giây?",
                "≈ 12 req/s (1M / 86,400). 100M/ngày ≈ 1,200 req/s."
              ]
            ]
          }
        ]
      },
      {
        "id": "sd-tech",
        "title": "3 · Key Technologies",
        "topics": [
          {
            "id": "core-db",
            "title": "Core Database: SQL vs NoSQL",
            "tldr": "SQL cho quan hệ phức tạp + transaction ACID. NoSQL cho scale ngang, schema linh hoạt, big data / realtime.",
            "table": {
              "head": [
                "",
                "Relational (SQL)",
                "NoSQL"
              ],
              "rows": [
                [
                  "Data model",
                  "Bảng, schema cố định, FK",
                  "Key-value, document, column-family, graph"
                ],
                [
                  "Transaction",
                  "ACID",
                  "Thường eventual, một số hỗ trợ strong"
                ],
                [
                  "Scale",
                  "Dọc trước; ngang bằng read replica / sharding",
                  "Ngang tự nhiên qua consistent hashing / sharding"
                ],
                [
                  "Index",
                  "B-Tree, Hash",
                  "Hash table, B-Tree, LSM-Tree"
                ],
                [
                  "Chọn khi",
                  "Quan hệ phức tạp, cần JOIN, cần ACID",
                  "Big data, realtime web app, schema linh hoạt, write cực lớn"
                ]
              ]
            },
            "points": [
              "**ACID — Atomicity** — mọi câu lệnh trong transaction thành công hết, lỗi một câu là rollback toàn bộ.",
              "**ACID — Consistency** — sau transaction dữ liệu vẫn thoả mọi constraint (PK, FK, unique).",
              "**ACID — Isolation** — transaction đồng thời không thấy dữ liệu tạm của nhau.",
              "**ACID — Durability** — commit xong là nằm trên đĩa, mất điện cũng không mất.",
              "**SQL joins** — INNER (chỉ dòng khớp), LEFT/RIGHT (giữ toàn bộ một bên, bên kia NULL), FULL (giữ cả hai), CROSS (tích Descartes).",
              "+ Ví dụ: PostgreSQL / MySQL (SQL); DynamoDB, Cassandra, MongoDB (NoSQL)."
            ],
            "table2Title": "Isolation levels",
            "table2": {
              "head": [
                "Isolation level",
                "Cho phép",
                "Ngăn được",
                "Mặc định ở"
              ],
              "rows": [
                [
                  "Read Uncommitted",
                  "Đọc dữ liệu chưa commit",
                  "—",
                  ""
                ],
                [
                  "Read Committed",
                  "Non-repeatable read, phantom",
                  "Dirty read",
                  "PostgreSQL, Oracle, SQL Server"
                ],
                [
                  "Repeatable Read",
                  "Phantom (theo chuẩn SQL)",
                  "Dirty + non-repeatable read",
                  "MySQL InnoDB"
                ],
                [
                  "Serializable",
                  "—",
                  "Mọi anomaly, chạy như tuần tự",
                  "Hiếm khi mặc định (chậm nhất)"
                ]
              ]
            },
            "cards": [
              [
                "Giải thích ACID trong 4 câu.",
                "A: tất cả hoặc không gì. C: không vi phạm constraint. I: transaction đồng thời không thấy dữ liệu tạm của nhau. D: commit rồi thì bền vững dù mất điện."
              ],
              [
                "4 isolation level từ thấp đến cao? Mặc định PostgreSQL và MySQL?",
                "Read Uncommitted → Read Committed (PostgreSQL) → Repeatable Read (MySQL InnoDB) → Serializable."
              ],
              [
                "LEFT JOIN khác INNER JOIN?",
                "INNER chỉ giữ dòng khớp ở cả hai bảng. LEFT giữ mọi dòng bảng trái, cột bảng phải là NULL nếu không khớp."
              ]
            ]
          },
          {
            "id": "blob",
            "title": "Blob Storage",
            "tldr": "S3 / GCS cho file lớn: rẻ, durable, scale gần như vô hạn. DB chỉ lưu metadata + URL. Client upload/download trực tiếp qua presigned URL.",
            "points": [
              "**Cách dùng** — upload blob, nhận về URL; thường đi kèm CDN để tải nhanh toàn cầu.",
              "**Durability** — replication và erasure coding, mất đĩa / server không mất dữ liệu.",
              "**Scalability** — lưu và phục vụ lượng dữ liệu, request gần như không giới hạn.",
              "**Security** — mã hoá at rest và in transit.",
              "**Upload / download trực tiếp từ client** — bằng presigned URL, giải phóng băng thông backend.",
              "**Chunking** — chia file lớn thành phần nhỏ: upload song song, resume khi lỗi giữa chừng (S3 multipart upload).",
              "+ **Cost** — rẻ hơn DB nhiều lần mỗi GB; có storage class lạnh (Glacier) cho dữ liệu ít truy cập."
            ],
            "cards": [
              [
                "Vì sao không lưu video trong RDBMS?",
                "Làm phình DB, chậm backup/replication, nghẽn băng thông. Đúng cách: blob ở S3, metadata + URL ở DB."
              ],
              [
                "Chunking giúp gì khi upload file lớn?",
                "Upload song song nhanh hơn, resume từ chunk lỗi thay vì upload lại từ đầu."
              ]
            ]
          },
          {
            "id": "search",
            "title": "Search Optimized Database",
            "tldr": "Elasticsearch / OpenSearch dùng inverted index + tokenization + stemming để full-text search; không dùng `LIKE '%x%'` trên DB chính.",
            "points": [
              "**Inverted index** — map từ → danh sách document chứa từ đó: `{\"word1\": [doc1, doc2], ...}`.",
              "**Tokenization** — tách đoạn văn thành từng từ.",
              "**Stemming** — đưa từ về gốc: “running”, “runs” → “run”.",
              "**Fuzzy search** — khớp gần đúng, chịu lỗi chính tả (edit distance).",
              "**Scaling** — shard index ra nhiều node, có replica.",
              "+ Đồng bộ từ DB chính sang search index qua **CDC** (Change Data Capture) → dữ liệu search là eventual consistent."
            ],
            "cards": [
              [
                "Inverted index là gì?",
                "Cấu trúc map mỗi từ đến danh sách document chứa từ đó, giúp full-text search không phải quét toàn bộ."
              ],
              [
                "Tokenization vs stemming?",
                "Tokenization tách văn bản thành từ; stemming rút từ về gốc để các biến thể khớp nhau."
              ]
            ]
          },
          {
            "id": "queue",
            "title": "Message Queue",
            "tldr": "Queue để tách producer/consumer: phân phối việc cho worker và hấp thụ traffic đột biến. Nắm 5 chủ đề: ordering, retry, DLQ, partition, backpressure.",
            "points": [
              "**Usage** — phân phối công việc trong hệ thống (worker pool); buffer cho bursty traffic.",
              "**Message ordering** — FIFO chỉ đảm bảo trong một partition / message group.",
              "**Retry mechanisms** — retry với exponential backoff; consumer phải idempotent.",
              "**Dead Letter Queue** — message lỗi quá số lần retry chuyển sang DLQ để xem xét, không chặn hàng.",
              "**Scaling with partitions** — chia queue thành partition để nhiều consumer xử lý song song; partition key quyết định thứ tự.",
              "**Backpressure** — khi consumer chậm hơn producer: giới hạn kích thước queue, từ chối/làm chậm producer, autoscale consumer.",
              "+ Công nghệ: SQS, RabbitMQ (queue); Kafka (log/stream, cũng dùng làm queue).",
              "+ Delivery semantics: at-most-once, **at-least-once** (phổ biến nhất, cần idempotency), exactly-once (đắt, hạn chế)."
            ],
            "cards": [
              [
                "Dead Letter Queue dùng để làm gì?",
                "Chứa message xử lý lỗi quá số lần retry, tránh poison message chặn hàng đợi và cho phép điều tra/xử lý lại."
              ],
              [
                "Queue đảm bảo thứ tự thế nào khi scale?",
                "Chỉ đảm bảo trong cùng partition; chọn partition key (ví dụ order_id) để message liên quan vào cùng partition."
              ],
              [
                "Backpressure là gì?",
                "Cơ chế báo producer chậm lại khi consumer không theo kịp: giới hạn queue, reject, rate limit, hoặc autoscale consumer."
              ]
            ]
          },
          {
            "id": "streams",
            "title": "Streams / Event Sourcing",
            "tldr": "+ Stream (Kafka, Kinesis) là log bền vững, nhiều consumer group đọc lại được; Event Sourcing lưu chuỗi sự kiện thay vì trạng thái hiện tại. Nhánh này trống trên Miro.",
            "points": [
              "+ **Khác queue** — message không bị xoá sau khi đọc; nhiều consumer group độc lập; replay từ offset bất kỳ.",
              "+ **Dùng khi** — xử lý realtime (analytics, fraud), fan-out một event cho nhiều service, cần replay.",
              "+ **Event Sourcing** — trạng thái = fold các event (`Deposited`, `Withdrawn`); audit đầy đủ, rebuild được; cần snapshot để đọc nhanh.",
              "+ Stream processing: Flink, Kafka Streams, Spark Streaming (windowing, aggregation)."
            ],
            "cards": [
              [
                "Queue khác Stream (Kafka) chỗ nào?",
                "Queue: message bị xoá khi xử lý xong, một nhóm consumer. Stream: log giữ lại theo retention, nhiều consumer group, replay được theo offset."
              ]
            ]
          },
          {
            "id": "dist-lock",
            "title": "Distributed Lock",
            "tldr": "Khoá tài nguyên xuyên nhiều server, thường bằng Redis (`SET key NX PX ttl`) hoặc DB (`SELECT ... FOR UPDATE`). Mọi lock có TTL (kể cả Redlock) không an toàn khi process pause → resource phải kiểm tra fencing token.",
            "points": [
              "**Database lock** — `SELECT ... FOR UPDATE` trong transaction.",
              "**Redis lock (Redlock)** — lấy lock có TTL trên đa số node Redis.",
              "**Vấn đề** — Server A lấy lock TTL 10s, bị GC pause 11s; lock hết hạn, Server B lấy lock; A tỉnh dậy không biết đã mất lock và vẫn ghi → hai bên cùng ghi, hỏng dữ liệu.",
              "**Fencing token** — số tăng dần cấp mỗi lần acquire; resource từ chối mọi request có token nhỏ hơn token lớn nhất đã thấy.",
              "+ Dùng cho: giữ ghế tạm thời khi checkout (Ticketmaster), tránh 2 worker xử lý cùng job."
            ],
            "cards": [
              [
                "Vì sao Redlock chưa đủ an toàn?",
                "Process pause (GC, network) có thể vượt TTL; lock tự hết hạn và client khác lấy lock trong khi client cũ vẫn tưởng mình đang giữ."
              ],
              [
                "Fencing token hoạt động thế nào?",
                "Mỗi lần lấy lock, client nhận một số tăng dần; storage ghi nhận token lớn nhất và từ chối mọi request mang token nhỏ hơn."
              ]
            ]
          },
          {
            "id": "dist-cache",
            "title": "Distributed Cache (Redis)",
            "tldr": "Redis/Memcached làm lớp cache dùng chung giữa các instance. Nhắc lại: write strategy, invalidation, eviction — chi tiết ở Core Concepts › Caching.",
            "points": [
              "**Write strategy** — Write-Through, Write-Around (kèm invalidation / TTL ngắn), Write-Back.",
              "**Invalidation strategy** — cách giữ cache khớp DB; DB đổi mà cache không biết thì user thấy stale data.",
              "**Eviction** — LRU, LFU, FIFO.",
              "+ Redis còn dùng làm: rate limiter (counter + TTL), leaderboard (sorted set), distributed lock, geo index (`GEOSEARCH`), pub/sub."
            ],
            "cards": [
              [
                "Kể các việc Redis làm được ngoài cache.",
                "Rate limiter, leaderboard (sorted set), distributed lock, geospatial search, pub/sub."
              ]
            ]
          },
          {
            "id": "lb-gateway-cdn",
            "title": "Load Balancer · API Gateway · CDN",
            "tldr": "LB chia tải giữa các instance. API Gateway là cửa vào duy nhất (auth, rate limit, routing). CDN cache nội dung tĩnh ở edge gần user.",
            "points": [
              "**Dedicated LB · NLB (L4)** — chỉ đọc IP/port, tốc độ gần phần cứng, triệu kết nối/giây, latency cực thấp.",
              "**Dedicated LB · ALB (L7)** — đọc HTTP (URL, cookie, header) để định tuyến thông minh.",
              "**Client-side LB** — service A lấy danh sách IP của service B từ Service Discovery (Consul, Eureka) rồi tự chọn (round robin, random), không qua trung gian.",
              "+ Thuật toán LB: round robin, least connections, consistent hashing (sticky theo user).",
              "+ **API Gateway** — routing tới microservice, authentication, rate limiting, request validation, logging. Ví dụ: AWS API Gateway, Kong.",
              "+ **CDN** — cache ảnh, video, JS/CSS ở edge; giảm latency và tải origin. Ví dụ: CloudFront, Cloudflare."
            ],
            "cards": [
              [
                "Client-side load balancing là gì?",
                "Client lấy danh sách instance từ service discovery và tự chọn instance để gọi trực tiếp, bỏ hop qua LB trung gian (phổ biến với gRPC)."
              ],
              [
                "API Gateway làm những việc gì?",
                "Routing, authentication, rate limiting, validation, logging/metrics — điểm vào duy nhất cho client."
              ]
            ]
          }
        ]
      },
      {
        "id": "sd-patterns",
        "title": "4 · Common Patterns",
        "topics": [
          {
            "id": "patterns",
            "title": "8 pattern hay gặp",
            "tldr": "Mỗi bài system design thường là tổ hợp vài pattern. Nhận ra bài toán → gọi đúng pattern → nói trade-off.",
            "table": {
              "head": [
                "Pattern",
                "Bài toán",
                "Giải pháp"
              ],
              "rows": [
                [
                  "Realtime Updates",
                  "Đẩy dữ liệu mới xuống client không cần F5",
                  "SSE (1 chiều), WebSocket (2 chiều: chat, game); + Pub/Sub để fan-out giữa các server"
                ],
                [
                  "Long-Running Tasks",
                  "Xuất báo cáo 1M dòng, render video 4K → HTTP timeout",
                  "Message queue (RabbitMQ, Kafka) + worker; trả job ID, client poll hoặc nhận notify"
                ],
                [
                  "Dealing with Contention",
                  "Hàng vạn người sửa cùng một dòng (ghế cuối, tồn kho)",
                  "Pessimistic lock, Optimistic lock (version), Distributed lock (Redis/ZooKeeper) + fencing token"
                ],
                [
                  "Scaling Reads",
                  "Đọc gấp 100 lần ghi",
                  "Read replicas, cache (Redis/Memcached), CDN; + index, denormalize"
                ],
                [
                  "Scaling Writes",
                  "Lượng ghi vượt sức 1 DB",
                  "Sharding/partitioning, LSM-Tree (Cassandra append-only), write-back cache / batching"
                ],
                [
                  "Handling Large Blobs",
                  "Upload/download file rất lớn",
                  "S3/GCS + CDN, presigned URL, chunked/multipart upload"
                ],
                [
                  "Multi-Step Processes",
                  "Chuỗi bước qua nhiều microservice, lỗi giữa chừng phải rollback",
                  "Saga (choreography / orchestration) với compensating action; + workflow engine (Temporal)"
                ],
                [
                  "Proximity-Based Services",
                  "Tìm tài xế / nhà hàng trong bán kính 2km",
                  "Geohash, Quadtree, Redis Geo, PostGIS"
                ]
              ]
            },
            "points": [
              "**Optimistic locking** — mọi người cùng đọc; khi ghi kiểm tra version, sai version thì bị từ chối và làm lại. Hợp khi xung đột ít.",
              "**Pessimistic locking** — khoá dòng, người sau xếp hàng chờ. Đúng nhưng tốn tài nguyên, dễ nghẽn khi xung đột nhiều.",
              "**Read replicas** — mọi lệnh ghi đi qua primary, lệnh đọc chia ra nhiều replica; replica có replication lag.",
              "**Geohash** — biến (lat, long) thành chuỗi ký tự; prefix chung = gần nhau → dùng index B-Tree thường. Chiều ngược lại không đúng: hai điểm sát nhau ở hai bên biên ô có prefix khác → luôn tìm thêm 8 ô láng giềng.",
              "**Quadtree** — chia bản đồ thành ô vuông nhiều cấp, ô dày đặc chia nhỏ hơn.",
              "+ **Saga choreography** — mỗi service nghe event và tự phát event kế tiếp (lỏng nhưng khó theo dõi). **Orchestration** — một orchestrator điều phối từng bước (dễ theo dõi, có điểm trung tâm)."
            ],
            "cards": [
              [
                "Optimistic vs pessimistic locking — khi nào dùng cái nào?",
                "Optimistic (check version khi ghi) khi xung đột hiếm, đọc nhiều. Pessimistic (SELECT FOR UPDATE) khi xung đột thường xuyên và retry đắt."
              ],
              [
                "Saga pattern giải quyết gì? Hai kiểu?",
                "Transaction phân tán qua nhiều service: mỗi bước có compensating action để rollback, đạt eventual consistency. Choreography (event) vs Orchestration (điều phối trung tâm)."
              ],
              [
                "Tìm tài xế trong bán kính 2km — gợi ý giải pháp?",
                "Geohash / Quadtree / Redis GEO / PostGIS; Redis GEO trong RAM thường phù hợp vì vị trí cập nhật liên tục."
              ],
              [
                "SSE vs WebSocket?",
                "SSE: server → client 1 chiều, chạy trên HTTP, tự reconnect (notification, live score). WebSocket: 2 chiều liên tục (chat, game)."
              ],
              [
                "Scaling writes có những cách nào?",
                "Sharding/partitioning, DB tối ưu ghi (LSM-tree như Cassandra), batching / write-back cache, queue để làm phẳng peak."
              ],
              [
                "Long-running task nên thiết kế API thế nào?",
                "POST trả job ID ngay (202 Accepted), job vào queue cho worker; client poll GET /jobs/{id} hoặc nhận webhook/SSE khi xong."
              ]
            ]
          }
        ]
      },
      {
        "id": "sd-deep",
        "title": "5 · Technology Deep Dives",
        "topics": [
          {
            "id": "kafka",
            "title": "Kafka chi tiết",
            "tldr": "Kafka là **distributed commit log**: producer append vào cuối partition, consumer tự đọc theo offset. Dữ liệu bền, đọc lại được, scale bằng partition. Kafka chỉ đảm bảo thứ tự **trong một partition**.",
            "sections": [
              {
                "title": "Mô hình tư duy",
                "table": {
                  "head": [
                    "Khái niệm",
                    "Là gì",
                    "Cần nhớ"
                  ],
                  "rows": [
                    [
                      "Broker",
                      "Một server Kafka; cluster gồm nhiều broker",
                      "Mỗi partition có 1 leader nằm trên một broker"
                    ],
                    [
                      "Topic",
                      "Kênh logic theo loại event (`orders`, `clicks`)",
                      "Giống tên bảng"
                    ],
                    [
                      "Partition",
                      "Log append-only có thứ tự — đơn vị song song",
                      "Số partition = số consumer tối đa xử lý song song trong một group"
                    ],
                    [
                      "Offset",
                      "Vị trí message trong partition (0, 1, 2…)",
                      "Consumer tự giữ offset → đọc lại được"
                    ],
                    [
                      "Producer",
                      "Ghi message (key, value)",
                      "Cùng key → cùng partition: `hash(key) % N`"
                    ],
                    [
                      "Consumer group",
                      "Nhóm consumer chia nhau partition",
                      "Mỗi partition chỉ 1 consumer trong group; group khác đọc độc lập"
                    ],
                    [
                      "Replica / ISR",
                      "Bản sao partition trên broker khác; ISR = replica đang theo kịp leader",
                      "`acks=all` chờ đủ ISR mới ack"
                    ],
                    [
                      "Controller (KRaft)",
                      "Quản lý metadata, bầu leader",
                      "KRaft production-ready từ Kafka 3.3; Kafka 4.0 bỏ hẳn ZooKeeper"
                    ]
                  ]
                }
              },
              {
                "title": "Đường ghi: producer → broker",
                "points": [
                  "**Chọn partition** — có key thì `hash(key) % N`; không key thì sticky/round-robin. Chọn key = chọn đơn vị thứ tự (orderId, userId).",
                  "**Batch + nén** — producer gom message theo `linger.ms`, `batch.size`, nén lz4/zstd → throughput cao.",
                  "**Leader ghi, follower kéo** — leader append vào log (ghi tuần tự, qua page cache); follower fetch về để giữ bản sao.",
                  "**Idempotent producer** (`enable.idempotence=true`, mặc định từ Kafka 3) — producer retry không tạo bản trùng trong partition."
                ],
                "table": {
                  "head": [
                    "acks",
                    "Ack khi",
                    "Rủi ro"
                  ],
                  "rows": [
                    [
                      "0",
                      "Không chờ gì",
                      "Mất message khi có lỗi bất kỳ; chỉ hợp metrics không quan trọng"
                    ],
                    [
                      "1",
                      "Leader ghi xong",
                      "Mất message nếu leader chết trước khi follower kéo"
                    ],
                    [
                      "all + min.insync.replicas=2",
                      "Đủ số replica in-sync đã ghi",
                      "Bền nhất; ít ISR quá thì producer bị từ chối ghi. Chuẩn: replication.factor=3"
                    ]
                  ]
                }
              },
              {
                "title": "Đường đọc: consumer group",
                "points": [
                  "**Poll theo batch** — consumer kéo message và tự quyết định khi nào commit offset.",
                  "**Phân partition** — mỗi partition gán cho đúng 1 consumer trong group; consumer nhiều hơn partition thì dư consumer ngồi chơi.",
                  "**Rebalance** — khi consumer vào, ra hoặc chết (mất heartbeat), group chia lại partition; với protocol cũ (eager), xử lý tạm dừng trong lúc đó. Cooperative rebalancing và protocol mới KIP-848 (Kafka 4.0) chỉ dời những partition cần dời.",
                  "**Consumer lag** = offset cuối − offset đã commit — metric quan trọng nhất để autoscale và cảnh báo.",
                  "**Nhiều group cùng đọc một topic** — fan-out gần như miễn phí: analytics, search indexer, notification đọc cùng event."
                ]
              },
              {
                "title": "Delivery semantics",
                "table": {
                  "head": [
                    "Kiểu",
                    "Cách làm",
                    "Rủi ro"
                  ],
                  "rows": [
                    [
                      "At-most-once",
                      "Commit offset **trước**, rồi mới xử lý",
                      "Crash giữa chừng → mất message"
                    ],
                    [
                      "At-least-once (phổ biến nhất)",
                      "Xử lý xong **rồi** commit",
                      "Crash trước khi commit → xử lý lại → consumer phải idempotent"
                    ],
                    [
                      "Exactly-once",
                      "Idempotent producer + transactions (đọc–xử lý–ghi trong Kafka), hoặc at-least-once + dedupe ở đích",
                      "Chỉ đúng trong phạm vi Kafka; ghi ra hệ thống ngoài vẫn cần idempotency"
                    ]
                  ]
                }
              },
              {
                "title": "Lưu trữ: retention & compaction",
                "points": [
                  "**Retention** theo thời gian hoặc dung lượng (ví dụ 7 ngày). Message **không bị xoá khi đọc** — khác hẳn queue.",
                  "**Log compaction** — chỉ giữ bản mới nhất cho mỗi key, biến topic thành changelog/state rebuild được (CDC, config).",
                  "**Segment** — log chia thành file segment; xoá và compact theo segment."
                ]
              },
              {
                "title": "Vì sao Kafka nhanh",
                "points": [
                  "**Ghi và đọc tuần tự** trên đĩa, tận dụng OS page cache.",
                  "**Zero-copy** (`sendfile`) đẩy dữ liệu từ page cache ra socket, không copy qua user space.",
                  "**Batching + compression** ở cả producer lẫn consumer.",
                  "**Partition** cho phép nhiều broker và consumer làm song song."
                ]
              },
              {
                "title": "Câu hỏi hay bị hỏi sâu",
                "points": [
                  "**Hot partition** — key lệch (celebrity, ad cực hot) dồn vào một partition → salt key (`adId#0..N`) rồi gộp ở consumer; đổi lại mất thứ tự theo key gốc.",
                  "**Chọn số partition** — throughput mục tiêu ÷ throughput mỗi partition (lấy phía chậm hơn giữa producer và consumer), cộng dư cho tăng trưởng. Không giảm được; tăng thì đổi mapping key → phá thứ tự theo key.",
                  "**Message lớn** — Kafka hợp message nhỏ (≤ 1MB). File lớn để ở S3, chỉ gửi pointer.",
                  "**Poison message** — consumer Kafka không có DLQ sẵn như SQS (Kafka Connect thì có): tự làm retry topic + DLQ topic.",
                  "**Consumer chậm** — thêm partition + consumer, hoặc tách việc nặng sang worker pool."
                ]
              },
              {
                "title": "Kafka hay lựa chọn khác?",
                "table": {
                  "head": [
                    "",
                    "Kafka",
                    "SQS",
                    "RabbitMQ",
                    "Redis Streams"
                  ],
                  "rows": [
                    [
                      "Mô hình",
                      "Log bền, replay được",
                      "Queue, xoá khi xử lý xong",
                      "Broker định tuyến qua exchange",
                      "Log trong RAM"
                    ],
                    [
                      "Thứ tự",
                      "Trong partition",
                      "FIFO queue (giới hạn TPS)",
                      "Trong queue",
                      "Trong stream"
                    ],
                    [
                      "Replay",
                      "Có (theo offset)",
                      "Không",
                      "Không",
                      "Có (giới hạn bởi RAM)"
                    ],
                    [
                      "Chọn khi",
                      "Event streaming, fan-out nhiều consumer, CDC, analytics",
                      "Job queue đơn giản, không muốn vận hành",
                      "Routing phức tạp",
                      "Nhẹ, đã có sẵn Redis, dữ liệu ngắn hạn"
                    ]
                  ]
                }
              }
            ],
            "tips": [
              "Luôn nói rõ **partition key** là gì và vì sao (thứ tự theo order, theo user…).",
              "Khi vẽ Kafka, nói luôn cấu hình bền: `acks=all`, RF=3, consumer idempotent, theo dõi lag.",
              "Chỉ cần job queue đơn giản thì SQS đủ và ít vận hành hơn Kafka."
            ],
            "related": [
              "queue",
              "realtime",
              "long-task"
            ],
            "cards": [
              [
                "Kafka đảm bảo thứ tự ở mức nào?",
                "Chỉ trong một partition. Muốn mọi event của một order đúng thứ tự → dùng orderId làm key."
              ],
              [
                "Có 4 partition và 6 consumer trong cùng group thì sao?",
                "Chỉ 4 consumer nhận partition, 2 consumer rảnh. Số partition là giới hạn song song của một group."
              ],
              [
                "acks=1 có thể mất dữ liệu khi nào?",
                "Leader ghi xong và ack, rồi chết trước khi follower kịp kéo — follower lên làm leader không có message đó."
              ],
              [
                "At-least-once gây ra vấn đề gì và xử lý thế nào?",
                "Message có thể bị xử lý lại khi consumer crash trước khi commit → consumer phải idempotent (dedupe theo message id, upsert)."
              ],
              [
                "Log compaction dùng để làm gì?",
                "Giữ bản mới nhất cho mỗi key, biến topic thành changelog/state rebuild được (CDC, config)."
              ],
              [
                "Xử lý hot partition thế nào?",
                "Salt key (key#0..N) để chia ra nhiều partition rồi gộp ở consumer; đổi lại mất thứ tự theo key gốc."
              ]
            ]
          },
          {
            "id": "redis",
            "title": "Redis chi tiết",
            "tldr": "Redis là **in-memory data structure server**: lệnh chạy tuần tự trên một thread nên mỗi lệnh là atomic, latency < 1ms, ~100k+ ops/s mỗi node. Dùng làm cache, counter, lock, rate limiter, leaderboard, geo, pub/sub — nhưng dữ liệu nằm trong RAM và replication **bất đồng bộ**.",
            "sections": [
              {
                "title": "Cấu trúc dữ liệu → bài toán",
                "table": {
                  "head": [
                    "Kiểu",
                    "Lệnh chính",
                    "Dùng cho"
                  ],
                  "rows": [
                    [
                      "String",
                      "`GET` `SET` `INCR` `SET NX PX`",
                      "Cache, counter, distributed lock, idempotency key"
                    ],
                    [
                      "Hash",
                      "`HSET` `HGET` `HINCRBY`",
                      "Object đổi từng field (session, profile)"
                    ],
                    [
                      "List",
                      "`LPUSH` `BRPOP` `LRANGE`",
                      "Queue đơn giản, N id gần nhất (feed)"
                    ],
                    [
                      "Set",
                      "`SADD` `SISMEMBER` `SINTER`",
                      "Tập duy nhất, bạn chung, đã thấy"
                    ],
                    [
                      "Sorted Set",
                      "`ZADD` `ZINCRBY` `ZREVRANGE` `ZRANGEBYSCORE`",
                      "Leaderboard, top K, sliding-window rate limit, waiting queue, lịch hẹn theo thời gian"
                    ],
                    [
                      "Bitmap / HyperLogLog",
                      "`SETBIT` `BITCOUNT` · `PFADD` `PFCOUNT`",
                      "DAU, unique visitor với bộ nhớ rất nhỏ"
                    ],
                    [
                      "Geo",
                      "`GEOADD` `GEOSEARCH`",
                      "Tài xế gần nhất, cửa hàng gần"
                    ],
                    [
                      "Stream",
                      "`XADD` `XREADGROUP` `XACK`",
                      "Log nhẹ có consumer group"
                    ],
                    [
                      "Pub/Sub",
                      "`PUBLISH` `SUBSCRIBE`",
                      "Fan-out realtime giữa các server — **không lưu**, offline là mất"
                    ]
                  ]
                }
              },
              {
                "title": "Vì sao nhanh và atomic",
                "points": [
                  "**In-memory** — đọc ghi RAM, không chạm đĩa trên đường request.",
                  "**Một thread thực thi lệnh** (I/O threads từ 6.0 chỉ đọc/ghi socket) → không cần lock, mỗi lệnh là atomic.",
                  "**Nhiều bước atomic** — `MULTI/EXEC` gom lệnh nhưng không rollback và không đọc giữa chừng được; **Lua script** (`EVAL`) chạy trọn trên server trong một round-trip.",
                  "**Pipelining** — gửi nhiều lệnh một lần để giảm round-trip.",
                  "**Hệ quả** — một lệnh chậm chặn mọi client: tránh `KEYS *` (dùng `SCAN`), xoá big key bằng `UNLINK`, không `LRANGE 0 -1` trên list triệu phần tử."
                ]
              },
              {
                "title": "Pattern hay dùng trong phỏng vấn",
                "table": {
                  "head": [
                    "Pattern",
                    "Cách làm",
                    "Lưu ý"
                  ],
                  "rows": [
                    [
                      "Cache-aside",
                      "`GET` → miss → đọc DB → `SET key val EX 300`",
                      "TTL + jitter; xoá key khi ghi DB"
                    ],
                    [
                      "Distributed lock",
                      "`SET lock token NX PX 30000`; nhả bằng Lua so token",
                      "Không an toàn khi failover / GC pause → fencing token"
                    ],
                    [
                      "Rate limiter",
                      "Fixed window `INCR`+`EXPIRE`; sliding window bằng ZSET; token bucket bằng Lua",
                      "Lua để atomic giữa nhiều gateway"
                    ],
                    [
                      "Leaderboard",
                      "`ZINCRBY board 10 user`; `ZREVRANGE board 0 9 WITHSCORES`",
                      "O(log N) mỗi lần cập nhật"
                    ],
                    [
                      "Session store",
                      "`HSET session:{id} …` + `EXPIRE`",
                      "Mất session khi Redis mất dữ liệu — thường chấp nhận được"
                    ],
                    [
                      "Pub/Sub fan-out",
                      "Server giữ WebSocket `SUBSCRIBE user:{id}`",
                      "Không bền → kết hợp inbox trong DB"
                    ],
                    [
                      "Idempotency key",
                      "`SET idem:{key} result NX EX 86400`",
                      "Request lặp thì trả lại kết quả cũ"
                    ]
                  ]
                }
              },
              {
                "title": "TTL & eviction",
                "points": [
                  "**TTL** — `EXPIRE key 60`. Redis xoá key hết hạn theo hai cách: **lazy** (khi truy cập) + **active** (lấy mẫu định kỳ), nên RAM có thể chưa giải phóng ngay."
                ],
                "table": {
                  "head": [
                    "maxmemory-policy",
                    "Hành vi khi đầy RAM",
                    "Hợp với"
                  ],
                  "rows": [
                    [
                      "noeviction",
                      "Báo lỗi khi ghi",
                      "Redis là nơi lưu chính, không được mất key"
                    ],
                    [
                      "allkeys-lru",
                      "Đuổi key lâu nhất chưa dùng",
                      "Cache chung — phổ biến nhất"
                    ],
                    [
                      "allkeys-lfu",
                      "Đuổi key ít được dùng nhất",
                      "Có tập key hot ổn định"
                    ],
                    [
                      "volatile-lru / volatile-ttl",
                      "Chỉ đuổi key có TTL; không còn key có TTL thì báo lỗi như noeviction",
                      "Trộn cache và dữ liệu cần giữ"
                    ]
                  ]
                }
              },
              {
                "title": "Persistence",
                "table": {
                  "head": [
                    "Cách",
                    "Hoạt động",
                    "Đánh đổi"
                  ],
                  "rows": [
                    [
                      "RDB",
                      "Snapshot định kỳ (fork process)",
                      "File gọn, restart nhanh; mất dữ liệu từ snapshot cuối"
                    ],
                    [
                      "AOF",
                      "Ghi log mọi lệnh, `fsync everysec`",
                      "Thường mất ~1s (tệ nhất ~2s); file lớn hơn, cần rewrite"
                    ],
                    [
                      "RDB + AOF",
                      "Kết hợp",
                      "Khuyến nghị khi cần bền"
                    ],
                    [
                      "Không bật",
                      "Cache thuần",
                      "Restart = cache lạnh"
                    ]
                  ]
                }
              },
              {
                "title": "High availability & scale",
                "points": [
                  "**Replication** — primary → replica **bất đồng bộ**; đọc từ replica có thể stale.",
                  "**Sentinel** — giám sát và tự failover cho mô hình primary/replica không shard.",
                  "**Redis Cluster** — 16,384 hash slot, `slot = CRC16(key) mod 16384`, mỗi master giữ một dải slot; client đến sai node nhận `MOVED`.",
                  "**Hash tag** — trong Cluster, lệnh nhiều key chỉ chạy khi cùng slot: đặt tên `{user42}:cart`, `{user42}:profile`.",
                  "**Failover có thể mất write đã ack** — vì replication bất đồng bộ. Nhớ điều này khi dùng Redis làm lock hoặc nơi lưu chính."
                ]
              },
              {
                "title": "Câu hỏi hay bị hỏi sâu",
                "points": [
                  "**Hot key** — một key nhận quá nhiều traffic làm một shard quá tải → nhân bản key (`key#1..N`), local cache ở app.",
                  "**Big key** — hash/list hàng triệu phần tử làm lệnh chậm và migrate khó → chia nhỏ theo bucket.",
                  "**Chi phí RAM** — đắt hơn đĩa nhiều lần → chỉ giữ dữ liệu nóng, đặt TTL.",
                  "**Cache hay nguồn sự thật?** — mặc định Redis là cache. Dùng làm nơi lưu chính chỉ khi chấp nhận mất một ít dữ liệu, hoặc bật AOF + replica."
                ]
              },
              {
                "title": "Redis hay lựa chọn khác?",
                "table": {
                  "head": [
                    "",
                    "Redis",
                    "Memcached",
                    "Kafka"
                  ],
                  "rows": [
                    [
                      "Dữ liệu",
                      "Nhiều cấu trúc",
                      "Chỉ key–value string",
                      "Log message"
                    ],
                    [
                      "Bền",
                      "RDB/AOF tuỳ chọn",
                      "Không",
                      "Bền trên đĩa, có replica"
                    ],
                    [
                      "Scale",
                      "Cluster theo slot",
                      "Client-side sharding, đa luồng",
                      "Partition"
                    ],
                    [
                      "Chọn khi",
                      "Cache + lock, rank, geo, rate limit",
                      "Cache thuần, tận dụng nhiều core",
                      "Event bền, replay, nhiều consumer"
                    ]
                  ]
                }
              }
            ],
            "tips": [
              "Khi đưa Redis vào thiết kế, nói rõ: **key** là gì, **cấu trúc** nào, **TTL** bao lâu, **mất dữ liệu** thì sao.",
              "Cần đọc–tính–ghi atomic (rate limit, nhả lock) → Lua script.",
              "Lock quan trọng → nhắc fencing token, vì failover có thể làm mất lock."
            ],
            "related": [
              "cache-aside",
              "stampede",
              "redlock",
              "token-bucket"
            ],
            "cards": [
              [
                "Vì sao một lệnh Redis là atomic?",
                "Redis thực thi lệnh tuần tự trên một thread chính, không lệnh nào chen giữa."
              ],
              [
                "Muốn đọc–tính–ghi nhiều bước atomic trong Redis?",
                "Lua script (EVAL): chạy trọn trên server trong một round-trip. MULTI/EXEC không rollback và không đọc giữa chừng được."
              ],
              [
                "Leaderboard top 10 bằng Redis?",
                "Sorted set: ZINCRBY board điểm user để cập nhật, ZREVRANGE board 0 9 WITHSCORES để lấy top 10; O(log N)."
              ],
              [
                "Redis Cluster định tuyến key thế nào?",
                "slot = CRC16(key) mod 16384; mỗi master giữ một dải slot; sai node thì nhận MOVED. Lệnh nhiều key cần cùng slot → hash tag {…}."
              ],
              [
                "RDB khác AOF thế nào?",
                "RDB: snapshot định kỳ, restart nhanh nhưng mất dữ liệu từ lần snapshot cuối. AOF: log mọi lệnh (fsync mỗi giây), thường mất ~1s (tệ nhất ~2s)."
              ],
              [
                "Vì sao không chạy KEYS * trên production?",
                "Redis thực thi lệnh trên một thread: KEYS quét toàn bộ keyspace và chặn mọi client. Dùng SCAN theo từng đợt."
              ]
            ]
          },
          {
            "id": "tech-cheatsheet",
            "title": "Cheat sheet 15 công nghệ",
            "tldr": "+ Ở phỏng vấn, mỗi công nghệ chỉ cần trả lời được: dùng nó cho việc gì, vì sao không dùng cái khác, giới hạn của nó ở đâu. Hello Interview có bài riêng cho từng công nghệ.",
            "table": {
              "head": [
                "Công nghệ",
                "Dùng khi",
                "Điểm cần nói được"
              ],
              "rows": [
                [
                  "PostgreSQL",
                  "Mặc định cho dữ liệu quan hệ, cần ACID",
                  "Index B-Tree/GIN, read replica, partitioning, `SELECT FOR UPDATE`, JSONB, PostGIS"
                ],
                [
                  "DynamoDB",
                  "Key-value/document scale lớn, managed",
                  "Partition key + sort key, GSI, hot partition, conditional write, DynamoDB Streams"
                ],
                [
                  "Cassandra",
                  "Ghi cực nhiều, dữ liệu theo thời gian (chat, log)",
                  "LSM-tree, partition key + clustering key, tunable consistency (QUORUM), không JOIN"
                ],
                [
                  "Redis",
                  "Cache, counter, lock, leaderboard, geo, pub/sub",
                  "Thực thi lệnh single-threaded, data structures (sorted set, GEO), TTL, persistence (RDB/AOF), cluster slot"
                ],
                [
                  "Elasticsearch",
                  "Full-text search, faceted search",
                  "Inverted index, analyzer, shard/replica, đồng bộ qua CDC → eventual consistency"
                ],
                [
                  "Kafka",
                  "Event stream bền vững, nhiều consumer group",
                  "Topic/partition, offset, consumer group, ordering trong partition, retention, replay"
                ],
                [
                  "Flink",
                  "Stream processing có state",
                  "Window (tumbling/sliding), watermark cho event trễ, checkpoint → exactly-once cho state (end-to-end cần sink transactional)"
                ],
                [
                  "ZooKeeper",
                  "Coordination: leader election, config, service discovery",
                  "Consensus (ZAB), ephemeral node, watch; Kafka đã thay bằng KRaft, Kubernetes dùng etcd"
                ],
                [
                  "Temporal",
                  "Workflow nhiều bước bền vững (saga, retry dài)",
                  "Durable execution: workflow resume sau crash, activity retry, timer dài ngày"
                ],
                [
                  "API Gateway",
                  "Cửa vào duy nhất cho client",
                  "Routing, auth, rate limit, request validation, không chứa business logic"
                ],
                [
                  "Proximity Search",
                  "Tìm điểm gần (tài xế, nhà hàng)",
                  "Geohash, Quadtree, Redis GEO, PostGIS; trade-off độ chính xác và tốc độ cập nhật"
                ],
                [
                  "Vector Database",
                  "Semantic search, RAG, recommendation",
                  "Embedding, ANN (HNSW, IVF), cosine similarity; pgvector, Pinecone"
                ],
                [
                  "Time-series DB",
                  "Metrics, monitoring, IoT",
                  "Ghi append theo thời gian, downsampling, retention; InfluxDB, TimescaleDB, Prometheus"
                ],
                [
                  "Change Data Capture",
                  "Đồng bộ DB chính sang search/cache/warehouse",
                  "Đọc WAL/binlog (Debezium) → Kafka; tránh dual-write không nhất quán"
                ],
                [
                  "Blob + CDN",
                  "File lớn, media",
                  "Presigned URL, multipart, edge cache, signed URL"
                ]
              ]
            },
            "points": [
              "+ **Dual-write problem** — ghi DB rồi ghi Kafka/ES trong code có thể lệch khi một bên lỗi. Giải bằng CDC hoặc **transactional outbox**.",
              "+ Chọn DB: bắt đầu từ PostgreSQL; chuyển sang DynamoDB/Cassandra khi nêu được lý do (write throughput, access pattern đơn giản theo key, scale ngang)."
            ],
            "cards": [
              [
                "Kafka khác Redis Pub/Sub thế nào?",
                "Kafka lưu bền vững theo retention, nhiều consumer group, replay theo offset. Redis Pub/Sub fire-and-forget: không ai subscribe thì message mất."
              ],
              [
                "Cassandra hợp với loại dữ liệu nào?",
                "Ghi rất nhiều, truy vấn theo partition key và sắp theo clustering key (chat theo chatId + timestamp, log, time-series). Không có JOIN."
              ],
              [
                "Dual-write problem là gì và giải thế nào?",
                "Ghi DB và ghi hệ thống thứ hai (Kafka/ES) trong cùng code có thể lệch khi một bên lỗi. Giải bằng CDC (Debezium đọc WAL) hoặc transactional outbox."
              ],
              [
                "Temporal giải quyết bài toán gì?",
                "Durable execution cho workflow nhiều bước: tự resume sau crash, retry activity, timer dài; hợp saga và quy trình kéo dài."
              ],
              [
                "Flink watermark để làm gì?",
                "Đánh dấu tiến độ thời gian sự kiện để đóng window đúng lúc dù event đến trễ hoặc lệch thứ tự."
              ]
            ]
          },
          {
            "id": "bigdata-ds",
            "title": "Data Structures for Big Data",
            "tldr": "+ Cấu trúc xác suất: đổi một chút sai số lấy bộ nhớ cực nhỏ. Hay xuất hiện ở Web Crawler, Top K, Ad Click, Metrics.",
            "table": {
              "head": [
                "Cấu trúc",
                "Trả lời câu hỏi",
                "Đánh đổi",
                "Gặp ở bài"
              ],
              "rows": [
                [
                  "Bloom filter",
                  "“Phần tử này **có thể** đã thấy chưa?”",
                  "Không có false negative, có false positive; không xoá được",
                  "Web Crawler (URL đã crawl), chặn query key không tồn tại (cache penetration)"
                ],
                [
                  "Count-Min Sketch",
                  "“Phần tử này xuất hiện **khoảng** bao nhiêu lần?”",
                  "Chỉ đếm dư, không đếm thiếu; bộ nhớ cố định",
                  "YouTube Top K, heavy hitters"
                ],
                [
                  "HyperLogLog",
                  "“Có **khoảng** bao nhiêu phần tử khác nhau?”",
                  "Sai số ~1% với ~12KB cho hàng tỷ phần tử",
                  "Unique visitors, DAU (Redis `PFCOUNT`)"
                ],
                [
                  "Min-heap kích thước K",
                  "Top K phần tử lớn nhất",
                  "O(n log K), giữ K phần tử",
                  "Top K video, trending"
                ]
              ]
            },
            "points": [],
            "cards": [
              [
                "Bloom filter có false negative không?",
                "Không. Nó có thể báo nhầm “đã thấy” (false positive) nhưng nếu báo “chưa thấy” thì chắc chắn chưa thấy."
              ],
              [
                "Đếm unique visitor hàng tỷ lượt với bộ nhớ nhỏ?",
                "HyperLogLog (Redis PFADD/PFCOUNT): ~12KB, sai số ~1%."
              ],
              [
                "Count-Min Sketch dùng cho bài nào?",
                "Ước lượng tần suất trên stream để tìm heavy hitters / Top K (YouTube Top K) với bộ nhớ cố định."
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "lld",
    "title": "Low-Level Design",
    "subtitle": "Hello Interview · Low-Level Design in a Hurry",
    "sections": [
      {
        "id": "lld-framework",
        "title": "1 · Delivery Framework",
        "topics": [
          {
            "id": "lld-delivery",
            "title": "Khung trả lời LLD",
            "tldr": "+ Requirements → Entities & relationships → Class design → Implementation → Extensibility. Nhánh này không có trên Miro.",
            "table": {
              "head": [
                "Bước",
                "Làm gì"
              ],
              "rows": [
                [
                  "Requirements",
                  "Hỏi rõ phạm vi, thao tác chính, lỗi cần xử lý, ngoài phạm vi"
                ],
                [
                  "Entities & Relationships",
                  "Danh từ → class; quan hệ has-a / is-a; ai sở hữu trạng thái"
                ],
                [
                  "Class Design",
                  "Thuộc tính + method public cho từng class; áp dụng SOLID"
                ],
                [
                  "Implementation",
                  "Code các method cốt lõi, happy path trước rồi edge case"
                ],
                [
                  "Extensibility",
                  "Interviewer thêm yêu cầu; thiết kế tốt chỉ cần thêm class, không sửa nhiều"
                ]
              ]
            },
            "points": [
              "+ Bài kinh điển: Parking Lot, Elevator, Vending Machine (State), Rate Limiter (Strategy), Connect Four, LRU Cache."
            ],
            "cards": [
              [
                "5 bước trả lời Low-Level Design?",
                "Requirements → Entities & relationships → Class design → Implementation → Extensibility."
              ]
            ]
          }
        ]
      },
      {
        "id": "lld-oop",
        "title": "2 · OOP",
        "topics": [
          {
            "id": "oop-pillars",
            "title": "4 tính chất cốt lõi",
            "tldr": "Encapsulation, Abstraction, Inheritance, Polymorphism. Hiểu Interface (CAN-DO) vs Abstract Class (IS-A).",
            "table": {
              "head": [
                "",
                "Interface (CAN-DO)",
                "Abstract Class (IS-A)"
              ],
              "rows": [
                [
                  "Method",
                  "Chỉ khai báo (hợp đồng), không có thân hàm*",
                  "Cả abstract method và concrete method"
                ],
                [
                  "Trạng thái",
                  "Không có biến instance",
                  "Có biến instance"
                ],
                [
                  "Kế thừa",
                  "Một class implement nhiều interface",
                  "Đơn kế thừa"
                ],
                [
                  "Dùng khi",
                  "Định nghĩa năng lực chung cho các class không liên quan",
                  "Chia sẻ code + trạng thái cho các class cùng họ"
                ]
              ]
            },
            "points": [
              "+ **Encapsulation (Đóng gói)** — giấu trạng thái bên trong, chỉ cho thay đổi qua method có kiểm soát (`account.withdraw()` thay vì sửa `balance` trực tiếp).",
              "**Abstraction (Trừu tượng)** — chỉ lộ ra “làm gì”, giấu “làm thế nào”; công cụ là interface và abstract class.",
              "+ **Inheritance (Kế thừa)** — class con tái dùng và mở rộng class cha (quan hệ IS-A). Ưu tiên **composition over inheritance** khi chỉ cần tái dùng hành vi.",
              "+ **Polymorphism (Đa hình)** — cùng một lời gọi, mỗi object hành xử khác nhau (`shape.area()` cho Circle, Square). Có runtime (override) và compile-time (overload).",
              "! *Java 8+ và C# 8+ cho phép interface có `default` method — “interface chỉ có hàm rỗng” là định nghĩa nguyên thuỷ."
            ],
            "cards": [
              [
                "Interface vs Abstract class?",
                "Interface: hợp đồng CAN-DO, không giữ trạng thái, implement nhiều cái. Abstract class: IS-A, có trạng thái + concrete method, đơn kế thừa."
              ],
              [
                "Polymorphism là gì? Ví dụ.",
                "Cùng interface, hành vi khác nhau theo kiểu thực tế của object: `PaymentMethod.pay()` cho Card, Wallet, BankTransfer."
              ],
              [
                "Vì sao ưu tiên composition over inheritance?",
                "Inheritance gắn chặt class con vào chi tiết class cha và cây kế thừa khó đổi; composition linh hoạt, thay hành vi lúc runtime được."
              ]
            ]
          }
        ]
      },
      {
        "id": "lld-principles",
        "title": "3 · Design Principles",
        "topics": [
          {
            "id": "solid",
            "title": "SOLID",
            "tldr": "5 nguyên tắc giúp class dễ đổi, dễ mở rộng. SRP là nền tảng.",
            "table": {
              "head": [
                "Nguyên tắc",
                "Một câu",
                "Dấu hiệu vi phạm"
              ],
              "rows": [
                [
                  "SRP · Single Responsibility",
                  "Một class chỉ có một lý do để thay đổi",
                  "Class vừa tính tiền vừa gửi email vừa ghi DB"
                ],
                [
                  "OCP · Open/Closed",
                  "Mở để mở rộng, đóng để sửa",
                  "Thêm loại mới phải sửa chuỗi `if/else` cũ"
                ],
                [
                  "LSP · Liskov Substitution",
                  "Class con dùng được ở mọi chỗ class cha dùng",
                  "Square.setWidth() đổi luôn height, hoặc override rồi throw `NotSupported`"
                ],
                [
                  "ISP · Interface Segregation",
                  "Nhiều interface nhỏ tốt hơn một interface lớn",
                  "Class implement method rỗng chỉ vì bắt buộc"
                ],
                [
                  "DIP · Dependency Inversion",
                  "Phụ thuộc abstraction, không phụ thuộc implementation",
                  "`new MySQLRepository()` ngay trong service"
                ]
              ]
            },
            "points": [],
            "cards": [
              [
                "SRP là gì?",
                "Một class chỉ có một lý do để thay đổi; trộn nhiều concern thì tách ra."
              ],
              [
                "OCP thường hiện thực bằng pattern nào?",
                "Strategy / polymorphism: thêm class mới implement interface thay vì sửa if/else cũ."
              ],
              [
                "Ví dụ vi phạm LSP?",
                "Square kế thừa Rectangle: set width làm đổi height, code dùng Rectangle bị sai kỳ vọng."
              ],
              [
                "DIP khác Dependency Injection?",
                "DIP là nguyên tắc (phụ thuộc abstraction). DI là kỹ thuật truyền dependency từ ngoài vào để hiện thực DIP."
              ]
            ]
          },
          {
            "id": "principles-other",
            "title": "KISS · DRY · YAGNI · SoC · LoD",
            "tldr": "Coding mindset (KISS, DRY, YAGNI) chống over-engineering. Architecture & coupling (SoC, LoD) giảm phụ thuộc chéo.",
            "points": [
              "**KISS** — Keep It Simple, Stupid: là **mục tiêu** — thiết kế hệ thống đơn giản.",
              "**YAGNI** — You Aren't Gonna Need It: là **công cụ hành động** — cắt tính năng chưa cần.",
              "**DRY** — Don't Repeat Yourself: logic lặp ở nhiều chỗ thì gom về một chỗ.",
              "**SoC** — Separation of Concerns: mỗi phần lo một trách nhiệm và không biết nội bộ của phần khác.",
              "**LoD** — Law of Demeter: tránh chuỗi gọi xuyên nhiều kiểu object (`order.getCustomer().getAddress().getZipCode()`) vì lộ cấu trúc nội bộ.",
              "**LoD ngoại lệ** — fluent chain trả về cùng kiểu (`builder.setName(\"John\").setAge(30).build()`) không vi phạm.",
              "+ DRY quá mức cũng hại: gộp hai đoạn code chỉ “trông giống” nhưng đổi vì lý do khác nhau sẽ tạo coupling sai."
            ],
            "cards": [
              [
                "KISS và YAGNI khác nhau thế nào?",
                "KISS là mục tiêu (giữ thiết kế đơn giản); YAGNI là hành động (không xây tính năng chưa cần)."
              ],
              [
                "Law of Demeter cấm gì? Ngoại lệ?",
                "Cấm chuỗi gọi xuyên qua nhiều object khác kiểu, làm lộ cấu trúc bên trong. Fluent builder trả về cùng object thì được."
              ]
            ]
          }
        ]
      },
      {
        "id": "lld-patterns",
        "title": "4 · Design Patterns",
        "topics": [
          {
            "id": "patterns-gof",
            "title": "Creational · Structural · Behavioral",
            "tldr": "Creational kiểm soát cách tạo object; Structural lo cách object nối với nhau; Behavioral lo cách object giao tiếp và chia trách nhiệm.",
            "table": {
              "head": [
                "Nhóm",
                "Pattern",
                "Ý chính",
                "Gặp ở bài"
              ],
              "rows": [
                [
                  "Creational",
                  "Singleton",
                  "Chỉ một instance dùng chung: config, connection pool, logger",
                  "Logger, DB pool"
                ],
                [
                  "Creational",
                  "Builder",
                  "Tạo object phức tạp từng bước, không lo thứ tự",
                  "Tạo Pizza, HTTP request"
                ],
                [
                  "Creational",
                  "Factory Method",
                  "+ Giao việc chọn class cụ thể cho factory, caller chỉ biết interface",
                  "`VehicleFactory.create(type)`"
                ],
                [
                  "Structural",
                  "Facade",
                  "Một interface đơn giản che cả hệ thống con phức tạp",
                  "`OrderService.checkout()`"
                ],
                [
                  "Structural",
                  "Decorator",
                  "Thêm hành vi cho object mà không đổi class",
                  "Thêm topping, logging wrapper"
                ],
                [
                  "Behavioral",
                  "Strategy",
                  "Đóng gói thuật toán, hoán đổi lúc runtime",
                  "Rate limiter, pricing, payment"
                ],
                [
                  "Behavioral",
                  "Observer",
                  "1–N: Subject đổi trạng thái thì Observers tự nhận thông báo",
                  "Notification, stock ticker"
                ],
                [
                  "Behavioral",
                  "State Machine",
                  "Quản lý vòng đời nhiều trạng thái, chỉ cho chuyển hợp lệ",
                  "Vending machine, Order, Elevator"
                ]
              ]
            },
            "points": [
              "+ Cẩn thận với Singleton: đó là global state, khó test; môi trường đa luồng cần khởi tạo thread-safe.",
              "+ Strategy vs State: Strategy do **client chọn** thuật toán; State do **object tự chuyển** khi trạng thái đổi.",
              "Tham khảo: hellointerview.com/learn/low-level-design/in-a-hurry/patterns"
            ],
            "cards": [
              [
                "Strategy khác State thế nào?",
                "Strategy: client chọn/hoán đổi thuật toán từ ngoài. State: object tự chuyển trạng thái bên trong, mỗi trạng thái quyết định hành vi và trạng thái kế tiếp."
              ],
              [
                "Decorator khác kế thừa ở đâu?",
                "Decorator bọc object lúc runtime và xếp chồng được nhiều lớp; kế thừa cố định lúc compile và dễ bùng nổ số subclass."
              ],
              [
                "Facade dùng khi nào?",
                "Khi cần một điểm gọi đơn giản cho subsystem phức tạp gồm nhiều class."
              ],
              [
                "Khi nào dùng Builder?",
                "Object có nhiều tham số tuỳ chọn hoặc cần tạo từng bước — tránh constructor dài nhiều tham số."
              ]
            ]
          }
        ]
      },
      {
        "id": "lld-concurrency",
        "title": "5 · Concurrency",
        "topics": [
          {
            "id": "concurrency",
            "title": "Concurrency & Deadlock",
            "tldr": "Concurrency là xử lý nhiều tác vụ xen kẽ (không nhất thiết song song vật lý). Một process: lock, semaphore, condition variable. Nhiều server: distributed lock, queue, transaction, idempotency.",
            "table": {
              "head": [
                "Primitive",
                "Dùng để",
                "Python"
              ],
              "rows": [
                [
                  "Lock (Mutex)",
                  "Bảo vệ critical section, mutual exclusion",
                  "`threading.Lock`"
                ],
                [
                  "Semaphore",
                  "Giới hạn N thread cùng truy cập (connection pool, rate limit)",
                  "`threading.Semaphore(n)`"
                ],
                [
                  "Condition Variable",
                  "Chờ đến khi điều kiện đúng (producer–consumer)",
                  "`threading.Condition`"
                ]
              ]
            },
            "points": [
              "+ **Correctness** — giữ dữ liệu đúng khi nhiều thread cùng sửa: race condition, critical section, atomic, lock.",
              "+ **Coordination** — cho các thread chờ và báo nhau: producer–consumer, blocking queue, condition variable, thread pool.",
              "+ **Scarcity** — chia tài nguyên có hạn: semaphore, connection pool, rate limiting, backpressure.",
              "**Race condition** — kết quả phụ thuộc thứ tự chạy của các thread khi cùng truy cập critical section.",
              "**4 điều kiện deadlock (Coffman)** — Mutual exclusion · Hold and wait · No preemption · Circular wait.",
              "**Giải deadlock** — lock ordering (luôn lấy lock theo thứ tự cố định), timeout (`lock.acquire(timeout=5)`), deadlock detection (DB phát hiện và kill transaction).",
              "**Multi-server** — Distributed lock, Kafka / message queue (event-driven), Database transactions (ACID), Idempotency.",
              "+ **Idempotency** — gọi nhiều lần cho cùng kết quả như một lần; hiện thực bằng idempotency key + bảng ghi nhận request đã xử lý."
            ],
            "cards": [
              [
                "3 nhóm bài toán concurrency trong LLD (Hello Interview)?",
                "Correctness (dữ liệu đúng: lock, atomic), Coordination (chờ/báo nhau: blocking queue, condition variable), Scarcity (tài nguyên có hạn: semaphore, pool, rate limit)."
              ],
              [
                "4 điều kiện để xảy ra deadlock?",
                "Mutual exclusion, Hold and wait, No preemption, Circular wait — phá 1 trong 4 là hết deadlock."
              ],
              [
                "Cách phòng deadlock phổ biến nhất trong code?",
                "Lock ordering: mọi thread lấy các lock theo cùng một thứ tự cố định, phá điều kiện circular wait."
              ],
              [
                "Mutex vs Semaphore?",
                "Mutex: chỉ 1 thread vào critical section. Semaphore(n): tối đa n thread cùng lúc."
              ],
              [
                "Concurrency khác parallelism?",
                "Concurrency: nhiều tác vụ tiến triển xen kẽ. Parallelism: chạy đồng thời thật trên nhiều core."
              ]
            ]
          }
        ]
      },
      {
        "id": "lld-problems",
        "title": "6 · Problem Breakdowns",
        "topics": [
          {
            "id": "lld-problems-list",
            "title": "9 bài LLD kinh điển",
            "tldr": "+ Mỗi bài chuẩn bị sẵn: entity chính, pattern then chốt, câu hỏi mở rộng hay gặp. Danh sách lấy từ Hello Interview LLD.",
            "table": {
              "head": [
                "Bài",
                "Entity chính",
                "Pattern / kỹ thuật then chốt",
                "Câu mở rộng hay gặp"
              ],
              "rows": [
                [
                  "Connect Four",
                  "Game, Board, Player, Move",
                  "Kiểm tra thắng theo 4 hướng từ ô vừa đặt (O(1))",
                  "Bàn kích thước N, nhiều người chơi, undo"
                ],
                [
                  "Amazon Locker",
                  "Locker, Compartment (size), Package, AccessCode",
                  "Strategy chọn ngăn vừa kích thước; mã hết hạn",
                  "Ngăn nhiều kích thước, hết chỗ, trả hàng"
                ],
                [
                  "Elevator",
                  "ElevatorController, Elevator, Request, Direction",
                  "State (Idle/Moving/DoorOpen) + Strategy điều phối (SCAN/LOOK)",
                  "Nhiều thang, giờ cao điểm, thang bảo trì"
                ],
                [
                  "Parking Lot",
                  "ParkingLot, Level, Spot (type), Ticket, Vehicle",
                  "Strategy tính phí, Factory tạo spot/vehicle",
                  "Nhiều tầng, xe điện có sạc, đặt chỗ trước"
                ],
                [
                  "File System",
                  "Entry, File, Directory, Path",
                  "Composite (Directory chứa Entry)",
                  "Quyền truy cập, symlink, tìm kiếm"
                ],
                [
                  "Movie Ticket Booking",
                  "Movie, Show, Screen, Seat, Booking",
                  "Giữ ghế có hạn (lock theo show/seat) + thanh toán",
                  "Nhiều người chọn cùng ghế (concurrency)"
                ],
                [
                  "Logging Service",
                  "Logger, LogLevel, Appender, Formatter",
                  "Singleton + Chain of Responsibility / Strategy cho appender",
                  "Ghi bất đồng bộ (queue), xoay file log"
                ],
                [
                  "Rate Limiter",
                  "RateLimiter, Rule, Bucket",
                  "Strategy cho thuật toán (token bucket, sliding window)",
                  "Thread-safe, nhiều rule, cấu hình động"
                ],
                [
                  "Inventory Management",
                  "Product, Warehouse, StockLevel, Order",
                  "Observer cảnh báo tồn thấp; giữ hàng atomic",
                  "Nhiều kho, đặt trước, đồng thời trừ kho"
                ]
              ]
            },
            "points": [],
            "cards": [
              [
                "Elevator LLD dùng pattern nào?",
                "State cho trạng thái thang (Idle, Moving, DoorOpen) và Strategy cho thuật toán điều phối (SCAN/LOOK, gần nhất)."
              ],
              [
                "File System LLD dùng pattern nào?",
                "Composite: Directory và File cùng implement Entry, Directory chứa danh sách Entry con."
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "cloud",
    "title": "Container trên AWS",
    "subtitle": "ECS · EKS · Fargate",
    "sections": [
      {
        "id": "cloud-containers",
        "title": "1 · ECS & EKS",
        "topics": [
          {
            "id": "ecs",
            "title": "ECS chi tiết",
            "tldr": "ECS là orchestrator container **riêng của AWS**: khai báo Task Definition (image, CPU/RAM, IAM role) và Service (chạy N bản, gắn load balancer); AWS lo control plane và **không tính phí** phần đó. Chạy trên **Fargate** (không quản máy) hoặc **EC2** (tự quản máy). Đơn giản, tích hợp sâu với AWS, nhưng chỉ chạy trên AWS.",
            "sections": [
              {
                "title": "Khái niệm cốt lõi",
                "table": {
                  "head": [
                    "Khái niệm",
                    "Là gì",
                    "So với Kubernetes"
                  ],
                  "rows": [
                    [
                      "Cluster",
                      "Nhóm logic chứa service và capacity",
                      "Cluster (nhưng không có control plane phải trả phí)"
                    ],
                    [
                      "Task Definition",
                      "Bản thiết kế: image, CPU/RAM, port, env, secret, log, IAM role — có revision",
                      "Pod spec"
                    ],
                    [
                      "Task",
                      "Một bản đang chạy của task definition (1 hoặc nhiều container)",
                      "Pod"
                    ],
                    [
                      "Service",
                      "Giữ đúng N task chạy, gắn ALB, rolling deploy, auto scaling",
                      "Deployment + Service"
                    ],
                    [
                      "Capacity provider",
                      "Task chạy ở đâu: Fargate, Fargate Spot, hoặc EC2 Auto Scaling group",
                      "Node group / Karpenter"
                    ],
                    [
                      "Task role · Execution role",
                      "Task role: quyền **app** gọi AWS. Execution role: quyền **ECS** kéo image, đọc secret, ghi log",
                      "ServiceAccount + Pod Identity"
                    ]
                  ]
                }
              },
              {
                "title": "Fargate hay EC2?",
                "table": {
                  "head": [
                    "",
                    "Fargate",
                    "EC2"
                  ],
                  "rows": [
                    [
                      "Quản máy chủ",
                      "Không — AWS cấp compute cho từng task",
                      "Có — bạn quản ASG, AMI, vá OS"
                    ],
                    [
                      "Tính tiền",
                      "Theo vCPU/RAM của task mỗi giây",
                      "Theo instance, kể cả phần trống"
                    ],
                    [
                      "Giới hạn",
                      "Không GPU, không daemon trên host, khởi động chậm hơn vài chục giây",
                      "GPU, instance đặc thù, daemon, tận dụng Reserved/Spot"
                    ],
                    [
                      "Chọn khi",
                      "Mặc định cho hầu hết web/API, team nhỏ",
                      "Tải lớn ổn định cần tối ưu chi phí, GPU, yêu cầu host đặc biệt"
                    ]
                  ]
                }
              },
              {
                "title": "Networking, deploy, scaling",
                "points": [
                  "**awsvpc mode** — mỗi task có ENI và IP riêng trong VPC, security group gắn theo task. ALB dùng target type `ip`.",
                  "**Service discovery** — Service Connect / Cloud Map cho service gọi nhau bằng tên.",
                  "**Rolling deploy** — `minimumHealthyPercent` / `maximumPercent` điều khiển tốc độ; bật **deployment circuit breaker** để tự rollback khi task mới không healthy. Blue/green có sẵn hoặc qua CodeDeploy.",
                  "**Service Auto Scaling** — target tracking theo CPU, RAM hoặc số request trên ALB; scheduled scaling cho giờ cao điểm biết trước.",
                  "**Trên EC2** còn phải scale máy: capacity provider có managed scaling để ASG tự thêm instance khi task không có chỗ.",
                  "**Quan sát** — log qua `awslogs` hoặc FireLens; metric qua Container Insights."
                ]
              }
            ],
            "tips": [
              "Nói rõ chọn Fargate hay EC2 và vì sao — đó là quyết định riêng, tách khỏi ECS hay EKS.",
              "Phân biệt task role và execution role: hỏi “ai cần quyền này — app hay ECS?”.",
              "ECS không có version cluster để nâng cấp — lý do lớn khiến nó ít tốn công vận hành."
            ],
            "cards": [
              [
                "Task role khác execution role thế nào?",
                "Task role: quyền cho code trong container gọi AWS (S3, DynamoDB). Execution role: quyền cho ECS agent kéo image từ ECR, đọc secret, ghi log."
              ],
              [
                "Khi nào chọn ECS trên EC2 thay vì Fargate?",
                "Cần GPU, instance đặc thù hoặc daemon trên host; hoặc tải lớn ổn định muốn tối ưu chi phí bằng Reserved/Spot và bin packing."
              ],
              [
                "ECS tự xử lý thế nào khi một task chết?",
                "Service scheduler thấy số task running < desired count, ALB rút task khỏi target group, ECS khởi động task thay thế."
              ]
            ]
          },
          {
            "id": "eks",
            "title": "EKS chi tiết",
            "tldr": "EKS là **Kubernetes do AWS quản lý**: AWS chạy control plane (API server, etcd) trên nhiều AZ và tính phí theo giờ mỗi cluster; bạn chạy workload bằng Pod/Deployment chuẩn Kubernetes trên node EC2, Fargate hoặc Auto Mode. Mạnh ở hệ sinh thái (Helm, operator, GitOps, service mesh) và chạy được ngoài AWS, đổi lại vận hành phức tạp hơn ECS.",
            "sections": [
              {
                "title": "Kiến trúc: control plane và data plane",
                "table": {
                  "head": [
                    "Thành phần",
                    "Ai quản lý",
                    "Cần nhớ"
                  ],
                  "rows": [
                    [
                      "Control plane",
                      "AWS — API server, etcd, scheduler, controller, chạy đa AZ",
                      "Phí ~$0.10/giờ/cluster; extended support đắt hơn nhiều"
                    ],
                    [
                      "Managed node group",
                      "EKS quản vòng đời ASG EC2; bạn chọn instance và bấm cập nhật AMI",
                      "Vẫn trả tiền EC2; rolling update node tự động"
                    ],
                    [
                      "Self-managed nodes",
                      "Bạn tự quản ASG",
                      "Linh hoạt nhất, tốn công nhất"
                    ],
                    [
                      "Fargate",
                      "AWS — mỗi pod một micro-VM",
                      "Không DaemonSet, không GPU, không privileged pod"
                    ],
                    [
                      "Auto Mode",
                      "AWS quản cả node: chọn instance, vá, scale (dựa trên Karpenter)",
                      "Ít vận hành nhất trong EKS; có phí quản lý thêm"
                    ],
                    [
                      "Karpenter",
                      "Bạn cài (hoặc có sẵn trong Auto Mode)",
                      "Tạo node vừa khít với pod đang Pending trong khoảng một phút; thay Cluster Autoscaler"
                    ]
                  ]
                }
              },
              {
                "title": "Object Kubernetes hay dùng",
                "table": {
                  "head": [
                    "Object",
                    "Vai trò"
                  ],
                  "rows": [
                    [
                      "Pod",
                      "Đơn vị chạy nhỏ nhất (1+ container cùng network)"
                    ],
                    [
                      "Deployment / ReplicaSet",
                      "Giữ N pod, rolling update theo `maxSurge` / `maxUnavailable`"
                    ],
                    [
                      "Service",
                      "Địa chỉ ổn định cho nhóm pod: ClusterIP (nội bộ), LoadBalancer (NLB qua AWS LB Controller)"
                    ],
                    [
                      "Ingress",
                      "HTTP routing → ALB qua AWS Load Balancer Controller"
                    ],
                    [
                      "ConfigMap / Secret",
                      "Cấu hình và bí mật gắn vào pod"
                    ],
                    [
                      "HPA",
                      "Tự tăng giảm số pod theo CPU hoặc metric tuỳ chỉnh (KEDA theo độ dài queue)"
                    ],
                    [
                      "Namespace + RBAC",
                      "Chia cluster cho nhiều team, phân quyền trong cluster"
                    ],
                    [
                      "DaemonSet",
                      "Một pod trên mỗi node (agent log, monitoring)"
                    ],
                    [
                      "StatefulSet + PVC",
                      "Workload có trạng thái, volume EBS qua CSI driver (EBS gắn với 1 AZ)"
                    ],
                    [
                      "Job / CronJob",
                      "Tác vụ chạy một lần hoặc theo lịch"
                    ]
                  ]
                }
              },
              {
                "title": "Networking & phân quyền",
                "points": [
                  "**VPC CNI** — mỗi pod có IP thật trong VPC: gọi thẳng, dễ gắn security group, nhưng **tốn IP** subnet; số pod/node bị giới hạn theo số ENI (dùng prefix delegation để nới).",
                  "**Ingress** — AWS Load Balancer Controller tạo ALB/NLB từ Ingress/Service, đăng ký thẳng IP pod (target type `ip`).",
                  "**Hai lớp quyền** — AWS IAM quyết định ai gọi được API của EKS; Kubernetes **RBAC** quyết định ai làm gì trong cluster. Access Entries thay cho ConfigMap `aws-auth`.",
                  "**Pod gọi AWS** — gắn IAM role cho ServiceAccount qua **EKS Pod Identity** (mới, đơn giản) hoặc **IRSA** (OIDC). Không đặt access key trong pod.",
                  "**NetworkPolicy** — giới hạn pod nào được gọi pod nào (cần bật trong VPC CNI hoặc dùng Calico/Cilium)."
                ]
              },
              {
                "title": "Scaling 3 lớp",
                "points": [
                  "**HPA** — số pod theo CPU, RAM hoặc metric tuỳ chỉnh; **KEDA** scale theo sự kiện (độ dài SQS/Kafka lag), kể cả về 0.",
                  "**VPA** — gợi ý hoặc tự chỉnh CPU/RAM requests của pod.",
                  "**Node** — Karpenter (hoặc Cluster Autoscaler) thêm node khi có pod Pending, gom pod và xoá node thừa để tiết kiệm."
                ]
              },
              {
                "title": "Cái giá vận hành",
                "points": [
                  "**Nâng version Kubernetes** khoảng mỗi năm (standard support ~14 tháng/version); kèm nâng add-on: CoreDNS, kube-proxy, VPC CNI, LB Controller.",
                  "**Tự lắp ghép** — ingress, autoscaler, GitOps, monitoring (Prometheus/Grafana hoặc Container Insights) là các component riêng.",
                  "**Chi phí** — phí control plane mỗi cluster + node; bin packing tốt và Spot qua Karpenter có thể rẻ hơn ECS ở quy mô lớn."
                ]
              },
              {
                "title": "Câu hỏi hay bị hỏi sâu",
                "points": [
                  "**Pod Pending** — thiếu CPU/RAM trên node, hết IP trong subnet, hoặc node selector/taint không khớp.",
                  "**Noisy neighbor** — luôn đặt `requests` và `limits`; ResourceQuota theo namespace.",
                  "**Multi-tenant** — namespace + RBAC + NetworkPolicy + ResourceQuota; tenant cần cách ly mạnh thì tách cluster.",
                  "**Stateful** — EBS chỉ gắn trong 1 AZ: pod chuyển AZ sẽ không mount được; cân nhắc EFS hoặc dịch vụ managed (RDS, MSK)."
                ]
              }
            ],
            "tips": [
              "Nói EKS thì nói luôn compute: managed node group + Karpenter, Fargate, hay Auto Mode — và vì sao.",
              "Nhắc 2 lớp quyền (IAM + RBAC) và Pod Identity — câu hỏi bảo mật hay gặp.",
              "Đừng chọn EKS chỉ vì “chuẩn ngành”: phải nêu được thứ chỉ Kubernetes cho bạn."
            ],
            "cards": [
              [
                "AWS quản lý phần nào của EKS, bạn quản lý phần nào?",
                "AWS: control plane (API server, etcd, scheduler) đa AZ. Bạn: node (trừ Fargate/Auto Mode), add-on, version upgrade, workload, RBAC."
              ],
              [
                "Pod Pending thường do đâu?",
                "Không node nào đủ CPU/RAM theo requests, hết IP trong subnet (VPC CNI), hoặc taint/node selector không khớp."
              ],
              [
                "Pod trên EKS lấy quyền AWS thế nào cho an toàn?",
                "Gắn IAM role vào ServiceAccount qua EKS Pod Identity hoặc IRSA; pod nhận credential tạm, không đặt access key trong code."
              ],
              [
                "HPA và Karpenter khác nhau thế nào?",
                "HPA thay đổi số pod theo metric. Karpenter thay đổi số node: thấy pod Pending thì tạo node vừa khít, thừa thì gom và xoá node."
              ]
            ]
          },
          {
            "id": "ecs-vs-eks",
            "title": "ECS hay EKS?",
            "tldr": "Mặc định chọn **ECS + Fargate** khi team nhỏ, chỉ chạy trên AWS và muốn ít vận hành. Chọn **EKS** khi team đã quen Kubernetes, cần hệ sinh thái K8s (Helm, operator, GitOps, service mesh), phải chạy ngoài AWS, hoặc có platform team phục vụ nhiều team. Fargate hay EC2 là **quyết định thứ hai**, áp dụng cho cả hai.",
            "table": {
              "head": [
                "Tiêu chí",
                "ECS",
                "EKS"
              ],
              "rows": [
                [
                  "Bản chất",
                  "Orchestrator riêng của AWS",
                  "Kubernetes chuẩn (CNCF)"
                ],
                [
                  "Phí control plane",
                  "0",
                  "~$0.10/giờ mỗi cluster (~$73/tháng)"
                ],
                [
                  "Độ khó học",
                  "Thấp: task, service, cluster",
                  "Cao: pod, service, ingress, RBAC, Helm, CRD…"
                ],
                [
                  "Vận hành",
                  "Ít — không có version cluster phải nâng",
                  "Nâng version K8s + add-on định kỳ"
                ],
                [
                  "Compute",
                  "Fargate, EC2, ECS Anywhere",
                  "Managed/self-managed node, Fargate, Auto Mode, hybrid nodes"
                ],
                [
                  "Tính di động",
                  "Gắn với AWS",
                  "Manifest chạy được trên GKE, AKS, on-prem"
                ],
                [
                  "Hệ sinh thái",
                  "Dịch vụ AWS (CodeDeploy, Service Connect, CloudWatch)",
                  "Rất lớn: Helm, ArgoCD, KEDA, Istio, operator cho DB/Kafka"
                ],
                [
                  "Scaling",
                  "Service Auto Scaling + capacity provider",
                  "HPA/KEDA + Karpenter, linh hoạt hơn"
                ],
                [
                  "Phân quyền",
                  "IAM task role",
                  "IAM + RBAC + Pod Identity"
                ],
                [
                  "Hợp với",
                  "Một vài team, vài đến vài chục service, muốn ship nhanh",
                  "Platform team, nhiều team, workload đa dạng"
                ]
              ]
            },
            "sections": [
              {
                "title": "Tình huống → lựa chọn",
                "table": {
                  "head": [
                    "Tình huống",
                    "Chọn",
                    "Vì sao"
                  ],
                  "rows": [
                    [
                      "Startup 5 dev, 10 microservice web/API",
                      "ECS + Fargate",
                      "Không ai phải trực hạ tầng; không phí control plane"
                    ],
                    [
                      "Công ty có platform team, 200 service, 20 team",
                      "EKS",
                      "Namespace/RBAC cho nhiều team, GitOps, chuẩn hoá bằng Helm"
                    ],
                    [
                      "Phải chạy cả on-prem và cloud",
                      "EKS (hoặc Kubernetes nói chung)",
                      "Cùng manifest, cùng công cụ ở mọi nơi"
                    ],
                    [
                      "Cần operator chạy Kafka/Postgres trong cluster",
                      "EKS",
                      "Operator là khái niệm của Kubernetes"
                    ],
                    [
                      "ML training cần GPU, scale theo job",
                      "EKS + Karpenter (hoặc AWS Batch)",
                      "Tạo node GPU theo nhu cầu, Spot"
                    ],
                    [
                      "Container hoá monolith lần đầu",
                      "ECS + Fargate",
                      "Ít khái niệm mới nhất"
                    ],
                    [
                      "Traffic lẻ tẻ, xử lý ngắn theo sự kiện",
                      "Lambda trước tiên",
                      "Không cần container chạy thường trực"
                    ]
                  ]
                }
              },
              {
                "title": "Trả lời trong phỏng vấn",
                "points": [
                  "Đừng dừng ở “tuỳ”. Hỏi 3 câu: **team có kinh nghiệm Kubernetes không? có nhu cầu ngoài AWS không? có cần công cụ chỉ Kubernetes có không?** — cả ba “không” thì ECS.",
                  "**Image giống hệt nhau** — bắt đầu bằng ECS rồi chuyển sang EKS khi thật sự cần là hướng đi an toàn, vì cùng một Docker image chạy được trên cả hai.",
                  "**Chi phí** — quy mô nhỏ ECS rẻ hơn (không phí control plane, ít công vận hành); quy mô lớn EKS với bin packing + Spot có thể rẻ hơn, nhưng đừng quên chi phí con người."
                ]
              }
            ],
            "tips": [
              "Trong bài system design, “container service trên ECS/EKS” thường chỉ cần một dòng — chỉ đi sâu khi interviewer hỏi về hạ tầng.",
              "Phân tách 2 quyết định: orchestrator (ECS/EKS) và compute (Fargate/EC2)."
            ],
            "cards": [
              [
                "3 câu hỏi để chọn giữa ECS và EKS?",
                "Team có kinh nghiệm Kubernetes? Có cần chạy ngoài AWS? Có cần công cụ chỉ Kubernetes có (Helm chart, operator, ArgoCD, KEDA)? Cả ba không → ECS."
              ],
              [
                "Fargate có phải là lựa chọn thay cho ECS/EKS không?",
                "Không. Fargate là kiểu compute (không quản máy), dùng được cho cả ECS và EKS. Quyết định orchestrator và compute tách riêng."
              ],
              [
                "Vì sao ECS ít tốn công vận hành hơn EKS?",
                "Không có version cluster phải nâng, không add-on, không RBAC/CRD; networking và load balancer tích hợp sẵn."
              ]
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "arch",
    "title": "Kiến trúc & phương pháp",
    "subtitle": "Layered · Hexagonal · Onion · Clean · Microservices · TDD · BDD · DDD",
    "sections": [
      {
        "id": "arch-main",
        "title": "1 · Kiến trúc phần mềm",
        "topics": [
          {
            "id": "code-architecture",
            "title": "Kiến trúc code: Layered, Hexagonal, Onion, Clean, Vertical Slice",
            "tldr": "Các kiểu này đều trả lời một câu hỏi: **code nào được phép phụ thuộc vào code nào**. Layered cho phụ thuộc đi từ trên xuống nên business dính vào data access. Hexagonal, Onion, Clean **đảo ngược** để mọi phụ thuộc hướng vào domain — DB, web, framework chỉ là chi tiết cắm ở ngoài. Vertical Slice cắt theo **tính năng** thay vì theo tầng.",
            "table": {
              "head": [
                "Kiến trúc",
                "Ý tưởng chính",
                "Lợi",
                "Bất lợi",
                "Hợp khi"
              ],
              "rows": [
                [
                  "Layered (N-tier)",
                  "Presentation → Business → Data Access → DB; mỗi tầng chỉ gọi tầng ngay dưới",
                  "Dễ hiểu, framework hỗ trợ sẵn (Spring, Django, NestJS), người mới vào làm được ngay",
                  "Business phụ thuộc DB/ORM nên khó test thuần; thêm một tính năng phải chạm mọi tầng; dễ thành service “mỏng” chỉ chuyển tiếp",
                  "CRUD, app nhỏ–vừa, đội mới, deadline gấp"
                ],
                [
                  "Hexagonal (Ports & Adapters)",
                  "Core ở giữa; nói chuyện với bên ngoài qua **port** (interface); **adapter** cài đặt port cho từng công nghệ",
                  "Đổi DB, queue, kênh vào mà không chạm core; test core bằng adapter in-memory; nhiều kênh (REST, gRPC, consumer) dùng chung một use case",
                  "Nhiều interface và mapping DTO, code dài hơn; quá sức với CRUD đơn giản",
                  "Nhiều tích hợp bên ngoài, cần đổi hạ tầng, cần test nghiệp vụ kỹ"
                ],
                [
                  "Onion",
                  "Các vòng đồng tâm: Domain Model → Domain Services → Application Services → ngoài cùng là Infrastructure, UI, Tests",
                  "Domain hoàn toàn thuần; tách rõ luật nghiệp vụ lõi với điều phối ứng dụng",
                  "Nhiều vòng cần kỷ luật; ranh giới giữa các vòng bên trong dễ mơ hồ với người mới",
                  "Domain phức tạp, hệ thống enterprise sống lâu"
                ],
                [
                  "Clean Architecture",
                  "Entities → Use Cases → Interface Adapters → Frameworks & Drivers; **Dependency Rule**: phụ thuộc chỉ hướng vào trong",
                  "Độc lập framework, UI, DB; mỗi use case là một class rõ ràng; dễ test và đọc nghiệp vụ",
                  "Nhiều boilerplate (request/response model, presenter, mapper); dễ over-engineer",
                  "App sống lâu, nghiệp vụ dày, đội lớn cần quy ước chung"
                ],
                [
                  "Vertical Slice",
                  "Mỗi tính năng là một lát dọc chứa đủ endpoint → handler → truy vấn dữ liệu",
                  "Thêm tính năng không chạm code tính năng khác; ít abstraction; mỗi slice chọn cách làm vừa đủ",
                  "Dễ trùng lặp giữa các slice; luật nghiệp vụ dùng chung không có chỗ rõ ràng nếu không refactor đều đặn",
                  "Nhiều tính năng độc lập, CQRS, đội muốn ship nhanh"
                ]
              ]
            },
            "sections": [
              {
                "title": "Hexagonal, Onion, Clean khác nhau ở đâu?",
                "points": [
                  "**Cùng một nguyên lý** — Dependency Inversion: core định nghĩa interface (port/repository), lớp ngoài cài đặt → core không `import` bất kỳ thứ gì của DB hay web.",
                  "**Hexagonal** chỉ chia **trong / ngoài**, và phân biệt adapter **driving** (gọi vào: REST controller, CLI, consumer) với **driven** (bị gọi ra: DB, payment gateway, email).",
                  "**Onion** chia phần lõi thành nhiều vòng: domain model, domain services, application services.",
                  "**Clean** đặt tên vòng theo vai trò, mỗi use case là một class (interactor), và quy định dữ liệu qua ranh giới phải là DTO đơn giản, không phải entity hay object của framework.",
                  "**Thực tế** các đội thường gộp lại thành 4 phần: `domain` + `application` (use cases, ports) + `adapters` (in/out) + cấu hình hạ tầng — gọi chung là “Clean/Hexagonal”.",
                  "**MVC** không cùng loại: đó là pattern cho **tầng giao diện** (Model–View–Controller), nằm trong Presentation layer hoặc trong một driving adapter."
                ]
              },
              {
                "title": "Cấu trúc thư mục ví dụ",
                "table": {
                  "head": [
                    "Kiến trúc",
                    "Thư mục"
                  ],
                  "rows": [
                    [
                      "Layered",
                      "`controllers/` `services/` `repositories/` `models/`"
                    ],
                    [
                      "Hexagonal",
                      "`domain/` · `application/ports/in` `application/ports/out` · `adapters/in/web` `adapters/out/postgres`"
                    ],
                    [
                      "Onion",
                      "`Domain.Model/` `Domain.Services/` `Application/` `Infrastructure/` `Web/`"
                    ],
                    [
                      "Clean",
                      "`entities/` `usecases/` `interface_adapters/` (controllers, presenters, gateways) `frameworks/` (web, db)"
                    ],
                    [
                      "Vertical Slice",
                      "`features/place_order/` (endpoint, handler, query) · `features/cancel_order/` · `shared/`"
                    ]
                  ]
                }
              },
              {
                "title": "Chọn thế nào",
                "points": [
                  "**Mặc định Layered** cho CRUD và app nhỏ: ít khái niệm, ship nhanh.",
                  "**Chuyển sang Hexagonal/Clean** khi logic nghiệp vụ dày, có nhiều hệ thống bên ngoài phải tích hợp, hoặc cần test nghiệp vụ mà không dựng DB.",
                  "**Vertical Slice** khi có nhiều tính năng độc lập; có thể kết hợp — bên trong một slice phức tạp vẫn dùng port/adapter.",
                  "**Điều quan trọng là hướng phụ thuộc**, không phải tên thư mục: đặt thư mục kiểu Clean nhưng use case vẫn `import` ORM thì vẫn là Layered."
                ]
              }
            ],
            "tips": [
              "Khi interviewer hỏi, vẽ mũi tên phụ thuộc: Layered đi xuống tới DB; Hexagonal/Clean mọi mũi tên chỉ vào domain.",
              "Nêu được một tình huống cụ thể mà kiến trúc giúp: “đổi Stripe sang Adyen chỉ viết adapter mới”.",
              "Thừa nhận chi phí: với CRUD, Clean Architecture thường là over-engineering."
            ],
            "cards": [
              [
                "Hexagonal, Onion, Clean giống nhau ở điểm nào?",
                "Cùng áp dụng Dependency Inversion: core định nghĩa interface, lớp ngoài cài đặt, nên mọi phụ thuộc hướng vào domain và core không biết DB/web."
              ],
              [
                "Port và adapter là gì?",
                "Port là interface do core định nghĩa (use case vào, repository/gateway ra). Adapter là code cài đặt port cho một công nghệ cụ thể (REST controller, Postgres repository, Stripe client)."
              ],
              [
                "Vì sao Layered khó unit test business logic?",
                "Service ở tầng business gọi thẳng repository/ORM cụ thể, nên test service phải dựng DB hoặc mock sâu vào ORM."
              ],
              [
                "Vertical Slice giải quyết vấn đề gì của Layered?",
                "Thêm một tính năng trong Layered phải sửa ngang qua mọi tầng; Vertical Slice gom mọi thứ của tính năng vào một chỗ nên thêm/sửa không đụng tính năng khác."
              ]
            ]
          },
          {
            "id": "system-architecture",
            "title": "Kiến trúc hệ thống: Monolith, Microservices, Event-driven, Serverless",
            "tldr": "Bắt đầu bằng **Modular Monolith** — một deployable, ranh giới module rõ ràng — rồi chỉ tách **Microservice** khi có lý do cụ thể: scale riêng, team deploy độc lập, công nghệ khác hẳn. Đây là chuyện **triển khai và ranh giới runtime**, khác với cách tổ chức code bên trong. Event-driven và Serverless là cách các phần giao tiếp và chạy, dùng kết hợp được.",
            "table": {
              "head": [
                "Kiến trúc",
                "Ý tưởng chính",
                "Lợi",
                "Bất lợi",
                "Hợp khi"
              ],
              "rows": [
                [
                  "Monolith",
                  "Một ứng dụng, một lần deploy, thường một database",
                  "Đơn giản nhất: debug, transaction, deploy đều dễ; latency gọi hàm nội bộ",
                  "Code dễ rối khi lớn; scale phải nhân cả khối; một lỗi (memory leak) kéo sập tất cả; nhiều team deploy chung dễ tắc",
                  "Sản phẩm mới, đội nhỏ, chưa rõ ranh giới nghiệp vụ"
                ],
                [
                  "Modular Monolith",
                  "Một deployable nhưng chia module có API nội bộ rõ, mỗi module sở hữu schema riêng",
                  "Giữ được độ đơn giản của monolith mà vẫn có ranh giới; tách thành service sau này dễ",
                  "Cần kỷ luật để module không gọi tắt vào nội bộ nhau; vẫn scale và deploy chung",
                  "Mặc định hợp lý cho đa số đội trước khi có lý do tách"
                ],
                [
                  "Microservices",
                  "Mỗi service một nghiệp vụ, deploy riêng, sở hữu database riêng, gọi nhau qua mạng",
                  "Scale riêng phần nóng; team deploy độc lập; cô lập lỗi; chọn công nghệ riêng",
                  "Phức tạp phân tán: network lỗi, latency, transaction phải dùng saga, khó debug, cần observability và platform mạnh",
                  "Nhiều team, nghiệp vụ đã ổn định ranh giới, có nhu cầu scale khác nhau rõ rệt"
                ],
                [
                  "Event-driven",
                  "Service phát event (`OrderPlaced`) lên broker; service khác tự nghe và phản ứng",
                  "Lỏng lẻo: thêm consumer không sửa producer; hấp thụ traffic đột biến; dễ fan-out",
                  "Luồng khó theo dõi; eventual consistency; phải xử lý trùng, thứ tự, schema event",
                  "Nhiều hệ thống cần phản ứng với cùng sự kiện, xử lý bất đồng bộ"
                ],
                [
                  "Serverless",
                  "Viết function, nền tảng lo server và scale theo request (Lambda + dịch vụ managed)",
                  "Không quản server; trả tiền theo lượt chạy; scale về 0",
                  "Cold start; giới hạn thời gian chạy; vendor lock-in; khó test cục bộ; đắt khi tải cao liên tục",
                  "Tải lẻ tẻ, theo sự kiện, glue code, MVP"
                ]
              ]
            },
            "sections": [
              {
                "title": "Những điều hay bị hỏi",
                "points": [
                  "**Distributed monolith** — tách thành nhiều service nhưng vẫn dùng chung database hoặc phải deploy cùng lúc: nhận đủ cái khó của microservices mà không có cái lợi.",
                  "**Conway’s Law** — kiến trúc hệ thống phản chiếu cấu trúc giao tiếp của tổ chức; ranh giới service nên khớp ranh giới team.",
                  "**Database per service** — mỗi service sở hữu dữ liệu của mình; service khác lấy qua API hoặc event, không đọc thẳng bảng.",
                  "**Transaction xuyên service** — không dùng được ACID transaction; thay bằng Saga + compensating action, hoặc outbox để phát event tin cậy.",
                  "**CQRS** — tách mô hình ghi (command) và mô hình đọc (query), thường đi cùng event-driven để dựng read model riêng tối ưu cho truy vấn."
                ]
              }
            ],
            "tips": [
              "Đừng mở đầu bằng microservices trong phỏng vấn system design trừ khi đề bài cần; nói rõ lý do tách từng service.",
              "Tách service theo bounded context (DDD), không theo tầng kỹ thuật (“service DB”, “service API”)."
            ],
            "related": [
              "saga"
            ],
            "cards": [
              [
                "Modular monolith khác monolith thường ở đâu?",
                "Vẫn một deployable nhưng chia module có API nội bộ và sở hữu dữ liệu riêng → giữ được độ đơn giản, khi cần vẫn tách thành service được."
              ],
              [
                "Distributed monolith là gì?",
                "Nhiều service nhưng dùng chung DB hoặc phải deploy cùng nhau — chịu độ phức tạp phân tán mà không có lợi ích deploy/scale độc lập."
              ],
              [
                "Khi nào nên tách microservice?",
                "Khi có lý do cụ thể: một phần cần scale khác hẳn, team cần deploy độc lập, hoặc cần công nghệ khác — và ranh giới nghiệp vụ đã ổn định."
              ]
            ]
          },
          {
            "id": "dev-methods",
            "title": "Phương pháp phát triển: TDD, BDD, ATDD, DDD và hơn thế",
            "tldr": "TDD là cách **viết code**: test trước, code sau, vòng Red → Green → Refactor. BDD và ATDD đưa ý tưởng đó lên mức **hành vi và tiêu chí nghiệm thu** để dev, QA, PO hiểu chung. DDD là cách **thiết kế mô hình nghiệp vụ**, thường đi cùng Hexagonal/Clean. Contract testing và property-based testing là hai kỹ thuật test bổ sung khi hệ thống lớn dần.",
            "table": {
              "head": [
                "Phương pháp",
                "Bắt đầu từ",
                "Lợi",
                "Bất lợi",
                "Dùng khi"
              ],
              "rows": [
                [
                  "TDD (Test-Driven Development)",
                  "Một unit test nhỏ chạy đỏ, rồi viết code tối thiểu cho xanh, rồi refactor",
                  "Code nhỏ, dễ test; có lưới an toàn khi refactor; mỗi bug fix kèm test tái hiện",
                  "Chậm lúc đầu; test gắn chặt implementation thì dễ vỡ khi refactor; khó áp cho UI hay code đang khám phá",
                  "Logic nghiệp vụ, thư viện, thuật toán, sửa bug"
                ],
                [
                  "BDD (Behavior-Driven Development)",
                  "Kịch bản hành vi `Given / When / Then` viết cùng PO, QA bằng ngôn ngữ nghiệp vụ",
                  "Ngôn ngữ chung giữa business và dev; kịch bản thành tài liệu sống, chạy được",
                  "Tốn công duy trì file Gherkin và step definition; chạy chậm nếu qua UI; dễ thành hình thức",
                  "Luật nghiệp vụ phức tạp, nhiều bên cùng quyết định"
                ],
                [
                  "ATDD (Acceptance Test-Driven Development)",
                  "Acceptance test cho tiêu chí nghiệm thu của story, viết trước khi làm",
                  "Định nghĩa “xong” rõ ràng, giảm hiểu sai yêu cầu",
                  "Acceptance test thường là integration test: chậm, tốn hạ tầng",
                  "Story có tiêu chí rõ, team có QA tham gia sớm"
                ],
                [
                  "DDD (Domain-Driven Design)",
                  "Làm mô hình nghiệp vụ cùng chuyên gia domain: ubiquitous language, bounded context, aggregate",
                  "Quản được nghiệp vụ phức tạp; ranh giới module/service đúng chỗ",
                  "Tốn thời gian học và thảo luận; overkill cho CRUD",
                  "Domain phức tạp: tài chính, bảo hiểm, logistics, đặt chỗ"
                ],
                [
                  "Consumer-Driven Contract Testing",
                  "Consumer khai báo hợp đồng API mong đợi (Pact); provider chạy kiểm tra hợp đồng trong CI",
                  "Bắt breaking change trước khi deploy mà không cần E2E chậm",
                  "Cần contract broker và kỷ luật giữa các team",
                  "Microservices nhiều team gọi nhau"
                ],
                [
                  "Property-Based Testing",
                  "Khai báo tính chất luôn đúng; framework (Hypothesis, fast-check) tự sinh hàng trăm input",
                  "Tìm edge case con người không nghĩ ra, tự thu gọn về ví dụ nhỏ nhất",
                  "Khó nghĩ ra property đúng; chạy lâu hơn; cần cố định seed để tái hiện",
                  "Parser, tính toán, serialize/deserialize, luật biên"
                ]
              ]
            },
            "sections": [
              {
                "title": "Chúng kết hợp với nhau thế nào",
                "points": [
                  "**Double-loop TDD** — vòng ngoài là acceptance test (BDD/ATDD) mô tả hành vi; vòng trong là nhiều vòng TDD unit test để hiện thực hành vi đó.",
                  "**DDD + Hexagonal/Clean** — DDD cho biết domain có gì (entity, value object, aggregate, domain event); Hexagonal/Clean cho biết đặt domain đó ở đâu để không dính hạ tầng.",
                  "**Testing pyramid** — nhiều unit test (nhanh, rẻ), ít integration test, rất ít E2E test (chậm, dễ flaky)."
                ]
              },
              {
                "title": "DDD: các khái niệm cần biết",
                "table": {
                  "head": [
                    "Khái niệm",
                    "Là gì"
                  ],
                  "rows": [
                    [
                      "Ubiquitous language",
                      "Một bộ từ ngữ chung giữa business và code: tên class, method dùng đúng thuật ngữ nghiệp vụ"
                    ],
                    [
                      "Bounded context",
                      "Phạm vi mà một mô hình có nghĩa nhất quán; “Customer” ở Billing khác “Customer” ở Shipping"
                    ],
                    [
                      "Entity",
                      "Đối tượng có danh tính, sống qua thời gian (Order #123)"
                    ],
                    [
                      "Value object",
                      "Đối tượng định nghĩa bằng giá trị, bất biến (Money 50 USD, Address)"
                    ],
                    [
                      "Aggregate",
                      "Cụm entity sửa cùng nhau qua một gốc (aggregate root), là ranh giới transaction"
                    ],
                    [
                      "Domain event",
                      "Sự kiện nghiệp vụ đã xảy ra (`OrderPlaced`), để phần khác phản ứng"
                    ]
                  ]
                }
              },
              {
                "title": "Không phải phương pháp code nhưng hay bị hỏi",
                "points": [
                  "**Agile / Scrum / Kanban** — cách tổ chức công việc của team (sprint, backlog, WIP limit), không quy định cách viết code.",
                  "**XP (Extreme Programming)** — gói thực hành kỹ thuật: TDD, pair programming, continuous integration, refactor liên tục, release nhỏ.",
                  "**Pair / Mob programming** — hai hoặc cả nhóm cùng viết một đoạn code: review tức thời, lan truyền kiến thức.",
                  "**Trunk-based development** — mọi người merge vào nhánh chính nhiều lần mỗi ngày, ẩn tính năng dở bằng feature flag."
                ]
              }
            ],
            "tips": [
              "Phân biệt rõ khi trả lời: TDD/BDD là cách viết và kiểm chứng code; DDD là cách thiết kế mô hình; Scrum/Kanban là cách tổ chức công việc.",
              "Khi nói về TDD, nhắc vòng Red → Green → Refactor và lợi ích thật: refactor an toàn, không phải “để có coverage”."
            ],
            "cards": [
              [
                "3 bước của TDD?",
                "Red: viết test chạy đỏ. Green: viết code tối thiểu cho test xanh. Refactor: dọn code khi vẫn giữ test xanh."
              ],
              [
                "TDD khác BDD thế nào?",
                "TDD bắt đầu từ unit test do dev viết, kiểm tra từng đơn vị code. BDD bắt đầu từ kịch bản hành vi Given/When/Then viết cùng business, kiểm tra hành vi hệ thống."
              ],
              [
                "DDD có phải kiến trúc không?",
                "Không. DDD là cách thiết kế mô hình nghiệp vụ (bounded context, aggregate…); thường hiện thực trong kiến trúc Hexagonal/Clean."
              ],
              [
                "Property-based testing hơn example-based ở đâu?",
                "Framework tự sinh rất nhiều input để kiểm tra một tính chất luôn đúng, tìm được edge case (biên, giá trị lạ) mà ví dụ viết tay bỏ sót."
              ]
            ]
          }
        ]
      }
    ]
  }
];

/* Nhánh trên Miro đang trống — đã bổ sung nội dung trong prototype này */
window.MIRO_GAPS = [
  ["Security", "Gốc CS › Security trống — phần auth/rate limit đã gom vào API Design."],
  ["4 - Database", "Gốc CS › 4 - Database trống — nội dung DB nằm trong Key Technologies › Core Database."],
  ["Polymorphism, Inheritance, Encapsulation", "OOP › 4 tính chất — chỉ Abstraction có nội dung."],
  ["Factory Method", "Chỉ có link Hello Interview, chưa có định nghĩa."],
  ["CDN, Load Balancer, API Gateway", "Key Technologies — 3 node trống."],
  ["Streams / Event Sourcing, Distributed Lock", "Key Technologies — node trống (Distributed Lock có nội dung ở nhánh Concurrency)."],
  ["Core Entities, Data Flow", "Delivery Framework — chưa ghi nội dung."],
  ["Graph, Binary Tree, DFS, BFS, Backtracking, Greedy, DP", "DSA — chỉ có tên, chưa có khi nào dùng."],
  ["Numbers to Know, LLD Delivery Framework", "Hello Interview có, Miro chưa có nhánh."],
  ["Question Breakdowns, Technology Deep Dives", "Miro chưa có bài System Design / LLD nào và chưa có deep dive công nghệ — xem tab Bài SD."],
];

/* Lộ trình ôn — thứ tự điều hướng của toàn bộ app */
window.ROADMAP = [
  { id: "s1", title: "Khung & nền móng", goal: "Biết cách trình bày một bài và các khối cơ bản nhất: mạng, API, mô hình dữ liệu, database.",
    topics: ["delivery", "networking", "api-design", "data-modeling", "indexing", "core-db"] },
  { id: "s2", title: "Scale dữ liệu", goal: "Hiểu khi nào phải mở rộng và mở rộng bằng cách nào: cache, shard, consistent hashing, CAP.",
    topics: ["caching", "sharding", "consistent-hashing", "cap", "numbers"] },
  { id: "s3", title: "Building blocks", goal: "Mỗi công nghệ giải bài gì và giới hạn ở đâu. Học kỹ Redis và Kafka trước — xuất hiện trong gần như mọi bài.",
    topics: ["redis", "kafka", "queue", "streams", "dist-lock", "dist-cache", "blob", "search", "lb-gateway-cdn", "tech-cheatsheet", "bigdata-ds"] },
  { id: "s4", title: "Common patterns", goal: "Ghép concept + công nghệ thành lời giải cho 8 dạng bài lặp đi lặp lại.",
    topics: ["patterns"] },
  { id: "s5", title: "Luyện bài System Design", goal: "Tự nói Requirements → HLD trong 15–20 phút rồi mới mở lời giải. Đi từ Khởi động tới Nâng cao.",
    problems: true },
  { id: "arch", title: "Kiến trúc phần mềm & phương pháp", goal: "Học song song: cách tổ chức code (Layered → Hexagonal/Clean), kiến trúc hệ thống (Monolith → Microservices) và phương pháp phát triển (TDD, BDD, DDD).", parallel: true,
    topics: ["code-architecture", "system-architecture", "dev-methods"] },
  { id: "cloud", title: "Container trên AWS: ECS & EKS", goal: "Học song song khi cần trả lời câu hỏi hạ tầng: ECS → EKS → khi nào chọn cái nào.", parallel: true,
    topics: ["ecs", "eks", "ecs-vs-eks"] },
  { id: "lld", title: "Low-Level Design", goal: "Học song song: OOP → nguyên tắc → pattern → concurrency → luyện bài.", parallel: true,
    topics: ["lld-delivery", "oop-pillars", "solid", "principles-other", "patterns-gof", "concurrency", "lld-problems-list"] },
  { id: "dsa", title: "Coding · DSA", goal: "30–45 phút mỗi ngày theo pattern, song song với các giai đoạn trên.", parallel: true,
    topics: ["bigo", "ds", "algo"] },
];
