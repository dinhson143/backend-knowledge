BK.topic({
  id: "thr-thread-vs-process",
  track: "cs",
  section: "cs-os",
  title: "Thread hay Process?",
  goal: "Chọn thread hay process theo chi phí, bộ nhớ chung và cô lập lỗi",
  needs: ["os-process-lifecycle"],
  tldr: {
    t: "Process có không gian địa chỉ riêng; các thread trong một process **dùng chung** heap, biến global, file descriptor, chỉ riêng stack, thanh ghi và thread ID. Vì dùng chung nên thread tạo nhanh, chuyển đổi rẻ, trao đổi dữ liệu không cần copy, nhưng một thread làm hỏng bộ nhớ hoặc crash thì **cả process** chết. Chọn process khi cần cô lập lỗi hoặc bảo mật; chọn thread khi cần chia sẻ dữ liệu nhiều và chi phí thấp.",
    why: "Mọi khác biệt đều từ một gốc: thread chung một bảng trang (page table). Chung bảng trang thì đọc được dữ liệu của nhau mà không copy và khi chuyển giữa hai thread cùng process không phải đổi bảng trang; nhưng cũng vì chung nên không có ranh giới nào chặn một con trỏ hỏng ghi đè dữ liệu của thread khác (OSTEP, Threads — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf).",
  },
  story: {
    problem: "Web server phục vụ nhiều request cùng lúc. Mỗi request một process thì tốn bộ nhớ, tạo chậm và muốn chia sẻ cache giữa các request phải qua IPC. Mỗi request một thread thì nhẹ, nhưng một request gây segfault (thư viện C lỗi, extension hỏng) kéo sập cả server cùng mọi request khác đang chạy.",
    idea: "Chia theo ranh giới tin cậy: phần cần cô lập (code không tin được, plugin, worker có thể crash) chạy ở process riêng; bên trong mỗi process dùng nhiều thread hoặc event loop để chia sẻ dữ liệu rẻ. Nginx, PostgreSQL, Chrome đều theo kiểu này ở các mức khác nhau.",
    tradeoff: "Process: an toàn nhưng tốn bộ nhớ, giao tiếp chậm (pipe, socket, shared memory). Thread: rẻ nhưng phải tự đồng bộ (lock, race condition) và lỗi một chỗ là lỗi toàn bộ.",
  },
  diagrams: [
    {
      src: "content/svg/thr-thread-vs-process-memory.svg",
      caption: "Hai process mỗi bên một bộ nhớ, trao đổi qua IPC. Các thread trong một process chung code, global, heap, fd, PID; riêng stack, thanh ghi, thread ID, `errno`, signal mask (pthreads(7); OSTEP Threads — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf).",
      source: "https://man7.org/linux/man-pages/man7/pthreads.7.html",
    },
  ],
  table: {
    head: ["Tiêu chí", "Process", "Thread (cùng process)"],
    rows: [
      {
        cells: ["Bộ nhớ", "Không gian địa chỉ riêng; sau `fork` dùng chung trang theo copy-on-write cho tới khi ghi", "Chung heap, global, code; mỗi thread một stack riêng"],
        why: "Theo pthreads(7), thread chung bộ nhớ global, heap, PID, fd, handler signal; riêng stack, thread ID, signal mask, `errno` (https://man7.org/linux/man-pages/man7/pthreads.7.html). Vì stack riêng nên biến cục bộ an toàn; vì heap chung nên mọi object chia sẻ cần đồng bộ.",
      },
      {
        cells: ["Chi phí tạo", "Chép page table, bảng fd, tạo task mới", "Cấp một stack và một task mới, không chép page table"],
        why: "Trên Linux cả hai đều tạo bằng `clone()`; khác nhau ở cờ: thread dùng `CLONE_VM | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD` để dùng chung thay vì chép (clone(2) — https://man7.org/linux/man-pages/man2/clone.2.html). Không phải chép thì nhanh hơn, và process lớn càng thấy rõ vì page table lớn theo bộ nhớ.",
      },
      {
        cells: ["Context switch", "Đổi thanh ghi + đổi bảng trang", "Chỉ đổi thanh ghi và stack"],
        why: "Đổi bảng trang làm các bản dịch địa chỉ đang có trong TLB không còn dùng được cho process mới (trừ khi phần cứng gắn ASID), nên process mới chạy chậm một lúc vì TLB miss (OSTEP, TLBs — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf). Chi tiết ở topic Context switch.",
      },
      {
        cells: ["Giao tiếp", "IPC: pipe, socket, shared memory, file", "Đọc ghi thẳng biến chung (cần lock)"],
        why: "Process không thấy bộ nhớ của nhau nên mọi dữ liệu phải serialize rồi đi qua kernel, tốn copy và syscall. Thread chỉ truyền con trỏ, nhưng đổi lại mọi chỗ chia sẻ đều có thể có race condition.",
      },
      {
        cells: ["Cô lập lỗi", "Một process crash, các process khác vẫn chạy", "Một thread segfault là cả process chết"],
        why: "Handler signal là thuộc tính của **process**, không phải của thread (signal(7) — https://man7.org/linux/man-pages/man7/signal.7.html). `SIGSEGV` có hành động mặc định là kết thúc process và dump core, nên một thread truy cập sai địa chỉ thì mọi thread cùng process mất theo. Kernel cũng nói rõ: truy cập không hợp lệ thì gửi `SIGSEGV`, thường kết thúc thread và process của nó (https://docs.kernel.org/mm/page_tables.html).",
      },
      {
        cells: ["Bảo mật", "Có thể chạy khác user, khác quyền, khác namespace", "Cùng quyền, cùng bộ nhớ"],
        why: "Ranh giới bộ nhớ của process là thứ phần cứng (MMU) cưỡng chế, nên code bị chiếm quyền trong một process không đọc được bộ nhớ process khác. Trình duyệt hiện đại tách trang web vào các process riêng cũng vì lý do này.",
      },
    ],
  },
  points: [
    {
      t: "**Trên Linux, thread cũng là task** — mỗi thread là một thực thể kernel lập lịch riêng (mô hình 1:1 của NPTL), có TID riêng, nhưng các thread cùng thread group nên `getpid()` trả cùng một PID. Xem bằng `ps -eLf` hoặc `ls /proc/<pid>/task/`.",
      why: "Kernel không có khái niệm \"thread\" tách biệt; nó chỉ có task với mức chia sẻ khác nhau, quyết định bởi cờ `clone`. Vì vậy scheduler chia CPU cho từng thread, không phải từng process: một process 8 thread có thể chạy song song trên 8 core (pthreads(7)).",
    },
    {
      t: "**Thread không miễn phí** — mỗi thread cần một stack (với pthread, mặc định lấy theo `RLIMIT_STACK`; nếu limit là unlimited thì 2 MB trên đa số kiến trúc), một task trong kernel, và chịu giới hạn `RLIMIT_NPROC`, `threads-max`, `pid_max`.",
      why: "Stack được dành sẵn trong không gian địa chỉ ảo (RAM thật chỉ cấp khi chạm tới), nhưng nghìn thread vẫn là nghìn task cho scheduler và nghìn lần context switch. Vượt giới hạn thì `pthread_create` trả `EAGAIN` (pthread_create(3) — https://man7.org/linux/man-pages/man3/pthread_create.3.html). Đây là lý do server nhiều kết nối dùng event loop hoặc green thread thay vì một thread mỗi kết nối.",
    },
    {
      t: "**Ví dụ thật: process làm ranh giới, bên trong dùng mô hình nhẹ** — Nginx: một master đọc cấu hình và quản các worker, nhiều worker process (cố định hoặc bằng số core) xử lý request theo mô hình event. PostgreSQL: mỗi kết nối một backend process, phối hợp qua shared memory và semaphore.",
      why: "Ở Nginx, master chỉ lo cấu hình và duy trì worker, còn worker làm việc thật (https://nginx.org/en/docs/beginners_guide.html); vì là process riêng nên master vẫn còn khi một worker gặp sự cố. PostgreSQL dùng mô hình \"process per user\": supervisor (postmaster) sinh một backend process cho mỗi kết nối, các backend phối hợp qua shared memory và semaphore (https://www.postgresql.org/docs/current/connect-estab.html). Cái giá là mỗi kết nối là cả một process, nên app phải dùng connection pool thay vì mở hàng nghìn kết nối.",
    },
    {
      t: "**`fork` một process nhiều thread** — process con chỉ có thread đã gọi `fork`; lock do thread khác giữ lúc fork sẽ bị giữ mãi trong con. Muốn chạy chương trình khác thì `exec` ngay sau `fork`.",
      why: "Bộ nhớ (kể cả trạng thái mutex) được chép nguyên, nhưng thread chủ của lock không tồn tại trong con nên không ai mở lock (fork(2) — https://man7.org/linux/man-pages/man2/fork.2.html). Trộn thread và fork là nguồn deadlock khó tái hiện.",
    },
  ],
  sections: [
    {
      title: "Mỗi ngôn ngữ chọn gì",
      table: {
        head: ["Ngôn ngữ", "Song song CPU bằng", "Ghi chú"],
        rows: [
          {
            cells: ["Python (CPython có GIL)", "Nhiều process: `multiprocessing`, `ProcessPoolExecutor`", "Thread vẫn có ích cho I/O-bound; từ 3.13 có bản build tắt được GIL (free-threading, PEP 703)"],
            why: "GIL chỉ cho một thread chạy bytecode Python tại một thời điểm (GIL luôn được nhả khi làm I/O), nên thread không tăng tốc code CPU-bound viết bằng Python (https://docs.python.org/3/glossary.html#term-global-interpreter-lock); mỗi process có interpreter và GIL riêng nên chạy song song thật, đổi lại dữ liệu truyền qua phải pickle (https://docs.python.org/3/library/multiprocessing.html). Chi tiết ở topic GIL (đợt sau).",
          },
          {
            cells: ["Node.js", "`worker_threads` cho CPU; `cluster` / `child_process` để chạy nhiều process", "Worker có engine JS riêng; chia sẻ bộ nhớ chỉ qua `SharedArrayBuffer` hoặc chuyển quyền sở hữu `ArrayBuffer`"],
            why: "Tài liệu Node nói rõ worker hợp với việc JS nặng CPU, không giúp mấy cho I/O vì I/O bất đồng bộ có sẵn đã hiệu quả hơn (https://nodejs.org/api/worker_threads.html). Mặc định không có biến chung, nên ít race hơn thread kiểu Java.",
          },
          {
            cells: ["Java", "Thread của JVM là OS thread (1:1); thêm virtual thread từ Java 21", "Một process JVM, nhiều thread chung heap"],
            why: "Một thread platform tốn một OS thread và stack riêng (mặc định `-Xss` 1024 KB trên Linux/x64 — https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html), nên server kiểu một thread mỗi request bị giới hạn vài nghìn thread; virtual thread giải bài này (topic Goroutine & virtual thread).",
          },
          {
            cells: ["Go", "Goroutine, runtime tự chia lên các OS thread (tối đa `GOMAXPROCS` thread chạy code Go cùng lúc)", "Goroutine bắt đầu với stack vài KB, tự lớn khi cần"],
            why: "Go multiplex nhiều goroutine lên ít OS thread, nên tạo hàng trăm nghìn goroutine trong một process là bình thường, điều không làm được nếu mỗi goroutine là một thread (Go FAQ — https://go.dev/doc/faq#goroutines).",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Trả lời \"thread khác process thế nào\" bằng một câu gốc rồi mới liệt kê: \"thread chung không gian địa chỉ, process thì không; mọi khác biệt về chi phí, giao tiếp, cô lập lỗi đều suy ra từ đó.\"",
      why: "Interviewer muốn thấy bạn suy luận từ cơ chế. Liệt kê 10 khác biệt rời rạc nghe như học thuộc; một nguyên nhân gốc rồi suy ra từng hệ quả cho thấy bạn hiểu.",
    },
    {
      t: "Câu hỏi bẫy \"một thread crash thì sao?\": nếu là lỗi bộ nhớ (segfault) thì cả process chết; nếu là exception trong ngôn ngữ có runtime (Java, Python) thì thường chỉ thread đó kết thúc, process còn sống.",
      why: "Hai tầng khác nhau: signal là chuyện của kernel và áp lên cả process, còn exception chưa bắt là chuyện của runtime, thường chỉ kết thúc thread đó (trừ Go: `panic` không `recover` trong goroutine nào cũng làm cả chương trình dừng — https://go.dev/ref/spec#Handling_panics). Phân biệt được hai tầng là điểm cộng.",
    },
    "Khi thiết kế, nói rõ ranh giới tin cậy: \"plugin của khách chạy ở process riêng để crash không kéo theo server\", rồi mới bàn bên trong process dùng thread hay async.",
  ],
  cards: [
    ["Thread trong cùng process dùng chung gì, riêng gì?", "Chung: heap, biến global, code, fd, PID, handler signal. Riêng: stack, thanh ghi, thread ID, signal mask, `errno`."],
    ["Trên Linux, tạo thread và tạo process khác nhau ở đâu?", "Cả hai đều qua `clone()`; thread dùng cờ chia sẻ (`CLONE_VM`, `CLONE_FILES`, `CLONE_SIGHAND`, `CLONE_THREAD`), process thì chép (copy-on-write)."],
    ["Vì sao một thread segfault làm chết cả process?", "Handler signal là thuộc tính của process; `SIGSEGV` mặc định kết thúc process. Các thread lại chung bộ nhớ nên không có ranh giới cô lập."],
    ["Vì sao chuyển giữa hai thread cùng process rẻ hơn giữa hai process?", "Không phải đổi bảng trang, nên các bản dịch địa chỉ trong TLB vẫn dùng được; chỉ lưu/nạp thanh ghi và stack."],
    ["Python muốn tận dụng 8 core cho việc nặng CPU thì làm gì?", "Dùng nhiều process (`multiprocessing`, `ProcessPoolExecutor`) vì GIL chặn thread chạy bytecode song song. Thread chỉ có ích cho I/O-bound."],
    ["Vì sao PostgreSQL cần connection pool phía app?", "Mỗi kết nối là một backend process riêng, nặng hơn một thread; mở hàng nghìn kết nối là hàng nghìn process."],
  ],
});
