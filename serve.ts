const root = `${import.meta.dir}/dist`;
const port = Number(process.env.PORT ?? 4173);

const types: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  webmanifest: "application/manifest+json",
  png: "image/png",
};

interface Entry {
  raw: Uint8Array<ArrayBuffer>;
  br?: Uint8Array<ArrayBuffer>;
  zst?: Uint8Array<ArrayBuffer>;
  gz?: Uint8Array<ArrayBuffer>;
  headers: Record<string, string>;
}

const table = new Map<string, Entry>();
for (const file of new Bun.Glob("**/*").scanSync({ cwd: root, onlyFiles: true })) {
  if (/\.(gz|br|zst)$/.test(file)) continue;
  const ext = file.split(".").pop()!;
  const immutable = file.startsWith("a/") || /-[a-z0-9]{8,}\.js$/.test(file);
  const load = (suffix: string) => Bun.file(`${root}/${file}${suffix}`).bytes();
  const compressed = ext !== "png";
  table.set(`/${file}`, {
    raw: await load(""),
    br: compressed ? await load(".br") : undefined,
    zst: compressed ? await load(".zst") : undefined,
    gz: compressed ? await load(".gz") : undefined,
    headers: {
      "content-type": types[ext] ?? "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      vary: "accept-encoding",
    },
  });
}

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch(req) {
    const path = new URL(req.url).pathname;
    const entry = table.get(path === "/" ? "/index.html" : path);
    if (!entry) return new Response("없는 경로입니다", { status: 404 });
    const accept = req.headers.get("accept-encoding") ?? "";
    if (entry.zst && accept.includes("zstd")) return new Response(entry.zst, { headers: { ...entry.headers, "content-encoding": "zstd" } });
    if (entry.br && accept.includes("br")) return new Response(entry.br, { headers: { ...entry.headers, "content-encoding": "br" } });
    if (entry.gz && accept.includes("gzip")) return new Response(entry.gz, { headers: { ...entry.headers, "content-encoding": "gzip" } });
    return new Response(entry.raw, { headers: entry.headers });
  },
});

console.log(`http://localhost:${port}`);
