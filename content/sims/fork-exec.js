BK.sim({
  id: "fork-exec",
  title: "fork, exec, wait và zombie",
  topics: ["os-process-lifecycle"],
  scenario: "Bash chạy `ls -l > out.txt`. Xem từng lời gọi hệ thống giữa bash, kernel và process con, rồi xem chuyện gì xảy ra khi cha quên `wait()`.",
  context: "Ba lời gọi cần để ý: `fork()` nhân bản process (cha nhận PID con, con nhận 0), `execve()` thay chương trình trong process con (PID giữ nguyên, fd vẫn mở), `waitpid()` để cha đọc exit status và xoá bản ghi của con. Dòng chữ dưới mỗi node là trạng thái của nó; dòng dưới **Bảng process** cho biết kernel còn giữ những gì.",
  nodes: [
    { id: "bash", x: 110, y: 70, label: "bash (PID 100)" },
    { id: "K", x: 400, y: 70, label: "Kernel" },
    { id: "C", x: 690, y: 70, label: "Process con" },
    { id: "F", x: 690, y: 230, label: "out.txt" },
    { id: "T", x: 400, y: 230, label: "Bảng process", s: "100: bash" },
  ],
  variants: [
    {
      name: "Đúng cách: fork → exec → wait",
      steps: [
        {
          note: "bash gọi `fork()`.",
          msgs: [["bash", "K", "fork()"], ["K", "C", "tạo PID 101", "ok"], ["K", "bash", "trả 101", "ok"]],
          set: { C: "bash (bản sao), PID 101", T: "100: bash · 101: bash" },
          detail: "Kernel tạo process 101 là bản sao của bash: cùng code, cùng dữ liệu, cùng bảng fd. Bộ nhớ chưa bị chép thật: hai process dùng chung trang nhớ ở chế độ chỉ đọc, bên nào ghi thì kernel mới chép trang đó (copy-on-write). Cùng một dòng code chạy tiếp ở hai nơi: cha nhận 101, con nhận 0, và chỉ nhờ giá trị này mỗi bên biết mình là ai.",
        },
        {
          note: "Con mở file và trỏ stdout (fd 1) vào đó.",
          msgs: [["C", "F", "open()"], ["F", "C", "fd 3", "ok"], ["C", "K", "dup2(3, 1)"]],
          set: { C: "fd 1 → out.txt", F: "mở bởi PID 101" },
          detail: "Đây là khoảng giữa `fork` và `exec`, lý do Unix tách đôi hai lời gọi. Con vẫn đang chạy code của bash nên có thể tự chỉnh môi trường: mở `out.txt`, rồi `dup2` để fd 1 (stdout) trỏ vào file. Chương trình sắp chạy không cần biết gì về redirect.",
        },
        {
          note: "Con gọi `execve(\"/usr/bin/ls\")`.",
          msgs: [["C", "K", "execve(ls)"], ["K", "C", "nạp ls", "ok"]],
          set: { C: "ls, PID 101", T: "100: bash · 101: ls" },
          detail: "Kernel thay text, data, heap, stack của process 101 bằng chương trình `ls`. PID vẫn là 101, fd 1 vẫn trỏ vào `out.txt` vì fd sống qua `exec` (trừ fd gắn `FD_CLOEXEC`). `execve` thành công không trả về, vì code bash gọi nó đã bị ghi đè.",
        },
        {
          note: "`ls` ghi kết quả ra fd 1, tức vào file. Cha đang chặn trong `waitpid()`.",
          msgs: [{ par: [["C", "F", "write(1, …)"], ["bash", "K", "waitpid(101)", "warn"]] }],
          set: { bash: "chờ con ⏳", F: "có dữ liệu" },
          detail: "`ls` tưởng mình ghi ra màn hình, thực ra ghi vào file. Cùng lúc bash bị chặn trong `waitpid` (trạng thái S, không tốn CPU) cho tới khi con đổi trạng thái.",
        },
        {
          note: "`ls` gọi `exit(0)`. Kernel trả bộ nhớ, đóng fd, báo `SIGCHLD` cho cha.",
          msgs: [["C", "K", "exit(0)"], ["K", "bash", "SIGCHLD", "ok"]],
          set: { C: "zombie (đã thoát)", T: "100: bash · 101: Z, status 0" },
          detail: "Ngay khi exit, bộ nhớ và fd của 101 được trả lại. Kernel chỉ giữ bản ghi nhỏ (PID, exit status, thống kê tài nguyên), vì cha có thể muốn đọc. Trong khoảnh khắc này 101 chính là zombie, chuyện hoàn toàn bình thường.",
        },
        {
          note: "`waitpid` trả về 101 và status 0. Kernel xoá bản ghi.",
          msgs: [["K", "bash", "101, status 0", "ok"]],
          set: { bash: "$? = 0", C: "đã dọn", T: "100: bash" },
          good: ["bash", "T"],
          lesson: "Cha phải `wait()` mọi con nó sinh ra; đó là lời gọi duy nhất xoá zombie khỏi bảng process.",
          detail: "Bash đọc exit status vào `$?` rồi in prompt tiếp. Bảng process sạch, PID 101 được trả lại để dùng sau.",
        },
      ],
    },
    {
      name: "Cha quên wait: zombie dồn lại",
      steps: [
        {
          note: "Một server gọi `fork` + `exec` cho mỗi request, nhưng không bao giờ `wait()`.",
          msgs: [["bash", "K", "fork() + exec"], ["K", "C", "PID 101", "ok"]],
          set: { bash: "server, không wait", C: "worker, PID 101", T: "100: server · 101" },
          detail: "Node bash ở đây đóng vai một server viết vội: chạy lệnh ngoài (ví dụ convert ảnh) cho mỗi request, lấy kết quả qua file rồi quên `wait()`.",
        },
        {
          note: "Con chạy xong và `exit`. Kernel báo `SIGCHLD`, server bỏ qua.",
          msgs: [["C", "K", "exit(0)"], ["K", "bash", "SIGCHLD", "warn"]],
          set: { C: "zombie <defunct>", T: "100 · 101: Z" },
          bad: ["C"],
          detail: "Mặc định `SIGCHLD` bị bỏ qua mà không dọn con (khác với việc đặt tường minh `SIG_IGN`). Không ai gọi `wait`, nên bản ghi của 101 nằm lại. `ps` hiện `Z` / `<defunct>`. `kill -9 101` không tác dụng: process đã chết rồi.",
        },
        {
          note: "Hàng nghìn request sau, bảng process đầy zombie.",
          msgs: [["bash", "K", "fork()"], ["K", "bash", "EAGAIN", "err"]],
          set: { T: "100 · 101..N: Z (hết PID)", bash: "fork lỗi ✗" },
          bad: ["T", "bash"],
          detail: "Mỗi zombie giữ một PID và một slot. Khi chạm `pid_max` hoặc `RLIMIT_NPROC`, `fork()` trả `EAGAIN`: server không tạo được process mới dù CPU và RAM còn rảnh. Lỗi này khó đoán vì `top` không cho thấy gì bất thường về tài nguyên.",
        },
        {
          note: "Sửa: handler `SIGCHLD` lặp `waitpid(-1, WNOHANG)`; hoặc khi server chết, init nhận nuôi và dọn.",
          msgs: [["bash", "K", "waitpid(-1, WNOHANG)"], ["K", "bash", "101, 102, … rồi 0", "ok"]],
          set: { T: "100: server", bash: "dọn xong ✓", C: "đã dọn" },
          good: ["bash", "T"],
          lesson: "Zombie không tốn RAM nhưng giữ PID; tích luỹ đủ nhiều thì `fork()` thất bại.",
          detail: "Phải lặp tới khi `waitpid` trả 0, vì nhiều con kết thúc gần nhau có thể chỉ sinh một lần `SIGCHLD` (signal chuẩn không xếp hàng). Nếu server chết, các zombie thành con nuôi của init (PID 1), và init tự `wait` để dọn; trong container, PID 1 thường là app của bạn nên cần một init nhỏ như `tini`.",
        },
      ],
    },
  ],
});
