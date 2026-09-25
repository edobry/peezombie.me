// The per-thread preview index (mt#5216): what the Worker needs to answer
// /t/<slug> with that thread's Open Graph meta, and nothing more.
//
// bundle.ts writes it to site/og.json. It carries an excerpt of every node's
// root tweet, so it is corpus text and gets the payload's treatment: gitignored,
// uploaded at deploy, never committed. Keyed by slug because that is what the
// URL carries; the Worker never sees the payload itself.
import type { GardenData } from "./types";

/** One node's preview material. Short keys: this loads on every cold start at the edge. */
export interface OgEntry {
  /** Curated title, or null when the excerpt stands in for it. */
  t: string | null;
  /** Root tweet text, t.co links removed, whitespace collapsed, capped at OG_EXCERPT_MAX. */
  x: string;
  /** Started, YYYY-MM-DD. */
  d: string;
  /** Tweets in the node. */
  n: number;
  k: "thread" | "tweet";
}

export type OgIndex = Record<string, OgEntry>;

/** Longer than any description the Worker will render, so the cut is made there, on a word. */
export const OG_EXCERPT_MAX = 300;

/** t.co links carry no words; the page strips them the same way before rendering. */
export function stripTco(s: string): string {
  return s.replace(/https:\/\/t\.co\/\w+/g, "").replace(/\s+/g, " ").trim();
}

export function buildOgIndex(data: Pick<GardenData, "nodes">): OgIndex {
  const out: OgIndex = {};
  for (const n of data.nodes) {
    const root = n.tweets[0];
    out[n.slug] = {
      t: n.title,
      x: stripTco(root ? root.x : "").slice(0, OG_EXCERPT_MAX),
      d: n.started,
      n: n.size,
      k: n.kind,
    };
  }
  return out;
}
