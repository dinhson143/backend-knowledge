BK.topic({
  id: "io-blocking-models",
  track: "cs",
  section: "cs-os",
  title: "Blocking, Non-blocking, Async I/O",
  goal: "Phân biệt 4 mô hình I/O và vì sao event loop cần multiplexing",
  tldr: {
    t: "Một lần đọc socket có hai pha: **chờ dữ liệu tới** và **chép dữ liệu** từ kernel sang bộ nhớ của app. Bốn mô hình khác nhau ở chỗ ai chờ pha nào: **blocking I/O** (thread ngủ suốt cả hai pha), **non-blocking I/O** (chưa có dữ liệu thì trả lỗi `EAGAIN` ngay, app tự hỏi lại), **I/O multiplexing** (một lời gọi `select`/`poll`/`epoll` chờ **nhiều** fd, báo fd nào sẵn sàng, app tự `read`), **async I/O** (app nộp yêu cầu, kernel làm cả hai pha rồi báo **đã xong**). Event loop của asyncio, Node, Nginx dùng multiplexing: một thread chờ hàng nghìn socket mà không thread nào ngủ trên một socket riêng.",
    why: "Blocking I/O tốn một thread cho mỗi kết nối đang chờ; non-blocking thuần thì tốn CPU để hỏi lại liên tục. Multiplexing giải cả hai: kernel giữ danh sách fd cần theo dõi và chỉ đánh thức thread khi có fd sẵn sàng. epoll(7) mô tả nó \"scale tốt tới số lượng lớn fd được theo dõi\" (https://man7.org/linux/man-pages/man7/epoll.7.html).",
  },
  story: {
    problem: "Chat server một thread mỗi kết nối: 50.000 user online, phần lớn không gõ gì, nhưng mỗi user giữ một thread ngủ trên `recv()`. 50.000 stack và scheduler kernel quá tải, trong khi CPU gần như không làm gì có ích.",
    idea: "Đặt mọi socket ở chế độ non-blocking và đưa vào một epoll instance. Một thread gọi `epoll_wait`, nhận về danh sách socket có dữ liệu, đọc từng cái (chắc chắn không chặn), xử lý xong lại quay về chờ. Đó chính là event loop.",
    tradeoff: "Code phải chia thành callback hoặc coroutine, và không được có lời gọi chặn nào trong loop. Đọc file thường không hưởng lợi: `O_NONBLOCK` không có tác dụng với file thường, nên vẫn phải đẩy sang thread pool hoặc dùng async I/O thật như io_uring.",
  },
  table: {
    head: ["Mô hình", "Pha chờ dữ liệu", "Pha chép dữ liệu", "Ví dụ"],
    rows: [
      {
        cells: ["Blocking I/O", "Thread ngủ trong `read()`", "Thread ngủ tới khi chép xong", "`sock.recv()` mặc định; một thread mỗi kết nối"],
        why: "Mặc định mọi fd là blocking. Đơn giản nhất để viết, nhưng mỗi kết nối đang chờ giữ một thread; nghìn kết nối là nghìn thread (bài `os-context-switch`).",
      },
      {
        cells: ["Non-blocking I/O", "`read()` trả `EAGAIN`/`EWOULDBLOCK` ngay nếu chưa có gì; app tự hỏi lại", "Khi có dữ liệu, `read()` chép rồi trả về (vẫn đồng bộ)", "`sock.setblocking(False)` → `BlockingIOError`"],
        why: "read(2): fd được đánh dấu `O_NONBLOCK` mà thao tác sẽ chặn thì trả `EAGAIN` hoặc `EWOULDBLOCK` (https://man7.org/linux/man-pages/man2/read.2.html). Python đổi các errno này thành `BlockingIOError` (https://docs.python.org/3/library/exceptions.html). Dùng một mình thì phải hỏi vòng liên tục, đốt CPU.",
      },
      {
        cells: ["I/O multiplexing", "Một lời gọi `select`/`poll`/`epoll_wait` chờ **nhiều** fd; kernel báo fd nào **sẵn sàng**", "App tự gọi `read()` trên fd sẵn sàng (đồng bộ, không chặn)", "`selectors.DefaultSelector`, asyncio trên Unix, Nginx, Node"],
        why: "Đây là mô hình **readiness**: kernel chỉ nói \"đọc bây giờ sẽ không chặn\". open(2) ghi rõ `select`, `poll`, `epoll` chỉ báo fd có \"ready\" hay không, nghĩa là một thao tác I/O với fd blocking sẽ không chặn (https://man7.org/linux/man-pages/man2/open.2.html).",
      },
      {
        cells: ["Async I/O", "Kernel chờ thay app", "Kernel chép xong rồi báo **hoàn tất**", "io_uring (Linux), IOCP (Windows, asyncio `ProactorEventLoop`)"],
        why: "Đây là mô hình **completion**: app nộp yêu cầu kèm buffer và nhận kết quả khi xong. io_uring dùng hai ring buffer chung giữa app và kernel: submission queue (SQ) và completion queue (CQ) (https://man7.org/linux/man-pages/man7/io_uring.7.html).",
      },
    ],
  },
  points: [
    {
      t: "**Blocking/non-blocking khác synchronous/asynchronous** — blocking hay không nói về việc lời gọi có **đợi** hay trả về ngay; sync hay async nói về việc **ai làm pha chép** và báo khi nào. Non-blocking và multiplexing vẫn là I/O **đồng bộ**: `read()` do app gọi và chép dữ liệu ngay trong lời gọi đó.",
      why: "Hai cặp từ hay bị dùng lẫn. Chỉ async I/O (io_uring, IOCP, POSIX AIO) để kernel tự làm xong mọi thứ và báo kết quả; mọi mô hình còn lại app vẫn phải tự gọi `read()` sau khi được báo.",
    },
    {
      t: "**select có trần 1.024 fd** — `select()` chỉ theo dõi được fd có số nhỏ hơn `FD_SETSIZE` (1024), và man page nói giới hạn này sẽ không đổi; app hiện đại nên dùng `poll` hoặc `epoll`.",
      why: "Trích select(2) (https://man7.org/linux/man-pages/man2/select.2.html). Ngoài trần đó, `select` và `poll` nhận lại toàn bộ danh sách fd ở mỗi lần gọi; epoll giữ \"interest list\" trong kernel và trả về \"ready list\", nên mỗi lần chờ không phải gửi lại cả danh sách, và chỉ nhận về các fd đã sẵn sàng. Chi tiết epoll, kqueue, level- vs edge-triggered ở bài `io-epoll-kqueue` (sắp viết).",
    },
    {
      t: "**Multiplexing đi với non-blocking** — fd đưa vào epoll vẫn nên đặt `O_NONBLOCK`, để một lần `read()` lỡ gặp \"chưa có dữ liệu\" thì trả `EAGAIN` thay vì chặn cả event loop.",
      why: "Báo sẵn sàng không phải lời hứa tuyệt đối: dữ liệu có thể bị thread khác đọc mất, hoặc ở chế độ edge-triggered app phải đọc tới khi gặp `EAGAIN` mới biết đã hết. epoll(7) khuyên dùng edge-triggered với fd non-blocking và chỉ chờ lại sau khi `read`/`write` trả `EAGAIN`.",
    },
    {
      t: "**File thường không non-blocking được** — `O_NONBLOCK` không có tác dụng với file thường và block device: đọc đĩa vẫn chặn (ngắn) khi cần truy cập thiết bị.",
      why: "Trích open(2). Vì vậy event loop không \"chờ\" file như chờ socket: file luôn được báo sẵn sàng, nhưng `read()` vẫn có thể chặn khi dữ liệu chưa có trong page cache. Event loop thường đẩy việc đọc file sang thread pool (`asyncio.to_thread`), hoặc dùng async I/O thật.",
    },
    {
      t: "**POSIX AIO trên Linux là thread của glibc** — `aio_read()` có trong chuẩn POSIX, nhưng bản trên Linux do glibc cài bằng thread trong user space, tốn và khó scale. io_uring là async I/O thật của kernel Linux.",
      why: "aio(7): bản POSIX AIO hiện tại của Linux nằm trong user space (glibc), giữ nhiều thread để làm I/O là tốn kém và scale kém (https://man7.org/linux/man-pages/man7/aio.7.html). Đây là lý do async I/O \"trên giấy\" của Linux ít được dùng trước khi có io_uring.",
    },
    {
      t: "**Python có cả hai kiểu trong asyncio** — trên Unix, `asyncio.EventLoop` là `SelectorEventLoop` (readiness, dùng module `selectors`); trên Windows là `ProactorEventLoop` dùng IOCP (completion).",
      why: "Tài liệu asyncio (https://docs.python.org/3/library/asyncio-eventloop.html). Code `await reader.read()` giống nhau, nhưng bên dưới là hai mô hình khác nhau: vì OS khác nhau đưa ra API khác nhau. `selectors.DefaultSelector` tự chọn cài đặt hiệu quả nhất của nền tảng (https://docs.python.org/3/library/selectors.html).",
    },
    {
      t: "**Signal-driven I/O (mô hình thứ năm, hiếm dùng)** — kernel gửi `SIGIO` khi fd sẵn sàng. Ít gặp trong server vì xử lý signal khó và không cho biết nhiều fd cùng lúc.",
      why: "Nhắc tới để đủ danh sách cổ điển; trong phỏng vấn backend, bốn mô hình trên là đủ. Lý do signal khó dùng đúng ở bài `os-signals-shutdown`.",
    },
  ],
  sections: [
    {
      title: "Một event loop tối giản bằng `selectors` (Python)",
      table: {
        head: ["Code", "Làm gì", "Vì sao"],
        rows: [
          {
            cells: ["`sel = selectors.DefaultSelector()`", "Tạo selector; trên Linux thường là epoll", "Dùng cài đặt hiệu quả nhất của nền tảng thay vì gọi thẳng `select`"],
            why: "Module `selectors` bọc `select`, `poll`, `epoll`, `kqueue` sau cùng một API; tài liệu khuyên dùng nó trừ khi cần điều khiển chính xác primitive bên dưới.",
          },
          {
            cells: ["`conn.setblocking(False)`", "Đặt socket non-blocking", "Lần `recv` lỡ chưa có dữ liệu sẽ ném `BlockingIOError` thay vì chặn loop"],
            why: "Một socket blocking lọt vào loop là đủ để mọi kết nối khác đứng chờ nó.",
          },
          {
            cells: ["`sel.register(conn, selectors.EVENT_READ, handle)`", "Đăng ký theo dõi: có dữ liệu thì gọi `handle`", "Thêm fd vào interest list trong kernel một lần, không phải gửi lại mỗi vòng"],
            why: "Với epoll, `register` tương ứng `epoll_ctl(ADD)`; danh sách nằm trong kernel nên vòng chờ không tốn thêm theo số kết nối.",
          },
          {
            cells: ["`for key, _ in sel.select(): key.data(key.fileobj)`", "Chờ tới khi có fd sẵn sàng, rồi gọi handler của từng fd", "Một thread phục vụ mọi kết nối; chỉ thức dậy khi có việc"],
            why: "Đây là toàn bộ ý tưởng của event loop. Handler phải ngắn và không chặn; việc nặng đưa sang thread/process pool, nếu không mọi kết nối khác phải chờ.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Trả lời \"blocking khác async thế nào?\" bằng hai pha (chờ dữ liệu, chép dữ liệu) và chỉ ra mô hình nào ai chờ pha nào. Kết bằng readiness (epoll) vs completion (io_uring, IOCP).",
      why: "Cách trình bày này phân biệt được non-blocking với async, chỗ ứng viên hay nhầm; và giải thích luôn vì sao Node/asyncio trên Linux gọi là async dù bên dưới là epoll.",
    },
    {
      t: "Khi nói event loop, nhắc luôn giới hạn: lời gọi blocking và việc CPU-bound chặn cả loop, đọc file không được epoll giúp.",
      why: "Interviewer hay hỏi tiếp \"vậy app Node đọc file thế nào?\"; câu trả lời là thread pool hoặc io_uring, vì `O_NONBLOCK` không áp dụng cho file thường.",
    },
  ],
  cards: [
    ["Hai pha của một lần đọc socket?", "Chờ dữ liệu tới (ở kernel), rồi chép dữ liệu từ kernel sang buffer của app."],
    ["Non-blocking I/O khác async I/O ở đâu?", "Non-blocking: chưa có dữ liệu thì trả `EAGAIN`, có thì app tự `read()` và chép (đồng bộ). Async: kernel làm cả hai pha và báo khi đã xong."],
    ["Readiness và completion khác nhau thế nào?", "Readiness (select/poll/epoll): kernel báo fd đọc được mà không chặn, app tự đọc. Completion (io_uring, IOCP): kernel báo thao tác đã hoàn tất, dữ liệu đã nằm trong buffer."],
    ["Vì sao `select` không dùng cho server lớn?", "Chỉ theo dõi fd < `FD_SETSIZE` (1024) và phải gửi lại toàn bộ danh sách mỗi lần gọi; epoll giữ danh sách trong kernel."],
    ["`O_NONBLOCK` có tác dụng với file thường không?", "Không. open(2): đọc file thường và block device vẫn chặn khi cần truy cập thiết bị, nên event loop đẩy đọc file sang thread pool hoặc io_uring."],
    ["asyncio dùng mô hình nào?", "Unix: `SelectorEventLoop` (readiness qua `selectors`, epoll/kqueue). Windows: `ProactorEventLoop` dùng IOCP (completion)."],
  ],
});
