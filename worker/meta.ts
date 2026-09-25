// Which meta a request for /t/... gets (mt#5216).
//
// Pure on purpose: no Workers APIs, so it is unit-tested with bun and
// typechecks under both the pipeline's tsconfig and the Worker's. index.ts is
// the thin shell around it that touches HTMLRewriter.
import type { OgEntry, OgIndex } from "../pipeline/og";

export const SITE_NAME = "pee_zombie";
/** Matches the page's own fallback title length for untitled nodes. */
export const TITLE_MAX = 90;
/** What link cards show before they truncate on their own. */
export const DESCRIPTION_MAX = 200;

export interface ThreadMeta {
  title: string;
  description: string;
  /** The thread's own permalink, whatever trail the request carried. */
  url: string;
  type: "article" | "website";
}

export interface RouteDecision {
  /** 200 for a known slug, or for ids the client can still resolve; 404 for a slug nothing answers to. */
  status: 200 | 404;
  /** Present only when a known slug was found; the shell is served as-is otherwise. */
  meta?: ThreadMeta;
}

/** Cut at a word boundary and mark the cut. Short text passes through untouched. */
export function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:—–-]+$/, "") + "…";
}

export function threadMeta(slug: string, e: OgEntry, origin: string): ThreadMeta {
  const name = e.t || excerpt(e.x, TITLE_MAX);
  const when = e.k === "thread" ? `${e.n} tweets · ${e.d}` : e.d;
  return {
    title: `${name} — ${SITE_NAME}`,
    description: e.x ? `${when} — ${excerpt(e.x, DESCRIPTION_MAX)}` : when,
    url: `${origin}/t/${slug}`,
    type: e.k === "thread" ? "article" : "website",
  };
}

/** A tweet or node id: the client resolves these itself, so they are never a miss here. */
const NUMERIC_ID = /^\d{5,}$/;

/** `/t/a/b` → `["a", "b"]`, each segment decoded; a malformed escape is kept as typed. */
export function segmentsOf(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/**
 * Decide for a `/t/...` path. The LAST known slug wins: in a trail that is the
 * pane in view, and the one the sender was looking at.
 */
export function decide(pathname: string, index: OgIndex, origin: string): RouteDecision {
  const segs = segmentsOf(pathname);
  if (segs.length === 0) return { status: 200 };
  for (let i = segs.length - 1; i >= 0; i--) {
    const slug = segs[i]!;
    const e = index[slug];
    if (e) return { status: 200, meta: threadMeta(slug, e, origin) };
  }
  return { status: segs.every((s) => NUMERIC_ID.test(s)) ? 200 : 404 };
}
