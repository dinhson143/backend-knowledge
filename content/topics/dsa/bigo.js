BK.topic({
  id: "bigo",
  track: "dsa",
  section: "dsa-complexity",
  title: "Big-O cần thuộc",
  tldr: {
    t: "Đọc constraint để đoán độ phức tạp cần đạt: n ≤ 10⁵ → cần O(n log n) hoặc tốt hơn.",
    why: "Đề cho n ≤ 10⁵ là ngầm bảo cần **O(n log n)** hoặc tốt hơn. Máy chạy khoảng 10⁸ phép tính đơn giản mỗi giây: n log n ≈ 1,7×10⁶ thì vừa vặn, còn n² = 10¹⁰ thì vượt khoảng 100 lần.",
  },
  story: {
    problem: "Lời giải O(n²) cho n = 10⁵ là 10¹⁰ phép tính → chạy hàng chục giây, bị Time Limit Exceeded. Code xong mới biết thì đã mất nửa buổi phỏng vấn.",
    idea: "Big-O mô tả số phép tính tăng thế nào khi n tăng, bỏ qua hằng số. Từ constraint của đề, suy ngược ra độ phức tạp tối đa cho phép trước khi code.",
    tradeoff: "Big-O bỏ qua hằng số và cache → hai thuật toán cùng O(n log n) có thể chênh nhau vài lần trên thực tế. Với n nhỏ, thuật toán O(n²) đơn giản đôi khi nhanh hơn.",
  },
  table: {
    head: ["Big-O", "Ví dụ", "n tối đa (~1s)"],
    rows: [
      {
        cells: ["O(1)", "arr[i], push/pop stack, lấy root của heap, get/set hash map", "—"],
        why: "Số bước không phụ thuộc n: mảng nằm liền kề nên `arr[i]` tính địa chỉ bằng `base + i × size` trong một phép tính. Stack push/pop chỉ chạm đỉnh, root heap luôn ở `arr[0]`, hash map tính hash rồi nhảy thẳng vào bucket.",
      },
      {
        cells: ["O(log n)", "Binary search, push/pop heap", "rất lớn"],
        why: "Binary search loại một nửa dữ liệu sau mỗi bước → n = 10⁹ chỉ cần ~30 bước. Heap là cây nhị phân cân bằng cao log n, push/pop chỉ đi một đường từ lá lên gốc hoặc ngược lại.",
      },
      {
        cells: ["O(n)", "Duyệt mảng, linked list; Bubble sort best case (đã sắp xếp, có cờ dừng sớm)", "~10⁷–10⁸"],
        why: "Số bước tỉ lệ thuận n vì phải chạm mỗi phần tử ít nhất một lần. Bubble sort chỉ đạt O(n) ở best case khi có cờ dừng sớm: một lượt quét không có swap nào là biết mảng đã sắp xếp.",
      },
      {
        cells: ["O(n log n)", "Merge sort, Quick sort (trung bình), Timsort (`sorted()`)", "~10⁶"],
        why: "Merge sort chia đôi được log n tầng, mỗi tầng trộn tổng cộng n phần tử → tổng n log n. Sắp xếp dựa trên so sánh không thể nhanh hơn n log n, vì phải phân biệt n! hoán vị, cần log₂(n!) ≈ n log n phép so sánh.",
      },
      {
        cells: ["O(n²)", "2 vòng for lồng nhau, Bubble / Selection / Insertion sort", "~10⁴"],
        why: "Vòng ngoài n lần, mỗi lần vòng trong chạy tới n → tổng ~n²/2 phép tính. Với n = 10⁴ là 10⁸, vừa đủ ~1 giây — đó là ngưỡng trần của O(n²).",
      },
    ],
  },
  points: [
    {
      t: "+ Luôn nói cả **time** và **space** complexity khi chốt lời giải.",
      why: "Chỉ nói time sẽ giấu mất cái giá, vì nhiều lời giải đổi bộ nhớ lấy tốc độ (hash map biến O(n²) thành O(n) nhưng tốn O(n) RAM). Interviewer thường hỏi tiếp “giảm bộ nhớ được không?”.",
    },
    {
      t: "! Quick sort worst case là **O(n²)** (pivot tệ) — Miro chỉ ghi O(n log n).",
      why: "Pivot luôn là phần tử nhỏ nhất hoặc lớn nhất (ví dụ chọn phần tử đầu trên mảng đã sắp xếp) → mỗi lần chia chỉ bớt 1 phần tử, cần n tầng, mỗi tầng O(n). Chọn pivot ngẫu nhiên hoặc median-of-three thì worst case gần như không xảy ra.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/bigo-growth.svg",
      caption: "Hình dạng tăng trưởng của các độ phức tạp hay gặp, và số phép tính khi n = 10⁵: O(n log n) còn trong ngân sách ~10⁸ phép tính/giây, O(n²) vượt khoảng 100 lần.",
    },
  ],
  cards: [
    [
      "Độ phức tạp của Quick sort: trung bình và tệ nhất?",
      "Trung bình O(n log n), tệ nhất O(n²) khi pivot luôn là min/max; space O(log n) trung bình (O(n) tệ nhất nếu không đệ quy phía nhỏ trước).",
    ],
    ["n = 10⁵ thì cần thuật toán độ phức tạp bao nhiêu?", "O(n log n) hoặc O(n); O(n²) = 10¹⁰ là quá chậm."],
  ],
});
