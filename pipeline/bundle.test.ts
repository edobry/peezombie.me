#!/usr/bin/env bun
// Regression tests for the bundle step.
//
// The corpus is not in this repo, so nothing here may depend on it. What CI can
// see is the committed SHELL (site/index.html), the committed PIN
// (pipeline/data-ref.json), and the pure functions in bundle.ts.
//
// Lineage of the fixture below: the payload used to be inlined into the shell,
// and an early build passed it to String.replace as a replacement STRING — so a
// tweet's `$$` was silently rewritten to `$`, one corrupted character in 4 MB,
// invisible to every other check. mt#4678 moved the payload out, so the corpus
// no longer passes through String.replace at all; the stamped URL and date now
// do. The hazard belongs to String.replace rather than to the data, so the
// adversarial sequences follow it to the call that still exists.
//
// The graph-integrity checks that used to read the embedded payload now live in
// two places: `checkGarden` in garden-template.html, which gates every page load
// at runtime, and the local-only block at the bottom of this file, which runs
// them against a real built payload whenever one is present on the machine.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  DATA_GENERATED_PLACEHOLDER,
  DATA_URL_PLACEHOLDER,
  buildDataRef,
  contentHash,
  payloadFilename,
  payloadUrl,
  readGenerated,
  stampTemplate,
} from "./bundle";

const DIR = import.meta.dir;
const SITE = path.join(DIR, "..", "site");
const HTML = path.join(SITE, "index.html");
const DATA_REF = path.join(DIR, "data-ref.json");

const html = fs.readFileSync(HTML, "utf8");
const dataRef = JSON.parse(fs.readFileSync(DATA_REF, "utf8")) as {
  file: string;
  sha256: string;
  generated: string;
  bytes: number;
};

/** Read a value bundle.ts stamped into the shell. */
function stamped(name: string): string {
  const m = html.match(new RegExp(`const ${name} = "([^"]*)";`));
  if (!m) throw new Error(`built shell does not declare ${name}`);
  return m[1]!;
}

const TEMPLATE = [
  "<!DOCTYPE html><html lang=\"en\"><head>",
  `<link rel="preload" href="${DATA_URL_PLACEHOLDER}" as="fetch" crossorigin>`,
  "</head><body><script>",
  `const DATA_URL = "${DATA_URL_PLACEHOLDER}";`,
  `const DATA_GENERATED = "${DATA_GENERATED_PLACEHOLDER}";`,
  "</script></body></html>",
].join("\n");

describe("stamping fidelity", () => {
  // Every sequence String.replace would reinterpret in a replacement STRING.
  const adversarial = "a $$ b $& c $` d $' e $1 f";

  test("the adversarial fixture actually contains what it claims to test", () => {
    // Guards the tests below from decaying into tautologies if the fixture is edited.
    for (const seq of ["$$", "$&", "$`", "$'"]) {
      expect(adversarial).toContain(seq);
    }
  });

  test("stamped values are inserted literally, not as replacement escapes", () => {
    const out = stampTemplate(TEMPLATE, { url: adversarial, generated: adversarial });
    expect(out).toContain(`const DATA_URL = "${adversarial}";`);
    expect(out).toContain(`const DATA_GENERATED = "${adversarial}";`);
  });

  test("the URL is stamped at every occurrence, not just the first", () => {
    const out = stampTemplate(TEMPLATE, { url: "/p.json", generated: "2026-01-01" });
    expect(out).not.toContain(DATA_URL_PLACEHOLDER);
    expect(out.split("/p.json").length - 1).toBe(2);
  });

  test("a template missing either placeholder is rejected", () => {
    const noUrl = TEMPLATE.replaceAll(DATA_URL_PLACEHOLDER, "/p.json");
    const noGenerated = TEMPLATE.replaceAll(DATA_GENERATED_PLACEHOLDER, "2026-01-01");
    expect(() => stampTemplate(noUrl, { url: "/p.json", generated: "x" })).toThrow(
      DATA_URL_PLACEHOLDER
    );
    expect(() => stampTemplate(noGenerated, { url: "/p.json", generated: "x" })).toThrow(
      DATA_GENERATED_PLACEHOLDER
    );
  });
});

describe("the payload is content-addressed", () => {
  const data = JSON.stringify({ generated: "2026-07-06", nodes: [] });

  test("the same bytes always produce the same filename", () => {
    expect(payloadFilename(data)).toBe(payloadFilename(data));
  });

  test("one changed byte produces a different filename", () => {
    const other = JSON.stringify({ generated: "2026-07-07", nodes: [] });
    expect(payloadFilename(other)).not.toBe(payloadFilename(data));
  });

  test("the filename shape is what _headers and .gitignore both match", () => {
    // site/garden-data.*.json in .gitignore and /garden-data.* in site/_headers.
    expect(payloadFilename(data)).toMatch(/^garden-data\.[0-9a-f]{16}\.json$/);
  });

  test("the ref records the full hash, not the truncated one in the name", () => {
    const ref = buildDataRef(data);
    expect(ref.sha256).toBe(contentHash(data));
    expect(ref.sha256.length).toBe(64);
    expect(ref.file).toContain(ref.sha256.slice(0, 16));
    expect(ref.bytes).toBe(Buffer.byteLength(data));
  });

  test("the fetch URL is site-absolute, so the build is host-agnostic", () => {
    // An absolute origin here is what would force every adopter of this pipeline
    // to own a bucket and a CORS policy; a relative path does not.
    expect(payloadUrl(buildDataRef(data))).toBe(`/${payloadFilename(data)}`);
  });

  test("data with no `generated` stamp is refused rather than shipped unpinnable", () => {
    expect(() => readGenerated(JSON.stringify({ nodes: [] }))).toThrow("generated");
    expect(() => readGenerated(JSON.stringify({ generated: "" }))).toThrow("generated");
  });
});

describe("the committed shell carries no corpus", () => {
  test("the shell is small enough that it cannot contain the corpus", () => {
    expect(html.length).toBeLessThan(100_000);
  });

  test("no single line is corpus-sized", () => {
    // The direct descendant of the defect this task exists to fix: line 221 of
    // the old artifact was one 4,216,869-character JSON blob.
    const longest = html.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
    expect(longest).toBeLessThan(5_000);
  });

  test("the inline JSON data block is gone", () => {
    expect(html).not.toContain('<script type="application/json" id="data">');
  });

  test("no placeholder survived the build unstamped", () => {
    expect(html).not.toContain(DATA_URL_PLACEHOLDER);
    expect(html).not.toContain(DATA_GENERATED_PLACEHOLDER);
    expect(html).not.toContain("__DATA__");
  });
});

describe("the shell and the committed pin agree", () => {
  test("the shell fetches the payload the pin names", () => {
    expect(stamped("DATA_URL")).toBe(`/${dataRef.file}`);
  });

  test("the shell preloads the same URL it fetches", () => {
    expect(html).toContain(`<link rel="preload" href="/${dataRef.file}" as="fetch" crossorigin>`);
  });

  test("the shell holds the payload to the pin's generated date", () => {
    expect(stamped("DATA_GENERATED")).toBe(dataRef.generated);
  });

  test("the pin records a full sha256 and a plausible size", () => {
    expect(dataRef.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(dataRef.file).toBe(`garden-data.${dataRef.sha256.slice(0, 16)}.json`);
    expect(dataRef.bytes).toBeGreaterThan(0);
  });
});

describe("the shell fails loudly rather than rendering empty", () => {
  // The runtime gate replaced build-time payload assertions when the payload
  // left the repo. These check the gate is still wired in — the assertions it
  // makes are exercised against real data in the local-only block below.
  test("the loader reports a non-OK response instead of continuing", () => {
    expect(html).toContain("returned HTTP ");
  });

  test("the loader checks the shell/data version stamp", () => {
    expect(html).toContain("Shell/data mismatch");
  });

  test("the loader refuses data with no precomputed layout", () => {
    expect(html).toContain("no precomputed layout");
  });

  test("the page is gated on the load: boot() runs only after the checks", () => {
    expect(html).toContain("loadGarden()");
    expect(html).toContain(".then(checkGarden)");
  });
});

describe("document is well-formed and shareable", () => {
  test("has a doctype, a language, and a body", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<body>");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  test("carries the social/discovery metadata", () => {
    for (const tag of [
      'property="og:title"', 'property="og:description"', 'property="og:image"',
      'name="twitter:card"', 'name="description"', 'rel="canonical"', 'rel="icon"',
    ]) {
      expect(html).toContain(tag);
    }
  });

  test("does not still call itself a prototype", () => {
    expect(html).not.toContain("(prototype)");
  });
});

// Local-only: these run against a real built payload, which exists on a machine
// that has the corpus and never in CI. They are the graph-integrity assertions
// that used to read the embedded payload out of the shell. Skipped rather than
// deleted — the coverage is real, it just cannot run where the data is absent.
const builtPayload = path.join(SITE, dataRef.file);
if (fs.existsSync(builtPayload)) {
  describe("built payload is non-degenerate (local only — needs a built payload)", () => {
    const raw = fs.readFileSync(builtPayload, "utf8");
    const d = JSON.parse(raw);

    test("the payload on disk is byte-identical to the pin", () => {
      expect(contentHash(raw)).toBe(dataRef.sha256);
      expect(Buffer.byteLength(raw)).toBe(dataRef.bytes);
      expect(d.generated).toBe(dataRef.generated);
    });

    test("the payload matches the shape checkGarden enforces at load", () => {
      // These mirror garden-template.html's checkGarden. That function is inline
      // in the template and cannot be imported, so this is what keeps the two
      // from drifting — the first version of it wrongly demanded `quoted` be an
      // array, and only a browser load caught it.
      for (const k of ["nodes", "edges", "concepts", "corpus"]) {
        expect(Array.isArray(d[k])).toBe(true);
      }
      expect(typeof d.quoted).toBe("object");
      expect(Array.isArray(d.quoted)).toBe(false);
      expect(d.quoted).not.toBeNull();
    });

    test("the graph layers are all populated", () => {
      // concepts/corpus come from concept-index.json; skipping concepts.ts leaves
      // them empty while nodes and edges still build, which looks like success.
      expect(d.nodes.length).toBeGreaterThan(0);
      expect(d.edges.length).toBeGreaterThan(0);
      expect(d.concepts.length).toBeGreaterThan(0);
      expect(d.corpus.length).toBeGreaterThan(0);
    });

    test("every edge endpoint resolves to a node", () => {
      const ids = new Set(d.nodes.map((n: { id: string }) => n.id));
      const dangling = d.edges.filter(
        (e: { from: string; to: string }) => !ids.has(e.from) || !ids.has(e.to)
      );
      expect(dangling).toEqual([]);
    });

    test("every node carries a laid-out position", () => {
      const unplaced = d.nodes.filter(
        (n: { x?: number; y?: number; r?: number }) =>
          typeof n.x !== "number" || typeof n.y !== "number" || typeof n.r !== "number"
      );
      expect(unplaced).toEqual([]);
    });
  });
}
