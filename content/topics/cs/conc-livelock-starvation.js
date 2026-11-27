BK.topic({
  id: "conc-livelock-starvation",
  track: "cs",
  section: "cs-os",
  title: "Livelock, Starvation, Fairness",
  goal: "Nhận ra livelock, thread bị đói và priority inversion",
  needs: ["concurrency"],
  tldr: {
    t: "Ba lỗi \"không tiến triển\" ngoài deadlock. **Livelock**: các thread vẫn chạy, vẫn tốn CPU, nhưng cứ nhường nhau hoặc thử lại theo cùng một nhịp nên không ai làm xong việc. **Starvation** (bị đói): hệ thống vẫn tiến triển, nhưng một thread mãi không tới lượt vì người khác luôn giành trước. **Priority inversion**: thread ưu tiên cao phải chờ thread ưu tiên thấp đang giữ lock, và thread ưu tiên trung bình chen vào làm cuộc chờ kéo dài. **Fairness** là đảm bảo thứ tự phục vụ để chống đói, đổi lại throughput thấp hơn.",
    why: "Deadlock dễ thấy vì mọi thứ đứng im; ba lỗi này khó thấy hơn vì CPU vẫn bận hoặc hệ thống vẫn chạy với phần lớn request. Lock mặc định thường **không** hứa thứ tự: tài liệu Python nói khi nhiều thread chờ một `Lock`, thread nào được chạy tiếp là không xác định (https://docs.python.org/3/library/threading.html); Javadoc `ReentrantLock` nói lock không fair không đảm bảo thứ tự nào (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html).",
  },
  story: {
    problem: "Để tránh deadlock, team đổi sang \"lấy lock A, thử lock B, không được thì nhả A và thử lại ngay\". Deadlock hết, nhưng giờ hai worker chuyển tiền ngược chiều nhau cứ lấy, thử, nhả, lấy lại theo cùng nhịp; CPU 100%, không giao dịch nào xong. Ở chỗ khác, job báo cáo cần write lock trên cache nhưng reader nối đuôi nhau không bao giờ dứt, job chờ cả giờ.",
    idea: "Livelock: phá thế đối xứng bằng backoff ngẫu nhiên (jitter) hoặc thứ tự lấy lock cố định. Starvation: dùng lock/queue có thứ tự (FIFO, fair lock), hoặc giới hạn thời gian một bên được giữ quyền. Priority inversion: priority inheritance, để thread giữ lock tạm mang ưu tiên của thread đang chờ nó.",
    tradeoff: "Fair lock chậm hơn rõ rệt dưới tải; jitter làm latency dao động; tách pool hay hàng ưu tiên thêm cấu hình phải chỉnh. Không có lựa chọn nào vừa công bằng tuyệt đối vừa nhanh nhất.",
  },
  table: {
    head: ["Lỗi", "CPU", "Trạng thái thread", "Dấu hiệu", "Cách phá"],
    rows: [
      {
        cells: ["Deadlock", "Thấp", "Ngủ, chờ nhau vòng tròn", "Đứng im mãi; thread dump thấy chu trình chờ lock", "Lock ordering, timeout (bài `concurrency`)"],
        why: "Deadlock cần đủ bốn điều kiện Coffman; phá một là hết. So sánh ở đây để thấy livelock thường là **hậu quả của cách chữa deadlock** bằng thử lại.",
      },
      {
        cells: ["Livelock", "Cao", "Đang chạy, liên tục đổi trạng thái để phản ứng với nhau", "CPU bận, không việc nào xong; log lặp \"retry\"", "Backoff ngẫu nhiên (jitter), thứ tự cố định, chọn một bên ưu tiên"],
        why: "Hai bên dùng cùng một quy tắc phản ứng và cùng một nhịp thì sẽ va nhau lặp lại mãi. Thêm ngẫu nhiên làm nhịp lệch nhau, nên sớm hay muộn một bên thắng.",
      },
      {
        cells: ["Starvation", "Bình thường", "Một số thread chờ rất lâu, số còn lại chạy tốt", "Latency p99 hoặc max rất cao trong khi trung bình đẹp", "Fair lock, FIFO queue, aging (chờ lâu thì tăng ưu tiên), tách pool"],
        why: "Hệ thống tổng thể vẫn tiến, nên metric trung bình không báo gì; chỉ phân phối latency (p99, max) hoặc thời gian chờ lock mới lộ ra.",
      },
      {
        cells: ["Priority inversion", "Bình thường", "Thread ưu tiên cao chờ lock do thread ưu tiên thấp giữ; thread trung bình chạy", "Việc quan trọng trễ hạn dù nó có ưu tiên cao nhất", "Priority inheritance, priority ceiling"],
        why: "Ưu tiên chỉ có ý nghĩa với scheduler; lock không biết ai quan trọng. Thread thấp giữ lock mà không được chạy (vì thread trung bình chiếm CPU) thì không bao giờ nhả lock cho thread cao.",
      },
    ],
  },
  points: [
    {
      t: "**Livelock từ tryLock** — thread 1 giữ A thử B, thread 2 giữ B thử A; cả hai thất bại, cùng nhả, cùng lấy lại ngay. Lặp mãi.",
      why: "Mỗi bên \"lịch sự\" nhả lock để tránh deadlock, nhưng vì quy tắc giống nhau và thời điểm giống nhau nên trạng thái lặp lại y hệt. Sửa: ngủ một khoảng ngẫu nhiên trước khi thử lại, hoặc dùng lock ordering để không cần thử lại.",
    },
    {
      t: "**Livelock ở tầng hệ thống** — nhiều client retry cùng một khoảng cố định sau sự cố, cùng đập vào server cùng lúc, cùng lỗi, cùng retry. Hệ vẫn bận mà không phục hồi.",
      why: "Cùng cơ chế với livelock trong code: phản ứng giống nhau theo cùng nhịp. Exponential backoff có jitter làm các client lệch pha nhau; xem retry storm ở bài `resilience`.",
    },
    {
      t: "**Starvation do lock không fair** — lock mặc định cho phép \"chen hàng\": thread vừa tới có thể lấy lock ngay khi nó vừa được nhả, trước cả thread đã chờ lâu. Thread nào kém may mắn có thể chờ rất lâu.",
      why: "Không chen hàng thì phải đánh thức đúng thread chờ lâu nhất và đợi nó được lên CPU, trong khi một thread đang chạy sẵn có thể lấy lock ngay; vì vậy lock không fair cho throughput cao hơn. Go 1.9 ghi trong release notes rằng `sync.Mutex` \"now more fair\" (https://go.dev/doc/go1.9).",
    },
    {
      t: "**Fair lock có giá** — `new ReentrantLock(true)`: khi tranh chấp, lock ưu tiên thread chờ lâu nhất. Javadoc nói chương trình nhiều thread dùng fair lock có thể có throughput tổng thấp hơn, \"thường thấp hơn nhiều\", nhưng phương sai thời gian chờ nhỏ hơn và đảm bảo không bị đói.",
      why: "Trích Javadoc `ReentrantLock`. Hai lưu ý cũng từ đó: fair lock không làm việc **lập lịch thread** công bằng, và `tryLock()` không có timeout bỏ qua fairness, lấy được lock ngay nếu lock đang rảnh dù có người chờ.",
    },
    {
      t: "**Writer bị đói trong read-write lock** — nếu reader mới luôn được vào khi đang có reader khác, reader nối đuôi nhau liên tục khiến writer không bao giờ có được lock độc quyền.",
      why: "Lock đọc cho nhiều reader cùng lúc; writer phải chờ số reader về 0. Reader nối đuôi nhau thì con số đó không bao giờ về 0. Nhiều cài đặt chặn reader mới khi có writer đang chờ, hoặc có chế độ fair; chọn loại lock ở bài `conc-monitor-rwlock` (sắp viết).",
    },
    {
      t: "**Starvation trong thread pool và queue** — việc dài và việc ngắn dùng chung pool: vài báo cáo 10 phút chiếm hết worker, request 50 ms chờ phía sau. Hoặc queue ưu tiên mà việc ưu tiên cao không bao giờ hết, việc thấp không bao giờ chạy.",
      why: "Cùng cơ chế: một nhóm luôn giành được tài nguyên trước. Tách pool theo loại việc (bài `thr-thread-pool`) và **aging**: việc chờ càng lâu càng được nâng ưu tiên, nên cuối cùng nó cũng tới lượt.",
    },
    {
      t: "**Priority inversion và priority inheritance** — thấp (L) giữ lock, cao (H) chờ lock, trung bình (M) không cần lock nhưng ưu tiên hơn L nên chiếm CPU. H thực chất phải chờ M. Priority inheritance: khi H chờ lock của L, L tạm mang ưu tiên của H tới khi nhả lock, M không chen được nữa.",
      why: "Kernel Linux: rt-mutex mở rộng mutex bằng giao thức priority inheritance, chủ lock ưu tiên thấp kế thừa ưu tiên của waiter cao hơn tới khi nhả lock (https://docs.kernel.org/locking/rt-mutex.html). POSIX có `PTHREAD_PRIO_INHERIT` (kế thừa) và `PTHREAD_PRIO_PROTECT` (priority ceiling: giữ lock là được nâng ưu tiên, dù chưa ai chờ) (https://pubs.opengroup.org/onlinepubs/9799919799/functions/pthread_mutexattr_getprotocol.html).",
    },
    {
      t: "**Ví dụ kinh điển: Mars Pathfinder (1997)** — task khí tượng ưu tiên thấp giữ mutex của bus dữ liệu, task quản lý bus ưu tiên cao chờ, task liên lạc ưu tiên trung bình chiếm CPU; watchdog thấy task bus không chạy quá lâu và reset cả hệ thống. Sửa bằng cách bật priority inheritance cho mutex đó.",
      why: "Theo bài tổng hợp của Mike Jones (1997) dựa trên phần trình bày của CTO Wind River tại IEEE Real-Time Systems Symposium; đây là nguồn thứ cấp (https://www.cs.cornell.edu/courses/cs614/1999sp/papers/pathfinder.html). Trong backend thường ít đặt ưu tiên thread, nhưng dạng tương tự vẫn gặp: job nền giữ lock mà request quan trọng cần, trong khi job nền bị throttle CPU.",
    },
  ],
  tips: [
    {
      t: "Khi kể cách sửa deadlock bằng timeout hay `tryLock`, tự nhắc luôn nguy cơ livelock và cách chặn (jitter, lock ordering).",
      why: "Interviewer hay hỏi tiếp \"cách đó có vấn đề gì không?\". Nói trước cho thấy bạn nghĩ tới hệ quả của chính lời giải mình đưa ra.",
    },
    {
      t: "Phân biệt bằng hai câu hỏi: CPU có bận không, và có ai đang tiến triển không. Im và không ai tiến: deadlock. Bận mà không ai tiến: livelock. Đa số tiến, vài thread mãi chờ: starvation.",
      why: "Ba câu hỏi này chẩn đoán được từ metric và thread dump thật, không chỉ thuộc định nghĩa.",
    },
  ],
  related: ["deadlock"],
  cards: [
    ["Livelock khác deadlock thế nào?", "Deadlock: thread ngủ chờ nhau, CPU thấp. Livelock: thread vẫn chạy và đổi trạng thái để phản ứng với nhau, CPU cao, nhưng không ai xong việc."],
    ["Cách phá livelock?", "Phá thế đối xứng: backoff ngẫu nhiên (jitter) trước khi thử lại, thứ tự lấy lock cố định, hoặc chọn một bên được ưu tiên."],
    ["Starvation là gì, nhìn thấy ở metric nào?", "Một số thread/việc mãi không tới lượt trong khi hệ thống vẫn chạy; lộ ra ở latency p99/max hoặc thời gian chờ lock, không ở trung bình."],
    ["Fair lock đổi gì lấy gì?", "Đảm bảo thread chờ lâu nhất được trước, không bị đói; đổi lại throughput tổng thấp hơn (Javadoc: thường thấp hơn nhiều)."],
    ["Priority inversion là gì?", "Thread ưu tiên cao chờ lock do thread ưu tiên thấp giữ, trong khi thread ưu tiên trung bình chiếm CPU nên thread thấp không chạy để nhả lock."],
    ["Priority inheritance sửa priority inversion thế nào?", "Thread giữ lock tạm mang ưu tiên của thread cao nhất đang chờ nó, tới khi nhả lock, nên thread trung bình không chen được."],
    ["`threading.Lock` của Python có đảm bảo thứ tự cho các thread chờ không?", "Không. Tài liệu nói thread nào được chạy tiếp là không xác định và có thể khác nhau giữa các cài đặt."],
  ],
});
