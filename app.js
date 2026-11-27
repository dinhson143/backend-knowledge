(function () {
  const $ = (s) => document.querySelector(s);
  const main = $("#main");
  const sidebar = $("#sidebar");

  // ── Index: nội dung (TRACKS) + thứ tự học (ROADMAP) ──
  const ALL = [];
  window.TRACKS.forEach((tr) => tr.sections.forEach((sec) => sec.topics.forEach((tp) => ALL.push({ ...tp, track: tr }))));
  const byId = Object.fromEntries(ALL.map((t) => [t.id, t]));
  const STAGES = window.ROADMAP.map((s) => ({ ...s, topics: (s.topics || []).filter((id) => byId[id]) }));
  const listed = new Set(STAGES.flatMap((s) => s.topics));
  const orphans = ALL.filter((t) => !listed.has(t.id)).map((t) => t.id);
  if (orphans.length) STAGES.push({ id: "other", title: "Khác", goal: "", topics: orphans, parallel: true });
  STAGES.forEach((s) => s.topics.forEach((id) => (byId[id].stage = s)));
  // Thứ tự đọc: giai đoạn chính trước, nhánh song song sau
  const ORDER = [...STAGES.filter((s) => !s.parallel), ...STAGES.filter((s) => s.parallel)].flatMap((s) => s.topics.map((id) => byId[id]));

  const SIMS = window.SIMS || [];
  const simById = Object.fromEntries(SIMS.map((s) => [s.id, s]));
  const simsFor = (id) => SIMS.filter((s) => s.topics.includes(id));
  const LEVELS = { 1: "Khởi động", 2: "Trung bình", 3: "Nâng cao" };
  const PROBLEMS = (window.PROBLEMS || []).slice().sort((a, b) => a.level - b.level);
  const pById = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const problemsFor = (id) => PROBLEMS.filter((p) => p.topics.includes(id));

  // ── Tiến độ (best effort) ──
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const done = new Set(store.get("ip.done", []));
  const toggleDone = (key) => { done.has(key) ? done.delete(key) : done.add(key); store.set("ip.done", [...done]); };

  // ── Theme & mobile menu ──
  const theme = store.get("ip.theme", null);
  if (theme) document.documentElement.dataset.theme = theme;
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("ip.theme", next);
  };
  $("#menuBtn").onclick = () => sidebar.classList.toggle("open");
  main.addEventListener("click", () => sidebar.classList.remove("open"));

  // ── Helpers ──
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // ── Thuật ngữ: gắn tooltip cho từ viết tắt (bỏ qua phần trong `code`) ──
  const GL = {};
  (window.GLOSSARY || []).forEach((g) => g.items.forEach(([k, full, vi, ex]) => (GL[k] = { k, full, vi, ex, group: g.group })));
  const glRe = new RegExp(`(?<![\\w.])(${Object.keys(GL).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w])`, "g");
  // Lần đầu một từ viết tắt xuất hiện trên trang: ghi luôn tên đầy đủ ngay trong câu
  let glSeen = null;
  const glossify = (html) => html.replace(glRe, (m) => {
    const tag = `<abbr class="g" tabindex="0" data-g="${m}">${m}</abbr>`;
    if (!glSeen || glSeen.has(m)) return tag;
    glSeen.add(m);
    return `${tag}<span class="g-full"> (${esc(GL[m].full)})</span>`;
  });
  const plain = (s) => { const keep = glSeen; glSeen = null; try { return inline(s); } finally { glSeen = keep; } };
  const inline = (s) => esc(s).split(/(`[^`]+`)/).map((part) => (/^`[^`]+`$/.test(part) ? `<code>${part.slice(1, -1)}</code>` : glossify(part))).join("")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  window.glossInline = inline;
  const tagged = (s) => {
    if (s.startsWith("+ ")) return `<span class="tag added">Bổ sung</span>${inline(s.slice(2))}`;
    if (s.startsWith("! ")) return `<span class="tag fix">Đính chính</span>${inline(s.slice(2))}`;
    return inline(s);
  };
  // Giải thích "vì sao" (why.js) gắn theo index; thiếu thì chỉ hiện nội dung gốc
  const whyMap = (arr, k = "i") => Object.fromEntries((arr || []).map((w) => [w[k], w.why]));
  const whyLine = (w) => (w ? `<div class="why"><b>Vì sao</b>${inline(w)}</div>` : "");
  const table = (t, whys = {}) => !t ? "" : `<div class="table-wrap"><table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r, ri) => `<tr class="${whys[ri] ? "has-why" : ""}">${r.map((c) => `<td>${tagged(c)}</td>`).join("")}</tr>` +
      (whys[ri] ? `<tr class="why-row"><td colspan="${r.length}">${whyLine(whys[ri])}</td></tr>` : "")).join("")}</tbody></table></div>`;
  const points = (ps, whys = {}) => !ps || !ps.length ? "" : `<div class="panel"><ul class="points">${ps.map((p, i) => `<li>${tagged(p)}${whyLine(whys[i])}</li>`).join("")}</ul></div>`;
  const WHY = window.WHY || {}, PWHY = window.PWHY || {};
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const simBox = (sim) => `<div class="panel sim-box" id="sim-${sim.id}"></div>`;
  const mountAll = (sims) => sims.forEach((sim) => window.mountSim(document.getElementById(`sim-${sim.id}`), sim));
  const levelBadge = (l) => `<span class="lvl lvl-${l}">${LEVELS[l]}</span>`;
  const stageKeys = (s) => (s.problems ? PROBLEMS.map((p) => `p:${p.id}`) : s.topics);
  const stageNum = (s) => (s.parallel ? "∥" : STAGES.filter((x) => !x.parallel).indexOf(s) + 1);

  // Hộp "Viết tắt trong bài này" chèn sau phần mở đầu của trang
  function abbrBox(after) {
    const keys = [...new Set([...main.querySelectorAll("abbr.g")].map((a) => a.dataset.g))].sort();
    if (!keys.length || !after) return;
    const d = document.createElement("details");
    d.className = "panel abbr-box";
    d.open = keys.length <= 8;
    d.innerHTML = `<summary>Viết tắt trong bài này (${keys.length})</summary><div class="abbr-grid">${keys.map((k) => `<div><b>${esc(k)}</b> <span class="muted">${esc(GL[k].full)}</span><br>${plain(GL[k].vi)}</div>`).join("")}</div>`;
    after.insertAdjacentElement("afterend", d);
  }

  // Tooltip dùng chung, đặt fixed để không bị cắt bởi bảng cuộn ngang
  const tip = document.createElement("div");
  tip.id = "gtip";
  document.body.appendChild(tip);
  function showTip(el) {
    const g = GL[el.dataset.g];
    if (!g) return;
    tip.innerHTML = `<b>${esc(g.k)}</b> · ${esc(g.full)}<div>${plain(g.vi).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")}</div>${g.ex ? `<div class="ex">Ví dụ: ${plain(g.ex).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")}</div>` : ""}`;
    tip.classList.add("on");
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8}px`;
  }
  const hideTip = () => tip.classList.remove("on");
  document.addEventListener("mouseover", (e) => { const a = e.target.closest("abbr.g"); if (a) showTip(a); });
  document.addEventListener("mouseout", (e) => { if (e.target.closest("abbr.g")) hideTip(); });
  document.addEventListener("focusin", (e) => { const a = e.target.closest("abbr.g"); if (a) showTip(a); });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  // ── Sidebar theo ngữ cảnh ──
  function sideKnowledge(active) {
    return STAGES.filter((s) => !s.problems).map((s) => `
      <div class="sb-track">
        <div class="sb-track-title">${stageNum(s)} · ${esc(s.title)}</div>
        ${s.topics.map((id) => `<a class="sb-topic ${id === active ? "active" : ""}" href="#/t/${id}">
          <span class="sb-dot ${done.has(id) ? "done" : ""}"></span>${esc(byId[id].title)}</a>`).join("")}
      </div>`).join("");
  }
  function sideProblems(active) {
    return `<div class="sb-track"><a class="sb-topic ${active === "all" ? "active" : ""}" href="#/problems"><span class="sb-dot"></span>Tất cả bài & cách luyện</a></div>` +
      [1, 2, 3].map((l) => `<div class="sb-track"><div class="sb-track-title">${LEVELS[l]}</div>
        ${PROBLEMS.filter((p) => p.level === l).map((p) => `<a class="sb-topic ${active === p.id ? "active" : ""}" href="#/p/${p.id}">
          <span class="sb-dot ${done.has(`p:${p.id}`) ? "done" : ""}"></span>${esc(p.title)}</a>`).join("")}</div>`).join("");
  }
  function setNav(mode, side) {
    glSeen = mode === "glossary" ? null : new Set();
    document.querySelectorAll(".modes a").forEach((a) => a.classList.toggle("active", a.dataset.mode === mode));
    sidebar.innerHTML = side;
    sidebar.classList.remove("open");
    window.scrollTo(0, 0);
  }

  // ── Lộ trình (trang chủ) ──
  function viewHome() {
    setNav("home", sideKnowledge(null));
    const tDone = ALL.filter((t) => done.has(t.id)).length;
    const pDone = PROBLEMS.filter((p) => done.has(`p:${p.id}`)).length;
    const nextTopic = ORDER.find((t) => !done.has(t.id));
    main.innerHTML = `
      <h1>Lộ trình ôn System Design & Backend</h1>
      <p class="lead">Học theo giai đoạn 1 → 5; Low-Level Design và DSA học song song. Mọi chủ đề dùng chung một khung nên ôn lại nhanh.</p>

      <div class="kpis kpis-3">
        <div class="panel kpi"><div class="n">${tDone}/${ALL.length}</div><div class="l">Chủ đề đã nắm</div><div class="bar"><i style="width:${pct(tDone, ALL.length)}%"></i></div></div>
        <div class="panel kpi"><div class="n">${pDone}/${PROBLEMS.length}</div><div class="l">Bài đã luyện</div><div class="bar"><i style="width:${pct(pDone, PROBLEMS.length)}%"></i></div></div>
        <a class="panel kpi kpi-next" href="${nextTopic ? `#/t/${nextTopic.id}` : "#/problems"}"><div class="l">Học tiếp</div><div class="n-sm">${esc(nextTopic ? nextTopic.title : "Luyện bài")} →</div></a>
      </div>

      <div class="method panel">
        <div><b>Cách ôn một chủ đề</b><ol><li>Đọc “Nói trong 30 giây”</li><li>Chạy mô phỏng</li><li>Đọc kiến thức cốt lõi</li><li>Tự trả lời phần Tự kiểm tra</li><li>Xem chủ đề dùng trong bài nào, rồi đánh dấu đã nắm</li></ol></div>
        <div><b>Cách luyện một bài</b><ol><li>Đọc đề, chưa xem lời giải</li><li>Tự nói Requirements → Entities → API → HLD trong 15–20 phút</li><li>So với HLD mẫu, chạy từng luồng</li><li>Trả lời Deep Dives trước khi mở 3 mức đáp án</li></ol></div>
      </div>

      <div class="roadmap">
        ${STAGES.map((s) => {
          const keys = stageKeys(s), d = keys.filter((k) => done.has(k)).length;
          const items = s.problems
            ? PROBLEMS.map((p) => `<a class="rm-chip ${done.has(`p:${p.id}`) ? "done" : ""}" href="#/p/${p.id}">${esc(p.title.split(" (")[0])}</a>`).join("")
            : s.topics.map((id) => `<a class="rm-chip ${done.has(id) ? "done" : ""}" href="#/t/${id}">${esc(byId[id].title)}</a>`).join("");
          return `<div class="rm-stage ${s.parallel ? "parallel" : ""} ${d === keys.length ? "complete" : ""}">
            <div class="rm-num">${stageNum(s)}</div>
            <div class="rm-body">
              <div class="rm-head"><h3>${esc(s.title)}</h3><span class="muted">${d}/${keys.length}</span></div>
              <p class="muted">${esc(s.goal)}</p>
              <div class="rm-chips">${items}</div>
            </div>
          </div>`;
        }).join("")}
      </div>

      <details class="panel scope">
        <summary>Nguồn & phạm vi nội dung</summary>
        <p class="muted">Hệ thống hoá từ Miro board <em>Backend</em> (mindmap “CS”, 512 node), sắp theo Hello Interview. Nhãn <span class="tag added">Bổ sung</span> là phần Miro chưa có; <span class="tag fix">Đính chính</span> là chỗ Miro dễ hiểu sai.</p>
        <h3>So với Hello Interview</h3>
        <div class="table-wrap"><table><thead><tr><th>Mảng</th><th>Hello Interview</th><th>Ở đây</th><th>Còn thiếu</th></tr></thead>
          <tbody>${window.HI_GAPS.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <h3>Nhánh trống trên Miro đã bổ sung</h3>
        <div class="table-wrap"><table><thead><tr><th>Node</th><th>Ghi chú</th></tr></thead>
          <tbody>${window.MIRO_GAPS.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
      </details>`;
  }

  // ── Trang chủ đề: khung cố định ──
  function viewTopic(id) {
    const t = byId[id];
    if (!t) return viewHome();
    setNav("learn", sideKnowledge(id));
    const i = ORDER.indexOf(t), prev = ORDER[i - 1], next = ORDER[i + 1];
    const sims = simsFor(id);
    const related = (t.related || []).map((sid) => simById[sid]).filter(Boolean);
    const probs = problemsFor(id);
    let n = 0;
    const h = (title) => `<h2><span class="h-n">${++n}</span>${esc(title)}</h2>`;
    const W = WHY[id] || {};
    const secW = (si) => (W.sections || []).find((x) => x.s === si) || {};
    main.innerHTML = `
      <div class="crumb">${t.stage.parallel ? "Song song" : `Giai đoạn ${stageNum(t.stage)}`} · ${esc(t.stage.title)}</div>
      <h1>${esc(t.title)}</h1>
      <div class="panel tldr"><b>Nói trong 30 giây</b>${tagged(t.tldr)}${whyLine(W.tldr)}</div>

      ${W.story ? `${h("Vì sao cần biết")}<div class="story">
        <div class="panel"><b>Vấn đề</b>${inline(W.story.problem)}</div>
        <div class="panel"><b>Ý tưởng</b>${inline(W.story.idea)}</div>
        <div class="panel"><b>Đánh đổi</b>${inline(W.story.tradeoff)}</div></div>` : ""}

      ${sims.length ? `${h("Hình dung")}${sims.map(simBox).join("")}` : ""}

      ${h("Kiến thức cốt lõi")}
      ${t.table ? `<div class="gap">${table(t.table, whyMap(W.table, "row"))}</div>` : ""}
      ${t.points && t.points.length ? `<div class="gap">${points(t.points, whyMap(W.points))}</div>` : ""}
      ${t.table2 ? `<h3>${esc(t.table2Title || "Chi tiết")}</h3>${table(t.table2, whyMap(W.table2, "row"))}` : ""}
      ${(t.sections || []).map((s, si) => `<h3>${esc(s.title)}</h3>${s.points ? `<div class="gap">${points(s.points, whyMap(secW(si).points))}</div>` : ""}${s.table ? `<div class="gap">${table(s.table, whyMap(secW(si).table, "row"))}</div>` : ""}`).join("")}

      ${t.tips ? `${h("Mẹo khi phỏng vấn")}<div class="panel"><ul class="tips">${t.tips.map((x, i) => `<li>${inline(x)}${whyLine(whyMap(W.tips)[i])}</li>`).join("")}</ul></div>` : ""}

      ${t.cards && t.cards.length ? `${h("Tự kiểm tra")}<p class="muted small">Trả lời thành tiếng trước, rồi mới mở đáp án.</p>
        <div class="qa">${t.cards.map(([q, a]) => `<details class="panel"><summary>${inline(q)}</summary><div>${inline(a)}</div></details>`).join("")}</div>` : ""}

      ${probs.length || related.length ? `${h("Áp dụng")}
        ${probs.length ? `<div class="apply"><span class="muted">Dùng trong bài:</span> ${probs.map((p) => `<a class="chip" href="#/p/${p.id}">${esc(p.title)}</a>`).join("")}</div>` : ""}
        ${related.length ? `<div class="apply"><span class="muted">Mô phỏng liên quan:</span> ${related.map((s) => `<a class="chip" href="#/sim/${s.id}">${esc(s.title)}</a>`).join("")}</div>` : ""}` : ""}

      <div class="topic-actions"><button class="btn ${done.has(id) ? "done" : "primary"}" id="doneBtn">${done.has(id) ? "✓ Đã nắm" : "Đánh dấu đã nắm"}</button></div>
      <div class="pager">
        ${prev ? `<a href="#/t/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a href="#/t/${next.id}" style="text-align:right">${esc(next.title)} →</a>` : `<a href="#/problems" style="text-align:right">Sang luyện bài →</a>`}
      </div>`;
    mountAll(sims);
    abbrBox(main.querySelector(".tldr"));
    $("#doneBtn").onclick = () => { toggleDone(id); viewTopic(id); };
  }

  // ── Bài luyện ──
  function viewProblems() {
    setNav("problems", sideProblems("all"));
    main.innerHTML = `
      <h1>Luyện bài System Design</h1>
      <p class="lead">Tự làm trước, xem lời giải sau: nói Requirements → HLD trong 15–20 phút, rồi so với HLD mẫu và đáp án Deep Dives. Bài nào cũng đi đủ Delivery Framework.</p>
      ${[1, 2, 3].map((l) => `
        <h2>${levelBadge(l)} <span class="muted small">${{ 1: "ít thành phần, một pattern chính", 2: "nhiều luồng, phải chọn trade-off rõ", 3: "nhiều pattern kết hợp, deep dive khó" }[l]}</span></h2>
        <div class="grid">${PROBLEMS.filter((p) => p.level === l).map((p) => `
          <a class="panel sim-card" href="#/p/${p.id}">
            <div class="t"><span class="sb-dot ${done.has(`p:${p.id}`) ? "done" : ""}" style="display:inline-block;margin-right:6px"></span>${esc(p.title)}</div>
            <div class="s">${inline(p.summary)}</div>
            <div class="tags">${p.topics.map((id) => `<span class="chip">${esc(byId[id].title)}</span>`).join("")}</div>
          </a>`).join("")}</div>`).join("")}`;
  }

  function viewProblem(id) {
    const p = pById[id];
    if (!p) return viewProblems();
    const key = `p:${id}`;
    setNav("problems", sideProblems(id));
    const i = PROBLEMS.indexOf(p), prev = PROBLEMS[i - 1], next = PROBLEMS[i + 1];
    const sims = (p.sims || []).map((sid) => simById[sid]).filter(Boolean);
    const PW = PWHY[id] || {};
    const nfrW = whyMap(PW.nfr);
    const lvl = (k, text, w) => `<div class="dd-col dd-${k}"><b>${{ bad: "Bad", good: "Good", great: "Great" }[k]}</b>${inline(text)}${w ? `<div class="why"><b>Vì sao</b>${inline(w)}</div>` : ""}</div>`;
    main.innerHTML = `
      <div class="crumb"><a href="#/problems">Luyện bài</a> · ${LEVELS[p.level]}</div>
      <h1>${esc(p.title)}</h1>
      <p class="lead">${inline(p.summary)}</p>
      <div class="prob-meta">
        ${levelBadge(p.level)}
        ${p.topics.map((tid) => `<a class="chip" href="#/t/${tid}">${esc(byId[tid].title)}</a>`).join("")}
        <a class="chip" href="https://www.hellointerview.com/learn/system-design/problem-breakdowns/${p.hi}" target="_blank" rel="noopener">Bản gốc Hello Interview ↗</a>
      </div>
      <div class="panel practice-hint">Tự làm 15–20 phút trước khi đọc tiếp: liệt kê requirements, entities, API, phác HLD ra giấy.</div>

      <h2><span class="h-n">1</span>Requirements</h2>
      <div class="req-grid">
        <div class="panel"><div class="req-h">Functional</div><ul class="tips">${p.fr.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>
        <div class="panel"><div class="req-h">Non-functional</div><ul class="tips">${p.nfr.map((x, k) => `<li>${inline(x)}${whyLine(nfrW[k])}</li>`).join("")}</ul></div>
      </div>
      ${p.capacity ? `<div class="panel cap"><b>Ước lượng nhanh</b>${inline(p.capacity)}</div>` : ""}

      <h2><span class="h-n">2</span>Core Entities</h2>
      <div class="prob-meta">${p.entities.map((e) => `<span class="chip on">${esc(e)}</span>`).join("")}</div>

      <h2><span class="h-n">3</span>API</h2>
      <pre class="api">${p.api.map(esc).join("\n")}</pre>

      <h2><span class="h-n">4</span>High-Level Design</h2>
      ${PW.hld ? `<div class="panel why-hld"><b>Vì sao kiến trúc như vậy</b>${inline(PW.hld)}</div>` : ""}
      ${simBox(p.hld)}

      <h2><span class="h-n">5</span>Deep Dives</h2>
      <p class="muted small">Trả lời từng câu trước, rồi mới mở 3 mức đáp án.</p>
      ${p.deep.map((d, k) => `<details class="panel dd"><summary class="dd-q">${k + 1}. ${inline(d.q)}</summary>
        <div class="dd-grid">${(() => { const w = (PW.deep || []).find((x) => x.i === k) || {}; return lvl("bad", d.bad, w.bad) + lvl("good", d.good, w.good) + lvl("great", d.great, w.great); })()}</div></details>`).join("")}

      ${sims.length ? `<h2><span class="h-n">+</span>Mô phỏng liên quan</h2>${sims.map(simBox).join("")}` : ""}

      <div class="topic-actions"><button class="btn ${done.has(key) ? "done" : "primary"}" id="doneBtn">${done.has(key) ? "✓ Đã luyện xong" : "Đánh dấu đã luyện xong"}</button></div>
      <div class="pager">
        ${prev ? `<a href="#/p/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a href="#/p/${next.id}" style="text-align:right">${esc(next.title)} →</a>` : "<span></span>"}
      </div>`;
    mountAll([p.hld, ...sims]);
    abbrBox(main.querySelector(".prob-meta"));
    $("#doneBtn").onclick = () => { toggleDone(key); viewProblem(id); };
  }

  // ── Thư viện mô phỏng ──
  function viewSims() {
    setNav("sims", sideKnowledge(null));
    main.innerHTML = `
      <h1>Thư viện mô phỏng</h1>
      <p class="lead">${SIMS.length} mô phỏng chạy trực tiếp, xếp theo giai đoạn lộ trình. Mỗi mô phỏng cũng có trong trang chủ đề tương ứng.</p>
      ${STAGES.filter((s) => !s.problems).map((st) => {
        const list = SIMS.filter((s) => byId[s.topics[0]] && byId[s.topics[0]].stage === st);
        if (!list.length) return "";
        return `<h2>${stageNum(st)} · ${esc(st.title)}</h2><div class="grid">${list.map((s) => `
          <a class="panel sim-card" href="#/sim/${s.id}">
            <div class="t">${esc(s.title)}</div>
            <div class="s">${inline(s.scenario)}</div>
            <div class="tags">${s.topics.filter((id) => byId[id]).map((id) => `<span class="chip">${esc(byId[id].title)}</span>`).join("")}</div>
          </a>`).join("")}</div>`;
      }).join("")}`;
  }

  function viewSim(id) {
    const sim = simById[id];
    if (!sim) return viewSims();
    setNav("sims", sideKnowledge(sim.topics[0]));
    main.innerHTML = `
      <div class="crumb"><a href="#/sims">Mô phỏng</a> · ${esc(sim.title)}</div>
      ${simBox(sim)}
      <div class="topic-actions">${sim.topics.filter((tid) => byId[tid]).map((tid) => `<a class="btn" href="#/t/${tid}">Ôn chủ đề: ${esc(byId[tid].title)}</a>`).join("")}</div>`;
    mountAll([sim]);
  }

  // ── Thuật ngữ ──
  function viewGlossary() {
    setNav("glossary", sideKnowledge(null));
    const total = Object.keys(GL).length;
    main.innerHTML = `
      <h1>Thuật ngữ viết tắt</h1>
      <p class="lead">${total} từ viết tắt. Ở mọi trang, rê chuột hoặc chạm vào từ gạch chấm để xem nghĩa.</p>
      <input id="glFilter" class="gl-filter" type="search" placeholder="Lọc: LRU, TTL, Kafka…" autocomplete="off">
      <div id="glList"></div>`;
    const render = (q) => {
      const n = q.trim().toLowerCase();
      $("#glList").innerHTML = (window.GLOSSARY || []).map((g) => {
        const items = g.items.filter((it) => !n || it.join(" ").toLowerCase().includes(n));
        if (!items.length) return "";
        return `<h2>${esc(g.group)}</h2><div class="table-wrap"><table><thead><tr><th>Viết tắt</th><th>Tên đầy đủ</th><th>Nghĩa</th></tr></thead><tbody>
          ${items.map(([k, full, vi, ex]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(full)}</td><td>${inline(vi).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")}${ex ? `<div class="muted small">Ví dụ: ${inline(ex).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")}</div>` : ""}</td></tr>`).join("")}
        </tbody></table></div>`;
      }).join("") || `<div class="empty">Không có thuật ngữ khớp.</div>`;
    };
    render("");
    $("#glFilter").addEventListener("input", (e) => render(e.target.value));
  }

  // ── Tìm kiếm ──
  function viewSearch(q) {
    setNav(null, sideKnowledge(null));
    const needle = q.toLowerCase();
    const textOf = (t) => [t.title, t.tldr, ...(t.points || []), ...(t.tips || []),
      ...[t.table, t.table2, ...(t.sections || []).map((s) => s.table)].filter(Boolean).flatMap((x) => [...x.head, ...x.rows.flat()]),
      ...(t.sections || []).flatMap((s) => [s.title, ...(s.points || [])]), ...(t.cards || []).flat()];
    const hits = ORDER.map((t) => ({ href: `#/t/${t.id}`, title: t.title, where: t.stage.title, m: textOf(t).filter((s) => s.toLowerCase().includes(needle)) }))
      .concat(PROBLEMS.map((p) => ({ href: `#/p/${p.id}`, title: p.title, where: "Bài luyện", m: [p.title, p.summary, ...p.fr, ...p.nfr, ...p.entities, ...p.api, ...p.deep.flatMap((d) => [d.q, d.bad, d.good, d.great])].filter((s) => s.toLowerCase().includes(needle)) })))
      .filter((x) => x.m.length);
    // Bỏ tooltip trong kết quả tìm kiếm và chỉ tô sáng phần chữ, không đụng vào thẻ HTML
    const hl = (s) => plain(s.replace(/^[+!] /, "")).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")
      .replace(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![^<]*>)`, "gi"), "<mark>$1</mark>");
    main.innerHTML = `<h1>Kết quả cho “${esc(q)}”</h1><p class="lead">${hits.length} kết quả</p>
      ${hits.map((x) => `<a class="panel search-hit" href="${x.href}">
        <div class="t">${esc(x.title)} <span class="s">· ${esc(x.where)}</span></div>
        <div class="s">${x.m.slice(0, 2).map(hl).join(" · ")}</div></a>`).join("") || `<div class="empty">Không tìm thấy.</div>`}`;
  }

  // ── Router ──
  function route() {
    const h = decodeURIComponent(location.hash.slice(1) || "/");
    if (h.startsWith("/t/")) return viewTopic(h.slice(3));
    if (h === "/learn") { location.hash = `#/t/${(ORDER.find((t) => !done.has(t.id)) || ORDER[0]).id}`; return; }
    if (h === "/problems") return viewProblems();
    if (h.startsWith("/p/")) return viewProblem(h.slice(3));
    if (h === "/sims") return viewSims();
    if (h === "/glossary") return viewGlossary();
    if (h.startsWith("/sim/")) return viewSim(h.slice(5));
    if (h.startsWith("/search/")) return viewSearch(h.slice(8));
    viewHome();
  }
  window.addEventListener("hashchange", route);

  let searchTimer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value.trim();
    searchTimer = setTimeout(() => { location.hash = v ? `#/search/${encodeURIComponent(v)}` : "#/"; }, 200);
  });

  route();
})();
