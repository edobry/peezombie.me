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
//
// The three functions below are exported and kept free of I/O so the round-trip
// can be tested against a synthetic payload. That matters because the corpus is
// not in the repo: a test that compares the built page against garden-data.json
// cannot run in CI, and for a while did not (see bundle.test.ts).
import fs from "node:fs";
import path from "node:path";

export const DATA_PLACEHOLDER = "/*__DATA__*/";
const SCRIPT_OPEN = '<script type="application/json" id="data">';

/** Escape `</` so a `</script>` inside the data cannot close the JSON block early. */
export function escapeForScriptBlock(data: string): string {
  return data.replace(/<\//g, "<\\/");
}

/** Inverse of escapeForScriptBlock — what a reader does to recover the payload. */
export function unescapeFromScriptBlock(embedded: string): string {
  return embedded.replace(/<\\\//g, "</");
}

/**
 * Inline `data` into `template` at the placeholder. The replacement is a
 * function so that `$$`, `$&`, `` $` `` and `$'` in the data are inserted
 * literally rather than interpreted as String.replace escapes.
 */
export function embedData(template: string, data: string): string {
  if (!template.includes(DATA_PLACEHOLDER)) {
    throw new Error(`template is missing the ${DATA_PLACEHOLDER} placeholder`);
  }
  return template.replace(DATA_PLACEHOLDER, () => escapeForScriptBlock(data));
}

/** Pull the embedded payload back out of a built page, undoing the `<\/` escape. */
export function extractEmbeddedPayload(html: string): string {
  const a = html.indexOf(SCRIPT_OPEN);
  if (a === -1) throw new Error("built page has no JSON data block");
  const start = a + SCRIPT_OPEN.length;
  const end = html.indexOf("</script>", start);
  if (end <= start) throw new Error("built page's JSON data block is unterminated");
  return unescapeFromScriptBlock(html.slice(start, end));
}

if (import.meta.main) {
  const DIR = import.meta.dir;
  const SITE = path.join(DIR, "..", "site");

  const template = fs.readFileSync(path.join(DIR, "garden-template.html"), "utf8");
  const data = fs.readFileSync(path.join(DIR, "garden-data.json"), "utf8");
  const out = embedData(template, data);

  fs.mkdirSync(SITE, { recursive: true });
  fs.writeFileSync(path.join(SITE, "index.html"), out);

  // favicon.svg, og.png and robots.txt are checked in alongside it and served as-is.
  console.log(`bundled -> site/index.html (${Buffer.byteLength(out)} bytes)`);
}
