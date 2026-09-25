// The URL identity of a garden node (mt#5204).
//
// A slug is minted here, at export, rather than in the browser: an identifier
// is part of the data model, like the precomputed layout, so that anything that
// later reads the payload — a per-thread preview Worker, a CLI — sees the same
// map the page does. `assignSlugs` is pure and order-preserving; the export
// script calls it once over the selected nodes.
//
// Precedence: the curated title from analysis/corpus-catalog.md when there is
// one, else the root tweet's text. So a titled thread's URL follows its title —
// editing the title in the catalog changes the URL and orphans links shared
// before the edit. Untitled threads derive from immutable tweet text and are
// permanent; numeric-id links always are. Recorded on the task; a first-seen
// slug registry was considered and rejected as machinery this site does not
// yet need.

/** Longest slug. The cut lands on the last `-` past SLUG_MIN_CUT so a word is not split. */
export const SLUG_MAX = 60;
const SLUG_MIN_CUT = 20;

/** Lower-case ASCII words joined by single hyphens; `t.co` links and apostrophes vanish. */
export function slugify(text: string): string {
  const base = text
    .replace(/https:\/\/t\.co\/\w+/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= SLUG_MAX) return base;
  const cut = base.slice(0, SLUG_MAX);
  const at = cut.lastIndexOf("-");
  return at > SLUG_MIN_CUT ? cut.slice(0, at) : cut;
}

/** What a node needs to be slugged — kept narrow so this is testable without a full GardenNode. */
export interface Sluggable {
  id: string;
  title: string | null;
  started: string;
  tweets: Array<{ x: string }>;
}

/**
 * Give every node a unique slug. Collisions are numbered deterministically —
 * `-2`, `-3`, … — in `started`-then-`id` order, so which thread keeps the bare
 * slug depends on the corpus, not on the order the catalog lists them in.
 * A node with nothing to slugify (all emoji, say) falls back to its numeric id,
 * which the page accepts in the same position. The result is in input order.
 */
export function assignSlugs<T extends Sluggable>(nodes: T[]): Array<T & { slug: string }> {
  const order = [...nodes].sort(
    (a, b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id)
  );
  const taken = new Set<string>();
  const slugOf = new Map<string, string>();
  for (const n of order) {
    const base = slugify(n.title || n.tweets[0]?.x || "") || n.id;
    let slug = base;
    for (let k = 2; taken.has(slug); k++) slug = `${base}-${k}`;
    taken.add(slug);
    slugOf.set(n.id, slug);
  }
  return nodes.map((n) => ({ ...n, slug: slugOf.get(n.id)! }));
}
