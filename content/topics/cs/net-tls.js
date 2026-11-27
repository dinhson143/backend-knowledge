BK.topic({
  id: "net-tls",
  track: "cs",
  section: "cs-net",
  title: "TLS & mTLS",
  goal: "Giải thích TLS handshake, chuỗi chứng chỉ và khi nào cần mTLS",
  needs: ["net-tcp-deep"],
  tldr: {
    t: "TLS cho kết nối ba thứ: **bí mật** (người giữa không đọc được), **toàn vẹn** (không sửa được mà không bị phát hiện), **xác thực** server (và client nếu cần). TLS 1.3 làm việc đó trong **1 RTT**: hai bên trao đổi khoá Diffie-Hellman tạm thời (`key_share`) để ra khoá phiên; server gửi **chứng chỉ** và ký lên toàn bộ handshake (`CertificateVerify`) để chứng minh đang giữ private key; client kiểm **chuỗi chứng chỉ** tới một certificate authority (CA) gốc nó tin và kiểm tên miền. **mTLS** = server cũng đòi chứng chỉ của client (`CertificateRequest`), nên hai bên cùng xác thực nhau.",
    why: "Khoá phiên sinh từ Diffie-Hellman tạm thời nên lộ private key của chứng chỉ sau này không giải mã được phiên cũ (forward secrecy — TLS 1.3 đã bỏ RSA key exchange tĩnh, https://www.rfc-editor.org/rfc/rfc8446#section-1.2). Nhưng Diffie-Hellman một mình không biết đang nói chuyện với ai; chứng chỉ + chữ ký trên handshake mới chặn được kẻ đứng giữa giả làm server.",
  },
  story: {
    problem: "Service A gọi service B qua mạng nội bộ bằng HTTP thường, kèm API key trong header. Một máy bị chiếm trong cùng mạng đọc được key và gọi B như A. Đổi sang HTTPS thì kẻ nghe lén không đọc được, nhưng B vẫn không biết người gọi có thật là A không — key vẫn có thể lộ qua log hay file cấu hình.",
    idea: "TLS giải quyết bí mật và xác thực server; **mTLS** cho mỗi service một chứng chỉ do CA nội bộ cấp, nên danh tính của người gọi được chứng minh bằng private key nằm ở chính service đó, không phải bằng một chuỗi bí mật đi qua header.",
    tradeoff: "mTLS cần một PKI: CA nội bộ, cấp chứng chỉ cho từng workload, xoay vòng trước khi hết hạn, thu hồi khi lộ. Làm tay thì đây là nguồn sự cố (chứng chỉ hết hạn lúc 3 giờ sáng); thường giao cho service mesh hoặc nền tảng tự động hoá.",
  },
  table: {
    head: ["Bước TLS 1.3", "Ai gửi gì", "Để làm gì"],
    rows: [
      {
        cells: ["1 · ClientHello", "Client: phiên bản, cipher suite hỗ trợ, `key_share` (nửa Diffie-Hellman), `server_name` (SNI)", "Đoán trước nhóm khoá server sẽ chọn để không tốn thêm vòng"],
        why: "Gửi sẵn `key_share` trong tin đầu là lý do TLS 1.3 chỉ cần 1 RTT, trong khi TLS 1.2 cần 2 (https://www.rfc-editor.org/rfc/rfc8446#section-2). SNI (RFC 6066) cho một IP phục vụ nhiều domain chọn đúng chứng chỉ; nó đi trong ClientHello nên người giữa thấy được tên miền.",
      },
      {
        cells: ["2 · ServerHello", "Server: cipher suite đã chọn, `key_share` của server", "Hai bên tính được cùng một shared secret; từ đây mọi tin của handshake được mã hoá"],
        why: "RFC 8446: mọi tin handshake sau ServerHello đều được mã hoá, kể cả chứng chỉ, khác TLS 1.2 gửi chứng chỉ ở dạng rõ (§1.2).",
      },
      {
        cells: ["3 · Certificate + CertificateVerify", "Server: chuỗi chứng chỉ, rồi chữ ký bằng private key lên transcript handshake", "Chứng minh server đang giữ private key ứng với chứng chỉ"],
        why: "Chứng chỉ là dữ liệu công khai, ai cũng copy được; chỉ chữ ký trong `CertificateVerify` mới chứng minh quyền sở hữu private key, và vì ký lên toàn bộ handshake nên không thể dùng lại cho phiên khác (https://www.rfc-editor.org/rfc/rfc8446#section-4.4.3).",
      },
      {
        cells: ["4 · Finished", "Cả hai: MAC trên toàn bộ transcript", "Phát hiện nếu ai đó sửa tin handshake (ví dụ ép dùng cipher yếu)"],
        why: "Nếu kẻ đứng giữa xoá bớt cipher suite trong ClientHello, transcript hai bên thấy khác nhau và Finished không khớp, handshake hỏng.",
      },
      {
        cells: ["(mTLS) CertificateRequest → client Certificate + CertificateVerify", "Server đòi; client gửi chứng chỉ và ký", "Server xác thực client"],
        why: "RFC 8446 §4.3.2: server đã xác thực bằng chứng chỉ \"MAY\" yêu cầu chứng chỉ của client (https://www.rfc-editor.org/rfc/rfc8446#section-4.3.2). Client gửi chứng chỉ thì **MUST** gửi `CertificateVerify` (§4.4.3), cùng cơ chế như phía server.",
      },
    ],
  },
  points: [
    {
      t: "**Chuỗi chứng chỉ**: chứng chỉ của server (leaf) đứng đầu, mỗi chứng chỉ sau **SHOULD** ký cho chứng chỉ ngay trước nó (intermediate CA), tới một CA gốc (trust anchor) mà client đã có sẵn trong trust store. Chứng chỉ gốc có thể không gửi vì client phải có nó từ trước (https://www.rfc-editor.org/rfc/rfc8446#section-4.4.2).",
      why: "Client tin CA gốc vì nó được cài sẵn trong OS/trình duyệt, không phải vì server gửi. Thuật toán kiểm đường đi (chữ ký, hạn dùng, quyền làm CA, ràng buộc tên…) nằm ở RFC 5280 §6.1 (https://www.rfc-editor.org/rfc/rfc5280#section-6.1). Lỗi triển khai hay gặp: server quên gửi intermediate; trình duyệt nào đã cache intermediate thì vẫn chạy, client khác (curl, app mobile, service backend) thì báo lỗi chứng chỉ.",
    },
    {
      t: "**Kiểm tên miền là bước riêng.** Chuỗi hợp lệ chỉ nói \"CA này cấp chứng chỉ này\"; client còn phải so tên miền đang kết nối với **subjectAltName** trong chứng chỉ. RFC 9525 cấm dùng Common Name để định danh service (https://www.rfc-editor.org/rfc/rfc9525).",
      why: "Bỏ kiểm tên thì bất kỳ chứng chỉ hợp lệ nào (của domain kẻ tấn công) cũng qua được. Tài liệu `ssl` của Python ghi rõ `CERT_REQUIRED` một mình **không đủ** ở phía client vì không so hostname; phải bật `check_hostname` (https://docs.python.org/3/library/ssl.html).",
    },
    {
      t: "**TLS 1.3 so với 1.2** (RFC 8446 §1.2): chỉ còn thuật toán AEAD; bỏ RSA và Diffie-Hellman tĩnh nên mọi key exchange đều có forward secrecy; mã hoá mọi tin handshake sau ServerHello; thêm chế độ 0-RTT. Ứng dụng tuân thủ **MUST** hỗ trợ `TLS_AES_128_GCM_SHA256` (§9.1).",
      why: "Mỗi thứ bị bỏ đều từng là nguồn lỗ hổng hoặc cấu hình sai: cipher cũ, RSA key exchange (lộ key là giải mã được traffic đã ghi lại). Python từ 3.10 đặt TLS 1.2 làm phiên bản tối thiểu mặc định cho `PROTOCOL_TLS_CLIENT`/`PROTOCOL_TLS_SERVER` (tài liệu `ssl`).",
    },
    {
      t: "**0-RTT có thể bị replay.** Client đã từng kết nối gửi dữ liệu ngay trong tin đầu; TLS không đảm bảo dữ liệu đó không bị gửi lại giữa các kết nối (https://www.rfc-editor.org/rfc/rfc8446#section-8).",
      why: "Kẻ nghe lén chép tin đầu và gửi lại thì server có thể xử lý hai lần. Chỉ chấp nhận 0-RTT cho request idempotent (GET không đổi trạng thái); `POST /payments` thì không.",
    },
    {
      t: "**Khi nào cần mTLS**: (1) service-to-service trong mạng zero trust — không tin vì \"cùng mạng nội bộ\"; (2) API cho đối tác B2B muốn xác thực bằng chứng chỉ thay vì key chia sẻ; (3) thiết bị (IoT) mà mỗi máy có private key riêng. Không hợp cho người dùng cuối qua trình duyệt: cấp và cài chứng chỉ cho từng người quá nặng; ở đó dùng session/OAuth (xem topic Authentication & Authorization).",
      why: "mTLS xác thực **máy/service** ở tầng transport; quyền chi tiết (user nào được làm gì) vẫn là việc của tầng ứng dụng. Service mesh như Istio cấp chứng chỉ X.509 cho từng workload, `istiod` làm CA và tự xoay vòng key, chứng chỉ, nên bật mTLS không cần sửa code service (https://istio.io/latest/docs/concepts/security/).",
    },
    {
      t: "**TLS termination**: thường kết thúc TLS ở load balancer/CDN (giữ chứng chỉ ở một chỗ, LB đọc được request để route L7). Từ LB vào app thì hoặc là plaintext trong mạng riêng, hoặc mã hoá lại (re-encrypt), hoặc mTLS nếu cần zero trust.",
      why: "Kết thúc ở LB thì app không biết chứng chỉ client gốc; với mTLS tới tận app, LB phải pass-through ở L4 hoặc chuyển thông tin chứng chỉ client qua header mà app tin được. Đây là câu hỏi tiếp theo hay gặp khi bạn nói \"dùng mTLS\".",
    },
  ],
  sections: [
    {
      title: "Ví dụ: context TLS phía client và phía server mTLS (Python `ssl`)",
      code: {
        lang: "python",
        lines: [
          "import ssl",
          "",
          "def client_ctx(ca_file=None):",
          ["    ctx = ssl.create_default_context(cafile=ca_file)", "Mặc định `CERT_REQUIRED` + `check_hostname=True`; không có `cafile` thì dùng trust store của hệ thống."],
          ["    ctx.minimum_version = ssl.TLSVersion.TLSv1_3", "Chỉ chấp nhận TLS 1.3: server chỉ hỗ trợ 1.2 thì handshake thất bại. Bỏ dòng này nếu còn phải nói chuyện với server cũ (mặc định tối thiểu là 1.2)."],
          "    return ctx",
          "",
          "def mtls_server_ctx(cert, key, client_ca):",
          "    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)",
          ["    ctx.load_cert_chain(cert, key)", "`cert` là file PEM chứa leaf **và** intermediate; thiếu intermediate là lỗi hay gặp."],
          ["    ctx.load_verify_locations(client_ca)", "CA dùng để kiểm chứng chỉ của client (CA nội bộ, không phải trust store công cộng)."],
          ["    ctx.verify_mode = ssl.CERT_REQUIRED", "Phía server: gửi CertificateRequest và bắt client đưa chứng chỉ hợp lệ — đây là mTLS."],
          "    return ctx",
          "",
          "ctx = client_ctx()",
          ["print(ctx.verify_mode == ssl.CERT_REQUIRED, ctx.check_hostname)", "→ True True"],
        ],
      },
    },
  ],
  tips: [
    {
      t: "Vẽ handshake TLS 1.3 thành 3 mũi tên (ClientHello+key_share → ServerHello+key_share+{Cert, CertVerify, Finished} → {Finished}) và nói mỗi phần chống cái gì: key_share → nghe lén; Cert+CertVerify → giả mạo server; Finished → sửa handshake.",
      why: "Interviewer hỏi TLS để xem bạn hiểu **vì sao** từng bước tồn tại. Nêu được \"Diffie-Hellman không tự xác thực được, nên cần chứng chỉ\" là câu then chốt.",
    },
    {
      t: "Nói \"dùng mTLS giữa các service\" thì chuẩn bị luôn: ai cấp chứng chỉ, thời hạn bao lâu, xoay vòng thế nào, thu hồi ra sao.",
      why: "Vận hành PKI mới là phần khó; interviewer senior sẽ hỏi tiếp ở đó.",
    },
  ],
  cards: [
    ["TLS 1.3 handshake tốn mấy RTT? Vì sao ít hơn 1.2?", "1 RTT. Client gửi sẵn `key_share` trong ClientHello nên server trả lời một lần là đủ tính khoá; TLS 1.2 cần 2 RTT."],
    ["Diffie-Hellman đã cho khoá chung, sao còn cần chứng chỉ?", "DH không biết bên kia là ai; kẻ đứng giữa có thể DH với cả hai phía. Chứng chỉ + CertificateVerify chứng minh server giữ private key của tên miền."],
    ["Client kiểm những gì ở chứng chỉ server?", "Chuỗi tới một CA gốc trong trust store (chữ ký, hạn dùng, ràng buộc theo RFC 5280) và tên miền khớp subjectAltName."],
    ["Forward secrecy là gì, TLS 1.3 có không?", "Lộ private key sau này không giải mã được phiên đã ghi lại vì khoá phiên đến từ DH tạm thời. TLS 1.3 bỏ RSA/DH tĩnh nên luôn có."],
    ["mTLS khác TLS ở bước nào?", "Server gửi CertificateRequest; client gửi Certificate và CertificateVerify. Server kiểm chứng chỉ client với CA nó tin."],
    ["Vì sao 0-RTT không dùng cho POST thanh toán?", "Dữ liệu 0-RTT có thể bị replay giữa các kết nối; request không idempotent sẽ chạy hai lần."],
    ["Một số client báo lỗi chứng chỉ, trình duyệt thì không. Nghi gì trước?", "Server không gửi intermediate certificate; trình duyệt có thể đã cache hoặc tự tải, client khác thì không."],
  ],
  related: ["lb"],
});
