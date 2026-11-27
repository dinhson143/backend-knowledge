BK.sim({
  id: "addr-translate",
  title: "Dịch địa chỉ ảo: TLB, page table, page fault",
  topics: ["os-virtual-memory"],
  scenario: "Chương trình đọc biến ở địa chỉ ảo `0x7f3a2c41` (trang ảo `0x7f3a2`, offset `0xc41`). Xem đường đi của một lần đọc trong bốn tình huống: TLB hit, TLB miss, trang chưa từng chạm, trang đã bị đẩy ra swap.",
  context: "Với trang 4 KB, 12 bit thấp (`0xc41`) là offset, giữ nguyên khi dịch; chỉ số trang ảo cần tra. **TLB** là cache bản dịch trong CPU; **Page table** nằm trong RAM, nhiều cấp; **Kernel** chỉ vào cuộc khi có page fault. Để ý số lần phải đi tới RAM hay đĩa trong mỗi tình huống: đó chính là chi phí.",
  nodes: [
    { id: "CPU", x: 100, y: 70, label: "CPU (lệnh load)" },
    { id: "TLB", x: 330, y: 70, label: "TLB" },
    { id: "PT", x: 560, y: 70, label: "Page table (RAM)" },
    { id: "RAM", x: 330, y: 230, label: "RAM: khung trang" },
    { id: "K", x: 560, y: 230, label: "Kernel" },
    { id: "D", x: 730, y: 230, label: "Swap (đĩa)", w: 110 },
  ],
  variants: [
    {
      name: "TLB hit",
      steps: [
        {
          note: "CPU tra trang ảo `0x7f3a2` trong TLB: có.",
          msgs: [["CPU", "TLB", "0x7f3a2?"], ["TLB", "CPU", "khung 0x1b07, quyền rw", "ok"]],
          set: { TLB: "hit ✓" },
          detail: "TLB so trang ảo với các mục đang có (song song, trong phần cứng) và trả khung vật lý cùng quyền truy cập. Phần cứng kiểm quyền luôn ở bước này: ghi vào trang chỉ đọc sẽ bị chặn dù TLB hit.",
        },
        {
          note: "Ghép khung + offset thành địa chỉ vật lý `0x1b07c41`, đọc dữ liệu.",
          msgs: [["CPU", "RAM", "đọc 0x1b07c41"], ["RAM", "CPU", "giá trị", "ok"]],
          set: { CPU: "xong: 1 lần đọc RAM" },
          good: ["CPU"],
          lesson: "TLB hit: dịch địa chỉ gần như miễn phí, chỉ tốn đúng một lần đọc dữ liệu (thường còn trúng cache CPU).",
          detail: "Đây là trường hợp của gần như mọi lần truy cập nhờ locality: đọc liên tiếp trong cùng trang 4 KB chỉ miss TLB ở lần đầu.",
        },
      ],
    },
    {
      name: "TLB miss",
      steps: [
        {
          note: "TLB không có bản dịch cho `0x7f3a2`.",
          msgs: [["CPU", "TLB", "0x7f3a2?"], ["TLB", "CPU", "miss", "warn"]],
          set: { TLB: "miss" },
          detail: "Thường gặp khi truy cập rải trên vùng nhớ lớn (hash table nhiều GB, duyệt mảng theo cột) hoặc ngay sau context switch sang process khác.",
        },
        {
          note: "Phần cứng đi page table nhiều cấp: mỗi cấp một lần đọc RAM.",
          msgs: [["CPU", "PT", "cấp 1 → 2 → 3 → 4"], ["PT", "CPU", "PTE: khung 0x1b07, present", "ok"]],
          set: { PT: "4 lần đọc RAM" },
          bad: ["PT"],
          detail: "Trên x86-64 với 4 cấp, một lần tra đầy đủ cần 4 lần đọc bộ nhớ trước khi được đọc dữ liệu thật. Linux định nghĩa tới 5 cấp (PGD, P4D, PUD, PMD, PTE), cấp nào kiến trúc không dùng thì bị gộp. Các mục page table cũng có thể nằm trong cache CPU nên không phải lần nào cũng chạm RAM.",
        },
        {
          note: "Nạp bản dịch vào TLB rồi đọc dữ liệu.",
          msgs: [["CPU", "TLB", "nạp mục mới"], ["CPU", "RAM", "đọc 0x1b07c41"], ["RAM", "CPU", "giá trị", "ok"]],
          set: { TLB: "có 0x7f3a2", CPU: "xong: ~5 lần đọc bộ nhớ" },
          lesson: "TLB miss đắt vì phải đi page table; huge page (2 MB) giảm miss vì một mục TLB phủ vùng lớn hơn 512 lần.",
          detail: "Lần sau đọc trong cùng trang sẽ hit. Nếu TLB đầy, một mục cũ bị đẩy ra.",
        },
      ],
    },
    {
      name: "Page fault: chạm lần đầu",
      steps: [
        {
          note: "Vừa `malloc` 1 GB. Đọc trang chưa từng chạm: TLB miss, PTE không present.",
          msgs: [["CPU", "TLB", "0x7f3a2?"], ["TLB", "CPU", "miss", "warn"], ["CPU", "PT", "tra"], ["PT", "CPU", "không present", "err"]],
          set: { PT: "vùng hợp lệ, chưa có khung" },
          detail: "`malloc` lớn chỉ map vùng ảo; kernel chưa cấp khung vật lý nào. RSS chưa tăng. Phần cứng không tự xử lý được, nên ngắt.",
        },
        {
          note: "CPU báo page fault. Kernel kiểm: địa chỉ thuộc vùng đã map, quyền đúng → cấp một khung trống.",
          msgs: [["CPU", "K", "page fault", "warn"], ["K", "RAM", "lấy khung trống, ghi 0"], ["K", "PT", "PTE → khung 0x2c10, present", "ok"]],
          set: { K: "minor fault", RAM: "khung 0x2c10 mới", PT: "present" },
          detail: "Đây là **minor fault**: không có I/O, chỉ tốn thời gian chạy handler trong kernel. Nếu địa chỉ không thuộc vùng nào đã map hoặc sai quyền, kernel gửi `SIGSEGV` thay vì cấp khung.",
        },
        {
          note: "Kernel trả về; CPU chạy lại đúng lệnh load đó.",
          msgs: [["K", "CPU", "chạy lại lệnh", "ok"], ["CPU", "RAM", "đọc"], ["RAM", "CPU", "0", "ok"]],
          set: { CPU: "xong (chậm hơn: có fault)" },
          good: ["CPU"],
          lesson: "Page fault không phải lỗi: kernel cấp RAM lười, chỉ khi trang thật sự được chạm tới. RSS tăng theo trang được chạm, không theo `malloc`.",
          detail: "Chương trình không hề biết có fault. Cùng cơ chế này phục vụ copy-on-write sau `fork`: ghi vào trang chung thì fault, kernel chép trang rồi cho ghi tiếp.",
        },
      ],
    },
    {
      name: "Page fault: trang ở swap",
      steps: [
        {
          note: "RAM đã thiếu từ trước; kernel đẩy trang này ra swap. Giờ chương trình đọc lại nó.",
          msgs: [["CPU", "TLB", "0x7f3a2?"], ["TLB", "CPU", "miss", "warn"], ["CPU", "PT", "tra"], ["PT", "CPU", "không present, ở swap", "err"]],
          set: { PT: "PTE ghi vị trí trên swap" },
          detail: "Khi trang bị đẩy ra, kernel ghi vị trí của nó trên đĩa vào chính PTE (bit present = 0), để lúc cần biết đọc lại ở đâu.",
        },
        {
          note: "Page fault. Kernel cần một khung trống: phải đẩy trang khác ra trước, rồi đọc trang này từ đĩa.",
          msgs: [["CPU", "K", "page fault", "warn"], ["K", "D", "đọc trang (I/O)"], { par: [["D", "K", "… chờ đĩa …", "warn"], ["K", "RAM", "đẩy trang khác ra"]] }],
          set: { K: "major fault ⏳", D: "đang đọc" },
          bad: ["K", "CPU"],
          detail: "Đây là **major fault**: thread bị chặn chờ I/O, kernel chạy việc khác trong lúc đó. RAM cỡ 100 ns, đĩa cỡ micro giây (SSD) tới mili giây (HDD), nên một lần fault tốn bằng hàng chục nghìn lần đọc RAM. Nếu RAM thiếu kéo dài, trang vừa đẩy ra lại sớm bị cần: thrashing.",
        },
        {
          note: "Trang về RAM, cập nhật PTE, chạy lại lệnh.",
          msgs: [["D", "RAM", "dữ liệu trang", "ok"], ["K", "PT", "present, khung 0x3a01", "ok"], ["K", "CPU", "chạy lại lệnh", "ok"]],
          set: { CPU: "xong: chậm nhiều bậc", PT: "present" },
          lesson: "Major fault là chỗ virtual memory làm hỏng latency: theo dõi `si`/`so` trong `vmstat` và major fault; service cần latency thấp phải có đủ RAM.",
          detail: "Request nào chạm trang bị swap sẽ chậm bất thường, nên swap thường lộ ra ở latency p99 trước khi thấy ở trung bình.",
        },
      ],
    },
  ],
});
