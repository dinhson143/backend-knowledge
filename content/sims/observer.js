BK.sim({
  id: "observer",
  title: "Observer: 1 subject, nhiều observer",
  topics: ["patterns-gof"],
  scenario: "Giá cổ phiếu thay đổi, nhiều thành phần cần phản ứng mà Subject không cần biết chúng là ai.",
  context: "**Subject** (Stock AAPL) giữ danh sách observer và gọi `update()` trên từng observer khi trạng thái đổi. Subject chỉ biết interface `Observer`, không biết đó là Mobile App, Email hay Dashboard — đó là **loose coupling**: thêm observer mới không phải sửa Subject. Dòng chữ dưới Subject cho biết giá hiện tại và số observer đang đăng ký; dưới mỗi observer: nó làm gì khi nhận update.",
  nodes: [
    { id: "subject", x: 160, y: 145, label: "Stock (Subject)", w: 150, s: "AAPL=190" },
    { id: "o1", x: 590, y: 50, label: "Mobile App" },
    { id: "o2", x: 590, y: 145, label: "Email Alert" },
    { id: "o3", x: 590, y: 240, label: "Dashboard" },
  ],
  h: 310,
  steps: [
    {
      note: "3 observer **subscribe** vào Subject.",
      msgs: [
        {
          par: [["o1", "subject", "subscribe"], ["o2", "subject", "subscribe"], ["o3", "subject", "subscribe"]],
        },
      ],
      set: { subject: "AAPL=190 · 3 observers" },
      detail: "Subject giờ có 3 observer: mỗi observer gọi `subject.subscribe(this)` và Subject thêm tham chiếu vào danh sách nội bộ. Subject không import, không gọi trực tiếp class Mobile App hay Email Alert — nó chỉ giữ một `List<Observer>`. Đây là điểm mở rộng: muốn thêm Slack bot chỉ cần implement `Observer` rồi subscribe.",
    },
    {
      note: "Giá đổi → Subject gọi `notify()` cho mọi observer.",
      msgs: [
        {
          par: [
            ["subject", "o1", "update(195)", "ok"],
            ["subject", "o2", "update(195)", "ok"],
            ["subject", "o3", "update(195)", "ok"],
          ],
        },
      ],
      set: { subject: "AAPL=195" },
      detail: "Giá đổi từ 190 lên 195 → Subject cập nhật state rồi chạy `notify()`: lặp qua danh sách, gọi `update(195)` trên từng observer. Bản cài đặt cổ điển gọi **đồng bộ, cùng thread**: observer chậm (gửi email mất 2s) làm cả vòng `notify()` chậm theo; observer ném exception có thể khiến các observer sau không nhận update nếu Subject không bắt lỗi. Đây là kiểu **push** (gửi kèm giá trị); kiểu **pull** chỉ báo \"đã đổi\" để observer tự hỏi lại Subject.",
    },
    {
      note: "Mỗi observer tự xử lý theo cách riêng.",
      set: { o1: "push notification", o2: "gửi email", o3: "vẽ lại chart" },
      detail: "Mỗi observer phản ứng theo logic riêng với cùng dữ liệu: Mobile App đẩy push notification, Email Alert gửi email, Dashboard vẽ lại chart. Subject không biết và không quan tâm những việc này. Để observer chậm không chặn Subject, observer nên tự đẩy việc nặng (gửi email) sang hàng đợi hoặc thread khác.",
    },
    {
      note: "Email Alert **unsubscribe** — lần sau chỉ 2 observer nhận.",
      msgs: [
        ["o2", "subject", "unsubscribe", "warn"],
        { par: [["subject", "o1", "update(198)", "ok"], ["subject", "o3", "update(198)", "ok"]] },
      ],
      set: { subject: "AAPL=198 · 2 observers", o2: "" },
      lesson: "Observer: quan hệ 1–N, Subject và Observer lỏng lẻo (loose coupling).",
      detail: "Email Alert gọi `unsubscribe` → Subject xoá nó khỏi danh sách, còn 2 observer. Lần giá đổi sang 198, chỉ Mobile App và Dashboard nhận `update(198)`. Observer quên unsubscribe khi bị huỷ (ví dụ màn hình đã đóng) thì Subject vẫn giữ tham chiếu: GC không thu hồi được object và nó vẫn nhận update — lỗi **lapsed listener**, nguồn memory leak kinh điển. Ở hệ thống phân tán, cùng ý tưởng này trở thành pub/sub qua message broker.",
    },
  ],
});
