BK.sim({
  id: "container-stack",
  custom: "stack",
  title: "Ai quản lý lớp nào: ECS, EKS × Fargate, EC2",
  topics: ["ecs-vs-eks", "ecs", "eks"],
  scenario: "Chọn từng phương án để thấy lớp nào bạn phải tự lo, lớp nào AWS lo. Càng nhiều lớp đỏ → càng nhiều việc vận hành.",
  initial: "ecs-fg",
  options: [
    {
      id: "ecs-ec2",
      label: "ECS + EC2",
      fit: "Tải lớn ổn định cần tối ưu chi phí, GPU hoặc host đặc thù — chấp nhận tự quản máy.",
    },
    {
      id: "ecs-mi",
      label: "ECS Managed Instances",
      fit: "Cần loại EC2 cụ thể (GPU, Arm, mạng mạnh) nhưng không muốn tự vá và scale máy; chấp nhận mỗi instance sống tối đa 14 ngày.",
    },
    {
      id: "ecs-fg",
      label: "ECS + Fargate",
      fit: "Mặc định cho team nhỏ/vừa chỉ chạy trên AWS: ít việc vận hành nhất trong nhóm container.",
    },
    {
      id: "eks-mng",
      label: "EKS + Node group",
      fit: "Cần đầy đủ Kubernetes (DaemonSet, GPU, tuỳ biến node) và có người vận hành cluster.",
    },
    {
      id: "eks-fg",
      label: "EKS + Fargate",
      fit: "Muốn API Kubernetes nhưng không quản node; chấp nhận không DaemonSet, không GPU.",
    },
    {
      id: "eks-auto",
      label: "EKS Auto Mode",
      fit: "Muốn Kubernetes với ít vận hành nhất: AWS lo node, vá, scale, add-on lõi.",
    },
  ],
  layers: [
    [
      "Code & container image",
      { "ecs-ec2": "y", "ecs-mi": "y", "ecs-fg": "y", "eks-mng": "y", "eks-fg": "y", "eks-auto": "y" },
    ],
    [
      "Task def / manifest, quy tắc scale",
      { "ecs-ec2": "y", "ecs-mi": "y", "ecs-fg": "y", "eks-mng": "y", "eks-fg": "y", "eks-auto": "y" },
    ],
    [
      "Add-on (CNI, ingress, DNS, autoscaler)",
      { "ecs-ec2": "a", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "y", "eks-fg": "s", "eks-auto": "a" },
    ],
    [
      "Nâng version orchestrator",
      { "ecs-ec2": "a", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "y", "eks-fg": "y", "eks-auto": "s" },
    ],
    ["Thêm/bớt máy chủ", { "ecs-ec2": "s", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "s", "eks-fg": "a", "eks-auto": "a" }],
    ["Vá OS, AMI của node", { "ecs-ec2": "y", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "s", "eks-fg": "a", "eks-auto": "a" }],
    [
      "Control plane (API, scheduler, state)",
      { "ecs-ec2": "a", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "a", "eks-fg": "a", "eks-auto": "a" },
    ],
    [
      "Hạ tầng vật lý, hypervisor",
      { "ecs-ec2": "a", "ecs-mi": "a", "ecs-fg": "a", "eks-mng": "a", "eks-fg": "a", "eks-auto": "a" },
    ],
  ],
  cost: {
    "ecs-ec2": "Không phí control plane · trả tiền EC2 (kể cả phần trống)",
    "ecs-mi": "Không phí control plane · trả tiền cả instance EC2 (https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ManagedInstances.html)",
    "ecs-fg": "Không phí control plane · trả theo vCPU/RAM của task",
    "eks-mng": "Phí control plane theo giờ mỗi cluster · trả tiền EC2",
    "eks-fg": "Phí control plane theo giờ mỗi cluster · trả theo vCPU/RAM của pod",
    "eks-auto": "Phí control plane theo giờ mỗi cluster · EC2 + phí quản lý Auto Mode",
  },
});
