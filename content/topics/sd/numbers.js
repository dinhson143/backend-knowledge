BK.topic({
  id: "numbers",
  track: "sd",
  section: "sd-core",
  title: "Con số cần nhớ",
  tldr: {
    t: "+ Dùng để ước lượng nhanh có cần shard/cache hay không. Nhánh này không có trên Miro — bổ sung vì Hello Interview coi là core concept.",
    why: "Thuộc năng lực một node thì một phép chia là ra câu trả lời, vì quyết định shard hay cache chỉ là so sánh tải ước lượng với năng lực đó. Ví dụ 100M request/ngày ≈ 1.2k req/s, nằm gọn trong sức một Postgres.",
  },
  story: {
    problem: "Không có con số trong đầu thì ước lượng toàn cảm tính: thấy 「1 triệu user」 là vội shard DB, thêm Kafka và cache, thiết kế phức tạp gấp mấy lần cần thiết.",
    idea: "Thuộc vài con số bậc độ lớn (throughput mỗi thành phần, latency mỗi tầng lưu trữ, số giây trong ngày) là biết ngay cần bao nhiêu máy: chia tải ước lượng cho năng lực một node.",
    tradeoff: "Con số chỉ đúng bậc độ lớn và phụ thuộc phần cứng, kích thước bản ghi, độ phức tạp query — dùng để ra quyết định thô, không thay cho benchmark thật.",
  },
  table: {
    head: ["Thành phần", "Con số tham khảo"],
    rows: [
      {
        cells: ["Redis (1 node)", "~100k+ ops/s, latency < 1ms, RAM tới hàng trăm GB"],
        why: "Redis giữ toàn bộ dữ liệu trong RAM và xử lý lệnh trên một luồng chính bằng event loop → không tốn chi phí lock, mỗi lệnh chỉ là thao tác cấu trúc dữ liệu trong bộ nhớ. Vì thế latency chủ yếu là round-trip mạng, còn dung lượng bị giới hạn bởi RAM của máy.",
      },
      {
        cells: ["PostgreSQL / MySQL (1 node tốt)", "~10k–50k TPS đơn giản, lưu được vài TB"],
        why: "Chậm hơn Redis 1–2 bậc, vì mỗi transaction phải ghi WAL xuống disk (fsync) để bền vững, giữ lock và cập nhật index. Dữ liệu nằm trên disk nên chứa được vài TB, nhưng khi working set vượt RAM thì nhiều lần đọc phải xuống disk và throughput giảm.",
      },
      {
        cells: ["Kafka (1 broker)", "~hàng trăm MB/s mỗi broker; cluster scale theo số broker và partition"],
        why: "Throughput gần bằng băng thông disk/mạng, vì Kafka chỉ append tuần tự vào log trên disk, dựa vào page cache của OS và zero-copy (`sendfile`) để đẩy byte từ disk ra mạng không qua user space, cộng batching nhiều message một lần. Scale bằng cách thêm partition và broker.",
      },
      {
        cells: ["App server", "~vài nghìn đến chục nghìn concurrent request"],
        why: "Server dùng async/event loop hoặc nhiều thread giữ được hàng nghìn request đang chờ cùng lúc, vì phần lớn thời gian của một request là chờ I/O (DB, service khác). Giới hạn thực tế đến từ RAM mỗi kết nối và CPU cho phần xử lý thật.",
      },
      {
        cells: ["Đọc RAM / SSD / mạng cùng DC", "~100ns / ~100µs / ~0.5ms"],
        why: "Cache in-process thắng Redis khi cần cực nhanh, và gọi mạng tuần tự 100 lần đã mất 50ms. Lý do: RAM local ~100ns, đọc SSD ngẫu nhiên ~100µs, round-trip mạng tới Redis ~500µs — tức gọi Redis chậm hơn đọc RAM local khoảng 5,000 lần, thậm chí chậm hơn một lần đọc SSD.",
      },
      {
        cells: ["1 ngày", "~86,400 giây ≈ 10⁵ → 1M req/ngày ≈ 12 req/s"],
        why: "Chia số request mỗi ngày cho 10⁵ là ra QPS trung bình, vì 86,400 xấp xỉ 10⁵: 10⁶ / 86,400 ≈ 11.6, làm tròn 12. Nhớ nhân thêm 2–10 lần cho giờ cao điểm vì traffic không trải đều cả ngày.",
      },
    ],
  },
  points: [
    {
      t: "+ Đừng shard khi 1 Postgres còn chịu được — phần cứng hiện đại mạnh hơn trực giác nhiều.",
      why: "Phần lớn hệ thống thực tế chưa cần shard: một Postgres với SSD và RAM lớn chịu được hàng chục nghìn TPS và vài TB, mà tải thực tế thường thấp hơn thế nhiều. Shard sớm là trả ngay chi phí cross-shard query, migration và vận hành mà không được gì; dùng read replica và cache trước thường đủ.",
    },
  ],
  cards: [
    [
      "1 triệu request/ngày tương đương bao nhiêu request/giây?",
      "≈ 12 req/s (1M / 86,400). 100M/ngày ≈ 1,200 req/s.",
    ],
  ],
});
