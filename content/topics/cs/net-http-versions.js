BK.topic({
  id: "net-http-versions",
  track: "cs",
  section: "cs-net",
  title: "HTTP/1.1, HTTP/2, HTTP/3",
  goal: "Giải thích multiplexing, head-of-line blocking và vì sao QUIC dùng UDP",
  needs: ["net-tcp-deep"],
  tldr: {
    t: "Ba phiên bản có **cùng ngữ nghĩa** (method, status, header — RFC 9110) và khác nhau ở cách đặt request lên kết nối. **HTTP/1.1**: văn bản, mỗi kết nối xử lý một request tại một thời điểm, nên trình duyệt mở nhiều kết nối. **HTTP/2**: frame nhị phân, nhiều **stream** xen kẽ trên **một kết nối TCP** (multiplexing), nén header bằng HPACK — nhưng một gói TCP mất vẫn chặn mọi stream. **HTTP/3**: chạy trên **QUIC** (trên UDP), mỗi stream được khôi phục độc lập, handshake gộp với TLS 1.3.",
    why: "Head-of-line blocking (HOL — việc đứng đầu hàng chặn mọi việc phía sau) có hai tầng. HTTP/2 gỡ được tầng ứng dụng nhờ multiplexing, nhưng TCP chỉ giao byte đúng thứ tự nên tầng transport vẫn còn: RFC 9113 ghi thẳng \"TCP head-of-line blocking is not addressed by this protocol\" (https://www.rfc-editor.org/rfc/rfc9113#section-1). Muốn gỡ tầng đó phải đổi transport, và đó là QUIC.",
  },
  story: {
    problem: "Trang tải 80 tài nguyên. Với HTTP/1.1, mỗi kết nối phải chờ response trước xong mới gửi request sau, nên trình duyệt mở nhiều kết nối song song, mỗi cái tốn handshake và slow start riêng. Chuyển sang HTTP/2 thì trên mạng tốt nhanh hơn hẳn, nhưng trên mạng di động hay mất gói, một gói rơi làm cả 80 tài nguyên cùng đứng.",
    idea: "Tách \"một request\" khỏi \"một kết nối\": HTTP/2 chia message thành frame gắn stream id để nhiều request dùng chung một kết nối; HTTP/3 đẩy khái niệm stream xuống tầng transport (QUIC) để mất gói ở stream này không chặn stream khác.",
    tradeoff: "HTTP/2 dồn mọi thứ vào một kết nối TCP: ít handshake hơn nhưng nhạy với mất gói hơn, và load balancer L4 chia theo kết nối thì chia không đều. HTTP/3 cần UDP đi qua được mạng; mạng chặn UDP thì client phải quay về TCP, nên server vẫn phải phục vụ cả phiên bản cũ.",
  },
  diagrams: [
    {
      src: "content/svg/net-url-to-page-rtt.svg",
      caption: "Số RTT trước byte HTML đầu tiên: TCP + TLS 1.3 cần 3 RTT, TCP + TLS 1.2 cần 4, QUIC (HTTP/3) gộp handshake transport và TLS nên cần 2, QUIC 0-RTT khi đã từng kết nối cần 1.",
      source: "https://www.rfc-editor.org/rfc/rfc9000",
    },
  ],
  table: {
    head: ["", "HTTP/1.1", "HTTP/2", "HTTP/3"],
    rows: [
      {
        cells: ["Transport", "TCP (thường + TLS)", "TCP + TLS (ALPN `h2`)", "QUIC trên UDP, TLS 1.3 tích hợp (ALPN `h3`)"],
        why: "HTTP/2 trên TLS được chọn qua ALPN với chuỗi `h2`; cách nâng cấp `h2c` từ HTTP/1.1 không mã hoá đã bị bỏ trong RFC 9113 (https://www.rfc-editor.org/rfc/rfc9113#section-3.1). HTTP/3 dùng token ALPN `h3` (https://www.rfc-editor.org/rfc/rfc9114#section-3.1).",
      },
      {
        cells: ["Định dạng", "Văn bản, header lặp lại nguyên văn mỗi request", "Frame nhị phân; header nén HPACK", "Frame nhị phân; header nén QPACK"],
        why: "RFC 9113 nêu header HTTP \"lặp lại và dài dòng\", làm đầy nhanh congestion window ban đầu của kết nối TCP mới; nén header giảm số byte phải gửi trong những RTT đầu (https://www.rfc-editor.org/rfc/rfc9113#section-1).",
      },
      {
        cells: ["Nhiều request đồng thời", "Một request đang chờ mỗi kết nối; pipelining có nhưng response phải đúng thứ tự → mở nhiều kết nối", "Nhiều stream xen kẽ trên một kết nối", "Mỗi request một QUIC stream, độc lập"],
        why: "RFC 9112: server xử lý pipeline \"MUST\" trả response theo đúng thứ tự request (https://www.rfc-editor.org/rfc/rfc9112#section-9.3.2), nên request chậm đứng đầu chặn mọi response sau. RFC 9112 §9.4 nói thêm: client dùng nhiều kết nối để tránh chính head-of-line blocking này, và không còn quy định số kết nối tối đa cố định, chỉ khuyên dè dặt.",
      },
      {
        cells: ["Mất một gói", "Chặn kết nối đó", "Chặn **mọi** stream trên kết nối", "Chỉ chặn stream chứa gói đó"],
        why: "TCP chỉ giao byte cho app theo đúng thứ tự, nên byte của stream B đã tới vẫn phải chờ gói của stream A được gửi lại. RFC 9114: \"các stream độc lập với nhau, nên một stream bị chặn hoặc mất gói không cản các stream khác tiến lên\" (https://www.rfc-editor.org/rfc/rfc9114#section-2).",
      },
      {
        cells: ["Handshake kết nối mới", "TCP 1 RTT + TLS 1.3 1 RTT", "Như HTTP/1.1", "1 RTT (gộp), 0-RTT khi đã từng kết nối"],
        why: "QUIC gộp thương lượng tham số transport và mật mã, tích hợp handshake TLS 1.3; tuỳ chọn 0-RTT cần đã từng kết nối hoặc cấu hình trước (https://www.rfc-editor.org/rfc/rfc9000#section-1). Dữ liệu 0-RTT có thể bị replay, nên chỉ hợp cho request an toàn khi gửi lại (RFC 8446 §8 — https://www.rfc-editor.org/rfc/rfc8446#section-8).",
      },
      {
        cells: ["Đổi mạng (Wi-Fi → 4G)", "Kết nối chết, mở lại", "Kết nối chết, mở lại", "Giữ được kết nối nhờ connection ID"],
        why: "Kết nối TCP gắn với 4-tuple IP/port; đổi IP là kết nối khác. QUIC nhận diện kết nối bằng connection ID nên \"sống được qua việc đổi địa chỉ endpoint\" (https://www.rfc-editor.org/rfc/rfc9000#section-9).",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao QUIC chạy trên UDP?** RFC 9000 chỉ nói gọn: QUIC packet đi trong UDP datagram \"để dễ triển khai hơn trên các hệ thống và mạng đang có\" (https://www.rfc-editor.org/rfc/rfc9000#section-1). Nói cách khác: cần một transport mới (stream độc lập, handshake gộp TLS, đổi mạng không đứt) mà không phải chờ mọi hệ điều hành và thiết bị mạng hỗ trợ một giao thức tầng 4 mới; UDP là lớp vỏ mỏng gần như mọi mạng đã cho đi qua.",
      why: "UDP không có thứ tự, không ACK, không congestion control, nên QUIC tự làm tất cả phần đó ở trên (RFC 9002 — https://www.rfc-editor.org/rfc/rfc9002). Đổi lại, QUIC quyết định được cách khôi phục theo từng stream, điều TCP không làm được vì TCP chỉ thấy một dòng byte.",
    },
    {
      t: "**Không có UDP thì quay về TCP.** RFC 9114: lỗi kết nối (ví dụ mạng chặn UDP) có thể làm QUIC không lập được, và client **SHOULD** thử các phiên bản HTTP chạy trên TCP (https://www.rfc-editor.org/rfc/rfc9114#section-3.1). Server quảng bá HTTP/3 bằng header `Alt-Svc: h3=\":443\"` trong response HTTP/1.1 hoặc HTTP/2.",
      why: "Vì vậy server vẫn phải phục vụ HTTP/1.1 hoặc HTTP/2 song song. Lần kết nối đầu tiên tới một host thường vẫn đi TCP; client chỉ thử QUIC sau khi biết server hỗ trợ.",
    },
    {
      t: "**HPACK → QPACK.** HPACK giả định các block header tới đúng thứ tự (đúng trên TCP). QUIC không đảm bảo thứ tự giữa các stream, nên HTTP/3 thay bằng QPACK, cập nhật bảng nén qua stream một chiều riêng (https://www.rfc-editor.org/rfc/rfc9114#section-2).",
      why: "Nếu giữ HPACK trên QUIC, stream B tham chiếu một mục bảng mà stream A chưa tới sẽ phải chờ A: head-of-line blocking quay lại qua cửa sau. QPACK cho encoder tự chọn đánh đổi giữa tỉ lệ nén và mức chặn.",
    },
    {
      t: "**Ưu tiên request**: RFC 9113 **deprecate** cơ chế priority dạng cây phụ thuộc của RFC 7540 (https://www.rfc-editor.org/rfc/rfc9113#section-5.3.2); cơ chế thay thế dùng được cho cả HTTP/2 và HTTP/3 là header `Priority` của RFC 9218, độc lập phiên bản HTTP (https://www.rfc-editor.org/rfc/rfc9218).",
      why: "RFC 9113 §5.3.1 kết luận cơ chế của RFC 7540 \"không thành công\": phức tạp, client và server triển khai không đồng đều, nhiều server bỏ qua tín hiệu của client. Câu hỏi phỏng vấn ít đi vào đây; chỉ cần biết multiplexing cần ưu tiên để CSS/HTML không bị ảnh lớn chiếm băng thông.",
    },
    {
      t: "**Flow control hai tầng.** HTTP/2 có flow control cho từng stream và cho cả kết nối bằng frame `WINDOW_UPDATE` (https://www.rfc-editor.org/rfc/rfc9113#section-5.2); QUIC cũng có ở cả hai mức. Server giới hạn số stream đồng thời bằng `SETTINGS_MAX_CONCURRENT_STREAMS`, RFC khuyên không nhỏ hơn 100.",
      why: "Không có flow control theo stream thì một download lớn đọc chậm sẽ chiếm hết window của kết nối và chặn các stream khác: lại là head-of-line blocking, lần này do bên nhận.",
    },
  ],
  sections: [
    {
      title: "Ảnh hưởng tới thiết kế backend",
      points: [
        {
          t: "**Load balancer L4 với HTTP/2/gRPC chia không đều.** gRPC chạy trên framing HTTP/2 (https://grpc.github.io/grpc/core/md_doc__p_r_o_t_o_c_o_l-_h_t_t_p2.html); HTTP/2 cho nhiều RPC dùng chung một kết nối, và client thường giữ kết nối đó lâu dài. LB L4 chỉ chọn backend lúc mở kết nối, nên tải theo RPC có thể dồn lệch về vài backend.",
          why: "Tài liệu gRPC: với HTTP/2, LB tầng ứng dụng \"có thể chia các stream của một client cho nhiều backend\", và khi tải RPC giữa các kết nối chênh nhau nhiều thì nên dùng LB tầng ứng dụng (https://grpc.io/blog/grpc-load-balancing/). Lựa chọn khác: client-side load balancing.",
        },
        {
          t: "**TLS và HTTP/2 thường kết thúc ở edge.** Client ↔ CDN/LB có thể là HTTP/3 hoặc HTTP/2; LB ↔ app phía sau thường là HTTP/1.1 hoặc HTTP/2 qua kết nối giữ sẵn. Phiên bản ở mỗi chặng chọn độc lập.",
          why: "Lợi ích của HTTP/3 nằm ở mạng xa, hay mất gói, hay đổi mạng (người dùng di động). Trong datacenter, RTT nhỏ và mất gói hiếm nên HTTP/1.1 keep-alive hay HTTP/2 thường đủ.",
        },
        {
          t: "**Domain sharding và gộp file là mẹo của HTTP/1.1.** Chia tài nguyên ra nhiều domain để có thêm kết nối, hay gộp mọi JS thành một file, sinh ra để né giới hạn \"một request mỗi kết nối\". Với HTTP/2 trở lên, chúng phần lớn mất tác dụng và sharding còn làm hại vì mỗi domain lại tốn DNS, handshake, slow start.",
          why: "Multiplexing làm request nhỏ gần như miễn phí trên kết nối có sẵn; điều cần tối ưu chuyển sang số kết nối (ít là tốt) và thứ tự ưu tiên.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Trả lời \"HTTP/2 khác HTTP/1.1?\" bằng một câu về **multiplexing** và một câu về **giới hạn**: vẫn chạy trên TCP nên mất gói chặn mọi stream. Câu giới hạn đó dẫn thẳng sang HTTP/3.",
      why: "Nhiều người nói \"HTTP/2 giải quyết head-of-line blocking\" — chỉ đúng một nửa. Phân biệt HOL tầng ứng dụng và HOL tầng TCP là dấu hiệu hiểu thật.",
    },
    {
      t: "Khi nói \"QUIC dùng UDP\", nói kèm: QUIC vẫn **tin cậy** và có congestion control; nó chỉ dùng UDP làm lớp vỏ để đi qua mạng hiện có.",
      why: "Câu sai hay gặp là \"HTTP/3 nhanh vì UDP không cần ACK\". QUIC có ACK, có gửi lại; nó nhanh hơn ở handshake gộp và khôi phục theo stream.",
    },
  ],
  cards: [
    ["HTTP/2 giải quyết head-of-line blocking nào, còn để lại cái nào?", "Gỡ HOL tầng ứng dụng (nhiều stream trên một kết nối, không phải chờ response trước). Còn HOL của TCP: mất một gói chặn mọi stream."],
    ["Vì sao QUIC chạy trên UDP?", "Để triển khai được trên OS và mạng hiện có (RFC 9000). Một giao thức tầng 4 mới khó đi qua thiết bị mạng; UDP thì đi được, QUIC tự làm tin cậy, thứ tự theo stream, congestion control ở trên."],
    ["Vì sao HTTP/3 không dùng HPACK?", "HPACK cần header block tới đúng thứ tự; QUIC không đảm bảo thứ tự giữa stream. QPACK cập nhật bảng qua stream riêng."],
    ["Client đổi từ Wi-Fi sang 4G. HTTP/2 và HTTP/3 khác nhau thế nào?", "HTTP/2 trên TCP: IP đổi → kết nối chết, mở lại (handshake, slow start). HTTP/3: QUIC nhận diện kết nối bằng connection ID nên di chuyển được."],
    ["Client biết server có HTTP/3 bằng cách nào?", "Qua header `Alt-Svc: h3=...` trong response HTTP/1.1 hoặc HTTP/2; trong handshake dùng ALPN token `h3` trong handshake."],
    ["Vì sao gRPC sau L4 load balancer hay bị lệch tải?", "Nhiều RPC đi chung một kết nối HTTP/2 giữ lâu; L4 LB chỉ chọn backend khi mở kết nối. Dùng L7 LB chia theo stream hoặc client-side LB."],
  ],
  related: ["lb"],
});
