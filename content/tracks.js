// Track (thư mục content/topics/<id>/) và section. Thứ tự section trong file = thứ tự trong track.
BK.track({ id: "sd", title: "System Design", subtitle: "Hello Interview · System Design in a Hurry" });
BK.section({ id: "sd-framework", track: "sd", title: "Delivery Framework" });
BK.section({ id: "sd-core", track: "sd", title: "Core Concepts" });
BK.section({ id: "sd-tech", track: "sd", title: "Key Technologies" });
BK.section({ id: "sd-patterns", track: "sd", title: "Common Patterns" });
BK.section({ id: "sd-deep", track: "sd", title: "Technology Deep Dives" });

BK.track({ id: "lld", title: "Low-Level Design", subtitle: "Hello Interview · Low-Level Design in a Hurry" });
BK.section({ id: "lld-framework", track: "lld", title: "Delivery Framework" });
BK.section({ id: "lld-oop", track: "lld", title: "OOP" });
BK.section({ id: "lld-principles", track: "lld", title: "Design Principles" });
BK.section({ id: "lld-patterns", track: "lld", title: "Design Patterns" });
BK.section({ id: "lld-concurrency", track: "lld", title: "Concurrency" });
BK.section({ id: "lld-problems", track: "lld", title: "Problem Breakdowns" });

BK.track({ id: "beh", title: "Behavioral", subtitle: "STAR · câu hỏi hay gặp · kể sâu dự án" });
BK.section({ id: "beh-stories", track: "beh", title: "Câu chuyện của bạn" });

BK.track({ id: "cloud", title: "Container trên AWS", subtitle: "ECS · EKS · Fargate" });
BK.section({ id: "cloud-k8s", track: "cloud", title: "Container & Kubernetes" });
BK.section({ id: "cloud-containers", track: "cloud", title: "ECS & EKS" });

BK.track({
  id: "arch",
  title: "Kiến trúc & phương pháp",
  subtitle: "Layered · Hexagonal · Onion · Clean · Microservices · TDD · BDD · DDD",
});
BK.section({ id: "arch-main", track: "arch", title: "Kiến trúc phần mềm" });

BK.track({ id: "dsa", title: "Coding · DSA", subtitle: "Algorithms & Data Structures" });
BK.section({ id: "dsa-complexity", track: "dsa", title: "Complexity" });
BK.section({ id: "dsa-ds", track: "dsa", title: "Data Structures" });
BK.section({ id: "dsa-algo", track: "dsa", title: "Algorithms" });

BK.track({ id: "cs", title: "Nền tảng CS", subtitle: "Process · Thread · Memory · I/O · Concurrency" });
BK.section({ id: "cs-os", track: "cs", title: "Hệ điều hành" });
BK.section({ id: "cs-async", track: "cs", title: "Async Programming" });
BK.section({ id: "cs-net", track: "cs", title: "Mạng máy tính" });

BK.track({ id: "code", title: "Kỹ năng viết code", subtitle: "Vòng coding · Code sạch · Kiểm thử" });
BK.section({ id: "code-interview", track: "code", title: "Vòng coding" });
BK.section({ id: "code-clean", track: "code", title: "Clean Code" });
BK.section({ id: "code-testing", track: "code", title: "Kiểm thử & debug" });

BK.track({ id: "py", title: "Python", subtitle: "Ngôn ngữ cốt lõi · CPython · Python cho backend" });
BK.section({ id: "py-core", track: "py", title: "Ngôn ngữ cốt lõi" });
BK.section({ id: "py-runtime", track: "py", title: "Bên trong CPython" });
BK.section({ id: "py-concurrency", track: "py", title: "Concurrency trong Python" });
BK.section({ id: "py-tooling", track: "py", title: "Đóng gói & kiểm thử" });
BK.section({ id: "py-backend", track: "py", title: "Python cho backend" });
