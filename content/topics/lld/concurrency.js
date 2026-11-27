BK.topic({
  id: "concurrency",
  track: "lld",
  section: "lld-concurrency",
  title: "Concurrency & Deadlock",
  goal: "Dùng lock, semaphore, condition variable và tránh deadlock",
  needs: ["thr-thread-vs-process"],
  tldr: {
    t: "Concurrency là xử lý nhiều tác vụ xen kẽ (không nhất thiết song song vật lý). Một process: lock, semaphore, condition variable. Nhiều server: distributed lock, queue, transaction, idempotency.",
    why: "Một CPU core vẫn có race condition, vì concurrency chỉ cần các tác vụ đan xen trên timeline và OS có thể chuyển thread giữa hai lệnh bất kỳ. Lock trong một process không có tác dụng với process khác → nhiều server phải dùng cơ chế chung như DB transaction hay distributed lock.",
  },
  story: {
    problem: "Hai request cùng đặt ghế A5: cả hai đọc thấy ghế trống, cả hai ghi “đã đặt” → một ghế bán cho hai người. Hoặc hai thread mỗi bên giữ một lock và chờ lock của bên kia → hệ thống treo mãi mãi.",
    idea: "Biến thao tác “đọc–kiểm tra–ghi” thành không thể chen ngang (lock, transaction), cho thread chờ nhau có trật tự (condition, queue), và giới hạn số người dùng tài nguyên khan hiếm (semaphore).",
    tradeoff: "Lock bắt thread chờ nên giảm throughput, dùng sai thì sinh deadlock. Với nhiều server, distributed lock thêm network round-trip và có rủi ro lock hết hạn giữa chừng.",
  },
  table: {
    head: ["Primitive", "Dùng để", "Python"],
    rows: [
      {
        cells: ["Lock (Mutex)", "Bảo vệ critical section, mutual exclusion", "`threading.Lock`"],
        why: "`count += 1` thực tế là ba bước đọc, cộng, ghi → hai thread chen nhau có thể cùng đọc 5 và cùng ghi 6. Lock đảm bảo mỗi lúc chỉ một thread ở trong critical section, nên ba bước chạy liền mạch.",
      },
      {
        cells: [
          "Semaphore",
          "Giới hạn N thread cùng truy cập (connection pool, giới hạn số việc chạy đồng thời)",
          "`threading.Semaphore(n)`",
        ],
        why: "Semaphore khác lock ở chỗ cho **N thread** cùng vào, không chỉ một. Ví dụ DB chỉ chịu được 10 connection → semaphore khởi tạo 10 permit; thread thứ 11 bị block tới khi có thread `release()`.",
      },
      {
        cells: ["Condition Variable", "Chờ đến khi điều kiện đúng (producer–consumer)", "`threading.Condition`"],
        why: "Condition variable cho thread ngủ bằng `wait()` và được đánh thức bằng `notify()` khi producer đẩy item — thay vì consumer gặp queue rỗng rồi kiểm tra liên tục (busy-wait) đốt CPU. `wait()` nhả lock khi ngủ nên producer vào được.",
      },
    ],
  },
  points: [
    {
      t: "+ **Correctness** — giữ dữ liệu đúng khi nhiều thread cùng sửa: race condition, critical section, atomic, lock.",
      why: "Mọi thao tác đọc–sửa–ghi trên dữ liệu chung đều có thể bị chen, vì thread có thể bị chuyển giữa hai lệnh máy bất kỳ. Lock hoặc thao tác atomic (compare-and-swap) đảm bảo kết quả không phụ thuộc may rủi lịch chạy.",
    },
    {
      t: "+ **Coordination** — cho các thread chờ và báo nhau: producer–consumer, blocking queue, condition variable, thread pool.",
      why: "Producer và consumer chạy khác tốc độ → cần cơ chế cho bên nhanh chờ bên chậm, thay vì mất dữ liệu hay quay vòng vô ích. Blocking queue gói sẵn lock + condition: `put()` tự chờ khi đầy, `get()` tự chờ khi rỗng (`queue.Queue` của Python — https://docs.python.org/3/library/queue.html; Java `BlockingQueue` gọi là `put()`/`take()`).",
    },
    {
      t: "+ **Scarcity** — chia tài nguyên có hạn: semaphore, connection pool, rate limiting, backpressure.",
      why: "Không giới hạn số người dùng đồng thời thì hệ thống phía sau quá tải và sập, vì tài nguyên như connection DB, quota API là hữu hạn. Backpressure báo ngược cho bên gửi chậm lại, thay vì đẩy thêm vào queue vô hạn.",
    },
    {
      t: "**Race condition** — kết quả phụ thuộc thứ tự chạy của các thread khi cùng truy cập critical section.",
      why: "Race condition phải ngăn bằng thiết kế, không thể dựa vào test để bắt: kết quả phụ thuộc thread nào chạy trước, nên bug chỉ thỉnh thoảng xuất hiện và khó tái hiện.",
    },
    {
      t: "**4 điều kiện deadlock (Coffman)** — Mutual exclusion · Hold and wait · No preemption · Circular wait.",
      why: "Phá được bất kỳ một điều kiện là đủ ngăn deadlock, vì deadlock chỉ xảy ra khi cả bốn điều kiện cùng đúng. Ví dụ lock ordering phá circular wait, timeout phá hold-and-wait vô hạn.",
    },
    {
      t: "**Giải deadlock** — lock ordering (luôn lấy lock theo thứ tự cố định), timeout (`lock.acquire(timeout=5)`), deadlock detection (DB phát hiện và kill transaction).",
      why: "Mọi thread luôn lấy lock1 trước lock2 thì vòng tròn không thể hình thành, vì circular wait cần A giữ lock1 chờ lock2 còn B giữ lock2 chờ lock1. Timeout cho thread bỏ cuộc và thả lock; DB thì xây wait-for graph, thấy chu trình thì kill một transaction.",
    },
    {
      t: "**Multi-server** — Distributed lock, Kafka / message queue (event-driven), Database transactions (ACID), Idempotency.",
      why: "Hai server không thấy lock của nhau, vì `threading.Lock` chỉ nằm trong RAM của một process. Phải dùng thứ cả hai cùng truy cập: Redis/DB lock, một partition Kafka xử lý tuần tự theo key, hoặc ràng buộc ACID trong DB.",
    },
    {
      t: "+ **Idempotency** — gọi nhiều lần cho cùng kết quả như một lần; hiện thực bằng idempotency key + bảng ghi nhận request đã xử lý.",
      why: "API không idempotent thì client retry sẽ trừ tiền hai lần, vì network có thể timeout sau khi server đã xử lý xong. Lưu idempotency key kèm kết quả (với unique constraint) thì lần gọi thứ hai chỉ trả lại kết quả cũ.",
    },
  ],
  cards: [
    [
      "3 nhóm bài toán concurrency trong LLD (Hello Interview)?",
      "Correctness (dữ liệu đúng: lock, atomic), Coordination (chờ/báo nhau: blocking queue, condition variable), Scarcity (tài nguyên có hạn: semaphore, pool, rate limit).",
    ],
    [
      "4 điều kiện để xảy ra deadlock?",
      "Mutual exclusion, Hold and wait, No preemption, Circular wait — phá 1 trong 4 là hết deadlock.",
    ],
    [
      "Cách phòng deadlock phổ biến nhất trong code?",
      "Lock ordering: mọi thread lấy các lock theo cùng một thứ tự cố định, phá điều kiện circular wait.",
    ],
    [
      "Mutex vs Semaphore?",
      "Mutex: chỉ 1 thread vào critical section. Semaphore(n): tối đa n thread cùng lúc.",
    ],
    [
      "Concurrency khác parallelism?",
      "Concurrency: nhiều tác vụ tiến triển xen kẽ. Parallelism: chạy đồng thời thật trên nhiều core.",
    ],
  ],
});
