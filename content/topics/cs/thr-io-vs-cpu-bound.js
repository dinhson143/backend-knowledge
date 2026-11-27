BK.topic({
  id: "thr-io-vs-cpu-bound",
  track: "cs",
  section: "cs-os",
  title: "I/O-bound hay CPU-bound?",
  goal: "Chọn thread, process hay async theo loại tải",
  needs: ["thr-thread-vs-process"],
  tldr: {
    t: "**CPU-bound** (việc chủ yếu tính toán: nén, resize ảnh, parse file lớn) chỉ nhanh hơn khi có thêm core, nên số worker ≈ số core. **I/O-bound** (việc chủ yếu chờ network, disk, DB) để CPU rảnh trong lúc chờ, nên nhanh hơn bằng cách chờ nhiều việc cùng lúc: nhiều thread, event loop, hoặc green thread. Trong Python, thread giúp việc I/O-bound nhưng không giúp code Python thuần CPU-bound; việc đó cần process.",
    why: "Thread chỉ có ích khi có CPU rảnh để chạy nó. Việc CPU-bound đã chiếm hết core; JEP 444 viết rằng nếu task tính toán thay vì ngủ thì tăng số thread vượt số core không giúp gì, dù là virtual thread hay platform thread (https://openjdk.org/jeps/444). Với CPython còn thêm GIL: tài liệu `threading` nói chỉ một thread chạy code Python tại một thời điểm, khuyên dùng `multiprocessing` hoặc `ProcessPoolExecutor` để tận dụng nhiều core, và nói `threading` vẫn hợp với nhiều việc I/O-bound (https://docs.python.org/3/library/threading.html).",
  },
  story: {
    problem: "Một API Python gọi 3 service khác, mỗi lời gọi 200 ms, rồi tạo thumbnail cho ảnh upload. Team thêm 32 thread để \"tăng tốc\": phần gọi service nhanh hẳn, nhưng phần thumbnail chậm y như cũ và CPU chỉ lên một core. Chuyển sang 32 process thì RAM tăng gấp nhiều lần mà phần gọi service không nhanh hơn chút nào.",
    idea: "Tách việc theo loại tải trước khi chọn công cụ. Phần chờ I/O dùng thread hoặc async để chờ nhiều lời gọi cùng lúc; phần tính toán đưa sang process pool cỡ số core. Đo trước: thời gian CPU so với thời gian thực cho biết việc đang chờ hay đang tính.",
    tradeoff: "Process tốn RAM và phải serialize dữ liệu qua ranh giới process (pickle trong Python). Async cần thư viện async từ đầu đến cuối, và một đoạn CPU nặng trong event loop chặn mọi request khác. Nhiều thread thì tốn stack và tốn context switch.",
  },
  table: {
    head: ["Loại tải", "Dấu hiệu", "Python", "Java / Go"],
    rows: [
      {
        cells: ["CPU-bound", "CPU của các core đang chạy gần 100%; thời gian CPU ≈ thời gian thực", "`ProcessPoolExecutor` cỡ số core, hoặc thư viện C nhả GIL (NumPy…)", "Thread pool cỡ số core; Go: goroutine, runtime tự giới hạn bằng `GOMAXPROCS`"],
        why: "Mỗi core chỉ chạy một thread tại một thời điểm, nên thread thứ (số core + 1) chỉ chạy được khi giành CPU của thread khác: thêm context switch mà không thêm việc. `ProcessPoolExecutor` dùng `multiprocessing` nên tránh được GIL, đổi lại chỉ gửi được object pickle được (https://docs.python.org/3/library/concurrent.futures.html).",
      },
      {
        cells: ["I/O-bound", "CPU thấp, thời gian thực ≫ thời gian CPU; thread phần lớn ở trạng thái chờ", "`ThreadPoolExecutor`, hoặc `asyncio` khi có rất nhiều kết nối", "Nhiều thread hoặc virtual thread (Java 21+); Go: mỗi việc một goroutine"],
        why: "Trong lúc thread chờ socket, kernel cho thread khác chạy, nên nhiều thread chờ cùng lúc là cách dùng hết khoảng chờ. CPython nhả GIL khi một thread chờ I/O, vì vậy tài liệu `threading` nói thread vẫn hợp với việc I/O-bound.",
      },
      {
        cells: ["Lẫn lộn (gọi API rồi xử lý nặng)", "Có cả hai pha trong một request", "Event loop hoặc thread cho I/O; phần nặng đẩy sang process pool (`loop.run_in_executor`)", "Tách hai pool, mỗi pool cỡ theo loại việc của nó"],
        why: "Dùng một pool cho cả hai thì kích thước nào cũng sai: cỡ số core thì phần I/O xếp hàng chờ, cỡ lớn thì phần CPU tranh nhau core. `run_in_executor` nhận một `Executor` bất kỳ, nên truyền `ProcessPoolExecutor` để chạy phần nặng ngoài event loop (https://docs.python.org/3/library/asyncio-eventloop.html).",
      },
    ],
  },
  points: [
    {
      t: "**Đo trước khi đoán** — so `time.process_time()` (thời gian CPU của process, không tính lúc ngủ) với `time.perf_counter()` (thời gian thực) quanh cùng một đoạn code. CPU ≈ thực: CPU-bound. CPU ≪ thực: đang chờ I/O hoặc chờ lock.",
      why: "`process_time()` là tổng user và system CPU time của process và không tính thời gian ngủ (https://docs.python.org/3/library/time.html). Khoảng chênh với thời gian thực chính là thời gian chờ; nếu không đo thì rất dễ thêm thread cho một việc thực ra đang chờ một lock chung.",
    },
    {
      t: "**Ước lượng số thread cho việc I/O-bound** — nếu mỗi task chờ W ms và tính C ms thì một core bận liên tục khi có khoảng `1 + W/C` task luân phiên; với N core: số thread ≈ `N × (1 + W/C)`. Ví dụ chờ DB 90 ms, tính 10 ms, 8 core: khoảng 80 thread.",
      why: "Trong W ms một task chờ, core rảnh đủ để chạy W/C task khác mỗi task C ms. Đây là phép chia thời gian, không phải định luật; trần thật thường là phía sau: DB chỉ có bấy nhiêu connection, service kia chỉ chịu bấy nhiêu request đồng thời.",
    },
    {
      t: "**Little's Law cho throughput** — số request đang xử lý = throughput × latency. JEP 444 lấy ví dụ: latency 50 ms, muốn 2.000 request/giây thì phải xử lý 100 request cùng lúc. Một thread mỗi request thì cần 100 thread.",
      why: "Ví dụ trong JEP 444 (https://openjdk.org/jeps/444): giữ latency không đổi thì muốn throughput tăng, số việc đồng thời phải tăng theo. Với việc I/O-bound, cái hết trước là số thread (bộ nhớ, context switch), không phải CPU; đó là lý do có async và virtual thread.",
    },
    {
      t: "**Python: GIL** — trên bản CPython mặc định, nhiều thread không chạy code Python cùng lúc. Thread giúp việc I/O-bound; code Python thuần CPU-bound thì dùng process. Thư viện viết bằng C có thể nhả GIL khi tính (tài liệu gọi là \"performance-oriented libraries\").",
      why: "Trích tài liệu `threading` (https://docs.python.org/3/library/threading.html). Từ 3.13 có bản free-threaded tắt được GIL nhưng không phải mặc định. Cơ chế GIL và free-threading là bài riêng `thr-gil` ở nhánh Python.",
    },
    {
      t: "**Mặc định của Python đã nói lên loại tải** — `ThreadPoolExecutor` mặc định `min(32, (os.process_cpu_count() or 1) + 4)` worker; `ProcessPoolExecutor` mặc định `os.process_cpu_count()`.",
      why: "Tài liệu `concurrent.futures` giải thích con số +4 là để giữ ít nhất 5 worker cho việc I/O-bound, còn trần 32 để tránh tự ý dùng quá nhiều tài nguyên trên máy nhiều core (https://docs.python.org/3/library/concurrent.futures.html). Pool process thì cỡ số CPU vì nó dành cho việc tính toán.",
    },
    {
      t: "**Bẫy trong container** — `os.cpu_count()` trả số CPU logic của **hệ thống**; pod giới hạn 2 CPU trên node 64 core vẫn có thể thấy 64. Python 3.13 cho ghi đè bằng `-X cpu_count=n` hoặc biến `PYTHON_CPU_COUNT`. Go từ 1.25 tự đặt `GOMAXPROCS` theo CPU limit của cgroup.",
      why: "Tài liệu `os` nói `cpu_count()` là số CPU logic của hệ thống và `process_cpu_count()` tính theo CPU affinity; tài liệu không nói hàm nào đọc CPU limit của cgroup (https://docs.python.org/3/library/os.html). Pool cỡ 64 trên 2 CPU thật thì việc CPU-bound bị throttle và đổi chỗ liên tục. Go 1.25 ghi rõ runtime xét CPU bandwidth limit của cgroup và không xét CPU request (https://go.dev/doc/go1.25).",
    },
    {
      t: "**Async không làm việc CPU-bound nhanh hơn** — event loop chạy mọi coroutine trên một thread; một coroutine tính 2 giây làm mọi request khác chờ 2 giây. Lời gọi blocking (thư viện không async) đưa ra thread bằng `asyncio.to_thread`, việc tính nặng đưa sang process pool.",
      why: "Coroutine chỉ nhường CPU ở `await`; đoạn tính toán không có `await` giữ thread của event loop tới khi xong. `asyncio.to_thread` chạy hàm trong một thread riêng và trả về coroutine để `await` (https://docs.python.org/3/library/asyncio-task.html); với code Python thuần CPU-bound thì thread vẫn vướng GIL, nên process pool mới thật sự chạy trên core khác.",
    },
  ],
  sections: [
    {
      title: "Chọn công cụ theo tải (Python)",
      table: {
        head: ["Code", "Dùng khi", "Vì sao"],
        rows: [
          {
            cells: ["`with ThreadPoolExecutor(max_workers=50) as ex: list(ex.map(fetch, urls))`", "Gọi 1.000 URL, mỗi lần chờ mạng", "50 lời gọi chờ cùng lúc; CPU gần như không dùng"],
            why: "Thời gian chủ yếu là chờ socket, CPython nhả GIL khi chờ, nên 50 thread chờ song song thật. Cỡ 50 do giới hạn của phía server kia quyết định, không phải số core.",
          },
          {
            cells: ["`with ProcessPoolExecutor() as ex: list(ex.map(resize, paths))`", "Resize 10.000 ảnh bằng code Python", "Mỗi process có interpreter và GIL riêng, chạy trên core riêng"],
            why: "Mặc định số worker bằng `os.process_cpu_count()`. Hàm và tham số phải pickle được: lambda hay hàm lồng trong hàm không gửi được sang process khác.",
          },
          {
            cells: ["`await asyncio.gather(*(client.get(u) for u in urls))`", "Hàng nghìn kết nối đồng thời, thư viện HTTP có bản async", "Một thread giữ mọi kết nối; không tốn một stack mỗi kết nối"],
            why: "Event loop dùng I/O multiplexing (epoll trên Linux) để chờ nhiều socket bằng một lần gọi. Chỉ đúng khi mọi lời gọi trong đường đi đều là async; một lời gọi blocking chặn cả loop.",
          },
          {
            cells: ["`await loop.run_in_executor(proc_pool, render_pdf, data)`", "Trong app async, có một bước tính nặng", "Bước nặng chạy ở process khác, loop vẫn phục vụ request khác"],
            why: "`run_in_executor` trả về future mà loop chờ được; truyền `ProcessPoolExecutor` để tránh GIL, truyền `None` thì dùng thread pool mặc định, chỉ hợp cho lời gọi blocking I/O.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Hỏi \"làm sao cho nhanh hơn?\" thì hỏi lại trước: thời gian đang đi đâu, CPU hay chờ? Rồi mới chọn thread, process hay async.",
      why: "Interviewer muốn thấy bạn chẩn đoán trước khi chữa. Thêm thread cho việc CPU-bound hay thêm core cho việc I/O-bound đều tốn tiền mà không nhanh hơn.",
    },
    {
      t: "Khi tính kích thước pool, nhắc giới hạn phía sau (connection pool DB, rate limit của API) chứ không chỉ số core.",
      why: "Thread nhiều hơn số connection DB thì phần dư chỉ đứng chờ connection; tăng thread lúc đó làm tăng latency chứ không tăng throughput.",
    },
  ],
  cards: [
    ["Phân biệt CPU-bound và I/O-bound bằng phép đo nào?", "So thời gian CPU (`time.process_time()`) với thời gian thực (`time.perf_counter()`): gần bằng nhau là CPU-bound, thời gian thực lớn hơn nhiều là đang chờ I/O hoặc chờ lock."],
    ["Vì sao thêm thread không làm code Python thuần CPU-bound nhanh hơn?", "Trên CPython mặc định, GIL chỉ cho một thread chạy code Python tại một thời điểm; cần process (`ProcessPoolExecutor`) hoặc thư viện C nhả GIL."],
    ["Công thức ước lượng số thread cho việc I/O-bound?", "Số core × (1 + W/C), W là thời gian chờ, C là thời gian tính của mỗi task; sau đó cắt theo giới hạn phía sau (DB, API)."],
    ["Mặc định `max_workers` của `ThreadPoolExecutor` từ Python 3.13?", "`min(32, (os.process_cpu_count() or 1) + 4)`: ít nhất 5 worker cho I/O, tối đa 32."],
    ["Bẫy `os.cpu_count()` trong container là gì?", "Nó trả số CPU logic của hệ thống, không phải CPU limit của pod, nên pool mặc định có thể lớn hơn nhiều so với CPU thật được dùng."],
    ["App async có một bước tính nặng 2 giây — xử lý thế nào?", "Đưa bước đó sang process pool bằng `loop.run_in_executor(proc_pool, fn, ...)`; để nguyên trong coroutine thì cả event loop đứng 2 giây."],
  ],
});
