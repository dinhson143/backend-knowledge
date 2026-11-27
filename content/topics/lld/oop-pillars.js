BK.topic({
  id: "oop-pillars",
  track: "lld",
  section: "lld-oop",
  title: "4 tính chất của OOP",
  goal: "Giải thích và chọn interface hay abstract class đúng chỗ",
  needs: ["lld-delivery"],
  tldr: {
    t: "Encapsulation, Abstraction, Inheritance, Polymorphism. Hiểu Interface (CAN-DO) vs Abstract Class (IS-A).",
    why: "Bốn tính chất giải bốn vấn đề khác nhau: kiểm soát trạng thái, giấu chi tiết, tái dùng code, thay thế hành vi. Interface và abstract class là hai công cụ hiện thực Abstraction — chọn sai sẽ khoá thiết kế vào đơn kế thừa hoặc mất khả năng chia sẻ state.",
  },
  story: {
    problem: "Code thủ tục với struct và hàm rời rạc khiến một thay đổi nhỏ lan ra hàng chục file khi hệ thống lớn lên: ai cũng sửa được `balance`, thêm loại hình mới thì phải thêm `if type == ...` ở khắp nơi.",
    idea: "Gói dữ liệu và hành vi vào cùng object, chỉ lộ hợp đồng, để lời gọi chung (`shape.area()`) tự chọn hành vi đúng → thay đổi bị khoanh vùng trong một class.",
    tradeoff: "Thêm tầng trừu tượng (interface, class cha) làm code dài hơn và khó lần theo hơn. Lạm dụng inheritance tạo cây class sâu: sửa class cha làm vỡ class con.",
  },
  table: {
    head: ["", "Interface (CAN-DO)", "Abstract Class (IS-A)"],
    rows: [
      {
        cells: ["Method", "Chỉ khai báo (hợp đồng), không có thân hàm*", "Cả abstract method và concrete method"],
        why: "Interface không giữ logic chung, vì nó chỉ mô tả hợp đồng “làm được gì”; abstract class chứa được concrete method cho class con dùng lại. Từ Java 8+ interface có `default` method nên ranh giới này mờ hơn.",
      },
      {
        cells: ["Trạng thái", "Không có biến instance", "Có biến instance"],
        why: "Nhiều class không liên quan implement cùng interface mà không kế thừa layout bộ nhớ nào, vì interface không có biến instance. Abstract class có field nên chia sẻ được state chung như `id`, `createdAt`.",
      },
      {
        cells: ["Kế thừa", "Một class implement nhiều interface", "Đơn kế thừa"],
        why: "Implement nhiều interface không gây xung đột field (diamond problem về dữ liệu), vì interface không có state. Class có state, nên Java/C# chỉ cho đơn kế thừa để tránh mơ hồ khi hai cha có cùng field.",
      },
      {
        cells: [
          "Dùng khi",
          "Định nghĩa năng lực chung cho các class không liên quan",
          "Chia sẻ code + trạng thái cho các class cùng họ",
        ],
        why: "`Flyable` hợp làm interface vì `Bird` và `Airplane` không cùng họ nhưng cùng “bay được”. Ngược lại `Dog` và `Cat` cùng họ `Animal`, chia sẻ field `name` và logic `eat()` → abstract class bớt code lặp.",
      },
    ],
  },
  points: [
    {
      t: "+ **Encapsulation (Đóng gói)** — giấu trạng thái bên trong, chỉ cho thay đổi qua method có kiểm soát (`account.withdraw()` thay vì sửa `balance` trực tiếp).",
      why: "`balance` public thì ở đâu cũng gán được `balance = -1000` → invariant “không âm” bị phá mà không ai biết từ đâu. `withdraw()` gom mọi kiểm tra (đủ tiền, log, lock) về một chỗ duy nhất.",
    },
    {
      t: "**Abstraction (Trừu tượng)** — chỉ lộ ra “làm gì”, giấu “làm thế nào”; công cụ là interface và abstract class.",
      why: "Đổi Stripe sang PayPal không phải sửa caller, vì caller chỉ phụ thuộc vào “làm gì” (`PaymentGateway.charge()`). Chi tiết “làm thế nào” nằm sau interface và thay đổi tự do.",
    },
    {
      t: "+ **Inheritance (Kế thừa)** — class con tái dùng và mở rộng class cha (quan hệ IS-A). Ưu tiên **composition over inheritance** khi chỉ cần tái dùng hành vi.",
      why: "Sửa cha có thể làm vỡ mọi con (fragile base class), vì inheritance gắn chặt con vào cha lúc compile. Composition (`Car` có `Engine`) cho thay `Engine` lúc runtime và không kéo theo các method không cần.",
    },
    {
      t: "+ **Polymorphism (Đa hình)** — cùng một lời gọi, mỗi object hành xử khác nhau (`shape.area()` cho Circle, Square). Có runtime (override) và compile-time (overload).",
      why: "`shape.area()` gọi đúng `Circle.area()` hay `Square.area()` theo kiểu thật của object, vì runtime polymorphism dùng dynamic dispatch (vtable). Nhờ vậy thêm `Triangle` không phải sửa code gọi `area()`; còn overload được chọn lúc compile theo kiểu tham số.",
    },
    {
      t: "! *Java 8+ và C# 8+ cho phép interface có `default` method — “interface chỉ có hàm rỗng” là định nghĩa nguyên thuỷ.",
      why: "Ngôn ngữ cho phép `default` method có thân để thêm method vào interface cũ mà không làm vỡ hàng nghìn class đã implement (ví dụ `Collection.stream()` trong Java 8). Interface vẫn không có biến instance, nên khác abstract class ở chỗ không giữ state.",
    },
  ],
  cards: [
    [
      "Interface vs Abstract class?",
      "Interface: hợp đồng CAN-DO, không giữ trạng thái, implement nhiều cái. Abstract class: IS-A, có trạng thái + concrete method, đơn kế thừa.",
    ],
    [
      "Polymorphism là gì? Ví dụ.",
      "Cùng interface, hành vi khác nhau theo kiểu thực tế của object: `PaymentMethod.pay()` cho Card, Wallet, BankTransfer.",
    ],
    [
      "Vì sao ưu tiên composition over inheritance?",
      "Inheritance gắn chặt class con vào chi tiết class cha và cây kế thừa khó đổi; composition linh hoạt, thay hành vi lúc runtime được.",
    ],
  ],
});
