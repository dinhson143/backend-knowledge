// Mẫu một chủ đề. Copy thành content/topics/<track>/<id>.js (tên file = id), thêm một dòng vào
// FILES trong content/manifest.js, thêm id vào một chặng (`parts`) trong content/roadmap.js, rồi chạy
// `node scripts/check.mjs`. File này KHÔNG nằm trong manifest nên không được nạp.
//
// Luật chung (check.mjs kiểm tra):
//   - id là hợp đồng (URL #/t/<id>, tiến độ ip.done): không đổi tên id đã phát hành.
//   - Markup inline chỉ có **đậm** và `code`; tiếng Việt đủ dấu.
//   - Một ý là chuỗi, hoặc { t, why } khi có "vì sao". Dòng bảng là mảng ô, hoặc { cells, why }.
//   - "Vì sao" nói về cơ chế: "X xảy ra vì Y; nếu không có Y thì Z".
//   - Mỗi file nội dung ≤ ~40 KB; lớn hơn thì tách chủ đề.
//   - Số liệu / hành vi lấy từ tài liệu chính thức, ghi URL nguồn. Không ghi giá.
BK.topic({
  id: "vi-du-chu-de",                 // bắt buộc · chữ thường, gạch ngang
  track: "sd",                        // bắt buộc · id track trong content/tracks.js = tên thư mục
  section: "sd-core",                 // bắt buộc · id section thuộc track đó (content/tracks.js)
  title: "Tên chủ đề",                // bắt buộc · ≤ 40 ký tự, hiện ở sidebar và lộ trình (quy ước: product-learning-flow §3.3)
  goal: "Động từ + làm được gì",      // tuỳ chọn · ≤ 90 ký tự, khác title; hiện "Làm được: …"
  needs: ["id-topic-khac"],           // tuỳ chọn · ≤ 3 tiên quyết trực tiếp, không vòng; cùng nhánh thì phải đứng trước
  tldr: {                             // bắt buộc · "Nói trong 30 giây", 1–3 câu
    t: "Tóm tắt điều phải nhớ.",
    why: "Vì sao điều đó đúng (tuỳ chọn).",
  },
  story: {                            // tuỳ chọn · mục "Vì sao cần biết", đủ cả 3 trường
    problem: "Không có nó thì hỏng gì.",
    idea: "Ý tưởng cốt lõi.",
    tradeoff: "Phải trả giá gì.",
  },
  diagrams: [                         // tuỳ chọn · sơ đồ SVG tĩnh, hiện trong mục "Hình dung"
    {
      src: "content/svg/vi-du.svg",   // file trong content/svg/, tên chữ thường-gạch-ngang
      caption: "Một câu nói sơ đồ cho thấy gì (cũng là alt của ảnh).",
      source: "https://…",            // tuỳ chọn · URL tài liệu chính thức
    },
  ],
  table: {                            // tuỳ chọn · bảng chính
    head: ["Cột 1", "Cột 2"],
    rows: [
      ["Ô", "Ô"],
      { cells: ["Ô", "Ô"], why: "Vì sao dòng này (tuỳ chọn)." },
    ],
  },
  points: [                           // tuỳ chọn · tiền tố "+ " = Bổ sung, "! " = Đính chính, không có = gốc Miro
    "Một ý không cần giải thích.",
    { t: "+ Ý bổ sung.", why: "Vì sao." },
  ],
  table2Title: "Chi tiết",            // tuỳ chọn · tiêu đề cho table2
  table2: { head: ["A", "B"], rows: [["…", "…"]] },
  sections: [                         // tuỳ chọn · các mục phụ, mỗi mục có points và/hoặc table
    { title: "Mục phụ", points: ["…"], table: { head: ["A"], rows: [["…"]] } },
  ],
  tips: ["Mẹo khi phỏng vấn.", { t: "Mẹo có vì sao.", why: "…" }],   // tuỳ chọn
  cards: [["Câu hỏi tự kiểm tra?", "Đáp án."]],                     // tuỳ chọn · mục "Tự kiểm tra"
  related: ["cache-aside"],           // tuỳ chọn · id sim (content/sims/) hiện ở "Mô phỏng liên quan"
});

// ── Thêm sơ đồ SVG mới ──
// 1. Vẽ file content/svg/<tên>.svg: thẻ <svg> có xmlns="http://www.w3.org/2000/svg" và viewBox;
//    phần tử đầu tiên là nền trắng bo góc <rect … rx="14" fill="#ffffff"/>, chữ màu tối, có <title>.
//    Ảnh nằm trong <img> nên không nhận theme của trang — nền trắng giúp đọc được ở cả hai theme (D11).
// 2. Thêm { src, caption, source? } vào diagrams của topic (hoặc problem — hiện ở mục HLD).
// 3. `node scripts/check.mjs`: báo lỗi nếu file không tồn tại, hoặc có SVG không ai tham chiếu.
//
// ── Problem và sim ──
// Problem: content/problems/<id>.js gọi BK.problem({ id, level, title, hi, summary, topics, fr, nfr, capacity,
//   entities, api, hldWhy, hld: { …sim flow… }, deep: [{ q, bad, good, great, why?: { bad, good, great } }], sims }).
// Sim: content/sims/<id>.js gọi BK.sim({ id, title, topics, scenario, context?, nodes, steps: [{ note, msgs, detail? }] }).
//   Trường của step: xem chú thích đầu engine/diagrams.js. Thứ tự trong manifest = thứ tự hiển thị (D6).
