# Catalog đề mục phỏng vấn kỹ sư phần mềm (Backend)

> Đề xuất, chưa phải nội dung. Tài liệu này chỉ liệt kê **đề mục + nguồn** để fill bài sau. Ngày khảo sát: 2026-11-27.
> Phạm vi: toàn cảnh phỏng vấn CS/SWE, tập trung **coding & nền tảng CS** (async, thread & I/O, OS, concurrency, kỹ năng viết code). Mảng System Design chỉ liệt kê để bản đồ đủ, phần nghiên cứu sâu do đề xuất của Solution Architect phụ trách.

Quy ước cột:

- **id**: id đề xuất (kebab-case, có tiền tố theo mảng: `async-`, `thr-`, `io-`, `os-`, `conc-`, `code-`, `dsa-`, `net-`, `db-`, `ood-`, `mc-`, `sd-`, `beh-`). Đã đối chiếu với 107 id hiện có trong `content/**` (topic, problem, sim, track, section dùng chung một namespace) — không trùng. Dòng ghi `(hiện có)` là id đang tồn tại, không đề xuất mới.
- **Mức**: NT = nền tảng · TB = trung bình · NC = nâng cao.
- **Site**: `có` / `một phần (id…)` / `chưa`, dựa trên grep từ khoá trong `content/` ngày 2026-11-27.
- **Ưu tiên**: P0 = hay hỏi + site thiếu, làm trước; P1 = nên có; P2 = bổ sung.
- Câu hỏi tiêu biểu là câu tự viết, không chép từ nền tảng nào.

---

## Phần 1 — Các nền tảng tổ chức chương trình thế nào

| Nền tảng / tài liệu | Cách tổ chức | Mạnh ở | Thiếu (so với nhu cầu của site) | Xác minh |
|---|---|---|---|---|
| Hello Interview — System Design | In a Hurry (Delivery Framework → Core Concepts 9 bài → Key Technologies → Patterns 7 bài) + Question Breakdowns 32 bài + Advanced Topics (Proximity, Vector DB, Time-series, Big-data DS, CDC) + "In the Wild" | Khung trả lời, pattern lặp lại, bài mẫu theo level | Không có nền tảng OS/async/thread | Đã fetch mục lục |
| Hello Interview — LLD | In a Hurry (Delivery, Principles, OOP, Patterns) + Concurrency (Correctness · Coordination · Scarcity) + 9 Problem Breakdowns | Concurrency theo nhóm vấn đề thay vì theo primitive | Không có memory model, async I/O | Đã fetch mục lục |
| Hello Interview — Coding | 16 pattern: Two Pointers, Sliding Window, Intervals, Stack, Linked List, Binary Search, Heap, DFS, BFS, Backtracking, Graphs, DP, Greedy, Trie, Prefix Sum, Matrices | Học theo pattern, gọn | Không có concurrency coding | Đã fetch mục lục |
| Tech Interview Handbook | Quy trình (resume → coding → SD → behavioral → negotiation) + cheatsheet thuật toán 4 tầng (Basics / Data structures / Advanced / Additional) + rubric | Quy trình phỏng vấn, behavioral, rubric chấm điểm | SD và nền tảng CS mỏng | Đã fetch mục lục |
| Grokking the Coding Interview | 41 pattern (Two Pointers, Fast & Slow, Cyclic Sort, K-way Merge, Two Heaps, Topological Sort, Union Find, Monotonic Queue, Multi-threaded, Segment Tree…) | Phủ pattern rộng nhất, có cả pattern "Multi-threaded" | Thương mại, nhiều pattern ít gặp | Đã fetch mục lục |
| Grokking Multithreading & Concurrency | Giới thiệu → construct đồng bộ → bài concurrency Easy/Medium/Hard | Bài tập concurrency dạng coding | Chỉ có tên chương | Đã fetch mục lục |
| ByteByteGo (repo system-design-101) | 15 nhóm: API & Web, Database & Storage, Caching, Architecture, Cloud & Distributed, Security, DevOps, Computer Fundamentals, Technical Interviews… | Hình minh hoạ "how it works" | Không có lộ trình, rời rạc | Đã fetch README |
| Aced (tên mới của Exponent) | Khoá SWE: Intro → Practical Coding → System Design → Behavioral → Coding Questions | Behavioral & mock interview | Ít nền tảng CS | Đã fetch (URL cũ chuyển hướng sang aced.io) |
| NeetCode Roadmap | Cây pattern: Arrays & Hashing → Two Pointers / Stack → Binary Search / Sliding Window / Linked List → Trees → Tries / Heap / Backtracking → Graphs / 1-D DP → … | Thứ tự học phụ thuộc rõ | — | **Chưa xác minh trực tiếp** (trang render bằng JS, fetch trả về rỗng); cấu trúc theo hiểu biết chung |
| Engineer Pro (Việt Nam) | Phase 1 Core Foundations (DSA 3 cấp + CS Fundamentals: Computer Architecture, OS, Linux, C/C++, Networking, Databases, Security) → Phase 2 System Design L1/L2 → Phase 3 Behavioral | Có hẳn khối CS Fundamentals trước SD | Không tách concurrency thành mục riêng | Đã fetch bài lộ trình |
| OSTEP (sách mở) | Virtualization (process, scheduling, VM, paging, TLB) · Concurrency (threads, locks, CV, semaphore, bugs, event-based) · Persistence (I/O, FS, journaling, SSD) · Security | Nguồn chuẩn cho mảng OS + concurrency | — | Đã fetch mục lục |
| DDIA (sách) | Foundations of Data Systems → Distributed Data → Derived Data | Nguồn chuẩn cho DB internals, replication, stream | — | Theo mục lục sách |

**"FutureSengineer" là gì?** Không xác định được. Đã tìm "FutureSengineer", "Future Engineer"/"FutureSWE" và biến thể tiếng Việt, không có kết quả khớp. Nền tảng tiếng Việt xuất hiện gần nhất với lộ trình "DSA → CS Fundamentals → System Design → Behavioral" là Engineer Pro, nhưng đó **chỉ là phỏng đoán**, không có bằng chứng đây là cái người dùng nhắc. Cần hỏi lại người dùng tên chính xác hoặc link.

**Rút ra cho site:** site đang bám rất sát Hello Interview SD/LLD. Khoảng trống lớn nhất nằm ở khối mà Engineer Pro / OSTEP gọi là "CS Fundamentals": OS, thread & I/O, async, memory model; cộng với kỹ năng viết code và behavioral — các nền tảng phỏng vấn thường coi là vòng riêng nhưng site chưa có.

---

## Phần 2 — Catalog theo mảng

### 2.1 Async programming

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `async-concurrency-models` | Các mô hình concurrency: thread, event loop, coroutine, actor — so sánh | NT | `thr-thread-vs-process` | một phần (`concurrency`) | Một server xử lý 10k kết nối: chọn thread-per-request hay event loop, vì sao? · Concurrency khác parallelism thế nào? | [OSTEP ch.33 Event-based](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-events.pdf) · [C10K](http://www.kegel.com/c10k.html) | P0 |
| `async-event-loop` | Event loop hoạt động thế nào (Node.js phases, asyncio loop, libuv) | NT | `async-concurrency-models` | chưa (chỉ nhắc trong `redis-atomic`, `numbers`) | Node.js đơn luồng sao phục vụ được nhiều request? · Thứ tự chạy của setTimeout, setImmediate, process.nextTick? · Redis đơn luồng vẫn nhanh vì sao? | [Node.js event loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) · [libuv design](https://docs.libuv.org/en/v1.x/design.html) · [asyncio event loop](https://docs.python.org/3/library/asyncio-eventloop.html) | P0 |
| `async-callback-promise-await` | Callback → Promise/Future → async/await | NT | `async-event-loop` | chưa | async/await có tạo thread mới không? · Callback hell giải bằng gì? · `await` trong vòng lặp vs chạy song song bằng `gather`/`Promise.all` | [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) · [PEP 492](https://peps.python.org/pep-0492/) · [asyncio tasks](https://docs.python.org/3/library/asyncio-task.html) | P0 |
| `async-microtask-queue` | Microtask vs macrotask (task queue) | TB | `async-event-loop` | chưa | Đoán thứ tự log của đoạn code trộn Promise và setTimeout · Microtask vô hạn làm treo trang thế nào? | [MDN Microtask guide](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) · [HTML spec event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops) | P1 |
| `async-coroutine` | Coroutine: generator, suspend/resume, stackless vs stackful | TB | `async-callback-promise-await` | chưa | Coroutine khác thread ở đâu? · Ai quyết định khi nào coroutine nhường CPU? · Generator liên quan coroutine thế nào? | [PEP 492](https://peps.python.org/pep-0492/) · [Kotlin coroutines](https://kotlinlang.org/docs/coroutines-overview.html) · [Rust async book](https://rust-lang.github.io/async-book/) | P0 |
| `async-future-combinators` | Future/Promise/CompletableFuture: all/any/race, lan truyền lỗi | TB | `async-callback-promise-await` | chưa | `Promise.all` một cái lỗi thì những cái khác ra sao? · Gọi 3 service song song, lấy kết quả nhanh nhất? | [CompletableFuture](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html) · [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) · [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) | P1 |
| `async-blocking-in-loop` | Chặn event loop: CPU-bound / blocking call trong code async, offload sang thread/process pool | TB | `async-event-loop`, `thr-io-vs-cpu-bound` | chưa | Gọi `time.sleep` hoặc `requests.get` trong hàm async thì sao? · Hash mật khẩu trong Node.js làm latency tăng vọt — sửa thế nào? | [Don't block the event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) · [asyncio dev guide](https://docs.python.org/3/library/asyncio-dev.html) · [worker_threads](https://nodejs.org/api/worker_threads.html) | P0 |
| `async-backpressure` | Backpressure trong stream, queue có giới hạn, bounded concurrency | TB | `async-event-loop` | một phần (`queue` nói ở mức hệ thống) | Producer nhanh hơn consumer thì bộ nhớ ra sao? · Giới hạn 100 request đồng thời khi crawl 1 triệu URL? | [Node.js backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams) · [Reactive Streams](https://www.reactive-streams.org/) · [asyncio queues](https://docs.python.org/3/library/asyncio-queue.html) | P0 |
| `async-cancellation-timeout` | Cancellation, timeout, deadline propagation | TB | `async-callback-promise-await` | chưa | Client huỷ request, làm sao dừng các call con? · Timeout ở tầng nào: client, gateway hay DB? · Huỷ task giữa chừng có để lại trạng thái dở không? | [Go context](https://pkg.go.dev/context) · [Go blog: context](https://go.dev/blog/context) · [asyncio timeouts](https://docs.python.org/3/library/asyncio-task.html#timeouts) · [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) | P0 |
| `async-structured-concurrency` | Structured concurrency: TaskGroup, StructuredTaskScope, errgroup | NC | `async-cancellation-timeout` | chưa | Fire-and-forget task có vấn đề gì? · Một subtask lỗi thì các subtask khác xử lý ra sao? | [JEP 453](https://openjdk.org/jeps/453) · [asyncio TaskGroup](https://docs.python.org/3/library/asyncio-task.html#task-groups) | P1 |
| `async-error-handling` | Lỗi trong code async: unhandled rejection, exception bị nuốt trong task | TB | `async-callback-promise-await` | chưa | Exception trong task không ai await thì đi đâu? · Vì sao process Node.js chết vì unhandled rejection? | [asyncio dev guide](https://docs.python.org/3/library/asyncio-dev.html) · [Node.js process events](https://nodejs.org/api/process.html#event-unhandledrejection) | P1 |
| `async-sync-primitives` | Primitive đồng bộ trong async (asyncio.Lock/Semaphore/Queue) — async có race không? | TB | `conc-race-condition` | chưa | Code async đơn luồng có race condition không? · Khi nào cần `asyncio.Lock`? | [asyncio sync](https://docs.python.org/3/library/asyncio-sync.html) | P1 |
| `async-reactive-streams` | Reactive programming (Rx, Reactor) — biết để nhận diện | NC | `async-backpressure` | chưa | Reactive khác async/await ở đâu? · Khi nào đáng dùng? | [Reactive Streams](https://www.reactive-streams.org/) | P2 |

### 2.2 Thread & I/O

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `thr-thread-vs-process` | Thread vs process: bộ nhớ chung, chi phí tạo, cô lập lỗi | NT | `os-process-lifecycle` | chưa | Thread và process khác nhau thế nào? · Một thread crash có kéo cả process không? · Khi nào chọn multi-process? | [OSTEP Threads intro](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) · [CS:APP](http://csapp.cs.cmu.edu/) | P0 |
| `thr-io-vs-cpu-bound` | I/O-bound vs CPU-bound: chọn thread, process hay async | NT | `thr-thread-vs-process` | chưa | Resize ảnh hàng loạt nên dùng thread hay process (Python)? · Gọi 50 API ngoài thì sao? | [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) · [asyncio dev guide](https://docs.python.org/3/library/asyncio-dev.html) | P0 |
| `thr-thread-pool` | Thread pool & executor: sizing, hàng đợi, rejection policy | TB | `thr-io-vs-cpu-bound` | một phần (`concurrency`, sim `long-task`) | Pool bao nhiêu thread là đủ? · Hàng đợi vô hạn của pool gây chuyện gì? · Pool đầy thì xử lý request mới ra sao? | [ThreadPoolExecutor (Java)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html) · [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) · [JCIP](https://jcip.net/) | P0 |
| `io-blocking-models` | Blocking, non-blocking, I/O multiplexing, async I/O | TB | `os-file-descriptors` | chưa | Blocking và non-blocking I/O khác gì? · Non-blocking có phải là async? · Vì sao event loop cần I/O multiplexing? | [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html) · [OSTEP Event-based](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-events.pdf) · [C10K](http://www.kegel.com/c10k.html) | P0 |
| `io-epoll-kqueue` | select/poll → epoll/kqueue: level vs edge triggered | NC | `io-blocking-models` | chưa | Vì sao epoll scale tốt hơn select? · Edge-triggered cần đọc dữ liệu thế nào? | [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html) · [kqueue(2)](https://man.freebsd.org/cgi/man.cgi?query=kqueue) | P1 |
| `io-reactor-proactor` | Reactor vs proactor (Netty, libuv, Nginx) | NC | `io-epoll-kqueue` | chưa | Nginx xử lý nhiều kết nối bằng mô hình gì? · Readiness vs completion khác nhau ở đâu? | [libuv design](https://docs.libuv.org/en/v1.x/design.html) · [Efficient IO with io_uring](https://kernel.dk/io_uring.pdf) | P1 |
| `io-uring` | io_uring & I/O kiểu completion | NC | `io-reactor-proactor` | chưa | io_uring giảm syscall bằng cách nào? · Khi nào đáng dùng? | [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html) · [Efficient IO with io_uring](https://kernel.dk/io_uring.pdf) | P2 |
| `thr-gil` | GIL trong Python & free-threading (PEP 703) | TB | `thr-io-vs-cpu-bound` | chưa | Có GIL thì multithreading Python có vô dụng? · Vì sao vẫn cần lock dù có GIL? | [Glossary: GIL](https://docs.python.org/3/glossary.html#term-global-interpreter-lock) · [PEP 703](https://peps.python.org/pep-0703/) · [Free-threading HOWTO](https://docs.python.org/3/howto/free-threading-python.html) | P0 |
| `thr-green-threads` | Green thread & M:N scheduling: goroutine, Java virtual thread | TB | `thr-thread-vs-process`, `os-context-switch` | chưa | Goroutine rẻ hơn OS thread vì sao? · Virtual thread thay thế reactive được không? | [JEP 444](https://openjdk.org/jeps/444) · [Effective Go: concurrency](https://go.dev/doc/effective_go#concurrency) · [Go FAQ goroutines](https://go.dev/doc/faq#goroutines) | P0 |
| `thr-virtual-threads-java` | Java virtual threads chi tiết: pinning, khi nào không có lợi | NC | `thr-green-threads` | chưa | Virtual thread có giúp code CPU-bound? · Pinning xảy ra khi nào? | [JEP 444](https://openjdk.org/jeps/444) | P1 |
| `thr-goroutine-channel` | Goroutine, channel, select, pipeline pattern trong Go | TB | `thr-green-threads` | chưa | Unbuffered vs buffered channel? · Goroutine leak sinh ra thế nào? · Fan-out/fan-in? | [Go blog: pipelines](https://go.dev/blog/pipelines) · [Effective Go](https://go.dev/doc/effective_go#concurrency) | P1 |
| `io-connection-pool` | Connection pool (DB/HTTP): sizing, leak, timeout | TB | `thr-thread-pool` | chưa | Pool DB nên bao nhiêu connection? · Triệu chứng connection leak? | [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) | P1 |
| `io-buffering-fsync` | Buffered I/O, flush, fsync — dữ liệu "đã ghi" nằm ở đâu | TB | `os-file-descriptors` | chưa | `write()` trả về thì dữ liệu đã xuống đĩa chưa? · fsync tốn kém vì sao? | [fsync(2)](https://man7.org/linux/man-pages/man2/fsync.2.html) · [OSTEP Journaling](https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf) | P1 |
| `io-zero-copy` | Zero-copy (sendfile, mmap) & page cache | NC | `os-virtual-memory` | chưa | Kafka đọc đĩa nhanh nhờ gì? · sendfile tiết kiệm bước copy nào? | [sendfile(2)](https://man7.org/linux/man-pages/man2/sendfile.2.html) · [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html) | P2 |
| `thr-thread-local-context` | Thread-local & truyền context (request id, trace) qua thread/task | TB | `thr-thread-pool` | chưa | ThreadLocal trong pool có rủi ro gì? · contextvars khác thread-local thế nào? | [contextvars](https://docs.python.org/3/library/contextvars.html) | P2 |

### 2.3 Process & OS

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `os-process-lifecycle` | Process lifecycle: fork/exec/wait, trạng thái, zombie, orphan | NT | — | chưa | Chuyện gì xảy ra khi gõ lệnh trong shell? · Zombie process là gì, dọn thế nào? | [OSTEP Process API](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf) · [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) | P0 |
| `os-syscall-kernel-mode` | System call, user mode vs kernel mode | NT | `os-process-lifecycle` | chưa | Vì sao syscall đắt hơn gọi hàm? · Trap/interrupt là gì? | [OSTEP Direct Execution](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf) | P1 |
| `os-context-switch` | Context switch: chi phí, so sánh process / thread / coroutine | NT | `os-syscall-kernel-mode` | chưa (chỉ nhắc trong `kafka`, `redis`) | Context switch lưu những gì? · Vì sao hàng nghìn thread làm hệ thống chậm? | [OSTEP Direct Execution](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf) | P0 |
| `os-scheduling` | CPU scheduling: preemptive, time slice, MLFQ, CFS, priority | TB | `os-context-switch` | chưa | Preemptive vs cooperative scheduling? · Vì sao job ngắn bị đói khi có job dài? | [OSTEP Scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) | P1 |
| `os-memory-layout` | Memory layout: stack vs heap, stack overflow, cấp phát | NT | — | chưa | Biến cục bộ và object nằm ở đâu? · Đệ quy sâu gây lỗi gì, vì sao? | [OSTEP Address Spaces](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf) · [OSTEP Memory API](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-api.pdf) | P0 |
| `os-virtual-memory` | Virtual memory, paging, TLB, page fault, swap | TB | `os-memory-layout` | chưa | Vì sao mỗi process tưởng mình có cả bộ nhớ? · Page fault xảy ra khi nào, có phải lỗi? · Swap nhiều thì latency ra sao? | [OSTEP Paging](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf) · [OSTEP TLBs](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf) · [OSTEP Swapping](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf) | P0 |
| `os-file-descriptors` | File descriptor, ulimit, "too many open files"; socket cũng là fd | TB | `os-process-lifecycle` | chưa | Lỗi "too many open files" do đâu, sửa thế nào? · fd được kế thừa qua fork ra sao? | [open(2)](https://man7.org/linux/man-pages/man2/open.2.html) · [getrlimit(2)](https://man7.org/linux/man-pages/man2/getrlimit.2.html) | P1 |
| `os-ipc` | IPC: pipe, Unix socket, shared memory, message queue | TB | `thr-thread-vs-process` | chưa | Hai process trao đổi dữ liệu bằng cách nào? · Shared memory nhanh nhưng rủi ro gì? | [pipe(7)](https://man7.org/linux/man-pages/man7/pipe.7.html) · [unix(7)](https://man7.org/linux/man-pages/man7/unix.7.html) · [shm_overview(7)](https://man7.org/linux/man-pages/man7/shm_overview.7.html) | P1 |
| `os-signals-shutdown` | Signals & graceful shutdown: SIGTERM vs SIGKILL, PID 1 trong container | TB | `os-process-lifecycle` | một phần (sim `ecs-flow`, `eks-flow`) | Deploy mới thì request đang chạy bị gì? · Vì sao app trong container không nhận SIGTERM? | [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) · [Kubernetes pod termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) | P0 |
| `os-containers-primitives` | Container dưới góc OS: namespaces, cgroups, giới hạn CPU/memory | TB | `os-process-lifecycle` | một phần (`ecs`, `eks`) | Container khác VM thế nào? · Vượt memory limit thì chuyện gì xảy ra? | [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) · [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html) | P1 |
| `os-filesystem` | File system: inode, journaling, page cache | TB | `io-buffering-fsync` | chưa | Xoá file đang mở thì sao? · Journaling chống mất dữ liệu thế nào? | [OSTEP Files & Directories](https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf) · [OSTEP Journaling](https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf) | P2 |
| `os-cpu-cache-locality` | CPU cache, locality, false sharing | NC | `os-memory-layout` | chưa | Duyệt mảng 2 chiều theo hàng vs cột khác gì? · False sharing là gì? | [What Every Programmer Should Know About Memory](https://people.freebsd.org/~lstewart/articles/cpumemory.pdf) | P2 |
| `os-linux-diagnostics` | Công cụ chẩn đoán: top, ps, strace, lsof, vmstat, /proc | TB | `os-file-descriptors` | chưa | Server CPU 100% — bạn chạy lệnh gì đầu tiên? · Tìm process đang giữ port? | [proc(5)](https://man7.org/linux/man-pages/man5/proc.5.html) · [strace(1)](https://man7.org/linux/man-pages/man1/strace.1.html) · [lsof(8)](https://man7.org/linux/man-pages/man8/lsof.8.html) | P2 |

### 2.4 Concurrency

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `conc-race-condition` | Race condition, data race, critical section, check-then-act | NT | `thr-thread-vs-process` | một phần (`concurrency`, sim `seat`) | `count += 1` từ 2 thread sai ở đâu? · Race condition khác data race? | [OSTEP Concurrency intro](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf) · [Go race detector](https://go.dev/doc/articles/race_detector) | P0 |
| `concurrency` (hiện có) | Mutex, semaphore, condition variable | NT | `conc-race-condition` | có | Mutex vs semaphore? · Vì sao chờ condition phải dùng `while` chứ không `if`? | [OSTEP Locks](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf) · [OSTEP CV](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf) · [OSTEP Semaphores](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf) | P1 |
| `conc-monitor-rwlock` | Monitor, read-write lock, reentrant lock, spinlock, độ mịn lock | TB | `concurrency` | chưa | Khi nào dùng read-write lock? · Spinlock hợp lý khi nào? · Lock thô vs lock mịn? | [OSTEP Monitors](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-monitors.pdf) · [java.util.concurrent.locks](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/package-summary.html) · [futex(7)](https://man7.org/linux/man-pages/man7/futex.7.html) | P1 |
| `deadlock` (sim hiện có) / `concurrency` | Deadlock: 4 điều kiện Coffman, lock ordering, timeout | TB | `concurrency` | có | Nêu 4 điều kiện deadlock và cách phá từng cái · Phát hiện deadlock trên production? | [OSTEP Concurrency Bugs](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf) | P1 |
| `conc-livelock-starvation` | Livelock, starvation, priority inversion, fairness | TB | `concurrency` | chưa | Livelock khác deadlock ở đâu? · Lock không fair gây đói thread thế nào? | [OSTEP Concurrency Bugs](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf) · [ReentrantLock fairness](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html) | P0 |
| `conc-atomic-cas` | Atomic, CAS, lock-free, ABA problem | TB | `conc-race-condition` | một phần (atomic ở mức Redis/DB: `redis-atomic`, `dist-lock`) | CAS hoạt động thế nào? · Lock-free có luôn nhanh hơn lock? · ABA là gì? | [java.util.concurrent.atomic](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/package-summary.html) · [cppreference atomic](https://en.cppreference.com/w/cpp/atomic) | P0 |
| `conc-memory-model` | Memory model: visibility, reordering, happens-before, volatile | NC | `conc-atomic-cas` | chưa | Vì sao thread khác không thấy giá trị mới? · `volatile` đảm bảo gì và không đảm bảo gì? · Double-checked locking sai ở đâu? | [JLS ch.17 Memory Model](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) · [Go memory model](https://go.dev/ref/mem) · [cppreference memory_order](https://en.cppreference.com/w/cpp/atomic/memory_order) | P0 |
| `conc-producer-consumer` | Producer–consumer, bounded buffer, blocking queue | TB | `concurrency` | một phần (`concurrency` nhắc blocking queue) | Cài bounded blocking queue bằng lock + condition · Poison pill để dừng consumer? | [OSTEP CV](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf) · [BlockingQueue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html) · [queue (Python)](https://docs.python.org/3/library/queue.html) | P1 |
| `conc-actor-model` | Actor model & message passing ("share memory by communicating") | TB | `async-concurrency-models` | chưa | Actor tránh lock bằng cách nào? · Mailbox đầy thì sao? | [Erlang: concurrent programming](https://www.erlang.org/doc/system/conc_prog.html) · [Effective Go: share by communicating](https://go.dev/doc/effective_go#sharing) | P1 |
| `conc-thread-safe-collections` | Cấu trúc dữ liệu thread-safe: concurrent map, copy-on-write, chia sẻ immutable | TB | `conc-atomic-cas` | chưa | ConcurrentHashMap khác `synchronized` map ở đâu? · Khi nào copy-on-write hợp lý? | [ConcurrentHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html) · [JCIP](https://jcip.net/) | P1 |
| `conc-classic-problems` | Bài coding concurrency kinh điển: in theo thứ tự, readers–writers, dining philosophers, bounded blocking queue, rate limiter in-memory | TB | `concurrency`, `conc-producer-consumer` | chưa | Cho 3 thread in "foo", "bar", "baz" đúng thứ tự · Cài thread-safe LRU / rate limiter | [OSTEP Semaphores](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf) · [Grokking Concurrency (mục lục)](https://www.designgurus.io/course/grokking-multithreading-and-concurrency-for-coding-interviews) | P0 |
| `conc-optimistic-pessimistic` | Optimistic vs pessimistic concurrency control (version, CAS, SELECT FOR UPDATE) | TB | `conc-atomic-cas`, `db-locking` | một phần (`core-db`, sim `isolation`, `ticketmaster`) | Hai người sửa cùng bản ghi — chọn version hay lock? · Khi tranh chấp cao, optimistic có còn tốt? | [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) · [DDIA](https://dataintensive.net/) | P1 |
| `conc-parallelism-amdahl` | Concurrency vs parallelism, Amdahl's law | NT | `thr-io-vs-cpu-bound` | một phần (`concurrency` tldr) | Thêm gấp đôi core có nhanh gấp đôi? · Phần nào của chương trình giới hạn speedup? | [OSTEP Multi-CPU Scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-multi.pdf) | P1 |
| `conc-testing-debugging` | Kiểm thử & debug concurrency: race detector, stress test, thread dump | NC | `conc-race-condition` | chưa | Test qua 1000 lần vẫn có bug race — làm sao bắt? · Đọc thread dump tìm deadlock? | [Go race detector](https://go.dev/doc/articles/race_detector) · [ThreadSanitizer](https://clang.llvm.org/docs/ThreadSanitizer.html) | P1 |

### 2.5 Kỹ năng viết code / kỹ thuật lập trình

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `code-interview-communication` | Kỹ năng vòng coding: làm rõ đề, nói to, brute force trước, tự test, edge case | NT | — | chưa | Đề mơ hồ — bạn hỏi gì trước khi code? · Viết xong, tự test bằng ví dụ nào? | [TIH: techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · [TIH: rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) | P0 |
| `code-clean-naming` | Clean code: đặt tên, hàm nhỏ, một mức trừu tượng, comment khi nào | NT | — | chưa | Đặt tên tốt có tiêu chí gì? · Hàm dài 200 dòng tách theo cách nào? | [Google style guides](https://google.github.io/styleguide/) · [Refactoring catalog](https://refactoring.com/catalog/) | P0 |
| `code-error-handling` | Error handling: exception vs error value, fail fast, không nuốt lỗi, lỗi có ngữ cảnh | NT | — | chưa | Exception hay trả mã lỗi? · `catch (Exception e) {}` sai ở đâu? · Lỗi nào nên retry, lỗi nào không? | [Go blog: errors](https://go.dev/blog/error-handling-and-go) · [Python tutorial: errors](https://docs.python.org/3/tutorial/errors.html) · [Rust book: error handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html) | P0 |
| `code-defensive-validation` | Defensive programming: validate ở biên, invariant, assert, "parse, don't validate" | TB | `code-error-handling` | chưa | Validate ở đâu: controller, service hay domain? · Assert khác validation thế nào? | [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) | P1 |
| `code-testing-fundamentals` | Testing: unit / integration / e2e, test pyramid, test double (mock, stub, fake) | NT | — | một phần (`dev-methods`, sim `tdd-codewalk`) | Mock và stub khác nhau? · Test nào nên nhiều nhất, vì sao? · Test giòn (flaky) do đâu? | [Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) · [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) | P0 |
| `code-testable-design` | Viết code dễ test: dependency injection, pure function, seam | TB | `code-testing-fundamentals` | một phần (`code-architecture`) | Hàm gọi thẳng `datetime.now()` khó test thế nào, sửa ra sao? · DI có cần framework? | [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) · [Inversion of Control](https://martinfowler.com/articles/injection.html) | P1 |
| `code-debugging` | Debugging có hệ thống: tái hiện, thu hẹp, chia đôi (git bisect), đọc stack trace | NT | — | chưa | Bug chỉ xảy ra trên production — làm gì trước? · Kể một bug khó nhất bạn từng sửa | [git bisect](https://git-scm.com/docs/git-bisect) · [pdb](https://docs.python.org/3/library/pdb.html) | P0 |
| `code-review` | Code review: review cái gì, viết comment, nhận góp ý | TB | `code-clean-naming` | chưa | Khi review bạn nhìn gì đầu tiên? · Bất đồng trong review xử lý thế nào? | [Google eng-practices: review](https://google.github.io/eng-practices/review/) | P1 |
| `code-refactoring` | Refactoring & code smell: bước nhỏ an toàn, khi nào nên/không nên | TB | `code-testing-fundamentals` | một phần (`dev-methods` nhắc trong TDD) | Refactor code legacy không có test thế nào? · Code smell nào hay gặp nhất? | [Refactoring catalog](https://refactoring.com/catalog/) · [Code Smell](https://martinfowler.com/bliki/CodeSmell.html) | P1 |
| `code-api-design-code` | API ở mức code: interface nhỏ, ít tham số, tương thích ngược, Hyrum's law | TB | `code-clean-naming` | chưa (`api-design` là HTTP API) | Thiết kế chữ ký hàm cho thư viện retry · Đổi kiểu trả về có phá client không? | [Hyrum's Law](https://www.hyrumslaw.com/) · [Semantic Versioning](https://semver.org/) | P1 |
| `code-immutability` | Immutability & value object: lợi ích, chi phí | TB | `code-clean-naming` | chưa | Immutable giúp gì cho concurrency? · Value object khác entity? | [JEP 395 Records](https://openjdk.org/jeps/395) · [dataclasses frozen](https://docs.python.org/3/library/dataclasses.html) | P1 |
| `code-fp-vs-oop` | Functional vs OOP: pure function, higher-order, composition over inheritance | TB | `oop-pillars` | một phần (`oop-pillars`, `principles-other`) | Khi nào chọn composition thay vì kế thừa? · Side effect gây khó gì? | [Python Functional HOWTO](https://docs.python.org/3/howto/functional.html) | P1 |
| `code-complexity-perf` | Hiệu năng ở mức code: chọn cấu trúc dữ liệu, profile trước khi tối ưu | TB | `bigo` | một phần (`bigo`) | Code chậm — bạn đo bằng gì? · `list` vs `set` khi kiểm tra tồn tại? | [Python TimeComplexity](https://wiki.python.org/moin/TimeComplexity) · [Python profilers](https://docs.python.org/3/library/profile.html) | P1 |
| `code-memory-gc` | Quản lý bộ nhớ & GC: reference counting, tracing, generational, memory leak | TB | `os-memory-layout` | chưa | Ngôn ngữ có GC vẫn bị memory leak vì sao? · Stop-the-world pause ảnh hưởng latency thế nào? | [Go GC guide](https://go.dev/doc/gc-guide) · [Java GC tuning](https://docs.oracle.com/en/java/javase/21/gctuning/) · [V8: Trash talk](https://v8.dev/blog/trash-talk) · [Python gc](https://docs.python.org/3/library/gc.html) | P1 |
| `code-generics-types` | Generics & type system: static vs dynamic, variance, type erasure | TB | — | chưa | Generic giải bài gì? · `List<Object>` có nhận `List<String>`? | [Java generics tutorial](https://docs.oracle.com/javase/tutorial/java/generics/index.html) · [Go generics tutorial](https://go.dev/doc/tutorial/generics) · [typing](https://docs.python.org/3/library/typing.html) | P2 |
| `code-secure-coding` | Secure coding cơ bản: injection, secret, input validation | TB | `code-defensive-validation` | chưa (`MIRO_GAPS`: Security trống) | SQL injection chống thế nào? · Lưu mật khẩu ra sao? | [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) · [OWASP Top 10](https://owasp.org/www-project-top-ten/) | P1 |
| `code-logging` | Logging ở mức code: level, structured log, không log secret | TB | `code-error-handling` | chưa | Log gì ở mức ERROR vs INFO? · Vì sao nên log có cấu trúc? | [Python Logging HOWTO](https://docs.python.org/3/howto/logging.html) · [Twelve-Factor: Logs](https://12factor.net/logs) | P2 |
| `code-language-choice` | Chọn ngôn ngữ phỏng vấn & thư viện chuẩn cần thuộc | NT | — | chưa | Ngôn ngữ nào dùng cho phỏng vấn, vì sao? · Cấu trúc dữ liệu có sẵn nào cần thuộc? | [TIH: programming languages](https://www.techinterviewhandbook.org/programming-languages-for-coding-interviews/) · [heapq](https://docs.python.org/3/library/heapq.html) | P1 |
| `code-git-workflow` | Git & quy trình: commit nhỏ, branch, semver | NT | — | chưa | Merge vs rebase? · Commit message tốt trông thế nào? | [Pro Git](https://git-scm.com/book/en/v2) · [Semantic Versioning](https://semver.org/) | P2 |

### 2.6 DSA patterns

Site hiện gom phần lớn pattern vào 1 bảng trong `algo` + `ds` + `bigo` (+ sim `binary-search`). "Một phần" ở dưới nghĩa là có một dòng trong bảng, chưa có bài riêng với bài tập mẫu.

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `dsa-arrays-hashing` | Array & hashing: đếm tần suất, two-sum, nhóm theo key | NT | `bigo` | một phần (`ds`) | Tìm 2 số có tổng bằng k trong O(n) · Nhóm anagram | [TIH: Hash table](https://www.techinterviewhandbook.org/algorithms/hash-table/) | P1 |
| `dsa-two-pointers` | Two pointers & fast/slow pointers | NT | `dsa-arrays-hashing` | một phần (`algo`, `ds`) | 3-sum · Phát hiện chu trình trong linked list | [HI Coding](https://www.hellointerview.com/learn/code) · [TIH: Array](https://www.techinterviewhandbook.org/algorithms/array/) | P0 |
| `dsa-sliding-window` | Sliding window cố định / co giãn | NT | `dsa-two-pointers` | một phần (`algo`) | Chuỗi con dài nhất không lặp ký tự · Tổng lớn nhất của k phần tử liên tiếp | [TIH: String](https://www.techinterviewhandbook.org/algorithms/string/) | P0 |
| `dsa-binary-search-answer` | Binary search, kể cả tìm kiếm trên không gian đáp án | TB | `bigo` | một phần (`algo`, sim `binary-search`) | Tìm trong mảng xoay · Tốc độ nhỏ nhất để ăn hết chuối trong h giờ | [TIH: Sorting & searching](https://www.techinterviewhandbook.org/algorithms/sorting-searching/) | P1 |
| `dsa-sorting` | Sorting: quick/merge/heap, ổn định, counting/bucket | NT | `bigo` | một phần (`bigo`) | Merge sort vs quick sort khi nào chọn? · Sort ổn định nghĩa là gì? | [MIT 6.006](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | P1 |
| `dsa-intervals` | Intervals: merge, insert, sweep line | TB | `dsa-sorting` | một phần (`algo`) | Gộp khoảng chồng nhau · Số phòng họp tối thiểu | [TIH: Interval](https://www.techinterviewhandbook.org/algorithms/interval/) | P1 |
| `dsa-stack-monotonic` | Stack, monotonic stack / queue | TB | `ds` | một phần (`algo`, `ds`) | Next greater element · Ngoặc hợp lệ · Max trong sliding window | [TIH: Stack](https://www.techinterviewhandbook.org/algorithms/stack/) | P1 |
| `dsa-linked-list` | Linked list: đảo in-place, dummy node, merge | NT | `ds` | một phần (`ds`) | Đảo linked list · Merge k danh sách đã sort | [TIH: Linked list](https://www.techinterviewhandbook.org/algorithms/linked-list/) | P1 |
| `dsa-trees` | Tree: DFS/BFS, BST, LCA, serialize | NT | `dsa-recursion` | một phần (`ds`) | Kiểm tra BST hợp lệ · Lowest common ancestor · Duyệt theo tầng | [TIH: Tree](https://www.techinterviewhandbook.org/algorithms/tree/) | P0 |
| `dsa-heap-topk` | Heap: top-K, K-way merge, two heaps (median) | TB | `ds` | một phần (`ds`, bài `top-k`) | K phần tử lớn nhất · Median của luồng số | [TIH: Heap](https://www.techinterviewhandbook.org/algorithms/heap/) · [heapq](https://docs.python.org/3/library/heapq.html) | P1 |
| `dsa-graphs` | Graph: BFS/DFS trên grid, topological sort, union-find, Dijkstra | TB | `dsa-trees` | một phần (`algo`) | Đếm số đảo · Thứ tự học môn (course schedule) · Đường đi ngắn nhất có trọng số | [TIH: Graph](https://www.techinterviewhandbook.org/algorithms/graph/) · [cp-algorithms](https://cp-algorithms.com/) | P0 |
| `dsa-backtracking` | Backtracking: subsets, permutations, N-Queens | TB | `dsa-recursion` | một phần (`algo`) | Sinh mọi tập con · Word search trên bảng | [TIH: Recursion](https://www.techinterviewhandbook.org/algorithms/recursion/) | P1 |
| `dsa-dp` | Dynamic programming: 1D/2D, knapsack, LIS, edit distance | NC | `dsa-recursion` | một phần (`algo`) | Coin change · Longest common subsequence · Nhận ra bài là DP từ dấu hiệu nào? | [TIH: DP](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · [MIT 6.006](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | P0 |
| `dsa-design-ds` | Thiết kế cấu trúc dữ liệu: LRU/LFU cache, min stack, iterator, hit counter | TB | `dsa-linked-list`, `dsa-arrays-hashing` | chưa (LRU chỉ nhắc trong `ds`, `caching`) | Cài LRU cache O(1) · Thiết kế hit counter 5 phút gần nhất | [OrderedDict](https://docs.python.org/3/library/collections.html#collections.OrderedDict) · [LinkedHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html) | P0 |
| `dsa-trie` | Trie: prefix search, autocomplete | TB | `dsa-trees` | chưa | Cài trie với insert/search/startsWith · Word search II | [TIH: Trie](https://www.techinterviewhandbook.org/algorithms/trie/) | P1 |
| `dsa-recursion` | Recursion & phân tích độ phức tạp đệ quy | NT | `bigo` | một phần (`algo`) | Độ phức tạp của Fibonacci đệ quy? · Chuyển đệ quy sang vòng lặp | [TIH: Recursion](https://www.techinterviewhandbook.org/algorithms/recursion/) | P2 |
| `dsa-prefix-sum` | Prefix sum & difference array | NT | `dsa-arrays-hashing` | một phần (`algo`) | Số mảng con có tổng bằng k · Range sum query | [HI Coding](https://www.hellointerview.com/learn/code) | P2 |
| `dsa-greedy` | Greedy & cách kiểm chứng | TB | `dsa-sorting` | một phần (`algo`) | Jump game · Lập lịch nhiều việc nhất | [MIT 6.006](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/) | P2 |
| `dsa-matrix` | Matrix: duyệt xoắn ốc, xoay, flood fill | NT | `dsa-graphs` | chưa | Xoay ma trận 90° in-place · In ma trận xoắn ốc | [TIH: Matrix](https://www.techinterviewhandbook.org/algorithms/matrix/) | P2 |
| `dsa-strings` | String: palindrome, anagram, rolling hash / KMP | TB | `dsa-sliding-window` | chưa | Chuỗi con palindrome dài nhất · Tìm pattern trong text | [TIH: String](https://www.techinterviewhandbook.org/algorithms/string/) · [cp-algorithms: strings](https://cp-algorithms.com/string/prefix-function.html) | P2 |
| `dsa-bit-manipulation` | Bit manipulation | TB | — | chưa | Tìm số xuất hiện một lần · Đếm bit 1 | [TIH: Binary](https://www.techinterviewhandbook.org/algorithms/binary/) | P2 |
| `dsa-range-trees` | Segment tree / Fenwick tree (biết để nhận diện) | NC | `dsa-trees` | chưa | Range sum có update · Khi nào cần segment tree thay prefix sum? | [cp-algorithms: segment tree](https://cp-algorithms.com/data_structures/segment_tree.html) | P2 |

### 2.7 Networking

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `networking` (hiện có) | OSI/TCP-IP, L3/L4/L7, TCP vs UDP, WebSocket/SSE/gRPC | NT | — | có | TCP vs UDP khi nào? · L4 vs L7 LB? | [HPBN](https://hpbn.co/) | P2 |
| `net-url-to-page` | "Gõ URL vào trình duyệt thì chuyện gì xảy ra" | NT | `networking` | chưa | Kể đầy đủ từ DNS tới render · Bước nào tốn thời gian nhất? | [HPBN](https://hpbn.co/) · [MDN: How browsers work](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work) | P0 |
| `net-tcp-deep` | TCP sâu: handshake, đóng kết nối, TIME_WAIT, flow & congestion control, Nagle | TB | `networking` | một phần (`networking`) | Vì sao cần 3-way handshake? · Nhiều TIME_WAIT trên server có sao không? · Congestion control làm gì? | [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) · [RFC 5681](https://www.rfc-editor.org/rfc/rfc5681) · [tcp(7)](https://man7.org/linux/man-pages/man7/tcp.7.html) | P0 |
| `net-http-versions` | HTTP/1.1 → HTTP/2 → HTTP/3 (QUIC): multiplexing, head-of-line blocking | TB | `net-tcp-deep` | một phần (`networking`, `api-design`) | HTTP/2 giải HOL blocking đến đâu? · Vì sao HTTP/3 chuyển sang UDP? | [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113) · [RFC 9114](https://www.rfc-editor.org/rfc/rfc9114) · [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000) | P0 |
| `net-http-semantics` | HTTP semantics: method, status code, idempotency, caching header, keep-alive | NT | `networking` | một phần (`api-design`) | PUT vs PATCH vs POST? · 401 vs 403? · ETag dùng để làm gì? | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) · [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) | P1 |
| `net-tls` | TLS handshake, certificate chain, mTLS, TLS termination | TB | `net-tcp-deep` | một phần (`networking` nhắc 1 lần) | HTTPS bảo vệ được gì, không bảo vệ gì? · TLS 1.3 nhanh hơn 1.2 ở đâu? · mTLS dùng khi nào? | [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446) · [HPBN: TLS](https://hpbn.co/transport-layer-security-tls/) | P0 |
| `net-dns-deep` | DNS: resolve đệ quy, TTL, loại record, DNS-based load balancing | NT | `networking` | một phần (`networking`) | Đổi IP mà client vẫn gọi IP cũ vì sao? · A vs CNAME? | [RFC 1034](https://www.rfc-editor.org/rfc/rfc1034) · [RFC 1035](https://www.rfc-editor.org/rfc/rfc1035) | P1 |
| `net-sockets` | Socket: listen/accept, backlog, ephemeral port exhaustion, keep-alive | TB | `os-file-descriptors` | chưa | Server mở được bao nhiêu kết nối? · Client hết ephemeral port khi nào? | [socket(7)](https://man7.org/linux/man-pages/man7/socket.7.html) · [listen(2)](https://man7.org/linux/man-pages/man2/listen.2.html) | P1 |
| `net-cors-cookies` | Same-origin, CORS, cookie flags, CSRF | TB | `net-http-semantics` | một phần (`networking`, `api-design` nhắc cookie) | CORS chặn ở client hay server? · SameSite cookie chống gì? | [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | P1 |
| `net-proxy-nat` | Forward/reverse proxy, NAT, keep-alive qua proxy | TB | `lb-gateway-cdn` | một phần (`lb-gateway-cdn`) | Reverse proxy khác LB? · NAT ảnh hưởng kết nối P2P thế nào? | [HPBN](https://hpbn.co/) | P2 |
| `net-serialization` | Serialization: JSON vs Protobuf, schema evolution | TB | `api-design` | một phần (`api-design` gRPC) | Thêm field vào Protobuf có phá client cũ? · Vì sao binary nhỏ/nhanh hơn? | [Protobuf: updating messages](https://protobuf.dev/programming-guides/proto3/#updating) · [DDIA](https://dataintensive.net/) | P2 |

### 2.8 Database internals

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `db-isolation-anomalies` | Isolation level & anomaly: dirty read, non-repeatable read, phantom, lost update, write skew | TB | `core-db` | một phần (`core-db`, sim `isolation`) | Read Committed có chặn lost update? · Write skew là gì, ví dụ trực ca bác sĩ | [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · [Critique of ANSI SQL isolation](https://arxiv.org/abs/cs/0701157) | P0 |
| `db-locking` | Lock trong DB: row lock, gap/next-key lock, SELECT FOR UPDATE, deadlock DB | TB | `db-isolation-anomalies` | một phần (`core-db`, sim `deadlock`) | SELECT FOR UPDATE khoá những gì? · Hai transaction deadlock thì DB làm gì? | [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) · [InnoDB locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html) | P0 |
| `db-query-tuning` | Query plan & EXPLAIN, N+1, index không được dùng | TB | `indexing` | một phần (`indexing`, sim `n-plus-one`) | Đọc EXPLAIN thấy Seq Scan — làm gì? · Vì sao `WHERE LOWER(email)=…` không dùng index? | [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · [Use The Index, Luke](https://use-the-index-luke.com/) | P0 |
| `db-sql-handwriting` | Viết SQL tay: join, group by, having, window function, subquery | NT | `core-db` | chưa | Top 3 lương mỗi phòng ban · LEFT JOIN vs INNER JOIN khác kết quả khi nào? | [PostgreSQL tutorial: window functions](https://www.postgresql.org/docs/current/tutorial-window.html) | P1 |
| `db-mvcc` | MVCC & snapshot: Postgres vs InnoDB, vacuum/undo | NC | `db-isolation-anomalies` | một phần (glossary, sim `isolation`) | MVCC giúp đọc không chặn ghi thế nào? · Transaction dài gây phình bảng vì sao? | [PostgreSQL MVCC](https://www.postgresql.org/docs/current/mvcc.html) · [CMU 15-445](https://15445.courses.cs.cmu.edu/) | P1 |
| `db-storage-engines` | Storage engine: B-Tree vs LSM-Tree, page, compaction, write amplification | TB | `indexing` | một phần (`core-db`, `indexing`) | Vì sao Cassandra ghi nhanh? · B-Tree đọc tốt hơn LSM ở đâu? | [DDIA](https://dataintensive.net/) · [LSM-tree paper](https://www.cs.umb.edu/~poneil/lsmtree.pdf) · [RocksDB overview](https://github.com/facebook/rocksdb/wiki/RocksDB-Overview) | P1 |
| `db-wal-recovery` | WAL, checkpoint, crash recovery | TB | `io-buffering-fsync` | một phần (`core-db`) | Commit trả về rồi máy mất điện thì dữ liệu còn không? · WAL liên quan replication thế nào? | [PostgreSQL WAL](https://www.postgresql.org/docs/current/wal-intro.html) | P1 |
| `db-schema-migration` | Migration schema không downtime (expand / contract) | TB | `data-modeling` | chưa | Đổi tên cột trên bảng 1 tỷ dòng đang chạy? · Thêm cột NOT NULL an toàn thế nào? | [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) · [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) | P1 |
| `db-normalization` | Normalization vs denormalization | NT | `data-modeling` | một phần (`data-modeling`) | 3NF là gì? · Khi nào cố tình denormalize? | [DDIA](https://dataintensive.net/) | P2 |

### 2.9 LLD / OOD & machine coding

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `oop-pillars`, `solid`, `principles-other`, `patterns-gof`, `lld-delivery` (hiện có) | OOP, SOLID, KISS/DRY/YAGNI, GoF, khung trả lời LLD | NT | — | có | Liskov vi phạm trông thế nào? · Strategy vs State? | [HI LLD](https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction) | P2 |
| `ood-problem-walkthroughs` | Lời giải chi tiết các bài LLD (Parking Lot, Elevator, Connect Four, Locker, File System, Movie Booking, Logger, Rate Limiter, Inventory) | TB | `lld-delivery` | một phần (`lld-problems-list`, sim `vending`) | Thiết kế bãi đỗ xe nhiều loại xe · Elevator chọn thang thế nào? | [HI LLD](https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction) | P0 |
| `mc-machine-coding-round` | Vòng machine coding: 60–120 phút ra code chạy được, chia module, test, mở rộng | TB | `ood-problem-walkthroughs`, `code-testing-fundamentals` | chưa | Trong 90 phút, ưu tiên phần nào? · Interviewer thêm yêu cầu giữa chừng — sửa thế nào ít đụng code nhất? | [HI LLD](https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction) · [Refactoring catalog](https://refactoring.com/catalog/) | P0 |
| `ood-uml-diagrams` | Class diagram & sequence diagram tối thiểu cho phỏng vấn | NT | `oop-pillars` | chưa | Composition vs aggregation vẽ thế nào? · Khi nào cần sequence diagram? | [Mermaid class diagram](https://mermaid.js.org/syntax/classDiagram.html) | P1 |
| `ood-state-machine` | State machine trong LLD (đơn hàng, thang máy, máy bán hàng) | TB | `patterns-gof` | một phần (sim `vending`, `patterns-gof`) | Mô hình trạng thái đơn hàng · Chặn chuyển trạng thái sai ở đâu? | [HI LLD](https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction) | P1 |
| `ood-concurrent-lld` | LLD có concurrency: đặt chỗ thread-safe, rate limiter in-memory, cache thread-safe | TB | `concurrency`, `ood-problem-walkthroughs` | một phần (`concurrency`, sim `seat`) | Hai người đặt cùng ghế trong một process · Token bucket thread-safe | [HI LLD Concurrency](https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction) · [JCIP](https://jcip.net/) | P1 |

### 2.10 System Design (chỉ bản đồ — Solution Architect phụ trách nghiên cứu)

Đã có trên site: `delivery`, `networking`, `api-design`, `data-modeling`, `indexing`, `core-db`, `caching`, `sharding`, `consistent-hashing`, `cap`, `numbers`, các building block (`redis`, `kafka`, `queue`, `streams`, `dist-lock`, `dist-cache`, `blob`, `search`, `lb-gateway-cdn`, `tech-cheatsheet`, `bigdata-ds`), `patterns`, 13 bài SD, khối `arch`, `cloud`. Các dòng dưới **chưa đối chiếu với id đề xuất của SA** — khi gộp cần ưu tiên id của SA.

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `sd-observability` | Observability: log, metric, trace, SLI/SLO | TB | `code-logging` | chưa | Đo latency p99 bằng cách nào? · SLO khác SLA? | [Google SRE book](https://sre.google/sre-book/table-of-contents/) | P1 (SA) |
| `sd-resilience` | Timeout, retry + backoff, circuit breaker, bulkhead | TB | `async-cancellation-timeout` | một phần (chỉ nhắc trong `ecs`) | Retry gây bão request thế nào? · Circuit breaker có mấy trạng thái? | [Google SRE: cascading failures](https://sre.google/sre-book/addressing-cascading-failures/) | P1 (SA) |
| `sd-outbox-cdc` | Transactional outbox & CDC | NC | `kafka` | một phần (nhắc trong `saga`, `payment`, `tech-cheatsheet`) | Ghi DB rồi gửi event — mất event khi nào? | [DDIA](https://dataintensive.net/) | P1 (SA) |
| `sd-durable-execution` | Durable execution / workflow engine (Temporal) | NC | `sd-resilience` | một phần (nhắc trong `patterns`, `tech-cheatsheet`) | Workflow nhiều bước chạy nhiều ngày giữ trạng thái thế nào? | [Temporal docs](https://docs.temporal.io/) | P1 (SA) |
| `sd-consensus` | Consensus & leader election (Raft, ZooKeeper) | NC | `cap` | một phần (nhắc trong `cap`, `kafka`) | Vì sao cluster cần số node lẻ? · Split brain là gì? | [Raft paper](https://raft.github.io/raft.pdf) | P1 (SA) |
| `sd-authn-authz` | Authentication & authorization: session, JWT, OAuth2/OIDC | TB | `net-tls` | một phần (`api-design` có JWT/cookie) | JWT thu hồi thế nào? · OAuth2 authorization code flow? | [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) · [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) | P1 (SA) |
| `sd-distributed-time` | Thời gian trong hệ phân tán: clock skew, Lamport, vector clock | NC | `cap` | một phần (`cap`) | Vì sao không dùng timestamp máy để sắp thứ tự sự kiện? | [Lamport 1978](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) | P2 (SA) |
| `sd-replication` | Replication: leader-follower, multi-leader, quorum, replica lag | TB | `cap` | một phần (sim `replica-lag`, `cap`) | Read-your-writes đảm bảo thế nào? | [DDIA](https://dataintensive.net/) | P2 (SA) |
| `sd-tech-deep-dives` | Deep dive: Elasticsearch, Cassandra, DynamoDB, PostgreSQL, Flink, ZooKeeper, Temporal, Vector DB, Time-series DB | NC | building blocks | chưa (`HI_GAPS`) | Theo từng công nghệ | [HI SD](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) | P1 (SA) |
| `sd-more-problems` | 19 bài SD còn thiếu so với Hello Interview (`HI_GAPS`) | TB–NC | `patterns` | chưa | Theo từng bài | [HI SD](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) | P1 (SA) |

### 2.11 Behavioral & quy trình phỏng vấn

| id | Tiêu đề tạm | Mức | Tiên quyết | Site | Câu hỏi tiêu biểu | Nguồn | Ưu tiên |
|---|---|---|---|---|---|---|---|
| `beh-interview-process` | Quy trình & rubric: mỗi vòng (coding, SD, LLD, behavioral) chấm tín hiệu gì | NT | — | chưa | Vòng coding chấm những tiêu chí nào? · Junior vs senior được kỳ vọng khác gì ở vòng SD? | [TIH: SWE interviews](https://www.techinterviewhandbook.org/software-engineering-interview-guide/) · [TIH: coding rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) | P1 |
| `beh-star-stories` | Khung STAR & ngân hàng câu chuyện | NT | — | chưa | Kể về một lần bạn bất đồng với đồng nghiệp · Một thất bại và bạn học được gì? | [TIH: behavioral](https://www.techinterviewhandbook.org/behavioral-interview/) | P0 |
| `beh-common-questions` | Nhóm câu hỏi hay gặp: xung đột, thất bại, ownership, mơ hồ, deadline | NT | `beh-star-stories` | chưa | Khi yêu cầu không rõ bạn làm gì? · Phải chọn giữa chất lượng và deadline? | [TIH: behavioral questions](https://www.techinterviewhandbook.org/behavioral-interview-questions/) | P0 |
| `beh-project-deep-dive` | Kể sâu về dự án đã làm: kiến trúc, trade-off, số liệu, vai trò của bạn | TB | `beh-star-stories` | chưa | Vẽ lại kiến trúc hệ thống bạn làm gần nhất · Nếu làm lại bạn đổi gì? | [TIH: senior candidates](https://www.techinterviewhandbook.org/behavioral-interview-senior-candidates/) | P0 |
| `beh-senior-signals` | Tín hiệu senior/staff: scope, ảnh hưởng, mentoring, quyết định kỹ thuật | NC | `beh-project-deep-dive` | chưa | Kể về một quyết định kỹ thuật bạn thuyết phục được team · Bạn giúp người khác phát triển thế nào? | [TIH: senior candidates](https://www.techinterviewhandbook.org/behavioral-interview-senior-candidates/) | P1 |
| `beh-self-intro` | Tự giới thiệu & câu hỏi ngược cho interviewer | NT | — | chưa | Giới thiệu bản thân trong 2 phút · Bạn có câu hỏi gì cho chúng tôi? | [TIH: self introduction](https://www.techinterviewhandbook.org/self-introduction/) · [TIH: final questions](https://www.techinterviewhandbook.org/final-questions/) | P1 |

### Thống kê số đề mục

| Mảng | Số dòng | Trong đó đề xuất mới | P0 mới |
|---|---|---|---|
| 2.1 Async programming | 13 | 13 | 7 |
| 2.2 Thread & I/O | 15 | 15 | 6 |
| 2.3 Process & OS | 13 | 13 | 5 |
| 2.4 Concurrency | 14 | 12 | 5 |
| 2.5 Kỹ năng viết code | 19 | 19 | 5 |
| 2.6 DSA patterns | 22 | 22 | 6 |
| 2.7 Networking | 11 | 10 | 4 |
| 2.8 Database internals | 9 | 9 | 3 |
| 2.9 LLD / OOD & machine coding | 6 | 5 | 2 |
| 2.10 System Design (bản đồ) | 10 | 10 | 0 |
| 2.11 Behavioral | 6 | 6 | 3 |
| **Tổng** | **138** | **134** | **46** |

---

## Phần 3 — Khoảng trống so với site hiện tại (xếp theo ưu tiên)

Nguyên tắc xếp: P0 = (hay bị hỏi ở vòng coding/nền tảng) × (site chưa có hoặc chỉ một dòng). Mảng SD để SA quyết định.

### P0 — chưa có gì trên site (nên làm trước)

| # | id | Tiêu đề | Mảng |
|---|---|---|---|
| 1 | `async-event-loop` | Event loop hoạt động thế nào | Async |
| 2 | `async-callback-promise-await` | Callback → Promise → async/await | Async |
| 3 | `async-blocking-in-loop` | Chặn event loop & offload | Async |
| 4 | `async-cancellation-timeout` | Cancellation, timeout, deadline propagation | Async |
| 5 | `async-coroutine` | Coroutine | Async |
| 6 | `thr-thread-vs-process` | Thread vs process | Thread & I/O |
| 7 | `thr-io-vs-cpu-bound` | I/O-bound vs CPU-bound | Thread & I/O |
| 8 | `io-blocking-models` | Blocking / non-blocking / multiplexing / async I/O | Thread & I/O |
| 9 | `thr-gil` | GIL & free-threading | Thread & I/O |
| 10 | `thr-green-threads` | Goroutine & virtual thread (M:N) | Thread & I/O |
| 11 | `os-process-lifecycle` | Process lifecycle | Process & OS |
| 12 | `os-context-switch` | Context switch | Process & OS |
| 13 | `os-memory-layout` | Stack vs heap | Process & OS |
| 14 | `os-virtual-memory` | Virtual memory & paging | Process & OS |
| 15 | `conc-memory-model` | Memory model & happens-before | Concurrency |
| 16 | `conc-livelock-starvation` | Livelock, starvation, fairness | Concurrency |
| 17 | `conc-classic-problems` | Bài coding concurrency kinh điển | Concurrency |
| 18 | `code-interview-communication` | Kỹ năng vòng coding | Kỹ năng viết code |
| 19 | `code-clean-naming` | Clean code & đặt tên | Kỹ năng viết code |
| 20 | `code-error-handling` | Error handling | Kỹ năng viết code |
| 21 | `code-debugging` | Debugging có hệ thống | Kỹ năng viết code |
| 22 | `dsa-design-ds` | Thiết kế cấu trúc dữ liệu (LRU…) | DSA |
| 23 | `net-url-to-page` | Gõ URL thì chuyện gì xảy ra | Networking |
| 24 | `mc-machine-coding-round` | Vòng machine coding | LLD |
| 25 | `beh-star-stories` | STAR & ngân hàng câu chuyện | Behavioral |
| 26 | `beh-common-questions` | Câu hỏi behavioral hay gặp | Behavioral |
| 27 | `beh-project-deep-dive` | Kể sâu dự án đã làm | Behavioral |

### P0 — có một phần, cần bài riêng

| id | Đang nằm ở | Thiếu gì |
|---|---|---|
| `async-concurrency-models` | `concurrency` (tldr) | So sánh thread / event loop / coroutine / actor |
| `async-backpressure` | `queue` (mức hệ thống) | Backpressure trong code: stream, bounded queue, giới hạn concurrency |
| `thr-thread-pool` | `concurrency`, sim `long-task` | Sizing, queue, rejection policy |
| `os-signals-shutdown` | sim `ecs-flow`, `eks-flow` | SIGTERM/SIGKILL, PID 1, drain kết nối |
| `conc-race-condition` | `concurrency`, sim `seat` | Data race vs race condition, check-then-act tổng quát |
| `conc-atomic-cas` | `redis-atomic`, `dist-lock` (mức hệ thống) | Atomic/CAS trong một process, lock-free, ABA |
| `code-testing-fundamentals` | `dev-methods`, sim `tdd-codewalk` | Test pyramid, test double, flaky test |
| `dsa-two-pointers`, `dsa-sliding-window`, `dsa-trees`, `dsa-graphs`, `dsa-dp` | 1 dòng trong `algo`/`ds` | Bài riêng có template + bài tập mẫu theo pattern |
| `net-tcp-deep`, `net-http-versions`, `net-tls` | `networking` | Handshake, TIME_WAIT, congestion, HOL blocking, TLS handshake |
| `db-isolation-anomalies`, `db-locking`, `db-query-tuning` | `core-db`, `indexing`, sim `isolation`, `n-plus-one` | Lost update/write skew, lock DB, đọc EXPLAIN |
| `ood-problem-walkthroughs` | `lld-problems-list`, sim `vending` | Lời giải từng bài |

### P1 — nên có (tóm tắt)

- **Async**: `async-microtask-queue`, `async-future-combinators`, `async-structured-concurrency`, `async-error-handling`, `async-sync-primitives`.
- **Thread & I/O**: `io-epoll-kqueue`, `io-reactor-proactor`, `thr-virtual-threads-java`, `thr-goroutine-channel`, `io-connection-pool`, `io-buffering-fsync`.
- **OS**: `os-syscall-kernel-mode`, `os-scheduling`, `os-file-descriptors`, `os-ipc`, `os-containers-primitives`.
- **Concurrency**: `conc-monitor-rwlock`, `conc-producer-consumer`, `conc-actor-model`, `conc-thread-safe-collections`, `conc-optimistic-pessimistic`, `conc-parallelism-amdahl`, `conc-testing-debugging`.
- **Code**: `code-defensive-validation`, `code-testable-design`, `code-review`, `code-refactoring`, `code-api-design-code`, `code-immutability`, `code-fp-vs-oop`, `code-complexity-perf`, `code-memory-gc`, `code-secure-coding`, `code-language-choice`.
- **DSA**: `dsa-arrays-hashing`, `dsa-binary-search-answer`, `dsa-sorting`, `dsa-intervals`, `dsa-stack-monotonic`, `dsa-linked-list`, `dsa-heap-topk`, `dsa-backtracking`, `dsa-trie`.
- **Networking / DB**: `net-http-semantics`, `net-dns-deep`, `net-sockets`, `net-cors-cookies`, `db-sql-handwriting`, `db-mvcc`, `db-storage-engines`, `db-wal-recovery`, `db-schema-migration`.
- **LLD / Behavioral**: `ood-uml-diagrams`, `ood-state-machine`, `ood-concurrent-lld`, `beh-interview-process`, `beh-senior-signals`, `beh-self-intro`.

### P2 — bổ sung khi rảnh

`async-reactive-streams`, `io-uring`, `io-zero-copy`, `thr-thread-local-context`, `os-filesystem`, `os-cpu-cache-locality`, `os-linux-diagnostics`, `code-generics-types`, `code-logging`, `code-git-workflow`, `dsa-recursion`, `dsa-prefix-sum`, `dsa-greedy`, `dsa-matrix`, `dsa-strings`, `dsa-bit-manipulation`, `dsa-range-trees`, `net-proxy-nat`, `net-serialization`, `db-normalization`.

### Gợi ý cấu trúc track (để Product Designer cân nhắc, không bắt buộc)

Khối mới "Nền tảng CS" gồm 4 section theo thứ tự phụ thuộc: **Process & OS → Thread & I/O → Concurrency → Async**; sau đó "Kỹ năng viết code" và "Behavioral" là hai track song song. `concurrency` hiện có nằm ở LLD có thể được tham chiếu chéo thay vì di chuyển (id là hợp đồng, không đổi).

---

## Phần 4 — Nguồn

### Nền tảng (chỉ tham chiếu cấu trúc, không chép nội dung)

- Hello Interview — System Design in a Hurry: https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction
- Hello Interview — Low-Level Design in a Hurry: https://www.hellointerview.com/learn/low-level-design/in-a-hurry/introduction
- Hello Interview — Coding: https://www.hellointerview.com/learn/code
- Tech Interview Handbook: https://www.techinterviewhandbook.org/algorithms/study-cheatsheet/
- Grokking the Coding Interview (mục lục): https://www.designgurus.io/course/grokking-the-coding-interview
- Grokking Multithreading & Concurrency (mục lục): https://www.designgurus.io/course/grokking-multithreading-and-concurrency-for-coding-interviews
- ByteByteGo system-design-101: https://github.com/ByteByteGoHq/system-design-101
- Aced (trước là Exponent): https://www.aced.io/courses/software-engineering
- NeetCode Roadmap (chưa fetch được nội dung): https://neetcode.io/roadmap
- Engineer Pro — lộ trình: https://engineerprovn.substack.com/p/lo-trinh-tro-thanh-software-engineer
- System Design Primer: https://github.com/donnemartin/system-design-primer

### Sách / khoá học mở

- Operating Systems: Three Easy Pieces (OSTEP): https://pages.cs.wisc.edu/~remzi/OSTEP/
- Designing Data-Intensive Applications: https://dataintensive.net/
- Computer Systems: A Programmer's Perspective: http://csapp.cs.cmu.edu/
- Java Concurrency in Practice: https://jcip.net/
- High Performance Browser Networking: https://hpbn.co/
- MIT 6.006 Introduction to Algorithms: https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- CMU 15-445 Database Systems: https://15445.courses.cs.cmu.edu/
- cp-algorithms: https://cp-algorithms.com/
- Use The Index, Luke: https://use-the-index-luke.com/
- Google SRE book: https://sre.google/sre-book/table-of-contents/
- What Every Programmer Should Know About Memory: https://people.freebsd.org/~lstewart/articles/cpumemory.pdf
- The C10K problem: http://www.kegel.com/c10k.html

### Tài liệu chính thức ngôn ngữ / runtime

- Python: asyncio https://docs.python.org/3/library/asyncio.html · tasks https://docs.python.org/3/library/asyncio-task.html · dev guide https://docs.python.org/3/library/asyncio-dev.html · PEP 492 https://peps.python.org/pep-0492/ · PEP 703 https://peps.python.org/pep-0703/ · free-threading https://docs.python.org/3/howto/free-threading-python.html · concurrent.futures https://docs.python.org/3/library/concurrent.futures.html
- Node.js: event loop https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick · don't block https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop · backpressure https://nodejs.org/en/learn/modules/backpressuring-in-streams · libuv https://docs.libuv.org/en/v1.x/design.html
- Java: JEP 444 https://openjdk.org/jeps/444 · JEP 453 https://openjdk.org/jeps/453 · JLS ch.17 https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html · java.util.concurrent https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html
- Go: memory model https://go.dev/ref/mem · Effective Go https://go.dev/doc/effective_go#concurrency · context https://pkg.go.dev/context · pipelines https://go.dev/blog/pipelines · race detector https://go.dev/doc/articles/race_detector · GC guide https://go.dev/doc/gc-guide
- Web: MDN Promise https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise · microtask https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide · HTML event loops https://html.spec.whatwg.org/multipage/webappapis.html#event-loops

### Linux man pages & RFC

- man7.org: epoll(7), io_uring(7), signal(7), fork(2), pipe(7), sched(7), namespaces(7), cgroups(7), socket(7), tcp(7), futex(7) — https://man7.org/linux/man-pages/
- io_uring paper: https://kernel.dk/io_uring.pdf
- RFC 9293 (TCP), 5681 (congestion control), 9110/9111 (HTTP semantics/caching), 9113 (HTTP/2), 9114 (HTTP/3), 9000 (QUIC), 8446 (TLS 1.3), 1034/1035 (DNS), 6749 (OAuth 2.0), 7519 (JWT) — https://www.rfc-editor.org/

### Database

- PostgreSQL: MVCC https://www.postgresql.org/docs/current/mvcc.html · isolation https://www.postgresql.org/docs/current/transaction-iso.html · locking https://www.postgresql.org/docs/current/explicit-locking.html · EXPLAIN https://www.postgresql.org/docs/current/using-explain.html · WAL https://www.postgresql.org/docs/current/wal-intro.html
- MySQL InnoDB locking: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html
- A Critique of ANSI SQL Isolation Levels: https://arxiv.org/abs/cs/0701157
- LSM-tree (O'Neil et al. 1996): https://www.cs.umb.edu/~poneil/lsmtree.pdf

### Kỹ năng viết code

- Google eng-practices (code review): https://google.github.io/eng-practices/review/
- Google style guides: https://google.github.io/styleguide/
- Refactoring catalog: https://refactoring.com/catalog/
- Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html · Mocks Aren't Stubs: https://martinfowler.com/articles/mocksArentStubs.html
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Parse, don't validate: https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- Hyrum's Law: https://www.hyrumslaw.com/ · SemVer: https://semver.org/
- git bisect: https://git-scm.com/docs/git-bisect
