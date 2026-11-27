BK.sim({
  id: "durable-replay",
  title: "Durable execution: worker chết rồi replay theo event history",
  topics: ["durable-execution"],
  scenario: "Workflow đặt hàng gồm 3 bước: trừ tiền → giữ hàng → gọi giao hàng. Worker 1 chết sau bước 2. Worker 2 phải đi tiếp đúng bước 3.",
  context: "**Engine** lưu **event history** của workflow: mỗi bước đã xong là một event kèm kết quả. **Worker** chạy code workflow; khi nhận lại một workflow dở dang, worker **replay**: chạy code từ đầu, bước nào đã có kết quả trong history thì lấy kết quả đó thay vì gọi lại. Theo dõi dòng dưới Engine (history có gì) và các lời gọi tới **Services** (trừ tiền, giữ hàng, giao hàng). Variant 2: code workflow đọc giờ hệ thống trực tiếp.",
  nodes: [
    { id: "engine", x: 380, y: 60, label: "Engine", w: 200, s: "history: —" },
    { id: "w1", x: 150, y: 210, label: "Worker 1" },
    { id: "w2", x: 380, y: 210, label: "Worker 2" },
    { id: "svc", x: 640, y: 210, label: "Services", s: "PSP · Kho · Giao hàng" },
  ],
  h: 290,
  variants: [
    {
      name: "Workflow deterministic",
      steps: [
        {
          note: "Worker 1 chạy bước 1: activity `charge` (idempotency key = runId+activityId).",
          msgs: [["engine", "w1", "start order#42"], ["w1", "svc", "charge 100k · key=r1-a1"], ["svc", "w1", "ok pay_9", "ok"], ["w1", "engine", "ActivityCompleted charge=pay_9", "ok"]],
          set: { engine: "history: charge ✓", w1: "bước 1 xong" },
          detail: "Code workflow gọi activity `charge`. Worker thực thi activity, PSP trả `pay_9`, và kết quả được ghi vào history thành event `ActivityCompleted`. Từ giờ, kết quả bước 1 nằm trong engine chứ không chỉ trong RAM của worker.",
        },
        {
          note: "Bước 2: activity `reserve` giữ hàng, kết quả vào history.",
          msgs: [["w1", "svc", "reserve sku#7"], ["svc", "w1", "ok res_3", "ok"], ["w1", "engine", "ActivityCompleted reserve=res_3", "ok"]],
          set: { engine: "history: charge ✓ · reserve ✓", w1: "bước 2 xong" },
          detail: "Giống bước 1: kết quả `res_3` được ghi thành event. Biến cục bộ, stack, vị trí dòng code của Worker 1 **không** được lưu; chỉ có chuỗi event.",
        },
        {
          note: "Worker 1 **chết** (deploy, OOM) trước bước 3.",
          set: { w1: "💥 chết" },
          bad: ["w1"],
          detail: "Worker 1 bị kill. Engine không thấy worker báo tiến độ, sau timeout thì giao workflow cho worker khác. Không cần cron quét hay bảng trạng thái riêng.",
        },
        {
          note: "Worker 2 **replay** từ đầu: `charge` và `reserve` lấy kết quả từ history, **không** gọi Services.",
          msgs: [["engine", "w2", "history: charge, reserve"], ["w2", "engine", "replay: lệnh khớp history", "ok"]],
          set: { w2: "replay tới bước 3" },
          detail: "Worker 2 chạy code workflow từ dòng đầu. Gặp lời gọi `charge`, nó thấy history đã có kết quả `pay_9` nên trả luôn, không gọi PSP. Tương tự với `reserve`. Lệnh code phát ra khớp từng event trong history, nên trạng thái dựng lại giống hệt lúc Worker 1 chết.",
        },
        {
          note: "Tới bước chưa có trong history → gọi thật `ship`. Workflow xong.",
          msgs: [["w2", "svc", "ship order#42"], ["svc", "w2", "ok", "ok"], ["w2", "engine", "WorkflowCompleted", "ok"]],
          set: { engine: "history: charge ✓ · reserve ✓ · ship ✓", w2: "xong" },
          good: ["engine", "svc"],
          lesson: "Replay = chạy lại code, lấy kết quả bước cũ từ history, gọi thật từ bước đầu tiên chưa có kết quả. Services chỉ thấy mỗi bước một lần.",
          detail: "Bước 3 chưa có kết quả nên được thực thi thật. Tiền chỉ trừ một lần, hàng chỉ giữ một lần. Nếu Worker 1 chết **sau** khi PSP trừ tiền nhưng **trước** khi event được ghi, `charge` sẽ chạy lại; idempotency key `r1-a1` là thứ giúp PSP nhận ra lần trùng.",
        },
      ],
    },
    {
      name: "Có `now()` trong workflow",
      steps: [
        {
          note: "Code workflow: `if now() < 18:00 then charge else schedule_tomorrow`. Lần đầu chạy lúc 17:59.",
          msgs: [["engine", "w1", "start order#42"], ["w1", "svc", "charge (vì 17:59 < 18:00)"], ["svc", "w1", "ok", "ok"], ["w1", "engine", "ActivityScheduled charge ✓", "ok"]],
          set: { engine: "history: charge ✓", w1: "đọc giờ máy: 17:59" },
          detail: "Code workflow đọc giờ hệ thống trực tiếp thay vì qua API của SDK. Lúc 17:59 nó rẽ nhánh `charge`, và history ghi lệnh `charge`. Giá trị 17:59 **không** được ghi vào history.",
        },
        {
          note: "Worker 1 chết. Worker 2 nhận workflow lúc 18:02 và replay.",
          set: { w1: "💥 chết", w2: "đọc giờ máy: 18:02" },
          bad: ["w1"],
          msgs: [["engine", "w2", "history: charge"]],
          detail: "Replay chạy lại cùng code, nhưng `now()` giờ trả 18:02.",
        },
        {
          note: "Code rẽ sang `schedule_tomorrow`, không khớp lệnh `charge` trong history → **non-deterministic error**.",
          msgs: [["w2", "engine", "lệnh: schedule_tomorrow ≠ charge", "err"]],
          set: { engine: "❌ non-determinism", w2: "kẹt" },
          bad: ["w2", "engine"],
          lesson: "Code workflow phải deterministic: giờ, random, I/O đi qua API của SDK hoặc activity để giá trị được ghi vào history.",
          detail: "Engine so lệnh code sinh ra với history và thấy lệch, nên dừng workflow với lỗi non-determinism thay vì đoán. Sửa: dùng hàm thời gian của SDK (giá trị được ghi vào history ở lần đầu và trả lại đúng giá trị đó khi replay), hoặc lấy giờ trong một activity. Đổi code khi workflow đang chạy cũng gây đúng lỗi này, nên cần versioning.",
        },
      ],
    },
  ],
});
