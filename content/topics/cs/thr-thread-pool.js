BK.topic({
  id: "thr-thread-pool",
  track: "cs",
  section: "cs-os",
  title: "Thread Pool",
  goal: "Chọn kích thước pool, queue và cách từ chối khi đầy",
  needs: ["thr-io-vs-cpu-bound"],
  tldr: {
    t: "**Thread pool** (nhóm thread dựng sẵn) gồm ba phần: một số **worker** thread sống lâu, một **task queue** chứa việc chờ chạy, và một **rejection policy** quyết định làm gì khi cả worker lẫn queue đều đầy. Pool giúp khỏi tạo thread cho mỗi việc và giới hạn số việc chạy cùng lúc. Ba câu phải trả lời khi dựng pool: bao nhiêu worker (theo loại tải), queue dài bao nhiêu (phải có giới hạn), đầy thì từ chối, chạy ở thread gọi, hay bỏ việc.",
    why: "Không giới hạn ở đâu đó thì tải vượt sức sẽ dồn vào bộ nhớ: queue không đáy cứ dài thêm cho tới khi hết RAM, còn latency của mọi việc trong queue tăng theo độ dài queue. Javadoc của `ThreadPoolExecutor` nói queue có giới hạn giúp tránh cạn tài nguyên khi đi cùng `maximumPoolSize` hữu hạn (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html).",
  },
  story: {
    problem: "Service Java dùng `Executors.newFixedThreadPool(20)` để gọi một API chậm. Một hôm API đó chậm từ 100 ms lên 5 giây. 20 worker kẹt hết, request mới vẫn được `submit` vào queue không giới hạn; vài phút sau queue có vài triệu task, heap đầy, service OOM. Mọi endpoint khác, kể cả health check, chết theo.",
    idea: "Giới hạn queue và chọn hành vi khi đầy: báo lỗi ngay (để client retry chỗ khác), hoặc bắt thread gọi tự chạy task để tự nó chậm lại (backpressure). Tách pool riêng cho từng phụ thuộc để một API chậm chỉ làm cạn pool của nó.",
    tradeoff: "Queue ngắn thì từ chối sớm, client phải xử lý lỗi; queue dài thì ít lỗi hơn nhưng latency xấu và che mất sự cố. Nhiều pool riêng thì cô lập lỗi tốt nhưng tổng số thread tăng và mỗi pool phải tự chỉnh.",
  },
  table: {
    head: ["Thành phần", "Chọn thế nào", "Sai thì sao"],
    rows: [
      {
        cells: ["Số worker", "CPU-bound: ≈ số core. I/O-bound: số core × (1 + chờ/tính), cắt theo giới hạn phía sau", "Quá ít: CPU rảnh, việc xếp hàng. Quá nhiều: tốn stack, tốn context switch, dồn tải lên DB"],
        why: "Cách ước lượng ở bài I/O-bound hay CPU-bound. Giới hạn phía sau thường thắng: 200 worker gọi một DB có 50 connection thì 150 worker chỉ đứng chờ connection.",
      },
      {
        cells: ["Task queue", "Có giới hạn; độ dài ≈ số việc chấp nhận chờ trong thời gian latency cho phép", "Không giới hạn: hết RAM, latency tăng không trần, `maximumPoolSize` mất tác dụng"],
        why: "Javadoc: dùng queue không giới hạn (như `LinkedBlockingQueue` không truyền capacity) thì không bao giờ có quá `corePoolSize` thread, và `maximumPoolSize` không có tác dụng. `Executors.newFixedThreadPool` dùng đúng loại queue không giới hạn này (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Executors.html).",
      },
      {
        cells: ["Rejection policy", "Báo lỗi (`AbortPolicy`, mặc định), chạy ở thread gọi (`CallerRunsPolicy`), bỏ việc (`DiscardPolicy`, `DiscardOldestPolicy`)", "Bỏ việc âm thầm thì mất dữ liệu mà không ai biết"],
        why: "Bốn policy có sẵn của `ThreadPoolExecutor`. `CallerRunsPolicy` được Javadoc mô tả là cơ chế phản hồi đơn giản làm chậm tốc độ submit, tức backpressure; `DiscardPolicy` chỉ dành cho trường hợp hiếm không ai cần việc đó hoàn thành.",
      },
    ],
  },
  points: [
    {
      t: "**Thứ tự quyết định của `ThreadPoolExecutor` (Java)** — có ít hơn `corePoolSize` thread: tạo thread mới. Đủ core: **đưa vào queue**. Queue đầy: tạo thêm thread tới `maximumPoolSize`. Vẫn đầy: từ chối.",
      why: "Trích quy tắc trong Javadoc `ThreadPoolExecutor`. Điều hay bị hiểu sai: pool không tăng lên max khi bận, mà chỉ khi **queue đầy**. Với queue không giới hạn, queue không bao giờ đầy nên max vô nghĩa.",
    },
    {
      t: "**Python `ThreadPoolExecutor` không có queue giới hạn** — `submit()` luôn nhận việc (trừ sau `shutdown`), không có tham số độ dài queue hay rejection policy. Muốn backpressure thì tự giới hạn bằng `threading.BoundedSemaphore` quanh `submit`.",
      why: "Tài liệu `concurrent.futures` chỉ nêu các trường hợp từ chối là sau `shutdown()` (`RuntimeError`) và khi `initializer` lỗi (`BrokenThreadPool`); giới hạn duy nhất là `buffersize` của `map()` thêm từ 3.14 (https://docs.python.org/3/library/concurrent.futures.html). Producer nhanh hơn worker thì việc chờ cứ tích trong bộ nhớ.",
    },
    {
      t: "**Deadlock trong pool** — task trong pool chờ kết quả của task khác **cùng pool**; khi mọi worker đều đang chờ như vậy thì không còn worker nào chạy task được chờ.",
      why: "Tài liệu Python có ví dụ đúng trường hợp này: pool một worker, task đang chạy gọi `result()` của task thứ hai, task thứ hai không bao giờ được chạy (https://docs.python.org/3/library/concurrent.futures.html). Với pool N worker, chỉ cần N task cùng chờ là đủ. Cách tránh: không chờ trong pool, hoặc dùng pool riêng cho việc con.",
    },
    {
      t: "**Tách pool theo phụ thuộc (bulkhead)** — mỗi phụ thuộc chậm có pool riêng; API thanh toán chậm chỉ làm cạn pool thanh toán, endpoint khác vẫn chạy.",
      why: "Một pool dùng chung thì phụ thuộc chậm nhất giữ hết worker, vì worker đang chờ nó không làm việc khác được. Tách pool giới hạn số worker mỗi phụ thuộc chiếm được; kết hợp timeout và circuit breaker ở bài `resilience`.",
    },
    {
      t: "**Exception bị nuốt** — exception trong task được giữ trong `Future`; không ai gọi `result()` thì không ai thấy lỗi.",
      why: "Tài liệu `concurrent.futures`: nếu lời gọi ném exception thì `result()` ném lại exception đó, và `add_done_callback` gọi callback cả khi future bị huỷ lẫn khi chạy xong (https://docs.python.org/3/library/concurrent.futures.html). Kiểu `pool.submit(job)` rồi bỏ quên future làm lỗi biến mất. Luôn gom future lại và đọc kết quả, hoặc gắn `add_done_callback` để log lỗi.",
    },
    {
      t: "**Dừng pool** — `shutdown(wait=True, cancel_futures=False)`: không nhận việc mới; `cancel_futures=True` huỷ các task chưa bắt đầu, task đang chạy vẫn chạy tới hết.",
      why: "Theo tài liệu `concurrent.futures` (tham số `cancel_futures` có từ 3.9). Khi app nhận `SIGTERM`, đây là bước \"drain\" của graceful shutdown: chạy xong việc dở, bỏ việc chưa bắt đầu (bài `os-signals-shutdown`).",
    },
    {
      t: "**Không pool virtual thread** — Java 21+: virtual thread rẻ, mỗi task một cái; muốn giới hạn số việc gọi tới một service thì dùng semaphore, không dùng pool cỡ cố định.",
      why: "JEP 444 viết rõ không nên pool virtual thread để giới hạn concurrency mà dùng cấu trúc làm riêng cho việc đó như semaphore (https://openjdk.org/jeps/444). Pool tồn tại vì platform thread đắt; khi thread rẻ thì lý do đó mất, chỉ còn nhu cầu giới hạn.",
    },
  ],
  sections: [
    {
      title: "Python: pool có backpressure",
      table: {
        head: ["Code", "Làm gì", "Vì sao"],
        rows: [
          {
            cells: ["`pool = ThreadPoolExecutor(max_workers=20)`", "20 worker cho việc gọi API", "Cỡ theo giới hạn của API phía sau, không theo số core"],
            why: "Việc I/O-bound: số worker quyết định số lời gọi đồng thời tới API. Để mặc định thì số worker phụ thuộc số CPU của máy, không liên quan gì tới sức chịu của API.",
          },
          {
            cells: ["`slots = threading.BoundedSemaphore(100)`", "Cho tối đa 100 việc trong pool (20 chạy + 80 chờ)", "Thay cho queue giới hạn mà Python không có"],
            why: "Semaphore đếm số việc đã nhận mà chưa xong. `BoundedSemaphore` ném `ValueError` nếu giá trị vượt giá trị ban đầu, tức `release()` nhiều hơn `acquire()`; bắt được bug release hai lần (https://docs.python.org/3/library/threading.html).",
          },
          {
            cells: ["`if not slots.acquire(timeout=0.5): raise Overloaded()`", "Đầy quá 0,5 giây thì từ chối", "Tương đương `AbortPolicy`: báo lỗi sớm thay vì để client chờ mãi"],
            why: "Bỏ `timeout` thì thread gọi đứng chờ tới khi có chỗ, tương đương `CallerRunsPolicy` về tác dụng: producer tự chậm lại. Chọn cách nào tuỳ việc client có retry được hay không.",
          },
          {
            cells: ["`fut = pool.submit(job); fut.add_done_callback(lambda f: slots.release())`", "Trả chỗ khi việc xong, kể cả khi lỗi", "Callback chạy cả khi task ném exception"],
            why: "Release trong callback chứ không trong task, để task bị huỷ trước khi chạy vẫn trả chỗ. Quên release thì sau 100 việc pool coi như đầy vĩnh viễn.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Được hỏi \"thread pool của bạn cỡ bao nhiêu?\" thì nói cả ba con số: số worker, độ dài queue, và hành vi khi đầy, kèm lý do từ loại tải và giới hạn phía sau.",
      why: "Ứng viên trung bình chỉ nói số worker. Queue và rejection mới quyết định hệ thống chết từ từ (OOM) hay suy giảm có kiểm soát (từ chối một phần request).",
    },
    {
      t: "Nhắc `newFixedThreadPool` dùng queue không giới hạn khi nói về sự cố OOM hoặc latency tăng dần.",
      why: "Đây là nguyên nhân rất hay gặp và kiểm chứng được ngay trong Javadoc; cho thấy bạn đọc tài liệu chứ không chỉ dùng API mặc định.",
    },
  ],
  cards: [
    ["Ba thành phần của thread pool?", "Worker thread, task queue, rejection policy (hành vi khi cả worker và queue đều đầy)."],
    ["`ThreadPoolExecutor` của Java tạo thêm thread vượt `corePoolSize` khi nào?", "Chỉ khi queue đầy. Với queue không giới hạn thì không bao giờ vượt `corePoolSize`, `maximumPoolSize` vô tác dụng."],
    ["Bốn rejection policy có sẵn của Java?", "`AbortPolicy` (ném `RejectedExecutionException`, mặc định), `CallerRunsPolicy` (thread gọi tự chạy, làm chậm producer), `DiscardPolicy` (bỏ việc mới), `DiscardOldestPolicy` (bỏ việc cũ nhất trong queue rồi thử lại)."],
    ["Python `ThreadPoolExecutor` giới hạn queue bằng cách nào?", "Không có tham số; tự giới hạn bằng `BoundedSemaphore`: acquire trước `submit`, release trong `add_done_callback`."],
    ["Deadlock trong thread pool xảy ra thế nào?", "Mọi worker đều đang chờ kết quả của task khác trong cùng pool, nên task được chờ không có worker nào chạy."],
    ["Vì sao không pool virtual thread?", "Virtual thread rẻ, mỗi task một cái; JEP 444 khuyên giới hạn concurrency bằng semaphore thay vì pool."],
  ],
});
