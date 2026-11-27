// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
// Bài này là danh mục bẫy: cơ chế chi tiết nằm ở bài gốc (aliasing: py-object-model, late binding: py-scope-closures).
BK.topic({
  id: "py-pitfalls",
  track: "py",
  section: "py-core",
  title: "Python Gotchas",
  goal: "Nhận ra và sửa các bẫy Python hay bị hỏi: mutable default, sửa list khi duyệt, `is` với số",
  needs: ["py-scope-closures", "py-object-model"],
  tldr: {
    t: "Gần như mọi bẫy Python hay bị hỏi đều quy về hai cơ chế: **tên trỏ tới object chứ không copy** (aliasing, bài Names, Objects & Mutability) và **giá trị được tính lúc nào** (default tính một lần lúc `def`, closure đọc biến lúc gọi, bài Scope, Closures & Late Binding). Thuộc cơ chế thì tự suy ra được kết quả, kể cả với biến thể chưa gặp.",
    why: "Programming FAQ của Python có riêng các mục cho từng bẫy dưới đây (default dùng chung, `[[None] * 2] * 3`, `a_tuple[i] += …`, lambda trong vòng lặp, `is`), và đều giải thích bằng hai cơ chế trên (https://docs.python.org/3/faq/programming.html).",
  },
  story: {
    problem: "Hàm `def add_tag(tag, tags=[])` chạy đúng trong mọi unit test (mỗi test một process mới hoặc truyền `tags` tường minh). Lên server, worker sống nhiều giờ, và mỗi request mới nhận thêm tag của mọi request trước.",
    idea: "Học bẫy theo cơ chế: \"default được tạo một lần khi `def` chạy và dùng chung cho mọi lần gọi\". Từ đó suy ra luôn bẫy `def f(ts=time.time())` (thời điểm đứng yên) mà không cần học thuộc riêng.",
    tradeoff: "Các \"bẫy\" này là hệ quả của thiết kế giúp Python nhanh và nhất quán (không copy ngầm, tính default một lần). Linter bắt được nhiều bẫy (ví dụ mutable default), nhưng trong phỏng vấn bạn phải tự giải thích được.",
  },
  table: {
    head: ["Bẫy", "Ví dụ chạy được", "Sửa"],
    rows: [
      {
        cells: ["**Mutable default argument**", "`def f(x=[]): x.append(1); return x` rồi `f(); print(f())` → `[1, 1]`; `f.__defaults__` → `([1, 1],)`", "`def f(x=None): x = [] if x is None else x; ...`"],
        why: "\"The default value is evaluated only once. This makes a difference when the default is a mutable object\" (Tutorial — https://docs.python.org/3/tutorial/controlflow.html). List mặc định là thuộc tính của function object (`__defaults__`) nên sống suốt đời hàm. Cùng cơ chế: `def stamp(t=time.time())` trả cùng một thời điểm mãi mãi.",
      },
      {
        cells: ["**Sửa list khi đang duyệt**", "`L = [1, 2, 2, 3]` rồi `for x in L:` với thân `if x == 2: L.remove(x)` → `[1, 2, 3]` (còn sót một số 2)", "Tạo list mới: `L = [x for x in L if x != 2]`, hoặc duyệt bản copy `for x in L[:]`"],
        why: "Iterator của list đi theo index. Xoá phần tử ở index 1 làm mọi phần tử sau dịch lên một ô, nên phần tử kế tiếp bị nhảy qua. Tutorial khuyên \"loop over a copy of the collection or to create a new collection\" (https://docs.python.org/3/tutorial/controlflow.html). Với dict thì không sót mà ném `RuntimeError` (bài list, dict, set: Internals & Big-O).",
      },
      {
        cells: ["**`[[0] * 3] * 3`**", "`g = [[0] * 3] * 3; g[0][0] = 1; print(g)` → `[[1, 0, 0], [1, 0, 0], [1, 0, 0]]`", "`[[0] * 3 for _ in range(3)]`"],
        why: "\"Replicating a list with `*` doesn't create copies, it only creates references to the existing objects\": ba hàng là ba tham chiếu tới **một** list (https://docs.python.org/3/faq/programming.html). `[0] * 3` bên trong thì an toàn vì int immutable. Comprehension chạy biểu thức `[0] * 3` mỗi vòng nên tạo ba list riêng.",
      },
      {
        cells: ["**Late binding trong vòng lặp**", "`fs = [lambda: n for n in [1, 2, 3]]; print([f() for f in fs])` → `[3, 3, 3]`", "`lambda n=n: n` hoặc `functools.partial`"],
        why: "Closure đọc biến lúc gọi, không lúc tạo; chi tiết và các cách sửa ở bài Scope, Closures & Late Binding (FAQ — https://docs.python.org/3/faq/programming.html).",
      },
      {
        cells: ["**`is` để so số, chuỗi**", "`a = 10_000_000; c = 5_000_000 + int(\"5000000\"); print(a == c, a is c)` → `True False`", "Dùng `==`; chỉ dùng `is` với `None`, `True`/`False`, sentinel"],
        why: "`is` so identity. Số nhỏ trùng identity chỉ vì CPython cache chúng (dải phụ thuộc phiên bản), chuỗi có thể trùng vì interning: đều là implementation detail. FAQ nói rõ không dùng identity để so `int` và `str` \"which aren't guaranteed to be singletons\" (https://docs.python.org/3/faq/programming.html). Chi tiết ở bài Names, Objects & Mutability.",
      },
      {
        cells: ["**`+=` trên phần tử tuple**", "`t = ([1],)` rồi `t[0] += [2]` → `TypeError: 'tuple' object does not support item assignment`, nhưng sau đó `t` là `([1, 2],)`", "Gọi thẳng `t[0].extend([2])` (không có bước gán)"],
        why: "`t[0] += x` là hai bước: `result = t[0].__iadd__(x)` (list sửa tại chỗ, thành công) rồi `t[0] = result` (tuple cấm gán, lỗi). Lỗi xảy ra **sau** khi list đã bị sửa (FAQ — https://docs.python.org/3/faq/programming.html).",
      },
      {
        cells: ["**Class attribute mutable dùng chung**", "Class `A` có `items = []` ở thân class và method `add` gọi `self.items.append(x)`: `a1.add(1)` thì `a2.items` → `[1]`", "Khởi tạo trong `__init__`: `self.items = []`"],
        why: "`self.items` không có trong instance nên tra lên class, và mọi instance dùng chung list của class. Cùng cơ chế mutable default, ở mức class (Tutorial, class and instance variables — https://docs.python.org/3/tutorial/classes.html).",
      },
      {
        cells: ["**`dict.fromkeys(keys, [])`**", "`d = dict.fromkeys([\"a\", \"b\"], []); d[\"a\"].append(1); print(d)` → `{'a': [1], 'b': [1]}`", "`{k: [] for k in keys}` hoặc `defaultdict(list)`"],
        why: "Giá trị `[]` được tạo một lần và gán cho mọi key: lại là aliasing, giống `[[0] * 3] * 3`.",
      },
    ],
  },
  points: [
    {
      t: "**Phép chia nguyên với số âm** — `-7 // 2, -7 % 2, int(-7 / 2)` → `-4 1 -3`. `//` làm tròn xuống (floor), không phải về 0 như C/Java.",
      why: "`//` là phép chia rồi áp floor; `%` luôn cùng dấu với số chia, và `x == (x//y)*y + (x%y)` (https://docs.python.org/3/reference/expressions.html). Cần cắt về 0 thì dùng `int(a / b)` (cẩn thận với số lớn vì đi qua float) hoặc `math.trunc`.",
    },
    {
      t: "**`round()` làm tròn về số chẵn** — `round(2.5), round(3.5), round(0.5)` → `2 4 0`.",
      why: "Khi cách đều hai bội số, \"rounding is done toward the even choice\" (banker's rounding); thêm nữa `round(2.675, 2)` ra `2.67` vì 2.675 không biểu diễn chính xác bằng float (https://docs.python.org/3/library/functions.html). Tiền tệ dùng `decimal.Decimal` với rounding mode tường minh.",
    },
    {
      t: "**So sánh float** — `0.1 + 0.2 == 0.3` → `False`; dùng `math.isclose(0.1 + 0.2, 0.3)` → `True`.",
      why: "Phần lớn phân số thập phân không biểu diễn chính xác bằng số nhị phân dấu phẩy động (Tutorial, Floating-Point Arithmetic — https://docs.python.org/3/tutorial/floatingpoint.html). Đây không phải lỗi riêng của Python mà của IEEE 754.",
    },
    {
      t: "**Chained comparison** — `1 < 2 == 2` → `True`, nhưng `(1 < 2) == 2` → `False`.",
      why: "`x < y == z` nghĩa là `x < y and y == z` (https://docs.python.org/3/reference/expressions.html), không phải so kết quả `True` với 2. Hay gặp ở `a == b == c` hoặc `x in s == True`.",
    },
    {
      t: "**Method sửa tại chỗ trả `None`** — `[3, 1].sort()` → `None`; `sorted([3, 1])` → `[1, 3]`. Viết `lst = lst.sort()` làm mất list.",
      why: "Docs: method thêm, bớt hay sắp lại tại chỗ \"never return the collection instance itself but `None`\", để nhắc rằng chúng có side effect (https://docs.python.org/3/library/stdtypes.html). Ngược lại, method của `str` trả chuỗi mới vì `str` immutable: `s.replace(...)` không đổi `s`.",
    },
    {
      t: "**Dấu phẩy tạo tuple, ngoặc thì không** — `type((1))` → `int`, `type((1,))` → `tuple`; `x = 1,` cũng là tuple. Thiếu dấu phẩy trong list chuỗi thì hai chuỗi bị nối: `[\"a\" \"b\", \"c\"]` → `['ab', 'c']`.",
      why: "Tuple được tạo bởi dấu phẩy; ngoặc chỉ để nhóm. Hai string literal đứng cạnh nhau được nối lúc compile, nên quên dấu phẩy trong danh sách dài không báo lỗi mà ra sai dữ liệu.",
    },
    {
      t: "**Truthiness** — `bool(\"False\")` → `True`, `bool(\"0\")` → `True`, `bool([])` → `False`. Biến môi trường `\"false\"` luôn truthy; `if x:` không phân biệt `0`, `\"\"`, `[]` với `None`.",
      why: "Chuỗi chỉ falsy khi rỗng; object rỗng hoặc bằng 0 là falsy (`__bool__`/`__len__`, bài Data Model & Dunder Methods). Kiểm `None` thì viết `if x is None`, kiểm cấu hình thì parse chuỗi tường minh.",
    },
    {
      t: "**`bool` là subclass của `int`** — `True + True` → `2`, `isinstance(True, int)` → `True`. Validate input bằng `isinstance(x, int)` sẽ nhận cả `True`.",
      why: "`bool` kế thừa `int`, `True`/`False` hoạt động như 1/0 trong phép toán (https://docs.python.org/3/library/stdtypes.html). Cần loại bool thì kiểm `type(x) is int` hoặc kiểm `bool` trước.",
    },
  ],
  tips: [
    {
      t: "Gặp câu đố \"đoạn này in gì\": trước khi trả lời, hỏi hai câu: \"có bao nhiêu object ở đây?\" (aliasing) và \"giá trị này được tính lúc nào?\" (default, closure, generator). Nói to quá trình đó.",
      why: "Interviewer quan tâm cách suy luận hơn đáp án. Hai câu hỏi đó giải được gần hết bảng trên, và cho thấy bạn hiểu mô hình chứ không học thuộc từng mẹo.",
    },
    {
      t: "Bật linter trong dự án (ví dụ luật mutable default argument, loop variable closure của ruff/flake8-bugbear) và nhắc điều đó khi được hỏi cách phòng tránh.",
      why: "Câu \"làm sao team không mắc lỗi này nữa\" là phần thứ hai hay bị hỏi. Trả lời bằng công cụ tự động (lint trong CI) thuyết phục hơn \"mọi người phải cẩn thận\".",
    },
  ],
  cards: [
    ["`def f(x=[])` gọi hai lần ra gì, sửa thế nào?", "Lần hai thấy cả phần tử của lần một (`[1, 1]`): default tạo một lần lúc `def` và dùng chung. Sửa: `x=None`, trong hàm `if x is None: x = []`."],
    ["`[[0]*3]*3` gán một ô thì sao?", "Cả cột đổi theo, vì ba hàng là cùng một list. Dùng `[[0]*3 for _ in range(3)]`."],
    ["Xoá phần tử khi đang `for` qua list?", "Bị sót phần tử (index dịch). Tạo list mới bằng comprehension hoặc duyệt `L[:]`. Với dict thì `RuntimeError`."],
    ["`a is b` với hai số bằng nhau có luôn `True`?", "Không. Chỉ số trong dải cache của CPython mới trùng object; không bao giờ dùng `is` để so số hay chuỗi."],
    ["`t = ([1],); t[0] += [2]` kết quả?", "Ném `TypeError` nhưng list bên trong vẫn thành `[1, 2]`: `__iadd__` chạy xong rồi bước gán vào tuple mới lỗi."],
    ["`-7 // 2` bằng mấy?", "`-4` (floor), không phải `-3`. `-7 % 2` là `1`."],
    ["`round(2.5)` bằng mấy?", "`2`: Python làm tròn nửa về số chẵn."],
    ["Vì sao `lst = lst.sort()` làm mất dữ liệu?", "`sort()` sắp tại chỗ và trả `None`; dùng `lst.sort()` hoặc `lst = sorted(lst)`."],
  ],
});
