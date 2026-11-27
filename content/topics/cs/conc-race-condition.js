BK.topic({
  id: "conc-race-condition",
  track: "cs",
  section: "cs-os",
  title: "Race Condition",
  goal: "Nhận ra check-then-act và phân biệt race condition với data race",
  needs: ["thr-thread-vs-process"],
  tldr: {
    t: "**Race condition**: kết quả đúng hay sai phụ thuộc vào thứ tự chạy xen kẽ của các thread (hoặc process, request, server). Hai dạng hay gặp nhất: **read-modify-write** (`count += 1`: đọc, cộng, ghi) và **check-then-act** (kiểm tra \"ghế còn trống\" rồi mới đặt; giữa hai bước, bên khác đã đặt). **Data race** là khái niệm hẹp hơn, ở mức bộ nhớ: hai thread truy cập cùng một ô nhớ đồng thời, ít nhất một bên ghi, không có đồng bộ. Có thể có race condition mà không có data race: mỗi bước đều có lock, nhưng hai bước tách rời.",
    why: "Race condition là lỗi logic: một chuỗi thao tác cần chạy liền mạch lại bị chen vào giữa. Data race là lỗi đồng bộ bộ nhớ: Go memory model định nghĩa nó là một lần ghi vào một vị trí nhớ xảy ra đồng thời với một lần đọc hoặc ghi khác vào cùng vị trí, trừ khi mọi truy cập đều là atomic của `sync/atomic` (https://go.dev/ref/mem). Sửa data race (thêm lock cho từng truy cập) chưa chắc đã sửa race condition, nếu lock không bao trọn cả chuỗi kiểm tra và hành động.",
  },
  story: {
    problem: "API đặt vé: `if seat.status == \"free\": seat.status = \"booked\"; seat.user = me`. Test một người dùng luôn đúng. Ngày mở bán, 2 người cùng bấm trong vài mili giây: cả hai đọc thấy \"free\", cả hai ghi \"booked\", ghế bán hai lần. Log không có lỗi nào; chỉ có hai vé cho một ghế.",
    idea: "Tìm chuỗi \"kiểm tra rồi hành động\" trên dữ liệu chung và làm cho nó **không chen ngang được**: lock bao cả chuỗi trong một process; với nhiều process/server thì đẩy xuống chỗ dùng chung có thao tác atomic (UPDATE có điều kiện, unique constraint, Redis `INCR`).",
    tradeoff: "Lock bao rộng thì đúng nhưng các request phải xếp hàng, giảm throughput; bao hẹp thì nhanh nhưng dễ để lọt khe giữa check và act. Đẩy xuống DB thì đúng trên nhiều server nhưng thêm round-trip và tải lên DB.",
  },
  table: {
    head: ["Dạng", "Ví dụ", "Vì sao sai", "Sửa"],
    rows: [
      {
        cells: ["Read-modify-write", "`count += 1`; `D[k] = D[k] + 1`", "Hai thread cùng đọc 5, cùng ghi 6: mất một lần cộng (lost update)", "Lock quanh cả ba bước; atomic increment; Redis `INCR`"],
        why: "Python FAQ liệt kê `i = i+1` và `D[x] = D[x] + 1` là **không** atomic, vì chúng gồm nhiều lệnh bytecode và thread có thể bị đổi giữa các lệnh (https://docs.python.org/3/faq/library.html).",
      },
      {
        cells: ["Check-then-act", "`if key not in cache: cache[key] = load()`; đặt ghế; lazy init singleton", "Điều kiện đúng lúc kiểm tra đã sai lúc hành động", "Lock bao cả check và act; thao tác \"kiểm tra và ghi\" atomic (`UPDATE … WHERE status='free'`, `SET NX`)"],
        why: "Mỗi bước riêng lẻ có thể an toàn (dict của Python đọc/ghi một lần là atomic), nhưng khoảng giữa hai bước thì không ai bảo vệ. Đây là race condition **không có data race**.",
      },
      {
        cells: ["TOCTOU trên file", "`if os.access(path, os.W_OK): open(path, \"w\")`", "File bị đổi (symlink) giữa lúc kiểm tra quyền và lúc mở", "Bỏ bước kiểm tra, cứ `open` rồi bắt lỗi"],
        why: "access(2) cảnh báo đúng trường hợp này là lỗ hổng bảo mật, vì người dùng có thể lợi dụng khoảng thời gian ngắn giữa kiểm tra và mở file (https://man7.org/linux/man-pages/man2/access.2.html).",
      },
      {
        cells: ["Race giữa nhiều server", "Hai instance cùng đọc số dư rồi cùng trừ tiền", "Lock trong RAM của một process không thấy process khác", "Transaction với isolation phù hợp, `SELECT … FOR UPDATE`, optimistic lock theo version, distributed lock"],
        why: "Không có bộ nhớ chung thì không có data race, nhưng race condition vẫn còn nguyên: dữ liệu chung bây giờ là dòng trong DB. Chi tiết ở bài `db-isolation-anomalies` và `dist-lock`.",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao chen được** — scheduler có thể dừng thread giữa hai lệnh máy bất kỳ (bài `os-context-switch`); trên nhiều core, hai thread còn chạy cùng lúc thật. Chỉ một core vẫn có race condition.",
      why: "Race condition chỉ cần các bước của hai bên **xen kẽ** trên dòng thời gian, không cần chạy cùng lúc. Timer interrupt cho phép kernel giành CPU bất kỳ lúc nào, nên giả định \"đoạn này ngắn, không ai chen kịp\" luôn sai ở một lúc nào đó.",
    },
    {
      t: "**Python: GIL không cứu được logic** — với GIL, mỗi lệnh bytecode là atomic, nên `L.append(x)` hay `D[k] = v` không hỏng cấu trúc. Nhưng chuỗi nhiều lệnh như `count += 1` hay check-then-act vẫn bị chen. FAQ của Python khuyên: không chắc thì dùng mutex.",
      why: "Python FAQ: Python chỉ đổi thread giữa các lệnh bytecode, nên các thao tác trên kiểu built-in \"trông atomic\" thì atomic thật (https://docs.python.org/3/faq/library.html). Mục này dựa vào GIL; trên bản free-threaded (3.13+, không mặc định) đừng dựa vào nó. Lỗi logic thì GIL chưa bao giờ ngăn.",
    },
    {
      t: "**Data race nguy hiểm hơn \"sai một con số\"** — trong Go, chương trình có data race mất đảm bảo \"chạy như thể tuần tự\": compiler và CPU được phép sắp xếp lại truy cập bộ nhớ khi không có đồng bộ, nên một goroutine có thể thấy các lần ghi của goroutine khác theo thứ tự khác với thứ tự trong code.",
      why: "Go memory model: chương trình **không** có data race chạy như thể mọi goroutine được ghép lên một processor (DRF-SC); có data race thì mất đảm bảo đó, và tài liệu khuyên \"Don't be clever\": chương trình sửa dữ liệu được nhiều goroutine truy cập đồng thời phải tuần tự hoá truy cập đó (https://go.dev/ref/mem). Visibility và reordering là bài `conc-memory-model` (sắp viết).",
    },
    {
      t: "**Bốn cách loại bỏ** — (1) **atomic hoá** cả chuỗi bằng lock hoặc thao tác atomic; (2) **không chia sẻ**: mỗi dữ liệu chỉ một thread sở hữu, gửi việc qua queue/channel; (3) **bất biến**: dữ liệu không đổi thì đọc thoải mái; (4) **đẩy xuống nơi có atomic**: DB, Redis.",
      why: "Race condition cần đủ ba thứ: dữ liệu chung, có ghi, và truy cập đồng thời. Mỗi cách bỏ đi một thứ. Go tóm lại thành \"Share memory by communicating; don't communicate by sharing memory\" (https://pkg.go.dev/sync/atomic).",
    },
    {
      t: "**Test hiếm khi bắt được** — race chỉ lộ ra khi hai bên xen kẽ đúng vào khe hẹp, nên test chạy xanh 1.000 lần vẫn có thể sai ở lần 1.001 trên production tải cao.",
      why: "Kết quả phụ thuộc lịch chạy của scheduler, thứ test không điều khiển được. Công cụ giúp: Go race detector (`go test -race`) chỉ tìm race **thực sự xảy ra** lúc chạy, và tốn khoảng 5–10 lần bộ nhớ, 2–20 lần thời gian (https://go.dev/doc/articles/race_detector). Stress test và review theo mẫu \"check-then-act\" vẫn cần.",
    },
    {
      t: "**Check-then-act trên collection thread-safe vẫn race** — `ConcurrentHashMap` hay `dict` có lock bên trong bảo vệ từng lời gọi, không bảo vệ chuỗi `get` rồi `put` của bạn. Java có thao tác gộp: `putIfAbsent`, `computeIfAbsent` của `ConcurrentHashMap`. Python: lock bao cả hai bước.",
      why: "Collection thread-safe hứa mỗi phương thức không làm hỏng cấu trúc, không hứa gì về chuỗi phương thức. Javadoc `ConcurrentHashMap` ghi các phương thức này tương đương chuỗi check-then-act \"ngoại trừ việc hành động được thực hiện atomic\" (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html). Chọn loại collection nào ở bài `conc-thread-safe-collections` (sắp viết).",
    },
  ],
  sections: [
    {
      title: "Python: sai và sửa",
      table: {
        head: ["Code", "Đúng hay sai", "Vì sao"],
        rows: [
          {
            cells: ["`hits += 1` (gọi từ nhiều thread)", "Sai: có thể mất lần cộng", "Đọc, cộng, ghi là nhiều lệnh bytecode; thread có thể bị đổi giữa chúng"],
            why: "FAQ ghi `i = i+1` không atomic. Mất bao nhiêu lần phụ thuộc phiên bản CPython và tải, nên \"chạy thử thấy đúng\" không chứng minh gì.",
          },
          {
            cells: ["`with lock: hits += 1`", "Đúng trong một process", "Lock bao trọn chuỗi đọc–cộng–ghi"],
            why: "`threading.Lock` dùng với `with` tự release kể cả khi có exception. Lock chỉ có tác dụng giữa các thread **cùng process**; nhiều worker Gunicorn là nhiều process, mỗi cái một lock riêng.",
          },
          {
            cells: ["`if user_id not in sessions: sessions[user_id] = create()`", "Sai: hai thread có thể cùng `create()`", "Check và act là hai lệnh riêng"],
            why: "Hậu quả tuỳ `create()`: tạo hai session, mở hai connection, gửi hai email. Sửa bằng lock bao cả hai bước: `with lock:` rồi mới kiểm tra và tạo. Tài liệu Python không liệt kê `setdefault` trong các thao tác được hứa atomic, nên đừng dựa vào nó.",
          },
          {
            cells: ["`UPDATE seats SET user_id = %s WHERE id = %s AND user_id IS NULL` rồi kiểm tra `rowcount == 1`", "Đúng trên nhiều server", "DB làm check và act trong một câu lệnh atomic"],
            why: "Hai request cùng chạy thì chỉ một câu khớp `user_id IS NULL`; câu kia cập nhật 0 dòng và biết mình thua. Không cần lock ở tầng app, không cần transaction dài.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi review code hoặc thiết kế, tìm mẫu \"đọc → quyết định → ghi\" trên dữ liệu dùng chung, rồi hỏi: giữa đọc và ghi, ai khác có thể ghi?",
      why: "Đây là câu hỏi bắt được hầu hết race condition, ở mọi tầng: biến trong RAM, dòng trong DB, key trong Redis, file trên đĩa.",
    },
    {
      t: "Phân biệt rõ khi bị hỏi: data race là chuyện **bộ nhớ** (cần đồng bộ từng truy cập), race condition là chuyện **logic** (cần atomic cả chuỗi). Cho một ví dụ có cái này mà không có cái kia.",
      why: "Ví dụ chuẩn: check-then-act với mỗi bước có lock riêng là race condition không có data race. Câu trả lời có ví dụ cho thấy bạn hiểu chứ không thuộc định nghĩa.",
    },
  ],
  related: ["seat", "redis-atomic"],
  cards: [
    ["Race condition là gì?", "Lỗi khi kết quả phụ thuộc thứ tự chạy xen kẽ của các thread/process, vì một chuỗi thao tác cần liền mạch bị chen vào giữa."],
    ["Data race là gì (theo Go memory model)?", "Một lần ghi vào một vị trí nhớ xảy ra đồng thời với một lần đọc hoặc ghi khác vào cùng vị trí, khi không phải mọi truy cập đều atomic."],
    ["Ví dụ race condition không có data race?", "Check-then-act mà mỗi bước có lock riêng (hoặc chạy trên DB/nhiều server): không truy cập bộ nhớ nào thiếu đồng bộ, nhưng khe giữa check và act vẫn bị chen."],
    ["Vì sao `count += 1` không an toàn dù Python có GIL?", "Nó gồm đọc, cộng, ghi là nhiều lệnh bytecode; GIL chỉ làm từng lệnh atomic, thread vẫn có thể bị đổi giữa các lệnh."],
    ["TOCTOU là gì?", "Time-of-check to time-of-use: điều kiện kiểm tra (quyền file, ghế trống) bị đổi trước khi kịp dùng; access(2) cảnh báo dùng `access()` trước `open()` là lỗ hổng."],
    ["Một chỗ ngồi, nhiều server — làm sao chặn bán hai lần không cần lock ở app?", "`UPDATE … SET user_id = ? WHERE id = ? AND user_id IS NULL` rồi kiểm tra số dòng bị cập nhật bằng 1."],
    ["Go race detector có bắt mọi race không?", "Không: chỉ bắt race thực sự xảy ra trong lần chạy đó; đường code không chạy tới thì không bắt được."],
  ],
});
