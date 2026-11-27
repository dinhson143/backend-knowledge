# Review UI/UX — giai đoạn 1

Nhánh `ux/review` (từ `8eee891`). Xem trên Chrome qua `python -m http.server`: desktop 1490px, iframe 1000px và 375px, chế độ sáng và tối. Tương phản đo bằng công thức WCAG 2.x trên các token màu trong `styles.css`.

Mức độ: **cao** = chặn việc dùng hoặc trượt WCAG AA ở thành phần chính; **vừa** = khó dùng, trượt AA ở chỗ phụ, hoặc a11y thiếu rõ ràng; **thấp** = đánh bóng.

## Phát hiện

| # | Trang | Mức | Mô tả | Cách sửa | Đã sửa |
|---|---|---|---|---|---|
| 1 | Mọi trang (tối) | cao | Nút chính (`.btn.primary`: "▶ Chạy", "Đánh dấu đã nắm") là chữ trắng trên `#7aa2ff`: tương phản 2.49:1. Số giai đoạn đã xong (`.rm-num`) trắng trên `#5fd3a3`: 1.85:1. Chấm `.cw-dot.on` cũng vậy. | Thêm token `--on-accent` (sáng: `#fff`, tối: `#111`) cho chữ trên nền màu. | đã sửa (tương phản) |
| 2 | Bài luyện, nhãn "Đính chính" (sáng) | vừa | `--err` trên `--err-soft` 4.29:1 (nhãn "Nâng cao" 12px), `--fix` trên `--fix-soft` 4.47:1 (nhãn "Trung bình", "Đính chính" 11px). Trượt AA 4.5:1. | Làm đậm `--fix` và `--err` ở theme sáng. | đã sửa (tương phản) |
| 3 | Mọi trang | vừa | Viền `--border` trên nền chỉ 1.3:1: ô tìm kiếm, ô lọc thuật ngữ và chấm tiến độ chưa xong (`.sb-dot`) gần như không thấy. WCAG 1.4.11 cần 3:1 cho viền điều khiển. | Thêm token `--border-strong` cho viền ô nhập và chấm tiến độ. | đã sửa (tương phản) |
| 4 | Topbar 861–1180px | cao | Brand + 5 tab + ô tìm (240px cố định) rộng ~1080px: ở 1000px trang cuộn ngang, ô tìm kiếm và nút ◐ bị đẩy ra ngoài màn hình. | Ẩn phụ đề brand dưới 1200px, cho ô tìm co giãn (`flex: 0 1 240px; min-width: 120px`). | đã sửa (topbar) |
| 5 | Topbar 375px | vừa | Ba hàng (logo, tab, tìm kiếm) dính trên cùng, chiếm ~160/720px chiều cao khi đọc. Tab "Thuật ngữ" bị che sau thanh cuộn ngang. | Ở màn hẹp: topbar không dính; tab tự xuống dòng thay vì cuộn ngang. | đã sửa (topbar) |
| 6 | Topbar | vừa | `<nav role="tablist">` chứa link thường: sai ngữ nghĩa ARIA (không có `tab`/`tabpanel`). Tab đang chọn không báo cho trình đọc màn hình. Ô tìm kiếm không có nhãn. | Bỏ `role`, thêm `aria-label` cho nav, `aria-current="page"` cho tab đang chọn; `aria-label` cho ô tìm và ô lọc. | đã sửa (topbar) |
| 7 | Sidebar mobile | vừa | Khi đóng, sidebar chỉ bị dịch ra ngoài màn hình: ~50 link vẫn nằm trong thứ tự Tab. Khi mở: không có nền tối, phủ luôn nút ☰ nên không đóng được bằng nút đó; Esc không đóng. Nút ☰ không có `aria-expanded`. | `visibility: hidden` khi đóng; nền mờ bằng `box-shadow` (bấm vào nền = bấm `main` → đóng); Esc đóng; `aria-expanded`/`aria-controls`. | đã sửa (focus, sidebar, tooltip) |
| 8 | Mọi trang | vừa | Không có style `:focus-visible` riêng; `abbr.g:focus` đặt `outline: none` (chỉ đổi nền nhạt). Vòng focus mặc định khó thấy trên nền tối và trên chip. | Một luật `:focus-visible` chung dùng `--accent`. | đã sửa (focus, sidebar, tooltip) |
| 9 | Topic, problem | cao | Bấm "Đánh dấu đã nắm" ở cuối trang render lại cả trang và nhảy về đầu trang, mất vị trí đọc và mất focus bàn phím. | Giữ vị trí cuộn và trả focus về nút sau khi render lại. | chưa |
| 10 | Mô phỏng (mọi sim) | vừa | Lời dẫn từng bước (`.sim-note`) không phải vùng live: trình đọc màn hình không đọc bước mới. Nút chỉ có ký hiệu (⟲ ◀ ▶\|) không có `aria-label` (vài ⟲ không có cả `title`). Chip variant không báo trạng thái chọn. | `aria-live="polite"` cho `.sim-note`; `aria-label` cho nút ký hiệu; `aria-pressed` cho chip variant. | chưa |
| 11 | Mọi trang | vừa | `document.title` luôn là "Backend Knowledge": tab trình duyệt, lịch sử, bookmark không phân biệt được trang. | Đặt `document.title` theo `h1` sau mỗi lần route. | chưa |
| 12 | `#/sim/<id>` | vừa | Trang mô phỏng đơn không có `h1`. | Thêm `h1` (tên sim) — tiêu đề trong hộp sim vẫn giữ. | chưa |
| 13 | Tìm kiếm | vừa | Không thấy kết quả chỉ hiện "Không tìm thấy." — không gợi ý làm gì tiếp. Mở thẳng `#/search/x` thì ô tìm trống. | Thêm dòng gợi ý (từ khoá khác, link Thuật ngữ); điền lại ô tìm từ URL. | chưa |
| 14 | Mô phỏng, Luyện bài (thẻ) | vừa | Thẻ `<a class="sim-card">` chứa `<abbr tabindex="0">`: phần tử tương tác lồng trong link, Tab dừng bên trong thẻ. | Bỏ tooltip trong tóm tắt của thẻ (giống cách trang tìm kiếm làm). | chưa |
| 15 | Mọi trang (tối) | vừa | Tooltip thuật ngữ `#111318` trên nền trang `#141414`: không có viền, gần như hoà vào nền. Không đóng được bằng Esc (WCAG 1.4.13). | Thêm viền; Esc ẩn tooltip. | đã sửa (focus, sidebar, tooltip) |
| 16 | Topic (desktop) | thấp | Dòng chữ trong panel dài ~115 ký tự ở 1490px (khuyến nghị 60–90). Chữ thân 15px, "Vì sao" 13.5px, tóm tắt thẻ 13px — hơi nhỏ cho chữ Việt nhiều dấu. | Đề xuất: thân 16px, giới hạn `main` ~920px. Chưa làm vì đổi nhịp toàn site; nên quyết cùng đặc tả luồng mới. | chưa |
| 17 | Sim, sơ đồ SVG (375px) | thấp | Khung sim/sơ đồ rộng tối thiểu 560px rồi cuộn ngang; chữ nhãn SVG còn ~8–9px. | Có chủ ý (D11). Ghi nhận, không đổi. | không sửa |
| 18 | Bài luyện | thấp | Nhãn mức ("Khởi động") lệch dọc so với các chip bên cạnh trong `.prob-meta`. | `vertical-align` / `align-items: center`. | chưa |
| 19 | Mọi trang | thấp | Không tôn trọng `prefers-reduced-motion` (transition sidebar, sim chạy animation bằng JS). | CSS tắt transition; animation sim cần sửa engine — để sau. | chưa |
| 20 | Bảng | thấp | Bảng cuộn ngang (`.table-wrap`) không có dấu hiệu còn cột bên phải. | Đổ bóng mép phải bằng `background-attachment: local` — để sau. | chưa |

## Gửi Product

Các ý về luồng/điều hướng, không tự sửa:

- **Tìm kiếm đẩy một mục lịch sử cho mỗi lần gõ** (mỗi lần debounce đổi `location.hash`): nút Back phải bấm nhiều lần. Đề xuất dùng `history.replaceState` khi đang gõ, chỉ push khi rời ô tìm — cần Product chốt hành vi Back mong muốn.
- **Mỗi từ viết tắt là một điểm dừng Tab** (`abbr tabindex="0"`): một trang topic có hàng chục điểm dừng trước khi tới nút sim. Cần quyết: chỉ lần xuất hiện đầu tiên có thể focus, hay dựa vào hộp "Viết tắt trong bài này".
- **Tab "Kiến thức"** không phải một trang, mà chuyển hướng tới chủ đề chưa học đầu tiên — người dùng không đoán được. Cân nhắc trang tổng quan hoặc đổi nhãn.
- **Sidebar trang Mô phỏng/Thuật ngữ/Tìm kiếm** hiện mục lục chủ đề, không liên quan tới trang đang xem.
- **Nút "Đánh dấu đã nắm"** nằm cuối trang, sau phần Áp dụng; không có cách đánh dấu từ sidebar hay lộ trình.
- **Topbar mobile**: 5 tab + ô tìm chiếm nhiều chỗ; có thể gom Thuật ngữ/Mô phỏng vào sidebar hoặc menu — tuỳ cấu trúc điều hướng mới.
- **Trang chủ trên mobile**: 3 KPI + 2 khối "Cách ôn" đẩy lộ trình xuống dưới ~1,5 màn hình.

## Chưa kiểm tra được

- Mở bằng `file://` (extension trình duyệt không mở được file://).
- Thiết bị cảm ứng thật (tooltip khi chạm, cuộn ngang bảng/sim).
- Đầu ra trình đọc màn hình thật (NVDA/VoiceOver); chỉ kiểm tra thuộc tính ARIA trong DOM.
