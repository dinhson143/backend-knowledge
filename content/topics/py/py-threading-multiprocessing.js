// Khối code (D13) đã chạy bằng `python -I` trên CPython 3.14.6 (Windows, start method `spawn`).
// Không chạy được `fork`/`forkserver` trên máy này: hành vi của chúng lấy từ docs, ghi rõ nguồn.
// Ranh giới (D112): chọn thread hay process là bài CS (thr-thread-vs-process, thr-io-vs-cpu-bound);
// pool có giới hạn và deadlock `result()` ở thr-thread-pool; `count += 1` ở conc-race-condition.
BK.topic({
  id: "py-threading-multiprocessing",
  track: "py",
  section: "py-concurrency",
  title: "threading, multiprocessing, futures",
  goal: "Dùng đúng threading, multiprocessing, concurrent.futures và tránh lỗi pickle, fork",
  needs: ["thr-gil", "thr-io-vs-cpu-bound"],
  tldr: {
    t: "Ba module, một quy tắc chọn. **`threading`** cho việc I/O-bound: thread chung bộ nhớ, đồng bộ bằng `Lock`, `Event`, `queue.Queue`. **`multiprocessing`** cho việc CPU-bound: mỗi process có interpreter và GIL riêng, nên tham số và kết quả phải **pickle** qua ranh giới process; cách tạo process (**start method**) là `spawn`, `fork` hoặc `forkserver`, và mặc định đổi theo nền tảng và phiên bản (3.14: `forkserver` trên POSIX trừ macOS). **`concurrent.futures`** bọc cả hai sau cùng một API: `submit()` trả `Future`, `map()`, `as_completed()`.",
    why: "Docs `threading`: do GIL chỉ một thread chạy code Python tại một thời điểm, nên việc nặng CPU nên dùng `multiprocessing` hoặc `ProcessPoolExecutor`, còn thread \"is still an appropriate model\" cho nhiều việc I/O-bound (https://docs.python.org/3/library/threading.html). `ProcessPoolExecutor` \"side-step[s] the GIL but also means that only picklable objects can be executed and returned\" (https://docs.python.org/3/library/concurrent.futures.html).",
  },
  story: {
    problem: "Một job resize 10.000 ảnh chạy bằng `ThreadPoolExecutor` không nhanh hơn chạy tuần tự. Đổi sang `ProcessPoolExecutor` thì nhanh hơn trên laptop dev (macOS), nhưng khi deploy lên Linux với Python cũ hơn, worker thỉnh thoảng treo vĩnh viễn ngay lúc khởi động. Thêm một bản sửa nhanh truyền `lambda` vào pool thì gặp `PicklingError`.",
    idea: "Resize bằng Pillow là CPU-bound nên cần process. Treo trên Linux là do start method `fork` (mặc định trên Linux trước 3.14) sao chép process cha đang có thread giữ lock; chọn `spawn` hoặc `forkserver` tường minh bằng `get_context()`. Hàm gửi sang process phải định nghĩa ở mức module để pickle được; gửi đường dẫn file thay vì bytes ảnh.",
    tradeoff: "Process cô lập lỗi và dùng được mọi core, nhưng khởi động chậm (nhất là `spawn`), mỗi process giữ một bản bộ nhớ riêng, và mọi dữ liệu qua lại tốn chi phí pickle. Thread rẻ và chung bộ nhớ, nhưng không tăng tốc code Python thuần CPU-bound trên bản có GIL và phải tự lo race condition.",
  },
  table: {
    head: ["API", "Dùng khi", "Điều cần biết"],
    rows: [
      {
        cells: ["`threading.Thread` + `queue.Queue`", "Worker sống lâu, pipeline producer–consumer, I/O-bound", "`queue.Queue` đã thread-safe; dừng worker bằng sentinel hoặc `Event`, không dựa vào daemon thread"],
        why: "Daemon thread \"are abruptly stopped at shutdown\", tài nguyên như file, transaction DB có thể không được giải phóng; muốn dừng gọn thì để thread non-daemon và báo dừng bằng `Event` (https://docs.python.org/3/library/threading.html).",
      },
      {
        cells: ["`ThreadPoolExecutor`", "Nhiều lời gọi I/O ngắn: HTTP, DB driver đồng bộ, đọc file", "Mặc định `max_workers = min(32, (os.process_cpu_count() or 1) + 4)` từ 3.13; queue không giới hạn (bài Thread Pool)"],
        why: "Công thức và lịch sử mặc định (×5 số CPU ở 3.5, `cpu_count() + 4` ở 3.8, `process_cpu_count()` ở 3.13) theo docs (https://docs.python.org/3/library/concurrent.futures.html). Máy chạy thử 16 core → 20 worker.",
      },
      {
        cells: ["`ProcessPoolExecutor`", "Việc CPU-bound viết bằng Python: parse, nén, xử lý ảnh", "Mặc định `os.process_cpu_count()` worker (Windows tối đa 61); hàm và tham số phải pickle được; không chạy trong REPL"],
        why: "Docs: \"A function defined in a REPL or a lambda should not be expected to work\", và \"The `__main__` module must be importable by worker subprocesses\" (https://docs.python.org/3/library/concurrent.futures.html).",
      },
      {
        cells: ["`multiprocessing.Process`, `Pool`, `Queue`, `Manager`", "Cần điều khiển chi tiết: process sống lâu, `Pool.imap`, object chia sẻ qua manager", "`multiprocessing.Queue` pickle mọi thứ bỏ vào; proxy của `Manager` chậm vì mỗi thao tác là một lời gọi sang process manager"],
        why: "\"Any object put into a `multiprocessing` queue will be serialized\"; proxy so sánh không theo giá trị và list/dict lồng bên trong không tự đồng bộ (https://docs.python.org/3/library/multiprocessing.html). Docs khuyên tránh chia sẻ trạng thái, dùng queue hoặc pipe.",
      },
      {
        cells: ["`multiprocessing.shared_memory` (3.8+)", "Mảng số lớn (NumPy) dùng chung giữa process, không muốn pickle", "Mỗi process gọi `close()`; đúng một process gọi `unlink()`; không mang theo shape/dtype"],
        why: "`unlink()` \"should be called only once per shared memory block\"; trên Windows nó không có tác dụng vì block tự giải phóng khi mọi handle đóng (https://docs.python.org/3/library/multiprocessing.shared_memory.html). Process gắn vào block phải tự biết shape và dtype để dựng lại mảng.",
      },
      {
        cells: ["`InterpreterPoolExecutor` (3.14)", "CPU-bound, muốn rẻ hơn process nhưng vẫn song song", "Mỗi worker là một subinterpreter có GIL riêng; hàm và tham số vẫn pickle; nhiều extension chưa tương thích"],
        why: "Docs: mỗi interpreter \"has its own Global Interpreter Lock, which means code run with this executor has true multi-core parallelism\"; mutable object không chia sẻ được giữa interpreter (https://docs.python.org/3/library/concurrent.futures.html).",
      },
    ],
  },
  table2Title: "Start method: process con được tạo thế nào",
  table2: {
    head: ["Start method", "Cách tạo", "Mặc định ở đâu", "Rủi ro / giới hạn"],
    rows: [
      {
        cells: ["`spawn`", "Chạy interpreter mới, import lại module chính, nhận hàm và tham số qua pickle", "Windows; macOS (từ 3.8)", "Chậm nhất; bắt buộc `if __name__ == \"__main__\":`; biến global đã sửa ở process cha không sang con"],
        why: "Docs: con \"will only inherit those resources necessary to run the process object's `run()`\" và \"rather slow compared to using fork or forkserver\". Không có guard `__main__`, module chính bị import lại trong con và lại tạo process, nên `start()` ném `RuntimeError` (https://docs.python.org/3/library/multiprocessing.html).",
      },
      {
        cells: ["`fork`", "`os.fork()` sao chép process cha, con có sẵn mọi thứ cha đang có", "Linux và POSIX khác **tới 3.13**; từ 3.14 không còn là mặc định ở đâu", "Không an toàn khi process cha có nhiều thread: từ 3.12 `os.fork()` cảnh báo `DeprecationWarning` khi phát hiện điều đó"],
        why: "Docs: \"safely forking a multithreaded process is problematic\" (https://docs.python.org/3/library/multiprocessing.html). Cơ chế: `fork` chỉ chép thread gọi nó; lock mà thread khác đang giữ lúc fork nằm trong con ở trạng thái đã khoá và không ai mở (bài Process Lifecycle nói về `fork`). Muốn dùng `fork` từ 3.14 phải chọn tường minh qua `get_context(\"fork\")`.",
      },
      {
        cells: ["`forkserver`", "Một server process đơn thread được dựng trước; mỗi lần cần process mới thì server fork ra", "POSIX hỗ trợ truyền fd qua Unix pipe (Linux…) **từ 3.14**", "Như `spawn`: cần pickle và guard `__main__`; từ 3.15.1 tự lùi về `spawn` khi không có thư mục tạm ghi được"],
        why: "Server \"is single threaded… so it is generally safe for it to use `os.fork()`\". 3.14 đổi mặc định \"to retain the performance but avoid common multithreaded process incompatibilities\" (https://docs.python.org/3/library/multiprocessing.html; https://docs.python.org/3/whatsnew/3.14.html).",
      },
    ],
  },
  points: [
    {
      t: "**Chọn start method tường minh** — `ctx = multiprocessing.get_context(\"spawn\")` rồi dùng `ctx.Process`, `ctx.Queue`, hoặc `ProcessPoolExecutor(mp_context=ctx)`. Cách này không đổi trạng thái toàn cục như `set_start_method()` (chỉ gọi được một lần, và phải nằm trong guard `__main__`).",
      why: "What's New 3.14: code cần `fork` phải xin tường minh \"via a context from `get_context()` (preferred)\" (https://docs.python.org/3/whatsnew/3.14.html). Docs `multiprocessing`: `set_start_method()` ném `RuntimeError` nếu đã đặt rồi, và lock tạo từ context `fork` không truyền được sang process tạo bằng `spawn`/`forkserver` (https://docs.python.org/3/library/multiprocessing.html). Code chạy được trên cả macOS, Linux, Windows thì nên viết như thể start method là `spawn`.",
    },
    {
      t: "**Pickle là hợp đồng ngầm** — hàm gửi sang process phải định nghĩa ở mức module; `lambda` và hàm định nghĩa bên trong hàm khác đều hỏng: `ProcessPoolExecutor().submit(lambda x: x, 1).result()` → `PicklingError: Can't pickle <function <lambda> …>`. Tham số lớn bị pickle mỗi lần gửi, nên gửi id hoặc đường dẫn và để worker tự đọc.",
      why: "Pickle chỉ nhận hàm \"accessible from the top level of a module (using `def`, not `lambda`)\"; hàm được pickle \"by fully qualified name, not by value\", và mọi `lambda` cùng tên `<lambda>` nên không tra lại được (https://docs.python.org/3/library/pickle.html). Với `spawn`/`forkserver`, mọi tham số của `Process` cũng phải pickle được (https://docs.python.org/3/library/multiprocessing.html).",
    },
    {
      t: "**Exception đi theo `Future`** — hàm trong pool ném lỗi thì `future.result()` ném lại đúng exception đó ở process gọi (kể cả qua ranh giới process). Không gọi `result()` thì lỗi bị lặng lẽ giữ trong `Future`. `as_completed(fs)` trả future theo thứ tự xong trước, `wait(fs, return_when=FIRST_EXCEPTION)` dừng chờ khi có lỗi đầu tiên.",
      why: "Docs: \"If the call raised an exception, this method will raise the same exception\" (https://docs.python.org/3/library/concurrent.futures.html). Chạy thử: hàm `boom` ném `ValueError(\"bad 3\")` trong `ProcessPoolExecutor`, `result()` ném lại `ValueError: bad 3`.",
    },
    {
      t: "**Dừng pool sớm** — `executor.shutdown(cancel_futures=True)` (3.9+) huỷ các việc chưa bắt đầu; việc đang chạy vẫn chạy xong. `with ProcessPoolExecutor() as ex:` gọi `shutdown(wait=True)` khi ra khỏi khối.",
      why: "Docs: future đang chạy hoặc đã xong \"won't be cancelled, regardless of the value of cancel_futures\" (https://docs.python.org/3/library/concurrent.futures.html). Không có cách an toàn để dừng một thread đang chạy từ bên ngoài; việc dài phải tự kiểm tra một `Event`.",
    },
    {
      t: "**Bẫy deadlock của `multiprocessing.Queue`** — process con `put` một object lớn rồi thoát; process cha `p.join()` trước khi `queue.get()` thì treo: con chờ đẩy hết dữ liệu vào pipe, cha chờ con thoát. Lấy hết dữ liệu khỏi queue trước, rồi mới `join()`.",
      why: "Đây là ví dụ deadlock nguyên văn trong mục Programming guidelines: process đã `put` \"will wait before terminating until all the buffered items are fed by the 'feeder' thread to the underlying pipe\" (https://docs.python.org/3/library/multiprocessing.html).",
    },
    {
      t: "**Đồng bộ thread: chọn primitive nhỏ nhất đủ dùng** — `Lock` (luôn dùng `with lock:`), `RLock` khi cùng thread cần khoá lại, `Event` để báo dừng, `Condition.wait_for(pred)` khi chờ một điều kiện, `BoundedSemaphore(n)` giới hạn số resource. Với dữ liệu riêng từng thread (connection theo thread), dùng `threading.local()`.",
      why: "Docs mô tả `wait()` của `Condition` phải nằm trong vòng `while` vì điều kiện có thể không còn đúng khi được đánh thức, và `wait_for` tự làm vòng đó; với resource có kích thước cố định \"you should use a bounded semaphore\" (https://docs.python.org/3/library/threading.html).",
    },
  ],
  sections: [
    {
      title: "Producer–consumer bằng threading và queue.Queue",
      code: {
        lang: "python",
        lines: [
          "import queue",
          "import threading",
          "",
          ["jobs = queue.Queue(maxsize=100)", "Queue có giới hạn: producer bị chặn khi đầy, tạo backpressure tự nhiên."],
          "results = []",
          "results_lock = threading.Lock()",
          ["STOP = object()", "Sentinel: một object riêng, không thể trùng với dữ liệu thật."],
          "",
          "def worker():",
          "    while True:",
          "        item = jobs.get()",
          "        if item is STOP:",
          "            break",
          ["        with results_lock:", "`list.append` riêng lẻ không hỏng trên CPython, nhưng khoá tường minh vẫn đúng trên bản free-threaded và khi logic dài hơn một lệnh."],
          "            results.append(item * item)",
          "",
          "threads = [threading.Thread(target=worker) for _ in range(4)]",
          "for t in threads:",
          "    t.start()",
          "for n in range(10):",
          "    jobs.put(n)",
          ["for _ in threads:", "Mỗi worker nhận đúng một sentinel rồi thoát; không cần daemon thread."],
          "    jobs.put(STOP)",
          "for t in threads:",
          "    t.join()",
          ["print(sorted(results))", "`[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]`; thứ tự trong `results` tuỳ lịch chạy nên phải sort."],
        ],
      },
    },
    {
      title: "ProcessPoolExecutor với start method tường minh",
      code: {
        lang: "python",
        lines: [
          "import multiprocessing as mp",
          "from concurrent.futures import ProcessPoolExecutor, as_completed",
          "",
          ["def checksum(path):", "Mức module: pickle gửi tên `__main__.checksum` sang process con và con import lại được."],
          "    total = 0",
          "    for ch in path:",
          "        total = (total * 31 + ord(ch)) % 1_000_003",
          "    return path, total",
          "",
          ["if __name__ == \"__main__\":", "Với `spawn`/`forkserver`, process con import lại module này; không có guard thì con cũng tạo pool và lỗi `RuntimeError`."],
          ["    ctx = mp.get_context(\"spawn\")", "Giống nhau trên Windows, macOS, Linux; không đổi trạng thái toàn cục như `set_start_method`."],
          ["    paths = [f\"img_{i}.jpg\" for i in range(8)]", "Gửi đường dẫn (vài byte) thay vì nội dung ảnh: chi phí pickle nhỏ."],
          "    with ProcessPoolExecutor(max_workers=4, mp_context=ctx) as ex:",
          "        futures = [ex.submit(checksum, p) for p in paths]",
          ["        for fut in as_completed(futures):", "Nhận kết quả theo thứ tự xong trước, không theo thứ tự submit."],
          ["            path, value = fut.result()", "Exception trong process con được ném lại ở đây."],
          "            print(path, value)",
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"resize 10.000 ảnh nên dùng thread hay process?\": process (`ProcessPoolExecutor` cỡ số core) vì resize là CPU-bound; gửi đường dẫn chứ không gửi bytes; nếu thư viện ảnh nhả GIL khi xử lý thì thread cũng có thể đủ, nhưng phải đo. Phần tải ảnh từ S3 (I/O-bound) thì dùng thread hoặc asyncio, pool riêng.",
      why: "Câu trả lời tốt tách hai loại tải và nói được chi phí pickle; câu trả lời yếu chỉ nói \"process vì GIL\".",
    },
    {
      t: "Câu \"vì sao `fork` trong process có thread nguy hiểm?\": con chỉ có thread đã gọi `fork`, nhưng nhận nguyên bộ nhớ, gồm cả lock mà thread khác đang giữ; lock đó không bao giờ được mở. Python 3.12 cảnh báo, 3.14 bỏ `fork` khỏi mặc định.",
      why: "Nối kiến thức hệ điều hành (fork chỉ chép thread gọi) với thay đổi phiên bản của Python cho thấy bạn hiểu vì sao mặc định đổi, không chỉ thuộc mặc định mới.",
    },
  ],
  cards: [
    ["Vì sao lambda không gửi được sang `ProcessPoolExecutor`?", "Hàm được pickle theo tên module + tên để process con import lại; lambda không có tên tra được → `PicklingError`."],
    ["Start method mặc định trên Linux, macOS, Windows ở 3.14?", "Linux (POSIX trừ macOS): `forkserver`; macOS: `spawn`; Windows: `spawn`. Trước 3.14 Linux dùng `fork`."],
    ["Vì sao cần `if __name__ == \"__main__\":` với multiprocessing?", "Với `spawn`/`forkserver`, process con import lại module chính; không có guard thì code tạo process chạy lại trong con và ném `RuntimeError`."],
    ["`fork` trong process có nhiều thread gây gì?", "Con chỉ có thread gọi fork; lock thread khác đang giữ bị khoá vĩnh viễn → treo. Từ 3.12 có `DeprecationWarning`."],
    ["`ThreadPoolExecutor` mặc định bao nhiêu worker?", "`min(32, (os.process_cpu_count() or 1) + 4)` từ 3.13."],
    ["Lỗi trong hàm chạy ở pool hiện ra ở đâu?", "Khi gọi `future.result()` (hoặc lấy phần tử từ `map`): exception gốc được ném lại."],
    ["`multiprocessing.Queue` + `join()` treo khi nào?", "Con `put` dữ liệu lớn, cha `join()` trước `get()`: con chờ đẩy hết dữ liệu vào pipe, cha chờ con thoát."],
  ],
  related: ["fork-exec", "deadlock"],
});
