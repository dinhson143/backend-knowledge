BK.topic({
  id: "api-design",
  track: "sd",
  section: "sd-core",
  title: "API Design",
  tldr: {
    t: "REST là mặc định. GraphQL khi nhiều loại client cần dữ liệu khác nhau. RPC (gRPC) cho service-to-service cần hiệu năng, type safety, streaming.",
    why: "REST là mặc định an toàn, vì nó tận dụng HTTP nên CDN, browser, cache đều hiểu sẵn. GraphQL đáng giá khi mỗi client cần shape dữ liệu khác nhau, vì client tự chọn field trong một request; gRPC đáng giá khi bạn kiểm soát cả hai đầu và cần tốc độ, type safety, streaming.",
  },
  story: {
    problem: "Đổi API sau khi app mobile đã phát hành là làm hỏng các bản đang chạy trên máy người dùng, vì API là hợp đồng giữa client và server. API thiết kế tuỳ tiện còn gây lỗ hổng (lấy `userId` từ body), retry gây thanh toán trùng, hoặc trang sau của feed bị lặp item.",
    idea: "Chọn kiểu API theo người dùng của nó (public client → REST, nhiều client khác nhau → GraphQL, service nội bộ → gRPC), rồi áp các quy ước có sẵn: resource + HTTP method, status code chuẩn, pagination, versioning, idempotency. Quy ước chuẩn giúp client đoán được hành vi và hạ tầng (cache, proxy) hiểu được request.",
    tradeoff: "Không kiểu nào tốt mọi mặt: REST đơn giản nhưng hay fetch thừa/thiếu, GraphQL linh hoạt nhưng khó cache và dễ N+1, gRPC nhanh nhưng khó dùng từ browser. Thêm idempotency, rate limit, versioning cũng là thêm state và code phải duy trì.",
  },
  table: {
    head: ["Kiểu", "Chọn khi", "Điểm yếu"],
    rows: [
      {
        cells: ["REST", "Mặc định cho public / client-facing API", "Over-/under-fetching, nhiều round-trip"],
        why: "GET cache được ở CDN/browser và ai cũng gọi được bằng `curl`, vì REST dựa trên URL và method chuẩn của HTTP. Nhưng mỗi endpoint trả shape cố định: màn hình cần 3 field vẫn nhận 30 (over-fetching), cần dữ liệu từ 3 resource thì phải gọi 3 lần (under-fetching).",
      },
      {
        cells: [
          "GraphQL",
          "Nhiều client (web, mobile) cần shape dữ liệu khác nhau",
          "N+1 query, caching khó, phức tạp phía server",
        ],
        why: "Mobile lấy ít, web lấy nhiều mà không phải tạo endpoint riêng cho từng loại, vì client gửi query mô tả đúng field cần. Cache HTTP theo URL không dùng được, vì mọi query thường đi qua một `POST /graphql`; và mỗi field được resolve riêng nên dễ sinh N+1 query xuống DB.",
      },
      {
        cells: [
          "RPC / gRPC",
          "Service-to-service, cần performance, type safety, streaming",
          "Khó debug bằng tay, browser hỗ trợ kém",
        ],
        why: "Call nhanh nhờ payload nhị phân Protobuf và HTTP/2 multiplex; client sinh từ schema nên sai kiểu bị bắt lúc compile. Nhưng payload nhị phân không đọc được bằng mắt, và browser không kiểm soát được HTTP/2 frame/trailer nên cần proxy gRPC-Web.",
      },
    ],
  },
  points: [
    {
      t: "**REST bước 1 · Resource Modeling** — xác định resource (danh từ số nhiều): `/events`, `/events/{id}/bookings`.",
      why: "Đặt URL theo danh từ thay vì động từ (`/events` chứ không phải `/getEvents`) để hành động nằm ở HTTP method → cùng một URL dùng cho đọc, tạo, xoá. Lồng `/events/{id}/bookings` thể hiện quan hệ cha–con, client đọc URL là hiểu phạm vi dữ liệu.",
    },
    {
      t: "**REST bước 2 · HTTP Methods** — GET, POST, PUT, PATCH, DELETE.",
      why: "Mỗi method có ngữ nghĩa mà hạ tầng dựa vào: GET an toàn nên cache và prefetch được, PUT/DELETE idempotent nên retry không gây hại, POST thì không. Dùng sai (ví dụ GET để xoá) thì crawler hoặc prefetch của browser có thể vô tình xoá dữ liệu.",
    },
    {
      t: "**REST bước 3 · Passing Data** — path param `/events/123` (định danh), query param `/events?city=NYC&date=2024-01-01` (lọc), request body (dữ liệu tạo/sửa).",
      why: "Path định danh **một** resource nên thiếu là 404; query param là tuỳ chọn để lọc nên có thể bỏ và kết hợp tự do; body chứa dữ liệu lớn, có cấu trúc mà URL không nên mang (URL bị log lại và có giới hạn độ dài).",
    },
    {
      t: "**REST bước 4 · Returning Data** — status code + response body.",
      why: "Status code cho client và hạ tầng biết kết quả mà không cần parse body: 5xx (nhất là 503) là lỗi tạm thời nên retry được, nhưng với POST chỉ an toàn khi có idempotency key; 4xx phần lớn không retry vì gửi lại vẫn sai, trừ 408 và 429 (429 và 503 thường kèm `Retry-After` cho biết chờ bao lâu) — RFC 9110 §15: https://www.rfc-editor.org/rfc/rfc9110#section-15, RFC 6585 §4. Trả `200` kèm `{\"error\": ...}` làm hỏng retry logic, monitoring và cache.",
    },
    {
      t: "**GraphQL · N+1 problem** — GraphQL không biết trước client chọn field nào nên không JOIN sẵn được như REST. Giải pháp: **DataLoader** gom các `venue_id` trong vài ms thành một query `WHERE id IN (...)`.",
      why: "GraphQL dễ sinh 1 + 50 query, vì nó resolve từng field độc lập: lấy 50 event rồi resolver `venue` chạy 50 lần. REST endpoint thì biết trước dữ liệu cần trả nên viết sẵn một câu JOIN. DataLoader hoãn các lần gọi trong cùng một tick, gom 50 `venue_id` thành một `WHERE id IN (...)` → còn 2 query.",
    },
    {
      t: "**RPC** — binary serialization + HTTP/2 nhanh hơn JSON REST đáng kể; generated client tránh lỗi runtime; hỗ trợ bidirectional streaming.",
      why: "Payload nhỏ và không phải parse text, vì Protobuf không gửi tên field, chỉ gửi số tag và giá trị nhị phân; HTTP/2 chạy nhiều call song song trên một kết nối. Client generate từ `.proto` → gọi sai tên hàm hay sai kiểu là lỗi compile, không đợi tới production.",
    },
    {
      t: "**Pagination** — offset-based (`?offset=20&limit=10`) đơn giản nhưng chậm khi offset lớn và lệch khi dữ liệu chèn thêm; cursor-based (`?cursor=<id>&limit=10`) ổn định, hợp infinite scroll.",
      why: "Offset càng về sau càng chậm, vì `OFFSET 10000` buộc DB đọc rồi bỏ 10000 dòng trước khi trả 10 dòng; có item mới chèn vào đầu thì mọi item bị đẩy xuống một vị trí và trang sau lặp lại item cũ. Cursor dùng `WHERE id < :cursor LIMIT 10` nên đi thẳng vào index, và vị trí neo theo item chứ không theo số thứ tự → dữ liệu mới không làm lệch.",
    },
    {
      t: "**Versioning** — URL versioning `/v1/events` (phổ biến, dễ thấy) hoặc header tự đặt (ví dụ `X-API-Version: 2`) hay media type (`Accept: application/vnd.example.v2+json`) — không có header chuẩn riêng cho version.",
      why: "Thay đổi phá vỡ phải ra version mới để hai bản chạy song song, vì client cũ (app mobile chưa update) vẫn gọi API cũ. Version trên URL hiện rõ trong log và dễ route ở gateway; version trong header giữ URL sạch nhưng khó thấy, khó test bằng trình duyệt.",
    },
    {
      t: "**Security · AuthN/AuthZ** — API Key cho service nội bộ / developer bên ngoài; JWT cho session (web: **HttpOnly cookie** + SameSite chống CSRF; mobile: Keychain/Keystore); RBAC để phân quyền.",
      why: "API key là chuỗi bí mật dài hạn gắn với một ứng dụng, hợp cho máy gọi máy. JWT chứa claim có chữ ký nên server verify không cần tra DB; để trong HttpOnly cookie thì JavaScript không đọc được → XSS không lấy cắp được token (nhưng cần chống CSRF). RBAC gán quyền theo role thay vì từng user nên dễ quản lý khi có hàng nghìn user.",
    },
    {
      t: "**Security · Rate limiting** — theo user, theo IP, theo endpoint.",
      why: "Mỗi chiều chặn một kiểu lạm dụng: theo user chặn tài khoản spam, theo IP chặn bot chưa đăng nhập, theo endpoint bảo vệ API đắt (search, login) khỏi bị dội. Thiếu rate limit thì một client lỗi vòng lặp retry cũng đủ làm sập service cho mọi người.",
    },
    {
      t: "+ **Idempotency** — POST tạo đơn/thanh toán nên nhận `Idempotency-Key` để retry an toàn.",
      why: "Retry có thể trừ tiền hai lần, vì khi request timeout client không biết server đã tạo đơn hay chưa. Server lưu `Idempotency-Key` kèm kết quả lần đầu; request trùng key thì trả lại kết quả cũ thay vì thực hiện lại.",
    },
    {
      t: "+ Status code cần nhớ: 200, 201 Created, 204, 400, 401 (chưa xác thực), 403 (không có quyền), 404, 409 Conflict, 429 Too Many Requests, 500, 503.",
      why: "Mỗi mã dẫn tới hành vi khác ở client: 401 thì đăng nhập lại, 403 thì đăng nhập lại cũng vô ích, 409 báo xung đột (vé đã bị đặt), 429 bảo chờ rồi thử lại, 503 là lỗi tạm thời nên retry được. Dùng đúng mã → client và LB tự xử lý được mà không cần đọc message.",
    },
  ],
  tips: [
    {
      t: "Không đưa `userId` vào body/path cho hành động của chính user — lấy từ token.",
      why: "Lấy user id từ token thì client không có cách nào giả mạo, vì token đã được server ký và verify. Giá trị trong body/path do client tự gửi — đổi thành id người khác là truy cập dữ liệu của họ (lỗ hổng IDOR).",
    },
    {
      t: "Nói rõ vì sao chọn cursor pagination khi feed có dữ liệu mới liên tục.",
      why: "Feed có item mới liên tục chính là trường hợp offset bị lệch và lặp item → giải thích lý do cho interviewer thấy bạn hiểu cơ chế chứ không thuộc lòng. Kèm trade-off: cursor không nhảy thẳng tới trang 50 được.",
    },
  ],
  cards: [
    [
      "GraphQL N+1 problem là gì và giải thế nào?",
      "Mỗi resolver con gọi DB riêng → 1 query cha + N query con. Giải bằng DataLoader: batch + cache các key trong một tick rồi chạy 1 query `WHERE id IN (...)`.",
    ],
    [
      "Offset vs cursor pagination?",
      "Offset: đơn giản, nhảy trang được, nhưng chậm ở offset lớn và trùng/sót khi dữ liệu thay đổi. Cursor: ổn định, nhanh nhờ index, hợp feed/infinite scroll; không nhảy trang tuỳ ý.",
    ],
    [
      "Khi nào chọn gRPC thay REST?",
      "Service-to-service nội bộ, cần hiệu năng (binary + HTTP/2), type safety qua generated client, hoặc cần streaming 2 chiều.",
    ],
    [
      "Lưu JWT ở đâu trên web? Vì sao?",
      "HttpOnly (+ Secure, SameSite) cookie — JavaScript không đọc được nên giảm rủi ro XSS đánh cắp token.",
    ],
  ],
});
