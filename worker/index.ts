// The Worker in front of the static assets (mt#5216).
//
// Assets are served FIRST and never reach this script; it runs only for paths
// that match no file in site/. Two jobs:
//
//   1. App routes (/t/*, /weave*, /search*, /trailheads*, /web): serve the
//      shell, and for /t/<slug> rewrite its head with that thread's Open Graph
//      meta, so a pasted link unfurls as the thread rather than as the site.
//   2. Everything else: hand back to the assets binding unchanged. Its default
//      not_found_handling is a real 404, which mt#4678 relies on — a shell
//      cached from an older deploy asks for a payload filename that no longer
//      exists and must be told so, not handed index.html with a 200.
//
// The script never reads the corpus. It reads site/og.json, a slug-keyed index
// of titles and root-tweet excerpts that bundle.ts writes beside the payload.
import type { OgIndex } from "../pipeline/og";
import { decide, type ThreadMeta } from "./meta";

export interface Env {
  ASSETS: Fetcher;
}

export const APP_ROUTE = /^\/(t|weave|search|trailheads|web)(\/|$)/;
const THREAD_ROUTE = /^\/t(\/|$)/;

/* The preview index, loaded once per isolate and kept. A failed load is not
   kept, so the next request retries — and it never fails the page: the shell
   goes out with its generic meta instead. */
let indexPromise: Promise<OgIndex> | undefined;
function ogIndex(env: Env, origin: string): Promise<OgIndex> {
  if (!indexPromise) {
    indexPromise = env.ASSETS.fetch(new Request(`${origin}/og.json`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`og.json returned HTTP ${r.status}`);
        return (await r.json()) as OgIndex;
      })
      .catch((err: unknown) => {
        indexPromise = undefined;
        throw err;
      });
  }
  return indexPromise;
}

function content(value: string) {
  return {
    element(e: Element) {
      e.setAttribute("content", value);
    },
  };
}

/** Every head tag a link card or a crawler reads, and nothing in the body. */
export function rewriteHead(shell: Response, m: ThreadMeta): Response {
  return new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(m.title); } })
    .on('meta[name="description"]', content(m.description))
    .on('link[rel="canonical"]', { element(e) { e.setAttribute("href", m.url); } })
    .on('meta[property="og:url"]', content(m.url))
    .on('meta[property="og:type"]', content(m.type))
    .on('meta[property="og:title"]', content(m.title))
    .on('meta[property="og:description"]', content(m.description))
    .on('meta[name="twitter:title"]', content(m.title))
    .on('meta[name="twitter:description"]', content(m.description))
    .transform(shell);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!APP_ROUTE.test(url.pathname)) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    // A fresh GET for `/`, not the incoming request forwarded: its conditional
    // headers would validate against the unrewritten shell's ETag and hand a
    // 304 back for a body this script was about to change.
    const shell = await env.ASSETS.fetch(new Request(`${url.origin}/`));
    if (!THREAD_ROUTE.test(url.pathname)) return shell;

    let index: OgIndex = {};
    try {
      index = await ogIndex(env, url.origin);
    } catch (err) {
      console.error("preview index unavailable; serving generic meta", err);
    }
    const d = decide(url.pathname, index, url.origin);
    if (!d.meta && d.status === shell.status) return shell;

    const out = d.meta ? rewriteHead(shell, d.meta) : shell;
    const headers = new Headers(out.headers);
    headers.delete("etag"); // the body no longer matches the asset's validator
    return new Response(out.body, { status: d.status, headers });
  },
} satisfies ExportedHandler<Env>;
