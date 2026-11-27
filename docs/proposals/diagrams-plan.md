# Kế hoạch sơ đồ SVG tĩnh

Đi qua mọi topic và problem, hỏi: có cấu trúc nào người học hiểu nhanh hơn hẳn nhờ một hình tĩnh, mà sim hiện có chưa thể hiện? Quy ước vẽ: D11 và cuối `content/_TEMPLATE.js`.

## Đã vẽ (theo thứ tự ưu tiên)

| # | Topic / problem | File | Sơ đồ | Vì sao cần | Nguồn |
|---|---|---|---|---|---|
| 1 | `networking` | `networking-layers-tcp.svg` | Gói tin bọc 3 header (IP, TCP, HTTP) + ai đọc tới đâu (router, L4 LB, L7 LB); TCP 3-way handshake với seq/ack | Bảng 3 tầng chỉ là chữ; sim `lb` cho thấy routing chứ không cho thấy vì sao L4 không đọc được URL; handshake = 1 RTT chưa có hình | https://www.rfc-editor.org/rfc/rfc9293.html |
| 2 | `indexing` | `indexing-btree.svg` | B-Tree: root → leaf page, leaf nối nhau, range scan đi xuống một lần rồi quét ngang | Chưa có sim nào; "vì sao B-Tree làm được range còn hash thì không" cần thấy thứ tự ở leaf | https://www.postgresql.org/docs/current/btree.html |
| 3 | `indexing` | `indexing-composite-index.svg` | Index `(Ho, Ten)` sắp theo Ho rồi Ten; 3 query: khối liền / một dòng / rải rác | Leftmost prefix là quy tắc hay bị hỏi, nhìn thứ tự là hiểu ngay | https://dev.mysql.com/doc/refman/8.4/en/multiple-column-indexes.html |
| 4 | `sharding` | `sharding-range-vs-hash.svg` | Range-based vs hash-based: query khoảng, hot spot khi key tăng dần, scatter-gather | Sim `hash-ring` chỉ nói consistent hashing, không so range với hash | https://www.mongodb.com/docs/manual/sharding/ |
| 5 | `cap` | `cap-pacelc.svg` | Cây PACELC: có partition → A/C, không partition → L/C, ví dụ hệ thống theo bài báo gốc | Sim `cap` chỉ có nhánh partition (CP/AP); nhánh "Else" chưa có hình | https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf |
| 6 | `caching` | `caching-tiers.svg` | 4 chỗ đặt cache trên đường request (client, CDN, in-process mỗi instance, Redis dùng chung) → DB | Sim `cache-aside`, `cache-write`, `stampede` đều chỉ có app + cache + DB, không có client/CDN | https://aws.amazon.com/caching/ |
| 7 | `bigo` | `bigo-growth.svg` | Đường tăng trưởng O(1)…O(n²) + số phép tính khi n = 10⁵ so với ~10⁸/giây | Sim `binary-search` chỉ có log n; bảng chưa cho thấy độ dốc | (không cần — toán) |
| 8 | `bigdata-ds` | `bigdata-ds-bloom-filter.svg` | Bloom filter 12 bit, k = 3: thêm 2 phần tử, 1 query âm chắc chắn, 1 false positive | Bảng chỉ nói "có false positive, không false negative"; hình cho thấy vì sao | https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/ |
| 9 | `lb-gateway-cdn` | `lb-gateway-cdn-request-path.svg` | Đường đi: DNS → CDN edge (hit/miss → origin) cho static; API Gateway → LB → instance cho API | Ba thành phần hay bị nhầm vị trí; sim `lb` chỉ có LB | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html |
| 10 | `streams` | `streams-event-sourcing.svg` | Event store append-only, state = fold, snapshot, projection ra read model | Topic chưa có sim nào; fold + snapshot dễ hiểu bằng hình | https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing |
| 11 | problem `uber` | `uber-geohash.svg` | Geohash: bit kinh/vĩ độ xen kẽ, prefix chung = ô lớn chung; GEOSEARCH quét 1+8 ô rồi lọc theo bán kính | HLD sim chỉ có hộp "Redis GEO"; cơ chế tìm gần chưa có hình | https://redis.io/docs/latest/commands/geoadd/ |

## Đã xem, không vẽ (sim đã thể hiện)

| Topic | Sim đã có |
|---|---|
| `code-architecture` (Layered/Hexagonal/Onion/Clean/Vertical Slice) | `arch-dependency` vẽ từng kiến trúc và hướng phụ thuộc |
| `system-architecture` | `sys-arch-impact` |
| `ecs`, `eks`, `ecs-vs-eks` | `container-stack` (ai quản lý lớp nào), `ecs-flow`, `eks-flow`, `container-decide` |
| `consistent-hashing` | `hash-ring` (tương tác) |
| `kafka`, `redis` | đã có SVG + nhiều sim |
| `queue`, `dist-lock`, `concurrency`, `core-db` (isolation), `api-design` (rate limit, N+1), `search` (inverted index), `blob` (presigned), `patterns` | `queue`, `redlock`, `deadlock`, `isolation`, `token-bucket`, `n-plus-one`, `inverted-index`, `presigned`, `saga`/`seat`/`long-task`/`realtime`/`replica-lag` |
| `patterns-gof` | `observer`, `vending` |
| `dev-methods` | `tdd-codewalk` |
| Problem còn lại | HLD sim của từng bài đã vẽ thành phần; không có cấu trúc dữ liệu riêng nào cần hình ngoài các mục trên |

## Đề xuất, chưa vẽ

| Topic | Sơ đồ | Ghi chú |
|---|---|---|
| `numbers` | Thang latency (L1 → RAM → SSD → mạng cùng DC → xuyên lục địa) trên trục log | Cần nguồn chính thức cho từng con số; số liệu phổ biến không đến từ tài liệu vendor |
| `core-db` | B-Tree vs LSM-tree (memtable, SSTable, compaction) | Topic hiện chưa nói LSM; chờ nội dung |
| `ds` | Heap dạng cây ↔ mảng (`i → 2i+1, 2i+2`) | Hữu ích cho DSA, ưu tiên thấp |
| `bigdata-ds` | Count-Min Sketch (d hàng × w cột, lấy min) | Dùng cho problem `top-k` |
| `data-modeling` | Normalize vs denormalize một bảng đơn hàng | Chờ xem nội dung topic |
| `eks` | Control plane (AWS quản lý) vs data plane (node của bạn) | `eks-flow` + `container-stack` đã gần đủ |
| problem `web-crawler` | Bloom filter "URL đã thấy" | Dùng lại hình Bloom filter bằng cách thêm vào `diagrams` của problem nếu cần |
