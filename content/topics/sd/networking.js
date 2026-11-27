BK.topic({
  id: "networking",
  track: "sd",
  section: "sd-core",
  title: "Networking Essentials",
  tldr: {
    t: "Nắm 3 tầng quan trọng (L3 IP, L4 TCP/UDP, L7 HTTP/WebSocket/gRPC), DNS, và khác biệt L4 vs L7 load balancing.",
    why: "L3, L4, L7 là chỗ các quyết định thiết kế thực tế xảy ra (routing, độ tin cậy, ngữ nghĩa request); DNS là bước đầu tiên của mọi request. L4 LB nhanh nhưng không route theo URL được, vì chỉ thấy IP:port; L7 LB route theo path/header được vì đọc được HTTP, nhưng tốn CPU hơn.",
  },
  story: {
    problem: "Mọi quyết định thiết kế — dùng WebSocket hay polling, đặt LB ở đâu, service gọi nhau bằng gì — đều phụ thuộc vào cách dữ liệu đi qua mạng. Không hiểu tầng mạng thì dễ chọn sai, ví dụ HTTP polling mỗi giây cho chat làm server ngập request rỗng.",
    idea: "Mạng chia tầng, mỗi tầng giải một bài toán: L3 đưa gói tới đúng máy, L4 đưa tới đúng process và quyết định có tin cậy hay không, L7 mang ngữ nghĩa ứng dụng. Biết tầng nào làm gì → biết thiết bị (LB, proxy) hoặc giao thức nào nhìn thấy thông tin nào để ra quyết định.",
    tradeoff: "Mỗi tầng trên thêm overhead: TCP tốn handshake và chờ gửi lại, TLS thêm round-trip, L7 LB phải parse request nên tốn CPU hơn L4. Chọn giao thức là đổi giữa độ tin cậy, latency và độ phức tạp vận hành.",
  },
  table: {
    head: ["Tầng", "Giao thức", "Việc chính"],
    rows: [
      {
        cells: ["Layer 3 · Network", "IP", "Tìm đường chuyển gói tin giữa các máy dựa vào địa chỉ IP"],
        why: "Mạng toàn cầu chuyển tiếp nhanh được vì router chỉ đọc IP đích trong header gói để chọn chặng tiếp theo, không quan tâm nội dung. IP không đảm bảo gói tới nơi hay đúng thứ tự — phần đó dành cho tầng trên.",
      },
      {
        cells: ["Layer 4 · Transport", "TCP / UDP", "Xác định gói tin thuộc ứng dụng (port) nào trên máy đích"],
        why: "Cần port để hệ điều hành biết giao gói cho process nào (Postgres 5432, Nginx 443), vì một máy chạy nhiều process cùng lúc. Tầng này còn chọn mức tin cậy: TCP đảm bảo đủ và đúng thứ tự, UDP thì không.",
      },
      {
        cells: ["Layer 7 · Application", "HTTP, WebSocket, gRPC", "Ngữ nghĩa ứng dụng: URL, header, cookie, payload"],
        why: "Mọi logic như auth, routing theo path, cache theo URL đều cần đọc L7, vì chỉ tầng này mới có khái niệm ứng dụng như URL, cookie, user. Đổi lại phải parse toàn bộ request, tốn CPU hơn xử lý ở L4.",
      },
    ],
  },
  points: [
    {
      t: "**IP Addressing** — mỗi thiết bị có IP duy nhất trong mạng của nó (chỉ public IP là duy nhất toàn cầu); phân biệt **Public Subnet** và **Private Subnet** (DB, service nội bộ nằm private).",
      why: "IP trùng thì gói không biết đi đâu, vì IP là địa chỉ để router tìm đường. DB và service nội bộ đặt ở private subnet vì không có route từ Internet vào → attacker không kết nối thẳng được dù biết IP, chỉ đi qua LB/gateway ở public subnet.",
    },
    {
      t: "**DNS** — “danh bạ” đổi tên miền (google.com) thành IP; còn dùng cho **Geo-routing** (trả IP gần người dùng).",
      why: "Cần DNS dịch tên sang IP, vì con người nhớ tên còn mạng chỉ route theo IP. DNS server biết resolver hỏi từ vùng nào → trả IP của datacenter gần nhất, giảm latency mà client không phải đổi gì.",
    },
    {
      t: "**Ports** — 22 SSH, 80 HTTP, 443 HTTPS (đều TCP).",
      why: "Port chuẩn hoá để client không cần hỏi trước dịch vụ chạy ở đâu: trình duyệt gõ `https://` là tự nối 443. Cả ba dùng TCP vì SSH và web đều cần dữ liệu đủ, đúng thứ tự — mất một byte là hỏng lệnh hoặc hỏng trang.",
    },
    {
      t: "**TCP** — bắt tay 3 bước, đánh số thứ tự, ACK, mất gói thì gửi lại → tin cậy, có thứ tự.",
      why: "TCP đảm bảo đủ và đúng thứ tự dù mạng có thể làm rơi, trùng hoặc đảo gói: nó đánh số từng byte để bên nhận sắp xếp lại, gửi ACK báo đã nhận, bên gửi không thấy ACK thì gửi lại; handshake để hai bên thống nhất số thứ tự bắt đầu. Cái giá: thêm 1 RTT lúc mở kết nối và head-of-line blocking khi một gói bị mất.",
    },
    {
      t: "**UDP** — “fire and forget”: không ACK, không sắp xếp lại → nhanh, hợp video call, game, live streaming.",
      why: "UDP không có độ trễ chờ retransmit, vì nó bỏ hết ACK và gửi lại. Với video call, khung hình tới trễ 200ms còn tệ hơn mất khung đó, vì ứng dụng chỉ cần dữ liệu **hiện tại**; game cũng vậy với vị trí người chơi.",
    },
    {
      t: "**HTTP/HTTPS** — request/response trên TCP, stateless; muốn dữ liệu mới phải gửi request mới.",
      why: "Request nào tới server nào cũng xử lý được → scale ngang dễ, vì HTTP stateless: mỗi request mang đủ thông tin (token, params), server không phải nhớ client. Hệ quả: server không có kênh chủ động đẩy dữ liệu, client phải hỏi lại mới biết có gì mới.",
    },
    {
      t: "**WebSockets** — bắt tay một lần rồi giữ kết nối 2 chiều liên tục.",
      why: "Server đẩy tin được ngay khi có, không tốn header HTTP và handshake cho mỗi tin, vì WebSocket upgrade từ một HTTP request rồi giữ nguyên kết nối TCP. Đổi lại server phải giữ state kết nối, LB cần hỗ trợ kết nối dài, mất server là client phải reconnect.",
    },
    {
      t: "**gRPC** — chạy trên HTTP/2, payload nhị phân Protocol Buffers, gọi hàm từ xa như gọi hàm nội bộ.",
      why: "Protobuf nhỏ và parse nhanh hơn JSON nhiều lần, vì mã hoá nhị phân theo schema; HTTP/2 multiplex nhiều call trên một kết nối, bỏ chi phí mở kết nối mới. Code client sinh từ file `.proto` → sai kiểu dữ liệu bị bắt lúc compile thay vì lúc chạy.",
    },
    {
      t: "+ **SSE (Server-Sent Events)** — HTTP thường nhưng server giữ response mở để đẩy event 1 chiều; tự reconnect.",
      why: "SSE đi qua proxy, LB và auth HTTP sẵn có mà không cần giao thức mới, vì nó chỉ là một HTTP response không đóng, server viết thêm event vào khi có. Hợp với luồng một chiều như notification, giá live, token LLM; trình duyệt tự reconnect và gửi `Last-Event-ID` để nhận tiếp.",
    },
    {
      t: "+ **Long polling** — client gửi request, server giữ đến khi có dữ liệu; đơn giản nhất, tốn kết nối.",
      why: "Client nhận tin gần như tức thì mà không phải spam request rỗng như polling thường, vì server giữ request treo đến khi có dữ liệu. Nhưng mỗi client chờ chiếm một kết nối và mỗi tin lại tốn một request mới → tải cao thì kém hơn WebSocket/SSE.",
    },
  ],
  tips: [
    {
      t: "Mặc định chọn HTTP/REST cho client-facing; gRPC cho service-to-service; WebSocket/SSE chỉ khi có yêu cầu realtime.",
      why: "REST/JSON an toàn cho client bên ngoài, vì mọi trình duyệt, CDN, cache và công cụ debug đều hiểu. Giữa các service nội bộ bạn kiểm soát cả hai đầu → dùng được gRPC để lấy tốc độ và type safety; kết nối realtime tốn tài nguyên giữ state nên chỉ dùng khi yêu cầu thực cần push.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/networking-layers-tcp.svg",
      caption: "Mỗi tầng bọc thêm một header: router chỉ đọc IP, L4 load balancer đọc tới port, L7 load balancer đọc cả request nên route theo path được. TCP bắt tay 3 bước (SYN, SYN-ACK, ACK) tốn 1 RTT trước khi gửi dữ liệu.",
      source: "https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5",
    },
  ],
  cards: [
    [
      "TCP khác UDP thế nào? Khi nào chọn UDP?",
      "TCP: 3-way handshake, có thứ tự, ACK + retransmit → tin cậy. UDP: không ACK, không thứ tự → nhanh. Chọn UDP khi mất vài gói chấp nhận được: video call, game, live stream.",
    ],
    [
      "L4 Load Balancer (NLB) khác L7 (ALB) ra sao?",
      "NLB chỉ đọc IP + port, không mở gói tin → cực nhanh, hàng triệu kết nối. ALB đọc HTTP (URL, header, cookie) → định tuyến thông minh theo path/host, tốn CPU hơn.",
    ],
    [
      "DNS dùng gì trong system design ngoài phân giải tên?",
      "Geo-routing / latency-based routing: trả về IP của region gần người dùng; cũng dùng cho failover giữa region.",
    ],
  ],
});
