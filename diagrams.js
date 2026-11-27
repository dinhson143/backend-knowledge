/*
 * Mô phỏng tình huống chạy trực tiếp.
 *
 * Kịch bản dạng flow: nodes + steps. Mỗi step:
 *   note   — lời dẫn của bước
 *   msgs   — danh sách message chạy lần lượt; phần tử {par:[...]} chạy song song
 *            message = [from, to, label, kind]  kind: req (mặc định) | ok | err | warn
 *   set    — cập nhật dòng trạng thái dưới node (cộng dồn qua các bước)
 *   bad / good — tô đỏ / xanh node ở bước này
 *   cut / uncut — cắt / nối lại link giữa hai node
 *   lesson — bài học rút ra (hiện ở bước cuối)
 * Variant có thể khai báo `nodes` riêng.
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
      <div class="sim-note"></div>
      <ol class="sim-log"></ol>
      <div class="sim-ctrl">
        <button class="btn" data-a="reset" title="Về đầu">⟲</button>
        <button class="btn" data-a="prev" title="Bước trước">◀</button>
        <button class="btn primary" data-a="play">▶ Chạy</button>
        <button class="btn" data-a="next" title="Bước sau">▶|</button>
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
      root.querySelectorAll(".sim-variants .chip").forEach((c) => c.classList.toggle("on", +c.dataset.v === vi));
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
        <button class="btn" data-a="reset">⟲</button>
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
      <div class="sim-note"></div>
      <div class="sim-ctrl">${ACTIONS.map(([a, l]) => `<button class="btn" data-a="${a}">${l}</button>`).join("")}<button class="btn" data-a="reset">⟲</button></div>
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
      <div class="sim-note"></div>
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
      <div class="sim-note"></div>
      <div class="sim-ctrl"><button class="btn primary" data-a="one">Gửi 1 request</button><button class="btn" data-a="burst">Burst 8 request</button><button class="btn" data-a="reset">⟲</button></div>
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
      <div class="sim-note"></div>
      <div class="sim-ctrl">
        <button class="btn primary" data-a="auto"></button>
        <button class="btn" data-a="send">Gửi 1 message</button>
        <button class="btn" data-a="add">+ Consumer</button>
        <button class="btn" data-a="del">− Consumer (crash)</button>
        <button class="btn" data-a="reset">⟲</button>
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
      <div class="sim-note"></div>
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
      root.querySelectorAll("[data-t]").forEach((c) => c.classList.toggle("on", c.dataset.t === tab));
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
      root.querySelector(".rp-btns").innerHTML = BTN[tab].map(([l], i) => `<button class="btn" data-b="${i}">${esc(l)}</button>`).join("") + `<button class="btn" data-b="reset">⟲</button>`;
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
      root.querySelectorAll("[data-o]").forEach((c) => c.classList.toggle("on", c.dataset.o === cur));
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
      root.querySelectorAll("[data-o]").forEach((c) => c.classList.toggle("on", +c.dataset.o === oi));
      root.querySelectorAll("[data-s]").forEach((c) => c.classList.toggle("on", +c.dataset.s === si));
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
      <div class="sim-note"></div>
      <div class="sim-ctrl"><button class="btn" data-a="prev">◀ Bước trước</button><span class="sim-step"></span><button class="btn primary" data-a="next">Bước sau ▶</button></div>`;
    // File ở bước trước (cùng tên) để tô dòng mới thêm
    const prevFile = (name) => {
      for (let k = i - 1; k >= 0; k--) { const f = sim.variants[vi].steps[k].files.find((x) => x.name === name); if (f) return f; }
      return null;
    };
    function render() {
      const steps = sim.variants[vi].steps, st = steps[i];
      root.querySelectorAll("[data-v]").forEach((c) => c.classList.toggle("on", +c.dataset.v === vi));
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

/* ════════════════════════ KỊCH BẢN ════════════════════════ */
window.SIMS = [
  {
    id: "cache-aside", title: "Cache-aside: miss → hit → invalidate", topics: ["caching", "dist-cache"],
    scenario: "User mở trang profile nhiều lần rồi đổi tên. Theo dõi lúc nào request chạm DB.",
    nodes: [
      { id: "client", x: 90, y: 150, label: "Client" },
      { id: "app", x: 310, y: 150, label: "App Server" },
      { id: "cache", x: 580, y: 65, label: "Redis Cache", s: "trống" },
      { id: "db", x: 580, y: 225, label: "PostgreSQL", s: "users: 1M rows" },
    ],
    steps: [
      { note: "User mở profile `GET /users/42`. App luôn hỏi cache trước.", msgs: [["client", "app", "GET /users/42"], ["app", "cache", "GET user:42"]] },
      { note: "Cache chưa có key → **MISS**. App tự đọc DB.", msgs: [["cache", "app", "MISS", "err"], ["app", "db", "SELECT … id=42"]], bad: ["cache"] },
      { note: "DB trả row. App ghi vào cache kèm **TTL** để lần sau khỏi chạm DB.", msgs: [["db", "app", "row 42", "ok"], ["app", "cache", "SET user:42 EX 300", "ok"]], set: { cache: "user:42 ✓ TTL 300s" } },
      { note: "Trả về client: request đầu mất ~25ms vì tốn một round-trip DB.", msgs: [["app", "client", "200 · 25ms", "ok"]] },
      { note: "Request thứ hai trong TTL: cache **HIT**, DB không bị chạm.", msgs: [["client", "app", "GET /users/42"], ["app", "cache", "GET user:42"], ["cache", "app", "HIT", "ok"], ["app", "client", "200 · 2ms", "ok"]], good: ["cache"] },
      { note: "User đổi tên: app **UPDATE DB rồi DEL key**. Lần đọc tới miss và nạp bản mới.", msgs: [["client", "app", "PATCH name"], ["app", "db", "UPDATE users"], ["app", "cache", "DEL user:42", "warn"]], set: { cache: "trống", db: "name mới ✓" },
        lesson: "Cache-aside: đọc cache → miss thì đọc DB → ghi cache với TTL. Ghi DB xong thì xoá cache (không ghi đè) để thu hẹp race; TTL là chốt chặn cuối cho dữ liệu cũ." },
    ],
  },
  {
    id: "cache-write", title: "3 chiến lược ghi cache", topics: ["caching", "dist-cache"],
    scenario: "Admin đổi giá sản phẩm từ 80 thành 99. So sánh latency và rủi ro của từng chiến lược.",
    nodes: [
      { id: "client", x: 90, y: 150, label: "Admin" },
      { id: "app", x: 300, y: 150, label: "App Server" },
      { id: "cache", x: 570, y: 65, label: "Cache", s: "price=80" },
      { id: "db", x: 570, y: 225, label: "Database", s: "price=80" },
    ],
    variants: [
      { name: "Write-Through", steps: [
        { note: "Admin gửi giá mới.", msgs: [["client", "app", "PUT price=99"]] },
        { note: "App ghi vào cache, cache ghi **đồng bộ** xuống DB.", msgs: [["app", "cache", "SET price=99"], ["cache", "db", "write price=99"]], set: { cache: "price=99", db: "price=99" } },
        { note: "Nhất quán vì chỉ trả lời khi DB đã xác nhận; đổi lại ghi chậm hơn.", msgs: [["db", "cache", "ack", "ok"], ["cache", "app", "ack", "ok"], ["app", "client", "200 · 30ms", "ok"]], good: ["cache", "db"],
          lesson: "Write-Through: cache luôn khớp DB; latency ghi = cache + DB." },
      ] },
      { name: "Write-Around", steps: [
        { note: "Admin gửi giá mới.", msgs: [["client", "app", "PUT price=99"]] },
        { note: "Ghi thẳng DB, bỏ qua cache.", msgs: [["app", "db", "UPDATE price=99"]], set: { db: "price=99" } },
        { note: "Cache còn giá cũ → phải **DEL** key (hoặc chờ TTL ngắn hết hạn).", msgs: [["app", "cache", "DEL price", "warn"]], set: { cache: "(trống)" } },
        { note: "Lần đọc tới MISS và nạp giá 99 từ DB.", msgs: [["client", "app", "GET price"], ["app", "cache", "GET"], ["cache", "app", "MISS", "err"], ["app", "db", "SELECT"], ["db", "app", "99", "ok"], ["app", "cache", "SET 99", "ok"]], set: { cache: "price=99" },
          lesson: "Write-Around hợp dữ liệu ghi nhiều đọc ít; trả giá bằng miss lần đầu." },
      ] },
      { name: "Write-Back", steps: [
        { note: "Admin gửi giá mới.", msgs: [["client", "app", "PUT price=99"]] },
        { note: "Ghi vào cache rồi trả lời **ngay**.", msgs: [["app", "cache", "SET price=99"], ["cache", "app", "ok", "ok"], ["app", "client", "200 · 2ms", "ok"]], set: { cache: "price=99 (dirty)" } },
        { note: "DB vẫn giữ giá cũ, chờ tiến trình nền flush sau vài giây.", set: { db: "price=80 (cũ)" } },
        { note: "Cache node sập **trước khi flush** → giá 99 mất vĩnh viễn.", msgs: [["cache", "db", "flush ✗", "err"]], set: { cache: "💥 crash" }, bad: ["cache", "db"],
          lesson: "Write-Back nhanh nhất nhưng có cửa sổ mất dữ liệu — chỉ dùng cho dữ liệu chịu mất được (counter, metrics) hoặc cache có persistence." },
      ] },
    ],
  },
  {
    id: "stampede", title: "Cache stampede và single flight", topics: ["caching"],
    scenario: "Key `feed:hot` đang phục vụ 50k req/s thì hết TTL. DB sẽ ra sao?",
    nodes: [
      { id: "clients", x: 90, y: 150, label: "1,000 clients" },
      { id: "app", x: 320, y: 150, label: "App Servers" },
      { id: "cache", x: 590, y: 65, label: "Cache", s: "feed:hot ✓" },
      { id: "db", x: 590, y: 225, label: "Database", s: "CPU 20%" },
    ],
    variants: [
      { name: "Không bảo vệ", steps: [
        { note: "Bình thường: mọi request đọc từ cache.", msgs: [["clients", "app", "GET /feed"], ["app", "cache", "GET feed:hot"], ["cache", "app", "HIT", "ok"]] },
        { note: "TTL hết hạn đúng giờ cao điểm.", set: { cache: "feed:hot ✗ expired" }, bad: ["cache"] },
        { note: "1,000 request cùng MISS một lúc.", msgs: [["clients", "app", "GET ×1000"], ["app", "cache", "GET ×1000"], ["cache", "app", "MISS ×1000", "err"]] },
        { note: "Tất cả cùng query DB để rebuild → **thundering herd**.", msgs: [{ par: [["app", "db", "SELECT", "err"], ["app", "db", "SELECT", "err"], ["app", "db", "SELECT ×1000", "err"]] }], set: { db: "CPU 100% 🔥" }, bad: ["db"],
          lesson: "Một key nóng hết hạn có thể đánh sập DB." },
      ] },
      { name: "Single flight + jitter", steps: [
        { note: "Bình thường: mọi request đọc từ cache.", msgs: [["clients", "app", "GET /feed"], ["app", "cache", "GET feed:hot"], ["cache", "app", "HIT", "ok"]] },
        { note: "TTL hết hạn đúng giờ cao điểm.", set: { cache: "feed:hot ✗ expired" }, bad: ["cache"] },
        { note: "**Single flight**: 1,000 request MISS nhưng chỉ 1 request (leader) rebuild; 999 request còn lại chờ kết quả.", msgs: [["clients", "app", "GET ×1000"], ["cache", "app", "MISS", "err"]], set: { app: "1 leader · 999 chờ" } },
        { note: "Chỉ **1 query** xuống DB.", msgs: [["app", "db", "SELECT (×1)"], ["db", "app", "rows", "ok"]], set: { db: "CPU 22% ✓" }, good: ["db"] },
        { note: "Leader ghi lại cache với TTL có **jitter** rồi trả kết quả cho cả 1,000 request.", msgs: [["app", "cache", "SET EX 60±10s", "ok"], ["app", "clients", "200 ×1000", "ok"]], set: { cache: "feed:hot ✓", app: "đã trả 1000" },
          lesson: "Cách chống stampede chuẩn: request coalescing + TTL jitter." },
      ] },
    ],
  },
  {
    id: "hash-ring", custom: "ring", title: "Hash ring tương tác", topics: ["consistent-hashing", "sharding"],
    scenario: "Thêm hoặc xoá server, bật virtual nodes, rồi so số key phải di chuyển với cách `hash % N`.",
  },
  {
    id: "cap", title: "Network partition: chọn CP hay AP", topics: ["cap"],
    scenario: "Kho còn **1** sản phẩm, dữ liệu nằm ở 2 node. Đường mạng giữa hai node bị đứt.",
    nodes: [
      { id: "u1", x: 90, y: 65, label: "User Hà Nội" },
      { id: "A", x: 420, y: 65, label: "Node A", s: "stock=1" },
      { id: "B", x: 420, y: 225, label: "Node B", s: "stock=1" },
      { id: "u2", x: 90, y: 225, label: "User HCM" },
    ],
    links: [["A", "B"]],
    variants: [
      { name: "CP — ưu tiên đúng", steps: [
        { note: "A và B đồng bộ với nhau.", msgs: [{ par: [["A", "B", "sync", "ok"], ["B", "A", "sync", "ok"]] }] },
        { note: "**Network partition**: hai node không liên lạc được.", cut: [["A", "B"]], msgs: [["A", "B", "✗", "err"]] },
        { note: "User Hà Nội mua sản phẩm cuối trên A.", msgs: [["u1", "A", "BUY"], ["A", "u1", "OK", "ok"]], set: { A: "stock=0" } },
        { note: "B không nhận được cập nhật.", set: { B: "stock=1 (chưa biết)" }, msgs: [["A", "B", "replicate ✗", "err"]] },
        { note: "User HCM gọi B. Hệ **CP**: B từ chối vì không chắc mình có dữ liệu mới nhất.", msgs: [["u2", "B", "BUY"], ["B", "u2", "503 Unavailable", "err"]], bad: ["B"],
          lesson: "CP: đúng dữ liệu, hy sinh availability. Chọn cho tồn kho, thanh toán, đặt vé." },
      ] },
      { name: "AP — ưu tiên sẵn sàng", steps: [
        { note: "A và B đồng bộ với nhau.", msgs: [{ par: [["A", "B", "sync", "ok"], ["B", "A", "sync", "ok"]] }] },
        { note: "**Network partition**: hai node không liên lạc được.", cut: [["A", "B"]], msgs: [["A", "B", "✗", "err"]] },
        { note: "User Hà Nội mua sản phẩm cuối trên A.", msgs: [["u1", "A", "BUY"], ["A", "u1", "OK", "ok"]], set: { A: "stock=0" } },
        { note: "B không nhận được cập nhật.", set: { B: "stock=1 (chưa biết)" }, msgs: [["A", "B", "replicate ✗", "err"]] },
        { note: "Hệ **AP**: B vẫn trả lời bằng dữ liệu cũ → User HCM mua được sản phẩm không còn (oversell).", msgs: [["u2", "B", "BUY"], ["B", "u2", "OK (stale)", "warn"]], set: { B: "stock=0 (bán thêm 1)" }, bad: ["B"] },
        { note: "Mạng nối lại, hai node **reconcile** và phát hiện bán 2 khi chỉ có 1 → phải huỷ đơn hoặc bù trừ.", uncut: [["A", "B"]], msgs: [["A", "B", "sync", "ok"], ["B", "A", "conflict!", "err"]],
          lesson: "AP: luôn trả lời, chấp nhận stale. Chọn cho feed, like, profile." },
      ] },
    ],
  },
  {
    id: "replica-lag", title: "Read replica và replication lag", topics: ["patterns", "cap"],
    scenario: "User đổi tên rồi reload trang ngay. Lần đọc rơi vào replica đang trễ 2 giây.",
    nodes: [
      { id: "user", x: 90, y: 150, label: "User" },
      { id: "app", x: 310, y: 150, label: "App" },
      { id: "primary", x: 590, y: 65, label: "Primary DB", s: "name=Old" },
      { id: "replica", x: 590, y: 225, label: "Read Replica", s: "name=Old" },
    ],
    links: [["primary", "replica"]],
    variants: [
      { name: "Luôn đọc replica", steps: [
        { note: "User đổi tên thành **Son**. App ghi vào primary.", msgs: [["user", "app", "PATCH name=Son"], ["app", "primary", "UPDATE"], ["primary", "app", "ok", "ok"], ["app", "user", "200", "ok"]], set: { primary: "name=Son" } },
        { note: "Replication **bất đồng bộ**, đang trễ ~2s.", set: { replica: "name=Old (đang trễ)" }, msgs: [["primary", "replica", "replicate… lag 2s", "warn"]] },
        { note: "Reload ngay: đọc vào replica → user thấy **tên cũ**, tưởng lưu lỗi.", msgs: [["user", "app", "GET profile"], ["app", "replica", "SELECT"], ["replica", "app", "name=Old", "err"], ["app", "user", "Old ❌", "err"]], bad: ["replica"],
          lesson: "Read replica giảm tải đọc nhưng sinh replication lag." },
      ] },
      { name: "Read-your-own-writes", steps: [
        { note: "User đổi tên thành **Son**. App ghi vào primary.", msgs: [["user", "app", "PATCH name=Son"], ["app", "primary", "UPDATE"], ["primary", "app", "ok", "ok"], ["app", "user", "200", "ok"]], set: { primary: "name=Son" } },
        { note: "App ghi nhớ `last_write_at` của user (session/cookie).", set: { app: "user vừa ghi < 5s", replica: "name=Old (đang trễ)" }, msgs: [["primary", "replica", "replicate… lag 2s", "warn"]] },
        { note: "Trong 5s sau khi ghi, app route đọc của **chính user đó** về primary.", msgs: [["user", "app", "GET profile"], ["app", "primary", "SELECT"], ["primary", "app", "name=Son", "ok"], ["app", "user", "Son ✓", "ok"]], good: ["primary"] },
        { note: "Người khác vẫn đọc replica — chấp nhận eventual consistency.", set: { replica: "name=Son ✓" }, msgs: [["app", "replica", "SELECT (user khác)"]],
          lesson: "Read-your-own-writes: route đọc của người vừa ghi về primary trong một khoảng ngắn." },
      ] },
    ],
  },
  {
    id: "isolation", title: "Isolation levels: dirty read, non-repeatable read và snapshot", topics: ["core-db"],
    scenario: "Hai transaction cùng đụng vào số dư tài khoản 100.",
    nodes: [
      { id: "T1", x: 120, y: 65, label: "Transaction T1" },
      { id: "db", x: 470, y: 145, label: "Database", s: "balance=100" },
      { id: "T2", x: 120, y: 225, label: "Transaction T2" },
    ],
    variants: [
      { name: "Read Uncommitted", steps: [
        { note: "T2 trừ hết tiền nhưng **chưa COMMIT**.", msgs: [["T2", "db", "UPDATE balance=0"]], set: { db: "balance=0 (chưa commit)" } },
        { note: "T1 đọc được giá trị chưa commit.", msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "0", "warn"]], set: { T1: "thấy 0" } },
        { note: "T2 lỗi và **ROLLBACK**.", msgs: [["T2", "db", "ROLLBACK", "err"]], set: { db: "balance=100" } },
        { note: "T1 đã ra quyết định dựa trên số 0 **chưa từng tồn tại**.", bad: ["T1"], lesson: "Dirty read — chỉ Read Uncommitted cho phép." },
      ] },
      { name: "Read Committed", steps: [
        { note: "T1 đọc số dư lần 1.", msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100", "ok"]], set: { T1: "lần 1: 100" } },
        { note: "T2 trừ 50 và COMMIT.", msgs: [["T2", "db", "UPDATE −50; COMMIT"]], set: { db: "balance=50" } },
        { note: "T1 đọc lại trong **cùng transaction** → ra số khác.", msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "50", "warn"]], set: { T1: "lần 1: 100 · lần 2: 50" }, bad: ["T1"],
          lesson: "Non-repeatable read — Read Committed (mặc định PostgreSQL) vẫn cho phép." },
      ] },
      { name: "Repeatable Read", steps: [
        { note: "T1 đọc số dư lần 1 và giữ **snapshot**.", msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100", "ok"]], set: { T1: "lần 1: 100" } },
        { note: "T2 trừ 50 và COMMIT.", msgs: [["T2", "db", "UPDATE −50; COMMIT"]], set: { db: "balance=50 (bản mới)" } },
        { note: "T1 đọc lại từ snapshot → vẫn 100, nhất quán trong transaction.", msgs: [["T1", "db", "SELECT balance"], ["db", "T1", "100 (snapshot)", "ok"]], set: { T1: "lần 1: 100 · lần 2: 100" }, good: ["T1"],
          lesson: "Repeatable Read (mặc định MySQL) chặn non-repeatable read nhờ MVCC snapshot." },
      ] },
    ],
  },
  {
    id: "n-plus-one", title: "GraphQL N+1 và DataLoader", topics: ["api-design"],
    scenario: "Client lấy 100 event, mỗi event kèm venue.", h: 260,
    nodes: [
      { id: "client", x: 90, y: 120, label: "Client" },
      { id: "gql", x: 350, y: 120, label: "GraphQL Server" },
      { id: "db", x: 640, y: 120, label: "Database", s: "0 query" },
    ],
    variants: [
      { name: "N+1", steps: [
        { note: "Client gửi query lồng nhau.", msgs: [["client", "gql", "events { venue { name } }"]] },
        { note: "Resolver `events` chạy **1 query**.", msgs: [["gql", "db", "SELECT * FROM events"], ["db", "gql", "100 rows", "ok"]], set: { db: "1 query" } },
        { note: "Resolver `venue` chạy **riêng cho từng event** → thêm 100 query.", msgs: [{ par: [["gql", "db", "venue id=1", "warn"], ["gql", "db", "venue id=2", "warn"], ["gql", "db", "… id=100", "warn"]] }], set: { db: "101 query 🔥" }, bad: ["db"],
          lesson: "N+1: 1 query cha + N query con." },
      ] },
      { name: "DataLoader", steps: [
        { note: "Client gửi query lồng nhau.", msgs: [["client", "gql", "events { venue { name } }"]] },
        { note: "Resolver `events` chạy **1 query**.", msgs: [["gql", "db", "SELECT * FROM events"], ["db", "gql", "100 rows", "ok"]], set: { db: "1 query" } },
        { note: "DataLoader **gom** 100 lời gọi `load(venueId)` trong cùng một tick.", set: { gql: "batch: [1..100]" } },
        { note: "Chỉ còn 1 query `IN (...)`.", msgs: [["gql", "db", "WHERE id IN (1..100)"], ["db", "gql", "100 venues", "ok"], ["gql", "client", "data", "ok"]], set: { db: "2 query ✓" }, good: ["db"],
          lesson: "DataLoader = batching + cache theo request." },
      ] },
    ],
  },
  {
    id: "lb", title: "Load balancer L7 và L4", topics: ["networking", "lb-gateway-cdn"],
    scenario: "Request `GET /images/cat.png` cần tới Image service, không phải API service.",
    nodes: [
      { id: "client", x: 90, y: 150, label: "Client" },
      { id: "lb", x: 340, y: 150, label: "Load Balancer" },
      { id: "api", x: 620, y: 65, label: "API service", s: "/api/*" },
      { id: "img", x: 620, y: 225, label: "Image service", s: "/images/*" },
    ],
    variants: [
      { name: "ALB (Layer 7)", steps: [
        { note: "Request tới ALB.", msgs: [["client", "lb", "GET /images/cat.png"]] },
        { note: "ALB **giải mã TLS và đọc HTTP**: thấy path `/images`.", set: { lb: "ALB · đọc path, header" } },
        { note: "Định tuyến đúng service theo path.", msgs: [["lb", "img", "GET /images/cat.png", "ok"], ["img", "lb", "200", "ok"], ["lb", "client", "200 image", "ok"]], good: ["img"],
          lesson: "L7 route theo URL, header, cookie — hợp microservice; tốn CPU hơn." },
      ] },
      { name: "NLB (Layer 4)", steps: [
        { note: "Cùng request nhưng đi qua NLB.", msgs: [["client", "lb", "TCP SYN :443"]] },
        { note: "NLB chỉ thấy **IP + port**, payload vẫn mã hoá → không biết path.", set: { lb: "NLB · chỉ thấy IP:443" } },
        { note: "Chọn backend theo hash/round-robin → có thể rơi vào service không phục vụ path này.", msgs: [["lb", "api", "TCP stream", "warn"], ["api", "lb", "404", "err"]], bad: ["api"],
          lesson: "L4 cực nhanh, hợp TCP/UDP thô hoặc đứng trước L7; không route theo nội dung." },
      ] },
    ],
  },
  {
    id: "inverted-index", title: "Xây inverted index", topics: ["search"],
    scenario: "Hai document qua tokenizer và stemmer để thành index tra cứu được.",
    nodes: [
      { id: "d1", x: 90, y: 65, label: "doc1", s: "\"Running fast\"" },
      { id: "d2", x: 90, y: 225, label: "doc2", s: "\"He runs daily\"" },
      { id: "tok", x: 300, y: 145, label: "Tokenizer" },
      { id: "stem", x: 490, y: 145, label: "Stemmer" },
      { id: "idx", x: 690, y: 145, label: "Inverted Index", w: 150, s: "(trống)" },
    ],
    steps: [
      { note: "**Tokenize**: tách câu thành từ, chuyển chữ thường.", msgs: [{ par: [["d1", "tok", "Running fast"], ["d2", "tok", "He runs daily"]] }], set: { tok: "running · fast · he · runs · daily" } },
      { note: "**Stem**: đưa về gốc — running, runs → `run`; bỏ stop word `he`.", msgs: [["tok", "stem", "tokens"]], set: { stem: "run · fast · run · daily" } },
      { note: "Ghi vào index: từ → danh sách document.", msgs: [["stem", "idx", "postings", "ok"]], set: { idx: "run → [doc1, doc2]\nfast → [doc1]\ndaily → [doc2]" } },
      { note: "Search `running` → stem thành `run` → tra index một lần → doc1, doc2, không quét toàn bộ.", msgs: [["stem", "idx", "lookup run"], ["idx", "stem", "[doc1, doc2]", "ok"]], good: ["idx"],
        lesson: "Inverted index biến full-text search thành phép tra hash map." },
    ],
  },
  {
    id: "presigned", title: "Upload file lớn qua presigned URL", topics: ["blob", "patterns"],
    scenario: "User upload video 2GB. Backend không được chạm vào byte của file.",
    nodes: [
      { id: "client", x: 90, y: 150, label: "Client" },
      { id: "api", x: 350, y: 65, label: "API" },
      { id: "s3", x: 640, y: 150, label: "S3 Bucket" },
      { id: "db", x: 350, y: 235, label: "Metadata DB" },
    ],
    steps: [
      { note: "Client chỉ gửi **metadata**, không gửi file.", msgs: [["client", "api", "POST /uploads {2GB}"]] },
      { note: "API ký **presigned URL** (multipart, hết hạn 15 phút) và lưu bản ghi PENDING.", msgs: [["api", "db", "INSERT PENDING"], ["api", "client", "presigned URLs ×3", "ok"]], set: { db: "video#9 PENDING" } },
      { note: "Client upload **song song** từng chunk thẳng lên S3.", msgs: [{ par: [["client", "s3", "part 1"], ["client", "s3", "part 2"], ["client", "s3", "part 3"]] }], set: { s3: "2/3 parts" } },
      { note: "Một chunk lỗi thì chỉ upload lại chunk đó.", msgs: [["s3", "client", "part 2 ✗ timeout", "err"], ["client", "s3", "retry part 2", "warn"]], set: { s3: "3/3 parts" } },
      { note: "S3 phát event khi hoàn tất → API cập nhật metadata.", msgs: [["client", "s3", "CompleteMultipart"], ["s3", "api", "ObjectCreated", "ok"], ["api", "db", "status=READY", "ok"]], set: { db: "video#9 READY ✓", s3: "video9.mp4 ✓" }, good: ["s3"],
        lesson: "Presigned URL + multipart: file đi thẳng giữa client và S3, DB chỉ giữ metadata." },
    ],
  },
  {
    id: "queue", title: "Queue: retry, DLQ và backpressure", topics: ["queue"],
    scenario: "Order đi qua queue tới consumer. Xem chuyện gì xảy ra khi message lỗi và khi traffic đột biến.",
    nodes: [
      { id: "producer", x: 90, y: 150, label: "Producer" },
      { id: "queue", x: 330, y: 150, label: "Queue", s: "depth 0" },
      { id: "consumer", x: 600, y: 65, label: "Consumer" },
      { id: "dlq", x: 600, y: 225, label: "Dead Letter Queue", w: 150, s: "0 msg" },
    ],
    variants: [
      { name: "Retry → DLQ", steps: [
        { note: "Producer đẩy `order#7` vào queue rồi trả lời user ngay.", msgs: [["producer", "queue", "order#7"]], set: { queue: "depth 1" } },
        { note: "Consumer xử lý và gặp lỗi (dữ liệu hỏng).", msgs: [["queue", "consumer", "order#7"], ["consumer", "queue", "NACK", "err"]], bad: ["consumer"] },
        { note: "Retry với **exponential backoff**: 1s → 2s → 4s.", msgs: [["queue", "consumer", "retry 1 · 1s", "warn"], ["consumer", "queue", "NACK", "err"], ["queue", "consumer", "retry 2 · 2s", "warn"], ["consumer", "queue", "NACK", "err"], ["queue", "consumer", "retry 3 · 4s", "warn"], ["consumer", "queue", "NACK", "err"]] },
        { note: "Quá `maxReceiveCount=3` → chuyển sang **DLQ**, không chặn message sau.", msgs: [["queue", "dlq", "order#7 (poison)", "err"]], set: { dlq: "1 msg · cần điều tra", queue: "depth 0" } },
        { note: "Message tiếp theo xử lý bình thường.", msgs: [["producer", "queue", "order#8"], ["queue", "consumer", "order#8"], ["consumer", "queue", "ACK", "ok"]], good: ["consumer"],
          lesson: "Retry + backoff cho lỗi tạm thời; DLQ cô lập poison message. Consumer phải idempotent vì giao hàng at-least-once." },
      ] },
      { name: "Backpressure", steps: [
        { note: "Flash sale: producer bắn 50k msg/s, consumer chỉ xử lý 5k msg/s.", msgs: [{ par: [["producer", "queue", "burst"], ["producer", "queue", "burst"], ["producer", "queue", "burst"]] }], set: { queue: "depth 450k ⚠", consumer: "5k msg/s" }, bad: ["queue"] },
        { note: "Queue làm **buffer**: user không bị lỗi, chỉ xử lý trễ.", msgs: [["queue", "consumer", "5k/s"]] },
        { note: "Theo dõi queue depth → **autoscale** consumer.", msgs: [{ par: [["queue", "consumer", "batch", "ok"], ["queue", "consumer", "batch", "ok"]] }], set: { consumer: "×10 instance · 50k msg/s" }, good: ["consumer"] },
        { note: "Nếu vẫn vượt ngưỡng: giới hạn queue và trả **429** để producer chậm lại.", msgs: [["queue", "producer", "429 slow down", "warn"]], set: { queue: "depth 20k ✓" },
          lesson: "Queue hấp thụ burst; backpressure + autoscale giữ hệ thống không sụp." },
      ] },
    ],
  },
  {
    id: "redlock", title: "Distributed lock: GC pause và fencing token", topics: ["dist-lock", "concurrency"],
    scenario: "Hai server dùng Redis lock để ghi vào cùng storage. Server A bị GC pause dài hơn TTL của lock.",
    nodes: [
      { id: "A", x: 100, y: 65, label: "Server A" },
      { id: "B", x: 100, y: 225, label: "Server B" },
      { id: "redis", x: 370, y: 180, label: "Redis Lock" },
      { id: "db", x: 680, y: 145, label: "Storage", s: "x=0 · max token=0" },
    ],
    variants: [
      { name: "Chỉ dùng lock có TTL", steps: [
        { note: "A lấy lock với TTL 10s.", msgs: [["A", "redis", "SET lock NX PX 10000"], ["redis", "A", "OK", "ok"]], set: { A: "giữ lock", redis: "owner=A · TTL 10s" } },
        { note: "A bị **GC pause 11s** ngay trong critical section.", set: { A: "⏸ GC pause 11s" }, bad: ["A"] },
        { note: "Lock hết TTL. B lấy lock hợp lệ và ghi.", msgs: [["B", "redis", "SET lock NX"], ["redis", "B", "OK", "ok"], ["B", "db", "write x=2", "ok"]], set: { redis: "owner=B", B: "giữ lock", db: "x=2" } },
        { note: "A tỉnh dậy, **không biết** đã mất lock và vẫn ghi.", msgs: [["A", "db", "write x=1", "err"]], set: { db: "x=1 ❌ ghi đè B", A: "tưởng còn lock" }, bad: ["db"],
          lesson: "Lock có TTL không chống được process pause → hỏng dữ liệu." },
      ] },
      { name: "Có fencing token", steps: [
        { note: "A lấy lock và nhận **token 33**.", msgs: [["A", "redis", "acquire"], ["redis", "A", "OK token=33", "ok"]], set: { A: "lock · token 33", redis: "owner=A · token 33" } },
        { note: "A bị **GC pause 11s**.", set: { A: "⏸ GC pause 11s" }, bad: ["A"] },
        { note: "Lock hết TTL. B lấy lock, nhận **token 34**, ghi kèm token.", msgs: [["B", "redis", "acquire"], ["redis", "B", "OK token=34", "ok"], ["B", "db", "write x=2 · t34", "ok"]], set: { redis: "owner=B · token 34", B: "lock · token 34", db: "x=2 · max token=34" } },
        { note: "A ghi với token 33. Storage thấy 33 < 34 → **từ chối**.", msgs: [["A", "db", "write x=1 · t33", "warn"], ["db", "A", "REJECT 33 < 34", "err"]], set: { db: "x=2 ✓ · max token=34" }, good: ["db"],
          lesson: "Fencing token: storage tự bảo vệ — chỉ nhận token tăng dần." },
      ] },
    ],
  },
  {
    id: "seat", title: "Hai người tranh ghế cuối cùng", topics: ["patterns"],
    scenario: "Alice và Bob cùng bấm đặt ghế A1 trong cùng một mili-giây.",
    nodes: [
      { id: "alice", x: 90, y: 65, label: "Alice" },
      { id: "bob", x: 90, y: 225, label: "Bob" },
      { id: "api", x: 350, y: 145, label: "Booking API" },
      { id: "db", x: 640, y: 145, label: "DB", s: "A1: free · v=1" },
    ],
    variants: [
      { name: "Optimistic lock", steps: [
        { note: "Hai request tới cùng lúc.", msgs: [{ par: [["alice", "api", "book A1"], ["bob", "api", "book A1"]] }] },
        { note: "Cả hai đọc thấy ghế trống, `v=1`. Không ai bị khoá.", msgs: [{ par: [["api", "db", "SELECT (Alice)"], ["api", "db", "SELECT (Bob)"]] }, { par: [["db", "api", "free · v=1", "ok"], ["db", "api", "free · v=1", "ok"]] }] },
        { note: "Alice ghi trước: `UPDATE … SET v=2 WHERE v=1` → 1 row.", msgs: [["api", "db", "UPDATE WHERE v=1 (Alice)"], ["db", "api", "1 row ✓", "ok"]], set: { db: "A1: Alice · v=2" } },
        { note: "Bob ghi `WHERE v=1` → **0 row** vì version đã là 2.", msgs: [["api", "db", "UPDATE WHERE v=1 (Bob)"], ["db", "api", "0 rows", "err"]] },
        { note: "Bob nhận 409, client báo “ghế đã có người đặt”.", msgs: [{ par: [["api", "alice", "200 Booked", "ok"], ["api", "bob", "409 Conflict", "err"]] }], set: { alice: "✓ có ghế", bob: "409" },
          lesson: "Optimistic: không khoá, kiểm tra version khi ghi. Hợp khi xung đột hiếm." },
      ] },
      { name: "Pessimistic lock", steps: [
        { note: "Hai request tới cùng lúc.", msgs: [{ par: [["alice", "api", "book A1"], ["bob", "api", "book A1"]] }] },
        { note: "Alice tới trước: `SELECT … FOR UPDATE` **khoá dòng** A1.", msgs: [["api", "db", "FOR UPDATE (Alice)"], ["db", "api", "free 🔒", "ok"]], set: { db: "A1: free · 🔒 Alice" } },
        { note: "Bob cũng `FOR UPDATE` → bị **block**, phải chờ.", msgs: [["api", "db", "FOR UPDATE (Bob)", "warn"]], set: { bob: "⏳ chờ lock" } },
        { note: "Alice UPDATE và COMMIT → nhả lock.", msgs: [["api", "db", "UPDATE; COMMIT"], ["api", "alice", "200 Booked", "ok"]], set: { db: "A1: Alice", alice: "✓ có ghế" } },
        { note: "Bob chạy tiếp, thấy ghế đã bán.", msgs: [["db", "api", "sold (Bob)", "err"], ["api", "bob", "409 Conflict", "err"]], set: { bob: "409" },
          lesson: "Pessimistic: đúng tuyệt đối nhưng request phải xếp hàng — dễ nghẽn khi tranh chấp cao." },
      ] },
    ],
  },
  {
    id: "saga", title: "Saga: rollback khi bước 3 thất bại", topics: ["patterns"],
    scenario: "Đặt hàng qua 3 service: tạo order → trừ tiền → giữ hàng. Kho đã hết.",
    nodes: [
      { id: "orch", x: 400, y: 60, label: "Saga Orchestrator", w: 170 },
      { id: "order", x: 130, y: 225, label: "Order Svc" },
      { id: "pay", x: 400, y: 225, label: "Payment Svc" },
      { id: "inv", x: 670, y: 225, label: "Inventory Svc", s: "stock=0" },
    ],
    variants: [
      { name: "Orchestration", steps: [
        { note: "Orchestrator tạo order **PENDING**.", msgs: [["orch", "order", "create order"], ["order", "orch", "PENDING", "ok"]], set: { order: "order#1 PENDING" } },
        { note: "Bước 2: trừ tiền.", msgs: [["orch", "pay", "charge $50"], ["pay", "orch", "charged", "ok"]], set: { pay: "charged $50" } },
        { note: "Bước 3: giữ hàng — **hết hàng**.", msgs: [["orch", "inv", "reserve"], ["inv", "orch", "OUT_OF_STOCK", "err"]], bad: ["inv"] },
        { note: "Không có rollback phân tán → chạy **compensating action** theo thứ tự ngược: hoàn tiền.", msgs: [["orch", "pay", "refund $50", "warn"], ["pay", "orch", "refunded", "ok"]], set: { pay: "refunded $50" } },
        { note: "Huỷ order. Hệ thống về trạng thái nhất quán.", msgs: [["orch", "order", "cancel", "warn"]], set: { order: "order#1 CANCELLED" },
          lesson: "Saga: mỗi bước là local transaction có compensation. Orchestration dễ theo dõi, có điểm điều phối trung tâm." },
      ] },
      { name: "Choreography", nodes: [
        { id: "orch", x: 400, y: 60, label: "Event Bus (Kafka)", w: 170 },
        { id: "order", x: 130, y: 225, label: "Order Svc" },
        { id: "pay", x: 400, y: 225, label: "Payment Svc" },
        { id: "inv", x: 670, y: 225, label: "Inventory Svc", s: "stock=0" },
      ], steps: [
        { note: "Order Svc tạo order và phát event.", msgs: [["order", "orch", "OrderCreated"]], set: { order: "order#1 PENDING" } },
        { note: "Payment nghe event, tự trừ tiền, phát event mới.", msgs: [["orch", "pay", "OrderCreated"], ["pay", "orch", "PaymentDone", "ok"]], set: { pay: "charged $50" } },
        { note: "Inventory nghe event — hết hàng.", msgs: [["orch", "inv", "PaymentDone"], ["inv", "orch", "StockFailed", "err"]], bad: ["inv"] },
        { note: "Payment và Order **tự** nghe `StockFailed` để bù trừ.", msgs: [{ par: [["orch", "pay", "StockFailed", "warn"], ["orch", "order", "StockFailed", "warn"]] }], set: { pay: "refunded $50", order: "order#1 CANCELLED" },
          lesson: "Choreography: không có điểm trung tâm, service lỏng lẻo — nhưng luồng khó nhìn và khó debug." },
      ] },
    ],
  },
  {
    id: "realtime", title: "Polling, SSE và WebSocket", topics: ["patterns", "networking"],
    scenario: "Trang live score cần hiện tỉ số mới ngay khi có bàn thắng.", h: 250,
    nodes: [
      { id: "client", x: 120, y: 115, label: "Browser" },
      { id: "server", x: 660, y: 115, label: "Server" },
    ],
    variants: [
      { name: "Short polling", steps: [
        { note: "Cứ 2s hỏi một lần.", msgs: [["client", "server", "GET /score"], ["server", "client", "204 không có gì", "warn"]] },
        { note: "Lại hỏi — vẫn rỗng. Mỗi lần là một request đầy đủ header.", msgs: [["client", "server", "GET /score"], ["server", "client", "204 không có gì", "warn"]] },
        { note: "Có bàn thắng, nhưng client chỉ biết ở lượt hỏi kế tiếp.", msgs: [["client", "server", "GET /score"], ["server", "client", "200 1-0", "ok"]],
          lesson: "Polling đơn giản nhất, nhưng tốn request rỗng và trễ tới một chu kỳ." },
      ] },
      { name: "SSE", steps: [
        { note: "Client mở một HTTP request; server **giữ** response mở.", msgs: [["client", "server", "GET /stream · event-stream"]], set: { client: "kết nối mở", server: "giữ response" } },
        { note: "Server đẩy event bất cứ lúc nào.", msgs: [["server", "client", "event: 1-0", "ok"], ["server", "client", "event: 2-0", "ok"]] },
        { note: "Client muốn gửi lên phải dùng **request riêng** (SSE chỉ một chiều).", msgs: [["client", "server", "POST /vote", "warn"]],
          lesson: "SSE: server → client trên HTTP thường, tự reconnect. Hợp live score, notification." },
      ] },
      { name: "WebSocket", steps: [
        { note: "Handshake bằng HTTP Upgrade.", msgs: [["client", "server", "GET /ws · Upgrade"], ["server", "client", "101 Switching", "ok"]], set: { client: "WS open", server: "WS open" } },
        { note: "Hai chiều trên **cùng một kết nối**.", msgs: [{ par: [["client", "server", "msg: hi", "ok"], ["server", "client", "msg: hello", "ok"]] }, { par: [["client", "server", "typing…"], ["server", "client", "goal! 1-0", "ok"]] }] },
        { note: "Khi scale nhiều server, dùng **Pub/Sub** (Redis) để chuyển tin giữa các server đang giữ kết nối.", set: { server: "N server + Redis Pub/Sub" },
          lesson: "WebSocket: hai chiều, stateful — cần sticky connection và pub/sub khi scale." },
      ] },
    ],
  },
  {
    id: "long-task", title: "Tác vụ chạy lâu: 202 + job queue", topics: ["patterns", "queue"],
    scenario: "User xuất báo cáo Excel 1 triệu dòng — mất vài phút.",
    nodes: [
      { id: "client", x: 90, y: 150, label: "Client" },
      { id: "api", x: 330, y: 65, label: "API", s: "—" },
      { id: "queue", x: 330, y: 235, label: "Queue" },
      { id: "worker", x: 600, y: 235, label: "Worker", s: "rảnh" },
      { id: "s3", x: 600, y: 65, label: "S3", s: "—" },
    ],
    steps: [
      { note: "User yêu cầu xuất báo cáo.", msgs: [["client", "api", "POST /reports"]] },
      { note: "API **không xử lý tại chỗ**: đẩy job vào queue, trả `202` + jobId ngay.", msgs: [["api", "queue", "enqueue job#7"], ["api", "client", "202 {jobId:7}", "ok"]], set: { api: "job#7 QUEUED", queue: "job#7" } },
      { note: "Worker nhận job và chạy vài phút.", msgs: [["queue", "worker", "job#7"]], set: { worker: "đang chạy 40%", api: "job#7 RUNNING", queue: "" } },
      { note: "Client poll trạng thái (hoặc nhận SSE / webhook).", msgs: [["client", "api", "GET /jobs/7"], ["api", "client", "RUNNING 40%", "warn"]] },
      { note: "Worker xong, upload file lên S3 và cập nhật trạng thái.", msgs: [["worker", "s3", "report7.xlsx"], ["worker", "api", "DONE", "ok"]], set: { worker: "rảnh", s3: "report7.xlsx", api: "job#7 DONE" } },
      { note: "Client nhận link tải (presigned URL) và tải thẳng từ S3.", msgs: [["client", "api", "GET /jobs/7"], ["api", "client", "DONE + URL", "ok"], ["client", "s3", "GET report7.xlsx", "ok"]], good: ["s3"],
        lesson: "Async job: 202 + jobId, queue + worker, poll hoặc push trạng thái. Không giữ HTTP request chờ việc nặng." },
    ],
  },
  {
    id: "deadlock", title: "Deadlock và lock ordering", topics: ["concurrency"],
    scenario: "T1 chuyển tiền A → B, T2 chuyển tiền B → A cùng lúc. Mỗi giao dịch cần khoá cả hai tài khoản.",
    nodes: [
      { id: "T1", x: 120, y: 65, label: "Thread T1" },
      { id: "T2", x: 120, y: 225, label: "Thread T2" },
      { id: "A", x: 540, y: 65, label: "Lock A", s: "free" },
      { id: "B", x: 540, y: 225, label: "Lock B", s: "free" },
    ],
    variants: [
      { name: "Gây deadlock", steps: [
        { note: "T1 lấy lock A.", msgs: [["T1", "A", "acquire"], ["A", "T1", "OK", "ok"]], set: { A: "held by T1", T1: "giữ A" } },
        { note: "Cùng lúc T2 lấy lock B.", msgs: [["T2", "B", "acquire"], ["B", "T2", "OK", "ok"]], set: { B: "held by T2", T2: "giữ B" } },
        { note: "T1 cần B → chờ T2. T2 cần A → chờ T1.", msgs: [{ par: [["T1", "B", "acquire…", "warn"], ["T2", "A", "acquire…", "warn"]] }], set: { T1: "giữ A · chờ B ⏳", T2: "giữ B · chờ A ⏳" } },
        { note: "**Circular wait** — không ai nhả lock, cả hai treo vĩnh viễn.", bad: ["T1", "T2"],
          lesson: "Deadlock cần đủ 4 điều kiện: mutual exclusion, hold & wait, no preemption, circular wait." },
      ] },
      { name: "Lock ordering", steps: [
        { note: "Quy tắc: luôn lấy lock **theo thứ tự cố định** (A trước B). T1 lấy A.", msgs: [["T1", "A", "acquire"], ["A", "T1", "OK", "ok"]], set: { A: "held by T1", T1: "giữ A" } },
        { note: "T2 cũng phải lấy A trước → chờ, nhưng **không giữ lock nào**.", msgs: [["T2", "A", "acquire…", "warn"]], set: { T2: "chờ A ⏳ (không giữ gì)" } },
        { note: "T1 lấy tiếp B, làm xong, nhả cả hai.", msgs: [["T1", "B", "acquire"], ["B", "T1", "OK", "ok"], { par: [["T1", "A", "release", "ok"], ["T1", "B", "release", "ok"]] }], set: { T1: "xong ✓", A: "free", B: "free" } },
        { note: "T2 lấy A rồi B — không có vòng chờ.", msgs: [["T2", "A", "acquire"], ["T2", "B", "acquire"]], set: { T2: "giữ A, B ✓", A: "held by T2", B: "held by T2" }, good: ["T2"],
          lesson: "Lock ordering phá điều kiện circular wait." },
      ] },
    ],
  },
  {
    id: "vending", custom: "vending", title: "State pattern: máy bán hàng", topics: ["patterns-gof"],
    scenario: "Bấm các nút để chuyển trạng thái. Máy từ chối hành động không hợp lệ ở trạng thái hiện tại.",
    initial: "Idle",
    stock: 2,
    states: { Idle: [150, 80], HasCoin: [520, 80], Dispensing: [520, 235], SoldOut: [150, 235] },
    actions: [["insertCoin", "Bỏ xu"], ["select", "Chọn món"], ["refund", "Hoàn xu"], ["take", "Lấy hàng"], ["restock", "Nạp hàng"]],
    transitions: [
      { from: "Idle", to: "HasCoin", on: "insertCoin", label: "insertCoin", bend: -22 },
      { from: "HasCoin", to: "Idle", on: "refund", label: "refund", bend: -22 },
      { from: "HasCoin", to: "Dispensing", on: "select", label: "select", bend: 0, stock: -1 },
      { from: "Dispensing", to: "Idle", on: "take", label: "take (còn hàng)", bend: 0, when: "stock" },
      { from: "Dispensing", to: "SoldOut", on: "take", label: "take (hết hàng)", bend: 0, when: "empty" },
      { from: "SoldOut", to: "Idle", on: "restock", label: "restock", bend: 0, restock: 3 },
    ],
  },
  {
    id: "observer", title: "Observer: 1 subject, nhiều observer", topics: ["patterns-gof"],
    scenario: "Giá cổ phiếu thay đổi, nhiều thành phần cần phản ứng mà Subject không cần biết chúng là ai.",
    nodes: [
      { id: "subject", x: 160, y: 145, label: "Stock (Subject)", w: 150, s: "AAPL=190" },
      { id: "o1", x: 590, y: 50, label: "Mobile App" },
      { id: "o2", x: 590, y: 145, label: "Email Alert" },
      { id: "o3", x: 590, y: 240, label: "Dashboard" },
    ],
    h: 310,
    steps: [
      { note: "3 observer **subscribe** vào Subject.", msgs: [{ par: [["o1", "subject", "subscribe"], ["o2", "subject", "subscribe"], ["o3", "subject", "subscribe"]] }], set: { subject: "AAPL=190 · 3 observers" } },
      { note: "Giá đổi → Subject gọi `notify()` cho mọi observer.", msgs: [{ par: [["subject", "o1", "update(195)", "ok"], ["subject", "o2", "update(195)", "ok"], ["subject", "o3", "update(195)", "ok"]] }], set: { subject: "AAPL=195" } },
      { note: "Mỗi observer tự xử lý theo cách riêng.", set: { o1: "push notification", o2: "gửi email", o3: "vẽ lại chart" } },
      { note: "Email Alert **unsubscribe** — lần sau chỉ 2 observer nhận.", msgs: [["o2", "subject", "unsubscribe", "warn"], { par: [["subject", "o1", "update(198)", "ok"], ["subject", "o3", "update(198)", "ok"]] }], set: { subject: "AAPL=198 · 2 observers", o2: "" },
        lesson: "Observer: quan hệ 1–N, Subject và Observer lỏng lẻo (loose coupling)." },
    ],
  },
  {
    id: "kafka-group", custom: "kgroup", title: "Consumer group & partition (tương tác)", topics: ["kafka"],
    scenario: "Producer gửi message có key vào 4 partition. Thêm/bớt consumer để xem rebalance, lag và giới hạn song song.",
  },
  {
    id: "kafka-acks", title: "acks=1 vs acks=all khi leader chết", topics: ["kafka"],
    scenario: "Partition P0 có 3 replica trên 3 broker. Producer ghi `order#42` rồi broker leader chết.",
    nodes: [
      { id: "producer", x: 90, y: 165, label: "Producer" },
      { id: "b1", x: 380, y: 60, label: "Broker 1", s: "P0 leader · offset 41" },
      { id: "b2", x: 380, y: 165, label: "Broker 2", s: "P0 follower · 41" },
      { id: "b3", x: 380, y: 270, label: "Broker 3", s: "P0 follower · 41" },
      { id: "consumer", x: 670, y: 165, label: "Consumer" },
    ],
    links: [["b1", "b2"], ["b2", "b3"]],
    h: 330,
    variants: [
      { name: "acks=1", steps: [
        { note: "Producer gửi `order#42` với **acks=1**: chỉ cần leader ghi xong.", msgs: [["producer", "b1", "order#42 · acks=1"]], set: { b1: "P0 leader · offset 42" } },
        { note: "Leader ack ngay, chưa chờ follower.", msgs: [["b1", "producer", "ack offset 42", "ok"]] },
        { note: "Leader **chết** trước khi follower kịp kéo offset 42.", set: { b1: "💥 down" }, bad: ["b1"] },
        { note: "Broker 2 được bầu làm leader mới — log của nó chỉ tới 41.", set: { b2: "P0 leader · offset 41" }, msgs: [["b2", "consumer", "đọc tới 41", "warn"]] },
        { note: "`order#42` đã được ack nhưng **biến mất**.", bad: ["b2"],
          lesson: "acks=1 nhanh nhưng mất dữ liệu nếu leader chết ngay sau khi ack." },
      ] },
      { name: "acks=all + min.insync=2", steps: [
        { note: "Producer gửi với **acks=all**; topic có replication.factor=3, min.insync.replicas=2.", msgs: [["producer", "b1", "order#42 · acks=all"]], set: { b1: "P0 leader · offset 42" } },
        { note: "Follower kéo dữ liệu từ leader.", msgs: [{ par: [["b1", "b2", "replicate 42"], ["b1", "b3", "replicate 42"]] }], set: { b2: "P0 follower · 42", b3: "P0 follower · 42" } },
        { note: "Leader chỉ ack khi đủ ISR.", msgs: [["b1", "producer", "ack offset 42", "ok"]] },
        { note: "Leader chết → Broker 2 lên leader **vẫn có** offset 42.", set: { b1: "💥 down", b2: "P0 leader · 42" }, msgs: [["b2", "consumer", "order#42", "ok"]], good: ["b2"] },
        { note: "Chỉ còn 1 replica in-sync → broker **từ chối ghi** của producer: Kafka chọn không mất dữ liệu thay vì luôn nhận ghi.", set: { b3: "💥 down" }, msgs: [["producer", "b2", "order#43"], ["b2", "producer", "NotEnoughReplicas", "err"]], bad: ["b3"],
          lesson: "RF=3 + acks=all + min.insync.replicas=2: mất một broker vẫn không mất message đã ack." },
      ] },
    ],
  },
  {
    id: "kafka-delivery", title: "Commit offset: at-most-once, at-least-once, idempotent", topics: ["kafka"],
    scenario: "Consumer đọc message “charge $5” rồi crash. Thời điểm commit offset quyết định message bị mất hay bị xử lý hai lần.",
    nodes: [
      { id: "kafka", x: 100, y: 120, label: "Partition", s: "offset 100, 101, 102" },
      { id: "consumer", x: 380, y: 120, label: "Consumer" },
      { id: "offsets", x: 380, y: 250, label: "__consumer_offsets", w: 170, s: "committed = 100" },
      { id: "db", x: 670, y: 120, label: "Database", s: "—" },
    ],
    h: 300,
    variants: [
      { name: "At-most-once", steps: [
        { note: "Consumer poll message offset 100.", msgs: [["kafka", "consumer", "msg@100 charge $5"]] },
        { note: "**Commit offset trước** khi xử lý.", msgs: [["consumer", "offsets", "commit 101"]], set: { offsets: "committed = 101" } },
        { note: "Crash khi đang xử lý.", set: { consumer: "💥 crash" }, bad: ["consumer"] },
        { note: "Consumer mới đọc từ 101 → message 100 **mất**.", set: { consumer: "consumer mới" }, msgs: [["kafka", "consumer", "msg@101"]], bad: ["db"],
          lesson: "At-most-once: không trùng nhưng có thể mất. Chỉ hợp metrics, log không quan trọng." },
      ] },
      { name: "At-least-once", steps: [
        { note: "Consumer poll message offset 100.", msgs: [["kafka", "consumer", "msg@100 charge $5"]] },
        { note: "Xử lý xong: ghi DB.", msgs: [["consumer", "db", "INSERT charge $5"]], set: { db: "charge $5 (1 lần)" } },
        { note: "Crash **trước khi commit** offset.", set: { consumer: "💥 crash" }, bad: ["consumer"] },
        { note: "Consumer mới đọc lại từ 100 → xử lý **lần hai**.", set: { consumer: "consumer mới", db: "charge $5 × 2 ❌" }, msgs: [["kafka", "consumer", "msg@100 (lại)", "warn"], ["consumer", "db", "INSERT charge $5", "err"]], bad: ["db"],
          lesson: "At-least-once (mặc định): không mất nhưng có thể trùng." },
      ] },
      { name: "At-least-once + idempotent", steps: [
        { note: "Consumer poll message offset 100.", msgs: [["kafka", "consumer", "msg@100 charge $5"]] },
        { note: "Ghi DB kèm **message id** làm khoá duy nhất.", msgs: [["consumer", "db", "INSERT … ON CONFLICT DO NOTHING"]], set: { db: "msg 100 ✓" } },
        { note: "Crash **trước khi commit** offset.", set: { consumer: "💥 crash" }, bad: ["consumer"] },
        { note: "Đọc lại 100 → DB thấy msg id đã có, **bỏ qua**; commit tiếp.", set: { consumer: "consumer mới", offsets: "committed = 101" }, msgs: [["kafka", "consumer", "msg@100 (lại)", "warn"], ["consumer", "db", "INSERT … ON CONFLICT"], ["db", "consumer", "0 row (đã có)", "ok"], ["consumer", "offsets", "commit 101", "ok"]], good: ["db"],
          lesson: "Trong thực tế, “exactly-once” = at-least-once + consumer idempotent." },
      ] },
    ],
  },
  {
    id: "redis-play", custom: "rplay", title: "Redis playground (tương tác)", topics: ["redis"],
    scenario: "Bấm lệnh thật và xem dữ liệu thay đổi: leaderboard bằng sorted set, counter + TTL, distributed lock.",
  },
  {
    id: "redis-atomic", title: "Vì sao dùng INCR và Lua thay vì GET rồi SET", topics: ["redis"],
    scenario: "Hai server cùng tăng một counter, sau đó cùng kiểm tra rate limit.", h: 280,
    nodes: [
      { id: "a", x: 100, y: 70, label: "Server A" },
      { id: "b", x: 100, y: 220, label: "Server B" },
      { id: "redis", x: 520, y: 145, label: "Redis", s: "views = 10" },
    ],
    variants: [
      { name: "GET rồi SET", steps: [
        { note: "Hai server cùng đọc counter.", msgs: [{ par: [["a", "redis", "GET views"], ["b", "redis", "GET views"]] }, { par: [["redis", "a", "10", "ok"], ["redis", "b", "10", "ok"]] }] },
        { note: "Cả hai tính 10 + 1 = 11 trong code.", set: { a: "tính 11", b: "tính 11" } },
        { note: "Cả hai ghi 11 → **mất một lượt tăng** (lost update).", msgs: [["a", "redis", "SET views 11"], ["b", "redis", "SET views 11", "err"]], set: { redis: "views = 11 ❌ (đúng là 12)" }, bad: ["redis"],
          lesson: "Đọc–tính–ghi từ phía client không atomic, dù Redis chạy một thread." },
      ] },
      { name: "INCR", steps: [
        { note: "Dùng **INCR**: phép cộng chạy ngay trên server.", msgs: [{ par: [["a", "redis", "INCR views"], ["b", "redis", "INCR views"]] }] },
        { note: "Redis chạy tuần tự từng lệnh: 10 → 11 → 12.", msgs: [["redis", "a", "11", "ok"], ["redis", "b", "12", "ok"]], set: { redis: "views = 12 ✓" }, good: ["redis"],
          lesson: "Một lệnh Redis là atomic." },
      ] },
      { name: "Lua script", steps: [
        { note: "Rate limit cần nhiều bước: đọc counter, so với limit, tăng, đặt TTL.", set: { redis: "rl:u42 = 9 (limit 10)" } },
        { note: "Gửi cả logic dưới dạng **Lua script**; Redis chạy trọn script, không lệnh nào chen giữa.", msgs: [{ par: [["a", "redis", "EVAL rate_limit u42"], ["b", "redis", "EVAL rate_limit u42"]] }] },
        { note: "A tới trước: 9 < 10 → tăng lên 10, cho qua. B chạy sau: 10 ≥ 10 → từ chối.", msgs: [["redis", "a", "allowed", "ok"], ["redis", "b", "denied", "err"]], set: { redis: "rl:u42 = 10" },
          lesson: "Lua = atomic + một round-trip; dùng cho rate limiter, nhả lock, check-and-set." },
      ] },
    ],
  },
  {
    id: "redis-cluster", title: "Redis Cluster: hash slot và failover", topics: ["redis"],
    scenario: "Cluster 3 master chia 16,384 slot; Master B có một replica.", h: 340,
    nodes: [
      { id: "client", x: 100, y: 170, label: "Client" },
      { id: "m1", x: 390, y: 60, label: "Master A", s: "slot 0–5460" },
      { id: "m2", x: 390, y: 170, label: "Master B", s: "slot 5461–10922" },
      { id: "m3", x: 390, y: 280, label: "Master C", s: "slot 10923–16383" },
      { id: "r2", x: 670, y: 170, label: "Replica B′", s: "bản sao của B" },
    ],
    links: [["m2", "r2"]],
    variants: [
      { name: "Định tuyến theo slot", steps: [
        { note: "Client cần `GET user:42`. `slot = CRC16(\"user:42\") mod 16384` — giả sử ra **8,155**, thuộc Master B.", set: { client: "slot 8155 → B" } },
        { note: "Client dùng bảng slot cũ, gửi nhầm tới Master A → nhận **MOVED**.", msgs: [["client", "m1", "GET user:42"], ["m1", "client", "MOVED 8155 → B", "warn"]] },
        { note: "Client cập nhật bảng slot và gửi đúng node.", msgs: [["client", "m2", "GET user:42"], ["m2", "client", "\"Son\"", "ok"]] },
        { note: "Lệnh nhiều key phải cùng slot. **Hash tag** `{user42}` ép mọi key của user42 vào cùng slot.", msgs: [["client", "m2", "MGET {user42}:cart {user42}:profile"], ["m2", "client", "2 values", "ok"]],
          lesson: "Smart client cache bảng slot để đi thẳng đúng node; MOVED giúp tự sửa khi topology đổi." },
      ] },
      { name: "Failover mất write", steps: [
        { note: "Client ghi vào Master B; B ack ngay rồi mới **replicate bất đồng bộ**.", msgs: [["client", "m2", "SET lock:7 A NX"], ["m2", "client", "OK", "ok"]], set: { m2: "lock:7 = A" } },
        { note: "B chết trước khi kịp gửi sang replica.", msgs: [["m2", "r2", "replicate ✗", "err"]], set: { m2: "💥 down" }, bad: ["m2"] },
        { note: "Replica được promote thành master — **không có** `lock:7`.", set: { r2: "Master mới · không có lock:7" } },
        { note: "Client khác lấy được cùng lock → hai bên cùng nghĩ mình giữ lock.", msgs: [["client", "r2", "SET lock:7 B NX"], ["r2", "client", "OK", "err"]], bad: ["r2"],
          lesson: "Replication bất đồng bộ: failover có thể mất write đã ack → lock cần fencing token; dữ liệu quan trọng cần nơi lưu bền khác." },
      ] },
    ],
  },
  {
    id: "container-stack", custom: "stack", title: "Ai quản lý lớp nào: ECS, EKS × Fargate, EC2", topics: ["ecs-vs-eks", "ecs", "eks"],
    scenario: "Chọn từng phương án để thấy lớp nào bạn phải tự lo, lớp nào AWS lo. Càng nhiều lớp đỏ → càng nhiều việc vận hành.",
    initial: "ecs-fg",
    options: [
      { id: "ecs-ec2", label: "ECS + EC2", fit: "Tải lớn ổn định cần tối ưu chi phí, GPU hoặc host đặc thù — chấp nhận tự quản máy." },
      { id: "ecs-fg", label: "ECS + Fargate", fit: "Mặc định cho team nhỏ/vừa chỉ chạy trên AWS: ít việc vận hành nhất trong nhóm container." },
      { id: "eks-mng", label: "EKS + Node group", fit: "Cần đầy đủ Kubernetes (DaemonSet, GPU, tuỳ biến node) và có người vận hành cluster." },
      { id: "eks-fg", label: "EKS + Fargate", fit: "Muốn API Kubernetes nhưng không quản node; chấp nhận không DaemonSet, không GPU." },
      { id: "eks-auto", label: "EKS Auto Mode", fit: "Muốn Kubernetes với ít vận hành nhất: AWS lo node, vá, scale, add-on lõi." },
    ],
    layers: [
      ["Code & container image", { "ecs-ec2": "y", "ecs-fg": "y", "eks-mng": "y", "eks-fg": "y", "eks-auto": "y" }],
      ["Task def / manifest, quy tắc scale", { "ecs-ec2": "y", "ecs-fg": "y", "eks-mng": "y", "eks-fg": "y", "eks-auto": "y" }],
      ["Add-on (CNI, ingress, DNS, autoscaler)", { "ecs-ec2": "a", "ecs-fg": "a", "eks-mng": "y", "eks-fg": "s", "eks-auto": "a" }],
      ["Nâng version orchestrator", { "ecs-ec2": "a", "ecs-fg": "a", "eks-mng": "y", "eks-fg": "y", "eks-auto": "s" }],
      ["Thêm/bớt máy chủ", { "ecs-ec2": "s", "ecs-fg": "a", "eks-mng": "s", "eks-fg": "a", "eks-auto": "a" }],
      ["Vá OS, AMI của node", { "ecs-ec2": "y", "ecs-fg": "a", "eks-mng": "s", "eks-fg": "a", "eks-auto": "a" }],
      ["Control plane (API, scheduler, state)", { "ecs-ec2": "a", "ecs-fg": "a", "eks-mng": "a", "eks-fg": "a", "eks-auto": "a" }],
      ["Hạ tầng vật lý, hypervisor", { "ecs-ec2": "a", "ecs-fg": "a", "eks-mng": "a", "eks-fg": "a", "eks-auto": "a" }],
    ],
    cost: { "ecs-ec2": "Không phí control plane · trả tiền EC2 (kể cả phần trống)", "ecs-fg": "Không phí control plane · trả theo vCPU/RAM của task", "eks-mng": "~$0.10/giờ/cluster · trả tiền EC2", "eks-fg": "~$0.10/giờ/cluster · trả theo vCPU/RAM của pod", "eks-auto": "~$0.10/giờ/cluster · EC2 + phí quản lý Auto Mode" },
  },
  {
    id: "container-decide", custom: "decide", title: "Trả lời 7 câu → ECS hay EKS", topics: ["ecs-vs-eks"],
    scenario: "Bấm Có/Không theo tình huống của bạn (hoặc của đề bài) để xem gợi ý orchestrator, kiểu compute và lý do.",
    questions: [
      { id: "k8s", q: "Team đã vận hành Kubernetes thành thạo?", eks: 2, why: "Team đã quen Kubernetes → chi phí học EKS gần như bằng 0." },
      { id: "multi", q: "Phải chạy cả ngoài AWS (on-prem, cloud khác)?", eks: 3, why: "Cần chạy nhiều nơi → Kubernetes cho cùng manifest và công cụ ở mọi môi trường." },
      { id: "eco", q: "Cần công cụ chỉ Kubernetes có (Helm chart sẵn, operator, ArgoCD, KEDA, Istio)?", eks: 2, why: "Cần hệ sinh thái Kubernetes mà ECS không có tương đương." },
      { id: "platform", q: "Có platform team riêng phục vụ nhiều team dev?", eks: 1, why: "Có platform team → đủ người nâng version, quản add-on, RBAC đa team." },
      { id: "small", q: "Team nhỏ, ưu tiên ship nhanh, không ai chuyên lo hạ tầng?", ecs: 3, why: "Team nhỏ → ECS bỏ hết khâu nâng version và lắp ghép add-on." },
      { id: "gpu", q: "Cần GPU, DaemonSet hoặc tuỳ biến node sâu?", eks: 1, ec2: true, why: "Cần GPU / tuỳ biến node → không dùng được Fargate, phải có node EC2." },
      { id: "spiky", q: "Traffic lẻ tẻ, mỗi lần xử lý ngắn, không cần chạy thường trực?", lambda: true, why: "Tải lẻ tẻ, ngắn → cân nhắc Lambda trước khi nghĩ tới container." },
    ],
  },
  {
    id: "ecs-flow", title: "ECS: deploy, scale và tự phục hồi", topics: ["ecs"],
    scenario: "Service `web` chạy 2 task Fargate sau ALB.", h: 340,
    nodes: [
      { id: "ci", x: 90, y: 60, label: "CI/CD" },
      { id: "ecr", x: 90, y: 260, label: "ECR", s: "web:v1" },
      { id: "ecs", x: 310, y: 160, label: "ECS control plane", w: 160, s: "service web · desired 2" },
      { id: "cw", x: 310, y: 290, label: "CloudWatch" },
      { id: "t1", x: 540, y: 60, label: "Task #1", s: "v1 · RUNNING" },
      { id: "t2", x: 540, y: 160, label: "Task #2", s: "v1 · RUNNING" },
      { id: "t3", x: 540, y: 260, label: "Task #3", s: "—" },
      { id: "alb", x: 720, y: 160, label: "ALB", w: 120, s: "targets: 2" },
    ],
    links: [["ci", "ecs"], ["ci", "ecr"], ["ecs", "t1"], ["ecs", "t2"], ["ecs", "t3"], ["t1", "alb"], ["t2", "alb"], ["t3", "alb"], ["cw", "ecs"]],
    variants: [
      { name: "Rolling deploy", steps: [
        { note: "CI build image `web:v2`, push lên **ECR** và đăng ký **task definition revision 8**.", msgs: [["ci", "ecr", "push web:v2"], ["ci", "ecs", "update service → :8"]], set: { ecr: "web:v1, web:v2", ecs: "service web · taskdef :8" } },
        { note: "ECS tạo task mới trên Fargate; task kéo image từ ECR bằng **execution role**.", msgs: [["ecs", "t3", "start task v2"], ["ecr", "t3", "pull web:v2"]], set: { t3: "v2 · RUNNING" } },
        { note: "ECS đăng ký IP của task (awsvpc) vào **target group**; ALB health check pass.", msgs: [["ecs", "alb", "register task 3"], ["alb", "t3", "GET /health", "ok"]], set: { t3: "v2 · healthy", alb: "targets: 3" }, good: ["t3"] },
        { note: "ECS drain và dừng task cũ, lặp lại tới khi tất cả chạy v2.", msgs: [["ecs", "alb", "deregister task 1", "warn"], ["ecs", "t1", "stop", "warn"]], set: { t1: "v1 · STOPPED", alb: "targets: 2" },
          lesson: "Tạo mới → health check → rút cũ. Bật deployment circuit breaker để tự rollback khi task mới không healthy." },
      ] },
      { name: "Scale khi tải tăng", steps: [
        { note: "CPU trung bình của service vượt ngưỡng 70%.", set: { t1: "v1 · CPU 85%", t2: "v1 · CPU 82%" }, bad: ["t1", "t2"], msgs: [["ecs", "cw", "metrics CPU"]] },
        { note: "**Service Auto Scaling** (target tracking) tăng desired count 2 → 3. Fargate cấp compute ngay — không phải lo máy.", msgs: [["cw", "ecs", "alarm → desired 3"], ["ecs", "t3", "start task"]], set: { ecs: "service web · desired 3", t3: "v1 · RUNNING" } },
        { note: "Task mới vào target group, tải chia đều.", msgs: [["ecs", "alb", "register task 3", "ok"]], set: { t1: "v1 · CPU 55%", t2: "v1 · CPU 54%", t3: "v1 · CPU 52%", alb: "targets: 3" }, good: ["t1", "t2", "t3"],
          lesson: "Fargate: chỉ cần scale số task. Trên EC2 còn phải scale máy qua capacity provider." },
      ] },
      { name: "Task chết", steps: [
        { note: "Task #2 crash vì hết RAM (OOM).", set: { t2: "💥 STOPPED (OOM)" }, bad: ["t2"], msgs: [["alb", "t2", "health check ✗", "err"]] },
        { note: "ALB đánh dấu unhealthy; ECS thấy running 1 < desired 2.", msgs: [["ecs", "alb", "deregister task 2", "warn"]], set: { alb: "targets: 1" } },
        { note: "ECS tự khởi động task thay thế.", msgs: [["ecs", "t3", "start replacement"], ["ecs", "alb", "register task 3", "ok"]], set: { t3: "v1 · RUNNING (thay #2)", alb: "targets: 2" }, good: ["t3"],
          lesson: "Service luôn kéo số task về desired count — tự phục hồi mà không phải viết thêm gì." },
      ] },
    ],
  },
  {
    id: "eks-flow", title: "EKS: deploy, scale 2 lớp và Pod Identity", topics: ["eks"],
    scenario: "Deployment `web` chạy trên 2 node EC2; ingress là ALB qua AWS Load Balancer Controller.", h: 360,
    nodes: [
      { id: "dev", x: 90, y: 60, label: "ArgoCD / kubectl", w: 150 },
      { id: "api", x: 310, y: 170, label: "EKS control plane", w: 170, s: "API server · etcd · scheduler" },
      { id: "karp", x: 90, y: 300, label: "Karpenter" },
      { id: "n1", x: 540, y: 60, label: "Node A (EC2)", s: "pod v1 ×2" },
      { id: "n2", x: 540, y: 180, label: "Node B (EC2)", s: "pod v1 ×2" },
      { id: "n3", x: 540, y: 300, label: "Node C", s: "(chưa có)" },
      { id: "alb", x: 720, y: 180, label: "ALB", w: 120, s: "targets: pod IP" },
    ],
    links: [["dev", "api"], ["api", "n1"], ["api", "n2"], ["api", "n3"], ["karp", "api"], ["karp", "n3"], ["n1", "alb"], ["n2", "alb"], ["n3", "alb"]],
    variants: [
      { name: "Rolling deploy", steps: [
        { note: "ArgoCD (GitOps) apply Deployment `web` image `v2` lên **API server**; trạng thái lưu vào etcd.", msgs: [["dev", "api", "apply Deployment web:v2"]], set: { api: "Deployment web · ReplicaSet v2" } },
        { note: "Scheduler chọn node đủ CPU/RAM theo **resource requests**; kubelet trên Node A kéo image và chạy pod.", msgs: [["api", "n1", "bind pod web-v2"]], set: { n1: "pod v1 ×2 + v2 (starting)" } },
        { note: "**VPC CNI** cấp cho pod một IP thật trong VPC; readiness probe pass.", set: { n1: "v2 · 10.0.12.44 · Ready" }, good: ["n1"] },
        { note: "**AWS Load Balancer Controller** thấy endpoint mới → đăng ký IP pod vào ALB.", msgs: [["api", "alb", "endpoint 10.0.12.44"], ["alb", "n1", "health check", "ok"]] },
        { note: "ReplicaSet cũ giảm dần theo `maxSurge` / `maxUnavailable` tới khi tất cả là v2.", msgs: [["api", "n2", "terminate pod v1", "warn"]], set: { n2: "pod v2 ×2 · Ready", n1: "pod v2 ×2 · Ready" },
          lesson: "Cùng ý tưởng rolling deploy như ECS — nhưng GitOps, CNI, ingress controller là các component riêng bạn cài và nâng cấp." },
      ] },
      { name: "Scale: HPA + Karpenter", steps: [
        { note: "Tải tăng: **HPA** thấy CPU 85% > 60% → tăng replicas 4 → 8.", set: { api: "HPA: replicas 4 → 8", n1: "CPU 90% · đầy", n2: "CPU 88% · đầy" }, bad: ["n1", "n2"] },
        { note: "Không node nào đủ chỗ → 4 pod **Pending**.", set: { api: "4 pod Pending" } },
        { note: "**Karpenter** thấy pod Pending, chọn instance vừa khít (có thể Spot) và tạo node trong khoảng một phút.", msgs: [["karp", "api", "watch Pending pods"], ["karp", "n3", "launch c7g.xlarge (Spot)"]], set: { n3: "Node C · Ready" } },
        { note: "Scheduler xếp pod lên node mới; ALB nhận thêm target.", msgs: [["api", "n3", "bind 4 pods"], ["n3", "alb", "4 pod IP", "ok"]], set: { n3: "pod v2 ×4 · Ready", api: "8/8 Ready", n1: "CPU 60%", n2: "CPU 58%" }, good: ["n3"],
          lesson: "EKS scale 2 lớp: HPA (pod) + Karpenter (node). ECS + Fargate chỉ cần lớp thứ nhất." },
      ] },
      { name: "Pod gọi S3 (Pod Identity)", steps: [
        { note: "Pod cần đọc S3. Không đặt access key trong code — gắn **IAM role vào ServiceAccount** `web-sa` qua EKS Pod Identity.", set: { n1: "pod web · SA web-sa → role s3-read" } },
        { note: "SDK trong pod xin credential tạm qua Pod Identity Agent trên node.", msgs: [["n1", "api", "AssumeRoleForPodIdentity"], ["api", "n1", "credential tạm · 1h", "ok"]], good: ["n1"] },
        { note: "Pod khác trên cùng node không dùng được role này — quyền gắn theo ServiceAccount, không theo node.", set: { n2: "pod khác · không có quyền S3" },
          lesson: "ECS dùng task role; EKS dùng Pod Identity (hoặc IRSA). Cả hai đều là credential tạm theo workload." },
      ] },
    ],
  },
  {
    id: "arch-dependency", custom: "arch", title: "5 kiến trúc code × tình huống thay đổi", topics: ["code-architecture"],
    scenario: "Cùng một app bán hàng, tổ chức theo 5 cách. Chọn kiến trúc để xem hướng phụ thuộc, rồi chọn tình huống để thấy **phần nào phải sửa** (tô đỏ).",
    options: [
      { id: "layered", label: "Layered", h: 320,
        idea: "Mỗi tầng chỉ gọi tầng ngay dưới. Mũi tên phụ thuộc đi **xuống tới DB**, nên business biết DB.",
        pro: "Dễ hiểu nhất: framework sinh sẵn controller/service/repository, người mới vào làm được ngay.",
        con: "Business dính ORM/DB; thêm tính năng chạm mọi tầng; test business phải có DB.",
        blocks: [
          { id: "pres", x: 180, y: 16, w: 440, h: 56, label: "Presentation", sub: "Controller, View" },
          { id: "biz", x: 180, y: 92, w: 440, h: 56, label: "Business", sub: "OrderService" },
          { id: "data", x: 180, y: 168, w: 440, h: 56, label: "Data Access", sub: "OrderRepository + ORM entity" },
          { id: "db", x: 180, y: 244, w: 440, h: 56, label: "Database", sub: "PostgreSQL", kind: "infra" },
        ],
        arrows: [[400, 72, 400, 90], [400, 148, 400, 166], [400, 224, 400, 242]],
        caption: "mũi tên = “phụ thuộc vào” · đi từ trên xuống" },
      { id: "hex", label: "Hexagonal", h: 330,
        idea: "Mọi mũi tên chỉ **vào core**: core ở giữa định nghĩa **port** (interface), adapter bên ngoài cài đặt port.",
        pro: "Đổi DB, payment, kênh vào mà core không đổi; test core bằng adapter in-memory; REST, gRPC, consumer dùng chung use case.",
        con: "Nhiều interface và mapping DTO; code dài hơn; nặng nề với CRUD.",
        blocks: [
          { id: "core", shape: "hex", cx: 400, cy: 165, r: 112, label: "Domain + Use cases", sub: "PlaceOrder, Order, Money" },
          { id: "portIn", x: 290, y: 148, w: 96, h: 36, label: "Port vào", kind: "port" },
          { id: "portOut", x: 414, y: 148, w: 96, h: 36, label: "Port ra", kind: "port" },
          { id: "rest", x: 20, y: 40, w: 160, h: 46, label: "REST controller", kind: "adapter" },
          { id: "grpc", x: 20, y: 142, w: 160, h: 46, label: "gRPC handler", kind: "adapter" },
          { id: "cons", x: 20, y: 244, w: 160, h: 46, label: "Kafka consumer", kind: "adapter" },
          { id: "pg", x: 620, y: 40, w: 160, h: 46, label: "Postgres adapter", kind: "adapter" },
          { id: "stripe", x: 620, y: 142, w: 160, h: 46, label: "Stripe adapter", kind: "adapter" },
          { id: "mem", x: 620, y: 244, w: 160, h: 46, label: "In-memory (test)", kind: "adapter" },
        ],
        arrows: [[180, 63, 288, 160], [180, 165, 288, 166], [180, 267, 288, 172], [620, 63, 512, 160], [620, 165, 512, 166], [620, 267, 512, 172]],
        caption: "trái: driving adapter (gọi vào) · phải: driven adapter (bị gọi ra)" },
      { id: "onion", label: "Onion", h: 336,
        idea: "Các vòng đồng tâm; vòng ngoài phụ thuộc vòng trong, **không bao giờ ngược lại**. Domain Model ở tâm.",
        pro: "Domain thuần; tách luật nghiệp vụ lõi (domain services) khỏi điều phối (application services).",
        con: "Nhiều vòng cần kỷ luật; ranh giới các vòng trong dễ mơ hồ.",
        blocks: [
          { id: "infra", shape: "ring", cx: 400, cy: 168, r: 160, label: "Infrastructure · UI · Tests", sub: "Postgres, REST, test" },
          { id: "as", shape: "ring", cx: 400, cy: 168, r: 118, label: "Application Services", sub: "điều phối use case" },
          { id: "ds", shape: "ring", cx: 400, cy: 168, r: 78, label: "Domain Services", sub: "luật nhiều entity" },
          { id: "dm", shape: "ring", cx: 400, cy: 168, r: 38, label: "Domain Model", sub: "Order" },
        ],
        arrows: [[244, 168, 278, 168], [284, 168, 318, 168], [324, 168, 358, 168]],
        caption: "mũi tên: phụ thuộc hướng vào tâm" },
      { id: "clean", label: "Clean", h: 336,
        idea: "**Dependency Rule**: code chỉ phụ thuộc vòng bên trong. Dữ liệu qua ranh giới là DTO đơn giản.",
        pro: "Độc lập framework, UI, DB; mỗi use case một class rõ ràng; dễ test, dễ đọc nghiệp vụ.",
        con: "Nhiều boilerplate (request/response model, presenter, mapper); dễ over-engineer.",
        blocks: [
          { id: "fw", shape: "ring", cx: 400, cy: 168, r: 160, label: "Frameworks & Drivers", sub: "Web, DB, UI, thiết bị" },
          { id: "ia", shape: "ring", cx: 400, cy: 168, r: 118, label: "Interface Adapters", sub: "Controller, Presenter, Gateway" },
          { id: "uc", shape: "ring", cx: 400, cy: 168, r: 78, label: "Use Cases", sub: "PlaceOrderInteractor" },
          { id: "ent", shape: "ring", cx: 400, cy: 168, r: 38, label: "Entities", sub: "Order" },
        ],
        arrows: [[244, 168, 278, 168], [284, 168, 318, 168], [324, 168, 358, 168]],
        caption: "mũi tên: Dependency Rule — chỉ hướng vào trong" },
      { id: "vslice", label: "Vertical Slice", h: 320,
        idea: "Cắt theo **tính năng**: mỗi slice chứa đủ endpoint → handler → truy vấn. Giữa các slice phụ thuộc tối thiểu.",
        pro: "Thêm tính năng không chạm tính năng khác; ít abstraction; mỗi slice làm vừa đủ.",
        con: "Dễ trùng lặp; luật dùng chung không có chỗ rõ nếu không refactor đều.",
        blocks: [
          { id: "s1", x: 30, y: 16, w: 175, h: 220, label: "PlaceOrder", sub: "endpoint · handler · query", top: true },
          { id: "s2", x: 220, y: 16, w: 175, h: 220, label: "CancelOrder", sub: "endpoint · handler · query", top: true },
          { id: "s3", x: 410, y: 16, w: 175, h: 220, label: "GetOrder", sub: "endpoint · handler · query", top: true },
          { id: "snew", x: 600, y: 16, w: 175, h: 220, label: "ApplyCoupon", sub: "(tính năng mới)", top: true, ghost: true },
          { id: "shared", x: 30, y: 254, w: 745, h: 50, label: "Shared", sub: "kết nối DB, auth, logging", kind: "infra" },
        ],
        arrows: [[117, 236, 117, 252], [307, 236, 307, 252], [497, 236, 497, 252]],
        caption: "mỗi cột là một tính năng tự chứa" },
    ],
    scenarios: [
      { label: "Đổi PostgreSQL → MongoDB", res: {
        layered: { touch: ["data", "biz", "db"], score: "bad", text: "Phải viết lại repository và **sửa lan lên business**, vì service thường dùng thẳng ORM entity, query, annotation transaction. Rủi ro: chỉ định đổi DB mà làm hỏng luật nghiệp vụ." },
        hex: { touch: ["pg"], score: "good", text: "Viết `MongoOrderRepository` cài đặt **cùng port** `OrderRepository`, đổi wiring lúc khởi động. Domain và use case không đổi một dòng; test core vẫn chạy với adapter in-memory." },
        onion: { touch: ["infra"], score: "good", text: "Chỉ vòng Infrastructure đổi; interface repository nằm ở vòng trong nên không phải sửa." },
        clean: { touch: ["fw", "ia"], score: "good", text: "Đổi driver DB (Frameworks) và gateway implementation (Interface Adapters). Use Cases và Entities giữ nguyên." },
        vslice: { touch: ["s1", "s2", "s3"], score: "mid", text: "Mỗi slice tự truy vấn DB nên phải sửa trong **từng slice** dùng bảng đó. Sửa thẳng, ít abstraction, nhưng nhiều chỗ." } } },
      { label: "Thêm cổng gRPC bên cạnh REST", res: {
        layered: { touch: ["pres"], score: "mid", text: "Thêm controller gRPC ở Presentation. Ổn nếu logic nằm trong service; nếu logic lỡ viết trong REST controller thì phải chuyển xuống hoặc copy." },
        hex: { touch: ["grpc"], score: "good", text: "Thêm một **driving adapter** gọi đúng port `PlaceOrder` đã có. Không đụng core, không trùng logic." },
        onion: { touch: ["infra"], score: "good", text: "Thêm ở vòng ngoài (API), gọi Application Services sẵn có." },
        clean: { touch: ["fw", "ia"], score: "good", text: "Thêm controller ở Interface Adapters + server gRPC ở Frameworks, gọi lại Use Case." },
        vslice: { touch: ["s1", "s2", "s3"], score: "mid", text: "Endpoint nằm trong từng slice nên phải thêm endpoint gRPC cho mỗi slice (hoặc tách handler khỏi endpoint trước)." } } },
      { label: "Unit test luật giảm giá, không dựng DB", res: {
        layered: { touch: ["biz", "data", "db"], score: "bad", text: "Service gọi repository cụ thể → test phải dựng DB hoặc mock sâu vào ORM. Test chậm và vỡ khi đổi query." },
        hex: { touch: ["core", "mem"], score: "good", text: "Cắm adapter in-memory vào port rồi test use case; chạy vài mili-giây, không cần container DB." },
        onion: { touch: ["dm", "ds"], score: "good", text: "Luật nằm ở Domain Model / Domain Services — code thuần, test trực tiếp." },
        clean: { touch: ["ent", "uc"], score: "good", text: "Test Entities và Use Case với gateway giả; không framework nào tham gia." },
        vslice: { touch: ["s1"], score: "mid", text: "Tuỳ cách viết slice: handler gọi thẳng DB thì cần DB khi test; tách luật thành hàm thuần thì test dễ." } } },
      { label: "Thêm tính năng: áp mã giảm giá", res: {
        layered: { touch: ["pres", "biz", "data"], score: "mid", text: "Chạm cả 3 tầng (controller, service, repository) — thay đổi cắt ngang, dễ đụng code tính năng khác dùng chung `OrderService`." },
        hex: { touch: ["core", "portIn", "rest", "pg"], score: "mid", text: "Thêm use case + port + mở rộng adapter. Nhiều file và mapping, nhưng mỗi phần có chỗ rõ ràng." },
        onion: { touch: ["ds", "as", "infra"], score: "mid", text: "Thêm luật ở Domain Services, điều phối ở Application Services, và phần API/infra tương ứng." },
        clean: { touch: ["uc", "ent", "ia"], score: "mid", text: "Thêm interactor, request/response model, controller/presenter — nhiều boilerplate cho một tính năng." },
        vslice: { touch: ["snew"], score: "good", text: "Thêm thư mục `features/apply_coupon/` chứa đủ endpoint, handler, query. **Không chạm slice nào khác.**" } } },
      { label: "App CRUD nhỏ, 2 dev, 1 tháng", res: {
        layered: { touch: [], score: "good", text: "Vừa đủ: framework sinh sẵn các tầng, ship nhanh, ai cũng hiểu." },
        hex: { touch: [], score: "bad", text: "Chi phí chưa đáng: port + adapter + mapping cho mỗi bảng làm chậm tốc độ mà chưa đem lại lợi ích." },
        onion: { touch: [], score: "bad", text: "Bốn vòng cho một app CRUD là thừa." },
        clean: { touch: [], score: "bad", text: "Over-engineering điển hình: interactor, presenter, DTO cho từng form." },
        vslice: { touch: [], score: "good", text: "Mỗi màn hình một slice nhỏ, ít khái niệm, ship nhanh." } } },
    ],
  },
  {
    id: "sys-arch-impact", custom: "arch", title: "5 kiến trúc hệ thống × tình huống vận hành", topics: ["system-architecture"],
    scenario: "Cùng một shop có Order, Payment, Inventory, Recommendation. Chọn kiến trúc rồi chọn tình huống để thấy **phần nào bị ảnh hưởng** (tô đỏ) và đánh giá.",
    options: [
      { id: "mono", label: "Monolith", h: 320,
        idea: "Một ứng dụng, một lần deploy, một DB; module gọi nhau tự do bằng hàm.",
        pro: "Đơn giản nhất: debug, transaction, deploy đều dễ.",
        con: "Lớn lên thì rối; scale cả khối; một lỗi kéo sập tất cả.",
        blocks: [
          { id: "app", x: 80, y: 16, w: 640, h: 190, label: "1 ứng dụng · 1 lần deploy", top: true },
          { id: "order", x: 105, y: 84, w: 135, h: 64, label: "Order" },
          { id: "pay", x: 255, y: 84, w: 135, h: 64, label: "Payment" },
          { id: "inv", x: 405, y: 84, w: 135, h: 64, label: "Inventory" },
          { id: "rec", x: 555, y: 84, w: 140, h: 64, label: "Recommendation" },
          { id: "db", x: 270, y: 236, w: 260, h: 60, label: "1 Database", sub: "mọi bảng dùng chung", kind: "infra" },
        ],
        arrows: [[240, 116, 405, 110], [390, 128, 555, 128], [555, 100, 240, 100], [400, 206, 400, 234]],
        caption: "module gọi chéo nhau trực tiếp" },
      { id: "modular", label: "Modular Monolith", h: 320,
        idea: "Vẫn một deployable, nhưng mỗi module có API nội bộ và schema riêng; không gọi tắt vào nội bộ nhau.",
        pro: "Giữ được độ đơn giản của monolith, có sẵn ranh giới để tách service sau này.",
        con: "Cần kỷ luật giữ ranh giới; vẫn deploy và scale chung.",
        blocks: [
          { id: "app", x: 80, y: 16, w: 640, h: 190, label: "1 ứng dụng · module có ranh giới", top: true },
          { id: "order", x: 105, y: 84, w: 135, h: 64, label: "Order", sub: "API nội bộ" },
          { id: "pay", x: 255, y: 84, w: 135, h: 64, label: "Payment", sub: "API nội bộ" },
          { id: "inv", x: 405, y: 84, w: 135, h: 64, label: "Inventory", sub: "API nội bộ" },
          { id: "rec", x: 555, y: 84, w: 140, h: 64, label: "Recommendation", sub: "API nội bộ" },
          { id: "db", x: 230, y: 236, w: 340, h: 60, label: "1 Database", sub: "schema riêng cho mỗi module", kind: "infra" },
        ],
        arrows: [[240, 116, 253, 116], [390, 116, 403, 116], [400, 206, 400, 234]],
        caption: "chỉ gọi qua API của module" },
      { id: "micro", label: "Microservices", h: 330,
        idea: "Mỗi service một nghiệp vụ, deploy riêng, **sở hữu DB riêng**, gọi nhau qua mạng.",
        pro: "Scale riêng phần nóng; team deploy độc lập; lỗi được cô lập.",
        con: "Phức tạp phân tán: network, latency, saga, observability, platform.",
        blocks: [
          { id: "gw", x: 20, y: 140, w: 130, h: 50, label: "API Gateway" },
          { id: "order", x: 220, y: 14, w: 160, h: 56, label: "Order service" },
          { id: "pay", x: 220, y: 94, w: 160, h: 56, label: "Payment service" },
          { id: "inv", x: 220, y: 174, w: 160, h: 56, label: "Inventory service" },
          { id: "rec", x: 220, y: 254, w: 160, h: 56, label: "Reco service" },
          { id: "dbo", x: 450, y: 14, w: 130, h: 56, label: "Order DB", kind: "infra" },
          { id: "dbp", x: 450, y: 94, w: 130, h: 56, label: "Payment DB", kind: "infra" },
          { id: "dbi", x: 450, y: 174, w: 130, h: 56, label: "Inventory DB", kind: "infra" },
          { id: "dbr", x: 450, y: 254, w: 130, h: 56, label: "Reco DB", kind: "infra" },
        ],
        arrows: [[150, 160, 218, 42], [150, 163, 218, 122], [150, 167, 218, 202], [150, 172, 218, 282], [380, 42, 448, 42], [380, 122, 448, 122], [380, 202, 448, 202], [380, 282, 448, 282]],
        caption: "mỗi service một DB, gọi nhau qua mạng" },
      { id: "event", label: "Event-driven", h: 330,
        idea: "Service phát event lên broker; service khác tự nghe và phản ứng, không gọi trực tiếp.",
        pro: "Lỏng lẻo; thêm consumer không sửa producer; hấp thụ đột biến.",
        con: "Luồng khó theo dõi; eventual consistency; phải xử lý trùng và thứ tự.",
        blocks: [
          { id: "order", x: 40, y: 14, w: 160, h: 56, label: "Order" },
          { id: "pay", x: 40, y: 94, w: 160, h: 56, label: "Payment" },
          { id: "inv", x: 40, y: 174, w: 160, h: 56, label: "Inventory" },
          { id: "rec", x: 40, y: 254, w: 160, h: 56, label: "Recommendation" },
          { id: "bus", x: 320, y: 14, w: 140, h: 296, label: "Event bus", sub: "Kafka", kind: "infra" },
          { id: "email", x: 580, y: 40, w: 170, h: 56, label: "Email" },
          { id: "analytics", x: 580, y: 140, w: 170, h: 56, label: "Analytics" },
          { id: "search", x: 580, y: 240, w: 170, h: 56, label: "Search indexer" },
        ],
        arrows: [[200, 42, 318, 42, "OrderPlaced"], [200, 122, 318, 122], [200, 202, 318, 202], [200, 282, 318, 282], [460, 68, 578, 68], [460, 168, 578, 168], [460, 268, 578, 268]],
        caption: "giao tiếp qua event, không gọi trực tiếp" },
      { id: "serverless", label: "Serverless", h: 330,
        idea: "Mỗi chức năng là một function; nền tảng lo server và scale theo request.",
        pro: "Không quản server; trả theo lượt chạy; scale về 0.",
        con: "Cold start, giới hạn thời gian chạy, lock-in, đắt khi tải cao liên tục.",
        blocks: [
          { id: "client", x: 10, y: 140, w: 100, h: 50, label: "Client" },
          { id: "apigw", x: 140, y: 140, w: 130, h: 50, label: "API Gateway" },
          { id: "fo", x: 320, y: 14, w: 160, h: 56, label: "λ order" },
          { id: "fp", x: 320, y: 94, w: 160, h: 56, label: "λ payment" },
          { id: "fi", x: 320, y: 174, w: 160, h: 56, label: "λ inventory" },
          { id: "fr", x: 320, y: 254, w: 160, h: 56, label: "λ reco" },
          { id: "ddb", x: 580, y: 40, w: 170, h: 56, label: "DynamoDB", kind: "infra" },
          { id: "sqs", x: 580, y: 140, w: 170, h: 56, label: "SQS", kind: "infra" },
          { id: "s3", x: 580, y: 240, w: 170, h: 56, label: "S3", kind: "infra" },
        ],
        arrows: [[110, 165, 138, 165], [270, 160, 318, 42], [270, 163, 318, 122], [270, 167, 318, 202], [270, 172, 318, 282], [480, 42, 578, 68], [480, 202, 578, 168], [480, 282, 578, 268]],
        caption: "function + dịch vụ managed" },
    ],
    scenarios: [
      { label: "Black Friday: checkout tăng tải 10×", res: {
        mono: { touch: ["app", "db"], score: "bad", text: "Phải nhân **cả khối** ứng dụng (kể cả Recommendation không cần thêm), DB chung thành nút cổ chai." },
        modular: { touch: ["app", "db"], score: "mid", text: "Vẫn nhân cả deployable, nhưng module Order đã có ranh giới rõ nên tách ra service được nếu cần." },
        micro: { touch: ["order", "pay", "dbo", "dbp"], score: "good", text: "Chỉ scale Order, Payment và DB của chúng; Inventory, Reco giữ nguyên." },
        event: { touch: ["order", "pay", "bus"], score: "good", text: "Order/Payment scale riêng; bus hấp thụ đột biến, consumer phía sau xử lý dần." },
        serverless: { touch: ["fo", "fp"], score: "good", text: "Function tự scale theo request; cần để ý giới hạn concurrency và DB phía sau." } } },
      { label: "Sửa một dòng ở Payment rồi deploy", res: {
        mono: { touch: ["app"], score: "bad", text: "Build, test, deploy lại **toàn bộ** ứng dụng; một lỗi nhỏ có thể ảnh hưởng mọi module." },
        modular: { touch: ["app", "pay"], score: "mid", text: "Vẫn deploy cả khối, nhưng có thể khoanh vùng test theo module Payment." },
        micro: { touch: ["pay"], score: "good", text: "Deploy riêng Payment service; các team khác không bị chặn." },
        event: { touch: ["pay"], score: "good", text: "Deploy riêng Payment, miễn schema event giữ tương thích ngược." },
        serverless: { touch: ["fp"], score: "good", text: "Deploy riêng một function." } } },
      { label: "Recommendation bị memory leak", res: {
        mono: { touch: ["app", "order", "pay", "inv", "rec"], score: "bad", text: "Cùng một process: leak làm **OOM cả ứng dụng**, checkout cũng chết." },
        modular: { touch: ["app", "order", "pay", "inv", "rec"], score: "bad", text: "Ranh giới module không cô lập bộ nhớ — vẫn cùng process, vẫn chết chung." },
        micro: { touch: ["rec"], score: "good", text: "Chỉ Reco service bị restart; checkout vẫn chạy nếu gọi Reco có timeout + fallback." },
        event: { touch: ["rec"], score: "good", text: "Chỉ Recommendation chết; event chờ trong bus, xử lý lại khi nó lên." },
        serverless: { touch: ["fr"], score: "good", text: "Leak nằm trong execution environment của λ reco, không lan sang function khác. Lambda tái dùng environment khi warm nên leak vẫn tích luỹ tới khi environment bị thu hồi." } } },
      { label: "Đặt hàng phải trừ kho cùng transaction", res: {
        mono: { touch: ["db"], score: "good", text: "Một ACID transaction trong cùng DB: đơn giản và đúng." },
        modular: { touch: ["order", "inv", "db"], score: "good", text: "Vẫn cùng DB nên dùng transaction được (cẩn thận giữ ranh giới module)." },
        micro: { touch: ["order", "inv", "dbo", "dbi"], score: "bad", text: "Hai DB khác nhau → **không có transaction chung**; phải dùng Saga + compensating action, chấp nhận eventual consistency." },
        event: { touch: ["order", "inv", "bus"], score: "mid", text: "Saga kiểu choreography qua event: đúng sau cùng nhưng khó theo dõi và debug." },
        serverless: { touch: ["fo", "fi", "ddb"], score: "mid", text: "Dùng `TransactWriteItems` của DynamoDB (nhiều bảng, cùng account và region), hoặc Step Functions điều phối saga." } } },
      { label: "Team 5 người, sản phẩm mới", res: {
        mono: { touch: [], score: "good", text: "Nhanh nhất để ra sản phẩm và đổi hướng khi chưa rõ nghiệp vụ." },
        modular: { touch: [], score: "good", text: "Gần như nhanh bằng monolith, lại có sẵn ranh giới cho sau này — **lựa chọn khuyến nghị**." },
        micro: { touch: ["gw", "order", "pay", "inv", "rec"], score: "bad", text: "Chi phí vận hành (CI/CD từng service, observability, network, saga) lớn hơn lợi ích với 5 người." },
        event: { touch: ["bus"], score: "mid", text: "Thêm broker và eventual consistency khi chưa cần." },
        serverless: { touch: [], score: "mid", text: "Ra nhanh, ít vận hành; cẩn thận lock-in và chi phí khi tải tăng đều." } } },
      { label: "40 team cùng phát triển", res: {
        mono: { touch: ["app"], score: "bad", text: "Merge conflict, deploy xếp hàng; một team làm hỏng cả release của mọi người." },
        modular: { touch: ["app"], score: "mid", text: "Ranh giới module giúp chia việc, nhưng vẫn chung một pipeline deploy." },
        micro: { touch: [], score: "good", text: "Mỗi team sở hữu và deploy service của mình — khớp Conway’s Law." },
        event: { touch: [], score: "good", text: "Team thêm consumer mới mà không phải phối hợp với producer." },
        serverless: { touch: [], score: "mid", text: "Deploy độc lập theo function nhưng dễ thành hàng trăm function khó quản lý." } } },
    ],
  },
  {
    id: "tdd-codewalk", custom: "code", title: "TDD, BDD, property-based: đi từng bước với code", topics: ["dev-methods"],
    scenario: "Cùng một luật nghiệp vụ: **đơn dưới 500.000đ tính phí ship 30.000đ, từ 500.000đ miễn phí**. So sánh ba cách viết test và code. Dòng vừa thêm được tô sáng.",
    variants: [
      { name: "TDD: Red → Green → Refactor", steps: [
        { phase: "red", title: "Viết test đầu tiên trước khi có code",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000" },
                  { name: "shipping.py", role: "impl", code: "# chưa có gì" }],
          run: { ok: false, out: "ImportError: cannot import name 'shipping_fee'\n1 failed" },
          note: "Viết **một** test nhỏ mô tả hành vi mong muốn trước khi có code. Chạy và thấy **đỏ** là bắt buộc: nó chứng minh test thật sự kiểm tra điều gì đó. Một test chưa từng đỏ có thể luôn xanh kể cả khi code sai." },
        { phase: "green", title: "Code tối thiểu để test xanh",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000" },
                  { name: "shipping.py", role: "impl", code: "def shipping_fee(total):\n    return 30_000" }],
          run: { ok: true, out: "1 passed" },
          note: "Trả hằng số nghe như gian lận, nhưng nó buộc bạn **chỉ viết code mà test đòi hỏi**. Các test tiếp theo sẽ “ép” logic thật ra → không có code thừa mà không test nào kiểm tra." },
        { phase: "red", title: "Test thứ hai ở đúng giá trị biên",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0" },
                  { name: "shipping.py", role: "impl", code: "def shipping_fee(total):\n    return 30_000" }],
          run: { ok: false, out: "assert 30000 == 0\n1 failed, 1 passed" },
          note: "Test mới mô tả luật thứ hai và chọn **giá trị biên** 500.000 — nơi bug hay nằm nhất. Test đỏ vì code hằng số không xử lý được — đó chính là lý do để thêm logic." },
        { phase: "green", title: "Thêm đúng nhánh mà test đòi hỏi",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0" },
                  { name: "shipping.py", role: "impl", code: "def shipping_fee(total):\n    if total >= 500_000:\n        return 0\n    return 30_000" }],
          run: { ok: true, out: "2 passed" },
          note: "Test cũ vẫn xanh. Nó là **lưới an toàn**: xác nhận thay đổi mới không phá hành vi đã có — đúng thứ bạn cần khi codebase lớn dần." },
        { phase: "refactor", title: "Dọn code khi đang xanh",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0" },
                  { name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: true, out: "2 passed" },
          note: "Đặt tên cho “số ma thuật”, **không thêm hành vi mới**. Test đỏ sau refactor → bạn vừa vô tình đổi hành vi, quay lại ngay. Lợi ích lớn nhất của TDD: dám refactor vì có test bảo vệ." },
        { phase: "red", title: "Nghĩ tới input xấu",
          files: [{ name: "test_shipping.py", role: "test", code: "import pytest\nfrom shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0\n\ndef test_negative_total_is_rejected():\n    with pytest.raises(ValueError):\n        shipping_fee(-1)" },
                  { name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: false, out: "Failed: DID NOT RAISE ValueError\n1 failed, 2 passed" },
          note: "Tổng tiền âm là dữ liệu sai. Viết test trước buộc bạn nghĩ về input xấu **lúc thiết kế**, thay vì phát hiện trên production." },
        { phase: "green", title: "Ba test thành đặc tả sống",
          files: [{ name: "test_shipping.py", role: "test", code: "import pytest\nfrom shipping import shipping_fee\n\ndef test_order_under_500k_pays_30k():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_free_shipping_from_500k():\n    assert shipping_fee(500_000) == 0\n\ndef test_negative_total_is_rejected():\n    with pytest.raises(ValueError):\n        shipping_fee(-1)" },
                  { name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total < 0:\n        raise ValueError(\"total must be >= 0\")\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: true, out: "3 passed" },
          note: "Đọc ba test là biết luật ship. Lần sau ai đổi ngưỡng 500.000 sẽ thấy test đỏ và biết mình đang **đổi luật nghiệp vụ**, không phải sửa nhầm. Cái giá: viết chậm hơn lúc đầu, và test quá gắn implementation sẽ phải sửa theo khi refactor lớn." },
      ] },
      { name: "BDD: Given / When / Then", steps: [
        { phase: "spec", title: "Viết kịch bản cùng PO và QA",
          files: [{ name: "free_shipping.feature", role: "spec", code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ" }],
          note: "BDD bắt đầu từ **cuộc trò chuyện** giữa PO, QA và dev (“three amigos”). Kịch bản viết bằng ngôn ngữ nghiệp vụ nên ai trong team cũng đọc và góp ý được — và nó chạy được như một test." },
        { phase: "red", title: "Nối từng dòng với step definition",
          files: [{ name: "free_shipping.feature", role: "spec", code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ" },
                  { name: "test_free_shipping.py", role: "test", code: "from pytest_bdd import scenarios, given, when, then, parsers\nfrom shop import Cart, place_order\n\nscenarios(\"free_shipping.feature\")\n\n@given(parsers.parse(\"giỏ hàng có tổng {total:d}.000đ\"), target_fixture=\"cart\")\ndef cart(total):\n    return Cart(total * 1000)\n\n@when(\"khách thanh toán\", target_fixture=\"order\")\ndef checkout(cart):\n    return place_order(cart)\n\n@then(parsers.parse(\"phí ship là {fee:d}đ\"))\ndef check_fee(order, fee):\n    assert order.shipping_fee == fee" }],
          run: { ok: false, out: "ImportError: cannot import name 'Cart' from 'shop'\n1 failed" },
          note: "Mỗi dòng Given/When/Then nối với một **step definition** gọi vào hệ thống thật qua use case `place_order`. Kịch bản kiểm tra **hành vi nhìn từ ngoài**, không kiểm tra hàm nội bộ — nên refactor bên trong không làm vỡ nó." },
        { phase: "green", title: "Hiện thực domain cho kịch bản xanh",
          files: [{ name: "free_shipping.feature", role: "spec", code: "Feature: Phí vận chuyển\n\n  Scenario: Đơn từ 500.000đ được miễn phí ship\n    Given giỏ hàng có tổng 600.000đ\n    When khách thanh toán\n    Then phí ship là 0đ" },
                  { name: "shop.py", role: "impl", code: "from dataclasses import dataclass\nfrom shipping import shipping_fee\n\n@dataclass\nclass Cart:\n    total: int\n\n@dataclass\nclass Order:\n    total: int\n    shipping_fee: int\n\ndef place_order(cart):\n    return Order(cart.total, shipping_fee(cart.total))" }],
          run: { ok: true, out: "1 passed  (Scenario: Đơn từ 500.000đ được miễn phí ship)" },
          note: "Đây là **double-loop**: vòng ngoài là kịch bản BDD mô tả hành vi, vòng trong là các unit test nhỏ — bên trong, `shipping_fee` vẫn viết bằng TDD." },
        { phase: "spec", title: "Bảng ví dụ do business tự thêm",
          files: [{ name: "free_shipping.feature", role: "spec", code: "Feature: Phí vận chuyển\n\n  Scenario Outline: Phí ship theo tổng đơn\n    Given giỏ hàng có tổng <total>.000đ\n    When khách thanh toán\n    Then phí ship là <fee>đ\n\n    Examples:\n      | total | fee   |\n      | 200   | 30000 |\n      | 499   | 30000 |\n      | 500   | 0     |" }],
          run: { ok: true, out: "3 passed" },
          note: "PO tự thêm được dòng vào bảng `Examples` để đặc tả thêm trường hợp, không cần sửa code test. Cái giá: phải duy trì file feature lẫn step definition, và test chạy qua nhiều lớp nên chậm hơn unit test." },
      ] },
      { name: "Property-based: để máy tìm edge case", steps: [
        { phase: "run", title: "Example test xanh nhưng code có bug",
          files: [{ name: "test_shipping.py", role: "test", code: "from shipping import shipping_fee\n\ndef test_small_order():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_big_order():\n    assert shipping_fee(600_000) == 0" },
                  { name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total > FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: true, out: "2 passed" },
          note: "Code dùng `>` thay vì `>=`: đơn đúng 500.000đ vẫn bị tính phí. Hai example test đều xanh vì không ai chọn đúng giá trị biên — bug lọt qua code review và CI." },
        { phase: "red", title: "Khai báo tính chất luôn đúng",
          files: [{ name: "test_shipping.py", role: "test", code: "from hypothesis import given, strategies as st\nfrom shipping import shipping_fee\n\ndef test_small_order():\n    assert shipping_fee(200_000) == 30_000\n\ndef test_big_order():\n    assert shipping_fee(600_000) == 0\n\n@given(st.integers(min_value=0, max_value=10_000_000))\ndef test_fee_rule_holds_for_any_total(total):\n    fee = shipping_fee(total)\n    assert fee in (0, 30_000)\n    if total >= 500_000:\n        assert fee == 0" },
                  { name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total > FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: false, out: "Falsifying example: test_fee_rule_holds_for_any_total(total=500000)\nAssertionError\n1 failed, 2 passed" },
          note: "Thay vì chọn ví dụ, khai báo **tính chất đúng với mọi tổng tiền**. Hypothesis sinh hàng trăm giá trị; gặp lỗi thì **thu gọn (shrink)** về ví dụ nhỏ nhất làm hỏng — ở đây chính là 500000, giá trị biên chứa bug." },
        { phase: "green", title: "Sửa bug, property xanh",
          files: [{ name: "shipping.py", role: "impl", code: "FREE_SHIPPING_FROM = 500_000\nFLAT_FEE = 30_000\n\ndef shipping_fee(total):\n    if total >= FREE_SHIPPING_FROM:\n        return 0\n    return FLAT_FEE" }],
          run: { ok: true, out: "3 passed" },
          note: "Hypothesis lưu ví dụ từng làm hỏng vào database cục bộ và chạy lại nó đầu tiên ở lần sau → bug không lặng lẽ quay lại. Cái giá: nghĩ ra property đúng khó hơn viết ví dụ, và test chạy lâu hơn." },
      ] },
    ],
  },
  {
    id: "token-bucket", custom: "bucket", title: "Token bucket tương tác", topics: ["api-design"],
    scenario: "Thuật toán rate limit phổ biến nhất: cho phép burst có kiểm soát, chặn khi vượt tốc độ trung bình.",
  },
  {
    id: "binary-search", custom: "binary", title: "Binary search từng bước", topics: ["algo", "bigo"],
    scenario: "Mỗi bước so sánh phần tử giữa rồi loại bỏ một nửa khoảng tìm kiếm.",
    array: [3, 7, 12, 18, 21, 29, 34, 40, 46, 53, 58, 64, 71, 77, 85, 92],
    missing: 50,
  },
];
