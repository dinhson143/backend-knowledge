BK.topic({
  id: "search",
  track: "sd",
  section: "sd-tech",
  title: "Full-text Search",
  goal: "Thêm tìm kiếm full-text bằng inverted index thay cho `LIKE '%x%'`",
  needs: ["indexing"],
  tldr: {
    t: "Elasticsearch / OpenSearch dùng inverted index + tokenization + stemming để full-text search; không dùng `LIKE '%x%'` trên DB chính.",
    why: "Inverted index tìm document chứa một từ bằng một lần tra cứu thay vì quét mọi dòng; tokenization và stemming quyết định 'từ' vào index ở dạng nào để query khớp được. `LIKE '%x%'` không dùng được B-Tree index nên thường full scan trên DB chính; index trigram (`pg_trgm` của PostgreSQL) tăng tốc được kiểu tìm này nhưng vẫn không có stemming hay xếp hạng độ liên quan (https://www.postgresql.org/docs/current/pgtrgm.html).",
  },
  story: {
    problem: "`LIKE '%phone%'` buộc DB scan toàn bảng vì wildcard đầu khiến B-Tree index không dùng được: 100 triệu dòng là vài giây đến vài chục giây, và chạy trên DB chính làm chậm mọi query khác. Nó cũng không biết 'phones' khớp 'phone', không xếp hạng kết quả theo độ liên quan.",
    idea: "Tiền xử lý văn bản lúc ghi: tách từ, chuẩn hoá, rồi xây inverted index từ → danh sách document. Lúc tìm chỉ tra từ khoá trong index → độ phức tạp theo số kết quả chứ không theo kích thước dữ liệu.",
    tradeoff: "Phải duy trì thêm một hệ thống và một pipeline đồng bộ; dữ liệu search trễ hơn DB vài giây. Index tốn thêm storage, không phải nguồn sự thật, không có transaction.",
  },
  points: [
    {
      t: "**Inverted index** — map từ → danh sách document chứa từ đó: `{\"word1\": [doc1, doc2], ...}`.",
      why: "Index kiểu B-Tree sắp theo giá trị cả cột nên chỉ hỗ trợ tìm theo prefix. Inverted index lật ngược quan hệ: từ 'phone' tra ngay ra `[doc1, doc7]`; query nhiều từ chỉ là giao/hợp các posting list đã sắp sẵn.",
    },
    {
      t: "**Tokenization** — tách đoạn văn thành từng từ.",
      why: "Phải chia văn bản thành từ trước khi index, vì inverted index lưu theo từ: 'iPhone 15 Pro Max' → `iphone`, `15`, `pro`, `max`. Query cũng đi qua cùng analyzer, nhờ vậy hai bên khớp nhau.",
    },
    {
      t: "**Stemming** — đưa từ về gốc: “running”, “runs” → “run”.",
      why: "Index 'running' nguyên dạng thì query 'run' không khớp. Đưa cả lúc index lẫn lúc query về gốc 'run' → các biến thể rơi vào cùng một entry, tăng recall mà không cần liệt kê mọi biến thể.",
    },
    {
      t: "**Fuzzy search** — khớp gần đúng, chịu lỗi chính tả (edit distance).",
      why: "User gõ 'iphnoe' thì tra chính xác ra rỗng. Fuzzy query tìm các term trong index cách query ≤ 1–2 phép sửa (thêm/xoá/thay/hoán vị ký tự); term dictionary tổ chức dạng automaton nên không phải so với từng term.",
    },
    {
      t: "**Scaling** — shard index ra nhiều node, có replica.",
      why: "Một node không chứa nổi index TB hay không chịu nổi QPS, nên index chia thành shard trên nhiều node; query fan-out tới các shard rồi gộp top kết quả. Replica vừa là bản dự phòng khi node chết, vừa nhân năng lực đọc.",
    },
    {
      t: "+ Đồng bộ từ DB chính sang search index qua **CDC** (Change Data Capture) → dữ liệu search là eventual consistent.",
      why: "DB chính vẫn là nguồn sự thật; CDC đọc WAL/binlog và đẩy thay đổi sang index, tránh dual-write lệch nhau. Pipeline này bất đồng bộ (cộng refresh interval ~1s của ES), nên vừa ghi xong search chưa thấy ngay, vài giây sau mới đúng.",
    },
  ],
  cards: [
    [
      "Inverted index là gì?",
      "Cấu trúc map mỗi từ đến danh sách document chứa từ đó, giúp full-text search không phải quét toàn bộ.",
    ],
    [
      "Tokenization vs stemming?",
      "Tokenization tách văn bản thành từ; stemming rút từ về gốc để các biến thể khớp nhau.",
    ],
  ],
});
