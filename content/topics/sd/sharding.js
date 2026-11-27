BK.topic({
  id: "sharding",
  track: "sd",
  section: "sd-core",
  title: "Sharding & Partitioning",
  tldr: {
    t: "Partitioning chia dữ liệu trong một máy; sharding chia ra nhiều máy. Hash-based là mặc định. Shard key phải khớp access pattern chính.",
    why: "Chỉ sharding mới phá được giới hạn một máy; partitioning giảm kích thước mỗi bảng/index nhưng vẫn nằm trong giới hạn đó. **Hash** là mặc định vì trải key đều mà không cần hiểu dữ liệu. Shard key phải khớp access pattern: query có shard key trong điều kiện thì đi thẳng tới 1 shard, query thiếu nó phải hỏi tất cả shard.",
  },
  story: {
    problem: "Mua máy to hơn đến lúc cũng hết đường hoặc quá đắt, vì một DB node có giới hạn cứng về disk (vài TB), RAM cho index và throughput ghi (vài chục nghìn TPS). Dữ liệu hoặc lượng ghi vượt mức đó là chạm trần.",
    idea: "Dung lượng và throughput ghi tăng gần tuyến tính theo số máy: chia dữ liệu theo một shard key thành nhiều phần độc lập, mỗi phần nằm trên một máy.",
    tradeoff: "Query hoặc transaction cần dữ liệu từ nhiều shard trở nên chậm và phức tạp (scatter-gather, 2PC). Chọn sai shard key gây hot spot, và đổi shard key về sau là một cuộc migration lớn.",
  },
  table: {
    head: ["Chiến lược", "Cách chia", "Ưu", "Nhược"],
    rows: [
      {
        cells: [
          "Hash-based (mặc định)",
          "`hash(user_id) % N`",
          "Phân bố đều",
          "Range query khó; đổi N phải di chuyển nhiều dữ liệu (→ consistent hashing)",
        ],
        why: "Tải đều vì hàm hash xáo trộn đầu vào, các user_id liền nhau rơi vào shard khác nhau. Cũng vì xáo trộn mà một khoảng ID liên tục bị rải khắp các shard → range query phải hỏi tất cả; và vì shard phụ thuộc `% N`, đổi N từ 4 lên 5 làm khoảng 80% key đổi chỗ.",
      },
      {
        cells: [
          "Range-based",
          "Theo khoảng giá trị (ID, chữ cái, thời gian)",
          "Range query nhanh",
          "Dễ hot spot (dữ liệu mới dồn vào shard cuối)",
        ],
        why: "Range query (ví dụ đơn hàng tháng 10) chỉ chạm 1–2 shard, vì các key liền nhau nằm chung shard. Nhưng với key tăng dần như timestamp hay auto-increment ID, mọi bản ghi mới đều rơi vào shard chứa khoảng cuối → shard đó nhận gần 100% lượt ghi.",
      },
      {
        cells: [
          "Directory-based",
          "Bảng lookup trung tâm: key → shard",
          "Linh hoạt, di chuyển từng key được",
          "Directory là SPOF và thêm 1 bước tra cứu",
        ],
        why: "Chuyển một key sang shard khác chỉ cần sửa một dòng, vì vị trí mỗi key ghi rõ trong bảng tra cứu thay vì tính từ công thức. Đổi lại mọi request phải hỏi directory trước → directory chết là cả hệ không biết dữ liệu ở đâu (thường giảm thiểu bằng replicate và cache directory).",
      },
    ],
  },
  points: [
    {
      t: "**Horizontal partitioning** — giữ nguyên cột, chia dòng ra các phân vùng theo điều kiện.",
      why: "Mỗi phân vùng chỉ chứa một phần các dòng, nên index và lượng dữ liệu phải quét nhỏ đi; query có điều kiện trên partition key được partition pruning bỏ qua các phân vùng không liên quan. Đây cũng là nền của sharding: mỗi phân vùng đặt được lên một máy.",
    },
    {
      t: "**Vertical partitioning** — giữ nguyên số dòng, tách cột ra bảng khác theo tần suất truy cập / kích thước.",
      why: "Tách cột lớn/ít dùng ra bảng riêng thì bảng chính gọn, vừa RAM hơn, query thường nhanh hơn. Lý do: DB đọc theo page chứa cả dòng, cột lớn ít dùng (bio, ảnh, JSON) làm mỗi page chứa ít dòng hơn, query cột nóng phải đọc nhiều page hơn.",
    },
    {
      t: "**Challenges** — hot spot & load imbalance, cross-shard operations, giữ consistency.",
      why: "Sau khi chia, mỗi shard là một DB độc lập: tải không còn tự cân bằng, JOIN hay transaction qua hai shard cần phối hợp qua mạng (scatter-gather, 2PC), và không còn transaction ACID cục bộ nào bao trùm toàn bộ dữ liệu để giữ ràng buộc.",
    },
    {
      t: "**Giải hot spot** — tách shard động (dynamic splitting), compound shard key, cô lập hot key sang shard riêng.",
      why: "Hot spot sinh ra khi một khoảng key hoặc một key nhận tải quá lớn: dynamic splitting chia khoảng nóng thành hai shard; compound key (ví dụ `user_id + bucket`) trải dữ liệu của một key nóng ra nhiều shard; cô lập hot key thì cho nó một máy riêng để không kéo chậm các key khác.",
    },
    {
      t: "! Hash function **không ngẫu nhiên** — cùng input luôn ra cùng output; chỉ là phân bố trông như đều.",
      why: "Router biết chính xác dữ liệu nằm đâu mà không cần tra cứu, vì hash là hàm tất định: cùng `user_id` luôn ra cùng shard. Phân bố đều chỉ là thống kê trên nhiều key khác nhau — một key nhận nhiều traffic thì hash cũng không chia nhỏ được tải của key đó.",
    },
    {
      t: "+ Cross-shard query/transaction đắt: tránh bằng shard key khiến query phổ biến chỉ chạm 1 shard.",
      why: "Query thiếu shard key phải gửi tới mọi shard rồi gộp kết quả → latency bằng shard chậm nhất, tải nhân N lần; transaction qua nhiều shard cần 2PC với nhiều round-trip và lock. App mà phần lớn query là 「dữ liệu của user X」 thì chọn `user_id` làm shard key → gần như query nào cũng chỉ chạm 1 shard.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/sharding-range-vs-hash.svg",
      caption: "Range-based giữ key gần nhau trên cùng shard nên query theo khoảng chỉ chạm một shard, nhưng key tăng dần dồn mọi ghi mới vào shard cuối; hash-based rải đều ghi nhưng query theo khoảng phải hỏi mọi shard.",
      source: "https://www.mongodb.com/docs/manual/sharding/#sharding-strategy",
    },
  ],
  cards: [
    ["Horizontal vs vertical partitioning?", "Horizontal: chia dòng, giữ cột. Vertical: chia cột, giữ dòng."],
    [
      "3 chiến lược sharding và nhược điểm chính?",
      "Hash: khó range query, resharding đắt. Range: hot spot. Directory: lookup table là SPOF + thêm độ trễ.",
    ],
    [
      "Cách xử lý hot spot khi sharding?",
      "Dynamic shard splitting, compound shard key, isolate hot key sang shard riêng, key salting.",
    ],
  ],
});
