BK.topic({
  id: "replication",
  track: "sd",
  section: "sd-core",
  title: "Replication & failover",
  goal: "Chọn leader–follower, multi-leader hay quorum và xử lý replica lag",
  needs: ["core-db", "cap"],
  tldr: {
    t: "Replication giữ nhiều bản sao dữ liệu để **chịu lỗi** và **scale đọc**. Ghi **đồng bộ**: commit chờ replica xác nhận, đổi lại latency ghi. Ghi **bất đồng bộ** (mặc định của PostgreSQL streaming replication): ghi nhanh, nhưng failover có thể mất vài commit cuối và đọc replica có thể thấy dữ liệu cũ.",
    why: "Mọi đánh đổi của replication đến từ một câu hỏi: leader trả \"ok\" cho client **trước** hay **sau** khi bản sao đã có thay đổi. Trả trước thì nhanh nhưng có khoảng thời gian chỉ leader giữ dữ liệu; leader chết đúng lúc đó là mất. Trả sau thì an toàn nhưng mỗi lần ghi phải chờ thêm một vòng mạng và replica chậm làm chậm cả hệ thống.",
  },
  story: {
    problem: "Một DB là một điểm chết (SPOF): máy hỏng thì cả hệ thống dừng, ổ hỏng thì mất dữ liệu. Đọc tăng 10 lần thì một máy không gánh nổi. Bài System Design nào cũng có câu \"thêm read replica\" hoặc \"replicate sang AZ khác\", và interviewer sẽ hỏi tiếp: ghi đồng bộ hay không, failover mất gì, đọc từ replica thấy gì.",
    idea: "Một node (leader) nhận ghi và gửi **log thay đổi** (WAL, binlog) sang các follower, follower áp lại theo đúng thứ tự. Leader chết thì đưa một follower lên thay (failover). Muốn nhiều nơi cùng nhận ghi thì dùng multi-leader hoặc leaderless với quorum, đổi lại phải xử lý xung đột.",
    tradeoff: "Bản sao bất đồng bộ luôn trễ (replication lag), gây ra các bất thường khi đọc. Failover tự động có thể chọn nhầm lúc và sinh ra **hai leader** (split brain). Nhiều nơi cùng ghi thì phải chọn cách giải xung đột, và last-writer-wins sẽ âm thầm mất bớt ghi.",
  },
  table: {
    head: ["Mô hình", "Ai nhận ghi", "Hợp khi", "Cái giá"],
    rows: [
      {
        cells: ["Single-leader (primary–replica)", "Một leader; follower chỉ đọc", "Mặc định của PostgreSQL, MySQL; đa số bài SD", "Ghi bị giới hạn ở một máy; failover có độ trễ và rủi ro"],
        why: "Một leader thì mọi ghi có một thứ tự duy nhất, follower chỉ cần áp log theo thứ tự đó nên không bao giờ xung đột. Đây là lý do nó là mặc định: đơn giản nhất để đúng. Muốn scale ghi thì phải shard, không phải thêm replica.",
      },
      {
        cells: ["Multi-leader", "Nhiều leader, thường mỗi region một", "Ghi ở nhiều region với latency thấp, app offline-first", "Hai nơi sửa cùng một bản ghi → xung đột phải giải"],
        why: "Mỗi region ghi vào leader gần nó rồi đồng bộ chéo bất đồng bộ, nên ghi nhanh và một region đứt vẫn ghi được. Nhưng hai leader có thể nhận hai thay đổi trái nhau cho cùng một dòng trước khi thấy nhau; không có thứ tự chung để biết cái nào \"sau\". Ví dụ PostgreSQL: hai node đăng ký logical replication của nhau (subscription đặt `origin = none` để không gửi vòng lại thay đổi vừa nhận); khi một `UPDATE` đến dòng vừa bị node kia sửa, PostgreSQL hiện **luôn áp** thay đổi đến và chỉ ghi nhận xung đột `update_origin_differs`, còn chèn trùng unique key thì dừng replication cho tới khi sửa tay (https://www.postgresql.org/docs/current/logical-replication-conflicts.html).",
      },
      {
        cells: ["Leaderless (kiểu Dynamo)", "Client ghi vào nhiều node cùng lúc", "Cần luôn ghi được, chịu node chết (Dynamo, Cassandra)", "Đọc phải hỏi nhiều node; xung đột giải bằng version hoặc LWW"],
        why: "Không có leader nên không có failover: node chết thì client ghi vào node khác. Bài viết về Dynamo mô tả mục tiêu thiết kế \"always writeable\" và đẩy việc giải xung đột sang lúc đọc (https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html).",
      },
    ],
  },
  points: [
    {
      t: "**Đồng bộ hay bất đồng bộ trong PostgreSQL.** Streaming replication mặc định **bất đồng bộ**, độ trễ thường dưới 1 giây nếu standby theo kịp (https://www.postgresql.org/docs/current/warm-standby.html). Bật đồng bộ bằng `synchronous_standby_names`; khi đó `synchronous_commit` quyết định commit chờ tới đâu.",
      why: "Bất đồng bộ là mặc định vì nó không làm chậm ghi và standby chết không chặn primary. Cái giá được tài liệu nói rõ: có một khoảng trễ giữa lúc commit trên primary và lúc thay đổi hiện trên standby, và nếu primary chết trong khoảng đó thì các commit chưa sang standby sẽ mất khi failover.",
    },
    {
      t: "**Các mức của `synchronous_commit`** khi có standby đồng bộ: `remote_write` chờ standby ghi vào file system (chưa chắc tới đĩa); `on` (mặc định) chờ standby **flush xuống đĩa**; `remote_apply` chờ standby **áp xong**, query trên standby thấy được thay đổi (https://www.postgresql.org/docs/current/runtime-config-wal.html).",
      why: "Mỗi mức chờ thêm một bước nên đảm bảo thêm một điều: `remote_write` sống sót khi process standby chết nhưng không sống sót khi OS standby sập; `on` chỉ mất dữ liệu khi cả primary lẫn mọi standby đồng bộ cùng hỏng ổ; `remote_apply` còn cho đọc từ standby thấy ngay, đổi lại commit chậm hơn nhiều vì chờ replay. Tham số đặt được theo từng transaction, nên có thể chỉ cho giao dịch tiền chạy đồng bộ.",
    },
    {
      t: "**Replica lag sinh ra bất thường khi đọc**: user sửa xong reload không thấy thay đổi (vi phạm **read-your-writes**); hai lần đọc liên tiếp rơi vào hai replica trễ khác nhau làm dữ liệu \"quay ngược\" (vi phạm **monotonic reads**: đọc sau không được thấy trạng thái cũ hơn đọc trước, tức \"đọc không đi lùi\", https://jepsen.io/consistency/models/monotonic-reads).",
      why: "Mỗi replica áp log tới một vị trí khác nhau tại cùng thời điểm, nên đọc ở đâu thì thấy trạng thái tại vị trí đó. Lỗi chỉ xuất hiện khi đọc ngay sau ghi hoặc khi lag tăng lúc tải cao, nên rất khó tái hiện khi test.",
    },
    {
      t: "**Chữa read-your-writes**: đọc từ leader trong vài giây sau khi user ghi; hoặc nhớ vị trí log của lần ghi và chỉ đọc replica khi replica đã áp tới đó. PostgreSQL 19 có sẵn cách thứ hai: lấy `pg_current_wal_insert_lsn()` trên primary sau commit, rồi chạy `WAIT FOR LSN '…'` trên standby trước khi đọc (https://www.postgresql.org/docs/current/warm-standby.html, mục Read-Your-Writes Consistency). **Monotonic reads**: gắn mỗi user vào một replica cố định.",
      why: "Route về leader theo thời gian là đoán: lag vượt ngưỡng thì lỗi quay lại. So vị trí log (LSN) là chắc chắn: standby đã áp tới LSN của lần ghi thì mọi thay đổi trước đó đều đã có. Gắn user vào một replica giữ cho các lần đọc của user đó không bao giờ đi lùi.",
    },
    {
      t: "**Failover** gồm ba việc: phát hiện leader chết (thường bằng timeout heartbeat), chọn follower mới (thường là follower có log mới nhất), và chuyển client sang leader mới. PostgreSQL không tự làm việc phát hiện và chuyển; cần công cụ ngoài.",
      why: "Timeout ngắn thì một lần GC pause hay mạng chập chờn cũng gây failover không cần thiết; timeout dài thì downtime dài. Với replication bất đồng bộ, follower mới có thể thiếu vài commit cuối: các commit đó mất, hoặc xung đột khi leader cũ quay lại.",
    },
    {
      t: "**Split brain**: leader cũ chưa chết hẳn (chỉ bị cô lập) và vẫn nhận ghi trong khi leader mới đã lên. Tài liệu PostgreSQL gọi cơ chế báo cho leader cũ biết nó không còn là leader là **STONITH** (Shoot The Other Node In The Head) và cảnh báo hai bên cùng tưởng mình là primary sẽ dẫn tới mất dữ liệu (https://www.postgresql.org/docs/current/warm-standby-failover.html).",
      why: "Hai leader cùng nhận ghi tạo ra hai lịch sử khác nhau, không có cách gộp tự động. Chặn bằng cách tước quyền ghi của leader cũ (tắt máy, rút IP, fencing token tăng dần mà storage kiểm tra), hoặc chỉ cho leader nào được đa số node công nhận mới được ghi. Xem thêm sim fencing trong Distributed Lock.",
    },
    {
      t: "**Quorum R + W > N** (leaderless): mỗi key có N bản sao, ghi thành công khi W node xác nhận, đọc hỏi R node. Bài về Dynamo: đặt R + W > N cho một hệ \"giống quorum\". Dynamo dùng **sloppy quorum**: ghi vào N node khoẻ đầu tiên trong danh sách ưu tiên, có thể không phải N node \"đúng\"; node thay thế giữ bản ghi kèm gợi ý (**hinted handoff**) rồi trả lại khi node gốc sống lại.",
      why: "R + W > N nghĩa là tập node đọc và tập node ghi luôn giao nhau ít nhất một node, nên lần đọc chạm ít nhất một bản có ghi mới nhất. Sloppy quorum phá điều kiện đó để luôn ghi được: các node ghi tạm có thể không nằm trong tập R node mà lần đọc sau hỏi, nên đọc vẫn có thể thấy bản cũ cho tới khi handoff xong.",
    },
    {
      t: "**Xung đột khi nhiều nơi cùng ghi**: **last-writer-wins** (LWW, giữ bản có timestamp lớn hơn) đơn giản nhưng âm thầm bỏ ghi; **vector clock** phát hiện hai bản song song và trả cả hai cho app gộp (giỏ hàng của Dynamo); **CRDT** là kiểu dữ liệu tự gộp được (xem bài Collaborative Editor).",
      why: "LWW mất ghi vì hai ghi song song không có cái nào thật sự \"sau\", timestamp chỉ chọn ngẫu nhiên theo đồng hồ từng máy (vốn lệch nhau). Vector clock là danh sách cặp (node, bộ đếm) nên biết được hai bản có quan hệ trước–sau hay song song, đổi lại đẩy việc gộp sang app.",
    },
    {
      t: "**Replication không thay backup.** Lệnh `DELETE` nhầm hay migration hỏng cũng được replicate sang mọi bản sao trong vài trăm mili giây.",
      why: "Replication sao chép **mọi** thay đổi, kể cả thay đổi sai, nên nó bảo vệ khỏi hỏng máy chứ không bảo vệ khỏi hỏng dữ liệu. Muốn quay về trạng thái trước sự cố cần backup kèm WAL archive (point-in-time recovery).",
    },
  ],
  table2Title: "Các công nghệ đã học replicate thế nào",
  table2: {
    head: ["Công nghệ", "Cách replicate", "Điều cần nhớ"],
    rows: [
      {
        cells: ["PostgreSQL", "Single-leader, streaming WAL, mặc định async", "`synchronous_commit` chọn mức chờ; failover cần công cụ ngoài"],
        why: "Xem các ý ở trên. Standby có thể nhận query đọc (hot standby).",
      },
      {
        cells: ["Kafka", "Leader mỗi partition + ISR", "Ghi được coi là commit khi **mọi** replica trong ISR đã có; `min.insync.replicas` chỉ có tác dụng với `acks=all`"],
        why: "Kafka không dùng quorum đa số: đa số cần 2f+1 bản để chịu f lỗi, còn ISR chỉ cần f+1 bản. Đổi lại, một replica chậm trong ISR làm chậm commit. Khi mọi replica chết, Kafka mặc định chờ một replica trong ISR quay lại thay vì bầu replica lệch (`unclean.leader.election.enable`), tức chọn nhất quán hơn sẵn sàng (https://kafka.apache.org/44/design/design/#replication).",
      },
      {
        cells: ["Redis", "Master–replica bất đồng bộ", "`WAIT n timeout` chờ n replica nhận ghi nhưng **không** biến Redis thành store nhất quán mạnh"],
        why: "Tài liệu `WAIT` nói rõ: failover qua Sentinel hay Cluster chỉ cố gắng chọn replica tốt nhất, nên vẫn có thể mất một ghi đã được replicate đồng bộ tới nhiều replica (https://redis.io/docs/latest/commands/wait/).",
      },
      {
        cells: ["Cassandra (kế thừa Dynamo)", "Mọi replica nhận ghi cho key nó giữ; N bản sao theo consistent hashing", "Chọn consistency level (`ONE`, `QUORUM`, `ALL`) cho từng thao tác; xung đột giải bằng LWW theo timestamp"],
        why: "Tài liệu Cassandra: ghi luôn được gửi tới **mọi** replica, consistency level chỉ quyết định coordinator chờ bao nhiêu phản hồi; tập đọc và tập ghi giao nhau thì mọi ghi đã xác nhận đều thấy được ở lần đọc sau. Mỗi thay đổi mang timestamp và bản mới nhất thắng, nên đúng đắn phụ thuộc đồng hồ các máy được đồng bộ (https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html). Đặt vị trí bản sao bằng hash ring (xem Consistent Hashing).",
      },
    ],
  },
  tips: [
    {
      t: "Khi vẽ \"Primary + 2 Read Replica\", nói luôn ba câu: replicate đồng bộ hay không, failover mất tối đa bao nhiêu dữ liệu, và luồng nào cần read-your-writes thì đọc ở đâu.",
      why: "Ba câu này là ba câu interviewer sẽ hỏi tiếp. Trả lời trước cho thấy bạn biết replica không miễn phí: nó đổi độ trễ ghi hoặc độ tươi của dữ liệu.",
    },
    {
      t: "Phân biệt rõ: replication để **chịu lỗi và scale đọc**, sharding để **scale ghi và dung lượng**. Hệ lớn dùng cả hai: mỗi shard có leader và replica riêng.",
      why: "Thêm replica không giúp ghi vì mọi ghi vẫn qua một leader. Nhầm hai thứ này là lỗi phổ biến khi interviewer hỏi \"ghi tăng 10 lần thì sao\".",
    },
  ],
  cards: [
    [
      "Replication bất đồng bộ và leader chết. Dữ liệu nào mất?",
      "Các commit đã ack cho client nhưng chưa sang follower được chọn làm leader mới. Giảm bằng replication đồng bộ (ít nhất một standby) hoặc chọn follower có log mới nhất.",
    ],
    [
      "User sửa profile xong reload không thấy thay đổi. Vì sao, chữa thế nào?",
      "Lần đọc rơi vào replica đang trễ. Chữa: đọc từ leader vài giây sau khi ghi, hoặc nhớ LSN của lần ghi và chờ replica áp tới đó (PostgreSQL 19: `WAIT FOR LSN`).",
    ],
    [
      "Vì sao R + W > N cho đọc thấy ghi mới nhất? Khi nào vẫn không?",
      "Tập R node đọc và W node ghi luôn giao nhau nên chạm ít nhất một bản mới. Không còn đúng với sloppy quorum (ghi vào node thay thế), hoặc khi hai ghi song song được giải bằng LWW.",
    ],
    [
      "Split brain là gì, chặn thế nào?",
      "Leader cũ bị cô lập vẫn nhận ghi trong khi leader mới đã lên. Chặn bằng STONITH/fencing (tước quyền ghi của leader cũ) hoặc chỉ cho leader có đa số công nhận được ghi.",
    ],
    [
      "`synchronous_commit = remote_apply` khác `on` ở đâu?",
      "`on` chờ standby flush WAL xuống đĩa (không mất dữ liệu). `remote_apply` chờ thêm standby áp xong, nên query trên standby thấy ngay thay đổi; đổi lại commit chậm hơn nhiều.",
    ],
    [
      "Có replica ở 3 AZ rồi, có cần backup không?",
      "Có. Lệnh xoá nhầm hay migration hỏng cũng được replicate. Backup + WAL archive cho phép quay về thời điểm trước sự cố.",
    ],
  ],
  related: ["cap", "kafka-acks", "redis-cluster", "redlock"],
});
