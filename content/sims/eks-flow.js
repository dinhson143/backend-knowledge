BK.sim({
  id: "eks-flow",
  title: "EKS: deploy, scale 2 lớp và Pod Identity",
  topics: ["eks"],
  scenario: "Deployment `web` chạy trên 2 node EC2; ingress là ALB qua AWS Load Balancer Controller.",
  context: "**EKS control plane** (API server, etcd, scheduler, controller manager) do AWS quản lý: mọi thay đổi đều là ghi object vào API server, rồi các controller đọc và làm cụm khớp với object đó. **Node A/B/C** là EC2 trong cluster; mỗi node có kubelet chạy pod và VPC CNI cấp IP. **Karpenter** là autoscaler cấp node; **AWS Load Balancer Controller** (chạy dưới dạng pod, không vẽ riêng) đồng bộ IP pod vào **ALB**. Theo dõi chữ dưới API server (ReplicaSet, HPA, số pod Pending/Ready) và dưới từng node (version pod, CPU, IP): khác ECS, ở đây scale có **hai lớp** — số pod và số node.",
  h: 360,
  nodes: [
    { id: "dev", x: 90, y: 60, label: "ArgoCD / kubectl", w: 150 },
    { id: "api", x: 310, y: 170, label: "EKS control plane", w: 170, s: "API server · etcd · scheduler" },
    { id: "karp", x: 90, y: 300, label: "Karpenter" },
    { id: "n1", x: 540, y: 60, label: "Node A (EC2)", s: "pod v1 ×2" },
    { id: "n2", x: 540, y: 180, label: "Node B (EC2)", s: "pod v1 ×2" },
    { id: "n3", x: 540, y: 300, label: "Node C", s: "(chưa có)" },
    { id: "alb", x: 720, y: 180, label: "ALB", w: 120, s: "targets: pod IP" },
  ],
  links: [
    ["dev", "api"],
    ["api", "n1"],
    ["api", "n2"],
    ["api", "n3"],
    ["karp", "api"],
    ["karp", "n3"],
    ["n1", "alb"],
    ["n2", "alb"],
    ["n3", "alb"],
  ],
  variants: [
    {
      name: "Rolling deploy",
      steps: [
        {
          note: "ArgoCD (GitOps) apply Deployment `web` image `v2` lên **API server**; trạng thái lưu vào etcd.",
          msgs: [["dev", "api", "apply Deployment web:v2"]],
          set: { api: "Deployment web · ReplicaSet v2" },
          detail: "Deployment controller tạo **ReplicaSet mới** cho v2 sau khi ArgoCD apply manifest mới. ArgoCD thấy commit mới trong Git repo (image đổi sang `web:v2`) và apply Deployment lên **API server**; API server validate, chạy admission webhook rồi lưu object vào **etcd**. Controller thấy pod template đổi nên tạo ReplicaSet v2 và giữ ReplicaSet v1 để scale dần về 0. GitOps nghĩa là Git là source of truth: ai đó `kubectl edit` tay thì ArgoCD phát hiện drift và kéo về đúng bản trong Git. Rollback là revert commit, có lịch sử và review như code.",
        },
        {
          note: "Scheduler chọn node đủ CPU/RAM theo **resource requests**; kubelet trên Node A kéo image và chạy pod.",
          msgs: [["api", "n1", "bind pod web-v2"]],
          set: { n1: "pod v1 ×2 + v2 (starting)" },
          detail: "**Scheduler** bind pod v2 vào Node A: lọc các node đủ chỗ theo **resource requests** (không phải mức dùng thực tế), rồi chấm điểm. Kubelet trên Node A thấy pod được gán, kéo image từ ECR bằng quyền của node role rồi khởi container. Request đặt quá thấp thì scheduler nhồi quá nhiều pod lên một node và chúng tranh CPU/RAM; quá cao thì node trống mà pod vẫn không xếp được. Trạng thái `starting` nghĩa là container đang chạy nhưng chưa nhận traffic.",
        },
        {
          note: "**VPC CNI** cấp cho pod một IP thật trong VPC; readiness probe pass.",
          set: { n1: "v2 · 10.0.12.44 · Ready" },
          good: ["n1"],
          detail: "Pod nhận một IP thật của subnet VPC (`10.0.12.44`) — **VPC CNI** gán secondary IP ngay khi tạo network sandbox, nên ALB và các dịch vụ trong VPC gọi thẳng tới pod, không qua overlay network hay NAT. Cái giá: mỗi pod tốn một IP của subnet, và số pod mỗi node bị giới hạn bởi số ENI × IP của instance type (bật prefix delegation để nới). Sau đó kubelet chạy **readiness probe**; pass thì pod thành `Ready` và vào EndpointSlice của Service. Liveness probe là chuyện khác: fail liveness thì kubelet restart container.",
        },
        {
          note: "**AWS Load Balancer Controller** thấy endpoint mới → đăng ký IP pod vào ALB.",
          msgs: [["api", "alb", "endpoint 10.0.12.44"], ["alb", "n1", "health check", "ok"]],
          detail: "IP pod `10.0.12.44` được đăng ký vào target group của ALB sau khi pod `Ready` và vào EndpointSlice. **AWS Load Balancer Controller** watch các object này qua API server rồi gọi ELB API đăng ký IP (target type `ip`) — animation vẽ mũi tên từ API server sang ALB, thực chất controller đứng giữa. ALB health check pod rồi mới gửi traffic thật. Nên bật **pod readiness gate** của controller: pod chỉ được tính Ready khi ALB đã thấy target healthy, tránh rolling update rút pod cũ trong khi ALB chưa nhận pod mới.",
        },
        {
          note: "ReplicaSet cũ giảm dần theo `maxSurge` / `maxUnavailable` tới khi tất cả là v2.",
          msgs: [["api", "n2", "terminate pod v1", "warn"]],
          set: { n2: "pod v2 ×2 · Ready", n1: "pod v2 ×2 · Ready" },
          lesson: "Cùng ý tưởng rolling deploy như ECS — nhưng GitOps, CNI, ingress controller là các component riêng bạn cài và nâng cấp.",
          detail: "Kết quả: cả hai node chạy `pod v2 ×2`. Deployment controller lặp: thêm pod v2 trong giới hạn `maxSurge` (mặc định 25% số replicas có thể vượt), rút pod v1 trong giới hạn `maxUnavailable` (mặc định 25% có thể thiếu). Pod v1 bị terminate nhận `SIGTERM` và đồng thời bị rút khỏi endpoint, chờ `terminationGracePeriodSeconds` (mặc định 30 giây) rồi `SIGKILL`; thêm `preStop` sleep vài giây để ALB kịp deregister trước khi app đóng. Khác ECS: ArgoCD, VPC CNI, Load Balancer Controller đều là add-on bạn tự cài, tự nâng version và tự xử lý khi chúng lỗi.",
        },
      ],
    },
    {
      name: "Scale: HPA + Karpenter",
      steps: [
        {
          note: "Tải tăng: **HPA** thấy CPU 85% > 60% → tăng replicas 4 → 8.",
          set: { api: "HPA: replicas 4 → 8", n1: "CPU 90% · đầy", n2: "CPU 88% · đầy" },
          bad: ["n1", "n2"],
          detail: "**HPA** thấy CPU trung bình 85% so với target 60% và tăng replicas. HPA đọc CPU từ metrics-server khoảng 15 giây một lần; công thức `desired = ceil(current × actual / target)` = ceil(4 × 85/60) = **6**, không phải 8 — animation làm tròn lên gấp đôi cho dễ nhìn (8 chỉ đúng nếu CPU khoảng 120% request, hoặc khi bạn tự đặt policy). CPU tính theo % của **requests**, nên không có request thì HPA không hoạt động. Node A và B đều đã đầy nên các pod mới không có chỗ chạy.",
        },
        {
          note: "Không node nào đủ chỗ → 4 pod **Pending**.",
          set: { api: "4 pod Pending" },
          detail: "4 pod mới nằm **Pending** với event `FailedScheduling: Insufficient cpu` vì scheduler không tìm được node nào đủ requests. HPA chỉ tạo thêm pod, nó **không biết gì về máy** — đây là khoảng trống của lớp thứ hai. Trong lúc Pending, tải thật vẫn dồn vào 4 pod cũ đang CPU ~90%, latency tiếp tục tăng. Không có node autoscaler thì các pod này Pending mãi.",
        },
        {
          note: "**Karpenter** thấy pod Pending, chọn instance vừa khít (có thể Spot) và tạo node trong khoảng một phút.",
          msgs: [["karp", "api", "watch Pending pods"], ["karp", "n3", "launch c7g.xlarge (Spot)"]],
          set: { n3: "Node C · Ready" },
          detail: "**Karpenter** bật Node C `c7g.xlarge` (Graviton, 4 vCPU, 8 GiB) dạng **Spot** cho các pod Pending. Nó watch pod Pending, gom requests, affinity và toleration rồi tự chọn instance type vừa khít trong danh sách NodePool cho phép. Karpenter gọi thẳng EC2 Fleet API, không qua Auto Scaling Group như Cluster Autoscaler, nên node thường Ready trong khoảng một phút. Hai lưu ý: `c7g` là **arm64**, image phải build multi-arch; Spot có thể bị AWS thu hồi với 2 phút báo trước, nên Karpenter cần xử lý interruption và workload phải chịu được pod bị dời.",
        },
        {
          note: "Scheduler xếp pod lên node mới; ALB nhận thêm target.",
          msgs: [["api", "n3", "bind 4 pods"], ["n3", "alb", "4 pod IP", "ok"]],
          set: { n3: "pod v2 ×4 · Ready", api: "8/8 Ready", n1: "CPU 60%", n2: "CPU 58%" },
          good: ["n3"],
          lesson: "EKS scale 2 lớp: HPA (pod) + Karpenter (node). ECS + Fargate chỉ cần lớp thứ nhất.",
          detail: "Tải chia trên 8 pod, CPU Node A/B về khoảng 60% — đúng target của HPA. Node C Ready, scheduler bind 4 pod Pending lên đó; VPC CNI cấp IP, readiness pass, Load Balancer Controller đăng ký 4 IP mới vào ALB. Khi tải giảm, HPA giảm replicas trước (mặc định chờ 5 phút stabilization), rồi Karpenter **consolidation** gom pod và xoá node thừa để tiết kiệm. Tổng thời gian phản ứng dài hơn Fargate một bước: HPA vài chục giây cộng thời gian bật node.",
        },
      ],
    },
    {
      name: "Pod gọi S3 (Pod Identity)",
      steps: [
        {
          note: "Pod cần đọc S3. Không đặt access key trong code — gắn **IAM role vào ServiceAccount** `web-sa` qua EKS Pod Identity.",
          set: { n1: "pod web · SA web-sa → role s3-read" },
          detail: "Pod của app được gắn IAM role `s3-read` qua **Pod Identity association**, thay vì nhét access key tĩnh vào env hay secret — key tĩnh không hết hạn, lộ một lần là lộ mãi. Tạo role `s3-read` có trust policy cho principal `pods.eks.amazonaws.com`, rồi tạo association nối role với ServiceAccount `web-sa` trong namespace của app. Pod khai báo `serviceAccountName: web-sa`; EKS tự inject biến môi trường `AWS_CONTAINER_CREDENTIALS_FULL_URI` và token vào pod. Code không cần đổi gì, AWS SDK tự dùng credential provider chain.",
        },
        {
          note: "SDK trong pod xin credential tạm qua Pod Identity Agent trên node.",
          msgs: [["n1", "api", "AssumeRoleForPodIdentity"], ["api", "n1", "credential tạm · 1h", "ok"]],
          good: ["n1"],
          detail: "SDK nhận credential tạm của role `s3-read`, cache và tự refresh trước khi hết hạn. SDK gọi endpoint local của **Pod Identity Agent** (DaemonSet trên mỗi node, nghe ở `169.254.170.23`) kèm ServiceAccount token của pod. Agent gọi API `AssumeRoleForPodIdentity` của dịch vụ **EKS Auth** — đây là AWS API, không phải Kubernetes API server như mũi tên trong animation gợi ý; EKS Auth xác minh token và tra association rồi trả credential. Lộ credential này thì thiệt hại bị giới hạn trong thời gian sống ngắn và đúng quyền của role.",
        },
        {
          note: "Pod khác trên cùng node không dùng được role này — quyền gắn theo ServiceAccount, không theo node.",
          set: { n2: "pod khác · không có quyền S3" },
          lesson: "ECS dùng task role; EKS dùng Pod Identity (hoặc IRSA). Cả hai đều là credential tạm theo workload.",
          detail: "Pod khác trên Node B không lấy được credential `s3-read` vì dùng ServiceAccount khác — quyền gắn theo **ServiceAccount**, không theo node. Cách cũ dùng instance role của node thì mọi pod trên node đều thừa hưởng cùng quyền. Để chặn pod lấy instance role qua IMDS, đặt `HttpPutResponseHopLimit=1` trên node. Lưu ý: pod nào trong cùng namespace được dùng `web-sa` cũng có quyền này, nên ranh giới thật là ai được phép chỉ định ServiceAccount đó. ECS làm tương tự bằng task role; IRSA là cách cũ hơn dựa trên OIDC provider, Pod Identity là khuyến nghị hiện tại.",
        },
      ],
    },
  ],
});
