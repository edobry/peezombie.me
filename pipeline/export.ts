#!/usr/bin/env bun
// Export analysis materials: hub tweets (most self-quoted), top threads with full text, top standalone tweets.
import fs from "node:fs";
import path from "node:path";
import type { Thread, Tweet } from "./types";
const DIR = import.meta.dir;

const tweets: Tweet[] = JSON.parse(fs.readFileSync(path.join(DIR, 'tweets.json'), 'utf8'));
const threads: Thread[] = JSON.parse(fs.readFileSync(path.join(DIR, 'threads.json'), 'utf8'));
const byId = new Map(tweets.map(t => [t.id, t]));
const tweetThread = new Map();
for (const th of threads) for (const id of th.tweetIds) tweetThread.set(id, th);

// ---- Hubs: in-degree of self-quotes ----
const inDeg = new Map();
for (const t of tweets) {
  for (const q of t.selfQuotes) {
    if (!inDeg.has(q)) inDeg.set(q, []);
    inDeg.get(q).push(t.id);
  }
}
const hubs = [...inDeg.entries()]
  .filter(([id]) => byId.has(id))
  .map(([id, quoters]) => ({ id, n: quoters.length, quoters }))
  .sort((a, b) => b.n - a.n)
  .slice(0, 60);

let hubMd = '# Hub tweets (most self-quoted = recurring concepts)\n\n';
for (const h of hubs) {
  const t = byId.get(h.id)!;
  hubMd += `## ${h.n}x quoted | ${t.created.slice(0, 10)} | ${t.favs} favs | id:${h.id}\n${t.text}\n\n`;
  const inThread = tweetThread.get(h.id);
  if (inThread && inThread.rootId !== h.id) hubMd += `(part of thread ${inThread.rootId}: "${inThread.rootText.slice(0, 80)}")\n\n`;
}
fs.writeFileSync(path.join(DIR, 'hubs.md'), hubMd);

// ---- Top threads, salience = size*10 + totalFavs, exclude pure @reply convos with others? keep all ----
const scored = threads.map(th => ({ ...th, score: th.size * 10 + th.totalFavs }))
  .sort((a, b) => b.score - a.score);
const top = scored.slice(0, 200);

// chunk into 5 files of 40 threads for agent analysis
for (let c = 0; c < 5; c++) {
  let md = `# Threads chunk ${c + 1} (of top 200 by salience)\n\n`;
  for (const th of top.slice(c * 40, (c + 1) * 40)) {
    md += `\n---\n## THREAD id:${th.rootId} | ${th.size} tweets | ${th.totalFavs} favs | started ${th.started.slice(0, 10)} | span ${th.spanDays}d${th.isReplyToOther ? ` | reply to @${th.replyToScreen}` : ''}\n\n`;
    for (const id of th.tweetIds) {
      const t = byId.get(id)!;
      const quotes = t.selfQuotes.length ? ` [self-quotes: ${t.selfQuotes.join(',')}]` : '';
      md += `• ${t.text.replace(/\s+/g, ' ')}${quotes}\n`;
    }
  }
  fs.writeFileSync(path.join(DIR, `threads-chunk-${c + 1}.md`), md);
}

// ---- Top standalone/root tweets by favs ----
const topTweets = tweets.filter(t => !t.isRT && t.favs >= 30)
  .sort((a, b) => b.favs - a.favs).slice(0, 250);
let ttMd = '# Top tweets by favorites\n\n';
for (const t of topTweets) {
  ttMd += `[${t.favs}f ${t.created.slice(0, 10)} id:${t.id}${tweetThread.has(t.id) ? ' IN-THREAD' : ''}] ${t.text.replace(/\s+/g, ' ')}\n\n`;
}
fs.writeFileSync(path.join(DIR, 'top-tweets.md'), ttMd);

// long-running threads (trailheads)
const longRunning = threads.filter(t => t.spanDays > 14).sort((a, b) => b.size - a.size);
let lrMd = '# Long-running threads (live/trailhead style)\n\n';
for (const th of longRunning) {
  lrMd += `[${th.size}tw ${th.spanDays}d ${th.started.slice(0, 10)}→${th.ended.slice(0, 10)} id:${th.rootId}] ${th.rootText.replace(/\s+/g, ' ').slice(0, 200)}\n\n`;
}
fs.writeFileSync(path.join(DIR, 'long-running.md'), lrMd);

console.log('hubs:', hubs.length, '| top threads exported:', top.length, '| top tweets:', topTweets.length, '| long-running:', longRunning.length);
console.log('sizes:', ...[1, 2, 3, 4, 5].map(i => fs.statSync(path.join(DIR, `threads-chunk-${i}.md`)).size));
