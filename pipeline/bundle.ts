#!/usr/bin/env bun
// Inline garden-data.json into garden-template.html -> ../site/index.html
//
// The `</` -> `<\/` escape is load-bearing: the data is embedded inside a
// <script type="application/json"> block, and any literal `</script>` in a
// tweet body would otherwise close that block early and corrupt the page.
// JSON.parse reads `<\/` as `</`, so the data is unchanged on the way out.
import fs from "node:fs";
import path from "node:path";

const DIR = import.meta.dir;
const template = fs.readFileSync(path.join(DIR, "garden-template.html"), "utf8");
const data = fs.readFileSync(path.join(DIR, "garden-data.json"), "utf8");
const escaped = data.replace(/<\//g, "<\\/");
const out = template.replace("/*__DATA__*/", () => escaped);

const dest = path.join(DIR, "..", "site", "index.html");
fs.writeFileSync(dest, out);
console.log(`bundled -> site/index.html (${out.length} bytes, ${data.length - escaped.length === 0 ? 0 : (escaped.length - data.length)} escape expansions)`);
