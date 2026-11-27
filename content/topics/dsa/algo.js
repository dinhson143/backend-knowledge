BK.topic({
  id: "algo",
  track: "dsa",
  section: "dsa-algo",
  title: "Thuật toán & pattern",
  tldr: {
    t: "Nhận dạng pattern từ đề bài: sorted → binary search / two pointers; đường đi ngắn nhất không trọng số → BFS; liệt kê mọi tổ hợp → backtracking; tối ưu có subproblem chồng nhau → DP.",
    why: "Mỗi dấu hiệu tương ứng một tính chất: sorted cho phép loại nửa không gian tìm kiếm; BFS lan theo tầng nên lần đầu chạm đích là ngắn nhất; liệt kê mọi tổ hợp thì output đã là mũ; subproblem chồng nhau thì nhớ kết quả để không tính lại.",
  },
  story: {
    problem: "Không có “bản đồ” nối dấu hiệu đề bài với kỹ thuật thì mất thời gian: đọc đề xong không nhận ra dạng bài, ứng viên viết brute force O(2ⁿ) rồi cố tối ưu vụn vặt.",
    idea: "Nhận dạng dấu hiệu là đã có nửa lời giải. Đề bài để lại dấu hiệu (sorted, shortest, all combinations, count ways) trỏ tới tính chất toán học mà một kỹ thuật khai thác được.",
    tradeoff: "Nhận dạng theo khuôn có thể sai khi đề cố tình đánh lừa (ví dụ greedy trông đúng nhưng không có chứng minh). Vẫn cần kiểm chứng bằng phản ví dụ nhỏ.",
  },
  table: {
    head: ["Thuật toán", "Nhận dạng đề", "Độ phức tạp điển hình"],
    rows: [
      {
        cells: ["Binary search", "Mảng đã sắp xếp; “tìm giá trị nhỏ nhất thoả điều kiện”", "O(log n)"],
        why: "Dữ liệu có tính đơn điệu (sorted, hoặc điều kiện “đúng từ điểm x trở đi”) → so với phần tử giữa là biết đáp án nằm nửa nào. Mỗi bước bỏ một nửa nên mất log₂ n bước.",
      },
      {
        cells: ["BFS", "Đường đi ngắn nhất không trọng số, duyệt theo tầng", "O(V+E)"],
        why: "Lần đầu chạm đích chắc chắn là đường ít cạnh nhất, vì BFS thăm mọi đỉnh cách nguồn k cạnh trước khi thăm đỉnh cách k+1 cạnh. Chỉ đúng khi mọi cạnh cùng trọng số; có trọng số thì dùng Dijkstra.",
      },
      {
        cells: ["DFS / Recursion", "Duyệt cây/graph, connected components, cycle", "O(V+E)"],
        why: "DFS khớp tự nhiên với đệ quy và cấu trúc cây, vì nó đi sâu hết một nhánh rồi quay lui. Với đồ thị có hướng, gặp lại đỉnh đang nằm trên stack đệ quy là dấu hiệu có cycle (đồ thị vô hướng: gặp đỉnh đã thăm mà không phải cha); mỗi đỉnh và cạnh được thăm một lần nên O(V+E).",
      },
      {
        cells: ["Backtracking", "Liệt kê mọi subset / permutation / combination", "Mũ (2ⁿ, n!)"],
        why: "Không thể nhanh hơn mũ: n phần tử có 2ⁿ subset và n! permutation, chỉ riêng in ra kết quả đã tốn chừng đó bước. Backtracking cắt nhánh sớm khi vi phạm ràng buộc, nhưng worst case vẫn mũ.",
      },
      {
        cells: ["Greedy", "Chọn tốt nhất cục bộ có chứng minh được (interval scheduling)", "Thường O(n log n)"],
        why: "Greedy phải chứng minh được (bằng exchange argument), vì nó chỉ đúng khi chọn tốt nhất cục bộ không bao giờ làm hỏng đáp án toàn cục. Thường phải sắp xếp trước (ví dụ theo thời gian kết thúc), nên chi phí là O(n log n).",
      },
      {
        cells: ["Dynamic Programming", "Đếm cách / tối ưu, subproblem chồng nhau", "O(số state × chuyển)"],
        why: "Lưu kết quả mỗi state một lần biến mũ thành đa thức, vì subproblem chồng nhau (Fibonacci đệ quy tính `fib(3)` hàng trăm lần). Tổng chi phí = số state × số cách chuyển vào mỗi state.",
      },
    ],
  },
  points: [
    {
      t: "**Merge sort O(n log n)** — chia đôi ở mid, sắp từng nửa rồi trộn; stable, tốn O(n) bộ nhớ.",
      why: "Merge sort là O(n log n) ở mọi trường hợp: chia đôi tạo log n tầng, trộn hai nửa đã sắp xếp mất O(n) mỗi tầng. Stable vì khi bằng nhau luôn lấy từ nửa trái trước; cần mảng phụ để trộn nên tốn O(n) bộ nhớ.",
    },
    {
      t: "**Quick sort O(n log n) trung bình, O(n²) tệ nhất** — chọn pivot, chia hai phía nhỏ hơn / lớn hơn; in-place, không stable.",
      why: "Pivot tốt chia mảng gần đôi → trung bình log n tầng, mỗi tầng partition O(n). Partition hoán đổi ngay trong mảng nên in-place, nhưng stack đệ quy vẫn tốn O(log n), và pivot tệ đẩy lên O(n²).",
    },
    {
      t: "**Selection / Insertion / Bubble sort** — O(n²).",
      why: "Cần n lượt, tổng O(n²), vì mỗi lượt quét O(n) chỉ đưa được một phần tử về đúng vị trí (hoặc dịch từng bước một). Insertion sort vẫn nhanh trên mảng gần sắp xếp vì vòng trong dừng sớm.",
    },
    {
      t: "**Linear search** O(n) vs **Binary search** O(log n) (cần dữ liệu đã sắp xếp).",
      why: "Linear search phải xem từng phần tử vì không biết gì về thứ tự. Binary search dựa vào thứ tự để bỏ một nửa sau mỗi phép so sánh; dữ liệu chưa sắp xếp thì phải sort O(n log n) trước — chỉ đáng khi tra nhiều lần.",
    },
    {
      t: "+ Pattern bổ sung hay gặp: Two pointers, Sliding window, Prefix sum, Monotonic stack, Topological sort, Union-Find.",
      why: "Các pattern này gặp rất nhiều trong đề mảng/chuỗi, vì chúng biến brute force O(n²) thành O(n) bằng cách tái dùng công việc đã làm (prefix sum lưu tổng tích luỹ, sliding window cập nhật khi trượt thay vì tính lại). Topo sort và Union-Find giải bài phụ thuộc và nhóm liên thông trên graph.",
    },
  ],
  cards: [
    [
      "BFS vs DFS — khi nào chọn BFS?",
      "Khi cần đường đi ngắn nhất trên graph không trọng số hoặc xử lý theo tầng; DFS hợp với duyệt toàn bộ, cycle, backtracking.",
    ],
    [
      "Dấu hiệu bài dùng Dynamic Programming?",
      "Hỏi số cách / giá trị tối ưu, có optimal substructure và subproblem chồng nhau.",
    ],
    [
      "Merge sort vs Quick sort?",
      "Merge: luôn O(n log n), stable, cần O(n) bộ nhớ. Quick: trung bình O(n log n), in-place, worst O(n²), thường nhanh hơn thực tế.",
    ],
  ],
});
