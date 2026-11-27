BK.sim({
  id: "redis-atomic",
  title: "Vì sao dùng INCR và Lua thay vì GET rồi SET",
  topics: ["redis"],
  scenario: "Hai server cùng tăng một counter, sau đó cùng kiểm tra rate limit.",
  context: "Redis xử lý lệnh trên **một thread** nên từng lệnh riêng lẻ là atomic — nhưng chuỗi lệnh client gửi (GET rồi SET) thì không: lệnh của client khác có thể chen vào giữa. Variant 1 cho thấy **lost update** do read-modify-write phía client; variant 2 đẩy phép cộng vào server bằng `INCR`; variant 3 đẩy cả logic nhiều bước vào server bằng **Lua script**. Theo dõi dòng chữ dưới Redis: giá trị counter thật sau mỗi bước so với giá trị đúng.",
  h: 280,
  nodes: [
    { id: "a", x: 100, y: 70, label: "Server A" },
    { id: "b", x: 100, y: 220, label: "Server B" },
    { id: "redis", x: 520, y: 145, label: "Redis", s: "views = 10" },
  ],
  variants: [
    {
      name: "GET rồi SET",
      steps: [
        {
          note: "Hai server cùng đọc counter.",
          msgs: [
            { par: [["a", "redis", "GET views"], ["b", "redis", "GET views"]] },
            { par: [["redis", "a", "10", "ok"], ["redis", "b", "10", "ok"]] },
          ],
          detail: "Server A và B cùng nhận `10` vì cả hai `GET views` đều tới Redis trước bất kỳ lệnh ghi nào. Redis vẫn xử lý tuần tự, nhưng hai lệnh gửi gần như cùng lúc. Mỗi server giờ giữ một bản sao counter **trong bộ nhớ của nó** — bản sao này cũ ngay khi bên kia ghi.",
        },
        {
          note: "Cả hai tính 10 + 1 = 11 trong code.",
          set: { a: "tính 11", b: "tính 11" },
          detail: "Mỗi server tự tính 10 + 1 = 11 trong code ứng dụng — ngoài Redis, Redis không biết gì về phép tính. Khoảng hở giữa GET và SET chỉ vài trăm micro giây tới vài ms (một round-trip mạng), nhưng với hàng nghìn request/giây thì va chạm xảy ra liên tục.",
        },
        {
          note: "Cả hai ghi 11 → **mất một lượt tăng** (lost update).",
          msgs: [["a", "redis", "SET views 11"], ["b", "redis", "SET views 11", "err"]],
          set: { redis: "views = 11 ❌ (đúng là 12)" },
          bad: ["redis"],
          lesson: "Đọc–tính–ghi từ phía client không atomic, dù Redis chạy một thread.",
          detail: "Counter là **11 thay vì 12** — một lượt tăng biến mất. A gửi `SET views 11`, B cũng gửi `SET views 11`, lệnh của B ghi đè lệnh của A bằng chính giá trị đó. Lỗi **im lặng**: cả hai lệnh đều trả OK, không xung đột nào được báo. Lượt view, tồn kho hay số dư lệch dần theo tải; tải càng cao, mất càng nhiều. Redis đơn luồng không cứu được vì vấn đề nằm ở khoảng hở giữa hai lệnh, không phải trong một lệnh. Cách khác ngoài INCR là `WATCH`/`MULTI`/`EXEC` (optimistic lock: EXEC thất bại nếu key bị đổi, client retry).",
        },
      ],
    },
    {
      name: "INCR",
      steps: [
        {
          note: "Dùng **INCR**: phép cộng chạy ngay trên server.",
          msgs: [{ par: [["a", "redis", "INCR views"], ["b", "redis", "INCR views"]] }],
          detail: "A và B cùng gửi `INCR views` — phép \"đọc–cộng–ghi\" nằm trọn trong **một lệnh** chạy trên server. Khác GET/SET, không còn khoảng hở giữa đọc và ghi để lệnh khác chen vào. Client cũng không còn giữ bản sao cũ của counter.",
        },
        {
          note: "Redis chạy tuần tự từng lệnh: 10 → 11 → 12.",
          msgs: [["redis", "a", "11", "ok"], ["redis", "b", "12", "ok"]],
          set: { redis: "views = 12 ✓" },
          good: ["redis"],
          lesson: "Một lệnh Redis là atomic.",
          detail: "Kết quả cuối **12**, đúng. Event loop của Redis xử lý lệnh tới trước (giả sử của A): 10 → 11, trả `11`; rồi lệnh của B: 11 → 12, trả `12`. Mỗi server còn nhận giá trị riêng sau khi tăng, dùng được làm số thứ tự duy nhất. `INCR` chỉ tốn một round-trip, nhanh hơn GET + SET (hai round-trip).",
        },
      ],
    },
    {
      name: "Lua script",
      steps: [
        {
          note: "Rate limit cần nhiều bước: đọc counter, so với limit, tăng, đặt TTL.",
          set: { redis: "rl:u42 = 9 (limit 10)" },
          detail: "Rate limit cho user 42: tối đa 10 request trong cửa sổ, đã dùng 9 — và `INCR` một mình không đủ. Logic cần nhiều bước: đọc `rl:u42`, so với limit, còn thì `INCR`, đặt `EXPIRE` ở lần đầu để cửa sổ tự reset. Bước \"so sánh rồi mới quyết định\" vẫn là check-then-act: A và B cùng GET thấy 9 rồi cùng cho qua → user dùng 11 lần.",
        },
        {
          note: "Gửi cả logic dưới dạng **Lua script**; Redis chạy trọn script, không lệnh nào chen giữa.",
          msgs: [{ par: [["a", "redis", "EVAL rate_limit u42"], ["b", "redis", "EVAL rate_limit u42"]] }],
          detail: "Redis chạy trọn một **Lua script** như một lệnh duy nhất: trong lúc script của A chạy, không lệnh nào khác — kể cả script của B — được thực thi. Mỗi server gửi toàn bộ logic qua `EVAL` (thực tế dùng `EVALSHA` để khỏi gửi lại thân script mỗi lần). Cái giá: script chạy lâu sẽ **chặn toàn bộ Redis**, nên script phải ngắn, không vòng lặp lớn; ở Redis Cluster, mọi key trong script phải cùng hash slot.",
        },
        {
          note: "A tới trước: 9 < 10 → tăng lên 10, cho qua. B chạy sau: 10 ≥ 10 → từ chối.",
          msgs: [["redis", "a", "allowed", "ok"], ["redis", "b", "denied", "err"]],
          set: { redis: "rl:u42 = 10" },
          lesson: "Lua = atomic + một round-trip; dùng cho rate limiter, nhả lock, check-and-set.",
          detail: "Limit được giữ chính xác: A được `allowed`, B bị `denied`. Script của A chạy trước: đọc 9, 9 < 10 nên tăng lên 10. Script của B chạy sau: đọc 10, 10 ≥ 10 nên không tăng. Không có kẽ hở để cả hai cùng thấy 9. Lua cho atomic nhiều bước chỉ với một round-trip — cùng kỹ thuật dùng để nhả lock an toàn (chỉ `DEL` nếu value đúng là token của mình). Redis 7 có thêm **Functions** (`FUNCTION LOAD`, `FCALL`) để quản lý script như thư viện lưu sẵn trên server.",
        },
      ],
    },
  ],
});
