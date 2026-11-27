// Khối code (D13) đã chạy bằng `python -I` trên CPython 3.14.6 (bản mặc định, có GIL, Windows).
// Ranh giới (D112): khái niệm stack/heap ở os-memory-layout; bài này đi vào cách CPython giải phóng object.
BK.topic({
  id: "py-memory-gc",
  track: "py",
  section: "py-runtime",
  title: "Reference Counting & GC",
  goal: "Giải thích CPython giải phóng object khi nào và tìm chỗ phình bộ nhớ bằng tracemalloc",
  needs: ["py-object-model", "os-memory-layout"],
  tldr: {
    t: "CPython dọn bộ nhớ bằng hai cơ chế. **Reference counting**: mỗi object đếm số tham chiếu tới nó; số đếm về 0 là object được giải phóng **ngay**, `__del__` chạy ngay lúc đó. **Cyclic GC** (module `gc`) chạy định kỳ để tìm các nhóm object chỉ trỏ lẫn nhau (vòng tham chiếu), thứ mà refcount không bao giờ đưa về 0. **Weak reference** (`weakref`) trỏ tới object mà không tăng số đếm, nên cache không giữ object sống. Bộ nhớ tăng dần thì đo bằng `tracemalloc` trước khi đoán.",
    why: "Glossary: Python thu gom rác \"via reference counting and a cyclic garbage collector that is able to detect and break reference cycles\"; khi refcount về 0 thì object \"is deallocated\" (https://docs.python.org/3/glossary.html). Language reference ghi đây là chi tiết của CPython: refcount \"collects most objects as soon as they become unreachable\", và implementation khác (PyPy…) có thể làm khác, nên đừng dựa vào việc object được dọn ngay (https://docs.python.org/3/reference/datamodel.html).",
  },
  story: {
    problem: "Một worker API giữ dict toàn cục `_cache = {}` map user id → object profile để \"đỡ query lại\". Không ai xoá entry. Bộ nhớ của worker tăng đều theo số user khác nhau đã gọi, tới khi container bị OOM kill và restart, rồi lặp lại sau vài giờ.",
    idea: "Mỗi entry trong dict là một **strong reference**, nên refcount của profile không bao giờ về 0 và GC cũng không đụng tới (object vẫn với tới được). Sửa bằng cache có giới hạn (`lru_cache(maxsize=…)`, TTL) hoặc `weakref.WeakValueDictionary` khi object đã được nơi khác giữ. Trước khi sửa, so hai snapshot `tracemalloc` để thấy đúng dòng code đang cấp phát thêm.",
    tradeoff: "Refcount làm việc dọn dẹp dễ đoán nhưng tốn chi phí trên mọi phép gán và làm khó việc chạy song song nhiều thread (một lý do của GIL, xem bài GIL & Free-threading). Cyclic GC dọn được vòng nhưng phải duyệt các container đang sống, tốn CPU và tạo pause. `weakref` không dùng được với mọi kiểu (`list`, `dict`, `int` không có).",
  },
  table: {
    head: ["Cơ chế", "Khi nào chạy", "Dọn được", "Không dọn được"],
    rows: [
      {
        cells: ["Reference counting", "Mỗi lần thêm/bớt tham chiếu; về 0 là giải phóng ngay", "Gần như mọi object không nằm trong vòng", "Vòng tham chiếu (`a.peer = b; b.peer = a`)"],
        why: "`del x` không gọi `__del__` trực tiếp: nó giảm refcount đi 1, và `__del__` chỉ chạy khi refcount về 0 (https://docs.python.org/3/reference/datamodel.html). Vì vậy file mở rồi bỏ đi thường được đóng ngay trên CPython, nhưng code dựa vào điều đó sẽ rò file trên PyPy.",
      },
      {
        cells: ["Cyclic GC (`gc`)", "Khi số object container được cấp phát trừ số đã giải phóng vượt `threshold0`; hoặc gọi `gc.collect()`", "Vòng tham chiếu không còn ai bên ngoài trỏ tới, kể cả khi có `__del__` (từ 3.4)", "Object còn với tới được: cache toàn cục, list không bao giờ xoá"],
        why: "Docs `gc`: collector \"supplements the reference counting\", bắt đầu khi \"the number of allocations minus the number of deallocations exceeds threshold0\" (https://docs.python.org/3/library/gc.html). PEP 442 (3.4) cho phép dọn vòng có `__del__`; trước đó chúng nằm lại trong `gc.garbage`.",
      },
      {
        cells: ["`weakref`", "Không chạy gì: chỉ là tham chiếu không tăng refcount", "Giúp object chết khi chỉ còn cache/registry trỏ tới", "Kiểu không hỗ trợ: `list`, `dict` (subclass thì được), `int`, `tuple` (subclass cũng không)"],
        why: "Docs: \"A primary use for weak references is to implement caches or mappings holding large objects, where it's desired that a large object not be kept alive solely because it appears in a cache or mapping\" (https://docs.python.org/3/library/weakref.html). Chạy thử: `weakref.ref([])` → `TypeError: cannot create weak reference to 'list' object`.",
      },
      {
        cells: ["`tracemalloc`", "Khi bật (`tracemalloc.start()`, `-X tracemalloc`, `PYTHONTRACEMALLOC=1`)", "Không dọn gì: cho biết dòng code nào cấp phát bao nhiêu", "Bộ nhớ do thư viện C cấp phát ngoài allocator của Python"],
        why: "Module có từ 3.4, là \"a debug tool to trace memory blocks allocated by Python\" và so được hai snapshot \"to detect memory leaks\" (https://docs.python.org/3/library/tracemalloc.html). Nó hook allocator của Python, nên vùng nhớ mà extension C tự `malloc` không hiện ra.",
      },
    ],
  },
  points: [
    {
      t: "**`sys.getrefcount(x)` luôn lớn hơn 1** so với số tên bạn đếm được, vì chính lời gọi giữ thêm một tham chiếu tạm. `x = []` rồi `sys.getrefcount(x)` → `2`; thêm `y = x` → `3`. Từ 3.12, object **immortal** như `None`, `True`, số nguyên nhỏ có refcount rất lớn không đổi: `sys.getrefcount(None)` → `3221225472` trên 3.14.6.",
      why: "Docs `sys`: số trả về \"generally one higher than you might expect\", và vì object immortal, đừng tin giá trị này \"other than a value of 0 or 1\" (https://docs.python.org/3/library/sys.html). Immortal object (PEP 683, 3.12) không bao giờ bị sửa refcount, nên nhiều thread đọc `None` không phải ghi chung một ô nhớ (https://docs.python.org/3/glossary.html).",
    },
    {
      t: "**Cyclic GC chia object theo thế hệ.** Object mới vào thế hệ 0; sống sót qua một lần thu thì lên thế hệ kế. Thế hệ trẻ được quét thường xuyên, thế hệ già hiếm hơn. Chỉ object **container** (list, dict, instance class, …) được GC theo dõi; `int`, `str` không thể tạo vòng nên không cần: `gc.is_tracked(0)` → `False`, `gc.is_tracked([])` → `True`. `gc.get_threshold()` → `(2000, 10, 10)` trên 3.14.6 (con số đo được trên máy, docs không cam kết giá trị mặc định).",
      why: "Docs `gc` mô tả ba thế hệ 0, 1, 2 và `gc.is_tracked()` cho biết object có được theo dõi không (https://docs.python.org/3/library/gc.html). Lý do chia thế hệ: đa số object chết trẻ, nên quét nhóm mới thường xuyên tìm được nhiều rác với ít công hơn quét toàn bộ heap mỗi lần.",
    },
    {
      t: "**3.14 đổi rồi đổi lại GC.** CPython 3.14.0–3.14.4 dùng GC **incremental** (hai thế hệ young/old, mỗi lần thu một phần thế hệ già để giảm pause). Từ **3.14.5** đã quay về GC theo thế hệ của 3.13 vì có báo cáo tốn bộ nhớ đáng kể trên production. Khi được hỏi \"Python 3.14 có GC mới không\", trả lời kèm số bản vá.",
      why: "What's New 3.14: \"Python 3.14.0-3.14.4 shipped with a new incremental GC… it has been reverted back to the generational GC from 3.13\" (https://docs.python.org/3/whatsnew/3.14.html); docs `gc` ghi `gc.collect(1)` thu thế hệ giữa trở lại từ 3.14.5 (https://docs.python.org/3/library/gc.html). Điều này nói về bản build mặc định; bản free-threaded có GC riêng (xem dưới).",
    },
    {
      t: "**`gc.freeze()` trước khi `fork`** — server pre-fork (nạp app trong process cha rồi fork worker) nên `gc.disable()` sớm ở process cha, `gc.freeze()` ngay trước `fork()`, rồi `gc.enable()` trong process con. Object đã freeze nằm ở thế hệ \"permanent\" và GC bỏ qua chúng.",
      why: "Đây là khuyến nghị nguyên văn của docs `gc`: mục tiêu là tránh \"unnecessary copy-on-write in child processes\", bằng cách không để GC ở process con chạm vào bộ đếm `gc_refs` của object sống lâu từ process cha (https://docs.python.org/3/library/gc.html). Sau `fork`, cha và con dùng chung trang nhớ cho tới khi một bên ghi (bài Virtual Memory); GC ghi vào header của object là trang đó bị chép riêng cho từng worker.",
    },
    {
      t: "**`gc.disable()` chỉ an toàn khi chắc chắn không tạo vòng.** Exception bắt vào biến cục bộ là nguồn vòng hay gặp: frame giữ exception, exception giữ traceback, traceback giữ frame. Python tự `del` biến trong `except E as e:` khi ra khỏi khối, nhưng nếu bạn gán `self.last_error = e` thì vòng sống tiếp.",
      why: "Docs `gc`: có thể tắt collector \"if you are sure your program does not create reference cycles\" (https://docs.python.org/3/library/gc.html). Language reference nêu đúng ví dụ exception–traceback–frame là \"a common cause of reference cycles\" (https://docs.python.org/3/reference/datamodel.html), và biến sau `as` của `except` bị xoá khi ra khỏi khối chính để tránh vòng này (https://docs.python.org/3/reference/compound_stmts.html).",
    },
    {
      t: "**Đừng dùng `__del__` để đóng resource.** Không bảo đảm `__del__` chạy với object còn sống lúc interpreter thoát, exception trong `__del__` bị nuốt (chỉ in cảnh báo ra stderr), và trên implementation khác nó chạy trễ tuỳ GC. Đóng resource bằng `with` (bài Context Managers & with); cần dọn dẹp \"khi object chết\" thì dùng `weakref.finalize(obj, fn, *args)`.",
      why: "Ba điều này đều là cảnh báo trong mục `object.__del__` (https://docs.python.org/3/reference/datamodel.html). `weakref.finalize` có `alive`, `detach()`, chạy cả lúc thoát (trừ khi `atexit=False`), và docs gọi việc xử lý `__del__` là \"notoriously implementation specific\" (https://docs.python.org/3/library/weakref.html). Callback không được giữ tham chiếu tới chính object (ví dụ bound method của nó), nếu không object không bao giờ chết.",
    },
    {
      t: "**Bản free-threaded dọn bộ nhớ khác.** Không có GIL, refcount phải an toàn khi nhiều thread cùng sửa: CPython dùng **biased reference counting** (thread sở hữu tăng/giảm không cần atomic, thread khác dùng bộ đếm atomic riêng), immortal nhiều object hơn, và cyclic GC dừng mọi thread khi chạy (stop-the-world). Bộ nhớ thường tốn hơn bản mặc định.",
      why: "PEP 703 mô tả biased reference counting, deferred reference counting, mimalloc thay pymalloc, và GC stop-the-world một thế hệ (https://peps.python.org/pep-0703/). Free-threading HOWTO: bản free-threaded \"will typically use more memory\", ví dụ `None` chiếm 32 byte so với 16 byte trên AMD64 (https://docs.python.org/3/howto/free-threading-python.html).",
    },
  ],
  sections: [
    {
      title: "Refcount giải phóng ngay, vòng tham chiếu chờ GC",
      code: {
        lang: "python",
        lines: [
          "import gc",
          "import sys",
          "",
          "class Node:",
          "    def __init__(self, name):",
          "        self.name = name",
          "",
          ["    def __del__(self):", "Chỉ để quan sát lúc object bị giải phóng; code thật không đóng resource ở đây."],
          "        print(\"free\", self.name)",
          "",
          "a = Node(\"a\")",
          ["print(sys.getrefcount(a))", "In `2`: biến `a` cộng tham chiếu tạm của chính lời gọi."],
          "b = a",
          "print(sys.getrefcount(a))",
          "del a",
          ["del b", "Refcount về 0 ở đây nên `free a` in ra ngay dòng này, không chờ GC."],
          "",
          "x, y = Node(\"x\"), Node(\"y\")",
          ["x.peer, y.peer = y, x", "Vòng: mỗi object còn một tham chiếu từ object kia."],
          ["del x, y", "Không in gì: refcount của mỗi object vẫn là 1 dù không tên nào còn trỏ tới."],
          ["print(gc.collect())", "Cyclic GC tìm ra vòng không với tới được: in `free x`, `free y`, rồi số object thu được (`2` khi chạy trên 3.14.6)."],
        ],
      },
    },
    {
      title: "Cache không giữ object sống: WeakValueDictionary",
      code: {
        lang: "python",
        lines: [
          "import weakref",
          "",
          "class Image:",
          "    def __init__(self, key):",
          "        self.key = key",
          "",
          ["cache = weakref.WeakValueDictionary()", "Entry tự biến mất khi không còn strong reference nào tới value (https://docs.python.org/3/library/weakref.html)."],
          "",
          "def load(key):",
          ["    img = cache.get(key)", "Lấy về một strong reference trước rồi mới kiểm tra, để object không chết giữa hai bước."],
          "    if img is None:",
          "        img = Image(key)",
          "        cache[key] = img",
          "    return img",
          "",
          "a = load(\"logo\")",
          ["print(load(\"logo\") is a)", "`True`: lần hai trúng cache."],
          "print(len(cache))",
          "del a",
          ["print(len(cache))", "`0` trên CPython: refcount về 0 nên entry bị xoá ngay. Implementation khác có thể xoá trễ hơn."],
        ],
      },
    },
    {
      title: "Tìm chỗ phình bộ nhớ: so hai snapshot tracemalloc",
      code: {
        lang: "python",
        lines: [
          "import tracemalloc",
          "",
          ["_seen = []", "Lỗi giả lập: list toàn cục chỉ thêm, không bao giờ xoá."],
          "",
          "def handle(req_id):",
          "    _seen.append(\"x\" * 1000 + str(req_id))",
          "",
          ["tracemalloc.start()", "Bật càng sớm càng tốt; `start(25)` giữ 25 frame mỗi traceback nhưng tốn RAM và CPU hơn."],
          "before = tracemalloc.take_snapshot()",
          "for i in range(10_000):",
          "    handle(i)",
          "after = tracemalloc.take_snapshot()",
          ["for stat in after.compare_to(before, \"lineno\")[:3]:", "Sắp theo chênh lệch kích thước; dòng đầu trỏ đúng dòng `_seen.append(...)` với khoảng +10 MB."],
          "    print(stat)",
          "current, peak = tracemalloc.get_traced_memory()",
          "print(f\"current={current / 1e6:.1f} MB peak={peak / 1e6:.1f} MB\")",
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"CPython giải phóng object khi nào?\": trả lời hai tầng. Refcount về 0 thì giải phóng ngay; vòng tham chiếu thì chờ cyclic GC theo thế hệ. Rồi thêm một câu: đó là chi tiết của CPython, nên vẫn đóng resource bằng `with`.",
      why: "Interviewer muốn nghe cả hai cơ chế và biết bạn không dựa vào thời điểm `__del__` chạy. Câu cuối cho thấy bạn đọc language reference chứ không chỉ quan sát CPython.",
    },
    {
      t: "Câu \"service Python bị leak, bạn làm gì?\": đo trước (RSS theo thời gian, `tracemalloc` so snapshot trước/sau N request), tìm dòng cấp phát tăng dần, rồi mới sửa. Nguyên nhân hay gặp: cache/dict toàn cục không giới hạn, `lru_cache` trên method (bài Decorators), list log trong object sống lâu, vòng tham chiếu khi đã tắt GC.",
      why: "Phần lớn \"leak\" trong Python không phải GC hỏng mà là object vẫn với tới được, nên `gc.collect()` không giúp gì; chỉ có đo mới chỉ ra ai đang giữ tham chiếu.",
    },
  ],
  cards: [
    ["`del x` có gọi `x.__del__()` không?", "Không trực tiếp: nó giảm refcount đi 1; `__del__` chỉ chạy khi refcount về 0."],
    ["Vì sao refcount không dọn được vòng tham chiếu?", "Mỗi object trong vòng còn tham chiếu từ object kia nên số đếm không về 0; cyclic GC phải tìm nhóm không với tới được từ bên ngoài."],
    ["Cyclic GC theo dõi những object nào?", "Object container (list, dict, instance…) có thể tạo vòng; `int`, `str` không được theo dõi."],
    ["Khi nào nên `gc.freeze()`?", "Trong server pre-fork: freeze ngay trước `fork()` để GC ở process con không ghi vào object chung, giữ copy-on-write."],
    ["Cache bằng dict làm leak — sửa thế nào?", "Giới hạn kích thước/TTL, hoặc `WeakValueDictionary` nếu object đã được nơi khác giữ; đo bằng `tracemalloc` để xác nhận."],
    ["Thay `__del__` để dọn dẹp bằng gì?", "`with`/context manager cho resource có phạm vi rõ; `weakref.finalize` cho việc dọn khi object chết."],
    ["Python 3.14 dùng GC nào?", "3.14.0–3.14.4: incremental (young/old); từ 3.14.5 quay về GC theo thế hệ như 3.13 (bản mặc định)."],
  ],
});
