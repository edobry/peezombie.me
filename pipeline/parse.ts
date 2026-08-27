#!/usr/bin/env bun
// Parse pee_zombie twitter archive: normalize tweets, reconstruct self-reply threads,
// extract self-quote-tweet graph, compute stats.
import fs from "node:fs";
import path from "node:path";
import type { NoteTweet, OtherQuote, RawTweet, Thread, ThreadLink, Tweet } from "./types";

const DIR = import.meta.dir;
const ACCOUNT_ID = "1278573670739464192";
const USERNAME = "pee_zombie";

/** Archive files are `window.YTD.x.part0 = [...]` — strip the assignment, parse the array. */
function loadYTD<T>(file: string): T[] {
  const raw = fs.readFileSync(path.join(DIR, "archive/data", file), "utf8");
  const idx = raw.indexOf("=");
  return JSON.parse(raw.slice(idx + 1)) as T[];
}

const tweetsRaw = loadYTD<{ tweet: RawTweet }>("tweets.js").map((x) => x.tweet);
const noteTweets = loadYTD<{ noteTweet: NoteTweet }>("note-tweet.js").map((x) => x.noteTweet);
const noteById = new Map<string, NoteTweet>();
for (const n of noteTweets) noteById.set(n.noteTweetId, n);

// Normalize
const tweets: Tweet[] = tweetsRaw.map((t) => {
  const urls = (t.entities?.urls || []).map((u) => u.expanded_url).filter((u): u is string => Boolean(u));
  const isRT = t.full_text.startsWith("RT @");
  // self-quote detection: link to own status
  const selfQuotes: string[] = [];
  const otherQuotes: OtherQuote[] = [];
  for (const u of urls) {
    const m = u.match(/(?:twitter|x)\.com\/(\w+)\/status\/(\d+)/i);
    if (m) {
      if (m[1]!.toLowerCase() === USERNAME) selfQuotes.push(m[2]!);
      else if (m[1]!.toLowerCase() === "i") {
        /* /i/web/status - ambiguous */ selfQuotes.push(`${m[2]!}?`);
      } else otherQuotes.push({ user: m[1]!, id: m[2]! });
    }
  }
  return {
    id: t.id_str,
    created: new Date(t.created_at).toISOString(),
    text: t.full_text,
    favs: +t.favorite_count,
    rts: +t.retweet_count,
    replyToId: t.in_reply_to_status_id_str || null,
    replyToUser: t.in_reply_to_user_id_str || null,
    replyToScreen: t.in_reply_to_screen_name || null,
    isRT,
    urls,
    selfQuotes,
    otherQuotes,
    mentions: (t.entities?.user_mentions || []).map((m) => m.screen_name),
    hashtags: (t.entities?.hashtags || []).map((h) => h.text),
    hasMedia: Boolean(t.extended_entities?.media?.length || t.entities?.media?.length),
    lang: t.lang,
  };
});

const byId = new Map<string, Tweet>(tweets.map((t) => [t.id, t]));

// resolve ambiguous /i/web/status self-quotes: it's a self-quote iff the id is in our corpus
for (const t of tweets) {
  t.selfQuotes = t.selfQuotes
    .map((q) => {
      if (q.endsWith("?")) {
        const id = q.slice(0, -1);
        return byId.has(id) ? id : null;
      }
      return q;
    })
    .filter((q): q is string => q !== null);
}

// ---- Thread reconstruction ----
// children map: parent id -> [child tweets] (only self-replies)
const children = new Map<string, Tweet[]>();
for (const t of tweets) {
  if (t.replyToId && t.replyToUser === ACCOUNT_ID) {
    if (!children.has(t.replyToId)) children.set(t.replyToId, []);
    children.get(t.replyToId)!.push(t);
  }
}
for (const arr of children.values()) arr.sort((a, b) => a.created.localeCompare(b.created));

// A thread root: a tweet that has self-reply children AND is not itself a self-reply
// (it may be a reply to someone else, or reply to a deleted own tweet -> orphan root)
function isSelfReply(t: Tweet): boolean {
  return Boolean(t.replyToId && t.replyToUser === ACCOUNT_ID && byId.has(t.replyToId));
}
const roots = tweets.filter((t) => children.has(t.id) && !isSelfReply(t));
// orphan roots: self-replies whose parent is missing from archive
const orphanRoots = tweets.filter(
  (t) => t.replyToUser === ACCOUNT_ID && t.replyToId && !byId.has(t.replyToId) && children.has(t.id)
);

/** DFS from the root collecting ALL descendants — threads can branch. */
function collectThread(root: Tweet): Tweet[] {
  const nodes: Tweet[] = [];
  const stack: Tweet[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    nodes.push(cur);
    const kids = children.get(cur.id) || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
  nodes.sort((a, b) => a.created.localeCompare(b.created));
  return nodes;
}

const threads: Thread[] = [...roots, ...orphanRoots]
  .map((root) => {
    const nodes = collectThread(root);
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const totalFavs = nodes.reduce((s, n) => s + n.favs, 0);
    const spanDays = (new Date(last.created).getTime() - new Date(first.created).getTime()) / 86400000;
    const selfQuoteOut = nodes.flatMap((n) => n.selfQuotes);
    return {
      rootId: root.id,
      rootText: root.text,
      isReplyToOther: Boolean(root.replyToUser && root.replyToUser !== ACCOUNT_ID),
      replyToScreen: root.replyToScreen,
      size: nodes.length,
      totalFavs,
      maxFavs: Math.max(...nodes.map((n) => n.favs)),
      started: first.created,
      ended: last.created,
      spanDays: Math.round(spanDays * 10) / 10,
      tweetIds: nodes.map((n) => n.id),
      selfQuoteOut,
    };
  })
  .sort((a, b) => b.size - a.size);

// tweet id -> thread root id
const tweetThread = new Map<string, string>();
for (const th of threads) for (const id of th.tweetIds) tweetThread.set(id, th.rootId);

// ---- Self-quote graph at thread level ----
const threadLinks: ThreadLink[] = [];
for (const th of threads) {
  for (const q of th.selfQuoteOut) {
    const targetThread = tweetThread.get(q) || (byId.has(q) ? q : null);
    if (targetThread && targetThread !== th.rootId) {
      threadLinks.push({ from: th.rootId, to: targetThread });
    }
  }
}
// standalone tweets with self-quotes also link
let standaloneQuoteLinks = 0;
for (const t of tweets) {
  if (!tweetThread.has(t.id) && t.selfQuotes.length) standaloneQuoteLinks += t.selfQuotes.length;
}

// ---- Stats ----
const own = tweets.filter((t) => !t.isRT);
const replies = own.filter((t) => t.replyToUser && t.replyToUser !== ACCOUNT_ID);
const selfReplies = own.filter((t) => t.replyToUser === ACCOUNT_ID);
const standalone = own.filter((t) => !t.replyToId);
const byYear: Record<string, number> = {};
for (const t of own) {
  const y = t.created.slice(0, 4);
  byYear[y] = (byYear[y] || 0) + 1;
}
const selfQuoteCount = own.reduce((s, t) => s + t.selfQuotes.length, 0);

const stats = {
  total: tweets.length,
  retweets: tweets.length - own.length,
  own: own.length,
  standalone: standalone.length,
  repliesToOthers: replies.length,
  selfReplies: selfReplies.length,
  byYear,
  threads: threads.length,
  threadsBySize: {
    "2-4": threads.filter((t) => t.size >= 2 && t.size <= 4).length,
    "5-9": threads.filter((t) => t.size >= 5 && t.size <= 9).length,
    "10-19": threads.filter((t) => t.size >= 10 && t.size <= 19).length,
    "20-49": threads.filter((t) => t.size >= 20 && t.size <= 49).length,
    "50+": threads.filter((t) => t.size >= 50).length,
  },
  tweetsInThreads: tweetThread.size,
  selfQuoteLinks: selfQuoteCount,
  threadToThreadLinks: threadLinks.length,
  longRunningThreads: threads.filter((t) => t.spanDays > 30).length,
  noteTweets: noteTweets.length,
};

fs.writeFileSync(path.join(DIR, "tweets.json"), JSON.stringify(tweets));
fs.writeFileSync(path.join(DIR, "threads.json"), JSON.stringify(threads, null, 1));
fs.writeFileSync(path.join(DIR, "thread-links.json"), JSON.stringify(threadLinks, null, 1));
console.log(JSON.stringify(stats, null, 2));
console.log("\n--- TOP 25 THREADS BY SIZE ---");
for (const th of threads.slice(0, 25)) {
  console.log(
    `[${th.size}tw ${th.totalFavs}favs ${th.spanDays}d] ${th.started.slice(0, 10)} ${th.rootId}\n   ${th.rootText.replace(/\n/g, " / ").slice(0, 150)}`
  );
}
