#!/usr/bin/env bun
// Inline garden-data.json into garden-template.html -> ../site/index.html,
// and copy the static assets (favicon, OG image, robots.txt) alongside it.
//
// The `</` -> `<\/` escape is load-bearing: the data is embedded inside a
// <script type="application/json"> block, and any literal `</script>` in a
// tweet body would otherwise close that block early and corrupt the page.
// JSON.parse reads `<\/` as `</`, so the data is unchanged on the way out.
//
// The replacement is passed as a FUNCTION, not a string. String.replace treats
// `$$`, `$&`, `` $` `` and `$'` in a replacement STRING as escapes — an earlier
// build silently turned a tweet's `$$` into `$`. A function replacement has no
// such interpretation.
import fs from "node:fs";
import path from "node:path";

const DIR = import.meta.dir;
const SITE = path.join(DIR, "..", "site");

const template = fs.readFileSync(path.join(DIR, "garden-template.html"), "utf8");
const data = fs.readFileSync(path.join(DIR, "garden-data.json"), "utf8");
const escaped = data.replace(/<\//g, "<\\/");

if (!template.includes("/*__DATA__*/")) throw new Error("template is missing the /*__DATA__*/ placeholder");
const out = template.replace("/*__DATA__*/", () => escaped);

fs.mkdirSync(SITE, { recursive: true });
fs.writeFileSync(path.join(SITE, "index.html"), out);

// favicon.svg, og.png and robots.txt are checked in alongside it and served as-is.
console.log(`bundled -> site/index.html (${Buffer.byteLength(out)} bytes)`);
