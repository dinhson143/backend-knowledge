BK.topic({
  id: "conc-atomic-cas",
  track: "cs",
  section: "cs-os",
  title: "Atomic, CAS & Lock-free",
  goal: "Dùng CAS đúng chỗ và biết bài toán ABA",
  needs: ["conc-race-condition"],
  tldr: {
    t: "**Atomic** (không chen ngang được) là thao tác mà thread khác chỉ thấy trước hoặc sau, không bao giờ thấy giữa chừng. **Compare-and-swap (CAS)**: \"nếu ô nhớ vẫn bằng giá trị tôi đã đọc thì ghi giá trị mới, trả về thành công; nếu không thì không ghi gì, trả về thất bại\". Với CAS, sửa một biến chung không cần lock: đọc, tính, CAS, thất bại thì đọc lại và thử lại. Đó là nền của cấu trúc **lock-free**. Bẫy kinh điển là **ABA**: giá trị đổi từ A sang B rồi về A, CAS vẫn thành công dù trạng thái đã đổi.",
    why: "Go mô tả `CompareAndSwap` tương đương đoạn `if *addr == old { *addr = new; return true }; return false` chạy atomic (https://pkg.go.dev/sync/atomic). Vì phép so sánh và phép ghi là một bước, khe \"check-then-act\" của race condition biến mất; người thua chỉ biết mình thua và thử lại, không ai phải ngủ chờ lock.",
  },
  story: {
    problem: "Counter request dùng chung cho 64 thread, mỗi lần tăng phải lấy lock. Profile cho thấy thread dành nhiều thời gian chờ lock hơn làm việc, và mỗi lần chờ là một context switch. Ở chỗ khác, một stack lock-free tự viết thỉnh thoảng mất phần tử mà không ai tái hiện được.",
    idea: "Biến đơn lẻ (counter, cờ, con trỏ đầu danh sách) đổi bằng thao tác atomic thay cho lock. Khi tranh chấp cực cao, chia counter ra nhiều ô rồi cộng lại lúc đọc. Còn cấu trúc lock-free phức tạp thì dùng của thư viện chuẩn, không tự viết, vì bẫy ABA và memory ordering rất khó làm đúng.",
    tradeoff: "CAS chỉ bảo vệ **một** biến; bất biến liên quan nhiều biến vẫn cần lock hoặc transaction. Tranh chấp cao thì CAS thất bại liên tục và vòng thử lại đốt CPU. Code lock-free khó đọc, khó chứng minh đúng.",
  },
  table: {
    head: ["Ngôn ngữ", "Atomic có sẵn", "Ghi chú"],
    rows: [
      {
        cells: ["Java", "`AtomicInteger`, `AtomicLong`, `AtomicReference`: `incrementAndGet`, `compareAndSet`, `updateAndGet`; `LongAdder` cho counter tranh chấp cao", "Gói `java.util.concurrent.atomic`: \"lập trình thread-safe lock-free trên biến đơn\""],
        why: "Trích mô tả gói (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/package-summary.html). `updateAndGet` nhận một hàm và Javadoc yêu cầu hàm đó không có side effect, vì nó có thể bị gọi lại khi CAS thất bại do tranh chấp.",
      },
      {
        cells: ["Go", "`sync/atomic`: `AddInt64`, `CompareAndSwapInt64`, `Load`/`Store`, kiểu `atomic.Int64`, `atomic.Pointer[T]`", "Tài liệu mở đầu: các hàm này \"đòi hỏi rất cẩn thận để dùng đúng\""],
        why: "Gói `sync/atomic` khuyên \"Share memory by communicating\" (https://pkg.go.dev/sync/atomic). Trong Go memory model, mọi thao tác atomic hành xử như thể chạy theo một thứ tự sequentially consistent, giống `volatile` của Java (https://go.dev/ref/mem).",
      },
      {
        cells: ["Python", "Thư viện chuẩn không có kiểu atomic hay hàm CAS công khai", "Dùng `threading.Lock`; hoặc `queue.Queue` để một thread sở hữu dữ liệu"],
        why: "Module `threading` chỉ cung cấp lock, semaphore, condition, event, barrier (https://docs.python.org/3/library/threading.html). Với GIL, từng lệnh bytecode là atomic, nhưng không có \"so sánh rồi ghi\" gộp cho người dùng; FAQ khuyên không chắc thì dùng mutex.",
      },
    ],
  },
  points: [
    {
      t: "**Vòng CAS** — `while True: cũ = đọc(); mới = f(cũ); if CAS(cũ, mới): break`. Thất bại nghĩa là có thread khác vừa ghi; đọc lại giá trị mới nhất và tính lại.",
      why: "Đây là optimistic concurrency ở mức một ô nhớ: giả định không ai chen, kiểm lại lúc ghi. `f` có thể chạy nhiều lần, nên `f` không được gửi email, ghi log nghiệp vụ hay làm gì không lặp lại được.",
    },
    {
      t: "**Lock-free không có nghĩa là luôn nhanh hơn** — tranh chấp thấp: CAS rẻ hơn lock vì không ngủ, không context switch. Tranh chấp cao: CAS thất bại liên tục, các core tranh nhau cùng một cache line.",
      why: "Javadoc `LongAdder`: tranh chấp thấp thì nó và `AtomicLong` tương đương; tranh chấp cao thì `LongAdder` cho throughput cao hơn đáng kể, đổi lại tốn bộ nhớ hơn (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/LongAdder.html). Nó chia counter thành nhiều ô cho các thread cộng riêng, cộng tổng khi đọc.",
    },
    {
      t: "**Lock-free và wait-free** — lock-free: tại mọi thời điểm **ít nhất một** thread tiến triển (thread khác có thể phải thử lại mãi). Wait-free: **mọi** thread xong trong số bước hữu hạn. Lock thì không đảm bảo gì nếu thread giữ lock bị dừng.",
      why: "Lợi ích thật của lock-free là chịu được thread bị dừng giữa chừng (bị preempt, bị page fault): không ai \"giữ\" gì nên người khác không phải chờ. Một thread giữ lock rồi bị dời khỏi CPU thì mọi thread cần lock đó đứng chờ.",
    },
    {
      t: "**ABA** — thread 1 đọc đỉnh stack là A, định CAS(A → A.next). Trong lúc đó thread 2 pop A, pop B, push lại A. Đỉnh lại là A nên CAS của thread 1 thành công, nhưng A.next nó đã đọc là B, phần tử đã bị lấy ra. Stack hỏng.",
      why: "CAS chỉ so **giá trị**, không biết giá trị đó đã đổi qua lại bao nhiêu lần. Sửa: gắn thêm số phiên bản tăng mỗi lần ghi và CAS cả cặp (giá trị, version). Java có `AtomicStampedReference` giữ tham chiếu kèm một \"stamp\" số nguyên cập nhật atomic cùng nhau, gói atomic nêu nó dùng được làm số phiên bản (package-summary).",
    },
    {
      t: "**ABA ở mức nghiệp vụ** — số dư 100 → 50 → 100: CAS \"nếu số dư còn 100 thì đặt 70\" thành công, dù giữa chừng đã có hai giao dịch khác. Nếu logic chỉ cần giá trị thì không sao; nếu cần biết \"không ai động vào\" thì phải so version.",
      why: "Ngôn ngữ có GC tránh được dạng ABA do **tái dùng địa chỉ bộ nhớ** (object còn được tham chiếu thì không bị cấp lại), nhưng không tránh được ABA ở giá trị. Đó là lý do optimistic lock trong DB dùng cột `version` tăng dần thay vì so giá trị cũ.",
    },
    {
      t: "**Hai biến atomic không làm thành một thao tác atomic** — `a.incrementAndGet(); b.incrementAndGet()` thì thread khác vẫn có thể thấy `a` đã tăng mà `b` chưa. Bất biến giữa nhiều biến cần lock, hoặc gói chúng vào một object bất biến và CAS một tham chiếu.",
      why: "Mỗi thao tác atomic chỉ bảo vệ chính nó; khoảng giữa hai thao tác là khe check-then-act y như bài `conc-race-condition`. Gói trạng thái vào object bất biến rồi `AtomicReference.compareAndSet` đổi cả cụm trong một bước.",
    },
    {
      t: "**CAS ở mọi tầng của hệ thống** — DB: `UPDATE … SET …, version = version + 1 WHERE id = ? AND version = ?`. HTTP: `If-Match` với ETag. Redis: `WATCH` rồi `MULTI`/`EXEC`, hoặc Lua script. Cùng ý tưởng: ghi chỉ khi trạng thái còn như lúc đọc.",
      why: "RFC 9110 mô tả conditional request như `If-Match` là cách tránh vấn đề \"lost update\": client này ghi đè thay đổi của client khác (https://www.rfc-editor.org/rfc/rfc9110.html). Atomic trong một process không giúp gì giữa nhiều server; khi đó CAS phải nằm ở chỗ dùng chung (DB, Redis) hoặc dùng `dist-lock`.",
    },
    {
      t: "**Atomic còn đảm bảo visibility** — ngoài không bị chen ngang, thao tác atomic còn bảo đảm thread khác **thấy** giá trị mới theo đúng thứ tự. Biến thường không có đảm bảo này dù phép ghi \"trông\" atomic.",
      why: "Java: các phương thức của `AtomicInteger` có memory effects theo đặc tả `VarHandle`; Go: thao tác atomic A được B quan sát thì A \"synchronizes before\" B. Visibility, reordering, happens-before là bài `conc-memory-model`.",
    },
  ],
  sections: [
    {
      title: "Chọn công cụ",
      table: {
        head: ["Bạn cần", "Dùng", "Vì sao"],
        rows: [
          {
            cells: ["Đếm request, tranh chấp vừa", "`AtomicLong.incrementAndGet()` / `atomic.AddInt64`", "Một lệnh atomic, không lock, không ngủ"],
            why: "Thư viện cung cấp sẵn một thao tác atomic làm trọn đọc–cộng–ghi; bạn không phải tự viết vòng CAS (bên dưới là lệnh fetch-and-add hay vòng CAS tuỳ kiến trúc CPU).",
          },
          {
            cells: ["Đếm cực nóng (metric mọi request, nhiều core)", "`LongAdder`", "Chia ô, ít va chạm cache line"],
            why: "Đọc tổng chậm hơn và không chụp được một thời điểm chính xác, chấp nhận được với metric.",
          },
          {
            cells: ["Đổi cấu hình đang dùng chung", "`AtomicReference` trỏ tới object cấu hình bất biến; đổi bằng `set` hoặc CAS", "Reader đọc một tham chiếu, luôn thấy cấu hình trọn vẹn cũ hoặc mới"],
            why: "Không object nào bị sửa tại chỗ nên không có trạng thái nửa cũ nửa mới. Đây là cách gộp nhiều biến thành một bước atomic.",
          },
          {
            cells: ["Sửa nhiều biến có ràng buộc với nhau, hoặc chờ điều kiện", "Lock (`threading.Lock`, `ReentrantLock`)", "CAS không bao được nhiều biến, không cho thread ngủ chờ"],
            why: "Lock đơn giản và đúng; chỉ chuyển sang atomic khi profile cho thấy lock là nút thắt.",
          },
          {
            cells: ["Python, nhiều thread cùng tăng một số", "`with lock: n += 1`, hoặc mỗi thread đếm riêng rồi cộng lại", "Không có atomic int trong thư viện chuẩn"],
            why: "Đếm riêng rồi gộp là cùng ý tưởng với `LongAdder`: bỏ dữ liệu chung thì bỏ luôn tranh chấp.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi bị hỏi \"làm sao bỏ lock?\", trả lời CAS cho **một** biến, kèm hai giới hạn: không bao được nhiều biến, và ABA khi giá trị có thể quay lại.",
      why: "Ứng viên trung bình nói \"dùng atomic\"; ứng viên tốt nói khi nào atomic không đủ. Nêu ABA và cách sửa bằng version cho thấy bạn hiểu CAS so cái gì.",
    },
    {
      t: "Nối CAS trong RAM với optimistic lock trong DB và `If-Match` trong HTTP: cùng một ý tưởng ở ba tầng.",
      why: "Interviewer System Design thích ứng viên thấy được mẫu chung; nó cũng cho thấy bạn biết atomic trong một process không giải được race giữa nhiều server.",
    },
  ],
  related: ["redis-atomic", "seat"],
  cards: [
    ["CAS làm gì?", "Atomic: nếu ô nhớ còn bằng giá trị mong đợi thì ghi giá trị mới và trả về thành công, nếu không thì không ghi và trả về thất bại."],
    ["Vòng CAS viết thế nào và lưu ý gì?", "Đọc, tính giá trị mới, CAS; thất bại thì đọc lại và thử lại. Hàm tính có thể chạy nhiều lần nên không được có side effect."],
    ["Bài toán ABA là gì?", "Giá trị đổi A → B → A giữa lúc đọc và lúc CAS; CAS vẫn thành công dù trạng thái đã thay đổi (ví dụ stack lock-free mất phần tử)."],
    ["Sửa ABA thế nào?", "Gắn số phiên bản tăng mỗi lần ghi và CAS cả cặp (giá trị, version), như `AtomicStampedReference` hoặc cột `version` trong DB."],
    ["Lock-free khác wait-free?", "Lock-free: luôn có ít nhất một thread tiến triển. Wait-free: mọi thread đều xong trong số bước hữu hạn."],
    ["Khi nào `LongAdder` tốt hơn `AtomicLong`?", "Khi tranh chấp cao: throughput cao hơn đáng kể, đổi lại tốn bộ nhớ hơn; tranh chấp thấp thì như nhau."],
    ["Python có CAS không?", "Thư viện chuẩn không có kiểu atomic hay CAS công khai; dùng `threading.Lock`, queue, hoặc đếm riêng từng thread rồi gộp."],
  ],
});
