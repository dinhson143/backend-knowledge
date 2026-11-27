BK.topic({
  id: "dockerfile",
  track: "cloud",
  section: "cloud-k8s",
  title: "Dockerfile & build cache",
  goal: "Viết Dockerfile nhỏ, chạy non-root và build lại nhanh nhờ cache layer",
  needs: ["container-basics"],
  tldr: {
    t: "Mỗi lệnh trong Dockerfile tạo một layer và được cache **theo thứ tự**: một lệnh đổi thì mọi lệnh sau nó build lại. Vì vậy: bước ít đổi lên trước (copy lock file, cài dependency), code xuống sau; **multi-stage** để image cuối chỉ có thứ cần để chạy; chạy bằng **user không phải root**; secret lúc build đi qua `RUN --mount=type=secret`, không qua `ARG`/`ENV`; pin base image theo **digest**.",
    why: "Cache của một lệnh gắn với layer cha cộng input của lệnh (chuỗi lệnh với `RUN`, checksum file với `COPY`), nên layer cha đổi là lệnh phải chạy lại dù chính nó không đổi (https://docs.docker.com/build/cache/invalidation/). Image cuối chỉ chứa những gì stage cuối copy vào, nên compiler và dev dependency ở stage build không lọt sang. `ARG`/`ENV` được ghi vào image, ai có image cũng đọc được (https://docs.docker.com/build/building/secrets/).",
  },
  story: {
    problem: "Dockerfile viết vội: `FROM node:latest`, `COPY . .` rồi `npm install`, chạy bằng root, token npm truyền qua `ARG`. Kết quả: image gần 1 GB chứa cả compiler và `.git`; sửa một dòng code là chờ cài lại toàn bộ dependency; base đổi âm thầm theo tag; token nằm trong lịch sử image.",
    idea: "Coi Dockerfile như code có thứ tự: xếp lệnh theo tần suất thay đổi để cache phát huy, tách stage build và stage chạy, đưa secret vào bằng mount chỉ tồn tại trong một lệnh, và khoá base image bằng digest để build tái lập được.",
    tradeoff: "Image distroless không có shell nên khó debug trực tiếp (phải dùng bản `:debug` hoặc ephemeral container). Pin digest nghĩa là phải chủ động cập nhật base để nhận bản vá, thường bằng bot cập nhật dependency.",
  },
  sections: [
    {
      title: "Dockerfile mẫu, từng dòng",
      table: {
        head: ["Dòng", "Làm gì"],
        rows: [
          {
            cells: ["`# syntax=docker/dockerfile:1`", "Dùng frontend Dockerfile mới nhất của BuildKit"],
            why: "Dòng này cho BuildKit tải bản parser Dockerfile ổn định mới nhất, nên `RUN --mount` (cache, secret) dùng được kể cả khi Docker Engine trên máy cũ hơn.",
          },
          {
            cells: ["`FROM node:22-slim@sha256:… AS build`", "Stage build: base nhỏ, pin theo digest"],
            why: "Tag `node:22-slim` có thể bị publisher trỏ sang image khác bất cứ lúc nào; digest là hash nội dung nên luôn ra đúng một image. Docker gọi đây là cách giữ \"supply chain integrity\" (https://docs.docker.com/build/building/best-practices/). Bản `slim` bỏ bớt gói không cần, ít CVE hơn.",
          },
          {
            cells: ["`WORKDIR /app`", "Thư mục làm việc cố định"],
            why: "Đường dẫn tuyệt đối rõ ràng thay cho chuỗi `cd` trong `RUN`; các lệnh sau và stage sau tham chiếu cùng một chỗ.",
          },
          {
            cells: ["`COPY package.json package-lock.json ./`", "Chỉ copy file khai báo dependency"],
            why: "Input của `COPY` chỉ là các file nó copy. Sửa code không chạm hai file này nên layer hit, và lệnh cài dependency phía sau cũng hit. Copy cả repo ở đây thì mọi thay đổi code đều làm cài lại dependency.",
          },
          {
            cells: ["`RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci`", "Cài dependency đúng theo lock file"],
            why: "`npm ci` cài đúng phiên bản trong lock file nên build tái lập được. **Cache mount** giữ cache npm qua các lần build mà không nằm trong image; **secret mount** đưa token registry riêng vào đúng lệnh này dưới dạng file, không ghi vào layer nào (https://docs.docker.com/build/building/secrets/). Lúc build: `docker build --secret id=npmrc,src=$HOME/.npmrc .`",
          },
          {
            cells: ["`COPY . .`", "Copy mã nguồn — lệnh hay đổi nhất, đặt sau"],
            why: "Đây là layer miss mỗi lần sửa code, nên đặt nó sau mọi bước đắt mà ít đổi. `.dockerignore` quyết định \"`.`\" gồm những gì.",
          },
          {
            cells: ["`RUN npm run build && npm prune --omit=dev`", "Compile rồi bỏ dev dependency"],
            why: "Build xong thì không cần TypeScript, bundler, test framework để chạy. Xoá chúng ngay trong stage build để `node_modules` copy sang stage cuối chỉ còn dependency runtime.",
          },
          {
            cells: ["`FROM gcr.io/distroless/nodejs22-debian13@sha256:…`", "Stage chạy: chỉ có runtime Node, không shell, không package manager"],
            why: "Distroless chỉ chứa \"only your application and its runtime dependencies\" (https://github.com/GoogleContainerTools/distroless): không có shell hay `apt` cho kẻ tấn công dùng, ít gói nên ít CVE để vá. Stage này bắt đầu từ base mới tinh, nên mọi thứ của stage build không đi theo trừ những gì `COPY --from` chỉ định.",
          },
          {
            cells: ["`COPY --from=build /app/node_modules ./node_modules` và `COPY --from=build /app/dist ./dist`", "Chỉ lấy artifact cần để chạy"],
            why: "Multi-stage giảm kích thước image vì image cuối chỉ gồm layer của stage cuối (https://docs.docker.com/build/building/best-practices/). Source TypeScript, cache build, file lock của dev đều ở lại stage build.",
          },
          {
            cells: ["`USER 10001:10001`", "Chạy bằng UID không phải root"],
            why: "Root trong container vẫn là UID 0 trên kernel chung nếu không bật user namespace (xem `container-basics`), nên app bị chiếm có nhiều đường thoát hơn. Ghi UID dạng số để không phụ thuộc vào tên user có sẵn trong image. Cách khác: dùng tag `:nonroot` của distroless (https://github.com/GoogleContainerTools/distroless), đã chạy sẵn bằng user không phải root; README không ghi UID của user này.",
          },
          {
            cells: ["`EXPOSE 8080`", "Ghi chú port app nghe"],
            why: "`EXPOSE` chỉ là tài liệu, không mở port nào. Chọn port > 1024 vì user không phải root không bind được port thấp.",
          },
          {
            cells: ["`CMD [\"dist/server.js\"]`", "Exec form; image distroless đã đặt entrypoint là `node`"],
            why: "Exec form (mảng JSON) chạy thẳng process, không qua `/bin/sh -c`, nên app là PID 1 và nhận được `SIGTERM`. Shell form bọc app trong shell, shell không chuyển tín hiệu, `docker stop` phải chờ timeout rồi `SIGKILL` (https://docs.docker.com/reference/dockerfile/). Distroless còn không có shell để chạy shell form.",
          },
        ],
      },
    },
    {
      title: "File .dockerignore đi kèm",
      points: [
        {
          t: "Đặt `.dockerignore` ở gốc build context, mỗi dòng một pattern: `.git`, `node_modules`, `dist`, `.env`, `*.log`, `coverage`.",
          why: "Builder loại các file khớp pattern trước khi gửi context (https://docs.docker.com/build/concepts/context/). Thiếu nó thì `COPY . .` miss mỗi lần `.git` đổi (mỗi commit), context gửi lên builder nặng hơn nhiều, và `.env` chứa secret có thể lọt vào image.",
        },
        {
          t: "Loại `node_modules` của máy dev là bắt buộc: dependency phải cài trong image.",
          why: "`node_modules` trên máy dev có thể chứa binary native build cho macOS/Windows; copy sang image Linux sẽ chạy lỗi, và nó ghi đè kết quả `npm ci` đúng chuẩn.",
        },
      ],
    },
    {
      title: "Những lỗi hay gặp và cách sửa",
      table: {
        head: ["Lỗi", "Hậu quả", "Sửa"],
        rows: [
          {
            cells: ["`COPY . .` trước `npm ci`", "Sửa một dòng code là cài lại mọi dependency", "Copy lock file, cài, rồi mới copy code"],
            why: "Layer cài dependency có layer cha là kết quả `COPY . .`; cha đổi thì con miss dù lệnh giống hệt (xem mô phỏng build cache).",
          },
          {
            cells: ["`RUN apt-get update` tách riêng `RUN apt-get install`", "Cài gói từ danh sách cũ, có khi lỗi 404", "Gộp `apt-get update && apt-get install -y --no-install-recommends … && rm -rf /var/lib/apt/lists/*` trong một `RUN`"],
            why: "`RUN apt-get update` riêng có chuỗi lệnh không đổi nên hit mãi; thêm gói vào lệnh install sau đó sẽ cài từ danh sách gói cũ. Xoá `/var/lib/apt/lists` trong cùng `RUN` để danh sách không bị lưu vào layer (https://docs.docker.com/build/building/best-practices/). Xoá ở `RUN` sau thì vô ích: layer trước vẫn chứa nó.",
          },
          {
            cells: ["`ARG NPM_TOKEN` / `ENV API_KEY=…`", "Ai kéo được image là đọc được secret", "`RUN --mount=type=secret`"],
            why: "Build arg và env \"persist in the final image\" (https://docs.docker.com/build/building/secrets/): nằm trong config hoặc lịch sử image. Secret mount chỉ xuất hiện như file `/run/secrets/<id>` trong lúc chạy đúng một lệnh, và nội dung secret không được tính vào cache.",
          },
          {
            cells: ["`FROM node:latest`", "Build hôm nay khác build hôm qua", "Tag cụ thể + digest"],
            why: "`latest` trỏ sang major version mới khi publisher phát hành, có thể đổi cả hành vi runtime. Digest cố định nội dung; cập nhật base trở thành một thay đổi có review.",
          },
          {
            cells: ["Xoá file ở layer sau để giảm size", "Image không nhỏ đi", "Xoá trong cùng `RUN`, hoặc dùng multi-stage"],
            why: "Layer là changeset chồng lên nhau: file đã nằm trong layer dưới thì layer trên chỉ đánh dấu \"đã xoá\", byte vẫn được tải về. Multi-stage giải quyết gọn vì stage cuối không chứa layer nào của stage build.",
          },
          {
            cells: ["Shell form `CMD npm start`", "`docker stop` chờ 10 giây rồi kill cứng; request đang xử lý bị cắt", "Exec form, chạy thẳng `node`"],
            why: "`npm` và `sh` làm process cha không chuyển `SIGTERM` cho app. App không biết mình sắp bị dừng nên không đóng kết nối, không hoàn tất request. Script khởi động dùng `exec \"$@\"` ở dòng cuối để app thay thế shell thành PID 1 (https://docs.docker.com/build/building/best-practices/). Thời gian chờ mặc định của `docker stop` trên Linux là 10 giây, Windows 30 giây (https://docs.docker.com/reference/cli/docker/container/stop/).",
          },
        ],
      },
    },
    {
      title: "HEALTHCHECK và tín hiệu dừng",
      points: [
        {
          t: "`HEALTHCHECK [--interval=30s --timeout=30s --start-period=0s --start-interval=5s --retries=3] CMD …` — mặc định như trong ngoặc. Exit code `0` là healthy, `1` là unhealthy, `2` không dùng. Chỉ một `HEALTHCHECK` có hiệu lực (cái cuối).",
          why: "Container bắt đầu ở trạng thái `starting`, pass thì `healthy`, fail liên tiếp đủ `retries` lần thì `unhealthy` (https://docs.docker.com/reference/dockerfile/). `--start-period` cho app chậm khởi động thời gian ân hạn: fail trong khoảng này không bị tính.",
        },
        {
          t: "Image distroless không có `curl` hay shell: kiểm tra sức khoẻ phải là một chương trình chạy được bằng exec form (ví dụ một script Node nhỏ gọi `/healthz`).",
          why: "`HEALTHCHECK CMD curl …` cần `curl` và shell form cần `/bin/sh`; cả hai không có trong distroless, nên health check sẽ luôn fail và container bị đánh dấu `unhealthy`.",
        },
        {
          t: "Trên Kubernetes, đừng dựa vào `HEALTHCHECK` của image: khai báo **liveness/readiness/startup probe** trong pod spec.",
          why: "Kubelet tự chạy probe khai báo trong pod spec và dựa vào kết quả để restart container hay rút pod khỏi Service (https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/). `HEALTHCHECK` hữu ích khi chạy bằng `docker run` hay Docker Compose.",
        },
        {
          t: "`STOPSIGNAL` mặc định là `SIGTERM`. App phải bắt nó: ngừng nhận request mới, xử lý xong request đang chạy, đóng kết nối, rồi thoát.",
          why: "Docker gửi `SIGTERM`, hết thời gian chờ mới gửi `SIGKILL`; Kubernetes làm tương tự với `terminationGracePeriodSeconds`. App bỏ qua `SIGTERM` thì mỗi lần deploy là một lần cắt ngang request.",
        },
      ],
    },
    {
      title: "Quy trình build lại và cache",
      table: {
        head: ["Tình huống", "Làm gì", "Layer nào build lại"],
        rows: [
          {
            cells: ["Sửa code", "`docker build` bình thường", "Từ `COPY . .` trở xuống"],
            why: "Thứ tự layer đúng làm phần dependency hit. Đây là vòng lặp hằng ngày nên phải nhanh nhất.",
          },
          {
            cells: ["Thêm/bớt dependency", "Build bình thường; cache mount giữ cache npm/pip", "Từ `COPY package*.json` trở xuống"],
            why: "Lock file đổi thì layer cài dependency buộc phải chạy lại; cache mount giúp chỉ tải phần mới thay vì tải lại hết (https://docs.docker.com/build/cache/optimize/).",
          },
          {
            cells: ["Base có bản vá bảo mật", "Cập nhật digest trong `FROM`, hoặc build định kỳ với `--pull`", "Toàn bộ"],
            why: "`--pull` buộc Docker kiểm tra và tải bản base mới hơn. Không làm định kỳ thì image giữ nguyên các CVE của base cũ dù code của bạn không đổi gì.",
          },
          {
            cells: ["CI chạy trên runner mới mỗi lần", "`--cache-to` / `--cache-from type=registry,ref=…`", "Như máy dev, nếu cache kéo về được"],
            why: "Runner mới không có cache cục bộ, nên mọi lợi ích thứ tự layer mất hết. Xuất cache lên registry rồi kéo về ở lần build sau giúp CI hit cache như máy dev.",
          },
          {
            cells: ["Nghi cache sai, cần build sạch", "`--no-cache`", "Toàn bộ"],
            why: "`--no-cache` bỏ qua build cache và build lại mọi layer. Dùng khi một lệnh `RUN` phụ thuộc thứ ngoài input của nó (ví dụ tải \"bản mới nhất\" từ internet) mà cache không biết đã đổi.",
          },
          {
            cells: ["Đổi giá trị `ARG`", "Đặt `ARG` sát chỗ dùng", "Từ lệnh đầu tiên dùng `ARG` đó"],
            why: "Build arg có tham gia vào cache (https://docs.docker.com/build/cache/invalidation/). Khai báo `ARG` ở đầu file và dùng sớm thì đổi một version label cũng làm miss gần hết.",
          },
        ],
      },
    },
  ],
  tips: [
    {
      t: "Được hỏi \"tối ưu Dockerfile thế nào\", trả lời theo ba trục: **build nhanh** (thứ tự layer, `.dockerignore`, cache mount), **image nhỏ** (multi-stage, slim/distroless), **an toàn** (non-root, secret mount, pin digest).",
      why: "Ba trục cho người phỏng vấn thấy bạn có khung suy nghĩ thay vì liệt kê mẹo rời rạc, và mỗi trục gắn với một cơ chế cụ thể đã nêu ở trên.",
    },
    {
      t: "Nói được **vì sao** thứ tự layer quan trọng: cache theo layer cha + input, miss một layer là miss mọi layer sau.",
      why: "Câu \"đặt dependency trước\" ai cũng thuộc; giải thích được cơ chế mới cho thấy bạn tự xử lý được trường hợp lạ (ví dụ `ARG` đặt sai chỗ).",
    },
    {
      t: "Nhắc PID 1 và `SIGTERM` khi nói về deploy không downtime.",
      why: "Rolling update chỉ êm khi pod cũ nhận được tín hiệu dừng và tự đóng gọn; Dockerfile dùng shell form làm hỏng điều này mà nhìn không ra.",
    },
  ],
  cards: [
    [
      "Đổi một dòng code mà `npm install` chạy lại. Vì sao, sửa thế nào?",
      "`COPY . .` đứng trước lệnh cài: code đổi làm layer đó miss, mọi layer sau miss theo. Copy lock file trước, cài dependency, rồi mới copy code.",
    ],
    [
      "Vì sao `ENV API_KEY=…` lúc build là lộ secret?",
      "`ENV` và `ARG` được ghi vào config/lịch sử image; ai kéo được image là đọc được. Dùng `RUN --mount=type=secret`, secret chỉ có trong một lệnh và không vào layer.",
    ],
    [
      "Multi-stage giảm kích thước image bằng cách nào?",
      "Image cuối chỉ gồm layer của stage cuối. Compiler, dev dependency, source ở stage build không đi theo, trừ artifact được `COPY --from`.",
    ],
    [
      "Pin `node:22` khác pin `node@sha256:…` ở đâu?",
      "Tag có thể bị trỏ sang image khác; digest là hash nội dung nên luôn đúng một image. Đổi lại phải chủ động cập nhật digest để nhận bản vá.",
    ],
    [
      "Vì sao xoá file ở một `RUN` sau không làm image nhỏ đi?",
      "File vẫn nằm trong layer trước; layer sau chỉ đánh dấu đã xoá. Xoá trong cùng `RUN` hoặc dùng multi-stage.",
    ],
    [
      "`CMD npm start` có vấn đề gì?",
      "Shell form chạy qua `/bin/sh -c` (và npm), app không là PID 1 nên không nhận `SIGTERM`; dừng container phải chờ timeout rồi bị `SIGKILL`.",
    ],
  ],
  related: ["docker-build-cache"],
});
