BK.topic({
  id: "ecs",
  track: "cloud",
  section: "cloud-containers",
  title: "ECS chuyên sâu",
  goal: "Triển khai, scale và tự phục hồi service trên ECS",
  needs: ["lb-gateway-cdn"],
  tldr: {
    t: "ECS là orchestrator container **riêng của AWS**: khai báo Task Definition (image, CPU/RAM, IAM role) và Service (chạy N bản, gắn load balancer); AWS lo control plane và **không tính phí** phần đó. Chạy trên **Fargate** (không quản máy), **EC2** (tự quản máy) hoặc **ECS Managed Instances** (EC2 do AWS chọn, vá và thay định kỳ). Đơn giản, tích hợp sâu với AWS, nhưng chỉ chạy trên AWS.",
    why: "Bạn chỉ trả cho compute, vì ECS là dịch vụ đa tenant do AWS vận hành, không có control plane riêng để tính tiền theo cluster. Tích hợp sâu (IAM role cho task, ALB, CloudWatch) có sẵn vì cùng nhà cung cấp — nhưng chính điều đó khoá bạn vào AWS.",
  },
  story: {
    problem: "Chạy container thẳng trên EC2 bằng `docker run`: container chết không ai khởi động lại, deploy bản mới phải SSH từng máy, máy hỏng là service sập. Tự dựng Kubernetes thì phải vận hành cả control plane.",
    idea: "Khai báo trạng thái mong muốn (image này, N bản, gắn ALB này), để AWS liên tục so với thực tế rồi sửa lệch. Control plane là dịch vụ AWS sẵn có, không phải thứ bạn chạy.",
    tradeoff: "Khái niệm và API là của riêng AWS → rời AWS phải viết lại toàn bộ cấu hình triển khai. Hệ sinh thái nhỏ hơn Kubernetes, không có Helm hay operator.",
  },
  sections: [
    {
      title: "Khái niệm cốt lõi",
      table: {
        head: ["Khái niệm", "Là gì", "So với Kubernetes"],
        rows: [
          {
            cells: [
              "Cluster",
              "Nhóm logic chứa service và capacity",
              "Cluster (nhưng không có control plane phải trả phí)",
            ],
            why: "Tạo cluster miễn phí và không có node master để quản, vì cluster chỉ là namespace logic trong control plane chung của ECS. Nó gom service và capacity provider để quản lý và phân quyền theo nhóm.",
          },
          {
            cells: [
              "Task Definition",
              "Bản thiết kế: image, CPU/RAM, port, env, secret, log, IAM role — có revision",
              "Pod spec",
            ],
            why: "Rollback chỉ là trỏ service lại revision cũ, vì mỗi lần sửa tạo revision mới bất biến (`my-app:7`) và service trỏ tới revision cụ thể. Mọi thứ cần để chạy container khai báo ở đây nên tái lập được.",
          },
          {
            cells: ["Task", "Một bản đang chạy của task definition (1 hoặc nhiều container)", "Pod"],
            why: "Task là instance của task definition → các container trong cùng task được đặt cùng chỗ và chia sẻ network (sidecar log, proxy). Task chết thì không tự sống lại — việc đó do Service lo.",
          },
          {
            cells: ["Service", "Giữ đúng N task chạy, gắn ALB, rolling deploy, auto scaling", "Deployment + Service"],
            why: "Task chết là có task mới thay, vì service scheduler liên tục so số task đang chạy với `desiredCount`. Nó cũng đăng ký task vào target group của ALB và điều phối rolling deploy.",
          },
          {
            cells: [
              "Capacity provider",
              "Task chạy ở đâu: Fargate, Fargate Spot, hoặc EC2 Auto Scaling group",
              "Node group / Karpenter",
            ],
            why: "Capacity provider tách “chạy ở đâu” khỏi định nghĩa service, vì cùng một service có thể cần chạy trên Fargate, Fargate Spot (rẻ hơn tới 70% nhưng có thể bị thu hồi — https://aws.amazon.com/fargate/pricing/) hoặc EC2. Trộn tỉ lệ được bằng base và weight.",
          },
          {
            cells: [
              "Task role · Execution role",
              "Task role: quyền **app** gọi AWS. Execution role: quyền **ECS** kéo image, đọc secret, ghi log",
              "ServiceAccount + Pod Identity",
            ],
            why: "Hai role tách nhau để app không có quyền thừa và ngược lại. **Execution role**: trước khi app chạy, agent ECS cần quyền kéo image từ ECR và đọc secret từ Secrets Manager. **Task role**: khi app chạy và gọi S3, nó dùng credential của role này.",
          },
        ],
      },
    },
    {
      title: "Fargate hay EC2?",
      table: {
        head: ["", "Fargate", "EC2"],
        rows: [
          {
            cells: ["Quản máy chủ", "Không — AWS cấp compute cho từng task", "Có — bạn quản ASG, AMI, vá OS"],
            why: "Fargate không có EC2 nào để vá OS hay scale ASG, vì nó cấp micro-VM riêng cho mỗi task. Với EC2 launch type, bạn chịu trách nhiệm AMI, patch và đủ capacity cho task.",
          },
          {
            cells: ["Tính tiền", "Theo vCPU/RAM của task mỗi giây", "Theo instance, kể cả phần trống"],
            why: "Fargate tính đúng vCPU/RAM task khai báo → không trả cho phần trống. EC2 tính cả instance dù chỉ dùng 40% → chỉ rẻ hơn khi bin packing tốt và dùng Reserved/Savings Plan.",
          },
          {
            cells: [
              "Giới hạn",
              "Không GPU, không daemon trên host, khởi động chậm hơn vài chục giây",
              "GPU, instance đặc thù, daemon, tận dụng Reserved/Spot",
            ],
            why: "Fargate trừu tượng hoá host → không gắn được GPU, không chạy daemon trên host, và mỗi lần phải kéo image về micro-VM mới (không cache sẵn) nên khởi động chậm hơn. EC2 cho chọn instance đặc thù và cache image trên máy.",
          },
          {
            cells: [
              "Chọn khi",
              "Mặc định cho hầu hết web/API, team nhỏ",
              "Tải lớn ổn định cần tối ưu chi phí, GPU, yêu cầu host đặc biệt",
            ],
            why: "Fargate là mặc định hợp lý cho team nhỏ không có người trực hạ tầng, vì nó bỏ hẳn phần quản máy. Khi tải lớn và ổn định, phần trả thêm cho Fargate cộng lại đủ lớn để EC2 + Reserved đáng công vận hành.",
          },
        ],
      },
    },
    {
      title: "Networking, deploy, scaling",
      points: [
        {
          t: "**awsvpc mode** — mỗi task có ENI và IP riêng trong VPC, security group gắn theo task. ALB dùng target type `ip`.",
          why: "Mỗi task có ENI riêng → task có IP thật trong subnet, và security group áp đúng cho task đó thay vì cả host. ALB đăng ký thẳng IP task (`ip` target type) vì không còn port mapping qua host.",
        },
        {
          t: "**Service discovery** — Service Connect / Cloud Map cho service gọi nhau bằng tên.",
          why: "Gọi bằng IP cứng sẽ vỡ, vì IP task đổi mỗi lần khởi động lại. Cloud Map đăng ký DNS name cho task; Service Connect thêm proxy sidecar lo retry và metric.",
        },
        {
          t: "**Rolling deploy** — `minimumHealthyPercent` / `maximumPercent` điều khiển tốc độ; bật **deployment circuit breaker** để tự rollback khi task mới không healthy. Blue/green có sẵn hoặc qua CodeDeploy.",
          why: "Hai số này quyết định tốc độ deploy và capacity dư cần có: `minimumHealthyPercent: 50` cho tắt một nửa task cũ trước, `maximumPercent: 200` cho chạy gấp đôi trong lúc deploy. Circuit breaker đếm số task mới không lên healthy và tự rollback về revision trước.",
        },
        {
          t: "**Service Auto Scaling** — target tracking theo CPU, RAM hoặc số request trên ALB; scheduled scaling cho giờ cao điểm biết trước.",
          why: "Tải tăng là task tăng, vì Application Auto Scaling theo dõi metric CloudWatch và chỉnh `desiredCount` để giữ metric quanh mục tiêu (ví dụ CPU 60%). Scheduled scaling tăng trước giờ cao điểm, vì scale theo metric luôn trễ vài phút.",
        },
        {
          t: "**Trên EC2** còn phải scale máy: capacity provider có managed scaling để ASG tự thêm instance khi task không có chỗ.",
          why: "Trên EC2 phải scale cả lớp máy, vì thêm task mà instance hết chỗ thì task kẹt ở PROVISIONING. Managed scaling theo dõi task chờ chỗ và chỉnh desired capacity của ASG.",
        },
        {
          t: "**Quan sát** — log qua `awslogs` hoặc FireLens; metric qua Container Insights.",
          why: "Container ghi ra stdout/stderr → log driver `awslogs` đẩy thẳng vào CloudWatch Logs; FireLens dùng Fluent Bit sidecar để route sang nơi khác. Container Insights thu metric theo task và service, không chỉ theo instance.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Nói rõ chọn Fargate hay EC2 và vì sao — đó là quyết định riêng, tách khỏi ECS hay EKS.",
      why: "Chọn cái này không quyết định cái kia, vì Fargate/EC2 là lớp compute còn ECS/EKS là lớp orchestrator. Nêu rõ cả hai cho thấy bạn hiểu chi phí và vận hành đến từ đâu.",
    },
    {
      t: "Phân biệt task role và execution role: hỏi “ai cần quyền này — app hay ECS?”.",
      why: "Hỏi “ai cần” là trả lời ngay quyền gắn vào đâu: execution role dùng trước khi container khởi động, task role dùng trong lúc app chạy. Gắn nhầm vào execution role thì app báo AccessDenied.",
    },
    {
      t: "ECS không có version cluster để nâng cấp — lý do lớn khiến nó ít tốn công vận hành.",
      why: "ECS không có chu kỳ nâng cấp bắt buộc như Kubernetes, vì nó không phát hành version cluster (AWS cập nhật control plane trong suốt). Thứ duy nhất phải cập nhật là ECS agent/AMI nếu chạy EC2.",
    },
  ],
  cards: [
    [
      "Task role khác execution role thế nào?",
      "Task role: quyền cho code trong container gọi AWS (S3, DynamoDB). Execution role: quyền cho ECS agent kéo image từ ECR, đọc secret, ghi log.",
    ],
    [
      "Khi nào chọn ECS trên EC2 thay vì Fargate?",
      "Cần GPU, instance đặc thù hoặc daemon trên host; hoặc tải lớn ổn định muốn tối ưu chi phí bằng Reserved/Spot và bin packing.",
    ],
    [
      "ECS tự xử lý thế nào khi một task chết?",
      "Service scheduler thấy số task running < desired count, ALB rút task khỏi target group, ECS khởi động task thay thế.",
    ],
  ],
});
