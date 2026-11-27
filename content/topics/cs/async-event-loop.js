BK.topic({
  id: "async-event-loop",
  track: "cs",
  section: "cs-async",
  title: "Event Loop",
  goal: "Giải thích một thread phục vụ nhiều request nhờ event loop",
  needs: ["async-concurrency-models"],
  tldr: {
    t: "**Event loop** (vòng lặp sự kiện) là một vòng `while` chạy trên một thread: (1) hỏi kernel \"socket nào đã sẵn sàng?\" (`epoll`, `kqueue`, IOCP), chờ tối đa tới timer gần nhất; (2) đưa callback/task tương ứng vào hàng đợi sẵn sàng; (3) chạy lần lượt **từng cái một** tới khi nó trả về hoặc gặp `await`; (4) lặp lại. Một thread phục vụ được nhiều request vì mỗi request chỉ chiếm thread trong lúc thật sự tính toán, còn lúc chờ I/O thì nó chỉ là một mục đăng ký trong kernel.",
    why: "Asyncio mô tả đúng như vậy: event loop chạy trong một thread và chạy mọi callback, Task trong thread đó; \"trong lúc một Task đang chạy, không Task nào khác chạy được trên cùng thread\"; khi Task gặp `await` thì nó bị tạm dừng và loop chạy Task kế tiếp (https://docs.python.org/3/library/asyncio-dev.html). Nếu bỏ bước (1) — tức gọi `read()` chặn — thì thread đứng chờ một socket và mọi request khác phải đợi.",
  },
  story: {
    problem: "Bạn viết chat server: mỗi kết nối một thread. 20.000 người online, mỗi người vài phút mới gửi một tin. 20.000 thread gần như luôn ngủ nhưng vẫn giữ stack, và mỗi tin nhắn đến là một lần kernel đánh thức thread.",
    idea: "Đăng ký cả 20.000 socket với một `epoll` instance. Một thread gọi `epoll_wait`, kernel trả về đúng vài socket có dữ liệu; thread đọc, xử lý, ghi, rồi quay lại chờ. Không ai phải ngủ thay ai.",
    tradeoff: "Mọi callback chạy tuần tự trên một thread: một callback mất 200 ms (parse JSON lớn, regex xấu, gọi hàm blocking) làm **mọi** kết nối trễ 200 ms. Event loop đổi \"chi phí trên mỗi kết nối\" lấy \"kỷ luật: không bao giờ chặn\".",
  },
  table: {
    head: ["Bước trong một vòng", "Việc làm", "Nếu thiếu thì hỏng gì"],
    rows: [
      {
        cells: ["Chờ I/O (poll)", "Gọi `epoll_wait`/`kqueue`/`select` với timeout = thời gian tới timer gần nhất", "Phải hỏi từng socket một (busy loop đốt CPU) hoặc chặn trên một socket"],
        why: "`epoll` theo dõi nhiều file descriptor cùng lúc và chỉ trả về những cái sẵn sàng, nên chi phí chờ không tăng theo số kết nối đang im lặng (epoll(7) — https://man7.org/linux/man-pages/man7/epoll.7.html). Timeout tính theo timer gần nhất để `setTimeout`/`asyncio.sleep` không bị trễ.",
      },
      {
        cells: ["Đưa việc vào hàng đợi sẵn sàng", "Socket sẵn sàng → callback/Task đang chờ socket đó được đánh dấu chạy được; timer hết hạn cũng vậy", "Không biết chạy gì tiếp"],
        why: "Event loop không \"gọi\" request; nó chỉ nối sự kiện của kernel với việc đã đăng ký chờ sự kiện đó. Node.js mô tả: khi thao tác hoàn tất, kernel báo lại để callback tương ứng được đưa vào hàng đợi của phase poll (https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick).",
      },
      {
        cells: ["Chạy từng việc", "Gọi callback hoặc chạy coroutine tới `await` kế tiếp; xong mới tới việc khác", "Hai việc chạy chen nhau → cần lock như code multi-thread"],
        why: "Chạy liền một mạch giữa hai điểm nhường nên không có race trong đoạn đó. Đây cũng là lý do một việc chạy lâu chặn cả loop: loop không có cách nào giành lại thread (cooperative).",
      },
    ],
  },
  points: [
    {
      t: "**Readiness, không phải kết quả.** Trên Linux, `epoll` báo \"socket này đọc được rồi\"; event loop tự gọi `read()` không chặn. Mỗi hệ điều hành có cơ chế riêng (epoll trên Linux, kqueue trên macOS/BSD, IOCP trên Windows); thư viện như libuv chọn cơ chế tốt nhất của nền tảng và giấu sau cùng một API (https://docs.libuv.org/en/v1.x/design.html).",
      why: "Vì là readiness nên socket phải ở chế độ non-blocking: lỡ `read()` gặp lúc dữ liệu đã bị lấy hết thì trả `EAGAIN` thay vì chặn cả loop. epoll(7) khuyên dùng fd non-blocking với chế độ edge-triggered và chỉ chờ tiếp sau khi `read`/`write` trả `EAGAIN`.",
    },
    {
      t: "**File trên đĩa thì khác.** Không có cơ chế file I/O bất đồng bộ chung cho mọi nền tảng, nên libuv chạy thao tác file dạng blocking trong thread pool (https://docs.libuv.org/en/v1.x/design.html). Vì vậy Node.js chạy file system API, `dns.lookup()`, một số hàm `crypto` và `zlib` trên **worker pool** (thread pool của libuv); asyncio thì bảo bạn tự dùng `run_in_executor`.",
      why: "Node.js liệt kê các API dùng worker pool (https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop). asyncio ghi \"không có file I/O bất đồng bộ trong asyncio\" và khuyên dùng `loop.run_in_executor()` để đọc ghi file thường (https://docs.python.org/3/library/asyncio-eventloop.html). Vì vậy \"Node.js single-thread\" chỉ đúng với code JavaScript.",
    },
    {
      t: "**Trình duyệt: một task rồi tới microtask.** Theo HTML Living Standard, mỗi vòng lấy **một** task (script, event, callback của `setTimeout`) ra chạy, rồi thực hiện \"microtask checkpoint\": chạy **hết** microtask queue (callback của `Promise.then`, phần sau `await`, `queueMicrotask`), kể cả microtask mới sinh ra trong lúc đó.",
      why: "Thuật toán checkpoint lặp \"trong khi microtask queue của event loop chưa rỗng\" (https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model). Hệ quả: `Promise.resolve().then(f)` luôn chạy trước `setTimeout(g, 0)` đăng ký cùng lúc, và microtask tự đăng ký microtask mãi sẽ làm loop không tới được task kế tiếp (MDN — https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide). Thứ tự chi tiết để topic Microtask & Macrotask.",
    },
    {
      t: "**Node.js: các phase.** Mỗi vòng của libuv đi qua timers → pending callbacks → idle/prepare → **poll** (chờ I/O) → **check** (`setImmediate`) → close callbacks. `process.nextTick` không thuộc phase nào: hàng đợi của nó được xử lý ngay sau thao tác hiện tại.",
      why: "Theo tài liệu Node.js (https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick). Vì có phase riêng nên trong một callback I/O, `setImmediate` luôn chạy trước `setTimeout(…, 0)`; ở module chính thì thứ tự hai cái này không xác định. Gọi `process.nextTick` đệ quy có thể \"bỏ đói\" I/O vì loop không qua được tới phase poll.",
    },
    {
      t: "**Python asyncio: Task là đơn vị.** `asyncio.run(main())` tạo loop, chạy coroutine `main` thành Task; mỗi `await` trên I/O chưa xong trả quyền về loop. Loop dùng module `selectors` (epoll/kqueue tuỳ hệ điều hành) để chờ socket.",
      why: "Một loop gắn với một thread; gọi vào loop từ thread khác phải dùng `loop.call_soon_threadsafe()` hoặc `asyncio.run_coroutine_threadsafe()` vì các đối tượng asyncio không thread-safe (https://docs.python.org/3/library/asyncio-dev.html). API chi tiết (`create_task`, `TaskGroup`…) để nhánh Python.",
    },
    {
      t: "**Đo xem loop có bị chặn không.** asyncio debug mode (`asyncio.run(main(), debug=True)` hoặc `PYTHONASYNCIODEBUG=1`) ghi log các callback chạy lâu hơn `loop.slow_callback_duration`, mặc định 100 ms. Node.js có `perf_hooks.monitorEventLoopDelay()` để đo độ trễ của loop (https://nodejs.org/api/perf_hooks.html).",
      why: "Ngưỡng 100 ms và cách bật debug mode theo tài liệu asyncio (https://docs.python.org/3/library/asyncio-eventloop.html; https://docs.python.org/3/library/asyncio-dev.html). Event loop chậm hiếm khi hiện ra là CPU cao; nó hiện ra là latency p99 tăng cho mọi endpoint cùng lúc, vì mọi request xếp hàng sau đoạn code chặn.",
    },
  ],
  sections: [
    {
      title: "Event loop trong các runtime",
      table: {
        head: ["Runtime", "Cơ chế chờ I/O", "Việc không có readiness đi đâu", "Đơn vị việc"],
        rows: [
          ["Trình duyệt", "Do trình duyệt quản lý", "Web Worker (do bạn tạo)", "Task + microtask"],
          ["Node.js", "libuv: epoll / kqueue / IOCP", "Worker pool của libuv", "Callback theo phase + nextTick + microtask"],
          ["Python asyncio", "`SelectorEventLoop` qua module `selectors`; Windows mặc định `ProactorEventLoop` (IOCP)", "`run_in_executor`, `asyncio.to_thread`", "Task bọc coroutine"],
          ["Go", "Runtime tự chờ I/O, code không thấy event loop", "Goroutine chặn thì runtime chạy goroutine khác trên OS thread khác", "Goroutine"],
        ],
      },
      points: [
        "Nguồn của bảng: Node.js (https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop), asyncio trên các nền tảng (https://docs.python.org/3/library/asyncio-platforms.html), `selectors.DefaultSelector` chọn cơ chế hiệu quả nhất của nền tảng (https://docs.python.org/3/library/selectors.html), Go FAQ (https://go.dev/doc/faq#goroutines).",
      ],
    },
  ],
  tips: [
    {
      t: "Vẽ vòng lặp 4 bước (chờ kernel → đánh dấu sẵn sàng → chạy từng việc → lặp) khi giải thích. Rồi nói ngay giới hạn: một việc chạy lâu chặn cả vòng, nên việc CPU nặng hoặc hàm blocking phải ra thread/process khác.",
      why: "Interviewer muốn nghe cơ chế (ai chờ, ai chạy) và hệ quả. Nói được \"vì sao một `JSON.parse` 50 MB làm mọi request khác trễ\" chứng tỏ bạn hiểu event loop chứ không chỉ thuộc tên.",
    },
    {
      t: "Phân biệt \"non-blocking\" (lời gọi trả về ngay, ví dụ `EAGAIN`) với \"async\" (kết quả đến sau qua callback/await). Event loop dùng I/O non-blocking để cung cấp API async.",
      why: "Hai từ hay bị dùng lẫn. Phân biệt rõ giúp trả lời câu hỏi kiểu \"đọc file trong Node có thật sự non-blocking không?\": API là async, bên dưới là thread của worker pool thực hiện lời gọi blocking.",
    },
  ],
  cards: [
    ["Một vòng của event loop gồm những bước nào?", "Chờ kernel báo I/O sẵn sàng (timeout tới timer gần nhất) → đưa callback/task tương ứng vào hàng đợi → chạy lần lượt từng cái tới khi trả về hoặc gặp `await` → lặp lại."],
    ["Vì sao một callback chậm làm chậm mọi request?", "Event loop chạy một việc tại một thời điểm trên một thread và không thể giành lại thread giữa chừng; mọi việc khác phải đợi nó xong."],
    ["Vì sao Node.js cần worker pool dù có event loop?", "File trên đĩa, `dns.lookup`, một số hàm crypto/zlib không có cơ chế readiness hoặc là việc CPU; chúng chạy trên thread của libuv để không chặn loop."],
    ["`Promise.then` và `setTimeout(…, 0)` cái nào chạy trước?", "`Promise.then`: nó là microtask, được chạy hết ở microtask checkpoint ngay sau task hiện tại; `setTimeout` là một task sau."],
    ["asyncio debug mode cảnh báo callback chậm từ ngưỡng nào?", "`loop.slow_callback_duration`, mặc định 100 ms."],
    ["Gọi vào asyncio loop từ thread khác thế nào?", "`loop.call_soon_threadsafe()` hoặc `asyncio.run_coroutine_threadsafe()`; đối tượng asyncio không thread-safe."],
  ],
});
