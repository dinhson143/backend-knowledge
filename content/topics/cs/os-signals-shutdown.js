BK.topic({
  id: "os-signals-shutdown",
  track: "cs",
  section: "cs-os",
  title: "Signal & Graceful Shutdown",
  goal: "Dừng app không rớt request: SIGTERM, drain, PID 1 trong container",
  needs: ["os-process-lifecycle"],
  tldr: {
    t: "**Signal** là thông báo kernel gửi tới process vào thời điểm bất kỳ. Khi deploy, Docker và Kubernetes gửi `SIGTERM` (\"hãy dừng\"), chờ một khoảng (Kubernetes mặc định 30 giây), rồi gửi `SIGKILL` (không bắt được, chết ngay). **Graceful shutdown** (dừng gọn) là dùng khoảng chờ đó để: ngừng nhận việc mới, **drain** (làm xong) việc đang dở, đóng kết nối, rồi tự thoát. App không bắt `SIGTERM`, hoặc không nhận được nó vì chạy sau một shell, thì mỗi lần deploy là một lần cắt ngang request.",
    why: "signal(7): hành động mặc định của `SIGTERM` là kết thúc process, và `SIGKILL`, `SIGSTOP` không thể bắt, chặn hay bỏ qua (https://man7.org/linux/man-pages/man7/signal.7.html). Chỉ `SIGTERM` cho app cơ hội dọn dẹp; nếu app bỏ phí nó thì `SIGKILL` sau grace period sẽ dừng app giữa chừng (https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/).",
  },
  story: {
    problem: "Mỗi lần rolling deploy, dashboard có một đợt lỗi 502 và vài job trong queue bị xử lý hai lần. App Python chạy bằng `CMD python app.py` dạng shell form nên không nhận `SIGTERM`; Kubernetes chờ đủ 30 giây rồi `SIGKILL`. Request đang chạy bị cắt, message đã lấy nhưng chưa commit thì được giao lại.",
    idea: "App là PID 1 (hoặc có init chuyển signal), bắt `SIGTERM`, chuyển sang trạng thái \"đang dừng\": báo không sẵn sàng, ngừng lấy việc mới, chờ việc đang chạy xong trong một deadline ngắn hơn grace period, đóng tài nguyên, thoát với mã 0.",
    tradeoff: "Grace period dài thì deploy chậm và node khó rút; ngắn thì việc dài bị cắt. Việc dài hơn grace period không bao giờ \"dừng gọn\" được, nên vẫn cần idempotency và retry ở phía sau.",
  },
  table: {
    head: ["Signal", "Số (x86/ARM)", "Mặc định", "Gặp khi nào"],
    rows: [
      {
        cells: ["`SIGTERM`", "15", "Kết thúc process", "`kill <pid>`, `docker stop`, Kubernetes xoá pod"],
        why: "Đây là signal \"xin dừng\": bắt được, nên app có cơ hội dọn dẹp. Kubernetes gửi TERM tới process 1 trong mỗi container, trừ khi image khai báo `STOPSIGNAL` khác (pod-termination).",
      },
      {
        cells: ["`SIGINT`", "2", "Kết thúc process", "Ctrl+C trong terminal"],
        why: "Python cài sẵn handler biến `SIGINT` thành `KeyboardInterrupt` (https://docs.python.org/3/library/signal.html); trong container không ai bấm Ctrl+C, nên handler cho `SIGINT` thôi là không đủ.",
      },
      {
        cells: ["`SIGKILL`", "9", "Kết thúc process", "Hết grace period, OOM killer, `kill -9`"],
        why: "Không bắt, không chặn, không bỏ qua được (signal(7)). Không có code nào của app chạy sau đó: không flush log, không commit offset. Shell báo mã thoát 128 + số signal, nên process bị `SIGKILL` hiện mã 137, bị `SIGTERM` mà không tự xử lý hiện 143 (https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html).",
      },
      {
        cells: ["`SIGHUP`", "1", "Kết thúc process", "Terminal đóng; nhiều daemon dùng để nạp lại cấu hình"],
        why: "Quy ước nạp lại cấu hình (Nginx) là do chương trình tự cài handler; mặc định của kernel vẫn là kết thúc process.",
      },
      {
        cells: ["`SIGCHLD`", "17", "Bỏ qua", "Process con dừng hoặc kết thúc"],
        why: "Process cha phải `wait()` để dọn process con đã chết, nếu không con thành zombie (bài `os-process-lifecycle`). Đây là việc của PID 1 trong container.",
      },
      {
        cells: ["`SIGPIPE`", "13", "Kết thúc process", "Ghi vào pipe/socket mà đầu kia đã đóng"],
        why: "Python cài sẵn: bỏ qua `SIGPIPE` để lỗi ghi trở thành exception thường (`BrokenPipeError`) thay vì làm chết process (tài liệu `signal`).",
      },
    ],
  },
  points: [
    {
      t: "**Kubernetes dừng pod thế nào** — (1) pod bị đánh dấu terminating; (2) kubelet chạy `preStop` hook nếu có, rồi gửi TERM tới PID 1 của mỗi container; (3) **cùng lúc** đó control plane đánh dấu endpoint của pod là terminating, load balancer ngừng gửi traffic thường; (4) hết grace period (mặc định 30 giây, tính cả thời gian `preStop`) mà còn container chạy thì `SIGKILL`.",
      why: "Theo trang Pod termination (https://kubernetes.io/docs/concepts/workloads/pods/pod-termination/). Nếu `preStop` còn chạy khi hết grace period, kubelet cho thêm một lần 2 giây; `preStop` cần lâu hơn thì phải tăng `terminationGracePeriodSeconds`.",
    },
    {
      t: "**Race giữa SIGTERM và gỡ endpoint** — bước (2) và (3) chạy đồng thời, nên app có thể nhận `SIGTERM` trong khi load balancer hoặc kube-proxy vẫn còn gửi request tới. App đóng listener ngay thì những request đó lỗi.",
      why: "Trang Pod termination không bảo đảm thứ tự giữa gỡ endpoint và gửi TERM. Cách thường dùng: `preStop` ngủ vài giây, hoặc app vẫn phục vụ vài giây sau `SIGTERM` rồi mới đóng listener, để các thành phần mạng kịp cập nhật. Phải trừ khoảng này khỏi grace period.",
    },
    {
      t: "**Các bước drain trong app** — (1) báo không sẵn sàng (readiness trả lỗi); (2) vẫn phục vụ thêm vài giây cho load balancer kịp gỡ endpoint, rồi ngừng nhận việc mới: đóng listener, consumer ngừng `poll`; (3) chờ việc đang chạy xong, có **deadline** ngắn hơn grace period; (4) đóng DB pool, flush log và metric, commit offset; (5) thoát mã 0.",
      why: "Bước (3) không có deadline thì một request treo giữ pod tới khi bị `SIGKILL`, mất luôn bước (4). Consumer queue nên commit sau khi xử lý xong; message đang dở mà bị kill sẽ được giao lại, vì vậy handler phải idempotent (bài `idempotency`).",
    },
    {
      t: "**PID 1 không chết vì SIGTERM mặc định** — trong PID namespace của container, process 1 là \"init\": kernel chỉ giao cho nó những signal mà nó **đã cài handler**. App là PID 1 mà không bắt `SIGTERM` thì `SIGTERM` bị bỏ qua, container đứng tới hết grace period rồi bị `SIGKILL`.",
      why: "pid_namespaces(7): process ở namespace tổ tiên chỉ gửi được signal tới init của namespace con nếu init đã cài handler cho signal đó; riêng `SIGKILL` và `SIGSTOP` luôn được giao (https://man7.org/linux/man-pages/man7/pid_namespaces.7.html). Vì vậy \"chương trình chạy ngoài container dừng được bằng Ctrl+C\" không có nghĩa là trong container nó dừng gọn.",
    },
    {
      t: "**Ai là PID 1** — exec form `CMD [\"python\", \"app.py\"]` thì app là PID 1. Shell form hoặc script khởi động không có `exec` thì shell là PID 1 và không chuyển signal cho app. `docker run --init` (tini) đặt một init nhỏ làm PID 1 để chuyển signal và dọn zombie.",
      why: "Chi tiết exec form và script `exec \"$@\"` ở bài `dockerfile`. Tài liệu Docker mô tả `--init` là chạy một init trong container, chuyển signal và dọn process, cài bằng tini (https://docs.docker.com/reference/cli/docker/container/run/).",
    },
    {
      t: "**Handler phải tối giản** — trong C, signal handler có thể chạy chen vào giữa bất kỳ lệnh nào, nên chỉ được gọi hàm async-signal-safe; cách an toàn là đặt một cờ rồi để vòng chính kiểm tra cờ.",
      why: "signal-safety(7): hàm không reentrant (như toàn bộ stdio) không an toàn khi gọi từ handler, vì handler có thể ngắt chính hàm đó đang chạy dở (https://man7.org/linux/man-pages/man7/signal-safety.7.html). Ví dụ `malloc` bị ngắt giữa chừng rồi handler gọi `malloc` lần nữa thì cấu trúc heap hỏng.",
    },
    {
      t: "**Python chạy handler muộn và chỉ ở main thread** — handler C chỉ đặt cờ; handler Python chạy sau, ở lệnh bytecode tiếp theo, và luôn trên main thread. Một đoạn tính bằng C chạy lâu (regex trên văn bản lớn) hoãn handler tới khi xong.",
      why: "Trích tài liệu `signal` (https://docs.python.org/3/library/signal.html). Hệ quả: main thread phải còn chạy code Python (không kẹt mãi trong một lời gọi C) thì mới nhận được `SIGTERM`; và chỉ main thread được cài handler.",
    },
    {
      t: "**Syscall bị signal cắt ngang** — signal tới khi thread đang chặn trong `read()`: lời gọi có thể thất bại với `EINTR`, hoặc được tự gọi lại nếu handler cài với `SA_RESTART`. Từ Python 3.5 (PEP 475), thư viện chuẩn tự gọi lại syscall bị `EINTR` nếu handler không ném exception.",
      why: "signal(7) liệt kê lời gọi nào được restart và lời gọi nào luôn trả `EINTR`. PEP 475 (https://peps.python.org/pep-0475/) bỏ việc mọi code Python phải tự bắt `InterruptedError`.",
    },
  ],
  sections: [
    {
      title: "Python: dừng gọn một worker asyncio",
      table: {
        head: ["Code", "Làm gì", "Vì sao"],
        rows: [
          {
            cells: ["`stop = asyncio.Event()`", "Cờ \"đang dừng\" dùng chung", "Handler chỉ đặt cờ; logic dừng nằm trong code thường"],
            why: "Đúng nguyên tắc handler tối giản: không làm I/O hay chờ gì trong handler.",
          },
          {
            cells: ["`loop.add_signal_handler(signal.SIGTERM, stop.set)`", "Bắt `SIGTERM` (chỉ Unix)", "Callback chạy trong event loop nên được phép đụng vào loop"],
            why: "Tài liệu asyncio: khác `signal.signal()`, callback đăng ký bằng `add_signal_handler` được gọi cùng các callback khác của loop và được tương tác với loop; vẫn phải gọi từ main thread (https://docs.python.org/3/library/asyncio-eventloop.html).",
          },
          {
            cells: ["`while not stop.is_set(): msg = await queue.get(); await handle(msg)`", "Chỉ lấy việc mới khi chưa dừng", "Việc đang xử lý chạy tới hết rồi vòng lặp mới thoát"],
            why: "Kiểm tra cờ trước mỗi lần lấy việc là bước \"ngừng nhận việc mới\". Nếu `queue.get()` có thể chờ lâu thì chờ đồng thời cả `stop.wait()` để không kẹt ở đó.",
          },
          {
            cells: ["`await asyncio.wait_for(drain(), timeout=20)`", "Chờ việc dở xong, tối đa 20 giây", "Deadline nhỏ hơn grace period 30 giây, chừa thời gian đóng tài nguyên"],
            why: "Không có deadline thì một việc treo giữ process tới `SIGKILL`. Hết deadline thì ghi log việc bị bỏ dở, để nó được xử lý lại nhờ at-least-once.",
          },
          {
            cells: ["`await db_pool.close(); producer.flush()`", "Đóng kết nối, đẩy nốt dữ liệu trong buffer", "Thoát mà không flush thì mất log, metric, message chưa gửi"],
            why: "Đây là phần mà `SIGKILL` lấy mất nếu bước drain kéo quá lâu; vì vậy deadline ở bước trước phải chừa chỗ cho nó.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Kể graceful shutdown theo dòng thời gian của Kubernetes: preStop → SIGTERM (đồng thời với gỡ endpoint) → drain có deadline → đóng tài nguyên → thoát; hết grace thì SIGKILL.",
      why: "Interviewer muốn nghe bạn biết **race** giữa SIGTERM và gỡ endpoint; đó là nguồn của lỗi 502 khi deploy mà nhiều người không giải thích được.",
    },
    {
      t: "Luôn nói thêm: shutdown gọn chỉ giảm lỗi, không loại bỏ; node chết, OOM, `SIGKILL` vẫn xảy ra, nên việc phía sau phải idempotent và retry được.",
      why: "Thiết kế chỉ đúng khi mọi process dừng gọn là thiết kế mong manh; at-least-once cộng idempotency mới chịu được cả trường hợp bị kill.",
    },
  ],
  cards: [
    ["Signal nào không bắt được?", "`SIGKILL` và `SIGSTOP`: không bắt, không chặn, không bỏ qua được."],
    ["Kubernetes dừng container theo thứ tự nào?", "Chạy `preStop` (nếu có) → gửi TERM tới PID 1 → chờ `terminationGracePeriodSeconds` (mặc định 30 giây, tính cả preStop) → `SIGKILL`. Gỡ endpoint diễn ra đồng thời."],
    ["Vì sao app làm PID 1 trong container có thể không chết khi nhận `SIGTERM`?", "Kernel chỉ giao cho init của PID namespace những signal nó đã cài handler (trừ `SIGKILL`/`SIGSTOP` từ namespace cha); không có handler thì `SIGTERM` bị bỏ qua."],
    ["Các bước drain khi nhận `SIGTERM`?", "Báo không sẵn sàng, phục vụ thêm vài giây cho endpoint kịp gỡ, ngừng nhận việc mới, chờ việc dở xong với deadline < grace period, đóng tài nguyên và flush, thoát mã 0."],
    ["Mã thoát 137 và 143 nghĩa là gì?", "128 + số signal: 137 = bị `SIGKILL` (9), 143 = bị `SIGTERM` (15) mà không tự xử lý."],
    ["Python chạy signal handler ở đâu?", "Luôn ở main thread, sau khi C handler đặt cờ, tại lệnh bytecode tiếp theo; một lời gọi C dài sẽ hoãn handler."],
    ["Vì sao trong signal handler chỉ nên đặt cờ?", "Handler có thể chen vào giữa bất kỳ lệnh nào, kể cả giữa `malloc` hay `printf`; gọi hàm không async-signal-safe trong handler có thể làm hỏng trạng thái."],
  ],
});
