BK.sim({
  id: "tdd-codewalk",
  custom: "code",
  title: "TDD, BDD, property-based: đi từng bước với code",
  topics: ["dev-methods"],
  scenario: "Cùng một luật nghiệp vụ: **đơn dưới 500.000đ tính phí ship 30.000đ, từ 500.000đ miễn phí**. So sánh ba cách viết test và code. Dòng vừa thêm được tô sáng.",
  variants: [
    {
      name: "TDD: Red → Green → Refactor",
      steps: [
        {
          phase: "red",
          title: "Viết test đầu tiên trước khi có code",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000",
            },
            { name: "shipping.py", role: "impl", code: "# chưa có gì" },
          ],
          run: { ok: false, out: "ImportError: cannot import name 'shipping_fee' from 'shipping'\n1 error" },
          note: "Viết **một** test nhỏ mô tả hành vi mong muốn trước khi có code. Chạy và thấy **đỏ** là bắt buộc: nó chứng minh test thật sự kiểm tra điều gì đó. Một test chưa từng đỏ có thể luôn xanh kể cả khi code sai.",
        },
        {
          phase: "green",
          title: "Code tối thiểu để test xanh",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000",
            },
            { name: "shipping.py", role: "impl", code: "def shipping_fee(total):\n    return 30_000" },
          ],
          run: { ok: true, out: "1 passed" },
          note: "Trả hằng số nghe như gian lận, nhưng nó buộc bạn **chỉ viết code mà test đòi hỏi**. Các test tiếp theo sẽ “ép” logic thật ra → không có code thừa mà không test nào kiểm tra.",
        },
        {
          phase: "red",
          title: "Test thứ hai ở đúng giá trị biên",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0",
            },
            { name: "shipping.py", role: "impl", code: "def shipping_fee(total):\n    return 30_000" },
          ],
          run: { ok: false, out: "assert 30000 == 0\n1 failed, 1 passed" },
          note: "Test mới mô tả luật thứ hai và chọn **giá trị biên** 500.000 — nơi bug hay nằm nhất. Test đỏ vì code hằng số không xử lý được — đó chính là lý do để thêm logic.",
        },
        {
          phase: "green",
          title: "Thêm đúng nhánh mà test đòi hỏi",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "def shipping_fee(total):\n    if total >= 500_000:\n        return 0\n    return 30_000",
            },
          ],
          run: { ok: true, out: "2 passed" },
          note: "Test cũ vẫn xanh. Nó là **lưới an toàn**: xác nhận thay đổi mới không phá hành vi đã có — đúng thứ bạn cần khi codebase lớn dần.",
        },
        {
          phase: "refactor",
          title: "Dọn code khi đang xanh",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: { ok: true, out: "2 passed" },
          note: "Đặt tên cho “số ma thuật”, **không thêm hành vi mới**. Test đỏ sau refactor → bạn vừa vô tình đổi hành vi, quay lại ngay. Lợi ích lớn nhất của TDD: dám refactor vì có test bảo vệ.",
        },
        {
          phase: "red",
          title: "Nghĩ tới input xấu",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "import pytest\nfrom shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0\n\ndef test_negative_total_is_rejected():\n    with pytest.raises(ValueError):\n        shipping_fee(-1)",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: { ok: false, out: "Failed: DID NOT RAISE ValueError\n1 failed, 2 passed" },
          note: "Tổng tiền âm là dữ liệu sai. Viết test trước buộc bạn nghĩ về input xấu **lúc thiết kế**, thay vì phát hiện trên production.",
        },
        {
          phase: "green",
          title: "Ba test thành đặc tả sống",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "import pytest\nfrom shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0\n\ndef test_negative_total_is_rejected():\n    with pytest.raises(ValueError):\n        shipping_fee(-1)",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total < 0:\n        raise ValueError(\"total must be >= 0\")\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: { ok: true, out: "3 passed" },
          note: "Đọc ba test là biết luật ship. Lần sau ai đổi ngưỡng 500.000 sẽ thấy test đỏ và biết mình đang **đổi luật nghiệp vụ**, không phải sửa nhầm. Cái giá: viết chậm hơn lúc đầu, và test quá gắn implementation sẽ phải sửa theo khi refactor lớn.",
        },
      ],
    },
    {
      name: "BDD: Given / When / Then",
      steps: [
        {
          phase: "spec",
          title: "Viết kịch bản cùng PO và QA",
          files: [
            {
              name: "free_shipping.feature",
              role: "spec",
              code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ",
            },
          ],
          note: "BDD bắt đầu từ **cuộc trò chuyện** giữa PO, QA và dev (“three amigos”). Kịch bản viết bằng ngôn ngữ nghiệp vụ nên ai trong team cũng đọc và góp ý được — và nó chạy được như một test.",
        },
        {
          phase: "red",
          title: "Nối từng dòng với step definition",
          files: [
            {
              name: "free_shipping.feature",
              role: "spec",
              code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ",
            },
            {
              name: "test_free_shipping.py",
              role: "test",
              code: "from pytest_bdd import scenarios, given, when, then, parsers\nfrom shop import Cart, place_order\n\nscenarios(\"free_shipping.feature\")\n\n@given(parsers.parse(\"giỏ hàng có tổng {total:d}.000đ\"), target_fixture=\"cart\")\ndef cart(total):\n    return Cart(total * 1000)\n\n@when(\"khách thanh toán\", target_fixture=\"order\")\ndef checkout(cart):\n    return place_order(cart)\n\n@then(parsers.parse(\"phí ship là {fee:d}đ\"))\ndef check_fee(order, fee):\n    assert order.shipping_fee == fee",
            },
          ],
          run: { ok: false, out: "ModuleNotFoundError: No module named 'shop'\n1 error" },
          note: "Mỗi dòng Given/When/Then nối với một **step definition** gọi vào hệ thống thật qua use case `place_order`. Kịch bản kiểm tra **hành vi nhìn từ ngoài**, không kiểm tra hàm nội bộ — nên refactor bên trong không làm vỡ nó.",
        },
        {
          phase: "green",
          title: "Hiện thực domain cho kịch bản xanh",
          files: [
            {
              name: "free_shipping.feature",
              role: "spec",
              code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ",
            },
            {
              name: "shop.py",
              role: "impl",
              code: "from dataclasses import dataclass\nfrom shipping import shipping_fee\n\n@dataclass\nclass Cart:\n    total: int\n\n@dataclass\nclass Order:\n    total: int\n    shipping_fee: int\n\ndef place_order(cart):\n    return Order(cart.total, shipping_fee(cart.total))",
            },
          ],
          run: { ok: true, out: "1 passed  (Scenario: Đơn từ 500.000đ được miễn phí ship)" },
          note: "Đây là **double-loop**: vòng ngoài là kịch bản BDD mô tả hành vi, vòng trong là các unit test nhỏ — bên trong, `shipping_fee` vẫn viết bằng TDD.",
        },
        {
          phase: "spec",
          title: "Bảng ví dụ do business tự thêm",
          files: [
            {
              name: "free_shipping.feature",
              role: "spec",
              code: "Feature: Phí vận chuyển\n\n  Scenario Outline: Phí ship theo tổng đơn\n    Given giỏ hàng có tổng <total>.000đ\n    When khách thanh toán\n    Then phí ship là <fee>đ\n\n    Examples:\n      | total | fee   |\n      | 200   | 30000 |\n      | 499   | 30000 |\n      | 500   | 0     |",
            },
          ],
          run: { ok: true, out: "3 passed" },
          note: "PO tự thêm được dòng vào bảng `Examples` để đặc tả thêm trường hợp, không cần sửa code test. Cái giá: phải duy trì file feature lẫn step definition, và test chạy qua nhiều lớp nên chậm hơn unit test.",
        },
      ],
    },
    {
      name: "Property-based: để máy tìm edge case",
      steps: [
        {
          phase: "run",
          title: "Example test xanh nhưng code có bug",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from shipping import shipping_fee\n\ndef test_small_order():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_big_order():\n    assert shipping_fee(600_000) == 0",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total > FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: { ok: true, out: "2 passed" },
          note: "Code dùng `>` thay vì `>=`: đơn đúng 500.000đ vẫn bị tính phí. Hai example test đều xanh vì không ai chọn đúng giá trị biên — bug lọt qua code review và CI.",
        },
        {
          phase: "red",
          title: "Khai báo tính chất luôn đúng",
          files: [
            {
              name: "test_shipping.py",
              role: "test",
              code: "from hypothesis import given, strategies as st\nfrom shipping import shipping_fee\n\ndef test_small_order():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_big_order():\n    assert shipping_fee(600_000) == 0\n\n@given(st.integers(min_value=0, max_value=10_000_000))\ndef test_fee_rule_holds_for_any_total(total):\n    fee = shipping_fee(total)\n    assert fee in (0, 30_000)\n    if total >= 500_000:\n        assert fee == 0",
            },
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total > FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: {
            ok: false,
            out: "Falsifying example: test_fee_rule_holds_for_any_total(total=500000)\nAssertionError\n1 failed, 2 passed",
          },
          note: "Thay vì chọn ví dụ, khai báo **tính chất đúng với mọi tổng tiền**. Hypothesis sinh hàng trăm giá trị; gặp lỗi thì **thu gọn (shrink)** về ví dụ nhỏ nhất làm hỏng — ở đây chính là 500000, giá trị biên chứa bug.",
        },
        {
          phase: "green",
          title: "Sửa bug, property xanh",
          files: [
            {
              name: "shipping.py",
              role: "impl",
              code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE",
            },
          ],
          run: { ok: true, out: "3 passed" },
          note: "Hypothesis lưu ví dụ từng làm hỏng vào database cục bộ và chạy lại nó đầu tiên ở lần sau → bug không lặng lẽ quay lại. Cái giá: nghĩ ra property đúng khó hơn viết ví dụ, và test chạy lâu hơn.",
        },
      ],
    },
  ],
});
