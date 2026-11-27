BK.topic({
  id: "os-memory-layout",
  track: "cs",
  section: "cs-os",
  title: "Stack & heap",
  goal: "Biết biến nằm ở stack hay heap và vì sao đệ quy sâu tràn stack",
  tldr: {
    t: "Không gian địa chỉ của một process chia thành vùng: **text** (code), **data/bss** (biến global), **heap** (cấp phát động, sống tới khi được giải phóng), vùng **mmap** (thư viện, file map), và **stack** (frame của các hàm đang gọi). Stack cấp và trả tự động theo lời gọi hàm, cực rẻ nhưng nhỏ và có giới hạn cứng; heap linh hoạt nhưng phải có người dọn (bạn, hoặc GC). Đệ quy quá sâu làm stack chạm giới hạn và process nhận `SIGSEGV` (hoặc runtime báo `StackOverflowError`, `RecursionError`).",
    why: "Stack rẻ vì cấp phát chỉ là dịch con trỏ stack khi vào hàm và dịch ngược khi ra, theo đúng thứ tự LIFO của lời gọi hàm; không cần tìm chỗ trống hay ghi sổ (OSTEP, Memory API — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-api.pdf). Đổi lại, dữ liệu trên stack chết khi hàm trả về, nên thứ gì cần sống lâu hơn lời gọi hàm (trả về cho caller, chia sẻ giữa thread) phải lên heap.",
  },
  story: {
    problem: "Hàm duyệt cây chạy tốt khi test, nhưng production gặp một cây lệch sâu 100.000 tầng: Java ném `StackOverflowError`, Python ném `RecursionError`, chương trình C thì chết vì segfault. Ở chỗ khác, service chạy vài ngày thì RSS tăng dần tới khi bị OOM kill: heap rò rỉ.",
    idea: "Biết mỗi loại dữ liệu nằm đâu và sống bao lâu. Stack cho dữ liệu sống trong một lời gọi hàm, kích thước biết trước; heap cho dữ liệu sống lâu hoặc lớn. Đệ quy không giới hạn độ sâu thì đổi sang vòng lặp với stack tường minh trên heap.",
    tradeoff: "Heap cấp phát chậm hơn (phải tìm khối trống, có thể phân mảnh) và phải được dọn: tự `free` thì dễ leak hoặc dùng sau khi giải phóng; GC thì có pause và tốn CPU. Stack nhanh nhưng giới hạn kích thước và không sống qua lời gọi hàm.",
  },
  diagrams: [
    {
      src: "content/svg/os-memory-layout-regions.svg",
      caption: "Từ địa chỉ thấp lên cao: text, data/BSS, heap mọc lên, vùng mmap (thư viện `.so`, stack thread phụ), stack thread chính mọc xuống, trên cùng là kernel space. Bên phải là các dòng `/proc/<pid>/maps` tương ứng, lấy từ ví dụ trong proc_pid_maps(5); kernel space theo OSTEP (Linux VM — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-complete.pdf).",
      source: "https://man7.org/linux/man-pages/man5/proc_pid_maps.5.html",
    },
  ],
  table: {
    head: ["Vùng", "Chứa gì", "Sống bao lâu"],
    rows: [
      {
        cells: ["Text", "Mã máy của chương trình và thư viện liên kết tĩnh", "Suốt đời process; chỉ đọc + thực thi"],
        why: "Đánh dấu chỉ đọc để lỗi ghi nhầm vào code bị bắt ngay (segfault) thay vì âm thầm sửa chương trình; nhiều process chạy cùng binary có thể dùng chung các trang này. Trong `/proc/<pid>/maps`, dòng có quyền `r-xp` là vùng code (proc_pid_maps(5) — https://man7.org/linux/man-pages/man5/proc_pid_maps.5.html).",
      },
      {
        cells: ["Data / BSS", "Biến global và `static`: có giá trị khởi tạo (data) hoặc khởi tạo 0 (bss)", "Suốt đời process"],
        why: "Kích thước biết lúc biên dịch nên nạp một lần khi `exec`. BSS không chiếm chỗ trong file thực thi vì chỉ cần ghi \"cần N byte toàn 0\".",
      },
      {
        cells: ["Heap", "Vùng cấp phát động: `malloc`/`new`, object trong Java, Python, JS", "Tới khi `free` hoặc GC thu hồi"],
        why: "Dùng khi kích thước chỉ biết lúc chạy hoặc dữ liệu phải sống lâu hơn hàm tạo ra nó. Bộ cấp phát phải tìm khối đủ lớn và ghi lại khối nào đang dùng, nên chậm hơn stack nhiều lần và có thể phân mảnh. Dòng `[heap]` trong `/proc/<pid>/maps`.",
      },
      {
        cells: ["Vùng mmap", "Thư viện dùng chung (`.so`), file được map, khối cấp phát lớn, stack của thread phụ", "Tới khi `munmap`"],
        why: "Bộ cấp phát thường lấy khối lớn bằng `mmap` riêng để trả thẳng về OS khi giải phóng. Stack của các thread không phải thread chính cũng được cấp ở vùng này, mỗi thread một khối.",
      },
      {
        cells: ["Stack", "Frame của mỗi lời gọi hàm: tham số, biến cục bộ, địa chỉ trả về", "Tới khi hàm trả về"],
        why: "Mỗi lời gọi đẩy một frame, mỗi lần trả về bóc frame ra: đúng thứ tự LIFO nên chỉ cần một con trỏ. Mỗi thread có stack riêng; dòng `[stack]` trong maps là stack của thread chính.",
      },
    ],
  },
  points: [
    {
      t: "**Ví dụ một dòng C**: `int *p = malloc(sizeof(int));` — biến con trỏ `p` nằm trên stack, vùng 4 byte nó trỏ tới nằm trên heap. Hàm trả về thì `p` mất, vùng heap vẫn còn; không ai `free` là leak.",
      why: "Dòng này cấp phát ở cả hai nơi: compiler dành chỗ cho `p` trong frame, `malloc` xin chỗ trên heap (OSTEP, vm-api). Phân biệt \"biến\" và \"thứ biến trỏ tới\" là chìa khoá để trả lời mọi câu \"nằm ở đâu\".",
    },
    {
      t: "**Vì sao đệ quy sâu tràn stack** — mỗi tầng đệ quy thêm một frame. Stack có giới hạn (`RLIMIT_STACK`, xem bằng `ulimit -s`); chạm giới hạn thì kernel gửi `SIGSEGV`.",
      why: "Stack phải là một vùng liên tục có cận trên để không đè lên vùng khác, nên kernel đặt giới hạn cứng; vượt giới hạn là truy cập trang không được map (getrlimit(2) — https://man7.org/linux/man-pages/man2/getrlimit.2.html). Muốn xử lý được chính signal đó thì handler phải chạy trên stack khác (`sigaltstack`), vì stack hiện tại đã hết chỗ.",
    },
    {
      t: "**Cách sửa đệ quy sâu** — đổi sang vòng lặp với stack/queue tường minh (DFS bằng `deque`, `ArrayDeque`); hoặc dùng thuật toán không cần đệ quy. Tăng giới hạn (`-Xss`, `sys.setrecursionlimit`, `ulimit -s`) chỉ là chữa cháy.",
      why: "Stack tường minh nằm trên heap, giới hạn bởi RAM chứ không bởi vài MB của stack thread. Tăng giới hạn vẫn hỏng với input lớn hơn, và tài liệu Python cảnh báo đặt quá cao có thể làm interpreter crash (https://docs.python.org/3/library/sys.html#sys.setrecursionlimit).",
    },
    {
      t: "**Stack của thread phụ nhỏ hơn bạn nghĩ** — pthread lấy kích thước mặc định theo `RLIMIT_STACK` (2 MB trên đa số kiến trúc nếu limit là unlimited); JVM đặt bằng `-Xss` (1024 KB trên Linux/x64). Đệ quy chạy được ở thread chính có thể tràn ở thread trong pool.",
      why: "Mỗi thread cần stack riêng, nên runtime không thể cho mỗi thread một stack lớn mà không ngốn không gian địa chỉ (pthread_create(3) — https://man7.org/linux/man-pages/man3/pthread_create.3.html; java — https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html).",
    },
    {
      t: "**Lỗi hay gặp với heap** — quên giải phóng (leak), dùng sau khi giải phóng (use-after-free), giải phóng hai lần, trả về con trỏ tới biến cục bộ (dangling pointer).",
      why: "Heap không có thứ tự tự nhiên như stack, nên ai giải phóng và khi nào là việc của người lập trình (C/C++) hoặc GC. Con trỏ tới biến cục bộ hỏng vì frame chứa nó bị dùng lại ngay ở lời gọi hàm tiếp theo (OSTEP, vm-api). Ngôn ngữ có GC loại được use-after-free và double free, nhưng vẫn leak nếu còn giữ tham chiếu không dùng (cache không giới hạn, listener không gỡ).",
    },
    {
      t: "**Xem trên Linux** — `cat /proc/<pid>/maps` liệt kê từng vùng kèm quyền; `/proc/<pid>/status` có `VmStk` (stack), `VmData` (data + heap), `VmRSS` (RAM thật đang dùng); `pmap -x <pid>` tổng hợp theo vùng.",
      why: "Dùng để trả lời \"bộ nhớ tăng ở đâu\": RSS tăng mà `[heap]` và các vùng anonymous tăng theo là leak heap; số vùng mmap cỡ thread-stack tăng là leak thread (proc_pid_status(5) — https://man7.org/linux/man-pages/man5/proc_pid_status.5.html).",
    },
  ],
  sections: [
    {
      title: "Mỗi ngôn ngữ đặt dữ liệu ở đâu",
      table: {
        head: ["Ngôn ngữ", "Stack chứa", "Heap chứa", "Tràn stack thì"],
        rows: [
          {
            cells: ["C / C++", "Biến cục bộ, mảng cố định, struct theo giá trị", "Mọi thứ cấp bằng `malloc`/`new`", "`SIGSEGV`, process chết"],
            why: "Không có runtime kiểm tra độ sâu; chạm giới hạn là chạm trang không map và kernel gửi `SIGSEGV`.",
          },
          {
            cells: ["Java", "Biến cục bộ kiểu nguyên thuỷ và **tham chiếu**", "Mọi object, mọi mảng", "`StackOverflowError` (bắt được, nhưng thường không nên)"],
            why: "Biến `List<String> xs` trong hàm chỉ là một tham chiếu trên stack; object `ArrayList` nằm trên heap do GC quản lý. Kích thước stack mỗi thread chỉnh bằng `-Xss`.",
          },
          {
            cells: ["Go", "Biến không \"thoát\" khỏi hàm (compiler chứng minh được)", "Biến bị lấy địa chỉ và còn dùng sau khi hàm trả về, biến rất lớn", "Stack goroutine tự lớn; vượt giới hạn tối đa (mặc định 1 GB trên 64-bit) thì chương trình crash"],
            why: "Go dùng escape analysis: nếu compiler không chứng minh được biến hết dùng khi hàm trả về thì đặt nó lên heap để tránh dangling pointer (Go FAQ — https://go.dev/doc/faq#stack_or_heap). Xem quyết định bằng `go build -gcflags=-m`. Giới hạn stack: `debug.SetMaxStack` (https://pkg.go.dev/runtime/debug#SetMaxStack).",
          },
          {
            cells: ["Python (CPython)", "Không có khái niệm cho người dùng; frame của interpreter", "Mọi object (kể cả `int`)", "`RecursionError` khi vượt giới hạn độ sâu (mặc định 1000)"],
            why: "Giới hạn độ sâu tồn tại để đệ quy vô hạn không làm tràn C stack của chính interpreter và làm Python crash (https://docs.python.org/3/library/sys.html#sys.getrecursionlimit). `sys.getrecursionlimit()` trả 1000 trên bản CPython 3.14 chuẩn.",
          },
          {
            cells: ["JavaScript (Node / V8)", "Frame của hàm", "Object, closure, mảng", "`RangeError: Maximum call stack size exceeded`"],
            why: "Engine kiểm tra độ sâu và ném exception thay vì để process segfault. Độ sâu tối đa phụ thuộc kích thước frame, không phải một con số cố định.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi được hỏi \"object này nằm ở đâu\", tách hai phần: biến (tham chiếu/con trỏ) và thứ nó trỏ tới. Trong Java/Python/JS câu trả lời gần như luôn là \"tham chiếu trên stack, object trên heap\".",
      why: "Câu sai phổ biến là \"object nhỏ nằm trên stack\" với Java/Python. Phân biệt rõ cho thấy bạn hiểu mô hình bộ nhớ, và mở đường nói tiếp về escape analysis (Go) nếu interviewer hỏi sâu.",
    },
    {
      t: "Viết DFS trong vòng coding: nói luôn \"đệ quy gọn, nhưng nếu cây có thể sâu 10⁵ tầng thì tôi viết bằng stack tường minh\".",
      why: "Một câu thể hiện bạn biết giới hạn stack mà không tốn thời gian. Với Python, mặc định 1000 tầng là đủ để fail test case cây lệch.",
    },
    "Leak trong ngôn ngữ có GC: tìm thứ **còn được tham chiếu** nhưng không còn dùng (map làm cache không giới hạn, listener không gỡ, thread-local trong pool), không phải thứ quên `free`.",
  ],
  cards: [
    ["Vì sao cấp phát trên stack nhanh hơn heap?", "Chỉ dịch con trỏ stack khi vào/ra hàm (LIFO). Heap phải tìm khối trống, ghi sổ, có thể phân mảnh, và phải được giải phóng."],
    ["`int *p = malloc(4);` trong một hàm: cái gì ở stack, cái gì ở heap?", "Biến `p` ở stack (trong frame của hàm), 4 byte nó trỏ tới ở heap. Hàm trả về mà không `free` là leak."],
    ["Vì sao đệ quy sâu làm chương trình C bị segfault?", "Mỗi tầng thêm một frame; stack chạm `RLIMIT_STACK` thì truy cập trang không được map và kernel gửi `SIGSEGV`."],
    ["Trong Java, `List<String> xs = new ArrayList<>()` nằm ở đâu?", "Tham chiếu `xs` trên stack của thread; object `ArrayList` trên heap."],
    ["Go quyết định biến nằm stack hay heap thế nào?", "Escape analysis: compiler không chứng minh được biến hết dùng khi hàm trả về (ví dụ trả về con trỏ tới nó) thì đặt lên heap. Xem bằng `go build -gcflags=-m`."],
    ["Sửa `RecursionError` cho DFS trên cây sâu thế nào cho bền?", "Viết lại bằng vòng lặp với stack tường minh (list/deque trên heap). Tăng `setrecursionlimit` chỉ dời lỗi và có thể làm interpreter crash."],
    ["Ngôn ngữ có GC vẫn leak bộ nhớ vì sao?", "GC chỉ thu hồi thứ không còn ai tham chiếu. Cache không giới hạn, listener không gỡ, collection static giữ object mãi thì GC không dọn được."],
  ],
});
