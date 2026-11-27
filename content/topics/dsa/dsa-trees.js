BK.topic({
  id: "dsa-trees",
  track: "dsa",
  section: "dsa-ds",
  title: "Tree & BST",
  goal: "Duyệt cây DFS/BFS, kiểm tra BST và tìm LCA",
  tldr: {
    t: "Gần như mọi bài **binary tree** là một trong hai khuôn: **DFS đệ quy** — đáp án ở một node ghép từ đáp án của cây con trái và phải (`1 + max(depth(left), depth(right))`) — hoặc **BFS theo tầng** bằng `deque`. **BST** (binary search tree: mọi key cây trái < node < mọi key cây phải) thêm một tính chất: duyệt inorder ra dãy tăng dần, và mỗi bước chỉ cần đi một nhánh. Thời gian thường O(n); bộ nhớ O(h) với h là chiều cao: log n nếu cây cân bằng, n nếu cây lệch.",
    why: "Cây con của một cây cũng là cây, nên lời giải cho cả cây viết được bằng lời giải cho hai cây con — đúng hình dạng của đệ quy. DFS và BFS mỗi cách thăm mỗi node đúng một lần nên O(n); DFS giữ một khung đệ quy cho mỗi tầng đang đi nên tốn O(h) stack.",
  },
  story: {
    problem: "Ứng viên kiểm tra BST bằng cách so mỗi node với hai con trực tiếp. Code chạy đúng mọi ví dụ trong đề, rồi sai với cây `5 → (3 → _, 6), 8`: node 6 lớn hơn cha 3 nhưng nằm trong cây trái của 5.",
    idea: "Hỏi \"thông tin gì phải truyền xuống (từ cha) và thông tin gì phải trả lên (từ con)?\". Kiểm tra BST truyền xuống khoảng `(lo, hi)` hợp lệ; chiều cao trả lên một số; LCA trả lên \"đã thấy p/q trong cây con này chưa\".",
    tradeoff: "Đệ quy ngắn và dễ đúng, nhưng cây lệch sâu vài nghìn tầng sẽ vượt giới hạn đệ quy của Python. Viết lặp với stack tường minh thì an toàn hơn nhưng dài và dễ sai thứ tự.",
  },
  table: {
    head: ["Dấu hiệu trong đề", "Nghĩ tới", "Ví dụ"],
    rows: [
      { cells: ["Chiều cao, đường kính, tổng đường đi, cây cân bằng không", "DFS postorder: tính từ con rồi ghép ở cha", "Maximum Depth, Diameter, Balanced Tree"], why: "Đáp án của node cần đáp án của cả hai con trước, nên xử lý node sau khi đã đệ quy hai con (postorder)." },
      { cells: ["\"Theo từng tầng\", \"nhìn từ bên phải\", node gần gốc nhất", "BFS với `deque`, xử lý theo `len(q)` mỗi tầng", "Level Order, Right Side View, Min Depth"], why: "BFS thăm hết tầng k trước tầng k+1; chụp `len(q)` đầu mỗi vòng là biết tầng hiện tại có bao nhiêu node." },
      { cells: ["BST + \"nhỏ thứ k\", \"sắp xếp\", \"liền kề\"", "Duyệt inorder (trái → node → phải)", "Kth Smallest, Validate BST, BST Iterator"], why: "Với BST, inorder cho key tăng dần, nên bài về thứ tự thành bài duyệt mảng đã sắp." },
      { cells: ["BST + tìm/chèn/xoá một key", "Đi một nhánh theo so sánh", "Search, Insert into BST, LCA của BST"], why: "So với node là biết key nằm bên nào, nên chỉ đi một đường từ gốc: O(h)." },
      { cells: ["Tổ tiên chung, đường đi giữa hai node", "DFS trả lên \"đã thấy gì\"", "Lowest Common Ancestor"], why: "Node đầu tiên mà cả hai cây con đều báo đã thấy (hoặc chính nó là một đích) là LCA." },
    ],
  },
  sections: [
    {
      title: "Template: DFS đệ quy (chiều cao)",
      table: {
        head: ["Code", "Vì sao"],
        rows: [
          ["`def max_depth(node):`", "Hàm trả lời câu hỏi cho cây có gốc `node`."],
          ["`\u00a0\u00a0\u00a0\u00a0if node is None:`", "Base case: cây rỗng. Thiếu dòng này là `AttributeError` ở lá."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0return 0`", "Chiều cao cây rỗng là 0."],
          ["`\u00a0\u00a0\u00a0\u00a0return 1 + max(max_depth(node.left), max_depth(node.right))`", "Ghép đáp án hai cây con. Đổi phép ghép là ra bài khác: tổng, đếm, cân bằng."],
        ],
      },
    },
    {
      title: "Template: BFS theo tầng",
      table: {
        head: ["Code", "Vì sao"],
        rows: [
          ["`from collections import deque`", "`deque.popleft()` O(1); `list.pop(0)` là O(n) (https://docs.python.org/3/library/collections.html#collections.deque)."],
          ["`def level_order(root):`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0out, q = [], deque([root]) if root else deque()`", "Cây rỗng thì không có tầng nào."],
          ["`\u00a0\u00a0\u00a0\u00a0while q:`", "Mỗi vòng `while` xử lý trọn một tầng."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0level = []`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0for _ in range(len(q)):`", "Chụp số node của tầng hiện tại trước khi thêm con vào queue."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0node = q.popleft()`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0level.append(node.val)`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0if node.left: q.append(node.left)`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0if node.right: q.append(node.right)`", "Con được xếp sau mọi node còn lại của tầng này."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0out.append(level)`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0return out`", ""],
        ],
      },
    },
    {
      title: "Template: kiểm tra BST bằng khoảng (lo, hi)",
      table: {
        head: ["Code", "Vì sao"],
        rows: [
          ["`def is_bst(node, lo=float(\"-inf\"), hi=float(\"inf\")):`", "Truyền xuống khoảng mà mọi key trong cây con này phải nằm trong."],
          ["`\u00a0\u00a0\u00a0\u00a0if node is None: return True`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0if not (lo < node.val < hi): return False`", "So với cả tổ tiên, không chỉ với cha. Dùng `<` chặt nếu đề cấm key trùng."],
          ["`\u00a0\u00a0\u00a0\u00a0return is_bst(node.left, lo, node.val) and is_bst(node.right, node.val, hi)`", "Đi trái thì cận trên thành `node.val`; đi phải thì cận dưới thành `node.val`."],
        ],
      },
    },
    {
      title: "Template: LCA của binary tree",
      table: {
        head: ["Code", "Vì sao"],
        rows: [
          ["`def lca(node, p, q):`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0if node is None or node is p or node is q:`", "Gặp một trong hai đích thì trả nó lên; so bằng `is` (cùng node), không bằng giá trị."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0return node`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0left, right = lca(node.left, p, q), lca(node.right, p, q)`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0if left and right: return node`", "p và q nằm ở hai phía: node này là tổ tiên chung thấp nhất."],
          ["`\u00a0\u00a0\u00a0\u00a0return left or right`", "Cả hai cùng một phía (hoặc chưa thấy): đẩy kết quả của phía đó lên."],
        ],
      },
    },
    {
      title: "Template: inorder lặp (nhỏ thứ k trong BST)",
      table: {
        head: ["Code", "Vì sao"],
        rows: [
          ["`def kth_smallest(root, k):`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0stack, node = [], root`", "Stack tường minh thay đệ quy: không đụng giới hạn đệ quy."],
          ["`\u00a0\u00a0\u00a0\u00a0while stack or node:`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0while node:`", "Đi hết về bên trái, đẩy từng node lên stack."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0stack.append(node); node = node.left`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0node = stack.pop()`", "Node nhỏ nhất chưa thăm."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0k -= 1`", ""],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0if k == 0: return node.val`", "Dừng sớm: O(h + k) thay vì O(n)."],
          ["`\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0node = node.right`", "Sau node là cây con phải của nó."],
        ],
      },
    },
    {
      title: "Bài LeetCode tiêu biểu",
      points: [
        "**104. Maximum Depth of Binary Tree** (https://leetcode.com/problems/maximum-depth-of-binary-tree/) — DFS postorder cơ bản nhất.",
        "**102. Binary Tree Level Order Traversal** (https://leetcode.com/problems/binary-tree-level-order-traversal/) — BFS theo tầng.",
        "**98. Validate Binary Search Tree** (https://leetcode.com/problems/validate-binary-search-tree/) — truyền khoảng `(lo, hi)` xuống.",
        "**230. Kth Smallest Element in a BST** (https://leetcode.com/problems/kth-smallest-element-in-a-bst/) — inorder dừng sớm.",
        "**236. Lowest Common Ancestor of a Binary Tree** (https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/) — DFS trả lên \"đã thấy\".",
      ],
    },
    {
      title: "Lỗi hay gặp",
      points: [
        { t: "**Kiểm BST chỉ với con trực tiếp** — `node.left.val < node.val < node.right.val` ở mọi node vẫn chưa đủ.", why: "Ràng buộc BST áp lên cả cây con, nên một node sâu trong cây trái vẫn phải nhỏ hơn mọi tổ tiên mà nó nằm bên trái. Truyền `(lo, hi)` xuống, hoặc kiểm inorder tăng dần." },
        { t: "**Đệ quy quá sâu trên cây lệch** — cây 10⁵ node xếp thành một đường thì DFS đệ quy ném `RecursionError`.", why: "CPython giới hạn độ sâu stack interpreter để tránh tràn C stack (https://docs.python.org/3/library/sys.html#sys.getrecursionlimit); giá trị mặc định thường là 1000, kiểm bằng `sys.getrecursionlimit()`. Hỏi interviewer giới hạn chiều cao; nếu có thể sâu, viết lặp với stack." },
        { t: "**Quên base case `None`** hoặc kiểm `node.left.val` khi `node.left` có thể là `None`.", why: "Đưa kiểm `None` vào đầu hàm thay vì kiểm từng con trước khi gọi: một chỗ, không sót." },
        { t: "**BFS bằng `list.pop(0)`** — đúng kết quả nhưng O(n) mỗi lần lấy.", why: "Tài liệu Python ghi `list` tốn O(n) di chuyển bộ nhớ cho `pop(0)`; BFS trên n node thành O(n²). Dùng `deque.popleft()`." },
        { t: "**Không phân biệt độ phức tạp bộ nhớ O(h) và O(n)** khi được hỏi.", why: "DFS tốn O(h) stack; BFS tốn bằng số node của tầng rộng nhất, có thể tới khoảng n/2 ở tầng lá của cây đầy đủ. Nói rõ hai trường hợp cân bằng và lệch." },
      ],
    },
  ],
  tips: [
    {
      t: "Trước khi code, nói: \"mỗi lời gọi đệ quy trả về gì\" và \"cần truyền xuống gì\". Hai câu đó xác định gần hết lời giải.",
      why: "Lỗi hay gặp nhất ở bài cây là trộn hai vai trò: dùng giá trị trả về cho thứ lẽ ra phải truyền xuống (như khoảng của BST), hoặc ngược lại.",
    },
    {
      t: "Hỏi đề: cây có cân bằng không, key có trùng không, node có con trỏ cha không.",
      why: "Ba câu này đổi độ phức tạp (O(log n) hay O(n)), đổi `<` thành `<=`, và có con trỏ cha thì LCA thành bài giao của hai danh sách liên kết.",
    },
  ],
  cards: [
    ["Độ phức tạp DFS trên binary tree?", "Thời gian O(n) (mỗi node một lần); bộ nhớ O(h): log n nếu cân bằng, n nếu lệch."],
    ["Vì sao inorder trên BST ra dãy tăng?", "Inorder thăm cây trái (key nhỏ hơn) → node → cây phải (key lớn hơn), lặp lại ở mọi cây con."],
    ["Khi nào chọn BFS thay DFS trên cây?", "Khi đề nói \"theo tầng\" hoặc cần node gần gốc nhất (Min Depth): BFS dừng ở tầng đầu tiên gặp đích."],
    ["LCA: khi nào node hiện tại là đáp án?", "Khi cả cây con trái và phải đều trả về khác `None`, hoặc chính node là p hay q."],
  ],
});
