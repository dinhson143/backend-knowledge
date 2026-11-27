BK.topic({
  id: "image-delivery",
  track: "cloud",
  section: "cloud-k8s",
  title: "Build, tag, push, deploy",
  goal: "Đưa image từ build tới cluster bằng digest, scan và SBOM",
  needs: ["dockerfile", "system-architecture"],
  tldr: {
    t: "Đường đi chuẩn của một image: **build một lần** → gắn tag theo commit → **push** lên registry → **scan** lỗ hổng, sinh **SBOM** và provenance, **ký** → deploy bằng **digest** (`image@sha256:…`) → **promote** cùng digest đó từ staging lên production. **Tag** là con trỏ đổi được; **digest** là hash của nội dung, không đổi. Deploy bằng tag là chấp nhận việc registry thay code đang chạy mà không ai deploy.",
    why: "Kubernetes ghi rõ: \"Tags can be moved to point to different images, but digests are fixed\", và nếu tag bị trỏ sang image khác \"you might end up with a mix of Pods running the old and new code\" (https://kubernetes.io/docs/concepts/containers/images/). Pin theo digest thì mọi pod, mọi lần restart, mọi môi trường chạy đúng một bản build.",
  },
  story: {
    problem: "Team deploy `payment:latest`. Hôm thứ Ba có người push một bản build thử lên cùng tag. Thứ Tư, node bị thay, pod mới kéo `latest` và chạy code thử, trong khi pod cũ vẫn chạy bản cũ: hai phiên bản cùng nhận traffic. Rollback không biết về đâu vì không ai ghi lại `latest` lúc trước là image nào.",
    idea: "Mỗi lần build sinh một image bất biến, định danh bằng digest, gắn tag là commit SHA cho người đọc. Pipeline kiểm tra image đó (scan, SBOM, chữ ký) rồi ghi **digest** vào manifest deploy. Môi trường sau nhận lại đúng digest đã qua môi trường trước, không build lại.",
    tradeoff: "Manifest chứa digest khó đọc hơn tag, nên cần công cụ (GitOps, CI) tự cập nhật và hiển thị tag đi kèm. Scan, SBOM, ký thêm thời gian vào pipeline và thêm chỗ có thể chặn release (lỗ hổng mới công bố trên base image). Registry trở thành phụ thuộc của mọi lần scale và mọi lần thay node.",
  },
  table: {
    head: ["Bước", "Làm gì", "Vì sao"],
    rows: [
      {
        cells: ["Build", "`docker buildx build`, multi-stage, có thể nhiều kiến trúc (amd64 và arm64)", "Một lần build cho mọi môi trường"],
        why: "Twelve-Factor tách hẳn build, release, run: build biến code thành artifact, release ghép artifact với config, và \"a release cannot be mutated once it is created\" (https://12factor.net/build-release-run). Build lại cho từng môi trường thì thứ chạy ở production chưa từng được test ở staging. Viết Dockerfile và cache layer ở bài `dockerfile`.",
      },
      {
        cells: ["Tag", "Commit SHA (`payment:3f9c2ab`), thêm semver khi release; không deploy bằng `latest`", "Người đọc biết image từ commit nào"],
        why: "Kubernetes khuyên tránh `:latest` ở production vì khó biết bản nào đang chạy và khó rollback; dùng tag có nghĩa như `v1.42.0` và/hoặc digest (https://kubernetes.io/docs/concepts/containers/images/). Tag theo SHA là duy nhất theo commit nên không ai vô tình ghi đè bản khác.",
      },
      {
        cells: ["Push", "Đẩy các blob (layer, config) trước, manifest sau; registry trả digest", "Layer đã có thì không tải lại"],
        why: "OCI distribution spec: push \"typically works in the opposite order as a pull: the blobs making up the object are uploaded first, and the manifest last\"; manifest được `PUT` lên `/v2/<name>/manifests/<tag-or-digest>` (https://github.com/opencontainers/distribution-spec/blob/main/spec.md). Manifest chỉ trỏ tới blob đã có, nên không bao giờ có image \"nửa vời\" trong registry.",
      },
      {
        cells: ["Scan", "Quét lỗ hổng (CVE) và secret lọt trong image; fail pipeline khi có lỗ hổng nặng", "Chặn image có lỗ hổng đã biết trước khi lên cluster"],
        why: "`trivy image` mặc định quét vulnerability và secret (https://trivy.dev/latest/docs/target/container_image/), nhưng mặc định thoát với mã 0 kể cả khi tìm thấy lỗi; phải thêm `--exit-code 1 --severity CRITICAL` để CI dừng (https://trivy.dev/latest/docs/configuration/others/).",
      },
      {
        cells: ["SBOM + provenance", "`--sbom=true`, `--provenance=mode=max`; gắn vào image dưới dạng attestation", "Biết image chứa package nào, build từ đâu, bằng lệnh gì"],
        why: "Docker: attestation \"describe how an image was built, and what it contains\" và \"attach to images as a manifest in the image index\"; provenance `mode=min` được thêm **mặc định** khi BuildKit build (https://docs.docker.com/build/metadata/attestations/). Khi một CVE mới công bố, tra SBOM cho biết ngay image nào đang chạy package đó mà không phải kéo từng image về.",
      },
      {
        cells: ["Ký", "`cosign sign` theo digest; cluster chỉ chạy image có chữ ký hợp lệ", "Chứng minh image do pipeline của bạn tạo, không bị thay trên đường đi"],
        why: "Cosign hỗ trợ ký keyless bằng khoá tạm cấp qua OIDC, chữ ký lưu cạnh image theo OCI 1.1 referrers (https://docs.sigstore.dev/cosign/signing/signing_with_containers/); khi verify, cosign mặc định kiểm digest trong chữ ký khớp với image (https://docs.sigstore.dev/cosign/verifying/verify/). Ký theo tag thì không chứng minh được gì vì tag có thể đổi.",
      },
      {
        cells: ["Deploy + promote", "Ghi `image@sha256:…` vào manifest (thường qua Git); đưa cùng digest từ staging lên production", "Môi trường nào cũng chạy đúng bản đã kiểm"],
        why: "GitOps yêu cầu trạng thái mong muốn được khai báo, có version, và được agent \"continuously observe actual system state and attempt to apply the desired state\" (https://opengitops.dev/). CI chỉ sửa digest trong Git; Argo CD hay Flux kéo về và reconcile, nên lịch sử Git chính là lịch sử deploy và rollback là revert một commit.",
      },
    ],
  },
  points: [
    {
      t: "**Digest định danh theo nội dung**: `sha256:` + hash của manifest. Viết image kèm cả tag và digest thì chỉ digest được dùng để kéo.",
      why: "Kubernetes: digest là hash nội dung của image nên bất biến; tham chiếu \"Image name with tag and digest. Only the digest will be used for pulling\" (https://kubernetes.io/docs/concepts/containers/images/). Spec phân phối OCI cũng yêu cầu client nên kiểm nội dung nhận về khớp digest đã yêu cầu (https://github.com/opencontainers/distribution-spec/blob/main/spec.md), nên registry hay proxy ở giữa không thể lén đổi image.",
    },
    {
      t: "**`imagePullPolicy` được tự đặt lúc tạo object**: có digest → `IfNotPresent`; tag `:latest` hoặc không có tag → `Always`; tag khác → `IfNotPresent`. Giá trị này **không đổi** khi sau đó bạn sửa image.",
      why: "Bốn quy tắc và ghi chú \"is not updated if the image's tag or digest later changes\" đều ở trang Images (https://kubernetes.io/docs/concepts/containers/images/). Hệ quả: push đè tag `v1.2` rồi restart pod với `IfNotPresent` thì node đã có `v1.2` cũ vẫn chạy bản cũ, node mới kéo bản mới; deploy bằng digest tránh hẳn chuyện này.",
    },
    {
      t: "**Bật tag immutability ở registry** để không ai push đè một tag đã có.",
      why: "Trên Amazon ECR, khi bật, push một tag đã tồn tại bị từ chối với `ImageTagAlreadyExistsException`, và có thể khai báo ngoại lệ bằng wildcard (https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html). Tag bất biến cộng với tag theo commit SHA biến tag thành định danh tin được cho người đọc, còn digest vẫn là thứ máy dùng.",
    },
    {
      t: "**Image nhiều kiến trúc là một image index** trỏ tới nhiều manifest (amd64, arm64…); node tự kéo đúng bản cho CPU của nó.",
      why: "Registry có thể phục vụ \"a container image index\" trỏ tới nhiều image manifest theo kiến trúc, nên cùng một tên dùng được trên node x86 lẫn Graviton/ARM (https://kubernetes.io/docs/concepts/containers/images/). Docker build nhiều nền tảng bằng QEMU (chậm khi tính toán nặng), nhiều builder native, hoặc cross-compile trong multi-stage (https://docs.docker.com/build/building/multi-platform/). Digest của index khác digest của từng manifest con: deploy bằng digest của index.",
    },
    {
      t: "**Registry là phụ thuộc lúc chạy**: pod mới (scale, thay node) phải kéo được image. Registry private cần `imagePullSecrets` hoặc quyền của node; kéo lỗi thì pod kẹt ở `ImagePullBackOff`, thử lại với độ trễ tăng dần tới tối đa 300 giây.",
      why: "Trang Images giải thích `ImagePullBackOff` xảy ra khi tên image sai hoặc kéo từ registry private mà thiếu `imagePullSecret`, và độ trễ giữa các lần thử tăng tới giới hạn 300 giây (https://kubernetes.io/docs/concepts/containers/images/). Registry sập lúc autoscale thì pod mới không lên dù cluster còn chỗ; vì vậy dùng registry cùng region, có replication hoặc pull-through cache.",
    },
    {
      t: "**Scan không phải việc một lần.** Image sạch hôm nay có thể dính CVE công bố tuần sau; quét lại định kỳ image đang chạy và rebuild khi base image có bản vá.",
      why: "Lỗ hổng gắn với package trong image, mà danh sách lỗ hổng đã biết thì tăng theo thời gian, còn image thì không đổi. SBOM giúp trả lời nhanh \"image nào đang chứa package bị lỗi\"; rebuild từ base đã vá rồi đi lại đúng pipeline (scan, ký, deploy bằng digest mới).",
    },
  ],
  sections: [
    {
      title: "Pipeline tối giản (shell, chạy trong CI)",
      code: {
        lang: "sh",
        lines: [
          "IMAGE=registry.example.com/payment",
          ["TAG=$(git rev-parse --short HEAD)", "Tag = commit SHA: duy nhất theo commit, đọc được."],
          "",
          "docker buildx build \\",
          ["  --platform linux/amd64,linux/arm64 \\", "Một lần build cho hai kiến trúc: kết quả là một image index."],
          ["  --sbom=true --provenance=mode=max \\", "Gắn SBOM và provenance vào image dưới dạng attestation."],
          ["  --metadata-file meta.json \\", "Buildx ghi digest vào `meta.json` (khoá `containerimage.digest`)."],
          ["  -t \"$IMAGE:$TAG\" --push .", "`--push` đẩy thẳng lên registry: blob trước, manifest sau."],
          "",
          "DIGEST=$(python3 -c 'import json; print(json.load(open(\"meta.json\"))[\"containerimage.digest\"])')",
          "REF=\"$IMAGE@$DIGEST\"",
          "",
          ["trivy image --exit-code 1 --severity CRITICAL,HIGH \"$REF\"", "Mặc định Trivy thoát 0 kể cả khi có lỗ hổng; `--exit-code 1` mới làm CI dừng."],
          ["cosign sign --yes \"$REF\"", "Ký theo digest, không theo tag."],
          "",
          ["# Bước deploy: sửa manifest trong Git thành image: $REF", "GitOps: CI chỉ đổi digest trong Git; Argo CD/Flux reconcile cluster theo Git."],
        ],
      },
    },
    {
      title: "Bẫy hay gặp",
      points: [
        {
          t: "Build lại image cho từng môi trường (`docker build` ở staging, rồi build lần nữa ở production).",
          why: "Hai lần build có thể khác nhau (base image `:latest` đã đổi, dependency không khoá phiên bản), nên thứ chạy ở production chưa từng được test. Build một lần, promote cùng digest; khác biệt giữa môi trường để ở config (ConfigMap, Secret), không ở image.",
        },
        {
          t: "Đưa secret vào image (`COPY .env`, `ARG TOKEN`) rồi push lên registry.",
          why: "Ai kéo được image là đọc được secret trong layer, kể cả khi layer sau đã xoá file. Secret vào lúc chạy qua Secret của Kubernetes hoặc secret store; lúc build thì dùng build secret mount (bài `dockerfile`).",
        },
        {
          t: "Ghi `image: payment:v2` rồi push đè `v2` để \"hotfix\".",
          why: "Pod cũ trên node đã có `v2` không kéo lại (`IfNotPresent`), pod mới thì kéo bản mới: hai phiên bản cùng chạy và không ai thấy trong lịch sử deploy. Hotfix là một commit mới, một tag mới, một digest mới.",
        },
      ],
    },
  ],
  tips: [
    {
      t: "Được hỏi \"deploy lên Kubernetes thế nào\", kể đủ chuỗi: build một lần → tag SHA → push → scan, SBOM, ký → ghi digest vào Git → GitOps reconcile → promote cùng digest.",
      why: "Mỗi mắt xích trả lời một câu hỏi tiếp theo hay gặp: rollback thế nào (revert commit Git về digest cũ), biết đang chạy gì (digest + SBOM), làm sao chắc image không bị thay (digest + chữ ký).",
    },
    {
      t: "Nói rõ vì sao digest chứ không phải tag: tag đổi được, digest là hash nội dung.",
      why: "Đây là câu phân biệt người đã vận hành với người chỉ chạy `kubectl apply` trên máy mình, và dẫn sang `imagePullPolicy`, tag immutability, ký image.",
    },
  ],
  cards: [
    [
      "Tag và digest khác nhau thế nào?",
      "Tag là tên dễ đọc, có thể bị trỏ sang image khác. Digest là hash nội dung (`sha256:…`), bất biến. Deploy bằng digest thì mọi pod chạy đúng một bản.",
    ],
    [
      "Không khai `imagePullPolicy` và dùng tag `v1.2` thì policy là gì? Push đè `v1.2` thì sao?",
      "`IfNotPresent`. Node đã có `v1.2` cũ tiếp tục chạy bản cũ, node mới kéo bản mới: hai phiên bản lẫn nhau.",
    ],
    [
      "Vì sao build một lần rồi promote, không build lại cho production?",
      "Build lại có thể ra image khác (base, dependency đã đổi), nên production chạy thứ chưa được test. Promote cùng digest đảm bảo thứ chạy là thứ đã kiểm.",
    ],
    [
      "SBOM dùng để làm gì?",
      "Liệt kê package và phiên bản trong image. Khi một CVE mới công bố, tra SBOM để biết ngay image nào bị ảnh hưởng mà không phải kéo và quét lại từng image.",
    ],
    [
      "Trivy tìm ra lỗ hổng CRITICAL nhưng CI vẫn xanh. Vì sao?",
      "Trivy mặc định thoát với mã 0. Phải thêm `--exit-code 1` (kèm `--severity` để chọn mức chặn).",
    ],
    [
      "Rollback trong GitOps làm thế nào?",
      "Revert commit đã đổi digest trong Git; agent GitOps thấy trạng thái mong muốn đổi và reconcile cluster về digest cũ.",
    ],
  ],
  related: ["docker-build-cache", "k8s-reconcile"],
});
