BK.sim({
  id: "kafka-group",
  custom: "kgroup",
  title: "Consumer group & partition (tương tác)",
  topics: ["kafka"],
  scenario: "Producer gửi message có key vào 4 partition. Thêm/bớt consumer để xem rebalance, lag và giới hạn song song.",
});
