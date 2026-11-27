// Id giữ tiền tố `thr-` (D112): bài từng được lên kế hoạch ở Nền tảng CS, chuyển sang nhánh Python.
// Khối code (D13) đã chạy bằng `python -I` trên CPython 3.14.6 bản mặc định (có GIL, Windows, 16 core).
// Máy này không có bản free-threaded: hành vi của bản đó lấy từ docs, ghi rõ nguồn.
BK.topic({
  id: "thr-gil",
  track: "py",
  section: "py-concurrency",
  title: "GIL & Free-threading",
  goal: "Biết khi nào multithreading Python có ích và khi nào không",
  needs: ["thr-io-vs-cpu-bound"],
  tldr: {
    t: "**GIL** (Global Interpreter Lock) là khoá của CPython: tại một thời điểm chỉ **một thread chạy bytecode Python**. Thread vẫn có ích cho việc I/O-bound vì GIL luôn được nhả khi chờ I/O, và thư viện C (hashlib, zlib, NumPy…) nhả GIL khi tính nặng. Code Python thuần CPU-bound chạy trên nhiều thread **không nhanh hơn** một thread. Từ 3.13 có **bản build free-threaded** tắt GIL; từ 3.14 bản đó được hỗ trợ chính thức (PEP 779) nhưng **vẫn là tuỳ chọn**, không phải mặc định.",
    why: "Glossary: GIL \"assure[s] that only one thread executes Python bytecode at a time\", làm object model (kể cả `dict`) \"implicitly safe against concurrent access\" với cái giá là mất phần lớn khả năng chạy song song trên nhiều core; \"the GIL is always released when doing I/O\" (https://docs.python.org/3/glossary.html). Trạng thái free-threading: PEP 779 \"officially supported but still optional\" ở 3.14 (https://peps.python.org/pep-0779/).",
  },
  story: {
    problem: "Một job tính checksum tự viết bằng Python cho 10.000 file chạy 40 phút. Team bọc nó trong `ThreadPoolExecutor(max_workers=16)` trên máy 16 core: vẫn khoảng 40 phút, CPU tổng chỉ quanh một core. Trong khi đó phần tải file từ S3 cũng bằng thread lại nhanh hơn hẳn.",
    idea: "Vòng lặp Python thuần cần GIL để chạy từng lệnh bytecode, nên 16 thread lần lượt chờ nhau. Phần tải file nhả GIL trong lúc chờ socket nên nhiều thread chờ cùng lúc được. Sửa phần CPU bằng `ProcessPoolExecutor` (mỗi process một GIL), dùng `hashlib` (nhả GIL với dữ liệu lớn), hoặc thử bản free-threaded.",
    tradeoff: "GIL làm interpreter đơn giản và code đơn thread nhanh: không phải khoá từng object, refcount không cần thao tác atomic. Bỏ GIL thì code đơn thread chậm đi vài phần trăm, tốn bộ nhớ hơn, và extension C phải được viết lại cho an toàn. Process thì tránh được GIL nhưng tốn RAM và phải pickle dữ liệu qua ranh giới process.",
  },
  table: {
    head: ["Tình huống", "Bản mặc định (có GIL)", "Bản free-threaded (3.13t, 3.14t)"],
    rows: [
      {
        cells: ["Vòng lặp Python thuần, CPU-bound, 4 thread", "≈ thời gian chạy tuần tự (đo: 0,71 s tuần tự, 0,69 s với 4 thread)", "Chạy song song thật trên nhiều core"],
        why: "Đo bằng khối code bên dưới trên 3.14.6. Docs `threading`: trong CPython, do GIL \"only one thread can execute Python code at once\"; muốn dùng nhiều core thì dùng `multiprocessing` hoặc `ProcessPoolExecutor`, và từ 3.13 bản free-threaded tắt được GIL \"but this feature is not available by default\" (https://docs.python.org/3/library/threading.html).",
      },
      {
        cells: ["I/O-bound: chờ network, disk, `time.sleep`", "Nhanh lên theo số thread (đo: 4 việc × 0,5 s xong trong 0,50 s)", "Như bản mặc định"],
        why: "Thread nhả GIL trước khi vào lời gọi hệ thống chờ I/O, nên thread khác chạy trong lúc chờ (https://docs.python.org/3/glossary.html). Đây là lý do `ThreadPoolExecutor` vẫn hợp với HTTP client, driver DB đồng bộ.",
      },
      {
        cells: ["Thư viện C tính nặng: `hashlib`, `zlib`, NumPy", "Song song được nếu thư viện nhả GIL", "Song song được; nếu extension chưa khai báo hỗ trợ free-threading thì GIL bị bật lại khi import"],
        why: "Ví dụ cụ thể: `hashlib` nhả GIL khi tính hash cho \"more than 2047 bytes of data at once\" (https://docs.python.org/3/library/hashlib.html). Về extension chưa đánh dấu: \"The GIL may also automatically be enabled when importing a C-API extension module that is not explicitly marked as supporting free threading. A warning will be printed in this case\" (https://docs.python.org/3/howto/free-threading-python.html).",
      },
      {
        cells: ["`count += 1` từ nhiều thread", "Vẫn race: GIL không làm chuỗi nhiều lệnh bytecode thành atomic", "Vẫn race; cần `threading.Lock` như mọi ngôn ngữ"],
        why: "Chi tiết ở bài Race Condition. Free-threading HOWTO: `dict`, `list`, `set` có khoá nội bộ để không hỏng cấu trúc, nhưng khuyên dùng `threading.Lock` thay vì dựa vào khoá nội bộ đó (https://docs.python.org/3/howto/free-threading-python.html).",
      },
      {
        cells: ["Code đơn thread", "Nhanh nhất", "Chậm hơn vài phần trăm và tốn bộ nhớ hơn (số liệu ở mục dưới)"],
        why: "Không có GIL thì refcount và mọi container phải an toàn khi nhiều thread cùng sửa: biased reference counting, khoá theo từng object, allocator mimalloc (https://peps.python.org/pep-0703/). Những thứ đó tốn chi phí cả khi chỉ có một thread.",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao CPython có GIL** — mỗi object có refcount bị sửa trên mọi phép gán (bài Reference Counting & GC). Nếu hai thread cùng tăng/giảm một refcount không khoá thì số đếm sai, object bị giải phóng khi còn dùng hoặc không bao giờ được giải phóng. Một khoá chung cho cả interpreter giải quyết điều đó với chi phí nhỏ nhất cho code đơn thread.",
      why: "Glossary: khoá toàn interpreter \"simplifies the CPython implementation\" và \"makes it easier for the interpreter to be multi-threaded, at the expense of much of the parallelism\" (https://docs.python.org/3/glossary.html). PEP 703 phải thay chính phần này bằng biased reference counting và immortal object mới bỏ được GIL (https://peps.python.org/pep-0703/).",
    },
    {
      t: "**GIL được chuyển giữa các thread thế nào** — thread đang giữ GIL được yêu cầu nhả sau mỗi **switch interval** (`sys.getswitchinterval()` → `0.005` giây trên 3.14.6), hoặc tự nhả khi vào I/O. Thread nào chạy tiếp là do **hệ điều hành** quyết định; interpreter không có scheduler riêng.",
      why: "Docs `sys.setswitchinterval`: giá trị là \"ideal duration of the 'timeslices'\", thực tế có thể dài hơn khi đang ở trong hàm C chạy lâu, và \"The interpreter doesn't have its own scheduler\" (https://docs.python.org/3/library/sys.html). Docs không ghi giá trị mặc định; `0.005` là số đo trên máy. Hệ quả: một hàm C chạy lâu mà không nhả GIL làm mọi thread khác đứng.",
    },
    {
      t: "**Free-threading theo phiên bản** — 3.13: bản build `--disable-gil` thử nghiệm, installer chính thức cho macOS và Windows có tuỳ chọn cài thêm. 3.14: được hỗ trợ chính thức (PEP 779, phase II), interpreter đã hoàn thiện phần PEP 703 và bật lại specializing interpreter. Chưa có phiên bản nào dùng free-threaded làm mặc định; quyết định đó để cho một PEP sau (phase III).",
      why: "Free-threading HOWTO: có từ 3.13, installer macOS/Windows \"optionally support installing free-threaded Python binaries\" (https://docs.python.org/3/howto/free-threading-python.html). What's New 3.14: PEP 703 \"has been finished\" và PEP 659 \"is now enabled in free-threaded mode\" (https://docs.python.org/3/whatsnew/3.14.html). PEP 779 không đặt điều kiện cứng cho phase III (https://peps.python.org/pep-0779/).",
    },
    {
      t: "**Cái giá, theo từng nguồn** — PEP 779 đặt ngưỡng cho phase II: code đơn thread chậm không quá 15%, bộ nhớ tăng không quá 20%; lúc viết PEP đo được khoảng 10% và 15–20%. What's New 3.14: chậm khoảng 5–10% tuỳ nền tảng. Free-threading HOWTO (docs 3.15): trung bình từ khoảng 1% (macOS aarch64) tới 8% (Linux x86-64) trên pyperformance.",
      why: "Ba con số khác nhau vì đo ở ba thời điểm (https://peps.python.org/pep-0779/, https://docs.python.org/3/whatsnew/3.14.html, https://docs.python.org/3/howto/free-threading-python.html). Khi trả lời phỏng vấn, nói \"vài phần trăm và tăng bộ nhớ\" kèm phiên bản, đừng đọc một con số như hằng số.",
    },
    {
      t: "**Kiểm tra đang chạy bản nào** — `sysconfig.get_config_var(\"Py_GIL_DISABLED\")` → `1` nếu build hỗ trợ free-threading; `sys._is_gil_enabled()` (3.13+) cho biết GIL **lúc này** có bật không; `python -VV` có chữ \"free-threading build\". Trên bản free-threaded, ép bật/tắt GIL bằng biến môi trường `PYTHON_GIL` hoặc `-X gil`.",
      why: "HOWTO khuyên dùng `Py_GIL_DISABLED` cho quyết định theo build, và `_is_gil_enabled()` cho trạng thái thật trong process, vì hai cái có thể khác nhau khi một extension làm GIL bật lại (https://docs.python.org/3/howto/free-threading-python.html). Trên máy chạy thử (bản mặc định): `0` và `True`.",
    },
    {
      t: "**Free-threaded không làm code tự an toàn** — dùng chung một iterator giữa nhiều thread có thể bỏ sót hoặc lặp phần tử; đọc `frame.f_locals` của frame đang chạy ở thread khác có thể làm crash. Code từng \"chạy đúng nhờ GIL\" (ví dụ dựa vào việc một lệnh bytecode không bị chen) cần lock tường minh trước khi chuyển sang free-threaded.",
      why: "Cả hai giới hạn là nguyên văn mục \"Known limitations\" của HOWTO (https://docs.python.org/3/howto/free-threading-python.html). Mô hình GIL làm nhiều race bị che đi: thread chỉ đổi giữa các lệnh bytecode, nên lỗi hiếm xảy ra; bỏ GIL thì khoảng chen ngang nhiều hơn hẳn.",
    },
    {
      t: "**Lựa chọn khác để dùng nhiều core** — nhiều process (`multiprocessing`, `ProcessPoolExecutor`, bài kế tiếp); nhiều **subinterpreter** trong một process, mỗi cái một GIL riêng (PEP 684, 3.12), dùng được từ Python qua `concurrent.interpreters` và `InterpreterPoolExecutor` (3.14, PEP 734); hoặc đẩy phần tính toán xuống thư viện C nhả GIL (NumPy).",
      why: "PEP 684 cho mỗi interpreter một GIL riêng (https://peps.python.org/pep-0684/). What's New 3.14 giới thiệu `concurrent.interpreters` cho \"true multi-core parallelism\", nhưng nêu giới hạn: khởi động chưa tối ưu, tốn bộ nhớ, ít cách chia sẻ dữ liệu, nhiều extension trên PyPI chưa tương thích (https://docs.python.org/3/whatsnew/3.14.html).",
    },
  ],
  sections: [
    {
      title: "Đo GIL: CPU-bound với thread, process; I/O-bound với thread",
      code: {
        lang: "python",
        lines: [
          "import sys",
          "import sysconfig",
          "import time",
          "from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor",
          "",
          ["def cpu(n):", "Vòng lặp Python thuần: mỗi lần lặp là vài lệnh bytecode, phải giữ GIL."],
          "    while n:",
          "        n -= 1",
          "",
          ["def io(_):", "`time.sleep` nhả GIL trong lúc chờ, giống chờ socket."],
          "    time.sleep(0.5)",
          "",
          "def bench(label, pool_cls, fn, arg):",
          "    t0 = time.perf_counter()",
          "    with pool_cls(max_workers=4) as pool:",
          "        list(pool.map(fn, [arg] * 4))",
          "    print(f\"{label}: {time.perf_counter() - t0:.2f}s\")",
          "",
          ["if __name__ == \"__main__\":", "Bắt buộc khi dùng process với start method `spawn`/`forkserver` (bài threading, multiprocessing, futures)."],
          "    print(\"free-threaded build:\", sysconfig.get_config_var(\"Py_GIL_DISABLED\") == 1)",
          "    print(\"GIL enabled now:\", sys._is_gil_enabled())",
          "    t0 = time.perf_counter()",
          "    for _ in range(4):",
          "        cpu(10_000_000)",
          "    print(f\"cpu sequential: {time.perf_counter() - t0:.2f}s\")",
          ["    bench(\"cpu 4 threads\", ThreadPoolExecutor, cpu, 10_000_000)", "Bản mặc định: xấp xỉ tuần tự. Lần chạy thử: 0,71 s tuần tự, 0,69 s với 4 thread. Số tuyệt đối tuỳ máy."],
          ["    bench(\"cpu 4 processes\", ProcessPoolExecutor, cpu, 10_000_000)", "Nhanh hơn (0,41 s), dù phải trả chi phí khởi động process và pickle tham số."],
          ["    bench(\"io 4 threads\", ThreadPoolExecutor, io, None)", "Khoảng 0,5 s cho 4 việc 0,5 s: các thread chờ cùng lúc."],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"Python có multithreading thật không?\": có thread của hệ điều hành thật, nhưng trên bản mặc định chỉ một thread chạy bytecode tại một thời điểm. Rồi chia hai nhánh: I/O-bound → thread hoặc asyncio; CPU-bound → process, thư viện C nhả GIL, hoặc bản free-threaded (3.13+, chính thức từ 3.14 nhưng chưa mặc định).",
      why: "Câu trả lời \"Python không có thread thật\" là sai và hay gặp. Nêu đúng phiên bản của free-threading cho thấy bạn theo dõi thay đổi gần đây của CPython chứ không nhắc lại thông tin cũ.",
    },
    {
      t: "Khi được hỏi \"bỏ GIL rồi thì hết lo race condition?\", trả lời ngược lại: GIL chưa bao giờ bảo vệ logic của bạn; bỏ GIL làm race lộ ra nhiều hơn.",
      why: "Đây là chỗ interviewer phân biệt người hiểu GIL bảo vệ interpreter (refcount, cấu trúc dict) với người tưởng GIL bảo vệ dữ liệu của ứng dụng.",
    },
  ],
  cards: [
    ["GIL là gì?", "Khoá của CPython chỉ cho một thread chạy bytecode Python tại một thời điểm; luôn được nhả khi làm I/O."],
    ["Vì sao CPython cần GIL?", "Refcount sửa trên mọi phép gán; một khoá chung giữ refcount và cấu trúc built-in an toàn mà không phải khoá từng object."],
    ["Thread có giúp code Python thuần CPU-bound không?", "Không trên bản mặc định: các thread lần lượt giữ GIL. Dùng process, thư viện C nhả GIL, hoặc bản free-threaded."],
    ["Free-threaded Python có từ bản nào, đã mặc định chưa?", "Thử nghiệm từ 3.13, hỗ trợ chính thức từ 3.14 (PEP 779), vẫn là bản build tuỳ chọn, chưa mặc định."],
    ["Kiểm tra GIL đang bật thế nào?", "`sys._is_gil_enabled()`; build có hỗ trợ free-threading thì `sysconfig.get_config_var(\"Py_GIL_DISABLED\") == 1`."],
    ["Vì sao bản free-threaded vẫn có thể chạy với GIL?", "Import một extension C chưa khai báo hỗ trợ free-threading làm GIL tự bật lại (có cảnh báo), hoặc ép bằng `PYTHON_GIL=1` / `-X gil=1`."],
    ["Subinterpreter khác thread ở đâu?", "Mỗi interpreter có GIL riêng (PEP 684) và object riêng, nên chạy song song được; đổi lại phải chia sẻ dữ liệu qua kênh/serialize như process."],
  ],
  related: ["ctx-switch"],
});
