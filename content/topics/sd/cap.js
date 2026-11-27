BK.topic({
  id: "cap",
  track: "sd",
  section: "sd-core",
  title: "CAP Theorem & Consistency Models",
  tldr: {
    t: "Khi có network partition (luôn phải chấp nhận P), chọn Consistency hoặc Availability. Mặc định chọn Availability; chọn Consistency cho chỗ sai dữ liệu là mất tiền (đặt vé, tồn kho, thanh toán).",
    why: "P không phải lựa chọn: trong hệ nhiều máy, mạng đứt chắc chắn xảy ra, nên câu hỏi thật chỉ còn C hay A lúc đứt mạng. **Availability** là mặc định vì đa số dữ liệu (feed, like, profile) cũ vài giây không hại ai; còn đặt vé hay tồn kho mà đọc dữ liệu cũ là bán trùng, thiệt hại tiền thật → phải chấp nhận từ chối request.",
  },
  story: {
    problem: "Hệ phân tán giữ nhiều bản sao trên nhiều máy, và mạng giữa chúng có thể đứt → lúc đó node nhận request không biết bản sao kia đã có ghi mới hay chưa.",
    idea: "Lúc mạng đứt chỉ có hai lựa chọn, và thiết kế phải chọn trước cho từng loại dữ liệu: từ chối trả lời để không trả dữ liệu cũ (Consistency), hoặc trả lời bằng dữ liệu mình có dù có thể cũ (Availability).",
    tradeoff: "Chọn C thì có lúc hệ trả lỗi hoặc treo; chọn A thì user có thể thấy dữ liệu cũ, hoặc hai bên ghi xung đột cần merge sau.",
  },
  table: {
    head: ["Consistency model", "Đảm bảo", "Ví dụ dùng"],
    rows: [
      {
        cells: ["Strong", "Mọi lần đọc thấy lần ghi mới nhất", "Số dư, đặt chỗ, tồn kho"],
        why: "Không ai đọc được bản cũ, vì mọi lần ghi phải được leader hoặc quorum xác nhận trước khi trả về, và lần đọc cũng đi qua đó. Cái giá là latency cao hơn và mất availability khi không liên lạc đủ node — đáng trả cho số dư hay ghế ngồi, vì đọc cũ ở đây là bán trùng.",
      },
      {
        cells: [
          "Causal",
          "Các thao tác có quan hệ nhân quả được thấy đúng thứ tự",
          "Comment trả lời phải hiện sau comment gốc",
        ],
        why: "Tránh được cảnh thấy câu trả lời trước câu hỏi mà vẫn rẻ hơn strong: hệ theo dõi quan hệ phụ thuộc (comment trả lời 「phụ thuộc」 comment gốc), replica chỉ hiện thao tác sau khi đã có đủ thao tác nó phụ thuộc; các thao tác không liên quan thì không cần chờ nhau.",
      },
      {
        cells: ["Read-your-own-writes", "User luôn thấy dữ liệu chính mình vừa ghi", "Sửa profile xong thấy ngay"],
        why: "Người vừa sửa profile mà reload thấy dữ liệu cũ sẽ tưởng thao tác thất bại và sửa lại. Chỉ cần định tuyến đọc của chính user đó về primary (hoặc replica đã bắt kịp version vừa ghi) trong một khoảng ngắn; người khác vẫn đọc replica bình thường.",
      },
      {
        cells: ["Eventual", "Sau một lúc mọi replica hội tụ", "Like count, feed, metrics"],
        why: "Ghi nhanh và hệ vẫn chạy khi mạng đứt, vì replica nhận ghi rồi lan truyền bất đồng bộ, không ai phải chờ ai. Like count lệch vài giây hay feed tạm thiếu một bài thì không ai nhận ra → đổi lấy latency thấp và availability cao là hời.",
      },
    ],
  },
  points: [
    {
      t: "**Partition Tolerance** — hệ phân tán buộc phải chấp nhận mất kết nối mạng → lựa chọn thực tế là C hay A.",
      why: "Với hệ phân tán, bỏ P là không có thật — hệ 「CA」 chỉ tồn tại khi chạy trên một máy. Switch hỏng, GC pause dài hay mất kết nối giữa hai DC đều khiến node không liên lạc được nhau, và hệ không thể ngăn chúng xảy ra.",
    },
    {
      t: "+ Có thể chọn **khác nhau theo từng phần** của cùng một hệ thống: Ticketmaster — strong consistency khi đặt vé, availability khi xem sự kiện.",
      why: "Tách hai luồng ra thì chỉ trả giá latency/availability ở đúng chỗ cần, vì cái giá của dữ liệu cũ khác nhau theo từng chức năng: xem trang sự kiện thấy số ghế trễ vài giây là vô hại và cần chịu tải lớn, còn bước giữ ghế mà đọc cũ thì hai người mua trùng một ghế.",
    },
    {
      t: "+ **PACELC** mở rộng: khi không có partition (Else) vẫn phải chọn giữa Latency và Consistency.",
      why: "Kể cả khi mạng bình thường vẫn có đánh đổi: muốn đọc luôn thấy bản mới thì mỗi lần ghi phải chờ replica xác nhận, tức thêm round-trip mạng. CAP chỉ nói lúc có sự cố; PACELC chỉ ra rằng 99% thời gian còn lại bạn vẫn đang đổi latency lấy consistency.",
    },
  ],
  diagrams: [
    {
      src: "content/svg/cap-pacelc.svg",
      caption: "PACELC mở rộng CAP: khi có partition (P) chọn Availability hay Consistency; còn lại (Else) — tức gần như mọi lúc — vẫn phải chọn giữa Latency và Consistency.",
      source: "https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf",
    },
  ],
  cards: [
    [
      "Vì sao nói thực tế chỉ chọn giữa C và A?",
      "Network partition chắc chắn xảy ra trong hệ phân tán, nên P là bắt buộc; khi partition xảy ra phải chọn trả lỗi (C) hay trả dữ liệu có thể cũ (A).",
    ],
    [
      "Read-your-own-writes là gì?",
      "User luôn đọc được thay đổi của chính mình (ví dụ đọc từ primary trong vài giây sau khi ghi), dù người khác có thể thấy trễ.",
    ],
  ],
});
