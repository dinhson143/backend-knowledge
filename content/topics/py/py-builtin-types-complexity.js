// Ví dụ code: một dòng chạy được, kết quả sau "→" (D161). Đã chạy trên CPython 3.14.6.
BK.topic({
  id: "py-builtin-types-complexity",
  track: "py",
  section: "py-core",
  title: "list, dict, set: Internals & Big-O",
  goal: "Chọn list, dict, set, deque theo Big-O và biết khi nào một thao tác thành O(n)",
  needs: ["py-object-model", "bigo"],
  tldr: {
    t: "`list` là **mảng động chứa con trỏ**: index và `append` O(1), chèn/xoá ở đầu O(n), `x in list` O(n). `dict` và `set` là **hash table**: `in`, lấy, thêm, xoá O(1) trung bình, O(n) khi mọi key đụng hash. `dict` giữ thứ tự chèn (bảo đảm từ 3.7), `set` không có thứ tự. Cần thêm/bớt ở hai đầu thì dùng `collections.deque`.",
    why: "Bảng độ phức tạp chính thức của CPython: \"Time complexity of operations on built-in types\" (https://docs.python.org/3/builtins/time-complexity.html). Trang này thay cho trang wiki TimeComplexity cũ, nay chuyển hướng về đây; nó nói rõ các số liệu là của CPython, giả định đúng kiểu built-in (subclass có thể khác), và O(1) của dict/set là trung bình, giả định hash function phân bố tốt.",
  },
  story: {
    problem: "Job dedup đọc 1 triệu event, kiểm `if event_id not in seen:` với `seen` là list. Chạy thử với 1.000 event thì nhanh; lên production thì job chạy hàng giờ. Mỗi lần `in` quét cả list, tổng cộng O(n²).",
    idea: "Gắn mỗi thao tác hay dùng với một cấu trúc có Big-O phù hợp: hỏi \"có chưa?\" thì `set`/`dict`; thêm/bớt hai đầu thì `deque`; truy cập theo vị trí thì `list`; luôn lấy phần tử nhỏ nhất thì `heapq`.",
    tradeoff: "`set`/`dict` tốn bộ nhớ hơn list nhiều (bảng hash phải có ô trống) và chỉ nhận key hashable. `deque` truy cập giữa là O(n). Không có cấu trúc nào nhanh cho mọi thao tác.",
  },
  table: {
    head: ["Thao tác", "list", "dict / set", "deque"],
    rows: [
      {
        cells: ["Lấy theo index / key", "`l[k]` O(1)", "`d[key]` O(1) trung bình", "O(1) ở hai đầu, O(n) ở giữa"],
        why: "List lưu mảng liền kề các con trỏ nên tính được địa chỉ ô thứ k ngay. Deque là chuỗi khối liên kết nên phải đi qua các khối tới giữa: \"Indexed access is O(1) at both ends but slows to O(n) in the middle\" (https://docs.python.org/3/library/collections.html).",
      },
      {
        cells: ["Thêm cuối", "`append` O(1) amortized", "`d[k] = v`, `s.add(x)` O(1) amortized", "`append` O(1)"],
        why: "Amortized: \"An individual operation may occasionally be O(n) when the underlying storage is resized, but this cost is spread over many operations\" (https://docs.python.org/3/builtins/time-complexity.html). List cấp dư chỗ nên phần lớn lần append không phải copy.",
      },
      {
        cells: ["Thêm / xoá đầu", "`insert(0, x)`, `pop(0)` **O(n)**", "—", "`appendleft`, `popleft` O(1)"],
        why: "Chèn hoặc xoá ở vị trí k phải dịch n − k phần tử phía sau; k = 0 là dịch cả list (https://docs.python.org/3/builtins/time-complexity.html). Docs `collections`: list \"incur O(n) memory movement costs for `pop(0)` and `insert(0, v)`\", còn deque thêm/bớt hai đầu khoảng O(1) (https://docs.python.org/3/library/collections.html). Dùng list làm queue BFS là bẫy kinh điển.",
      },
      {
        cells: ["`x in c`", "**O(n)** (quét tuần tự)", "O(1) trung bình", "O(n)"],
        why: "List phải so từng phần tử; set/dict tính hash rồi nhảy thẳng tới ô. Đo trên máy thử với 100.000 phần tử, 200 lần tìm phần tử cuối: list khoảng 0,13 giây, set khoảng 0,00001 giây. Con số tuyệt đối tuỳ máy, chênh lệch hàng nghìn lần thì không.",
      },
      {
        cells: ["Xoá theo giá trị / key", "`remove(x)` O(n)", "`del d[k]`, `s.discard(x)` O(1)", "`remove(x)` O(n)"],
        why: "List phải tìm (O(n)) rồi dịch phần còn lại (O(n)). Hash table tìm thẳng ô và đánh dấu xoá.",
      },
      {
        cells: ["Slice / copy", "`l[i:j]` O(j − i), `l.copy()` O(n)", "`d.copy()` O(n)", "—"],
        why: "Slice list, tuple, str **tạo bản sao** phần được cắt; chỉ `memoryview` mới cắt O(1) không copy (https://docs.python.org/3/builtins/time-complexity.html). Đệ quy kiểu `f(arr[1:])` vì vậy là O(n²) thời gian và bộ nhớ; truyền index thay vì slice.",
      },
      {
        cells: ["Sắp xếp", "`l.sort()` O(n log n), ổn định", "—", "—"],
        why: "`sort()` được bảo đảm stable, sắp tại chỗ và trả `None`; key được tính một lần cho mỗi phần tử (https://docs.python.org/3/library/stdtypes.html). Thuật toán là adaptive: input đã sắp hoặc sắp ngược chỉ tốn O(n) phép so sánh (https://docs.python.org/3/builtins/time-complexity.html).",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao key phải hashable** — dict/set đặt key vào ô theo `hash(key)`. Nếu value của key đổi sau khi đã chèn thì hash đổi, và lần tìm sau sẽ nhìn sai ô. Vì vậy list, dict, set không làm key được: `{[1]: 2}` → `TypeError: cannot use 'list' as a dict key (unhashable type: 'list')` (thông báo của 3.14).",
      why: "Data model: điều kiện duy nhất là object bằng nhau phải có hash bằng nhau, và class định nghĩa object mutable có `__eq__` thì không nên định nghĩa `__hash__`, \"since the implementation of hashable collections requires that a key's hash value is immutable\" (https://docs.python.org/3/reference/datamodel.html). Muốn dùng list làm key thì đổi thành tuple; set thì đổi thành frozenset.",
    },
    {
      t: "**Key bằng nhau là cùng một key** — `d = {1: \"a\"}; d[1.0] = \"b\"; d[True] = \"c\"; print(d)` → `{1: 'c'}`.",
      why: "`1 == 1.0 == True` và hash của chúng bằng nhau, nên dict coi là một key; key gốc (`1`) được giữ, chỉ value bị ghi đè. Docs: \"Values that compare equal (such as 1, 1.0, and True) can be used interchangeably to index the same dictionary entry\" (https://docs.python.org/3/library/stdtypes.html).",
    },
    {
      t: "**Thứ tự của dict** — giữ thứ tự chèn; cập nhật value của key cũ không đổi thứ tự; xoá rồi thêm lại thì key xuống cuối: `d = {\"x\": 1}; del d[\"x\"]; d[\"y\"] = 2; d[\"x\"] = 3; print(list(d))` → `['y', 'x']`.",
      why: "\"Changed in version 3.7: Dictionary order is guaranteed to be insertion order. This behavior was an implementation detail of CPython from 3.6\" (https://docs.python.org/3/library/stdtypes.html). Set thì được định nghĩa là \"unordered collection\", nên đừng dựa vào thứ tự in ra của set (với str còn đổi giữa các lần chạy vì hash của str có salt ngẫu nhiên — https://docs.python.org/3/reference/datamodel.html).",
    },
    {
      t: "**O(1) của hash table là trung bình** — class có `__hash__` luôn trả 1 làm mọi key đụng cùng ô: tạo dict 2.000 key như vậy mất khoảng 0,1 giây so với 0,00007 giây cho key int (đo trên máy thử, 3.14).",
      why: "\"In the worst case, when every key hashes to the same value, each of the O(1) operations below instead takes O(n) time\" (https://docs.python.org/3/builtins/time-complexity.html). Đây là lý do CPython thêm salt ngẫu nhiên vào hash của str/bytes: để client không tạo được hàng loạt key đụng hash có chủ đích, kiểu tấn công DoS lên dict chứa tham số request (https://docs.python.org/3/reference/datamodel.html).",
    },
    {
      t: "**Bảng hash không co lại khi xoá** — xoá gần hết phần tử của một dict/set lớn thì duyệt nó vẫn tốn thời gian theo kích thước cũ, tới khi có lần chèn làm resize.",
      why: "Trang time complexity: các thao tác quét bảng hash bên trong, \"which is not shrunk when elements are removed\" (https://docs.python.org/3/builtins/time-complexity.html). Cache dài hạn xoá nhiều thì tạo dict mới (`d = dict(d)`) để lấy lại bộ nhớ và tốc độ duyệt.",
    },
    {
      t: "**Sửa dict trong lúc duyệt** — thêm hoặc xoá key khi đang `for k in d` → `RuntimeError: dictionary changed size during iteration`. Duyệt trên bản copy: `for k in list(d):`.",
      why: "Thêm key có thể làm bảng resize và đổi vị trí các ô, iterator không còn biết mình đang ở đâu. Docs: duyệt view trong khi thêm/xoá \"may raise a RuntimeError or fail to iterate over all entries\" (https://docs.python.org/3/library/stdtypes.html). Sửa value của key có sẵn thì không đổi kích thước nên được phép.",
    },
  ],
  sections: [
    {
      title: "Chọn cấu trúc theo câu hỏi",
      table: {
        head: ["Bạn cần", "Dùng", "Ví dụ chạy được"],
        rows: [
          ["Kiểm \"đã thấy chưa\"", "`set`", "`seen = set(); seen.add(42); print(42 in seen)` → `True`"],
          ["Đếm tần suất", "`collections.Counter`", "`Counter(\"banana\").most_common(2)` → `[('a', 3), ('n', 2)]`"],
          ["Gom nhóm", "`collections.defaultdict(list)`", "`g = defaultdict(list); g[\"a\"].append(1)` → `{'a': [1]}`"],
          {
            cells: ["Queue FIFO, BFS, cửa sổ trượt", "`collections.deque`", "`q = deque(maxlen=3)` rồi append 0…4 → `deque([2, 3, 4], maxlen=3)`"],
            why: "Deque có `maxlen` thì khi đầy, thêm ở một đầu sẽ bỏ phần tử ở đầu kia (https://docs.python.org/3/library/collections.html): đúng ngữ nghĩa \"giữ N phần tử cuối\".",
          },
          {
            cells: ["LRU cache tự viết", "`collections.OrderedDict` (`move_to_end`, `popitem(last=False)`)", "Truy cập: `move_to_end(key)`; đầy: `popitem(last=False)` bỏ phần tử cũ nhất"],
            why: "Docs nói OrderedDict xử lý việc đổi thứ tự thường xuyên tốt hơn dict và đưa công thức LRU bằng đúng hai method này (https://docs.python.org/3/library/collections.html). Muốn cache kết quả hàm thì dùng sẵn `functools.lru_cache` (bài Decorators).",
          },
          ["Luôn lấy phần tử nhỏ nhất", "`heapq` trên list", "`heappush` / `heappop` O(log n); chi tiết ở bài Cấu trúc dữ liệu"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Khi viết code trong vòng phỏng vấn, nói Big-O ngay lúc chọn cấu trúc: \"dùng set để `in` là O(1) trung bình\", \"dùng deque vì `pop(0)` của list là O(n)\".",
      why: "Python giấu chi phí sau cú pháp ngắn (`in`, slice, `pop(0)`), và interviewer thường chờ xem bạn có thấy chi phí đó không. Nói ra lúc chọn cho thấy bạn chọn có lý do chứ không gặp may.",
    },
    {
      t: "Bị hỏi \"dict O(1) thật không?\": trả lời \"trung bình, khi hash phân bố đều; xấu nhất O(n) khi đụng hash; thêm key là amortized vì thỉnh thoảng resize\".",
      why: "Ba ý đó phân biệt người thuộc bảng với người hiểu hash table. Thêm câu về hash randomization của str để chống DoS là điểm cộng cho vị trí backend.",
    },
  ],
  cards: [
    ["`x in list` và `x in set` khác nhau thế nào?", "List quét tuần tự O(n); set tính hash rồi nhảy tới ô, O(1) trung bình (O(n) xấu nhất khi đụng hash)."],
    ["`list.pop(0)` tốn gì, thay bằng gì?", "O(n) vì phải dịch mọi phần tử còn lại lên một ô. Dùng `collections.deque` với `popleft()` O(1)."],
    ["Vì sao key của dict phải hashable?", "Dict đặt key vào ô theo hash; nếu key đổi value thì hash đổi và không tìm lại được. Vì vậy chỉ nhận object có hash không đổi (int, str, tuple của phần tử hashable…)."],
    ["`append` là O(1) hay amortized O(1)?", "Amortized O(1): thỉnh thoảng list đầy phải cấp mảng lớn hơn và copy O(n), nhưng cấp dư nên chi phí chia đều ra các lần append."],
    ["Dict có giữ thứ tự không? Set thì sao?", "Dict giữ thứ tự chèn, bảo đảm từ 3.7 (3.6 là chi tiết cài đặt của CPython). Set không có thứ tự."],
    ["`{1: 'a', 1.0: 'b', True: 'c'}` có mấy key?", "Một: `{1: 'c'}`. Ba giá trị bằng nhau và cùng hash nên là cùng một key; key đầu tiên được giữ, value cuối cùng thắng."],
    ["Vì sao `def f(arr): return f(arr[1:])` chậm?", "Mỗi lần slice copy n − 1 phần tử, tổng O(n²) thời gian và bộ nhớ. Truyền index bắt đầu thay vì slice."],
    ["Thêm key vào dict khi đang duyệt nó thì sao?", "`RuntimeError: dictionary changed size during iteration`. Duyệt trên `list(d)` nếu cần sửa."],
  ],
});
