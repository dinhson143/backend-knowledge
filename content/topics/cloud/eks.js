BK.topic({
  id: "eks",
  track: "cloud",
  section: "cloud-containers",
  title: "EKS chuyên sâu",
  goal: "Hiểu EKS quản lý gì, bạn quản lý gì và scale 3 lớp",
  needs: ["ecs", "k8s-core"],
  tldr: {
    t: "EKS là **Kubernetes do AWS quản lý**: AWS chạy control plane (API server, etcd) trên nhiều AZ và tính phí theo giờ mỗi cluster; bạn chạy workload bằng Pod/Deployment chuẩn Kubernetes trên node EC2, Fargate hoặc Auto Mode. Mạnh ở hệ sinh thái (Helm, operator, GitOps, service mesh) và chạy được ngoài AWS, đổi lại vận hành phức tạp hơn ECS.",
    why: "EKS tính phí control plane theo giờ, vì control plane Kubernetes (API server, etcd) là thành phần riêng của mỗi cluster mà AWS phải chạy dành riêng cho bạn trên nhiều AZ. API là Kubernetes chuẩn → manifest và Helm chart mang sang GKE/AKS được, nhưng cũng kéo theo toàn bộ độ phức tạp của Kubernetes.",
  },
  story: {
    problem: "Tự cài Kubernetes trên EC2 là tự vận hành etcd, backup, HA API server qua nhiều AZ, xoay certificate. Một sự cố etcd có thể làm mất trạng thái cả cluster.",
    idea: "AWS chạy và bảo đảm control plane, bạn chỉ lo workload và (tuỳ mức) node. Vẫn là Kubernetes chuẩn nên toàn bộ hệ sinh thái CNCF dùng được nguyên vẹn.",
    tradeoff: "Vẫn phải nâng version định kỳ, tự lắp ghép add-on, học nhiều khái niệm (pod, RBAC, CRD). Có phí control plane cố định cho mỗi cluster.",
  },
  sections: [
    {
      title: "Kiến trúc: control plane và data plane",
      table: {
        head: ["Thành phần", "Ai quản lý", "Cần nhớ"],
        rows: [
          {
            cells: [
              "Control plane",
              "AWS — API server, etcd, scheduler, controller, chạy đa AZ",
              "Tính phí theo giờ mỗi cluster; extended support đắt hơn nhiều",
            ],
            why: "AWS chạy nhiều bản etcd trên ít nhất 3 AZ để mất một AZ vẫn hoạt động, vì etcd cần quorum (đa số node sống) mới ghi được. Hết standard support mà chưa nâng version thì AWS tự chuyển sang extended support, phí control plane theo giờ cao hơn nhiều lần standard support. Nguồn: https://aws.amazon.com/eks/pricing/",
          },
          {
            cells: [
              "Managed node group",
              "EKS quản vòng đời ASG EC2; bạn chọn instance và bấm cập nhật AMI",
              "Vẫn trả tiền EC2; rolling update node tự động",
            ],
            why: "Cập nhật AMI là rolling, vì EKS quản ASG và biết cách drain node: tạo node mới, cordon, evict pod theo PodDisruptionBudget, rồi xoá node cũ. Bạn vẫn trả tiền EC2 vì node là instance thật trong account bạn.",
          },
          {
            cells: ["Self-managed nodes", "Bạn tự quản ASG", "Linh hoạt nhất, tốn công nhất"],
            why: "Bạn tự viết launch template và bootstrap → dùng được AMI tuỳ chỉnh, kernel đặc biệt. Đổi lại, drain, nâng cấp, vá lỗi đều tự làm.",
          },
          {
            cells: ["Fargate", "AWS — mỗi pod một micro-VM", "Không DaemonSet, GPU, privileged pod, EBS, Spot hay Arm; dùng IRSA thay Pod Identity"],
            why: "Mỗi pod chạy trong micro-VM riêng, không có node dùng chung → DaemonSet (một pod mỗi node) vô nghĩa, và pod privileged không được phép vì có thể chạm host. Fargate cũng không cấp GPU, không gắn được EBS (chỉ EFS), không có Spot và Arm trên EKS. Pod Fargate không có IMDS và không chạy được Pod Identity Agent (một DaemonSet), nên cấp quyền AWS bằng IRSA. Nguồn: https://docs.aws.amazon.com/eks/latest/userguide/fargate.html",
          },
          {
            cells: [
              "Auto Mode",
              "AWS quản cả node: chọn instance, vá, scale (dựa trên Karpenter)",
              "Ít vận hành nhất trong EKS; có phí quản lý thêm",
            ],
            why: "Bạn gần như chỉ deploy pod, vì AWS chạy sẵn Karpenter, VPC CNI, CoreDNS và tự chọn, vá, thay node. Phí quản lý tính thêm theo mỗi instance, trên giá EC2.",
          },
          {
            cells: [
              "Karpenter",
              "Bạn cài (hoặc có sẵn trong Auto Mode)",
              "Tạo node vừa khít với pod đang Pending trong khoảng một phút; thay Cluster Autoscaler",
            ],
            why: "Karpenter nhanh hơn Cluster Autoscaler (vốn chỉ tăng size các node group có sẵn), vì nó đọc thẳng yêu cầu của pod Pending rồi gọi EC2 Fleet API chọn instance vừa khít. Nó cũng gom pod để xoá node thừa (consolidation).",
          },
        ],
      },
    },
    {
      title: "Object Kubernetes: phần riêng trên AWS",
      points: [
        "Pod, Deployment/ReplicaSet, Service, Ingress/Gateway, ConfigMap/Secret, Namespace/RBAC, DaemonSet, StatefulSet, Job hoạt động như mọi cluster Kubernetes: xem topic **Kubernetes cốt lõi** (`k8s-core`). Bảng dưới chỉ giữ chỗ EKS khác hoặc thêm.",
      ],
      table: {
        head: ["Object", "Trên EKS"],
        rows: [
          {
            cells: ["Service `type: LoadBalancer`", "Tạo NLB qua AWS Load Balancer Controller"],
            why: "Kubernetes chỉ khai báo \"cần một load balancer\"; trên EKS, AWS Load Balancer Controller đọc Service và tạo NLB, đăng ký IP pod làm target (target type `ip`).",
          },
          {
            cells: ["Ingress / Gateway", "Tạo ALB qua AWS Load Balancer Controller"],
            why: "Ingress cần controller biến nó thành load balancer thật, vì bản thân nó chỉ khai báo luật HTTP (host, path). AWS Load Balancer Controller đọc Ingress và tạo ALB với listener rule tương ứng.",
          },
          {
            cells: ["Secret", "Từ Kubernetes 1.28, EKS envelope-encrypt mọi dữ liệu API bằng KMS"],
            why: "Kubernetes gốc chỉ lưu Secret dạng base64 trong etcd; EKS từ Kubernetes 1.28 mặc định envelope-encrypt mọi dữ liệu API bằng KMS (có thể dùng key của mình). Secrets Manager qua CSI driver vẫn hữu ích khi cần xoay vòng và quản lý secret tập trung. Nguồn: https://docs.aws.amazon.com/eks/latest/userguide/envelope-encryption.html",
          },
          {
            cells: ["HPA", "Tự tăng giảm số pod theo CPU hoặc metric tuỳ chỉnh (KEDA theo độ dài queue)"],
            why: "Tải tăng là số pod tăng tỉ lệ, vì HPA định kỳ (mặc định 15 giây) lấy metric rồi tính `desired = ceil(current × metric / target)` (https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/). HPA thường không scale về 0, nên KEDA lo trường hợp theo queue và scale-to-zero.",
          },
          {
            cells: ["DaemonSet", "Không chạy trên Fargate"],
            why: "DaemonSet đảm bảo mỗi node có đúng một pod. Fargate cho mỗi pod một micro-VM riêng, không có node dùng chung, nên DaemonSet không có chỗ để chạy.",
          },
          {
            cells: ["StatefulSet + PVC", "Volume EBS qua CSI driver, EBS gắn với 1 AZ"],
            why: "Pod tạo lại vẫn gắn đúng volume, vì StatefulSet cho mỗi pod tên cố định (`db-0`) và PVC riêng đi theo pod. EBS là block device nằm trong một AZ, nên pod chỉ lên lại được node cùng AZ.",
          },
        ],
      },
    },
    {
      title: "Networking & phân quyền",
      points: [
        {
          t: "**VPC CNI** — mỗi pod có IP thật trong VPC: gọi thẳng, dễ gắn security group, nhưng **tốn IP** subnet; số pod/node bị giới hạn theo số ENI (dùng prefix delegation để nới).",
          why: "Pod có IP thật, gọi thẳng không qua NAT, vì VPC CNI gắn secondary IP từ subnet vào ENI của node rồi cấp cho pod. Mỗi instance type giới hạn số ENI và số IP mỗi ENI (ví dụ `m5.large` tối đa 29 pod); prefix delegation cấp cả khối /28 cho mỗi slot nên tăng mạnh mật độ pod.",
        },
        {
          t: "**Ingress** — AWS Load Balancer Controller tạo ALB/NLB từ Ingress/Service, đăng ký thẳng IP pod (target type `ip`).",
          why: "Target type `ip` đăng ký thẳng IP pod → traffic đi từ ALB thẳng tới pod, không qua NodePort và kube-proxy. Ít hop hơn, và health check phản ánh đúng từng pod.",
        },
        {
          t: "**Hai lớp quyền** — AWS IAM quyết định ai gọi được API của EKS; Kubernetes **RBAC** quyết định ai làm gì trong cluster. Access Entries thay cho ConfigMap `aws-auth`.",
          why: "IAM là lớp ngoài, vì `kubectl` phải xác thực với AWS IAM trước khi vào API server; sau đó RBAC quyết định user đó được `get pods` hay `delete deployment`. Access Entries quản qua EKS API nên không lo sửa nhầm ConfigMap `aws-auth` rồi khoá cả admin ra ngoài.",
        },
        {
          t: "**Pod gọi AWS** — gắn IAM role cho ServiceAccount qua **EKS Pod Identity** (mới, đơn giản) hoặc **IRSA** (OIDC). Không đặt access key trong pod.",
          why: "Gắn IAM role cho ServiceAccount để pod nhận credential tạm thời, vì access key tĩnh trong pod có thể lộ qua image hay log và không tự xoay. Pod Identity dùng agent trên node nên không cần cấu hình OIDC provider và trust policy cho từng cluster như IRSA; nhưng agent là DaemonSet nên pod chạy trên Fargate phải dùng IRSA (https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).",
        },
        {
          t: "**NetworkPolicy** — giới hạn pod nào được gọi pod nào (cần bật trong VPC CNI hoặc dùng Calico/Cilium).",
          why: "Mặc định mọi pod trong cluster gọi được nhau → một pod bị chiếm có thể tấn công database pod. NetworkPolicy chỉ là khai báo, cần CNI có enforcement (VPC CNI bật network policy, hoặc Calico/Cilium) mới thực thi.",
        },
      ],
    },
    {
      title: "Scaling 3 lớp",
      points: [
        {
          t: "**HPA** — số pod theo CPU, RAM hoặc metric tuỳ chỉnh; **KEDA** scale theo sự kiện (độ dài SQS/Kafka lag), kể cả về 0.",
          why: "HPA phản ứng sau khi tải đã tăng, vì nó chỉ chỉnh số replica theo metric hiện tại. KEDA đọc thẳng nguồn sự kiện như độ dài SQS → scale trước khi CPU tăng, và về 0 được khi queue rỗng.",
        },
        {
          t: "**VPA** — gợi ý hoặc tự chỉnh CPU/RAM requests của pod.",
          why: "Requests đặt sai thì hoặc lãng phí node (đặt cao), hoặc pod bị OOMKill/throttle (đặt thấp) → VPA quan sát mức dùng thực tế để gợi ý số đúng. Không dùng VPA auto cùng HPA trên cùng metric CPU, vì hai bên chỉnh đè nhau.",
        },
        {
          t: "**Node** — Karpenter (hoặc Cluster Autoscaler) thêm node khi có pod Pending, gom pod và xoá node thừa để tiết kiệm.",
          why: "Phải có lớp thứ ba thêm node, vì HPA tạo pod mới mà node đầy thì pod nằm Pending. Khi tải giảm, consolidation dồn pod sang ít node hơn rồi xoá node trống để không trả tiền máy thừa.",
        },
      ],
    },
    {
      title: "Cái giá vận hành",
      points: [
        {
          t: "**Nâng version Kubernetes** khoảng mỗi năm (standard support ~14 tháng/version); kèm nâng add-on: CoreDNS, kube-proxy, VPC CNI, LB Controller.",
          why: "Phải nâng version ít nhất mỗi năm, vì upstream Kubernetes ra minor version mới khoảng mỗi 4 tháng và EKS chỉ hỗ trợ chuẩn ~14 tháng. Add-on gắn chặt với version API → nâng control plane mà quên add-on có thể làm hỏng DNS hoặc networking.",
        },
        {
          t: "**Tự lắp ghép** — ingress, autoscaler, GitOps, monitoring (Prometheus/Grafana hoặc Container Insights) là các component riêng.",
          why: "Ingress controller, autoscaler, ArgoCD, Prometheus đều là phần mềm bạn tự cài, cấu hình và nâng cấp, vì Kubernetes chỉ cung cấp nhân điều phối. Mỗi component là thêm một thứ có thể hỏng.",
        },
        {
          t: "**Chi phí** — phí control plane mỗi cluster + node; bin packing tốt và Spot qua Karpenter có thể rẻ hơn ECS ở quy mô lớn.",
          why: "Karpenter chọn instance vừa khít và dùng Spot đa dạng loại → tỉ lệ sử dụng node cao, giá node giảm tới 90% so với on-demand (https://aws.amazon.com/ec2/spot/). Ở quy mô hàng trăm node, khoản tiết kiệm này vượt xa phí control plane của cluster.",
        },
      ],
    },
    {
      title: "Câu hỏi hay bị hỏi sâu",
      points: [
        {
          t: "**Pod Pending** — thiếu CPU/RAM trên node, hết IP trong subnet, hoặc node selector/taint không khớp.",
          why: "Không node nào đủ điều kiện là pod nằm Pending, vì scheduler chỉ đặt pod lên node đủ `requests` và khớp nodeSelector/taint. Hết IP trong subnet thì VPC CNI không cấp được IP → pod kẹt ở ContainerCreating hoặc Pending; `kubectl describe pod` cho biết lý do.",
        },
        {
          t: "**Noisy neighbor** — luôn đặt `requests` và `limits`; ResourceQuota theo namespace.",
          why: "Thiếu cả `requests` lẫn `limits` thì một pod có thể ăn hết CPU/RAM node, làm pod khác chậm hoặc bị OOMKill — vì scheduler dựa vào `requests` để xếp pod, còn `limits` giới hạn mức dùng thực tế. ResourceQuota chặn tổng mức cả namespace.",
        },
        {
          t: "**Multi-tenant** — namespace + RBAC + NetworkPolicy + ResourceQuota; tenant cần cách ly mạnh thì tách cluster.",
          why: "Namespace + RBAC + NetworkPolicy + ResourceQuota chỉ là cách ly mềm, vì mọi tenant dùng chung kernel node và control plane. Lỗ hổng container escape vẫn chạm được tenant khác → cần cách ly mạnh thì tách cluster hoặc account.",
        },
        {
          t: "**Stateful** — EBS chỉ gắn trong 1 AZ: pod chuyển AZ sẽ không mount được; cân nhắc EFS hoặc dịch vụ managed (RDS, MSK).",
          why: "Pod bị xếp lên node ở AZ khác sẽ không mount được và nằm Pending, vì EBS volume là block device chỉ attach được vào instance cùng AZ. EFS là network file system đa AZ; còn dịch vụ managed như RDS tự lo HA, nên đẩy trạng thái ra khỏi cluster.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Nói EKS thì nói luôn compute: managed node group + Karpenter, Fargate, hay Auto Mode — và vì sao.",
      why: "Nêu luôn lựa chọn compute mới là câu trả lời đầy đủ, vì “EKS” chỉ nói về control plane, còn chi phí, vận hành và giới hạn (GPU, DaemonSet) phụ thuộc lớp compute.",
    },
    {
      t: "Nhắc 2 lớp quyền (IAM + RBAC) và Pod Identity — câu hỏi bảo mật hay gặp.",
      why: "Nói rõ hai lớp cho thấy bạn hiểu mô hình, vì nhầm quyền vào cluster (IAM) với quyền trong cluster (RBAC) là lỗi bảo mật phổ biến. Nhắc Pod Identity cho thấy bạn biết tránh access key tĩnh.",
    },
    {
      t: "Đừng chọn EKS chỉ vì “chuẩn ngành”: phải nêu được thứ chỉ Kubernetes cho bạn.",
      why: "Cần lý do cụ thể mà chỉ Kubernetes có — operator, Helm, chạy đa cloud, hay platform cho nhiều team — vì EKS tốn phí và công vận hành hơn ECS. Không nêu được thì ECS là lựa chọn rẻ hơn.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/eks-control-data-plane.svg",
      caption: "Control plane (kube-apiserver, etcd, scheduler, controller-manager) do AWS chạy riêng cho mỗi cluster trên 3 AZ; data plane là node EC2 hoặc Fargate trong VPC của bạn, nơi kubelet nhận pod từ API server.",
      source: "https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html",
    },
  ],
  cards: [
    [
      "AWS quản lý phần nào của EKS, bạn quản lý phần nào?",
      "AWS: control plane (API server, etcd, scheduler) đa AZ. Bạn: node (trừ Fargate/Auto Mode), add-on, version upgrade, workload, RBAC.",
    ],
    [
      "Pod Pending thường do đâu?",
      "Không node nào đủ CPU/RAM theo requests, hết IP trong subnet (VPC CNI), hoặc taint/node selector không khớp.",
    ],
    [
      "Pod trên EKS lấy quyền AWS thế nào cho an toàn?",
      "Gắn IAM role vào ServiceAccount qua EKS Pod Identity hoặc IRSA; pod nhận credential tạm, không đặt access key trong code.",
    ],
    [
      "HPA và Karpenter khác nhau thế nào?",
      "HPA thay đổi số pod theo metric. Karpenter thay đổi số node: thấy pod Pending thì tạo node vừa khít, thừa thì gom và xoá node.",
    ],
  ],
});
