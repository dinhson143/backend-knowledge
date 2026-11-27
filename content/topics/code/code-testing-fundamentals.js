BK.topic({
  id: "code-testing-fundamentals",
  track: "code",
  section: "code-testing",
  title: "Kiểm thử căn bản",
  goal: "Chọn unit, integration, e2e và mock, stub, fake đúng chỗ",
  tldr: {
    t: "Viết **nhiều unit test nhỏ, nhanh**, ít integration test hơn, rất ít **end-to-end (e2e) test** — đó là **test pyramid**. Test kiểm tra **hành vi quan sát được** (đầu vào → đầu ra, state sau khi gọi), không kiểm tra code được viết thế nào. Khi phụ thuộc chậm hoặc không kiểm soát được (DB, API ngoài, đồng hồ), thay bằng **test double**; thứ tự ưu tiên: dùng đồ thật nếu nhanh → **fake** → **stub** → **mock** kiểm tra lời gọi.",
    why: "Test càng rộng càng chậm, càng dễ flaky và càng khó chỉ ra chỗ hỏng; nên số lượng giảm dần khi đi lên (Mike Cohn, tóm tắt ở https://martinfowler.com/articles/practical-test-pyramid.html). Google ước khoảng 80% unit, 15% integration, 5% e2e tính theo số test case (Software Engineering at Google, ch.11 — https://abseil.io/resources/swe-book/html/ch11.html). Test gắn với cài đặt sẽ vỡ mỗi lần refactor dù hành vi không đổi, và người ta sẽ thôi tin vào test.",
  },
  story: {
    problem: "Một team chỉ có test e2e chạy qua trình duyệt: mỗi lần chạy 40 phút, cứ vài lần lại đỏ vì timeout mạng. Dev quen bấm chạy lại tới khi xanh; một bug thật trong hàm tính thuế lọt qua vì test đỏ đã bị coi là \"chắc lại flaky\".",
    idea: "Đẩy phần lớn logic xuống unit test chạy trong một process, không I/O, chạy cả bộ trong vài giây. Integration test kiểm tra chỗ nối thật (SQL thật với DB thật, serialize JSON thật). E2e chỉ giữ vài luồng sống còn (đăng nhập, thanh toán).",
    tradeoff: "Unit test với nhiều test double có thể xanh trong khi hệ thống thật hỏng, vì double không giống đồ thật. Càng nhiều mock, độ tin càng giảm. Phải có đủ integration test ở các chỗ nối để bù lại.",
  },
  table: {
    head: ["Loại test", "Kiểm tra gì", "Tốc độ / độ ổn định", "Ví dụ"],
    rows: [
      {
        cells: ["Unit", "Một hàm/class, phụ thuộc ngoài được thay bằng double", "Mili giây; ổn định nếu không I/O, không giờ thật", "`calculate_tax(order)` với nhiều loại đơn"],
        why: "Google định nghĩa small test chạy trong một process, không sleep, không I/O, không blocking call; vì vậy nhanh và gần như không flaky (SWE at Google ch.11). Phần lớn test nên ở đây vì lỗi chỉ thẳng vào một hàm.",
      },
      {
        cells: ["Integration", "Code của bạn + một thành phần thật: DB, queue, HTTP client", "Giây; phụ thuộc môi trường (container, port)", "Repository chạy SQL thật trên PostgreSQL trong container"],
        why: "Bắt lỗi mà unit test với double không thấy: SQL sai cú pháp, mapping cột sai, migration thiếu. Google tách size (tài nguyên: một process, một máy, nhiều máy) khỏi scope (bao nhiêu code được kiểm): test scope rộng vẫn có thể nhỏ nếu dùng double cho phụ thuộc ngoài process.",
      },
      {
        cells: ["End-to-end", "Cả hệ thống từ góc người dùng", "Phút; dễ flaky nhất", "Đăng nhập → thêm giỏ → thanh toán"],
        why: "Duy nhất loại này chứng minh các phần ghép lại chạy được, nhưng hỏng thì không chỉ ra chỗ nào. Google ghi tỉ lệ flake của họ khoảng 0,15% và test bắt đầu mất giá trị khi gần 1% (ch.11).",
      },
    ],
  },
  table2Title: "Test double: năm loại",
  table2: {
    head: ["Loại", "Là gì", "Dùng khi"],
    rows: [
      { cells: ["Dummy", "Được truyền vào nhưng không bao giờ được dùng", "Chỉ để lấp tham số bắt buộc"], why: "Định nghĩa của Gerard Meszaros, Fowler tóm tắt (https://martinfowler.com/bliki/TestDouble.html)." },
      { cells: ["Fake", "Cài đặt chạy được nhưng đi đường tắt, không dùng được ở production", "`InMemoryUserRepository` dùng `dict` thay DB"], why: "Fake hành xử giống đồ thật nên test đọc tự nhiên và không vỡ khi đổi cách gọi. Google ưu tiên fake hơn các loại double khác, và khuyên team sở hữu đồ thật viết và giữ fake, có test chạy trên cả hai (SWE at Google ch.13 — https://abseil.io/resources/swe-book/html/ch13.html)." },
      { cells: ["Stub", "Trả câu trả lời đóng sẵn cho lời gọi trong test", "Đẩy code vào một nhánh: API trả 503, giờ là 23:59"], why: "Stub chỉ trả lời những gì được lập trình sẵn. Lạm dụng stub làm test khó đọc và giòn (ch.13)." },
      { cells: ["Spy", "Stub có ghi lại đã được gọi thế nào", "Đếm số email đã gửi"], why: "Ghi lại lời gọi để assert sau, không đặt kỳ vọng trước." },
      { cells: ["Mock", "Được lập trình sẵn kỳ vọng về các lời gọi sẽ nhận", "Chỉ khi chính lời gọi là hành vi: phải gọi `charge()` đúng một lần"], why: "Kiểm tra lời gọi (interaction testing) buộc test vào cài đặt; Google xếp nó cuối cùng và khuyên kiểm state thay vì interaction khi có thể (ch.13)." },
    ],
  },
  points: [
    {
      t: "**Test hành vi, không test cài đặt** — assert trên giá trị trả về và state sau khi gọi; không test private method; không assert \"hàm A gọi hàm B với tham số X\" trừ khi đó là yêu cầu.",
      why: "Bài test pyramid của Fowler: \"Test for observable behaviour instead\"; private method là chi tiết cài đặt nên không cần test trực tiếp. Test như vậy sống sót qua refactor, nên còn làm đúng việc của nó: báo khi hành vi đổi.",
    },
    {
      t: "**Một test: chuẩn bị, chạy, kiểm** (Arrange–Act–Assert, hay Given–When–Then). Tên test nói kịch bản và kết quả: `test_expired_coupon_is_rejected`.",
      why: "Khi test đỏ, tên test là thứ đầu tiên người ta đọc; tên nói được kịch bản thì biết ngay hành vi nào hỏng mà chưa cần mở code. Một hành vi mỗi test giúp lỗi chỉ về đúng một chỗ.",
    },
    {
      t: "**Test phải tất định (deterministic)** — không phụ thuộc giờ hệ thống, thứ tự chạy, random không seed, mạng. Truyền đồng hồ vào (`now: Callable[[], datetime]`) thay vì gọi `datetime.now()` bên trong.",
      why: "Test lúc xanh lúc đỏ dạy mọi người bỏ qua màu đỏ, và bug thật lọt qua như trong câu chuyện ở trên. Small test của Google bị cấm sleep và I/O chính để loại các nguồn ngẫu nhiên này.",
    },
    {
      t: "**Mock có `spec`** — trong Python, `Mock()` trơn chấp nhận mọi thuộc tính và mọi chữ ký; dùng `create_autospec(...)` hoặc `patch(..., autospec=True)` để gọi sai tên hàm hay sai số tham số là test đỏ.",
      why: "Mock tự tạo thuộc tính mới khi được truy cập, nên gõ sai tên method hay method đã bị xoá vẫn qua test. Với autospec, gọi sai chữ ký ném `TypeError` giống đồ thật (https://docs.python.org/3/library/unittest.mock.html). Chi tiết `patch` (patch ở chỗ được tra cứu, không phải chỗ định nghĩa) và pytest fixture thuộc bài `py-pytest` của nhánh Python.",
    },
    {
      t: "**Coverage là sàn, không phải đích** — 90% dòng được chạy không có nghĩa 90% hành vi được kiểm. Dùng coverage để tìm đoạn chưa test, không dùng làm KPI.",
      why: "Coverage chỉ đo một dòng đã được chạy, không đo kết quả có được kiểm hay không; đặt một con số làm mục tiêu thì team dừng ở con số đó (SWE at Google ch.11). Một test không có `assert` vẫn tăng coverage.",
    },
    {
      t: "**Viết test cho bug trước khi sửa** — tái hiện bug bằng một test đỏ, sửa cho xanh, giữ test lại.",
      why: "Test đỏ chứng minh bạn đã hiểu đúng nguyên nhân (không phải sửa trúng may); test giữ lại chặn bug quay lại. Google gọi nguyên tắc rộng hơn là \"Beyoncé Rule\": thứ gì không muốn bị hỏng thì phải có test (ch.11).",
    },
  ],
  sections: [
    {
      title: "Ví dụ Python: fake thay vì mock",
      table: {
        head: ["Code", "Ý nghĩa"],
        rows: [
          ["`class InMemoryUsers:` có `save(user)` và `get(email)` dùng `dict`", "Fake: cùng interface với repository thật, chạy trong bộ nhớ."],
          ["`service = SignupService(users=InMemoryUsers(), now=lambda: FIXED_TIME)`", "Phụ thuộc được truyền vào (dependency injection), kể cả đồng hồ."],
          ["`service.signup(\"a@x.io\")`", "Act: gọi hành vi cần kiểm."],
          ["`assert users.get(\"a@x.io\").created_at == FIXED_TIME`", "Assert trên state, không assert \"đã gọi `save` một lần\"."],
          ["`with pytest.raises(EmailAlreadyUsedError): service.signup(\"a@x.io\")`", "Đường lỗi cũng là hành vi; `pytest.raises` kiểm loại exception (https://docs.pytest.org/en/stable/how-to/assert.html)."],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Vòng coding: viết xong thì tự liệt kê test case — trường hợp thường, biên (rỗng, một phần tử, trùng, âm, rất lớn), và trường hợp lỗi — rồi trace một hai cái bằng tay.",
      why: "Interviewer chấm việc tự kiểm; liệt kê biên trước khi họ hỏi cho thấy bạn nghĩ như người viết code production.",
    },
    {
      t: "Vòng machine coding / LLD: chừa 10 phút viết vài unit test cho logic lõi; thiết kế class nhận phụ thuộc qua constructor để test được.",
      why: "Code có test chạy được là tín hiệu mạnh hơn mọi lời giải thích; class tự `new` DB bên trong thì không thay bằng fake được.",
    },
    {
      t: "Câu hỏi \"mock hay fake?\": fake cho phụ thuộc có state (repository, cache), stub cho phản hồi đóng sẵn (API trả lỗi), mock chỉ khi lời gọi chính là hành vi (gửi email đúng một lần).",
      why: "Trả lời theo thứ tự ưu tiên có lý do (độ giống đồ thật, độ giòn khi refactor) tốt hơn trả lời \"luôn mock mọi thứ\".",
    },
  ],
  cards: [
    ["Test pyramid nói gì?", "Viết test ở nhiều mức chi tiết; càng lên cao (rộng, chậm) càng ít test. Google ước 80/15/5 cho unit/integration/e2e."],
    ["Stub khác mock ở đâu?", "Stub trả câu trả lời đóng sẵn để đẩy code vào một nhánh; mock mang kỳ vọng về lời gọi và test fail nếu lời gọi không khớp."],
    ["Vì sao ưu tiên fake hơn mock?", "Fake hành xử như đồ thật nên test kiểm state, không vỡ khi đổi cách gọi bên trong; mock buộc test vào cài đặt."],
    ["Coverage 100% có nghĩa là không có bug?", "Không. Coverage chỉ đo dòng đã chạy, không đo kết quả có được assert hay không."],
    ["Làm sao test hàm dùng `datetime.now()`?", "Truyền đồng hồ vào như một phụ thuộc (tham số hoặc constructor), trong test truyền hàm trả giờ cố định."],
  ],
});
