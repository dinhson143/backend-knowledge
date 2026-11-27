# Nhật ký quyết định

Quyết định sau ghi đè quyết định trước. Khi code hoặc nội dung khác với tài liệu, file này phân xử.

| # | Quyết định | Lý do | Ngày |
|---|---|---|---|
| D1 | `scripts/check.mjs` lấy danh sách file từ các thẻ `<script>` trong `index.html` (bỏ `app.js`), không giữ danh sách riêng. | Một nguồn duy nhất; thêm file vào trang là check tự nạp. Bước 2 (manifest) sẽ chuyển sang đọc `content/manifest.js`. | 2026-11-27 |
| D2 | Trường `key` trong `why.js` / `sim-detail.js` là tiền tố đối chiếu, không hiển thị: check bỏ qua nó khi kiểm tra markup. | `key` bị cắt giữa chừng nên `**` / backtick lẻ là bình thường. | 2026-11-27 |
| D3 | Bước 1: 42 chỗ lệch đều là `key` cũ sau khi nội dung được viết lại; giải thích vẫn đúng ý ở cùng chỉ số. Đã sửa `key` theo chuỗi hiện tại, không sửa giải thích. Đổi tên variant redlock trong `sim-detail.js` theo `diagrams.js`. | Đã đọc từng cặp (gốc, key, why). Không có giải thích nào bị gán nhầm ý. | 2026-11-27 |
