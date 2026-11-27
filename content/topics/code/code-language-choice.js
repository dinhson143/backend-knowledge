BK.topic({
  id: "code-language-choice",
  track: "code",
  section: "code-interview",
  title: "Chọn ngôn ngữ phỏng vấn",
  goal: "Chọn ngôn ngữ và thuộc thư viện chuẩn cần cho vòng coding",
  tldr: {
    t: "Chọn ngôn ngữ bạn viết **trôi chảy nhất**, không phải ngôn ngữ \"ấn tượng\" nhất. Python là lựa chọn phổ biến vì ngắn và có sẵn nhiều cấu trúc dữ liệu; Java, C++ ổn nhưng dài hơn; JavaScript thiếu heap và queue có sẵn; Go viết được nhưng thư viện chuẩn mỏng cho dạng bài thuật toán. Dù chọn gì, phải thuộc lòng 8 thứ: mảng động, hash map, hash set, deque, heap, sort có key, binary search, cây có thứ tự (nếu có).",
    why: "Trong 45 phút, nút thắt là suy nghĩ chứ không phải gõ phím; ngôn ngữ quen giúp bạn không phải nghĩ về cú pháp (Tech Interview Handbook — https://www.techinterviewhandbook.org/programming-languages-for-coding-interviews/). Thuộc thư viện chuẩn quan trọng vì mỗi lần phải tự cài heap hay tra tên hàm là mất vài phút và mất mạch trình bày.",
  },
  story: {
    problem: "Ứng viên làm Java hằng ngày nhưng chọn Python \"cho ngắn\", rồi giữa bài quên `heapq` là min-heap, mất 5 phút sửa; hoặc dùng JavaScript, gặp bài top-k và phải tự cài heap từ đầu, hết giờ.",
    idea: "Chọn một ngôn ngữ và luyện tới mức các thao tác cơ bản thành phản xạ. Lập một trang ghi nhớ riêng cho ngôn ngữ đó: tên hàm, độ phức tạp, các bẫy (min-heap hay max-heap, sort mặc định so sánh gì, tràn số).",
    tradeoff: "Ngôn ngữ gọn (Python) dễ giấu chi phí: `x in list` là O(n), `list.pop(0)` là O(n), slicing tạo bản sao. Ngôn ngữ dài (Java, C++) lộ rõ kiểu và chi phí nhưng tốn thời gian gõ. Không có lựa chọn không có bẫy.",
  },
  table: {
    head: ["Ngôn ngữ", "Ưu thế khi phỏng vấn", "Bẫy cần nhớ"],
    rows: [
      {
        cells: ["Python", "Ngắn; `list`, `dict`, `set`, `collections`, `heapq`, `bisect` có sẵn; số nguyên không giới hạn độ lớn", "`heapq` là min-heap; `list.pop(0)` và `insert(0, x)` là O(n); `in` trên list là O(n); đệ quy giới hạn 1000 tầng mặc định"],
        why: "Số nguyên Python có độ chính xác không giới hạn nên không lo tràn số (https://docs.python.org/3/library/stdtypes.html). `heapq` mặc định là min-heap; từ 3.14 có `heappush_max`/`heappop_max`, bản cũ hơn thì đẩy giá trị âm (https://docs.python.org/3/library/heapq.html). `list` tối ưu cho thao tác cuối mảng nên lấy ở đầu phải dịch mọi phần tử; dùng `deque` (https://docs.python.org/3/library/collections.html).",
      },
      {
        cells: ["Java", "Collections đầy đủ: `HashMap`, `ArrayDeque`, `PriorityQueue`, `TreeMap` có `floorKey`/`ceilingKey`; kiểu tĩnh bắt lỗi sớm", "Dài dòng; `int` tràn số im lặng; `PriorityQueue` duyệt bằng iterator không theo thứ tự"],
        why: "Phép toán trên `int` dùng 32-bit và không báo tràn (JLS §4.2.2 — https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html), nên `mid = (lo + hi) / 2` hay tổng lớn có thể ra số âm; dùng `long` hoặc `lo + (hi - lo) / 2`. In hoặc duyệt `PriorityQueue` cho ra mảng heap bên trong, phải `poll()` mới đúng thứ tự (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html).",
      },
      {
        cells: ["C++", "Nhanh; STL đủ: `vector`, `unordered_map`, `deque`, `priority_queue`, `set`/`map` có thứ tự, `lower_bound`", "`priority_queue` mặc định là **max-heap**; tràn số; lỗi bộ nhớ khó debug trên bảng"],
        why: "Mặc định so sánh bằng `std::less` nên `top()` là phần tử lớn nhất; muốn min-heap truyền `std::greater` (https://en.cppreference.com/w/cpp/container/priority_queue). Ngược với Python và Java, nên đổi ngôn ngữ giữa các lần luyện rất dễ nhầm.",
      },
      {
        cells: ["JavaScript / TypeScript", "Quen với dev web; `Map`, `Set` có sẵn; bắt buộc nếu là vị trí frontend", "Không có heap, queue, cây có thứ tự; `sort()` mặc định so sánh **chuỗi**"],
        why: "`[1, 30, 4, 21, 100000].sort()` cho `[1, 100000, 21, 30, 4]` vì không truyền comparator thì phần tử bị đổi sang chuỗi (MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort); luôn viết `sort((a, b) => a - b)`. Thiếu heap thì hỏi interviewer cho giả sử có sẵn một heap với độ phức tạp đã nêu (TIH).",
      },
      {
        cells: ["Go", "Code rõ ràng; `slices` có `Sort`, `BinarySearch`, `Contains`; map có sẵn", "Không có set (dùng `map[T]bool` hoặc `map[T]struct{}`); heap phải cài `heap.Interface` (5 method); TIH xếp Go vào nhóm thư viện chuẩn mỏng cho dạng bài này"],
        why: "`container/heap` chỉ là thuật toán trên kiểu bạn tự định nghĩa: phải viết `Len`, `Less`, `Swap`, `Push`, `Pop` (https://pkg.go.dev/container/heap). Set theo Effective Go là map giá trị `bool` (https://go.dev/doc/effective_go#maps). Nếu chọn Go, luyện sẵn đoạn khung heap tới mức viết trong 1 phút.",
      },
    ],
  },
  points: [
    {
      t: "**Quy tắc chọn** — (1) vị trí yêu cầu ngôn ngữ cụ thể (frontend, mobile) thì dùng ngôn ngữ đó; (2) còn lại chọn ngôn ngữ bạn viết nhiều nhất gần đây; (3) chỉ chuyển sang Python nếu còn vài tuần luyện và bạn thấy mình vướng cú pháp nhiều hơn vướng tư duy.",
      why: "TIH khuyên không học ngôn ngữ mới chỉ để phỏng vấn trừ khi vị trí đòi hỏi hoặc còn nhiều thời gian; lý do kém để đổi là \"công ty đó dùng ngôn ngữ X\" hay \"trông hợp thời\". Interviewer chấm tư duy và độ trôi chảy, không chấm lựa chọn ngôn ngữ.",
    },
    {
      t: "**Phỏng vấn backend thường được hỏi chéo về ngôn ngữ bạn chọn** — nếu ghi Java trong CV, chọn Java thì có thể bị hỏi tiếp về `HashMap` hoạt động thế nào, GC, thread. Chọn ngôn ngữ mình nắm sâu nhất cũng là chọn vùng câu hỏi mình trả lời tốt nhất.",
      why: "Vòng coding backend hay nối sang câu hỏi \"bên dưới chạy thế nào\". Ngôn ngữ bạn dùng hằng ngày là ngôn ngữ bạn có câu chuyện thật để kể (bug đã gặp, tối ưu đã làm).",
    },
    {
      t: "**Trang ghi nhớ một trang** — với ngôn ngữ đã chọn, tự viết từ trí nhớ: khởi tạo từng cấu trúc, các thao tác chính và độ phức tạp, cách sort theo nhiều khoá, cách đổi min-heap ↔ max-heap, cách duyệt map theo thứ tự. Viết lại tới khi không phải tra.",
      why: "Tự viết từ trí nhớ lộ ra chỗ mình tưởng biết mà không biết. Trong phòng phỏng vấn không có Google; một lần ngập ngừng về tên hàm là một lần mất mạch nói.",
    },
    {
      t: "**Chi phí ẩn phải nói được** — `s + c` trong vòng lặp tạo chuỗi mới mỗi lần (Python, Java `String`); slicing `a[1:]` tạo bản sao O(n); `sorted()` là O(n log n) dù gọn một dòng; `bisect.insort` tìm O(log n) nhưng chèn O(n).",
      why: "Interviewer hay hỏi \"dòng này tốn bao nhiêu?\" đúng ở các chỗ ngôn ngữ giấu chi phí. Ví dụ tài liệu `bisect` ghi rõ phần tìm O(log n) bị phần chèn O(n) lấn át (https://docs.python.org/3/library/bisect.html).",
    },
  ],
  sections: [
    {
      title: "8 cấu trúc phải thuộc, theo ngôn ngữ",
      table: {
        head: ["Cần", "Python", "Java", "C++", "JavaScript", "Go"],
        rows: [
          { cells: ["Mảng động", "`list`", "`ArrayList`", "`vector`", "`Array`", "slice `[]T`"], why: "Thêm vào cuối amortized O(1) ở cả năm ngôn ngữ; chèn/xoá ở đầu hoặc giữa là O(n)." },
          { cells: ["Hash map", "`dict`, `defaultdict`, `Counter`", "`HashMap`", "`unordered_map`", "`Map`", "`map[K]V`"], why: "`Counter.most_common(k)` và `defaultdict(list)` tiết kiệm nhiều dòng trong bài đếm tần suất và gom nhóm (https://docs.python.org/3/library/collections.html). Go phân biệt \"không có key\" với \"giá trị 0\" bằng `v, ok := m[k]`." },
          { cells: ["Hash set", "`set`", "`HashSet`", "`unordered_set`", "`Set`", "`map[T]bool`"], why: "Dùng cho \"đã thấy chưa\" O(1) trung bình; đổi `list` sang `set` là tối ưu hay gặp nhất trong bài coding." },
          { cells: ["Queue / deque", "`collections.deque`", "`ArrayDeque`", "`deque`", "không có (mảng + chỉ số đầu)", "slice hoặc `container/list`"], why: "BFS cần pop đầu O(1). Java khuyên `ArrayDeque` thay `Stack` và `LinkedList` vì thường nhanh hơn; nó không nhận `null` (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html). JavaScript `shift()` phải dời mọi phần tử nên trên mảng lớn thường là O(n); giữ một chỉ số đầu thay vì gọi `shift`." },
          { cells: ["Stack", "`list` (`append`/`pop`)", "`ArrayDeque` (`push`/`pop`)", "`vector` hoặc `stack`", "`Array` (`push`/`pop`)", "slice"], why: "Thao tác ở cuối mảng là O(1), nên mảng động đủ làm stack ở mọi ngôn ngữ." },
          { cells: ["Heap", "`heapq` (min)", "`PriorityQueue` (min)", "`priority_queue` (**max**)", "không có", "`container/heap` (min, tự cài interface)"], why: "Mặc định ngược nhau giữa C++ và phần còn lại là nguồn bug hay gặp nhất khi làm bài top-k." },
          { cells: ["Sort theo khoá", "`sorted(xs, key=…)`", "`list.sort(Comparator…)`", "`sort(…, cmp)`", "`sort((a, b) => …)`", "`slices.SortFunc`"], why: "Sort nhiều khoá: Python dùng tuple `key=lambda p: (-p.score, p.name)`; Java dùng `Comparator.comparing(…).thenComparing(…)`. `sort()` của JS ổn định từ ES2019 (MDN)." },
          { cells: ["Binary search / có thứ tự", "`bisect` (không có cây có thứ tự trong stdlib)", "`Collections.binarySearch`, `TreeMap`", "`lower_bound`, `set`, `map`", "không có", "`slices.BinarySearch`, `sort.Search`"], why: "`TreeMap` đảm bảo O(log n) cho get/put/remove và có `floorKey`/`ceilingKey` (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html). Python không có cây có thứ tự chuẩn: bài cần \"key lớn nhất ≤ x\" có cập nhật liên tục thì phải nghĩ cách khác (heap, sort trước)." },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Mở đầu buổi phỏng vấn, nói ngôn ngữ mình dùng và hỏi có được không, nhất là khi dùng ngôn ngữ ít phổ biến.",
      why: "Một câu xác nhận tránh bất ngờ giữa chừng (ví dụ môi trường online không hỗ trợ ngôn ngữ đó) và cho interviewer chuẩn bị đọc code.",
    },
    {
      t: "Dùng hàm thư viện thì nói độ phức tạp của nó: \"`heapq.nlargest(k, xs)` là O(n log k)\". Nếu interviewer muốn bạn tự cài, họ sẽ nói.",
      why: "Dùng thư viện đúng chỗ là tín hiệu \"nắm vững ngôn ngữ\" ở trục kỹ năng code; nói kèm độ phức tạp cho thấy bạn không coi thư viện là hộp đen.",
    },
    "Luyện ít nhất 20–30 bài bằng đúng ngôn ngữ sẽ dùng, trong đúng loại editor sẽ dùng (thường là editor online không có autocomplete).",
  ],
  cards: [
    ["Tiêu chí số một khi chọn ngôn ngữ phỏng vấn?", "Ngôn ngữ bạn viết trôi chảy nhất, trừ khi vị trí yêu cầu ngôn ngữ cụ thể."],
    ["`heapq` của Python và `priority_queue` của C++ mặc định là heap gì?", "`heapq`: min-heap (3.14 có thêm hàm `_max`). C++ `priority_queue`: max-heap; truyền `std::greater` để có min-heap."],
    ["`[1, 30, 4, 21, 100000].sort()` trong JavaScript cho kết quả gì, vì sao?", "`[1, 100000, 21, 30, 4]`: không có comparator thì so sánh dạng chuỗi. Viết `sort((a, b) => a - b)`."],
    ["BFS trong Python nên dùng gì làm queue?", "`collections.deque` với `popleft()` O(1). `list.pop(0)` là O(n)."],
    ["Vì sao `(lo + hi) / 2` nguy hiểm trong Java?", "`int` 32-bit tràn số im lặng khi `lo + hi` lớn; viết `lo + (hi - lo) / 2`."],
    ["Go không có set, làm thế nào?", "Dùng `map[T]bool` (hoặc `map[T]struct{}`), kiểm tra bằng `m[x]` hoặc `_, ok := m[x]`."],
    ["Duyệt `PriorityQueue` của Java bằng for-each có ra đúng thứ tự không?", "Không. Iterator đi theo mảng heap bên trong; phải `poll()` liên tục mới ra đúng thứ tự ưu tiên."],
  ],
});
