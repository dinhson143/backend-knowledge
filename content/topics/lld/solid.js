BK.topic({
  id: "solid",
  track: "lld",
  section: "lld-principles",
  title: "SOLID",
  tldr: {
    t: "5 nguyên tắc giúp class dễ đổi, dễ mở rộng. SRP là nền tảng.",
    why: "Các nguyên tắc này đều nhắm vào khoanh vùng thay đổi, vì chi phí lớn nhất của phần mềm là sửa đổi. **SRP** là nền: khi mỗi class chỉ có một lý do để đổi, OCP, ISP, DIP mới có ranh giới rõ để áp dụng.",
  },
  story: {
    problem: "Mỗi thay đổi đều có rủi ro làm hỏng phần không liên quan khi một class làm mọi thứ. Ví dụ `OrderService` vừa tính giá, vừa ghi MySQL, vừa gửi email: đổi template email phải deploy lại cả logic tính tiền, thêm phương thức thanh toán phải sửa `if/else` dài 200 dòng.",
    idea: "Chia class theo lý do thay đổi, nối chúng qua abstraction → yêu cầu mới được đáp ứng bằng cách thêm code, không sửa code cũ đang chạy ổn.",
    tradeoff: "Nhiều class và interface nhỏ hơn → phải nhảy qua nhiều file để hiểu một luồng. Áp dụng máy móc cho code nhỏ dễ thành over-engineering.",
  },
  table: {
    head: ["Nguyên tắc", "Một câu", "Dấu hiệu vi phạm"],
    rows: [
      {
        cells: [
          "SRP · Single Responsibility",
          "Một class chỉ có một lý do để thay đổi",
          "Class vừa tính tiền vừa gửi email vừa ghi DB",
        ],
        why: "`Invoice` vừa tính tiền, vừa gửi email, vừa ghi DB → đổi SMTP sang SES cũng phải sửa và test lại cả logic tính tiền. Tách thành `InvoiceCalculator`, `EmailSender`, `InvoiceRepository` thì mỗi thay đổi chỉ chạm một class.",
      },
      {
        cells: ["OCP · Open/Closed", "Mở để mở rộng, đóng để sửa", "Thêm loại mới phải sửa chuỗi `if/else` cũ"],
        why: "`calculateFee()` dùng `if type == CAR ... elif type == BIKE` → thêm `TRUCK` phải sửa hàm đã test và có thể làm hỏng nhánh cũ. Dùng interface `FeeStrategy` thì chỉ cần thêm class `TruckFee`, code cũ không đổi.",
      },
      {
        cells: [
          "LSP · Liskov Substitution",
          "Class con dùng được ở mọi chỗ class cha dùng",
          "Square.setWidth() đổi luôn height, hoặc override rồi throw `NotSupported`",
        ],
        why: "Class con phải giữ hợp đồng của cha, không chỉ khớp chữ ký method. Ví dụ `resize(Rectangle r)` giả định `setWidth()` không đổi height → truyền `Square` (đổi cả hai cạnh) thì diện tích sai, còn nếu Square throw `NotSupported` thì caller crash.",
      },
      {
        cells: [
          "ISP · Interface Segregation",
          "Client không bị buộc phụ thuộc vào method nó không dùng → tách interface theo nhu cầu của client",
          "Class implement method rỗng chỉ vì bắt buộc",
        ],
        why: "Interface `Worker` có cả `work()` và `eat()` → `RobotWorker` buộc phải viết `eat()` rỗng hoặc throw. Tách `Workable` và `Eatable` thì mỗi class chỉ implement thứ nó thật sự làm, và đổi `eat()` không bắt Robot compile lại.",
      },
      {
        cells: [
          "DIP · Dependency Inversion",
          "Phụ thuộc abstraction, không phụ thuộc implementation",
          "`new MySQLRepository()` ngay trong service",
        ],
        why: "`OrderService` gọi `new MySQLRepository()` bên trong → không thay được bằng Postgres hay mock khi unit test. Nhận `Repository` interface qua constructor thì service không biết DB cụ thể, đổi DB chỉ đổi chỗ wiring.",
      },
    ],
  },
  points: [],
  cards: [
    ["SRP là gì?", "Một class chỉ có một lý do để thay đổi; trộn nhiều concern thì tách ra."],
    [
      "OCP thường hiện thực bằng pattern nào?",
      "Strategy / polymorphism: thêm class mới implement interface thay vì sửa if/else cũ.",
    ],
    [
      "Ví dụ vi phạm LSP?",
      "Square kế thừa Rectangle: set width làm đổi height, code dùng Rectangle bị sai kỳ vọng.",
    ],
    [
      "DIP khác Dependency Injection?",
      "DIP là nguyên tắc (phụ thuộc abstraction). DI là kỹ thuật truyền dependency từ ngoài vào để hiện thực DIP.",
    ],
  ],
});
