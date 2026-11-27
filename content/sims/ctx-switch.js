BK.sim({
  id: "ctx-switch",
  title: "Context switch giữa hai thread",
  topics: ["os-context-switch"],
  scenario: "Một CPU, hai thread: A đang tính toán, B đang chờ dữ liệu từ socket. Xem kernel chuyển CPU qua lại khi hết time slice và khi chờ I/O, rồi so với chuyển sang một process khác.",
  context: "Dòng dưới **CPU** cho biết ai đang chạy và cache/TLB đang chứa dữ liệu của ai. Dòng dưới **Kernel** là hàng Ready (chờ CPU). Hai loại chuyển: **involuntary** (timer ngắt, bị giành CPU) và **voluntary** (task tự nhường vì phải chờ). Để ý chi phí ẩn: sau mỗi lần chuyển, cache và TLB còn chứa dữ liệu của task cũ.",
  nodes: [
    { id: "A", x: 110, y: 70, label: "Thread A", s: "running" },
    { id: "B", x: 110, y: 230, label: "Thread B", s: "blocked: chờ socket" },
    { id: "CPU", x: 420, y: 70, label: "CPU core", s: "chạy A · cache: A" },
    { id: "K", x: 420, y: 230, label: "Kernel", s: "ready: —" },
    { id: "NIC", x: 700, y: 230, label: "Card mạng" },
    { id: "P", x: 700, y: 70, label: "Process khác", s: "ready" },
  ],
  variants: [
    {
      name: "Hai thread cùng process",
      steps: [
        {
          note: "Dữ liệu tới socket của B. Ngắt từ card mạng, kernel đưa B vào hàng Ready.",
          msgs: [["NIC", "K", "interrupt: có gói tin"], ["K", "B", "đánh thức", "ok"]],
          set: { B: "ready", K: "ready: B" },
          detail: "B không chạy ngay: nó chỉ chuyển từ Blocked sang Ready. A vẫn giữ CPU cho tới khi hết time slice hoặc tự nhường.",
        },
        {
          note: "Timer interrupt: A hết time slice. CPU nhảy vào kernel.",
          msgs: [["CPU", "K", "timer interrupt", "warn"]],
          set: { A: "bị ngắt", CPU: "trong kernel" },
          detail: "Phần cứng tự lưu một phần thanh ghi của A lên kernel stack và chuyển sang kernel mode. Không có timer, một A chạy vòng lặp vô tận sẽ giữ CPU mãi; timer là thứ bảo đảm OS luôn lấy lại quyền điều khiển.",
        },
        {
          note: "Scheduler chọn B. Lưu thanh ghi, PC, stack pointer của A; nạp của B.",
          msgs: [["K", "A", "lưu context A"], ["K", "B", "nạp context B", "ok"]],
          set: { A: "ready (involuntary)", B: "running", K: "ready: A", CPU: "chạy B · cache: vẫn A" },
          detail: "Đây là context switch **involuntary**: A không muốn dừng. Vì A và B cùng process nên **không đổi bảng trang**: bản dịch địa chỉ trong TLB vẫn đúng cho B. Nhưng cache dòng dữ liệu vẫn là của A.",
        },
        {
          note: "B chạy, đọc dữ liệu socket. Lần đầu chạm dữ liệu của nó: cache miss.",
          msgs: [["B", "CPU", "đọc buffer, xử lý"]],
          set: { CPU: "chạy B · cache: A → B" },
          bad: ["CPU"],
          detail: "Chi phí gián tiếp: B phải kéo dữ liệu của mình từ RAM vào cache. Thời gian này không nằm trong con số \"context switch mất bao lâu\" nhưng làm B chạy chậm hơn trong những micro giây đầu.",
        },
        {
          note: "B gửi phản hồi rồi gọi `read()` chờ request kế tiếp: chưa có dữ liệu, B tự nhường CPU.",
          msgs: [["B", "K", "read() → chờ"], ["K", "A", "nạp context A", "ok"]],
          set: { B: "blocked (voluntary)", A: "running", K: "ready: —", CPU: "chạy A · cache: lẫn A, B" },
          good: ["A"],
          lesson: "Chi phí trực tiếp của context switch nhỏ; chi phí lớn là cache và TLB lạnh. Đếm số lần chuyển bằng `vmstat` (cột `cs`) và `voluntary_ctxt_switches` / `nonvoluntary_ctxt_switches`.",
          detail: "Đây là context switch **voluntary**: B không còn gì làm. A quay lại nhưng một phần cache đã bị B thay; A cũng chịu miss. Server có hàng nghìn thread chờ I/O lặp lại vòng này hàng trăm nghìn lần mỗi giây.",
        },
      ],
    },
    {
      name: "Sang process khác",
      steps: [
        {
          note: "A hết time slice; scheduler chọn một process khác.",
          msgs: [["CPU", "K", "timer interrupt", "warn"], ["K", "A", "lưu context A"]],
          set: { A: "ready", CPU: "trong kernel", K: "ready: A" },
          detail: "Phần lưu thanh ghi giống hệt trường hợp hai thread. Khác biệt nằm ở bước tiếp theo.",
        },
        {
          note: "Nạp context của process mới **và đổi bảng trang**.",
          msgs: [["K", "P", "nạp context + đổi page table", "ok"]],
          set: { P: "running", CPU: "chạy P · TLB: bản dịch của A" },
          detail: "Process mới có không gian địa chỉ riêng, nên kernel trỏ CPU sang bảng trang của nó. Bản dịch địa chỉ ảo → vật lý trong TLB là của A, vô nghĩa với P. Cách đơn giản là xoá TLB; phần cứng có ASID thì gắn nhãn process vào từng mục để khỏi xoá.",
        },
        {
          note: "P chạy: TLB miss, cache miss liên tiếp tới khi ấm lại.",
          msgs: [["P", "CPU", "truy cập bộ nhớ"], ["CPU", "K", "TLB miss → đi page table", "warn"]],
          set: { CPU: "chạy P · TLB + cache lạnh" },
          bad: ["CPU"],
          lesson: "Process ↔ process đắt hơn thread ↔ thread vì phải đổi bảng trang; coroutine ↔ coroutine rẻ nhất vì không vào kernel.",
          detail: "Mỗi TLB miss buộc phần cứng hoặc OS đi qua page table trong RAM để tìm bản dịch, thêm vài lần truy cập bộ nhớ cho một lệnh đọc. Đây là lý do server dùng nhiều process đổi CPU qua lại liên tục chạy kém hơn cùng số thread, và kém hơn nhiều so với event loop hay goroutine chuyển trong user space.",
        },
      ],
    },
  ],
});
