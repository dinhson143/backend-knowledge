BK.sim({
  id: "k8s-reconcile",
  title: "Reconcile loop: pod chết thì ai dựng lại?",
  topics: ["k8s-core"],
  scenario: "Deployment `web` khai báo `replicas: 3`, selector `app=web`. Service `web` chọn pod theo cùng label. Ba pod đang chạy trên hai node.",
  context: "Không thành phần nào nhận lệnh \"hãy tạo lại pod\". Mỗi **controller** chỉ làm một việc lặp mãi: đọc trạng thái mong muốn (`spec`) và trạng thái thật qua **API server**, thấy lệch thì ghi thay đổi trở lại API server; thành phần khác thấy thay đổi đó và làm phần của mình (https://kubernetes.io/docs/concepts/architecture/controller/). Theo dõi chữ dưới **API server** (số pod mong muốn/đang có), dưới từng **node** (pod đang chạy) và dưới **Service** (danh sách endpoint).",
  h: 380,
  nodes: [
    { id: "api", x: 330, y: 60, label: "API server + etcd", w: 190, s: "web: muốn 3 · có 3" },
    { id: "rs", x: 110, y: 170, label: "ReplicaSet controller", w: 190 },
    { id: "sch", x: 110, y: 300, label: "Scheduler", w: 150 },
    { id: "n1", x: 560, y: 170, label: "Node 1 · kubelet", w: 170, s: "web-a, web-b" },
    { id: "n2", x: 560, y: 300, label: "Node 2 · kubelet", w: 170, s: "web-c" },
    { id: "svc", x: 330, y: 330, label: "Service web", w: 160, s: "endpoint: a, b, c" },
  ],
  links: [["api", "rs"], ["api", "sch"], ["api", "n1"], ["api", "n2"], ["api", "svc"], ["svc", "n1"], ["svc", "n2"]],
  variants: [
    {
      name: "Pod bị xoá",
      steps: [
        {
          note: "Ai đó chạy `kubectl delete pod web-c` (hoặc pod bị evict). Kubelet trên Node 2 dừng container.",
          msgs: [["api", "n2", "xoá web-c", "err"]],
          set: { n2: "(trống)", api: "web: muốn 3 · có 2" },
          bad: ["n2"],
          detail: "Pod là thứ dùng một lần: Kubernetes không \"sửa\" pod cũ mà thay bằng pod mới với tên mới, IP mới (https://kubernetes.io/docs/concepts/workloads/pods/). Kubelet gửi `SIGTERM` cho container, chờ grace period rồi dọn. Lúc này không ai ra lệnh tạo lại pod — và cũng không cần.",
        },
        {
          note: "EndpointSlice controller thấy pod không còn → rút `web-c` khỏi Service.",
          msgs: [["api", "svc", "bỏ endpoint c", "warn"]],
          set: { svc: "endpoint: a, b" },
          detail: "Controller của Service liên tục quét các pod khớp selector và cập nhật EndpointSlice (https://kubernetes.io/docs/concepts/services-networking/service/). kube-proxy trên mỗi node đọc EndpointSlice để cập nhật luật chuyển tiếp, nên traffic mới không còn tới `web-c`.",
        },
        {
          note: "ReplicaSet controller so: muốn 3, đang có 2 → tạo object pod mới `web-d` (chưa có node).",
          msgs: [["api", "rs", "watch: 2/3"], ["rs", "api", "tạo pod web-d", "ok"]],
          set: { api: "web: muốn 3 · có 3 (web-d Pending)" },
          detail: "Controller không chạy container nào. Nó chỉ ghi một object Pod mới vào API server, `nodeName` để trống. Đó là toàn bộ \"tự chữa lành\": một vòng lặp so số lượng pod khớp selector với `replicas`.",
        },
        {
          note: "Scheduler thấy pod chưa có node → chọn Node 2 (đủ CPU/RAM theo `requests`) và ghi `nodeName`.",
          msgs: [["api", "sch", "pod Pending"], ["sch", "api", "bind web-d → Node 2", "ok"]],
          detail: "Scheduler chỉ tìm pod chưa gán node rồi gán (https://kubernetes.io/docs/concepts/overview/components/). Nó lọc node theo `requests`, nodeSelector, taint; không node nào hợp thì pod nằm `Pending` cho tới khi có chỗ.",
        },
        {
          note: "Kubelet trên Node 2 thấy pod được gán cho mình → kéo image qua CRI, chạy container, readiness probe pass.",
          msgs: [["api", "n2", "web-d gán cho bạn"], ["n2", "api", "web-d Running, Ready", "ok"]],
          set: { n2: "web-d · Ready" },
          good: ["n2"],
          detail: "Kubelet watch các pod có `nodeName` là node của nó, gọi container runtime qua CRI để chạy, rồi báo trạng thái ngược lên API server. Pod chỉ được tính `Ready` khi readiness probe pass, nên app khởi động chậm không nhận traffic quá sớm.",
        },
        {
          note: "EndpointSlice cập nhật: Service có lại 3 endpoint.",
          msgs: [["api", "svc", "thêm endpoint d", "ok"], ["svc", "n2", "traffic → web-d", "ok"]],
          set: { svc: "endpoint: a, b, d", api: "web: muốn 3 · có 3" },
          good: ["svc"],
          lesson: "Bốn thành phần, không ai gọi ai: mỗi controller đọc API server, sửa phần lệch của mình, ghi lại. Vì vậy hệ thống tự phục hồi sau mọi kiểu sự cố mà không cần kịch bản cho từng loại.",
          detail: "Client gọi tên DNS của Service nên không biết `web-c` đã thành `web-d`. Cùng một vòng lặp này xử lý pod crash, node chết, scale tay hay deploy bản mới.",
        },
      ],
    },
    {
      name: "Đổi label của pod",
      steps: [
        {
          note: "Để debug, bạn sửa label pod `web-c` thành `app=web-debug`.",
          msgs: [["api", "n2", "label web-c → web-debug", "warn"]],
          set: { n2: "web-c (app=web-debug)" },
          detail: "Pod vẫn chạy bình thường trên Node 2. Nhưng mọi thứ trong Kubernetes nối với nhau bằng **label selector**, không bằng tên, nên đổi label là đổi \"pod này thuộc về ai\".",
        },
        {
          note: "ReplicaSet đếm pod khớp `app=web`: chỉ còn 2 → tạo pod mới.",
          msgs: [["api", "rs", "watch: 2/3"], ["rs", "api", "tạo pod web-d", "ok"]],
          set: { api: "web: muốn 3 · có 2 khớp selector" },
          detail: "ReplicaSet không nhớ \"ba pod của tôi\" theo tên; nó đếm pod khớp selector. `web-c` không còn khớp nên bị coi như không tồn tại và không còn thuộc ReplicaSet nữa.",
        },
        {
          note: "Service cũng rút `web-c`; pod mới được xếp lịch và chạy.",
          msgs: [{ par: [["api", "svc", "bỏ c, thêm d", "warn"], ["api", "n1", "web-d gán cho bạn"]] }],
          set: { svc: "endpoint: a, b, d", n1: "web-a, web-b, web-d" },
          lesson: "Bây giờ có 4 pod chạy, chỉ 3 nhận traffic; `web-c` thành pod mồ côi, không ai quản. Đây là cách cô lập một pod để debug mà không giảm công suất, nhưng nhớ xoá nó sau.",
          detail: "Hai controller độc lập (ReplicaSet và EndpointSlice) cùng dùng label nên cùng phản ứng. Cũng vì vậy không được tạo pod khác có label trùng selector của Deployment: ReplicaSet sẽ đếm cả nó và xoá bớt pod của bạn (https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).",
        },
      ],
    },
  ],
});
