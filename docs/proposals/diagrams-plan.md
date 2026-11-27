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
| 12 | `core-db` | `core-db-btree-vs-lsm.svg` | B-Tree sửa page tại chỗ vs LSM-Tree: memtable + commit log → flush tuần tự ra SSTable → compaction; đường đọc qua Bloom filter | Bảng của topic chỉ có một câu về LSM; đánh đổi ghi/đọc thấy ngay trên hình | https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html |
| 13 | `bigdata-ds` | `bigdata-ds-count-min-sketch.svg` | 3 × 8 bộ đếm, ví dụ A/B/C và phần tử D chưa thấy bị đếm dư | "Chỉ đếm dư" cần thấy va chạm mới hiểu | https://redis.io/docs/latest/develop/data-types/probabilistic/count-min-sketch/ |
| 14 | `data-modeling` | `data-modeling-denormalize.svg` | venues/events chuẩn hoá vs chép `venue_name`; đọc JOIN vs đổi tên sửa 1 + N dòng | Bước 5 của topic dùng đúng ví dụ `venue_name` | https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description (bài lưu trữ) |
| 15 | `ds` | `ds-heap-array.svg` | Min-heap dạng cây ↔ mảng, con ở 2i+1/2i+2 | Bảng nói "cây nhị phân lưu trong mảng" mà chưa có hình | https://docs.python.org/3/library/heapq.html |
| 16 | `eks` | `eks-control-data-plane.svg` | Control plane (≥2 API server, 3 etcd trên 3 AZ) vs data plane (node group, Karpenter/Auto Mode, Fargate) | `eks-flow` chỉ có một hộp "control plane" | https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html |
| 17 | `container-basics` | `container-basics-vm-vs-container.svg` | VM: hypervisor, mỗi VM guest OS + kernel; container: một kernel host, mỗi container một bộ namespace + cgroup | Bảng so sánh chỉ là chữ; `container-stack` nói ai quản lý lớp nào trên AWS, không nói kernel | https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/, https://man7.org/linux/man-pages/man7/namespaces.7.html |
| 18 | `container-basics` | `container-basics-image-layers.svg` | Layer chỉ đọc dùng chung (digest), layer ghi được của từng container, copy-up khi ghi lần đầu | "Copy-on-write" và "xoá container mất dữ liệu" cần thấy hai lớp | https://docs.docker.com/engine/storage/drivers/, OCI image-spec `layer.md`, `descriptor.md` |
| 19 | `dockerfile` | `dockerfile-multi-stage.svg` | Stage build có gì, chỉ `node_modules` + `dist/` `COPY --from=build` sang stage distroless, `USER 10001:10001` | Sim `docker-build-cache` nói cache, không nói stage | https://docs.docker.com/build/building/multi-stage/, https://docs.docker.com/build/building/best-practices/, https://github.com/GoogleContainerTools/distroless |
| 20 | `k8s-core` | `k8s-core-components.svg` | Control plane + node; luồng trạng thái qua kube-apiserver (chỉ nó chạm etcd), CRI; luồng traffic theo luật mạng do kube-proxy cài | `eks-control-data-plane.svg` là góc nhìn AWS; `k8s-reconcile` không có kube-proxy/CRI | https://kubernetes.io/docs/concepts/overview/components/, …/architecture/cri/, …/reference/networking/virtual-ips/ |
| 21 | `k8s-core` | `k8s-core-deployment-service-gateway.svg` | Deployment → ReplicaSet v1/v2 giữa rolling update → pod; Service chọn theo label (cả v1, v2), EndpointSlice chỉ pod Ready; HTTPRoute `parentRefs`/`backendRefs` | Quan hệ sở hữu vs chọn theo label vs tham chiếu hay bị trộn | https://kubernetes.io/docs/concepts/workloads/controllers/deployment/, …/services-networking/service/, …/endpoint-slices/, …/gateway/ |
| — | problem `web-crawler` | dùng lại `bigdata-ds-bloom-filter.svg` | Bảng "URL đã thấy" | Deep dive của bài nói đúng cơ chế này | Redis Bloom filter docs |
| — | problem `top-k` | dùng lại `bigdata-ds-count-min-sketch.svg` | CMS + heap khi chấp nhận sai số | Deep dive nêu đúng phương án này | Redis Count-min sketch docs |

## Đã xem, không vẽ (sim đã thể hiện)

| Topic | Sim đã có |
|---|---|
| `code-architecture` (Layered/Hexagonal/Onion/Clean/Vertical Slice) | `arch-dependency` vẽ từng kiến trúc và hướng phụ thuộc |
| `system-architecture` | `sys-arch-impact` |
| `ecs`, `ecs-vs-eks` (và `eks` ngoài sơ đồ #16) | `container-stack` (ai quản lý lớp nào), `ecs-flow`, `eks-flow`, `container-decide` |
| `consistent-hashing` | `hash-ring` (tương tác) |
| `kafka`, `redis` | đã có SVG + nhiều sim |
| `queue`, `dist-lock`, `concurrency`, `core-db` (isolation), `api-design` (rate limit, N+1), `search` (inverted index), `blob` (presigned), `patterns` | `queue`, `redlock`, `deadlock`, `isolation`, `token-bucket`, `n-plus-one`, `inverted-index`, `presigned`, `saga`/`seat`/`long-task`/`realtime`/`replica-lag` |
| `patterns-gof` | `observer`, `vending` |
| `dev-methods` | `tdd-codewalk` |
| Problem còn lại | HLD sim của từng bài đã vẽ thành phần; không có cấu trúc dữ liệu riêng nào cần hình ngoài các mục trên |

## Đã xem, không cần hình (nội dung là danh sách/khung, hình không thêm gì)

| Topic | Lý do |
|---|---|
| `delivery`, `lld-delivery`, `lld-problems-list`, `tech-cheatsheet` | Khung trả lời và danh sách; bảng đã đủ |
| `oop-pillars`, `solid`, `principles-other` | Nguyên tắc thiết kế; ví dụ code giải thích tốt hơn hình |
| `algo` | Nhận dạng pattern từ đề; sim `binary-search` đã có cho phần có thể vẽ |
| `dist-cache` | Topic tự trỏ về `caching`; sơ đồ 4 tầng cache + `redis-cluster-slots` đã phủ |
| `api-design`, `search` | `token-bucket`, `n-plus-one`, `inverted-index` đã phủ phần cơ chế |

## Không vẽ

| Topic | Lý do |
|---|---|
| `numbers` (thang latency) | Không có nguồn chính thức hiện hành cho bộ số RAM/SSD/mạng: nguồn gốc là slide của Jeff Dean (2009), trước thời SSD phổ biến, và các bản "cập nhật" là blog cá nhân. Vẽ thang log từ số không có nguồn sẽ trái luật "facts từ tài liệu chính thức". Bảng của topic đã ghi bậc độ lớn. |
