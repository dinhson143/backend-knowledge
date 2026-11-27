/*
 * Giải thích chi tiết cho mô phỏng: "Bối cảnh" của từng mô phỏng và "Chuyện gì xảy ra" ở từng bước.
 * Gắn theo index variant/step của diagrams.js và hld trong problems.js.
 */
window.SIM_DETAIL = {
 "cache-aside": {
  "context": "Cache-aside (còn gọi lazy loading) đặt toàn bộ logic cache trong app: app tự hỏi cache, miss thì tự đọc DB rồi tự ghi lại cache — Redis không biết gì về DB. Có 4 thành phần: Client gọi API, **App Server** chứa logic cache, **Redis** chỉ là kho key-value thụ động, **PostgreSQL** là nguồn sự thật. Theo dõi dòng chữ dưới Redis (`trống` → `user:42 ✓ TTL 300s` → `trống`) và để ý request nào có mũi tên chạm PostgreSQL — đó là request đắt.",
  "variants": [
   {
    "v": 0,
    "name": null,
    "steps": [
     {
      "i": 0,
      "key": "User mở profile `GET /users/42`.",
      "detail": "App **luôn hỏi cache trước**: Client gửi `GET /users/42` tới App Server, app chạy `GET user:42` trên Redis — một round-trip trong mạng nội bộ chỉ tốn khoảng 0.5–1ms. Key theo quy ước `<entity>:<id>` để mọi request đọc cùng user trúng cùng một key. Lúc này Redis đang `trống` vì chưa ai đọc user 42."
     },
     {
      "i": 1,
      "key": "Cache chưa có key → **MISS**. Ap",
      "detail": "Redis không có `user:42` nên trả `nil` — **cache miss**, app phải tự chạy `SELECT … WHERE id=42` xuống PostgreSQL. Redis không tự đi lấy dữ liệu (khác read-through cache). Miss là chuyện bình thường ở lần đọc đầu (cold cache), sau khi key hết TTL hoặc bị xoá — không phải lỗi, chỉ là đường chậm."
     },
     {
      "i": 2,
      "key": "DB trả row. App ghi vào cache kè",
      "detail": "App ghi row vào cache với **TTL 300 giây**: PostgreSQL trả row 42 (đọc theo primary key qua index, vài ms tới vài chục ms tuỳ tải), app serialize thành JSON rồi `SET user:42 <json> EX 300` → Redis tự xoá key sau 5 phút. TTL là lưới an toàn: kể cả khi code quên xoá cache lúc ghi, dữ liệu cũ chỉ sống tối đa 5 phút. Node Redis giờ hiện `user:42 ✓ TTL 300s`."
     },
     {
      "i": 3,
      "key": "Trả về client: request đầu mất ~",
      "detail": "Request đầu mất ~25ms: app trả `200` sau một round-trip Redis (miss) + query DB + `SET` Redis + xử lý, phần lớn thời gian nằm ở DB. Đây là cái giá của request đầu tiên; mọi request sau trong 300 giây không phải trả nữa."
     },
     {
      "i": 4,
      "key": "Request thứ hai trong TTL: cache",
      "detail": "Request thứ hai trong TTL là **cache hit**, tổng ~2ms — nhanh hơn ~12 lần. `GET user:42` trả JSON có sẵn, app deserialize rồi trả luôn, không mũi tên nào chạm PostgreSQL: profile được đọc 1,000 lần trong 5 phút thì DB chỉ chịu 1 query thay vì 1,000. Đó là toàn bộ lý do dùng cache: giảm latency và giảm tải đọc cho DB."
     },
     {
      "i": 5,
      "key": "User đổi tên: app **UPDATE DB rồ",
      "detail": "Khi user đổi tên, app `UPDATE users` trên PostgreSQL trước (DB là nguồn sự thật, phải đúng trước), rồi `DEL user:42` thay vì `SET` giá trị mới. Xoá chứ không ghi đè vì hai request ghi chạy song song có thể `SET` vào cache theo thứ tự ngược với thứ tự commit vào DB, để lại tên sai tới hết TTL; xoá thì lần đọc kế tiếp miss và nạp bản mới từ DB. Vẫn còn một race nhỏ: request đọc lấy bản cũ từ DB ngay trước UPDATE rồi `SET` vào cache ngay sau DEL — nên vẫn cần TTL làm giới hạn trên cho dữ liệu sai, hoặc xoá thêm lần nữa sau vài trăm ms (delayed double delete)."
     }
    ]
   }
  ]
 },
 "cache-write": {
  "context": "Ba variant khác nhau ở hai chỗ: lần ghi đi vào đâu trước, và app trả `200` cho admin **khi nào**. Admin đổi giá sản phẩm từ 80 thành 99; ban đầu cả **Cache** và **Database** đều giữ `price=80`. Theo dõi dòng chữ dưới Cache và Database: lúc nào hai bên lệch nhau, lệch thì bên nào sai; con số latency trên mũi tên trả về (30ms vs 2ms) là cái giá/lợi của từng chiến lược.",
  "variants": [
   {
    "v": 0,
    "name": "Write-Through",
    "steps": [
     {
      "i": 0,
      "key": "Admin gửi giá mới.",
      "detail": "Admin gửi `PUT price=99` tới App Server; chưa thành phần nào thay đổi, cache và DB vẫn `price=80`. Chiến lược ghi quyết định thứ tự bước tiếp theo."
     },
     {
      "i": 1,
      "key": "App ghi vào cache, cache ghi **đ",
      "detail": "Sau bước này cả hai node đều `price=99`: với write-through, app ghi vào cache và lớp cache **ghi đồng bộ** tiếp xuống DB trong cùng một thao tác. Một số hệ như DynamoDB DAX hoặc cache trong ORM làm vậy; với Redis thường thì chính app ghi cả hai liên tiếp. Request của admin vẫn đang treo, chưa được trả lời."
     },
     {
      "i": 2,
      "key": "Nhất quán vì chỉ trả lời khi DB",
      "detail": "Khi admin nhận `200`, **cả cache và DB đều đã có 99**, nên mọi lần đọc ngay sau đều thấy giá mới. Đổi lại, app chỉ trả `200` sau ~30ms — DB commit, ack cho cache, cache ack cho app — bằng tổng thời gian ghi cache + ghi DB. Nếu ghi DB lỗi, request phải báo lỗi (và gỡ giá trị khỏi cache) chứ không được ack, nếu không cache sẽ giữ giá mà DB không có. Nhược điểm khác: dữ liệu ít ai đọc cũng bị nhét vào cache, tốn RAM."
     }
    ]
   },
   {
    "v": 1,
    "name": "Write-Around",
    "steps": [
     {
      "i": 0,
      "key": "Admin gửi giá mới.",
      "detail": "Admin gửi `PUT price=99`; cache và DB vẫn cùng giữ 80."
     },
     {
      "i": 1,
      "key": "Ghi thẳng DB, bỏ qua cache.",
      "detail": "DB giờ là 99 nhưng cache vẫn `price=80` — hai bên lệch, và **cache là bên sai**. App ghi **thẳng vào DB** bằng `UPDATE price=99`, không đụng cache. Dừng ở đây thì mọi request đọc hit cache và thấy giá 80 tới khi key hết TTL — khách có thể đặt hàng với giá cũ."
     },
     {
      "i": 2,
      "key": "Cache còn giá cũ → phải **DEL** ",
      "detail": "App gửi `DEL price` (mũi tên vàng) để xoá khoảng lệch — cache giờ `(trống)`. Không chủ động xoá thì cách duy nhất còn lại là TTL ngắn và chấp nhận giá cũ tồn tại tới khi hết hạn. Admin được trả lời ngay sau khi DB commit, nên latency ghi chỉ bằng ghi DB, không tốn thêm chi phí ghi cache."
     },
     {
      "i": 3,
      "key": "Lần đọc tới MISS và nạp giá 99 t",
      "detail": "Lần đọc đầu sau mỗi lần ghi luôn chậm — đó là cái giá của write-around. Request đọc kế tiếp `GET` vào cache, nhận **MISS** (mũi tên đỏ), app tự `SELECT` DB lấy 99 rồi `SET 99` vào cache — đúng luồng cache-aside, tốn một round-trip DB. Write-around hợp với dữ liệu ghi nhiều mà ít khi đọc lại ngay (log, bản ghi lịch sử), vì không tốn RAM cache cho thứ không ai đọc."
     }
    ]
   },
   {
    "v": 2,
    "name": "Write-Back",
    "steps": [
     {
      "i": 0,
      "key": "Admin gửi giá mới.",
      "detail": "Admin gửi `PUT price=99`; cache và DB vẫn cùng giữ 80."
     },
     {
      "i": 1,
      "key": "Ghi vào cache rồi trả lời **ngay",
      "detail": "App trả `200` chỉ sau ~2ms — **không chờ DB**: app `SET price=99` vào cache và cache trả `ok` ngay. Cache đánh dấu entry là **dirty**: giá trị đã đổi nhưng chưa ghi xuống nơi lưu trữ bền. Với admin, thao tác đã thành công."
     },
     {
      "i": 2,
      "key": "DB vẫn giữ giá cũ, chờ tiến trìn",
      "detail": "Trong cửa sổ chờ flush, **bản 99 duy nhất nằm trong RAM của cache node**; DB vẫn `price=80 (cũ)`. Một tiến trình nền gom các entry dirty và flush xuống DB định kỳ (mỗi vài giây) hoặc theo lô, nên nhiều lần ghi vào cùng key gộp thành một lần ghi DB — lý do write-back cho throughput ghi rất cao. Báo cáo, job hay service nào đọc thẳng DB đều thấy 80."
     },
     {
      "i": 3,
      "key": "Cache node sập **trước khi flush",
      "detail": "Cache node sập trước lượt flush → **mất dữ liệu im lặng**: admin đã nhận `200`, nhưng DB vẫn 80 và không còn bản 99 nào ở đâu. Node sập (OOM, mất điện, restart) nên lệnh flush không bao giờ chạy và RAM chứa giá 99 biến mất, không log lỗi nào gắn với request của admin. Cache khởi động lại trống, nạp 80 từ DB và hệ thống tiếp tục bán giá cũ. Vì vậy write-back chỉ dùng cho dữ liệu chịu mất được (counter, metrics) hoặc khi cache có persistence/replication (AOF, WAL) bù cho cửa sổ này."
     }
    ]
   }
  ]
 },
 "stampede": {
  "context": "**Cache stampede** (thundering herd) xảy ra khi một hot key hết hạn và hàng loạt request cùng miss, cùng đi rebuild từ DB một lúc. Key `feed:hot` là **hot key**: gần như mọi request đều đọc nó, nên cache gánh hết tải và DB chỉ ở CPU 20%. Theo dõi dòng chữ dưới Database (CPU 20% → 100% hoặc 22%) và dưới App Servers (số request đang chờ). Variant thứ hai cho thấy **single flight** (request coalescing) gom các miss thành một query.",
  "variants": [
   {
    "v": 0,
    "name": "Không bảo vệ",
    "steps": [
     {
      "i": 0,
      "key": "Bình thường: mọi request đọc từ ",
      "detail": "Mọi request `GET /feed` đều **HIT**: app `GET feed:hot` và cache trả toàn bộ 50k req/s trong vài trăm micro-giây, nên DB gần như rảnh (CPU 20%). DB **không được dimension** để chịu tải đọc thật — nó dựa hoàn toàn vào cache."
     },
     {
      "i": 1,
      "key": "TTL hết hạn đúng giờ cao điểm.",
      "detail": "TTL của `feed:hot` hết đúng lúc cao điểm, Redis xoá key (`feed:hot ✗ expired`). Bước này không có lỗi: hết hạn là hành vi đúng thiết kế. Nguy hiểm ở chỗ key biến mất **tức thì** trong khi lưu lượng đọc vẫn 50k req/s, và chưa ai kịp nạp lại."
     },
     {
      "i": 2,
      "key": "1,000 request cùng MISS một lúc.",
      "detail": "1,000 request đang bay cùng gọi `GET feed:hot` và cùng nhận **MISS** trong vài chục ms sau khi key hết hạn. Mỗi request xử lý độc lập theo cache-aside: \"miss thì tự đọc DB rồi SET lại\". Không request nào biết request khác cũng đang làm đúng việc này."
     },
     {
      "i": 3,
      "key": "Tất cả cùng query DB để rebuild ",
      "detail": "DB lên **CPU 100%** vì 1,000 query giống hệt nhau đổ vào cùng lúc. Query build feed thường nặng (join, sort, aggregate) → connection pool cạn, latency tăng từ ms lên giây. Query chậm thì request mới tiếp tục miss (cache chưa được SET lại) và dồn thêm query — vòng xoáy tự khuếch đại. Kết quả: DB timeout hoặc sập, kéo theo **mọi tính năng khác** dùng chung DB, chỉ vì một key hết hạn; 1,000 query cùng tính ra một kết quả trong khi chỉ cần một."
     }
    ]
   },
   {
    "v": 1,
    "name": "Single flight + jitter",
    "steps": [
     {
      "i": 0,
      "key": "Bình thường: mọi request đọc từ ",
      "detail": "Giống variant trước: mọi request hit cache, DB ở CPU 20%. Khác biệt chỉ lộ ra khi key hết hạn."
     },
     {
      "i": 1,
      "key": "TTL hết hạn đúng giờ cao điểm.",
      "detail": "TTL của `feed:hot` hết hạn đúng giờ cao điểm, Redis xoá key — trạng thái giống hệt variant không bảo vệ. Single flight không ngăn key hết hạn, nó chỉ đổi cách app phản ứng với miss."
     },
     {
      "i": 2,
      "key": "**Single flight**: 1,000 request",
      "detail": "1,000 request cùng miss, nhưng nhờ **single flight** chỉ một request đi rebuild: request đầu tiên cho key `feed:hot` đăng ký làm **leader** (ví dụ giữ một promise/future trong map theo key, như `singleflight` của Go). 999 request sau thấy đã có leader đang rebuild thì **không query DB**, chỉ chờ kết quả của leader. Lưu ý: map này nằm trong từng process — nhiều app server thì mỗi server có một leader, hoặc phải dùng lock phân tán (`SET lock:feed:hot NX EX 5` trên Redis) để còn đúng một leader toàn cluster."
     },
     {
      "i": 3,
      "key": "Chỉ **1 query** xuống DB.",
      "detail": "Chỉ một `SELECT` xuống DB, DB trả rows và CPU chỉ nhích lên 22%. Cái giá: 999 request chờ thêm đúng bằng thời gian một query (ví dụ 50–200ms) thay vì được trả từ cache ngay. Cần đặt timeout cho việc chờ, để leader treo thì follower không bị kẹt mãi."
     },
     {
      "i": 4,
      "key": "Leader ghi lại cache với TTL có ",
      "detail": "Leader `SET feed:hot … EX 60±10s` rồi trả kết quả cho cả 1,000 request đang chờ; từ đó request mới lại hit cache. TTL có **jitter** (ngẫu nhiên 50–70s) để các key nạp cùng lúc không cùng hết hạn ở lần sau, tránh stampede đồng loạt trên nhiều key. Với một hot key duy nhất như ở đây, làm tốt hơn nữa bằng **refresh sớm** (rebuild trước khi hết hạn) hoặc **stale-while-revalidate** (trả bản cũ trong lúc một request rebuild) để không ai phải chờ."
     }
    ]
   }
  ]
 },
 "cap": {
  "context": "CAP nói: khi có **network partition**, hệ phải chọn **C** (consistency — từ chối nếu không chắc dữ liệu mới nhất) hoặc **A** (availability — luôn trả lời, chấp nhận dữ liệu cũ). Partition là khi hai node vẫn sống, vẫn nhận request, nhưng không nói chuyện được với nhau. Kho còn đúng 1 sản phẩm, `stock` được nhân bản trên **Node A** (gần Hà Nội) và **Node B** (gần HCM). Theo dõi dòng `stock` dưới mỗi node và đường nối A–B bị cắt.",
  "variants": [
   {
    "v": 0,
    "name": "CP — ưu tiên đúng",
    "steps": [
     {
      "i": 0,
      "key": "A và B đồng bộ với nhau.",
      "detail": "Cả hai node cùng giữ `stock=1`, nên user ở đâu đọc cũng ra cùng một số. Hai node trao đổi cập nhật liên tục qua đường nối A–B: mỗi lần ghi ở một node được replicate sang node kia."
     },
     {
      "i": 1,
      "key": "**Network partition**: hai node ",
      "detail": "Đường mạng giữa A và B đứt (đứt cáp, switch lỗi, firewall chặn nhầm), nhưng cả hai vẫn sống và vẫn có user gọi tới. Điểm khó: mỗi node chỉ thấy node kia **im lặng** — không phân biệt được node kia chết hay chỉ mạng đứt, nên không thể giả định node kia không nhận ghi."
     },
     {
      "i": 2,
      "key": "User Hà Nội mua sản phẩm cuối tr",
      "detail": "User Hà Nội gửi `BUY` tới A, A trừ kho xuống `stock=0` và trả `OK`. Trong hệ CP thật, A chỉ được làm vậy nếu là **leader/owner** của dữ liệu hoặc nằm ở phía có quorum (đa số). Với đúng 2 node thì không phía nào có đa số, nên hệ CP chặt (Raft/Paxos) sẽ khiến **cả A cũng từ chối**; mô phỏng ở đây ngầm coi A là primary."
     },
     {
      "i": 3,
      "key": "B không nhận được cập nhật.",
      "detail": "B vẫn hiện `stock=1 (chưa biết)` vì A replicate `stock=0` sang nhưng gói tin không tới. B không biết mình đang cũ — từ góc nhìn của nó, chỉ có đường nối im lặng."
     },
     {
      "i": 4,
      "key": "User HCM gọi B. Hệ **CP**: B từ ",
      "detail": "B trả `503 Unavailable` cho `BUY` của user HCM: là hệ CP, B biết mình mất liên lạc với primary/quorum nên **không dám trả lời** bằng dữ liệu có thể đã cũ. User HCM không mua được, kể cả khi lẽ ra (nếu A không bán) vẫn còn hàng. Cái giá là **mất availability** ở phía bị cô lập, đổi lại không bao giờ bán quá số hàng có. Đây là lựa chọn đúng cho tồn kho, thanh toán, đặt vé — nơi sai số liệu đắt hơn vài phút lỗi."
     }
    ]
   },
   {
    "v": 1,
    "name": "AP — ưu tiên sẵn sàng",
    "steps": [
     {
      "i": 0,
      "key": "A và B đồng bộ với nhau.",
      "detail": "Giống variant CP: A và B đồng bộ hai chiều, cùng `stock=1`."
     },
     {
      "i": 1,
      "key": "**Network partition**: hai node ",
      "detail": "Đường nối A–B đứt, và với lựa chọn AP mỗi node **tiếp tục phục vụ độc lập** bằng dữ liệu nó đang có. Mỗi node chỉ thấy node kia im lặng, không phân biệt được node kia chết hay mạng đứt."
     },
     {
      "i": 2,
      "key": "User Hà Nội mua sản phẩm cuối tr",
      "detail": "User Hà Nội `BUY` trên A, A trừ còn `stock=0` và trả `OK`. Với AP, A không cần hỏi ai: nhận ghi cục bộ và định gửi cập nhật cho B sau."
     },
     {
      "i": 3,
      "key": "B không nhận được cập nhật.",
      "detail": "Replicate từ A sang B thất bại (mũi tên đỏ), cập nhật nằm chờ trong hàng đợi của A. B vẫn tin `stock=1` và không có cách nào biết điều ngược lại."
     },
     {
      "i": 4,
      "key": "Hệ **AP**: B vẫn trả lời bằng dữ",
      "detail": "Giờ **hai đơn hàng đã được xác nhận cho một sản phẩm** — oversell. User HCM `BUY` trên B; hệ AP ưu tiên trả lời, nên B thấy `stock=1` cục bộ, trừ xuống 0 và trả `OK (stale)`. Nguy hiểm ở chỗ cả hai user đều nhận phản hồi thành công, lúc đó không lỗi nào hiện ra."
     },
     {
      "i": 5,
      "key": "Mạng nối lại, hai node **reconci",
      "detail": "Mạng nối lại, hai node trao đổi log ghi để **reconcile** — nhưng conflict này không hoà giải tự động cho đúng được. Hai lệnh ghi đồng thời cùng trừ sản phẩm cuối là một **conflict**: last-write-wins chỉ giữ `stock=0` và lặng lẽ bỏ qua chuyện đã bán 2. Hệ thống phải phát hiện conflict (vector clock, CRDT counter, hoặc so tổng đơn với tồn kho) và xử lý bằng nghiệp vụ: huỷ một đơn, hoàn tiền, xin lỗi, hoặc nhập thêm hàng. AP hợp cho feed, like, profile — nơi dữ liệu cũ vài giây không gây hại."
     }
    ]
   }
  ]
 },
 "replica-lag": {
  "context": "**Replication lag** là khoảng thời gian replica chậm hơn primary — ở đây ~2 giây. Hệ có một **Primary DB** nhận mọi lệnh ghi và một **Read Replica** nhận bản sao qua replication **bất đồng bộ** (primary commit xong là trả lời, rồi mới gửi WAL/binlog sang replica). App route đọc sang replica để giảm tải cho primary. Theo dõi dòng `name=` dưới hai DB và xem request đọc đi vào DB nào.",
  "variants": [
   {
    "v": 0,
    "name": "Luôn đọc replica",
    "steps": [
     {
      "i": 0,
      "key": "User đổi tên thành **Son**. App",
      "detail": "Lệnh ghi vào primary thành công nhanh: app gửi `UPDATE` đổi tên thành **Son** tới primary (mọi lệnh ghi phải vào primary), primary commit, trả `ok`, app trả `200`. Primary giờ `name=Son`. Ghi nhanh vì với replication bất đồng bộ, primary **không chờ** replica nhận thay đổi trước khi ack."
     },
     {
      "i": 1,
      "key": "Replication **bất đồng bộ**, đan",
      "detail": "Trong 2 giây này hai DB trả lời **khác nhau** cho cùng một câu hỏi: replica vẫn `name=Old`. Primary đã gửi bản ghi thay đổi (WAL trong PostgreSQL, binlog trong MySQL), nhưng replica trễ ~2s — do đường mạng, do đang áp một transaction lớn, hoặc do chịu quá nhiều query đọc."
     },
     {
      "i": 2,
      "key": "Reload ngay: đọc vào replica → u",
      "detail": "User reload trong vòng 2 giây và thấy tên cũ, ngay sau khi vừa được báo lưu thành công. App route `SELECT` sang replica như mọi lần đọc, replica trả `name=Old`. User tưởng thao tác lỗi, sửa lại hoặc báo bug — dù dữ liệu trên primary hoàn toàn đúng. Đây là vi phạm **read-your-own-writes**: lỗi trải nghiệm, không mất dữ liệu, nhưng khó debug vì chỉ xảy ra khi đọc ngay sau ghi, và lag tăng mạnh lúc hệ thống tải cao."
     }
    ]
   },
   {
    "v": 1,
    "name": "Read-your-own-writes",
    "steps": [
     {
      "i": 0,
      "key": "User đổi tên thành **Son**. App",
      "detail": "Giống variant trước: `UPDATE` vào primary, primary `name=Son`, app trả `200`."
     },
     {
      "i": 1,
      "key": "App ghi nhớ `last_write_at` của ",
      "detail": "Sau khi ghi, app lưu `last_write_at` của user (trong session, cookie, hoặc Redis theo user id). Fix này **không làm replication nhanh hơn** — replica vẫn trễ (`name=Old`) — nó chỉ đổi nơi đọc. Ngưỡng 5s lớn hơn lag thường gặp (2s) để có biên an toàn."
     },
     {
      "i": 2,
      "key": "Trong 5s sau khi ghi, app route",
      "detail": "User reload và thấy đúng `name=Son`: app thấy `now - last_write_at < 5s` nên route `SELECT` của **chính user này** sang primary. Cái giá: một phần đọc dồn về primary, tải primary tăng theo tỉ lệ người vừa ghi. Rủi ro còn lại: lag vượt 5s (replica quá tải) thì lỗi quay lại — cách chặt hơn là lưu LSN/GTID của lần ghi và chỉ đọc replica khi replica đã áp tới vị trí đó. Nếu `last_write_at` nằm trong cookie, user mở app trên thiết bị khác vẫn có thể thấy tên cũ."
     },
     {
      "i": 3,
      "key": "Người khác vẫn đọc replica — chấ",
      "detail": "Các user khác vẫn đọc replica, nên hệ giữ được lợi ích chính: phần lớn tải đọc nằm trên replica. Sau ~2s replica áp xong và hiện `name=Son ✓`; trong 2s trước đó họ có thể thấy tên cũ — đó là **eventual consistency**, chấp nhận được vì họ không biết vừa có thay đổi."
     }
    ]
   }
  ]
 },
 "isolation": {
  "context": "**Isolation level** quyết định một transaction thấy gì từ thay đổi của transaction khác: thay đổi chưa commit, thay đổi đã commit giữa chừng, hay chỉ một snapshot cố định. Hai transaction **T1** và **T2** chạy đồng thời trên cùng row `balance=100`; mỗi variant là một level và anomaly mà nó cho phép hoặc chặn. Theo dõi dòng dưới T1 (T1 đã đọc được gì) so với dòng dưới Database (giá trị thật đang có).",
  "variants": [
   {
    "v": 0,
    "name": "Read Uncommitted",
    "steps": [
     {
      "i": 0,
      "key": "T2 trừ hết tiền nhưng **chưa COM",
      "detail": "T2 chạy `UPDATE balance=0` nhưng chưa `COMMIT`, nên row trong DB mang giá trị 0 **tạm**. Giá trị này chỉ thành thật khi T2 commit, và có thể bị huỷ bất cứ lúc nào."
     },
     {
      "i": 1,
      "key": "T1 đọc được giá trị chưa commit.",
      "detail": "T1 đọc được số 0 chưa commit của T2 — **dirty read**. Ở Read Uncommitted, `SELECT balance` của T1 không bị chặn và không nhận bản đã commit cũ: DB trả thẳng giá trị đang nằm trên row. T1 có thể dựa vào số 0 này để từ chối giao dịch, gửi cảnh báo \"hết tiền\", hoặc ghi xuống bảng khác."
     },
     {
      "i": 2,
      "key": "T2 lỗi và **ROLLBACK**.",
      "detail": "T2 gặp lỗi (vi phạm constraint, deadlock, hoặc app chủ động huỷ) và `ROLLBACK`; DB dùng undo log khôi phục row về `balance=100`. Từ góc nhìn DB, số 0 **chưa bao giờ tồn tại**."
     },
     {
      "i": 3,
      "key": "T1 đã ra quyết định dựa trên số ",
      "detail": "T1 đã ra quyết định dựa trên một giá trị không bao giờ có thật: có thể đã từ chối thanh toán hợp lệ, hoặc tệ hơn đã ghi số 0 sang nơi khác. Không cơ chế nào báo cho T1 rằng dữ liệu nó đọc đã bị huỷ — lỗi **im lặng** và lan sang dữ liệu khác. Thực tế hiếm ai dùng Read Uncommitted; PostgreSQL thậm chí không hỗ trợ (đặt RU vẫn chạy như Read Committed), nên dirty read chỉ xảy ra trên DB như MySQL/SQL Server khi chủ động hạ level."
     }
    ]
   },
   {
    "v": 1,
    "name": "Read Committed",
    "steps": [
     {
      "i": 0,
      "key": "T1 đọc số dư lần 1.",
      "detail": "T1 mở transaction và `SELECT balance`, nhận 100. Ở Read Committed, **mỗi câu lệnh** lấy snapshot mới của dữ liệu đã commit tại thời điểm câu lệnh bắt đầu — không phải một snapshot cho cả transaction."
     },
     {
      "i": 1,
      "key": "T2 trừ 50 và COMMIT.",
      "detail": "T2 chạy `UPDATE balance = balance - 50` và `COMMIT`; DB giờ `balance=50`. T2 không bị T1 chặn vì T1 chỉ đọc, không giữ lock trên row."
     },
     {
      "i": 2,
      "key": "T1 đọc lại trong **cùng transact",
      "detail": "T1 đọc lại trong **cùng transaction** và nhận 50 — hai số khác nhau cho cùng một row: **non-repeatable read**. Câu lệnh mới lấy snapshot mới nên thấy bản đã commit của T2. Không có dirty read (50 là giá trị đã commit thật), nhưng logic kiểu \"đọc số dư, kiểm tra, rồi đọc lại để tính\" sẽ ra kết quả mâu thuẫn — ví dụ báo cáo cộng tổng sai vì các dòng được đọc ở các thời điểm khác nhau. Read Committed là mặc định của PostgreSQL, Oracle, SQL Server."
     }
    ]
   },
   {
    "v": 2,
    "name": "Repeatable Read",
    "steps": [
     {
      "i": 0,
      "key": "T1 đọc số dư lần 1 và giữ **snap",
      "detail": "T1 `SELECT balance` lần đầu, nhận 100, và DB tạo **một snapshot cho cả transaction** (trong PostgreSQL và MySQL InnoDB, snapshot chốt ở câu lệnh đọc đầu tiên). Mọi lần đọc sau của T1 đều nhìn qua snapshot này."
     },
     {
      "i": 1,
      "key": "T2 trừ 50 và COMMIT.",
      "detail": "T2 trừ 50 và commit mà không bị chặn, không phải chờ T1. Nhờ **MVCC**, DB không ghi đè row cũ mà tạo **phiên bản mới** `balance=50` đánh dấu bằng transaction id của T2; phiên bản 100 cũ vẫn giữ lại cho các transaction còn cần."
     },
     {
      "i": 2,
      "key": "T1 đọc lại từ snapshot → vẫn 100",
      "detail": "T1 đọc lại vẫn thấy 100 — nhất quán trong suốt transaction. DB chọn phiên bản row nhìn thấy được từ snapshot của T1, tức bản 100, vì T2 commit sau thời điểm snapshot. Lưu ý: 100 đã là dữ liệu cũ so với DB thật. Nếu T1 tiếp tục `UPDATE` row này dựa trên số 100, PostgreSQL báo lỗi serialization và buộc retry, còn MySQL ghi lên bản mới nhất (UPDATE đọc bản hiện tại) — tính sai ở tầng app vẫn có thể gây **lost update** nếu không dùng `SELECT … FOR UPDATE`. Repeatable Read là mặc định của MySQL InnoDB."
     }
    ]
   }
  ]
 },
 "n-plus-one": {
  "context": "Tổng số query một request sinh ra phải gần như cố định, không được tăng theo số dòng dữ liệu — theo dõi con số này dưới Database. Client gửi một GraphQL query lồng nhau; **GraphQL Server** chạy **resolver** cho từng field, và mỗi resolver tự đi lấy dữ liệu của mình. Resolver con (`venue`) được gọi **một lần cho mỗi phần tử** resolver cha (`events`) trả về, và mặc định không biết các lần gọi anh em của nó.",
  "variants": [
   {
    "v": 0,
    "name": "N+1",
    "steps": [
     {
      "i": 0,
      "key": "Client gửi query lồng nhau.",
      "detail": "Từ phía client đây chỉ là **1 round-trip**: một HTTP request duy nhất, body là query `events { venue { name } }` — lấy 100 event, mỗi event kèm tên venue. Nhìn từ ngoài không có gì đáng ngờ; chi phí thật nằm ở cách server biến query này thành lệnh gọi database."
     },
     {
      "i": 1,
      "key": "Resolver `events` chạy **1 query",
      "detail": "Resolver `events` chạy `SELECT * FROM events` và nhận 100 rows — mới tốn **1 query**, hoàn toàn hợp lý. Server duyệt cây query từ trên xuống. Mỗi row có cột `venue_id`, nhưng chưa ai lấy thông tin venue."
     },
     {
      "i": 2,
      "key": "Resolver `venue` chạy **riêng ch",
      "detail": "Tổng cộng **101 query** cho một request — 1 query cha + N query con, đúng tên gọi N+1. Server đi xuống field `venue` và gọi resolver `venue` **100 lần**, mỗi lần với một event (parent) khác; resolver viết ngây thơ `db.query('SELECT * FROM venues WHERE id = ?', parent.venueId)` nên bắn 100 query riêng: `id=1`, `id=2`, …, `id=100`. Mỗi query ~2ms round-trip thì chạy tuần tự chậm thêm vài trăm ms; chạy song song vẫn chiếm 100 connection trong pool và nhân tải database lên 100 lần. Lỗi này **im lặng**: kết quả đúng, test với 3 event vẫn nhanh, chỉ lộ ra khi dữ liệu thật lớn lên hoặc traffic tăng."
     }
    ]
   },
   {
    "v": 1,
    "name": "DataLoader",
    "steps": [
     {
      "i": 0,
      "key": "Client gửi query lồng nhau.",
      "detail": "Cùng query `events { venue { name } }`; khác biệt duy nhất nằm ở server: mỗi request có một instance **DataLoader** riêng cho venue, tạo trong context của request đó."
     },
     {
      "i": 1,
      "key": "Resolver `events` chạy **1 query",
      "detail": "Resolver `events` vẫn chạy 1 query `SELECT * FROM events` và nhận 100 rows. Phần này không đổi — DataLoader chỉ xử lý tầng con."
     },
     {
      "i": 2,
      "key": "DataLoader **gom** 100 lời gọi `",
      "detail": "Resolver `venue` vẫn được gọi 100 lần, nhưng DataLoader **gom** các lời gọi thay vì query ngay. Mỗi resolver gọi `venueLoader.load(parent.venueId)` và nhận một Promise chưa resolve; DataLoader đưa key vào hàng đợi và chờ hết tick hiện tại của event loop (`process.nextTick`). Khi 100 resolver gọi xong, hàng đợi chứa `[1..100]`. DataLoader còn **cache theo request**: 2 event cùng venue 5 thì `load(5)` chỉ được gom một lần, nên trên dữ liệu thật batch thường nhỏ hơn 100."
     },
     {
      "i": 3,
      "key": "Chỉ còn 1 query `IN (...)`.",
      "detail": "Tổng cộng **2 query** dù có 100 hay 10.000 event — số query giờ bằng độ sâu của query, không theo số dòng. Hết tick, DataLoader gọi **batch function** một lần với toàn bộ key: `SELECT * FROM venues WHERE id IN (1..100)`. Batch function phải trả mảng kết quả **đúng thứ tự và đúng số lượng** như mảng key, để DataLoader resolve từng Promise cho đúng event. Cái giá: thêm một tầng code, cache chỉ sống trong một request (không dùng chung giữa user), và danh sách `IN` quá dài cần chia batch (`maxBatchSize`)."
     }
    ]
   }
  ]
 },
 "lb": {
  "context": "LB thấy được gì trong request thì mới route theo cái đó được: **Layer 7** (ALB) hiểu HTTP nên route theo nội dung request; **Layer 4** (NLB) chỉ thấy gói TCP/UDP với IP và port. Client gửi `GET /images/cat.png` qua HTTPS; sau Load Balancer có hai service, mỗi service chỉ phục vụ một nhóm path (`/api/*` và `/images/*`). Theo dõi dòng chữ dưới Load Balancer: nó cho biết LB đang nhìn thấy gì trong request.",
  "variants": [
   {
    "v": 0,
    "name": "ALB (Layer 7)",
    "steps": [
     {
      "i": 0,
      "key": "Request tới ALB.",
      "detail": "Kết nối của client **kết thúc tại ALB**: ALB là proxy, sau đó nó mở kết nối riêng tới backend. Client mở kết nối TCP tới ALB trên port 443, bắt tay TLS, rồi gửi request HTTP `GET /images/cat.png`."
     },
     {
      "i": 1,
      "key": "ALB **giải mã TLS và đọc HTTP**:",
      "detail": "ALB **giải mã TLS** (TLS termination) nhờ giữ certificate của domain, rồi parse HTTP request thành method, path, header, cookie. Nó so path `/images/cat.png` với listener rules (`/api/*` → API target group, `/images/*` → Image target group) và khớp rule thứ hai. Chi phí: mỗi request tốn CPU cho giải mã và parse, thêm vài ms latency so với L4."
     },
     {
      "i": 2,
      "key": "Định tuyến đúng service theo pat",
      "detail": "ALB gửi request tới một instance trong target group Image service, nhận `200` và trả ảnh về client; API service hoàn toàn không thấy request này. Vì đọc được nội dung, L7 còn làm được nhiều thứ khác: route theo header (canary, A/B), sticky session theo cookie, gắn `X-Forwarded-For`, chặn bằng WAF — rất hợp kiến trúc microservice nhiều service sau một domain."
     }
    ]
   },
   {
    "v": 1,
    "name": "NLB (Layer 4)",
    "steps": [
     {
      "i": 0,
      "key": "Cùng request nhưng đi qua NLB.",
      "detail": "Cùng request, nhưng LB giờ là NLB, và thứ NLB nhận đầu tiên là gói **TCP SYN tới port 443**. Phần HTTP nằm sau đó, bên trong luồng byte đã mã hoá TLS."
     },
     {
      "i": 1,
      "key": "NLB chỉ thấy **IP + port**, payl",
      "detail": "NLB **không thể biết** request muốn gì, vì path `/images/cat.png` nằm trong payload đã mã hoá. NLB làm việc ở tầng transport: chỉ đọc header IP/TCP (source IP, dest IP, port) và chuyển tiếp luồng byte nguyên vẹn, không giải mã. Đổi lại, NLB cực nhanh, giữ được hàng triệu kết nối, latency rất thấp, có IP tĩnh và giữ nguyên IP client."
     },
     {
      "i": 2,
      "key": "Chọn backend theo hash/round-rob",
      "detail": "Kết nối rơi vào API service và nhận **404**: NLB chọn backend bằng flow hash (hash 5-tuple IP/port/protocol) — dựa trên kết nối, không dựa trên nội dung. API giải mã, đọc path `/images/cat.png`, không route nào khớp nên trả 404. Thực tế không ai đặt hai service khác nhau chung một target group sau NLB: cấu hình đúng là mỗi service một NLB/port riêng, hoặc NLB đứng trước một tầng L7 (Nginx, Envoy, ALB) để tầng đó route theo path. Bài học: L4 không route theo nội dung, nên chọn nó cho TCP/UDP thô, gRPC/game/IoT cần throughput cao, hoặc làm lớp ngoài cùng."
     }
    ]
   }
  ]
 },
 "inverted-index": {
  "context": "**Inverted index** là map từ term → danh sách document chứa term đó (posting list), ngược với cách lưu thông thường document → nội dung. Hai document đi qua pipeline phân tích văn bản (analyzer): **Tokenizer** tách câu thành token, **Stemmer** đưa các biến thể của từ về cùng một gốc. Theo dõi dòng chữ dưới Inverted Index: các posting list được xây dần, và ở bước cuối một lần tra là ra kết quả.",
  "variants": [
   {
    "v": 0,
    "name": null,
    "steps": [
     {
      "i": 0,
      "key": "**Tokenize**: tách câu thành từ,",
      "detail": "Tokenizer biến hai chuỗi `Running fast` và `He runs daily` thành 5 token: `running · fast · he · runs · daily`. Nó tách theo khoảng trắng và dấu câu, rồi chuyển hết về chữ thường. Chuyển chữ thường để `Running` và `running` được coi là một từ; bỏ bước này thì user gõ chữ thường sẽ không tìm thấy từ viết hoa đầu câu."
     },
     {
      "i": 1,
      "key": "**Stem**: đưa về gốc — running, ",
      "detail": "`running` và `runs` giờ là **cùng một term** `run`; còn lại `run · fast · run · daily`. Trước đó `he` bị bỏ vì là **stop word** (quá phổ biến, không giúp phân biệt document) — trong Elasticsearch/Lucene bước này do stop filter riêng đảm nhận, sim gộp vào Stemmer cho gọn. Stemmer cắt hậu tố theo luật: `running` → `run`, `runs` → `run`. Lưu ý stemmer thật như Porter có thể ra gốc không phải từ thật (`daily` → `daili`); không sao vì query cũng đi qua đúng stemmer đó."
     },
     {
      "i": 2,
      "key": "Ghi vào index: từ → danh sách do",
      "detail": "Mỗi term được ghi vào posting list kèm ID document chứa nó: `run → [doc1, doc2]`, `fast → [doc1]`, `daily → [doc2]`. Posting list giữ **đã sắp xếp theo doc ID**, nên phép AND giữa nhiều term chỉ là trộn hai danh sách đã sort. Index thật còn lưu tần suất và vị trí của term trong document để chấm điểm (BM25) và hỗ trợ tìm theo cụm từ."
     },
     {
      "i": 3,
      "key": "Search `running` → stem thành `r",
      "detail": "Tìm `running` trả ngay `[doc1, doc2]`, kể cả doc2 vốn chỉ chứa `runs`. Query phải đi qua **đúng analyzer** đã dùng lúc index — lowercase rồi stem thành `run` — nếu không `running` sẽ không khớp term nào. Index tra `run` một lần (như tra hash map/term dictionary). Chi phí tìm kiếm phụ thuộc độ dài posting list, không phụ thuộc tổng số document; so với `LIKE '%running%'` phải quét từng dòng, đây là khác biệt giữa vài ms và vài phút trên hàng tỷ document."
     }
    ]
   }
  ]
 },
 "presigned": {
  "context": "Byte của file đi **thẳng từ Client lên S3**; **API** chỉ xử lý metadata và cấp quyền. User upload video 2GB. **Presigned URL** là URL API đã ký bằng credential của nó, cho phép đúng một thao tác (ví dụ upload part 2 của object `video9.mp4`) trong thời hạn ngắn mà client không cần AWS key. Theo dõi trạng thái dưới S3 (số part đã nhận) và dưới Metadata DB (PENDING → READY).",
  "variants": [
   {
    "v": 0,
    "name": null,
    "steps": [
     {
      "i": 0,
      "key": "Client chỉ gửi **metadata**, khô",
      "detail": "API chỉ nhận vài trăm byte JSON: client gọi `POST /uploads` với metadata — tên file, kích thước 2GB, content-type. Nếu file 2GB đi qua API, mỗi upload chiếm một connection và băng thông của API server hàng phút, nhanh chóng làm cạn worker và RAM."
     },
     {
      "i": 1,
      "key": "API ký **presigned URL** (multip",
      "detail": "API gọi `CreateMultipartUpload` lấy `uploadId`, rồi ký **3 presigned URL** — mỗi URL cho phép `UploadPart` đúng một part, hết hạn sau 15 phút. API ghi bản ghi `video#9 PENDING` vào DB trước khi trả URL, để hệ thống biết có upload đang dở (dùng cho dọn dẹp sau này). Credential không bao giờ rời API; URL bị lộ thì kẻ khác chỉ upload được đúng part đó trong 15 phút. Thực tế part thường 50–100MB nên file 2GB có vài chục URL, sim rút gọn còn 3."
     },
     {
      "i": 2,
      "key": "Client upload **song song** từng",
      "detail": "Client `PUT` 3 part **song song** thẳng lên S3 bằng 3 presigned URL, mỗi part khoảng 680MB — tận dụng hết băng thông client, nhanh hơn nhiều so với một stream đơn. Mỗi part thành công trả về một `ETag`, client giữ lại để ghép file ở bước cuối. Trạng thái `2/3 parts`: part 1 và 3 đã xong, part 2 còn dở."
     },
     {
      "i": 3,
      "key": "Một chunk lỗi thì chỉ upload lại",
      "detail": "Part 2 bị **timeout** (mạng chập chờn, Wi-Fi rớt), và nhờ multipart client chỉ gửi lại **riêng part 2** — part 1 và 3 đã nằm an toàn trên S3. Upload một khối 2GB thì rớt mạng ở 1.9GB nghĩa là làm lại từ đầu. Điều kiện: retry phải xong trước khi presigned URL hết hạn 15 phút; hết hạn thì client xin API ký URL mới cho part đó."
     },
     {
      "i": 4,
      "key": "S3 phát event khi hoàn tất → API",
      "detail": "API chuyển `status=READY` khi nhận event từ S3, không tin lời client. Client gọi `CompleteMultipartUpload` với danh sách số part + `ETag`; S3 ghép các part thành object `video9.mp4` rồi phát event `ObjectCreated` (qua SNS/SQS/EventBridge) tới API. Dùng event từ S3 thay vì tin client báo “xong rồi” vì client có thể tắt app giữa chừng hoặc nói dối. Event giao **at-least-once** nên handler phải idempotent; upload bỏ dở cần lifecycle rule `AbortIncompleteMultipartUpload` để dọn part rác, nếu không S3 vẫn tính tiền lưu trữ chúng."
     }
    ]
   }
  ]
 },
 "queue": {
  "context": "**Producer** đẩy order vào **Queue**, **Consumer** kéo về xử lý rồi ACK (xong, xoá message) hoặc NACK (thất bại, trả lại để thử lại). **DLQ** (Dead Letter Queue) là queue phụ chứa message đã thất bại quá số lần cho phép. Theo dõi `depth` dưới Queue (số message đang chờ) và số message trong DLQ. Variant 1 nói về message lỗi; variant 2 nói về traffic vượt sức consumer.",
  "variants": [
   {
    "v": 0,
    "name": "Retry → DLQ",
    "steps": [
     {
      "i": 0,
      "key": "Producer đẩy `order#7` vào queue",
      "detail": "User nhận `202 Accepted` ngay, không chờ xử lý xong: producer (ví dụ Order API) ghi `order#7` vào queue, queue ghi bền message rồi xác nhận, depth lên 1. Từ đây user và consumer **tách rời**: consumer chậm hay sập thì user vẫn đặt hàng được."
     },
     {
      "i": 1,
      "key": "Consumer xử lý và gặp lỗi (dữ li",
      "detail": "Consumer nhận `order#7` nhưng xử lý lỗi do dữ liệu hỏng (ví dụ thiếu field bắt buộc, parse lỗi), nên trả NACK (hoặc không xoá message để hết visibility timeout). Message **không bị mất**: queue giữ lại và sẽ giao lại sau."
     },
     {
      "i": 2,
      "key": "Retry với **exponential backoff*",
      "detail": "Queue giao lại với **exponential backoff** — chờ 1s, 2s, 4s giữa các lần — nhưng `order#7` hỏng dữ liệu nên lần nào cũng NACK, retry bao nhiêu cũng vô ích. Backoff hợp với lỗi tạm thời (DB timeout, service bên ngoài 503) vì cho hệ thống phía sau thời gian hồi phục thay vì bị dội retry liên tục. Retry vô hạn thì đây là **poison message**: quay vòng mãi, tốn tài nguyên, và với queue FIFO còn chặn mọi message phía sau."
     },
     {
      "i": 3,
      "key": "Quá `maxReceiveCount=3` → chuyển",
      "detail": "Số lần nhận vượt `maxReceiveCount=3` nên queue chuyển `order#7` sang DLQ và xoá khỏi queue chính; depth về 0. Message không bị vứt đi: nó nằm trong DLQ chờ người điều tra, sửa dữ liệu rồi **redrive** về queue chính. Cần alert khi DLQ > 0, nếu không DLQ thành nơi đơn hàng âm thầm biến mất mà không ai biết. (Sim vẽ 1 lần nhận + 3 retry = 4 lần nhận; với SQS `maxReceiveCount=3` message đã sang DLQ ngay sau lần nhận thứ 3.)"
     },
     {
      "i": 4,
      "key": "Message tiếp theo xử lý bình thư",
      "detail": "`order#8` vào queue, consumer xử lý thành công và ACK — `order#7` đã bị cô lập nên không làm kẹt luồng chính. Giao hàng là **at-least-once**: consumer xử lý xong nhưng chết trước khi ACK thì message được giao lại, nên consumer phải **idempotent** (ví dụ lưu `orderId` đã xử lý, hoặc UPSERT) để không trừ tiền hay gửi hàng hai lần."
     }
    ]
   },
   {
    "v": 1,
    "name": "Backpressure",
    "steps": [
     {
      "i": 0,
      "key": "Flash sale: producer bắn 50k msg",
      "detail": "Mỗi giây queue tăng thêm **45k message**, sau 10 giây depth đã là 450k: flash sale đẩy 50k msg/s trong khi consumer chỉ xử lý 5k msg/s. Không có queue thì 45k request/giây vượt sức sẽ timeout hoặc làm sập service phía sau."
     },
     {
      "i": 1,
      "key": "Queue làm **buffer**: user không",
      "detail": "Queue đóng vai **buffer**: producer vẫn ghi thành công nên user nhận phản hồi ngay, consumer vẫn kéo đều 5k/s, không quá tải. Cái giá là **độ trễ**: message cuối trong 450k phải chờ khoảng 450k / 5k = 90 giây mới được xử lý. Ổn với việc chấp nhận xử lý trễ (gửi email, cập nhật kho); không ổn với thứ cần trả lời đồng bộ."
     },
     {
      "i": 2,
      "key": "Theo dõi queue depth → **autosca",
      "detail": "Autoscaler tăng consumer lên 10 instance, tổng 50k msg/s, dựa trên **queue depth** hoặc **tuổi của message cũ nhất** (metric chính xác hơn CPU cho consumer). Lưu ý 50k/s chỉ **bằng** tốc độ producer, nên backlog 450k ngừng tăng chứ chưa giảm; nó chỉ giảm khi burst dịu đi hoặc scale thêm. Autoscale cũng không tức thời (khởi động instance mất vài chục giây tới vài phút), và DB phía sau consumer phải chịu được tải gấp 10."
     },
     {
      "i": 3,
      "key": "Nếu vẫn vượt ngưỡng: giới hạn qu",
      "detail": "Backlog vẫn vượt ngưỡng thì hệ thống giới hạn kích thước queue và trả **429 Too Many Requests** để producer chậm lại (retry với backoff) — đó là **backpressure**: đẩy tín hiệu quá tải ngược về nguồn thay vì để queue phình vô hạn. Thực tế 429 thường do API/gateway phía trước producer trả, dựa trên depth của queue, vì SQS/Kafka không tự từ chối theo depth. Cái giá: một phần user bị từ chối hoặc phải thử lại, nhưng hệ thống giữ depth quanh 20k và không sập."
     }
    ]
   }
  ]
 },
 "redlock": {
  "context": "Server A và B cùng ghi vào một Storage và dùng Redis làm distributed lock để mỗi lúc chỉ một server ghi. Lock có **TTL** để tự hết hạn khi server giữ lock chết, tránh khoá vĩnh viễn. **Fencing token** là số tăng dần cấp kèm mỗi lần lấy lock, để Storage tự phân biệt ai giữ lock mới nhất. Theo dõi trạng thái dưới Storage: giá trị `x` và `max token` nó đã thấy.",
  "variants": [
   {
    "v": 0,
    "name": "Chỉ dùng lock có TTL",
    "steps": [
     {
      "i": 0,
      "key": "A lấy lock với TTL 10s.",
      "detail": "A giữ lock và bắt đầu critical section (đọc–sửa–ghi Storage) sau khi `SET lock A NX PX 10000` trả OK — chỉ set nếu key chưa tồn tại (`NX`), tự hết hạn sau 10.000ms. Lưu ý sim gọi là “Redlock” nhưng thực chất đây là lock trên **một** Redis instance; Redlock thật lấy lock trên đa số trong 5 node độc lập — và vẫn mắc đúng lỗi ở các bước sau."
     },
     {
      "i": 1,
      "key": "A bị **GC pause 11s** ngay trong",
      "detail": "A đứng hình 11 giây ngay trong critical section: JVM dừng mọi thread cho một **stop-the-world GC pause** (cũng có thể là swap, VM bị tạm dừng, hay mạng nghẽn). Trong lúc pause, A không chạy được dòng code nào, kể cả code kiểm tra hay gia hạn lock. Đồng hồ của Redis vẫn chạy: lock chỉ còn sống 10s."
     },
     {
      "i": 2,
      "key": "Lock hết TTL. B lấy lock hợp lệ ",
      "detail": "Ở giây thứ 10 key `lock` hết TTL và bị xoá; B gọi `SET lock NX` và thành công — hoàn toàn hợp lệ theo góc nhìn của Redis. B ghi `x=2` vào Storage. Tới đây hệ thống vẫn đúng: chỉ một người giữ lock."
     },
     {
      "i": 3,
      "key": "A tỉnh dậy, **không biết** đã mấ",
      "detail": "A ghi `x=1` đè lên `x=2` của B ở giây thứ 11 — hai server cùng tin mình giữ lock. A chạy tiếp từ đúng dòng nó dừng, **không biết** lock đã hết hạn. Kiểm tra lock trước khi ghi cũng không cứu được, vì pause có thể xảy ra ngay giữa lệnh kiểm tra và lệnh ghi. Dữ liệu của B bị ghi đè **im lặng** — không lỗi, không log, Storage chấp nhận mọi lệnh ghi. Lock có TTL chỉ an toàn nếu giả định không process nào dừng lâu hơn TTL, và giả định đó không đúng trong thực tế."
     }
    ]
   },
   {
    "v": 1,
    "name": "Có fencing token",
    "steps": [
     {
      "i": 0,
      "key": "A lấy lock và nhận **token 33**.",
      "detail": "A lấy lock và nhận kèm **token 33** — số tăng đơn điệu, mỗi lần cấp lock tăng 1. Redis không tự có token này: phải cài thêm, ví dụ `INCR lock_token` trong cùng script Lua lấy lock, hoặc dùng service có sẵn như ZooKeeper (`zxid`) hay etcd (revision)."
     },
     {
      "i": 1,
      "key": "A bị **GC pause 11s**.",
      "detail": "A lại bị GC pause 11s, dài hơn TTL 10s. Như variant trước, A hoàn toàn không biết thời gian đã trôi qua."
     },
     {
      "i": 2,
      "key": "Lock hết TTL. B lấy lock, nhận *",
      "detail": "Storage giờ **nhớ** token lớn nhất từng thấy — đó là điểm mấu chốt. Lock hết hạn, B lấy lock và nhận **token 34**, rồi ghi `x=2` kèm token 34; Storage thấy 34 > max token đang có (0), chấp nhận lệnh ghi và lưu `max token=34`."
     },
     {
      "i": 3,
      "key": "A ghi với token 33. Storage thấy",
      "detail": "Storage **từ chối** lệnh ghi `x=1` của A vì token 33 < 34; `x=2` của B được giữ nguyên. Lời giải không cần A biết mình đã mất lock — chính Storage tự bảo vệ. Điều kiện: Storage phải kiểm tra token và ghi **nguyên tử** (ví dụ `UPDATE … SET x=1, token=33 WHERE token < 33`); Storage không hỗ trợ điều kiện kiểu này thì fencing không áp dụng được."
     }
    ]
   }
  ]
 },
 "seat": {
  "context": "Nếu cả Alice và Bob đọc “ghế trống” rồi cùng ghi, ghế A1 sẽ bị **bán hai lần** (lost update). Hai người đặt cùng một mili-giây; hai request chạy song song trên Booking API và cùng chạm một dòng trong DB. Hai cách chặn: **optimistic lock** (không khoá, kiểm tra cột `version` lúc ghi) và **pessimistic lock** (khoá dòng ngay khi đọc bằng `SELECT … FOR UPDATE`). Theo dõi trạng thái dòng A1 dưới DB: người giữ ghế, `v` và biểu tượng khoá.",
  "variants": [
   {
    "v": 0,
    "name": "Optimistic lock",
    "steps": [
     {
      "i": 0,
      "key": "Hai request tới cùng lúc.",
      "detail": "Hai request `book A1` tới Booking API gần như cùng lúc, xử lý trên hai thread/transaction khác nhau. Không có thứ tự nào được đảm bảo giữa chúng."
     },
     {
      "i": 1,
      "key": "Cả hai đọc thấy ghế trống, `v=1`",
      "detail": "Cả hai đều tin mình đặt được ghế: hai transaction chạy `SELECT status, version FROM seats WHERE id='A1'` và cùng nhận `free · v=1`. Đọc thông thường không lấy lock nên không ai phải chờ. Nếu bước sau chỉ là `UPDATE … SET owner=?` thì người ghi sau âm thầm đè người ghi trước, và cả hai cùng nhận vé."
     },
     {
      "i": 2,
      "key": "Alice ghi trước: `UPDATE … SET v",
      "detail": "Alice thắng: `UPDATE seats SET owner='Alice', v=2 WHERE id='A1' AND v=1` khớp điều kiện `v=1`, nên DB cập nhật **1 row** và tăng version lên 2. Bản thân UPDATE vẫn khoá dòng trong chốc lát, nên hai UPDATE đồng thời luôn chạy tuần tự."
     },
     {
      "i": 3,
      "key": "Bob ghi `WHERE v=1` → **0 row** ",
      "detail": "Bob cập nhật **0 row**: cùng câu lệnh `WHERE v=1`, nhưng version giờ là 2 nên điều kiện sai. Không có lỗi SQL nào; API phải **kiểm tra số row bị ảnh hưởng** để biết mình thua. Quên kiểm tra là lỗi kinh điển: code coi như đặt thành công và Bob nhận vé ảo."
     },
     {
      "i": 4,
      "key": "Bob nhận 409, client báo “ghế đã",
      "detail": "API trả `200 Booked` cho Alice và `409 Conflict` cho Bob; client hiện “ghế đã có người đặt” để Bob chọn ghế khác. Optimistic lock không giữ lock trong lúc chờ nên throughput cao, hợp khi xung đột hiếm. Khi tranh chấp cao (ví dụ 10k người cùng giành ghế hot), phần lớn request thất bại và retry, tốn công vô ích."
     }
    ]
   },
   {
    "v": 1,
    "name": "Pessimistic lock",
    "steps": [
     {
      "i": 0,
      "key": "Hai request tới cùng lúc.",
      "detail": "Cùng hai request `book A1` tới song song như variant trước."
     },
     {
      "i": 1,
      "key": "Alice tới trước: `SELECT … FOR U",
      "detail": "Alice khoá dòng A1 ngay khi đọc: `SELECT … WHERE id='A1' FOR UPDATE` đặt **row lock độc quyền** lên A1 tới khi transaction kết thúc. Alice thấy ghế trống và biết chắc không ai đổi được nó trong lúc mình xử lý."
     },
     {
      "i": 2,
      "key": "Bob cũng `FOR UPDATE` → bị **blo",
      "detail": "Bob bị DB **block**: cùng câu `FOR UPDATE`, transaction của Bob đứng chờ lock của Alice, giữ nguyên connection DB và thread của API. Nếu Alice giữ lock lâu (ví dụ gọi payment gateway bên trong transaction), Bob và mọi người phía sau xếp hàng tới khi hết `lock_wait_timeout`."
     },
     {
      "i": 3,
      "key": "Alice UPDATE và COMMIT → nhả loc",
      "detail": "Alice `UPDATE seats SET owner='Alice'` rồi `COMMIT`; commit nhả lock, API trả `200 Booked` cho Alice. Dòng A1 giờ thuộc Alice."
     },
     {
      "i": 4,
      "key": "Bob chạy tiếp, thấy ghế đã bán.",
      "detail": "Bob nhận `409 Conflict`: lock được nhả nên `FOR UPDATE` của Bob chạy tiếp, đọc **phiên bản mới nhất đã commit** (locking read không dùng snapshot cũ) và thấy ghế đã thuộc Alice. Kết quả luôn đúng, nhưng các request tranh cùng dòng phải chạy **tuần tự**, nên khi tranh chấp cao sẽ nghẽn connection pool; ngoài ra khoá nhiều dòng theo thứ tự khác nhau có thể gây deadlock."
     }
    ]
   }
  ]
 },
 "saga": {
  "context": "**Saga** chia nghiệp vụ thành chuỗi **local transaction**, mỗi bước có một **compensating action** (hành động bù) để huỷ tác dụng nếu bước sau thất bại. Cần vậy vì đơn hàng chạm 3 service, mỗi service có **database riêng** — không transaction chung nào bao trọn cả 3 (không có `ROLLBACK` xuyên service). Variant 1 dùng **orchestrator** ra lệnh từng bước; variant 2 dùng **choreography**: các service tự nghe event trên Kafka. Theo dõi dòng chữ dưới Order Svc và Payment Svc: trạng thái trung gian (PENDING, charged) rồi trạng thái sau khi bù (CANCELLED, refunded).",
  "variants": [
   {
    "v": 0,
    "name": "Orchestration",
    "steps": [
     {
      "i": 0,
      "key": "Orchestrator tạo order **PENDING",
      "detail": "Order Svc tạo `order#1` ở trạng thái **PENDING** theo lệnh của orchestrator, commit transaction cục bộ trong DB của nó. PENDING là \"chưa chốt\": UI không được báo đặt hàng thành công, các luồng khác (giao hàng, gửi email) phải bỏ qua đơn này. Orchestrator ghi saga đang ở bước 1 vào **saga log** của nó, để nếu chính orchestrator restart thì biết làm tiếp từ đâu."
     },
     {
      "i": 1,
      "key": "Bước 2: trừ tiền.",
      "detail": "Payment Svc trừ $50 và commit trong DB của nó — tiền đã thật sự bị trừ, không còn \"tạm\". Lời gọi nên kèm **idempotency key** (ví dụ `saga#1-step2`): orchestrator timeout và gọi lại thì Payment Svc nhận ra và không trừ lần hai. Lúc này hệ thống lệch tạm thời: tiền đã trừ nhưng chưa chắc có hàng."
     },
     {
      "i": 2,
      "key": "Bước 3: giữ hàng — **hết hàng**.",
      "detail": "Inventory trả `OUT_OF_STOCK` vì `stock=0` — lỗi nghiệp vụ, không phải lỗi mạng, nên retry vô ích. Vấn đề: bước 1 và 2 **đã commit** trong 2 database khác nhau, không rollback được như một transaction. Dừng ở đây thì user bị trừ $50 cho đơn không bao giờ giao — lệch dữ liệu thật, không cơ chế nào tự sửa."
     },
     {
      "i": 3,
      "key": "Không có rollback phân tán → chạ",
      "detail": "Orchestrator chạy compensation **theo thứ tự ngược** các bước đã thành công: bước 2 trước (hoàn tiền), rồi bước 1. Refund là một transaction mới, không xoá giao dịch charge: sổ sách còn cả `charged $50` lẫn `refunded $50`, có dấu vết kiểm toán. Compensation **bắt buộc phải thành công cuối cùng**: orchestrator retry tới khi được, nên Payment Svc cũng phải xử lý refund idempotent để retry không hoàn tiền hai lần."
     },
     {
      "i": 4,
      "key": "Huỷ order. Hệ thống về trạng thá",
      "detail": "Ba service giờ nhất quán: đơn huỷ, tiền đã hoàn, kho không đổi. Orchestrator gọi Order Svc chuyển `order#1` sang **CANCELLED** và đánh dấu saga kết thúc trong saga log. Lưu ý đây là **eventual consistency**: trong vài trăm ms giữa bước 2 và bước 4, user có thể thấy tiền bị trừ — Saga không có isolation như ACID, nên UI cần hiển thị trạng thái \"đang xử lý\". Ưu điểm của orchestration: toàn bộ luồng nằm một chỗ, dễ đọc, dễ biết saga đang kẹt ở bước nào."
     }
    ]
   },
   {
    "v": 1,
    "name": "Choreography",
    "steps": [
     {
      "i": 0,
      "key": "Order Svc tạo order và phát even",
      "detail": "Order Svc tạo `order#1` **PENDING** trong DB của nó và phát event `OrderCreated` lên Event Bus (Kafka) — không còn orchestrator. Để tránh ghi DB xong mà publish event thất bại (hoặc ngược lại), thực tế dùng **transactional outbox**: ghi order và event vào cùng một transaction DB, một tiến trình khác đẩy event lên Kafka. Order Svc không biết ai sẽ phản ứng với event này."
     },
     {
      "i": 1,
      "key": "Payment nghe event, tự trừ tiền,",
      "detail": "Payment Svc tự trừ $50 khi nhận `OrderCreated` từ topic nó subscribe, rồi phát `PaymentDone`. Không ai ra lệnh cho Payment — nó tự biết \"có order mới thì thu tiền\". Kafka giao **at-least-once** nên Payment có thể nhận cùng event hai lần, phải dedupe theo order id để không trừ tiền hai lần."
     },
     {
      "i": 2,
      "key": "Inventory nghe event — hết hàng.",
      "detail": "Inventory Svc nghe `PaymentDone`, thử giữ hàng nhưng `stock=0`, nên phát `StockFailed`. Như variant orchestration, order và payment đã commit — nhưng ở đây **không ai nắm toàn cảnh** để biết cần huỷ những gì; trách nhiệm bù trừ nằm rải rác trong từng service."
     },
     {
      "i": 3,
      "key": "Payment và Order **tự** nghe `St",
      "detail": "Hệ thống về trạng thái nhất quán mà không cần điểm điều phối trung tâm: Payment Svc và Order Svc mỗi bên tự subscribe `StockFailed` và chạy song song — Payment hoàn $50, Order chuyển `order#1` sang **CANCELLED**. Thêm service mới chỉ cần subscribe event. Cái giá: muốn biết \"đơn #1 đang ở bước nào\" phải ghép log từ nhiều service (cần distributed tracing, correlation id), và dễ tạo vòng event khó debug khi số bước tăng. Thiết kế chặt hơn thường cho Order Svc huỷ đơn khi nghe `PaymentRefunded` thay vì `StockFailed`, để đơn chỉ CANCELLED sau khi tiền đã thật sự hoàn."
     }
    ]
   }
  ]
 },
 "realtime": {
  "context": "HTTP gốc là **request–response**: server không tự gửi gì nếu client không hỏi, trong khi browser cần biết tỉ số mới ngay khi có bàn thắng. Ba variant là ba cách vượt giới hạn này: **short polling** (hỏi định kỳ), **SSE** (Server-Sent Events: giữ một response HTTP mở để server đẩy dữ liệu), **WebSocket** (nâng cấp kết nối thành kênh hai chiều). Theo dõi mũi tên: ai khởi tạo, bao nhiêu request rỗng, và dòng chữ dưới node cho biết kết nối có được giữ mở hay không.",
  "variants": [
   {
    "v": 0,
    "name": "Short polling",
    "steps": [
     {
      "i": 0,
      "key": "Cứ 2s hỏi một lần.",
      "detail": "Browser hỏi `GET /score` mỗi 2 giây (`setInterval`) và nhận `204 No Content` vì chưa có bàn thắng mới. Request rỗng này vẫn tốn đủ chi phí: header HTTP (cookie, user-agent… thường 500 byte–vài KB), qua load balancer, auth, có khi cả một query DB — chỉ để nhận câu trả lời \"không có gì\"."
     },
     {
      "i": 1,
      "key": "Lại hỏi — vẫn rỗng. Mỗi lần là m",
      "detail": "2 giây sau lại hỏi, vẫn rỗng — nhân lên: 100,000 người xem × 1 request/2s = **50,000 request/giây**, gần như toàn bộ là request rỗng. Server tốn CPU và băng thông cho thứ không mang thông tin, và chi phí tăng tuyến tính theo số người xem, bất kể trận đấu có bàn thắng hay không."
     },
     {
      "i": 2,
      "key": "Có bàn thắng, nhưng client chỉ b",
      "detail": "Browser chỉ biết bàn thắng ở lần hỏi kế tiếp (`200 1-0`), dù nó xảy ra ngay sau lần hỏi trước. Độ trễ tệ nhất bằng **một chu kỳ poll** (2 giây), trung bình nửa chu kỳ. Giảm chu kỳ xuống 0.5s cho nhanh thì số request gấp 4 lần — trade-off cố hữu giữa độ tươi và tải. Polling vẫn hợp khi dữ liệu đổi chậm hoặc ít client, vì đơn giản và đi qua mọi proxy, cache."
     }
    ]
   },
   {
    "v": 1,
    "name": "SSE",
    "steps": [
     {
      "i": 0,
      "key": "Client mở một HTTP request; serv",
      "detail": "Server trả header `Content-Type: text/event-stream` nhưng **không đóng response**: browser dùng `EventSource` gửi `GET /stream` với `Accept: text/event-stream`, và kết nối TCP được giữ mở — mỗi client chiếm một kết nối thường trực trên server. Vì vẫn là HTTP thường, SSE đi qua proxy, load balancer và hưởng auth bằng cookie như mọi request khác."
     },
     {
      "i": 1,
      "key": "Server đẩy event bất cứ lúc nào.",
      "detail": "Browser nhận event gần như tức thì, không request rỗng nào: có bàn thắng là server ghi ngay vào response đang mở các dòng `data: 1-0` rồi `data: 2-0`, mỗi event kết thúc bằng một dòng trống. Kết nối đứt thì `EventSource` **tự reconnect** và gửi header `Last-Event-ID` để server phát lại event bị lỡ (nếu server có lưu). Proxy phải tắt buffering, và cần gửi comment heartbeat định kỳ để kết nối không bị timeout đóng."
     },
     {
      "i": 2,
      "key": "Client muốn gửi lên phải dùng **",
      "detail": "Muốn bình chọn, browser phải mở một `POST /vote` riêng, vì SSE **chỉ một chiều** server → client. Với live score điều này không thành vấn đề vì client hiếm khi gửi lên. Lưu ý: trên HTTP/1.1 trình duyệt chỉ mở tối đa khoảng 6 kết nối mỗi domain, nên mở nhiều tab SSE có thể chặn request khác; HTTP/2 ghép kênh nên hết giới hạn này."
     }
    ]
   },
   {
    "v": 2,
    "name": "WebSocket",
    "steps": [
     {
      "i": 0,
      "key": "Handshake bằng HTTP Upgrade.",
      "detail": "Sau handshake, kết nối TCP **không còn là HTTP**: browser gửi `GET /ws` kèm `Upgrade: websocket` và `Sec-WebSocket-Key`, server đồng ý và trả `101 Switching Protocols`. Từ đó hai bên trao đổi các frame WebSocket nhỏ (header chỉ 2–14 byte), không còn header HTTP mỗi lần gửi."
     },
     {
      "i": 1,
      "key": "Hai chiều trên **cùng một kết nố",
      "detail": "Cả hai bên gửi bất cứ lúc nào trên **cùng một kết nối**: client gửi `hi`, `typing…`, server đẩy `hello`, `goal! 1-0` song song, không chờ lượt nhau. Đây là full-duplex, hợp chat, game, editor cộng tác. Cái giá: kết nối là **stateful** — server phải giữ socket và trạng thái phiên cho từng client, tự lo heartbeat (ping/pong), và client tự viết logic reconnect (WebSocket không tự reconnect như SSE)."
     },
     {
      "i": 2,
      "key": "Khi scale nhiều server, dùng **P",
      "detail": "Với N server, mọi server subscribe một kênh **Redis Pub/Sub** (hoặc Kafka/NATS) để sự kiện tới được đúng socket. Vấn đề: user X nối vào server 1 nhưng bàn thắng được xử lý ở server 3 — server 3 không có socket của X. Server nhận sự kiện publish lên kênh, mỗi server đẩy xuống các socket nó đang giữ. Load balancer cũng phải hỗ trợ Upgrade, và khi deploy hay scale down, hàng nghìn client bị ngắt cùng lúc rồi reconnect dồn dập — cần jitter khi reconnect. Redis Pub/Sub là fire-and-forget: server nào đang mất kết nối Redis sẽ lỡ tin luôn."
     }
    ]
   }
  ]
 },
 "long-task": {
  "context": "API không giữ HTTP request chờ: nó nhận yêu cầu, đẩy **job** vào **queue**, trả `202 Accepted` kèm `jobId`, còn **worker** chạy nền. Lý do: xuất báo cáo 1 triệu dòng mất vài phút, lâu hơn timeout của load balancer, gateway và browser (thường 30–60 giây). Theo dõi dòng chữ dưới API (trạng thái job: QUEUED → RUNNING → DONE), dưới Worker (tiến độ) và dưới S3 (file kết quả).",
  "variants": [
   {
    "v": 0,
    "name": null,
    "steps": [
     {
      "i": 0,
      "key": "User yêu cầu xuất báo cáo.",
      "detail": "User bấm \"Xuất Excel\", browser gửi `POST /reports` kèm tham số (khoảng thời gian, bộ lọc). Nếu API xử lý ngay trong request, nó phải query 1 triệu dòng và build file trong vài phút: request vượt timeout của load balancer (ví dụ ALB mặc định 60s) và bị cắt, user nhận 504 trong khi server vẫn tốn CPU cho kết quả không ai nhận. Thêm vài user cùng bấm là thread pool của API cạn, kéo chết cả các API khác."
     },
     {
      "i": 1,
      "key": "API **không xử lý tại chỗ**: đẩy",
      "detail": "API trả `202 Accepted` + `{jobId: 7}` trong vài chục ms, chỉ làm việc nhẹ: kiểm tra quyền, lưu bản ghi `job#7` trạng thái **QUEUED**, đẩy message `job#7` vào queue. `202` nghĩa là \"đã nhận, chưa làm xong\". Request HTTP kết thúc ngay, API rảnh tay phục vụ user khác. Nên dùng idempotency key cho `POST` để user bấm hai lần không tạo hai job."
     },
     {
      "i": 2,
      "key": "Worker nhận job và chạy vài phút",
      "detail": "Worker lấy `job#7` từ queue, chuyển trạng thái **RUNNING** và ghi tiến độ (40%) vào nơi API đọc được (DB hoặc Redis). Với SQS hay RabbitMQ, message chưa bị xoá hẳn mà chỉ bị ẩn (visibility timeout / unacked): worker crash giữa chừng thì message quay lại queue cho worker khác làm lại, nên job phải chạy lại được an toàn. Số worker quyết định bao nhiêu báo cáo chạy song song — queue đóng vai bộ đệm khi nhiều người bấm cùng lúc."
     },
     {
      "i": 3,
      "key": "Client poll trạng thái (hoặc nhậ",
      "detail": "Client poll `GET /jobs/7` định kỳ, API đọc bản ghi job và trả `RUNNING 40%` để UI vẽ thanh tiến độ. Mỗi lần poll là request nhẹ, trả về ngay. Thay polling có thể dùng SSE/WebSocket đẩy tiến độ, hoặc **webhook** gọi về hệ thống của khách khi xong (hợp với API B2B)."
     },
     {
      "i": 4,
      "key": "Worker xong, upload file lên S3 ",
      "detail": "Worker upload `report7.xlsx` lên S3 rồi mới cập nhật job sang **DONE** kèm key của file. Thứ tự quan trọng: upload thành công **trước**, đánh dấu DONE **sau**, nếu không client có thể nhận link tới file chưa tồn tại. Worker trở về \"rảnh\" và lấy job kế tiếp; lúc này mới xoá/ack message khỏi queue."
     },
     {
      "i": 5,
      "key": "Client nhận link tải (presigned ",
      "detail": "Browser tải file **thẳng từ S3**, không qua API: lần poll kế tiếp API trả `DONE` + **presigned URL** — link S3 có chữ ký, chỉ hợp lệ một thời gian ngắn (ví dụ 15 phút). Nhờ vậy file vài trăm MB không chiếm băng thông và kết nối của API server. Nên đặt lifecycle rule để S3 tự xoá file sau vài ngày, tránh tích luỹ dữ liệu nhạy cảm."
     }
    ]
   }
  ]
 },
 "kafka-acks": {
  "context": "Một message chỉ thật sự an toàn khi đã nằm trên broker **sẽ được bầu làm leader mới** nếu leader hiện tại chết. Mỗi partition có **1 leader** nhận mọi lệnh ghi; các **follower** tự kéo (fetch) dữ liệu từ leader về làm bản sao. `acks` là số xác nhận producer chờ trước khi coi một lần ghi là thành công. Theo dõi dòng chữ dưới mỗi broker: offset cuối cùng broker đó đang giữ.",
  "variants": [
   {
    "v": 0,
    "name": "acks=1",
    "steps": [
     {
      "i": 0,
      "key": "Producer gửi `order#42` với **ac",
      "detail": "Offset 42 lúc này **chỉ tồn tại trên Broker 1**: producer gửi batch chứa `order#42` tới **leader** của P0 là Broker 1, leader append vào log ở offset 42. Producer luôn ghi vào leader, không bao giờ ghi thẳng vào follower. Broker 2 và 3 vẫn dừng ở 41, vì follower chỉ kéo dữ liệu theo từng vòng fetch (vài ms tới vài trăm ms một lần)."
     },
     {
      "i": 1,
      "key": "Leader ack ngay, chưa chờ follow",
      "detail": "Với `acks=1`, leader trả ack ngay khi tự ghi xong, không chờ follower nào. Producer nhận ack thì coi `order#42` đã lưu: báo user “đặt hàng thành công” và **không bao giờ gửi lại** message này. Điểm mấu chốt: lời hứa đã đưa ra khi dữ liệu mới có **đúng 1 bản**."
     },
     {
      "i": 2,
      "key": "Leader **chết** trước khi follow",
      "detail": "Broker 1 chết (mất điện, kernel panic, bị OOM kill) trước khi follower kịp fetch offset 42. Kafka mặc định **không fsync** từng message xuống đĩa — độ bền dựa vào replication — nên dữ liệu có thể mới nằm trong page cache và mất theo máy. Kể cả đĩa còn nguyên, cluster cũng không chờ Broker 1 quay lại."
     },
     {
      "i": 3,
      "key": "Broker 2 được bầu làm leader mới",
      "detail": "Broker 2 thành leader mới với log kết thúc ở offset 41, và từ đây log của nó là sự thật duy nhất. Controller (KRaft) thấy Broker 1 mất heartbeat và bầu leader mới trong **ISR**. Consumer chuyển sang đọc từ Broker 2 và chỉ thấy tới offset 41."
     },
     {
      "i": 4,
      "key": "`order#42` đã được ack nhưng **b",
      "detail": "Producer đã nhận ack nhưng `order#42` không còn ở đâu trong cluster. Broker 1 khởi động lại thì phải **cắt log** (truncate) về offset 41 cho khớp leader mới, nên bản duy nhất cũng bị xoá; message kế tiếp được ghi vào chính offset 42. Hậu quả: user thấy đặt hàng thành công nhưng hệ thống không có đơn — lỗi **im lặng**, không log lỗi nào, rất khó phát hiện."
     }
    ]
   },
   {
    "v": 1,
    "name": "acks=all + min.insync=2",
    "steps": [
     {
      "i": 0,
      "key": "Producer gửi với **acks=all**; t",
      "detail": "Leader ghi offset 42 vào log rồi **giữ request lại**, chưa trả lời producer, vì producer đặt `acks=all`. Topic có `replication.factor=3` (3 bản trên 3 broker) và `min.insync.replicas=2`: một lần ghi chỉ thành công khi **ít nhất 2 replica in-sync** (tính cả leader) đã có message."
     },
     {
      "i": 1,
      "key": "Follower kéo dữ liệu từ leader.",
      "detail": "Broker 2 và 3 gửi fetch request và kéo offset 42 về log của mình. Khi follower fetch tiếp từ offset 43, leader biết chúng đã có 42 và nâng **high watermark** lên 43: từ đây message được coi là đã commit và consumer mới được đọc. Consumer không bao giờ đọc được message chưa commit — tránh đọc thứ có thể bị mất."
     },
     {
      "i": 2,
      "key": "Leader chỉ ack khi đủ ISR.",
      "detail": "Leader trả ack khi đủ số replica in-sync đã có message; lời hứa với producer giờ dựa trên **3 bản sao trên 3 máy**, không còn là một bản. Cái giá: latency ghi tăng thêm một vòng replication (thường vài ms trong cùng region) — throughput vẫn cao vì producer gửi theo batch và có nhiều request bay song song."
     },
     {
      "i": 3,
      "key": "Leader chết → Broker 2 lên leade",
      "detail": "Broker 1 chết, Controller bầu Broker 2 làm leader, và leader mới **chắc chắn có** `order#42`. Lý do: Kafka chỉ bầu leader **trong ISR** (khi `unclean.leader.election.enable=false`, mặc định), và mọi replica trong ISR đều có đủ message đã commit. Consumer đọc bình thường; producer chỉ thấy vài lần retry ngắn trong lúc đổi leader rồi chạy tiếp."
     },
     {
      "i": 4,
      "key": "Chỉ còn 1 replica in-sync → brok",
      "detail": "Leader **từ chối** `order#43` bằng lỗi `NotEnoughReplicas` thay vì nhận ghi chỉ với một bản: Broker 3 cũng chết, ISR chỉ còn Broker 2 (1 < `min.insync.replicas`=2). Producer retry hoặc báo lỗi cho user. Đây là chọn **consistency hơn availability** (CP trong CAP): thà không nhận ghi còn hơn hứa rồi làm mất. Đọc dữ liệu đã có vẫn hoạt động bình thường."
     }
    ]
   }
  ]
 },
 "deadlock": {
  "context": "Chuyển tiền phải khoá **cả hai tài khoản** để không ai đọc/ghi số dư giữa chừng. **Deadlock** xảy ra khi đủ 4 điều kiện Coffman: mutual exclusion (lock chỉ 1 người giữ), hold & wait (giữ lock này trong khi chờ lock khác), no preemption (không ai cướp được lock), circular wait (chờ nhau thành vòng). Dòng chữ dưới T1, T2 (\"giữ X · chờ Y\") chính là hold & wait; dòng dưới Lock A, Lock B cho biết ai đang giữ.",
  "variants": [
   {
    "v": 0,
    "name": "Gây deadlock",
    "steps": [
     {
      "i": 0,
      "key": "T1 lấy lock A.",
      "detail": "T1 (chuyển A → B) lấy được lock A — bước hoàn toàn bình thường. T1 khoá tài khoản nguồn trước; A đang free nên thành công. T1 chạy tiếp và chuẩn bị lấy lock thứ hai."
     },
     {
      "i": 1,
      "key": "Cùng lúc T2 lấy lock B.",
      "detail": "T2 (chuyển B → A) cùng lúc lấy được lock B — đây là mầm của deadlock. T2 cũng khoá tài khoản nguồn của nó trước. Mỗi thread theo một quy tắc hợp lý cục bộ (\"khoá nguồn trước, đích sau\"), nhưng hướng chuyển ngược nhau nên **thứ tự lấy lock ngược nhau**: T1 là A→B, T2 là B→A."
     },
     {
      "i": 2,
      "key": "T1 cần B → chờ T2. T2 cần A → ch",
      "detail": "Cả hai thread bị block, mỗi bên **giữ một lock trong khi chờ lock kia** (hold & wait). T1 xin lock B nhưng T2 đang giữ; T2 xin lock A nhưng T1 đang giữ. Không ai bị buộc nhả (no preemption). Không lỗi, không exception — cả hai chỉ đứng chờ."
     },
     {
      "i": 3,
      "key": "**Circular wait** — không ai nhả",
      "detail": "T1 chờ T2, T2 chờ T1 — vòng chờ khép kín nên cả hai **treo mãi mãi** nếu dùng mutex thông thường không timeout. Nguy hiểm ở chỗ lỗi **im lặng**: CPU không tăng, không log, chỉ thấy request chuyển tiền timeout và thread pool cạn dần khi các request sau cũng xếp hàng chờ A hoặc B. Database (PostgreSQL, MySQL InnoDB) có deadlock detector: sau khoảng `deadlock_timeout` (mặc định 1s ở PostgreSQL) nó huỷ một transaction để phá vòng, ứng dụng phải bắt lỗi và retry. Lock trong code ứng dụng thì không ai phát hiện giúp."
     }
    ]
   },
   {
    "v": 1,
    "name": "Lock ordering",
    "steps": [
     {
      "i": 0,
      "key": "Quy tắc: luôn lấy lock **theo th",
      "detail": "Quy tắc toàn cục: mọi thread lấy lock **theo thứ tự cố định**, ví dụ account id tăng dần — A trước B, bất kể chiều chuyển tiền. T1 (A → B) lấy A, thành công. Quy tắc không bỏ lock nào, chỉ ép mọi thread cùng một thứ tự."
     },
     {
      "i": 1,
      "key": "T2 cũng phải lấy A trước → chờ, ",
      "detail": "T2 chờ trong khi **không giữ lock nào**, nên không thể chặn T1. T2 (B → A) theo quy tắc cũng phải xin A trước, nhưng T1 đang giữ A nên T2 chờ. Điều kiện hold & wait vẫn có, nhưng vòng chờ không thể hình thành vì không ai giữ lock \"lớn hơn\" rồi chờ lock \"nhỏ hơn\"."
     },
     {
      "i": 2,
      "key": "T1 lấy tiếp B, làm xong, nhả cả ",
      "detail": "Giao dịch T1 hoàn tất bình thường: lấy B (đang free vì T2 chưa đụng vào), chuyển tiền, rồi nhả cả A và B. Cái giá duy nhất: T2 chờ thêm thời gian T1 chạy — tuần tự hoá giữa hai giao dịch chạm cùng tài khoản, điều vốn cần cho tính đúng."
     },
     {
      "i": 3,
      "key": "T2 lấy A rồi B — không có vòng c",
      "detail": "T2 được đánh thức, lấy A rồi B, chuyển B → A — không có vòng chờ nên không deadlock. Lock ordering phá điều kiện **circular wait**: rẻ nhất và chắc chắn nhất, nhưng đòi hỏi biết trước mọi lock cần lấy và mọi code path phải tuân thủ; quên một chỗ là deadlock quay lại. Cách bổ sung: `tryLock` với timeout, rồi nhả hết và retry có backoff."
     }
    ]
   }
  ]
 },
 "observer": {
  "context": "**Subject** (Stock AAPL) giữ danh sách observer và gọi `update()` trên từng observer khi trạng thái đổi. Subject chỉ biết interface `Observer`, không biết đó là Mobile App, Email hay Dashboard — đó là **loose coupling**: thêm observer mới không phải sửa Subject. Dòng chữ dưới Subject cho biết giá hiện tại và số observer đang đăng ký; dưới mỗi observer: nó làm gì khi nhận update.",
  "variants": [
   {
    "v": 0,
    "name": null,
    "steps": [
     {
      "i": 0,
      "key": "3 observer **subscribe** vào Sub",
      "detail": "Subject giờ có 3 observer: mỗi observer gọi `subject.subscribe(this)` và Subject thêm tham chiếu vào danh sách nội bộ. Subject không import, không gọi trực tiếp class Mobile App hay Email Alert — nó chỉ giữ một `List<Observer>`. Đây là điểm mở rộng: muốn thêm Slack bot chỉ cần implement `Observer` rồi subscribe."
     },
     {
      "i": 1,
      "key": "Giá đổi → Subject gọi `notify()`",
      "detail": "Giá đổi từ 190 lên 195 → Subject cập nhật state rồi chạy `notify()`: lặp qua danh sách, gọi `update(195)` trên từng observer. Bản cài đặt cổ điển gọi **đồng bộ, cùng thread**: observer chậm (gửi email mất 2s) làm cả vòng `notify()` chậm theo; observer ném exception có thể khiến các observer sau không nhận update nếu Subject không bắt lỗi. Đây là kiểu **push** (gửi kèm giá trị); kiểu **pull** chỉ báo \"đã đổi\" để observer tự hỏi lại Subject."
     },
     {
      "i": 2,
      "key": "Mỗi observer tự xử lý theo cách ",
      "detail": "Mỗi observer phản ứng theo logic riêng với cùng dữ liệu: Mobile App đẩy push notification, Email Alert gửi email, Dashboard vẽ lại chart. Subject không biết và không quan tâm những việc này. Để observer chậm không chặn Subject, observer nên tự đẩy việc nặng (gửi email) sang hàng đợi hoặc thread khác."
     },
     {
      "i": 3,
      "key": "Email Alert **unsubscribe** — lầ",
      "detail": "Email Alert gọi `unsubscribe` → Subject xoá nó khỏi danh sách, còn 2 observer. Lần giá đổi sang 198, chỉ Mobile App và Dashboard nhận `update(198)`. Observer quên unsubscribe khi bị huỷ (ví dụ màn hình đã đóng) thì Subject vẫn giữ tham chiếu: GC không thu hồi được object và nó vẫn nhận update — lỗi **lapsed listener**, nguồn memory leak kinh điển. Ở hệ thống phân tán, cùng ý tưởng này trở thành pub/sub qua message broker."
     }
    ]
   }
  ]
 },
 "kafka-delivery": {
  "context": "**Thứ tự giữa xử lý và commit** quyết định message bị mất hay bị xử lý hai lần. Consumer đọc message từ partition rồi **commit offset** vào topic nội bộ `__consumer_offsets` để nhớ đã đọc tới đâu. Offset được commit là **offset của message kế tiếp cần đọc**: commit 101 nghĩa là \"đã xong 100\". Khi consumer chết, consumer thay thế (sau rebalance) đọc tiếp từ offset đã commit. Theo dõi dòng `committed = …` dưới `__consumer_offsets` và dòng chữ dưới Database.",
  "variants": [
   {
    "v": 0,
    "name": "At-most-once",
    "steps": [
     {
      "i": 0,
      "key": "Consumer poll message offset 100",
      "detail": "Consumer gọi `poll()` và nhận message offset 100: \"charge $5\". Message mới nằm trong bộ nhớ consumer — chưa xử lý, Database chưa có gì. Offset đã commit vẫn là 100."
     },
     {
      "i": 1,
      "key": "**Commit offset trước** khi xử l",
      "detail": "Consumer commit offset **101 trước** khi xử lý — tức tuyên bố với Kafka \"message 100 đã xong\" trong khi chưa làm gì. Từ đây, theo Kafka, message 100 không bao giờ cần giao lại. Kiểu này hay xuất hiện vô tình khi bật `enable.auto.commit=true` mà xử lý message bất đồng bộ ở thread khác: lần `poll()` sau tự commit offset trong khi việc xử lý chưa xong."
     },
     {
      "i": 2,
      "key": "Crash khi đang xử lý.",
      "detail": "Consumer crash (OOM, deploy, kill) khi đang xử lý message 100 — lệnh ghi charge $5 chưa tới Database. Kafka và `__consumer_offsets` không biết chuyện này: với chúng, 100 đã hoàn tất. Sau `session.timeout.ms` (mặc định 45s ở Kafka 3.x), group coordinator coi consumer đã chết và rebalance, giao partition cho consumer khác."
     },
     {
      "i": 3,
      "key": "Consumer mới đọc từ 101 → messag",
      "detail": "Message 100 **mất vĩnh viễn**: consumer mới đọc offset đã commit là 101 và bắt đầu từ `msg@101`. Message 100 vẫn nằm trong log Kafka nhưng không ai xử lý nữa, Database không có charge $5. Lỗi **im lặng** — không exception, không lag, chỉ phát hiện khi đối soát sổ sách. Chỉ chấp nhận được với dữ liệu mất vài bản ghi không sao (metrics, log, tracking click)."
     }
    ]
   },
   {
    "v": 1,
    "name": "At-least-once",
    "steps": [
     {
      "i": 0,
      "key": "Consumer poll message offset 100",
      "detail": "Lần này consumer **xử lý trước, commit sau** — thứ tự mặc định của Kafka consumer khi commit thủ công sau xử lý. Consumer poll message offset 100 (\"charge $5\"); offset đã commit vẫn là 100."
     },
     {
      "i": 1,
      "key": "Xử lý xong: ghi DB.",
      "detail": "Charge $5 đã thật sự tồn tại (1 lần): consumer `INSERT` vào Database, transaction DB commit thành công. Nhưng `__consumer_offsets` vẫn ghi `committed = 100` — Kafka chưa biết message 100 đã xong. Giữa hai thao tác ghi vào hai hệ thống khác nhau (DB và Kafka) luôn có một khe hở không thể bao bằng một transaction."
     },
     {
      "i": 2,
      "key": "Crash **trước khi commit** offse",
      "detail": "Consumer crash đúng trong khe hở đó: đã ghi DB nhưng chưa kịp commit offset 101. Database giữ charge, Kafka vẫn nghĩ 100 chưa xong. Với auto commit, khe hở có thể dài tới `auto.commit.interval.ms` (mặc định 5s) → mọi message đã xử lý trong 5 giây đó đều có nguy cơ bị xử lý lại."
     },
     {
      "i": 3,
      "key": "Consumer mới đọc lại từ 100 → xử",
      "detail": "Database có **2 lần charge $5** — khách bị trừ tiền hai lần. Consumer mới đọc từ offset đã commit (100), nhận lại \"charge $5\" và `INSERT` lần hai. Không mất dữ liệu, nhưng **trùng lặp** chắc chắn xảy ra trong thực tế (crash, rebalance, deploy). Vì vậy at-least-once chỉ an toàn khi bước xử lý chịu được chạy lặp."
     }
    ]
   },
   {
    "v": 2,
    "name": "At-least-once + idempotent",
    "steps": [
     {
      "i": 0,
      "key": "Consumer poll message offset 100",
      "detail": "Vẫn xử lý trước, commit sau như at-least-once, thêm một điều kiện: bước ghi DB phải **idempotent** — chạy 1 lần hay 10 lần cho cùng message thì kết quả như nhau. Consumer poll message offset 100."
     },
     {
      "i": 1,
      "key": "Ghi DB kèm **message id** làm kh",
      "detail": "Lần đầu insert thành công, Database ghi `msg 100 ✓`. Consumer `INSERT` charge kèm **message id** làm unique key — id nghiệp vụ do producer sinh hoặc bộ `topic-partition-offset` — với `ON CONFLICT DO NOTHING`: id đã tồn tại thì bỏ qua, không lỗi. Unique constraint trong DB dedupe atomic, không cần lock hay check-then-insert dễ race."
     },
     {
      "i": 2,
      "key": "Crash **trước khi commit** offse",
      "detail": "Consumer lại crash trước khi commit offset, đúng khe hở như variant trước — nhưng lần này giao lại **không còn nguy hiểm**. Kafka vẫn nghĩ message 100 chưa xong và sẽ giao lại."
     },
     {
      "i": 3,
      "key": "Đọc lại 100 → DB thấy msg id đã ",
      "detail": "Không có charge thứ hai: consumer mới đọc lại `msg@100`, chạy cùng `INSERT … ON CONFLICT`, DB trả **0 row** vì id 100 đã có. Consumer commit 101 và đi tiếp. Kết quả cuối như thể message được xử lý đúng một lần — **effectively-once**. Lưu ý: nếu bước xử lý là gọi API thanh toán bên ngoài chứ không phải insert DB, phải truyền **idempotency key** cho API đó; còn transaction của Kafka (`isolation.level=read_committed`, `transactional.id`) chỉ cho exactly-once khi cả đầu vào lẫn đầu ra đều là topic Kafka."
     }
    ]
   }
  ]
 },
 "redis-atomic": {
  "context": "Redis xử lý lệnh trên **một thread** nên từng lệnh riêng lẻ là atomic — nhưng chuỗi lệnh client gửi (GET rồi SET) thì không: lệnh của client khác có thể chen vào giữa. Variant 1 cho thấy **lost update** do read-modify-write phía client; variant 2 đẩy phép cộng vào server bằng `INCR`; variant 3 đẩy cả logic nhiều bước vào server bằng **Lua script**. Theo dõi dòng chữ dưới Redis: giá trị counter thật sau mỗi bước so với giá trị đúng.",
  "variants": [
   {
    "v": 0,
    "name": "GET rồi SET",
    "steps": [
     {
      "i": 0,
      "key": "Hai server cùng đọc counter.",
      "detail": "Server A và B cùng nhận `10` vì cả hai `GET views` đều tới Redis trước bất kỳ lệnh ghi nào. Redis vẫn xử lý tuần tự, nhưng hai lệnh gửi gần như cùng lúc. Mỗi server giờ giữ một bản sao counter **trong bộ nhớ của nó** — bản sao này cũ ngay khi bên kia ghi."
     },
     {
      "i": 1,
      "key": "Cả hai tính 10 + 1 = 11 trong co",
      "detail": "Mỗi server tự tính 10 + 1 = 11 trong code ứng dụng — ngoài Redis, Redis không biết gì về phép tính. Khoảng hở giữa GET và SET chỉ vài trăm micro giây tới vài ms (một round-trip mạng), nhưng với hàng nghìn request/giây thì va chạm xảy ra liên tục."
     },
     {
      "i": 2,
      "key": "Cả hai ghi 11 → **mất một lượt t",
      "detail": "Counter là **11 thay vì 12** — một lượt tăng biến mất. A gửi `SET views 11`, B cũng gửi `SET views 11`, lệnh của B ghi đè lệnh của A bằng chính giá trị đó. Lỗi **im lặng**: cả hai lệnh đều trả OK, không xung đột nào được báo. Lượt view, tồn kho hay số dư lệch dần theo tải; tải càng cao, mất càng nhiều. Redis đơn luồng không cứu được vì vấn đề nằm ở khoảng hở giữa hai lệnh, không phải trong một lệnh. Cách khác ngoài INCR là `WATCH`/`MULTI`/`EXEC` (optimistic lock: EXEC thất bại nếu key bị đổi, client retry)."
     }
    ]
   },
   {
    "v": 1,
    "name": "INCR",
    "steps": [
     {
      "i": 0,
      "key": "Dùng **INCR**: phép cộng chạy ng",
      "detail": "A và B cùng gửi `INCR views` — phép \"đọc–cộng–ghi\" nằm trọn trong **một lệnh** chạy trên server. Khác GET/SET, không còn khoảng hở giữa đọc và ghi để lệnh khác chen vào. Client cũng không còn giữ bản sao cũ của counter."
     },
     {
      "i": 1,
      "key": "Redis chạy tuần tự từng lệnh: 10",
      "detail": "Kết quả cuối **12**, đúng. Event loop của Redis xử lý lệnh tới trước (giả sử của A): 10 → 11, trả `11`; rồi lệnh của B: 11 → 12, trả `12`. Mỗi server còn nhận giá trị riêng sau khi tăng, dùng được làm số thứ tự duy nhất. `INCR` chỉ tốn một round-trip, nhanh hơn GET + SET (hai round-trip)."
     }
    ]
   },
   {
    "v": 2,
    "name": "Lua script",
    "steps": [
     {
      "i": 0,
      "key": "Rate limit cần nhiều bước: đọc c",
      "detail": "Rate limit cho user 42: tối đa 10 request trong cửa sổ, đã dùng 9 — và `INCR` một mình không đủ. Logic cần nhiều bước: đọc `rl:u42`, so với limit, còn thì `INCR`, đặt `EXPIRE` ở lần đầu để cửa sổ tự reset. Bước \"so sánh rồi mới quyết định\" vẫn là check-then-act: A và B cùng GET thấy 9 rồi cùng cho qua → user dùng 11 lần."
     },
     {
      "i": 1,
      "key": "Gửi cả logic dưới dạng **Lua scr",
      "detail": "Redis chạy trọn một **Lua script** như một lệnh duy nhất: trong lúc script của A chạy, không lệnh nào khác — kể cả script của B — được thực thi. Mỗi server gửi toàn bộ logic qua `EVAL` (thực tế dùng `EVALSHA` để khỏi gửi lại thân script mỗi lần). Cái giá: script chạy lâu sẽ **chặn toàn bộ Redis**, nên script phải ngắn, không vòng lặp lớn; ở Redis Cluster, mọi key trong script phải cùng hash slot."
     },
     {
      "i": 2,
      "key": "A tới trước: 9 < 10 → tăng lên 1",
      "detail": "Limit được giữ chính xác: A được `allowed`, B bị `denied`. Script của A chạy trước: đọc 9, 9 < 10 nên tăng lên 10. Script của B chạy sau: đọc 10, 10 ≥ 10 nên không tăng. Không có kẽ hở để cả hai cùng thấy 9. Lua cho atomic nhiều bước chỉ với một round-trip — cùng kỹ thuật dùng để nhả lock an toàn (chỉ `DEL` nếu value đúng là token của mình). Redis 7 có thêm **Functions** (`FUNCTION LOAD`, `FCALL`) để quản lý script như thư viện lưu sẵn trên server."
     }
    ]
   }
  ]
 },
 "redis-cluster": {
  "context": "Redis Cluster chia keyspace thành **16,384 hash slot**; mỗi master giữ một dải slot, key thuộc slot `CRC16(key) mod 16384`. Client thông minh cache **bảng slot → node** để gửi thẳng tới đúng master; bảng cũ thì node nhận nhầm trả `MOVED`. Mỗi master có thể có replica, nhưng replication **bất đồng bộ**: master trả OK trước khi replica có dữ liệu. Theo dõi dòng chữ dưới Client (slot tính được), dưới Master B và Replica B′ (ai đang giữ key nào).",
  "variants": [
   {
    "v": 0,
    "name": "Định tuyến theo slot",
    "steps": [
     {
      "i": 0,
      "key": "Client cần `GET user:42`. `slot ",
      "detail": "Client tự tính ra key `user:42` thuộc Master B, không cần hỏi node nào. `CRC16(\"user:42\") mod 16384`, giả sử ra 8,155; tra bảng slot thì 8,155 nằm trong dải 5461–10922, thuộc Master B. Phép tính diễn ra **hoàn toàn phía client** → cluster không cần proxy trung tâm và mỗi lệnh chỉ tốn một hop."
     },
     {
      "i": 1,
      "key": "Client dùng bảng slot cũ, gửi nh",
      "detail": "Master A trả lỗi `MOVED 8155 <ip:port của B>` vì client gửi nhầm chỗ. Bảng slot trong cache của client đã cũ (ví dụ slot vừa di chuyển khi resharding hoặc failover), nên `GET user:42` tới Master A. A không giữ slot 8,155 và không proxy giúp. Với client, lỗi này nghĩa là \"slot đã đổi chủ vĩnh viễn, hãy cập nhật bảng\". Cái giá: thêm một round-trip cho lệnh này."
     },
     {
      "i": 2,
      "key": "Client cập nhật bảng slot và gửi",
      "detail": "Client cập nhật bảng slot (thường gọi lại `CLUSTER SHARDS`/`CLUSTER SLOTS` để làm mới toàn bộ), gửi lại tới Master B và nhận `\"Son\"`. Các lệnh sau vào slot này đi thẳng tới B. Cơ chế tự sửa này cho cluster đổi topology mà không phải cấu hình lại client. Trong lúc đang di chuyển slot, node có thể trả `ASK` thay vì `MOVED`: chuyển hướng một lần, không cập nhật bảng."
     },
     {
      "i": 3,
      "key": "Lệnh nhiều key phải cùng slot. *",
      "detail": "`MGET`, `MULTI` hay Lua script chạm nhiều key chỉ chạy được khi mọi key **cùng một slot**; nếu không, Redis trả lỗi `CROSSSLOT`. **Hash tag**: key có `{...}` thì chỉ phần trong ngoặc được hash → `{user42}:cart` và `{user42}:profile` cùng slot, cùng nằm trên Master B, và `MGET` trả 2 giá trị trong một lệnh. Lạm dụng hash tag (ví dụ cả hệ thống dùng chung `{app}`) dồn hết key vào một slot, tạo **hot shard** và mất ý nghĩa phân tán."
     }
    ]
   },
   {
    "v": 1,
    "name": "Failover mất write",
    "steps": [
     {
      "i": 0,
      "key": "Client ghi vào Master B; B ack n",
      "detail": "Client A tin mình đang giữ lock: chạy `SET lock:7 A NX` (chỉ set nếu chưa có) và Master B trả `OK` **ngay lập tức** sau khi ghi vào bộ nhớ. Lệnh chỉ được gửi sang Replica B′ sau đó, bất đồng bộ qua replication stream. Client A bắt đầu làm việc trong vùng găng."
     },
     {
      "i": 1,
      "key": "B chết trước khi kịp gửi sang re",
      "detail": "Master B chết trong khe hở vài ms đó, trước khi replication stream mang `lock:7` sang B′. Lệnh ghi đã được ack nhưng giờ chỉ còn trong bộ nhớ của một máy đã chết. Kể cả bật AOF, B cũng không quay lại kịp: cluster sẽ thay nó bằng replica."
     },
     {
      "i": 2,
      "key": "Replica được promote thành maste",
      "detail": "B′ lên làm master với dữ liệu **không có** `lock:7` — và đó là sự thật mới. Sau `cluster-node-timeout` (mặc định 15s), các master còn lại đánh dấu B là FAIL, bầu B′ lên master và giao dải slot 5461–10922. Lệnh `WAIT 1 timeout` chờ replica xác nhận trước khi trả lời client, giảm khả năng này, nhưng Redis vẫn không đảm bảo strong consistency."
     },
     {
      "i": 3,
      "key": "Client khác lấy được cùng lock →",
      "detail": "**A và B cùng tin mình giữ lock**: Client B chạy `SET lock:7 B NX` trên master mới, key không tồn tại nên nhận `OK`. Cả hai cùng ghi vào tài nguyên được bảo vệ — ví dụ cùng xử lý một đơn hàng, cùng trừ kho. Lỗi im lặng: cả hai lệnh đều thành công đúng nghĩa. Phòng tránh: tài nguyên đích kiểm tra **fencing token** (số tăng dần cấp kèm lock, từ chối token cũ), và dữ liệu không được mất phải nằm ở hệ thống có replication đồng bộ/quorum (PostgreSQL, etcd), không chỉ trong Redis."
     }
    ]
   }
  ]
 },
 "ecs-flow": {
  "context": "**ECS control plane** là bộ não: nó giữ định nghĩa service `web` (task definition nào, desired bao nhiêu task) và liên tục so trạng thái thật với trạng thái mong muốn. **ECR** chứa image; **Task** là các container chạy trên Fargate — mỗi task có ENI và IP riêng trong VPC (network mode `awsvpc`). **ALB** chỉ gửi traffic tới các IP nằm trong target group và pass health check; **CloudWatch** nhận metric và bắn alarm để scale. Theo dõi dòng chữ dưới ECS (`desired`, revision task definition), dưới mỗi task (version, trạng thái, CPU) và `targets:` dưới ALB — số target healthy mới là số task thật sự đang phục vụ user.",
  "variants": [
   {
    "v": 0,
    "name": "Rolling deploy",
    "steps": [
     {
      "i": 0,
      "key": "CI build image `web:v2`, push lê",
      "detail": "CI đăng ký **task definition revision 8** trỏ tới image `web:v2`, rồi gọi `UpdateService` chuyển service sang `:8`. Trước đó pipeline build `web:v2` và push lên ECR; ECR giữ cả `web:v1` lẫn `web:v2`, nên rollback chỉ là trỏ service về revision cũ. Revision là bản mô tả bất biến gồm image, CPU/RAM, env, IAM role: không sửa revision 7 mà tạo revision mới → mỗi deploy có một mốc rõ ràng để so sánh và quay lại. Nên tag image theo commit SHA thay vì `latest`, để revision 8 luôn trỏ đúng một bản build."
     },
     {
      "i": 1,
      "key": "ECS tạo task mới trên Fargate; t",
      "detail": "ECS bắt đầu rolling update vì service muốn revision 8 nhưng đang chạy toàn revision 7. Với mặc định `minimumHealthyPercent=100`, `maximumPercent=200`, ECS **khởi task mới trước** rồi mới rút task cũ, nên công suất không bao giờ tụt dưới 2 task. Fargate cấp micro-VM, gắn ENI, rồi agent dùng **task execution role** lấy token ECR và kéo `web:v2` — role này là quyền của *hạ tầng* (pull image, ghi log, đọc secret), khác **task role** là quyền của *code app*. Task #3 `RUNNING` nghĩa là container đã chạy, chưa có nghĩa là sẵn sàng nhận traffic."
     },
     {
      "i": 2,
      "key": "ECS đăng ký IP của task (awsvpc)",
      "detail": "ALB đăng ký thẳng **IP của task** vào target group (target type `ip`) nhờ `awsvpc`, không qua port động của host. ALB gọi `GET /health`; target chỉ thành healthy và nhận request thật khi pass đủ `HealthyThresholdCount` lần liên tiếp. Trong `healthCheckGracePeriodSeconds`, ECS bỏ qua kết quả health check để app kịp khởi động (warm cache, mở connection pool). `targets: 3` cho thấy giai đoạn ngắn có 3 task cùng phục vụ — v1 và v2 chạy song song, nên API và schema DB phải tương thích ngược giữa hai version."
     },
     {
      "i": 3,
      "key": "ECS drain và dừng task cũ, lặp l",
      "detail": "Có task v2 healthy, ECS mới rút task v1. Đầu tiên ECS **deregister** task khỏi target group: ALB ngừng gửi request mới nhưng giữ các request đang chạy trong `deregistration_delay` (mặc định 300 giây, thường chỉnh xuống 30–60 giây). Sau đó ECS gửi `SIGTERM`, chờ `stopTimeout` (mặc định 30 giây) rồi `SIGKILL` — app phải bắt `SIGTERM` để đóng gọn. Vòng này lặp tới khi mọi task chạy revision 8. Nếu task v2 cứ fail health check, **deployment circuit breaker** (bật `rollback=true`) đếm số lần fail, đánh dấu deployment `FAILED` và tự quay về revision 7 thay vì kẹt mãi ở trạng thái nửa vời."
     }
    ]
   },
   {
    "v": 1,
    "name": "Scale khi tải tăng",
    "steps": [
     {
      "i": 0,
      "key": "CPU trung bình của service vượt ",
      "detail": "CPU trung bình hai task lên 85% và 82% khi request tăng — đây là lúc nên thêm task, trước khi task quá tải và fail health check. ECS tự đẩy metric `CPUUtilization` của service lên CloudWatch (trung bình trên các task, chu kỳ 1 phút). Ngưỡng 70% là **target value** của policy target tracking, không phải mức sập: ở 85%, latency bắt đầu tăng vì request phải xếp hàng chờ CPU."
     },
     {
      "i": 1,
      "key": "**Service Auto Scaling** (target",
      "detail": "Desired count tăng 2 → 3 và ECS khởi thêm task. Policy **target tracking** tự tạo CloudWatch alarm; khi alarm kích (thường cần vài datapoint liên tiếp, tức vài phút), Application Auto Scaling tính desired mới để kéo CPU về gần 70%. ECS thấy running 2 < desired 3 nên khởi task mới. Fargate không có máy để lo: AWS cấp compute cho từng task, thường mất khoảng 30–60 giây gồm cả pull image (chữ \"ngay\" trong animation nghĩa là không phải chờ thêm EC2, không phải tức thì). Image càng nhỏ, task càng sớm sẵn sàng."
     },
     {
      "i": 2,
      "key": "Task mới vào target group, tải c",
      "detail": "CPU mỗi task về khoảng 52–55%, dưới target 70%: Task #3 vào target group, pass health check, và ALB chia đều cùng tổng tải cho 3 target thay vì 2. Khi tải giảm, target tracking **scale-in chậm hơn** scale-out (cooldown dài hơn, cần nhiều datapoint thấp hơn) để tránh thêm-bớt liên tục. Trên ECS chạy EC2, task mới có thể nằm `PENDING` vì cluster hết chỗ — lúc đó cần **capacity provider** với managed scaling để thêm instance, đúng lớp thứ hai mà Fargate đã bỏ đi."
     }
    ]
   },
   {
    "v": 2,
    "name": "Task chết",
    "steps": [
     {
      "i": 0,
      "key": "Task #2 crash vì hết RAM (OOM).",
      "detail": "Task #2 chuyển `STOPPED` vì kernel **OOM kill** process chính khi container dùng vượt hard limit memory. Container essential thoát nên cả task dừng với lý do `OutOfMemoryError: Container killed due to memory usage` — ECS biết ngay qua task state change, không cần chờ ALB. Animation vẽ health check của ALB thất bại: ALB cũng thấy target không trả lời, nhưng trong thực tế với task đã dừng, tín hiệu chính đến từ ECS. Mọi request đang xử lý trong task bị đứt, client nhận 502 nếu không retry."
     },
     {
      "i": 1,
      "key": "ALB đánh dấu unhealthy; ECS thấy",
      "detail": "`targets: 1` — ECS deregister IP của Task #2 và toàn bộ traffic dồn vào Task #1 trong lúc chờ thay thế. Đồng thời service scheduler thấy **running 1 < desired 2**: đây là vòng reconcile liên tục của ECS, không phải script bạn viết. Task còn chạy nhưng fail health check của ALB thì ECS cũng coi là unhealthy và chủ động thay. Rủi ro lúc này: Task #1 gánh gấp đôi tải, có thể OOM theo nếu nguyên nhân là tải tăng chứ không phải bug."
     },
     {
      "i": 2,
      "key": "ECS tự khởi động task thay thế.",
      "detail": "ECS khởi Task #3 từ cùng task definition, đăng ký vào target group, `targets: 2` trở lại — không ai phải can thiệp. Nhưng tự phục hồi **không sửa nguyên nhân**: nếu là memory leak, task mới sẽ OOM lại sau vài giờ và lặp vòng crash. Task fail khởi động liên tục thì ECS áp backoff (throttle) giữa các lần thử. Cần đặt alarm cho số task `STOPPED` vì OOM, xem `stoppedReason`, rồi tăng memory hoặc sửa leak."
     }
    ]
   }
  ]
 },
 "eks-flow": {
  "context": "**EKS control plane** (API server, etcd, scheduler, controller manager) do AWS quản lý: mọi thay đổi đều là ghi object vào API server, rồi các controller đọc và làm cụm khớp với object đó. **Node A/B/C** là EC2 trong cluster; mỗi node có kubelet chạy pod và VPC CNI cấp IP. **Karpenter** là autoscaler cấp node; **AWS Load Balancer Controller** (chạy dưới dạng pod, không vẽ riêng) đồng bộ IP pod vào **ALB**. Theo dõi chữ dưới API server (ReplicaSet, HPA, số pod Pending/Ready) và dưới từng node (version pod, CPU, IP): khác ECS, ở đây scale có **hai lớp** — số pod và số node.",
  "variants": [
   {
    "v": 0,
    "name": "Rolling deploy",
    "steps": [
     {
      "i": 0,
      "key": "ArgoCD (GitOps) apply Deployment",
      "detail": "Deployment controller tạo **ReplicaSet mới** cho v2 sau khi ArgoCD apply manifest mới. ArgoCD thấy commit mới trong Git repo (image đổi sang `web:v2`) và apply Deployment lên **API server**; API server validate, chạy admission webhook rồi lưu object vào **etcd**. Controller thấy pod template đổi nên tạo ReplicaSet v2 và giữ ReplicaSet v1 để scale dần về 0. GitOps nghĩa là Git là source of truth: ai đó `kubectl edit` tay thì ArgoCD phát hiện drift và kéo về đúng bản trong Git. Rollback là revert commit, có lịch sử và review như code."
     },
     {
      "i": 1,
      "key": "Scheduler chọn node đủ CPU/RAM t",
      "detail": "**Scheduler** bind pod v2 vào Node A: lọc các node đủ chỗ theo **resource requests** (không phải mức dùng thực tế), rồi chấm điểm. Kubelet trên Node A thấy pod được gán, kéo image từ ECR bằng quyền của node role rồi khởi container. Request đặt quá thấp thì scheduler nhồi quá nhiều pod lên một node và chúng tranh CPU/RAM; quá cao thì node trống mà pod vẫn không xếp được. Trạng thái `starting` nghĩa là container đang chạy nhưng chưa nhận traffic."
     },
     {
      "i": 2,
      "key": "**VPC CNI** cấp cho pod một IP t",
      "detail": "Pod nhận một IP thật của subnet VPC (`10.0.12.44`) — **VPC CNI** gán secondary IP ngay khi tạo network sandbox, nên ALB và các dịch vụ trong VPC gọi thẳng tới pod, không qua overlay network hay NAT. Cái giá: mỗi pod tốn một IP của subnet, và số pod mỗi node bị giới hạn bởi số ENI × IP của instance type (bật prefix delegation để nới). Sau đó kubelet chạy **readiness probe**; pass thì pod thành `Ready` và vào EndpointSlice của Service. Liveness probe là chuyện khác: fail liveness thì kubelet restart container."
     },
     {
      "i": 3,
      "key": "**AWS Load Balancer Controller**",
      "detail": "IP pod `10.0.12.44` được đăng ký vào target group của ALB sau khi pod `Ready` và vào EndpointSlice. **AWS Load Balancer Controller** watch các object này qua API server rồi gọi ELB API đăng ký IP (target type `ip`) — animation vẽ mũi tên từ API server sang ALB, thực chất controller đứng giữa. ALB health check pod rồi mới gửi traffic thật. Nên bật **pod readiness gate** của controller: pod chỉ được tính Ready khi ALB đã thấy target healthy, tránh rolling update rút pod cũ trong khi ALB chưa nhận pod mới."
     },
     {
      "i": 4,
      "key": "ReplicaSet cũ giảm dần theo `max",
      "detail": "Kết quả: cả hai node chạy `pod v2 ×2`. Deployment controller lặp: thêm pod v2 trong giới hạn `maxSurge` (mặc định 25% số replicas có thể vượt), rút pod v1 trong giới hạn `maxUnavailable` (mặc định 25% có thể thiếu). Pod v1 bị terminate nhận `SIGTERM` và đồng thời bị rút khỏi endpoint, chờ `terminationGracePeriodSeconds` (mặc định 30 giây) rồi `SIGKILL`; thêm `preStop` sleep vài giây để ALB kịp deregister trước khi app đóng. Khác ECS: ArgoCD, VPC CNI, Load Balancer Controller đều là add-on bạn tự cài, tự nâng version và tự xử lý khi chúng lỗi."
     }
    ]
   },
   {
    "v": 1,
    "name": "Scale: HPA + Karpenter",
    "steps": [
     {
      "i": 0,
      "key": "Tải tăng: **HPA** thấy CPU 85% >",
      "detail": "**HPA** thấy CPU trung bình 85% so với target 60% và tăng replicas. HPA đọc CPU từ metrics-server khoảng 15 giây một lần; công thức `desired = ceil(current × actual / target)` = ceil(4 × 85/60) = **6**, không phải 8 — animation làm tròn lên gấp đôi cho dễ nhìn (8 chỉ đúng nếu CPU khoảng 120% request, hoặc khi bạn tự đặt policy). CPU tính theo % của **requests**, nên không có request thì HPA không hoạt động. Node A và B đều đã đầy nên các pod mới không có chỗ chạy."
     },
     {
      "i": 1,
      "key": "Không node nào đủ chỗ → 4 pod **",
      "detail": "4 pod mới nằm **Pending** với event `FailedScheduling: Insufficient cpu` vì scheduler không tìm được node nào đủ requests. HPA chỉ tạo thêm pod, nó **không biết gì về máy** — đây là khoảng trống của lớp thứ hai. Trong lúc Pending, tải thật vẫn dồn vào 4 pod cũ đang CPU ~90%, latency tiếp tục tăng. Không có node autoscaler thì các pod này Pending mãi."
     },
     {
      "i": 2,
      "key": "**Karpenter** thấy pod Pending, ",
      "detail": "**Karpenter** bật Node C `c7g.xlarge` (Graviton, 4 vCPU, 8 GiB) dạng **Spot** cho các pod Pending. Nó watch pod Pending, gom requests, affinity và toleration rồi tự chọn instance type vừa khít trong danh sách NodePool cho phép. Karpenter gọi thẳng EC2 Fleet API, không qua Auto Scaling Group như Cluster Autoscaler, nên node thường Ready trong khoảng một phút. Hai lưu ý: `c7g` là **arm64**, image phải build multi-arch; Spot có thể bị AWS thu hồi với 2 phút báo trước, nên Karpenter cần xử lý interruption và workload phải chịu được pod bị dời."
     },
     {
      "i": 3,
      "key": "Scheduler xếp pod lên node mới; ",
      "detail": "Tải chia trên 8 pod, CPU Node A/B về khoảng 60% — đúng target của HPA. Node C Ready, scheduler bind 4 pod Pending lên đó; VPC CNI cấp IP, readiness pass, Load Balancer Controller đăng ký 4 IP mới vào ALB. Khi tải giảm, HPA giảm replicas trước (mặc định chờ 5 phút stabilization), rồi Karpenter **consolidation** gom pod và xoá node thừa để tiết kiệm. Tổng thời gian phản ứng dài hơn Fargate một bước: HPA vài chục giây cộng thời gian bật node."
     }
    ]
   },
   {
    "v": 2,
    "name": "Pod gọi S3 (Pod Identity)",
    "steps": [
     {
      "i": 0,
      "key": "Pod cần đọc S3. Không đặt access",
      "detail": "Pod của app được gắn IAM role `s3-read` qua **Pod Identity association**, thay vì nhét access key tĩnh vào env hay secret — key tĩnh không hết hạn, lộ một lần là lộ mãi. Tạo role `s3-read` có trust policy cho principal `pods.eks.amazonaws.com`, rồi tạo association nối role với ServiceAccount `web-sa` trong namespace của app. Pod khai báo `serviceAccountName: web-sa`; EKS tự inject biến môi trường `AWS_CONTAINER_CREDENTIALS_FULL_URI` và token vào pod. Code không cần đổi gì, AWS SDK tự dùng credential provider chain."
     },
     {
      "i": 1,
      "key": "SDK trong pod xin credential tạm",
      "detail": "SDK nhận credential tạm của role `s3-read`, cache và tự refresh trước khi hết hạn. SDK gọi endpoint local của **Pod Identity Agent** (DaemonSet trên mỗi node, nghe ở `169.254.170.23`) kèm ServiceAccount token của pod. Agent gọi API `AssumeRoleForPodIdentity` của dịch vụ **EKS Auth** — đây là AWS API, không phải Kubernetes API server như mũi tên trong animation gợi ý; EKS Auth xác minh token và tra association rồi trả credential. Lộ credential này thì thiệt hại bị giới hạn trong thời gian sống ngắn và đúng quyền của role."
     },
     {
      "i": 2,
      "key": "Pod khác trên cùng node không dù",
      "detail": "Pod khác trên Node B không lấy được credential `s3-read` vì dùng ServiceAccount khác — quyền gắn theo **ServiceAccount**, không theo node. Cách cũ dùng instance role của node thì mọi pod trên node đều thừa hưởng cùng quyền. Để chặn pod lấy instance role qua IMDS, đặt `HttpPutResponseHopLimit=1` trên node. Lưu ý: pod nào trong cùng namespace được dùng `web-sa` cũng có quyền này, nên ranh giới thật là ai được phép chỉ định ServiceAccount đó. ECS làm tương tự bằng task role; IRSA là cách cũ hơn dựa trên OIDC provider, Pod Identity là khuyến nghị hiện tại."
     }
    ]
   }
  ]
 }
};
