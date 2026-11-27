# Review UI/UX — giai đoạn 1

Nhánh `ux/review` (từ `8eee891`). Xem trên Chrome qua `python -m http.server`: desktop 1490px, iframe 1000px và 375px, chế độ sáng và tối. Tương phản đo bằng công thức WCAG 2.x trên các token màu trong `styles.css`.

Mức độ: **cao** = chặn việc dùng hoặc trượt WCAG AA ở thành phần chính; **vừa** = khó dùng, trượt AA ở chỗ phụ, hoặc a11y thiếu rõ ràng; **thấp** = đánh bóng.

## Phát hiện

| # | Trang | Mức | Mô tả | Cách sửa | Đã sửa |
|---|---|---|---|---|---|
| 1 | Mọi trang (tối) | cao | Nút chính (`.btn.primary`: "▶ Chạy", "Đánh dấu đã nắm") là chữ trắng trên `#7aa2ff`: tương phản 2.49:1. Số giai đoạn đã xong (`.rm-num`) trắng trên `#5fd3a3`: 1.85:1. Chấm `.cw-dot.on` cũng vậy. | Thêm token `--on-accent` (sáng: `#fff`, tối: `#111`) cho chữ trên nền màu. | đã sửa (tương phản) |
| 2 | Bài luyện, nhãn "Đính chính" (sáng) | vừa | `--err` trên `--err-soft` 4.29:1 (nhãn "Nâng cao" 12px), `--fix` trên `--fix-soft` 4.47:1 (nhãn "Trung bình", "Đính chính" 11px). Trượt AA 4.5:1. | Làm đậm `--fix` và `--err` ở theme sáng. | đã sửa (tương phản) |
| 3 | Mọi trang | vừa | Viền `--border` trên nền chỉ 1.3:1: ô tìm kiếm, ô lọc thuật ngữ và chấm tiến độ chưa xong (`.sb-dot`) gần như không thấy. WCAG 1.4.11 cần 3:1 cho viền điều khiển. | Thêm token `--border-strong` cho viền ô nhập và chấm tiến độ. | đã sửa (tương phản) |
| 4 | Topbar 861–1200px | cao | Brand + 5 tab + ô tìm (240px cố định) rộng ~1080px: ở 1000px trang cuộn ngang, ô tìm kiếm và nút ◐ bị đẩy ra ngoài màn hình. | Ẩn phụ đề brand dưới 1200px, cho ô tìm co giãn (`flex: 0 1 240px; min-width: 120px`). | đã sửa (topbar) |
| 5 | Topbar 375px | vừa | Ba hàng (logo, tab, tìm kiếm) dính trên cùng, chiếm ~160/720px chiều cao khi đọc. Tab "Thuật ngữ" bị che sau thanh cuộn ngang. | Ở màn hẹp: topbar không dính; tab tự xuống dòng thay vì cuộn ngang. **Đánh đổi:** trên trang dài, ☰, tab, ô tìm và ◐ chỉ với tới khi cuộn lên đầu — xem "Gửi Product". | đã sửa (topbar) |
| 6 | Topbar | vừa | `<nav role="tablist">` chứa link thường: sai ngữ nghĩa ARIA (không có `tab`/`tabpanel`). Tab đang chọn không báo cho trình đọc màn hình. Ô tìm kiếm không có nhãn. | Bỏ `role`, thêm `aria-label` cho nav, `aria-current="page"` cho tab đang chọn; `aria-label` cho ô tìm và ô lọc. | đã sửa (topbar) |
| 7 | Sidebar mobile | vừa | Khi đóng, sidebar chỉ bị dịch ra ngoài màn hình: ~50 link vẫn nằm trong thứ tự Tab. Khi mở: không có nền tối, phủ luôn nút ☰ nên không đóng được bằng nút đó; Esc không đóng. Nút ☰ không có `aria-expanded`. | `visibility: hidden` khi đóng; nền mờ bằng `box-shadow` (bấm ra ngoài sidebar → đóng; `main` tạm `pointer-events: none` để không bấm nhầm link bên dưới); Esc đóng; `aria-expanded`/`aria-controls`. | đã sửa (focus, sidebar, tooltip) |
| 8 | Mọi trang | vừa | Không có style `:focus-visible` riêng; `abbr.g:focus` đặt `outline: none` (chỉ đổi nền nhạt). Vòng focus mặc định khó thấy trên nền tối và trên chip. | Một luật `:focus-visible` chung dùng `--accent`. | đã sửa (focus, sidebar, tooltip) |
| 9 | Topic, problem | cao | Bấm "Đánh dấu đã nắm" ở cuối trang render lại cả trang và nhảy về đầu trang, mất vị trí đọc và mất focus bàn phím. | Giữ vị trí cuộn và trả focus về nút sau khi render lại. | đã sửa (view) |
| 10 | Mô phỏng (mọi sim) | vừa | Lời dẫn từng bước (`.sim-note`) không phải vùng live: trình đọc màn hình không đọc bước mới. Nút chỉ có ký hiệu (⟲ ◀ ▶\|) không có `aria-label` (vài ⟲ không có cả `title`). Chip variant không báo trạng thái chọn. | `aria-live="polite"` cho `.sim-note`; `aria-label` cho nút ký hiệu; `aria-pressed` cho chip variant. | đã sửa (sim a11y) |
| 11 | Mọi trang | vừa | `document.title` luôn là "Backend Knowledge": tab trình duyệt, lịch sử, bookmark không phân biệt được trang. | Đặt `document.title` theo `h1` sau mỗi lần route. | đã sửa (view) |
| 12 | `#/sim/<id>` | vừa | Trang mô phỏng đơn không có `h1`. | Thêm `h1` (tên sim) — tiêu đề trong hộp sim vẫn giữ. | đã sửa (view) |
| 13 | Tìm kiếm | vừa | Không thấy kết quả chỉ hiện "Không tìm thấy." — không gợi ý làm gì tiếp. Mở thẳng `#/search/x` thì ô tìm trống. | Thêm dòng gợi ý (từ khoá khác, link Thuật ngữ); điền lại ô tìm từ URL. | đã sửa (view) |
| 14 | Mô phỏng, Luyện bài (thẻ) | vừa | Thẻ `<a class="sim-card">` chứa `<abbr tabindex="0">`: phần tử tương tác lồng trong link, Tab dừng bên trong thẻ. | Bỏ tooltip trong tóm tắt của thẻ (giống cách trang tìm kiếm làm). | đã sửa (view) |
| 15 | Mọi trang (tối) | vừa | Tooltip thuật ngữ `#111318` trên nền trang `#141414`: không có viền, gần như hoà vào nền. Không đóng được bằng Esc (WCAG 1.4.13). | Thêm viền; Esc ẩn tooltip. | đã sửa (focus, sidebar, tooltip) |
| 16 | Topic (desktop) | thấp | Dòng chữ trong panel dài ~115 ký tự ở 1490px (khuyến nghị 60–90). Chữ thân 15px, "Vì sao" 13.5px, tóm tắt thẻ 13px — hơi nhỏ cho chữ Việt nhiều dấu. | Đề xuất: thân 16px, giới hạn `main` ~920px. Chưa làm vì đổi nhịp toàn site; nên quyết cùng đặc tả luồng mới. | đã sửa (giai đoạn 2, D41) |
| 17 | Sim, sơ đồ SVG (375px) | thấp | Khung sim/sơ đồ rộng tối thiểu 560px rồi cuộn ngang; chữ nhãn SVG còn ~8–9px. | Có chủ ý (D11). Ghi nhận, không đổi. | không sửa |
| 18 | Bài luyện | thấp | Nhãn mức ("Khởi động") lệch dọc so với các chip bên cạnh trong `.prob-meta`. | `vertical-align` / `align-items: center`. | đã sửa (view) |
| 19 | Mọi trang | thấp | Không tôn trọng `prefers-reduced-motion` (transition sidebar, sim chạy animation bằng JS). | CSS tắt transition; animation sim cần sửa engine — để sau. | đã sửa (giai đoạn 2: CSS + engine bỏ gói tin bay) |
| 21 | Kafka consumer group (sim) | vừa | Ô message `.kg-m` chữ trắng 12px trên bảng màu `KC` trong engine: 2.69–4.38:1. | Làm đậm 6 màu `KC` cùng sắc độ (≥4.59:1). | đã sửa (tương phản) |
| 20 | Bảng | thấp | Bảng cuộn ngang (`.table-wrap`) không có dấu hiệu còn cột bên phải. | Đổ bóng mép phải bằng `background-attachment: local` — để sau. | đã sửa (giai đoạn 2) |

## Gửi Product

Các ý về luồng/điều hướng, không tự sửa:

- **Tìm kiếm đẩy một mục lịch sử cho mỗi lần gõ** (mỗi lần debounce đổi `location.hash`): nút Back phải bấm nhiều lần. Đề xuất dùng `history.replaceState` khi đang gõ, chỉ push khi rời ô tìm — cần Product chốt hành vi Back mong muốn.
- **Mỗi từ viết tắt là một điểm dừng Tab** (`abbr tabindex="0"`): một trang topic có hàng chục điểm dừng trước khi tới nút sim. Cần quyết: chỉ lần xuất hiện đầu tiên có thể focus, hay dựa vào hộp "Viết tắt trong bài này".
- **Tab "Kiến thức"** không phải một trang, mà chuyển hướng tới chủ đề chưa học đầu tiên — người dùng không đoán được. Cân nhắc trang tổng quan hoặc đổi nhãn.
- **Sidebar trang Mô phỏng/Thuật ngữ/Tìm kiếm** hiện mục lục chủ đề, không liên quan tới trang đang xem.
- **Nút "Đánh dấu đã nắm"** nằm cuối trang, sau phần Áp dụng; không có cách đánh dấu từ sidebar hay lộ trình.
- **Topbar mobile không còn dính** (mục 5): đọc được nhiều hơn, nhưng muốn đổi trang/tìm phải cuộn lên đầu. Nếu cần điều hướng luôn trong tầm tay, đề xuất thanh dưới cố định hoặc chỉ giữ hàng ☰ + ô tìm dính — tuỳ cấu trúc điều hướng mới.
- **Topbar mobile**: 5 tab + ô tìm chiếm nhiều chỗ; có thể gom Thuật ngữ/Mô phỏng vào sidebar hoặc menu — tuỳ cấu trúc điều hướng mới.
- **Trang chủ trên mobile**: 3 KPI + 2 khối "Cách ôn" đẩy lộ trình xuống dưới ~1,5 màn hình.

## Review đặc tả Product

Đặc tả: `docs/proposals/product-learning-flow.md` trên nhánh `product/learning-flow`, §3.4 (UI flow) và §5 (lộ trình). Review từ góc UI/UX. Số liệu "hiện tại" đo trên `content/roadmap.js` ngày 2026-11-27: không bài nào có topic ngoài lộ trình chính. Theo topic muộn nhất, 4 bài rơi vào GĐ3 cũ (Bitly, Rate Limiter, Top K, Web Crawler) và 9 bài vào GĐ4 cũ (`patterns`).

### Nhóm A

| # | Ý kiến | Ghi chú / điều chỉnh |
|---|---|---|
| A1 | **Đồng ý** | Pager đi trong nhóm: lộ trình chính → `#/problems`, nhánh song song quay về `#/`. Nhãn cuối nhóm phải nói rõ đích đến ("Sang luyện đề →", "Về lộ trình →"), không để trống. |
| A2 | **Đồng ý, thêm một chỗ** | `#/learn` hiện chuyển bằng `location.hash = …` nên tạo một mục lịch sử: bấm Back từ topic quay về `#/learn` rồi bị đẩy tới lại (kẹt Back). Đổi sang `location.replace`. Khi lộ trình chính xong hết mà chưa bài nào đủ nền, trỏ về `#/problems`. |
| A3 | **Đồng ý, điều chỉnh** | (1) **Người mới (ip.done rỗng)**: không bài nào đủ nền, cũng không bài nào chỉ thiếu 1 chủ đề, nên thẻ trang chủ và bộ lọc "Đã đủ nền" sẽ trống với mọi người mới. Fallback: thẻ hiện "Gần đủ nền nhất" là bài thiếu ít chủ đề nhất (tối đa 2 bài, ghi "còn k chủ đề: …"). Bộ lọc trống thì hiện trạng thái rỗng có lời giải thích. (2) Nhãn "Cần k/n" dễ đọc thành "cần k trên n", nên dùng "Còn thiếu k". (3) ✓/○ không được là tín hiệu duy nhất: mỗi chip có chữ ẩn "đã nắm"/"chưa nắm" và khác viền, không chỉ khác màu. (4) Bộ lọc là nhóm nút có `aria-pressed`, trạng thái chỉ trong trang (đồng ý Q5). |
| A4 | **Đồng ý, điều chỉnh** | Nút một chạm chỉ **thêm** vào `done`, không đảo trạng thái (nếu topic đã nắm thì nút chỉ chuyển trang). Nút đánh dấu riêng giữ nguyên hành vi đảo và giữ vị trí cuộn (đã sửa ở mục 9). Khối "Tiếp theo" thay cho `.topic-actions` cũ, không đặt hai nút đánh dấu ở hai chỗ. Ở 375px hai nút xếp dọc, rộng 100%. Phần "Đi tiếp" của mục "Gửi Product" (nút chỉ ở cuối trang) đã giải quyết một phần: nút vẫn ở cuối, nhưng giờ có lý do để ở đó. |
| A5 | **Đồng ý, ghi chú** | Trên roadmap hiện tại, trang chủ hiện 9 bài ở "Kiểm tra chặng" của GĐ4 cũ, ngay trên GĐ5 liệt kê đủ 13 bài, nên bị trùng. Quy ước: giai đoạn `problems: true` không có hàng "Kiểm tra chặng" (nó chính là chỗ luyện). Sau bước 3, GĐ4 cũ gộp vào GĐ5 thì chỗ trùng tự hết. Chấp nhận trùng tạm thời. |
| A6 | **Đồng ý** | Giải quyết mục "Trang chủ trên mobile": thẻ "Tiếp tục" lên đầu, "Cách ôn" và "Nguồn & phạm vi" gập lại. Mỗi giai đoạn là `<details>`; `<summary>` không chứa heading (trình đọc màn hình đọc summary là nút). Tiêu đề giai đoạn là chữ thường trong summary, còn số `d/n` là text thật, không chỉ là thanh. |
| A7 | **Đồng ý** | Sidebar gập theo giai đoạn: mở GĐ chứa topic đang xem, nếu không có thì mở GĐ hiện tại. Mục "Sidebar trang Mô phỏng/Thuật ngữ" **chưa được giải quyết**: đề xuất giữ mục lục (để nhất quán) nhưng gập hết trừ GĐ hiện tại, đúng như A7 cho trường hợp không có topic đang xem. |
| A8 | **Đồng ý, điều chỉnh** | Kết quả thuật ngữ hiện ngay định nghĩa trong kết quả (tên đầy đủ, nghĩa), có link "Mở trong Thuật ngữ" truyền từ khoá **trong bộ nhớ** sang ô lọc, **không thêm route** (đặc tả giữ router). Kèm sửa mục "Gửi Product" về Back: khi đang ở `#/search/…` thì gõ tiếp dùng `location.replace`, chỉ lần đầu vào trang tìm kiếm mới tạo mục lịch sử. |
| A9 | **Đồng ý** | Không có ý kiến thêm. |

### Nhóm B

| # | Ý kiến | Ghi chú |
|---|---|---|
| B0 | **Đồng ý, ưu tiên cao nhất** | Code nhóm A viết lại `viewHome`, `sideKnowledge`, `viewSims` nhưng **không đổi** `stageKeys` và `check.mjs`. Code mới không giả định giai đoạn `problems` không có topic: lộ trình chính lấy `s.topics` của mọi giai đoạn không song song, kể cả giai đoạn có `problems`. |
| B1 | **Đồng ý** | Crumb "GĐ › chặng · i/n" ở 375px phải cắt bằng `text-overflow: ellipsis` trên một dòng, giữ phần "· i/n". `.sb-section` đã có style. |
| B2 | **Đồng ý** | "Làm được: …" đặt ngay dưới H1, cỡ chữ bằng `.lead`. |
| B3 | **Đồng ý** | Dùng lại chip ✓/○ của A3 (cùng component, cùng chữ ẩn cho trình đọc màn hình). |
| B4 | **Đồng ý** | Nhãn "Đào sâu" dạng `.tag` trung tính, không dùng màu cam/đỏ (đã gán nghĩa "Đính chính", "Nâng cao"). |
| B5 | **Đồng ý** | Không cần code. |

### Đối chiếu với mục "Gửi Product"

| Mục đã gửi | Đặc tả | Đề xuất |
|---|---|---|
| Topbar mobile (không dính; 5 tab + ô tìm) | **Chưa giải quyết.** Wireframe 375px chỉ vẽ ☰, brand, ◐, nhưng không mục A/B nào dời tab và ô tìm. | **Câu hỏi cho Product:** trên mobile, dời 5 tab + ô tìm vào drawer ☰ (khi đó có thể cho topbar 1 hàng dính lại)? Chưa làm. |
| Back khi tìm kiếm | Không nhắc | UI tự làm cùng A8 (xem trên). |
| Tab "Kiến thức" chuyển hướng | A2 thu về lộ trình chính | Giữ chuyển hướng nhưng dùng `location.replace` để không kẹt Back. |
| Sidebar trang Mô phỏng/Thuật ngữ | Không nhắc | Gập theo A7 (xem trên). |
| Nút "Đánh dấu đã nắm" chỉ ở cuối | A4 | Đủ cho bước này. |
| Trang chủ mobile | A6 | Đã giải quyết. |
| Mỗi từ viết tắt là một điểm dừng Tab | Không nhắc | Vẫn mở. |

## Giai đoạn 2 — đã triển khai

Nhóm A (A1–A9) và các mục 16, 19, 20, cùng Back khi tìm kiếm. Quyết định: D41–D43. Mỗi cụm một commit, có số A trong tiêu đề commit. Đã kiểm tra:
- **Tương tác** (Back khi gõ tìm kiếm, `#/learn` không kẹt Back, ô lọc Thuật ngữ điền sẵn từ kết quả tìm kiếm, nút "Đã nắm, sang bài tiếp" không đảo trạng thái, nhóm sim, "Dùng trong bài"): bằng script trong iframe cùng origin, chạy Chrome headless.
- **Giao diện**: chụp Chrome headless ở 1440px và khung iframe 375px, sáng và tối, với 4 trạng thái `ip.done`: rỗng, xong GĐ1–2, xong lộ trình chính, xong hết.
- **Mở qua `file://`**: trang topic render đủ (H1, khối Tiếp theo, sim, `document.title`).

Còn lại:
- Trang chủ hiện 9 bài trùng giữa "Kiểm tra chặng" của GĐ4 cũ và GĐ5 (xem A5). Tự hết sau bước 3.
- Các mục B chờ `roadmap.js` mới.

## Chưa kiểm tra được

- Tương tác qua `file://` (iframe file:// khác origin nên script kiểm tra không chạy được; chỉ kiểm tra render).
- Thiết bị cảm ứng thật (tooltip khi chạm, cuộn ngang bảng/sim).
- Đầu ra trình đọc màn hình thật (NVDA/VoiceOver); chỉ kiểm tra thuộc tính ARIA trong DOM.
- Bảng rộng ở 375px (chỉ thấy bảng Thuật ngữ; bảng nhiều cột trong topic chưa mở ở 375px).
- Tra `modern-web-guidance` bị chặn quyền trong phiên này; CSS viết theo hiểu biết sẵn có, chỉ dùng tính năng Baseline lâu đời (`:focus-visible`, `clip-path`, `visibility`).
