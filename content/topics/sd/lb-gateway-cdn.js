BK.topic({
  id: "lb-gateway-cdn",
  track: "sd",
  section: "sd-tech",
  title: "Load Balancer, API Gateway, CDN",
  tldr: {
    t: "LB chia tải giữa các instance. API Gateway là cửa vào duy nhất (auth, rate limit, routing). CDN cache nội dung tĩnh ở edge gần user.",
    why: "LB cho phép scale ngang vì client chỉ thấy một địa chỉ, phía sau thêm bớt instance tuỳ ý. Mọi request đều đi qua Gateway nên đặt auth/rate limit ở đó là đủ cho mọi service; CDN giảm latency vì rút ngắn khoảng cách mạng và chặn request trước khi tới origin.",
  },
  story: {
    problem: "Một server không chịu nổi toàn bộ traffic, và chết là sập hệ thống; client cũng không nên biết IP của từng instance. Với microservice, mỗi service tự làm auth, rate limit thì lặp code và dễ sót; user ở xa thì mỗi lần tải ảnh mất 200–300ms chỉ vì khoảng cách vật lý.",
    idea: "Thêm các lớp trung gian trên đường đi của request: LB chia request ra nhiều instance khoẻ mạnh, API Gateway gom các mối quan tâm chung tại một cửa, CDN đưa bản sao nội dung tĩnh tới gần user.",
    tradeoff: "Mỗi lớp thêm một hop latency và một điểm có thể lỗi/cấu hình sai. CDN gây bài toán cache invalidation; Gateway dễ thành nút cổ chai hoặc bị nhồi business logic.",
  },
  points: [
    {
      t: "**Dedicated LB · NLB (L4)** — chỉ đọc IP/port, tốc độ gần phần cứng, hàng triệu request/giây, latency cực thấp.",
      why: "L4 LB đạt hàng triệu request/giây (https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) với latency micro-giây, vì chỉ nhìn header TCP/UDP (IP, port) và chuyển tiếp gói, không phải parse HTTP (kết thúc TLS ở L4 là tuỳ chọn, ví dụ NLB có TLS listener) → mỗi kết nối tốn rất ít CPU. Đổi lại không định tuyến theo URL được.",
    },
    {
      t: "**Dedicated LB · ALB (L7)** — đọc HTTP (URL, cookie, header) để định tuyến thông minh.",
      why: "L7 LB kết thúc kết nối HTTP và đọc request, nên gửi được `/api/*` tới service A, `/images/*` tới service B, hay sticky theo cookie. Đổi lại phải parse HTTP, kết thúc TLS → tốn CPU và thêm latency hơn L4.",
    },
    {
      t: "**Client-side LB** — service A lấy danh sách IP của service B từ Service Discovery (Consul, Eureka) rồi tự chọn (round robin, random), không qua trung gian.",
      why: "Bớt một hop mạng và không có nút cổ chai trung tâm, vì bỏ LB ở giữa — mỗi client tự chia tải. Đổi lại mỗi client phải có thư viện LB và luôn có danh sách instance mới từ Service Discovery; thường dùng cho gọi nội bộ giữa service (gRPC).",
    },
    {
      t: "+ Thuật toán LB: round robin, least connections, consistent hashing (sticky theo user).",
      why: "Round robin đơn giản, hợp khi request đồng đều. Least connections gửi tới instance đang ít việc nhất, hợp khi request dài ngắn khác nhau (WebSocket). Consistent hashing map cùng user về cùng instance để tận dụng cache/session local, và thêm bớt node chỉ ~1/N key bị chuyển chỗ.",
    },
    {
      t: "+ **API Gateway** — routing tới microservice, authentication, rate limiting, request validation, logging. Ví dụ: AWS API Gateway, Kong.",
      why: "Các việc cắt ngang (xác thực token, giới hạn tần suất, log) làm một lần ở Gateway thay vì lặp ở 20 service, vì mọi request từ ngoài đều đi qua đó. Client chỉ cần biết một domain, Gateway map path tới đúng service.",
    },
    {
      t: "+ **CDN** — cache ảnh, video, JS/CSS ở edge; giảm latency và tải origin. Ví dụ: CloudFront, Cloudflare.",
      why: "Edge ở Singapore chỉ vài chục ms, trong khi request Việt Nam → Mỹ tốn ~150–250ms RTT, vì ánh sáng trong cáp quang đi ~200km/ms. Nội dung tĩnh ít đổi nên cache lâu ở edge được → phần lớn request không tới origin, giảm tải và băng thông origin.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/lb-gateway-cdn-request-path.svg",
      caption: "DNS đưa user tới CDN edge gần nhất: nội dung tĩnh hit thì trả ngay, miss mới về origin. Request API đi qua API Gateway (auth, rate limit, routing) rồi Load Balancer chia tải giữa các instance của service.",
      source: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html",
    },
  ],
  cards: [
    [
      "Client-side load balancing là gì?",
      "Client lấy danh sách instance từ service discovery và tự chọn instance để gọi trực tiếp, bỏ hop qua LB trung gian (phổ biến với gRPC).",
    ],
    [
      "API Gateway làm những việc gì?",
      "Routing, authentication, rate limiting, validation, logging/metrics — điểm vào duy nhất cho client.",
    ],
  ],
});
