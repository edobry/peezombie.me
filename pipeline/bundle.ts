#!/usr/bin/env bun
// Build site/index.html from garden-template.html, and write the garden payload
// beside it as a content-hashed JSON file that the page fetches at runtime.
//
// Why fetched and not inlined (mt#4678): the corpus must not live in this repo.
// site/index.html IS committed — it is what gets served — so inlining the payload
// put all 8,197 tweets back into git on every build, which is exactly what the
// 2026-08-27 history purge existed to prevent. The payload is gitignored and
// reaches production by UPLOAD (`bun run deploy`), never by commit.
//
// The filename carries a content hash, so a shell and a payload can never be
// paired wrongly: a stale shell asks for a filename that is no longer deployed
// and gets a 404 the loader reports, rather than silently rendering against data
// it was not built for. `generated` is re-checked in the browser as a second
// gate, for the case where a file does exist under the expected name.
//
// The transform functions below are exported and free of I/O so they can be
// tested against a synthetic payload — the corpus is not in the repo, so a test
// needing garden-data.json cannot run in CI.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DATA_URL_PLACEHOLDER = "/*__DATA_URL__*/";
export const DATA_GENERATED_PLACEHOLDER = "/*__DATA_GENERATED__*/";

/** How much of the sha256 goes into the payload filename. */
const HASH_CHARS = 16;

/** Matches a built payload filename, for sweeping previous builds out of site/. */
export const PAYLOAD_FILENAME_RE = /^garden-data\.[0-9a-f]+\.json$/;

export function contentHash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function payloadFilename(data: string): string {
  return `garden-data.${contentHash(data).slice(0, HASH_CHARS)}.json`;
}

/** The stamp the shell holds the payload to. Throws rather than shipping an unpinnable build. */
export function readGenerated(data: string): string {
  const generated = (JSON.parse(data) as { generated?: unknown }).generated;
  if (typeof generated !== "string" || generated === "") {
    throw new Error("garden data has no `generated` stamp to bind the shell to");
  }
  return generated;
}

/**
 * Stamp the payload's URL and `generated` date into the template.
 *
 * The replacements are passed as FUNCTIONS, not strings. String.replace treats
 * `$$`, `$&`, `` $` `` and `$'` in a replacement STRING as escapes — that bug
 * silently rewrote a tweet's `$$` to `$` back when the payload was inlined here.
 * These values are far narrower than a corpus, but the hazard is a property of
 * String.replace rather than of the data, so the discipline stays.
 *
 * `replaceAll`, not `replace`: the URL is stamped in twice (the preload hint and
 * the loader), and `replace` with a string pattern would only rewrite the first.
 */
export function stampTemplate(
  template: string,
  opts: { url: string; generated: string }
): string {
  for (const placeholder of [DATA_URL_PLACEHOLDER, DATA_GENERATED_PLACEHOLDER]) {
    if (!template.includes(placeholder)) {
      throw new Error(`template is missing the ${placeholder} placeholder`);
    }
  }
  return template
    .replaceAll(DATA_URL_PLACEHOLDER, () => opts.url)
    .replaceAll(DATA_GENERATED_PLACEHOLDER, () => opts.generated);
}

/**
 * The committed pin: what the committed shell expects, recorded without the
 * payload itself. This is how a checkout that has no corpus can still say which
 * payload the served page is asking for — and the seam mt#4751's staleness check
 * can build on.
 */
export interface DataRef {
  file: string;
  sha256: string;
  generated: string;
  bytes: number;
  /**
   * sha256 of every SOURCE input that determines the built artifact, keyed by
   * repo-relative path (mt#4896).
   *
   * This is what lets CI answer "is the committed shell stale?" without the
   * corpus: it compares SOURCE hashes rather than rebuilding, so `data/` stays
   * out of the repo and the check still fails when someone edits `pipeline/`
   * and forgets to rebuild.
   *
   * Optional because every `data-ref.json` committed before mt#4896 lacks it.
   * The check treats absence as "not yet pinned" and says so, rather than
   * reporting drift it cannot actually establish.
   */
  inputs?: Record<string, string>;
}

/**
 * Files whose content determines `site/index.html` and the payload.
 *
 * Three exclusions, each load-bearing:
 *
 * 1. **`data-ref.json` itself.** `bundle.ts` writes it into a directory it
 *    hashes, so including it would make the pin an input to its own value and
 *    the check could never converge.
 * 2. **The gitignored intermediates** (`tweets`, `threads`, `thread-links`,
 *    `concept-index`, `garden-data`, `tags`). They are absent in a fresh CI
 *    clone, so hashing them would make the check fail everywhere it matters.
 *    They are also derived from `data/`, not sources.
 * 3. **`*.test.ts`.** A test cannot change the built artifact, so treating one
 *    as an input would mean every test edit demands a full rebuild — and a
 *    rebuild needs the corpus, which is exactly the dependency this check
 *    exists to avoid. Deliberate narrowing of the spec's ".ts sources".
 */
export function isPipelineInput(entry: string): boolean {
  if (entry.endsWith(".test.ts")) return false;
  if (entry === "garden-template.html") return true;
  return entry.endsWith(".ts");
}

/** Pure: path→content becomes path→sha256, key-sorted so the JSON is stable. */
export function hashInputContents(contents: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(contents).sort()) {
    out[key] = contentHash(contents[key]!);
  }
  return out;
}

/**
 * Compare a pinned input map against freshly-read hashes.
 *
 * Returns a human-readable line per divergence — added, removed, or changed —
 * which is what SC2's "names what changed" needs. An empty array means in sync.
 */
export function diffInputHashes(
  pinned: Record<string, string>,
  actual: Record<string, string>
): string[] {
  const drift: string[] = [];
  for (const key of Object.keys({ ...pinned, ...actual }).sort()) {
    const before = pinned[key];
    const after = actual[key];
    if (before === after) continue;
    if (before === undefined) drift.push(`${key} (added since the shell was built)`);
    else if (after === undefined) drift.push(`${key} (deleted since the shell was built)`);
    else drift.push(`${key} (changed since the shell was built)`);
  }
  return drift;
}

/** IO: read the current on-disk inputs. `repoRoot` is the directory holding `pipeline/`. */
export function readInputHashes(repoRoot: string): Record<string, string> {
  const contents: Record<string, string> = {};
  const pipelineDir = path.join(repoRoot, "pipeline");
  for (const entry of fs.readdirSync(pipelineDir)) {
    if (!isPipelineInput(entry)) continue;
    contents[`pipeline/${entry}`] = fs.readFileSync(path.join(pipelineDir, entry), "utf8");
  }
  // The editorial layer — the only file where curation judgment lives, and a
  // real input to what the site says even though it is not code.
  const catalog = path.join(repoRoot, "analysis", "corpus-catalog.md");
  contents["analysis/corpus-catalog.md"] = fs.readFileSync(catalog, "utf8");
  return hashInputContents(contents);
}

export function buildDataRef(data: string, inputs?: Record<string, string>): DataRef {
  return {
    file: payloadFilename(data),
    sha256: contentHash(data),
    generated: readGenerated(data),
    bytes: Buffer.byteLength(data),
    ...(inputs === undefined ? {} : { inputs }),
  };
}

/** The URL the shell fetches — site-absolute, same-origin, host-agnostic. */
export function payloadUrl(ref: DataRef): string {
  return `/${ref.file}`;
}

if (import.meta.main) {
  const DIR = import.meta.dir;
  const SITE = path.join(DIR, "..", "site");

  const template = fs.readFileSync(path.join(DIR, "garden-template.html"), "utf8");
  const data = fs.readFileSync(path.join(DIR, "garden-data.json"), "utf8");

  // mt#4896: pin the SOURCE inputs alongside the payload. Read before anything
  // is written, so the hashes describe the tree this build actually ran from.
  const ref = buildDataRef(data, readInputHashes(path.join(DIR, "..")));
  const out = stampTemplate(template, { url: payloadUrl(ref), generated: ref.generated });

  fs.mkdirSync(SITE, { recursive: true });

  // Sweep payloads from previous builds. They are gitignored, so they are
  // invisible to review, but site/ is the deploy directory — leaving them here
  // uploads every stale copy of the corpus alongside the current one.
  for (const entry of fs.readdirSync(SITE)) {
    if (PAYLOAD_FILENAME_RE.test(entry) && entry !== ref.file) {
      fs.unlinkSync(path.join(SITE, entry));
    }
  }

  // Payload first: index.html is only correct once the file it names exists.
  fs.writeFileSync(path.join(SITE, ref.file), data);
  fs.writeFileSync(path.join(SITE, "index.html"), out);
  fs.writeFileSync(path.join(DIR, "data-ref.json"), `${JSON.stringify(ref, null, 2)}\n`);

  // favicon.svg, og.png and robots.txt are checked in alongside it and served as-is.
  console.log(`bundled -> site/index.html (${Buffer.byteLength(out)} bytes)`);
  console.log(`payload -> site/${ref.file} (${ref.bytes} bytes, generated ${ref.generated})`);
}
