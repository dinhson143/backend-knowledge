BK.topic({
  id: "kafka",
  track: "sd",
  section: "sd-deep",
  title: "Kafka chi tiết",
  tldr: {
    t: "Kafka là **distributed commit log**: producer append vào cuối partition, consumer tự đọc theo offset. Dữ liệu bền, đọc lại được, scale bằng partition. Kafka chỉ đảm bảo thứ tự **trong một partition**.",
    why: "Dữ liệu ở lại đủ lâu để đọc lại và mỗi consumer group đọc độc lập, vì producer chỉ **append** vào cuối file, consumer chỉ giữ một con số offset → broker không phải xoá hay đánh dấu từng message. Thứ tự chỉ định nghĩa được **bên trong** một partition, vì mỗi partition là một log riêng có offset tăng dần; hai partition trên hai broker khác nhau không có đồng hồ chung nào để so thứ tự.",
  },
  story: {
    problem: "Nhiều service cần cùng một luồng event (order, click) thì gọi trực tiếp từng service tạo coupling chặt. Queue truyền thống xoá message sau khi đọc → consumer thứ hai, hay consumer cần đọc lại sau bug, không còn gì để đọc. Database thì không chịu nổi hàng trăm nghìn insert/s chỉ để làm hàng đợi.",
    idea: "Ghi mọi event vào một **log append-only** trên đĩa, chia thành nhiều partition trên nhiều broker; broker không theo dõi ai đã đọc gì, mỗi consumer tự giữ **offset** của mình. Thêm consumer hay replay chỉ là đọc từ một offset khác, vì log không bị xoá khi đọc.",
    tradeoff: "Thứ tự chỉ có trong partition, số partition khó đổi về sau, và consumer phải tự lo DLQ, retry, idempotency. Vận hành cluster (broker, replica, rebalance, lag) nặng hơn hẳn SQS hay RabbitMQ.",
  },
  sections: [
    {
      title: "Mô hình tư duy",
      table: {
        head: ["Khái niệm", "Là gì", "Cần nhớ"],
        rows: [
          {
            cells: [
              "Broker",
              "Một server Kafka; cluster gồm nhiều broker",
              "Mỗi partition có 1 leader nằm trên một broker",
            ],
            why: "Rải đều leader của các partition trên nhiều broker giúp chia tải, vì mọi ghi và đọc của một partition đều đi qua leader. Dồn leader vào một broker thì broker đó thành nút cổ chai dù cluster có 10 node.",
          },
          {
            cells: ["Topic", "Kênh logic theo loại event (`orders`, `clicks`)", "Giống tên bảng"],
            why: "Topic đóng vai trò như tên bảng: chỉ là tên logic gom các partition cùng loại event. Consumer subscribe theo topic, còn dữ liệu thật nằm trong các partition bên dưới.",
          },
          {
            cells: [
              "Partition",
              "Log append-only có thứ tự — đơn vị song song",
              "Số partition = số consumer tối đa xử lý song song trong một group",
            ],
            why: "Topic có 12 partition thì tối đa 12 consumer cùng làm việc, vì mỗi partition chỉ giao cho đúng một consumer trong group (để giữ thứ tự). Consumer thứ 13 không có partition nào để nhận. Đây là consumer group cổ điển; share group (“Kafka Queues”, KIP-932, sẵn sàng production từ Kafka 4.2) cho nhiều consumer cùng đọc một partition và ack từng record, đổi lại mất thứ tự trong partition (https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/).",
          },
          {
            cells: ["Offset", "Vị trí message trong partition (0, 1, 2…)", "Consumer tự giữ offset → đọc lại được"],
            why: "Broker không ghi nhận \"message này đã xử lý\"; consumer chỉ commit một con số offset. Muốn đọc lại thì lùi offset (`--reset-offsets --to-datetime`) — message vẫn còn đó cho đến khi hết retention.",
          },
          {
            cells: ["Producer", "Ghi message (key, value)", "Cùng key → cùng partition: `hash(key) % N`"],
            why: "Cùng key luôn rơi vào cùng partition → giữ được thứ tự theo key, vì partitioner tính hash của key (murmur2) rồi chia lấy dư cho số partition. Hệ quả: đổi N là đổi kết quả phép chia, key cũ chạy sang partition khác.",
          },
          {
            cells: [
              "Consumer group",
              "Nhóm consumer chia nhau partition",
              "Mỗi partition chỉ 1 consumer trong group; group khác đọc độc lập",
            ],
            why: "Kafka gán partition độc quyền cho một consumer trong group, vì hai consumer cùng group đọc chung một partition sẽ giành nhau message và phá thứ tự. Group khác có offset riêng → analytics và notification đọc cùng topic mà không ảnh hưởng nhau.",
          },
          {
            cells: [
              "Replica / ISR",
              "Bản sao partition trên broker khác; ISR = replica đang theo kịp leader",
              "`acks=all` chờ đủ ISR mới ack",
            ],
            why: "ISR là tập replica chắc chắn có dữ liệu mới nhất, vì follower nào tụt quá `replica.lag.time.max.ms` bị loại khỏi ISR. `acks=all` chờ cả ISR ghi xong → leader chết thì replica được bầu lên (lấy từ ISR) vẫn có message đã ack.",
          },
          {
            cells: [
              "Controller (KRaft)",
              "Quản lý metadata, bầu leader",
              "KRaft production-ready từ Kafka 3.3; Kafka 4.0 bỏ hẳn ZooKeeper",
            ],
            why: "KRaft cho failover controller nhanh hơn và cluster chịu được hàng triệu partition, vì nó đưa metadata vào một log Raft nội bộ của Kafka. ZooKeeper là hệ thống riêng phải vận hành song song và giới hạn số partition (metadata load chậm khi failover); Kafka 4.0 đã bỏ hẳn ZooKeeper.",
          },
        ],
      },
    },
    {
      title: "Đường ghi: producer → broker",
      points: [
        {
          t: "**Chọn partition** — có key thì `hash(key) % N`; không key thì sticky/round-robin. Chọn key = chọn đơn vị thứ tự (orderId, userId).",
          why: "Key quyết định những message nào xếp hàng chung, vì thứ tự chỉ có trong partition: key là `orderId` thì các event của một order luôn đúng thứ tự. Không có key, producer dùng sticky partitioner (lấp đầy một batch cho một partition rồi đổi) để batch to hơn thay vì rải từng message.",
        },
        {
          t: "**Batch + nén** — producer gom message theo `linger.ms`, `batch.size`, nén lz4/zstd → throughput cao.",
          why: "Gửi 500 message trong một batch rẻ hơn nhiều so với 500 request, vì mỗi request mạng có chi phí cố định (header, round-trip, fsync/page cache). Chờ thêm vài ms (`linger.ms`) để batch đầy hơn; nén cả batch cho tỉ lệ nén cao vì các message JSON giống nhau.",
        },
        {
          t: "**Leader ghi, follower kéo** — leader append vào log (ghi tuần tự, qua page cache); follower fetch về để giữ bản sao.",
          why: "Đĩa ghi tuần tự và OS gom ghi qua page cache thay vì fsync từng message, vì leader chỉ append vào cuối file. Kafka mặc định không fsync mỗi message; độ bền dựa vào **replication**: follower kéo dữ liệu về → một máy mất điện không làm mất dữ liệu đã có trên replica khác.",
        },
        {
          t: "**Idempotent producer** (`enable.idempotence=true`, mặc định từ Kafka 3) — producer retry không tạo bản trùng trong partition.",
          why: "Batch retry có sequence đã thấy bị bỏ qua thay vì ghi lần hai, vì producer gửi kèm producer ID và sequence number cho từng batch, còn broker nhớ sequence cuối của mỗi producer/partition. Chỉ chống trùng trong một partition và một phiên producer; restart producer mà không có `transactional.id` thì nhận ID mới.",
        },
      ],
      table: {
        head: ["acks", "Ack khi", "Rủi ro"],
        rows: [
          {
            cells: ["0", "Không chờ gì", "Mất message khi có lỗi bất kỳ; chỉ hợp metrics không quan trọng"],
            why: "Broker lỗi, mạng rớt hay leader đổi đều làm mất message mà producer không biết để retry, vì producer gửi xong là coi như thành công, không chờ phản hồi. Đổi lại latency thấp nhất — hợp metrics, mất vài điểm không sao.",
          },
          {
            cells: ["1", "Leader ghi xong", "Mất message nếu leader chết trước khi follower kéo"],
            why: "Message đã ack vẫn có thể biến mất, vì leader ack ngay khi ghi vào log của mình, trước khi follower kịp fetch. Leader chết đúng lúc đó thì follower được bầu lên không có message, và leader cũ quay lại bị truncate theo leader mới.",
          },
          {
            cells: [
              "all + min.insync.replicas=2",
              "Đủ số replica in-sync đã ghi",
              "Bền nhất; ít ISR quá thì producer bị từ chối ghi. Chuẩn: replication.factor=3",
            ],
            why: "Một broker chết vẫn còn bản sao có message, vì ack chỉ trả về khi mọi replica trong ISR đã ghi, và ISR phải có ít nhất 2 replica. RF=3 + min ISR=2 cho phép mất 1 broker mà vẫn ghi được; mất 2 thì ISR còn 1 < 2 → broker từ chối ghi (`NotEnoughReplicas`) để không ack thứ chỉ nằm trên một máy.",
          },
        ],
      },
    },
    {
      title: "Đường đọc: consumer group",
      points: [
        {
          t: "**Poll theo batch** — consumer kéo message và tự quyết định khi nào commit offset.",
          why: "Consumer tự điều tốc theo sức xử lý thay vì bị broker đẩy ngập, vì nó là bên kéo (pull). Offset do consumer commit → thời điểm commit (trước hay sau khi xử lý) quyết định delivery semantics.",
        },
        {
          t: "**Phân partition** — mỗi partition gán cho đúng 1 consumer trong group; consumer nhiều hơn partition thì dư consumer ngồi chơi.",
          why: "Số consumer làm việc thực tế bị chặn trên bởi số partition, vì Kafka giữ thứ tự bằng cách cho mỗi partition đúng một người đọc trong group. Muốn scale consumer thì phải có đủ partition từ đầu.",
        },
        {
          t: "**Rebalance** — khi consumer vào, ra hoặc chết (mất heartbeat), group chia lại partition; với protocol cũ (eager), xử lý tạm dừng trong lúc đó. Cooperative rebalancing và protocol mới KIP-848 (Kafka 4.0) chỉ dời những partition cần dời.",
          why: "Eager rebalance là stop-the-world: mọi consumer nhả hết partition rồi mới nhận lại, vì group coordinator phải đảm bảo không partition nào có hai chủ cùng lúc. Cooperative rebalance chỉ thu hồi các partition thực sự phải chuyển → consumer khác vẫn làm việc trong lúc chia lại.",
        },
        {
          t: "**Consumer lag** = offset cuối − offset đã commit — metric quan trọng nhất để autoscale và cảnh báo.",
          why: "Lag cho biết consumer có theo kịp producer không — điều CPU hay số request không cho biết — vì nó đo trực tiếp số message đang chờ. Lag tăng đều = consumer chậm hơn tốc độ ghi → cần thêm consumer hoặc tối ưu xử lý.",
        },
        {
          t: "**Nhiều group cùng đọc một topic** — fan-out gần như miễn phí: analytics, search indexer, notification đọc cùng event.",
          why: "Thêm một group mới chỉ là thêm một người đọc file, broker không phải nhân bản message, vì message không bị xoá khi đọc và mỗi group có offset riêng. Chi phí chủ yếu là băng thông đọc, thường phục vụ từ page cache.",
        },
      ],
    },
    {
      title: "Delivery semantics",
      table: {
        head: ["Kiểu", "Cách làm", "Rủi ro"],
        rows: [
          {
            cells: ["At-most-once", "Commit offset **trước**, rồi mới xử lý", "Crash giữa chừng → mất message"],
            why: "Message không bao giờ được xử lý nếu consumer crash giữa chừng, vì offset đã commit trước khi xử lý → khởi động lại nó đọc tiếp từ sau message đó.",
          },
          {
            cells: [
              "At-least-once (phổ biến nhất)",
              "Xử lý xong **rồi** commit",
              "Crash trước khi commit → xử lý lại → consumer phải idempotent",
            ],
            why: "Không mất message nhưng có trùng: commit sau khi xử lý xong, nên crash giữa \"xử lý xong\" và \"commit\" làm consumer mới đọc lại từ offset cũ và xử lý lần hai. Vì vậy consumer phải idempotent (upsert, dedupe theo event ID).",
          },
          {
            cells: [
              "Exactly-once",
              "Idempotent producer + transactions (đọc–xử lý–ghi trong Kafka), hoặc at-least-once + dedupe ở đích",
              "Chỉ đúng trong phạm vi Kafka; ghi ra hệ thống ngoài vẫn cần idempotency",
            ],
            why: "Output và offset hoặc cùng thành công, hoặc cùng bị huỷ, vì transaction ghi output và commit offset trong **cùng một transaction** Kafka; consumer `read_committed` không thấy output dở dang. Nhưng gửi email hay ghi Postgres nằm ngoài transaction đó → vẫn có thể lặp, cần idempotency key ở đích.",
          },
        ],
      },
    },
    {
      title: "Lưu trữ: retention & compaction",
      points: [
        {
          t: "**Retention** theo thời gian hoặc dung lượng (ví dụ 7 ngày). Message **không bị xoá khi đọc** — khác hẳn queue.",
          why: "Trong 7 ngày retention ai cũng replay được, vì dữ liệu chỉ bị dọn khi segment cũ hơn `retention.ms` hoặc topic vượt `retention.bytes`. Consumer chỉ giữ offset, broker không biết ai đã đọc → không có sự kiện \"đã đọc\" nào để xoá theo.",
        },
        {
          t: "**Log compaction** — chỉ giữ bản mới nhất cho mỗi key, biến topic thành changelog/state rebuild được (CDC, config).",
          why: "Dung lượng tỉ lệ với số key chứ không với số lần cập nhật, vì cleaner thread đọc các segment cũ, giữ bản ghi mới nhất cho mỗi key và bỏ các bản cũ hơn (value null = tombstone xoá key). Consumer mới đọc từ đầu topic là dựng lại được trạng thái hiện tại.",
        },
        {
          t: "**Segment** — log chia thành file segment; xoá và compact theo segment.",
          why: "Kafka cắt log thành các file segment (mặc định 1GB) và xoá nguyên file segment cũ, vì xoá từng message giữa một file lớn rất tốn. Segment active (đang ghi) không bị xoá hay compact → retention thực tế có thể dài hơn cấu hình một chút.",
        },
      ],
    },
    {
      title: "Vì sao Kafka nhanh",
      points: [
        {
          t: "**Ghi và đọc tuần tự** trên đĩa, tận dụng OS page cache.",
          why: "Đĩa (cả HDD) ghi/đọc tuần tự nhanh hơn random nhiều bậc, vì không phải seek và OS tự prefetch. Consumer đọc gần cuối log thường lấy thẳng từ page cache trong RAM, không chạm đĩa.",
        },
        {
          t: "**Zero-copy** (`sendfile`) đẩy dữ liệu từ page cache ra socket, không copy qua user space.",
          why: "`sendfile` bỏ hai lần copy và context switch: thay vì đường thông thường đĩa → kernel → user space → kernel socket buffer, kernel đẩy thẳng từ page cache ra NIC. Làm được vì broker lưu message đúng định dạng gửi qua mạng, không cần sửa (trừ khi bật TLS).",
        },
        {
          t: "**Batching + compression** ở cả producer lẫn consumer.",
          why: "Broker không tốn CPU nén lại, vì nó lưu batch nén nguyên khối và gửi nguyên khối cho consumer — chỉ producer nén, consumer giải nén. Ít request hơn, ít byte hơn trên mạng lẫn đĩa.",
        },
        {
          t: "**Partition** cho phép nhiều broker và consumer làm song song.",
          why: "100 partition rải trên 10 broker là 100 luồng ghi/đọc song song, vì mỗi partition là một log độc lập có leader riêng. Throughput của topic tăng gần tuyến tính theo số partition cho đến khi hết tài nguyên broker.",
        },
      ],
    },
    {
      title: "Câu hỏi hay bị hỏi sâu",
      points: [
        {
          t: "**Hot partition** — key lệch (celebrity, ad cực hot) dồn vào một partition → salt key (`adId#0..N`) rồi gộp ở consumer; đổi lại mất thứ tự theo key gốc.",
          why: "Một key cực hot đẩy hết traffic lên một partition và một consumer, vì cùng key luôn vào cùng partition. Thêm hậu tố ngẫu nhiên `#0..N` tách key đó ra N partition, nhưng event của nó giờ nằm ở N log khác nhau → mất thứ tự chung, phải gộp lại ở consumer.",
        },
        {
          t: "**Chọn số partition** — throughput mục tiêu ÷ throughput mỗi partition (lấy phía chậm hơn giữa producer và consumer), cộng dư cho tăng trưởng. Không giảm được; tăng thì đổi mapping key → phá thứ tự theo key.",
          why: "Cần đủ partition để số consumer × throughput mỗi consumer ≥ mục tiêu (ví dụ 100MB/s ÷ 10MB/s = 10, thường làm tròn lên dư), vì mỗi partition chỉ một consumer trong group đọc. Giảm partition thì phải gộp log và offset — Kafka không hỗ trợ; tăng thì `hash % N` đổi, key cũ đi sang partition mới.",
        },
        {
          t: "**Message lớn** — Kafka hợp message nhỏ (≤ 1MB). File lớn để ở S3, chỉ gửi pointer.",
          why: "Đẩy file lên S3 rồi gửi URL (claim-check pattern) giữ message nhỏ và rẻ. Lý do: broker mặc định giới hạn ~1MB/message (`message.max.bytes`), và message lớn làm hỏng lợi thế batch, chiếm page cache, làm chậm replication.",
        },
        {
          t: "**Poison message** — consumer Kafka không có DLQ sẵn như SQS (Kafka Connect thì có): tự làm retry topic + DLQ topic.",
          why: "Một message lỗi mãi mà cứ retry tại chỗ sẽ chặn cả partition phía sau, vì consumer xử lý tuần tự theo offset. Consumer group cổ điển không có ack/nack từng message như SQS (share group từ Kafka 4.2 thì có, nhưng bỏ thứ tự theo partition) → phải tự đẩy message lỗi sang retry topic (có delay) rồi DLQ topic, và commit offset để đi tiếp.",
        },
        {
          t: "**Consumer chậm** — thêm partition + consumer, hoặc tách việc nặng sang worker pool.",
          why: "Đã đủ consumer thì phải thêm partition mới scale được, vì số consumer bị giới hạn bởi số partition. Nếu nút cổ chai là xử lý nặng (gọi API, render), tách sang worker pool cho phép song song hơn số partition, đổi lại phải tự quản thứ tự và commit offset.",
        },
      ],
    },
    {
      title: "Kafka hay lựa chọn khác?",
      table: {
        head: ["", "Kafka", "SQS", "RabbitMQ", "Redis Streams"],
        rows: [
          {
            cells: [
              "Mô hình",
              "Log bền, replay được",
              "Queue, xoá khi xử lý xong",
              "Broker định tuyến qua exchange",
              "Log trong RAM",
            ],
            why: "Kafka giữ message đến hết retention bất kể ai đọc; SQS xoá message khi consumer gọi `DeleteMessage`; RabbitMQ đẩy message qua exchange tới queue theo routing rule rồi xoá khi ack; Redis Streams cũng là log nhưng nằm trong RAM nên giữ được ít dữ liệu hơn.",
          },
          {
            cells: ["Thứ tự", "Trong partition", "FIFO queue (giới hạn TPS)", "Trong queue", "Trong stream"],
            why: "Mỗi hệ thống chỉ giữ thứ tự trong đơn vị một người đọc tuần tự: partition, queue hay stream. SQS FIFO bị giới hạn throughput hơn standard queue (standard không đảm bảo thứ tự), vì nó đạt thứ tự bằng cách khoá theo message group và dedupe.",
          },
          {
            cells: ["Replay", "Có (theo offset)", "Không", "Không", "Có (giới hạn bởi RAM)"],
            why: "Replay cần message còn tồn tại sau khi đã đọc: Kafka giữ theo retention trên đĩa, Redis Streams giữ đến khi `XTRIM`/`MAXLEN` nên bị chặn bởi RAM. SQS và RabbitMQ xoá khi ack → đọc xong là hết.",
          },
          {
            cells: [
              "Chọn khi",
              "Event streaming, fan-out nhiều consumer, CDC, analytics",
              "Job queue đơn giản, không muốn vận hành",
              "Routing phức tạp",
              "Nhẹ, đã có sẵn Redis, dữ liệu ngắn hạn",
            ],
            why: "Kafka đáng chi phí vận hành khi cần nhiều consumer đọc cùng event và replay; SQS là managed, có sẵn visibility timeout và DLQ nên hợp job queue; RabbitMQ có exchange (topic, headers, fanout) nên định tuyến linh hoạt; Redis Streams tận dụng Redis có sẵn khi dữ liệu nhỏ, sống ngắn.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Luôn nói rõ **partition key** là gì và vì sao (thứ tự theo order, theo user…).",
      why: "Key quyết định cả thứ tự lẫn phân tải: chọn `orderId` thì event của một order đúng thứ tự và tải rải đều; chọn `country` thì một partition gánh cả nước lớn. Interviewer muốn thấy bạn biết đánh đổi đó.",
    },
    {
      t: "Khi vẽ Kafka, nói luôn cấu hình bền: `acks=all`, RF=3, consumer idempotent, theo dõi lag.",
      why: "Mặc định an toàn chưa đủ: thiếu `min.insync.replicas` thì `acks=all` vẫn ack khi ISR chỉ còn leader. Nêu đủ bộ RF=3, acks=all, consumer idempotent, giám sát lag → cho thấy bạn hiểu mất dữ liệu đến từ đâu ở cả hai đầu.",
    },
    {
      t: "Chỉ cần job queue đơn giản thì SQS đủ và ít vận hành hơn Kafka.",
      why: "Chọn Kafka cho job queue là trả chi phí vận hành cho tính năng (replay, fan-out) không dùng tới. Job queue chỉ cần \"mỗi job một worker xử lý, lỗi thì retry\", và SQS có sẵn visibility timeout, DLQ, autoscale theo số message mà không phải quản broker hay partition.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/kafka-topic-partitions.svg",
      caption: "Producer băm key để chọn partition; trong một consumer group mỗi partition chỉ có một consumer, còn các group khác nhau đọc cùng log độc lập với offset riêng.",
      source: "https://kafka.apache.org/documentation/#intro_concepts_and_terms",
    },
  ],
  related: ["queue", "realtime", "long-task"],
  cards: [
    [
      "Kafka đảm bảo thứ tự ở mức nào?",
      "Chỉ trong một partition. Muốn mọi event của một order đúng thứ tự → dùng orderId làm key.",
    ],
    [
      "Có 4 partition và 6 consumer trong cùng group thì sao?",
      "Chỉ 4 consumer nhận partition, 2 consumer rảnh. Số partition là giới hạn song song của một consumer group cổ điển (share group từ Kafka 4.2 không bị giới hạn này nhưng không giữ thứ tự).",
    ],
    [
      "acks=1 có thể mất dữ liệu khi nào?",
      "Leader ghi xong và ack, rồi chết trước khi follower kịp kéo — follower lên làm leader không có message đó.",
    ],
    [
      "At-least-once gây ra vấn đề gì và xử lý thế nào?",
      "Message có thể bị xử lý lại khi consumer crash trước khi commit → consumer phải idempotent (dedupe theo message id, upsert).",
    ],
    [
      "Log compaction dùng để làm gì?",
      "Giữ bản mới nhất cho mỗi key, biến topic thành changelog/state rebuild được (CDC, config).",
    ],
    [
      "Xử lý hot partition thế nào?",
      "Salt key (key#0..N) để chia ra nhiều partition rồi gộp ở consumer; đổi lại mất thứ tự theo key gốc.",
    ],
  ],
});
