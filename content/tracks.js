// Track (thư mục content/topics/<id>/) và section. Thứ tự section trong file = thứ tự trong track.
BK.track({ id: "sd", title: "System Design", subtitle: "Hello Interview · System Design in a Hurry" });
BK.section({ id: "sd-framework", track: "sd", title: "1 · Delivery Framework" });
BK.section({ id: "sd-core", track: "sd", title: "2 · Core Concepts" });
BK.section({ id: "sd-tech", track: "sd", title: "3 · Key Technologies" });
BK.section({ id: "sd-patterns", track: "sd", title: "4 · Common Patterns" });
BK.section({ id: "sd-deep", track: "sd", title: "5 · Technology Deep Dives" });

BK.track({ id: "lld", title: "Low-Level Design", subtitle: "Hello Interview · Low-Level Design in a Hurry" });
BK.section({ id: "lld-framework", track: "lld", title: "1 · Delivery Framework" });
BK.section({ id: "lld-oop", track: "lld", title: "2 · OOP" });
BK.section({ id: "lld-principles", track: "lld", title: "3 · Design Principles" });
BK.section({ id: "lld-patterns", track: "lld", title: "4 · Design Patterns" });
BK.section({ id: "lld-concurrency", track: "lld", title: "5 · Concurrency" });
BK.section({ id: "lld-problems", track: "lld", title: "6 · Problem Breakdowns" });

BK.track({ id: "cloud", title: "Container trên AWS", subtitle: "ECS · EKS · Fargate" });
BK.section({ id: "cloud-containers", track: "cloud", title: "1 · ECS & EKS" });

BK.track({
  id: "arch",
  title: "Kiến trúc & phương pháp",
  subtitle: "Layered · Hexagonal · Onion · Clean · Microservices · TDD · BDD · DDD",
});
BK.section({ id: "arch-main", track: "arch", title: "1 · Kiến trúc phần mềm" });

BK.track({ id: "dsa", title: "Coding · DSA", subtitle: "Algorithms & Data Structures" });
BK.section({ id: "dsa-complexity", track: "dsa", title: "1 · Complexity" });
BK.section({ id: "dsa-ds", track: "dsa", title: "2 · Data Structures" });
BK.section({ id: "dsa-algo", track: "dsa", title: "3 · Algorithms" });
