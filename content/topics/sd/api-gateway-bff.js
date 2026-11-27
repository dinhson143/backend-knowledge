BK.topic({
  id: "api-gateway-bff",
  track: "sd",
  section: "sd-core",
  title: "API Gateway, BFF & API Composition",
  goal: "Thiết kế cửa vào cho client: routing, gom lời gọi, BFF riêng và phần việc đẩy lên gateway",
  needs: ["lb-gateway-cdn", "auth", "service-discovery"],
  tldr: {
    t: "**API Gateway** là cửa vào duy nhất của client vào hệ nhiều service. Nó làm ba việc: **routing** (đưa request tới đúng service), **offloading** (gánh việc chung: TLS, kiểm token, rate limit, log) và **aggregation / API composition** (gọi nhiều service rồi ghép thành một response). **BFF** (Backend for Frontend) là biến thể: mỗi loại client (web, mobile) có một gateway riêng, do team làm client đó sở hữu. Gateway không chứa business logic.",
    why: "Service tách theo nghiệp vụ nên API của chúng \"often different than what a client needs\", và client không nên biết hệ được chia thành bao nhiêu service hay instance đang ở đâu (https://microservices.io/patterns/apigateway.html). Không có lớp này thì client phải tự gọi 5 service, tự xử lý từng kiểu lỗi, và mỗi lần tách hay gộp service là phải phát hành lại app.",
  },
  story: {
    problem: "Màn hình \"Chi tiết đơn hàng\" của app mobile cần dữ liệu từ Order, Shipping, Payment và Review. App gọi thẳng 4 service qua mạng 4G: 4 lần round-trip, 4 chỗ có thể lỗi, mỗi service một kiểu auth và định dạng. Team web cần cùng dữ liệu nhưng nhiều trường hơn, nên backend chung bị sửa liên tục cho cả hai và hai team phải chờ nhau.",
    idea: "Đặt một gateway phía trước: client gửi một request, gateway kiểm token, rate limit, gọi các service **đồng thời**, ghép kết quả và trả một response vừa đúng thứ màn hình cần. Khi web và mobile cần khác nhau nhiều, tách thành hai BFF, mỗi team tự sửa BFF của mình theo nhịp phát hành của client.",
    tradeoff: "Gateway là thêm một thành phần phải phát triển, deploy, scale và giữ HA; thêm một hop latency; và dễ bị nhồi logic nghiệp vụ cho tới khi thành một monolith mới. BFF kéo theo code trùng giữa các BFF và thêm service phải vận hành.",
  },
  table: {
    head: ["Việc", "Gateway làm gì", "Rủi ro cần nói"],
    rows: [
      {
        cells: ["Routing", "Map path/host tới service; client chỉ biết một domain", "Đổi route phải đồng bộ với service; gateway phải tra service discovery"],
        why: "Richardson: gateway \"Insulates the clients from how the application is partitioned into microservices\" và client không phải tự tìm vị trí instance (https://microservices.io/patterns/apigateway.html). Tách hay gộp service chỉ đổi cấu hình route, không đổi app.",
      },
      {
        cells: ["Offloading", "TLS termination, kiểm token, rate limiting, log, metric, dịch giao thức", "Không bao giờ đẩy business logic lên gateway; gateway là mục tiêu tấn công giá trị cao"],
        why: "Azure Gateway Offloading: gom các việc chung để không phải cài lại ở mỗi service, nhưng \"Never offload business logic to the gateway\", và vì gateway gom auth, TLS nên \"A compromise of the gateway can expose all downstream services\" (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading).",
      },
      {
        cells: ["Aggregation / API composition", "Gọi nhiều service (đồng thời), ghép kết quả thành một response", "Một service chậm kéo cả response; join trong bộ nhớ trên tập dữ liệu lớn"],
        why: "Azure Gateway Aggregation giảm số round-trip của client qua mạng di động có latency cao (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation). Richardson ghi nhược điểm của API composition: \"Some queries would result in inefficient, in-memory joins of large datasets\" (https://microservices.io/patterns/data/api-composition.html).",
      },
      {
        cells: ["BFF", "Một gateway/backend cho mỗi loại trải nghiệm (web, mobile, đối tác)", "Code trùng giữa các BFF; thêm service phải vận hành"],
        why: "Richardson mô tả BFF là biến thể \"defines a separate API gateway for each kind of client\" (https://microservices.io/patterns/apigateway.html). Azure ghi \"Code duplication is a probable outcome of this pattern\" và khuyên cân nhắc trùng code với trải nghiệm vừa khít từng client (https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends).",
      },
    ],
  },
  points: [
    {
      t: "**Vì sao cần gateway**: API của service hạt mịn hơn thứ client cần, mỗi loại client cần dữ liệu khác nhau, mạng di động chậm nên chỉ gọi được ít request, vị trí instance đổi liên tục, và service nội bộ có thể dùng giao thức không thân thiện với web (ví dụ gRPC).",
      why: "Đây là các \"forces\" Richardson liệt kê cho pattern API gateway (https://microservices.io/patterns/apigateway.html). Mỗi force là một lý do client không nên gọi thẳng service: gọi thẳng thì client gánh discovery, ghép dữ liệu, và bị phá mỗi khi ranh giới service đổi.",
    },
    {
      t: "**Kiểm token ở gateway, kiểm quyền từng tài nguyên ở service.** Gateway trả lời \"token này hợp lệ, có scope gọi API đơn hàng không\"; service Order trả lời \"đơn 123 có thuộc user này không\".",
      why: "Gateway không biết quan hệ dữ liệu, nên chỉ kiểm ở gateway là lỗi IDOR (chi tiết ở bài `auth`). Azure còn nhắc phải quyết định service xác thực ai (user gốc, gateway, hay cả hai), luôn xác thực gateway với backend riêng, và \"Don't treat unverified forwarded headers as proof of identity\" (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading).",
    },
    {
      t: "**Chặn đường vòng qua gateway**: backend chỉ nhận request đi qua gateway (network policy, mTLS, private subnet).",
      why: "Nếu service vẫn mở ra ngoài thì client gọi thẳng và bỏ qua mọi thứ gateway làm: auth, rate limit, log. Azure liệt kê \"Gateway bypass prevention\" thành một điểm riêng vì lý do này (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading).",
    },
    {
      t: "**API composition: gọi đồng thời, đặt timeout cho từng lời gọi, và quyết định trước** phần nào bắt buộc (thiếu thì trả lỗi) và phần nào tuỳ chọn (thiếu thì trả response một phần).",
      why: "Gọi nối tiếp thì latency cộng dồn; gọi đồng thời thì latency bằng lời gọi chậm nhất, nên lời gọi chậm phải bị cắt bằng timeout. Azure: \"it might be acceptable to time out and return a partial set of data\", và phải làm quyết định đó \"explicit in the policy design so that clients experience predictable behavior\" (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation). Sam Newman cũng khuyên gọi các service downstream đồng thời và giảm chức năng khi service không quan trọng lỗi (https://samnewman.io/patterns/architectural/bff/).",
    },
    {
      t: "**Ghép dữ liệu phức tạp thì đặt vào một service sau gateway**, không viết trong gateway.",
      why: "Azure khuyên \"consider placing an aggregation service behind the gateway\" vì việc ghép có nhu cầu tài nguyên khác routing/offloading và có thể làm chậm chúng; logic ghép nặng, biến đổi phức tạp hay quy trình dài thì đưa vào service riêng (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation). Gateway giữ được vai trò mỏng, ít khi phải deploy.",
    },
    {
      t: "**BFF: một trải nghiệm, một BFF, do team làm client đó sở hữu.** iOS và Android giống nhau thì có thể dùng chung; web và mobile khác nhiều thì tách.",
      why: "Sam Newman tóm tắt \"one experience, one BFF\" và khuyên team UI sở hữu BFF để đổi API theo nhịp của UI mà không chờ team khác; một backend dùng chung cho mọi client \"can become a bottleneck when rolling out new delivery\" (https://samnewman.io/patterns/architectural/bff/). Azure nói thêm BFF không hợp khi chỉ có một client hoặc các client gửi request giống nhau (https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends).",
    },
    {
      t: "**GraphQL là phương án thay cho một số BFF**: client tự chọn trường cần lấy thay vì mỗi client một endpoint riêng.",
      why: "Azure ghi rằng với GraphQL \"the querying mechanism eliminates the need for a separate BFF layer\" khi client tự yêu cầu đúng dữ liệu cần (https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends). Đổi lại phải lo N+1, giới hạn độ sâu query và cache khó hơn REST (bài `api-design`).",
    },
    {
      t: "**Gateway không được thành điểm nghẽn hay SPOF**: chạy nhiều instance sau load balancer, scale theo đỉnh tải, load test, và có timeout, circuit breaker, bulkhead cho từng backend.",
      why: "Mọi request từ ngoài đi qua gateway, nên gateway chết là cả hệ chết và một backend chậm có thể giữ hết connection của gateway. Azure nhắc cả hai rủi ro SPOF và bottleneck và khuyên dùng bulkhead, circuit breaker, retry, timeout (https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation).",
    },
  ],
  sections: [
    {
      title: "API composition có timeout và response một phần (Python asyncio)",
      code: {
        lang: "python",
        lines: [
          "import asyncio",
          "",
          "async def order_svc(order_id):",
          "    await asyncio.sleep(0.05)",
          "    return {\"id\": order_id, \"status\": \"SHIPPED\"}",
          "",
          "async def shipping_svc(order_id):",
          "    await asyncio.sleep(0.05)",
          "    return {\"eta\": \"2026-12-01\"}",
          "",
          "async def review_svc(order_id):",
          ["    await asyncio.sleep(2)", "Giả lập một service phụ đang chậm."],
          "    return {\"rating\": 5}",
          "",
          "async def optional(coro, timeout):",
          "    try:",
          "        return await asyncio.wait_for(coro, timeout)",
          "    except asyncio.TimeoutError:",
          ["        return None", "Phần tuỳ chọn: hết giờ thì bỏ, không làm hỏng cả response."],
          "",
          "async def order_page(order_id):",
          ["    order, shipping, review = await asyncio.gather(", "Ba lời gọi chạy đồng thời: latency bằng lời gọi chậm nhất (đã bị cắt), không phải tổng."],
          ["        asyncio.wait_for(order_svc(order_id), 0.3),", "Phần bắt buộc: lỗi hoặc hết giờ thì cả request lỗi (gateway trả 5xx)."],
          "        optional(shipping_svc(order_id), 0.3),",
          "        optional(review_svc(order_id), 0.3),",
          "    )",
          "    return {\"order\": order, \"shipping\": shipping, \"review\": review,",
          ["            \"partial\": shipping is None or review is None}", "Báo cho client biết response thiếu phần nào, để UI hiện chỗ trống thay vì hiểu nhầm là không có dữ liệu."],
          "",
          ["print(asyncio.run(order_page(\"o-42\")))", "In ra sau khoảng 0.3 giây với `review` = None và `partial` = True."],
        ],
      },
    },
    {
      title: "Gateway, load balancer, service mesh: đừng nhầm",
      table: {
        head: ["Thành phần", "Đứng ở đâu", "Việc chính"],
        rows: [
          {
            cells: ["Load balancer", "Trước nhiều instance của **một** service", "Chia tải, bỏ instance hỏng"],
            why: "LB không biết API của bạn; nó chỉ chọn instance. Gateway thường đứng sau một LB và lại dùng LB/discovery để gọi service (bài `lb-gateway-cdn`).",
          },
          {
            cells: ["API Gateway / BFF", "Giữa **client bên ngoài** và các service", "Routing, offloading, aggregation"],
            why: "Đây là traffic \"bắc–nam\" (từ ngoài vào). Gateway hiểu API công khai, nên làm được auth, rate limit theo client và ghép dữ liệu.",
          },
          {
            cells: ["Service mesh", "Giữa **các service với nhau** (proxy cạnh mỗi service)", "Retry, mTLS, metric, chia traffic cho lời gọi nội bộ"],
            why: "Đây là traffic \"đông–tây\" (service gọi service). Azure mô tả mesh là lớp xử lý service-to-service communication, gồm load balancing theo latency, retry, circuit breaking và mutual TLS (https://learn.microsoft.com/en-us/azure/architecture/microservices/design/interservice-communication).",
          },
        ],
      },
    },
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Viết quy tắc nghiệp vụ trong gateway (tính giá, kiểm tồn kho, đổi trạng thái đơn).",
          why: "Gateway thành chỗ mọi team phải sửa và phải deploy chung, đúng thứ microservices muốn tránh. Mỗi thay đổi ở service kéo theo thay đổi ở gateway, nên hai bên không còn deploy độc lập.",
        },
        {
          t: "Một gateway dùng chung cho mọi client, ai cũng thêm endpoint riêng của mình vào.",
          why: "Gateway phình ra và thành nút cổ chai phát hành giữa các team. Khi nhu cầu của các client khác nhau rõ rệt, tách BFF theo team client.",
        },
        {
          t: "Gateway gọi các service nối tiếp và không có timeout.",
          why: "Latency của trang bằng tổng các lời gọi, và một service treo giữ request của user tới khi client tự timeout. Gọi đồng thời, timeout từng lời gọi, quyết định trước phần nào được thiếu.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi vẽ, tách rõ: client → (CDN) → load balancer → gateway/BFF → service. Nói gateway làm gì và **không** làm gì.",
      why: "Interviewer hay hỏi \"gateway có thành điểm nghẽn không\" và \"logic này đặt ở đâu\". Có ranh giới rõ (gateway: routing, auth thô, rate limit, ghép nhẹ; service: nghiệp vụ, quyền từng tài nguyên) thì trả lời được cả hai.",
    },
    {
      t: "Khi đề bài có cả web lẫn mobile, chủ động hỏi hai client có cần dữ liệu khác nhau nhiều không, rồi mới đề xuất BFF.",
      why: "BFF có chi phí (thêm service, code trùng). Đề xuất nó kèm lý do (payload mobile nhỏ, nhịp phát hành khác, team khác) cho thấy bạn cân nhắc trade-off thay vì thêm hộp cho đủ.",
    },
    "Với câu \"gateway gom 3 service, một cái chậm thì trả gì?\": timeout từng lời gọi, phần bắt buộc lỗi thì trả lỗi, phần tuỳ chọn thì trả response một phần có cờ báo, có thể kèm dữ liệu cache.",
  ],
  cards: [
    [
      "API Gateway làm ba việc gì?",
      "Routing (đưa request tới service), offloading (TLS, kiểm token, rate limit, log), aggregation/API composition (gọi nhiều service, ghép một response).",
    ],
    [
      "Khi nào cần BFF riêng cho mobile?",
      "Khi mobile cần dữ liệu khác web nhiều (payload nhỏ hơn, ít round-trip), có nhịp phát hành và team riêng. Nếu các client gửi request giống nhau hoặc chỉ có một client thì không cần.",
    ],
    [
      "Gateway gom 3 service, một cái chậm thì trả gì?",
      "Gọi đồng thời với timeout từng lời gọi. Phần bắt buộc lỗi → trả lỗi; phần tuỳ chọn hết giờ → trả response một phần có đánh dấu, hoặc dữ liệu cache.",
    ],
    [
      "Gateway có thành điểm nghẽn không? Xử lý thế nào?",
      "Có thể, vì mọi request đi qua nó. Chạy nhiều instance sau LB, scale theo đỉnh, load test, giữ gateway mỏng (không business logic), có timeout/circuit breaker/bulkhead cho từng backend.",
    ],
    [
      "Gateway đã kiểm token, service còn phải kiểm gì?",
      "Quyền trên từng tài nguyên (đơn này của user này không), và xác thực rằng request thật sự đến từ gateway, không tin header chuyển tiếp chưa kiểm.",
    ],
    [
      "Nhược điểm chính của API composition?",
      "Latency theo lời gọi chậm nhất, availability phụ thuộc các service được gọi, và join trong bộ nhớ trên tập dữ liệu lớn thì kém hiệu quả (lúc đó cân nhắc CQRS/read model).",
    ],
  ],
  related: ["lb"],
});
