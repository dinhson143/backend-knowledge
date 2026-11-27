BK.topic({
  id: "lld-delivery",
  track: "lld",
  section: "lld-framework",
  title: "Khung trả lời LLD",
  goal: "Trình bày một bài LLD từ requirements tới class design",
  tldr: {
    t: "+ Requirements → Entities & relationships → Class design → Implementation → Extensibility. Nhánh này không có trên Miro.",
    why: "Thứ tự này đi từ thứ rẻ nhất để đổi (câu hỏi, danh sách entity) tới thứ đắt nhất (code). Các bước trước phải tạo ra cấu trúc mà yêu cầu mới chỉ cần thêm class, vì **Extensibility** là bước interviewer kiểm tra thiết kế.",
  },
  story: {
    problem: "Không có khung thì dễ bỏ sót requirement, thiết kế sai quan hệ và hết giờ trước khi kịp chứng minh khả năng mở rộng. Ví dụ: ứng viên nghe đề Parking Lot liền code class `ParkingLot` với 20 method, 15 phút sau interviewer hỏi “xe máy thì sao?” là phải viết lại gần hết.",
    idea: "Đi từ ngoài vào trong: chốt phạm vi → tìm entity → gán trách nhiệm → code. Mỗi bước dùng output của bước trước, nên sai sót bị bắt sớm, lúc sửa còn rẻ.",
    tradeoff: "Tốn 5–10 phút đầu cho hỏi đáp và vẽ entity → phần code còn ít thời gian hơn. Đề quá đơn giản mà vẫn đi đủ 5 bước có thể bị xem là chậm.",
  },
  table: {
    head: ["Bước", "Làm gì"],
    rows: [
      {
        cells: ["Requirements", "Hỏi rõ phạm vi, thao tác chính, lỗi cần xử lý, ngoài phạm vi"],
        why: "Chốt phạm vi trước để tránh thiết kế thừa hoặc thiếu, vì đề LLD cố tình mơ hồ (Parking Lot có xe máy không? có thanh toán không?). Ghi rõ “ngoài phạm vi” còn cho bạn quyền từ chối khi interviewer hỏi lan man.",
      },
      {
        cells: ["Entities & Relationships", "Danh từ → class; quan hệ has-a / is-a; ai sở hữu trạng thái"],
        why: "Rút danh từ trong requirement là cách nhanh nhất tìm class, vì danh từ thường chính là thực thể có trạng thái riêng (Ticket, Spot, Vehicle). Xác định ai sở hữu trạng thái để tránh hai class cùng sửa một field rồi lệch nhau.",
      },
      {
        cells: ["Class Design", "Thuộc tính + method public cho từng class; áp dụng SOLID"],
        why: "Chốt method public trước khi code giúp phát hiện class ôm quá nhiều trách nhiệm (vi phạm SRP) hoặc phụ thuộc thẳng vào implementation (vi phạm DIP), vì method public là hợp đồng giữa các class. Sửa trên giấy rẻ hơn sửa code.",
      },
      {
        cells: ["Implementation", "Code các method cốt lõi, happy path trước rồi edge case"],
        why: "Code happy path trước để chứng minh thiết kế chạy được end-to-end trong thời gian có hạn; edge case (bãi đầy, ticket không hợp lệ) thêm sau mà không phá luồng chính. Làm ngược lại dễ hết giờ khi luồng chính chưa xong.",
      },
      {
        cells: ["Extensibility", "Interviewer thêm yêu cầu; thiết kế tốt chỉ cần thêm class, không sửa nhiều"],
        why: "Thiết kế dùng interface/Strategy đúng chỗ thì yêu cầu mới chỉ cần thêm `EVSpot` hoặc `EVPricing` — interviewer thêm yêu cầu (xe điện, nhiều tầng) chính là để kiểm tra **OCP**. Phải sửa nhiều class cũ là dấu hiệu coupling cao.",
      },
    ],
  },
  points: [
    {
      t: "+ Bài kinh điển: Parking Lot, Elevator, Vending Machine (State), Rate Limiter (Strategy), Connect Four, LRU Cache.",
      why: "Luyện các bài này giúp nhận dạng pattern nhanh, vì mỗi bài gắn với một pattern rõ ràng: Vending Machine có trạng thái → State, Rate Limiter cần đổi thuật toán → Strategy. LRU Cache kiểm tra thêm khả năng kết hợp hash map + doubly linked list để đạt O(1).",
    },
  ],
  cards: [
    [
      "5 bước trả lời Low-Level Design?",
      "Requirements → Entities & relationships → Class design → Implementation → Extensibility.",
    ],
  ],
});
