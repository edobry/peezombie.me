#!/usr/bin/env bun
// The Worker's meta decision (mt#5216), tested without a Worker: decide() and
// friends are pure, and this is the whole of the logic that chooses what a
// pasted link unfurls as. The HTMLRewriter half is verified against
// `wrangler dev` with curl, since Bun has no HTMLRewriter.
import { describe, expect, test } from "bun:test";
import type { OgIndex } from "../pipeline/og";
import { DESCRIPTION_MAX, SITE_NAME, TITLE_MAX, decide, excerpt, segmentsOf, threadMeta } from "./meta";

const origin = "https://peezombie.me";
const index: OgIndex = {
  "qi-as-virtual-substance": {
    t: "Qi as Virtual Substance",
    x: "took me years to accept the simple truth the endless incidence of such events forces me to admit",
    d: "2023-05-08", n: 24, k: "thread",
  },
  "lets-install-wordpress": { t: null, x: "lets install wordpress!", d: "2022-12-27", n: 3, k: "thread" },
  "a-lone-tweet": { t: null, x: "just one", d: "2021-10-18", n: 1, k: "tweet" },
  "1450000000000000001": { t: null, x: "", d: "2021-10-18", n: 1, k: "tweet" },
};

describe("excerpt", () => {
  test("short text passes through untouched", () => {
    expect(excerpt("short", 90)).toBe("short");
  });

  test("cuts at a word boundary within the limit and marks the cut", () => {
    const words = "one two three four five six seven eight nine ten";
    const out = excerpt(words, 20);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out.endsWith("…")).toBe(true);
    expect(words.startsWith(out.slice(0, -1) + " ")).toBe(true);
  });

  test("does not leave dangling punctuation before the ellipsis", () => {
    expect(excerpt("alpha beta, gamma delta epsilon", 12)).toBe("alpha beta…");
  });

  test("a single overlong word is cut hard rather than dropped", () => {
    expect(excerpt("a".repeat(50), 10)).toBe("a".repeat(10) + "…");
  });
});

describe("threadMeta", () => {
  test("a curated title names the card, with the site name after it", () => {
    const m = threadMeta("qi-as-virtual-substance", index["qi-as-virtual-substance"]!, origin);
    expect(m.title).toBe(`Qi as Virtual Substance — ${SITE_NAME}`);
    expect(m.type).toBe("article");
  });

  test("an untitled thread is named by its excerpt, like the page does", () => {
    const m = threadMeta("lets-install-wordpress", index["lets-install-wordpress"]!, origin);
    expect(m.title).toBe(`lets install wordpress! — ${SITE_NAME}`);
  });

  test("the description carries the count, the date, and the excerpt", () => {
    const m = threadMeta("qi-as-virtual-substance", index["qi-as-virtual-substance"]!, origin);
    expect(m.description.startsWith("24 tweets · 2023-05-08 — took me years")).toBe(true);
    expect(m.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX + 30);
  });

  test("a single tweet is a website, dated, without a count", () => {
    const m = threadMeta("a-lone-tweet", index["a-lone-tweet"]!, origin);
    expect(m.type).toBe("website");
    expect(m.description).toBe("2021-10-18 — just one");
  });

  test("an empty excerpt leaves the description to the date alone", () => {
    const m = threadMeta("1450000000000000001", index["1450000000000000001"]!, origin);
    expect(m.description).toBe("2021-10-18");
  });

  test("the url is the thread's own permalink", () => {
    const m = threadMeta("lets-install-wordpress", index["lets-install-wordpress"]!, origin);
    expect(m.url).toBe(`${origin}/t/lets-install-wordpress`);
  });

  test("a long untitled excerpt is cut to the page's title length", () => {
    const e = { t: null, x: "word ".repeat(60).trim(), d: "2021-01-01", n: 2, k: "thread" as const };
    const m = threadMeta("x", e, origin);
    expect(m.title.length).toBeLessThanOrEqual(TITLE_MAX + 1 + ` — ${SITE_NAME}`.length);
  });
});

describe("segmentsOf", () => {
  test("drops the route name and decodes each segment", () => {
    expect(segmentsOf("/t/a/b%20c")).toEqual(["a", "b c"]);
    expect(segmentsOf("/t")).toEqual([]);
    expect(segmentsOf("/t/")).toEqual([]);
  });

  test("a malformed escape is kept as typed rather than thrown", () => {
    expect(segmentsOf("/t/%E0%A4%A")).toEqual(["%E0%A4%A"]);
  });
});

describe("decide", () => {
  test("a bare /t is the shell, no meta", () => {
    expect(decide("/t", index, origin)).toEqual({ status: 200 });
  });

  test("a known slug gets its meta", () => {
    const d = decide("/t/qi-as-virtual-substance", index, origin);
    expect(d.status).toBe(200);
    expect(d.meta?.url).toBe(`${origin}/t/qi-as-virtual-substance`);
  });

  test("in a trail the last known slug wins — the pane in view", () => {
    const d = decide("/t/qi-as-virtual-substance/lets-install-wordpress", index, origin);
    expect(d.meta?.url).toBe(`${origin}/t/lets-install-wordpress`);
  });

  test("an unknown tail falls back to an earlier known segment", () => {
    const d = decide("/t/qi-as-virtual-substance/1655635463997202434", index, origin);
    expect(d.status).toBe(200);
    expect(d.meta?.url).toBe(`${origin}/t/qi-as-virtual-substance`);
  });

  test("numeric ids alone are the client's to resolve: shell, 200, no meta", () => {
    expect(decide("/t/1655635462646648835", index, origin)).toEqual({ status: 200 });
  });

  test("a slug nothing answers to is a real 404, still served the shell", () => {
    expect(decide("/t/no-such-thread", index, origin)).toEqual({ status: 404 });
    expect(decide("/t/000", index, origin)).toEqual({ status: 404 });
  });

  test("an empty index degrades to the shell rather than failing", () => {
    expect(decide("/t/qi-as-virtual-substance", {}, origin)).toEqual({ status: 404 });
    expect(decide("/t/1655635462646648835", {}, origin)).toEqual({ status: 200 });
  });
});
