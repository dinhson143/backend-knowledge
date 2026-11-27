BK.topic({
  id: "k8s-core",
  track: "cloud",
  section: "cloud-k8s",
  title: "Kubernetes cốt lõi",
  goal: "Giải thích reconcile loop và vai trò Pod, Deployment, Service, Ingress",
  needs: ["container-basics"],
  tldr: {
    t: "Bạn **khai báo trạng thái mong muốn** (YAML) cho **API server**, etcd lưu lại. Các **controller** lặp mãi: so trạng thái thật với mong muốn rồi sửa phần lệch; **scheduler** chọn node cho pod; **kubelet** trên mỗi node chạy container. Mọi object nối với nhau bằng **label/selector**, không bằng tên cứng: Deployment tìm pod của nó, Service tìm pod để chuyển traffic đều qua selector.",
    why: "Kubernetes tự chữa lành vì không ai \"ra lệnh\" cả: mỗi controller chỉ đưa trạng thái hiện tại lại gần `spec`, nên pod chết, node chết hay scale tay đều quy về cùng một việc là sửa lệch (https://kubernetes.io/docs/concepts/architecture/controller/). Nối bằng selector vì pod là thứ dùng một lần, tên và IP đổi mỗi lần tạo lại; label thì được khai báo trong template nên pod mới luôn mang đúng label.",
  },
  story: {
    problem: "Chạy container bằng `docker run` trên vài chục máy: container chết không ai khởi động lại, máy hỏng phải tự chuyển container sang máy khác, deploy bản mới phải SSH từng máy, và client phải biết IP của từng container đang sống.",
    idea: "Gom các máy thành một cluster có một API duy nhất. Bạn mô tả \"muốn 3 bản của image này, mở cổng qua tên `web`\"; hệ thống tự đặt container lên máy, tự thay cái chết, tự cập nhật danh sách địa chỉ phía sau một tên ổn định.",
    tradeoff: "Nhiều khái niệm và nhiều thành phần phải hiểu (và phải nâng version), mạng và bảo mật có nhiều lớp. Với một vài service đơn giản trên một cloud, nền được quản lý như ECS thường ít việc hơn (xem `ecs-vs-eks`).",
  },
  sections: [
    {
      title: "Kiến trúc: control plane và node",
      table: {
        head: ["Thành phần", "Ở đâu", "Làm gì"],
        rows: [
          {
            cells: ["kube-apiserver", "Control plane", "Cửa vào duy nhất: mọi đọc/ghi object đều qua đây"],
            why: "Mọi thành phần khác (controller, scheduler, kubelet, `kubectl`) chỉ nói chuyện với API server, không nói chuyện với nhau. Nhờ đó xác thực, RBAC, admission và validate nằm một chỗ, và các thành phần thay thế được độc lập.",
          },
          {
            cells: ["etcd", "Control plane", "Key-value store nhất quán lưu toàn bộ trạng thái cluster"],
            why: "etcd chạy Raft nên cần **đa số** node sống mới ghi được; vì vậy chạy 3 hoặc 5 bản trên các AZ khác nhau (xem `cap`). Mất etcd là mất trạng thái cả cluster, nên backup etcd là việc số một khi tự vận hành.",
          },
          {
            cells: ["kube-scheduler", "Control plane", "Tìm pod chưa có node và gán node phù hợp"],
            why: "Scheduler chỉ ghi `nodeName` vào pod; nó không chạy container. Nó lọc node đủ `requests` CPU/RAM, khớp nodeSelector/affinity, chịu được taint, rồi chấm điểm. Không node nào qua được bộ lọc thì pod nằm `Pending`.",
          },
          {
            cells: ["kube-controller-manager", "Control plane", "Chạy các controller: Deployment, ReplicaSet, Node, Job, EndpointSlice…"],
            why: "Mỗi controller là một vòng lặp riêng cho một loại object. Gom chúng vào một binary để dễ vận hành, nhưng về logic chúng độc lập và chỉ phối hợp qua API server.",
          },
          {
            cells: ["cloud-controller-manager", "Control plane (tuỳ chọn)", "Nói chuyện với cloud: tạo load balancer, gắn node"],
            why: "Tách phần riêng của từng cloud ra khỏi lõi Kubernetes. Service `type: LoadBalancer` tạo được load balancer thật là nhờ thành phần này (hoặc controller riêng như AWS Load Balancer Controller trên EKS).",
          },
          {
            cells: ["kubelet", "Mỗi node", "Chạy pod được gán cho node, chạy probe, báo trạng thái"],
            why: "Kubelet watch các pod có `nodeName` là node của nó, gọi container runtime qua **CRI** để chạy, rồi báo trạng thái lên API server (https://kubernetes.io/docs/concepts/architecture/cri/). Node mất liên lạc thì control plane biết nhờ heartbeat (Lease trong namespace `kube-node-lease`).",
          },
          {
            cells: ["kube-proxy", "Mỗi node (tuỳ chọn)", "Cài luật mạng để IP của Service chuyển tới pod"],
            why: "ClusterIP là IP ảo, không card mạng nào mang nó; kube-proxy biến nó thành luật chuyển tiếp (iptables/IPVS) dựa trên EndpointSlice. Một số plugin mạng (ví dụ dựa trên eBPF) làm thay phần này nên kube-proxy là tuỳ chọn (https://kubernetes.io/docs/concepts/overview/components/).",
          },
          {
            cells: ["Container runtime", "Mỗi node", "containerd, CRI-O… thực sự tạo container"],
            why: "Kubernetes không tự tạo container; runtime nhận lệnh qua CRI rồi dùng namespace và cgroup như mọi container khác (xem `container-basics`).",
          },
        ],
      },
    },
    {
      title: "Reconcile loop: khai báo thay vì ra lệnh",
      points: [
        {
          t: "Mỗi object có `spec` (bạn muốn gì) và `status` (đang thế nào). Controller đọc cả hai, thấy lệch thì **ghi thay đổi vào API server**; thành phần khác thấy thay đổi đó và làm tiếp phần của mình.",
          why: "Tài liệu Kubernetes dùng ví dụ máy điều hoà: bạn đặt nhiệt độ (desired state), máy so với nhiệt độ phòng (current state) rồi bật tắt để kéo lại gần (https://kubernetes.io/docs/concepts/architecture/controller/). Job controller, chẳng hạn, không chạy pod nào: nó bảo API server tạo pod, scheduler và kubelet lo phần còn lại.",
        },
        {
          t: "Xoá một pod của Deployment: ReplicaSet controller thấy 2/3 → tạo pod mới → scheduler gán node → kubelet chạy → EndpointSlice cập nhật. Không bước nào là \"lệnh khôi phục\".",
          why: "Vì mọi thành phần chỉ phản ứng với trạng thái chứ không với sự kiện, nên lỡ một sự kiện cũng không sao: lần lặp sau vẫn thấy lệch và sửa. Đây là lý do hệ thống bền với lỗi mạng, restart controller, hay hai thay đổi chồng nhau.",
        },
        {
          t: "`kubectl apply -f` (khai báo) thay vì chuỗi lệnh `kubectl run/scale/set image` (mệnh lệnh). Lưu YAML trong Git, để công cụ GitOps (Argo CD, Flux) apply.",
          why: "File YAML là trạng thái mong muốn đầy đủ, review và rollback được như code. Sửa tay bằng lệnh tạo ra trạng thái không ai ghi lại; GitOps phát hiện lệch so với Git và kéo về.",
        },
      ],
    },
    {
      title: "Pod: đơn vị chạy nhỏ nhất",
      points: [
        {
          t: "Pod là **một hoặc nhiều container** dùng chung network namespace (một IP, một dải port, gọi nhau qua `localhost`) và có thể dùng chung volume. Scheduler đặt cả pod lên một node.",
          why: "Kubernetes ghi rõ: \"Within a Pod, containers share an IP address and port space, and can find each other via `localhost`\" (https://kubernetes.io/docs/concepts/workloads/pods/). Vì thế hai container trong một pod không được nghe cùng port.",
        },
        {
          t: "**Sidecar**: container phụ chạy cạnh app (proxy service mesh, agent đẩy log, làm mới file cấu hình). Init container chạy xong trước khi app khởi động.",
          why: "Đặt chung pod vì chúng phải sống cùng vòng đời và cùng máy với app; tách thành pod riêng thì không dùng chung được `localhost` và volume. Sidecar khai báo đúng kiểu sẽ khởi động trước app và chạy tới khi pod tắt.",
        },
        {
          t: "Pod là thứ **dùng một lần**: chết thì được thay bằng pod mới (tên mới, IP mới), không sửa pod cũ. Gần như không bao giờ tạo pod trực tiếp; dùng Deployment, Job, StatefulSet.",
          why: "Pod tạo tay không có controller nào trông: node chết là pod mất luôn. Workload resource giữ template và tạo lại pod khi cần (https://kubernetes.io/docs/concepts/workloads/pods/).",
        },
      ],
    },
    {
      title: "Deployment → ReplicaSet → Pod",
      points: [
        {
          t: "**ReplicaSet** giữ đúng N pod khớp selector. **Deployment** quản lý ReplicaSet: mỗi lần `spec.template` đổi (image, env…), nó tạo ReplicaSet mới và chuyển dần số pod từ cũ sang mới.",
          why: "Tách hai tầng để rolling update và rollback chỉ còn là đổi số replica giữa hai ReplicaSet. Chỉ đổi template mới tạo revision mới; scale (`replicas`) thì không (https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).",
        },
        {
          t: "Rolling update theo `maxSurge` (được dư bao nhiêu pod) và `maxUnavailable` (được thiếu bao nhiêu), **mặc định đều 25%**. Rollback: `kubectl rollout undo`; mặc định giữ 10 ReplicaSet cũ (`revisionHistoryLimit`).",
          why: "Với 4 replica, 25% nghĩa là tối đa 5 pod cùng lúc và tối thiểu 3 pod sẵn sàng, nên công suất không rơi quá một phần tư trong lúc deploy. Rollback nhanh vì ReplicaSet cũ vẫn còn, chỉ cần scale nó lên lại.",
        },
        {
          t: "Không sửa trực tiếp ReplicaSet do Deployment tạo, không tạo pod khác mang label trùng selector của Deployment.",
          why: "Deployment sẽ ghi đè thay đổi trên ReplicaSet của nó. Pod lạ khớp selector bị ReplicaSet đếm vào N và có thể khiến nó xoá bớt pod thật của bạn. Deployment gắn thêm label `pod-template-hash` để các ReplicaSet của chính nó không giẫm lên nhau.",
        },
      ],
    },
    {
      title: "Service: địa chỉ ổn định cho một nhóm pod",
      table: {
        head: ["Kiểu", "Truy cập từ", "Dùng khi"],
        rows: [
          {
            cells: ["ClusterIP (mặc định)", "Trong cluster", "Service gọi service nội bộ"],
            why: "Service nhận một IP ảo và một tên DNS `<service>.<namespace>.svc.cluster.local`; controller liên tục cập nhật **EndpointSlice** theo pod khớp selector (https://kubernetes.io/docs/concepts/services-networking/service/). Client gọi tên, không quan tâm pod nào đang sống.",
          },
          {
            cells: ["NodePort", "Port trên mọi node (mặc định 30000–32767)", "Có load balancer ngoài tự trỏ vào node; ít dùng trực tiếp"],
            why: "Mở cùng một port trên mọi node rồi chuyển vào Service. Dải port cao và phải biết IP node nên hiếm khi để client gọi thẳng; thường là lớp bên dưới của LoadBalancer.",
          },
          {
            cells: ["LoadBalancer", "Internet / VPC", "Đưa service ra ngoài bằng load balancer của cloud"],
            why: "Cloud controller tạo một load balancer thật cho mỗi Service kiểu này. Nhiều service HTTP thì tốn nhiều load balancer, nên thường gom qua một Gateway/Ingress.",
          },
          {
            cells: ["Headless (`clusterIP: None`)", "Trong cluster", "Client cần gọi thẳng từng pod (database, StatefulSet)"],
            why: "Không cấp IP ảo, kube-proxy không xử lý; DNS trả thẳng IP từng pod. Client tự chọn pod, ví dụ gọi đúng primary của một cụm database.",
          },
          {
            cells: ["ExternalName", "Trong cluster", "Đặt tên nội bộ cho một DNS bên ngoài"],
            why: "Chỉ là bản ghi CNAME: code gọi `db` trong cluster, còn thật ra trỏ tới một hostname database được quản lý ngoài cluster.",
          },
        ],
      },
    },
    {
      title: "Ingress hay Gateway API",
      table: {
        head: ["", "Ingress", "Gateway API"],
        rows: [
          {
            cells: ["Trạng thái", "GA nhưng **đóng băng**: không phát triển thêm", "Được Kubernetes khuyến nghị cho việc mới"],
            why: "Trang Ingress ghi: API vẫn GA, không có kế hoạch gỡ, nhưng \"is no longer being developed\" và dự án khuyên dùng Gateway (https://kubernetes.io/docs/concepts/services-networking/ingress/). Cluster cũ vẫn chạy Ingress bình thường.",
          },
          {
            cells: ["Object", "Một object Ingress (host, path → Service)", "GatewayClass → Gateway → HTTPRoute/GRPCRoute"],
            why: "Gateway API tách theo vai trò: bên hạ tầng định nghĩa GatewayClass, đội vận hành cluster tạo Gateway (listener, TLS), đội app tự gắn HTTPRoute của mình (https://kubernetes.io/docs/concepts/services-networking/gateway/). Ingress gom tất cả vào một object nên quyền khó chia.",
          },
          {
            cells: ["Tính năng nâng cao", "Qua annotation riêng của từng controller", "Có sẵn trong API: match header, chia traffic theo trọng số"],
            why: "Annotation không chuẩn nên chuyển từ controller này sang controller khác phải viết lại. Gateway API đưa các tính năng này vào spec, nên canary theo trọng số mang được giữa các implementation.",
          },
          {
            cells: ["Cần controller", "Có (tạo Ingress mà không có controller thì không có tác dụng)", "Có (implementation của GatewayClass)"],
            why: "Cả hai chỉ là khai báo; phải có controller đọc chúng và cấu hình proxy hoặc load balancer thật (trên EKS: AWS Load Balancer Controller tạo ALB).",
          },
        ],
      },
    },
    {
      title: "ConfigMap và Secret",
      points: [
        {
          t: "**ConfigMap** giữ cấu hình không bí mật; **Secret** giữ mật khẩu, token. Cả hai gắn vào pod dưới dạng biến môi trường hoặc file.",
          why: "Tách cấu hình khỏi image nên cùng một image chạy ở dev và prod. Gắn dạng volume thì file trong pod **dần dần** được cập nhật khi ConfigMap đổi (trễ tới một chu kỳ sync của kubelet cộng thời gian cache); dùng làm biến môi trường thì phải restart pod; mount bằng `subPath` thì **không** nhận cập nhật (https://kubernetes.io/docs/concepts/configuration/configmap/).",
        },
        {
          t: "Secret mặc định **không mã hoá** trong etcd (chỉ base64). Ai tạo được pod (hay Deployment) trong một namespace thì đọc được mọi Secret của namespace đó.",
          why: "Pod được phép mount bất kỳ Secret nào trong namespace của nó, nên quyền tạo pod gián tiếp là quyền đọc Secret (https://kubernetes.io/docs/concepts/configuration/secret/). Cách phòng: bật mã hoá at rest, RBAC tối thiểu cho Secret, chỉ gắn Secret vào container cần nó, hoặc dùng secret store bên ngoài. EKS từ 1.28 đã mã hoá sẵn bằng KMS (xem `eks`).",
        },
      ],
    },
    {
      title: "Namespace và RBAC",
      points: [
        {
          t: "**Namespace** là phạm vi tên: tên object chỉ cần duy nhất trong namespace. Một số object là của cả cluster (Node, PersistentVolume, StorageClass).",
          why: "Namespace cho phép nhiều team dùng chung cluster mà không đụng tên, và là chỗ gắn ResourceQuota, RBAC. Đây là ranh giới **mềm**: pod các namespace vẫn chung node, chung kernel, và mặc định gọi được nhau qua mạng nếu không có NetworkPolicy (https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/).",
        },
        {
          t: "**Role** (trong một namespace) / **ClusterRole** (cả cluster) liệt kê quyền; **RoleBinding** / **ClusterRoleBinding** gán quyền cho user, group hoặc **ServiceAccount** (danh tính của pod).",
          why: "RBAC chỉ có quyền cộng thêm, không có luật \"deny\" (https://kubernetes.io/docs/reference/access-authn-authz/rbac/), nên cách an toàn là bắt đầu từ không có gì và cấp đúng thứ cần. RoleBinding trỏ tới một ClusterRole sẽ chỉ cấp quyền đó trong namespace của binding, giúp dùng lại định nghĩa quyền chung.",
        },
      ],
    },
    {
      title: "Các workload khác",
      table: {
        head: ["Object", "Khác Deployment ở đâu"],
        rows: [
          {
            cells: ["StatefulSet", "Pod có tên cố định (`db-0`, `db-1`) và volume riêng đi theo từng pod"],
            why: "Database, broker cần danh tính ổn định và dữ liệu không lẫn giữa các bản; Deployment coi mọi pod như nhau nên không đáp ứng được. Chi tiết vận hành thuộc topic chạy ổn định trên Kubernetes.",
          },
          {
            cells: ["DaemonSet", "Đúng một pod trên mỗi node (agent log, monitoring, plugin mạng)"],
            why: "Agent cần đọc dữ liệu của từng máy nên phải có mặt ở mọi node; node mới tham gia thì tự có pod.",
          },
          {
            cells: ["Job / CronJob", "Chạy tới khi xong rồi dừng; CronJob tạo Job theo lịch"],
            why: "Deployment luôn giữ N pod chạy và khởi động lại pod thoát; tác vụ batch cần ngược lại: chạy xong là xong, lỗi thì thử lại tới giới hạn.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Mở đầu câu trả lời về Kubernetes bằng reconcile loop, rồi mới kể object.",
      why: "Hiểu vòng lặp thì giải thích được mọi hành vi (tự chữa lành, rolling update, scale) mà không phải học thuộc từng trường hợp; người phỏng vấn hay hỏi tiếp \"thành phần nào làm việc đó\".",
    },
    {
      t: "Khi vẽ, ghi rõ đường đi của request: client → load balancer/Gateway → Service → pod; và đường đi của thay đổi: `kubectl apply` → API server → controller → scheduler → kubelet.",
      why: "Hai luồng này hay bị trộn. Tách ra cho thấy bạn biết control plane không nằm trên đường đi của traffic: control plane sập thì pod đang chạy vẫn phục vụ, chỉ là không ai sửa được lệch.",
    },
    {
      t: "Nói về bảo mật thì nhắc: Secret không mã hoá mặc định, quyền tạo pod là quyền đọc Secret, namespace là ranh giới mềm.",
      why: "Ba ý này phân biệt người đã vận hành Kubernetes với người chỉ đọc giới thiệu, và dẫn tự nhiên sang RBAC tối thiểu, NetworkPolicy, secret store.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/k8s-core-components.svg",
      caption: "Control plane và node. Đường xanh: mọi thay đổi trạng thái đi qua kube-apiserver, chỉ apiserver đọc ghi etcd; kubelet gọi container runtime qua CRI. Đường cam: traffic giữa các pod đi theo luật mạng do kube-proxy cài trên node, không qua control plane.",
      source: "https://kubernetes.io/docs/concepts/overview/components/",
    },
    {
      src: "content/svg/k8s-core-deployment-service-gateway.svg",
      caption: "Giữa rolling update: Deployment có hai ReplicaSet; Service chọn pod theo `app=web` nên gồm cả v1 lẫn v2, EndpointSlice chỉ giữ pod Ready. HTTPRoute gắn vào Gateway bằng `parentRefs` và trỏ tới Service bằng `backendRefs`.",
      source: "https://kubernetes.io/docs/concepts/services-networking/gateway/",
    },
  ],
  cards: [
    [
      "Xoá một pod của Deployment thì chuyện gì xảy ra, thành phần nào làm?",
      "ReplicaSet controller thấy thiếu pod so với replicas → tạo pod mới; scheduler gán node; kubelet chạy container; EndpointSlice cập nhật để Service gửi traffic tới pod mới.",
    ],
    [
      "Service tìm pod bằng cách nào? Đổi label của pod thì sao?",
      "Qua label selector; controller cập nhật EndpointSlice theo pod khớp selector. Đổi label thì pod bị rút khỏi Service và ReplicaSet tạo pod thay thế; pod cũ thành mồ côi.",
    ],
    [
      "Vì sao dự án mới nên chọn Gateway API thay vì Ingress?",
      "Ingress đã đóng băng; Gateway API có sẵn match header, chia traffic theo trọng số, tách quyền theo vai trò (GatewayClass, Gateway, Route) và mang được giữa các implementation.",
    ],
    [
      "Ai tạo được Deployment trong namespace thì có đọc được Secret không?",
      "Có. Pod mount được mọi Secret trong namespace, nên quyền tạo pod (kể cả gián tiếp qua Deployment) là quyền đọc Secret.",
    ],
    [
      "Control plane sập thì app đang chạy có sập không?",
      "Không ngay. Pod và luật mạng trên node vẫn chạy; chỉ là không deploy, scale hay tự chữa lành được cho tới khi control plane sống lại.",
    ],
    [
      "maxSurge và maxUnavailable mặc định là bao nhiêu, nghĩa là gì?",
      "Đều 25%: lúc deploy được dư tối đa 25% số pod và thiếu tối đa 25% số pod sẵn sàng.",
    ],
  ],
  related: ["k8s-reconcile", "eks-flow"],
});
