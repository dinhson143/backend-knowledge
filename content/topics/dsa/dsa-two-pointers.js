BK.topic({
  id: "dsa-two-pointers",
  track: "dsa",
  section: "dsa-algo",
  title: "Two Pointers",
  goal: "Giải 3-sum, phát hiện chu trình bằng hai con trỏ",
  tldr: {
    t: "**Two pointers** (hai con trỏ) dùng hai chỉ số đi trên cùng một dãy để thay vòng lặp lồng O(n²) bằng một lượt O(n). Ba dạng: **hai đầu đi vào** trên mảng đã sắp (tổng hai số, 3-sum, chứa nhiều nước nhất); **nhanh–chậm** trên linked list (phát hiện cycle, tìm giữa); **đọc–ghi** cùng chiều để sửa mảng tại chỗ (xoá trùng, dời số 0).",
    why: "Mỗi bước loại hẳn một phần tử khỏi mọi cặp còn lại: trên mảng đã sắp, nếu `a[lo] + a[hi]` nhỏ hơn đích thì `a[lo]` cộng với bất kỳ phần tử nào ≤ `a[hi]` cũng nhỏ hơn, nên bỏ `lo` an toàn. Mỗi con trỏ chỉ đi một chiều, tổng số bước ≤ n.",
  },
  story: {
    problem: "Bài \"tìm mọi bộ ba có tổng 0\" giải bằng ba vòng lặp là O(n³); với n = 3000 là khoảng 4,5 tỉ bộ ba, quá giờ. Thêm hash set cho số thứ ba thì xuống O(n²) nhưng loại trùng bộ ba rất rối.",
    idea: "Sắp mảng một lần (O(n log n)). Cố định số thứ nhất, bài còn lại là \"tổng hai số bằng −a[i] trên đoạn đã sắp\" — giải bằng hai đầu đi vào trong O(n). Tổng O(n²), và vì mảng đã sắp nên bỏ trùng chỉ là nhảy qua các giá trị bằng nhau liền kề.",
    tradeoff: "Dạng hai đầu cần mảng đã sắp: sắp tốn O(n log n) và làm mất chỉ số gốc. Bài cần trả chỉ số gốc (Two Sum chưa sắp) thì hash map O(n) tốt hơn.",
  },
  table: {
    head: ["Dấu hiệu trong đề", "Dạng", "Ví dụ"],
    rows: [
      { cells: ["Mảng đã sắp (hoặc được phép sắp) + tìm cặp/bộ có tổng, hiệu cho trước", "Hai đầu đi vào", "Two Sum II, 3Sum, 4Sum"], why: "Tính đơn điệu cho biết dịch con trỏ nào làm tổng tăng hay giảm." },
      { cells: ["Chọn hai biên để tối ưu diện tích / khoảng cách", "Hai đầu đi vào, dịch phía \"yếu\" hơn", "Container With Most Water, Trapping Rain Water"], why: "Dịch phía cao hơn không bao giờ tăng diện tích (chiều rộng giảm, chiều cao vẫn bị phía thấp chặn), nên chỉ dịch phía thấp." },
      { cells: ["Linked list: có cycle không, điểm vào cycle, node giữa, node thứ k từ cuối", "Nhanh–chậm (Floyd)", "Linked List Cycle, Middle of the Linked List"], why: "Nếu có cycle, con trỏ nhanh (2 bước) đuổi kịp con trỏ chậm (1 bước) vì khoảng cách giữa hai con trỏ trong cycle giảm 1 mỗi bước." },
      { cells: ["Sửa mảng tại chỗ, O(1) bộ nhớ: xoá trùng, xoá giá trị, dời số 0", "Đọc–ghi cùng chiều", "Remove Duplicates from Sorted Array, Move Zeroes"], why: "Con trỏ ghi luôn ≤ con trỏ đọc nên ghi đè không làm mất phần tử chưa đọc." },
      { cells: ["Palindrome, đảo ngược", "Hai đầu đi vào, so/đổi chỗ", "Valid Palindrome, Reverse String"], why: "Đối xứng quanh tâm: so cặp (đầu, cuối) rồi thu hẹp." },
    ],
  },
  sections: [
    {
      title: "Template: hai đầu đi vào (tổng hai số trên mảng đã sắp)",
      code: {
        lang: "python",
        lines: [
          "def two_sum_sorted(nums, target):",
          "    lo, hi = 0, len(nums) - 1",
          ["    while lo < hi:", "`<` chứ không `<=`: một phần tử không ghép với chính nó."],
          "        s = nums[lo] + nums[hi]",
          "        if s == target: return [lo, hi]",
          ["        if s < target: lo += 1", "Tổng nhỏ: tăng phía nhỏ. `nums[lo]` không thể ghép với ai còn lại."],
          ["        else: hi -= 1", "Tổng lớn: giảm phía lớn, cùng lập luận."],
          "    return []",
        ],
      },
    },
    {
      title: "Template: 3-sum (cố định một số + hai đầu, bỏ trùng)",
      code: {
        lang: "python",
        lines: [
          "def three_sum(nums):",
          ["    nums.sort(); res = []", "O(n log n), nhỏ hơn phần O(n²) phía sau."],
          "    for i in range(len(nums) - 2):",
          ["        if i > 0 and nums[i] == nums[i - 1]: continue", "Bỏ trùng ở số thứ nhất: cùng giá trị cho cùng tập lời giải."],
          "        lo, hi = i + 1, len(nums) - 1",
          "        while lo < hi:",
          "            s = nums[i] + nums[lo] + nums[hi]",
          "            if s < 0: lo += 1",
          "            elif s > 0: hi -= 1",
          "            else:",
          "                res.append([nums[i], nums[lo], nums[hi]]); lo += 1",
          ["                while lo < hi and nums[lo] == nums[lo - 1]: lo += 1", "Bỏ trùng ở số thứ hai; số thứ ba tự khác vì tổng cố định."],
          "    return res",
        ],
      },
    },
    {
      title: "Template: nhanh–chậm (phát hiện cycle)",
      code: {
        lang: "python",
        lines: [
          "def has_cycle(head):",
          "    slow = fast = head",
          ["    while fast and fast.next:", "Kiểm cả `fast.next` vì `fast` nhảy hai bước."],
          "        slow, fast = slow.next, fast.next.next",
          ["        if slow is fast: return True", "So bằng `is` (cùng node), không so giá trị: hai node khác nhau có thể cùng giá trị."],
          ["    return False", "`fast` chạm cuối danh sách: không có cycle."],
        ],
      },
    },
    {
      title: "Template: đọc–ghi tại chỗ (xoá trùng trên mảng đã sắp)",
      code: {
        lang: "python",
        lines: [
          "def remove_duplicates(nums):",
          ["    write = 0", "`nums[:write]` luôn là kết quả đã đúng."],
          "    for read in range(len(nums)):",
          ["        if write == 0 or nums[read] != nums[write - 1]:", "Phần tử mới khác phần tử cuối đã giữ thì giữ nó."],
          "            nums[write] = nums[read]; write += 1",
          ["    return write", "Độ dài phần đã lọc; phần sau `write` không còn ý nghĩa."],
        ],
      },
    },
    {
      title: "Độ phức tạp",
      table: {
        head: ["Dạng", "Thời gian", "Bộ nhớ thêm"],
        rows: [
          ["Hai đầu trên mảng đã sắp", "O(n) (+ O(n log n) nếu phải sắp)", "O(1) ngoài bộ nhớ của bước sort"],
          ["3-sum", "O(n²)", "O(1) ngoài kết quả và sort"],
          ["Nhanh–chậm", "O(n)", "O(1) — lý do chọn nó thay hash set lưu node đã thăm (O(n))"],
          ["Đọc–ghi tại chỗ", "O(n)", "O(1)"],
        ],
      },
    },
    {
      title: "Bài LeetCode tiêu biểu",
      points: [
        "**167. Two Sum II - Input Array Is Sorted** (https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/) — hai đầu đi vào cơ bản (đề đánh chỉ số từ 1).",
        "**15. 3Sum** (https://leetcode.com/problems/3sum/) — cố định một số, hai đầu, bỏ trùng.",
        "**11. Container With Most Water** (https://leetcode.com/problems/container-with-most-water/) — dịch phía thấp hơn.",
        "**141. Linked List Cycle** (https://leetcode.com/problems/linked-list-cycle/) — nhanh–chậm.",
      ],
    },
    {
      title: "Lỗi hay gặp",
      points: [
        { t: "**Dùng hai đầu trên mảng chưa sắp.**", why: "Lập luận \"bỏ `lo` an toàn\" dựa hoàn toàn vào thứ tự; mảng chưa sắp thì có thể bỏ mất cặp đúng. Đề cần chỉ số gốc thì dùng hash map, hoặc sắp kèm chỉ số `sorted(range(n), key=nums.__getitem__)`." },
        { t: "**Bỏ trùng sai chỗ trong 3-sum** — bỏ trùng trước khi tìm được bộ ba, hoặc quên bỏ trùng ở số thứ nhất.", why: "Bỏ trùng `lo` trước khi khớp có thể bỏ qua lời giải dùng hai giá trị bằng nhau (ví dụ `[-1, -1, 2]`). Chỉ nhảy qua giá trị trùng sau khi đã ghi nhận một bộ." },
        { t: "**Vòng lặp vô hạn** — nhánh nào đó không dịch con trỏ nào.", why: "Mỗi vòng phải dịch ít nhất một con trỏ; kiểm lại từng nhánh `if/elif/else`, nhất là nhánh \"bằng\"." },
        { t: "**Nhanh–chậm truy cập `fast.next.next` khi `fast.next` là `None`.**", why: "Điều kiện vòng lặp phải là `fast and fast.next`; thiếu vế sau là `AttributeError` với danh sách độ dài chẵn." },
      ],
    },
  ],
  tips: [
    {
      t: "Nghe \"sorted\" hoặc \"có thể sắp\" + \"cặp/bộ\" → nói ngay \"hai con trỏ, O(n) sau khi sắp\" rồi mới so với hash map.",
      why: "Nêu cả hai hướng và trade-off (giữ chỉ số gốc, bộ nhớ O(1) hay O(n)) là thứ interviewer muốn nghe trước khi bạn code.",
    },
    {
      t: "Khi chứng minh đúng, nói câu \"phần tử bị bỏ không thể nằm trong lời giải nào còn lại vì…\".",
      why: "Đó là bất biến làm two pointers đúng; nói được nó cho thấy bạn không học thuộc khuôn.",
    },
  ],
  cards: [
    ["Vì sao two pointers trên mảng đã sắp là O(n)?", "Mỗi bước dịch một con trỏ đi một chiều, không quay lại; tổng số bước ≤ n."],
    ["3-sum tốt nhất là bao nhiêu với cách này?", "O(n²) thời gian: sort O(n log n) + n lần hai-đầu O(n)."],
    ["Vì sao con trỏ nhanh chắc chắn gặp con trỏ chậm nếu có cycle?", "Khi cả hai trong cycle, khoảng cách giữa chúng giảm đúng 1 mỗi bước nên sẽ về 0."],
    ["Khi nào hash map tốt hơn two pointers cho Two Sum?", "Khi mảng chưa sắp và cần chỉ số gốc: hash map O(n) thời gian, O(n) bộ nhớ, không phải sắp."],
  ],
});
