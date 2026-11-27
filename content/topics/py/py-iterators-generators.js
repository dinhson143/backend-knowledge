// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
BK.topic({
  id: "py-iterators-generators",
  track: "py",
  section: "py-core",
  title: "Iterators & Generators",
  goal: "Xử lý dữ liệu lớn theo luồng bằng generator và tránh bẫy iterator chỉ duyệt được một lần",
  needs: ["py-data-model"],
  tldr: {
    t: "**Iterable** là thứ đưa vào `for` được (list, dict, file, range); gọi `iter()` trên nó cho ra một **iterator**: object có `__next__` trả từng phần tử và ném `StopIteration` khi hết. Iterator **chỉ duyệt được một lần**. **Generator** là cách viết iterator bằng một hàm có `yield`: mỗi `yield` tạm dừng hàm và giữ nguyên biến local, lần `next()` sau chạy tiếp từ đó. Vì sinh phần tử khi được hỏi (lazy), generator xử lý được dữ liệu lớn hơn RAM.",
    why: "Glossary: iterator \"is good for one pass\"; hết phần tử thì mọi lần gọi `__next__` sau đều ném `StopIteration`, nên duyệt lại một iterator \"appear like an empty container\" (https://docs.python.org/3/glossary.html). Generator giữ trạng thái thực thi \"including local variables and pending try-statements\" giữa các lần `yield` (cùng trang). PEP 255 đưa generator vào Python để viết iterator mà không phải tự quản lý trạng thái bằng class (https://peps.python.org/pep-0255/).",
  },
  story: {
    problem: "Job export đọc file log 50 GB bằng `lines = f.readlines()` rồi lọc dòng lỗi. Trên laptop với file mẫu thì ổn; trên server thì process bị OOM killer giết sau vài phút.",
    idea: "Xử lý từng dòng thay vì nạp cả file: file object đã là iterator theo dòng, và mỗi bước lọc/biến đổi viết thành generator nối nhau thành pipeline. Bộ nhớ chỉ cần chứa vài dòng đang xử lý, bất kể file lớn tới đâu.",
    tradeoff: "Generator chỉ duyệt một lần, không có `len()`, không index được, và lỗi chỉ lộ ra khi được tiêu thụ (lazy). Cần duyệt nhiều lần hoặc truy cập ngẫu nhiên thì phải `list()` lại, tức là trả bộ nhớ.",
  },
  table: {
    head: ["Khái niệm", "Ví dụ chạy được", "Kết quả và lý do"],
    rows: [
      {
        cells: ["Iterator dùng một lần", "`it = iter([1, 2, 3]); print(next(it), list(it), list(it))`", "`1 [2, 3] []`: lần `list` thứ hai nhận iterator đã cạn"],
        why: "List tạo iterator **mới** mỗi lần bạn `for` qua nó; iterator thì `__iter__` trả lại chính nó (Glossary — https://docs.python.org/3/glossary.html). Vì vậy hàm nhận \"iterable\" mà duyệt hai lần sẽ chạy đúng với list nhưng sai im lặng với generator.",
      },
      {
        cells: ["Generator expression cạn sau một lần", "`g = (x * x for x in range(3)); print(sum(g), sum(g))`", "`5 0`"],
        why: "Generator expression trả một generator iterator, cũng chỉ duyệt một lần. `sum` thứ hai không báo lỗi mà trả 0: bug kiểu này không ném exception nào.",
      },
      {
        cells: ["Lazy: thân hàm chưa chạy khi gọi", "Hàm `gen()` có `print(\"start\"); yield 1; print(\"mid\"); yield 2`. Gọi `g = gen()` không in gì; `next(g)` in `start` rồi trả 1", "Lần `next` thứ ba ném `StopIteration`"],
        why: "Gọi hàm generator chỉ tạo generator object; code chạy tới `yield` đầu tiên khi có `next()` đầu tiên (PEP 255 — https://peps.python.org/pep-0255/). Hệ quả: kiểm tra tham số đặt trong generator chỉ báo lỗi lúc bắt đầu duyệt, có thể ở nơi rất xa chỗ gọi.",
      },
      {
        cells: ["Bộ nhớ: list vs generator", "`sys.getsizeof([x for x in range(1_000_000)])` → khoảng 8,4 MB; `sys.getsizeof((x for x in range(1_000_000)))` → 200 byte", "Generator chỉ giữ trạng thái vòng lặp, không giữ phần tử"],
        why: "List comprehension tạo ngay mọi phần tử (và `getsizeof` còn chưa tính các object int bên trong). Generator expression chỉ lưu frame đang dừng. Con số đo trên CPython 3.14 64-bit, sẽ khác giữa các bản.",
      },
      {
        cells: ["`yield from` ủy quyền cho generator con", "`inner()` yield 1, 2 rồi `return \"done\"`; `outer()` viết `r = yield from inner(); yield r` → `list(outer())` là `[1, 2, 'done']`", "Phần tử của `inner` đi thẳng ra ngoài; giá trị `return` của nó thành giá trị của biểu thức `yield from`"],
        why: "PEP 380 thêm `yield from` để tách generator thành nhiều hàm nhỏ: nó chuyển cả `next`, `send`, `throw` xuống generator con và nhận giá trị `return` (https://peps.python.org/pep-0380/). Dạng hay gặp nhất: `for i in its: yield from i` để nối nhiều iterable.",
      },
      {
        cells: ["Generator expression đọc biến ngoài lúc chạy", "`x = 5; ge = (x + i for i in range(2)); x = 100; print(list(ge))`", "`[100, 101]`"],
        why: "Chỉ iterable của mệnh đề `for` đầu tiên được tính ngay; mọi biểu thức khác tính lazy khi lấy phần tử (Expressions, generator expressions — https://docs.python.org/3/reference/expressions.html). Đây là late binding giống closure (bài Scope, Closures & Late Binding).",
      },
    ],
  },
  points: [
    {
      t: "**Viết `__iter__` bằng generator để class duyệt được nhiều lần** — class `Countdown` có `def __iter__(self): n = self.n; while n > 0: yield n; n -= 1` (viết nhiều dòng). `list(c), list(c)` → `[3, 2, 1] [3, 2, 1]`.",
      why: "Mỗi lần `for` gọi `__iter__`, và mỗi lần gọi hàm generator tạo một generator mới với trạng thái riêng. Class trở thành iterable (duyệt lại được), không phải iterator. Nếu class tự làm iterator (`__iter__` trả `self`, có `__next__`) thì lần duyệt thứ hai rỗng.",
    },
    {
      t: "**`in` trên generator tiêu thụ nó** — `ge = (i for i in [1, 2]); print(2 in ge, list(ge))` → `True []`.",
      why: "Không có `__contains__` thì `in` duyệt qua iterator tới khi gặp phần tử (https://docs.python.org/3/reference/datamodel.html); các phần tử đã đi qua không quay lại được.",
    },
    {
      t: "**`StopIteration` bên trong generator thành `RuntimeError`** — generator `yield 1; raise StopIteration` → `list(...)` ném `RuntimeError: generator raised StopIteration`. Muốn kết thúc generator thì dùng `return`.",
      why: "Trước đây `StopIteration` lọt ra từ một `next()` gọi bên trong generator sẽ âm thầm kết thúc vòng lặp bên ngoài, che mất bug. PEP 479 đổi nó thành `RuntimeError`, bật cho mọi code từ Python 3.7 (https://peps.python.org/pep-0479/).",
    },
    {
      t: "**Dọn dẹp trong generator** — `try: yield ... finally: cleanup()` chạy `finally` khi generator chạy hết, khi bị `close()`, hoặc khi bị garbage collect. `g = gen2(); next(g); g.close()` in `cleanup`.",
      why: "`close()` ném `GeneratorExit` vào điểm đang dừng để `finally` chạy (PEP 342 — https://peps.python.org/pep-0342/). Nhưng nếu không ai gọi `close()` thì thời điểm dọn phụ thuộc lúc object bị thu hồi; resource quan trọng (file, connection) nên quản lý bằng `with` (bài Context Managers & with).",
    },
    {
      t: "+ **`send()`: generator nhận giá trị** — `x = yield total` cho phép caller đẩy giá trị vào; phải `next()` một lần để chạy tới `yield` đầu tiên. Generator `acc()` cộng dồn: `a = acc(); next(a); a.send(5), a.send(3)` → `5 8`.",
      why: "PEP 342 biến generator thành coroutine đơn giản bằng `send`, `throw`, `close` (https://peps.python.org/pep-0342/). Đây là nền lịch sử của `asyncio`, dù code mới dùng `async def`/`await` (PEP 492) thay vì generator-coroutine.",
    },
  ],
  sections: [
    {
      title: "itertools và built-in lazy hay dùng",
      table: {
        head: ["Hàm", "Ví dụ chạy được", "Dùng khi"],
        rows: [
          ["`itertools.islice`", "`list(islice(count(10), 3))` → `[10, 11, 12]`", "Lấy N phần tử đầu của iterator vô hạn hoặc rất dài; không nhận index âm"],
          {
            cells: ["`itertools.batched` (3.12+)", "`list(batched(range(7), 3))` → `[(0, 1, 2), (3, 4, 5), (6,)]`", "Gom thành lô để insert DB hoặc gọi API theo batch"],
            why: "Thêm ở 3.12; tham số `strict=True` (3.13) ném `ValueError` khi lô cuối thiếu (https://docs.python.org/3/library/itertools.html). Bản cũ hơn phải tự viết bằng `islice`.",
          },
          ["`itertools.pairwise` (3.10+)", "`list(pairwise([1, 2, 4]))` → `[(1, 2), (2, 4)]`", "So sánh phần tử kề nhau (tính delta, kiểm tra tăng dần)"],
          {
            cells: ["`itertools.groupby`", "`[(k, list(g)) for k, g in groupby(\"aabbba\")]` → `[('a', ['a', 'a']), ('b', ['b', 'b', 'b']), ('a', ['a'])]`", "Gom các phần tử **liền nhau** cùng key"],
            why: "Nhóm mới bắt đầu mỗi lần key đổi, giống `uniq` của Unix chứ không giống `GROUP BY` của SQL; muốn gom theo key thì sort theo cùng key trước (https://docs.python.org/3/library/itertools.html). Kết quả trên có hai nhóm `'a'` là vì vậy.",
          },
          ["`itertools.chain.from_iterable`", "`list(chain.from_iterable([[1], [2, 3]]))` → `[1, 2, 3]`", "Làm phẳng một tầng mà không tạo list trung gian"],
          {
            cells: ["`zip(..., strict=True)` (3.10+)", "`list(zip([1, 2, 3], \"ab\", strict=True))` → `ValueError: zip() argument 2 is shorter than argument 1`", "Ghép hai dãy phải cùng độ dài"],
            why: "`zip` mặc định dừng ở dãy ngắn nhất và im lặng bỏ phần thừa; `strict` (PEP 618, 3.10) biến lệch độ dài thành lỗi (https://peps.python.org/pep-0618/).",
          },
          ["`map`, `filter`, `zip`, `enumerate`, `reversed`", "`m = map(str, [1]); print(list(m), list(m))` → `['1'] []`", "Trong Python 3 đều trả iterator lazy, cũng chỉ duyệt một lần"],
          ["`any`, `all` với generator", "`any(i > 1 for i in count())` → `True`", "Dừng sớm ở phần tử đầu tiên quyết định kết quả, chạy được cả trên iterator vô hạn"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"đọc file 50 GB\": `with open(path) as f: for line in f: ...` (file object duyệt theo dòng), rồi nối generator cho từng bước (parse → lọc → gom lô bằng `batched`) và ghi kết quả theo lô. Nói rõ bộ nhớ là O(kích thước lô), không phụ thuộc kích thước file.",
      why: "Interviewer muốn nghe ba ý: không `read()`/`readlines()` cả file, pipeline lazy, và đầu ra cũng phải theo lô (nếu gom tất cả vào list kết quả thì lại OOM).",
    },
    {
      t: "Hàm nhận dữ liệu và cần duyệt hai lần (ví dụ tính tổng rồi chuẩn hoá): nhận `Iterable` thì gọi `list()` ở đầu hàm, hoặc ghi rõ kiểu là `Sequence`/`Collection`.",
      why: "Duyệt hai lần một generator cho lần hai rỗng mà không có lỗi; `itertools.tee` giải được nhưng phải đệm dữ liệu, và docs nói nếu một nhánh tiêu thụ gần hết trước nhánh kia thì `list()` nhanh hơn `tee()` (https://docs.python.org/3/library/itertools.html).",
    },
  ],
  cards: [
    ["Generator khác list comprehension về bộ nhớ thế nào?", "List comprehension tạo mọi phần tử ngay (O(n) bộ nhớ). Generator expression chỉ giữ trạng thái vòng lặp và sinh từng phần tử khi được hỏi (O(1))."],
    ["Duyệt một iterator hai lần thì sao?", "Lần thứ hai rỗng, không lỗi: iterator đã cạn và `__iter__` trả lại chính nó. List thì mỗi lần `for` tạo iterator mới."],
    ["`yield from` làm gì?", "Ủy quyền cho iterable/generator con: chuyển mọi phần tử (và `send`/`throw`) xuống nó, và nhận giá trị `return` của generator con làm giá trị biểu thức (PEP 380)."],
    ["Đọc file 50 GB từng dòng thế nào?", "`with open(p) as f: for line in f:`; mỗi bước xử lý viết thành generator, ghi kết quả theo lô. Không dùng `read()`/`readlines()`."],
    ["Iterable khác iterator?", "Iterable có `__iter__` trả iterator mới (list, dict). Iterator có `__next__` và `__iter__` trả chính nó; dùng một lần."],
    ["`raise StopIteration` trong generator thì sao (3.7+)?", "Thành `RuntimeError` (PEP 479). Kết thúc generator bằng `return`."],
    ["Gọi một hàm generator có chạy thân hàm không?", "Không. Chỉ tạo generator object; thân hàm chạy tới `yield` đầu tiên khi có `next()` đầu tiên."],
    ["`groupby(\"aabbba\")` cho mấy nhóm?", "Ba: `a`, `b`, `a`. `groupby` chỉ gom phần tử liền nhau; muốn gom theo key thì sort trước."],
  ],
});
