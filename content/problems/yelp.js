BK.problem({
  id: "yelp",
  level: 1,
  title: "Local Business Search (Yelp)",
  hi: "yelp",
  summary: "Tìm quán theo vị trí + từ khoá trong < 500ms; review mỗi người một lần, rating trung bình luôn đúng.",
  topics: ["search", "indexing", "patterns"],
  fr: [
    "Tìm business theo vị trí, bán kính, tên, category",
    "Xem chi tiết business và review",
    "Viết review 1–5 sao (mỗi user một review/business)",
  ],
  nfr: [
    {
      t: "Search < 500ms",
      why: "Chậm là user mở app khác, vì họ tìm quán khi đang ở ngoài đường. Yêu cầu này đòi geo index + text index trong một engine, không tính khoảng cách tới mọi business.",
    },
    {
      t: "100M DAU, 10M business",
      why: "Bài toán là throughput chứ không phải dung lượng: 100M DAU tạo tải đọc lớn, nhưng 10M business chỉ vài chục GB. Hệ quả: nhân bản index search (replica) thay vì shard sâu.",
    },
    {
      t: "Đọc gấp nhiều lần ghi",
      why: "Dữ liệu đồng bộ sang ES với độ trễ ngắn là đủ, vì business và review ít đổi so với lượng search. Nhờ đó index ổn định và cache hiệu quả.",
    },
    {
      t: "Rating trung bình hiển thị đúng",
      why: "Rating phải phản ánh đúng mọi review, vì rating sai làm mất tin tưởng của cả user lẫn chủ business. Hệ quả: cập nhật `sum`/`count` trong cùng transaction với ghi review.",
    },
  ],
  capacity: "10M business × vài KB ≈ vài chục GB — vừa một search cluster nhỏ; thách thức là query kết hợp vị trí + text.",
  entities: ["Business", "Review", "User", "Location"],
  api: [
    "GET /businesses/search?lat&lng&radius&q&category",
    "GET /businesses/{id}",
    "POST /businesses/{id}/reviews { rating, text }",
  ],
  hldWhy: "**Search Service** dùng **Elasticsearch** với `geo_point` + inverted index, vì search cần kết hợp vị trí, text và filter trong một query — Postgres làm được từng phần nhưng khó kết hợp nhanh. **Business Service** + **Postgres** giữ dữ liệu gốc (business, review, rating) vì ghi review và cập nhật rating cần transaction. Tách search và business vì đọc gấp nhiều lần ghi: scale search độc lập không ảnh hưởng luồng ghi. Không cần sharding phức tạp: 10M business × vài KB ≈ vài chục GB, vừa một search cluster nhỏ.",
  hld: {
    id: "hld-yelp",
    title: "HLD — Local Business Search",
    h: 330,
    scenario: "Search đi vào Elasticsearch (geo + text); review ghi vào Postgres và đồng bộ sang ES qua CDC.",
    context: "**Search Service** đẩy mọi truy vấn tìm kiếm sang **Elasticsearch**, nơi mỗi business được index với `geo_point` (toạ độ) và các trường text. **Business Service** ghi review vào **Postgres** — nguồn sự thật, có transaction và unique constraint. Thay đổi trong Postgres đồng bộ sang ES qua **CDC**. Theo dõi dòng chữ dưới Postgres và Elasticsearch: rating của business b7 cập nhật ở Postgres trước, ES sau.",
    nodes: [
      { id: "client", x: 80, y: 170, label: "Client" },
      { id: "gw", x: 260, y: 170, label: "API Gateway" },
      { id: "search", x: 460, y: 80, label: "Search Service" },
      { id: "biz", x: 460, y: 260, label: "Business Service", w: 150 },
      { id: "es", x: 680, y: 80, label: "Elasticsearch", s: "geo_point + text" },
      { id: "pg", x: 680, y: 260, label: "Postgres", s: "b7: 4.31 ★ (1,203)" },
    ],
    links: [["client", "gw"], ["gw", "search"], ["gw", "biz"], ["search", "es"], ["biz", "pg"], ["pg", "es"]],
    variants: [
      {
        name: "Tìm quán gần",
        steps: [
          {
            note: "User tìm “phở” trong bán kính 2km.",
            msgs: [["client", "gw", "GET /search?q=phở&r=2km"], ["gw", "search", "search"]],
            detail: "Search Service nhận `GET /search?q=phở&r=2km` (kèm toạ độ hiện tại) sau khi API Gateway xác thực và rate limit. Search Service không đụng tới Postgres — đường đọc tìm kiếm tách hẳn khỏi đường ghi.",
          },
          {
            note: "Elasticsearch kết hợp **geo_distance filter** + full-text + category trong một query.",
            msgs: [["search", "es", "geo_distance 2km + match phở"], ["es", "search", "48 quán", "ok"]],
            detail: "ES trả **48 quán**, xếp hạng kết hợp độ khớp text, khoảng cách và rating. Search Service gửi một query gồm `geo_distance` filter 2km quanh toạ độ user, `match` “phở” trên tên/mô tả/món, và filter category. ES dùng cấu trúc không gian (BKD tree) cho geo_point nên lọc theo khoảng cách nhanh mà không tính khoảng cách tới mọi quán, và dùng inverted index cho text. Làm tương tự trên Postgres bằng `LIKE '%phở%'` + công thức Haversine sẽ phải quét toàn bảng: wildcard đầu làm B-Tree index vô dụng và công thức Haversine phải tính trên mọi dòng (index trigram `pg_trgm` giúp được phần text nhưng không xếp hạng độ liên quan).",
          },
          {
            note: "Trả danh sách kèm rating đã tính sẵn.",
            msgs: [["search", "client", "200 · 20 kết quả", "ok"]],
            lesson: "Một search engine xử lý cả vị trí lẫn text; tránh `LIKE` + tính khoảng cách trên Postgres.",
            detail: "Search Service trả trang đầu **20 kết quả**, mỗi quán kèm rating trung bình và số review đã tính sẵn, lưu ngay trong document ES. Không phải join sang bảng review hay tính `AVG()` lúc query. Ảnh, giờ mở cửa… cũng nằm sẵn trong document → một lần gọi ES đủ dựng trang.",
          },
        ],
      },
      {
        name: "Viết review",
        steps: [
          {
            note: "User đánh giá 5 sao.",
            msgs: [["client", "gw", "POST /businesses/7/reviews"], ["gw", "biz", "createReview"]],
            detail: "User gửi review 5 sao cho business 7 qua `POST /businesses/7/reviews`; gateway chuyển cho Business Service. Đường ghi đi vào Postgres vì cần transaction và ràng buộc toàn vẹn — thứ ES không đảm bảo.",
          },
          {
            note: "Mỗi user một review/business nhờ **unique constraint** (user_id, business_id).",
            msgs: [["biz", "pg", "INSERT review"], ["pg", "biz", "ok", "ok"]],
            detail: "Business Service `INSERT` review vào bảng `reviews`, có **unique constraint** trên `(user_id, business_id)`. DB kiểm constraint qua unique index ngay lúc insert → hai request đến cùng lúc thì chỉ một dòng được tạo. Insert thành công nghĩa là đây là review đầu tiên của user cho quán này.",
          },
          {
            note: "Trong **cùng transaction**: `sum_rating + 5`, `num_reviews + 1` → avg mới, không quét lại review cũ.",
            msgs: [["biz", "pg", "UPDATE sum=sum+5, n=n+1"]],
            set: { pg: "b7: 4.32 ★ (1,204)" },
            detail: "Rating của b7 thành **4.32 ★ (1,204)** nhờ một `UPDATE` cộng dồn trong **cùng transaction** với insert: `UPDATE businesses SET sum_rating = sum_rating + 5, num_reviews = num_reviews + 1`. Rating trung bình = `sum_rating / num_reviews`, tính trong O(1) thay vì `AVG()` quét lại 1,203 review cũ. `UPDATE ... = x + 5` atomic ở mức dòng (row lock) → hai review đồng thời không ghi đè nhau; transaction rollback thì cả review lẫn tổng đều không đổi — không bao giờ lệch. Lưu ý với 1,203 review, một review 5 sao chỉ đẩy trung bình lên khoảng 0.0006; con số nhảy từ 4.31 lên 4.32 chỉ vì giá trị hiển thị đã làm tròn (trung bình cũ thực tế khoảng 4.3145).",
          },
          {
            note: "Đồng bộ sang Elasticsearch qua **CDC** để search thấy rating mới.",
            msgs: [["pg", "es", "CDC", "warn"]],
            set: { es: "b7 rating 4.32" },
            lesson: "Lưu tổng + số lượng để cập nhật avg O(1); unique constraint chặn review trùng.",
            detail: "Document b7 trong ES lên rating 4.32 qua **CDC**: thay đổi ghi vào WAL của Postgres, công cụ CDC (ví dụ Debezium) đọc WAL, đẩy event qua Kafka và cập nhật ES. Dùng CDC thay vì để Business Service tự ghi cả Postgres lẫn ES (**dual write**): dual write có thể thành công một nửa khi crash giữa chừng, hai nơi lệch vĩnh viễn; CDC đọc đúng những gì đã commit. Cái giá là ES trễ vài giây (eventual consistency) — mũi tên màu vàng — chấp nhận được với rating.",
          },
        ],
      },
      {
        name: "Review trùng",
        steps: [
          {
            note: "User gửi review thứ hai cho cùng quán (hoặc bấm hai lần).",
            msgs: [
              ["client", "gw", "POST /businesses/7/reviews"],
              ["gw", "biz", "createReview"],
              ["biz", "pg", "INSERT review"],
              ["pg", "biz", "unique violation", "err"],
              ["biz", "client", "409 đã review", "err"],
            ],
            lesson: "Ràng buộc ở DB chứ không chỉ ở code — chống race khi request đến cùng lúc.",
            detail: "Business Service trả **409 Conflict** “đã review” khi user gửi review lần hai cho quán 7 (hoặc bấm nút hai lần, hai request đến gần như đồng thời). `INSERT` chạy, Postgres phát hiện `(user_id, business_id)` đã tồn tại và trả **unique violation**; Business Service map lỗi này thành 409. Nếu chỉ kiểm bằng code (`SELECT` xem có chưa rồi mới `INSERT`), hai request đồng thời đều thấy “chưa có” và đều insert — lỗi **check-then-act**. Constraint ở DB là chốt chặn duy nhất không bị race, và transaction rollback nên `sum_rating` cũng không bị cộng sai.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Search theo vị trí nhanh?",
      bad: "Tính khoảng cách tới mọi business.",
      good: "PostGIS hoặc geohash index trong Postgres.",
      great: "Elasticsearch geo_point kết hợp text + filter trong một query (hoặc Quadtree/Geohash); dữ liệu ít đổi nên index ổn định.",
      why: {
        bad: "Mỗi search quét toàn bộ dữ liệu, mất hàng giây ở 100M DAU, vì phải tính khoảng cách tới 10M business cho mỗi query.",
        good: "Geohash/PostGIS index chỉ xét business trong vùng lân cận nên nhanh hơn nhiều. Nhưng kết hợp với full-text search và filter (loại hình, giá, rating) trong Postgres khó tối ưu — query planner thường chỉ dùng tốt được một index.",
        great: "Một query lọc theo khoảng cách, khớp text và filter cùng lúc rồi ranking, vì Elasticsearch giữ `geo_point` và inverted index trong cùng document. Dữ liệu business ít đổi nên index không phải rebuild liên tục, cache hiệu quả.",
      },
    },
    {
      q: "Rating trung bình?",
      bad: "AVG() trên toàn bộ review mỗi lần xem.",
      good: "Cron tính lại định kỳ.",
      great: "Cập nhật sum/count trong transaction khi ghi review bằng `UPDATE … SET sum = sum + ?, n = n + 1` — atomic, không cần lock riêng.",
      why: {
        bad: "Mỗi lượt xem trang tốn một query nặng với business có hàng chục nghìn review, vì `AVG()` đọc toàn bộ review của business mỗi lần xem.",
        good: "Cron tính trước nên lúc xem chỉ đọc một số. Nhưng rating trễ tới một chu kỳ cron: user vừa viết review không thấy rating đổi — vi phạm yêu cầu hiển thị đúng.",
        great: "Rating luôn đúng ngay sau khi ghi, đọc chỉ là `sum/count`, vì `sum` và `count` cập nhật trong cùng transaction với insert review. Dùng `UPDATE ... SET sum = sum + ?, count = count + 1` atomic thì hai review đồng thời không làm mất cập nhật.",
      },
    },
    {
      q: "Tìm theo tên thành phố / quận?",
      bad: "So khớp chuỗi tên địa điểm.",
      good: "Bảng location có polygon.",
      great: "ES geo_shape với polygon thành phố/quận, kết hợp filter trong cùng query.",
      why: {
        bad: "So khớp chuỗi bỏ sót business, vì tên địa điểm không chuẩn hoá (\"Q1\", \"Quận 1\", \"District 1\"); chuỗi cũng không cho biết ranh giới địa lý thật.",
        good: "Polygon định nghĩa đúng ranh giới thành phố/quận nên kiểm tra point-in-polygon chính xác. Nhưng polygon nằm ở Postgres còn search ở ES thì phải query hai hệ rồi giao kết quả.",
        great: "Lọc theo quận và khớp text chạy trong một request, vì ES `geo_shape` lưu polygon và filter point-in-polygon ngay trong query search. Hết bước giao kết quả giữa hai hệ.",
      },
    },
  ],
  sims: ["inverted-index"],
});
