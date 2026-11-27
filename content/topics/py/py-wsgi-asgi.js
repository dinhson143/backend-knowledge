// Khối code theo D13; ba khối đã chạy trên CPython 3.14.6 (wsgiref; httpx 0.28 ASGITransport) (D211).
// Khái niệm event loop, I/O-bound/CPU-bound, thread pool, graceful shutdown: các bài CS được link, không viết lại.
BK.topic({
  id: "py-wsgi-asgi",
  track: "py",
  section: "py-backend",
  title: "WSGI, ASGI & Worker Models",
  goal: "Chọn WSGI hay ASGI và tính số process, thread, event loop cho app server Python",
  needs: ["async-event-loop", "thr-io-vs-cpu-bound"],
  tldr: {
    t: "**WSGI** (PEP 3333) là giao diện giữa web server và app Python: app là callable `app(environ, start_response)` trả về iterable chứa bytes. Server gọi app **một lần cho mỗi request**, và thread đang gọi bị giữ tới khi trả xong, nên số request chạy cùng lúc = số process × số thread. **ASGI** đổi app thành coroutine `app(scope, receive, send)` trao đổi các event dạng `dict`; một **event loop** trong mỗi process giữ được hàng nghìn kết nối đang chờ I/O, và phục vụ được kết nối sống lâu như WebSocket. App server: **Gunicorn** (WSGI, một arbiter quản lý nhiều worker process), **Uvicorn** (ASGI).",
    why: "PEP 3333 định nghĩa app là callable nhận `environ`, `start_response` và trả iterable các bytestring (https://peps.python.org/pep-3333/). ASGI spec ghi lý do ra đời: WSGI gắn chặt với chu trình request/response kiểu HTTP, còn WebSocket và các giao thức khác không theo mẫu đó; ASGI cho phép gửi và nhận dữ liệu bất cứ lúc nào (https://asgi.readthedocs.io/en/latest/specs/main.html).",
  },
  story: {
    problem: "API Django chạy Gunicorn 4 worker `sync`. Một endpoint gọi API đối tác mất 3 giây. Khi có 4 request tới endpoint đó cùng lúc, cả 4 worker bận chờ mạng; request thứ 5 tới trang chủ (vốn chỉ mất 5 ms) phải xếp hàng 3 giây. CPU của máy lúc đó gần như rảnh.",
    idea: "Việc chủ yếu chờ I/O thì cần nhiều \"chỗ chờ\" hơn, không cần thêm CPU: thêm thread (`gthread`), dùng worker greenlet (`gevent`), hoặc chuyển phần đó sang ASGI với client async để một event loop chờ nhiều request cùng lúc. Việc nặng CPU thì cần thêm process (thêm core), không phải thêm thread hay coroutine.",
    tradeoff: "ASGI chỉ có lợi khi cả đường đi đều async: một lệnh blocking (driver DB đồng bộ, `time.sleep`, tính toán nặng) trong coroutine chặn **mọi** request của worker đó. Thread thì đơn giản hơn nhưng mỗi thread tốn bộ nhớ, và GIL chỉ cho một thread chạy bytecode Python tại một thời điểm.",
  },
  table: {
    head: ["", "WSGI (PEP 3333)", "ASGI (spec 3.0)"],
    rows: [
      ["App là gì", "Callable `app(environ, start_response)` trả iterable bytes", "Coroutine `app(scope, receive, send)`"],
      { cells: ["Một kết nối được giữ bởi", "Một thread (hoặc greenlet) từ đầu tới cuối request", "Một coroutine; trong lúc `await` I/O, event loop chạy coroutine khác"], why: "Trong PEP 3333, app là một callable thường trả về iterable, không phải coroutine; `wsgi.multithread`, `wsgi.multiprocess` chỉ báo app có thể bị gọi đồng thời từ nhiều thread/process (https://peps.python.org/pep-3333/). Không có `await` nên thread đang gọi app chờ luôn trong lúc app chờ I/O. ASGI là coroutine nên `await` nhả event loop (https://asgi.readthedocs.io/en/latest/specs/main.html)." },
      ["Giao thức", "HTTP request/response", "HTTP, HTTP/2, WebSocket, cùng sự kiện `lifespan` (startup/shutdown)"],
      ["Server hay gặp", "Gunicorn, uWSGI, mod_wsgi", "Uvicorn, Hypercorn, Daphne; Gunicorn với worker ASGI"],
      ["Framework", "Flask, Django (chế độ WSGI)", "FastAPI, Starlette, Django (chế độ ASGI)"],
    ],
  },
  table2Title: "Worker model: một request đang chờ I/O chiếm gì?",
  table2: {
    head: ["Cấu hình", "Request đồng thời mỗi worker", "Hợp cho", "Lưu ý"],
    rows: [
      { cells: ["Gunicorn `sync` (mặc định)", "1", "Request ngắn, phần lớn là CPU, có proxy đệm phía trước", "Client chậm giữ cả worker"], why: "Docs Gunicorn: worker sync xử lý một request mỗi lúc và cần proxy có đệm (nginx, HAProxy) khi chạy production, vì proxy nhận trọn request/response từ client chậm rồi mới chuyển, nên worker không bị giữ trong lúc client gửi chậm (https://gunicorn.org/design/)." },
      { cells: ["Gunicorn `gthread` (`--threads N`)", "N thread", "App WSGI có I/O vừa phải (gọi DB, gọi API)", "Thread dùng chung bộ nhớ: code phải thread-safe"], why: "`threads` lớn hơn 1 với worker sync thì Gunicorn tự chuyển sang `gthread` (https://gunicorn.org/reference/settings/). Thread nhả GIL khi chờ I/O nên vẫn có ích cho việc I/O-bound." },
      { cells: ["Gunicorn `gevent`", "Hàng nghìn greenlet", "App WSGI cũ có rất nhiều kết nối chờ (long-polling)", "Một số thư viện cần bản vá riêng (ví dụ `psycogreen` cho Psycopg); code dựa vào hành vi blocking không hợp"], why: "Docs Gunicorn mô tả worker greenlet xử lý được hàng nghìn kết nối đồng thời, hỗ trợ keep-alive, WebSocket, long-polling, và ghi hai lưu ý ở cột bên (https://gunicorn.org/design/)." },
      { cells: ["Uvicorn (`--workers N`) hoặc Gunicorn + worker Uvicorn", "Hàng nghìn coroutine trên một event loop", "App ASGI, I/O-bound, WebSocket", "Một lệnh blocking chặn cả worker"], why: "Uvicorn có `--workers` để chạy nhiều process; mặc định lấy từ biến `WEB_CONCURRENCY`, không có thì 1 (https://uvicorn.dev/settings/). Gunicorn quản lý worker Uvicorn qua `-k uvicorn_worker.UvicornWorker` (gói `uvicorn-worker`); module `uvicorn.workers` cũ đã deprecated (https://uvicorn.dev/deployment/, https://pypi.org/project/uvicorn-worker/)." },
    ],
  },
  sections: [
    {
      title: "WSGI app tối giản (chỉ stdlib)",
      code: {
        lang: "python",
        lines: [
          "from wsgiref.simple_server import make_server",
          "",
          ["def app(environ, start_response):", "Server gọi hàm này một lần cho mỗi request, trong thread của nó."],
          ["    body = f\"hello {environ['PATH_INFO']}\".encode()", "`environ` là `dict` kiểu CGI: `REQUEST_METHOD`, `PATH_INFO`, `wsgi.input` (body)…"],
          "    start_response(\"200 OK\", [(\"Content-Type\", \"text/plain\"),",
          "                              (\"Content-Length\", str(len(body)))])",
          ["    return [body]", "Trả iterable các bytes, không trả `str`. Nếu iterable có `close()`, server phải gọi nó khi xong request."],
          "",
          "if __name__ == \"__main__\":",
          "    with make_server(\"\", 8000, app) as httpd:",
          ["        httpd.serve_forever()", "Server tham chiếu của stdlib, chỉ để học. Production: `gunicorn module:app`."],
        ],
      },
    },
    {
      title: "ASGI app tối giản",
      code: {
        lang: "python",
        lines: [
          ["async def app(scope, receive, send):", "`scope` mô tả kết nối; `receive`/`send` là awaitable trao đổi event."],
          ["    assert scope[\"type\"] == \"http\"", "Cùng một app nhận cả `http`, `websocket`, `lifespan`; app thật phải xử lý hoặc từ chối từng loại."],
          ["    await receive()", "Event `http.request` chứa body."],
          "    body = f\"hello {scope['path']}\".encode()",
          ["    await send({\"type\": \"http.response.start\", \"status\": 200,", "Mọi event là `dict` có khoá `type`."],
          "                \"headers\": [(b\"content-type\", b\"text/plain\")]})",
          "    await send({\"type\": \"http.response.body\", \"body\": body})",
          "",
          "# chạy: uvicorn main:app --workers 4",
        ],
      },
      points: [
        {
          t: "**Lifespan chạy một lần cho mỗi process**, không phải một lần cho cả server: 4 worker thì code startup (mở connection pool, nạp model) chạy 4 lần, và có 4 pool.",
          why: "ASGI lifespan spec: lifespan chạy một lần cho mỗi event loop xử lý request; nhiều process thì mỗi process có sự kiện lifespan riêng (https://asgi.readthedocs.io/en/latest/specs/lifespan.html). Vì vậy số connection tới DB = số worker × kích thước pool × số pod; đặt pool 20 với 4 worker và 10 pod là 800 connection.",
        },
        {
          t: "Startup lỗi thì app nên gửi `lifespan.startup.failed` để server không khởi động; nếu app chỉ ném exception, server **vẫn chạy tiếp** mà không gửi sự kiện lifespan nào nữa.",
          why: "Đây là hành vi spec quy định (https://asgi.readthedocs.io/en/latest/specs/lifespan.html). Với Uvicorn ở `--lifespan auto` (mặc định, https://uvicorn.dev/settings/), exception trong lifespan mà chưa có `startup.failed` chỉ được log là app có vẻ không hỗ trợ lifespan, rồi server chạy tiếp (đọc trong mã nguồn `uvicorn/lifespan/on.py`, bản 0.51). Starlette, và FastAPI dựng trên nó, tự gửi `lifespan.startup.failed` khi hàm lifespan ném lỗi (mã nguồn `Router.lifespan`, Starlette 1.3), nên app không khởi động với pool hỏng.",
        },
      ],
    },
    {
      title: "Một lệnh blocking chặn cả worker ASGI",
      code: {
        lang: "python",
        lines: [
          "import asyncio, time",
          "import httpx",
          "",
          "async def blocking(scope, receive, send):",
          ["    time.sleep(0.5)", "Chặn thread của event loop: không coroutine nào khác chạy được trong 0,5 s."],
          "    await send({\"type\": \"http.response.start\", \"status\": 200, \"headers\": []})",
          "    await send({\"type\": \"http.response.body\", \"body\": b\"ok\"})",
          "",
          "async def nonblocking(scope, receive, send):",
          ["    await asyncio.sleep(0.5)", "Nhả event loop trong lúc chờ: các request khác chạy tiếp."],
          "    await send({\"type\": \"http.response.start\", \"status\": 200, \"headers\": []})",
          "    await send({\"type\": \"http.response.body\", \"body\": b\"ok\"})",
          "",
          "async def measure(app):",
          "    transport = httpx.ASGITransport(app=app)",
          "    async with httpx.AsyncClient(transport=transport, base_url=\"http://t\") as c:",
          "        start = time.perf_counter()",
          ["        await asyncio.gather(*(c.get(\"/\") for _ in range(4)))", "4 request đồng thời vào cùng một event loop."],
          "        return round(time.perf_counter() - start, 1)",
          "",
          ["print(asyncio.run(measure(blocking)))", "→ `2.0`: 4 × 0,5 s, chạy lần lượt."],
          ["print(asyncio.run(measure(nonblocking)))", "→ `0.5`: 4 request chờ cùng lúc."],
        ],
      },
    },
  ],
  points: [
    {
      t: "**Bao nhiêu worker?** Gunicorn gợi ý bắt đầu với `(2 × số core) + 1` rồi chỉnh theo tải đo được; thường 4–12 worker là đủ cho tải lớn. Quá nhiều worker làm tốn tài nguyên và có thể giảm throughput.",
      why: "Công thức, con số 4–12 và cảnh báo lấy từ docs Gunicorn (https://gunicorn.org/design/); docs không giải thích công thức. Cách hiểu hợp lý: nhiều worker hơn số core để trong lúc một worker chờ I/O, worker khác dùng được core đó. Thêm worker vượt xa số core thì các process tranh nhau CPU (context switch, cache), và mỗi process tốn bộ nhớ cho một bản app riêng.",
    },
    {
      t: "**Trên Kubernetes: thường một process mỗi container**, scale bằng số replica, thay vì `--workers` trong container.",
      why: "Docs FastAPI khuyên khi chạy trên Kubernetes thì thường chạy một process Uvicorn mỗi container, không dùng worker (https://fastapi.tiangolo.com/deployment/server-workers/). Lý do về cơ chế: orchestrator đã lo restart, health check, phân tải giữa replica; nhiều worker trong một container làm khó đặt CPU/memory limit và che process chết khỏi health check.",
    },
    {
      t: "**Worker treo bị giết**: Gunicorn giết và khởi động lại worker im lặng quá `timeout` (mặc định 30 giây). Khi deploy, worker có `graceful_timeout` (mặc định 30 giây) để làm xong request đang dở rồi mới bị giết.",
      why: "Hai thiết lập ghi ở https://gunicorn.org/reference/settings/. Request dài hơn `timeout` trên worker sync thì bị cắt giữa chừng; giải pháp là đưa việc dài ra job queue, không tăng `timeout` vô hạn. Quy trình SIGTERM → drain → SIGKILL ở bài `os-signals-shutdown`.",
    },
    {
      t: "**`max_requests`**: worker tự khởi động lại sau N request; **`preload_app`**: nạp code app trước khi fork worker.",
      why: "`max_requests` là cách chặn rò bộ nhớ chậm khi chưa tìm ra nguyên nhân; `preload_app` tiết kiệm RAM và khởi động nhanh hơn (https://gunicorn.org/reference/settings/). RAM giảm vì sau `fork` các worker dùng chung trang bộ nhớ đã nạp cho tới khi ghi (copy-on-write). Cái giá: connection mở lúc nạp app thành một socket mà mọi worker cùng dùng sau `fork`, còn thread chạy nền thì không đi theo sang process con (`fork` chỉ chép thread đang gọi nó). Vì vậy connection DB và thread nền phải tạo sau khi fork, trong từng worker.",
    },
    {
      t: "**CPU-bound trong ASGI**: tính toán nặng (resize ảnh, nén) trong `async def` chặn event loop như `time.sleep`. Đẩy sang process pool (`loop.run_in_executor` với `ProcessPoolExecutor`) hoặc job queue.",
      why: "Thread pool không cứu được việc CPU-bound vì GIL chỉ cho một thread chạy bytecode Python tại một thời điểm; process riêng thì có GIL riêng. Phân tích I/O-bound/CPU-bound chung ở `thr-io-vs-cpu-bound`, thread pool ở `thr-thread-pool`.",
    },
    {
      t: "**WSGI và WebSocket**: giao diện WSGI là một lời gọi trả về một response, nên không có cách chuẩn để giữ kết nối hai chiều. Cần WebSocket thì dùng ASGI (Django Channels, Starlette/FastAPI) hoặc một service riêng.",
      why: "ASGI spec ra đời chính vì WebSocket không theo mẫu request/response của WSGI (https://asgi.readthedocs.io/en/latest/specs/main.html). Worker `gevent` của Gunicorn hỗ trợ WebSocket bằng greenlet, nhưng đó là cơ chế riêng của worker, không thuộc chuẩn WSGI.",
    },
  ],
  tips: [
    {
      t: "Câu \"Gunicorn nên chạy bao nhiêu worker?\": nói công thức `(2 × core) + 1` là **điểm bắt đầu**, rồi nói đo gì để chỉnh: CPU, latency p99, độ dài hàng chờ, RAM mỗi worker; và hỏi lại app I/O-bound hay CPU-bound vì câu trả lời khác nhau.",
      why: "Interviewer muốn thấy bạn biết công thức đến từ đâu và giới hạn của nó, không chỉ thuộc số.",
    },
    {
      t: "Khi tính connection tới DB, nhân đủ các tầng: replica × worker × (pool của mỗi worker). Đây là lỗi hay gặp khi scale app Python lên nhiều pod.",
      why: "Mỗi worker là một process riêng có lifespan và pool riêng; PostgreSQL có giới hạn `max_connections`, vượt thì connection mới bị từ chối.",
    },
  ],
  cards: [
    ["Gunicorn nên chạy bao nhiêu worker?", "Bắt đầu `(2 × core) + 1`, chỉnh theo đo đạc; docs nói 4–12 thường đủ. Trên Kubernetes thường 1 process mỗi container và scale bằng replica."],
    ["WSGI phục vụ WebSocket được không?", "Không theo chuẩn: WSGI là một lời gọi → một response. Dùng ASGI hoặc service riêng; worker gevent có hỗ trợ nhưng ngoài chuẩn WSGI."],
    ["Một worker ASGI bị CPU-bound thì sao?", "Event loop bị chặn, mọi request khác của worker đó đứng chờ. Đẩy việc nặng sang process pool hoặc job queue."],
    ["WSGI app trả về gì?", "Gọi `start_response(status, headers)` rồi trả iterable các bytes."],
    ["Lifespan startup chạy mấy lần khi có 4 worker?", "4 lần, mỗi process một lần; mỗi process có pool riêng."],
    ["Worker `sync` cần gì phía trước?", "Proxy có đệm (nginx, HAProxy) để client chậm không giữ worker."],
    ["`gthread` khác `sync` ở đâu?", "Mỗi worker có N thread, phục vụ N request cùng lúc; hợp với I/O vừa phải, code phải thread-safe."],
  ],
});
