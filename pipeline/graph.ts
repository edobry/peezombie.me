#!/usr/bin/env bun
// Analyze the self-quote graph: connected components over threads+standalone tweets.
import fs from "node:fs";
import path from "node:path";
import type { Thread, Tweet } from "./types";
const DIR = import.meta.dir;

const tweets: Tweet[] = JSON.parse(fs.readFileSync(path.join(DIR, 'tweets.json'), 'utf8'));
const threads: Thread[] = JSON.parse(fs.readFileSync(path.join(DIR, 'threads.json'), 'utf8'));
const byId = new Map(tweets.map(t => [t.id, t]));
const tweetThread = new Map();
for (const th of threads) for (const id of th.tweetIds) tweetThread.set(id, th.rootId);

// node = thread root id, or standalone tweet id
const nodeOf = (id: string): string => tweetThread.get(id) || id;

// edges from every self-quote
const adj = new Map<string, Set<string>>();
function addEdge(a: string, b: string): void {
  if (a === b) return;
  if (!adj.has(a)) adj.set(a, new Set());
  if (!adj.has(b)) adj.set(b, new Set());
  adj.get(a)!.add(b);
  adj.get(b)!.add(a);
}
let edgeCount = 0;
for (const t of tweets) {
  for (const q of t.selfQuotes) {
    if (!byId.has(q)) continue;
    addEdge(nodeOf(t.id), nodeOf(q));
    edgeCount++;
  }
}

// connected components
const seen = new Set();
const comps = [];
for (const start of adj.keys()) {
  if (seen.has(start)) continue;
  const comp = [];
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const cur = stack.pop()!;
    comp.push(cur);
    for (const nb of adj.get(cur) || []) {
      if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
  }
  comps.push(comp);
}
comps.sort((a, b) => b.length - a.length);

const threadById = new Map<string, Thread>(threads.map(t => [t.rootId, t]));
const nodeSize = (n: string): number => threadById.get(n)?.size || 1;

console.log('nodes in quote-graph:', adj.size, '| undirected edges (quote links):', edgeCount);
console.log('components:', comps.length);
console.log('component sizes (top 15):', comps.slice(0, 15).map(c => c.length).join(', '));
const giant = comps[0]!;
const giantTweets = giant.reduce((s, n) => s + nodeSize(n), 0);
console.log(`giant component: ${giant.length} nodes covering ~${giantTweets} tweets`);

// most-connected nodes in giant component
const deg = giant.map(n => ({ n, d: adj.get(n)!.size })).sort((a, b) => b.d - a.d).slice(0, 15);
console.log('\ntop hubs in giant component:');
for (const { n, d } of deg) {
  const t = byId.get(n);
  const th = threadById.get(n);
  console.log(`  deg=${d} ${th ? `thread(${th.size}tw)` : 'tweet'} ${n}: ${(th?.rootText || t?.text || '?').replace(/\s+/g, ' ').slice(0, 100)}`);
}
