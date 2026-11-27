BK.topic({
  id: "id-generation",
  track: "sd",
  section: "sd-core",
  title: "Distributed ID Generation",
  goal: "Chọn UUIDv7, Snowflake hay dải ID theo yêu cầu sắp xếp và shard",
  needs: ["sharding", "indexing"],
  tldr: {
    t: "**Distributed ID generation** (sinh id duy nhất không cần điểm trung tâm): khi dữ liệu nằm trên nhiều shard, `AUTO_INCREMENT` của một database không còn đủ. Ba lựa chọn chính: **UUIDv7** (128 bit, timestamp ở đầu, không cần phối hợp), **Snowflake** (64 bit = timestamp + machine id + sequence), **dải ID** (một service cấp trước từng khối số cho mỗi node).",
    why: "Id phải duy nhất **toàn hệ thống** mà mỗi node vẫn tự sinh được, vì hỏi một máy trung tâm cho mỗi lần ghi thì máy đó thành SPOF và điểm nghẽn. Đặt timestamp ở các bit đầu làm id gần như tăng theo thời gian, nên ghi vào B-Tree luôn rơi về cuối index thay vì rải ngẫu nhiên khắp cây.",
  },
  story: {
    problem: "Bảng `orders` tách ra 16 shard. Mỗi shard tự `AUTO_INCREMENT` từ 1, nên shard 3 và shard 7 cùng có đơn số 1001: id không còn trỏ được tới đúng một đơn, và link `/orders/1001` không biết lấy ở đâu. Chuyển sang UUIDv4 thì hết trùng, nhưng index của PK phình to và ghi chậm dần vì mỗi id mới rơi vào một page ngẫu nhiên.",
    idea: "Cấu trúc id sao cho tính duy nhất đến từ **chính cấu trúc**, không phải từ phối hợp: phần đầu là thời gian (để id tăng dần), phần giữa phân biệt máy sinh (machine id) hoặc là số ngẫu nhiên đủ dài, phần cuối là bộ đếm trong cùng mili giây.",
    tradeoff: "Id theo thời gian để lộ thời điểm tạo, và chỉ \"gần như\" có thứ tự giữa các máy (đồng hồ lệch nhau). Snowflake cần quản lý machine id và sợ đồng hồ chạy lùi. UUID không cần gì nhưng dài 128 bit, to gấp đôi `bigint` ở mọi index và mọi khoá ngoại.",
  },
  table: {
    head: ["Cách", "Kích thước", "Có thứ tự?", "Cần phối hợp", "Hợp khi"],
    rows: [
      {
        cells: ["`AUTO_INCREMENT` / sequence một DB", "64 bit", "Tăng dần (có lỗ hổng)", "Một DB duy nhất", "Chưa shard; đơn giản nhất"],
        why: "Sequence của PostgreSQL không trả lại số khi transaction rollback, để các transaction đồng thời khỏi chờ nhau, nên dãy luôn có lỗ hổng và không dùng được cho số \"liên tục không thiếu\" như số hoá đơn (https://www.postgresql.org/docs/current/functions-sequence.html).",
      },
      {
        cells: ["Bước nhảy theo node (`offset + N × increment`)", "64 bit", "Không theo thời gian giữa các node", "Cấu hình tĩnh", "Vài node cố định (MySQL circular replication)"],
        why: "MySQL có `auto_increment_increment` và `auto_increment_offset`: server A sinh 1, 3, 5…, server B sinh 2, 4, 6… (https://dev.mysql.com/doc/refman/8.4/en/replication-options-source.html). Thêm node thứ ba thì phải đổi cấu hình mọi node, nên không hợp với số shard thay đổi.",
      },
      {
        cells: ["UUIDv4", "128 bit", "Không", "Không", "Id công khai không được đoán; ít ghi"],
        why: "122 bit ngẫu nhiên nên trùng là không đáng kể và không đoán được id kế tiếp. RFC 9562 nói UUID không theo thời gian có \"database-index locality kém\": id mới chèn vào vị trí ngẫu nhiên trong B-Tree, làm tách page và phải giữ cả cây trong cache (https://www.rfc-editor.org/rfc/rfc9562).",
      },
      {
        cells: ["UUIDv7", "128 bit", "Theo mili giây", "Không", "Mặc định tốt cho PK khi cần sinh ở nhiều nơi"],
        why: "48 bit đầu là Unix timestamp mili giây, phần còn lại là version, variant và 74 bit ngẫu nhiên (hoặc một phần làm bộ đếm). RFC 9562 (5/2024) khuyên dùng v7 thay cho v1, v6. PostgreSQL 18 có sẵn hàm `uuidv7()` (https://www.postgresql.org/docs/18/functions-uuid.html).",
      },
      {
        cells: ["Snowflake", "64 bit", "Theo mili giây (k-sorted)", "Cấp machine id", "Cần id nhỏ, vừa `bigint`, sinh rất nhanh"],
        why: "Bản gốc: 41 bit thời gian mili giây (khoảng 69 năm tính từ epoch riêng), 10 bit machine id (1024 máy), 12 bit sequence (4096 id mỗi mili giây mỗi máy) (https://github.com/twitter-archive/snowflake/tree/snowflake-2010). Vừa `bigint` có dấu nên index nhỏ bằng nửa UUID.",
      },
      {
        cells: ["Dải ID (range / ticket server)", "64 bit", "Gần tăng dần", "Service cấp dải, gọi mỗi lần hết dải", "Cần id ngắn, liên tục hơn; ví dụ short URL"],
        why: "Node xin một khối (ví dụ 1.000 số) bằng một lần ghi atomic vào kho trung tâm, rồi cấp trong bộ nhớ. Kho trung tâm chỉ bị gọi một lần mỗi 1.000 id nên không thành điểm nghẽn; node chết thì phần còn lại của khối bị bỏ, tạo lỗ hổng.",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao id có thứ tự thời gian ghi nhanh hơn**: B-Tree giữ key đã sắp. Id tăng dần luôn chèn vào page cuối cùng, page đó nóng trong cache. Id ngẫu nhiên chèn vào bất kỳ page nào, nên page phải nằm trong RAM hoặc đọc từ đĩa, và page đầy thì phải tách. RFC 9562 ghi chênh lệch hiệu năng có thể từ một bậc độ lớn trở lên.",
      why: "Với bảng lớn hơn RAM, mỗi insert UUIDv4 có thể phải đọc một page ngẫu nhiên từ đĩa trước khi ghi. Id tăng dần thì vùng \"đang ghi\" của index chỉ là vài page cuối, luôn có trong cache. InnoDB còn lưu cả dòng theo thứ tự PK (clustered index), nên PK ngẫu nhiên làm rải cả dữ liệu bảng, không chỉ index.",
    },
    {
      t: "**Snowflake tin vào đồng hồ**: bản gốc khuyên chạy NTP và **từ chối sinh id** khi đồng hồ chạy lùi, cho tới khi thời gian vượt mốc của id cuối cùng đã sinh.",
      why: "Nếu đồng hồ lùi 5ms mà vẫn sinh id, máy có thể ghép lại đúng timestamp + sequence đã dùng, ra id trùng. Chờ đồng hồ vượt qua mốc cũ giữ được tính duy nhất, đổi lại máy đứng hình trong khoảng lùi đó.",
    },
    {
      t: "**Machine id phải duy nhất tại mọi thời điểm**: cấp từ cấu hình, từ ordinal của StatefulSet, hoặc thuê (lease) từ một kho nhất quán như ZooKeeper/etcd. Hai process cùng machine id sinh trong cùng mili giây là trùng id.",
      why: "Cấu trúc Snowflake chỉ đảm bảo duy nhất **nếu** cặp (timestamp, machine id, sequence) duy nhất. Autoscaling tạo pod mới liên tục nên phải có cơ chế cấp và thu hồi machine id; dùng lease có thời hạn để pod chết thì id được trả lại.",
    },
    {
      t: "**Hết sequence trong một mili giây** (Snowflake: quá 4096 id/ms trên một máy): generator phải chờ sang mili giây kế tiếp. UUIDv7 dùng một trong ba cách của RFC 9562 §6.2 để giữ thứ tự trong cùng mili giây: bộ đếm cố định trong `rand_a`, tăng `rand_b` một lượng ngẫu nhiên, hoặc dùng thêm bit đồng hồ dưới mili giây.",
      why: "Không có bộ đếm thì hai id cùng mili giây chỉ phân biệt bằng phần ngẫu nhiên, vẫn duy nhất nhưng thứ tự giữa chúng là ngẫu nhiên. Phần lớn hệ thống chỉ cần \"gần như có thứ tự\", nhưng nếu dùng id làm con trỏ phân trang thì thứ tự trong cùng mili giây phải ổn định.",
    },
    {
      t: "**Id có thứ tự theo thời gian chỉ là k-sorted giữa các máy**: hai máy lệch đồng hồ 20ms thì id của máy chạy nhanh lớn hơn dù sinh sau. Bản gốc của Snowflake hứa sai lệch trong 1 giây, nhắm tới vài chục mili giây.",
      why: "Đừng dùng id để suy ra \"sự kiện nào xảy ra trước\" xuyên nhiều máy; muốn thứ tự chính xác thì cần một nguồn thứ tự duy nhất (một partition Kafka, một sequence) hoặc đồng hồ logic. Để sắp feed hay phân trang, sai lệch vài chục mili giây không ai thấy.",
    },
    {
      t: "**Nhúng shard vào id**: dành vài bit của id cho shard id (thay machine id) thì nhìn id là biết dòng ở shard nào, không cần tra bảng định tuyến.",
      why: "Định tuyến bằng id chỉ cần phép dịch bit, nhanh và không có trạng thái. Đổi lại, dòng gắn chặt với shard sinh ra nó: muốn chia lại shard thì phải dùng shard **logic** (nhiều shard logic trên một máy vật lý) để di chuyển cả shard logic chứ không đổi id.",
    },
    {
      t: "**Id công khai và id nội bộ**: id lộ ra URL mà tăng dần thì người ngoài đếm được số đơn mỗi ngày và thử id kế tiếp. RFC 9562 §8 khuyên dùng UUIDv4 cho mục đích nhạy cảm về bảo mật.",
      why: "UUIDv7 và Snowflake để lộ thời điểm tạo và tốc độ tăng. Nếu đó là thông tin kinh doanh nhạy cảm, dùng PK nội bộ có thứ tự để ghi nhanh, và một id công khai ngẫu nhiên riêng cho URL. Dù id khó đoán cỡ nào cũng vẫn phải kiểm quyền trên từng tài nguyên.",
    },
  ],
  tips: [
    {
      t: "Khi bài có shard, nói ngay \"id sinh bằng UUIDv7 (hoặc Snowflake), không dùng auto-increment\", và giải thích một câu vì sao có timestamp ở đầu.",
      why: "Interviewer hay hỏi tiếp \"vì sao không UUIDv4\"; trả lời được chuyện B-Tree locality cho thấy bạn nghĩ tới chi phí ghi, không chỉ tính duy nhất.",
    },
    {
      t: "Bài URL Shortener: id ngắn sinh từ dải ID hoặc bộ đếm rồi mã hoá base62, không phải hash URL rồi cắt ngắn.",
      why: "Hash rồi cắt ngắn sinh va chạm và phải kiểm tra lặp lại. Bộ đếm cấp theo dải đảm bảo duy nhất ngay từ đầu; muốn khó đoán thì xáo bit trước khi mã hoá.",
    },
    "Chọn nhanh: một DB → sequence; nhiều nơi sinh, chấp nhận 128 bit → UUIDv7; cần 64 bit và throughput rất cao → Snowflake; cần id ngắn → dải ID + base62.",
  ],
  cards: [
    [
      "Vì sao UUIDv4 làm PK chậm hơn UUIDv7 trên bảng lớn?",
      "UUIDv4 ngẫu nhiên nên mỗi insert rơi vào một page bất kỳ của B-Tree (đọc đĩa, tách page). UUIDv7 có timestamp ở 48 bit đầu nên insert dồn vào cuối index, các page nóng luôn nằm trong cache.",
    ],
    [
      "Cấu trúc 64 bit của Snowflake gốc?",
      "41 bit thời gian mili giây (khoảng 69 năm) + 10 bit machine id (1024 máy) + 12 bit sequence (4096 id/ms/máy) = 63 bit, vừa một số nguyên 64 bit.",
    ],
    [
      "Đồng hồ máy sinh Snowflake chạy lùi 10ms. Chuyện gì xảy ra?",
      "Nếu vẫn sinh, có thể lặp lại timestamp + sequence cũ → trùng id. Bản gốc từ chối sinh id cho tới khi đồng hồ vượt mốc id cuối cùng.",
    ],
    [
      "Vì sao sequence của PostgreSQL có lỗ hổng?",
      "`nextval` không trả số lại khi transaction rollback (để không bắt các transaction khác chờ). Abort, crash hay `INSERT … ON CONFLICT` đều làm mất số.",
    ],
    [
      "Id tăng dần lộ ra URL thì có vấn đề gì?",
      "Người ngoài đếm được số bản ghi theo thời gian và thử id kế tiếp. Dùng id công khai ngẫu nhiên riêng, và luôn kiểm quyền trên tài nguyên.",
    ],
  ],
});
