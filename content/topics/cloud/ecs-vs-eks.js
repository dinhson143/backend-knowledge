BK.topic({
  id: "ecs-vs-eks",
  track: "cloud",
  section: "cloud-containers",
  title: "ECS hay EKS?",
  goal: "Chọn ECS hay EKS theo team, hệ sinh thái và chi phí vận hành",
  needs: ["eks"],
  tldr: {
    t: "Mặc định chọn **ECS + Fargate** khi team nhỏ, chỉ chạy trên AWS và muốn ít vận hành. Chọn **EKS** khi team đã quen Kubernetes, cần hệ sinh thái K8s (Helm, operator, GitOps, service mesh), phải chạy ngoài AWS, hoặc có platform team phục vụ nhiều team. Fargate hay EC2 là **quyết định thứ hai**, áp dụng cho cả hai.",
    why: "ECS có chi phí vận hành thấp nhất khi team nhỏ và chỉ dùng AWS, vì không có control plane tính phí và không có version cluster phải nâng. EKS chỉ đáng khi dùng tới thứ chỉ Kubernetes có; Fargate/EC2 là lớp compute dùng chung cho cả hai nên quyết định tách riêng.",
  },
  story: {
    problem: "Chọn sai orchestrator theo cả hai chiều đều tốn: team 5 người chọn EKS vì “chuẩn ngành”, rồi mất một người toàn thời gian lo nâng version, cài ingress, debug CNI thay vì làm sản phẩm. Ngược lại, công ty 20 team chọn ECS rồi thiếu công cụ chuẩn hoá, phải tự xây lại những gì Helm, ArgoCD đã có.",
    idea: "Chọn orchestrator theo năng lực team và nhu cầu thật (portability, hệ sinh thái); compute (Fargate/EC2) là quyết định riêng theo tải và chi phí.",
    tradeoff: "ECS đổi tính di động và hệ sinh thái lấy độ đơn giản. EKS đổi chi phí vận hành và độ khó lấy linh hoạt.",
  },
  table: {
    head: ["Tiêu chí", "ECS", "EKS"],
    rows: [
      {
        cells: ["Bản chất", "Orchestrator riêng của AWS", "Kubernetes chuẩn (CNCF)"],
        why: "EKS dùng được mọi công cụ viết cho Kubernetes, vì nó chạy Kubernetes upstream được CNCF chứng nhận; ECS là API độc quyền của AWS nên chỉ dùng được công cụ hỗ trợ API của AWS.",
      },
      {
        cells: ["Phí control plane", "Không tính", "Tính theo giờ cho mỗi cluster, cao hơn khi version Kubernetes đã sang extended support"],
        why: "EKS tính phí control plane cho từng cluster chạy cả tháng dù không có workload, vì nó dựng API server và etcd riêng cho mỗi cluster, còn control plane ECS là dịch vụ dùng chung. Nhiều cluster (dev, staging, prod) thì nhân lên. Bảng giá chính thức (https://aws.amazon.com/eks/pricing/, https://aws.amazon.com/ecs/pricing/).",
      },
      {
        cells: ["Độ khó học", "Thấp: task, service, cluster", "Cao: pod, service, ingress, RBAC, Helm, CRD…"],
        why: "ECS học trong vài ngày, vì chỉ có vài khái niệm khớp thẳng nhu cầu (task, service). Kubernetes là nền tảng tổng quát với hàng chục loại object, mở rộng được bằng CRD, nên cần thời gian dài hơn nhiều.",
      },
      {
        cells: ["Vận hành", "Ít — không có version cluster phải nâng", "Nâng version K8s + add-on định kỳ"],
        why: "ECS không có nâng cấp bắt buộc, vì AWS cập nhật control plane trong suốt. EKS theo vòng đời version upstream, mỗi lần nâng phải kiểm tra API deprecated và nâng add-on.",
      },
      {
        cells: [
          "Compute",
          "Fargate, EC2, ECS Managed Instances, ECS Anywhere",
          "Managed/self-managed node, Fargate, Auto Mode, hybrid nodes",
        ],
        why: "EKS có nhiều cách cung cấp node hơn, kể cả hybrid nodes cho máy on-prem gia nhập cluster, vì nó kế thừa mô hình node của Kubernetes. ECS Anywhere cũng chạy được task trên máy ngoài AWS, nhưng control plane vẫn ở AWS. ECS Managed Instances là bản tương ứng của EKS Auto Mode: dùng được mọi loại EC2 (GPU, Arm) mà AWS lo cấp máy và vá OS (https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ManagedInstances.html).",
      },
      {
        cells: ["Tính di động", "Gắn với AWS", "Manifest chạy được trên GKE, AKS, on-prem"],
        why: "Deployment, Service chạy được trên GKE, AKS, chỉ cần đổi phần đặc thù cloud (storage class, ingress annotation), vì manifest Kubernetes dùng API chuẩn. Task definition ECS thì không nơi nào khác hiểu.",
      },
      {
        cells: [
          "Hệ sinh thái",
          "Dịch vụ AWS (CodeDeploy, Service Connect, CloudWatch)",
          "Rất lớn: Helm, ArgoCD, KEDA, Istio, operator cho DB/Kafka",
        ],
        why: "Kubernetes có sẵn operator cho Postgres, Kafka và công cụ GitOps như ArgoCD, nhờ cộng đồng lớn và cơ chế mở rộng (CRD + controller). ECS dựa vào dịch vụ AWS — đủ dùng nhưng ít lựa chọn hơn.",
      },
      {
        cells: ["Scaling", "Service Auto Scaling + capacity provider", "HPA/KEDA + Karpenter, linh hoạt hơn"],
        why: "EKS tinh chỉnh được nhiều hơn: Karpenter chọn loại instance linh hoạt theo từng pod, KEDA scale theo hàng chục nguồn sự kiện. ECS chỉ chỉnh số task và ASG — đơn giản hơn nhưng ít núm vặn.",
      },
      {
        cells: ["Phân quyền", "IAM task role", "IAM + RBAC + Pod Identity"],
        why: "ECS chỉ có một lớp quyền: gắn trực tiếp qua IAM task role. EKS thêm RBAC trong cluster vì nhiều user/team cùng thao tác trên Kubernetes API → mạnh hơn nhưng phải quản hai hệ quyền.",
      },
      {
        cells: [
          "Hợp với",
          "Một vài team, vài đến vài chục service, muốn ship nhanh",
          "Platform team, nhiều team, workload đa dạng",
        ],
        why: "EKS chỉ đáng với platform team lớn, vì chi phí cố định vận hành nó được chia đều khi nhiều team dùng chung. Team nhỏ thì chi phí đó dồn lên đầu ít người, ECS ship nhanh hơn.",
      },
    ],
  },
  sections: [
    {
      title: "Tình huống → lựa chọn",
      table: {
        head: ["Tình huống", "Chọn", "Vì sao"],
        rows: [
          {
            cells: [
              "Startup 5 dev, 10 microservice web/API",
              "ECS + Fargate",
              "Không ai phải trực hạ tầng; không phí control plane",
            ],
            why: "ECS + Fargate bỏ cả nâng version cluster lẫn vá node — hai việc mà 5 dev không ai có thời gian làm. 10 service vẫn trong tầm quản lý bằng Terraform đơn giản.",
          },
          {
            cells: [
              "Công ty có platform team, 200 service, 20 team",
              "EKS",
              "Namespace/RBAC cho nhiều team, GitOps, chuẩn hoá bằng Helm",
            ],
            why: "20 team cần tự deploy mà không đạp lên nhau → namespace + RBAC + ResourceQuota cho ranh giới, Helm chart chuẩn hoá cách deploy. Platform team chia chi phí vận hành EKS cho 200 service.",
          },
          {
            cells: [
              "Phải chạy cả on-prem và cloud",
              "EKS (hoặc Kubernetes nói chung)",
              "Cùng manifest, cùng công cụ ở mọi nơi",
            ],
            why: "Một bộ manifest, một quy trình CI/CD dùng được mọi nơi, vì Kubernetes chạy giống nhau ở cloud và on-prem. ECS không có control plane chạy on-prem độc lập.",
          },
          {
            cells: ["Cần operator chạy Kafka/Postgres trong cluster", "EKS", "Operator là khái niệm của Kubernetes"],
            why: "Operator chỉ tồn tại trên Kubernetes API, vì nó là controller theo dõi CRD (ví dụ `KafkaCluster`) và tự xử lý các bước vận hành như failover. ECS không có cơ chế CRD tương đương.",
          },
          {
            cells: [
              "ML training cần GPU, scale theo job",
              "EKS + Karpenter (hoặc AWS Batch)",
              "Tạo node GPU theo nhu cầu, Spot",
            ],
            why: "Không trả tiền GPU nhàn rỗi, vì Karpenter tạo node GPU khi job xuất hiện và xoá khi job xong; Spot giảm giá thêm. Fargate không hỗ trợ GPU nên ECS phải dùng EC2; AWS Batch là lựa chọn managed cho batch thuần.",
          },
          {
            cells: ["Container hoá monolith lần đầu", "ECS + Fargate", "Ít khái niệm mới nhất"],
            why: "Thêm Kubernetes là quá nhiều thay đổi một lúc, vì lần đầu container hoá đã có nhiều thứ mới (Dockerfile, registry, health check). ECS + Fargate giữ số khái niệm mới ít nhất.",
          },
          {
            cells: [
              "Traffic lẻ tẻ, xử lý ngắn theo sự kiện",
              "Lambda trước tiên",
              "Không cần container chạy thường trực",
            ],
            why: "Traffic lẻ tẻ gần như không tốn gì lúc nhàn rỗi, vì Lambda tính tiền theo request và thời gian chạy tính bằng mili giây. Container thường trực vẫn trả tiền dù không có request.",
          },
        ],
      },
    },
    {
      title: "Trả lời trong phỏng vấn",
      points: [
        {
          t: "Đừng dừng ở “tuỳ”. Hỏi 3 câu: **team có kinh nghiệm Kubernetes không? có nhu cầu ngoài AWS không? có cần công cụ chỉ Kubernetes có không?** — cả ba “không” thì ECS.",
          why: "Cả ba câu đều “không” thì EKS chỉ thêm chi phí mà không thêm giá trị, vì đây là ba lý do duy nhất khiến Kubernetes đáng tiền: kỹ năng có sẵn, portability, hệ sinh thái. Trả lời bằng tiêu chí cụ thể cho thấy bạn biết ra quyết định.",
        },
        {
          t: "**Image giống hệt nhau** — bắt đầu bằng ECS rồi chuyển sang EKS khi thật sự cần là hướng đi an toàn, vì cùng một Docker image chạy được trên cả hai.",
          why: "Không cần chọn EKS “phòng trước”, vì chi phí chuyển thấp: cả ECS và EKS đều chạy OCI image chuẩn nên phần ứng dụng không đổi, chỉ phải viết lại cấu hình triển khai (task definition → manifest).",
        },
        {
          t: "**Chi phí** — quy mô nhỏ ECS rẻ hơn (không phí control plane, ít công vận hành); quy mô lớn EKS với bin packing + Spot có thể rẻ hơn, nhưng đừng quên chi phí con người.",
          why: "Ở quy mô nhỏ ECS rẻ hơn, vì phí control plane và công kỹ sư chiếm phần lớn tổng chi phí. Ở quy mô lớn, tiền compute lớn nên bin packing và Spot của Karpenter tiết kiệm nhiều — nhưng lương một kỹ sư platform vẫn có thể lớn hơn khoản tiết kiệm.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Trong bài system design, “container service trên ECS/EKS” thường chỉ cần một dòng — chỉ đi sâu khi interviewer hỏi về hạ tầng.",
      why: "Đi sâu orchestrator khi không được hỏi là dồn thời gian vào phần ít điểm, vì system design chấm chủ yếu ở luồng dữ liệu, scaling và trade-off của ứng dụng.",
    },
    {
      t: "Phân tách 2 quyết định: orchestrator (ECS/EKS) và compute (Fargate/EC2).",
      why: "Đây là hai quyết định độc lập, vì cả ECS và EKS đều chạy được trên Fargate và EC2: orchestrator theo năng lực team và hệ sinh thái, compute theo tải và chi phí. Gộp chung dễ dẫn tới lập luận sai kiểu “chọn EKS vì cần GPU”.",
    },
  ],
  cards: [
    [
      "3 câu hỏi để chọn giữa ECS và EKS?",
      "Team có kinh nghiệm Kubernetes? Có cần chạy ngoài AWS? Có cần công cụ chỉ Kubernetes có (Helm chart, operator, ArgoCD, KEDA)? Cả ba không → ECS.",
    ],
    [
      "Fargate có phải là lựa chọn thay cho ECS/EKS không?",
      "Không. Fargate là kiểu compute (không quản máy), dùng được cho cả ECS và EKS. Quyết định orchestrator và compute tách riêng.",
    ],
    [
      "Vì sao ECS ít tốn công vận hành hơn EKS?",
      "Không có version cluster phải nâng, không add-on, không RBAC/CRD; networking và load balancer tích hợp sẵn.",
    ],
  ],
});
