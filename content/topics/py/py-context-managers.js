// Ví dụ code ngắn: một dòng chạy được trong câu, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
// Context manager nhiều dòng là khối code (D13, D201): thụt lề thật, "vì sao" thành chú thích dòng.
// Title không có backtick quanh `with` vì nhãn điều hướng không render markup (D160).
BK.topic({
  id: "py-context-managers",
  track: "py",
  section: "py-core",
  title: "Context Managers & with",
  goal: "Viết context manager mở/đóng resource an toàn và quản lý số resource không biết trước",
  needs: ["py-iterators-generators"],
  tldr: {
    t: "**Context manager** là object lo việc mở và đóng một resource quanh một khối code: `with cm as x:` gọi `cm.__enter__()` (kết quả gán vào `x`), chạy khối, rồi **luôn** gọi `cm.__exit__(exc_type, exc, tb)`, kể cả khi khối ném exception hay `return` giữa chừng. `__exit__` trả giá trị truthy thì exception bị **nuốt**; trả `False`/`None` thì exception đi tiếp. Viết nhanh bằng `@contextlib.contextmanager` (generator `yield` đúng một lần); số resource không biết trước thì dùng `contextlib.ExitStack`.",
    why: "PEP 343 (Python 2.5) thêm `with` để \"factor out standard uses of try/finally statements\" (https://peps.python.org/pep-0343/). Language reference viết `with` ra thành `try/except/finally` gọi `__exit__` trong mọi nhánh, và `if not exit(*sys.exc_info()): raise`: `__exit__` trả falsy thì exception được ném lại (https://docs.python.org/3/reference/compound_stmts.html).",
  },
  story: {
    problem: "Worker lấy connection từ pool, chạy query, rồi `pool.release(conn)` ở dòng cuối. Mỗi khi query lỗi, dòng release bị bỏ qua. Sau vài giờ pool cạn, mọi request treo chờ connection: lỗi không nằm ở query mà ở connection không được trả.",
    idea: "Gói cặp lấy/trả vào một context manager. Code gọi chỉ viết `with pool.connection() as conn:`; việc trả connection nằm trong `__exit__` hoặc `finally`, chạy trên mọi đường ra khỏi khối.",
    tradeoff: "`with` chỉ bảo vệ trong phạm vi một khối lệnh. Resource cần sống lâu hơn một khối (connection dùng suốt đời app) phải quản lý bằng vòng đời app (lifespan của framework), và `__exit__` nuốt exception sai chỗ thì bug biến mất không dấu vết.",
  },
  points: [
    {
      t: "**Viết bằng class** — `__enter__` mở và trả resource; `__exit__(self, exc_type, exc, tb)` đóng và trả `False`. Class `Conn` in log khi mở/đóng: `with Conn(\"db\") as c: raise ValueError(\"boom\")` in `open db`, `close db ValueError`, rồi `ValueError` vẫn bay ra ngoài, và `c.open` → `False`.",
      why: "`__enter__` trả gì thì `as` nhận nấy (thường là `self`); `__exit__` nhận thông tin exception, hoặc ba `None` khi khối chạy bình thường (https://docs.python.org/3/reference/datamodel.html). Class hợp khi context manager có trạng thái hoặc cần dùng lại; generator ngắn hơn cho trường hợp đơn giản.",
    },
    {
      t: "**`__exit__` trả `True` là nuốt exception** — class `Swallow` có `__exit__` trả `True`: `with Swallow(): 1 / 0` chạy tiếp như không có gì. Nuốt có chủ đích thì dùng `contextlib.suppress(FileNotFoundError)`, ghi rõ loại lỗi.",
      why: "Docs: muốn chặn exception thì `__exit__` \"should return a true value\" (https://docs.python.org/3/reference/datamodel.html). Một `return True` vô ý (hoặc `return self.ok` có lúc truthy) làm mất mọi lỗi trong khối. `suppress` chỉ nên bao \"very specific errors where silently continuing … is known to be the right thing\" (https://docs.python.org/3/library/contextlib.html).",
    },
    {
      t: "**`__enter__` lỗi thì `__exit__` không chạy** — class `BadEnter` ném `OSError` trong `__enter__`: `with BadEnter(): pass` ném `OSError` và `__exit__` không được gọi.",
      why: "Trong bản viết ra của `with`, `enter()` được gọi **trước** khối `try` chứa `exit` (https://docs.python.org/3/reference/compound_stmts.html). Vì vậy `__enter__` phải tự dọn phần đã mở dở trước khi ném lỗi; nếu không, resource mở được một nửa sẽ bị rò.",
    },
    {
      t: "**Nhiều context manager trên một dòng** — `with Conn(\"p\") as p, Conn(\"q\") as q:` mở p rồi q, đóng q rồi p. Từ 3.10 có thể bọc danh sách trong ngoặc tròn để xuống dòng.",
      why: "Nhiều item được xử lý \"as if multiple with statements were nested\" (https://docs.python.org/3/reference/compound_stmts.html), nên thứ tự đóng ngược thứ tự mở: resource mở sau (có thể phụ thuộc resource mở trước) được đóng trước.",
    },
    {
      t: "**Số resource không biết trước: `ExitStack`** — `with ExitStack() as stack: conns = [stack.enter_context(Conn(n)) for n in (\"a\", \"b\", \"c\")]` mở a, b, c và khi ra khỏi khối đóng c, b, a. `stack.callback(fn, *args)` đăng ký hàm dọn dẹp bất kỳ.",
      why: "`ExitStack` được thiết kế để \"programmatically combine other context managers and cleanup functions, especially those that are optional or otherwise driven by input data\"; callback chạy theo thứ tự ngược khi stack đóng (https://docs.python.org/3/library/contextlib.html). Nếu mở tới file thứ 3 thì lỗi, hai file đầu vẫn được đóng. `pop_all()` chuyển các callback sang stack mới khi muốn giữ resource mở sau khi khối kết thúc thành công.",
    },
    {
      t: "**`async with`** — dùng `__aenter__`/`__aexit__` (đều trả awaitable, thường viết bằng `async def`) cho resource mà mở/đóng cần `await`: connection pool async, HTTP client session. Viết nhanh bằng `@contextlib.asynccontextmanager` trên `async def` có `yield`.",
      why: "Mở/đóng connection async phải chờ I/O; `__enter__` thường không `await` được nên cần giao thức riêng (PEP 492 — https://peps.python.org/pep-0492/). `asynccontextmanager` có từ 3.7 (https://docs.python.org/3/library/contextlib.html).",
    },
    {
      t: "**Context manager có sẵn hay gặp** — `open()` (đóng file), `threading.Lock` (`with lock:` tự release), `contextlib.closing(x)` (gọi `x.close()`), `contextlib.nullcontext(x)` (không làm gì, dùng khi context manager là tuỳ chọn), `unittest.mock.patch`, `decimal.localcontext`.",
      why: "Lock dùng `with` thì không bao giờ quên release khi có exception, nguyên nhân deadlock phổ biến. `nullcontext` được thiết kế làm \"stand-in for an optional context manager\" (https://docs.python.org/3/library/contextlib.html), tránh phải viết hai nhánh `if` có và không có `with`.",
    },
    {
      t: "**Phần lớn context manager chỉ dùng một lần** — object tạo bởi `@contextmanager` dùng lần hai trong `with` sẽ lỗi; tạo mới mỗi lần (gọi lại hàm).",
      why: "Docs chia ba loại: single use, reusable và reentrant (dùng lồng trong chính nó). Generator đã chạy hết thì không yield lại được, nên context manager từ generator là single use (https://docs.python.org/3/library/contextlib.html).",
    },
  ],
  sections: [
    {
      title: "@contextmanager cho transaction",
      code: {
        lang: "python",
        lines: [
          "import contextlib",
          "",
          ["@contextlib.contextmanager", "Biến generator function thành context manager."],
          ["def transaction(conn):", "Nhận resource cần bọc."],
          ["    conn.execute(\"BEGIN\")", "Phần trước `yield` = `__enter__`."],
          "    try:",
          ["        yield conn", "Giá trị `yield` được gán vào biến sau `as`. Generator phải yield **đúng một lần**. Exception xảy ra trong khối `with` được ném lại vào generator **ngay tại `yield`** (https://docs.python.org/3/library/contextlib.html). Không có `try` quanh `yield` thì phần dọn dẹp phía dưới không bao giờ chạy khi khối lỗi: generator chỉ có `log.append(\"open\"); yield; log.append(\"close\")` cho ra `['open']` sau một khối ném `ValueError`."],
          "    except Exception:",
          "        conn.execute(\"ROLLBACK\")",
          ["        raise", "Lỗi thì rollback rồi **ném lại**. Docs: nếu bắt exception chỉ để log hay dọn dẹp, generator \"must reraise that exception\"; không thì `with` coi như đã xử lý xong và chạy tiếp lệnh sau khối (https://docs.python.org/3/library/contextlib.html). Quên `raise` ở đây là nuốt lỗi."],
          "    else:",
          ["        conn.execute(\"COMMIT\")", "Không lỗi thì commit."],
          "",
          ["class FakeConn:", "Connection giả ghi lại câu lệnh vào một list làm log, để thử cả hai nhánh."],
          "    def __init__(self):",
          "        self.log = []",
          "",
          "    def execute(self, sql):",
          "        self.log.append(sql)",
          "",
          "c = FakeConn()",
          "with transaction(c) as conn:",
          "    conn.execute(\"UPDATE\")",
          ["print(c.log)", "Khối chạy bình thường → `['BEGIN', 'UPDATE', 'COMMIT']`."],
          "",
          "c = FakeConn()",
          "try:",
          "    with transaction(c):",
          "        raise KeyError(\"x\")",
          "except KeyError:",
          ["    print(c.log)", "Khối ném `KeyError` → `['BEGIN', 'ROLLBACK']`, và `KeyError` vẫn ra ngoài `with` nên `except` này bắt được."],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"viết context manager mở/đóng kết nối DB\": viết bản `@contextmanager`: `yield conn` nằm trong `try`; nhánh `except` rollback rồi `raise`; nhánh `else` commit; nhánh `finally` gọi `conn.close()`. Rồi nói vì sao cần từng nhánh.",
      why: "Interviewer kiểm tra ba điều: dọn dẹp chạy cả khi lỗi (`finally`), lỗi không bị nuốt (`raise`), commit chỉ khi thành công (`else`). Thiếu `raise` là lỗi phổ biến nhất.",
    },
    {
      t: "Ở backend, resource sống theo app (pool, client) nên mở trong lifespan của framework (ví dụ ASGI lifespan), còn resource theo request (session, transaction) thì mở bằng `with`/`async with` trong handler hoặc dependency.",
      why: "Mở pool trong mỗi request làm mất ý nghĩa pool; giữ transaction ngoài phạm vi request làm lock DB sống quá lâu. Context manager cho bạn ranh giới rõ ràng cho từng loại vòng đời.",
    },
  ],
  cards: [
    ["`__exit__` trả `True` nghĩa là gì?", "Exception trong khối bị chặn lại, chương trình chạy tiếp sau `with`. Trả `False`/`None` thì exception đi tiếp."],
    ["`with` tương đương đoạn code nào?", "Gọi `__enter__`, rồi `try:` chạy khối; `except:` gọi `__exit__(type, exc, tb)` và ném lại nếu nó trả falsy; `finally` (khi không lỗi) gọi `__exit__(None, None, None)`."],
    ["Viết context manager bằng generator cần lưu ý gì?", "Yield đúng một lần; bọc `yield` trong `try/finally` để dọn dẹp khi khối lỗi; nếu `except` thì phải `raise` lại, nếu không lỗi bị nuốt."],
    ["Quản lý số lượng resource không biết trước?", "`contextlib.ExitStack`: `enter_context` cho từng resource, mọi `__exit__` chạy theo thứ tự ngược khi ra khỏi khối, kể cả khi mở dở thì lỗi."],
    ["`__enter__` ném exception thì `__exit__` có chạy không?", "Không. `__enter__` chạy trước `try`; nó phải tự dọn phần đã mở."],
    ["Nhiều context manager trong một `with` đóng theo thứ tự nào?", "Ngược thứ tự mở (như `with` lồng nhau)."],
    ["Khi nào cần `async with`?", "Khi mở/đóng resource phải `await` (connection async, HTTP session); dùng `__aenter__`/`__aexit__` hoặc `@asynccontextmanager`."],
  ],
});
