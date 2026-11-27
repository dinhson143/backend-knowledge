// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
// Nhà của "late binding": bài này. py-pitfalls chỉ nhắc và link về đây.
BK.topic({
  id: "py-scope-closures",
  track: "py",
  section: "py-core",
  title: "Scope, Closures & Late Binding",
  goal: "Dự đoán một tên được tra ở scope nào, sửa `UnboundLocalError` và bẫy late binding",
  needs: ["py-object-model"],
  tldr: {
    t: "Python tra tên theo thứ tự **LEGB**: Local → Enclosing (hàm bao ngoài) → Global (module) → Built-in. Tên nào **được gán ở bất kỳ đâu trong hàm** thì là biến local của cả hàm, kể cả dòng phía trên phép gán; muốn gán vào biến ngoài phải khai báo `global` hoặc `nonlocal`. **Closure** (hàm con nhớ biến của hàm ngoài) giữ **biến**, không giữ **giá trị** lúc tạo: giá trị được đọc lúc gọi. Đó là **late binding**.",
    why: "Tutorial §9.2 liệt kê bốn lớp scope theo thứ tự tra, và \"assignments to names always go into the innermost scope\" nếu không có `global`/`nonlocal` (https://docs.python.org/3/tutorial/classes.html). Execution model: \"If a name binding operation occurs anywhere within a code block, all uses of the name within the block are treated as references to the current block\", và tên tự do (free variable) \"is resolved at runtime, not at compile time\" (https://docs.python.org/3/reference/executionmodel.html).",
  },
  story: {
    problem: "Code đăng ký handler trong vòng lặp: `for event in events: bus.on(event, lambda: log(event))`. Phát event nào thì log cũng in tên event cuối cùng. Unit test chỉ có một event nên không bắt được.",
    idea: "Lambda không chụp giá trị `event` lúc tạo; nó giữ tham chiếu tới **biến** `event` của scope ngoài và đọc khi được gọi, lúc vòng lặp đã chạy xong. Muốn chụp giá trị thì tạo một binding mới cho mỗi lần lặp: tham số mặc định, `functools.partial`, hoặc một hàm factory.",
    tradeoff: "Late binding là thứ làm closure hữu ích (counter, cache, decorator có trạng thái đều dựa vào việc đọc/ghi biến ngoài lúc chạy). Cái giá là phải nhớ quy tắc, và mẹo tham số mặc định làm lộ một tham số mà caller có thể vô tình truyền vào.",
  },
  table: {
    head: ["Tình huống", "Ví dụ chạy được", "Kết quả và lý do"],
    rows: [
      {
        cells: ["Late binding trong vòng lặp", "`fs = [lambda: i for i in range(3)]; print([f() for f in fs])`", "`[2, 2, 2]`: ba lambda cùng đọc một biến `i`, lúc gọi `i` đã là 2"],
        why: "Programming FAQ: biến \"is accessed when the lambda is called — not when it is defined\", và điều này \"is not peculiar to lambdas, but applies to regular functions too\" (https://docs.python.org/3/faq/programming.html). Comprehension có scope riêng nhưng `i` vẫn là **một** biến dùng chung cho cả vòng.",
      },
      {
        cells: ["Sửa bằng tham số mặc định", "`fs = [lambda i=i: i for i in range(3)]; print([f() for f in fs])`", "`[0, 1, 2]`: giá trị mặc định được tính một lần lúc tạo lambda"],
        why: "\"Default values are calculated, once, when the function is defined\" (https://docs.python.org/3/reference/expressions.html). Mỗi lambda có tham số `i` riêng, nên không còn dùng chung biến. Cùng cơ chế này gây bẫy mutable default (bài Python Gotchas).",
      },
      {
        cells: ["Sửa bằng `functools.partial`", "`fs = [partial(lambda x: x, i) for i in range(3)]; print([f() for f in fs])`", "`[0, 1, 2]`: `partial` lưu giá trị tham số vào object của nó"],
        why: "`partial` tạo object gọi được với các tham số đã chốt lúc tạo (https://docs.python.org/3/library/functools.html), không lộ tham số mặc định ra ngoài như mẹo `i=i`.",
      },
      {
        cells: ["Gán làm tên thành local", "`x = 10` rồi `def foo(): print(x); x = 1` và gọi `foo()`", "`UnboundLocalError: cannot access local variable 'x' where it is not associated with a value`"],
        why: "Vì có `x = 1` trong thân hàm, compiler đánh dấu `x` là local cho **toàn bộ** hàm; `print(x)` đọc biến local chưa được gán (FAQ, \"Why am I getting an UnboundLocalError\" — https://docs.python.org/3/faq/programming.html). `UnboundLocalError` là subclass của `NameError` (https://docs.python.org/3/reference/executionmodel.html). `x += 1` cũng là một phép gán nên gây lỗi y hệt.",
      },
      {
        cells: ["`nonlocal` cho closure có trạng thái", "`def counter(): n = 0; ...` với hàm con `def inc(): nonlocal n; n += 1; return n`", "Gọi ba lần → 1, 2, 3; `inc.__code__.co_freevars` → `('n',)`"],
        why: "`nonlocal` làm tên trỏ tới binding ở scope hàm bao gần nhất; không có binding đó thì `SyntaxError` ngay lúc compile, kể cả khi hàm chưa được gọi (https://docs.python.org/3/reference/executionmodel.html). Thiếu `nonlocal` thì `n += 1` tạo local mới và gây `UnboundLocalError`.",
      },
      {
        cells: ["Mutate thì không cần `nonlocal`", "`def outer(): items = []; ...` với hàm con `def add(x): items.append(x); return items`", "Gọi `add(1); add(2)` → `[1, 2]`"],
        why: "`items.append` chỉ **đọc** tên `items` rồi sửa object; không gán lại tên nên không làm `items` thành local. `nonlocal`/`global` chỉ cần khi **gán lại** tên.",
      },
    ],
  },
  points: [
    {
      t: "**Closure giữ biến, không giữ giá trị** — hàm `make()` gán `v = 1`, định nghĩa `def g(): return v`, rồi gán `v = 2` trước khi `return g`: `make()()` → `2`.",
      why: "Biến được closure dùng nằm trong một **cell** chung giữa hàm ngoài và hàm con (thấy qua `g.__closure__[0].cell_contents`). Hàm con đọc cell lúc chạy, nên thấy giá trị cuối cùng. Execution model: tên tự do \"is resolved at runtime, not at compile time\" (https://docs.python.org/3/reference/executionmodel.html).",
    },
    {
      t: "**Scope do vị trí trong code quyết định, việc tra cứu diễn ra lúc chạy** — hàm luôn tra global trong module nơi nó được **định nghĩa**, dù được gọi từ module khác.",
      why: "Tutorial: \"scopes are determined textually\", còn \"the actual search for names is done dynamically, at run time\"; riêng biến local đã được xác định tĩnh (https://docs.python.org/3/tutorial/classes.html). Vì vậy `import` một hàm sang module khác không làm nó thấy global của module mới.",
    },
    {
      t: "**Biến vòng `for` còn sống sau vòng lặp; biến comprehension thì không** — `for j in range(3): pass` rồi `print(j)` → `2`; còn sau `[i for i in range(3)]` thì `print(i)` → `NameError`.",
      why: "`for` gán vào tên ở scope hiện tại. Comprehension có sub-scope riêng; từ 3.12 CPython inline comprehension vào hàm bao để chạy nhanh hơn nhưng vẫn giữ biến \"fully isolated\" (PEP 709 — https://peps.python.org/pep-0709/).",
    },
    {
      t: "+ **`except E as err` xoá `err` khi ra khỏi khối** — sau khối `except ValueError as err: pass`, `print(err)` → `NameError: name 'err' is not defined`. Cần giữ lại thì gán sang tên khác trong khối.",
      why: "Exception giữ traceback, traceback giữ frame, frame giữ biến local trong đó có `err`: một vòng tham chiếu làm frame sống lâu hơn cần thiết. Xoá tên khi ra khỏi khối cắt vòng đó (Compound statements, the try statement — https://docs.python.org/3/reference/compound_stmts.html).",
    },
    {
      t: "+ **Scope của class không bao method và comprehension bên trong** — trong thân class có `cv = 42` thì `b = list(cv + k for k in range(3))` → `NameError: name 'cv' is not defined`.",
      why: "\"The scope of names defined in a class block is limited to the class block; it does not extend to the code blocks of methods. This includes comprehensions and generator expressions\" (https://docs.python.org/3/reference/executionmodel.html). Trong method phải viết `self.cv` hoặc `type(self).cv`.",
    },
    {
      t: "**Che tên built-in** — `list = [1]` trong một hàm làm `list(...)` ở hàm đó hỏng, vì L đứng trước B trong LEGB. Ở mức module còn tệ hơn: mọi hàm trong module bị ảnh hưởng.",
      why: "Built-in là lớp tra cuối cùng (https://docs.python.org/3/tutorial/classes.html), nên bất kỳ tên local hay global trùng tên đều che nó. Linter (ruff, pylint) có luật riêng cho việc này.",
    },
  ],
  tips: [
    {
      t: "Câu `[lambda: i for i in range(3)]`: nói kết quả `[2, 2, 2]`, giải thích \"closure giữ biến, đọc lúc gọi\", rồi đưa hai cách sửa (`lambda i=i: i` và `functools.partial`) và nói nhược điểm của cách thứ nhất.",
      why: "Interviewer muốn biết bạn hiểu cơ chế (cell, late binding) chứ không thuộc mẹo. Nêu được nhược điểm của `i=i` (lộ tham số, caller có thể ghi đè) là dấu hiệu senior.",
    },
    {
      t: "Hạn chế `global` trong code backend: state module-level dùng chung giữa mọi request trong cùng process, và giữa các thread nếu server chạy nhiều thread.",
      why: "Một biến global trong worker WSGI/ASGI sống suốt đời process; ghi vào nó từ request này làm request khác thấy. Truyền state qua tham số, object, hoặc `contextvars` khi cần theo từng request.",
    },
  ],
  cards: [
    ["`[lambda: i for i in range(3)]` gọi từng hàm ra gì?", "`[2, 2, 2]`. Ba lambda cùng đọc biến `i` lúc được gọi, khi vòng lặp đã xong. Sửa: `lambda i=i: i` hoặc `functools.partial`."],
    ["Khi nào cần `nonlocal`?", "Khi hàm con muốn **gán lại** một biến của hàm bao (`n += 1`). Chỉ đọc hoặc mutate object (`items.append`) thì không cần."],
    ["Vì sao gán biến trong hàm làm `UnboundLocalError` ở dòng phía trên?", "Một phép gán ở bất kỳ đâu trong hàm làm tên đó là local cho cả hàm; dòng đọc phía trên đọc biến local chưa có giá trị."],
    ["LEGB là gì?", "Thứ tự tra tên: Local, Enclosing (hàm bao), Global (module), Built-in."],
    ["Closure lưu giá trị hay biến?", "Biến (qua cell). Hàm con đọc giá trị hiện tại của cell lúc được gọi."],
    ["Biến vòng lặp của list comprehension có lộ ra ngoài không?", "Không (Python 3). Biến của vòng `for` thường thì có, còn sống sau vòng lặp."],
    ["`nonlocal x` mà hàm bao không có `x` thì sao?", "`SyntaxError` lúc compile, kể cả khi hàm chưa được gọi."],
  ],
});
