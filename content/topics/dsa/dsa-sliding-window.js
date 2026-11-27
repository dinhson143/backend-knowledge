BK.topic({
  id: "dsa-sliding-window",
  track: "dsa",
  section: "dsa-algo",
  title: "Sliding Window",
  goal: "Giải bài chuỗi con dài nhất bằng cửa sổ co giãn",
  needs: ["dsa-two-pointers"],
  tldr: {
    t: "**Sliding window** (cửa sổ trượt) là two pointers cùng chiều trên một **đoạn liên tiếp** `[left, right]`: `right` mở rộng từng bước, `left` co lại khi cửa sổ vi phạm điều kiện, và một cấu trúc nhỏ (bộ đếm `dict`, tổng, `deque`) giữ trạng thái của cửa sổ để không phải tính lại. Hai dạng: **kích thước cố định k** và **co giãn** (dài nhất / ngắn nhất thoả điều kiện). Mỗi phần tử vào và ra cửa sổ tối đa một lần nên O(n).",
    why: "Brute force xét mọi đoạn con là O(n²) đoạn, mỗi đoạn tính lại tốn thêm. Cửa sổ dùng lại kết quả của đoạn trước: thêm một phần tử bên phải, bớt một bên trái, cập nhật trạng thái O(1). `left` chỉ tăng, không lùi, nên vòng `while` bên trong cộng dồn cả bài chỉ chạy tối đa n lần.",
  },
  story: {
    problem: "Bài \"chuỗi con dài nhất không có ký tự lặp\" làm bằng hai vòng lặp cộng một `set` cho mỗi đoạn là O(n²) hoặc O(n³). Với chuỗi 10⁵ ký tự (giới hạn của bài trên LeetCode) thì quá giờ.",
    idea: "Giữ một cửa sổ luôn hợp lệ (không lặp). Thêm `s[right]`; nếu nó làm cửa sổ hỏng, tăng `left` cho tới khi hợp lệ lại. Sau mỗi bước, cửa sổ hiện tại là ứng viên cho đáp án.",
    tradeoff: "Chỉ áp dụng khi điều kiện **đơn điệu** theo độ dài cửa sổ: cửa sổ hỏng thì mở rộng thêm vẫn hỏng (hoặc cửa sổ đạt thì co lại một chút vẫn có thể đạt). Mảng có số âm với điều kiện \"tổng = k\" phá tính chất này — phải dùng prefix sum + hash map.",
  },
  table: {
    head: ["Dấu hiệu trong đề", "Dạng", "Trạng thái cửa sổ"],
    rows: [
      { cells: ["\"đoạn con / chuỗi con **liên tiếp** dài nhất\" thoả điều kiện", "Co giãn, cập nhật đáp án sau khi cửa sổ hợp lệ", "`dict` đếm ký tự, số phần tử vi phạm"], why: "\"Liên tiếp\" là điều kiện bắt buộc; subsequence (không liên tiếp) thường là DP, không phải cửa sổ." },
      { cells: ["\"đoạn con ngắn nhất\" chứa đủ / tổng ≥ k (số không âm)", "Co giãn, co `left` trong khi cửa sổ còn hợp lệ", "`dict` còn thiếu, tổng hiện tại"], why: "Ngược với dạng dài nhất: cập nhật đáp án bên trong vòng co, vì đó là lúc cửa sổ hợp lệ và đang ngắn dần." },
      { cells: ["\"mọi đoạn độ dài k\": tổng, trung bình, max", "Cố định k", "tổng chạy; `deque` đơn điệu cho max/min"], why: "Mỗi bước vào một, ra một; không cần vòng co." },
      { cells: ["\"chứa hoán vị / anagram của p\"", "Cố định `len(p)`", "So hai bộ đếm"], why: "Anagram cùng độ dài với p, nên cửa sổ cố định và so tần suất." },
      { cells: ["\"tối đa k lần đổi / k phần tử khác loại\"", "Co giãn với ngân sách k", "đếm tần suất, số vi phạm"], why: "Cửa sổ hợp lệ khi số vi phạm ≤ k; vượt thì co." },
    ],
  },
  sections: [
    {
      title: "Template: co giãn — đoạn dài nhất hợp lệ",
      code: {
        lang: "python",
        lines: [
          "from collections import defaultdict",
          ["def longest_unique(s):", "Ví dụ: chuỗi con dài nhất không lặp ký tự."],
          ["    count = defaultdict(int); left = best = 0", "Trạng thái của cửa sổ `s[left:right + 1]`."],
          ["    for right, ch in enumerate(s):", "Bước 1: mở rộng bên phải."],
          ["        count[ch] += 1", "Cập nhật trạng thái O(1)."],
          ["        while count[ch] > 1:", "Bước 2: co bên trái tới khi hợp lệ lại. Đổi điều kiện này là ra bài khác."],
          ["            count[s[left]] -= 1; left += 1", "Bỏ phần tử ra khỏi trạng thái trước khi tăng `left`."],
          ["        best = max(best, right - left + 1)", "Bước 3: cửa sổ đã hợp lệ, so với đáp án."],
          "    return best",
        ],
      },
    },
    {
      title: "Template: co giãn — đoạn ngắn nhất chứa đủ (minimum window)",
      code: {
        lang: "python",
        lines: [
          "from collections import Counter",
          "def min_window(s, t):",
          ["    need, missing = Counter(t), len(t)", "`missing` = số ký tự của t còn thiếu trong cửa sổ."],
          "    left, best = 0, (0, float(\"inf\"))",
          "    for right, ch in enumerate(s):",
          ["        if need[ch] > 0: missing -= 1", "Chỉ giảm khi ký tự này còn cần; thừa thì không tính."],
          ["        need[ch] -= 1", "Âm nghĩa là thừa trong cửa sổ."],
          ["        while missing == 0:", "Cửa sổ đủ: thử co để ngắn nhất."],
          ["            if right - left < best[1] - best[0]: best = (left, right)", "Cập nhật **trong** vòng co, khi cửa sổ còn hợp lệ."],
          "            need[s[left]] += 1",
          ["            if need[s[left]] > 0: missing += 1", "Vừa bỏ một ký tự cần thiết: cửa sổ hết đủ."],
          "            left += 1",
          "    return \"\" if best[1] == float(\"inf\") else s[best[0]:best[1] + 1]",
        ],
      },
    },
    {
      title: "Template: cố định k — max của mỗi cửa sổ bằng deque đơn điệu",
      code: {
        lang: "python",
        lines: [
          "from collections import deque",
          "def max_sliding(nums, k):",
          ["    dq, out = deque(), []", "`dq` giữ **chỉ số**, giá trị giảm dần từ đầu tới cuối."],
          "    for i, x in enumerate(nums):",
          ["        while dq and nums[dq[-1]] <= x: dq.pop()", "Phần tử nhỏ hơn x và đứng trước x không bao giờ là max nữa."],
          "        dq.append(i)",
          ["        if dq[0] <= i - k: dq.popleft()", "Chỉ số đầu đã trượt ra khỏi cửa sổ."],
          ["        if i >= k - 1: out.append(nums[dq[0]])", "Đầu `dq` là max của cửa sổ hiện tại."],
          ["    return out", "Mỗi chỉ số vào và ra `dq` một lần: O(n) tổng."],
        ],
      },
    },
    {
      title: "Độ phức tạp",
      table: {
        head: ["Dạng", "Thời gian", "Bộ nhớ thêm"],
        rows: [
          ["Co giãn với bộ đếm", "O(n): `right` đi n bước, `left` tổng cộng ≤ n bước", "O(σ) với σ là số giá trị khác nhau (bảng chữ cái)"],
          ["Cố định k với tổng chạy", "O(n)", "O(1)"],
          ["Cố định k với deque đơn điệu", "O(n)", "O(k)"],
          ["Brute force mọi đoạn", "O(n²) đoạn × chi phí tính mỗi đoạn", "—"],
        ],
      },
    },
    {
      title: "Bài LeetCode tiêu biểu",
      points: [
        "**3. Longest Substring Without Repeating Characters** (https://leetcode.com/problems/longest-substring-without-repeating-characters/) — co giãn, dạng dài nhất.",
        "**424. Longest Repeating Character Replacement** (https://leetcode.com/problems/longest-repeating-character-replacement/) — ngân sách k: hợp lệ khi `độ dài − tần suất lớn nhất ≤ k`.",
        "**567. Permutation in String** (https://leetcode.com/problems/permutation-in-string/) — cố định `len(s1)`, so bộ đếm.",
        "**76. Minimum Window Substring** (https://leetcode.com/problems/minimum-window-substring/) — co giãn, dạng ngắn nhất.",
        "**239. Sliding Window Maximum** (https://leetcode.com/problems/sliding-window-maximum/) — cố định k, deque đơn điệu.",
      ],
    },
    {
      title: "Lỗi hay gặp",
      points: [
        { t: "**Dùng cửa sổ khi có số âm** — \"đoạn con tổng bằng k\" với mảng có số âm.", why: "Thêm phần tử có thể làm tổng giảm, nên cửa sổ \"hỏng\" chưa chắc hỏng khi mở rộng; không biết lúc nào nên co. Dùng prefix sum + hash map đếm tổng đã gặp." },
        { t: "**Cập nhật đáp án sai chỗ** — dạng dài nhất cập nhật trong vòng co, dạng ngắn nhất cập nhật ngoài vòng co.", why: "Dạng dài nhất: cửa sổ chỉ hợp lệ **sau** khi co xong. Dạng ngắn nhất: cửa sổ hợp lệ **trong khi** còn co được. Đặt nhầm là tính cả cửa sổ không hợp lệ." },
        { t: "**Quên bỏ phần tử ra khỏi trạng thái khi tăng `left`.**", why: "Bộ đếm lệch khỏi cửa sổ thật, điều kiện `while` sai và có thể lặp vô hạn hoặc co quá tay." },
        { t: "**Off-by-one ở độ dài** — độ dài cửa sổ `[left, right]` là `right - left + 1`.", why: "Hai đầu đều nằm trong cửa sổ; quên `+ 1` là mọi đáp án thiếu một." },
        { t: "**So sánh hai `dict` đếm mỗi bước** trong bài anagram — đúng, nhưng tốn O(σ) mỗi bước.", why: "Với bảng chữ cái 26 ký tự vẫn ổn; với σ lớn, giữ một biến \"số ký tự đã khớp tần suất\" và cập nhật O(1) khi vào/ra." },
      ],
    },
  ],
  tips: [
    {
      t: "Nghe \"liên tiếp\" + \"dài nhất / ngắn nhất / mọi đoạn độ dài k\" → nói \"sliding window, O(n)\", rồi nói rõ điều kiện hợp lệ và trạng thái cần giữ trước khi code.",
      why: "Hai câu đó (điều kiện, trạng thái) là toàn bộ phần khác nhau giữa các bài; khung vòng lặp thì giống hệt.",
    },
    {
      t: "Khi interviewer hỏi \"vì sao O(n) mà có vòng `while` lồng?\", trả lời bằng phân tích amortized: `left` chỉ tăng, tổng số lần co ≤ n.",
      why: "Đây là câu hỏi kiểm tra bạn hiểu hay học thuộc; câu trả lời đúng là đếm tổng số bước của cả hai con trỏ, không nhân hai vòng lặp.",
    },
  ],
  cards: [
    ["Điều kiện để dùng được sliding window?", "Đoạn **liên tiếp**, và tính hợp lệ đơn điệu theo việc mở rộng/co (ví dụ mảng không âm khi xét tổng)."],
    ["Vì sao vòng `while` lồng trong `for` vẫn O(n)?", "`left` chỉ tăng và không vượt n, nên tổng số lần chạy thân `while` trên cả bài ≤ n."],
    ["Dạng dài nhất và ngắn nhất cập nhật đáp án ở đâu?", "Dài nhất: sau vòng co (cửa sổ đã hợp lệ). Ngắn nhất: trong vòng co (khi cửa sổ còn hợp lệ)."],
    ["Max của mọi cửa sổ độ dài k trong O(n)?", "Deque giữ chỉ số với giá trị giảm dần; đầu deque là max; bỏ đầu khi trượt ra khỏi cửa sổ."],
  ],
});
