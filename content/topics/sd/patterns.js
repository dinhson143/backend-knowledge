BK.topic({
  id: "patterns",
  track: "sd",
  section: "sd-patterns",
  title: "Common Patterns",
  goal: "Nhận ra dạng bài và gọi đúng pattern kèm trade-off",
  needs: ["caching", "queue", "dist-lock"],
  tldr: {
    t: "Mỗi bài system design thường là tổ hợp vài pattern. Nhận ra bài toán → gọi đúng pattern → nói trade-off.",
    why: "Vấn đề lặp lại thì lời giải cũng lặp lại, vì các ràng buộc vật lý (mạng, disk, lock, timeout HTTP) giống nhau ở mọi hệ thống. Nhận đúng vấn đề giúp bạn đi thẳng vào phần khó và dành thời gian nói trade-off — phần interviewer thực sự chấm.",
  },
  story: {
    problem: "Bài system design nào cũng trông mới lạ; thiết kế lại từ đầu mỗi lần thì dễ sót vấn đề cốt lõi và hết giờ phỏng vấn.",
    idea: "Nhận ra vấn đề là gọi được lời giải đã kiểm chứng, vì phần lớn bài toán lặp lại cùng một số vấn đề (đẩy realtime, việc chạy lâu, tranh chấp ghi, đọc nhiều, ghi nhiều, file lớn, giao dịch nhiều bước, tìm gần).",
    tradeoff: "Áp pattern máy móc dễ thêm thành phần không cần. Mỗi pattern có chi phí riêng (lock giảm throughput, saga phức tạp, replica có lag), nên phải nói được vì sao dùng và đánh đổi gì.",
  },
  table: {
    head: ["Pattern", "Bài toán", "Giải pháp"],
    rows: [
      {
        cells: [
          "Realtime Updates",
          "Đẩy dữ liệu mới xuống client không cần F5",
          "SSE (1 chiều), WebSocket (2 chiều: chat, game); + Pub/Sub để fan-out giữa các server",
        ],
        why: "SSE và WebSocket giữ kết nối mở nên server đẩy được ngay khi có dữ liệu — với HTTP thường, client hỏi rồi server mới trả, server không tự gửi được. Nhưng mỗi kết nối chỉ gắn với một server, nên khi sự kiện phát sinh ở server khác cần Pub/Sub (Redis, Kafka) để mọi server nhận rồi đẩy xuống đúng client của mình.",
      },
      {
        cells: [
          "Long-Running Tasks",
          "Xuất báo cáo 1M dòng, render video 4K → HTTP timeout",
          "Message queue (RabbitMQ, Kafka) + worker; trả job ID, client poll hoặc nhận notify",
        ],
        why: "Việc chạy hàng phút không thể giữ chung một request, vì load balancer và client thường timeout HTTP sau 30–60s. Đẩy job vào queue và trả job ID ngay → request kết thúc trong vài ms, worker xử lý độc lập, retry được khi lỗi, scale bằng cách thêm worker.",
      },
      {
        cells: [
          "Dealing with Contention",
          "Hàng vạn người sửa cùng một dòng (ghế cuối, tồn kho)",
          "Pessimistic lock, Optimistic lock (version), Distributed lock (Redis/ZooKeeper) + fencing token",
        ],
        why: "Nhiều người cùng đọc-rồi-ghi một dòng gây lost update (hai người cùng thấy còn 1 ghế, cùng mua). Pessimistic lock bắt xếp hàng nên đúng nhưng chậm; optimistic lock kiểm version lúc ghi nên rẻ khi ít xung đột; tài nguyên trải qua nhiều service/DB thì cần distributed lock, kèm fencing token để chặn client giữ lock đã hết hạn mà vẫn ghi.",
      },
      {
        cells: [
          "Scaling Reads",
          "Đọc gấp 100 lần ghi",
          "Read replicas, cache (Redis/Memcached), CDN; + index, denormalize",
        ],
        why: "Đọc không làm thay đổi dữ liệu nên nhân bản ra nhiều chỗ được mà không cần phối hợp: replica chia tải đọc, cache trả từ RAM, CDN trả ngay tại edge gần user. Index giảm số dòng phải quét, denormalize bỏ JOIN → mỗi lần đọc rẻ hơn.",
      },
      {
        cells: [
          "Scaling Writes",
          "Lượng ghi vượt sức 1 DB",
          "Sharding/partitioning, LSM-Tree (Cassandra append-only), write-back cache / batching",
        ],
        why: "Replica không giúp được ghi vì mọi ghi phải đi qua primary, nên phải chia dữ liệu để mỗi máy chỉ nhận một phần ghi (sharding). LSM-Tree biến ghi ngẫu nhiên thành ghi tuần tự (memtable rồi flush SSTable), nhanh hơn nhiều so với cập nhật B-Tree tại chỗ; batching gom nhiều ghi nhỏ thành một lần I/O.",
      },
      {
        cells: [
          "Handling Large Blobs",
          "Upload/download file rất lớn",
          "S3/GCS + CDN, presigned URL, chunked/multipart upload",
        ],
        why: "Đẩy file GB qua app server chiếm băng thông, RAM và luồng xử lý của chính server phục vụ API. Presigned URL cho client upload/download thẳng với S3 mà không lộ credential; multipart chia file thành phần nhỏ để upload song song và retry riêng phần lỗi; CDN phục vụ lượt tải từ edge.",
      },
      {
        cells: [
          "Multi-Step Processes",
          "Chuỗi bước qua nhiều microservice, lỗi giữa chừng phải rollback",
          "Saga (choreography / orchestration) với compensating action; + workflow engine (Temporal)",
        ],
        why: "Không có transaction ACID nào bao trùm được nhiều service, vì mỗi microservice có DB riêng (2PC qua mạng thì chậm và khoá lâu). Saga chia thành chuỗi transaction cục bộ, bước nào lỗi thì chạy compensating action đảo ngược các bước đã xong (hoàn tiền, trả ghế); workflow engine lưu trạng thái từng bước để resume sau khi crash.",
      },
      {
        cells: [
          "Proximity-Based Services",
          "Tìm tài xế / nhà hàng trong bán kính 2km",
          "Geohash, Quadtree, Redis Geo, PostGIS",
        ],
        why: "Index B-Tree thường chỉ sắp theo một chiều, nên query 「lat trong khoảng và long trong khoảng」 vẫn phải quét cả dải. Geohash và Quadtree biến không gian 2 chiều thành ô có thứ bậc → tìm gần chỉ là tra vài ô quanh vị trí; Redis Geo và PostGIS là cài đặt có sẵn của các ý tưởng này.",
      },
    ],
  },
  points: [
    {
      t: "**Optimistic locking** — mọi người cùng đọc; khi ghi kiểm tra version, sai version thì bị từ chối và làm lại. Hợp khi xung đột ít.",
      why: "Không khoá lúc đọc nên mọi người chạy song song, không chờ nhau; lệnh `UPDATE ... SET version = v+1 WHERE version = v` chỉ thành công cho người ghi đầu tiên, người sau thấy 0 dòng bị ảnh hưởng và phải đọc lại. Xung đột hiếm thì gần như không ai phải làm lại; xung đột dày thì retry liên tục, phí công.",
    },
    {
      t: "**Pessimistic locking** — khoá dòng, người sau xếp hàng chờ. Đúng nhưng tốn tài nguyên, dễ nghẽn khi xung đột nhiều.",
      why: "Không bao giờ có lost update, vì `SELECT ... FOR UPDATE` giữ lock tới khi transaction kết thúc, không ai khác ghi chen được. Nhưng mỗi người chờ đều giữ một kết nối DB, và transaction dài làm cả hàng đợi kéo dài → dễ cạn connection pool hoặc deadlock khi tranh chấp cao.",
    },
    {
      t: "**Read replicas** — mọi lệnh ghi đi qua primary, lệnh đọc chia ra nhiều replica; replica có replication lag.",
      why: "Chỉ một node nhận ghi nên không có xung đột ghi, còn đọc nhân ra nhiều replica. Replica nhận thay đổi bất đồng bộ qua log replication nên luôn trễ vài ms đến vài giây → đọc ngay sau khi ghi có thể thấy dữ liệu cũ.",
    },
    {
      t: "**Geohash** — biến (lat, long) thành chuỗi ký tự; prefix chung = gần nhau → dùng index B-Tree thường. Chiều ngược lại không đúng: hai điểm sát nhau ở hai bên biên ô có prefix khác → luôn tìm thêm 8 ô láng giềng.",
      why: "Tìm gần trở thành query prefix (`LIKE 'w3gv%'`) — loại query B-Tree trên chuỗi xử lý tốt. Lý do: geohash chia bản đồ đệ quy, mỗi ký tự thêm vào thu nhỏ ô đang chứa điểm, nên hai điểm cùng nằm trong một ô có chung prefix. Lưu ý: điểm sát biên ô có prefix khác nên phải tra thêm 8 ô láng giềng.",
    },
    {
      t: "**Quadtree** — chia bản đồ thành ô vuông nhiều cấp, ô dày đặc chia nhỏ hơn.",
      why: "Quadtree chỉ chia nhỏ ô khi số điểm vượt ngưỡng → mỗi ô lá chứa số điểm tương đương nhau, tìm kiếm tốn thời gian ổn định. Lưới cố định không làm được vậy vì mật độ dữ liệu không đều (trung tâm thành phố dày, nông thôn thưa): có ô chứa hàng nghìn điểm, có ô rỗng.",
    },
    {
      t: "+ **Saga choreography** — mỗi service nghe event và tự phát event kế tiếp (lỏng nhưng khó theo dõi). **Orchestration** — một orchestrator điều phối từng bước (dễ theo dõi, có điểm trung tâm).",
      why: "Choreography không có ai nắm toàn bộ luồng: thêm service chỉ cần subscribe event nên ít phụ thuộc, nhưng muốn biết một đơn đang ở bước nào phải ghép event từ nhiều nơi. Orchestration gom logic luồng vào một chỗ nên dễ debug và thêm bước; đổi lại orchestrator thành điểm phụ thuộc và phải được làm bền vững.",
    },
  ],
  cards: [
    [
      "Optimistic vs pessimistic locking — khi nào dùng cái nào?",
      "Optimistic (check version khi ghi) khi xung đột hiếm, đọc nhiều. Pessimistic (SELECT FOR UPDATE) khi xung đột thường xuyên và retry đắt.",
    ],
    [
      "Saga pattern giải quyết gì? Hai kiểu?",
      "Transaction phân tán qua nhiều service: mỗi bước có compensating action để rollback, đạt eventual consistency. Choreography (event) vs Orchestration (điều phối trung tâm).",
    ],
    [
      "Tìm tài xế trong bán kính 2km — gợi ý giải pháp?",
      "Geohash / Quadtree / Redis GEO / PostGIS; Redis GEO trong RAM thường phù hợp vì vị trí cập nhật liên tục.",
    ],
    [
      "SSE vs WebSocket?",
      "SSE: server → client 1 chiều, chạy trên HTTP, tự reconnect (notification, live score). WebSocket: 2 chiều liên tục (chat, game).",
    ],
    [
      "Scaling writes có những cách nào?",
      "Sharding/partitioning, DB tối ưu ghi (LSM-tree như Cassandra), batching / write-back cache, queue để làm phẳng peak.",
    ],
    [
      "Long-running task nên thiết kế API thế nào?",
      "POST trả job ID ngay (202 Accepted), job vào queue cho worker; client poll GET /jobs/{id} hoặc nhận webhook/SSE khi xong.",
    ],
  ],
});
