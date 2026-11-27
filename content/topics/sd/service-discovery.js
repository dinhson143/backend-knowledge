BK.topic({
  id: "service-discovery",
  track: "sd",
  section: "sd-core",
  title: "Service Discovery",
  goal: "Cho service tìm instance đang sống của nhau bằng registry, load balancer hoặc DNS",
  needs: ["lb-gateway-cdn", "sync-vs-async-comm"],
  tldr: {
    t: "Instance của một service lên xuống liên tục (autoscale, deploy, crash), mỗi lần lại có IP mới. **Service discovery** (tìm instance của service) trả lời câu hỏi \"lúc này gọi IP nào\". Nó có một **service registry** (danh sách instance đang sống) và một trong hai cách tra: **client-side** (client hỏi registry rồi tự chọn instance, gọi thẳng) hoặc **server-side** (client gọi một router, router hỏi registry và chuyển tiếp). Trên Kubernetes cả hai đã có sẵn: EndpointSlice là registry, Service + DNS là router.",
    why: "Richardson định nghĩa registry là \"a database of services, their instances and their locations\" và nhấn mạnh nó \"must be highly available\" (https://microservices.io/patterns/service-registry.html). Không có registry thì địa chỉ phải viết cứng trong cấu hình, và mỗi lần một instance đổi IP là caller gọi vào chỗ không còn ai.",
  },
  story: {
    problem: "Service Order gọi Payment. Payment chạy 6 instance, autoscale lên 12 lúc cao điểm, deploy mỗi ngày vài lần; mỗi pod mới có IP mới, pod cũ biến mất. Viết IP vào file config thì sau lần deploy đầu tiên Order đã gọi vào IP chết. Dùng DNS thường với TTL dài thì client còn giữ danh sách cũ vài phút sau khi pod đã tắt.",
    idea: "Tách việc **ghi nhận** instance (đăng ký khi lên, xoá khi xuống hoặc khi health check hỏng) khỏi việc **tra cứu** (caller hỏi \"Payment đang ở đâu\" ngay trước khi gọi). Registry là nguồn sự thật duy nhất; client hoặc router đọc nó để chọn instance còn sống.",
    tradeoff: "Registry thành một thành phần hạ tầng nữa phải chạy HA; dữ liệu trong cache của client luôn có thể cũ vài giây nên caller vẫn phải chịu được lời gọi lỗi (timeout, retry sang instance khác). Client-side discovery bớt một hop nhưng mỗi ngôn ngữ cần một thư viện; server-side đơn giản cho client nhưng thêm một hop và một router phải scale.",
  },
  table: {
    head: ["", "Client-side discovery", "Server-side discovery"],
    rows: [
      {
        cells: ["Ai tra registry", "Client (thư viện trong app)", "Router / load balancer đứng giữa"],
        why: "Client-side: client tra registry rồi tự chọn instance (https://microservices.io/patterns/client-side-discovery.html). Server-side: client gửi request tới router, router tra registry và chuyển tiếp, nên \"the client code is simpler since it does not have to deal with discovery\" (https://microservices.io/patterns/server-side-discovery.html).",
      },
      {
        cells: ["Số hop mạng", "Một: client → instance", "Hai: client → router → instance"],
        why: "Richardson liệt kê lợi ích của client-side là \"Fewer moving parts and network hops compared to Server-side Discovery\". Router ở giữa thêm latency và phải được nhân bản để không thành SPOF.",
      },
      {
        cells: ["Thuật toán chia tải", "Client chọn (round robin, least-request, theo latency)", "Router chọn"],
        why: "Client-side cho phép chọn theo từng request với thông tin client thấy được (latency, số request đang chờ). gRPC gọi kiểu này là client-side load balancing, đổi lại client phức tạp hơn và phải cài cho từng ngôn ngữ (https://grpc.io/blog/grpc-load-balancing/).",
      },
      {
        cells: ["Ràng buộc", "Client gắn với một registry; cần thư viện cho mỗi ngôn ngữ", "Router phải hiểu giao thức (HTTP, gRPC…) và phải scale"],
        why: "Hai nhược điểm của client-side theo Richardson: \"couples the client to the Service Registry\" và phải viết logic discovery cho từng ngôn ngữ/framework. Server-side thì router \"will also need to be replicated for availability and capacity\" trừ khi cloud cung cấp sẵn.",
      },
      {
        cells: ["Ví dụ", "Eureka + Ribbon (Spring Cloud), gRPC với headless Service", "AWS ELB, Kubernetes Service (kube-proxy trên mỗi node)"],
        why: "Richardson lấy AWS ELB làm router server-side, và Kubernetes \"run a proxy on each host that functions as a server-side discovery router\". Ví dụ client-side của ông là Spring Cloud với Eureka (registry) và Ribbon (HTTP client tự chọn instance).",
      },
    ],
  },
  points: [
    {
      t: "**Đăng ký: self-registration hay third-party registration.** Self: instance tự đăng ký khi khởi động, **gia hạn định kỳ** và tự huỷ khi tắt. Third-party: một registrar riêng theo dõi instance và đăng ký hộ, thường dựa trên health check.",
      why: "Self-registration làm service gắn với registry và có nhược điểm: instance còn chạy nhưng không phục vụ được \"will often lack the self-awareness to unregister itself\" (https://microservices.io/patterns/self-registration.html). Third-party giữ code service sạch và registrar \"can perform health checks\" để đăng ký/huỷ theo kết quả (https://microservices.io/patterns/3rd-party-registration.html); Kubernetes là ví dụ của kiểu này.",
    },
    {
      t: "**Registry phải HA, và client nên cache kết quả tra.** Ví dụ registry: Consul, Eureka, etcd, ZooKeeper; Kubernetes, AWS ELB có registry ngầm.",
      why: "Mọi lời gọi giữa service đều phụ thuộc registry, nên registry chết là cả hệ không tìm được nhau. Cache ở client giúp chạy tiếp khi registry tạm chết, nhưng Richardson cảnh báo dữ liệu cache sẽ cũ dần, nên cache chỉ là lớp đệm, không thay được registry HA (https://microservices.io/patterns/service-registry.html).",
    },
    {
      t: "**Vì sao không chỉ dùng DNS round-robin** (một tên, nhiều bản ghi A): Kubernetes nêu ba lý do và chọn virtual IP + proxy cho Service thường.",
      why: "Trang Virtual IPs and Service Proxies liệt kê: nhiều bản cài DNS không tôn trọng TTL và cache quá hạn; một số app chỉ tra DNS một lần rồi cache mãi; và kể cả khi app tra lại đúng cách, TTL thấp hoặc bằng 0 tạo tải lớn lên DNS (https://kubernetes.io/docs/reference/networking/virtual-ips/). Pod đổi IP liên tục nên ba lỗi này làm caller gọi vào pod đã chết.",
    },
    {
      t: "**Kubernetes: discovery có sẵn.** EndpointSlice controller liên tục cập nhật danh sách IP pod khớp selector (registry, kiểu third-party); Service có một **ClusterIP** và tên DNS `my-svc.my-namespace.svc.cluster.local`; kube-proxy trên mỗi node chuyển gói tới một pod (router server-side).",
      why: "Controller của Service \"continuously scans for Pods that match its selector\" và cập nhật EndpointSlice (https://kubernetes.io/docs/concepts/services-networking/service/). kube-proxy theo dõi Service và EndpointSlice rồi cài luật để bắt traffic tới `clusterIP` và chuyển tới một endpoint; ở mode `iptables` (mặc định trên Linux ở Kubernetes 1.37, bản sau sẽ đổi sang `nftables`) backend được chọn ngẫu nhiên khi client kết nối (https://kubernetes.io/docs/reference/networking/virtual-ips/). Pod chưa ready bị rút khỏi EndpointSlice, nên readiness probe chính là health check của registry này.",
    },
    {
      t: "**Tên DNS ngắn chỉ tìm trong namespace của pod gọi.** Pod ở namespace `test` gọi `data` thì không thấy Service `data` của namespace `prod`; phải gọi `data.prod` hoặc tên đầy đủ `data.prod.svc.cluster.local`.",
      why: "kubelet ghi `/etc/resolv.conf` của pod với danh sách `search` bắt đầu bằng `<namespace>.svc.cluster.local`, nên tên ngắn được nối thêm namespace của chính pod (https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/). Gọi chéo namespace mà viết tên ngắn là lỗi \"không resolve được\" hay gặp khi tách team ra nhiều namespace.",
    },
    {
      t: "**Headless Service (`clusterIP: None`) trả thẳng IP từng pod** qua DNS, không có virtual IP, kube-proxy không xử lý. Dùng khi client muốn tự chọn pod: client-side load balancing, hoặc gọi đúng một pod của StatefulSet.",
      why: "Với headless Service, tên DNS \"resolves to the set of IPs of all of the Pods selected by the Service. Clients are expected to consume the set or else use standard round-robin selection from the set\" (https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/). Đây là cách nối Kubernetes với cơ chế discovery khác hoặc với thư viện load balancing của client.",
    },
    {
      t: "**gRPC qua ClusterIP thường dồn hết vào một pod.** gRPC chạy trên HTTP/2, một kết nối dài mang rất nhiều RPC; ClusterIP chọn pod **lúc mở kết nối**, nên mọi RPC trên kết nối đó tới cùng một pod. Cách sửa: headless Service + client-side load balancing của gRPC, hoặc một proxy L7 (service mesh, gateway) chia theo từng request.",
      why: "kube-proxy chọn backend khi client kết nối tới virtual IP rồi chuyển gói của kết nối đó (https://kubernetes.io/docs/reference/networking/virtual-ips/); nó không nhìn vào từng stream HTTP/2. gRPC giải thích chỉ load balancer L7 mới \"distribute the streams from one client among multiple backends\", còn client-side LB bỏ được hop trung gian (https://grpc.io/blog/grpc-load-balancing/). Scale Payment từ 3 lên 10 pod mà biểu đồ CPU chỉ có 3 pod bận là dấu hiệu của lỗi này.",
    },
  ],
  sections: [
    {
      title: "Client-side discovery tối giản (Python)",
      code: {
        lang: "python",
        lines: [
          "import itertools, socket",
          "",
          "def resolve(host, port):",
          ["    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)", "Với headless Service, tên DNS trả về IP của mọi pod đang ready; đây là bước \"tra registry\"."],
          "    return sorted({info[4][0] for info in infos})",
          "",
          "class RoundRobin:",
          "    def __init__(self, host, port):",
          "        self.host, self.port = host, port",
          "        self.refresh()",
          "",
          "    def refresh(self):",
          ["        self.ips = resolve(self.host, self.port)", "Tra lại định kỳ hoặc khi gọi lỗi: danh sách trong cache luôn có thể cũ."],
          "        self.cycle = itertools.cycle(self.ips)",
          "",
          "    def pick(self):",
          ["        return next(self.cycle), self.port", "Client tự chọn instance cho từng request: không có hop qua router."],
          "",
          ["lb = RoundRobin(\"localhost\", 8080)", "Trong cluster: \"payment.prod.svc.cluster.local\" của một headless Service."],
          "print(lb.ips, lb.pick())",
        ],
      },
    },
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Pod đang tắt vẫn nhận request trong vài giây.",
          why: "Việc rút pod khỏi EndpointSlice và việc gửi `SIGTERM` diễn ra cùng lúc, và kube-proxy trên từng node cập nhật luật sau đó một chút. App phải tiếp tục phục vụ một lúc sau `SIGTERM` (hoặc dùng `preStop`), như bài `deployment-safety` mô tả.",
        },
        {
          t: "Client cache danh sách instance mà không bao giờ làm mới.",
          why: "Đây đúng là lý do Kubernetes không dựa vào DNS round-robin. Client-side discovery phải làm mới định kỳ và khi gọi lỗi, nếu không thì instance mới không nhận tải còn instance đã chết vẫn bị gọi.",
        },
        {
          t: "Health check của registry chỉ kiểm process còn sống.",
          why: "Instance còn chạy nhưng không phục vụ được (hết connection pool, mất kết nối DB) vẫn ở trong registry và nhận traffic. Health check cho discovery nên phản ánh \"nhận request được không\" (readiness), không chỉ \"process còn sống\" (liveness).",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Trong phỏng vấn, nói đủ ba phần: registry là gì và ai cập nhật nó (self hay third-party), ai tra nó (client hay router), và khi registry chết thì chuyện gì xảy ra.",
      why: "Ba câu này là toàn bộ pattern theo microservices.io. Câu thứ ba cho thấy bạn nghĩ tới failure: client cache danh sách cũ và chạy tiếp một lúc, còn registry phải chạy HA.",
    },
    {
      t: "Nếu hệ chạy trên Kubernetes, nói thẳng: Service + DNS đã là server-side discovery, chỉ cần thêm gì khi gọi gRPC hoặc cần chia tải theo request.",
      why: "Interviewer muốn biết bạn không dựng thêm Eureka hay Consul khi nền tảng đã có sẵn, và biết chỗ cơ chế có sẵn hụt (kết nối HTTP/2 dài, chia tải theo kết nối).",
    },
  ],
  cards: [
    [
      "Client-side và server-side discovery khác nhau ở đâu?",
      "Client-side: client tra registry, tự chọn instance, gọi thẳng (ít hop, cần thư viện mỗi ngôn ngữ). Server-side: client gọi router/LB, router tra registry rồi chuyển tiếp (client đơn giản, thêm một hop, router phải scale).",
    ],
    [
      "Instance mới lên thì client biết bằng cách nào?",
      "Instance được đăng ký vào registry (tự đăng ký, hoặc registrar như Kubernetes đăng ký khi pod ready). Client hoặc router đọc registry ở lần tra tiếp theo, hoặc nhận thông báo thay đổi qua watch.",
    ],
    [
      "Vì sao Kubernetes không dùng DNS round-robin cho Service thường?",
      "DNS hay bị cache quá TTL, có app chỉ tra một lần rồi cache mãi, và TTL rất thấp tạo tải lớn lên DNS. Kubernetes dùng ClusterIP cố định và kube-proxy chuyển tới pod.",
    ],
    [
      "Vì sao gRPC qua ClusterIP hay dồn tải vào một pod?",
      "ClusterIP chọn pod khi mở kết nối; gRPC dùng một kết nối HTTP/2 dài cho nhiều RPC, nên mọi RPC đi cùng một pod. Dùng headless Service + client-side LB, hoặc proxy L7.",
    ],
    [
      "Registry chết thì sao?",
      "Client dùng danh sách đã cache và chạy tiếp một thời gian, nhưng không thấy instance mới và có thể gọi instance đã chết. Vì vậy registry phải chạy HA (nhiều node, có replication).",
    ],
    [
      "Pod ở namespace `test` gọi `orders` nhưng Service nằm ở `prod`. Sửa thế nào?",
      "Gọi `orders.prod` hoặc `orders.prod.svc.cluster.local`. Tên ngắn chỉ được nối với namespace của pod gọi.",
    ],
  ],
  related: ["lb", "k8s-reconcile"],
});
