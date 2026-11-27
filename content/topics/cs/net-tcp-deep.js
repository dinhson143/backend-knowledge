BK.topic({
  id: "net-tcp-deep",
  track: "cs",
  section: "cs-net",
  title: "TCP chuyên sâu",
  goal: "Giải thích handshake, TIME_WAIT, flow và congestion control",
  needs: ["networking"],
  tldr: {
    t: "TCP biến một mạng hay rơi, trùng, đảo gói thành một **dòng byte tin cậy, đúng thứ tự** giữa hai process. Năm cơ chế cần nói được: **handshake 3 bước** (thống nhất số thứ tự ban đầu), **sequence + ACK + retransmit** (gửi lại cái mất), **flow control** (receive window: bên nhận nói còn chứa được bao nhiêu), **congestion control** (congestion window: bên gửi tự đoán mạng chịu được bao nhiêu), và **đóng kết nối** với trạng thái **TIME_WAIT** ở bên đóng trước.",
    why: "Mỗi cơ chế chặn một kiểu hỏng: thiếu handshake thì gói SYN cũ lạc đường mở nhầm kết nối; thiếu window thì bên gửi nhanh làm tràn buffer bên nhận; thiếu congestion control thì mọi người gửi hết tốc lực và mạng sụp (RFC 9293 bắt buộc slow start, congestion avoidance và backoff retransmission timeout \"để tránh congestion collapse\" — https://www.rfc-editor.org/rfc/rfc9293#section-3.8.2); thiếu TIME_WAIT thì gói trễ của kết nối cũ lọt vào kết nối mới cùng cặp địa chỉ.",
  },
  story: {
    problem: "Service gọi API nội bộ, mỗi request mở một kết nối TCP mới rồi đóng. Tải tăng, client bắt đầu lỗi `EADDRNOTAVAIL`/`cannot assign requested address`, `ss -s` cho thấy hàng chục nghìn socket ở TIME_WAIT. Một service khác thì p99 nhảy vọt sau mỗi lúc im lặng, dù mạng không đổi.",
    idea: "Hiểu vòng đời kết nối: bên **chủ động đóng** giữ TIME_WAIT 2×MSL, mỗi socket ở đó chiếm một cổng nguồn tạm (ephemeral port) → dùng connection pool/keep-alive thay vì mở-đóng liên tục. Hiểu congestion window: kết nối mới (hoặc nghỉ lâu) bắt đầu bằng cửa sổ nhỏ rồi tăng dần → request đầu trên kết nối lạnh chậm hơn.",
    tradeoff: "Tin cậy và công bằng có giá: 1 RTT handshake trước byte đầu tiên, slow start làm kết nối mới chưa dùng hết băng thông, một gói mất chặn mọi byte phía sau trên cùng kết nối (head-of-line blocking). Đây là lý do HTTP/3 chuyển sang QUIC trên UDP.",
  },
  table: {
    head: ["Cơ chế", "Làm gì", "Thiếu thì hỏng gì"],
    rows: [
      {
        cells: ["Handshake 3 bước", "SYN (ISN của client) → SYN-ACK (ISN của server + ACK) → ACK", "SYN cũ còn lạc trong mạng có thể mở nhầm một kết nối"],
        why: "RFC 9293: lý do chính của three-way handshake là \"ngăn các yêu cầu mở kết nối cũ bị trùng gây nhầm lẫn\"; bên nhận thấy ACK không khớp số thứ tự mình vừa gửi thì trả RST (https://www.rfc-editor.org/rfc/rfc9293#section-3.5). Cần 3 bước vì mỗi bên phải gửi ISN của mình **và** nhận xác nhận cho nó.",
      },
      {
        cells: ["Sequence, ACK, retransmit", "Đánh số từng byte; bên nhận ACK byte kế tiếp đang chờ; hết retransmission timeout hoặc 3 duplicate ACK thì gửi lại", "Mất gói là mất dữ liệu, gói đảo thứ tự giao sai thứ tự"],
        why: "Fast retransmit coi 3 duplicate ACK là dấu hiệu mất gói và gửi lại ngay, không chờ hết retransmission timer (RFC 5681 §3.2 — https://www.rfc-editor.org/rfc/rfc5681#section-3.2). Retransmission timeout ban đầu là 1 giây và nhân đôi mỗi lần hết hạn liên tiếp (RFC 6298 — https://www.rfc-editor.org/rfc/rfc6298).",
      },
      {
        cells: ["Flow control", "Mỗi segment mang receive window: số byte bên nhận còn chứa được", "Bên gửi nhanh làm tràn buffer của bên nhận chậm"],
        why: "Trường Window 16 bit chỉ đủ 64 KB, nên có window scale option để nhân lên (RFC 9293 §3.1, RFC 7323). Window bằng 0 thì bên gửi dừng và thăm dò định kỳ (zero-window probing, §3.8.6.1 — https://www.rfc-editor.org/rfc/rfc9293#section-3.8.6). App đọc socket chậm → buffer đầy → window 0 → bên kia đứng chờ: đây là backpressure ở tầng TCP.",
      },
      {
        cells: ["Congestion control", "Bên gửi giữ congestion window (cwnd); gửi tối đa min(cwnd, receive window) byte chưa được ACK", "Mọi luồng cùng gửi tối đa, router rớt gói, retransmit làm tắc thêm (congestion collapse)"],
        why: "Receive window chỉ biết bên nhận còn chỗ; nó không biết router ở giữa đang đầy. cwnd là ước lượng của bên gửi về sức chứa của đường đi, giảm khi thấy mất gói (RFC 5681 — https://www.rfc-editor.org/rfc/rfc5681).",
      },
      {
        cells: ["Đóng kết nối + TIME_WAIT", "FIN/ACK mỗi chiều; bên đóng trước ở lại TIME_WAIT 2×MSL", "Gói trễ của kết nối cũ lọt vào kết nối mới cùng 4-tuple; ACK cuối mất thì bên kia không đóng được"],
        why: "RFC 9293: bên chủ động đóng **MUST** ở TIME_WAIT 2×MSL (https://www.rfc-editor.org/rfc/rfc9293#section-3.6), để chắc bên kia đã nhận ACK cho FIN của nó và để gói cũ chết hết trong mạng. Spec lấy MSL = 2 phút (§3.4.2); Linux dùng hằng số `TCP_TIMEWAIT_LEN` = 60 giây (https://github.com/torvalds/linux/blob/master/include/net/tcp.h).",
      },
    ],
  },
  points: [
    {
      t: "**TIME_WAIT nằm ở bên đóng trước**, không nhất thiết là server. Client mở-đóng kết nối liên tục tới cùng một `ip:port` đích sẽ gom TIME_WAIT ở chính nó; mỗi cái giữ một ephemeral port trong 60 giây (Linux). Hết port thì `connect()` lỗi.",
      why: "4-tuple (IP nguồn, port nguồn, IP đích, port đích) xác định kết nối. Khi IP và port đích cố định, chỉ còn port nguồn thay đổi được, nên số kết nối mới mỗi giây bị giới hạn bởi số ephemeral port chia cho thời gian TIME_WAIT. Cách sửa gốc là **tái dùng kết nối** (HTTP keep-alive, connection pool cho DB/Redis), không phải chỉnh kernel.",
    },
    {
      t: "**`tcp_fin_timeout` không phải thời gian TIME_WAIT.** tcp(7) mô tả nó là số giây chờ FIN cuối cùng trước khi đóng cưỡng bức socket (tức trạng thái FIN-WAIT-2), mặc định 60 (https://man7.org/linux/man-pages/man7/tcp.7.html). `tcp_tw_reuse` cho tái dùng socket TIME_WAIT cho kết nối mới \"khi an toàn về mặt giao thức\", mặc định tắt, và man page dặn không đổi nếu không có chuyên gia khuyên.",
      why: "Bài blog hay khuyên hạ `tcp_fin_timeout` để \"giảm TIME_WAIT\" — sai trạng thái. RFC 9293 cho phép rút ngắn TIME_WAIT khi dùng TCP Timestamps (SHLD-4), và đó là cơ chế `tcp_tw_reuse` dựa vào; còn bỏ TIME_WAIT bằng tay là mở cửa cho gói cũ lọt vào kết nối mới.",
    },
    {
      t: "**CLOSE_WAIT tăng mãi là bug của app**, không phải của mạng: phía bên kia đã gửi FIN, kernel đang chờ **app của bạn** gọi `close()`.",
      why: "RFC 9293 định nghĩa CLOSE-WAIT là \"chờ yêu cầu đóng từ local user\" (https://www.rfc-editor.org/rfc/rfc9293#section-3.3.2). Socket bị quên đóng (exception bỏ qua `finally`, response body không đọc hết nên pool không trả kết nối) sẽ nằm đây tới khi process chết, giữ fd và bộ nhớ.",
    },
    {
      t: "**Hai queue khi `listen()`**: SYN queue cho kết nối đang bắt tay (giới hạn bởi `tcp_max_syn_backlog`), accept queue cho kết nối đã bắt tay xong chờ app `accept()` (tham số `backlog`, bị cắt bởi `net.core.somaxconn`; mặc định 4096 từ Linux 5.4, trước đó 128 — https://man7.org/linux/man-pages/man2/listen.2.html).",
      why: "App `accept()` chậm (event loop bị chặn, hết worker) thì accept queue đầy, kernel bắt đầu bỏ kết nối mới dù CPU còn rảnh. Khi SYN queue tràn, Linux có thể gửi SYN cookie thay vì giữ trạng thái (tham số `tcp_syncookies`, tcp(7)), là cách chống SYN flood.",
    },
    {
      t: "**Slow start**: kết nối mới bắt đầu với initial window nhỏ (RFC 6928 nâng lên tối đa 10 segment, khoảng 14 600 byte — https://www.rfc-editor.org/rfc/rfc6928), mỗi ACK tăng cwnd thêm tối đa 1 SMSS nên cwnd **gần như gấp đôi mỗi RTT**, tới ngưỡng `ssthresh` thì chuyển sang congestion avoidance (tăng khoảng 1 SMSS mỗi RTT).",
      why: "RFC 5681 công thức (2): `cwnd += min(N, SMSS)` cho mỗi ACK. Hệ quả cho backend: response 1 MB trên kết nối mới cần nhiều RTT chỉ để cwnd lớn đủ, nên tái dùng kết nối ấm có lợi cả ở băng thông, không chỉ ở handshake. Đây cũng là lý do MDN khuyên gói nội dung quan trọng vào ~14 KB đầu của trang.",
    },
    {
      t: "**Mất gói thì cwnd giảm.** Hết retransmission timeout: `ssthresh = max(FlightSize/2, 2·SMSS)` và cwnd về 1 segment (loss window), chạy lại slow start (RFC 5681 §3.1). Linux, Windows và Apple dùng mặc định **CUBIC** (RFC 9438 — https://www.rfc-editor.org/rfc/rfc9438), giảm cửa sổ theo hệ số 0.7 thay vì 0.5 như Reno.",
      why: "Thuật toán congestion control chọn được theo từng máy: Linux đặt mặc định ở `net.ipv4.tcp_congestion_control`, `reno` luôn có, các thuật toán khác tuỳ cấu hình kernel (tcp(7)). Đổi thuật toán là việc của đội vận hành mạng; backend chỉ cần biết mất gói làm throughput tụt mạnh và hồi chậm.",
    },
    {
      t: "**Nghỉ lâu cũng mất cwnd.** Linux mặc định `tcp_slow_start_after_idle = 1`: kết nối im lặng quá một retransmission timeout thì congestion window bị reset, request kế tiếp lại slow start (tcp(7)).",
      why: "Giải thích vì sao p99 nhảy sau mỗi lúc im lặng dù kết nối vẫn mở. Với kết nối dài giữa các service trong cùng datacenter, một số đội tắt tham số này; đánh đổi là bơm cửa sổ cũ vào mạng có thể đã đổi trạng thái.",
    },
    {
      t: "**Nagle và `TCP_NODELAY`.** Nagle giữ lại các mẩu dữ liệu nhỏ khi còn dữ liệu chưa được ACK, gom thành segment đầy rồi mới gửi; RFC 9293 yêu cầu phải có cách tắt cho từng kết nối (https://www.rfc-editor.org/rfc/rfc9293#section-3.7.4). Trên Linux đó là `TCP_NODELAY`.",
      why: "Protocol request/response nhỏ (Redis, RPC, game) mà để Nagle bật có thể chờ ACK của gói trước mới gửi gói sau; kết hợp với delayed ACK ở bên kia thì latency tăng thấy rõ. RFC 9293 nhắc chính tương tác Nagle × delayed ACK này. Nhiều client library tự bật `TCP_NODELAY`.",
    },
    {
      t: "**Keep-alive của TCP mặc định rất thưa.** RFC 9293 yêu cầu keep-alive mặc định **tắt** và khoảng nghỉ mặc định **không dưới 2 giờ** (§3.8.4); Linux `tcp_keepalive_time` = 7200 giây, sau đó 9 lần thăm dò cách 75 giây (tcp(7)).",
      why: "Nếu NAT, firewall hay load balancer ở giữa xoá kết nối im lặng sớm hơn 2 giờ, bên giữ connection pool chỉ phát hiện khi gửi request tiếp theo và nhận RST hoặc timeout. Cách xử lý: bật keep-alive với khoảng ngắn hơn idle timeout của thiết bị ở giữa, hoặc heartbeat ở tầng ứng dụng, hoặc pool tự loại kết nối nghỉ quá lâu.",
    },
  ],
  sections: [
    {
      title: "Ước lượng: một kết nối đi nhanh tới đâu?",
      points: [
        {
          t: "Throughput tối đa của một kết nối ≈ **window / RTT**. Window 64 KB với RTT 100 ms → khoảng 640 KB/s, dù đường truyền có 1 Gbps.",
          why: "Bên gửi chỉ được có tối đa một window dữ liệu chưa được ACK; muốn lấp đầy đường truyền thì window phải ≥ băng thông × RTT (bandwidth-delay product). Vì vậy truyền file lớn qua đường xa cần window scale và buffer lớn, hoặc chia thành nhiều kết nối.",
        },
        {
          t: "Kết nối mới có thêm **1 RTT handshake** (cộng 1 RTT TLS 1.3) trước byte đầu, rồi vài RTT slow start trước khi đạt tốc độ. Xem bảng RTT ở topic \"Gõ URL thì chuyện gì xảy ra\".",
          why: "Đó là lý do mọi client nghiêm túc (driver DB, HTTP client, gRPC) đều có connection pool: chi phí mở kết nối trả một lần, dùng lại nhiều lần.",
        },
      ],
    },
    {
      title: "Ví dụ: tuỳ chọn socket hay dùng (Python)",
      code: {
        lang: "python",
        lines: [
          "import socket",
          "",
          "srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)",
          ["srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)", "Cho phép `bind` lại port khi kết nối cũ còn TIME_WAIT, để restart server không bị \"Address already in use\" (socket(7))."],
          "srv.bind((\"127.0.0.1\", 0))",
          ["srv.listen(128)", "`backlog`: độ dài accept queue; kernel cắt bởi `somaxconn` (listen(2))."],
          "",
          "cli = socket.create_connection(srv.getsockname())",
          ["cli.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)", "Tắt Nagle: gửi ngay các message nhỏ request/response."],
          ["cli.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)", "Bật keep-alive; khoảng thời gian mặc định vẫn là 2 giờ nếu không chỉnh thêm."],
          "conn, addr = srv.accept()",
          "cli.sendall(b\"ping\")",
          "print(conn.recv(4))",
          ["cli.close()", "Client đóng trước → socket phía client vào TIME_WAIT."],
          "conn.close(); srv.close()",
        ],
      },
    },
  ],
  tips: [
    {
      t: "Hỏi \"TIME_WAIT nhiều thì làm gì?\": trả lời theo thứ tự (1) ai đang đóng trước và vì sao (mở-đóng mỗi request?), (2) dùng keep-alive/connection pool, (3) chỉ sau đó mới nói `tcp_tw_reuse`, và nói rõ vì sao không tắt TIME_WAIT.",
      why: "Interviewer muốn thấy bạn sửa nguyên nhân (thiết kế client) trước khi vặn kernel. Câu trả lời \"hạ tcp_fin_timeout\" cho thấy nhầm FIN-WAIT-2 với TIME_WAIT.",
    },
    {
      t: "Phân biệt rõ **flow control** (bảo vệ bên nhận, do bên nhận báo) với **congestion control** (bảo vệ mạng, do bên gửi tự đoán).",
      why: "Đây là câu hay bị hỏi gài. Hai cửa sổ khác nhau, và lượng gửi thật là min của cả hai.",
    },
  ],
  cards: [
    ["Vì sao handshake cần 3 bước, không phải 2?", "Mỗi bên phải gửi ISN của mình và nhận ACK cho nó. Bước 3 giúp server biết SYN không phải bản cũ bị trùng; RFC 9293 nêu đây là lý do chính."],
    ["Socket TIME_WAIT nằm ở phía nào, giữ bao lâu?", "Phía chủ động đóng trước. 2×MSL theo RFC 9293 (MSL = 2 phút trong spec); Linux dùng 60 giây cố định (`TCP_TIMEWAIT_LEN`)."],
    ["CLOSE_WAIT tăng dần trên server. Nguyên nhân thường gặp?", "Bên kia đã đóng nhưng app không gọi `close()`: rò socket do quên đóng, exception bỏ qua cleanup, hoặc response không đọc hết."],
    ["Flow control khác congestion control thế nào?", "Flow control: receive window do bên nhận quảng bá, chống tràn buffer bên nhận. Congestion control: cwnd do bên gửi tự tính, chống tắc mạng. Gửi tối đa min của hai cái."],
    ["Slow start tăng cwnd thế nào?", "Mỗi ACK tăng tối đa 1 SMSS, nên cwnd gần như gấp đôi mỗi RTT, cho tới `ssthresh`; sau đó congestion avoidance tăng khoảng 1 SMSS mỗi RTT."],
    ["Khi nào bật `TCP_NODELAY`?", "Khi gửi nhiều message nhỏ cần trả lời nhanh (RPC, Redis, game). Nagle gom gói nhỏ chờ ACK, kết hợp delayed ACK gây trễ."],
    ["Window 64 KB, RTT 50 ms. Throughput tối đa một kết nối?", "≈ 64 KB / 0.05 s ≈ 1.3 MB/s, bất kể băng thông đường truyền."],
  ],
});
