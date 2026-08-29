#!/usr/bin/env bun
// Regression tests for the bundle step.
//
// The load-bearing test is round-trip fidelity. A previous build passed the
// data to String.replace as a replacement STRING, so a tweet containing `$$`
// was silently rewritten to `$` — one corrupted character in 4 MB, invisible to
// every other check.
//
// That test used to compare the built page against `pipeline/garden-data.json`.
// It was written when the corpus was tracked and CI ran `bun run build`; commit
// 21acaa9 removed the corpus and stopped CI from building, which left the test
// reading a gitignored file that exists in no fresh checkout. CI went red and
// stayed red.
//
// It now round-trips a SYNTHETIC payload through the same functions the build
// uses. That needs no corpus, so it actually runs in CI — and it covers the
// class better than the old comparison did, because it asserts every dangerous
// sequence is present rather than hoping the real corpus happens to contain one
// ($& and $' may well appear nowhere in 22,549 tweets).
//
// The remaining tests read the COMMITTED site/index.html, which is in the repo.
// Whether that artifact is current for the pipeline is a different question, and
// not one this file can answer — mt#4751 owns it.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { DATA_PLACEHOLDER, embedData, extractEmbeddedPayload } from "./bundle";

const DIR = import.meta.dir;
const HTML = path.join(DIR, "..", "site", "index.html");

const html = fs.readFileSync(HTML, "utf8");

/** Pull the embedded payload back out of the built page, undoing the `<\/` escape. */
function embeddedPayload(): string {
  return extractEmbeddedPayload(html);
}

describe("bundle round-trip fidelity", () => {
  // Every sequence String.replace would reinterpret in a replacement STRING,
  // plus the `</script>` that would close the JSON block early.
  const adversarial = JSON.stringify({
    generated: "2026-01-01",
    tweets: [
      "a $$ b", "a $& b", "a $` b", "a $' b", "a $1 b",
      "closing </script> tag", "nested </scr" + "ipt> pieces",
      "backslash \\ and quote \" and newline \n",
    ],
  });

  test("a synthetic payload survives embed -> extract byte-identically", () => {
    const template = `<!DOCTYPE html><html lang="en"><body>` +
      `<script type="application/json" id="data">${DATA_PLACEHOLDER}</script>` +
      `</body></html>`;
    expect(extractEmbeddedPayload(embedData(template, adversarial))).toBe(adversarial);
  });

  test("the adversarial payload actually contains what it claims to test", () => {
    // Guards the test above from decaying into a tautology if the fixture is edited.
    for (const seq of ["$$", "$&", "$`", "$'", "</script>"]) {
      expect(adversarial).toContain(seq);
    }
  });

  test("embedding leaves no literal `</script>` inside the block", () => {
    const template = `<script type="application/json" id="data">${DATA_PLACEHOLDER}</script>`;
    const out = embedData(template, adversarial);
    const start = out.indexOf(">") + 1;
    expect(out.slice(start, out.indexOf("</script>", start))).not.toContain("</script>");
  });

  test("a template missing the placeholder is rejected", () => {
    expect(() => embedData("<html></html>", adversarial)).toThrow(DATA_PLACEHOLDER);
  });

  test("embedded payload parses and carries every top-level key", () => {
    const d = JSON.parse(embeddedPayload());
    for (const k of ["generated", "account", "nodes", "edges", "quoted", "concepts", "corpus"]) {
      expect(d).toHaveProperty(k);
    }
  });

  test("no `</script>` escapes into the JSON block", () => {
    const open = '<script type="application/json" id="data">';
    const start = html.indexOf(open) + open.length;
    const end = html.indexOf("</script>", start);
    expect(html.slice(start, end).includes("</script>")).toBe(false);
  });
});

describe("payload is non-degenerate", () => {
  const d = JSON.parse(embeddedPayload());

  test("the graph layers are all populated", () => {
    // concepts/corpus come from concept-index.json; skipping concepts.ts leaves
    // them empty while nodes and edges still build, which looks like success.
    expect(d.nodes.length).toBeGreaterThan(0);
    expect(d.edges.length).toBeGreaterThan(0);
    expect(d.concepts.length).toBeGreaterThan(0);
    expect(d.corpus.length).toBeGreaterThan(0);
  });

  test("every edge endpoint resolves to a node", () => {
    const ids = new Set(d.nodes.map((n: { id: string }) => n.id));
    const dangling = d.edges.filter(
      (e: { from: string; to: string }) => !ids.has(e.from) || !ids.has(e.to)
    );
    expect(dangling).toEqual([]);
  });

  test("every node carries a laid-out position", () => {
    const unplaced = d.nodes.filter(
      (n: { x?: number; y?: number }) => typeof n.x !== "number" || typeof n.y !== "number"
    );
    expect(unplaced).toEqual([]);
  });
});

describe("document is well-formed and shareable", () => {
  test("has a doctype, a language, and a body", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<body>");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  test("carries the social/discovery metadata", () => {
    for (const tag of [
      'property="og:title"', 'property="og:description"', 'property="og:image"',
      'name="twitter:card"', 'name="description"', 'rel="canonical"', 'rel="icon"',
    ]) {
      expect(html).toContain(tag);
    }
  });

  test("does not still call itself a prototype", () => {
    expect(html).not.toContain("(prototype)");
  });
});
