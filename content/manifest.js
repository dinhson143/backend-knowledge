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
    "content/tracks.js",
    "content/topics/sd/delivery.js",
    "content/topics/sd/networking.js",
    "content/topics/sd/api-design.js",
    "content/topics/sd/data-modeling.js",
    "content/topics/sd/indexing.js",
    "content/topics/sd/caching.js",
    "content/topics/sd/sharding.js",
    "content/topics/sd/consistent-hashing.js",
    "content/topics/sd/cap.js",
    "content/topics/sd/numbers.js",
    "content/topics/sd/core-db.js",
    "content/topics/sd/blob.js",
    "content/topics/sd/search.js",
    "content/topics/sd/queue.js",
    "content/topics/sd/streams.js",
    "content/topics/sd/dist-lock.js",
    "content/topics/sd/dist-cache.js",
    "content/topics/sd/lb-gateway-cdn.js",
    "content/topics/sd/patterns.js",
    "content/topics/sd/kafka.js",
    "content/topics/sd/redis.js",
    "content/topics/sd/tech-cheatsheet.js",
    "content/topics/sd/bigdata-ds.js",
    "content/topics/lld/lld-delivery.js",
    "content/topics/lld/oop-pillars.js",
    "content/topics/lld/solid.js",
    "content/topics/lld/principles-other.js",
    "content/topics/lld/patterns-gof.js",
    "content/topics/lld/concurrency.js",
    "content/topics/lld/lld-problems-list.js",
    "content/topics/cloud/ecs.js",
    "content/topics/cloud/eks.js",
    "content/topics/cloud/ecs-vs-eks.js",
    "content/topics/arch/code-architecture.js",
    "content/topics/arch/system-architecture.js",
    "content/topics/arch/dev-methods.js",
    "content/topics/dsa/bigo.js",
    "content/topics/dsa/ds.js",
    "content/topics/dsa/algo.js",
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
