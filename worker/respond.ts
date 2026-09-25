// Finish an app-route response (mt#5216). Pure over the Fetch API — no
// Workers-only globals — so it is unit-tested with bun and typechecks in both
// programs.
export function respond(method: string, res: Response, status: number, rewritten: boolean): Response {
  const headers = new Headers(res.headers);
  if (rewritten) {
    // The body is no longer the asset's bytes, so neither header copied from
    // the asset describes it: the ETag would validate the wrong content, and a
    // stale Content-Length makes the response malformed. HTMLRewriter streams;
    // the runtime frames the new length itself.
    headers.delete("etag");
    headers.delete("content-length");
  }
  // HEAD gets GET's headers and no body. The shell is fetched with GET either
  // way because the headers are what a HEAD needs, and the asset binding is
  // the only place they come from.
  return new Response(method === "HEAD" ? null : res.body, { status, headers });
}
