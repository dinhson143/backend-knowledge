// Danh sách file nạp theo thứ tự — nguồn duy nhất. index.html chỉ nạp file này.
// Thêm chủ đề = thêm một file trong content/ + một dòng ở đây. scripts/check.mjs đối chiếu hai bên.
// Thứ tự sim và problem trong danh sách = thứ tự hiển thị (trang Mô phỏng, trong cùng mức bài) — D6.
(function () {
  // Registry: mỗi file nội dung gọi BK.topic / problem / sim / track / section. Trùng id → báo lỗi.
  const BK = (window.BK = { tracks: [], sections: [], topics: [], problems: [], sims: [] });
  const reg = (list, kind) => (x) => {
    if (list.some((y) => y.id === x.id)) throw new Error(`BK: trùng ${kind} id "${x.id}"`);
    list.push(x);
  };
  BK.track = reg(BK.tracks, "track");
  BK.section = reg(BK.sections, "section");
  BK.topic = reg(BK.topics, "topic");
  BK.problem = reg(BK.problems, "problem");
  BK.sim = reg(BK.sims, "sim");

  const FILES = [
    // engine + app luôn nạp cuối
    "app.js",
  ];
  // async = false giữ đúng thứ tự thực thi với script chèn động
  for (const f of FILES) {
    const s = document.createElement("script");
    s.src = f;
    s.async = false;
    document.head.appendChild(s);
  }
})();
