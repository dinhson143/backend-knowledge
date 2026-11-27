BK.sim({
  id: "lb",
  title: "Load balancer L7 và L4",
  topics: ["networking", "lb-gateway-cdn"],
  scenario: "Request `GET /images/cat.png` cần tới Image service, không phải API service.",
  context: "LB thấy được gì trong request thì mới route theo cái đó được: **Layer 7** (ALB) hiểu HTTP nên route theo nội dung request; **Layer 4** (NLB) chỉ thấy gói TCP/UDP với IP và port. Client gửi `GET /images/cat.png` qua HTTPS; sau Load Balancer có hai service, mỗi service chỉ phục vụ một nhóm path (`/api/*` và `/images/*`). Theo dõi dòng chữ dưới Load Balancer: nó cho biết LB đang nhìn thấy gì trong request.",
  nodes: [
    { id: "client", x: 90, y: 150, label: "Client" },
    { id: "lb", x: 340, y: 150, label: "Load Balancer" },
    { id: "api", x: 620, y: 65, label: "API service", s: "/api/*" },
    { id: "img", x: 620, y: 225, label: "Image service", s: "/images/*" },
  ],
  variants: [
    {
      name: "ALB (Layer 7)",
      steps: [
        {
          note: "Request tới ALB.",
          msgs: [["client", "lb", "GET /images/cat.png"]],
          detail: "Kết nối của client **kết thúc tại ALB**: ALB là proxy, sau đó nó mở kết nối riêng tới backend. Client mở kết nối TCP tới ALB trên port 443, bắt tay TLS, rồi gửi request HTTP `GET /images/cat.png`.",
        },
        {
          note: "ALB **giải mã TLS và đọc HTTP**: thấy path `/images`.",
          set: { lb: "ALB · đọc path, header" },
          detail: "ALB **giải mã TLS** (TLS termination) nhờ giữ certificate của domain, rồi parse HTTP request thành method, path, header, cookie. Nó so path `/images/cat.png` với listener rules (`/api/*` → API target group, `/images/*` → Image target group) và khớp rule thứ hai. Chi phí: mỗi request tốn CPU cho giải mã và parse, thêm vài ms latency so với L4.",
        },
        {
          note: "Định tuyến đúng service theo path.",
          msgs: [
            ["lb", "img", "GET /images/cat.png", "ok"],
            ["img", "lb", "200", "ok"],
            ["lb", "client", "200 image", "ok"],
          ],
          good: ["img"],
          lesson: "L7 route theo URL, header, cookie — hợp microservice; tốn CPU hơn.",
          detail: "ALB gửi request tới một instance trong target group Image service, nhận `200` và trả ảnh về client; API service hoàn toàn không thấy request này. Vì đọc được nội dung, L7 còn làm được nhiều thứ khác: route theo header (canary, A/B), sticky session theo cookie, gắn `X-Forwarded-For`, chặn bằng WAF — rất hợp kiến trúc microservice nhiều service sau một domain.",
        },
      ],
    },
    {
      name: "NLB (Layer 4)",
      steps: [
        {
          note: "Cùng request nhưng đi qua NLB.",
          msgs: [["client", "lb", "TCP SYN :443"]],
          detail: "Cùng request, nhưng LB giờ là NLB, và thứ NLB nhận đầu tiên là gói **TCP SYN tới port 443**. Phần HTTP nằm sau đó, bên trong luồng byte đã mã hoá TLS.",
        },
        {
          note: "NLB chỉ thấy **IP + port**, payload vẫn mã hoá → không biết path.",
          set: { lb: "NLB · chỉ thấy IP:443" },
          detail: "NLB **không thể biết** request muốn gì, vì path `/images/cat.png` nằm trong payload đã mã hoá. NLB làm việc ở tầng transport: chỉ đọc header IP/TCP (source IP, dest IP, port) và chuyển tiếp luồng byte nguyên vẹn, không giải mã. Đổi lại, NLB cực nhanh, giữ được hàng triệu kết nối, latency rất thấp, có IP tĩnh và giữ nguyên IP client.",
        },
        {
          note: "Chọn backend theo hash/round-robin → có thể rơi vào service không phục vụ path này.",
          msgs: [["lb", "api", "TCP stream", "warn"], ["api", "lb", "404", "err"]],
          bad: ["api"],
          lesson: "L4 cực nhanh, hợp TCP/UDP thô hoặc đứng trước L7; không route theo nội dung.",
          detail: "Kết nối rơi vào API service và nhận **404**: NLB chọn backend bằng flow hash (hash 5-tuple IP/port/protocol) — dựa trên kết nối, không dựa trên nội dung. API giải mã, đọc path `/images/cat.png`, không route nào khớp nên trả 404. Thực tế không ai đặt hai service khác nhau chung một target group sau NLB: cấu hình đúng là mỗi service một NLB/port riêng, hoặc NLB đứng trước một tầng L7 (Nginx, Envoy, ALB) để tầng đó route theo path. Bài học: L4 không route theo nội dung, nên chọn nó cho TCP/UDP thô, gRPC/game/IoT cần throughput cao, hoặc làm lớp ngoài cùng.",
        },
      ],
    },
  ],
});
