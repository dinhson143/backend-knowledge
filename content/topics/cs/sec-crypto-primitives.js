BK.topic({
  id: "sec-crypto-primitives",
  track: "cs",
  section: "cs-security",
  title: "Hash, MAC, Encryption & Signature",
  goal: "Chọn đúng hash, HMAC, mã hoá hay chữ ký số cho từng việc",
  tldr: {
    t: "Bốn khối cơ bản, phân biệt bằng **ai giữ khoá** và **bảo đảm điều gì**. **Hash** (SHA-256): không khoá, ai cũng tính được — dấu vân tay để phát hiện thay đổi, không chứng minh ai gửi. **MAC/HMAC**: một khoá bí mật chung — chứng minh message đến từ người có khoá và không bị sửa. **Encryption**: giấu nội dung — đối xứng (AES-GCM, một khoá chung) hoặc bất đối xứng (public key mã hoá, private key giải). **Digital signature**: private key ký, ai có public key cũng kiểm được — chứng minh ai ký và không chối được. Thêm hai thứ đi kèm: **hash mật khẩu** phải dùng hàm cố ý chậm (Argon2id, scrypt, bcrypt, PBKDF2), và mọi khoá/token phải sinh bằng bộ sinh số ngẫu nhiên mật mã (`secrets`).",
    why: "Dùng nhầm khối là lỗ hổng: hash không khoá thì kẻ sửa message tính lại hash được ngay; MAC dùng khoá chung nên bên kiểm cũng ký được, không dùng làm bằng chứng với bên thứ ba; mã hoá không xác thực thì kẻ ở giữa sửa ciphertext mà không bị phát hiện. FIPS 180-4 nói hash dùng \"để phát hiện message có bị đổi từ lúc tạo digest\" (https://csrc.nist.gov/pubs/fips/180-4/upd1/final); FIPS 186-5 nói chữ ký phát hiện sửa đổi **và** xác thực danh tính người ký (https://csrc.nist.gov/pubs/fips/186-5/final).",
  },
  story: {
    problem: "Một service nhận webhook, kiểm `sha256(body) == header`. Kẻ tấn công gửi body giả kèm sha256 của chính body đó và được chấp nhận. Service khác lưu mật khẩu bằng `sha256(password)`; khi DB lộ, phần lớn mật khẩu bị dò ra vì SHA-256 quá nhanh.",
    idea: "Hỏi ba câu trước khi chọn: cần **giấu** nội dung không (→ encryption)? cần chứng minh **không bị sửa và đến từ ai** không (→ MAC nếu hai bên chung khoá, signature nếu người kiểm không được phép ký)? lưu thứ chỉ cần **kiểm lại** chứ không cần đọc lại (→ hash; với mật khẩu là hash chậm có salt)?",
    tradeoff: "Mật mã đúng mà quản lý khoá sai thì vẫn hỏng: khoá nằm trong git, nonce lặp, không xoay vòng. Và tự viết thuật toán hay tự ghép chế độ mã hoá gần như luôn sai — OWASP trả lời câu \"tự viết thuật toán\" bằng đúng hai chữ \"Don't do this\" (https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).",
  },
  table: {
    head: ["Khối", "Khoá", "Bảo đảm", "Không bảo đảm", "Dùng cho"],
    rows: [
      {
        cells: ["Hash (SHA-256, SHA-3)", "Không", "Phát hiện thay đổi so với digest đã biết", "Ai tạo ra; bí mật nội dung", "Checksum file, content-addressing, dedup, cache key"],
        why: "Không có khoá nên kẻ sửa dữ liệu cũng tính lại được hash; hash chỉ có ích khi digest được lấy từ một kênh tin cậy khác. MD5 và SHA-1 có điểm yếu va chạm (https://docs.python.org/3/library/hashlib.html); NIST yêu cầu bỏ SHA-1 trước 31/12/2030 và chuyển sang SHA-2 hoặc SHA-3 (https://www.nist.gov/news-events/news/2022/12/nist-retires-sha-1-cryptographic-algorithm).",
      },
      {
        cells: ["MAC (HMAC-SHA256)", "Một khoá bí mật chung", "Message không bị sửa và đến từ bên có khoá", "Ai trong hai bên đã gửi (cả hai cùng ký được); bí mật nội dung", "Ký webhook, cookie/session có chữ ký, JWT HS256, API request signing"],
        why: "HMAC tính `H(K XOR opad, H(K XOR ipad, text))` (RFC 2104 — https://www.rfc-editor.org/rfc/rfc2104). Không có khoá thì không tính được tag đúng, nên kẻ sửa body không tạo được header khớp. JWT HS256 là HMAC-SHA256 và cần khoá dài ít nhất bằng output của hash, tức 256 bit (RFC 7518 §3.2 — https://www.rfc-editor.org/rfc/rfc7518#section-3.2).",
      },
      {
        cells: ["Mã hoá đối xứng (AES-GCM, ChaCha20-Poly1305)", "Một khoá bí mật chung", "Bí mật + toàn vẹn (với chế độ AEAD)", "Chống replay; quản lý khoá", "Mã hoá dữ liệu lưu trữ, trường nhạy cảm trong DB, dữ liệu trong TLS"],
        why: "AES mã hoá khối 128 bit với khoá 128, 192 hoặc 256 bit (FIPS 197 — https://csrc.nist.gov/pubs/fips/197/final). OWASP: AES khoá ít nhất 128 bit (lý tưởng 256), luôn dùng chế độ có xác thực như GCM/CCM khi có, không dùng ECB. GCM là \"authenticated encryption with associated data\" (SP 800-38D — https://csrc.nist.gov/pubs/sp/800/38/d/final).",
      },
      {
        cells: ["Mã hoá bất đối xứng (RSA-OAEP, HPKE)", "Public key mã hoá, private key giải", "Chỉ người giữ private key đọc được", "Ai gửi (ai cũng có public key)", "Trao khoá, mã hoá gửi cho một bên không chung bí mật trước"],
        why: "RSA-OAEP chỉ mã hoá được message ngắn hơn kích thước khoá (RFC 8017 §7.1.1 — https://www.rfc-editor.org/rfc/rfc8017#section-7.1.1), nên thực tế dùng lai: thoả thuận hoặc bọc một khoá đối xứng rồi mã hoá dữ liệu bằng khoá đó. OWASP khuyên dùng sơ đồ lai có sẵn như HPKE thay vì tự ghép, RSA ít nhất 2048 bit; X25519 là phép thoả thuận khoá và \"không tự mã hoá dữ liệu lưu trữ\".",
      },
      {
        cells: ["Digital signature (Ed25519, ECDSA, RSA-PSS)", "Private key ký, public key kiểm", "Không bị sửa + đúng người giữ private key ký + không chối được", "Bí mật nội dung", "JWT RS256/ES256, ký bản phát hành, ký chứng chỉ, giao dịch cần bằng chứng"],
        why: "Bên kiểm chỉ có public key nên không thể giả chữ ký; đó là khác biệt cốt lõi với MAC. FIPS 186-5 chuẩn hoá RSA, ECDSA và EdDSA; DSA không còn được phép dùng để **tạo** chữ ký mới, chỉ còn để kiểm chữ ký cũ (https://csrc.nist.gov/pubs/fips/186-5/final).",
      },
    ],
  },
  points: [
    {
      t: "**Hash mật khẩu phải chậm, có salt.** OWASP (Password Storage Cheat Sheet) hiện khuyên: **Argon2id** tối thiểu 19 MiB bộ nhớ, 2 vòng lặp, độ song song 1; không có Argon2id thì **scrypt** N=2¹⁷, r=8, p=1; **bcrypt** chỉ cho hệ cũ, work factor ≥ 10 và giới hạn mật khẩu 72 byte; **PBKDF2-HMAC-SHA256** 600 000 vòng khi cần tuân thủ FIPS-140 (https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).",
      why: "Hash nhanh như SHA-256 \"cho phép kẻ tấn công thử rất nhiều lần một cách nhanh chóng\" (OWASP). Tài liệu `hashlib`: hàm hash mật khẩu tốt phải \"chỉnh được, chậm và có salt\"; salted SHA-256 hay BLAKE2 đều không phù hợp. Salt riêng cho từng mật khẩu làm hai người cùng mật khẩu ra hai hash khác nhau và vô hiệu bảng tính sẵn. Các con số trên đổi theo thời gian: đọc lại cheat sheet khi chọn tham số.",
    },
    {
      t: "**Kiểm MAC bằng so sánh thời gian hằng**: `hmac.compare_digest(expected, received)`, không dùng `==` (https://docs.python.org/3/library/hmac.html).",
      why: "`==` dừng ở byte khác đầu tiên, nên thời gian trả lời lộ ra tag đúng tới đâu; đo đủ nhiều lần thì dò được từng byte (timing attack). `compare_digest` tránh rẽ nhánh theo nội dung.",
    },
    {
      t: "**MAC không chống replay.** Một webhook hợp lệ bị chép lại và gửi lần nữa vẫn có tag đúng. Ký kèm timestamp (và id sự kiện) trong phần được MAC, từ chối request quá cũ, và xử lý idempotent theo id.",
      why: "MAC chỉ chứng minh \"nội dung này do người có khoá tạo\", không chứng minh \"tạo vừa xong\". Đưa timestamp vào dữ liệu được ký thì kẻ tấn công không sửa được timestamp mà không làm hỏng tag. Xem topic Idempotency cho phần xử lý trùng.",
    },
    {
      t: "**HS256 hay RS256 cho JWT?** HS256 = HMAC: mọi service kiểm token đều giữ khoá, nên mọi service đều **ký** được token. RS256/ES256 = chữ ký: chỉ auth server giữ private key, các service khác chỉ cần public key (RFC 7518 §3.1 — https://www.rfc-editor.org/rfc/rfc7518#section-3.1).",
      why: "Nhiều service độc lập kiểm token thì dùng chữ ký, để một service bị chiếm không phát hành được token cho cả hệ. HS256 hợp khi chỉ một service vừa phát hành vừa kiểm. Topic Authentication & Authorization có thêm bẫy `alg`.",
    },
    {
      t: "**Nonce của AES-GCM không bao giờ được lặp với cùng khoá.** SP 800-38D: xác suất dùng lại cùng IV và cùng khoá cho hai dữ liệu khác nhau không được vượt 2⁻³²; lặp **một lần** là có thể bị giả mạo, \"gần quan trọng ngang việc giữ bí mật khoá\". NIST khuyên IV 96 bit; nếu sinh IV ngẫu nhiên thì một khoá dùng tối đa 2³² lần mã hoá (§8.3 — https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf).",
      why: "Đây là lý do không tự ghép AES-GCM với bộ đếm nonce tự chế chạy trên nhiều instance: hai instance cùng khoá có thể sinh trùng nonce. Dùng API mức cao của thư viện đã được kiểm, xoay vòng khoá trước khi tới giới hạn, hoặc dùng envelope encryption (mỗi bản ghi một khoá dữ liệu).",
    },
    {
      t: "**Ngẫu nhiên cho bảo mật = `secrets`, không phải `random`.** Module `random` \"được thiết kế cho mô hình hoá và mô phỏng, không phải bảo mật hay mật mã\"; tài liệu `secrets` coi 32 byte (256 bit) là đủ cho trường hợp thông thường (https://docs.python.org/3/library/secrets.html).",
      why: "`random` dùng Mersenne Twister, \"hoàn toàn tất định\" và \"hoàn toàn không phù hợp cho mục đích mật mã\" (https://docs.python.org/3/library/random.html). Token reset mật khẩu, session id, API key, salt, nonce đều phải lấy từ CSPRNG của hệ điều hành.",
    },
    {
      t: "**Encoding không phải encryption.** Base64, hex, URL-encode chỉ đổi cách viết; ai cũng giải được. Payload của JWT là base64url: ký nhưng **không** mã hoá.",
      why: "Nhầm lẫn này dẫn tới đặt dữ liệu nhạy cảm vào JWT hay \"mã hoá\" bằng base64 trong cấu hình. Câu hỏi đúng là: có khoá nào tham gia không?",
    },
  ],
  sections: [
    {
      title: "Ví dụ: thư viện chuẩn Python (hashlib, hmac, secrets)",
      code: {
        lang: "python",
        lines: [
          "import hashlib, hmac, secrets, time",
          "",
          ["print(hashlib.sha256(b\"hello\").hexdigest()[:16])", "Hash: ai cũng tính được, cùng input luôn cùng output."],
          "",
          ["key = secrets.token_bytes(32)", "Khoá 256 bit từ CSPRNG; không bao giờ dùng `random`."],
          "def sign(body: bytes, ts: int) -> str:",
          ["    msg = str(ts).encode() + b\".\" + body", "Ký kèm timestamp để từ chối request cũ bị gửi lại."],
          "    return hmac.new(key, msg, hashlib.sha256).hexdigest()",
          "",
          "def verify(body: bytes, ts: int, tag: str, max_age=300) -> bool:",
          "    if abs(time.time() - ts) > max_age:",
          "        return False",
          ["    return hmac.compare_digest(sign(body, ts), tag)", "So sánh thời gian hằng, không dùng `==`."],
          "",
          "ts = int(time.time())",
          "tag = sign(b'{\"event\":\"paid\"}', ts)",
          ["print(verify(b'{\"event\":\"paid\"}', ts, tag), verify(b'{\"event\":\"refund\"}', ts, tag))", "→ True False"],
          "",
          ["salt = secrets.token_bytes(16)", "Salt riêng cho từng mật khẩu, lưu cạnh hash."],
          ["pw_hash = hashlib.scrypt(b\"correct horse\", salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024, dklen=32)", "Tham số tối thiểu của OWASP cho scrypt. Cần 128·n·r = 128 MiB bộ nhớ, vượt giới hạn mặc định 32 MiB của OpenSSL nên phải nâng `maxmem`."],
          "print(len(pw_hash), secrets.token_urlsafe(32)[:10])",
        ],
      },
    },
    {
      title: "Ví dụ: AEAD và chữ ký bằng thư viện `cryptography` (cài từ PyPI)",
      code: {
        lang: "python",
        lines: [
          "import os",
          "from cryptography.hazmat.primitives.ciphers.aead import AESGCM",
          "from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey",
          "from cryptography.exceptions import InvalidSignature, InvalidTag",
          "",
          "key = AESGCM.generate_key(bit_length=256)",
          ["nonce = os.urandom(12)", "96 bit như NIST khuyên. Không bao giờ dùng lại với cùng khoá."],
          ["ct = AESGCM(key).encrypt(nonce, b\"card=4111...\", b\"user:42\")", "Tham số thứ ba là associated data: không mã hoá nhưng được xác thực (gắn ciphertext với user 42)."],
          "try:",
          "    AESGCM(key).decrypt(nonce, ct, b\"user:43\")",
          "except InvalidTag:",
          ["    print(\"sai associated data → từ chối\")", "AEAD phát hiện ciphertext bị chuyển sang ngữ cảnh khác."],
          "",
          "priv = Ed25519PrivateKey.generate()",
          "sig = priv.sign(b\"release-1.2.3.tar.gz sha256=...\")",
          ["pub = priv.public_key()", "Chỉ public key được phát cho bên kiểm."],
          "pub.verify(sig, b\"release-1.2.3.tar.gz sha256=...\")",
          "try:",
          "    pub.verify(sig, b\"release-6.6.6.tar.gz sha256=...\")",
          "except InvalidSignature:",
          "    print(\"chữ ký không khớp → từ chối\")",
        ],
      },
    },
  ],
  tips: [
    {
      t: "Trả lời \"hash khác encryption?\" bằng câu: hash là một chiều và **không có khoá**; encryption có khoá và **đảo ngược được** với khoá. Rồi nói mật khẩu cần hash chậm có salt, không phải mã hoá.",
      why: "OWASP: hash là hàm một chiều nên là cách phù hợp nhất để kiểm mật khẩu; mã hoá mật khẩu chỉ dùng ở ca biên khi buộc phải lấy lại mật khẩu gốc (ví dụ để đăng nhập vào hệ thống khác), và nên tìm kiến trúc khác để tránh cả ca đó.",
    },
    {
      t: "Khi thiết kế, nói rõ **khoá nằm ở đâu và ai giữ**: secret của HMAC ở cả hai bên, private key chỉ ở người ký, khoá dữ liệu bọc bằng KMS.",
      why: "Interviewer senior hỏi tiếp về quản lý khoá (xoay vòng, lộ khoá) nhiều hơn về thuật toán. Topic Secrets & Key Management (kế hoạch) đi sâu phần đó.",
    },
  ],
  cards: [
    ["Vì sao kiểm webhook bằng `sha256(body)` là sai?", "Không có khoá: kẻ tấn công tạo body giả và tính sha256 của nó. Phải dùng HMAC với secret chung (và so sánh bằng `compare_digest`)."],
    ["MAC khác chữ ký số ở đâu?", "MAC: một khoá chung, ai kiểm được cũng ký được, không chống chối bỏ. Chữ ký: private key ký, public key kiểm; bên kiểm không giả được."],
    ["JWT HS256 vs RS256: chọn khi nào?", "HS256 khi một service vừa phát hành vừa kiểm. RS256/ES256 khi nhiều service kiểm: họ chỉ cần public key, không ký được token."],
    ["Vì sao không lưu mật khẩu bằng SHA-256 có salt?", "Quá nhanh: kẻ có DB thử được rất nhiều mật khẩu trong thời gian ngắn. Dùng Argon2id/scrypt/bcrypt/PBKDF2 với tham số theo OWASP."],
    ["Dùng lại nonce trong AES-GCM thì sao?", "SP 800-38D: một lần lặp IV với cùng khoá đã có thể bị tấn công giả mạo; yêu cầu này quan trọng gần ngang giữ bí mật khoá."],
    ["Base64 có phải mã hoá không?", "Không. Là encoding, không có khoá, ai cũng giải được. Payload JWT là base64url: có chữ ký nhưng đọc được."],
    ["Vì sao không tự viết thuật toán mã hoá?", "Lỗi mật mã không lộ khi test chức năng; thuật toán và cách ghép chuẩn đã được phân tích công khai nhiều năm. OWASP: \"Don't do this\"."],
  ],
});
