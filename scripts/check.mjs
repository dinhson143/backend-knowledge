// Kiểm tra toàn bộ nội dung. Chạy: node scripts/check.mjs  (thoát 1 khi có lỗi)
// Nạp đúng các <script> mà index.html nạp (trừ app.js) vào vm với window = {}.
// Luật lấy từ docs/content-system.md §4. Phát hiện loại lỗi mới → thêm một kiểm tra ở đây.
// ponytail: chưa kiểm tra manifest/kích thước file content/ — thêm ở bước 2 khi có content/.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");

// ── Nạp, ghi nhớ global nào do file nào định nghĩa ──
const files = [...read("index.html").matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== "app.js");
const ctx = vm.createContext({ window: {} });
const fileOf = {};
for (const f of files) {
  const before = new Set(Object.keys(ctx.window));
  vm.runInContext(read(f), ctx, { filename: f });
  Object.keys(ctx.window).filter((k) => !before.has(k)).forEach((k) => (fileOf[k] = f));
}
const W = ctx.window;

const errors = [];
const err = (global, path, msg) => errors.push(`${fileOf[global] || global}:${path} → ${msg}`);

// ── Index ──
const topics = {}, sections = {}, sims = {}, problems = {};
const dup = (map, id, g, path, what) => { if (map[id]) err(g, path, `trùng ${what} id "${id}"`); };
W.TRACKS.forEach((tr, a) => tr.sections.forEach((sec, b) => {
  dup(sections, sec.id, "TRACKS", `${tr.id}.${sec.id}`, "section"); sections[sec.id] = sec;
  sec.topics.forEach((tp) => { dup(topics, tp.id, "TRACKS", tp.id, "topic"); topics[tp.id] = tp; });
}));
W.SIMS.forEach((s) => { dup(sims, s.id, "SIMS", s.id, "sim"); sims[s.id] = s; });
W.PROBLEMS.forEach((p) => {
  dup(problems, p.id, "PROBLEMS", p.id, "problem"); problems[p.id] = p;
  if (p.hld) { dup(sims, p.hld.id, "PROBLEMS", `${p.id}.hld`, "sim"); sims[p.hld.id] = p.hld; }
});

// ── Tham chiếu ──
const ref = (map, id, g, path, what) => { if (!map[id]) err(g, path, `${what} "${id}" không tồn tại`); };
const inRoadmap = new Set();
W.ROADMAP.forEach((st) => (st.topics || []).forEach((id) => { inRoadmap.add(id); ref(topics, id, "ROADMAP", st.id, "topic"); }));
Object.keys(topics).filter((id) => !inRoadmap.has(id)).forEach((id) => err("TRACKS", id, "topic không có trong ROADMAP (rơi vào \"Khác\")"));
Object.values(topics).forEach((t) => (t.related || []).forEach((sid) => ref(sims, sid, "TRACKS", `${t.id}.related`, "sim")));
W.SIMS.forEach((s) => s.topics.forEach((id) => ref(topics, id, "SIMS", `${s.id}.topics`, "topic")));
W.PROBLEMS.forEach((p) => {
  p.topics.forEach((id) => ref(topics, id, "PROBLEMS", `${p.id}.topics`, "topic"));
  (p.sims || []).forEach((sid) => ref(sims, sid, "PROBLEMS", `${p.id}.sims`, "sim"));
});

// ── Giải thích ghép theo chỉ số: chỉ số trong phạm vi và key là tiền tố của chuỗi gốc ──
const norm = (s) => String(s).replace(/^[+!] /, "").replace(/\s+/g, " ").trim();
const aligned = (g, path, src, key) => {
  if (src == null) return err(g, path, "chỉ số ngoài phạm vi");
  if (key != null && !norm(src).startsWith(norm(key))) err(g, path, `lệch: key "${norm(key).slice(0, 40)}…" ≠ gốc "${norm(src).slice(0, 40)}…"`);
};
const rows = (t) => (t ? t.rows : []);
for (const [id, w] of Object.entries(W.WHY)) {
  const t = topics[id];
  if (!t) { err("WHY", id, "topic không tồn tại"); continue; }
  (w.points || []).forEach((x) => aligned("WHY", `${id}.points[${x.i}]`, t.points?.[x.i], x.key));
  (w.tips || []).forEach((x) => aligned("WHY", `${id}.tips[${x.i}]`, t.tips?.[x.i], x.key));
  for (const tb of ["table", "table2"]) (w[tb] || []).forEach((x) => aligned("WHY", `${id}.${tb}[${x.row}]`, rows(t[tb])[x.row]?.[0], x.key));
  (w.sections || []).forEach((ws) => {
    const s = t.sections?.[ws.s];
    if (!s) return err("WHY", `${id}.sections[${ws.s}]`, "chỉ số ngoài phạm vi");
    if (ws.title != null) aligned("WHY", `${id}.sections[${ws.s}].title`, s.title, ws.title);
    (ws.points || []).forEach((x) => aligned("WHY", `${id}.sections[${ws.s}].points[${x.i}]`, s.points?.[x.i], x.key));
    (ws.table || []).forEach((x) => aligned("WHY", `${id}.sections[${ws.s}].table[${x.row}]`, rows(s.table)[x.row]?.[0], x.key));
  });
}
for (const [id, w] of Object.entries(W.PWHY)) {
  const p = problems[id];
  if (!p) { err("PWHY", id, "problem không tồn tại"); continue; }
  (w.nfr || []).forEach((x) => aligned("PWHY", `${id}.nfr[${x.i}]`, p.nfr?.[x.i], x.key));
  (w.deep || []).forEach((x) => aligned("PWHY", `${id}.deep[${x.i}]`, p.deep?.[x.i]?.q, x.key));
}
const variantsOf = (s) => s.variants || [{ name: null, steps: s.steps || [] }];
for (const [id, d] of Object.entries(W.SIM_DETAIL)) {
  const s = sims[id];
  if (!s) { err("SIM_DETAIL", id, "sim không tồn tại"); continue; }
  const vs = variantsOf(s);
  (d.variants || []).forEach((dv) => {
    const v = vs[dv.v];
    if (!v) return err("SIM_DETAIL", `${id}.variants[${dv.v}]`, "chỉ số ngoài phạm vi");
    if (dv.name != null && dv.name !== v.name) err("SIM_DETAIL", `${id}.variants[${dv.v}]`, `lệch tên variant "${dv.name}" ≠ "${v.name}"`);
    (dv.steps || []).forEach((x) => aligned("SIM_DETAIL", `${id}.v${dv.v}.steps[${x.i}]`, v.steps?.[x.i]?.note, x.key));
  });
}

// ── Sim dạng flow: node id có thật, kind hợp lệ ──
const KINDS = new Set(["req", "ok", "err", "warn"]);
for (const s of Object.values(sims)) {
  if (s.custom) continue;
  const g = problems[s.id.replace(/^hld-/, "")] ? "PROBLEMS" : "SIMS";
  variantsOf(s).forEach((v, vi) => {
    const ids = new Set((v.nodes || s.nodes || []).map((n) => n.id));
    const node = (id, path) => { if (!ids.has(id)) err(g, `${s.id}.v${vi}.${path}`, `node "${id}" không tồn tại`); };
    (v.links || s.links || []).forEach(([a, b], k) => { node(a, `links[${k}]`); node(b, `links[${k}]`); });
    (v.steps || []).forEach((st, k) => {
      const msg = (m) => {
        if (m.par) return m.par.forEach(msg);
        node(m[0], `steps[${k}].msgs`); node(m[1], `steps[${k}].msgs`);
        if (m[3] && !KINDS.has(m[3])) err(g, `${s.id}.v${vi}.steps[${k}].msgs`, `kind "${m[3]}" không hợp lệ`);
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
// key = tiền tố đối chiếu (bị cắt, không hiển thị); files/run = code
const CODE_KEYS = new Set(["key", "files", "run", "id", "x", "y", "w", "h"]);
function walk(g, v, path) {
  if (typeof v === "string") {
    const ticks = (v.match(/`/g) || []).length;
    if (ticks % 2) return err(g, path, "backtick lẻ");
    const prose = v.replace(/`[^`]*`/g, "");
    if ((prose.match(/\*\*/g) || []).length % 2) err(g, path, "** lẻ");
    if (NO_DIACRITICS.test(prose)) err(g, path, `chữ không dấu: "${prose.match(NO_DIACRITICS)[0]}"`);
    return;
  }
  if (Array.isArray(v)) return v.forEach((x, i) => walk(g, x, `${path}[${i}]`));
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!CODE_KEYS.has(k)) walk(g, x, path ? `${path}.${k}` : k);
}
for (const g of Object.keys(fileOf)) walk(g, W[g], "");
const pointLists = (t) => [t.points, ...(t.sections || []).map((s) => s.points)].filter(Boolean);
Object.values(topics).forEach((t) => pointLists(t).flat().forEach((p, i) => {
  if (/^[+!](?! )/.test(p)) err("TRACKS", `${t.id}.points`, `tiền tố sai (chỉ "+ " hoặc "! "): "${p.slice(0, 30)}"`);
}));

// ── Kết quả ──
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n✗ ${errors.length} lỗi`);
  process.exit(1);
}
console.log(`✓ ${Object.keys(topics).length} topic · ${Object.keys(problems).length} problem · ${Object.keys(sims).length} sim — không có lỗi`);
