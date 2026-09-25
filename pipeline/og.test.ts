#!/usr/bin/env bun
// The preview index (mt#5216): what the Worker reads instead of the corpus to
// answer /t/<slug> with the thread's Open Graph meta.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { OG_EXCERPT_MAX, buildOgIndex, stripTco } from "./og";
import type { GardenNode } from "./types";

function node(over: Partial<GardenNode> & Pick<GardenNode, "id" | "slug">): GardenNode {
  return {
    kind: "thread", size: 1, favs: 0, started: "2021-01-01",
    title: null, tags: [], type: null, grade: null, tweets: [],
    ...over,
  };
}

describe("stripTco", () => {
  test("drops t.co links and collapses the whitespace around them", () => {
    expect(stripTco("a  https://t.co/x1Y2z \n\n b ")).toBe("a b");
  });
});

describe("buildOgIndex", () => {
  const nodes = [
    node({
      id: "1", slug: "qi", kind: "thread", size: 24, started: "2023-05-08", title: "Qi",
      tweets: [{ id: "1", d: "2023-05-08", f: 1, x: "took me  years\n\nto accept https://t.co/abc123 the truth", q: [] }],
    }),
    node({ id: "2", slug: "lone", kind: "tweet", started: "2021-01-01" }),
  ];

  test("is keyed by slug and carries title, excerpt, date, size and kind — nothing else", () => {
    const og = buildOgIndex({ nodes });
    expect(Object.keys(og)).toEqual(["qi", "lone"]);
    expect(og["qi"]).toEqual({ t: "Qi", x: "took me years to accept the truth", d: "2023-05-08", n: 24, k: "thread" });
  });

  test("a node with no tweets still has an entry, with an empty excerpt", () => {
    expect(buildOgIndex({ nodes })["lone"]).toEqual({ t: null, x: "", d: "2021-01-01", n: 1, k: "tweet" });
  });

  test("the excerpt is capped, so the index stays small at the edge", () => {
    const long = node({ id: "9", slug: "long", tweets: [{ id: "9", d: "2023-01-01", f: 0, x: "w".repeat(1000), q: [] }] });
    expect(buildOgIndex({ nodes: [long] })["long"]!.x.length).toBe(OG_EXCERPT_MAX);
  });
});

// Local-only: against a real build, the index beside the payload must be what
// this code derives from that payload — the Worker trusts it without checking.
const DIR = import.meta.dir;
const SITE = path.join(DIR, "..", "site");
const ref = JSON.parse(fs.readFileSync(path.join(DIR, "data-ref.json"), "utf8")) as { file: string };
const builtPayload = path.join(SITE, ref.file);
if (fs.existsSync(builtPayload)) {
  describe("built preview index (local only — needs a built payload)", () => {
    test("site/og.json is exactly what the built payload derives to", () => {
      const og = JSON.parse(fs.readFileSync(path.join(SITE, "og.json"), "utf8"));
      const d = JSON.parse(fs.readFileSync(builtPayload, "utf8"));
      expect(og).toEqual(buildOgIndex(d));
      expect(Object.keys(og).length).toBe(d.nodes.length);
    });
  });
}
