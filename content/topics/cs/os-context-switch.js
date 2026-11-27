BK.topic({
  id: "os-context-switch",
  track: "cs",
  section: "cs-os",
  title: "Context Switch",
  goal: "Ước lượng chi phí context switch giữa process, thread, coroutine",
  needs: ["thr-thread-vs-process"],
  tldr: {
    t: "Context switch là lúc kernel dừng task đang chạy trên một CPU, **lưu** thanh ghi, PC, con trỏ stack của nó, rồi **nạp** của task khác. Xảy ra khi task tự nhường (chờ I/O, lock, `sleep`: voluntary) hoặc bị giành CPU (hết time slice, task ưu tiên cao hơn sẵn sàng: involuntary). Chi phí trực tiếp chỉ cỡ dưới micro giây, nhưng chi phí gián tiếp lớn hơn: cache và TLB \"lạnh\" khiến task mới chạy chậm một lúc. Chuyển giữa process đắt hơn giữa thread vì phải đổi bảng trang; chuyển giữa coroutine rẻ nhất vì không vào kernel.",
    why: "Phần cơ học chỉ là lưu vài thanh ghi của task cũ lên kernel stack và nạp của task mới (OSTEP, Limited Direct Execution — https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf). Phần đắt là trạng thái ẩn: task cũ đã nạp dữ liệu của nó vào cache và bản dịch địa chỉ vào TLB; task mới phải nạp lại từ đầu, và nếu đổi process thì TLB phải xoá hoặc phân biệt bằng ASID (OSTEP, TLBs — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf).",
  },
  story: {
    problem: "Server Java một thread mỗi request, 2.000 thread trên máy 8 core. CPU báo 70% nhưng throughput không tăng khi thêm thread; `vmstat` cho thấy cột `cs` hàng trăm nghìn mỗi giây và `sy` (thời gian trong kernel) cao. Máy bận chuyển qua lại hơn là làm việc.",
    idea: "Mỗi lần chuyển ngữ cảnh có giá cố định và một giá ẩn (cache, TLB lạnh). Giảm số lần chuyển: ít thread hơn số core cho việc CPU-bound, dùng event loop hoặc coroutine cho việc I/O-bound để chờ I/O mà không cần một OS thread đứng chờ.",
    tradeoff: "Giảm thread thì mỗi lời gọi blocking chặn nhiều việc hơn; dùng async/coroutine thì code phức tạp hơn và một đoạn CPU nặng chặn cả event loop. Không có cấu hình đúng cho mọi loại tải.",
  },
  diagrams: [
    {
      src: "content/svg/os-context-switch-cost.svg",
      caption: "Thang chi phí tương đối, không phải số đo: coroutine do runtime đổi, không qua kernel scheduler; thread cùng process vào kernel nhưng giữ page table nên TLB còn dùng được; process khác đổi page table nên TLB bị flush hoặc phải tách bằng ASID (OSTEP vm-tlbs — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf), cache cũng lạnh.",
      source: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf",
    },
  ],
  table: {
    head: ["Chuyển giữa", "Phải làm gì", "Chi phí tương đối"],
    rows: [
      {
        cells: ["Hai process", "Vào kernel, lưu/nạp thanh ghi, đổi kernel stack, **đổi bảng trang**", "Cao nhất"],
        why: "Đổi bảng trang làm các bản dịch trong TLB không còn đúng cho process mới. Cách đơn giản là xoá TLB; phần cứng có ASID thì giữ được bản dịch của nhiều process cùng lúc, nhưng process mới vẫn phải nạp phần của nó nếu đã bị đẩy ra (OSTEP, TLBs). Dữ liệu của process mới cũng chưa nằm trong cache CPU.",
      },
      {
        cells: ["Hai thread cùng process", "Vào kernel, lưu/nạp thanh ghi, đổi stack; **giữ nguyên bảng trang**", "Trung bình"],
        why: "Thread chung không gian địa chỉ nên không phải đổi bảng trang, bản dịch trong TLB vẫn dùng được (OSTEP, Threads — https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf). Vẫn phải vào kernel, chạy scheduler và chịu cache lạnh nếu hai thread làm việc trên dữ liệu khác nhau.",
      },
      {
        cells: ["Hai coroutine / goroutine / virtual thread", "Runtime đổi vài thanh ghi và con trỏ stack trong user space; không syscall", "Thấp nhất"],
        why: "Không vào kernel nên không có chi phí trap, không chạy scheduler của kernel. Go multiplex goroutine lên OS thread và khi một goroutine chặn thì runtime chuyển goroutine khác sang thread khác (https://go.dev/doc/faq#goroutines); virtual thread của Java tự gỡ khỏi carrier thread khi chặn I/O (JEP 444 — https://openjdk.org/jeps/444). Đổi lại, chỉ chuyển ở những điểm runtime kiểm soát.",
      },
    ],
  },
  points: [
    {
      t: "**Khi nào xảy ra** — (1) task gọi syscall chặn (đọc socket chưa có dữ liệu, chờ lock, `sleep`): **voluntary**; (2) timer interrupt báo hết time slice hoặc có task ưu tiên cao hơn sẵn sàng: **involuntary** (preemption).",
      why: "Kernel chỉ giành lại CPU được khi nó được chạy: hoặc task gọi vào kernel, hoặc phần cứng ngắt định kỳ. Không có timer interrupt thì một vòng lặp vô hạn giữ CPU mãi; timer là thứ bảo đảm OS luôn lấy lại quyền điều khiển (OSTEP, cpu-mechanisms).",
    },
    {
      t: "**Lưu gì** — thanh ghi đa dụng, PC (lệnh tiếp theo), con trỏ stack; trên kernel stack của task. Với process còn có con trỏ tới bảng trang.",
      why: "Đây là toàn bộ trạng thái CPU \"thấy\" của task; khôi phục đủ thì task chạy tiếp như chưa từng bị dừng. Bộ nhớ không phải lưu vì nó vẫn nằm nguyên trong RAM; chỉ cần trỏ lại đúng bảng trang.",
    },
    {
      t: "**Chi phí trực tiếp** — lmbench năm 1996 đo context switch khoảng 6 µs trên CPU 200 MHz; máy hiện đại 2–3 GHz xuống dưới 1 µs. Con số tuyệt đối không quan trọng bằng tần suất: mỗi lần chuyển còn kéo theo chi phí gián tiếp (cache, TLB lạnh) không nằm trong con số đo được, nên khi `cs` lên hàng trăm nghìn mỗi giây thì tổng chi phí đáng kể. Đây là ước lượng định tính; muốn số cụ thể thì đo trên máy của bạn (OSTEP gợi ý cách đo bằng hai process trao đổi qua pipe trên cùng một CPU).",
      why: "Số liệu từ OSTEP, mục \"How long context switches take\" (cpu-mechanisms). OSTEP cũng lưu ý nhiều thao tác của OS phụ thuộc băng thông bộ nhớ, thứ không tăng nhanh như tốc độ CPU, nên CPU mới chưa chắc làm context switch rẻ đi tương ứng.",
    },
    {
      t: "**Chi phí gián tiếp: cache và TLB lạnh** — task vừa chạy đã nạp dữ liệu của nó vào L1/L2 và bản dịch địa chỉ vào TLB. Task mới vào thì cache miss và TLB miss tới khi \"ấm\" lại. Task bị dời sang core khác còn tệ hơn: cache của core mới không có gì của nó.",
      why: "Một task chạy trên một CPU tích luỹ trạng thái trong cache và TLB của CPU đó; lần sau chạy lại trên cùng CPU sẽ nhanh hơn, nên scheduler cố giữ cache affinity (OSTEP, Multiprocessor Scheduling — https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-multi.pdf). Chi phí này không hiện trong con số \"thời gian switch\" mà hiện thành code chạy chậm hơn sau mỗi lần switch.",
    },
    {
      t: "**Đo trên Linux** — `vmstat 1`: cột `cs` = số context switch/giây, `r` = số task đang chờ CPU, `sy` = % thời gian trong kernel. Theo từng process: `/proc/<pid>/status` có `voluntary_ctxt_switches` và `nonvoluntary_ctxt_switches`; `pidstat -w 1` in cả hai theo giây.",
      why: "Phân biệt hai loại cho biết nguyên nhân: voluntary cao là task chờ nhiều (I/O, lock tranh chấp), nonvoluntary cao là thiếu CPU (quá nhiều task runnable, `r` lớn hơn số core) (vmstat(8) — https://man7.org/linux/man-pages/man8/vmstat.8.html; getrusage(2) — https://man7.org/linux/man-pages/man2/getrusage.2.html; proc_pid_status(5) — https://man7.org/linux/man-pages/man5/proc_pid_status.5.html).",
    },
    {
      t: "**Syscall không phải context switch** — gọi `read()` chuyển từ user mode sang kernel mode rồi quay lại **cùng task**; chỉ khi task phải chờ thì mới có context switch sang task khác.",
      why: "Hai khái niệm hay bị trộn. Mode switch (user ↔ kernel) cũng tốn (lưu thanh ghi, trap), lmbench 1996 đo syscall khoảng 4 µs (OSTEP), nhưng không đổi task nên không làm lạnh cache theo cách của context switch.",
    },
  ],
  sections: [
    {
      title: "Giảm context switch trong thực tế",
      table: {
        head: ["Tình huống", "Cách giảm", "Vì sao hiệu quả"],
        rows: [
          {
            cells: ["Việc CPU-bound", "Số thread ≈ số core (Go: `GOMAXPROCS` mặc định bằng số core)", "Thêm thread không thêm core; chỉ thêm lần chuyển. JEP 444 cũng nói việc nặng CPU thì thêm thread vượt số core không giúp gì, dù là virtual thread hay platform thread."],
            why: "Mỗi core chỉ chạy một thread tại một thời điểm; thread thứ 9 trên máy 8 core chỉ có thể chạy bằng cách giành CPU của thread khác (involuntary switch).",
          },
          {
            cells: ["Việc I/O-bound, nhiều kết nối", "Event loop (Node, Nginx, asyncio) hoặc green thread (goroutine, virtual thread)", "Một OS thread phục vụ nhiều kết nối; chờ I/O không chiếm một thread"],
            why: "Mô hình một thread mỗi kết nối biến mỗi lần chờ I/O thành một context switch của kernel. Event loop gom nhiều socket vào một lần chờ (epoll), green thread chuyển trong user space.",
          },
          {
            cells: ["Lock tranh chấp cao", "Giảm phạm vi lock, chia nhỏ lock, cấu trúc không cần lock", "Thread không phải ngủ chờ lock rồi được đánh thức"],
            why: "Mỗi lần thread chờ mutex đã bị giữ là một voluntary switch, mỗi lần mở lock đánh thức thread khác là thêm một switch nữa. `voluntary_ctxt_switches` tăng vọt là dấu hiệu lock contention.",
          },
          {
            cells: ["Latency rất thấp (trading, packet processing)", "Ghim thread vào core (`taskset`, `sched_setaffinity`), tách core khỏi scheduler", "Không bị dời core, cache luôn ấm"],
            why: "Tránh cả involuntary switch lẫn chuyển core; đổi lại core đó không làm việc khác được. Chỉ đáng khi latency tính bằng micro giây.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"vì sao hàng nghìn thread làm hệ thống chậm?\" trả lời theo 3 lớp: bộ nhớ stack, chi phí switch trực tiếp, và cache/TLB lạnh, rồi đưa giải pháp (pool cỡ số core cho CPU-bound, async hoặc green thread cho I/O-bound).",
      why: "Ứng viên trung bình chỉ nói \"switch tốn\"; ứng viên tốt nói **tốn ở đâu** và đo bằng gì (`vmstat`, `pidstat -w`). Kết bằng giải pháp theo loại tải cho thấy bạn biết áp dụng.",
    },
    {
      t: "Khi so sánh process, thread, coroutine: nêu đúng một điểm khác biệt quyết định cho từng cặp — process vs thread là **đổi bảng trang**; thread vs coroutine là **có vào kernel hay không**.",
      why: "Gọn, đúng cơ chế, và dễ suy ra mọi hệ quả còn lại. Interviewer thường hỏi tiếp \"vậy coroutine có nhược điểm gì\": coroutine chỉ chuyển ở điểm `await`/điểm chặn, một đoạn CPU dài chặn mọi coroutine khác trên cùng thread.",
    },
  ],
  related: ["ctx-switch"],
  cards: [
    ["Context switch lưu những gì?", "Thanh ghi đa dụng, PC, con trỏ stack (lên kernel stack của task); với process còn đổi con trỏ bảng trang."],
    ["Voluntary và involuntary context switch khác nhau thế nào?", "Voluntary: task tự nhường CPU vì phải chờ (I/O, lock, sleep). Involuntary: bị giành CPU do hết time slice hoặc task ưu tiên cao hơn sẵn sàng."],
    ["Vì sao chuyển giữa process đắt hơn giữa thread?", "Phải đổi bảng trang, nên bản dịch trong TLB không dùng được (xoá hoặc phân biệt bằng ASID) và dữ liệu trong cache không thuộc process mới."],
    ["Chi phí gián tiếp của context switch là gì?", "Cache và TLB lạnh: task mới bị cache miss, TLB miss cho tới khi nạp lại trạng thái; bị dời core thì mất hết cache cũ."],
    ["Xem số context switch trên Linux bằng gì?", "`vmstat 1` (cột `cs`), `pidstat -w 1`, hoặc `voluntary_ctxt_switches` / `nonvoluntary_ctxt_switches` trong `/proc/<pid>/status`."],
    ["Syscall có phải context switch không?", "Không nhất thiết. Syscall là chuyển user mode → kernel mode rồi về cùng task; chỉ khi task phải chờ thì kernel mới chuyển sang task khác."],
    ["Vì sao goroutine chuyển rẻ hơn OS thread?", "Runtime chuyển trong user space, không syscall, không chạy scheduler của kernel; stack nhỏ (vài KB) nên tạo được rất nhiều."],
  ],
});
