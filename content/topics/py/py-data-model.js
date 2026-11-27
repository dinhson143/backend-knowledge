// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
BK.topic({
  id: "py-data-model",
  track: "py",
  section: "py-core",
  title: "Data Model & Dunder Methods",
  goal: "Viết class hỗ trợ `len()`, `for`, `==`, `+` và dùng được làm key dict bằng dunder method",
  needs: ["py-object-model"],
  tldr: {
    t: "**Data model** là bộ giao thức để object của bạn chạy được với cú pháp và hàm có sẵn. Mỗi giao thức là một **dunder method** (special method, tên có hai gạch dưới hai đầu): `len(x)` gọi `x.__len__()`, `x == y` gọi `__eq__`, `for` gọi `__iter__`, `x + y` gọi `__add__`. Bạn không gọi chúng trực tiếp; interpreter gọi khi gặp cú pháp tương ứng, và tra method **trên type**, không trên instance.",
    why: "Data model, §3.3 Special method names: đây là cách Python cho phép class \"define their own behavior with respect to language operators\" (https://docs.python.org/3/reference/datamodel.html). Nhờ một tập giao thức chung, `sorted`, `sum`, `in`, `random.choice` chạy được với class bạn viết mà không cần kế thừa gì.",
  },
  story: {
    problem: "Team định nghĩa `__eq__` cho class `UserId` để so hai id bằng value. Từ hôm đó code `cache = {UserId(1): ...}` ném `TypeError: unhashable type`, còn chỗ dùng `set()` để dedup thì vỡ. Không ai đụng tới hash.",
    idea: "Định nghĩa `__eq__` thì phải nghĩ luôn tới `__hash__`: object bằng nhau phải có hash bằng nhau. Python ép điều này bằng cách tự đặt `__hash__ = None` khi bạn chỉ ghi đè `__eq__`.",
    tradeoff: "Dunder method làm class trông như kiểu built-in, nhưng ghi đè toán tử quá tay (`+` cho thứ không phải phép cộng) làm code khó đọc. Với class chủ yếu chứa dữ liệu, `dataclass` sinh sẵn `__init__`, `__repr__`, `__eq__` và giảm lỗi.",
  },
  table: {
    head: ["Cú pháp / hàm", "Dunder method", "Ghi chú"],
    rows: [
      {
        cells: ["`repr(x)`, hiện trong REPL, trong list", "`__repr__`", "Cho developer: nên giống biểu thức tạo lại object, như `Money(5)`"],
        why: "Docs: `__repr__` \"should look like a valid Python expression that could be used to recreate an object\"; nếu không được thì dạng `<...mô tả...>` (https://docs.python.org/3/reference/datamodel.html). Log và debugger dùng `repr`, nên đây là method nên viết đầu tiên.",
      },
      {
        cells: ["`str(x)`, `print(x)`, `f\"{x}\"`", "`__str__`", "Cho người dùng; không định nghĩa thì dùng `__repr__`"],
        why: "Mặc định `object.__str__` gọi `__repr__` (https://docs.python.org/3/reference/datamodel.html). Vì vậy viết `__repr__` là đủ cho cả hai; chỉ viết `__str__` khi cần bản hiển thị khác. Ví dụ: `print(str(m), repr(m), [m])` → `5 VND Money(5) [Money(5)]`: list in phần tử bằng `repr`.",
      },
      {
        cells: ["`==`, `!=`, `<`, `<=`…", "`__eq__`, `__ne__`, `__lt__`, `__le__`…", "Trả `NotImplemented` khi không so được với kiểu kia"],
        why: "Mặc định `__eq__` so bằng `is`; khi không bên nào trả gì khác `NotImplemented` thì `==` rơi về `is` (https://docs.python.org/3/reference/datamodel.html). `__ne__` mặc định đảo kết quả `__eq__`, nhưng `<` không suy ra `<=`: class chỉ có `__lt__` thì `sorted()` chạy được còn `a <= b` ném `TypeError`. `functools.total_ordering` sinh các phép còn lại từ `__eq__` và một phép so sánh (https://docs.python.org/3/library/functools.html).",
      },
      {
        cells: ["`hash(x)`, làm key dict, phần tử set", "`__hash__`", "Object bằng nhau **phải** có hash bằng nhau"],
        why: "\"A class that overrides `__eq__()` and does not define `__hash__()` will have its `__hash__()` implicitly set to None\" (https://docs.python.org/3/reference/datamodel.html). Docs khuyên tính hash từ tuple các field tham gia so sánh: `def __hash__(self): return hash((self.a, self.b))`.",
      },
      {
        cells: ["`len(x)`, `bool(x)`", "`__len__`, `__bool__`", "Không có `__bool__` thì `bool` dùng `__len__() != 0`; không có cả hai thì luôn `True`"],
        why: "Docs: khi không có `__bool__`, \"`__len__()` is called, if it is defined, and the object is considered true if its result is nonzero\" (https://docs.python.org/3/reference/datamodel.html). Đây là lý do `if items:` là cách viết chuẩn để kiểm list rỗng.",
      },
      {
        cells: ["`x[i]`, `x[a:b]`, `for`, `in`", "`__getitem__` (+ `__len__`), `__iter__`, `__contains__`", "Chỉ cần `__getitem__` là đã duyệt được và dùng `in` được"],
        why: "Không có `__contains__` thì `in` thử duyệt qua `__iter__`, rồi tới giao thức sequence cũ qua `__getitem__` (https://docs.python.org/3/reference/datamodel.html). Class `Deck` chỉ có `__len__` và `__getitem__` (gọi xuống list bên trong): `len(d), list(d), \"K\" in d, d[-1], d[0:2]` → `3 ['A', 'K', 'Q'] True Q ['A', 'K']`, và `random.choice(d)` cũng chạy.",
      },
      {
        cells: ["`x + y`, `y + x`", "`__add__`, `__radd__`", "Vế trái trả `NotImplemented` thì Python thử `__radd__` của vế phải"],
        why: "Method phản chiếu (`__radd__`…) được gọi khi hai toán hạng khác kiểu và vế trái không hỗ trợ phép toán, hoặc khi class vế phải là subclass của class vế trái (https://docs.python.org/3/reference/datamodel.html). Class `V` có `__add__` nhận int và `__radd__` gọi lại `__add__`: `V(1) + 2` và `2 + V(1)` đều → `V(3)`. Trả `NotImplemented` (không phải `raise`) để Python còn cơ hội thử phía bên kia rồi mới báo `TypeError`.",
      },
      {
        cells: ["`x += y`", "`__iadd__`", "Sửa tại chỗ nếu có; không có thì dùng `__add__` và gán lại"],
        why: "\"If a specific method is not defined, or if that method returns NotImplemented, the augmented assignment falls back to the normal methods\" (https://docs.python.org/3/reference/datamodel.html). Đây là lý do `+=` trên list và trên tuple khác nhau (bài Names, Objects & Mutability).",
      },
      ["`x(...)`", "`__call__`", "Instance gọi được như hàm: `Cl()(3)` → `6`. Hay dùng cho decorator có trạng thái"],
      ["`with x:`", "`__enter__`, `__exit__`", "Xem bài Context Managers & with"],
      ["`iter(x)`, `next(it)`", "`__iter__`, `__next__`", "Xem bài Iterators & Generators"],
    ],
  },
  points: [
    {
      t: "**Ghi đè `__eq__` làm mất hash** — class `P` chỉ có `__eq__`: `P.__hash__` → `None`, và `{P(1)}` → `TypeError: cannot use 'P' as a set element (unhashable type: 'P')`. Sửa bằng `def __hash__(self): return hash(self.x)`, với `self.x` không được đổi sau khi tạo.",
      why: "Nếu Python giữ hash mặc định (theo identity) thì hai object `==` nhau có hash khác nhau, và set sẽ chứa cả hai \"bản sao\" của cùng một value: vi phạm điều kiện \"objects which compare equal have the same hash value\" (https://docs.python.org/3/reference/datamodel.html). Đặt `None` buộc bạn quyết định. Docs cũng nói object mutable có `__eq__` thì **không nên** có `__hash__`, vì hash đổi khi value đổi thì dict không tìm lại được key.",
    },
    {
      t: "**Không định nghĩa `__eq__`** — hai instance khác nhau không bao giờ bằng nhau: `class Q` thường, `Q(1) == Q(1)` → `False`, và `len({Q(1), Q(1)})` → `2`.",
      why: "`object.__eq__` mặc định là `True if x is y else NotImplemented` (https://docs.python.org/3/reference/datamodel.html), nên so value chỉ có khi bạn tự viết. Hash mặc định dựa trên identity, khớp với `__eq__` mặc định.",
    },
    {
      t: "**Dunder method tra trên type, không trên instance** — `i = I(); i.__len__ = lambda: 5; len(i)` → `TypeError: object of type 'I' has no len()`.",
      why: "\"For custom classes, implicit invocations of special methods are only guaranteed to work correctly if defined on an object's type, not in the object's instance dictionary\" (https://docs.python.org/3/reference/datamodel.html). Interpreter đi thẳng tới slot trên type để nhanh và nhất quán; muốn đổi hành vi theo từng instance thì để dunder method trên class gọi một thuộc tính thường.",
    },
    {
      t: "**`__len__` phải trả int không âm** — và trong CPython không vượt `sys.maxsize`, nếu không `len()` ném `OverflowError`.",
      why: "Ghi chú CPython implementation detail ở `__len__` (https://docs.python.org/3/reference/datamodel.html). Hiếm gặp, nhưng là lý do object \"vô hạn\" (như một dải số rất lớn) nên định nghĩa `__bool__` riêng.",
    },
    {
      t: "**Đặt dunder method bằng `None` để tắt một giao thức** — `__iter__ = None` làm class không duyệt được, kể cả khi có `__getitem__`; `__hash__ = None` làm class unhashable có chủ đích.",
      why: "Docs: đặt special method thành `None` nghĩa là thao tác tương ứng không có; `iter()` sẽ ném `TypeError` \"without falling back to `__getitem__()`\" (https://docs.python.org/3/reference/datamodel.html).",
    },
  ],
  tips: [
    {
      t: "Bị yêu cầu \"viết class X dùng được với `len` và `for`\": viết `__len__` và `__getitem__` (hoặc `__iter__`), rồi chạy thử `len(x)`, `list(x)`, `in` để cho thấy bạn biết giao thức nào kích hoạt cái gì.",
      why: "Interviewer muốn nghe \"Python dùng duck typing qua giao thức\", không phải kế thừa từ một base class. Biết `in` tự rơi về `__iter__`/`__getitem__` cho thấy bạn hiểu cơ chế chứ không thuộc lòng.",
    },
    {
      t: "Class chỉ để chứa dữ liệu: nhắc `@dataclass` (sinh `__init__`, `__repr__`, `__eq__`) và `@dataclass(frozen=True)` (thêm `__hash__`) trước khi tự viết tay.",
      why: "dataclass mặc định `eq=True` và đặt `__hash__` thành `None` trừ khi `frozen=True` (hoặc bạn bật `unsafe_hash`), đúng quy tắc eq/hash ở trên (https://docs.python.org/3/library/dataclasses.html). Viết tay dễ quên một field trong `__eq__` hoặc `__hash__`.",
    },
  ],
  cards: [
    ["Định nghĩa `__eq__` mà quên `__hash__` thì sao?", "Python tự đặt `__hash__ = None`: instance thành unhashable, không làm key dict hay phần tử set được. Thêm `__hash__` dựa trên đúng các field dùng trong `__eq__` (và các field đó không được đổi)."],
    ["`__repr__` khác `__str__`?", "`__repr__` cho developer, nên giống biểu thức tạo lại object; `__str__` cho người dùng. Không có `__str__` thì dùng `__repr__`. List/dict in phần tử bằng `repr`."],
    ["Làm class hỗ trợ `len()` và `for` thế nào?", "`__len__` cho `len()`; `__iter__` (trả iterator) hoặc `__getitem__` nhận index 0, 1, 2… cho `for`. `in` tự dùng `__contains__`, không có thì duyệt."],
    ["Vì sao gán `obj.__len__ = ...` trên instance không làm `len(obj)` chạy?", "Interpreter tra special method trên type, bỏ qua dict của instance."],
    ["`__add__` nên làm gì khi không cộng được với kiểu kia?", "Trả `NotImplemented` (không raise), để Python thử `__radd__` của vế phải; cả hai đều không được thì Python ném `TypeError`."],
    ["Object không có `__bool__` và `__len__` thì `bool(obj)` là gì?", "`True`. Có `__len__` thì `True` khi độ dài khác 0."],
    ["Class chỉ có `__lt__`: `sorted()` và `a <= b` chạy không?", "`sorted()` chạy (chỉ cần `<`). `a <= b` ném `TypeError`; dùng `functools.total_ordering` hoặc tự viết `__le__`."],
  ],
});
