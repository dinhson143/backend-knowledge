BK.topic({
  id: "thr-green-threads",
  track: "cs",
  section: "cs-os",
  title: "Goroutine & Virtual Thread",
  goal: "Giải thích M:N scheduling và vì sao goroutine rẻ hơn OS thread",
  needs: ["thr-thread-vs-process", "os-context-switch"],
  tldr: {
    t: "**Green thread** (thread do runtime quản lý, không phải do kernel) chạy theo **M:N scheduling**: M thread của runtime luân phiên trên N OS thread, N thường bằng số core. Goroutine của Go và **virtual thread** của Java (JDK 21) là hai bản hiện đại. Chúng rẻ vì stack nhỏ, lớn dần khi cần, và đổi qua lại trong user space không vào kernel. Khi một green thread chờ I/O, runtime gỡ nó khỏi OS thread và cho cái khác chạy. Chúng không làm code chạy nhanh hơn; chúng cho phép có rất nhiều việc đang chờ cùng lúc.",
    why: "OS thread đắt vì mỗi cái có một stack cố định lớn và mỗi lần đổi phải qua scheduler của kernel. Go FAQ: goroutine mới chỉ được cấp stack vài KB, runtime tự nới và thu nhỏ, nên tạo hàng trăm nghìn goroutine trong một process là thực tế; nếu goroutine chỉ là thread thì tài nguyên hệ thống hết ở con số nhỏ hơn nhiều (https://go.dev/doc/faq#goroutines). JEP 444: virtual thread \"không phải thread nhanh hơn\", chúng có để tăng throughput, không giảm latency (https://openjdk.org/jeps/444).",
  },
  story: {
    problem: "Server Java một platform thread mỗi request. Mỗi request gọi 3 service, tổng chờ 300 ms. Muốn phục vụ 10.000 request đồng thời thì cần 10.000 OS thread: bộ nhớ stack và context switch làm máy nghẹt từ lâu trước khi CPU bận. Viết lại bằng async callback thì chạy được, nhưng stack trace vô nghĩa và code khó đọc.",
    idea: "Giữ kiểu code tuần tự \"một thread mỗi request\" nhưng làm thread rẻ: runtime tự chuyển thread đang chờ ra khỏi OS thread, để vài OS thread phục vụ hàng nghìn request. Code vẫn blocking theo cách viết, nhưng không chặn OS thread.",
    tradeoff: "Runtime phải tự lo scheduler, và có những chỗ nó không gỡ được (gọi native code, một số thao tác file); ở đó green thread chiếm luôn OS thread. Việc CPU-bound không lợi gì. Giới hạn tài nguyên phía sau (DB connection) vẫn phải tự đặt, vì tạo một triệu green thread không làm DB chịu được một triệu query.",
  },
  table: {
    head: ["", "OS thread (platform thread)", "Goroutine (Go)", "Virtual thread (Java 21+)", "Coroutine `asyncio` (Python)"],
    rows: [
      {
        cells: ["Ai lập lịch", "Kernel (1:1)", "Runtime Go, M:N lên tối đa `GOMAXPROCS` thread chạy cùng lúc", "Scheduler của JDK (ForkJoinPool) lên carrier thread, M:N", "Event loop, trên một thread"],
        why: "Go FAQ: `GOMAXPROCS` mặc định bằng số core (từ Go 1.25 còn xét CPU limit của cgroup — https://go.dev/doc/go1.25) và chỉ giới hạn số goroutine chạy cùng lúc; runtime có thể tạo thêm thread cho các goroutine đang kẹt trong syscall (https://go.dev/doc/faq). JEP 444: scheduler là ForkJoinPool work-stealing, parallelism mặc định bằng số processor.",
      },
      {
        cells: ["Chuyển việc ở đâu", "Bất kỳ lúc nào (timer interrupt)", "Ở điểm chặn, và từ Go 1.14 có thể preempt cả vòng lặp không gọi hàm", "Khi chặn trên I/O, lock, `sleep`; không có preempt theo time slice", "Chỉ ở `await`"],
        why: "Release notes Go 1.14: goroutine được preempt bất đồng bộ, nên vòng lặp không gọi hàm không còn có thể làm kẹt scheduler (https://go.dev/doc/go1.14). JEP 444 cũng nói scheduler của virtual thread hiện chưa có time sharing (preempt khi dùng hết một lượng CPU). Coroutine của asyncio là hợp tác: không `await` thì không nhường.",
      },
      {
        cells: ["Viết code", "Blocking, tuần tự", "Blocking, tuần tự; channel để trao đổi", "Blocking, tuần tự; API `Thread` như cũ", "`async`/`await` xuyên suốt; thư viện phải có bản async"],
        why: "Lợi thế của goroutine và virtual thread so với async/await: code cũ viết kiểu blocking chạy được, không phải \"tô màu\" mọi hàm thành async.",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao rẻ: stack** — OS thread nhận một vùng stack cỡ cố định ngay khi tạo (Linux/NPTL: theo `RLIMIT_STACK`, hoặc 2 MB trên đa số kiến trúc nếu limit là unlimited); goroutine bắt đầu với vài KB và runtime nới hoặc thu nhỏ khi cần.",
      why: "Cỡ stack mặc định của thread theo pthread_create(3) (https://man7.org/linux/man-pages/man3/pthread_create.3.html); vùng này là bộ nhớ ảo được giữ chỗ, nhưng số thread vẫn bị chặn bởi không gian địa chỉ và giới hạn của kernel. Goroutine: Go FAQ (mục \"Why goroutines instead of threads?\"). Virtual thread lưu stack trong heap dưới dạng stack chunk, co giãn theo độ sâu thực tế của call stack (JEP 444).",
    },
    {
      t: "**Vì sao rẻ: chuyển trong user space** — đổi goroutine hay virtual thread là việc của runtime: lưu vài thanh ghi và con trỏ stack, không syscall, không scheduler kernel.",
      why: "Chi phí trực tiếp và gián tiếp của context switch kernel ở bài `os-context-switch`. Green thread vẫn chạy trên OS thread, nên khi runtime cần thêm OS thread (chặn trong syscall) thì vẫn có context switch thật.",
    },
    {
      t: "**Khi một green thread chặn** — Go: goroutine gọi syscall chặn thì runtime dời các goroutine khác sang thread khác. Java: phần lớn thao tác chặn trong JDK **unmount** virtual thread khỏi carrier, carrier rảnh để chạy virtual thread khác.",
      why: "Go FAQ: khi một coroutine chặn, runtime tự chuyển các coroutine khác trên cùng OS thread sang thread khác chạy được. JEP 444: một số thao tác (nhiều thao tác filesystem) không unmount được, và JDK bù bằng cách tạm tăng số platform thread trong scheduler.",
    },
    {
      t: "**Pinning (Java)** — virtual thread bị **ghim** vào carrier: chặn lúc này thì chặn luôn OS thread. JDK 21: ghim khi chạy trong `synchronized` hoặc trong native method/foreign function. **JDK 24 (JEP 491)** bỏ ghim do `synchronized`; vẫn ghim khi native code gọi ngược lại Java rồi chặn, khi chặn lúc đang nạp class, và khi chặn trong class initializer.",
      why: "JEP 444 liệt kê hai trường hợp ghim và khuyên thay `synchronized` quanh I/O dài bằng `ReentrantLock` (https://openjdk.org/jeps/444). JEP 491 đổi cách JVM cài `synchronized` để virtual thread giữ monitor độc lập với carrier, loại bỏ \"gần như mọi\" trường hợp ghim; mục Future Work của JEP 491 liệt kê các trường hợp còn lại, đều do có native frame trên stack (https://openjdk.org/jeps/491). Vì vậy lời khuyên \"tránh `synchronized`\" chỉ còn đúng với JDK 21–23.",
    },
    {
      t: "**Không phải thread nhanh hơn** — việc CPU-bound không lợi gì: thêm virtual thread hay goroutine vượt số core không tăng throughput.",
      why: "JEP 444 nói thẳng: nếu task tính toán một giây thay vì ngủ, tăng số thread vượt số core không giúp gì, dù virtual hay platform. Lợi ích chỉ có khi phần lớn thời gian là chờ (bài I/O-bound hay CPU-bound).",
    },
    {
      t: "**Không pool, giới hạn bằng semaphore** — mỗi task một virtual thread; muốn giới hạn số lời gọi đồng thời tới một service thì dùng semaphore. Go tương tự: một channel có buffer cỡ N dùng làm semaphore.",
      why: "JEP 444: không nên pool virtual thread để giới hạn concurrency, dùng cấu trúc làm riêng cho việc đó như semaphore. Pool tồn tại vì platform thread đắt; giới hạn tài nguyên phía sau là chuyện khác và vẫn phải làm.",
    },
    {
      t: "**ThreadLocal cẩn thận** — virtual thread hỗ trợ `ThreadLocal`, nhưng một triệu virtual thread là một triệu bản sao; đừng dùng thread-local để cache tài nguyên đắt như thói quen với pool.",
      why: "JEP 444 khuyên chỉ dùng thread-local sau khi cân nhắc kỹ, và JDK đã gỡ nhiều chỗ dùng thread-local trong `java.base` để giảm bộ nhớ khi chạy hàng triệu thread.",
    },
    {
      t: "**Green thread cũ của Java khác virtual thread** — Java đời đầu có green thread M:1 (mọi thread của runtime chung một OS thread), sau đó bị platform thread 1:1 vượt qua. Virtual thread là M:N.",
      why: "JEP 444 kể lại lịch sử này. M:1 không dùng được nhiều core và một lời gọi chặn chặn tất cả; M:N giữ được cả hai: nhiều core và chuyển rẻ.",
    },
    {
      t: "**Python không có green thread trong thư viện chuẩn** — `asyncio` dùng coroutine hợp tác trên một event loop, phải viết `async`/`await`. Gần nhất với \"code blocking mà không chặn\" là thư viện bên ngoài, và chúng phải vá thư viện chuẩn.",
      why: "Coroutine của asyncio chỉ nhường ở `await`; một hàm blocking (thư viện đồng bộ) chặn cả loop. Vì vậy với Python, chọn giữa thread (code blocking, vướng GIL khi tính) và asyncio (cần thư viện async); xem bài I/O-bound hay CPU-bound.",
    },
  ],
  sections: [
    {
      title: "So sánh nhanh khi phỏng vấn",
      table: {
        head: ["Câu hỏi", "Trả lời ngắn", "Vì sao"],
        rows: [
          {
            cells: ["Goroutine rẻ hơn thread ở đâu?", "Stack vài KB co giãn; chuyển trong user space; runtime gom nhiều goroutine lên ít thread", "Ba thứ đắt của OS thread là stack cố định lớn, syscall khi tạo, và context switch qua kernel"],
            why: "Câu trả lời đủ ba ý cho thấy bạn hiểu chi phí của thread nằm ở đâu, không chỉ nhớ câu \"goroutine nhẹ\".",
          },
          {
            cells: ["Virtual thread có thay được async không?", "Với việc I/O-bound: phần lớn có, code tuần tự dễ đọc hơn. Với việc CPU-bound: không giúp gì", "Cả hai giải cùng bài: nhiều việc chờ trên ít OS thread"],
            why: "Async buộc viết lại mọi hàm và thư viện; virtual thread giữ API `Thread` cũ. Cái giá là phải biết các chỗ còn ghim carrier.",
          },
          {
            cells: ["Một triệu goroutine có vấn đề gì?", "Bộ nhớ stack cộng dồn, goroutine leak (chờ channel mãi), và tải dồn lên phụ thuộc phía sau", "Rẻ không có nghĩa là miễn phí"],
            why: "Goroutine không tự chết khi không ai đọc kết quả của nó; leak tích dần thành tốn RAM. Cách tránh leak bằng context và channel ở bài `thr-goroutine-channel` (sắp viết).",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Nói \"M:N scheduling\" và giải thích hai số: M việc của runtime, N OS thread ≈ số core. Rồi nêu điều kiện để có lợi: việc chủ yếu là chờ.",
      why: "Interviewer hay hỏi tiếp \"vậy virtual thread có làm API nhanh hơn không?\"; trả lời đúng là không giảm latency của từng request, chỉ tăng số request phục vụ được cùng lúc.",
    },
    {
      t: "Nhắc pinning kèm phiên bản JDK: 21–23 ghim trong `synchronized`, 24 trở đi `synchronized` không còn ghim (vẫn còn vài trường hợp do native frame).",
      why: "Nhiều bài viết cũ vẫn khuyên bỏ `synchronized`; nêu được JEP 491 cho thấy kiến thức của bạn cập nhật.",
    },
  ],
  related: ["ctx-switch"],
  cards: [
    ["M:N scheduling là gì?", "M thread của runtime (goroutine, virtual thread) được lập lịch lên N OS thread, N thường bằng số core."],
    ["Vì sao goroutine rẻ hơn OS thread?", "Stack khởi đầu vài KB và co giãn; chuyển goroutine trong user space, không qua kernel; runtime gom nhiều goroutine lên ít thread."],
    ["Virtual thread có làm từng request nhanh hơn không?", "Không. JEP 444: chúng tăng throughput (nhiều việc đồng thời hơn), không giảm latency; việc CPU-bound không lợi gì."],
    ["Pinning là gì và khi nào xảy ra?", "Virtual thread không gỡ được khỏi carrier, nên chặn là chặn cả OS thread. JDK 21–23: trong `synchronized` hoặc native; JDK 24+ (JEP 491): `synchronized` hết ghim; còn ghim khi native code gọi ngược lại Java rồi chặn, khi nạp class, và trong class initializer."],
    ["Muốn giới hạn 20 lời gọi đồng thời tới một service khi dùng virtual thread?", "Dùng semaphore 20 permit, không dùng pool virtual thread cỡ 20."],
    ["Go 1.14 thay đổi gì về preemption?", "Goroutine được preempt bất đồng bộ, vòng lặp không gọi hàm không còn làm kẹt scheduler hay GC."],
  ],
});
