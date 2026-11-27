BK.topic({
  id: "code-clean-naming",
  track: "code",
  section: "code-clean",
  title: "Đặt tên & hàm nhỏ",
  goal: "Đặt tên rõ nghĩa và tách hàm theo một mức trừu tượng",
  tldr: {
    t: "**Clean code** (code dễ đọc, dễ đổi) bắt đầu từ hai thói quen: **tên nói ý định** (đọc tên là biết giá trị này dùng để làm gì, không phải nó có kiểu gì) và **hàm nhỏ làm một việc ở một mức trừu tượng** (hàm cấp cao chỉ gọi các bước có tên; chi tiết nằm trong các hàm con). Độ dài tên tỉ lệ với phạm vi: `i` ổn trong vòng lặp 3 dòng, biến dùng khắp module thì phải tả đủ.",
    why: "Code được đọc nhiều lần hơn được viết; tên và ranh giới hàm là thứ người đọc dùng để không phải đọc thân hàm. Google Python Style Guide ghi: tên phải mô tả, và \"descriptiveness should be proportional to the name's scope of visibility\"; hàm nên nhỏ và tập trung, quá khoảng 40 dòng thì cân nhắc tách (https://google.github.io/styleguide/pyguide.html).",
  },
  story: {
    problem: "Hàm `process(data, flag)` dài 120 dòng: đọc file, validate, tính tiền, gửi email, ghi log, với `d`, `tmp`, `res2` ở khắp nơi. Sửa phần tính tiền phải đọc cả hàm để chắc không đụng phần gửi email; reviewer không đoán được `flag=True` làm gì.",
    idea: "Đặt tên theo vai trò trong nghiệp vụ (`unpaid_invoices`, `retry_deadline`), rồi tách hàm sao cho hàm ngoài đọc như mục lục: `invoices = load_invoices(path)`, `valid = [i for i in invoices if is_payable(i)]`, `send_reminders(valid)`. Mỗi hàm con chỉ có một lý do để đổi.",
    tradeoff: "Tách quá tay sinh ra chuỗi hàm 2 dòng phải nhảy qua lại mới hiểu, và tên dài lê thê che mất logic. Tách khi đoạn code có một ý đặt tên được; nếu tên hàm con không rõ hơn chính đoạn code thì giữ inline.",
  },
  table: {
    head: ["Loại tên", "Quy ước Python (PEP 8)", "Ví dụ tốt / tránh"],
    rows: [
      {
        cells: ["Hàm, biến", "chữ thường, nối bằng `_` (snake_case)", "`retry_count`, `send_invoice()` / `retryCnt`, `doIt()`"],
        why: "PEP 8: \"Function names should be lowercase, with words separated by underscores\"; biến theo cùng quy ước (https://peps.python.org/pep-0008/#naming-conventions). Theo quy ước chung giúp người đọc nhận ra ngay đâu là hàm, đâu là class mà không cần nhìn định nghĩa.",
      },
      {
        cells: ["Class", "CapWords", "`InvoiceRepository` / `invoice_repo`"],
        why: "PEP 8 dùng CapWords cho class, nên `Invoice(...)` đọc là tạo object, `invoice(...)` đọc là gọi hàm.",
      },
      {
        cells: ["Hằng số cấp module", "CHỮ_HOA có `_`", "`MAX_RETRIES = 3` / số 3 rải rác trong code"],
        why: "Đặt tên cho \"magic number\" làm lộ ý nghĩa và gom chỗ sửa về một nơi; PEP 8 quy ước hằng số viết hoa toàn bộ.",
      },
      {
        cells: ["Exception", "kết thúc bằng `Error` nếu là lỗi", "`PaymentDeclinedError` / `PaymentProblem`"],
        why: "PEP 8 khuyên hậu tố \"Error\" cho exception là lỗi; Google style thêm: không lặp tên module (`foo.FooError`) (https://google.github.io/styleguide/pyguide.html).",
      },
      {
        cells: ["Boolean", "đọc như câu hỏi có/không", "`is_active`, `has_paid`, `can_retry` / `status`, `flag`"],
        why: "Đây là quy ước phổ biến, không phải luật của PEP 8. `if user.is_active:` đọc thành câu; `if user.status:` buộc người đọc tra xem `status` là bool hay chuỗi.",
      },
      {
        cells: ["Một ký tự", "chỉ cho phạm vi rất hẹp", "`i`, `j` trong vòng lặp; `e` trong `except` / không dùng `l`, `O`, `I`"],
        why: "PEP 8 cấm `l`, `O`, `I` làm tên một ký tự vì dễ nhầm với 1 và 0. Google style chỉ cho phép tên một ký tự ở các chỗ như bộ đếm vòng lặp và `e` cho exception.",
      },
    ],
  },
  points: [
    {
      t: "**Tên nói ý định, không nói kiểu** — `elapsed_seconds` thay vì `int_value`; `active_users` thay vì `user_list`. Nếu cần chú thích để giải thích một biến, đổi tên biến trước.",
      why: "Google style liệt kê \"names that needlessly include the type of the variable\" trong mục tên cần tránh. Kiểu đã có type hint và IDE lo; tên là chỗ duy nhất nói vì sao giá trị này tồn tại. Đổi `list` sang `set` mà tên vẫn là `user_list` thì tên thành sai.",
    },
    {
      t: "**Không viết tắt mơ hồ** — `customer_count` thay vì `cust_cnt`; viết tắt chỉ khi cả ngành đều hiểu (`url`, `id`, `http`).",
      why: "Google style: không dùng viết tắt mơ hồ hoặc lạ với người ngoài dự án, và không rút gọn bằng cách bỏ chữ giữa từ. Gõ thêm vài ký tự rẻ hơn nhiều so với mỗi người đọc phải đoán `cnt` hay `cust`.",
    },
    {
      t: "**Hàm là động từ, class là danh từ** — `calculate_total()`, `send_email()`; `Order`, `PriceCalculator`. Hàm trả bool đặt như câu hỏi: `is_expired()`.",
      why: "Lời gọi hàm đọc như câu lệnh (`send_email(user)`), object đọc như sự vật. Hàm tên danh từ (`total()`) không cho biết nó tính lại mỗi lần hay chỉ đọc một trường.",
    },
    {
      t: "**Một hàm, một mức trừu tượng** — hàm `checkout()` gọi `reserve_stock()`, `charge()`, `send_receipt()`; nó không vừa gọi `charge()` vừa tự nối chuỗi SQL ở dòng kế bên.",
      why: "Trộn mức cao và mức thấp bắt người đọc liên tục đổi \"độ zoom\". Khi mỗi dòng của hàm ngoài là một bước có tên, đọc hàm ngoài là hiểu luồng chính; muốn xem chi tiết thì mở đúng hàm con.",
    },
    {
      t: "**Extract Function** — thấy một đoạn có comment kiểu `# tính phí ship` thì tách đoạn đó thành `shipping_fee(order)`; comment trở thành tên hàm.",
      why: "Đây là refactoring Extract Function (còn gọi Extract Method) trong catalog của Martin Fowler, ngược với Inline Function (https://refactoring.com/catalog/extractFunction.html). Comment có thể lỗi thời mà không ai biết; tên hàm xuất hiện ở chỗ gọi nên sai là thấy ngay.",
    },
    {
      t: "**Tránh flag argument** — `book(customer, True)` đổi thành `book_premium(customer)` và `book_regular(customer)`; hoặc ít nhất bắt gọi bằng keyword: `def book(customer, *, premium=False)`.",
      why: "Martin Fowler gọi tham số bool chọn giữa hai hành vi là flag argument và thích tách thành hai hàm riêng, vì `book(martin, False)` buộc người đọc nhớ `False` nghĩa là gì (https://martinfowler.com/bliki/FlagArgument.html). Dấu `*` trong Python bắt các tham số sau nó phải truyền bằng tên (https://docs.python.org/3/tutorial/controlflow.html#special-parameters).",
    },
    {
      t: "**Tách hỏi và làm (command–query separation)** — hàm trả giá trị thì không đổi state; hàm đổi state thì không cần trả giá trị. `get_balance()` không được ngầm ghi log vào DB hay trừ tiền.",
      why: "Nguyên tắc của Bertrand Meyer, Fowler tóm tắt: query trả kết quả và không đổi state quan sát được; command đổi state và không trả giá trị (https://martinfowler.com/bliki/CommandQuerySeparation.html). Fowler vẫn chấp nhận ngoại lệ như `stack.pop()`. Hàm có tên query mà ngầm đổi state là nguồn bug khi ai đó gọi nó hai lần \"cho chắc\".",
    },
    {
      t: "**Ít tham số** — quá 3–4 tham số, nhất là khi luôn đi cùng nhau, thì gom thành một object (`dataclass`): `create_user(email, name, address_line, city, zip_code)` thành `create_user(email, name, address)`.",
      why: "Tham số đi theo nhóm là dấu hiệu có một khái niệm chưa được đặt tên. Gom lại thì chỗ gọi ngắn hơn, và thêm trường mới không phải sửa chữ ký của mọi hàm trung gian. `dataclass` tự sinh `__init__`, `__repr__`, `__eq__` (https://docs.python.org/3/library/dataclasses.html).",
    },
  ],
  sections: [
    {
      title: "Trước và sau khi tách",
      table: {
        head: ["Trước", "Sau", "Vì sao tốt hơn"],
        rows: [
          ["`def proc(d, f):` đọc file, lọc, tính, gửi", "`def send_payment_reminders(path):` gọi `load_invoices`, `is_overdue`, `send_reminder`", "Tên hàm ngoài nói kết quả nghiệp vụ; ba hàm con test riêng được."],
          ["`if u.s == 2 and (now - u.t).days > 30:`", "`if user.is_suspended() and user.inactive_for(days=30):`", "Ý định đọc được ngay; số `2` (mã trạng thái) và quy tắc 30 ngày nằm ở một chỗ."],
          ["`res = []` … `return res`", "`overdue = []` … `return overdue`", "`res` không nói gì; tên theo nội dung giúp phát hiện khi trả nhầm danh sách."],
          ["`def save(user, validate=True, notify=False):`", "`save(user)`; `save_and_notify(user)`; validate luôn chạy", "Bỏ flag argument; validate không còn là lựa chọn có thể quên."],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Trong vòng coding, đặt tên đúng ngay từ đầu (`left`, `right`, `window_count`) thay vì `a`, `b`, `c` rồi định sửa sau.",
      why: "Interviewer đọc code cùng lúc bạn viết; tên rõ giúp họ theo kịp và giúp chính bạn khi tự trace bằng ví dụ. Hầu như không ai có thời gian quay lại đổi tên trước khi hết giờ.",
    },
    {
      t: "Khi bí tên cho một hàm, thử nói to nó làm gì trong một câu. Câu có chữ \"và\" thì hàm đang làm hai việc.",
      why: "Không đặt được tên ngắn thường là dấu hiệu ranh giới hàm sai, không phải do thiếu từ vựng.",
    },
    {
      t: "Phỏng vấn hỏi \"code này có gì cần sửa?\": nói tên mơ hồ, hàm dài trộn mức, flag argument, magic number trước; sau đó mới tới hiệu năng.",
      why: "Đây là những lỗi đọc thấy được ngay và sửa an toàn; nêu đúng thứ tự cho thấy bạn ưu tiên khả năng đọc, thứ quyết định chi phí bảo trì.",
    },
  ],
  cards: [
    ["Vì sao `user_list` là tên kém?", "Nó nói kiểu chứ không nói ý định, và thành sai khi đổi sang `set`. Tên tốt nói tập này gồm ai: `active_users`, `invited_users`."],
    ["Một ký tự được dùng ở đâu?", "Phạm vi rất hẹp: bộ đếm vòng lặp `i`, `j`, `e` cho exception (Google style). Không dùng `l`, `O`, `I` (PEP 8) vì dễ nhầm với 1 và 0."],
    ["\"Một mức trừu tượng\" nghĩa là gì?", "Mọi dòng trong hàm ở cùng độ chi tiết: hàm `checkout` gọi các bước có tên, không trộn với thao tác chuỗi hay SQL thô."],
    ["Thay flag argument bằng gì?", "Hai hàm có tên riêng (`book_premium`, `book_regular`), hoặc tối thiểu là tham số keyword-only để chỗ gọi phải ghi rõ `premium=True`."],
    ["Khi nào không nên tách hàm?", "Khi tên hàm con không rõ hơn chính đoạn code, hoặc tách ra làm người đọc phải nhảy qua nhiều hàm 1–2 dòng mới hiểu luồng."],
  ],
});
