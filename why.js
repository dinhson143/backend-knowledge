/*
 * Giải thích "vì sao" cho từng ý, từng dòng bảng và từng câu deep dive.
 * Gắn theo index của nội dung trong data.js / problems.js; app.js tự ghép khi render.
 */
window.WHY = {
 "kafka": {
  "story": {
   "problem": "Nhiều service cần cùng một luồng event (order, click) thì gọi trực tiếp từng service tạo coupling chặt. Queue truyền thống xoá message sau khi đọc → consumer thứ hai, hay consumer cần đọc lại sau bug, không còn gì để đọc. Database thì không chịu nổi hàng trăm nghìn insert/s chỉ để làm hàng đợi.",
   "idea": "Ghi mọi event vào một **log append-only** trên đĩa, chia thành nhiều partition trên nhiều broker; broker không theo dõi ai đã đọc gì, mỗi consumer tự giữ **offset** của mình. Thêm consumer hay replay chỉ là đọc từ một offset khác, vì log không bị xoá khi đọc.",
   "tradeoff": "Thứ tự chỉ có trong partition, số partition khó đổi về sau, và consumer phải tự lo DLQ, retry, idempotency. Vận hành cluster (broker, replica, rebalance, lag) nặng hơn hẳn SQS hay RabbitMQ."
  },
  "tldr": "Dữ liệu ở lại đủ lâu để đọc lại và mỗi consumer group đọc độc lập, vì producer chỉ **append** vào cuối file, consumer chỉ giữ một con số offset → broker không phải xoá hay đánh dấu từng message. Thứ tự chỉ định nghĩa được **bên trong** một partition, vì mỗi partition là một log riêng có offset tăng dần; hai partition trên hai broker khác nhau không có đồng hồ chung nào để so thứ tự.",
  "sections": [
   {
    "s": 0,
    "title": "Mô hình tư duy",
    "table": [
     {
      "row": 0,
      "key": "Broker",
      "why": "Rải đều leader của các partition trên nhiều broker giúp chia tải, vì mọi ghi và đọc của một partition đều đi qua leader. Dồn leader vào một broker thì broker đó thành nút cổ chai dù cluster có 10 node."
     },
     {
      "row": 1,
      "key": "Topic",
      "why": "Topic đóng vai trò như tên bảng: chỉ là tên logic gom các partition cùng loại event. Consumer subscribe theo topic, còn dữ liệu thật nằm trong các partition bên dưới."
     },
     {
      "row": 2,
      "key": "Partition",
      "why": "Topic có 12 partition thì tối đa 12 consumer cùng làm việc, vì mỗi partition chỉ giao cho đúng một consumer trong group (để giữ thứ tự). Consumer thứ 13 không có partition nào để nhận."
     },
     {
      "row": 3,
      "key": "Offset",
      "why": "Broker không ghi nhận \"message này đã xử lý\"; consumer chỉ commit một con số offset. Muốn đọc lại thì lùi offset (`--reset-offsets --to-datetime`) — message vẫn còn đó cho đến khi hết retention."
     },
     {
      "row": 4,
      "key": "Producer",
      "why": "Cùng key luôn rơi vào cùng partition → giữ được thứ tự theo key, vì partitioner tính hash của key (murmur2) rồi chia lấy dư cho số partition. Hệ quả: đổi N là đổi kết quả phép chia, key cũ chạy sang partition khác."
     },
     {
      "row": 5,
      "key": "Consumer group",
      "why": "Kafka gán partition độc quyền cho một consumer trong group, vì hai consumer cùng group đọc chung một partition sẽ giành nhau message và phá thứ tự. Group khác có offset riêng → analytics và notification đọc cùng topic mà không ảnh hưởng nhau."
     },
     {
      "row": 6,
      "key": "Replica / ISR",
      "why": "ISR là tập replica chắc chắn có dữ liệu mới nhất, vì follower nào tụt quá `replica.lag.time.max.ms` bị loại khỏi ISR. `acks=all` chờ cả ISR ghi xong → leader chết thì replica được bầu lên (lấy từ ISR) vẫn có message đã ack."
     },
     {
      "row": 7,
      "key": "Controller (KRaft)",
      "why": "KRaft cho failover controller nhanh hơn và cluster chịu được hàng triệu partition, vì nó đưa metadata vào một log Raft nội bộ của Kafka. ZooKeeper là hệ thống riêng phải vận hành song song và giới hạn số partition (metadata load chậm khi failover); Kafka 4.0 đã bỏ hẳn ZooKeeper."
     }
    ]
   },
   {
    "s": 1,
    "title": "Đường ghi: producer → broker",
    "points": [
     {
      "i": 0,
      "key": "**Chọn partition** — có key thì `hash(ke",
      "why": "Key quyết định những message nào xếp hàng chung, vì thứ tự chỉ có trong partition: key là `orderId` thì các event của một order luôn đúng thứ tự. Không có key, producer dùng sticky partitioner (lấp đầy một batch cho một partition rồi đổi) để batch to hơn thay vì rải từng message."
     },
     {
      "i": 1,
      "key": "**Batch + nén** — producer gom message t",
      "why": "Gửi 500 message trong một batch rẻ hơn nhiều so với 500 request, vì mỗi request mạng có chi phí cố định (header, round-trip, fsync/page cache). Chờ thêm vài ms (`linger.ms`) để batch đầy hơn; nén cả batch cho tỉ lệ nén cao vì các message JSON giống nhau."
     },
     {
      "i": 2,
      "key": "**Leader ghi, follower kéo** — leader ap",
      "why": "Đĩa ghi tuần tự và OS gom ghi qua page cache thay vì fsync từng message, vì leader chỉ append vào cuối file. Kafka mặc định không fsync mỗi message; độ bền dựa vào **replication**: follower kéo dữ liệu về → một máy mất điện không làm mất dữ liệu đã có trên replica khác."
     },
     {
      "i": 3,
      "key": "**Idempotent producer** (`enable.idempot",
      "why": "Batch retry có sequence đã thấy bị bỏ qua thay vì ghi lần hai, vì producer gửi kèm producer ID và sequence number cho từng batch, còn broker nhớ sequence cuối của mỗi producer/partition. Chỉ chống trùng trong một partition và một phiên producer; restart producer mà không có `transactional.id` thì nhận ID mới."
     }
    ],
    "table": [
     {
      "row": 0,
      "key": "0",
      "why": "Broker lỗi, mạng rớt hay leader đổi đều làm mất message mà producer không biết để retry, vì producer gửi xong là coi như thành công, không chờ phản hồi. Đổi lại latency thấp nhất — hợp metrics, mất vài điểm không sao."
     },
     {
      "row": 1,
      "key": "1",
      "why": "Message đã ack vẫn có thể biến mất, vì leader ack ngay khi ghi vào log của mình, trước khi follower kịp fetch. Leader chết đúng lúc đó thì follower được bầu lên không có message, và leader cũ quay lại bị truncate theo leader mới."
     },
     {
      "row": 2,
      "key": "all + min.insync.replicas=2",
      "why": "Một broker chết vẫn còn bản sao có message, vì ack chỉ trả về khi mọi replica trong ISR đã ghi, và ISR phải có ít nhất 2 replica. RF=3 + min ISR=2 cho phép mất 1 broker mà vẫn ghi được; mất 2 thì ISR còn 1 < 2 → broker từ chối ghi (`NotEnoughReplicas`) để không ack thứ chỉ nằm trên một máy."
     }
    ]
   },
   {
    "s": 2,
    "title": "Đường đọc: consumer group",
    "points": [
     {
      "i": 0,
      "key": "**Poll theo batch** — consumer kéo messa",
      "why": "Consumer tự điều tốc theo sức xử lý thay vì bị broker đẩy ngập, vì nó là bên kéo (pull). Offset do consumer commit → thời điểm commit (trước hay sau khi xử lý) quyết định delivery semantics."
     },
     {
      "i": 1,
      "key": "**Phân partition** — mỗi partition gán c",
      "why": "Số consumer làm việc thực tế bị chặn trên bởi số partition, vì Kafka giữ thứ tự bằng cách cho mỗi partition đúng một người đọc trong group. Muốn scale consumer thì phải có đủ partition từ đầu."
     },
     {
      "i": 2,
      "key": "**Rebalance** — khi consumer vào, ra hoặ",
      "why": "Eager rebalance là stop-the-world: mọi consumer nhả hết partition rồi mới nhận lại, vì group coordinator phải đảm bảo không partition nào có hai chủ cùng lúc. Cooperative rebalance chỉ thu hồi các partition thực sự phải chuyển → consumer khác vẫn làm việc trong lúc chia lại."
     },
     {
      "i": 3,
      "key": "**Consumer lag** = offset cuối − offset ",
      "why": "Lag cho biết consumer có theo kịp producer không — điều CPU hay số request không cho biết — vì nó đo trực tiếp số message đang chờ. Lag tăng đều = consumer chậm hơn tốc độ ghi → cần thêm consumer hoặc tối ưu xử lý."
     },
     {
      "i": 4,
      "key": "**Nhiều group cùng đọc một topic** — fan",
      "why": "Thêm một group mới chỉ là thêm một người đọc file, broker không phải nhân bản message, vì message không bị xoá khi đọc và mỗi group có offset riêng. Chi phí chủ yếu là băng thông đọc, thường phục vụ từ page cache."
     }
    ]
   },
   {
    "s": 3,
    "title": "Delivery semantics",
    "table": [
     {
      "row": 0,
      "key": "At-most-once",
      "why": "Message không bao giờ được xử lý nếu consumer crash giữa chừng, vì offset đã commit trước khi xử lý → khởi động lại nó đọc tiếp từ sau message đó."
     },
     {
      "row": 1,
      "key": "At-least-once (phổ biến nhất)",
      "why": "Không mất message nhưng có trùng: commit sau khi xử lý xong, nên crash giữa \"xử lý xong\" và \"commit\" làm consumer mới đọc lại từ offset cũ và xử lý lần hai. Vì vậy consumer phải idempotent (upsert, dedupe theo event ID)."
     },
     {
      "row": 2,
      "key": "Exactly-once",
      "why": "Output và offset hoặc cùng thành công, hoặc cùng bị huỷ, vì transaction ghi output và commit offset trong **cùng một transaction** Kafka; consumer `read_committed` không thấy output dở dang. Nhưng gửi email hay ghi Postgres nằm ngoài transaction đó → vẫn có thể lặp, cần idempotency key ở đích."
     }
    ]
   },
   {
    "s": 4,
    "title": "Lưu trữ: retention & compaction",
    "points": [
     {
      "i": 0,
      "key": "**Retention** theo thời gian hoặc dung l",
      "why": "Trong 7 ngày retention ai cũng replay được, vì dữ liệu chỉ bị dọn khi segment cũ hơn `retention.ms` hoặc topic vượt `retention.bytes`. Consumer chỉ giữ offset, broker không biết ai đã đọc → không có sự kiện \"đã đọc\" nào để xoá theo."
     },
     {
      "i": 1,
      "key": "**Log compaction** — chỉ giữ bản mới nhấ",
      "why": "Dung lượng tỉ lệ với số key chứ không với số lần cập nhật, vì cleaner thread đọc các segment cũ, giữ bản ghi mới nhất cho mỗi key và bỏ các bản cũ hơn (value null = tombstone xoá key). Consumer mới đọc từ đầu topic là dựng lại được trạng thái hiện tại."
     },
     {
      "i": 2,
      "key": "**Segment** — log chia thành file segmen",
      "why": "Kafka cắt log thành các file segment (mặc định 1GB) và xoá nguyên file segment cũ, vì xoá từng message giữa một file lớn rất tốn. Segment active (đang ghi) không bị xoá hay compact → retention thực tế có thể dài hơn cấu hình một chút."
     }
    ]
   },
   {
    "s": 5,
    "title": "Vì sao Kafka nhanh",
    "points": [
     {
      "i": 0,
      "key": "**Ghi và đọc tuần tự** trên đĩa, tận dụn",
      "why": "Đĩa (cả HDD) ghi/đọc tuần tự nhanh hơn random nhiều bậc, vì không phải seek và OS tự prefetch. Consumer đọc gần cuối log thường lấy thẳng từ page cache trong RAM, không chạm đĩa."
     },
     {
      "i": 1,
      "key": "**Zero-copy** (`sendfile`) đẩy dữ liệu t",
      "why": "`sendfile` bỏ hai lần copy và context switch: thay vì đường thông thường đĩa → kernel → user space → kernel socket buffer, kernel đẩy thẳng từ page cache ra NIC. Làm được vì broker lưu message đúng định dạng gửi qua mạng, không cần sửa (trừ khi bật TLS)."
     },
     {
      "i": 2,
      "key": "**Batching + compression** ở cả producer",
      "why": "Broker không tốn CPU nén lại, vì nó lưu batch nén nguyên khối và gửi nguyên khối cho consumer — chỉ producer nén, consumer giải nén. Ít request hơn, ít byte hơn trên mạng lẫn đĩa."
     },
     {
      "i": 3,
      "key": "**Partition** cho phép nhiều broker và c",
      "why": "100 partition rải trên 10 broker là 100 luồng ghi/đọc song song, vì mỗi partition là một log độc lập có leader riêng. Throughput của topic tăng gần tuyến tính theo số partition cho đến khi hết tài nguyên broker."
     }
    ]
   },
   {
    "s": 6,
    "title": "Câu hỏi hay bị hỏi sâu",
    "points": [
     {
      "i": 0,
      "key": "**Hot partition** — key lệch (celebrity,",
      "why": "Một key cực hot đẩy hết traffic lên một partition và một consumer, vì cùng key luôn vào cùng partition. Thêm hậu tố ngẫu nhiên `#0..N` tách key đó ra N partition, nhưng event của nó giờ nằm ở N log khác nhau → mất thứ tự chung, phải gộp lại ở consumer."
     },
     {
      "i": 1,
      "key": "**Chọn số partition** — throughput mục t",
      "why": "Cần đủ partition để số consumer × throughput mỗi consumer ≥ mục tiêu (ví dụ 100MB/s ÷ 10MB/s = 10, thường làm tròn lên dư), vì mỗi partition chỉ một consumer trong group đọc. Giảm partition thì phải gộp log và offset — Kafka không hỗ trợ; tăng thì `hash % N` đổi, key cũ đi sang partition mới."
     },
     {
      "i": 2,
      "key": "**Message lớn** — Kafka hợp message nhỏ ",
      "why": "Đẩy file lên S3 rồi gửi URL (claim-check pattern) giữ message nhỏ và rẻ. Lý do: broker mặc định giới hạn ~1MB/message (`message.max.bytes`), và message lớn làm hỏng lợi thế batch, chiếm page cache, làm chậm replication."
     },
     {
      "i": 3,
      "key": "**Poison message** — consumer Kafka khôn",
      "why": "Một message lỗi mãi mà cứ retry tại chỗ sẽ chặn cả partition phía sau, vì consumer xử lý tuần tự theo offset. Kafka không có ack/nack từng message như SQS → phải tự đẩy message lỗi sang retry topic (có delay) rồi DLQ topic, và commit offset để đi tiếp."
     },
     {
      "i": 4,
      "key": "**Consumer chậm** — thêm partition + con",
      "why": "Đã đủ consumer thì phải thêm partition mới scale được, vì số consumer bị giới hạn bởi số partition. Nếu nút cổ chai là xử lý nặng (gọi API, render), tách sang worker pool cho phép song song hơn số partition, đổi lại phải tự quản thứ tự và commit offset."
     }
    ]
   },
   {
    "s": 7,
    "title": "Kafka hay lựa chọn khác?",
    "table": [
     {
      "row": 0,
      "key": "Mô hình",
      "why": "Kafka giữ message đến hết retention bất kể ai đọc; SQS xoá message khi consumer gọi `DeleteMessage`; RabbitMQ đẩy message qua exchange tới queue theo routing rule rồi xoá khi ack; Redis Streams cũng là log nhưng nằm trong RAM nên giữ được ít dữ liệu hơn."
     },
     {
      "row": 1,
      "key": "Thứ tự",
      "why": "Mỗi hệ thống chỉ giữ thứ tự trong đơn vị một người đọc tuần tự: partition, queue hay stream. SQS FIFO bị giới hạn throughput hơn standard queue (standard không đảm bảo thứ tự), vì nó đạt thứ tự bằng cách khoá theo message group và dedupe."
     },
     {
      "row": 2,
      "key": "Replay",
      "why": "Replay cần message còn tồn tại sau khi đã đọc: Kafka giữ theo retention trên đĩa, Redis Streams giữ đến khi `XTRIM`/`MAXLEN` nên bị chặn bởi RAM. SQS và RabbitMQ xoá khi ack → đọc xong là hết."
     },
     {
      "row": 3,
      "key": "Chọn khi",
      "why": "Kafka đáng chi phí vận hành khi cần nhiều consumer đọc cùng event và replay; SQS là managed, có sẵn visibility timeout và DLQ nên hợp job queue; RabbitMQ có exchange (topic, headers, fanout) nên định tuyến linh hoạt; Redis Streams tận dụng Redis có sẵn khi dữ liệu nhỏ, sống ngắn."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Luôn nói rõ **partition key** là gì và v",
    "why": "Key quyết định cả thứ tự lẫn phân tải: chọn `orderId` thì event của một order đúng thứ tự và tải rải đều; chọn `country` thì một partition gánh cả nước lớn. Interviewer muốn thấy bạn biết đánh đổi đó."
   },
   {
    "i": 1,
    "key": "Khi vẽ Kafka, nói luôn cấu hình bền: `ac",
    "why": "Mặc định an toàn chưa đủ: thiếu `min.insync.replicas` thì `acks=all` vẫn ack khi ISR chỉ còn leader. Nêu đủ bộ RF=3, acks=all, consumer idempotent, giám sát lag → cho thấy bạn hiểu mất dữ liệu đến từ đâu ở cả hai đầu."
   },
   {
    "i": 2,
    "key": "Chỉ cần job queue đơn giản thì SQS đủ và",
    "why": "Chọn Kafka cho job queue là trả chi phí vận hành cho tính năng (replay, fan-out) không dùng tới. Job queue chỉ cần \"mỗi job một worker xử lý, lỗi thì retry\", và SQS có sẵn visibility timeout, DLQ, autoscale theo số message mà không phải quản broker hay partition."
   }
  ]
 },
 "redis": {
  "story": {
   "problem": "Truy cập lặp lại (profile, session, đếm view, top 10) làm DB quá tải, vì database trên đĩa trả lời mất vài ms đến vài chục ms và chỉ chịu được vài nghìn đến vài chục nghìn query/s. Mỗi app server tự cache trong RAM riêng thì các server không chia sẻ được counter, lock hay rate limit.",
   "idea": "Một server dùng chung giữ dữ liệu trong RAM, cung cấp sẵn cấu trúc dữ liệu (hash, sorted set, HyperLogLog…) và chạy lệnh tuần tự trên một thread → mỗi thao tác vừa nhanh dưới 1ms vừa atomic, client không phải tự lock.",
   "tradeoff": "RAM đắt và có giới hạn; persistence và replication đều bất đồng bộ nên có thể mất dữ liệu khi crash hay failover. Một thread → một lệnh chậm chặn tất cả client."
  },
  "tldr": "Mỗi lệnh tự nhiên là atomic, vì chỉ một thread thực thi lệnh → hai lệnh không bao giờ xen nhau, `INCR` không thể bị race giữa đọc và ghi. Mỗi lệnh chỉ tốn micro giây, latency chủ yếu là round-trip mạng, vì dữ liệu nằm trong RAM và không có lock. Failover có thể làm mất write vừa ack, vì primary ack client ngay rồi mới gửi lệnh sang replica (replication bất đồng bộ).",
  "sections": [
   {
    "s": 0,
    "title": "Cấu trúc dữ liệu → bài toán",
    "table": [
     {
      "row": 0,
      "key": "String",
      "why": "String là kiểu đơn giản nhất nhưng có lệnh atomic như `INCR` và `SET NX` → cùng một kiểu dùng được cho cache, counter (không race) và lock/idempotency (chỉ một client tạo được key)."
     },
     {
      "row": 1,
      "key": "Hash",
      "why": "`HSET user:1 name X` sửa một field mà không phải đọc–sửa–ghi cả object JSON, vì hash lưu nhiều field dưới một key → tránh race khi hai request sửa hai field khác nhau. Hash nhỏ được mã hoá listpack nên tốn ít RAM hơn nhiều key rời."
     },
     {
      "row": 2,
      "key": "List",
      "why": "List hợp làm queue, vì nó là danh sách liên kết (quicklist), push/pop ở hai đầu là O(1); `BRPOP` chặn chờ đến khi có phần tử nên worker không phải polling. `LPUSH` + `LTRIM 0 99` giữ đúng N phần tử mới nhất cho feed."
     },
     {
      "row": 3,
      "key": "Set",
      "why": "`SADD` tự loại trùng và `SISMEMBER` là O(1), vì set dựa trên hash table. `SINTER` tính giao trên server → \"bạn chung\" không phải tải hai danh sách về app."
     },
     {
      "row": 4,
      "key": "Sorted Set",
      "why": "Cập nhật score là O(log N), lấy top K hay khoảng score là O(log N + K), vì sorted set kết hợp skiplist (sắp theo score) và hash table (tra member). Score là timestamp thì cùng cấu trúc đó thành sliding window hay hàng đợi theo thời gian."
     },
     {
      "row": 5,
      "key": "Bitmap / HyperLogLog",
      "why": "100 triệu user chỉ tốn ~12MB cho một ngày, vì bitmap dùng 1 bit cho mỗi user ID. HyperLogLog ước lượng số phần tử khác nhau bằng xác suất trong tối đa 12KB với sai số ~0.81% → đếm unique visitor không cần lưu từng ID."
     },
     {
      "row": 6,
      "key": "Geo",
      "why": "`GEOSEARCH` chỉ quét vài khoảng score thay vì tính khoảng cách với mọi điểm, vì Geo mã hoá kinh độ/vĩ độ thành geohash 52 bit làm score của một sorted set → điểm gần nhau có score gần nhau."
     },
     {
      "row": 7,
      "key": "Stream",
      "why": "Stream giống Kafka thu nhỏ: log append-only có ID tăng dần, có consumer group và pending list (message đã giao chưa `XACK`) → đọc lại được, biết message nào chưa xử lý để giao lại."
     },
     {
      "row": 8,
      "key": "Pub/Sub",
      "why": "Subscriber đang mất kết nối sẽ không bao giờ nhận được message, vì Pub/Sub chỉ chuyển tiếp tới các connection đang subscribe tại thời điểm `PUBLISH`, không ghi vào đâu cả."
     }
    ]
   },
   {
    "s": 1,
    "title": "Vì sao nhanh và atomic",
    "points": [
     {
      "i": 0,
      "key": "**In-memory** — đọc ghi RAM, không chạm ",
      "why": "Lệnh Redis xử lý trong micro giây, latency client thấy chủ yếu là mạng, vì truy cập RAM mất ~100ns còn SSD ~100µs. Persistence (RDB/AOF) chạy nền hoặc ghi vào buffer, không nằm trên đường trả lời."
     },
     {
      "i": 1,
      "key": "**Một thread thực thi lệnh** (I/O thread",
      "why": "Không bao giờ có hai lệnh chạy xen nhau, không cần mutex, không tốn context switch, vì chỉ main thread đọc và sửa dữ liệu. I/O threads chỉ phân tích request và ghi response ra socket — phần tốn CPU khi có nhiều connection — nên vẫn giữ được tính atomic."
     },
     {
      "i": 2,
      "key": "**Nhiều bước atomic** — `MULTI/EXEC` gom",
      "why": "`MULTI/EXEC` chạy các lệnh đã xếp hàng liền một mạch, không lệnh client khác chen vào; nhưng lệnh chỉ chạy lúc `EXEC` nên không dùng được kết quả lệnh trước để quyết định lệnh sau, và lệnh lỗi giữa chừng không hoàn tác lệnh đã chạy. Muốn \"đọc–so sánh–ghi\" atomic thì dùng Lua script (hoặc Redis Functions từ 7.0): chạy logic có điều kiện ngay trên server, cũng không bị chen ngang."
     },
     {
      "i": 3,
      "key": "**Pipelining** — gửi nhiều lệnh một lần ",
      "why": "100 lệnh gửi lần lượt tốn ~100 RTT, vì lệnh Redis chỉ tốn micro giây còn round-trip mạng ~0.2–1ms. Pipelining gửi cả 100 lệnh rồi đọc 100 response, chỉ tốn ~1 RTT; nhưng không atomic — lệnh client khác vẫn xen vào được."
     },
     {
      "i": 4,
      "key": "**Hệ quả** — một lệnh chậm chặn mọi clie",
      "why": "Trong lúc `KEYS *` duyệt 10 triệu key (vài giây), mọi client khác phải chờ, vì chỉ có một thread. `SCAN` duyệt từng mẻ nhỏ có cursor, `UNLINK` gỡ key khỏi keyspace ngay rồi giải phóng bộ nhớ ở thread nền → main thread không bị chặn lâu."
     }
    ]
   },
   {
    "s": 2,
    "title": "Pattern hay dùng trong phỏng vấn",
    "table": [
     {
      "row": 0,
      "key": "Cache-aside",
      "why": "Dữ liệu sai lệch tự hết hạn sau tối đa 300s, vì chỉ đọc DB khi miss và cache có TTL. Jitter (TTL ngẫu nhiên ±10%) tránh nhiều key cùng hết hạn một lúc gây stampede; khi ghi DB thì xoá thay vì set, để tránh race hai lần ghi đặt giá trị cũ vào cache."
     },
     {
      "row": 1,
      "key": "Distributed lock",
      "why": "`NX` chỉ cho một client tạo key, `PX` tự giải phóng nếu chủ lock chết; token ngẫu nhiên + Lua so token rồi mới `DEL` → không xoá nhầm lock của người khác sau khi lock mình đã hết hạn. Nhưng client GC pause quá 30s, hoặc primary failover trước khi replica nhận key, thì hai client cùng nghĩ mình giữ lock → tài nguyên phía sau phải kiểm tra **fencing token** tăng dần để từ chối client cũ."
     },
     {
      "row": 2,
      "key": "Rate limiter",
      "why": "Giới hạn đúng cho toàn hệ thống thay vì mỗi instance một bộ đếm, vì mọi gateway đều đếm trên cùng một key Redis. Token bucket phải gói trong Lua để chạy atomic: nó cần đọc số token, tính lượng nạp theo thời gian rồi trừ — làm ở client thì hai gateway đọc cùng lúc sẽ cùng thấy còn token."
     },
     {
      "row": 3,
      "key": "Leaderboard",
      "why": "`ZINCRBY` chỉ chèn lại một node O(log N) và top 10 là đọc 10 node đầu, vì sorted set giữ member sắp theo score bằng skiplist. So với `ORDER BY score LIMIT 10` trên DB cập nhật liên tục, Redis không phải sort lại mỗi lần đọc."
     },
     {
      "row": 4,
      "key": "Session store",
      "why": "Rủi ro mất dữ liệu của Redis thường chấp nhận được với session, vì mất session chỉ buộc user đăng nhập lại, không mất dữ liệu nghiệp vụ. Hash cho phép sửa từng field của session, `EXPIRE` tự dọn session bỏ dở."
     },
     {
      "row": 5,
      "key": "Pub/Sub fan-out",
      "why": "Server nhận event publish vào kênh `user:{id}`, và server đang giữ kết nối của user đó sẽ nhận — vì mỗi server chỉ giữ WebSocket của một phần user. Pub/Sub không lưu gì → user offline mất message; ghi inbox vào DB trước rồi mới publish để user lấy lại khi kết nối."
     },
     {
      "row": 6,
      "key": "Idempotency key",
      "why": "Request lặp (client retry) đọc kết quả cũ thay vì trừ tiền lần hai, vì `NX` đảm bảo chỉ request đầu tiên tạo được key, request sau thấy key đã tồn tại. TTL 24h giới hạn bộ nhớ, đủ dài để bao các lần retry thực tế."
     }
    ]
   },
   {
    "s": 3,
    "title": "TTL & eviction",
    "points": [
     {
      "i": 0,
      "key": "**TTL** — `EXPIRE key 60`. Redis xoá key",
      "why": "Redis xoá key hết hạn khi có ai truy cập (lazy) và định kỳ lấy mẫu ngẫu nhiên một ít key có TTL để xoá (active, ~10 lần/s), vì quét mọi key sẽ chặn thread chính. Key hết hạn mà không ai đụng và không bị lấy mẫu trúng vẫn chiếm RAM một thời gian."
     }
    ],
    "table": [
     {
      "row": 0,
      "key": "noeviction",
      "why": "Không key nào biến mất ngầm, vì Redis từ chối lệnh ghi (`OOM`) thay vì tự xoá. Hợp khi Redis là nơi lưu chính: lỗi ghi lộ ra ngay, còn mất key thì im lặng."
     },
     {
      "row": 1,
      "key": "allkeys-lru",
      "why": "Đuổi key lâu không dùng giữ lại phần nóng nhất của cache, vì key đó ít khả năng được dùng lại. Redis dùng LRU xấp xỉ: lấy mẫu vài key (`maxmemory-samples` mặc định 5) rồi đuổi key cũ nhất trong mẫu, tránh chi phí giữ danh sách LRU đầy đủ."
     },
     {
      "row": 2,
      "key": "allkeys-lfu",
      "why": "Key hot lâu dài không bị đẩy ra chỉ vì một lần quét lượng lớn key mới, vì LFU đếm tần suất truy cập (counter log, giảm dần theo thời gian). Với LRU, một đợt quét đọc nhiều key một lần cũng đủ đẩy key hot ra."
     },
     {
      "row": 3,
      "key": "volatile-lru / volatile-ttl",
      "why": "Dữ liệu không TTL (config, dữ liệu cần giữ) an toàn còn key cache bị hy sinh, vì chỉ key có TTL mới bị đuổi. Hết key có TTL để đuổi thì Redis xử sự như `noeviction` và báo lỗi khi ghi."
     }
    ]
   },
   {
    "s": 4,
    "title": "Persistence",
    "table": [
     {
      "row": 0,
      "key": "RDB",
      "why": "Process chính không bị chặn, vì Redis `fork()` một process con ghi toàn bộ dữ liệu ra file nhờ copy-on-write. File là dump nhị phân gọn nên load lại nhanh, nhưng mọi write sau snapshot cuối (có thể vài phút) mất khi crash; fork trên dataset lớn cũng tốn thêm RAM khi có nhiều ghi."
     },
     {
      "row": 1,
      "key": "AOF",
      "why": "Crash chỉ mất phần chưa fsync, khoảng 1s (tệ nhất ~2s nếu đĩa chậm), vì mỗi lệnh ghi được append vào file và `fsync` mỗi giây. File chứa mọi lệnh nên phình to (100 lần `INCR` = 100 dòng), cần rewrite định kỳ thành tập lệnh tối thiểu."
     },
     {
      "row": 2,
      "key": "RDB + AOF",
      "why": "AOF cho độ mất dữ liệu nhỏ, RDB cho backup gọn và khởi động nhanh. Từ Redis 7, AOF rewrite tạo base file dạng RDB cộng các file incremental → restart vừa nhanh vừa mất ít dữ liệu."
     },
     {
      "row": 3,
      "key": "Không bật",
      "why": "Không tốn I/O hay fork vì không ghi gì ra đĩa, nhưng restart là RAM trống. Lúc đó toàn bộ traffic miss và đổ vào DB → cần warm-up hoặc chấp nhận DB chịu tải đột biến."
     }
    ]
   },
   {
    "s": 5,
    "title": "High availability & scale",
    "points": [
     {
      "i": 0,
      "key": "**Replication** — primary → replica **bấ",
      "why": "Đọc từ replica ngay sau ghi có thể thấy giá trị cũ, vì primary trả OK cho client trước rồi mới gửi lệnh qua replication stream → có độ trễ (thường vài ms, lúc tải cao lâu hơn) khi replica chưa có write mới."
     },
     {
      "i": 1,
      "key": "**Sentinel** — giám sát và tự failover c",
      "why": "Nhiều process Sentinel cùng ping primary; khi đủ quorum đồng ý primary chết, chúng bầu một Sentinel để promote một replica và báo client địa chỉ mới. Sentinel chỉ lo failover, không chia dữ liệu → toàn bộ dataset vẫn phải vừa một máy."
     },
     {
      "i": 2,
      "key": "**Redis Cluster** — 16,384 hash slot, `s",
      "why": "Thêm node chỉ cần chuyển một số slot, không phải tính lại vị trí mọi key, vì Cluster chia theo slot cố định thay vì hash trực tiếp ra node. Client giữ bảng slot → node; gửi nhầm node thì nhận `MOVED` kèm địa chỉ đúng và cập nhật bảng."
     },
     {
      "i": 3,
      "key": "**Hash tag** — trong Cluster, lệnh nhiều",
      "why": "`MGET` hay Lua trên nhiều key không thể atomic trong Cluster, vì các key khác slot có thể nằm trên hai node khác nhau. Hash tag chỉ băm phần trong `{}` → `{user42}:cart` và `{user42}:profile` chắc chắn cùng slot, cùng node."
     },
     {
      "i": 4,
      "key": "**Failover có thể mất write đã ack** — v",
      "why": "Write đã ack có thể mất vĩnh viễn: primary ack nhưng chết trước khi kịp gửi sang replica, và replica được promote không có write đó. Lệnh `WAIT` giảm rủi ro nhưng không biến Redis thành hệ thống strong consistency."
     }
    ]
   },
   {
    "s": 6,
    "title": "Câu hỏi hay bị hỏi sâu",
    "points": [
     {
      "i": 0,
      "key": "**Hot key** — một key nhận quá nhiều tra",
      "why": "Thêm node không giúp gì cho hot key, vì một key chỉ nằm trên một slot, một node. Nhân thành `key#1..N` rải đọc ra N slot, còn local cache ở app (vài giây) chặn phần lớn request trước khi tới Redis."
     },
     {
      "i": 1,
      "key": "**Big key** — hash/list hàng triệu phần ",
      "why": "Lệnh trên big key (`HGETALL`, `DEL`, migrate slot) chặn main thread hàng trăm ms, vì chi phí tỉ lệ với số phần tử. Chia `followers:{id}:{bucket}` giữ mỗi key nhỏ, mỗi thao tác ngắn và key rải được ra nhiều slot."
     },
     {
      "i": 2,
      "key": "**Chi phí RAM** — đắt hơn đĩa nhiều lần ",
      "why": "Chỉ giữ dữ liệu nóng có TTL thì dung lượng tỉ lệ với working set chứ không với toàn bộ dữ liệu. Lý do: RAM đắt hơn SSD hàng chục lần mỗi GB, và Redis còn tốn overhead mỗi key (pointer, metadata)."
     },
     {
      "i": 3,
      "key": "**Cache hay nguồn sự thật?** — mặc định ",
      "why": "Luôn có một cửa sổ write đã ack có thể mất khi crash hay failover, vì persistence và replication đều bất đồng bộ. Dùng làm cache thì mất dữ liệu chỉ là miss; dùng làm nguồn sự thật thì phải chấp nhận cửa sổ đó, hoặc thu hẹp bằng AOF `everysec` + replica."
     }
    ]
   },
   {
    "s": 7,
    "title": "Redis hay lựa chọn khác?",
    "table": [
     {
      "row": 0,
      "key": "Dữ liệu",
      "why": "Redis cài sẵn sorted set, hash, stream… nên logic chạy trên server; Memcached chỉ có get/set blob nên mọi cấu trúc phải serialize ở client; Kafka không phải store tra cứu theo key mà là log đọc tuần tự."
     },
     {
      "row": 1,
      "key": "Bền",
      "why": "Redis có RDB/AOF để sống qua restart; Memcached thiết kế thuần cache nên restart là trống; Kafka ghi mọi message xuống đĩa và replicate sang broker khác, vì dữ liệu chính là sản phẩm của nó."
     },
     {
      "row": 2,
      "key": "Scale",
      "why": "Redis Cluster tự chia 16384 slot và chuyển slot giữa node; Memcached không có cluster — client tự hash key ra server — nhưng mỗi node dùng nhiều thread nên tận dụng nhiều core; Kafka scale bằng số partition rải trên broker."
     },
     {
      "row": 3,
      "key": "Chọn khi",
      "why": "Cần cấu trúc dữ liệu và thao tác atomic → Redis; chỉ cache blob và muốn một node to dùng hết core → Memcached đơn giản hơn; cần lưu event lâu dài, đọc lại, nhiều consumer → Kafka, vì log bền làm được còn cache trong RAM thì không."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Khi đưa Redis vào thiết kế, nói rõ: **ke",
    "why": "Bốn câu hỏi này quyết định bộ nhớ, độ đúng và rủi ro: key quyết định phân bố slot và hot key, cấu trúc quyết định độ phức tạp lệnh, TTL quyết định độ cũ và RAM, còn câu \"mất dữ liệu thì sao\" cho thấy bạn biết Redis có thể mất write."
   },
   {
    "i": 1,
    "key": "Cần đọc–tính–ghi atomic (rate limit, nhả",
    "why": "Lua biến kiểm tra và cập nhật thành một bước atomic, vì nó chạy cả logic trên một thread của server, không lệnh nào chen vào. Đọc ở client rồi ghi lại là hai round-trip — ở giữa, client khác có thể chen vào làm sai kết quả."
   },
   {
    "i": 2,
    "key": "Lock quan trọng → nhắc fencing token, vì",
    "why": "Client thứ hai có thể lấy được cùng lock, vì lock vừa set trên primary có thể chưa sang replica khi failover. Fencing token tăng dần buộc storage từ chối ghi từ token cũ hơn → hai người cùng giữ lock cũng không ghi đè nhau được."
   }
  ]
 },
 "delivery": {
  "story": {
   "problem": "Không có khung, ứng viên thường lao vào vẽ Kafka, Redis ngay, rồi phút 30 mới phát hiện đã thiết kế sai bài toán, hoặc hết giờ trước khi chạm tới phần scale. Lý do: buổi system design chỉ 45–60 phút và đề bài cố tình mơ hồ.",
   "idea": "Chia buổi thành các bước có thứ tự, mỗi bước tạo input cho bước sau: requirement sinh ra entity, entity sinh ra API, API quyết định các box trong HLD, còn NFR quyết định deep dive vào đâu. → Mọi quyết định đều truy ngược được về một yêu cầu cụ thể.",
   "tradeoff": "Khung cố định tốn ~10 phút đầu cho phần chưa “vẽ” gì; áp máy móc (tính QPS dài dòng, liệt kê entity thừa) sẽ ăn mất thời gian của deep dive — phần phân loại level rõ nhất."
  },
  "tldr": "Đi sai thứ tự sẽ phải quay lại sửa, vì mỗi bước phụ thuộc output bước trước. HLD chỉ cần chứng minh hệ thống **làm được** các FR; NFR (latency, scale, consistency) là bài toán tối ưu trên một design đã chạy đúng, nên để dành cho deep dive.",
  "points": [
   {
    "i": 0,
    "key": "**Functional Requirements** — hệ thống p",
    "why": "Viết FR dạng “User có thể…” buộc mình nghĩ từ góc người dùng và mỗi câu map thẳng ra một endpoint, vì FR là thứ hệ thống **phải làm được**. Câu mơ hồ như “hệ thống quản lý vé” không sinh ra được API nào cụ thể."
   },
   {
    "i": 1,
    "key": "**Non-functional Requirements** — CAP Th",
    "why": "NFR quyết định kiến trúc, vì chúng là ràng buộc **cách** hệ thống vận hành (nhanh bao nhiêu, chịu tải bao nhiêu, mất node thì sao): cùng FR “đặt vé” nhưng 100 user/ngày thì một Postgres là đủ, 1M user tranh vé cùng lúc thì cần queue và lock phân tán. Danh sách này là checklist để không bỏ sót trục nào khi hỏi interviewer."
   },
   {
    "i": 2,
    "key": "**HLD** — vẽ design tập trung giải quyết",
    "why": "Vẽ đơn giản trước giúp interviewer theo kịp và tạo nền để deep dive chỉ ra chỗ cần sửa. Tối ưu khi chưa có design chạy đúng thì không biết tối ưu cái gì, và dễ thêm cache/queue thừa làm design rối."
   },
   {
    "i": 3,
    "key": "**Deep Dives** — giải quyết các vấn đề l",
    "why": "Deep dive luôn đứng sau HLD, vì NFR chỉ đo được trên một kiến trúc cụ thể: phải có HLD mới thấy request đi qua đâu, DB nào bị đọc nhiều → mới biết đặt cache, replica hay shard ở đâu."
   },
   {
    "i": 4,
    "key": "**Capacity Estimation** — chỉ tính khi c",
    "why": "Con số chỉ có giá trị khi nó đổi quyết định: 400k write/s vượt xa sức ghi một node Postgres (cỡ vài chục nghìn/s) → buộc phải shard hoặc dùng Cassandra; còn 500GB vừa một máy → khỏi shard. Tính QPS chi tiết ngay đầu mà không dẫn tới quyết định nào chỉ tốn 5 phút của deep dive."
   },
   {
    "i": 5,
    "key": "NFR phải **có con số** và **có ngữ cảnh*",
    "why": "“Search < 500ms” cho biết cần index/search engine và có thể chịu một round-trip DB; “hệ thống phải nhanh” không giúp chọn được gì. Ngữ cảnh quan trọng vì consistency không đồng đều: đặt vé sai thì bán trùng ghế (phải strong), còn danh sách sự kiện trễ vài giây không ai để ý (eventual cho phép cache)."
   },
   {
    "i": 6,
    "key": "Bước API: mỗi FR map ra ít nhất một endp",
    "why": "Mỗi FR cần ít nhất một endpoint, nếu không FR đó không có đường vào hệ thống. `userId` phải lấy từ JWT đã được server verify, vì giá trị trong body do client tự điền — attacker đổi thành id người khác là đặt vé/xem dữ liệu của họ."
   },
   {
    "i": 7,
    "key": "Senior/Staff: interviewer kỳ vọng bạn **",
    "why": "Ở level senior, kỹ năng cần chứng minh là **tự nhìn ra rủi ro** trong design của mình, giống dự án thật khi không ai chỉ chỗ sai. Chờ interviewer hỏi mới trả lời → bạn giải được vấn đề nhưng không phát hiện được vấn đề."
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Chốt FR/NFR trước rồi mới vẽ kiến trúc —",
    "why": "Vẽ kiến trúc khi chưa chốt yêu cầu là đang đoán bài toán: bạn có thể dựng hệ thống realtime phức tạp trong khi đề chỉ cần batch. Interviewer trừ điểm vì đó đúng là hành vi gây lãng phí trong dự án thật."
   },
   {
    "i": 1,
    "key": "Giữ HLD đơn giản trước, ghi chú “sẽ quay",
    "why": "Ghi chú điểm nóng cho interviewer thấy bạn đã nhận ra vấn đề, nhưng chọn giải sau khi cả luồng đã đầy đủ → không sa vào tối ưu một box rồi hết giờ trước khi vẽ xong các FR còn lại."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "1 · Requirements",
    "why": "Requirements quyết định toàn bộ phần còn lại: “10M DAU, read-heavy” dẫn tới cache + replica, “strong consistency khi đặt vé” dẫn tới lock/transaction. Giới hạn 3–5 FR vì thời gian chỉ đủ thiết kế kỹ vài luồng chính; ôm 10 tính năng thì cái nào cũng hời hợt."
   },
   {
    "row": 1,
    "key": "2 · Core Entities",
    "why": "Chốt entity sớm giúp cả buổi dùng chung một bộ từ vựng với interviewer, vì entity là danh từ sẽ xuất hiện trong API, bảng DB và các service. Chỉ mất ~2 phút vì chưa cần cột, chỉ cần tên; chi tiết schema để lúc HLD, khi đã biết query nào cần."
   },
   {
    "row": 2,
    "key": "3 · API / System Interface",
    "why": "Viết API xong là biết hệ thống phải xử lý những request nào, vì API là hợp đồng biến FR thành thao tác cụ thể (`POST /bookings`). Mỗi endpoint sau đó thành một luồng để vẽ trong HLD, tránh vẽ box không phục vụ request nào."
   },
   {
    "row": 3,
    "key": "4 · Data Flow (optional)",
    "why": "Với hệ thống dạng pipeline (web crawler, ETL, ad-click aggregation), vẽ data flow trước mới thấy các stage cần queue, worker gì, vì giá trị nằm ở chuỗi biến đổi dữ liệu chứ không ở API. Với app CRUD thông thường, bước này trùng với HLD nên bỏ qua để tiết kiệm thời gian."
   },
   {
    "row": 4,
    "key": "5 · High-Level Design",
    "why": "HLD đi theo từng endpoint — request vào LB, qua service nào, đọc/ghi DB nào — để mọi FR có đường đi end-to-end trước khi tối ưu. Một design nhanh nhưng thiếu tính năng vẫn là design sai."
   },
   {
    "row": 5,
    "key": "6 · Deep Dives",
    "why": "Cần giữ ~10 phút cho deep dive, vì đây là phần interviewer dùng để phân biệt mid với senior. Deep dive là nơi kiểm tra NFR: tính thử tải lên design hiện tại, chỉ ra chỗ nghẽn (DB ghi 50k/s, hot key) rồi đưa giải pháp kèm trade-off."
   }
  ],
  "sections": []
 },
 "networking": {
  "story": {
   "problem": "Mọi quyết định thiết kế — dùng WebSocket hay polling, đặt LB ở đâu, service gọi nhau bằng gì — đều phụ thuộc vào cách dữ liệu đi qua mạng. Không hiểu tầng mạng thì dễ chọn sai, ví dụ HTTP polling mỗi giây cho chat làm server ngập request rỗng.",
   "idea": "Mạng chia tầng, mỗi tầng giải một bài toán: L3 đưa gói tới đúng máy, L4 đưa tới đúng process và quyết định có tin cậy hay không, L7 mang ngữ nghĩa ứng dụng. Biết tầng nào làm gì → biết thiết bị (LB, proxy) hoặc giao thức nào nhìn thấy thông tin nào để ra quyết định.",
   "tradeoff": "Mỗi tầng trên thêm overhead: TCP tốn handshake và chờ gửi lại, TLS thêm round-trip, L7 LB phải parse request nên tốn CPU hơn L4. Chọn giao thức là đổi giữa độ tin cậy, latency và độ phức tạp vận hành."
  },
  "tldr": "L3, L4, L7 là chỗ các quyết định thiết kế thực tế xảy ra (routing, độ tin cậy, ngữ nghĩa request); DNS là bước đầu tiên của mọi request. L4 LB nhanh nhưng không route theo URL được, vì chỉ thấy IP:port; L7 LB route theo path/header được vì đọc được HTTP, nhưng tốn CPU hơn.",
  "points": [
   {
    "i": 0,
    "key": "**IP Addressing** — mỗi thiết bị có IP d",
    "why": "IP trùng thì gói không biết đi đâu, vì IP là địa chỉ để router tìm đường. DB và service nội bộ đặt ở private subnet vì không có route từ Internet vào → attacker không kết nối thẳng được dù biết IP, chỉ đi qua LB/gateway ở public subnet."
   },
   {
    "i": 1,
    "key": "**DNS** — “danh bạ” đổi tên miền (google",
    "why": "Cần DNS dịch tên sang IP, vì con người nhớ tên còn mạng chỉ route theo IP. DNS server biết resolver hỏi từ vùng nào → trả IP của datacenter gần nhất, giảm latency mà client không phải đổi gì."
   },
   {
    "i": 2,
    "key": "**Ports** — 22 SSH, 80 HTTP, 443 HTTPS (",
    "why": "Port chuẩn hoá để client không cần hỏi trước dịch vụ chạy ở đâu: trình duyệt gõ `https://` là tự nối 443. Cả ba dùng TCP vì SSH và web đều cần dữ liệu đủ, đúng thứ tự — mất một byte là hỏng lệnh hoặc hỏng trang."
   },
   {
    "i": 3,
    "key": "**TCP** — bắt tay 3 bước, đánh số thứ tự",
    "why": "TCP đảm bảo đủ và đúng thứ tự dù mạng có thể làm rơi, trùng hoặc đảo gói: nó đánh số từng byte để bên nhận sắp xếp lại, gửi ACK báo đã nhận, bên gửi không thấy ACK thì gửi lại; handshake để hai bên thống nhất số thứ tự bắt đầu. Cái giá: thêm 1 RTT lúc mở kết nối và head-of-line blocking khi một gói bị mất."
   },
   {
    "i": 4,
    "key": "**UDP** — “fire and forget”: không ACK, ",
    "why": "UDP không có độ trễ chờ retransmit, vì nó bỏ hết ACK và gửi lại. Với video call, khung hình tới trễ 200ms còn tệ hơn mất khung đó, vì ứng dụng chỉ cần dữ liệu **hiện tại**; game cũng vậy với vị trí người chơi."
   },
   {
    "i": 5,
    "key": "**HTTP/HTTPS** — request/response trên T",
    "why": "Request nào tới server nào cũng xử lý được → scale ngang dễ, vì HTTP stateless: mỗi request mang đủ thông tin (token, params), server không phải nhớ client. Hệ quả: server không có kênh chủ động đẩy dữ liệu, client phải hỏi lại mới biết có gì mới."
   },
   {
    "i": 6,
    "key": "**WebSockets** — bắt tay một lần rồi giữ",
    "why": "Server đẩy tin được ngay khi có, không tốn header HTTP và handshake cho mỗi tin, vì WebSocket upgrade từ một HTTP request rồi giữ nguyên kết nối TCP. Đổi lại server phải giữ state kết nối, LB cần hỗ trợ kết nối dài, mất server là client phải reconnect."
   },
   {
    "i": 7,
    "key": "**gRPC** — chạy trên HTTP/2, payload nhị",
    "why": "Protobuf nhỏ và parse nhanh hơn JSON nhiều lần, vì mã hoá nhị phân theo schema; HTTP/2 multiplex nhiều call trên một kết nối, bỏ chi phí mở kết nối mới. Code client sinh từ file `.proto` → sai kiểu dữ liệu bị bắt lúc compile thay vì lúc chạy."
   },
   {
    "i": 8,
    "key": "**SSE (Server-Sent Events)** — HTTP thườ",
    "why": "SSE đi qua proxy, LB và auth HTTP sẵn có mà không cần giao thức mới, vì nó chỉ là một HTTP response không đóng, server viết thêm event vào khi có. Hợp với luồng một chiều như notification, giá live, token LLM; trình duyệt tự reconnect và gửi `Last-Event-ID` để nhận tiếp."
   },
   {
    "i": 9,
    "key": "**Long polling** — client gửi request, s",
    "why": "Client nhận tin gần như tức thì mà không phải spam request rỗng như polling thường, vì server giữ request treo đến khi có dữ liệu. Nhưng mỗi client chờ chiếm một kết nối và mỗi tin lại tốn một request mới → tải cao thì kém hơn WebSocket/SSE."
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Mặc định chọn HTTP/REST cho client-facin",
    "why": "REST/JSON an toàn cho client bên ngoài, vì mọi trình duyệt, CDN, cache và công cụ debug đều hiểu. Giữa các service nội bộ bạn kiểm soát cả hai đầu → dùng được gRPC để lấy tốc độ và type safety; kết nối realtime tốn tài nguyên giữ state nên chỉ dùng khi yêu cầu thực cần push."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Layer 3 · Network",
    "why": "Mạng toàn cầu chuyển tiếp nhanh được vì router chỉ đọc IP đích trong header gói để chọn chặng tiếp theo, không quan tâm nội dung. IP không đảm bảo gói tới nơi hay đúng thứ tự — phần đó dành cho tầng trên."
   },
   {
    "row": 1,
    "key": "Layer 4 · Transport",
    "why": "Cần port để hệ điều hành biết giao gói cho process nào (Postgres 5432, Nginx 443), vì một máy chạy nhiều process cùng lúc. Tầng này còn chọn mức tin cậy: TCP đảm bảo đủ và đúng thứ tự, UDP thì không."
   },
   {
    "row": 2,
    "key": "Layer 7 · Application",
    "why": "Mọi logic như auth, routing theo path, cache theo URL đều cần đọc L7, vì chỉ tầng này mới có khái niệm ứng dụng như URL, cookie, user. Đổi lại phải parse toàn bộ request, tốn CPU hơn xử lý ở L4."
   }
  ],
  "sections": []
 },
 "api-design": {
  "story": {
   "problem": "Đổi API sau khi app mobile đã phát hành là làm hỏng các bản đang chạy trên máy người dùng, vì API là hợp đồng giữa client và server. API thiết kế tuỳ tiện còn gây lỗ hổng (lấy `userId` từ body), retry gây thanh toán trùng, hoặc trang sau của feed bị lặp item.",
   "idea": "Chọn kiểu API theo người dùng của nó (public client → REST, nhiều client khác nhau → GraphQL, service nội bộ → gRPC), rồi áp các quy ước có sẵn: resource + HTTP method, status code chuẩn, pagination, versioning, idempotency. Quy ước chuẩn giúp client đoán được hành vi và hạ tầng (cache, proxy) hiểu được request.",
   "tradeoff": "Không kiểu nào tốt mọi mặt: REST đơn giản nhưng hay fetch thừa/thiếu, GraphQL linh hoạt nhưng khó cache và dễ N+1, gRPC nhanh nhưng khó dùng từ browser. Thêm idempotency, rate limit, versioning cũng là thêm state và code phải duy trì."
  },
  "tldr": "REST là mặc định an toàn, vì nó tận dụng HTTP nên CDN, browser, cache đều hiểu sẵn. GraphQL đáng giá khi mỗi client cần shape dữ liệu khác nhau, vì client tự chọn field trong một request; gRPC đáng giá khi bạn kiểm soát cả hai đầu và cần tốc độ, type safety, streaming.",
  "points": [
   {
    "i": 0,
    "key": "**REST bước 1 · Resource Modeling** — xá",
    "why": "Đặt URL theo danh từ thay vì động từ (`/events` chứ không phải `/getEvents`) để hành động nằm ở HTTP method → cùng một URL dùng cho đọc, tạo, xoá. Lồng `/events/{id}/bookings` thể hiện quan hệ cha–con, client đọc URL là hiểu phạm vi dữ liệu."
   },
   {
    "i": 1,
    "key": "**REST bước 2 · HTTP Methods** — GET, PO",
    "why": "Mỗi method có ngữ nghĩa mà hạ tầng dựa vào: GET an toàn nên cache và prefetch được, PUT/DELETE idempotent nên retry không gây hại, POST thì không. Dùng sai (ví dụ GET để xoá) thì crawler hoặc prefetch của browser có thể vô tình xoá dữ liệu."
   },
   {
    "i": 2,
    "key": "**REST bước 3 · Passing Data** — path pa",
    "why": "Path định danh **một** resource nên thiếu là 404; query param là tuỳ chọn để lọc nên có thể bỏ và kết hợp tự do; body chứa dữ liệu lớn, có cấu trúc mà URL không nên mang (URL bị log lại và có giới hạn độ dài)."
   },
   {
    "i": 3,
    "key": "**REST bước 4 · Returning Data** — statu",
    "why": "Status code cho client và hạ tầng biết kết quả mà không cần parse body: 5xx thì retry được, 4xx thì không vì gửi lại vẫn sai. Trả `200` kèm `{\"error\": ...}` làm hỏng retry logic, monitoring và cache."
   },
   {
    "i": 4,
    "key": "**GraphQL · N+1 problem** — GraphQL khôn",
    "why": "GraphQL dễ sinh 1 + 50 query, vì nó resolve từng field độc lập: lấy 50 event rồi resolver `venue` chạy 50 lần. REST endpoint thì biết trước dữ liệu cần trả nên viết sẵn một câu JOIN. DataLoader hoãn các lần gọi trong cùng một tick, gom 50 `venue_id` thành một `WHERE id IN (...)` → còn 2 query."
   },
   {
    "i": 5,
    "key": "**RPC** — binary serialization + HTTP/2 ",
    "why": "Payload nhỏ và không phải parse text, vì Protobuf không gửi tên field, chỉ gửi số tag và giá trị nhị phân; HTTP/2 chạy nhiều call song song trên một kết nối. Client generate từ `.proto` → gọi sai tên hàm hay sai kiểu là lỗi compile, không đợi tới production."
   },
   {
    "i": 6,
    "key": "**Pagination** — offset-based (`?offset=",
    "why": "Offset càng về sau càng chậm, vì `OFFSET 10000` buộc DB đọc rồi bỏ 10000 dòng trước khi trả 10 dòng; có item mới chèn vào đầu thì mọi item bị đẩy xuống một vị trí và trang sau lặp lại item cũ. Cursor dùng `WHERE id < :cursor LIMIT 10` nên đi thẳng vào index, và vị trí neo theo item chứ không theo số thứ tự → dữ liệu mới không làm lệch."
   },
   {
    "i": 7,
    "key": "**Versioning** — URL versioning `/v1/eve",
    "why": "Thay đổi phá vỡ phải ra version mới để hai bản chạy song song, vì client cũ (app mobile chưa update) vẫn gọi API cũ. Version trên URL hiện rõ trong log và dễ route ở gateway; version trong header giữ URL sạch nhưng khó thấy, khó test bằng trình duyệt."
   },
   {
    "i": 8,
    "key": "**Security · AuthN/AuthZ** — API Key cho",
    "why": "API key là chuỗi bí mật dài hạn gắn với một ứng dụng, hợp cho máy gọi máy. JWT chứa claim có chữ ký nên server verify không cần tra DB; để trong HttpOnly cookie thì JavaScript không đọc được → XSS không lấy cắp được token (nhưng cần chống CSRF). RBAC gán quyền theo role thay vì từng user nên dễ quản lý khi có hàng nghìn user."
   },
   {
    "i": 9,
    "key": "**Security · Rate limiting** — theo user",
    "why": "Mỗi chiều chặn một kiểu lạm dụng: theo user chặn tài khoản spam, theo IP chặn bot chưa đăng nhập, theo endpoint bảo vệ API đắt (search, login) khỏi bị dội. Thiếu rate limit thì một client lỗi vòng lặp retry cũng đủ làm sập service cho mọi người."
   },
   {
    "i": 10,
    "key": "**Idempotency** — POST tạo đơn/thanh toá",
    "why": "Retry có thể trừ tiền hai lần, vì khi request timeout client không biết server đã tạo đơn hay chưa. Server lưu `Idempotency-Key` kèm kết quả lần đầu; request trùng key thì trả lại kết quả cũ thay vì thực hiện lại."
   },
   {
    "i": 11,
    "key": "Status code cần nhớ: 200, 201 Created, 2",
    "why": "Mỗi mã dẫn tới hành vi khác ở client: 401 thì đăng nhập lại, 403 thì đăng nhập lại cũng vô ích, 409 báo xung đột (vé đã bị đặt), 429 bảo chờ rồi thử lại, 503 là lỗi tạm thời nên retry được. Dùng đúng mã → client và LB tự xử lý được mà không cần đọc message."
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Không đưa `userId` vào body/path cho hàn",
    "why": "Lấy user id từ token thì client không có cách nào giả mạo, vì token đã được server ký và verify. Giá trị trong body/path do client tự gửi — đổi thành id người khác là truy cập dữ liệu của họ (lỗ hổng IDOR)."
   },
   {
    "i": 1,
    "key": "Nói rõ vì sao chọn cursor pagination khi",
    "why": "Feed có item mới liên tục chính là trường hợp offset bị lệch và lặp item → giải thích lý do cho interviewer thấy bạn hiểu cơ chế chứ không thuộc lòng. Kèm trade-off: cursor không nhảy thẳng tới trang 50 được."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "REST",
    "why": "GET cache được ở CDN/browser và ai cũng gọi được bằng `curl`, vì REST dựa trên URL và method chuẩn của HTTP. Nhưng mỗi endpoint trả shape cố định: màn hình cần 3 field vẫn nhận 30 (over-fetching), cần dữ liệu từ 3 resource thì phải gọi 3 lần (under-fetching)."
   },
   {
    "row": 1,
    "key": "GraphQL",
    "why": "Mobile lấy ít, web lấy nhiều mà không phải tạo endpoint riêng cho từng loại, vì client gửi query mô tả đúng field cần. Cache HTTP theo URL không dùng được, vì mọi query thường đi qua một `POST /graphql`; và mỗi field được resolve riêng nên dễ sinh N+1 query xuống DB."
   },
   {
    "row": 2,
    "key": "RPC / gRPC",
    "why": "Call nhanh nhờ payload nhị phân Protobuf và HTTP/2 multiplex; client sinh từ schema nên sai kiểu bị bắt lúc compile. Nhưng payload nhị phân không đọc được bằng mắt, và browser không kiểm soát được HTTP/2 frame/trailer nên cần proxy gRPC-Web."
   }
  ],
  "sections": []
 },
 "data-modeling": {
  "story": {
   "problem": "Schema chọn sai rất đắt để sửa: dữ liệu đã có hàng tỷ dòng thì migration mất nhiều ngày, còn shard key sai thì gần như phải chuyển toàn bộ dữ liệu. Thiết kế bảng theo cảm tính hay dẫn tới query chính phải scan cả bảng hoặc JOIN qua nhiều shard.",
   "idea": "Thiết kế dữ liệu ngược từ cách nó được dùng: FR quyết định cột, access pattern quyết định index, tỉ lệ đọc/ghi quyết định có denormalize không, query chính quyết định shard key. Bắt đầu đơn giản (một DB quan hệ chuẩn hoá), chỉ thêm độ phức tạp khi có con số đòi hỏi.",
   "tradeoff": "Tối ưu cho access pattern chính thường làm khó các pattern khác: shard theo `user_id` thì query theo `event_id` phải hỏi mọi shard; denormalize đọc nhanh nhưng phải đồng bộ nhiều bản sao khi ghi."
  },
  "tldr": "Đi từ quyết định lớn, khó đổi nhất (loại DB) tới tối ưu cục bộ, vì mỗi bước dựa vào output bước trước: phải biết cột mới chọn được key, biết query mới chọn được index. Denormalize và sharding đứng cuối vì chúng thêm độ phức tạp, chỉ đáng làm khi con số tải đòi hỏi.",
  "points": [
   {
    "i": 0,
    "key": "**1 · Chọn loại database** — Relational ",
    "why": "Mỗi loại DB tối ưu cho một hình dạng dữ liệu: relational cho quan hệ và JOIN, document cho object lồng nhau đọc trọn một lần, key-value cho tra cứu theo key với latency thấp, graph cho truy vấn nhiều bước qua quan hệ (bạn của bạn). Chọn lệch thì phải tự làm lại phần DB không hỗ trợ trong code ứng dụng."
   },
   {
    "i": 1,
    "key": "**2 · Liệt kê cột** cần cho từng entity ",
    "why": "Đi từ FR giúp không thiếu dữ liệu cần thiết và không thêm cột thừa, vì mỗi cột phải phục vụ một FR. Ví dụ FR “xem sự kiện theo thành phố” buộc bảng `events` phải có `city`."
   },
   {
    "i": 2,
    "key": "**3 · Primary key & foreign key** cho từ",
    "why": "PK cho mỗi dòng một định danh duy nhất để tra cứu và tham chiếu; FK bắt DB kiểm tra tham chiếu tồn tại → không có booking trỏ tới event đã bị xoá. Xác định quan hệ 1–N hay N–N lúc này cũng quyết định có cần bảng trung gian không."
   },
   {
    "i": 3,
    "key": "**4 · Cột nào cần index** — dựa vào quer",
    "why": "Chọn index theo query thực tế (`WHERE user_id = ? ORDER BY created_at`) thay vì index mọi cột, vì index chỉ giúp query có điều kiện trên đúng các cột đó, và mỗi index làm chậm mọi lần ghi."
   },
   {
    "i": 4,
    "key": "**5 · Có cần denormalize** để tăng hiệu ",
    "why": "Lưu sẵn bản sao như `venue_name` trong `events` bỏ được JOIN — đáng làm khi đọc nhiều hơn ghi hàng trăm lần (feed, trang sản phẩm), vì chuẩn hoá bắt mỗi lần đọc phải JOIN. Cái giá: venue đổi tên thì phải cập nhật mọi bản sao, nên chỉ làm khi đọc là bottleneck."
   },
   {
    "i": 5,
    "key": "**6 · Có cần sharding** — nếu có, chọn s",
    "why": "Sharding cần khi dữ liệu hoặc tải ghi vượt một máy. Shard key phải khớp query chính để mỗi query chỉ chạm một shard: shard `bookings` theo `user_id` thì “booking của tôi” rất nhanh, nhưng “mọi booking của event X” phải scatter-gather tới mọi shard."
   },
   {
    "i": 6,
    "key": "**Relational DB** — bảng có schema cố đị",
    "why": "Logic như chuyển tiền hay đặt vé không phải tự xử lý trường hợp ghi được một nửa, vì schema cố định cho DB biết trước kiểu dữ liệu nên chặn dữ liệu sai ngay lúc ghi, còn FK và transaction ACID đảm bảo các bảng liên quan luôn khớp nhau."
   },
   {
    "i": 7,
    "key": "Mặc định chọn **PostgreSQL** nếu không c",
    "why": "PostgreSQL phủ phần lớn bài toán, vì có ACID, JOIN, index đa dạng, JSONB cho dữ liệu bán cấu trúc và một node chịu được tải khá lớn. Chọn NoSQL không lý do là nhận về hạn chế (không JOIN, consistency yếu) mà không được lợi gì; interviewer muốn nghe bạn nêu được con số hoặc pattern buộc phải đổi."
   }
  ],
  "sections": []
 },
 "indexing": {
  "story": {
   "problem": "Không có index, `WHERE email = ?` trên bảng 100 triệu dòng mất hàng giây đến hàng phút, vì DB phải đọc lần lượt từng dòng (full table scan). Bảng lớn dần → query tăng tuyến tính theo số dòng và kéo sập cả DB.",
   "idea": "Index là cấu trúc phụ sắp sẵn theo giá trị cột (B-Tree, hash) để DB nhảy thẳng tới dòng cần tìm. B-Tree với 100 triệu dòng chỉ cao 3–4 tầng → tra cứu chỉ tốn vài lần đọc page thay vì quét toàn bảng.",
   "tradeoff": "Mỗi index là một bản sao dữ liệu đã sắp xếp: tốn dung lượng, và mọi INSERT/UPDATE/DELETE phải cập nhật thêm từng index. Bảng ghi nhiều mà có quá nhiều index sẽ chậm ghi rõ rệt."
  },
  "tldr": "B-Tree là mặc định vì giữ key theo thứ tự → làm được cả `=` lẫn range/sort. Hash chỉ làm được `=`, vì chỉ biết vị trí của từng giá trị riêng lẻ. Composite phải có cột trái nhất, vì sắp theo cột đầu trước; clustered quyết định thứ tự vật lý của dòng nên mỗi bảng chỉ có một.",
  "points": [
   {
    "i": 0,
    "key": "**Leftmost prefix** — index `(Ho, Ten)` ",
    "why": "Tìm theo Ten một mình thì DB phải duyệt hết, vì index `(Ho, Ten)` sắp theo Ho trước → mọi người tên “An” nằm rải rác dưới các họ khác nhau, không có đoạn liên tục nào để nhảy vào. Giống tìm theo tên trong danh bạ sắp theo họ."
   },
   {
    "i": 1,
    "key": "**Trade-off** — index tăng tốc đọc nhưng",
    "why": "Đọc nhanh vì DB nhảy theo cây thay vì quét bảng; ghi chậm vì mỗi INSERT phải chèn thêm vào từng index, đôi khi tách node B-Tree. Bảng có 5 index thì một lần ghi thành 6 lần ghi cấu trúc, và mỗi index chiếm dung lượng tương ứng số dòng."
   },
   {
    "i": 2,
    "key": "Index đặc biệt: **Geospatial** (PostGIS,",
    "why": "B-Tree không trả lời được “điểm nào trong bán kính 2km” (cần 2 chiều) hay “văn bản nào chứa từ X” (từ nằm giữa chuỗi), vì nó chỉ sắp theo một chiều. Geohash/Quadtree chia không gian thành ô để điểm gần nhau có key gần nhau; inverted index map mỗi từ sang danh sách document chứa nó."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "B-Tree",
    "why": "Tìm `created_at > X` chỉ cần nhảy tới X rồi đọc tuần tự sang phải, vì B-Tree giữ key đã sắp xếp và các node lá nối nhau. Cây rộng (mỗi node hàng trăm key) nên rất thấp, ít lần đọc đĩa → hầu hết DB chọn làm mặc định."
   },
   {
    "row": 1,
    "key": "Hash",
    "why": "Tra `=` là O(1) vì hash biến giá trị thành vị trí bucket, nhưng hai giá trị gần nhau cho hash hoàn toàn khác nhau → không có thứ tự để làm range hay ORDER BY. Hợp với lookup thuần như session id, nơi không bao giờ hỏi “session lớn hơn X”."
   },
   {
    "row": 2,
    "key": "Clustered",
    "why": "Tra theo PK là có dữ liệu ngay, không cần đọc thêm, vì clustered index lưu luôn cả dòng ở node lá → dòng nằm trên đĩa theo đúng thứ tự key. Mỗi bảng chỉ có một clustered index, vì dữ liệu chỉ sắp vật lý được theo một thứ tự."
   },
   {
    "row": 3,
    "key": "Non-clustered",
    "why": "Tạo được nhiều non-clustered index cho nhiều cột, vì mỗi index chỉ lưu giá trị cột cộng con trỏ (hoặc PK) tới dòng. Đổi lại, tìm xong còn một bước nhảy về bảng chính để lấy các cột còn lại, trừ khi index đã chứa đủ cột (covering index)."
   },
   {
    "row": 4,
    "key": "Unique",
    "why": "Unique index vừa chặn trùng vừa tăng tốc tra cứu, vì khi ghi DB phải tra index để kiểm tra giá trị đã tồn tại chưa. Ràng buộc ở tầng DB mới chắc chắn: hai request đồng thời cùng kiểm tra ở code ứng dụng đều có thể thấy “chưa có” rồi cùng chèn."
   },
   {
    "row": 5,
    "key": "Composite",
    "why": "Thứ tự khai báo quyết định composite index phục vụ được query nào, vì nó sắp theo cột đầu, trong cùng giá trị cột đầu mới sắp theo cột thứ hai — giống danh bạ sắp theo Họ rồi tới Tên."
   }
  ],
  "sections": []
 },
 "core-db": {
  "story": {
   "problem": "Chọn sai nơi lưu dữ liệu thì trả giá lâu dài: dùng NoSQL cho đơn hàng cần transaction thì phải tự xử lý ghi dở dang; dùng một Postgres cho 1 triệu write/s thì không máy nào chịu nổi.",
   "idea": "SQL đặt tính đúng lên trước: schema, FK và ACID để nhiều bảng luôn nhất quán. NoSQL nới các đảm bảo đó (ít JOIN, transaction hạn chế, thường eventual) để dữ liệu chia ra nhiều máy dễ dàng, đổi lấy scale ngang và write throughput.",
   "tradeoff": "SQL scale ngang khó, vì JOIN và transaction trải qua nhiều máy rất đắt. NoSQL scale dễ nhưng đẩy phần đảm bảo nhất quán và JOIN lên code ứng dụng, và buộc thiết kế schema theo query từ đầu."
  },
  "tldr": "SQL mạnh khi quan hệ phức tạp nhưng khó chia ra nhiều máy, vì transaction ACID và JOIN cần mọi dữ liệu liên quan nằm chung chỗ để khoá và kiểm tra cùng lúc. NoSQL scale ngang tự nhiên cho dữ liệu lớn và tải ghi cao, vì mỗi item tự đủ và phân tán theo key.",
  "points": [
   {
    "i": 0,
    "key": "**ACID — Atomicity** — mọi câu lệnh tron",
    "why": "Kết quả chỉ có hai trạng thái — tất cả hoặc không gì — vì DB ghi mọi thay đổi vào log, chỉ áp dụng khi có COMMIT, lỗi giữa chừng thì dùng log để hoàn tác. Ví dụ chuyển tiền gồm trừ A và cộng B; chỉ chạy được câu đầu thì tiền biến mất."
   },
   {
    "i": 1,
    "key": "**ACID — Consistency** — sau transaction",
    "why": "Không bao giờ lưu được trạng thái như booking trỏ tới event không tồn tại, vì DB kiểm tra mọi constraint trước khi commit, vi phạm thì huỷ transaction. Constraint ở DB có hiệu lực với mọi client, kể cả script chạy tay, không phụ thuộc code ứng dụng."
   },
   {
    "i": 2,
    "key": "**ACID — Isolation** — transaction đồng ",
    "why": "Thiếu isolation, transaction B có thể đọc số dư mà A mới trừ rồi A rollback → B ra quyết định trên dữ liệu không bao giờ tồn tại. DB dùng lock hoặc MVCC (mỗi transaction đọc một snapshot) để cô lập; mạnh tới đâu tuỳ isolation level."
   },
   {
    "i": 3,
    "key": "**ACID — Durability** — commit xong là n",
    "why": "Mất điện xong khởi động lại vẫn replay được log, vì DB ghi thay đổi vào WAL và `fsync` xuống đĩa trước khi báo commit thành công. Cái giá: mỗi commit chờ một lần flush đĩa → batch commit hoặc group commit giúp tăng throughput."
   },
   {
    "i": 4,
    "key": "**SQL joins** — INNER (chỉ dòng khớp), L",
    "why": "Các loại JOIN khác nhau ở cách xử lý dòng không khớp: INNER bỏ đi, LEFT giữ dòng bên trái và điền NULL — hợp với câu kiểu “mọi user kể cả chưa có đơn”. CROSS ghép mọi cặp nên 1000 × 1000 thành 1 triệu dòng, hiếm khi dùng ngoài sinh tổ hợp."
   },
   {
    "i": 5,
    "key": "Ví dụ: PostgreSQL / MySQL (SQL); DynamoD",
    "why": "Nhắc tên cụ thể giúp câu trả lời có trọng lượng: DynamoDB/Cassandra là key-value/wide-column cho write lớn, MongoDB là document cho schema linh hoạt. Mỗi cái có mô hình dữ liệu riêng nên nói “dùng NoSQL” chung chung là chưa đủ."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Data model",
    "why": "SQL chuẩn hoá dữ liệu thành nhiều bảng nối bằng FK để mỗi thông tin chỉ lưu một chỗ — sửa một nơi là đúng mọi nơi. NoSQL lưu theo hình dạng query cần (cả object trong một document, hoặc một key) → đọc một lần là đủ nhưng dữ liệu có thể bị lặp."
   },
   {
    "row": 1,
    "key": "Transaction",
    "why": "ACID trên một node dễ vì chỉ có một bộ quản lý lock và log. Với NoSQL, dữ liệu nằm trên nhiều replica/node, strong consistency phải chờ đồng thuận giữa các node nên tăng latency → nhiều hệ chọn eventual mặc định và cho bật strong khi cần (DynamoDB strongly consistent read)."
   },
   {
    "row": 2,
    "key": "Scale",
    "why": "SQL thường nâng cấp máy trước, rồi thêm read replica cho tải đọc, vì nó dựa vào JOIN và transaction giữa nhiều bảng — chia bảng ra nhiều máy thì các thao tác đó thành distributed. NoSQL thiết kế quanh partition key nên mỗi item thuộc đúng một node; thêm node chỉ cần chuyển một phần key nhờ consistent hashing."
   },
   {
    "row": 3,
    "key": "Index",
    "why": "B-Tree ghi tại chỗ nên đọc nhanh, nhưng mỗi lần ghi là ghi ngẫu nhiên lên đĩa. LSM-Tree (Cassandra, RocksDB) ghi rất nhanh vì gom ghi vào memtable rồi flush tuần tự ra file; đổi lại đọc có thể phải xem nhiều file và tốn compaction ở nền."
   },
   {
    "row": 4,
    "key": "Chọn khi",
    "why": "Cần JOIN và ACID (đơn hàng, thanh toán, đặt vé) → SQL, vì nó làm sẵn những thứ khó tự viết. Big data, write cực lớn hoặc schema hay đổi → NoSQL hợp hơn, vì scale ngang dễ và không cần migration khi thêm field."
   }
  ],
  "table2": [
   {
    "row": 0,
    "key": "Read Uncommitted",
    "why": "Nhanh nhất vì không giữ lock đọc và không cần snapshot, nhưng đọc được dữ liệu sắp bị rollback (dirty read). Gần như không dùng trong thực tế; PostgreSQL còn coi mức này như Read Committed."
   },
   {
    "row": 1,
    "key": "Read Committed",
    "why": "Không thấy dữ liệu dở dang, vì mỗi **câu lệnh** đọc snapshot mới nhất đã commit. Nhưng hai câu SELECT trong cùng transaction có thể thấy kết quả khác, vì giữa chúng transaction khác đã commit; mức này đủ cho đa số workload nên PostgreSQL chọn làm mặc định."
   },
   {
    "row": 2,
    "key": "Repeatable Read",
    "why": "Đọc lại một dòng luôn ra cùng giá trị, vì cả **transaction** đọc cùng một snapshot từ lúc bắt đầu. Theo chuẩn SQL, mức này chỉ khoá các dòng đã đọc nên dòng mới chèn khớp điều kiện vẫn có thể xuất hiện (phantom); InnoDB dùng MVCC snapshot và next-key lock nên thực tế chặn được phần lớn phantom."
   },
   {
    "row": 3,
    "key": "Serializable",
    "why": "Kết quả giống như các transaction chạy lần lượt — DB đảm bảo bằng lock range hoặc phát hiện xung đột rồi abort (SSI ở PostgreSQL). Throughput giảm vì phải chờ lock hoặc retry transaction bị abort → chỉ dùng cho thao tác cần tuyệt đối đúng như chống bán trùng."
   }
  ],
  "sections": []
 },
 "caching": {
  "story": {
   "problem": "Khi 10k request/s cùng hỏi một trang chủ, DB tốn CPU và I/O cho cùng một kết quả lặp lại → latency tăng vọt rồi sập. Lý do: mỗi lần DB đọc từ disk và parse query mất vài ms.",
   "idea": "Giữ phần dữ liệu nóng trong RAM gần người đọc, vì đa số traffic chỉ chạm một phần nhỏ dữ liệu (quy luật 80/20). Đọc RAM ~100ns so với SSD ~100µs, và mỗi cache hit là một query DB khỏi phải chạy.",
   "tradeoff": "Hai bản sao của cùng dữ liệu luôn có nguy cơ lệch (stale data). Kèm theo là bài toán invalidation, eviction và các sự cố riêng như stampede, hot key."
  },
  "tldr": "Phải chọn chỗ đặt cache trước, vì mỗi tầng chặn request ở một khoảng cách khác nhau tới DB — càng gần user càng rẻ nhưng càng khó invalidate. Ba sự cố hot key, consistency, stampede chung một gốc: cache là bản sao có thời hạn của DB, nên khi bản sao lệch, hết hạn hoặc bị dồn tải thì DB phía sau lãnh hậu quả.",
  "points": [
   {
    "i": 0,
    "key": "**Where to cache** — Client-side (LocalS",
    "why": "Càng gần user càng bớt nhiều chặng mạng: client cache không tốn round-trip nào, CDN cắt đường xa tới origin, in-process tránh cả network hop (~0.5ms) nhưng mỗi instance giữ bản riêng, không chia sẻ được; Redis thì dùng chung cho mọi instance. Đánh đổi chung: càng gần user càng khó chủ động xoá khi dữ liệu đổi."
   },
   {
    "i": 1,
    "key": "**Eviction** — LRU (xoá mục lâu nhất chư",
    "why": "RAM có hạn, nên khi đầy phải chọn mục để bỏ. **LRU** phổ biến vì truy cập có locality theo thời gian (vừa dùng thì sắp dùng lại) và chỉ tốn O(1) với hash map + linked list; LFU hợp khi độ nóng ổn định lâu dài nhưng dễ giữ mãi mục từng hot trong quá khứ; FIFO đơn giản nhất nhưng có thể xoá đúng mục đang nóng."
   },
   {
    "i": 2,
    "key": "**Invalidation** — đảm bảo cache khớp DB",
    "why": "Không chủ động xoá hoặc đặt hạn thì cache trả giá trị cũ vô thời hạn, vì nó không tự biết DB vừa đổi. Invalidation (xoá theo sự kiện ghi, hoặc TTL) là cơ chế duy nhất giới hạn thời gian dữ liệu cũ còn sống."
   },
   {
    "i": 3,
    "key": "**Hot keys** — replicate key nóng lên nh",
    "why": "Thêm node không giúp gì cho hot key: một key chỉ nằm trên một node, nên mọi request cho key đó dồn vào node ấy dù cluster còn rảnh. Nhân bản key ra nhiều node (hoặc thêm hậu tố như `key#1..#k`) chia lượt đọc ra k node, mỗi node chỉ gánh 1/k tải."
   },
   {
    "i": 4,
    "key": "**Cache consistency** — xoá cache sau kh",
    "why": "Xoá cache an toàn hơn **ghi lại** cache: ghi lại thì hai request ghi song song có thể đặt giá trị cũ đè lên giá trị mới, còn xoá buộc lần đọc kế tiếp lấy bản mới từ DB. TTL ngắn là lưới an toàn: kể cả khi lỡ lệnh xoá, dữ liệu cũ chỉ sống tối đa bằng TTL — đủ chấp nhận cho feed hay metrics vốn không cần chính xác từng giây."
   },
   {
    "i": 5,
    "key": "**Cache stampede (thundering herd)** — *",
    "why": "Một key nóng hết hạn → hàng nghìn request cùng miss trong một khoảnh khắc và cùng chạy một query nặng xuống DB, DB gánh N lần tải thay vì 1. Single flight dùng lock/promise theo key để chỉ request đầu tiên đi rebuild, số còn lại chờ và dùng chung kết quả → DB chỉ nhận đúng 1 query."
   },
   {
    "i": 6,
    "key": "**Cache-aside (lazy loading)** — pattern",
    "why": "App tự quyết định đọc và nạp, nên cache chỉ chứa những gì thật sự được đọc, và khi cache sập app vẫn chạy bằng cách đọc thẳng DB (chậm hơn nhưng không chết). TTL bảo đảm mục nào cũng tự hết hạn, dữ liệu lệch không sống mãi."
   },
   {
    "i": 7,
    "key": "Stampede còn giải bằng **TTL jitter** (n",
    "why": "Cộng ngẫu nhiên ±10% vào TTL làm thời điểm hết hạn trải đều ra, tránh **cache avalanche** — nhiều key hết hạn **cùng lúc** (ví dụ cùng được nạp lúc deploy với TTL 3600s) rồi đồng loạt đổ xuống DB. Refresh trước khi hết hạn (TTL còn ít thì một request nền nạp lại) → key không bao giờ thật sự miss, không có đám đông nào dồn xuống DB."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Write-Through",
    "why": "Lần đọc ngay sau luôn thấy giá trị mới, vì request chỉ trả lời khi **cả cache và DB** đã ghi xong. Đổi lại, latency ghi = tổng hai lần ghi tuần tự."
   },
   {
    "row": 1,
    "key": "Write-Around",
    "why": "Bản ghi ghi-một-lần-ít-đọc (log, đơn cũ) không chiếm RAM, vì ghi không đi qua cache — dữ liệu chỉ vào cache khi có người thật sự đọc. Cái giá: lần đọc đầu tiên sau khi ghi chắc chắn miss và phải xuống DB."
   },
   {
    "row": 2,
    "key": "Write-Back",
    "why": "Throughput ghi rất cao, vì client chỉ chờ ghi vào RAM (dưới 1ms) còn DB được ghi bất đồng bộ, thường gom thành batch. Nhưng trong khoảng chờ flush, bản duy nhất của dữ liệu nằm trong RAM — cache node chết là mất luôn."
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Luôn nói cache **cái gì**, **key** là gì",
    "why": "Bốn câu này quyết định hệ cache đúng hay sai: key sai thì hit rate thấp hoặc trả nhầm dữ liệu giữa user, TTL quyết định độ stale tối đa, invalidation quyết định dữ liệu đổi bao lâu mới được thấy. Nghe đủ bốn câu trả lời, interviewer biết bạn hiểu cache chứ không chỉ nói 「thêm Redis」."
   }
  ],
  "sections": []
 },
 "sharding": {
  "story": {
   "problem": "Mua máy to hơn đến lúc cũng hết đường hoặc quá đắt, vì một DB node có giới hạn cứng về disk (vài TB), RAM cho index và throughput ghi (vài chục nghìn TPS). Dữ liệu hoặc lượng ghi vượt mức đó là chạm trần.",
   "idea": "Dung lượng và throughput ghi tăng gần tuyến tính theo số máy: chia dữ liệu theo một shard key thành nhiều phần độc lập, mỗi phần nằm trên một máy.",
   "tradeoff": "Query hoặc transaction cần dữ liệu từ nhiều shard trở nên chậm và phức tạp (scatter-gather, 2PC). Chọn sai shard key gây hot spot, và đổi shard key về sau là một cuộc migration lớn."
  },
  "tldr": "Chỉ sharding mới phá được giới hạn một máy; partitioning giảm kích thước mỗi bảng/index nhưng vẫn nằm trong giới hạn đó. **Hash** là mặc định vì trải key đều mà không cần hiểu dữ liệu. Shard key phải khớp access pattern: query có shard key trong điều kiện thì đi thẳng tới 1 shard, query thiếu nó phải hỏi tất cả shard.",
  "points": [
   {
    "i": 0,
    "key": "**Horizontal partitioning** — giữ nguyên",
    "why": "Mỗi phân vùng chỉ chứa một phần các dòng, nên index và lượng dữ liệu phải quét nhỏ đi; query có điều kiện trên partition key được partition pruning bỏ qua các phân vùng không liên quan. Đây cũng là nền của sharding: mỗi phân vùng đặt được lên một máy."
   },
   {
    "i": 1,
    "key": "**Vertical partitioning** — giữ nguyên s",
    "why": "Tách cột lớn/ít dùng ra bảng riêng thì bảng chính gọn, vừa RAM hơn, query thường nhanh hơn. Lý do: DB đọc theo page chứa cả dòng, cột lớn ít dùng (bio, ảnh, JSON) làm mỗi page chứa ít dòng hơn, query cột nóng phải đọc nhiều page hơn."
   },
   {
    "i": 2,
    "key": "**Challenges** — hot spot & load imbalan",
    "why": "Sau khi chia, mỗi shard là một DB độc lập: tải không còn tự cân bằng, JOIN hay transaction qua hai shard cần phối hợp qua mạng (scatter-gather, 2PC), và không còn transaction ACID cục bộ nào bao trùm toàn bộ dữ liệu để giữ ràng buộc."
   },
   {
    "i": 3,
    "key": "**Giải hot spot** — tách shard động (dyn",
    "why": "Hot spot sinh ra khi một khoảng key hoặc một key nhận tải quá lớn: dynamic splitting chia khoảng nóng thành hai shard; compound key (ví dụ `user_id + bucket`) trải dữ liệu của một key nóng ra nhiều shard; cô lập hot key thì cho nó một máy riêng để không kéo chậm các key khác."
   },
   {
    "i": 4,
    "key": "Hash function **không ngẫu nhiên** — cùn",
    "why": "Router biết chính xác dữ liệu nằm đâu mà không cần tra cứu, vì hash là hàm tất định: cùng `user_id` luôn ra cùng shard. Phân bố đều chỉ là thống kê trên nhiều key khác nhau — một key nhận nhiều traffic thì hash cũng không chia nhỏ được tải của key đó."
   },
   {
    "i": 5,
    "key": "Cross-shard query/transaction đắt: tránh",
    "why": "Query thiếu shard key phải gửi tới mọi shard rồi gộp kết quả → latency bằng shard chậm nhất, tải nhân N lần; transaction qua nhiều shard cần 2PC với nhiều round-trip và lock. App mà phần lớn query là 「dữ liệu của user X」 thì chọn `user_id` làm shard key → gần như query nào cũng chỉ chạm 1 shard."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Hash-based (mặc định)",
    "why": "Tải đều vì hàm hash xáo trộn đầu vào, các user_id liền nhau rơi vào shard khác nhau. Cũng vì xáo trộn mà một khoảng ID liên tục bị rải khắp các shard → range query phải hỏi tất cả; và vì shard phụ thuộc `% N`, đổi N từ 4 lên 5 làm khoảng 80% key đổi chỗ."
   },
   {
    "row": 1,
    "key": "Range-based",
    "why": "Range query (ví dụ đơn hàng tháng 10) chỉ chạm 1–2 shard, vì các key liền nhau nằm chung shard. Nhưng với key tăng dần như timestamp hay auto-increment ID, mọi bản ghi mới đều rơi vào shard chứa khoảng cuối → shard đó nhận gần 100% lượt ghi."
   },
   {
    "row": 2,
    "key": "Directory-based",
    "why": "Chuyển một key sang shard khác chỉ cần sửa một dòng, vì vị trí mỗi key ghi rõ trong bảng tra cứu thay vì tính từ công thức. Đổi lại mọi request phải hỏi directory trước → directory chết là cả hệ không biết dữ liệu ở đâu (thường giảm thiểu bằng replicate và cache directory)."
   }
  ],
  "sections": []
 },
 "consistent-hashing": {
  "story": {
   "problem": "Với `hash(key) % N`, thêm một server (N từ 4 lên 5) làm khoảng 80% key đổi server. Với cache → gần như toàn bộ cache miss cùng lúc, DB bị dồn tải.",
   "idea": "Thêm hay bớt một server chỉ ảnh hưởng đoạn vòng giữa server đó và server liền trước. Cách làm: đặt cả server và key lên cùng một vòng hash cố định, key thuộc server gần nhất theo chiều kim đồng hồ.",
   "tradeoff": "Logic routing và vận hành phức tạp hơn modulo: cần thêm virtual node để tải đều và replication để chịu lỗi. Và nó vẫn không giải được hot key."
  },
  "tldr": "Thêm server mới chỉ cướp phần key nằm trong đoạn ngay trước nó — trung bình K/N key, các key khác giữ nguyên chỗ — vì vị trí key trên ring không phụ thuộc số server. Virtual node và replication là bắt buộc: với vài server vật lý các đoạn ring rất lệch nhau, và một server chết thì mất toàn bộ đoạn của nó nếu không có bản sao.",
  "points": [
   {
    "i": 0,
    "key": "**Mục tiêu** — chia dữ liệu ra nhiều ser",
    "why": "Số key phải đổi chỗ khi scale chính là chi phí mỗi lần thêm/bớt máy, vì di chuyển dữ liệu tốn băng thông, còn với cache thì key chuyển chỗ = cache miss. Consistent hashing đưa chi phí đó từ gần 100% xuống ~1/N."
   },
   {
    "i": 1,
    "key": "**Data imbalance → Virtual nodes** — mỗi",
    "why": "Vị trí mỗi server trên ring là ngẫu nhiên, nên với 3 server các khoảng có thể chênh nhau vài lần (một server ôm 50% ring). Băm mỗi server thành vài trăm điểm → mỗi server sở hữu nhiều đoạn nhỏ rải khắp ring, theo luật số lớn tổng các đoạn tiến về 1/N. Thêm nữa, khi một server chết, tải của nó rải ra nhiều server thay vì dồn hết vào một láng giềng."
   },
   {
    "i": 2,
    "key": "**Replication** — key nằm ở server đầu t",
    "why": "Mọi node tự tính được bản sao nằm đâu mà không cần bảng tra cứu, vì key đã có server 「chủ」 xác định trên ring và quy tắc chỉ là đi tiếp theo chiều kim đồng hồ. Server chủ chết thì server kế tiếp vốn đã có bản sao, vừa là chủ mới vừa phục vụ được ngay (dùng vnode thì phải bỏ qua các vnode cùng máy vật lý để bản sao nằm trên máy khác)."
   },
   {
    "i": 3,
    "key": "**Data movement thực tế** — dữ liệu khôn",
    "why": "Consistent hashing chỉ trả lời 「key giờ thuộc ai」, dữ liệu vẫn phải chép qua mạng. Với cache, mất bản sao chỉ là miss → server mới cứ rỗng rồi đầy dần từ DB; với DB, dữ liệu là bản gốc → phải stream sang server mới trong nền, trong lúc đó server cũ vẫn phục vụ để không gián đoạn."
   },
   {
    "i": 4,
    "key": "**Hot key** — consistent hashing chia đề",
    "why": "Một key dù nhận 1M request/s vẫn chỉ có một chủ → server đó quá tải trong khi các server khác rảnh, vì ring chỉ quyết định key nằm ở đâu. Key salting biến một key thành k key (`hotkey_1..k`) ở k vị trí khác nhau trên ring, chia tải ra k server; local cache trong app thì chặn hẳn request trước khi tới server."
   }
  ],
  "sections": []
 },
 "cap": {
  "story": {
   "problem": "Hệ phân tán giữ nhiều bản sao trên nhiều máy, và mạng giữa chúng có thể đứt → lúc đó node nhận request không biết bản sao kia đã có ghi mới hay chưa.",
   "idea": "Lúc mạng đứt chỉ có hai lựa chọn, và thiết kế phải chọn trước cho từng loại dữ liệu: từ chối trả lời để không trả dữ liệu cũ (Consistency), hoặc trả lời bằng dữ liệu mình có dù có thể cũ (Availability).",
   "tradeoff": "Chọn C thì có lúc hệ trả lỗi hoặc treo; chọn A thì user có thể thấy dữ liệu cũ, hoặc hai bên ghi xung đột cần merge sau."
  },
  "tldr": "P không phải lựa chọn: trong hệ nhiều máy, mạng đứt chắc chắn xảy ra, nên câu hỏi thật chỉ còn C hay A lúc đứt mạng. **Availability** là mặc định vì đa số dữ liệu (feed, like, profile) cũ vài giây không hại ai; còn đặt vé hay tồn kho mà đọc dữ liệu cũ là bán trùng, thiệt hại tiền thật → phải chấp nhận từ chối request.",
  "points": [
   {
    "i": 0,
    "key": "**Partition Tolerance** — hệ phân tán bu",
    "why": "Với hệ phân tán, bỏ P là không có thật — hệ 「CA」 chỉ tồn tại khi chạy trên một máy. Switch hỏng, GC pause dài hay mất kết nối giữa hai DC đều khiến node không liên lạc được nhau, và hệ không thể ngăn chúng xảy ra."
   },
   {
    "i": 1,
    "key": "Có thể chọn **khác nhau theo từng phần**",
    "why": "Tách hai luồng ra thì chỉ trả giá latency/availability ở đúng chỗ cần, vì cái giá của dữ liệu cũ khác nhau theo từng chức năng: xem trang sự kiện thấy số ghế trễ vài giây là vô hại và cần chịu tải lớn, còn bước giữ ghế mà đọc cũ thì hai người mua trùng một ghế."
   },
   {
    "i": 2,
    "key": "**PACELC** mở rộng: khi không có partiti",
    "why": "Kể cả khi mạng bình thường vẫn có đánh đổi: muốn đọc luôn thấy bản mới thì mỗi lần ghi phải chờ replica xác nhận, tức thêm round-trip mạng. CAP chỉ nói lúc có sự cố; PACELC chỉ ra rằng 99% thời gian còn lại bạn vẫn đang đổi latency lấy consistency."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Strong",
    "why": "Không ai đọc được bản cũ, vì mọi lần ghi phải được leader hoặc quorum xác nhận trước khi trả về, và lần đọc cũng đi qua đó. Cái giá là latency cao hơn và mất availability khi không liên lạc đủ node — đáng trả cho số dư hay ghế ngồi, vì đọc cũ ở đây là bán trùng."
   },
   {
    "row": 1,
    "key": "Causal",
    "why": "Tránh được cảnh thấy câu trả lời trước câu hỏi mà vẫn rẻ hơn strong: hệ theo dõi quan hệ phụ thuộc (comment trả lời 「phụ thuộc」 comment gốc), replica chỉ hiện thao tác sau khi đã có đủ thao tác nó phụ thuộc; các thao tác không liên quan thì không cần chờ nhau."
   },
   {
    "row": 2,
    "key": "Read-your-own-writes",
    "why": "Người vừa sửa profile mà reload thấy dữ liệu cũ sẽ tưởng thao tác thất bại và sửa lại. Chỉ cần định tuyến đọc của chính user đó về primary (hoặc replica đã bắt kịp version vừa ghi) trong một khoảng ngắn; người khác vẫn đọc replica bình thường."
   },
   {
    "row": 3,
    "key": "Eventual",
    "why": "Ghi nhanh và hệ vẫn chạy khi mạng đứt, vì replica nhận ghi rồi lan truyền bất đồng bộ, không ai phải chờ ai. Like count lệch vài giây hay feed tạm thiếu một bài thì không ai nhận ra → đổi lấy latency thấp và availability cao là hời."
   }
  ],
  "sections": []
 },
 "numbers": {
  "story": {
   "problem": "Không có con số trong đầu thì ước lượng toàn cảm tính: thấy 「1 triệu user」 là vội shard DB, thêm Kafka và cache, thiết kế phức tạp gấp mấy lần cần thiết.",
   "idea": "Thuộc vài con số bậc độ lớn (throughput mỗi thành phần, latency mỗi tầng lưu trữ, số giây trong ngày) là biết ngay cần bao nhiêu máy: chia tải ước lượng cho năng lực một node.",
   "tradeoff": "Con số chỉ đúng bậc độ lớn và phụ thuộc phần cứng, kích thước bản ghi, độ phức tạp query — dùng để ra quyết định thô, không thay cho benchmark thật."
  },
  "tldr": "Thuộc năng lực một node thì một phép chia là ra câu trả lời, vì quyết định shard hay cache chỉ là so sánh tải ước lượng với năng lực đó. Ví dụ 100M request/ngày ≈ 1.2k req/s, nằm gọn trong sức một Postgres.",
  "points": [
   {
    "i": 0,
    "key": "Đừng shard khi 1 Postgres còn chịu được",
    "why": "Phần lớn hệ thống thực tế chưa cần shard: một Postgres với SSD và RAM lớn chịu được hàng chục nghìn TPS và vài TB, mà tải thực tế thường thấp hơn thế nhiều. Shard sớm là trả ngay chi phí cross-shard query, migration và vận hành mà không được gì; dùng read replica và cache trước thường đủ."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Redis (1 node)",
    "why": "Redis giữ toàn bộ dữ liệu trong RAM và xử lý lệnh trên một luồng chính bằng event loop → không tốn chi phí lock, mỗi lệnh chỉ là thao tác cấu trúc dữ liệu trong bộ nhớ. Vì thế latency chủ yếu là round-trip mạng, còn dung lượng bị giới hạn bởi RAM của máy."
   },
   {
    "row": 1,
    "key": "PostgreSQL / MySQL (1 node tốt)",
    "why": "Chậm hơn Redis 1–2 bậc, vì mỗi transaction phải ghi WAL xuống disk (fsync) để bền vững, giữ lock và cập nhật index. Dữ liệu nằm trên disk nên chứa được vài TB, nhưng khi working set vượt RAM thì nhiều lần đọc phải xuống disk và throughput giảm."
   },
   {
    "row": 2,
    "key": "Kafka (1 broker)",
    "why": "Throughput gần bằng băng thông disk/mạng, vì Kafka chỉ append tuần tự vào log trên disk, dựa vào page cache của OS và zero-copy (`sendfile`) để đẩy byte từ disk ra mạng không qua user space, cộng batching nhiều message một lần. Scale bằng cách thêm partition và broker."
   },
   {
    "row": 3,
    "key": "App server",
    "why": "Server dùng async/event loop hoặc nhiều thread giữ được hàng nghìn request đang chờ cùng lúc, vì phần lớn thời gian của một request là chờ I/O (DB, service khác). Giới hạn thực tế đến từ RAM mỗi kết nối và CPU cho phần xử lý thật."
   },
   {
    "row": 4,
    "key": "Đọc RAM / SSD / mạng cùng DC",
    "why": "Cache in-process thắng Redis khi cần cực nhanh, và gọi mạng tuần tự 100 lần đã mất 50ms. Lý do: RAM local ~100ns, đọc SSD ngẫu nhiên ~100µs, round-trip mạng tới Redis ~500µs — tức gọi Redis chậm hơn đọc RAM local khoảng 5,000 lần, thậm chí chậm hơn một lần đọc SSD."
   },
   {
    "row": 5,
    "key": "1 ngày",
    "why": "Chia số request mỗi ngày cho 10⁵ là ra QPS trung bình, vì 86,400 xấp xỉ 10⁵: 10⁶ / 86,400 ≈ 11.6, làm tròn 12. Nhớ nhân thêm 2–10 lần cho giờ cao điểm vì traffic không trải đều cả ngày."
   }
  ],
  "sections": []
 },
 "patterns": {
  "story": {
   "problem": "Bài system design nào cũng trông mới lạ; thiết kế lại từ đầu mỗi lần thì dễ sót vấn đề cốt lõi và hết giờ phỏng vấn.",
   "idea": "Nhận ra vấn đề là gọi được lời giải đã kiểm chứng, vì phần lớn bài toán lặp lại cùng một số vấn đề (đẩy realtime, việc chạy lâu, tranh chấp ghi, đọc nhiều, ghi nhiều, file lớn, giao dịch nhiều bước, tìm gần).",
   "tradeoff": "Áp pattern máy móc dễ thêm thành phần không cần. Mỗi pattern có chi phí riêng (lock giảm throughput, saga phức tạp, replica có lag), nên phải nói được vì sao dùng và đánh đổi gì."
  },
  "tldr": "Vấn đề lặp lại thì lời giải cũng lặp lại, vì các ràng buộc vật lý (mạng, disk, lock, timeout HTTP) giống nhau ở mọi hệ thống. Nhận đúng vấn đề giúp bạn đi thẳng vào phần khó và dành thời gian nói trade-off — phần interviewer thực sự chấm.",
  "points": [
   {
    "i": 0,
    "key": "**Optimistic locking** — mọi người cùng ",
    "why": "Không khoá lúc đọc nên mọi người chạy song song, không chờ nhau; lệnh `UPDATE ... SET version = v+1 WHERE version = v` chỉ thành công cho người ghi đầu tiên, người sau thấy 0 dòng bị ảnh hưởng và phải đọc lại. Xung đột hiếm thì gần như không ai phải làm lại; xung đột dày thì retry liên tục, phí công."
   },
   {
    "i": 1,
    "key": "**Pessimistic locking** — khoá dòng, ngư",
    "why": "Không bao giờ có lost update, vì `SELECT ... FOR UPDATE` giữ lock tới khi transaction kết thúc, không ai khác ghi chen được. Nhưng mỗi người chờ đều giữ một kết nối DB, và transaction dài làm cả hàng đợi kéo dài → dễ cạn connection pool hoặc deadlock khi tranh chấp cao."
   },
   {
    "i": 2,
    "key": "**Read replicas** — mọi lệnh ghi đi qua",
    "why": "Chỉ một node nhận ghi nên không có xung đột ghi, còn đọc nhân ra nhiều replica. Replica nhận thay đổi bất đồng bộ qua log replication nên luôn trễ vài ms đến vài giây → đọc ngay sau khi ghi có thể thấy dữ liệu cũ."
   },
   {
    "i": 3,
    "key": "**Geohash** — biến (lat, long) thành chu",
    "why": "Tìm gần trở thành query prefix (`LIKE 'w3gv%'`) — loại query B-Tree trên chuỗi xử lý tốt. Lý do: geohash chia bản đồ đệ quy, mỗi ký tự thêm vào thu nhỏ ô đang chứa điểm, nên hai điểm cùng nằm trong một ô có chung prefix. Lưu ý: điểm sát biên ô có prefix khác nên phải tra thêm 8 ô láng giềng."
   },
   {
    "i": 4,
    "key": "**Quadtree** — chia bản đồ thành ô vuông",
    "why": "Quadtree chỉ chia nhỏ ô khi số điểm vượt ngưỡng → mỗi ô lá chứa số điểm tương đương nhau, tìm kiếm tốn thời gian ổn định. Lưới cố định không làm được vậy vì mật độ dữ liệu không đều (trung tâm thành phố dày, nông thôn thưa): có ô chứa hàng nghìn điểm, có ô rỗng."
   },
   {
    "i": 5,
    "key": "**Saga choreography** — mỗi service nghe",
    "why": "Choreography không có ai nắm toàn bộ luồng: thêm service chỉ cần subscribe event nên ít phụ thuộc, nhưng muốn biết một đơn đang ở bước nào phải ghép event từ nhiều nơi. Orchestration gom logic luồng vào một chỗ nên dễ debug và thêm bước; đổi lại orchestrator thành điểm phụ thuộc và phải được làm bền vững."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Realtime Updates",
    "why": "SSE và WebSocket giữ kết nối mở nên server đẩy được ngay khi có dữ liệu — với HTTP thường, client hỏi rồi server mới trả, server không tự gửi được. Nhưng mỗi kết nối chỉ gắn với một server, nên khi sự kiện phát sinh ở server khác cần Pub/Sub (Redis, Kafka) để mọi server nhận rồi đẩy xuống đúng client của mình."
   },
   {
    "row": 1,
    "key": "Long-Running Tasks",
    "why": "Việc chạy hàng phút không thể giữ chung một request, vì load balancer và client thường timeout HTTP sau 30–60s. Đẩy job vào queue và trả job ID ngay → request kết thúc trong vài ms, worker xử lý độc lập, retry được khi lỗi, scale bằng cách thêm worker."
   },
   {
    "row": 2,
    "key": "Dealing with Contention",
    "why": "Nhiều người cùng đọc-rồi-ghi một dòng gây lost update (hai người cùng thấy còn 1 ghế, cùng mua). Pessimistic lock bắt xếp hàng nên đúng nhưng chậm; optimistic lock kiểm version lúc ghi nên rẻ khi ít xung đột; tài nguyên trải qua nhiều service/DB thì cần distributed lock, kèm fencing token để chặn client giữ lock đã hết hạn mà vẫn ghi."
   },
   {
    "row": 3,
    "key": "Scaling Reads",
    "why": "Đọc không làm thay đổi dữ liệu nên nhân bản ra nhiều chỗ được mà không cần phối hợp: replica chia tải đọc, cache trả từ RAM, CDN trả ngay tại edge gần user. Index giảm số dòng phải quét, denormalize bỏ JOIN → mỗi lần đọc rẻ hơn."
   },
   {
    "row": 4,
    "key": "Scaling Writes",
    "why": "Replica không giúp được ghi vì mọi ghi phải đi qua primary, nên phải chia dữ liệu để mỗi máy chỉ nhận một phần ghi (sharding). LSM-Tree biến ghi ngẫu nhiên thành ghi tuần tự (memtable rồi flush SSTable), nhanh hơn nhiều so với cập nhật B-Tree tại chỗ; batching gom nhiều ghi nhỏ thành một lần I/O."
   },
   {
    "row": 5,
    "key": "Handling Large Blobs",
    "why": "Đẩy file GB qua app server chiếm băng thông, RAM và luồng xử lý của chính server phục vụ API. Presigned URL cho client upload/download thẳng với S3 mà không lộ credential; multipart chia file thành phần nhỏ để upload song song và retry riêng phần lỗi; CDN phục vụ lượt tải từ edge."
   },
   {
    "row": 6,
    "key": "Multi-Step Processes",
    "why": "Không có transaction ACID nào bao trùm được nhiều service, vì mỗi microservice có DB riêng (2PC qua mạng thì chậm và khoá lâu). Saga chia thành chuỗi transaction cục bộ, bước nào lỗi thì chạy compensating action đảo ngược các bước đã xong (hoàn tiền, trả ghế); workflow engine lưu trạng thái từng bước để resume sau khi crash."
   },
   {
    "row": 7,
    "key": "Proximity-Based Services",
    "why": "Index B-Tree thường chỉ sắp theo một chiều, nên query 「lat trong khoảng và long trong khoảng」 vẫn phải quét cả dải. Geohash và Quadtree biến không gian 2 chiều thành ô có thứ bậc → tìm gần chỉ là tra vài ô quanh vị trí; Redis Geo và PostGIS là cài đặt có sẵn của các ý tưởng này."
   }
  ],
  "sections": []
 },
 "queue": {
  "story": {
   "problem": "API gọi đồng bộ thẳng vào service xử lý chậm (gửi email, transcode video) thì một đợt spike 10x làm service đó quá tải, request timeout dây chuyền ngược lên user. Producer và consumer bị buộc phải sống, chết và scale cùng nhau.",
   "idea": "Đặt một bộ đệm bền vững ở giữa: producer chỉ cần ghi message vào queue rồi trả lời ngay, consumer kéo việc ra theo tốc độ của chính nó → hai bên tách rời về thời gian, tốc độ và số lượng instance.",
   "tradeoff": "Xử lý thành bất đồng bộ nên user không nhận kết quả ngay, phải có cơ chế poll/notify. Hệ thống phải chịu message trùng (at-least-once), sai thứ tự giữa partition, và thêm một thành phần cần vận hành, giám sát lag."
  },
  "tldr": "Producer không phải chờ consumer vì queue lưu message bền vững, và traffic đột biến chỉ làm queue dài ra thay vì làm sập worker. 5 chủ đề kia chính là những gì phát sinh khi tách rời: thứ tự, lỗi, message hỏng, song song hoá và consumer chạy chậm.",
  "points": [
   {
    "i": 0,
    "key": "**Usage** — phân phối công việc trong hệ",
    "why": "N worker tự cân tải mà không cần ai phân việc, vì worker kéo việc từ queue khi rảnh; thêm worker là tăng throughput. Khi spike, queue hấp thụ phần dư: 10.000 request/s vào mà worker chỉ xử lý 2.000/s thì backlog tăng tạm thời rồi xả dần, không request nào bị rơi."
   },
   {
    "i": 1,
    "key": "**Message ordering** — FIFO chỉ đảm bảo ",
    "why": "Chỉ trong một partition message mới được đọc tuần tự theo offset — nhiều consumer đọc song song từ nhiều partition thì không có đồng hồ chung nào xếp thứ tự toàn cục. Muốn các event của cùng order giữ thứ tự thì phải cho chúng chung partition key / message group id."
   },
   {
    "i": 2,
    "key": "**Retry mechanisms** — retry với exponen",
    "why": "Backoff 1s, 2s, 4s… cho downstream thời gian hồi phục, vì lỗi thường là tạm thời (DB timeout, rate limit) và retry ngay lập tức chỉ dồn thêm tải. Retry nghĩa là cùng message có thể được xử lý 2 lần (đã ghi DB nhưng chưa kịp ack), nên consumer phải idempotent, ví dụ check `message_id` đã xử lý chưa."
   },
   {
    "i": 3,
    "key": "**Dead Letter Queue** — message lỗi quá ",
    "why": "Một message hỏng (poison message, sai format) lỗi mãi; cứ retry thì nó chiếm worker và, với queue FIFO, chặn mọi message phía sau. Sau N lần thất bại, đẩy nó sang DLQ → hàng chính chạy tiếp, message lỗi được giữ lại để debug và replay sau khi fix."
   },
   {
    "i": 4,
    "key": "**Scaling with partitions** — chia queue",
    "why": "Một queue đơn bị giới hạn bởi throughput của một node, và chỉ một consumer đọc tuần tự mới giữ được thứ tự. Chia thành P partition thì P consumer chạy song song; partition key quyết định message nào chung partition, nên cũng quyết định nhóm message nào được giữ thứ tự với nhau."
   },
   {
    "i": 5,
    "key": "**Backpressure** — khi consumer chậm hơn",
    "why": "Producer ghi 5.000 msg/s mà consumer chỉ xử lý 3.000 msg/s → queue tăng 2.000 msg/s đến khi hết bộ nhớ/đĩa hoặc độ trễ lên hàng giờ. Phải có tín hiệu đẩy ngược: chặn queue size để producer bị từ chối/chậm lại, hoặc scale consumer theo queue depth để đuổi kịp."
   },
   {
    "i": 6,
    "key": "Công nghệ: SQS, RabbitMQ (queue); Kafka ",
    "why": "SQS và RabbitMQ xoá message sau khi consumer ack — hợp cho phân phối việc một lần. Kafka giữ message trên log theo retention, mỗi consumer group tự giữ offset, nên vừa làm queue (một group) vừa cho replay và fan-out nhiều group."
   },
   {
    "i": 7,
    "key": "Delivery semantics: at-most-once, **at-l",
    "why": "Ack và xử lý không thể atomic trên mạng: ack trước rồi crash thì mất message (at-most-once), xử lý trước rồi crash trước khi ack thì message bị giao lại (at-least-once). **At-least-once** phổ biến vì mất dữ liệu tệ hơn trùng, và trùng thì xử lý được bằng idempotency; exactly-once cần transaction phối hợp giữa queue và nơi ghi kết quả nên chậm và chỉ chạy trong phạm vi hẹp (ví dụ Kafka transactions read-process-write trong Kafka)."
   }
  ],
  "sections": []
 },
 "streams": {
  "story": {
   "problem": "Queue thường xoá message sau khi một consumer đọc → thêm service thứ hai cần cùng event thì phải sửa producer để gửi thêm, còn dữ liệu cũ đã mất. Consumer có bug thì không có cách xử lý lại các event của hôm qua.",
   "idea": "Coi dữ liệu là một append-only log bền vững: mọi event ghi tuần tự và giữ theo retention, mỗi consumer group chỉ nhớ vị trí (offset) của mình. Đọc không làm thay đổi log → bao nhiêu consumer cũng được và tua lại được.",
   "tradeoff": "Tốn storage vì giữ event nhiều ngày, và thứ tự chỉ có trong partition. Event Sourcing còn làm query trạng thái hiện tại khó hơn (phải fold hoặc dựng projection), và schema event cũ phải được hỗ trợ mãi."
  },
  "tldr": "Nhiều hệ thống đọc cùng event độc lập và đọc lại được từ đầu, vì log không bị xoá khi đọc và offset thuộc về từng consumer group. Event Sourcing tận dụng đúng tính chất đó: lưu đủ event thì trạng thái là hàm của event, lúc nào cũng tính lại được.",
  "points": [
   {
    "i": 0,
    "key": "**Khác queue** — message không bị xoá sa",
    "why": "Queue xoá message khi ack nên chỉ phục vụ được một nhóm đọc. Stream chỉ lưu con trỏ offset cho mỗi consumer group, log vẫn nguyên → group analytics và group billing đọc cùng event với tốc độ riêng, và đặt offset về 0 là replay được."
   },
   {
    "i": 1,
    "key": "**Dùng khi** — xử lý realtime (analytics",
    "why": "Stream đưa event tới ngay khi ghi — đúng thứ fraud detection hay analytics cần, vì chúng cần event trong vài giây, không đợi batch đêm. Một event `OrderPlaced` cần tới inventory, email, analytics: publish một lần, mỗi service là một consumer group, producer không cần biết ai đọc. Replay hữu ích khi deploy fix bug hoặc dựng service mới cần dữ liệu lịch sử."
   },
   {
    "i": 2,
    "key": "**Event Sourcing** — trạng thái = fold c",
    "why": "Chỉ lưu event bất biến, nên trạng thái số dư = fold `Deposited(+100)`, `Withdrawn(-30)` → 70: luôn biết vì sao số dư là 70 (audit) và dựng lại được nếu bảng trạng thái hỏng. Nhưng tài khoản có 1 triệu event thì fold mỗi lần đọc quá chậm → lưu snapshot định kỳ, chỉ fold phần event sau snapshot."
   },
   {
    "i": 3,
    "key": "Stream processing: Flink, Kafka Streams,",
    "why": "Trả lời 'bao nhiêu click trong 5 phút qua' cần gom event theo cửa sổ thời gian và giữ state giữa các event — đọc từng event thì chưa đủ. Các engine này quản lý window, state và checkpoint thay ta, nên aggregation trên luồng vô hạn vẫn chịu lỗi được."
   }
  ],
  "sections": []
 },
 "dist-lock": {
  "story": {
   "problem": "Lock trong process (`mutex`) chỉ có tác dụng trong một server; với 10 instance, hai instance vẫn có thể cùng bán chiếc ghế cuối cùng hoặc cùng chạy một cron job. Cần một nơi chung mà mọi instance hỏi trước khi đụng vào tài nguyên.",
   "idea": "Dùng một hệ lưu trữ chung có thao tác atomic (Redis `SET NX`, row lock của DB) làm trọng tài: ai tạo được key trước thì giữ lock. Gắn TTL để lock tự nhả khi holder chết.",
   "tradeoff": "TTL tạo cửa sổ nguy hiểm: holder chậm hơn TTL vẫn tưởng mình giữ lock. Mỗi lần lock thêm một round-trip mạng, và trọng tài (Redis/DB) thành điểm phụ thuộc."
  },
  "tldr": "Chỉ một client thắng, vì `SET key NX PX ttl` chỉ thành công khi key chưa tồn tại và Redis chạy lệnh tuần tự; `FOR UPDATE` thì dựa vào row lock của DB. Mọi lock dựa trên TTL (Redlock hay một node) đều giả định holder xong việc trước khi hết hạn — GC pause hay network delay phá giả định đó, nên resource phải tự kiểm tra bằng **fencing token**.",
  "points": [
   {
    "i": 0,
    "key": "**Database lock** — `SELECT ... FOR UPDA",
    "why": "Transaction khác đọc `FOR UPDATE` cùng dòng phải chờ tới khi commit/rollback, vì row lock do chính DB quản lý trong transaction. Không cần hạ tầng thêm và lock tự nhả khi connection chết; nhưng phải giữ connection suốt thời gian lock và gây contention nếu giữ lâu."
   },
   {
    "i": 1,
    "key": "**Redis lock (Redlock)** — lấy lock có T",
    "why": "Một node Redis chết thì lock mất, hoặc failover sang replica chưa kịp sync khiến hai client cùng giữ lock. Redlock ghi lock lên N node độc lập (ví dụ 5), chỉ coi là thành công khi đa số (≥3) chấp nhận trong thời gian ngắn hơn TTL → chịu được thiểu số node chết."
   },
   {
    "i": 2,
    "key": "**Vấn đề** — Server A lấy lock TTL 10s, ",
    "why": "Kiểm tra 'tôi còn giữ lock' ở phía client luôn có race — mọi cơ chế lock chỉ dựa trên TTL đều mắc lỗi này. Lock hết hạn theo đồng hồ của Redis, còn A không có cách nào biết mình đã bị pause 11s: từ góc nhìn của A, dòng code tiếp theo chạy ngay sau khi kiểm tra lock."
   },
   {
    "i": 3,
    "key": "**Fencing token** — số tăng dần cấp mỗi ",
    "why": "Client không tự biết mình đã mất lock, nên phải chuyển phần kiểm tra sang phía resource. A lấy token 33, B lấy sau nhận token 34 và ghi trước; resource nhớ 34, nên khi A tỉnh dậy gửi token 33 sẽ bị từ chối, dữ liệu không hỏng."
   },
   {
    "i": 4,
    "key": "Dùng cho: giữ ghế tạm thời khi checkout ",
    "why": "Giữ ghế cần lock có TTL: user giữ ghế 10 phút, bỏ ngang thì TTL tự nhả cho người khác mua. Với job, lock theo `job_id` bảo đảm dù nhiều worker cùng thấy job, chỉ một người chạy nó."
   }
  ],
  "sections": []
 },
 "dist-cache": {
  "story": {
   "problem": "Cache trong RAM của từng instance thì mỗi instance có bản riêng: user cập nhật profile qua instance A, instance B vẫn trả bản cũ; hit rate thấp vì mỗi instance phải tự warm. DB thì gánh toàn bộ read, latency vài ms đến chục ms mỗi query.",
   "idea": "Tách cache thành một cụm riêng dùng chung (Redis/Memcached) nằm trong RAM: mọi instance đọc/ghi cùng một bản, đọc chỉ ~<1ms. Warm một lần là phục vụ toàn bộ fleet.",
   "tradeoff": "Thêm một network hop và một hệ thống cần vận hành; invalidation sai thì dữ liệu lệch DB (stale); RAM đắt nên phải chọn eviction policy hợp lý."
  },
  "tldr": "Ghi/xoá ở một nơi là mọi instance đều thấy, hết lệch giữa các bản local — vì mọi instance chia sẻ cùng một cache. Nhưng cache vẫn là bản sao của DB, nên luôn phải trả lời ba câu: ghi thế nào, khi nào xoá bản cũ, đầy RAM thì bỏ gì.",
  "points": [
   {
    "i": 0,
    "key": "**Write strategy** — Write-Through, Writ",
    "why": "Write-Through ghi cache và DB cùng lúc → cache luôn mới, nhưng mọi write chậm thêm và cache chứa cả dữ liệu không ai đọc. Write-Around chỉ ghi DB, cache lấp khi đọc miss → phải xoá key hoặc đặt TTL ngắn để bản cũ không sống lâu. Write-Back ghi cache rồi flush DB sau → write rất nhanh, nhưng cache chết trước khi flush là mất dữ liệu."
   },
   {
    "i": 1,
    "key": "**Invalidation strategy** — cách giữ cac",
    "why": "Không ai xoá/cập nhật key thì cache trả bản cũ tới khi TTL hết, vì nó không tự biết DB đã đổi. Cách phổ biến: xoá key sau khi ghi DB (cache-aside) kèm TTL làm lưới an toàn, hoặc nghe CDC để invalidate khi có thay đổi từ nguồn khác."
   },
   {
    "i": 2,
    "key": "**Eviction** — LRU, LFU, FIFO.",
    "why": "RAM có hạn nên khi đầy phải chọn key bỏ đi. LRU bỏ key lâu nhất chưa dùng, hợp với truy cập có tính thời gian gần; LFU bỏ key ít dùng nhất, chống được một lần scan lớn đẩy bay key hot; FIFO đơn giản nhưng có thể bỏ key đang hot."
   },
   {
    "i": 3,
    "key": "Redis còn dùng làm: rate limiter (counte",
    "why": "Redis chạy lệnh tuần tự trên một thread nên mỗi lệnh atomic mà không cần lock — đúng thứ các use case này cần: thao tác atomic, nhanh trên state dùng chung. `INCR` + `EXPIRE` cho counter rate limit, sorted set giữ thứ hạng với `ZADD`/`ZRANGE` O(log n), `SET NX` cho lock, `GEOSEARCH` tìm điểm trong bán kính."
   }
  ],
  "sections": []
 },
 "blob": {
  "story": {
   "problem": "Lưu ảnh, video vào DB làm bảng phình hàng TB, backup/replication chậm, mỗi GB tính theo giá storage SSD của DB. Upload mà đi qua backend thì mỗi video 2GB chiếm băng thông và connection của app server suốt thời gian upload.",
   "idea": "Tách byte khỏi metadata: file nằm trong object store phẳng (key → bytes) thiết kế cho durability và giá rẻ, DB chỉ giữ key/URL. Client nói chuyện thẳng với object store bằng URL ký sẵn.",
   "tradeoff": "Không có transaction giữa DB và blob → có thể có file mồ côi, hoặc metadata trỏ tới file chưa upload xong. Object không sửa được một phần (phải ghi lại cả object), và latency từng request cao hơn đĩa local."
  },
  "tldr": "Provider chia được dữ liệu ra hàng nghìn máy, dùng erasure coding và đĩa rẻ, vì object storage chỉ cần get/put theo key, không có index hay transaction phức tạp. DB giữ metadata vì cần query/transaction; presigned URL cho client đi thẳng tới S3 nên backend không phải chuyển byte.",
  "points": [
   {
    "i": 0,
    "key": "**Cách dùng** — upload blob, nhận về URL",
    "why": "Mỗi object có URL ổn định nên đặt làm origin cho CDN được: lần đầu edge kéo từ S3, các lần sau user ở Singapore tải từ edge Singapore thay vì đi tới region Mỹ."
   },
   {
    "i": 1,
    "key": "**Durability** — replication và erasure ",
    "why": "S3 công bố durability 11 số 9 nhờ mỗi object được chia mảnh và lưu dư trên nhiều đĩa ở nhiều AZ. Erasure coding (ví dụ 10 mảnh data + 4 mảnh parity) cho phép mất bất kỳ 4 mảnh vẫn dựng lại được, với chi phí lưu ~1.4x thay vì 3x như replication."
   },
   {
    "i": 2,
    "key": "**Scalability** — lưu và phục vụ lượng d",
    "why": "Không có điểm nghẽn chung nào, vì namespace phẳng theo key: dữ liệu chia partition theo prefix key và trải ra rất nhiều node, tải tăng thì provider tách thêm partition; không có JOIN hay index toàn cục."
   },
   {
    "i": 3,
    "key": "**Security** — mã hoá at rest và in tran",
    "why": "Mã hoá in transit (TLS) chặn nghe lén trên mạng; mã hoá at rest (SSE-S3, SSE-KMS) bảo đảm đĩa bị lấy ra khỏi datacenter cũng không đọc được. Kết hợp IAM/bucket policy để mặc định object là private."
   },
   {
    "i": 4,
    "key": "**Upload / download trực tiếp từ client*",
    "why": "Backend không bị nghẽn băng thông và không cần scale theo dung lượng file, vì nó chỉ xử lý một request nhỏ thay vì truyền 2GB: cấp một URL có chữ ký, giới hạn quyền (PUT key cụ thể), hết hạn sau vài phút, rồi client gửi byte thẳng tới S3."
   },
   {
    "i": 5,
    "key": "**Chunking** — chia file lớn thành phần ",
    "why": "Upload file 5GB bằng một request thì mạng chập chờn ở 90% là phải làm lại từ đầu. Chia thành part 100MB → part lỗi chỉ retry part đó, các part upload song song để tận dụng băng thông, S3 ghép lại khi complete."
   },
   {
    "i": 6,
    "key": "**Cost** — rẻ hơn DB nhiều lần mỗi GB; c",
    "why": "S3 Standard khoảng $0.023/GB-tháng, trong khi storage DB managed đắt hơn nhiều lần và còn nhân thêm bản replica, backup. Dữ liệu ít đọc chuyển sang Glacier còn rẻ hơn, đổi lại thời gian lấy ra từ phút đến giờ."
   }
  ],
  "sections": []
 },
 "search": {
  "story": {
   "problem": "`LIKE '%phone%'` buộc DB scan toàn bảng vì wildcard đầu khiến B-Tree index không dùng được: 100 triệu dòng là vài giây đến vài chục giây, và chạy trên DB chính làm chậm mọi query khác. Nó cũng không biết 'phones' khớp 'phone', không xếp hạng kết quả theo độ liên quan.",
   "idea": "Tiền xử lý văn bản lúc ghi: tách từ, chuẩn hoá, rồi xây inverted index từ → danh sách document. Lúc tìm chỉ tra từ khoá trong index → độ phức tạp theo số kết quả chứ không theo kích thước dữ liệu.",
   "tradeoff": "Phải duy trì thêm một hệ thống và một pipeline đồng bộ; dữ liệu search trễ hơn DB vài giây. Index tốn thêm storage, không phải nguồn sự thật, không có transaction."
  },
  "tldr": "Inverted index tìm document chứa một từ bằng một lần tra cứu thay vì quét mọi dòng; tokenization và stemming quyết định 'từ' vào index ở dạng nào để query khớp được. `LIKE '%x%'` không có index nào hỗ trợ nên luôn full scan trên DB chính.",
  "points": [
   {
    "i": 0,
    "key": "**Inverted index** — map từ → danh sách ",
    "why": "Index kiểu B-Tree sắp theo giá trị cả cột nên chỉ hỗ trợ tìm theo prefix. Inverted index lật ngược quan hệ: từ 'phone' tra ngay ra `[doc1, doc7]`; query nhiều từ chỉ là giao/hợp các posting list đã sắp sẵn."
   },
   {
    "i": 1,
    "key": "**Tokenization** — tách đoạn văn thành t",
    "why": "Phải chia văn bản thành từ trước khi index, vì inverted index lưu theo từ: 'iPhone 15 Pro Max' → `iphone`, `15`, `pro`, `max`. Query cũng đi qua cùng analyzer, nhờ vậy hai bên khớp nhau."
   },
   {
    "i": 2,
    "key": "**Stemming** — đưa từ về gốc: “running”,",
    "why": "Index 'running' nguyên dạng thì query 'run' không khớp. Đưa cả lúc index lẫn lúc query về gốc 'run' → các biến thể rơi vào cùng một entry, tăng recall mà không cần liệt kê mọi biến thể."
   },
   {
    "i": 3,
    "key": "**Fuzzy search** — khớp gần đúng, chịu l",
    "why": "User gõ 'iphnoe' thì tra chính xác ra rỗng. Fuzzy query tìm các term trong index cách query ≤ 1–2 phép sửa (thêm/xoá/thay/hoán vị ký tự); term dictionary tổ chức dạng automaton nên không phải so với từng term."
   },
   {
    "i": 4,
    "key": "**Scaling** — shard index ra nhiều node,",
    "why": "Một node không chứa nổi index TB hay không chịu nổi QPS, nên index chia thành shard trên nhiều node; query fan-out tới các shard rồi gộp top kết quả. Replica vừa là bản dự phòng khi node chết, vừa nhân năng lực đọc."
   },
   {
    "i": 5,
    "key": "Đồng bộ từ DB chính sang search index qu",
    "why": "DB chính vẫn là nguồn sự thật; CDC đọc WAL/binlog và đẩy thay đổi sang index, tránh dual-write lệch nhau. Pipeline này bất đồng bộ (cộng refresh interval ~1s của ES), nên vừa ghi xong search chưa thấy ngay, vài giây sau mới đúng."
   }
  ],
  "sections": []
 },
 "lb-gateway-cdn": {
  "story": {
   "problem": "Một server không chịu nổi toàn bộ traffic, và chết là sập hệ thống; client cũng không nên biết IP của từng instance. Với microservice, mỗi service tự làm auth, rate limit thì lặp code và dễ sót; user ở xa thì mỗi lần tải ảnh mất 200–300ms chỉ vì khoảng cách vật lý.",
   "idea": "Thêm các lớp trung gian trên đường đi của request: LB chia request ra nhiều instance khoẻ mạnh, API Gateway gom các mối quan tâm chung tại một cửa, CDN đưa bản sao nội dung tĩnh tới gần user.",
   "tradeoff": "Mỗi lớp thêm một hop latency và một điểm có thể lỗi/cấu hình sai. CDN gây bài toán cache invalidation; Gateway dễ thành nút cổ chai hoặc bị nhồi business logic."
  },
  "tldr": "LB cho phép scale ngang vì client chỉ thấy một địa chỉ, phía sau thêm bớt instance tuỳ ý. Mọi request đều đi qua Gateway nên đặt auth/rate limit ở đó là đủ cho mọi service; CDN giảm latency vì rút ngắn khoảng cách mạng và chặn request trước khi tới origin.",
  "points": [
   {
    "i": 0,
    "key": "**Dedicated LB · NLB (L4)** — chỉ đọc IP",
    "why": "L4 LB đạt hàng triệu request/giây với latency micro-giây, vì chỉ nhìn header TCP/UDP (IP, port) và chuyển tiếp gói, không cần kết thúc TLS hay parse HTTP → mỗi kết nối tốn rất ít CPU. Đổi lại không định tuyến theo URL được."
   },
   {
    "i": 1,
    "key": "**Dedicated LB · ALB (L7)** — đọc HTTP (",
    "why": "L7 LB kết thúc kết nối HTTP và đọc request, nên gửi được `/api/*` tới service A, `/images/*` tới service B, hay sticky theo cookie. Đổi lại phải parse HTTP, kết thúc TLS → tốn CPU và thêm latency hơn L4."
   },
   {
    "i": 2,
    "key": "**Client-side LB** — service A lấy danh ",
    "why": "Bớt một hop mạng và không có nút cổ chai trung tâm, vì bỏ LB ở giữa — mỗi client tự chia tải. Đổi lại mỗi client phải có thư viện LB và luôn có danh sách instance mới từ Service Discovery; thường dùng cho gọi nội bộ giữa service (gRPC)."
   },
   {
    "i": 3,
    "key": "Thuật toán LB: round robin, least connec",
    "why": "Round robin đơn giản, hợp khi request đồng đều. Least connections gửi tới instance đang ít việc nhất, hợp khi request dài ngắn khác nhau (WebSocket). Consistent hashing map cùng user về cùng instance để tận dụng cache/session local, và thêm bớt node chỉ ~1/N key bị chuyển chỗ."
   },
   {
    "i": 4,
    "key": "**API Gateway** — routing tới microservi",
    "why": "Các việc cắt ngang (xác thực token, giới hạn tần suất, log) làm một lần ở Gateway thay vì lặp ở 20 service, vì mọi request từ ngoài đều đi qua đó. Client chỉ cần biết một domain, Gateway map path tới đúng service."
   },
   {
    "i": 5,
    "key": "**CDN** — cache ảnh, video, JS/CSS ở edg",
    "why": "Edge ở Singapore chỉ vài chục ms, trong khi request Việt Nam → Mỹ tốn ~150–250ms RTT, vì ánh sáng trong cáp quang đi ~200km/ms. Nội dung tĩnh ít đổi nên cache lâu ở edge được → phần lớn request không tới origin, giảm tải và băng thông origin."
   }
  ],
  "sections": []
 },
 "tech-cheatsheet": {
  "story": {
   "problem": "Interviewer hỏi 'sao chọn Cassandra?' mà chỉ đáp 'vì nó scale tốt' thì không chứng minh được hiểu biết. Mỗi công nghệ tối ưu cho một kiểu workload cụ thể nhờ một quyết định thiết kế bên trong.",
   "idea": "Gắn mỗi công nghệ với cơ chế lõi của nó (LSM-tree, inverted index, append-only log…), từ cơ chế suy ra use case và giới hạn. Biết cơ chế là tự trả lời được 'vì sao không dùng cái khác'.",
   "tradeoff": "Mỗi công nghệ thêm vào là thêm chi phí vận hành, đồng bộ dữ liệu và kỹ năng đội ngũ. Hệ thống nhỏ mà chọn quá nhiều công nghệ chuyên biệt thường là over-engineering."
  },
  "tldr": "Ba câu hỏi đó buộc ta nói ra cơ chế: dùng cho việc gì = workload nó tối ưu, vì sao không dùng cái khác = cơ chế khác biệt, giới hạn = cái giá của cơ chế đó. Nói được cơ chế cho thấy hiểu bản chất chứ không thuộc tên.",
  "points": [
   {
    "i": 0,
    "key": "**Dual-write problem** — ghi DB rồi ghi ",
    "why": "Hai lệnh ghi vào hai hệ thống không nằm chung một transaction: DB commit xong mà app crash trước khi publish Kafka thì event mất vĩnh viễn. Outbox ghi event vào bảng outbox trong cùng transaction với dữ liệu, rồi một tiến trình riêng (hoặc CDC) đọc bảng đó để publish → hoặc cả hai cùng có, hoặc cả hai cùng không."
   },
   {
    "i": 1,
    "key": "Chọn DB: bắt đầu từ PostgreSQL; chuyển s",
    "why": "Đổi sớm sang NoSQL là mất JOIN, transaction mà không cần thiết, vì PostgreSQL xử lý được hàng chục nghìn write/s trên một máy tốt và cho query linh hoạt. Chỉ khi write vượt khả năng một primary, hoặc access pattern chỉ theo key, mô hình partition của DynamoDB/Cassandra mới đáng cái giá đó."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "PostgreSQL",
    "why": "Hợp làm mặc định khi access pattern chưa rõ: dữ liệu lưu dạng row với B-Tree index và MVCC + WAL, nên vừa JOIN/query linh hoạt vừa bảo đảm ACID. Mở rộng được bằng read replica cho đọc và partitioning, JSONB/PostGIS cho semi-structured và geo, nên hiếm khi phải đổi sớm."
   },
   {
    "row": 1,
    "key": "DynamoDB",
    "why": "Get/put theo key có latency ổn định ở mọi quy mô và AWS lo scale, vì mỗi item được hash theo partition key tới một partition cố định. Chỉ tra hiệu quả theo key nên query khác phải có GSI; một key quá nóng dồn hết vào một partition (hot partition)."
   },
   {
    "row": 2,
    "key": "Cassandra",
    "why": "Write rất nhanh và rẻ, vì LSM-tree ghi vào memtable + commit log tuần tự rồi flush thành SSTable, không update tại chỗ. Clustering key sắp dữ liệu trong partition theo thời gian, nên 'lấy 50 tin nhắn mới nhất của chat X' là một lần đọc tuần tự; không có JOIN vì dữ liệu phân tán theo partition key."
   },
   {
    "row": 3,
    "key": "Redis",
    "why": "Mỗi thao tác ~sub-ms và tự nhiên atomic (không race giữa `INCR`), vì dữ liệu nằm trong RAM và lệnh chạy tuần tự trên một thread. Data structure có sẵn (sorted set, GEO, list) biến counter, leaderboard, lock thành một lệnh; giới hạn là dung lượng RAM và persistence không mạnh bằng DB."
   },
   {
    "row": 4,
    "key": "Elasticsearch",
    "why": "Inverted index + analyzer (tokenize, stem) cho phép tra từ khoá nhanh và chấm điểm relevance; doc values cho phép đếm aggregation theo facet. Không phải nguồn sự thật nên dữ liệu được đồng bộ từ DB qua CDC, trễ vài giây."
   },
   {
    "row": 5,
    "key": "Kafka",
    "why": "Throughput rất cao vì Kafka là append-only log chia partition, ghi tuần tự lên đĩa; message giữ theo retention chứ không xoá khi đọc. Mỗi consumer group tự giữ offset nên nhiều hệ thống đọc độc lập và replay được; thứ tự chỉ bảo đảm trong partition."
   },
   {
    "row": 6,
    "key": "Flink",
    "why": "Crash thì khôi phục state từ checkpoint và đọc lại từ offset tương ứng, vì Flink giữ state (đếm, tổng theo key/window) cạnh code xử lý và checkpoint định kỳ. Watermark báo 'đã nhận đủ event tới thời điểm T', giúp đóng window đúng dù event đến trễ."
   },
   {
    "row": 7,
    "key": "ZooKeeper",
    "why": "ZAB là giao thức consensus nên mọi node thấy cùng thứ tự ghi → làm được nguồn sự thật cho cấu hình và leader. Ephemeral node tự biến mất khi session của client chết → phát hiện node chết và bầu leader mới; watch báo thay đổi thay vì poll. Kafka đã bỏ ZooKeeper bằng KRaft, Kubernetes dùng etcd (Raft)."
   },
   {
    "row": 8,
    "key": "Temporal",
    "why": "Code viết như hàm tuần tự mà vẫn bền, vì Temporal ghi mọi bước của workflow vào event history; worker crash thì workflow được replay từ history tới đúng chỗ dừng. Server lưu bền vững timer và retry, nên 'chờ 7 ngày rồi gửi nhắc' không cần cron hay bảng trạng thái tự làm."
   },
   {
    "row": 9,
    "key": "API Gateway",
    "why": "Là cửa vào duy nhất nên mọi concern chung (auth, rate limit, validate) đặt một lần ở đây. Không chứa business logic vì Gateway nằm trên đường đi của mọi request: logic nghiệp vụ ở đây làm nó khó scale, deploy chung cho mọi service và thành monolith ẩn."
   },
   {
    "row": 10,
    "key": "Proximity Search",
    "why": "Index thông thường chỉ sắp theo một chiều nên không trả lời hiệu quả 'gần (lat, lng)'. Geohash mã hoá 2D thành chuỗi mà prefix chung nghĩa là gần nhau → tra bằng prefix trên index thường; Quadtree chia ô theo mật độ. Vị trí tài xế đổi vài giây một lần nên cấu trúc phải cập nhật rẻ — đó là lý do đánh đổi độ chính xác với tốc độ cập nhật."
   },
   {
    "row": 11,
    "key": "Vector Database",
    "why": "Semantic search là tìm láng giềng gần nhất, vì embedding biến văn bản/ảnh thành vector mà nghĩa gần thì vector gần. So từng vector với hàng triệu vector quá chậm, nên ANN index (HNSW là đồ thị nhiều tầng, IVF là phân cụm) chỉ duyệt một phần nhỏ, đổi chút recall lấy tốc độ."
   },
   {
    "row": 12,
    "key": "Time-series DB",
    "why": "Lưu theo chunk thời gian và nén mạnh (delta encoding) rất hiệu quả, vì metrics gần như chỉ append theo thời gian và query theo khoảng thời gian. Dữ liệu cũ ít cần chi tiết, nên downsampling (1s → 1 phút) và retention xoá chunk cũ giữ storage không tăng mãi."
   },
   {
    "row": 13,
    "key": "Change Data Capture",
    "why": "Đọc WAL/binlog (Debezium) là bắt được 100% thay đổi mà app không phải ghi hai nơi, vì mọi thay đổi đã commit đều nằm trong log đó theo đúng thứ tự. Đẩy qua Kafka để nhiều đích (ES, cache, warehouse) tiêu thụ độc lập và replay được."
   },
   {
    "row": 14,
    "key": "Blob + CDN",
    "why": "Blob store rẻ và bền cho file lớn, CDN mang file tới gần user. Presigned URL cho client upload thẳng, multipart cho file lớn resume được, signed URL ở CDN giới hạn ai được tải nội dung private và trong bao lâu."
   }
  ],
  "sections": []
 },
 "bigdata-ds": {
  "story": {
   "problem": "Đếm chính xác số unique visitor của 1 tỷ event cần lưu mọi ID đã thấy: 1 tỷ ID × 16 byte = 16GB RAM cho một counter. Nhân với hàng nghìn trang, hàng nghìn ngày thì không khả thi.",
   "idea": "Chỉ lưu dấu vết hash của phần tử trong một cấu trúc kích thước cố định, thay vì lưu từng phần tử. Câu trả lời chỉ gần đúng, nhưng sai số chứng minh và chặn được.",
   "tradeoff": "Mất độ chính xác tuyệt đối, và thường không xoá được phần tử hay liệt kê lại phần tử nào đã thấy. Không dùng được khi cần số chính xác (tiền, tồn kho)."
  },
  "tldr": "Bộ nhớ không tăng theo số phần tử mà chỉ theo sai số chấp nhận được, vì hash phân tán phần tử đều trên một mảng cố định. Crawler, top K, ad click có hàng tỷ phần tử nhưng chấp nhận sai 1% — đúng chỗ cấu trúc xác suất toả sáng.",
  "table": [
   {
    "row": 0,
    "key": "Bloom filter",
    "why": "Thêm phần tử = bật k bit tại k vị trí hash. Phần tử đã thêm thì k bit chắc chắn đều bật → không có false negative; nhưng phần tử khác có thể tình cờ bật đủ k bit đó → false positive. Tắt bit để xoá sẽ làm hỏng phần tử khác dùng chung bit, nên không xoá được (trừ Counting Bloom filter)."
   },
   {
    "row": 1,
    "key": "Count-Min Sketch",
    "why": "Mỗi phần tử tăng một counter ở mỗi hàng (d hàng, mỗi hàng một hash) trong ma trận cố định. Phần tử khác va chạm cùng ô chỉ cộng thêm, không bao giờ trừ, nên lấy min các ô chỉ có thể lớn hơn hoặc bằng số thật. Kích thước ma trận do sai số mong muốn quyết định, không theo số phần tử."
   },
   {
    "row": 2,
    "key": "HyperLogLog",
    "why": "Hash đều thì xác suất thấy hash có ≥ k số 0 đầu là 1/2^k, nên số 0 đầu dài nhất cho ước lượng log số phần tử khác nhau. HLL chia ra 16384 register và lấy trung bình điều hoà để giảm phương sai; mỗi register vài bit nên tổng ~12KB, sai số chuẩn ~0.81%, và trùng lặp không làm tăng ước lượng."
   },
   {
    "row": 3,
    "key": "Min-heap kích thước K",
    "why": "Duyệt n phần tử chỉ tốn O(n log K) thời gian và O(K) bộ nhớ, không phải sort toàn bộ O(n log n): heap chỉ giữ K phần tử lớn nhất đã thấy với phần tử nhỏ nhất ở đỉnh; phần tử mới lớn hơn đỉnh thì thay đỉnh, mỗi lần O(log K)."
   }
  ],
  "sections": []
 },
 "lld-delivery": {
  "story": {
   "problem": "Không có khung thì dễ bỏ sót requirement, thiết kế sai quan hệ và hết giờ trước khi kịp chứng minh khả năng mở rộng. Ví dụ: ứng viên nghe đề Parking Lot liền code class `ParkingLot` với 20 method, 15 phút sau interviewer hỏi “xe máy thì sao?” là phải viết lại gần hết.",
   "idea": "Đi từ ngoài vào trong: chốt phạm vi → tìm entity → gán trách nhiệm → code. Mỗi bước dùng output của bước trước, nên sai sót bị bắt sớm, lúc sửa còn rẻ.",
   "tradeoff": "Tốn 5–10 phút đầu cho hỏi đáp và vẽ entity → phần code còn ít thời gian hơn. Đề quá đơn giản mà vẫn đi đủ 5 bước có thể bị xem là chậm."
  },
  "tldr": "Thứ tự này đi từ thứ rẻ nhất để đổi (câu hỏi, danh sách entity) tới thứ đắt nhất (code). Các bước trước phải tạo ra cấu trúc mà yêu cầu mới chỉ cần thêm class, vì **Extensibility** là bước interviewer kiểm tra thiết kế.",
  "points": [
   {
    "i": 0,
    "key": "Bài kinh điển: Parking Lot, Elevator, Ve",
    "why": "Luyện các bài này giúp nhận dạng pattern nhanh, vì mỗi bài gắn với một pattern rõ ràng: Vending Machine có trạng thái → State, Rate Limiter cần đổi thuật toán → Strategy. LRU Cache kiểm tra thêm khả năng kết hợp hash map + doubly linked list để đạt O(1)."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Requirements",
    "why": "Chốt phạm vi trước để tránh thiết kế thừa hoặc thiếu, vì đề LLD cố tình mơ hồ (Parking Lot có xe máy không? có thanh toán không?). Ghi rõ “ngoài phạm vi” còn cho bạn quyền từ chối khi interviewer hỏi lan man."
   },
   {
    "row": 1,
    "key": "Entities & Relationships",
    "why": "Rút danh từ trong requirement là cách nhanh nhất tìm class, vì danh từ thường chính là thực thể có trạng thái riêng (Ticket, Spot, Vehicle). Xác định ai sở hữu trạng thái để tránh hai class cùng sửa một field rồi lệch nhau."
   },
   {
    "row": 2,
    "key": "Class Design",
    "why": "Chốt method public trước khi code giúp phát hiện class ôm quá nhiều trách nhiệm (vi phạm SRP) hoặc phụ thuộc thẳng vào implementation (vi phạm DIP), vì method public là hợp đồng giữa các class. Sửa trên giấy rẻ hơn sửa code."
   },
   {
    "row": 3,
    "key": "Implementation",
    "why": "Code happy path trước để chứng minh thiết kế chạy được end-to-end trong thời gian có hạn; edge case (bãi đầy, ticket không hợp lệ) thêm sau mà không phá luồng chính. Làm ngược lại dễ hết giờ khi luồng chính chưa xong."
   },
   {
    "row": 4,
    "key": "Extensibility",
    "why": "Thiết kế dùng interface/Strategy đúng chỗ thì yêu cầu mới chỉ cần thêm `EVSpot` hoặc `EVPricing` — interviewer thêm yêu cầu (xe điện, nhiều tầng) chính là để kiểm tra **OCP**. Phải sửa nhiều class cũ là dấu hiệu coupling cao."
   }
  ],
  "sections": []
 },
 "oop-pillars": {
  "story": {
   "problem": "Code thủ tục với struct và hàm rời rạc khiến một thay đổi nhỏ lan ra hàng chục file khi hệ thống lớn lên: ai cũng sửa được `balance`, thêm loại hình mới thì phải thêm `if type == ...` ở khắp nơi.",
   "idea": "Gói dữ liệu và hành vi vào cùng object, chỉ lộ hợp đồng, để lời gọi chung (`shape.area()`) tự chọn hành vi đúng → thay đổi bị khoanh vùng trong một class.",
   "tradeoff": "Thêm tầng trừu tượng (interface, class cha) làm code dài hơn và khó lần theo hơn. Lạm dụng inheritance tạo cây class sâu: sửa class cha làm vỡ class con."
  },
  "tldr": "Bốn tính chất giải bốn vấn đề khác nhau: kiểm soát trạng thái, giấu chi tiết, tái dùng code, thay thế hành vi. Interface và abstract class là hai công cụ hiện thực Abstraction — chọn sai sẽ khoá thiết kế vào đơn kế thừa hoặc mất khả năng chia sẻ state.",
  "points": [
   {
    "i": 0,
    "key": "**Encapsulation (Đóng gói)** — giấu trạn",
    "why": "`balance` public thì ở đâu cũng gán được `balance = -1000` → invariant “không âm” bị phá mà không ai biết từ đâu. `withdraw()` gom mọi kiểm tra (đủ tiền, log, lock) về một chỗ duy nhất."
   },
   {
    "i": 1,
    "key": "**Abstraction (Trừu tượng)** — chỉ lộ ra",
    "why": "Đổi Stripe sang PayPal không phải sửa caller, vì caller chỉ phụ thuộc vào “làm gì” (`PaymentGateway.charge()`). Chi tiết “làm thế nào” nằm sau interface và thay đổi tự do."
   },
   {
    "i": 2,
    "key": "**Inheritance (Kế thừa)** — class con tá",
    "why": "Sửa cha có thể làm vỡ mọi con (fragile base class), vì inheritance gắn chặt con vào cha lúc compile. Composition (`Car` có `Engine`) cho thay `Engine` lúc runtime và không kéo theo các method không cần."
   },
   {
    "i": 3,
    "key": "**Polymorphism (Đa hình)** — cùng một lờ",
    "why": "`shape.area()` gọi đúng `Circle.area()` hay `Square.area()` theo kiểu thật của object, vì runtime polymorphism dùng dynamic dispatch (vtable). Nhờ vậy thêm `Triangle` không phải sửa code gọi `area()`; còn overload được chọn lúc compile theo kiểu tham số."
   },
   {
    "i": 4,
    "key": "*Java 8+ và C# 8+ cho phép interface có ",
    "why": "Ngôn ngữ cho phép `default` method có thân để thêm method vào interface cũ mà không làm vỡ hàng nghìn class đã implement (ví dụ `Collection.stream()` trong Java 8). Interface vẫn không có biến instance, nên khác abstract class ở chỗ không giữ state."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Method",
    "why": "Interface không giữ logic chung, vì nó chỉ mô tả hợp đồng “làm được gì”; abstract class chứa được concrete method cho class con dùng lại. Từ Java 8+ interface có `default` method nên ranh giới này mờ hơn."
   },
   {
    "row": 1,
    "key": "Trạng thái",
    "why": "Nhiều class không liên quan implement cùng interface mà không kế thừa layout bộ nhớ nào, vì interface không có biến instance. Abstract class có field nên chia sẻ được state chung như `id`, `createdAt`."
   },
   {
    "row": 2,
    "key": "Kế thừa",
    "why": "Implement nhiều interface không gây xung đột field (diamond problem về dữ liệu), vì interface không có state. Class có state, nên Java/C# chỉ cho đơn kế thừa để tránh mơ hồ khi hai cha có cùng field."
   },
   {
    "row": 3,
    "key": "Dùng khi",
    "why": "`Flyable` hợp làm interface vì `Bird` và `Airplane` không cùng họ nhưng cùng “bay được”. Ngược lại `Dog` và `Cat` cùng họ `Animal`, chia sẻ field `name` và logic `eat()` → abstract class bớt code lặp."
   }
  ],
  "sections": []
 },
 "solid": {
  "story": {
   "problem": "Mỗi thay đổi đều có rủi ro làm hỏng phần không liên quan khi một class làm mọi thứ. Ví dụ `OrderService` vừa tính giá, vừa ghi MySQL, vừa gửi email: đổi template email phải deploy lại cả logic tính tiền, thêm phương thức thanh toán phải sửa `if/else` dài 200 dòng.",
   "idea": "Chia class theo lý do thay đổi, nối chúng qua abstraction → yêu cầu mới được đáp ứng bằng cách thêm code, không sửa code cũ đang chạy ổn.",
   "tradeoff": "Nhiều class và interface nhỏ hơn → phải nhảy qua nhiều file để hiểu một luồng. Áp dụng máy móc cho code nhỏ dễ thành over-engineering."
  },
  "tldr": "Các nguyên tắc này đều nhắm vào khoanh vùng thay đổi, vì chi phí lớn nhất của phần mềm là sửa đổi. **SRP** là nền: khi mỗi class chỉ có một lý do để đổi, OCP, ISP, DIP mới có ranh giới rõ để áp dụng.",
  "table": [
   {
    "row": 0,
    "key": "SRP · Single Responsibility",
    "why": "`Invoice` vừa tính tiền, vừa gửi email, vừa ghi DB → đổi SMTP sang SES cũng phải sửa và test lại cả logic tính tiền. Tách thành `InvoiceCalculator`, `EmailSender`, `InvoiceRepository` thì mỗi thay đổi chỉ chạm một class."
   },
   {
    "row": 1,
    "key": "OCP · Open/Closed",
    "why": "`calculateFee()` dùng `if type == CAR ... elif type == BIKE` → thêm `TRUCK` phải sửa hàm đã test và có thể làm hỏng nhánh cũ. Dùng interface `FeeStrategy` thì chỉ cần thêm class `TruckFee`, code cũ không đổi."
   },
   {
    "row": 2,
    "key": "LSP · Liskov Substitution",
    "why": "Class con phải giữ hợp đồng của cha, không chỉ khớp chữ ký method. Ví dụ `resize(Rectangle r)` giả định `setWidth()` không đổi height → truyền `Square` (đổi cả hai cạnh) thì diện tích sai, còn nếu Square throw `NotSupported` thì caller crash."
   },
   {
    "row": 3,
    "key": "ISP · Interface Segregation",
    "why": "Interface `Worker` có cả `work()` và `eat()` → `RobotWorker` buộc phải viết `eat()` rỗng hoặc throw. Tách `Workable` và `Eatable` thì mỗi class chỉ implement thứ nó thật sự làm, và đổi `eat()` không bắt Robot compile lại."
   },
   {
    "row": 4,
    "key": "DIP · Dependency Inversion",
    "why": "`OrderService` gọi `new MySQLRepository()` bên trong → không thay được bằng Postgres hay mock khi unit test. Nhận `Repository` interface qua constructor thì service không biết DB cụ thể, đổi DB chỉ đổi chỗ wiring."
   }
  ],
  "sections": []
 },
 "principles-other": {
  "story": {
   "problem": "Ba lỗi hay gặp: dev viết plugin system, cache layer và config động cho tính năng chỉ có 2 user; code copy-paste validate email ở 5 chỗ, sửa bug ở 4 chỗ còn sót 1; controller gọi `order.getCustomer().getAddress().getZipCode()` nên đổi model Address là vỡ 30 file.",
   "idea": "Giữ code đơn giản nhất mà vẫn đáp ứng yêu cầu hiện tại, gom tri thức về một nơi, và để mỗi module chỉ biết hàng xóm trực tiếp.",
   "tradeoff": "Các nguyên tắc kéo ngược nhau: DRY đẩy về trừu tượng hoá, YAGNI/KISS kéo về code cụ thể. LoD thêm nhiều method uỷ quyền (wrapper) chỉ để chuyển tiếp lời gọi."
  },
  "tldr": "KISS, DRY, YAGNI chống viết thừa và lặp → giảm lượng code phải bảo trì. SoC và LoD giới hạn mỗi phần biết bao nhiêu về phần khác → thay đổi nội bộ một module không lan sang module khác.",
  "points": [
   {
    "i": 0,
    "key": "**KISS** — Keep It Simple, Stupid: là **",
    "why": "Hệ thống đơn giản dễ đọc, dễ debug, ít chỗ cho bug ẩn náu, vì có ít trạng thái và ít đường đi. KISS là đích đến; các nguyên tắc khác là cách đạt tới."
   },
   {
    "i": 1,
    "key": "**YAGNI** — You Aren't Gonna Need It: là",
    "why": "Viết trước tính năng “để dành cho tương lai” chỉ thêm code phải bảo trì, vì khoảng một nửa số đó không bao giờ được dùng, hoặc tới lúc dùng thì yêu cầu đã khác. YAGNI là hành động cụ thể: gặp ý tưởng “có thể sau này cần” thì cắt."
   },
   {
    "i": 2,
    "key": "**DRY** — Don't Repeat Yourself: logic l",
    "why": "Cùng một quy tắc (ví dụ regex email) nằm ở 5 chỗ → đổi quy tắc phải sửa đủ 5 chỗ, sót một là hệ thống xử lý không nhất quán. Gom về một hàm thì chỉ có một nguồn sự thật."
   },
   {
    "i": 3,
    "key": "**SoC** — Separation of Concerns: mỗi ph",
    "why": "Đổi MySQL sang DynamoDB không phải sửa UI, vì UI không biết DB lưu thế nào và DB không biết UI hiển thị ra sao. Mỗi phần thay đổi độc lập, test độc lập."
   },
   {
    "i": 4,
    "key": "**LoD** — Law of Demeter: tránh chuỗi gọ",
    "why": "Controller biết `Order` có `Customer`, `Customer` có `Address` → đổi `Address` thành `List<Address>` làm vỡ controller dù nó chẳng liên quan. Gọi `order.getShippingZip()` thì chỉ `Order` phải sửa."
   },
   {
    "i": 5,
    "key": "**LoD ngoại lệ** — fluent chain trả về c",
    "why": "Fluent chain không vi phạm LoD, vì mỗi lời gọi trả về chính `builder` nên caller không đi sâu vào cấu trúc nội bộ của object nào khác. LoD cấm “nói chuyện với người lạ”, còn ở đây vẫn chỉ nói chuyện với một object."
   },
   {
    "i": 6,
    "key": "DRY quá mức cũng hại: gộp hai đoạn code ",
    "why": "**DRY nói về trùng tri thức, không phải trùng chữ.** `validateUserAge()` và `validateProductStock()` hôm nay trông giống nhau nhưng đổi theo hai bộ quy tắc nghiệp vụ khác nhau → gộp lại thì sửa một bên phải thêm cờ `if` cho bên kia."
   }
  ],
  "sections": []
 },
 "patterns-gof": {
  "story": {
   "problem": "Không có từ vựng chung, mỗi dev tự giải cùng một vấn đề theo cách riêng: chỗ dùng `if/else` để đổi thuật toán, chỗ dùng cờ boolean để quản trạng thái, chỗ copy constructor 10 tham số. Code khó đọc, và khó mở rộng vì giải pháp tự chế thường coupling chặt.",
   "idea": "Pattern là giải pháp đã kiểm chứng cho vấn đề lặp lại, có tên gọi chung. Nói “dùng Strategy” là đồng đội hiểu ngay cấu trúc, không cần giải thích.",
   "tradeoff": "Mỗi pattern thêm class và tầng gián tiếp. Áp pattern khi chưa có vấn đề (ví dụ Factory cho đúng một class) chỉ làm code khó đọc hơn."
  },
  "tldr": "Ba nhóm khớp với ba nguồn thay đổi chính: cách tạo object (constructor phức tạp, chọn class), cách ghép object (bọc, che, nối), và cách object phối hợp (ai quyết định, ai được báo). Biết vấn đề thuộc nhóm nào là thu hẹp được pattern cần chọn.",
  "points": [
   {
    "i": 0,
    "key": "Cẩn thận với Singleton: đó là global sta",
    "why": "Singleton khó test: truy cập qua `getInstance()` tĩnh nên test không inject mock được và state rò rỉ giữa các test case. Trong đa luồng, hai thread cùng thấy `instance == null` sẽ tạo hai instance → cần lock, double-checked locking hoặc khởi tạo sẵn."
   },
   {
    "i": 1,
    "key": "Strategy vs State: Strategy do **client ",
    "why": "Cấu trúc class giống nhau, khác ở **ai nắm quyền chuyển**. Strategy là “cách làm” do bên ngoài cấu hình, nên client chủ động `setStrategy()`; State là “đang ở đâu trong vòng đời”, nên chính state hiện tại quyết định state kế tiếp sau mỗi event."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Creational",
    "why": "Singleton đảm bảo mọi nơi dùng cùng một object. Connection pool hay logger tốn tài nguyên và cần trạng thái chung (số connection đang mở) → nhiều instance sẽ vượt giới hạn connection của DB hoặc ghi log lẫn lộn."
   },
   {
    "row": 1,
    "key": "Creational",
    "why": "Constructor 10 tham số dễ truyền nhầm thứ tự và buộc truyền cả giá trị không cần → Builder cho set từng field có tên, tới `build()` mới kiểm tra hợp lệ. Object tạo ra có thể immutable vì chỉ được tạo khi đủ dữ liệu."
   },
   {
    "row": 2,
    "key": "Creational",
    "why": "Caller viết `new Car()` là phụ thuộc thẳng vào class cụ thể → thêm `Truck` phải sửa mọi chỗ tạo xe. Factory gom quyết định “tạo class nào” về một chỗ, caller chỉ nhận `Vehicle`."
   },
   {
    "row": 3,
    "key": "Structural",
    "why": "Checkout phải gọi inventory, payment, shipping, notification đúng thứ tự → để controller tự gọi thì logic điều phối lặp ở mọi nơi. `OrderService.checkout()` che toàn bộ, caller chỉ biết một method."
   },
   {
    "row": 4,
    "key": "Structural",
    "why": "Thêm topping bằng subclass gây bùng nổ tổ hợp (`CheesePizza`, `CheeseOlivePizza`…) → Decorator bọc object gốc và cùng implement interface `Pizza`. Mỗi lớp bọc cộng thêm giá, xếp chồng tuỳ ý lúc runtime."
   },
   {
    "row": 5,
    "key": "Behavioral",
    "why": "Rate limiter có thể đổi từ token bucket sang sliding window theo config → gói mỗi thuật toán thành class riêng implement `RateLimitStrategy`. Context giữ reference tới strategy và đổi được lúc runtime, không cần `if/else`."
   },
   {
    "row": 6,
    "key": "Behavioral",
    "why": "Stock ticker không nên biết có bao nhiêu màn hình, app, email đang theo dõi → Subject chỉ giữ danh sách Observer và gọi `notify()`. Thêm kênh thông báo mới chỉ cần `subscribe()`, không sửa Subject."
   },
   {
    "row": 7,
    "key": "Behavioral",
    "why": "Cờ `hasCoin`, `isDispensing` dễ rơi vào tổ hợp vô nghĩa (đang trả hàng mà vẫn nhận xu) → State Machine liệt kê trạng thái và chỉ cho chuyển hợp lệ. Mỗi state xử lý event theo cách riêng, trạng thái sai bị chặn ngay."
   }
  ],
  "sections": []
 },
 "concurrency": {
  "story": {
   "problem": "Hai request cùng đặt ghế A5: cả hai đọc thấy ghế trống, cả hai ghi “đã đặt” → một ghế bán cho hai người. Hoặc hai thread mỗi bên giữ một lock và chờ lock của bên kia → hệ thống treo mãi mãi.",
   "idea": "Biến thao tác “đọc–kiểm tra–ghi” thành không thể chen ngang (lock, transaction), cho thread chờ nhau có trật tự (condition, queue), và giới hạn số người dùng tài nguyên khan hiếm (semaphore).",
   "tradeoff": "Lock bắt thread chờ nên giảm throughput, dùng sai thì sinh deadlock. Với nhiều server, distributed lock thêm network round-trip và có rủi ro lock hết hạn giữa chừng."
  },
  "tldr": "Một CPU core vẫn có race condition, vì concurrency chỉ cần các tác vụ đan xen trên timeline và OS có thể chuyển thread giữa hai lệnh bất kỳ. Lock trong một process không có tác dụng với process khác → nhiều server phải dùng cơ chế chung như DB transaction hay distributed lock.",
  "points": [
   {
    "i": 0,
    "key": "**Correctness** — giữ dữ liệu đúng khi n",
    "why": "Mọi thao tác đọc–sửa–ghi trên dữ liệu chung đều có thể bị chen, vì thread có thể bị chuyển giữa hai lệnh máy bất kỳ. Lock hoặc thao tác atomic (compare-and-swap) đảm bảo kết quả không phụ thuộc may rủi lịch chạy."
   },
   {
    "i": 1,
    "key": "**Coordination** — cho các thread chờ và",
    "why": "Producer và consumer chạy khác tốc độ → cần cơ chế cho bên nhanh chờ bên chậm, thay vì mất dữ liệu hay quay vòng vô ích. Blocking queue gói sẵn lock + condition: `put()` tự chờ khi đầy, `take()` tự chờ khi rỗng."
   },
   {
    "i": 2,
    "key": "**Scarcity** — chia tài nguyên có hạn: s",
    "why": "Không giới hạn số người dùng đồng thời thì hệ thống phía sau quá tải và sập, vì tài nguyên như connection DB, quota API là hữu hạn. Backpressure báo ngược cho bên gửi chậm lại, thay vì đẩy thêm vào hàng đợi vô hạn."
   },
   {
    "i": 3,
    "key": "**Race condition** — kết quả phụ thuộc t",
    "why": "Race condition phải ngăn bằng thiết kế, không thể dựa vào test để bắt: kết quả phụ thuộc thread nào chạy trước, nên bug chỉ thỉnh thoảng xuất hiện và khó tái hiện."
   },
   {
    "i": 4,
    "key": "**4 điều kiện deadlock (Coffman)** — Mut",
    "why": "Phá được bất kỳ một điều kiện là đủ ngăn deadlock, vì deadlock chỉ xảy ra khi cả bốn điều kiện cùng đúng. Ví dụ lock ordering phá circular wait, timeout phá hold-and-wait vô hạn."
   },
   {
    "i": 5,
    "key": "**Giải deadlock** — lock ordering (luôn ",
    "why": "Mọi thread luôn lấy lock1 trước lock2 thì vòng tròn không thể hình thành, vì circular wait cần A giữ lock1 chờ lock2 còn B giữ lock2 chờ lock1. Timeout cho thread bỏ cuộc và thả lock; DB thì xây wait-for graph, thấy chu trình thì kill một transaction."
   },
   {
    "i": 6,
    "key": "**Multi-server** — Distributed lock, Kaf",
    "why": "Hai server không thấy lock của nhau, vì `threading.Lock` chỉ nằm trong RAM của một process. Phải dùng thứ cả hai cùng truy cập: Redis/DB lock, một partition Kafka xử lý tuần tự theo key, hoặc ràng buộc ACID trong DB."
   },
   {
    "i": 7,
    "key": "**Idempotency** — gọi nhiều lần cho cùng",
    "why": "API không idempotent thì client retry sẽ trừ tiền hai lần, vì network có thể timeout sau khi server đã xử lý xong. Lưu idempotency key kèm kết quả (với unique constraint) thì lần gọi thứ hai chỉ trả lại kết quả cũ."
   }
  ],
  "table": [
   {
    "row": 0,
    "key": "Lock (Mutex)",
    "why": "`count += 1` thực tế là ba bước đọc, cộng, ghi → hai thread chen nhau có thể cùng đọc 5 và cùng ghi 6. Lock đảm bảo mỗi lúc chỉ một thread ở trong critical section, nên ba bước chạy liền mạch."
   },
   {
    "row": 1,
    "key": "Semaphore",
    "why": "Semaphore khác lock ở chỗ cho **N thread** cùng vào, không chỉ một. Ví dụ DB chỉ chịu được 10 connection → semaphore khởi tạo 10 permit; thread thứ 11 bị block tới khi có thread `release()`."
   },
   {
    "row": 2,
    "key": "Condition Variable",
    "why": "Condition variable cho thread ngủ bằng `wait()` và được đánh thức bằng `notify()` khi producer đẩy item — thay vì consumer gặp queue rỗng rồi kiểm tra liên tục (busy-wait) đốt CPU. `wait()` nhả lock khi ngủ nên producer vào được."
   }
  ],
  "sections": []
 },
 "lld-problems-list": {
  "story": {
   "problem": "Gặp bài lạ mà chưa từng nghĩ qua entity và pattern, ứng viên mất nửa giờ chỉ để định hình class. Không chuẩn bị câu mở rộng thì khi interviewer hỏi “nhiều thang máy thì sao?” là phải đập đi xây lại.",
   "idea": "Phần lớn đề LLD xoay quanh vài bài kinh điển, mỗi bài có một pattern then chốt và vài câu mở rộng quen thuộc. Thuộc sẵn khung thì dành được thời gian cho phần khó thật sự.",
   "tradeoff": "Học thuộc khuôn dễ trả lời máy móc khi đề biến tấu. Vẫn phải hiểu vì sao pattern hợp với bài, không chỉ nhớ tên."
  },
  "tldr": "Chuẩn bị sẵn entity, pattern và câu mở rộng cho mỗi bài giúp trả lời có cấu trúc, vì interviewer chấm chủ yếu ở cách mô hình hoá entity và khả năng mở rộng. Câu mở rộng hay gặp chính là nơi pattern được kiểm chứng.",
  "table": [
   {
    "row": 0,
    "key": "Connect Four",
    "why": "Kiểm tra thắng là O(1), không cần quét cả bàn O(rows×cols): chỉ quân vừa đặt mới tạo được chuỗi thắng mới, nên chỉ đếm từ ô đó theo 4 hướng (ngang, dọc, 2 chéo), mỗi hướng tối đa 3 ô mỗi phía — số bước cố định."
   },
   {
    "row": 1,
    "key": "Amazon Locker",
    "why": "Chọn ngăn tách thành Strategy, vì gói hàng có kích thước khác nhau và chính sách chọn ngăn có thể đổi (vừa nhất, gần nhất). Mã truy cập có TTL để ngăn bị chiếm vô thời hạn khi khách không đến lấy."
   },
   {
    "row": 2,
    "key": "Elevator",
    "why": "State chặn chuyển sai, vì thang máy chỉ được làm một số thao tác ở mỗi trạng thái (không mở cửa khi đang chạy). Thuật toán điều phối (SCAN: đi hết một chiều rồi quay đầu) là chính sách thay được → dùng Strategy."
   },
   {
    "row": 3,
    "key": "Parking Lot",
    "why": "Cách tính phí đổi theo giờ, loại xe, ngày lễ → Strategy cho thay mà không sửa `ParkingLot`. Factory gom logic tạo loại Spot/Vehicle, nên thêm xe điện chỉ cần thêm class mới."
   },
   {
    "row": 4,
    "key": "File System",
    "why": "Directory chứa cả file lẫn directory con → Composite cho cả hai cùng implement `Entry` với `getSize()`. Directory tính size bằng cách đệ quy gọi `getSize()` của con, không cần phân biệt loại."
   },
   {
    "row": 5,
    "key": "Movie Ticket Booking",
    "why": "Phải giữ ghế (lock hoặc row có `held_until`) trong lúc thanh toán, vì hai người có thể cùng chọn ghế A5 trong vài giây. Hết hạn mà chưa trả tiền thì thả ghế, tránh giữ chỗ vĩnh viễn."
   },
   {
    "row": 6,
    "key": "Logging Service",
    "why": "Logger là Singleton vì mọi module cần ghi vào cùng cấu hình và cùng file. Chain of Responsibility cho message đi qua chuỗi handler theo level; Strategy cho đổi đích ghi (console, file, remote) mà không sửa Logger."
   },
   {
    "row": 7,
    "key": "Rate Limiter",
    "why": "Mỗi thuật toán là một Strategy, vì token bucket cho phép burst còn sliding window đều hơn, và yêu cầu có thể đổi. Bucket bị nhiều thread cùng trừ token nên phải thread-safe."
   },
   {
    "row": 8,
    "key": "Inventory Management",
    "why": "Dùng Observer vì nhiều bộ phận (mua hàng, cảnh báo) cần biết khi tồn kho thấp mà kho không nên phụ thuộc vào họ. Trừ kho phải atomic (kiểm tra và trừ trong cùng transaction) để hai đơn không cùng lấy món cuối cùng."
   }
  ],
  "sections": []
 },
 "ecs": {
  "story": {
   "problem": "Chạy container thẳng trên EC2 bằng `docker run`: container chết không ai khởi động lại, deploy bản mới phải SSH từng máy, máy hỏng là service sập. Tự dựng Kubernetes thì phải vận hành cả control plane.",
   "idea": "Khai báo trạng thái mong muốn (image này, N bản, gắn ALB này), để AWS liên tục so với thực tế rồi sửa lệch. Control plane là dịch vụ AWS sẵn có, không phải thứ bạn chạy.",
   "tradeoff": "Khái niệm và API là của riêng AWS → rời AWS phải viết lại toàn bộ cấu hình triển khai. Hệ sinh thái nhỏ hơn Kubernetes, không có Helm hay operator."
  },
  "tldr": "Bạn chỉ trả cho compute, vì ECS là dịch vụ đa tenant do AWS vận hành, không có control plane riêng để tính tiền theo cluster. Tích hợp sâu (IAM role cho task, ALB, CloudWatch) có sẵn vì cùng nhà cung cấp — nhưng chính điều đó khoá bạn vào AWS.",
  "sections": [
   {
    "s": 0,
    "title": "Khái niệm cốt lõi",
    "table": [
     {
      "row": 0,
      "key": "Cluster",
      "why": "Tạo cluster miễn phí và không có node master để quản, vì cluster chỉ là namespace logic trong control plane chung của ECS. Nó gom service và capacity provider để quản lý và phân quyền theo nhóm."
     },
     {
      "row": 1,
      "key": "Task Definition",
      "why": "Rollback chỉ là trỏ service lại revision cũ, vì mỗi lần sửa tạo revision mới bất biến (`my-app:7`) và service trỏ tới revision cụ thể. Mọi thứ cần để chạy container khai báo ở đây nên tái lập được."
     },
     {
      "row": 2,
      "key": "Task",
      "why": "Task là instance của task definition → các container trong cùng task được đặt cùng chỗ và chia sẻ network (sidecar log, proxy). Task chết thì không tự sống lại — việc đó do Service lo."
     },
     {
      "row": 3,
      "key": "Service",
      "why": "Task chết là có task mới thay, vì service scheduler liên tục so số task đang chạy với `desiredCount`. Nó cũng đăng ký task vào target group của ALB và điều phối rolling deploy."
     },
     {
      "row": 4,
      "key": "Capacity provider",
      "why": "Capacity provider tách “chạy ở đâu” khỏi định nghĩa service, vì cùng một service có thể cần chạy trên Fargate, Fargate Spot (rẻ hơn tới ~70% nhưng có thể bị thu hồi) hoặc EC2. Trộn tỉ lệ được bằng base và weight."
     },
     {
      "row": 5,
      "key": "Task role · Execution role",
      "why": "Hai role tách nhau để app không có quyền thừa và ngược lại. **Execution role**: trước khi app chạy, agent ECS cần quyền kéo image từ ECR và đọc secret từ Secrets Manager. **Task role**: khi app chạy và gọi S3, nó dùng credential của role này."
     }
    ]
   },
   {
    "s": 1,
    "title": "Fargate hay EC2?",
    "table": [
     {
      "row": 0,
      "key": "Quản máy chủ",
      "why": "Fargate không có EC2 nào để vá OS hay scale ASG, vì nó cấp micro-VM riêng cho mỗi task. Với EC2 launch type, bạn chịu trách nhiệm AMI, patch và đủ capacity cho task."
     },
     {
      "row": 1,
      "key": "Tính tiền",
      "why": "Fargate tính đúng vCPU/RAM task khai báo → không trả cho phần trống. EC2 tính cả instance dù chỉ dùng 40% → chỉ rẻ hơn khi bin packing tốt và dùng Reserved/Savings Plan."
     },
     {
      "row": 2,
      "key": "Giới hạn",
      "why": "Fargate trừu tượng hoá host → không gắn được GPU, không chạy daemon trên host, và mỗi lần phải kéo image về micro-VM mới (không cache sẵn) nên khởi động chậm hơn. EC2 cho chọn instance đặc thù và cache image trên máy."
     },
     {
      "row": 3,
      "key": "Chọn khi",
      "why": "Fargate là mặc định hợp lý cho team nhỏ không có người trực hạ tầng, vì nó bỏ hẳn phần quản máy. Khi tải lớn và ổn định, phần trả thêm cho Fargate cộng lại đủ lớn để EC2 + Reserved đáng công vận hành."
     }
    ]
   },
   {
    "s": 2,
    "title": "Networking, deploy, scaling",
    "points": [
     {
      "i": 0,
      "key": "**awsvpc mode** — mỗi task có ENI và IP ",
      "why": "Mỗi task có ENI riêng → task có IP thật trong subnet, và security group áp đúng cho task đó thay vì cả host. ALB đăng ký thẳng IP task (`ip` target type) vì không còn port mapping qua host."
     },
     {
      "i": 1,
      "key": "**Service discovery** — Service Connect ",
      "why": "Gọi bằng IP cứng sẽ vỡ, vì IP task đổi mỗi lần khởi động lại. Cloud Map đăng ký DNS name cho task; Service Connect thêm proxy sidecar lo retry và metric."
     },
     {
      "i": 2,
      "key": "**Rolling deploy** — `minimumHealthyPerc",
      "why": "Hai số này quyết định tốc độ deploy và capacity dư cần có: `minimumHealthyPercent: 50` cho tắt một nửa task cũ trước, `maximumPercent: 200` cho chạy gấp đôi trong lúc deploy. Circuit breaker đếm số task mới không lên healthy và tự rollback về revision trước."
     },
     {
      "i": 3,
      "key": "**Service Auto Scaling** — target tracki",
      "why": "Tải tăng là task tăng, vì Application Auto Scaling theo dõi metric CloudWatch và chỉnh `desiredCount` để giữ metric quanh mục tiêu (ví dụ CPU 60%). Scheduled scaling tăng trước giờ cao điểm, vì scale theo metric luôn trễ vài phút."
     },
     {
      "i": 4,
      "key": "**Trên EC2** còn phải scale máy: capacit",
      "why": "Trên EC2 phải scale cả lớp máy, vì thêm task mà instance hết chỗ thì task kẹt ở PROVISIONING. Managed scaling theo dõi task chờ chỗ và chỉnh desired capacity của ASG."
     },
     {
      "i": 5,
      "key": "**Quan sát** — log qua `awslogs` hoặc Fi",
      "why": "Container ghi ra stdout/stderr → log driver `awslogs` đẩy thẳng vào CloudWatch Logs; FireLens dùng Fluent Bit sidecar để route sang nơi khác. Container Insights thu metric theo task và service, không chỉ theo instance."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Nói rõ chọn Fargate hay EC2 và vì sao — ",
    "why": "Chọn cái này không quyết định cái kia, vì Fargate/EC2 là lớp compute còn ECS/EKS là lớp orchestrator. Nêu rõ cả hai cho thấy bạn hiểu chi phí và vận hành đến từ đâu."
   },
   {
    "i": 1,
    "key": "Phân biệt task role và execution role: h",
    "why": "Hỏi “ai cần” là trả lời ngay quyền gắn vào đâu: execution role dùng trước khi container khởi động, task role dùng trong lúc app chạy. Gắn nhầm vào execution role thì app báo AccessDenied."
   },
   {
    "i": 2,
    "key": "ECS không có version cluster để nâng cấp",
    "why": "ECS không có chu kỳ nâng cấp bắt buộc như Kubernetes, vì nó không phát hành version cluster (AWS cập nhật control plane trong suốt). Thứ duy nhất phải cập nhật là ECS agent/AMI nếu chạy EC2."
   }
  ]
 },
 "eks": {
  "story": {
   "problem": "Tự cài Kubernetes trên EC2 là tự vận hành etcd, backup, HA API server qua nhiều AZ, xoay certificate. Một sự cố etcd có thể làm mất trạng thái cả cluster.",
   "idea": "AWS chạy và bảo đảm control plane, bạn chỉ lo workload và (tuỳ mức) node. Vẫn là Kubernetes chuẩn nên toàn bộ hệ sinh thái CNCF dùng được nguyên vẹn.",
   "tradeoff": "Vẫn phải nâng version định kỳ, tự lắp ghép add-on, học nhiều khái niệm (pod, RBAC, CRD). Có phí control plane cố định cho mỗi cluster."
  },
  "tldr": "EKS tính phí control plane theo giờ, vì control plane Kubernetes (API server, etcd) là thành phần riêng của mỗi cluster mà AWS phải chạy dành riêng cho bạn trên nhiều AZ. API là Kubernetes chuẩn → manifest và Helm chart mang sang GKE/AKS được, nhưng cũng kéo theo toàn bộ độ phức tạp của Kubernetes.",
  "sections": [
   {
    "s": 0,
    "title": "Kiến trúc: control plane và data plane",
    "table": [
     {
      "row": 0,
      "key": "Control plane",
      "why": "AWS chạy nhiều bản etcd trên ít nhất 3 AZ để mất một AZ vẫn hoạt động, vì etcd cần quorum (đa số node sống) mới ghi được. Hết standard support mà chưa nâng version thì AWS tự chuyển sang extended support giá ~$0.60/giờ, gấp 6 lần."
     },
     {
      "row": 1,
      "key": "Managed node group",
      "why": "Cập nhật AMI là rolling, vì EKS quản ASG và biết cách drain node: tạo node mới, cordon, evict pod theo PodDisruptionBudget, rồi xoá node cũ. Bạn vẫn trả tiền EC2 vì node là instance thật trong account bạn."
     },
     {
      "row": 2,
      "key": "Self-managed nodes",
      "why": "Bạn tự viết launch template và bootstrap → dùng được AMI tuỳ chỉnh, kernel đặc biệt. Đổi lại, drain, nâng cấp, vá lỗi đều tự làm."
     },
     {
      "row": 3,
      "key": "Fargate",
      "why": "Mỗi pod chạy trong micro-VM riêng, không có node dùng chung → DaemonSet (một pod mỗi node) vô nghĩa, và pod privileged không được phép vì có thể chạm host. Fargate cũng không cấp GPU."
     },
     {
      "row": 4,
      "key": "Auto Mode",
      "why": "Bạn gần như chỉ deploy pod, vì AWS chạy sẵn Karpenter, VPC CNI, CoreDNS và tự chọn, vá, thay node. Phí quản lý tính thêm theo mỗi instance, trên giá EC2."
     },
     {
      "row": 5,
      "key": "Karpenter",
      "why": "Karpenter nhanh hơn Cluster Autoscaler (vốn chỉ tăng size các node group có sẵn), vì nó đọc thẳng yêu cầu của pod Pending rồi gọi EC2 Fleet API chọn instance vừa khít. Nó cũng gom pod để xoá node thừa (consolidation)."
     }
    ]
   },
   {
    "s": 1,
    "title": "Object Kubernetes hay dùng",
    "table": [
     {
      "row": 0,
      "key": "Pod",
      "why": "Các container trong pod chia sẻ network namespace → gọi nhau qua `localhost` và dùng chung một IP. Pod là đơn vị scheduler đặt lên node, nên mọi container trong pod luôn ở cùng node."
     },
     {
      "row": 1,
      "key": "Deployment / ReplicaSet",
      "why": "Rolling update và rollback chỉ là đổi số replica giữa hai ReplicaSet, vì Deployment tạo ReplicaSet mới cho mỗi version và giảm dần ReplicaSet cũ. `maxSurge` cho chạy dư bao nhiêu pod, `maxUnavailable` cho thiếu bao nhiêu."
     },
     {
      "row": 2,
      "key": "Service",
      "why": "Service cấp một IP/DNS ổn định và tự cập nhật danh sách endpoint theo label selector, vì IP pod đổi mỗi lần pod tạo lại. `LoadBalancer` type tạo NLB khi có AWS Load Balancer Controller."
     },
     {
      "row": 3,
      "key": "Ingress",
      "why": "Ingress cần controller biến nó thành load balancer thật, vì bản thân nó chỉ khai báo luật HTTP (host, path). AWS Load Balancer Controller đọc Ingress và tạo ALB với listener rule tương ứng."
     },
     {
      "row": 4,
      "key": "ConfigMap / Secret",
      "why": "Tách cấu hình khỏi image → cùng image chạy được ở dev và prod. Secret mặc định chỉ base64 trong etcd, nên cần bật KMS envelope encryption hoặc dùng Secrets Manager qua CSI driver."
     },
     {
      "row": 5,
      "key": "HPA",
      "why": "Tải tăng là số pod tăng tỉ lệ, vì HPA định kỳ (mặc định 15 giây) lấy metric rồi tính `desired = current × metric / target`. HPA thường không scale về 0, nên KEDA lo trường hợp theo queue và scale-to-zero."
     },
     {
      "row": 6,
      "key": "Namespace + RBAC",
      "why": "Role/RoleBinding giới hạn team A chỉ thao tác trong namespace của A, vì namespace là ranh giới đặt tên và gắn quyền. Đây là cách ly logic, không phải cách ly bảo mật tuyệt đối."
     },
     {
      "row": 7,
      "key": "DaemonSet",
      "why": "DaemonSet đảm bảo mỗi node có đúng một pod, node mới tự có pod — cần cho agent log và monitoring đọc dữ liệu từ từng máy. Vì vậy Fargate (không có node chung) không hỗ trợ."
     },
     {
      "row": 8,
      "key": "StatefulSet + PVC",
      "why": "Pod tạo lại vẫn gắn đúng volume, vì StatefulSet cho mỗi pod tên cố định (`db-0`) và PVC riêng đi theo pod. EBS là block device nằm trong một AZ, nên pod chỉ lên lại được node cùng AZ."
     },
     {
      "row": 9,
      "key": "Job / CronJob",
      "why": "Job hợp tác vụ batch, vì nó chạy pod tới khi thành công rồi dừng (thay vì luôn giữ N pod như Deployment). CronJob tạo Job theo lịch cron."
     }
    ]
   },
   {
    "s": 2,
    "title": "Networking & phân quyền",
    "points": [
     {
      "i": 0,
      "key": "**VPC CNI** — mỗi pod có IP thật trong V",
      "why": "Pod có IP thật, gọi thẳng không qua NAT, vì VPC CNI gắn secondary IP từ subnet vào ENI của node rồi cấp cho pod. Mỗi instance type giới hạn số ENI và số IP mỗi ENI (ví dụ `m5.large` tối đa 29 pod); prefix delegation cấp cả khối /28 cho mỗi slot nên tăng mạnh mật độ pod."
     },
     {
      "i": 1,
      "key": "**Ingress** — AWS Load Balancer Controll",
      "why": "Target type `ip` đăng ký thẳng IP pod → traffic đi từ ALB thẳng tới pod, không qua NodePort và kube-proxy. Ít hop hơn, và health check phản ánh đúng từng pod."
     },
     {
      "i": 2,
      "key": "**Hai lớp quyền** — AWS IAM quyết định a",
      "why": "IAM là lớp ngoài, vì `kubectl` phải xác thực với AWS IAM trước khi vào API server; sau đó RBAC quyết định user đó được `get pods` hay `delete deployment`. Access Entries quản qua EKS API nên không lo sửa nhầm ConfigMap `aws-auth` rồi khoá cả admin ra ngoài."
     },
     {
      "i": 3,
      "key": "**Pod gọi AWS** — gắn IAM role cho Servi",
      "why": "Gắn IAM role cho ServiceAccount để pod nhận credential tạm thời, vì access key tĩnh trong pod có thể lộ qua image hay log và không tự xoay. Pod Identity dùng agent trên node nên không cần cấu hình OIDC provider và trust policy cho từng cluster như IRSA."
     },
     {
      "i": 4,
      "key": "**NetworkPolicy** — giới hạn pod nào đượ",
      "why": "Mặc định mọi pod trong cluster gọi được nhau → một pod bị chiếm có thể tấn công database pod. NetworkPolicy chỉ là khai báo, cần CNI có enforcement (VPC CNI bật network policy, hoặc Calico/Cilium) mới thực thi."
     }
    ]
   },
   {
    "s": 3,
    "title": "Scaling 3 lớp",
    "points": [
     {
      "i": 0,
      "key": "**HPA** — số pod theo CPU, RAM hoặc metr",
      "why": "HPA phản ứng sau khi tải đã tăng, vì nó chỉ chỉnh số replica theo metric hiện tại. KEDA đọc thẳng nguồn sự kiện như độ dài SQS → scale trước khi CPU tăng, và về 0 được khi queue rỗng."
     },
     {
      "i": 1,
      "key": "**VPA** — gợi ý hoặc tự chỉnh CPU/RAM re",
      "why": "Requests đặt sai thì hoặc lãng phí node (đặt cao), hoặc pod bị OOMKill/throttle (đặt thấp) → VPA quan sát mức dùng thực tế để gợi ý số đúng. Không dùng VPA auto cùng HPA trên cùng metric CPU, vì hai bên chỉnh đè nhau."
     },
     {
      "i": 2,
      "key": "**Node** — Karpenter (hoặc Cluster Autos",
      "why": "Phải có lớp thứ ba thêm node, vì HPA tạo pod mới mà node đầy thì pod nằm Pending. Khi tải giảm, consolidation dồn pod sang ít node hơn rồi xoá node trống để không trả tiền máy thừa."
     }
    ]
   },
   {
    "s": 4,
    "title": "Cái giá vận hành",
    "points": [
     {
      "i": 0,
      "key": "**Nâng version Kubernetes** khoảng mỗi n",
      "why": "Phải nâng version ít nhất mỗi năm, vì upstream Kubernetes ra minor version mới khoảng mỗi 4 tháng và EKS chỉ hỗ trợ chuẩn ~14 tháng. Add-on gắn chặt với version API → nâng control plane mà quên add-on có thể làm hỏng DNS hoặc networking."
     },
     {
      "i": 1,
      "key": "**Tự lắp ghép** — ingress, autoscaler, G",
      "why": "Ingress controller, autoscaler, ArgoCD, Prometheus đều là phần mềm bạn tự cài, cấu hình và nâng cấp, vì Kubernetes chỉ cung cấp nhân điều phối. Mỗi component là thêm một thứ có thể hỏng."
     },
     {
      "i": 2,
      "key": "**Chi phí** — phí control plane mỗi clus",
      "why": "Karpenter chọn instance vừa khít và dùng Spot đa dạng loại → tỉ lệ sử dụng node cao, giá node giảm tới 70–90% so với on-demand. Ở quy mô hàng trăm node, khoản tiết kiệm này vượt phí control plane ~$73/tháng."
     }
    ]
   },
   {
    "s": 5,
    "title": "Câu hỏi hay bị hỏi sâu",
    "points": [
     {
      "i": 0,
      "key": "**Pod Pending** — thiếu CPU/RAM trên nod",
      "why": "Không node nào đủ điều kiện là pod nằm Pending, vì scheduler chỉ đặt pod lên node đủ `requests` và khớp nodeSelector/taint. Hết IP trong subnet thì VPC CNI không cấp được IP → pod kẹt ở ContainerCreating hoặc Pending; `kubectl describe pod` cho biết lý do."
     },
     {
      "i": 1,
      "key": "**Noisy neighbor** — luôn đặt `requests`",
      "why": "Thiếu cả `requests` lẫn `limits` thì một pod có thể ăn hết CPU/RAM node, làm pod khác chậm hoặc bị OOMKill — vì scheduler dựa vào `requests` để xếp pod, còn `limits` giới hạn mức dùng thực tế. ResourceQuota chặn tổng mức cả namespace."
     },
     {
      "i": 2,
      "key": "**Multi-tenant** — namespace + RBAC + Ne",
      "why": "Namespace + RBAC + NetworkPolicy + ResourceQuota chỉ là cách ly mềm, vì mọi tenant dùng chung kernel node và control plane. Lỗ hổng container escape vẫn chạm được tenant khác → cần cách ly mạnh thì tách cluster hoặc account."
     },
     {
      "i": 3,
      "key": "**Stateful** — EBS chỉ gắn trong 1 AZ: p",
      "why": "Pod bị xếp lên node ở AZ khác sẽ không mount được và nằm Pending, vì EBS volume là block device chỉ attach được vào instance cùng AZ. EFS là network file system đa AZ; còn dịch vụ managed như RDS tự lo HA, nên đẩy trạng thái ra khỏi cluster."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Nói EKS thì nói luôn compute: managed no",
    "why": "Nêu luôn lựa chọn compute mới là câu trả lời đầy đủ, vì “EKS” chỉ nói về control plane, còn chi phí, vận hành và giới hạn (GPU, DaemonSet) phụ thuộc lớp compute."
   },
   {
    "i": 1,
    "key": "Nhắc 2 lớp quyền (IAM + RBAC) và Pod Ide",
    "why": "Nói rõ hai lớp cho thấy bạn hiểu mô hình, vì nhầm quyền vào cluster (IAM) với quyền trong cluster (RBAC) là lỗi bảo mật phổ biến. Nhắc Pod Identity cho thấy bạn biết tránh access key tĩnh."
   },
   {
    "i": 2,
    "key": "Đừng chọn EKS chỉ vì “chuẩn ngành”: phải",
    "why": "Cần lý do cụ thể mà chỉ Kubernetes có — operator, Helm, chạy đa cloud, hay platform cho nhiều team — vì EKS tốn phí và công vận hành hơn ECS. Không nêu được thì ECS là lựa chọn rẻ hơn."
   }
  ]
 },
 "ecs-vs-eks": {
  "story": {
   "problem": "Chọn sai orchestrator theo cả hai chiều đều tốn: team 5 người chọn EKS vì “chuẩn ngành”, rồi mất một người toàn thời gian lo nâng version, cài ingress, debug CNI thay vì làm sản phẩm. Ngược lại, công ty 20 team chọn ECS rồi thiếu công cụ chuẩn hoá, phải tự xây lại những gì Helm, ArgoCD đã có.",
   "idea": "Chọn orchestrator theo năng lực team và nhu cầu thật (portability, hệ sinh thái); compute (Fargate/EC2) là quyết định riêng theo tải và chi phí.",
   "tradeoff": "ECS đổi tính di động và hệ sinh thái lấy độ đơn giản. EKS đổi chi phí vận hành và độ khó lấy linh hoạt."
  },
  "tldr": "ECS có chi phí vận hành thấp nhất khi team nhỏ và chỉ dùng AWS, vì không có control plane tính phí và không có version cluster phải nâng. EKS chỉ đáng khi dùng tới thứ chỉ Kubernetes có; Fargate/EC2 là lớp compute dùng chung cho cả hai nên quyết định tách riêng.",
  "table": [
   {
    "row": 0,
    "key": "Bản chất",
    "why": "EKS dùng được mọi công cụ viết cho Kubernetes, vì nó chạy Kubernetes upstream được CNCF chứng nhận; ECS là API độc quyền của AWS nên chỉ dùng được công cụ hỗ trợ API của AWS."
   },
   {
    "row": 1,
    "key": "Phí control plane",
    "why": "EKS tính $0.10 × 730 giờ ≈ $73/tháng/cluster, vì nó dựng API server và etcd riêng cho mỗi cluster, còn control plane ECS là dịch vụ dùng chung. Nhiều cluster (dev, staging, prod) thì nhân lên."
   },
   {
    "row": 2,
    "key": "Độ khó học",
    "why": "ECS học trong vài ngày, vì chỉ có vài khái niệm khớp thẳng nhu cầu (task, service). Kubernetes là nền tảng tổng quát với hàng chục loại object, mở rộng được bằng CRD, nên cần thời gian dài hơn nhiều."
   },
   {
    "row": 3,
    "key": "Vận hành",
    "why": "ECS không có nâng cấp bắt buộc, vì AWS cập nhật control plane trong suốt. EKS theo vòng đời version upstream, mỗi lần nâng phải kiểm tra API deprecated và nâng add-on."
   },
   {
    "row": 4,
    "key": "Compute",
    "why": "EKS có nhiều cách cung cấp node hơn, kể cả hybrid nodes cho máy on-prem gia nhập cluster, vì nó kế thừa mô hình node của Kubernetes. ECS Anywhere cũng chạy được task trên máy ngoài AWS, nhưng control plane vẫn ở AWS."
   },
   {
    "row": 5,
    "key": "Tính di động",
    "why": "Deployment, Service chạy được trên GKE, AKS, chỉ cần đổi phần đặc thù cloud (storage class, ingress annotation), vì manifest Kubernetes dùng API chuẩn. Task definition ECS thì không nơi nào khác hiểu."
   },
   {
    "row": 6,
    "key": "Hệ sinh thái",
    "why": "Kubernetes có sẵn operator cho Postgres, Kafka và công cụ GitOps như ArgoCD, nhờ cộng đồng lớn và cơ chế mở rộng (CRD + controller). ECS dựa vào dịch vụ AWS — đủ dùng nhưng ít lựa chọn hơn."
   },
   {
    "row": 7,
    "key": "Scaling",
    "why": "EKS tinh chỉnh được nhiều hơn: Karpenter chọn loại instance linh hoạt theo từng pod, KEDA scale theo hàng chục nguồn sự kiện. ECS chỉ chỉnh số task và ASG — đơn giản hơn nhưng ít núm vặn."
   },
   {
    "row": 8,
    "key": "Phân quyền",
    "why": "ECS chỉ có một lớp quyền: gắn trực tiếp qua IAM task role. EKS thêm RBAC trong cluster vì nhiều user/team cùng thao tác trên Kubernetes API → mạnh hơn nhưng phải quản hai hệ quyền."
   },
   {
    "row": 9,
    "key": "Hợp với",
    "why": "EKS chỉ đáng với platform team lớn, vì chi phí cố định vận hành nó được chia đều khi nhiều team dùng chung. Team nhỏ thì chi phí đó dồn lên đầu ít người, ECS ship nhanh hơn."
   }
  ],
  "sections": [
   {
    "s": 0,
    "title": "Tình huống → lựa chọn",
    "table": [
     {
      "row": 0,
      "key": "Startup 5 dev, 10 microservice web/API",
      "why": "ECS + Fargate bỏ cả nâng version cluster lẫn vá node — hai việc mà 5 dev không ai có thời gian làm. 10 service vẫn trong tầm quản lý bằng Terraform đơn giản."
     },
     {
      "row": 1,
      "key": "Công ty có platform team, 200 service, 20 team",
      "why": "20 team cần tự deploy mà không đạp lên nhau → namespace + RBAC + ResourceQuota cho ranh giới, Helm chart chuẩn hoá cách deploy. Platform team chia chi phí vận hành EKS cho 200 service."
     },
     {
      "row": 2,
      "key": "Phải chạy cả on-prem và cloud",
      "why": "Một bộ manifest, một quy trình CI/CD dùng được mọi nơi, vì Kubernetes chạy giống nhau ở cloud và on-prem. ECS không có control plane chạy on-prem độc lập."
     },
     {
      "row": 3,
      "key": "Cần operator chạy Kafka/Postgres trong cluster",
      "why": "Operator chỉ tồn tại trên Kubernetes API, vì nó là controller theo dõi CRD (ví dụ `KafkaCluster`) và tự xử lý các bước vận hành như failover. ECS không có cơ chế CRD tương đương."
     },
     {
      "row": 4,
      "key": "ML training cần GPU, scale theo job",
      "why": "Không trả tiền GPU nhàn rỗi, vì Karpenter tạo node GPU khi job xuất hiện và xoá khi job xong; Spot giảm giá thêm. Fargate không hỗ trợ GPU nên ECS phải dùng EC2; AWS Batch là lựa chọn managed cho batch thuần."
     },
     {
      "row": 5,
      "key": "Container hoá monolith lần đầu",
      "why": "Thêm Kubernetes là quá nhiều thay đổi một lúc, vì lần đầu container hoá đã có nhiều thứ mới (Dockerfile, registry, health check). ECS + Fargate giữ số khái niệm mới ít nhất."
     },
     {
      "row": 6,
      "key": "Traffic lẻ tẻ, xử lý ngắn theo sự kiện",
      "why": "Traffic lẻ tẻ gần như không tốn gì lúc nhàn rỗi, vì Lambda tính tiền theo request và thời gian chạy tính bằng mili giây. Container thường trực vẫn trả tiền dù không có request."
     }
    ]
   },
   {
    "s": 1,
    "title": "Trả lời trong phỏng vấn",
    "points": [
     {
      "i": 0,
      "key": "Đừng dừng ở “tuỳ”. Hỏi 3 câu: **team có ",
      "why": "Cả ba câu đều “không” thì EKS chỉ thêm chi phí mà không thêm giá trị, vì đây là ba lý do duy nhất khiến Kubernetes đáng tiền: kỹ năng có sẵn, portability, hệ sinh thái. Trả lời bằng tiêu chí cụ thể cho thấy bạn biết ra quyết định."
     },
     {
      "i": 1,
      "key": "**Image giống hệt nhau** — bắt đầu bằng",
      "why": "Không cần chọn EKS “phòng trước”, vì chi phí chuyển thấp: cả ECS và EKS đều chạy OCI image chuẩn nên phần ứng dụng không đổi, chỉ phải viết lại cấu hình triển khai (task definition → manifest)."
     },
     {
      "i": 2,
      "key": "**Chi phí** — quy mô nhỏ ECS rẻ hơn (khô",
      "why": "Ở quy mô nhỏ ECS rẻ hơn, vì phí control plane và công kỹ sư chiếm phần lớn tổng chi phí. Ở quy mô lớn, tiền compute lớn nên bin packing và Spot của Karpenter tiết kiệm nhiều — nhưng lương một kỹ sư platform vẫn có thể lớn hơn khoản tiết kiệm."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Trong bài system design, “container serv",
    "why": "Đi sâu orchestrator khi không được hỏi là dồn thời gian vào phần ít điểm, vì system design chấm chủ yếu ở luồng dữ liệu, scaling và trade-off của ứng dụng."
   },
   {
    "i": 1,
    "key": "Phân tách 2 quyết định: orchestrator (EC",
    "why": "Đây là hai quyết định độc lập, vì cả ECS và EKS đều chạy được trên Fargate và EC2: orchestrator theo năng lực team và hệ sinh thái, compute theo tải và chi phí. Gộp chung dễ dẫn tới lập luận sai kiểu “chọn EKS vì cần GPU”."
   }
  ]
 },
 "code-architecture": {
  "story": {
   "problem": "Code mới đầu gọn, nhưng sau một năm: service gọi thẳng ORM, controller chứa luật nghiệp vụ, đổi một thư viện là sửa khắp nơi. Test một luật giảm giá phải dựng cả DB.",
   "idea": "Quy định rõ **hướng phụ thuộc**: luật nghiệp vụ không được biết DB, web hay framework. Phần hay đổi (hạ tầng) phụ thuộc vào phần ít đổi (nghiệp vụ), không ngược lại.",
   "tradeoff": "Thêm interface, mapping, thư mục → code dài hơn, lúc đầu làm chậm hơn. Với app CRUD nhỏ, cái giá này thường lớn hơn lợi ích."
  },
  "tldr": "Mọi kiến trúc code thực chất là luật về `import`: ai được biết ai. Layered cho business biết data access, vì đó là cách tự nhiên nhất khi gọi từ trên xuống. Hexagonal/Onion/Clean dùng Dependency Inversion — core định nghĩa interface, hạ tầng cài đặt — nên mũi tên phụ thuộc đảo chiều vào trong.",
  "table": [
   {
    "row": 0,
    "key": "Layered (N-tier)",
    "why": "Đổi cách lưu trữ hay test business đều kéo theo DB, vì tầng Business gọi thẳng Repository cụ thể. Đổi lại, cấu trúc này khớp cách framework sinh code nên ai cũng làm được ngay."
   },
   {
    "row": 1,
    "key": "Hexagonal (Ports & Adapters)",
    "why": "Mọi công nghệ bên ngoài chỉ là adapter cắm vào, vì core chỉ biết interface do chính nó định nghĩa (port): thay Postgres bằng Mongo là viết adapter mới, core không biết gì. Cái giá: mỗi tích hợp cần thêm một interface và chuyển đổi dữ liệu qua lại."
   },
   {
    "row": 2,
    "key": "Onion",
    "why": "Onion tách luật nghiệp vụ thuần (domain model, domain services) khỏi phần điều phối (application services) — cùng ý tưởng với Hexagonal nhưng chia lõi thành nhiều vòng. Càng nhiều vòng càng cần quy ước rõ để mọi người đặt code đúng chỗ."
   },
   {
    "row": 3,
    "key": "Clean Architecture",
    "why": "Use case không bao giờ thấy object của framework (request HTTP, entity ORM), vì Dependency Rule bắt dữ liệu qua ranh giới phải là DTO đơn giản. Nhờ vậy use case đọc như mô tả nghiệp vụ và test thuần được — nhưng mỗi ranh giới lại cần mapper và model riêng."
   },
   {
    "row": 4,
    "key": "Vertical Slice",
    "why": "Thay đổi một tính năng chỉ chạm một thư mục, không chạm `OrderService` dùng chung, vì code gom theo tính năng → giảm xung đột giữa người và giữa tính năng. Mặt trái: phần dùng chung dễ bị copy sang nhiều slice nếu không ai chủ động rút ra."
   }
  ],
  "sections": [
   {
    "s": 0,
    "title": "Hexagonal, Onion, Clean khác nhau ở đâu?",
    "points": [
     {
      "i": 0,
      "key": "**Cùng một nguyên lý** — Dependency",
      "why": "Core biên dịch được mà không cần thư viện DB hay web nào, vì interface nằm trong core; lớp ngoài `import` core để cài đặt interface, không có chiều ngược lại."
     },
     {
      "i": 1,
      "key": "**Hexagonal** chỉ chia **trong / ngoài",
      "why": "Tách driving và driven cho thấy rõ ai khởi động luồng: driving adapter gọi use case, use case gọi driven adapter qua port → test thay được cả hai đầu bằng đồ giả."
     },
     {
      "i": 2,
      "key": "**Onion** chia phần lõi thành nhiều vòng",
      "why": "Để chung một chỗ thì luật nghiệp vụ dễ lẫn với chi tiết kỹ thuật, vì luật áp lên nhiều entity (domain service) khác với code điều phối một use case (application service: mở transaction, gọi repository)."
     },
     {
      "i": 3,
      "key": "**Clean** đặt tên vòng theo vai trò",
      "why": "DTO đơn giản giữ ranh giới sạch. Use case nhận thẳng entity ORM hay request HTTP là lại phụ thuộc framework — đúng thứ kiến trúc muốn tránh."
     },
     {
      "i": 4,
      "key": "**Thực tế** các đội thường gộp lại",
      "why": "Chọn bộ thư mục đơn giản nhất thể hiện được hướng phụ thuộc, thay vì tranh luận tên gọi — tên vòng khác nhau nhưng cấu trúc phụ thuộc giống nhau."
     },
     {
      "i": 5,
      "key": "**MVC** không cùng loại: đó là patte",
      "why": "MVC chỉ chia trách nhiệm hiển thị (model dữ liệu cho view, view render, controller nhận input) — nó không nói gì về chuyện business có được biết DB hay không."
     }
    ],
    "table": []
   },
   {
    "s": 1,
    "title": "Cấu trúc thư mục ví dụ",
    "table": [
     {
      "row": 0,
      "key": "Layered",
      "why": "Thư mục theo loại kỹ thuật, nên một tính năng rải ra 3–4 thư mục."
     },
     {
      "row": 1,
      "key": "Hexagonal",
      "why": "Thư mục theo phía của ranh giới: `domain`/`application` không được import gì từ `adapters`."
     },
     {
      "row": 3,
      "key": "Clean",
      "why": "Mỗi vòng một thư mục; quy tắc import chỉ đi vào trong có thể kiểm tra tự động (ArchUnit, import-linter)."
     },
     {
      "row": 4,
      "key": "Vertical Slice",
      "why": "Thư mục theo tính năng: xoá một tính năng là xoá một thư mục."
     }
    ]
   },
   {
    "s": 2,
    "title": "Chọn thế nào",
    "points": [
     {
      "i": 0,
      "key": "**Mặc định Layered** cho CRUD và app n",
      "why": "Lớp abstraction thêm vào không bảo vệ được gì khi phần lớn code chỉ đọc/ghi bảng, không có luật nghiệp vụ dày để bảo vệ."
     },
     {
      "i": 1,
      "key": "**Chuyển sang Hexagonal/Clean** khi l",
      "why": "Kiến trúc đảo phụ thuộc giữ luật nghiệp vụ — tài sản đắt nhất lúc đó — khỏi bị kéo theo khi hạ tầng thay đổi thường xuyên."
     },
     {
      "i": 2,
      "key": "**Vertical Slice** khi có nhiều tính nă",
      "why": "Dùng chung được, vì hai hướng giải hai vấn đề khác nhau: slice giảm xung đột giữa tính năng, port/adapter giảm phụ thuộc hạ tầng."
     },
     {
      "i": 3,
      "key": "**Điều quan trọng là hướng phụ thuộc**",
      "why": "Kiến trúc nằm ở câu lệnh `import`, không ở tên thư mục: một lệnh import ORM trong use case là đủ phá toàn bộ lợi ích."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Khi interviewer hỏi, vẽ mũi tên ph",
    "why": "Interviewer muốn thấy bạn hiểu bản chất (hướng phụ thuộc), không phải thuộc tên các vòng."
   },
   {
    "i": 2,
    "key": "Thừa nhận chi phí: với CRUD, Clean Archi",
    "why": "Nêu được khi nào **không** nên dùng cho thấy bạn chọn kiến trúc theo bài toán, không theo trào lưu."
   }
  ]
 },
 "system-architecture": {
  "story": {
   "problem": "Monolith lớn dần: một module memory leak làm sập cả hệ thống, mỗi lần deploy phải chờ 40 team, muốn scale checkout phải nhân cả khối. Nhưng tách vội thành microservices lại đẻ ra lỗi network, saga, debug khó.",
   "idea": "Chọn ranh giới runtime theo nhu cầu thật: giữ một deployable khi còn nhỏ, chia module rõ để sau này tách, chỉ tách service khi có lý do scale hoặc team độc lập.",
   "tradeoff": "Mỗi lần tách là đổi một lời gọi hàm (nhanh, chắc chắn) lấy một lời gọi mạng (chậm, có thể lỗi), và mất transaction chung."
  },
  "tldr": "Tách service phải có lý do cụ thể mới đáng: nó cho deploy và scale độc lập nhưng biến mọi tương tác thành gọi qua mạng. Modular monolith cho phần lớn lợi ích về ranh giới mà chưa phải trả chi phí phân tán.",
  "table": [
   {
    "row": 0,
    "key": "Monolith",
    "why": "Mọi module chạy chung một process và một DB → gọi nhau là gọi hàm, transaction ACID có sẵn. Nhưng chung process thì chung số phận: một module hỏng hay cần scale là cả khối bị ảnh hưởng."
   },
   {
    "row": 1,
    "key": "Modular Monolith",
    "why": "Ranh giới module (API nội bộ, schema riêng) giữ code không rối và chuẩn bị sẵn đường tách; vẫn một process nên chưa tốn chi phí mạng hay saga. Thiếu kỷ luật thì module gọi tắt vào nhau và quay về monolith rối."
   },
   {
    "row": 2,
    "key": "Microservices",
    "why": "Process và DB riêng → scale, deploy, lỗi đều tách biệt. Cái giá: mọi lời gọi qua mạng có thể chậm hoặc lỗi, dữ liệu nằm ở nhiều DB nên mất transaction chung, và cần tracing để biết request đi đâu."
   },
   {
    "row": 3,
    "key": "Event-driven",
    "why": "Thêm tính năng mới chỉ cần thêm consumer, vì producer không biết ai nghe; broker giữ event khi consumer chậm. Đổi lại, không chỗ nào nhìn thấy toàn bộ luồng, và dữ liệu giữa các service chỉ nhất quán sau một khoảng trễ."
   },
   {
    "row": 4,
    "key": "Serverless",
    "why": "Tải thấp thì gần như miễn phí, vì nền tảng khởi động môi trường cho từng lần gọi và tính tiền theo lần chạy. Khởi động môi trường mới gây cold start, và tải cao liên tục thì trả theo lần chạy đắt hơn máy chạy sẵn."
   }
  ],
  "sections": [
   {
    "s": 0,
    "title": "Những điều hay bị hỏi",
    "points": [
     {
      "i": 0,
      "key": "**Distributed monolith** — tách thành",
      "why": "Chung DB và deploy cùng lúc là vẫn trả giá mạng mà không được tự do: đổi schema phải phối hợp mọi service, không team nào deploy độc lập."
     },
     {
      "i": 1,
      "key": "**Conway’s Law** — kiến trúc hệ thống p",
      "why": "Ranh giới service trùng ranh giới team thì mỗi team tự quyết trong phạm vi của mình; ngược lại, hai team phải thống nhất mỗi lần thay đổi sẽ tạo ra hai module dính chặt."
     },
     {
      "i": 2,
      "key": "**Database per service** — mỗi service",
      "why": "Buộc đi qua API/event để giữ hợp đồng rõ ràng — service khác đọc thẳng bảng thì đổi schema sẽ phá họ mà không ai biết."
     },
     {
      "i": 3,
      "key": "**Transaction xuyên service** — không",
      "why": "Phải có bước bù trừ khi một bên lỗi, vì ACID transaction cần một DB điều phối khoá và commit; dữ liệu ở hai DB thì mỗi bên chỉ commit được phần của mình."
     },
     {
      "i": 4,
      "key": "**CQRS** — tách mô hình ghi (command)",
      "why": "Tách read/write để mỗi bên tối ưu riêng, vì mô hình tốt cho ghi (chuẩn hoá, ràng buộc chặt) thường tệ cho đọc (cần join, aggregate). Đổi lại, read model trễ hơn write model một chút."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Đừng mở đầu bằng microservices trong",
    "why": "Nói lý do tách từng service cho thấy quyết định có cơ sở — interviewer đánh giá bạn có cân nhắc chi phí không."
   },
   {
    "i": 1,
    "key": "Tách service theo bounded context (DDD)",
    "why": "Tách theo tầng kỹ thuật khiến mọi tính năng phải sửa nhiều service cùng lúc — đúng loại coupling mà microservices muốn tránh."
   }
  ]
 },
 "dev-methods": {
  "story": {
   "problem": "Viết code xong mới viết test (hoặc không viết) → test bám theo code có sẵn, bỏ sót edge case, mỗi lần refactor là một lần cầu may. Yêu cầu mơ hồ khiến dev làm đúng ý mình nhưng sai ý business.",
   "idea": "Đặt kiểm chứng **trước** khi viết code: TDD ở mức hàm, BDD/ATDD ở mức hành vi và tiêu chí nghiệm thu; DDD đặt mô hình nghiệp vụ làm trung tâm để code nói đúng ngôn ngữ business.",
   "tradeoff": "Tốn thời gian lúc đầu và cần kỷ luật; áp máy móc (test mọi getter, Gherkin cho mọi thứ, DDD cho CRUD) thì chi phí lớn hơn lợi ích."
  },
  "tldr": "TDD, BDD, ATDD và DDD không thay thế nhau mà xếp lớp được. Ba cái đầu khác nhau ở **mức** của thứ được kiểm chứng trước (hàm, hành vi, tiêu chí story); DDD trả lời câu hỏi khác hẳn: mô hình nghiệp vụ trông thế nào.",
  "table": [
   {
    "row": 0,
    "key": "TDD (Test-Driven Development)",
    "why": "Viết test trước buộc code gọi được từ bên ngoài với input rõ ràng → code tự nhiên nhỏ, ít phụ thuộc; bộ test tích luỹ thành lưới an toàn cho refactor. Test kiểm tra chi tiết nội bộ thay vì hành vi thì vỡ mỗi lần refactor — lợi ích thành gánh nặng."
   },
   {
    "row": 1,
    "key": "BDD (Behavior-Driven Development)",
    "why": "Hiểu sai được phát hiện trước khi code, vì kịch bản viết bằng ngôn ngữ nghiệp vụ nên PO, QA đọc và sửa được. Mỗi câu Given/When/Then cần step definition và thường chạy qua nhiều lớp → duy trì tốn công, chạy chậm."
   },
   {
    "row": 2,
    "key": "ATDD (Acceptance Test-Driven Development)",
    "why": "“Xong” nghĩa là test pass, không phải “dev thấy ổn”, vì tiêu chí nghiệm thu được viết thành test tự động trước khi làm. Các test này chạm nhiều thành phần nên cần môi trường và chạy lâu."
   },
   {
    "row": 3,
    "key": "DDD (Domain-Driven Design)",
    "why": "Ranh giới module/service khớp với cách business vận hành, vì bounded context chia hệ thống theo chỗ thuật ngữ nghiệp vụ đổi nghĩa. Cần nhiều buổi làm việc với chuyên gia domain — vô ích nếu nghiệp vụ chỉ là CRUD."
   },
   {
    "row": 4,
    "key": "Consumer-Driven Contract Testing",
    "why": "Đổi một field mà consumer cần sẽ đỏ trong CI của provider — trước khi deploy — vì provider kiểm tra theo đúng những gì consumer thật sự dùng. Cần một broker lưu hợp đồng, và các team phải giữ hợp đồng cập nhật."
   },
   {
    "row": 5,
    "key": "Property-Based Testing",
    "why": "Property-based test tìm được bug mà ví dụ viết tay bỏ sót, vì framework sinh rất nhiều input, kể cả giá trị biên, rồi tự thu gọn lỗi về ví dụ nhỏ nhất. Khó ở chỗ phải nêu được tính chất đúng với mọi input."
   }
  ],
  "sections": [
   {
    "s": 0,
    "title": "Chúng kết hợp với nhau thế nào",
    "points": [
     {
      "i": 0,
      "key": "**Double-loop TDD** — vòng ngoài là acc",
      "why": "Cần cả hai vòng: acceptance test cho biết khi nào tính năng xong, unit test dẫn dắt từng mảnh code bên trong. Chỉ có vòng ngoài thì debug chậm; chỉ có vòng trong thì có thể đúng từng hàm mà sai tính năng."
     },
     {
      "i": 1,
      "key": "**DDD + Hexagonal/Clean** — DDD cho bi",
      "why": "Mô hình domain chỉ giữ được thuần khi kiến trúc ngăn nó import hạ tầng; ngược lại kiến trúc sạch mà domain nghèo nàn thì core chẳng có gì để bảo vệ."
     },
     {
      "i": 2,
      "key": "**Testing pyramid** — nhiều unit test",
      "why": "Dồn phần lớn kiểm chứng xuống tầng rẻ và ổn định: unit test chạy mili-giây và chỉ hỏng vì một lý do, còn E2E chạy vài giây đến vài phút và hỏng vì mạng, dữ liệu, timing."
     }
    ]
   },
   {
    "s": 1,
    "title": "DDD: các khái niệm cần biết",
    "table": [
     {
      "row": 0,
      "key": "Ubiquitous language",
      "why": "Code dùng đúng từ của business → cuộc trò chuyện với chuyên gia domain chuyển thẳng thành code, không qua bước “dịch” dễ sai."
     },
     {
      "row": 1,
      "key": "Bounded context",
      "why": "Tách context để mỗi nơi có một model vừa đủ — cố dùng một model Customer cho mọi nơi sẽ thành class khổng lồ đầy field không liên quan."
     },
     {
      "row": 4,
      "key": "Aggregate",
      "why": "Luật bất biến (tổng đơn = tổng item) luôn được kiểm tra, vì mọi thay đổi đi qua aggregate root; một transaction chỉ sửa một aggregate để giữ khoá nhỏ."
     },
     {
      "row": 5,
      "key": "Domain event",
      "why": "Phát event thay vì gọi trực tiếp → các phần khác phản ứng mà aggregate không phải biết tới chúng. Đây là nền tảng cho event-driven giữa các service."
     }
    ]
   },
   {
    "s": 2,
    "title": "Không phải phương pháp code nhưng hay bị hỏi",
    "points": [
     {
      "i": 0,
      "key": "**Agile / Scrum / Kanban** — cách tổ ch",
      "why": "Đừng trả lời “Scrum” khi được hỏi cách đảm bảo chất lượng code: đây là khung quản lý công việc, một team Scrum vẫn có thể viết code không test."
     },
     {
      "i": 1,
      "key": "**XP (Extreme Programming)** — gói thực",
      "why": "Nhắc XP cho thấy bạn biết TDD là một phần của bộ thực hành kỹ thuật, không đứng một mình — XP là nơi TDD và CI xuất phát."
     },
     {
      "i": 3,
      "key": "**Trunk-based development** — mọi người",
      "why": "Merge nhỏ, thường xuyên cộng feature flag giữ nhánh chính luôn deploy được; nhánh sống lâu thì gây merge conflict lớn."
     }
    ]
   }
  ],
  "tips": [
   {
    "i": 0,
    "key": "Phân biệt rõ khi trả lời: TDD/BDD là c",
    "why": "Phân loại đúng cho thấy hiểu mỗi thứ giải quyết vấn đề gì — nhiều ứng viên trộn lẫn ba loại này."
   },
   {
    "i": 1,
    "key": "Khi nói về TDD, nhắc vòng Red → Green",
    "why": "Giá trị thật của TDD là thiết kế nhỏ gọn và refactor không sợ; coverage cao vẫn có thể kiểm tra sai thứ."
   }
  ]
 }
};

window.PWHY = {
 "bitly": {
  "hld": "Tách **Read Service** và **Write Service** để scale riêng — hàng chục instance đọc, vài instance ghi — vì đọc gấp ~1000 lần ghi. **Redis Counter** sinh code từ một bộ đếm toàn cục: đảm bảo không trùng mà không phải kiểm tra DB mỗi lần. **Redis Cache** đứng trước DB vì traffic redirect dồn vào một phần nhỏ link hot → cache hit cao, phần lớn request không chạm Postgres. Chọn **Postgres** thay vì NoSQL: 1B × 500B ≈ 500GB vẫn vừa một instance, truy vấn chỉ là lookup theo primary key, nên không cần trả giá phức tạp của hệ phân tán.",
  "nfr": [
   {
    "i": 0,
    "key": "Short code **duy nhất**",
    "why": "Hai URL cùng code thì một trong hai redirect sai đích, vì short code là khoá tra cứu duy nhất. Yêu cầu này quyết định cơ chế sinh code: counter + base62, thay vì random/hash phải kiểm tra trùng."
   },
   {
    "i": 1,
    "key": "Redirect latency < 100ms",
    "why": "Mỗi ms cộng thêm là độ trễ trước khi trang đích bắt đầu tải, vì redirect nằm ngay trên đường click của người dùng. Yêu cầu này dẫn tới cache Redis, index theo `short_code` và CDN edge cho link hot."
   },
   {
    "i": 2,
    "key": "1B URL, 100M DAU; đọc gấp ~1000 lần ghi",
    "why": "Bottleneck là throughput đọc, không phải dung lượng (500GB), vì đọc gấp ~1000 lần ghi. Hệ quả: tách Read/Write Service, đầu tư cache và read replica thay vì sharding DB."
   },
   {
    "i": 3,
    "key": "Availability > consistency (link mới chậ",
    "why": "Replica trễ vài giây gần như không ai thấy, vì link mới tạo hiếm khi bị click ngay trong vài giây đầu. Nhờ đó được đọc từ replica và cache bất đồng bộ; đổi lại, hệ thống vẫn redirect được khi primary gặp sự cố."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Sinh short code thế nào để không trùng?",
    "bad": "Cắt ký tự đầu cho ra code trùng hàng loạt, vì nhiều URL chung prefix (ví dụ `https://www.`). Random không kiểm tra thì dính birthday paradox: không gian 62^7 ≈ 3.5T với 1B code → xác suất có ít nhất một cặp trùng gần như 100%.",
    "good": "Hash phân bố đều nên collision hiếm; trùng thì thêm salt là giải quyết được. Nhưng mỗi lần ghi phải đọc DB kiểm tra trùng, và thiếu unique constraint thì hai request đồng thời có thể cùng qua bước kiểm tra rồi cùng ghi (race).",
    "great": "Base62 của counter chắc chắn duy nhất, không cần kiểm tra DB, vì `INCR` của Redis atomic — mỗi số chỉ cấp một lần. Xin trước dải 1,000 số giảm round-trip Redis 1000 lần; persistence + replica giữ counter không quay ngược khi Redis restart (quay ngược = sinh code trùng)."
   },
   {
    "i": 1,
    "key": "Redirect < 100ms với 100M DAU?",
    "bad": "Không có index → mỗi redirect quét tuần tự tới 1B row, mất hàng giây đến hàng phút, vượt xa 100ms.",
    "good": "B-tree index biến lookup thành O(log n), ~vài ms mỗi query. Nhưng mọi request vẫn chạm DB; với hàng chục nghìn redirect/giây lúc peak, một Postgres sẽ nghẽn connection và CPU.",
    "great": "Cache LRU giữ đúng các link hot trong RAM, vì traffic tập trung vào số ít link → hit rate cao, DB chỉ nhận phần miss. Read replica chia phần miss còn lại; CDN edge trả redirect ngay tại PoP gần user, cắt luôn round-trip tới origin."
   },
   {
    "i": 2,
    "key": "301 hay 302?",
    "bad": "301 là permanent: browser cache vĩnh viễn, lần sau đi thẳng tới đích mà không gọi server. Hệ quả: mất dữ liệu đếm click, không đổi được đích, không cho link hết hạn được nữa.",
    "good": "302 buộc browser hỏi lại server mỗi lần, nên server luôn giữ quyền điều khiển. Nhưng câu trả lời chưa nêu cái giá (thêm tải) và lý do nghiệp vụ cụ thể.",
    "great": "Mỗi request phải đi qua server, vì analytics, đổi đích và hết hạn là giá trị cốt lõi của dịch vụ rút gọn link. Cache và CDN đã hấp thụ phần tải thêm đó, nên chi phí thực tế nhỏ so với quyền kiểm soát giữ được."
   }
  ]
 },
 "ticketmaster": {
  "hld": "**Waiting Room** đứng trước gateway để admit theo đợt, giữ lượng request tới backend trong ngưỡng chịu được — vì lúc mở bán có thể 10M user ập vào. Tách **Search Service** + **Elasticsearch** khỏi **Event Service**: search full-text cần inverted index mà Postgres làm kém, và tải đọc gấp ~100 lần ghi không được ảnh hưởng tới luồng đặt vé. **Booking Service** đi với **Postgres** vì đặt vé cần transaction và strong consistency (không bán trùng ghế). **Redis lock** giữ ghế tạm có TTL: lock tự hết hạn khi user bỏ ngang, không phải giữ transaction DB dài; **Stripe** xử lý thẻ để hệ thống không phải gánh PCI DSS.",
  "nfr": [
   {
    "i": 0,
    "key": "**Strong consistency** khi đặt vé (không",
    "why": "Bán trùng là hoàn tiền, khiếu nại và mất uy tín, vì mỗi ghế chỉ bán được một lần. Yêu cầu này buộc luồng booking dùng Postgres transaction + conditional update thay vì kho eventual consistency."
   },
   {
    "i": 1,
    "key": "High availability cho xem/tìm kiếm",
    "why": "Phần xem/tìm sập thì user không vào được luồng mua dù booking vẫn sống, vì đa số traffic là xem/tìm event. Hệ quả: search/xem tách sang ES + cache, chấp nhận dữ liệu cũ vài giây để luôn trả lời được."
   },
   {
    "i": 2,
    "key": "Chịu được event hot (10M user cùng lúc)",
    "why": "Autoscale không kịp khởi động, vì event hot tạo traffic gấp hàng trăm lần bình thường chỉ trong vài phút. Yêu cầu này sinh ra Waiting Room: chặn và xếp hàng từ cửa vào thay vì cố chịu toàn bộ."
   },
   {
    "i": 3,
    "key": "Search < 500ms; đọc gấp ~100 lần ghi",
    "why": "Search phải có engine riêng, vì đọc gấp ~100 lần ghi và user bỏ đi nếu tìm chậm. Hệ quả: Elasticsearch đồng bộ qua CDC + cache kết quả phổ biến, không dồn tải lên Postgres."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Giữ ghế trong lúc user thanh toán thế nà",
    "bad": "Mỗi user đang thanh toán chiếm một connection, vì `SELECT FOR UPDATE` giữ row lock và connection suốt 10 phút. Pool vài trăm connection thì chỉ cần vài trăm người đang trả tiền là cạn pool, cả hệ thống đứng.",
    "good": "Lưu `RESERVED` + `expires_at` giải phóng connection ngay sau khi ghi, không còn giữ lock dài. Nhưng cron chạy theo chu kỳ (ví dụ mỗi phút) nên ghế hết hạn vẫn bị khoá thêm tới một chu kỳ, và cron là thêm một thành phần phải vận hành.",
    "great": "Ghế nhả đúng lúc hết hạn mà không cần cron, vì key Redis có TTL tự xoá. Khi xác nhận, `UPDATE ... WHERE status='AVAILABLE'` trên Postgres là chốt chặn cuối: dù lock Redis hết hạn hay mất, chỉ một transaction cập nhật được row."
   },
   {
    "i": 1,
    "key": "10 triệu người vào cùng lúc khi mở bán?",
    "bad": "Autoscale tới muộn: instance mới cần vài phút để khởi động, còn spike xảy ra trong vài giây. DB và Booking Service không dễ scale ngang, nên sập trước khi máy mới kịp lên.",
    "good": "Rate limit bảo vệ backend khỏi quá tải, cache seat map giảm đọc DB. Nhưng user bị từ chối ngẫu nhiên (429), phải F5 liên tục → thêm tải, và không công bằng theo thứ tự đến.",
    "great": "Hệ thống admit đúng thứ tự từng đợt, với số lượng backend chịu được, vì sorted set lưu user theo thời điểm vào (score = timestamp). SSE đẩy vị trí trong hàng nên client không cần poll, cắt hẳn tải refresh."
   },
   {
    "i": 2,
    "key": "Search nhanh và chịu tải?",
    "bad": "Mỗi query quét toàn bảng, vì `LIKE '%taylor%'` có wildcard đầu nên B-tree index không dùng được. Cộng tải đọc lớn lúc mở bán, Postgres nghẽn và kéo theo luồng booking dùng chung DB.",
    "good": "Full-text index (GIN) tìm theo từ mà không quét bảng. Nhưng query search vẫn chạy chung DB với booking, thiếu fuzzy matching/ranking tốt và khó scale đọc riêng.",
    "great": "Tải search không chạm Postgres, vì Elasticsearch là cluster riêng có inverted index, fuzzy và ranking. CDC đọc WAL đẩy thay đổi sang ES → đồng bộ gần realtime mà app không phải dual-write; cache kết quả phổ biến cắt tiếp phần lớn query lặp lại."
   }
  ]
 },
 "dropbox": {
  "hld": "**S3** giữ nội dung file, **Metadata DB** chỉ giữ thông tin nhỏ (tên, chunk, version) → DB gọn, query nhanh dù file tới 50GB. **File Service** không truyền byte, chỉ cấp presigned URL: client upload/download thẳng S3, backend không thành bottleneck băng thông. **Sync Service** tách riêng vì nó giữ kết nối lâu (long-poll/WebSocket) để báo thay đổi cho thiết bị khác — kiểu tải khác hẳn API ghi metadata. **CDN** đứng trước S3 cho download để user tải file từ PoP gần mình, giảm latency và chi phí egress.",
  "nfr": [
   {
    "i": 0,
    "key": "File tới 50GB, upload **resumable**",
    "why": "Không resume được thì user không bao giờ upload xong: file 50GB trên mạng gia đình mất hàng giờ, rớt mạng giữa chừng là làm lại từ đầu. Yêu cầu này dẫn tới chia chunk + multipart upload + lưu trạng thái từng chunk."
   },
   {
    "i": 1,
    "key": "Availability > consistency",
    "why": "User cần mở được file ngay cả khi một phần hệ thống lỗi, còn thấy bản cũ vài giây thì không gây hại. Nhờ đó metadata được replicate bất đồng bộ; conflict xử lý bằng bản copy kiểu `conflicted copy` thay vì khoá toàn cục."
   },
   {
    "i": 2,
    "key": "Sync nhanh, tiết kiệm băng thông",
    "why": "Sửa một byte trong file 1GB mà tải lại cả 1GB là phí băng thông và thời gian. Yêu cầu này dẫn tới delta sync theo chunk hash và push thông báo thay vì polling."
   },
   {
    "i": 3,
    "key": "Bảo mật, chỉ người được chia sẻ mới truy",
    "why": "Link lộ ra là rò rỉ vĩnh viễn, vì file cá nhân/doanh nghiệp là dữ liệu nhạy cảm. Hệ quả: kiểm tra quyền trước khi cấp URL, URL ngắn hạn và mã hoá at rest."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Upload file 50GB?",
    "bad": "Mọi byte đi qua backend → file 50GB chiếm một worker và băng thông server hàng giờ; nhiều user cùng upload là backend cạn băng thông. Request HTTP đơn lẻ còn dính timeout và giới hạn body (API Gateway thường giới hạn 10MB), rớt mạng là mất hết.",
    "good": "Presigned URL cho client đẩy thẳng lên S3, backend hết gánh băng thông. Nhưng một PUT đơn của S3 giới hạn 5GB, và rớt mạng vẫn phải upload lại từ đầu.",
    "great": "Multipart upload chia file thành part độc lập: các part chạy song song (tăng throughput), part lỗi chỉ cần gửi lại chính nó. Lưu trạng thái chunk để resume sau khi tắt máy; S3 event xác nhận để metadata chỉ đánh dấu xong khi object thật sự tồn tại."
   },
   {
    "i": 1,
    "key": "Đồng bộ nhanh giữa thiết bị?",
    "bad": "Mỗi thay đổi nhỏ kéo theo tải lại nguyên file: file 1GB sửa 1KB vẫn tốn 1GB băng thông cho mỗi thiết bị.",
    "good": "Polling `/changes` chỉ tải file đã đổi nên bớt lãng phí. Nhưng chu kỳ poll tạo độ trễ (poll 30s thì trễ tới 30s), hàng triệu client poll liên tục tạo tải vô ích, và vẫn tải lại cả file.",
    "great": "Độ trễ còn vài giây mà không tốn request rỗng, vì long-poll/WebSocket đẩy thông báo ngay khi có thay đổi. Content-defined chunking cắt chunk theo nội dung nên chèn byte ở đầu file chỉ đổi vài chunk; client so hash và chỉ tải chunk mới."
   },
   {
    "i": 2,
    "key": "Chia sẻ an toàn?",
    "bad": "Ai có link (forward, lộ log) đều tải được mãi mãi và không thu hồi được quyền, vì link public không hết hạn và không kiểm tra người truy cập.",
    "good": "Bảng `SharedFiles` kiểm tra đúng người có quyền trước khi cấp URL. Nhưng URL cấp ra dài hạn thì sau khi thu hồi quyền, URL cũ vẫn dùng được.",
    "great": "URL lộ ra cũng nhanh chóng vô dụng, vì presigned/signed URL có chữ ký và hạn ngắn (vài phút); thu hồi quyền có hiệu lực ngay từ lần cấp sau. Mã hoá at rest bảo vệ cả khi storage bị truy cập trái phép."
   }
  ]
 },
 "whatsapp": {
  "hld": "Cần hàng nghìn **Chat Server**, và tin nhắn phải tìm đúng server của người nhận — vì mỗi server chỉ giữ ~vài trăm nghìn WebSocket. **Redis Pub/Sub** làm lớp định tuyến: server giữ kết nối của Bob subscribe kênh của Bob, nên server của Alice chỉ cần publish, không cần biết topology. **Messages DB** dùng Cassandra vì ghi rất nhiều và đọc theo `chatId` theo thứ tự thời gian — đúng kiểu partition key + clustering key, scale ngang dễ hơn Postgres. **Inbox** tồn tại vì Pub/Sub không lưu tin: người nhận offline thì tin nằm trong inbox chờ tới khi họ online và ack.",
  "nfr": [
   {
    "i": 0,
    "key": "Latency < 500ms khi cả hai online",
    "why": "Trễ quá 500ms là người dùng thấy lag, vì chat là hội thoại thời gian thực. Yêu cầu này buộc dùng WebSocket giữ sẵn và định tuyến in-memory (Pub/Sub) thay vì poll hoặc đi qua DB."
   },
   {
    "i": 1,
    "key": "**Guaranteed delivery**",
    "why": "Mất một tin nhắn là mất niềm tin vào app, mà người nhận có thể offline bất kỳ lúc nào. Hệ quả: lưu trước khi gửi, inbox chờ ack, retry at-least-once kèm dedupe."
   },
   {
    "i": 2,
    "key": "Hàng tỷ user, hàng trăm triệu kết nối đồ",
    "why": "Hệ thống phải scale ngang chat server, vì số kết nối đồng thời vượt xa sức một máy. Đây là gốc của bài toán định tuyến tin giữa các server và lý do chọn kho dữ liệu phân tán."
   },
   {
    "i": 3,
    "key": "Thứ tự tin nhắn đúng trong một chat",
    "why": "Thứ tự trong một chat phải giữ đúng, vì tin sai thứ tự làm hội thoại vô nghĩa. Hệ quả: partition theo `chatId` với sort key thời gian/sequence, để mọi tin của một chat nằm cùng chỗ và sắp xếp sẵn."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Tin gửi tới server nào đang giữ kết nối ",
    "bad": "Hàng trăm triệu user online không thể dồn vào một máy, vì một server chỉ giữ được vài trăm nghìn kết nối; máy đó còn là single point of failure.",
    "good": "Consistent hashing biết trước user nằm ở server nào nên gửi thẳng tới đó. Nhưng mỗi lần thêm/bớt server, một phần user phải reconnect sang server mới, và mọi chat server phải theo dõi membership qua ZooKeeper — phức tạp vận hành.",
    "great": "Người gửi chỉ publish vào kênh, không cần biết server nào, vì kênh Pub/Sub đặt theo user và server nào đang giữ kết nối thì subscribe kênh đó. User reconnect sang server khác chỉ cần subscribe lại, không phải cập nhật bảng định tuyến."
   },
   {
    "i": 1,
    "key": "Đảm bảo không mất tin?",
    "bad": "Tin gửi thẳng mà không lưu thì biến mất vĩnh viễn, vì WebSocket có thể đứt đúng lúc gửi hoặc người nhận đang offline.",
    "good": "Lưu DB trước nên tin không mất khi server crash. Nhưng thiếu ack nên server không biết client đã nhận chưa, không biết lúc nào cần gửi lại.",
    "great": "Tin chưa xác nhận được gửi lại khi client reconnect (at-least-once), vì tin chỉ bị xoá khỏi inbox khi client ack. Retry có thể tạo bản trùng, nên client và server dùng `clientMsgId` bỏ bản đã thấy → với người dùng, kết quả tương đương exactly-once."
   },
   {
    "i": 2,
    "key": "Lưu hàng tỷ tin nhắn?",
    "bad": "Một bảng Postgres phình tới hàng chục TB với hàng tỷ tin mỗi ngày: index không còn vừa RAM, write throughput của một primary không đủ.",
    "good": "Shard theo `chatId` chia tải ghi và giữ tin cùng chat chung shard. Nhưng tự shard Postgres thì phải tự lo routing, resharding và failover.",
    "great": "Đọc lịch sử chat là một lần quét tuần tự đã có thứ tự, vì Cassandra/DynamoDB phân tán sẵn theo partition key `chatId` và sắp theo sort key timestamp trong partition. Ghi dạng append (LSM-tree) nên throughput ghi rất cao; TTL tự dọn tin cũ, không cần job xoá."
   }
  ]
 },
 "uber": {
  "hld": "**Location Service** ghi vào **Redis GEO** in-memory thay vì DB quan hệ, vì 2M tài xế gửi vị trí mỗi 5s (~400k write/s) — DB quan hệ không chịu nổi lượng ghi này. **Matching Service** tách riêng: vòng ghép (tìm tài xế gần, gửi lời mời, chờ phản hồi) kéo dài vài giây và cần scale theo lượng request đặt xe. **Redis Lock** đảm bảo mỗi tài xế chỉ nhận lời mời của một chuyến tại một thời điểm, vì nhiều instance Matching có thể cùng chọn một tài xế. **Ride DB** dùng Postgres vì trạng thái chuyến đi cần transaction và tính đúng đắn, còn lượng ghi chuyến nhỏ hơn vị trí hàng trăm lần.",
  "nfr": [
   {
    "i": 0,
    "key": "Ghép xe < 1 phút",
    "why": "Ghép xe phải xong dưới 1 phút, vì rider chờ lâu sẽ huỷ và chuyển app khác. Yêu cầu này đòi truy vấn tài xế gần bằng geo index in-memory và vòng mời có timeout ngắn."
   },
   {
    "i": 1,
    "key": "**Strong consistency**: một tài xế không",
    "why": "Một tài xế nhận hai chuyến thì một rider bị bỏ rơi — trải nghiệm tệ, tốn tiền xử lý. Hệ quả: lock theo driver + conditional update khi accept."
   },
   {
    "i": 2,
    "key": "Chịu peak (2M tài xế gửi vị trí mỗi 5s ≈",
    "why": "400k write/s là con số quyết định thiết kế, vì nó vượt khả năng ghi của DB quan hệ. Hệ quả: vị trí nằm trong Redis GEO, chấp nhận mất vị trí khi lỗi vì 5s sau tài xế gửi lại."
   },
   {
    "i": 3,
    "key": "High availability",
    "why": "Mọi thành phần phải có dự phòng, vì app không đặt được xe là mất doanh thu ngay lập tức. Hệ quả: queue bền cho ride request, replica cho Redis và DB, service stateless."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Ghi 400k vị trí/giây?",
    "bad": "Postgres thường chỉ chịu vài chục nghìn write/s trên một primary, cách xa 400k, vì mỗi `UPDATE` sinh WAL, cập nhật index và lock row. Dữ liệu vị trí lại chỉ có giá trị vài giây — ghi bền vững là lãng phí.",
    "good": "Batch giảm số transaction, PostGIS có spatial index cho truy vấn gần. Nhưng vẫn ghi xuống đĩa và cập nhật index cho dữ liệu chỉ sống 5 giây; batch còn tạo độ trễ khiến vị trí bị cũ.",
    "great": "Một cluster Redis nhỏ chịu được 400k write/s, vì Redis GEO lưu trong RAM dưới dạng sorted set theo geohash nên ghi và `GEOSEARCH` đều nhanh. Adaptive interval giảm tần suất gửi khi tài xế đứng yên, cắt phần lớn write vô ích."
   },
   {
    "i": 1,
    "key": "Không gửi một tài xế cho hai chuyến?",
    "bad": "Tài xế nhận hai chuyến: hai instance Matching cùng đọc thấy tài xế rảnh rồi cùng gửi lời mời (check-then-act), cả hai đều nghĩ mình hợp lệ.",
    "good": "Transaction + cột status trên DB chặn được hai chuyến cùng gán một tài xế. Nhưng vòng mời kéo dài 10s: giữ transaction/row lock suốt thời gian đó làm DB nghẽn, còn không giữ thì vẫn race giữa lúc mời và lúc accept.",
    "great": "Chỉ một Matching instance giành được lock của tài xế, vì `SET NX` atomic; `EX 10` tự nhả nếu tài xế không phản hồi, không cần dọn dẹp. Conditional update khi accept (`WHERE status='AVAILABLE'`) là chốt cuối, phòng trường hợp lock đã hết hạn."
   },
   {
    "i": 2,
    "key": "Không mất yêu cầu lúc peak?",
    "bad": "Matching quá tải thì request timeout và rơi mất, vì xử lý đồng bộ; crash giữa vòng ghép cũng mất luôn yêu cầu.",
    "good": "Autoscale thêm năng lực khi tải tăng. Nhưng máy mới khởi động mất vài phút, trong khi peak (tan tầm, mưa) đến trong vài giây, và request đang xử lý vẫn mất khi instance chết.",
    "great": "Peak chỉ làm hàng đợi dài hơn, không mất request, vì Kafka lưu request bền vững trước khi xử lý. Partition theo khu vực giữ request cùng vùng một chỗ và scale độc lập; workflow bền vững (ví dụ Temporal) lưu trạng thái vòng ghép — worker chết thì worker khác làm tiếp."
   }
  ]
 },
 "news-feed": {
  "hld": "**Post Service** chỉ lưu bài rồi đẩy event vào **Kafka**, **Fan-out Worker** xử lý bất đồng bộ phía sau — vì đăng bài phải nhanh, còn phát bài tới follower thì tốn kém. **Feed Cache** (Redis) giữ sẵn danh sách post id của từng reader, nên mở feed chỉ là đọc một list thay vì JOIN follow với posts. **Posts DB** dùng DynamoDB vì truy cập chủ yếu là get theo `postId` ở quy mô 2B user — key-value scale ngang dễ hơn Postgres. **Follow DB** tách riêng vì Fan-out Worker cần quét danh sách follower, còn Feed Service cần danh sách celebrity mình theo dõi để merge lúc đọc.",
  "nfr": [
   {
    "i": 0,
    "key": "Feed load < 500ms",
    "why": "Feed chậm là user rời đi, vì đây là màn hình đầu tiên khi mở app. Yêu cầu này buộc precompute feed vào cache, đọc feed chỉ còn một lần lấy list."
   },
   {
    "i": 1,
    "key": "Bài mới hiện trong feed trong ~1 phút (e",
    "why": "Cho phép trễ ~1 phút, vì user không biết hay cần bài xuất hiện tức thì. Nhờ đó fan-out chạy bất đồng bộ qua Kafka thay vì đồng bộ trong request đăng bài."
   },
   {
    "i": 2,
    "key": "2B user",
    "why": "Mọi dữ liệu (post, follow, feed) phải phân tán và scale ngang ở quy mô 2B user. Hệ quả: DynamoDB, Redis cluster và worker scale theo partition Kafka."
   },
   {
    "i": 3,
    "key": "Follow không giới hạn (celebrity)",
    "why": "Fan-out on write một bài của celebrity là 100M lần ghi cache, vì celebrity có thể có 100M follower. Yêu cầu này sinh ra mô hình hybrid: bài celebrity được kéo lúc đọc thay vì đẩy lúc ghi."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Fan-out on write hay on read?",
    "bad": "Không thể dưới 500ms ở quy mô 2B user: mỗi lần mở feed phải JOIN follow (có thể hàng nghìn người) với posts rồi sort — query nặng chạy lặp lại hàng tỷ lần mỗi ngày.",
    "good": "Precompute biến đọc feed thành một lần đọc list, nhanh và rẻ. Nhưng một bài của celebrity 100M follower tạo 100M lần ghi, worker tồn đọng hàng giờ và bài tới muộn hơn mức 1 phút.",
    "great": "Bỏ celebrity khỏi fan-out on write và merge bài của họ lúc đọc giữ cả ghi lẫn đọc ở mức rẻ, vì celebrity chỉ chiếm số ít tài khoản nhưng gây phần lớn chi phí fan-out. Cache chỉ giữ vài trăm id gần nhất vì ít ai cuộn xa hơn → tiết kiệm RAM cho 2B user."
   },
   {
    "i": 1,
    "key": "Một bài viral bị đọc hàng triệu lần?",
    "bad": "Partition chứa bài đó bị dồn hàng triệu read/s, vượt giới hạn throughput của một partition (DynamoDB ~3,000 RCU/partition), vì mọi lượt xem đều chạm cùng một row.",
    "good": "Cache Redis hấp thụ phần lớn lượt đọc. Nhưng key `post:88` vẫn nằm trên một node Redis duy nhất — node đó nghẽn CPU/băng thông khi bài viral (hot key).",
    "great": "Tải đọc chia đều cho N node: nhân bản key thành `post:88#1..N` rải trên N node, client chọn ngẫu nhiên một bản. Bài đã đăng ít khi sửa nên N bản dễ giữ nhất quán."
   },
   {
    "i": 2,
    "key": "Phân trang feed?",
    "bad": "`OFFSET n` buộc DB đọc rồi bỏ n row đầu → trang càng sâu càng chậm. Bài mới chèn lên đầu còn đẩy mọi bài xuống, nên trang sau lặp lại bài đã xem.",
    "good": "Cursor theo timestamp (`WHERE ts < cursor`) dùng index nên mọi trang nhanh như nhau, và bài mới ở đầu không làm lệch trang sau. Nhưng nhiều bài cùng timestamp thì cursor không phân biệt được → trùng hoặc sót bài ở ranh giới trang.",
    "great": "Cursor chỉ đúng một vị trí, không trùng không sót kể cả khi nhiều bài cùng timestamp, vì cặp `(timestamp, postId)` duy nhất và có thứ tự toàn phần. So sánh tuple `(ts, id) < (cursor_ts, cursor_id)` vẫn dùng được composite index."
   }
  ]
 },
 "rate-limiter": {
  "hld": "Limiter nằm trong **API Gateway** dưới dạng middleware, không thêm hop mạng riêng, vì nó phải chặn trước khi request tới backend. State (bucket) đặt ở **Redis Cluster** vì nhiều gateway instance cùng phục vụ một client — đếm local ở mỗi gateway sẽ cho client N lần quota. Chọn Redis thay vì DB: mỗi request cần một lần đọc-ghi dưới vài ms ở 1M req/s, chỉ kho in-memory làm được. **Rules config** tách riêng và cache trong gateway vì rule ít đổi — đọc rule mỗi request là phí một round-trip.",
  "nfr": [
   {
    "i": 0,
    "key": "Thêm latency < 10ms",
    "why": "Latency của limiter cộng thẳng vào mọi API, vì nó nằm trên đường đi của mọi request. Hệ quả: chỉ một round-trip Redis mỗi request (Lua script), rule cache local."
   },
   {
    "i": 1,
    "key": "1M request/s",
    "why": "State phải shard, vì 1M req/s vượt khả năng một Redis node (~100k–200k ops/s tuỳ lệnh). Hệ quả: Redis Cluster shard theo `clientId`."
   },
   {
    "i": 2,
    "key": "Availability: limiter lỗi không được làm",
    "why": "Limiter là thành phần phụ trợ — để nó làm sập API là biến lớp bảo vệ thành nguyên nhân sự cố. Hệ quả: fail-open khi Redis lỗi, kèm giám sát và giới hạn local dự phòng."
   },
   {
    "i": 3,
    "key": "Chính xác “đủ dùng” (sai lệch nhỏ chấp n",
    "why": "Cho lọt vài request thừa hiếm khi gây hại, còn đếm chính xác tuyệt đối đòi đồng bộ toàn cục rất đắt. Chấp nhận sai lệch nhỏ thì dùng được token bucket/sliding counter thay vì log đầy đủ, và local pre-check."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Chọn thuật toán nào?",
    "bad": "Client gửi được gấp đôi giới hạn trong khoảng 2 giây: đủ quota ở giây cuối cửa sổ này và đủ quota ở giây đầu cửa sổ sau, vì counter reset cứng ở ranh giới cửa sổ.",
    "good": "Sliding window log tính đúng trong mọi khoảng thời gian nên hết burst ở ranh giới. Nhưng log lưu timestamp mỗi request — quota 1,000 req/phút là 1,000 entry mỗi client, nhân hàng triệu client thì tốn RAM lớn; sliding counter tiết kiệm hơn nhưng chỉ xấp xỉ.",
    "great": "RAM O(1) mỗi client, vì token bucket chỉ lưu `tokens` và `lastRefill`, refill tính lười theo thời gian trôi qua khi có request. Dung lượng bucket cho phép burst có giới hạn rõ, tốc độ refill giữ trung bình đúng quota."
   },
   {
    "i": 1,
    "key": "Nhiều gateway cùng cập nhật một bucket?",
    "bad": "Cả hai request đều lọt (lost update): GET và SET là hai lệnh riêng, hai gateway cùng GET thấy còn 1 token, cùng trừ rồi cùng SET.",
    "good": "`INCR` atomic nên fixed window không mất cập nhật. Nhưng chỉ dùng được cho thuật toán chỉ cần cộng, không áp dụng cho token bucket (cần đọc-tính-ghi); crash giữa `INCR` và `EXPIRE` thì key không bao giờ hết hạn.",
    "great": "Đọc bucket, tính refill, trừ token và ghi lại thành một thao tác atomic, vì Redis chạy Lua script đơn luồng — không lệnh nào chen vào giữa. Toàn bộ chỉ tốn một round-trip, giữ được ngân sách latency < 10ms."
   },
   {
    "i": 2,
    "key": "Scale 1M req/s và khi Redis lỗi?",
    "bad": "1M req/s vượt năng lực một Redis node (khoảng 100k–200k ops/s); node chết thì limiter chết theo.",
    "good": "Shard theo `clientId` chia tải đều ra nhiều node, và mọi request của một client vào cùng shard nên đếm đúng. Nhưng chưa trả lời được khi một shard chết: request của các client trên shard đó bị chặn hoặc lỗi.",
    "great": "Shard hồi phục trong vài giây, vì replica tự promote khi master chết. Fail-open cho request đi qua khi Redis lỗi để limiter không làm sập API, kèm alert để biết đang mất bảo vệ; local pre-check chặn client vượt quá rõ ràng ngay tại gateway, bớt round-trip."
   }
  ]
 },
 "ad-click": {
  "hld": "**Click Processor** chỉ ghi event vào **Kafka** rồi redirect ngay — vì click liên quan tiền, Kafka làm log bền vững để không mất click kể cả khi phía sau chậm. **Flink** đọc stream và aggregate theo phút có checkpoint → số liệu gần realtime mà không ghi từng click vào DB. **S3 raw + Spark** giữ bản gốc để chạy batch reconciliation, phát hiện sai lệch của pipeline streaming. Chọn **OLAP DB** (ClickHouse) thay vì Postgres vì query dashboard là aggregate trên cột (sum theo ad, theo giờ): columnar storage chỉ đọc cột cần và nén tốt nên trả lời dưới 1s.",
  "nfr": [
   {
    "i": 0,
    "key": "10k click/s trung bình, peak cao hơn nhi",
    "why": "Hệ thống phải hấp thụ spike, vì peak gấp nhiều lần trung bình (campaign, giờ cao điểm). Hệ quả: Kafka làm buffer giữa ingest và xử lý, partition để scale ngang."
   },
   {
    "i": 1,
    "key": "Query < 1s",
    "why": "Query chậm là trải nghiệm tệ, vì advertiser xem dashboard tương tác. Hệ quả: chỉ query trên bảng đã pre-aggregate trong OLAP columnar, không quét raw."
   },
   {
    "i": 2,
    "key": "**Không mất click, không đếm trùng** (li",
    "why": "Mất click là thất thu, đếm trùng là tính tiền sai cho khách, vì click là cơ sở tính tiền. Hệ quả: log bền vững, exactly-once trong Flink, dedupe theo id và đối soát batch."
   },
   {
    "i": 3,
    "key": "Số liệu gần realtime (trễ vài phút)",
    "why": "Trễ vài phút là chấp nhận được, vì advertiser chỉ cần điều chỉnh campaign theo xu hướng. Nhờ đó aggregate theo cửa sổ phút trong stream thay vì cập nhật counter từng click."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Scale 10k+ click/s, có ad cực hot?",
    "bad": "DB nghẽn vì mỗi click là một transaction: 10k write/s trung bình, peak cao hơn nhiều. DB chậm thì redirect của user cũng chậm theo.",
    "good": "Kafka hấp thụ write với throughput rất cao; partition theo `adId` cho Flink đếm mỗi ad tại một chỗ. Nhưng một ad cực hot dồn toàn bộ click vào một partition — consumer của partition đó thành bottleneck.",
    "great": "Tải chia cho N consumer, vì salt (`adId:0..N`) rải click của ad hot ra N partition. Flink cộng N count con ở bước sau; kết quả vẫn đúng vì phép đếm có tính cộng."
   },
   {
    "i": 1,
    "key": "Không mất và không đếm trùng?",
    "bad": "App server restart hoặc crash là mất toàn bộ số đếm chưa flush, vì counter nằm trong RAM; nhiều server cũng không đếm nhất quán chung được.",
    "good": "Kafka retention giữ event để replay; Flink checkpoint lưu state + offset nên crash xong khôi phục mà không mất hay đếm trùng trong pipeline. Nhưng click trùng từ nguồn (user bấm hai lần, bot, client retry) đã vào Kafka thành hai event riêng nên vẫn bị đếm.",
    "great": "Flink dedupe theo `impressionId` loại được click lặp và id giả mạo, vì server ký id đó lúc hiển thị ad. Batch reconciliation trên raw S3 tính lại độc lập, lệch với số streaming thì sửa — lớp kiểm tra thứ hai cho dữ liệu tiền."
   },
   {
    "i": 2,
    "key": "Query nhanh trên dữ liệu khổng lồ?",
    "bad": "`COUNT(*)` trên vài tháng raw là quét hàng chục tỷ row (~864M row mỗi ngày), mất phút tới giờ.",
    "good": "Pre-aggregate theo phút giảm số row từ mỗi click xuống mỗi (ad, phút). Nhưng query khoảng dài (30 ngày) vẫn phải cộng 43,200 bucket mỗi ad, và DB hàng (row-store) đọc cả row dù chỉ cần một cột.",
    "great": "Scan aggregate nhanh hơn row-store nhiều lần, vì columnar storage chỉ đọc cột cần và nén mạnh. Rollup giờ/ngày giảm 60–1440 lần số row cho query khoảng dài; dashboard chọn bảng có độ chi tiết phù hợp và trả lời dưới 1s."
   }
  ]
 },
 "top-k": {
  "hld": "**Video Player** gửi event vào **Kafka** partition theo `videoId`, **Counter Workers** đếm in-memory theo partition — vì 800k view/s vượt xa khả năng ghi của DB. **Count Store** lưu count theo (video, phút) vì cửa sổ trượt 1 giờ/1 ngày cần bucket nhỏ để cộng đầu trừ đuôi. **Top-K Merger** định kỳ gom top K cục bộ của mỗi partition thành top K toàn cục, vì tính top K lúc query trên hàng tỷ video không thể dưới 100ms. **Top-K Cache** (Redis) giữ kết quả tính sẵn để **Query API** chỉ đọc một key.",
  "nfr": [
   {
    "i": 0,
    "key": "Kết quả trễ tối đa ~1 phút",
    "why": "Trễ ~1 phút chấp nhận được, vì bảng xếp hạng chỉ cần phản ánh xu hướng. Nhờ đó top K được precompute định kỳ mỗi phút thay vì cập nhật theo từng view."
   },
   {
    "i": 1,
    "key": "Query < 100ms",
    "why": "Không được tính top K lúc query, vì query này được gọi rất nhiều (trang chủ, trending). Hệ quả: kết quả precompute trong cache, query chỉ là một lần đọc key."
   },
   {
    "i": 2,
    "key": "~800k view/s (70B view/ngày)",
    "why": "Với ~800k event/s, mọi thiết kế ghi từng view vào DB đều sập. Hệ quả: đếm in-memory trên stream, partition theo `videoId`, flush theo batch."
   },
   {
    "i": 3,
    "key": "Chính xác (hoặc sai số nhỏ đã thống nhất",
    "why": "Độ chính xác quyết định kiến trúc: chính xác tuyệt đối cần đếm từng video, còn sai số nhỏ cho phép dùng sketch tiết kiệm RAM. Phải chốt với interviewer trước để chọn giữa heap trên count chính xác và Count-Min Sketch."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Đếm ~800k view/giây?",
    "bad": "Video hot nhận hàng nghìn update/giây trên cùng một row nên tranh chấp lock, vì mỗi `UPDATE` khoá row; tổng 800k write/s vượt xa khả năng của một DB.",
    "good": "Gom batch biến hàng nghìn +1 thành một lần `+n`, giảm số write hàng trăm lần. Nhưng worker crash trước khi ghi batch là mất số đếm, và chưa nói rõ chia worker thế nào để không đếm trùng.",
    "great": "Không tranh chấp và cộng in-memory rất nhanh, vì partition theo `videoId` nên mỗi video chỉ một worker đếm. Checkpoint của Flink lưu state + offset để crash xong khôi phục chính xác; video cực hot chia sub-partition rồi cộng lại để một worker không thành bottleneck."
   },
   {
    "i": 1,
    "key": "Tính top K thế nào?",
    "bad": "Sort hàng tỷ video là O(n log n) → mỗi query mất hàng giây đến hàng phút, không thể dưới 100ms.",
    "good": "Heap kích thước K giảm xuống O(n log K), RAM O(K). Nhưng mỗi query vẫn quét toàn bộ bảng count.",
    "great": "Merge N heap nhỏ là đủ và đúng: mỗi video chỉ nằm ở một partition, nên top K toàn cục chắc chắn nằm trong hợp các top K cục bộ. Kết quả precompute vào cache mỗi phút; khi chấp nhận sai số, Count-Min Sketch thay bảng count với RAM cố định bất kể số video."
   },
   {
    "i": 2,
    "key": "Cửa sổ trượt 1 giờ / 1 ngày?",
    "bad": "Count tích luỹ vô hạn — kết quả là top all-time chứ không phải top 1 giờ — vì chỉ cộng mà không trừ view đã ra khỏi cửa sổ.",
    "good": "Tính lại từ bucket phút cho kết quả đúng. Nhưng cửa sổ 1 ngày là cộng 1,440 bucket cho mỗi video mỗi phút, chi phí lớn khi số video nhiều.",
    "great": "Mỗi phút chỉ cần hai phép cộng/trừ cho mỗi video có thay đổi, vì count(cửa sổ) = count cũ + bucket mới vào − bucket vừa ra. Consumer thứ hai đọc Kafka trễ đúng một cửa sổ phát ra event trừ, nên phần trừ dùng cùng logic đếm — chỉ cần Kafka retention dài hơn cửa sổ."
   }
  ]
 },
 "web-crawler": {
  "hld": "**URL Frontier** là queue bền (SQS/Kafka): URL không mất khi worker chết và nhiều crawler cùng lấy việc được — vì 10B URL không thể giữ trong RAM một máy. Tách **Crawler** (tải HTML) và **Parser workers** (trích link, nội dung) vì crawler bị giới hạn bởi mạng còn parser bởi CPU — tách ra thì scale từng loại theo bottleneck riêng. **S3** lưu raw HTML vì dung lượng lớn và cho phép parse lại khi đổi logic mà không phải crawl lại. **Domain + URL DB** giữ robots.txt, thời điểm crawl cuối của mỗi domain và URL đã thấy, phục vụ politeness và dedupe.",
  "nfr": [
   {
    "i": 0,
    "key": "10B trang trong 5 ngày (~23k trang/s)",
    "why": "Một máy không làm nổi, vì 10B trang trong 5 ngày tương đương ~23k trang/s. Hệ quả: hàng trăm crawler song song lấy việc từ queue chung, scale theo băng thông mạng."
   },
   {
    "i": 1,
    "key": "**Politeness**: tôn trọng robots.txt, gi",
    "why": "Crawl dồn dập làm sập website và bị chặn IP → crawler mất khả năng tiếp cận trang. Hệ quả: tuân thủ robots.txt và rate limit theo domain trước khi tải."
   },
   {
    "i": 2,
    "key": "Fault tolerant: worker chết không mất UR",
    "why": "Worker chết là chắc chắn xảy ra khi hàng trăm worker chạy nhiều ngày. Hệ quả: frontier bền, chỉ xác nhận URL sau khi xử lý xong, retry + DLQ."
   },
   {
    "i": 3,
    "key": "Không crawl trùng URL / trùng nội dung",
    "why": "Crawl trùng là phí băng thông và làm bẩn index, vì web có nhiều URL trỏ về cùng nội dung (tham số, mirror). Hệ quả: Bloom filter cho URL, hash nội dung cho trang trùng."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Không mất tiến độ khi worker chết?",
    "bad": "Crawler crash là mất toàn bộ URL đang chờ và tiến độ, phải bắt đầu lại, vì frontier nằm trong RAM; hàng tỷ URL cũng không vừa RAM một máy.",
    "good": "Queue bền giữ URL khi worker chết; commit offset sau khi xử lý nên URL chưa xong sẽ được đọc lại. Nhưng Kafka commit theo offset nên một URL chậm/lỗi chặn cả partition phía sau, và không có retry có delay riêng cho từng URL.",
    "great": "Worker chết thì message tự quay lại queue cho worker khác, xử lý theo từng message — vì SQS ẩn message trong visibility timeout và tự hiện lại nếu không bị xoá. Backoff tránh dồn retry vào site đang lỗi, DLQ gom URL lỗi mãi để không lặp vô hạn; raw HTML lưu S3 cho phép parse lại mà không tải lại."
   },
   {
    "i": 1,
    "key": "Lịch sự với website?",
    "bad": "Server nhỏ quá tải như bị DDoS khi hàng trăm crawler cùng gửi request tới một domain; site sẽ chặn IP và crawler mất quyền truy cập.",
    "good": "Tuân thủ robots.txt tránh vùng cấm và đọc `Crawl-delay`. Nhưng không có cơ chế thực thi tốc độ giữa nhiều crawler, và tải robots.txt mỗi lần crawl là thêm một request thừa.",
    "great": "Tốc độ tới domain được giới hạn toàn cục, vì `lastCrawl` theo domain nằm ở Redis dùng chung — mọi crawler kiểm tra cùng một nguồn trước khi tải. URL chưa tới lượt quay lại queue có delay + jitter thay vì chặn worker ngồi chờ; cache robots.txt bỏ request lặp."
   },
   {
    "i": 2,
    "key": "Không crawl trùng URL và trùng nội dung?",
    "bad": "Thiếu kiểm tra thì cùng URL bị crawl lại nhiều lần qua các link khác nhau, và crawler có thể lặp vô hạn giữa các trang link qua lại.",
    "good": "Unique index chặn URL trùng chính xác. Nhưng tra index DB cho mỗi URL ở ~23k trang/s (mỗi trang chứa hàng chục link) tạo hàng trăm nghìn lookup/s, và không phát hiện cùng nội dung ở URL khác.",
    "great": "Kiểm tra trong bộ nhớ, không tốn round-trip DB, vì Bloom filter cho 10B URL tốn khoảng 12GB RAM (~10 bit/URL với 1% false positive) — vẫn rẻ so với tra DB mỗi URL; false positive chỉ làm sót một số ít URL, chấp nhận được. Hash nội dung bắt trang trùng ở URL khác; giới hạn độ sâu chặn trap kiểu calendar vô hạn."
   }
  ]
 },
 "yelp": {
  "hld": "**Search Service** dùng **Elasticsearch** với `geo_point` + inverted index, vì search cần kết hợp vị trí, text và filter trong một query — Postgres làm được từng phần nhưng khó kết hợp nhanh. **Business Service** + **Postgres** giữ dữ liệu gốc (business, review, rating) vì ghi review và cập nhật rating cần transaction. Tách search và business vì đọc gấp nhiều lần ghi: scale search độc lập không ảnh hưởng luồng ghi. Không cần sharding phức tạp: 10M business × vài KB ≈ vài chục GB, vừa một search cluster nhỏ.",
  "nfr": [
   {
    "i": 0,
    "key": "Search < 500ms",
    "why": "Chậm là user mở app khác, vì họ tìm quán khi đang ở ngoài đường. Yêu cầu này đòi geo index + text index trong một engine, không tính khoảng cách tới mọi business."
   },
   {
    "i": 1,
    "key": "100M DAU, 10M business",
    "why": "Bài toán là throughput chứ không phải dung lượng: 100M DAU tạo tải đọc lớn, nhưng 10M business chỉ vài chục GB. Hệ quả: nhân bản index search (replica) thay vì shard sâu."
   },
   {
    "i": 2,
    "key": "Đọc gấp nhiều lần ghi",
    "why": "Dữ liệu đồng bộ sang ES với độ trễ ngắn là đủ, vì business và review ít đổi so với lượng search. Nhờ đó index ổn định và cache hiệu quả."
   },
   {
    "i": 3,
    "key": "Rating trung bình hiển thị đúng",
    "why": "Rating phải phản ánh đúng mọi review, vì rating sai làm mất tin tưởng của cả user lẫn chủ business. Hệ quả: cập nhật `sum`/`count` trong cùng transaction với ghi review."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Search theo vị trí nhanh?",
    "bad": "Mỗi search quét toàn bộ dữ liệu, mất hàng giây ở 100M DAU, vì phải tính khoảng cách tới 10M business cho mỗi query.",
    "good": "Geohash/PostGIS index chỉ xét business trong vùng lân cận nên nhanh hơn nhiều. Nhưng kết hợp với full-text search và filter (loại hình, giá, rating) trong Postgres khó tối ưu — query planner thường chỉ dùng tốt được một index.",
    "great": "Một query lọc theo khoảng cách, khớp text và filter cùng lúc rồi ranking, vì Elasticsearch giữ `geo_point` và inverted index trong cùng document. Dữ liệu business ít đổi nên index không phải rebuild liên tục, cache hiệu quả."
   },
   {
    "i": 1,
    "key": "Rating trung bình?",
    "bad": "Mỗi lượt xem trang tốn một query nặng với business có hàng chục nghìn review, vì `AVG()` đọc toàn bộ review của business mỗi lần xem.",
    "good": "Cron tính trước nên lúc xem chỉ đọc một số. Nhưng rating trễ tới một chu kỳ cron: user vừa viết review không thấy rating đổi — vi phạm yêu cầu hiển thị đúng.",
    "great": "Rating luôn đúng ngay sau khi ghi, đọc chỉ là `sum/count`, vì `sum` và `count` cập nhật trong cùng transaction với insert review. Dùng `UPDATE ... SET sum = sum + ?, count = count + 1` atomic thì hai review đồng thời không làm mất cập nhật."
   },
   {
    "i": 2,
    "key": "Tìm theo tên thành phố / quận?",
    "bad": "So khớp chuỗi bỏ sót business, vì tên địa điểm không chuẩn hoá (\"Q1\", \"Quận 1\", \"District 1\"); chuỗi cũng không cho biết ranh giới địa lý thật.",
    "good": "Polygon định nghĩa đúng ranh giới thành phố/quận nên kiểm tra point-in-polygon chính xác. Nhưng polygon nằm ở Postgres còn search ở ES thì phải query hai hệ rồi giao kết quả.",
    "great": "Lọc theo quận và khớp text chạy trong một request, vì ES `geo_shape` lưu polygon và filter point-in-polygon ngay trong query search. Hết bước giao kết quả giữa hai hệ."
   }
  ]
 },
 "google-docs": {
  "hld": "**LB** route theo `docId` để mọi người sửa cùng doc vào cùng một **Document Service** instance, vì OT cần một nơi duy nhất xếp thứ tự op của mỗi doc. Document Service giữ state doc và version hiện tại trong RAM → transform và broadcast op dưới 100ms mà không đọc DB. **Ops log** dùng Cassandra vì op là luồng append rất nhiều: partition theo `docId` cho đọc tuần tự dễ, ghi throughput cao. **Snapshots** tồn tại vì replay toàn bộ op từ đầu để mở doc sẽ ngày càng chậm; snapshot + op sau nó cho load nhanh.",
  "nfr": [
   {
    "i": 0,
    "key": "Thay đổi hiện < 100ms",
    "why": "Trễ trên 100ms đã thấy giật, vì phải thấy chữ người khác gõ gần như ngay lập tức mới có cảm giác cộng tác. Hệ quả: WebSocket, state doc in-memory, áp op local trước rồi đồng bộ sau (optimistic)."
   },
   {
    "i": 1,
    "key": "Mọi người **hội tụ** cùng nội dung (even",
    "why": "Thiếu thuật toán hội tụ thì mỗi người thấy một nội dung khác khi nhiều người sửa đồng thời. Yêu cầu này dẫn tới OT (hoặc CRDT): mọi client áp dụng xong cùng tập op thì có cùng doc."
   },
   {
    "i": 2,
    "key": "~100 người cùng sửa một doc",
    "why": "Toàn bộ op của một doc vừa sức một server, vì số người sửa mỗi doc có giới hạn (~100). Nhờ đó gom doc về một server để OT tập trung là khả thi."
   },
   {
    "i": 3,
    "key": "Không mất edit",
    "why": "Mọi op phải bền trước khi xác nhận, vì mất chữ đã gõ là lỗi nghiêm trọng nhất của editor. Hệ quả: append ops log trước khi ack, client giữ op chưa ack để gửi lại."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Xử lý nhiều người sửa cùng lúc?",
    "bad": "Khoá cả doc thì chỉ một người gõ được tại một thời điểm — mất ý nghĩa cộng tác. Last-write-wins trên cả doc thì bản ghi sau xoá sạch thay đổi của người kia.",
    "good": "Khoá theo đoạn cho nhiều người sửa các đoạn khác nhau. Nhưng hai người sửa cùng đoạn vẫn chặn nhau, và nối/tách đoạn làm ranh giới khoá thay đổi, xử lý phức tạp.",
    "great": "Mọi op được áp dụng, không ai bị chặn, và các bản hội tụ, vì OT biến đổi op dựa trên op đã xảy ra đồng thời (ví dụ chèn ở vị trí 5 dịch thành 6 nếu có người chèn trước đó). Server trung tâm xếp thứ tự toàn cục nên OT đơn giản; CRDT gắn id duy nhất cho từng ký tự nên hội tụ không cần server, hợp với offline."
   },
   {
    "i": 1,
    "key": "Scale hàng triệu doc?",
    "bad": "Hàng triệu doc không thể nằm trên một máy, vì một server có giới hạn RAM và kết nối; máy đó còn là single point of failure.",
    "good": "Nhiều server chia tải, pub/sub chuyển op giữa các server khi người cùng doc ở server khác nhau. Nhưng OT cần một thứ tự duy nhất cho op của doc — nhiều server cùng nhận op của một doc thì phải phối hợp thứ tự qua mạng, phức tạp và chậm.",
    "great": "Server tự xếp thứ tự mà không cần phối hợp, vì consistent hashing map `docId` tới đúng một server nên mọi op của doc đi về một chỗ. Thêm/bớt server chỉ di chuyển một phần doc; ZooKeeper giữ membership để LB và server thống nhất doc nào thuộc server nào."
   },
   {
    "i": 2,
    "key": "Lưu trữ thế nào?",
    "bad": "Ghi đè cả doc cho mỗi phím gõ là hàng MB I/O mỗi giây mỗi người (doc có thể vài MB), và mất lịch sử sửa.",
    "good": "Append op chỉ ghi vài byte mỗi thay đổi và giữ được lịch sử. Nhưng mở doc phải replay toàn bộ op từ đầu — doc sửa nhiều năm có hàng triệu op nên load rất chậm.",
    "great": "Mở doc chỉ cần load snapshot rồi replay số ít op sau nó, vì snapshot định kỳ lưu trạng thái đầy đủ tại một version. Compaction xoá op cũ đã nằm trong snapshot để log không phình vô hạn; Cassandra partition theo `docId` cho ghi append nhanh và đọc tuần tự."
   }
  ]
 },
 "payment": {
  "hld": "**Payment Service** quản lý payment intent như state machine và ghi trạng thái trước mỗi lần gọi ra ngoài, vì gọi Card Network là thao tác bên ngoài không tin cậy. **Card Vault** tách riêng vì số thẻ thuộc phạm vi PCI DSS: cô lập nó thì phần còn lại chỉ thấy token, thu hẹp phạm vi audit. **Payments DB** chọn Postgres vì intent và ledger cần transaction ACID và strong consistency; 10k TPS vẫn trong khả năng Postgres có partition. Ledger nằm cùng DB với intent để chuyển trạng thái và ghi bút toán trong cùng một transaction.",
  "nfr": [
   {
    "i": 0,
    "key": "**Không charge hai lần** (idempotent)",
    "why": "Charge hai lần là mất tiền của khách, mà client, mạng và PSP đều có thể retry nên cùng một lệnh thanh toán có thể tới nhiều lần. Hệ quả: idempotency key ở mọi tầng và state machine chặn chuyển trạng thái lặp."
   },
   {
    "i": 1,
    "key": "Durable + audit được (sổ cái đầy đủ)",
    "why": "Mọi thay đổi phải có dấu vết, vì tiền phải giải trình được với kế toán, kiểm toán và cơ quan quản lý. Hệ quả: ledger double-entry append-only, không UPDATE/DELETE bút toán."
   },
   {
    "i": 2,
    "key": "Strong consistency cho trạng thái thanh ",
    "why": "Trạng thái thanh toán sai (báo thành công khi thất bại) dẫn tới giao hàng mà không thu tiền, hoặc ngược lại. Hệ quả: dùng DB ACID, transaction cho chuyển trạng thái, không dùng kho eventual consistency."
   },
   {
    "i": 3,
    "key": "~10k TPS lúc peak; bảo mật PCI DSS",
    "why": "Khó khăn thật nằm ở tính đúng đắn, không ở throughput — 10k TPS không lớn với Postgres có partition. PCI DSS buộc cô lập dữ liệu thẻ vào Card Vault và tokenize."
   }
  ],
  "deep": [
   {
    "i": 0,
    "key": "Không charge hai lần?",
    "bad": "Charge hai lần, vì double-click, retry tự động của client hay timeout mạng đều gửi lại request — tin client chỉ bấm một lần là bỏ qua các nguồn trùng này.",
    "good": "Unique constraint trên `Idempotency-Key` đảm bảo request lặp chỉ tạo một payment. Nhưng server crash sau khi gọi PSP mà chưa ghi kết quả thì lần retry không biết PSP đã charge hay chưa, và có thể charge lại.",
    "great": "Crash xong, hệ thống biết có lệnh đang dở và đi hỏi trạng thái thay vì charge mới, vì đã ghi `PROCESSING` trước khi gọi PSP. Gửi idempotency key sang PSP để PSP cũng bỏ lệnh trùng → cả ba tầng (client, state machine, PSP) đều chặn được trùng."
   },
   {
    "i": 1,
    "key": "Không mất hay sai tiền?",
    "bad": "Không còn dấu vết tiền đi đâu, vì `UPDATE balance` ghi đè giá trị cũ; hai update đồng thời có thể mất cập nhật, và lỗi không phát hiện được.",
    "good": "Bảng transaction có trạng thái lưu được lịch sử từng giao dịch. Nhưng thiếu bất biến để tự kiểm tra (tiền vào bằng tiền ra), sai sót vẫn lọt mà không ai biết.",
    "great": "Lệch là phát hiện ngay, vì mỗi giao dịch ghi một cặp debit/credit có tổng bằng 0 nên tổng toàn ledger luôn bằng 0. Append-only nên không sửa được lịch sử; reconciliation so ledger với settlement file của ngân hàng để bắt sai lệch với bên ngoài."
   },
   {
    "i": 2,
    "key": "Báo merchant tin cậy?",
    "bad": "Gọi webhook một lần mà thất bại thì merchant không bao giờ biết đơn đã thanh toán — merchant server có thể đang deploy hoặc lỗi tạm.",
    "good": "Retry bù được lỗi tạm thời. Nhưng service crash sau khi commit payment mà trước khi gửi webhook thì event mất, và retry dồn dập có thể đè sập merchant đang hồi phục.",
    "great": "Event không thể mất khi DB đã commit, vì outbox ghi cùng transaction với thay đổi trạng thái; dispatcher đọc outbox rồi đẩy qua queue. Exponential backoff giãn retry cho merchant kịp hồi phục, HMAC cho merchant xác thực nguồn, event id giúp merchant bỏ event trùng do at-least-once."
   }
  ]
 }
};
