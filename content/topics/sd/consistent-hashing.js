BK.topic({
  id: "consistent-hashing",
  track: "sd",
  section: "sd-core",
  title: "Consistent Hashing",
  tldr: {
    t: "Đặt server và key lên một hash ring; key thuộc server đầu tiên theo chiều kim đồng hồ. Thêm/bớt server chỉ di chuyển ~1/N key. Production bắt buộc dùng virtual nodes + replication.",
    why: "Thêm server mới chỉ cướp phần key nằm trong đoạn ngay trước nó — trung bình K/N key, các key khác giữ nguyên chỗ — vì vị trí key trên ring không phụ thuộc số server. Virtual node và replication là bắt buộc: với vài server vật lý các đoạn ring rất lệch nhau, và một server chết thì mất toàn bộ đoạn của nó nếu không có bản sao.",
  },
  story: {
    problem: "Với `hash(key) % N`, thêm một server (N từ 4 lên 5) làm khoảng 80% key đổi server. Với cache → gần như toàn bộ cache miss cùng lúc, DB bị dồn tải.",
    idea: "Thêm hay bớt một server chỉ ảnh hưởng đoạn vòng giữa server đó và server liền trước. Cách làm: đặt cả server và key lên cùng một vòng hash cố định, key thuộc server gần nhất theo chiều kim đồng hồ.",
    tradeoff: "Logic routing và vận hành phức tạp hơn modulo: cần thêm virtual node để tải đều và replication để chịu lỗi. Và nó vẫn không giải được hot key.",
  },
  points: [
    {
      t: "**Mục tiêu** — chia dữ liệu ra nhiều server; khi số server thay đổi, phải di chuyển ít dữ liệu nhất.",
      why: "Số key phải đổi chỗ khi scale chính là chi phí mỗi lần thêm/bớt máy, vì di chuyển dữ liệu tốn băng thông, còn với cache thì key chuyển chỗ = cache miss. Consistent hashing đưa chi phí đó từ gần 100% xuống ~1/N.",
    },
    {
      t: "**Data imbalance → Virtual nodes** — mỗi server map thành nhiều virtual node; càng nhiều vnode càng đều (Cassandra hiện mặc định `num_tokens: 16`, dùng kèm thuật toán cấp token cân bằng — https://cassandra.apache.org/doc/latest/cassandra/managing/configuration/cass_yaml_file.html). Lý do: băm trực tiếp server vật lý làm các khoảng trên ring không đều.",
      why: "Vị trí mỗi server trên ring là ngẫu nhiên, nên với 3 server các khoảng có thể chênh nhau vài lần (một server ôm 50% ring). Băm mỗi server thành vài trăm điểm → mỗi server sở hữu nhiều đoạn nhỏ rải khắp ring, theo luật số lớn tổng các đoạn tiến về 1/N. Thêm nữa, khi một server chết, tải của nó rải ra nhiều server thay vì dồn hết vào một láng giềng.",
    },
    {
      t: "**Replication** — key nằm ở server đầu tiên và nhân bản sang RF−1 server **vật lý khác nhau** kế tiếp trên ring (bỏ qua vnode cùng máy) → high availability.",
      why: "Mọi node tự tính được bản sao nằm đâu mà không cần bảng tra cứu, vì key đã có server 「chủ」 xác định trên ring và quy tắc chỉ là đi tiếp theo chiều kim đồng hồ. Server chủ chết thì server kế tiếp vốn đã có bản sao, vừa là chủ mới vừa phục vụ được ngay (dùng vnode thì phải bỏ qua các vnode cùng máy vật lý để bản sao nằm trên máy khác).",
    },
    {
      t: "**Data movement thực tế** — dữ liệu không “teleport”. Cache: server kế tiếp bị cache miss và phải warm up từ DB. Database kiểu Dynamo (Cassandra, Riak — ring xuất phát từ paper Dynamo; dịch vụ DynamoDB không cho thấy ring): tiến trình nền copy dữ liệu sang server mới mà không gián đoạn đọc/ghi.",
      why: "Consistent hashing chỉ trả lời 「key giờ thuộc ai」, dữ liệu vẫn phải chép qua mạng. Với cache, mất bản sao chỉ là miss → server mới cứ rỗng rồi đầy dần từ DB; với DB, dữ liệu là bản gốc → phải stream sang server mới trong nền, trong lúc đó server cũ vẫn phục vụ để không gián đoạn.",
    },
    {
      t: "**Hot key** — consistent hashing chia đều **số key** chứ không chia đều **tần suất truy cập**. Key viral (người nổi tiếng) vẫn làm quá tải 1 server → dùng key salting (`hotkey#0..N`) hoặc local caching.",
      why: "Một key dù nhận 1M request/s vẫn chỉ có một chủ → server đó quá tải trong khi các server khác rảnh, vì ring chỉ quyết định key nằm ở đâu. Key salting biến một key thành N+1 key (`hotkey#0..N`) ở N+1 vị trí khác nhau trên ring, chia tải ra nhiều server; local cache trong app thì chặn hẳn request trước khi tới server.",
    },
  ],
  cards: [
    [
      "Vì sao cần virtual nodes?",
      "Vị trí server vật lý trên ring không đều → server ôm đoạn lớn bị quá tải. Virtual nodes rải mỗi server thành nhiều điểm → phân bố gần đều; khi 1 server chết, tải của nó chia cho nhiều server.",
    ],
    [
      "Consistent hashing có giải được hot key không?",
      "Không. Nó cân bằng số key, không cân bằng traffic. Cần key salting, replicate hot key, local cache.",
    ],
    [
      "Khi thêm 1 server vào ring N server, bao nhiêu key bị di chuyển?",
      "Khoảng K/(N+1) key với N là số server trước khi thêm (chỉ đoạn ring mà server mới nhận), so với gần như toàn bộ khi dùng `hash % N`.",
    ],
  ],
});
