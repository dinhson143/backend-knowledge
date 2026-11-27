BK.topic({
  id: "outbox-cdc",
  track: "sd",
  section: "sd-patterns",
  title: "Outbox & CDC",
  goal: "Ghi DB và phát event mà không mất hay lệch nhau",
  needs: ["core-db", "kafka"],
  tldr: {
    t: "Ghi DB rồi publish lên Kafka là **dual write**: không transaction nào bao cả hai, nên crash ở giữa làm DB và event lệch nhau mãi mãi. **Outbox**: ghi event vào bảng `outbox` **trong cùng transaction** với dữ liệu nghiệp vụ; một tiến trình khác (polling hoặc **CDC** đọc WAL/binlog) đẩy event ra broker. Event được giao ít nhất một lần, nên consumer phải idempotent.",
    why: "Transaction của DB chỉ bao những gì nằm trong DB. Đưa event vào DB (bảng outbox) biến hai lần ghi vào hai hệ thống thành một lần ghi vào một hệ thống, nên DB đảm bảo hoặc cả hai cùng có, hoặc không có gì. Phần còn lại, chép từ outbox sang broker, có thể retry vô hạn vì event đã nằm an toàn trong DB.",
  },
  story: {
    problem: "Service đặt hàng `INSERT orders` rồi `publish(OrderCreated)`. Process chết sau khi commit DB, trước khi publish: đơn tồn tại nhưng kho, email, search index không bao giờ biết. Đảo thứ tự (publish trước) thì DB rollback mà event đã đi: kho giữ hàng cho một đơn không tồn tại.",
    idea: "Coi event là một phần của dữ liệu nghiệp vụ: ghi nó vào bảng `outbox` cùng transaction. Một relay đọc outbox (quét định kỳ, hoặc đọc log thay đổi của DB như Debezium) và publish. Relay gửi lại được bao nhiêu lần cũng được; consumer dedupe theo id của event.",
    tradeoff: "Thêm một bảng, một tiến trình relay (hoặc cả hạ tầng CDC: Kafka Connect, replication slot) phải vận hành và giám sát. Event tới consumer trễ hơn publish trực tiếp một chút, và có thể trùng. Outbox chỉ giải chuyện ghi tin cậy, không giải chuyện các service khác xử lý đúng.",
  },
  table: {
    head: ["Thứ tự ghi", "Crash ở giữa thì sao", "Kết quả"],
    rows: [
      {
        cells: ["Commit DB → publish", "DB có đơn, event không bao giờ gửi", "Service khác không biết đơn tồn tại"],
        why: "Sau commit, thông tin \"còn phải publish\" chỉ nằm trong RAM của process. Process chết (OOM, deploy, kill -9) là mất. Đặt publish trong `finally` hay retry trong code không cứu được, vì chính process giữ vòng retry đã chết.",
      },
      {
        cells: ["Publish → commit DB", "Event đã đi, DB rollback hoặc chưa commit", "Service khác xử lý một đơn không tồn tại"],
        why: "Event là lời tuyên bố \"việc này đã xảy ra\", nhưng việc đó chưa được DB xác nhận. Commit lỗi (vi phạm constraint, deadlock, crash) thì không có cách thu hồi event đã đọc.",
      },
      {
        cells: ["Publish trong transaction DB, trước commit", "Publish xong, commit lỗi", "Giống trường hợp trên: event \"ma\""],
        why: "Gọi broker từ giữa transaction không làm broker tham gia transaction đó. Còn giữ transaction DB mở trong lúc chờ mạng tới broker thì giữ lock lâu hơn.",
      },
      {
        cells: ["**Outbox**: `INSERT orders` + `INSERT outbox` cùng transaction", "Cả hai cùng có hoặc cùng không", "Relay publish sau, retry tới khi được"],
        why: "Chỉ còn một lần ghi vào một hệ thống có transaction. Relay chết giữa chừng thì lần sau đọc lại outbox và gửi tiếp; tệ nhất là gửi trùng, không bao giờ mất.",
      },
    ],
  },
  points: [
    {
      t: "**Bảng outbox** theo mặc định của Debezium Outbox Event Router có các cột `id`, `aggregatetype`, `aggregateid`, `type`, `payload`. `aggregatetype` chọn topic (mặc định `outbox.event.<aggregatetype>`), `aggregateid` thành **message key**, `id` đi theo header để consumer dedupe (https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html).",
      why: "Mỗi cột trả lời một câu hỏi của relay: gửi vào topic nào (`aggregatetype`), giữ thứ tự theo gì (`aggregateid`: mọi event của một đơn có cùng key nên vào cùng partition), và consumer nhận ra lần trùng bằng gì (`id`). Thiếu `aggregateid` làm key thì event \"đã huỷ\" có thể tới trước \"đã tạo\".",
    },
    {
      t: "**Relay bằng polling**: worker chạy `SELECT … FROM outbox WHERE sent = false ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`, publish, rồi đánh dấu đã gửi hoặc xoá. Nhiều worker chạy song song không giẫm nhau nhờ `SKIP LOCKED` (https://www.postgresql.org/docs/current/sql-select.html).",
      why: "`SKIP LOCKED` bỏ qua các dòng worker khác đang khoá, nên mỗi worker lấy một lô khác nhau mà không chờ lock. Đổi lại, polling thêm tải truy vấn đều đặn lên DB và độ trễ bằng chu kỳ quét. Nhiều worker cùng lúc thì thứ tự giữa các lô không còn được đảm bảo, nên thường chia theo `aggregateid`.",
    },
    {
      t: "**Relay bằng CDC** (Change Data Capture): đọc log thay đổi của DB thay vì truy vấn bảng. PostgreSQL gọi đây là **logical decoding**: giải mã WAL thành luồng thay đổi theo dòng, cần `wal_level = logical` (hoặc `replica` kèm ít nhất một logical replication slot, khi đó PostgreSQL tự bật) và một **replication slot** (https://www.postgresql.org/docs/current/logicaldecoding-explanation.html). Debezium đọc slot đó và ghi vào Kafka.",
      why: "WAL vốn đã ghi mọi thay đổi theo đúng thứ tự commit, nên đọc WAL cho độ trễ thấp và không thêm truy vấn quét bảng. Cái giá là hạ tầng: Kafka Connect, slot phải được theo dõi, và quyền đọc replication.",
    },
    {
      t: "**Replication slot giữ WAL** cho tới khi consumer đọc xong. Mặc định `max_slot_wal_keep_size = -1`, slot được giữ WAL không giới hạn (https://www.postgresql.org/docs/current/runtime-config-replication.html).",
      why: "Slot hứa không mất thay đổi nào, nên primary không được xoá WAL mà consumer chưa đọc. Connector CDC dừng vài giờ thì WAL dồn lại tới đầy đĩa và primary dừng ghi. Phải cảnh báo theo độ trễ của slot, hoặc đặt giới hạn và chấp nhận slot bị vô hiệu khi vượt.",
    },
    {
      t: "**At-least-once ở cả hai kiểu relay.** Polling: relay chết sau publish, trước khi đánh dấu đã gửi → gửi lại. CDC: vị trí của slot chỉ được lưu bền ở checkpoint, nên sau crash slot có thể lùi về LSN cũ và **gửi lại** thay đổi gần đây; tài liệu PostgreSQL nói client phải tự chịu trách nhiệm xử lý trùng.",
      why: "Mọi relay đều có khe hở giữa \"đã gửi\" và \"đã ghi nhận là đã gửi\", giống khe hở commit offset của Kafka consumer. Vì vậy consumer dedupe theo `id` của event (bảng `processed_events` hoặc upsert). Xem topic Idempotency.",
    },
    {
      t: "**CDC thẳng bảng nghiệp vụ, không qua outbox**: nhanh để làm (không sửa code), hợp cho việc đồng bộ nội bộ như cập nhật search index hay data warehouse. Nhưng schema bảng nội bộ thành **hợp đồng** với mọi consumer.",
      why: "Đổi tên một cột trong bảng `orders` sẽ làm vỡ consumer ở service khác, vì họ đọc trực tiếp hình dạng dòng. Outbox tách hai thứ: bảng nghiệp vụ đổi thoải mái, còn `payload` của event là hợp đồng được thiết kế và đánh version riêng. Event outbox còn mang ý nghĩa nghiệp vụ (`OrderPaid`) thay vì chỉ \"dòng này đổi cột status\".",
    },
    {
      t: "**Dọn outbox**: polling thì xoá hoặc đánh dấu sau khi gửi rồi dọn định kỳ. Với CDC, có thể xoá dòng ngay sau khi insert: extension outbox của Debezium cho Quarkus có tuỳ chọn `remove-after-insert` (mặc định `true`) và nói việc xoá không cản connector phát event CDC (https://debezium.io/documentation/reference/stable/integrations/outbox.html). Outbox Event Router chỉ xử lý `INSERT` và bỏ qua `DELETE`.",
      why: "CDC đọc log chứ không đọc bảng, nên dòng chỉ cần tồn tại trong log. Với polling thì ngược lại: relay đọc bảng, xoá trước khi gửi là mất event.",
    },
    {
      t: "**Outbox là nền của nhiều pattern khác**: saga choreography cần phát event tin cậy sau mỗi bước; CQRS cập nhật read model; invalidate cache và cập nhật Elasticsearch đều là consumer của cùng luồng event.",
      why: "Mọi pattern \"service A đổi dữ liệu, nơi khác phải biết\" đều gặp dual write. Giải một lần ở outbox thì mọi consumer phía sau thừa hưởng: không mất event, thứ tự theo aggregate, và chỉ cần dedupe.",
    },
  ],
  tips: [
    {
      t: "Khi bạn vẽ \"service ghi DB rồi bắn event vào Kafka\", tự hỏi luôn: \"crash giữa hai bước thì sao?\" rồi trả lời bằng outbox. Interviewer rất hay hỏi câu này.",
      why: "Dual write là lỗi phổ biến nhất trong sơ đồ event-driven, vì nó chạy đúng gần như mọi lúc và chỉ hỏng khi crash đúng khe hở. Nêu nó trước cho thấy bạn nghĩ về failure mode chứ không chỉ happy path.",
    },
    {
      t: "Nói rõ chọn relay nào: polling cho hệ nhỏ, ít hạ tầng; CDC (Debezium) khi đã có Kafka Connect và cần độ trễ thấp.",
      why: "Không có đáp án đúng duy nhất; interviewer muốn nghe bạn cân tải lên DB, độ trễ và chi phí vận hành.",
    },
    "Trong bài Local Business Search, News Feed, Payment System, Ticket Booking: dùng outbox/CDC để cập nhật search index, fan-out feed và phát event thanh toán.",
  ],
  cards: [
    [
      "Vì sao \"ghi DB rồi publish trong `finally`\" vẫn mất event?",
      "`finally` chạy trong chính process đó. Process chết (OOM, kill, mất điện) sau commit thì `finally` không chạy. Thông tin \"cần publish\" chỉ nằm trong RAM.",
    ],
    [
      "Outbox giải bài gì mà CDC thẳng bảng nghiệp vụ không giải?",
      "Tách hợp đồng: payload event được thiết kế riêng, bảng nội bộ đổi schema không làm vỡ consumer. Event mang ý nghĩa nghiệp vụ thay vì chỉ \"dòng thay đổi\".",
    ],
    [
      "Relay crash sau khi publish nhưng trước khi đánh dấu đã gửi. Chuyện gì xảy ra?",
      "Lần sau relay gửi lại event đó: trùng, không mất. Consumer dedupe theo `id` của event.",
    ],
    [
      "Làm sao giữ thứ tự event của cùng một đơn hàng?",
      "Dùng `aggregateid` (order id) làm message key: mọi event của đơn vào cùng partition, giữ thứ tự ghi trong outbox.",
    ],
    [
      "Connector CDC dừng 6 tiếng thì DB bị gì?",
      "Replication slot giữ WAL chưa đọc, WAL dồn lại có thể làm đầy đĩa primary (mặc định giữ không giới hạn). Cần cảnh báo độ trễ của slot hoặc đặt `max_slot_wal_keep_size`.",
    ],
  ],
  related: ["saga", "cache-write", "kafka-delivery"],
});
