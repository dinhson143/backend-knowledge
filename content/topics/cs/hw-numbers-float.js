BK.topic({
  id: "hw-numbers-float",
  track: "cs",
  section: "cs-arch",
  title: "Integer, Float & Decimal",
  goal: "Chọn kiểu số đúng cho tiền và bộ đếm, tránh overflow và sai số float",
  tldr: {
    t: "Máy lưu số theo ba cách, mỗi cách hỏng theo một kiểu. **Integer cố định bit** (two's complement, 32/64 bit) đúng tuyệt đối nhưng **tràn** khi vượt giới hạn — Java quay vòng im lặng, C thì undefined behavior, Python `int` không giới hạn. **Float** (IEEE 754 binary64) phủ dải rất rộng nhưng chỉ có 53 bit chính xác và là phân số nhị phân, nên `0.1 + 0.2 != 0.3`. **Decimal** (cơ số 10) biểu diễn đúng `0.1`, dùng cho tiền. Quy tắc: **tiền** → Decimal hoặc số nguyên đơn vị nhỏ nhất; **đếm, id** → integer đủ rộng; **đo lường, khoa học** → float, so sánh bằng sai số.",
    why: "Float lưu số dạng `J / 2**N` với `J` có 53 bit, nên 1/10 thành `3602879701896397 / 2 ** 55`, gần nhưng không bằng 0.1 (https://docs.python.org/3/tutorial/floatingpoint.html). Sai số nhỏ đó cộng dồn qua hàng triệu giao dịch và làm phép so sánh bằng thất bại; với tiền, \"gần đúng\" là lỗi đối soát.",
  },
  story: {
    problem: "Giá lưu bằng `float`. Code tính `int(19.99 * 100)` để ra số cent và được `1998`. Báo cáo cuối tháng lệch vài đồng so với ngân hàng, không ai tìm ra vì mỗi phép tính trông đều đúng. Ở service khác, bộ đếm `int` 32 bit của Java vượt 2 147 483 647 và thành số âm.",
    idea: "Chọn kiểu theo **bất biến cần giữ**: tiền cần cộng trừ chính xác tuyệt đối → Decimal hoặc integer đơn vị nhỏ nhất (cent, đồng); bộ đếm cần không tràn → 64 bit hoặc kiểm tra tràn; số đo vật lý chấp nhận sai số → float, so sánh bằng `isclose`.",
    tradeoff: "Decimal thường chậm hơn float và phải chọn độ chính xác, cách làm tròn. Integer đơn vị nhỏ nhất nhanh nhưng phải biết đồng tiền có mấy chữ số lẻ, và mọi phép chia/nhân tỉ lệ vẫn phải làm tròn có chủ đích.",
  },
  table: {
    head: ["Kiểu", "Lưu thế nào", "Hỏng thế nào", "Dùng cho"],
    rows: [
      {
        cells: ["Integer cố định (`int32`, `int64`)", "Two's complement: n bit lưu −2ⁿ⁻¹ … 2ⁿ⁻¹−1", "Tràn: Java quay vòng, C signed là undefined behavior", "Bộ đếm, id, số lượng, tiền ở đơn vị nhỏ nhất"],
        why: "JLS §4.2.2: \"các toán tử số nguyên không báo overflow hay underflow theo bất kỳ cách nào\"; phép cộng tràn cho ra các bit thấp của kết quả đúng ở dạng two's complement (https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.2.2), nên `Integer.MAX_VALUE + 1` thành `-2147483648`. C: tràn signed là undefined behavior, compiler có thể tối ưu bỏ luôn phép kiểm tra (https://en.cppreference.com/w/c/language/operator_arithmetic).",
      },
      {
        cells: ["Python `int`", "Độ dài tuỳ ý", "Không tràn; chỉ chậm dần và tốn bộ nhớ khi số rất lớn", "Mọi số nguyên trong Python"],
        why: "\"Integers have unlimited precision\" (https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex). Nhưng khi ghi xuống DB (`BIGINT`), gửi qua JSON cho JavaScript, hay dùng numpy (`int64`) thì lại gặp giới hạn của phía bên kia.",
      },
      {
        cells: ["Float (`double`, IEEE 754 binary64)", "Dấu + số mũ + 53 bit significand, cơ số 2", "Không biểu diễn đúng 0.1; số nguyên lớn hơn 2⁵³ mất chính xác; có `inf`, `nan`, `-0.0`", "Đo lường, khoa học, ML, thống kê"],
        why: "Gần như mọi nền tảng map float của Python vào IEEE 754 binary64 (tutorial floatingpoint); Java `double` cũng là binary64 (JLS §4.2.3). Kiểu `Number` của JavaScript là binary64 và `JSON.parse` đọc mọi số JSON thành `Number` (BigInt là kiểu riêng, không tự sinh ra từ JSON), nên `Number.MAX_SAFE_INTEGER` = 2⁵³ − 1 = 9007199254740991 và `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` là `true` (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER).",
      },
      {
        cells: ["Decimal (Python `decimal`, SQL `NUMERIC`, Java `BigDecimal`)", "Chữ số cơ số 10 + số mũ, độ chính xác chọn được", "Chậm hơn float; vẫn làm tròn khi chia (1/3); trộn với float là mang lỗi float vào", "Tiền, thuế, tỉ giá, mọi số có bất biến kế toán"],
        why: "Tài liệu `decimal`: số thập phân biểu diễn chính xác, `0.1 + 0.1 + 0.1 - 0.3` bằng đúng 0, nên decimal \"được ưu tiên trong ứng dụng kế toán có bất biến bằng nhau chặt chẽ\" (https://docs.python.org/3/library/decimal.html). PostgreSQL: `numeric` \"đặc biệt được khuyên dùng để lưu số tiền\", còn `real`/`double precision` là kiểu \"không chính xác\" (https://www.postgresql.org/docs/current/datatype-numeric.html).",
      },
    ],
  },
  points: [
    {
      t: "**Two's complement** trong một câu: số âm `-x` được lưu bằng `~x + 1` (đảo bit rồi cộng 1), nên phép cộng dùng chung một mạch cho số dương và âm, và bit cao nhất là bit dấu. Hệ quả: `int32` có một số âm nhiều hơn số dương (−2³¹ … 2³¹−1).",
      why: "Vì thế `Math.abs(Integer.MIN_VALUE)` trong Java trả về chính giá trị âm đó (2³¹ không biểu diễn được trong `int32`); muốn bị báo lỗi thì dùng `Math.absExact` (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html). Java gọi `int`, `long` là \"signed two's-complement integers\" (JLS §4.2).",
    },
    {
      t: "**Bắt tràn thay vì quay vòng.** Java: `Math.addExact`, `multiplyExact` ném `ArithmeticException` khi tràn `int`/`long` (https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html). C/C++: dùng kiểu rộng hơn hoặc kiểm tra trước phép tính; sau khi tràn mới kiểm là đã muộn vì đó là undefined behavior.",
      why: "Bộ đếm, tổng tiền, id tự tăng hay tràn sau nhiều năm chạy: lỗi không xuất hiện khi test, chỉ xuất hiện ở production khi dữ liệu đủ lớn. Chọn `BIGINT`/`long` cho id và bộ đếm ngay từ đầu rẻ hơn nhiều so với migrate sau.",
    },
    {
      t: "**Id 64 bit qua JSON cho JavaScript thì gửi dạng chuỗi.** Id lớn hơn 2⁵³ (Snowflake id, `BIGINT` tự tăng lâu năm) bị `JSON.parse` làm tròn thành id khác mà không báo lỗi.",
      why: "JavaScript đọc mọi số JSON thành binary64; trên 2⁵³ − 1 hai số nguyên liên tiếp có thể thành cùng một giá trị (MDN, `MAX_SAFE_INTEGER`). Xem topic Distributed ID Generation.",
    },
    {
      t: "**So sánh float bằng sai số, không bằng `==`.** `0.1 + 0.1 + 0.1 == 0.3` là `False`; làm tròn trước (`round(0.1, 1)`) cũng không cứu được. Dùng `math.isclose(a, b)` với `rel_tol`/`abs_tol` hợp với bài toán (tutorial floatingpoint).",
      why: "Sai số tương đối của binary64 vào cỡ `sys.float_info.epsilon` ≈ 2.2e-16, nhưng sai số tuyệt đối tăng theo độ lớn của số; ngưỡng cố định kiểu `abs(a - b) < 1e-9` sai cho số rất lớn hoặc rất nhỏ. Quy tắc: so bằng sai số tương đối, thêm `abs_tol` khi so với 0.",
    },
    {
      t: "**Làm tròn có chủ đích.** `round()` của Python làm tròn **half to even** (`round(2.5)` = 2), và `round(2.675, 2)` cho `2.67` vì 2.675 thực ra được lưu hơi nhỏ hơn 2.675. Decimal mặc định cũng là `ROUND_HALF_EVEN`, độ chính xác 28 chữ số; với tiền dùng `quantize(Decimal(\"0.01\"), rounding=...)` và chọn rounding theo quy định nghiệp vụ.",
      why: "Half-to-even (banker's rounding) là mặc định của `round()` (https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex) và của context mặc định trong `decimal`. Quy tắc làm tròn của hoá đơn, thuế, phí do nghiệp vụ hoặc quy định quyết định và có thể khác (ví dụ half-up); chọn `rounding` tường minh trong code thay vì dựa vào mặc định.",
    },
    {
      t: "**Đơn vị nhỏ nhất khác nhau theo đồng tiền.** ISO 4217 ghi số chữ số lẻ (minor unit) cho từng mã: USD 2, JPY 0, VND 0, BHD 3 (danh sách của cơ quan duy trì ISO 4217 — https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml).",
      why: "Lưu \"số cent\" bằng cách nhân 100 cố định là sai với JPY, VND (không có đơn vị lẻ) và BHD (3 chữ số). Lưu kèm mã tiền tệ và tra số chữ số lẻ theo mã; hoặc lưu Decimal và `quantize` theo đúng số chữ số của đồng tiền đó.",
    },
    {
      t: "**`nan`, `inf`, `-0.0` là giá trị thật** của IEEE 754: `float(\"nan\") == float(\"nan\")` là `False`, `1e308 * 10` là `inf`, `0.0 == -0.0` là `True`.",
      why: "Một `nan` lọt vào dữ liệu làm hỏng sort, so sánh, và `max()` một cách khó đoán; phép chia trong float không ném lỗi mà ra `inf`. Kiểm `math.isfinite` ở biên nhận dữ liệu (input API, kết quả mô hình) trước khi lưu.",
    },
  ],
  sections: [
    {
      title: "Ví dụ: float, Decimal và integer trong Python",
      code: {
        lang: "python",
        lines: [
          "import math",
          "from decimal import Decimal, ROUND_HALF_UP",
          "",
          ["print(0.1 + 0.2, 0.1 + 0.2 == 0.3)", "→ 0.30000000000000004 False"],
          ["print(math.isclose(0.1 + 0.2, 0.3))", "→ True: so sánh bằng sai số tương đối."],
          ["print(int(19.99 * 100))", "→ 1998: 19.99 lưu hơi nhỏ hơn 19.99, `int()` cắt phần lẻ. Lỗi kinh điển khi đổi giá sang cent."],
          "",
          ["print(Decimal(0.1))", "→ 0.1000000000000000055511151231257827021181583404541015625: tạo Decimal từ float mang nguyên lỗi của float."],
          ["print(Decimal(\"0.1\") + Decimal(\"0.2\"))", "→ 0.3: tạo từ chuỗi thì đúng."],
          "price = Decimal(\"2.675\")",
          ["print(price.quantize(Decimal(\"0.01\")))", "→ 2.68 (mặc định `ROUND_HALF_EVEN`: 7 lẻ → lên 8)."],
          ["print(price.quantize(Decimal(\"0.01\"), rounding=ROUND_HALF_UP))", "→ 2.68; khác nhau ở các ca như 2.665 (half-even → 2.66, half-up → 2.67)."],
          ["print(round(2.675, 2), round(2.5))", "→ 2.67 2: float lưu 2.675 hơi nhỏ hơn; `round` làm tròn half-to-even."],
          "",
          ["print(2**63, float(2**53) == float(2**53 + 1))", "→ 9223372036854775808 True: `int` không tràn; float mất chính xác trên 2⁵³."],
          ["print(float(\"nan\") == float(\"nan\"), 1e308 * 10)", "→ False inf"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Câu \"lưu tiền bằng kiểu gì?\": trả lời Decimal/`NUMERIC` hoặc integer đơn vị nhỏ nhất, **kèm mã tiền tệ**, và nói rõ chỗ làm tròn (khi chia, khi tính thuế, tỉ giá) với quy tắc làm tròn nào.",
      why: "Interviewer đánh giá bạn có biết tiền là bài toán bất biến (tổng các dòng = tổng hoá đơn) chứ không chỉ là chọn kiểu dữ liệu.",
    },
    {
      t: "Khi nói về id hay bộ đếm, nói luôn số bit và lúc nào nó tràn: `int32` tự tăng 1 000 id/giây hết dải dương sau khoảng 25 ngày.",
      why: "2³¹ / 1 000 / 86 400 ≈ 24.9 ngày. Phép tính nhanh này cho thấy vì sao id nên là 64 bit ngay từ đầu.",
    },
  ],
  cards: [
    ["Vì sao 0.1 + 0.2 != 0.3 với float?", "Float lưu phân số nhị phân 53 bit; 0.1, 0.2, 0.3 đều không biểu diễn đúng, sai số làm tròn của tổng khác của 0.3."],
    ["`Integer.MAX_VALUE + 1` trong Java ra gì? Trong C với `int` có dấu?", "Java: `-2147483648` (quay vòng, không báo lỗi). C: undefined behavior."],
    ["Python có integer overflow không?", "`int` thuần không tràn (độ chính xác tuỳ ý). Gặp giới hạn khi ghi sang DB, numpy, JSON cho JavaScript."],
    ["`Decimal(0.1)` khác `Decimal(\"0.1\")` thế nào?", "Từ float: mang nguyên giá trị nhị phân gần đúng (0.1000000000000000055…). Từ chuỗi: đúng 0.1. Luôn tạo Decimal từ chuỗi hoặc integer."],
    ["Lưu tiền bằng integer đơn vị nhỏ nhất cần chú ý gì?", "Số chữ số lẻ theo ISO 4217 khác nhau (USD 2, JPY 0, BHD 3); lưu kèm mã tiền tệ; làm tròn có chủ đích khi chia."],
    ["Vì sao id 64 bit gửi cho frontend JavaScript nên là chuỗi?", "JS đọc số JSON thành double; trên 2⁵³ − 1 mất chính xác, id bị đổi im lặng."],
    ["So sánh hai float thế nào?", "`math.isclose(a, b, rel_tol=..., abs_tol=...)`: sai số tương đối, thêm `abs_tol` khi gần 0. Không dùng `==`."],
  ],
});
