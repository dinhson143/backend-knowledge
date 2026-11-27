// Kiểm tra toàn bộ nội dung. Chạy: node scripts/check.mjs  (thoát 1 khi có lỗi)
// Nạp đúng những gì index.html nạp: content/manifest.js rồi các file nó chèn (trừ app.js), trong vm với window = global.
// Luật lấy từ docs/content-system.md §4. Phát hiện loại lỗi mới → thêm một kiểm tra ở đây.
import { readFileSync, readdirSync, statSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");

const errors = [];
const at = (file, path, msg) => errors.push(`${file}:${path} → ${msg}`);

// ── Nạp, ghi nhớ global nào / mục BK nào do file nào định nghĩa ──
const ctx = vm.createContext({});
ctx.window = ctx;
const queue = [];
ctx.document = { createElement: () => ({}), head: { appendChild: (s) => queue.push(s.src) } };
const fileOf = {}, bkFile = new Map(), loaded = [];
const LISTS = ["tracks", "sections", "topics", "problems", "sims"];
function load(f) {
  loaded.push(f);
  if (f === "app.js") return;
  const before = new Set(Object.keys(ctx));
  const lens = ctx.BK ? LISTS.map((k) => ctx.BK[k].length) : LISTS.map(() => 0);
  let src;
  try { src = read(f); } catch { return at(f, "", "file trong danh sách nạp không tồn tại"); }
  try { vm.runInContext(src, ctx, { filename: f }); } catch (e) { at(f, "", e.message); }
  Object.keys(ctx).filter((k) => !before.has(k)).forEach((k) => (fileOf[k] = f));
  if (ctx.BK) LISTS.forEach((k, i) => ctx.BK[k].slice(lens[i]).forEach((x) => bkFile.set(x, f)));
}
for (const m of read("index.html").matchAll(/<script src="([^"]+)"/g)) load(m[1]);
while (queue.length) load(queue.shift());
const W = ctx;
if (!W.BK) { console.error("index.html phải nạp content/manifest.js"); process.exit(1); }
const BK = W.BK;
const fileIn = (x) => bkFile.get(x) || "?";

// Một ý: chuỗi hoặc { t, why }; dòng bảng: mảng ô hoặc { cells, why }
const txt = (p) => (typeof p === "string" ? p : p && p.t);
const cellsOf = (r) => (Array.isArray(r) ? r : r && r.cells);

// ── Index (registry đã báo trùng id trong cùng loại; ở đây bắt trùng giữa sim và hld) ──
const index = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const tracks = index(BK.tracks), sections = index(BK.sections), topics = index(BK.topics), problems = index(BK.problems);
const sims = {}, whereOf = {};
BK.topics.forEach((t) => (whereOf[t.id] = fileIn(t)));
BK.sims.forEach((s) => { sims[s.id] = s; whereOf[s.id] = fileIn(s); });
BK.problems.forEach((p) => {
  whereOf[p.id] = fileIn(p);
  if (!p.hld) return at(fileIn(p), p.id, "thiếu hld");
  if (sims[p.hld.id]) at(fileIn(p), `${p.id}.hld`, `trùng sim id "${p.hld.id}"`);
  sims[p.hld.id] = p.hld; whereOf[p.hld.id] = fileIn(p);
});
const E = (id, path, msg) => at(whereOf[id] || "?", path, msg);

// ── File đúng chỗ, đủ trường, track/section khớp ──
BK.sections.forEach((s) => { if (!tracks[s.track]) at(fileIn(s), s.id, `track "${s.track}" không tồn tại`); });
BK.topics.forEach((tp) => {
  const f = fileIn(tp), want = `content/topics/${tp.track}/${tp.id}.js`;
  if (f !== want) at(f, tp.id, `topic phải nằm ở ${want}`);
  if (!tracks[tp.track]) at(f, tp.id, `track "${tp.track}" không tồn tại`);
  const sec = sections[tp.section];
  if (!sec) at(f, tp.id, `section "${tp.section}" không tồn tại`);
  else if (sec.track !== tp.track) at(f, tp.id, `section "${tp.section}" thuộc track "${sec.track}", không phải "${tp.track}"`);
  if (!tp.title || !txt(tp.tldr)) at(f, tp.id, "thiếu title hoặc tldr");
});
BK.problems.forEach((p) => { const want = `content/problems/${p.id}.js`; if (fileIn(p) !== want) at(fileIn(p), p.id, `problem phải nằm ở ${want}`); });
BK.sims.forEach((s) => { const want = `content/sims/${s.id}.js`; if (fileIn(s) !== want) at(fileIn(s), s.id, `sim phải nằm ở ${want}`); });
// Dạng { t, why } / { cells, why }
const shapeP = (id, path, p) => { if (typeof p !== "string" && (typeof p?.t !== "string" || (p.why != null && typeof p.why !== "string"))) E(id, path, "ý phải là chuỗi hoặc { t, why }"); };
const shapeT = (id, path, t) => t && t.rows.forEach((r, i) => { if (!Array.isArray(cellsOf(r))) E(id, `${path}.rows[${i}]`, "dòng phải là mảng hoặc { cells, why }"); });
BK.topics.forEach((t) => {
  shapeP(t.id, "tldr", t.tldr);
  ["points", "tips"].forEach((k) => (t[k] || []).forEach((p, i) => shapeP(t.id, `${k}[${i}]`, p)));
  ["table", "table2"].forEach((k) => shapeT(t.id, k, t[k]));
  (t.sections || []).forEach((s, si) => { (s.points || []).forEach((p, i) => shapeP(t.id, `sections[${si}].points[${i}]`, p)); shapeT(t.id, `sections[${si}].table`, s.table); });
});
BK.problems.forEach((p) => p.nfr.forEach((x, i) => shapeP(p.id, `nfr[${i}]`, x)));

// ── Tham chiếu ──
const ref = (map, id, owner, path, what) => { if (!map[id]) E(owner, path, `${what} "${id}" không tồn tại`); };
// ROADMAP: giai đoạn có `parts` (chặng, id "<giai đoạn>.<tên>") hoặc `topics`, không cả hai (D20, D44)
const inRoadmap = new Map(), partIds = new Set(), RM = fileOf.ROADMAP;
W.ROADMAP.forEach((st) => {
  if (st.parts && st.topics) at(RM, st.id, "giai đoạn có cả parts lẫn topics");
  (st.parts || [{ id: st.id, topics: st.topics || [] }]).forEach((p) => {
    if (st.parts) {
      if (partIds.has(p.id)) at(RM, p.id, "trùng id chặng");
      partIds.add(p.id);
      if (!p.id?.startsWith(`${st.id}.`)) at(RM, p.id, `id chặng phải có dạng "${st.id}.<tên>"`);
      if (!p.topics?.length) at(RM, p.id, "chặng rỗng — chỉ thêm chặng cùng topic đầu tiên của nó");
    }
    (p.topics || []).forEach((id) => {
      if (inRoadmap.has(id)) at(RM, p.id, `topic "${id}" nằm ở hai chỗ`);
      inRoadmap.set(id, st);
      if (!topics[id]) at(RM, p.id, `topic "${id}" không tồn tại`);
    });
  });
});
Object.keys(topics).filter((id) => !inRoadmap.has(id)).forEach((id) => E(id, id, "topic không có trong ROADMAP (rơi vào \"Khác\")"));
// title ≤ 40 (sidebar, chip), goal ≤ 90 và khác title; needs ≤ 3, trỏ topic có thật, không vòng,
// và đứng trước khi cùng lộ trình chính hoặc cùng một nhánh (xuyên nhánh chỉ để hiển thị)
const rmOrder = [...inRoadmap.keys()];
const groupKey = (id) => { const st = inRoadmap.get(id); return st && (st.parallel ? st.id : "main"); };
Object.values(topics).forEach((t) => {
  if (t.title && t.title.length > 40) E(t.id, `${t.id}.title`, `${t.title.length} ký tự > 40`);
  if (t.goal != null && (typeof t.goal !== "string" || t.goal.length > 90 || t.goal === t.title)) E(t.id, `${t.id}.goal`, "goal phải là chuỗi ≤ 90 ký tự, khác title");
  const needs = t.needs || [];
  if (needs.length > 3) E(t.id, `${t.id}.needs`, "tối đa 3 tiên quyết trực tiếp");
  needs.forEach((id) => {
    if (!topics[id]) return E(t.id, `${t.id}.needs`, `topic "${id}" không tồn tại`);
    if (groupKey(id) === groupKey(t.id) && rmOrder.indexOf(id) > rmOrder.indexOf(t.id)) E(t.id, `${t.id}.needs`, `"${id}" đứng sau "${t.id}" trong ROADMAP`);
  });
});
const needState = {}; // 1 = đang duyệt, 2 = xong
const visit = (id, path) => {
  if (needState[id] === 1) return E(id, `${id}.needs`, `vòng tiên quyết: ${[...path, id].join(" → ")}`);
  if (needState[id] || !topics[id]) return;
  needState[id] = 1;
  (topics[id].needs || []).forEach((n) => visit(n, [...path, id]));
  needState[id] = 2;
};
Object.keys(topics).forEach((id) => visit(id, []));
Object.values(topics).forEach((t) => (t.related || []).forEach((sid) => ref(sims, sid, t.id, `${t.id}.related`, "sim")));
BK.sims.forEach((s) => s.topics.forEach((id) => ref(topics, id, s.id, `${s.id}.topics`, "topic")));
Object.values(problems).forEach((p) => {
  p.topics.forEach((id) => ref(topics, id, p.id, `${p.id}.topics`, "topic"));
  (p.sims || []).forEach((sid) => ref(sims, sid, p.id, `${p.id}.sims`, "sim"));
});

// ── Sim dạng flow: node id có thật, kind hợp lệ ──
const KINDS = new Set(["req", "ok", "err", "warn"]);
const variantsOf = (s) => s.variants || [{ name: null, steps: s.steps || [] }];
for (const s of Object.values(sims)) {
  if (s.custom) continue;
  variantsOf(s).forEach((v, vi) => {
    const ids = new Set((v.nodes || s.nodes || []).map((n) => n.id));
    const node = (id, path) => { if (!ids.has(id)) E(s.id, `${s.id}.v${vi}.${path}`, `node "${id}" không tồn tại`); };
    (v.links || s.links || []).forEach(([a, b], k) => { node(a, `links[${k}]`); node(b, `links[${k}]`); });
    (v.steps || []).forEach((st, k) => {
      const msg = (m) => {
        if (m.par) return m.par.forEach(msg);
        node(m[0], `steps[${k}].msgs`); node(m[1], `steps[${k}].msgs`);
        if (m[3] && !KINDS.has(m[3])) E(s.id, `${s.id}.v${vi}.steps[${k}].msgs`, `kind "${m[3]}" không hợp lệ`);
      };
      (st.msgs || []).forEach(msg);
      Object.keys(st.set || {}).forEach((id) => node(id, `steps[${k}].set`));
      [...(st.bad || []), ...(st.good || [])].forEach((id) => node(id, `steps[${k}].bad/good`));
      [...(st.cut || []), ...(st.uncut || [])].forEach(([a, b]) => { node(a, `steps[${k}].cut`); node(b, `steps[${k}].cut`); });
    });
  });
}

// ── Văn bản hiển thị: markup inline, tiền tố points, chữ không dấu ──
const NO_DIACRITICS = /\b(khong|duoc|nguoi|nhieu|truoc|chung ta|tuong|thuc hien|du lieu|he thong)\b/i;
// Giá dịch vụ (luật: không ghi giá). Số tiền trong kịch bản ("charge $50") vẫn được; giá theo đơn vị thì không.
const PRICE = /\$\s?\d[\d.,]*\s*(\/|mỗi|per\b)|≈\s*\$\d/i;
// files/run = code; còn lại là id, toạ độ, đường dẫn
const CODE_KEYS = new Set(["files", "run", "id", "x", "y", "w", "h", "src"]);
// URL trong câu: app.js tách thành chú thích [n] (D92). Nạp đúng hàm splitCites của app.js để kiểm tra
// URL đọc được, là https, và câu còn lại không sót "()" hay dấu câu treo sau khi tách.
const citeSrc = read("app.js").match(/\/\/ ── cite:start[\s\S]*?\/\/ ── cite:end/);
const splitCites = citeSrc ? vm.runInNewContext(`${citeSrc[0]}\nsplitCites`) : null;
if (!splitCites) at("app.js", "", "không tìm thấy đoạn cite:start … cite:end (check.mjs dùng splitCites)");
function checkCites(file, path, prose) {
  if (!splitCites) return;
  const { text, urls } = splitCites(prose);
  urls.forEach((u) => {
    let ok = false;
    try { ok = new URL(u).protocol === "https:"; } catch {}
    if (!ok) at(file, path, `URL nguồn hỏng hoặc không phải https: "${u}"`);
  });
  if (!urls.length) return;
  const left = text.replace(/\u0001\d+\u0002/g, "[n]");
  const bad = left.match(/\(\s*\)|\(\s*[,;:·—–]|[,;:—–]\s*\)/);
  if (bad) at(file, path, `câu sau khi tách URL còn "${bad[0]}" — viết URL trong ngoặc "(https://…)" hoặc sau "—", xem content-system §6`);
}
function walk(file, v, path) {
  if (typeof v === "string") {
    if (path.endsWith(".source") && /^https:\/\/\S+$/.test(v)) return; // source của sơ đồ: kiểm tra ở mục SVG
    v.split(/`[^`]*`/).forEach((seg) => checkCites(file, path, seg)); // như app.js: tách từng đoạn ngoài `code`
    const ticks = (v.match(/`/g) || []).length;
    if (ticks % 2) return at(file, path, "backtick lẻ");
    const prose = v.replace(/`[^`]*`/g, "");
    if ((prose.match(/\*\*/g) || []).length % 2) at(file, path, "** lẻ");
    if (NO_DIACRITICS.test(prose)) at(file, path, `chữ không dấu: "${prose.match(NO_DIACRITICS)[0]}"`);
    if (PRICE.test(prose)) at(file, path, `có giá tiền "${prose.match(PRICE)[0]}" — không ghi giá, trỏ tới trang giá chính thức`);
    return;
  }
  if (Array.isArray(v)) return v.forEach((x, i) => walk(file, x, `${path}[${i}]`));
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!CODE_KEYS.has(k)) walk(file, x, path ? `${path}.${k}` : k);
}
for (const g of Object.keys(fileOf)) if (g !== "BK") walk(fileOf[g], W[g], g);
for (const [x, f] of bkFile) walk(f, x, x.id);
const pointLists = (t) => [t.points, ...(t.sections || []).map((s) => s.points)].filter(Boolean);
Object.values(topics).forEach((t) => pointLists(t).flat().forEach((p) => {
  const s = txt(p) || "";
  if (/^[+!](?! )/.test(s)) E(t.id, `${t.id}.points`, `tiền tố sai (chỉ "+ " hoặc "! "): "${s.slice(0, 30)}"`);
}));

// ── Thuật ngữ: nhãn điều hướng không dùng cách dịch đã loại (docs/terminology.md §3, D106) ──
// Đọc cột 4 "Không dùng trong nhãn" của bảng giữa <!-- terminology:start/end -->; mỗi cụm trong "…".
// So nguyên cụm từ, không phân biệt hoa/thường (\b không hiểu chữ có dấu nên dùng \p{L}).
const TERMS = "docs/terminology.md";
const termTable = (() => { try { return read(TERMS); } catch { return ""; } })().match(/<!-- terminology:start -->([\s\S]*?)<!-- terminology:end -->/)?.[1] || "";
const norm = (s) => s.normalize("NFC").toLowerCase();
const banned = termTable.split("\n").filter((l) => l.startsWith("|")).flatMap((l) => {
  const c = l.split("|").slice(1, -1);
  if (c.length < 5) return [];
  const term = c[0].replace(/\*\*/g, "").trim();
  return [...c[3].matchAll(/"([^"]+)"/g)].map(([, p]) => [new RegExp(`(?<![\\p{L}\\p{N}])${norm(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u"), p, term]);
});
if (!banned.length) at(TERMS, "", "không đọc được cụm nào ở cột \"Không dùng trong nhãn\" giữa <!-- terminology:start --> và <!-- terminology:end -->");
const label = (file, path, title) => {
  if (typeof title !== "string") return;
  for (const [re, p, term] of banned) if (re.test(norm(title))) at(file, path, `nhãn "${title}" dùng "${p}" — dùng key term "${term}" (docs/terminology.md)`);
};
W.ROADMAP.forEach((st) => { label(RM, `${st.id}.title`, st.title); (st.parts || []).forEach((p) => label(RM, `${p.id}.title`, p.title)); });
BK.tracks.forEach((x) => label(fileIn(x), `${x.id}.title`, x.title));
BK.sections.forEach((x) => label(fileIn(x), `${x.id}.title`, x.title));
BK.topics.forEach((x) => label(fileIn(x), `${x.id}.title`, x.title));
BK.problems.forEach((x) => label(fileIn(x), `${x.id}.title`, x.title));
Object.values(sims).forEach((s) => label(whereOf[s.id], `${s.id}.title`, s.title));

// ── Glossary: mỗi viết tắt một lần (mục sau ghi đè mục trước mà không báo) ──
const glSeen = new Set();
(W.GLOSSARY || []).forEach((g) => g.items.forEach(([k]) => {
  if (glSeen.has(k)) at(fileOf.GLOSSARY || "content/glossary.js", k, `viết tắt "${k}" khai báo hai lần`);
  glSeen.add(k);
}));

// ── content/: manifest khớp thư mục, kích thước file ──
const MAX = 40 * 1024;
const NOT_LOADED = new Set(["content/manifest.js", "content/_TEMPLATE.js"]);
const walkDir = (d) => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkDir(`${d}${e.name}/`) : [`${d}${e.name}`]));
const onDisk = walkDir("content/");
const jsOnDisk = onDisk.filter((f) => f.endsWith(".js") && !NOT_LOADED.has(f));
const inManifest = new Set(loaded.filter((f) => f.startsWith("content/") && f !== "content/manifest.js"));
jsOnDisk.filter((f) => !inManifest.has(f)).forEach((f) => at(f, "", "file không có trong content/manifest.js"));
jsOnDisk.forEach((f) => { const n = statSync(new URL(f, root)).size; if (n > MAX) at(f, "", `${Math.round(n / 1024)} KB > 40 KB — nên tách`); });
// Sơ đồ SVG: diagrams: [{ src: "content/svg/<tên>.svg", caption, source? }] trên topic/problem
const svgOnDisk = onDisk.filter((f) => f.startsWith("content/svg/"));
const svgUsed = new Set();
[...BK.topics, ...BK.problems].forEach((x) => (x.diagrams || []).forEach((d, i) => {
  const path = `${x.id}.diagrams[${i}]`;
  if (!/^content\/svg\/[a-z0-9-]+\.svg$/.test(d.src || "")) return E(x.id, path, `src "${d.src}" phải có dạng content/svg/<tên-thường>.svg`);
  if (!svgOnDisk.includes(d.src)) E(x.id, path, `file "${d.src}" không tồn tại (so khớp cả hoa/thường)`);
  if (!d.caption) E(x.id, path, "thiếu caption (dùng làm alt của ảnh)");
  if (d.source && !/^https:\/\//.test(d.source)) E(x.id, path, "source phải là URL https");
  svgUsed.add(d.src);
}));
svgOnDisk.forEach((f) => {
  if (!f.endsWith(".svg")) return at(f, "", "content/svg/ chỉ chứa file .svg");
  if (!svgUsed.has(f)) at(f, "", "file SVG không được topic/problem nào tham chiếu");
  const s = read(f);
  // Thiếu xmlns thì <img> không hiển thị; thiếu nền thì chữ tối chìm trong theme tối (D11)
  if (!/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s)) at(f, "", 'thẻ <svg> thiếu xmlns="http://www.w3.org/2000/svg"');
  if (!/<svg[^>]*viewBox=/.test(s)) at(f, "", "thẻ <svg> thiếu viewBox");
  if (!/<rect[^>]*fill="#fff(fff)?"/i.test(s)) at(f, "", 'thiếu rect nền sáng (fill="#ffffff") — xem D11');
  // CSS của class thắng thuộc tính fill/stroke trên phần tử → màu riêng bị mất, phải dùng style="" (D50)
  const cls = {};
  for (const [, sel, body] of (s.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "").matchAll(/([^{}]+)\{([^}]*)\}/g))
    for (const [, c] of sel.matchAll(/\.([\w-]+)/g)) body.split(";").forEach((p) => (cls[c] ||= new Set()).add(p.split(":")[0].trim()));
  for (const [tag] of s.matchAll(/<\w+\b[^>]*\bclass="[^"]+"[^>]*>/g)) {
    const set = tag.match(/class="([^"]+)"/)[1].split(/\s+/).flatMap((c) => [...(cls[c] || [])]);
    for (const a of ["fill", "stroke", "stroke-width"])
      if (set.includes(a) && new RegExp(`\\s${a}="`).test(tag)) at(f, "", `thuộc tính ${a}="…" bị CSS của class ghi đè, dùng style="${a}:…": ${tag.slice(0, 80)}`);
  }
  if (statSync(new URL(f, root)).size > MAX) at(f, "", "SVG > 40 KB");
});
if (loaded.at(-1) !== "app.js") at("content/manifest.js", "FILES", "app.js phải là file nạp cuối cùng");

// ── Kết quả ──
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n✗ ${errors.length} lỗi`);
  process.exit(1);
}
console.log(`✓ ${Object.keys(topics).length} topic · ${Object.keys(problems).length} problem · ${Object.keys(sims).length} sim — không có lỗi`);
