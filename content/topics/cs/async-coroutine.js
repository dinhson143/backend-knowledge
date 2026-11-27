BK.topic({
  id: "async-coroutine",
  track: "cs",
  section: "cs-async",
  title: "Coroutine",
  goal: "Giải thích suspend/resume và coroutine khác thread ở đâu",
  needs: ["async-callback-promise-await"],
  tldr: {
    t: "**Coroutine** là hàm **tạm dừng được** giữa chừng (suspend) rồi **chạy tiếp** từ đúng chỗ đó (resume), với biến cục bộ còn nguyên. Hàm thường chạy một mạch từ đầu tới `return`; coroutine có thể dừng ở mỗi `await`, trả quyền cho scheduler (event loop), và được gọi tiếp khi thứ nó chờ đã xong. Khác thread ở hai chỗ: **ai đổi việc** (runtime, chỉ ở điểm `await`; thread thì kernel đổi bất kỳ lúc nào) và **giá đổi việc** (không vào kernel, chỉ cất frame).",
    why: "PEP 492 mô tả `await` \"tạm dừng coroutine cho tới khi awaitable hoàn tất\" (https://peps.python.org/pep-0492/). Trạng thái để chạy tiếp (biến cục bộ, vị trí đang dừng) nằm trong đối tượng coroutine trên heap, nên không cần một stack của OS thread đứng giữ nó. Nếu không có khả năng dừng giữa hàm thì phải cắt hàm thành nhiều callback và tự mang trạng thái qua closure: đúng là callback hell.",
  },
  story: {
    problem: "Bạn cần gọi 10.000 URL. 10.000 thread thì tốn stack và kernel bận context switch; callback thì logic \"thử lại 3 lần, rồi ghi DB\" bị cắt thành năm mảnh khó đọc.",
    idea: "Mỗi URL là một coroutine viết tuần tự: `for i in range(3): try: r = await fetch(url) …`. Ở mỗi `await`, coroutine cất trạng thái và nhả thread; một thread chạy event loop luân phiên cả 10.000 cái.",
    tradeoff: "Coroutine chỉ đổi ở điểm `await`: đoạn không có `await` (vòng lặp CPU, hàm thư viện blocking) giữ thread và chặn mọi coroutine khác. Với async/await, hàm muốn `await` phải là `async`, nên việc này lan lên toàn bộ chuỗi gọi.",
  },
  table: {
    head: ["", "OS thread", "Coroutine (async/await)", "Goroutine / virtual thread"],
    rows: [
      {
        cells: ["Ai quyết định đổi việc", "Kernel, bất kỳ lúc nào (preemptive)", "Code của bạn, ở `await` (cooperative)", "Runtime, khi chặn I/O, lock, channel…"],
        why: "Coroutine trên event loop chỉ nhường khi gặp `await`; giữa hai `await` nó chạy liền. Go runtime tự chuyển goroutine khi một cái chặn trong syscall (Go FAQ — https://go.dev/doc/faq#goroutines); virtual thread của Java tự gỡ khỏi carrier thread khi chặn I/O (https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html).",
      },
      {
        cells: ["Trạng thái khi dừng nằm ở đâu", "Stack riêng của thread (do kernel/libc cấp)", "Đối tượng coroutine/frame trên heap", "Stack nhỏ do runtime quản lý, lớn dần khi cần"],
        why: "Effective Go: goroutine có stack bắt đầu nhỏ và lớn lên bằng cách cấp phát trên heap (https://go.dev/doc/effective_go). Coroutine của Python dùng chung cơ chế với generator: frame của hàm được giữ lại giữa các lần chạy (PEP 492: \"coroutine dựa trên generator ở bên trong\").",
      },
      {
        cells: ["Có chạy song song trên nhiều core", "Có", "Không, nếu cùng một event loop", "Có: runtime phân goroutine/virtual thread lên nhiều OS thread"],
        why: "Một event loop là một thread, nên các coroutine của nó chỉ concurrent, không parallel. Goroutine \"được multiplex lên nhiều OS thread\" (Effective Go) nên tận dụng được nhiều core.",
      },
      {
        cells: ["Chi phí đổi việc", "Context switch của kernel", "Lưu frame, quay về loop; không syscall", "Đổi trong user space; không qua scheduler của kernel"],
        why: "Xem `os-context-switch`: phần đắt của context switch là vào kernel và cache/TLB lạnh. Coroutine bỏ được phần vào kernel.",
      },
    ],
  },
  points: [
    {
      t: "**Suspend/resume cụ thể là gì.** Khi coroutine gặp `await x` mà `x` chưa xong, nó đăng ký \"gọi tôi tiếp khi `x` xong\" rồi trả quyền về event loop. Khi `x` xong, loop đưa coroutine vào hàng đợi sẵn sàng; tới lượt, nó chạy tiếp từ ngay sau `await`, với kết quả của `x`.",
      why: "Không có \"chờ\" nào chiếm thread: thứ duy nhất tồn tại trong lúc chờ là đối tượng coroutine và một mục đăng ký trong loop. Đó là lý do một thread giữ được hàng nghìn coroutine đang chờ.",
    },
    {
      t: "**Gốc gác: generator.** Python có generator (`yield`) từ lâu; PEP 342 cho generator nhận giá trị, PEP 380 thêm `yield from`; PEP 492 (Python 3.5) tách thành cú pháp riêng `async def`/`await` nhưng vẫn dùng chung cơ chế bên dưới.",
      why: "PEP 492: coroutine \"dựa trên generator ở bên trong, nên dùng chung phần hiện thực\", và `await` \"dùng hiện thực của `yield from`\" cộng thêm bước kiểm tra đối số phải là awaitable (https://peps.python.org/pep-0492/). Hiểu generator giúp hiểu vì sao coroutine dừng được: hàm `yield` cũng dừng và chạy tiếp y như vậy.",
    },
    {
      t: "**Stackless và stackful.** Coroutine của Python, JS, Kotlin chỉ dừng được ở `await` **trong chính nó**; hàm thường nó gọi không thể tự dừng giùm. Goroutine và virtual thread có stack riêng nên dừng được ở bất kỳ độ sâu nào của chuỗi gọi.",
      why: "Vì vậy Python cấm `await` ngoài `async def` (PEP 492: dùng `await` ngoài `async def` là `SyntaxError`) và Kotlin chỉ cho gọi hàm `suspend` từ hàm `suspend` khác (https://kotlinlang.org/docs/coroutines-basics.html). Hệ quả là hàm bị chia hai \"màu\": async và không async. Go/Java virtual thread không có chuyện này, đổi lại mỗi việc tốn một stack (dù nhỏ).",
    },
    {
      t: "**Không có race giữa hai `await`, nhưng có race qua `await`.** Trên một event loop, đoạn code giữa hai `await` chạy liền không bị chen. Nhưng `x = await read(); await write(x + 1)` thì coroutine khác có thể đổi dữ liệu trong lúc chờ `read`.",
      why: "Mỗi `await` là một chỗ coroutine khác được chạy. Đọc rồi ghi qua một `await` là mẫu check-then-act kinh điển, cần lock async (`asyncio.Lock`) hoặc thao tác nguyên tử ở phía dữ liệu. Chi tiết ở topic Lock trong code async (sắp viết).",
    },
    {
      t: "**Coroutine nhẹ, nhưng không miễn phí.** Kotlin nói có thể chạy hàng triệu coroutine trong một process mà không cạn tài nguyên; nhưng mỗi coroutine đang chờ vẫn giữ frame và mọi thứ nó tham chiếu (buffer, kết nối).",
      why: "Kotlin docs: coroutine không gắn với một thread cụ thể, dừng trên thread này và chạy tiếp trên thread khác được, nên \"nhẹ hơn thread nhiều\" (https://kotlinlang.org/docs/coroutines-basics.html). Nhẹ không có nghĩa là vô hạn: vẫn phải giới hạn số việc đồng thời (xem Backpressure trong code).",
    },
  ],
  sections: [
    {
      title: "Coroutine trong các ngôn ngữ",
      table: {
        head: ["Ngôn ngữ", "Cú pháp", "Ai chạy coroutine", "Ghi chú"],
        rows: [
          ["Python", "`async def`, `await`", "Event loop của `asyncio` (hoặc trio, uvloop…)", "Gọi hàm chỉ tạo coroutine object; phải `await` hoặc tạo Task mới chạy"],
          ["JavaScript", "`async function`, `await`", "Event loop của trình duyệt / Node.js", "Chạy ngay tới `await` đầu tiên; luôn trả Promise"],
          ["Kotlin", "`suspend fun`, `launch`, `async`", "Dispatcher (thread pool)", "Dừng trên thread này, chạy tiếp trên thread khác được"],
          ["Go", "`go f()`", "Go runtime, nhiều OS thread", "Không có `await`; code blocking bình thường, runtime tự đổi"],
          ["Java 21+", "`Thread.ofVirtual()`, `Executors.newVirtualThreadPerTaskExecutor()`", "JVM, trên carrier thread", "Code blocking bình thường; `synchronized` có thể ghim (pin) virtual thread vào carrier"],
        ],
      },
      points: [
        "Nguồn bảng: MDN async function (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), asyncio (https://docs.python.org/3/library/asyncio-task.html), Kotlin coroutines basics, Go FAQ, Oracle virtual threads (pinning trong `synchronized` và native method).",
      ],
    },
  ],
  tips: [
    {
      t: "Câu \"coroutine khác thread thế nào?\" trả lời theo hai trục: **ai đổi việc** (runtime ở điểm `await` hay kernel bất kỳ lúc nào) và **trạng thái nằm đâu** (frame trên heap hay stack của OS thread). Rồi nêu hệ quả: rẻ hơn, nhưng một đoạn không `await` chặn tất cả.",
      why: "Hai trục này suy ra mọi khác biệt còn lại (chi phí, race, parallelism). Câu trả lời yếu chỉ nói \"coroutine nhẹ hơn\".",
    },
    {
      t: "Nếu được hỏi về goroutine hay virtual thread, nói rõ chúng là coroutine **stackful** do runtime lên lịch: không cần `await`, chạy được trên nhiều core.",
      why: "Cho thấy bạn hiểu vì sao Go không có vấn đề \"hàm hai màu\" như Python/JS, và cái giá là runtime phức tạp hơn.",
    },
  ],
  related: ["ctx-switch"],
  cards: [
    ["Coroutine khác hàm thường ở điểm nào?", "Dừng được giữa chừng (suspend) rồi chạy tiếp từ đúng chỗ đó (resume) với biến cục bộ còn nguyên."],
    ["Khi coroutine `await` một việc chưa xong, thread làm gì?", "Quay về event loop và chạy coroutine/callback khác; coroutine kia chỉ còn là đối tượng chờ được đánh thức."],
    ["Vì sao `await` chỉ được dùng trong `async def`?", "Coroutine của Python là stackless: chỉ chính hàm coroutine mới dừng được; dùng `await` ngoài `async def` là `SyntaxError` (PEP 492)."],
    ["Stackful coroutine là gì? Ví dụ?", "Coroutine có stack riêng, dừng được ở bất kỳ độ sâu nào của chuỗi gọi. Ví dụ goroutine, Java virtual thread."],
    ["Các coroutine trên một event loop có chạy song song trên nhiều core không?", "Không. Chúng concurrent trên một thread; muốn parallel phải nhiều thread/process hoặc runtime như Go."],
    ["Coroutine trên event loop có race condition không?", "Không trong đoạn giữa hai `await`, nhưng có qua `await`: coroutine khác có thể đổi dữ liệu trong lúc chờ."],
  ],
});
