# Nhật ký quyết định

Quyết định sau ghi đè quyết định trước. Khi code hoặc nội dung khác với tài liệu, file này phân xử.

| # | Quyết định | Lý do | Ngày |
|---|---|---|---|
| D1 | `scripts/check.mjs` lấy danh sách file từ các thẻ `<script>` trong `index.html` (bỏ `app.js`), không giữ danh sách riêng. | Một nguồn duy nhất; thêm file vào trang là check tự nạp. Bước 2 (manifest) sẽ chuyển sang đọc `content/manifest.js`. | 2026-11-27 |
| D2 | Trường `key` trong `why.js` / `sim-detail.js` là tiền tố đối chiếu, không hiển thị: check bỏ qua nó khi kiểm tra markup. | `key` bị cắt giữa chừng nên `**` / backtick lẻ là bình thường. | 2026-11-27 |
| D3 | Bước 1: 42 chỗ lệch đều là `key` cũ sau khi nội dung được viết lại; giải thích vẫn đúng ý ở cùng chỉ số. Đã sửa `key` theo chuỗi hiện tại, không sửa giải thích. Đổi tên variant redlock trong `sim-detail.js` theo `diagrams.js`. | Đã đọc từng cặp (gốc, key, why). Không có giải thích nào bị gán nhầm ý. | 2026-11-27 |
| D4 | Registry `BK` đặt trong `content/manifest.js` (file đầu tiên chạy), trùng id thì `throw`. `index.html` chỉ còn một thẻ `<script src="content/manifest.js">` ở cuối `<body>`; manifest chèn mọi file khác (`async = false`), `app.js` luôn là file cuối. `check.mjs` chạy manifest trong vm với `document` giả để lấy cùng danh sách file (thay D1). | Bản thân app.js nạp cuối nên không chứa được registry. Một danh sách nạp duy nhất cho cả trình duyệt lẫn check. | 2026-11-27 |
| D5 | Dạng dữ liệu mới: một ý (`tldr`, `points`, `tips`, `nfr`) là chuỗi, hoặc `{ t, why }` khi có giải thích; dòng bảng là mảng ô, hoặc `{ cells, why }`. `story` nằm trên topic; problem có `hldWhy` và `deep[k].why = { bad, good, great }`; sim có `context`, step có `detail`. | Chuỗi trần khi không có "vì sao" giữ file gọn; app và check chuẩn hoá cả hai dạng bằng một hàm. | 2026-11-27 |
