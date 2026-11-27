BK.topic({
  id: "bigdata-ds",
  track: "sd",
  section: "sd-deep",
  title: "Cấu trúc dữ liệu xác suất",
  goal: "Đếm, lọc trùng ở quy mô lớn với bộ nhớ nhỏ, chấp nhận sai số",
  needs: ["numbers"],
  tldr: {
    t: "+ Cấu trúc xác suất: đổi một chút sai số lấy bộ nhớ cực nhỏ. Hay xuất hiện ở Web Crawler, Top K, Ad Click, Metrics.",
    why: "Bộ nhớ không tăng theo số phần tử mà chỉ theo sai số chấp nhận được, vì hash phân tán phần tử đều trên một mảng cố định. Crawler, top K, ad click có hàng tỷ phần tử nhưng chấp nhận sai 1% — đúng chỗ cấu trúc xác suất toả sáng.",
  },
  story: {
    problem: "Đếm chính xác số unique visitor của 1 tỷ event cần lưu mọi ID đã thấy: 1 tỷ ID × 16 byte = 16GB RAM cho một counter. Nhân với hàng nghìn trang, hàng nghìn ngày thì không khả thi.",
    idea: "Chỉ lưu dấu vết hash của phần tử trong một cấu trúc kích thước cố định, thay vì lưu từng phần tử. Câu trả lời chỉ gần đúng, nhưng sai số chứng minh và chặn được.",
    tradeoff: "Mất độ chính xác tuyệt đối, và thường không xoá được phần tử hay liệt kê lại phần tử nào đã thấy. Không dùng được khi cần số chính xác (tiền, tồn kho).",
  },
  table: {
    head: ["Cấu trúc", "Trả lời câu hỏi", "Đánh đổi", "Gặp ở bài"],
    rows: [
      {
        cells: [
          "Bloom filter",
          "“Phần tử này **có thể** đã thấy chưa?”",
          "Không có false negative, có false positive; không xoá được",
          "Web Crawler (URL đã crawl), chặn query key không tồn tại (cache penetration)",
        ],
        why: "Thêm phần tử = bật k bit tại k vị trí hash. Phần tử đã thêm thì k bit chắc chắn đều bật → không có false negative; nhưng phần tử khác có thể tình cờ bật đủ k bit đó → false positive. Tắt bit để xoá sẽ làm hỏng phần tử khác dùng chung bit, nên không xoá được (trừ Counting Bloom filter).",
      },
      {
        cells: [
          "Count-Min Sketch",
          "“Phần tử này xuất hiện **khoảng** bao nhiêu lần?”",
          "Chỉ đếm dư, không đếm thiếu; bộ nhớ cố định",
          "YouTube Top K, heavy hitters",
        ],
        why: "Mỗi phần tử tăng một counter ở mỗi hàng (d hàng, mỗi hàng một hash) trong ma trận cố định. Phần tử khác va chạm cùng ô chỉ cộng thêm, không bao giờ trừ, nên lấy min các ô chỉ có thể lớn hơn hoặc bằng số thật. Kích thước ma trận do sai số mong muốn quyết định, không theo số phần tử.",
      },
      {
        cells: [
          "HyperLogLog",
          "“Có **khoảng** bao nhiêu phần tử khác nhau?”",
          "Sai số ~1% với ~12KB cho hàng tỷ phần tử",
          "Unique visitors, DAU (Redis `PFCOUNT`)",
        ],
        why: "Hash đều thì xác suất thấy hash có ≥ k số 0 đầu là 1/2^k, nên số 0 đầu dài nhất cho ước lượng log số phần tử khác nhau. HLL chia ra 16384 register và lấy trung bình điều hoà để giảm phương sai; mỗi register vài bit nên tổng ~12KB, sai số chuẩn ~0.81%, và trùng lặp không làm tăng ước lượng.",
      },
      {
        cells: [
          "Min-heap kích thước K",
          "Top K phần tử lớn nhất",
          "O(n log K), giữ K phần tử",
          "Top K video, trending",
        ],
        why: "Duyệt n phần tử chỉ tốn O(n log K) thời gian và O(K) bộ nhớ, không phải sort toàn bộ O(n log n): heap chỉ giữ K phần tử lớn nhất đã thấy với phần tử nhỏ nhất ở đỉnh; phần tử mới lớn hơn đỉnh thì thay đỉnh, mỗi lần O(log K).",
      },
    ],
  },
  points: [],
  diagrams: [
    {
      src: "content/svg/bigdata-ds-bloom-filter.svg",
      caption: "Bloom filter bật k bit cho mỗi phần tử; chỉ cần một bit bằng 0 là chắc chắn chưa có, còn đủ k bit bằng 1 có thể do phần tử khác bật nên chỉ là “có thể có”.",
      source: "https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/",
    },
    {
      src: "content/svg/bigdata-ds-count-min-sketch.svg",
      caption: "Count-Min Sketch cộng mỗi phần tử vào một ô ở mỗi hàng; va chạm chỉ cộng thêm, nên lấy min của các hàng ra ước lượng chỉ có thể dư, không thiếu — phần tử chưa từng thấy vẫn có thể nhận số dương.",
      source: "https://redis.io/docs/latest/develop/data-types/probabilistic/count-min-sketch/",
    },
  ],
  cards: [
    [
      "Bloom filter có false negative không?",
      "Không. Nó có thể báo nhầm “đã thấy” (false positive) nhưng nếu báo “chưa thấy” thì chắc chắn chưa thấy.",
    ],
    [
      "Đếm unique visitor hàng tỷ lượt với bộ nhớ nhỏ?",
      "HyperLogLog (Redis PFADD/PFCOUNT): ~12KB, sai số ~1%.",
    ],
    [
      "Count-Min Sketch dùng cho bài nào?",
      "Ước lượng tần suất trên stream để tìm heavy hitters / Top K (YouTube Top K) với bộ nhớ cố định.",
    ],
  ],
});
