# Hệ thống quản lý nội dung

Tài liệu này rút từ kinh nghiệm xây một site học khác có quy mô lớn hơn: khoảng 50 track, hơn 1.000 file nội dung, nhiều agent viết song song. Mục tiêu là thêm chủ đề, thư mục và giải thích mà không làm vỡ những phần đã có.

Đọc file này trước khi thêm hoặc dời nội dung. `CLAUDE.md` mô tả code đang chạy thế nào; file này nói nội dung nên được tổ chức ra sao và lộ trình chuyển sang cách đó.

> **Trạng thái (2026-11-27):** lộ trình §5 đã làm xong, bố cục §3 là bố cục đang chạy. Những chỗ code khác với tài liệu này được ghi trong `docs/decisions.md` (D4–D11).

## 1. Vấn đề hiện tại

| Triệu chứng | Nguyên nhân |
|---|---|
| Một chủ đề nằm rải ở 4 file (`data.js`, `why.js`, `diagrams.js`, `sim-detail.js`) | Nội dung chia theo *loại*, không theo *chủ đề* |
| Thêm hoặc xoá một ý làm lệch mọi "Vì sao" phía sau | `WHY`, `PWHY`, `SIM_DETAIL` ghép theo **chỉ số mảng** (`i`, `row`, `s`, `v`) |
| File quá lớn để đọc hay review (`why.js` 280 KB, `sim-detail.js` 190 KB) | Mỗi loại dồn vào một file |
| Không biết mình vừa làm hỏng gì | Không có bước kiểm tra nào ngoài `node --check` |
| Không có chỗ để thêm thư mục | `index.html` liệt kê cứng từng `<script>` |

## 2. Năm nguyên tắc

1. **Một chủ đề = một file**, đặt trong thư mục theo track. Mọi thứ của chủ đề đó (nội dung, vì sao, chi tiết mô phỏng) nằm chung một file. Review một chủ đề thì chỉ mở một file.
2. **Ghép bằng khoá ổn định, không bằng vị trí.** Giải thích đặt ngay cạnh ý nó giải thích (`{ t: "…", why: "…" }`). Khi buộc phải tham chiếu từ xa, dùng `id` chứ không dùng chỉ số mảng.
3. **Luật nội dung phải là code kiểm tra được, không chỉ là văn bản.** Mỗi luật trong file này nên có một dòng kiểm tra trong `scripts/check.mjs`. Luật chỉ ghi bằng lời thì sẽ bị quên.
4. **Id là hợp đồng.** Id nằm trong URL (`#/t/<id>`) và trong tiến độ người học (`localStorage` `ip.done`). Đổi tên id làm hỏng bookmark và mất tiến độ. Chỉ thêm id mới, không đổi tên id cũ. Nếu bắt buộc phải đổi, giữ một bảng alias.
5. **Thêm nội dung không được bắt phải sửa code.** Thêm chủ đề = thêm một file + một dòng trong manifest. Không phải sửa `app.js` hay `index.html`.

## 3. Bố cục đích

```text
index.html            khung trang, chỉ nạp app + loader
styles.css
app.js                router + render, không chứa nội dung
content/
  manifest.js         danh sách file nội dung theo thứ tự nạp (nguồn duy nhất)
  roadmap.js          ROADMAP: giai đoạn → danh sách topic id
  glossary.js
  tracks.js           BK.track / BK.section
  _TEMPLATE.js        mẫu một chủ đề, copy để bắt đầu
  topics/
    sd/               mỗi track một thư mục (id track)
      delivery.js     mỗi chủ đề một file, tên file = topic id
      ...
    kafka/
    redis/
  problems/
    bitly.js          mỗi bài một file: đề, HLD sim, vì sao
  sims/
    cache-aside.js    mọi sim nằm ở đây, kể cả sim chỉ một chủ đề dùng (D8)
  svg/
    kafka-topic-partitions.svg   sơ đồ tĩnh, tham chiếu bằng diagrams: [{ src, caption }]
engine/
  diagrams.js         engine mô phỏng (mountSim), không chứa kịch bản
scripts/
  check.mjs           kiểm tra toàn bộ nội dung (node, không cần thư viện)
docs/
  content-system.md   file này
  decisions.md        nhật ký quyết định
```

Vẫn giữ nguyên tắc **không build**: script vẫn là classic script, chạy bằng cách mở `index.html` trực tiếp.

### Mỗi file tự đăng ký

```js
// content/topics/sd/delivery.js
BK.topic({
  id: "delivery",
  track: "sd",
  section: "sd-framework",
  title: "Khung trả lời 6 bước",
  tldr: { t: "Đi theo thứ tự cố định…", why: "…" },
  points: [
    { t: "**Functional Requirements** — …", why: "…" },
    { t: "+ **Capacity Estimation** — …" },   // why có thể bỏ trống
  ],
  table: {
    head: ["Bước", "Mục tiêu"],
    rows: [{ cells: ["1 · Requirements", "Chốt FR + NFR"], why: "…" }],
  },
  cards: [["Câu hỏi?", "Đáp án."]],
});
```

`BK` là một registry nhỏ đặt trong `content/manifest.js` (D4), gồm `BK.topic`, `BK.problem`, `BK.sim`, `BK.track`, `BK.section`. Mỗi hàm chỉ push vào một mảng và báo lỗi khi trùng id. Thứ tự hiển thị lấy từ `roadmap.js` và trường `section`, không phụ thuộc thứ tự nạp file. Ngoại lệ: thứ tự sim và problem trong manifest là thứ tự hiển thị (D6).

### Manifest và loader (không build)

```js
// content/manifest.js
const FILES = [
  "content/glossary.js",
  "content/topics/sd/delivery.js",
  // …
  "content/roadmap.js",
];
// async = false giữ đúng thứ tự thực thi với script chèn động
for (const f of FILES) {
  const s = document.createElement("script");
  s.src = f;
  s.async = false;
  document.head.appendChild(s);
}
```

`app.js` và `engine/diagrams.js` được nạp cuối cùng qua cùng loader; `index.html` chỉ có một thẻ `<script src="content/manifest.js">`. `scripts/check.mjs` báo lỗi khi có file trong `content/` mà không có trong manifest, và ngược lại.

## 4. Kiểm tra: làm việc này đầu tiên

Trước khi dời bất kỳ nội dung nào, viết `scripts/check.mjs`. Script này nạp các file vào `vm` với `window = {}` rồi kiểm tra. Nó chạy được trên cả bố cục cũ lẫn bố cục mới, nên giữ an toàn cho suốt quá trình chuyển đổi.

| Kiểm tra | Bắt được lỗi gì |
|---|---|
| Id duy nhất cho topic, problem, sim, section | Hai file trùng id, cái sau đè cái trước |
| Mọi tham chiếu đều tồn tại (`ROADMAP.topics`, `related`, `sims`, `topics`) | Link chết, chủ đề rơi vào giai đoạn "Khác" |
| Mọi chủ đề có trong `ROADMAP` | Chủ đề mồ côi |
| *(Đã bỏ ở bước 5 cùng bố cục cũ)* chỉ số của `WHY`/`PWHY`/`SIM_DETAIL` nằm trong phạm vi, **và `key` là tiền tố của chuỗi gốc ở đúng chỉ số đó** | Giải thích bị lệch sau khi chèn hoặc xoá một ý. Trường `key` đã có sẵn, chỉ cần so sánh. |
| Markup inline chỉ có `**…**` và `` `…` ``, không có backtick hay `**` lẻ | Hiển thị vỡ |
| Tiền tố của `points` chỉ là `"+ "`, `"! "` hoặc không có | Badge sai |
| Không có chữ tiếng Việt viết không dấu trong văn bản hiển thị (danh sách từ hay gặp: `khong`, `duoc`, `nguoi`…) | Mất dấu do copy hoặc agent |
| Sim: mọi `msgs[from,to]` đều là node id có thật, `kind` thuộc `req, ok, err, warn` | Mũi tên chỉ vào node không tồn tại |
| Kích thước mỗi file nội dung không quá ~40 KB | Dấu hiệu nên tách chủ đề |
| Manifest khớp với các file trong `content/` | Quên đăng ký file mới |
| File nằm đúng `content/topics/<track>/<id>.js` (problem, sim tương tự); `section` thuộc đúng `track` | File đặt nhầm chỗ, id khác tên file |
| `diagrams[].src` trỏ tới file có thật trong `content/svg/` (so cả hoa/thường); mọi SVG đều được tham chiếu; SVG có `xmlns`, `viewBox`, nền trắng | Ảnh vỡ trên GitHub Pages, SVG mồ côi, sơ đồ chìm trong theme tối |
| `title` của giai đoạn, chặng, track, section, topic, problem, sim không chứa cụm nào ở cột "Không dùng trong nhãn" của `docs/terminology.md` | Nhãn điều hướng dùng bản dịch khó hiểu thay cho key term mà phỏng vấn dùng (D106) |

Chạy `node scripts/check.mjs` sau **mọi** lần sửa nội dung, trước khi commit. Nên đặt nó thành pre-commit hook hoặc bước GitHub Actions trước khi deploy Pages. Script thoát với mã 1 khi có lỗi và in `file:đường-dẫn → lỗi`.

Kinh nghiệm: mỗi lần review phát hiện một loại lỗi mới, thêm một dòng kiểm tra cho loại lỗi đó. Đừng chỉ sửa chỗ hỏng.

## 5. Lộ trình chuyển đổi (mỗi bước một commit, site luôn chạy được)

1. **Viết `scripts/check.mjs`** cho bố cục hiện tại. Sửa hết lỗi nó tìm thấy; với dữ liệu cỡ này, gần như chắc chắn đang có giải thích bị lệch.
2. **Thêm registry `BK` và loader**, nhưng vẫn để các file cũ đổ vào global như hiện tại. `app.js` đọc được từ cả hai nguồn.
3. **Viết một script chuyển đổi chạy một lần** (`scripts/migrate.mjs`). Script đọc `TRACKS` + `WHY` + `SIM_DETAIL`, ghép `why` vào cạnh từng ý theo chỉ số, rồi ghi ra `content/topics/<track>/<id>.js`. Chạy cho **một track**, kiểm tra trên trình duyệt, commit. Sau đó làm các track còn lại.
4. **Làm tương tự cho `problems.js` + `PWHY`** và cho kịch bản sim + `SIM_DETAIL`.
5. Khi các file cũ đã rỗng thì **xoá chúng**, đồng thời xoá nhánh đọc kiểu cũ trong `app.js` và phần kiểm tra chỉ số trong `check.mjs`.
6. **Cập nhật `CLAUDE.md`** để mô tả bố cục mới. Xoá đoạn "Explanations join by array index".

Đừng viết lại `app.js` cùng lúc với việc dời nội dung. Mỗi lần chỉ đổi một thứ.

## 6. Quy trình viết nội dung

- **Bắt đầu từ mẫu**: copy `content/_TEMPLATE.js`. Mẫu ghi chú từng trường: trường nào bắt buộc, trường nào tuỳ chọn, giới hạn độ dài.
- **Chi tiết đúng nằm ở nguồn chính thức** (tài liệu của Kafka, Redis, AWS…). Khi nêu một con số hay một hành vi, ghi URL nguồn ngay trong câu (trong `t`, `why`, `detail`…), vì app chưa có trường `src` riêng để hiển thị (D31). Sơ đồ SVG thì dùng `source` của `diagrams`. Không ghi giá tiền vì giá thay đổi.
- **Một khái niệm, một thuật ngữ.** Chọn một cách gọi và dùng xuyên suốt. Thêm từ viết tắt vào `glossary.js`, không giải thích lại trong từng chủ đề.
- **"Vì sao" nói về cơ chế, không lặp lại ý.** Câu mẫu: "X xảy ra vì Y; nếu không có Y thì Z". Mỗi câu "vì sao" nên trả lời được câu hỏi "nếu bỏ đi thì hỏng gì?".
- **Link, đừng viết lại.** Hai chủ đề cùng cần một ý thì một chủ đề giữ nội dung, chủ đề kia link sang bằng `related`.
- **Thư mục mới = track mới.** Thêm `BK.track({ id, title })`, tạo `content/topics/<id>/`, thêm các giai đoạn vào `roadmap.js`, rồi chạy kiểm tra.
- **Sơ đồ tĩnh = một file SVG.** Khi một hình vẽ cố định giải thích tốt hơn chữ (không cần tương tác như sim), vẽ `content/svg/<tên>.svg` và thêm `diagrams: [{ src, caption, source? }]` vào topic hoặc problem. App hiển thị bằng `<img>` vì `fetch` bị chặn trên `file://`. Ảnh trong `<img>` không nhận theme của trang, nên mỗi SVG tự vẽ nền trắng bo góc và dùng chữ màu tối (D11). Cách vẽ chi tiết ở cuối `content/_TEMPLATE.js`. `check.mjs` báo lỗi khi file không tồn tại, hoặc khi có SVG không ai tham chiếu.

## 7. Quy trình làm việc của dự án

Những thói quen này tốn ít công nhưng tiết kiệm nhiều nhất khi dự án lớn dần:

- **Nhật ký quyết định** `docs/decisions.md`: đánh số D1, D2, … Mỗi dòng ghi quyết định, lý do và ngày. Quyết định sau ghi đè quyết định trước. Khi code hoặc nội dung khác với tài liệu cũ, nhật ký là thứ phân xử.
- **Handoff khi dừng giữa chừng**: viết `docs/handoff-<ngày>.md` (đang ở đâu, việc còn mở, luật đang áp dụng), rồi thêm một dòng "Start here" ở đầu `CLAUDE.md` trỏ tới file đó. Phiên sau, hoặc người sau, đọc file đó trước, không phải lên kế hoạch lại.
- **`CLAUDE.md` là bản đồ, không phải sách hướng dẫn.** Giữ nó ngắn: lệnh, kiến trúc, link ra các tài liệu. Chi tiết thì đặt trong `docs/`. Một `CLAUDE.md` dài hàng trăm dòng sẽ không ai đọc hết, kể cả agent.
- **Commit nhỏ, mỗi commit một việc**, chạy `check.mjs` trước khi commit. Đẩy nhánh làm dở lên remote (`wip/<tên>`) để có bản sao lưu.
- **Làm song song**: mỗi người hoặc agent làm một track trên một nhánh hay git worktree riêng, và giữ một dải số quyết định riêng (ví dụ D100–D109). Nhờ đó các phần việc không xung đột nhau. Sửa các file dùng chung (`roadmap.js`, `glossary.js`, manifest) càng ít càng tốt, và merge `main` trước khi báo xong.
- **Review bằng mắt sau mỗi đợt lớn**: mở site ở màn hình rộng, màn hình 375 px và chế độ tối, đi qua các trang vừa đổi, ghi lại phát hiện vào một file, rồi sửa theo đợt.
- **Riêng tư**: không đưa tên công ty, khách hàng hay tài liệu nội bộ vào nội dung công khai. Nên đặt một lệnh grep cho các từ cấm trong `check.mjs`.
