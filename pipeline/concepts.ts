#!/usr/bin/env bun
// Concept indexer: lexical extraction of pz's recurring concepts across ALL own tweets.
// His coinage-heavy style makes this work — the vocabulary is self-indexing.
//
// The lexicon itself lives in lexicon.ts (data only, importable without the
// corpus); this file runs it over tweets.json and writes concept-index.json,
// which carries each concept's name and its trailhead theme side by side.
import fs from "node:fs";
import path from "node:path";
import type { ConceptIndex, Tweet } from "./types";
import { LEXICON } from "./lexicon";
const DIR = import.meta.dir;

const tweets: Tweet[] = JSON.parse(fs.readFileSync(path.join(DIR, 'tweets.json'), 'utf8'));
const own = tweets.filter(t => !t.isRT);
const counts = new Map<string, number>(LEXICON.map(c => [c.name, 0]));
const perTweet = new Map<string, number[]>();
for (const t of own) {
  const found: number[] = [];
  for (let i = 0; i < LEXICON.length; i++) {
    const c = LEXICON[i]!;
    if (c.re.test(t.text)) { found.push(i); counts.set(c.name, (counts.get(c.name) ?? 0) + 1); }
  }
  if (found.length) perTweet.set(t.id, found);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('own tweets:', own.length, '| tweets matching >=1 concept:', perTweet.size);
console.log('\nconcept counts:');
for (const [k, c] of sorted) console.log(String(c).padStart(6), k);
const index: ConceptIndex = {
  concepts: LEXICON.map(c => c.name),
  themes: LEXICON.map(c => c.theme),
  perTweet: Object.fromEntries(perTweet),
};
fs.writeFileSync(path.join(DIR, 'concept-index.json'), JSON.stringify(index));
