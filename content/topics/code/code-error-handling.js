BK.topic({
  id: "code-error-handling",
  track: "code",
  section: "code-clean",
  title: "Error Handling",
  goal: "Chọn exception hay error value, không nuốt lỗi và thêm ngữ cảnh",
  tldr: {
    t: "**Error handling** (xử lý lỗi) có ba luật: (1) **không nuốt lỗi** — bắt được thì phải xử lý thật, ghi lại, hoặc ném tiếp; (2) **bắt hẹp** — bắt đúng loại lỗi bạn biết cách xử lý, ở đúng tầng biết cách xử lý; (3) **thêm ngữ cảnh khi đẩy lỗi lên** — `raise OrderNotFoundError(...) from e` trong Python, `fmt.Errorf(\"load order %d: %w\", id, err)` trong Go — để người đọc log biết lỗi xảy ra khi đang làm gì mà vẫn giữ lỗi gốc.",
    why: "Lỗi bị nuốt biến một sự cố dễ thấy thành dữ liệu sai âm thầm, và tìm ra nó tốn gấp nhiều lần. Python tutorial khuyên bắt cụ thể nhất có thể và để lỗi không lường trước đi tiếp lên trên (https://docs.python.org/3/tutorial/errors.html); Effective Go gọi việc bỏ qua giá trị error là \"terrible practice\" (https://go.dev/doc/effective_go#errors).",
  },
  story: {
    problem: "Hàm đồng bộ đơn hàng có `try: ... except Exception: pass`. Một ngày API đối tác đổi format, mọi lệnh gọi đều lỗi nhưng job vẫn báo xong; ba tuần sau kế toán mới phát hiện đơn bị thiếu. Log không có gì vì lỗi đã bị nuốt.",
    idea: "Phân loại lỗi: lỗi người dùng/đầu vào (trả 400 kèm thông báo), lỗi tạm thời (retry có giới hạn), lỗi lập trình (để nó nổ, sửa code). Mỗi loại có một chỗ xử lý; các tầng giữa chỉ thêm ngữ cảnh rồi đẩy lên. Ở biên (HTTP handler, worker loop) có đúng một chỗ bắt rộng để log đủ stack và trả lỗi chung.",
    tradeoff: "Exception giữ code đường chính gọn nhưng giấu luồng điều khiển: nhìn chữ ký hàm không biết nó ném gì. Error value (Go `error`, Rust `Result`) buộc xử lý ở từng lời gọi nên rõ ràng hơn nhưng dài dòng hơn. Không có cách nào miễn phí; chọn theo ngôn ngữ và nhất quán trong một codebase.",
  },
  table: {
    head: ["Cách báo lỗi", "Ngôn ngữ", "Ưu", "Nhược"],
    rows: [
      {
        cells: ["Exception", "Python, Java, C#, JavaScript", "Đường chính gọn; lỗi tự lan lên tầng biết xử lý; có stack trace", "Chữ ký hàm không nói ném gì; dễ bắt quá rộng hoặc quên bắt"],
        why: "Python dùng exception cho cả lỗi thường (`KeyError`, `ValueError`) và phong cách EAFP: thử làm rồi bắt exception, thay vì kiểm tra trước (https://docs.python.org/3/glossary.html#term-EAFP).",
      },
      {
        cells: ["Error value", "Go (`error`), Rust (`Result<T, E>`)", "Lỗi là một phần chữ ký hàm; không xử lý là thấy ngay khi review", "Lặp `if err != nil` nhiều; dễ trả lỗi mất ngữ cảnh nếu không wrap"],
        why: "Go trả `error` như giá trị trả về thêm (Effective Go). Rust không có exception: dùng `Result<T, E>` cho lỗi khôi phục được và `panic!` cho lỗi không khôi phục được (https://doc.rust-lang.org/book/ch09-00-error-handling.html).",
      },
      {
        cells: ["Crash / panic", "Mọi ngôn ngữ (`panic`, `assert`, lỗi không bắt)", "Dừng ngay khi state đã sai, không ghi tiếp dữ liệu hỏng", "Mất request đang chạy; cần supervisor/restart"],
        why: "Rust coi lỗi không khôi phục được là \"symptoms of bugs\" (ví dụ truy cập ngoài mảng). Effective Go khuyên thư viện tránh `panic`, trừ trường hợp không thể khởi tạo.",
      },
      {
        cells: ["Mã lỗi / giá trị đặc biệt", "C (`-1`, `errno`), API cũ trả `None`", "Không tốn chi phí, đơn giản", "Dễ quên kiểm tra; `None` lan đi xa rồi nổ ở chỗ không liên quan"],
        why: "Trả `None` khi lỗi khiến lỗi thật hiện ra muộn dưới dạng `AttributeError: 'NoneType'...` ở một hàm khác, xa nguyên nhân. Ném exception có tên (hoặc trả error) giữ lỗi ở gần nguồn.",
      },
    ],
  },
  points: [
    {
      t: "**Không nuốt lỗi** — `except Exception: pass` và `_ = err` chỉ được phép khi bạn chứng minh được lỗi đó vô hại và ghi comment vì sao. Còn lại: xử lý, hoặc log rồi ném tiếp (`raise`).",
      why: "Python tutorial nêu mẫu hay gặp nhất khi bắt `Exception`: in hoặc log lỗi rồi `raise` lại để tầng trên vẫn xử lý được. Google Python Style Guide cấm `except:` bắt tất cả, trừ khi ném lại hoặc là điểm cô lập (isolation point) nơi lỗi được ghi lại và chặn lan (https://google.github.io/styleguide/pyguide.html).",
    },
    {
      t: "**Bắt hẹp, `try` ngắn** — bắt `KeyError`, `TimeoutError`, không bắt `Exception` ở giữa code nghiệp vụ; trong `try` chỉ để đúng dòng có thể ném lỗi đó; code chạy khi không lỗi đặt trong `else`.",
      why: "PEP 8: giữ khối `try` ở mức tối thiểu để không che bug ở code không liên quan (https://peps.python.org/pep-0008/#programming-recommendations). Tutorial giải thích `else` tốt hơn nhét thêm code vào `try` vì tránh vô tình bắt exception không phải do đoạn code được bảo vệ ném ra.",
    },
    {
      t: "**Không dùng `except:` trần** — nó bắt cả `KeyboardInterrupt` và `SystemExit`, nên Ctrl-C không dừng được chương trình. Cần bắt rộng thì `except Exception:`.",
      why: "`SystemExit`, `KeyboardInterrupt` kế thừa `BaseException` chứ không phải `Exception`, chính là để code bắt `Exception` không chặn nhầm việc thoát (https://docs.python.org/3/library/exceptions.html). PEP 8 cũng nêu `except:` trần bắt cả hai lỗi này.",
    },
    {
      t: "**Thêm ngữ cảnh, giữ lỗi gốc** — Python: `raise OrderNotFoundError(f\"order {order_id}\") from e`; Go: `fmt.Errorf(\"load order %d: %w\", id, err)`. Thông điệp nói đang làm gì với dữ liệu nào.",
      why: "`raise ... from e` gán lỗi gốc vào `__cause__` và traceback in cả hai; khi ném lỗi mới trong `except` mà không có `from`, lỗi cũ vẫn được gắn vào `__context__`; `from None` ẩn nó khi hiển thị (https://docs.python.org/3/library/exceptions.html). Trong Go, `%w` tạo lỗi có `Unwrap` nên `errors.Is`/`errors.As` vẫn tìm được lỗi gốc (https://go.dev/blog/go1.13-errors).",
    },
    {
      t: "**Dịch lỗi ở ranh giới tầng** — repository bắt `psycopg.errors.UniqueViolation` và ném `EmailAlreadyUsedError`; service không cần biết bên dưới là PostgreSQL. HTTP handler đổi `EmailAlreadyUsedError` thành 409.",
      why: "Blog Go 1.13 nói rõ: wrap một lỗi là biến nó thành một phần API của bạn; nếu không muốn lộ chi tiết cài đặt (ví dụ `sql.ErrNoRows`) thì đừng wrap bằng `%w`, để sau này đổi database không phá caller. Python cũng vậy: lớp trên bắt lỗi của driver là bị buộc chặt vào driver.",
    },
    {
      t: "**Cây exception riêng cho miền nghiệp vụ** — một lớp gốc `AppError(Exception)`, dưới đó `NotFoundError`, `ValidationError`, `ConflictError`. Handler ở biên map từng nhánh sang HTTP status; dùng exception có sẵn (`ValueError`, `TypeError`) khi nghĩa trùng khớp.",
      why: "Google style: dùng exception có sẵn khi hợp lý (ví dụ `ValueError` cho tiền điều kiện bị vi phạm); exception tự định nghĩa kết thúc bằng `Error`. Tài liệu Python khuyên exception của người dùng kế thừa `Exception`, không kế thừa `BaseException`. Một lớp gốc cho phép biên bắt \"mọi lỗi nghiệp vụ\" mà không bắt nhầm bug lập trình.",
    },
    {
      t: "**`assert` không phải validate** — kiểm tra đầu vào của người dùng bằng `if ...: raise ValueError(...)`; `assert` chỉ để ghi lại điều \"không thể xảy ra nếu code đúng\".",
      why: "Chạy Python với `-O` thì `__debug__` là `False` và trình biên dịch không sinh code cho `assert` (https://docs.python.org/3/reference/simple_stmts.html#the-assert-statement), nên validate bằng `assert` có thể biến mất ở production. Google style cũng cấm dùng `assert` thay cho kiểm tra tiền điều kiện.",
    },
    {
      t: "**Dọn tài nguyên bằng `with`/`finally`** — file, lock, connection đóng ở `finally` hoặc qua context manager, kể cả khi có lỗi. Không `return` trong `finally`.",
      why: "`finally` luôn chạy dù `try` có lỗi hay không. Nhưng `return`/`break` trong `finally` sẽ nuốt exception đang bay và ghi đè giá trị trả về; từ Python 3.14 trình biên dịch cảnh báo `SyntaxWarning` cho trường hợp này (PEP 765, tutorial — https://docs.python.org/3/tutorial/errors.html).",
    },
    {
      t: "**Log một lần, ở chỗ xử lý** — tầng giữa thêm ngữ cảnh và ném tiếp, không log; tầng xử lý cuối log kèm stack bằng `logger.exception(...)`. Log ở mọi tầng sinh ra cùng một lỗi lặp 5 lần trong log.",
      why: "`Logger.exception()` ghi ở mức ERROR kèm thông tin exception và chỉ nên gọi trong `except` (https://docs.python.org/3/library/logging.html). Log trùng lặp làm đếm lỗi sai và che mất lỗi khác; ngữ cảnh đã đi theo exception (chuỗi `__cause__`) nên không mất khi chỉ log ở cuối.",
    },
    {
      t: "**Chỉ retry lỗi tạm thời** — timeout, 503, mất kết nối thì retry có giới hạn và backoff; lỗi validate, 404, lỗi lập trình thì retry bao nhiêu cũng vẫn lỗi.",
      why: "Retry lỗi vĩnh viễn chỉ nhân tải lên hệ thống đang có vấn đề và làm chậm việc báo lỗi cho người dùng. Retry có backoff, jitter và giới hạn là chủ đề của `resilience`.",
    },
  ],
  sections: [
    {
      title: "Ví dụ Python: từ nuốt lỗi tới xử lý đúng",
      table: {
        head: ["Code", "Vấn đề / cải thiện"],
        rows: [
          ["`try: order = db[order_id]` … `except: return None`", "Bắt mọi thứ (cả Ctrl-C), lỗi thật biến thành `None` và nổ ở chỗ khác."],
          ["`except KeyError: return None`", "Hẹp hơn, nhưng caller phải nhớ kiểm tra `None`; quên là `AttributeError` ở xa."],
          ["`except KeyError as e: raise OrderNotFoundError(f\"order {order_id}\") from e`", "Lỗi có tên miền nghiệp vụ, kèm id, giữ lỗi gốc trong `__cause__`; handler map sang 404."],
          ["`except Exception: logger.exception(\"sync failed\"); raise`", "Điểm bắt rộng ở biên (worker loop): ghi stack đầy đủ một lần, rồi ném tiếp hoặc đánh dấu job lỗi."],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Vòng coding: nói ra cách xử lý input xấu (rỗng, âm, `None`) trước khi viết, rồi chọn một trong hai — ném `ValueError` hoặc trả giá trị quy ước — và hỏi interviewer muốn cách nào.",
      why: "Interviewer chấm việc bạn nghĩ tới đường lỗi. Hỏi trước tránh viết lại; chọn một cách nhất quán tốt hơn kiểm tra nửa vời ở vài chỗ.",
    },
    {
      t: "Câu hỏi \"exception hay error code?\": trả lời theo ngôn ngữ và loại lỗi — lỗi khôi phục được thì error value hoặc exception có tên; bug lập trình thì để crash; không trộn hai kiểu trong một module.",
      why: "Đây là câu trả lời có trade-off: interviewer muốn nghe bạn biết cái giá của mỗi cách, không muốn một khẩu hiệu.",
    },
    {
      t: "Lỗi trả cho client không chứa stack trace, câu SQL hay đường dẫn nội bộ; chi tiết đó vào log, client nhận mã lỗi và một id để tra.",
      why: "Stack trace lộ cấu trúc hệ thống cho người tấn công; id tương quan (request id) cho phép support tìm đúng dòng log mà không lộ gì.",
    },
  ],
  cards: [
    ["Vì sao `except:` trần nguy hiểm hơn `except Exception:`?", "Nó bắt cả `KeyboardInterrupt` và `SystemExit` (kế thừa `BaseException`), nên Ctrl-C và `sys.exit()` bị chặn."],
    ["`raise X from e` khác `raise X` trong `except` thế nào?", "`from e` đặt `__cause__` (nguyên nhân trực tiếp). Không có `from`, lỗi cũ vẫn vào `__context__` ngầm. `from None` ẩn lỗi cũ khi in traceback."],
    ["Khi nào không nên wrap lỗi bằng `%w` trong Go?", "Khi lỗi gốc là chi tiết cài đặt (ví dụ `sql.ErrNoRows`): wrap là đưa nó vào API, caller sẽ phụ thuộc vào nó."],
    ["Vì sao không validate bằng `assert`?", "`python -O` bỏ hẳn lệnh `assert`; kiểm tra biến mất ở production. Dùng `if` + `raise ValueError`."],
    ["Log lỗi ở tầng nào?", "Một lần, ở tầng xử lý cuối (biên), bằng `logger.exception` để có stack. Tầng giữa thêm ngữ cảnh rồi ném tiếp."],
  ],
});
