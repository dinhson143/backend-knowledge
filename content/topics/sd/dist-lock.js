BK.topic({
  id: "dist-lock",
  track: "sd",
  section: "sd-tech",
  title: "Distributed Lock",
  goal: "Khoá tài nguyên xuyên nhiều máy an toàn với TTL và fencing token",
  needs: ["redis", "cap"],
  tldr: {
    t: "Khoá tài nguyên xuyên nhiều server, thường bằng Redis (`SET key NX PX ttl`) hoặc DB (`SELECT ... FOR UPDATE`). Mọi lock có TTL (kể cả Redlock) không an toàn khi process pause → resource phải kiểm tra fencing token.",
    why: "Chỉ một client thắng, vì `SET key NX PX ttl` chỉ thành công khi key chưa tồn tại và Redis chạy lệnh tuần tự; `FOR UPDATE` thì dựa vào row lock của DB. Mọi lock dựa trên TTL (Redlock hay một node) đều giả định holder xong việc trước khi hết hạn — GC pause hay network delay phá giả định đó, nên resource phải tự kiểm tra bằng **fencing token**.",
  },
  story: {
    problem: "Lock trong process (`mutex`) chỉ có tác dụng trong một server; với 10 instance, hai instance vẫn có thể cùng bán chiếc ghế cuối cùng hoặc cùng chạy một cron job. Cần một nơi chung mà mọi instance hỏi trước khi đụng vào tài nguyên.",
    idea: "Dùng một hệ lưu trữ chung có thao tác atomic (Redis `SET NX`, row lock của DB) làm trọng tài: ai tạo được key trước thì giữ lock. Gắn TTL để lock tự nhả khi holder chết.",
    tradeoff: "TTL tạo cửa sổ nguy hiểm: holder chậm hơn TTL vẫn tưởng mình giữ lock. Mỗi lần lock thêm một round-trip mạng, và trọng tài (Redis/DB) thành điểm phụ thuộc.",
  },
  points: [
    {
      t: "**Database lock** — `SELECT ... FOR UPDATE` trong transaction.",
      why: "Transaction khác đọc `FOR UPDATE` cùng dòng phải chờ tới khi commit/rollback, vì row lock do chính DB quản lý trong transaction. Không cần hạ tầng thêm và lock tự nhả khi connection chết; nhưng phải giữ connection suốt thời gian lock và gây contention nếu giữ lâu.",
    },
    {
      t: "**Redis lock (Redlock)** — lấy lock có TTL trên đa số node Redis.",
      why: "Một node Redis chết thì lock mất, hoặc failover sang replica chưa kịp sync khiến hai client cùng giữ lock. Redlock ghi lock lên N node độc lập (ví dụ 5), chỉ coi là thành công khi đa số (≥3) chấp nhận trong thời gian ngắn hơn TTL → chịu được thiểu số node chết.",
    },
    {
      t: "**Vấn đề** — Server A lấy lock TTL 10s, bị GC pause 11s; lock hết hạn, Server B lấy lock; A tỉnh dậy không biết đã mất lock và vẫn ghi → hai bên cùng ghi, hỏng dữ liệu.",
      why: "Kiểm tra 'tôi còn giữ lock' ở phía client luôn có race — mọi cơ chế lock chỉ dựa trên TTL đều mắc lỗi này. Lock hết hạn theo đồng hồ của Redis, còn A không có cách nào biết mình đã bị pause 11s: từ góc nhìn của A, dòng code tiếp theo chạy ngay sau khi kiểm tra lock.",
    },
    {
      t: "**Fencing token** — số tăng dần cấp mỗi lần acquire; resource từ chối mọi request có token nhỏ hơn token lớn nhất đã thấy.",
      why: "Client không tự biết mình đã mất lock, nên phải chuyển phần kiểm tra sang phía resource. A lấy token 33, B lấy sau nhận token 34 và ghi trước; resource nhớ 34, nên khi A tỉnh dậy gửi token 33 sẽ bị từ chối, dữ liệu không hỏng.",
    },
    {
      t: "+ Dùng cho: giữ ghế tạm thời khi checkout (Ticketmaster), tránh 2 worker xử lý cùng job.",
      why: "Giữ ghế cần lock có TTL: user giữ ghế 10 phút, bỏ ngang thì TTL tự nhả cho người khác mua. Với job, lock theo `job_id` bảo đảm dù nhiều worker cùng thấy job, chỉ một người chạy nó.",
    },
  ],
  cards: [
    [
      "Vì sao Redlock chưa đủ an toàn?",
      "Process pause (GC, network) có thể vượt TTL; lock tự hết hạn và client khác lấy lock trong khi client cũ vẫn tưởng mình đang giữ.",
    ],
    [
      "Fencing token hoạt động thế nào?",
      "Mỗi lần lấy lock, client nhận một số tăng dần; storage ghi nhận token lớn nhất và từ chối mọi request mang token nhỏ hơn.",
    ],
  ],
});
