BK.topic({
  id: "conc-memory-model",
  track: "cs",
  section: "cs-os",
  title: "Memory Model & Happens-before",
  goal: "Giải thích visibility, reordering và volatile đảm bảo gì",
  needs: ["conc-atomic-cas"],
  tldr: {
    t: "**Memory model** (mô hình bộ nhớ của ngôn ngữ) là bộ luật trả lời: một lần đọc biến dùng chung **được phép thấy** lần ghi nào. Compiler và CPU được đổi thứ tự lệnh và giữ giá trị trong register/cache, nên không có đồng bộ thì thread khác có thể **không thấy** giá trị mới (visibility) hoặc thấy các lần ghi **sai thứ tự** (reordering). Công cụ để nói \"chắc chắn thấy\" là **happens-before**: nếu A happens-before B thì B thấy mọi thứ A đã ghi. Lock, `volatile`, atomic, channel, `Thread.start`/`join` là các cách tạo cạnh happens-before.",
    why: "JLS §17.4.5: \"nếu một hành động happens-before hành động khác thì hành động đầu được thấy bởi và xếp trước hành động sau\" (https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html). Ngược lại, hai truy cập cùng biến (ít nhất một ghi) không có quan hệ happens-before là **data race**, và mọi đảm bảo \"chạy như thể tuần tự\" biến mất.",
  },
  story: {
    problem: "Thread A gán `config = load()` rồi đặt cờ `ready = true`. Thread B vòng `while (!ready) {}` rồi đọc `config`. Trên laptop chạy đúng; trên server nhiều core, B thỉnh thoảng đọc `config` còn `null`, hoặc vòng lặp không bao giờ thoát. Không dòng code nào \"sai\" nếu đọc tuần tự.",
    idea: "Đừng lý luận bằng \"lệnh nào chạy trước\". Lý luận bằng cạnh happens-before: ghi `config` đứng trước ghi cờ trong cùng thread (program order), ghi cờ `volatile` happens-before lần đọc cờ thấy nó, nên B thấy `config`. Không có cạnh đó thì không có đảm bảo nào.",
    tradeoff: "Mỗi cạnh happens-before giới hạn việc compiler/CPU được đổi thứ tự hay giữ giá trị trong register, nên đồng bộ thừa có thể làm chậm. Nhưng tự lý luận ở mức memory model rất dễ sai; tài liệu Go khuyên \"Don't be clever\": dùng lock, channel, atomic có sẵn thay vì đoán.",
  },
  table: {
    head: ["Ngôn ngữ", "Cạnh happens-before có sẵn", "Không đồng bộ thì sao"],
    rows: [
      {
        cells: ["Java (JLS §17.4)", "Unlock monitor → lock sau đó cùng monitor; ghi `volatile` → đọc sau đó; `Thread.start()` → mọi hành động trong thread mới; mọi hành động trong thread → `join()` trả về", "Chương trình có data race: lần đọc có thể thấy giá trị cũ hoặc thấy các lần ghi theo thứ tự lạ; `long`/`double` không `volatile` còn có thể bị \"xé\" thành hai nửa của hai lần ghi khác nhau (§17.7)"],
        why: "Danh sách lấy từ §17.4.5. §17.4.3: \"nếu chương trình không có data race thì mọi lần chạy đều trông như sequentially consistent\" (https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html). Đây là đảm bảo DRF-SC: chỉ cần không có data race, bạn được lý luận như thể các thread chạy xen kẽ trên một CPU.",
      },
      {
        cells: ["Go (go.dev/ref/mem)", "Send trên channel → receive tương ứng hoàn tất; `Unlock` lần n → `Lock` lần m > n trả về; `once.Do(f)`: `f` xong → mọi lời gọi `Do` trả về; atomic A được B quan sát → A trước B", "Race trên giá trị nhiều word (interface, map, slice, string) có thể ra giá trị không khớp lần ghi nào, dẫn tới hỏng bộ nhớ tuỳ ý"],
        why: "Trích Go memory model (https://go.dev/ref/mem). Go nói thẳng: chương trình không có data race chạy như thể mọi goroutine được ghép lên một processor (DRF-SC); mọi thao tác `sync/atomic` hành xử như chạy theo một thứ tự sequentially consistent.",
      },
      {
        cells: ["C++ (`std::atomic`, `memory_order`)", "Store `release` → load `acquire` cùng biến đọc được giá trị đó (synchronizes-with); mutex; mặc định mọi thao tác atomic là `seq_cst`", "Data race (ít nhất một bên không atomic, không bên nào happens-before bên kia) là **undefined behavior**"],
        why: "Chuẩn C++ [intro.races]: \"Any such data race results in undefined behavior\" (https://eel.is/c++draft/intro.races); release/acquire và thứ tự tổng S cho `seq_cst` ở [atomics.order] (https://eel.is/c++draft/atomics.order). C++ nghiêm hơn Java: có race là cả chương trình không còn nghĩa, không chỉ \"đọc giá trị cũ\".",
      },
      {
        cells: ["Python (CPython)", "Không có đặc tả memory model riêng; dùng primitive của `threading` (`Lock`, `Event`, `Condition`) và `queue.Queue`", "Đừng dựa vào GIL: từ Python 3.13 có bản build free-threaded tắt được GIL"],
        why: "Tài liệu `threading` ghi: trong CPython, do GIL chỉ một thread chạy code Python tại một thời điểm; \"từ Python 3.13, bản build free-threaded có thể tắt GIL\" (PEP 703), chưa bật mặc định (https://docs.python.org/3/library/threading.html). Code đồng bộ đúng bằng primitive chạy đúng trên cả hai bản; code dựa vào GIL thì không chắc.",
      },
    ],
  },
  points: [
    {
      t: "**Reordering có thật, không cần bug của CPU** — JLS Table 17.4-A: ban đầu `A == B == 0`; thread 1 chạy `r2 = A; B = 1;`, thread 2 chạy `r1 = B; A = 2;`. Kết quả `r2 == 2` và `r1 == 1` trông vô lý nhưng **được phép**.",
      why: "Compiler được đổi chỗ hai lệnh độc lập trong một thread (`B = 1` lên trước `r2 = A`), vì trong một thread kết quả không đổi. JLS gọi chương trình này là \"improperly synchronized\": ghi ở thread này, đọc ở thread kia, không có đồng bộ xếp thứ tự (§17.4, https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html).",
    },
    {
      t: "**Visibility: cờ không đồng bộ có thể không bao giờ được thấy** — `for !done {}` chờ goroutine khác đặt `done = true`: Go nói vòng lặp **không được đảm bảo kết thúc**, và kể cả khi thấy `done` thì cũng không chắc thấy dữ liệu ghi trước nó.",
      why: "Ví dụ \"busy waiting\" trong Go memory model (https://go.dev/ref/mem). Không có sự kiện đồng bộ nào giữa hai goroutine, nên compiler được phép đọc `done` một lần rồi giữ trong register, và không có cạnh happens-before từ ghi dữ liệu tới chỗ đọc.",
    },
    {
      t: "**`volatile` của Java đảm bảo gì** — (1) **visibility**: ghi `volatile` happens-before mọi lần đọc sau của biến đó; (2) **ordering**: mọi ghi đứng trước lần ghi `volatile` trong thread viết cũng được thấy bởi thread đọc được giá trị đó; (3) đọc/ghi `long`/`double` `volatile` là atomic.",
      why: "(1) là luật trong §17.4.5; (2) suy ra từ tính bắc cầu của happens-before cộng program order; (3) ở §17.7: ghi `long`/`double` **không** `volatile` được coi là hai lần ghi 32-bit, thread khác có thể thấy nửa này của lần ghi này và nửa kia của lần ghi khác (https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html).",
    },
    {
      t: "**`volatile` không làm `count++` thành atomic** — `count++` là đọc, cộng, ghi: ba bước. `volatile` chỉ bảo đảm mỗi lần đọc thấy lần ghi gần nhất theo thứ tự đồng bộ; hai thread vẫn có thể cùng đọc 5 rồi cùng ghi 6.",
      why: "Visibility và atomicity là hai đảm bảo khác nhau. Khe giữa đọc và ghi vẫn mở, đúng mẫu read-modify-write của `conc-race-condition`. Cần `AtomicInteger.incrementAndGet()` (bài `conc-atomic-cas`) hoặc lock.",
    },
    {
      t: "**Double-checked locking hỏng nếu thiếu `volatile`** — `if (helper == null) { synchronized(...) { if (helper == null) helper = new Helper(); } } return helper;`. Thread khác có thể thấy `helper` khác `null` nhưng các field bên trong **chưa được khởi tạo**.",
      why: "Ghi các field của object và ghi tham chiếu `helper` có thể bị thực hiện hoặc quan sát sai thứ tự; lần đọc `helper` ở ngoài `synchronized` không có cạnh happens-before nào. Sửa (từ JDK 5): khai báo `helper` là `volatile`, hoặc dùng field `static` của một class riêng vì Java đảm bảo khởi tạo class được thấy trọn vẹn (Pugh, \"The Double-Checked Locking is Broken\" — https://www.cs.umd.edu/~pugh/java/memoryModel/DoubleCheckedLocking.html). Go có ví dụ tương đương với `once.Do` (https://go.dev/ref/mem).",
    },
    {
      t: "**`final` field: object bất biến an toàn khi publish** — gán `final` field trong constructor và không để lộ `this` ra ngoài trước khi constructor xong, thì thread nào thấy object cũng thấy đúng giá trị `final`, kể cả khi tham chiếu được chia sẻ không qua đồng bộ.",
      why: "JLS §17.5, Example 17.5-1: reader chắc chắn thấy `f.x == 3` (`final`) nhưng `f.y` (không `final`) có thể là 0 (https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html). Đây là lý do object bất biến dễ dùng chung giữa thread hơn object sửa được.",
    },
    {
      t: "**Release/acquire: đủ cho \"publish rồi đọc\"** — thread A ghi dữ liệu rồi store cờ với `release`; thread B load cờ với `acquire` và thấy giá trị A ghi, thì B thấy mọi thứ A đã ghi trước store. `relaxed` chỉ đảm bảo chính thao tác đó atomic, không xếp thứ tự gì khác.",
      why: "Chuẩn C++: thao tác release trên M synchronizes with thao tác acquire trên M lấy giá trị từ release sequence do nó mở đầu; `relaxed`: \"no operation orders memory\" (https://eel.is/c++draft/atomics.order). Mặc định `seq_cst` mạnh hơn: thêm một thứ tự tổng mà mọi thread cùng thấy. Chỉ hạ xuống release/acquire khi đo được lợi và hiểu rõ.",
    },
    {
      t: "**Cấu trúc đồng bộ cấp cao đã mang sẵn happens-before** — `queue.Queue`, `BlockingQueue`, channel Go, `Future.get()`, thread pool: thứ bạn đưa vào trước khi gửi sẽ được bên nhận thấy. Đó là lý do \"share memory by communicating\" ít bug hơn.",
      why: "Go: send happens trước receive tương ứng hoàn tất (https://go.dev/ref/mem). Truyền object qua queue rồi **thôi sửa** nó ở bên gửi thì không còn truy cập đồng thời, nên không còn data race để lý luận.",
    },
  ],
  sections: [
    {
      title: "Python: publish dữ liệu bằng `threading.Event` thay vì cờ tự chế",
      code: {
        lang: "python",
        lines: [
          "import threading",
          "",
          "config = None",
          ["ready = threading.Event()", "`Event` là primitive đồng bộ của `threading`: một thread `set()`, các thread khác `wait()` tới khi cờ bật (https://docs.python.org/3/library/threading.html)."],
          "",
          "def loader():",
          "    global config",
          ["    config = {\"db\": \"primary\", \"pool\": 10}", "Ghi dữ liệu **trước** khi báo; sau `set()` thì không sửa nữa."],
          ["    ready.set()", "Thay cho `ready_flag = True`: tài liệu `threading` không hứa gì về visibility của biến thường giữa các thread, nên đừng dùng nó để báo hiệu."],
          "",
          "def reader(out):",
          ["    if not ready.wait(timeout=2):", "Có timeout: loader chết thì reader không treo mãi."],
          "        raise TimeoutError(\"config chưa sẵn sàng\")",
          "    out.append(config[\"pool\"])",
          "",
          "for _ in range(50):",
          "    config = None; ready.clear(); out = []",
          "    ts = [threading.Thread(target=reader, args=(out,)) for _ in range(4)]",
          "    ts.append(threading.Thread(target=loader))",
          "    for t in ts: t.start()",
          "    for t in ts: t.join(timeout=5)",
          "    assert out == [10, 10, 10, 10], out",
          "print(\"ok\")",
        ],
      },
    },
    {
      title: "Bạn cần gì → dùng gì",
      table: {
        head: ["Bạn cần", "Java", "Go", "Python"],
        rows: [
          {
            cells: ["Một cờ dừng / cờ \"đã sẵn sàng\"", "`volatile boolean`", "`atomic.Bool` hoặc đóng một channel", "`threading.Event`"],
            why: "Chỉ cần visibility và thứ tự, không cần read-modify-write, nên không phải lock.",
          },
          {
            cells: ["Đếm, cộng dồn", "`AtomicLong`, `LongAdder`", "`atomic.Int64`", "`with lock:` hoặc mỗi thread đếm riêng"],
            why: "Cần atomic cho cả chuỗi đọc–cộng–ghi; `volatile` không đủ.",
          },
          {
            cells: ["Khởi tạo lười một lần (singleton, cache)", "Holder class `static`, hoặc double-checked locking với `volatile`", "`sync.Once`", "`functools.cache` hoặc lock quanh lần khởi tạo"],
            why: "Đây là chỗ double-checked locking hỏng kinh điển; dùng cấu trúc có sẵn thay vì tự viết.",
          },
          {
            cells: ["Chuyển dữ liệu giữa thread", "`BlockingQueue`", "channel", "`queue.Queue`"],
            why: "Queue mang sẵn happens-before từ bên gửi sang bên nhận; xem `conc-classic-problems`.",
          },
          {
            cells: ["Bất biến trên nhiều biến", "`synchronized` / `ReentrantLock`", "`sync.Mutex`", "`threading.Lock`"],
            why: "Lock cho cả atomicity lẫn visibility cho mọi biến trong critical section.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi được hỏi \"`volatile` làm gì?\", trả lời hai ý: visibility + ordering (happens-before), và **không** atomic cho `count++`. Rồi nêu ví dụ double-checked locking.",
      why: "Câu hỏi này lọc người học thuộc \"`volatile` là không cache\" với người hiểu happens-before; ví dụ double-checked locking cho thấy bạn biết reordering gây hỏng thật.",
    },
    {
      t: "Nói câu DRF-SC: \"không có data race thì được lý luận như chạy tuần tự\". Mục tiêu khi viết code là **không có data race**, không phải thuộc luật reorder.",
      why: "Java, Go, C++ đều đưa ra đảm bảo này; nó đổi bài toán \"đoán CPU làm gì\" thành bài toán \"mọi truy cập chung đều có đồng bộ\", kiểm được bằng race detector của Go (`go test -race`, https://go.dev/doc/articles/race_detector).",
    },
  ],
  cards: [
    ["Memory model trả lời câu hỏi gì?", "Một lần đọc biến dùng chung được phép thấy lần ghi nào; khi nào chắc chắn thấy giá trị mới."],
    ["Happens-before nghĩa là gì?", "Nếu A happens-before B thì kết quả của A được B thấy và A được xếp trước B. Tạo bằng lock/unlock, volatile, atomic, channel, start/join."],
    ["Data race theo JLS?", "Hai truy cập xung đột (cùng biến, ít nhất một ghi) không được xếp thứ tự bằng happens-before."],
    ["DRF-SC là gì?", "Chương trình không có data race thì mọi lần chạy trông như sequentially consistent (thread xen kẽ trên một CPU)."],
    ["`volatile` có làm `count++` atomic không?", "Không. Nó cho visibility và ordering; `count++` vẫn là đọc–cộng–ghi, cần atomic hoặc lock."],
    ["Vì sao double-checked locking hỏng?", "Ghi field của object và ghi tham chiếu có thể bị quan sát sai thứ tự; thread khác thấy tham chiếu khác null nhưng object chưa khởi tạo xong. Sửa bằng `volatile` hoặc holder class."],
    ["Data race trong C++ dẫn tới gì?", "Undefined behavior cho cả chương trình (chuẩn [intro.races])."],
    ["Python có memory model riêng không?", "Không có đặc tả riêng; dùng primitive của `threading` và `queue`, đừng dựa vào GIL vì từ 3.13 có bản free-threaded."],
  ],
});
