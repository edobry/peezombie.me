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

## Provenance

The corpus comes from a Twitter/X account data export requested **2025-09-21**
(`twitter-2025-09-21-*.zip`, ~747 MB, mostly media the pipeline never reads).

**What is in this repo:** `data/tweets.js` (22,549 tweets, 2020-2025) and
`data/note-tweet.js` (long-form tweet bodies). These are the only two files
`parse.ts` reads.

**What is deliberately excluded**, and why:

| Excluded | Reason |
| --- | --- |
| `account.js`, `profile.js` | contain the account email; the pipeline never reads them |
| `direct-messages*.js`, `*-headers.js` | private correspondence, incl. third parties |
| `contact.js` | an uploaded address book |
| `ip-audit.js`, `account-creation-ip.js`, `device-token.js`, `ni-devices.js` | device and network identifiers |
| `phone-number.js`, `email-address-change.js` | direct identifiers |
| `like.js`, `block.js`, `mute.js` | reading and moderation behavior, not authored work |
| `grok-chat-item.js`, `personalization.js`, `ad-*.js` | inferred profile and ad telemetry |
| the archive `.zip` itself | gitignored; it carries all of the above |

**Everything published here was posted publicly.** `protected-history.js` in the
export is empty, meaning the account was never protected, so no tweet in this
corpus was ever follower-only. No tweet carries Twitter's `possibly_sensitive`
flag.

**Caveat this repo cannot check for you:** the export is a point-in-time
snapshot. A tweet deleted *after* 2025-09-21 is still in `data/tweets.js`.

## Licensing

Two licenses, because this repo holds two different things:

- **Code** — everything in `pipeline/`, plus the build configuration: [MIT](LICENSE).
- **The corpus and the writing** — `data/`, `analysis/`, `spec/`, `research/`, and
  the rendered prose in `site/`: **© Eugene Dobry, all rights reserved** unless and
  until stated otherwise here.

If you want to reuse the corpus itself, ask.

## Build

```sh
bun install     # first time only — TypeScript + @types/bun
# data/ is not in this repo — see "Getting the corpus" below
bun run build
```

### Getting the corpus

`data/` is gitignored and absent from history. Populate it either way:

**From a Twitter/X archive export:**

```sh
unzip twitter-*.zip 'data/tweets*.js' 'data/note-tweet.js' -d .
```

**From the [Community Archive](https://www.community-archive.org/):** the corpus is
also queryable via its public Supabase REST API (`tweets`, `tweet_urls`,
`enriched_tweets`). Prefer `tweet_urls.expanded_url` over
`enriched_tweets.quoted_tweet_id` — the latter does not strip URL tracking
parameters, so a large share of quote-link IDs come back malformed.

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

**Live today: Railway.** Pushing to `main` deploys — Railpack detects a static site and
serves `site/index.html` directly. Treat a merge to `main` as a deploy.

`site/index.html` is no longer a single self-contained file. Since mt#4678 it is a ~44 KB
shell that fetches its data from `site/garden-data.<hash>.json`, a content-hashed file that
is **gitignored** — the corpus must not be in this repo.

That is why the deploy target is moving to Cloudflare Workers Static Assets: publishing
there is an UPLOAD rather than a commit, so the payload reaches production without ever
entering git.

```sh
bun run deploy   # bun run build && bunx wrangler deploy
```

This is the publish step for new data — rebuild, then upload all of `site/` (shell, payload,
`_headers`, static assets) as one Worker deployment. It needs the corpus in `data/` to
rebuild, so it runs from a machine that has the archive.

**Sequencing, which matters:** a host that builds from the git repo can never receive the
gitignored payload. So once the fetching shell is on `main`, Railway serves a shell whose
data 404s. The apex must point at the Worker before, or at the same time as, that change
reaching `main`. Until then `bun run deploy` publishes to the `workers.dev` URL and
peezombie.me keeps serving the Railway build. Rollback is repointing the apex back to
Railway, which still serves the last inlined build.
