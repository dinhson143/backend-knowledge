BK.sim({
  id: "hash-ring",
  custom: "ring",
  title: "Hash ring tương tác",
  topics: ["consistent-hashing", "sharding"],
  scenario: "Thêm hoặc xoá server, bật virtual nodes, rồi so số key phải di chuyển với cách `hash % N`.",
});
