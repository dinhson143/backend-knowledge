BK.sim({
  id: "deadlock",
  title: "Deadlock và lock ordering",
  topics: ["concurrency"],
  scenario: "T1 chuyển tiền A → B, T2 chuyển tiền B → A cùng lúc. Mỗi transaction cần khoá cả hai tài khoản.",
  context: "Chuyển tiền phải khoá **cả hai tài khoản** để không ai đọc/ghi số dư giữa chừng. **Deadlock** xảy ra khi đủ 4 điều kiện Coffman: mutual exclusion (lock chỉ 1 người giữ), hold & wait (giữ lock này trong khi chờ lock khác), no preemption (không ai cướp được lock), circular wait (chờ nhau thành vòng). Dòng chữ dưới T1, T2 (\"giữ X · chờ Y\") chính là hold & wait; dòng dưới Lock A, Lock B cho biết ai đang giữ.",
  nodes: [
    { id: "T1", x: 120, y: 65, label: "Thread T1" },
    { id: "T2", x: 120, y: 225, label: "Thread T2" },
    { id: "A", x: 540, y: 65, label: "Lock A", s: "free" },
    { id: "B", x: 540, y: 225, label: "Lock B", s: "free" },
  ],
  variants: [
    {
      name: "Gây deadlock",
      steps: [
        {
          note: "T1 lấy lock A.",
          msgs: [["T1", "A", "acquire"], ["A", "T1", "OK", "ok"]],
          set: { A: "held by T1", T1: "giữ A" },
          detail: "T1 (chuyển A → B) lấy được lock A — bước hoàn toàn bình thường. T1 khoá tài khoản nguồn trước; A đang free nên thành công. T1 chạy tiếp và chuẩn bị lấy lock thứ hai.",
        },
        {
          note: "Cùng lúc T2 lấy lock B.",
          msgs: [["T2", "B", "acquire"], ["B", "T2", "OK", "ok"]],
          set: { B: "held by T2", T2: "giữ B" },
          detail: "T2 (chuyển B → A) cùng lúc lấy được lock B — đây là mầm của deadlock. T2 cũng khoá tài khoản nguồn của nó trước. Mỗi thread theo một quy tắc hợp lý cục bộ (\"khoá nguồn trước, đích sau\"), nhưng hướng chuyển ngược nhau nên **thứ tự lấy lock ngược nhau**: T1 là A→B, T2 là B→A.",
        },
        {
          note: "T1 cần B → chờ T2. T2 cần A → chờ T1.",
          msgs: [{ par: [["T1", "B", "acquire…", "warn"], ["T2", "A", "acquire…", "warn"]] }],
          set: { T1: "giữ A · chờ B ⏳", T2: "giữ B · chờ A ⏳" },
          detail: "Cả hai thread bị block, mỗi bên **giữ một lock trong khi chờ lock kia** (hold & wait). T1 xin lock B nhưng T2 đang giữ; T2 xin lock A nhưng T1 đang giữ. Không ai bị buộc nhả (no preemption). Không lỗi, không exception — cả hai chỉ đứng chờ.",
        },
        {
          note: "**Circular wait** — không ai nhả lock, cả hai treo vĩnh viễn.",
          bad: ["T1", "T2"],
          lesson: "Deadlock cần đủ 4 điều kiện: mutual exclusion, hold & wait, no preemption, circular wait.",
          detail: "T1 chờ T2, T2 chờ T1 — vòng chờ khép kín nên cả hai **treo mãi mãi** nếu dùng mutex thông thường không timeout. Nguy hiểm ở chỗ lỗi **im lặng**: CPU không tăng, không log, chỉ thấy request chuyển tiền timeout và thread pool cạn dần khi các request sau cũng xếp hàng chờ A hoặc B. Database (PostgreSQL, MySQL InnoDB) có deadlock detector: sau khoảng `deadlock_timeout` (mặc định 1s ở PostgreSQL) nó huỷ một transaction để phá vòng, ứng dụng phải bắt lỗi và retry. Lock trong code ứng dụng thì không ai phát hiện giúp.",
        },
      ],
    },
    {
      name: "Lock ordering",
      steps: [
        {
          note: "Quy tắc: luôn lấy lock **theo thứ tự cố định** (A trước B). T1 lấy A.",
          msgs: [["T1", "A", "acquire"], ["A", "T1", "OK", "ok"]],
          set: { A: "held by T1", T1: "giữ A" },
          detail: "Quy tắc toàn cục: mọi thread lấy lock **theo thứ tự cố định**, ví dụ account id tăng dần — A trước B, bất kể chiều chuyển tiền. T1 (A → B) lấy A, thành công. Quy tắc không bỏ lock nào, chỉ ép mọi thread cùng một thứ tự.",
        },
        {
          note: "T2 cũng phải lấy A trước → chờ, nhưng **không giữ lock nào**.",
          msgs: [["T2", "A", "acquire…", "warn"]],
          set: { T2: "chờ A ⏳ (không giữ gì)" },
          detail: "T2 chờ trong khi **không giữ lock nào**, nên không thể chặn T1. T2 (B → A) theo quy tắc cũng phải xin A trước, nhưng T1 đang giữ A nên T2 chờ. Điều kiện hold & wait vẫn có, nhưng vòng chờ không thể hình thành vì không ai giữ lock \"lớn hơn\" rồi chờ lock \"nhỏ hơn\".",
        },
        {
          note: "T1 lấy tiếp B, làm xong, nhả cả hai.",
          msgs: [
            ["T1", "B", "acquire"],
            ["B", "T1", "OK", "ok"],
            { par: [["T1", "A", "release", "ok"], ["T1", "B", "release", "ok"]] },
          ],
          set: { T1: "xong ✓", A: "free", B: "free" },
          detail: "Transaction T1 hoàn tất bình thường: lấy B (đang free vì T2 chưa đụng vào), chuyển tiền, rồi nhả cả A và B. Cái giá duy nhất: T2 chờ thêm thời gian T1 chạy — tuần tự hoá giữa hai transaction chạm cùng tài khoản, điều vốn cần cho tính đúng.",
        },
        {
          note: "T2 lấy A rồi B — không có vòng chờ.",
          msgs: [["T2", "A", "acquire"], ["T2", "B", "acquire"]],
          set: { T2: "giữ A, B ✓", A: "held by T2", B: "held by T2" },
          good: ["T2"],
          lesson: "Lock ordering phá điều kiện circular wait.",
          detail: "T2 được đánh thức, lấy A rồi B, chuyển B → A — không có vòng chờ nên không deadlock. Lock ordering phá điều kiện **circular wait**: rẻ nhất và chắc chắn nhất, nhưng đòi hỏi biết trước mọi lock cần lấy và mọi code path phải tuân thủ; quên một chỗ là deadlock quay lại. Cách bổ sung: `tryLock` với timeout, rồi nhả hết và retry có backoff.",
        },
      ],
    },
  ],
});
