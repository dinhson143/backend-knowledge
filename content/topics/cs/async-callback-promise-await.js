BK.topic({
  id: "async-callback-promise-await",
  track: "cs",
  section: "cs-async",
  title: "Callback, Promise, async/await",
  goal: "Viết code async không callback hell và chạy đồng thời đúng cách",
  needs: ["async-event-loop"],
  tldr: {
    t: "Ba cách viết cùng một việc trên event loop: **callback** (\"xong thì gọi hàm này\"), **Promise / Future** (một đối tượng đại diện cho kết quả sẽ có, gắn tiếp bước bằng `.then`), và **async/await** (cú pháp cho phép viết như code tuần tự, mỗi `await` là chỗ hàm nhường thread và chạy tiếp khi kết quả có). Lỗi hay gặp nhất không phải cú pháp mà là **thứ tự**: `await` từng việc một khi các việc độc lập với nhau, hoặc tạo việc mà không ai `await` nó.",
    why: "Code sau mỗi `await` \"có thể xem như nằm trong một callback `.then`\" (MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function). Vì vậy async/await không đổi cách event loop chạy, chỉ đổi cách bạn viết. Hai `await` liên tiếp nghĩa là việc thứ hai **chưa bắt đầu** tới khi việc thứ nhất xong; nếu chúng độc lập thì bạn đang tự biến 100 ms + 100 ms thành 200 ms.",
  },
  story: {
    problem: "Trang profile cần user, đơn hàng và gợi ý sản phẩm từ 3 service, mỗi cái 100 ms. Bản đầu viết callback lồng 3 tầng, lỗi phải xử lý ở cả 3 tầng. Bản sửa dùng async/await nhưng `await` lần lượt: 300 ms. Một bản khác gọi `sendEmail()` mà quên `await`: lỗi gửi mail không ai thấy.",
    idea: "Dùng Promise/async-await để có một luồng xử lý lỗi duy nhất (`try/except`, `try/catch`). Các việc độc lập thì **khởi động cùng lúc** rồi chờ chung (`Promise.all`, `asyncio.gather`, `TaskGroup`): 100 ms thay vì 300 ms. Mọi việc đã tạo phải có người chờ nó.",
    tradeoff: "async/await \"lây\": hàm gọi hàm async cũng phải là async (hoặc tự quản lý Promise/Task). Chạy đồng thời thì phải quyết định khi một việc lỗi, các việc còn lại bị huỷ, chạy tiếp, hay bị bỏ mặc; mỗi API làm khác nhau.",
  },
  table: {
    head: ["Cách viết", "Ví dụ", "Ưu", "Nhược"],
    rows: [
      {
        cells: ["Callback", "`fs.readFile(path, (err, data) => { … })`", "Đơn giản, không cần runtime hỗ trợ gì thêm", "Lồng nhau khi nối nhiều bước (callback hell); lỗi phải kiểm tra ở mỗi tầng; bạn giao quyền gọi tiếp cho thư viện"],
        why: "Node.js dùng quy ước **error-first callback**: tham số đầu là lỗi, `null` nếu thành công (https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks). Mỗi callback thêm một tầng lồng và một chỗ phải nhớ kiểm tra `err`; quên một chỗ là lỗi bị nuốt.",
      },
      {
        cells: ["Promise / Future", "`fetch(url).then(r => r.json()).catch(handle)`", "Nối bước phẳng; một `.catch` cho cả chuỗi; là giá trị nên truyền đi, gộp lại được", "Vẫn phải nghĩ bằng `.then`; quên `return` trong `.then` là chuỗi bị đứt"],
        why: "Promise là đối tượng \"đại diện cho việc hoàn tất (hoặc thất bại) sau này của một thao tác bất đồng bộ\", có ba trạng thái pending, fulfilled, rejected (MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Trong `.then` mà gọi một Promise khác nhưng không `return` nó thì Promise đó \"trôi nổi\" (floating): bước sau chạy luôn mà không chờ (MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises).",
      },
      {
        cells: ["async/await", "`data = await fetch_user(id)`", "Đọc như code tuần tự; `try/catch` bình thường; stack trace dễ theo", "Dễ vô tình chạy tuần tự; phải đánh dấu `async` cả chuỗi gọi"],
        why: "Python có `async`/`await` từ 3.5 (PEP 492 — https://peps.python.org/pep-0492/), JavaScript từ ES2017. Hàm `async` trong JS luôn trả về một Promise (MDN async function). Bên dưới vẫn là event loop và Promise/Future; `await` chỉ là chỗ nhường.",
      },
    ],
  },
  points: [
    {
      t: "**Tuần tự hay đồng thời: hỏi \"bước sau có cần kết quả bước trước không?\"** Cần (lấy user rồi mới lấy đơn của user đó) → `await` lần lượt. Không cần → khởi động hết rồi chờ chung: JS `await Promise.all([a(), b(), c()])`; Python `await asyncio.gather(a(), b(), c())` hoặc `async with asyncio.TaskGroup() as tg:` rồi `tg.create_task(…)`.",
      why: "MDN khuyên: trước khi nối Promise tuần tự, xem có thật cần không; tốt hơn là chạy đồng thời để chúng không chặn nhau, trừ khi việc này cần kết quả việc kia (Using promises). Với 3 lời gọi 100 ms độc lập, tuần tự mất khoảng 300 ms, đồng thời mất khoảng 100 ms: thời gian bằng việc chậm nhất chứ không bằng tổng.",
    },
    {
      t: "**JS khởi động ngay, Python thì không.** Gọi một hàm `async` trong JS chạy luôn phần thân tới `await` đầu tiên và trả về Promise. Gọi một hàm `async def` trong Python chỉ tạo **coroutine object**, chưa chạy dòng nào, cho tới khi bị `await` hoặc bọc thành Task.",
      why: "MDN: phần thân tới `await` đầu tiên chạy đồng bộ (async function). asyncio: \"chỉ gọi coroutine thì không lên lịch cho nó chạy\", và coroutine không bao giờ được `await` sẽ không chạy, kèm `RuntimeWarning: coroutine … was never awaited` (https://docs.python.org/3/library/asyncio-task.html; https://docs.python.org/3/library/asyncio-dev.html). Vì vậy trong Python, `a = fetch(); b = fetch(); await a; await b` vẫn là **tuần tự**; muốn đồng thời phải tạo Task hoặc dùng `gather`.",
    },
    {
      t: "**Việc đã tạo phải có người chờ.** Quên `await` một Promise thì lỗi của nó thành unhandled rejection; Task của asyncio bị bỏ mặc thì lỗi chỉ hiện thành log `Task exception was never retrieved` lúc Task bị dọn.",
      why: "Không ai `await` thì exception không có đường lan về hàm gọi (https://docs.python.org/3/library/asyncio-dev.html). Asyncio còn cảnh báo event loop chỉ giữ **weak reference** tới Task: không lưu tham chiếu thì Task có thể biến mất giữa chừng (https://docs.python.org/3/library/asyncio-task.html). Cách an toàn là để việc con nằm trong một phạm vi chờ chung (`TaskGroup`, `Promise.all`).",
    },
    {
      t: "**Tạo trước rồi `await` lần lượt vẫn có bẫy.** JS: `const p1 = slow(); const p2 = fast(); await p1; await p2;` chạy đồng thời, nhưng nếu `p2` reject trong lúc đang chờ `p1` thì là unhandled rejection, dù bên ngoài có `catch`.",
      why: "Lúc `p2` reject chưa có handler nào gắn vào nó; `Promise.all` gắn handler cho mọi Promise ngay từ đầu nên không có khoảng hở đó. MDN ghi rõ ví dụ `[await p1, await p2]` là \"đừng làm\" và khuyên dùng `Promise.all` hoặc `Promise.allSettled` (async function).",
    },
    {
      t: "**Khi một việc trong nhóm lỗi, các việc còn lại ra sao?** `Promise.all` reject ngay nhưng các việc khác **vẫn chạy** (chỉ là kết quả bị bỏ); `asyncio.gather` mặc định cũng vậy; `asyncio.TaskGroup` (Python 3.11+) thì **huỷ** các việc còn lại. Muốn lấy đủ kết quả cả thành công lẫn lỗi: `Promise.allSettled`, `gather(…, return_exceptions=True)`.",
      why: "MDN: các thao tác khác vẫn tiếp tục nhưng kết quả không lấy được qua `Promise.all` (Using promises). asyncio: lỗi đầu tiên của `gather` được trả về ngay, các awaitable khác \"sẽ không bị huỷ\"; còn `TaskGroup` huỷ các task còn lại khi một task lỗi (https://docs.python.org/3/library/asyncio-task.html). Việc vẫn chạy sau khi kết quả đã bị bỏ là tài nguyên phí phạm và đôi khi là side effect ngoài ý muốn; chi tiết ở topic Future Combinators.",
    },
    {
      t: "**Ngôn ngữ khác.** Java: `CompletableFuture` (`thenApply`, `allOf`) là Promise; với virtual thread thì viết code blocking bình thường. Go: không có `await`; mỗi việc là một goroutine, kết quả qua channel hoặc `sync.WaitGroup`/`errgroup`.",
      why: "Go và Java virtual thread đẩy việc \"nhường khi chờ\" vào runtime, nên hàm không bị chia thành async/không async. Đổi lại bạn phải tự giới hạn số goroutine và tự truyền tín hiệu huỷ (xem Cancellation, Timeout & Deadline).",
    },
  ],
  sections: [
    {
      title: "Cùng một việc, ba cách viết (Python)",
      table: {
        head: ["Cách", "Code", "Thời gian với 3 lời gọi 100 ms"],
        rows: [
          ["Tuần tự", "`u = await get_user(id)` · `o = await get_orders(id)` · `r = await get_recs(id)`", "≈ 300 ms"],
          ["`gather`", "`u, o, r = await asyncio.gather(get_user(id), get_orders(id), get_recs(id))`", "≈ 100 ms; lỗi đầu tiên được ném ra, việc khác vẫn chạy"],
          ["`TaskGroup`", "`async with asyncio.TaskGroup() as tg:` · `tu = tg.create_task(get_user(id))` … · sau khối: `tu.result()`", "≈ 100 ms; một việc lỗi thì các việc khác bị huỷ, lỗi gom trong `ExceptionGroup`"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi review code async, tìm hai mẫu: (1) nhiều `await` liền nhau mà không dùng kết quả của nhau → gom lại; (2) gọi hàm async mà không `await`, không lưu Task → lỗi bị nuốt hoặc việc bị bỏ dở.",
      why: "Đây là hai lỗi phổ biến nhất và đều không gây crash ngay: một cái làm chậm âm thầm, một cái làm mất lỗi âm thầm. Chỉ ra được chúng trong phỏng vấn coding cho thấy bạn đã viết async thật.",
    },
    {
      t: "Nói được \"async/await là cú pháp trên Promise/Future, chạy trên event loop\" và vẽ được code sau `await` thành một callback.",
      why: "Interviewer hay hỏi \"`await` có chặn thread không?\". Trả lời: không; nó trả quyền về event loop, phần còn lại của hàm được lên lịch chạy khi kết quả có.",
    },
  ],
  cards: [
    ["Error-first callback là gì?", "Quy ước của Node.js: tham số đầu của callback là lỗi (`null` nếu thành công), tham số sau là kết quả."],
    ["Promise có những trạng thái nào?", "pending, fulfilled, rejected; fulfilled hoặc rejected thì gọi là settled."],
    ["`await` có chặn thread không?", "Không. Nó tạm dừng hàm hiện tại, trả quyền về event loop; phần còn lại chạy khi kết quả có."],
    ["Gọi `fetch()` (một `async def`) trong Python mà không `await` thì sao?", "Chỉ tạo coroutine object, không chạy; Python cảnh báo `coroutine … was never awaited`."],
    ["`Promise.all` reject thì các Promise khác có dừng không?", "Không, chúng vẫn chạy; chỉ là kết quả không còn lấy qua `Promise.all`."],
    ["`asyncio.gather` khác `TaskGroup` thế nào khi một việc lỗi?", "`gather` (mặc định) ném lỗi đầu tiên, các việc khác chạy tiếp; `TaskGroup` huỷ các việc còn lại và gom lỗi vào `ExceptionGroup`."],
    ["Floating promise là gì?", "Promise được tạo trong `.then` nhưng không được `return`, nên chuỗi không chờ nó và không bắt được lỗi của nó."],
  ],
});
