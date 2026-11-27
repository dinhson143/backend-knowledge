BK.sim({
  id: "cap",
  title: "Network partition: chọn CP hay AP",
  topics: ["cap"],
  scenario: "Kho còn **1** sản phẩm, dữ liệu nằm ở 2 node. Đường mạng giữa hai node bị đứt.",
  context: "CAP nói: khi có **network partition**, hệ phải chọn **C** (consistency — từ chối nếu không chắc dữ liệu mới nhất) hoặc **A** (availability — luôn trả lời, chấp nhận dữ liệu cũ). Partition là khi hai node vẫn sống, vẫn nhận request, nhưng không nói chuyện được với nhau. Kho còn đúng 1 sản phẩm, `stock` được nhân bản trên **Node A** (gần Hà Nội) và **Node B** (gần HCM). Theo dõi dòng `stock` dưới mỗi node và đường nối A–B bị cắt.",
  nodes: [
    { id: "u1", x: 90, y: 65, label: "User Hà Nội" },
    { id: "A", x: 420, y: 65, label: "Node A", s: "stock=1" },
    { id: "B", x: 420, y: 225, label: "Node B", s: "stock=1" },
    { id: "u2", x: 90, y: 225, label: "User HCM" },
  ],
  links: [["A", "B"]],
  variants: [
    {
      name: "CP — ưu tiên đúng",
      steps: [
        {
          note: "A và B đồng bộ với nhau.",
          msgs: [{ par: [["A", "B", "sync", "ok"], ["B", "A", "sync", "ok"]] }],
          detail: "Cả hai node cùng giữ `stock=1`, nên user ở đâu đọc cũng ra cùng một số. Hai node trao đổi cập nhật liên tục qua đường nối A–B: mỗi lần ghi ở một node được replicate sang node kia.",
        },
        {
          note: "**Network partition**: hai node không liên lạc được.",
          cut: [["A", "B"]],
          msgs: [["A", "B", "✗", "err"]],
          detail: "Đường mạng giữa A và B đứt (đứt cáp, switch lỗi, firewall chặn nhầm), nhưng cả hai vẫn sống và vẫn có user gọi tới. Điểm khó: mỗi node chỉ thấy node kia **im lặng** — không phân biệt được node kia chết hay chỉ mạng đứt, nên không thể giả định node kia không nhận ghi.",
        },
        {
          note: "User Hà Nội mua sản phẩm cuối trên A.",
          msgs: [["u1", "A", "BUY"], ["A", "u1", "OK", "ok"]],
          set: { A: "stock=0" },
          detail: "User Hà Nội gửi `BUY` tới A, A trừ kho xuống `stock=0` và trả `OK`. Trong hệ CP thật, A chỉ được làm vậy nếu là **leader/owner** của dữ liệu hoặc nằm ở phía có quorum (đa số). Với đúng 2 node thì không phía nào có đa số, nên hệ CP chặt (Raft/Paxos) sẽ khiến **cả A cũng từ chối**; mô phỏng ở đây ngầm coi A là primary.",
        },
        {
          note: "B không nhận được cập nhật.",
          set: { B: "stock=1 (chưa biết)" },
          msgs: [["A", "B", "replicate ✗", "err"]],
          detail: "B vẫn hiện `stock=1 (chưa biết)` vì A replicate `stock=0` sang nhưng gói tin không tới. B không biết mình đang cũ — từ góc nhìn của nó, chỉ có đường nối im lặng.",
        },
        {
          note: "User HCM gọi B. Hệ **CP**: B từ chối vì không chắc mình có dữ liệu mới nhất.",
          msgs: [["u2", "B", "BUY"], ["B", "u2", "503 Unavailable", "err"]],
          bad: ["B"],
          lesson: "CP: đúng dữ liệu, hy sinh availability. Chọn cho tồn kho, thanh toán, đặt vé.",
          detail: "B trả `503 Unavailable` cho `BUY` của user HCM: là hệ CP, B biết mình mất liên lạc với primary/quorum nên **không dám trả lời** bằng dữ liệu có thể đã cũ. User HCM không mua được, kể cả khi lẽ ra (nếu A không bán) vẫn còn hàng. Cái giá là **mất availability** ở phía bị cô lập, đổi lại không bao giờ bán quá số hàng có. Đây là lựa chọn đúng cho tồn kho, thanh toán, đặt vé — nơi sai số liệu đắt hơn vài phút lỗi.",
        },
      ],
    },
    {
      name: "AP — ưu tiên sẵn sàng",
      steps: [
        {
          note: "A và B đồng bộ với nhau.",
          msgs: [{ par: [["A", "B", "sync", "ok"], ["B", "A", "sync", "ok"]] }],
          detail: "Giống variant CP: A và B đồng bộ hai chiều, cùng `stock=1`.",
        },
        {
          note: "**Network partition**: hai node không liên lạc được.",
          cut: [["A", "B"]],
          msgs: [["A", "B", "✗", "err"]],
          detail: "Đường nối A–B đứt, và với lựa chọn AP mỗi node **tiếp tục phục vụ độc lập** bằng dữ liệu nó đang có. Mỗi node chỉ thấy node kia im lặng, không phân biệt được node kia chết hay mạng đứt.",
        },
        {
          note: "User Hà Nội mua sản phẩm cuối trên A.",
          msgs: [["u1", "A", "BUY"], ["A", "u1", "OK", "ok"]],
          set: { A: "stock=0" },
          detail: "User Hà Nội `BUY` trên A, A trừ còn `stock=0` và trả `OK`. Với AP, A không cần hỏi ai: nhận ghi cục bộ và định gửi cập nhật cho B sau.",
        },
        {
          note: "B không nhận được cập nhật.",
          set: { B: "stock=1 (chưa biết)" },
          msgs: [["A", "B", "replicate ✗", "err"]],
          detail: "Replicate từ A sang B thất bại (mũi tên đỏ), cập nhật nằm chờ trong hàng đợi của A. B vẫn tin `stock=1` và không có cách nào biết điều ngược lại.",
        },
        {
          note: "Hệ **AP**: B vẫn trả lời bằng dữ liệu cũ → User HCM mua được sản phẩm không còn (oversell).",
          msgs: [["u2", "B", "BUY"], ["B", "u2", "OK (stale)", "warn"]],
          set: { B: "stock=0 (bán thêm 1)" },
          bad: ["B"],
          detail: "Giờ **hai đơn hàng đã được xác nhận cho một sản phẩm** — oversell. User HCM `BUY` trên B; hệ AP ưu tiên trả lời, nên B thấy `stock=1` cục bộ, trừ xuống 0 và trả `OK (stale)`. Nguy hiểm ở chỗ cả hai user đều nhận phản hồi thành công, lúc đó không lỗi nào hiện ra.",
        },
        {
          note: "Mạng nối lại, hai node **reconcile** và phát hiện bán 2 khi chỉ có 1 → phải huỷ đơn hoặc bù trừ.",
          uncut: [["A", "B"]],
          msgs: [["A", "B", "sync", "ok"], ["B", "A", "conflict!", "err"]],
          lesson: "AP: luôn trả lời, chấp nhận stale. Chọn cho feed, like, profile.",
          detail: "Mạng nối lại, hai node trao đổi log ghi để **reconcile** — nhưng conflict này không hoà giải tự động cho đúng được. Hai lệnh ghi đồng thời cùng trừ sản phẩm cuối là một **conflict**: last-write-wins chỉ giữ `stock=0` và lặng lẽ bỏ qua chuyện đã bán 2. Hệ thống phải phát hiện conflict (vector clock, CRDT counter, hoặc so tổng đơn với tồn kho) và xử lý bằng nghiệp vụ: huỷ một đơn, hoàn tiền, xin lỗi, hoặc nhập thêm hàng. AP hợp cho feed, like, profile — nơi dữ liệu cũ vài giây không gây hại.",
        },
      ],
    },
  ],
});
