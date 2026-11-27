/*
 * Engine mô phỏng: window.mountSim(root, sim). Không chứa kịch bản — kịch bản ở content/sims/<id>.js
 * và trong `hld` của content/problems/<id>.js.
 *
 * Kịch bản dạng flow: nodes + steps, `context` (bối cảnh, tuỳ chọn). Mỗi step:
 *   note   — lời dẫn của bước
 *   msgs   — danh sách message chạy lần lượt; phần tử {par:[...]} chạy song song
 *            message = [from, to, label, kind]  kind: req (mặc định) | ok | err | warn
 *   set    — cập nhật dòng trạng thái dưới node (cộng dồn qua các bước)
 *   bad / good — tô đỏ / xanh node ở bước này
 *   cut / uncut — cắt / nối lại link giữa hai node
 *   lesson — bài học rút ra (hiện ở bước cuối)
 *   detail — "chuyện gì xảy ra" ở bước này (tuỳ chọn)
 * Variant có thể khai báo `nodes` riêng.
 * Trường `custom` (arch, code, stack, decide, kgroup, rplay, bucket, ring, vending, binary) chọn renderer riêng;
 * dữ liệu renderer cần được ghi chú ở đầu từng hàm mount* (D7 trong docs/decisions.md).
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const NW = 136, NH = 48;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Dùng inline của app.js (có tooltip thuật ngữ) khi đã sẵn sàng
  const inline = (s) => (window.glossInline ? window.glossInline(s) : esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"));
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function wrap(text, max) {
    const out = [];
    String(text).split("\n").forEach((line) => {
      let cur = "";
      line.split(" ").forEach((w) => {
        if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; }
        else cur = (cur + " " + w).trim();
      });
      out.push(cur);
    });
    return out;
  }
  // Chip chọn variant/tab: trạng thái "on" cũng báo cho trình đọc màn hình (chỉ với <button>)
  const setOn = (c, on) => { c.classList.toggle("on", on); if (c.tagName === "BUTTON") c.setAttribute("aria-pressed", on); };
  let uidSeq = 0;
  function defs(svg) {
    const uid = "s" + ++uidSeq;
    const d = el("defs", {}, svg);
    ["req", "ok", "err", "warn", "mute"].forEach((k) => {
      const m = el("marker", { id: `${uid}-${k}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, d);
      el("path", { d: "M0,0 L10,5 L0,10 z", class: `mk-${k}` }, m);
    });
    return uid;
  }
  // Điểm trên cạnh hộp node theo hướng tới điểm khác
  function edgePoint(n, tx, ty, pad = 4) {
    const w = (n.w || NW) / 2 + pad, h = NH / 2 + pad;
    const dx = tx - n.x, dy = ty - n.y;
    if (!dx && !dy) return [n.x, n.y];
    const t = Math.min(dx ? w / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
    return [n.x + dx * t, n.y + dy * t];
  }

  /* ───────────── Flow engine ───────────── */
  function mountFlow(root, sim) {
    const variants = sim.variants || [{ name: null, steps: sim.steps }];
    let vi = 0, i = -1, playing = false, speed = 1, runId = 0;
    let nodes, byId, svg, uid, gLinks, gArrows, gNodes, gLbl, gPk;
    // Giải thích chi tiết: sim.context (bối cảnh) + step.detail ("chuyện gì xảy ra" ở từng bước)
    const detailOf = (v, k) => variants[v].steps[k]?.detail;

    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      ${sim.context ? `<details class="sim-context" open><summary>Bối cảnh — cần để ý gì</summary><div>${inline(sim.context)}</div></details>` : ""}
      ${variants.length > 1 ? `<div class="sim-variants">${variants.map((v, k) => `<button class="chip" data-v="${k}">${esc(v.name)}</button>`).join("")}</div>` : ""}
      <div class="sim-stage"></div>
      <div class="sim-note" aria-live="polite"></div>
      <ol class="sim-log"></ol>
      <div class="sim-ctrl">
        <button class="btn" data-a="reset" title="Về đầu" aria-label="Về đầu">⟲</button>
        <button class="btn" data-a="prev" title="Bước trước" aria-label="Bước trước">◀</button>
        <button class="btn primary" data-a="play">▶ Chạy</button>
        <button class="btn" data-a="next" title="Bước sau" aria-label="Bước sau">▶|</button>
        <span class="sim-step"></span>
        <select data-a="speed" aria-label="Tốc độ"><option value="0.6">0.5×</option><option value="1" selected>1×</option><option value="1.8">2×</option></select>
      </div>`;
    const stage = root.querySelector(".sim-stage");
    const noteEl = root.querySelector(".sim-note");
    const logEl = root.querySelector(".sim-log");
    const stepEl = root.querySelector(".sim-step");
    const playBtn = root.querySelector('[data-a="play"]');

    const steps = () => variants[vi].steps;
    const alive = () => root.isConnected;

    function build() {
      nodes = (variants[vi].nodes || sim.nodes).map((n) => ({ ...n }));
      byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      stage.innerHTML = "";
      svg = el("svg", { viewBox: `0 0 800 ${sim.h || 300}`, class: "sim-svg", role: "img", "aria-label": sim.title }, stage);
      uid = defs(svg);
      gLinks = el("g", {}, svg); gArrows = el("g", {}, svg); gNodes = el("g", {}, svg); gLbl = el("g", {}, svg); gPk = el("g", {}, svg);
      (variants[vi].links || sim.links || []).forEach(([a, b]) => {
        const A = byId[a], B = byId[b];
        el("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "sl", "data-l": [a, b].sort().join("|") }, gLinks);
      });
      nodes.forEach((n) => {
        const w = n.w || NW;
        const g = el("g", { class: "sn", transform: `translate(${n.x},${n.y})` }, gNodes);
        el("rect", { x: -w / 2, y: -NH / 2, width: w, height: NH, rx: 10 }, g);
        const t = el("text", { class: "sn-t", y: 5, "text-anchor": "middle" }, g);
        t.textContent = n.label;
        n.g = g;
        n.sub = el("text", { class: "sn-s", y: NH / 2 + 16, "text-anchor": "middle" }, g);
      });
      root.querySelectorAll(".sim-variants .chip").forEach((c) => setOn(c, +c.dataset.v === vi));
    }

    function state(k) {
      const text = Object.fromEntries(nodes.map((n) => [n.id, n.s || ""]));
      const cut = new Set();
      for (let j = 0; j <= k; j++) {
        const s = steps()[j];
        Object.assign(text, s.set || {});
        (s.cut || []).forEach((p) => cut.add(p.slice().sort().join("|")));
        (s.uncut || []).forEach((p) => cut.delete(p.slice().sort().join("|")));
      }
      return { text, cut };
    }

    function paint() {
      const { text, cut } = state(i);
      const s = steps()[i] || {};
      const involved = new Set(flat(s.msgs || []).flatMap((m) => [m[0], m[1]]));
      nodes.forEach((n) => {
        n.sub.innerHTML = "";
        wrap(text[n.id], 30).forEach((line, li) => {
          const ts = el("tspan", { x: 0, dy: li ? 14 : 0 }, n.sub);
          ts.textContent = line;
        });
        n.g.setAttribute("class", "sn" + (involved.has(n.id) ? " hl" : "") + ((s.bad || []).includes(n.id) ? " bad" : "") + ((s.good || []).includes(n.id) ? " good" : ""));
      });
      gLinks.querySelectorAll(".sl").forEach((l) => l.classList.toggle("cut", cut.has(l.dataset.l)));
      stepEl.textContent = i < 0 ? `0 / ${steps().length}` : `${i + 1} / ${steps().length}`;
      if (i < 0) {
        noteEl.innerHTML = `<span class="muted">Bấm <b>▶ Chạy</b> để xem từng bước, hoặc <b>▶|</b> để đi tay.</span>`;
      } else {
        const det = detailOf(vi, i);
        noteEl.innerHTML = `<span class="sim-n">Bước ${i + 1}</span>${inline(s.note || "")}` +
          (det ? `<div class="sim-detail"><b>Chuyện gì xảy ra</b>${inline(det)}</div>` : "") +
          (s.lesson ? `<div class="sim-lesson"><b>Bài học</b>${inline(s.lesson)}</div>` : "");
      }
    }
    const flat = (msgs) => msgs.flatMap((m) => (m.par ? m.par : [m]));

    function geom(m, occ) {
      const A = byId[m[0]], B = byId[m[1]];
      const [p0, p1] = [m[0], m[1]].sort();
      const P0 = byId[p0], P1 = byId[p1];
      const len = Math.hypot(P1.x - P0.x, P1.y - P0.y) || 1;
      const nx = -(P1.y - P0.y) / len, ny = (P1.x - P0.x) / len;
      const side = m[0] === p0 ? 1 : -1;
      const off = side * (8 + occ * 18);
      const a = edgePoint(A, B.x, B.y), b = edgePoint(B, A.x, A.y);
      return { x1: a[0] + nx * off, y1: a[1] + ny * off, x2: b[0] + nx * off, y2: b[1] + ny * off, nx: nx * side, ny: ny * side };
    }

    function label(parent, x, y, text, kind, cls) {
      const t = el("text", { x, y, "text-anchor": "middle", class: `sm-l ${cls || ""} k-${kind}` }, parent);
      t.textContent = text;
      return t;
    }

    function drawStatic(m, g, num, showLabel) {
      const kind = m[3] || "req";
      el("line", { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, class: `sm k-${kind}${showLabel ? "" : " faded"}`, "marker-end": `url(#${uid}-${showLabel ? kind : "mute"})` }, gArrows);
      const mx = (g.x1 + g.x2) / 2 + g.nx * 10, my = (g.y1 + g.y2) / 2 + g.ny * 10 + 4;
      if (showLabel) label(gLbl, mx, my, `${num}. ${m[2]}`, kind);
      else {
        el("circle", { cx: mx, cy: my - 4, r: 8, class: "sm-num" }, gLbl);
        label(gLbl, mx, my, String(num), "mute", "sm-numt");
      }
    }

    function animate(m, g, my) {
      const kind = m[3] || "req";
      const pk = el("g", { class: `pk k-${kind}` }, gPk);
      el("circle", { r: 6 }, pk);
      label(pk, 0, -11, m[2], kind);
      const dur = 750 / speed;
      return new Promise((res) => {
        const t0 = performance.now();
        function frame(now) {
          if (my !== runId || !alive()) { pk.remove(); return res(); }
          const t = Math.min(1, (now - t0) / dur);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          pk.setAttribute("transform", `translate(${g.x1 + (g.x2 - g.x1) * e},${g.y1 + (g.y2 - g.y1) * e})`);
          if (t < 1) requestAnimationFrame(frame); else { pk.remove(); res(); }
        }
        requestAnimationFrame(frame);
      });
    }

    async function show(k, anim) {
      i = k;
      const my = ++runId;
      gArrows.innerHTML = ""; gLbl.innerHTML = ""; gPk.innerHTML = ""; logEl.innerHTML = "";
      paint();
      if (i < 0) return;
      const groups = steps()[i].msgs || [];
      const occ = {};
      let num = 0;
      const drawn = [];
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = groups[gi].par || [groups[gi]];
        const items = grp.map((m) => {
          const key = [m[0], m[1]].sort().join("|") + (m[0] < m[1] ? ">" : "<");
          const o = (occ[key] = (occ[key] ?? -1) + 1);
          return { m, g: geom(m, o % 4), num: ++num };
        });
        if (anim) {
          await Promise.all(items.map((it) => animate(it.m, it.g, my)));
          if (my !== runId || !alive()) return;
        }
        // Chỉ nhóm mới nhất có nhãn đầy đủ; nhóm cũ mờ đi kèm số thứ tự
        drawn.push(...items);
        gArrows.innerHTML = ""; gLbl.innerHTML = "";
        drawn.forEach((it) => drawStatic(it.m, it.g, it.num, grp.some((m) => m === it.m)));
        items.forEach((it) => {
          const li = document.createElement("li");
          li.className = `k-${it.m[3] || "req"}`;
          li.innerHTML = `<b>${esc(byId[it.m[0]].label)} → ${esc(byId[it.m[1]].label)}</b> ${esc(it.m[2])}`;
          logEl.appendChild(li);
        });
      }
      if (playing && my === runId) {
        const det = detailOf(vi, i);
        await sleep((1500 + (det ? det.length * 28 : 0)) / speed);
        if (!playing || my !== runId || !alive()) return;
        if (i < steps().length - 1) show(i + 1, true);
        else { playing = false; syncBtn(); }
      }
    }
    function syncBtn() { playBtn.textContent = playing ? "⏸ Dừng" : i >= steps().length - 1 ? "↻ Chạy lại" : "▶ Chạy"; }

    root.addEventListener("click", (e) => {
      const v = e.target.closest("[data-v]");
      if (v) { vi = +v.dataset.v; playing = false; build(); show(-1); syncBtn(); return; }
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "play") {
        if (playing) { playing = false; runId++; syncBtn(); return; }
        playing = true;
        if (i >= steps().length - 1) i = -1;
        syncBtn();
        show(i + 1, true);
      } else if (a === "next" && i < steps().length - 1) { playing = false; show(i + 1, true); syncBtn(); }
      else if (a === "prev") { playing = false; show(Math.max(-1, i - 1), false); syncBtn(); }
      else if (a === "reset") { playing = false; show(-1); syncBtn(); }
    });
    root.querySelector('[data-a="speed"]').addEventListener("change", (e) => (speed = +e.target.value));
    build();
    show(-1);
  }

  /* ───────────── Custom: Consistent hashing ring ───────────── */
  const PALETTE = ["#3b7ff5", "#14a37f", "#e08a00", "#d64545", "#8b5cf6", "#0ea5b7"];
  function hash(s) {
    let h = 0x811c9dc5;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }
  function mountRing(root, sim) {
    const KEYS = Array.from({ length: 40 }, (_, k) => `user:${k + 1}`);
    let servers, next, vn, owner, msg, moved, movedMod;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="ring-wrap"><div class="sim-stage ring-stage"></div><div class="ring-panel"></div></div>
      <div class="sim-ctrl">
        <button class="btn primary" data-a="add">+ Thêm server</button>
        <button class="btn" data-a="del">− Xoá server</button>
        <button class="btn" data-a="vn"></button>
        <button class="btn" data-a="reset" title="Về đầu" aria-label="Về đầu">⟲</button>
      </div>`;
    const stage = root.querySelector(".ring-stage"), panel = root.querySelector(".ring-panel");
    const points = () => servers.flatMap((s, si) => Array.from({ length: vn }, (_, v) => ({ s, si, a: (hash(`${s.name}#${v}#244`) / 2 ** 32) * 360 }))).sort((p, q) => p.a - q.a);
    const keyAngle = (k) => (hash(k) / 2 ** 32) * 360;
    function assign() {
      const pts = points();
      return Object.fromEntries(KEYS.map((k) => { const a = keyAngle(k); return [k, (pts.find((p) => p.a >= a) || pts[0]).s.name]; }));
    }
    const modAssign = (list) => Object.fromEntries(KEYS.map((k) => [k, list[hash(k) % list.length].name]));
    function reset() {
      servers = [{ name: "S1", c: PALETTE[0] }, { name: "S2", c: PALETTE[1] }, { name: "S3", c: PALETTE[2] }];
      next = 4; vn = 1; owner = assign(); moved = new Set(); movedMod = null;
      msg = "40 key được băm lên vòng. Mỗi key thuộc server **đầu tiên theo chiều kim đồng hồ**.";
      render();
    }
    function change(fn, text, compare = true) {
      const before = owner, beforeList = servers.slice();
      fn();
      owner = assign();
      moved = compare ? new Set(KEYS.filter((k) => before[k] !== owner[k])) : new Set();
      const ma = modAssign(beforeList), mb = modAssign(servers);
      movedMod = compare ? KEYS.filter((k) => ma[k] !== mb[k]).length : null;
      msg = text;
      render();
    }
    const pos = (a, r) => [200 + r * Math.sin((a * Math.PI) / 180), 190 - r * Math.cos((a * Math.PI) / 180)];
    function render() {
      stage.innerHTML = "";
      const svg = el("svg", { viewBox: "0 0 400 380", class: "sim-svg ring-svg" }, stage);
      el("circle", { cx: 200, cy: 190, r: 150, class: "ring" }, svg);
      const color = Object.fromEntries(servers.map((s) => [s.name, s.c]));
      KEYS.forEach((k) => {
        const [x, y] = pos(keyAngle(k), 124);
        if (moved.has(k)) el("circle", { cx: x, cy: y, r: 8.5, class: "moved" }, svg);
        el("circle", { cx: x, cy: y, r: 5, fill: color[owner[k]] }, svg);
      });
      points().forEach((p) => {
        const [x, y] = pos(p.a, 150);
        el("rect", { x: x - 6, y: y - 6, width: 12, height: 12, rx: 3, fill: p.s.c, class: "srv" }, svg);
        if (vn > 1) return;
        const [lx, ly] = pos(p.a, 172);
        const t = el("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "srv-t" }, svg);
        t.textContent = p.s.name;
      });
      const load = Object.fromEntries(servers.map((s) => [s.name, 0]));
      KEYS.forEach((k) => load[owner[k]]++);
      const max = Math.max(...Object.values(load), 1);
      panel.innerHTML = `
        <div class="ring-msg">${inline(msg)}</div>
        <div class="ring-h">Tải mỗi server (key)</div>
        ${servers.map((s) => `<div class="ring-row"><span><span style="color:${s.c}">■</span> ${s.name}</span>
          <div class="bar"><i style="width:${(load[s.name] / max) * 100}%;background:${s.c}"></i></div><b>${load[s.name]}</b></div>`).join("")}
        ${movedMod !== null ? `<div class="ring-cmp">
          <div><b>${moved.size}</b>/40 key di chuyển với consistent hashing</div>
          <div class="muted"><b>${movedMod}</b>/40 key sẽ di chuyển nếu dùng <code>hash % N</code></div></div>` : ""}
        <div class="muted ring-legend">○ viền = key vừa đổi chủ · ■ trên vòng = vị trí server${vn > 1 ? " (mỗi server 12 virtual node)" : ""}</div>`;
      root.querySelector('[data-a="vn"]').textContent = vn > 1 ? "Virtual nodes: Bật" : "Virtual nodes: Tắt";
      root.querySelector('[data-a="add"]').disabled = servers.length >= 6;
      root.querySelector('[data-a="del"]').disabled = servers.length <= 1;
    }
    root.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "add") change(() => servers.push({ name: `S${next}`, c: PALETTE[(next++ - 1) % PALETTE.length] }),
        `Thêm **${"S" + next}**: chỉ các key nằm ngay trước nó trên vòng đổi chủ — server khác không bị ảnh hưởng.`);
      if (a === "del") {
        const victim = servers[Math.floor(servers.length / 2)];
        change(() => (servers = servers.filter((s) => s !== victim)), `Xoá **${victim.name}** (server sập): key của nó chuyển sang server kế tiếp theo chiều kim đồng hồ.`);
      }
      if (a === "vn") change(() => (vn = vn > 1 ? 1 : 12), vn > 1 ? "Tắt virtual nodes: mỗi server chỉ 1 điểm → khoảng trên vòng lệch, tải không đều." : "Bật **12 virtual node** mỗi server: điểm rải đều hơn → tải cân bằng hơn. Thử xoá server để thấy tải của nó chia cho nhiều server.", false);
      if (a === "reset") reset();
    });
    reset();
  }

  /* ───────────── Custom: Vending machine (State pattern) ───────────── */
  function mountVending(root, sim) {
    // states: { tên: [x, y] } · actions: [[action, nhãn nút]] · transitions: [{ from, to, on, label, bend, stock? (cộng), restock?, when?: "stock" | "empty" }]
    const { states: S, actions: ACTIONS, transitions: T } = sim;
    let cur, stock, log, fired, flash;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="sim-stage"></div>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl">${ACTIONS.map(([a, l]) => `<button class="btn" data-a="${a}">${l}</button>`).join("")}<button class="btn" data-a="reset" title="Về đầu" aria-label="Về đầu">⟲</button></div>
      <ol class="sim-log"></ol>`;
    const stage = root.querySelector(".sim-stage"), note = root.querySelector(".sim-note"), logEl = root.querySelector(".sim-log");
    function reset() { cur = sim.initial; stock = sim.stock; log = []; fired = null; flash = null; render(); }
    function act(a) {
      let to = null, why = "";
      const t = T.find((x) => x.from === cur && x.on === a && (!x.when || (x.when === "stock") === stock > 0));
      if (t) { to = t.to; if (t.stock) stock += t.stock; if (t.restock != null) stock = t.restock; }
      else why = cur === "SoldOut" && a === "insertCoin" ? "máy hết hàng — xu bị trả lại" : `trạng thái **${cur}** không có hành động này`;
      const label = ACTIONS.find((x) => x[0] === a)[1];
      if (to) { fired = [cur, to]; log.unshift(`✓ ${label}: ${cur} → ${to}`); cur = to; flash = null; }
      else { fired = null; flash = `❌ Không thể “${label}” — ${why}. State pattern chặn chuyển trạng thái không hợp lệ.`; log.unshift(`✗ ${label} ở ${cur}`); }
      render();
    }
    function render() {
      stage.innerHTML = "";
      const svg = el("svg", { viewBox: "0 0 800 300", class: "sim-svg" }, stage);
      const uid = defs(svg);
      T.forEach(({ from: a, to: b, label: l, bend }) => {
        const A = { x: S[a][0], y: S[a][1], w: 150 }, B = { x: S[b][0], y: S[b][1], w: 150 };
        const len = Math.hypot(B.x - A.x, B.y - A.y), nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
        const p = edgePoint(A, B.x, B.y, 6), q = edgePoint(B, A.x, A.y, 6);
        const off = bend ? 14 : 0;
        const x1 = p[0] + nx * off, y1 = p[1] + ny * off, x2 = q[0] + nx * off, y2 = q[1] + ny * off;
        const on = fired && fired[0] === a && fired[1] === b;
        el("line", { x1, y1, x2, y2, class: `sm ${on ? "k-ok fire" : "k-mute"}`, "marker-end": `url(#${uid}-${on ? "ok" : "mute"})` }, svg);
        const t = el("text", { x: (x1 + x2) / 2 + nx * 14, y: (y1 + y2) / 2 + ny * 14 + 4, "text-anchor": "middle", class: `sm-l ${on ? "k-ok" : "k-mute"}` }, svg);
        t.textContent = l;
      });
      Object.entries(S).forEach(([name, [x, y]]) => {
        const g = el("g", { class: "sn" + (name === cur ? (flash ? " bad" : " good") : ""), transform: `translate(${x},${y})` }, svg);
        el("rect", { x: -75, y: -24, width: 150, height: 48, rx: 24 }, g);
        const t = el("text", { class: "sn-t", y: 5, "text-anchor": "middle" }, g);
        t.textContent = name;
      });
      const st = el("text", { x: 20, y: 28, class: "sn-t" }, svg);
      st.textContent = `Tồn kho: ${stock}`;
      note.innerHTML = flash ? `<span class="k-err-text">${inline(flash)}</span>` : `Trạng thái hiện tại: <b>${cur}</b>. Thử bấm một hành động <i>không hợp lệ</i> (ví dụ “Chọn món” khi chưa bỏ xu) để xem máy từ chối.`;
      logEl.innerHTML = log.slice(0, 6).map((l) => `<li class="${l.startsWith("✓") ? "k-ok" : "k-err"}">${esc(l)}</li>`).join("");
    }
    root.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "reset") reset(); else if (a) act(a);
    });
    reset();
  }

  /* ───────────── Custom: Binary search ───────────── */
  function mountBinary(root, sim) {
    // array: mảng đã sắp xếp · missing: giá trị không có trong mảng (20% lần chọn)
    const ARR = sim.array;
    let target, lo, hi, mid, found, log, done, cmp;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="bs-target"></div>
      <div class="bs-arr"></div>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl"><button class="btn primary" data-a="step">Bước tiếp</button><button class="btn" data-a="all">Chạy hết</button><button class="btn" data-a="new">Target mới</button></div>
      <ol class="sim-log"></ol>`;
    function fresh() {
      target = Math.random() < 0.8 ? ARR[Math.floor(Math.random() * ARR.length)] : sim.missing;
      lo = 0; hi = ARR.length - 1; mid = null; found = -1; log = []; done = false; cmp = 0;
      render();
    }
    function step() {
      if (done) return;
      if (lo > hi) { done = true; log.push(`lo=${lo} > hi=${hi} → không tìm thấy ${target}`); return render(); }
      mid = (lo + hi) >> 1;
      cmp++;
      if (ARR[mid] === target) { found = mid; done = true; log.push(`mid=${mid}: ${ARR[mid]} = ${target} → tìm thấy!`); }
      else if (ARR[mid] < target) { log.push(`mid=${mid}: ${ARR[mid]} < ${target} → bỏ nửa trái, lo = ${mid + 1}`); lo = mid + 1; }
      else { log.push(`mid=${mid}: ${ARR[mid]} > ${target} → bỏ nửa phải, hi = ${mid - 1}`); hi = mid - 1; }
      if (!done && lo > hi) { done = true; log.push(`lo > hi → ${target} không có trong mảng`); }
      render();
    }
    function render() {
      root.querySelector(".bs-target").innerHTML = `Tìm <b>${target}</b> trong mảng đã sắp xếp (n = ${ARR.length})`;
      root.querySelector(".bs-arr").innerHTML = ARR.map((v, k) => {
        const cls = [k === found ? "found" : "", k === mid && k !== found ? "mid" : "", !done && (k < lo || k > hi) ? "out" : "", done && found < 0 ? "out" : ""].join(" ");
        const tag = !done && k === lo ? "lo" : !done && k === hi ? "hi" : "";
        return `<div class="bs-cell ${cls}"><span class="i">${k}</span>${v}<span class="p">${tag}${k === mid ? (tag ? "·" : "") + "mid" : ""}</span></div>`;
      }).join("");
      const lin = ARR.indexOf(target);
      root.querySelector(".sim-note").innerHTML = done
        ? `Binary search: <b>${cmp}</b> lần so sánh (tối đa ⌈log₂${ARR.length}⌉ + 1 = ${Math.ceil(Math.log2(ARR.length)) + 1}). Linear search: <b>${lin >= 0 ? lin + 1 : ARR.length}</b> lần.`
        : `Mỗi bước loại bỏ một nửa khoảng [lo, hi] → O(log n).`;
      root.querySelector(".sim-log").innerHTML = log.map((l) => `<li>${esc(l)}</li>`).join("");
      root.querySelector('[data-a="step"]').disabled = done;
      root.querySelector('[data-a="all"]').disabled = done;
    }
    root.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "step") step();
      if (a === "all") while (!done) step();
      if (a === "new") fresh();
    });
    fresh();
  }

  /* ───────────── Custom: Token bucket ───────────── */
  function mountBucket(root, sim) {
    const CAP = 10, RATE = 2; // token, token/giây
    let tokens, ok, denied, log, timer;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="tb-wrap"><div class="tb-bucket"></div><div class="tb-stats"></div></div>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl"><button class="btn primary" data-a="one">Gửi 1 request</button><button class="btn" data-a="burst">Burst 8 request</button><button class="btn" data-a="reset" title="Về đầu" aria-label="Về đầu">⟲</button></div>
      <ol class="sim-log"></ol>`;
    function reset() { tokens = CAP; ok = 0; denied = 0; log = []; render("Bucket đầy 10 token, nạp lại **2 token/giây**. Mỗi request lấy 1 token; hết token → 429."); }
    function send(n) {
      let a = 0, d = 0;
      for (let k = 0; k < n; k++) { if (tokens >= 1) { tokens -= 1; a++; } else d++; }
      ok += a; denied += d;
      log.unshift(`${n} request → ${a} cho qua${d ? `, ${d} bị 429` : ""} · còn ${Math.floor(tokens)} token`);
      render(d ? `**${d} request bị chặn (429)** vì bucket cạn. Chờ vài giây để token nạp lại.` : "Burst được cho qua miễn còn token, nhưng tối đa bằng dung lượng bucket — fixed window có thể cho burst gấp đôi ở ranh giới cửa sổ.");
    }
    function render(msg) {
      root.querySelector(".tb-bucket").innerHTML = Array.from({ length: CAP }, (_, k) =>
        `<span class="tb-tok ${k < Math.floor(tokens) ? "on" : ""}"></span>`).join("");
      root.querySelector(".tb-stats").innerHTML = `<div><b>${Math.floor(tokens)}</b>/10 token</div><div class="muted">Cho qua: <b>${ok}</b> · Bị chặn: <b>${denied}</b></div>`;
      if (msg) root.querySelector(".sim-note").innerHTML = inline(msg);
      root.querySelector(".sim-log").innerHTML = log.slice(0, 5).map((l) => `<li>${esc(l)}</li>`).join("");
    }
    timer = setInterval(() => {
      if (!root.isConnected) return clearInterval(timer);
      if (tokens < CAP) { tokens = Math.min(CAP, tokens + RATE / 4); render(); }
    }, 250);
    root.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "one") send(1); if (a === "burst") send(8); if (a === "reset") reset();
    });
    reset();
  }

  /* ───────────── Custom: Kafka consumer group ───────────── */
  function mountKafkaGroup(root, sim) {
    const P = 4, KEYS = ["user-1", "user-2", "user-3", "user-4", "user-5", "user-6"];
    const KC = ["#3b7ff5", "#14a37f", "#e08a00", "#d64545", "#8b5cf6", "#0ea5b7"];
    const part = (k) => hash(k) % P;
    let logs, committed, consumers, next, auto, timer, msg, rr;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="kg-topic"></div>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl">
        <button class="btn primary" data-a="auto"></button>
        <button class="btn" data-a="send">Gửi 1 message</button>
        <button class="btn" data-a="add">+ Consumer</button>
        <button class="btn" data-a="del">− Consumer (crash)</button>
        <button class="btn" data-a="reset" title="Về đầu" aria-label="Về đầu">⟲</button>
      </div>`;
    const assign = () => Object.fromEntries(Array.from({ length: P }, (_, p) => [p, consumers.length ? consumers[p % consumers.length] : null]));
    function reset() {
      logs = Array.from({ length: P }, () => []); committed = Array(P).fill(0);
      consumers = ["C1"]; next = 2; auto = false; rr = 0;
      msg = "Topic `orders` có **4 partition**, group chỉ có **1 consumer** — C1 phải đọc cả 4. Bật **Tự chạy** để producer gửi liên tục và xem lag tăng.";
      render();
    }
    function produce(n) {
      for (let k = 0; k < n; k++) {
        const key = KEYS[(rr++ * 7 + Math.floor(Math.random() * 3)) % KEYS.length];
        const p = part(key);
        logs[p].push({ key, off: logs[p].length });
      }
    }
    function consume() {
      // Mỗi consumer xử lý 1 message mỗi tick, xoay vòng giữa các partition được giao
      const a = assign();
      consumers.forEach((c) => {
        const mine = Object.keys(a).filter((p) => a[p] === c).map(Number).filter((p) => committed[p] < logs[p].length);
        if (!mine.length) return;
        mine.sort((x, y) => (logs[y].length - committed[y]) - (logs[x].length - committed[x]));
        committed[mine[0]]++;
      });
    }
    function tick() {
      if (!root.isConnected) return clearInterval(timer);
      produce(2); consume(); render();
    }
    function render() {
      const a = assign();
      const idle = consumers.filter((c) => !Object.values(a).includes(c));
      const ccol = (c) => PALETTE[(+c.slice(1) - 1) % PALETTE.length];
      root.querySelector(".kg-topic").innerHTML = Array.from({ length: P }, (_, p) => {
        const lag = logs[p].length - committed[p];
        const shown = logs[p].slice(-14);
        return `<div class="kg-row">
          <div class="kg-p">P${p}</div>
          <div class="kg-log">${shown.map((m) => `<span class="kg-m ${m.off < committed[p] ? "done" : ""}" style="--c:${KC[KEYS.indexOf(m.key)]}" title="${m.key} · offset ${m.off}">${m.key.slice(-1)}<i>${m.off}</i></span>`).join("")}</div>
          <div class="kg-c">${a[p] ? `<b style="color:${ccol(a[p])}">${a[p]}</b>` : "—"} <span class="${lag > 10 ? "k-err-text" : "muted"}">lag ${lag}</span></div>
        </div>`;
      }).join("") + `<div class="kg-foot">
        <span>Key → partition: ${KEYS.map((k, i) => `<span style="color:${KC[i]}">■</span> ${k}→P${part(k)}`).join(" · ")}</span>
        ${idle.length ? `<span class="k-err-text">Rảnh (không có partition): ${idle.join(", ")}</span>` : ""}
      </div>`;
      root.querySelector(".sim-note").innerHTML = inline(msg);
      root.querySelector('[data-a="auto"]').textContent = auto ? "⏸ Dừng" : "▶ Tự chạy";
      root.querySelector('[data-a="del"]').disabled = consumers.length <= 1;
    }
    root.addEventListener("click", (e) => {
      const act = e.target.closest("[data-a]")?.dataset.a;
      if (act === "auto") {
        auto = !auto;
        clearInterval(timer);
        if (auto) timer = setInterval(tick, 700);
      }
      if (act === "send") { produce(1); consume(); msg = "Cùng một key luôn vào **cùng partition** (cùng màu nằm cùng hàng) → thứ tự theo key được giữ."; }
      if (act === "add") {
        consumers.push(`C${next++}`);
        msg = consumers.length > P
          ? `**Rebalance** xong: ${consumers.length} consumer nhưng chỉ có ${P} partition → consumer dư **ngồi rảnh**. Muốn song song hơn phải tăng partition.`
          : `**Rebalance**: chia lại ${P} partition cho ${consumers.length} consumer → mỗi consumer gánh ít hơn, lag giảm dần.`;
      }
      if (act === "del" && consumers.length > 1) {
        const dead = consumers.splice(Math.floor(Math.random() * consumers.length), 1)[0];
        msg = `**${dead} crash** → mất heartbeat → rebalance: partition của nó chuyển cho consumer còn lại và đọc tiếp từ **offset đã commit**, không mất message.`;
      }
      if (act === "reset") { auto = false; clearInterval(timer); return reset(); }
      render();
    });
    reset();
  }

  /* ───────────── Custom: Redis playground ───────────── */
  function mountRedisPlay(root, sim) {
    const TABS = [["zset", "Sorted Set · Leaderboard"], ["ttl", "String · Counter & TTL"], ["lock", "Lock · SET NX PX"]];
    let tab = "zset", st, out, timer;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="sim-variants">${TABS.map(([k, l]) => `<button class="chip" data-t="${k}">${l}</button>`).join("")}</div>
      <div class="rp-wrap"><div class="rp-state"></div><pre class="rp-console"></pre></div>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl rp-btns"></div>`;
    const now = () => Date.now();
    function reset() {
      st = { board: { Alice: 120, Bob: 90, Chi: 75, Dung: 60 }, views: 0, keys: {}, lock: null };
      out = [];
      render();
    }
    const run = (cmd, res) => { out.push(`> ${cmd}`, res); out = out.slice(-12); };
    const ttlLeft = (k) => (st.keys[k] ? Math.max(0, Math.ceil((st.keys[k].exp - now()) / 1000)) : -2);
    function sweep() {
      Object.keys(st.keys).forEach((k) => { if (st.keys[k].exp <= now()) delete st.keys[k]; });
      if (st.lock && st.lock.exp <= now()) st.lock = null;
    }
    const BTN = {
      zset: [["+10 Alice", () => { st.board.Alice += 10; run("ZINCRBY board 10 Alice", `"${st.board.Alice}"`); }],
        ["+40 Dung", () => { st.board.Dung += 40; run("ZINCRBY board 40 Dung", `"${st.board.Dung}"`); }],
        ["+25 Chi", () => { st.board.Chi += 25; run("ZINCRBY board 25 Chi", `"${st.board.Chi}"`); }],
        ["Top 3", () => { const top = Object.entries(st.board).sort((a, b) => b[1] - a[1]).slice(0, 3); run("ZREVRANGE board 0 2 WITHSCORES", top.map(([n, s], i) => `${i * 2 + 1}) "${n}"  ${i * 2 + 2}) "${s}"`).join("\n")); }],
        ["Hạng của Bob", () => { const r = Object.entries(st.board).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === "Bob"); run("ZREVRANK board Bob", `(integer) ${r}`); }]],
      ttl: [["INCR page:views", () => { st.views++; run("INCR page:views", `(integer) ${st.views}`); }],
        ["SET otp EX 8", () => { st.keys["otp:42"] = { v: "381920", exp: now() + 8000 }; run('SET otp:42 "381920" EX 8', "OK"); }],
        ["GET otp", () => { sweep(); run("GET otp:42", st.keys["otp:42"] ? `"${st.keys["otp:42"].v}"` : "(nil)"); }],
        ["TTL otp", () => { sweep(); run("TTL otp:42", `(integer) ${ttlLeft("otp:42")}`); }]],
      lock: [["A lấy lock", () => { sweep(); if (st.lock) run('SET lock:order7 "A-uuid" NX PX 6000', "(nil)"); else { st.lock = { owner: "A", exp: now() + 6000 }; run('SET lock:order7 "A-uuid" NX PX 6000', "OK"); } }],
        ["B lấy lock", () => { sweep(); if (st.lock) run('SET lock:order7 "B-uuid" NX PX 6000', "(nil)"); else { st.lock = { owner: "B", exp: now() + 6000 }; run('SET lock:order7 "B-uuid" NX PX 6000', "OK"); } }],
        ["B nhả bằng DEL (sai)", () => { sweep(); const had = st.lock; st.lock = null; run("DEL lock:order7", had ? `(integer) 1   ← xoá cả lock của ${had.owner}!` : "(integer) 0"); }],
        ["B nhả bằng Lua (đúng)", () => { sweep(); const ok = st.lock && st.lock.owner === "B"; if (ok) st.lock = null; run('EVAL "if get==ARGV[1] then del" lock:order7 B-uuid', ok ? "(integer) 1" : "(integer) 0   ← không phải lock của B, giữ nguyên"); }]],
    };
    const NOTE = {
      zset: "Sorted set giữ phần tử **sắp xếp theo score**: cập nhật O(log N), lấy top K hoặc hạng của một người ngay lập tức — đúng thứ leaderboard cần.",
      ttl: "`INCR` là atomic nên nhiều server cùng tăng không bị mất lượt. Key có **TTL** tự biến mất khi hết hạn — hợp cho OTP, session, rate limit.",
      lock: "Lock = key có `NX` (chỉ set khi chưa có) + `PX` (tự hết hạn nếu chủ lock chết). Nhả lock phải **so token** bằng Lua — `DEL` thẳng có thể xoá lock của người khác.",
    };
    function render() {
      sweep();
      root.querySelectorAll("[data-t]").forEach((c) => setOn(c, c.dataset.t === tab));
      let html = "";
      if (tab === "zset") {
        const rows = Object.entries(st.board).sort((a, b) => b[1] - a[1]);
        const max = rows[0][1];
        html = `<div class="rp-h">board (sorted set)</div>` + rows.map(([n, s], i) => `<div class="rp-row"><span>#${i + 1} ${n}</span><div class="bar"><i style="width:${(s / max) * 100}%"></i></div><b>${s}</b></div>`).join("");
      } else if (tab === "ttl") {
        const t = ttlLeft("otp:42");
        html = `<div class="rp-h">keyspace</div><div class="rp-row"><span>page:views</span><b>${st.views}</b></div>
          <div class="rp-row"><span>otp:42</span><b>${t > 0 ? `"381920" · TTL ${t}s` : "(không tồn tại)"}</b></div>`;
      } else {
        const t = st.lock ? Math.ceil((st.lock.exp - now()) / 1000) : 0;
        html = `<div class="rp-h">lock:order7</div><div class="rp-lock ${st.lock ? "on" : ""}">${st.lock ? `🔒 ${st.lock.owner} giữ · còn ${t}s` : "🔓 trống"}</div>`;
      }
      root.querySelector(".rp-state").innerHTML = html;
      root.querySelector(".rp-console").textContent = out.length ? out.join("\n") : "# bấm một lệnh bên dưới";
      root.querySelector(".sim-note").innerHTML = inline(NOTE[tab]);
      root.querySelector(".rp-btns").innerHTML = BTN[tab].map(([l], i) => `<button class="btn" data-b="${i}">${esc(l)}</button>`).join("") + `<button class="btn" data-b="reset" title="Về đầu" aria-label="Về đầu">⟲</button>`;
    }
    root.addEventListener("click", (e) => {
      const t = e.target.closest("[data-t]");
      if (t) { tab = t.dataset.t; out = []; return render(); }
      const b = e.target.closest("[data-b]")?.dataset.b;
      if (b === "reset") return reset();
      if (b !== undefined) { BTN[tab][+b][1](); render(); }
    });
    timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (tab !== "zset") render(); }, 500);
    reset();
  }

  /* ───────────── Custom: ai quản lý lớp nào (ECS/EKS × compute) ───────────── */
  function mountStack(root, sim) {
    const NAME = { y: "Bạn", a: "AWS", s: "Chia sẻ" };
    // options: [{ id, label, fit }] · layers: [tên lớp, { optionId: "y" bạn | "a" AWS | "s" chia sẻ }] · cost: { optionId: chuỗi }
    const { options: OPTS, layers: LAYERS, cost: COST } = sim;
    let cur = sim.initial;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="sim-variants">${OPTS.map((o) => `<button class="chip" data-o="${o.id}">${o.label}</button>`).join("")}</div>
      <div class="st-wrap"><div class="st-stack"></div><div class="st-side"></div></div>
      <div class="table-wrap st-matrix"></div>`;
    function render() {
      const o = OPTS.find((x) => x.id === cur);
      root.querySelectorAll("[data-o]").forEach((c) => setOn(c, c.dataset.o === cur));
      root.querySelector(".st-stack").innerHTML = LAYERS.map(([name, m]) => `<div class="st-layer st-${m[cur]}"><span>${esc(name)}</span><b>${NAME[m[cur]]}</b></div>`).join("");
      const mine = LAYERS.filter(([, m]) => m[cur] === "y").length, shared = LAYERS.filter(([, m]) => m[cur] === "s").length;
      root.querySelector(".st-side").innerHTML = `
        <div class="st-score"><b>${mine}</b> lớp bạn tự lo · <b>${shared}</b> lớp chia sẻ</div>
        <div class="st-meter">${LAYERS.map(([, m]) => `<i class="st-${m[cur]}"></i>`).join("")}</div>
        <div class="st-h">Hợp khi</div><div>${esc(o.fit)}</div>
        <div class="st-h">Chi phí</div><div class="muted">${esc(COST[cur])}</div>
        <div class="st-legend"><span class="st-y">Bạn</span><span class="st-s">Chia sẻ</span><span class="st-a">AWS</span></div>`;
      root.querySelector(".st-matrix").innerHTML = `<table><thead><tr><th>Lớp</th>${OPTS.map((x) => `<th class="${x.id === cur ? "st-cur" : ""}" data-o="${x.id}">${x.label}</th>`).join("")}</tr></thead>
        <tbody>${LAYERS.map(([name, m]) => `<tr><td>${esc(name)}</td>${OPTS.map((x) => `<td class="st-cell st-${m[x.id]} ${x.id === cur ? "st-cur" : ""}">${NAME[m[x.id]]}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    root.addEventListener("click", (e) => { const o = e.target.closest("[data-o]"); if (o) { cur = o.dataset.o; render(); } });
    render();
  }

  /* ───────────── Custom: trả lời câu hỏi → ECS hay EKS ───────────── */
  function mountDecide(root, sim) {
    // questions: [{ id, q, why, eks?, ecs? (điểm cộng), ec2?, lambda? (cờ) }]
    const Q = sim.questions;
    const ans = {};
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="dc-wrap"><div class="dc-qs"></div><div class="dc-out panel"></div></div>`;
    function render() {
      root.querySelector(".dc-qs").innerHTML = Q.map((x) => `<div class="dc-q"><span>${esc(x.q)}</span>
        <div class="dc-btns"><button class="chip ${ans[x.id] === true ? "on" : ""}" data-q="${x.id}" data-v="1">Có</button><button class="chip ${ans[x.id] === false ? "on" : ""}" data-q="${x.id}" data-v="0">Không</button></div></div>`).join("");
      const yes = Q.filter((x) => ans[x.id]);
      let eks = 0, ecs = 1; // nghiêng về ECS khi không có lý do rõ ràng
      yes.forEach((x) => { eks += x.eks || 0; ecs += x.ecs || 0; });
      const answered = Object.keys(ans).length;
      const pick = eks > ecs ? "EKS" : "ECS";
      const compute = yes.some((x) => x.ec2) ? "node EC2 (managed node group + Karpenter)" : pick === "EKS" ? "Auto Mode hoặc Fargate nếu không cần tuỳ biến node" : "Fargate";
      const lambda = yes.some((x) => x.lambda);
      root.querySelector(".dc-out").innerHTML = !answered
        ? `<div class="muted">Trả lời các câu bên trái để xem gợi ý.</div>`
        : `<div class="st-h">Gợi ý</div>
           <div class="dc-pick dc-${pick.toLowerCase()}">${pick}</div>
           <div class="dc-score"><span>ECS ${ecs}</span><div class="dc-bar"><i style="width:${(ecs / (ecs + eks)) * 100}%"></i></div><span>EKS ${eks}</span></div>
           <div class="st-h">Compute</div><div>${esc(compute)}</div>
           ${lambda ? `<div class="dc-warn">Cân nhắc <b>Lambda</b> trước: tải lẻ tẻ, chạy ngắn thì không cần container thường trực.</div>` : ""}
           <div class="st-h">Vì sao</div>
           <ul class="tips">${yes.length ? yes.map((x) => `<li>${esc(x.why)}</li>`).join("") : "<li>Không có nhu cầu đặc thù nào của Kubernetes → chọn phương án ít vận hành hơn.</li>"}</ul>`;
    }
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-q]");
      if (!b) return;
      const v = b.dataset.v === "1";
      if (ans[b.dataset.q] === v) delete ans[b.dataset.q]; else ans[b.dataset.q] = v;
      render();
    });
    render();
  }

  /* ───────────── Custom: kiến trúc × tình huống thay đổi ───────────── */
  function mountArch(root, sim) {
    const SC = { good: ["✓", "Hợp"], mid: ["~", "Được, có giá"], bad: ["✗", "Khó / không hợp"] };
    let oi = 0, si = -1;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="ar-h">1 · Chọn kiến trúc</div>
      <div class="sim-variants ar-opts">${sim.options.map((o, k) => `<button class="chip" data-o="${k}">${esc(o.label)}</button>`).join("")}</div>
      <div class="sim-stage"></div>
      <div class="ar-sum"></div>
      <div class="ar-h">2 · Chọn tình huống thay đổi</div>
      <div class="sim-variants ar-scs">${sim.scenarios.map((s, k) => `<button class="chip" data-s="${k}">${esc(s.label)}</button>`).join("")}</div>
      <div class="ar-verdict"></div>
      <div class="table-wrap ar-matrix"></div>`;
    const stage = root.querySelector(".sim-stage");
    function drawBlock(g, b, touched) {
      const cls = `ab ${touched ? "touch" : ""} ${b.ghost ? "ghost" : ""} ${b.kind || ""}`;
      if (b.shape === "ring") {
        el("circle", { cx: b.cx, cy: b.cy, r: b.r, class: cls }, g);
        const t = el("text", { x: b.cx, y: b.r > 50 ? b.cy - b.r + 20 : b.cy - 2, "text-anchor": "middle", class: "ab-t" }, g);
        t.textContent = b.label;
        if (b.sub) { const s = el("text", { x: b.cx, y: b.r > 50 ? b.cy - b.r + 35 : b.cy + 14, "text-anchor": "middle", class: "ab-s" }, g); s.textContent = b.sub; }
        return;
      }
      if (b.shape === "hex") {
        const pts = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k; return `${b.cx + b.r * Math.cos(a)},${b.cy + b.r * Math.sin(a) * 0.9}`; }).join(" ");
        el("polygon", { points: pts, class: cls }, g);
        const t = el("text", { x: b.cx, y: b.cy - 40, "text-anchor": "middle", class: "ab-t" }, g);
        t.textContent = b.label;
        if (b.sub) { const s = el("text", { x: b.cx, y: b.cy + 62, "text-anchor": "middle", class: "ab-s" }, g); s.textContent = b.sub; }
        return;
      }
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 9, class: cls }, g);
      const lines = b.sub ? 2 : 1;
      const t = el("text", { x: b.x + b.w / 2, y: b.y + (b.top ? 20 : b.h / 2 + (lines === 2 ? -3 : 5)), "text-anchor": "middle", class: "ab-t" }, g);
      t.textContent = b.label;
      if (b.sub) { const s = el("text", { x: b.x + b.w / 2, y: b.y + (b.top ? 36 : b.h / 2 + 14), "text-anchor": "middle", class: "ab-s" }, g); s.textContent = b.sub; }
    }
    function render() {
      const o = sim.options[oi], s = sim.scenarios[si], res = s ? s.res[o.id] : null;
      const touched = new Set(res ? res.touch : []);
      root.querySelectorAll("[data-o]").forEach((c) => setOn(c, +c.dataset.o === oi));
      root.querySelectorAll("[data-s]").forEach((c) => setOn(c, +c.dataset.s === si));
      stage.innerHTML = "";
      const svg = el("svg", { viewBox: `0 0 800 ${o.h || sim.h || 330}`, class: "sim-svg" }, stage);
      const uid = defs(svg);
      const gB = el("g", {}, svg), gA = el("g", {}, svg);
      o.blocks.forEach((b) => drawBlock(gB, b, touched.has(b.id)));
      (o.arrows || []).forEach(([x1, y1, x2, y2, lbl]) => {
        el("line", { x1, y1, x2, y2, class: "sm k-mute ar-dep", "marker-end": `url(#${uid}-mute)` }, gA);
        if (lbl) { const t = el("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, "text-anchor": "middle", class: "sm-l k-mute" }, gA); t.textContent = lbl; }
      });
      if (o.caption) { const t = el("text", { x: 790, y: (o.h || sim.h || 330) - 8, "text-anchor": "end", class: "ab-s" }, svg); t.textContent = o.caption; }
      root.querySelector(".ar-sum").innerHTML = `<div class="ar-sum-grid">
        <div><b>Ý tưởng</b>${inline(o.idea)}</div><div class="ar-pro"><b>Lợi</b>${inline(o.pro)}</div><div class="ar-con"><b>Bất lợi</b>${inline(o.con)}</div></div>`;
      root.querySelector(".ar-verdict").innerHTML = res
        ? `<div class="ar-v ar-${res.score}"><span class="ar-badge">${SC[res.score][0]} ${SC[res.score][1]}</span><b>${esc(o.label)}</b> — ${esc(s.label)}<div>${inline(res.text)}</div>
           ${touched.size ? `<div class="muted small">Phần đỏ trên sơ đồ là chỗ phải sửa hoặc bị ảnh hưởng.</div>` : `<div class="muted small">Không phần nào phải sửa — đây là câu hỏi “có đáng không”.</div>`}</div>`
        : `<div class="muted">Chọn một tình huống để xem kiến trúc này phải sửa những phần nào.</div>`;
      root.querySelector(".ar-matrix").innerHTML = `<table><thead><tr><th>Tình huống</th>${sim.options.map((x, k) => `<th class="${k === oi ? "st-cur" : ""}" data-o="${k}">${esc(x.label)}</th>`).join("")}</tr></thead>
        <tbody>${sim.scenarios.map((sc, r) => `<tr class="${r === si ? "ar-row" : ""}"><td data-s="${r}" class="ar-sc">${esc(sc.label)}</td>${sim.options.map((x, k) => { const v = sc.res[x.id]; return `<td class="ar-cell ar-${v.score} ${k === oi ? "st-cur" : ""}" data-o="${k}" data-s="${r}">${SC[v.score][0]}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
    }
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-o],[data-s]");
      if (!c) return;
      if (c.dataset.o !== undefined) oi = +c.dataset.o;
      if (c.dataset.s !== undefined) si = +c.dataset.s;
      render();
    });
    render();
  }

  /* ───────────── Custom: code walk (TDD, BDD, property-based) ───────────── */
  function mountCode(root, sim) {
    const PH = { red: "Red · test đỏ", green: "Green · test xanh", refactor: "Refactor · dọn code", spec: "Viết kịch bản", run: "Chạy test" };
    let vi = 0, i = 0;
    root.classList.add("sim");
    root.innerHTML = `
      <div class="sim-title">${esc(sim.title)}</div>
      <div class="sim-scn">${inline(sim.scenario)}</div>
      <div class="sim-variants">${sim.variants.map((v, k) => `<button class="chip" data-v="${k}">${esc(v.name)}</button>`).join("")}</div>
      <div class="cw-track"></div>
      <div class="cw-files"></div>
      <pre class="cw-run"></pre>
      <div class="sim-note" aria-live="polite"></div>
      <div class="sim-ctrl"><button class="btn" data-a="prev">◀ Bước trước</button><span class="sim-step"></span><button class="btn primary" data-a="next">Bước sau ▶</button></div>`;
    // File ở bước trước (cùng tên) để tô dòng mới thêm
    const prevFile = (name) => {
      for (let k = i - 1; k >= 0; k--) { const f = sim.variants[vi].steps[k].files.find((x) => x.name === name); if (f) return f; }
      return null;
    };
    function render() {
      const steps = sim.variants[vi].steps, st = steps[i];
      root.querySelectorAll("[data-v]").forEach((c) => setOn(c, +c.dataset.v === vi));
      root.querySelector(".cw-track").innerHTML = steps.map((x, k) => `<span class="cw-dot cw-${x.phase} ${k === i ? "on" : ""} ${k < i ? "past" : ""}" data-i="${k}" title="${esc(x.title)}">${k + 1}</span>`).join("");
      root.querySelector(".cw-files").innerHTML = st.files.map((f) => {
        const old = prevFile(f.name), oldLines = new Set(old ? old.code.split("\n") : []);
        const body = f.code.split("\n").map((l) => `<span class="${old && !oldLines.has(l) && l.trim() ? "cw-new" : ""}">${esc(l) || " "}</span>`).join("\n");
        return `<div class="cw-file cw-role-${f.role}"><div class="cw-name">${esc(f.name)}<span>${{ test: "test", impl: "code", spec: "kịch bản" }[f.role]}</span></div><pre>${body}</pre></div>`;
      }).join("");
      const run = root.querySelector(".cw-run");
      run.className = `cw-run ${st.run ? (st.run.ok ? "ok" : "fail") : "none"}`;
      run.textContent = st.run ? `$ ${st.run.cmd || "pytest"}\n${st.run.out}` : "— chưa chạy —";
      root.querySelector(".sim-note").innerHTML = `<span class="sim-n cw-${st.phase}">${PH[st.phase]}</span><b>${esc(st.title)}</b><div class="sim-detail"><b>Vì sao</b>${inline(st.note)}</div>`;
      root.querySelector(".sim-step").textContent = `${i + 1} / ${steps.length}`;
      root.querySelector('[data-a="prev"]').disabled = i === 0;
      root.querySelector('[data-a="next"]').disabled = i === steps.length - 1;
    }
    root.addEventListener("click", (e) => {
      const v = e.target.closest("[data-v]"); if (v) { vi = +v.dataset.v; i = 0; return render(); }
      const d = e.target.closest("[data-i]"); if (d) { i = +d.dataset.i; return render(); }
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "next" && i < sim.variants[vi].steps.length - 1) i++;
      if (a === "prev" && i > 0) i--;
      render();
    });
    render();
  }

  window.mountSim = function (root, sim) {
    if (sim.custom === "arch") return mountArch(root, sim);
    if (sim.custom === "code") return mountCode(root, sim);
    if (sim.custom === "stack") return mountStack(root, sim);
    if (sim.custom === "decide") return mountDecide(root, sim);
    if (sim.custom === "kgroup") return mountKafkaGroup(root, sim);
    if (sim.custom === "rplay") return mountRedisPlay(root, sim);
    if (sim.custom === "bucket") return mountBucket(root, sim);
    if (sim.custom === "ring") return mountRing(root, sim);
    if (sim.custom === "vending") return mountVending(root, sim);
    if (sim.custom === "binary") return mountBinary(root, sim);
    return mountFlow(root, sim);
  };
})();
