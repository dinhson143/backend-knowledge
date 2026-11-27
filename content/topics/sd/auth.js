BK.topic({
  id: "auth",
  track: "sd",
  section: "sd-core",
  title: "Authentication & Authorization",
  goal: "Chọn session hay token, đi đúng luồng OAuth 2.0/OIDC và thu hồi quyền",
  needs: ["api-design", "networking"],
  tldr: {
    t: "**Authentication** (authn, xác thực) trả lời \"bạn là ai\"; **authorization** (authz, phân quyền) trả lời \"bạn được làm gì\". Sau khi đăng nhập, server cấp một **credential** để các request sau khỏi gửi mật khẩu: **session id** (server giữ trạng thái, tra mỗi request) hoặc **token tự chứa** như JWT (server chỉ kiểm chữ ký). **OAuth 2.0** là khung **ủy quyền** cho app gọi API thay user; **OpenID Connect** (OIDC) xây trên OAuth 2.0 để làm **đăng nhập**.",
    why: "Hai câu hỏi tách nhau vì chúng đổi theo nhịp khác nhau: danh tính kiểm một lần lúc đăng nhập, còn quyền phải kiểm ở **mọi** request và mọi tài nguyên. Trộn hai việc thì hay gặp lỗi kinh điển: đã đăng nhập là được đọc mọi đơn hàng, chỉ cần đổi id trên URL (IDOR).",
  },
  story: {
    problem: "API có 20 service phía sau gateway. Nếu mỗi service tự hỏi DB user \"session này còn sống không\" ở mọi request thì DB session thành điểm nghẽn và SPOF. Nếu chuyển sang JWT để service tự kiểm chữ ký thì lại gặp chuyện ngược lại: user bấm \"Đăng xuất mọi thiết bị\" hoặc admin khoá tài khoản, nhưng token đã phát vẫn hợp lệ tới khi hết hạn.",
    idea: "Tách **ai cấp** (authorization server / identity provider) khỏi **ai kiểm** (resource server). Access token ngắn hạn, tự chứa, để service kiểm tại chỗ không cần gọi mạng; refresh token dài hạn nằm ở server cấp, có thể thu hồi. Quyền chi tiết (được sửa đơn hàng này không) kiểm ở service sở hữu dữ liệu, không chỉ ở gateway.",
    tradeoff: "Token tự chứa đổi khả năng thu hồi tức thì lấy việc không phải tra DB: thu hồi chỉ có hiệu lực khi access token hết hạn, trừ khi thêm denylist (lại tra một kho chung). Session thu hồi ngay được nhưng mỗi request tốn một lần tra kho session. OAuth/OIDC thêm nhiều bước redirect và nhiều chỗ cấu hình sai được.",
  },
  table: {
    head: ["", "Session (cookie + kho session)", "Token tự chứa (JWT)"],
    rows: [
      {
        cells: ["Server lưu gì", "Bản ghi session (Redis/DB), cookie chỉ chứa id ngẫu nhiên", "Không lưu gì; claim và chữ ký nằm trong token"],
        why: "Session id chỉ là con trỏ, nên mọi thông tin (user nào, hết hạn lúc nào) phải tra ở server. JWT ghi sẵn claim và ký lại (RFC 7519 — https://www.rfc-editor.org/rfc/rfc7519), nên ai có khoá kiểm chữ ký là đọc được mà không cần hỏi ai.",
      },
      {
        cells: ["Kiểm mỗi request", "Một lần tra kho session (mạng + I/O)", "Kiểm chữ ký + `exp` tại chỗ (CPU)"],
        why: "Đây là lý do microservice thích token: 20 service kiểm token không tạo tải lên một kho chung. Đổi lại, kho session có thể cache gần app và vẫn đủ nhanh cho đa số hệ thống một khối.",
      },
      {
        cells: ["Thu hồi (logout, khoá tài khoản)", "Xoá bản ghi là xong, có hiệu lực ngay", "Chờ token hết hạn, hoặc thêm denylist / introspection"],
        why: "RFC 7009 định nghĩa endpoint thu hồi token nhưng nói rõ: với token tự chứa, muốn resource server biết ngay thì cần tương tác backend **chưa chuẩn hoá**, và gợi ý dùng access token sống ngắn để giới hạn thời gian token bị thu hồi còn dùng được (https://www.rfc-editor.org/rfc/rfc7009).",
      },
      {
        cells: ["Hợp với", "Web app một domain, monolith", "Nhiều service, API cho bên thứ ba, mobile"],
        why: "Cookie được trình duyệt tự gửi kèm nên web một domain gần như không phải làm gì; mobile và service-to-service không có \"trình duyệt\" nên gửi header `Authorization: Bearer …` tiện hơn.",
      },
    ],
  },
  points: [
    {
      t: "**OAuth 2.0 có bốn vai**: resource owner (user), client (app), authorization server (nơi cấp token), resource server (API giữ dữ liệu) (RFC 6749 §1.1 — https://www.rfc-editor.org/rfc/rfc6749). RFC 6749 tự gọi mình là **authorization framework** và để ngoài phạm vi cách server xác thực user.",
      why: "OAuth giải bài \"app A muốn đọc lịch Google của tôi mà không cần mật khẩu Google của tôi\": user đồng ý ở authorization server, app chỉ nhận token có phạm vi (`scope`) hẹp. Vì OAuth không nói token thuộc về **ai**, dùng access token để suy ra \"user này đã đăng nhập\" là sai mục đích; đó là việc của OIDC.",
    },
    {
      t: "**Authorization code + PKCE là luồng mặc định** cho app có user: client redirect user tới authorization server → user đăng nhập, đồng ý → server redirect về kèm `code` ngắn hạn → client đổi `code` lấy token qua kênh back-channel. PKCE (RFC 7636) bắt client gửi `code_challenge` (SHA-256 của một `code_verifier` ngẫu nhiên 43–128 ký tự) lúc bắt đầu và `code_verifier` lúc đổi code (https://www.rfc-editor.org/rfc/rfc7636).",
      why: "`code` đi qua trình duyệt, URL, lịch sử, app khác cùng đăng ký custom URI scheme, nên có thể bị chặn. Không có PKCE thì kẻ chặn đổi được code lấy token. Có PKCE thì code vô dụng nếu không có `code_verifier`, và verifier chưa từng rời khỏi client. Token thật chỉ đi trên kênh client → server qua TLS, không qua trình duyệt.",
    },
    {
      t: "**OAuth 2.0 Security BCP (RFC 9700, tháng 1/2025)**: client **SHOULD NOT** dùng implicit grant (`response_type=token`); password grant **MUST NOT** được dùng; public client **MUST** dùng PKCE, confidential client nên dùng; authorization server **MUST** so `redirect_uri` khớp chính xác từng ký tự (https://www.rfc-editor.org/rfc/rfc9700).",
      why: "Implicit grant trả access token thẳng trên URL fragment, nơi lịch sử trình duyệt, extension và log có thể đọc. Password grant bắt user đưa mật khẩu cho app bên thứ ba, đúng thứ OAuth sinh ra để tránh. So `redirect_uri` theo pattern (wildcard) từng bị lợi dụng để chuyển code về domain của kẻ tấn công.",
    },
    {
      t: "**Client credentials** cho service gọi service: service tự xác thực bằng secret/certificate của chính nó và nhận token, không có user nào. RFC 6749 §4.4: grant này chỉ dành cho confidential client.",
      why: "Job nền hay service nội bộ không có user ngồi bấm \"Đồng ý\". Chỉ confidential client (chạy trên server, giữ được secret) mới dùng được, vì app mobile hay SPA phát hành tới tay người dùng thì mọi secret nhúng trong đó coi như công khai.",
    },
    {
      t: "**OIDC thêm ID Token**: client xin `scope` có `openid` thì nhận thêm một JWT mô tả **sự kiện đăng nhập**, với claim bắt buộc `iss`, `sub`, `aud`, `exp`, `iat`. Client phải kiểm `iss` khớp issuer, `aud` chứa `client_id` của mình, chữ ký, `exp`, và `nonce` nếu đã gửi (https://openid.net/specs/openid-connect-core-1_0.html).",
      why: "ID token dành cho **client** (để biết ai vừa đăng nhập), còn access token dành cho **API**. Bỏ kiểm `aud` thì một ID token phát cho app khác (cùng identity provider) cũng được app bạn chấp nhận: kẻ tấn công lấy token từ app của họ đem sang đăng nhập app bạn. `nonce` buộc ID token với đúng request đăng nhập này, chặn replay.",
    },
    {
      t: "**Access token ngắn hạn + refresh token**: access token sống vài phút, gửi ở mọi request; refresh token sống lâu, chỉ gửi tới authorization server để xin access token mới. RFC 9700: refresh token của public client **MUST** sender-constrained hoặc **rotation** (mỗi lần dùng cấp refresh token mới, token cũ hết hiệu lực).",
      why: "Access token đi khắp các service nên dễ lộ; sống ngắn thì lộ cũng ít hại và thu hồi \"tự nhiên\" sau vài phút. Refresh token chỉ đi tới một chỗ nên giữ kín được, và authorization server tra nó mỗi lần dùng nên thu hồi ngay được. Rotation giúp phát hiện trộm: token cũ bị dùng lần nữa nghĩa là có hai bên cầm nó, server thu hồi cả chuỗi.",
    },
    {
      t: "**JWT được ký, không được mã hoá** (dạng JWS phổ biến): payload chỉ là base64url, ai cầm token cũng đọc được. Server kiểm phải cố định thuật toán chấp nhận (ví dụ chỉ `RS256`/`ES256`), không tin trường `alg` trong header (RFC 8725 — https://www.rfc-editor.org/rfc/rfc8725).",
      why: "Đặt email, số điện thoại, quyền nội bộ vào JWT là đưa chúng cho mọi proxy và log trên đường đi. Lỗi `alg` kinh điển: thư viện tin header, kẻ tấn công đổi thành `none` hoặc đổi RS256 thành HS256 rồi ký bằng public key (vốn công khai), và server chấp nhận.",
    },
    {
      t: "**Session trên web**: cookie đặt `Secure`, `HttpOnly`, `SameSite=Strict` (hoặc `Lax`), tiền tố `__Host-`; session id sinh bằng CSPRNG, tối thiểu 64 bit entropy; **cấp session id mới sau khi đăng nhập** và huỷ id cũ (https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).",
      why: "`HttpOnly` chặn JavaScript (và XSS) đọc cookie; `Secure` chặn gửi qua HTTP thường; `SameSite` giảm CSRF vì trình duyệt không gửi cookie kèm request từ site khác. Không đổi id sau đăng nhập thì bị **session fixation**: kẻ tấn công cài sẵn một id vào trình duyệt nạn nhân, chờ nạn nhân đăng nhập, rồi dùng chính id đó.",
    },
    {
      t: "**Authorization kiểm ở đâu**: gateway kiểm token còn hạn và `scope` thô (được gọi API đơn hàng không); service sở hữu dữ liệu kiểm quyền trên **từng tài nguyên** (đơn hàng này có thuộc user này không). Mô hình phổ biến: RBAC (theo vai trò); khi quyền phụ thuộc quan hệ (chia sẻ tài liệu) thì cần mô hình theo quan hệ.",
      why: "Gateway không biết đơn hàng 123 thuộc ai; chỉ service đơn hàng biết. Chỉ kiểm ở gateway thì sinh lỗi IDOR: user A đổi `/orders/123` thành `/orders/124` và đọc được đơn của user B. Kiểm ở cả hai lớp là defense in depth: gateway chặn rẻ phần lớn request sai, service chặn phần còn lại.",
    },
  ],
  table2Title: "Chọn luồng OAuth 2.0 / OIDC theo loại client",
  table2: {
    head: ["Client", "Luồng", "Ghi chú"],
    rows: [
      ["Web app có backend", "Authorization code (+ PKCE), OIDC nếu cần đăng nhập", "Backend giữ client secret và token; trình duyệt chỉ giữ cookie session của app"],
      ["SPA, mobile (public client)", "Authorization code + PKCE (bắt buộc)", "Không nhúng secret; refresh token phải rotation hoặc sender-constrained"],
      ["Service ↔ service, cron job", "Client credentials", "Chỉ confidential client; token mang danh tính service, không có user"],
      ["Thiết bị không có bàn phím (TV, CLI)", "Device authorization grant (RFC 8628)", "User nhập mã trên điện thoại (https://www.rfc-editor.org/rfc/rfc8628)"],
      { cells: ["Implicit, password grant", "Không dùng", "RFC 9700: implicit SHOULD NOT, password MUST NOT"], why: "Cả hai có trong RFC 6749 (2012). RFC 9700 (2025) dựa trên các tấn công đã gặp: implicit grant trả token trên URL nên dễ lộ, password grant bắt user đưa mật khẩu cho client. Implicit chỉ là SHOULD NOT nên vẫn còn gặp ở hệ cũ; hệ mới dùng authorization code + PKCE." },
    ],
  },
  sections: [
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Lưu JWT trong `localStorage` để \"tiện gửi header\".",
          why: "Mọi script chạy trên trang (kể cả script bị XSS chèn vào) đọc được `localStorage`, nên một lỗi XSS là mất token. Cookie `HttpOnly` thì script không đọc được; với SPA, cách hay dùng là backend-for-frontend giữ token và chỉ đưa cookie session cho trình duyệt.",
        },
        {
          t: "Access token sống 24 giờ \"cho đỡ refresh\".",
          why: "Thời gian sống của access token chính là thời gian tối đa một tài khoản bị khoá vẫn gọi được API (khi không có denylist). Vài phút là mức hay dùng; tần suất refresh tăng nhưng chỉ chạm authorization server, không chạm các service nghiệp vụ.",
        },
        {
          t: "Dùng chung một khoá ký (HS256 secret) cho mọi service.",
          why: "Với HMAC, ai kiểm được chữ ký thì cũng **ký** được token. Một service bị chiếm là kẻ tấn công tự cấp token admin cho mọi service khác. Dùng khoá bất đối xứng (RS256/ES256): chỉ authorization server giữ private key, service chỉ cần public key (thường lấy qua JWKS).",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Khi interviewer hỏi \"auth làm sao\", trả lời theo lớp: ai cấp (identity provider/OIDC) → credential gì (session hay JWT, sống bao lâu) → ai kiểm (gateway kiểm token, service kiểm quyền từng tài nguyên) → thu hồi thế nào.",
      why: "Bốn câu này phủ hết các chỗ thiết kế auth hay hỏng. Phần lớn ứng viên dừng ở \"dùng JWT\", nên nói được đoạn thu hồi và kiểm quyền theo tài nguyên là điểm phân biệt.",
    },
    "Trong bài thiết kế hệ thống, đừng tự xây đăng nhập: nói \"dùng identity provider qua OIDC\" rồi dành thời gian cho phần authz đặc thù của bài (ai được xem bài đăng, ai được sửa tài liệu).",
    {
      t: "Phân biệt rõ 401 và 403: `401 Unauthorized` là chưa xác thực hoặc token không hợp lệ; `403 Forbidden` là đã biết bạn là ai nhưng bạn không có quyền (RFC 9110 §15.5.2, §15.5.4 — https://www.rfc-editor.org/rfc/rfc9110#section-15.5.2).",
      why: "Client xử lý hai mã khác nhau: 401 thì refresh token hoặc bắt đăng nhập lại; 403 thì đăng nhập lại cũng vô ích. Trả sai mã làm client lặp refresh mãi.",
    },
  ],
  cards: [
    [
      "OAuth 2.0 và OIDC khác nhau thế nào?",
      "OAuth 2.0 là ủy quyền: app nhận access token để gọi API thay user, token không nói user là ai. OIDC thêm lớp đăng nhập: `scope=openid` → ID token (JWT) có `sub`, `iss`, `aud`, `exp` cho client biết ai vừa đăng nhập.",
    ],
    [
      "Vì sao SPA/mobile phải dùng PKCE?",
      "Chúng là public client, không giữ được secret, và `code` đi qua trình duyệt/URI scheme nên có thể bị chặn. PKCE buộc người đổi code phải có `code_verifier` chỉ client gốc biết. RFC 9700: public client MUST dùng PKCE.",
    ],
    [
      "Dùng JWT thì logout / khoá tài khoản ngay lập tức bằng cách nào?",
      "Bản thân JWT không thu hồi được trước `exp`. Cách làm: access token sống vài phút + thu hồi refresh token ở authorization server; cần tức thì thì thêm denylist theo `jti` hoặc token introspection (tra kho chung, mất lợi thế stateless).",
    ],
    [
      "Session hay JWT cho một web app monolith?",
      "Session thường đơn giản hơn: cookie HttpOnly, thu hồi ngay, một kho session đủ nhanh. JWT đáng giá khi nhiều service độc lập cần kiểm danh tính mà không gọi về một kho chung.",
    ],
    [
      "Gateway đã kiểm token rồi, service còn cần kiểm gì?",
      "Quyền trên từng tài nguyên (đơn hàng này thuộc user này không). Gateway không biết quan hệ dữ liệu; bỏ bước này là lỗi IDOR.",
    ],
    [
      "Refresh token rotation phát hiện token bị trộm thế nào?",
      "Mỗi lần dùng refresh token, server cấp token mới và vô hiệu token cũ. Nếu token cũ xuất hiện lần nữa, có hai bên đang cầm nó → server thu hồi cả chuỗi, buộc đăng nhập lại.",
    ],
  ],
});
