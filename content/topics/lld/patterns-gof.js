BK.topic({
  id: "patterns-gof",
  track: "lld",
  section: "lld-patterns",
  title: "Design Patterns (GoF)",
  goal: "Chọn pattern tạo, ghép và phối hợp object cho tình huống cụ thể",
  needs: ["solid"],
  tldr: {
    t: "Creational kiểm soát cách tạo object; Structural lo cách object nối với nhau; Behavioral lo cách object giao tiếp và chia trách nhiệm.",
    why: "Ba nhóm khớp với ba nguồn thay đổi chính: cách tạo object (constructor phức tạp, chọn class), cách ghép object (bọc, che, nối), và cách object phối hợp (ai quyết định, ai được báo). Biết vấn đề thuộc nhóm nào là thu hẹp được pattern cần chọn.",
  },
  story: {
    problem: "Không có từ vựng chung, mỗi dev tự giải cùng một vấn đề theo cách riêng: chỗ dùng `if/else` để đổi thuật toán, chỗ dùng cờ boolean để quản trạng thái, chỗ copy constructor 10 tham số. Code khó đọc, và khó mở rộng vì giải pháp tự chế thường coupling chặt.",
    idea: "Pattern là giải pháp đã kiểm chứng cho vấn đề lặp lại, có tên gọi chung. Nói “dùng Strategy” là đồng đội hiểu ngay cấu trúc, không cần giải thích.",
    tradeoff: "Mỗi pattern thêm class và tầng gián tiếp. Áp pattern khi chưa có vấn đề (ví dụ Factory cho đúng một class) chỉ làm code khó đọc hơn.",
  },
  table: {
    head: ["Nhóm", "Pattern", "Ý chính", "Gặp ở bài"],
    rows: [
      {
        cells: [
          "Creational",
          "Singleton",
          "Chỉ một instance dùng chung: config, connection pool, logger",
          "Logger, DB pool",
        ],
        why: "Singleton đảm bảo mọi nơi dùng cùng một object. Connection pool hay logger tốn tài nguyên và cần trạng thái chung (số connection đang mở) → nhiều instance sẽ vượt giới hạn connection của DB hoặc ghi log lẫn lộn.",
      },
      {
        cells: ["Creational", "Builder (biến thể Bloch)", "Tạo object phức tạp từng bước, không lo thứ tự", "Tạo Pizza, HTTP request"],
        why: "Đây là Builder kiểu Effective Java (Bloch) hay gặp trong code hiện đại; Builder gốc của GoF có thêm Director điều khiển thứ tự các bước để cùng một quy trình dựng ra nhiều dạng biểu diễn. Constructor 10 tham số dễ truyền nhầm thứ tự và buộc truyền cả giá trị không cần → Builder cho set từng field có tên, tới `build()` mới kiểm tra hợp lệ. Object tạo ra có thể immutable vì chỉ được tạo khi đủ dữ liệu.",
      },
      {
        cells: [
          "Creational",
          "! Simple Factory",
          "+ Giao việc chọn class cụ thể cho factory, caller chỉ biết interface",
          "`VehicleFactory.create(type)`",
        ],
        why: "Caller viết `new Car()` là phụ thuộc thẳng vào class cụ thể → thêm `Truck` phải sửa mọi chỗ tạo xe. Factory gom quyết định “tạo class nào” về một chỗ, caller chỉ nhận `Vehicle`. `create(type)` với `switch` là Simple Factory; Factory Method của GoF thì để **subclass** override method tạo object (ví dụ `createVehicle()`), nên thêm loại mới là thêm subclass chứ không sửa `switch`.",
      },
      {
        cells: [
          "Structural",
          "Facade",
          "Một interface đơn giản che cả hệ thống con phức tạp",
          "`OrderService.checkout()`",
        ],
        why: "Checkout phải gọi inventory, payment, shipping, notification đúng thứ tự → để controller tự gọi thì logic điều phối lặp ở mọi nơi. `OrderService.checkout()` che toàn bộ, caller chỉ biết một method.",
      },
      {
        cells: [
          "Structural",
          "Decorator",
          "Thêm hành vi cho object mà không đổi class",
          "Thêm topping, logging wrapper",
        ],
        why: "Thêm topping bằng subclass gây bùng nổ tổ hợp (`CheesePizza`, `CheeseOlivePizza`…) → Decorator bọc object gốc và cùng implement interface `Pizza`. Mỗi lớp bọc cộng thêm giá, xếp chồng tuỳ ý lúc runtime.",
      },
      {
        cells: [
          "Structural",
          "+ Adapter",
          "Bọc một class có interface khác để nó khớp interface mà client cần",
          "Tích hợp payment gateway bên thứ ba, legacy API",
        ],
        why: "SDK của bên thứ ba có method `makeCharge(cents)` trong khi code của bạn gọi `PaymentProcessor.pay(amount)` → không sửa được SDK, và rải lời gọi SDK khắp nơi thì đổi nhà cung cấp phải sửa mọi chỗ. Adapter implement `PaymentProcessor` và dịch lời gọi sang SDK, đổi nhà cung cấp chỉ cần adapter mới.",
      },
      {
        cells: [
          "Structural",
          "+ Composite",
          "Cây phần–toàn thể: lá và nhóm dùng chung một interface",
          "File System (file/thư mục), menu lồng nhau",
        ],
        why: "Tính dung lượng thư mục mà phải `if (isFolder)` ở mọi chỗ thì code phình theo độ sâu cây → File và Folder cùng implement `getSize()`; Folder cộng `getSize()` của các con. Client gọi một method cho cả lá lẫn nhóm, cây sâu bao nhiêu cũng vậy.",
      },
      {
        cells: [
          "Behavioral",
          "Strategy",
          "Đóng gói thuật toán, hoán đổi lúc runtime",
          "Rate limiter, pricing, payment",
        ],
        why: "Rate limiter có thể đổi từ token bucket sang sliding window theo config → gói mỗi thuật toán thành class riêng implement `RateLimitStrategy`. Context giữ reference tới strategy và đổi được lúc runtime, không cần `if/else`.",
      },
      {
        cells: [
          "Behavioral",
          "Observer",
          "1–N: Subject đổi trạng thái thì Observers tự nhận thông báo",
          "Notification, stock ticker",
        ],
        why: "Stock ticker không nên biết có bao nhiêu màn hình, app, email đang theo dõi → Subject chỉ giữ danh sách Observer và gọi `notify()`. Thêm kênh thông báo mới chỉ cần `subscribe()`, không sửa Subject.",
      },
      {
        cells: [
          "Behavioral",
          "State (state machine)",
          "Quản lý vòng đời nhiều trạng thái, chỉ cho chuyển hợp lệ",
          "Vending machine, Order, Elevator",
        ],
        why: "Cờ `hasCoin`, `isDispensing` dễ rơi vào tổ hợp vô nghĩa (đang trả hàng mà vẫn nhận xu) → State Machine liệt kê trạng thái và chỉ cho chuyển hợp lệ. Mỗi state xử lý event theo cách riêng, trạng thái sai bị chặn ngay.",
      },
      {
        cells: [
          "Behavioral",
          "+ Chain of Responsibility",
          "Chuyển request qua chuỗi handler, mỗi handler xử lý hoặc chuyển tiếp",
          "Logger theo level, middleware HTTP, duyệt chi tiêu theo cấp",
        ],
        why: "Một hàm `if/else` kiểm auth, rate limit, validate rồi mới xử lý thì thêm bước mới phải sửa hàm đó → mỗi bước thành một handler giữ reference tới handler kế tiếp. Thêm, bỏ hay đổi thứ tự bước chỉ là đổi cách nối chuỗi; sender không cần biết ai sẽ xử lý.",
      },
    ],
  },
  points: [
    {
      t: "+ Cẩn thận với Singleton: đó là global state, khó test; môi trường multi-thread cần khởi tạo thread-safe.",
      why: "Singleton khó test: truy cập qua `getInstance()` tĩnh nên test không inject mock được và state rò rỉ giữa các test case. Khi chạy multi-thread, hai thread cùng thấy `instance == null` sẽ tạo hai instance → cần lock, double-checked locking hoặc khởi tạo sẵn.",
    },
    {
      t: "+ Strategy vs State: Strategy do **client chọn** thuật toán; State do **object tự chuyển** khi trạng thái đổi.",
      why: "Cấu trúc class giống nhau, khác ở **ai nắm quyền chuyển**. Strategy là “cách làm” do bên ngoài cấu hình, nên client chủ động `setStrategy()`; State là “đang ở đâu trong vòng đời”, nên chính state hiện tại quyết định state kế tiếp sau mỗi event.",
    },
    "Tham khảo: hellointerview.com/learn/low-level-design/in-a-hurry/patterns",
  ],
  cards: [
    [
      "Strategy khác State thế nào?",
      "Strategy: client chọn/hoán đổi thuật toán từ ngoài. State: object tự chuyển trạng thái bên trong, mỗi trạng thái quyết định hành vi và trạng thái kế tiếp.",
    ],
    [
      "Decorator khác kế thừa ở đâu?",
      "Decorator bọc object lúc runtime và xếp chồng được nhiều lớp; kế thừa cố định lúc compile và dễ bùng nổ số subclass.",
    ],
    ["Facade dùng khi nào?", "Khi cần một điểm gọi đơn giản cho subsystem phức tạp gồm nhiều class."],
    [
      "Khi nào dùng Builder?",
      "Object có nhiều tham số tuỳ chọn hoặc cần tạo từng bước — tránh constructor dài nhiều tham số.",
    ],
  ],
});
