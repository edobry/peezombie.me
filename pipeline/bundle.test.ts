#!/usr/bin/env bun
// Regression tests for the bundle step, run against the BUILT artifact.
// Run `bun run build` first (CI does).
//
// The load-bearing test is round-trip fidelity. A previous build passed the
// data to String.replace as a replacement STRING, so a tweet containing `$$`
// was silently rewritten to `$` — one corrupted character in 4 MB, invisible to
// every other check. Comparing the embedded payload against its source catches
// that entire class ($$, $&, $`, $', and `</script>` escaping) without being
// brittle the way a golden hash would be.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const DIR = import.meta.dir;
const HTML = path.join(DIR, "..", "site", "index.html");
const DATA = path.join(DIR, "garden-data.json");

const html = fs.readFileSync(HTML, "utf8");

/** Pull the embedded payload back out of the built page, undoing the `<\/` escape. */
function embeddedPayload(): string {
  const open = '<script type="application/json" id="data">';
  const a = html.indexOf(open);
  expect(a).toBeGreaterThan(-1);
  const start = a + open.length;
  const end = html.indexOf("</script>", start);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end).replace(/<\\\//g, "</");
}

describe("bundle round-trip fidelity", () => {
  test("embedded payload is byte-identical to garden-data.json", () => {
    expect(embeddedPayload()).toBe(fs.readFileSync(DATA, "utf8"));
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
