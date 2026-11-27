BK.topic({
  id: "os-virtual-memory",
  track: "cs",
  section: "cs-os",
  title: "Virtual Memory & Paging",
  goal: "Giải thích page fault, TLB, swap và tác động lên latency",
  needs: ["os-memory-layout"],
  tldr: {
    t: "Mỗi process thấy một không gian địa chỉ **ảo** riêng. Bộ nhớ chia thành trang (thường 4 KB); **page table** của process ánh xạ trang ảo sang khung trang vật lý, MMU dịch địa chỉ ở mỗi lần truy cập, **TLB** cache các bản dịch vừa dùng. Trang chưa có trong RAM thì CPU báo **page fault** để kernel xử lý: minor fault (chỉ cần cấp hoặc gắn trang, không I/O) rẻ; major fault (đọc từ đĩa hoặc swap) đắt gấp hàng chục nghìn lần một lần đọc RAM.",
    why: "Virtual memory cho ba thứ cùng lúc: cô lập (process không thể tạo ra địa chỉ trỏ vào bộ nhớ của process khác), sự tiện lợi (mọi process đều có không gian liên tục bắt đầu từ cùng một chỗ) và dùng RAM hiệu quả (chỉ trang thật sự chạm tới mới cần RAM) (OSTEP, Address Spaces — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf). Cái giá là mỗi lần truy cập bộ nhớ phải dịch địa chỉ, và TLB tồn tại để bản dịch đó gần như miễn phí khi hit.",
  },
  story: {
    problem: "Không có virtual memory, mọi chương trình dùng thẳng địa chỉ vật lý: một con trỏ hỏng ghi đè được kernel hay process khác, hai chương trình không thể cùng nạp ở một địa chỉ, và chương trình cần nhiều bộ nhớ hơn RAM thì không chạy được.",
    idea: "Thêm một tầng gián tiếp: chương trình chỉ thấy địa chỉ ảo, phần cứng dịch sang địa chỉ vật lý qua bảng do kernel quản lý. Kernel có thể map trang ở đâu tuỳ ý, chia sẻ trang (thư viện, copy-on-write), cấp trang lười (chỉ khi chạm vào), hoặc đẩy trang ít dùng ra đĩa.",
    tradeoff: "Mỗi lần truy cập bộ nhớ cần dịch địa chỉ; nếu không có TLB, mỗi lần đọc thành nhiều lần đọc RAM (đi qua page table). Khi bộ nhớ thật không đủ, swap biến truy cập RAM cỡ 100 ns thành truy cập đĩa cỡ mili giây, và hệ thống có thể thrash.",
  },
  diagrams: [
    {
      src: "content/svg/os-virtual-memory-walk.svg",
      caption: "TLB hit thì có ngay khung vật lý; miss thì MMU đi page table qua từng cấp PGD → P4D → PUD → PMD → PTE, mỗi cấp một lần đọc bộ nhớ. Mục không present hoặc sai quyền gây page fault: kernel cấp khung, đọc lại từ swap, hoặc gửi SIGSEGV. Độ rộng địa chỉ x86-64 theo https://docs.kernel.org/arch/x86/x86_64/mm.html; OSTEP vm-paging, vm-tlbs.",
      source: "https://docs.kernel.org/mm/page_tables.html",
    },
  ],
  table: {
    head: ["Khái niệm", "Là gì", "Vì sao quan trọng"],
    rows: [
      {
        cells: ["Trang (page) và khung (frame)", "Đơn vị ánh xạ, thường 4 KB. Địa chỉ ảo = số trang ảo + offset trong trang", "Ánh xạ theo trang thay vì theo byte nên page table nhỏ hơn hàng nghìn lần"],
        why: "Với trang 4 KB, 12 bit thấp của địa chỉ là offset và giữ nguyên khi dịch; chỉ phần số trang cần tra bảng (https://docs.kernel.org/mm/page_tables.html). Trang nhỏ thì bảng lớn; trang lớn thì phí bộ nhớ khi chỉ dùng một phần trang.",
      },
      {
        cells: ["Page table", "Bảng của mỗi process: trang ảo → khung vật lý + các bit (valid/present, quyền đọc ghi thực thi, dirty, accessed)", "Kernel cưỡng chế cô lập và quyền bằng các bit này"],
        why: "Bit valid cho phép không gian địa chỉ thưa (vùng chưa dùng không cần khung); bit present cho biết trang đang ở RAM hay ở đĩa; dirty cho biết trang đã bị sửa, nên khi đẩy ra phải ghi lại; accessed giúp chọn trang ít dùng để đẩy ra (OSTEP, Paging — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf).",
      },
      {
        cells: ["Page table nhiều cấp", "Linux định nghĩa tới 5 cấp: PGD → P4D → PUD → PMD → PTE; kiến trúc không dùng cấp nào thì cấp đó bị gộp", "Không gian 64-bit mà một bảng phẳng thì quá lớn để giữ cho mỗi process"],
        why: "Bảng nhiều cấp chỉ cấp phát những nhánh có dùng, nên vùng ảo trống khổng lồ giữa heap và stack không tốn bảng. Đổi lại, một lần tra đầy đủ phải đi qua nhiều cấp, mỗi cấp là một lần đọc bộ nhớ (https://docs.kernel.org/mm/page_tables.html).",
      },
      {
        cells: ["TLB", "Cache phần cứng nhỏ trong CPU giữ các bản dịch trang ảo → khung vừa dùng", "Hit thì dịch gần như miễn phí; miss thì phải đi page table"],
        why: "Không có TLB, mỗi lệnh đọc bộ nhớ cần thêm ít nhất một lần đọc page table, làm chương trình chậm đi nhiều lần (OSTEP, vm-paging, mục \"Paging: also too slow\"). TLB hit cao nhờ locality: truy cập liên tiếp trong cùng trang 4 KB chỉ miss ở lần đầu (OSTEP, TLBs — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf).",
      },
      {
        cells: ["Huge page", "Trang 2 MB hoặc 1 GB, được map thẳng ở cấp PMD hoặc PUD", "Một mục TLB phủ vùng lớn hơn 512 lần (2 MB so với 4 KB)"],
        why: "Database và JVM heap lớn hay bị TLB miss vì truy cập rải trên nhiều GB. Huge page giảm áp lực TLB và giảm kích thước page table; đổi lại có thể phí bộ nhớ và khó cấp phát vì cần vùng vật lý liên tục (https://docs.kernel.org/mm/page_tables.html).",
      },
    ],
  },
  points: [
    {
      t: "**Page fault không phải lỗi** — đó là cơ chế: CPU không tìm được bản dịch hợp lệ thì ngắt, kernel chạy handler để quyết định. Ba trường hợp thường gặp: cấp trang lười lần đầu chạm vào, copy-on-write sau `fork`, và trang đã bị đẩy ra swap.",
      why: "Kernel cố ý trì hoãn việc cấp RAM tới lúc thật sự cần, nên `malloc(1 GB)` trả về ngay mà RSS chưa tăng; trang chưa dùng mà bị đọc thì được gắn vào một trang vật lý dùng chung toàn số 0, chỉ khi ghi lần đầu mới được cấp khung riêng (https://docs.kernel.org/admin-guide/mm/concepts.html). Chỉ khi truy cập không được phép (không map, sai quyền) thì kernel mới gửi `SIGSEGV` (https://docs.kernel.org/mm/page_tables.html).",
    },
    {
      t: "**Minor và major fault** — minor: xử lý không cần I/O (cấp trang mới, gắn trang đã có trong page cache). Major: phải đọc từ đĩa (swap, hoặc file được map chưa có trong page cache). Đếm bằng `ru_minflt` / `ru_majflt` trong `getrusage`, cột `min_flt`/`maj_flt` của `ps -o`, hoặc `/usr/bin/time -v`.",
      why: "Hai loại chênh nhau vài bậc độ lớn vì major fault chờ thiết bị lưu trữ (getrusage(2) — https://man7.org/linux/man-pages/man2/getrusage.2.html). Major fault tăng đột biến trên server là dấu hiệu bộ nhớ không đủ, không phải CPU yếu.",
    },
    {
      t: "**Swap và latency** — OSTEP tính: RAM cỡ 100 ns, đĩa (HDD) cỡ 10 ms; chỉ cần 10% truy cập phải đi đĩa thì thời gian truy cập trung bình thành khoảng 1 ms, chậm gần 10.000 lần. Con số đĩa trong ví dụ là của HDD; SSD nhanh hơn nhưng vẫn là thiết bị I/O, nên major fault vẫn đắt hơn hẳn một lần đọc RAM.",
      why: "Chi phí đĩa lớn tới mức một tỉ lệ miss rất nhỏ cũng chi phối toàn bộ (OSTEP, Beyond Physical Memory: Policies — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf). Vì vậy service cần latency thấp (Redis, database, Kafka broker) thường tắt hoặc hạn chế swap và cấp đủ RAM; swap chỉ là lưới an toàn chứ không phải RAM rẻ.",
    },
    {
      t: "**Thrashing** — tổng working set của các process lớn hơn RAM: hệ thống liên tục đẩy trang ra rồi nạp lại, CPU gần như rảnh mà không việc gì xong. Linux khi hết cách giải phóng bộ nhớ thì gọi **OOM killer** giết một process tốn nhiều bộ nhớ.",
      why: "Mỗi process vừa được nạp trang thì trang của process khác bị đẩy ra, nên không ai đủ trang để chạy tiếp (OSTEP, vm-beyondphys-policy, mục Thrashing). OOM killer là cách giải thô: giảm áp lực bộ nhớ ngay nhưng có thể giết đúng service quan trọng (https://docs.kernel.org/mm/page_tables.html). Trong Kubernetes, container dùng quá memory limit sẽ bị kết thúc với lý do `OOMKilled` (exit code 137) và được kubelet khởi động lại nếu có thể (https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/).",
    },
    {
      t: "**VSZ và RSS** — VSZ (`VmSize`) là tổng không gian ảo đã map, RSS (`VmRSS`) là phần đang thật sự nằm trong RAM. Một process Java hay Go có VSZ hàng chục GB mà RSS vài trăm MB là bình thường.",
      why: "Map vùng ảo gần như miễn phí (dành chỗ cho heap, stack thread, thư viện), RAM chỉ bị dùng khi trang được chạm tới. Theo dõi RSS (và major fault), không theo dõi VSZ, khi tìm leak hay đặt memory limit (proc_pid_status(5) — https://man7.org/linux/man-pages/man5/proc_pid_status.5.html).",
    },
    {
      t: "**Page cache** — kernel dùng RAM rảnh để cache nội dung file. `read()` file vừa đọc lần hai không chạm đĩa; `free -h` hiện phần này ở cột `buff/cache`, và nó được trả lại khi app cần RAM.",
      why: "RAM rảnh là RAM phí, nên kernel tận dụng làm cache. Đây là lý do Kafka dựa vào page cache thay vì tự cache trong JVM heap: tránh lưu hai lần, tránh overhead object và GC, và cache vẫn ấm khi broker restart (https://kafka.apache.org/42/design/design/), và lý do \"RAM gần đầy\" trên server Linux thường không phải vấn đề (phần lớn là cache, nhả được).",
    },
  ],
  sections: [
    {
      title: "Tác động thực tế lên backend",
      table: {
        head: ["Hiện tượng", "Nguyên nhân ở tầng virtual memory", "Làm gì"],
        rows: [
          {
            cells: ["Request đầu tiên sau deploy chậm", "Code, thư viện, dữ liệu chưa nằm trong RAM: major fault khi đọc file thực thi và file dữ liệu; heap mới chạm lần đầu: minor fault", "Warm-up trước khi nhận traffic (chạy request mẫu, đọc trước dữ liệu nóng)"],
            why: "Kernel nạp trang lười: `exec` chỉ map file, trang code được đọc khi lần đầu chạy tới. Readiness probe nên đợi warm-up xong.",
          },
          {
            cells: ["Latency p99 tăng vọt dù CPU thấp", "Swap: trang của process bị đẩy ra, request chạm vào phải chờ đĩa", "Kiểm `vmstat 1` (cột `si`/`so` khác 0 là đang swap), tăng RAM hoặc giảm bộ nhớ dùng"],
            why: "`si`/`so` là lượng bộ nhớ swap vào/ra mỗi giây (vmstat(8) — https://man7.org/linux/man-pages/man8/vmstat.8.html). Swap làm chậm từng request ngẫu nhiên nên lộ ra ở p99 trước khi thấy ở trung bình.",
          },
          {
            cells: ["`fork` của Redis khi snapshot làm bộ nhớ tăng", "Copy-on-write: con dùng chung trang với cha; cha tiếp tục ghi thì mỗi trang bị ghi được chép", "Dành RAM dư cho lúc snapshot, theo dõi tỉ lệ ghi trong lúc snapshot"],
            why: "Redis snapshot bằng cách `fork` rồi để con ghi file RDB, dựa vào copy-on-write (https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/); trang chỉ bị chép khi một bên ghi (fork(2) — https://man7.org/linux/man-pages/man2/fork.2.html). Ghi nhiều trong lúc snapshot thì tiến tới chép gần hết dữ liệu, có thể gấp đôi bộ nhớ.",
          },
          {
            cells: ["Container bị OOM kill dù heap app nhỏ", "Memory limit tính mọi trang của process, không chỉ heap: stack các thread, bộ nhớ native, metaspace, buffer ngoài heap", "Đặt heap thấp hơn limit một khoảng, theo dõi RSS chứ không chỉ heap"],
            why: "Runtime chỉ báo phần heap nó quản lý; kernel đếm mọi trang của process. Ví dụ JVM `-Xmx` bằng đúng limit gần như chắc chắn bị OOM kill.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"vì sao mỗi process tưởng mình có cả bộ nhớ?\" trả lời theo đường đi của một địa chỉ: địa chỉ ảo → TLB (hit thì xong) → miss thì đi page table → không present thì page fault → kernel cấp trang hoặc đọc từ đĩa → cập nhật bảng, chạy lại lệnh.",
      why: "Kể theo đường đi cho thấy bạn biết **ai** làm gì (phần cứng dịch, kernel xử lý fault) và **chỗ nào đắt** (miss, fault đĩa). Interviewer thường hỏi tiếp \"page fault có phải lỗi không?\" — câu trả lời là không.",
    },
    {
      t: "Khi bàn hiệu năng của database hoặc cache trong system design, nói một câu về bộ nhớ: \"dữ liệu nóng phải nằm trong RAM, tắt swap, theo dõi major fault\".",
      why: "Nối kiến thức OS với quyết định thiết kế là điều phân biệt kỹ sư backend với người chỉ học thuộc. Đây cũng là lý do bảng Numbers to know có cột RAM và đĩa cách nhau nhiều bậc.",
    },
    "Nếu được hỏi về huge page: nói lợi ích (ít TLB miss cho heap lớn) và rủi ro (phí bộ nhớ, khó cấp phát). Không cần nhớ chi tiết cấu hình.",
  ],
  related: ["addr-translate"],
  cards: [
    ["Page fault có phải lỗi không?", "Không. Đó là ngắt để kernel xử lý trang chưa sẵn sàng: cấp trang lười, copy-on-write, hoặc nạp từ swap. Chỉ truy cập không hợp lệ mới thành `SIGSEGV`."],
    ["Minor và major page fault khác nhau thế nào?", "Minor: xử lý không cần I/O (cấp trang, gắn trang có sẵn trong page cache). Major: phải đọc từ đĩa, chậm hơn nhiều bậc."],
    ["TLB để làm gì?", "Cache các bản dịch địa chỉ ảo → vật lý vừa dùng. Hit thì dịch gần như miễn phí; miss thì phải đi page table trong RAM."],
    ["Vì sao page table có nhiều cấp?", "Không gian 64-bit rất thưa; bảng phẳng cho mỗi process quá lớn. Nhiều cấp chỉ cấp những nhánh có dùng, đổi lại tra một lần tốn nhiều lần đọc bộ nhớ."],
    ["Vì sao swap làm latency p99 xấu đi nhiều?", "Truy cập RAM cỡ 100 ns, đĩa cỡ mili giây; một tỉ lệ nhỏ truy cập phải chờ đĩa đã chi phối thời gian trung bình và làm vài request ngẫu nhiên rất chậm."],
    ["VSZ lớn mà RSS nhỏ có phải leak không?", "Không. VSZ là vùng ảo đã map (gần như miễn phí); RSS là RAM thật đang dùng. Theo dõi RSS và major fault."],
    ["Thrashing là gì?", "Working set của các process vượt RAM; hệ thống liên tục đẩy trang ra rồi nạp lại, không việc gì tiến triển. Linux có thể gọi OOM killer để giải phóng bộ nhớ."],
  ],
});
