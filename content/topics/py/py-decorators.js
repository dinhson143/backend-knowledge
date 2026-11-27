// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
// Decorator nhiều dòng được viết thành các dòng bảng liên tiếp, mỗi dòng một câu lệnh.
BK.topic({
  id: "py-decorators",
  track: "py",
  section: "py-core",
  title: "Decorators",
  goal: "Viết decorator có `wraps`, có tham số, và dùng `functools.cache` không gây leak",
  needs: ["py-scope-closures"],
  tldr: {
    t: "**Decorator** là hàm nhận một hàm và trả hàm thay thế. `@deco` đặt trên `def f` chỉ là cú pháp rút gọn của `f = deco(f)`, chạy **một lần lúc định nghĩa hàm** (thường là lúc import module). Hàm thay thế thường là một closure gọi lại hàm gốc, nên decorator xây trên closure. Decorator đúng chuẩn dùng `functools.wraps` để giữ tên, docstring của hàm gốc; decorator có tham số cần thêm một lớp hàm: `@retry(times=3)` nghĩa là `f = retry(times=3)(f)`.",
    why: "Glossary: decorator là \"a function returning another function\" và cú pháp `@` \"is merely syntactic sugar\" (https://docs.python.org/3/glossary.html). Language reference: `@f1(arg) @f2 def func()` tương đương `func = f1(arg)(f2(func))` (https://docs.python.org/3/reference/compound_stmts.html). PEP 318 (Python 2.4) thêm cú pháp này để phép biến đổi như `classmethod` nằm ngay trên `def` thay vì cách xa sau thân hàm, và decorator \"executed at the time the function is defined\" (https://peps.python.org/pep-0318/).",
  },
  story: {
    problem: "Team thêm decorator `@log_calls` cho mọi handler. Từ hôm đó dashboard metric gom hết thành một endpoint tên `wrapper`, tài liệu API sinh tự động mất docstring, và một framework định tuyến theo tên hàm báo trùng route.",
    idea: "Hàm thay thế là một object khác với `__name__ = \"wrapper\"`. `functools.wraps(fn)` chép `__name__`, `__qualname__`, `__doc__`, `__module__`, annotations sang wrapper và gắn `__wrapped__` trỏ về hàm gốc, nên công cụ nhìn vào thấy đúng hàm.",
    tradeoff: "Decorator gom logic cắt ngang (log, đo thời gian, retry, auth, cache) vào một chỗ, nhưng che mất luồng chạy: đọc `def` không thấy hết hàm làm gì, stack trace dài thêm một tầng, và decorator chạy lúc import nên lỗi trong nó làm hỏng cả module.",
  },
  table: {
    head: ["Dòng", "Code (decorator đo thời gian)", "Vì sao viết vậy"],
    rows: [
      ["1", "`def timed(fn):`", "Nhận hàm gốc làm tham số"],
      {
        cells: ["2", "`    @functools.wraps(fn)`", "Chép metadata của `fn` sang wrapper"],
        why: "`wraps` gán `__module__`, `__name__`, `__qualname__`, `__annotations__`, `__type_params__`, `__doc__`, cập nhật `__dict__` và thêm `__wrapped__` (https://docs.python.org/3/library/functools.html). Có nó: `add.__name__, add.__doc__` → `add cộng`; không có: → `wrapper None`.",
      },
      {
        cells: ["3", "`    def wrapper(*args, **kwargs):`", "Nhận mọi kiểu tham số để bọc được hàm bất kỳ"],
        why: "Wrapper không biết chữ ký của hàm gốc, nên chuyển nguyên mọi tham số vị trí và tham số tên. Nhờ `__wrapped__`, `inspect.signature(add)` vẫn trả `(a, b)` của hàm gốc.",
      },
      ["4", "`        t0 = time.perf_counter()`", "`perf_counter` là đồng hồ có độ phân giải cao nhất để đo khoảng thời gian ngắn; trên CPython nó là monotonic. `time.time()` có thể lùi khi đồng hồ hệ thống bị chỉnh (https://docs.python.org/3/library/time.html)"],
      {
        cells: ["5", "`        try: return fn(*args, **kwargs)`", "Gọi hàm gốc và trả kết quả của nó"],
        why: "Quên `return` là lỗi hay gặp nhất: hàm được bọc luôn trả `None`.",
      },
      {
        cells: ["6", "`        finally: print(f\"{fn.__name__} {time.perf_counter() - t0:.4f}s\")`", "Đo cả khi hàm ném exception"],
        why: "`finally` chạy cả khi `fn` lỗi, nên các lần gọi lỗi (thường là lần chậm, như timeout) không biến mất khỏi số đo.",
      },
      ["7", "`    return wrapper`", "Trả hàm thay thế; `@timed` trên `def add` nghĩa là `add = timed(add)`"],
    ],
  },
  points: [
    {
      t: "**Decorator có tham số = ba lớp hàm** — `def retry(times): def deco(fn): @wraps(fn) def wrapper(*a, **k): ...; return wrapper; return deco` (viết nhiều dòng). `@retry(times=3)` gọi `retry(3)` trước, lấy về `deco`, rồi `deco(flaky)`. Hàm `flaky` lỗi hai lần đầu: gọi một lần → `ok`, chạy 3 lần.",
      why: "Biểu thức sau `@` được tính trước, kết quả của nó mới là decorator (https://docs.python.org/3/reference/compound_stmts.html). `times` sống trong closure của `deco` và `wrapper` (bài Scope, Closures & Late Binding). Từ 3.9 biểu thức sau `@` có thể là biểu thức bất kỳ (PEP 614), nhưng ba lớp hàm vẫn là dạng chuẩn.",
    },
    {
      t: "**Quên ngoặc** — viết `@retry` (không gọi) trên `def oops()` thì `oops = retry(oops)` là hàm `deco`; gọi `oops()` → `TypeError: retry.<locals>.deco() missing 1 required positional argument: 'fn'`.",
      why: "Lỗi chỉ lộ ra lúc gọi, không lúc định nghĩa. Một số thư viện cho phép cả `@deco` lẫn `@deco(...)` bằng cách kiểm tham số đầu có phải hàm không; tự viết thì nên chọn một dạng và giữ nhất quán.",
    },
    {
      t: "**Thứ tự: gần `def` nhất chạy trước** — `@d1` trên `@d2` trên `def z` in `d2` rồi `d1` lúc định nghĩa, tức `z = d1(d2(z))`. Khi gọi, wrapper của `d1` chạy ngoài cùng.",
      why: "PEP 318: thứ tự áp dụng từ dưới lên \"matches the usual order for function-application\" (https://peps.python.org/pep-0318/). Thứ tự quan trọng: đặt `@cache` ngoài `@timed` thì lần gọi trúng cache không được đo; đặt trong thì có.",
    },
    {
      t: "**Decorator chạy lúc import** — decorator `register` thêm hàm vào dict `reg` rồi trả lại chính hàm: chỉ cần import module là `reg` đã có `{'h': <function h>}`, chưa gọi hàm nào.",
      why: "Đây là cách Flask `@app.route`, pytest fixture, Celery `@app.task` đăng ký hàm: thân decorator chạy khi `def` được thực thi (https://peps.python.org/pep-0318/). Hệ quả: code nặng hoặc có side effect (kết nối DB) trong thân decorator chạy ngay lúc import.",
    },
    {
      t: "**Decorator bằng class** — class có `__init__(self, fn)` gọi `functools.update_wrapper(self, fn)` và `__call__` đếm số lần gọi: `@CountCalls def hi()`, gọi hai lần thì `hi.n` → `2`, `hi.__name__` → `'hi'`.",
      why: "Instance có `__call__` gọi được như hàm (bài Data Model & Dunder Methods), và giữ trạng thái bằng thuộc tính thay vì `nonlocal`. `update_wrapper` là dạng hàm của `wraps` (https://docs.python.org/3/library/functools.html). Lưu ý: class decorator kiểu này đặt trên method sẽ không nhận `self` vì class không phải descriptor như function.",
    },
    {
      t: "+ **Class decorator** — decorator đặt trên `class` nhận class và trả class: `@dataclass`, `@functools.total_ordering` là ví dụ quen thuộc.",
      why: "Cùng cơ chế `C = deco(C)`, có từ Python 2.6 (PEP 3129 — https://peps.python.org/pep-3129/). Thường dùng để thêm method hoặc đăng ký class, thay cho metaclass trong đa số trường hợp.",
    },
  ],
  sections: [
    {
      title: "functools.cache và lru_cache",
      table: {
        head: ["Ý", "Ví dụ chạy được", "Cơ chế"],
        rows: [
          {
            cells: ["`@cache` (3.9+): memoize không giới hạn", "`@functools.cache` trên `def fib(n)` đệ quy: `fib(100)` → `354224848179261915075`, `cache_info()` → `hits=98, misses=101`", "Bằng `lru_cache(maxsize=None)` nhưng nhỏ và nhanh hơn vì không phải đẩy phần tử cũ ra"],
            why: "\"Returns the same as `lru_cache(maxsize=None)`… this is smaller and faster than `lru_cache()` with a size limit\" (https://docs.python.org/3/library/functools.html). Không giới hạn nghĩa là bộ nhớ tăng theo số input khác nhau: an toàn cho `fib`, nguy hiểm cho hàm nhận user id.",
          },
          {
            cells: ["`@lru_cache(maxsize=N)`: giữ N kết quả gần nhất", "`maxsize=2`, gọi `sq(1); sq(2); sq(1); sq(3)` → `hits=1, misses=3, currsize=2`", "Mặc định `maxsize=128`; đầy thì bỏ kết quả lâu nhất không dùng"],
            why: "Chữ ký mặc định `lru_cache(maxsize=128, typed=False)` (https://docs.python.org/3/library/functools.html). Dùng cho cache trong process có giới hạn bộ nhớ; nhiều process (worker Gunicorn) thì mỗi process một cache riêng, không chia sẻ.",
          },
          {
            cells: ["Tham số phải hashable", "`@cache` trên `def f(x)`, gọi `f([1])` → `TypeError: unhashable type: 'list'`", "Cache là dict có key từ tham số"],
            why: "\"Since a dictionary is used to cache results, the positional and keyword arguments to the function must be hashable\" (https://docs.python.org/3/library/functools.html). Truyền tuple thay list, frozenset thay set.",
          },
          {
            cells: ["**`lru_cache` trên method giữ instance sống**", "Class `Svc` có `@lru_cache` trên `def get(self, k)`; gọi `s.get(1)`, `del s`, `gc.collect()`: weakref tới `s` vẫn sống, tới khi `Svc.get.cache_clear()`", "`self` là một phần của key, nên cache (gắn với class) giữ tham chiếu tới mọi instance từng gọi"],
            why: "functools: \"If a method is cached, the `self` instance argument is included in the cache\"; Programming FAQ: với `lru_cache` trên method, \"instances are kept alive until they age out of the cache or until the cache is cleared\" (https://docs.python.org/3/faq/programming.html). Với `maxsize=None` thì không bao giờ age out: leak. Method không tham số thì dùng `cached_property` (lưu vào `__dict__` của instance, chết theo instance).",
          },
          {
            cells: ["Không dùng cho hàm có side effect hoặc không thuần", "Không cache `time()`, `random()`, hàm trả object mutable mới mỗi lần, generator, hàm async", "Kết quả được trả lại y nguyên từ cache"],
            why: "Docs liệt kê đúng các loại này là không nên cache (https://docs.python.org/3/library/functools.html). Hàm trả list rồi caller sửa list đó thì lần gọi sau nhận list đã bị sửa: lại là bẫy aliasing.",
          },
          {
            cells: ["Thread-safe nhưng không bảo đảm gọi một lần", "Hai thread cùng miss một key có thể cùng chạy hàm gốc", "Cache không giữ lock trong lúc gọi hàm"],
            why: "Cấu trúc cache vẫn nhất quán khi cập nhật đồng thời, nhưng \"it is possible for the wrapped function to be called more than once\" (https://docs.python.org/3/library/functools.html). Đây chính là cache stampede ở quy mô một process.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Viết decorator trên bảng: luôn có `@functools.wraps(fn)`, `*args, **kwargs`, và `return fn(...)`. Sau đó tự nói ba điều đó tránh được bug gì.",
      why: "Ba lỗi phổ biến nhất của decorator tự viết đúng là thiếu ba thứ này. Nói ra cho interviewer thấy bạn đã từng debug chúng chứ không chỉ chép mẫu.",
    },
    {
      t: "Câu \"`lru_cache` trên method gây leak vì sao?\": `self` nằm trong key, cache gắn với hàm ở mức class và sống suốt process, nên instance không bao giờ được thu hồi; sửa bằng `cached_property`, `maxsize` hữu hạn, hoặc cache theo từng instance.",
      why: "Đây là câu phân biệt người dùng `lru_cache` với người hiểu cache giữ tham chiếu. Ở backend, instance thường giữ connection hoặc dữ liệu lớn, nên leak này lộ ra thành bộ nhớ tăng dần cho tới khi worker bị restart.",
    },
  ],
  cards: [
    ["`@deco` trên `def f` tương đương gì?", "`f = deco(f)`, chạy một lần khi `def` được thực thi (thường là lúc import)."],
    ["Viết decorator đo thời gian chạy?", "`def timed(fn)`: bên trong `@wraps(fn) def wrapper(*args, **kwargs)`, lấy `perf_counter()` trước, `try: return fn(*args, **kwargs)`, `finally:` log thời gian; `return wrapper`."],
    ["Decorator có tham số cần mấy lớp hàm?", "Ba: hàm nhận tham số → trả decorator → decorator trả wrapper. `@retry(3)` là `f = retry(3)(f)`."],
    ["Quên `functools.wraps` mất gì?", "`__name__`, `__qualname__`, `__doc__`, `__module__`, annotations của hàm gốc (wrapper hiện tên `wrapper`) và `__wrapped__` để truy về hàm gốc."],
    ["`lru_cache` trên method gây leak vì sao?", "`self` là một phần key; cache sống ở mức class nên giữ mọi instance tới khi age out hoặc `cache_clear()`. Dùng `cached_property` hoặc `maxsize` hữu hạn."],
    ["Hai decorator chồng nhau áp dụng theo thứ tự nào?", "Từ dưới lên: `@a @b def f` là `f = a(b(f))`. Khi gọi, wrapper của `a` chạy ngoài cùng."],
    ["`functools.cache` khác `lru_cache` thế nào?", "`cache` (3.9+) = `lru_cache(maxsize=None)`: không giới hạn, nhanh hơn, có thể phình bộ nhớ. `lru_cache` mặc định giữ 128 kết quả gần nhất."],
  ],
});
