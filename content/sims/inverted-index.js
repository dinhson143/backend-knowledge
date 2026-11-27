BK.sim({
  id: "inverted-index",
  title: "Xây inverted index",
  topics: ["search"],
  scenario: "Hai document qua tokenizer và stemmer để thành index tra cứu được.",
  context: "**Inverted index** là map từ term → danh sách document chứa term đó (posting list), ngược với cách lưu thông thường document → nội dung. Hai document đi qua pipeline phân tích văn bản (analyzer): **Tokenizer** tách câu thành token, **Stemmer** đưa các biến thể của từ về cùng một gốc. Theo dõi dòng chữ dưới Inverted Index: các posting list được xây dần, và ở bước cuối một lần tra là ra kết quả.",
  nodes: [
    { id: "d1", x: 90, y: 65, label: "doc1", s: "\"Running fast\"" },
    { id: "d2", x: 90, y: 225, label: "doc2", s: "\"He runs daily\"" },
    { id: "tok", x: 300, y: 145, label: "Tokenizer" },
    { id: "stem", x: 490, y: 145, label: "Stemmer" },
    { id: "idx", x: 690, y: 145, label: "Inverted Index", w: 150, s: "(trống)" },
  ],
  steps: [
    {
      note: "**Tokenize**: tách câu thành từ, chuyển chữ thường.",
      msgs: [{ par: [["d1", "tok", "Running fast"], ["d2", "tok", "He runs daily"]] }],
      set: { tok: "running · fast · he · runs · daily" },
      detail: "Tokenizer biến hai chuỗi `Running fast` và `He runs daily` thành 5 token: `running · fast · he · runs · daily`. Nó tách theo khoảng trắng và dấu câu, rồi chuyển hết về chữ thường. Chuyển chữ thường để `Running` và `running` được coi là một từ; bỏ bước này thì user gõ chữ thường sẽ không tìm thấy từ viết hoa đầu câu.",
    },
    {
      note: "**Stem**: đưa về gốc — running, runs → `run`; bỏ stop word `he`.",
      msgs: [["tok", "stem", "tokens"]],
      set: { stem: "run · fast · run · daily" },
      detail: "`running` và `runs` giờ là **cùng một term** `run`; còn lại `run · fast · run · daily`. Trước đó `he` bị bỏ vì là **stop word** (quá phổ biến, không giúp phân biệt document) — trong Elasticsearch/Lucene bước này do stop filter riêng đảm nhận, sim gộp vào Stemmer cho gọn. Stemmer cắt hậu tố theo luật: `running` → `run`, `runs` → `run`. Lưu ý stemmer thật như Porter có thể ra gốc không phải từ thật (`daily` → `daili`); không sao vì query cũng đi qua đúng stemmer đó.",
    },
    {
      note: "Ghi vào index: từ → danh sách document.",
      msgs: [["stem", "idx", "postings", "ok"]],
      set: { idx: "run → [doc1, doc2]\nfast → [doc1]\ndaily → [doc2]" },
      detail: "Mỗi term được ghi vào posting list kèm ID document chứa nó: `run → [doc1, doc2]`, `fast → [doc1]`, `daily → [doc2]`. Posting list giữ **đã sắp xếp theo doc ID**, nên phép AND giữa nhiều term chỉ là trộn hai danh sách đã sort. Index thật còn lưu tần suất và vị trí của term trong document để chấm điểm (BM25) và hỗ trợ tìm theo cụm từ.",
    },
    {
      note: "Search `running` → stem thành `run` → tra index một lần → doc1, doc2, không quét toàn bộ.",
      msgs: [["stem", "idx", "lookup run"], ["idx", "stem", "[doc1, doc2]", "ok"]],
      good: ["idx"],
      lesson: "Inverted index biến full-text search thành phép tra từ điển term (term dictionary).",
      detail: "Tìm `running` trả ngay `[doc1, doc2]`, kể cả doc2 vốn chỉ chứa `runs`. Query phải đi qua **đúng analyzer** đã dùng lúc index — lowercase rồi stem thành `run` — nếu không `running` sẽ không khớp term nào. Index tra `run` một lần (như tra hash map/term dictionary). Chi phí tìm kiếm phụ thuộc độ dài posting list, không phụ thuộc tổng số document; so với `LIKE '%running%'` phải quét từng dòng, đây là khác biệt giữa vài ms và vài phút trên hàng tỷ document.",
    },
  ],
});
