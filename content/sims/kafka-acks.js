BK.sim({
  id: "kafka-acks",
  title: "acks=1 vs acks=all khi leader chết",
  topics: ["kafka"],
  scenario: "Partition P0 có 3 replica trên 3 broker. Producer ghi `order#42` rồi broker leader chết.",
  context: "Một message chỉ thật sự an toàn khi đã nằm trên broker **sẽ được bầu làm leader mới** nếu leader hiện tại chết. Mỗi partition có **1 leader** nhận mọi lệnh ghi; các **follower** tự kéo (fetch) dữ liệu từ leader về làm bản sao. `acks` là số xác nhận producer chờ trước khi coi một lần ghi là thành công. Theo dõi dòng chữ dưới mỗi broker: offset cuối cùng broker đó đang giữ.",
  nodes: [
    { id: "producer", x: 90, y: 165, label: "Producer" },
    { id: "b1", x: 380, y: 60, label: "Broker 1", s: "P0 leader · offset 41" },
    { id: "b2", x: 380, y: 165, label: "Broker 2", s: "P0 follower · 41" },
    { id: "b3", x: 380, y: 270, label: "Broker 3", s: "P0 follower · 41" },
    { id: "consumer", x: 670, y: 165, label: "Consumer" },
  ],
  links: [["b1", "b2"], ["b2", "b3"]],
  h: 330,
  variants: [
    {
      name: "acks=1",
      steps: [
        {
          note: "Producer gửi `order#42` với **acks=1**: chỉ cần leader ghi xong.",
          msgs: [["producer", "b1", "order#42 · acks=1"]],
          set: { b1: "P0 leader · offset 42" },
          detail: "Offset 42 lúc này **chỉ tồn tại trên Broker 1**: producer gửi batch chứa `order#42` tới **leader** của P0 là Broker 1, leader append vào log ở offset 42. Producer luôn ghi vào leader, không bao giờ ghi thẳng vào follower. Broker 2 và 3 vẫn dừng ở 41, vì follower chỉ kéo dữ liệu theo từng vòng fetch (vài ms tới vài trăm ms một lần).",
        },
        {
          note: "Leader ack ngay, chưa chờ follower.",
          msgs: [["b1", "producer", "ack offset 42", "ok"]],
          detail: "Với `acks=1`, leader trả ack ngay khi tự ghi xong, không chờ follower nào. Producer nhận ack thì coi `order#42` đã lưu: báo user “đặt hàng thành công” và **không bao giờ gửi lại** message này. Điểm mấu chốt: lời hứa đã đưa ra khi dữ liệu mới có **đúng 1 bản**.",
        },
        {
          note: "Leader **chết** trước khi follower kịp kéo offset 42.",
          set: { b1: "💥 down" },
          bad: ["b1"],
          detail: "Broker 1 chết (mất điện, kernel panic, bị OOM kill) trước khi follower kịp fetch offset 42. Kafka mặc định **không fsync** từng message xuống đĩa — độ bền dựa vào replication — nên dữ liệu có thể mới nằm trong page cache và mất theo máy. Kể cả đĩa còn nguyên, cluster cũng không chờ Broker 1 quay lại.",
        },
        {
          note: "Broker 2 được bầu làm leader mới — log của nó chỉ tới 41.",
          set: { b2: "P0 leader · offset 41" },
          msgs: [["b2", "consumer", "đọc tới 41", "warn"]],
          detail: "Broker 2 thành leader mới với log kết thúc ở offset 41, và từ đây log của nó là sự thật duy nhất. Controller (KRaft) thấy Broker 1 mất heartbeat và bầu leader mới trong **ISR**. Consumer chuyển sang đọc từ Broker 2 và chỉ thấy tới offset 41.",
        },
        {
          note: "`order#42` đã được ack nhưng **biến mất**.",
          bad: ["b2"],
          lesson: "acks=1 nhanh nhưng mất dữ liệu nếu leader chết ngay sau khi ack.",
          detail: "Producer đã nhận ack nhưng `order#42` không còn ở đâu trong cluster. Broker 1 khởi động lại thì phải **cắt log** (truncate) về offset 41 cho khớp leader mới, nên bản duy nhất cũng bị xoá; message kế tiếp được ghi vào chính offset 42. Hậu quả: user thấy đặt hàng thành công nhưng hệ thống không có đơn — lỗi **im lặng**, không log lỗi nào, rất khó phát hiện.",
        },
      ],
    },
    {
      name: "acks=all + min.insync=2",
      steps: [
        {
          note: "Producer gửi với **acks=all**; topic có replication.factor=3, min.insync.replicas=2.",
          msgs: [["producer", "b1", "order#42 · acks=all"]],
          set: { b1: "P0 leader · offset 42" },
          detail: "Leader ghi offset 42 vào log rồi **giữ request lại**, chưa trả lời producer, vì producer đặt `acks=all`. Topic có `replication.factor=3` (3 bản trên 3 broker) và `min.insync.replicas=2`: một lần ghi chỉ thành công khi **ít nhất 2 replica in-sync** (tính cả leader) đã có message.",
        },
        {
          note: "Follower kéo dữ liệu từ leader.",
          msgs: [{ par: [["b1", "b2", "replicate 42"], ["b1", "b3", "replicate 42"]] }],
          set: { b2: "P0 follower · 42", b3: "P0 follower · 42" },
          detail: "Broker 2 và 3 gửi fetch request và kéo offset 42 về log của mình. Khi follower fetch tiếp từ offset 43, leader biết chúng đã có 42 và nâng **high watermark** lên 43: từ đây message được coi là đã commit và consumer mới được đọc. Consumer không bao giờ đọc được message chưa commit — tránh đọc thứ có thể bị mất.",
        },
        {
          note: "Leader chỉ ack khi đủ ISR.",
          msgs: [["b1", "producer", "ack offset 42", "ok"]],
          detail: "Leader trả ack khi đủ số replica in-sync đã có message; lời hứa với producer giờ dựa trên **3 bản sao trên 3 máy**, không còn là một bản. Cái giá: latency ghi tăng thêm một vòng replication (thường vài ms trong cùng region) — throughput vẫn cao vì producer gửi theo batch và có nhiều request bay song song.",
        },
        {
          note: "Leader chết → Broker 2 lên leader **vẫn có** offset 42.",
          set: { b1: "💥 down", b2: "P0 leader · 42" },
          msgs: [["b2", "consumer", "order#42", "ok"]],
          good: ["b2"],
          detail: "Broker 1 chết, Controller bầu Broker 2 làm leader, và leader mới **chắc chắn có** `order#42`. Lý do: Kafka chỉ bầu leader **trong ISR** (khi `unclean.leader.election.enable=false`, mặc định), và mọi replica trong ISR đều có đủ message đã commit. Consumer đọc bình thường; producer chỉ thấy vài lần retry ngắn trong lúc đổi leader rồi chạy tiếp.",
        },
        {
          note: "Chỉ còn 1 replica in-sync → broker **từ chối ghi** của producer: Kafka chọn không mất dữ liệu thay vì luôn nhận ghi.",
          set: { b3: "💥 down" },
          msgs: [["producer", "b2", "order#43"], ["b2", "producer", "NotEnoughReplicas", "err"]],
          bad: ["b3"],
          lesson: "RF=3 + acks=all + min.insync.replicas=2: mất một broker vẫn không mất message đã ack.",
          detail: "Leader **từ chối** `order#43` bằng lỗi `NotEnoughReplicas` thay vì nhận ghi chỉ với một bản: Broker 3 cũng chết, ISR chỉ còn Broker 2 (1 < `min.insync.replicas`=2). Producer retry hoặc báo lỗi cho user. Đây là chọn **consistency hơn availability** (CP trong CAP): thà không nhận ghi còn hơn hứa rồi làm mất. Đọc dữ liệu đã có vẫn hoạt động bình thường.",
        },
      ],
    },
  ],
});
