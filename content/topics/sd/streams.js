BK.topic({
  id: "streams",
  track: "sd",
  section: "sd-tech",
  title: "Streams / Event Sourcing",
  tldr: {
    t: "+ Stream (Kafka, Kinesis) là log bền vững, nhiều consumer group đọc lại được; Event Sourcing lưu chuỗi sự kiện thay vì trạng thái hiện tại. Nhánh này trống trên Miro.",
    why: "Nhiều hệ thống đọc cùng event độc lập và đọc lại được từ đầu, vì log không bị xoá khi đọc và offset thuộc về từng consumer group. Event Sourcing tận dụng đúng tính chất đó: lưu đủ event thì trạng thái là hàm của event, lúc nào cũng tính lại được.",
  },
  story: {
    problem: "Queue thường xoá message sau khi một consumer đọc → thêm service thứ hai cần cùng event thì phải sửa producer để gửi thêm, còn dữ liệu cũ đã mất. Consumer có bug thì không có cách xử lý lại các event của hôm qua.",
    idea: "Coi dữ liệu là một append-only log bền vững: mọi event ghi tuần tự và giữ theo retention, mỗi consumer group chỉ nhớ vị trí (offset) của mình. Đọc không làm thay đổi log → bao nhiêu consumer cũng được và tua lại được.",
    tradeoff: "Tốn storage vì giữ event nhiều ngày, và thứ tự chỉ có trong partition. Event Sourcing còn làm query trạng thái hiện tại khó hơn (phải fold hoặc dựng projection), và schema event cũ phải được hỗ trợ mãi.",
  },
  points: [
    {
      t: "+ **Khác queue** — message không bị xoá sau khi đọc; nhiều consumer group độc lập; replay từ offset bất kỳ.",
      why: "Queue xoá message khi ack nên chỉ phục vụ được một nhóm đọc. Stream chỉ lưu con trỏ offset cho mỗi consumer group, log vẫn nguyên → group analytics và group billing đọc cùng event với tốc độ riêng, và đặt offset về 0 là replay được.",
    },
    {
      t: "+ **Dùng khi** — xử lý realtime (analytics, fraud), fan-out một event cho nhiều service, cần replay.",
      why: "Stream đưa event tới ngay khi ghi — đúng thứ fraud detection hay analytics cần, vì chúng cần event trong vài giây, không đợi batch đêm. Một event `OrderPlaced` cần tới inventory, email, analytics: publish một lần, mỗi service là một consumer group, producer không cần biết ai đọc. Replay hữu ích khi deploy fix bug hoặc dựng service mới cần dữ liệu lịch sử.",
    },
    {
      t: "+ **Event Sourcing** — trạng thái = fold các event (`Deposited`, `Withdrawn`); audit đầy đủ, rebuild được; cần snapshot để đọc nhanh.",
      why: "Chỉ lưu event bất biến, nên trạng thái số dư = fold `Deposited(+100)`, `Withdrawn(-30)` → 70: luôn biết vì sao số dư là 70 (audit) và dựng lại được nếu bảng trạng thái hỏng. Nhưng tài khoản có 1 triệu event thì fold mỗi lần đọc quá chậm → lưu snapshot định kỳ, chỉ fold phần event sau snapshot.",
    },
    {
      t: "+ Stream processing: Flink, Kafka Streams, Spark Structured Streaming (windowing, aggregation).",
      why: "Trả lời 'bao nhiêu click trong 5 phút qua' cần gom event theo cửa sổ thời gian và giữ state giữa các event — đọc từng event thì chưa đủ. Các engine này quản lý window, state và checkpoint thay ta, nên aggregation trên luồng vô hạn vẫn chịu lỗi được.",
    },
  ],
  cards: [
    [
      "Queue khác Stream (Kafka) chỗ nào?",
      "Queue: message bị xoá khi xử lý xong, một nhóm consumer. Stream: log giữ lại theo retention, nhiều consumer group, replay được theo offset.",
    ],
  ],
});
