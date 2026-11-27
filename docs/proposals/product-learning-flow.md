# Đề xuất: kiến trúc thông tin và luồng học tịnh tiến

> Trạng thái (2026-11-27): **đã triển khai cho 39 topic hiện có.** §5 bước 1–2, 4, 7 (nhóm A, B0–B5) do agent UI/UX làm (D40–D44). Bước 3, 5, 6 xong: `roadmap.js` theo cây §7.2 (chỉ chặng có topic), tiêu đề + `goal` + `needs` cho 39 topic, bỏ số thứ tự section, luật mới trong `check.mjs` (§3.5). Hai câu UI còn mở đã chốt: topbar mobile (D28), vị trí "Hết giai đoạn" khi có Đào sâu (D29). Còn lại: bước 8 (viết topic mới theo §7–8, mỗi chặng/nhánh mới thêm cùng topic đầu tiên), bước 9 (tách `patterns`), bước 10 phần README/`content-system.md` §6.
>
> Lệch so với bảng: `needs` của `patterns` rút còn 3 (bỏ `blob`) theo luật ≤ 3, không giữ ngoại lệ; `concurrency` giữ `needs: ["oop-pillars"]` (xuyên nhánh) cho tới khi có `conc-race-condition`; nhánh `cloud` tên "Container & Kubernetes" (Q11 thay §3.3), chặng duy nhất "Trên AWS".
>
> Dải số quyết định dành cho đề xuất này: **D20–D29** (ghi vào `docs/decisions.md` khi chốt).

## 0. Tóm tắt

- Hiện site có **hai cách phân loại không khớp nhau**: `tracks.js` (track/section theo mục lục Hello Interview) và `ROADMAP` (giai đoạn học). `app.js` chỉ đọc `ROADMAP`, nên track/section không hiện ở đâu cả.
- Điều hướng có lỗ hổng: nút "tiếp" sau chủ đề cuối của giai đoạn 4 nhảy sang nhánh Kiến trúc thay vì sang luyện bài, "Học tiếp" không bao giờ gợi ý bài luyện, chủ đề không nói "cần học gì trước" hay "học xong làm được gì".
- Đề xuất:
  1. `ROADMAP` là **nguồn duy nhất của cây học**: giai đoạn → **chặng** (trường mới `parts`, nằm trong `roadmap.js`) → topic. Track chỉ còn là thư mục chứa file.
  2. Lộ trình chính 5 giai đoạn, mỗi giai đoạn kết thúc bằng một **chặng kiểm tra** gồm các bài luyện vừa đủ nền (tính tự động từ `problem.topics`).
  3. Hai trường topic mới, đều tuỳ chọn: `goal` (học xong làm được gì) và `needs` (tiên quyết, chỉ gợi ý, không khoá).
  4. Quy ước tiêu đề nhất quán, kèm bảng tiêu đề mới cho cả 39 topic.
  5. Có quy tắc xếp chỗ cho chủ đề mới (Durable Execution, outbox/CDC, consensus, observability, auth…), không cần sửa code.
  6. **Giai đoạn 2 (§7–8):** đã phân loại 20 chủ đề của SA (gồm 5 Container/Kubernetes) và 134 đề mục của Research: 132 topic mới, 22 đề mục gộp, 3 nhánh mới. Viết theo 4 đợt; đợt 1 gồm 21 topic.
  7. UI flow chia hai nhóm: **nhóm A chạy được với dữ liệu hiện có** (agent UI làm ngay, không đụng file nội dung dùng chung), **nhóm B cần trường mới**.

## 1. Hiện trạng

Số liệu lấy từ `node scripts/check.mjs` và registry `BK` ngày 2026-11-27: **39 topic, 13 problem, 35 sim** (check báo 48 vì `check.mjs` gộp thêm 13 `hld` của problem vào bảng sim, dòng 47–52), **179 thuật ngữ**.

### 1.1 Cây học hiện tại (`content/roadmap.js`)

| Giai đoạn | Topic (theo thứ tự) |
|---|---|
| 1 · Khung & nền móng | delivery, networking, api-design, data-modeling, indexing, core-db |
| 2 · Scale dữ liệu | caching, sharding, consistent-hashing, cap, numbers |
| 3 · Building blocks | redis, kafka, queue, streams, dist-lock, dist-cache, blob, search, lb-gateway-cdn, tech-cheatsheet, bigdata-ds |
| 4 · Common patterns | patterns |
| 5 · Luyện bài System Design | (13 problem, `problems: true`) |
| ∥ Kiến trúc phần mềm & phương pháp | code-architecture, system-architecture, dev-methods |
| ∥ Container trên AWS: ECS & EKS | ecs, eks, ecs-vs-eks |
| ∥ Low-Level Design | lld-delivery, oop-pillars, solid, principles-other, patterns-gof, concurrency, lld-problems-list |
| ∥ Coding · DSA | bigo, ds, algo |

### 1.2 Phân loại thứ hai (`content/tracks.js`)

5 track (`sd`, `lld`, `cloud`, `arch`, `dsa`) và 16 section đánh số ("1 · Delivery Framework", "2 · Core Concepts"…). Mỗi topic bắt buộc có `track` + `section` và `check.mjs` kiểm tra chúng khớp nhau, **nhưng `app.js` không đọc `BK.tracks` hay `BK.sections` ở bất kỳ đâu.** Hai cách phân loại lệch nhau, ví dụ:

| Topic | Section (tracks.js) | Giai đoạn (ROADMAP) |
|---|---|---|
| `core-db` | 3 · Key Technologies | 1 · Khung & nền móng |
| `numbers` | 2 · Core Concepts | 2 · Scale dữ liệu (đứng cuối, sau CAP) |
| `kafka`, `redis` | 5 · Technology Deep Dives | 3 · Building blocks (đứng đầu, trước queue/streams) |

### 1.3 Điều hướng trong `app.js`

| Chỗ | Hành vi hiện tại | Dòng |
|---|---|---|
| `ORDER` | Topic của giai đoạn chính, rồi tới topic của các nhánh song song. Giai đoạn 5 không có topic nên không có mặt trong `ORDER`. | 16 |
| Pager trang topic | `prev`/`next` theo `ORDER`. Sau `patterns` là `code-architecture`. "Sang luyện bài →" chỉ hiện sau topic cuối cùng (`algo`). | 196, 230–233 |
| "Học tiếp" (trang chủ) và `#/learn` | Topic đầu tiên chưa đánh dấu trong `ORDER`. Chỉ trỏ sang bài luyện khi **mọi** topic, kể cả nhánh song song, đã xong. | 146, 154, 383 |
| Trang topic | Crumb "Giai đoạn N · tên giai đoạn". Không có tiên quyết, không có "học xong làm được gì". Mục "Áp dụng" liệt kê bài dùng topic này (`problemsFor`) và `related`. | 203, 225–227 |
| `related` | Là **id sim**, không phải id topic (`queue` vừa là topic vừa là sim). Không có cách nào nối topic → topic. `content-system.md` §6 ("link sang bằng `related`") ngụ ý ngược lại. | 198 |
| Trang bài luyện | Chip topic liên quan không có nhãn, không cho biết đã học chưa. Pager theo mức độ. | 264–271, 299–301 |
| Trang Mô phỏng | Nhóm sim theo giai đoạn của `sim.topics[0]`. Ví dụ `replica-lag` (topics: patterns, cap) rơi vào giai đoạn 4 dù gắn với CAP. | 315 |
| Tìm kiếm | Chỉ tìm topic và problem, không tìm sim hay thuật ngữ. Không xếp hạng (khớp tiêu đề không được ưu tiên). | 361–377 |
| Sidebar | Mọi giai đoạn mở hết, 39 dòng topic. Class `.sb-section` có sẵn trong `styles.css` nhưng không dùng. | 119–126 |
| Tiến độ | `ip.done`: mảng gồm id topic và `p:<id>` bài luyện. Đánh dấu là nhị phân. | 31–32 |

## 2. Vấn đề

| # | Vấn đề | Hệ quả với người học |
|---|---|---|
| V1 | Hai cây phân loại, chỉ một cây hiện ra | Người viết nội dung phải nghĩ hai lần; section đánh số "1 · …" không ai thấy; chủ đề mới không biết đặt đâu |
| V2 | Giai đoạn 3 có 11 topic trộn lẫn nhiều loại (khái niệm queue/streams, công nghệ sâu Redis/Kafka, bảng tra cứu) | Không biết mình đang ở đâu trong giai đoạn, không có điểm dừng giữa chừng |
| V3 | Thứ tự ngược tiên quyết: `redis` và `kafka` (chuyên sâu) đứng trước `queue`, `streams`, `dist-cache`; `numbers` đứng sau CAP dù dùng ngay ở bước Capacity của `delivery`; `lb-gateway-cdn` xa `networking` | Gặp khái niệm trong bài chuyên sâu trước khi được giải thích |
| V4 | Giai đoạn 4 chỉ có 1 topic (`patterns`) nhưng 9/13 bài luyện cần nó | Một cổ chai: không bài trung bình nào "đủ nền" trước khi học xong toàn bộ |
| V5 | Bài luyện dồn hết vào cuối | Học 4 giai đoạn lý thuyết rồi mới được áp dụng; bài Khởi động như URL Shortener thật ra chỉ cần giai đoạn 1–2 |
| V6 | Pager sau `patterns` sang `code-architecture` | Lạc từ lộ trình chính sang nhánh phụ đúng lúc nên bắt đầu luyện |
| V7 | Không có tiên quyết và "học xong làm được gì" | Không trả lời được "vì sao học cái này bây giờ" và "học xong thì sang đâu" |
| V8 | Tiêu đề không nhất quán: trộn Anh–Việt tuỳ ý ("Networking Essentials" / "Cấu trúc dữ liệu cốt lõi"), hậu tố mơ hồ ("chi tiết"), liệt kê tên thay cho tiêu đề ("KISS · DRY · YAGNI · SoC · LoD", "Creational · Structural · Behavioral"), số đếm dễ lỗi thời ("Cheat sheet 15 công nghệ", "9 bài LLD kinh điển") | Sidebar khó quét; tiêu đề không nói được người học sẽ làm được gì |
| V9 | Trang chủ chỉ trả lời "topic chưa đánh dấu đầu tiên" | Không gợi ý bài luyện, không cho thấy giai đoạn hiện tại gồm những phần nào |
| V10 | Tìm kiếm không có sim, thuật ngữ; không xếp hạng | Gõ "fencing" hay "LRU" không ra mô phỏng hay định nghĩa |
| V11 | Không có chỗ cho chủ đề mới: Security, observability, consensus, outbox/CDC, durable execution; `HI_GAPS` còn 10 deep dive công nghệ và 19 bài luyện | Mỗi chủ đề mới lại phải bàn chỗ đặt, dễ làm giai đoạn 3 phình thêm |

## 3. Đề xuất

### 3.0 Nguyên tắc

1. **Một cây học duy nhất là `ROADMAP`.** Giai đoạn → chặng → topic. Mọi màn hình (sidebar, trang chủ, crumb, trang Mô phỏng, kết quả tìm kiếm) đọc cùng cây này.
2. **Track = thư mục, không phải điều hướng.** `content/topics/<track>/` chỉ để gom file theo lĩnh vực. Dời một topic sang thư mục khác là dời file + sửa một dòng manifest; **id không đổi**, URL và tiến độ không ảnh hưởng.
3. **Id giai đoạn và id chặng không phải hợp đồng.** Chúng không nằm trong URL hay `ip.done`, nên đổi tự do. Id topic và `p:<id>` thì giữ nguyên.
4. **Học khái niệm → học công nghệ minh hoạ → luyện ngay.** Mỗi giai đoạn kết thúc bằng một công nghệ trọng tâm (Redis, Kafka) hoặc bảng chọn, rồi tới chặng kiểm tra.
5. **Gợi ý, không khoá.** Tiên quyết và "đủ nền" chỉ để hiển thị; không chặn người học mở bất kỳ trang nào.
6. **Thêm chủ đề không sửa code** (nguyên tắc 5 của `content-system.md`): chủ đề mới = file + dòng manifest + id trong một chặng của `roadmap.js`.

### 3.1 (a) Cây danh mục mới

> **Cập nhật:** đã có danh sách chủ đề thật; cây đầy đủ và các điểm thay đổi so với cây dưới đây ở **§7.2** (§7 ghi đè §3.1).

Ký hiệu: `[+ chỗ chứa]` là chỗ dành cho chủ đề sắp có; **chỉ ghi trong tài liệu này, không tạo chặng rỗng trong dữ liệu** (chặng rỗng sẽ bị `check.mjs` báo lỗi, xem §3.5). Chặng `Đào sâu` là `optional: true`.

```text
LỘ TRÌNH CHÍNH — System Design
│
├─ GĐ1 · Nền móng
│   ├─ 1.1 Khung trả lời ............ delivery, numbers
│   ├─ 1.2 Giao tiếp & cửa vào ...... networking, api-design, lb-gateway-cdn   [+ xác thực & phân quyền cơ bản]
│   ├─ 1.3 Lưu & truy vấn dữ liệu ... data-modeling, core-db, indexing
│   └─ [+ Đào sâu: PostgreSQL]
│
├─ GĐ2 · Scale dữ liệu
│   ├─ 2.1 Đọc nhanh hơn với cache .. caching, dist-cache
│   ├─ 2.2 Chia dữ liệu ra nhiều máy  sharding, consistent-hashing
│   ├─ 2.3 Nhất quán & sao chép ..... cap   [+ replication, quorum, consensus/leader election, transaction & isolation]
│   ├─ 2.4 Công nghệ trọng tâm ...... redis
│   ├─ [+ Đào sâu: DynamoDB, Cassandra, ZooKeeper/etcd]
│   └─ ✔ Kiểm tra chặng: URL Shortener, Distributed Rate Limiter
│
├─ GĐ3 · Bất đồng bộ & phối hợp
│   ├─ 3.1 Hàng đợi & luồng sự kiện . queue, streams, kafka
│   ├─ 3.2 Tranh chấp tài nguyên .... dist-lock
│   ├─ [+ 3.3 Quy trình nhiều bước đáng tin: idempotency, outbox, CDC, saga, durable execution]
│   └─ [+ Đào sâu: Flink, Temporal]
│
├─ GĐ4 · Lưu trữ chuyên dụng
│   ├─ 4.1 Kho chuyên dụng .......... blob, search, bigdata-ds   [+ vector DB, time-series DB]
│   ├─ 4.2 Chọn công nghệ ........... tech-cheatsheet
│   ├─ [+ Đào sâu: Elasticsearch]
│   └─ ✔ Kiểm tra chặng: Web Crawler, YouTube Top K
│
└─ GĐ5 · Ghép pattern & luyện đề
    ├─ 5.1 Common patterns .......... patterns
    └─ 5.2 Luyện đề ................. 13 bài (Khởi động → Trung bình → Nâng cao), nhận thêm 19 bài HI_GAPS

NHÁNH SONG SONG — học xen kẽ, không chặn lộ trình chính
├─ ∥ Low-Level Design
│   ├─ Khung & OOP .................. lld-delivery, oop-pillars
│   ├─ Nguyên tắc thiết kế .......... solid, principles-other
│   ├─ Design pattern ............... patterns-gof
│   ├─ Concurrency .................. concurrency
│   └─ Luyện đề LLD ................. lld-problems-list
├─ ∥ Kiến trúc & phương pháp
│   ├─ Tổ chức code ................. code-architecture
│   ├─ Tổ chức hệ thống ............. system-architecture
│   └─ Cách làm việc ................ dev-methods
├─ ∥ Vận hành production   (đổi tên từ "Container trên AWS"; id giai đoạn `cloud` giữ nguyên)
│   ├─ Container trên AWS ........... ecs, eks, ecs-vs-eks
│   ├─ [+ Quan sát hệ thống: logs, metrics, tracing, SLO/alert]
│   ├─ [+ Bảo mật & định danh: OAuth2/OIDC sâu, mTLS, secrets]
│   └─ [+ Triển khai & độ tin cậy: deploy chiến lược, IaC, incident]
└─ ∥ Coding · DSA
    ├─ Độ phức tạp .................. bigo
    ├─ Cấu trúc dữ liệu ............. ds
    └─ Thuật toán ................... algo
```

Thay đổi so với hiện tại:

| Thay đổi | Lý do |
|---|---|
| `numbers` lên ngay sau `delivery` | Bước Capacity Estimation của khung trả lời dùng ngay các con số này (V3) |
| `lb-gateway-cdn` từ GĐ3 về GĐ1, cạnh `networking` | Cùng câu hỏi "request đi vào hệ thống thế nào"; bài Rate Limiter cần nó (V3) |
| `redis` và `dist-cache` sang GĐ2; `redis` đứng cuối GĐ2 | Redis là công nghệ minh hoạ cho cache + cluster/sharding vừa học; đứng cuối thì mọi khái niệm nó dùng đã có (V3) |
| `kafka` đứng sau `queue`, `streams` | Học khái niệm trước, công nghệ sau (V3) |
| GĐ3 cũ (11 topic) tách thành GĐ3 "Bất đồng bộ & phối hợp" (4) và GĐ4 "Lưu trữ chuyên dụng" (4) | Mỗi giai đoạn trả lời một loại câu hỏi; có điểm dừng giữa chừng (V2) |
| GĐ4 cũ (`patterns`) và GĐ5 cũ (luyện bài) gộp thành GĐ5 | Pattern là cầu nối sang luyện đề, đứng riêng một giai đoạn 1 topic là quá mỏng (V4) |
| Chặng kiểm tra cuối GĐ2 và GĐ4 | Luyện sớm bài vừa đủ nền (V5) |
| Nhánh "Container trên AWS" thành "Vận hành production" | Có chỗ cho observability, bảo mật vận hành, triển khai (V11) |

Tập topic của lộ trình chính không đổi (đã kiểm bằng script: cùng 23 id), chỉ đổi thứ tự và cách nhóm.

#### Quy tắc xếp chỗ cho chủ đề mới

Đi lần lượt, dừng ở câu đầu tiên trả lời "có":

| # | Câu hỏi | Đặt vào |
|---|---|---|
| 1 | Là tài liệu sâu về **một sản phẩm cụ thể** (PostgreSQL, Cassandra, Temporal, Flink…)? | Chặng **Đào sâu** (`optional`) của giai đoạn chứa khái niệm mà sản phẩm đó minh hoạ |
| 2 | Chỉ cần khi **vận hành** hệ thống, ít khi cần để giải một bài System Design? | Nhánh **Vận hành production** |
| 3 | Trả lời "**request vào hệ thống thế nào, ai được gọi**"? | GĐ1 › Giao tiếp & cửa vào |
| 4 | Trả lời "**lưu và truy vấn dữ liệu trên một máy**"? | GĐ1 › Lưu & truy vấn dữ liệu |
| 5 | Trả lời "**nhiều máy cùng giữ dữ liệu thì thống nhất thế nào**"? | GĐ2 › Nhất quán & sao chép |
| 6 | Trả lời "**việc chạy sau, chạy nhiều bước, hoặc nhiều máy tranh nhau**"? | GĐ3 |
| 7 | Trả lời "**kho nào cho loại dữ liệu đặc biệt**" (file, văn bản, vector, chuỗi thời gian)? | GĐ4 › Kho chuyên dụng |
| 8 | Là **cách ghép** nhiều khái niệm thành lời giải? | GĐ5 › Common patterns |
| 9 | Về cấu trúc code, cách tổ chức team/quy trình? | Nhánh Kiến trúc & phương pháp |

Áp dụng cho các ví dụ đang nghiên cứu (danh sách thật sẽ phân loại ở giai đoạn 2):

| Chủ đề | Câu dừng | Chỗ đặt | Tiên quyết gợi ý |
|---|---|---|---|
| Durable Execution | 6 | GĐ3 › 3.3 Quy trình nhiều bước đáng tin; Temporal (sản phẩm) → GĐ3 › Đào sâu | queue, dist-lock |
| Outbox / CDC | 6 | GĐ3 › 3.3 (cùng chặng với Durable Execution) | streams, core-db |
| Observability | 2 | Vận hành production › Quan sát hệ thống | (không) |
| Consensus (Raft, leader election, quorum) | 5 | GĐ2 › 2.3 Nhất quán & sao chép; ZooKeeper/etcd → GĐ2 › Đào sâu | cap |
| Auth (authn/authz, session vs token, OAuth2/OIDC cơ bản) | 3 | GĐ1 › 1.2 Giao tiếp & cửa vào | api-design |
| Auth nâng cao (mTLS, quản lý secrets, rotation) | 2 | Vận hành production › Bảo mật & định danh | auth cơ bản |

`HI_GAPS` cũng vừa với cây này mà không phải xếp lại: 10 deep dive còn thiếu đi vào các chặng **Đào sâu** (Elasticsearch → GĐ4; Cassandra, DynamoDB → GĐ2; PostgreSQL → GĐ1; Flink, Temporal → GĐ3; ZooKeeper → GĐ2; Vector DB, Time-series DB → GĐ4 › Kho chuyên dụng; CDC là khái niệm → GĐ3 › 3.3). 19 bài luyện còn thiếu đi vào GĐ5 › Luyện đề theo mức, và tự hiện ở chặng kiểm tra phù hợp nhờ quy tắc "đủ nền" (§3.2).

### 3.2 (b) Thứ tự topic và tiên quyết

#### Thứ tự (lộ trình chính)

```text
GĐ1  delivery → numbers → networking → api-design → lb-gateway-cdn → data-modeling → core-db → indexing
GĐ2  caching → dist-cache → sharding → consistent-hashing → cap → redis
GĐ3  queue → streams → kafka → dist-lock
GĐ4  blob → search → bigdata-ds → tech-cheatsheet
GĐ5  patterns → (luyện đề)
```

Nhánh song song giữ thứ tự hiện tại.

#### Trường mới `needs` (tuỳ chọn)

`needs: ["id", …]` liệt kê **tiên quyết trực tiếp** (tối đa 3), không liệt kê bắc cầu. Đã kiểm bằng script cho cả lộ trình chính lẫn 4 nhánh: trong cùng một nhóm, mọi tiên quyết đứng trước topic cần nó, nên không có vòng; mọi id đều tồn tại.

| Topic | needs |
|---|---|
| numbers | delivery |
| api-design | networking |
| lb-gateway-cdn | networking |
| data-modeling | delivery, api-design |
| core-db | data-modeling |
| indexing | core-db |
| caching | core-db, numbers |
| dist-cache | caching |
| sharding | indexing, numbers |
| consistent-hashing | sharding |
| cap | sharding |
| redis | dist-cache, consistent-hashing |
| queue | api-design |
| streams | queue |
| kafka | streams, sharding |
| dist-lock | redis, cap |
| blob | api-design, core-db |
| search | indexing |
| bigdata-ds | numbers |
| tech-cheatsheet | redis, kafka, search |
| patterns | caching, queue, dist-lock, blob *(ngoại lệ 4 mục: pattern là phần ghép)* |
| oop-pillars | lld-delivery |
| solid | oop-pillars |
| principles-other | solid |
| patterns-gof | solid |
| concurrency | oop-pillars *(§7: đổi thành `conc-race-condition` khi dời sang Nền tảng CS)* |
| lld-problems-list | patterns-gof, concurrency |
| code-architecture | solid *(xuyên nhánh)* |
| system-architecture | code-architecture, queue *(queue xuyên nhánh)* |
| dev-methods | code-architecture |
| ecs | lb-gateway-cdn *(xuyên nhánh)* |
| eks | ecs |
| ecs-vs-eks | eks |
| ds | bigo |
| algo | ds |

Quy ước: tiên quyết **xuyên nhánh** (nhánh song song cần topic của lộ trình chính hoặc ngược lại) chỉ hiển thị, không ảnh hưởng thứ tự. `check.mjs` chỉ bắt buộc "đứng trước" khi hai topic cùng nằm trong lộ trình chính hoặc cùng một nhánh.

#### Bài luyện "đủ nền" (tính từ dữ liệu hiện có)

Một bài **đủ nền** khi mọi id trong `problem.topics` đã có trong `ip.done`. Không cần trường mới. Một bài thuộc **chặng kiểm tra** của giai đoạn chứa topic đứng muộn nhất trong `problem.topics`. Bảng dưới sinh bằng script từ thứ tự §3.2:

| Bài | Mức | Mở ở | Cần |
|---|---|---|---|
| URL Shortener (Bitly) | Khởi động | GĐ2 | redis, caching, indexing, data-modeling |
| Distributed Rate Limiter | Khởi động | GĐ2 | redis, api-design, dist-cache, lb-gateway-cdn |
| Web Crawler | Trung bình | GĐ4 | queue, bigdata-ds, blob |
| YouTube Top K | Nâng cao | GĐ4 | kafka, bigdata-ds, streams, sharding |
| 9 bài còn lại (Yelp, Ticketmaster, Dropbox, WhatsApp, News Feed, Uber, Ad Click, Google Docs, Payment) | | GĐ5 | đều có `patterns` |

**Cổ chai `patterns`:** 9/13 bài cần `patterns`, kể cả Yelp (mức Khởi động). Chấp nhận ở bước đầu vì không cần viết nội dung mới. Bước sau (§5, bước 9) tách `patterns` thành 8 topic pattern, mỗi pattern đặt ở cuối giai đoạn có đủ khái niệm cho nó, và `problem.topics` trỏ tới pattern cụ thể thay vì `patterns`:

| Id mới (đề xuất) | Pattern | Đặt ở |
|---|---|---|
| `pattern-scaling-reads` | Scaling Reads | GĐ2 |
| `pattern-scaling-writes` | Scaling Writes | GĐ2 |
| `pattern-realtime` | Realtime Updates | GĐ3 |
| `pattern-long-tasks` | Long-Running Tasks | GĐ3 |
| `pattern-contention` | Dealing with Contention | GĐ3 |
| `pattern-multi-step` | Multi-Step Processes (chỗ tự nhiên cho saga, durable execution) | GĐ3 |
| `pattern-blobs` | Handling Large Blobs | GĐ4 |
| `pattern-proximity` | Proximity-Based Services | GĐ4 |

Id `patterns` **giữ nguyên** và trở thành trang tổng hợp "Bản đồ Common Patterns" (bảng 8 dòng, mỗi dòng link sang topic pattern), nằm ở GĐ5 › 5.1. Tiến độ cũ của `patterns` trong `ip.done` vẫn đúng nghĩa ("đã nắm bản đồ pattern").

### 3.3 (c) Quy ước tiêu đề và bộ tiêu đề mới

#### Quy ước

> **Cập nhật 2026-11-27 (D100–D109):** nhãn nào là tên một khái niệm kỹ thuật thì dùng **key term** trong `docs/terminology.md`, kể cả giai đoạn và chặng. Dòng "Chặng" bên dưới đã sửa theo đó; tiêu đề trong các bảng và cây ở §1–§3, §8 là bản lịch sử. Tiêu đề đang chạy nằm trong `content/roadmap.js`; §7.2–§7.3 đã cập nhật.

| Cấp | Dạng | Ví dụ | Không dùng |
|---|---|---|---|
| Giai đoạn | Danh từ chỉ năng lực, ≤ 4 từ. Số thứ tự do UI thêm ("GĐ2 · "), **không ghi trong `title`**. Là tên khái niệm thì dùng key term | "Scale dữ liệu", "Async & Coordination" | "Building blocks" (không nói làm được gì); "Bất đồng bộ & phối hợp" (bản dịch) |
| `goal` của giai đoạn | Một câu bắt đầu bằng "Học xong bạn …" + động từ | "Học xong bạn biết khi nào một database không đủ và mở rộng bằng cache, shard, replica." | Danh sách công nghệ |
| Chặng | **Key term** của nhóm khái niệm mà chặng dạy, ≤ 6 từ, không đánh số. Chặng là hoạt động hoặc nhóm không phải khái niệm (luyện đề, câu chuyện, trên AWS) thì tiếng Việt (`docs/terminology.md` §2) | "Sharding", "Consistency & Replication", "Luyện đề LLD" | "2 · Core Concepts"; "Chia dữ liệu ra nhiều máy", "Nhất quán & sao chép" (bản dịch, thay bằng D100) |
| Topic `title` | Tên ngắn **≤ 40 ký tự**, hiện ở sidebar/chip. Thuật ngữ ngành giữ tiếng Anh, viết hoa chữ đầu mỗi từ của key term (Caching, Circuit Breaker); phần nối bằng tiếng Việt. Không dùng cụm ở cột "Không dùng trong nhãn" của `docs/terminology.md` (`check.mjs` chặn) | "Consistent Hashing" | Hậu tố "chi tiết", "cốt lõi"; liệt kê > 3 tên; số đếm có thể lỗi thời; bản dịch ("Cấu trúc dữ liệu xác suất") |
| Topic chuyên sâu một sản phẩm | "<Sản phẩm> chuyên sâu" | "Kafka chuyên sâu" | "Kafka chi tiết" |
| Topic so sánh để chọn | "X hay Y?" | "SQL hay NoSQL?", "ECS hay EKS?" | |
| Topic pattern | "Pattern: <tên Hello Interview>" | "Pattern: Scaling Reads" | |
| Topic `goal` (trường mới) | Bắt đầu bằng **động từ**, ≤ 90 ký tự, nói người học **làm được gì** sau bài | "Thêm/bớt node mà chỉ dời khoảng 1/N số key" | Lặp lại tiêu đề |
| Bài luyện | "<Loại hệ thống> (<sản phẩm ví dụ>)" — giữ như hiện tại | "Chat App (WhatsApp)" | |

Số đếm chỉ được dùng khi **cố định theo định nghĩa** (4 tính chất OOP, 6 bước của khung trả lời), không dùng cho danh sách sẽ còn dài thêm (15 công nghệ, 9 bài, 8 pattern).

#### Giai đoạn và chặng

| Id | Tiêu đề hiện tại | Tiêu đề mới | `goal` mới |
|---|---|---|---|
| s1 | Khung & nền móng | **Nền móng** | Học xong bạn trình bày được một bài theo khung 6 bước và chọn giao thức, API, database cho bài đơn giản. |
| s2 | Scale dữ liệu | **Scale dữ liệu** | Học xong bạn biết khi nào một database không đủ, mở rộng bằng cache, shard, replica và nói rõ mức nhất quán. |
| s3 | Building blocks | **Bất đồng bộ & phối hợp** | Học xong bạn tách được việc chậm khỏi request, xử lý sự kiện tin cậy và chống tranh chấp giữa nhiều máy. |
| s4 | Common patterns | **Lưu trữ chuyên dụng** | Học xong bạn chọn đúng kho cho file lớn, tìm kiếm full-text, đếm/lọc ở quy mô lớn, và so sánh nhanh các công nghệ. |
| s5 | Luyện bài System Design | **Ghép pattern & luyện đề** | Học xong bạn nhận ra dạng bài, gọi đúng pattern, tự giải từ Khởi động tới Nâng cao. |
| arch | Kiến trúc phần mềm & phương pháp | **Kiến trúc & phương pháp** | Học xong bạn giải thích được code phụ thuộc theo hướng nào, khi nào tách service và cách TDD/DDD khớp với nhau. |
| cloud | Container trên AWS: ECS & EKS | **Vận hành production** | Học xong bạn chọn được nền chạy container cho một hệ thống trên AWS. *(Mở rộng câu này khi có chặng Quan sát, Bảo mật.)* |
| lld | Low-Level Design | **Low-Level Design** | Học xong bạn thiết kế lớp cho một bài LLD: entity, nguyên tắc, pattern, xử lý đồng thời. |
| dsa | Coding · DSA | **Coding · DSA** | Học xong bạn nhận dạng pattern thuật toán từ ràng buộc đề bài. |

Id chặng đề xuất (dạng `<giai đoạn>.<tên>`, xem §3.5): `s1.frame`, `s1.io`, `s1.data`, `s2.cache`, `s2.split`, `s2.consistency`, `s2.tech`, `s3.async`, `s3.contention`, `s4.stores`, `s4.choose`, `s5.patterns`; nhánh: `lld.oop`, `lld.principles`, `lld.patterns`, `lld.concurrency`, `lld.practice`, `arch.code`, `arch.system`, `arch.process`, `cloud.containers`, `dsa.complexity`, `dsa.ds`, `dsa.algo`. Tiêu đề chặng như cây ở §3.1.

#### Topic (39)

Chỉ đổi `title`; id giữ nguyên. "—" ở cột tiêu đề mới là giữ nguyên tiêu đề.

| Id | Tiêu đề hiện tại | Tiêu đề mới | `goal` mới |
|---|---|---|---|
| delivery | Khung trả lời 6 bước | Khung trả lời System Design | Trình bày một bài theo 6 bước cố định mà không lạc đề |
| numbers | Numbers to Know | Con số cần nhớ | Ước lượng tải để biết khi nào cần cache, shard hay thêm máy |
| networking | Networking Essentials | Networking căn bản | Chọn giao thức (HTTP, WebSocket, gRPC) và tầng load balancing phù hợp |
| api-design | API Design | — | Chọn REST, GraphQL hay gRPC và thiết kế endpoint, phân trang |
| lb-gateway-cdn | Load Balancer · API Gateway · CDN | Load Balancer, API Gateway, CDN | Đặt đúng cửa vào và lớp phân phối nội dung cho hệ thống |
| data-modeling | Data Modeling | — | Đi từ requirements tới bảng, khoá chính và shard key |
| core-db | Core Database: SQL vs NoSQL | SQL hay NoSQL? | Chọn loại database theo access pattern và nhu cầu transaction |
| indexing | Database Indexing | — | Chọn index cho truy vấn và biết nó làm chậm ghi bao nhiêu |
| caching | Caching | — | Đặt cache đúng chỗ, chọn cách ghi, xử lý hot key và stampede |
| dist-cache | Distributed Cache (Redis) | Distributed Cache | Dùng một lớp cache chung cho nhiều instance mà không lệch dữ liệu |
| sharding | Sharding & Partitioning | — | Chia dữ liệu ra nhiều máy với shard key khớp access pattern |
| consistent-hashing | Consistent Hashing | — | Thêm/bớt node mà chỉ dời khoảng 1/N số key |
| cap | CAP Theorem & Consistency Models | CAP & mô hình nhất quán | Chọn nhất quán hay sẵn sàng cho từng phần dữ liệu khi mạng chia cắt |
| redis | Redis chi tiết | Redis chuyên sâu | Dùng Redis cho cache, counter, lock, leaderboard và biết giới hạn của nó |
| queue | Message Queue | — | Tách producer/consumer, xử lý retry, DLQ và backpressure |
| streams | Streams / Event Sourcing | Stream & Event Sourcing | Phân biệt queue với log bền vững và lưu sự kiện thay cho trạng thái |
| kafka | Kafka chi tiết | Kafka chuyên sâu | Thiết kế topic, partition, consumer group và chọn delivery semantics |
| dist-lock | Distributed Lock | — | Khoá tài nguyên xuyên nhiều máy an toàn với TTL và fencing token |
| blob | Blob Storage | — | Lưu file lớn ngoài database và cho client tải trực tiếp |
| search | Search Optimized Database | Full-text Search | Thêm tìm kiếm full-text bằng inverted index thay cho `LIKE '%x%'` |
| bigdata-ds | Data Structures for Big Data | Cấu trúc dữ liệu xác suất | Đếm, lọc trùng ở quy mô lớn với bộ nhớ nhỏ, chấp nhận sai số |
| tech-cheatsheet | Cheat sheet 15 công nghệ | Bảng chọn công nghệ | Trả lời "vì sao dùng X mà không dùng Y" cho từng công nghệ phổ biến |
| patterns | 8 pattern hay gặp | Common Patterns | Nhận ra dạng bài và gọi đúng pattern kèm trade-off |
| lld-delivery | Khung trả lời LLD | — | Trình bày một bài LLD từ requirements tới class design |
| oop-pillars | 4 tính chất cốt lõi | 4 tính chất của OOP | Giải thích và chọn interface hay abstract class đúng chỗ |
| solid | SOLID | — | Nhận ra class vi phạm SOLID và sửa cho dễ mở rộng |
| principles-other | KISS · DRY · YAGNI · SoC · LoD | Giữ thiết kế đơn giản | Dùng KISS, DRY, YAGNI, SoC, LoD để tránh over-engineering |
| patterns-gof | Creational · Structural · Behavioral | Design Patterns (GoF) | Chọn pattern tạo, ghép và phối hợp object cho tình huống cụ thể |
| concurrency | Concurrency & Deadlock | — | Dùng lock, semaphore, condition variable và tránh deadlock |
| lld-problems-list | 9 bài LLD kinh điển | Bài LLD kinh điển | Chuẩn bị sẵn entity và pattern then chốt cho các bài LLD hay gặp |
| ecs | ECS chi tiết | ECS chuyên sâu | Triển khai, scale và tự phục hồi service trên ECS |
| eks | EKS chi tiết | EKS chuyên sâu | Hiểu EKS quản lý gì, bạn quản lý gì và scale 3 lớp |
| ecs-vs-eks | ECS hay EKS? | — | Chọn ECS hay EKS theo team, hệ sinh thái và chi phí vận hành |
| code-architecture | Kiến trúc code: Layered, Hexagonal, Onion, Clean, Vertical Slice | Kiến trúc code: Layered → Clean | Chọn cách tổ chức code theo hướng phụ thuộc |
| system-architecture | Kiến trúc hệ thống: Monolith, Microservices, Event-driven, Serverless | Monolith hay Microservices? | Biết khi nào giữ modular monolith, khi nào tách service |
| dev-methods | Phương pháp phát triển: TDD, BDD, ATDD, DDD và hơn thế | Phương pháp phát triển | Ghép TDD, BDD, DDD vào một quy trình làm việc |
| bigo | Big-O cần thuộc | Big-O | Đọc ràng buộc đề để biết cần độ phức tạp nào |
| ds | Cấu trúc dữ liệu cốt lõi | Cấu trúc dữ liệu | Chọn cấu trúc dữ liệu theo thao tác cần nhanh |
| algo | Thuật toán & pattern | Pattern thuật toán | Nhận dạng pattern thuật toán từ đề bài |

Tiêu đề section trong `tracks.js` (nếu giữ, xem câu hỏi Q1): bỏ số thứ tự "1 · ", giữ tên Hello Interview ("Delivery Framework", "Core Concepts"…).

### 3.4 (d) UI flow

#### Luồng người học

```text
 Trang chủ ──"Học tiếp"──▶ Topic ──"Đã nắm, sang bài tiếp"──▶ Topic kế ──▶ …
     │                      │  ▲                                   │
     │                      │  └── chip "Cần trước" (soft) ◀───────┘
     │                      ├──▶ Mô phỏng (trong trang) ──▶ Trang sim ──▶ "Ôn chủ đề" / "Dùng trong bài"
     │                      └──▶ "Dùng trong bài" ──▶ Bài luyện
     │
     ├─"Bài đã đủ nền"──▶ Bài luyện ──▶ chip "Cần nắm trước" (✓/○) ──▶ Topic
     │
  Topic cuối giai đoạn ──▶ khối "Hết giai đoạn N": Kiểm tra chặng (bài đủ nền) ──▶ Giai đoạn N+1
  Topic cuối lộ trình chính (patterns) ──▶ Luyện đề (#/problems)
  Topic cuối một nhánh song song ──▶ về Trang chủ (không nhảy sang nhánh khác)
  Tìm kiếm (mọi trang) ──▶ kết quả có nhãn loại + đường dẫn GĐ › chặng ──▶ Topic / Bài / Sim / Thuật ngữ
```

#### Trang chủ (≥ 900 px)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Lộ trình ôn System Design & Backend                                          │
│ ┌──────────── Tiếp tục ──────────────────────┐ ┌──── Sắp mở bài luyện ──────┐ │
│ │ GĐ2 · Scale dữ liệu › Chia dữ liệu ra …    │ │ URL Shortener  Khởi động   │ │
│ │ Consistent Hashing                         │ │ Rate Limiter   Khởi động   │ │
│ │ Làm được: thêm/bớt node mà chỉ dời ~1/N key│ │ Còn thiếu: Redis chuyên sâu│ │
│ │ Cần trước: ✓ Sharding & Partitioning       │ │ (khi có bài đủ nền, thẻ đổi│ │
│ │ [ Học tiếp → ]                             │ │  thành "Bài đã đủ nền")    │ │
│ └────────────────────────────────────────────┘ └────────────────────────────┘ │
│ Chủ đề 11/39 ▓▓▓░░░░░   Bài luyện 0/13 ░░░░░░░                               │
│                                                                              │
│ LỘ TRÌNH CHÍNH                                                               │
│ (✓) 1  Nền móng                                   8/8  ▸                     │
│ (●) 2  Scale dữ liệu                              3/6  ▾   ← mở sẵn GĐ hiện tại│
│        Học xong bạn biết khi nào một database không đủ…                      │
│        Đọc nhanh hơn với cache     [✓ Caching] [✓ Distributed Cache]         │
│        Chia dữ liệu ra nhiều máy   [✓ Sharding…] [○ Consistent Hashing]      │
│        Nhất quán & sao chép        [○ CAP & mô hình nhất quán]               │
│        Công nghệ trọng tâm         [○ Redis chuyên sâu]                      │
│        ✔ Kiểm tra chặng            [URL Shortener] [Rate Limiter]            │
│ ( ) 3  Bất đồng bộ & phối hợp                     0/4  ▸                     │
│ ( ) 4  Lưu trữ chuyên dụng                        0/4  ▸                     │
│ ( ) 5  Ghép pattern & luyện đề                    0/14 ▸                     │
│                                                                              │
│ NHÁNH SONG SONG · học xen kẽ khi cần                                         │
│ [∥ Low-Level Design 0/7] [∥ Kiến trúc & phương pháp 0/3]                     │
│ [∥ Vận hành production 0/3] [∥ Coding · DSA 0/3]   (mỗi ô mở như một GĐ)     │
│                                                                              │
│ ▸ Cách ôn một chủ đề / một bài      ▸ Nguồn & phạm vi nội dung               │
└──────────────────────────────────────────────────────────────────────────────┘
```

"Tiếp tục" = topic đầu tiên chưa đánh dấu **trong lộ trình chính**, bỏ qua chặng `optional`. Khi lộ trình chính xong hết: thẻ chuyển thành "Luyện đề →" bài chưa luyện đầu tiên đã đủ nền.

#### Trang chủ (375 px)

```text
┌───────────────────────────┐
│ ☰  Backend Knowledge   ◐  │
│ ┌─ Tiếp tục ────────────┐ │
│ │ GĐ2 › Chia dữ liệu    │ │
│ │ Consistent Hashing    │ │
│ │ Thêm/bớt node mà chỉ  │ │
│ │ dời ~1/N key          │ │
│ │ [   Học tiếp →    ]   │ │
│ └───────────────────────┘ │
│ ┌─ Sắp mở bài luyện (2) ┐ │
│ │ URL Shortener         │ │
│ │ Rate Limiter          │ │
│ │ Còn thiếu: Redis …    │ │
│ └───────────────────────┘ │
│ Chủ đề 11/39 ▓▓░░░        │
│ Bài    0/13 ░░░░░         │
│ (✓) 1 Nền móng     8/8 ▸ │
│ (●) 2 Scale dữ liệu 3/6 ▾│
│   Đọc nhanh hơn với cache │
│   [✓ Caching]             │
│   [✓ Distributed Cache]   │
│   Chia dữ liệu…           │
│   …                       │
│ ( ) 3 Bất đồng bộ… 0/4 ▸ │
│ ∥ Nhánh song song ▸       │
└───────────────────────────┘
```

#### Trang topic

```text
┌──────────────────────────────────────────────────────────────────┐
│ GĐ2 · Scale dữ liệu › Chia dữ liệu ra nhiều máy · 2/2           │  ← crumb có chặng
│ # Consistent Hashing                                             │
│ Làm được: thêm/bớt node mà chỉ dời khoảng 1/N số key             │  ← goal (B2)
│ Cần trước: [✓ Sharding & Partitioning]                           │  ← needs (B3)
│ ┌ Nói trong 30 giây ───────────────────────────────────────────┐ │
│ └──────────────────────────────────────────────────────────────┘ │
│ 1 Vì sao cần biết · 2 Hình dung · 3 Kiến thức cốt lõi            │
│ 4 Mẹo · 5 Tự kiểm tra · 6 Áp dụng      (giữ nguyên khung hiện tại)│
│ ┌ Tiếp theo ───────────────────────────────────────────────────┐ │
│ │ [ ✓ Đã nắm, sang bài tiếp → ]   [ Chỉ đánh dấu đã nắm ]      │ │
│ │ Tiếp: CAP & mô hình nhất quán                                │ │
│ │       Chọn nhất quán hay sẵn sàng khi mạng chia cắt          │ │
│ │ Bài này mở đường cho: Redis chuyên sâu                       │ │  ← đảo ngược needs (B3)
│ │ Sắp mở: URL Shortener · Khởi động (còn Redis chuyên sâu)     │ │  ← A3
│ └──────────────────────────────────────────────────────────────┘ │
│ ← Sharding & Partitioning           CAP & mô hình nhất quán →    │
└──────────────────────────────────────────────────────────────────┘
```

Topic cuối giai đoạn — khối "Tiếp theo" thay bằng:

```text
┌ Hết giai đoạn 2 · Scale dữ liệu ─────────────────────────────────┐
│ Kiểm tra chặng trước khi đi tiếp (tự làm 15–20 phút mỗi bài):     │
│   [URL Shortener · Khởi động]  [Distributed Rate Limiter · Khởi động]│
│ [ Sang Giai đoạn 3: Bất đồng bộ & phối hợp → ]                    │
└──────────────────────────────────────────────────────────────────┘
```

375 px: crumb rút còn "GĐ2 › Chia dữ liệu…", hai nút trong khối "Tiếp theo" xếp dọc, rộng 100%; pager xếp dọc.

#### Sidebar (mode Kiến thức)

```text
LỘ TRÌNH CHÍNH
▸ 1 Nền móng              8/8
▾ 2 Scale dữ liệu         3/6     ← <details open> cho GĐ đang xem
    Đọc nhanh hơn với cache       ← .sb-section (class đã có sẵn trong styles.css)
    ● Caching
    ● Distributed Cache
    Chia dữ liệu ra nhiều máy
    ● Sharding & Partitioning
    ○ Consistent Hashing   ◀ active
    …
▸ 3 Bất đồng bộ & phối hợp 0/4
NHÁNH SONG SONG
▸ ∥ Low-Level Design      0/7
…
```

#### Trang Luyện bài và trang bài

```text
# Luyện bài System Design
(trạng thái ví dụ: đã xong GĐ1 + GĐ2, chưa học GĐ3–5)
[Tất cả] [Đã đủ nền (2)] [Chưa luyện]          ← lọc, nhớ trong URL #/problems/ready ? (xem Q5)
Khởi động — ít thành phần, một pattern chính
┌ URL Shortener (Bitly) ─────────── ✓ Đủ nền ┐  ┌ Local Business Search ── Cần 1/3 ┐
│ …summary…                                   │  │ Còn thiếu: Full-text Search,     │
│ [✓Redis chuyên sâu][✓Caching][✓Indexing]…   │  │ Common Patterns                  │
└─────────────────────────────────────────────┘  └──────────────────────────────────┘

Trang bài:
Luyện bài · Khởi động
# URL Shortener (Bitly)
Cần nắm trước: [✓ Redis chuyên sâu] [✓ Caching] [○ Database Indexing] [✓ Data Modeling]
  ○ = chưa đánh dấu; gợi ý một dòng: "Nên đọc Database Indexing trước (không bắt buộc)."
…(giữ khung 5 bước)…
```

#### Tìm kiếm

```text
# Kết quả cho “fencing”   ·  5 kết quả
[Chủ đề]   Distributed Lock          GĐ3 › Tranh chấp tài nguyên
           …dùng **fencing token** để…
[Mô phỏng] Distributed lock: GC pause và fencing token
[Bài]      Ticket Booking (Ticketmaster)   Trung bình
[Thuật ngữ] (nếu khớp key/tên đầy đủ) → link #/glossary với ô lọc điền sẵn
```

Xếp hạng: khớp tiêu đề > khớp `tldr`/`goal` > khớp phần thân; trong cùng hạng giữ thứ tự `ORDER`.

#### Danh sách thay đổi cho agent UI/UX

**Nhóm A — chạy được với dữ liệu hiện có** (chỉ sửa `app.js`, `styles.css`; không đụng `content/`):

| # | Thay đổi | Hàm / chỗ trong `app.js` | `styles.css` |
|---|---|---|---|
| A1 | Pager theo **nhóm**: trong lộ trình chính đi hết các giai đoạn chính rồi sang `#/problems`; trong một nhánh song song chỉ đi trong nhánh, cuối nhánh về `#/`. Sửa V6. | `ORDER` (dòng 16), pager trong `viewTopic` (230–233) | — |
| A2 | "Học tiếp" và `#/learn` chỉ xét lộ trình chính; xong hết thì trỏ bài đủ nền đầu tiên chưa luyện. | `viewHome` (146, 154), `route` `/learn` (383) | — |
| A3 | Tính "đủ nền" cho mỗi bài từ `p.topics` + `done`. Thẻ "Bài đã đủ nền" ở trang chủ (chưa có bài nào thì hiện "Sắp mở": bài chỉ còn thiếu 1 chủ đề, kèm tên chủ đề còn thiếu); huy hiệu "✓ Đủ nền / Cần k/n" và lọc ở trang Luyện bài; chip "Cần nắm trước" có ✓/○ ở trang bài. | helper mới `readiness(p)`; `viewHome`, `viewProblems`, `viewProblem` (264–271) | `.ready`, `.need-chip.ok` |
| A4 | Khối "Tiếp theo" cuối trang topic, nút một chạm "Đã nắm, sang bài tiếp" (đánh dấu rồi chuyển). Giữ nút đánh dấu riêng. | `viewTopic` (229–236) | `.next-card` |
| A5 | Chặng kiểm tra: bài có topic muộn nhất (theo `ORDER`) thuộc giai đoạn N hiện ở cuối GĐ N trên trang chủ và trong khối "Hết giai đoạn" của topic cuối GĐ. **Lưu ý:** với `roadmap.js` hiện tại kết quả khác bảng §3.2 (4 bài mở ở GĐ3 cũ, 9 bài ở GĐ4 cũ vì `patterns`); bảng §3.2 chỉ đúng sau bước 3. Đó là hành vi đúng, không phải lỗi. | helper `checkpoint(stage)`; `viewHome`, `viewTopic` | `.rm-check` |
| A6 | Trang chủ: tách "Lộ trình chính" và "Nhánh song song"; chỉ mở sẵn GĐ hiện tại (`<details>`), gập "Cách ôn" và "Nguồn & phạm vi". | `viewHome` (157–188) | `.rm-stage` dạng `details` |
| A7 | Sidebar: mỗi giai đoạn là `<details>`, chỉ mở GĐ chứa topic đang xem; hiện `d/n`. | `sideKnowledge` (119–126) | `.sb-track` summary |
| A8 | Tìm kiếm thêm sim (`title`, `scenario`, `context`) và thuật ngữ (`k`, `full`, `vi`); nhãn loại; xếp hạng tiêu đề trước. | `viewSearch` (361–377) | `.type-badge` |
| A9 | Trang Mô phỏng nhóm sim theo topic **đứng sớm nhất trong `ORDER`** trong `sim.topics`, không theo `topics[0]`. Trang sim thêm "Dùng trong bài" (bài có `p.sims` chứa sim này). | `viewSims` (315), `viewSim` (326–335) | — |

**Nhóm B — cần dữ liệu mới** (làm sau khi bước 3–5 ở §5 xong):

| # | Thay đổi | Hàm | Dữ liệu cần |
|---|---|---|---|
| B1 | Hiển thị chặng: tiêu đề chặng trong sidebar (`.sb-section`), trang chủ, crumb "GĐ › chặng · i/n", nhóm trên trang Mô phỏng, đường dẫn trong kết quả tìm kiếm. **Phải hỗ trợ cả `stage.parts` lẫn `stage.topics` cũ** để có thể merge trước khi `roadmap.js` đổi. | đầu file (dòng 10–16: suy `s.topics` từ `s.parts`), `sideKnowledge`, `viewHome`, `viewTopic`, `viewSims`, `viewSearch` | `ROADMAP[].parts` |
| B0 | **Giai đoạn vừa có topic vừa có `problems: true`** (GĐ5 mới). Hiện `stageKeys` (dòng 84) chỉ đếm bài, `sideKnowledge` (120) và `viewSims` (314) bỏ qua giai đoạn có `problems`, chip trang chủ (165–167) chỉ hiện bài. Nếu không sửa, sau bước 3 `patterns` biến khỏi sidebar và trang chủ, sim `seat`, `saga` biến khỏi trang Mô phỏng. Cần: `stageKeys` = topic + `p:<id>`; sidebar/sims vẫn hiện phần topic; trang chủ hiện cả chip topic lẫn chặng "Luyện đề". | `stageKeys`, `sideKnowledge`, `viewHome`, `viewSims` | GĐ có cả `parts` và `problems` |
| B2 | Dòng "Làm được: …" dưới H1, trong thẻ "Tiếp tục" và khối "Tiếp theo". Không có `goal` thì ẩn. | `viewTopic`, `viewHome` | `topic.goal` |
| B3 | "Cần trước" (đầu trang topic) và "Bài này mở đường cho" (đảo ngược `needs`, trong khối "Tiếp theo"). | `viewTopic` | `topic.needs` |
| B4 | Chặng `optional: true` có nhãn "Đào sâu", bị "Học tiếp" bỏ qua, vẫn nằm trong pager. | `ORDER`, `viewHome`, `sideKnowledge` | `part.optional` |
| B5 | Dòng `goal` của giai đoạn đổi theo câu "Học xong bạn …". | `viewHome` (đã render `s.goal`, không cần sửa code) | `ROADMAP[].goal` |

Không đổi: router và các URL (`#/t/`, `#/p/`, `#/sim/`, `#/problems`, `#/sims`, `#/glossary`, `#/search/`), key `ip.done`, `ip.theme`, cơ chế nạp file.

### 3.5 Thay đổi dạng dữ liệu và kiểm tra

```js
// content/roadmap.js — giai đoạn có chặng; `topics` cũ vẫn được đọc trong thời gian chuyển
{ id: "s2", title: "Scale dữ liệu", goal: "Học xong bạn …",
  parts: [
    { id: "s2.cache", title: "Đọc nhanh hơn với cache", topics: ["caching", "dist-cache"] },
    { id: "s2.split", title: "Chia dữ liệu ra nhiều máy", topics: ["sharding", "consistent-hashing"] },
    // { id: "s2.deep", title: "Đào sâu", optional: true, topics: [...] }  ← chỉ thêm khi có topic
  ] },
// GĐ5 vừa có chặng topic vừa có bài luyện:
{ id: "s5", title: "Ghép pattern & luyện đề", goal: "…", problems: true,
  parts: [{ id: "s5.patterns", title: "Common patterns", topics: ["patterns"] }] },

// content/topics/<track>/<id>.js — hai trường tuỳ chọn
goal: "Thêm/bớt node mà chỉ dời khoảng 1/N số key",
needs: ["sharding"],
```

Tên trường là `parts` (không phải `sections`) và id chặng có dấu chấm (`s2.cache`) để không lẫn với hai thứ đã tên "section": `topic.section` / `BK.section` (mục lục Hello Interview trong `tracks.js`, id dạng `sd-core`) và `topic.sections` (mục phụ trong nội dung một topic). Trong tài liệu và giao diện vẫn gọi là "chặng".

Kiểm tra mới trong `scripts/check.mjs`:

| Kiểm tra | Bắt lỗi gì |
|---|---|
| Id chặng duy nhất; chặng không rỗng; mỗi topic nằm đúng một chặng | Chặng giữ chỗ quên xoá, topic lặp hai nơi |
| Giai đoạn có `parts` thì không có `topics` (và ngược lại); id chặng có dạng `<id giai đoạn>.<tên>` | Hai nguồn thứ tự lệch nhau; id chặng trùng id `BK.section` |
| `needs[]` trỏ tới topic có thật, không vòng, ≤ 3 mục (trừ `patterns`) | Link chết, vòng tiên quyết |
| Cùng lộ trình chính hoặc cùng nhánh: `needs` phải đứng trước trong `ORDER` | Thứ tự ngược tiên quyết (V3) |
| `title` ≤ 40 ký tự; `goal` ≤ 90 ký tự, không trùng `title` | Sidebar tràn dòng, goal lặp tiêu đề |
| `problem.topics` trỏ tới topic có thật (đã có) | — |

Cập nhật kèm: `content/_TEMPLATE.js` (ghi chú `goal`, `needs`), `CLAUDE.md` mục Data shape (một dòng), `content-system.md` §6 sửa câu "link sang bằng `related`" (vì `related` là id sim). README đang ghi cứng "5 giai đoạn, 39 chủ đề": bỏ số đếm hoặc cập nhật cùng lúc.

## 4. Những gì cố ý không làm

- **Không khoá nội dung** theo tiên quyết: người ôn thi thường nhảy thẳng tới chỗ yếu.
- **Không thêm mức tiến độ** (đang học / đã nắm / cần ôn lại): `ip.done` nhị phân đủ cho luồng trên; thêm mức là đổi dạng dữ liệu tiến độ.
- **Không thêm key `localStorage` mới** ở bước đầu ("tiếp tục nơi đã dừng" lấy từ topic chưa xong đầu tiên là đủ). Xem Q4.
- **Không đổi id** nào. Tách `patterns` (§3.2) chỉ **thêm** id mới; `patterns` giữ nguyên làm trang tổng hợp.

## 5. Lộ trình triển khai

Mỗi bước một commit (hoặc vài commit nhỏ), chạy `node scripts/check.mjs` trước mỗi commit, site luôn chạy được. "UI" = agent UI/UX; "ND" = người/agent nội dung.

| Bước | Ai | Việc | File | Phụ thuộc |
|---|---|---|---|---|
| 0 | Người dùng | Trả lời các câu hỏi §6; ghi D20–D2x vào `docs/decisions.md` | `docs/decisions.md` | — |
| 1 | UI | Nhóm A: A1 + A2 (điều hướng), rồi A3 + A5 (đủ nền, chặng kiểm tra), A4, A6 + A7, A8, A9 — mỗi cụm một commit | `app.js`, `styles.css` | — |
| 2 | UI | B0 (giai đoạn vừa có topic vừa có bài) + B1 phần đọc dữ liệu: `app.js` suy `topics` từ `parts` nếu có; `check.mjs` chấp nhận cả hai dạng. **Bắt buộc trước bước 3.** | `app.js`, `scripts/check.mjs` | 1 |
| 3 | ND | `roadmap.js`: thứ tự mới + `parts` + tiêu đề/goal giai đoạn (một commit, file dùng chung — báo trước các agent khác) | `content/roadmap.js` | 2 |
| 4 | UI | B1 phần hiển thị (sidebar, crumb, trang chủ, sims, search), B5 | `app.js`, `styles.css` | 3 |
| 5 | ND | Đổi `title` 39 topic theo §3.3, mỗi track một commit; bỏ số thứ tự trong tiêu đề section `tracks.js` (nếu Q1 giữ) | `content/topics/**`, `content/tracks.js` | — (độc lập) |
| 6 | ND | Thêm kiểm tra `goal`/`needs` vào `check.mjs` + `_TEMPLATE.js`; điền `goal` và `needs` theo §3.2–3.3, mỗi track một commit | `scripts/check.mjs`, `content/_TEMPLATE.js`, `content/topics/**` | 3 |
| 7 | UI | B2, B3 | `app.js`, `styles.css` | 6 |
| 8 | ND | Chủ đề mới của Solution Architect theo quy tắc xếp chỗ §3.1; chặng mới (3.3, Đào sâu, Quan sát…) tạo **cùng commit** với topic đầu tiên của nó; B4 làm khi chặng `optional` đầu tiên xuất hiện | `content/**`, `app.js` (B4) | 3 |
| 9 | ND | (Tuỳ chọn) Tách `patterns` thành 8 topic pattern, rồi trỏ `problem.topics` sang pattern cụ thể | `content/topics/sd/**`, `content/problems/**`, `roadmap.js` | 6 |
| 10 | ND | Cập nhật `CLAUDE.md`, `content-system.md` §6, README | docs | 3, 6 |

Bước 1 không đụng file nội dung dùng chung nên có thể làm ngay, song song với các agent khác.

## 6. Câu hỏi cần người dùng quyết

> **Q1–Q7 đã duyệt theo mặc định** (ghi thành D20–D26, §8.4). **Q13 đã giải quyết:** SA chốt 5 id Container/Kubernetes (§7.1). **Q8–Q12, Q14 đã duyệt theo mặc định** (D27).

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | `BK.section` trong `tracks.js` (mục lục Hello Interview) giữ hay bỏ? Bỏ thì phải sửa trường `section` ở 39 file. | **Giữ** làm siêu dữ liệu "nguồn Hello Interview" (không điều hướng), bỏ số thứ tự trong tiêu đề. Có thể hiện thành nhãn nhỏ trên trang topic sau. |
| Q2 | Auth cơ bản đặt trong lộ trình chính (GĐ1 › Giao tiếp & cửa vào) hay chỉ ở nhánh Vận hành production? | **Lộ trình chính** cho authn/authz cơ bản (hay bị hỏi khi thiết kế API); phần vận hành (mTLS, secrets) ở nhánh. |
| Q3 | Tách `patterns` thành 8 topic (bước 9) có đáng công viết không? | **Có, nhưng sau** bước 1–7; giải cổ chai 9/13 bài và cho Durable Execution một chỗ tự nhiên (`pattern-multi-step`). |
| Q4 | Có cần "tiếp tục đúng trang đã mở lần trước" (thêm key `ip.last`) và xuất/nhập tiến độ không? | **Chưa**; thêm khi có người học dùng nhiều thiết bị. |
| Q5 | Bộ lọc trang Luyện bài có cần nằm trong URL (`#/problems/ready`) để chia sẻ/bookmark không? | **Không**; trạng thái lọc chỉ trong trang. |
| Q6 | Tiêu đề thuật ngữ ngành: giữ tiếng Anh (Caching, Sharding) hay Việt hoá? | **Giữ tiếng Anh** cho thuật ngữ phỏng vấn dùng nguyên văn; phần giải nghĩa và `goal` bằng tiếng Việt. |
| Q7 | GĐ5 có nên tính 13 bài vào tiến độ giai đoạn (hiện "0/14" = 1 topic + 13 bài) không? | **Có**, như cách GĐ5 cũ đang đếm. |
| Q8 | Dời `concurrency` (thư mục `lld`) từ nhánh LLD sang Nền tảng CS › Concurrency? Id không đổi, chỉ đổi chỗ trong `roadmap.js`. | **Có**: 10 topic concurrency mới xây quanh nó; LLD còn tham chiếu qua `needs` của `lld-problems-list`. |
| Q9 | Lời giải chi tiết 9 bài LLD: mở rộng `lld-problems-list` hay thành trang riêng như bài System Design (loại nội dung mới, phải sửa `app.js`)? | **Mở rộng `lld-problems-list`** trước; tách trang riêng khi có ≥ 3 bài viết đủ sâu. |
| Q10 | Kỹ năng viết code và Behavioral có thuộc phạm vi site "Backend Knowledge" không? | **Có**, là hai nhánh song song, không chen vào lộ trình chính. |
| Q11 | Tách "Container & Kubernetes" (id giai đoạn `cloud`) và "Vận hành production" (id mới `ops`) thành hai nhánh, hay giữ một nhánh? | **Hai nhánh**: mảng container có 8 topic, observability/deploy là câu hỏi khác. |
| Q12 | Giữ tiền tố id của Research (`os-`, `thr-`, `io-`, `conc-`, `async-`, `net-`, `db-`, `code-`, `dsa-`, `beh-`, `ood-`, `mc-`)? Topic hiện có không dùng tiền tố. Id sẽ thành hợp đồng ngay khi phát hành, nên chỉ đổi được bây giờ. | **Giữ**: tiền tố giúp nhận ra nhánh trong URL, và các id đã được hai tài liệu tham chiếu chéo. |
| Q13 | 9 id Container/Kubernetes là id tạm (SA chưa commit danh sách). Ai chốt? | **Đã giải quyết:** SA chốt `container-basics`, `k8s-core`, `dockerfile`, `k8s-operations`, `image-delivery`. |
| Q14 | Nền tảng CS có 60 topic: giữ một nhánh 6 chặng hay tách hai nhánh ("Hệ điều hành & I/O", "Concurrency & Async")? | **Một nhánh**: sidebar gập theo chặng (A7, B1) là đủ; tách khi chặng nào vượt ~15 topic. |

## 7. Phân loại chủ đề mới (giai đoạn 2)

Nguồn:

- **Solution Architect:** `docs/proposals/content-gaps.md` trên nhánh `sa/content-gaps` (đỉnh `5cec411`), Phần B, 20 chủ đề:
  - mục 1–15: System Design;
  - mục 16–20: Container/Kubernetes.
- **Research:** `docs/proposals/interview-topic-catalog.md` trên nhánh `research/interview-catalog` (đỉnh `a2d8885`), 134 đề mục mới.

Mọi số liệu dưới đây do một script sinh ra. Script đọc thẳng hai file nguồn và registry `BK`, rồi kiểm:

- Mọi id Research đều được xử lý (đặt vào cây hoặc gộp): 112 đặt + 22 gộp = 134.
- Có đủ 20 id SA.
- Không id mới nào trùng id topic, problem, sim, track hay section đang có.
- Mọi topic có sẵn vẫn nằm trong cây.
- Tiêu đề ≤ 40 ký tự, `goal` ≤ 90 ký tự, `needs` ≤ 3 mục và trỏ tới id có thật.
- Trong cùng lộ trình chính hoặc cùng một nhánh, tiên quyết đứng trước topic cần nó.

Kết quả: **132 topic mới** (20 SA, 112 Research) và **22 đề mục gộp**. Cây có tổng cộng 171 topic.

### 7.1 Gộp trùng

Luật áp dụng:

- Trùng giữa hai danh sách thì giữ id của SA.
- Trùng với topic có sẵn thì ghi "mở rộng topic X", không tạo id mới.
- Trùng ở mức nhỏ (chỉ là một mục trong bài khác) thì gộp vào bài lớn hơn.

| Id Research | Gộp vào | Lý do |
|---|---|---|
| `sd-observability` | `observability` | trùng SA |
| `sd-resilience` | `resilience` | trùng SA |
| `sd-outbox-cdc` | `outbox-cdc` | trùng SA |
| `sd-durable-execution` | `durable-execution` | trùng SA |
| `sd-consensus` | `consensus` | trùng SA |
| `sd-authn-authz` | `auth` | trùng SA |
| `sd-distributed-time` | `time-ordering` | trùng SA |
| `sd-replication` | `replication` | trùng SA |
| `sd-tech-deep-dives` | — | không phải một topic: mỗi công nghệ là một topic riêng trong chặng **Đào sâu** của giai đoạn tương ứng (§3.1), viết khi có nhu cầu |
| `sd-more-problems` | — | là bài luyện (`BK.problem`), không phải topic: vào GĐ5 › Luyện đề theo mức |
| `db-storage-engines` | `storage-engines` | trùng SA |
| `db-wal-recovery` | `storage-engines` | SA đã gồm WAL và crash recovery |
| `os-containers-primitives` | `container-basics` | trùng SA (namespace, cgroup nằm trong `container-basics`) |
| `conc-optimistic-pessimistic` | `db-locking` | mở rộng: optimistic (version/CAS) vs pessimistic (`FOR UPDATE`) là một mục của `db-locking` |
| `db-schema-migration` | `deployment-safety` | mở rộng: expand/contract là trọng tâm của `deployment-safety` |
| `code-logging` | `observability` | mở rộng: thêm mục "log ở mức code" vào `observability` |
| `db-normalization` | `data-modeling` | mở rộng topic có sẵn `data-modeling` |
| `net-proxy-nat` | `lb-gateway-cdn` | mở rộng topic có sẵn `lb-gateway-cdn` |
| `net-serialization` | `api-design` | mở rộng topic có sẵn `api-design` (JSON vs Protobuf); phần schema evolution nằm ở `deployment-safety` |
| `ood-problem-walkthroughs` | `lld-problems-list` | mở rộng topic có sẵn `lld-problems-list` (xem Q9 về trang lời giải riêng) |
| `ood-concurrent-lld` | `conc-classic-problems` | mở rộng: bài LLD thread-safe là một nhóm trong `conc-classic-problems` |
| `thr-virtual-threads-java` | `thr-green-threads` | mở rộng: pinning và giới hạn của virtual thread là một mục của `thr-green-threads` |

**Id Container tạm đã bỏ.** Bản `431e065` của tài liệu này đặt 9 id Container tạm vì lúc đó SA chưa chốt. Nay SA đã chốt 5 id. Các id tạm chưa từng phát hành, nên bỏ đi không ảnh hưởng URL hay tiến độ.

| Id tạm (đã bỏ) | Mở rộng vào id SA |
|---|---|
| `container-image` | `container-basics` (SA gồm cả image, layer, OCI) |
| `container-build` | `dockerfile` (build cache) |
| `container-pipeline` | `image-delivery` |
| `k8s-workloads` | `k8s-core` (Pod, Deployment); StatefulSet và rolling update thuộc `k8s-operations` |
| `k8s-networking` | `k8s-core` (Service, Ingress) |
| `k8s-health-scaling` | `k8s-operations` (probe, resource, HPA) |
| `k8s-rbac` | `k8s-core` (Namespace, RBAC) |

`container-basics` và `dockerfile` trùng id SA nên giữ nguyên.

Theo Q28 trong đề xuất của SA: khi có `k8s-core`, `eks` chỉ giữ phần riêng của AWS, và bảng "Object Kubernetes hay dùng" trong `eks` rút thành link sang `k8s-core`. Đây chỉ là sửa nội dung, id không đổi.

Những cặp **không** gộp dù gần nhau, vì khác tầng:

| Cặp | Vì sao để riêng |
|---|---|
| `async-backpressure` ↔ `resilience` | Một bài nói giới hạn concurrency trong code, bài kia nói load shedding ở mức hệ thống. Hai bài link chéo nhau. |
| `async-cancellation-timeout` ↔ `resilience` | Huỷ task và truyền deadline trong code, khác với chọn timeout giữa các service |
| `conc-atomic-cas` ↔ `redis-atomic`, `dist-lock` | Atomic trong một process, khác với atomic giữa nhiều máy |
| `conc-classic-problems` ↔ `rate-limiter` (problem) | Bài coding trong một process, khác với bài System Design |
| `db-isolation-anomalies` ↔ `core-db`, sim `isolation` | `core-db` chỉ bàn chọn SQL hay NoSQL. Isolation cần bài riêng, dùng lại sim `isolation`. |

### 7.2 Cây danh mục sau khi gộp

`+` = topic mới; không có dấu = topic có sẵn (id giữ nguyên). Chặng ghi "(Đào sâu)" là `optional: true`.

```text
GĐ1 · Nền móng
  Khung trả lời: delivery, numbers
  Networking & API: networking, api-design, lb-gateway-cdn, +auth
  Database: data-modeling, core-db, indexing, +db-isolation-anomalies
  Đào sâu: Database Internals (Đào sâu): +db-query-tuning, +db-sql-handwriting, +storage-engines, +db-mvcc
GĐ2 · Scale dữ liệu
  Caching: caching, dist-cache
  Sharding: sharding, consistent-hashing, +id-generation
  Consistency & Replication: cap, +replication, +multi-region
  Công nghệ trọng tâm: redis
  Đào sâu: Distributed Systems (Đào sâu): +time-ordering
GĐ3 · Async & Coordination
  Message Queue & Streaming: queue, streams, kafka
  Resilience & Idempotency: +resilience, +idempotency
  Contention & Locking: +db-locking, dist-lock, +consensus
  Multi-step Processes: +outbox-cdc, +durable-execution
  Đào sâu: Stream Processing (Đào sâu): +stream-processing
GĐ4 · Lưu trữ chuyên dụng
  Kho chuyên dụng: blob, search, +vector-search, bigdata-ds
  Chọn công nghệ: tech-cheatsheet
GĐ5 · Ghép pattern & luyện đề
  Common Patterns: patterns
∥ Nền tảng CS
  Process, Thread & Memory: +os-process-lifecycle, +thr-thread-vs-process, +os-context-switch, +os-memory-layout, +os-virtual-memory, +os-syscall-kernel-mode, +os-scheduling, +code-memory-gc, +os-cpu-cache-locality
  Thread trong thực tế: +thr-io-vs-cpu-bound, +thr-thread-pool, +io-connection-pool, +thr-gil, +thr-green-threads, +thr-goroutine-channel, +thr-thread-local-context
  I/O & hệ điều hành: +os-file-descriptors, +io-blocking-models, +io-epoll-kqueue, +io-reactor-proactor, +io-uring, +io-buffering-fsync, +os-filesystem, +io-zero-copy, +os-ipc, +os-signals-shutdown, +os-linux-diagnostics
  Concurrency: +conc-race-condition, concurrency, +conc-monitor-rwlock, +conc-livelock-starvation, +conc-atomic-cas, +conc-memory-model, +conc-thread-safe-collections, +conc-producer-consumer, +conc-parallelism-amdahl, +conc-classic-problems, +conc-testing-debugging
  Async Programming: +async-concurrency-models, +async-event-loop, +async-callback-promise-await, +async-microtask-queue, +async-coroutine, +async-future-combinators, +async-error-handling, +async-blocking-in-loop, +async-backpressure, +async-cancellation-timeout, +async-structured-concurrency, +async-sync-primitives, +conc-actor-model, +async-reactive-streams
  Mạng máy tính: +net-url-to-page, +net-dns-deep, +net-tcp-deep, +net-sockets, +net-http-semantics, +net-http-versions, +net-tls, +net-cors-cookies
∥ Kỹ năng viết code
  Vòng coding: +code-interview-communication, +code-language-choice
  Clean Code: +code-clean-naming, +code-error-handling, +code-defensive-validation, +code-immutability, +code-fp-vs-oop, +code-api-design-code, +code-generics-types
  Kiểm thử & debug: +code-testing-fundamentals, +code-testable-design, +code-debugging, +code-refactoring, +code-review
  Hiệu năng & an toàn: +code-complexity-perf, +code-secure-coding, +code-git-workflow
∥ Behavioral
  Câu chuyện của bạn: +beh-star-stories, +beh-common-questions, +beh-project-deep-dive
  Quy trình & cấp độ: +beh-interview-process, +beh-self-intro, +beh-senior-signals
∥ Container & Kubernetes
  Container cơ bản: +container-basics, +dockerfile
  Kubernetes: +k8s-core, +k8s-operations
  Từ build tới deploy: +image-delivery
  Trên AWS: ecs, eks, ecs-vs-eks
∥ Vận hành production
  Observability: +observability
  Deployment: +deployment-safety
∥ Low-Level Design
  Khung trả lời & OOP: lld-delivery, oop-pillars, +ood-uml-diagrams
  Design Principles: solid, principles-other
  Design Patterns: patterns-gof, +ood-state-machine
  Luyện đề LLD: lld-problems-list, +mc-machine-coding-round
∥ Kiến trúc & phương pháp
  Tổ chức code: code-architecture
  Tổ chức hệ thống: system-architecture
  Phương pháp phát triển: dev-methods
∥ Coding · DSA
  Độ phức tạp: bigo, +dsa-recursion
  Cấu trúc dữ liệu: ds, +dsa-arrays-hashing, +dsa-linked-list, +dsa-stack-monotonic, +dsa-heap-topk, +dsa-trees, +dsa-trie, +dsa-design-ds, +dsa-range-trees
  Thuật toán: algo, +dsa-two-pointers, +dsa-sliding-window, +dsa-prefix-sum, +dsa-sorting, +dsa-binary-search-answer, +dsa-intervals, +dsa-greedy, +dsa-backtracking, +dsa-graphs, +dsa-matrix, +dsa-dp, +dsa-strings, +dsa-bit-manipulation
```

Thay đổi so với cây ở §3.1 (ở các điểm này §7 ghi đè §3.1):

| Điểm | §3.1 | Sau khi có danh sách thật | Lý do |
|---|---|---|---|
| Transaction & isolation | chỗ chứa ở GĐ2 › Consistency & Replication | GĐ1 › Database (`db-isolation-anomalies`) | Theo quy tắc xếp chỗ (câu 4): đây là chuyện của một database, không phải của nhiều máy |
| Consensus | GĐ2 › Consistency & Replication | GĐ3 › Contention & Locking, sau `dist-lock` | SA lấy `dist-lock` làm tiên quyết (lease, fencing); để ở GĐ2 thì tiên quyết lại đứng sau |
| Chặng mới ở GĐ3 | — | "Resilience & Idempotency" (`resilience`, `idempotency`) | Hai bài P0, là nền cho outbox và durable execution |
| `db-locking` | — | GĐ3 › Contention & Locking, trước `dist-lock` | Học lock trong một database trước lock giữa nhiều máy |
| Nhánh "Container trên AWS" / "Vận hành production" | một nhánh `cloud` | Tách hai: **Container & Kubernetes** (id giai đoạn `cloud`, thêm `ecs`, `eks`, `ecs-vs-eks`) và **Vận hành production** (id giai đoạn mới `ops`) | Mảng container có 5 topic mới + 3 topic có sẵn và thứ tự học riêng theo SA: `container-basics` → `dockerfile` → `k8s-core` → `k8s-operations` → `image-delivery` → `ecs`/`eks` |
| Nhánh mới | — | **Nền tảng CS** (6 chặng theo gợi ý của Research: Process → Thread → I/O → Concurrency → Async → Mạng), **Kỹ năng viết code**, **Behavioral** | Đều là vòng phỏng vấn riêng, không phải một phần của bài System Design (quy tắc câu 2 và 9) |
| `concurrency` (thư mục `lld`) | LLD › Concurrency | Nền tảng CS › Concurrency. **Id giữ nguyên**, chỉ đổi chỗ trong `roadmap.js`; file vẫn ở `content/topics/lld/` | 10 topic concurrency mới xây quanh topic này. LLD vẫn tham chiếu chéo qua `needs` (Q8). |
| `needs` của `durable-execution` | SA ghi `queue`, `patterns` | `queue`, `idempotency` | `patterns` ở GĐ5, đứng sau. Saga được giải thích ngay trong bài và link sang sim `saga`. Khi tách `pattern-multi-step` (§3.2), durable execution là phần chính của pattern đó. |

Thư mục cho file mới (track = thư mục, không quyết định điều hướng):

| Thư mục | Topic |
|---|---|
| `content/topics/sd/` | 15 topic System Design của SA (kể cả `observability`, `deployment-safety`) và `db-*` |
| `content/topics/cs/` (track mới) | `os-*`, `thr-*`, `io-*`, `conc-*`, `async-*`, `net-*`, `code-memory-gc` |
| `content/topics/code/` (track mới) | Các `code-*` còn lại |
| `content/topics/beh/` (track mới) | `beh-*` |
| `content/topics/cloud/` | `container-basics`, `dockerfile`, `k8s-*`, `image-delivery` |
| `content/topics/lld/` | `ood-*`, `mc-*` |
| `content/topics/dsa/` | `dsa-*` |

### 7.3 Tiêu đề, goal, needs từng topic mới

- Tiêu đề theo quy ước §3.3. Tiêu đề tạm trong tài liệu nguồn chỉ là gợi ý; khi viết dùng cột tiêu đề ở đây.
- Tiên quyết **xuyên nhánh** chỉ để hiển thị, không ràng buộc thứ tự. Ví dụ: `container-basics` cần `networking`, `code-fp-vs-oop` cần `oop-pillars`.
- Cột "Đợt" xem §8.

#### GĐ1 · Nền móng

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Networking & API | `auth` | Authentication & Authorization | Chọn session hay token, đi đúng luồng OAuth 2.0/OIDC và thu hồi quyền | `api-design`, `networking` | SA · P1 | 2 |
| Database | `db-isolation-anomalies` | Transaction & Isolation Level | Nhận ra lost update, write skew và chọn isolation level chặn được nó | `core-db` | Research · P0 | 1 |
| Đào sâu: Database Internals *(Đào sâu)* | `db-query-tuning` | EXPLAIN & Query Tuning | Đọc query plan và sửa truy vấn không dùng được index | `indexing` | Research · P0 | 2 |
| Đào sâu: Database Internals *(Đào sâu)* | `db-sql-handwriting` | Viết SQL tay | Viết join, group by, window function cho câu hỏi phỏng vấn | `core-db` | Research · P1 | 3 |
| Đào sâu: Database Internals *(Đào sâu)* | `storage-engines` | Storage Engine: B-Tree, LSM, WAL | Giải thích vì sao DB này ghi nhanh, DB kia đọc nhanh và commit bền nhờ WAL | `indexing`, `core-db` | SA · P2 | 4 |
| Đào sâu: Database Internals *(Đào sâu)* | `db-mvcc` | MVCC & Snapshot | Giải thích đọc không chặn ghi và vì sao transaction dài làm phình bảng | `db-isolation-anomalies`, `storage-engines` | Research · P1 | 3 |

#### GĐ2 · Scale dữ liệu

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Sharding | `id-generation` | Distributed ID Generation | Chọn UUIDv7, Snowflake hay dải ID theo yêu cầu sắp xếp và shard | `sharding`, `indexing` | SA · P1 | 2 |
| Consistency & Replication | `replication` | Replication & Failover | Chọn leader–follower, multi-leader hay quorum và xử lý replica lag | `core-db`, `cap` | SA · P0 | 1 |
| Consistency & Replication | `multi-region` | Multi-region & DR | Chọn chiến lược DR theo RPO/RTO và chạy hệ thống trên nhiều region | `replication`, `lb-gateway-cdn` | SA · P1 | 2 |
| Đào sâu: Distributed Systems *(Đào sâu)* | `time-ordering` | Clocks & Event Ordering | Sắp thứ tự sự kiện khi đồng hồ lệch bằng Lamport/vector clock | `replication` | SA · P2 | 4 |

#### GĐ3 · Async & Coordination

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Resilience & Idempotency | `resilience` | Timeout, Retry & Circuit Breaker | Đặt timeout, retry có jitter, circuit breaker để lỗi không lan dây chuyền | `api-design`, `queue` | SA · P0 | 1 |
| Resilience & Idempotency | `idempotency` | Idempotency | Cho phép gửi lại request/message mà không xử lý hai lần | `api-design`, `queue` | SA · P0 | 1 |
| Contention & Locking | `db-locking` | Database Locking | Chọn optimistic hay pessimistic lock và tránh deadlock trong DB | `db-isolation-anomalies` | Research · P0 | 2 |
| Contention & Locking | `consensus` | Consensus & Leader Election | Giải thích Raft, lease, fencing và vì sao cluster cần đa số | `replication`, `dist-lock` | SA · P1 | 2 |
| Multi-step Processes | `outbox-cdc` | Outbox & CDC | Ghi DB và phát event mà không mất hay lệch nhau | `core-db`, `kafka` | SA · P0 | 1 |
| Multi-step Processes | `durable-execution` | Durable Execution | Chạy quy trình nhiều bước sống qua crash, deploy và chờ nhiều ngày | `queue`, `idempotency` | SA · P0 | 1 |
| Đào sâu: Stream Processing *(Đào sâu)* | `stream-processing` | Stream Processing | Tính toán theo window, watermark và giữ state khi xử lý luồng | `streams`, `kafka` | SA · P2 | 4 |

#### GĐ4 · Lưu trữ chuyên dụng

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Kho chuyên dụng | `vector-search` | Vector Search & ANN | Tìm theo độ tương đồng bằng embedding và chọn index ANN | `search`, `indexing` | SA · P1 | 2 |

#### ∥ Nền tảng CS

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Process, Thread & Memory | `os-process-lifecycle` | Process: fork, exec, zombie | Kể chuyện gì xảy ra khi chạy một lệnh và dọn zombie process | — | Research · P0 | 1 |
| Process, Thread & Memory | `thr-thread-vs-process` | Thread hay Process? | Chọn thread hay process theo chi phí, bộ nhớ chung và cô lập lỗi | `os-process-lifecycle` | Research · P0 | 1 |
| Process, Thread & Memory | `os-context-switch` | Context Switch | Ước lượng chi phí chuyển ngữ cảnh giữa process, thread, coroutine | `thr-thread-vs-process` | Research · P0 | 1 |
| Process, Thread & Memory | `os-memory-layout` | Stack & Heap | Biết biến nằm ở stack hay heap và vì sao đệ quy sâu tràn stack | — | Research · P0 | 1 |
| Process, Thread & Memory | `os-virtual-memory` | Virtual Memory & Paging | Giải thích page fault, TLB, swap và tác động lên latency | `os-memory-layout` | Research · P0 | 1 |
| Process, Thread & Memory | `os-syscall-kernel-mode` | System Call & Kernel Mode | Giải thích vì sao syscall đắt hơn gọi hàm thường | `os-process-lifecycle` | Research · P1 | 3 |
| Process, Thread & Memory | `os-scheduling` | CPU Scheduling | So sánh preemptive và cooperative, nhận ra job bị đói CPU | `os-context-switch` | Research · P1 | 3 |
| Process, Thread & Memory | `code-memory-gc` | Memory & Garbage Collection | Tìm memory leak trong ngôn ngữ có GC và hiểu stop-the-world pause | `os-memory-layout` | Research · P1 | 3 |
| Process, Thread & Memory | `os-cpu-cache-locality` | CPU Cache & Locality | Viết vòng lặp thân thiện cache và nhận ra false sharing | `os-memory-layout` | Research · P2 | 4 |
| Thread trong thực tế | `thr-io-vs-cpu-bound` | I/O-bound hay CPU-bound? | Chọn thread, process hay async theo loại tải | `thr-thread-vs-process` | Research · P0 | 2 |
| Thread trong thực tế | `thr-thread-pool` | Thread Pool | Chọn kích thước pool, hàng đợi và cách từ chối khi đầy | `thr-io-vs-cpu-bound` | Research · P0 | 2 |
| Thread trong thực tế | `io-connection-pool` | Connection Pool | Chọn số connection tới DB và nhận ra connection leak | `thr-thread-pool` | Research · P1 | 3 |
| Thread trong thực tế | `thr-gil` | GIL & Free-threading | Biết khi nào multithreading Python có ích và khi nào không | `thr-io-vs-cpu-bound` | Research · P0 | 2 |
| Thread trong thực tế | `thr-green-threads` | Goroutine & Virtual Thread | Giải thích M:N scheduling và vì sao goroutine rẻ hơn OS thread | `thr-thread-vs-process`, `os-context-switch` | Research · P0 | 2 |
| Thread trong thực tế | `thr-goroutine-channel` | Goroutine & channel | Dựng pipeline, fan-out/fan-in bằng channel và tránh goroutine leak | `thr-green-threads` | Research · P1 | 3 |
| Thread trong thực tế | `thr-thread-local-context` | Thread-local & truyền context | Truyền request id, trace qua thread pool và task an toàn | `thr-thread-pool` | Research · P2 | 4 |
| I/O & hệ điều hành | `os-file-descriptors` | File Descriptor & ulimit | Sửa lỗi "too many open files" và hiểu socket cũng là fd | `os-process-lifecycle` | Research · P1 | 3 |
| I/O & hệ điều hành | `io-blocking-models` | Blocking, Non-blocking, Async I/O | Phân biệt 4 mô hình I/O và vì sao event loop cần multiplexing | `os-file-descriptors` | Research · P0 | 2 |
| I/O & hệ điều hành | `io-epoll-kqueue` | epoll & kqueue | Giải thích vì sao epoll scale hơn select, level vs edge triggered | `io-blocking-models` | Research · P1 | 3 |
| I/O & hệ điều hành | `io-reactor-proactor` | Reactor & Proactor | Nhận ra mô hình I/O của Nginx, Netty, libuv | `io-epoll-kqueue` | Research · P1 | 3 |
| I/O & hệ điều hành | `io-uring` | io_uring | Giải thích io_uring giảm syscall bằng hàng đợi completion | `io-reactor-proactor` | Research · P2 | 4 |
| I/O & hệ điều hành | `io-buffering-fsync` | Buffer, Flush & fsync | Biết dữ liệu "đã ghi" thật sự nằm ở đâu và fsync tốn gì | `os-file-descriptors` | Research · P1 | 3 |
| I/O & hệ điều hành | `os-filesystem` | File System & Journaling | Giải thích inode, journaling và page cache | `io-buffering-fsync` | Research · P2 | 4 |
| I/O & hệ điều hành | `io-zero-copy` | Zero-copy & Page Cache | Giải thích sendfile, mmap và vì sao Kafka đọc đĩa nhanh | `os-virtual-memory`, `io-buffering-fsync` | Research · P2 | 4 |
| I/O & hệ điều hành | `os-ipc` | IPC: pipe, socket, shared memory | Chọn pipe, Unix socket hay shared memory cho hai process | `thr-thread-vs-process` | Research · P1 | 3 |
| I/O & hệ điều hành | `os-signals-shutdown` | Signal & Graceful Shutdown | Dừng app không rớt request: SIGTERM, drain, PID 1 trong container | `os-process-lifecycle` | Research · P0 | 2 |
| I/O & hệ điều hành | `os-linux-diagnostics` | Chẩn đoán trên Linux | Dùng top, strace, lsof, /proc để tìm nguyên nhân server chậm | `os-file-descriptors` | Research · P2 | 4 |
| Concurrency | `conc-race-condition` | Race Condition | Nhận ra check-then-act và phân biệt race condition với data race | `thr-thread-vs-process` | Research · P0 | 2 |
| Concurrency | `conc-monitor-rwlock` | Monitor, RW Lock, Spinlock | Chọn loại lock và độ mịn lock theo mức tranh chấp | `concurrency` | Research · P1 | 3 |
| Concurrency | `conc-livelock-starvation` | Livelock, Starvation, Fairness | Nhận ra livelock, thread bị đói và priority inversion | `concurrency` | Research · P0 | 2 |
| Concurrency | `conc-atomic-cas` | Atomic, CAS & Lock-free | Dùng CAS đúng chỗ và biết bài toán ABA | `conc-race-condition` | Research · P0 | 2 |
| Concurrency | `conc-memory-model` | Memory Model & Happens-before | Giải thích visibility, reordering và volatile đảm bảo gì | `conc-atomic-cas` | Research · P0 | 2 |
| Concurrency | `conc-thread-safe-collections` | Thread-safe Collections | Chọn concurrent map, copy-on-write hay dữ liệu immutable | `conc-atomic-cas` | Research · P1 | 3 |
| Concurrency | `conc-producer-consumer` | Producer–Consumer | Cài bounded blocking queue bằng lock và condition variable | `concurrency` | Research · P1 | 3 |
| Concurrency | `conc-parallelism-amdahl` | Concurrency, Parallelism & Amdahl | Ước lượng tăng tốc khi thêm core bằng định luật Amdahl | `thr-io-vs-cpu-bound` | Research · P1 | 3 |
| Concurrency | `conc-classic-problems` | Bài coding concurrency kinh điển | Giải bài in theo thứ tự, readers–writers, rate limiter thread-safe | `concurrency`, `conc-producer-consumer` | Research · P0 | 2 |
| Concurrency | `conc-testing-debugging` | Test & debug concurrency | Bắt race bằng race detector, stress test và đọc thread dump | `conc-race-condition` | Research · P1 | 3 |
| Async | `async-concurrency-models` | Thread, Event Loop, Coroutine, Actor | So sánh 4 mô hình concurrency cho server nhiều kết nối | `thr-thread-vs-process`, `io-blocking-models` | Research · P0 | 2 |
| Async | `async-event-loop` | Event Loop | Giải thích một thread phục vụ nhiều request nhờ event loop | `async-concurrency-models` | Research · P0 | 2 |
| Async | `async-callback-promise-await` | Callback, Promise, async/await | Viết code async không callback hell và chạy song song đúng cách | `async-event-loop` | Research · P0 | 2 |
| Async | `async-microtask-queue` | Microtask & Macrotask | Đoán đúng thứ tự chạy khi trộn Promise và setTimeout | `async-event-loop` | Research · P1 | 3 |
| Async | `async-coroutine` | Coroutine | Giải thích suspend/resume và coroutine khác thread ở đâu | `async-callback-promise-await` | Research · P0 | 2 |
| Async | `async-future-combinators` | Future Combinators | Gọi nhiều việc song song và xử lý lỗi lan truyền | `async-callback-promise-await` | Research · P1 | 3 |
| Async | `async-error-handling` | Async Error Handling | Không để exception bị nuốt hay unhandled rejection làm chết process | `async-callback-promise-await` | Research · P1 | 3 |
| Async | `async-blocking-in-loop` | Đừng chặn event loop | Đưa việc CPU-bound và lời gọi blocking ra khỏi event loop | `async-event-loop`, `thr-io-vs-cpu-bound` | Research · P0 | 2 |
| Async | `async-backpressure` | Backpressure trong code | Giới hạn số việc đồng thời và dùng queue có giới hạn | `async-event-loop` | Research · P0 | 2 |
| Async | `async-cancellation-timeout` | Cancellation, Timeout & Deadline | Huỷ việc con khi client bỏ đi và truyền deadline qua các lời gọi | `async-callback-promise-await` | Research · P0 | 2 |
| Async | `async-structured-concurrency` | Structured Concurrency | Dùng TaskGroup để việc con không chạy mồ côi | `async-cancellation-timeout` | Research · P1 | 3 |
| Async | `async-sync-primitives` | Lock trong code async | Biết code async đơn luồng vẫn có race và khi nào cần asyncio.Lock | `conc-race-condition`, `async-event-loop` | Research · P1 | 3 |
| Async | `conc-actor-model` | Actor Model | Tránh lock bằng message passing và xử lý mailbox đầy | `async-concurrency-models` | Research · P1 | 3 |
| Async | `async-reactive-streams` | Reactive Streams | Nhận ra khi nào reactive đáng dùng hơn async/await | `async-backpressure` | Research · P2 | 4 |
| Mạng máy tính | `net-url-to-page` | Gõ URL thì chuyện gì xảy ra | Kể đủ các bước từ DNS tới render và bước nào tốn thời gian | `networking` | Research · P0 | 1 |
| Mạng máy tính | `net-dns-deep` | DNS | Giải thích resolve đệ quy, TTL, loại record và DNS load balancing | `networking` | Research · P1 | 3 |
| Mạng máy tính | `net-tcp-deep` | TCP chuyên sâu | Giải thích handshake, TIME_WAIT, flow và congestion control | `networking` | Research · P0 | 2 |
| Mạng máy tính | `net-sockets` | Socket & giới hạn kết nối | Tính số kết nối tối đa và nhận ra hết ephemeral port | `net-tcp-deep`, `os-file-descriptors` | Research · P1 | 3 |
| Mạng máy tính | `net-http-semantics` | HTTP Semantics | Chọn method, status code, header cache đúng nghĩa | `networking` | Research · P1 | 3 |
| Mạng máy tính | `net-http-versions` | HTTP/1.1, HTTP/2, HTTP/3 | Giải thích multiplexing, head-of-line blocking và vì sao QUIC dùng UDP | `net-tcp-deep` | Research · P0 | 2 |
| Mạng máy tính | `net-tls` | TLS & mTLS | Giải thích TLS handshake, chuỗi chứng chỉ và khi nào cần mTLS | `net-tcp-deep` | Research · P0 | 2 |
| Mạng máy tính | `net-cors-cookies` | CORS, cookie & CSRF | Cấu hình CORS, cookie flag và chặn CSRF | `net-http-semantics` | Research · P1 | 3 |

#### ∥ Kỹ năng viết code

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Vòng coding | `code-interview-communication` | Kỹ năng vòng coding | Làm rõ đề, nói to suy nghĩ, đi từ brute force và tự test | — | Research · P0 | 1 |
| Vòng coding | `code-language-choice` | Chọn ngôn ngữ phỏng vấn | Chọn ngôn ngữ và thuộc thư viện chuẩn cần cho vòng coding | — | Research · P1 | 1 |
| Clean Code | `code-clean-naming` | Đặt tên & hàm nhỏ | Đặt tên rõ nghĩa và tách hàm theo một mức trừu tượng | — | Research · P0 | 2 |
| Clean Code | `code-error-handling` | Error Handling | Chọn exception hay error value, không nuốt lỗi và thêm ngữ cảnh | — | Research · P0 | 2 |
| Clean Code | `code-defensive-validation` | Validate ở biên & invariant | Validate dữ liệu ở biên và giữ invariant bằng kiểu dữ liệu | `code-error-handling` | Research · P1 | 3 |
| Clean Code | `code-immutability` | Immutability & Value Object | Dùng dữ liệu bất biến để giảm lỗi và an toàn khi chạy song song | `code-clean-naming` | Research · P1 | 3 |
| Clean Code | `code-fp-vs-oop` | Functional hay OOP? | Chọn composition, pure function hay kế thừa cho từng tình huống | `oop-pillars` | Research · P1 | 3 |
| Clean Code | `code-api-design-code` | Thiết kế API ở mức code | Thiết kế chữ ký hàm, interface nhỏ và giữ tương thích ngược | `code-clean-naming` | Research · P1 | 3 |
| Clean Code | `code-generics-types` | Generics & Type System | Giải thích variance, type erasure và khi nào cần generic | — | Research · P2 | 4 |
| Kiểm thử & debug | `code-testing-fundamentals` | Kiểm thử căn bản | Chọn unit, integration, e2e và mock, stub, fake đúng chỗ | — | Research · P0 | 2 |
| Kiểm thử & debug | `code-testable-design` | Viết code dễ test | Tách phụ thuộc bằng DI và pure function để test được | `code-testing-fundamentals` | Research · P1 | 3 |
| Kiểm thử & debug | `code-debugging` | Debug có hệ thống | Tái hiện, thu hẹp, chia đôi bằng git bisect để tìm bug | — | Research · P0 | 2 |
| Kiểm thử & debug | `code-refactoring` | Refactoring & Code Smell | Refactor từng bước nhỏ an toàn, kể cả code legacy chưa có test | `code-testing-fundamentals` | Research · P1 | 3 |
| Kiểm thử & debug | `code-review` | Code Review | Review đúng trọng tâm và viết, nhận góp ý mang tính xây dựng | `code-clean-naming` | Research · P1 | 3 |
| Hiệu năng & an toàn | `code-complexity-perf` | Hiệu năng ở mức code | Đo bằng profiler trước rồi mới tối ưu và chọn cấu trúc dữ liệu | `bigo` | Research · P1 | 3 |
| Hiệu năng & an toàn | `code-secure-coding` | Secure Coding căn bản | Chặn injection, lưu mật khẩu đúng cách và giữ secret khỏi code | `code-defensive-validation` | Research · P1 | 3 |
| Hiệu năng & an toàn | `code-git-workflow` | Git & quy trình | Commit nhỏ, chọn merge hay rebase và đánh version theo semver | — | Research · P2 | 4 |

#### ∥ Behavioral

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Câu chuyện của bạn | `beh-star-stories` | Khung STAR | Kể một câu chuyện theo STAR và có sẵn ngân hàng câu chuyện | — | Research · P0 | 1 |
| Câu chuyện của bạn | `beh-common-questions` | Câu hỏi behavioral hay gặp | Trả lời nhóm câu hỏi xung đột, thất bại, ownership, mơ hồ | `beh-star-stories` | Research · P0 | 1 |
| Câu chuyện của bạn | `beh-project-deep-dive` | Kể sâu về dự án | Vẽ lại kiến trúc dự án đã làm, nêu trade-off và số liệu | `beh-star-stories` | Research · P0 | 1 |
| Quy trình & cấp độ | `beh-interview-process` | Quy trình & rubric phỏng vấn | Biết mỗi vòng chấm tín hiệu gì để chuẩn bị đúng chỗ | — | Research · P1 | 3 |
| Quy trình & cấp độ | `beh-self-intro` | Tự giới thiệu & hỏi ngược | Giới thiệu bản thân trong 2 phút và chuẩn bị câu hỏi cho interviewer | — | Research · P1 | 3 |
| Quy trình & cấp độ | `beh-senior-signals` | Tín hiệu senior | Kể được scope, ảnh hưởng, mentoring và quyết định kỹ thuật lớn | `beh-project-deep-dive` | Research · P1 | 3 |

#### ∥ Container & Kubernetes

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Container cơ bản | `container-basics` | Container là gì? | Giải thích container khác VM nhờ namespace, cgroup và image nhiều layer | `networking` | SA · P0 | 1 |
| Container cơ bản | `dockerfile` | Dockerfile & Build Cache | Viết Dockerfile nhỏ, chạy non-root và build lại nhanh nhờ cache layer | `container-basics` | SA · P1 | 1 |
| Kubernetes | `k8s-core` | Kubernetes căn bản | Giải thích reconcile loop và vai trò Pod, Deployment, Service, Ingress | `container-basics` | SA · P0 | 1 |
| Kubernetes | `k8s-operations` | Chạy ổn định trên Kubernetes | Đặt probe, requests/limits, rollout, StatefulSet để pod không chết oan | `k8s-core` | SA · P1 | 2 |
| Từ build tới deploy | `image-delivery` | Build, tag, push, deploy | Đưa image từ build tới cluster bằng digest, scan và SBOM | `dockerfile`, `system-architecture` | SA · P1 | 2 |

#### ∥ Vận hành production

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Observability | `observability` | Observability: log, metric, trace | Đặt SLO, đo p99 và lần theo một request qua nhiều service | `numbers`, `system-architecture` | SA · P0 | 1 |
| Deployment | `deployment-safety` | Zero-downtime Deployment | Deploy không downtime: expand/contract, feature flag, rollback | `system-architecture`, `ecs` | SA · P1 | 2 |

#### ∥ Low-Level Design

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Khung trả lời & OOP | `ood-uml-diagrams` | Class & Sequence Diagram | Vẽ class và sequence diagram tối thiểu đủ cho phỏng vấn | `oop-pillars` | Research · P1 | 3 |
| Design Patterns | `ood-state-machine` | State machine trong LLD | Mô hình hoá trạng thái đơn hàng, thang máy và chặn chuyển sai | `patterns-gof` | Research · P1 | 3 |
| Luyện đề LLD | `mc-machine-coding-round` | Vòng machine coding | Ra code chạy được trong 90 phút, chia module và mở rộng khi đổi đề | `lld-problems-list`, `code-testing-fundamentals` | Research · P0 | 2 |

#### ∥ Coding · DSA

| Chặng | Id | Tiêu đề | `goal` | `needs` | Nguồn · ưu tiên | Đợt |
|---|---|---|---|---|---|---|
| Độ phức tạp | `dsa-recursion` | Đệ quy | Phân tích độ phức tạp đệ quy và đổi đệ quy sang vòng lặp | `bigo` | Research · P2 | 4 |
| Cấu trúc dữ liệu | `dsa-arrays-hashing` | Array & Hashing | Giải bài đếm tần suất, two-sum, nhóm theo key trong O(n) | `bigo` | Research · P1 | 3 |
| Cấu trúc dữ liệu | `dsa-linked-list` | Linked List | Đảo, ghép linked list bằng dummy node và con trỏ | `ds` | Research · P1 | 3 |
| Cấu trúc dữ liệu | `dsa-stack-monotonic` | Stack & Monotonic Stack | Giải next greater element và max trong sliding window | `ds` | Research · P1 | 3 |
| Cấu trúc dữ liệu | `dsa-heap-topk` | Heap & Top-K | Giải top-K, K-way merge và median của luồng số | `ds` | Research · P1 | 3 |
| Cấu trúc dữ liệu | `dsa-trees` | Tree & BST | Duyệt cây DFS/BFS, kiểm tra BST và tìm LCA | `dsa-recursion` | Research · P0 | 2 |
| Cấu trúc dữ liệu | `dsa-trie` | Trie | Cài trie cho tìm theo tiền tố và autocomplete | `dsa-trees` | Research · P1 | 3 |
| Cấu trúc dữ liệu | `dsa-design-ds` | Thiết kế cấu trúc dữ liệu | Cài LRU cache O(1), min stack, hit counter | `dsa-linked-list`, `dsa-arrays-hashing` | Research · P0 | 2 |
| Cấu trúc dữ liệu | `dsa-range-trees` | Segment Tree & Fenwick Tree | Nhận ra khi nào range query có update cần segment tree | `dsa-trees` | Research · P2 | 4 |
| Thuật toán | `dsa-two-pointers` | Two Pointers | Giải 3-sum, phát hiện chu trình bằng hai con trỏ | `dsa-arrays-hashing` | Research · P0 | 2 |
| Thuật toán | `dsa-sliding-window` | Sliding Window | Giải bài chuỗi con dài nhất bằng cửa sổ co giãn | `dsa-two-pointers` | Research · P0 | 2 |
| Thuật toán | `dsa-prefix-sum` | Prefix Sum | Trả lời range sum và đếm mảng con có tổng k | `dsa-arrays-hashing` | Research · P2 | 4 |
| Thuật toán | `dsa-sorting` | Sorting | Chọn thuật toán sort và biết sort ổn định nghĩa là gì | `bigo` | Research · P1 | 3 |
| Thuật toán | `dsa-binary-search-answer` | Binary Search trên đáp án | Dùng binary search cả trên không gian đáp án | `dsa-sorting` | Research · P1 | 3 |
| Thuật toán | `dsa-intervals` | Intervals | Gộp khoảng và tính số phòng họp tối thiểu bằng sweep line | `dsa-sorting` | Research · P1 | 3 |
| Thuật toán | `dsa-greedy` | Greedy | Giải bài greedy và chứng minh nhanh vì sao đúng | `dsa-sorting` | Research · P2 | 4 |
| Thuật toán | `dsa-backtracking` | Backtracking | Sinh tập con, hoán vị và cắt nhánh sớm | `dsa-recursion` | Research · P1 | 3 |
| Thuật toán | `dsa-graphs` | Graph | Giải bài grid, topological sort, union-find, Dijkstra | `dsa-trees` | Research · P0 | 2 |
| Thuật toán | `dsa-matrix` | Matrix | Duyệt xoắn ốc, xoay ma trận, flood fill | `dsa-graphs` | Research · P2 | 4 |
| Thuật toán | `dsa-dp` | Dynamic Programming | Nhận ra bài DP và dựng bảng 1D/2D | `dsa-recursion` | Research · P0 | 2 |
| Thuật toán | `dsa-strings` | String | Giải palindrome, anagram và tìm pattern bằng rolling hash | `dsa-sliding-window` | Research · P2 | 4 |
| Thuật toán | `dsa-bit-manipulation` | Bit Manipulation | Dùng XOR, mask để giải bài đếm và tìm phần tử lẻ | `bigo` | Research · P2 | 4 |

## 8. Đợt viết

Quy tắc chia đợt:

- **Đợt 1** (21 topic) gồm ba nhóm:
  - 6 chủ đề P0 của SA.
  - Chặng đầu của mỗi nhánh mới, để nhánh nào cũng học được ngay:
    - Nền tảng CS › Process, thread & bộ nhớ: 5 P0.
    - Kỹ năng viết code › Vòng coding: 2 topic.
    - Behavioral › Câu chuyện của bạn: 3 P0.
    - Container & Kubernetes: `container-basics`, `dockerfile` (chặng Container cơ bản) và `k8s-core` (chặng Kubernetes).
    - Vận hành production › Quan sát: chính là `observability`, đã nằm trong 6 chủ đề P0 của SA.
  - 2 P0 đứng độc lập và hay bị hỏi: `db-isolation-anomalies`, `net-url-to-page`.
- **Đợt 2** (42): các P0 còn lại của Research và các P1 của SA, kể cả `k8s-operations`, `image-delivery`.
- **Đợt 3** (50): các P1 của Research.
- **Đợt 4** (19): các P2 của cả hai nguồn, trong đó có 3 của SA: `storage-engines`, `stream-processing`, `time-ordering`.

Một chặng chỉ được thêm vào `roadmap.js` trong cùng commit với topic đầu tiên của nó (§3.5). Nhờ vậy chặng còn thiếu bài vẫn chạy được.

### 8.1 Đợt 1: Solution Architect viết, Diagram vẽ

| # | Id | Tiêu đề | Chỗ | Người viết | Hình cho agent Diagram |
|---|---|---|---|---|---|
| 1 | `db-isolation-anomalies` | Transaction & isolation level | GĐ1 · Nền móng › Lưu & truy vấn dữ liệu | Solution Architect (nguồn: Research) | mở rộng sim `isolation` thêm lost update, write skew |
| 2 | `replication` | Replication & failover | GĐ2 · Scale dữ liệu › Nhất quán & sao chép | Solution Architect | dùng lại sim `replica-lag`; sim failover split brain (SA) |
| 3 | `resilience` | Timeout, retry & circuit breaker | GĐ3 · Bất đồng bộ & phối hợp › Gọi nhau an toàn khi có lỗi | Solution Architect | sim: retry 3 tầng nhân tải; sim circuit breaker (SA) |
| 4 | `idempotency` | Idempotency | GĐ3 · Bất đồng bộ & phối hợp › Gọi nhau an toàn khi có lỗi | Solution Architect | sim: client timeout → gửi lại, 3 variant (SA) |
| 5 | `outbox-cdc` | Outbox & CDC | GĐ3 · Bất đồng bộ & phối hợp › Quy trình nhiều bước đáng tin | Solution Architect | sim: dual write vs outbox; SVG DB → WAL → CDC → Kafka (SA) |
| 6 | `durable-execution` | Durable Execution | GĐ3 · Bất đồng bộ & phối hợp › Quy trình nhiều bước đáng tin | Solution Architect | sim: worker crash → replay; SVG so sánh 3 cách (SA) |
| 7 | `os-process-lifecycle` | Process: fork, exec, zombie | ∥ Nền tảng CS › Process, thread & bộ nhớ | Solution Architect (nguồn: Research) | SVG trạng thái process (new → ready → running → zombie) |
| 8 | `thr-thread-vs-process` | Thread hay process? | ∥ Nền tảng CS › Process, thread & bộ nhớ | Solution Architect (nguồn: Research) | SVG bộ nhớ chung của thread vs bộ nhớ riêng của process |
| 9 | `os-context-switch` | Context switch | ∥ Nền tảng CS › Process, thread & bộ nhớ | Solution Architect (nguồn: Research) | SVG chi phí: process vs thread vs coroutine |
| 10 | `os-memory-layout` | Stack & heap | ∥ Nền tảng CS › Process, thread & bộ nhớ | Solution Architect (nguồn: Research) | SVG không gian địa chỉ: stack, heap, code |
| 11 | `os-virtual-memory` | Virtual memory & paging | ∥ Nền tảng CS › Process, thread & bộ nhớ | Solution Architect (nguồn: Research) | SVG page table + TLB |
| 12 | `net-url-to-page` | Gõ URL thì chuyện gì xảy ra | ∥ Nền tảng CS › Mạng máy tính | Solution Architect (nguồn: Research) | SVG dòng thời gian DNS → TCP → TLS → HTTP → render |
| 13 | `code-interview-communication` | Kỹ năng vòng coding | ∥ Kỹ năng viết code › Vòng coding | Solution Architect (nguồn: Research) | — |
| 14 | `code-language-choice` | Chọn ngôn ngữ phỏng vấn | ∥ Kỹ năng viết code › Vòng coding | Solution Architect (nguồn: Research) | — |
| 15 | `beh-star-stories` | Khung STAR | ∥ Behavioral › Câu chuyện của bạn | Solution Architect (nguồn: Research) | — |
| 16 | `beh-common-questions` | Câu hỏi behavioral hay gặp | ∥ Behavioral › Câu chuyện của bạn | Solution Architect (nguồn: Research) | — |
| 17 | `beh-project-deep-dive` | Kể sâu về dự án | ∥ Behavioral › Câu chuyện của bạn | Solution Architect (nguồn: Research) | — |
| 18 | `container-basics` | Container là gì? | ∥ Container & Kubernetes › Container cơ bản | Solution Architect | SVG container vs VM, image nhiều layer |
| 19 | `dockerfile` | Dockerfile & build cache | ∥ Container & Kubernetes › Container cơ bản | Solution Architect | code-walk (custom `code` sim) Dockerfile xấu → tốt |
| 20 | `k8s-core` | Kubernetes cốt lõi | ∥ Container & Kubernetes › Kubernetes | Solution Architect | SVG control plane + node; dùng lại sim `eks-flow` cho reconcile |
| 21 | `observability` | Observability: log, metric, trace | ∥ Vận hành production › Quan sát hệ thống | Solution Architect | SVG trace waterfall 4 service (SA) |

Thứ tự viết gợi ý trong đợt 1:

1. `idempotency` và `resilience` trước, vì `outbox-cdc` và `durable-execution` đều dựa vào hai bài này.
2. `replication`.
3. `outbox-cdc`, `durable-execution`.
4. `observability`.
5. `container-basics` → `dockerfile` → `k8s-core`.
6. Các bài còn lại không phụ thuộc nhau, viết song song được.

Cột hình ghi "(SA)" là lấy từ đề xuất của SA. Các ô khác là gợi ý của tôi; agent Diagram chốt.

### 8.2 Đợt 2 (42 topic, theo thứ tự ưu tiên)

1. **System Design** (P1 của SA và P0 về database của Research): `auth`, `id-generation`, `multi-region`, `db-locking`, `consensus`, `vector-search`, `deployment-safety`, `db-query-tuning`.
2. **Container & Kubernetes:** `k8s-operations`, `image-delivery`.
3. **Nền tảng CS (P0):**
   - Thread & I/O: `thr-io-vs-cpu-bound`, `thr-thread-pool`, `thr-gil`, `thr-green-threads`, `io-blocking-models`, `os-signals-shutdown`.
   - Concurrency: `conc-race-condition`, `conc-livelock-starvation`, `conc-atomic-cas`, `conc-memory-model`, `conc-classic-problems`.
   - Async: `async-concurrency-models`, `async-event-loop`, `async-callback-promise-await`, `async-coroutine`, `async-blocking-in-loop`, `async-backpressure`, `async-cancellation-timeout`.
   - Mạng: `net-tcp-deep`, `net-http-versions`, `net-tls`.
4. **Kỹ năng viết code (P0):** `code-clean-naming`, `code-error-handling`, `code-testing-fundamentals`, `code-debugging`.
5. **LLD:** `mc-machine-coding-round`.
6. **DSA (P0):** `dsa-two-pointers`, `dsa-sliding-window`, `dsa-trees`, `dsa-graphs`, `dsa-dp`, `dsa-design-ds`.

Đợt 3 và 4: xem cột "Đợt" ở §7.3.

### 8.3 Ảnh hưởng tới UI

Không cần màn hình mới. Số topic tăng từ 39 lên 171, nên hai mục UI ở §3.4 chuyển từ "nên có" thành **bắt buộc trước đợt 2**:

- **A7:** sidebar gập theo giai đoạn/nhánh. Không gập thì sidebar dài 171 dòng.
- **B1:** hiển thị chặng.

Trang chủ cũng cần gập phần "Nhánh song song" thành các ô (A6, đã có trong wireframe), vì sẽ có 8 nhánh.

Thứ tự triển khai giữ nguyên §5: B0 và B1 (đọc `parts`) phải xong trước khi sửa `roadmap.js`.

### 8.4 Quyết định (dải D20–D29)

D20–D26 là các câu Q1–Q7 người dùng đã duyệt theo mặc định, đã ghi vào `docs/decisions.md`. D27 gộp Q8–Q14 và cây §7.2; D28, D29 là hai câu UI còn mở trong `ux-review.md`.

| # | Quyết định | Câu hỏi |
|---|---|---|
| D20 | Điều hướng chỉ theo `ROADMAP` (giai đoạn → chặng `parts` → topic). `BK.section` giữ làm siêu dữ liệu "nguồn Hello Interview" và bỏ số thứ tự trong tiêu đề. | Q1 |
| D21 | Auth cơ bản nằm trong lộ trình chính (GĐ1 › Giao tiếp & cửa vào); phần vận hành nằm ở nhánh. | Q2 |
| D22 | Tách `patterns` thành 8 topic pattern, nhưng làm sau bước 1–7. | Q3 |
| D23 | Chưa thêm `ip.last` và chưa làm xuất/nhập tiến độ. | Q4 |
| D24 | Bộ lọc trang Luyện bài không đưa vào URL. | Q5 |
| D25 | Thuật ngữ ngành trong tiêu đề giữ tiếng Anh; giải nghĩa và `goal` viết tiếng Việt. | Q6 |
| D26 | Tiến độ GĐ5 tính cả topic lẫn 13 bài luyện. | Q7 |
| D27 | Duyệt Q8–Q14 theo mặc định; áp dụng cây §7.2 cho 39 topic hiện có. | Q8–Q14 |
| D28 | Topbar ≤860px một hàng dính; 5 tab vào drawer ☰, ô tìm ở lại topbar. | ux-review: topbar 375px |
| D29 | "Hết giai đoạn" ở topic bắt buộc cuối; Đào sâu là link phụ. | ux-review: Đào sâu cuối giai đoạn |
