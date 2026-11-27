/*
 * Giải thích "vì sao" cho từng ý, từng dòng bảng và từng câu deep dive.
 * Gắn theo index của nội dung trong data.js / problems.js; app.js tự ghép khi render.
 */
window.WHY = {};

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
