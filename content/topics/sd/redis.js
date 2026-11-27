BK.topic({
  id: "redis",
  track: "sd",
  section: "sd-deep",
  title: "Redis chi tiết",
  tldr: {
    t: "Redis là **in-memory data structure server**: lệnh chạy tuần tự trên một thread nên mỗi lệnh là atomic, latency < 1ms, ~100k+ ops/s mỗi node. Dùng làm cache, counter, lock, rate limiter, leaderboard, geo, pub/sub — nhưng dữ liệu nằm trong RAM và replication **bất đồng bộ**.",
    why: "Mỗi lệnh tự nhiên là atomic, vì chỉ một thread thực thi lệnh → hai lệnh không bao giờ xen nhau, `INCR` không thể bị race giữa đọc và ghi. Mỗi lệnh chỉ tốn micro giây, latency chủ yếu là round-trip mạng, vì dữ liệu nằm trong RAM và không có lock. Failover có thể làm mất write vừa ack, vì primary ack client ngay rồi mới gửi lệnh sang replica (replication bất đồng bộ).",
  },
  story: {
    problem: "Truy cập lặp lại (profile, session, đếm view, top 10) làm DB quá tải, vì database trên đĩa trả lời mất vài ms đến vài chục ms và chỉ chịu được vài nghìn đến vài chục nghìn query/s. Mỗi app server tự cache trong RAM riêng thì các server không chia sẻ được counter, lock hay rate limit.",
    idea: "Một server dùng chung giữ dữ liệu trong RAM, cung cấp sẵn cấu trúc dữ liệu (hash, sorted set, HyperLogLog…) và chạy lệnh tuần tự trên một thread → mỗi thao tác vừa nhanh dưới 1ms vừa atomic, client không phải tự lock.",
    tradeoff: "RAM đắt và có giới hạn; persistence và replication đều bất đồng bộ nên có thể mất dữ liệu khi crash hay failover. Một thread → một lệnh chậm chặn tất cả client.",
  },
  sections: [
    {
      title: "Cấu trúc dữ liệu → bài toán",
      table: {
        head: ["Kiểu", "Lệnh chính", "Dùng cho"],
        rows: [
          {
            cells: ["String", "`GET` `SET` `INCR` `SET NX PX`", "Cache, counter, distributed lock, idempotency key"],
            why: "String là kiểu đơn giản nhất nhưng có lệnh atomic như `INCR` và `SET NX` → cùng một kiểu dùng được cho cache, counter (không race) và lock/idempotency (chỉ một client tạo được key).",
          },
          {
            cells: ["Hash", "`HSET` `HGET` `HINCRBY`", "Object đổi từng field (session, profile)"],
            why: "`HSET user:1 name X` sửa một field mà không phải đọc–sửa–ghi cả object JSON, vì hash lưu nhiều field dưới một key → tránh race khi hai request sửa hai field khác nhau. Hash nhỏ được mã hoá listpack nên tốn ít RAM hơn nhiều key rời.",
          },
          {
            cells: ["List", "`LPUSH` `BRPOP` `LRANGE`", "Queue đơn giản, N id gần nhất (feed)"],
            why: "List hợp làm queue, vì nó là danh sách liên kết (quicklist), push/pop ở hai đầu là O(1); `BRPOP` chặn chờ đến khi có phần tử nên worker không phải polling. `LPUSH` + `LTRIM 0 99` giữ đúng N phần tử mới nhất cho feed.",
          },
          {
            cells: ["Set", "`SADD` `SISMEMBER` `SINTER`", "Tập duy nhất, bạn chung, đã thấy"],
            why: "`SADD` tự loại trùng và `SISMEMBER` là O(1), vì set dựa trên hash table. `SINTER` tính giao trên server → \"bạn chung\" không phải tải hai danh sách về app.",
          },
          {
            cells: [
              "Sorted Set",
              "`ZADD` `ZINCRBY` `ZREVRANGE` `ZRANGEBYSCORE`",
              "Leaderboard, top K, sliding-window rate limit, waiting queue, lịch hẹn theo thời gian",
            ],
            why: "Cập nhật score là O(log N), lấy top K hay khoảng score là O(log N + K), vì sorted set kết hợp skiplist (sắp theo score) và hash table (tra member). Score là timestamp thì cùng cấu trúc đó thành sliding window hay hàng đợi theo thời gian.",
          },
          {
            cells: [
              "Bitmap / HyperLogLog",
              "`SETBIT` `BITCOUNT` · `PFADD` `PFCOUNT`",
              "DAU, unique visitor với bộ nhớ rất nhỏ",
            ],
            why: "100 triệu user chỉ tốn ~12MB cho một ngày, vì bitmap dùng 1 bit cho mỗi user ID. HyperLogLog ước lượng số phần tử khác nhau bằng xác suất trong tối đa 12KB với sai số ~0.81% → đếm unique visitor không cần lưu từng ID.",
          },
          {
            cells: ["Geo", "`GEOADD` `GEOSEARCH`", "Tài xế gần nhất, cửa hàng gần"],
            why: "`GEOSEARCH` chỉ quét vài khoảng score thay vì tính khoảng cách với mọi điểm, vì Geo mã hoá kinh độ/vĩ độ thành geohash 52 bit làm score của một sorted set → điểm gần nhau có score gần nhau.",
          },
          {
            cells: ["Stream", "`XADD` `XREADGROUP` `XACK`", "Log nhẹ có consumer group"],
            why: "Stream giống Kafka thu nhỏ: log append-only có ID tăng dần, có consumer group và pending list (message đã giao chưa `XACK`) → đọc lại được, biết message nào chưa xử lý để giao lại.",
          },
          {
            cells: [
              "Pub/Sub",
              "`PUBLISH` `SUBSCRIBE`",
              "Fan-out realtime giữa các server — **không lưu**, offline là mất",
            ],
            why: "Subscriber đang mất kết nối sẽ không bao giờ nhận được message, vì Pub/Sub chỉ chuyển tiếp tới các connection đang subscribe tại thời điểm `PUBLISH`, không ghi vào đâu cả.",
          },
        ],
      },
    },
    {
      title: "Vì sao nhanh và atomic",
      points: [
        {
          t: "**In-memory** — đọc ghi RAM, không chạm đĩa trên đường request.",
          why: "Lệnh Redis xử lý trong micro giây, latency client thấy chủ yếu là mạng, vì truy cập RAM mất ~100ns còn SSD ~100µs. Persistence (RDB/AOF) chạy nền hoặc ghi vào buffer, không nằm trên đường trả lời.",
        },
        {
          t: "**Một thread thực thi lệnh** (I/O threads từ 6.0 chỉ đọc/ghi socket) → không cần lock, mỗi lệnh là atomic.",
          why: "Không bao giờ có hai lệnh chạy xen nhau, không cần mutex, không tốn context switch, vì chỉ main thread đọc và sửa dữ liệu. I/O threads chỉ phân tích request và ghi response ra socket — phần tốn CPU khi có nhiều connection — nên vẫn giữ được tính atomic.",
        },
        {
          t: "**Nhiều bước atomic** — `MULTI/EXEC` gom lệnh nhưng không rollback và không đọc giữa chừng được; **Lua script** (`EVAL`) chạy trọn trên server trong một round-trip.",
          why: "`MULTI/EXEC` chạy các lệnh đã xếp hàng liền một mạch, không lệnh client khác chen vào; nhưng lệnh chỉ chạy lúc `EXEC` nên không dùng được kết quả lệnh trước để quyết định lệnh sau, và lệnh lỗi giữa chừng không hoàn tác lệnh đã chạy. Muốn \"đọc–so sánh–ghi\" atomic thì dùng Lua script (hoặc Redis Functions từ 7.0): chạy logic có điều kiện ngay trên server, cũng không bị chen ngang.",
        },
        {
          t: "**Pipelining** — gửi nhiều lệnh một lần để giảm round-trip.",
          why: "100 lệnh gửi lần lượt tốn ~100 RTT, vì lệnh Redis chỉ tốn micro giây còn round-trip mạng ~0.2–1ms. Pipelining gửi cả 100 lệnh rồi đọc 100 response, chỉ tốn ~1 RTT; nhưng không atomic — lệnh client khác vẫn xen vào được.",
        },
        {
          t: "**Hệ quả** — một lệnh chậm chặn mọi client: tránh `KEYS *` (dùng `SCAN`), xoá big key bằng `UNLINK`, không `LRANGE 0 -1` trên list triệu phần tử.",
          why: "Trong lúc `KEYS *` duyệt 10 triệu key (vài giây), mọi client khác phải chờ, vì chỉ có một thread. `SCAN` duyệt từng mẻ nhỏ có cursor, `UNLINK` gỡ key khỏi keyspace ngay rồi giải phóng bộ nhớ ở thread nền → main thread không bị chặn lâu.",
        },
      ],
    },
    {
      title: "Pattern hay dùng trong phỏng vấn",
      table: {
        head: ["Pattern", "Cách làm", "Lưu ý"],
        rows: [
          {
            cells: [
              "Cache-aside",
              "`GET` → miss → đọc DB → `SET key val EX 300`",
              "TTL + jitter; xoá key khi ghi DB",
            ],
            why: "Dữ liệu sai lệch tự hết hạn sau tối đa 300s, vì chỉ đọc DB khi miss và cache có TTL. Jitter (TTL ngẫu nhiên ±10%) tránh nhiều key cùng hết hạn một lúc gây stampede; khi ghi DB thì xoá thay vì set, để tránh race hai lần ghi đặt giá trị cũ vào cache.",
          },
          {
            cells: [
              "Distributed lock",
              "`SET lock token NX PX 30000`; nhả bằng Lua so token",
              "Không an toàn khi failover / GC pause → fencing token",
            ],
            why: "`NX` chỉ cho một client tạo key, `PX` tự giải phóng nếu chủ lock chết; token ngẫu nhiên + Lua so token rồi mới `DEL` → không xoá nhầm lock của người khác sau khi lock mình đã hết hạn. Nhưng client GC pause quá 30s, hoặc primary failover trước khi replica nhận key, thì hai client cùng nghĩ mình giữ lock → tài nguyên phía sau phải kiểm tra **fencing token** tăng dần để từ chối client cũ.",
          },
          {
            cells: [
              "Rate limiter",
              "Fixed window `INCR`+`EXPIRE`; sliding window bằng ZSET; token bucket bằng Lua",
              "Lua để atomic giữa nhiều gateway",
            ],
            why: "Giới hạn đúng cho toàn hệ thống thay vì mỗi instance một bộ đếm, vì mọi gateway đều đếm trên cùng một key Redis. Token bucket phải gói trong Lua để chạy atomic: nó cần đọc số token, tính lượng nạp theo thời gian rồi trừ — làm ở client thì hai gateway đọc cùng lúc sẽ cùng thấy còn token.",
          },
          {
            cells: [
              "Leaderboard",
              "`ZINCRBY board 10 user`; `ZREVRANGE board 0 9 WITHSCORES`",
              "O(log N) mỗi lần cập nhật",
            ],
            why: "`ZINCRBY` chỉ chèn lại một node O(log N) và top 10 là đọc 10 node đầu, vì sorted set giữ member sắp theo score bằng skiplist. So với `ORDER BY score LIMIT 10` trên DB cập nhật liên tục, Redis không phải sort lại mỗi lần đọc.",
          },
          {
            cells: [
              "Session store",
              "`HSET session:{id} …` + `EXPIRE`",
              "Mất session khi Redis mất dữ liệu — thường chấp nhận được",
            ],
            why: "Rủi ro mất dữ liệu của Redis thường chấp nhận được với session, vì mất session chỉ buộc user đăng nhập lại, không mất dữ liệu nghiệp vụ. Hash cho phép sửa từng field của session, `EXPIRE` tự dọn session bỏ dở.",
          },
          {
            cells: [
              "Pub/Sub fan-out",
              "Server giữ WebSocket `SUBSCRIBE user:{id}`",
              "Không bền → kết hợp inbox trong DB",
            ],
            why: "Server nhận event publish vào kênh `user:{id}`, và server đang giữ kết nối của user đó sẽ nhận — vì mỗi server chỉ giữ WebSocket của một phần user. Pub/Sub không lưu gì → user offline mất message; ghi inbox vào DB trước rồi mới publish để user lấy lại khi kết nối.",
          },
          {
            cells: ["Idempotency key", "`SET idem:{key} result NX EX 86400`", "Request lặp thì trả lại kết quả cũ"],
            why: "Request lặp (client retry) đọc kết quả cũ thay vì trừ tiền lần hai, vì `NX` đảm bảo chỉ request đầu tiên tạo được key, request sau thấy key đã tồn tại. TTL 24h giới hạn bộ nhớ, đủ dài để bao các lần retry thực tế.",
          },
        ],
      },
    },
    {
      title: "TTL & eviction",
      points: [
        {
          t: "**TTL** — `EXPIRE key 60`. Redis xoá key hết hạn theo hai cách: **lazy** (khi truy cập) + **active** (lấy mẫu định kỳ), nên RAM có thể chưa giải phóng ngay.",
          why: "Redis xoá key hết hạn khi có ai truy cập (lazy) và định kỳ lấy mẫu ngẫu nhiên một ít key có TTL để xoá (active, ~10 lần/s), vì quét mọi key sẽ chặn thread chính. Key hết hạn mà không ai đụng và không bị lấy mẫu trúng vẫn chiếm RAM một thời gian.",
        },
      ],
      table: {
        head: ["maxmemory-policy", "Hành vi khi đầy RAM", "Hợp với"],
        rows: [
          {
            cells: ["noeviction", "Báo lỗi khi ghi", "Redis là nơi lưu chính, không được mất key"],
            why: "Không key nào biến mất ngầm, vì Redis từ chối lệnh ghi (`OOM`) thay vì tự xoá. Hợp khi Redis là nơi lưu chính: lỗi ghi lộ ra ngay, còn mất key thì im lặng.",
          },
          {
            cells: ["allkeys-lru", "Đuổi key lâu nhất chưa dùng", "Cache chung — phổ biến nhất"],
            why: "Đuổi key lâu không dùng giữ lại phần nóng nhất của cache, vì key đó ít khả năng được dùng lại. Redis dùng LRU xấp xỉ: lấy mẫu vài key (`maxmemory-samples` mặc định 5) rồi đuổi key cũ nhất trong mẫu, tránh chi phí giữ danh sách LRU đầy đủ.",
          },
          {
            cells: ["allkeys-lfu", "Đuổi key ít được dùng nhất", "Có tập key hot ổn định"],
            why: "Key hot lâu dài không bị đẩy ra chỉ vì một lần quét lượng lớn key mới, vì LFU đếm tần suất truy cập (counter log, giảm dần theo thời gian). Với LRU, một đợt quét đọc nhiều key một lần cũng đủ đẩy key hot ra.",
          },
          {
            cells: [
              "volatile-lru / volatile-ttl",
              "Chỉ đuổi key có TTL; không còn key có TTL thì báo lỗi như noeviction",
              "Trộn cache và dữ liệu cần giữ",
            ],
            why: "Dữ liệu không TTL (config, dữ liệu cần giữ) an toàn còn key cache bị hy sinh, vì chỉ key có TTL mới bị đuổi. Hết key có TTL để đuổi thì Redis xử sự như `noeviction` và báo lỗi khi ghi.",
          },
        ],
      },
    },
    {
      title: "Persistence",
      table: {
        head: ["Cách", "Hoạt động", "Đánh đổi"],
        rows: [
          {
            cells: [
              "RDB",
              "Snapshot định kỳ (fork process)",
              "File gọn, restart nhanh; mất dữ liệu từ snapshot cuối",
            ],
            why: "Process chính không bị chặn, vì Redis `fork()` một process con ghi toàn bộ dữ liệu ra file nhờ copy-on-write. File là dump nhị phân gọn nên load lại nhanh, nhưng mọi write sau snapshot cuối (có thể vài phút) mất khi crash; fork trên dataset lớn cũng tốn thêm RAM khi có nhiều ghi.",
          },
          {
            cells: [
              "AOF",
              "Ghi log mọi lệnh, `fsync everysec`",
              "Thường mất ~1s (tệ nhất ~2s); file lớn hơn, cần rewrite",
            ],
            why: "Crash chỉ mất phần chưa fsync, khoảng 1s (tệ nhất ~2s nếu đĩa chậm), vì mỗi lệnh ghi được append vào file và `fsync` mỗi giây. File chứa mọi lệnh nên phình to (100 lần `INCR` = 100 dòng), cần rewrite định kỳ thành tập lệnh tối thiểu.",
          },
          {
            cells: ["RDB + AOF", "Kết hợp", "Khuyến nghị khi cần bền"],
            why: "AOF cho độ mất dữ liệu nhỏ, RDB cho backup gọn và khởi động nhanh. Từ Redis 7, AOF rewrite tạo base file dạng RDB cộng các file incremental → restart vừa nhanh vừa mất ít dữ liệu.",
          },
          {
            cells: ["Không bật", "Cache thuần", "Restart = cache lạnh"],
            why: "Không tốn I/O hay fork vì không ghi gì ra đĩa, nhưng restart là RAM trống. Lúc đó toàn bộ traffic miss và đổ vào DB → cần warm-up hoặc chấp nhận DB chịu tải đột biến.",
          },
        ],
      },
    },
    {
      title: "High availability & scale",
      points: [
        {
          t: "**Replication** — primary → replica **bất đồng bộ**; đọc từ replica có thể stale.",
          why: "Đọc từ replica ngay sau ghi có thể thấy giá trị cũ, vì primary trả OK cho client trước rồi mới gửi lệnh qua replication stream → có độ trễ (thường vài ms, lúc tải cao lâu hơn) khi replica chưa có write mới.",
        },
        {
          t: "**Sentinel** — giám sát và tự failover cho mô hình primary/replica không shard.",
          why: "Nhiều process Sentinel cùng ping primary; khi đủ quorum đồng ý primary chết, chúng bầu một Sentinel để promote một replica và báo client địa chỉ mới. Sentinel chỉ lo failover, không chia dữ liệu → toàn bộ dataset vẫn phải vừa một máy.",
        },
        {
          t: "**Redis Cluster** — 16,384 hash slot, `slot = CRC16(key) mod 16384`, mỗi master giữ một dải slot; client đến sai node nhận `MOVED`.",
          why: "Thêm node chỉ cần chuyển một số slot, không phải tính lại vị trí mọi key, vì Cluster chia theo slot cố định thay vì hash trực tiếp ra node. Client giữ bảng slot → node; gửi nhầm node thì nhận `MOVED` kèm địa chỉ đúng và cập nhật bảng.",
        },
        {
          t: "**Hash tag** — trong Cluster, lệnh nhiều key chỉ chạy khi cùng slot: đặt tên `{user42}:cart`, `{user42}:profile`.",
          why: "`MGET` hay Lua trên nhiều key không thể atomic trong Cluster, vì các key khác slot có thể nằm trên hai node khác nhau. Hash tag chỉ băm phần trong `{}` → `{user42}:cart` và `{user42}:profile` chắc chắn cùng slot, cùng node.",
        },
        {
          t: "**Failover có thể mất write đã ack** — vì replication bất đồng bộ. Nhớ điều này khi dùng Redis làm lock hoặc nơi lưu chính.",
          why: "Write đã ack có thể mất vĩnh viễn: primary ack nhưng chết trước khi kịp gửi sang replica, và replica được promote không có write đó. Lệnh `WAIT` giảm rủi ro nhưng không biến Redis thành hệ thống strong consistency.",
        },
      ],
    },
    {
      title: "Câu hỏi hay bị hỏi sâu",
      points: [
        {
          t: "**Hot key** — một key nhận quá nhiều traffic làm một shard quá tải → nhân bản key (`key#1..N`), local cache ở app.",
          why: "Thêm node không giúp gì cho hot key, vì một key chỉ nằm trên một slot, một node. Nhân thành `key#1..N` rải đọc ra N slot, còn local cache ở app (vài giây) chặn phần lớn request trước khi tới Redis.",
        },
        {
          t: "**Big key** — hash/list hàng triệu phần tử làm lệnh chậm và migrate khó → chia nhỏ theo bucket.",
          why: "Lệnh trên big key (`HGETALL`, `DEL`, migrate slot) chặn main thread hàng trăm ms, vì chi phí tỉ lệ với số phần tử. Chia `followers:{id}:{bucket}` giữ mỗi key nhỏ, mỗi thao tác ngắn và key rải được ra nhiều slot.",
        },
        {
          t: "**Chi phí RAM** — đắt hơn đĩa nhiều lần → chỉ giữ dữ liệu nóng, đặt TTL.",
          why: "Chỉ giữ dữ liệu nóng có TTL thì dung lượng tỉ lệ với working set chứ không với toàn bộ dữ liệu. Lý do: RAM đắt hơn SSD hàng chục lần mỗi GB, và Redis còn tốn overhead mỗi key (pointer, metadata).",
        },
        {
          t: "**Cache hay nguồn sự thật?** — mặc định Redis là cache. Dùng làm nơi lưu chính chỉ khi chấp nhận mất một ít dữ liệu, hoặc bật AOF + replica.",
          why: "Luôn có một cửa sổ write đã ack có thể mất khi crash hay failover, vì persistence và replication đều bất đồng bộ. Dùng làm cache thì mất dữ liệu chỉ là miss; dùng làm nguồn sự thật thì phải chấp nhận cửa sổ đó, hoặc thu hẹp bằng AOF `everysec` + replica.",
        },
      ],
    },
    {
      title: "Redis hay lựa chọn khác?",
      points: [
        {
          t: "+ **License & Valkey** — Redis ≤ 7.2 là BSD; 7.4 chuyển sang RSALv2/SSPLv1; từ 8.0 có thêm lựa chọn AGPLv3. **Valkey** là bản tách từ mã BSD của Redis, do Linux Foundation bảo trợ, giữ license BSD.",
          why: "Chọn Redis hay Valkey là câu hỏi license, không phải câu hỏi thiết kế, vì Valkey mang mã Redis BSD nên dùng cùng mô hình dữ liệu và các lệnh cơ bản; trong phỏng vấn nói 'Redis (hoặc Valkey)' là đủ. Nguồn: https://redis.io/legal/licenses/ · https://valkey.io/",
        },
      ],
      table: {
        head: ["", "Redis", "Memcached", "Kafka"],
        rows: [
          {
            cells: ["Dữ liệu", "Nhiều cấu trúc", "Chỉ key–value string", "Log message"],
            why: "Redis cài sẵn sorted set, hash, stream… nên logic chạy trên server; Memcached chỉ có get/set blob nên mọi cấu trúc phải serialize ở client; Kafka không phải store tra cứu theo key mà là log đọc tuần tự.",
          },
          {
            cells: ["Bền", "RDB/AOF tuỳ chọn", "Không", "Bền trên đĩa, có replica"],
            why: "Redis có RDB/AOF để sống qua restart; Memcached thiết kế thuần cache nên restart là trống; Kafka ghi mọi message xuống đĩa và replicate sang broker khác, vì dữ liệu chính là sản phẩm của nó.",
          },
          {
            cells: ["Scale", "Cluster theo slot", "Client-side sharding, đa luồng", "Partition"],
            why: "Redis Cluster tự chia 16384 slot và chuyển slot giữa node; Memcached không có cluster — client tự hash key ra server — nhưng mỗi node dùng nhiều thread nên tận dụng nhiều core; Kafka scale bằng số partition rải trên broker.",
          },
          {
            cells: [
              "Chọn khi",
              "Cache + lock, rank, geo, rate limit",
              "Cache thuần, tận dụng nhiều core",
              "Event bền, replay, nhiều consumer",
            ],
            why: "Cần cấu trúc dữ liệu và thao tác atomic → Redis; chỉ cache blob và muốn một node to dùng hết core → Memcached đơn giản hơn; cần lưu event lâu dài, đọc lại, nhiều consumer → Kafka, vì log bền làm được còn cache trong RAM thì không.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi đưa Redis vào thiết kế, nói rõ: **key** là gì, **cấu trúc** nào, **TTL** bao lâu, **mất dữ liệu** thì sao.",
      why: "Bốn câu hỏi này quyết định bộ nhớ, độ đúng và rủi ro: key quyết định phân bố slot và hot key, cấu trúc quyết định độ phức tạp lệnh, TTL quyết định độ cũ và RAM, còn câu \"mất dữ liệu thì sao\" cho thấy bạn biết Redis có thể mất write.",
    },
    {
      t: "Cần đọc–tính–ghi atomic (rate limit, nhả lock) → Lua script.",
      why: "Lua biến kiểm tra và cập nhật thành một bước atomic, vì nó chạy cả logic trên một thread của server, không lệnh nào chen vào. Đọc ở client rồi ghi lại là hai round-trip — ở giữa, client khác có thể chen vào làm sai kết quả.",
    },
    {
      t: "Lock quan trọng → nhắc fencing token, vì failover có thể làm mất lock.",
      why: "Client thứ hai có thể lấy được cùng lock, vì lock vừa set trên primary có thể chưa sang replica khi failover. Fencing token tăng dần buộc storage từ chối ghi từ token cũ hơn → hai người cùng giữ lock cũng không ghi đè nhau được.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/redis-cluster-slots.svg",
      caption: "Redis Cluster chia keyspace thành 16384 hash slot, mỗi master giữ một dải slot; client tự tính slot của key và đi thẳng tới đúng node, gửi nhầm thì nhận `MOVED`.",
      source: "https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/",
    },
  ],
  related: ["cache-aside", "stampede", "redlock", "token-bucket"],
  cards: [
    [
      "Vì sao một lệnh Redis là atomic?",
      "Redis thực thi lệnh tuần tự trên một thread chính, không lệnh nào chen giữa.",
    ],
    [
      "Muốn đọc–tính–ghi nhiều bước atomic trong Redis?",
      "Lua script (EVAL): chạy trọn trên server trong một round-trip. MULTI/EXEC không rollback và không đọc giữa chừng được.",
    ],
    [
      "Leaderboard top 10 bằng Redis?",
      "Sorted set: ZINCRBY board điểm user để cập nhật, ZREVRANGE board 0 9 WITHSCORES để lấy top 10; O(log N).",
    ],
    [
      "Redis Cluster định tuyến key thế nào?",
      "slot = CRC16(key) mod 16384; mỗi master giữ một dải slot; sai node thì nhận MOVED. Lệnh nhiều key cần cùng slot → hash tag {…}.",
    ],
    [
      "RDB khác AOF thế nào?",
      "RDB: snapshot định kỳ, restart nhanh nhưng mất dữ liệu từ lần snapshot cuối. AOF: log mọi lệnh (fsync mỗi giây), thường mất ~1s (tệ nhất ~2s).",
    ],
    [
      "Vì sao không chạy KEYS * trên production?",
      "Redis thực thi lệnh trên một thread: KEYS quét toàn bộ keyspace và chặn mọi client. Dùng SCAN theo từng đợt.",
    ],
  ],
});
