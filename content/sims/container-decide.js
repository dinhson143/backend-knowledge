BK.sim({
  id: "container-decide",
  custom: "decide",
  title: "Trả lời 7 câu → ECS hay EKS",
  topics: ["ecs-vs-eks"],
  scenario: "Bấm Có/Không theo tình huống của bạn (hoặc của đề bài) để xem gợi ý orchestrator, kiểu compute và lý do.",
  questions: [
    {
      id: "k8s",
      q: "Team đã vận hành Kubernetes thành thạo?",
      eks: 2,
      why: "Team đã quen Kubernetes → chi phí học EKS gần như bằng 0.",
    },
    {
      id: "multi",
      q: "Phải chạy cả ngoài AWS (on-prem, cloud khác)?",
      eks: 3,
      why: "Cần chạy nhiều nơi → Kubernetes cho cùng manifest và công cụ ở mọi môi trường.",
    },
    {
      id: "eco",
      q: "Cần công cụ chỉ Kubernetes có (Helm chart sẵn, operator, ArgoCD, KEDA, Istio)?",
      eks: 2,
      why: "Cần hệ sinh thái Kubernetes mà ECS không có tương đương.",
    },
    {
      id: "platform",
      q: "Có platform team riêng phục vụ nhiều team dev?",
      eks: 1,
      why: "Có platform team → đủ người nâng version, quản add-on, RBAC đa team.",
    },
    {
      id: "small",
      q: "Team nhỏ, ưu tiên ship nhanh, không ai chuyên lo hạ tầng?",
      ecs: 3,
      why: "Team nhỏ → ECS bỏ hết khâu nâng version và lắp ghép add-on.",
    },
    {
      id: "gpu",
      q: "Cần GPU, agent chạy trên mỗi máy hoặc tuỳ biến máy sâu?",
      ec2: true,
      why: "Cần GPU / agent mỗi máy / tuỳ biến máy → không dùng được Fargate, phải có máy EC2. Câu này chọn compute, không chọn orchestrator: ECS có daemon service, EKS có DaemonSet, cả hai đều chạy GPU trên EC2 (https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service_definition_parameters.html).",
    },
    {
      id: "spiky",
      q: "Traffic lẻ tẻ, mỗi lần xử lý ngắn, không cần chạy thường trực?",
      lambda: true,
      why: "Tải lẻ tẻ, ngắn → cân nhắc Lambda trước khi nghĩ tới container.",
    },
  ],
});
