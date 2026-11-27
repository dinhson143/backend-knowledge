// Ví dụ code: mỗi đoạn là một dòng Python chạy được (nối lệnh bằng `;`), kết quả ghi sau "→" (D161).
// Đã chạy trên CPython 3.14.6.
BK.topic({
  id: "py-object-model",
  track: "py",
  section: "py-core",
  title: "Names, Objects & Mutability",
  goal: "Giải thích biến, identity, mutability và vì sao sửa một list làm đổi list khác",
  tldr: {
    t: "Trong Python, **biến là tên gắn vào object**, không phải ô nhớ chứa giá trị. Mọi object có **identity** (không đổi suốt đời, so bằng `is`), **type** và **value** (so bằng `==`). Type quyết định object **mutable** (list, dict, set, instance thường) hay **immutable** (int, str, tuple, frozenset). Phép gán và truyền tham số chỉ gắn thêm tên vào cùng object, không copy; vì vậy hai tên cùng trỏ một list thì sửa qua tên này thấy ở tên kia.",
    why: "Data model định nghĩa mỗi object có identity, type, value; identity không đổi sau khi tạo và toán tử `is` so identity (https://docs.python.org/3/reference/datamodel.html). Execution model: \"Names refer to objects. Names are introduced by name binding operations\" (https://docs.python.org/3/reference/executionmodel.html). Không có bước copy ngầm nào, nên mọi \"bất ngờ\" về aliasing đều suy ra từ hai câu này.",
  },
  story: {
    problem: "Service cache cấu hình vào một dict module-level rồi trả thẳng dict đó cho từng request. Một handler sửa `config[\"timeout\"]` cho riêng request của nó, và từ đó mọi request khác cũng dùng timeout mới. Không có dòng nào \"ghi vào cache\", nhưng cache đã bị sửa.",
    idea: "Hỏi hai câu trước mỗi phép gán: **tên này đang trỏ object nào**, và **object đó mutable không**. Muốn tách đời sống của hai giá trị thì phải tạo object mới (copy, hoặc dùng kiểu immutable như tuple, frozenset, `MappingProxyType`).",
    tradeoff: "Copy tốn thời gian O(n) và bộ nhớ; deep copy còn đắt hơn và có thể copy cả thứ lẽ ra phải dùng chung (connection, lock). Immutable thì an toàn khi chia sẻ nhưng mỗi lần \"sửa\" phải tạo object mới.",
  },
  table: {
    head: ["Thao tác", "Ví dụ chạy được", "Điều thật sự xảy ra"],
    rows: [
      {
        cells: ["Gán nhiều tên", "`a = b = []; a.append(1); print(b)` → `[1]`", "Một list, hai tên. `append` sửa object, nên tên nào cũng thấy."],
        why: "Programming FAQ: \"Doing `y = x` doesn't create a copy of the list – it creates a new variable `y` that refers to the same object `x` refers to\" (https://docs.python.org/3/faq/programming.html). Nếu Python copy khi gán thì mọi phép gán list lớn sẽ tốn O(n); Python chọn gắn tên vì rẻ và nhất quán.",
      },
      {
        cells: ["Gán lại (rebind)", "`x = [1]; y = x; x = x + [2]; print(y)` → `[1]`", "`x + [2]` tạo list **mới**, rồi gắn tên `x` sang đó. `y` vẫn trỏ list cũ."],
        why: "Phép gán đổi tên trỏ đi đâu, không đụng object cũ. Đây là khác biệt giữa **rebind một tên** và **mutate một object**; hầu hết bug aliasing là nhầm hai việc này.",
      },
      {
        cells: ["`+=` trên list", "`x = [1]; y = x; x += [2]; print(y)` → `[1, 2]`", "List có `__iadd__` sửa tại chỗ (giống `extend`) rồi trả lại chính nó, nên `y` cũng đổi."],
        why: "Augmented assignment gọi `__iadd__` nếu có và dùng giá trị trả về cho phép gán; không có thì rơi về `__add__` (Data model, emulating numeric types — https://docs.python.org/3/reference/datamodel.html). Với int/str/tuple không có `__iadd__`, `+=` tạo object mới; với list thì sửa tại chỗ. Cùng một ký hiệu, hai ngữ nghĩa, tuỳ type.",
      },
      {
        cells: ["Truyền tham số", "`def f(l): l.append(1); l = [9]; return l` rồi `m = []; f(m); print(m)` → `[1]`", "Tham số là tên cục bộ gắn vào cùng object. `append` sửa object của caller; `l = [9]` chỉ gắn lại tên cục bộ."],
        why: "FAQ: \"arguments are passed by assignment in Python. Since assignment just creates references to objects, there's no alias between an argument name in the caller and callee, and consequently no call-by-reference\" (https://docs.python.org/3/faq/programming.html). Vì vậy câu trả lời phỏng vấn là \"pass by object reference / by assignment\": không phải by value (object không bị copy), cũng không phải by reference (gán lại tham số không đổi biến của caller).",
      },
      {
        cells: ["Tuple chứa list", "`t = (1, [2]); t[1].append(3); print(t)` → `(1, [2, 3])`; `hash(t)` → `TypeError: unhashable type: 'list'`", "Tuple immutable nghĩa là **không đổi được nó trỏ tới object nào**, không có nghĩa value không đổi."],
        why: "Data model: một container immutable chứa tham chiếu tới object mutable thì value của nó vẫn đổi khi object con đổi, nhưng nó vẫn được coi là immutable \"because the collection of objects it contains cannot be changed\" (https://docs.python.org/3/reference/datamodel.html). Hash của tuple tính từ hash các phần tử, nên một phần tử unhashable làm cả tuple unhashable.",
      },
    ],
  },
  points: [
    {
      t: "**`is` khác `==`** — `is` hỏi \"cùng một object không\" (so identity); `==` gọi `__eq__` hỏi \"value có bằng không\". Chỉ dùng `is` khi identity được bảo đảm: so với singleton (`None`, `True`, `False`, `...`, sentinel tự tạo bằng `object()`).",
      why: "FAQ \"When can I rely on identity tests with the is operator?\" liệt kê đúng ba trường hợp identity được bảo đảm: sau phép gán, sau khi bỏ vào container, và singleton; còn lại nên dùng `==` (https://docs.python.org/3/faq/programming.html). PEP 8: so với singleton như `None` luôn dùng `is`/`is not`, không dùng toán tử bằng (https://peps.python.org/pep-0008/). Lý do cơ học: `==` gọi `__eq__` của object, và class tự viết có thể trả `True` khi so với `None`; `is` thì không ai ghi đè được.",
    },
    {
      t: "**Bẫy `is` với số và chuỗi** — `a = 10_000_000; b = 5_000_000; c = b + 5_000_000; print(a == c, a is c)` → `True False`. Với số nhỏ thì `int(\"256\") is int(\"256\")` → `True`, nhưng `int(\"257\") is int(\"257\")` → `False` (CPython 3.14).",
      why: "CPython giữ sẵn một mảng object cho số nguyên nhỏ và trả lại object có sẵn thay vì tạo mới. Tài liệu C API của 3.14 ghi dải -5 tới 256 (https://docs.python.org/3.14/c-api/long.html); tài liệu bản mới nhất ghi -5 tới 1024 (https://docs.python.org/3/c-api/long.html). Đây là **implementation detail**, đổi theo phiên bản, nên code đúng không bao giờ dựa vào nó. Hằng số trong cùng một file còn có thể bị compiler gộp, vì vậy ví dụ dùng giá trị tính lúc chạy; CPython cũng phát `SyntaxWarning` khi thấy `x is 257`.",
    },
    {
      t: "**`id()`** — trả số nguyên đại diện identity, duy nhất trong lúc object còn sống. Trong CPython `id(x)` là địa chỉ bộ nhớ, nên hai object **không sống cùng lúc** có thể có cùng `id`.",
      why: "Data model: \"For CPython, `id(x)` is the memory address where `x` is stored\" (https://docs.python.org/3/reference/datamodel.html). Object bị giải phóng thì vùng nhớ được dùng lại, nên `id([]) == id([])` có thể ra `True`: list thứ nhất đã chết trước khi list thứ hai được tạo ở cùng chỗ. Đừng lưu `id()` làm khoá lâu dài.",
    },
    {
      t: "**`x in container` dùng cả `is` lẫn `==`** — `nan = float(\"nan\"); print(nan == nan, nan in [nan])` → `False True`.",
      why: "Với list, tuple, set, dict, deque, `x in y` tương đương `any(x is e or x == e for e in y)` (Expressions, membership tests — https://docs.python.org/3/reference/expressions.html). Kiểm identity trước giúp container không bị \"lừa\" bởi object không bằng chính nó như NaN.",
    },
    {
      t: "**Shallow copy và deep copy** — `n = [[1, 2], [3]]; s = copy.copy(n); d = copy.deepcopy(n); n[0].append(9)` → `s` là `[[1, 2, 9], [3]]`, `d` vẫn là `[[1, 2], [3]]`. `list(x)`, `x[:]`, `x.copy()`, `dict(d)` đều là shallow copy.",
      why: "Module `copy`: \"Assignment statements in Python do not copy objects\"; shallow copy tạo container mới nhưng chèn **tham chiếu** tới các object con, deep copy chèn **bản sao** đệ quy (https://docs.python.org/3/library/copy.html). Vì vậy shallow copy chỉ an toàn khi phần tử là immutable; list lồng nhau thì các list con vẫn dùng chung.",
    },
    {
      t: "+ **`deepcopy` xử lý vòng tham chiếu bằng memo** — `a = [1]; a.append(a); b = copy.deepcopy(a); print(b[1] is b)` → `True`. Class có thể tự định nghĩa `__copy__`/`__deepcopy__`; từ 3.13 có `copy.replace()` cho dataclass, namedtuple và class có `__replace__`.",
      why: "`deepcopy` giữ một dict `memo` các object đã copy trong lượt hiện tại, gặp lại thì dùng bản đã copy; không có memo thì cấu trúc vòng sẽ đệ quy vô hạn (https://docs.python.org/3/library/copy.html). Trang đó cũng cảnh báo deep copy \"may copy too much\": dữ liệu lẽ ra dùng chung (cache, connection) cũng bị nhân bản.",
    },
    {
      t: "+ **Copy tuple trả lại chính nó** — `t = (1, 2); print(copy.copy(t) is t, t[:] is t)` → `True True`. Copy list, dict, set thì O(n).",
      why: "Object immutable không cần copy vì không ai sửa được nó; trả lại chính object là O(1) và an toàn. Trang \"Time complexity of built-in types\" ghi copy tuple, frozenset là O(1), copy list/dict/set là O(n) (https://docs.python.org/3/builtins/time-complexity.html).",
    },
  ],
  sections: [
    {
      title: "Bảng mutable / immutable hay gặp",
      table: {
        head: ["Immutable (hashable nếu phần tử hashable)", "Mutable (không dùng làm key dict)"],
        rows: [
          ["`int`, `float`, `bool`, `complex`, `str`, `bytes`, `tuple`, `frozenset`, `range`, `None`", "`list`, `dict`, `set`, `bytearray`, instance của class tự viết (mặc định), `collections.deque`"],
          {
            cells: ["Dataclass `frozen=True`, `typing.NamedTuple`", "Dataclass thường, module, function (có thể gán thuộc tính)"],
            why: "Instance của class tự viết mặc định hashable theo identity (vì kế thừa `object.__hash__`) dù vẫn mutable; chỉ khi bạn định nghĩa `__eq__` mà không định nghĩa `__hash__` thì nó thành unhashable (https://docs.python.org/3/reference/datamodel.html). Chi tiết ở bài Data Model & Dunder Methods.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"Python truyền tham trị hay tham chiếu?\": trả lời \"pass by assignment / object reference\" và chứng minh bằng hai dòng: `append` trong hàm làm đổi list của caller, còn gán lại tham số thì không.",
      why: "Interviewer hỏi câu này để xem bạn phân biệt được mutate và rebind. Nói \"by reference\" là sai (gán lại tham số không đổi biến ngoài); nói \"by value\" cũng sai (object không bị copy).",
    },
    {
      t: "Trả về dữ liệu nội bộ (cache, config, state) cho code bên ngoài: trả bản copy hoặc view chỉ đọc (`types.MappingProxyType(d)`, `tuple(lst)`), đừng trả thẳng object mutable.",
      why: "Bên gọi có tên trỏ vào cùng object, nên chỉ một dòng sửa ở handler là làm hỏng state dùng chung, như ví dụ cache config ở trên. `MappingProxyType` là view chỉ đọc của dict, có từ module `types` (https://docs.python.org/3/library/types.html).",
    },
  ],
  cards: [
    ["`a = b = []` rồi `a.append(1)`, `b` là gì? Vì sao?", "`[1]`. `a` và `b` là hai tên gắn vào **cùng một** list; `append` sửa object chứ không gắn lại tên."],
    ["`is` khác `==` thế nào, khi nào dùng `is`?", "`is` so identity (cùng object), `==` so value qua `__eq__`. Dùng `is` cho singleton: `None`, `True`/`False`, sentinel tự tạo. Không dùng `is` để so số hay chuỗi."],
    ["Vì sao `int(\"257\") is int(\"257\")` ra `False` mà 256 thì `True` (CPython 3.14)?", "CPython cache sẵn object số nguyên nhỏ (dải -5…256 ở 3.14, bản mới hơn mở rộng); ngoài dải thì mỗi lần tạo object mới. Đây là implementation detail, không được dựa vào."],
    ["Python truyền tham số kiểu gì?", "By assignment (object reference): tham số là tên mới gắn vào cùng object. Sửa object thì caller thấy; gán lại tham số thì không."],
    ["`x = [1]; y = x; x += [2]` khác `x = x + [2]` ở đâu?", "`+=` gọi `list.__iadd__`, sửa list tại chỗ nên `y` cũng thành `[1, 2]`. `x + [2]` tạo list mới rồi gắn `x` sang, `y` giữ `[1]`."],
    ["Shallow copy một list lồng nhau có an toàn không?", "Không nếu bạn sửa list con: shallow copy chỉ copy lớp ngoài, các list con vẫn dùng chung. Dùng `copy.deepcopy` hoặc tự copy từng lớp."],
    ["Tuple là immutable, vậy `t = (1, [2])` có đổi được không?", "List bên trong vẫn `append` được, nên value của tuple đổi; cái không đổi là tuple trỏ tới object nào. Tuple đó cũng không hash được."],
    ["Vì sao `nan in [nan]` là `True` dù `nan == nan` là `False`?", "Phép `in` của container kiểm `x is e or x == e`; cùng object nên `is` đúng trước."],
  ],
});
