BK.problem({
  id: "whatsapp",
  level: 2,
  title: "Chat App (WhatsApp)",
  hi: "whatsapp",
  summary: "Realtime 2 chiều qua WebSocket, không mất tin khi người nhận offline, scale hàng tỷ kết nối.",
  topics: ["redis", "patterns", "networking", "queue"],
  fr: [
    "Chat 1-1 và nhóm (≤ 100 người)",
    "Gửi/nhận tin realtime",
    "Người offline nhận lại tin khi online (lưu tối đa 30 ngày)",
    "Gửi media",
  ],
  nfr: [
    {
      t: "Latency < 500ms khi cả hai online",
      why: "Trễ quá 500ms là người dùng thấy lag, vì chat là hội thoại thời gian thực. Yêu cầu này buộc dùng WebSocket giữ sẵn và định tuyến in-memory (Pub/Sub) thay vì poll hoặc đi qua DB.",
    },
    {
      t: "**Guaranteed delivery**",
      why: "Mất một tin nhắn là mất niềm tin vào app, mà người nhận có thể offline bất kỳ lúc nào. Hệ quả: lưu trước khi gửi, inbox chờ ack, retry at-least-once kèm dedupe.",
    },
    {
      t: "Hàng tỷ user, hàng trăm triệu kết nối đồng thời",
      why: "Hệ thống phải scale ngang chat server, vì số kết nối đồng thời vượt xa sức một máy. Đây là gốc của bài toán định tuyến tin giữa các server và lý do chọn kho dữ liệu phân tán.",
    },
    {
      t: "Thứ tự tin nhắn đúng trong một chat",
      why: "Thứ tự trong một chat phải giữ đúng, vì tin sai thứ tự làm hội thoại vô nghĩa. Hệ quả: partition theo `chatId` với sort key thời gian/sequence, để mọi tin của một chat nằm cùng chỗ và sắp xếp sẵn.",
    },
  ],
  capacity: "Mỗi chat server giữ ~vài trăm nghìn WebSocket → cần hàng nghìn server; bài toán là định tuyến tin tới đúng server.",
  entities: ["User", "Chat", "ChatParticipant", "Message", "Client (device)"],
  api: [
    "WS → sendMessage(chatId, text, clientMsgId) → ack",
    "WS → createChat(participants) → chatId",
    "WS ← newMessage(message) → client ack(messageId)",
  ],
  hldWhy: "Cần hàng nghìn **Chat Server**, và tin nhắn phải tìm đúng server của người nhận — vì mỗi server chỉ giữ ~vài trăm nghìn WebSocket. **Redis Pub/Sub** làm lớp định tuyến: server giữ kết nối của Bob subscribe kênh của Bob, nên server của Alice chỉ cần publish, không cần biết topology. **Messages DB** dùng Cassandra vì ghi rất nhiều và đọc theo `chatId` theo thứ tự thời gian — đúng kiểu partition key + clustering key, scale ngang dễ hơn Postgres. **Inbox** tồn tại vì Pub/Sub không lưu tin: người nhận offline thì tin nằm trong inbox chờ tới khi họ online và ack.",
  hld: {
    id: "hld-whatsapp",
    title: "HLD — Chat App",
    h: 340,
    scenario: "Mỗi user nối WebSocket tới một chat server bất kỳ. Pub/Sub định tuyến tin tới server đang giữ kết nối của người nhận.",
    context: "Mỗi client giữ một kết nối **WebSocket** lâu dài tới một chat server bất kỳ do load balancer chọn, nên Alice và Bob thường nằm trên hai server khác nhau. **Redis Pub/Sub** định tuyến tin giữa các server: server giữ kết nối của Bob thì subscribe kênh `user:bob`. **Messages DB** (Cassandra) lưu lịch sử chat bền vững; **Inbox** giữ danh sách tin chưa giao cho từng người nhận. Theo dõi kênh `user:bob` đang trỏ tới server nào và nội dung `bob: [...]` của Inbox: tin chỉ bị xoá khỏi inbox khi Bob đã ack.",
    nodes: [
      { id: "alice", x: 80, y: 70, label: "Alice" },
      { id: "bob", x: 80, y: 270, label: "Bob" },
      { id: "cs1", x: 300, y: 70, label: "Chat Server 1" },
      { id: "pubsub", x: 300, y: 170, label: "Redis Pub/Sub" },
      { id: "cs2", x: 300, y: 270, label: "Chat Server 2" },
      { id: "msgdb", x: 600, y: 70, label: "Messages DB", s: "Cassandra" },
      { id: "inbox", x: 600, y: 270, label: "Inbox", s: "bob: []" },
    ],
    links: [
      ["alice", "cs1"],
      ["bob", "cs2"],
      ["cs1", "pubsub"],
      ["cs2", "pubsub"],
      ["cs1", "msgdb"],
      ["cs1", "inbox"],
      ["cs2", "inbox"],
    ],
    variants: [
      {
        name: "Bob đang online",
        steps: [
          {
            note: "Server giữ kết nối của ai thì **subscribe** kênh của người đó.",
            msgs: [["cs2", "pubsub", "SUBSCRIBE user:bob"]],
            set: { pubsub: "user:bob → Server 2" },
            detail: "Server 2 `SUBSCRIBE user:bob` trên Redis Pub/Sub sau khi WebSocket của Bob rơi vào nó. Từ giờ server nào publish vào `user:bob` thì Redis đẩy thẳng tới Server 2. Cách khác là giữ bảng `user → server` rồi gọi RPC trực tiếp, nhưng phải tự giữ bảng đó đúng khi kết nối rớt hay server restart. Pub/Sub để Redis lo định tuyến; khi kết nối đóng, server unsubscribe.",
          },
          {
            note: "Alice gửi tin. Server 1 lưu message và ghi vào **inbox** của Bob trước khi ack.",
            msgs: [
              ["alice", "cs1", "sendMessage"],
              ["cs1", "msgdb", "INSERT msg#501"],
              ["cs1", "inbox", "INSERT bob,#501"],
              ["cs1", "alice", "ack ✓", "ok"],
            ],
            set: { msgdb: "chat9: msg#501", inbox: "bob: [#501]" },
            detail: "Server 1 ghi bền tin của Alice vào hai chỗ **trước khi ack**: `INSERT msg#501` vào Messages DB (lịch sử của `chat9`) và `INSERT bob,#501` vào **Inbox** của Bob. Chỉ sau đó Alice mới nhận **✓** (server đã nhận) → Server 1 crash ngay sau ack thì tin vẫn nằm trong DB và inbox, không mất. Client nên gửi kèm message id tự sinh để server bỏ qua bản trùng khi Alice retry.",
          },
          {
            note: "Publish lên kênh của Bob; Pub/Sub chuyển tới Server 2.",
            msgs: [["cs1", "pubsub", "PUBLISH user:bob"], ["pubsub", "cs2", "msg#501", "ok"]],
            detail: "Redis chuyển `msg#501` tới Server 2 — subscriber duy nhất của kênh — khi Server 1 `PUBLISH user:bob`. Redis Pub/Sub là **fire-and-forget**: không lưu tin, không retry, subscriber đang mất kết nối thì tin mất luôn. Vì vậy bước trước phải ghi inbox; Pub/Sub chỉ là đường nhanh để giao tức thì, không đảm bảo tin tới nơi.",
          },
          {
            note: "Đẩy xuống Bob; Bob ack → xoá khỏi inbox (✓✓ delivered).",
            msgs: [
              ["cs2", "bob", "newMessage", "ok"],
              ["bob", "cs2", "ack #501", "ok"],
              ["cs2", "inbox", "DELETE bob,#501", "ok"],
            ],
            set: { inbox: "bob: []", bob: "✓✓ đã nhận" },
            lesson: "Lưu trước, đẩy sau, xoá khi client ack → không mất tin dù lỗi ở bước nào.",
            detail: "Bob nhận tin và ack, Server 2 xoá tin khỏi inbox, Alice thấy **✓✓** (delivered). Trình tự: Server 2 đẩy `newMessage` xuống Bob qua WebSocket; app lưu tin vào máy rồi gửi `ack #501`; chỉ khi nhận ack, Server 2 mới `DELETE bob,#501`. Nếu tin đã đẩy xuống mà Bob rớt mạng trước khi ack, tin vẫn còn trong inbox và được giao lại lần sau — client dedup theo message id. Đây là **at-least-once delivery** cộng dedup phía client → với người dùng, kết quả như exactly-once.",
          },
        ],
      },
      {
        name: "Bob offline",
        steps: [
          {
            note: "Bob mất mạng — không server nào subscribe `user:bob`.",
            set: { bob: "offline", pubsub: "user:bob → (không ai)" },
            detail: "Bob mất mạng: WebSocket đóng (hoặc server phát hiện qua heartbeat timeout), Server 2 unsubscribe `user:bob` → kênh của Bob không còn ai nghe. Trên mạng di động, cảnh này xảy ra liên tục — vào thang máy, đổi từ Wi-Fi sang 4G — nên hệ thống phải coi offline là bình thường, không phải lỗi.",
          },
          {
            note: "Alice gửi tin; lưu message + inbox như bình thường.",
            msgs: [
              ["alice", "cs1", "sendMessage"],
              ["cs1", "msgdb", "INSERT msg#502"],
              ["cs1", "inbox", "INSERT bob,#502"],
              ["cs1", "alice", "ack ✓", "ok"],
            ],
            set: { inbox: "bob: [#502]" },
            detail: "Server 1 xử lý `msg#502` y hệt khi Bob online: ghi Messages DB, ghi inbox `bob: [#502]`, rồi ack ✓ cho Alice. Người gửi không cần biết người nhận online hay không — một luồng ghi duy nhất giữ code đơn giản, không có nhánh dễ quên. Alice chỉ thấy một dấu ✓ tới khi Bob thật sự nhận.",
          },
          {
            note: "Publish không tới ai — **không sao**, tin vẫn nằm trong inbox.",
            msgs: [["cs1", "pubsub", "PUBLISH user:bob", "warn"]],
            detail: "Server 1 vẫn `PUBLISH user:bob`, nhưng không có subscriber nên Redis trả số người nhận = 0 và tin không đi đâu cả. Điều này **không sao** vì bản bền của tin đã nằm trong inbox. Server dùng kết quả 0 để gửi **push notification** (APNs/FCM) đánh thức app của Bob — animation không vẽ bước này nhưng app chat thật luôn có.",
          },
          {
            note: "Bob online lại: subscribe và **kéo inbox** về.",
            msgs: [
              ["bob", "cs2", "connect"],
              ["cs2", "pubsub", "SUBSCRIBE user:bob"],
              ["cs2", "inbox", "SELECT undelivered"],
              ["inbox", "cs2", "[#502]", "ok"],
              ["cs2", "bob", "msg#502", "ok"],
              ["bob", "cs2", "ack", "ok"],
            ],
            set: { inbox: "bob: []", bob: "✓✓ đã nhận", pubsub: "user:bob → Server 2" },
            lesson: "Inbox theo user/device + ack = guaranteed delivery; Pub/Sub chỉ là đường tắt khi người nhận online.",
            detail: "Bob online lại và nhận `msg#502` từ inbox; Bob ack, inbox được xoá, Alice thấy ✓✓. WebSocket rơi vào Server 2 (có thể là server bất kỳ); Server 2 subscribe `user:bob` **trước**, rồi mới `SELECT undelivered` từ inbox — thứ tự này để tin tới trong lúc đọc inbox không bị lọt, cùng lắm nhận hai lần và dedup theo id. Inbox theo người nhận (thực tế theo từng device) cộng ack mới là thứ đảm bảo giao tin; Pub/Sub chỉ là đường tắt khi người nhận đang online.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Tin gửi tới server nào đang giữ kết nối của người nhận?",
      bad: "Một chat server duy nhất.",
      good: "Consistent hashing user → server + service discovery (ZooKeeper).",
      great: "Redis Pub/Sub kênh theo user: server giữ kết nối thì subscribe; không cần biết topology.",
      why: {
        bad: "Hàng trăm triệu user online không thể dồn vào một máy, vì một server chỉ giữ được vài trăm nghìn kết nối; máy đó còn là single point of failure.",
        good: "Consistent hashing biết trước user nằm ở server nào nên gửi thẳng tới đó. Nhưng mỗi lần thêm/bớt server, một phần user phải reconnect sang server mới, và mọi chat server phải theo dõi membership qua ZooKeeper — phức tạp vận hành.",
        great: "Người gửi chỉ publish vào kênh, không cần biết server nào, vì kênh Pub/Sub đặt theo user và server nào đang giữ kết nối thì subscribe kênh đó. User reconnect sang server khác chỉ cần subscribe lại, không phải cập nhật bảng định tuyến.",
      },
    },
    {
      q: "Đảm bảo không mất tin?",
      bad: "Đẩy thẳng qua WebSocket, lỗi thì thôi.",
      good: "Lưu DB trước khi gửi.",
      great: "Lưu message + inbox, client ack mới xoá; retry at-least-once, dedupe bằng clientMsgId.",
      why: {
        bad: "Tin gửi thẳng mà không lưu thì biến mất vĩnh viễn, vì WebSocket có thể đứt đúng lúc gửi hoặc người nhận đang offline.",
        good: "Lưu DB trước nên tin không mất khi server crash. Nhưng thiếu ack nên server không biết client đã nhận chưa, không biết lúc nào cần gửi lại.",
        great: "Tin chưa xác nhận được gửi lại khi client reconnect (at-least-once), vì tin chỉ bị xoá khỏi inbox khi client ack. Retry có thể tạo bản trùng, nên client và server dùng `clientMsgId` bỏ bản đã thấy → với người dùng, kết quả tương đương exactly-once.",
      },
    },
    {
      q: "Lưu hàng tỷ tin nhắn?",
      bad: "Một bảng Postgres.",
      good: "Shard theo chatId.",
      great: "Cassandra/DynamoDB: partition key chatId, sort key timestamp → đọc lịch sử theo thứ tự cực nhanh; TTL 30 ngày.",
      why: {
        bad: "Một bảng Postgres phình tới hàng chục TB với hàng tỷ tin mỗi ngày: index không còn vừa RAM, write throughput của một primary không đủ.",
        good: "Shard theo `chatId` chia tải ghi và giữ tin cùng chat chung shard. Nhưng tự shard Postgres thì phải tự lo routing, resharding và failover.",
        great: "Đọc lịch sử chat là một lần quét tuần tự đã có thứ tự, vì Cassandra/DynamoDB phân tán sẵn theo partition key `chatId` và sắp theo sort key timestamp trong partition. Ghi dạng append (LSM-tree) nên throughput ghi rất cao; TTL tự dọn tin cũ, không cần job xoá.",
      },
    },
  ],
  sims: ["realtime"],
});
