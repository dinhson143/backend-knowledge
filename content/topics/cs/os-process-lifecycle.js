BK.topic({
  id: "os-process-lifecycle",
  track: "cs",
  section: "cs-os",
  title: "Process: fork, exec, zombie",
  goal: "Kể chuyện gì xảy ra khi chạy một lệnh và dọn zombie process",
  tldr: {
    t: "Process là một chương trình đang chạy: có PID, không gian địa chỉ riêng, bảng file descriptor riêng. Trên Linux, shell chạy một lệnh bằng 3 bước: `fork()` nhân bản chính nó, process con gọi `execve()` để thay bằng chương trình mới, process cha gọi `wait()` để nhận exit code. Con chết mà cha chưa `wait()` thì thành **zombie**; cha chết trước thì con thành **orphan** và được init (PID 1) nhận nuôi.",
    why: "Tách tạo process (`fork`) khỏi nạp chương trình (`exec`) cho phép process con chỉnh môi trường (đổi file descriptor, biến môi trường, thư mục) trong khoảng giữa hai lời gọi, nên shell làm được redirect và pipe mà không cần API riêng cho từng việc (OSTEP, Process API — https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf). Zombie tồn tại vì kernel phải giữ exit status ở đâu đó cho tới khi cha đọc; nếu xoá ngay thì cha không bao giờ biết con thành công hay thất bại.",
  },
  story: {
    problem: "Server của bạn chạy lệnh ngoài (ffmpeg, git, script) cho mỗi request. Vài ngày sau `ps` đầy dòng `<defunct>`, rồi `fork()` báo `EAGAIN`: hết chỗ tạo process mới dù CPU và RAM vẫn rảnh.",
    idea: "Hiểu vòng đời: mỗi process con khi kết thúc để lại một bản ghi nhỏ (PID, exit status, thống kê tài nguyên) chờ cha đọc bằng `wait()`. Cha phải `wait()` mọi con nó sinh ra, hoặc nhờ một init process biết dọn (subreaper, `tini`) làm thay.",
    tradeoff: "`fork()` rẻ nhờ copy-on-write nhưng vẫn phải chép page table, và trong chương trình nhiều thread thì nguy hiểm (chỉ thread gọi `fork` được chép, lock có thể đang bị giữ). Vì vậy nhiều runtime chuyển sang spawn hoặc forkserver thay vì fork thẳng.",
  },
  table: {
    head: ["Lời gọi", "Làm gì", "Trả về"],
    rows: [
      {
        cells: ["`fork()`", "Tạo process con là bản sao của cha: cùng code, cùng dữ liệu (copy-on-write), bản sao các file descriptor", "Cha nhận PID của con, con nhận 0, lỗi thì -1"],
        why: "Cùng một dòng code chạy tiếp ở hai process, nên giá trị trả về là cách duy nhất để mỗi bên biết mình là ai. Linux không chép bộ nhớ ngay: trang nhớ được dùng chung ở chế độ chỉ đọc, bên nào ghi thì kernel mới chép trang đó (copy-on-write); cái giá chính còn lại là chép page table và tạo task struct (fork(2) — https://man7.org/linux/man-pages/man2/fork.2.html).",
      },
      {
        cells: ["`execve(path, argv, envp)`", "Thay chương trình đang chạy trong process bằng chương trình mới: text, data, heap, stack đều mới", "Thành công thì **không trả về**; lỗi thì -1"],
        why: "Không có gì để trả về vì code gọi `execve` đã bị ghi đè. PID giữ nguyên, file descriptor vẫn mở trừ khi gắn cờ `FD_CLOEXEC`, mọi thread khác bị huỷ, handler signal trở về mặc định (execve(2) — https://man7.org/linux/man-pages/man2/execve.2.html). Chính việc fd sống qua `exec` làm redirect hoạt động.",
      },
      {
        cells: ["`waitpid(pid, &status, flags)`", "Chờ con đổi trạng thái (mặc định: kết thúc), đọc exit status, giải phóng bản ghi zombie", "PID của con; với `WNOHANG` mà chưa con nào xong thì trả 0"],
        why: "Đây là lời gọi duy nhất xoá zombie khỏi bảng process. `WNOHANG` cho phép server kiểm tra không chặn, thường đặt trong handler `SIGCHLD` hoặc vòng lặp sự kiện (wait(2) — https://man7.org/linux/man-pages/man2/wait.2.html).",
      },
      {
        cells: ["`exit(code)`", "Kết thúc process: đóng fd, trả bộ nhớ, gửi `SIGCHLD` cho cha", "Không trả về"],
        why: "Bộ nhớ và fd được trả ngay khi exit, nên zombie gần như không tốn RAM. Thứ nó còn giữ là một slot trong bảng process và một PID; hết PID thì không tạo được process mới.",
      },
    ],
  },
  points: [
    {
      t: "**Trạng thái process** — Running (đang chạy trên CPU), Ready (chờ tới lượt CPU), Blocked (chờ I/O hoặc sự kiện), cộng trạng thái cuối là zombie. Trên Linux xem cột `STAT` của `ps` hoặc dòng `State:` trong `/proc/<pid>/status`: R, S, D, T, Z.",
      why: "Scheduler chỉ chọn process từ hàng Ready, nên process Blocked không tốn CPU dù đang \"sống\". `D` (disk sleep) là chờ I/O không ngắt được: kể cả `kill -9` cũng phải đợi I/O xong, vì kernel chỉ xử lý signal khi process quay lại từ lời gọi đang chờ. Mô hình 3 trạng thái: OSTEP — https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf; ký hiệu trạng thái: proc_pid_status(5) — https://man7.org/linux/man-pages/man5/proc_pid_status.5.html.",
    },
    {
      t: "**Chạy `ls -l > out.txt` trong bash** — bash `fork()`; trong con: `open(\"out.txt\")`, `dup2(fd, 1)` để fd 1 (stdout) trỏ vào file, rồi `execve(\"/usr/bin/ls\")`; trong cha: `waitpid()` tới khi `ls` xong, đọc exit code vào `$?`.",
      why: "`ls` không biết gì về file `out.txt`: nó chỉ ghi ra fd 1 như mọi khi. Redirect chạy được vì shell sửa bảng fd của con trong khoảng giữa `fork` và `exec`, và bảng fd sống qua `exec`. Nếu `fork` và `exec` gộp làm một thì mỗi kiểu chỉnh môi trường (redirect, pipe, đổi thư mục) sẽ cần một tham số riêng.",
    },
    {
      t: "**Zombie** — con đã kết thúc nhưng cha chưa `wait()`. `ps` hiện `Z` hoặc `<defunct>`. Không giết được bằng `kill` vì nó đã chết; muốn dọn thì cha phải `wait()`, hoặc cha chết để init nhận nuôi và dọn.",
      why: "Kernel giữ lại PID, exit status và thống kê tài nguyên để cha đọc sau; mỗi zombie chiếm một slot trong bảng process (wait(2)). Một vài zombie vô hại; zombie tích luỹ theo request thì tới lúc chạm `pid_max` hoặc `RLIMIT_NPROC`, và `fork()` trả `EAGAIN` (fork(2)).",
    },
    {
      t: "**Orphan** — cha chết trước con. Con được init (PID 1) hoặc subreaper gần nhất (`PR_SET_CHILD_SUBREAPER`) nhận làm con, và init tự `wait()` để dọn khi con kết thúc.",
      why: "Mọi process phải có cha để có người nhận exit status. Init được thiết kế để luôn `wait()` cho con nuôi, nên orphan không thành zombie vĩnh viễn (wait(2)).",
    },
    {
      t: "**PID 1 trong container** — trong container, app của bạn thường chính là PID 1 của PID namespace, nên nó nhận nuôi mọi orphan. App không gọi `wait()` cho con nuôi thì zombie dồn lại; thêm vào đó PID 1 chỉ nhận signal mà nó đã cài handler, nên `SIGTERM` có thể bị bỏ qua.",
      why: "Kernel coi PID 1 của namespace là init: orphan được gán về nó, và signal từ trong namespace chỉ tới được nếu PID 1 đã đăng ký handler, để tránh vô tình giết init (pid_namespaces(7) — https://man7.org/linux/man-pages/man7/pid_namespaces.7.html). Vì vậy người ta chạy một init nhỏ (như `tini`, hoặc tuỳ chọn `--init` của Docker) làm PID 1 để dọn zombie và chuyển tiếp signal.",
    },
    {
      t: "**Cách dọn con đúng** — gọi `waitpid()` cho mọi con; server có nhiều con thì cài handler `SIGCHLD` và lặp `waitpid(-1, &st, WNOHANG)` tới khi trả 0; hoặc đặt `SIGCHLD` thành `SIG_IGN` nếu không cần exit status.",
      why: "Nhiều con có thể kết thúc gần nhau mà chỉ sinh một lần `SIGCHLD` (signal chuẩn không xếp hàng), nên phải lặp tới khi hết. Đặt `SIG_IGN` tường minh khiến con không thành zombie theo POSIX, đổi lại không còn đọc được exit code (wait(2)).",
    },
    {
      t: "**fork trong chương trình nhiều thread** — con chỉ có đúng một thread (thread đã gọi `fork`), nhưng toàn bộ bộ nhớ được chép, kể cả trạng thái mutex. Tới khi `exec`, con chỉ được gọi các hàm async-signal-safe.",
      why: "Nếu lúc fork một thread khác đang giữ lock của `malloc` hay logger, con thừa hưởng lock ở trạng thái \"đang bị giữ\" nhưng thread giữ nó không tồn tại trong con, nên lần đầu con gọi `malloc` là treo vĩnh viễn (fork(2)). Đây là lý do runtime hiện đại tránh fork thẳng một process nhiều thread.",
    },
  ],
  sections: [
    {
      title: "Trên Linux và trong các ngôn ngữ",
      table: {
        head: ["Ở đâu", "Tạo process con thế nào", "Điều cần biết"],
        rows: [
          {
            cells: ["Linux, glibc", "`fork()` của glibc thực chất gọi `clone()` với cờ cho hiệu ứng như fork", "`strace -f -e trace=process bash -c 'ls'` sẽ hiện `clone`, `execve`, `wait4` chứ không có `fork`"],
            why: "Từ glibc 2.3.3, wrapper `fork()` gọi `clone(2)` (tương đương `clone` chỉ với `SIGCHLD`) và chạy các handler `pthread_atfork` (fork(2), mục C library/kernel differences). Biết điều này để đọc strace không bị bất ngờ.",
          },
          {
            cells: ["Python `multiprocessing`", "Ba cách: `spawn` (interpreter mới), `fork`, `forkserver`. Từ 3.14, mặc định trên Linux là `forkserver`; macOS và Windows là `spawn`", "Từ 3.12, `os.fork()` trong process có nhiều thread phát `DeprecationWarning`"],
            why: "Python đổi mặc định khỏi `fork` để giữ tốc độ mà tránh lỗi fork process nhiều thread nêu ở trên: forkserver là một process đơn luồng chuyên fork theo yêu cầu (https://docs.python.org/3/library/multiprocessing.html). Hệ quả thực tế: code chạy với `spawn`/`forkserver` phải để phần khởi tạo trong `if __name__ == \"__main__\":` và đối số truyền cho con phải pickle được.",
          },
          {
            cells: ["Node.js", "`child_process.spawn/exec/fork` tạo process mới chạy chương trình khác hoặc một Node khác", "Cha phải nghe sự kiện `exit` / `close`; Node tự gọi wait nên không sinh zombie"],
            why: "Runtime (libuv) thu exit status của con và phát thành sự kiện `exit`; việc của bạn là xử lý exit code và stdout/stderr để không bỏ sót lỗi của con.",
          },
          {
            cells: ["Go, Java", "`os/exec` (Go) và `ProcessBuilder` (Java) đều là fork + exec trong một lời gọi", "Phải gọi `cmd.Wait()` (Go) hoặc `process.waitFor()` (Java), và đọc hết stdout/stderr"],
            why: "Không `Wait()` thì con thành zombie cho tới khi runtime dọn, và pipe stdout có dung lượng hữu hạn: cha không đọc thì pipe đầy, con bị chặn khi ghi, nên lệnh treo mà không báo lỗi.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"chuyện gì xảy ra khi gõ một lệnh?\" nên trả lời đủ 4 nhịp: shell parse → `fork` → con chỉnh fd rồi `exec` → cha `wait` và lấy exit code. Kết bằng một câu về zombie.",
      why: "Interviewer kiểm tra bạn hiểu process là đơn vị độc lập có vòng đời, không chỉ thuộc tên lời gọi. Nhắc tới redirect giữa `fork` và `exec` cho thấy bạn hiểu **vì sao** API tách đôi.",
    },
    {
      t: "Khi được hỏi \"zombie có tốn RAM không?\", trả lời: gần như không, nhưng nó giữ PID và slot trong bảng process; nguy hiểm là khi tích luỹ.",
      why: "Câu trả lời sai phổ biến là \"zombie ăn RAM\" hoặc \"kill -9 zombie\". Phân biệt được \"đã trả tài nguyên\" với \"còn giữ PID\" là dấu hiệu bạn hiểu cơ chế.",
    },
    "Nếu có nói về container, nối sang PID 1: app làm PID 1 phải dọn zombie và tự xử lý `SIGTERM`, hoặc dùng một init nhỏ.",
  ],
  related: ["fork-exec"],
  cards: [
    ["`fork()` trả về gì ở cha và ở con?", "Cha nhận PID của con, con nhận 0, lỗi thì -1 (không có con nào được tạo)."],
    ["Vì sao `execve()` thành công thì không trả về?", "Chương trình gọi nó đã bị thay toàn bộ (text, data, heap, stack). PID và các fd không gắn `FD_CLOEXEC` vẫn giữ nguyên."],
    ["Vì sao Unix tách `fork` và `exec`?", "Để con chỉnh môi trường (redirect fd, pipe, biến môi trường) trong khoảng giữa hai lời gọi; chương trình được exec không cần biết gì về redirect."],
    ["Zombie là gì, dọn thế nào?", "Con đã kết thúc nhưng cha chưa `wait()`. Kernel giữ PID và exit status. Dọn bằng cách cho cha `waitpid()`, hoặc cha chết để init nhận nuôi và dọn. `kill` không có tác dụng."],
    ["Orphan khác zombie ở đâu?", "Orphan là con còn sống mà cha đã chết; nó được init/subreaper nhận nuôi. Zombie là con đã chết mà cha chưa đọc exit status."],
    ["Vì sao app làm PID 1 trong container dễ sinh zombie?", "PID 1 nhận nuôi mọi orphan trong namespace; app thường không gọi `wait()` cho con nuôi. Dùng init nhỏ (`tini`, `--init`) để dọn và chuyển tiếp signal."],
    ["`fork()` tốn gì nếu đã có copy-on-write?", "Chép page table và tạo task struct; trang nhớ chỉ bị chép khi một bên ghi. Process càng nhiều bộ nhớ thì page table càng lớn."],
  ],
});
