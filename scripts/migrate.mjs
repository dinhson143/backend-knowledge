// Chạy MỘT LẦN để dời nội dung từ bố cục cũ sang content/ (docs/content-system.md §5, bước 3–4).
//   node scripts/migrate.mjs topics <track> [...]   TRACKS + WHY       → content/topics/<track>/<id>.js
//   node scripts/migrate.mjs problems              PROBLEMS + PWHY    → content/problems/<id>.js (hld + SIM_DETAIL)
//   node scripts/migrate.mjs sims                  SIMS + SIM_DETAIL  → content/sims/<id>.js
// Ghép "vì sao" vào cạnh từng ý theo chỉ số (check.mjs đã bảo đảm key khớp chỉ số), ghi file mới,
// viết lại file cũ bỏ phần đã dời, và sinh lại danh sách FILES trong content/manifest.js.
// Sau khi bố cục cũ bị xoá (bước 5) script này không còn việc gì — giữ lại làm hồ sơ.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8").replace(/\r\n/g, "\n");
const write = (f, s) => { mkdirSync(new URL(".", new URL(f, root)), { recursive: true }); writeFileSync(new URL(f, root), s); };

// ── Nạp như trình duyệt ──
const ctx = vm.createContext({});
ctx.window = ctx;
const queue = [];
ctx.document = { createElement: () => ({}), head: { appendChild: (s) => queue.push(s.src) } };
const load = (f) => f !== "app.js" && vm.runInContext(read(f), ctx, { filename: f });
for (const m of read("index.html").matchAll(/<script src="([^"]+)"/g)) load(m[1]);
while (queue.length) load(queue.shift());
const W = ctx, BK = W.BK;

// ── In JS dễ đọc: chuỗi luôn qua JSON.stringify, mục ngắn trên một dòng ──
const KEY = /^[A-Za-z_$][\w$]*$/;
function ser(v, ind = "") {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null || typeof v !== "object") return String(v);
  const inner = ind + "  ";
  const isArr = Array.isArray(v);
  const items = isArr ? v.map((x) => ser(x, inner))
    : Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${KEY.test(k) ? k : JSON.stringify(k)}: ${ser(x, inner)}`);
  const [o, c] = isArr ? ["[", "]"] : ["{ ", " }"];
  if (!items.length) return isArr ? "[]" : "{}";
  const one = isArr ? `[${items.join(", ")}]` : `{ ${items.join(", ")} }`;
  if (one.length + ind.length <= 110 && !one.includes("\n")) return one;
  return `${o.trim()}\n${items.map((x) => inner + x).join(",\n")},\n${ind}${c.trim()}`;
}
const call = (fn, obj) => `BK.${fn}(${ser(obj)});\n`;

// ── Ghép theo chỉ số (cùng ngữ nghĩa với app.js cũ) ──
const find = (arr, k, v) => (arr || []).find((x) => x[k] === v);
const wm = (arr, k = "i") => Object.fromEntries((arr || []).map((w) => [w[k], w.why]));
const pt = (s, why) => (why == null ? s : { t: s, why });
const tb = (t, m) => t && { head: t.head, rows: t.rows.map((r, i) => (m[i] == null ? r : { cells: r, why: m[i] })) };
function topicOf(tp, track, section) {
  const w = W.WHY[tp.id] || {};
  const o = {};
  for (const [k, v] of Object.entries(tp)) {
    if (k === "id") Object.assign(o, { id: v, track, section });
    else if (k === "tldr") Object.assign(o, { tldr: pt(v, w.tldr), story: w.story });
    else if (k === "points" || k === "tips") { const m = wm(w[k]); o[k] = v.map((p, i) => pt(p, m[i])); }
    else if (k === "table" || k === "table2") o[k] = tb(v, wm(w[k], "row"));
    else if (k === "sections") o[k] = v.map((s, si) => {
      const ws = find(w.sections, "s", si) || {}, m = wm(ws.points);
      return { ...s, points: s.points && s.points.map((p, i) => pt(p, m[i])), table: tb(s.table, wm(ws.table, "row")) };
    });
    else o[k] = v;
  }
  return o;
}
function simOf(s) {
  if (s.custom) return s; // renderer tuỳ biến không dùng SIM_DETAIL
  const d = W.SIM_DETAIL[s.id] || {};
  const steps = (arr, v) => arr.map((st, k) => { const x = find(find(d.variants, "v", v)?.steps, "i", k); return x ? { ...st, detail: x.detail } : st; });
  const o = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "scenario") Object.assign(o, { scenario: v, context: d.context });
    else if (k === "steps") o.steps = steps(v, 0);
    else if (k === "variants") o.variants = v.map((x, vi) => ({ ...x, steps: steps(x.steps, vi) }));
    else o[k] = v;
  }
  return o;
}
function problemOf(p) {
  const w = W.PWHY[p.id] || {}, m = wm(w.nfr);
  const o = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "nfr") o.nfr = v.map((x, i) => pt(x, m[i]));
    else if (k === "hld") Object.assign(o, { hldWhy: w.hld, hld: simOf(v) });
    else if (k === "deep") o.deep = v.map((d, i) => { const x = find(w.deep, "i", i); return x ? { ...d, why: { bad: x.bad, good: x.good, great: x.great } } : d; });
    else o[k] = v;
  }
  return o;
}

// ── Viết lại file cũ, bỏ phần đã dời ──
const before = (f, marker) => { const s = read(f), i = s.indexOf(marker); if (i < 0) throw new Error(`${f}: thiếu "${marker}"`); return s.slice(0, i); };
const after = (f, marker) => { const s = read(f), i = s.indexOf(marker); return i < 0 ? "" : s.slice(i); };
const js = (name, v, sp = 1) => `window.${name} = ${JSON.stringify(v, null, sp)};\n`;
const rewriteWhy = () => write("why.js", before("why.js", "window.WHY") + js("WHY", W.WHY) + "\n" + js("PWHY", W.PWHY));
const rewriteDetail = () => write("sim-detail.js", before("sim-detail.js", "window.SIM_DETAIL") + js("SIM_DETAIL", W.SIM_DETAIL));

// Thứ tự track gốc (data.js trước bước 3) — để tracks.js và manifest giữ đúng thứ tự cũ
const TRACK_ORDER = ["sd", "lld", "cloud", "arch", "dsa"];
const [cmd, ...args] = process.argv.slice(2);
const moved = { topics: [], problems: [], sims: [] };

if (cmd === "topics") {
  for (const id of args) {
    const tr = W.TRACKS.find((t) => t.id === id);
    if (!tr) throw new Error(`không có track "${id}" trong data.js`);
    BK.track({ id: tr.id, title: tr.title, subtitle: tr.subtitle });
    tr.sections.forEach((sec) => {
      BK.section({ id: sec.id, track: tr.id, title: sec.title });
      sec.topics.forEach((tp) => {
        const t = topicOf(tp, tr.id, sec.id);
        write(`content/topics/${tr.id}/${tp.id}.js`, call("topic", t));
        moved.topics.push(t);
        delete W.WHY[tp.id];
      });
    });
    W.TRACKS.splice(W.TRACKS.indexOf(tr), 1);
  }
  const tracks = TRACK_ORDER.map((id) => BK.tracks.find((t) => t.id === id)).filter(Boolean);
  write("content/tracks.js", "// Track (thư mục content/topics/<id>/) và section. Thứ tự section trong file = thứ tự trong track.\n" +
    tracks.map((t) => call("track", t) + BK.sections.filter((s) => s.track === t.id).map((s) => call("section", s)).join("")).join("\n"));
  write("data.js", before("data.js", "window.TRACKS") + js("TRACKS", W.TRACKS, 2) + "\n" + after("data.js", "/* Nhánh trên Miro"));
  rewriteWhy();
} else if (cmd === "problems") {
  W.PROBLEMS.forEach((p) => {
    const o = problemOf(p);
    write(`content/problems/${p.id}.js`, call("problem", o));
    moved.problems.push(o);
    delete W.PWHY[p.id];
    delete W.SIM_DETAIL[p.hld.id];
  });
  write("problems.js", before("problems.js", "window.PROBLEMS") + "window.PROBLEMS = [];\n\n" + after("problems.js", "/* So sánh với mục lục"));
  rewriteWhy(); rewriteDetail();
} else if (cmd === "sims") {
  W.SIMS.forEach((s) => {
    const o = simOf(s);
    write(`content/sims/${s.id}.js`, call("sim", o));
    moved.sims.push(o);
    delete W.SIM_DETAIL[s.id];
  });
  write("diagrams.js", before("diagrams.js", "window.SIMS") + "window.SIMS = [];\n");
  rewriteDetail();
} else {
  console.error("Dùng: node scripts/migrate.mjs topics <track>… | problems | sims");
  process.exit(1);
}

// ── Sinh lại FILES trong manifest: giữ thứ tự cũ (đã đăng ký trước + mới dời theo thứ tự mảng gốc) ──
const topicFiles = TRACK_ORDER.flatMap((tr) => [...BK.topics, ...moved.topics].filter((t) => t.track === tr).map((t) => `content/topics/${tr}/${t.id}.js`));
const uniq = (a) => [...new Set(a)];
const files = uniq([
  ...["content/glossary.js"].filter((f) => existsSync(new URL(f, root))),
  ...(BK.tracks.length ? ["content/tracks.js"] : []),
  ...topicFiles,
  ...[...BK.problems, ...moved.problems].map((p) => `content/problems/${p.id}.js`),
  ...[...BK.sims, ...moved.sims].map((s) => `content/sims/${s.id}.js`),
  ...["content/roadmap.js", "engine/diagrams.js"].filter((f) => existsSync(new URL(f, root))),
  "app.js",
]);
const man = read("content/manifest.js");
const out = man.replace(/const FILES = \[[\s\S]*?\n  \];/, `const FILES = [\n${files.map((f) => `    ${JSON.stringify(f)},`).join("\n")}\n  ];`);
if (out === man && !man.includes(files.at(-2))) throw new Error("không tìm thấy FILES trong manifest");
write("content/manifest.js", out);
console.log(`đã dời: ${moved.topics.length} topic · ${moved.problems.length} problem · ${moved.sims.length} sim → manifest ${files.length} file`);
