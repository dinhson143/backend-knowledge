BK.topic({
  id: "ds",
  track: "dsa",
  section: "dsa-ds",
  title: "Cấu trúc dữ liệu cốt lõi",
  tldr: {
    t: "Hash table cho tra cứu O(1), heap cho top-K, deque cho queue/stack/sliding window, graph/tree cho quan hệ.",
    why: "Hash table đổi bộ nhớ lấy tra cứu bằng cách nhảy thẳng tới bucket; heap chỉ giữ thứ tự từng phần nên chèn rẻ hơn sắp xếp toàn bộ; deque cho thao tác O(1) ở cả hai đầu; graph/tree mô tả trực tiếp quan hệ cha–con hay kết nối.",
  },
  story: {
    problem: "Dùng `list` để kiểm tra “đã gặp chưa” biến mỗi lần tra thành O(n), cả bài thành O(n²). Dùng `list.pop(0)` làm queue cho BFS trên 10⁵ node thì TLE dù thuật toán đúng.",
    idea: "Mỗi cấu trúc dữ liệu tối ưu cho một tập thao tác. Chọn đúng cấu trúc thì thao tác chính rẻ, độ phức tạp tổng giảm theo.",
    tradeoff: "Cấu trúc nhanh ở thao tác này thường chậm hoặc tốn bộ nhớ ở thao tác khác: hash map tra O(1) nhưng không giữ thứ tự, heap lấy min O(1) nhưng tìm phần tử bất kỳ O(n).",
  },
  table: {
    head: ["Cấu trúc", "Python", "Thao tác chính", "Dùng cho"],
    rows: [
      {
        cells: ["Array (dynamic)", "`list`", "index O(1), append O(1)*, insert giữa O(n)", "Hầu hết bài"],
        why: "Mảng liền kề nên index O(1). Append O(1) amortized: khi đầy, Python cấp mảng lớn hơn khoảng 1,125 lần và copy, chi phí copy chia đều cho các lần append. Insert giữa phải dịch mọi phần tử phía sau nên O(n).",
      },
      {
        cells: [
          "Hash map / set",
          "`dict()` / `set()`",
          "get/put/contains O(1) trung bình",
          "Two sum, đếm tần suất, dedupe",
        ],
        why: "Tra cứu nhảy thẳng tới chỗ cần, vì hash function biến key thành index bucket. “Trung bình” vì khi nhiều key va chạm cùng bucket thì phải dò, worst case O(n).",
      },
      {
        cells: ["Stack (LIFO)", "`list` / `deque`", "push/pop O(1)", "Ngoặc hợp lệ, monotonic stack, DFS"],
        why: "Stack không phải dịch phần tử nào, vì chỉ thao tác ở một đầu (cuối list). LIFO khớp với cấu trúc lồng nhau: ngoặc mở gần nhất phải được đóng trước.",
      },
      {
        cells: ["Queue (FIFO)", "`collections.deque`", "append/popleft O(1)", "BFS, sliding window"],
        why: "`deque` là danh sách liên kết các block → thêm/bớt ở cả hai đầu chỉ chỉnh con trỏ, O(1). FIFO đảm bảo BFS xử lý hết tầng k trước tầng k+1.",
      },
      {
        cells: ["Heap", "`heapq` (min-heap)", "push/pop O(log n), peek O(1)", "Top-K, merge K list, Dijkstra"],
        why: "Heap là cây nhị phân hoàn chỉnh lưu trong mảng → push/pop chỉ sift lên hoặc xuống một đường cao log n. Min luôn ở `heap[0]` nên peek O(1); top-K giữ heap kích thước K cho O(n log K).",
      },
      {
        cells: [
          "Linked list",
          "Node tự định nghĩa",
          "chèn/xoá O(1) khi có node",
          "LRU cache (doubly linked list + hash map), reverse, fast/slow pointer",
        ],
        why: "Chèn/xoá chỉ đổi 2 con trỏ, không dịch phần tử nào, vì node nối nhau bằng con trỏ; nhưng phải có sẵn tham chiếu tới node — tìm node vẫn O(n). LRU cache dùng doubly linked list + hash map để vừa tìm O(1) vừa di chuyển node O(1).",
      },
      {
        cells: ["Binary tree", "Node tự định nghĩa", "duyệt O(n), BST tìm O(log n) nếu cân bằng", "DFS/BFS trên cây"],
        why: "Duyệt là O(n) vì phải thăm mọi node. BST cân bằng cao log n, mỗi bước so sánh bỏ được một nhánh → tìm O(log n); cây lệch thành chuỗi thì cao n, tìm O(n).",
      },
      {
        cells: ["Graph", "`dict[node] → list`", "BFS/DFS O(V+E)", "Đường đi, connected components, topo sort"],
        why: "BFS/DFS tốn O(V+E), vì thăm mỗi đỉnh một lần (nhờ tập `visited`) và duyệt mỗi cạnh một lần (hai lần nếu vô hướng). Adjacency list chỉ lưu cạnh thật nên tiết kiệm hơn ma trận V×V khi graph thưa.",
      },
    ],
  },
  points: [
    {
      t: "**Array thường (C, C++, Java `int[]`)** — ô nhớ liền kề chứa trực tiếp giá trị thô.",
      why: "Array duyệt rất nhanh vì giá trị nằm liền nhau trong RAM → CPU nạp cả cache line chứa nhiều phần tử một lúc. Đổi lại, mọi phần tử phải cùng kiểu và cùng kích thước.",
    },
    {
      t: "**Array of pointers (Python list)** — ô nhớ liền kề chứa địa chỉ trỏ tới object thật nằm nơi khác trong RAM.",
      why: "List Python chỉ lưu con trỏ 8 byte kích thước cố định nên vẫn index O(1), dù chứa mọi kiểu object với kích thước khác nhau. Cái giá: mỗi lần truy cập phải nhảy thêm một bước tới object, kém thân thiện cache hơn array thô.",
    },
    {
      t: "**Linked list** — mỗi Node gồm Data và Next pointer.",
      why: "Truy cập phần tử thứ k là O(n), vì node nằm rải rác trong RAM nên phải đi theo `next` k lần. Bù lại, chèn/xoá không cần bộ nhớ liền kề và không phải dịch phần tử.",
    },
    {
      t: "+ `heapq` là min-heap; muốn max-heap thì đẩy `-x`.",
      why: "`heapq` chỉ cài min-heap → đổi dấu để biến phần tử lớn nhất thành nhỏ nhất: `-x` nhỏ nhất tương ứng `x` lớn nhất. Khi lấy ra nhớ đổi dấu lại.",
    },
    {
      t: "+ Không dùng `list.pop(0)` làm queue — O(n); dùng `deque.popleft()`.",
      why: "List là mảng liền kề → `pop(0)` phải dịch n−1 phần tử còn lại sang trái, O(n), và BFS gọi nó n lần thành O(n²). `deque.popleft()` chỉ dịch con trỏ đầu nên O(1).",
    },
  ],
  cards: [
    [
      "Python list lưu phần tử thế nào trong bộ nhớ?",
      "Mảng liền kề các con trỏ (pointer) tới object thật nằm rải rác trong heap memory.",
    ],
    [
      "Làm max-heap với heapq?",
      "heapq chỉ có min-heap: push `-x` và đổi dấu khi pop (hoặc tuple `(-priority, item)`).",
    ],
    [
      "Vì sao dùng deque cho BFS thay vì list?",
      "`deque.popleft()` O(1); `list.pop(0)` O(n) do phải dịch toàn bộ phần tử.",
    ],
  ],
});
