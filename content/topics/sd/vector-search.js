BK.topic({
  id: "vector-search",
  track: "sd",
  section: "sd-tech",
  title: "Vector Search & ANN",
  goal: "Tìm theo độ tương đồng bằng embedding và chọn index ANN",
  needs: ["search", "indexing"],
  tldr: {
    t: "**Vector search** (tìm theo độ tương đồng): một model biến văn bản, ảnh, sản phẩm thành **embedding** (vector vài trăm tới vài nghìn chiều) sao cho thứ giống nhau về nghĩa nằm gần nhau. Tìm kiếm = tìm k vector gần vector truy vấn nhất (k-NN). Quét hết thì chính xác nhưng chậm; **ANN** (approximate nearest neighbor) như **HNSW**, **IVF** đổi một chút **recall** lấy tốc độ.",
    why: "Full-text search khớp **từ**: \"giày chạy bộ\" không tìm ra \"sneaker running\". Embedding đặt hai cụm đó gần nhau vì model học được chúng cùng nghĩa, nên khoảng cách giữa vector thay cho việc khớp từ. Nhưng không có thứ tự tự nhiên nào trên không gian nhiều chiều như B-Tree có trên số, nên cần cấu trúc index riêng, và cấu trúc nhanh đều là xấp xỉ.",
  },
  story: {
    problem: "Kho 50 triệu tài liệu, user hỏi bằng câu tự nhiên. Full-text search trả về tài liệu chứa đúng từ khoá nhưng bỏ sót tài liệu nói cùng ý bằng từ khác. Tính khoảng cách tới cả 50 triệu vector 768 chiều cho mỗi truy vấn là hàng chục tỷ phép nhân: quá chậm cho một request online.",
    idea: "Lúc ghi: chạy model sinh embedding cho mỗi tài liệu, lưu vector vào index ANN. Lúc đọc: sinh embedding cho câu hỏi (cùng model), hỏi index lấy top-k gần nhất. Index ANN chỉ đi qua một phần nhỏ dữ liệu: HNSW nhảy theo đồ thị nhiều tầng, IVF chỉ quét vài cụm gần nhất.",
    tradeoff: "Kết quả là xấp xỉ: có thể sót vài kết quả gần nhất thật (recall dưới 100%). Index ANN tốn RAM, build chậm, và lọc theo điều kiện (`WHERE tenant_id = ?`) khó hơn nhiều so với index thường. Đổi model embedding nghĩa là sinh lại vector cho toàn bộ dữ liệu.",
  },
  table: {
    head: ["Index", "Cách làm", "Mạnh", "Yếu"],
    rows: [
      {
        cells: ["Flat (brute force)", "So truy vấn với mọi vector", "Chính xác 100%, không cần build", "Chi phí tỉ lệ thuận số vector × số chiều"],
        why: "FAISS gọi đây là `IndexFlatL2`: tìm kiếm chính xác bằng cách so với mọi vector, tốn `4*d` byte mỗi vector (https://github.com/facebookresearch/faiss/wiki/Faiss-indexes). Hợp với vài trăm nghìn vector trở xuống, hoặc sau khi đã lọc còn ít ứng viên.",
      },
      {
        cells: ["HNSW", "Đồ thị nhiều tầng: tầng trên thưa để nhảy xa, tầng dưới dày để tìm chính xác", "Recall cao ở latency thấp; thêm dữ liệu dần được", "Tốn RAM cho các cạnh đồ thị, build chậm"],
        why: "Bài gốc (Malkov & Yashunin) mô tả tìm kiếm bắt đầu từ tầng trên thưa và đi xuống, nên số bước tăng xấp xỉ logarit theo số vector (https://arxiv.org/abs/1603.09320). pgvector: HNSW cho đánh đổi tốc độ–recall tốt hơn IVFFlat nhưng build chậm hơn và tốn bộ nhớ hơn, và tạo được trên bảng rỗng (https://github.com/pgvector/pgvector).",
      },
      {
        cells: ["IVF (inverted file)", "Phân cụm vector (k-means), lúc tìm chỉ quét `probes`/`nprobe` cụm gần nhất", "Build nhanh, ít bộ nhớ", "Recall phụ thuộc số cụm quét; cần dữ liệu trước khi build"],
        why: "Tâm cụm học từ dữ liệu có sẵn, nên pgvector khuyên tạo IVFFlat sau khi bảng đã có dữ liệu; dữ liệu đổi phân bố nhiều thì cụm cũ kém đi. Mặc định `ivfflat.probes = 1`, gợi ý bắt đầu với `lists` = số dòng / 1000 (tới 1 triệu dòng) và `probes` = căn bậc hai của `lists`.",
      },
      {
        cells: ["IVF + PQ (product quantization)", "Nén mỗi vector thành vài byte mã", "Chứa được hàng tỷ vector trong RAM", "Khoảng cách bị xấp xỉ thêm, recall giảm"],
        why: "FAISS `IndexIVFPQ` lưu `ceil(M*nbits/8) + 8` byte mỗi vector thay vì `4*d` byte: vector 768 chiều float32 (3 KB) có thể còn vài chục byte. Thường kết hợp bước xếp hạng lại (re-rank) bằng vector gốc cho top kết quả.",
      },
    ],
  },
  points: [
    {
      t: "**Hàm khoảng cách phải khớp với model**: L2 (Euclid), inner product, cosine. pgvector có toán tử `<->` (L2), `<#>` (inner product âm), `<=>` (cosine distance), `<+>` (L1); index phải tạo với đúng operator class tương ứng (https://github.com/pgvector/pgvector).",
      why: "Model được huấn luyện để một hàm khoảng cách cụ thể có nghĩa; dùng hàm khác thì \"gần\" không còn tương ứng với \"giống nghĩa\". Với vector đã chuẩn hoá độ dài 1, cosine, inner product và L2 cho cùng thứ hạng, nên nhiều hệ thống chuẩn hoá trước rồi dùng inner product cho rẻ.",
    },
    {
      t: "**Recall là thước đo của ANN**: recall@k = tỉ lệ kết quả trong top-k thật (tìm bằng brute force) mà index trả về. Tham số lúc truy vấn đánh đổi recall với latency: `hnsw.ef_search` (pgvector mặc định 40), `ivfflat.probes` (mặc định 1).",
      why: "ANN không báo khi nó bỏ sót, nên phải đo: lấy mẫu truy vấn, chạy brute force làm đáp án, so với ANN. Tăng `ef_search` hay `probes` thì xét thêm ứng viên, recall tăng và chậm hơn; đây là núm vặn chính khi tuning, không cần build lại index.",
    },
    {
      t: "**Tham số build của HNSW**: `m` (số cạnh mỗi node, pgvector mặc định 16) và `ef_construction` (độ rộng tìm kiếm khi chèn, mặc định 64). Tăng hai giá trị này thì đồ thị tốt hơn, recall cao hơn ở cùng `ef_search`, nhưng build chậm hơn và index to hơn.",
      why: "Mỗi node lưu `m` cạnh ở tầng dưới, nên bộ nhớ của index tăng theo `m`. Index HNSW cần nằm trong RAM mới nhanh, vì duyệt đồ thị là đọc ngẫu nhiên; khi tràn ra đĩa, mỗi bước nhảy là một lần đọc đĩa.",
    },
    {
      t: "**Lọc kết hợp vector là phần khó**: `WHERE category = 'shoes' ORDER BY embedding <=> $1 LIMIT 10`. pgvector ghi rõ: với index xấp xỉ, điều kiện `WHERE` áp **sau** khi quét index, nên có thể trả về ít hơn 10 dòng; bản mới có iterative index scan (`hnsw.iterative_scan`) để quét tiếp tới khi đủ.",
      why: "HNSW lấy `ef_search` ứng viên gần nhất rồi mới lọc. Nếu chỉ 1% dữ liệu là `shoes`, 40 ứng viên gần nhất có thể không có đôi giày nào. Cách xử lý: quét lặp, partition/index riêng cho bộ lọc chọn lọc mạnh (mỗi tenant một partition), hoặc lọc trước rồi brute force khi tập còn nhỏ.",
    },
    {
      t: "**Hybrid search**: chạy song song full-text (BM25) và vector search, gộp bằng **Reciprocal Rank Fusion**: điểm mỗi tài liệu = tổng `1/(k + rank)` qua các danh sách, Elasticsearch mặc định `k = 60` (https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion).",
      why: "Vector search giỏi nghĩa nhưng kém với mã sản phẩm, tên riêng, số hiệu (\"lỗi E1234\"); BM25 thì ngược lại. Điểm BM25 và khoảng cách vector khác thang đo nên không cộng trực tiếp được; RRF chỉ dùng thứ hạng nên không cần chỉnh trọng số.",
    },
    {
      t: "**Embedding là dữ liệu dẫn xuất**: lưu kèm tên/phiên bản model. Đổi model thì phải sinh lại toàn bộ vector và build index mới, chạy song song rồi chuyển đọc sang, vì vector của hai model không so được với nhau.",
      why: "Mỗi model có không gian riêng: vector cùng số chiều của hai model khác nhau vẫn không cùng nghĩa. Trộn lẫn trong một index thì kết quả vô nghĩa mà không báo lỗi. Pipeline sinh embedding giống pipeline đồng bộ sang search index: CDC/outbox → worker gọi model → ghi index.",
    },
    {
      t: "**Chọn kho**: pgvector khi dữ liệu đã ở PostgreSQL và cỡ vừa (giữ transaction, join, backup chung); Elasticsearch/OpenSearch khi đã dùng cho full-text và cần hybrid; vector DB chuyên dụng hoặc FAISS khi hàng trăm triệu tới hàng tỷ vector, cần nén và phân tán.",
      why: "Thêm một kho mới là thêm một nơi phải đồng bộ, backup, giám sát. Bắt đầu ở kho đang có thường đủ tới khi số vector hay QPS vượt khả năng một node; pgvector index `vector` tối đa 2.000 chiều (`halfvec` tới 4.000), là một giới hạn cần kiểm khi chọn model.",
    },
  ],
  tips: [
    {
      t: "Trong bài thiết kế có tìm kiếm ngữ nghĩa hoặc RAG, vẽ hai đường: **ingest** (tài liệu → chunk → model embedding → index ANN) và **query** (câu hỏi → embedding → top-k → lọc/re-rank → trả về hoặc đưa vào LLM).",
      why: "Interviewer muốn thấy bạn biết embedding phải sinh bằng cùng model ở hai đầu, và bước sinh embedding là việc tốn tài nguyên nên chạy bất đồng bộ qua queue.",
    },
    {
      t: "Nói rõ \"ANN đổi recall lấy tốc độ, đo recall bằng brute force trên tập mẫu, chỉnh `ef_search`/`probes`\".",
      why: "Một câu này cho thấy bạn hiểu ANN là xấp xỉ và biết cách kiểm soát nó, thay vì coi vector DB là hộp đen luôn đúng.",
    },
    "Gặp yêu cầu lọc theo tenant, quyền xem, ngày: hỏi tỉ lệ dữ liệu còn lại sau lọc, vì nó quyết định lọc trước, lọc sau hay tách index.",
  ],
  cards: [
    [
      "Vì sao không dùng B-Tree cho vector?",
      "B-Tree cần một thứ tự trên key. Vector nhiều chiều không có thứ tự nào giữ được quan hệ \"gần nhau\", nên cần cấu trúc riêng (đồ thị HNSW, cụm IVF).",
    ],
    [
      "HNSW và IVFFlat khác nhau thế nào khi chọn?",
      "HNSW: recall/latency tốt hơn, chèn dần được, nhưng build chậm và tốn RAM. IVFFlat: build nhanh, ít bộ nhớ, cần dữ liệu trước để phân cụm, recall phụ thuộc số cụm quét.",
    ],
    [
      "Recall@10 = 0,9 nghĩa là gì?",
      "Trung bình 9 trong 10 kết quả gần nhất thật (tính bằng brute force) có trong 10 kết quả index trả về.",
    ],
    [
      "Query vector có `WHERE tenant_id = ?` trả về thiếu kết quả. Vì sao?",
      "Index ANN lấy một số ứng viên gần nhất rồi mới lọc; tenant nhỏ thì ứng viên gần như không thuộc tenant. Sửa: iterative scan, partition theo tenant, hoặc lọc trước rồi brute force.",
    ],
    [
      "Khi nào cần hybrid search?",
      "Khi truy vấn có cả ý nghĩa lẫn từ chính xác (mã lỗi, tên sản phẩm). Chạy BM25 và vector song song, gộp bằng RRF theo thứ hạng.",
    ],
    [
      "Đổi sang model embedding mới thì làm gì với dữ liệu cũ?",
      "Sinh lại toàn bộ vector bằng model mới vào index mới, chạy song song, rồi chuyển đọc. Không trộn vector hai model trong một index.",
    ],
  ],
});
