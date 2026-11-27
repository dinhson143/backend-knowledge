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
const inRoadmap = new Set();
W.ROADMAP.forEach((st) => (st.topics || []).forEach((id) => { inRoadmap.add(id); if (!topics[id]) at(fileOf.ROADMAP, st.id, `topic "${id}" không tồn tại`); }));
Object.keys(topics).filter((id) => !inRoadmap.has(id)).forEach((id) => E(id, id, "topic không có trong ROADMAP (rơi vào \"Khác\")"));
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
// files/run = code; còn lại là id, toạ độ, đường dẫn
const CODE_KEYS = new Set(["files", "run", "id", "x", "y", "w", "h", "src"]);
function walk(file, v, path) {
  if (typeof v === "string") {
    const ticks = (v.match(/`/g) || []).length;
    if (ticks % 2) return at(file, path, "backtick lẻ");
    const prose = v.replace(/`[^`]*`/g, "");
    if ((prose.match(/\*\*/g) || []).length % 2) at(file, path, "** lẻ");
    if (NO_DIACRITICS.test(prose)) at(file, path, `chữ không dấu: "${prose.match(NO_DIACRITICS)[0]}"`);
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

// ── content/: manifest khớp thư mục, kích thước file ──
const MAX = 40 * 1024;
const NOT_LOADED = new Set(["content/manifest.js", "content/_TEMPLATE.js"]);
const walkDir = (d) => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkDir(`${d}${e.name}/`) : [`${d}${e.name}`]));
const onDisk = walkDir("content/");
const jsOnDisk = onDisk.filter((f) => f.endsWith(".js") && !NOT_LOADED.has(f));
const inManifest = new Set(loaded.filter((f) => f.startsWith("content/") && f !== "content/manifest.js"));
jsOnDisk.filter((f) => !inManifest.has(f)).forEach((f) => at(f, "", "file không có trong content/manifest.js"));
jsOnDisk.forEach((f) => { const n = statSync(new URL(f, root)).size; if (n > MAX) at(f, "", `${Math.round(n / 1024)} KB > 40 KB — nên tách`); });
if (loaded.at(-1) !== "app.js") at("content/manifest.js", "FILES", "app.js phải là file nạp cuối cùng");

// ── Kết quả ──
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n✗ ${errors.length} lỗi`);
  process.exit(1);
}
console.log(`✓ ${Object.keys(topics).length} topic · ${Object.keys(problems).length} problem · ${Object.keys(sims).length} sim — không có lỗi`);
