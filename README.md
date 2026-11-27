# Backend Knowledge

Xem trực tiếp: **https://dinhson143.github.io/backend-knowledge/**

Lộ trình ôn phỏng vấn Backend theo khung Hello Interview: lộ trình chính 5 giai đoạn System Design (kèm bài luyện có HLD chạy trực tiếp) và các nhánh song song: Nền tảng CS (process, thread, bộ nhớ, mạng), Kỹ năng viết code, Behavioral, Container & Kubernetes, Vận hành production, Low-Level Design, kiến trúc phần mềm và DSA. Mỗi ý có phần "vì sao", mỗi bước mô phỏng có giải thích "chuyện gì xảy ra". Số chủ đề tăng dần theo các đợt viết trong `docs/proposals/product-learning-flow.md`.

## Chạy local

Mở `index.html` bằng trình duyệt — không cần build hay server. Kiểm tra nội dung: `node scripts/check.mjs`.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `index.html`, `styles.css` | Khung trang và giao diện |
| `app.js` | Điều hướng, render trang chủ đề, bài luyện, thuật ngữ |
| `content/manifest.js` | Danh sách file nạp + registry `BK` |
| `content/topics/<track>/<id>.js` | Mỗi chủ đề một file (nội dung + "vì sao") |
| `content/problems/<id>.js` | Mỗi bài System Design một file |
| `content/sims/<id>.js` | Kịch bản mô phỏng |
| `content/svg/` | Sơ đồ SVG tĩnh |
| `content/roadmap.js`, `content/glossary.js`, `content/tracks.js` | Lộ trình, thuật ngữ, track/section |
| `engine/diagrams.js` | Engine mô phỏng |
| `scripts/check.mjs` | Kiểm tra toàn bộ nội dung |

Cách thêm nội dung: `docs/content-system.md` và `content/_TEMPLATE.js`.
