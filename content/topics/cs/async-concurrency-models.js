BK.topic({
  id: "async-concurrency-models",
  track: "cs",
  section: "cs-async",
  title: "Thread, Event Loop, Coroutine, Actor",
  goal: "So sánh 4 mô hình concurrency cho server nhiều kết nối",
  needs: ["thr-thread-vs-process", "io-blocking-models"],
  tldr: {
    t: "Server phục vụ 10.000 kết nối phần lớn thời gian chỉ **chờ** (chờ DB, chờ client gửi tiếp). Bốn mô hình khác nhau ở chỗ **ai giữ trạng thái của việc đang chờ**: **thread-per-request** để một OS thread đứng chờ; **event loop** để một thread nhận tin \"socket sẵn sàng\" rồi gọi callback; **coroutine** (async/await, goroutine, virtual thread) để runtime cất trạng thái hàm và đổi sang hàm khác trong user space; **actor** để mỗi actor xử lý tin nhắn trong hàng đợi riêng, không chia sẻ bộ nhớ. **Async Programming** (lập trình bất đồng bộ) là viết code theo hai mô hình giữa: không chặn thread khi chờ I/O.",
    why: "OS thread đắt vì mỗi cái có stack riêng và mỗi lần chờ là một context switch của kernel; khi việc chủ yếu là chờ I/O thì phần lớn thread chỉ nằm ngủ. Ba mô hình còn lại tách \"việc đang chờ\" khỏi \"OS thread\" để một số ít thread phục vụ rất nhiều việc. Java nói thẳng virtual thread \"không chạy code nhanh hơn\", chúng cho **scale** (throughput cao hơn) chứ không cho **speed** (latency thấp hơn) (https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html).",
  },
  story: {
    problem: "Một API gọi sang 3 service khác, mỗi lời gọi chờ 100 ms. Viết theo thread-per-request với pool 200 thread: tới request thứ 201 đồng thời thì request mới phải xếp hàng, dù CPU gần như rảnh. Tăng pool lên 5.000 thread thì tốn bộ nhớ stack và kernel bận context switch.",
    idea: "Đừng để \"đang chờ\" chiếm một OS thread. Event loop dùng `epoll`/`kqueue` để một thread theo dõi hàng nghìn socket; coroutine cho bạn viết code tuần tự (`await`) mà runtime vẫn nhả thread khi chờ; actor bỏ hẳn bộ nhớ chung, chỉ gửi tin nhắn.",
    tradeoff: "Event loop và coroutine chỉ đổi việc ở điểm chờ: một đoạn CPU nặng chặn mọi việc khác trên cùng thread. async/await \"lây\" lên cả call stack. Actor tránh lock nhưng phải thiết kế giao thức tin nhắn và xử lý hàng đợi đầy. Thread-per-request vẫn đơn giản nhất khi số kết nối đồng thời nhỏ.",
  },
  table: {
    head: ["Mô hình", "Việc đang chờ nằm ở đâu", "Ví dụ", "Điểm mạnh", "Điểm yếu"],
    rows: [
      {
        cells: ["Thread-per-request", "Một OS thread bị kernel cho ngủ", "Servlet cổ điển, Flask/Django sync + WSGI server nhiều thread", "Code tuần tự, debug dễ, CPU-bound chạy song song thật trên nhiều core", "Mỗi việc chờ chiếm một thread: stack + context switch; số thread giới hạn số kết nối đồng thời"],
        why: "Thread bị chặn trong syscall `read()` vẫn giữ nguyên stack và một chỗ trong scheduler của kernel. Khi thread chạy trở lại, kernel phải context switch (xem `os-context-switch`). Không có cách nào \"chờ\" rẻ hơn một thread trong mô hình này.",
      },
      {
        cells: ["Event loop + callback", "Một callback đăng ký sẵn; dữ liệu nằm trong closure", "Node.js, Nginx, Redis, Python `asyncio` ở tầng thấp", "Một thread phục vụ rất nhiều kết nối; không có race bên trong một callback (chỉ một cái chạy tại một thời điểm)", "Callback lồng nhau khó đọc; một callback chậm chặn tất cả"],
        why: "Event loop gom mọi socket vào một lần chờ của kernel: `epoll` \"theo dõi nhiều file descriptor để xem cái nào làm I/O được\" và \"scale tốt với số lượng lớn\" (epoll(7) — https://man7.org/linux/man-pages/man7/epoll.7.html). Node.js dùng một thread JavaScript và đẩy I/O xuống kernel khi có thể (https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick).",
      },
      {
        cells: ["Coroutine (async/await, goroutine, virtual thread)", "Frame của hàm được runtime cất lại, chạy tiếp khi I/O xong", "Python `async def`, JS `async function`, Kotlin `suspend`, Go goroutine, Java virtual thread", "Viết như code tuần tự; tạo được rất nhiều", "Chỉ đổi ở điểm chờ; với async/await phải đánh dấu cả chuỗi hàm gọi"],
        why: "Coroutine là \"một phép tính tạm dừng được\" (Kotlin — https://kotlinlang.org/docs/coroutines-basics.html). Python, JS, Kotlin chạy coroutine trên event loop hoặc thread pool; Go và Java giấu luôn chữ `await`: goroutine \"được multiplex lên nhiều OS thread nên khi một cái chặn, ví dụ chờ I/O, các cái khác vẫn chạy\" (Effective Go — https://go.dev/doc/effective_go), virtual thread tự gỡ khỏi carrier thread khi chặn I/O (Oracle docs).",
      },
      {
        cells: ["Actor", "Tin nhắn nằm trong message queue của actor", "Erlang/Elixir process", "Giao tiếp bằng tin nhắn thay vì sửa chung một vùng nhớ, nên ít cần lock", "Phải thiết kế tin nhắn; hàng đợi có thể đầy; gọi kiểu request/response vòng hơn"],
        why: "Trong Erlang mọi giao tiếp giữa các process là gửi tín hiệu bất đồng bộ, và process lấy tin từ message queue của nó bằng `receive` (https://www.erlang.org/doc/system/ref_man_processes.html). Trạng thái của actor chỉ do chính nó sửa khi xử lý tin, nên không có hai việc cùng ghi một biến. Chi tiết ở topic Actor Model (sắp viết).",
      },
    ],
  },
  points: [
    {
      t: "**Concurrency khác parallelism.** Concurrency (đồng thời) là nhiều việc **tiến triển xen kẽ**; parallelism (song song) là nhiều việc **chạy cùng lúc thật** trên nhiều core. Event loop một thread có concurrency nhưng không có parallelism.",
      why: "Event loop chỉ chạy một callback tại một thời điểm; 10.000 request \"cùng chạy\" vì chúng thay nhau dùng thread trong lúc các request khác đang chờ I/O. Nếu việc là CPU-bound thì không có gì để xen kẽ, nên event loop không nhanh hơn một thread thường.",
    },
    {
      t: "**Câu hỏi quyết định: việc của bạn chờ hay tính?** I/O-bound (gọi DB, HTTP, đọc socket) → event loop/coroutine cho phép rất nhiều việc trên ít thread. CPU-bound (nén ảnh, hash mật khẩu) → cần nhiều core: thread pool cỡ số core hoặc nhiều process.",
      why: "Mô hình async tiết kiệm **thời gian chờ**; nó không tạo thêm CPU. Tài liệu asyncio khuyên đưa việc CPU-bound ra process pool vì nó \"sẽ chặn event loop\" (https://docs.python.org/3/library/asyncio-eventloop.html).",
    },
    {
      t: "**Cooperative và preemptive.** Thread của OS bị kernel giành CPU bất cứ lúc nào (preemptive). Callback và coroutine trên event loop chỉ nhường ở điểm `await` hoặc khi callback trả về (cooperative).",
      why: "Cooperative nên không có race giữa hai điểm `await`: code chạy liền một mạch. Đổi lại, nếu một đoạn không bao giờ nhường (vòng lặp CPU dài, hàm blocking) thì mọi việc khác trên event loop phải đợi. Với goroutine và virtual thread, khi một việc chặn ở I/O thì runtime tự chạy việc khác (Go FAQ — https://go.dev/doc/faq#goroutines; Oracle virtual threads), nên không cần viết `await`.",
    },
    {
      t: "**Các mô hình hay trộn với nhau.** Node.js: một event loop + worker pool (thread pool của libuv) cho file system, `dns.lookup`, một số hàm `crypto`, `zlib`. Python: `asyncio` + `asyncio.to_thread`/`run_in_executor` cho code blocking. Server Go: goroutine-per-request trên một số ít OS thread.",
      why: "Không có API async cho mọi thứ: ví dụ asyncio ghi rõ \"không có file I/O bất đồng bộ trong asyncio\", nên đọc file thường phải chạy trong thread pool (https://docs.python.org/3/library/asyncio-eventloop.html). Node.js cũng đưa các API đó sang worker pool vì lý do tương tự (https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).",
    },
    {
      t: "**Bộ nhớ trên mỗi việc đang chờ** là thứ quyết định giới hạn số kết nối: OS thread mang theo một stack cấp sẵn; goroutine có stack bắt đầu nhỏ và lớn dần; coroutine Python/JS chỉ giữ frame của các hàm đang dở.",
      why: "Effective Go: goroutine \"chỉ tốn hơn việc cấp phát stack một chút\", stack \"bắt đầu nhỏ\" và lớn lên khi cần (https://go.dev/doc/effective_go). Kích thước stack mặc định của OS thread tuỳ hệ điều hành và cấu hình; muốn số cụ thể thì xem `ulimit -s` trên máy của bạn.",
    },
  ],
  sections: [
    {
      title: "Chọn mô hình cho một service",
      table: {
        head: ["Tình huống", "Lựa chọn hợp lý", "Lý do"],
        rows: [
          ["API gọi nhiều service/DB, nghìn kết nối đồng thời", "Coroutine (async/await, goroutine, virtual thread)", "Việc chủ yếu là chờ; code vẫn đọc tuần tự"],
          ["Gateway, proxy, WebSocket server giữ nhiều kết nối lâu", "Event loop", "Mỗi kết nối gần như không làm gì; cần chi phí trên mỗi kết nối nhỏ nhất"],
          ["Xử lý ảnh, tính toán nặng", "Thread pool cỡ số core hoặc nhiều process", "Cần parallelism thật; event loop không giúp gì"],
          ["Nhiều thực thể có trạng thái riêng (phòng chat, thiết bị IoT, phiên game)", "Actor", "Mỗi thực thể tự giữ trạng thái và xử lý tin lần lượt, không cần lock"],
          ["Ứng dụng nội bộ ít tải, team quen code sync", "Thread-per-request", "Đơn giản; chi phí thread không đáng kể ở quy mô nhỏ"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi được hỏi \"Node.js single-thread sao chịu được nhiều request?\", trả lời: nó single-thread **cho JavaScript**, nhưng chờ I/O thì nhờ kernel (`epoll`) và worker pool; request nhiều mà mỗi request chủ yếu chờ thì một thread đủ để điều phối.",
      why: "Câu trả lời yếu nói \"vì nó async\". Câu trả lời tốt nói **ai chờ thay** (kernel, worker pool) và **giới hạn** (callback CPU nặng chặn tất cả).",
    },
    {
      t: "So sánh mô hình bằng một câu cho mỗi cái: việc đang chờ được cất ở đâu, và ai quyết định khi nào đổi việc (kernel hay code của bạn).",
      why: "Hai trục này suy ra được gần hết khác biệt còn lại: chi phí bộ nhớ, có race hay không, cái gì chặn cái gì.",
    },
  ],
  related: ["ctx-switch"],
  cards: [
    ["Concurrency và parallelism khác nhau thế nào?", "Concurrency: nhiều việc tiến triển xen kẽ, có thể trên một core. Parallelism: nhiều việc chạy cùng lúc thật trên nhiều core."],
    ["Vì sao thread-per-request khó phục vụ 10.000 kết nối chờ I/O?", "Mỗi kết nối chờ giữ một OS thread: tốn stack và mỗi lần chạy lại là một context switch của kernel; phần lớn thread chỉ ngủ."],
    ["Event loop có làm việc CPU-bound nhanh hơn không?", "Không. Nó chỉ tiết kiệm thời gian chờ; việc CPU-bound chạy trên event loop còn chặn mọi việc khác."],
    ["Cooperative scheduling nghĩa là gì?", "Việc đang chạy tự nhường (ở `await` hoặc khi callback trả về); không ai giành CPU giữa chừng. Đối lập với preemptive của OS thread."],
    ["Actor tránh lock bằng cách nào?", "Giao tiếp bằng tin nhắn bất đồng bộ thay vì sửa chung bộ nhớ; trạng thái của actor chỉ do chính nó sửa khi lấy tin từ message queue."],
    ["Virtual thread của Java làm request nhanh hơn không?", "Không. Theo tài liệu Oracle, chúng cho scale (throughput cao hơn) chứ không cho speed (latency thấp hơn)."],
  ],
});
