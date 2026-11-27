// Khối code theo D13. Phần unittest.mock đã chạy trên CPython 3.14.6; các khối dùng pytest chỉ được
// compile (`python -I -m py_compile`) vì máy viết bài không cài pytest (D211).
// Khái niệm test pyramid, test double: bài `code-testing-fundamentals`. Bài này chỉ dạy API pytest/mock.
BK.topic({
  id: "py-pytest",
  track: "py",
  section: "py-tooling",
  title: "Testing with pytest",
  goal: "Viết test pytest có fixture, parametrize và patch đúng chỗ bằng unittest.mock",
  needs: ["code-testing-fundamentals", "py-decorators"],
  tldr: {
    t: "**pytest** chạy mọi hàm `test_*` trong file `test_*.py`, kiểm bằng `assert` thường. **Fixture** (hàm `@pytest.fixture` chuẩn bị và dọn dẹp dữ liệu cho test) được tiêm vào test theo **tên tham số**; phần trước `yield` là setup, phần sau là teardown; `scope` quyết định fixture được tạo lại mỗi test hay dùng chung cả module/session. `@pytest.mark.parametrize` chạy một test với nhiều bộ dữ liệu. Thay phụ thuộc bằng `monkeypatch` hoặc `unittest.mock.patch`, và **patch tên ở chỗ nó được tra cứu** (module đang dùng nó), không phải chỗ nó được định nghĩa.",
    why: "pytest viết lại (rewrite) câu lệnh `assert` trước khi chạy để khi sai thì in được giá trị của từng vế, nên không cần `assertEqual`, `assertIn`… (https://docs.pytest.org/en/stable/how-to/assert.html). `patch` thay một **tên** trong một namespace; `from a import f` đã chép tên `f` vào module của bạn, nên patch `a.f` không đụng tới bản chép đó (https://docs.python.org/3/library/unittest.mock.html#where-to-patch).",
  },
  story: {
    problem: "Test của service thanh toán dùng `@patch(\"payments.gateway.charge\")` mà vẫn gọi thật sang sandbox của cổng thanh toán: `payments/service.py` viết `from payments.gateway import charge`. Test chậm, lúc xanh lúc đỏ theo mạng. Cùng lúc, một fixture `scope=\"session\"` trả về một `dict` cấu hình; một test sửa `dict` đó và mười test chạy sau nó đổi kết quả tuỳ thứ tự chạy.",
    idea: "Patch `payments.service.charge`, là tên mà code cần test thật sự gọi. Fixture có state thì để scope `function` (mặc định) để mỗi test nhận bản mới; chỉ nâng scope cho thứ đắt và không đổi (container DB, app đã build), và dọn state giữa các test.",
    tradeoff: "Scope rộng làm test nhanh hơn nhưng các test dính nhau qua state chung. Mock nhiều làm test nhanh và tất định nhưng có thể xanh khi hệ thật hỏng. Đặt phần lớn logic trong hàm thuần, chỉ mock ở rìa hệ thống (HTTP, đồng hồ, queue).",
  },
  table: {
    head: ["Scope", "Fixture bị huỷ khi", "Hợp cho"],
    rows: [
      { cells: ["`function` (mặc định)", "Test dùng nó kết thúc", "Object có state: repository giả, client, dữ liệu mẫu"], why: "Mỗi test nhận bản mới nên test không phụ thuộc thứ tự chạy. Đây là mặc định (https://docs.pytest.org/en/stable/how-to/fixtures.html)." },
      ["`class`", "Teardown của test cuối trong class", "Dữ liệu chỉ đọc dùng chung cho một nhóm test"],
      ["`module`", "Teardown của test cuối trong file", "Kết nối tới service chạy sẵn, dữ liệu nạp một lần cho cả file"],
      ["`package`", "Teardown của test cuối trong package định nghĩa fixture", "Tài nguyên cho một thư mục test"],
      { cells: ["`session`", "Hết lần chạy pytest", "Thứ rất đắt và không đổi: container PostgreSQL, app đã khởi tạo"], why: "pytest chỉ giữ một instance của fixture tại một thời điểm, theo scope (https://docs.pytest.org/en/stable/how-to/fixtures.html). Một object session-scoped bị test A sửa thì test B nhìn thấy bản đã sửa; kết quả phụ thuộc thứ tự chạy. Vì vậy fixture session nên trả thứ chỉ đọc, hoặc có fixture function-scoped dọn state (rollback transaction, xoá bảng) quanh từng test." },
    ],
  },
  sections: [
    {
      title: "Fixture: setup, teardown, fixture gọi fixture",
      code: {
        lang: "python",
        lines: [
          "# conftest.py: fixture ở đây dùng được cho mọi file test cùng thư mục và thư mục con",
          "import pytest",
          "",
          "@pytest.fixture(scope=\"session\")",
          ["def db_engine():", "Đắt (tạo engine, có thể khởi container) nên dùng chung cả lần chạy."],
          "    engine = create_engine(TEST_DB_URL)",
          ["    yield engine", "Giá trị `yield` là thứ test nhận. Code phía sau là teardown."],
          "    engine.dispose()",
          "",
          "@pytest.fixture",
          ["def db(db_engine):", "Fixture xin fixture khác bằng tên tham số, như test. Fixture scope hẹp dùng được fixture scope rộng, chiều ngược lại thì không."],
          "    conn = db_engine.connect()",
          "    tx = conn.begin()",
          "    yield conn",
          ["    tx.rollback()", "Mỗi test chạy trong một transaction rồi rollback, nên test sau thấy DB sạch dù engine dùng chung."],
          "    conn.close()",
          "",
          "def test_signup_saves_user(db):",
          "    UserRepo(db).save(User(email=\"a@x.io\"))",
          "    assert UserRepo(db).get(\"a@x.io\").email == \"a@x.io\"",
        ],
      },
      points: [
        {
          t: "**Teardown chạy ngược thứ tự setup.** Ở ví dụ trên: setup `db_engine` → `db`; teardown `db` (rollback) trước, `db_engine.dispose()` sau (khi hết session).",
          why: "pytest đi ngược danh sách fixture khi dọn dẹp: fixture setup sau cùng được teardown đầu tiên (https://docs.pytest.org/en/stable/how-to/fixtures.html). Thứ tự này đảm bảo connection đóng trước engine chứa nó.",
        },
        {
          t: "**Fixture lỗi trước `yield` thì phần teardown của chính nó không chạy**, nhưng các fixture đã setup xong trước nó vẫn được dọn.",
          why: "Theo docs, pytest không chạy code sau `yield` của fixture đã ném lỗi trước khi tới `yield`, còn các fixture đã chạy thành công vẫn được teardown bình thường (https://docs.pytest.org/en/stable/how-to/fixtures.html). Vì vậy mỗi fixture chỉ nên mở một resource: fixture mở hai resource mà lỗi ở cái thứ hai thì cái thứ nhất bị rò.",
        },
        {
          t: "**Trong một test, mỗi fixture chạy một lần.** Hai fixture cùng xin `db` thì cả hai nhận cùng một object.",
          why: "pytest không chạy lại fixture đã có trong cùng một test (https://docs.pytest.org/en/stable/how-to/fixtures.html); nếu chạy lại, fixture `user` và fixture `order` sẽ ghi vào hai transaction khác nhau và không thấy dữ liệu của nhau.",
        },
        {
          t: "**`autouse=True`** làm mọi test trong phạm vi tự xin fixture đó. Dùng cho việc phải có ở mọi test (reset cache, chặn gọi mạng), không dùng để giấu phụ thuộc.",
          why: "Test không ghi fixture autouse trong tham số, nên người đọc không thấy nó; dùng cho dữ liệu nghiệp vụ thì khó hiểu vì sao test đỏ (https://docs.pytest.org/en/stable/how-to/fixtures.html).",
        },
      ],
    },
    {
      title: "parametrize: một test, nhiều bộ dữ liệu",
      code: {
        lang: "python",
        lines: [
          "import pytest",
          "",
          "@pytest.mark.parametrize(",
          ["    \"total, expected_fee\",", "Tên tham số viết trong một chuỗi, cách nhau bởi dấu phẩy."],
          "    [",
          "        (0, 30_000),",
          ["        (499_999, 30_000),", "Biên ngay dưới ngưỡng."],
          "        (500_000, 0),",
          ["        pytest.param(-1, None, marks=pytest.mark.xfail(reason=\"chưa validate\")),", "`pytest.param` gắn mark cho riêng một bộ dữ liệu."],
          "    ],",
          ")",
          "def test_shipping_fee(total, expected_fee):",
          "    assert shipping_fee(total) == expected_fee",
        ],
      },
      points: [
        {
          t: "Mỗi bộ dữ liệu là **một test riêng** trong báo cáo, có id như `test_shipping_fee[499999-30000]`; một bộ đỏ không che các bộ khác.",
          why: "Viết vòng `for` trong một test thì `assert` đầu tiên sai sẽ dừng cả vòng và không biết các trường hợp sau đúng hay sai (https://docs.pytest.org/en/stable/how-to/parametrize.html).",
        },
        {
          t: "**Chồng hai `parametrize`** cho ra mọi tổ hợp: `x` ∈ {0, 1} và `y` ∈ {2, 3} thành 4 test.",
          why: "Theo docs, chồng decorator `parametrize` để lấy mọi tổ hợp tham số (https://docs.pytest.org/en/stable/how-to/parametrize.html). Số test tăng theo tích các chiều, nên chỉ chồng khi các chiều thật sự độc lập.",
        },
        {
          t: "**Giá trị parametrize không được copy.** Test sửa một `list`/`dict` lấy từ parametrize thì các test chạy sau thấy bản đã sửa.",
          why: "Docs ghi giá trị được truyền nguyên vẹn, không copy, nên thay đổi trên list hoặc dict lộ sang lần gọi sau (https://docs.pytest.org/en/stable/how-to/parametrize.html). Muốn dữ liệu mới mỗi lần thì tạo nó trong test hoặc trong fixture.",
        },
      ],
    },
    {
      title: "Patch đúng chỗ: tên được tra cứu ở đâu",
      code: {
        lang: "python",
        lines: [
          "# payments/gateway.py",
          "#     def charge(user_id, amount): ...   (gọi HTTP thật)",
          "# payments/service.py",
          ["#     from payments.gateway import charge", "Lệnh này tạo tên `charge` **mới** trong module `payments.service`, trỏ tới cùng hàm."],
          "#     def checkout(user_id, amount): return charge(user_id, amount)",
          "from unittest.mock import patch",
          "",
          ["@patch(\"payments.gateway.charge\")", "SAI: đổi tên trong `gateway`, nhưng `service` vẫn giữ tên cũ trỏ tới hàm thật."],
          "def test_checkout_wrong(mock_charge): ...",
          "",
          ["@patch(\"payments.service.charge\", autospec=True)", "ĐÚNG: đổi tên mà `checkout` thật sự tra cứu lúc chạy. `autospec` giữ chữ ký của hàm thật."],
          ["def test_checkout(mock_charge):", "Decorator `patch` truyền mock vào làm tham số."],
          "    mock_charge.return_value = {\"status\": \"ok\"}",
          "    assert checkout(7, 100)[\"status\"] == \"ok\"",
          "    mock_charge.assert_called_once_with(7, 100)",
        ],
      },
      points: [
        {
          t: "Nếu `service.py` viết `import payments.gateway` rồi gọi `payments.gateway.charge(...)`, thì patch `payments.gateway.charge` là **đúng**: tên được tra cứu trên module `gateway` mỗi lần gọi.",
          why: "Docs đưa đúng hai trường hợp này: `from a import SomeClass` thì patch `b.SomeClass`; `import a` rồi dùng `a.SomeClass` thì patch `a.SomeClass` (https://docs.python.org/3/library/unittest.mock.html#where-to-patch). Thử với hai module dựng tay: patch ở module định nghĩa → hàm vẫn trả giờ thật; patch ở module dùng → trả `0`.",
        },
        {
          t: "**`monkeypatch`** (fixture có sẵn) làm cùng việc cho attribute, `dict`, biến môi trường: `monkeypatch.setattr(service, \"charge\", fake_charge)`, `monkeypatch.setenv(\"PAYMENT_MODE\", \"test\")`. Mọi thay đổi tự hoàn tác khi test hoặc fixture xin nó kết thúc.",
          why: "Docs liệt kê `setattr`, `delattr`, `setitem`, `delitem`, `setenv`, `delenv`, `syspath_prepend`, `chdir`, `context()` và khuyên patch tham chiếu mà code của bạn dùng thay vì patch object gốc trong stdlib; patch builtin như `open` có thể làm hỏng chính pytest (https://docs.pytest.org/en/stable/how-to/monkeypatch.html).",
        },
      ],
    },
    {
      title: "unittest.mock: những gì hay dùng",
      code: {
        lang: "python",
        lines: [
          "from unittest.mock import AsyncMock, Mock, create_autospec",
          "",
          "def charge(user_id, amount): ...",
          "",
          "m = create_autospec(charge)",
          ["m(1)", "`TypeError: missing a required argument: 'amount'`: gọi sai chữ ký thì đỏ như hàm thật."],
          "",
          ["plain = Mock()", "Mock trơn tự tạo thuộc tính khi được truy cập."],
          ["plain.chrage(1)", "Gõ sai tên vẫn chạy, không lỗi gì: test xanh sai."],
          ["plain.asert_called()", "Riêng tên bắt đầu bằng `assert`/`asert`/`assret`… gõ sai thì ném `AttributeError` (từ 3.5)."],
          "",
          ["flaky = Mock(side_effect=[TimeoutError(\"t\"), 200])", "`side_effect` là iterable: mỗi lần gọi lấy phần tử kế; phần tử là exception thì ném."],
          "# flaky() lần 1 ném TimeoutError, lần 2 trả 200: test logic retry",
          "",
          ["fetch = AsyncMock(return_value={\"id\": 1})", "Gọi `fetch()` trả awaitable; `await fetch()` ra `{'id': 1}`."],
        ],
      },
      points: [
        {
          t: "**`autospec=True` / `create_autospec`**: mock có đúng attribute, method và chữ ký của object thật. Dùng mặc định khi patch hàm hoặc class của chính bạn.",
          why: "Docs: auto-speccing tạo mock có cùng attribute, method và chữ ký gọi với object bị thay (https://docs.python.org/3/library/unittest.mock.html). Không có spec thì đổi tên hay đổi tham số của hàm thật, test vẫn xanh vì mock nhận mọi thứ.",
        },
        {
          t: "**`assert_called_once_with`** kiểm đúng một lần với đúng tham số; `assert_called_with` chỉ kiểm **lần gọi cuối**; `assert_any_call` kiểm đã từng gọi.",
          why: "Ba hàm kiểm ba điều khác nhau (https://docs.python.org/3/library/unittest.mock.html). Dùng `assert_called_with` để kiểm \"chỉ gọi một lần\" là sai: gọi hai lần với tham số đúng ở lần cuối vẫn qua.",
        },
        {
          t: "**Hàm `async def`**: `patch` tự dùng `AsyncMock` khi đối tượng bị patch là hàm async (từ 3.8). Test `async def` thì pytest không tự chạy: cần plugin như pytest-asyncio (`@pytest.mark.asyncio`) hoặc plugin của AnyIO (`@pytest.mark.anyio`).",
          why: "Docs `unittest.mock`: từ 3.8 `patch()` trả `AsyncMock` nếu target là hàm async (https://docs.python.org/3/library/unittest.mock.html). pytest báo lỗi khi gặp test function async mà không có plugin xử lý (https://docs.pytest.org/en/stable/deprecations.html); pytest-asyncio thêm hỗ trợ coroutine làm test function (https://pytest-asyncio.readthedocs.io/en/stable/).",
        },
      ],
    },
  ],
  points: [
    {
      t: "**`pytest.raises`** kiểm exception: `with pytest.raises(ValueError, match=\"amount\"):`. `match` là regex chạy bằng `re.search` trên thông điệp; `as excinfo` cho `.type`, `.value`.",
      why: "Vì là `re.search`, `match=\"amount\"` khớp một phần chuỗi; ký tự đặc biệt như `(` `.` cần escape (https://docs.pytest.org/en/stable/how-to/assert.html). Kiểm luôn thông điệp giúp phân biệt hai `ValueError` khác nguyên nhân.",
    },
    {
      t: "So sánh số thực bằng **`pytest.approx`**: `assert 0.1 + 0.2 == pytest.approx(0.3)`. Dùng được cho list, dict.",
      why: "`0.1 + 0.2 == 0.3` là `False` do biểu diễn nhị phân; `approx` so trong một sai số tương đối (https://docs.pytest.org/en/stable/how-to/assert.html).",
    },
    {
      t: "Fixture có sẵn hay dùng: **`tmp_path`** (thư mục tạm riêng cho mỗi test, kiểu `pathlib.Path`), **`tmp_path_factory`** (session-scoped, tạo thư mục dùng chung), **`capsys`** (đọc stdout/stderr bằng `capsys.readouterr()`), **`monkeypatch`**.",
      why: "Mỗi test có thư mục riêng nên test ghi file không đè lên nhau và chạy song song được (https://docs.pytest.org/en/stable/how-to/tmp_path.html, https://docs.pytest.org/en/stable/how-to/capture-stdout-stderr.html).",
    },
    {
      t: "pytest chạy được test viết bằng `unittest.TestCase`, nhưng trong class `TestCase` **không** dùng được fixture qua tham số (trừ autouse), `parametrize` và custom hook.",
      why: "Docs ghi các tính năng này không chạy trong subclass `TestCase` và có lẽ sẽ không bao giờ chạy, vì hai framework thiết kế khác nhau (https://docs.pytest.org/en/stable/how-to/unittest.html). Codebase cũ có thể chuyển dần: test mới viết hàm thường, test cũ để nguyên.",
    },
  ],
  tips: [
    {
      t: "Câu \"test hàm gọi `datetime.now()`\": cách tốt nhất là truyền đồng hồ vào (tham số `now=datetime.now`, test truyền `lambda: FIXED`). Không sửa được code thì patch tên `datetime` trong module cần test (`@patch(\"report.datetime\")`), không patch `datetime.datetime.now`.",
      why: "`datetime.datetime` là kiểu viết bằng C và bất biến: `patch(\"datetime.datetime.now\")` ném `TypeError: cannot set 'now' attribute of immutable type 'datetime.datetime'` (thử trên CPython 3.14). Patch tên `datetime` trong module đang dùng nó thì được, đúng luật \"patch chỗ tra cứu\". Truyền đồng hồ vào thì không cần patch gì, như `code-testing-fundamentals` khuyên.",
    },
    {
      t: "Câu \"fixture scope `session` dùng khi nào?\": khi tạo rất đắt và test chỉ đọc (container DB, app đã build). Rủi ro: state rò giữa các test, kết quả phụ thuộc thứ tự chạy. Cách bù: fixture function-scoped bọc mỗi test trong transaction rồi rollback.",
      why: "Interviewer muốn nghe cả lợi (tốc độ) lẫn cái giá (test dính nhau) và cách giữ test độc lập.",
    },
    {
      t: "Viết test API FastAPI thì xem `py-fastapi`: `TestClient` và `app.dependency_overrides` thay dependency mà không cần `patch`.",
      why: "Ghi đè qua cơ chế DI của framework không phụ thuộc đường import, nên không mắc lỗi patch sai chỗ.",
    },
  ],
  cards: [
    ["Fixture scope `session` dùng khi nào, rủi ro gì?", "Cho thứ đắt và chỉ đọc (container DB, app). Rủi ro: một test sửa object chung làm test khác đổi kết quả theo thứ tự chạy. Bù bằng fixture function-scoped dọn state (rollback)."],
    ["`service.py` viết `from requests import get`. Patch `requests.get` thì sao?", "Không có tác dụng với `service`: nó giữ tên `get` riêng trỏ tới hàm thật, test vẫn gọi mạng. Phải patch `service.get`."],
    ["Test hàm gọi `datetime.now()` thế nào?", "Tốt nhất truyền đồng hồ vào. Không thì patch tên `datetime` trong module cần test. `patch(\"datetime.datetime.now\")` ném `TypeError` vì `datetime` là kiểu C bất biến."],
    ["Code sau `yield` trong fixture chạy khi nào?", "Khi fixture bị huỷ theo scope của nó (hết test với scope `function`), theo thứ tự ngược với setup. Fixture lỗi trước `yield` thì phần đó không chạy."],
    ["Vì sao nên dùng `autospec=True`?", "Mock trơn nhận mọi tên và mọi chữ ký, nên test vẫn xanh khi hàm thật đã đổi. Autospec giữ đúng chữ ký, gọi sai thì `TypeError`."],
    ["`parametrize` khác vòng `for` trong một test ở đâu?", "Mỗi bộ dữ liệu là một test riêng có id; một bộ đỏ không che các bộ khác, và chạy lại được đúng bộ đó."],
    ["Viết test `async def` cần gì?", "Plugin: pytest-asyncio (`@pytest.mark.asyncio`) hoặc AnyIO (`@pytest.mark.anyio`). Mock hàm async bằng `AsyncMock`; `patch` tự chọn nó cho hàm async từ 3.8."],
  ],
});
