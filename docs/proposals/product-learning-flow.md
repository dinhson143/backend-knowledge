# Đề xuất: kiến trúc thông tin và luồng học tịnh tiến

> Trạng thái: **đề xuất, chưa triển khai** (2026-11-27). Tài liệu này không sửa `content/roadmap.js`, `content/tracks.js`, tiêu đề topic hay code. Phần UI sẽ do agent UI/UX review và triển khai.
>
> Dải số quyết định dành cho đề xuất này: **D20–D29** (ghi vào `docs/decisions.md` khi chốt).

## 0. Tóm tắt

- Hiện site có **hai cách phân loại không khớp nhau**: `tracks.js` (track/section theo mục lục Hello Interview) và `ROADMAP` (giai đoạn học). `app.js` chỉ đọc `ROADMAP`, nên track/section không hiện ở đâu cả.
- Điều hướng có lỗ hổng: nút "tiếp" sau chủ đề cuối của giai đoạn 4 nhảy sang nhánh Kiến trúc thay vì sang luyện bài, "Học tiếp" không bao giờ gợi ý bài luyện, chủ đề không nói "cần học gì trước" hay "học xong làm được gì".
- Đề xuất:
  1. `ROADMAP` là **nguồn duy nhất của cây học**: giai đoạn → **chặng** (section mới, nằm trong `roadmap.js`) → topic. Track chỉ còn là thư mục chứa file.
  2. Lộ trình chính 5 giai đoạn, mỗi giai đoạn kết thúc bằng một **chặng kiểm tra** gồm các bài luyện vừa đủ nền (tính tự động từ `problem.topics`).
  3. Hai trường topic mới, đều tuỳ chọn: `goal` (học xong làm được gì) và `needs` (tiên quyết, chỉ gợi ý, không khoá).
  4. Quy ước tiêu đề nhất quán, kèm bảng tiêu đề mới cho cả 39 topic.
  5. Có quy tắc xếp chỗ cho chủ đề mới (Durable Execution, outbox/CDC, consensus, observability, auth…), không cần sửa code.
  6. UI flow chia hai nhóm: **nhóm A chạy được với dữ liệu hiện có** (agent UI làm ngay, không đụng file nội dung dùng chung), **nhóm B cần trường mới**.

## 1. Hiện trạng

Số liệu lấy từ `node scripts/check.mjs` và registry `BK` ngày 2026-11-27: **39 topic, 13 problem, 35 sim** (check báo 48 vì đếm thêm 13 HLD trong problem), **179 thuật ngữ**.

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

5 track (`sd`, `lld`, `cloud`, `arch`, `dsa`) và 15 section đánh số ("1 · Delivery Framework", "2 · Core Concepts"…). Mỗi topic bắt buộc có `track` + `section` và `check.mjs` kiểm tra chúng khớp nhau, **nhưng `app.js` không đọc `BK.tracks` hay `BK.sections` ở bất kỳ đâu.** Hai cách phân loại lệch nhau, ví dụ:

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

Tập topic của lộ trình chính không đổi (đã kiểm bằng script: cùng 21 id), chỉ đổi thứ tự và cách nhóm.

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

`needs: ["id", …]` liệt kê **tiên quyết trực tiếp** (tối đa 3), không liệt kê bắc cầu. Đã kiểm bằng script: mọi tiên quyết trong lộ trình chính đứng trước topic cần nó, không có vòng.

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
| oop-pillars → solid → principles-other; patterns-gof ← solid; concurrency ← oop-pillars; lld-problems-list ← patterns-gof, concurrency | |
| code-architecture | solid *(xuyên nhánh)* |
| system-architecture | code-architecture, queue *(xuyên nhánh)* |
| dev-methods | code-architecture |
| ecs | lb-gateway-cdn *(xuyên nhánh)* |
| eks → ecs; ecs-vs-eks → eks | |
| ds → bigo; algo → ds | |

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

| Cấp | Dạng | Ví dụ | Không dùng |
|---|---|---|---|
| Giai đoạn | Danh từ chỉ năng lực, ≤ 4 từ. Số thứ tự do UI thêm ("GĐ2 · "), **không ghi trong `title`** | "Scale dữ liệu" | "Building blocks" (không nói làm được gì) |
| `goal` của giai đoạn | Một câu bắt đầu bằng "Học xong bạn …" + động từ | "Học xong bạn biết khi nào một database không đủ và mở rộng bằng cache, shard, replica." | Danh sách công nghệ |
| Chặng | Cụm từ tiếng Việt nói **câu hỏi mà chặng trả lời**, ≤ 6 từ, không đánh số | "Chia dữ liệu ra nhiều máy" | "2 · Core Concepts" |
| Topic `title` | Tên ngắn **≤ 40 ký tự**, hiện ở sidebar/chip. Thuật ngữ ngành giữ tiếng Anh (Caching, Sharding); phần nối và giải nghĩa bằng tiếng Việt | "Consistent Hashing" | Hậu tố "chi tiết", "cốt lõi"; liệt kê > 3 tên; số đếm có thể lỗi thời |
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
| s5 | Luyện bài System Design | **Ghép pattern & luyện đề** | Học xong bạn nhận ra dạng bài, gọi đúng pattern, tự giải từ Khởi động tới Nâng cao trong 45 phút. |
| arch | Kiến trúc phần mềm & phương pháp | **Kiến trúc & phương pháp** | Học xong bạn giải thích được code phụ thuộc theo hướng nào, khi nào tách service và cách TDD/DDD khớp với nhau. |
| cloud | Container trên AWS: ECS & EKS | **Vận hành production** | Học xong bạn chọn được nền chạy container và (khi có nội dung) quan sát, bảo vệ, triển khai hệ thống. |
| lld | Low-Level Design | **Low-Level Design** | Học xong bạn thiết kế lớp cho một bài LLD: entity, nguyên tắc, pattern, xử lý đồng thời. |
| dsa | Coding · DSA | **Coding · DSA** | Học xong bạn nhận dạng pattern thuật toán từ ràng buộc đề bài. |

Id chặng đề xuất: `s1-frame`, `s1-io`, `s1-data`, `s2-cache`, `s2-split`, `s2-consistency`, `s2-tech`, `s3-async`, `s3-contention`, `s4-stores`, `s4-choose`, `s5-patterns`; nhánh: `lld-oop`, `lld-principles`, `lld-patterns`, `lld-concurrency`, `lld-practice`, `arch-code`, `arch-system`, `arch-process`, `cloud-containers`, `dsa-complexity`, `dsa-ds`, `dsa-algo`. Tiêu đề chặng như cây ở §3.1.

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
│ ┌──────────── Tiếp tục ──────────────────────┐ ┌──── Bài đã đủ nền ─────────┐ │
│ │ GĐ2 · Scale dữ liệu › Chia dữ liệu ra …    │ │ URL Shortener  Khởi động → │ │
│ │ Consistent Hashing                         │ │ Rate Limiter   Khởi động → │ │
│ │ Làm được: thêm/bớt node mà chỉ dời ~1/N key│ │ (chưa có bài: hiện "Học    │ │
│ │ Cần trước: ✓ Sharding & Partitioning       │ │  thêm X chủ đề để mở bài   │ │
│ │ [ Học tiếp → ]                             │ │  đầu tiên")                │ │
│ └────────────────────────────────────────────┘ └────────────────────────────┘ │
│ Chủ đề 9/39 ▓▓▓░░░░░   Bài luyện 0/13 ░░░░░░░                                │
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
│ ┌─ Bài đã đủ nền (2) ───┐ │
│ │ URL Shortener       → │ │
│ │ Rate Limiter        → │ │
│ └───────────────────────┘ │
│ Chủ đề 9/39 ▓▓░░░         │
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
│ │ Vừa đủ nền để luyện: URL Shortener · Khởi động               │ │  ← A3
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
| A3 | Tính "đủ nền" cho mỗi bài từ `p.topics` + `done`. Thẻ "Bài đã đủ nền" ở trang chủ; huy hiệu "✓ Đủ nền / Cần k/n" và lọc ở trang Luyện bài; chip "Cần nắm trước" có ✓/○ ở trang bài. | helper mới `readiness(p)`; `viewHome`, `viewProblems`, `viewProblem` (264–271) | `.ready`, `.need-chip.ok` |
| A4 | Khối "Tiếp theo" cuối trang topic, nút một chạm "Đã nắm, sang bài tiếp" (đánh dấu rồi chuyển). Giữ nút đánh dấu riêng. | `viewTopic` (229–236) | `.next-card` |
| A5 | Chặng kiểm tra: bài có topic muộn nhất (theo `ORDER`) thuộc giai đoạn N hiện ở cuối GĐ N trên trang chủ và trong khối "Hết giai đoạn" của topic cuối GĐ. | helper `checkpoint(stage)`; `viewHome`, `viewTopic` | `.rm-check` |
| A6 | Trang chủ: tách "Lộ trình chính" và "Nhánh song song"; chỉ mở sẵn GĐ hiện tại (`<details>`), gập "Cách ôn" và "Nguồn & phạm vi". | `viewHome` (157–188) | `.rm-stage` dạng `details` |
| A7 | Sidebar: mỗi giai đoạn là `<details>`, chỉ mở GĐ chứa topic đang xem; hiện `d/n`. | `sideKnowledge` (119–126) | `.sb-track` summary |
| A8 | Tìm kiếm thêm sim (`title`, `scenario`, `context`) và thuật ngữ (`k`, `full`, `vi`); nhãn loại; xếp hạng tiêu đề trước. | `viewSearch` (361–377) | `.type-badge` |
| A9 | Trang Mô phỏng nhóm sim theo topic **đứng sớm nhất trong `ORDER`** trong `sim.topics`, không theo `topics[0]`. Trang sim thêm "Dùng trong bài" (bài có `p.sims` chứa sim này). | `viewSims` (315), `viewSim` (326–335) | — |

**Nhóm B — cần dữ liệu mới** (làm sau khi bước 3–5 ở §5 xong):

| # | Thay đổi | Hàm | Dữ liệu cần |
|---|---|---|---|
| B1 | Hiển thị chặng: tiêu đề chặng trong sidebar (`.sb-section`), trang chủ, crumb "GĐ › chặng · i/n", nhóm trên trang Mô phỏng, đường dẫn trong kết quả tìm kiếm. **Phải hỗ trợ cả `stage.sections` lẫn `stage.topics` cũ** để có thể merge trước khi `roadmap.js` đổi. | đầu file (dòng 10–16: suy `s.topics` từ `s.sections`), `sideKnowledge`, `viewHome`, `viewTopic`, `viewSims`, `viewSearch` | `ROADMAP[].sections` |
| B2 | Dòng "Làm được: …" dưới H1, trong thẻ "Tiếp tục" và khối "Tiếp theo". Không có `goal` thì ẩn. | `viewTopic`, `viewHome` | `topic.goal` |
| B3 | "Cần trước" (đầu trang topic) và "Bài này mở đường cho" (đảo ngược `needs`, trong khối "Tiếp theo"). | `viewTopic` | `topic.needs` |
| B4 | Chặng `optional: true` có nhãn "Đào sâu", bị "Học tiếp" bỏ qua, vẫn nằm trong pager. | `ORDER`, `viewHome`, `sideKnowledge` | `section.optional` |
| B5 | Dòng `goal` của giai đoạn đổi theo câu "Học xong bạn …". | `viewHome` (đã render `s.goal`, không cần sửa code) | `ROADMAP[].goal` |

Không đổi: router và các URL (`#/t/`, `#/p/`, `#/sim/`, `#/problems`, `#/sims`, `#/glossary`, `#/search/`), key `ip.done`, `ip.theme`, cơ chế nạp file.

### 3.5 Thay đổi dạng dữ liệu và kiểm tra

```js
// content/roadmap.js — giai đoạn có chặng; `topics` cũ vẫn được đọc trong thời gian chuyển
{ id: "s2", title: "Scale dữ liệu", goal: "Học xong bạn …",
  sections: [
    { id: "s2-cache", title: "Đọc nhanh hơn với cache", topics: ["caching", "dist-cache"] },
    { id: "s2-split", title: "Chia dữ liệu ra nhiều máy", topics: ["sharding", "consistent-hashing"] },
    // { id: "s2-deep", title: "Đào sâu", optional: true, topics: [...] }  ← chỉ thêm khi có topic
  ] },

// content/topics/<track>/<id>.js — hai trường tuỳ chọn
goal: "Thêm/bớt node mà chỉ dời khoảng 1/N số key",
needs: ["sharding"],
```

Kiểm tra mới trong `scripts/check.mjs`:

| Kiểm tra | Bắt lỗi gì |
|---|---|
| Id chặng duy nhất; chặng không rỗng; mỗi topic nằm đúng một chặng | Chặng giữ chỗ quên xoá, topic lặp hai nơi |
| Giai đoạn có `sections` thì không có `topics` (và ngược lại) | Hai nguồn thứ tự lệch nhau |
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
| 2 | UI | B1 phần đọc dữ liệu: `app.js` suy `topics` từ `sections` nếu có; `check.mjs` chấp nhận cả hai dạng | `app.js`, `scripts/check.mjs` | 1 |
| 3 | ND | `roadmap.js`: thứ tự mới + `sections` + tiêu đề/goal giai đoạn (một commit, file dùng chung — báo trước các agent khác) | `content/roadmap.js` | 2 |
| 4 | UI | B1 phần hiển thị (sidebar, crumb, trang chủ, sims, search), B5 | `app.js`, `styles.css` | 3 |
| 5 | ND | Đổi `title` 39 topic theo §3.3, mỗi track một commit; bỏ số thứ tự trong tiêu đề section `tracks.js` (nếu Q1 giữ) | `content/topics/**`, `content/tracks.js` | — (độc lập) |
| 6 | ND | Thêm kiểm tra `goal`/`needs` vào `check.mjs` + `_TEMPLATE.js`; điền `goal` và `needs` theo §3.2–3.3, mỗi track một commit | `scripts/check.mjs`, `content/_TEMPLATE.js`, `content/topics/**` | 3 |
| 7 | UI | B2, B3 | `app.js`, `styles.css` | 6 |
| 8 | ND | Chủ đề mới của Solution Architect theo quy tắc xếp chỗ §3.1; chặng mới (3.3, Đào sâu, Quan sát…) tạo **cùng commit** với topic đầu tiên của nó; B4 làm khi chặng `optional` đầu tiên xuất hiện | `content/**`, `app.js` (B4) | 3 |
| 9 | ND | (Tuỳ chọn) Tách `patterns` thành 8 topic pattern, rồi trỏ `problem.topics` sang pattern cụ thể | `content/topics/sd/**`, `content/problems/**`, `roadmap.js` | 6 |
| 10 | ND | Cập nhật `CLAUDE.md`, `content-system.md` §6, README | docs | 3, 6 |

Bước 1 không đụng file nội dung dùng chung nên có thể làm ngay, song song với các agent khác.

## 6. Câu hỏi cần người dùng quyết

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | `BK.section` trong `tracks.js` (mục lục Hello Interview) giữ hay bỏ? Bỏ thì phải sửa trường `section` ở 39 file. | **Giữ** làm siêu dữ liệu "nguồn Hello Interview" (không điều hướng), bỏ số thứ tự trong tiêu đề. Có thể hiện thành nhãn nhỏ trên trang topic sau. |
| Q2 | Auth cơ bản đặt trong lộ trình chính (GĐ1 › Giao tiếp & cửa vào) hay chỉ ở nhánh Vận hành production? | **Lộ trình chính** cho authn/authz cơ bản (hay bị hỏi khi thiết kế API); phần vận hành (mTLS, secrets) ở nhánh. |
| Q3 | Tách `patterns` thành 8 topic (bước 9) có đáng công viết không? | **Có, nhưng sau** bước 1–7; giải cổ chai 9/13 bài và cho Durable Execution một chỗ tự nhiên (`pattern-multi-step`). |
| Q4 | Có cần "tiếp tục đúng trang đã mở lần trước" (thêm key `ip.last`) và xuất/nhập tiến độ không? | **Chưa**; thêm khi có người học dùng nhiều thiết bị. |
| Q5 | Bộ lọc trang Luyện bài có cần nằm trong URL (`#/problems/ready`) để chia sẻ/bookmark không? | **Không**; trạng thái lọc chỉ trong trang. |
| Q6 | Tiêu đề thuật ngữ ngành: giữ tiếng Anh (Caching, Sharding) hay Việt hoá? | **Giữ tiếng Anh** cho thuật ngữ phỏng vấn dùng nguyên văn; phần giải nghĩa và `goal` bằng tiếng Việt. |
| Q7 | GĐ5 có nên tính 13 bài vào tiến độ giai đoạn (hiện "0/14" = 1 topic + 13 bài) không? | **Có**, như cách GĐ5 cũ đang đếm. |
