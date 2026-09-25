import { describe, expect, test } from "bun:test";
import { LEXICON, THEMES } from "./lexicon";

// The lexicon is data, so this runs in a fresh clone with no corpus (mt#4896's
// constraint). It is the environmental check for mt#5222: every concept files
// under one of the trailheads' 15 themes, spelled exactly as the trailheads
// spell it, so the weave's groups and the trailheads' chips are one vocabulary.
describe("concept lexicon", () => {
  test("every concept has a theme from THEMES", () => {
    const known = new Set<string>(THEMES);
    const bad = LEXICON.filter((c) => !known.has(c.theme)).map((c) => `${c.name} → ${c.theme}`);
    expect(bad).toEqual([]);
  });

  test("concept names are unique and non-empty", () => {
    const names = LEXICON.map((c) => c.name);
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every theme has at least one concept", () => {
    const used = new Set(LEXICON.map((c) => c.theme));
    const empty = THEMES.filter((t) => !used.has(t));
    expect(empty).toEqual([]);
  });

  test("every regex is case-insensitive, matching how the indexer has always run", () => {
    const strict = LEXICON.filter((c) => !c.re.flags.includes("i")).map((c) => c.name);
    expect(strict).toEqual([]);
  });
});
