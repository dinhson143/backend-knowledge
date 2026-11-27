BK.topic({
  id: "async-backpressure",
  track: "cs",
  section: "cs-async",
  title: "Backpressure trong code",
  goal: "Giới hạn số việc đồng thời và dùng queue có giới hạn",
  needs: ["async-event-loop"],
  tldr: {
    t: "**Backpressure** là cơ chế để bên nhận báo bên gửi **chậm lại** khi nó xử lý không kịp. Trong code async, tạo thêm một việc gần như miễn phí (`create_task`, `go f()`, một Promise), nên rất dễ tạo 100.000 việc cùng lúc và làm sập chính mình hoặc service phía sau. Hai công cụ cơ bản: **giới hạn số việc đồng thời** (semaphore) và **queue có giới hạn** (đầy thì bên gửi phải chờ hoặc bị từ chối). Thiếu cả hai thì phần dư không biến mất: nó dồn vào bộ nhớ.",
    why: "Node.js mô tả backpressure là dữ liệu \"dồn lại sau một buffer\" khi bên nhận chậm hơn; trong ví dụ nén một file lớn, bỏ qua backpressure làm bộ nhớ tối đa của process tăng hơn một bậc độ lớn và GC chạy dày hơn (https://nodejs.org/en/learn/modules/backpressuring-in-streams). Reactive Streams coi backpressure là phần bắt buộc để các queue giữa hai bên luôn **có giới hạn** (https://www.reactive-streams.org/).",
  },
  story: {
    problem: "Job đồng bộ 200.000 sản phẩm sang search service: `await asyncio.gather(*(push(p) for p in products))`. 200.000 coroutine cùng mở kết nối: hết file descriptor, connection pool tràn, search service trả 429 hàng loạt, retry làm mọi thứ tệ hơn, và process tốn nhiều bộ nhớ vì giữ 200.000 request đang dở.",
    idea: "Chỉ cho tối đa 50 lời gọi đang chạy (`asyncio.Semaphore(50)`), hoặc đẩy sản phẩm vào `asyncio.Queue(maxsize=1000)` với 50 worker lấy ra xử lý. Producer nhanh hơn thì `await queue.put()` tự chờ: tốc độ của cả pipeline bằng tốc độ của khâu chậm nhất, bộ nhớ có trần.",
    tradeoff: "Giới hạn làm job chạy lâu hơn so với \"bắn hết một lượt\" trong lúc mọi thứ còn khoẻ. Chọn giới hạn cần đo: quá thấp thì phí công suất, quá cao thì vẫn làm quá tải phía sau. Khi bên gửi là người dùng (không thể bắt chờ mãi), queue đầy thì phải **từ chối** chứ không chỉ chờ.",
  },
  table: {
    head: ["Công cụ", "Python asyncio", "JS / Node.js", "Go", "Java"],
    rows: [
      {
        cells: ["Giới hạn số việc đồng thời", "`sem = asyncio.Semaphore(50)` · `async with sem: await call()`", "Thư viện kiểu `p-limit`, hoặc tự viết pool N worker", "Buffered channel làm semaphore: `sem := make(chan struct{}, 50)`", "`java.util.concurrent.Semaphore`"],
        why: "Semaphore giữ một bộ đếm: `acquire()` giảm, `release()` tăng, bằng 0 thì `acquire()` chờ (https://docs.python.org/3/library/asyncio-sync.html). Effective Go dùng buffered channel làm semaphore để giới hạn số lời gọi đồng thời, và lưu ý phải **chặn trước khi tạo goroutine**, nếu không vẫn tạo goroutine không giới hạn (https://go.dev/doc/effective_go). Với virtual thread, Oracle khuyên dùng `Semaphore` để giới hạn chứ không dùng pool (https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html).",
      },
      {
        cells: ["Queue có giới hạn", "`asyncio.Queue(maxsize=1000)`: `await put()` chờ khi đầy, `put_nowait()` ném `QueueFull`", "Stream: `write()` trả `false` thì dừng, chờ sự kiện `'drain'`", "Buffered channel: gửi vào channel đầy thì goroutine gửi bị chặn", "`ArrayBlockingQueue`: `put` chờ, `offer` trả `false`"],
        why: "asyncio: `maxsize <= 0` là queue **vô hạn**; `maxsize > 0` thì `await put()` chờ tới khi có chỗ (https://docs.python.org/3/library/asyncio-queue.html). Node.js: khi buffer vượt `highWaterMark`, `write()` trả `false`; nguồn nên dừng tới khi có `'drain'`, và `.pipe()` làm việc này giúp bạn (https://nodejs.org/en/learn/modules/backpressuring-in-streams). Java: `put` chờ tới khi có chỗ, `offer` trả `false` nếu hết chỗ (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html).",
      },
      {
        cells: ["Bên nhận xin dữ liệu (pull)", "Async iterator: chỉ lấy phần tử kế khi xử lý xong", "Readable stream ở chế độ paused, async iterator", "Consumer tự đọc channel", "Reactive Streams / `java.util.concurrent.Flow`: `request(n)`"],
        why: "Reactive Streams quy định Publisher **không được** gửi nhiều `onNext` hơn tổng số phần tử Subscriber đã `request` (rule 1.1), và `request(n)` cộng dồn nhu cầu (rule 3.8) (https://raw.githubusercontent.com/reactive-streams/reactive-streams-jvm/master/README.md). Bên nhận nắm nhịp nên không bao giờ bị đẩy quá sức.",
      },
    ],
  },
  points: [
    {
      t: "**\"Bắn hết một lượt\" là anti-pattern.** `gather(*[f(x) for x in items])` hay `Promise.all(items.map(f))` với `items` không giới hạn kích thước nghĩa là số việc đồng thời = kích thước dữ liệu đầu vào, tức là do người khác quyết định.",
      why: "Mỗi việc đang chạy giữ bộ nhớ, socket, có khi cả kết nối DB. Event loop không tự giới hạn: nó chạy mọi Task được tạo. Giới hạn phải nằm trong code của bạn, đặt theo năng lực của khâu chậm nhất (pool DB, rate limit của API phía sau).",
    },
    {
      t: "**Queue đầy thì làm gì: chọn một trong bốn.** (1) **Chặn** bên gửi (`await put()`): đúng cho pipeline nội bộ. (2) **Từ chối** ngay (`put_nowait` → trả 429/503): đúng khi bên gửi là client bên ngoài. (3) **Bỏ** phần tử cũ hoặc mới: đúng cho dữ liệu chỉ cần bản mới nhất (metric, vị trí GPS). (4) **Tràn ra đĩa/broker**: khi không được mất dữ liệu.",
      why: "Chặn truyền áp lực ngược lên trên tới tận nguồn; nhưng chặn một HTTP request thì chỉ dời việc xếp hàng vào socket backlog và làm client timeout. Từ chối sớm rẻ hơn để request chờ rồi timeout (cùng ý với load shedding ở `resilience`). Không chọn gì = queue vô hạn = chọn \"chết vì hết bộ nhớ\".",
    },
    {
      t: "**Đặt giới hạn ở đâu.** Ở chỗ tài nguyên khan hiếm: số kết nối tới DB (bằng cỡ pool), số lời gọi đồng thời tới API bên ngoài (theo rate limit của họ), số job CPU (bằng số core). Một semaphore cho mỗi tài nguyên, không phải một con số chung cho cả app.",
      why: "Giới hạn nhỏ hơn năng lực thì phí công suất; lớn hơn thì việc dư chỉ chuyển sang xếp hàng ở chỗ khác (pool, phía server bên kia) nơi bạn không thấy và không kiểm soát được. Ví dụ Effective Go: số lời gọi `process` đồng thời được giới hạn bằng dung lượng của channel.",
    },
    {
      t: "**Bounded queue + N worker là mẫu chuẩn.** Producer `await queue.put(item)`; N worker `item = await queue.get()` → xử lý → `queue.task_done()`; producer xong thì `await queue.join()` để chờ mọi phần tử được xử lý.",
      why: "Mẫu này giới hạn **hai** thứ cùng lúc: số việc đang chạy (N) và số việc đang chờ (maxsize), nên bộ nhớ có trần. `join()` chờ tới khi mọi phần tử đã được lấy ra và xử lý; mỗi `get()` cần đúng một `task_done()` (https://docs.python.org/3/library/asyncio-queue.html).",
    },
    {
      t: "**Backpressure ở mức hệ thống dùng cùng ý tưởng.** Kafka consumer tự `poll` theo nhịp của mình (pull); HTTP/2 và TCP có flow control theo window; API trả 429 kèm `Retry-After`. Code async của bạn là mắt xích cuối: nếu nó buffer vô hạn thì mọi cơ chế phía trên vô dụng.",
      why: "Áp lực ngược chỉ có tác dụng nếu truyền được từ khâu chậm nhất về nguồn mà không bị một buffer vô hạn nào ở giữa \"nuốt\" mất. Reactive Streams nói rõ: lợi ích của xử lý bất đồng bộ mất đi nếu chính việc báo backpressure lại đồng bộ (https://www.reactive-streams.org/). Mức hệ thống xem `queue`.",
    },
  ],
  sections: [
    {
      title: "Dấu hiệu thiếu backpressure",
      table: {
        head: ["Triệu chứng", "Nguyên nhân thường gặp", "Sửa"],
        rows: [
          ["Bộ nhớ tăng dần khi tải cao, rồi OOM", "Queue/buffer không giới hạn; Task tạo nhanh hơn xử lý", "Queue có `maxsize`; semaphore quanh lời gọi chậm"],
          ["Service phía sau trả 429/503 hàng loạt khi chạy batch", "Fan-out không giới hạn (`gather`/`Promise.all` cả danh sách)", "Semaphore theo rate limit của bên kia; xử lý theo lô"],
          ["Latency p99 tăng vọt dù CPU thấp", "Việc chờ trong hàng đợi ẩn (pool kết nối, backlog)", "Đo độ dài hàng đợi; từ chối sớm khi quá ngưỡng"],
          ["`Too many open files`", "Mỗi việc mở một socket, không giới hạn số việc", "Giới hạn đồng thời; dùng chung connection pool"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Mỗi khi viết fan-out (gọi N việc đồng thời), tự hỏi: \"N lớn nhất là bao nhiêu, và ai quyết định nó?\" Nếu câu trả lời là \"kích thước input\" thì thêm semaphore.",
      why: "Câu hỏi này bắt được hầu hết lỗi thiếu backpressure trong code review và trong phỏng vấn coding. Interviewer thường hỏi tiếp \"vậy nếu có 10 triệu phần tử?\" để xem bạn có nghĩ tới giới hạn không.",
    },
    {
      t: "Khi nói về queue trong System Design, nêu luôn: queue **có giới hạn**, và khi đầy thì chặn, từ chối hay bỏ.",
      why: "\"Thêm queue\" không giải quyết quá tải, nó chỉ dời chỗ xếp hàng. Nói được chính sách khi queue đầy cho thấy bạn hiểu backpressure chứ không chỉ biết buffer.",
    },
  ],
  related: ["queue"],
  cards: [
    ["Backpressure là gì?", "Cơ chế để bên nhận báo bên gửi chậm lại khi xử lý không kịp, thay vì để dữ liệu dồn vào buffer không giới hạn."],
    ["`asyncio.Queue()` không truyền `maxsize` thì giới hạn bao nhiêu?", "Không giới hạn (`maxsize <= 0` là vô hạn); `put()` không bao giờ chờ."],
    ["Vì sao `asyncio.gather` cả 200.000 phần tử là nguy hiểm?", "Số việc đồng thời bằng kích thước input: hết socket, tràn pool, làm quá tải service phía sau, tốn bộ nhớ."],
    ["Node.js stream: `write()` trả `false` nghĩa là gì?", "Buffer đã vượt `highWaterMark`; nên dừng ghi tới khi có sự kiện `'drain'`."],
    ["Queue đầy có những chính sách nào?", "Chặn bên gửi, từ chối ngay (429/503), bỏ phần tử, tràn ra đĩa/broker."],
    ["Reactive Streams giới hạn Publisher thế nào?", "Publisher không được gửi nhiều phần tử hơn tổng số Subscriber đã `request(n)`."],
    ["Go: giới hạn số goroutine đồng thời bằng gì?", "Buffered channel làm semaphore (gửi vào trước khi làm, nhận ra khi xong), chặn **trước** khi tạo goroutine."],
  ],
});
