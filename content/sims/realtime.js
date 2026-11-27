BK.sim({
  id: "realtime",
  title: "Polling, SSE và WebSocket",
  topics: ["patterns", "networking"],
  scenario: "Trang live score cần hiện tỉ số mới ngay khi có bàn thắng.",
  context: "HTTP gốc là **request–response**: server không tự gửi gì nếu client không hỏi, trong khi browser cần biết tỉ số mới ngay khi có bàn thắng. Ba variant là ba cách vượt giới hạn này: **short polling** (hỏi định kỳ), **SSE** (Server-Sent Events: giữ một response HTTP mở để server đẩy dữ liệu), **WebSocket** (nâng cấp kết nối thành kênh hai chiều). Theo dõi mũi tên: ai khởi tạo, bao nhiêu request rỗng, và dòng chữ dưới node cho biết kết nối có được giữ mở hay không.",
  h: 250,
  nodes: [{ id: "client", x: 120, y: 115, label: "Browser" }, { id: "server", x: 660, y: 115, label: "Server" }],
  variants: [
    {
      name: "Short polling",
      steps: [
        {
          note: "Cứ 2s hỏi một lần.",
          msgs: [["client", "server", "GET /score"], ["server", "client", "204 không có gì", "warn"]],
          detail: "Browser hỏi `GET /score` mỗi 2 giây (`setInterval`) và nhận `204 No Content` vì chưa có bàn thắng mới. Request rỗng này vẫn tốn đủ chi phí: header HTTP (cookie, user-agent… thường 500 byte–vài KB), qua load balancer, auth, có khi cả một query DB — chỉ để nhận câu trả lời \"không có gì\".",
        },
        {
          note: "Lại hỏi — vẫn rỗng. Mỗi lần là một request đầy đủ header.",
          msgs: [["client", "server", "GET /score"], ["server", "client", "204 không có gì", "warn"]],
          detail: "2 giây sau lại hỏi, vẫn rỗng — nhân lên: 100,000 người xem × 1 request/2s = **50,000 request/giây**, gần như toàn bộ là request rỗng. Server tốn CPU và băng thông cho thứ không mang thông tin, và chi phí tăng tuyến tính theo số người xem, bất kể trận đấu có bàn thắng hay không.",
        },
        {
          note: "Có bàn thắng, nhưng client chỉ biết ở lượt hỏi kế tiếp.",
          msgs: [["client", "server", "GET /score"], ["server", "client", "200 1-0", "ok"]],
          lesson: "Polling đơn giản nhất, nhưng tốn request rỗng và trễ tới một chu kỳ.",
          detail: "Browser chỉ biết bàn thắng ở lần hỏi kế tiếp (`200 1-0`), dù nó xảy ra ngay sau lần hỏi trước. Độ trễ tệ nhất bằng **một chu kỳ poll** (2 giây), trung bình nửa chu kỳ. Giảm chu kỳ xuống 0.5s cho nhanh thì số request gấp 4 lần — trade-off cố hữu giữa độ tươi và tải. Polling vẫn hợp khi dữ liệu đổi chậm hoặc ít client, vì đơn giản và đi qua mọi proxy, cache.",
        },
      ],
    },
    {
      name: "SSE",
      steps: [
        {
          note: "Client mở một HTTP request; server **giữ** response mở.",
          msgs: [["client", "server", "GET /stream · event-stream"]],
          set: { client: "kết nối mở", server: "giữ response" },
          detail: "Server trả header `Content-Type: text/event-stream` nhưng **không đóng response**: browser dùng `EventSource` gửi `GET /stream` với `Accept: text/event-stream`, và kết nối TCP được giữ mở — mỗi client chiếm một kết nối thường trực trên server. Vì vẫn là HTTP thường, SSE đi qua proxy, load balancer và hưởng auth bằng cookie như mọi request khác.",
        },
        {
          note: "Server đẩy event bất cứ lúc nào.",
          msgs: [["server", "client", "event: 1-0", "ok"], ["server", "client", "event: 2-0", "ok"]],
          detail: "Browser nhận event gần như tức thì, không request rỗng nào: có bàn thắng là server ghi ngay vào response đang mở các dòng `data: 1-0` rồi `data: 2-0`, mỗi event kết thúc bằng một dòng trống. Kết nối đứt thì `EventSource` **tự reconnect** và gửi header `Last-Event-ID` để server phát lại event bị lỡ (nếu server có lưu). Proxy phải tắt buffering, và cần gửi comment heartbeat định kỳ để kết nối không bị timeout đóng.",
        },
        {
          note: "Client muốn gửi lên phải dùng **request riêng** (SSE chỉ một chiều).",
          msgs: [["client", "server", "POST /vote", "warn"]],
          lesson: "SSE: server → client trên HTTP thường, tự reconnect. Hợp live score, notification.",
          detail: "Muốn bình chọn, browser phải mở một `POST /vote` riêng, vì SSE **chỉ một chiều** server → client. Với live score điều này không thành vấn đề vì client hiếm khi gửi lên. Lưu ý: trên HTTP/1.1 trình duyệt chỉ mở tối đa khoảng 6 kết nối mỗi domain, nên mở nhiều tab SSE có thể chặn request khác; HTTP/2 ghép kênh nên hết giới hạn này.",
        },
      ],
    },
    {
      name: "WebSocket",
      steps: [
        {
          note: "Handshake bằng HTTP Upgrade.",
          msgs: [["client", "server", "GET /ws · Upgrade"], ["server", "client", "101 Switching", "ok"]],
          set: { client: "WS open", server: "WS open" },
          detail: "Sau handshake, kết nối TCP **không còn là HTTP**: browser gửi `GET /ws` kèm `Upgrade: websocket` và `Sec-WebSocket-Key`, server đồng ý và trả `101 Switching Protocols`. Từ đó hai bên trao đổi các frame WebSocket nhỏ (header chỉ 2–14 byte), không còn header HTTP mỗi lần gửi.",
        },
        {
          note: "Hai chiều trên **cùng một kết nối**.",
          msgs: [
            { par: [["client", "server", "msg: hi", "ok"], ["server", "client", "msg: hello", "ok"]] },
            { par: [["client", "server", "typing…"], ["server", "client", "goal! 1-0", "ok"]] },
          ],
          detail: "Cả hai bên gửi bất cứ lúc nào trên **cùng một kết nối**: client gửi `hi`, `typing…`, server đẩy `hello`, `goal! 1-0` song song, không chờ lượt nhau. Đây là full-duplex, hợp chat, game, editor cộng tác. Cái giá: kết nối là **stateful** — server phải giữ socket và trạng thái phiên cho từng client, tự lo heartbeat (ping/pong), và client tự viết logic reconnect (WebSocket không tự reconnect như SSE).",
        },
        {
          note: "Khi scale nhiều server, dùng **Pub/Sub** (Redis) để chuyển tin giữa các server đang giữ kết nối.",
          set: { server: "N server + Redis Pub/Sub" },
          lesson: "WebSocket: hai chiều, stateful — cần sticky connection và pub/sub khi scale.",
          detail: "Với N server, mọi server subscribe một kênh **Redis Pub/Sub** (hoặc Kafka/NATS) để sự kiện tới được đúng socket. Vấn đề: user X nối vào server 1 nhưng bàn thắng được xử lý ở server 3 — server 3 không có socket của X. Server nhận sự kiện publish lên kênh, mỗi server đẩy xuống các socket nó đang giữ. Load balancer cũng phải hỗ trợ Upgrade, và khi deploy hay scale down, hàng nghìn client bị ngắt cùng lúc rồi reconnect dồn dập — cần jitter khi reconnect. Redis Pub/Sub là fire-and-forget: server nào đang mất kết nối Redis sẽ lỡ tin luôn.",
        },
      ],
    },
  ],
});
