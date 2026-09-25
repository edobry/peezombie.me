#!/usr/bin/env bun
// respond() is the last step of every app-route response (mt#5216); these pin
// the header discipline PR #7's review asked for.
import { describe, expect, test } from "bun:test";
import { respond } from "./respond";

function shell(): Response {
  return new Response("<html>shell</html>", {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-length": "18",
      etag: '"abc"',
      "x-content-type-options": "nosniff",
    },
  });
}

describe("respond", () => {
  test("a rewritten body drops the asset's ETag and Content-Length, keeps the rest", async () => {
    const r = respond("GET", shell(), 200, true);
    expect(r.headers.get("etag")).toBeNull();
    expect(r.headers.get("content-length")).toBeNull();
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.text()).toBe("<html>shell</html>");
  });

  test("an unrewritten body keeps the asset's validators", () => {
    const r = respond("GET", shell(), 200, false);
    expect(r.headers.get("etag")).toBe('"abc"');
    expect(r.headers.get("content-length")).toBe("18");
  });

  test("HEAD gets the headers and no body", async () => {
    const r = respond("HEAD", shell(), 200, true);
    expect(r.body).toBeNull();
    expect(await r.text()).toBe("");
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  test("the decided status is applied, whatever the asset returned", () => {
    expect(respond("GET", shell(), 404, false).status).toBe(404);
  });
});
