# peezombie.me

The [pee_zombie](https://twitter.com/pee_zombie) Twitter corpus (2020–2025) rendered as a
digital garden — threads read as essays, quote-tweets read as hyperlinks, the whole web
navigable by concept rather than chronology.

Live: **https://peezombie.me**

## What the corpus is

22,549 tweets; 1,776 self-reply threads; 1,662 self-quote links resolving to 1,110
thread-to-thread edges. The quote graph's giant connected component spans 913 nodes.
The account was written as a hypertext, which means it can be rendered as one.

Design rationale is in [`spec/tweet-garden.md`](spec/tweet-garden.md); the prior art
survey is in [`research/`](research/).

## Layout

| Path | What it is |
| --- | --- |
| `data/` | The two Twitter-archive files the pipeline reads (`tweets.js`, `note-tweet.js`) |
| `pipeline/` | Build scripts (TypeScript, run on Bun) — extraction, graph construction, layout, bundling |
| `pipeline/types.ts` | Shared domain types — `Tweet`, `Thread`, `GardenNode`, `GardenData`, … |
| `analysis/corpus-catalog.md` | **The editorial layer** — hand-curated titles, themes, types, grades and gists for the top 200 threads |
| `spec/` | Design documents |
| `research/` | Prior-art notes (digital gardens; the TPOT/Visa threading tradition) |
| `site/index.html` | The built artifact. This is what gets served. |

## Build

```sh
bun install     # first time only — TypeScript + @types/bun
bun run build
```

Runs, in order: `parse` → `concepts` → `tags` → `export` → `bundle`, writing
`site/index.html`. `bun run typecheck` runs `tsc --noEmit` over the pipeline.

**Run `concepts` before `export`.** Skipping it does not fail — you still get 778 nodes
and 976 edges and it looks like it worked — but `concept-index.json` is absent, so the
concept and corpus layers silently come out empty (96 → 0 concepts, 8,197 → 0 corpus
tweets). The original pipeline README omitted this step.

**The force layout is deterministic within a runtime, but not across runtimes.** It uses a
seeded LCG, so repeated Bun runs are byte-identical — but V8 and JavaScriptCore disagree on
the float math, so a Node run produces different node coordinates. Neither is more correct
(they are arbitrary starting positions in a force simulation), but the build is Bun's, and
`site/index.html` should always be regenerated with Bun so it matches.

### Re-curating

`parse.ts` and `graph.ts` are fully mechanical. Editorial judgment lives in
`analysis/corpus-catalog.md` — edit it line by line, then re-run `bun run build`.

### Regenerating `data/` from a fresh archive export

```sh
unzip twitter-*.zip 'data/tweets*.js' 'data/note-tweet.js' -d .
```

`account.js` and `profile.js` are deliberately **not** in this repo: the pipeline never
reads them, and `account.js` contains the account email.

## Deploy

`site/index.html` is a single self-contained file — no external assets, no server-side
anything. Railway's Railpack builder detects a static site from a bare `index.html` and
serves it directly.
