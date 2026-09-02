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
}

export function buildDataRef(data: string): DataRef {
  return {
    file: payloadFilename(data),
    sha256: contentHash(data),
    generated: readGenerated(data),
    bytes: Buffer.byteLength(data),
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

  const ref = buildDataRef(data);
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
