BK.topic({
  id: "container-basics",
  track: "cloud",
  section: "cloud-k8s",
  title: "Container là gì?",
  goal: "Giải thích container khác VM nhờ namespace, cgroup và image nhiều layer",
  needs: ["networking"],
  tldr: {
    t: "Container là **một process Linux bình thường** được đóng khung bằng hai cơ chế của kernel: **namespace** cho nó thấy một thế giới riêng (PID, mạng, mount, hostname, user), **cgroup** giới hạn CPU, RAM, IO, số process. Filesystem của nó đến từ một **image** gồm nhiều layer chỉ đọc. Không có kernel riêng, nên khởi động nhanh như chạy một process, đổi lại mọi container trên một máy **dùng chung kernel** và cách ly yếu hơn VM.",
    why: "Container khởi động nhanh vì không có gì phải boot: kernel của host đã chạy sẵn, tạo container chỉ là tạo process trong namespace mới và gắn nó vào cgroup. Docker viết thẳng: \"every container on a machine shares that machine's kernel\" (https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/). Chung kernel cũng là lý do một lỗ hổng kernel có thể cho container thoát ra host, điều mà ranh giới hypervisor của VM chặn được.",
  },
  story: {
    problem: "Cùng một service chạy được trên máy dev nhưng hỏng trên server vì khác phiên bản thư viện, khác OS, khác biến môi trường. Dùng VM cho mỗi service thì đóng gói được cả môi trường, nhưng mỗi VM kéo theo một hệ điều hành đầy đủ: tốn RAM, boot chậm, image nặng hàng GB.",
    idea: "Đóng gói app cùng mọi thứ nó cần (thư viện, runtime, file cấu hình) thành một image, rồi chạy nó như một process được cách ly trên kernel có sẵn. Image giống hệt nhau ở mọi nơi, còn chi phí chạy gần bằng một process thường.",
    tradeoff: "Cách ly dựa vào kernel chung nên yếu hơn VM: chạy code không tin cậy của nhiều khách hàng trên cùng host cần thêm micro-VM (Firecracker, Fargate) hoặc sandbox. Container còn là thứ dùng một lần: dữ liệu ghi vào filesystem của nó mất khi container bị xoá.",
  },
  sections: [
    {
      title: "Container và VM",
      table: {
        head: ["", "VM", "Container"],
        rows: [
          {
            cells: ["Cách ly bằng", "Hypervisor giả lập phần cứng", "Namespace + cgroup của kernel host"],
            why: "VM có kernel riêng vì hypervisor cho mỗi máy ảo một bộ CPU, RAM, đĩa ảo để boot cả hệ điều hành. Container không có tầng giả lập nào: nó là process trên kernel host, kernel chỉ \"che mắt\" nó bằng namespace và \"giới hạn khẩu phần\" bằng cgroup.",
          },
          {
            cells: ["Kernel", "Mỗi VM một kernel", "Dùng chung kernel host"],
            why: "Dùng chung kernel nghĩa là không chạy được container Windows trên kernel Linux, và mọi syscall của container đi thẳng vào kernel host. Một lỗ hổng kernel vì vậy chạm được mọi container trên máy đó.",
          },
          {
            cells: ["Khởi động", "Phải boot OS", "Gần bằng thời gian khởi động process"],
            why: "VM phải chạy firmware, kernel, init trước khi tới app. Container bỏ qua toàn bộ phần đó vì kernel host đã chạy; thời gian còn lại chủ yếu là tải image (nếu chưa có) và chính app khởi động.",
          },
          {
            cells: ["Kích thước", "GB (cả OS)", "MB tới vài trăm MB (chỉ app + thư viện)"],
            why: "Image container không chứa kernel và thường chỉ có thư viện app cần. Layer dùng chung giữa các image chỉ lưu một lần, nên trên một host chạy 20 service cùng base image, phần base chỉ tốn đĩa một lần.",
          },
          {
            cells: ["Hợp cho", "Cách ly mạnh, OS khác nhau, multi-tenant không tin nhau", "Đóng gói service, mật độ cao, deploy nhanh"],
            why: "Hai cách thường kết hợp: cloud chạy container bên trong VM hoặc micro-VM. Fargate cho mỗi task/pod một micro-VM riêng chính vì không muốn hai khách hàng chung một kernel (xem `ecs`, `eks`).",
          },
        ],
      },
    },
    {
      title: "Namespace: process thấy gì",
      table: {
        head: ["Namespace", "Cách ly", "Hệ quả thực tế"],
        rows: [
          {
            cells: ["PID", "Số hiệu process", "App trong container thấy mình là PID 1"],
            why: "Container có cây process riêng bắt đầu từ PID 1, nên `ps` bên trong chỉ thấy process của nó. PID 1 có trách nhiệm đặc biệt: nhận tín hiệu dừng (`SIGTERM`) và dọn process con; app không xử lý tín hiệu thì bị kill cứng sau timeout (xem `dockerfile`).",
          },
          {
            cells: ["Network", "Card mạng, IP, port, bảng route", "`localhost` trong container không phải `localhost` của host"],
            why: "Mỗi network namespace có stack mạng riêng, kể cả loopback. App nghe ở `127.0.0.1:8080` trong container thì từ host không gọi được; phải nghe ở `0.0.0.0` và map port (`-p 8080:8080`). Pod trong Kubernetes là nhiều container dùng **chung** một network namespace, nên chúng gọi nhau qua `localhost` (xem `k8s-core`).",
          },
          {
            cells: ["Mount", "Điểm mount, cây thư mục", "Container thấy filesystem của image làm `/`"],
            why: "Mount namespace cho container một cây mount riêng có gốc là filesystem từ image. Volume và bind mount là cách duy nhất để thư mục của host xuất hiện bên trong.",
          },
          {
            cells: ["UTS", "Hostname", "Mỗi container có hostname riêng"],
            why: "Hostname là thứ app hay ghi vào log; cách ly nó giúp log phân biệt được từng container mà không đổi tên máy host.",
          },
          {
            cells: ["IPC", "System V IPC, POSIX message queue", "Shared memory không lọt giữa các container"],
            why: "Không cách ly IPC thì hai container có thể đọc chung vùng shared memory của nhau, phá vỡ cách ly dữ liệu.",
          },
          {
            cells: ["User", "UID/GID", "root trong container có thể là user thường ngoài host"],
            why: "User namespace map UID 0 bên trong sang một UID không đặc quyền bên ngoài, nên thoát được container cũng chỉ có quyền user thường. Docker hỗ trợ nhưng **không bật mặc định** (https://docs.docker.com/engine/security/), vì vậy vẫn nên chạy app bằng user không phải root.",
          },
          {
            cells: ["Cgroup, Time", "Gốc cgroup; đồng hồ boot/monotonic", "Container không thấy cấu trúc cgroup của host"],
            why: "Cgroup namespace giấu đường dẫn cgroup thật của host khỏi container. Time namespace chỉ cách ly đồng hồ boot và monotonic, không cách ly giờ thực, nên mọi container vẫn chung giờ hệ thống.",
          },
        ],
      },
    },
    {
      title: "Cgroup: dùng được bao nhiêu",
      points: [
        {
          t: "**Memory** — `memory.max` là trần cứng: vượt mà kernel không thu hồi được bộ nhớ thì **OOM killer** giết process trong cgroup (container thoát với exit code 137, Kubernetes ghi `OOMKilled`).",
          why: "Kernel không thể \"cho nợ\" RAM: khi không còn trang nào thu hồi được trong giới hạn, cách duy nhất để giữ trần là giết process. Tài liệu cgroup v2: \"If a cgroup's memory usage reaches this limit and can't be reduced, the OOM killer is invoked in the cgroup\" (https://docs.kernel.org/admin-guide/cgroup-v2.html). `memory.high` thì khác: vượt nó chỉ bị throttle và thu hồi mạnh, không bao giờ bị OOM kill.",
        },
        {
          t: "**CPU** — `cpu.max` dạng `$MAX $PERIOD` (mặc định chu kỳ 100 ms): dùng hết quota trong chu kỳ thì bị **throttle** tới chu kỳ sau, **không bị kill**.",
          why: "CPU là tài nguyên chia theo thời gian nên có thể bắt chờ: process dùng hết quota thì kernel không xếp lịch cho nó tới chu kỳ sau. Hệ quả hay gặp: latency p99 tăng vọt dù CPU trung bình thấp, vì request rơi đúng lúc bị throttle. `cpu.weight` (mặc định 100) chỉ chia tỉ lệ khi các cgroup tranh nhau, không phải trần.",
        },
        {
          t: "**IO và số process** — `io.max` giới hạn BPS/IOPS theo thiết bị; `pids.max` giới hạn số process, chặn fork bomb.",
          why: "Vượt `io.max` thì IO bị trì hoãn chứ không lỗi. Vượt `pids.max` thì `fork()`/`clone()` trả lỗi `EAGAIN`, nên một container lỗi sinh process vô hạn không làm cạn bảng process của cả host.",
        },
        {
          t: "Kubernetes biến `resources.limits` của container thành giá trị cgroup này; `requests` là thứ scheduler dùng để xếp pod (chi tiết ở topic vận hành Kubernetes).",
          why: "Biết hai lớp này mới giải thích được \"pod bị OOMKilled dù node còn RAM\": node còn RAM nhưng cgroup của container đã chạm `memory.max` do limit đặt thấp.",
        },
      ],
    },
    {
      title: "Image, layer và container layer",
      points: [
        {
          t: "**Image = nhiều layer filesystem chỉ đọc + config** (lệnh chạy, env, user). Mỗi layer là một changeset so với layer dưới; xếp chồng các layer theo thứ tự ra filesystem cuối.",
          why: "OCI image spec định nghĩa layer là \"a changeset that describes a container's filesystem\" và config quyết định thứ tự layer (https://github.com/opencontainers/image-spec/blob/main/spec.md). Mỗi lệnh `RUN`/`COPY` trong Dockerfile tạo một layer, nên thứ tự lệnh quyết định build cache (xem `dockerfile`).",
        },
        {
          t: "**Định danh bằng digest** (`sha256:…`, hash của nội dung): hai image dùng chung base thì registry và máy chạy chỉ lưu, chỉ tải layer base **một lần**.",
          why: "Digest là hash của chính các byte nội dung nên nội dung giống nhau thì digest giống nhau, và tải về có thể tự kiểm lại hash để biết không bị sửa (https://github.com/opencontainers/image-spec/blob/main/descriptor.md). Tag như `node:22` thì trỏ được sang nội dung khác bất cứ lúc nào; digest thì không.",
        },
        {
          t: "**Container layer**: mỗi container có thêm một layer mỏng **ghi được** ở trên cùng; sửa file của image thì file được copy lên layer này (copy-on-write). Xoá container là mất layer này.",
          why: "Các container chạy từ cùng image dùng chung các layer chỉ đọc, mỗi container chỉ giữ phần thay đổi của riêng nó (https://docs.docker.com/engine/storage/drivers/). Vì layer ghi được bị xoá cùng container, dữ liệu cần giữ (upload, database) phải nằm ở volume hoặc dịch vụ ngoài: đó là lý do service chạy container phải stateless.",
        },
        {
          t: "**Volume và bind mount** gắn thư mục ngoài vào container; dữ liệu sống lâu hơn container. Ghi nhiều thì dùng volume, đừng ghi vào container layer.",
          why: "Copy-on-write có chi phí: lần ghi đầu vào một file lớn của image phải copy cả file lên layer trên. Volume đi thẳng vào filesystem của host nên không chịu chi phí đó, và Docker khuyên dùng volume cho dữ liệu ghi nhiều hoặc cần giữ lại.",
        },
      ],
    },
    {
      title: "Chuẩn OCI và ai chạy container",
      points: [
        {
          t: "**OCI** có ba spec: **image-spec** (định dạng image), **runtime-spec** (cách chạy một filesystem bundle thành container), **distribution-spec** (API đẩy/kéo image với registry).",
          why: "Có chuẩn chung nên một image build bằng Docker chạy được trên containerd, Podman hay Kubernetes, và đẩy được lên mọi registry tuân chuẩn (ECR, GHCR, Docker Hub). Nguồn: https://opencontainers.org/about/overview/",
        },
        {
          t: "**runc** là runtime tham chiếu của OCI (Docker tặng cho OCI): nó gọi kernel tạo namespace, gắn cgroup rồi chạy process. Các công cụ cấp cao (Docker, containerd) lo phần tải image, giải nén layer, mạng.",
          why: "Tách lớp như vậy nên \"chạy container\" cuối cùng luôn quy về vài syscall: `clone()`/`unshare()` với cờ `CLONE_NEW*` để tạo namespace, ghi vào cgroup để giới hạn, rồi `exec` app (https://man7.org/linux/man-pages/man7/namespaces.7.html).",
        },
        {
          t: "**Kubernetes không cần Docker**: kubelet nói chuyện với container runtime (containerd, CRI-O) qua **CRI**, một giao thức gRPC.",
          why: "CRI cho kubelet dùng nhiều runtime khác nhau mà không phải biên dịch lại cluster (https://kubernetes.io/docs/concepts/architecture/cri/). Image build bằng Docker vẫn chạy bình thường vì nó là image OCI.",
        },
      ],
    },
    {
      title: "Bảo mật ở mức cần nói trong phỏng vấn",
      points: [
        {
          t: "Root trong container **bớt quyền hơn** root thật (Docker bỏ hết capability trừ những cái cần), nhưng vẫn là UID 0 trên kernel chung nếu không bật user namespace.",
          why: "Docker dùng danh sách capability cho phép: \"By default Docker drops all capabilities except those needed\" (https://docs.docker.com/engine/security/). Phần còn lại vẫn đủ để một lỗ hổng kernel hay một mount sai (`/var/run/docker.sock`, `--privileged`) biến root trong container thành root trên host.",
        },
        {
          t: "Lớp phòng thủ: chạy bằng user không phải root, bỏ capability thừa, seccomp/AppArmor chặn syscall lạ, filesystem chỉ đọc; cần cách ly mạnh giữa các khách hàng thì dùng micro-VM.",
          why: "Mỗi lớp thu hẹp những gì một process bị chiếm làm được với kernel chung. Không lớp nào biến container thành VM, nên multi-tenant với code không tin cậy vẫn cần ranh giới hypervisor (Firecracker, Fargate, gVisor).",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Được hỏi \"container là gì\", mở đầu bằng \"một process được cách ly bằng namespace và giới hạn bằng cgroup\" rồi mới so với VM.",
      why: "Câu này cho thấy bạn hiểu cơ chế, không chỉ thuộc định nghĩa marketing. Từ đó mọi câu hỏi tiếp (vì sao nhanh, vì sao cách ly yếu, vì sao OOM) đều suy ra được.",
    },
    {
      t: "Phân biệt rõ: vượt memory limit là **bị kill**, vượt CPU limit là **bị chậm**.",
      why: "Đây là câu hỏi bẫy phổ biến và là nguyên nhân của hai loại sự cố khác nhau: pod restart liên tục (OOMKilled) và latency tăng bí ẩn (CPU throttling).",
    },
    {
      t: "Khi thiết kế, nói rõ dữ liệu nào nằm ngoài container (database, object storage, volume) để service stateless và scale ngang được.",
      why: "Container có thể bị xoá và tạo lại bất cứ lúc nào (deploy, node hỏng, autoscale); dữ liệu nằm trong container layer sẽ mất theo.",
    },
  ],
  cards: [
    [
      "Vì sao container khởi động nhanh hơn VM?",
      "Container là process trên kernel host đã chạy sẵn; tạo container chỉ là tạo process trong namespace mới và gắn cgroup. VM phải boot cả hệ điều hành.",
    ],
    [
      "Container vượt memory limit thì sao? Vượt CPU limit thì sao?",
      "Memory: không thu hồi được thì OOM killer giết process (exit 137, OOMKilled). CPU: bị throttle tới chu kỳ sau, chậm đi nhưng không bị kill.",
    ],
    [
      "Hai image cùng base thì registry và máy chạy lưu bao nhiêu bản base?",
      "Một. Layer được định danh bằng digest của nội dung, nên layer giống nhau chỉ lưu và tải một lần.",
    ],
    [
      "Vì sao không lưu file upload trong filesystem của container?",
      "Phần ghi nằm ở container layer, bị xoá cùng container (deploy, restart trên node khác). Dữ liệu cần giữ phải ở volume hoặc object storage.",
    ],
    [
      "App nghe ở 127.0.0.1 trong container, vì sao host gọi không được?",
      "Container có network namespace riêng, loopback của nó khác loopback của host. Phải nghe 0.0.0.0 và map port.",
    ],
    [
      "Kubernetes có cần Docker không?",
      "Không. Kubelet gọi container runtime (containerd, CRI-O) qua CRI. Image build bằng Docker vẫn chạy vì đều là image OCI.",
    ],
  ],
  related: ["container-stack"],
});
