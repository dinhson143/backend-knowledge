BK.topic({
  id: "net-url-to-page",
  track: "cs",
  section: "cs-net",
  title: "Gõ URL thì chuyện gì xảy ra",
  goal: "Kể đủ các bước từ DNS tới render và bước nào tốn thời gian",
  needs: ["networking"],
  tldr: {
    t: "Trình duyệt **phân giải DNS** ra IP → mở **TCP** (1 RTT) → bắt tay **TLS** (TLS 1.3: thêm 1 RTT, TLS 1.2: 2 RTT) → gửi **HTTP GET** → server (qua CDN, load balancer, app, cache, DB) trả HTML → trình duyệt **parse** HTML thành DOM, CSS thành CSSOM, chạy JS → **layout** → **paint** → **composite**. Trước byte đầu tiên, phần lớn thời gian là các vòng mạng; sau đó là CSS và JS chặn render.",
    why: "Mỗi bước phụ thuộc kết quả bước trước: chưa có IP thì không mở được kết nối, chưa bắt tay xong thì không gửi được request mã hoá, chưa có CSS thì chưa vẽ được. Vì vậy độ trễ cộng dồn theo số vòng mạng (RTT) chứ không theo băng thông, và các tối ưu đều nhắm vào bớt vòng (cache DNS, giữ kết nối, TLS 1.3, CDN gần user) hoặc bớt thứ chặn render.",
  },
  story: {
    problem: "Câu hỏi mở kinh điển để xem bạn hiểu hệ thống tới đâu. Trả lời một dòng (\"DNS rồi HTTP\") thì nông; kể lan man mọi tầng OSI thì hết giờ mà không cho thấy bạn biết bước nào quan trọng.",
    idea: "Kể theo **dòng thời gian** của một request, mỗi bước nói nó làm gì, tốn bao nhiêu vòng mạng, và cache nào giúp bỏ qua nó. Sau đó hỏi interviewer muốn đào sâu phía mạng, phía server hay phía trình duyệt.",
    tradeoff: "Không thể kể sâu mọi tầng trong 5 phút. Chọn độ sâu theo vị trí phỏng vấn: backend đào sâu đoạn từ load balancer tới DB; frontend đào sâu critical rendering path; SRE/network đào sâu DNS, TCP, TLS.",
  },
  diagrams: [
    {
      src: "content/svg/net-url-to-page-rtt.svg",
      caption: "Chưa tính DNS, kết nối HTTPS mới cần 3 RTT tới byte HTML đầu tiên với TCP + TLS 1.3, 4 RTT với TLS 1.2, 2 RTT với QUIC (gộp bắt tay transport và TLS 1.3), 1 RTT với QUIC 0-RTT khi đã từng kết nối. Sau đó trình duyệt dựng DOM và CSSOM, render tree, layout, paint, composite.",
      source: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work",
    },
  ],
  table: {
    head: ["Bước", "Chuyện gì xảy ra", "Tốn gì", "Bỏ qua/giảm nhờ"],
    rows: [
      {
        cells: ["1 · Phân tích URL", "Tách scheme, host, path; có thể nâng `http` lên `https` nếu domain từng gửi HSTS", "Không tốn mạng", "—"],
        why: "HSTS (`Strict-Transport-Security`) cho trình duyệt nhớ domain chỉ dùng HTTPS; RFC 6797 §8.3 yêu cầu trình duyệt tự thay scheme thành `https` cho domain đó (https://www.rfc-editor.org/rfc/rfc6797#section-8.3), nên lần sau trình duyệt đổi sang `https` mà không cần một vòng redirect `301` từ server.",
      },
      {
        cells: ["2 · DNS", "Hỏi cache trình duyệt → OS → resolver; resolver chưa có thì hỏi dần các name server, đi theo referral từ root xuống tới server giữ zone của domain", "0 RTT nếu có cache; nhiều RTT nếu phải hỏi đủ chuỗi", "TTL của record, cache ở mọi tầng"],
        why: "Mỗi hostname khác nhau trên trang cần một lần phân giải riêng; lần đầu có thể chậm, nhất là trên mạng di động, còn sau đó IP thường đã được cache (https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work). Bản ghi mang TTL (RFC 1035) quyết định cache được bao lâu: TTL dài thì nhanh nhưng đổi IP chậm có hiệu lực. RFC 1034 mô tả hai chế độ: client hỏi resolver ở chế độ recursive và chỉ nhận đáp án hoặc lỗi; còn name server trả lời non-recursive bằng đáp án hoặc **referral** tới server \"gần đáp án hơn\", nên resolver phải đi qua nhiều server, mỗi bước một vòng mạng (https://www.rfc-editor.org/rfc/rfc1034).",
      },
      {
        cells: ["3 · TCP", "Bắt tay 3 bước SYN, SYN-ACK, ACK", "1 RTT", "Giữ kết nối (keep-alive), HTTP/2 dùng chung một kết nối"],
        why: "Hai bên phải thống nhất số thứ tự ban đầu trước khi gửi dữ liệu tin cậy, nên request đầu tiên luôn chờ ít nhất một vòng. Tái dùng kết nối đã mở cho các request sau là cách bỏ hẳn chi phí này.",
      },
      {
        cells: ["4 · TLS", "Thống nhất thuật toán, xác thực chứng chỉ server, tạo khoá phiên", "TLS 1.3: 1 RTT; TLS 1.2: 2 RTT", "TLS 1.3, resumption, HTTP/3 (QUIC)"],
        why: "MDN: kết nối mới cộng bắt tay TLS đầy đủ tốn 2 vòng (TLS 1.3) hoặc 3 vòng (TLS 1.2) trước khi gửi được request. QUIC gộp thương lượng transport và mật mã vào một handshake tích hợp TLS 1.3, và có tuỳ chọn 0-RTT khi đã từng kết nối (https://www.rfc-editor.org/rfc/rfc9000). 0-RTT có thể bị replay, nên chỉ dùng cho request an toàn khi bị gửi lại.",
      },
      {
        cells: ["5 · HTTP request → server", "GET qua CDN, load balancer, API gateway tới app; app đọc cache, DB rồi render hoặc trả dữ liệu", "Thời gian xử lý ở server + các lời gọi nội bộ", "CDN cache, cache ở app, index DB"],
        why: "Đây là đoạn backend kiểm soát và là chỗ interviewer backend muốn nghe: cache ở edge có thể trả lời mà không tới origin; load balancer chọn instance; app có thể gọi nhiều service và DB, mỗi lời gọi cộng thêm latency. Xem các topic Load Balancer, API Gateway & CDN và Caching.",
      },
      {
        cells: ["6 · Response", "Byte đầu tiên về trình duyệt (TTFB); HTML về dần theo từng gói", "TTFB = mạng + xử lý ở server", "Nén, streaming HTML, gói nội dung quan trọng sớm"],
        why: "TCP slow start chỉ cho gửi một lượng nhỏ ở vòng đầu rồi tăng dần (cửa sổ gần như gấp đôi mỗi vòng), nên MDN khuyên đưa đủ thứ cần để bắt đầu render vào khoảng 14KB đầu. Trang lớn tốn thêm vòng chỉ để gửi hết HTML.",
      },
      {
        cells: ["7 · Parse & tải tài nguyên", "HTML → DOM; preload scanner tải sớm CSS, JS, font; CSS → CSSOM", "Thêm request cho mỗi tài nguyên", "`async`/`defer`, preload, ít tài nguyên chặn render"],
        why: "`<script>` không có `async` hay `defer` dừng việc parse HTML cho tới khi tải và chạy xong, vì script có thể sửa DOM. CSS không chặn parse HTML nhưng chặn chạy JavaScript và chặn render, vì JS có thể hỏi style và trình duyệt không vẽ khi chưa biết style.",
      },
      {
        cells: ["8 · Render", "DOM + CSSOM → render tree → layout (vị trí, kích thước) → paint (pixel) → composite (ghép layer)", "CPU/GPU ở máy user", "Đặt kích thước ảnh, tránh reflow, JS nhỏ"],
        why: "Layout phải tính lại (reflow) khi kích thước thay đổi, ví dụ ảnh không khai báo kích thước tải về muộn. Để cuộn và animation mượt, việc trên main thread phải xong trong khoảng 16.67ms mỗi khung hình; JS chạy lâu chiếm main thread làm trang hiện ra mà không bấm được.",
      },
    ],
  },
  points: [
    {
      t: "**Đếm theo RTT.** Kết nối HTTPS mới đầu tiên tới một host: DNS (0 tới vài RTT) + TCP (1) + TLS 1.3 (1) + request/response (1) ≈ **3 RTT trở lên** trước byte HTML đầu tiên. Với RTT 100ms (user ở xa server), đó đã là 300ms chưa tính thời gian server xử lý.",
      why: "Băng thông tăng không làm các vòng này ngắn đi, vì mỗi vòng bị giới hạn bởi tốc độ ánh sáng trên khoảng cách tới server. Vì vậy hai tối ưu hiệu quả nhất là **bớt vòng** (tái dùng kết nối, TLS 1.3, QUIC) và **rút ngắn vòng** (CDN, edge gần user).",
    },
    {
      t: "**Cache ở mọi tầng cắt bớt bước**: cache DNS bỏ bước 2; kết nối còn mở bỏ bước 3–4; HTTP cache của trình duyệt (`Cache-Control`, `ETag`) bỏ cả request hoặc chỉ hỏi \"có đổi không\"; CDN trả lời từ edge mà không tới origin.",
      why: "Lần tải thứ hai thường nhanh hơn hẳn lần đầu chính vì các cache này. Khi phỏng vấn, phân biệt rõ \"lần đầu\" và \"lần sau\" cho thấy bạn hiểu mỗi cache bỏ qua bước nào.",
    },
    {
      t: "**Phía server là phần backend sở hữu**: DNS có thể trả IP của CDN hoặc load balancer; LB kết thúc TLS và chuyển tới app; app đọc cache, DB, gọi service khác; response có thể được cache ở CDN cho lần sau.",
      why: "Interviewer backend thường hỏi tiếp \"request tới server rồi thì sao\" để chuyển sang System Design. Nối được câu chuyện này với LB, cache, DB, replica là cầu sang các topic Giai đoạn 1–2.",
    },
    {
      t: "**HTTP/1.1, HTTP/2, HTTP/3** ảnh hưởng tới bước 3–7: HTTP/1.1 vướng head-of-line blocking ở tầng ứng dụng nên client mở nhiều kết nối song song; HTTP/2 xen kẽ nhiều request trên một kết nối TCP nhưng **không** giải head-of-line blocking của TCP (https://www.rfc-editor.org/rfc/rfc9113); HTTP/3 chạy trên QUIC, có multiplexing và flow control theo từng stream, tin cậy theo stream (https://www.rfc-editor.org/rfc/rfc9114).",
      why: "Trang hiện đại tải hàng chục tới hàng trăm tài nguyên. Số kết nối và cách chúng chia sẻ một đường truyền quyết định các tài nguyên đó chờ nhau tới đâu. RFC 9114 giải thích: trên TCP, một gói mất hoặc đến sai thứ tự làm **mọi** request đang chạy trên kết nối đều phải chờ, dù gói đó chỉ thuộc một request; QUIC khôi phục theo từng stream nên tránh được điều này.",
    },
  ],
  tips: [
    {
      t: "Mở đầu bằng khung 30 giây theo dòng thời gian (DNS → TCP → TLS → HTTP → server → render), rồi hỏi: \"Anh/chị muốn tôi đào sâu phần mạng, phần server hay phần trình duyệt?\"",
      why: "Câu hỏi này mở rộng vô hạn; interviewer muốn xem bạn biết sắp xếp và chọn trọng tâm. Khung trước, chi tiết sau giúp bạn không sa vào một tầng rồi hết giờ.",
    },
    {
      t: "Gắn con số cho mỗi bước (số RTT, 14KB đầu, 16.67ms mỗi khung hình) và nói cache nào bỏ được bước đó.",
      why: "Con số biến câu chuyện kể thành phân tích hiệu năng: interviewer thấy bạn biết bước nào đáng tối ưu, không chỉ thuộc tên các bước.",
    },
  ],
  cards: [
    [
      "Kết nối HTTPS mới tốn bao nhiêu RTT trước khi có byte HTML đầu tiên?",
      "Khoảng 3 RTT (TCP 1 + TLS 1.3 1 + request/response 1), cộng thời gian DNS nếu chưa cache và thời gian server xử lý. TLS 1.2 tốn thêm 1 RTT.",
    ],
    [
      "Vì sao `<script>` không có `async`/`defer` làm trang chậm hiện?",
      "Nó dừng parse HTML tới khi tải và chạy xong, vì script có thể sửa DOM. `defer` chạy theo thứ tự sau khi parse xong; `async` chạy ngay khi tải xong, không giữ thứ tự.",
    ],
    [
      "Đổi IP của domain nhưng một số user vẫn vào IP cũ. Vì sao?",
      "Bản ghi DNS cũ còn trong cache (trình duyệt, OS, resolver) cho tới khi hết TTL. Hạ TTL trước khi đổi IP.",
    ],
    [
      "Lần tải thứ hai nhanh hơn lần đầu nhờ những gì?",
      "Cache DNS, kết nối TCP/TLS còn mở hoặc resumption, HTTP cache của trình duyệt (Cache-Control, ETag), CDN đã có bản cache.",
    ],
    [
      "HTTP/3 khác HTTP/2 ở chỗ nào liên quan tới bước bắt tay?",
      "HTTP/3 chạy trên QUIC, gộp handshake transport và TLS 1.3 làm một, có tuỳ chọn 0-RTT khi đã từng kết nối; mất gói ở một stream không chặn stream khác.",
    ],
    [
      "Layout và paint khác nhau thế nào? Reflow là gì?",
      "Layout tính vị trí, kích thước từng phần tử; paint tô pixel; composite ghép các layer. Reflow là layout tính lại khi kích thước đổi, kéo theo repaint.",
    ],
  ],
  related: ["lb", "realtime"],
});
