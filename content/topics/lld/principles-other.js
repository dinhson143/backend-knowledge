BK.topic({
  id: "principles-other",
  track: "lld",
  section: "lld-principles",
  title: "KISS · DRY · YAGNI · SoC · LoD",
  tldr: {
    t: "Coding mindset (KISS, DRY, YAGNI) chống over-engineering. Architecture & coupling (SoC, LoD) giảm phụ thuộc chéo.",
    why: "KISS, DRY, YAGNI chống viết thừa và lặp → giảm lượng code phải bảo trì. SoC và LoD giới hạn mỗi phần biết bao nhiêu về phần khác → thay đổi nội bộ một module không lan sang module khác.",
  },
  story: {
    problem: "Ba lỗi hay gặp: dev viết plugin system, cache layer và config động cho tính năng chỉ có 2 user; code copy-paste validate email ở 5 chỗ, sửa bug ở 4 chỗ còn sót 1; controller gọi `order.getCustomer().getAddress().getZipCode()` nên đổi model Address là vỡ 30 file.",
    idea: "Giữ code đơn giản nhất mà vẫn đáp ứng yêu cầu hiện tại, gom tri thức về một nơi, và để mỗi module chỉ biết hàng xóm trực tiếp.",
    tradeoff: "Các nguyên tắc kéo ngược nhau: DRY đẩy về trừu tượng hoá, YAGNI/KISS kéo về code cụ thể. LoD thêm nhiều method uỷ quyền (wrapper) chỉ để chuyển tiếp lời gọi.",
  },
  points: [
    {
      t: "**KISS** — Keep It Simple, Stupid: là **mục tiêu** — thiết kế hệ thống đơn giản.",
      why: "Hệ thống đơn giản dễ đọc, dễ debug, ít chỗ cho bug ẩn náu, vì có ít trạng thái và ít đường đi. KISS là đích đến; các nguyên tắc khác là cách đạt tới.",
    },
    {
      t: "**YAGNI** — You Aren't Gonna Need It: là **công cụ hành động** — cắt tính năng chưa cần.",
      why: "Viết trước tính năng “để dành cho tương lai” chỉ thêm code phải bảo trì, vì phần lớn tính năng làm trước không mang lại giá trị như dự kiến (Fowler dẫn số liệu chỉ khoảng ⅓ tính năng cải thiện được chỉ số nó nhắm tới — https://martinfowler.com/bliki/Yagni.html), hoặc tới lúc dùng thì yêu cầu đã khác. YAGNI là hành động cụ thể: gặp ý tưởng “có thể sau này cần” thì cắt.",
    },
    {
      t: "**DRY** — Don't Repeat Yourself: logic lặp ở nhiều chỗ thì gom về một chỗ.",
      why: "Cùng một quy tắc (ví dụ regex email) nằm ở 5 chỗ → đổi quy tắc phải sửa đủ 5 chỗ, sót một là hệ thống xử lý không nhất quán. Gom về một hàm thì chỉ có một nguồn sự thật.",
    },
    {
      t: "**SoC** — Separation of Concerns: mỗi phần lo một trách nhiệm và không biết nội bộ của phần khác.",
      why: "Đổi MySQL sang DynamoDB không phải sửa UI, vì UI không biết DB lưu thế nào và DB không biết UI hiển thị ra sao. Mỗi phần thay đổi độc lập, test độc lập.",
    },
    {
      t: "**LoD** — Law of Demeter: tránh chuỗi gọi xuyên nhiều kiểu object (`order.getCustomer().getAddress().getZipCode()`) vì lộ cấu trúc nội bộ.",
      why: "Controller biết `Order` có `Customer`, `Customer` có `Address` → đổi `Address` thành `List<Address>` làm vỡ controller dù nó chẳng liên quan. Gọi `order.getShippingZip()` thì chỉ `Order` phải sửa.",
    },
    {
      t: "**LoD ngoại lệ** — fluent chain trả về cùng kiểu (`builder.setName(\"John\").setAge(30).build()`) không vi phạm.",
      why: "Fluent chain không vi phạm LoD, vì mỗi lời gọi trả về chính `builder` nên caller không đi sâu vào cấu trúc nội bộ của object nào khác. LoD cấm “nói chuyện với người lạ”, còn ở đây vẫn chỉ nói chuyện với một object.",
    },
    {
      t: "+ DRY quá mức cũng hại: gộp hai đoạn code chỉ “trông giống” nhưng đổi vì lý do khác nhau sẽ tạo coupling sai.",
      why: "**DRY nói về trùng tri thức, không phải trùng chữ.** `validateUserAge()` và `validateProductStock()` hôm nay trông giống nhau nhưng đổi theo hai bộ quy tắc nghiệp vụ khác nhau → gộp lại thì sửa một bên phải thêm cờ `if` cho bên kia.",
    },
  ],
  cards: [
    [
      "KISS và YAGNI khác nhau thế nào?",
      "KISS là mục tiêu (giữ thiết kế đơn giản); YAGNI là hành động (không xây tính năng chưa cần).",
    ],
    [
      "Law of Demeter cấm gì? Ngoại lệ?",
      "Cấm chuỗi gọi xuyên qua nhiều object khác kiểu, làm lộ cấu trúc bên trong. Fluent builder trả về cùng object thì được.",
    ],
  ],
});
