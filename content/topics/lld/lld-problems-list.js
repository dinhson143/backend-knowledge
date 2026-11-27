BK.topic({
  id: "lld-problems-list",
  track: "lld",
  section: "lld-problems",
  title: "9 bài LLD kinh điển",
  tldr: {
    t: "+ Mỗi bài chuẩn bị sẵn: entity chính, pattern then chốt, câu hỏi mở rộng hay gặp. Danh sách lấy từ Hello Interview LLD.",
    why: "Chuẩn bị sẵn entity, pattern và câu mở rộng cho mỗi bài giúp trả lời có cấu trúc, vì interviewer chấm chủ yếu ở cách mô hình hoá entity và khả năng mở rộng. Câu mở rộng hay gặp chính là nơi pattern được kiểm chứng.",
  },
  story: {
    problem: "Gặp bài lạ mà chưa từng nghĩ qua entity và pattern, ứng viên mất nửa giờ chỉ để định hình class. Không chuẩn bị câu mở rộng thì khi interviewer hỏi “nhiều thang máy thì sao?” là phải đập đi xây lại.",
    idea: "Phần lớn đề LLD xoay quanh vài bài kinh điển, mỗi bài có một pattern then chốt và vài câu mở rộng quen thuộc. Thuộc sẵn khung thì dành được thời gian cho phần khó thật sự.",
    tradeoff: "Học thuộc khuôn dễ trả lời máy móc khi đề biến tấu. Vẫn phải hiểu vì sao pattern hợp với bài, không chỉ nhớ tên.",
  },
  table: {
    head: ["Bài", "Entity chính", "Pattern / kỹ thuật then chốt", "Câu mở rộng hay gặp"],
    rows: [
      {
        cells: [
          "Connect Four",
          "Game, Board, Player, Move",
          "Kiểm tra thắng theo 4 hướng từ ô vừa đặt (O(1))",
          "Bàn kích thước N, nhiều người chơi, undo",
        ],
        why: "Kiểm tra thắng là O(1), không cần quét cả bàn O(rows×cols): chỉ quân vừa đặt mới tạo được chuỗi thắng mới, nên chỉ đếm từ ô đó theo 4 hướng (ngang, dọc, 2 chéo), mỗi hướng tối đa 3 ô mỗi phía — số bước cố định.",
      },
      {
        cells: [
          "Amazon Locker",
          "Locker, Compartment (size), Package, AccessCode",
          "Strategy chọn ngăn vừa kích thước; mã hết hạn",
          "Ngăn nhiều kích thước, hết chỗ, trả hàng",
        ],
        why: "Chọn ngăn tách thành Strategy, vì gói hàng có kích thước khác nhau và chính sách chọn ngăn có thể đổi (vừa nhất, gần nhất). Mã truy cập có TTL để ngăn bị chiếm vô thời hạn khi khách không đến lấy.",
      },
      {
        cells: [
          "Elevator",
          "ElevatorController, Elevator, Request, Direction",
          "State (Idle/Moving/DoorOpen) + Strategy điều phối (SCAN/LOOK)",
          "Nhiều thang, giờ cao điểm, thang bảo trì",
        ],
        why: "State chặn chuyển sai, vì thang máy chỉ được làm một số thao tác ở mỗi trạng thái (không mở cửa khi đang chạy). Thuật toán điều phối (SCAN: đi hết một chiều rồi quay đầu) là chính sách thay được → dùng Strategy.",
      },
      {
        cells: [
          "Parking Lot",
          "ParkingLot, Level, Spot (type), Ticket, Vehicle",
          "Strategy tính phí, Factory tạo spot/vehicle",
          "Nhiều tầng, xe điện có sạc, đặt chỗ trước",
        ],
        why: "Cách tính phí đổi theo giờ, loại xe, ngày lễ → Strategy cho thay mà không sửa `ParkingLot`. Factory gom logic tạo loại Spot/Vehicle, nên thêm xe điện chỉ cần thêm class mới.",
      },
      {
        cells: [
          "File System",
          "Entry, File, Directory, Path",
          "Composite (Directory chứa Entry)",
          "Quyền truy cập, symlink, tìm kiếm",
        ],
        why: "Directory chứa cả file lẫn directory con → Composite cho cả hai cùng implement `Entry` với `getSize()`. Directory tính size bằng cách đệ quy gọi `getSize()` của con, không cần phân biệt loại.",
      },
      {
        cells: [
          "Movie Ticket Booking",
          "Movie, Show, Screen, Seat, Booking",
          "Giữ ghế có hạn (lock theo show/seat) + thanh toán",
          "Nhiều người chọn cùng ghế (concurrency)",
        ],
        why: "Phải giữ ghế (lock hoặc row có `held_until`) trong lúc thanh toán, vì hai người có thể cùng chọn ghế A5 trong vài giây. Hết hạn mà chưa trả tiền thì thả ghế, tránh giữ chỗ vĩnh viễn.",
      },
      {
        cells: [
          "Logging Service",
          "Logger, LogLevel, Appender, Formatter",
          "Singleton + Chain of Responsibility / Strategy cho appender",
          "Ghi bất đồng bộ (queue), xoay file log",
        ],
        why: "Logger là Singleton vì mọi module cần ghi vào cùng cấu hình và cùng file (hoặc tạo một instance dùng chung rồi inject qua DI để test thay được). Chain of Responsibility cho message đi qua chuỗi handler theo level; Strategy cho đổi đích ghi (console, file, remote) mà không sửa Logger.",
      },
      {
        cells: [
          "Rate Limiter",
          "RateLimiter, Rule, Bucket",
          "Strategy cho thuật toán (token bucket, sliding window)",
          "Thread-safe, nhiều rule, cấu hình động",
        ],
        why: "Mỗi thuật toán là một Strategy, vì token bucket cho phép burst còn sliding window đều hơn, và yêu cầu có thể đổi. Bucket bị nhiều thread cùng trừ token nên phải thread-safe.",
      },
      {
        cells: [
          "Inventory Management",
          "Product, Warehouse, StockLevel, Order",
          "Observer cảnh báo tồn thấp; giữ hàng atomic",
          "Nhiều kho, đặt trước, đồng thời trừ kho",
        ],
        why: "Dùng Observer vì nhiều bộ phận (mua hàng, cảnh báo) cần biết khi tồn kho thấp mà kho không nên phụ thuộc vào họ. Trừ kho phải atomic (kiểm tra và trừ trong cùng transaction) để hai đơn không cùng lấy món cuối cùng.",
      },
    ],
  },
  points: [],
  cards: [
    [
      "Elevator LLD dùng pattern nào?",
      "State cho trạng thái thang (Idle, Moving, DoorOpen) và Strategy cho thuật toán điều phối (SCAN/LOOK, gần nhất).",
    ],
    [
      "File System LLD dùng pattern nào?",
      "Composite: Directory và File cùng implement Entry, Directory chứa danh sách Entry con.",
    ],
  ],
});
