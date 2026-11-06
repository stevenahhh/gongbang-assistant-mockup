import { brotliCompressSync, constants } from "node:zlib";
import { cp, rm } from "node:fs/promises";

const out = "dist";
await rm(out, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: out,
  target: "browser",
  minify: true,
  splitting: true,
  minChunkSize: 16384,
  sourcemap: "none",
  naming: { entry: "[name].[ext]", chunk: "a/[name]-[hash].[ext]", asset: "a/[name]-[hash].[ext]" },
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
});
if (!result.success) {
  console.error(result.logs);
  process.exit(1);
}

await cp("public", out, { recursive: true });

const htmlPath = `${out}/index.html`;
let html = await Bun.file(htmlPath).text();
const cssHref = html.match(/<link[^>]+href="\.?\/?([^"]+\.css)"[^>]*>/);
if (cssHref) {
  const css = await Bun.file(`${out}/${cssHref[1]}`).text();
  html = html.replace(cssHref[0], `<style>${css}</style>`);
  await rm(`${out}/${cssHref[1]}`);
}
html = html.replace("</head>", '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml"></head>');
await Bun.write(htmlPath, html);

const files = [...new Bun.Glob("**/*").scanSync({ cwd: out, onlyFiles: true })];
const hashed = files.filter((f) => f !== "index.html").map((f) => `/${f}`);
const version = Bun.hash(html + hashed.join()).toString(36);
const sw = await Bun.file("src/sw.js").text();
await Bun.write(`${out}/sw.js`, sw.replace("__VERSION__", version).replace('"__ASSETS__"', JSON.stringify(["/", "/index.html", ...hashed])));

let gzTotal = 0;
const report: [string, number, number][] = [];
for (const f of [...new Bun.Glob("**/*.{js,css,html,svg,webmanifest}").scanSync({ cwd: out })]) {
  const raw = await Bun.file(`${out}/${f}`).bytes();
  const gz = Bun.gzipSync(raw, { level: 9 });
  await Bun.write(`${out}/${f}.gz`, gz);
  await Bun.write(`${out}/${f}.br`, brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
  await Bun.write(`${out}/${f}.zst`, Bun.zstdCompressSync(raw, { level: 19 }));
  gzTotal += gz.length;
  report.push([f, raw.length, gz.length]);
}
report.sort((a, b) => b[1] - a[1]);
for (const [f, raw, gz] of report) console.log(`${String(raw).padStart(8)} ${String(gz).padStart(7)}  ${f}`);
console.log(`bun ${Bun.version}, total gzip ${(gzTotal / 1024).toFixed(1)} KB`);
