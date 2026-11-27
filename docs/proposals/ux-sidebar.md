# Thiết kế lại sidebar (mục lục)

Nhánh `ux/readability`, 2026-11-27. Phản hồi của người dùng: cột nav bên trái khó nhìn, khó đọc. Hiện có ~60 topic trong 13 giai đoạn, sẽ lên ~170.

## Hiện trạng và vấn đề

| # | Vấn đề | Nguyên nhân |
|---|---|---|
| 1 | Tiêu đề giai đoạn khó đọc | Chữ 12px in hoa, giãn chữ, màu `--muted`: in hoa làm chữ Việt nhiều dấu thành một khối khó nhận mặt chữ |
| 2 | Không thấy phân cấp | Giai đoạn, chặng, topic gần như cùng thụt lề; chặng chỉ khác topic ở cỡ chữ (12px vs 14px) và màu |
| 3 | Tiến độ chỉ là số `3/12` | Không có thanh hay dấu "xong"; phải đọc từng số |
| 4 | Trạng thái chỉ bằng màu | Chấm 8px xanh/rỗng, không có chữ ẩn cho trình đọc màn hình; topic đang xem chỉ đổi nền nhạt |
| 5 | Mỗi lần đổi trang, sidebar mất trạng thái | `setNav` ghi lại `innerHTML`: giai đoạn người dùng tự mở bị gập lại, vị trí cuộn về đầu, topic đang xem có thể nằm ngoài khung nhìn |
| 6 | 170 topic thì tìm bằng mắt rất chậm | Không có cách lọc trong sidebar; ô tìm trên topbar dẫn sang trang kết quả, rời trang đang đọc |

## Các hướng

### A. Cây mục lục kiểu tài liệu (chọn)

```text
[ Lọc chủ đề…            ]
LỘ TRÌNH CHÍNH
 (1) Nền móng                     ▾
     ▓▓▓▓▓░░░░░  4/9
     │ Khung trả lời          2/2
     │  ✓ Khung trả lời 6 bước
     │  ✓ Con số cần nhớ
     │ Giao tiếp & cửa vào    1/3
     │  ▌● Networking          ← đang xem
     │   ○ API design
 (2) Scale dữ liệu   ▓▓░░░░  2/7  ▸
 ...
NHÁNH SONG SONG
 (∥) Nền tảng CS     ░░░░░░  0/7  ▸
```

- Giai đoạn: dòng `<summary>` có huy hiệu số (đặc khi xong), tiêu đề chữ thường 15px đậm, thanh tiến độ mảnh + `d/n`. Gập/mở bằng `<details>`.
- Chặng: nhãn 13px đậm vừa, màu chữ chính (không in hoa), kèm `d/n` của chặng; topic của chặng thụt vào, có đường kẻ dọc dẫn hướng.
- Topic: 15px, xuống dòng được (không cắt `…`), biểu tượng ✓ / ○ + chữ ẩn "đã nắm" (chỉ đọc cho mục đã nắm, để danh sách 170 mục không lặp "chưa nắm"); đang xem: thanh accent bên trái + nền + chữ đậm + `aria-current="page"`.
- Ô lọc ở đầu (dính khi cuộn): lọc theo tiêu đề topic và tên chặng, không phân biệt dấu (gõ `bo nho` khớp "bộ nhớ"); khi lọc thì mở mọi giai đoạn có kết quả, ẩn phần không khớp, đọc số kết quả qua vùng live; Esc xoá lọc.
- Giữ trạng thái khi đổi trang: giai đoạn người dùng đã mở/gập, chữ đang lọc; cuộn topic đang xem vào giữa khung sidebar (chỉ cuộn sidebar, không cuộn trang).
- **Ưu:** thấy cả cấu trúc lẫn tiến độ trong một cột; ít đổi hành vi so với hiện tại (vẫn `<details>`, vẫn mở giai đoạn đang xem); bàn phím và trình đọc màn hình dùng phần tử gốc. **Nhược:** giai đoạn lớn (30+ topic) mở ra vẫn dài — ô lọc và việc chỉ mở một giai đoạn mặc định bù lại.

### B. Đi sâu từng cấp (drill-down)

Cấp 1 là danh sách 13 giai đoạn kèm tiến độ; bấm một giai đoạn thì sidebar thay bằng danh sách chặng/topic của nó, có nút "← Tất cả giai đoạn".

- **Ưu:** mỗi màn ngắn, chữ có thể to hơn; hợp drawer mobile.
- **Nhược:** mất cái nhìn toàn cục; thêm một lần bấm để sang giai đoạn khác; phải tự làm quản lý focus khi đổi cấp (không có phần tử gốc nào làm sẵn); khác hẳn trang chủ (vốn là cây gập/mở), người học phải học hai mô hình.

### C. Thanh tiến độ + chỉ chặng hiện tại

Sidebar chỉ liệt kê giai đoạn (một dòng mỗi giai đoạn, có thanh tiến độ); giai đoạn đang xem mở ra **chặng đang xem** với các topic, các chặng khác chỉ một dòng tiêu đề + `d/n`.

- **Ưu:** ngắn nhất, kể cả khi 170 topic; tập trung vào chỗ đang học.
- **Nhược:** muốn xem topic của chặng khác phải bấm mở thêm một cấp (gập lồng hai tầng); trên trang Mô phỏng/Thuật ngữ (không có topic đang xem) gần như không có gì để nhìn; hai tầng `<details>` lồng nhau khó dùng bằng bàn phím hơn.

## Chọn A

A giữ được điều người học cần nhất ở sidebar: biết mình đang ở đâu trong cả lộ trình và còn bao nhiêu. Vấn đề "khó đọc" chủ yếu đến từ kiểu chữ (in hoa, nhỏ, nhạt) và phân cấp yếu, không đến từ việc có quá nhiều dòng; số dòng tăng (170 topic) thì xử lý bằng ô lọc và chỉ mở sẵn một giai đoạn. B và C giải bài toán độ dài nhưng đổi lại phải thêm cấp bấm và tự quản lý focus. Quyết định ghi ở D90.

Sidebar trang Luyện bài (`sideProblems`) dùng cùng kiểu: ba mức như ba "giai đoạn" (không gập, vì chỉ 13 bài), bài đã luyện có ✓.

## Kiểm tra

Desktop 1440px và drawer 375px, sáng/tối; Tab qua ô lọc → giai đoạn → topic; Esc trong ô lọc; trình đọc màn hình: tên giai đoạn kèm "d trên n đã nắm", topic đã nắm kèm "đã nắm", topic đang xem có `aria-current`.
