(function () {
  const $ = (s) => document.querySelector(s);
  const main = $("#main");
  const sidebar = $("#sidebar");

  // ── Index: nội dung (registry BK của content/manifest.js) + thứ tự học (ROADMAP) ──
  const BK = window.BK;
  const ALL = BK.topics;
  const byId = Object.fromEntries(ALL.map((t) => [t.id, t]));
  // Giai đoạn có `parts` (chặng) thì `topics` suy từ các chặng; không có thì dùng `topics` như cũ (B1). Mọi trường mới đều tuỳ chọn
  const STAGES = window.ROADMAP.map((s) => {
    if (!s.parts) return { ...s, topics: (s.topics || []).filter((id) => byId[id]) };
    const parts = s.parts.map((p) => ({ ...p, topics: (p.topics || []).filter((id) => byId[id]) })).filter((p) => p.topics.length);
    return { ...s, parts, topics: parts.flatMap((p) => p.topics) };
  });
  const listed = new Set(STAGES.flatMap((s) => s.topics));
  const orphans = ALL.filter((t) => !listed.has(t.id)).map((t) => t.id);
  if (orphans.length) STAGES.push({ id: "other", title: "Khác", goal: "", topics: orphans, parallel: true });
  STAGES.forEach((s) => s.topics.forEach((id) => (byId[id].stage = s)));
  STAGES.forEach((s) => (s.parts || []).forEach((p) => p.topics.forEach((id) => (byId[id].part = p))));
  // Thứ tự đọc: giai đoạn chính trước, nhánh song song sau
  const ORDER = [...STAGES.filter((s) => !s.parallel), ...STAGES.filter((s) => s.parallel)].flatMap((s) => s.topics.map((id) => byId[id]));
  // Lộ trình chính = topic của mọi giai đoạn không song song (kể cả giai đoạn có bài luyện, B0).
  // Pager đi trong nhóm: lộ trình chính, hoặc riêng một nhánh song song (A1)
  const MAIN = ORDER.filter((t) => !t.stage.parallel);
  const groupOf = (t) => (t.stage.parallel ? t.stage.topics.map((id) => byId[id]) : MAIN);

  const SIMS = BK.sims;
  const simById = Object.fromEntries(SIMS.map((s) => [s.id, s]));
  const simsFor = (id) => SIMS.filter((s) => s.topics.includes(id));
  const LEVELS = { 1: "Khởi động", 2: "Trung bình", 3: "Nâng cao" };
  const PROBLEMS = BK.problems.slice().sort((a, b) => a.level - b.level);
  const pById = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const problemsFor = (id) => PROBLEMS.filter((p) => p.topics.includes(id));

  // ── Tiến độ (best effort) ──
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const done = new Set(store.get("ip.done", []));
  const toggleDone = (key) => { done.has(key) ? done.delete(key) : done.add(key); store.set("ip.done", [...done]); };
  // "Đủ nền" (A3): mọi topic của bài đã nắm. Tính từ p.topics + ip.done, không cần dữ liệu mới
  const missing = (p) => p.topics.filter((id) => !done.has(id));
  const isReady = (p) => !missing(p).length;
  // Chặng kiểm tra (A5): bài thuộc giai đoạn chứa topic muộn nhất của nó trong lộ trình chính.
  // Giai đoạn có bài luyện (problems) không có hàng kiểm tra riêng — nó chính là chỗ luyện
  const mainIdx = (id) => MAIN.indexOf(byId[id]);
  const checkpointOf = (p) => { const last = p.topics.filter((id) => mainIdx(id) >= 0).sort((a, b) => mainIdx(b) - mainIdx(a))[0]; return last && byId[last].stage; };
  const checkpoint = (s) => (s.problems ? [] : PROBLEMS.filter((p) => checkpointOf(p) === s));
  // Gợi ý luyện: bài đủ nền chưa luyện; chưa có thì bài thiếu ít chủ đề nhất (người mới vẫn thấy hướng đi)
  function practiceHint() {
    const open = PROBLEMS.filter((p) => !done.has(`p:${p.id}`));
    if (!open.length) return null;
    const ready = open.filter(isReady);
    if (ready.length) return { title: `Bài đã đủ nền (${ready.length})`, list: ready.slice(0, 3) };
    const min = Math.min(...open.map((p) => missing(p).length));
    return { title: min === 1 ? "Sắp mở bài luyện" : "Gần đủ nền nhất", list: open.filter((p) => missing(p).length === min).slice(0, 2), showMissing: true };
  }
  // "Học tiếp" (A2): topic chưa nắm đầu tiên của lộ trình chính; xong hết thì bài đủ nền chưa luyện đầu tiên
  function nextStep() {
    const t = MAIN.find((x) => !done.has(x.id) && !(x.part && x.part.optional)); // bỏ qua chặng "Đào sâu" (B4)
    if (t) return { href: `#/t/${t.id}`, title: t.title, topic: t };
    const p = PROBLEMS.find((x) => !done.has(`p:${x.id}`) && isReady(x));
    return p ? { href: `#/p/${p.id}`, title: p.title, problem: p } : { href: "#/problems", title: "Ôn lại bài luyện" };
  }

  // ── Theme & mobile menu ──
  const theme = store.get("ip.theme", null);
  if (theme) document.documentElement.dataset.theme = theme;
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("ip.theme", next);
  };
  const menuBtn = $("#menuBtn");
  const setMenu = (open) => { sidebar.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); if (open) showActive(); };
  menuBtn.onclick = () => setMenu(!sidebar.classList.contains("open"));
  // Bấm ra ngoài sidebar (kể cả nền mờ) thì đóng
  document.addEventListener("click", (e) => { if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });

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
  // ── cite:start — URL viết trong câu → chú thích [n] (D92). check.mjs nạp đúng đoạn này để soát câu sau khi tách ──
  // Trả về { text, urls }: text thay mỗi URL bằng \u0001k\u0002 (k = chỉ số trong urls) và bỏ phần thừa quanh nó
  // ("(URL)", "— URL", "Nguồn: URL", dấu phẩy giữa hai URL). Chỉ gọi cho phần ngoài `code`.
  const CITE_URL = /https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[^\s()<>"'`\u0001\u0002]|\([^\s()]*\))*/gi;
  function splitCites(s) {
    const urls = [];
    let t = s.replace(CITE_URL, (u) => {
      const tail = u.match(/[.,;:!?…]+$/);
      if (tail) u = u.slice(0, -tail[0].length);
      const k = urls.indexOf(u) >= 0 ? urls.indexOf(u) : urls.push(u) - 1;
      return `\u0001${k}\u0002${tail ? tail[0] : ""}`;
    });
    if (!urls.length) return { text: s, urls };
    const M = "\u0001\\d+\u0002";
    t = t
      .replace(new RegExp(`(?:[Nn]guồn|[Ss]ource|[Xx]em)\\s*:\\s*(?=${M})`, "g"), "")          // "Nguồn: URL"
      .replace(new RegExp(`(${M})\\s*(?:[,;·]|và)\\s*(?=${M})`, "g"), "$1")                         // "URL, URL"
      .replace(new RegExp(`\\s*(?:[—–:,;]|\\s-)\\s*(?=${M})`, "g"), "")                           // "nhãn — URL"
      .replace(new RegExp(`\\(\\s*((?:${M})+)\\s*\\)`, "g"), "$1")                                  // "(URL)"
      .replace(new RegExp(`\\(\\s*((?:${M})+)\\s*[·,;]\\s*`, "g"), "$1 (")                        // "(URL · nhãn)" → "[n] (nhãn)"
      .replace(new RegExp(`((?:${M})+)\\s*\\)`, "g"), ")$1")                                     // "(nhãn URL)" → "(nhãn)[n]"
      .replace(new RegExp(`\\s+(?=${M})`, "g"), "")                                               // khoảng trắng trước [n]
      .replace(new RegExp(`([.!?])((?:${M})+)[.]`, "g"), "$1$2");                                  // ".[n]." → ".[n]"
    return { text: t, urls };
  }
  // ── cite:end ──
  // Nguồn của trang (topic, problem, sim): Map URL → số [n], đánh theo thứ tự xuất hiện, khử trùng lặp.
  // null = trang không có mục "Nguồn tham khảo" (tìm kiếm, thẻ, tooltip): chỉ bỏ URL khỏi câu
  let refs = null, citeLink = true;
  const shortUrl = (u) => {
    try {
      const x = new URL(u);
      let path = x.pathname + x.search + x.hash;
      try { path = decodeURI(path); } catch {}
      if (path === "/") path = "";
      if (path.length > 44) { const seg = x.pathname.split("/").filter(Boolean); path = `/${seg[0]}/…/${seg.at(-1)}${x.hash}`; }
      if (path.length > 44) path = `${path.slice(0, 20)}…${path.slice(-20)}`;
      return { host: x.hostname.replace(/^www\./, ""), path };
    } catch { return { host: u, path: "" }; }
  };
  const refItem = (u, n) => { const { host, path } = shortUrl(u); return `<li id="ref-${n}" value="${n}"><a href="${esc(u)}" target="_blank" rel="noopener"><span class="ref-host">${esc(host)}</span><span class="ref-path">${esc(path)}</span></a></li>`; };
  const refNo = (u) => {
    if (!refs.has(u)) {
      refs.set(u, refs.size + 1);
      const ol = main.querySelector(".refs ol"); // URL mới xuất hiện sau khi danh sách đã vẽ (văn bản do engine sinh): thêm vào cuối
      if (ol) ol.insertAdjacentHTML("beforeend", refItem(u, refs.size));
    }
    return refs.get(u);
  };
  // [n] là link thẳng tới nguồn (không dùng #ref-n vì router đọc mọi thay đổi hash); trong <summary> thì chỉ là số
  const cite = (u) => { const n = refNo(u), host = shortUrl(u).host;
    return citeLink ? `<sup class="cite"><a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(host)}" aria-label="Nguồn ${n}: ${esc(host)}">[${n}]</a></sup>` : `<sup class="cite">[${n}]</sup>`; };
  // Đăng ký trước mọi URL của một sim khi chèn khung sim: bước sim vẽ sau (khi bấm ▶) vẫn giữ đúng số theo thứ tự trang
  const preCite = (v) => {
    if (!refs) return;
    if (typeof v === "string") v.split(/`[^`]+`/).forEach((p) => splitCites(p).urls.forEach(refNo));
    else if (Array.isArray(v)) v.forEach(preCite);
    else if (v && typeof v === "object") Object.values(v).forEach(preCite);
  };
  const refList = () => !refs || !refs.size ? "" : `<section class="refs" aria-labelledby="refsH">
    <h2 id="refsH">Nguồn tham khảo</h2><p class="muted small">Tài liệu gốc cho các chú thích [n] trong bài; mở trong tab mới.</p>
    <ol>${[...refs].map(([u, n]) => refItem(u, n)).join("")}</ol></section>`;
  const plain = (s) => { const keep = glSeen, keepR = refs; glSeen = null; refs = null; try { return inline(s); } finally { glSeen = keep; refs = keepR; } };
  const inline = (s) => String(s).split(/(`[^`]+`)/).map((part) => {
    if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
    const { text, urls } = splitCites(part);
    return glossify(esc(text)).replace(/\u0001(\d+)\u0002/g, (_, k) => (refs ? cite(urls[k]) : ""));
  }).join("").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const inSummary = (s) => { citeLink = false; try { return inline(s); } finally { citeLink = true; } };
  window.glossInline = inline;
  // Chữ trong thẻ <a> (thẻ sim/bài): không chèn <abbr tabindex> để tránh phần tử tương tác lồng trong link
  const noTip = (s) => plain(s).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1");
  // Đánh dấu xong: render lại nhưng giữ vị trí đọc và focus của nút
  const keepPlace = (render) => { const y = window.scrollY; render(); window.scrollTo(0, y); $("#doneBtn").focus(); };
  const tagged = (s) => {
    if (s.startsWith("+ ")) return `<span class="tag added">Bổ sung</span>${inline(s.slice(2))}`;
    if (s.startsWith("! ")) return `<span class="tag fix">Đính chính</span>${inline(s.slice(2))}`;
    return inline(s);
  };
  // Một ý là chuỗi, hoặc { t, why } khi có giải thích "vì sao"; dòng bảng là mảng ô, hoặc { cells, why }
  const txt = (p) => (typeof p === "string" ? p : p.t);
  const cellsOf = (r) => (Array.isArray(r) ? r : r.cells);
  const whyLine = (w) => (w ? `<div class="why"><b>Vì sao</b>${inline(w)}</div>` : "");
  const table = (t) => !t ? "" : `<div class="table-wrap"><table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr class="${r.why ? "has-why" : ""}">${cellsOf(r).map((c) => `<td>${tagged(c)}</td>`).join("")}</tr>` +
      (r.why ? `<tr class="why-row"><td colspan="${cellsOf(r).length}">${whyLine(r.why)}</td></tr>` : "")).join("")}</tbody></table></div>`;
  const points = (ps) => !ps || !ps.length ? "" : `<div class="panel"><ul class="points">${ps.map((p) => `<li>${tagged(txt(p))}${whyLine(p.why)}</li>`).join("")}</ul></div>`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  // Sơ đồ SVG tĩnh (content/svg/): <img> chạy được qua file://, nền sáng nằm sẵn trong file SVG (D11)
  // Nguồn của sơ đồ (`source`) vào cùng danh sách "Nguồn tham khảo", hiện thành [n] sau caption (D92)
  const figure = (d) => `<figure class="panel diagram"><div class="diagram-img"><img src="${esc(d.src)}" alt="${esc(splitCites(d.caption).text.replace(/\u0001\d+\u0002|[*`]/g, ""))}" loading="lazy"></div>
    <figcaption>${inline(d.caption)}${d.source && refs ? cite(d.source) : ""}</figcaption></figure>`;
  const simBox = (sim) => { preCite(sim); return `<div class="panel sim-box" id="sim-${sim.id}"></div>`; };
  const mountAll = (sims) => sims.forEach((sim) => window.mountSim(document.getElementById(`sim-${sim.id}`), sim));
  const levelBadge = (l) => `<span class="lvl lvl-${l}">${LEVELS[l]}</span>`;
  // Chip chủ đề có trạng thái: ✓/○ + chữ ẩn cho trình đọc màn hình + viền khác nhau, không chỉ khác màu.
  // Trong thẻ <a> thì dùng <span> (tag = "span") để không lồng link
  const needChip = (id, tag = "a") => { const ok = done.has(id); return `<${tag} class="chip need-chip ${ok ? "ok" : ""}"${tag === "a" ? ` href="#/t/${id}"` : ""}><span aria-hidden="true">${ok ? "✓" : "○"}</span> ${esc(byId[id].title)}<span class="sr-only">${ok ? " (đã nắm)" : " (chưa nắm)"}</span></${tag}>`; };
  const readyBadge = (p) => { const m = missing(p).length; return m ? `<span class="ready miss">Còn thiếu ${m}</span>` : `<span class="ready ok">✓ Đủ nền</span>`; };
  const practiceBox = () => { const h = practiceHint(); return !h ? "" : `<div class="panel practice-box"><div class="l">${h.title}</div>
    ${h.list.map((p) => `<div class="pb-item"><a href="#/p/${p.id}">${esc(p.title)}</a> ${levelBadge(p.level)}${h.showMissing ? `<div class="muted small">Còn thiếu: ${missing(p).map((id) => esc(byId[id].title)).join(", ")}</div>` : ""}</div>`).join("")}</div>`; };
  // Tiến độ giai đoạn: topic + bài (giai đoạn có `problems`) — B0, Q7
  const stageKeys = (s) => (s.problems ? [...s.topics, ...PROBLEMS.map((p) => `p:${p.id}`)] : s.topics);
  const deepTag = (p) => (p && p.optional && !/^Đào sâu/.test(p.title || "") ? `<span class="tag deep">Đào sâu</span>` : ""); // chặng có tên bắt đầu bằng "Đào sâu" thì không lặp nhãn
  // Vị trí topic: "Giai đoạn N · tên" (+ " › chặng") — dùng cho crumb, thẻ Tiếp tục, tìm kiếm
  const stageText = (s) => `${s.parallel ? "Song song" : `Giai đoạn ${stageNum(s)}`} · ${s.title}`;
  const placeText = (t) => stageText(t.stage) + (t.part ? ` › ${t.part.title}` : "");
  const goalLine = (t) => (t.goal ? `<p class="goal"><b>Làm được:</b> ${inline(t.goal)}</p>` : "");
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
  // Esc: ẩn tooltip (WCAG 1.4.13), đóng sidebar mobile và trả focus về nút ☰
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    hideTip();
    if (sidebar.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });

  // ── Sidebar theo ngữ cảnh (D90: cây giai đoạn → chặng → topic, ô lọc, giữ trạng thái khi đổi trang) ──
  // Giai đoạn "đang học": chứa bước Học tiếp; xong lộ trình chính thì là giai đoạn luyện bài
  const currentStage = () => { const st = nextStep(); return st.topic ? st.topic.stage : STAGES.find((s) => s.problems); };
  // Trạng thái sống qua các lần render lại sidebar: giai đoạn người dùng tự mở, chữ đang lọc, vị trí cuộn
  const sb = { open: new Set(), filter: "", scroll: 0 };
  // Bỏ dấu để lọc: "bo nho" khớp "Bộ nhớ"
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const sbCount = (d, n) => `<span class="sb-n"><span aria-hidden="true">${d}/${n}</span><span class="sr-only">, đã nắm ${d} trên ${n}</span></span>`;
  // Trạng thái không chỉ bằng màu: ✓ trong vòng tròn + chữ ẩn "đã nắm"
  const sbLink = (href, title, ok, active) => `<a class="sb-topic${active ? " active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>` +
    `${ok === null ? "" : `<span class="sb-ic${ok ? " done" : ""}" aria-hidden="true">${ok ? "✓" : ""}</span>`}<span>${esc(title)}${ok ? '<span class="sr-only"> (đã nắm)</span>' : ""}</span></a>`;
  // Mỗi giai đoạn là <details>: mở giai đoạn chứa topic đang xem (không có thì giai đoạn đang học) + những giai đoạn người dùng đã tự mở (A7).
  // Lọc theo "có topic" chứ không theo `problems`, để giai đoạn vừa có topic vừa có bài vẫn hiện (B0)
  function sideKnowledge(active) {
    const cur = active && byId[active] ? byId[active].stage : currentStage();
    const block = (s) => {
      const d = s.topics.filter((id) => done.has(id)).length, n = s.topics.length;
      const parts = (s.parts || [{ topics: s.topics }]).map((p) => `<div class="sb-part">
        ${p.title ? `<div class="sb-part-t" data-q="${esc(fold(p.title))}"><span>${esc(p.title)}${deepTag(p)}</span>${sbCount(p.topics.filter((id) => done.has(id)).length, p.topics.length)}</div>` : ""}
        <ul class="sb-list">${p.topics.map((id) => `<li data-q="${esc(fold(`${byId[id].title} ${id}`))}">${sbLink(`#/t/${id}`, byId[id].title, done.has(id), id === active)}</li>`).join("")}</ul></div>`).join("");
      return `<details class="sb-stage${s.parallel ? " parallel" : ""}${d === n ? " complete" : ""}" data-id="${s.id}"${s === cur || sb.open.has(s.id) ? " open" : ""}>
        <summary><span class="sb-num" aria-hidden="true">${stageNum(s)}</span>
          <span class="sb-st"><span class="sb-st-t"><span class="sr-only">${s.parallel ? "Nhánh" : `Giai đoạn ${stageNum(s)}`}: </span>${esc(s.title)}</span>
            <span class="sb-prog" aria-hidden="true"><i style="width:${pct(d, n)}%"></i></span></span>${sbCount(d, n)}</summary>
        ${parts}</details>`;
    };
    const withTopics = STAGES.filter((s) => s.topics.length);
    return `<div class="sb-filter" role="search"><input id="sbFilter" type="search" placeholder="Lọc chủ đề…" aria-label="Lọc chủ đề trong mục lục" aria-describedby="sbFilterN" autocomplete="off" spellcheck="false" value="${esc(sb.filter)}">
        <span id="sbFilterN" class="sr-only" aria-live="polite"></span></div>
      <nav class="sb-nav" aria-label="Mục lục chủ đề">
        <h2 class="sb-group">Lộ trình chính</h2>${withTopics.filter((s) => !s.parallel).map(block).join("")}
        <h2 class="sb-group">Nhánh song song</h2>${withTopics.filter((s) => s.parallel).map(block).join("")}
        <p class="sb-empty" hidden></p>
      </nav>`;
  }
  function sideProblems(active) {
    return `<nav class="sb-nav" aria-label="Danh sách bài luyện"><ul class="sb-list sb-top"><li>${sbLink("#/problems", "Tất cả bài & cách luyện", null, active === "all")}</li></ul>` +
      [1, 2, 3].map((l) => { const ps = PROBLEMS.filter((p) => p.level === l), d = ps.filter((p) => done.has(`p:${p.id}`)).length;
        return `<section class="sb-level"><h2 class="sb-level-t"><span>${LEVELS[l]}</span>${sbCount(d, ps.length).replace("đã nắm", "đã luyện")}</h2>
          <ul class="sb-list">${ps.map((p) => `<li>${sbLink(`#/p/${p.id}`, p.title, done.has(`p:${p.id}`), active === p.id).replace("(đã nắm)", "(đã luyện)")}</li>`).join("")}</ul></section>`; }).join("") + "</nav>";
  }
  // Lọc trong sidebar: ẩn topic không khớp (chặng khớp tên thì giữ cả chặng), mở mọi giai đoạn có kết quả
  function applyFilter() {
    const box = sidebar.querySelector("#sbFilter");
    if (!box) return;
    const q = fold(sb.filter.trim());
    let hits = 0;
    sidebar.querySelectorAll(".sb-stage").forEach((st) => {
      let any = 0;
      st.querySelectorAll(".sb-part").forEach((p) => {
        const whole = !!q && !!p.querySelector(`.sb-part-t[data-q*="${CSS.escape(q)}"]`);
        let n = 0;
        p.querySelectorAll("li").forEach((li) => { const ok = !q || whole || li.dataset.q.includes(q); li.hidden = !ok; n += ok; });
        p.hidden = !n; any += n;
      });
      st.hidden = !any;
      if (q) { st.open = !!any; hits += any; }
    });
    sidebar.querySelectorAll(".sb-group").forEach((g) => { let el = g.nextElementSibling, vis = false; while (el && el.matches(".sb-stage")) { vis ||= !el.hidden; el = el.nextElementSibling; } g.hidden = !vis; });
    const empty = sidebar.querySelector(".sb-empty");
    empty.hidden = !q || hits > 0;
    if (q && !hits) empty.innerHTML = `Không có chủ đề khớp “${esc(sb.filter.trim())}”. <a href="#/search/${encodeURIComponent(sb.filter.trim())}">Tìm trong toàn bộ nội dung →</a>`;
    $("#sbFilterN").textContent = q ? (hits ? `${hits} chủ đề khớp` : "Không có chủ đề khớp") : "";
  }
  // Bỏ lọc: trả các giai đoạn về trạng thái mở/gập trước khi lọc
  function clearFilter() {
    sb.filter = "";
    sidebar.querySelectorAll(".sb-stage").forEach((st) => (st.open = sb.open.has(st.dataset.id) || !!st.querySelector("[aria-current]") || st.dataset.cur === "1"));
    applyFilter();
  }
  // Đưa mục đang xem vào giữa khung sidebar nếu nó đang khuất (chỉ cuộn sidebar, không cuộn trang)
  function showActive() {
    const a = sidebar.querySelector(".sb-topic[aria-current]");
    if (!a) return;
    const top = a.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop;
    if (top < sidebar.scrollTop + 60 || top > sidebar.scrollTop + sidebar.clientHeight - 60) sidebar.scrollTop = top - sidebar.clientHeight / 2;
  }
  // Ghi nhớ khi người dùng bấm (chuột hoặc Enter/Space trên summary), không ghi khi code mở/gập
  sidebar.addEventListener("click", (e) => {
    const s = e.target.closest(".sb-stage > summary");
    if (!s || sb.filter.trim()) return;
    const st = s.parentElement;
    !st.open ? sb.open.add(st.dataset.id) : sb.open.delete(st.dataset.id); // click chạy trước khi details đổi trạng thái
  });
  sidebar.addEventListener("input", (e) => { if (e.target.id !== "sbFilter") return; sb.filter = e.target.value; sb.filter.trim() ? applyFilter() : clearFilter(); });
  sidebar.addEventListener("keydown", (e) => {
    if (e.target.id !== "sbFilter" || e.key !== "Escape" || !e.target.value) return;
    e.preventDefault(); e.stopPropagation(); // Esc lần đầu: xoá lọc; lần sau: đóng drawer (handler chung)
    e.target.value = ""; clearFilter();
  });
  sidebar.addEventListener("scroll", () => (sb.scroll = sidebar.scrollTop), { passive: true });
  function setNav(mode, side) {
    glSeen = mode === "glossary" ? null : new Set();
    refs = null; // trang topic/problem/sim tự bật lại sau setNav
    document.querySelectorAll(".modes a").forEach((a) => { const on = a.dataset.mode === mode; a.classList.toggle("active", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
    // Màn hẹp: 5 tab nằm đầu drawer ☰ (bản sao của .modes, CSS chỉ hiện một trong hai) — D28
    sidebar.innerHTML = `<nav class="sb-modes" aria-label="Chế độ học">${$(".modes").innerHTML}</nav>${side}`;
    sidebar.querySelectorAll(".sb-stage[open]").forEach((st) => { if (!sb.open.has(st.dataset.id)) st.dataset.cur = "1"; });
    if (sb.filter.trim()) applyFilter();
    sidebar.scrollTop = sb.scroll;
    showActive();
    setMenu(false);
    window.scrollTo(0, 0);
  }

  // ── Lộ trình (trang chủ) ──
  function viewHome() {
    setNav("home", sideKnowledge(null));
    const tDone = ALL.filter((t) => done.has(t.id)).length;
    const pDone = PROBLEMS.filter((p) => done.has(`p:${p.id}`)).length;
    const step = nextStep(), cur = currentStage();
    // Mỗi giai đoạn là <details> (A6); chỉ mở sẵn giai đoạn đang học. Summary không chứa heading (trình đọc màn hình đọc summary là nút)
    const stage = (s) => {
      const keys = stageKeys(s), d = keys.filter((k) => done.has(k)).length;
      const tChips = (ids) => ids.map((id) => `<a class="rm-chip ${done.has(id) ? "done" : ""}" href="#/t/${id}">${esc(byId[id].title)}</a>`).join("");
      const pChips = PROBLEMS.map((p) => `<a class="rm-chip ${done.has(`p:${p.id}`) ? "done" : ""}" href="#/p/${p.id}">${esc(p.title.split(" (")[0])}</a>`).join("");
      // Có chặng: mỗi chặng một hàng có nhãn; giai đoạn có cả topic lẫn bài: thêm hàng "Luyện đề" (B0, B1)
      const rows = [...(s.parts || (s.topics.length ? [{ topics: s.topics }] : [])).map((p) => [p.title ? esc(p.title) + deepTag(p) : "", tChips(p.topics)]),
        ...(s.problems ? [[s.topics.length ? "Luyện đề" : "", pChips]] : [])];
      const items = rows.map(([label, chips]) => (label ? `<div class="rm-part"><div class="rm-part-t">${label}</div><div class="rm-chips">${chips}</div></div>` : `<div class="rm-chips">${chips}</div>`)).join("");
      return `<div class="rm-stage ${s.parallel ? "parallel" : ""} ${d === keys.length ? "complete" : ""}">
        <div class="rm-num" aria-hidden="true">${stageNum(s)}</div>
        <details class="rm-body" ${s === cur ? "open" : ""}>
          <summary class="rm-head"><span class="rm-title"><span class="sr-only">${s.parallel ? "Nhánh song song" : `Giai đoạn ${stageNum(s)}`}: </span>${esc(s.title)}</span><span class="muted">${d}/${keys.length}</span></summary>
          <p class="muted">${esc(s.goal)}</p>
          ${items}
          ${checkpoint(s).length ? `<div class="rm-check"><span class="muted">✔ Kiểm tra chặng:</span> ${checkpoint(s).map((p) => `<a class="rm-chip ${done.has(`p:${p.id}`) ? "done" : ""}" href="#/p/${p.id}">${esc(p.title.split(" (")[0])}</a>`).join("")}</div>` : ""}
        </details>
      </div>`;
    };
    const where = step.topic ? esc(placeText(step.topic))
      : step.problem ? `Luyện đề · ${LEVELS[step.problem.level]}` : "Đã xong lộ trình chính và các bài đủ nền";
    main.innerHTML = `
      <h1>Lộ trình ôn System Design & Backend</h1>
      <p class="lead">Học theo giai đoạn 1 → 5; Low-Level Design và DSA học song song. Mọi chủ đề dùng chung một khung nên ôn lại nhanh.</p>

      <div class="home-top">
        <a class="panel continue" href="${step.href}">
          <div class="l">Tiếp tục</div>
          <div class="crumb">${where}</div>
          <div class="c-title">${esc(step.title)}</div>
          ${step.topic && step.topic.goal ? `<div class="c-goal">Làm được: ${noTip(step.topic.goal)}</div>` : ""}
          <span class="btn primary">${step.topic ? "Học tiếp" : step.problem ? "Luyện tiếp" : "Xem bài luyện"} →</span>
        </a>
        ${practiceBox()}
      </div>
      <div class="progress-line">
        <div><b>Chủ đề ${tDone}/${ALL.length}</b><div class="bar"><i style="width:${pct(tDone, ALL.length)}%"></i></div></div>
        <div><b>Bài luyện ${pDone}/${PROBLEMS.length}</b><div class="bar"><i style="width:${pct(pDone, PROBLEMS.length)}%"></i></div></div>
      </div>

      <h2 class="rm-group">Lộ trình chính</h2>
      <div class="roadmap">${STAGES.filter((s) => !s.parallel).map(stage).join("")}</div>
      <h2 class="rm-group">Nhánh song song <span class="small">· học xen kẽ khi cần</span></h2>
      <div class="roadmap">${STAGES.filter((s) => s.parallel).map(stage).join("")}</div>

      <details class="panel scope">
        <summary>Cách ôn một chủ đề / một bài</summary>
        <div class="method">
          <div><b>Cách ôn một chủ đề</b><ol><li>Đọc “Nói trong 30 giây”</li><li>Chạy mô phỏng</li><li>Đọc kiến thức cốt lõi</li><li>Tự trả lời phần Tự kiểm tra</li><li>Xem chủ đề dùng trong bài nào, rồi đánh dấu đã nắm</li></ol></div>
          <div><b>Cách luyện một bài</b><ol><li>Đọc đề, chưa xem lời giải</li><li>Tự nói Requirements → Entities → API → HLD trong 15–20 phút</li><li>So với HLD mẫu, chạy từng luồng</li><li>Trả lời Deep Dives trước khi mở 3 mức đáp án</li></ol></div>
        </div>
      </details>

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
    refs = new Map();
    const group = groupOf(t), i = group.indexOf(t), prev = group[i - 1], next = group[i + 1];
    // Cuối nhóm: lộ trình chính sang luyện đề, nhánh song song về trang chủ (không nhảy sang nhánh khác)
    const end = t.stage.parallel ? { href: "#/", label: "Về lộ trình →" } : { href: "#/problems", label: "Sang luyện đề →" };
    const sims = simsFor(id);
    const related = (t.related || []).map((sid) => simById[sid]).filter(Boolean);
    const probs = problemsFor(id);
    let n = 0;
    const h = (title) => `<h2><span class="h-n">${++n}</span>${esc(title)}</h2>`;
    main.innerHTML = `
      <div class="crumb t-crumb ${t.part ? "has-part" : ""}"><span class="cr-long">${esc(stageText(t.stage))}</span><span class="cr-short">${t.stage.parallel ? "∥" : `GĐ${stageNum(t.stage)}`}</span>${t.part
        ? ` › <span class="cr-part">${esc(t.part.title)}</span><span class="cr-n">&nbsp;· ${t.part.topics.indexOf(id) + 1}/${t.part.topics.length}</span>` : ""}</div>
      <h1>${esc(t.title)}</h1>
      ${goalLine(t)}
      ${(t.needs || []).filter((x) => byId[x]).length ? `<div class="needs"><span class="muted">Cần trước:</span> ${t.needs.filter((x) => byId[x]).map((x) => needChip(x)).join("")}</div>` : ""}
      <div class="panel tldr"><b>Nói trong 30 giây</b>${tagged(txt(t.tldr))}${whyLine(t.tldr.why)}</div>

      ${t.story ? `${h("Vì sao cần biết")}<div class="story">
        <div class="panel"><b>Vấn đề</b>${inline(t.story.problem)}</div>
        <div class="panel"><b>Ý tưởng</b>${inline(t.story.idea)}</div>
        <div class="panel"><b>Đánh đổi</b>${inline(t.story.tradeoff)}</div></div>` : ""}

      ${sims.length || t.diagrams ? `${h("Hình dung")}${(t.diagrams || []).map(figure).join("")}${sims.map(simBox).join("")}` : ""}

      ${h("Kiến thức cốt lõi")}
      ${t.table ? `<div class="gap">${table(t.table)}</div>` : ""}
      ${t.points && t.points.length ? `<div class="gap">${points(t.points)}</div>` : ""}
      ${t.table2 ? `<h3>${esc(t.table2Title || "Chi tiết")}</h3>${table(t.table2)}` : ""}
      ${(t.sections || []).map((s) => `<h3>${esc(s.title)}</h3>${s.points ? `<div class="gap">${points(s.points)}</div>` : ""}${s.table ? `<div class="gap">${table(s.table)}</div>` : ""}`).join("")}

      ${t.tips ? `${h("Mẹo khi phỏng vấn")}<div class="panel"><ul class="tips">${t.tips.map((x) => `<li>${inline(txt(x))}${whyLine(x.why)}</li>`).join("")}</ul></div>` : ""}

      ${t.cards && t.cards.length ? `${h("Tự kiểm tra")}<p class="muted small">Trả lời thành tiếng trước, rồi mới mở đáp án.</p>
        <div class="qa">${t.cards.map(([q, a]) => `<details class="panel"><summary>${inSummary(q)}</summary><div>${inline(a)}</div></details>`).join("")}</div>` : ""}

      ${probs.length || related.length ? `${h("Áp dụng")}
        ${probs.length ? `<div class="apply"><span class="muted">Dùng trong bài:</span> ${probs.map((p) => `<a class="chip" href="#/p/${p.id}">${esc(p.title)}</a>`).join("")}</div>` : ""}
        ${related.length ? `<div class="apply"><span class="muted">Mô phỏng liên quan:</span> ${related.map((s) => `<a class="chip" href="#/sim/${s.id}">${esc(s.title)}</a>`).join("")}</div>` : ""}` : ""}

      ${nextCard(t, next, end)}
      <div class="pager">
        ${prev ? `<a href="#/t/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a href="#/t/${next.id}" style="text-align:right">${esc(next.title)} →</a>` : `<a href="${end.href}" style="text-align:right">${end.label}</a>`}
      </div>
      ${refList()}`;
    mountAll(sims);
    abbrBox(main.querySelector(".tldr"));
    $("#doneBtn").onclick = () => { toggleDone(id); keepPlace(() => viewTopic(id)); };
    // Một chạm: chỉ THÊM vào done (không đảo), rồi để link chuyển trang
    $("#goNext").onclick = () => { if (!done.has(id)) { done.add(id); store.set("ip.done", [...done]); } };
  }

  // Khối "Tiếp theo" cuối trang topic (A4); topic cuối giai đoạn thì thành "Hết giai đoạn" kèm chặng kiểm tra (A5)
  function nextCard(t, next, end) {
    const id = t.id, isDone = done.has(id);
    // "Hết giai đoạn" nằm ở topic bắt buộc cuối; nút chính nhảy qua chặng Đào sâu sang giai đoạn sau,
    // Đào sâu chỉ là link phụ (pager vẫn đi qua nó) — D29
    const req = t.stage.topics.filter((x) => !(byId[x].part && byId[x].part.optional));
    const lastOfStage = !t.stage.parallel && req[req.length - 1] === id;
    const deep = lastOfStage ? t.stage.topics.filter((x) => !req.includes(x)) : [];
    if (lastOfStage) next = MAIN.slice(MAIN.indexOf(t) + 1).find((x) => x.stage !== t.stage);
    const ck = lastOfStage ? checkpoint(t.stage) : [];
    const verb = !next ? end.label.replace(" →", "").toLowerCase()
      : next.stage !== t.stage ? `sang Giai đoạn ${stageNum(next.stage)}: ${next.stage.title}` : "sang bài tiếp";
    const label = (isDone ? verb[0].toUpperCase() + verb.slice(1) : `✓ Đã nắm, ${verb}`) + " →";
    // Bài sắp mở: dùng topic này và chỉ còn thiếu tối đa 1 chủ đề khác
    const soon = problemsFor(id).filter((p) => !done.has(`p:${p.id}`) && missing(p).filter((x) => x !== id).length <= 1).slice(0, 2);
    return `<section class="panel next-card" aria-labelledby="nextH">
      <h2 id="nextH" class="nc-h">${lastOfStage ? `Hết giai đoạn ${stageNum(t.stage)} · ${esc(t.stage.title)}` : "Tiếp theo"}</h2>
      ${ck.length ? `<p class="small">Kiểm tra chặng trước khi đi tiếp (tự làm 15–20 phút mỗi bài):</p>
        <div class="rm-chips">${ck.map((p) => `<a class="chip" href="#/p/${p.id}">${esc(p.title)} · ${LEVELS[p.level]}</a>`).join("")}</div>` : ""}
      <div class="nc-btns">
        <a class="btn primary" id="goNext" href="${next ? `#/t/${next.id}` : end.href}">${esc(label)}</a>
        <button class="btn ${isDone ? "done" : ""}" id="doneBtn" aria-pressed="${isDone}">${isDone ? "✓ Đã nắm" : "Chỉ đánh dấu đã nắm"}</button>
      </div>
      ${deep.length ? `<div class="small"><span class="muted">Đào sâu (tuỳ chọn):</span> ${deep.map((x) => `<a href="#/t/${x}">${esc(byId[x].title)}</a>`).join(", ")}</div>` : ""}
      ${next && !lastOfStage ? `<div class="small"><span class="muted">Tiếp:</span> ${esc(next.title)}${next.goal ? ` — ${inline(next.goal)}` : ""}</div>` : ""}
      ${(() => { const opens = ALL.filter((x) => (x.needs || []).includes(id)); return opens.length ? `<div class="small"><span class="muted">Bài này mở đường cho:</span> ${opens.map((x) => `<a href="#/t/${x.id}">${esc(x.title)}</a>`).join(", ")}</div>` : ""; })()}
      ${soon.length ? `<div class="small"><span class="muted">Sắp mở:</span> ${soon.map((p) => { const rest = missing(p).filter((x) => x !== id);
        return `<a href="#/p/${p.id}">${esc(p.title)}</a> · ${LEVELS[p.level]} ${rest.length ? `(còn ${esc(byId[rest[0]].title)})` : isDone ? "(đã đủ nền)" : "(đủ nền sau bài này)"}`; }).join("; ")}</div>` : ""}
    </section>`;
  }

  // ── Bài luyện ──
  function viewProblems() {
    setNav("problems", sideProblems("all"));
    main.innerHTML = `
      <h1>Luyện bài System Design</h1>
      <p class="lead">Tự làm trước, xem lời giải sau: nói Requirements → HLD trong 15–20 phút, rồi so với HLD mẫu và đáp án Deep Dives. Bài nào cũng đi đủ Delivery Framework.</p>
      <div class="filter" role="group" aria-label="Lọc bài">
        ${[["all", `Tất cả (${PROBLEMS.length})`], ["ready", `Đã đủ nền (${PROBLEMS.filter(isReady).length})`], ["todo", `Chưa luyện (${PROBLEMS.filter((p) => !done.has(`p:${p.id}`)).length})`]]
          .map(([f, l]) => `<button class="chip ${f === "all" ? "on" : ""}" data-f="${f}" aria-pressed="${f === "all"}">${l}</button>`).join("")}
      </div>
      ${[1, 2, 3].map((l) => `<section class="lvl-sec">
        <h2>${levelBadge(l)} <span class="muted small">${{ 1: "ít thành phần, một pattern chính", 2: "nhiều luồng, phải chọn trade-off rõ", 3: "nhiều pattern kết hợp, deep dive khó" }[l]}</span></h2>
        <div class="grid">${PROBLEMS.filter((p) => p.level === l).map((p) => `
          <a class="panel sim-card" href="#/p/${p.id}" data-ready="${isReady(p)}" data-done="${done.has(`p:${p.id}`)}">
            <div class="t"><span class="sb-dot ${done.has(`p:${p.id}`) ? "done" : ""}" style="display:inline-block;margin-right:6px"></span>${esc(p.title)} ${readyBadge(p)}</div>
            <div class="s">${noTip(p.summary)}</div>
            <div class="tags">${p.topics.map((id) => needChip(id, "span")).join("")}</div>
          </a>`).join("")}</div></section>`).join("")}
      <div class="empty" id="filterEmpty" hidden></div>`;
    // Lọc trong trang, không ghi vào URL (Q5)
    main.querySelector(".filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (!b) return;
      const f = b.dataset.f;
      main.querySelectorAll(".filter [data-f]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      main.querySelectorAll(".sim-card").forEach((c) => (c.hidden = (f === "ready" && c.dataset.ready !== "true") || (f === "todo" && c.dataset.done === "true")));
      main.querySelectorAll(".lvl-sec").forEach((s) => (s.hidden = !s.querySelector(".sim-card:not([hidden])")));
      const empty = $("#filterEmpty"), none = !main.querySelector(".sim-card:not([hidden])");
      empty.hidden = !none;
      if (none) {
        const h = practiceHint();
        empty.innerHTML = f === "ready"
          ? `Chưa bài nào đủ nền: bấm “Đã nắm” ở cuối mỗi chủ đề để mở bài.${h ? ` Gần nhất: ${h.list.map((p) => `<a href="#/p/${p.id}">${esc(p.title)}</a> (còn thiếu ${missing(p).length})`).join(", ")}.` : ""}`
          : "Đã luyện hết mọi bài.";
      }
    });
  }

  function viewProblem(id) {
    const p = pById[id];
    if (!p) return viewProblems();
    const key = `p:${id}`;
    setNav("problems", sideProblems(id));
    refs = new Map();
    const i = PROBLEMS.indexOf(p), prev = PROBLEMS[i - 1], next = PROBLEMS[i + 1];
    const sims = (p.sims || []).map((sid) => simById[sid]).filter(Boolean);
    const lvl = (k, text, w) => `<div class="dd-col dd-${k}"><b>${{ bad: "Bad", good: "Good", great: "Great" }[k]}</b>${inline(text)}${w ? `<div class="why"><b>Vì sao</b>${inline(w)}</div>` : ""}</div>`;
    main.innerHTML = `
      <div class="crumb"><a href="#/problems">Luyện bài</a> · ${LEVELS[p.level]}</div>
      <h1>${esc(p.title)}</h1>
      <p class="lead">${inline(p.summary)}</p>
      <div class="prob-meta">
        ${levelBadge(p.level)}
        <a class="chip" href="https://www.hellointerview.com/learn/system-design/problem-breakdowns/${p.hi}" target="_blank" rel="noopener">Bản gốc Hello Interview ↗</a>
      </div>
      <div class="needs"><span class="muted">Cần nắm trước:</span> ${p.topics.map((tid) => needChip(tid)).join("")}</div>
      ${(() => { const m = missing(p).sort((a, b) => mainIdx(a) - mainIdx(b))[0]; return m ? `<p class="muted small needs-hint">Nên đọc <a href="#/t/${m}">${esc(byId[m].title)}</a> trước (không bắt buộc).</p>` : ""; })()}
      <div class="panel practice-hint">Tự làm 15–20 phút trước khi đọc tiếp: liệt kê requirements, entities, API, phác HLD ra giấy.</div>

      <h2><span class="h-n">1</span>Requirements</h2>
      <div class="req-grid">
        <div class="panel"><div class="req-h">Functional</div><ul class="tips">${p.fr.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>
        <div class="panel"><div class="req-h">Non-functional</div><ul class="tips">${p.nfr.map((x) => `<li>${inline(txt(x))}${whyLine(x.why)}</li>`).join("")}</ul></div>
      </div>
      ${p.capacity ? `<div class="panel cap"><b>Ước lượng nhanh</b>${inline(p.capacity)}</div>` : ""}

      <h2><span class="h-n">2</span>Core Entities</h2>
      <div class="prob-meta">${p.entities.map((e) => `<span class="chip on">${esc(e)}</span>`).join("")}</div>

      <h2><span class="h-n">3</span>API</h2>
      <pre class="api">${p.api.map(esc).join("\n")}</pre>

      <h2><span class="h-n">4</span>High-Level Design</h2>
      ${p.hldWhy ? `<div class="panel why-hld"><b>Vì sao kiến trúc như vậy</b>${inline(p.hldWhy)}</div>` : ""}
      ${(p.diagrams || []).map(figure).join("")}${simBox(p.hld)}

      <h2><span class="h-n">5</span>Deep Dives</h2>
      <p class="muted small">Trả lời từng câu trước, rồi mới mở 3 mức đáp án.</p>
      ${p.deep.map((d, k) => `<details class="panel dd"><summary class="dd-q">${k + 1}. ${inSummary(d.q)}</summary>
        <div class="dd-grid">${(() => { const w = d.why || {}; return lvl("bad", d.bad, w.bad) + lvl("good", d.good, w.good) + lvl("great", d.great, w.great); })()}</div></details>`).join("")}

      ${sims.length ? `<h2><span class="h-n">+</span>Mô phỏng liên quan</h2>${sims.map(simBox).join("")}` : ""}

      <div class="topic-actions"><button class="btn ${done.has(key) ? "done" : "primary"}" id="doneBtn">${done.has(key) ? "✓ Đã luyện xong" : "Đánh dấu đã luyện xong"}</button></div>
      <div class="pager">
        ${prev ? `<a href="#/p/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a href="#/p/${next.id}" style="text-align:right">${esc(next.title)} →</a>` : "<span></span>"}
      </div>
      ${refList()}`;
    mountAll([p.hld, ...sims]);
    abbrBox(main.querySelector(".needs-hint") || main.querySelector(".needs"));
    $("#doneBtn").onclick = () => { toggleDone(key); keepPlace(() => viewProblem(id)); };
  }

  // ── Thư viện mô phỏng ──
  // A9: sim thuộc giai đoạn của topic đứng sớm nhất trong ORDER (không theo topics[0])
  const simTopic = (s) => s.topics.map((id) => byId[id]).filter(Boolean).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0];
  const simStage = (s) => { const t = simTopic(s); return t && t.stage; };
  function viewSims() {
    setNav("sims", sideKnowledge(null));
    main.innerHTML = `
      <h1>Thư viện mô phỏng</h1>
      <p class="lead">${SIMS.length} mô phỏng chạy trực tiếp, xếp theo giai đoạn lộ trình. Mỗi mô phỏng cũng có trong trang chủ đề tương ứng.</p>
      ${STAGES.filter((s) => s.topics.length).map((st) => {
        const list = SIMS.filter((s) => simStage(s) === st);
        if (!list.length) return "";
        const card = (s) => `
          <a class="panel sim-card" href="#/sim/${s.id}">
            <div class="t">${esc(s.title)}</div>
            <div class="s">${noTip(s.scenario)}</div>
            <div class="tags">${s.topics.filter((id) => byId[id]).map((id) => `<span class="chip">${esc(byId[id].title)}</span>`).join("")}</div>
          </a>`;
        // Có chặng: nhóm con theo chặng của topic đứng sớm nhất (B1)
        const groups = st.parts ? st.parts.map((p) => [p, list.filter((s) => simTopic(s).part === p)]).filter(([, l]) => l.length) : [[null, list]];
        return `<h2>${stageNum(st)} · ${esc(st.title)}</h2>${groups.map(([p, l]) => `${p ? `<h3>${esc(p.title)}</h3>` : ""}<div class="grid">${l.map(card).join("")}</div>`).join("")}`;
      }).join("")}`;
  }

  function viewSim(id) {
    const sim = simById[id];
    if (!sim) return viewSims();
    setNav("sims", sideKnowledge(sim.topics[0]));
    refs = new Map();
    main.innerHTML = `
      <div class="crumb"><a href="#/sims">Mô phỏng</a> · ${esc(sim.title)}</div>
      <h1 class="sr-only">${esc(sim.title)}</h1>
      ${simBox(sim)}
      <div class="topic-actions">${sim.topics.filter((tid) => byId[tid]).map((tid) => `<a class="btn" href="#/t/${tid}">Ôn chủ đề: ${esc(byId[tid].title)}</a>`).join("")}</div>
      ${(() => { const uses = PROBLEMS.filter((p) => (p.sims || []).includes(id)); return uses.length ? `<div class="apply sim-uses"><span class="muted">Dùng trong bài:</span> ${uses.map((p) => `<a class="chip" href="#/p/${p.id}">${esc(p.title)}</a>`).join("")}</div>` : ""; })()}
      ${refList()}`;
    mountAll([sim]);
  }

  // ── Thuật ngữ ──
  function viewGlossary() {
    setNav("glossary", sideKnowledge(null));
    const total = Object.keys(GL).length;
    main.innerHTML = `
      <h1>Thuật ngữ viết tắt</h1>
      <p class="lead">${total} từ viết tắt. Ở mọi trang, rê chuột hoặc chạm vào từ gạch chấm để xem nghĩa.</p>
      <input id="glFilter" class="gl-filter" type="search" aria-label="Lọc thuật ngữ" placeholder="Lọc: LRU, TTL, Kafka…" autocomplete="off">
      <div id="glList"></div>`;
    // Từ khoá truyền từ kết quả tìm kiếm (trong bộ nhớ, không thêm route)
    const q0 = glPrefill;
    glPrefill = "";
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
    $("#glFilter").value = q0;
    render(q0);
    $("#glFilter").addEventListener("input", (e) => render(e.target.value));
  }

  // ── Tìm kiếm ──
  function viewSearch(q) {
    setNav(null, sideKnowledge(null));
    if ($("#search").value.trim() !== q) $("#search").value = q; // mở thẳng #/search/x thì ô tìm vẫn hiện từ khoá
    const needle = q.toLowerCase();
    const textOf = (t) => [t.title, txt(t.tldr), ...(t.points || []).map(txt), ...(t.tips || []).map(txt),
      ...[t.table, t.table2, ...(t.sections || []).map((s) => s.table)].filter(Boolean).flatMap((x) => [...x.head, ...x.rows.flatMap(cellsOf)]),
      ...(t.sections || []).flatMap((s) => [s.title, ...(s.points || []).map(txt)]), ...(t.cards || []).flat()];
    // A8: chủ đề, bài, mô phỏng, thuật ngữ. Xếp hạng: khớp tiêu đề (0) > khớp tóm tắt (1) > khớp thân (2); cùng hạng giữ thứ tự gốc
    const has = (s) => !!s && s.toLowerCase().includes(needle);
    const hit = (type, href, title, where, head, lead, body, gl) => {
      const m = [...new Set([lead, ...body])].filter((s) => s !== title && has(s));
      // Chỉ khớp tiêu đề thì hiện tóm tắt (với thuật ngữ: nghĩa) làm đoạn trích
      return (m.length || has(head)) && { type, href, title, where, m: m.length ? m : [lead].filter(Boolean), gl, rank: has(head) ? 0 : has(lead) ? 1 : 2 };
    };
    const hits = [
      ...ORDER.map((t) => hit("Chủ đề", `#/t/${t.id}`, t.title, placeText(t), t.title, t.goal || txt(t.tldr), [txt(t.tldr), ...textOf(t)])),
      ...PROBLEMS.map((p) => hit("Bài", `#/p/${p.id}`, p.title, LEVELS[p.level], p.title, p.summary, [...p.fr, ...p.nfr.map(txt), ...p.entities, ...p.api, ...p.deep.flatMap((d) => [d.q, d.bad, d.good, d.great])])),
      ...SIMS.map((s) => hit("Mô phỏng", `#/sim/${s.id}`, s.title, byId[s.topics[0]] ? byId[s.topics[0]].title : "", s.title, s.scenario, [s.context])),
      ...Object.values(GL).map((g) => hit("Thuật ngữ", "#/glossary", `${g.k} · ${g.full}`, g.group, `${g.k} ${g.full}`, g.vi, [g.ex], g.k)),
    ].filter(Boolean).sort((a, b) => a.rank - b.rank);
    // Bỏ tooltip trong kết quả tìm kiếm và chỉ tô sáng phần chữ, không đụng vào thẻ HTML
    const hl = (s) => plain(s.replace(/^[+!] /, "")).replace(/<abbr[^>]*>([^<]*)<\/abbr>/g, "$1")
      .replace(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![^<]*>)`, "gi"), "<mark>$1</mark>");
    main.innerHTML = `<h1>Kết quả cho “${esc(q)}”</h1><p class="lead">${hits.length} kết quả</p>
      ${hits.map((x) => `<a class="panel search-hit" href="${x.href}"${x.gl ? ` data-gl="${esc(x.gl)}"` : ""}>
        <div class="t"><span class="type-badge">${x.type}</span>${esc(x.title)} <span class="s">· ${esc(x.where)}</span></div>
        <div class="s">${x.m.slice(0, 2).map(hl).join(" · ")}</div></a>`).join("") || `<div class="empty">Không tìm thấy “${esc(q)}”.<br>Thử từ khoá ngắn hơn hoặc tên tiếng Anh (vd. <a href="#/search/cache">cache</a>, <a href="#/search/kafka">kafka</a>), hoặc tra từ viết tắt ở <a href="#/glossary">Thuật ngữ</a>.</div>`}`;
  }

  let glPrefill = "";
  main.addEventListener("click", (e) => { const a = e.target.closest("[data-gl]"); if (a) glPrefill = a.dataset.gl; });

  // ── Router ──
  function route() {
    render();
    const h1 = main.querySelector("h1");
    document.title = h1 ? `${h1.textContent} · Backend Knowledge` : "Backend Knowledge";
  }
  function render() {
    const h = decodeURIComponent(location.hash.slice(1) || "/");
    if (h.startsWith("/t/")) return viewTopic(h.slice(3));
    // replace: không để lại mục #/learn trong lịch sử, nếu không Back sẽ bị đẩy tới lại
    if (h === "/learn") { location.replace(nextStep().href); return; }
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
    searchTimer = setTimeout(() => {
      const h = v ? `#/search/${encodeURIComponent(v)}` : "#/";
      // Đang ở trang tìm kiếm thì thay mục lịch sử: Back đưa về trang trước khi tìm, không đi qua từng lần gõ
      if (location.hash.startsWith("#/search/")) location.replace(h); else location.hash = h;
    }, 200);
  });

  route();
})();
