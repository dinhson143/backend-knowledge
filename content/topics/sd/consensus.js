BK.topic({
  id: "consensus",
  track: "sd",
  section: "sd-core",
  title: "Consensus & Leader Election",
  goal: "Giải thích Raft, lease, fencing và vì sao cluster cần đa số",
  needs: ["replication", "dist-lock"],
  tldr: {
    t: "**Consensus** (đồng thuận): một nhóm node thống nhất **một giá trị** hoặc **một chuỗi lệnh** dù có node chết hay mạng chậm. **Leader election** là trường hợp hay gặp nhất: cả cluster đồng ý ai là leader trong một **term**. Raft và Paxos đạt điều đó bằng **quorum đa số**: quyết định chỉ có hiệu lực khi hơn nửa số node chấp nhận, nên 5 node chịu được 2 node chết.",
    why: "Hai tập đa số bất kỳ của cùng một cluster luôn có ít nhất một node chung. Node chung đó đã thấy quyết định trước và không chấp nhận quyết định trái ngược, nên không thể có hai leader cùng term hay hai giá trị khác nhau cùng được commit. Một nửa (2 trên 4) thì không có tính chất này: hai nửa bị cắt mạng sẽ mỗi bên tự quyết.",
  },
  story: {
    problem: "Replication leader–follower cần biết ai là leader. Nếu mỗi follower tự quyết \"leader im lặng 3 giây thì tôi lên làm leader\", mạng chập chờn sẽ sinh ra hai leader cùng nhận ghi (split brain) và dữ liệu rẽ hai nhánh. Cũng bài toán đó với cron chỉ được chạy ở một máy, hay lock chỉ được một client giữ.",
    idea: "Không node nào tự phong mình: muốn làm leader phải xin phiếu và nhận được phiếu của đa số cho một term mới. Mỗi node chỉ bầu một lần mỗi term, và chỉ bầu cho node có log ít nhất mới bằng mình. Ghi chỉ commit khi đa số đã lưu. Các hệ thống ứng dụng thường không tự cài Raft mà dùng etcd, ZooKeeper, Consul hay Kubernetes Lease làm dịch vụ đồng thuận.",
    tradeoff: "Mỗi lần ghi tốn ít nhất một round-trip tới đa số node, nên consensus chậm hơn ghi một node và không đặt xa nhau quá được. Mất đa số (3 trên 5 node chết, hoặc bị cắt mạng ở phía thiểu số) thì cluster **ngừng nhận ghi**: chọn consistency hơn availability. Thêm node không làm nhanh hơn mà làm chậm đi.",
  },
  table: {
    head: ["Số node", "Quorum (đa số)", "Chịu được node chết", "Ghi chú"],
    rows: [
      ["1", "1", "0", "Không phải cluster"],
      { cells: ["2", "2", "0", "Tệ hơn 1 node: hai máy, không chịu thêm lỗi nào"], why: "Quorum của 2 là 2, nên một node chết là mất đa số. etcd FAQ: thêm node để thành số chẵn không mua thêm khả năng chịu lỗi (https://etcd.io/docs/v3.5/faq/)." },
      ["3", "2", "1", "Mức tối thiểu hay dùng"],
      ["4", "3", "1", "Chịu lỗi như 3 node nhưng ghi chờ nhiều node hơn"],
      { cells: ["5", "3", "2", "Raft paper gọi là cỡ điển hình"], why: "Bài Raft: cluster năm server điển hình chịu được hai server lỗi (https://raft.github.io/raft.pdf). Hai lỗi cho phép một node đang bảo trì và một node hỏng bất ngờ cùng lúc." },
      { cells: ["7", "4", "3", "etcd khuyên không quá 7"], why: "Mỗi node thêm vào là thêm một nơi leader phải gửi log và chờ phản hồi, nên ghi chậm dần trong khi khả năng chịu lỗi chỉ tăng mỗi hai node một lần." },
    ],
  },
  points: [
    {
      t: "**Raft có ba trạng thái**: follower, candidate, leader. Thời gian chia thành **term** đánh số tăng dần; mỗi term có nhiều nhất một leader (Election Safety). Follower không nghe heartbeat trong **election timeout** thì tăng term, thành candidate và xin phiếu; nhận đa số phiếu thì thành leader.",
      why: "Term hoạt động như số hiệu nhiệm kỳ: mọi tin nhắn mang term, node thấy term lớn hơn thì biết mình đã cũ và lùi về follower. Leader cũ bị cô lập rồi quay lại sẽ thấy term mới và tự từ chức, nên không có hai leader cùng **term** chấp nhận ghi.",
    },
    {
      t: "**Election timeout ngẫu nhiên** để tránh chia phiếu: bài Raft lấy ví dụ khoảng 150–300ms và khuyên dùng mức thận trọng như vậy; điều kiện thời gian là `broadcastTime ≪ electionTimeout ≪ MTBF` (https://raft.github.io/raft.pdf). etcd mặc định heartbeat `100ms`, election timeout `1000ms`, và yêu cầu election timeout ít nhất 10 lần RTT (https://etcd.io/docs/v3.5/tuning/).",
      why: "Nếu mọi follower cùng hết giờ một lúc, tất cả cùng ứng cử và chia nhỏ phiếu, không ai đủ đa số, phải bầu lại mãi. Ngẫu nhiên hoá làm một node thường hết giờ trước, thắng và gửi heartbeat trước khi node khác kịp ứng cử. Timeout quá ngắn so với độ trễ mạng thì leader khoẻ vẫn bị coi là chết, sinh bầu cử thừa.",
    },
    {
      t: "**Log replication**: leader nhận lệnh, ghi vào log, gửi cho follower; entry **commit** khi đa số đã lưu, rồi mới áp vào state machine và trả lời client. Mọi node áp cùng chuỗi entry theo cùng thứ tự (State Machine Safety).",
      why: "Commit theo đa số nghĩa là entry đã nằm trên ít nhất một node của **mọi** đa số tương lai, nên leader nào được bầu sau cũng gặp được nó. Áp cùng lệnh theo cùng thứ tự từ cùng trạng thái đầu thì mọi node ra cùng trạng thái: đó là replicated state machine.",
    },
    {
      t: "**Election restriction**: node chỉ bầu cho candidate có log **ít nhất mới bằng** log của mình. Nhờ vậy leader mới luôn có mọi entry đã commit (Leader Completeness).",
      why: "Candidate phải được đa số bầu, và đa số đó chứa ít nhất một node có entry đã commit; node đó từ chối bầu cho candidate thiếu entry. Không có luật này, một node bị lạc lâu ngày có thể thắng cử rồi ghi đè dữ liệu đã hứa với client.",
    },
    {
      t: "**Đọc từ leader chưa chắc là mới nhất**: leader có thể đã bị thay mà chưa biết. Raft xử lý bằng cách leader commit một entry rỗng (no-op) đầu term và trao đổi heartbeat với đa số trước khi trả lời đọc; hoặc dùng **lease** dựa vào thời gian, nhưng cách này giả định độ lệch đồng hồ có giới hạn.",
      why: "Leader bị cắt mạng ở phía thiểu số vẫn tưởng mình là leader và trả dữ liệu cũ, trong khi phía đa số đã bầu leader mới và nhận ghi. Hỏi đa số trước khi đọc xác nhận mình vẫn là leader. Lease nhanh hơn (không cần round-trip) nhưng an toàn chỉ khi đồng hồ không trôi quá mức đã giả định.",
    },
    {
      t: "**Lease + fencing token cho app**: leader election cho service của bạn (một instance chạy scheduler, một instance ghi vào kho) thường dùng lease có TTL trên etcd/ZooKeeper hoặc Kubernetes `Lease`; kube-controller-manager và kube-scheduler dùng chính cơ chế này (https://kubernetes.io/docs/concepts/architecture/leases/). Kèm theo **fencing token** (số tăng theo mỗi lần thắng, như term hay revision của etcd).",
      why: "Consensus đảm bảo **dịch vụ đồng thuận** không có hai người giữ lease cùng lúc, nhưng process giữ lease vẫn có thể bị GC pause qua thời hạn rồi tiếp tục ghi như chưa có gì. Chỉ phía tài nguyên kiểm token mới chặn được lần ghi muộn đó, giống hệt bài toán ở `dist-lock`.",
    },
    {
      t: "**Không tự cài consensus**: dùng thứ đã được kiểm chứng: etcd (Raft) cho Kubernetes, ZooKeeper (ZAB) cho hệ cũ, KRaft cho Kafka mới, Raft trong CockroachDB/TiKV cho từng range dữ liệu. Raft paper công bố đặc tả TLA+ và chứng minh an toàn chính vì chi tiết rất dễ sai.",
      why: "Lỗi consensus chỉ lộ ra khi có tổ hợp hiếm của crash, mạng chậm và thứ tự tin nhắn, nên test thông thường không bắt được. Câu trả lời phỏng vấn tốt là \"dùng etcd/ZooKeeper cho leader election\" kèm hiểu vì sao nó an toàn, không phải tự viết thuật toán bầu cử.",
    },
    {
      t: "**Đổi thành viên cluster phải qua consensus**: Raft dùng joint consensus (cấu hình trung gian gồm cả cũ lẫn mới) để không có lúc nào cấu hình cũ và mới cùng tự quyết.",
      why: "Đổi thẳng từ 3 node sang 5 node thì có khoảnh khắc một số node còn theo cấu hình cũ (đa số = 2), số khác theo cấu hình mới (đa số = 3), và hai đa số rời nhau có thể bầu hai leader. Tài liệu etcd cũng yêu cầu mọi thay đổi thành viên làm tuần tự, từng node một (https://etcd.io/docs/v3.5/op-guide/runtime-configuration/), vì node mới được tính vào quorum ngay cả khi chưa kết nối được.",
    },
  ],
  table2Title: "Consensus dùng ở đâu",
  table2: {
    head: ["Nhu cầu", "Dùng gì", "Vì sao cần consensus"],
    rows: [
      ["Leader election cho service (một instance chạy job)", "Lease trên etcd/ZooKeeper/Kubernetes `Lease` + fencing token", "Không có hai leader cùng lúc theo góc nhìn của kho lease"],
      ["Kho cấu hình, service discovery", "etcd, ZooKeeper, Consul", "Mọi client đọc cùng một phiên bản cấu hình, có watch"],
      ["Metadata của hệ phân tán", "KRaft (Kafka), etcd (Kubernetes)", "Ai là leader partition, pod nào ở node nào phải thống nhất"],
      ["Dữ liệu nghiệp vụ nhất quán mạnh trên nhiều máy", "DB dùng Raft/Paxos cho từng shard (CockroachDB, Spanner, TiKV)", "Mỗi shard là một nhóm Raft; ghi commit khi đa số replica lưu"],
      { cells: ["Đếm like, cache, log", "Không cần", "Chấp nhận eventual consistency rẻ hơn nhiều"], why: "Consensus trả bằng latency ghi và mất availability khi mất đa số; dữ liệu chịu được lệch tạm thời thì dùng replication bất đồng bộ hoặc quorum leaderless." },
    ],
  },
  tips: [
    {
      t: "Khi interviewer hỏi \"làm sao chỉ một instance chạy cron\", trả lời: leader election qua lease trên etcd/ZooKeeper (hoặc Kubernetes Lease), job idempotent, và fencing token nếu job ghi vào kho dùng chung.",
      why: "Ba lớp này phủ cả ba kiểu hỏng: hai instance cùng tưởng mình là leader (lease), leader chết giữa chừng và leader mới chạy lại (idempotent), leader cũ bị pause rồi ghi muộn (fencing).",
    },
    {
      t: "Giải thích \"vì sao số lẻ\" bằng một câu: 4 node chịu lỗi như 3 node nhưng ghi chậm hơn.",
      why: "Đây là câu hỏi kiểm tra bạn hiểu quorum thật hay chỉ thuộc lòng. Nói kèm \"hai đa số luôn giao nhau\" là đủ cho thấy bạn biết vì sao không có split brain.",
    },
    "Nối với CAP: khi bị chia mạng, phía thiểu số của một cluster Raft ngừng nhận ghi; đó là lựa chọn CP có chủ đích.",
  ],
  cards: [
    [
      "Vì sao cluster consensus cần đa số chứ không phải một nửa?",
      "Hai tập đa số bất kỳ luôn có ít nhất một node chung, node đó chặn quyết định trái ngược. Hai nửa (2/4) có thể rời nhau hoàn toàn khi bị cắt mạng → hai bên cùng bầu leader.",
    ],
    [
      "Cluster 5 node chịu được mấy node chết? 6 node thì sao?",
      "5 node: đa số 3, chịu 2. 6 node: đa số 4, vẫn chỉ chịu 2, mà ghi chờ thêm một node.",
    ],
    [
      "Vì sao Raft dùng election timeout ngẫu nhiên?",
      "Để các follower không cùng hết giờ và cùng ứng cử, chia phiếu mà không ai đủ đa số. Ngẫu nhiên làm một node thường đi trước và thắng.",
    ],
    [
      "Leader election bằng etcd lease có cần fencing token không?",
      "Có, nếu leader ghi vào tài nguyên dùng chung. Lease bảo đảm kho không cấp cho hai người cùng lúc, nhưng leader cũ bị pause vẫn có thể ghi muộn; tài nguyên kiểm token (revision/term) để từ chối.",
    ],
    [
      "Leader Raft bị cắt khỏi đa số, client vẫn gọi được tới nó. Chuyện gì xảy ra?",
      "Ghi không commit được vì không đủ đa số xác nhận. Đọc có thể trả dữ liệu cũ nếu leader trả lời mà không hỏi đa số; Raft yêu cầu trao đổi heartbeat với đa số trước khi trả lời đọc.",
    ],
    [
      "Consensus và replication bất đồng bộ khác gì về mất dữ liệu khi leader chết?",
      "Consensus chỉ báo thành công khi đa số đã lưu, và leader mới luôn có entry đó: không mất ghi đã xác nhận. Replication bất đồng bộ báo thành công trước khi follower nhận, failover có thể mất phần chưa gửi.",
    ],
  ],
  related: ["redlock", "cap"],
});
