#!/usr/bin/env bun
// Regression tests for the bundle step.
//
// The round-trip test is load-bearing: an earlier build passed the data to
// String.replace as a replacement STRING, so a tweet's `$$` was silently
// rewritten to `$` — one corrupted character in 4 MB, invisible to every other
// check. That is why the fixture carries `$$`, `$&`, `` $` ``, `$'` and a
// literal `</script>`, and why a second test asserts they are still in it.
//
// The fixture is synthetic on purpose: the corpus is not in the repo, so a test
// needing garden-data.json cannot run in CI. Do not "improve" this by comparing
// against real build output.
//
// The other tests read the committed site/index.html. Whether that artifact is
// current for the pipeline is mt#4751's question, not this file's.
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
