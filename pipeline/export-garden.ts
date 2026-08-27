#!/usr/bin/env bun
// Build garden-data.json for the prototype artifact:
// nodes = threads + standalone tweets in the quote web; edges = self-quote links.
import fs from "node:fs";
import path from "node:path";
import type {
  ConceptIndex, CorpusEntry, GardenData, GardenEdge, GardenNode, GardenTweet,
  QuotedText, TagMeta, Thread, Tweet,
} from "./types";

const DIR = import.meta.dir;

const tweets: Tweet[] = JSON.parse(fs.readFileSync(path.join(DIR, 'tweets.json'), 'utf8'));
const threads: Thread[] = JSON.parse(fs.readFileSync(path.join(DIR, 'threads.json'), 'utf8'));
const byId = new Map<string, Tweet>(tweets.map(t => [t.id, t]));
const threadById = new Map<string, Thread>(threads.map(t => [t.rootId, t]));
const tweetThread = new Map<string, string>();
for (const th of threads) for (const id of th.tweetIds) tweetThread.set(id, th.rootId);
const nodeOf = (id: string): string => tweetThread.get(id) || id;

// tags.json: { rootId: { title, tags: [], type, grade } } — produced from agent categorization
let tags: Record<string, TagMeta> = {};
try { tags = JSON.parse(fs.readFileSync(path.join(DIR, 'tags.json'), 'utf8')); } catch { /* optional */ }

// --- collect directed edges at node level ---
const edges = new Map<string, GardenEdge>(); // "a>b" -> {from,to}
const inDeg = new Map<string, number>(), outDeg = new Map<string, number>();
for (const t of tweets) {
  for (const q of t.selfQuotes) {
    if (!byId.has(q)) continue;
    const a = nodeOf(t.id), b = nodeOf(q);
    if (a === b) continue;
    const k = a + '>' + b;
    if (!edges.has(k)) edges.set(k, { from: a, to: b });
    inDeg.set(b, (inDeg.get(b) || 0) + 1);
    outDeg.set(a, (outDeg.get(a) || 0) + 1);
  }
}
const degreeOf = (n: string): number => (inDeg.get(n) || 0) + (outDeg.get(n) || 0);

// --- select nodes ---
const selected = new Set<string>();
// 1. top 250 threads by salience
const scored = [...threads].map(th => ({ ...th, score: th.size * 10 + th.totalFavs })).sort((a, b) => b.score - a.score);
for (const th of scored.slice(0, 250)) selected.add(th.rootId);
// 2. anything in the quote web with degree >= 2
for (const n of new Set([...inDeg.keys(), ...outDeg.keys()])) {
  if (degreeOf(n) >= 2) selected.add(n);
}
// 3. endpoints of edges where the other side is selected AND node is a thread or high-fav tweet
for (const { from, to } of edges.values()) {
  for (const [n, other] of [[from, to], [to, from]] as Array<[string, string]>) {
    if (selected.has(other) && !selected.has(n)) {
      const th = threadById.get(n);
      const t = byId.get(n);
      if (th || (t && t.favs >= 25)) selected.add(n);
    }
  }
}

// --- build node objects ---
function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/https:\/\/t\.co\/\w+/g, m => m); // keep t.co links; UI will de-emphasize
}
const nodes: GardenNode[] = [];
for (const n of selected) {
  const th = threadById.get(n);
  const meta = tags[n] || {};
  if (th) {
    const tws: GardenTweet[] = th.tweetIds.map(id => {
      const t = byId.get(id)!;
      return {
        id: t.id, d: t.created.slice(0, 10), f: t.favs,
        x: cleanText(t.text),
        q: t.selfQuotes.filter(q => byId.has(q)),
        m: t.hasMedia || /https:\/\/t\.co\//.test(t.text) && false,
      };
    });
    nodes.push({
      id: n, kind: 'thread', size: th.size, favs: th.totalFavs, started: th.started.slice(0, 10),
      span: th.spanDays, reply: th.isReplyToOther ? th.replyToScreen : null,
      title: meta.title || null, tags: meta.tags || [], type: meta.type || null, grade: meta.grade || null,
      tweets: tws,
    });
  } else {
    const t = byId.get(n);
    if (!t) continue;
    nodes.push({
      id: n, kind: 'tweet', size: 1, favs: t.favs, started: t.created.slice(0, 10),
      title: meta.title || null, tags: meta.tags || [], type: meta.type || null, grade: meta.grade || null,
      tweets: [{ id: t.id, d: t.created.slice(0, 10), f: t.favs, x: cleanText(t.text), q: t.selfQuotes.filter(q => byId.has(q)) }],
    });
  }
}

// --- edges among selected; also tweet-level quote targets resolved to nodes ---
const edgeList = [...edges.values()].filter(e => selected.has(e.from) && selected.has(e.to));

// quoted tweet texts for inline quote-cards (any tweet quoted by a selected node's tweets)
const quotedTexts: Record<string, QuotedText> = {};
for (const node of nodes) {
  for (const tw of node.tweets) {
    for (const q of tw.q) {
      const qt = byId.get(q);
      if (qt) quotedTexts[q] = { x: cleanText(qt.text), d: qt.created.slice(0, 10), node: nodeOf(q), inNode: selected.has(nodeOf(q)) };
    }
  }
}

// --- precompute force layout (deterministic, seeded) ---
let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const idx = new Map<string, number>(nodes.map((n, i) => [n.id, i]));
const N = nodes.length;
const px = new Float64Array(N), py = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
for (let i = 0; i < N; i++) { const a = rand() * Math.PI * 2, r = 300 + rand() * 700; px[i] = Math.cos(a) * r; py[i] = Math.sin(a) * r; }
const elist: Array<[number, number]> = edgeList
  .map(e => [idx.get(e.from), idx.get(e.to)] as [number | undefined, number | undefined])
  .filter((pair): pair is [number, number] => pair[0] != null && pair[1] != null);
const mass = nodes.map(n => 2 + Math.sqrt(n.size) + Math.sqrt(n.favs || 0) * 0.3);
for (let iter = 0; iter < 600; iter++) {
  const k = iter < 150 ? 1 : iter < 400 ? 0.6 : 0.3;
  // repulsion (O(n^2) fine offline)
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let dx = px[i] - px[j], dy = py[i] - py[j];
      let d2 = dx * dx + dy * dy + 0.01;
      if (d2 > 250000) continue;
      const f = 700 * k / d2;
      dx *= f; dy *= f;
      vx[i] += dx; vy[i] += dy; vx[j] -= dx; vy[j] -= dy;
    }
  }
  // attraction along edges
  for (const [a, b] of elist) {
    let dx = px[b] - px[a], dy = py[b] - py[a];
    const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const f = 0.006 * k * (d - 40);
    dx *= f; dy *= f;
    vx[a] += dx; vy[a] += dy; vx[b] -= dx; vy[b] -= dy;
  }
  // gravity to center
  for (let i = 0; i < N; i++) {
    vx[i] -= px[i] * 0.0015 * k; vy[i] -= py[i] * 0.0015 * k;
    px[i] += Math.max(-15, Math.min(15, vx[i])); py[i] += Math.max(-15, Math.min(15, vy[i]));
    vx[i] *= 0.6; vy[i] *= 0.6;
  }
}
for (let i = 0; i < N; i++) { const nd = nodes[i]!; nd.x = Math.round(px[i]); nd.y = Math.round(py[i]); nd.r = Math.round(mass[i] * 10) / 10; }

// --- concept weave: all own tweets matching the concept lexicon ---
const weave: { concepts: string[]; corpus: CorpusEntry[] } = { concepts: [], corpus: [] };
try {
  const ci: ConceptIndex = JSON.parse(fs.readFileSync(path.join(DIR, 'concept-index.json'), 'utf8'));
  const tweetById = new Map<string, Tweet>(tweets.map(t => [t.id, t]));
  weave.concepts = ci.concepts;
  for (const [id, cidx] of Object.entries(ci.perTweet)) {
    const t = tweetById.get(id);
    if (!t) continue;
    const th = tweetThread.get(id);
    weave.corpus.push({
      id, d: t.created.slice(0, 10), f: t.favs,
      x: cleanText(t.text), c: cidx,
      th: th && selected.has(th) ? th : null,
      m: t.hasMedia || undefined,
    });
  }
  weave.corpus.sort((a, b) => a.d.localeCompare(b.d));
} catch (e) { console.log('no concept index, skipping weave:', (e as Error).message); }

const out: GardenData = { generated: '2026-07-06', account: 'pee_zombie', nodes, edges: edgeList, quoted: quotedTexts, concepts: weave.concepts, corpus: weave.corpus };
fs.writeFileSync(path.join(DIR, 'garden-data.json'), JSON.stringify(out));
console.log('weave: concepts:', weave.concepts.length, '| corpus tweets:', weave.corpus.length);
console.log('nodes:', nodes.length, '(threads:', nodes.filter(n => n.kind === 'thread').length + ')', '| edges:', edgeList.length, '| quoted refs:', Object.keys(quotedTexts).length);
console.log('json size:', Math.round(fs.statSync(path.join(DIR, 'garden-data.json')).size / 1024) + 'KB');
