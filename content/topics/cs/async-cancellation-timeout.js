BK.topic({
  id: "async-cancellation-timeout",
  track: "cs",
  section: "cs-async",
  title: "Cancellation, Timeout & Deadline",
  goal: "Huỷ việc con khi client bỏ đi và truyền deadline qua các lời gọi",
  needs: ["async-callback-promise-await"],
  tldr: {
    t: "**Timeout** là một khoảng thời gian (\"chờ tối đa 2 giây\"); **deadline** là một mốc thời gian (\"phải xong trước 10:00:02\"); **cancellation** là tín hiệu \"đừng làm nữa\" gửi tới việc đang chạy. Ở mức code: mọi lời gọi I/O phải có giới hạn thời gian, **deadline của request được truyền xuống** mọi lời gọi con (mỗi lớp chỉ còn phần thời gian còn lại), và khi client bỏ đi hoặc hết hạn thì **huỷ cả cây việc con** thay vì để chúng chạy tiếp vô ích.",
    why: "gRPC định nghĩa đúng hai khái niệm này: deadline là mốc thời gian, timeout là khoảng thời gian, đổi timeout thành deadline bằng cách cộng vào thời điểm bắt đầu gọi; và mặc định gRPC **không đặt deadline** nên client có thể chờ mãi (https://grpc.io/docs/guides/deadlines/). Nếu chỉ đặt timeout riêng cho từng lớp mà không truyền deadline, lớp trong vẫn có thể chạy 5 giây sau khi lớp ngoài đã trả lỗi cho người dùng.",
  },
  story: {
    problem: "API tìm kiếm có timeout 2 giây ở gateway. Bên trong, service gọi DB với timeout 5 giây và gọi thêm 3 service khác. Gateway trả 504 sau 2 giây, nhưng các query vẫn chạy đủ 5 giây. Lúc tải cao, người dùng bấm thử lại, và mỗi lần thử lại sinh thêm một cây việc \"ma\" làm DB càng chậm.",
    idea: "Request vào có deadline (bây giờ + 2 giây). Mọi lời gọi con nhận cùng deadline đó: Go `ctx`, gRPC deadline, Python `asyncio.timeout`. Hết hạn hoặc client ngắt kết nối thì tín hiệu huỷ đi xuống cả cây; việc con dừng và giải phóng kết nối DB, slot trong pool.",
    tradeoff: "Huỷ là **cooperative**: việc con chỉ dừng ở chỗ nó kiểm tra tín hiệu (điểm `await`, `ctx.Done()`); vòng lặp CPU hay thư viện blocking không kiểm tra thì vẫn chạy. Huỷ phía client không hoàn tác những gì server đã làm, nên thao tác ghi vẫn cần idempotency.",
  },
  table: {
    head: ["Ngôn ngữ", "Huỷ", "Giới hạn thời gian", "Việc con nhận tín hiệu thế nào"],
    rows: [
      {
        cells: ["Python asyncio", "`task.cancel()`", "`async with asyncio.timeout(2):` (3.11+), `asyncio.wait_for(aw, 2)`", "`CancelledError` được ném vào coroutine ở điểm `await` kế tiếp"],
        why: "`Task.cancel()` \"sắp xếp để `CancelledError` được ném vào coroutine ở vòng kế tiếp của event loop\" và không bảo đảm task bị huỷ. `asyncio.timeout` huỷ task hiện tại khi hết hạn rồi đổi `CancelledError` thành `TimeoutError`, bắt được **bên ngoài** khối `async with` (https://docs.python.org/3/library/asyncio-task.html).",
      },
      {
        cells: ["JavaScript", "`controller.abort()` của `AbortController`", "`AbortSignal.timeout(ms)`; gộp nhiều tín hiệu bằng `AbortSignal.any([...])`", "Truyền `signal` vào `fetch`, stream… Hàm của bạn tự nghe sự kiện `abort` hoặc kiểm tra `signal.aborted`"],
        why: "`AbortController` \"cho phép huỷ một hoặc nhiều Web request khi cần\" và giao tiếp qua `AbortSignal` (https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Signal của `AbortSignal.timeout()` abort với `TimeoutError`, còn abort thủ công là `AbortError`, nên phân biệt được hai trường hợp (https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static). Promise trong JS không tự huỷ được: chỉ thao tác nào nhận `signal` mới dừng.",
      },
      {
        cells: ["Go", "`ctx, cancel := context.WithCancel(parent)`", "`context.WithTimeout`, `context.WithDeadline`", "`select` trên `ctx.Done()`; `ctx.Err()` là `Canceled` hoặc `DeadlineExceeded`"],
        why: "`Context` \"mang deadline, tín hiệu huỷ và giá trị theo request qua ranh giới API\"; gọi `CancelFunc` huỷ context con và mọi context con của nó; deadline của con không thể muộn hơn của cha (https://pkg.go.dev/context). Đây là cách truyền deadline rõ ràng nhất: tham số đầu tiên của mọi hàm làm I/O.",
      },
      {
        cells: ["gRPC (mọi ngôn ngữ)", "Client huỷ call", "Deadline trên mỗi call", "Server thấy call bị huỷ; việc dài nên tự kiểm tra định kỳ"],
        why: "Khi deadline qua, gRPC tự huỷ call ở server với trạng thái `CANCELLED`, client nhận `DEADLINE_EXCEEDED`. Server gọi tiếp service khác có thể truyền deadline gốc xuống; gRPC gửi thời gian **còn lại** thay vì mốc tuyệt đối để tránh lệch đồng hồ (https://grpc.io/docs/guides/deadlines/).",
      },
    ],
  },
  points: [
    {
      t: "**Truyền deadline, đừng cộng dồn timeout.** Gateway cho 2 giây; service A đã dùng 300 ms thì lời gọi xuống B chỉ còn 1,7 giây, không phải \"timeout mặc định 5 giây của client B\". Mỗi lớp lấy `min(deadline còn lại, timeout riêng)`.",
      why: "Go `WithDeadline` tự làm điều này: nếu deadline của cha sớm hơn thì con dùng deadline của cha (https://pkg.go.dev/context). Không truyền thì lớp trong không biết người gọi đã bỏ cuộc, và tiếp tục giữ kết nối DB, slot trong pool cho một kết quả không ai nhận.",
    },
    {
      t: "**Client bỏ đi thì huỷ việc của nó.** Go: `r.Context()` của request bị huỷ khi kết nối của client đóng, khi request HTTP/2 bị huỷ, hoặc khi handler trả về. Ở framework khác, tìm cơ chế báo client ngắt kết nối của framework đó và nối tín hiệu vào các việc con.",
      why: "Theo tài liệu `net/http` (https://pkg.go.dev/net/http#Request.Context). Người dùng bấm tải lại 5 lần là 5 cây việc; nếu 4 cây bị bỏ không ai huỷ, server làm gấp 5 lần việc đúng lúc nó đang quá tải. Huỷ sớm là một dạng load shedding ở mức code (mức hệ thống xem `resilience`).",
    },
    {
      t: "**Huỷ là yêu cầu, không phải mệnh lệnh.** Python ném `CancelledError` ở điểm `await` kế tiếp; Go chỉ đóng channel `Done()`; JS chỉ đặt `signal.aborted`. Đoạn code CPU dài không có `await` hay không kiểm tra `ctx` sẽ chạy tới hết.",
      why: "Không runtime nào dừng được một hàm ở giữa một cách an toàn: nó có thể đang giữ lock hay ghi dở dữ liệu. Vì vậy huỷ được thiết kế cooperative, và việc dài phải tự kiểm tra định kỳ (gRPC khuyên như vậy cho server xử lý lâu). `asyncio.wait_for` còn ghi rõ nó chờ tới khi việc thật sự bị huỷ, nên tổng thời gian có thể vượt timeout (https://docs.python.org/3/library/asyncio-task.html).",
    },
    {
      t: "**Dọn dẹp trong `finally`, rồi để `CancelledError` đi tiếp.** Trong Python, bắt `CancelledError` để đóng kết nối, rollback thì được, nhưng phải `raise` lại. Đừng viết `except Exception` rồi tưởng nó bắt cả huỷ, và đừng nuốt `CancelledError`.",
      why: "`CancelledError` kế thừa trực tiếp `BaseException` (không phải `Exception`), nên `except Exception` không bắt nó. Tài liệu asyncio: sau khi dọn dẹp thì nên ném lại; nuốt hẳn tín hiệu huỷ bị \"phản đối mạnh\", và `TaskGroup`, `asyncio.timeout` được hiện thực bằng cancellation nên \"có thể chạy sai\" nếu một coroutine nuốt `CancelledError` (https://docs.python.org/3/library/asyncio-task.html). Nuốt nó thì timeout không còn tác dụng.",
    },
    {
      t: "**Có việc không được phép bị huỷ giữa chừng.** Ví dụ ghi audit log hay commit sau khi đã trừ tiền. Python có `asyncio.shield(aw)`: lời gọi bên ngoài vẫn nhận `CancelledError`, nhưng việc bên trong chạy tiếp. Go (1.21+) dùng `context.WithoutCancel(ctx)` cho việc dọn dẹp chạy sau khi request đã bị huỷ.",
      why: "Shield bảo vệ việc bên trong khỏi bị huỷ khi việc bên ngoài bị huỷ; asyncio nhắc phải giữ tham chiếu tới task được shield (https://docs.python.org/3/library/asyncio-task.html). `WithoutCancel` trả về context không bị huỷ khi cha bị huỷ (https://pkg.go.dev/context). Dùng ít: mỗi chỗ shield là một chỗ việc có thể chạy quá deadline.",
    },
    {
      t: "**Huỷ không hoàn tác.** Client huỷ sau khi server đã ghi DB thì dữ liệu đã ghi. Client không biết thao tác đã xảy ra hay chưa, nên khi thử lại phải dùng idempotency key.",
      why: "Huỷ chỉ dừng phần **chưa làm**. Timeout phía client nghĩa là \"không biết kết quả\", không phải \"thất bại\"; coi nó là thất bại rồi thử lại mà không có idempotency là cách tạo đơn trùng (xem `idempotency`).",
    },
  ],
  sections: [
    {
      title: "Ba mẫu hay dùng",
      table: {
        head: ["Mẫu", "Code mẫu", "Dùng khi"],
        rows: [
          ["Giới hạn một khối việc", "Python: `async with asyncio.timeout(1.5):` · `user = await get_user(id)` · `orders = await get_orders(id)`", "Cả nhóm lời gọi chung một ngân sách thời gian"],
          ["Truyền deadline qua hàm", "Go: `func GetOrders(ctx context.Context, id string)` → `db.QueryContext(ctx, …)`", "Mọi hàm làm I/O; ctx là tham số đầu tiên"],
          ["Huỷ theo client", "JS: `fetch(url, { signal: AbortSignal.any([req.signal, AbortSignal.timeout(2000)]) })`", "Dừng khi client bỏ đi **hoặc** hết hạn, cái nào tới trước"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi thiết kế API trong phỏng vấn, nói một câu: \"mỗi request có deadline, truyền xuống mọi lời gọi con; client ngắt thì huỷ cả cây; ghi thì có idempotency key\".",
      why: "Ứng viên trung bình chỉ nói \"đặt timeout\". Nói được deadline propagation và huỷ theo client cho thấy bạn đã thấy cảnh việc \"ma\" chạy tiếp sau khi người dùng đã nhận lỗi, và biết vì sao thử lại cần idempotency.",
    },
    {
      t: "Phân biệt rõ với `resilience`: chủ đề đó nói **chọn** timeout, retry, circuit breaker giữa các service; ở đây là **cơ chế trong code** để timeout và huỷ thật sự có tác dụng.",
      why: "Đặt timeout 2 giây ở gateway mà code bên trong không nhận tín hiệu huỷ thì chỉ người dùng được giải thoát, tài nguyên phía server vẫn bị giữ.",
    },
  ],
  cards: [
    ["Timeout khác deadline thế nào?", "Timeout là khoảng thời gian (chờ tối đa 2 giây); deadline là mốc thời gian (xong trước 10:00:02). Truyền qua nhiều lớp thì dùng deadline."],
    ["gRPC mặc định có deadline không?", "Không; client có thể chờ mãi, nên phải tự đặt deadline cho mọi call."],
    ["Vì sao nói huỷ là cooperative?", "Runtime chỉ gửi tín hiệu (`CancelledError` ở `await`, đóng `ctx.Done()`, `signal.aborted`); code chỉ dừng ở chỗ nó kiểm tra tín hiệu."],
    ["Vì sao không nên nuốt `CancelledError` trong Python?", "Timeout, `TaskGroup` dựa vào việc huỷ lan đúng; nuốt nó làm việc chạy tiếp như chưa từng bị huỷ. Dọn dẹp xong thì ném lại."],
    ["Go: quên gọi `cancel()` của `WithTimeout` thì sao?", "Context con và các con của nó bị rò tới khi cha bị huỷ; `go vet` có kiểm tra việc này."],
    ["Client timeout sau khi server đã ghi DB. Thử lại có an toàn không?", "Chỉ khi thao tác idempotent hoặc có idempotency key; huỷ/timeout không hoàn tác việc đã ghi."],
    ["`asyncio.shield` dùng khi nào?", "Khi việc bên trong không được bị huỷ giữa chừng dù việc bên ngoài bị huỷ (ví dụ commit, ghi audit). Phải giữ tham chiếu tới task."],
  ],
});
