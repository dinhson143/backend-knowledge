BK.topic({
  id: "code-debugging",
  track: "code",
  section: "code-testing",
  title: "Debug có hệ thống",
  goal: "Tái hiện, thu hẹp, chia đôi bằng git bisect để tìm bug",
  tldr: {
    t: "**Debugging** có hệ thống là một vòng lặp: **tái hiện** bug một cách chắc chắn → **thu hẹp** (input nhỏ nhất, commit đầu tiên hỏng, dòng code đầu tiên sai) → đặt **một giả thuyết** và kiểm bằng **một thay đổi** → sửa và giữ lại một **regression test**. Công cụ chia đôi là bạn thân: `git bisect` chia đôi lịch sử commit, xoá nửa input chia đôi dữ liệu, tắt nửa code chia đôi chương trình.",
    why: "Đoán mò rồi sửa thử có thể đúng, nhưng không biết vì sao đúng và bug hay quay lại. Chia đôi biến tìm kiếm tuyến tính thành log₂: `git bisect` báo khoảng 675 commit cần tầm 10 bước kiểm (https://git-scm.com/docs/git-bisect). Test giữ lại chứng minh bạn đã sửa đúng nguyên nhân.",
  },
  story: {
    problem: "API trả 500 cho khoảng 2% request sau lần deploy hôm qua. Dev đọc code, đoán do cache, thêm `try/except`, deploy lại: lỗi giảm còn 1% nhưng dữ liệu bắt đầu sai. Ba ngày sau mới biết nguyên nhân là một thư viện parse ngày đổi hành vi với múi giờ.",
    idea: "Trước khi sửa, tìm một input tái hiện được 100% (lấy từ log: request id, payload). Từ đó thu hẹp: chạy commit cũ để biết hồi quy hay bug cũ; `git bisect` ra đúng commit; trong commit đó, bước qua bằng debugger tới dòng đầu tiên có giá trị sai.",
    tradeoff: "Làm có hệ thống chậm hơn đoán khi bug dễ. Nhưng đoán sai một lần (như thêm `try/except` che lỗi) tốn nhiều hơn cả vòng lặp. Với bug khó tái hiện (race condition, chỉ xảy ra ở production), phải đầu tư vào log và observability trước khi có thể thu hẹp.",
  },
  table: {
    head: ["Bước", "Làm gì", "Dấu hiệu làm đúng"],
    rows: [
      {
        cells: ["1. Đọc lỗi", "Đọc hết thông điệp và stack trace; với traceback Python, dòng cuối là exception, khung dưới cùng là nơi ném", "Nói được \"lỗi X ở dòng Y khi đang làm Z\""],
        why: "Traceback Python in \"most recent call last\": khung gần nhất ở cuối. Exception có `__cause__` thì traceback in cả lỗi gốc ở trên (https://docs.python.org/3/library/exceptions.html). Nhiều bug được giải ngay ở bước này nếu đọc kỹ thay vì lướt.",
      },
      {
        cells: ["2. Tái hiện", "Viết lại bằng một lệnh chạy được: script, test đỏ, `curl` với payload từ log", "Chạy 10 lần đỏ 10 lần"],
        why: "Không tái hiện được thì không kiểm được giả thuyết, cũng không biết đã sửa xong. Bug chỉ đỏ thỉnh thoảng thường là dấu hiệu phụ thuộc thời gian, thứ tự hoặc state dùng chung — bản thân điều đó đã là manh mối.",
      },
      {
        cells: ["3. Thu hẹp", "Cắt input còn nhỏ nhất vẫn lỗi; tìm commit đầu tiên hỏng (`git bisect`); tìm dòng đầu tiên giá trị sai", "Một input vài dòng, một commit, một hàm"],
        why: "Mỗi lần chia đôi loại một nửa không gian tìm kiếm. So sánh bản chạy được với bản hỏng (commit, config, phiên bản thư viện, dữ liệu) thường nhanh hơn đọc code từ đầu.",
      },
      {
        cells: ["4. Giả thuyết", "Phát biểu \"lỗi vì A\" kèm dự đoán \"nếu đúng thì B sẽ xảy ra\"; đổi **một** thứ để kiểm", "Dự đoán đúng hoặc sai rõ ràng"],
        why: "Đổi nhiều thứ cùng lúc thì dù bug hết cũng không biết thay đổi nào có tác dụng, và thường để lại thay đổi thừa trong code.",
      },
      {
        cells: ["5. Sửa và khoá lại", "Viết test đỏ tái hiện bug, sửa cho xanh, chạy cả bộ test", "Test mới đỏ trước khi sửa, xanh sau khi sửa"],
        why: "Test đỏ trước chứng minh test bắt đúng bug; giữ test lại chặn hồi quy. Sửa triệu chứng (bắt exception, thêm `if x is None`) mà không hiểu nguyên nhân thường chỉ dời bug sang chỗ khác.",
      },
    ],
  },
  points: [
    {
      t: "**`git bisect`** — `git bisect start`, `git bisect bad` (commit hiện tại hỏng), `git bisect good <tag>` (bản cũ chạy đúng); Git checkout commit giữa, bạn kiểm rồi đáp `good`/`bad`; xong thì `git bisect reset`.",
      why: "Mỗi câu trả lời chia đôi khoảng commit còn lại, nên n commit cần khoảng log₂ n bước; Git tự in số bước ước lượng còn lại (https://git-scm.com/docs/git-bisect). Muốn tìm commit làm *thay đổi* một hành vi (không phải làm hỏng) thì dùng `old`/`new` thay cho `good`/`bad`.",
    },
    {
      t: "**Tự động hoá bằng `git bisect run <lệnh>`** — lệnh thoát 0 là good, 1–127 (trừ 125) là bad, 125 là bỏ qua commit không build được. Ví dụ: `git bisect run pytest tests/test_tax.py -x`.",
      why: "Đây là quy ước mã thoát trong tài liệu `git bisect`; mã ngoài khoảng đó (ví dụ ≥ 128) làm dừng cả phiên bisect. Có test tái hiện ở bước 2 thì bisect chạy một mình, không cần người ngồi bấm. Lưu ý: file test mới viết không có ở các commit cũ, mà pytest không tìm thấy file thì thoát mã khác 0 (https://docs.pytest.org/en/stable/reference/exit-codes.html), nên bisect sẽ đánh dấu nhầm là bad; đặt script test ngoài repo (hoặc để untracked) để mọi commit đều chạy được nó.",
    },
    {
      t: "**Debugger thay vì `print` rải rác** — đặt `breakpoint()` (Python 3.7+) ở chỗ nghi ngờ; trong pdb: `p expr` xem giá trị, `n` sang dòng kế, `s` vào hàm, `w` xem stack, `u`/`d` lên/xuống khung, `c` chạy tiếp.",
      why: "`breakpoint()` thay cho `import pdb; pdb.set_trace()` (https://docs.python.org/3/library/pdb.html). Đặt biến môi trường `PYTHONBREAKPOINT=0` thì mọi `breakpoint()` thành no-op, nên lỡ để quên cũng không treo CI (PEP 553 — https://peps.python.org/pep-0553/). Debugger cho xem mọi biến ở mọi khung mà không phải sửa code và chạy lại.",
    },
    {
      t: "**Post-mortem** — chạy `python -m pdb script.py`: chương trình crash thì pdb dừng đúng tại khung ném lỗi, xem được biến lúc đó. Trong REPL dùng `pdb.pm()` sau exception.",
      why: "Tài liệu pdb: chạy như module thì tự vào post-mortem khi chương trình thoát bất thường. Không phải đoán đặt breakpoint ở đâu; state lúc lỗi còn nguyên.",
    },
    {
      t: "**Treo, không crash** — `python -X faulthandler` hoặc `faulthandler.dump_traceback_later(60)` in traceback của mọi thread khi chạy quá giờ; trên Unix `faulthandler.register(signal.SIGUSR1)` rồi `kill -USR1 <pid>` để xem process đang kẹt ở đâu.",
      why: "`faulthandler` viết bằng C nên vẫn in được traceback khi crash hoặc deadlock, lúc mà code Python thường không chạy được nữa (https://docs.python.org/3/library/faulthandler.html). `register()` không có trên Windows.",
    },
    {
      t: "**Bug ở production: dựa vào log, metric, trace** — tìm request id của lỗi, lấy payload và phiên bản code, rồi tái hiện ở local. Không gắn debugger vào process production đang phục vụ người dùng.",
      why: "Debugger dừng cả process (hoặc thread), các request khác bị treo theo. Log có cấu trúc kèm request id và stack (`logger.exception`) là thứ cho phép tái hiện sau sự cố; xem `observability`.",
    },
    {
      t: "**Giải thích cho người khác (hoặc cho con vịt cao su)** — nói từng dòng code làm gì và bạn kỳ vọng gì; chỗ bạn ngập ngừng thường là chỗ giả định sai.",
      why: "Nói thành lời buộc bạn đi qua từng bước thay vì nhảy cóc qua chỗ \"chắc chắn đúng\" — mà bug thường nằm ở đó.",
    },
  ],
  sections: [
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "**Sửa triệu chứng** — thêm `if x is None: return` ở chỗ nổ mà không hỏi vì sao `x` là `None`.",
          why: "Lỗi gốc vẫn còn và sinh dữ liệu sai ở chỗ khác; bạn chỉ dời chỗ nó nổ.",
        },
        {
          t: "**Heisenbug** — thêm `print` hoặc chạy debugger thì bug biến mất.",
          why: "In ra hay dừng ở breakpoint làm đổi thời gian chạy, nên bug phụ thuộc thứ tự giữa các thread (race condition) có thể không còn xuất hiện. Dấu hiệu này tự nó đã gợi ý tìm ở phía concurrency.",
        },
        {
          t: "**Tin vào giả định chưa kiểm** — \"config chắc chắn đúng\", \"thư viện không thể sai\", \"code này chưa ai đụng\".",
          why: "Kiểm giả định rẻ (in config đang dùng, xem `pip freeze`, `git log` file đó) hơn nhiều so với đi lạc nửa ngày trên giả định sai.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Vòng coding: code chạy sai với ví dụ thì đừng sửa ngẫu nhiên; trace bằng tay một input nhỏ, nói to giá trị từng biến sau mỗi vòng lặp.",
      why: "Interviewer thấy được cách bạn debug — đó là một trong những thứ họ chấm. Sửa ngẫu nhiên để \"thử xem\" là tín hiệu xấu dù cuối cùng chạy đúng.",
    },
    {
      t: "Câu hỏi behavioral \"kể về một bug khó\": kể theo vòng lặp — triệu chứng, cách tái hiện, cách thu hẹp, nguyên nhân gốc, cách sửa và cách ngăn tái diễn (test, alert).",
      why: "Câu chuyện có cấu trúc này cho thấy bạn có phương pháp, không phải gặp may.",
    },
  ],
  cards: [
    ["`git bisect` cần bao nhiêu bước cho khoảng 1.000 commit?", "Khoảng 10, vì mỗi bước chia đôi khoảng còn lại (2¹⁰ = 1024)."],
    ["Mã thoát của lệnh trong `git bisect run` nghĩa là gì?", "0 = good, 1–127 trừ 125 = bad, 125 = bỏ qua commit này; mã khác làm dừng bisect."],
    ["Lỡ để quên `breakpoint()` trong code, làm sao để CI không treo?", "Đặt `PYTHONBREAKPOINT=0`: `breakpoint()` thành no-op (PEP 553)."],
    ["Process Python bị treo, xem nó kẹt ở đâu thế nào?", "`faulthandler.dump_traceback_later(timeout)` hoặc trên Unix `faulthandler.register(SIGUSR1)` rồi gửi tín hiệu: in traceback mọi thread."],
    ["Vì sao chỉ đổi một thứ mỗi lần?", "Để biết chắc thay đổi nào có tác dụng và không để lại thay đổi thừa."],
  ],
});
