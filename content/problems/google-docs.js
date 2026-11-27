BK.problem({
  id: "google-docs",
  level: 3,
  title: "Collaborative Editor (Google Docs)",
  hi: "google-docs",
  summary: "Nhiều người gõ cùng lúc trên một tài liệu, ai cũng thấy ngay và cuối cùng hội tụ cùng một nội dung.",
  topics: ["networking", "consistent-hashing", "patterns"],
  fr: [
    "Tạo tài liệu",
    "Nhiều người sửa đồng thời",
    "Thấy thay đổi của người khác realtime",
    "Thấy con trỏ / ai đang online",
  ],
  nfr: [
    {
      t: "Thay đổi hiện < 100ms",
      why: "Trễ trên 100ms đã thấy giật, vì phải thấy chữ người khác gõ gần như ngay lập tức mới có cảm giác cộng tác. Hệ quả: WebSocket, state doc in-memory, áp op local trước rồi đồng bộ sau (optimistic).",
    },
    {
      t: "Mọi người **hội tụ** cùng nội dung (eventual consistency)",
      why: "Thiếu thuật toán hội tụ thì mỗi người thấy một nội dung khác khi nhiều người sửa đồng thời. Yêu cầu này dẫn tới OT (hoặc CRDT): mọi client áp dụng xong cùng tập op thì có cùng doc.",
    },
    {
      t: "~100 người cùng sửa một doc",
      why: "Toàn bộ op của một doc vừa sức một server, vì số người sửa mỗi doc có giới hạn (~100). Nhờ đó gom doc về một server để OT tập trung là khả thi.",
    },
    {
      t: "Không mất edit",
      why: "Mọi op phải bền trước khi xác nhận, vì mất chữ đã gõ là lỗi nghiêm trọng nhất của editor. Hệ quả: append ops log trước khi ack, client giữ op chưa ack để gửi lại.",
    },
  ],
  capacity: "Hàng triệu doc nhưng mỗi doc ít người → bài toán là gom người của cùng doc về một chỗ.",
  entities: ["Document", "Edit (operation)", "Cursor", "User"],
  api: [
    "POST /docs → docId",
    "WS /docs/{id} → insert(pos, text, version) / delete(pos, version)",
    "WS ← op đã transform từ người khác, cursor updates",
  ],
  hldWhy: "**LB** route theo `docId` để mọi người sửa cùng doc vào cùng một **Document Service** instance, vì OT cần một nơi duy nhất xếp thứ tự op của mỗi doc. Document Service giữ state doc và version hiện tại trong RAM → transform và broadcast op dưới 100ms mà không đọc DB. **Ops log** dùng Cassandra vì op là luồng append rất nhiều: partition theo `docId` cho đọc tuần tự dễ, ghi throughput cao. **Snapshots** tồn tại vì replay toàn bộ op từ đầu để mở doc sẽ ngày càng chậm; snapshot + op sau nó cho load nhanh.",
  hld: {
    id: "hld-google-docs",
    title: "HLD — Collaborative Editor",
    h: 340,
    scenario: "LB định tuyến mọi người của cùng doc về cùng Document Service; server xếp thứ tự và transform op (OT).",
    context: "**LB** định tuyến theo docId (consistent hashing) để mọi người cùng sửa một doc nối WebSocket vào **cùng một Document Service** — nơi duy nhất quyết định thứ tự op. Document Service giữ doc trong RAM, áp dụng **Operational Transformation (OT)** cho op đến trễ, và append mọi op vào **Ops log** (Cassandra). **Snapshots** lưu bản nén định kỳ để mở doc nhanh. Theo dõi dòng chữ dưới Document Service: nội dung và số version (`v5`, `v6`, `v7`), và dưới Alice/Bob: bản local của mỗi người.",
    nodes: [
      { id: "alice", x: 80, y: 80, label: "Alice", s: "\"ABC\"" },
      { id: "bob", x: 80, y: 270, label: "Bob", s: "\"ABC\"" },
      { id: "gw", x: 280, y: 175, label: "LB (theo docId)", w: 150 },
      { id: "ds", x: 490, y: 175, label: "Document Service", w: 160, s: "doc42 = \"ABC\" · v5" },
      { id: "ops", x: 700, y: 80, label: "Ops log", s: "Cassandra" },
      { id: "snap", x: 700, y: 270, label: "Snapshots", s: "—" },
    ],
    links: [["alice", "gw"], ["bob", "gw"], ["gw", "ds"], ["ds", "ops"], ["ds", "snap"]],
    variants: [
      {
        name: "Sửa đồng thời (OT)",
        steps: [
          {
            note: "Cả hai nối WebSocket; LB đưa mọi người của **cùng doc vào cùng server** (consistent hashing theo docId).",
            msgs: [{ par: [["alice", "gw", "WS doc42"], ["bob", "gw", "WS doc42"]] }, ["gw", "ds", "route doc42"]],
            detail: "Alice và Bob cùng mở doc42 và được đưa vào **cùng một** Document Service: LB hash `doc42` trên vòng consistent hashing, mỗi người giữ một kết nối WebSocket. Một server duy nhất cho mỗi doc → một nơi duy nhất xếp thứ tự op, không cần lock phân tán giữa các máy. Consistent hashing giúp khi thêm/bớt server chỉ một phần nhỏ doc phải chuyển chỗ.",
          },
          {
            note: "Cùng lúc trên v5: Alice chèn `X` ở vị trí 0, Bob xoá ký tự ở vị trí 2 (`C`).",
            msgs: [{ par: [["alice", "gw", "insert(0,X) @v5"], ["bob", "gw", "delete(2) @v5"]] }],
            set: { alice: "local: \"XABC\"", bob: "local: \"AB\"" },
            detail: "Hai bản local đã lệch nhau: Alice thấy `\"XABC\"`, Bob thấy `\"AB\"`. Cả hai đang thấy `\"ABC\"` ở **v5** và sửa cùng lúc: Alice gửi `insert(0,X)`, Bob gửi `delete(2)` (xoá `C`), mỗi op ghi rõ nó dựa trên v5. Client áp op **ngay trên bản local** để người dùng không thấy độ trễ mạng; nhiệm vụ của server là làm hai bản hội tụ.",
          },
          {
            note: "Op của Alice đến trước → áp dụng, ghi ops log, thành v6.",
            msgs: [["gw", "ds", "insert(0,X)"], ["ds", "ops", "append v6", "ok"]],
            set: { ds: "doc42 = \"XABC\" · v6" },
            detail: "Server áp op của Alice nguyên trạng — doc thành `\"XABC\"` · **v6** — và append op vào Ops log. Op đến trước và dựa trên v5, đúng bằng version hiện tại. Thứ tự đến server chính là thứ tự chính thức; server chỉ trả “đã nhận” sau khi op ghi bền vào log.",
          },
          {
            note: "Op của Bob dựa trên v5 nên server **transform** nó qua op của Alice: vị trí 2 → 3 vì phía trước vừa chèn thêm một ký tự.",
            msgs: [["gw", "ds", "delete(2) @v5"], ["ds", "ops", "append v7: delete(3)", "ok"]],
            set: { ds: "doc42 = \"XAB\" · v7" },
            detail: "Server **transform** op của Bob từ `delete(2)` thành `delete(3)`, doc thành `\"XAB\"` · **v7**, op đã transform được ghi vào log. Op của Bob dựa trên v5 trong khi doc đã ở v6; áp nguyên `delete(2)` lên `\"XABC\"` sẽ xoá `B` — sai ý Bob. Alice chèn 1 ký tự ở vị trí 0 ≤ 2, nên mọi vị trí từ 2 trở đi bị đẩy lên 1 → `delete(3)` xoá đúng `C`.",
          },
          {
            note: "Server phát op đã transform cho người còn lại; cả hai hội tụ về `XAB`.",
            msgs: [{ par: [["ds", "alice", "delete(3)", "ok"], ["ds", "bob", "insert(0,X)", "ok"]] }],
            set: { alice: "\"XAB\" ✓", bob: "\"XAB\" ✓" },
            good: ["alice", "bob"],
            lesson: "Operational Transformation: mọi client hội tụ cùng nội dung vì server xếp thứ tự op và điều chỉnh vị trí.",
            detail: "Cả hai **hội tụ** về `\"XAB\"` dù gõ đồng thời. Server phát op cho người còn lại: Alice nhận `delete(3)` (đã transform) và áp lên `\"XABC\"` → `\"XAB\"`; Bob nhận `insert(0,X)` và áp lên `\"AB\"` → `\"XAB\"`. Op của Alice không cần đổi khi tới Bob vì chèn ở vị trí 0 không bị ảnh hưởng bởi phép xoá phía sau. Thực tế client cũng phải transform op đến với các op local chưa được ack, theo cùng quy tắc.",
          },
        ],
      },
      {
        name: "Snapshot & mở doc",
        steps: [
          {
            note: "Ops log chỉ append → doc lâu năm có hàng triệu op. Định kỳ nén thành **snapshot**.",
            msgs: [["ds", "snap", "snapshot @v10000", "ok"]],
            set: { snap: "doc42 @v10000" },
            detail: "Document Service định kỳ (ví dụ mỗi vài nghìn op) ghi trạng thái đầy đủ của doc thành **snapshot @v10000**. Ops log chỉ append, nên doc dùng lâu năm có hàng triệu op; replay từ đầu để dựng lại doc sẽ rất chậm. Ops log được giữ N ngày (ví dụ 30) để xem lịch sử chi tiết; phiên bản cũ hơn khôi phục từ snapshot theo version, nên snapshot vừa là điểm bắt đầu nhanh vừa là mốc lịch sử.",
          },
          {
            note: "Người mới mở doc: tải snapshot gần nhất + các op sau đó.",
            msgs: [
              ["bob", "gw", "open doc42"],
              ["gw", "ds", "load"],
              ["ds", "snap", "GET @v10000"],
              ["ds", "ops", "ops > v10000"],
              ["ds", "bob", "doc @v10042", "ok"],
            ],
            lesson: "Snapshot + replay đoạn op ngắn = mở doc nhanh mà vẫn giữ đủ lịch sử.",
            detail: "Bob nhận doc42 ở **v10042** sau khi server chỉ replay 42 op thay vì 10,042. LB đưa request tới Document Service sở hữu doc; server tải snapshot gần nhất @v10000, đọc các op `> v10000` (42 op) từ Ops log và replay lên snapshot. Doc đang mở sẵn trên server thì đã có trong RAM, không cần tải lại.",
          },
        ],
      },
      {
        name: "Cursor & presence",
        steps: [
          {
            note: "Con trỏ đổi liên tục nhưng **không cần lưu bền** — giữ trong RAM của Document Service.",
            msgs: [["alice", "gw", "cursor @12"], ["gw", "ds", "cursor"]],
            set: { ds: "cursors: Alice@12" },
            detail: "Document Service chỉ cập nhật bảng cursor trong **RAM** (`cursors: Alice@12`) khi Alice gửi `cursor @12` qua WebSocket — không ghi Ops log hay DB. Con trỏ đổi hàng chục lần mỗi giây và chỉ có giá trị tức thời; ghi bền sẽ tốn gấp nhiều lần lượng ghi của nội dung thật mà không đem lại gì.",
          },
          {
            note: "Phát cho người khác cùng doc; mất kết nối thì xoá.",
            msgs: [["ds", "bob", "Alice @12", "ok"]],
            lesson: "Dữ liệu tạm (cursor, presence) để ở memory, tách khỏi luồng ghi bền.",
            detail: "Server phát `Alice @12` cho Bob và những người khác cùng doc để họ thấy con trỏ màu của Alice. Khi WebSocket của Alice đóng (hoặc mất heartbeat), server xoá cursor của cô khỏi RAM và báo mọi người. Document Service chết thì cursor mất theo — không sao, client nối lại và gửi vị trí mới ngay. Tách dữ liệu tạm khỏi luồng ghi bền giữ Ops log gọn và nhanh.",
          },
        ],
      },
    ],
  },
  deep: [
    {
      q: "Xử lý nhiều người sửa cùng lúc?",
      bad: "Khoá cả doc, hoặc last-write-wins toàn bộ doc.",
      good: "Khoá theo đoạn văn.",
      great: "OT với server làm trung tâm xếp thứ tự; CRDT nếu cần offline hoặc không có server trung tâm.",
      why: {
        bad: "Khoá cả doc thì chỉ một người gõ được tại một thời điểm — mất ý nghĩa cộng tác. Last-write-wins trên cả doc thì bản ghi sau xoá sạch thay đổi của người kia.",
        good: "Khoá theo đoạn cho nhiều người sửa các đoạn khác nhau. Nhưng hai người sửa cùng đoạn vẫn chặn nhau, và nối/tách đoạn làm ranh giới khoá thay đổi, xử lý phức tạp.",
        great: "Mọi op được áp dụng, không ai bị chặn, và các bản hội tụ, vì OT biến đổi op dựa trên op đã xảy ra đồng thời (ví dụ chèn ở vị trí 5 dịch thành 6 nếu có người chèn trước đó). Server trung tâm xếp thứ tự toàn cục nên OT đơn giản; CRDT gắn id duy nhất cho từng ký tự nên hội tụ không cần server, hợp với offline.",
      },
    },
    {
      q: "Scale hàng triệu doc?",
      bad: "Một server giữ mọi doc.",
      good: "Nhiều server + pub/sub chuyển op giữa các server.",
      great: "Consistent hashing docId → server (ZooKeeper quản lý membership): người cùng doc về cùng server để OT tại một chỗ.",
      why: {
        bad: "Hàng triệu doc không thể nằm trên một máy, vì một server có giới hạn RAM và kết nối; máy đó còn là single point of failure.",
        good: "Nhiều server chia tải, pub/sub chuyển op giữa các server khi người cùng doc ở server khác nhau. Nhưng OT cần một thứ tự duy nhất cho op của doc — nhiều server cùng nhận op của một doc thì phải phối hợp thứ tự qua mạng, phức tạp và chậm.",
        great: "Server tự xếp thứ tự mà không cần phối hợp, vì consistent hashing map `docId` tới đúng một server nên mọi op của doc đi về một chỗ. Thêm/bớt server chỉ di chuyển một phần doc; ZooKeeper giữ membership để LB và server thống nhất doc nào thuộc server nào.",
      },
    },
    {
      q: "Lưu trữ thế nào?",
      bad: "Ghi đè cả doc mỗi lần gõ.",
      good: "Append ops log.",
      great: "Ops log (Cassandra, partition theo docId) + snapshot định kỳ + compaction.",
      why: {
        bad: "Ghi đè cả doc cho mỗi phím gõ là hàng MB I/O mỗi giây mỗi người (doc có thể vài MB), và mất lịch sử sửa.",
        good: "Append op chỉ ghi vài byte mỗi thay đổi và giữ được lịch sử. Nhưng mở doc phải replay toàn bộ op từ đầu — doc sửa nhiều năm có hàng triệu op nên load rất chậm.",
        great: "Mở doc chỉ cần load snapshot rồi replay số ít op sau nó, vì snapshot định kỳ lưu trạng thái đầy đủ tại một version. Compaction chỉ xoá op đã nằm trong snapshot **và** cũ hơn N ngày, để log không phình vô hạn mà vẫn xem được lịch sử gần đây; mốc lịch sử xa hơn lấy từ snapshot theo version; Cassandra partition theo `docId` cho ghi append nhanh và đọc tuần tự.",
      },
    },
  ],
  sims: ["realtime"],
});
