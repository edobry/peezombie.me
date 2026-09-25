#!/usr/bin/env bun
// The slug is a node's URL (mt#5204). These pin the rules the page relies on:
// the same input always yields the same slug, no two nodes share one, and a
// node with nothing to slugify still has an address.
import { describe, expect, test } from "bun:test";
import { SLUG_MAX, assignSlugs, slugify } from "./slug";

describe("slugify", () => {
  test("lower-cases and hyphenates on every non-alphanumeric run", () => {
    expect(slugify("Qi as Virtual Substance")).toBe("qi-as-virtual-substance");
    expect(slugify("  open carry, superrationality — digital qualia!  ")).toBe(
      "open-carry-superrationality-digital-qualia"
    );
  });

  test("drops apostrophes rather than splitting the word", () => {
    expect(slugify("I'll say it: don’t")).toBe("ill-say-it-dont");
  });

  test("drops t.co links, which carry no words", () => {
    expect(slugify("collecting some responses here https://t.co/abc123XYZ")).toBe(
      "collecting-some-responses-here"
    );
  });

  test("text that leaves nothing ASCII slugs to the empty string", () => {
    expect(slugify("✨🌱✨")).toBe("");
    expect(slugify("日本語のツイート")).toBe("");
  });

  test("cuts long text at a word boundary within the limit", () => {
    const words =
      "no matter how you feel about the donald i think many of us can agree that today was";
    const s = slugify(words);
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s.endsWith("-")).toBe(false);
    // The cut fell between words: the full hyphenation continues with a `-`.
    expect(words.replace(/ /g, "-").startsWith(s + "-")).toBe(true);
  });

  test("a single overlong word is cut hard rather than dropped", () => {
    expect(slugify("a".repeat(100)).length).toBe(SLUG_MAX);
  });
});

function node(id: string, started: string, title: string | null, text: string) {
  return { id, started, title, tweets: [{ x: text }] };
}

describe("assignSlugs", () => {
  test("prefers the curated title over the root tweet's text", () => {
    const [n] = assignSlugs([node("1", "2021-01-01", "The Self-Talk Ladder", "the one thing")]);
    expect(n!.slug).toBe("the-self-talk-ladder");
  });

  test("falls back to the root tweet's text when there is no title", () => {
    const [n] = assignSlugs([node("1", "2021-01-01", null, "lets install wordpress! ")]);
    expect(n!.slug).toBe("lets-install-wordpress");
  });

  test("a node with nothing to slugify gets its id, so it still has an address", () => {
    const [n] = assignSlugs([node("1450000000000000001", "2021-01-01", null, "✨")]);
    expect(n!.slug).toBe("1450000000000000001");
  });

  test("collisions are numbered in started-then-id order; input order is preserved", () => {
    const out = assignSlugs([
      node("3", "2023-01-01", null, "same words"),
      node("1", "2021-01-01", null, "same words"),
      node("2", "2021-01-01", null, "same words"),
    ]);
    expect(out.map((n) => n.id)).toEqual(["3", "1", "2"]);
    expect(out.map((n) => n.slug)).toEqual(["same-words-3", "same-words", "same-words-2"]);
  });

  test("a numbered suffix never collides with a natural slug that already ends in one", () => {
    const out = assignSlugs([
      node("1", "2021-01-01", "Foo", ""),
      node("2", "2021-02-01", "Foo 2", ""),
      node("3", "2021-03-01", "Foo", ""),
    ]);
    expect(out.map((n) => n.slug)).toEqual(["foo", "foo-2", "foo-3"]);
    expect(new Set(out.map((n) => n.slug)).size).toBe(3);
  });

  test("is deterministic: the same input always yields the same slugs", () => {
    const input = [node("1", "2021-01-01", null, "x y z"), node("2", "2021-01-02", "A B", "")];
    expect(assignSlugs(input)).toEqual(assignSlugs(input));
  });
});
