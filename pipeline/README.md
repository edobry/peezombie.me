# Corpus pipeline

Reproducible path from the raw Twitter archive to `site/index.html`. TypeScript on Bun,
no runtime dependencies. Run everything through `bun run build` from the repo root rather
than invoking these directly — see the root README for the ordering constraint and the
cross-runtime determinism note.

| Step | Script | Output |
| --- | --- | --- |
| 1 | `parse.ts` | `tweets.json`, `threads.json`, `thread-links.json` |
| 2 | `concepts.ts` | `concept-index.json` — **required before step 4** |
| 3 | `make-tags.ts` | `tags.json`, from `../analysis/corpus-catalog.md` |
| 4 | `export-garden.ts` | `garden-data.json` (nodes, edges, precomputed force layout) |
| 5 | `bundle.ts` | `../site/index.html` |

`export.ts` (analysis exports) and `graph.ts` (quote-graph component stats) are
diagnostic side-tools; neither feeds the build.

All intermediates are gitignored and regenerable.

Types shared across steps live in `types.ts`.
